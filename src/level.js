// 關卡生成：障礙物（火車、跳台、柵欄）與金幣的配置、移動與回收
import {
  LANES,
  GROUND,
  TRAIN_W,
  TRAIN_TOP,
  RAMP_LEN,
  MOVING_TRAIN_SPEED,
  MOVING_TRAIN_TRIGGER,
  GRAVITY,
} from './config.js';
import * as THREE from 'three';
import { POWERUPS } from './progress.js';
import { itemMaterial } from './fx.js';

// 加速帶：往前的發光箭頭
function arrowTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 64, 128);
  ctx.fillStyle = '#ffffff';
  for (let y = 0; y < 128; y += 64) {
    ctx.beginPath();
    ctx.moveTo(8, y + 44);
    ctx.lineTo(32, y + 14);
    ctx.lineTo(56, y + 44);
    ctx.lineTo(56, y + 60);
    ctx.lineTo(32, y + 30);
    ctx.lineTo(8, y + 60);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1.5);
  return t;
}

// 每日挑戰時換成有種子的亂數，讓大家跑到同一條路
let rng = Math.random;
export function setLevelRng(fn) {
  rng = fn || Math.random;
}

const rand = (a, b) => a + rng() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[(rng() * arr.length) | 0];
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const COIN_Y = 1.05;

export class Level {
  constructor(scene, models, sfx, powerModels) {
    this.scene = scene;
    this.models = models;
    this.sfx = sfx;
    this.powerModels = powerModels;
    this.powerups = [];
    this.debris = [];
    this.pads = [];
    this.padTex = arrowTexture();
    this.padGeo = new THREE.PlaneGeometry(2.0, 3.2).rotateX(-Math.PI / 2);
    this.padMat = new THREE.MeshBasicMaterial({
      map: this.padTex,
      color: new THREE.Color(0.4, 2.6, 3.4),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.obstacles = [];
    this.coins = [];
    this.coinPool = [];
    this.items = [];
    this.springs = [];
    this.zips = [];
    this.noPowerups = false;
    this.noPads = false;
    this.extraDifficulty = 0;
    this.buildFeatureModels();
    this.cursor = 0;
    this.difficulty = 0;
    this.runDist = 0;
  }

  reset(playerZ = 0) {
    for (const o of this.obstacles) this.scene.remove(o.mesh);
    for (const c of this.coins) this.releaseCoin(c);
    for (const p of this.powerups) this.scene.remove(p.mesh);
    for (const d of this.debris) this.scene.remove(d.mesh);
    for (const p of this.pads) this.scene.remove(p.mesh);
    for (const it of this.items) this.scene.remove(it.mesh);
    for (const sp of this.springs) this.scene.remove(sp.mesh);
    for (const zp of this.zips) this.scene.remove(zp.mesh);
    this.items = [];
    this.springs = [];
    this.zips = [];
    this.pads = [];
    this.obstacles = [];
    this.coins = [];
    this.powerups = [];
    this.debris = [];
    this.cursor = playerZ - 40;
    this.chunkIndex = 0;
    // 開場擺飾：玩家身後兩側停著列車
    this.addTrain(0, playerZ + 30, 2, { decorative: true });
    this.addTrain(2, playerZ + 18, 1, { decorative: true });
    this.addCoinLine(1, playerZ - 12, 8);
  }

  // ---------- 物件建立 ----------
  addTrain(lane, zFront, cars, { moving = false, decorative = false } = {}) {
    // 依所在場景決定是列車、巴士還是動物
    const vehicle = this.themeAt?.(zFront)?.vehicle || 'train';
    const { group, length, legs } = this.models.train(cars, { lit: moving, kind: vehicle });
    group.position.set(LANES[lane], 0, zFront);
    this.scene.add(group);
    const o = {
      kind: 'train',
      vehicle,
      legs: legs || [],
      lane,
      x: LANES[lane],
      halfW: TRAIN_W / 2,
      zFront,
      length,
      mesh: group,
      moving,
      active: false,
      horned: false,
      decorative,
      top: TRAIN_TOP,
    };
    this.obstacles.push(o);
    return o;
  }

  addRamp(lane, zFront) {
    const mesh = this.models.ramp();
    mesh.position.set(LANES[lane], 0, zFront);
    this.scene.add(mesh);
    const o = { kind: 'ramp', lane, x: LANES[lane], halfW: 1.05, zFront, length: RAMP_LEN, mesh };
    this.obstacles.push(o);
    return o;
  }

  addBarrier(kind, lane, z) {
    const mesh = this.models.barrier(kind);
    mesh.position.set(LANES[lane], 0.1, z);
    this.scene.add(mesh);
    const o = {
      kind,
      lane,
      x: LANES[lane],
      halfW: 1.05,
      zFront: z + 0.12,
      length: 0.24,
      mesh,
      // 低柵欄：腳要高過 top；高柵欄：頭要低於 bottom
      top: 1.22,
      bottom: 1.6,
    };
    this.obstacles.push(o);
    return o;
  }

  getCoin() {
    const m = this.coinPool.pop() || this.models.coin();
    m.visible = true;
    m.scale.setScalar(1);
    this.scene.add(m);
    return m;
  }

  releaseCoin(c) {
    this.scene.remove(c.mesh);
    this.coinPool.push(c.mesh);
  }

  addCoin(x, y, z, fall = 0, value = 1) {
    const mesh = this.getCoin();
    mesh.position.set(x, y + fall, z);
    mesh.rotation.y = z * 0.35;
    const base = value > 1 ? 1.7 : 1;
    mesh.scale.setScalar(base);
    this.coins.push({ mesh, x, y, z, taken: false, t: 0, fall, value, base });
  }

  // ---------- 新玩法的模型 ----------
  buildFeatureModels() {
    const std = (c, e = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...e });
    this.fm = {
      red: std('#e8384f'),
      blue: std('#1f6fd1', { roughness: 0.6 }),
      steel: std('#9aa3ad', { roughness: 0.3, metalness: 0.8 }),
      dark: std('#2a2d31', { roughness: 0.7 }),
      yellow: std('#ffc21a', { roughness: 0.5 }),
      cable: std('#1d1f22', { roughness: 0.5, metalness: 0.6 }),
      rail: std('#cfd6de', { roughness: 0.2, metalness: 0.9 }),
    };
    this.fg = {
      trampFrame: new THREE.TorusGeometry(1.0, 0.12, 8, 28).rotateX(Math.PI / 2).translate(0, 0.55, 0),
      trampMat: new THREE.CylinderGeometry(0.92, 0.92, 0.04, 28).translate(0, 0.5, 0),
      trampLegs: new THREE.CylinderGeometry(0.06, 0.06, 0.55, 6),
      post: new THREE.BoxGeometry(0.3, 8.0, 0.3).translate(0, 4.0, 0),
      beam: new THREE.BoxGeometry(9.6, 0.35, 0.35).translate(0, 7.9, 0),
      handle: new THREE.BoxGeometry(0.9, 0.08, 0.08).translate(0, -1.3, 0),
      rope: new THREE.BoxGeometry(0.05, 1.3, 0.05),
      pulley: new THREE.CylinderGeometry(0.16, 0.16, 0.1, 12).rotateZ(Math.PI / 2),
      railBar: new THREE.CylinderGeometry(0.09, 0.09, 1, 10).rotateX(Math.PI / 2),
      railPost: new THREE.BoxGeometry(0.12, 1.2, 0.12).translate(0, 0.6, 0),
      railCap: new THREE.BoxGeometry(0.5, 0.2, 0.3),
      bollard: new THREE.BoxGeometry(0.18, 0.95, 0.18).translate(0, 0.48, 0),
      divRail: new THREE.BoxGeometry(0.12, 0.12, 1),
      signPost: new THREE.BoxGeometry(0.25, 7.4, 0.25).translate(0, 3.7, 0),
      sign: new THREE.PlaneGeometry(8.6, 1.7),
    };
  }

  // 彈跳床：踩上去彈到高空，沿著拋物線放一串金幣
  addTrampoline(lane, z, speed) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(this.fg.trampFrame, this.fm.red), new THREE.Mesh(this.fg.trampMat, this.fm.blue));
    for (let k = 0; k < 4; k++) {
      const leg = new THREE.Mesh(this.fg.trampLegs, this.fm.dark);
      const a = (k / 4) * Math.PI * 2 + 0.6;
      leg.position.set(Math.cos(a) * 0.85, 0.28, Math.sin(a) * 0.85);
      g.add(leg);
    }
    g.position.set(LANES[lane], 0.15, z);
    g.traverse((o) => (o.castShadow = true));
    this.scene.add(g);
    this.springs.push({ mesh: g, lane, x: LANES[lane], z, used: false, t: 0 });
    const vy = Math.sqrt(2 * GRAVITY * 7);
    const air = (2 * vy) / GRAVITY;
    const fwd = speed + 1.5;
    for (let i = 2; i < 12; i++) {
      const t = (i / 12) * air;
      this.addCoin(LANES[lane], GROUND + 0.6 + vy * t - 0.5 * GRAVITY * t * t, z - fwd * t);
    }
  }

  // 滑索：兩座門架之間的鋼索，經過起點就會抓住滑過去
  addZipline(lane, z, len = 64) {
    const g = new THREE.Group();
    const x = LANES[lane];
    for (const zz of [0, -len]) {
      for (const sx of [-4.8, 4.8]) {
        const p = new THREE.Mesh(this.fg.post, this.fm.yellow);
        p.position.set(sx, 0, zz);
        p.castShadow = true;
        g.add(p);
      }
      const b = new THREE.Mesh(this.fg.beam, this.fm.yellow);
      b.position.z = zz;
      g.add(b);
    }
    const drop = 0.8;
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, len, 6).rotateX(Math.PI / 2), this.fm.cable);
    cable.position.set(x, 7.65 - drop / 2, -len / 2);
    cable.rotation.x = -Math.atan2(drop, len);
    g.add(cable);
    // 滑輪把手：抓住後跟著跑者一起滑
    const handle = new THREE.Group();
    handle.add(new THREE.Mesh(this.fg.handle, this.fm.red));
    const rope = new THREE.Mesh(this.fg.rope, this.fm.cable);
    rope.position.y = -0.65;
    handle.add(rope);
    const wheel = new THREE.Mesh(this.fg.pulley, this.fm.steel);
    wheel.position.y = 0.22;
    handle.add(wheel);
    handle.position.set(x, 7.3, -0.6);
    g.add(handle);
    g.position.z = z;
    this.scene.add(g);
    this.zips.push({ mesh: g, lane, x, z0: z, z1: z - len, len, drop, used: false, handle });
    for (let d = 6; d < len - 4; d += 2.4) this.addCoin(x, 5.45 - (d / len) * drop * 0.5, z - d);
  }

  // 磨軌欄杆：跳上去可以滑過一整段，當成矮的「列車」處理
  addGrindRail(lane, zFront, len) {
    const g = new THREE.Group();
    const bar = new THREE.Mesh(this.fg.railBar, this.fm.rail);
    bar.scale.z = len;
    bar.position.set(0, 1.22, -len / 2);
    g.add(bar);
    for (let d = 0.6; d < len; d += 3) {
      const p = new THREE.Mesh(this.fg.railPost, this.fm.dark);
      p.position.z = -d;
      g.add(p);
    }
    for (const zz of [-0.1, -len + 0.1]) {
      const c = new THREE.Mesh(this.fg.railCap, this.fm.yellow);
      c.position.set(0, 1.22, zz);
      g.add(c);
    }
    g.traverse((o) => (o.castShadow = true));
    g.position.set(LANES[lane], 0, zFront);
    this.scene.add(g);
    const o = { kind: 'rail', lane, x: LANES[lane], halfW: 0.42, zFront, length: len, mesh: g, top: 1.32 };
    this.obstacles.push(o);
    return o;
  }

  // 分岔路線的路牌
  forkSignTexture(riskyLeft) {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 200;
    const ctx = c.getContext('2d');
    const half = (x, bg, text) => {
      ctx.fillStyle = bg;
      ctx.fillRect(x, 0, 512, 200);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 64px "Chiron GoRound TC", "Fredoka", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + 256, 104);
    };
    if (riskyLeft) {
      half(0, '#d7263d', '◀ 金幣大道 危險');
      half(512, '#1f8a4c', '安全通道 ▶');
    } else {
      half(0, '#1f8a4c', '◀ 安全通道');
      half(512, '#d7263d', '金幣大道 危險 ▶');
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 1016, 192);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // 某車道某處的「地面」高度（列車頂、斜坡或路面）
  surfaceAt(lane, z) {
    let h = GROUND;
    for (const o of this.obstacles) {
      if (o.lane !== lane || (o.kind !== 'train' && o.kind !== 'ramp')) continue;
      if (z <= o.zFront && z >= o.zFront - o.length) h = Math.max(h, this.heightAt(o, z));
    }
    return h;
  }

  // 金幣雨：三條道路從天而降的金幣
  addCoinRain(zStart, length) {
    for (let lane = 0; lane < 3; lane++) {
      for (let d = 0; d < length; d += 2.6) {
        const z = zStart - d - lane * 0.8;
        this.addCoin(LANES[lane], this.surfaceAt(lane, z) + COIN_Y, z, 7 + d * 0.12);
      }
    }
  }

  addPad(lane, z) {
    const mesh = new THREE.Mesh(this.padGeo, this.padMat);
    mesh.position.set(LANES[lane], 0.235, z);
    this.scene.add(mesh);
    this.pads.push({ mesh, lane, x: LANES[lane], z, used: false });
  }

  // 活動代幣或字母：發光圓牌
  addItem(kind, char, color, ink, lane, z, font) {
    const mesh = new THREE.Sprite(itemMaterial(char, color, ink, font));
    const y = this.surfaceAt(lane, z) + COIN_Y + 0.15;
    mesh.position.set(LANES[lane], y, z);
    mesh.scale.setScalar(kind === 'letter' ? 1.25 : 0.95);
    this.scene.add(mesh);
    this.items.push({ kind, char, mesh, x: LANES[lane], y, z, taken: false, t: 0, base: mesh.scale.x });
  }

  // 新手教學：換道、跳躍、滑鏟三個固定關卡，回傳每一步的位置
  addTutorial() {
    this.addTrain(1, -40, 1);
    this.addCoinLine(0, -30, 9);
    this.addCoinLine(2, -30, 9);
    for (const lane of [0, 1, 2]) {
      this.addBarrier('low', lane, -88);
      this.addCoinArc(lane, -88);
      this.addBarrier('high', lane, -130);
      this.addCoinLine(lane, -124, 5, 2.2, () => GROUND + 0.55);
    }
    this.cursor = -190;
    return [
      { need: 'lane', z: -40, at: 14 },
      { need: 'jump', z: -88 + 0.12, at: 4.6 },
      { need: 'slide', z: -130 + 0.12, at: 5 },
    ];
  }

  addCoinLine(lane, zStart, count, spacing = 2.2, yFn = () => GROUND + COIN_Y) {
    for (let i = 0; i < count; i++) {
      const z = zStart - i * spacing;
      this.addCoin(LANES[lane], yFn(z, i), z);
    }
  }

  addCoinArc(lane, zCenter, baseY = GROUND) {
    const n = 7;
    const span = 5.5;
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1)) * 2 - 1;
      const z = zCenter - t * span;
      this.addCoin(LANES[lane], baseY + COIN_Y + 2.0 * (1 - t * t), z);
    }
  }

  // ---------- 道具 ----------
  randomPowerKind() {
    const list = Object.entries(POWERUPS);
    let r = rng() * list.reduce((s, [, p]) => s + p.weight, 0);
    for (const [k, p] of list) {
      r -= p.weight;
      if (r <= 0) return k;
    }
    return 'magnet';
  }

  addPowerup(kind, lane, z, y = GROUND + 1.25) {
    const mesh = this.powerModels.make(kind);
    mesh.position.set(LANES[lane], y, z);
    this.scene.add(mesh);
    this.powerups.push({ kind, mesh, x: LANES[lane], y, z, taken: false, t: 0 });
  }

  // 噴射背包：在天上鋪一條會換道的金幣路
  addSkyCoins(startZ, count, y) {
    let lane = randInt(0, 2);
    for (let i = 0; i < count; i++) {
      if (i % 14 === 13) lane = Math.max(0, Math.min(2, lane + (rng() < 0.5 ? -1 : 1)));
      this.addCoin(LANES[lane], y, startZ - i * 2.4);
    }
  }

  // 衝刺或防護罩撞到的柵欄：彈飛出去
  knock(o, dirX = 0) {
    o.knocked = true;
    this.obstacles = this.obstacles.filter((x) => x !== o);
    this.debris.push({
      mesh: o.mesh,
      v: { x: dirX * 4 + rand(-3, 3), y: rand(8, 11), z: rand(-14, -8) },
      spin: { x: rand(-8, 8), y: rand(-6, 6), z: rand(-8, 8) },
      t: 0,
    });
  }

  // 續跑時清掉玩家附近的障礙
  clearAround(z0, z1) {
    this.obstacles = this.obstacles.filter((o) => {
      const hit = !o.decorative && o.zFront - o.length < z1 && o.zFront > z0;
      if (hit) this.scene.remove(o.mesh);
      return !hit;
    });
  }

  // ---------- 關卡片段 ----------
  generate(playerZ, speed) {
    while (this.cursor > playerZ - 280) {
      const len = this.makeChunk(this.cursor, speed);
      const gap = Math.max(11, (rand(10, 18) * speed) / 16);
      // 片段之間的空檔一定三條道都暢通，道具放這裡
      const r = rng();
      if (this.chunkIndex > 1 && r < 0.26 && !this.noPowerups) {
        this.addPowerup(this.randomPowerKind(), randInt(0, 2), this.cursor - len - gap / 2);
      } else if (this.chunkIndex > 2 && r < 0.36) {
        // 彈跳床
        this.addTrampoline(randInt(0, 2), this.cursor - len - 3, speed);
      } else if (this.chunkIndex > 2 && r < 0.44 && this.runDist > 200) {
        // 滑索：跨過後面的障礙
        this.addZipline(randInt(0, 2), this.cursor - len - 2);
      } else if (this.chunkIndex > 1 && rng() < 0.22 && !this.noPads) {
        // 加速帶，後面接一排金幣
        const lane = randInt(0, 2);
        const z = this.cursor - len - 2;
        this.addPad(lane, z);
        this.addCoinLine(lane, z - 4, Math.max(2, Math.floor((gap - 8) / 2.2)));
      } else if (this.chunkIndex > 1) {
        // 活動代幣、每日字母（由主程式決定要不要放）
        this.onGap?.(this.cursor - len - 1.5, gap - 3);
      }
      this.cursor -= len + gap;
      this.chunkIndex++;
    }
  }

  makeChunk(z0, speed) {
    const d = Math.min(1, this.difficulty + this.extraDifficulty);
    // 前 400 公尺：不出現迎面車輛和三條道全擋的組合，讓新手先熟悉
    const early = this.runDist < 400;
    const table = [
      ['coins', 2.2 - d],
      ['barriers', 2.4],
      ['trainPair', 1.2 + d],
      ['rampTrain', 1.6 + d * 0.6],
      ['moving', this.chunkIndex < 3 || early ? 0 : 0.5 + d * 1.6],
      ['mixed', early ? 0 : 0.8 + d * 1.2],
      ['grind', early ? 0.3 : 0.7],
      ['fork', early ? 0 : 0.45],
    ];
    const total = table.reduce((s, [, w]) => s + w, 0);
    let r = rng() * total;
    let kind = table[0][0];
    for (const [k, w] of table) {
      r -= w;
      if (r <= 0) {
        kind = k;
        break;
      }
    }
    return this[`chunk_${kind}`](z0, speed);
  }

  chunk_coins(z0) {
    const lane = randInt(0, 2);
    const n = randInt(8, 13);
    if (rng() < 0.4) {
      // 蛇形換道金幣
      const to = lane === 1 ? pick([0, 2]) : 1;
      for (let i = 0; i < n; i++) {
        const t = Math.min(1, Math.max(0, (i - n * 0.35) / (n * 0.3)));
        const x = LANES[lane] + (LANES[to] - LANES[lane]) * (t * t * (3 - 2 * t));
        const z = z0 - i * 2.2;
        this.addCoin(x, GROUND + COIN_Y, z);
      }
    } else {
      this.addCoinLine(lane, z0, n);
    }
    return n * 2.2;
  }

  chunk_barriers(z0) {
    const z = z0 - 8;
    const lanes = shuffle([0, 1, 2]);
    const kinds = lanes.map((_, i) => {
      if (i === 0 && this.difficulty < 0.5) return 'none';
      const r = rng();
      return r < 0.45 ? 'low' : r < 0.8 ? 'high' : 'none';
    });
    if (kinds.every((k) => k === 'none')) kinds[1] = 'low';
    lanes.forEach((lane, i) => {
      if (kinds[i] !== 'none') this.addBarrier(kinds[i], lane, z);
    });
    const coinIdx = randInt(0, 2);
    const coinLane = lanes[coinIdx];
    const ck = kinds[coinIdx];
    if (ck === 'low') this.addCoinArc(coinLane, z);
    else if (ck === 'high') this.addCoinLine(coinLane, z + 6, 6, 2.2, () => GROUND + 0.55);
    else this.addCoinLine(coinLane, z + 6, 6);
    return 16;
  }

  chunk_trainPair(z0) {
    const free = randInt(0, 2);
    let len = 0;
    for (const lane of [0, 1, 2]) {
      if (lane === free) continue;
      const cars = randInt(1, 3);
      const off = rand(0, 6);
      const t = this.addTrain(lane, z0 - off, cars);
      len = Math.max(len, off + t.length);
    }
    // 中間車道偶爾放柵欄
    if (this.difficulty > 0.2 && rng() < 0.5 && len > 20) {
      const bz = z0 - len * 0.5;
      const kind = pick(['low', 'high']);
      this.addBarrier(kind, free, bz);
      if (kind === 'low') this.addCoinArc(free, bz);
      else this.addCoinLine(free, bz + 4, 4, 2.2, () => GROUND + 0.55);
      this.addCoinLine(free, z0 - 2, Math.floor((len * 0.5 - 12) / 2.2));
    } else {
      this.addCoinLine(free, z0 - 2, Math.floor(len / 2.2));
    }
    return len;
  }

  chunk_rampTrain(z0) {
    const lane = randInt(0, 2);
    const cars = randInt(2, 3);
    this.addRamp(lane, z0);
    const t = this.addTrain(lane, z0 - RAMP_LEN, cars);
    const total = RAMP_LEN + t.length;
    // 斜坡上 + 車頂金幣
    for (let z = z0 - 1.5; z > z0 - total + 1; z -= 2.2) {
      const onRamp = z > z0 - RAMP_LEN;
      const h = onRamp ? (TRAIN_TOP * (z0 - z)) / RAMP_LEN : TRAIN_TOP;
      this.addCoin(LANES[lane], Math.max(GROUND, h) + COIN_Y, z);
    }
    // 其他車道
    for (const other of [0, 1, 2]) {
      if (other === lane) continue;
      const r = rng();
      if (r < 0.55) {
        const off = rand(-2, 10);
        this.addTrain(other, z0 - RAMP_LEN - off, randInt(1, 3));
      } else if (r < 0.8) {
        this.addBarrier(pick(['low', 'high']), other, z0 - rand(4, 20));
      }
    }
    return total;
  }

  chunk_moving(z0) {
    const lane = randInt(0, 2);
    const cars = randInt(2, 3);
    const reserve = 52;
    const t = this.addTrain(lane, z0 - reserve, cars, { moving: true });
    const total = reserve + t.length;
    const others = shuffle([0, 1, 2].filter((l) => l !== lane));
    // 一個車道放靜止列車或柵欄，另一個保持暢通並放金幣
    if (rng() < 0.6) {
      this.addTrain(others[0], z0 - rand(8, 30), randInt(1, 2));
    } else {
      this.addBarrier(pick(['low', 'high']), others[0], z0 - rand(15, 35));
    }
    this.addCoinLine(others[1], z0 - 4, Math.floor((total - 10) / 2.6), 2.6);
    return total;
  }

  chunk_mixed(z0) {
    const lanes = shuffle([0, 1, 2]);
    const cars = randInt(1, 3);
    const t = this.addTrain(lanes[0], z0, cars);
    const len = t.length;
    const zA = z0 - rand(4, len * 0.4);
    const zB = z0 - rand(len * 0.5, Math.max(len * 0.5 + 1, len - 3));
    const kA = pick(['low', 'high']);
    this.addBarrier(kA, lanes[1], zA);
    this.addBarrier(pick(['low', 'high']), lanes[2], zB);
    if (kA === 'low') this.addCoinArc(lanes[1], zA);
    else this.addCoinLine(lanes[1], zA + 4, 4, 2.2, () => GROUND + 0.55);
    return Math.max(len, 14);
  }

  // 磨軌欄杆，旁邊車道偶爾停一列車
  chunk_grind(z0) {
    const lane = randInt(0, 2);
    const len = rand(20, 28);
    this.addGrindRail(lane, z0 - 3, len);
    for (let z = z0 - 5; z > z0 - len; z -= 2.2) this.addCoin(LANES[lane], 1.32 + COIN_Y, z);
    const others = shuffle([0, 1, 2].filter((l) => l !== lane));
    if (rng() < 0.5) this.addTrain(others[0], z0 - rand(0, 8), randInt(1, 2));
    return len + 4;
  }

  // 分岔路線：一邊是金幣大道（柵欄多、有大金幣），一邊是安全通道，中間有分隔欄
  chunk_fork(z0) {
    const risky = pick([0, 2]);
    const len = 74;
    const dx = (LANES[risky] + LANES[1]) / 2;
    const div = new THREE.Group();
    for (let d = 0; d < len - 6; d += 2) {
      const b = new THREE.Mesh(this.fg.bollard, d % 4 ? this.fm.dark : this.fm.yellow);
      b.position.z = -d;
      div.add(b);
    }
    const rail = new THREE.Mesh(this.fg.divRail, this.fm.yellow);
    rail.scale.z = len - 6;
    rail.position.set(0, 0.95, -(len - 6) / 2);
    div.add(rail);
    div.position.set(dx, 0.1, z0 - 6);
    this.scene.add(div);
    this.obstacles.push({ kind: 'divider', lane: -1, x: dx, halfW: 0.12, zFront: z0 - 6, length: len - 6, mesh: div });
    // 入口路牌
    const sign = new THREE.Group();
    for (const sx of [-4.8, 4.8]) {
      const p = new THREE.Mesh(this.fg.signPost, this.fm.steel);
      p.position.x = sx;
      sign.add(p);
    }
    const face = new THREE.Mesh(this.fg.sign, new THREE.MeshBasicMaterial({ map: this.forkSignTexture(risky === 0), side: THREE.DoubleSide }));
    face.position.y = 6.6;
    sign.add(face);
    sign.position.z = z0;
    this.scene.add(sign);
    this.obstacles.push({ kind: 'sign', lane: -1, x: 99, halfW: 0, zFront: z0, length: 0.5, mesh: sign, decorative: true });
    // 危險車道：柵欄一高一低，中間放大金幣
    let low = rng() < 0.5;
    for (let z = z0 - 14; z > z0 - len + 6; z -= 11) {
      this.addBarrier(low ? 'low' : 'high', risky, z);
      if (low) this.addCoinArc(risky, z);
      else this.addCoinLine(risky, z + 3, 3, 2.2, () => GROUND + 0.55);
      this.addCoin(LANES[risky], GROUND + COIN_Y, z - 5.5, 0, 5);
      low = !low;
    }
    // 安全車道：稀疏的金幣
    const safe = risky === 0 ? 2 : 0;
    this.addCoinLine(1, z0 - 10, 9, 6);
    this.addCoinLine(safe, z0 - 30, 4, 4);
    return len;
  }

  // ---------- 每幀更新 ----------
  update(dt, playerZ, speed, time) {
    this.generate(playerZ, speed);

    for (const o of this.obstacles) {
      if (o.moving) {
        if (!o.active && o.zFront - playerZ > -MOVING_TRAIN_TRIGGER && o.zFront < playerZ) {
          o.active = true;
        }
        if (o.active) {
          o.zFront += MOVING_TRAIN_SPEED * dt;
          o.mesh.position.z = o.zFront;
          // 動物走路：腿前後擺動、身體上下起伏
          if (o.legs.length) {
            for (const l of o.legs) l.pivot.rotation.x = Math.sin(time * 5 + l.phase) * 0.45;
            o.mesh.position.y = Math.abs(Math.sin(time * 5)) * 0.06;
          }
          if (!o.horned && playerZ - o.zFront < 70) {
            o.horned = true;
            this.sfx?.vehicleCall(o.vehicle);
          }
        }
      }
    }

    // 懸浮巴士上下浮動
    for (const o of this.obstacles) {
      if (o.vehicle === 'hoverbus' || o.vehicle === 'subs' || o.vehicle === 'airships') o.mesh.position.y = Math.sin(time * 2 + o.zFront * 0.1) * 0.08;
    }

    // 回收已經在玩家身後的物件
    this.obstacles = this.obstacles.filter((o) => {
      const behind = o.zFront - o.length > playerZ + 14;
      if (behind) this.scene.remove(o.mesh);
      return !behind;
    });

    for (const p of this.powerups) {
      const icon = p.mesh.userData.icon;
      if (p.taken) {
        p.t += dt;
        p.mesh.scale.setScalar(1 + p.t * 5);
        p.mesh.visible = p.t < 0.18;
      } else {
        icon.rotation.y += dt * 2.4;
        p.mesh.position.y = p.y + Math.sin(time * 2.5 + p.z) * 0.15;
      }
    }
    this.powerups = this.powerups.filter((p) => {
      const done = (p.taken && p.t > 0.2) || p.z > playerZ + 12;
      if (done) this.scene.remove(p.mesh);
      return !done;
    });

    for (const sp of this.springs) {
      if (sp.t > 0) {
        sp.t = Math.max(0, sp.t - dt);
        sp.mesh.scale.y = 1 - Math.sin((1 - sp.t / 0.3) * Math.PI) * 0.35;
      }
    }
    this.springs = this.springs.filter((sp) => {
      const done = sp.z > playerZ + 12;
      if (done) this.scene.remove(sp.mesh);
      return !done;
    });
    this.zips = this.zips.filter((zp) => {
      const done = zp.z1 > playerZ + 14;
      if (done) this.scene.remove(zp.mesh);
      return !done;
    });

    for (const it of this.items) {
      if (it.taken) {
        it.t += dt;
        it.mesh.scale.setScalar(it.base * (1 + it.t * 6));
        it.mesh.visible = it.t < 0.2;
        it.mesh.position.y += dt * 6;
      } else {
        it.mesh.position.y = it.y + Math.sin(time * 3 + it.z * 0.3) * 0.12;
      }
    }
    this.items = this.items.filter((it) => {
      const done = (it.taken && it.t > 0.22) || it.z > playerZ + 12;
      if (done) this.scene.remove(it.mesh);
      return !done;
    });

    this.padTex.offset.y = (this.padTex.offset.y - dt * 1.6) % 1;
    this.pads = this.pads.filter((p) => {
      const done = p.z > playerZ + 12;
      if (done) this.scene.remove(p.mesh);
      return !done;
    });

    for (const d of this.debris) {
      d.t += dt;
      d.v.y -= 30 * dt;
      d.mesh.position.x += d.v.x * dt;
      d.mesh.position.y += d.v.y * dt;
      d.mesh.position.z += d.v.z * dt;
      d.mesh.rotation.x += d.spin.x * dt;
      d.mesh.rotation.y += d.spin.y * dt;
      d.mesh.rotation.z += d.spin.z * dt;
    }
    this.debris = this.debris.filter((d) => {
      const done = d.t > 1.6;
      if (done) this.scene.remove(d.mesh);
      return !done;
    });

    for (const c of this.coins) {
      if (c.magnet && !c.taken) {
        c.mesh.rotation.y += dt * 12;
      } else if (c.taken) {
        c.t += dt;
        const k = c.t / 0.28;
        c.mesh.position.y += dt * 9;
        c.mesh.scale.setScalar(Math.max(0.01, (c.base || 1) * (1 - k)));
        c.mesh.rotation.y += dt * 30;
      } else {
        c.mesh.rotation.y += dt * 3.2;
        if (c.fall > 0) c.fall = Math.max(0, c.fall - dt * 16);
        c.mesh.position.y = c.y + c.fall + Math.sin(time * 3 + c.z * 0.4) * 0.06;
      }
    }
    this.coins = this.coins.filter((c) => {
      const done = (c.taken && c.t > 0.28) || c.z > playerZ + 12;
      if (done) this.releaseCoin(c);
      return !done;
    });
  }

  heightAt(o, z) {
    if (o.kind === 'ramp') {
      const t = (o.zFront - z) / RAMP_LEN;
      return TRAIN_TOP * Math.min(1, Math.max(0, t));
    }
    return o.top;
  }
}

export { COIN_Y };

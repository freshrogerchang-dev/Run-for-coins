// 關卡生成：障礙物（火車、跳台、柵欄）與金幣的配置、移動與回收
import {
  LANES,
  GROUND,
  TRAIN_W,
  TRAIN_TOP,
  RAMP_LEN,
  MOVING_TRAIN_SPEED,
  MOVING_TRAIN_TRIGGER,
} from './config.js';
import * as THREE from 'three';
import { POWERUPS } from './progress.js';

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

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
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
    this.cursor = 0;
    this.difficulty = 0;
  }

  reset(playerZ = 0) {
    for (const o of this.obstacles) this.scene.remove(o.mesh);
    for (const c of this.coins) this.releaseCoin(c);
    for (const p of this.powerups) this.scene.remove(p.mesh);
    for (const d of this.debris) this.scene.remove(d.mesh);
    for (const p of this.pads) this.scene.remove(p.mesh);
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

  addCoin(x, y, z, fall = 0) {
    const mesh = this.getCoin();
    mesh.position.set(x, y + fall, z);
    mesh.rotation.y = z * 0.35;
    this.coins.push({ mesh, x, y, z, taken: false, t: 0, fall });
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
    let r = Math.random() * list.reduce((s, [, p]) => s + p.weight, 0);
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
      if (i % 14 === 13) lane = Math.max(0, Math.min(2, lane + (Math.random() < 0.5 ? -1 : 1)));
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
      if (this.chunkIndex > 1 && Math.random() < 0.26) {
        this.addPowerup(this.randomPowerKind(), randInt(0, 2), this.cursor - len - gap / 2);
      } else if (this.chunkIndex > 1 && Math.random() < 0.22) {
        // 加速帶，後面接一排金幣
        const lane = randInt(0, 2);
        const z = this.cursor - len - 2;
        this.addPad(lane, z);
        this.addCoinLine(lane, z - 4, Math.max(2, Math.floor((gap - 8) / 2.2)));
      }
      this.cursor -= len + gap;
      this.chunkIndex++;
    }
  }

  makeChunk(z0, speed) {
    const d = this.difficulty;
    const table = [
      ['coins', 2.2 - d],
      ['barriers', 2.4],
      ['trainPair', 1.2 + d],
      ['rampTrain', 1.6 + d * 0.6],
      ['moving', this.chunkIndex < 3 ? 0 : 0.5 + d * 1.6],
      ['mixed', 0.8 + d * 1.2],
    ];
    const total = table.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
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
    if (Math.random() < 0.4) {
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
      const r = Math.random();
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
    if (this.difficulty > 0.2 && Math.random() < 0.5 && len > 20) {
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
      const r = Math.random();
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
    if (Math.random() < 0.6) {
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
        c.mesh.scale.setScalar(Math.max(0.01, 1 - k));
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

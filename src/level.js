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
  constructor(scene, models, sfx) {
    this.scene = scene;
    this.models = models;
    this.sfx = sfx;
    this.obstacles = [];
    this.coins = [];
    this.coinPool = [];
    this.cursor = 0;
    this.difficulty = 0;
  }

  reset(playerZ = 0) {
    for (const o of this.obstacles) this.scene.remove(o.mesh);
    for (const c of this.coins) this.releaseCoin(c);
    this.obstacles = [];
    this.coins = [];
    this.cursor = playerZ - 40;
    this.chunkIndex = 0;
    // 開場擺飾：玩家身後兩側停著列車
    this.addTrain(0, playerZ + 30, 2, { decorative: true });
    this.addTrain(2, playerZ + 18, 1, { decorative: true });
    this.addCoinLine(1, playerZ - 12, 8);
  }

  // ---------- 物件建立 ----------
  addTrain(lane, zFront, cars, { moving = false, decorative = false } = {}) {
    const { group, length } = this.models.train(cars, { lit: moving });
    group.position.set(LANES[lane], 0, zFront);
    this.scene.add(group);
    const o = {
      kind: 'train',
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

  addCoin(x, y, z) {
    const mesh = this.getCoin();
    mesh.position.set(x, y, z);
    mesh.rotation.y = z * 0.35;
    this.coins.push({ mesh, x, y, z, taken: false, t: 0 });
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

  // ---------- 關卡片段 ----------
  generate(playerZ, speed) {
    while (this.cursor > playerZ - 280) {
      const len = this.makeChunk(this.cursor, speed);
      const gap = Math.max(11, (rand(10, 18) * speed) / 16);
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
          if (!o.horned && playerZ - o.zFront < 70) {
            o.horned = true;
            this.sfx?.horn();
          }
        }
      }
    }

    // 回收已經在玩家身後的物件
    this.obstacles = this.obstacles.filter((o) => {
      const behind = o.zFront - o.length > playerZ + 14;
      if (behind) this.scene.remove(o.mesh);
      return !behind;
    });

    for (const c of this.coins) {
      if (c.taken) {
        c.t += dt;
        const k = c.t / 0.28;
        c.mesh.position.y += dt * 9;
        c.mesh.scale.setScalar(Math.max(0.01, 1 - k));
        c.mesh.rotation.y += dt * 30;
      } else {
        c.mesh.rotation.y += dt * 3.2;
        c.mesh.position.y = c.y + Math.sin(time * 3 + c.z * 0.4) * 0.06;
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

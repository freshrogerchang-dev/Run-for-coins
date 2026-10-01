// 影子對手：記錄最佳的一場，下次跑的時候以半透明身影一起跑
import * as THREE from 'three';
import { Player } from './player.js';
import { store } from './progress.js';
import { GROUND } from './config.js';

const STEP = 0.1; // 每 0.1 秒記一筆
const MAX_FRAMES = 9000;

export class Ghost {
  constructor(scene, outfit) {
    this.player = new Player();
    this.player.applyOutfit(outfit);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.35, 1.6, 2.4),
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    this.player.root.traverse((o) => {
      if (o.isMesh) {
        o.material = mat;
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });
    this.player.root.visible = false;
    scene.add(this.player.root);
    this.data = null;
    this.rec = [];
  }

  // ---------- 錄製 ----------
  startRecording() {
    this.rec = [];
    this.recT = 0;
  }

  record(dt, S) {
    this.recT += dt;
    while (this.recT >= STEP && this.rec.length < MAX_FRAMES) {
      this.recT -= STEP;
      this.rec.push([Math.round(S.distance * 10), Math.round(S.x * 100), Math.round(S.y * 100), S.slideT > 0 ? 1 : 0]);
    }
  }

  // 比之前的紀錄遠就存起來
  save(key, dist) {
    const old = store.get(key, null);
    if (old && old.dist >= dist) return false;
    store.set(key, { dist: Math.floor(dist), f: this.rec });
    return true;
  }

  // ---------- 播放 ----------
  load(key) {
    const d = store.get(key, null);
    this.data = d && d.f?.length > 5 ? d : null;
    this.passed = false;
    return this.data;
  }

  // 依時間取得影子的位置（線性內插）
  sample(t) {
    const f = this.data.f;
    const i = t / STEP;
    const a = f[Math.min(f.length - 1, Math.floor(i))];
    const b = f[Math.min(f.length - 1, Math.floor(i) + 1)];
    const k = i - Math.floor(i);
    return {
      d: (a[0] + (b[0] - a[0]) * k) / 10,
      x: (a[1] + (b[1] - a[1]) * k) / 100,
      y: (a[2] + (b[2] - a[2]) * k) / 100,
      slide: a[3] === 1,
      ended: i >= f.length - 1,
      vy: (b[2] - a[2]) / 100 / STEP,
    };
  }

  update(dt, S, active) {
    const root = this.player.root;
    if (!active || !this.data) {
      root.visible = false;
      return null;
    }
    const g = this.sample(S.runTime);
    const z = -g.d;
    root.visible = !g.ended && Math.abs(z - S.z) < 90;
    root.position.set(g.x, g.y, z);
    root.scale.setScalar(this.player.baseScale);
    this.player.animate(dt, {
      speed: S.speed,
      grounded: g.y <= GROUND + 0.05 || Math.abs(g.vy) < 0.5,
      vy: g.vy,
      sliding: g.slide,
      crashed: false,
      idle: false,
      flying: g.y > 7,
      lean: 0,
    });
    return { lead: g.d - S.distance, ended: g.ended, best: this.data.dist };
  }
}

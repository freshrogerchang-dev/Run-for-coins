// 魔王追逐戰：巨型金幣機器人在前方飄著跑，會丟柵欄；撿能量球打它
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { LANES } from './config.js';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.6, ...extra });

export class Boss {
  constructor(scene) {
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    const metal = std('#5b6573');
    const dark = std('#262a31', { metalness: 0.4, roughness: 0.6 });
    const gold = std('#ffc21a', { metalness: 0.9, roughness: 0.25 });
    this.eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.5, 0.3) });
    this.flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, 0.4), transparent: true, opacity: 0.85, depthWrite: false });
    this.hitMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3) });
    this.mats = [metal, dark, gold];
    const add = (geo, mat, x, y, z, parent = this.body) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    // 身體、胸口金幣、頭、眼睛、天線
    add(new RoundedBoxGeometry(3.2, 3.0, 2.2, 3, 0.4), metal, 0, 4.6, 0);
    add(new THREE.CylinderGeometry(0.9, 0.9, 0.2, 24).rotateX(Math.PI / 2), gold, 0, 4.8, 1.12);
    add(new RoundedBoxGeometry(2.2, 1.6, 1.8, 3, 0.35), metal, 0, 7.0, 0);
    for (const x of [-0.5, 0.5]) add(new THREE.SphereGeometry(0.26, 16, 12), this.eyeMat, x, 7.1, 0.88);
    add(new THREE.BoxGeometry(1.4, 0.16, 0.1), dark, 0, 6.55, 0.9);
    add(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8), dark, 0.6, 8.3, 0);
    add(new THREE.SphereGeometry(0.2, 12, 8), this.eyeMat, 0.6, 8.9, 0);
    // 手臂
    this.arms = [];
    for (const s of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(s * 1.9, 5.6, 0);
      this.body.add(shoulder);
      add(new RoundedBoxGeometry(0.8, 2.4, 0.8, 2, 0.2), dark, 0, -1.1, 0, shoulder);
      add(new THREE.SphereGeometry(0.6, 14, 10), gold, 0, -2.5, 0, shoulder);
      this.arms.push(shoulder);
    }
    // 底部噴射火焰
    this.flames = [];
    for (const x of [-0.8, 0.8]) {
      add(new THREE.CylinderGeometry(0.45, 0.6, 0.6, 12), dark, x, 2.9, 0);
      const f = add(new THREE.ConeGeometry(0.42, 1.6, 12).rotateX(Math.PI), this.flameMat, x, 1.9, 0);
      f.castShadow = false;
      this.flames.push(f);
    }
    this.meshes = [];
    this.body.traverse((o) => o.isMesh && this.meshes.push({ m: o, mat: o.material }));
    this.group.visible = false;
    scene.add(this.group);
    this.active = false;
  }

  start(maxHp = 4) {
    this.active = true;
    this.leaving = false;
    this.hp = maxHp;
    this.maxHp = maxHp;
    this.lane = 1;
    this.x = 0;
    this.y = 0;
    this.t = 0;
    this.time = 40;
    this.throwT = 3;
    this.orbT = 1.5;
    this.windup = 0;
    this.hitT = 0;
    this.enterK = 0;
    this.group.visible = true;
  }

  hit() {
    this.hp--;
    this.hitT = 0.25;
  }

  // 回傳這一幀要做的事：throw（丟柵欄）、orb（放能量球）
  update(dt, playerZ, time) {
    const out = {};
    if (!this.active) return out;
    this.t += dt;
    this.time -= dt;
    this.enterK = Math.min(1, this.enterK + dt * 0.8);
    if (this.leaving) {
      this.y += dt * 12;
      if (this.y > 40) {
        this.active = false;
        this.group.visible = false;
      }
    }
    // 換車道
    if (Math.floor(this.t / 2.3) !== Math.floor((this.t - dt) / 2.3)) {
      this.lane = Math.max(0, Math.min(2, this.lane + (Math.random() < 0.5 ? -1 : 1)));
    }
    this.x += (LANES[this.lane] - this.x) * (1 - Math.exp(-dt * 3));
    const dist = 26 + (1 - this.enterK) * 40;
    this.group.position.set(this.x, this.y + Math.sin(time * 2.2) * 0.4, playerZ - dist);
    this.group.rotation.y = Math.sin(time * 1.3) * 0.12;
    for (const f of this.flames) f.scale.set(1, 0.8 + Math.random() * 0.5, 1);
    // 丟柵欄前會舉手預告
    if (!this.leaving) {
      this.throwT -= dt;
      if (this.throwT < 0.7 && this.windup === 0) this.windup = 0.7;
      if (this.throwT <= 0) {
        this.throwT = 2.8 + Math.random() * 1.2;
        this.windup = 0;
        out.throw = { lane: this.lane, z: playerZ - dist };
      }
      this.orbT -= dt;
      if (this.orbT <= 0) {
        this.orbT = 2.2 + Math.random() * 0.8;
        out.orb = true;
      }
    }
    const raise = this.windup > 0 ? 1 : 0;
    for (const a of this.arms) a.rotation.x += ((raise ? -2.6 : Math.sin(time * 4) * 0.3) - a.rotation.x) * (1 - Math.exp(-dt * 10));
    // 被打中時整隻閃白
    this.hitT = Math.max(0, this.hitT - dt);
    const flashOn = this.hitT > 0 && Math.floor(this.hitT * 30) % 2 === 0;
    for (const { m, mat } of this.meshes) m.material = flashOn ? this.hitMat : mat;
    return out;
  }

  leave() {
    this.leaving = true;
  }
}

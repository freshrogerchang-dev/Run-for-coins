// 跑者角色：用基本幾何組成的卡通人物 + 程序化跑步動畫
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const lerp = (a, b, t) => a + (b - a) * t;

function part(geo, mat, parent, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function pivot(parent, x, y, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

export class Player {
  constructor() {
    this.root = new THREE.Group();
    this.phase = 0;
    this.pose = { jump: 0, slide: 0, crash: 0, idle: 1 };
    this.build();
  }

  build() {
    const mat = {
      skin: new THREE.MeshStandardMaterial({ color: '#f2c29b', roughness: 0.6 }),
      hoodie: new THREE.MeshStandardMaterial({ color: '#ff5a1f', roughness: 0.7 }),
      hoodieDark: new THREE.MeshStandardMaterial({ color: '#d9430f', roughness: 0.75 }),
      pants: new THREE.MeshStandardMaterial({ color: '#2d4f8c', roughness: 0.8 }),
      cap: new THREE.MeshStandardMaterial({ color: '#1768d9', roughness: 0.5 }),
      shoe: new THREE.MeshStandardMaterial({ color: '#f7f7f5', roughness: 0.45 }),
      sole: new THREE.MeshStandardMaterial({ color: '#e5293b', roughness: 0.6 }),
      hair: new THREE.MeshStandardMaterial({ color: '#2b1b12', roughness: 0.8 }),
      eye: new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.2 }),
      pack: new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.55 }),
      strap: new THREE.MeshStandardMaterial({ color: '#333', roughness: 0.7 }),
      phones: new THREE.MeshStandardMaterial({ color: '#20c997', roughness: 0.35, metalness: 0.3 }),
    };
    this.mats = mat;

    // body：整體姿勢（滑鏟、跌倒）；hips：跑步上下起伏
    this.body = pivot(this.root, 0, 0);
    this.hips = pivot(this.body, 0, 0.95);
    part(new RoundedBoxGeometry(0.44, 0.22, 0.26, 2, 0.08), mat.pants, this.hips, { y: 0.02 });

    // 上半身
    this.torso = pivot(this.hips, 0, 0.08);
    part(new THREE.CapsuleGeometry(0.22, 0.28, 6, 14), mat.hoodie, this.torso, { y: 0.28 });
    part(new THREE.TorusGeometry(0.13, 0.045, 8, 16), mat.hoodieDark, this.torso, { y: 0.56, rx: Math.PI / 2 });
    // 帽 T 口袋
    part(new RoundedBoxGeometry(0.28, 0.12, 0.05, 2, 0.02), mat.hoodieDark, this.torso, { y: 0.16, z: -0.2 });
    // 背包
    part(new RoundedBoxGeometry(0.34, 0.4, 0.18, 3, 0.07), mat.pack, this.torso, { y: 0.32, z: 0.24 });
    part(new RoundedBoxGeometry(0.28, 0.12, 0.08, 2, 0.03), mat.hoodieDark, this.torso, { y: 0.2, z: 0.34 });
    for (const sx of [-0.12, 0.12]) {
      part(new THREE.BoxGeometry(0.04, 0.42, 0.03), mat.strap, this.torso, { x: sx, y: 0.34, z: -0.2 });
    }

    // 頭
    this.head = pivot(this.torso, 0, 0.62);
    part(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 10), mat.skin, this.head, { y: 0.02 });
    part(new THREE.SphereGeometry(0.19, 24, 18), mat.skin, this.head, { y: 0.2 });
    part(new THREE.SphereGeometry(0.195, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat.hair, this.head, {
      y: 0.21,
      rx: 0.35,
    });
    // 帽子（帽簷朝前 -z）
    part(new THREE.SphereGeometry(0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat.cap, this.head, { y: 0.24 });
    part(new THREE.CylinderGeometry(0.16, 0.17, 0.025, 20, 1, false, -Math.PI / 2, Math.PI), mat.cap, this.head, {
      y: 0.25,
      z: -0.13,
      rx: -0.12,
    });
    for (const ex of [-0.07, 0.07]) {
      part(new THREE.SphereGeometry(0.025, 10, 8), mat.eye, this.head, { x: ex, y: 0.2, z: -0.175 });
    }
    part(new THREE.SphereGeometry(0.03, 10, 8), mat.skin, this.head, { y: 0.15, z: -0.19 });
    // 耳機
    part(new THREE.TorusGeometry(0.2, 0.02, 6, 20, Math.PI), mat.phones, this.head, { y: 0.22, rz: 0 });
    for (const ex of [-0.19, 0.19]) {
      part(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 14), mat.phones, this.head, { x: ex, y: 0.2, rz: Math.PI / 2 });
    }

    // 手臂
    this.arms = [];
    for (const side of [-1, 1]) {
      const shoulder = pivot(this.torso, side * 0.27, 0.48);
      part(new THREE.CapsuleGeometry(0.075, 0.2, 4, 10), mat.hoodie, shoulder, { y: -0.15 });
      const elbow = pivot(shoulder, 0, -0.3);
      part(new THREE.CapsuleGeometry(0.065, 0.18, 4, 10), mat.hoodie, elbow, { y: -0.12 });
      part(new THREE.SphereGeometry(0.07, 12, 10), mat.skin, elbow, { y: -0.3 });
      this.arms.push({ shoulder, elbow, side });
    }

    // 腿
    this.legs = [];
    for (const side of [-1, 1]) {
      const hip = pivot(this.hips, side * 0.12, 0);
      part(new THREE.CapsuleGeometry(0.095, 0.26, 4, 10), mat.pants, hip, { y: -0.2 });
      const knee = pivot(hip, 0, -0.43);
      part(new THREE.CapsuleGeometry(0.08, 0.26, 4, 10), mat.pants, knee, { y: -0.2 });
      const ankle = pivot(knee, 0, -0.42);
      part(new RoundedBoxGeometry(0.16, 0.12, 0.32, 2, 0.05), mat.shoe, ankle, { y: -0.03, z: -0.05 });
      part(new RoundedBoxGeometry(0.17, 0.04, 0.33, 2, 0.015), mat.sole, ankle, { y: -0.085, z: -0.05 });
      this.legs.push({ hip, knee, ankle, side });
    }
  }

  // state: { speed, grounded, vy, sliding, crashed, lean, idle }
  animate(dt, s) {
    const k = 1 - Math.exp(-dt * 14);
    const p = this.pose;
    p.jump = lerp(p.jump, !s.grounded && !s.sliding ? 1 : 0, k);
    p.slide = lerp(p.slide, s.sliding ? 1 : 0, 1 - Math.exp(-dt * 20));
    p.crash = lerp(p.crash, s.crashed ? 1 : 0, 1 - Math.exp(-dt * 8));
    p.idle = lerp(p.idle, s.idle ? 1 : 0, 1 - Math.exp(-dt * 6));

    if (!s.crashed) this.phase += dt * (s.idle ? 2.2 : 4.5 + s.speed * 0.22);
    const ph = this.phase;
    const run = (1 - p.jump) * (1 - p.slide) * (1 - p.idle) * (1 - p.crash);

    // 跑步
    const swing = Math.sin(ph);
    this.hips.position.y = 0.95 + run * Math.abs(Math.cos(ph)) * 0.07 + p.idle * Math.sin(ph) * 0.01;
    this.torso.rotation.x = -0.22 * run - 0.1 * p.jump + 0.05 * p.idle;
    this.torso.rotation.y = swing * 0.15 * run;
    this.head.rotation.x = 0.18 * run + 0.1 * p.jump;

    for (const leg of this.legs) {
      const s2 = leg.side < 0 ? swing : -swing;
      const c2 = leg.side < 0 ? Math.cos(ph) : -Math.cos(ph);
      const runHip = s2 * 0.85;
      const runKnee = -(0.25 + Math.max(0, c2) * 1.3);
      const jumpHip = leg.side < 0 ? 1.1 : 0.2;
      const jumpKnee = leg.side < 0 ? -1.5 : -0.9;
      const slideHip = 1.35;
      const slideKnee = leg.side < 0 ? -0.2 : -0.9;
      const crashHip = 0.6;
      const crashKnee = -0.4;
      leg.hip.rotation.x = runHip * run + jumpHip * p.jump + slideHip * p.slide + crashHip * p.crash;
      leg.knee.rotation.x = runKnee * run + jumpKnee * p.jump + slideKnee * p.slide + crashKnee * p.crash - 0.05 * p.idle;
      leg.ankle.rotation.x = -0.3 * run * Math.max(0, -s2) + 0.3 * p.slide;
      leg.hip.rotation.z = -leg.side * 0.04 * p.idle;
    }
    for (const arm of this.arms) {
      const s2 = arm.side < 0 ? -swing : swing;
      arm.shoulder.rotation.x = s2 * 0.9 * run - 2.6 * p.jump * (arm.side < 0 ? 1 : 0.8) + -0.9 * p.slide - 1.8 * p.crash;
      arm.shoulder.rotation.z = arm.side * (0.12 + 0.35 * p.jump + 0.9 * p.slide + 0.6 * p.crash + 0.05 * p.idle);
      arm.elbow.rotation.x = 1.3 * run + 0.4 * p.jump + 0.2 * p.slide + 0.15 * p.idle;
    }

    // 整體姿勢
    this.body.rotation.x = 1.15 * p.slide + 1.45 * p.crash;
    this.body.position.y = 0.12 * p.slide + 0.18 * p.crash;
    this.body.position.z = 0.25 * p.slide + 0.7 * p.crash;
    this.body.rotation.z = s.lean ?? 0;
    // 空翻：跳躍上升時稍微前傾
    this.hips.rotation.x = -0.25 * p.jump * Math.max(0, Math.min(1, s.vy / 10));
  }
}

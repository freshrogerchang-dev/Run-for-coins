// 追趕者：站務員和他的狗。開局會追一小段，玩家撞到東西踉蹌時會追上來
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GROUND } from './config.js';

const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

function part(geo, mat, parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function pivot(parent, x, y, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

export class Chaser {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.gap = 26; // 在玩家後方幾公尺
    this.target = 26;
    this.close = 0; // 靠近的剩餘時間
    this.phase = 0;
    this.x = 0;
    this.buildGuard();
    this.buildDog();
  }

  buildGuard() {
    const m = {
      uniform: new THREE.MeshStandardMaterial({ color: '#27385f', roughness: 0.7 }),
      shirt: new THREE.MeshStandardMaterial({ color: '#dfe6ee', roughness: 0.7 }),
      skin: new THREE.MeshStandardMaterial({ color: '#e8b48f', roughness: 0.6 }),
      gold: new THREE.MeshStandardMaterial({ color: '#e0b020', roughness: 0.3, metalness: 0.9 }),
      dark: new THREE.MeshStandardMaterial({ color: '#15171c', roughness: 0.5 }),
      vest: new THREE.MeshStandardMaterial({ color: '#c8ff2e', roughness: 0.6, emissive: '#4a6a00', emissiveIntensity: 0.3 }),
      mustache: new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: 0.8 }),
    };
    const g = (this.guard = new THREE.Group());
    this.group.add(g);
    this.gHips = pivot(g, 0, 1.0);
    part(new RoundedBoxGeometry(0.5, 0.26, 0.32, 2, 0.08), m.uniform, this.gHips, 0, 0.02, 0);
    this.gTorso = pivot(this.gHips, 0, 0.1);
    part(new THREE.CapsuleGeometry(0.27, 0.3, 6, 14), m.vest, this.gTorso, 0, 0.3, 0);
    part(new THREE.BoxGeometry(0.2, 0.36, 0.05), m.shirt, this.gTorso, 0, 0.36, -0.25);
    part(new THREE.BoxGeometry(0.06, 0.08, 0.02), m.gold, this.gTorso, 0.14, 0.45, -0.27);
    const head = pivot(this.gTorso, 0, 0.7);
    part(new THREE.SphereGeometry(0.2, 20, 16), m.skin, head, 0, 0.18, 0);
    part(new THREE.CylinderGeometry(0.22, 0.21, 0.14, 20), m.uniform, head, 0, 0.36, 0);
    part(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 20), m.uniform, head, 0, 0.44, 0);
    part(new THREE.CylinderGeometry(0.16, 0.17, 0.025, 16, 1, false, -Math.PI / 2, Math.PI), m.dark, head, 0, 0.3, -0.15, -0.2);
    part(new THREE.BoxGeometry(0.07, 0.06, 0.02), m.gold, head, 0, 0.38, -0.22);
    part(new THREE.BoxGeometry(0.16, 0.04, 0.04), m.mustache, head, 0, 0.12, -0.19);
    for (const ex of [-0.07, 0.07]) part(new THREE.SphereGeometry(0.025, 8, 6), m.dark, head, ex, 0.2, -0.18);
    // 哨子
    part(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8), m.gold, head, 0.05, 0.09, -0.22, Math.PI / 2);
    this.gArms = [];
    for (const side of [-1, 1]) {
      const sh = pivot(this.gTorso, side * 0.32, 0.52);
      part(new THREE.CapsuleGeometry(0.08, 0.26, 4, 10), m.uniform, sh, 0, -0.18, 0);
      part(new THREE.SphereGeometry(0.075, 10, 8), m.skin, sh, 0, -0.42, 0);
      this.gArms.push({ sh, side });
    }
    this.gLegs = [];
    for (const side of [-1, 1]) {
      const hip = pivot(this.gHips, side * 0.14, 0);
      part(new THREE.CapsuleGeometry(0.1, 0.5, 4, 10), m.uniform, hip, 0, -0.38, 0);
      part(new RoundedBoxGeometry(0.17, 0.12, 0.32, 2, 0.05), m.dark, hip, 0, -0.9, -0.05);
      this.gLegs.push({ hip, side });
    }
  }

  buildDog() {
    const fur = new THREE.MeshStandardMaterial({ color: '#b5773a', roughness: 0.85 });
    const light = new THREE.MeshStandardMaterial({ color: '#f1dcc0', roughness: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.4 });
    const collar = new THREE.MeshStandardMaterial({ color: '#e53935', roughness: 0.5 });
    const d = (this.dog = new THREE.Group());
    this.group.add(d);
    this.dBody = pivot(d, 0, 0.5);
    part(new THREE.CapsuleGeometry(0.17, 0.5, 6, 12), fur, this.dBody, 0, 0, 0, Math.PI / 2);
    part(new THREE.SphereGeometry(0.15, 12, 10), light, this.dBody, 0, -0.06, -0.2);
    const head = (this.dHead = pivot(this.dBody, 0, 0.2, -0.4));
    part(new THREE.SphereGeometry(0.16, 14, 12), fur, head, 0, 0, 0);
    part(new THREE.CapsuleGeometry(0.07, 0.12, 4, 8), light, head, 0, -0.04, -0.16, Math.PI / 2);
    part(new THREE.SphereGeometry(0.035, 8, 6), dark, head, 0, -0.01, -0.28);
    for (const s of [-1, 1]) {
      part(new THREE.SphereGeometry(0.022, 6, 5), dark, head, s * 0.06, 0.05, -0.13);
      part(new THREE.ConeGeometry(0.06, 0.14, 6), fur, head, s * 0.09, 0.14, 0.02, 0, 0, s * 0.3);
    }
    part(new THREE.TorusGeometry(0.12, 0.025, 6, 14), collar, this.dBody, 0, 0.08, -0.3, Math.PI / 2 - 0.4);
    this.dTail = pivot(this.dBody, 0, 0.06, 0.32);
    part(new THREE.CapsuleGeometry(0.035, 0.22, 4, 6), fur, this.dTail, 0, 0.12, 0.04, -0.6);
    this.dLegs = [];
    for (const [x, z] of [[-0.1, -0.2], [0.1, -0.2], [-0.1, 0.22], [0.1, 0.22]]) {
      const hip = pivot(this.dBody, x, -0.08, z);
      part(new THREE.CapsuleGeometry(0.045, 0.28, 4, 6), fur, hip, 0, -0.2, 0);
      this.dLegs.push(hip);
    }
  }

  reset() {
    this.gap = 3;
    this.target = 3;
    this.close = 2.2; // 開局追一下
    this.caught = false;
    this.alerted = false;
    this.x = 0;
  }

  // 玩家踉蹌：追上來
  alert() {
    this.close = 3.2;
    this.alerted = true;
  }

  catchPlayer() {
    this.caught = true;
  }

  // 追得近時回傳 true
  get isClose() {
    return this.close > 0;
  }

  update(dt, S, running) {
    const was = this.close > 0;
    this.close = Math.max(0, this.close - dt);
    this.target = this.caught ? 0.9 : this.close > 0 ? 2.6 : 26;
    this.gap = damp(this.gap, this.target, this.caught ? 6 : this.close > 0 ? 3 : 0.8, dt);
    this.x = damp(this.x, S.x, 5, dt);
    const z = S.z + this.gap;
    const visible = this.gap < 18 && S.mode !== 'menu';
    this.group.visible = visible;
    const escaped = was && this.close === 0 && !this.caught && this.alerted;
    if (escaped) this.alerted = false;
    if (!visible) return escaped;

    this.guard.position.set(this.x - 0.2, GROUND, z);
    this.dog.position.set(this.x + 0.75, GROUND, z - 0.9);
    const speed = running ? S.speed : 0;
    this.phase += dt * (running ? 4 + speed * 0.2 : 0);
    const sw = Math.sin(this.phase);
    // 站務員跑步、揮手吹哨
    this.gHips.position.y = 1.0 + Math.abs(Math.cos(this.phase)) * 0.06;
    this.gTorso.rotation.x = -0.25;
    for (const l of this.gLegs) l.hip.rotation.x = (l.side < 0 ? sw : -sw) * 0.8;
    const [left, right] = this.gArms;
    left.sh.rotation.x = -sw * 0.8;
    right.sh.rotation.x = this.caught ? 2.6 : -2.5 + Math.sin(this.phase * 2) * 0.35;
    right.sh.rotation.z = 0.2;
    // 狗狗奔跑
    const dp = this.phase * 1.3;
    this.dBody.position.y = 0.5 + Math.abs(Math.sin(dp)) * 0.08;
    this.dBody.rotation.x = Math.sin(dp) * 0.12;
    this.dLegs.forEach((l, i) => (l.rotation.x = Math.sin(dp + (i < 2 ? 0 : Math.PI)) * 0.9));
    this.dTail.rotation.z = Math.sin(this.phase * 5) * 0.5;
    this.dHead.rotation.x = Math.sin(dp) * 0.1;
    // 回傳「剛剛甩掉」
    return escaped;
  }
}


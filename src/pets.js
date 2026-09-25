// 寵物：跟在玩家身旁飛的小夥伴，各有一個小能力
import * as THREE from 'three';
import { store } from './progress.js';

export const PETS = [
  { id: 'puppy', name: '小狗旺財', perk: '每局開始送 12 秒防護罩', price: 600 },
  { id: 'kitten', name: '小貓咪咪', perk: '磁鐵、雙倍金幣多 3 秒', price: 900 },
  { id: 'dragon', name: '小龍噴噴', perk: '每局開始先衝刺 3 秒', price: 1500 },
  { id: 'owl', name: '貓頭鷹博士', perk: '每收集 50 枚金幣再多送 5 枚', price: 2200 },
];

export const ownedPets = () => store.get('pets', []);
export const activePet = () => {
  const id = store.get('pet', null);
  return ownedPets().includes(id) ? id : null;
};

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });

function part(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  parent.add(m);
  return m;
}

const sph = (r) => new THREE.SphereGeometry(r, 14, 12);
const eyes = (g, y, z, spread = 0.07) => {
  const black = std('#111', { roughness: 0.2 });
  for (const x of [-spread, spread]) part(g, sph(0.035), black, x, y, z);
};

function puppy() {
  const g = new THREE.Group();
  const fur = std('#c8874a');
  const light = std('#f5dfc0');
  part(g, sph(0.2), fur, 0, 0, 0.05);
  part(g, sph(0.17), fur, 0, 0.2, -0.12);
  part(g, sph(0.08), light, 0, 0.16, -0.27);
  part(g, sph(0.03), std('#111'), 0, 0.18, -0.34);
  for (const s of [-1, 1]) part(g, new THREE.CapsuleGeometry(0.05, 0.12, 4, 8), std('#8a5a2a'), s * 0.15, 0.24, -0.1, 0, 0, s * 0.6);
  eyes(g, 0.26, -0.26);
  part(g, new THREE.CapsuleGeometry(0.03, 0.12, 4, 6), fur, 0, 0.1, 0.25, -0.8);
  part(g, new THREE.TorusGeometry(0.1, 0.02, 6, 12), std('#e53935'), 0, 0.08, -0.08, Math.PI / 2);
  return g;
}

function kitten() {
  const g = new THREE.Group();
  const fur = std('#9aa3ad');
  const pink = std('#f2a0a8');
  part(g, sph(0.18), fur, 0, 0, 0.05);
  part(g, sph(0.16), fur, 0, 0.2, -0.1);
  for (const s of [-1, 1]) {
    part(g, new THREE.ConeGeometry(0.06, 0.12, 4), fur, s * 0.1, 0.36, -0.1, 0, 0, -s * 0.2);
    part(g, new THREE.ConeGeometry(0.03, 0.07, 4), pink, s * 0.1, 0.35, -0.13, 0, 0, -s * 0.2);
  }
  eyes(g, 0.23, -0.24, 0.06);
  part(g, sph(0.025), pink, 0, 0.18, -0.26);
  part(g, new THREE.CapsuleGeometry(0.025, 0.3, 4, 6), fur, 0, 0.12, 0.28, -0.4);
  return g;
}

function dragon() {
  const g = new THREE.Group();
  const scale = std('#3fbf6a');
  const belly = std('#f2e27a');
  const wing = new THREE.MeshStandardMaterial({ color: '#2f8f4a', roughness: 0.6, side: THREE.DoubleSide });
  part(g, sph(0.18), scale, 0, 0, 0.05);
  part(g, sph(0.12), belly, 0, -0.02, -0.08);
  part(g, sph(0.15), scale, 0, 0.2, -0.14);
  part(g, new THREE.CapsuleGeometry(0.06, 0.08, 4, 8), scale, 0, 0.16, -0.28, Math.PI / 2);
  for (const s of [-1, 1]) {
    part(g, new THREE.ConeGeometry(0.03, 0.12, 6), belly, s * 0.07, 0.35, -0.1);
    const w = part(g, new THREE.CircleGeometry(0.22, 3), wing, s * 0.22, 0.12, 0.05, 0, s * 0.3, s * 0.4);
    w.userData.wing = s;
  }
  eyes(g, 0.24, -0.26, 0.06);
  part(g, new THREE.ConeGeometry(0.06, 0.3, 6), scale, 0, 0.02, 0.32, -Math.PI / 2 - 0.3);
  return g;
}

function owl() {
  const g = new THREE.Group();
  const fur = std('#8a5a36');
  const light = std('#e8d2a8');
  part(g, sph(0.2), fur, 0, 0.05, 0).scale.set(1, 1.2, 0.9);
  part(g, sph(0.14), light, 0, 0.02, -0.1);
  for (const s of [-1, 1]) {
    part(g, sph(0.075), std('#ffffff'), s * 0.08, 0.2, -0.14);
    part(g, sph(0.04), std('#111'), s * 0.08, 0.2, -0.2);
    part(g, new THREE.ConeGeometry(0.04, 0.1, 4), fur, s * 0.1, 0.33, -0.05, 0, 0, -s * 0.3);
  }
  part(g, new THREE.ConeGeometry(0.03, 0.07, 4), std('#f2a33a'), 0, 0.13, -0.2, Math.PI / 2 + 0.3);
  // 博士帽
  part(g, new THREE.BoxGeometry(0.26, 0.02, 0.26), std('#1a1a1a'), 0, 0.32, 0);
  part(g, new THREE.CylinderGeometry(0.08, 0.08, 0.06, 10), std('#1a1a1a'), 0, 0.29, 0);
  return g;
}

const BUILD = { puppy, kitten, dragon, owl };

export class PetFollower {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.models = {};
    this.id = null;
    this.pos = new THREE.Vector3();
  }

  set(id) {
    this.id = id;
    for (const m of Object.values(this.models)) m.visible = false;
    if (!id) return;
    this.models[id] ??= BUILD[id]();
    const m = this.models[id];
    if (!m.parent) this.group.add(m);
    m.visible = true;
  }

  update(dt, S, menu) {
    this.group.visible = !!this.id;
    if (!this.id) return;
    const t = performance.now() / 1000;
    const target = menu
      ? new THREE.Vector3(S.x + 0.95, 1.5 + Math.sin(t * 2) * 0.08, S.z - 0.2)
      : new THREE.Vector3(S.x + 0.95, S.y + 1.7 + Math.sin(t * 3) * 0.12, S.z + 0.5);
    if (this.pos.lengthSq() === 0 || this.pos.distanceTo(target) > 20) this.pos.copy(target);
    this.pos.lerp(target, 1 - Math.exp(-dt * 8));
    this.group.position.copy(this.pos);
    this.group.rotation.y = menu ? Math.PI + Math.sin(t) * 0.3 : Math.sin(t * 1.5) * 0.2;
    const m = this.models[this.id];
    m.traverse((o) => {
      if (o.userData.wing) o.rotation.z = o.userData.wing * (0.4 + Math.sin(t * 12) * 0.4);
    });
  }
}

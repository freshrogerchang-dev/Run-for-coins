// 各場景專屬的「列車」替代品：交通工具與動物。
// 每個單元長 12m、寬 ≤ 2.3m、頂部約 3.5m（可以跑上去），碰撞與列車完全相同。
// 原點在最前端（z = 0），往 -z 延伸；地面（路面）高度 0.2。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { merged } from './geo.js';
import { CAR_LEN, CAR_GAP } from './config.js';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
const flat = (color, extra = {}) => std(color, { flatShading: true, ...extra });
const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
const rbox = (w, h, d, r = 0.12, s = 3) => new RoundedBoxGeometry(w, h, d, s, r);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, seg = 16) => new THREE.CylinderGeometry(rt, rb, h, seg);
const sph = (r, ws = 18, hs = 14) => new THREE.SphereGeometry(r, ws, hs);
const WHEEL = Math.PI / 2;

// 依材質收集零件，最後合併成少量 Mesh
class Parts {
  constructor() {
    this.map = new Map();
    this.legs = [];
    this.lamps = [];
  }
  add(mat, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    if (!this.map.has(mat)) this.map.set(mat, []);
    this.map.get(mat).push([geo, x, y, z, rx, ry, rz, sx, sy, sz]);
  }
  // 可以動的腿：pivot 在髖部，腿往下長 len
  leg(mat, geo, x, y, z, len, front) {
    // 對角的兩條腿同步（走路步態）
    const phase = (x > 0 ? Math.PI : 0) + (front ? 0 : Math.PI);
    this.legs.push({ mat, geo, x, y, z, len, phase });
  }
  lamp(x, y, z) {
    this.lamps.push([x, y, z]);
  }
  build() {
    const meshes = [];
    for (const [mat, list] of this.map) {
      const m = new THREE.Mesh(merged(list), mat);
      m.castShadow = !(mat.isMeshBasicMaterial || mat.transparent);
      m.receiveShadow = true;
      meshes.push(m);
    }
    return { meshes, legs: this.legs, lamps: this.lamps };
  }
}

// ---------------- 雙層觀光巴士（海岸線） ----------------
function bus(v) {
  const main = ['#ff7a59', '#2ec4b6', '#ffb703'][v];
  const P = new Parts();
  const body = std(main, { roughness: 0.4, metalness: 0.2 });
  const white = std('#f7f4ea', { roughness: 0.45 });
  const glass = std('#1d2a38', { roughness: 0.08, metalness: 0.5 });
  const dark = std('#1a1c20', { roughness: 0.8 });
  const accent = std('#073b4c', { roughness: 0.5 });
  const L = 11.6;
  P.add(body, rbox(2.3, 1.95, L, 0.2), 0, 1.42, -L / 2);
  P.add(white, rbox(2.3, 1.18, L, 0.2), 0, 2.91, -L / 2);
  P.add(std('#dadcdf', { roughness: 0.6 }), box(2.1, 0.05, L - 0.5), 0, 3.52, -L / 2);
  P.add(glass, box(2.34, 0.72, L - 1.2), 0, 1.78, -L / 2 - 0.2);
  P.add(glass, box(2.34, 0.62, L - 0.8), 0, 2.95, -L / 2);
  for (let z = -1.2; z > -L + 0.5; z -= 1.35) {
    P.add(body, box(2.36, 0.74, 0.1), 0, 1.78, z);
    P.add(white, box(2.36, 0.64, 0.1), 0, 2.95, z);
  }
  P.add(accent, box(2.35, 0.14, L - 0.2), 0, 2.32, -L / 2);
  P.add(glass, box(1.9, 0.95, 0.05), 0, 1.72, 0.0);
  P.add(glass, box(1.9, 0.6, 0.05), 0, 2.95, 0.0);
  P.add(glow(4, 2.2, 0.4), box(1.3, 0.22, 0.04), 0, 3.28, 0.01);
  P.add(dark, box(2.0, 0.3, 0.1), 0, 0.62, 0.0);
  for (const x of [-0.72, 0.72]) {
    P.add(glow(4, 3.8, 3.2), cyl(0.12, 0.12, 0.05, 14), x, 0.9, 0.02, WHEEL);
    P.lamp(x, 0.9, 0.2);
  }
  for (const z of [-2.0, -9.4]) {
    for (const x of [-1.02, 1.02]) {
      P.add(dark, cyl(0.46, 0.46, 0.3, 20), x, 0.66, z, 0, 0, WHEEL);
      P.add(white, cyl(0.2, 0.2, 0.32, 12), x, 0.66, z, 0, 0, WHEEL);
    }
  }
  return P;
}

// ---------------- 鏟雪車（雪山） ----------------
function plow(v) {
  const main = ['#f4731f', '#f2c230', '#d62828'][v];
  const P = new Parts();
  const body = std(main, { roughness: 0.45, metalness: 0.2 });
  const glass = std('#1d2a38', { roughness: 0.08, metalness: 0.5 });
  const dark = std('#1a1c20', { roughness: 0.8 });
  const steel = std('#9aa3ad', { roughness: 0.35, metalness: 0.8 });
  const snow = std('#f7fbff', { roughness: 0.8 });
  const stripe = std('#1b1b1b', { roughness: 0.6 });
  P.add(dark, box(2.0, 0.35, 11.4), 0, 0.62, -6);
  P.add(body, rbox(2.3, 2.3, 3.0, 0.15), 0, 1.78, -1.95);
  P.add(glass, box(2.34, 0.7, 2.3), 0, 2.35, -2.0);
  P.add(glass, box(2.0, 0.72, 0.05), 0, 2.35, -0.44);
  P.add(body, rbox(2.3, 2.88, 8.3, 0.12), 0, 2.06, -7.7);
  P.add(snow, box(2.2, 0.1, 8.1), 0, 3.52, -7.7);
  P.add(snow, box(2.0, 0.08, 2.6), 0, 2.97, -1.95);
  for (let z = -4.2; z > -11.6; z -= 1.2) P.add(stripe, box(2.34, 0.28, 0.5), 0, 1.0, z);
  // 鏟雪刀
  P.add(std('#ffd23f', { roughness: 0.4, metalness: 0.4 }), box(2.3, 1.0, 0.14), 0, 0.85, -0.12, -0.35);
  P.add(steel, box(2.3, 0.12, 0.2), 0, 0.33, 0.02);
  P.add(steel, box(0.12, 0.12, 0.6), -0.6, 0.8, -0.4);
  P.add(steel, box(0.12, 0.12, 0.6), 0.6, 0.8, -0.4);
  for (const x of [-0.7, 0.7]) {
    P.add(glow(4, 2.2, 0.3), box(0.26, 0.14, 0.1), x, 3.0, -1.2);
    P.add(glow(4, 3.8, 3.2), cyl(0.11, 0.11, 0.05, 14), x, 1.35, -0.44, WHEEL);
    P.lamp(x, 1.35, -0.2);
  }
  for (const z of [-1.9, -8.3, -10.3]) {
    for (const x of [-1.0, 1.0]) P.add(dark, cyl(0.56, 0.56, 0.34, 20), x, 0.76, z, 0, 0, WHEEL);
  }
  return P;
}

// ---------------- 懸浮巴士（霓虹夜城） ----------------
function hoverbus(v) {
  const acc = [
    [4, 0.5, 2.6],
    [0.5, 3.6, 4],
    [4, 3, 0.5],
  ][v];
  const P = new Parts();
  const body = std('#23233a', { roughness: 0.4, metalness: 0.3 });
  const neon = glow(...acc.map((c) => c * 0.55));
  const lit = glow(0.45, 0.32, 0.7);
  const L = 11.6;
  P.add(body, rbox(2.3, 2.5, L, 0.5, 4), 0, 2.25, -L / 2);
  P.add(lit, box(2.34, 0.62, L - 1.6), 0, 2.55, -L / 2 - 0.2);
  P.add(neon, box(2.36, 0.07, L - 0.8), 0, 1.62, -L / 2);
  P.add(neon, box(2.2, 0.06, L - 1.2), 0, 3.46, -L / 2);
  P.add(glow(0.3, 1.5, 2.2), box(1.9, 0.05, L - 1.4), 0, 0.97, -L / 2);
  for (const z of [-1.8, -9.8]) P.add(glow(0.3, 1.5, 2.2), cyl(0.5, 0.35, 0.12, 20), 0, 0.88, z);
  P.add(std('#0e1422', { roughness: 0.05, metalness: 0.6 }), box(1.6, 0.8, 0.05), 0, 2.55, 0.0);
  P.add(glow(2.5, 2.5, 2.5), box(1.5, 0.08, 0.05), 0, 1.5, 0.01);
  P.lamp(-0.6, 1.5, 0.2);
  P.lamp(0.6, 1.5, 0.2);
  return P;
}

// ---------------- 駱駝商隊（沙漠） ----------------
function camels(v) {
  const P = new Parts();
  const fur = std('#c89b6d', { roughness: 0.9 });
  const dark = std('#2a1c12', { roughness: 0.6 });
  const rugs = [std('#c0392b'), std('#2c5d9f'), std('#1f8a5b')];
  const gold = std('#d4a017', { roughness: 0.3, metalness: 0.8 });
  const crate = std('#8a5a36', { roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const zc = -2.3 - i * 3.9;
    const rug = rugs[(i + v) % 3];
    P.add(fur, sph(1), 0, 2.05, zc, 0, 0, 0, 0.72, 0.68, 1.55);
    P.add(fur, sph(0.6), 0, 2.6, zc - 0.1, 0, 0, 0, 0.85, 0.9, 1.1);
    P.add(rug, box(0.42, 0.8, 1.3), -0.8, 1.95, zc);
    P.add(rug, box(0.42, 0.8, 1.3), 0.8, 1.95, zc);
    P.add(rug, box(1.6, 0.12, 1.8), 0, 3.05, zc);
    P.add(gold, box(1.62, 0.04, 1.82), 0, 3.0, zc);
    P.add(crate, box(1.0, 0.36, 0.9), 0, 3.29, zc);
    P.add(fur, new THREE.CapsuleGeometry(0.2, 0.8, 4, 10), 0, 2.55, zc + 1.45, 0.75);
    P.add(fur, rbox(0.34, 0.34, 0.7, 0.12), 0, 3.0, zc + 1.9, 0.2);
    for (const x of [-0.11, 0.11]) P.add(dark, sph(0.04, 8, 6), x, 3.08, zc + 2.05);
    for (const x of [-0.13, 0.13]) P.add(fur, sph(0.06, 8, 6), x, 3.22, zc + 1.72);
    P.add(gold, sph(0.08, 10, 8), 0, 2.32, zc + 1.35);
    P.add(fur, new THREE.CapsuleGeometry(0.05, 0.4, 4, 6), 0, 1.9, zc - 1.55, -0.3);
    const legGeo = new THREE.CapsuleGeometry(0.11, 1.5, 4, 8).translate(0, -0.85, 0);
    for (const [x, dz] of [[-0.35, 0.9], [0.35, 0.9], [-0.35, -0.9], [0.35, -0.9]]) P.leg(fur, legGeo, x, 1.85, zc + dz, 1.7, dz > 0);
  }
  return P;
}

// ---------------- 祭典花車（櫻花古都） ----------------
function floats(v) {
  const P = new Parts();
  const lacquer = std(['#c1272d', '#8a1f2d', '#b5462b'][v], { roughness: 0.35 });
  const wood = std('#5a3a22', { roughness: 0.8 });
  const gold = std('#d4a017', { roughness: 0.3, metalness: 0.8 });
  const tile = flat('#2f3540', { roughness: 0.6 });
  const lanternW = glow(3.6, 3.2, 2.4);
  const lanternR = glow(4, 0.8, 0.5);
  for (let i = 0; i < 2; i++) {
    const zc = -2.9 - i * 6;
    P.add(wood, box(2.2, 0.32, 5.2), 0, 0.95, zc);
    for (const dz of [-1.8, 1.8]) {
      for (const x of [-1.02, 1.02]) {
        P.add(wood, cyl(0.62, 0.62, 0.18, 18), x, 0.82, zc + dz, 0, 0, WHEEL);
        P.add(gold, cyl(0.16, 0.16, 0.2, 10), x, 0.82, zc + dz, 0, 0, WHEEL);
      }
    }
    P.add(lacquer, box(1.8, 1.4, 4.4), 0, 1.81, zc);
    P.add(gold, box(1.84, 0.08, 4.44), 0, 2.52, zc);
    P.add(gold, box(1.84, 0.08, 4.44), 0, 1.12, zc);
    for (const [x, dz] of [[-0.95, 2.1], [0.95, 2.1], [-0.95, -2.1], [0.95, -2.1]]) P.add(lacquer, box(0.14, 0.62, 0.14), x, 2.84, zc + dz);
    P.add(tile, new THREE.ConeGeometry(1.65, 0.62, 4), 0, 3.46, zc, 0, Math.PI / 4, 0, 1, 1, 2.45);
    P.add(tile, box(2.3, 0.1, 5.4), 0, 3.14, zc);
    P.add(gold, sph(0.14, 12, 10), 0, 3.8, zc);
    for (const [x, dz, m] of [[-1.05, 2.35, lanternW], [1.05, 2.35, lanternR], [-1.05, -2.35, lanternR], [1.05, -2.35, lanternW]]) {
      P.add(m, sph(0.17, 12, 10), x, 2.8, zc + dz, 0, 0, 0, 1, 1.3, 1);
    }
    P.add(std('#f5e6c8', { roughness: 0.7 }), cyl(0.38, 0.38, 0.3, 20), 0, 1.9, zc + 2.23, WHEEL);
  }
  return P;
}

// ---------------- 大象（熱帶雨林） ----------------
function elephants(v) {
  const P = new Parts();
  const skin = std('#8e8f96', { roughness: 0.95 });
  const ivory = std('#f3ead6', { roughness: 0.4 });
  const dark = std('#1a1a1a', { roughness: 0.4 });
  const blanket = std(['#c0392b', '#7b3fe4', '#1f8a5b'][v], { roughness: 0.7 });
  const gold = std('#d4a017', { roughness: 0.3, metalness: 0.8 });
  for (let i = 0; i < 2; i++) {
    const zc = -3.2 - i * 6;
    P.add(skin, sph(1, 24, 18), 0, 2.28, zc, 0, 0, 0, 1.08, 1.05, 2.1);
    P.add(blanket, box(1.7, 0.1, 2.2), 0, 3.38, zc);
    P.add(gold, box(1.74, 0.3, 0.06), 0, 3.2, zc + 1.1);
    P.add(gold, box(1.74, 0.3, 0.06), 0, 3.2, zc - 1.1);
    P.add(skin, sph(0.85, 22, 16), 0, 2.72, zc + 2.05);
    for (const s of [-1, 1]) {
      P.add(skin, sph(1, 14, 10), s * 0.82, 2.75, zc + 1.8, 0, 0, 0, 0.1, 0.72, 0.6);
      P.add(dark, sph(0.06, 8, 6), s * 0.38, 2.95, zc + 2.72);
      P.add(ivory, new THREE.ConeGeometry(0.09, 0.8, 10), s * 0.32, 2.05, zc + 2.72, 1.9);
    }
    P.add(skin, cyl(0.13, 0.24, 1.6, 12), 0, 1.85, zc + 2.78, 0.22);
    P.add(skin, sph(0.14, 10, 8), 0, 1.05, zc + 2.95);
    P.add(skin, new THREE.CapsuleGeometry(0.05, 0.6, 4, 6), 0, 2.2, zc - 2.15, -0.4);
    const legGeo = cyl(0.3, 0.34, 1.35, 14).translate(0, -0.66, 0);
    for (const [x, dz] of [[-0.6, 1.2], [0.6, 1.2], [-0.6, -1.25], [0.6, -1.25]]) P.leg(skin, legGeo, x, 1.55, zc + dz, 1.35, dz > 0);
  }
  return P;
}

// ---------------- 熔岩巨龜（火山） ----------------
function crackTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#ff7a1a';
  ctx.shadowColor = '#ffb347';
  ctx.shadowBlur = 8;
  ctx.lineWidth = 5;
  // 六角形殼紋
  const r = 36;
  for (let row = -1; row < 6; row++) {
    for (let col = -1; col < 5; col++) {
      const cx = col * r * 1.75 + (row % 2) * r * 0.87;
      const cy = row * r * 1.5;
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}

let crackTex;
function tortoises(v) {
  crackTex ??= crackTexture();
  const P = new Parts();
  const shell = new THREE.MeshStandardMaterial({
    color: ['#2a2322', '#332522', '#24201f'][v],
    roughness: 0.8,
    emissive: '#ffffff',
    emissiveMap: crackTex,
    emissiveIntensity: 1.6,
    flatShading: true,
  });
  const skin = std('#4b4a3a', { roughness: 0.9 });
  const eye = glow(4, 1.6, 0.3);
  for (let i = 0; i < 2; i++) {
    const zc = -3.4 - i * 6;
    P.add(shell, new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.72, zc, 0, 0, 0, 1.1, 2.78, 2.65);
    P.add(skin, sph(1, 16, 10), 0, 0.82, zc, 0, 0, 0, 1.05, 0.35, 2.45);
    P.add(skin, new THREE.CapsuleGeometry(0.26, 0.6, 4, 10), 0, 1.05, zc + 2.55, 1.2);
    P.add(skin, sph(0.45, 16, 12), 0, 1.25, zc + 2.95, 0, 0, 0, 1, 0.85, 1.1);
    for (const x of [-0.2, 0.2]) P.add(eye, sph(0.07, 8, 6), x, 1.38, zc + 3.3);
    const legGeo = cyl(0.26, 0.32, 0.75, 10).translate(0, -0.35, 0);
    for (const [x, dz] of [[-0.95, 1.6], [0.95, 1.6], [-0.95, -1.6], [0.95, -1.6]]) P.leg(skin, legGeo, x, 0.95, zc + dz, 0.75, dz > 0);
  }
  return P;
}

// ---------------- 月球車（太空基地） ----------------
function rovers(v) {
  const P = new Parts();
  const white = std('#b9bfc8', { roughness: 0.5, metalness: 0.2 });
  const orange = std(['#ff6a2a', '#2fa8ff', '#ffd23f'][v], { roughness: 0.5 });
  const dark = std('#2a2d33', { roughness: 0.8 });
  const glass = std('#1a2440', { roughness: 0.05, metalness: 0.6 });
  const solar = std('#1d3a8a', { roughness: 0.2, metalness: 0.7 });
  for (let i = 0; i < 2; i++) {
    const zc = -2.9 - i * 6;
    P.add(white, rbox(2.1, 0.5, 5.2, 0.12), 0, 1.25, zc);
    P.add(orange, box(2.14, 0.12, 5.1), 0, 1.1, zc);
    for (const dz of [-1.9, 0, 1.9]) {
      for (const x of [-0.97, 0.97]) {
        P.add(dark, cyl(0.5, 0.5, 0.34, 18), x, 0.7, zc + dz, 0, 0, WHEEL);
        P.add(white, cyl(0.22, 0.22, 0.36, 10), x, 0.7, zc + dz, 0, 0, WHEEL);
      }
    }
    P.add(white, rbox(1.8, 1.05, 1.5, 0.3), 0, 2.02, zc + 1.7);
    P.add(glass, box(1.5, 0.55, 0.05), 0, 2.1, zc + 2.46);
    P.add(white, cyl(0.76, 0.76, 3.3, 20), 0, 2.72, zc - 0.85, WHEEL);
    P.add(orange, cyl(0.78, 0.78, 0.25, 20), 0, 2.72, zc - 0.85, WHEEL);
    P.add(solar, box(2.25, 0.06, 1.6), 0, 3.52, zc - 0.85);
    P.add(white, cyl(0.03, 0.03, 1.2, 6), 0.7, 3.1, zc - 2.3);
    P.add(glow(4, 0.5, 0.3), sph(0.07, 8, 6), 0.7, 3.72, zc - 2.3);
    for (const x of [-0.6, 0.6]) {
      P.add(glow(4, 3.8, 3.2), cyl(0.1, 0.1, 0.05, 12), x, 1.3, zc + 2.62, WHEEL);
      if (i === 0) P.lamp(x, 1.3, zc + 2.8);
    }
  }
  return P;
}

const BUILDERS = { bus, plow, hoverbus, camels, floats, elephants, tortoises, rovers };
export const VEHICLE_NAMES = {
  train: '列車',
  bus: '觀光巴士',
  plow: '鏟雪車',
  hoverbus: '懸浮巴士',
  camels: '駱駝商隊',
  floats: '祭典花車',
  elephants: '大象',
  tortoises: '熔岩巨龜',
  rovers: '月球車',
};
export const ANIMALS = ['camels', 'elephants', 'tortoises'];

export class VehicleModels {
  constructor(glowMat) {
    this.glowMat = glowMat;
    this.cache = new Map();
  }

  unit(kind, v) {
    const key = `${kind}-${v}`;
    if (!this.cache.has(key)) this.cache.set(key, BUILDERS[kind](v).build());
    return this.cache.get(key);
  }

  // 與 Models.train 相同的介面：回傳 { group, length, legs }
  make(kind, cars, { lit = false } = {}) {
    const group = new THREE.Group();
    const legs = [];
    const v = (Math.random() * 3) | 0;
    for (let i = 0; i < cars; i++) {
      const u = this.unit(kind, v);
      const car = new THREE.Group();
      car.position.z = -i * (CAR_LEN + CAR_GAP);
      for (const m of u.meshes) {
        const mesh = new THREE.Mesh(m.geometry, m.material);
        mesh.castShadow = m.castShadow;
        mesh.receiveShadow = true;
        car.add(mesh);
      }
      for (const l of u.legs) {
        const pivot = new THREE.Group();
        pivot.position.set(l.x, l.y, l.z);
        const mesh = new THREE.Mesh(l.geo, l.mat);
        mesh.castShadow = true;
        pivot.add(mesh);
        car.add(pivot);
        legs.push({ pivot, phase: l.phase + i * 1.3 + l.z * 0.4 });
      }
      if (lit && i === 0) {
        for (const [x, y, z] of u.lamps) {
          const s = new THREE.Sprite(this.glowMat);
          s.scale.setScalar(2.2);
          s.position.set(x, y, z);
          car.add(s);
        }
      }
      group.add(car);
    }
    const length = cars * CAR_LEN + (cars - 1) * CAR_GAP;
    return { group, length, legs };
  }
}


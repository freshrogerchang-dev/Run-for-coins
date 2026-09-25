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


// ---------------- 黃色潛水艇（海底） ----------------
function subs(v) {
  const P = new Parts();
  const hull = std(['#ffd23f', '#ff8a3d', '#e84a5f'][v], { roughness: 0.35, metalness: 0.3 });
  const dark = std('#2a2d33', { roughness: 0.6 });
  const steel = std('#9aa3ad', { roughness: 0.3, metalness: 0.8 });
  const port = glow(1.2, 3, 3.6);
  const L = 11.2;
  P.add(hull, new THREE.CapsuleGeometry(1.1, L - 2.2, 8, 20), 0, 2.2, -L / 2 - 0.2, WHEEL);
  P.add(hull, rbox(1.4, 1.0, 3.2, 0.3), 0, 3.0, -4.2);
  P.add(steel, box(1.2, 0.06, 3.0), 0, 3.52, -4.2);
  P.add(steel, cyl(0.07, 0.07, 1.0, 8), 0.3, 3.9, -3.2);
  P.add(steel, box(0.12, 0.12, 0.4), 0.3, 4.35, -3.05);
  for (let z = -1.8; z > -L + 1; z -= 1.6) {
    for (const x of [-1.08, 1.08]) {
      P.add(port, cyl(0.22, 0.22, 0.06, 16), x, 2.3, z, 0, 0, WHEEL);
      P.add(steel, new THREE.TorusGeometry(0.24, 0.04, 6, 16), x, 2.3, z, 0, WHEEL, 0);
    }
  }
  P.add(steel, cyl(0.5, 0.2, 0.6, 14), 0, 2.2, -L - 0.2, WHEEL);
  for (let k = 0; k < 3; k++) P.add(dark, box(0.12, 1.1, 0.25), 0, 2.2, -L - 0.55, 0, 0, (k * Math.PI) / 3);
  P.add(hull, box(0.12, 1.2, 1.0), 0, 3.0, -L + 0.5);
  P.add(hull, box(2.0, 0.1, 0.9), 0, 2.2, -L + 0.5);
  P.add(glow(4, 3.8, 3.2), cyl(0.2, 0.2, 0.05, 14), 0, 2.2, 0.0, WHEEL);
  P.lamp(0, 2.2, 0.3);
  return P;
}

// ---------------- 冰淇淋車（糖果王國） ----------------
function icecream(v) {
  const P = new Parts();
  const body = std(['#ffd1e8', '#bdf0ff', '#fff3b0'][v], { roughness: 0.4 });
  const pink = std('#ff6fa8', { roughness: 0.45 });
  const white = std('#ffffff', { roughness: 0.5 });
  const glass = std('#1d2a38', { roughness: 0.08, metalness: 0.5 });
  const dark = std('#2a2d33', { roughness: 0.8 });
  const cone = std('#e0a15a', { roughness: 0.8 });
  const scoop = [std('#ff9ad5'), std('#9be7a8'), std('#fff1c1')];
  P.add(body, rbox(2.3, 2.95, 11.4, 0.25), 0, 2.03, -5.9);
  P.add(glass, box(2.0, 0.9, 0.05), 0, 2.3, 0.0);
  P.add(glass, box(2.34, 0.8, 2.0), 0, 2.3, -1.4);
  P.add(white, box(2.2, 0.05, 11.0), 0, 3.52, -5.9);
  // 條紋遮陽棚與販賣窗
  for (let i = 0; i < 8; i++) P.add(i % 2 ? white : pink, box(0.5, 0.08, 0.6), -1.4, 3.0, -3.5 - i * 0.6, 0, 0, 0.35);
  P.add(glass, box(0.05, 1.0, 4.4), -1.16, 2.2, -5.6);
  P.add(pink, box(2.34, 0.3, 11.4), 0, 0.95, -5.9);
  // 車頂的大冰淇淋
  P.add(cone, new THREE.ConeGeometry(0.45, 1.2, 14), 0.6, 4.0, -9.8, Math.PI);
  P.add(scoop[v], sph(0.5), 0.6, 4.75, -9.8);
  P.add(std('#e53935'), sph(0.12, 10, 8), 0.6, 5.28, -9.8);
  for (const x of [-0.75, 0.75]) {
    P.add(glow(4, 3.8, 3.2), cyl(0.12, 0.12, 0.05, 14), x, 0.9, 0.02, WHEEL);
    P.lamp(x, 0.9, 0.2);
  }
  for (const z of [-2.2, -9.2]) for (const x of [-1.02, 1.02]) P.add(dark, cyl(0.46, 0.46, 0.3, 20), x, 0.66, z, 0, 0, WHEEL);
  return P;
}

// ---------------- 三角龍（恐龍谷） ----------------
function dinos(v) {
  const P = new Parts();
  const skin = std(['#6a8f3a', '#8a7a3a', '#4f7a6a'][v], { roughness: 0.9 });
  const belly = std('#d9c89a', { roughness: 0.9 });
  const frill = std('#c8553d', { roughness: 0.7 });
  const horn = std('#f3ead6', { roughness: 0.4 });
  const dark = std('#1a1a1a', { roughness: 0.4 });
  for (let i = 0; i < 2; i++) {
    const zc = -3.4 - i * 6;
    P.add(skin, sph(1, 22, 16), 0, 2.2, zc, 0, 0, 0, 1.05, 1.15, 2.2);
    P.add(belly, sph(1, 16, 10), 0, 1.6, zc, 0, 0, 0, 0.8, 0.5, 1.8);
    for (let k = 0; k < 4; k++) P.add(frill, new THREE.ConeGeometry(0.22, 0.4, 5), 0, 3.4 - Math.abs(k - 1.5) * 0.12, zc + 1.0 - k * 0.7);
    P.add(skin, sph(0.7, 18, 14), 0, 2.3, zc + 2.2, 0, 0, 0, 1, 0.9, 1.2);
    P.add(frill, cyl(1.05, 1.05, 0.18, 20, 1, false, 0, Math.PI), 0, 2.7, zc + 1.9, WHEEL, 0, 0, 1, 1, 1);
    for (const x of [-0.35, 0.35]) P.add(horn, new THREE.ConeGeometry(0.1, 0.9, 10), x, 2.8, zc + 2.8, 1.2);
    P.add(horn, new THREE.ConeGeometry(0.08, 0.45, 10), 0, 2.1, zc + 3.0, 1.3);
    for (const x of [-0.3, 0.3]) P.add(dark, sph(0.07, 8, 6), x, 2.45, zc + 2.72);
    P.add(skin, new THREE.ConeGeometry(0.5, 2.2, 12), 0, 1.9, zc - 2.9, -1.35);
    const legGeo = cyl(0.3, 0.34, 1.35, 12).translate(0, -0.66, 0);
    for (const [x, dz] of [[-0.65, 1.3], [0.65, 1.3], [-0.65, -1.3], [0.65, -1.3]]) P.leg(skin, legGeo, x, 1.55, zc + dz, 1.35, dz > 0);
  }
  return P;
}

// ---------------- 南瓜馬車（南瓜鎮） ----------------
function pumpkins(v) {
  const P = new Parts();
  const orange = std(['#ff7a1a', '#ff9a2e', '#e8631a'][v], { roughness: 0.55 });
  const stem = std('#4a6a2a', { roughness: 0.8 });
  const gold = std('#d4a017', { roughness: 0.3, metalness: 0.8 });
  const dark = std('#1a1420', { roughness: 0.6 });
  const face = glow(4, 2.2, 0.4);
  for (let i = 0; i < 2; i++) {
    const zc = -2.9 - i * 6;
    // 南瓜本體：幾顆壓扁的球拼出瓣紋
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      P.add(orange, sph(1, 20, 14), Math.cos(a) * 0.35, 2.3, zc + Math.sin(a) * 0.6, 0, 0, 0, 0.8, 1.15, 1.9);
    }
    P.add(stem, cyl(0.12, 0.18, 0.55, 8), 0, 3.6, zc, 0, 0, 0.2);
    P.add(dark, box(1.5, 0.08, 2.4), 0, 3.47, zc);
    // 發光的鬼臉窗
    for (const x of [-1.13, 1.13]) {
      P.add(face, box(0.05, 0.35, 0.35), x, 2.55, zc + 0.8, 0, 0, 0);
      P.add(face, box(0.05, 0.35, 0.35), x, 2.55, zc - 0.8, 0, 0, 0);
      P.add(face, box(0.05, 0.18, 1.6), x, 1.95, zc);
    }
    P.add(face, box(0.6, 0.3, 0.05), 0, 2.5, zc + 1.95);
    P.add(dark, box(1.9, 0.18, 4.6), 0, 1.0, zc);
    for (const dz of [-1.7, 1.7]) {
      for (const x of [-1.05, 1.05]) {
        P.add(dark, new THREE.TorusGeometry(0.55, 0.07, 8, 20), x, 0.75, zc + dz, 0, WHEEL, 0);
        P.add(gold, cyl(0.1, 0.1, 0.16, 8), x, 0.75, zc + dz, 0, 0, WHEEL);
      }
    }
    P.add(gold, box(0.06, 0.06, 4.8), -1.12, 1.15, zc);
    P.add(gold, box(0.06, 0.06, 4.8), 1.12, 1.15, zc);
  }
  return P;
}

// ---------------- 飛船（天空之城） ----------------
function airships(v) {
  const P = new Parts();
  const env = std(['#e84a5f', '#2ec4b6', '#ffd23f'][v], { roughness: 0.5 });
  const stripe = std('#ffffff', { roughness: 0.5 });
  const wood = std('#8a5a36', { roughness: 0.8 });
  const brass = std('#c9a04a', { roughness: 0.3, metalness: 0.8 });
  const glass = std('#1d2a38', { roughness: 0.08, metalness: 0.5 });
  P.add(env, sph(1, 28, 18), 0, 2.55, -5.9, 0, 0, 0, 1.15, 0.97, 5.8);
  P.add(stripe, sph(1, 28, 18), 0, 2.55, -5.9, 0, 0, 0, 1.17, 0.2, 5.7);
  P.add(stripe, box(1.2, 0.05, 6), 0, 3.5, -5.9);
  for (const [x, y, rz] of [[0, 3.3, 0], [0, 1.8, 0], [0.9, 2.55, WHEEL], [-0.9, 2.55, WHEEL]]) {
    P.add(env, box(0.1, 1.0, 1.4), x, y, -11.2, 0, 0, rz);
  }
  P.add(wood, rbox(1.1, 0.7, 3.2, 0.1), 0, 1.05, -5.4);
  P.add(glass, box(1.14, 0.3, 2.8), 0, 1.12, -5.4);
  for (const z of [-4.2, -6.6]) for (const x of [-0.45, 0.45]) P.add(brass, cyl(0.02, 0.02, 0.9, 5), x, 1.6, z);
  for (const x of [-0.95, 0.95]) {
    P.add(brass, cyl(0.12, 0.12, 0.3, 10), x, 1.1, -7.2, WHEEL);
    P.add(wood, box(0.06, 0.9, 0.12), x, 1.1, -7.38);
  }
  P.add(glow(4, 3.8, 3.2), cyl(0.12, 0.12, 0.05, 12), 0, 1.05, -3.78, WHEEL);
  P.lamp(0, 1.05, -3.5);
  return P;
}

// ---------------- 大熊貓（熊貓竹林） ----------------
function pandas(v) {
  const P = new Parts();
  const white = std('#f4f1ea', { roughness: 0.95 });
  const black = std('#1c1c1f', { roughness: 0.9 });
  const pink = std('#f2a0a8', { roughness: 0.8 });
  const bamboo = std('#6aa84f', { roughness: 0.7 });
  for (let i = 0; i < 2; i++) {
    const zc = -3.3 - i * 6;
    P.add(white, sph(1, 22, 16), 0, 2.25, zc - 0.3, 0, 0, 0, 1.08, 1.08, 1.9);
    P.add(black, sph(1, 22, 16), 0, 2.3, zc + 0.9, 0, 0, 0, 1.1, 1.05, 0.6);
    P.add(white, sph(0.85, 22, 16), 0, 2.55, zc + 2.0);
    for (const s of [-1, 1]) {
      P.add(black, sph(0.28, 12, 10), s * 0.55, 3.25, zc + 1.9);
      P.add(black, sph(0.2, 12, 10), s * 0.3, 2.65, zc + 2.72, 0, 0, s * 0.5, 1, 1.3, 0.6);
      P.add(white, sph(0.06, 8, 6), s * 0.3, 2.7, zc + 2.83);
    }
    P.add(black, sph(0.1, 10, 8), 0, 2.35, zc + 2.85);
    P.add(pink, sph(0.08, 8, 6), 0, 2.2, zc + 2.8);
    P.add(bamboo, cyl(0.06, 0.06, 1.4, 8), 0, 2.2, zc + 2.85, 0, 0, WHEEL);
    P.add(white, box(1.3, 0.1, 1.6), 0, 3.35, zc - 0.4);
    const legGeo = cyl(0.3, 0.34, 1.35, 12).translate(0, -0.66, 0);
    for (const [x, dz] of [[-0.6, 1.0], [0.6, 1.0], [-0.6, -1.5], [0.6, -1.5]]) P.leg(black, legGeo, x, 1.55, zc + dz, 1.35, dz > 0);
  }
  return P;
}

const BUILDERS = { bus, plow, hoverbus, camels, floats, elephants, tortoises, rovers, subs, icecream, dinos, pumpkins, airships, pandas };
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
  subs: '潛水艇',
  icecream: '冰淇淋車',
  dinos: '三角龍',
  pumpkins: '南瓜馬車',
  airships: '飛船',
  pandas: '大熊貓',
};
export const ANIMALS = ['camels', 'elephants', 'tortoises', 'dinos', 'pandas'];

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


// 視覺特效：衝刺光暈與光帶、迎面車輛的車道警示、活動代幣與字母
import * as THREE from 'three';
import { LANES, GROUND } from './config.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// 一條面向鏡頭的帶子：points 由頭到尾，寬度與顏色逐點給
const _t = new THREE.Vector3();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
function writeStrip(pos, col, base, pts, width, color, cam) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    _t.subVectors(b, a);
    if (_t.lengthSq() < 1e-8) _t.set(0, 0, 1);
    _v.subVectors(cam, p);
    _s.crossVectors(_t, _v);
    if (_s.lengthSq() < 1e-8) _s.set(1, 0, 0);
    _s.normalize().multiplyScalar(width(i));
    const j = (base + i * 2) * 3;
    pos[j] = p.x - _s.x;
    pos[j + 1] = p.y - _s.y;
    pos[j + 2] = p.z - _s.z;
    pos[j + 3] = p.x + _s.x;
    pos[j + 4] = p.y + _s.y;
    pos[j + 5] = p.z + _s.z;
    const c = color(i);
    col[j] = col[j + 3] = c.r;
    col[j + 1] = col[j + 4] = c.g;
    col[j + 2] = col[j + 5] = c.b;
  }
}

function stripGeometry(maxPts, strips = 1) {
  const geo = new THREE.BufferGeometry();
  const verts = maxPts * 2 * strips;
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const idx = [];
  for (let s = 0; s < strips; s++) {
    for (let i = 0; i < maxPts - 1; i++) {
      const a = (s * maxPts + i) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  geo.setIndex(idx);
  return geo;
}

const additive = () =>
  new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });

// ---------- 衝刺光暈：身體外圍的光、手腳拖出的光帶、身邊掠過的光線 ----------
export class SpeedAura {
  constructor(scene, player) {
    this.player = player;
    this.k = 0;
    this.color = new THREE.Color(3, 1.7, 0.35);
    this.MAX = 28;
    this.pool = [];

    this.glowMat = new THREE.SpriteMaterial({
      map: glowTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    this.glow = new THREE.Sprite(this.glowMat);
    this.glow.visible = false;
    scene.add(this.glow);

    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const anchors = [
      { obj: player.arms[0].elbow, off: V(0, -0.32, 0), w: 0.09 },
      { obj: player.arms[1].elbow, off: V(0, -0.32, 0), w: 0.09 },
      { obj: player.legs[0].ankle, off: V(0, -0.04, 0.05), w: 0.08 },
      { obj: player.legs[1].ankle, off: V(0, -0.04, 0.05), w: 0.08 },
      { obj: player.head, off: V(0, 0.3, 0.1), w: 0.12 },
      { obj: player.torso, off: V(0, 0.3, 0.2), w: 0.36, dim: 0.3 },
    ];
    const mat = additive();
    this.ribbons = anchors.map((a) => {
      const geo = stripGeometry(this.MAX);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      scene.add(mesh);
      return { ...a, geo, mesh, pts: [] };
    });

    // 掠過身邊的光線
    this.NS = 26;
    this.streakGeo = stripGeometry(2, this.NS);
    this.streaks = new THREE.Mesh(this.streakGeo, additive());
    this.streaks.frustumCulled = false;
    this.streaks.visible = false;
    scene.add(this.streaks);
    this.streakData = Array.from({ length: this.NS }, () => this.spawnStreak({}, true));
    this.sp = [new THREE.Vector3(), new THREE.Vector3()];
    this.tmpC = new THREE.Color();
  }

  spawnStreak(s, anywhere = false) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.75 + Math.random() * 0.8;
    s.x = Math.cos(a) * r;
    s.y = 0.95 + Math.sin(a) * r * 0.9;
    s.z = anywhere ? -3 + Math.random() * 6 : -3 - Math.random() * 0.5;
    s.len = 0.8 + Math.random() * 1.4;
    s.v = 26 + Math.random() * 18;
    s.w = 0.018 + Math.random() * 0.02;
    return s;
  }

  setColor(r, g, b) {
    this.color.setRGB(r, g, b);
  }

  update(dt, active, cam, time) {
    this.k += ((active ? 1 : 0) - this.k) * (1 - Math.exp(-dt * (active ? 10 : 5)));
    const k = this.k;
    const vis = k > 0.02;
    this.glow.visible = this.streaks.visible = vis;
    for (const r of this.ribbons) r.mesh.visible = vis;
    if (!vis) {
      for (const r of this.ribbons) {
        this.pool.push(...r.pts);
        r.pts.length = 0;
      }
      return;
    }
    const root = this.player.root;
    root.updateMatrixWorld(true);
    const scale = root.scale.y;
    const flick = 0.85 + 0.15 * Math.sin(time * 37);

    // 身體光暈
    this.glow.position.set(root.position.x, root.position.y + 0.95 * scale, root.position.z + 0.15);
    this.glow.scale.setScalar((2.5 + Math.sin(time * 18) * 0.15) * scale);
    this.glowMat.color.copy(this.color).multiplyScalar(0.28 * k * flick);

    // 光帶：記錄每個錨點走過的位置，依長度截斷
    const L = 4.2 * k * scale;
    const c = this.tmpC;
    for (const r of this.ribbons) {
      const p = (this.pool.pop() || new THREE.Vector3()).copy(r.off);
      r.obj.localToWorld(p);
      r.pts.unshift(p);
      let len = 0;
      const lens = [0];
      for (let i = 1; i < r.pts.length; i++) {
        len += r.pts[i].distanceTo(r.pts[i - 1]);
        lens.push(len);
        if (len > L || i >= this.MAX - 1) {
          this.pool.push(...r.pts.splice(i + 1));
          break;
        }
      }
      const total = Math.max(1e-3, lens[lens.length - 1]);
      const n = r.pts.length;
      const pos = r.geo.attributes.position.array;
      const col = r.geo.attributes.color.array;
      const dim = r.dim ?? 1;
      writeStrip(
        pos,
        col,
        0,
        r.pts,
        (i) => r.w * scale * (1 - (lens[i] ?? total) / total) * (0.5 + 0.5 * k),
        (i) => c.copy(this.color).multiplyScalar(Math.pow(1 - (lens[i] ?? total) / total, 1.4) * k * dim * flick),
        cam,
      );
      r.geo.setDrawRange(0, Math.max(0, (n - 1) * 6));
      r.geo.attributes.position.needsUpdate = true;
      r.geo.attributes.color.needsUpdate = true;
    }

    // 掠過的光線（相對於玩家）
    const pos = this.streakGeo.attributes.position.array;
    const col = this.streakGeo.attributes.color.array;
    const [a, b] = this.sp;
    this.streakData.forEach((s, i) => {
      s.z += s.v * dt;
      if (s.z > 3.2) this.spawnStreak(s);
      const fade = clamp(Math.sin(((s.z + 3) / 6.2) * Math.PI), 0, 1) * k;
      a.set(root.position.x + s.x * scale, root.position.y + s.y * scale, root.position.z + s.z);
      b.set(a.x, a.y, a.z + s.len * (0.4 + 0.6 * k));
      writeStrip(
        pos,
        col,
        i * 2,
        this.sp,
        () => s.w * scale,
        (j) => c.copy(this.color).multiplyScalar((j === 0 ? 1.1 : 0.05) * fade),
        cam,
      );
    });
    this.streakGeo.attributes.position.needsUpdate = true;
    this.streakGeo.attributes.color.needsUpdate = true;
  }
}

// ---------- 迎面車輛警示：地上閃紅色箭頭 ----------
function chevronTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 64, 128);
  ctx.fillStyle = '#fff';
  // 箭頭朝畫布下方＝朝向玩家
  for (let y = 0; y < 128; y += 64) {
    ctx.beginPath();
    ctx.moveTo(6, y + 12);
    ctx.lineTo(32, y + 40);
    ctx.lineTo(58, y + 12);
    ctx.lineTo(58, y + 28);
    ctx.lineTo(32, y + 56);
    ctx.lineTo(6, y + 28);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1.5);
  return t;
}

export class LaneWarnings {
  constructor(scene) {
    this.tex = chevronTexture();
    this.mat = new THREE.MeshBasicMaterial({
      map: this.tex,
      color: new THREE.Color(3.2, 0.35, 0.25),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const geo = new THREE.PlaneGeometry(1.9, 4.2).rotateX(-Math.PI / 2);
    this.marks = LANES.map((x) => {
      const m = new THREE.Mesh(geo, this.mat.clone());
      m.position.set(x, GROUND + 0.05, 0);
      m.visible = false;
      m.renderOrder = 2;
      scene.add(m);
      return m;
    });
    this.level = [0, 0, 0];
  }

  // 回傳每條車道的危險程度 0..1，以及這次新出現的警示
  update(dt, S, obstacles, time, active) {
    const danger = [0, 0, 0];
    const fresh = [];
    if (active) {
      for (const o of obstacles) {
        if (!o.moving || o.decorative || o.knocked) continue;
        const d = S.z - o.zFront;
        if (d < 5 || d > 125) continue;
        const v = clamp(1 - (d - 5) / 120, 0.15, 1);
        if (v > danger[o.lane]) danger[o.lane] = v;
        if (!o.warned) {
          o.warned = true;
          fresh.push(o);
        }
      }
    }
    this.tex.offset.y = (this.tex.offset.y + dt * 2.2) % 1;
    this.marks.forEach((m, i) => {
      this.level[i] += (danger[i] - this.level[i]) * (1 - Math.exp(-dt * 8));
      const l = this.level[i];
      m.visible = l > 0.02;
      if (!m.visible) return;
      m.position.z = S.z - 13;
      m.material.opacity = (0.3 + 0.7 * l) * (0.55 + 0.45 * Math.sin(time * 14));
    });
    return { danger, fresh };
  }
}

// ---------- 活動代幣、字母：發光圓牌 ----------
const itemMats = new Map();
export function itemMaterial(char, color, ink, font = '"Noto Sans TC", sans-serif') {
  const key = `${char}|${color}|${ink}`;
  if (itemMats.has(key)) return itemMats.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const halo = ctx.createRadialGradient(64, 64, 30, 64, 64, 64);
  halo.addColorStop(0, color);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 128, 128);
  ctx.beginPath();
  ctx.arc(64, 64, 42, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.font = `900 50px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, 64, 67);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.05, depthWrite: false });
  itemMats.set(key, m);
  return m;
}

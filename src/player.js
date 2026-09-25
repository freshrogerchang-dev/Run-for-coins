// 跑者角色：用基本幾何組成的卡通人物 + 程序化跑步動畫 + 服裝與道具外觀
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const lerp = (a, b, t) => a + (b - a) * t;

function part(geo, mat, parent, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.scale.set(sx, sy, sz);
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

const hemi = (r, s = 24) => new THREE.SphereGeometry(r, s, 12, 0, Math.PI * 2, 0, Math.PI / 2);

export class Player {
  constructor() {
    this.root = new THREE.Group();
    this.phase = 0;
    this.pose = { jump: 0, slide: 0, crash: 0, idle: 1 };
    this.baseScale = 1;
    this.fx = { jetpack: false, spring: false, shield: false, magnet: false, board: false };
    this.build();
    this.buildPowerVisuals();
  }

  build() {
    const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.65, ...extra });
    const mat = {
      skin: std('#f2c29b', { roughness: 0.6 }),
      top: std('#ff5a1f', { roughness: 0.7 }),
      trim: std('#d9430f', { roughness: 0.75 }),
      pants: std('#2d4f8c', { roughness: 0.8 }),
      hat: std('#1768d9', { roughness: 0.5 }),
      shoe: std('#f7f7f5', { roughness: 0.45 }),
      sole: std('#e5293b', { roughness: 0.6 }),
      hair: std('#2b1b12', { roughness: 0.8 }),
      eye: std('#111111', { roughness: 0.2 }),
      pack: std('#ffd23f', { roughness: 0.55 }),
      strap: std('#333333', { roughness: 0.7 }),
      phones: std('#20c997', { roughness: 0.35, metalness: 0.3 }),
      scarf: std('#2a9d8f', { roughness: 0.8 }),
      gold: std('#e0b020', { roughness: 0.3, metalness: 0.9 }),
      dark: std('#1a1a1a', { roughness: 0.4 }),
      shades: std('#0d0d12', { roughness: 0.05, metalness: 0.6 }),
      glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 3.2, 3.4) }),
      lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.6, 2.4) }),
      glass: new THREE.MeshStandardMaterial({ color: '#cfefff', transparent: true, opacity: 0.25, roughness: 0.02, metalness: 0.3, depthWrite: false }),
      gem: std('#e0245e', { roughness: 0.1, metalness: 0.3 }),
    };
    this.mats = mat;

    // body：整體姿勢（滑鏟、跌倒）；hips：跑步上下起伏
    this.body = pivot(this.root, 0, 0);
    this.hips = pivot(this.body, 0, 0.95);
    part(new RoundedBoxGeometry(0.44, 0.22, 0.26, 2, 0.08), mat.pants, this.hips, { y: 0.02 });

    // 上半身
    this.torso = pivot(this.hips, 0, 0.08);
    part(new THREE.CapsuleGeometry(0.22, 0.28, 6, 14), mat.top, this.torso, { y: 0.28 });
    part(new THREE.TorusGeometry(0.13, 0.045, 8, 16), mat.trim, this.torso, { y: 0.56, rx: Math.PI / 2 });
    part(new RoundedBoxGeometry(0.28, 0.12, 0.05, 2, 0.02), mat.trim, this.torso, { y: 0.16, z: -0.2 });
    part(new THREE.BoxGeometry(0.46, 0.05, 0.47), mat.trim, this.torso, { y: 0.07 });
    // 背包
    this.pack = new THREE.Group();
    this.torso.add(this.pack);
    part(new RoundedBoxGeometry(0.34, 0.4, 0.18, 3, 0.07), mat.pack, this.pack, { y: 0.32, z: 0.24 });
    part(new RoundedBoxGeometry(0.28, 0.12, 0.08, 2, 0.03), mat.trim, this.pack, { y: 0.2, z: 0.34 });
    for (const sx of [-0.12, 0.12]) {
      part(new THREE.BoxGeometry(0.04, 0.42, 0.03), mat.strap, this.pack, { x: sx, y: 0.34, z: -0.2 });
    }
    // 圍巾
    this.scarf = new THREE.Group();
    this.torso.add(this.scarf);
    part(new THREE.TorusGeometry(0.14, 0.055, 8, 18), mat.scarf, this.scarf, { y: 0.57, rx: Math.PI / 2 });
    part(new RoundedBoxGeometry(0.1, 0.3, 0.04, 2, 0.02), mat.scarf, this.scarf, { x: 0.08, y: 0.42, z: 0.2, rx: 0.4 });

    // 頭
    this.head = pivot(this.torso, 0, 0.62);
    part(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 10), mat.skin, this.head, { y: 0.02 });
    this.face = pivot(this.head, 0, 0);
    part(new THREE.SphereGeometry(0.19, 24, 18), mat.skin, this.face, { y: 0.2 });
    part(hemi(0.195), mat.hair, this.face, { y: 0.21, rx: 0.35 });
    for (const ex of [-0.07, 0.07]) part(new THREE.SphereGeometry(0.025, 10, 8), mat.eye, this.face, { x: ex, y: 0.2, z: -0.175 });
    part(new THREE.SphereGeometry(0.03, 10, 8), mat.skin, this.face, { y: 0.15, z: -0.19 });
    this.hatRoot = pivot(this.head, 0, 0);
    this.buildHats();
    this.buildCharacters();

    // 手臂
    this.arms = [];
    for (const side of [-1, 1]) {
      const shoulder = pivot(this.torso, side * 0.27, 0.48);
      part(new THREE.CapsuleGeometry(0.075, 0.2, 4, 10), mat.top, shoulder, { y: -0.15 });
      const elbow = pivot(shoulder, 0, -0.3);
      part(new THREE.CapsuleGeometry(0.065, 0.18, 4, 10), mat.top, elbow, { y: -0.12 });
      part(new THREE.SphereGeometry(0.07, 12, 10), mat.skin, elbow, { y: -0.3 });
      this.arms.push({ shoulder, elbow, side });
    }

    // 腿
    this.legs = [];
    this.springs = [];
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

  // 各種帽子與配件，依服裝切換顯示
  buildHats() {
    const m = this.mats;
    const h = this.hatRoot;
    const g = () => {
      const grp = new THREE.Group();
      h.add(grp);
      return grp;
    };
    const hats = {};
    const brim = (r = 0.17) => new THREE.CylinderGeometry(r - 0.01, r, 0.025, 20, 1, false, -Math.PI / 2, Math.PI);

    hats.cap = g();
    part(hemi(0.2), m.hat, hats.cap, { y: 0.24 });
    part(brim(), m.hat, hats.cap, { y: 0.25, z: -0.13, rx: -0.12 });

    hats.conductor = g();
    part(new THREE.CylinderGeometry(0.21, 0.2, 0.17, 20), m.hat, hats.conductor, { y: 0.34 });
    part(new THREE.CylinderGeometry(0.23, 0.23, 0.03, 20), m.hat, hats.conductor, { y: 0.43 });
    part(new THREE.TorusGeometry(0.205, 0.018, 6, 24), m.gold, hats.conductor, { y: 0.29, rx: Math.PI / 2 });
    part(brim(0.16), m.dark, hats.conductor, { y: 0.27, z: -0.14, rx: -0.2 });
    part(new THREE.BoxGeometry(0.06, 0.05, 0.02), m.gold, hats.conductor, { y: 0.36, z: -0.21 });

    hats.helmet = g();
    part(hemi(0.235), m.hat, hats.helmet, { y: 0.23 });
    part(new THREE.TorusGeometry(0.235, 0.025, 6, 24), m.hat, hats.helmet, { y: 0.235, rx: Math.PI / 2 });
    part(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 12), m.dark, hats.helmet, { y: 0.33, z: -0.21, rx: Math.PI / 2 });
    part(new THREE.CircleGeometry(0.04, 12), m.lamp, hats.helmet, { y: 0.33, z: -0.245, ry: Math.PI });

    hats.beanie = g();
    part(new THREE.SphereGeometry(0.21, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), m.hat, hats.beanie, { y: 0.2, sy: 1.2 });
    part(new THREE.TorusGeometry(0.2, 0.045, 8, 24), m.hat, hats.beanie, { y: 0.26, rx: Math.PI / 2 });
    part(new THREE.SphereGeometry(0.075, 12, 10), m.top, hats.beanie, { y: 0.47 });

    hats.visor = g();
    part(new THREE.TorusGeometry(0.2, 0.035, 6, 24, Math.PI * 1.1), m.glow, hats.visor, { y: 0.21, rx: -Math.PI / 2, rz: -0.16 });
    part(new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.35), m.hair, hats.visor, { y: 0.24, sy: 1.5 });

    hats.cowboy = g();
    part(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 28), m.hat, hats.cowboy, { y: 0.28 });
    part(new THREE.CylinderGeometry(0.15, 0.18, 0.22, 16), m.hat, hats.cowboy, { y: 0.4 });
    part(new THREE.CylinderGeometry(0.183, 0.183, 0.045, 16), m.dark, hats.cowboy, { y: 0.32 });

    hats.headband = g();
    part(new THREE.TorusGeometry(0.197, 0.03, 6, 24), m.hat, hats.headband, { y: 0.27, rx: Math.PI / 2 });
    part(new THREE.BoxGeometry(0.05, 0.22, 0.02), m.hat, hats.headband, { x: -0.04, y: 0.18, z: 0.22, rz: 0.3, rx: 0.4 });
    part(new THREE.BoxGeometry(0.05, 0.2, 0.02), m.hat, hats.headband, { x: 0.05, y: 0.19, z: 0.22, rz: -0.25, rx: 0.4 });

    hats.pith = g();
    part(hemi(0.225), m.hat, hats.pith, { y: 0.25, sy: 0.9 });
    part(new THREE.CylinderGeometry(0.32, 0.33, 0.02, 24), m.hat, hats.pith, { y: 0.27 });
    part(new THREE.TorusGeometry(0.226, 0.018, 6, 24), m.trim, hats.pith, { y: 0.29, rx: Math.PI / 2 });

    hats.fire = g();
    part(hemi(0.235), m.hat, hats.fire, { y: 0.24 });
    part(new THREE.CylinderGeometry(0.3, 0.3, 0.025, 24), m.hat, hats.fire, { y: 0.25, rx: 0.18 });
    part(new THREE.BoxGeometry(0.1, 0.12, 0.03), m.gold, hats.fire, { y: 0.37, z: -0.2, rx: -0.4 });

    hats.bubble = g();
    part(new THREE.SphereGeometry(0.34, 28, 18), m.glass, hats.bubble, { y: 0.2 }).castShadow = false;
    part(new THREE.TorusGeometry(0.2, 0.045, 8, 24), m.pack, hats.bubble, { y: -0.02, rx: Math.PI / 2 });

    hats.crown = g();
    part(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 20, 1, true), m.gold, hats.crown, { y: 0.42 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      part(new THREE.ConeGeometry(0.04, 0.1, 6), m.gold, hats.crown, { x: Math.cos(a) * 0.165, y: 0.51, z: Math.sin(a) * 0.165 });
      part(new THREE.SphereGeometry(0.02, 8, 6), m.gem, hats.crown, { x: Math.cos(a) * 0.175, y: 0.42, z: Math.sin(a) * 0.175 });
    }

    // 潛水面鏡 + 呼吸管
    hats.mask = g();
    part(new THREE.TorusGeometry(0.197, 0.025, 6, 24), m.dark, hats.mask, { y: 0.22, rx: Math.PI / 2 });
    part(new RoundedBoxGeometry(0.3, 0.14, 0.06, 2, 0.03), m.glass, hats.mask, { y: 0.21, z: -0.18 });
    part(new RoundedBoxGeometry(0.32, 0.16, 0.04, 2, 0.03), m.hat, hats.mask, { y: 0.21, z: -0.16 });
    part(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8), m.hat, hats.mask, { x: 0.2, y: 0.3, z: -0.05 });
    // 廚師帽
    hats.chef = g();
    part(new THREE.CylinderGeometry(0.19, 0.2, 0.24, 20), m.hat, hats.chef, { y: 0.4 });
    part(new THREE.SphereGeometry(0.25, 16, 12), m.hat, hats.chef, { y: 0.58, sy: 0.7 });
    part(new THREE.TorusGeometry(0.2, 0.02, 6, 20), m.trim, hats.chef, { y: 0.3, rx: Math.PI / 2 });
    // 恐龍帽 T
    hats.dinohood = g();
    part(hemi(0.235), m.hat, hats.dinohood, { y: 0.21, sy: 1.05 });
    for (let k = 0; k < 4; k++) {
      part(new THREE.ConeGeometry(0.05, 0.12, 5), m.trim, hats.dinohood, { y: 0.45 - Math.abs(k - 1.5) * 0.03, z: -0.12 + k * 0.1 });
    }
    for (const x of [-0.08, 0.08]) part(new THREE.SphereGeometry(0.05, 10, 8), m.hat, hats.dinohood, { x, y: 0.42, z: -0.14 });
    // 巫師帽
    hats.witch = g();
    part(new THREE.CylinderGeometry(0.38, 0.38, 0.025, 28), m.hat, hats.witch, { y: 0.3 });
    part(new THREE.ConeGeometry(0.2, 0.55, 18), m.hat, hats.witch, { y: 0.58, rz: 0.15 });
    part(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 18), m.trim, hats.witch, { y: 0.33 });
    // 飛行帽 + 護目鏡
    hats.aviator = g();
    part(hemi(0.215), m.hat, hats.aviator, { y: 0.22 });
    for (const x of [-0.19, 0.19]) part(new RoundedBoxGeometry(0.06, 0.2, 0.14, 2, 0.02), m.hat, hats.aviator, { x, y: 0.14 });
    for (const x of [-0.07, 0.07]) {
      part(new THREE.TorusGeometry(0.055, 0.018, 6, 16), m.gold, hats.aviator, { x, y: 0.34, z: -0.17, rx: -0.4 });
      part(new THREE.CircleGeometry(0.05, 14), m.glass, hats.aviator, { x, y: 0.34, z: -0.165, rx: -0.4 });
    }
    // 熊貓帽 T
    hats.pandahood = g();
    part(hemi(0.225), m.hat, hats.pandahood, { y: 0.22 });
    for (const x of [-0.16, 0.16]) part(new THREE.SphereGeometry(0.075, 12, 10), m.trim, hats.pandahood, { x, y: 0.42, z: 0.02 });

    hats.none = g();
    part(new THREE.SphereGeometry(0.205, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.4), m.hair, hats.none, { y: 0.23, sy: 1.25 });
    this.hats = hats;

    const extras = {};
    extras.phones = g();
    part(new THREE.TorusGeometry(0.2, 0.02, 6, 20, Math.PI), m.phones, extras.phones, { y: 0.22 });
    for (const ex of [-0.19, 0.19]) part(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 14), m.phones, extras.phones, { x: ex, y: 0.2, rz: Math.PI / 2 });
    extras.sunglasses = g();
    part(new RoundedBoxGeometry(0.28, 0.07, 0.04, 2, 0.015), m.shades, extras.sunglasses, { y: 0.205, z: -0.18 });
    extras.headlamp = g();
    extras.scarf = this.scarf;
    this.extras = extras;
  }

  // 角色：頭部造型、膚色、體型
  buildCharacters() {
    const m = this.mats;
    const metal = new THREE.MeshStandardMaterial({ color: '#9aa7b8', roughness: 0.3, metalness: 0.85 });
    const visor = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 3, 3.6) });
    const red = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.5, 0.4) });
    const fur = new THREE.MeshStandardMaterial({ color: '#e0762b', roughness: 0.85 });
    const white = new THREE.MeshStandardMaterial({ color: '#fff6ea', roughness: 0.85 });
    this.charMats = { metal, fur };

    // 小美的馬尾
    this.ponytail = pivot(this.head, 0, 0);
    part(new THREE.SphereGeometry(0.08, 12, 10), m.hair, this.ponytail, { y: 0.33, z: 0.15 });
    part(new THREE.CapsuleGeometry(0.065, 0.22, 4, 10), m.hair, this.ponytail, { y: 0.2, z: 0.25, rx: 0.5 });
    part(new THREE.TorusGeometry(0.06, 0.018, 6, 12), m.trim, this.ponytail, { y: 0.31, z: 0.2, rx: 0.9 });

    // 機器人頭
    this.robotHead = pivot(this.head, 0, 0);
    part(new RoundedBoxGeometry(0.4, 0.36, 0.36, 3, 0.07), metal, this.robotHead, { y: 0.21 });
    part(new RoundedBoxGeometry(0.32, 0.1, 0.04, 2, 0.02), visor, this.robotHead, { y: 0.23, z: -0.18 });
    part(new THREE.CylinderGeometry(0.015, 0.015, 0.2, 6), metal, this.robotHead, { x: 0.1, y: 0.47 });
    part(new THREE.SphereGeometry(0.035, 10, 8), red, this.robotHead, { x: 0.1, y: 0.58 });
    for (const x of [-0.21, 0.21]) part(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12), metal, this.robotHead, { x, y: 0.2, rz: Math.PI / 2 });
    part(new THREE.BoxGeometry(0.16, 0.02, 0.02), m.dark, this.robotHead, { y: 0.1, z: -0.18 });

    // 狐狸頭
    this.foxHead = pivot(this.head, 0, 0);
    part(new THREE.SphereGeometry(0.2, 20, 16), fur, this.foxHead, { y: 0.2 });
    part(new THREE.ConeGeometry(0.1, 0.22, 12), white, this.foxHead, { y: 0.14, z: -0.24, rx: -Math.PI / 2 });
    part(new THREE.SphereGeometry(0.035, 8, 6), m.eye, this.foxHead, { y: 0.14, z: -0.35 });
    for (const s of [-1, 1]) {
      part(new THREE.SphereGeometry(0.028, 8, 6), m.eye, this.foxHead, { x: s * 0.08, y: 0.24, z: -0.17 });
      part(new THREE.ConeGeometry(0.08, 0.2, 4), fur, this.foxHead, { x: s * 0.12, y: 0.42, z: 0.02, rz: -s * 0.25 });
      part(new THREE.ConeGeometry(0.045, 0.12, 4), white, this.foxHead, { x: s * 0.12, y: 0.4, z: -0.02, rz: -s * 0.25 });
      part(new THREE.SphereGeometry(0.08, 10, 8), white, this.foxHead, { x: s * 0.1, y: 0.1, z: -0.12 });
    }
    // 狐狸尾巴
    this.foxTail = pivot(this.hips, 0, 0.05, 0.18);
    part(new THREE.CapsuleGeometry(0.11, 0.38, 6, 12), fur, this.foxTail, { y: 0.14, z: 0.2, rx: 1.0 });
    part(new THREE.SphereGeometry(0.1, 12, 10), white, this.foxTail, { y: 0.34, z: 0.36 });
  }

  applyCharacter(c) {
    const id = c.id;
    this.character = id;
    this.face.visible = id === 'kid' || id === 'girl';
    this.ponytail.visible = id === 'girl';
    this.robotHead.visible = id === 'robot';
    this.foxHead.visible = id === 'fox';
    this.foxTail.visible = id === 'fox';
    const skin = { kid: '#f2c29b', girl: '#f7d4bb', robot: '#9aa7b8', fox: '#e0762b' }[id];
    this.mats.skin.color.set(skin);
    this.mats.skin.metalness = id === 'robot' ? 0.85 : 0;
    this.mats.skin.roughness = id === 'robot' ? 0.3 : 0.6;
    this.baseScale = id === 'girl' ? 0.95 : id === 'robot' ? 1.04 : 1;
    this.root.scale.setScalar(this.baseScale);
    this.hatRoot.position.y = id === 'robot' ? 0.07 : id === 'fox' ? 0.02 : 0;
  }

  applyOutfit(o) {
    const m = this.mats;
    const c = o.colors;
    const set = (mat, color) => {
      mat.color.set(color);
      mat.metalness = o.metallic ? 0.85 : 0;
      mat.roughness = o.metallic ? 0.28 : 0.65;
    };
    set(m.top, c.top);
    set(m.trim, c.trim);
    set(m.pants, c.pants);
    set(m.hat, c.hat);
    set(m.pack, c.pack);
    set(m.shoe, c.shoe);
    set(m.sole, c.sole);
    m.hair.color.set(c.hair);
    m.scarf.color.set(c.scarf || c.trim);
    if (o.hat === 'bubble') m.hat.color.set('#ffffff');
    for (const [k, grp] of Object.entries(this.hats)) grp.visible = k === o.hat;
    for (const [k, grp] of Object.entries(this.extras)) grp.visible = o.extras.includes(k);
  }

  // ---------- 道具外觀 ----------
  buildPowerVisuals() {
    const red = new THREE.MeshStandardMaterial({ color: '#e53935', roughness: 0.35, metalness: 0.4 });
    const steel = new THREE.MeshStandardMaterial({ color: '#b0b8c4', roughness: 0.3, metalness: 0.9 });
    this.flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.8, 0.4), transparent: true, opacity: 0.9 });

    // 噴射背包
    this.jet = new THREE.Group();
    this.torso.add(this.jet);
    this.flames = [];
    for (const x of [-0.11, 0.11]) {
      part(new THREE.CapsuleGeometry(0.095, 0.32, 4, 12), red, this.jet, { x, y: 0.34, z: 0.27 });
      part(new THREE.CylinderGeometry(0.06, 0.09, 0.1, 12), steel, this.jet, { x, y: 0.09, z: 0.27 });
      const f = part(new THREE.ConeGeometry(0.07, 0.4, 10), this.flameMat, this.jet, { x, y: -0.14, z: 0.27, rx: Math.PI });
      f.castShadow = false;
      this.flames.push(f);
    }
    part(new THREE.BoxGeometry(0.18, 0.3, 0.06), steel, this.jet, { y: 0.34, z: 0.2 });
    this.jet.visible = false;

    // 彈跳鞋的彈簧
    const helix = new THREE.CatmullRomCurve3(
      Array.from({ length: 41 }, (_, i) => {
        const a = i * 0.6;
        return new THREE.Vector3(Math.cos(a) * 0.07, -i * 0.0055, Math.sin(a) * 0.07);
      }),
    );
    const springGeo = new THREE.TubeGeometry(helix, 80, 0.018, 6);
    const green = new THREE.MeshStandardMaterial({ color: '#2ecc71', roughness: 0.3, metalness: 0.6 });
    for (const leg of this.legs) {
      const s = part(springGeo, green, leg.ankle, { y: -0.1, z: -0.05 });
      s.visible = false;
      this.springs.push(s);
    }

    // 防護罩（邊緣發光的泡泡）
    this.shieldMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.3, 0.8, 1.6) } },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uColor;
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main() {
          float f = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.5);
          float bands = 0.5 + 0.5 * sin(vP.y * 18.0 - uTime * 4.0);
          gl_FragColor = vec4(uColor * (f * 1.2 + bands * 0.08), f * 0.9 + 0.05);
        }`,
    });
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(1.05, 32, 18), this.shieldMat);
    this.shield.position.y = 0.95;
    this.shield.visible = false;
    this.root.add(this.shield);

    // 頭上的磁鐵
    this.magnet = new THREE.Group();
    const horse = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 8, 20, Math.PI), red);
    horse.rotation.z = Math.PI;
    this.magnet.add(horse);
    for (const x of [-0.16, 0.16]) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.12), steel);
      tip.position.set(x, 0.03, 0);
      this.magnet.add(tip);
    }
    this.magnet.position.set(0, 2.2, 0);
    this.magnet.visible = false;
    this.root.add(this.magnet);

    // 滑板
    this.board = new THREE.Group();
    const deck = new THREE.MeshStandardMaterial({ color: '#ff3d7f', roughness: 0.35, metalness: 0.3 });
    const stripe = new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.4 });
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.6, 4), transparent: true, opacity: 0.9 });
    part(new RoundedBoxGeometry(0.62, 0.07, 1.5, 3, 0.03), deck, this.board, { y: 0.14 });
    part(new THREE.BoxGeometry(0.64, 0.075, 0.12), stripe, this.board, { y: 0.14, z: -0.4 });
    part(new THREE.BoxGeometry(0.64, 0.075, 0.12), stripe, this.board, { y: 0.14, z: 0.4 });
    const glow = part(new THREE.BoxGeometry(0.5, 0.02, 1.3), glowMat, this.board, { y: 0.09 });
    glow.castShadow = false;
    for (const z of [-0.5, 0.5]) {
      const pad = part(new THREE.CylinderGeometry(0.14, 0.1, 0.06, 16), glowMat, this.board, { y: 0.08, z });
      pad.castShadow = false;
    }
    this.board.visible = false;
    this.root.add(this.board);
  }

  setPower(fx) {
    Object.assign(this.fx, fx);
    this.jet.visible = this.fx.jetpack;
    this.pack.visible = !this.fx.jetpack;
    for (const s of this.springs) s.visible = this.fx.spring;
    this.shield.visible = this.fx.shield;
    this.magnet.visible = this.fx.magnet;
    this.board.visible = this.fx.board;
  }

  // state: { speed, grounded, vy, sliding, crashed, lean, idle, flying }
  animate(dt, s) {
    const k = 1 - Math.exp(-dt * 14);
    const p = this.pose;
    const airborne = !s.grounded && !s.sliding && !s.flying;
    p.jump = lerp(p.jump, airborne ? 1 : 0, k);
    p.slide = lerp(p.slide, s.sliding ? 1 : 0, 1 - Math.exp(-dt * 20));
    p.crash = lerp(p.crash, s.crashed ? 1 : 0, 1 - Math.exp(-dt * 8));
    p.idle = lerp(p.idle, s.idle ? 1 : 0, 1 - Math.exp(-dt * 6));
    p.fly = lerp(p.fly || 0, s.flying ? 1 : 0, k);
    p.board = lerp(p.board || 0, this.fx.board && !s.sliding && !s.crashed && !s.flying ? 1 : 0, k);

    if (!s.crashed) this.phase += dt * (s.idle ? 2.2 : 4.5 + s.speed * 0.22);
    const ph = this.phase;
    const run = (1 - p.jump) * (1 - p.slide) * (1 - p.idle) * (1 - p.crash) * (1 - p.fly) * (1 - p.board);

    const swing = Math.sin(ph);
    this.hips.position.y = 0.95 + run * Math.abs(Math.cos(ph)) * 0.07 + p.idle * Math.sin(ph) * 0.01;
    this.torso.rotation.x = -0.22 * run - 0.1 * p.jump + 0.05 * p.idle - 0.35 * p.fly;
    this.torso.rotation.y = swing * 0.15 * run;
    this.head.rotation.x = 0.18 * run + 0.1 * p.jump + 0.3 * p.fly;

    for (const leg of this.legs) {
      const s2 = leg.side < 0 ? swing : -swing;
      const c2 = leg.side < 0 ? Math.cos(ph) : -Math.cos(ph);
      const runHip = s2 * 0.85;
      const runKnee = -(0.25 + Math.max(0, c2) * 1.3);
      const jumpHip = leg.side < 0 ? 1.1 : 0.2;
      const jumpKnee = leg.side < 0 ? -1.5 : -0.9;
      const slideHip = 1.35;
      const slideKnee = leg.side < 0 ? -0.2 : -0.9;
      const flyHip = -0.1 + Math.sin(ph * 0.5 + leg.side) * 0.1;
      leg.hip.rotation.x = runHip * run + jumpHip * p.jump + slideHip * p.slide + 0.6 * p.crash + flyHip * p.fly;
      leg.knee.rotation.x = runKnee * run + jumpKnee * p.jump + slideKnee * p.slide - 0.4 * p.crash - 0.05 * p.idle - 0.5 * p.fly;
      leg.ankle.rotation.x = -0.3 * run * Math.max(0, -s2) + 0.3 * p.slide + 0.4 * p.fly;
      leg.hip.rotation.z = -leg.side * 0.04 * p.idle + -leg.side * 0.28 * p.board;
      leg.hip.rotation.x += (leg.side < 0 ? 0.35 : -0.25) * p.board * (1 - p.jump);
      leg.knee.rotation.x += -0.55 * p.board * (1 - p.jump);
    }
    for (const arm of this.arms) {
      const s2 = arm.side < 0 ? -swing : swing;
      arm.shoulder.rotation.x = s2 * 0.9 * run - 2.6 * p.jump * (arm.side < 0 ? 1 : 0.8) + -0.9 * p.slide - 1.8 * p.crash + 0.5 * p.fly;
      arm.shoulder.rotation.z = arm.side * (0.12 + 0.35 * p.jump + 0.9 * p.slide + 0.6 * p.crash + 0.05 * p.idle + 0.6 * p.fly);
      arm.elbow.rotation.x = 1.3 * run + 0.4 * p.jump + 0.2 * p.slide + 0.15 * p.idle + 0.2 * p.fly + 0.4 * p.board;
      arm.shoulder.rotation.z += arm.side * 0.9 * p.board;
    }

    this.body.rotation.x = 1.15 * p.slide + 1.45 * p.crash - 0.25 * p.fly;
    this.body.position.y = 0.12 * p.slide + 0.18 * p.crash + (this.fx.spring ? 0.2 * (1 - p.slide) : 0) + 0.2 * p.board;
    this.body.rotation.y = 0.45 * p.board;
    this.body.position.z = 0.25 * p.slide + 0.7 * p.crash;
    this.body.rotation.z = s.lean ?? 0;
    this.hips.rotation.x = -0.25 * p.jump * Math.max(0, Math.min(1, s.vy / 10));

    // 道具動畫
    const t = performance.now() / 1000;
    if (this.jet.visible) for (const f of this.flames) f.scale.set(1, 0.8 + Math.random() * 0.6 + p.fly * 0.6, 1);
    if (this.shield.visible) this.shieldMat.uniforms.uTime.value = t;
    if (this.board.visible) {
      this.board.position.y = 0.06 + Math.sin(t * 6) * 0.03;
      this.board.rotation.z = (s.lean ?? 0) * 2;
    }
    if (this.foxTail.visible) this.foxTail.rotation.y = Math.sin(this.phase) * 0.35;
    if (this.magnet.visible) {
      this.magnet.rotation.y = t * 3;
      this.magnet.position.y = 2.2 + Math.sin(t * 4) * 0.08;
    }
  }
}

// 第 11～16 個場景：海底世界、糖果王國、恐龍谷、南瓜鎮、天空之城、熊貓竹林
// 每個 build 函式以 Environment 為 this 呼叫，回傳 { group, randomize, tick? }
import * as THREE from 'three';
import { rand, merged, mesh } from './geo.js';
import { SEG_LEN } from './config.js';

const L = SEG_LEN;
const HALF = -L / 2;
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
const flat = (color, extra = {}) => std(color, { flatShading: true, ...extra });
const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
const cyl = (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);
const sph = (r, a = 14, b = 10) => new THREE.SphereGeometry(r, a, b);
const side = (i) => (i % 2 ? 1 : -1);

function assets(env, id, create) {
  env._extra2 ??= {};
  env._extra2[id] ??= create();
  return env._extra2[id];
}

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ======================= 海底世界 =======================
function underwaterAssets() {
  const coral = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const h = rand(1.2, 2.4);
    coral.push([cyl(0.08, 0.14, h, 6), Math.cos(a) * 0.3, h / 2, Math.sin(a) * 0.3, Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4]);
    coral.push([sph(0.13, 8, 6), Math.cos(a) * 0.3 + Math.cos(a) * 0.4 * h * 0.4, h, Math.sin(a) * 0.3 + Math.sin(a) * 0.4 * h * 0.4]);
  }
  const kelp = [];
  for (let k = 0; k < 7; k++) kelp.push([new THREE.CapsuleGeometry(0.12, 0.9, 4, 6), Math.sin(k) * 0.1, 0.5 + k * 1.0, 0, 0, 0, Math.sin(k * 1.3) * 0.15, 1.6, 1, 0.5]);
  const fish = merged([
    [new THREE.ConeGeometry(0.18, 0.6, 8), 0, 0, 0, 0, 0, Math.PI / 2],
    [new THREE.ConeGeometry(0.14, 0.25, 4), -0.38, 0, 0, 0, 0, -Math.PI / 2],
  ]);
  const wreck = merged([
    [new THREE.BoxGeometry(4, 2.4, 14), 0, 1.0, 0, 0, 0, 0.35],
    [new THREE.CylinderGeometry(0.18, 0.2, 8, 8), 0.5, 5, -2, 0, 0, 0.5],
    [new THREE.BoxGeometry(3, 1.6, 4), 0, 2.6, 4, 0, 0, 0.35],
  ]);
  return {
    G: {
      coral: merged(coral),
      brain: sph(1, 16, 12),
      kelp: merged(kelp),
      rock: new THREE.DodecahedronGeometry(1, 0),
      fish,
      wreck,
      whale: merged([
        [sph(1, 20, 14), 0, 0, 0, 0, 0, 0, 3.2, 2.4, 9],
        [new THREE.ConeGeometry(2.2, 3.5, 4), 0, 0, -10, Math.PI / 2, 0, 0, 1.6, 1, 0.3],
      ]),
    },
    M: {
      corals: ['#ff6b8b', '#ffa94d', '#c77dff', '#4dd6c8'].map((c) => flat(c, { emissive: c, emissiveIntensity: 0.15 })),
      kelp: flat('#3d8b4a'),
      rock: flat('#5a6a72', { roughness: 1 }),
      fish: ['#ffb000', '#ff5a3c', '#3dd6ff'].map((c) => std(c, { roughness: 0.4 })),
      wreck: flat('#4a3a2e', { roughness: 1 }),
      whale: flat('#1f3a5a', { roughness: 1 }),
    },
  };
}

function build_underwater() {
  const { G, M } = assets(this, 'underwater', underwaterAssets);
  const group = new THREE.Group();
  const corals = [];
  for (let i = 0; i < 10; i++) {
    const c = mesh(i % 3 ? G.coral : G.brain, M.corals[i % 4], { cast: true });
    group.add(c);
    corals.push(c);
  }
  const kelps = [];
  for (let i = 0; i < 10; i++) {
    const k = mesh(G.kelp, M.kelp, { cast: true });
    group.add(k);
    kelps.push(k);
  }
  const rocks = [];
  for (let i = 0; i < 6; i++) {
    const r = mesh(G.rock, M.rock, { cast: true });
    group.add(r);
    rocks.push(r);
  }
  const schools = [];
  for (let s = 0; s < 3; s++) {
    const school = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const f = mesh(G.fish, M.fish[s % 3]);
      f.position.set(rand(-1.5, 1.5), rand(-0.8, 0.8), rand(-1.5, 1.5));
      school.add(f);
    }
    group.add(school);
    schools.push(school);
  }
  const wreck = mesh(G.wreck, M.wreck);
  const whale = mesh(G.whale, M.whale, { receive: false });
  group.add(wreck, whale);
  const randomize = () => {
    corals.forEach((c, i) => {
      c.position.set(side(i) * rand(5.6, 16), c.geometry === G.brain ? 0.2 : 0, -rand(0, L));
      c.scale.setScalar(c.geometry === G.brain ? rand(0.4, 0.9) : rand(0.8, 1.6));
      c.rotation.y = rand(0, 6);
    });
    kelps.forEach((k, i) => {
      k.position.set(side(i) * rand(6, 20), 0, -rand(0, L));
      k.scale.setScalar(rand(0.7, 1.5));
      k.userData.ph = rand(0, 6);
    });
    rocks.forEach((r, i) => {
      r.position.set(side(i) * rand(6, 22), 0.2, -rand(0, L));
      r.scale.set(rand(0.6, 2), rand(0.4, 1.2), rand(0.6, 2));
    });
    schools.forEach((sc, i) => {
      sc.userData = { x: side(i) * rand(8, 18), y: rand(3, 8), z: -rand(0, L), r: rand(2, 4), sp: rand(0.4, 0.9) };
    });
    wreck.visible = Math.random() < 0.15;
    wreck.position.set((Math.random() < 0.5 ? -1 : 1) * rand(24, 34), 0, -20);
    wreck.rotation.y = rand(-0.5, 0.5);
    whale.visible = Math.random() < 0.2;
    whale.position.set((Math.random() < 0.5 ? -1 : 1) * rand(40, 70), rand(18, 26), -20);
  };
  const tick = (dt, t) => {
    for (const k of kelps) k.rotation.z = Math.sin(t * 1.2 + k.userData.ph) * 0.12;
    for (const sc of schools) {
      const u = sc.userData;
      sc.position.set(u.x + Math.cos(t * u.sp) * u.r, u.y + Math.sin(t * 1.3) * 0.3, u.z + Math.sin(t * u.sp) * u.r);
      sc.rotation.y = -t * u.sp;
    }
    whale.position.z += dt * 1.2;
    if (whale.position.z > 10) whale.position.z = -L;
  };
  return { group, randomize, tick };
}

// ======================= 糖果王國 =======================
function candyAssets() {
  const swirl = canvasTex(256, 256, (ctx, w) => {
    const cols = ['#ff4d8d', '#ffffff', '#ffd23f', '#ffffff', '#3dd6ff', '#ffffff'];
    for (let r = 128; r > 0; r -= 10) {
      ctx.fillStyle = cols[(r / 10) % cols.length | 0];
      ctx.beginPath();
      ctx.arc(w / 2, w / 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, false);
  const stripes = canvasTex(64, 64, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#e8203a';
    for (let y = -64; y < 128; y += 22) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(64, y + 32);
      ctx.lineTo(64, y + 44);
      ctx.lineTo(0, y + 12);
      ctx.fill();
    }
  });
  stripes.repeat.set(1, 6);
  const cane = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 4, 0),
    new THREE.Vector3(0.3, 4.9, 0),
    new THREE.Vector3(1.0, 5.1, 0),
    new THREE.Vector3(1.5, 4.6, 0),
  ]);
  return {
    G: {
      stick: cyl(0.1, 0.1, 3.4, 8).translate(0, 1.7, 0),
      pop: cyl(1.2, 1.2, 0.3, 32).rotateX(Math.PI / 2).translate(0, 4.2, 0),
      cane: new THREE.TubeGeometry(cane, 40, 0.22, 10),
      gum: new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      cupBase: cyl(1.5, 1.1, 1.8, 18).translate(0, 0.9, 0),
      cupTop: sph(1.6, 20, 14).scale(1, 0.75, 1).translate(0, 2.1, 0),
      cherry: sph(0.3).translate(0, 3.35, 0),
      donut: new THREE.TorusGeometry(1.2, 0.5, 14, 28),
      fence: new THREE.BoxGeometry(0.4, 1.0, L).translate(0, 0.5, HALF),
      river: new THREE.PlaneGeometry(10, L).rotateX(-Math.PI / 2).translate(0, 0.03, HALF),
    },
    M: {
      stick: std('#ffffff', { roughness: 0.4 }),
      pop: new THREE.MeshStandardMaterial({ map: swirl, roughness: 0.25 }),
      cane: new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.3 }),
      gums: ['#ff4d8d', '#7dff6a', '#ffd23f', '#9b5cff', '#3dd6ff'].map((c) => std(c, { roughness: 0.15, metalness: 0.1 })),
      cupBase: std('#f2a0c8', { roughness: 0.6 }),
      cupTop: std('#fff4fa', { roughness: 0.5 }),
      cherry: std('#e8203a', { roughness: 0.2 }),
      donut: std('#e8a060', { roughness: 0.6 }),
      icing: std('#ff7ac8', { roughness: 0.3 }),
      fence: std('#f5d7a8', { roughness: 0.8 }),
      river: std('#6b3a1e', { roughness: 0.15, metalness: 0.2 }),
    },
  };
}

function build_candy() {
  const { G, M } = assets(this, 'candy', candyAssets);
  const group = new THREE.Group();
  for (const s of [-1, 1]) {
    const f = mesh(G.fence, M.fence, { cast: true });
    f.position.x = s * 7.8;
    group.add(f);
  }
  const river = mesh(G.river, M.river);
  river.position.x = -14;
  group.add(river);
  const pops = [];
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Group();
    p.add(mesh(G.stick, M.stick, { cast: true }), mesh(G.pop, M.pop, { cast: true }));
    group.add(p);
    pops.push(p);
  }
  const canes = [];
  for (let i = 0; i < 4; i++) {
    const c = mesh(G.cane, M.cane, { cast: true });
    group.add(c);
    canes.push(c);
  }
  const gums = [];
  for (let i = 0; i < 8; i++) {
    const g = mesh(G.gum, M.gums[i % 5], { cast: true });
    group.add(g);
    gums.push(g);
  }
  const cups = [];
  for (let i = 0; i < 2; i++) {
    const c = new THREE.Group();
    c.add(mesh(G.cupBase, M.cupBase, { cast: true }), mesh(G.cupTop, M.cupTop, { cast: true }), mesh(G.cherry, M.cherry));
    group.add(c);
    cups.push(c);
  }
  const donuts = [];
  for (let i = 0; i < 2; i++) {
    const d = new THREE.Group();
    d.add(mesh(G.donut, M.donut, { cast: true }));
    const icing = mesh(G.donut, M.icing);
    icing.scale.set(1.02, 1.02, 0.8);
    icing.position.z = 0.12;
    d.add(icing);
    group.add(d);
    donuts.push(d);
  }
  const randomize = () => {
    pops.forEach((p, i) => {
      p.position.set(side(i) * rand(9, 18), 0, -rand(2, L - 2));
      p.rotation.y = rand(-0.6, 0.6) + (side(i) > 0 ? Math.PI / 2 : -Math.PI / 2);
      p.scale.setScalar(rand(0.8, 1.4));
    });
    canes.forEach((c, i) => {
      c.position.set(side(i) * rand(8.4, 11), 0, -rand(2, L - 2));
      c.rotation.y = rand(0, 6);
    });
    gums.forEach((g, i) => {
      g.position.set(side(i) * rand(10, 30), 0, -rand(0, L));
      g.scale.set(rand(1, 3), rand(1, 2.4), rand(1, 3));
    });
    cups.forEach((c, i) => {
      c.visible = Math.random() < 0.6;
      c.position.set(side(i) * rand(20, 28), 0, -rand(5, L - 5));
      c.scale.setScalar(rand(1.2, 2));
    });
    donuts.forEach((d, i) => {
      d.visible = Math.random() < 0.4;
      d.position.set(side(i) * rand(12, 20), 1.6, -rand(5, L - 5));
      d.rotation.y = side(i) * Math.PI / 2 + rand(-0.3, 0.3);
    });
  };
  const tick = (dt, t) => {
    for (const p of pops) p.children[1].rotation.z = t * 0.5;
  };
  return { group, randomize, tick };
}

// ======================= 恐龍谷 =======================
function dinoAssets() {
  const nest = [];
  for (let k = 0; k < 3; k++) nest.push([sph(0.35, 12, 10), (k - 1) * 0.5, 0.4, rand(-0.2, 0.2), 0, 0, 0, 1, 1.3, 1]);
  const ptero = merged([
    [sph(0.35, 10, 8), 0, 0, 0, 0, 0, 0, 1, 1, 2.2],
    [new THREE.ConeGeometry(0.2, 1.0, 6), 0, 0.2, 0.9, -1.2],
  ]);
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.5, 0, 0, -0.4, 2.4, 0.2, 0.1, 0, 0, 0.5, 2.4, 0.2, 0.1, 0, 0, -0.4], 3));
  wing.computeVertexNormals();
  return {
    G: {
      volcano: cyl(8, 40, 38, 10).translate(0, 19, 0),
      crater: cyl(7.8, 7.8, 0.6, 12).translate(0, 38, 0),
      conifer: merged([
        [cyl(0.3, 0.45, 8, 7), 0, 4, 0],
        [new THREE.ConeGeometry(2, 5, 7), 0, 8.5, 0],
        [new THREE.ConeGeometry(1.4, 3.5, 7), 0, 10.8, 0],
      ]),
      eggs: merged(nest),
      nest: new THREE.TorusGeometry(1.0, 0.25, 8, 16).rotateX(Math.PI / 2).translate(0, 0.25, 0),
      bone: merged([
        [cyl(0.12, 0.12, 2.2, 8), 0, 0.15, 0, 0, 0, Math.PI / 2],
        [sph(0.22, 8, 6), 1.1, 0.15, 0.12],
        [sph(0.22, 8, 6), 1.1, 0.15, -0.12],
        [sph(0.22, 8, 6), -1.1, 0.15, 0.12],
        [sph(0.22, 8, 6), -1.1, 0.15, -0.12],
      ]),
      ptero,
      wing,
    },
    M: {
      volcano: flat('#4a3a32', { roughness: 1 }),
      crater: glow(4, 1.4, 0.3),
      conifer: flat('#3f6b2a'),
      eggs: std('#f1e6c8', { roughness: 0.6 }),
      nest: flat('#7a5a32'),
      bone: std('#efe6d2', { roughness: 0.6 }),
      ptero: flat('#8a5a3a'),
      wing: new THREE.MeshStandardMaterial({ color: '#a86a42', roughness: 0.8, side: THREE.DoubleSide, flatShading: true }),
    },
  };
}

function build_dino() {
  const { G, M } = assets(this, 'dino', dinoAssets);
  const group = new THREE.Group();
  const ferns = [];
  for (let i = 0; i < 12; i++) {
    const f = mesh(this.G.palmLeaves, this.mat.palmLeaf, { cast: true });
    group.add(f);
    ferns.push(f);
  }
  const trees = [];
  for (let i = 0; i < 6; i++) {
    const t = mesh(G.conifer, M.conifer, { cast: true });
    group.add(t);
    trees.push(t);
  }
  const palms = [];
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Group();
    p.add(mesh(this.G.palmTrunk, this.mat.palmTrunk, { cast: true }), mesh(this.G.palmLeaves, this.mat.palmLeaf, { cast: true }));
    group.add(p);
    palms.push(p);
  }
  const volcano = new THREE.Group();
  volcano.add(mesh(G.volcano, M.volcano, { receive: false }), new THREE.Mesh(G.crater, M.crater));
  group.add(volcano);
  const nest = new THREE.Group();
  nest.add(mesh(G.nest, M.nest), mesh(G.eggs, M.eggs, { cast: true }));
  const bones = mesh(G.bone, M.bone, { cast: true });
  group.add(nest, bones);
  const pteros = [];
  for (let i = 0; i < 2; i++) {
    const p = new THREE.Group();
    p.add(mesh(G.ptero, M.ptero));
    const wl = mesh(G.wing, M.wing);
    const wr = mesh(G.wing, M.wing);
    wr.scale.x = -1;
    p.add(wl, wr);
    p.userData = { wl, wr };
    group.add(p);
    pteros.push(p);
  }
  const randomize = () => {
    ferns.forEach((f, i) => {
      f.position.set(side(i) * rand(5.8, 14), -1.7, -rand(0, L));
      f.scale.setScalar(rand(0.45, 0.7));
      f.rotation.y = rand(0, 6);
    });
    trees.forEach((t, i) => {
      t.position.set(side(i) * rand(12, 30), 0, -rand(0, L));
      t.scale.setScalar(rand(0.8, 1.4));
    });
    palms.forEach((p, i) => {
      p.position.set(side(i) * rand(8, 14), 0, -rand(2, L - 2));
      p.rotation.y = rand(0, 6);
      p.scale.setScalar(rand(0.9, 1.3));
    });
    volcano.visible = Math.random() < 0.35;
    volcano.position.set((Math.random() < 0.5 ? -1 : 1) * rand(90, 130), -2, -rand(0, L));
    nest.visible = Math.random() < 0.3;
    nest.position.set((Math.random() < 0.5 ? -1 : 1) * rand(6.5, 9), 0, -rand(4, L - 4));
    bones.visible = Math.random() < 0.3;
    bones.position.set((Math.random() < 0.5 ? -1 : 1) * rand(6.5, 10), 0, -rand(4, L - 4));
    bones.rotation.y = rand(0, 6);
    pteros.forEach((p, i) => {
      p.visible = Math.random() < 0.5;
      p.userData.base = { x: side(i) * rand(6, 20), y: rand(10, 16), z: -rand(0, L), ph: rand(0, 6) };
    });
  };
  const tick = (dt, t) => {
    for (const p of pteros) {
      if (!p.visible) continue;
      const b = p.userData.base;
      p.position.set(b.x + Math.cos(t * 0.4 + b.ph) * 8, b.y + Math.sin(t * 0.8 + b.ph), b.z + Math.sin(t * 0.4 + b.ph) * 8);
      p.rotation.y = -t * 0.4 - b.ph;
      const f = Math.sin(t * 6 + b.ph) * 0.6;
      p.userData.wl.rotation.z = f;
      p.userData.wr.rotation.z = -f;
    }
  };
  return { group, randomize, tick };
}

// ======================= 南瓜鎮 =======================
function halloweenAssets() {
  const face = canvasTex(128, 128, (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.moveTo(30, 50);
    ctx.lineTo(50, 30);
    ctx.lineTo(55, 55);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(98, 50);
    ctx.lineTo(78, 30);
    ctx.lineTo(73, 55);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(28, 75);
    for (let i = 0; i <= 8; i++) ctx.lineTo(28 + i * 9, i % 2 ? 92 : 80);
    ctx.lineTo(100, 75);
    ctx.quadraticCurveTo(64, 115, 28, 75);
    ctx.fill();
  }, false);
  const branches = [[cyl(0.25, 0.4, 5, 7), 0, 2.5, 0]];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    branches.push([cyl(0.05, 0.14, 2.2, 5), Math.cos(a) * 0.7, 4.2 + k * 0.25, Math.sin(a) * 0.7, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9]);
  }
  const fence = [];
  for (let z = -0.5; z > -L; z -= 0.5) fence.push([cyl(0.03, 0.03, 1.6, 4), 0, 0.8, z], [new THREE.ConeGeometry(0.06, 0.18, 4), 0, 1.68, z]);
  fence.push([new THREE.BoxGeometry(0.05, 0.06, L), 0, 1.3, HALF], [new THREE.BoxGeometry(0.05, 0.06, L), 0, 0.4, HALF]);
  const bat = new THREE.BufferGeometry();
  bat.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.2, 0, 0, -0.2, 0.7, 0.1, 0, 0.3, 0, 0.15, 0.7, 0.1, 0, 0.45, -0.1, -0.05], 3));
  bat.computeVertexNormals();
  return {
    G: {
      tree: merged(branches),
      pumpkin: sph(0.6, 16, 12).scale(1.2, 0.85, 1.2),
      pumpkinFace: new THREE.PlaneGeometry(0.9, 0.9),
      stem: cyl(0.06, 0.09, 0.25, 6).translate(0, 0.55, 0),
      stone: new THREE.CapsuleGeometry(0.45, 0.9, 4, 10).scale(1, 1, 0.3).translate(0, 0.7, 0),
      cross: merged([
        [new THREE.BoxGeometry(0.2, 1.6, 0.15), 0, 0.8, 0],
        [new THREE.BoxGeometry(0.8, 0.2, 0.15), 0, 1.15, 0],
      ]),
      fence: merged(fence),
      house: new THREE.BoxGeometry(8, 7, 7).translate(0, 3.5, 0),
      roof: new THREE.ConeGeometry(6.5, 5, 4).rotateY(Math.PI / 4).translate(0, 9.5, 0),
      tower: merged([
        [cyl(1.4, 1.4, 10, 10), 3.5, 5, 3],
        [new THREE.ConeGeometry(1.9, 4, 10), 3.5, 12, 3],
      ]),
      windows: merged([
        [new THREE.PlaneGeometry(1, 1.4), -2, 4.5, 3.52],
        [new THREE.PlaneGeometry(1, 1.4), 2, 4.5, 3.52],
        [new THREE.PlaneGeometry(1, 1.4), -2, 1.8, 3.52],
      ]),
      bat,
    },
    M: {
      tree: flat('#2a2226', { roughness: 1 }),
      pumpkin: std('#ff7a1a', { roughness: 0.5 }),
      face: new THREE.MeshBasicMaterial({ map: face, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(2.5, 2.5, 2.5) }),
      stem: std('#4a6a2a'),
      stone: flat('#6a6670', { roughness: 1 }),
      fence: std('#141216', { roughness: 0.5, metalness: 0.5 }),
      house: flat('#2e2838', { roughness: 1 }),
      roof: flat('#1a1622', { roughness: 1 }),
      window: glow(3.5, 2.2, 0.6),
      bat: new THREE.MeshBasicMaterial({ color: '#0b0a0e', side: THREE.DoubleSide }),
    },
  };
}

function build_halloween() {
  const { G, M } = assets(this, 'halloween', halloweenAssets);
  const group = new THREE.Group();
  for (const s of [-1, 1]) {
    const f = mesh(G.fence, M.fence);
    f.position.x = s * 7.6;
    group.add(f);
  }
  const trees = [];
  for (let i = 0; i < 6; i++) {
    const t = mesh(G.tree, M.tree, { cast: true });
    group.add(t);
    trees.push(t);
  }
  const pumpkins = [];
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Group();
    p.add(mesh(G.pumpkin, M.pumpkin, { cast: true }), mesh(G.stem, M.stem));
    const f = new THREE.Mesh(G.pumpkinFace, M.face);
    f.position.set(0, 0.05, 0.73);
    p.add(f);
    group.add(p);
    pumpkins.push(p);
  }
  const stones = [];
  for (let i = 0; i < 8; i++) {
    const s = mesh(i % 3 ? G.stone : G.cross, M.stone, { cast: true });
    group.add(s);
    stones.push(s);
  }
  const house = new THREE.Group();
  house.add(mesh(G.house, M.house), mesh(G.roof, M.roof), mesh(G.tower, M.house), new THREE.Mesh(G.windows, M.window));
  group.add(house);
  const bats = [];
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Group();
    const l = new THREE.Mesh(G.bat, M.bat);
    const r = new THREE.Mesh(G.bat, M.bat);
    r.scale.x = -1;
    b.add(l, r);
    b.userData = { l, r };
    group.add(b);
    bats.push(b);
  }
  const randomize = () => {
    trees.forEach((t, i) => {
      t.position.set(side(i) * rand(9, 20), 0, -rand(0, L));
      t.rotation.y = rand(0, 6);
      t.scale.setScalar(rand(0.8, 1.4));
    });
    pumpkins.forEach((p, i) => {
      const s = side(i);
      p.position.set(s * rand(5.7, 7.2), 0.45, -rand(0, L));
      p.rotation.y = s > 0 ? -Math.PI / 2 + rand(-0.4, 0.4) : Math.PI / 2 + rand(-0.4, 0.4);
      p.scale.setScalar(rand(0.7, 1.3));
      p.visible = Math.random() < 0.8;
    });
    stones.forEach((s, i) => {
      const sd = side(i);
      s.position.set(sd * rand(9, 16), 0, -rand(0, L));
      s.rotation.set(rand(-0.15, 0.15), sd > 0 ? -Math.PI / 2 : Math.PI / 2, rand(-0.15, 0.15));
    });
    house.visible = Math.random() < 0.25;
    const hs = Math.random() < 0.5 ? -1 : 1;
    house.position.set(hs * rand(26, 34), 0, -20);
    house.rotation.y = hs > 0 ? -Math.PI / 2 : Math.PI / 2;
    bats.forEach((b) => {
      b.userData.base = { x: rand(-14, 14), y: rand(7, 13), z: -rand(0, L), ph: rand(0, 6), r: rand(2, 5) };
    });
  };
  const tick = (dt, t) => {
    for (const b of bats) {
      const u = b.userData.base;
      if (!u) continue;
      b.position.set(u.x + Math.cos(t * 1.5 + u.ph) * u.r, u.y + Math.sin(t * 3 + u.ph) * 0.5, u.z + Math.sin(t * 1.5 + u.ph) * u.r);
      b.rotation.y = -t * 1.5 - u.ph;
      const f = Math.sin(t * 14 + u.ph) * 0.8;
      b.userData.l.rotation.z = f;
      b.userData.r.rotation.z = -f;
    }
  };
  return { group, randomize, tick };
}

// ======================= 天空之城 =======================
function skyAssets() {
  const island = merged([
    [new THREE.ConeGeometry(6, 9, 8), 0, -4.5, 0, Math.PI],
    [cyl(6.1, 6, 1.2, 8), 0, 0.6, 0],
  ]);
  const cloud = merged([
    [sph(1.6, 12, 10), 0, 0, 0],
    [sph(1.2, 12, 10), 1.6, -0.2, 0.3],
    [sph(1.3, 12, 10), -1.5, -0.1, -0.2],
    [sph(1.0, 12, 10), 0.6, 0.6, -0.6],
  ]);
  const ropes = [];
  for (let z = -1; z > -L; z -= 4) ropes.push([cyl(0.08, 0.1, 1.4, 6), 0, 0.9, z]);
  ropes.push([cyl(0.03, 0.03, L, 4), 0, 1.5, HALF, Math.PI / 2], [cyl(0.03, 0.03, L, 4), 0, 1.0, HALF, Math.PI / 2]);
  return {
    G: {
      island,
      grass: cyl(6.2, 6.2, 0.3, 8).translate(0, 1.3, 0),
      tree: merged([
        [cyl(0.2, 0.3, 2, 6), 0, 2.4, 0],
        [new THREE.IcosahedronGeometry(1.3, 0), 0, 4.1, 0],
      ]),
      cloud,
      ropes: merged(ropes),
      rainbow: new THREE.TorusGeometry(60, 1.2, 6, 48, Math.PI),
      balloon: sph(2.2, 18, 14).scale(1, 1.2, 1),
      basket: new THREE.BoxGeometry(1.2, 0.9, 1.2).translate(0, -3.4, 0),
    },
    M: {
      rock: flat('#8a7a68', { roughness: 1 }),
      grass: flat('#7cc45a'),
      tree: flat('#4f9a3a'),
      cloud: std('#f4f8ff', { roughness: 1 }),
      ropes: std('#8a6a42'),
      rainbow: ['#ff4d4d', '#ff9f1c', '#ffe066', '#7dff6a', '#3dd6ff', '#9b5cff'].map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, fog: false })),
      balloons: ['#ff4d6d', '#ffd23f', '#3dd6ff'].map((c) => std(c, { roughness: 0.5 })),
      basket: std('#8a5a36'),
    },
  };
}

function build_skycity() {
  const { G, M } = assets(this, 'skycity', skyAssets);
  const group = new THREE.Group();
  for (const s of [-1, 1]) {
    const r = mesh(G.ropes, M.ropes, { cast: true });
    r.position.x = s * 4.3;
    group.add(r);
  }
  const islands = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    g.add(mesh(G.island, M.rock), mesh(G.grass, M.grass));
    for (let k = 0; k < 3; k++) {
      const t = mesh(G.tree, M.tree, { cast: true });
      t.position.set(rand(-3.5, 3.5), 0, rand(-3.5, 3.5));
      g.add(t);
    }
    group.add(g);
    islands.push(g);
  }
  const clouds = [];
  for (let i = 0; i < 10; i++) {
    const c = mesh(G.cloud, M.cloud);
    group.add(c);
    clouds.push(c);
  }
  const rainbow = new THREE.Group();
  M.rainbow.forEach((m, k) => {
    const band = new THREE.Mesh(G.rainbow, m);
    band.scale.setScalar(1 - k * 0.035);
    rainbow.add(band);
  });
  group.add(rainbow);
  const balloons = [];
  for (let i = 0; i < 2; i++) {
    const b = new THREE.Group();
    b.add(mesh(G.balloon, M.balloons[i]), mesh(G.basket, M.basket));
    group.add(b);
    balloons.push(b);
  }
  const randomize = () => {
    islands.forEach((g, i) => {
      g.position.set(side(i) * rand(16, 40), rand(-4, 8), -rand(0, L));
      g.scale.setScalar(rand(0.6, 1.3));
      g.rotation.y = rand(0, 6);
      g.visible = Math.random() < 0.8;
    });
    clouds.forEach((c, i) => {
      c.position.set(side(i) * rand(6, 30), rand(-1, 4), -rand(0, L));
      c.scale.setScalar(rand(0.8, 2));
    });
    rainbow.visible = Math.random() < 0.15;
    rainbow.position.set(0, -10, -L / 2 - 30);
    balloons.forEach((b, i) => {
      b.visible = Math.random() < 0.5;
      b.userData.base = { x: side(i) * rand(12, 26), y: rand(8, 16), z: -rand(0, L), ph: rand(0, 6) };
    });
  };
  const tick = (dt, t) => {
    for (const b of balloons) {
      const u = b.userData.base;
      if (u) b.position.set(u.x, u.y + Math.sin(t * 0.7 + u.ph) * 0.8, u.z);
    }
  };
  return { group, randomize, tick };
}

// ======================= 熊貓竹林 =======================
function bambooAssets() {
  const stalk = [];
  for (let k = 0; k < 7; k++) {
    stalk.push([cyl(0.12, 0.13, 1.9, 8), 0, 0.95 + k * 2, 0]);
    stalk.push([cyl(0.15, 0.15, 0.12, 8), 0, 1.95 + k * 2, 0]);
  }
  const leaves = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    leaves.push([new THREE.ConeGeometry(0.12, 1.4, 4), Math.cos(a) * 0.5, 12 + (k % 3) * 1.2, Math.sin(a) * 0.5, Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2, 1, 1, 0.2]);
  }
  const pavilion = merged([
    [cyl(0.2, 0.2, 3.2, 8), -2, 1.6, -2],
    [cyl(0.2, 0.2, 3.2, 8), 2, 1.6, -2],
    [cyl(0.2, 0.2, 3.2, 8), -2, 1.6, 2],
    [cyl(0.2, 0.2, 3.2, 8), 2, 1.6, 2],
  ]);
  return {
    G: {
      stalk: merged(stalk),
      leaves: merged(leaves),
      peak: new THREE.ConeGeometry(14, 60, 7).translate(0, 30, 0),
      pavilion,
      pavRoof: new THREE.ConeGeometry(4, 1.8, 6).translate(0, 4.1, 0),
      pavBase: new THREE.BoxGeometry(5.2, 0.4, 5.2).translate(0, 0.2, 0),
      rock: new THREE.DodecahedronGeometry(1, 0),
    },
    M: {
      stalk: std('#6aa84f', { roughness: 0.5 }),
      stalk2: std('#8cc063', { roughness: 0.5 }),
      leaves: flat('#4f8f3a'),
      peak: flat('#6f8f86', { roughness: 1 }),
      red: std('#b22a2a', { roughness: 0.5 }),
      roof: flat('#2f5a4a'),
      stone: flat('#9a968e', { roughness: 1 }),
    },
  };
}

function build_bamboo() {
  const { G, M } = assets(this, 'bamboo', bambooAssets);
  const group = new THREE.Group();
  const N = 34;
  const stalks = new THREE.InstancedMesh(G.stalk, M.stalk, N);
  const leaves = new THREE.InstancedMesh(G.leaves, M.leaves, N);
  for (const im of [stalks, leaves]) {
    im.castShadow = true;
    im.receiveShadow = true;
    group.add(im);
  }
  const peaks = [];
  for (let i = 0; i < 3; i++) {
    const p = mesh(G.peak, M.peak, { receive: false });
    group.add(p);
    peaks.push(p);
  }
  const pav = new THREE.Group();
  pav.add(mesh(G.pavilion, M.red, { cast: true }), mesh(G.pavRoof, M.roof, { cast: true }), mesh(G.pavBase, M.stone));
  group.add(pav);
  const rocks = [];
  for (let i = 0; i < 5; i++) {
    const r = mesh(G.rock, M.stone, { cast: true });
    group.add(r);
    rocks.push(r);
  }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const e = new THREE.Euler();
  const randomize = () => {
    for (let i = 0; i < N; i++) {
      v.set(side(i) * rand(6, 22), 0, -rand(0, L));
      e.set(rand(-0.08, 0.08), rand(0, 6), rand(-0.08, 0.08));
      q.setFromEuler(e);
      const k = rand(0.7, 1.2);
      s.set(k, k * rand(0.8, 1.1), k);
      m4.compose(v, q, s);
      stalks.setMatrixAt(i, m4);
      leaves.setMatrixAt(i, m4);
    }
    stalks.instanceMatrix.needsUpdate = true;
    leaves.instanceMatrix.needsUpdate = true;
    peaks.forEach((p, i) => {
      p.visible = Math.random() < 0.6;
      p.position.set(side(i) * rand(70, 120), -2, -rand(0, L));
      p.scale.set(rand(0.6, 1.1), rand(0.7, 1.4), rand(0.6, 1.1));
    });
    pav.visible = Math.random() < 0.2;
    const ps = Math.random() < 0.5 ? -1 : 1;
    pav.position.set(ps * rand(11, 14), 0, -rand(6, L - 6));
    rocks.forEach((r, i) => {
      r.position.set(side(i) * rand(6, 12), 0.2, -rand(0, L));
      r.scale.set(rand(0.4, 1.2), rand(0.3, 0.8), rand(0.4, 1.2));
    });
  };
  return { group, randomize };
}

export const EXTRA_BUILDERS2 = {
  underwater: build_underwater,
  candy: build_candy,
  dino: build_dino,
  halloween: build_halloween,
  skycity: build_skycity,
  bamboo: build_bamboo,
};


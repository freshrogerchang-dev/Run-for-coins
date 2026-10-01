// 第 19～21 個場景：洛杉磯、紐約、舊金山
// 每個 build 函式以 Environment 為 this 呼叫，回傳 { group, randomize, tick? }
import * as THREE from 'three';
import { rand, pick, merged, mesh, roofGeometry } from './geo.js';
import { SEG_LEN } from './config.js';

const L = SEG_LEN;
const HALF = -L / 2;
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
const flat = (color, extra = {}) => std(color, { flatShading: true, ...extra });
const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);
const sph = (r, a = 12, b = 8) => new THREE.SphereGeometry(r, a, b);
const side = (i) => (i % 2 ? 1 : -1);
const unitBox = box(1, 1, 1).translate(0, 0.5, 0);

function assets(env, id, create) {
  env._extra4 ??= {};
  env._extra4[id] ??= create(env);
  return env._extra4[id];
}

function canvasTex(w, h, draw, repeat = false) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const DISPLAY = '"Fredoka", "Chiron GoRound TC", "Arial Rounded MT Bold", sans-serif';

// 招牌：彩色底、白色粗字
function signTex(text, bg, ink = '#ffffff', w = 512, h = 128) {
  return canvasTex(w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(4, 4, w - 8, h - 8, 22);
    else ctx.rect(4, 4, w - 8, h - 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = h * 0.62;
    ctx.font = `700 ${size}px ${DISPLAY}`;
    while (ctx.measureText(text).width > w - 40 && size > 20) {
      size -= 4;
      ctx.font = `700 ${size}px ${DISPLAY}`;
    }
    ctx.fillText(text, w / 2, h / 2 + 4);
  });
}

const signMat = (tex, k = 1.15) =>
  new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.35 * k, roughness: 0.5, side: THREE.DoubleSide });

// 路燈（洛杉磯、紐約、舊金山共用）
const lampParts = () => ({
  pole: cyl(0.08, 0.11, 6, 8).translate(0, 3, 0),
  arm: box(1.6, 0.09, 0.12).translate(-0.75, 5.9, 0),
  head: box(0.6, 0.14, 0.32).translate(-1.45, 5.82, 0),
});

// 柔和的白色煙霧圖
function puffTexture() {
  return canvasTex(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

// 兩側人行道與路緣
function addSidewalks(group, G, M, x, width = 3.2, curbX = 4.45) {
  for (const s of [-1, 1]) {
    const sw = mesh(G.sidewalk, M.sidewalk);
    sw.position.x = s * x;
    sw.scale.x = width / 3.2;
    const curb = mesh(G.curb, M.curb);
    curb.position.x = s * curbX;
    group.add(sw, curb);
  }
}

const commonG = () => ({
  sidewalk: box(3.2, 0.25, L).translate(0, 0.125, HALF),
  curb: box(0.3, 0.32, L).translate(0, 0.16, HALF),
  ...lampParts(),
});

function makeLamps(group, G, poleMat, headMat, n) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const l = new THREE.Group();
    l.add(mesh(G.pole, poleMat, { cast: true }), mesh(G.arm, poleMat), new THREE.Mesh(G.head, headMat));
    group.add(l);
    list.push(l);
  }
  return list;
}

function placeLamps(lamps, x, offset = 0) {
  lamps.forEach((l, i) => {
    l.position.set(side(i) * x, 0.25, -5 - offset - Math.floor(i / 2) * (L / Math.ceil(lamps.length / 2)));
    l.rotation.y = side(i) > 0 ? 0 : Math.PI;
  });
}

// ======================= 洛杉磯 =======================
const LA_SIGNS = [
  ['TACOS', '#ff5a3c'],
  ['DONUTS', '#ff6fb5'],
  ['MOTEL', '#16a6a0'],
  ['SURF SHOP', '#1f8fd6'],
  ['DINER', '#d7263d'],
  ['BURGERS', '#f2a100'],
  ['ROLLER RINK', '#8a4fe0'],
  ['SMOOTHIES', '#2fb35a'],
];

function laAssets() {
  // 又高又細的華盛頓棕櫚
  const leaves = [];
  for (let k = 0; k < 11; k++) {
    const leaf = new THREE.ConeGeometry(0.34, 2.8, 4);
    leaf.scale(1, 1, 0.18);
    leaf.translate(0, 1.4, 0);
    leaf.rotateZ(-1.75 - (k % 3) * 0.2);
    leaf.rotateY((k / 11) * Math.PI * 2);
    leaves.push([leaf, 0.25, 13.6, 0]);
  }
  leaves.push([sph(0.5, 8, 6), 0.25, 13.4, 0, 0, 0, 0, 1, 1.3, 1]);
  const trunk = [];
  for (let i = 0; i < 7; i++) trunk.push([cyl(0.2 - i * 0.008, 0.23 - i * 0.008, 2.0, 7), i * 0.04, 1 + i * 2, 0]);
  const G = {
    ...commonG(),
    palmTrunk: merged(trunk),
    palmCrown: merged(leaves),
    awning: box(1.3, 0.12, 1).translate(-0.6, 0, 0),
    window: box(0.12, 1, 1),
    sign: new THREE.PlaneGeometry(6, 1.5),
    donut: new THREE.TorusGeometry(2.4, 1.0, 12, 24),
    hill: new THREE.IcosahedronGeometry(40, 1),
    letters: new THREE.PlaneGeometry(64, 10),
    billboardPole: cyl(0.2, 0.25, 8, 8).translate(0, 4, 0),
    billboard: box(0.3, 4, 10).translate(0, 10, 0),
    billboardFace: new THREE.PlaneGeometry(9.6, 3.7),
    // 聖塔莫尼卡風格的摩天輪
    wheelRim: new THREE.TorusGeometry(14, 0.35, 6, 48),
    wheelSpokes: merged(Array.from({ length: 12 }, (_, k) => [box(0.18, 28, 0.18), 0, 0, 0, 0, 0, (k / 12) * Math.PI])),
    wheelCars: merged(Array.from({ length: 16 }, (_, k) => {
      const a = (k / 16) * Math.PI * 2;
      return [box(1.2, 1.2, 1.2), Math.cos(a) * 14, Math.sin(a) * 14, 0];
    })),
    wheelLegs: merged([
      [box(0.6, 18, 0.6), -4, 8, -1.5, 0, 0, -0.22],
      [box(0.6, 18, 0.6), 4, 8, -1.5, 0, 0, 0.22],
      [box(0.6, 18, 0.6), -4, 8, 1.5, 0, 0, -0.22],
      [box(0.6, 18, 0.6), 4, 8, 1.5, 0, 0, 0.22],
    ]),
    pier: box(16, 1, 60).translate(0, -0.5, 0),
  };
  const stucco = ['#f6d7b0', '#f4c2c2', '#bfe1d9', '#fff1c9', '#f7e3cf', '#d9e8f5'].map((c) => std(c, { roughness: 0.95 }));
  const awnings = ['#e94f37', '#2ec4b6', '#ffb000', '#3a86ff'].map((c) => std(c, { roughness: 0.6 }));
  const lettersTex = canvasTex(1024, 160, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 150px ${DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('COINWOOD', w / 2, h / 2 + 8);
  });
  const ads = [
    ['RUN FOR COINS', '#ff5a3c'],
    ['SUNSET 50% OFF', '#8a4fe0'],
    ['NOW PLAYING', '#1f8fd6'],
  ].map(([t, c]) => signMat(signTex(t, c, '#ffffff', 512, 192), 1.4));
  const M = {
    sidewalk: std('#d8cfc3', { roughness: 0.9 }),
    curb: std('#c3b9ad', { roughness: 0.8 }),
    pole: std('#7c838b', { roughness: 0.4, metalness: 0.6 }),
    lamp: glow(3.2, 2.9, 2.4),
    trunk: flat('#8a6a4a', { roughness: 0.95 }),
    crown: flat('#4f8f3a', { side: THREE.DoubleSide }),
    stucco,
    awnings,
    glass: std('#2a3a4a', { roughness: 0.1, metalness: 0.5 }),
    signs: LA_SIGNS.map(([t, c]) => signMat(signTex(t, c))),
    donut: std('#d99a5b', { roughness: 0.7 }),
    frosting: std('#ff7ac8', { roughness: 0.5 }),
    hill: flat('#b8925f', { roughness: 1 }),
    letters: new THREE.MeshBasicMaterial({ map: lettersTex, transparent: true, color: new THREE.Color(1.1, 1.1, 1.1), depthWrite: false, side: THREE.DoubleSide }),
    billboard: std('#3a3d42', { roughness: 0.6 }),
    ads,
    wheel: std('#e8e4dc', { roughness: 0.4, metalness: 0.5 }),
    wheelCars: ['#ff5a3c', '#ffd23f', '#3a86ff'].map((c) => std(c, { roughness: 0.4 })),
    pier: std('#8a6a4a', { roughness: 0.9 }),
  };
  return { G, M };
}

function build_la() {
  const { G, M } = assets(this, 'la', laAssets);
  const group = new THREE.Group();
  addSidewalks(group, G, M, 6.1, 3.2, 4.45);
  const palms = [];
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Group();
    p.add(mesh(G.palmTrunk, M.trunk, { cast: true }), mesh(G.palmCrown, M.crown, { cast: true }));
    group.add(p);
    palms.push(p);
  }
  const lamps = makeLamps(group, G, M.pole, M.lamp, 4);

  // 粉彩色的矮房子小店：牆、遮雨棚、玻璃窗、屋頂招牌
  const shops = [];
  for (let i = 0; i < 8; i++) {
    const g = new THREE.Group();
    const body = mesh(unitBox, M.stucco[0], { cast: true });
    const win = mesh(G.window, M.glass);
    const awn = mesh(G.awning, M.awnings[0], { cast: true });
    const sign = new THREE.Mesh(G.sign, M.signs[0]);
    g.add(body, win, awn, sign);
    group.add(g);
    shops.push({ g, body, win, awn, sign });
  }
  const donut = new THREE.Group();
  donut.add(mesh(G.donut, M.donut, { cast: true }));
  const frost = mesh(G.donut, M.frosting);
  frost.scale.set(1.02, 1.02, 0.6);
  frost.position.z = 0.45;
  donut.add(frost);
  group.add(donut);

  // 遠方山丘與大字招牌
  const hills = [];
  for (let i = 0; i < 2; i++) {
    const h = mesh(G.hill, M.hill, { receive: false });
    group.add(h);
    hills.push(h);
  }
  const letters = new THREE.Mesh(G.letters, M.letters);
  group.add(letters);
  const billboard = new THREE.Group();
  const bbFace = new THREE.Mesh(G.billboardFace, M.ads[0]);
  bbFace.position.set(0.16, 10, 0);
  bbFace.rotation.y = Math.PI / 2;
  billboard.add(mesh(G.billboardPole, M.billboard, { cast: true }), mesh(G.billboard, M.billboard, { cast: true }), bbFace);
  group.add(billboard);

  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  spin.add(mesh(G.wheelRim, M.wheel), mesh(G.wheelSpokes, M.wheel), mesh(G.wheelCars, M.wheelCars[0]));
  spin.position.y = 18;
  wheel.add(spin, mesh(G.wheelLegs, M.wheel), mesh(G.pier, M.pier));
  group.add(wheel);

  const randomize = () => {
    palms.forEach((p, i) => {
      p.position.set(side(i) * rand(6.4, 7.2), 0.25, -3 - Math.floor(i / 2) * 13 - rand(0, 3));
      p.rotation.y = rand(0, 6);
      p.scale.setScalar(rand(0.85, 1.15));
    });
    placeLamps(lamps, 7.4, 2);
    // 兩側依序排小店
    const cursor = { '-1': -rand(0, 3), 1: -rand(0, 3) };
    const signs = [...M.signs].sort(() => Math.random() - 0.5);
    shops.forEach((s, i) => {
      const sd = side(i);
      const w = rand(8, 12);
      const h = rand(4.5, 7.5);
      const d = 10;
      const z = cursor[sd] - w / 2;
      cursor[sd] -= w + rand(1, 4);
      s.g.visible = z - w / 2 > -L - 2;
      s.g.position.set(sd * (9.5 + d / 2), 0, z);
      s.body.scale.set(d, h, w);
      s.body.material = pick(M.stucco);
      const face = -sd * (d / 2);
      s.win.position.set(face, 1.6, 0);
      s.win.scale.set(1, 2.2, w * 0.75);
      s.awn.material = pick(M.awnings);
      s.awn.position.set(face, 3.0, 0);
      s.awn.scale.set(sd, 1, w * 0.85);
      s.awn.rotation.z = sd * 0.25;
      s.sign.material = signs[i % signs.length];
      s.sign.position.set(face - sd * 0.08, h + 1.0, 0);
      s.sign.rotation.y = -sd * (Math.PI / 2);
    });
    // 偶爾在屋頂上放一個巨大甜甜圈
    const host = shops.find((s) => s.g.visible && Math.random() < 0.35);
    donut.visible = !!host && Math.random() < 0.5;
    if (donut.visible) {
      donut.position.set(host.g.position.x, host.body.scale.y + 3.5, host.g.position.z);
      donut.rotation.y = Math.PI / 2;
    }
    hills.forEach((h, i) => {
      h.visible = Math.random() < 0.7;
      h.position.set(side(i) * rand(110, 150), -8, -rand(0, L));
      h.scale.set(rand(1, 1.6), rand(0.5, 0.8), rand(1, 1.6));
    });
    letters.visible = hills[0].visible && Math.random() < 0.35;
    letters.position.set(hills[0].position.x + 30, 18, hills[0].position.z + 20);
    letters.rotation.y = 0.55;
    billboard.visible = Math.random() < 0.4;
    const bs = Math.random() < 0.5 ? -1 : 1;
    billboard.position.set(bs * 8.6, 0, -rand(8, L - 8));
    billboard.rotation.y = bs < 0 ? -0.35 : Math.PI + 0.35;
    bbFace.material = pick(M.ads);
    wheel.visible = Math.random() < 0.12;
    wheel.position.set(rand(60, 80), 0, -20);
  };
  const tick = (dt) => {
    if (wheel.visible) spin.rotation.z += dt * 0.15;
  };
  return { group, randomize, tick };
}

// ======================= 紐約 =======================
function brickTexture() {
  return canvasTex(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#7a3b2a';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) {
      const off = (y / 8) % 2 ? 8 : 0;
      for (let x = -16; x < w; x += 16) {
        const v = 100 + Math.random() * 40;
        ctx.fillStyle = `rgb(${v + 30},${v * 0.48},${v * 0.36})`;
        ctx.fillRect(x + off + 1, y + 1, 14, 6);
      }
    }
    // 窗戶：3 欄 × 6 層，白色窗框
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 3; c++) {
        const x = 26 + c * 76;
        const y = 30 + r * 80;
        ctx.fillStyle = '#e8e2d6';
        ctx.fillRect(x - 5, y - 5, 54, 62);
        ctx.fillStyle = Math.random() < 0.3 ? '#f2c66a' : '#2b3442';
        ctx.fillRect(x, y, 44, 52);
        ctx.fillStyle = '#e8e2d6';
        ctx.fillRect(x, y + 24, 44, 4);
      }
    }
  });
}

const NYC_SCREENS = [
  ['COIN SQUARE', '#ff3d8b'],
  ['I ♥ COINS', '#ffffff', '#d7263d'],
  ['RUN!', '#2ec4ff'],
  ['BROADWAY', '#ffd23f', '#1a1a1a'],
  ['SALE 70%', '#7dff6a', '#1a1a1a'],
];

function nycAssets() {
  // 防火梯：每層一個平台 + 欄杆 + 斜梯
  const fe = [];
  for (let k = 1; k <= 5; k++) {
    const y = k * 2.9 + 0.4;
    fe.push([box(1.0, 0.06, 3.4), 0.5, y, 0], [box(0.05, 0.9, 3.4), 1.0, y + 0.45, 0], [box(0.05, 2.9, 0.05), 1.0, y + 0.45, 1.7]);
    fe.push([box(0.6, 0.05, 3.6), 0.55, y - 1.45, 0, 0.82, 0, 0]);
  }
  const G = {
    ...commonG(),
    parking: box(1.7, 0.2, L).translate(0, 0.1, HALF),
    fireEscape: merged(fe),
    tankBody: cyl(1.3, 1.3, 2.6, 14).translate(0, 3.0, 0),
    tankRoof: new THREE.ConeGeometry(1.45, 1.1, 14).translate(0, 4.85, 0),
    tankLegs: merged([[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].map(([x, z]) => [box(0.15, 1.7, 0.15), x, 0.85, z])),
    taxiBody: merged([
      [box(1.8, 0.7, 4.6), 0, 0.7, 0],
      [box(1.6, 0.55, 2.3), 0, 1.3, 0.2],
    ]),
    taxiGlass: box(1.62, 0.42, 2.0).translate(0, 1.3, 0.2),
    taxiWheels: merged([[-0.85, 1.5], [0.85, 1.5], [-0.85, -1.5], [0.85, -1.5]].map(([x, z]) => [cyl(0.34, 0.34, 0.22, 12), x, 0.35, z, 0, 0, Math.PI / 2])),
    taxiSign: box(0.6, 0.22, 0.3).translate(0, 1.7, 0.2),
    stack: cyl(0.45, 0.55, 2.2, 14).translate(0, 1.1, 0),
    stackStripes: merged([0.35, 1.05, 1.75].map((y) => [cyl(0.47, 0.5, 0.3, 14), 0, y, 0])),
    hydrant: merged([
      [cyl(0.16, 0.18, 0.6, 10), 0, 0.3, 0],
      [sph(0.17, 10, 6), 0, 0.62, 0],
      [cyl(0.07, 0.07, 0.5, 8), 0, 0.42, 0, 0, 0, Math.PI / 2],
    ]),
    cart: box(1.0, 1.0, 1.8).translate(0, 0.75, 0),
    umbrella: new THREE.ConeGeometry(1.4, 0.6, 12, 1, true).translate(0, 2.6, 0),
    umbrellaPole: cyl(0.04, 0.04, 2.4, 6).translate(0, 1.2, 0),
    subwayRail: merged([
      [box(0.08, 1.0, 4), -0.9, 0.75, 0],
      [box(0.08, 1.0, 4), 0.9, 0.75, 0],
      [box(1.9, 1.0, 0.08), 0, 0.75, -2],
    ]),
    globePole: cyl(0.05, 0.05, 2.6, 6).translate(0, 1.3, 0),
    globe: sph(0.22, 12, 8).translate(0, 2.7, 0),
    screen: new THREE.PlaneGeometry(12, 6),
    deco: merged([
      [box(40, 120, 40), 0, 60, 0],
      [box(30, 40, 30), 0, 140, 0],
      [box(20, 25, 20), 0, 172, 0],
      [box(12, 15, 12), 0, 192, 0],
      [cyl(1.2, 2.5, 30, 8), 0, 214, 0],
    ]),
  };
  const brick = brickTexture();
  const brickMats = ['#ffffff', '#e6c8b8', '#c8a890'].map((c) => new THREE.MeshStandardMaterial({ map: brick, color: c, roughness: 0.9 }));
  const puff = puffTexture();
  const M = {
    sidewalk: std('#a8a59f', { roughness: 0.9 }),
    curb: std('#8f8c86', { roughness: 0.8 }),
    parking: std('#45474c', { roughness: 0.9 }),
    pole: std('#4a5560', { roughness: 0.4, metalness: 0.6 }),
    lamp: glow(3.2, 2.8, 2.0),
    brick: brickMats,
    iron: std('#1d1f22', { roughness: 0.5, metalness: 0.6 }),
    tank: std('#7a5a3a', { roughness: 0.95 }),
    tankRoof: std('#3a3a3a', { roughness: 0.8 }),
    taxi: std('#f7c400', { roughness: 0.35, metalness: 0.2 }),
    glass: std('#1d2a38', { roughness: 0.08, metalness: 0.5 }),
    tire: std('#1b1b1d', { roughness: 0.8 }),
    taxiSign: glow(3.4, 3.2, 2.6),
    stackOrange: std('#ff6a1a', { roughness: 0.6 }),
    stackWhite: std('#f4f4f0', { roughness: 0.6 }),
    hydrant: std('#c8102e', { roughness: 0.4 }),
    cart: std('#c9d1d9', { roughness: 0.3, metalness: 0.7 }),
    umbrella: std('#ff8a1c', { roughness: 0.6, side: THREE.DoubleSide }),
    subwayGreen: std('#1f6b3a', { roughness: 0.5 }),
    globe: glow(0.6, 3.4, 1.2),
    screens: NYC_SCREENS.map(([t, c, ink]) => new THREE.MeshBasicMaterial({ map: signTex(t, c, ink || '#1a1a1a', 512, 256), color: new THREE.Color(1.5, 1.5, 1.5), side: THREE.DoubleSide })),
    deco: std('#b8b0a2', { roughness: 0.7 }),
    puff: puff,
  };
  return { G, M };
}

function build_nyc() {
  const { G, M } = assets(this, 'nyc', nycAssets);
  const group = new THREE.Group();
  addSidewalks(group, G, M, 7.4, 3.2, 5.9);
  for (const s of [-1, 1]) {
    const p = mesh(G.parking, M.parking);
    p.position.x = s * 5.05;
    group.add(p);
  }
  const lamps = makeLamps(group, G, M.pole, M.lamp, 4);

  // 臨街的紅磚公寓：防火梯、屋頂水塔
  const walkups = [];
  for (let i = 0; i < 8; i++) {
    const g = new THREE.Group();
    const body = mesh(unitBox, M.brick[0], { cast: true });
    const fe = mesh(G.fireEscape, M.iron, { cast: true });
    const tank = new THREE.Group();
    tank.add(mesh(G.tankBody, M.tank, { cast: true }), mesh(G.tankRoof, M.tankRoof), mesh(G.tankLegs, M.iron));
    g.add(body, fe, tank);
    group.add(g);
    walkups.push({ g, body, fe, tank });
  }
  // 後排摩天大樓
  const towers = this.makeBuildings(group, 6);
  const deco = mesh(G.deco, M.deco, { receive: false });
  group.add(deco);
  // 時代廣場風格的大螢幕
  const screens = [];
  for (let i = 0; i < 4; i++) {
    const sc = new THREE.Mesh(G.screen, M.screens[0]);
    group.add(sc);
    screens.push(sc);
  }
  // 停在路邊的黃色計程車
  const taxis = [];
  for (let i = 0; i < 4; i++) {
    const t = new THREE.Group();
    t.add(mesh(G.taxiBody, M.taxi, { cast: true }), mesh(G.taxiGlass, M.glass), mesh(G.taxiWheels, M.tire), new THREE.Mesh(G.taxiSign, M.taxiSign));
    group.add(t);
    taxis.push(t);
  }
  // 冒蒸氣的橘白煙囪
  const stack = new THREE.Group();
  stack.add(mesh(G.stack, M.stackWhite, { cast: true }), mesh(G.stackStripes, M.stackOrange));
  const puffs = [];
  for (let i = 0; i < 7; i++) {
    const p = new THREE.Sprite(new THREE.SpriteMaterial({ map: M.puff, transparent: true, depthWrite: false, opacity: 0 }));
    p.userData.t = i / 7;
    stack.add(p);
    puffs.push(p);
  }
  group.add(stack);
  const hydrants = [];
  for (let i = 0; i < 2; i++) {
    const h = mesh(G.hydrant, M.hydrant, { cast: true });
    group.add(h);
    hydrants.push(h);
  }
  const cart = new THREE.Group();
  cart.add(mesh(G.cart, M.cart, { cast: true }), mesh(G.umbrellaPole, M.pole), mesh(G.umbrella, M.umbrella, { cast: true }));
  group.add(cart);
  const subway = new THREE.Group();
  subway.add(mesh(G.subwayRail, M.subwayGreen, { cast: true }));
  for (const x of [-0.9, 0.9]) {
    const pole = mesh(G.globePole, M.subwayGreen);
    pole.position.set(x, 0, 2);
    const gl = new THREE.Mesh(G.globe, M.globe);
    gl.position.set(x, 0, 2);
    subway.add(pole, gl);
  }
  group.add(subway);

  const randomize = () => {
    placeLamps(lamps, 8.2, 4);
    const cursor = { '-1': -rand(0, 2), 1: -rand(0, 2) };
    walkups.forEach((w, i) => {
      const sd = side(i);
      const width = rand(8, 11);
      const h = rand(15, 22);
      const d = 12;
      const z = cursor[sd] - width / 2;
      cursor[sd] -= width + rand(0, 0.6);
      w.g.visible = z - width / 2 > -L - 2;
      w.g.position.set(sd * (9.0 + d / 2), 0, z);
      w.body.scale.set(d, h, width);
      w.body.material = pick(M.brick);
      w.fe.visible = h > 16.5 && Math.random() < 0.7;
      w.fe.position.set(-sd * (d / 2), 0, rand(-1, 1));
      w.fe.scale.x = -sd;
      w.tank.visible = Math.random() < 0.5;
      w.tank.position.set(rand(-2, 2), h, rand(-2, 2));
    });
    this.placeBuildings(towers, this.facadeMats);
    towers.forEach((b) => {
      b.scale.y = rand(2.2, 3.6);
      b.position.x += Math.sign(b.position.x) * 18;
    });
    deco.visible = Math.random() < 0.15;
    deco.position.set((Math.random() < 0.5 ? -1 : 1) * rand(130, 170), 0, -20);
    const bright = Math.random() < 0.2;
    screens.forEach((sc, i) => {
      sc.visible = bright;
      const w = walkups[i];
      sc.material = pick(M.screens);
      const sd = side(i);
      sc.position.set(sd * 8.9, rand(7, 11), w.g.position.z);
      sc.rotation.y = -sd * (Math.PI / 2);
    });
    taxis.forEach((t, i) => {
      t.visible = Math.random() < 0.55;
      t.position.set(side(i) * 5.05, 0.2, -rand(3, L - 3));
      t.rotation.y = Math.random() < 0.5 ? 0 : Math.PI;
    });
    stack.visible = Math.random() < 0.45;
    const ss = Math.random() < 0.5 ? -1 : 1;
    stack.position.set(ss * 5.05, 0.2, -rand(6, L - 6));
    if (stack.visible) for (const t of taxis) if (Math.sign(t.position.x) === ss && Math.abs(t.position.z - stack.position.z) < 4) t.visible = false;
    hydrants.forEach((h, i) => h.position.set(side(i) * 6.3, 0.25, -rand(2, L - 2)));
    cart.visible = Math.random() < 0.3;
    cart.position.set((Math.random() < 0.5 ? -1 : 1) * 7.9, 0.25, -rand(4, L - 4));
    subway.visible = Math.random() < 0.25;
    const sws = Math.random() < 0.5 ? -1 : 1;
    subway.position.set(sws * 8.0, 0.25, -rand(5, L - 5));
  };
  const tick = (dt) => {
    if (!stack.visible) return;
    for (const p of puffs) {
      const u = (p.userData.t = (p.userData.t + dt * 0.35) % 1);
      p.position.set(Math.sin(u * 5 + p.id) * 0.3 * u, 2.3 + u * 6, 0);
      p.scale.setScalar(1 + u * 3.5);
      p.material.opacity = 0.55 * Math.sin(u * Math.PI);
    }
  };
  return { group, randomize, tick };
}

// ======================= 舊金山 =======================
function sfAssets() {
  const G = {
    ...commonG(),
    // 維多利亞式彩色房子：正面朝街、山牆屋頂
    house: box(9, 8.5, 6.4).translate(0, 4.25, 0),
    roof: roofGeometry(6.6, 9.2, 2.6).rotateY(Math.PI / 2).translate(0, 8.5, 0),
    bay: box(1.2, 5.2, 2.6).translate(0, 4.4, 0),
    trim: merged([
      [box(0.2, 0.25, 6.6), 0, 8.4, 0],
      [box(0.2, 0.25, 6.6), 0, 3.1, 0],
      [box(0.2, 8.4, 0.25), 0, 4.2, 3.2],
      [box(0.2, 8.4, 0.25), 0, 4.2, -3.2],
    ]),
    door: box(0.12, 2.2, 1.1).translate(0, 1.6, 0),
    steps: merged([0, 1, 2, 3].map((k) => [box(1.6 - k * 0.3, 0.25, 1.6), k * 0.15, 0.13 + k * 0.25, 0])),
    // 海灣與紅色吊橋
    bay_water: new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
    bridgeDeck: box(240, 2.2, 9).translate(0, 22, 0),
    bridgeTower: merged([
      [box(3, 70, 3), 0, 35, -4.5],
      [box(3, 70, 3), 0, 35, 4.5],
      [box(3, 2.5, 12), 0, 62, 0],
      [box(3, 2.5, 12), 0, 46, 0],
      [box(3, 2.5, 12), 0, 30, 0],
    ]),
    lanternWire: new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-8, 7.6, 0), new THREE.Vector3(0, 6.9, 0), new THREE.Vector3(8, 7.6, 0)]), 16, 0.02, 4),
    lanterns: merged(Array.from({ length: 9 }, (_, k) => {
      const x = -6.4 + k * 1.6;
      return [sph(0.3, 10, 8), x, 6.6 + (x * x) / 92, 0, 0, 0, 0, 1, 1.25, 1];
    })),
  };
  // 主纜：從一座塔頂下垂到另一座塔頂
  const cablePts = [];
  for (let i = 0; i <= 24; i++) {
    const x = -120 + i * 10;
    const t = (x + 60) / 120;
    const y = Math.abs(x) <= 60 ? 30 + 34 * (2 * t - 1) ** 2 : 64 - ((Math.abs(x) - 60) / 60) * 40;
    cablePts.push(new THREE.Vector3(x, y, 0));
  }
  const cable = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePts), 80, 0.45, 5);
  G.cables = merged([
    [cable, 0, 0, -4.5],
    [cable, 0, 0, 4.5],
  ]);
  const paints = ['#f7c6d9', '#bfe3f0', '#fff1b8', '#c9f0c4', '#e7d4ff', '#ffd6a5', '#9fd3c7'].map((c) => std(c, { roughness: 0.8 }));
  const M = {
    sidewalk: std('#c9c4bb', { roughness: 0.9 }),
    curb: std('#b3ada3', { roughness: 0.8 }),
    pole: std('#3b4652', { roughness: 0.4, metalness: 0.6 }),
    lamp: glow(3.2, 2.9, 2.2),
    paints,
    roofs: ['#5a6370', '#7a4a3a', '#3a4a5a'].map((c) => flat(c, { roughness: 0.8 })),
    trim: std('#ffffff', { roughness: 0.6 }),
    door: std('#7a2e2e', { roughness: 0.5 }),
    steps: std('#d6d0c6', { roughness: 0.9 }),
    water: std('#3f6f8f', { roughness: 0.15, metalness: 0.3 }),
    bridge: std('#c0362c', { roughness: 0.6 }),
    lanternWire: std('#2a2a2a', { roughness: 0.6 }),
    lantern: glow(3.8, 0.7, 0.4),
  };
  return { G, M };
}

function build_sf() {
  const { G, M } = assets(this, 'sf', sfAssets);
  const group = new THREE.Group();
  addSidewalks(group, G, M, 6.1, 3.2, 4.45);
  const lamps = makeLamps(group, G, M.pole, M.lamp, 4);
  const houses = [];
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group();
    const body = mesh(G.house, M.paints[0], { cast: true });
    const roof = mesh(G.roof, M.roofs[0], { cast: true });
    const bay = mesh(G.bay, M.paints[0], { cast: true });
    const trim = mesh(G.trim, M.trim);
    const door = mesh(G.door, M.door);
    const steps = mesh(G.steps, M.steps, { cast: true });
    g.add(body, roof, bay, trim, door, steps);
    group.add(g);
    houses.push({ g, body, roof, bay, trim, door, steps });
  }
  const bay = new THREE.Group();
  const water = mesh(G.bay_water, M.water, { receive: false });
  water.position.set(212, 0.03, -20);
  bay.add(water);
  const bridge = new THREE.Group();
  bridge.add(mesh(G.bridgeDeck, M.bridge), mesh(G.cables, M.bridge));
  for (const x of [-60, 60]) {
    const t = mesh(G.bridgeTower, M.bridge);
    t.position.x = x;
    bridge.add(t);
  }
  bay.add(bridge);
  group.add(bay);
  const lanterns = [];
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Group();
    s.add(mesh(G.lanternWire, M.lanternWire), new THREE.Mesh(G.lanterns, M.lantern));
    group.add(s);
    lanterns.push(s);
  }

  const randomize = () => {
    placeLamps(lamps, 7.4, 1);
    // 右邊有時候是海灣景色
    const bayView = Math.random() < 0.35;
    bay.visible = bayView;
    bridge.visible = Math.random() < 0.6;
    bridge.position.set(rand(190, 215), 0, -20);
    const cursor = { '-1': -rand(0, 1), 1: -rand(0, 1) };
    houses.forEach((h, i) => {
      const sd = side(i);
      const z = cursor[sd] - 3.3;
      cursor[sd] -= 6.6;
      h.g.visible = z - 3.2 > -L - 1 && !(bayView && sd > 0);
      h.g.position.set(sd * (9.6 + 4.5), 0, z);
      h.g.rotation.y = sd > 0 ? Math.PI : 0;
      const paint = pick(M.paints);
      h.body.material = paint;
      h.bay.material = paint;
      h.roof.material = pick(M.roofs);
      h.body.scale.y = rand(0.95, 1.15);
      h.roof.position.y = (h.body.scale.y - 1) * 8.5;
      h.bay.position.set(4.5 + 0.6, 0, rand(-1.4, 1.4));
      h.trim.position.x = 4.55;
      h.door.position.set(4.55, 0, h.bay.position.z > 0 ? -2.0 : 2.0);
      h.steps.position.set(4.9, 0, h.door.position.z);
    });
    lanterns.forEach((s, i) => {
      s.visible = Math.random() < 0.18;
      s.position.z = -6 - i * 13;
    });
  };
  return { group, randomize };
}

export const EXTRA_BUILDERS4 = {
  la: build_la,
  nyc: build_nyc,
  sf: build_sf,
};

// 第 6～10 個場景：沙漠峽谷、櫻花古都、熱帶雨林、火山熔岩、太空基地
// 每個 build 函式以 Environment 為 this 呼叫，回傳 { group, randomize, tick? }
import * as THREE from 'three';
import { rand, pick, merged, mesh, roofGeometry } from './geo.js';
import {
  strataTexture,
  lavaTexture,
  waterfallTexture,
  plasterTexture,
  roofTileTexture,
  solarTexture,
  hullTexture,
  hullGlowTexture,
} from './textures.js';
import { SEG_LEN } from './config.js';
import { EXTRA_BUILDERS2 } from './scenes-extra2.js';

const L = SEG_LEN;
const HALF = -L / 2;
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
const flat = (color, extra = {}) => std(color, { flatShading: true, ...extra });

// 共用動畫貼圖
const shared = {};

// 每種場景的幾何與材質只建一次（第一次用到時）
function assets(env, id, create) {
  env._extra ??= {};
  env._extra[id] ??= create();
  return env._extra[id];
}

// ======================= 沙漠峽谷 =======================
function desertAssets() {
  const strata = strataTexture();
  strata.repeat.set(3, 1);
  const cactus = [];
  const trunk = new THREE.CylinderGeometry(0.34, 0.4, 4.6, 8);
  cactus.push([trunk, 0, 2.3, 0], [new THREE.SphereGeometry(0.34, 8, 6), 0, 4.6, 0]);
  for (const [side, h, y] of [[1, 1.6, 1.8], [-1, 1.2, 2.5]]) {
    const arm = new THREE.CylinderGeometry(0.24, 0.26, 0.9, 7);
    cactus.push([arm, side * 0.7, y, 0, 0, 0, Math.PI / 2]);
    cactus.push([new THREE.CylinderGeometry(0.24, 0.26, h, 7), side * 1.12, y + h / 2, 0]);
    cactus.push([new THREE.SphereGeometry(0.24, 7, 5), side * 1.12, y + h, 0]);
  }
  const tower = [];
  const leg = new THREE.BoxGeometry(0.22, 5, 0.22);
  for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) tower.push([leg, x, 2.5, z]);
  tower.push([new THREE.BoxGeometry(2.6, 0.16, 2.6), 0, 5, 0]);
  return {
    G: {
      butte: new THREE.CylinderGeometry(15, 19, 26, 7).translate(0, 13, 0),
      butteCap: new THREE.CylinderGeometry(12, 15, 8, 7).translate(0, 30, 0),
      cactus: merged(cactus),
      rock: new THREE.DodecahedronGeometry(1, 0),
      towerFrame: merged(tower),
      tank: new THREE.CylinderGeometry(1.6, 1.6, 2.4, 14).translate(0, 6.3, 0),
      tankRoof: new THREE.ConeGeometry(1.8, 1.1, 14).translate(0, 8.05, 0),
      weed: new THREE.IcosahedronGeometry(0.6, 1),
    },
    M: {
      strata: new THREE.MeshStandardMaterial({ map: strata, roughness: 1, flatShading: true }),
      cactus: flat('#4f8a3c'),
      rock: flat('#c96a3e', { roughness: 1 }),
      wood: std('#8a5a36'),
      weed: new THREE.MeshStandardMaterial({ color: '#a8804a', wireframe: true }),
    },
  };
}

function build_desert() {
  const { G, M } = assets(this, 'desert', desertAssets);
  const group = new THREE.Group();
  const buttes = [];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Group();
    b.add(mesh(G.butte, M.strata, { receive: false }), mesh(G.butteCap, M.strata, { receive: false }));
    group.add(b);
    buttes.push(b);
  }
  const cacti = [];
  for (let i = 0; i < 6; i++) {
    const c = mesh(G.cactus, M.cactus, { cast: true });
    group.add(c);
    cacti.push(c);
  }
  const rocks = [];
  for (let i = 0; i < 8; i++) {
    const r = mesh(G.rock, M.rock, { cast: true });
    group.add(r);
    rocks.push(r);
  }
  const tower = new THREE.Group();
  tower.add(mesh(G.towerFrame, M.wood, { cast: true }), mesh(G.tank, M.wood, { cast: true }), mesh(G.tankRoof, M.rock, { cast: true }));
  group.add(tower);
  const weeds = [];
  for (let i = 0; i < 2; i++) {
    const w = mesh(G.weed, M.weed, { cast: true });
    w.userData = { v: 0 };
    group.add(w);
    weeds.push(w);
  }

  const randomize = () => {
    buttes.forEach((b, i) => {
      const side = i % 2 ? 1 : -1;
      b.visible = Math.random() < 0.65;
      b.position.set(side * rand(45, 110), -1, -rand(0, L));
      b.scale.set(rand(0.7, 1.5), rand(0.6, 1.5), rand(0.7, 1.5));
      b.rotation.y = rand(0, 3);
    });
    cacti.forEach((c, i) => {
      const side = i % 2 ? 1 : -1;
      c.visible = Math.random() < 0.8;
      c.position.set(side * rand(7, 22), 0, -rand(1, L - 1));
      c.rotation.y = rand(0, Math.PI * 2);
      c.scale.setScalar(rand(0.7, 1.3));
    });
    rocks.forEach((r, i) => {
      const side = i % 2 ? 1 : -1;
      r.position.set(side * rand(6.5, 16), 0.2, -rand(0, L));
      r.scale.set(rand(0.6, 2.2), rand(0.4, 1.4), rand(0.6, 2.2));
      r.rotation.set(rand(0, 3), rand(0, 3), 0);
    });
    tower.visible = Math.random() < 0.25;
    const side = Math.random() < 0.5 ? -1 : 1;
    tower.position.set(side * rand(10, 14), 0, -rand(8, L - 8));
    weeds.forEach((w) => {
      w.visible = Math.random() < 0.6;
      w.userData.v = rand(1.5, 3.5) * (Math.random() < 0.5 ? -1 : 1);
      w.position.set(-w.userData.v * 6, 0.6, -rand(2, L - 2));
    });
  };
  // 風滾草滾過軌道
  const tick = (dt, t) => {
    for (const w of weeds) {
      if (!w.visible) continue;
      w.position.x += w.userData.v * dt;
      w.position.y = 0.6 + Math.abs(Math.sin(t * 4 + w.position.z)) * 0.5;
      w.rotation.z -= (w.userData.v / 0.6) * dt;
      if (Math.abs(w.position.x) > 26) w.position.x = -Math.sign(w.userData.v) * 26;
    }
  };
  return { group, randomize, tick };
}

// ======================= 櫻花古都 =======================
function sakuraAssets() {
  const plaster = plasterTexture();
  plaster.repeat.set(L / 4, 1);
  const houseWall = plasterTexture();
  const tiles = roofTileTexture('#3c4450');
  tiles.repeat.set(3, 3);
  const crown = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    crown.push([new THREE.IcosahedronGeometry(rand(1.3, 1.9), 0), Math.cos(a) * 1.6, 4.4 + rand(-0.4, 0.6), Math.sin(a) * 1.6]);
  }
  crown.push([new THREE.IcosahedronGeometry(2, 0), 0, 5.4, 0]);
  const trunk = merged([
    [new THREE.CylinderGeometry(0.22, 0.32, 3.4, 7), 0, 1.7, 0, 0, 0, 0.08],
    [new THREE.CylinderGeometry(0.12, 0.18, 2, 6), 0.6, 3.6, 0, 0, 0, -0.7],
    [new THREE.CylinderGeometry(0.12, 0.18, 2, 6), -0.5, 3.5, 0.3, 0.4, 0, 0.7],
  ]);
  // 大鳥居（跨越軌道，柱子在牆外）
  const toriiRed = merged([
    [new THREE.CylinderGeometry(0.38, 0.45, 9.2, 12), -8.8, 4.6, 0],
    [new THREE.CylinderGeometry(0.38, 0.45, 9.2, 12), 8.8, 4.6, 0],
    [new THREE.BoxGeometry(19.5, 0.5, 0.55), 0, 7.9, 0],
    [new THREE.BoxGeometry(21.5, 0.55, 0.9), 0, 9.05, 0],
    [new THREE.BoxGeometry(0.4, 1.1, 0.4), 0, 8.45, 0],
  ]);
  const toriiBlack = merged([
    [new THREE.BoxGeometry(22.6, 0.4, 1.1), 0, 9.5, 0],
    [new THREE.BoxGeometry(1.4, 0.4, 1.1), -11.5, 9.72, 0, 0, 0, 0.3],
    [new THREE.BoxGeometry(1.4, 0.4, 1.1), 11.5, 9.72, 0, 0, 0, -0.3],
    [new THREE.CylinderGeometry(0.55, 0.6, 0.6, 12), -8.8, 0.3, 0],
    [new THREE.CylinderGeometry(0.55, 0.6, 0.6, 12), 8.8, 0.3, 0],
  ]);
  // 五重塔
  const pagodaBody = [];
  const pagodaRoof = [];
  for (let i = 0; i < 5; i++) {
    const w = 7 - i * 0.9;
    const y = i * 3.4;
    pagodaBody.push([new THREE.BoxGeometry(w * 0.62, 2.4, w * 0.62), 0, y + 1.2, 0]);
    pagodaRoof.push([new THREE.ConeGeometry(w * 0.78, 1.1, 4), 0, y + 2.9, 0, 0, Math.PI / 4, 0]);
  }
  pagodaRoof.push([new THREE.CylinderGeometry(0.12, 0.12, 4, 6), 0, 18.6, 0]);
  const lantern = merged([
    [new THREE.CylinderGeometry(0.5, 0.6, 0.3, 6), 0, 0.15, 0],
    [new THREE.CylinderGeometry(0.16, 0.2, 1.2, 6), 0, 0.9, 0],
    [new THREE.BoxGeometry(0.9, 0.18, 0.9), 0, 1.55, 0],
    [new THREE.ConeGeometry(0.75, 0.5, 4), 0, 2.4, 0, 0, Math.PI / 4, 0],
  ]);
  return {
    G: {
      wall: new THREE.BoxGeometry(0.5, 2.2, L).translate(0, 1.1, HALF),
      wallCap: roofGeometry(1.3, L, 0.55).translate(0, 2.2, HALF),
      trunk,
      crown: merged(crown),
      toriiRed,
      toriiBlack,
      pagodaBody: merged(pagodaBody),
      pagodaRoof: merged(pagodaRoof),
      house: new THREE.BoxGeometry(5, 3.2, 6).translate(0, 1.6, 0),
      houseRoof: roofGeometry(6.4, 7, 1.9).translate(0, 3.2, 0),
      lantern,
      lanternLight: new THREE.BoxGeometry(0.5, 0.45, 0.5).translate(0, 1.87, 0),
    },
    M: {
      wall: new THREE.MeshStandardMaterial({ map: plaster, roughness: 0.9 }),
      houseWall: new THREE.MeshStandardMaterial({ map: houseWall, roughness: 0.9 }),
      tile: new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.6, flatShading: true }),
      bark: std('#4a3228'),
      pink: flat('#f7b2cc', { roughness: 0.8 }),
      pink2: flat('#ffd0e0', { roughness: 0.8 }),
      vermilion: std('#d23a1f', { roughness: 0.55 }),
      black: std('#1c1a1a', { roughness: 0.5 }),
      pagoda: std('#8a3a26'),
      stone: flat('#9a968e', { roughness: 1 }),
      lampGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 2.4, 1.2) }),
    },
  };
}

function build_sakura() {
  const { G, M } = assets(this, 'sakura', sakuraAssets);
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const w = mesh(G.wall, M.wall, { cast: true });
    w.position.x = side * 7.8;
    const cap = mesh(G.wallCap, M.tile, { cast: true });
    cap.position.x = side * 7.8;
    group.add(w, cap);
    for (const z of [-10, -30]) {
      const l = new THREE.Group();
      l.add(mesh(G.lantern, M.stone, { cast: true }), new THREE.Mesh(G.lanternLight, M.lampGlow));
      l.position.set(side * 6.5, 0, z);
      group.add(l);
    }
  }
  const trees = [];
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Group();
    const crown = mesh(G.crown, M.pink, { cast: true });
    t.add(mesh(G.trunk, M.bark, { cast: true }), crown);
    t.userData.crown = crown;
    group.add(t);
    trees.push(t);
  }
  const torii = new THREE.Group();
  torii.add(mesh(G.toriiRed, M.vermilion, { cast: true }), mesh(G.toriiBlack, M.black, { cast: true }));
  torii.position.z = -18;
  group.add(torii);
  const pagoda = new THREE.Group();
  pagoda.add(mesh(G.pagodaBody, M.pagoda), mesh(G.pagodaRoof, M.tile));
  group.add(pagoda);
  const houses = [];
  for (let i = 0; i < 4; i++) {
    const h = new THREE.Group();
    h.add(mesh(G.house, M.houseWall, { cast: true }), mesh(G.houseRoof, M.tile, { cast: true }));
    group.add(h);
    houses.push(h);
  }
  const randomize = () => {
    trees.forEach((t, i) => {
      const side = i % 2 ? 1 : -1;
      t.position.set(side * rand(9, 15), 0, -rand(2, L - 2));
      t.rotation.y = rand(0, Math.PI * 2);
      t.scale.setScalar(rand(0.85, 1.3));
      t.userData.crown.material = Math.random() < 0.5 ? M.pink : M.pink2;
      t.visible = Math.random() < 0.9;
    });
    torii.visible = Math.random() < 0.33;
    pagoda.visible = Math.random() < 0.3;
    pagoda.position.set((Math.random() < 0.5 ? -1 : 1) * rand(32, 50), 0, -rand(5, L - 5));
    houses.forEach((h, i) => {
      const side = i % 2 ? 1 : -1;
      h.position.set(side * rand(17, 22), 0, -6 - (i >> 1) * 20 - rand(0, 6));
      h.rotation.y = rand(-0.1, 0.1);
      h.visible = Math.random() < 0.85;
    });
  };
  return { group, randomize };
}

// ======================= 熱帶雨林 =======================
function jungleAssets() {
  const fall = waterfallTexture();
  fall.repeat.set(1, 2);
  shared.waterfall = fall;
  const canopy = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    canopy.push([new THREE.IcosahedronGeometry(rand(3, 4.2), 0), Math.cos(a) * 3, 16 + rand(-1, 1.5), Math.sin(a) * 3]);
  }
  canopy.push([new THREE.IcosahedronGeometry(4.5, 0), 0, 18.5, 0]);
  const trunk = [[new THREE.CylinderGeometry(0.6, 0.95, 16, 8), 0, 8, 0]];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    trunk.push([new THREE.BoxGeometry(0.25, 2.4, 1.6), Math.cos(a) * 0.9, 1.1, Math.sin(a) * 0.9, 0, -a, 0]);
  }
  const vines = [];
  for (let k = 0; k < 5; k++) {
    const len = rand(5, 10);
    vines.push([new THREE.CylinderGeometry(0.05, 0.05, len, 4), rand(-3.5, 3.5), 15 - len / 2, rand(-3.5, 3.5)]);
  }
  return {
    G: {
      trunk: merged(trunk),
      canopy: merged(canopy),
      vines: merged(vines),
      bush: new THREE.IcosahedronGeometry(1.2, 0),
      flower: new THREE.SphereGeometry(0.16, 6, 5),
      rock: new THREE.DodecahedronGeometry(1, 0),
      cliff: merged([
        [new THREE.BoxGeometry(9, 15, 14), 0, 7.5, 0],
        [new THREE.DodecahedronGeometry(6, 0), -1, 14, -3, 0, 0, 0, 1, 0.5, 1.2],
        [new THREE.DodecahedronGeometry(5, 0), 0, 13.5, 4, 0, 0, 0, 1, 0.5, 1],
      ]),
      moss: new THREE.IcosahedronGeometry(3, 0).scale(1.2, 0.5, 1.2),
      fall: new THREE.PlaneGeometry(5, 14.5).rotateY(Math.PI / 2).translate(4.55, 7.3, 0),
      pool: new THREE.CircleGeometry(4, 16).rotateX(-Math.PI / 2).translate(6.5, 0.05, 0),
    },
    M: {
      bark: std('#5a4632'),
      canopy: flat('#2f7a3a'),
      canopy2: flat('#3f8f35'),
      vine: std('#3d6b2a'),
      bush: flat('#4a9a3c'),
      flowers: ['#ff4d6d', '#ffd23f', '#c77dff', '#ff8a3d'].map((c) => std(c, { emissive: c, emissiveIntensity: 0.25 })),
      rock: flat('#4f5a45', { roughness: 1 }),
      fall: new THREE.MeshBasicMaterial({ map: fall, transparent: true, color: new THREE.Color(1.3, 1.3, 1.3) }),
      pool: new THREE.MeshStandardMaterial({ color: '#2f8fa8', roughness: 0.1, metalness: 0.2 }),
    },
  };
}

function build_jungle() {
  const { G, M } = assets(this, 'jungle', jungleAssets);
  const group = new THREE.Group();
  const trees = [];
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Group();
    const c = mesh(G.canopy, M.canopy, { cast: true });
    t.add(mesh(G.trunk, M.bark, { cast: true }), c, mesh(G.vines, M.vine));
    t.userData.canopy = c;
    group.add(t);
    trees.push(t);
  }
  const ferns = [];
  for (let i = 0; i < 10; i++) {
    const f = mesh(this.G.palmLeaves, this.mat.palmLeaf, { cast: true });
    group.add(f);
    ferns.push(f);
  }
  const bushes = [];
  for (let i = 0; i < 8; i++) {
    const b = mesh(G.bush, M.bush, { cast: true });
    group.add(b);
    bushes.push(b);
  }
  const flowers = [];
  for (let i = 0; i < 14; i++) {
    const f = new THREE.Mesh(G.flower, M.flowers[i % M.flowers.length]);
    group.add(f);
    flowers.push(f);
  }
  const falls = new THREE.Group();
  falls.add(mesh(G.cliff, M.rock), new THREE.Mesh(G.fall, M.fall), mesh(G.pool, M.pool));
  for (const [x, z] of [[-1, -4], [1.5, 3], [-2, 5]]) {
    const m = mesh(G.moss, M.canopy2);
    m.position.set(x, 16.5, z);
    falls.add(m);
  }
  group.add(falls);
  const randomize = () => {
    trees.forEach((t, i) => {
      const side = i % 2 ? 1 : -1;
      t.position.set(side * rand(9, 24), 0, -rand(2, L - 2));
      t.rotation.y = rand(0, Math.PI * 2);
      t.scale.setScalar(rand(0.8, 1.2));
      t.userData.canopy.material = Math.random() < 0.5 ? M.canopy : M.canopy2;
    });
    ferns.forEach((f, i) => {
      const side = i % 2 ? 1 : -1;
      f.position.set(side * rand(5.8, 12) - 0.5, -3.1 * 0.55, -rand(0, L));
      f.scale.setScalar(rand(0.45, 0.65));
      f.rotation.y = rand(0, Math.PI * 2);
    });
    bushes.forEach((b, i) => {
      const side = i % 2 ? 1 : -1;
      b.position.set(side * rand(6.5, 14), 0.4, -rand(0, L));
      b.scale.set(rand(0.8, 1.8), rand(0.6, 1.2), rand(0.8, 1.8));
    });
    flowers.forEach((f, i) => {
      const side = i % 2 ? 1 : -1;
      f.position.set(side * rand(5.8, 11), rand(0.2, 0.9), -rand(0, L));
    });
    falls.visible = Math.random() < 0.3;
    falls.position.set(-21, 0, -rand(10, L - 10));
  };
  return { group, randomize };
}

// ======================= 火山熔岩 =======================
function volcanoAssets() {
  const lava = lavaTexture();
  lava.repeat.set(2, 8);
  shared.lava = lava;
  const smoke = [];
  for (let i = 0; i < 5; i++) smoke.push([new THREE.IcosahedronGeometry(rand(10, 16), 1), rand(-8, 8), 70 + i * 13, rand(-8, 8)]);
  return {
    G: {
      lava: new THREE.PlaneGeometry(9, L).rotateX(-Math.PI / 2).translate(0, 0.04, HALF),
      bank: new THREE.BoxGeometry(1.2, 0.5, L).translate(0, 0.25, HALF),
      rock: new THREE.DodecahedronGeometry(1, 0),
      spike: new THREE.ConeGeometry(0.8, 3.5, 5).translate(0, 1.6, 0),
      volcano: new THREE.CylinderGeometry(14, 70, 62, 10, 1, true).translate(0, 31, 0),
      crater: new THREE.CylinderGeometry(13, 13, 1, 16).translate(0, 61, 0),
      smoke: merged(smoke),
    },
    M: {
      lava: new THREE.MeshStandardMaterial({ map: lava, emissiveMap: lava, emissive: '#ffffff', emissiveIntensity: 2.2, roughness: 0.6 }),
      bank: flat('#241c1b', { roughness: 0.9 }),
      rock: flat('#2b2322', { roughness: 0.95 }),
      obsidian: flat('#15101a', { roughness: 0.2, metalness: 0.3 }),
      volcano: flat('#2a1f1c', { roughness: 1, side: THREE.DoubleSide }),
      crater: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.3, 0.3) }),
      smoke: flat('#3a302e', { roughness: 1, transparent: true, opacity: 0.8 }),
    },
  };
}

function build_volcano() {
  const { G, M } = assets(this, 'volcano', volcanoAssets);
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const lava = new THREE.Mesh(G.lava, M.lava);
    lava.position.x = side * 11;
    const bank = mesh(G.bank, M.bank, { cast: true });
    bank.position.x = side * 6.1;
    const bank2 = mesh(G.bank, M.bank);
    bank2.position.x = side * 15.8;
    group.add(lava, bank, bank2);
  }
  const rocks = [];
  for (let i = 0; i < 12; i++) {
    const r = mesh(G.rock, M.rock, { cast: true });
    group.add(r);
    rocks.push(r);
  }
  const spikes = [];
  for (let i = 0; i < 6; i++) {
    const s = mesh(G.spike, M.obsidian, { cast: true });
    group.add(s);
    spikes.push(s);
  }
  const volcanoes = [];
  for (let i = 0; i < 2; i++) {
    const v = new THREE.Group();
    v.add(mesh(G.volcano, M.volcano, { receive: false }), new THREE.Mesh(G.crater, M.crater), mesh(G.smoke, M.smoke, { receive: false }));
    group.add(v);
    volcanoes.push(v);
  }
  const randomize = () => {
    rocks.forEach((r, i) => {
      const side = i % 2 ? 1 : -1;
      const inLava = i < 4;
      r.position.set(side * (inLava ? rand(8, 14) : rand(16.5, 32)), inLava ? 0 : rand(0, 1), -rand(0, L));
      r.scale.set(rand(0.8, 3), rand(0.5, 2.5), rand(0.8, 3));
      r.rotation.set(rand(0, 3), rand(0, 3), 0);
    });
    spikes.forEach((s, i) => {
      const side = i % 2 ? 1 : -1;
      s.position.set(side * rand(17, 26), 0, -rand(0, L));
      s.scale.set(rand(0.7, 1.4), rand(0.7, 2), rand(0.7, 1.4));
      s.rotation.set(rand(-0.2, 0.2), rand(0, 3), rand(-0.2, 0.2));
    });
    volcanoes.forEach((v, i) => {
      const side = i ? 1 : -1;
      v.visible = Math.random() < 0.5;
      v.position.set(side * rand(90, 140), -2, -rand(0, L));
      v.scale.setScalar(rand(0.8, 1.3));
    });
  };
  return { group, randomize };
}

// ======================= 太空基地 =======================
function spaceAssets() {
  const solar = solarTexture();
  solar.repeat.set(3, 1);
  const hull = hullTexture();
  hull.repeat.set(2, 1);
  const hullGlow = hullGlowTexture();
  hullGlow.repeat.set(2, 1);
  const dish = merged([
    [new THREE.CylinderGeometry(0.15, 0.2, 5, 8), 0, 2.5, 0],
    [new THREE.BoxGeometry(0.6, 0.6, 0.6), 0, 5, 0],
  ]);
  const panelPosts = merged([
    [new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), -2.5, 0.8, 0],
    [new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), 2.5, 0.8, 0],
  ]);
  const antenna = merged([
    [new THREE.CylinderGeometry(0.1, 0.25, 14, 6), 0, 7, 0],
    [new THREE.BoxGeometry(2, 0.1, 0.1), 0, 10, 0],
    [new THREE.BoxGeometry(1.4, 0.1, 0.1), 0, 12, 0],
  ]);
  return {
    G: {
      barrier: new THREE.BoxGeometry(0.5, 1.2, L).translate(0, 0.6, HALF),
      strip: new THREE.BoxGeometry(0.1, 0.1, L).translate(0, 1.25, HALF),
      dome: new THREE.SphereGeometry(7, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      domeRing: new THREE.CylinderGeometry(7.2, 7.4, 0.6, 28).translate(0, 0.3, 0),
      domeCore: new THREE.CylinderGeometry(1.2, 1.6, 5, 10).translate(0, 2.5, 0),
      module: new THREE.CylinderGeometry(2.2, 2.2, 10, 20, 1).rotateZ(Math.PI / 2).translate(0, 2.4, 0),
      moduleCap: merged([
        [new THREE.SphereGeometry(2.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 5, 2.4, 0, 0, 0, -Math.PI / 2],
        [new THREE.SphereGeometry(2.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), -5, 2.4, 0, 0, 0, Math.PI / 2],
      ]),
      dish,
      dishBowl: new THREE.SphereGeometry(2.2, 18, 8, 0, Math.PI * 2, 0, 1.0).scale(1, 0.5, 1).rotateX(0.8).translate(0, 5.6, 0.3),
      panel: new THREE.BoxGeometry(6, 0.08, 2.2).rotateX(-0.5).translate(0, 1.7, 0),
      panelPosts,
      antenna,
      beacon: new THREE.SphereGeometry(0.25, 8, 6).translate(0, 14.1, 0),
      crater: new THREE.TorusGeometry(3, 0.6, 6, 18).rotateX(Math.PI / 2).scale(1, 0.4, 1),
      craterFloor: new THREE.CircleGeometry(3, 18).rotateX(-Math.PI / 2).translate(0, 0.02, 0),
      rock: new THREE.DodecahedronGeometry(1, 0),
      planet: new THREE.SphereGeometry(60, 48, 24),
      ring: new THREE.RingGeometry(78, 118, 64).rotateX(-Math.PI / 2),
      moon: new THREE.SphereGeometry(14, 24, 12),
    },
    M: {
      barrier: std('#9aa3b5', { metalness: 0.7, roughness: 0.35 }),
      strip: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.2, 4) }),
      glass: new THREE.MeshStandardMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.4, depthWrite: false }),
      metal: std('#c9ced6', { metalness: 0.7, roughness: 0.35 }),
      core: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 3, 1.4) }),
      hull: new THREE.MeshStandardMaterial({ map: hull, emissiveMap: hullGlow, emissive: '#ffffff', emissiveIntensity: 1.8, roughness: 0.4, metalness: 0.4 }),
      solar: new THREE.MeshStandardMaterial({ map: solar, roughness: 0.2, metalness: 0.6 }),
      beacon: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.4, 0.3) }),
      crater: flat('#7d7b78', { roughness: 1 }),
      craterFloor: std('#5f5d5a', { roughness: 1 }),
      rock: flat('#6f6d6a', { roughness: 1 }),
      planet: new THREE.MeshStandardMaterial({ color: '#d9a066', roughness: 1, fog: false }),
      ring: new THREE.MeshBasicMaterial({ color: '#e8d2a8', transparent: true, opacity: 0.55, side: THREE.DoubleSide, fog: false }),
      moon: new THREE.MeshStandardMaterial({ color: '#b8c4d8', roughness: 1, fog: false }),
    },
  };
}

function build_space() {
  const { G, M } = assets(this, 'space', spaceAssets);
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const b = mesh(G.barrier, M.barrier, { cast: true });
    b.position.x = side * 7.8;
    const s = new THREE.Mesh(G.strip, M.strip);
    s.position.x = side * 7.8;
    group.add(b, s);
  }
  const domes = [];
  for (let i = 0; i < 2; i++) {
    const d = new THREE.Group();
    d.add(mesh(G.domeRing, M.metal), new THREE.Mesh(G.domeCore, M.core), new THREE.Mesh(G.dome, M.glass));
    group.add(d);
    domes.push(d);
  }
  const modules = [];
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Group();
    m.add(mesh(G.module, M.hull, { cast: true }), mesh(G.moduleCap, M.metal, { cast: true }));
    group.add(m);
    modules.push(m);
  }
  const panels = [];
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Group();
    p.add(mesh(G.panel, M.solar, { cast: true }), mesh(G.panelPosts, M.metal));
    group.add(p);
    panels.push(p);
  }
  const dish = new THREE.Group();
  dish.add(mesh(G.dish, M.metal, { cast: true }), mesh(G.dishBowl, M.metal, { cast: true }));
  group.add(dish);
  const antenna = new THREE.Group();
  antenna.add(mesh(G.antenna, M.metal, { cast: true }), new THREE.Mesh(G.beacon, M.beacon));
  group.add(antenna);
  const craters = [];
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Group();
    c.add(mesh(G.crater, M.crater), mesh(G.craterFloor, M.craterFloor));
    group.add(c);
    craters.push(c);
  }
  const rocks = [];
  for (let i = 0; i < 8; i++) {
    const r = mesh(G.rock, M.rock, { cast: true });
    group.add(r);
    rocks.push(r);
  }
  const randomize = () => {
    domes.forEach((d, i) => {
      const side = i ? 1 : -1;
      d.visible = Math.random() < 0.6;
      d.position.set(side * rand(19, 30), 0, -rand(8, L - 8));
    });
    modules.forEach((m, i) => {
      const side = i ? -1 : 1;
      m.visible = Math.random() < 0.6;
      m.position.set(side * rand(12, 16), 0, -rand(6, L - 6));
      m.rotation.y = Math.PI / 2 + rand(-0.2, 0.2);
    });
    panels.forEach((p, i) => {
      const side = i % 2 ? 1 : -1;
      p.position.set(side * rand(10, 13), 0, -5 - (i >> 1) * 20 - rand(0, 8));
      p.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      p.visible = Math.random() < 0.7;
    });
    const s1 = Math.random() < 0.5 ? -1 : 1;
    dish.visible = Math.random() < 0.4;
    dish.position.set(s1 * rand(11, 14), 0, -rand(5, L - 5));
    dish.rotation.y = s1 > 0 ? -Math.PI / 2 : Math.PI / 2;
    antenna.visible = Math.random() < 0.3;
    antenna.position.set(-s1 * rand(10, 13), 0, -rand(5, L - 5));
    craters.forEach((c, i) => {
      const side = i % 2 ? 1 : -1;
      c.position.set(side * rand(9, 30), 0, -rand(0, L));
      c.scale.setScalar(rand(0.6, 2));
    });
    rocks.forEach((r, i) => {
      const side = i % 2 ? 1 : -1;
      r.position.set(side * rand(6.5, 25), 0.1, -rand(0, L));
      r.scale.set(rand(0.3, 1.2), rand(0.2, 0.8), rand(0.3, 1.2));
      r.rotation.set(rand(0, 3), rand(0, 3), 0);
    });
  };
  return { group, randomize };
}

export const EXTRA_BUILDERS = {
  desert: build_desert,
  sakura: build_sakura,
  jungle: build_jungle,
  volcano: build_volcano,
  space: build_space,
  ...EXTRA_BUILDERS2,
};

// 全域動畫：熔岩流動、瀑布、太空場景天上的行星
export function extraUpdate(env, dt, playerZ) {
  const t = env.time;
  if (shared.lava) shared.lava.offset.set(Math.sin(t * 0.2) * 0.05, t * 0.03);
  if (shared.waterfall) shared.waterfall.offset.y = t * 1.2;
  const inSpace = env.themeAt(playerZ) === 'space';
  if (inSpace && !env.planet) {
    const { G, M } = assets(env, 'space', spaceAssets);
    const sky = new THREE.Group();
    const planet = new THREE.Mesh(G.planet, M.planet);
    const ring = new THREE.Mesh(G.ring, M.ring);
    ring.rotation.set(0.35, 0, 0.25);
    const moon = new THREE.Mesh(G.moon, M.moon);
    moon.position.set(230, -40, 60);
    sky.add(planet, ring, moon);
    for (const o of sky.children) o.renderOrder = -0.5;
    env.scene.add(sky);
    env.planet = sky;
  }
  if (env.planet) {
    env.planet.visible = inSpace;
    env.planet.position.set(-170, 120, playerZ - 430);
    env.planet.rotation.y = t * 0.01;
  }
}

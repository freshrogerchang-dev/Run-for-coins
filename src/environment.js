// 無限循環的鐵道場景。每一段路（40m）共用軌道，外觀依主題切換：
// 城市鐵道、海岸線、地鐵隧道、雪山列車、霓虹夜城（其餘五個場景在 scenes-extra.js）
import * as THREE from 'three';
import { rand, pick, merged, mesh, roofGeometry, fixNormals } from './geo.js';
import { EXTRA_BUILDERS, extraUpdate } from './scenes-extra.js';
import {
  gravelTexture,
  woodTexture,
  wallTexture,
  tileTexture,
  tactileTexture,
  facadeTextures,
  signTexture,
  posterTexture,
  sandTexture,
  snowTexture,
  waterNormalTexture,
  tunnelTexture,
  neonSignTexture,
  plankTexture,
  glowTexture,
  moonTexture,
  roadTexture,
} from './textures.js';
import { LANES, SEG_LEN, SEG_COUNT } from './config.js';
import { THEMES, THEME_ORDER, TOUR_LEN } from './themes.js';

const L = SEG_LEN;
const HALF = -L / 2;

// 讓大樓貼圖的窗戶尺寸固定（1 個貼圖單位 = 12m）
function buildingGeometry(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const faceSize = [
    [d, h], [d, h], [0, 0], [0, 0], [w, h], [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    const [fw, fh] = faceSize[f];
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      if (fw === 0) uv.setXY(i, 0.02, 0.98);
      else uv.setXY(i, (uv.getX(i) * fw) / 12, (uv.getY(i) * fh) / 12);
    }
  }
  g.translate(0, h / 2, 0);
  return g;
}

// 海邊左側山坡的高度
const HILL = [
  [-7.6, 0],
  [-7.6, 1.6],
  [-12, 2.6],
  [-22, 7],
  [-40, 14],
  [-70, 17],
];
function hillY(x) {
  for (let i = 1; i < HILL.length; i++) {
    const [x0, y0] = HILL[i - 1];
    const [x1, y1] = HILL[i];
    if (x <= x0 && x >= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
  }
  return HILL[HILL.length - 1][1];
}

const NEON_SIGNS = [
  ['拉麵', '#ff3d8b', true],
  ['COIN', '#ffd23f', false],
  ['酷跑', '#3dfcff', true],
  ['HOTEL', '#ff5ef1', false],
  ['24H', '#7dff6a', false],
  ['卡拉OK', '#ff8a3d', true],
  ['咖啡', '#3dfcff', true],
  ['GAME', '#b45eff', false],
  ['壽司', '#ff3d3d', true],
  ['BAR', '#3d9bff', false],
];

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.segments = [];
    this.stationRun = 0;
    this.mode = 'city';
    this.time = 0;
    this.buildMaterials();
    this.buildGeometries();
    for (let i = 0; i < SEG_COUNT; i++) this.segments.push(this.createSegment());
    this.reset();
  }

  // ---------- 主題排程 ----------
  setMode(mode) {
    this.mode = mode;
  }

  themeAt(z) {
    if (this.mode !== 'tour') return this.mode;
    const idx = Math.floor(Math.max(0, -z) / TOUR_LEN);
    return THEME_ORDER[idx % THEME_ORDER.length];
  }

  // ---------- 材質 ----------
  buildMaterials() {
    const wood = woodTexture();
    const tile = tileTexture();
    tile.repeat.set(3, 20);
    const tactile = tactileTexture();
    tactile.repeat.set(1, 40);
    this.glowTex = glowTexture();
    const M = {
      sleeper: new THREE.MeshStandardMaterial({ map: wood, roughness: 0.85 }),
      rail: new THREE.MeshStandardMaterial({ color: '#b9bec5', roughness: 0.28, metalness: 0.9 }),
      railBase: new THREE.MeshStandardMaterial({ color: '#5b4234', roughness: 0.8, metalness: 0.4 }),
      concrete: new THREE.MeshStandardMaterial({ color: '#a8a39b', roughness: 0.9 }),
      darkConcrete: new THREE.MeshStandardMaterial({ color: '#6f6b65', roughness: 0.9 }),
      steel: new THREE.MeshStandardMaterial({ color: '#56606b', roughness: 0.45, metalness: 0.75 }),
      wire: new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.5, metalness: 0.6 }),
      tile: new THREE.MeshStandardMaterial({ map: tile, roughness: 0.55 }),
      tactile: new THREE.MeshStandardMaterial({ map: tactile, roughness: 0.6 }),
      white: new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.5 }),
      canopy: new THREE.MeshStandardMaterial({ color: '#dfe3e6', roughness: 0.4, metalness: 0.5 }),
      lightStrip: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.0, 2.6) }),
      bench: new THREE.MeshStandardMaterial({ color: '#e0572f', roughness: 0.5 }),
      leaf: new THREE.MeshStandardMaterial({ color: '#4f8f3a', roughness: 0.85, flatShading: true }),
      leaf2: new THREE.MeshStandardMaterial({ color: '#6aa84f', roughness: 0.85, flatShading: true }),
      trunk: new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 0.9 }),
      roofTop: new THREE.MeshStandardMaterial({ color: '#5c5f63', roughness: 0.8 }),
      // 海邊
      grass: new THREE.MeshStandardMaterial({ color: '#86b95a', roughness: 0.95, flatShading: true }),
      rock: new THREE.MeshStandardMaterial({ color: '#8f8a82', roughness: 0.9, flatShading: true }),
      palmTrunk: new THREE.MeshStandardMaterial({ color: '#9b7650', roughness: 0.9, flatShading: true }),
      palmLeaf: new THREE.MeshStandardMaterial({ color: '#3f9e45', roughness: 0.7, flatShading: true, side: THREE.DoubleSide }),
      railing: new THREE.MeshStandardMaterial({ color: '#eef3f6', roughness: 0.35, metalness: 0.4 }),
      foam: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false }),
      sail: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, side: THREE.DoubleSide }),
      hull: new THREE.MeshStandardMaterial({ color: '#27496d', roughness: 0.5 }),
      red: new THREE.MeshStandardMaterial({ color: '#d7263d', roughness: 0.5 }),
      lampWarm: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.2, 1.8) }),
      // 雪地
      pine: new THREE.MeshStandardMaterial({ color: '#2f5d46', roughness: 0.9, flatShading: true }),
      snowCap: new THREE.MeshStandardMaterial({ color: '#f7fbff', roughness: 0.8, flatShading: true }),
      mountain: new THREE.MeshStandardMaterial({ color: '#7d8ea3', roughness: 1, flatShading: true }),
      fence: new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 0.9 }),
      carrot: new THREE.MeshStandardMaterial({ color: '#ff7a1a', roughness: 0.6 }),
      coal: new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.6 }),
      window: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.1, 1.1) }),
      // 隧道
      tunnelLamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.1, 1.9) }),
      tunnelCeil: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.6, 3) }),
      exitSign: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 3.2, 1.2) }),
      cable: new THREE.MeshStandardMaterial({ color: '#1d1d1f', roughness: 0.6 }),
      portal: new THREE.MeshStandardMaterial({ color: '#8d8579', roughness: 0.95, flatShading: true }),
      portalHill: new THREE.MeshStandardMaterial({ color: '#6f8a5a', roughness: 1, flatShading: true }),
      // 霓虹
      nightWall: new THREE.MeshStandardMaterial({ color: '#2d2838', roughness: 0.7 }),
      neonPink: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.5, 2.4) }),
      neonCyan: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 3.4, 4) }),
      neonYellow: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 0.6) }),
    };

    // 地面與道床：每個主題一組
    this.groundMats = {};
    this.ballastMats = {};
    const gravel = gravelTexture();
    gravel.repeat.set(15, 9);
    const ballastTex = gravelTexture();
    ballastTex.repeat.set(1, 18);
    const snow = snowTexture();
    snow.repeat.set(20, 6);
    const sandGround = sandTexture();
    sandGround.repeat.set(18, 5);
    const moon = moonTexture();
    moon.repeat.set(10, 5);
    const groundTex = { gravel, snow, sand: sandGround, moon };
    for (const id of THEME_ORDER) {
      const t = THEMES[id];
      this.groundMats[id] = new THREE.MeshStandardMaterial({
        map: groundTex[t.ground.tex] || gravel,
        color: t.ground.color,
        roughness: t.ground.roughness,
      });
      this.ballastMats[id] = new THREE.MeshStandardMaterial({
        map: ballastTex,
        color: t.ballast,
        roughness: id === 'neon' ? 0.4 : 0.95,
      });
    }

    // 非鐵道場景的路面
    this.roadMats = {};
    for (const id of THEME_ORDER) {
      const track = THEMES[id].track;
      if (track === 'rail') continue;
      const r = roadTexture(track);
      r.map.repeat.set(1, L / 8);
      r.emissiveMap.repeat.set(1, L / 8);
      this.roadMats[id] = new THREE.MeshStandardMaterial({
        map: r.map,
        emissiveMap: r.emissive ? r.emissiveMap : null,
        emissive: r.emissive ? '#ffffff' : '#000000',
        emissiveIntensity: r.emissive ? 1.6 : 0,
        roughness: track === 'neonroad' ? 0.3 : track === 'metal' ? 0.4 : 0.9,
        metalness: track === 'metal' ? 0.5 : 0,
      });
    }

    this.wallMats = [0, 1, 2, 3].map(() => {
      const t = wallTexture();
      t.repeat.set(L / 16, 1);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 });
    });
    const facades = facadeTextures();
    this.facadeMats = facades.map(
      (f) =>
        new THREE.MeshStandardMaterial({
          map: f.map,
          emissiveMap: f.emissiveMap,
          emissive: '#ffffff',
          emissiveIntensity: 0.9,
          roughness: 0.6,
          metalness: 0.15,
        }),
    );
    // 夜晚大樓：牆面變暗、窗戶發光
    this.nightFacadeMats = facades.flatMap((f) =>
      ['#ffcf8a', '#9fd8ff', '#ff9ee0'].map(
        (glow) =>
          new THREE.MeshStandardMaterial({
            map: f.map,
            color: '#3a3452',
            emissiveMap: f.emissiveMap,
            emissive: glow,
            emissiveIntensity: 2.6,
            roughness: 0.45,
            metalness: 0.3,
          }),
      ),
    );
    this.signMat = new THREE.MeshStandardMaterial({
      map: signTexture('金幣大道站', 'COIN AVENUE'),
      emissive: '#ffffff',
      emissiveMap: signTexture('金幣大道站', 'COIN AVENUE'),
      emissiveIntensity: 0.35,
      roughness: 0.4,
    });
    this.posterMats = [0, 1, 2, 3].map(
      (i) =>
        new THREE.MeshStandardMaterial({
          map: posterTexture(i),
          roughness: 0.35,
          emissive: '#ffffff',
          emissiveMap: posterTexture(i),
          emissiveIntensity: 0.25,
        }),
    );

    // 海水
    this.waterNormal = waterNormalTexture();
    this.waterNormal.repeat.set(60, 5);
    M.water = new THREE.MeshStandardMaterial({
      color: '#1b8fc9',
      roughness: 0.08,
      metalness: 0.25,
      normalMap: this.waterNormal,
      normalScale: new THREE.Vector2(0.7, 0.7),
    });
    const sand = sandTexture();
    sand.repeat.set(4, 6);
    M.sand = new THREE.MeshStandardMaterial({ map: sand, color: '#d2bf9a', roughness: 1 });
    this.houseMats = ['#8fd3e8', '#ffd6a5', '#f7a8b8', '#fff3b0', '#b8e0a8'].map(
      (c) => new THREE.MeshStandardMaterial({ map: plankTexture(c), roughness: 0.8 }),
    );
    this.roofMats = ['#d0583a', '#2f6fb0', '#e8e2d0'].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, flatShading: true }),
    );
    this.umbrellaMats = ['#ff4d4d', '#ffd23f', '#3d9bff', '#ff7ac8'].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, side: THREE.DoubleSide, flatShading: true }),
    );
    M.logWall = new THREE.MeshStandardMaterial({ map: plankTexture('#7a5234'), roughness: 0.9 });

    const tun = tunnelTexture();
    tun.repeat.set(3, L / 8);
    M.tunnel = new THREE.MeshStandardMaterial({ map: tun, roughness: 0.92, side: THREE.DoubleSide });
    const tunWall = tunnelTexture();
    tunWall.repeat.set(L / 8, 0.4);
    M.tunnelWall = new THREE.MeshStandardMaterial({ map: tunWall, roughness: 0.92 });

    this.neonSignMats = NEON_SIGNS.map(
      ([text, color, vertical]) =>
        new THREE.MeshBasicMaterial({
          map: neonSignTexture(text, color, vertical),
          color: new THREE.Color(1.7, 1.7, 1.7),
        }),
    );
    this.neonSignVertical = NEON_SIGNS.map((s) => s[2]);
    this.mat = M;
  }

  buildGeometries() {
    const G = {};
    G.ground = new THREE.PlaneGeometry(90, L).rotateX(-Math.PI / 2).translate(0, 0, HALF);
    G.road = new THREE.BoxGeometry(8.4, 0.2, L).translate(0, 0.1, HALF);

    // 道床（梯形碎石堆）
    const shape = new THREE.Shape();
    shape.moveTo(-1.55, 0);
    shape.lineTo(1.55, 0);
    shape.lineTo(1.25, 0.12);
    shape.lineTo(-1.25, 0.12);
    shape.closePath();
    const bed = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false });
    bed.translate(0, 0, -L);
    const pos = bed.attributes.position;
    const uv = bed.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 3 + 0.5, -pos.getZ(i) / L);
    G.ballast = merged(LANES.map((x) => [bed, x]));

    const railProfile = new THREE.BoxGeometry(0.08, 0.13, L);
    const railFoot = new THREE.BoxGeometry(0.2, 0.03, L);
    const rails = [];
    const feet = [];
    for (const x of LANES) {
      for (const s of [-0.72, 0.72]) {
        rails.push([railProfile, x + s, 0.265, HALF]);
        feet.push([railFoot, x + s, 0.215, HALF]);
      }
    }
    G.rails = merged(rails);
    G.railFeet = merged(feet);
    G.sleeper = new THREE.BoxGeometry(2.2, 0.1, 0.26);

    // 電車線 + 門型架
    const wires = [];
    const wireGeo = new THREE.CylinderGeometry(0.02, 0.02, L, 4).rotateX(Math.PI / 2);
    for (const x of LANES) {
      wires.push([wireGeo, x, 5.75, HALF]);
      wires.push([wireGeo, x, 6.2, HALF]);
    }
    G.wires = merged(wires);
    const gantry = [];
    const pole = new THREE.CylinderGeometry(0.13, 0.16, 6.6, 10);
    const beam = new THREE.BoxGeometry(10, 0.28, 0.28);
    const hanger = new THREE.CylinderGeometry(0.025, 0.025, 0.5, 4);
    const insul = new THREE.CylinderGeometry(0.07, 0.07, 0.2, 8);
    for (const z of [-8, -28]) {
      gantry.push([pole, -4.8, 3.3, z], [pole, 4.8, 3.3, z]);
      gantry.push([beam, 0, 6.55, z]);
      for (const x of LANES) gantry.push([hanger, x, 6.3, z], [insul, x, 6.1, z]);
    }
    G.gantry = merged(gantry);

    // ----- 城市 -----
    G.wall = new THREE.BoxGeometry(0.6, 4.4, L).translate(0, 2.2, HALF);
    G.coping = new THREE.BoxGeometry(0.9, 0.22, L).translate(0, 4.5, HALF);
    G.trunk = new THREE.CylinderGeometry(0.18, 0.26, 3, 7).translate(0, 1.5, 0);
    G.crown = merged([
      [new THREE.IcosahedronGeometry(1.9, 0), 0, 4.2, 0],
      [new THREE.IcosahedronGeometry(1.4, 0), 0.6, 5.4, 0.3],
    ]);
    G.platform = new THREE.BoxGeometry(6.2, 1.05, L).translate(0, 0.525, HALF);
    G.platformTop = new THREE.PlaneGeometry(6.2, L).rotateX(-Math.PI / 2).translate(0, 1.052, HALF);
    G.tactile = new THREE.PlaneGeometry(0.5, L).rotateX(-Math.PI / 2).translate(0, 1.056, HALF);
    G.edgeLine = new THREE.BoxGeometry(0.12, 0.03, L).translate(0, 1.06, HALF);
    const pillar = new THREE.CylinderGeometry(0.16, 0.2, 4.7, 12);
    G.pillars = merged([-5, -15, -25, -35].map((z) => [pillar, 0, 1.05 + 2.35, z]));
    G.canopy = new THREE.BoxGeometry(7.2, 0.24, L).translate(0, 0, HALF);
    G.canopyBeam = merged([-5, -15, -25, -35].map((z) => [new THREE.BoxGeometry(7.2, 0.35, 0.3), 0, -0.25, z]));
    G.lightStrip = new THREE.BoxGeometry(0.22, 0.05, L).translate(0, 0, HALF);
    G.backWall = new THREE.BoxGeometry(0.5, 6.2, L).translate(0, 1.05 + 3.1, HALF);
    const seat = new THREE.BoxGeometry(0.55, 0.08, 2.2);
    const back = new THREE.BoxGeometry(0.08, 0.5, 2.2);
    const leg = new THREE.BoxGeometry(0.5, 0.45, 0.08);
    const benchParts = [];
    for (const z of [-10, -30]) {
      benchParts.push([seat, 0, 1.52, z], [back, 0.25, 1.85, z], [leg, 0, 1.28, z - 0.9], [leg, 0, 1.28, z + 0.9]);
    }
    G.bench = merged(benchParts);
    G.sign = new THREE.PlaneGeometry(3.2, 0.8);
    G.signBox = new THREE.BoxGeometry(3.3, 0.9, 0.12);
    G.poster = new THREE.PlaneGeometry(1.6, 2.4);
    G.buildings = [];
    for (let i = 0; i < 14; i++) {
      const w = pick([10, 12, 14]);
      const h = pick([12, 16, 20, 24, 28, 36, 44]);
      const d = 12;
      G.buildings.push({ geo: buildingGeometry(w, h, d), w, h, d });
    }
    G.roofBox = new THREE.BoxGeometry(2.2, 1.6, 2.2).translate(0, 0.8, 0);

    // ----- 海邊 -----
    G.seaWall = new THREE.BoxGeometry(0.5, 1.0, L).translate(0, 0.5, HALF);
    const railPost = new THREE.BoxGeometry(0.07, 0.95, 0.07);
    const railBar = new THREE.CylinderGeometry(0.035, 0.035, L, 6).rotateX(Math.PI / 2);
    const railing = [];
    for (let z = -1; z > -L; z -= 2.5) railing.push([railPost, 0, 1.47, z]);
    railing.push([railBar, 0, 1.92, HALF], [railBar, 0, 1.55, HALF]);
    G.seaRailing = merged(railing);
    const slope = Math.atan(1.2 / 26);
    G.beach = new THREE.PlaneGeometry(26.1, L).rotateX(-Math.PI / 2).rotateZ(-slope).translate(21, -0.6, HALF);
    G.ocean = new THREE.PlaneGeometry(500, L).rotateX(-Math.PI / 2).translate(273, -0.7, HALF);
    G.foam = new THREE.PlaneGeometry(1.4, L).rotateX(-Math.PI / 2).translate(23.4, -0.66, HALF);
    const hillShape = new THREE.Shape();
    hillShape.moveTo(HILL[0][0], -0.5);
    for (const [x, y] of HILL) hillShape.lineTo(x, y);
    hillShape.lineTo(HILL[HILL.length - 1][0], -0.5);
    hillShape.closePath();
    G.hill = new THREE.ExtrudeGeometry(hillShape, { depth: L, bevelEnabled: false }).translate(0, 0, -L);
    G.rock = new THREE.DodecahedronGeometry(1, 0);
    // 椰子樹
    const palmTrunk = [];
    let px = 0;
    for (let i = 0; i < 6; i++) {
      const r0 = 0.28 - i * 0.025;
      palmTrunk.push([new THREE.CylinderGeometry(r0 - 0.02, r0, 1.05, 7), px, 0.5 + i * 1.0, 0, 0, 0, -0.05 * i]);
      px += 0.06 * i;
    }
    G.palmTrunk = merged(palmTrunk);
    const leafGeo = new THREE.ConeGeometry(0.5, 3.6, 4);
    leafGeo.scale(1, 1, 0.18);
    leafGeo.translate(0, 1.8, 0);
    const leaves = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const leaf = leafGeo.clone();
      leaf.rotateZ(-1.9 + (k % 2) * 0.25);
      leaf.rotateY(a);
      leaves.push([leaf, px, 6.1, 0]);
    }
    leaves.push([new THREE.SphereGeometry(0.22, 6, 5), px + 0.15, 5.95, 0.1]);
    leaves.push([new THREE.SphereGeometry(0.22, 6, 5), px - 0.12, 5.9, -0.1]);
    G.palmLeaves = merged(leaves);
    G.house = new THREE.BoxGeometry(4.2, 3, 4.6).translate(0, 1.5, 0);
    G.houseRoof = roofGeometry(5, 5.2, 1.8).translate(0, 3, 0);
    G.door = new THREE.BoxGeometry(0.05, 1.7, 0.9).translate(2.12, 0.85, 0);
    G.umbrellaPole = new THREE.CylinderGeometry(0.04, 0.04, 2.3, 5).translate(0, 1.15, 0);
    G.umbrellaTop = new THREE.ConeGeometry(1.5, 0.6, 10, 1, true).translate(0, 2.2, 0);
    G.boatHull = new THREE.BoxGeometry(1.6, 0.6, 5).translate(0, 0, 0);
    const sailShape = new THREE.Shape();
    sailShape.moveTo(0, 0);
    sailShape.lineTo(0, 6);
    sailShape.lineTo(3.2, 0);
    sailShape.closePath();
    G.sail = new THREE.ShapeGeometry(sailShape).rotateY(Math.PI / 2).translate(0, 0.4, 1.4);
    const lh = [];
    for (let i = 0; i < 6; i++) lh.push([new THREE.CylinderGeometry(1.6 - i * 0.12, 1.7 - i * 0.12, 2.6, 16), 0, 1.3 + i * 2.6, 0]);
    G.lighthouseRed = merged(lh.filter((_, i) => i % 2 === 0));
    G.lighthouseWhite = merged(lh.filter((_, i) => i % 2 === 1));
    G.lighthouseLamp = new THREE.CylinderGeometry(0.9, 0.9, 1.4, 12).translate(0, 16.4, 0);
    G.lighthouseCap = new THREE.ConeGeometry(1.3, 1.4, 12).translate(0, 17.8, 0);
    G.island = new THREE.DodecahedronGeometry(6, 0).scale(1.4, 0.45, 1.2);

    // ----- 雪地 -----
    const bank = new THREE.SphereGeometry(1, 10, 6);
    const banks = [];
    for (const side of [-1, 1]) {
      for (let z = -2; z > -L; z -= rand(3.5, 5.5)) {
        banks.push([bank, side * rand(5.4, 6.4), 0, z, 0, 0, 0, rand(1.1, 1.8), rand(0.45, 0.8), rand(2.5, 3.8)]);
      }
    }
    G.snowBanks = merged(banks);
    const fence = [];
    const fPost = new THREE.BoxGeometry(0.14, 1.3, 0.14);
    const fRail = new THREE.BoxGeometry(0.06, 0.12, L);
    for (let z = -1; z > -L; z -= 2.5) fence.push([fPost, 0, 0.65, z]);
    fence.push([fRail, 0, 0.55, HALF], [fRail, 0, 1.05, HALF]);
    G.fence = merged(fence);
    G.fenceSnow = new THREE.BoxGeometry(0.16, 0.06, L).translate(0, 1.14, HALF);
    G.pineTrunk = new THREE.CylinderGeometry(0.2, 0.28, 1.6, 6).translate(0, 0.8, 0);
    G.pineGreen = merged([
      [new THREE.ConeGeometry(2.2, 3, 7), 0, 2.6, 0],
      [new THREE.ConeGeometry(1.7, 2.6, 7), 0, 4.1, 0],
      [new THREE.ConeGeometry(1.15, 2.2, 7), 0, 5.4, 0],
    ]);
    G.pineSnow = merged([
      [new THREE.ConeGeometry(1.6, 1.2, 7), 0, 3.5, 0],
      [new THREE.ConeGeometry(1.2, 1.05, 7), 0, 4.95, 0],
      [new THREE.ConeGeometry(0.7, 0.9, 7), 0, 6.25, 0],
    ]);
    G.mountain = new THREE.ConeGeometry(55, 62, 8).translate(0, 31, 0);
    G.mountainCap = new THREE.ConeGeometry(22.5, 25.5, 8).translate(0, 49.6, 0);
    G.cabin = new THREE.BoxGeometry(4.6, 2.8, 4.2).translate(0, 1.4, 0);
    G.cabinRoof = roofGeometry(5.6, 5, 1.8).translate(0, 2.8, 0);
    G.cabinWindow = merged([
      [new THREE.PlaneGeometry(0.9, 0.8), 2.31, 1.6, -1, 0, Math.PI / 2, 0],
      [new THREE.PlaneGeometry(0.9, 0.8), 2.31, 1.6, 1, 0, Math.PI / 2, 0],
    ]);
    G.chimney = new THREE.BoxGeometry(0.6, 1.4, 0.6).translate(1.2, 4, 1);
    G.snowman = merged([
      [new THREE.SphereGeometry(0.6, 14, 10), 0, 0.55, 0],
      [new THREE.SphereGeometry(0.45, 14, 10), 0, 1.4, 0],
      [new THREE.SphereGeometry(0.32, 14, 10), 0, 2.05, 0],
    ]);
    G.carrot = new THREE.ConeGeometry(0.07, 0.4, 6).rotateZ(Math.PI / 2).translate(0.5, 2.05, 0);
    G.coal = merged([
      [new THREE.SphereGeometry(0.05, 6, 4), 0.29, 2.15, -0.11],
      [new THREE.SphereGeometry(0.05, 6, 4), 0.29, 2.15, 0.11],
      [new THREE.SphereGeometry(0.06, 6, 4), 0.44, 1.5, 0],
      [new THREE.SphereGeometry(0.06, 6, 4), 0.46, 1.25, 0],
    ]);
    const lampPole = new THREE.CylinderGeometry(0.07, 0.1, 4.2, 8);
    G.lampPoles = merged([
      [lampPole, 0, 2.1, -10],
      [lampPole, 0, 2.1, -30],
    ]);
    G.lampHeads = merged([
      [new THREE.SphereGeometry(0.28, 10, 8), 0, 4.35, -10],
      [new THREE.SphereGeometry(0.28, 10, 8), 0, 4.35, -30],
    ]);

    // ----- 隧道 -----
    const R = 7.2;
    const WALL_H = 3;
    G.tunnelArch = new THREE.CylinderGeometry(R, R, L, 32, 1, true, -Math.PI / 2, Math.PI)
      .rotateX(-Math.PI / 2)
      .translate(0, WALL_H, HALF);
    G.tunnelWall = new THREE.BoxGeometry(0.4, WALL_H, L).translate(0, WALL_H / 2, HALF);
    G.tunnelLedge = new THREE.BoxGeometry(1.5, 0.8, L).translate(0, 0.4, HALF);
    const lamps = [];
    const ceil = [];
    const lampBox = new THREE.BoxGeometry(0.16, 0.2, 1.4);
    for (let z = -4; z > -L; z -= 8) {
      lamps.push([lampBox, -R + 0.25, 3.6, z], [lampBox, R - 0.25, 3.6, z]);
      ceil.push([new THREE.BoxGeometry(0.4, 0.08, 3), 0, WALL_H + R - 0.08, z - 2]);
    }
    G.tunnelLamps = merged(lamps);
    G.tunnelCeil = merged(ceil);
    const cable = new THREE.CylinderGeometry(0.05, 0.05, L, 5).rotateX(Math.PI / 2);
    const cables = [];
    for (const side of [-1, 1]) for (const y of [2.1, 2.3, 2.5]) cables.push([cable, side * (R - 0.25), y, HALF]);
    G.tunnelCables = merged(cables);
    G.exitSign = merged([
      [new THREE.BoxGeometry(0.1, 0.35, 0.8), -R + 0.25, 2.95, -20],
      [new THREE.BoxGeometry(0.1, 0.35, 0.8), R - 0.25, 2.95, -20],
    ]);
    // 隧道口：鋸齒狀的岩壁 + 兩側山丘（不能擋到隧道內部）
    const portal = new THREE.Shape();
    const cliff = [
      [-60, -0.5], [60, -0.5], [60, 18], [46, 29], [31, 25], [16, 37], [2, 33],
      [-11, 41], [-27, 30], [-44, 34], [-60, 21],
    ];
    portal.moveTo(...cliff[0]);
    for (const p of cliff.slice(1)) portal.lineTo(...p);
    portal.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-R, -0.3);
    hole.lineTo(-R, WALL_H);
    hole.absarc(0, WALL_H, R, Math.PI, 0, true);
    hole.lineTo(R, -0.3);
    hole.closePath();
    portal.holes.push(hole);
    G.portal = fixNormals(new THREE.ExtrudeGeometry(portal, { depth: 3, bevelEnabled: false }).translate(0, 0, -3));
    G.portalRim = new THREE.TorusGeometry(R + 0.35, 0.45, 6, 32, Math.PI).translate(0, WALL_H, 0.2);
    G.portalHills = merged([
      [new THREE.IcosahedronGeometry(40, 1), -62, -6, -30, 0, 0, 0, 1, 0.8, 1.3],
      [new THREE.IcosahedronGeometry(40, 1), 62, -6, -34, 0, 0.5, 0, 1, 0.7, 1.2],
    ]);

    // ----- 霓虹 -----
    G.nightWall = new THREE.BoxGeometry(0.5, 2.3, L).translate(0, 1.15, HALF);
    G.neonTube = new THREE.BoxGeometry(0.12, 0.12, L).translate(0, 2.4, HALF);
    G.signV = new THREE.PlaneGeometry(2.2, 7);
    G.signH = new THREE.PlaneGeometry(7.5, 2.35);
    G.neonLampHeads = merged([
      [new THREE.BoxGeometry(0.9, 0.12, 0.3), 0.4, 4.3, -10],
      [new THREE.BoxGeometry(0.9, 0.12, 0.3), 0.4, 4.3, -30],
    ]);
    // 跨越軌道的彩色燈串
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-7.8, 7.5, 0),
      new THREE.Vector3(-3, 6.6, 0),
      new THREE.Vector3(0, 6.45, 0),
      new THREE.Vector3(3, 6.6, 0),
      new THREE.Vector3(7.8, 7.5, 0),
    ]);
    G.bulbWire = new THREE.TubeGeometry(curve, 24, 0.025, 4).translate(0, 0, -20);
    const bulbs = [[], [], []];
    const bulb = new THREE.SphereGeometry(0.13, 8, 6);
    for (let i = 1; i < 16; i++) {
      const p = curve.getPoint(i / 16);
      bulbs[i % 3].push([bulb, p.x, p.y - 0.15, -20]);
    }
    G.bulbs = bulbs.map((b) => merged(b));
    this.G = G;
  }

  // ---------- 建立一段路 ----------
  createSegment() {
    const G = this.G;
    const M = this.mat;
    const seg = new THREE.Group();
    const common = new THREE.Group();
    const ground = mesh(G.ground, this.groundMats.city);
    const ballast = mesh(G.ballast, this.ballastMats.city);
    const feet = mesh(G.railFeet, M.railBase);
    const rails = mesh(G.rails, M.rail, { cast: true });
    const wires = mesh(G.wires, M.wire);
    const road = mesh(G.road, M.concrete);
    road.visible = false;
    common.add(ground, ballast, feet, rails, wires, road);
    const gantry = mesh(G.gantry, M.steel, { cast: true });
    common.add(gantry);

    const perLane = Math.floor(L / 0.8);
    const sleepers = new THREE.InstancedMesh(G.sleeper, M.sleeper, perLane * LANES.length);
    sleepers.receiveShadow = true;
    const m4 = new THREE.Matrix4();
    let k = 0;
    for (const x of LANES) {
      for (let i = 0; i < perLane; i++) {
        m4.makeTranslation(x, 0.15, -0.4 - i * 0.8);
        sleepers.setMatrixAt(k++, m4);
      }
    }
    common.add(sleepers);
    seg.add(common);
    seg.userData = { ground, ballast, gantry, road, railParts: [ballast, feet, rails, wires, sleepers], decor: {}, theme: null };
    this.scene.add(seg);
    return seg;
  }

  decorFor(seg, id) {
    const d = seg.userData.decor;
    if (!d[id]) {
      const build = this[`build_${id}`] || EXTRA_BUILDERS[id];
      d[id] = build.call(this);
      seg.add(d[id].group);
    }
    return d[id];
  }

  applyTheme(seg) {
    const center = seg.position.z - L / 2;
    const id = this.themeAt(center);
    const prev = this.themeAt(center + L);
    const u = seg.userData;
    u.theme = id;
    u.ground.material = this.groundMats[id];
    u.ballast.material = this.ballastMats[id];
    // 鐵道場景有軌道和電車線；其他場景換成道路或小徑
    const rail = THEMES[id].track === 'rail';
    for (const m of u.railParts) m.visible = rail;
    u.road.visible = !rail;
    if (!rail) u.road.material = this.roadMats[id];
    u.gantry.visible = rail && id !== 'tunnel';
    if (id === 'seaside') {
      u.ground.scale.x = 53 / 90;
      u.ground.position.x = -18.5;
    } else {
      u.ground.scale.x = 1;
      u.ground.position.x = 0;
    }
    for (const key of Object.keys(u.decor)) u.decor[key].group.visible = key === id;
    const decor = this.decorFor(seg, id);
    decor.group.visible = true;
    decor.randomize({ prev, first: prev !== id });
  }

  // 大樓兩排，城市與霓虹共用
  makeBuildings(group, count = 6) {
    const list = [];
    for (let i = 0; i < count; i++) {
      const b = new THREE.Mesh(this.G.buildings[0].geo, this.facadeMats[0]);
      b.receiveShadow = true;
      b.add(mesh(this.G.roofBox, this.mat.roofTop));
      group.add(b);
      list.push(b);
    }
    return list;
  }

  placeBuildings(list, mats, onPlace) {
    let zL = -rand(0, 4);
    let zR = -rand(0, 4);
    list.forEach((b, i) => {
      const side = i % 2 ? 1 : -1;
      const v = pick(this.G.buildings);
      b.geometry = v.geo;
      b.material = pick(mats);
      const inset = rand(0, 5);
      b.position.x = side * (14.5 + v.d / 2 + inset);
      const z = side < 0 ? zL : zR;
      b.position.z = z - v.w / 2;
      b.rotation.y = Math.PI / 2;
      if (side < 0) zL -= v.w + rand(1, 3);
      else zR -= v.w + rand(1, 3);
      b.visible = b.position.z - v.w / 2 > -L - 2;
      const roof = b.children[0];
      roof.position.set(rand(-2, 2), v.h, rand(-2, 2));
      roof.visible = Math.random() < 0.7;
      if (b.visible && onPlace) onPlace(b, side, v, inset);
    });
  }

  // ---------- 城市鐵道 ----------
  build_city() {
    const G = this.G;
    const M = this.mat;
    const group = new THREE.Group();
    const open = new THREE.Group();
    const walls = [];
    for (const side of [-1, 1]) {
      const wall = mesh(G.wall, this.wallMats[0]);
      wall.position.x = side * 7.8;
      open.add(wall);
      walls.push(wall);
      const cop = mesh(G.coping, M.darkConcrete);
      cop.position.x = side * 7.8;
      open.add(cop);
    }
    const trees = [];
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Group();
      t.add(mesh(G.trunk, M.trunk, { cast: true }));
      t.add(mesh(G.crown, i % 2 ? M.leaf : M.leaf2, { cast: true }));
      open.add(t);
      trees.push(t);
    }
    group.add(open);

    const station = new THREE.Group();
    for (const side of [-1, 1]) {
      const pf = mesh(G.platform, M.concrete);
      pf.position.x = side * 7.0;
      const top = mesh(G.platformTop, M.tile);
      top.position.x = side * 7.0;
      const tac = mesh(G.tactile, M.tactile);
      tac.position.x = side * 4.35;
      const edge = mesh(G.edgeLine, M.white);
      edge.position.x = side * 3.95;
      const pil = mesh(G.pillars, M.canopy, { cast: true });
      pil.position.x = side * 7.2;
      const can = mesh(G.canopy, M.canopy, { cast: true });
      can.position.set(side * 7.0, 5.95, 0);
      can.rotation.z = side * -0.06;
      const cb = mesh(G.canopyBeam, M.steel);
      cb.position.set(side * 7.0, 5.95, 0);
      station.add(pf, top, tac, edge, pil, can, cb);
      for (const lx of [5.2, 8.6]) {
        const ls = new THREE.Mesh(G.lightStrip, M.lightStrip);
        ls.position.set(side * lx, 5.72, 0);
        station.add(ls);
      }
      const bw = mesh(G.backWall, M.white);
      bw.position.x = side * 10.3;
      const bench = mesh(G.bench, M.bench, { cast: true });
      bench.position.x = side * 9.3;
      bench.scale.x = side;
      station.add(bw, bench);
      for (let i = 0; i < 3; i++) {
        const p = new THREE.Mesh(G.poster, this.posterMats[(i + (side > 0 ? 1 : 0)) % 4]);
        p.position.set(side * 10.03, 2.9, -6 - i * 13);
        p.rotation.y = -side * (Math.PI / 2);
        station.add(p);
      }
      const signBox = mesh(G.signBox, M.steel);
      signBox.position.set(side * 6.6, 4.6, -20);
      station.add(signBox);
      for (const face of [1, -1]) {
        const s = new THREE.Mesh(G.sign, this.signMat);
        s.position.set(side * 6.6, 4.6, -20 + face * 0.065);
        if (face < 0) s.rotation.y = Math.PI;
        station.add(s);
      }
    }
    group.add(station);
    const buildings = this.makeBuildings(group);

    const randomize = () => {
      if (this.stationRun > 0) this.stationRun--;
      else if (Math.random() < 0.18) this.stationRun = 1 + ((Math.random() * 2) | 0);
      const isStation = this.stationRun > 0;
      open.visible = !isStation;
      station.visible = isStation;
      for (const w of walls) w.material = pick(this.wallMats);
      trees.forEach((t, i) => {
        const side = i % 2 ? 1 : -1;
        t.visible = Math.random() < 0.75;
        t.position.set(side * rand(9.2, 11.5), 0, -rand(2, L - 2));
        t.scale.setScalar(rand(0.8, 1.25));
        t.rotation.y = rand(0, Math.PI * 2);
      });
      this.placeBuildings(buildings, this.facadeMats);
    };
    return { group, randomize };
  }

  // ---------- 海岸線 ----------
  build_seaside() {
    const G = this.G;
    const M = this.mat;
    const group = new THREE.Group();
    const wall = mesh(G.seaWall, M.concrete);
    wall.position.x = 7.9;
    const rail = mesh(G.seaRailing, M.railing, { cast: true });
    rail.position.x = 7.9;
    const beach = mesh(G.beach, M.sand);
    const ocean = mesh(G.ocean, M.water, { receive: false });
    const foam = new THREE.Mesh(G.foam, M.foam);
    const hill = mesh(G.hill, M.grass);
    group.add(wall, rail, beach, ocean, foam, hill);

    const rocks = [];
    for (let i = 0; i < 5; i++) {
      const r = mesh(G.rock, M.rock, { cast: true });
      group.add(r);
      rocks.push(r);
    }
    const palms = [];
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Group();
      p.add(mesh(G.palmTrunk, M.palmTrunk, { cast: true }), mesh(G.palmLeaves, M.palmLeaf, { cast: true }));
      group.add(p);
      palms.push(p);
    }
    const houses = [];
    for (let i = 0; i < 3; i++) {
      const h = new THREE.Group();
      const body = mesh(G.house, this.houseMats[0], { cast: true });
      const roof = mesh(G.houseRoof, this.roofMats[0], { cast: true });
      const door = mesh(G.door, M.hull);
      h.add(body, roof, door);
      h.userData = { body, roof };
      group.add(h);
      houses.push(h);
    }
    const umbrellas = [];
    for (let i = 0; i < 4; i++) {
      const u = new THREE.Group();
      const top = mesh(G.umbrellaTop, this.umbrellaMats[0], { cast: true });
      u.add(mesh(G.umbrellaPole, M.railing), top);
      u.userData.top = top;
      group.add(u);
      umbrellas.push(u);
    }
    const boats = [];
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Group();
      b.add(mesh(G.boatHull, M.hull), mesh(G.sail, M.sail));
      group.add(b);
      boats.push(b);
    }
    const lighthouse = new THREE.Group();
    lighthouse.add(
      mesh(G.island, M.rock),
      mesh(G.lighthouseRed, M.red),
      mesh(G.lighthouseWhite, M.white),
      new THREE.Mesh(G.lighthouseLamp, M.lampWarm),
      mesh(G.lighthouseCap, M.red),
    );
    group.add(lighthouse);

    const randomize = () => {
      rocks.forEach((r) => {
        const x = -rand(8, 11);
        r.position.set(x, hillY(x) * 0.5, -rand(1, L - 1));
        r.scale.set(rand(0.6, 1.4), rand(0.5, 1), rand(0.8, 1.6));
        r.rotation.set(rand(0, 3), rand(0, 3), 0);
      });
      palms.forEach((p, i) => {
        const beachSide = i < 3;
        const x = beachSide ? rand(10, 19) : -rand(9, 14);
        const y = beachSide ? -((x - 8) / 26) * 1.2 : hillY(x);
        p.position.set(x, y, -rand(2, L - 2));
        p.rotation.y = beachSide ? rand(2.4, 3.8) : rand(-0.6, 0.6);
        p.scale.setScalar(rand(0.85, 1.2));
        p.visible = Math.random() < 0.85;
      });
      houses.forEach((h, i) => {
        const x = -rand(17, 32);
        h.position.set(x, hillY(x + 2.5) - 0.2, -5 - i * 13 - rand(0, 4));
        h.rotation.y = rand(-0.25, 0.25);
        h.userData.body.material = pick(this.houseMats);
        h.userData.roof.material = pick(this.roofMats);
        h.visible = Math.random() < 0.8;
      });
      umbrellas.forEach((u) => {
        const x = rand(11, 21);
        u.position.set(x, -((x - 8) / 26) * 1.2, -rand(2, L - 2));
        u.rotation.set(rand(-0.15, 0.15), 0, rand(-0.15, 0.15));
        u.userData.top.material = pick(this.umbrellaMats);
        u.visible = Math.random() < 0.7;
      });
      boats.forEach((b) => {
        b.position.set(rand(45, 160), -0.55, -rand(0, L));
        b.rotation.y = rand(0, Math.PI * 2);
        b.visible = Math.random() < 0.5;
      });
      lighthouse.visible = Math.random() < 0.12;
      lighthouse.position.set(rand(70, 90), -1.5, -20);
    };
    return { group, randomize };
  }

  // ---------- 地鐵隧道 ----------
  build_tunnel() {
    const G = this.G;
    const M = this.mat;
    const group = new THREE.Group();
    const arch = mesh(G.tunnelArch, M.tunnel);
    group.add(arch);
    for (const side of [-1, 1]) {
      const w = mesh(G.tunnelWall, M.tunnelWall);
      w.position.x = side * 7.4;
      const ledge = mesh(G.tunnelLedge, M.darkConcrete);
      ledge.position.x = side * 6.45;
      group.add(w, ledge);
    }
    group.add(new THREE.Mesh(G.tunnelLamps, M.tunnelLamp));
    group.add(new THREE.Mesh(G.tunnelCeil, M.tunnelCeil));
    group.add(mesh(G.tunnelCables, M.cable));
    const exit = new THREE.Mesh(G.exitSign, M.exitSign);
    group.add(exit);
    const portal = new THREE.Group();
    portal.add(mesh(G.portal, M.portal), mesh(G.portalRim, M.darkConcrete), mesh(G.portalHills, M.portalHill));
    group.add(portal);
    const randomize = ({ first }) => {
      portal.visible = first;
      exit.visible = Math.random() < 0.5;
    };
    return { group, randomize };
  }

  // ---------- 雪山列車 ----------
  build_snow() {
    const G = this.G;
    const M = this.mat;
    const group = new THREE.Group();
    group.add(mesh(G.snowBanks, M.snowCap));
    for (const side of [-1, 1]) {
      const f = mesh(G.fence, M.fence, { cast: true });
      f.position.x = side * 7.6;
      const fs = mesh(G.fenceSnow, M.snowCap);
      fs.position.x = side * 7.6;
      const poles = mesh(G.lampPoles, M.steel, { cast: true });
      poles.position.x = side * 6.9;
      const heads = new THREE.Mesh(G.lampHeads, M.lampWarm);
      heads.position.x = side * 6.9;
      group.add(f, fs, poles, heads);
    }
    const N = 18;
    const trunks = new THREE.InstancedMesh(G.pineTrunk, M.trunk, N);
    const greens = new THREE.InstancedMesh(G.pineGreen, M.pine, N);
    const snows = new THREE.InstancedMesh(G.pineSnow, M.snowCap, N);
    for (const im of [trunks, greens, snows]) {
      im.castShadow = true;
      im.receiveShadow = true;
      group.add(im);
    }
    const mountains = [];
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Group();
      m.add(mesh(G.mountain, M.mountain, { receive: false }), mesh(G.mountainCap, M.snowCap, { receive: false }));
      group.add(m);
      mountains.push(m);
    }
    const cabins = [];
    for (let i = 0; i < 2; i++) {
      const c = new THREE.Group();
      c.add(
        mesh(G.cabin, M.logWall, { cast: true }),
        mesh(G.cabinRoof, M.snowCap, { cast: true }),
        new THREE.Mesh(G.cabinWindow, M.window),
        mesh(G.chimney, M.darkConcrete, { cast: true }),
      );
      group.add(c);
      cabins.push(c);
    }
    const snowman = new THREE.Group();
    snowman.add(mesh(G.snowman, M.snowCap, { cast: true }), mesh(G.carrot, M.carrot), mesh(G.coal, M.coal));
    group.add(snowman);

    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    const randomize = () => {
      for (let i = 0; i < N; i++) {
        const side = i % 2 ? 1 : -1;
        v.set(side * rand(9, 34), 0, -rand(0, L));
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rand(0, Math.PI * 2));
        const k = rand(0.8, 1.7);
        s.set(k, k * rand(0.9, 1.2), k);
        m4.compose(v, q, s);
        trunks.setMatrixAt(i, m4);
        greens.setMatrixAt(i, m4);
        snows.setMatrixAt(i, m4);
      }
      trunks.instanceMatrix.needsUpdate = true;
      greens.instanceMatrix.needsUpdate = true;
      snows.instanceMatrix.needsUpdate = true;
      mountains.forEach((m, i) => {
        const side = i ? 1 : -1;
        m.visible = Math.random() < 0.6;
        m.position.set(side * rand(85, 130), -2, -rand(0, L));
        m.scale.set(rand(0.8, 1.4), rand(0.7, 1.3), rand(0.8, 1.4));
        m.rotation.y = rand(0, 3);
      });
      cabins.forEach((c, i) => {
        const side = i ? 1 : -1;
        c.visible = Math.random() < 0.35;
        c.position.set(side * rand(12, 17), 0, -rand(6, L - 6));
        c.rotation.y = side > 0 ? Math.PI : 0;
      });
      snowman.visible = Math.random() < 0.3;
      const side = Math.random() < 0.5 ? -1 : 1;
      snowman.position.set(side * rand(8.6, 10), 0, -rand(4, L - 4));
      snowman.rotation.y = side > 0 ? Math.PI : 0;
    };
    return { group, randomize };
  }

  // ---------- 霓虹夜城 ----------
  build_neon() {
    const G = this.G;
    const M = this.mat;
    const group = new THREE.Group();
    for (const side of [-1, 1]) {
      const w = mesh(G.nightWall, M.nightWall);
      w.position.x = side * 7.8;
      const tube = new THREE.Mesh(G.neonTube, side < 0 ? M.neonPink : M.neonCyan);
      tube.position.x = side * 7.8;
      const poles = mesh(G.lampPoles, M.steel, { cast: true });
      poles.position.x = side * 6.9;
      const heads = new THREE.Mesh(G.neonLampHeads, side < 0 ? M.neonCyan : M.neonPink);
      heads.position.x = side * 6.9;
      heads.scale.x = -side;
      group.add(w, tube, poles, heads);
    }
    const bulbString = new THREE.Group();
    bulbString.add(mesh(G.bulbWire, M.wire));
    [M.neonPink, M.neonCyan, M.neonYellow].forEach((mat, i) => bulbString.add(new THREE.Mesh(G.bulbs[i], mat)));
    group.add(bulbString);
    const buildings = this.makeBuildings(group);
    const signs = [];
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(G.signV, this.neonSignMats[0]);
      group.add(s);
      signs.push(s);
    }
    const randomize = () => {
      signs.forEach((s) => (s.visible = false));
      let n = 0;
      this.placeBuildings(buildings, this.nightFacadeMats, (b, side, v, inset) => {
        if (n >= signs.length || Math.random() < 0.25) return;
        const s = signs[n++];
        const idx = (Math.random() * this.neonSignMats.length) | 0;
        const vertical = this.neonSignVertical[idx];
        s.material = this.neonSignMats[idx];
        s.geometry = vertical ? G.signV : G.signH;
        s.visible = true;
        s.position.set(side * (14.5 + inset - 0.25), vertical ? rand(6, Math.max(7, v.h - 5)) : rand(4, 6), b.position.z + rand(-2, 2));
        s.rotation.y = -side * (Math.PI / 2);
      });
      bulbString.visible = Math.random() < 0.6;
    };
    return { group, randomize };
  }

  reset() {
    this.stationRun = 0;
    this.segments.forEach((seg, i) => {
      seg.position.z = L - i * L;
      this.applyTheme(seg);
    });
  }

  update(playerZ, dt = 0) {
    this.time += dt;
    this.waterNormal.offset.set(this.time * 0.012, -this.time * 0.02);
    this.mat.foam.opacity = 0.4 + Math.sin(this.time * 1.3) * 0.2;
    extraUpdate(this, dt, playerZ);
    for (const seg of this.segments) {
      const decor = seg.userData.decor[seg.userData.theme];
      if (decor?.tick) decor.tick(dt, this.time);
      if (seg.position.z - L > playerZ + 25) {
        seg.position.z -= SEG_COUNT * L;
        this.applyTheme(seg);
      }
    }
  }
}

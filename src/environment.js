// 無限循環的鐵道場景：軌道、塗鴉牆、電車線、月台車站、兩側大樓
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  gravelTexture,
  woodTexture,
  wallTexture,
  tileTexture,
  tactileTexture,
  facadeTextures,
  signTexture,
  posterTexture,
} from './textures.js';
import { LANES, SEG_LEN, SEG_COUNT } from './config.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

function merged(list) {
  return mergeGeometries(
    list.map(([g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0]) => {
      const c = g.index ? g.toNonIndexed() : g.clone();
      c.applyMatrix4(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, y, z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
          new THREE.Vector3(1, 1, 1),
        ),
      );
      return c;
    }),
  );
}

function mesh(geo, mat, { cast = false, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

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

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.segments = [];
    this.stationRun = 0;
    this.buildMaterials();
    this.buildGeometries();
    for (let i = 0; i < SEG_COUNT; i++) this.segments.push(this.createSegment());
    this.reset();
  }

  buildMaterials() {
    const gravel = gravelTexture();
    gravel.repeat.set(15, 9);
    const ballast = gravelTexture();
    ballast.repeat.set(1, 18);
    const wood = woodTexture();
    const tile = tileTexture();
    tile.repeat.set(3, 20);
    const tactile = tactileTexture();
    tactile.repeat.set(1, 40);
    this.mat = {
      ground: new THREE.MeshStandardMaterial({ map: gravel, roughness: 0.95, color: '#b4aa9e' }),
      ballast: new THREE.MeshStandardMaterial({ map: ballast, roughness: 0.95, color: '#9b938a' }),
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
    };
    this.wallMats = [0, 1, 2, 3].map(() => {
      const t = wallTexture();
      t.repeat.set(SEG_LEN / 16, 1);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 });
    });
    this.facadeMats = facadeTextures().map(
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
  }

  buildGeometries() {
    const L = SEG_LEN;
    const half = -L / 2;
    const G = {};
    G.ground = new THREE.PlaneGeometry(90, L).rotateX(-Math.PI / 2).translate(0, 0, half);

    // 道床（梯形碎石堆）
    const shape = new THREE.Shape();
    shape.moveTo(-1.55, 0);
    shape.lineTo(1.55, 0);
    shape.lineTo(1.25, 0.12);
    shape.lineTo(-1.25, 0.12);
    shape.closePath();
    const bed = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false });
    bed.translate(0, 0, -L);
    // 重新設定 UV，讓碎石貼圖沿軌道方向延伸
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
        rails.push([railProfile, x + s, 0.265, half]);
        feet.push([railFoot, x + s, 0.215, half]);
      }
    }
    G.rails = merged(rails);
    G.railFeet = merged(feet);
    G.sleeper = new THREE.BoxGeometry(2.2, 0.1, 0.26);

    // 電車線 + 門型架
    const wires = [];
    const wireGeo = new THREE.CylinderGeometry(0.02, 0.02, L, 4).rotateX(Math.PI / 2);
    for (const x of LANES) {
      wires.push([wireGeo, x, 5.75, half]);
      wires.push([wireGeo, x, 6.2, half]);
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

    // 塗鴉牆
    G.wall = new THREE.BoxGeometry(0.6, 4.4, L).translate(0, 2.2, half);
    G.coping = new THREE.BoxGeometry(0.9, 0.22, L).translate(0, 4.5, half);

    // 樹
    const trunk = new THREE.CylinderGeometry(0.18, 0.26, 3, 7).translate(0, 1.5, 0);
    const crown1 = new THREE.IcosahedronGeometry(1.9, 0).translate(0, 4.2, 0);
    const crown2 = new THREE.IcosahedronGeometry(1.4, 0).translate(0.6, 5.4, 0.3);
    G.trunk = trunk;
    G.crown = merged([[crown1], [crown2]]);

    // 車站
    G.platform = new THREE.BoxGeometry(6.2, 1.05, L).translate(0, 0.525, half);
    G.platformTop = new THREE.PlaneGeometry(6.2, L).rotateX(-Math.PI / 2).translate(0, 1.052, half);
    G.tactile = new THREE.PlaneGeometry(0.5, L).rotateX(-Math.PI / 2).translate(0, 1.056, half);
    G.edgeLine = new THREE.BoxGeometry(0.12, 0.03, L).translate(0, 1.06, half);
    const pillars = [];
    const pillar = new THREE.CylinderGeometry(0.16, 0.2, 4.7, 12);
    for (const z of [-5, -15, -25, -35]) pillars.push([pillar, 0, 1.05 + 2.35, z]);
    G.pillars = merged(pillars);
    G.canopy = new THREE.BoxGeometry(7.2, 0.24, L).translate(0, 0, half);
    G.canopyBeam = merged([-5, -15, -25, -35].map((z) => [new THREE.BoxGeometry(7.2, 0.35, 0.3), 0, -0.25, z]));
    G.lightStrip = new THREE.BoxGeometry(0.22, 0.05, L).translate(0, 0, half);
    G.backWall = new THREE.BoxGeometry(0.5, 6.2, L).translate(0, 1.05 + 3.1, half);
    const benchParts = [];
    const seat = new THREE.BoxGeometry(0.55, 0.08, 2.2);
    const back = new THREE.BoxGeometry(0.08, 0.5, 2.2);
    const leg = new THREE.BoxGeometry(0.5, 0.45, 0.08);
    for (const z of [-10, -30]) {
      benchParts.push([seat, 0, 1.52, z], [back, 0.25, 1.85, z], [leg, 0, 1.28, z - 0.9], [leg, 0, 1.28, z + 0.9]);
    }
    G.bench = merged(benchParts);
    G.sign = new THREE.PlaneGeometry(3.2, 0.8);
    G.signBox = new THREE.BoxGeometry(3.3, 0.9, 0.12);
    G.poster = new THREE.PlaneGeometry(1.6, 2.4);

    // 大樓幾何變化
    G.buildings = [];
    for (let i = 0; i < 14; i++) {
      const w = pick([10, 12, 14]);
      const h = pick([12, 16, 20, 24, 28, 36, 44]);
      const d = 12;
      G.buildings.push({ geo: buildingGeometry(w, h, d), w, h, d });
    }
    G.roofBox = new THREE.BoxGeometry(2.2, 1.6, 2.2).translate(0, 0.8, 0);
    this.G = G;
  }

  createSegment() {
    const G = this.G;
    const M = this.mat;
    const seg = new THREE.Group();
    const common = new THREE.Group();
    common.add(mesh(G.ground, M.ground));
    common.add(mesh(G.ballast, M.ballast));
    common.add(mesh(G.railFeet, M.railBase));
    common.add(mesh(G.rails, M.rail, { cast: true }));
    common.add(mesh(G.wires, M.wire));

    const perLane = Math.floor(SEG_LEN / 0.8);
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

    // 一般路段
    const open = new THREE.Group();
    open.add(mesh(G.gantry, M.steel, { cast: true }));
    const walls = [];
    for (const side of [-1, 1]) {
      const wall = mesh(G.wall, this.wallMats[0]);
      wall.position.x = side * 7.8;
      wall.scale.x = 1;
      if (side > 0) wall.rotation.y = 0;
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
    seg.add(open);

    // 車站路段
    const station = new THREE.Group();
    for (const side of [-1, 1]) {
      const px = side * 7.0;
      const pf = mesh(G.platform, M.concrete);
      pf.position.x = px;
      station.add(pf);
      const top = mesh(G.platformTop, M.tile);
      top.position.x = px;
      station.add(top);
      const tac = mesh(G.tactile, M.tactile);
      tac.position.x = side * 4.35;
      station.add(tac);
      const edge = mesh(G.edgeLine, M.white);
      edge.position.x = side * 3.95;
      station.add(edge);
      const pil = mesh(G.pillars, M.canopy, { cast: true });
      pil.position.x = side * 7.2;
      station.add(pil);
      const can = mesh(G.canopy, M.canopy, { cast: true });
      can.position.set(side * 7.0, 5.95, 0);
      can.rotation.z = side * -0.06;
      station.add(can);
      const cb = mesh(G.canopyBeam, M.steel);
      cb.position.set(side * 7.0, 5.95, 0);
      station.add(cb);
      for (const lx of [5.2, 8.6]) {
        const ls = new THREE.Mesh(G.lightStrip, M.lightStrip);
        ls.position.set(side * lx, 5.72, 0);
        station.add(ls);
      }
      const bw = mesh(G.backWall, M.white);
      bw.position.x = side * 10.3;
      station.add(bw);
      const bench = mesh(G.bench, M.bench, { cast: true });
      bench.position.x = side * 9.3;
      bench.scale.x = side;
      station.add(bench);
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
    seg.add(station);

    // 大樓
    const buildings = [];
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(G.buildings[0].geo, this.facadeMats[0]);
      b.receiveShadow = true;
      const roof = mesh(G.roofBox, M.roofTop);
      b.add(roof);
      seg.add(b);
      buildings.push(b);
    }

    seg.userData = { open, station, walls, trees, buildings };
    this.scene.add(seg);
    return seg;
  }

  randomize(seg) {
    const u = seg.userData;
    if (this.stationRun > 0) this.stationRun--;
    else if (Math.random() < 0.18) this.stationRun = 1 + ((Math.random() * 2) | 0);
    const isStation = this.stationRun > 0;
    u.open.visible = !isStation;
    u.station.visible = isStation;
    for (const w of u.walls) w.material = pick(this.wallMats);
    u.trees.forEach((t, i) => {
      const side = i % 2 ? 1 : -1;
      t.visible = Math.random() < 0.75;
      t.position.set(side * rand(9.2, 11.5), 0, -rand(2, SEG_LEN - 2));
      t.scale.setScalar(rand(0.8, 1.25));
      t.rotation.y = rand(0, Math.PI * 2);
    });
    let zL = -rand(0, 4);
    let zR = -rand(0, 4);
    u.buildings.forEach((b, i) => {
      const side = i % 2 ? 1 : -1;
      const v = pick(this.G.buildings);
      b.geometry = v.geo;
      b.material = pick(this.facadeMats);
      const inset = rand(0, 5);
      b.position.x = side * (14.5 + v.d / 2 + inset);
      const z = side < 0 ? zL : zR;
      b.position.z = z - v.w / 2;
      b.rotation.y = Math.PI / 2;
      if (side < 0) zL -= v.w + rand(1, 3);
      else zR -= v.w + rand(1, 3);
      b.visible = b.position.z - v.w / 2 > -SEG_LEN - 2;
      const roof = b.children[0];
      roof.position.set(rand(-2, 2), v.h, rand(-2, 2));
      roof.visible = Math.random() < 0.7;
    });
  }

  reset() {
    this.stationRun = 0;
    this.segments.forEach((seg, i) => {
      seg.position.z = SEG_LEN - i * SEG_LEN;
      this.randomize(seg);
    });
  }

  update(playerZ) {
    for (const seg of this.segments) {
      if (seg.position.z - SEG_LEN > playerZ + 25) {
        seg.position.z -= SEG_COUNT * SEG_LEN;
        this.randomize(seg);
      }
    }
  }
}

// 列車、跳台、柵欄、金幣等 3D 模型
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  LIVERIES,
  liverySideTexture,
  liveryFrontTexture,
  stripeTexture,
  chevronTexture,
  glowTexture,
} from './textures.js';
import { CAR_LEN, CAR_GAP, TRAIN_W, TRAIN_TOP, RAMP_LEN } from './config.js';
import { VehicleModels } from './vehicles.js';

// 依材質分組收集幾何，最後合併成少量 Mesh，降低 draw call
class MergeBuilder {
  constructor() {
    this.parts = new Map();
  }
  add(key, geometry, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(1, 1, 1),
    );
    g.applyMatrix4(m);
    for (const name of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    }
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(g);
  }
  build(materials, { castShadow = true } = {}) {
    const out = [];
    for (const [key, list] of this.parts) {
      const mesh = new THREE.Mesh(mergeGeometries(list), materials[key]);
      mesh.castShadow = castShadow && key !== 'glass' && key !== 'light';
      mesh.receiveShadow = true;
      mesh.userData.key = key;
      out.push(mesh);
    }
    return out;
  }
}

export class Models {
  constructor() {
    this.shared = {
      dark: new THREE.MeshStandardMaterial({ color: '#1b1e23', roughness: 0.75, metalness: 0.4 }),
      metal: new THREE.MeshStandardMaterial({ color: '#8e959e', roughness: 0.32, metalness: 0.85 }),
      rubber: new THREE.MeshStandardMaterial({ color: '#2a2d31', roughness: 0.9 }),
      headlight: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.8, 4.2) }),
      headlightOff: new THREE.MeshStandardMaterial({ color: '#d8dde2', roughness: 0.1, metalness: 0.6, emissive: '#554c3a' }),
      taillight: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.25, 0.2) }),
    };
    this.glowMat = new THREE.SpriteMaterial({
      map: glowTexture(),
      color: '#fff3d6',
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    this.carCache = new Map();
    this.liveryMats = new Map();
    this.buildCommonGeometries();
    this.buildRamp();
    this.buildBarriers();
    this.buildCoin();
  }

  buildCommonGeometries() {
    this.geo = {
      body: new RoundedBoxGeometry(TRAIN_W, 2.55, CAR_LEN, 4, 0.2),
      side: new THREE.PlaneGeometry(CAR_LEN - 0.5, 2.2),
      front: new THREE.PlaneGeometry(TRAIN_W - 0.4, 2.2),
      under: new THREE.BoxGeometry(TRAIN_W - 0.3, 0.32, CAR_LEN - 0.6),
      bogie: new THREE.BoxGeometry(1.8, 0.28, 2.6),
      wheel: new THREE.CylinderGeometry(0.3, 0.3, 0.14, 20),
      axle: new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8),
      ac: new RoundedBoxGeometry(1.3, 0.24, 2.6, 2, 0.06),
      vent: new THREE.BoxGeometry(0.9, 0.1, 0.7),
      lamp: new THREE.CylinderGeometry(0.11, 0.11, 0.06, 16),
      bellows: new THREE.BoxGeometry(1.7, 2.2, CAR_GAP + 0.3),
    };
  }

  liveryMaterials(livery) {
    if (this.liveryMats.has(livery.id)) return this.liveryMats.get(livery.id);
    const side = liverySideTexture(livery);
    const front = liveryFrontTexture(livery);
    const mats = {
      ...this.shared,
      body: new THREE.MeshStandardMaterial({ color: livery.base, roughness: 0.42, metalness: 0.35 }),
      side: new THREE.MeshStandardMaterial({
        map: side.map,
        emissiveMap: side.emissiveMap,
        emissive: '#ffffff',
        emissiveIntensity: 1,
        roughness: 0.38,
        metalness: 0.3,
      }),
      front: new THREE.MeshStandardMaterial({
        map: front.map,
        emissiveMap: front.emissiveMap,
        emissive: '#ffffff',
        emissiveIntensity: 1.6,
        roughness: 0.3,
        metalness: 0.3,
      }),
    };
    this.liveryMats.set(livery.id, mats);
    return mats;
  }

  // 一節車廂：hasFront = 朝玩家那端有駕駛室，hasBack = 另一端
  car(livery, hasFront, hasBack, lit) {
    const key = `${livery.id}-${hasFront}-${hasBack}-${lit}`;
    if (this.carCache.has(key)) return this.carCache.get(key);
    const g = this.geo;
    const b = new MergeBuilder();
    const half = CAR_LEN / 2;
    b.add('body', g.body, { y: 2.225 });
    b.add('side', g.side, { x: TRAIN_W / 2 + 0.006, y: 2.2, ry: Math.PI / 2 });
    b.add('side', g.side, { x: -TRAIN_W / 2 - 0.006, y: 2.2, ry: -Math.PI / 2 });
    b.add('dark', g.under, { y: 0.86 });
    for (const bz of [half - 2.3, -half + 2.3]) {
      b.add('dark', g.bogie, { y: 0.62, z: bz });
      for (const wz of [bz - 0.85, bz + 0.85]) {
        for (const wx of [-0.72, 0.72]) b.add('metal', g.wheel, { x: wx, y: 0.6, z: wz, rz: Math.PI / 2 });
        b.add('dark', g.axle, { y: 0.6, z: wz, rz: Math.PI / 2 });
      }
    }
    b.add('metal', g.ac, { y: TRAIN_TOP + 0.1, z: -1.5 });
    b.add('dark', g.vent, { y: TRAIN_TOP + 0.03, z: 2.8 });
    b.add('dark', g.vent, { y: TRAIN_TOP + 0.03, z: 4.2 });
    const ends = [];
    if (hasFront) ends.push({ z: half + 0.006, ry: 0, lamp: lit ? 'headlight' : 'headlightOff' });
    if (hasBack) ends.push({ z: -half - 0.006, ry: Math.PI, lamp: 'taillight' });
    for (const e of ends) {
      b.add('front', g.front, { z: e.z, y: 2.2, ry: e.ry });
      for (const lx of [-0.59, 0.59]) {
        b.add(e.lamp, g.lamp, { x: lx, y: 1.58, z: e.z + Math.sign(e.z) * 0.03, rx: Math.PI / 2 });
      }
    }
    const meshes = b.build(this.liveryMaterials(livery));
    this.carCache.set(key, meshes);
    return meshes;
  }

  // 一列火車：原點在車頭最前端（z=0），往 -z 延伸
  train(cars, { livery = LIVERIES[(Math.random() * LIVERIES.length) | 0], lit = false, kind = 'train' } = {}) {
    // 其他場景用各自的交通工具或動物
    if (kind !== 'train') {
      this.vehicles ??= new VehicleModels(this.glowMat);
      return this.vehicles.make(kind, cars, { lit });
    }
    const group = new THREE.Group();
    for (let i = 0; i < cars; i++) {
      const templ = this.car(livery, i === 0, i === cars - 1, lit);
      const carGroup = new THREE.Group();
      for (const m of templ) {
        const mesh = new THREE.Mesh(m.geometry, m.material);
        mesh.castShadow = m.castShadow;
        mesh.receiveShadow = true;
        carGroup.add(mesh);
      }
      carGroup.position.z = -CAR_LEN / 2 - i * (CAR_LEN + CAR_GAP);
      group.add(carGroup);
      if (i > 0) {
        const bel = new THREE.Mesh(this.geo.bellows, this.shared.dark);
        bel.position.set(0, 2.1, -i * (CAR_LEN + CAR_GAP) + CAR_GAP / 2);
        group.add(bel);
      }
    }
    if (lit) {
      for (const lx of [-0.59, 0.59]) {
        const s = new THREE.Sprite(this.glowMat);
        s.scale.setScalar(2.4);
        s.position.set(lx, 1.58, 0.2);
        group.add(s);
      }
    }
    const length = cars * CAR_LEN + (cars - 1) * CAR_GAP;
    return { group, length };
  }

  buildRamp() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(RAMP_LEN, 0);
    shape.lineTo(RAMP_LEN, TRAIN_TOP);
    shape.lineTo(RAMP_LEN - 0.5, TRAIN_TOP);
    shape.closePath();
    const body = new THREE.ExtrudeGeometry(shape, { depth: 2.1, bevelEnabled: false });
    body.rotateY(Math.PI / 2);
    body.translate(-1.05, 0, 0);
    const b = new MergeBuilder();
    // 用框架代替實心：外側兩片薄鋼板
    const plate = body.clone();
    plate.scale(0.06, 1, 1);
    b.add('metal', plate, { x: -1.0 });
    b.add('metal', plate, { x: 1.0 });
    // 支撐柱
    const post = new THREE.BoxGeometry(0.12, 1, 0.12);
    for (let i = 1; i <= 4; i++) {
      const z = -(RAMP_LEN * i) / 4.4;
      const h = (TRAIN_TOP * -z) / RAMP_LEN;
      const p = post.clone();
      p.scale(1, h, 1);
      b.add('dark', p, { x: -0.8, y: h / 2, z });
      b.add('dark', p, { x: 0.8, y: h / 2, z });
    }
    const slopeLen = Math.hypot(RAMP_LEN, TRAIN_TOP);
    const deck = new THREE.BoxGeometry(2.1, 0.12, slopeLen);
    const angle = Math.atan2(TRAIN_TOP, RAMP_LEN);
    b.add('deck', deck, { y: TRAIN_TOP / 2 - 0.06, z: -RAMP_LEN / 2, rx: angle });
    const chevron = chevronTexture();
    chevron.repeat.set(1, 3);
    const deckMat = new THREE.MeshStandardMaterial({ map: chevron, roughness: 0.6, metalness: 0.4 });
    this.rampMeshes = b.build({ ...this.shared, deck: deckMat });
  }

  ramp() {
    const group = new THREE.Group();
    for (const m of this.rampMeshes) {
      const mesh = new THREE.Mesh(m.geometry, m.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }

  buildBarriers() {
    const stripe = stripeTexture();
    const stripeMat = new THREE.MeshStandardMaterial({ map: stripe, roughness: 0.45, metalness: 0.1 });
    const warn = stripeTexture('#1b1b1b', '#ffc400');
    warn.repeat.set(2, 1);
    const warnMat = new THREE.MeshStandardMaterial({ map: warn, roughness: 0.5 });
    const redLamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.4, 0.2) });
    const mats = { ...this.shared, stripe: stripeMat, warn: warnMat, red: redLamp };

    // 低柵欄：需要跳過
    const low = new MergeBuilder();
    const post = new THREE.BoxGeometry(0.12, 1.1, 0.12);
    const foot = new THREE.BoxGeometry(0.2, 0.08, 0.7);
    for (const x of [-0.95, 0.95]) {
      low.add('metal', post, { x, y: 0.55 });
      low.add('dark', foot, { x, y: 0.3 });
    }
    low.add('stripe', new RoundedBoxGeometry(2.1, 0.42, 0.12, 2, 0.04), { y: 0.86 });
    low.add('stripe', new RoundedBoxGeometry(2.1, 0.22, 0.1, 2, 0.03), { y: 0.42 });
    low.add('red', new THREE.SphereGeometry(0.07, 12, 8), { x: -0.95, y: 1.15 });
    low.add('red', new THREE.SphereGeometry(0.07, 12, 8), { x: 0.95, y: 1.15 });
    this.lowMeshes = low.build(mats);

    // 高柵欄：需要滑鏟
    const high = new MergeBuilder();
    const tall = new THREE.BoxGeometry(0.14, 2.6, 0.14);
    for (const x of [-1.08, 1.08]) {
      high.add('metal', tall, { x, y: 1.3 });
      high.add('dark', foot, { x, y: 0.3 });
    }
    high.add('warn', new RoundedBoxGeometry(2.3, 0.9, 0.14, 2, 0.05), { y: 1.98 });
    high.add('dark', new THREE.BoxGeometry(2.3, 0.08, 0.16), { y: 2.47 });
    high.add('red', new THREE.CylinderGeometry(0.1, 0.1, 0.14, 12), { y: 2.62 });
    this.highMeshes = high.build(mats);
  }

  barrier(kind) {
    const src = kind === 'low' ? this.lowMeshes : this.highMeshes;
    const group = new THREE.Group();
    for (const m of src) {
      const mesh = new THREE.Mesh(m.geometry, m.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }

  buildCoin() {
    const pts = [
      [0, 0.05], [0.28, 0.05], [0.3, 0.035], [0.33, 0.035], [0.35, 0.075], [0.41, 0.075],
      [0.43, 0.045], [0.43, -0.045], [0.41, -0.075], [0.35, -0.075], [0.33, -0.035],
      [0.3, -0.035], [0.28, -0.05], [0, -0.05],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const coin = new THREE.LatheGeometry(pts, 40);
    coin.rotateX(Math.PI / 2);
    // 中間的星形浮雕
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.2 : 0.09;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) star.moveTo(x, y);
      else star.lineTo(x, y);
    }
    const starGeo = new THREE.ExtrudeGeometry(star, {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
    });
    starGeo.translate(0, 0, -0.04);
    this.coinGeo = mergeGeometries([
      coin.toNonIndexed(),
      (() => {
        const g = starGeo.index ? starGeo.toNonIndexed() : starGeo;
        g.clearGroups();
        return g;
      })(),
    ]);
    this.coinMat = new THREE.MeshStandardMaterial({
      color: '#ffc21a',
      metalness: 1,
      roughness: 0.22,
      emissive: '#6b3d00',
      emissiveIntensity: 0.55,
    });
  }

  coin() {
    const m = new THREE.Mesh(this.coinGeo, this.coinMat);
    m.castShadow = true;
    return m;
  }
}

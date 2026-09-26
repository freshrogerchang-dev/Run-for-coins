// 第 17、18 個場景：日本地鐵、台灣輕軌
// 每個 build 函式以 Environment 為 this 呼叫，回傳 { group, randomize, tick? }
import * as THREE from 'three';
import { rand, pick, merged, mesh, fixNormals } from './geo.js';
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

function assets(env, id, create) {
  env._extra3 ??= {};
  env._extra3[id] ??= create(env);
  return env._extra3[id];
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

const FONT = '"Noto Sans TC", "Hiragino Sans", "PingFang TC", sans-serif';

// ======================= 日本地鐵 =======================
const JP_LINE = '#f08c1c';
const JP_STATIONS = [
  ['金山', 'かねやま', 'Kaneyama', 'G05'],
  ['星見台', 'ほしみだい', 'Hoshimidai', 'G06'],
  ['桜町', 'さくらまち', 'Sakuramachi', 'G07'],
  ['月島橋', 'つきしまばし', 'Tsukishimabashi', 'G08'],
  ['海風', 'うみかぜ', 'Umikaze', 'G09'],
];

// 白色磁磚牆 + 路線色帶
function jpWallTexture() {
  const t = canvasTex(
    256,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#c3c6c4';
      ctx.fillRect(0, 0, w, h);
      const cols = 8;
      const rows = 28;
      const tw = w / cols;
      const th = h / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const v = 232 + ((r * 7 + c * 13) % 9);
          ctx.fillStyle = `rgb(${v},${v + 2},${v})`;
          ctx.fillRect(c * tw + 1.5, r * th + 1.5, tw - 3, th - 3);
        }
      }
      // 路線色帶
      ctx.fillStyle = JP_LINE;
      ctx.fillRect(0, h * 0.55, w, h * 0.05);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, h * 0.6, w, h * 0.008);
      // 下方深色腰牆
      ctx.fillStyle = '#5b5f66';
      ctx.fillRect(0, h * 0.86, w, h * 0.14);
    },
    true,
  );
  t.repeat.set(L / 4, 1);
  return t;
}

// 月台站名板：漢字、平假名、羅馬拼音，下方是前後站
function jpSignTexture([kanji, kana, romaji, code], prev, next) {
  return canvasTex(512, 144, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    // 車站編號圓圈
    ctx.strokeStyle = JP_LINE;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(48, 56, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 22px ${FONT}`;
    ctx.fillText(code, 48, 57);
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText(kana, w / 2, 18);
    ctx.font = `900 52px ${FONT}`;
    ctx.fillText(kanji, w / 2, 62);
    ctx.font = `700 18px ${FONT}`;
    ctx.fillText(romaji, w / 2, 100);
    ctx.fillStyle = JP_LINE;
    ctx.fillRect(0, 116, w, 28);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 17px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`◀ ${prev}`, 12, 131);
    ctx.textAlign = 'right';
    ctx.fillText(`${next} ▶`, w - 12, 131);
  });
}

// LED 發車資訊看板
function jpBoardTexture() {
  return canvasTex(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, w, h);
    ctx.textBaseline = 'middle';
    ctx.font = `900 34px ${FONT}`;
    const rows = [
      ['急行', '#ff5a3c', '星見台', '12:34'],
      ['各停', '#3dff7a', '海風', '12:38'],
    ];
    rows.forEach(([kind, color, dest, time], i) => {
      const y = 34 + i * 60;
      ctx.fillStyle = color;
      ctx.fillText(kind, 14, y);
      ctx.fillStyle = '#ffb000';
      ctx.fillText(dest, 120, y);
      ctx.fillText(time, 380, y);
    });
  });
}

function japanAssets(env) {
  const R = 7.4; // 牆面 x
  const H = 7.6; // 天花板高度
  const G = {
    wall: box(0.4, H, L).translate(0, H / 2, HALF),
    ceiling: box(2 * R + 0.8, 0.4, L).translate(0, H + 0.2, HALF),
    ceilLights: merged(
      [-3.4, 0, 3.4].flatMap((x) => [0, 1, 2, 3, 4, 5].map((k) => [box(0.34, 0.06, 4.2), x, H - 0.03, -3.3 - k * 6.67])),
    ),
    ceilTroughs: merged([-3.4, 0, 3.4].map((x) => [box(0.6, 0.12, L), x, H - 0.02, HALF])),
    cables: merged([2.6, 2.85, 3.1].map((y) => [cyl(0.06, 0.06, L, 6).rotateX(Math.PI / 2), 0, y, HALF])),
    signal: merged([
      [box(0.3, 0.8, 0.25), 0, 2.2, 0],
      [cyl(0.03, 0.03, 2.2, 6), 0, 1.1, 0],
    ]),
    lamp: sph(0.09),
    exitSign: box(0.08, 0.3, 0.9),
    // 月台
    platform: box(3.6, 1.1, L).translate(0, 0.55, HALF),
    platformTop: box(3.6, 0.04, L).translate(0, 1.12, HALF),
    edge: box(0.3, 0.05, L).translate(0, 1.13, HALF),
    doorFrames: merged([
      ...Array.from({ length: 21 }, (_, k) => [box(0.12, 1.5, 0.12), 0, 1.85, -k * 2]),
      [box(0.2, 0.28, L), 0, 2.72, HALF],
    ]),
    doorGlass: merged(Array.from({ length: 20 }, (_, k) => [box(0.04, 1.3, 1.8), 0, 1.8, -1 - k * 2])),
    doorLights: merged(Array.from({ length: 10 }, (_, k) => [box(0.06, 0.08, 1.0), 0, 2.62, -3 - k * 4])),
    pillar: box(0.7, H - 1.1, 0.7).translate(0, 1.1 + (H - 1.1) / 2, 0),
    pillarBand: box(0.74, 0.35, 0.74).translate(0, 3.9, 0),
    sign: new THREE.PlaneGeometry(3.4, 0.96),
    signBack: box(3.5, 1.04, 0.08),
    hanger: merged([
      [cyl(0.02, 0.02, 2.5, 5), -1.4, 1.25, 0],
      [cyl(0.02, 0.02, 2.5, 5), 1.4, 1.25, 0],
    ]),
    board: box(2.4, 0.64, 0.14),
    boardFace: new THREE.PlaneGeometry(2.3, 0.56),
    vending: box(0.85, 1.9, 1.1).translate(0, 0.95, 0),
    vendPanel: box(0.04, 1.1, 0.9).translate(0, 1.25, 0),
    vendSlot: box(0.05, 0.25, 0.7).translate(0, 0.35, 0),
    bench: merged([
      [box(0.5, 0.08, 2.4), 0, 0.46, 0],
      [box(0.08, 0.5, 2.4), 0.22, 0.72, 0],
      [box(0.4, 0.44, 0.08), 0, 0.22, -1.0],
      [box(0.4, 0.44, 0.08), 0, 0.22, 1.0],
    ]),
  };
  // 入口：大牆面上挖一個矩形洞口
  const shape = new THREE.Shape();
  shape.moveTo(-60, -0.5);
  shape.lineTo(60, -0.5);
  shape.lineTo(60, 24);
  shape.lineTo(-60, 24);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-R, -0.3);
  hole.lineTo(-R, H);
  hole.lineTo(R, H);
  hole.lineTo(R, -0.3);
  hole.closePath();
  shape.holes.push(hole);
  G.portal = fixNormals(new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false }).translate(0, 0, -3));
  G.portalBand = box(2 * R + 1.6, 1.2, 0.3).translate(0, H + 0.6, 0.15);

  const wallTex = jpWallTexture();
  const names = JP_STATIONS.map((s) => s[0]);
  const M = {
    wall: new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.35 }),
    ceiling: std('#3b3e45', { roughness: 0.9 }),
    trough: std('#d8dade', { roughness: 0.4 }),
    light: glow(3.1, 3.2, 3.3),
    cable: std('#1c1c1e', { roughness: 0.6 }),
    signalBody: std('#2a2c30', { roughness: 0.6 }),
    red: glow(4, 0.4, 0.3),
    green: glow(0.3, 3.6, 1),
    exit: glow(0.3, 3.4, 1.2),
    platform: std('#8f8c86', { roughness: 0.9 }),
    platformTop: std('#c9c4bb', { roughness: 0.6 }),
    tactile: std('#f2c200', { roughness: 0.6 }),
    frame: std('#a7adb5', { roughness: 0.3, metalness: 0.7 }),
    glass: new THREE.MeshStandardMaterial({ color: '#bfe4ff', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, depthWrite: false }),
    doorLight: glow(3.6, 1.8, 0.4),
    pillar: std('#eef0ee', { roughness: 0.4 }),
    line: std(JP_LINE, { roughness: 0.5 }),
    signs: JP_STATIONS.map((s, i) =>
      new THREE.MeshBasicMaterial({
        map: jpSignTexture(s, names[(i + names.length - 1) % names.length], names[(i + 1) % names.length]),
        color: new THREE.Color(1.15, 1.15, 1.15),
        side: THREE.DoubleSide,
      }),
    ),
    signBack: std('#3a3d44', { roughness: 0.5 }),
    board: std('#1a1a1c', { roughness: 0.5 }),
    boardFace: new THREE.MeshBasicMaterial({ map: jpBoardTexture(), color: new THREE.Color(1.6, 1.6, 1.6) }),
    vend: ['#d7263d', '#1f6fd1', '#f4f4f0'].map((c) => std(c, { roughness: 0.35, metalness: 0.2 })),
    vendPanel: glow(2.4, 2.5, 2.6),
    dark: std('#202226', { roughness: 0.6 }),
    bench: std('#3a7bd5', { roughness: 0.4 }),
    portal: std('#8e8a82', { roughness: 0.95 }),
  };
  return { G, M, R, H };
}

function build_japan() {
  const { G, M, R } = assets(this, 'japan', japanAssets);
  const group = new THREE.Group();
  // 隧道本體：磁磚牆、天花板、日光燈
  for (const s of [-1, 1]) {
    const w = mesh(G.wall, M.wall);
    w.position.x = s * (R + 0.2);
    w.rotation.y = s > 0 ? Math.PI : 0;
    const cab = mesh(G.cables, M.cable);
    cab.position.x = s * (R - 0.1);
    group.add(w, cab);
  }
  group.add(mesh(G.ceiling, M.ceiling), mesh(G.ceilTroughs, M.trough), new THREE.Mesh(G.ceilLights, M.light));

  // 隧道區段的號誌燈與緊急出口
  const tunnelBits = new THREE.Group();
  const signals = [];
  for (let i = 0; i < 2; i++) {
    const sg = new THREE.Group();
    sg.add(mesh(G.signal, M.signalBody, { cast: true }));
    const top = new THREE.Mesh(G.lamp, M.red);
    top.position.set(0, 2.45, 0.13);
    const bottom = new THREE.Mesh(G.lamp, M.green);
    bottom.position.set(0, 2.0, 0.13);
    sg.add(top, bottom);
    tunnelBits.add(sg);
    signals.push(sg);
  }
  const exits = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(G.exitSign, M.exit);
    e.position.set(s * (R - 0.05), 4.2, -20);
    tunnelBits.add(e);
    exits.push(e);
  }
  group.add(tunnelBits);

  // 車站：兩側月台、月台門、站名板、柱子、自動販賣機
  const station = new THREE.Group();
  const stationSigns = [];
  for (const s of [-1, 1]) {
    const cx = s * 5.8;
    const pf = mesh(G.platform, M.platform);
    pf.position.x = cx;
    const top = mesh(G.platformTop, M.platformTop);
    top.position.x = cx;
    const edge = mesh(G.edge, M.tactile);
    edge.position.x = s * 4.55;
    const frames = mesh(G.doorFrames, M.frame, { cast: true });
    frames.position.x = s * 4.15;
    const glass = new THREE.Mesh(G.doorGlass, M.glass);
    glass.position.x = s * 4.15;
    const lights = new THREE.Mesh(G.doorLights, M.doorLight);
    lights.position.x = s * 4.07;
    station.add(pf, top, edge, frames, glass, lights);
    for (const z of [-6, -18, -30]) {
      const p = mesh(G.pillar, M.pillar, { cast: true });
      p.position.set(s * 6.6, 0, z);
      const band = mesh(G.pillarBand, M.line);
      band.position.set(s * 6.6, 0, z);
      station.add(p, band);
    }
    // 站名板（面向跑者）
    const sign = new THREE.Group();
    const back = mesh(G.signBack, M.signBack);
    back.position.z = -0.05;
    const face = new THREE.Mesh(G.sign, M.signs[0]);
    face.position.z = 0.0;
    const hanger = mesh(G.hanger, M.frame);
    hanger.position.y = 0.5;
    sign.add(back, face, hanger);
    sign.position.set(cx, 4.6, -12);
    station.add(sign);
    stationSigns.push(face);
    // LED 發車看板
    const board = new THREE.Group();
    board.add(mesh(G.board, M.board));
    const bf = new THREE.Mesh(G.boardFace, M.boardFace);
    bf.position.z = 0.075;
    board.add(bf);
    board.position.set(cx, 3.9, -28);
    station.add(board);
    // 自動販賣機
    for (let k = 0; k < 2; k++) {
      const vm = new THREE.Group();
      vm.add(mesh(G.vending, M.vend[(k + (s > 0 ? 1 : 0)) % 3], { cast: true }));
      const panel = new THREE.Mesh(G.vendPanel, M.vendPanel);
      panel.position.x = -s * 0.44;
      const slot = mesh(G.vendSlot, M.dark);
      slot.position.x = -s * 0.44;
      vm.add(panel, slot);
      vm.position.set(s * 6.95, 1.1, -21 - k * 1.2);
      station.add(vm);
    }
    const bench = mesh(G.bench, M.bench, { cast: true });
    bench.position.set(s * 6.9, 1.1, -36);
    bench.rotation.y = s > 0 ? Math.PI : 0;
    station.add(bench);
  }
  group.add(station);

  const portal = new THREE.Group();
  portal.add(mesh(G.portal, M.portal), mesh(G.portalBand, M.line));
  group.add(portal);

  const randomize = ({ first }) => {
    portal.visible = first;
    station.visible = !first && Math.random() < 0.35;
    tunnelBits.visible = !station.visible;
    const st = pick(M.signs);
    for (const f of stationSigns) f.material = st;
    signals.forEach((sg, i) => {
      sg.visible = Math.random() < 0.4;
      sg.position.set(side(i) * (R - 0.35), 0, -rand(4, L - 4));
    });
    exits.forEach((e) => (e.visible = Math.random() < 0.5));
  };
  return { group, randomize };
}

// ======================= 台灣輕軌 =======================
const TW_SHOPS = [
  ['珍珠奶茶', '#ff8a3d', '#ffffff'],
  ['滷肉飯', '#d7263d', '#fff3c4'],
  ['雞排', '#ffd23f', '#b3261e'],
  ['豆花', '#3aa17e', '#ffffff'],
  ['鹽酥雞', '#1f6fd1', '#ffffff'],
  ['刈包', '#7b3fe4', '#ffffff'],
];

function twShopTexture([text, bg, ink]) {
  return canvasTex(128, 384, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = ink;
    ctx.font = `900 ${text.length > 3 ? 64 : 76}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const step = (h - 40) / text.length;
    [...text].forEach((ch, i) => ctx.fillText(ch, w / 2, 20 + step * (i + 0.5)));
  });
}

function twStopTexture() {
  return canvasTex(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#12836b';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(64, 64, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#12836b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 34px ${FONT}`;
    ctx.fillText('C8', 64, 66);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.font = `900 48px ${FONT}`;
    ctx.fillText('金幣港站', 124, 50);
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText('Coin Harbor  輕軌 LRT', 126, 98);
  });
}

function taiwanAssets(env) {
  const G = {
    sidewalk: box(3.2, 0.25, L).translate(0, 0.125, HALF),
    curb: box(0.25, 0.35, L).translate(0, 0.175, HALF),
    hedge: box(0.7, 0.55, L - 0.4).translate(0, 0.45, HALF),
    blossoms: merged(Array.from({ length: 26 }, (_, k) => [sph(0.2, 6, 4), (k % 3) * 0.2 - 0.2, 0.78, -0.8 - k * 1.5])),
    lampPole: cyl(0.07, 0.1, 5.2, 8).translate(0, 2.6, 0),
    lampArm: box(1.3, 0.08, 0.1).translate(-0.6, 5.1, 0),
    lampHead: box(0.5, 0.12, 0.28).translate(-1.2, 5.0, 0),
    // 港邊
    quay: box(12, 1.2, L).translate(6, -0.4, HALF),
    bollards: merged(Array.from({ length: 5 }, (_, k) => [cyl(0.22, 0.26, 0.6, 10), 11.6, 0.5, -4 - k * 8])),
    water: new THREE.PlaneGeometry(400, L).rotateX(-Math.PI / 2).translate(212, -0.6, HALF),
    container: box(2.4, 2.6, 6).translate(0, 1.3, 0),
    crane: merged([
      [box(0.6, 22, 0.6), -4, 11, -3],
      [box(0.6, 22, 0.6), 4, 11, -3],
      [box(0.6, 22, 0.6), -4, 11, 3],
      [box(0.6, 22, 0.6), 4, 11, 3],
      [box(9, 0.6, 0.6), 0, 14, -3],
      [box(9, 0.6, 0.6), 0, 14, 3],
      [box(40, 1.4, 1.6), 12, 22.5, 0],
      [box(3, 3, 5), -2, 24, 0],
      [box(0.3, 9, 0.3), -1, 27, 0, 0, 0, -0.9],
    ]),
    craneStripe: merged([
      [box(0.64, 2, 0.64), -4, 18, -3],
      [box(0.64, 2, 0.64), 4, 18, -3],
      [box(0.64, 2, 0.64), -4, 18, 3],
      [box(0.64, 2, 0.64), 4, 18, 3],
    ]),
    ship: merged([
      [box(14, 6, 70), 0, 1, 0],
      [box(10, 8, 10), 0, 8, 26],
      [box(4, 5, 4), 0, 14, 26],
    ]),
    shipStack: merged(
      Array.from({ length: 12 }, (_, k) => [box(12, 2.6, 5.4), 0, 5.3 + (k % 3) * 2.6, -25 + Math.floor(k / 3) * 12]),
    ),
    // 駁二風格的紅磚倉庫
    warehouse: box(14, 7, 12).translate(0, 3.5, 0),
    warehouseRoof: new THREE.CylinderGeometry(7.2, 7.2, 12.2, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).scale(1, 0.35, 1).translate(0, 7, 0),
    shopSign: new THREE.PlaneGeometry(1.4, 4.2),
    // 高塔（遠景）
    tower: merged([
      [box(14, 150, 14), -9, 75, 0],
      [box(14, 150, 14), 9, 75, 0],
      [box(34, 70, 16), 0, 185, 0],
      [cyl(1.5, 2.5, 40, 8), 0, 240, 0],
    ]),
    // 輕軌車站
    stopDeck: box(2.2, 0.35, 16).translate(0, 0.175, 0),
    stopPosts: merged([-6, -2, 2, 6].map((z) => [cyl(0.08, 0.08, 3.7, 8), 0.6, 2.1, z])),
    stopRoof: new THREE.CylinderGeometry(1.8, 1.8, 17, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).scale(0.7, 0.35, 1).translate(0.2, 3.9, 0),
    stopSign: new THREE.PlaneGeometry(3.2, 0.8),
    scooter: merged([
      [box(0.35, 0.5, 1.4), 0, 0.55, 0],
      [box(0.3, 0.5, 0.35), 0, 0.95, -0.45],
      [cyl(0.25, 0.25, 0.12, 12), 0, 0.25, 0.55, 0, 0, Math.PI / 2],
      [cyl(0.25, 0.25, 0.12, 12), 0, 0.25, -0.55, 0, 0, Math.PI / 2],
      [box(0.6, 0.05, 0.05), 0, 1.25, -0.55],
    ]),
  };
  const M = {
    sidewalk: std('#c7a58a', { roughness: 0.9 }),
    curb: std('#b9b3aa', { roughness: 0.8 }),
    hedge: flat('#3f8a3a', { roughness: 0.9 }),
    blossom: flat('#ff4fa3', { roughness: 0.7 }),
    pole: std('#6d747c', { roughness: 0.4, metalness: 0.6 }),
    lamp: glow(3.2, 3, 2.6),
    quay: std('#9a958c', { roughness: 0.9 }),
    bollard: std('#2b2d31', { roughness: 0.5 }),
    containers: ['#c0392b', '#1f6fd1', '#27ae60', '#f39c12', '#8e44ad', '#16a085'].map((c) => std(c, { roughness: 0.7 })),
    crane: std('#e8e4dc', { roughness: 0.6 }),
    craneRed: std('#d63a2a', { roughness: 0.5 }),
    ship: std('#23364f', { roughness: 0.6 }),
    brick: std('#a4553a', { roughness: 0.9 }),
    roof: std('#4a4f55', { roughness: 0.7, side: THREE.DoubleSide }),
    shops: TW_SHOPS.map((s) => new THREE.MeshStandardMaterial({ map: twShopTexture(s), roughness: 0.5, emissive: '#ffffff', emissiveMap: twShopTexture(s), emissiveIntensity: 0.25, side: THREE.DoubleSide })),
    tower: std('#5d7188', { roughness: 0.4, metalness: 0.4 }),
    stopDeck: std('#d9d5cc', { roughness: 0.8 }),
    stopRoof: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, metalness: 0.2, side: THREE.DoubleSide }),
    stopSign: new THREE.MeshBasicMaterial({ map: twStopTexture(), color: new THREE.Color(1.1, 1.1, 1.1), side: THREE.DoubleSide }),
    scooters: ['#e84a5f', '#ffffff', '#3dade0', '#2b2d31'].map((c) => std(c, { roughness: 0.4, metalness: 0.3 })),
  };
  return { G, M };
}

function build_taiwan() {
  const { G, M } = assets(this, 'taiwan', taiwanAssets);
  const E = this.G;
  const EM = this.mat;
  const group = new THREE.Group();

  // 兩側人行道、矮籬笆與九重葛
  const hedges = [];
  for (const s of [-1, 1]) {
    const sw = mesh(G.sidewalk, M.sidewalk);
    sw.position.x = s * 6.3;
    const curb = mesh(G.curb, M.curb);
    curb.position.x = s * 4.6;
    const hedge = mesh(G.hedge, M.hedge, { cast: true });
    hedge.position.x = s * 5.1;
    const bl = mesh(G.blossoms, M.blossom);
    bl.position.x = s * 5.1;
    group.add(sw, curb, hedge, bl);
    hedges.push(hedge, bl);
  }
  // 椰子樹與路燈
  const palms = [];
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Group();
    p.add(mesh(E.palmTrunk, EM.palmTrunk, { cast: true }), mesh(E.palmLeaves, EM.palmLeaf, { cast: true }));
    group.add(p);
    palms.push(p);
  }
  const lamps = [];
  for (let i = 0; i < 4; i++) {
    const l = new THREE.Group();
    l.add(mesh(G.lampPole, M.pole, { cast: true }), mesh(G.lampArm, M.pole), new THREE.Mesh(G.lampHead, M.lamp));
    group.add(l);
    lamps.push(l);
  }
  // 左邊：街道、小吃店招牌、紅磚倉庫、遠方高塔
  const buildings = this.makeBuildings(group, 6);
  const shops = [];
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(G.shopSign, M.shops[0]);
    group.add(s);
    shops.push(s);
  }
  const warehouse = new THREE.Group();
  warehouse.add(mesh(G.warehouse, M.brick, { cast: true }), mesh(G.warehouseRoof, M.roof, { cast: true }));
  group.add(warehouse);
  const scooters = [];
  for (let i = 0; i < 5; i++) {
    const sc = mesh(G.scooter, M.scooters[i % 4], { cast: true });
    group.add(sc);
    scooters.push(sc);
  }
  const tower = mesh(G.tower, M.tower, { receive: false });
  group.add(tower);

  // 右邊：港口、貨櫃、起重機、貨輪
  const harbor = new THREE.Group();
  harbor.add(mesh(G.quay, M.quay), mesh(G.bollards, M.bollard), mesh(G.water, EM.water, { receive: false }));
  harbor.position.x = 13;
  group.add(harbor);
  const containers = [];
  for (let i = 0; i < 8; i++) {
    const c = mesh(G.container, M.containers[i % 6], { cast: true });
    harbor.add(c);
    containers.push(c);
  }
  const crane = new THREE.Group();
  crane.add(mesh(G.crane, M.crane, { cast: true }), mesh(G.craneStripe, M.craneRed));
  harbor.add(crane);
  const ship = new THREE.Group();
  ship.add(mesh(G.ship, M.ship), mesh(G.shipStack, M.containers[0]));
  harbor.add(ship);

  // 輕軌車站
  const stop = new THREE.Group();
  for (const s of [-1, 1]) {
    const deck = mesh(G.stopDeck, M.stopDeck);
    deck.position.x = s * 5.0;
    const posts = mesh(G.stopPosts, M.pole, { cast: true });
    posts.position.x = s * 5.0;
    posts.scale.x = s;
    const roof = mesh(G.stopRoof, M.stopRoof, { cast: true });
    roof.position.x = s * 5.0;
    roof.scale.x = s;
    const sign = new THREE.Mesh(G.stopSign, M.stopSign);
    sign.position.set(s * 5.2, 2.7, 7.6);
    stop.add(deck, posts, roof, sign);
  }
  group.add(stop);

  const randomize = () => {
    palms.forEach((p, i) => {
      p.position.set(side(i) * rand(6.6, 7.4), 0.25, -3 - i * 6.2 - rand(0, 2));
      p.rotation.y = rand(0, 6);
      p.scale.setScalar(rand(0.85, 1.2));
    });
    lamps.forEach((l, i) => {
      l.position.set(side(i) * 7.6, 0.25, -5 - i * 10);
      l.rotation.y = side(i) > 0 ? 0 : Math.PI;
    });
    shops.forEach((s) => (s.visible = false));
    let n = 0;
    this.placeBuildings(buildings, this.facadeMats, (b, sd, v) => {
      if (sd > 0 || n >= shops.length || Math.random() < 0.3) return;
      const s = shops[n++];
      s.material = pick(M.shops);
      s.visible = true;
      s.position.set(-(14.5 - 0.3), rand(3.2, 5), b.position.z + rand(-3, 3));
      s.rotation.y = Math.PI / 2;
    });
    // 右邊是港口，不放大樓
    buildings.forEach((b) => {
      if (b.position.x > 0) b.visible = false;
    });
    warehouse.visible = Math.random() < 0.25;
    warehouse.position.set(-rand(16, 20), 0, -rand(8, L - 8));
    scooters.forEach((sc, i) => {
      sc.visible = Math.random() < 0.6;
      sc.position.set(-rand(6.0, 7.2), 0.25, -rand(2, L - 2));
      sc.rotation.y = rand(-0.4, 0.4) + (i % 2 ? Math.PI : 0);
    });
    tower.visible = Math.random() < 0.12;
    tower.position.set(-rand(160, 220), -2, -20);
    containers.forEach((c, i) => {
      c.visible = Math.random() < 0.7;
      c.position.set(rand(3, 9), 0.2 + (i % 3 === 2 ? 2.6 : 0), -3 - (i % 5) * 7.5);
      c.rotation.y = rand(-0.05, 0.05);
    });
    crane.visible = Math.random() < 0.35;
    crane.position.set(6, 0.2, -rand(8, L - 8));
    ship.visible = Math.random() < 0.3;
    ship.position.set(rand(28, 40), -0.6, -20);
    // 車站時月台取代矮籬笆
    stop.visible = Math.random() < 0.22;
    stop.position.z = -rand(10, L - 10);
    for (const h of hedges) h.visible = !stop.visible;
  };
  return { group, randomize };
}

export const EXTRA_BUILDERS3 = {
  japan: build_japan,
  taiwan: build_taiwan,
};

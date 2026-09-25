// 所有貼圖都用 Canvas 程序化繪製，不需要任何外部圖片檔。
import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(canvas, { srgb = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function noise(ctx, w, h, count, alpha, light = true) {
  for (let i = 0; i < count; i++) {
    const v = light ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${Math.random() * alpha})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, rand(1, 3), rand(1, 3));
  }
}

// ---------- 碎石道床 ----------
export function gravelTexture() {
  const [c, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#5d564f';
  ctx.fillRect(0, 0, 512, 512);
  const tones = ['#7a7168', '#8b8279', '#4b453f', '#6a6158', '#9a9186', '#57504a', '#736a5f'];
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = rand(1.5, 5);
    ctx.fillStyle = pick(tones);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * rand(0.6, 1), Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.25, y - r * 0.3, r * 0.45, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // 油漬
  for (let i = 0; i < 12; i++) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rand(30, 80));
    g.addColorStop(0, 'rgba(20,16,12,0.35)');
    g.addColorStop(1, 'rgba(20,16,12,0)');
    ctx.save();
    ctx.translate(Math.random() * 512, Math.random() * 512);
    ctx.fillStyle = g;
    ctx.fillRect(-80, -80, 160, 160);
    ctx.restore();
  }
  return toTexture(c);
}

// ---------- 木枕木 ----------
export function woodTexture() {
  const [c, ctx] = makeCanvas(256, 64);
  ctx.fillStyle = '#4a3423';
  ctx.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(${pick(['30,20,12', '90,66,44', '60,42,28'])},${rand(0.3, 0.7)})`;
    ctx.lineWidth = rand(0.5, 2);
    ctx.beginPath();
    const y = Math.random() * 64;
    ctx.moveTo(0, y);
    for (let x = 0; x <= 256; x += 32) ctx.lineTo(x, y + rand(-2, 2));
    ctx.stroke();
  }
  noise(ctx, 256, 64, 600, 0.15, false);
  return toTexture(c);
}

// ---------- 水泥牆 + 塗鴉 ----------
const GRAFFITI_WORDS = ['RUN!', 'COINS', 'GO GO', 'ZOOM', 'JUMP', 'WOW', 'FAST', 'YEAH'];
const GRAFFITI_PALETTES = [
  ['#ff3d7f', '#ffb13d'],
  ['#34d1ff', '#6f5bff'],
  ['#7dff6a', '#00b894'],
  ['#ffe03d', '#ff6a00'],
  ['#ff5ef1', '#5ef1ff'],
];

export function wallTexture() {
  const W = 1024;
  const H = 256;
  const [c, ctx] = makeCanvas(W, H);
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#9c9891');
  base.addColorStop(1, '#7c7871');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  noise(ctx, W, H, 5000, 0.12, false);
  noise(ctx, W, H, 3000, 0.1, true);
  // 水泥板接縫
  for (let x = 0; x <= W; x += 256) {
    ctx.fillStyle = 'rgba(40,38,35,0.55)';
    ctx.fillRect(x - 2, 0, 4, H);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + 2, 0, 2, H);
  }
  // 雨水痕
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * W;
    const len = rand(30, 140);
    const g = ctx.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, 'rgba(40,36,30,0.35)');
    g.addColorStop(1, 'rgba(40,36,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, rand(3, 12), len);
  }
  // 塗鴉
  const pieces = 2;
  for (let p = 0; p < pieces; p++) {
    const cx = (p + 0.5) * (W / pieces) + rand(-80, 80);
    const cy = H * 0.58 + rand(-15, 15);
    const word = pick(GRAFFITI_WORDS);
    const [c1, c2] = pick(GRAFFITI_PALETTES);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rand(-0.12, 0.12));
    ctx.font = `900 ${Math.round(rand(88, 112))}px "Bungee", Impact, "Arial Black", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    // 陰影層
    ctx.fillStyle = 'rgba(15,15,25,0.9)';
    ctx.fillText(word, 8, 8);
    // 外框
    ctx.strokeStyle = '#121218';
    ctx.lineWidth = 18;
    ctx.strokeText(word, 0, 0);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    ctx.strokeText(word, 0, 0);
    const g = ctx.createLinearGradient(0, -50, 0, 50);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillText(word, 0, 0);
    // 高光
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(rand(-160, 160), rand(-40, -10), rand(3, 7), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  // 噴漆小簽名
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = pick(['#111', '#e8e8e8', '#ff3d3d', '#3d9bff']);
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = rand(2, 4);
    ctx.beginPath();
    let x = Math.random() * W;
    let y = rand(20, 70);
    ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += rand(4, 14);
      y += rand(-14, 14);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // 底部髒污
  const dirt = ctx.createLinearGradient(0, H * 0.7, 0, H);
  dirt.addColorStop(0, 'rgba(30,25,20,0)');
  dirt.addColorStop(1, 'rgba(30,25,20,0.55)');
  ctx.fillStyle = dirt;
  ctx.fillRect(0, 0, W, H);
  return toTexture(c);
}

// ---------- 月台地磚 ----------
export function tileTexture() {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#b9b4aa';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const v = 175 + Math.random() * 20;
      ctx.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
      ctx.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
    }
  }
  noise(ctx, 256, 256, 1500, 0.1, false);
  return toTexture(c);
}

// ---------- 導盲黃線 ----------
export function tactileTexture() {
  const [c, ctx] = makeCanvas(64, 64);
  ctx.fillStyle = '#f2b705';
  ctx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(x * 16 + 8, y * 16 + 8, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(120,80,0,0.4)';
      ctx.beginPath();
      ctx.arc(x * 16 + 9, y * 16 + 9.5, 5, 0, Math.PI);
      ctx.fill();
    }
  }
  return toTexture(c);
}

// ---------- 大樓立面 ----------
const FACADES = [
  { wall: '#d9c7a7', frame: '#b8a585', glass: ['#2c3e55', '#3b5573', '#1f2c3d'] },
  { wall: '#8fa3b5', frame: '#6f8397', glass: ['#243447', '#2e4a66', '#1a2533'] },
  { wall: '#c98f6b', frame: '#a8704f', glass: ['#2a3040', '#3a4458', '#1c2130'] },
  { wall: '#e8e4dc', frame: '#c8c2b6', glass: ['#34506e', '#45688c', '#22364d'] },
  { wall: '#6b7a8a', frame: '#56636f', glass: ['#1c2836', '#2a3a4d', '#151e29'] },
];

export function facadeTextures() {
  return FACADES.map((f) => {
    const S = 256;
    const [c, ctx] = makeCanvas(S, S);
    const [e, ectx] = makeCanvas(S, S);
    ctx.fillStyle = f.wall;
    ctx.fillRect(0, 0, S, S);
    noise(ctx, S, S, 1500, 0.08, false);
    ectx.fillStyle = '#000';
    ectx.fillRect(0, 0, S, S);
    const cols = 4;
    const rows = 4;
    const cw = S / cols;
    const rh = S / rows;
    for (let r = 0; r < rows; r++) {
      // 樓板線
      ctx.fillStyle = f.frame;
      ctx.fillRect(0, r * rh + rh - 6, S, 6);
      for (let k = 0; k < cols; k++) {
        const x = k * cw + 12;
        const y = r * rh + 12;
        const w = cw - 24;
        const h = rh - 30;
        ctx.fillStyle = f.frame;
        ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
        const g = ctx.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, pick(f.glass));
        g.addColorStop(1, pick(f.glass));
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h);
        // 天空反射
        ctx.fillStyle = 'rgba(200,225,255,0.18)';
        ctx.beginPath();
        ctx.moveTo(x, y + h * 0.7);
        ctx.lineTo(x + w * 0.6, y);
        ctx.lineTo(x + w * 0.85, y);
        ctx.lineTo(x, y + h);
        ctx.fill();
        if (Math.random() < 0.28) {
          const warm = pick(['#ffcf7a', '#ffe2a8', '#fff1c9', '#ffb86b']);
          ctx.fillStyle = warm;
          ctx.globalAlpha = 0.55;
          ctx.fillRect(x, y, w, h);
          ctx.globalAlpha = 1;
          ectx.fillStyle = warm;
          ectx.globalAlpha = 0.6;
          ectx.fillRect(x, y, w, h);
          ectx.globalAlpha = 1;
        }
        ctx.fillStyle = f.frame;
        ctx.fillRect(x + w / 2 - 1.5, y, 3, h);
      }
    }
    return { map: toTexture(c), emissiveMap: toTexture(e) };
  });
}

// ---------- 列車塗裝 ----------
export const LIVERIES = [
  { id: 'silver', base: '#dfe4ea', stripe: '#e3342f', stripe2: '#ffb300', skirt: '#3a4048', code: 'R-12' },
  { id: 'blue', base: '#1d5fc4', stripe: '#ffd23f', stripe2: '#ffffff', skirt: '#12243d', code: 'B-07' },
  { id: 'green', base: '#2f8a57', stripe: '#f6f1e3', stripe2: '#f2b705', skirt: '#153826', code: 'G-33' },
  { id: 'orange', base: '#f47b20', stripe: '#1f2a33', stripe2: '#ffffff', skirt: '#2c2016', code: 'O-88' },
  { id: 'purple', base: '#6a3fc1', stripe: '#28e0c8', stripe2: '#ffffff', skirt: '#221540', code: 'P-21' },
];

function glass(ctx, x, y, w, h, r) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#34485e');
  g.addColorStop(0.5, '#1b2633');
  g.addColorStop(1, '#101820');
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(210,235,255,0.22)';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.1, y + h);
  ctx.lineTo(x + w * 0.45, y);
  ctx.lineTo(x + w * 0.6, y);
  ctx.lineTo(x + w * 0.25, y + h);
  ctx.fill();
  ctx.restore();
}

// 側面：寬 1152 x 高 256，對應車廂側面 11.5m x 2.55m
export function liverySideTexture(l) {
  const W = 1152;
  const H = 256;
  const [c, ctx] = makeCanvas(W, H);
  const [e, ectx] = makeCanvas(W, H);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, W, H);

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, l.base);
  bg.addColorStop(1, shade(l.base, -0.12));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  noise(ctx, W, H, 1200, 0.05, true);

  // 面板接縫
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let x = 64; x < W; x += 128) ctx.fillRect(x, 0, 2, H);

  const doors = [W * 0.25, W * 0.75];
  const doorW = 96;
  // 窗戶
  const winY = 40;
  const winH = 78;
  let x = 30;
  while (x < W - 30) {
    const nearDoor = doors.some((d) => x + 110 > d - doorW / 2 - 10 && x < d + doorW / 2 + 10);
    if (nearDoor) {
      x += 24;
      continue;
    }
    glass(ctx, x, winY, 100, winH, 12);
    ectx.fillStyle = 'rgba(255,220,160,0.18)';
    ectx.fillRect(x, winY, 100, winH);
    x += 118;
  }
  // 車門
  for (const d of doors) {
    ctx.fillStyle = shade(l.base, -0.08);
    ctx.fillRect(d - doorW / 2, 22, doorW, H - 46);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 3;
    ctx.strokeRect(d - doorW / 2, 22, doorW, H - 46);
    ctx.beginPath();
    ctx.moveTo(d, 22);
    ctx.lineTo(d, H - 24);
    ctx.stroke();
    glass(ctx, d - doorW / 2 + 10, 36, doorW / 2 - 16, 96, 8);
    glass(ctx, d + 6, 36, doorW / 2 - 16, 96, 8);
    // 車門指示燈
    ctx.fillStyle = '#ffae00';
    ctx.fillRect(d - 8, 12, 16, 6);
    ectx.fillStyle = '#ffae00';
    ectx.fillRect(d - 8, 12, 16, 6);
  }
  // 色帶
  ctx.fillStyle = l.stripe;
  ctx.fillRect(0, 148, W, 22);
  ctx.fillStyle = l.stripe2;
  ctx.fillRect(0, 176, W, 7);
  // 裙板
  ctx.fillStyle = l.skirt;
  ctx.fillRect(0, H - 22, W, 22);
  // 編號
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.font = 'bold 22px "Bungee", "Arial Black", sans-serif';
  ctx.fillText(l.code, 40, 212);
  ctx.fillText('RUN FOR COINS METRO', W - 330, 212);
  // 下方灰塵
  const dirt = ctx.createLinearGradient(0, H * 0.65, 0, H);
  dirt.addColorStop(0, 'rgba(60,45,30,0)');
  dirt.addColorStop(1, 'rgba(60,45,30,0.35)');
  ctx.fillStyle = dirt;
  ctx.fillRect(0, 0, W, H);
  return { map: toTexture(c, { repeat: false }), emissiveMap: toTexture(e, { repeat: false }) };
}

// 車頭：寬 256 x 高 384，對應 1.8m x 2.5m
export function liveryFrontTexture(l) {
  const W = 256;
  const H = 352;
  const [c, ctx] = makeCanvas(W, H);
  const [e, ectx] = makeCanvas(W, H);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, l.base);
  bg.addColorStop(1, shade(l.base, -0.15));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // 目的地 LED 看板
  roundRect(ctx, 38, 14, W - 76, 34, 6);
  ctx.fillStyle = '#0b0b0b';
  ctx.fill();
  ctx.font = 'bold 22px "Bungee", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ff9d1c';
  ctx.fillText(`${l.code} ★`, W / 2, 32);
  ectx.font = ctx.font;
  ectx.textAlign = 'center';
  ectx.textBaseline = 'middle';
  ectx.fillStyle = '#ff9d1c';
  ectx.fillText(`${l.code} ★`, W / 2, 32);
  // 擋風玻璃
  glass(ctx, 16, 60, W - 32, 128, 18);
  // 雨刷
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(70, 184);
  ctx.lineTo(120, 120);
  ctx.moveTo(180, 184);
  ctx.lineTo(228, 124);
  ctx.stroke();
  // 色帶
  ctx.fillStyle = l.stripe;
  ctx.fillRect(0, 212, W, 22);
  ctx.fillStyle = l.stripe2;
  ctx.fillRect(0, 240, W, 7);
  // 車燈座
  for (const cx of [48, W - 48]) {
    roundRect(ctx, cx - 30, 262, 60, 34, 10);
    ctx.fillStyle = '#1a1d22';
    ctx.fill();
  }
  // 下方
  ctx.fillStyle = l.skirt;
  ctx.fillRect(0, H - 40, W, 40);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  for (let y = H - 34; y < H - 4; y += 6) ctx.fillRect(70, y, W - 140, 2);
  return { map: toTexture(c, { repeat: false }), emissiveMap: toTexture(e, { repeat: false }) };
}

function shade(hex, amt) {
  const c = new THREE.Color(hex);
  if (amt < 0) c.lerp(new THREE.Color('#000'), -amt);
  else c.lerp(new THREE.Color('#fff'), amt);
  return `#${c.getHexString()}`;
}

// ---------- 障礙物條紋 ----------
export function stripeTexture(c1 = '#e53935', c2 = '#f5f5f5') {
  const [c, ctx] = makeCanvas(256, 64);
  ctx.fillStyle = c2;
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = c1;
  for (let x = -64; x < 320; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 64);
    ctx.lineTo(x + 32, 0);
    ctx.lineTo(x + 64, 0);
    ctx.lineTo(x + 32, 64);
    ctx.fill();
  }
  noise(ctx, 256, 64, 300, 0.12, false);
  return toTexture(c);
}

export function chevronTexture() {
  const [c, ctx] = makeCanvas(128, 256);
  ctx.fillStyle = '#23262b';
  ctx.fillRect(0, 0, 128, 256);
  ctx.fillStyle = '#ffc400';
  for (let y = 0; y < 256; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y + 40);
    ctx.lineTo(64, y);
    ctx.lineTo(128, y + 40);
    ctx.lineTo(128, y + 62);
    ctx.lineTo(64, y + 22);
    ctx.lineTo(0, y + 62);
    ctx.fill();
  }
  noise(ctx, 128, 256, 400, 0.15, false);
  return toTexture(c);
}

// ---------- 光暈 ----------
export function glowTexture() {
  const [c, ctx] = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,245,220,0.8)');
  g.addColorStop(0.5, 'rgba(255,220,160,0.2)');
  g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return toTexture(c, { repeat: false });
}

// ---------- 車站看板 / 廣告 ----------
export function signTexture(text, sub) {
  const [c, ctx] = makeCanvas(512, 128);
  ctx.fillStyle = '#123a6b';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 100, 512, 6);
  ctx.font = '900 54px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 50);
  ctx.font = 'bold 20px "Bungee", "Arial Black", sans-serif';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(sub, 256, 116);
  return toTexture(c, { repeat: false });
}

export function posterTexture(i) {
  const [c, ctx] = makeCanvas(256, 384);
  const pal = [
    ['#ff4d6d', '#ffd166', '#1b1f3b'],
    ['#06d6a0', '#118ab2', '#fdfcdc'],
    ['#ffbe0b', '#fb5607', '#3a0ca3'],
    ['#8338ec', '#ff006e', '#fefae0'],
  ][i % 4];
  const g = ctx.createLinearGradient(0, 0, 256, 384);
  g.addColorStop(0, pal[0]);
  g.addColorStop(1, pal[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 384);
  ctx.fillStyle = pal[2];
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(128, 150, 80, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.font = '900 40px "Bungee", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  const titles = ['SUMMER', 'COIN RUSH', 'NIGHT LINE', 'GOLD RUN'];
  ctx.fillText(titles[i % 4], 128, 300);
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('ON TRACK · 2026', 128, 340);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 248, 376);
  return toTexture(c, { repeat: false });
}

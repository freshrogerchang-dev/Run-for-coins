// 金幣酷跑 Run for Coins —— 遊戲主程式：狀態、輸入、物理、碰撞、鏡頭、介面
import * as THREE from 'three';
import { Stage } from './stage.js';
import { Models } from './models.js';
import { Environment } from './environment.js';
import { Player } from './player.js';
import { Level } from './level.js';
import { Sfx } from './audio.js';
import {
  LANES,
  GROUND,
  START_SPEED,
  MAX_SPEED,
  SPEED_GAIN,
  GRAVITY,
  JUMP_HEIGHT,
  SLIDE_TIME,
  PLAYER_HALF_W,
  PLAYER_HALF_D,
  PLAYER_H,
  PLAYER_SLIDE_H,
} from './config.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

const store = {
  get(key, fallback = 0) {
    try {
      const v = localStorage.getItem(`rfc-${key}`);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`rfc-${key}`, JSON.stringify(value));
    } catch {
      /* 無痕模式等情況下忽略 */
    }
  },
};

async function waitFonts() {
  if (!document.fonts) return;
  const timeout = new Promise((r) => setTimeout(r, 1500));
  await Promise.race([
    Promise.all([document.fonts.load('900 40px "Bungee"'), document.fonts.load('900 40px "Noto Sans TC"', '金幣')]),
    timeout,
  ]).catch(() => {});
}

await waitFonts();

const stage = new Stage($('game'));
const models = new Models();
const sfx = new Sfx();
sfx.setMuted(store.get('muted', false));
const env = new Environment(stage.scene);
const player = new Player();
stage.scene.add(player.root);
const level = new Level(stage.scene, models, sfx);

const JUMP_V = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);

const S = {
  mode: 'menu', // menu | playing | paused | crashing | over
  x: 0,
  y: GROUND,
  z: 0,
  vy: 0,
  lane: 1,
  prevLane: 1,
  grounded: true,
  slideT: 0,
  jumpBuffer: 0,
  slideBuffer: 0,
  speed: START_SPEED,
  distance: 0,
  coins: 0,
  time: 0,
  runTime: 0,
  crashT: 0,
  shake: 0,
  camBlend: 0,
  camY: 3.4,
  lastBump: -10,
};

function resetRun() {
  Object.assign(S, {
    x: 0,
    y: GROUND,
    z: 0,
    vy: 0,
    lane: 1,
    prevLane: 1,
    grounded: true,
    slideT: 0,
    jumpBuffer: 0,
    slideBuffer: 0,
    speed: START_SPEED,
    distance: 0,
    coins: 0,
    runTime: 0,
    crashT: 0,
    shake: 0,
    camY: 3.4,
    lastBump: -10,
  });
  env.reset();
  level.reset(0);
  level.difficulty = 0;
  player.pose.crash = 0;
}

// ---------- 動作 ----------
function moveLane(dir) {
  if (S.mode !== 'playing') return;
  const next = clamp(S.lane + dir, 0, 2);
  if (next === S.lane) {
    S.shake = Math.max(S.shake, 0.12);
    sfx.bump();
    return;
  }
  S.prevLane = S.lane;
  S.lane = next;
  sfx.lane();
}

function jump() {
  if (S.mode !== 'playing') return;
  if (S.grounded) {
    S.vy = JUMP_V;
    S.grounded = false;
    S.slideT = 0;
    sfx.jump();
  } else {
    S.jumpBuffer = 0.16;
  }
}

function slide() {
  if (S.mode !== 'playing') return;
  if (S.grounded) {
    S.slideT = SLIDE_TIME;
    sfx.slide();
  } else {
    S.vy = Math.min(S.vy, -32);
    S.slideBuffer = 0.4;
  }
}

function crash() {
  if (S.mode !== 'playing') return;
  S.mode = 'crashing';
  S.crashT = 0;
  S.shake = 0.7;
  sfx.crash();
  sfx.stopMusic();
  if (navigator.vibrate) navigator.vibrate(180);
}

function sideBump(prevX) {
  // 換道撞到側面：彈回原車道；短時間內撞兩次就算失敗
  if (S.runTime - S.lastBump < 3) {
    crash();
    return;
  }
  S.lastBump = S.runTime;
  S.lane = S.prevLane;
  S.x = prevX;
  S.shake = 0.35;
  sfx.bump();
  flash('小心！再撞一次就出局');
}

// ---------- 物理與碰撞 ----------
function stepPlaying(dt) {
  S.runTime += dt;
  S.speed = Math.min(MAX_SPEED, START_SPEED + S.distance * SPEED_GAIN);
  level.difficulty = Math.min(1, S.distance / 1800);

  const prevX = S.x;
  const prevY = S.y;
  const prevZ = S.z;

  S.z -= S.speed * dt;
  S.distance += S.speed * dt;
  S.x = damp(S.x, LANES[S.lane], 16, dt);

  if (!S.grounded) S.vy -= GRAVITY * dt;
  S.y += S.vy * dt;
  S.slideT = Math.max(0, S.slideT - dt);
  S.jumpBuffer = Math.max(0, S.jumpBuffer - dt);
  S.slideBuffer = Math.max(0, S.slideBuffer - dt);

  const h = S.slideT > 0 ? PLAYER_SLIDE_H : PLAYER_H;
  const zMin = S.z - PLAYER_HALF_D;
  const zMax = prevZ + PLAYER_HALF_D;
  let support = GROUND;

  for (const o of level.obstacles) {
    const oz0 = o.zFront - o.length;
    const oz1 = o.zFront;
    if (zMax < oz0 || zMin > oz1) continue;
    const reach = o.halfW + PLAYER_HALF_W;
    if (Math.abs(S.x - o.x) >= reach) continue;
    const wasOver = Math.abs(prevX - o.x) < reach - 0.02;

    if (o.kind === 'train' || o.kind === 'ramp') {
      const top = level.heightAt(o, S.z);
      const tol = o.kind === 'ramp' ? 1.1 : 0.55;
      if (prevY >= top - tol) {
        support = Math.max(support, top);
      } else if (!wasOver) {
        sideBump(prevX);
        return;
      } else {
        S.crashCause = o.kind;
        crash();
        return;
      }
    } else if ((o.kind === 'low' && S.y < o.top) || (o.kind === 'high' && S.y + h > o.bottom)) {
      S.crashCause = o.kind;
      if (!wasOver) sideBump(prevX);
      else crash();
      return;
    }
  }

  if (S.y <= support && S.vy <= 0) {
    if (!S.grounded && S.vy < -12) sfx.land();
    S.y = support;
    S.vy = 0;
    S.grounded = true;
    if (S.slideBuffer > 0) {
      S.slideBuffer = 0;
      S.slideT = SLIDE_TIME;
      sfx.slide();
    }
    if (S.jumpBuffer > 0) {
      S.jumpBuffer = 0;
      jump();
    }
  } else if (S.grounded && S.y > support + 0.02) {
    S.grounded = false; // 從車頂邊緣掉下
  }

  // 吃金幣
  for (const c of level.coins) {
    if (c.taken) continue;
    if (Math.abs(c.mesh.position.x - S.x) > 0.95) continue;
    if (c.z < zMin - 0.6 || c.z > zMax + 0.6) continue;
    if (c.y < S.y - 0.4 || c.y > S.y + h + 0.6) continue;
    c.taken = true;
    S.coins++;
    sfx.coin();
    stage.burst(c.mesh.position, 9);
    bumpCoinHud();
  }
}

// ---------- 鏡頭 ----------
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
const menuPos = new THREE.Vector3();
const menuLook = new THREE.Vector3();
const followPos = new THREE.Vector3();
const followLook = new THREE.Vector3();

function updateCamera(dt) {
  const t = S.time;
  menuPos.set(Math.sin(t * 0.25) * 2.6 + 1.4, 1.9 + Math.sin(t * 0.4) * 0.15, S.z - 4.6);
  menuLook.set(0.2, 1.15, S.z);

  S.camY = damp(S.camY, 3.7 + Math.max(0, S.y - GROUND) * 0.72, 6, dt);
  followPos.set(S.x * 0.7, S.camY, S.z + 7.2);
  followLook.set(S.x * 0.85, S.camY - 2.0, S.z - 9);

  const target = S.mode === 'menu' ? 0 : 1;
  S.camBlend = damp(S.camBlend, target, 2.6, dt);
  const b = S.camBlend * S.camBlend * (3 - 2 * S.camBlend);
  camPos.lerpVectors(menuPos, followPos, b);
  camLook.lerpVectors(menuLook, followLook, b);

  if (S.shake > 0) {
    S.shake = Math.max(0, S.shake - dt * 1.6);
    const k = S.shake * S.shake;
    camPos.x += (Math.random() - 0.5) * k * 1.2;
    camPos.y += (Math.random() - 0.5) * k * 1.2;
  }
  stage.camera.position.copy(camPos);
  stage.camera.lookAt(camLook);
  const baseFov = stage.camera.aspect < 0.8 ? 75 : 62;
  const sf = (S.speed - START_SPEED) / (MAX_SPEED - START_SPEED);
  stage.camera.fov = damp(stage.camera.fov, baseFov + (S.mode === 'playing' ? sf * 9 : 0), 3, dt);
  stage.camera.updateProjectionMatrix();
}

// ---------- 介面 ----------
const ui = {
  hud: $('hud'),
  score: $('score'),
  coins: $('coins'),
  dist: $('dist'),
  coinBox: $('coinBox'),
  start: $('startScreen'),
  over: $('overScreen'),
  pause: $('pauseScreen'),
  toast: $('toast'),
  loading: $('loading'),
  best: $('bestStart'),
  bank: $('bankStart'),
  muteBtn: $('muteBtn'),
};

const score = () => Math.floor(S.distance) + S.coins * 10;

function refreshMenuStats() {
  ui.best.textContent = store.get('best', 0).toLocaleString();
  ui.bank.textContent = store.get('bank', 0).toLocaleString();
}

function bumpCoinHud() {
  ui.coinBox.classList.remove('pop');
  void ui.coinBox.offsetWidth;
  ui.coinBox.classList.add('pop');
}

let toastTimer;
function flash(msg) {
  ui.toast.textContent = msg;
  ui.toast.hidden = false;
  ui.toast.classList.remove('show');
  void ui.toast.offsetWidth;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (ui.toast.hidden = true), 1600);
}

function startGame() {
  sfx.ensure();
  if (S.mode === 'over') resetRun();
  S.mode = 'playing';
  ui.start.hidden = true;
  ui.over.hidden = true;
  ui.pause.hidden = true;
  ui.hud.hidden = false;
  sfx.startMusic();
}

function showMenu() {
  resetRun();
  S.mode = 'menu';
  ui.over.hidden = true;
  ui.pause.hidden = true;
  ui.hud.hidden = true;
  ui.start.hidden = false;
  refreshMenuStats();
}

function gameOver() {
  S.mode = 'over';
  const sc = score();
  const best = store.get('best', 0);
  const isBest = sc > best;
  if (isBest) store.set('best', sc);
  store.set('bank', store.get('bank', 0) + S.coins);
  $('overScore').textContent = sc.toLocaleString();
  $('overCoins').textContent = S.coins;
  $('overDist').textContent = `${Math.floor(S.distance)} m`;
  $('overBest').textContent = Math.max(sc, best).toLocaleString();
  $('newBest').hidden = !isBest;
  ui.hud.hidden = true;
  ui.over.hidden = false;
}

function togglePause() {
  if (S.mode === 'playing') {
    S.mode = 'paused';
    ui.pause.hidden = false;
    sfx.stopMusic();
  } else if (S.mode === 'paused') {
    S.mode = 'playing';
    ui.pause.hidden = true;
    sfx.startMusic();
  }
}

function toggleMute() {
  const m = !sfx.muted;
  sfx.setMuted(m);
  store.set('muted', m);
  ui.muteBtn.setAttribute('aria-pressed', String(m));
}
ui.muteBtn.setAttribute('aria-pressed', String(sfx.muted));

$('startBtn').addEventListener('click', startGame);
$('againBtn').addEventListener('click', () => {
  resetRun();
  S.mode = 'over';
  startGame();
});
$('menuBtn').addEventListener('click', showMenu);
$('resumeBtn').addEventListener('click', togglePause);
$('pauseBtn').addEventListener('click', togglePause);
ui.muteBtn.addEventListener('click', toggleMute);

// ---------- 輸入：鍵盤 ----------
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key;
  if (S.mode === 'menu' && (k === 'Enter' || k === ' ')) {
    e.preventDefault();
    startGame();
    return;
  }
  if (S.mode === 'over' && k === 'Enter') {
    e.preventDefault();
    $('againBtn').click();
    return;
  }
  if (k === 'p' || k === 'P' || k === 'Escape') {
    togglePause();
    return;
  }
  if (k === 'm' || k === 'M') {
    toggleMute();
    return;
  }
  const map = {
    ArrowLeft: () => moveLane(-1),
    a: () => moveLane(-1),
    A: () => moveLane(-1),
    ArrowRight: () => moveLane(1),
    d: () => moveLane(1),
    D: () => moveLane(1),
    ArrowUp: jump,
    w: jump,
    W: jump,
    ' ': jump,
    ArrowDown: slide,
    s: slide,
    S: slide,
  };
  if (map[k] && S.mode === 'playing') {
    e.preventDefault();
    map[k]();
  }
});

// ---------- 輸入：觸控滑動 ----------
let touch = null;
const canvas = stage.renderer.domElement;
canvas.addEventListener('pointerdown', (e) => {
  touch = { x: e.clientX, y: e.clientY, used: false };
});
canvas.addEventListener('pointermove', (e) => {
  if (!touch || touch.used) return;
  const dx = e.clientX - touch.x;
  const dy = e.clientY - touch.y;
  if (Math.hypot(dx, dy) < 28) return;
  touch.used = true;
  if (Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1);
  else if (dy < 0) jump();
  else slide();
});
const endTouch = () => (touch = null);
canvas.addEventListener('pointerup', endTouch);
canvas.addEventListener('pointercancel', endTouch);

document.addEventListener('visibilitychange', () => {
  if (document.hidden && S.mode === 'playing') togglePause();
});

// ---------- 主迴圈 ----------
const clock = new THREE.Clock();
let hudTick = 0;

function update(dt) {
  S.time += dt;

  if (S.mode === 'playing') stepPlaying(dt);
  if (S.mode === 'crashing') {
    S.crashT += dt;
    if (S.y > GROUND) {
      S.vy -= GRAVITY * dt;
      S.y = Math.max(GROUND, S.y + S.vy * dt);
    }
    if (S.crashT > 1.4) gameOver();
  }

  level.update(dt, S.z, S.speed, S.time);
  env.update(S.z);
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 30);
  if (S.mode === 'paused') {
    stage.render();
    return;
  }
  update(dt);
  present(dt);
}

function present(dt) {
  player.root.position.set(S.x, S.y, S.z);
  player.animate(dt, {
    speed: S.speed,
    grounded: S.grounded,
    vy: S.vy,
    sliding: S.slideT > 0,
    crashed: S.mode === 'crashing' || S.mode === 'over',
    idle: S.mode === 'menu',
    lean: -(LANES[S.lane] - S.x) * 0.1,
  });

  updateCamera(dt);
  const sf = S.mode === 'playing' ? (S.speed - START_SPEED) / (MAX_SPEED - START_SPEED) : 0;
  stage.update(dt, { z: S.z }, sf, S.time);
  stage.render();

  hudTick += dt;
  if (S.mode === 'playing' && hudTick > 0.05) {
    hudTick = 0;
    ui.score.textContent = score().toLocaleString();
    ui.coins.textContent = S.coins;
    ui.dist.textContent = `${Math.floor(S.distance)} m`;
  }
}

resetRun();
refreshMenuStats();
ui.loading.hidden = true;
ui.start.hidden = false;
frame();

// 方便除錯
window.__rfc = { S, level, stage, update, present, moveLane, jump, slide };

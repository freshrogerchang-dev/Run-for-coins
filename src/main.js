// 金幣酷跑 Run for Coins —— 遊戲主程式：狀態、輸入、物理、碰撞、鏡頭、介面
import * as THREE from 'three';
import { Stage } from './stage.js';
import { Models } from './models.js';
import { Environment } from './environment.js';
import { Player } from './player.js';
import { Level } from './level.js';
import { Sfx } from './audio.js';
import { THEMES, THEME_ORDER } from './themes.js';
import { PowerupModels } from './powerups.js';
import {
  store,
  POWERUPS,
  UPGRADABLE,
  UPGRADE_COST,
  MAX_LEVEL,
  upgrades,
  powerDuration,
  OUTFITS,
  STAGES,
  isCleared,
  markCleared,
  clearedStages,
  outfitUnlocked,
  outfitRequirement,
  scoreMultiplier,
} from './progress.js';
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
  TRAIN_TOP,
} from './config.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

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
sfx.musicEnabled = store.get('music', true);
const env = new Environment(stage.scene);
const player = new Player();
stage.scene.add(player.root);
const level = new Level(stage.scene, models, sfx, new PowerupModels());
const outfitOf = (id) => OUTFITS.find((o) => o.id === id) || OUTFITS[0];
let outfitId = outfitUnlocked(store.get('outfit', 'street')) ? store.get('outfit', 'street') : 'street';
player.applyOutfit(outfitOf(outfitId));

const JUMP_V = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);
const JUMP_V_SPRING = Math.sqrt(2 * GRAVITY * 4.6);
const DASH_MULT = 1.65;
const JET_Y = 8.2;
const POWER_KEYS = ['dash', 'jetpack', 'magnet', 'double', 'spring', 'shield'];
const emptyPower = () => Object.fromEntries(POWER_KEYS.map((k) => [k, 0]));

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
  scene: THEME_ORDER.includes(store.get('scene', 'city')) || store.get('scene', 'city') === 'tour' ? store.get('scene', 'city') : 'city',
  theme: null,
  onTrain: false,
  milestone: 0,
  clackT: 0,
  stepCount: 0,
  power: emptyPower(),
  powerMax: emptyPower(),
  invuln: 0,
  bonus: 0,
  mult: 1,
  revives: 0,
  stage: null,
  stageDone: false,
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
    onTrain: false,
    floorY: GROUND,
    milestone: 0,
    clackT: 0,
    power: emptyPower(),
    powerMax: emptyPower(),
    invuln: 0,
    bonus: 0,
    mult: scoreMultiplier(),
    revives: 0,
    stageDone: false,
    vaulting: 0,
    crashCause: null,
  });
  S.stage = S.scene === 'tour' ? null : STAGES.find((st) => st.scene === S.scene) || null;
  player.setPower({ jetpack: false, spring: false, shield: false, magnet: false });
  player.root.visible = true;
  sfx.setJet(false);
  env.setMode(S.scene);
  env.reset();
  syncTheme(true);
  level.reset(0);
  level.difficulty = 0;
  player.pose.crash = 0;
}

// ---------- 場景 ----------
function syncTheme(instant = false) {
  const id = env.themeAt(S.z - 4);
  if (id === S.theme && !instant) return;
  const changed = S.theme && id !== S.theme;
  S.theme = id;
  stage.setTheme(THEMES[id], instant);
  sfx.setTheme(id, instant);
  $('sceneName').textContent = THEMES[id].name;
  if (changed && !instant && S.mode === 'playing') {
    flash(`進入「${THEMES[id].name}」`);
    sfx.themeChange();
  }
}

const surface = () => (S.onTrain ? 'metal' : THEMES[S.theme].surface);

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
  if (S.power.jetpack > 0) return;
  if (S.grounded) {
    S.vy = S.power.spring > 0 ? JUMP_V_SPRING : JUMP_V;
    S.grounded = false;
    S.slideT = 0;
    sfx.jump();
  } else {
    S.jumpBuffer = 0.16;
  }
}

function slide() {
  if (S.mode !== 'playing' || S.power.jetpack > 0) return;
  if (S.grounded) {
    S.slideT = SLIDE_TIME;
    sfx.slide(surface());
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
  sfx.setSpeed(0, false);
  sfx.setRumble(0);
  sfx.setJet(false);
  if (navigator.vibrate) navigator.vibrate(180);
}

// ---------- 道具 ----------
function activatePower(kind) {
  if (kind === 'mystery') {
    openMystery();
    return;
  }
  const dur = powerDuration(kind);
  S.power[kind] = dur;
  S.powerMax[kind] = dur;
  sfx.powerup(kind);
  flash(POWERUPS[kind].name);
  if (kind === 'dash') {
    sfx.dash();
    S.shake = Math.max(S.shake, 0.2);
  }
  if (kind === 'jetpack') {
    S.slideT = 0;
    const run = S.speed * (S.power.dash > 0 ? DASH_MULT : 1);
    level.addSkyCoins(S.z - 14, Math.floor((run * dur) / 2.4) - 4, JET_Y + 0.85);
    sfx.setJet(true);
  }
  syncPowerVisuals();
}

function openMystery() {
  sfx.powerup('mystery');
  sfx.mystery();
  const r = Math.random();
  if (r < 0.4) {
    const n = [30, 50, 100][(Math.random() * 3) | 0];
    S.coins += n;
    flash(`神秘寶箱：+${n} 金幣`);
    bumpCoinHud();
  } else if (r < 0.85) {
    const kinds = POWER_KEYS;
    const k = kinds[(Math.random() * kinds.length) | 0];
    flash(`神秘寶箱：${POWERUPS[k].name}`);
    setTimeout(() => S.mode === 'playing' && activatePower(k), 350);
  } else {
    S.bonus += 1000;
    flash('神秘寶箱：+1000 分');
  }
}

function syncPowerVisuals() {
  player.setPower({
    jetpack: S.power.jetpack > 0,
    spring: S.power.spring > 0,
    shield: S.power.shield > 0,
    magnet: S.power.magnet > 0,
  });
}

function tickPowers(dt) {
  S.invuln = Math.max(0, S.invuln - dt);
  for (const k of POWER_KEYS) {
    const before = S.power[k];
    if (before <= 0) continue;
    S.power[k] = Math.max(0, before - dt);
    // 最後兩秒嗶嗶提醒
    if (before > 0.01 && S.power[k] < 2 && Math.floor(before * 2) !== Math.floor(S.power[k] * 2)) sfx.powerWarn();
    if (S.power[k] === 0) {
      sfx.powerEnd();
      if (k === 'jetpack') {
        sfx.setJet(false);
        S.invuln = Math.max(S.invuln, 1.3);
      }
      if (k === 'dash') S.invuln = Math.max(S.invuln, 0.6);
      syncPowerVisuals();
    }
  }
}

// 受保護時撞到東西：柵欄被撞飛；列車或斜坡則翻上車頂
function smashOrVault(o) {
  if (o.kind === 'low' || o.kind === 'high') {
    level.knock(o, Math.sign(o.x - S.x) || (Math.random() < 0.5 ? -1 : 1));
    sfx.smash();
    stage.burst(new THREE.Vector3(o.x, 1, o.zFront), 14);
    S.shake = Math.max(S.shake, 0.18);
  } else if (!S.vaulting) {
    S.vy = Math.sqrt(2 * GRAVITY * Math.max(0.5, TRAIN_TOP + 0.6 - S.y));
    S.grounded = false;
    S.vaulting = 0.5;
    S.slideT = 0;
    sfx.jump();
  }
}

// 撞擊處理：回傳 true 表示這一步要停止（撞車或側撞）
function hit(o, side, prevX) {
  if (S.power.dash > 0 || S.invuln > 0 || S.vaulting > 0) {
    smashOrVault(o);
    return false;
  }
  if (side && S.runTime - S.lastBump >= 3) {
    sideBump(prevX);
    return true;
  }
  if (S.power.shield > 0) {
    S.power.shield = 0;
    S.invuln = 1.2;
    sfx.shieldBreak();
    stage.burst(new THREE.Vector3(S.x, S.y + 1, S.z), 24);
    flash('防護罩擋下了一次撞擊！');
    syncPowerVisuals();
    smashOrVault(o);
    return false;
  }
  S.crashCause = o.kind;
  crash();
  return true;
}

function collectCoin(c) {
  c.taken = true;
  c.magnet = false;
  S.coins += S.power.double > 0 ? 2 : 1;
  sfx.coin();
  stage.burst(c.mesh.position, 9);
  bumpCoinHud();
}

function sideBump(prevX) {
  // 換道撞到側面：彈回原車道；短時間內再撞一次就算失敗（在 hit() 判斷）
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

  tickPowers(dt);
  S.vaulting = Math.max(0, (S.vaulting || 0) - dt);
  const runSpeed = S.speed * (S.power.dash > 0 ? DASH_MULT : 1);
  S.z -= runSpeed * dt;
  S.distance += runSpeed * dt;
  S.x = damp(S.x, LANES[S.lane], 16, dt);

  const flying = S.power.jetpack > 0;
  if (flying) {
    S.vy = (JET_Y - S.y) * 4;
    S.grounded = false;
  } else if (!S.grounded) S.vy -= GRAVITY * dt;
  S.y += S.vy * dt;
  S.slideT = Math.max(0, S.slideT - dt);
  S.jumpBuffer = Math.max(0, S.jumpBuffer - dt);
  S.slideBuffer = Math.max(0, S.slideBuffer - dt);

  const h = S.slideT > 0 ? PLAYER_SLIDE_H : PLAYER_H;
  const zMin = S.z - PLAYER_HALF_D;
  const zMax = prevZ + PLAYER_HALF_D;
  let support = GROUND;
  let onTrain = false;

  for (const o of flying ? [] : [...level.obstacles]) {
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
        if (top >= support) onTrain = top > GROUND + 0.3;
        support = Math.max(support, top);
      } else if (hit(o, !wasOver, prevX)) {
        return;
      }
    } else if ((o.kind === 'low' && S.y < o.top) || (o.kind === 'high' && S.y + h > o.bottom)) {
      if (hit(o, !wasOver, prevX)) return;
    }
  }

  S.onTrain = onTrain;
  S.floorY = support;
  if (!flying && S.y <= support && S.vy <= 0) {
    if (!S.grounded && S.vy < -12) sfx.land(surface());
    S.y = support;
    S.vy = 0;
    S.grounded = true;
    if (S.slideBuffer > 0) {
      S.slideBuffer = 0;
      S.slideT = SLIDE_TIME;
      sfx.slide(surface());
    }
    if (S.jumpBuffer > 0) {
      S.jumpBuffer = 0;
      jump();
    }
  } else if (!flying && S.grounded && S.y > support + 0.02) {
    S.grounded = false; // 從車頂邊緣掉下
  }

  // 吃金幣（磁鐵會把附近的金幣吸過來）
  const magnet = S.power.magnet > 0;
  const center = new THREE.Vector3(S.x, S.y + 1, S.z);
  for (const c of level.coins) {
    if (c.taken) continue;
    if (magnet && !c.magnet && c.z < S.z + 2 && c.z > S.z - 20 && Math.abs(c.x - S.x) < 6 && Math.abs(c.y - S.y) < 5) {
      c.magnet = true;
    }
    if (c.magnet) {
      c.mesh.position.lerp(center, 1 - Math.exp(-dt * 11));
      c.mesh.position.z += (S.z - prevZ) * 0.5;
      c.z = c.mesh.position.z;
      if (c.mesh.position.distanceTo(center) < 1.1) collectCoin(c);
      continue;
    }
    if (Math.abs(c.mesh.position.x - S.x) > 0.95) continue;
    if (c.z < zMin - 0.6 || c.z > zMax + 0.6) continue;
    if (c.y < S.y - 0.4 || c.y > S.y + h + 0.6) continue;
    collectCoin(c);
  }

  // 撿道具
  for (const pu of level.powerups) {
    if (pu.taken) continue;
    if (Math.abs(pu.x - S.x) > 1.1) continue;
    if (pu.z < zMin - 0.8 || pu.z > zMax + 0.8) continue;
    if (pu.y < S.y - 0.8 || pu.y > S.y + h + 1) continue;
    pu.taken = true;
    stage.burst(pu.mesh.position, 20);
    activatePower(pu.kind);
  }

  // 關卡目標
  if (S.stage && !S.stageDone && !isCleared(S.stage.scene) && S.distance >= S.stage.distance && S.coins >= S.stage.coins) {
    clearStage(S.stage);
  }

  // 擦身而過：旁邊車道的列車車頭，或自己車道剛越過的柵欄
  for (const o of level.obstacles) {
    if (o.whooshed || o.decorative) continue;
    if (o.zFront > prevZ || o.zFront < S.z) continue;
    const dx = Math.abs(o.x - S.x);
    if ((o.kind === 'train' && dx > 1 && dx < 3.5 && S.y < 3) || ((o.kind === 'low' || o.kind === 'high') && dx < 1)) {
      o.whooshed = true;
      sfx.whoosh();
    }
  }

  // 每 500 公尺
  const ms = Math.floor(S.distance / 500);
  if (ms > S.milestone) {
    S.milestone = ms;
    sfx.milestone();
    flash(`${ms * 500} 公尺！`);
  }
}

// 迎面列車的轟隆聲與車輪聲
function updateTrainAudio(dt) {
  let p = 0;
  if (S.mode === 'playing') {
    for (const o of level.obstacles) {
      if (!o.moving || !o.active) continue;
      const d = Math.max(0, S.z - o.zFront, o.zFront - o.length - S.z);
      p = Math.max(p, 1 - d / 90);
    }
  }
  p = Math.max(0, p);
  sfx.setRumble(p * p);
  if (p > 0.3) {
    S.clackT -= dt;
    if (S.clackT <= 0) {
      sfx.clack();
      S.clackT = 0.5 - p * 0.25;
    }
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

  // 在車頂時鏡頭整個升上去（避開電車線），跳躍只跟一半
  const floorY = S.mode === 'menu' ? GROUND : Math.min(TRAIN_TOP, S.floorY ?? GROUND);
  const camTarget = S.power.jetpack > 0 || S.y > TRAIN_TOP + 2.2 ? S.y + 3.3 : 3.7 + (floorY - GROUND) + Math.max(0, S.y - floorY) * 0.5;
  S.camY = damp(S.camY, camTarget, 5, dt);
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
  const dashFov = S.power.dash > 0 && S.mode === 'playing' ? 12 : 0;
  stage.camera.fov = damp(stage.camera.fov, baseFov + (S.mode === 'playing' ? sf * 9 : 0) + dashFov, 3, dt);
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
  musicBtn: $('musicBtn'),
  mult: $('mult'),
  goal: $('goal'),
  goalText: $('goalText'),
  goalBar: $('goalBar'),
  powers: $('powers'),
  banner: $('banner'),
  revive: $('reviveScreen'),
  panel: $('panel'),
};

// ---------- HUD：道具計時 ----------
const powerEls = {};
for (const k of POWER_KEYS) {
  const el = document.createElement('div');
  el.className = 'pw';
  el.hidden = true;
  el.style.setProperty('--c', POWERUPS[k].color);
  el.innerHTML = `<b>${POWERUPS[k].glyph}</b><span><em>${POWERUPS[k].name}</em><i></i></span>`;
  ui.powers.appendChild(el);
  powerEls[k] = { el, bar: el.querySelector('i') };
}

function updateHud() {
  ui.score.textContent = score().toLocaleString();
  ui.coins.textContent = S.coins;
  ui.dist.textContent = `${Math.floor(S.distance)} m`;
  ui.mult.textContent = `×${S.mult}`;
  for (const k of POWER_KEYS) {
    const on = S.power[k] > 0;
    const pe = powerEls[k];
    if (pe.el.hidden === on) pe.el.hidden = !on;
    if (on) {
      pe.bar.style.transform = `scaleX(${S.power[k] / S.powerMax[k]})`;
      pe.el.classList.toggle('ending', S.power[k] < 2);
    }
  }
  const st = S.stage;
  ui.goal.hidden = !st;
  if (st) {
    const done = S.stageDone || isCleared(st.scene);
    if (done) {
      ui.goalText.textContent = S.stageDone ? `第 ${st.no} 關 破關！` : `第 ${st.no} 關 已破關`;
      ui.goalBar.style.transform = 'scaleX(1)';
    } else {
      const d = Math.min(st.distance, Math.floor(S.distance));
      const c = Math.min(st.coins, S.coins);
      ui.goalText.textContent = `第 ${st.no} 關　${d}/${st.distance} m　${c}/${st.coins} 金幣`;
      ui.goalBar.style.transform = `scaleX(${Math.min(d / st.distance, c / st.coins)})`;
    }
    ui.goal.classList.toggle('done', done);
  }
}

// ---------- 破關 ----------
let bannerTimer;
function showBanner(title, text) {
  ui.banner.querySelector('h3').textContent = title;
  ui.banner.querySelector('p').textContent = text;
  ui.banner.hidden = false;
  ui.banner.classList.remove('show');
  void ui.banner.offsetWidth;
  ui.banner.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => (ui.banner.hidden = true), 4200);
}

function confetti() {
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['#ffc21a', '#ff4d3d', '#2fa8ff', '#2ecc71', '#ff7ac8', '#9b5cff'];
  for (let i = 0; i < 70; i++) {
    const c = document.createElement('i');
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = `${Math.random() * 0.6}s`;
    c.style.animationDuration = `${2 + Math.random() * 1.6}s`;
    c.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
    c.style.setProperty('--dx', `${Math.random() * 160 - 80}px`);
    box.appendChild(c);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 4500);
}

function clearStage(st) {
  S.stageDone = true;
  const before = OUTFITS.filter((o) => outfitUnlocked(o.id)).map((o) => o.id);
  markCleared(st.scene);
  S.mult = scoreMultiplier();
  const unlocked = OUTFITS.filter((o) => outfitUnlocked(o.id) && !before.includes(o.id));
  const parts = unlocked.map((o) => `解鎖新服裝「${o.name}」`);
  parts.push(`分數倍率提升到 ×${S.mult}`);
  showBanner(`第 ${st.no} 關 破關！`, parts.join('　'));
  sfx.stageClear();
  confetti();
  refreshMenuBadges();
}

// ---------- 續跑 ----------
const reviveCost = () => 150 * 2 ** S.revives;
const canRevive = () => S.revives < 2 && store.get('bank', 0) + S.coins >= reviveCost();

function offerRevive() {
  S.mode = 'revive';
  S.reviveT = 5;
  $('reviveCost').textContent = reviveCost();
  $('reviveBank').textContent = (store.get('bank', 0) + S.coins).toLocaleString();
  ui.hud.hidden = true;
  ui.revive.hidden = false;
}

function doRevive() {
  if (S.mode !== 'revive') return;
  const cost = reviveCost();
  const bank = store.get('bank', 0);
  const fromBank = Math.min(bank, cost);
  store.set('bank', bank - fromBank);
  S.coins -= cost - fromBank;
  S.revives++;
  level.clearAround(S.z - 45, S.z + 12);
  Object.assign(S, { mode: 'playing', y: GROUND, vy: 0, grounded: true, floorY: GROUND, slideT: 0, invuln: 2.5, lastBump: -10 });
  ui.revive.hidden = true;
  ui.hud.hidden = false;
  sfx.revive();
  sfx.startMusic();
}

function declineRevive() {
  if (S.mode !== 'revive') return;
  ui.revive.hidden = true;
  gameOver();
}

const score = () => (Math.floor(S.distance) + S.coins * 10 + S.bonus) * S.mult;

function refreshMenuStats() {
  ui.best.textContent = store.get('best', 0).toLocaleString();
  ui.bank.textContent = store.get('bank', 0).toLocaleString();
  refreshMenuBadges();
}

function refreshMenuBadges() {
  $('stagesCount').textContent = `${clearedStages().length}/${STAGES.length}`;
  $('outfitCount').textContent = `${OUTFITS.filter((o) => outfitUnlocked(o.id)).length}/${OUTFITS.length}`;
  $('multStart').textContent = `×${scoreMultiplier()}`;
}

// ---------- 關卡 / 服裝 / 商店 面板 ----------
let panelTab = 'stages';
function openPanel(tab) {
  panelTab = tab;
  ui.panel.hidden = false;
  ui.start.classList.add('panel-open');
  renderPanel();
}
function closePanel() {
  ui.panel.hidden = true;
  ui.start.classList.remove('panel-open');
}

function renderPanel() {
  for (const b of ui.panel.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === panelTab));
  const body = $('panelBody');
  const bank = store.get('bank', 0);
  $('panelBank').textContent = bank.toLocaleString();
  if (panelTab === 'stages') {
    body.innerHTML = `<p class="panel-hint">每個場景是一關。在該場景一次跑完目標距離並收集足夠金幣就破關，解鎖一套新服裝，分數倍率 +1。</p><ol class="stage-list">${STAGES.map((st) => {
      const done = isCleared(st.scene);
      const outfit = OUTFITS.find((o) => o.id === st.outfit);
      return `<li class="${done ? 'done' : ''}" style="--sw: linear-gradient(135deg, ${THEMES[st.scene].swatch[0]}, ${THEMES[st.scene].swatch[1]})">
        <b class="no">${st.no}</b>
        <div><strong>${st.name}</strong><span>${st.distance} m ＋ ${st.coins} 金幣</span><small>獎勵：${outfit.name}</small></div>
        <button type="button" data-play="${st.scene}">${done ? '再玩' : '挑戰'}</button>
      </li>`;
    }).join('')}</ol>`;
  } else if (panelTab === 'wardrobe') {
    body.innerHTML = `<p class="panel-hint">破關解鎖新服裝，點一下就能換上。</p><div class="outfit-grid">${OUTFITS.map((o) => {
      const open = outfitUnlocked(o.id);
      const active = o.id === outfitId;
      const c = o.colors;
      return `<button type="button" class="outfit ${open ? '' : 'locked'}" aria-pressed="${active}" data-outfit="${o.id}" ${open ? '' : 'aria-disabled="true"'}>
        <i style="background: linear-gradient(180deg, ${c.hat} 0 26%, ${c.top} 26% 62%, ${c.pants} 62%)"></i>
        <strong>${o.name}</strong>
        <small>${active ? '使用中' : open ? '換上' : `未解鎖・${outfitRequirement(o.id)}`}</small>
      </button>`;
    }).join('')}</div>`;
  } else {
    const ups = upgrades();
    body.innerHTML = `<p class="panel-hint">用存下來的金幣升級道具，讓效果維持更久。</p><ul class="shop-list">${UPGRADABLE.map((k) => {
      const p = POWERUPS[k];
      const lv = ups[k] || 0;
      const max = lv >= MAX_LEVEL;
      const cost = UPGRADE_COST[lv];
      const now = p.base + lv * p.per;
      return `<li style="--c: ${p.color}">
        <b class="glyph">${p.glyph}</b>
        <div><strong>${p.name}</strong><span>${p.desc}</span>
          <span class="pips">${Array.from({ length: MAX_LEVEL }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span>
          <small>${max ? `${now} 秒（滿級）` : `${now} 秒 → ${now + p.per} 秒`}</small></div>
        <button type="button" data-buy="${k}" ${max ? 'disabled' : ''} class="${!max && bank < cost ? 'poor' : ''}">${max ? '滿級' : `${cost.toLocaleString()} 金幣`}</button>
      </li>`;
    }).join('')}</ul>`;
  }
}

ui.panel.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  sfx.ensure();
  if (t.dataset.tab) {
    sfx.click();
    panelTab = t.dataset.tab;
    renderPanel();
  } else if (t.dataset.play) {
    sfx.click();
    selectScene(t.dataset.play);
    closePanel();
  } else if (t.dataset.outfit) {
    if (!outfitUnlocked(t.dataset.outfit)) {
      sfx.denied();
      return;
    }
    sfx.click();
    outfitId = t.dataset.outfit;
    store.set('outfit', outfitId);
    player.applyOutfit(outfitOf(outfitId));
    renderPanel();
  } else if (t.dataset.buy) {
    const k = t.dataset.buy;
    const ups = upgrades();
    const lv = ups[k] || 0;
    const cost = UPGRADE_COST[lv];
    const bank = store.get('bank', 0);
    if (lv >= MAX_LEVEL || bank < cost) {
      sfx.denied();
      return;
    }
    store.set('bank', bank - cost);
    ups[k] = lv + 1;
    store.set('upgrades', ups);
    sfx.buy();
    renderPanel();
    refreshMenuStats();
  } else if (t.id === 'panelClose') {
    sfx.click();
    closePanel();
  }
});
$('stagesBtn').addEventListener('click', () => openPanel('stages'));
$('wardrobeBtn').addEventListener('click', () => openPanel('wardrobe'));
$('shopBtn').addEventListener('click', () => openPanel('shop'));
$('reviveBtn').addEventListener('click', doRevive);
$('giveUpBtn').addEventListener('click', declineRevive);

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
  sfx.startChime();
  closePanel();
  updateHud();
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
  $('overMult').textContent = `分數倍率 ×${S.mult}${S.stageDone ? `　本次完成第 ${S.stage.no} 關` : ''}`;
  if (isBest) sfx.record();
  else sfx.gameOver();
  ui.hud.hidden = true;
  ui.over.hidden = false;
}

function togglePause() {
  if (S.mode === 'playing') {
    S.mode = 'paused';
    ui.pause.hidden = false;
    sfx.stopMusic();
    sfx.setSpeed(0, false);
    sfx.setRumble(0);
    sfx.setJet(false);
  } else if (S.mode === 'paused') {
    S.mode = 'playing';
    ui.pause.hidden = true;
    sfx.startMusic();
    if (S.power.jetpack > 0) sfx.setJet(true);
  }
}

function toggleMute() {
  const m = !sfx.muted;
  sfx.setMuted(m);
  store.set('muted', m);
  ui.muteBtn.setAttribute('aria-pressed', String(m));
}
ui.muteBtn.setAttribute('aria-pressed', String(sfx.muted));

function toggleMusic() {
  const on = !sfx.musicEnabled;
  sfx.setMusicEnabled(on);
  store.set('music', on);
  ui.musicBtn.setAttribute('aria-pressed', String(!on));
}
ui.musicBtn.setAttribute('aria-pressed', String(!sfx.musicEnabled));

// 場景選擇
const sceneButtons = [...document.querySelectorAll('[data-scene]')];
function selectScene(id, preview = true) {
  S.scene = id;
  store.set('scene', id);
  for (const b of sceneButtons) b.setAttribute('aria-checked', String(b.dataset.scene === id));
  if (preview && S.mode === 'menu') resetRun();
}
for (const b of sceneButtons) {
  const t = THEMES[b.dataset.scene];
  if (t) b.style.setProperty('--sw', `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})`);
  b.addEventListener('click', () => {
    sfx.ensure();
    sfx.click();
    selectScene(b.dataset.scene);
  });
}
selectScene(S.scene, false);

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
ui.musicBtn.addEventListener('click', () => {
  sfx.ensure();
  toggleMusic();
});
for (const id of ['startBtn', 'againBtn', 'menuBtn', 'resumeBtn', 'pauseBtn', 'stagesBtn', 'wardrobeBtn', 'shopBtn', 'reviveBtn', 'giveUpBtn']) {
  $(id).addEventListener('pointerdown', () => {
    sfx.ensure();
    sfx.click();
  });
}

// ---------- 輸入：鍵盤 ----------
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key;
  if (!ui.panel.hidden && k === 'Escape') {
    closePanel();
    return;
  }
  if (S.mode === 'revive') {
    if (k === 'Enter') doRevive();
    if (k === 'Escape') declineRevive();
    return;
  }
  if (!ui.panel.hidden) return;
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
    if (S.crashT > 1.2) {
      if (canRevive()) offerRevive();
      else gameOver();
    }
  }
  if (S.mode === 'revive') {
    S.reviveT -= dt;
    $('reviveRing').style.setProperty('--p', Math.max(0, S.reviveT / 5));
    if (S.reviveT <= 0) declineRevive();
  }

  level.update(dt, S.z, S.speed, S.time);
  env.update(S.z, dt);
  syncTheme();
  updateTrainAudio(dt);
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
    crashed: S.mode === 'crashing' || S.mode === 'over' || S.mode === 'revive',
    idle: S.mode === 'menu',
    flying: S.power.jetpack > 0,
    lean: -(LANES[S.lane] - S.x) * 0.1,
  });
  ui.powers.hidden = S.mode !== 'playing';
  // 無敵時閃爍；衝刺時身後拖出火花
  player.root.visible = !(S.invuln > 0 && S.mode === 'playing' && Math.floor(S.time * 14) % 2);
  if (S.mode === 'playing' && S.power.dash > 0) stage.burst(new THREE.Vector3(S.x, S.y + 0.9, S.z + 0.6), 2);
  if (S.mode === 'playing' && S.power.jetpack > 0) stage.burst(new THREE.Vector3(S.x, S.y + 0.3, S.z + 0.4), 1);

  // 腳步聲：跟著跑步動畫的節奏
  const stepIdx = Math.floor(player.phase / Math.PI);
  if (stepIdx !== S.stepCount) {
    S.stepCount = stepIdx;
    if (S.mode === 'playing' && S.grounded && S.slideT <= 0) sfx.step(surface());
  }

  updateCamera(dt);
  const dashing = S.power.dash > 0 && S.mode === 'playing';
  const sf = S.mode === 'playing' ? (S.speed - START_SPEED) / (MAX_SPEED - START_SPEED) + (dashing ? 0.9 : 0) : 0;
  sfx.setSpeed(Math.min(1.4, sf), S.mode === 'playing');
  stage.runSpeed = S.mode === 'playing' ? S.speed * (dashing ? DASH_MULT : 1) : 0;
  stage.update(dt, { z: S.z }, sf, S.time);
  stage.render();

  hudTick += dt;
  if (S.mode === 'playing' && hudTick > 0.05) {
    hudTick = 0;
    updateHud();
  }
}

resetRun();
refreshMenuStats();
ui.loading.hidden = true;
ui.start.hidden = false;
frame();

// 方便除錯
window.__rfc = { S, level, stage, update, present, moveLane, jump, slide, activatePower, clearStage, openPanel, store };

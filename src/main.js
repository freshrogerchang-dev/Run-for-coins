// 金幣酷跑 Run for Coins —— 遊戲主程式：狀態、輸入、物理、碰撞、鏡頭、介面
import * as THREE from 'three';
import { Stage } from './stage.js';
import { Models } from './models.js';
import { Environment } from './environment.js';
import { Player } from './player.js';
import { Level, setLevelRng } from './level.js';
import { Boss } from './boss.js';
import { Ghost } from './ghost.js';
import { Sfx } from './audio.js';
import { THEMES, THEME_ORDER } from './themes.js';
import { PowerupModels } from './powerups.js';
import { Chaser } from './chaser.js';
import { PETS, ownedPets, activePet, PetFollower } from './pets.js';
import { SpeedAura, LaneWarnings } from './fx.js';
import { VEHICLE_NAMES } from './vehicles.js';
import {
  LOGIN_REWARDS,
  loginStatus,
  claimLogin,
  rewardText,
  wordHunt,
  nextLetter,
  collectLetter,
  WORD_REWARD,
  currentEvent,
  eventDaysLeft,
  eventState,
  addTokens,
  tierReward,
  EVENT_TIERS,
  BOARD_TYPES,
  ownedBoards,
  activeBoard,
} from './events.js';
import {
  keys,
  give,
  rewardLabel,
  PASS_LEVELS,
  XP_PER_LEVEL,
  seasonInfo,
  passReward,
  passState,
  passLevel,
  addPassXp,
  charLevel,
  charProgress,
  addCharXp,
  charPerk,
  perkText,
  CHAR_MAX,
  ALBUM,
  albumGot,
  albumCount,
  ALBUM_TOTAL,
  ALBUM_REWARD,
  nextAlbumPiece,
  collectAlbum,
  CHEST_PRICE,
  EFFECTS,
  RARITY,
  ownedEffects,
  equipped,
  equip,
  openChest,
  dailyChallenge,
  recordDaily,
  DAILY_TARGET,
  DAILY_CH_REWARD,
  seeded,
} from './season.js';
import {
  Meta,
  CHARACTERS,
  ownedCharacters,
  boards,
  setBoards,
  BOARD_PRICE,
  BOARD_TIME,
  ACHIEVEMENTS,
  missionText,
  DAILY_BONUS,
} from './meta.js';
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
  // 中文字型依字元分包下載：先把畫在 Canvas 上的字都載好，招牌才不會用到備用字型
  const canvasText =
    '金幣大道站酷跑拉麵卡拉咖啡壽司珍珠奶茶滷肉飯雞排豆花鹽酥刈包港輕軌急行各停星見台海風山桜町月島橋福花貝餅糖楓禮衝飛磁跳盾慢雨巨板寶電危險安全通道';
  const timeout = new Promise((r) => setTimeout(r, 2500));
  await Promise.race([
    Promise.all([
      document.fonts.load('700 40px "Fredoka"', 'RUN FOR COINS 0123456789'),
      document.fonts.load('900 40px "Chiron GoRound TC"', canvasText),
      document.fonts.load('600 16px "Chiron GoRound TC"', '金幣酷跑開始奔跑'),
    ]),
    timeout,
  ]).catch(() => {});
}

await waitFonts();

const stage = new Stage($('game'));
const QUALITY = { high: '高', balanced: '平衡', saver: '省電' };
const QUALITY_ORDER = ['high', 'balanced', 'saver'];
let quality = store.get('quality', stage.ios ? 'balanced' : 'high');
if (!QUALITY[quality]) quality = 'high';
stage.setQuality(quality);
const models = new Models();
const sfx = new Sfx();
sfx.setMuted(store.get('muted', false));
sfx.musicEnabled = store.get('music', true);
const env = new Environment(stage.scene);
const player = new Player();
stage.scene.add(player.root);
const level = new Level(stage.scene, models, sfx, new PowerupModels());
level.themeAt = (z) => THEMES[env.themeAt(z)];
const outfitOf = (id) => OUTFITS.find((o) => o.id === id) || OUTFITS[0];
let outfitId = outfitUnlocked(store.get('outfit', 'street')) ? store.get('outfit', 'street') : 'street';
player.applyOutfit(outfitOf(outfitId));
let charId = ownedCharacters().includes(store.get('char', 'kid')) ? store.get('char', 'kid') : 'kid';
player.applyCharacter(CHARACTERS.find((c) => c.id === charId));
const meta = new Meta();
const chaser = new Chaser(stage.scene);
const pet = new PetFollower(stage.scene);
pet.set(activePet());
const aura = new SpeedAura(stage.scene, player);
const warnings = new LaneWarnings(stage.scene);
player.setBoardStyle(activeBoard());
aura.setStyle(equipped('aura'), equipped('trail'));
const boss = new Boss(stage.scene);
const ghost = new Ghost(stage.scene, OUTFITS[0]);
const projectiles = [];
const NO_RAIN = ['tunnel', 'space', 'snow', 'volcano', 'japan'];

const buzz = (ms) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* 不支援震動 */
  }
};
const DASH_MULT = 1.65;
const JET_Y = 8.2;
const POWER_KEYS = ['dash', 'jetpack', 'magnet', 'double', 'spring', 'shield', 'slowmo', 'giant'];
const SLOW_MULT = 0.62;
const GIANT_MULT = 1.2;
// 角色能力（隨角色等級成長）
const perk = () => charPerk(charId);
// 每日挑戰的特殊規則
const rule = () => S.daily?.rule.id;
const gravity = () => GRAVITY * (rule() === 'lowgrav' ? 0.6 : 1);
const runScene = () => (S.daily ? S.daily.scene : S.scene);
// 目前所有道具加總的奔跑速度倍率
const speedMult = () =>
  (S.power.dash > 0 ? DASH_MULT : 1) * (S.power.slowmo > 0 ? SLOW_MULT : 1) * (S.power.giant > 0 ? GIANT_MULT : 1);
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
    board: 0,
    combo: 0,
    lastCoinT: -10,
    storming: 0,
    weatherT: 14,
    lightningT: 5,
    distAcc: 0,
    roofAcc: 0,
    stormAcc: 0,
    tokens: 0,
    letterPending: false,
    letterAt: -200,
    airJumps: 0,
    squash: 0,
    hitStop: 0,
    roll: 0,
    tut: null,
    crashVehicle: null,
    crashMoving: false,
    zip: null,
    grinding: false,
    grindAcc: 0,
    grindSfx: 0,
    bossNext: 1100,
    bosses: 0,
    albumAt: -300,
  });
  chaser.reset();
  boss.active = false;
  boss.group.visible = false;
  for (const p of projectiles) stage.scene.remove(p.sprite);
  projectiles.length = 0;
  $('bossBar').hidden = true;
  // 每日挑戰：固定種子的跑道與特殊規則
  setLevelRng(S.daily ? seeded(S.daily.seed) : null);
  level.noPowerups = rule() === 'magnet' || rule() === 'nopower';
  level.noPads = rule() === 'nopower';
  level.extraDifficulty = rule() === 'coins2' ? 0.35 : 0;
  ghost.startRecording();
  $('tutHint').hidden = true;
  stage.setStorm(false);
  sfx.setRain(0);
  S.stage = S.scene === 'tour' || S.daily ? null : STAGES.find((st) => st.scene === S.scene) || null;
  player.setPower({ jetpack: false, spring: false, shield: false, magnet: false });
  player.root.visible = true;
  sfx.setJet(false);
  env.setMode(runScene());
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

const stormOn = () => S.storming > 0 && !NO_RAIN.includes(S.theme);
const surface = () => (S.onTrain ? 'metal' : stormOn() ? 'wet' : THEMES[S.theme].surface);

// ---------- 滑板 ----------
function useBoard() {
  if (S.mode !== 'playing' || S.board > 0 || S.power.jetpack > 0) return;
  const n = boards();
  if (n <= 0) {
    sfx.denied();
    flash('沒有滑板了，可以到商店買');
    return;
  }
  setBoards(n - 1);
  const bt = activeBoard();
  S.board = BOARD_TIME;
  S.boardType = bt.id;
  player.setBoardStyle(bt);
  sfx.boardOn();
  flash(bt.id === 'classic' ? '滑板！可以擋一次撞擊' : `${bt.name}！${bt.perk}`);
  if (bt.id === 'rocket') {
    S.power.dash = Math.max(S.power.dash, 3);
    S.powerMax.dash = Math.max(S.powerMax.dash, S.power.dash);
    sfx.dash();
  }
  meta.track('hoverboards');
  syncPowerVisuals();
  updateBoardBtn();
}

function updateBoardBtn() {
  $('boardCount').textContent = boards();
  $('boardBtn').classList.toggle('empty', boards() <= 0);
}

// ---------- 新手教學 ----------
const TUT_TEXT = {
  lane: { title: '往左或往右滑，換到旁邊的軌道', keys: '鍵盤：← 或 →', g: 'g-lane' },
  jump: { title: '往上滑，跳過低柵欄', keys: '鍵盤：↑ 或 空白鍵', g: 'g-up' },
  slide: { title: '往下滑，從高柵欄下面滑過去', keys: '鍵盤：↓', g: 'g-down' },
};

function startTutorial() {
  level.reset(0);
  S.tut = { steps: level.addTutorial(), idx: 0, wait: null, powerGiven: false };
  S.weatherT = 1e9;
}

function showTutHint(step) {
  const el = $('tutHint');
  const t = TUT_TEXT[step.need];
  el.querySelector('b').textContent = t.title;
  el.querySelector('small').textContent = t.keys;
  el.querySelector('.tut-gesture').className = `tut-gesture ${t.g}`;
  el.hidden = false;
}

function updateTutorial() {
  const t = S.tut;
  if (t.wait) return;
  const step = t.steps[t.idx];
  if (step) {
    if (S.z - PLAYER_HALF_D - step.z > step.at) return;
    // 已經先換好道就不用停
    if (step.need === 'lane' && S.lane !== 1) {
      t.idx++;
      return;
    }
    t.wait = step;
    showTutHint(step);
    sfx.powerWarn();
  } else if (!t.powerGiven && S.z < -134) {
    t.powerGiven = true;
    level.addPowerup('magnet', S.lane, S.z - 26);
    flash('撿發光泡泡就能用道具！');
  } else if (S.z < -196) {
    S.tut = null;
    store.set('tutorial', true);
    S.coins += 100;
    bumpCoinHud();
    S.weatherT = 20;
    showBanner('教學完成！+100 金幣', '快撞到的時候點兩下畫面（或按 B）用滑板，可以擋一次撞擊。地上出現紅色箭頭，代表有車迎面衝來！');
    sfx.stageClear();
  }
}

// 教學暫停時只接受指定的動作
function tutGate(action) {
  const t = S.tut;
  if (!t?.wait) return true;
  if (t.wait.need !== action) {
    const el = $('tutHint');
    el.classList.remove('nudge');
    void el.offsetWidth;
    el.classList.add('nudge');
    return false;
  }
  t.wait = null;
  t.idx++;
  $('tutHint').hidden = true;
  sfx.tutorialStep();
  return true;
}

// ---------- 動作 ----------
function moveLane(dir) {
  if (S.mode !== 'playing' || S.zip) return;
  if (!tutGate('lane')) return;
  const next = clamp(S.lane + dir, 0, 2);
  if (next === S.lane) {
    S.shake = Math.max(S.shake, 0.12);
    sfx.bump();
    buzz(15);
    return;
  }
  S.prevLane = S.lane;
  S.lane = next;
  sfx.lane();
  meta.track('lanes');
}

function jump() {
  if (S.mode !== 'playing') return;
  if (S.power.jetpack > 0 || S.zip) return;
  if (!tutGate('jump')) return;
  const bt = S.board > 0 ? S.boardType : null;
  if (S.grounded) {
    S.vy = Math.sqrt(2 * gravity() * (S.power.spring > 0 ? 4.6 : bt === 'bouncer' ? 3.7 : charId === 'fox' ? perk().jump : JUMP_HEIGHT));
    S.grounded = false;
    S.slideT = 0;
    S.airJumps = bt === 'double' ? 1 : 0;
    S.squash = -0.16;
    sfx.jump();
    meta.track('jumps');
  } else if (S.airJumps > 0 && S.board > 0) {
    // 二段跳板：空中再跳一次
    S.airJumps--;
    S.vy = Math.sqrt(2 * gravity() * JUMP_HEIGHT) * 0.95;
    S.squash = -0.14;
    sfx.jump();
    stage.burst(new THREE.Vector3(S.x, S.y, S.z), 10);
    meta.track('jumps');
  } else {
    S.jumpBuffer = 0.16;
  }
}

function slide() {
  if (S.mode !== 'playing' || S.power.jetpack > 0 || S.zip) return;
  if (!tutGate('slide')) return;
  if (S.grounded) {
    S.slideT = SLIDE_TIME;
    sfx.slide(surface());
    meta.track('slides');
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
  S.hitStop = 0.16;
  screenFlash('rgba(255, 60, 40, 0.55)');
  sfx.thud();
  chaser.catchPlayer();
  sfx.bark();
  stage.setStorm(false);
  sfx.setRain(0);
  meta.flush();
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
  if (kind === 'coinrain') {
    level.addCoinRain(S.z - 12, 90);
    sfx.powerup('mystery');
    sfx.coinRain();
    flash('金幣雨！');
    return;
  }
  // 小貓寵物：磁鐵、雙倍金幣多 3 秒；角色能力：阿橘衝刺多 1 秒、小美磁鐵多 3 秒
  const dur =
    powerDuration(kind) +
    (activePet() === 'kitten' && (kind === 'magnet' || kind === 'double') ? 3 : 0) +
    (kind === 'dash' ? perk().dash : 0) +
    (kind === 'magnet' ? perk().magnet : 0);
  S.power[kind] = dur;
  S.powerMax[kind] = dur;
  sfx.powerup(kind);
  flash(POWERUPS[kind].name);
  screenFlash(POWERUPS[kind].color);
  buzz(15);
  if (kind === 'dash') {
    sfx.dash();
    S.shake = Math.max(S.shake, 0.2);
  }
  if (kind === 'giant') {
    sfx.giant();
    S.shake = Math.max(S.shake, 0.4);
  }
  if (kind === 'slowmo') sfx.slowmo();
  if (kind === 'jetpack') {
    S.slideT = 0;
    const run = S.speed * speedMult();
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
    const kinds = [...POWER_KEYS, 'coinrain'];
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
    board: S.board > 0 && S.power.jetpack <= 0,
    jetpack: S.power.jetpack > 0,
    spring: S.power.spring > 0,
    shield: S.power.shield > 0,
    magnet: S.power.magnet > 0,
  });
}

function tickPowers(dt) {
  S.invuln = Math.max(0, S.invuln - dt);
  if (S.board > 0) {
    const b = S.board;
    S.board = Math.max(0, b - dt);
    if (S.board < 2 && Math.floor(b * 2) !== Math.floor(S.board * 2)) sfx.powerWarn();
    if (S.board === 0) {
      sfx.powerEnd();
      syncPowerVisuals();
    }
  }
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
  // 巨人：連列車和斜坡都一起撞飛
  if (S.power.giant > 0 && !o.decorative) {
    level.knock(o, Math.sign(o.x - S.x) || (Math.random() < 0.5 ? -1 : 1));
    sfx.smash();
    sfx.giantStomp();
    meta.track('giantSmash');
    stage.burst(new THREE.Vector3(o.x, 2, o.zFront), 24);
    S.shake = Math.max(S.shake, 0.35);
    S.hitStop = Math.max(S.hitStop, 0.05);
    buzz(25);
    return;
  }
  if (o.kind === 'low' || o.kind === 'high') {
    level.knock(o, Math.sign(o.x - S.x) || (Math.random() < 0.5 ? -1 : 1));
    sfx.smash();
    if (S.power.dash > 0) meta.track('smashes');
    stage.burst(new THREE.Vector3(o.x, 1, o.zFront), 14);
    S.shake = Math.max(S.shake, 0.18);
    S.hitStop = Math.max(S.hitStop, 0.05);
    buzz(20);
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
  // 分岔路線的分隔欄：只會彈回原本的車道
  if (o.kind === 'divider') {
    S.lane = S.prevLane;
    S.x = prevX;
    S.shake = Math.max(S.shake, 0.15);
    sfx.bump();
    return true;
  }
  if (S.power.dash > 0 || S.power.giant > 0 || S.invuln > 0 || S.vaulting > 0) {
    smashOrVault(o);
    return false;
  }
  // 教學中不會失敗
  if (S.tut) {
    smashOrVault(o);
    S.invuln = 1;
    flash('沒關係，再試一次！');
    return false;
  }
  if (side && S.runTime - S.lastBump >= 3) {
    sideBump(prevX);
    return true;
  }
  if (S.board > 0) {
    S.board = 0;
    S.invuln = 1.2;
    S.hitStop = 0.12;
    screenFlash('rgba(255, 61, 127, 0.5)');
    buzz(60);
    sfx.thud();
    sfx.boardBreak();
    stage.burst(new THREE.Vector3(S.x, S.y + 0.3, S.z), 24);
    flash('滑板擋下了撞擊！');
    syncPowerVisuals();
    smashOrVault(o);
    return false;
  }
  if (S.power.shield > 0) {
    S.power.shield = 0;
    S.invuln = 1.2;
    S.hitStop = 0.12;
    screenFlash('rgba(47, 168, 255, 0.5)');
    buzz(60);
    sfx.thud();
    sfx.shieldBreak();
    stage.burst(new THREE.Vector3(S.x, S.y + 1, S.z), 24);
    flash('防護罩擋下了一次撞擊！');
    syncPowerVisuals();
    smashOrVault(o);
    return false;
  }
  S.crashCause = side ? 'caught' : o.kind;
  S.crashVehicle = o.vehicle || null;
  S.crashMoving = !!o.moving;
  crash();
  if (side) flash('被站務員抓到了！');
  return true;
}

function collectCoin(c) {
  c.taken = true;
  c.magnet = false;
  const n = (c.value || 1) * (S.power.double > 0 ? 2 : 1) * (rule() === 'coins2' ? 2 : 1);
  const before = S.coins;
  S.coins += n;
  meta.track('coins', n);
  stage.burst(c.mesh.position, 9);
  bumpCoinHud();
  // 連擊：0.6 秒內連續吃到金幣，音高跟著往上爬
  S.combo = S.runTime - S.lastCoinT < 0.6 ? S.combo + 1 : 1;
  S.lastCoinT = S.runTime;
  sfx.coin(S.combo);
  if (S.combo % 5 === 0) meta.track('combo', 0, S.combo);
  if (S.combo % 10 === 0) {
    const bonus = S.combo * 5;
    S.bonus += bonus;
    showCombo(`連擊 ×${S.combo}　+${bonus} 分`, true);
    sfx.combo(S.combo);
  }
  // 貓頭鷹寵物：每 50 枚金幣多送 5 枚
  if (activePet() === 'owl' && Math.floor(S.coins / 50) > Math.floor(before / 50)) {
    S.coins += 5;
    flash('貓頭鷹博士：+5 金幣');
  }
}

// ---------- 活動代幣、每日字母 ----------
level.onGap = (z, room) => {
  if (S.mode !== 'playing' || S.tut) return;
  const lane = (Math.random() * 3) | 0;
  // 圖鑑收集品：每個場景三個，很少出現
  const sceneHere = env.themeAt(z);
  const piece = nextAlbumPiece(sceneHere);
  if (piece >= 0 && S.distance - S.albumAt > 450 && Math.random() < 0.3 && !level.items.some((it) => it.kind === 'album' && !it.taken)) {
    level.addItem('album', '寶', '#ffb000', '#6a3200', lane, z - room / 2);
    Object.assign(level.items[level.items.length - 1], { albumScene: sceneHere, albumIdx: piece });
    S.albumAt = S.distance;
    return;
  }
  const L = nextLetter();
  if (L && !S.letterPending && S.distance - S.letterAt > 260 && Math.random() < 0.35) {
    level.addItem('letter', L, '#7b3fe4', '#ffffff', lane, z - room / 2, '"Fredoka", sans-serif');
    S.letterPending = true;
    S.letterAt = S.distance;
    return;
  }
  const ev = currentEvent();
  if (ev && Math.random() < 0.5) {
    const n = Math.max(1, Math.min(4, Math.floor(room / 2.4)));
    for (let i = 0; i < n; i++) level.addItem('token', ev.glyph, ev.color, ev.ink, lane, z - 1 - i * 2.4);
  }
};

function collectToken(it) {
  const ev = currentEvent();
  if (!ev) return;
  S.tokens++;
  sfx.token();
  stage.burst(it.mesh.position, 10);
  pop(`+1 ${ev.token}`, 'token');
  for (const r of addTokens(ev, 1)) {
    showNote({ type: 'daily', text: `${ev.name}獎勵：${rewardText(r)}` });
    if (r.outfit) confetti();
  }
  updateBoardBtn();
  updateExtraHud();
}

function collectLetterItem(it) {
  S.letterPending = false;
  const res = collectLetter();
  if (!res) return;
  sfx.letter();
  stage.burst(it.mesh.position, 16);
  const w = wordHunt();
  if (res.completed) {
    showNote({ type: 'daily', text: `拼出 ${w.word}！每日字母獎勵：${rewardText(WORD_REWARD)}` });
    confetti();
    updateBoardBtn();
  } else {
    flash(`字母「${res.letter}」！還差 ${w.word.length - w.got} 個`);
  }
  updateExtraHud();
}

// ---------- 魔王追逐戰 ----------
function startBoss() {
  boss.start(S.distance > 4000 ? 5 : 4);
  S.bossNext = Infinity;
  sfx.bossRoar();
  S.shake = Math.max(S.shake, 0.4);
  showBanner('魔王來了！', '撿藍色的「電」能量球就會自動攻擊魔王，小心牠丟下來的柵欄！');
  $('bossBar').hidden = false;
  updateBossBar();
}

function updateBossBar() {
  $('bossHp').style.transform = `scaleX(${Math.max(0, boss.hp / boss.maxHp)})`;
}

function endBoss(win) {
  boss.leave();
  $('bossBar').hidden = true;
  S.bossNext = S.distance + 1600;
  if (!win) flash('魔王逃走了…下次再打倒牠！');
}

function defeatBoss() {
  S.bosses++;
  meta.track('bosses');
  S.bonus += 1500;
  level.addCoinRain(S.z - 15, 60);
  stage.burst(boss.group.position.clone().setY(5), 60);
  S.shake = Math.max(S.shake, 0.6);
  S.hitStop = 0.2;
  confetti();
  showBanner('打倒魔王！', `+${(1500 * S.mult).toLocaleString()} 分，還有一場金幣雨`);
  sfx.bossDefeat();
  buzz(120);
  endBoss(true);
}

// 魔王丟柵欄：落點附近有其他障礙就不丟，避免出現過不去的組合
function bossThrow({ lane, z }) {
  const blocked = level.obstacles.some((o) => !o.decorative && (o.lane === lane || o.kind === 'divider') && o.zFront > z - 9 && o.zFront - o.length < z + 9);
  if (blocked) return;
  level.addBarrier(Math.random() < 0.5 ? 'low' : 'high', lane, z);
  sfx.bossThrow();
  stage.burst(new THREE.Vector3(LANES[lane], 1, z), 16);
}

function spawnOrb() {
  level.addItem('orb', '電', '#1f9bff', '#ffffff', (Math.random() * 3) | 0, S.z - 55);
}

// 撿到能量球：發射追蹤光球打魔王
function fireOrb(it) {
  sfx.orbFire();
  if (!boss.active || boss.leaving) {
    S.bonus += 100;
    pop(`+${100 * S.mult}`);
    return;
  }
  const sprite = new THREE.Sprite(it.mesh.material);
  sprite.scale.setScalar(1.1);
  sprite.position.set(S.x, S.y + 1.2, S.z);
  stage.scene.add(sprite);
  projectiles.push({ sprite, t: 0, from: sprite.position.clone() });
}

const projTarget = new THREE.Vector3();
function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.t += dt / 0.45;
    projTarget.copy(boss.group.position).setY(boss.group.position.y + 4.8);
    const k = Math.min(1, p.t);
    p.sprite.position.lerpVectors(p.from, projTarget, k * k);
    p.sprite.position.y += Math.sin(k * Math.PI) * 2;
    if (p.t < 1) continue;
    stage.scene.remove(p.sprite);
    projectiles.splice(i, 1);
    if (!boss.active || boss.leaving) continue;
    boss.hit();
    sfx.bossHit();
    S.shake = Math.max(S.shake, 0.3);
    stage.burst(projTarget, 30);
    pop('命中！', 'hot');
    updateBossBar();
    if (boss.hp <= 0) defeatBoss();
  }
}

// ---------- 圖鑑 ----------
function collectAlbumItem(it) {
  const res = collectAlbum(it.albumScene, it.albumIdx);
  if (!res) return;
  sfx.achievement();
  meta.track('albumPieces');
  stage.burst(it.mesh.position, 30);
  showNote({ type: 'ach', text: `圖鑑：${res.sceneName}「${res.name}」（${res.count}/${res.total}）` });
  if (res.complete) {
    showNote({ type: 'daily', text: `集滿${res.sceneName}的圖鑑！${rewardLabel(ALBUM_REWARD)}` });
    confetti();
    updateBoardBtn();
  }
}

function updateExtraHud() {
  const w = wordHunt();
  const wh = $('wordHud');
  wh.hidden = false;
  wh.classList.toggle('done', w.done);
  wh.innerHTML = [...w.word].map((ch, i) => `<i class="${i < w.got ? 'on' : ''}">${ch}</i>`).join('');
  const ev = currentEvent();
  const th = $('tokenHud');
  th.hidden = !ev;
  if (ev) {
    th.style.setProperty('--c', ev.color);
    th.innerHTML = `<b>${ev.glyph}</b>${eventState(ev).tokens}`;
  }
}

// 畫面中央往上飄的小字
function pop(text, cls = '') {
  const el = document.createElement('div');
  el.className = `fpop ${cls}`;
  el.textContent = text;
  $('pops').appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// 整個畫面閃一下顏色
function screenFlash(color) {
  const el = $('screenFx');
  el.style.setProperty('--c', color);
  el.classList.remove('on');
  void el.offsetWidth;
  el.classList.add('on');
}

function sideBump(prevX) {
  // 換道撞到側面：彈回原車道，站務員追上來；短時間內再撞一次就會被抓（在 hit() 判斷）
  chaser.alert();
  sfx.whistle();
  sfx.bark();
  S.lastBump = S.runTime;
  S.lane = S.prevLane;
  S.x = prevX;
  S.shake = 0.35;
  S.hitStop = 0.08;
  screenFlash('rgba(255, 120, 40, 0.35)');
  buzz(40);
  sfx.bump();
  flash('站務員追上來了！再撞一次就會被抓');
}

// ---------- 物理與碰撞 ----------
function stepPlaying(dt) {
  S.runTime += dt;
  S.speed = Math.min(MAX_SPEED, START_SPEED + S.distance * SPEED_GAIN);
  if (rule() === 'turbo') S.speed = Math.max(S.speed, START_SPEED + (MAX_SPEED - START_SPEED) * 0.75);
  if (rule() === 'magnet') S.power.magnet = S.powerMax.magnet = 9;
  ghost.record(dt, S);
  // 魔王出現
  if (!boss.active && !S.tut && S.distance >= S.bossNext) startBoss();
  level.difficulty = Math.min(1, S.distance / 1800);
  level.runDist = S.distance;
  if (S.tut) updateTutorial();

  const prevX = S.x;
  const prevY = S.y;
  const prevZ = S.z;

  tickPowers(dt);
  S.vaulting = Math.max(0, (S.vaulting || 0) - dt);
  const runSpeed = S.speed * speedMult();
  S.z -= runSpeed * dt;
  S.distance += runSpeed * dt;
  S.distAcc += runSpeed * dt;
  if (S.onTrain && S.grounded) S.roofAcc += runSpeed * dt;
  if (S.distAcc >= 10) {
    meta.track('distance', Math.floor(S.distAcc));
    meta.track('run', 0, Math.floor(S.distance));
    S.distAcc -= Math.floor(S.distAcc);
  }
  if (S.roofAcc >= 10) {
    meta.track('roof', Math.floor(S.roofAcc));
    S.roofAcc -= Math.floor(S.roofAcc);
  }
  updateWeather(dt);
  S.x = damp(S.x, LANES[S.lane], 16, dt);

  // 滑索：經過起點就抓住，掛在鋼索下滑到終點
  if (!S.zip && S.power.jetpack <= 0) {
    for (const zp of level.zips) {
      if (zp.used || Math.abs(S.x - zp.x) > 1.2 || !(prevZ > zp.z0 && S.z <= zp.z0)) continue;
      zp.used = true;
      zp.handle.visible = false;
      S.zip = zp;
      S.lane = zp.lane;
      S.slideT = 0;
      sfx.zip();
      flash('抓住滑索！');
      meta.track('zips');
      break;
    }
  }
  if (S.zip && S.z <= S.zip.z1) {
    S.zip = null;
    S.invuln = Math.max(S.invuln, 0.9);
    S.grounded = false;
    S.vy = 2;
  }
  const flying = S.power.jetpack > 0 || !!S.zip;
  if (flying) {
    S.vy = ((S.zip ? 5.3 : JET_Y) - S.y) * 4;
    S.grounded = false;
  } else if (!S.grounded) S.vy -= gravity() * dt;
  S.y += S.vy * dt;
  S.slideT = Math.max(0, S.slideT - dt);
  S.jumpBuffer = Math.max(0, S.jumpBuffer - dt);
  S.slideBuffer = Math.max(0, S.slideBuffer - dt);

  const h = S.slideT > 0 ? PLAYER_SLIDE_H : PLAYER_H;
  const zMin = S.z - PLAYER_HALF_D;
  const zMax = prevZ + PLAYER_HALF_D;
  let support = GROUND;
  let onTrain = false;
  let onRail = false;

  for (const o of flying ? [] : [...level.obstacles]) {
    const oz0 = o.zFront - o.length;
    const oz1 = o.zFront;
    if (zMax < oz0 || zMin > oz1) continue;
    const reach = o.halfW + PLAYER_HALF_W;
    if (Math.abs(S.x - o.x) >= reach) continue;
    const wasOver = Math.abs(prevX - o.x) < reach - 0.02;

    if (o.kind === 'divider') {
      if (!wasOver && hit(o, true, prevX)) return;
    } else if (o.kind === 'train' || o.kind === 'ramp' || o.kind === 'rail') {
      const top = level.heightAt(o, S.z);
      const tol = o.kind === 'ramp' ? 1.1 : 0.55;
      if (prevY >= top - tol) {
        if (top >= support) {
          onTrain = top > GROUND + 0.3 && o.kind !== 'rail';
          onRail = o.kind === 'rail';
        }
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
    if (!S.grounded && S.vy < -12) {
      sfx.land(surface());
      S.squash = clamp(-S.vy / 110, 0.1, 0.3);
    }
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

  // 磨軌：火花、加分
  S.grinding = onRail && S.grounded;
  if (S.grinding) {
    S.grindAcc += runSpeed * dt;
    S.bonus += runSpeed * dt * 3;
    if (Math.random() < 0.6) stage.burst(new THREE.Vector3(S.x, S.y, S.z + 0.3), 1);
    S.grindSfx -= dt;
    if (S.grindSfx <= 0) {
      S.grindSfx = 0.09;
      sfx.grind();
    }
    if (S.grindAcc >= 10) {
      meta.track('grind', Math.floor(S.grindAcc));
      S.grindAcc -= Math.floor(S.grindAcc);
    }
  }

  // 彈跳床
  for (const sp of level.springs) {
    if (sp.used || Math.abs(sp.x - S.x) > 1.1 || flying) continue;
    if (sp.z > zMax + 1.1 || sp.z < zMin - 1.1 || S.y > GROUND + 0.7) continue;
    sp.used = true;
    sp.t = 0.3;
    const g = gravity();
    S.vy = Math.sqrt(2 * g * 7);
    S.grounded = false;
    S.slideT = 0;
    S.invuln = Math.max(S.invuln, (2 * S.vy) / g + 0.3);
    S.squash = -0.25;
    sfx.boing();
    buzz(20);
    meta.track('trampolines');
  }

  // 吃金幣（磁鐵會把附近的金幣吸過來）
  const magnet = S.power.magnet > 0 || (S.board > 0 && S.boardType === 'magnet');
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
    if (c.y < S.y - 0.4 || c.y > S.y + h + 0.6 || c.fall > 1) continue;
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
    meta.track('powerups');
  }

  // 活動代幣、每日字母
  for (const it of level.items) {
    if (it.taken) continue;
    if (Math.abs(it.x - S.x) > 1.05) continue;
    if (it.z < zMin - 0.7 || it.z > zMax + 0.7) continue;
    if (it.y < S.y - 0.6 || it.y > S.y + h + 0.9) continue;
    it.taken = true;
    if (it.kind === 'token') collectToken(it);
    else if (it.kind === 'orb') fireOrb(it);
    else if (it.kind === 'album') collectAlbumItem(it);
    else collectLetterItem(it);
  }

  // 加速帶：踩上去短暫衝刺
  for (const pad of level.pads) {
    if (pad.used || Math.abs(pad.x - S.x) > 1.1) continue;
    if (pad.z > zMax + 1.6 || pad.z < zMin - 1.6) continue;
    if (S.y > (S.floorY ?? GROUND) + 0.6) continue;
    pad.used = true;
    const t = Math.max(S.power.dash, 1.6 + perk().dash);
    S.power.dash = t;
    S.powerMax.dash = Math.max(S.powerMax.dash, t);
    sfx.boost();
    flash('加速！');
    screenFlash('rgba(80, 220, 255, 0.35)');
    buzz(15);
    meta.track('boosts');
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
    const side = o.kind === 'train' && dx > 1 && dx < 3.5 && S.y < 3;
    if (side || ((o.kind === 'low' || o.kind === 'high') && dx < 1)) {
      o.whooshed = true;
      sfx.whoosh();
      meta.track('nearMiss');
      // 迎面來車擦身而過、越過柵欄都有加分
      if (side && !o.moving) continue;
      const pts = side ? 50 : 25;
      S.bonus += pts;
      if (o.moving) sfx.nearMiss();
      pop(side ? `好險！+${pts * S.mult}` : `漂亮！+${pts * S.mult}`, side ? 'hot' : '');
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

// ---------- 天氣：隨機暴風雨 ----------
function updateWeather(dt) {
  S.weatherT -= dt;
  if (S.weatherT <= 0) {
    if (S.storming > 0) {
      S.weatherT = 14 + Math.random() * 10;
    } else if (Math.random() < 0.3 && !NO_RAIN.includes(S.theme)) {
      S.storming = 25 + Math.random() * 20;
      S.lightningT = 2 + Math.random() * 3;
      flash('暴風雨來了！');
    } else {
      S.weatherT = 12 + Math.random() * 8;
    }
  }
  if (S.storming > 0) {
    S.storming = Math.max(0, S.storming - dt);
    if (S.storming === 0) S.weatherT = 18 + Math.random() * 12;
    if (stormOn()) {
      S.stormAcc += dt;
      if (S.stormAcc >= 1) {
        meta.track('storm', 1);
        S.stormAcc -= 1;
      }
      S.lightningT -= dt;
      if (S.lightningT <= 0) {
        S.lightningT = 4 + Math.random() * 6;
        stage.lightning();
        sfx.thunder(0.3 + Math.random() * 1.2);
      }
    }
  }
  const on = stormOn();
  stage.setStorm(on);
  sfx.setRain(on ? 1 : 0);
}

// 迎面列車的轟隆聲與車輪聲
function updateTrainAudio(dt) {
  let p = 0;
  let vehicleNear = 'train';
  if (S.mode === 'playing') {
    for (const o of level.obstacles) {
      if (!o.moving || !o.active) continue;
      const d = Math.max(0, S.z - o.zFront, o.zFront - o.length - S.z);
      if (1 - d / 90 > p) vehicleNear = o.vehicle;
      p = Math.max(p, 1 - d / 90);
    }
  }
  p = Math.max(0, p);
  sfx.setRumble(p * p);
  if (p > 0.3) {
    S.clackT -= dt;
    if (S.clackT <= 0) {
      if (['train', 'metro', 'tram', 'cablecar'].includes(vehicleNear)) sfx.clack();
      else if (['camels', 'elephants', 'tortoises', 'dinos', 'pandas'].includes(vehicleNear)) sfx.step('sand');
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
  // 巨人時鏡頭拉遠
  S.camPull = damp(S.camPull || 0, S.power.giant > 0 && S.mode === 'playing' ? 1 : 0, 3, dt);
  followPos.set(S.x * 0.7, S.camY + S.camPull * 2.2, S.z + 7.2 + S.camPull * 4);
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
  // 換道時鏡頭微微傾斜
  S.roll = damp(S.roll || 0, S.mode === 'playing' ? (S.x - LANES[S.lane]) * 0.028 : 0, 10, dt);
  stage.camera.rotateZ(S.roll);
  const baseFov = stage.camera.aspect < 0.8 ? 75 : 62;
  const sf = (S.speed - START_SPEED) / (MAX_SPEED - START_SPEED);
  const dashFov = S.mode !== 'playing' ? 0 : (S.power.dash > 0 ? 12 : 0) - (S.power.slowmo > 0 ? 6 : 0);
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
  notes: $('notes'),
  login: $('loginScreen'),
};

// ---------- 每日登入 ----------
function maybeShowLogin() {
  const st = loginStatus();
  if (st.claimed) return;
  $('loginTitle').textContent = `連續第 ${st.streak} 天`;
  $('loginDays').innerHTML = LOGIN_REWARDS.map((r, i) => {
    const cls = i < st.day ? 'past' : i === st.day ? 'today' : '';
    return `<li class="${cls} ${i === 6 ? 'big' : ''}"><small>第 ${i + 1} 天</small><b>${r.coins ? `<i class="coin-icon"></i>${r.coins}` : ''}${r.boards ? `<em>滑板 ×${r.boards}</em>` : ''}</b></li>`;
  }).join('');
  ui.login.hidden = false;
}

$('loginBtn').addEventListener('click', () => {
  sfx.ensure();
  const r = claimLogin();
  ui.login.hidden = true;
  if (!r) return;
  sfx.achievement();
  showNote({ type: 'daily', text: `登入獎勵：${rewardText(r)}` });
  if (loginStatus().day === 6) confetti();
  refreshMenuStats();
  updateBoardBtn();
});

// 任務、成就完成的通知
function showNote(n) {
  const el = document.createElement('div');
  el.className = `note note-${n.type}`;
  el.textContent = n.text;
  ui.notes.appendChild(el);
  setTimeout(() => el.remove(), 3600);
  if (n.type === 'ach') sfx.achievement();
  else sfx.mission();
}

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

const boardEl = document.createElement('div');
boardEl.className = 'pw';
boardEl.hidden = true;
boardEl.style.setProperty('--c', '#ff3d7f');
boardEl.innerHTML = '<b>板</b><span><em>滑板</em><i></i></span>';
ui.powers.appendChild(boardEl);
const boardBar = boardEl.querySelector('i');

let comboTimer;
function showCombo(text, big = false) {
  const el = $('combo');
  el.textContent = text;
  el.hidden = false;
  el.classList.toggle('big', big);
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
  clearTimeout(comboTimer);
  comboTimer = setTimeout(() => (el.hidden = true), big ? 1400 : 900);
}

function updateHud() {
  const gh = S.ghostLead;
  const gEl = $('ghostHud');
  gEl.hidden = !gh;
  if (gh) {
    if (S.distance > gh.best) {
      gEl.textContent = '超越最佳紀錄！';
      gEl.className = 'ghost-hud win';
      if (!ghost.passed) {
        ghost.passed = true;
        pop('超越影子！', 'hot');
        sfx.milestone();
      }
    } else {
      const d = Math.round(gh.lead);
      gEl.textContent = d > 0 ? `影子領先 ${d} m` : `你領先影子 ${-d} m`;
      gEl.className = `ghost-hud ${d > 0 ? '' : 'win'}`;
    }
  }
  if (S.combo >= 5 && S.runTime - S.lastCoinT < 0.1 && S.combo % 10) showCombo(`連擊 ×${S.combo}`);
  const onBoard = S.board > 0;
  if (boardEl.hidden === onBoard) boardEl.hidden = !onBoard;
  if (onBoard) {
    boardBar.style.transform = `scaleX(${S.board / BOARD_TIME})`;
    boardEl.classList.toggle('ending', S.board < 2);
  }
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
// 機器人波特：續跑費用減半
const reviveCost = () => Math.round(150 * 2 ** S.revives * perk().revive);
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
  chaser.caught = false;
  chaser.close = 0;
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
  meta.refreshDaily();
  $('missionCount').textContent = `${meta.daily.missions.filter((m) => m.done).length}/3`;
  $('achCount').textContent = `${meta.ach.length}/${ACHIEVEMENTS.length}`;
  $('charCount').textContent = `${ownedCharacters().length}/${CHARACTERS.length}`;
  $('passCount').textContent = `Lv ${passLevel(passState().xp)}`;
  $('albumCount').textContent = `${albumCount()}/${ALBUM_TOTAL}`;
  $('keyCount').textContent = `鑰匙 ${keys()}`;
  const dc = dailyChallenge();
  $('dailyName').textContent = `每日挑戰：${dc.rule.name}`;
  $('dailyInfo').textContent = `${THEMES[dc.scene].name}・${dc.rule.desc}`;
  $('dailyBest').textContent = dc.state.done ? '✓ 完成' : dc.state.best ? `${dc.state.bestDist}/${DAILY_TARGET} m` : `${DAILY_TARGET} m`;
  // 季節活動入口
  const ev = currentEvent();
  const btn = $('eventBtn');
  btn.hidden = !ev;
  if (ev) {
    const n = eventState(ev).tokens;
    const next = EVENT_TIERS.find((t) => t.n > n);
    btn.style.setProperty('--c', ev.color);
    btn.querySelector('.event-token').textContent = ev.glyph;
    $('eventName').textContent = ev.name;
    $('eventInfo').textContent = `還剩 ${eventDaysLeft(ev)} 天・收集${ev.token}換限定服裝`;
    $('eventCount').textContent = next ? `${n}/${next.n}` : `${n} 全部完成`;
  }
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
  } else if (panelTab === 'missions') {
    meta.refreshDaily();
    const d = meta.daily;
    body.innerHTML = `<p class="panel-hint">每天有三個新任務，午夜更新。完成一個拿金幣，三個全部完成再加 ${DAILY_BONUS} 金幣和一塊滑板。</p><ul class="bar-list">${d.missions.map((m) => `
      <li class="${m.done ? 'done' : ''}">
        <div><strong>${missionText(m)}</strong><span class="bar"><i style="transform: scaleX(${m.progress / m.n})"></i></span><small>${Math.floor(m.progress).toLocaleString()} / ${m.n.toLocaleString()}</small></div>
        <b class="reward">${m.done ? '完成' : `+${m.reward}`}</b>
      </li>`).join('')}
      <li class="${d.bonus ? 'done' : ''} bonus"><div><strong>全部完成獎勵</strong><small>${DAILY_BONUS} 金幣 ＋ 滑板 1 塊</small></div><b class="reward">${d.bonus ? '已領取' : `${d.missions.filter((m) => m.done).length}/3`}</b></li>
    </ul>`;
  } else if (panelTab === 'achievements') {
    body.innerHTML = `<p class="panel-hint">已解鎖 ${meta.ach.length} / ${ACHIEVEMENTS.length} 個成就，每個成就都有金幣獎勵。</p><ul class="bar-list">${ACHIEVEMENTS.map((a) => {
      const done = meta.ach.includes(a.id);
      const v = Math.min(a.goal, meta.stat(a.stat));
      return `<li class="${done ? 'done' : ''}">
        <div><strong>${a.name}</strong><span class="desc">${a.desc}</span><span class="bar"><i style="transform: scaleX(${v / a.goal})"></i></span><small>${Math.floor(v).toLocaleString()} / ${a.goal.toLocaleString()}</small></div>
        <b class="reward">${done ? '達成' : `+${a.reward}`}</b>
      </li>`;
    }).join('')}</ul>`;
  } else if (panelTab === 'characters') {
    const owned = ownedCharacters();
    body.innerHTML = `<p class="panel-hint">用金幣存款解鎖新角色。服裝可以穿在任何角色身上。</p><div class="char-grid">${CHARACTERS.map((c) => {
      const has = owned.includes(c.id);
      const active = c.id === charId;
      return `<button type="button" class="char ${has ? '' : 'locked'}" aria-pressed="${active}" data-char="${c.id}">
        <i class="char-face char-${c.id}" aria-hidden="true"></i>
        <strong>${c.name} <b class="lv">Lv ${charLevel(c.id)}</b></strong><span>${c.desc}</span><em class="perk">${perkText(c.id)}</em>
        <span class="lvbar"><i style="transform: scaleX(${charProgress(c.id).p})"></i></span>
        <small>${active ? '使用中' : has ? '選擇' : `${c.price.toLocaleString()} 金幣解鎖`}</small>
      </button>`;
    }).join('')}</div>
    <p class="panel-hint">角色越常用等級越高（最高 ${CHAR_MAX} 級），能力會跟著變強；5 級開局有護盾，10 級開局就衝刺。</p>
    <h3 class="panel-sub">寵物</h3>
    <p class="panel-hint">寵物會跟著你跑，每隻都有一個小能力。再點一次正在用的寵物可以讓牠休息。</p>
    <div class="char-grid">${PETS.map((p) => {
      const has = ownedPets().includes(p.id);
      const active = p.id === activePet();
      return `<button type="button" class="char ${has ? '' : 'locked'}" aria-pressed="${active}" data-pet="${p.id}">
        <i class="pet-face pet-${p.id}" aria-hidden="true"></i>
        <strong>${p.name}</strong><span>${p.perk}</span>
        <small>${active ? '跟著你中' : has ? '帶牠出門' : `${p.price.toLocaleString()} 金幣`}</small>
      </button>`;
    }).join('')}</div>`;
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
  } else if (panelTab === 'pass') {
    const info = seasonInfo();
    const st = passState();
    const lv = passLevel(st.xp);
    const into = lv >= PASS_LEVELS ? 1 : (st.xp % XP_PER_LEVEL) / XP_PER_LEVEL;
    body.innerHTML = `<div class="pass-head">
        <div><strong>${info.name}</strong><span>還剩 ${info.daysLeft} 天・每跑一場都會累積經驗</span></div>
        <b class="num">Lv ${lv}</b>
      </div>
      <span class="pass-bar"><i style="transform: scaleX(${into})"></i></span>
      <p class="panel-hint">經驗 = 距離 ÷ 4 ＋ 金幣 ＋ 打倒魔王 150；每 ${XP_PER_LEVEL} 經驗升一級，獎勵自動領取。30 級可以拿賽季限定光暈。</p>
      <ol class="pass-list">${Array.from({ length: PASS_LEVELS }, (_, i) => {
        const n = i + 1;
        const r = passReward(n);
        const got = n <= st.claimed;
        return `<li class="${got ? 'got' : n === lv + 1 ? 'next' : ''} ${n % 5 === 0 ? 'big' : ''}"><b>${n}</b><span>${rewardLabel(r)}</span></li>`;
      }).join('')}</ol>`;
  } else if (panelTab === 'album') {
    const got = albumGot();
    body.innerHTML = `<p class="panel-hint">每個場景藏著三個金色的「寶」，在那個場景跑步時偶爾會出現。集滿一個場景送 ${rewardLabel(ALBUM_REWARD)}。目前 ${albumCount()} / ${ALBUM_TOTAL}。</p>
      <ul class="album-list">${THEME_ORDER.map((id) => {
        const g = got[id] || [];
        const done = g.length === ALBUM[id].length;
        return `<li class="${done ? 'done' : ''}" style="--sw: linear-gradient(135deg, ${THEMES[id].swatch[0]}, ${THEMES[id].swatch[1]})">
          <i class="sw" aria-hidden="true"></i>
          <div><strong>${THEMES[id].name}</strong><span>${ALBUM[id].map((name, k) => `<em class="${g.includes(k) ? 'on' : ''}">${g.includes(k) ? name : '？？？'}</em>`).join('')}</span></div>
          <b class="num">${g.length}/${ALBUM[id].length}</b>
        </li>`;
      }).join('')}</ul>`;
  } else if (panelTab === 'gacha') {
    const owned = ownedEffects();
    const aur = equipped('aura').id;
    const trl = equipped('trail').id;
    const card = (e) => {
      const has = owned.includes(e.id);
      const on = e.id === aur || e.id === trl;
      const col = e.rainbow ? 'linear-gradient(90deg, #ff4d4d, #ffd23f, #3dff7a, #3dd6ff, #b45eff)' : e.color ? `rgb(${e.color.map((c) => Math.min(255, Math.round((c / 4) * 255))).join(',')})` : '#3a3f4a';
      return `<button type="button" class="fx-card ${has ? '' : 'locked'}" aria-pressed="${on}" data-equip="${e.id}" ${has ? '' : 'disabled'}>
        <i style="background: ${col}"></i><strong>${e.name}</strong>
        <small style="color: ${RARITY[e.rarity].color}">${has ? (on ? '使用中' : RARITY[e.rarity].name) : e.seasonOnly ? '賽季 30 級' : '寶箱抽'}</small>
      </button>`;
    };
    body.innerHTML = `<div class="gacha-box">
        <div class="chest-box small" aria-hidden="true"><i></i></div>
        <div><strong>扭蛋寶箱</strong><span>抽光暈顏色、跑步足跡特效，也可能抽到金幣或滑板。抽到重複的會換成金幣。</span></div>
      </div>
      <div class="gacha-actions">
        <button type="button" data-chest="coins" class="${store.get('bank', 0) < CHEST_PRICE ? 'poor' : ''}">${CHEST_PRICE} 金幣開一個</button>
        <button type="button" data-chest="key" class="${keys() <= 0 ? 'poor' : ''}">用鑰匙開（有 ${keys()} 把）</button>
      </div>
      <p class="panel-hint">機率：普通 ${RARITY.common.weight}%、稀有 ${RARITY.rare.weight}%、史詩 ${RARITY.epic.weight}%（不含金幣滑板獎）。鑰匙可以從賽季通行證、每日挑戰、圖鑑拿到。</p>
      <h3 class="panel-sub">衝刺光暈</h3>
      <div class="fx-grid">${EFFECTS.filter((e) => e.kind === 'aura').map(card).join('')}</div>
      <h3 class="panel-sub">跑步足跡</h3>
      <div class="fx-grid">${EFFECTS.filter((e) => e.kind === 'trail').map(card).join('')}</div>`;
  } else if (panelTab === 'events') {
    const ev = currentEvent();
    const w = wordHunt();
    const lg = loginStatus();
    let html = '';
    if (ev) {
      const s = eventState(ev);
      html += `<div class="event-card" style="--c: ${ev.color}; --ink: ${ev.ink}">
        <i class="event-token" aria-hidden="true">${ev.glyph}</i>
        <div><strong>${ev.name}</strong><span>還剩 ${eventDaysLeft(ev)} 天・跑道上會出現「${ev.token}」</span></div>
        <b class="num">${s.tokens}</b>
      </div>
      <ul class="bar-list">${EVENT_TIERS.map((t, i) => {
        const done = s.claimed.includes(i);
        return `<li class="${done ? 'done' : ''}"><div><strong>收集 ${t.n} 個${ev.token}</strong><span class="bar"><i style="transform: scaleX(${Math.min(1, s.tokens / t.n)})"></i></span><small>${rewardText(tierReward(ev, t))}</small></div><b class="reward">${done ? '已領取' : `${Math.min(s.tokens, t.n)}/${t.n}`}</b></li>`;
      }).join('')}</ul>`;
    } else {
      html += '<p class="panel-hint">目前沒有季節活動，下一個活動開始時會出現在這裡。</p>';
    }
    html += `<h3 class="panel-sub">每日字母</h3>
      <p class="panel-hint">跑道上偶爾會出現紫色字母，照順序收集，拼出今天的單字就能拿 ${rewardText(WORD_REWARD)}。</p>
      <div class="word-big ${w.done ? 'done' : ''}">${[...w.word].map((ch, i) => `<i class="${i < w.got ? 'on' : ''}">${ch}</i>`).join('')}</div>
      <h3 class="panel-sub">每日登入</h3>
      <p class="panel-hint">目前連續登入 ${lg.streak} 天${lg.claimed ? '，今天的獎勵已經領過了' : ''}。第 7 天可以拿 ${rewardText(LOGIN_REWARDS[6])}。</p>`;
    body.innerHTML = html;
  } else {
    const ups = upgrades();
    const ownedB = ownedBoards();
    const activeB = activeBoard().id;
    body.innerHTML = `<p class="panel-hint">用存下來的金幣買滑板、升級道具。</p><ul class="shop-list">
      <li style="--c: #ff3d7f"><b class="glyph">板</b><div><strong>滑板</strong><span>遊戲中按 B 或點兩下畫面使用，${BOARD_TIME} 秒內擋一次撞擊</span><small>目前有 ${boards()} 塊</small></div>
      <button type="button" data-board="1" class="${bank < BOARD_PRICE ? 'poor' : ''}">${BOARD_PRICE} 金幣</button></li>
      </ul>
      <h3 class="panel-sub">滑板種類</h3>
      <p class="panel-hint">每種滑板都能擋一次撞擊，另外還有自己的能力。選好的滑板會在下次踩上去時使用。</p>
      <ul class="shop-list">${BOARD_TYPES.map((b) => {
        const has = ownedB.includes(b.id);
        const on = b.id === activeB;
        return `<li style="--c: ${b.deck}"><b class="glyph board-glyph" style="--s: ${b.stripe}"></b><div><strong>${b.name}</strong><span>${b.perk}</span></div>
        <button type="button" data-boardtype="${b.id}" ${on ? 'disabled' : ''} class="${!has && bank < b.price ? 'poor' : ''}">${on ? '使用中' : has ? '選擇' : `${b.price.toLocaleString()} 金幣`}</button></li>`;
      }).join('')}</ul>
      <h3 class="panel-sub">道具升級</h3>
      <ul class="shop-list">
      ${UPGRADABLE.map((k) => {
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

function buyCharacter(id) {
  const c = CHARACTERS.find((x) => x.id === id);
  const owned = ownedCharacters();
  if (!owned.includes(id)) {
    const bank = store.get('bank', 0);
    if (bank < c.price) {
      sfx.denied();
      flash(`還差 ${(c.price - bank).toLocaleString()} 金幣`);
      return;
    }
    store.set('bank', bank - c.price);
    store.set('chars', [...owned, id]);
    sfx.buy();
    meta.checkAchievements();
    meta.flush();
  } else sfx.click();
  charId = id;
  store.set('char', id);
  player.applyCharacter(c);
  renderPanel();
  refreshMenuStats();
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
  } else if (t.dataset.char) {
    buyCharacter(t.dataset.char);
  } else if (t.dataset.pet) {
    const id = t.dataset.pet;
    const p = PETS.find((x) => x.id === id);
    const owned = ownedPets();
    if (!owned.includes(id)) {
      const bank = store.get('bank', 0);
      if (bank < p.price) {
        sfx.denied();
        flash(`還差 ${(p.price - bank).toLocaleString()} 金幣`);
        return;
      }
      store.set('bank', bank - p.price);
      store.set('pets', [...owned, id]);
      sfx.buy();
      store.set('pet', id);
      meta.checkAchievements();
      meta.flush();
    } else {
      sfx.click();
      store.set('pet', activePet() === id ? null : id);
    }
    pet.set(activePet());
    renderPanel();
    refreshMenuStats();
  } else if (t.dataset.board) {
    const bank = store.get('bank', 0);
    if (bank < BOARD_PRICE) {
      sfx.denied();
      return;
    }
    store.set('bank', bank - BOARD_PRICE);
    setBoards(boards() + 1);
    sfx.buy();
    renderPanel();
    refreshMenuStats();
  } else if (t.dataset.chest) {
    const res = openChest(t.dataset.chest === 'key');
    if (!res) {
      sfx.denied();
      flash(t.dataset.chest === 'key' ? '沒有鑰匙了' : `還差 ${(CHEST_PRICE - store.get('bank', 0)).toLocaleString()} 金幣`);
      return;
    }
    showChest(res);
    renderPanel();
    refreshMenuStats();
    updateBoardBtn();
  } else if (t.dataset.equip) {
    const e = EFFECTS.find((x) => x.id === t.dataset.equip);
    if (!ownedEffects().includes(e.id)) return;
    sfx.click();
    equip(e);
    aura.setStyle(equipped('aura'), equipped('trail'));
    renderPanel();
  } else if (t.dataset.boardtype) {
    const b = BOARD_TYPES.find((x) => x.id === t.dataset.boardtype);
    const owned = ownedBoards();
    if (!owned.includes(b.id)) {
      const bank = store.get('bank', 0);
      if (bank < b.price) {
        sfx.denied();
        flash(`還差 ${(b.price - bank).toLocaleString()} 金幣`);
        return;
      }
      store.set('bank', bank - b.price);
      store.set('boardTypes', [...owned, b.id]);
      sfx.buy();
    } else sfx.click();
    store.set('boardType', b.id);
    player.setBoardStyle(b);
    renderPanel();
    refreshMenuStats();
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
$('missionsBtn').addEventListener('click', () => openPanel('missions'));
$('achBtn').addEventListener('click', () => openPanel('achievements'));
$('charBtn').addEventListener('click', () => openPanel('characters'));
$('passBtn').addEventListener('click', () => openPanel('pass'));
$('albumBtn').addEventListener('click', () => openPanel('album'));
$('gachaBtn').addEventListener('click', () => openPanel('gacha'));
$('dailyBtn').addEventListener('click', () => {
  sfx.ensure();
  sfx.click();
  S.daily = dailyChallenge();
  resetRun();
  startGame();
});

// ---------- 開寶箱動畫 ----------
function showChest(res) {
  const scr = $('chestScreen');
  const box = $('chestBox');
  box.classList.remove('open');
  scr.hidden = false;
  const rar = RARITY[res.rarity];
  $('chestRarity').textContent = res.effect ? rar.name : '獎勵';
  $('chestRarity').style.color = rar.color;
  $('chestTitle').textContent = '……';
  $('chestNote').textContent = '';
  box.style.setProperty('--c', rar.color);
  sfx.chest();
  setTimeout(() => {
    box.classList.add('open');
    if (res.effect) {
      $('chestTitle').textContent = res.effect.name;
      $('chestNote').textContent = res.duplicate ? `已經有了，換成 ${res.duplicate} 金幣` : '到「扭蛋」分頁就能換上';
      if (!res.duplicate && res.rarity !== 'common') confetti();
    } else {
      $('chestTitle').textContent = rewardLabel(res.prize);
      $('chestNote').textContent = '已經放進你的存款';
    }
  }, 650);
}
$('chestOk').addEventListener('click', () => {
  sfx.click();
  $('chestScreen').hidden = true;
});
$('eventBtn').addEventListener('click', () => {
  sfx.ensure();
  sfx.click();
  openPanel('events');
});
$('tutorialBtn').addEventListener('click', () => {
  sfx.ensure();
  sfx.click();
  startGame(true);
});
$('boardBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  useBoard();
});
$('reviveBtn').addEventListener('click', doRevive);

// ---------- 重置遊戲進度 ----------
const KEEP_KEYS = ['quality', 'muted', 'music'];
$('resetBtn').addEventListener('click', () => {
  sfx.ensure();
  sfx.click();
  $('resetScreen').hidden = false;
});
$('resetCancel').addEventListener('click', () => {
  sfx.click();
  $('resetScreen').hidden = true;
});
$('resetConfirm').addEventListener('click', () => {
  // 先停止存檔，避免重新整理時又把記憶體裡的進度寫回去
  meta.save = () => {};
  meta.flush = () => {};
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('rfc-') && !KEEP_KEYS.includes(k.slice(4))) localStorage.removeItem(k);
    }
  } catch {
    /* 無法存取 localStorage 時沒有進度可清 */
  }
  location.reload();
});

// ---------- 暫停選單：重新開始、回到月台 ----------
// 中途離開時，這局的金幣照樣存進存款，分數也會列入最高分
function bankRun() {
  store.set('bank', store.get('bank', 0) + S.coins);
  const sc = score();
  if (sc > store.get('best', 0)) store.set('best', sc);
  meta.flush();
}
$('restartBtn').addEventListener('click', () => {
  if (S.mode !== 'paused') return;
  bankRun();
  ui.pause.hidden = true;
  resetRun();
  S.mode = 'over';
  startGame();
});
$('quitBtn').addEventListener('click', () => {
  if (S.mode !== 'paused') return;
  bankRun();
  showMenu();
});

function renderQuality() {
  for (const b of document.querySelectorAll('.quality-btn')) b.querySelector('b').textContent = QUALITY[quality];
}
for (const b of document.querySelectorAll('.quality-btn')) {
  b.addEventListener('click', () => {
    sfx.ensure();
    sfx.click();
    quality = QUALITY_ORDER[(QUALITY_ORDER.indexOf(quality) + 1) % QUALITY_ORDER.length];
    store.set('quality', quality);
    stage.setQuality(quality);
    renderQuality();
    if (S.mode === 'paused') stage.render();
  });
}
renderQuality();
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

function startGame(forceTutorial = false) {
  sfx.ensure();
  if (!ui.login.hidden || !$('resetScreen').hidden || !$('chestScreen').hidden) return;
  if (S.mode === 'over') resetRun();
  S.mode = 'playing';
  // 第一次玩（或從選單重看）先跑教學
  if (!S.daily && (forceTutorial === true || !store.get('tutorial', false))) startTutorial();
  // 影子對手：載入這個場景（或今天的每日挑戰）的最佳紀錄
  if (S.tut) ghost.data = null;
  else ghost.load(ghostKey());
  if (S.daily) {
    const r = S.daily.rule;
    setTimeout(() => showBanner(`每日挑戰：${r.name}`, `${r.desc}。跑到 ${DAILY_TARGET} 公尺拿 ${rewardLabel(DAILY_CH_REWARD)}`), 400);
  }
  sfx.startChime();
  sfx.whistle();
  setTimeout(() => sfx.bark(), 500);
  chaser.reset();
  meta.track('runs');
  updateExtraHud();
  // 寵物能力（教學時不用）
  const petId = S.tut ? null : activePet();
  if (petId === 'puppy') {
    S.power.shield = S.powerMax.shield = 12;
    syncPowerVisuals();
  }
  if (petId === 'dragon') {
    S.power.dash = S.powerMax.dash = 3;
    setTimeout(() => sfx.dash(), 300);
  }
  // 角色等級：5 級開局護盾、10 級開局衝刺
  if (!S.tut) {
    const pk = perk();
    if (pk.startShield) S.power.shield = S.powerMax.shield = Math.max(S.power.shield, pk.startShield);
    if (pk.startDash) S.power.dash = S.powerMax.dash = Math.max(S.power.dash, pk.startDash);
    syncPowerVisuals();
  }
  closePanel();
  updateHud();
  updateBoardBtn();
  ui.start.hidden = true;
  ui.over.hidden = true;
  ui.pause.hidden = true;
  ui.hud.hidden = false;
  sfx.startMusic();
}

function showMenu() {
  S.daily = null;
  resetRun();
  S.mode = 'menu';
  ui.over.hidden = true;
  ui.pause.hidden = true;
  ui.hud.hidden = true;
  ui.start.hidden = false;
  refreshMenuStats();
  maybeShowLogin();
}

const ghostKey = () => (S.daily ? `ghost-daily-${S.daily.date}` : `ghost-${S.scene}`);

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
  const doneToday = meta.daily.missions.filter((m) => m.done).length;
  $('overMult').textContent = `分數倍率 ×${S.mult}　今日任務 ${doneToday}/3${S.stageDone ? `　本次完成第 ${S.stage.no} 關` : ''}`;
  renderOverProgress(sc, best, isBest);
  // 影子：比上次跑得遠就存成新的影子
  if (ghost.save(ghostKey(), S.distance) && S.daily) {
    const old = store.get('ghostDaily', null);
    if (old && old !== ghostKey()) {
      try {
        localStorage.removeItem(`rfc-${old}`);
      } catch {
        /* 忽略 */
      }
    }
    store.set('ghostDaily', ghostKey());
  }
  const lines = [];
  // 每日挑戰
  if (S.daily) {
    const r = recordDaily(sc, S.distance);
    const st = dailyChallenge().state;
    lines.push(`每日挑戰今日最佳 ${st.best.toLocaleString()} 分${st.done ? '　✓ 已達成' : `　目標 ${DAILY_TARGET} m`}`);
    if (r) showNote({ type: 'daily', text: `每日挑戰完成！${rewardLabel(r)}` });
  }
  // 賽季經驗、角色經驗
  const xp = Math.floor(S.distance / 4) + S.coins + S.bosses * 150 + (S.daily ? 100 : 0);
  const pass = addPassXp(xp);
  for (const g of pass.got) showNote({ type: 'daily', text: `賽季 Lv ${g.lv} 獎勵：${rewardLabel(g.r)}` });
  const cx = addCharXp(charId, Math.floor(S.distance / 2) + S.coins);
  const cName = CHARACTERS.find((c) => c.id === charId).name;
  lines.unshift(`賽季經驗 +${xp}（Lv ${pass.before}${pass.after > pass.before ? ` → ${pass.after}` : ''}）　${cName} Lv ${cx.before}${cx.after > cx.before ? ` → ${cx.after}` : ''}`);
  if (cx.after > cx.before) showNote({ type: 'ach', text: `${cName}升到 Lv ${cx.after}！${perkText(charId)}` });
  $('overXp').innerHTML = lines.join('<br />');
  updateBoardBtn();
  meta.flush();
  if (isBest) sfx.record();
  else sfx.gameOver();
  ui.hud.hidden = true;
  ui.over.hidden = false;
}

// ---------- 結束畫面：為什麼輸、離目標還差多少 ----------
function crashReason() {
  const v = VEHICLE_NAMES[S.crashVehicle] || '列車';
  switch (S.crashCause) {
    case 'low':
      return ['撞到低柵欄', '低柵欄要往上滑跳過去'];
    case 'high':
      return ['撞到高柵欄', '高柵欄要往下滑，從下面鏟過去'];
    case 'ramp':
      return ['撞到斜坡側面', '斜坡要從正前方跑上去'];
    case 'rail':
      return ['撞到磨軌欄杆', '欄杆要跳上去，可以一路磨軌加分'];
    case 'caught':
      return ['被站務員抓到了', '側面撞到兩次就會被抓，換道前先看清楚旁邊'];
    case 'train':
      return S.crashMoving
        ? [`撞上迎面來的${v}`, '地上出現紅色箭頭就代表有車衝來，要提早換道']
        : [`撞上停著的${v}`, '可以從斜坡跑上車頂，或提早換到空的軌道'];
    default:
      return null;
  }
}

function renderOverProgress(sc, best, isBest) {
  const why = crashReason();
  $('overCause').innerHTML = why ? `<b>${why[0]}</b>　${why[1]}` : '';
  $('overCause').hidden = !why;
  const rows = [];
  const row = (text, p) => rows.push(`<li><span>${text}</span>${p == null ? '' : `<i class="bar"><i style="transform: scaleX(${clamp(p, 0, 1)})"></i></i>`}</li>`);
  if (!isBest && best > 0) row(`離最高分還差 <b>${(best - sc).toLocaleString()}</b> 分`, sc / best);
  const st = S.stage;
  if (st && !isCleared(st.scene)) {
    const needD = Math.max(0, st.distance - Math.floor(S.distance));
    const needC = Math.max(0, st.coins - S.coins);
    const parts = [needD ? `${needD} 公尺` : '', needC ? `${needC} 金幣` : ''].filter(Boolean).join('、');
    row(`第 ${st.no} 關還差 <b>${parts}</b>`, Math.min(S.distance / st.distance, S.coins / st.coins));
  }
  const w = wordHunt();
  if (!w.done) row(`每日字母 <b class="word">${w.word}</b>　已收集 ${w.got}/${w.word.length}`, w.got / w.word.length);
  const ev = currentEvent();
  if (ev) {
    const n = eventState(ev).tokens;
    const next = EVENT_TIERS.find((t) => t.n > n);
    row(`${ev.name}：${ev.token} ${n}${S.tokens ? `（這場 +${S.tokens}）` : ''}${next ? `，${next.n} 個換 ${rewardText(tierReward(ev, next))}` : ''}`, next ? n / next.n : 1);
  }
  // 下一個可以解鎖的東西
  const bank = store.get('bank', 0);
  const goals = [
    ...CHARACTERS.filter((c) => !ownedCharacters().includes(c.id)).map((c) => ({ name: `角色「${c.name}」`, price: c.price })),
    ...PETS.filter((p) => !ownedPets().includes(p.id)).map((p) => ({ name: `寵物「${p.name}」`, price: p.price })),
    ...BOARD_TYPES.filter((b) => !ownedBoards().includes(b.id)).map((b) => ({ name: `${b.name}`, price: b.price })),
  ].sort((a, b) => a.price - b.price);
  const g = goals[0];
  if (g) row(bank >= g.price ? `金幣夠了！可以去解鎖${g.name}` : `再存 <b>${(g.price - bank).toLocaleString()}</b> 金幣就能解鎖${g.name}`, bank / g.price);
  for (const m of meta.daily.missions) {
    if (!m.done) row(`任務：${missionText(m)}　${Math.floor(m.progress).toLocaleString()}/${m.n.toLocaleString()}`, m.progress / m.n);
  }
  $('overProgress').innerHTML = rows.slice(0, 6).join('');
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
  S.daily = null;
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
for (const id of ['startBtn', 'againBtn', 'menuBtn', 'resumeBtn', 'pauseBtn', 'stagesBtn', 'wardrobeBtn', 'shopBtn', 'missionsBtn', 'achBtn', 'charBtn', 'reviveBtn', 'giveUpBtn', 'restartBtn', 'quitBtn']) {
  $(id).addEventListener('pointerdown', () => {
    sfx.ensure();
    sfx.click();
  });
}

// ---------- 輸入：鍵盤 ----------
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key;
  if (!$('resetScreen').hidden) {
    if (k === 'Escape') $('resetScreen').hidden = true;
    return;
  }
  if (!$('chestScreen').hidden) {
    if (k === 'Enter' || k === 'Escape' || k === ' ') $('chestScreen').hidden = true;
    return;
  }
  if (!ui.login.hidden) {
    if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      $('loginBtn').click();
    }
    return;
  }
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
  if ((k === 'b' || k === 'B') && S.mode === 'playing') {
    useBoard();
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
let lastTap = 0;
canvas.addEventListener('pointerdown', (e) => {
  touch = { x: e.clientX, y: e.clientY, used: false };
  const now = performance.now();
  if (now - lastTap < 280) useBoard();
  lastTap = now;
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
  if (document.hidden) meta.flush();
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
  if (boss.active) {
    const ev = boss.update(dt, S.z, S.time);
    if (S.mode === 'playing' && !boss.leaving) {
      if (ev.throw) bossThrow(ev.throw);
      if (ev.orb) spawnOrb();
      if (boss.time <= 0) endBoss(false);
    }
  }
  updateProjectiles(dt);
  const warn = warnings.update(dt, S, level.obstacles, S.time, S.mode === 'playing');
  S.danger = warn.danger;
  if (warn.fresh.length) sfx.warn();
  if (S.letterPending && !level.items.some((it) => it.kind === 'letter' && !it.taken)) S.letterPending = false;
  env.update(S.z, dt);
  syncTheme();
  updateTrainAudio(dt);
  if (chaser.update(dt, S, S.mode === 'playing' || S.mode === 'crashing') && S.mode === 'playing') {
    flash('甩掉站務員了！');
    meta.track('escapes');
  }
  for (const n of meta.takeNotes()) showNote(n);
  if (meta.pending) meta.save();
}

function frame() {
  requestAnimationFrame(frame);
  let dt = Math.min(clock.getDelta(), 1 / 30);
  if (S.mode === 'paused') {
    stage.render();
    return;
  }
  // 撞擊瞬間停格；教學提示時幾乎靜止
  if (S.hitStop > 0) {
    S.hitStop -= dt;
    dt *= 0.06;
  } else if (S.tut?.wait) dt *= 0.035;
  update(dt);
  present(dt);
}

// 迎面車輛的畫面警示：驚嘆號標在該車道上方
const warnEls = [...document.querySelectorAll('#laneWarn i')];
const warnVec = new THREE.Vector3();
function updateWarnHud() {
  const d = S.mode === 'playing' ? S.danger || [0, 0, 0] : [0, 0, 0];
  warnEls.forEach((el, i) => {
    const on = d[i] > 0;
    if (el.classList.contains('on') !== on) el.classList.toggle('on', on);
    if (!on) return;
    warnVec.set(LANES[i], S.y + 1.5, S.z - 26).project(stage.camera);
    el.style.left = `${((warnVec.x + 1) / 2) * 100}%`;
    el.style.opacity = String(0.4 + 0.6 * d[i]);
  });
}

function present(dt) {
  player.root.position.set(S.x, S.y, S.z);
  S.giantScale = damp(S.giantScale || 1, S.power.giant > 0 && S.mode !== 'menu' ? 1.9 : 1, 6, dt);
  // 落地壓扁、起跳拉長
  S.squash = damp(S.squash || 0, 0, 11, dt);
  const sc = player.baseScale * S.giantScale;
  player.root.scale.set(sc * (1 + S.squash * 0.5), sc * (1 - S.squash), sc * (1 + S.squash * 0.5));
  pet.update(dt, S, S.mode === 'menu');
  player.animate(dt, {
    speed: S.speed,
    grounded: S.grounded,
    vy: S.vy,
    sliding: S.slideT > 0,
    crashed: S.mode === 'crashing' || S.mode === 'over' || S.mode === 'revive',
    idle: S.mode === 'menu',
    flying: S.power.jetpack > 0 || !!S.zip,
    grind: S.grinding && S.mode === 'playing',
    lean: -(LANES[S.lane] - S.x) * 0.16,
  });
  // 影子對手
  const gh = ghost.update(dt, S, S.mode === 'playing' || S.mode === 'crashing');
  S.ghostLead = gh;
  ui.powers.hidden = S.mode !== 'playing';
  // 無敵時閃爍；衝刺時身後拖出火花
  player.root.visible = !(S.invuln > 0 && S.mode === 'playing' && Math.floor(S.time * 14) % 2);
  if (S.mode === 'playing' && S.power.dash > 0 && Math.random() < 0.5) stage.burst(new THREE.Vector3(S.x, S.y + 0.9, S.z + 0.6), 1);
  if (S.mode === 'playing' && S.power.jetpack > 0) stage.burst(new THREE.Vector3(S.x, S.y + 0.3, S.z + 0.4), 1);

  // 腳步聲：跟著跑步動畫的節奏
  const stepIdx = Math.floor(player.phase / Math.PI);
  if (stepIdx !== S.stepCount) {
    S.stepCount = stepIdx;
    if (S.mode === 'playing' && S.grounded && S.slideT <= 0) sfx.step(surface());
  }

  updateCamera(dt);
  const dashing = S.power.dash > 0 && S.mode === 'playing';
  // 衝刺光暈、光帶與速度線變金色
  aura.update(dt, dashing, stage.camera.position, S.time, S.mode === 'playing' && S.grounded && !S.zip);
  if (dashing !== S.goldLines) {
    S.goldLines = dashing;
    stage.speedLines.material.color.set(dashing ? '#ffcf5a' : '#ffffff');
  }
  updateWarnHud();
  const sf = S.mode === 'playing' ? (S.speed - START_SPEED) / (MAX_SPEED - START_SPEED) + (dashing ? 0.9 : 0) : 0;
  sfx.setSpeed(Math.min(1.4, sf), S.mode === 'playing');
  stage.runSpeed = S.mode === 'playing' ? S.speed * speedMult() : 0;
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
maybeShowLogin();
frame();

// 方便除錯
window.__rfc = { S, level, stage, update, present, moveLane, jump, slide, activatePower, clearStage, openPanel, store, meta, chaser, useBoard, sideBump, startGame, aura, warnings, player, env, selectScene, boss, ghost, gameOver, startBoss };

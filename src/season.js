// 長期成長：賽季通行證、角色等級、圖鑑、扭蛋寶箱與特效、每日挑戰
import { store, OUTFITS } from './progress.js';
import { THEME_ORDER, THEMES } from './themes.js';
import { boards, setBoards, today, seeded } from './meta.js';

const addBank = (n) => store.set('bank', store.get('bank', 0) + n);
export const keys = () => store.get('keys', 0);
const setKeys = (n) => store.set('keys', Math.max(0, n));

// 發放獎勵：金幣、滑板、鑰匙、特效
export function give(r) {
  if (r.coins) addBank(r.coins);
  if (r.boards) setBoards(boards() + r.boards);
  if (r.keys) setKeys(keys() + r.keys);
  if (r.effect) grantEffect(r.effect);
}

export function rewardLabel(r) {
  const parts = [];
  if (r.coins) parts.push(`${r.coins} 金幣`);
  if (r.boards) parts.push(`滑板 ×${r.boards}`);
  if (r.keys) parts.push(`寶箱鑰匙 ×${r.keys}`);
  if (r.effect) parts.push(`特效「${EFFECTS.find((e) => e.id === r.effect)?.name}」`);
  if (r.outfit) parts.push(`服裝「${OUTFITS.find((o) => o.id === r.outfit)?.name}」`);
  return parts.join(' ＋ ');
}

// ======================= 賽季通行證 =======================
export const PASS_LEVELS = 30;
export const XP_PER_LEVEL = 400;
const SEASON_NAMES = ['新春開跑', '冬日衝刺', '春風奔跑', '花開金幣', '初夏狂奔', '極速之夏', '盛夏煙火', '海風假期', '金秋之月', '楓紅旅程', '霓虹夜跑', '雪花慶典'];

export function seasonInfo(d = new Date()) {
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return {
    id: `${d.getFullYear()}-${d.getMonth() + 1}`,
    name: `第 ${d.getMonth() + 1} 季・${SEASON_NAMES[d.getMonth()]}`,
    daysLeft: Math.max(1, Math.ceil((end - d) / 864e5)),
  };
}

// 每一級的獎勵：5 的倍數送鑰匙，10 的倍數加碼，30 級是賽季限定特效
export function passReward(lv) {
  if (lv === PASS_LEVELS) return { coins: 1000, keys: 3, effect: 'aura-season' };
  if (lv % 10 === 0) return { coins: 500, keys: 2 };
  if (lv % 5 === 0) return { keys: 1 };
  if (lv % 3 === 0) return { boards: 1 };
  return { coins: 100 + lv * 10 };
}

export function passState() {
  const id = seasonInfo().id;
  let s = store.get('pass', null);
  if (!s || s.id !== id) {
    s = { id, xp: 0, claimed: 0 };
    store.set('pass', s);
  }
  return s;
}

export const passLevel = (xp) => Math.min(PASS_LEVELS, Math.floor(xp / XP_PER_LEVEL));

// 加經驗，自動領取新達成等級的獎勵
export function addPassXp(n) {
  const s = passState();
  const before = passLevel(s.xp);
  s.xp += Math.max(0, Math.round(n));
  const after = passLevel(s.xp);
  const got = [];
  for (let lv = s.claimed + 1; lv <= after; lv++) {
    const r = passReward(lv);
    give(r);
    got.push({ lv, r });
  }
  s.claimed = Math.max(s.claimed, after);
  store.set('pass', s);
  return { before, after, got, xp: s.xp };
}

// ======================= 角色等級 =======================
export const CHAR_MAX = 10;
const CHAR_XP = [0, 250, 600, 1100, 1800, 2700, 3800, 5100, 6700, 8600];

export const charXp = (id) => store.get('charXp', {})[id] || 0;
export function charLevel(id) {
  const xp = charXp(id);
  let lv = 1;
  while (lv < CHAR_MAX && xp >= CHAR_XP[lv]) lv++;
  return lv;
}
export function charProgress(id) {
  const lv = charLevel(id);
  if (lv >= CHAR_MAX) return { lv, p: 1, need: 0 };
  const a = CHAR_XP[lv - 1];
  const b = CHAR_XP[lv];
  return { lv, p: (charXp(id) - a) / (b - a), need: b - charXp(id) };
}
export function addCharXp(id, n) {
  const all = store.get('charXp', {});
  const before = charLevel(id);
  all[id] = (all[id] || 0) + Math.max(0, Math.round(n));
  store.set('charXp', all);
  return { before, after: charLevel(id) };
}

// 角色能力隨等級成長；5 級開局護盾、10 級開局衝刺
export function charPerk(id, lv = charLevel(id)) {
  const k = lv - 1;
  return {
    dash: id === 'kid' ? 1 + 0.2 * k : 0,
    magnet: id === 'girl' ? 3 + 0.3 * k : 0,
    revive: id === 'robot' ? 0.5 - 0.025 * k : 1,
    jump: id === 'fox' ? 2.6 + 0.05 * k : 0,
    startShield: lv >= 5 ? 5 : 0,
    startDash: lv >= 10 ? 2 : 0,
  };
}

export function perkText(id, lv = charLevel(id)) {
  const p = charPerk(id, lv);
  const main = {
    kid: `衝刺鞋和加速帶多 ${p.dash.toFixed(1)} 秒`,
    girl: `金幣磁鐵多 ${p.magnet.toFixed(1)} 秒`,
    robot: `續跑只要 ${Math.round(p.revive * 100)}% 費用`,
    fox: `跳躍高度 ${p.jump.toFixed(2)} 公尺`,
  }[id];
  const extra = [];
  if (p.startShield) extra.push('開局護盾 5 秒');
  if (p.startDash) extra.push('開局衝刺 2 秒');
  return [main, ...extra].join('・');
}

// ======================= 圖鑑：每個場景三個隱藏收集品 =======================
export const ALBUM = {
  city: ['懷舊車票', '站長帽徽', '金幣大道站牌'],
  seaside: ['玻璃浮球', '燈塔模型', '海星吊飾'],
  tunnel: ['礦工頭燈', '老鐵道釘', '隧道紀念章'],
  snow: ['雪人鈕扣', '小木屋鑰匙', '冰晶雪花'],
  neon: ['霓虹燈管', '復古卡帶', '街機代幣'],
  desert: ['仙人掌胸針', '牛仔警徽', '沙漠玫瑰石'],
  sakura: ['御守', '櫻花書籤', '迷你鳥居'],
  jungle: ['巨嘴鳥羽毛', '藤蔓手環', '雨林青蛙'],
  volcano: ['黑曜石', '熔岩結晶', '消防徽章'],
  space: ['太空食品', '月球隕石', '火箭模型'],
  underwater: ['珍珠', '海盜金幣', '小潛艇'],
  candy: ['彩虹棒棒糖', '薑餅人', '魔法糖粉'],
  dino: ['恐龍蛋', '三角龍角', '琥珀化石'],
  halloween: ['南瓜燈籠', '巫師掃帚', '幽靈糖果'],
  skycity: ['雲朵枕頭', '飛船羅盤', '熱氣球票'],
  bamboo: ['熊貓玩偶', '竹編小籃', '翠竹笛'],
  japan: ['地鐵紀念章', '車站便當', '招財貓'],
  taiwan: ['珍奶杯', '輕軌悠遊卡', '港口明信片'],
  la: ['好萊塢星星', '衝浪板吊飾', '甜甜圈抱枕'],
  nyc: ['計程車模型', '紐約貝果', '自由火炬徽章'],
  sf: ['纜車鈴鐺', '吊橋明信片', '幸運餅乾'],
};
export const ALBUM_REWARD = { coins: 300, keys: 1 };
export const albumGot = () => store.get('album', {});
export const albumCount = () => Object.values(albumGot()).reduce((s, l) => s + l.length, 0);
export const ALBUM_TOTAL = Object.values(ALBUM).reduce((s, l) => s + l.length, 0);

export function nextAlbumPiece(scene) {
  const names = ALBUM[scene];
  if (!names) return -1;
  const got = albumGot()[scene] || [];
  return names.findIndex((_, i) => !got.includes(i));
}

export function collectAlbum(scene, idx) {
  const all = albumGot();
  const got = all[scene] || [];
  if (got.includes(idx)) return null;
  got.push(idx);
  all[scene] = got;
  store.set('album', all);
  const complete = got.length === ALBUM[scene].length;
  if (complete) give(ALBUM_REWARD);
  return { name: ALBUM[scene][idx], count: got.length, total: ALBUM[scene].length, complete, sceneName: THEMES[scene].name };
}

// ======================= 扭蛋寶箱與特效 =======================
export const CHEST_PRICE = 300;
// aura：衝刺光暈的顏色；trail：平常跑步時腳下的光帶
export const EFFECTS = [
  { id: 'aura-gold', kind: 'aura', name: '金色光暈', rarity: 'common', color: [3, 1.7, 0.35], free: true },
  { id: 'aura-blue', kind: 'aura', name: '冰藍光暈', rarity: 'common', color: [0.4, 1.8, 4] },
  { id: 'aura-pink', kind: 'aura', name: '櫻粉光暈', rarity: 'common', color: [4, 0.7, 2.2] },
  { id: 'aura-green', kind: 'aura', name: '翡翠光暈', rarity: 'rare', color: [0.6, 3.6, 0.9] },
  { id: 'aura-purple', kind: 'aura', name: '星雲光暈', rarity: 'rare', color: [2.2, 0.8, 4] },
  { id: 'aura-rainbow', kind: 'aura', name: '彩虹光暈', rarity: 'epic', rainbow: true },
  { id: 'aura-season', kind: 'aura', name: '賽季冠軍光暈', rarity: 'epic', color: [4, 3.2, 1.2], seasonOnly: true },
  { id: 'trail-none', kind: 'trail', name: '不要腳下光帶', rarity: 'common', free: true },
  { id: 'trail-gold', kind: 'trail', name: '金色腳印', rarity: 'common', color: [2.6, 1.6, 0.3] },
  { id: 'trail-blue', kind: 'trail', name: '藍色流星', rarity: 'common', color: [0.4, 1.6, 3.6] },
  { id: 'trail-pink', kind: 'trail', name: '粉紅愛心', rarity: 'rare', color: [3.6, 0.6, 2] },
  { id: 'trail-fire', kind: 'trail', name: '火焰足跡', rarity: 'rare', color: [4, 1.1, 0.2] },
  { id: 'trail-rainbow', kind: 'trail', name: '彩虹足跡', rarity: 'epic', rainbow: true },
];
export const RARITY = {
  common: { name: '普通', color: '#9aa7b8', weight: 60 },
  rare: { name: '稀有', color: '#2fa8ff', weight: 30 },
  epic: { name: '史詩', color: '#c26bff', weight: 10 },
};

export const ownedEffects = () => {
  const list = store.get('effects', []);
  return [...EFFECTS.filter((e) => e.free).map((e) => e.id), ...list];
};
function grantEffect(id) {
  const list = store.get('effects', []);
  if (!list.includes(id)) store.set('effects', [...list, id]);
}
export const equipped = (kind) => {
  const id = store.get(kind === 'aura' ? 'auraFx' : 'trailFx', kind === 'aura' ? 'aura-gold' : 'trail-none');
  return EFFECTS.find((e) => e.id === id && ownedEffects().includes(id)) || EFFECTS.find((e) => e.kind === kind && e.free);
};
export const equip = (e) => store.set(e.kind === 'aura' ? 'auraFx' : 'trailFx', e.id);

// 開寶箱：先抽稀有度，再抽該稀有度的特效；抽到重複的換成金幣
export function openChest(useKey) {
  if (useKey) {
    if (keys() <= 0) return null;
    setKeys(keys() - 1);
  } else {
    const bank = store.get('bank', 0);
    if (bank < CHEST_PRICE) return null;
    store.set('bank', bank - CHEST_PRICE);
  }
  // 有 25% 機會是金幣或滑板
  if (Math.random() < 0.25) {
    const r = Math.random() < 0.5 ? { coins: [150, 250, 400][(Math.random() * 3) | 0] } : { boards: 1 + ((Math.random() * 2) | 0) };
    give(r);
    return { prize: r, rarity: 'common' };
  }
  let roll = Math.random() * 100;
  let rarity = 'common';
  for (const [k, v] of Object.entries(RARITY)) {
    roll -= v.weight;
    if (roll <= 0) {
      rarity = k;
      break;
    }
  }
  const pool = EFFECTS.filter((e) => e.rarity === rarity && !e.free && !e.seasonOnly);
  const e = pool[(Math.random() * pool.length) | 0];
  if (ownedEffects().includes(e.id)) {
    const refund = { common: 80, rare: 150, epic: 300 }[rarity];
    addBank(refund);
    return { effect: e, rarity, duplicate: refund };
  }
  grantEffect(e.id);
  return { effect: e, rarity };
}

// ======================= 每日挑戰 =======================
export const DAILY_RULES = [
  { id: 'turbo', name: '極速模式', desc: '一開始就跑得飛快' },
  { id: 'magnet', name: '磁鐵狂歡', desc: '整場自帶磁鐵，但撿不到其他道具' },
  { id: 'lowgrav', name: '月球重力', desc: '重力變小，跳得又高又遠' },
  { id: 'coins2', name: '雙倍金幣日', desc: '金幣全部算兩倍，但障礙更多' },
  { id: 'nopower', name: '赤手空拳', desc: '沒有任何道具和加速帶' },
];
export const DAILY_TARGET = 1200;
export const DAILY_CH_REWARD = { coins: 300, keys: 1 };

export function dailyChallenge() {
  const date = today();
  const rnd = seeded(`challenge-${date}`);
  const scene = THEME_ORDER[Math.floor(rnd() * THEME_ORDER.length)];
  const rule = DAILY_RULES[Math.floor(rnd() * DAILY_RULES.length)];
  let st = store.get('dch', null);
  if (!st || st.date !== date) {
    st = { date, best: 0, bestDist: 0, done: false };
    store.set('dch', st);
  }
  return { date, scene, rule, seed: `daily-${date}`, state: st };
}

// 記錄成績；第一次跑到目標距離時給獎勵
export function recordDaily(score, dist) {
  const d = dailyChallenge();
  const st = d.state;
  st.best = Math.max(st.best, score);
  st.bestDist = Math.max(st.bestDist, Math.floor(dist));
  let reward = null;
  if (!st.done && dist >= DAILY_TARGET) {
    st.done = true;
    reward = DAILY_CH_REWARD;
    give(reward);
  }
  store.set('dch', st);
  return reward;
}

export { seeded };

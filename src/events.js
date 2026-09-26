// 回流玩法：每日登入獎勵、每日字母收集、季節活動、滑板種類
import { store, OUTFITS, grantEventOutfit, eventOutfits } from './progress.js';
import { boards, setBoards, today, seeded } from './meta.js';

const addBank = (n) => store.set('bank', store.get('bank', 0) + n);

export function rewardText(r) {
  const parts = [];
  if (r.coins) parts.push(`${r.coins} 金幣`);
  if (r.boards) parts.push(`滑板 ×${r.boards}`);
  if (r.outfit) parts.push(`限定服裝「${OUTFITS.find((o) => o.id === r.outfit)?.name}」`);
  return parts.join(' ＋ ');
}

function give(r) {
  if (r.coins) addBank(r.coins);
  if (r.boards) setBoards(boards() + r.boards);
  if (r.outfit) grantEventOutfit(r.outfit);
}

// ---------- 每日登入：連續七天，第七天大獎 ----------
export const LOGIN_REWARDS = [
  { coins: 100 },
  { coins: 150 },
  { boards: 1 },
  { coins: 250 },
  { coins: 300, boards: 1 },
  { coins: 400 },
  { coins: 1000, boards: 2 },
];

export function loginStatus() {
  const d = today();
  const s = store.get('login', { last: null, streak: 0 });
  if (s.last === d) return { claimed: true, day: (s.streak - 1) % 7, streak: s.streak };
  const yesterday = today(new Date(Date.now() - 864e5));
  const streak = s.last === yesterday ? s.streak + 1 : 1;
  return { claimed: false, day: (streak - 1) % 7, streak };
}

export function claimLogin() {
  const st = loginStatus();
  if (st.claimed) return null;
  const r = LOGIN_REWARDS[st.day];
  give(r);
  store.set('login', { last: today(), streak: st.streak });
  return r;
}

// ---------- 每日字母：依序收集跑道上的字母拼出單字 ----------
const WORDS = ['COINS', 'TRAIN', 'JUMP', 'SPEED', 'MAGIC', 'PANDA', 'CANDY', 'ROCKET', 'DRAGON', 'METRO', 'LUCKY', 'BOOST', 'STORM', 'GIANT', 'HOVER', 'TURBO', 'RUNNER', 'SUBWAY'];
export const WORD_REWARD = { coins: 400, boards: 1 };

export function wordHunt() {
  const d = today();
  let w = store.get('word', null);
  if (!w || w.date !== d) {
    const rnd = seeded(`word-${d}`);
    w = { date: d, word: WORDS[Math.floor(rnd() * WORDS.length)], got: 0, done: false };
    store.set('word', w);
  }
  return w;
}

export const nextLetter = () => {
  const w = wordHunt();
  return w.done ? null : w.word[w.got];
};

// 回傳 { letter, completed }
export function collectLetter() {
  const w = wordHunt();
  if (w.done) return null;
  const letter = w.word[w.got];
  w.got++;
  const completed = w.got >= w.word.length;
  if (completed) {
    w.done = true;
    give(WORD_REWARD);
  }
  store.set('word', w);
  return { letter, completed };
}

// ---------- 季節活動：依日期自動輪替，收集活動代幣換限定服裝 ----------
export const EVENTS = [
  { id: 'newyear', name: '新春紅包祭', token: '紅包', glyph: '福', color: '#e8262d', ink: '#ffd23f', from: [1, 1], to: [2, 28], outfit: 'lucky' },
  { id: 'spring', name: '春日花祭', token: '花瓣', glyph: '花', color: '#ff7ab8', ink: '#ffffff', from: [3, 1], to: [5, 31], outfit: 'fairy' },
  { id: 'summer', name: '夏日海灘祭', token: '貝殼', glyph: '貝', color: '#1fb6cf', ink: '#ffffff', from: [6, 1], to: [9, 9], outfit: 'lifeguard' },
  { id: 'moon', name: '中秋賞月祭', token: '月餅', glyph: '月', color: '#c47f2c', ink: '#fff3c4', from: [9, 10], to: [10, 10], outfit: 'bunny' },
  { id: 'halloween', name: '萬聖節糖果祭', token: '糖果', glyph: '糖', color: '#ff7a00', ink: '#2a1a3a', from: [10, 11], to: [11, 10], outfit: 'pumpkin' },
  { id: 'autumn', name: '秋收落葉祭', token: '楓葉', glyph: '楓', color: '#d9531e', ink: '#ffffff', from: [11, 11], to: [11, 30], outfit: 'maple' },
  { id: 'xmas', name: '聖誕禮物祭', token: '禮物', glyph: '禮', color: '#2e9e4f', ink: '#ffffff', from: [12, 1], to: [12, 31], outfit: 'santa' },
];

export const EVENT_TIERS = [
  { n: 30, reward: { coins: 300 } },
  { n: 80, reward: { boards: 2 } },
  { n: 150, reward: { outfit: true } },
  { n: 250, reward: { coins: 1500 } },
];

const md = (m, d) => m * 100 + d;

export function currentEvent(date = new Date()) {
  const k = md(date.getMonth() + 1, date.getDate());
  return EVENTS.find((e) => k >= md(...e.from) && k <= md(...e.to)) || null;
}

export function eventDaysLeft(ev, date = new Date()) {
  const end = new Date(date.getFullYear(), ev.to[0] - 1, ev.to[1], 23, 59, 59);
  return Math.max(0, Math.ceil((end - date) / 864e5));
}

const eventKey = (ev) => `event-${ev.id}-${new Date().getFullYear()}`;

export function eventState(ev) {
  return store.get(eventKey(ev), { tokens: 0, claimed: [] });
}

export function tierReward(ev, tier) {
  return tier.reward.outfit ? { outfit: ev.outfit } : tier.reward;
}

// 加代幣，回傳這次新達成的獎勵
export function addTokens(ev, n) {
  const s = eventState(ev);
  s.tokens += n;
  const got = [];
  EVENT_TIERS.forEach((t, i) => {
    if (s.claimed.includes(i) || s.tokens < t.n) return;
    s.claimed.push(i);
    const r = tierReward(ev, t);
    // 服裝已經有了（去年拿過）就改送金幣
    const give2 = r.outfit && eventOutfits().includes(r.outfit) ? { coins: 800 } : r;
    give(give2);
    got.push(give2);
  });
  store.set(eventKey(ev), s);
  return got;
}

// ---------- 滑板種類：每種都能擋一次撞擊，另外各有能力 ----------
export const BOARD_TYPES = [
  { id: 'classic', name: '經典滑板', perk: '沒有特殊能力，最穩', price: 0, deck: '#ff3d7f', stripe: '#ffd23f', glow: [0.5, 2.6, 4] },
  { id: 'bouncer', name: '彈跳板', perk: '滑板期間跳得更高', price: 1200, deck: '#2ecc71', stripe: '#ffffff', glow: [0.6, 3.4, 1.2] },
  { id: 'rocket', name: '火箭板', perk: '一踩上去先衝刺 3 秒', price: 1600, deck: '#ff6a1c', stripe: '#2b2b2b', glow: [4, 1.6, 0.4] },
  { id: 'magnet', name: '磁力板', perk: '滑板期間自動吸金幣', price: 2000, deck: '#e0245e', stripe: '#c9d1d9', glow: [3.6, 0.6, 1.4] },
  { id: 'double', name: '二段跳板', perk: '滑板期間可以在空中再跳一次', price: 2600, deck: '#9b5cff', stripe: '#3dfcff', glow: [1.6, 1, 4] },
];

export function ownedBoards() {
  const list = store.get('boardTypes', ['classic']);
  return list.includes('classic') ? list : ['classic', ...list];
}

export function activeBoard() {
  const id = store.get('boardType', 'classic');
  return BOARD_TYPES.find((b) => b.id === id && ownedBoards().includes(id)) || BOARD_TYPES[0];
}

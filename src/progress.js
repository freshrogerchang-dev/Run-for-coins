// 道具、關卡、服裝的定義，以及存檔（localStorage）
import { THEME_ORDER, THEMES } from './themes.js';

export const store = {
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

// ---------- 道具 ----------
// base / per：持續秒數 = base + 升級等級 × per
export const POWERUPS = {
  dash: { name: '衝刺鞋', desc: '極速衝刺，撞開柵欄、撞到列車會直接翻上車頂', color: '#ffb000', glyph: '衝', base: 4, per: 1, weight: 2 },
  jetpack: { name: '噴射背包', desc: '飛到空中收集一整排金幣', color: '#ff4d3d', glyph: '飛', base: 6, per: 1.2, weight: 1.4 },
  magnet: { name: '金幣磁鐵', desc: '自動吸過附近三條軌道的金幣', color: '#e0245e', glyph: '磁', base: 8, per: 2, weight: 3 },
  double: { name: '雙倍金幣', desc: '每枚金幣算兩枚', color: '#9b5cff', glyph: '×2', base: 10, per: 2, weight: 2.4 },
  spring: { name: '彈跳鞋', desc: '跳得超高，可以直接跳上車頂', color: '#2ecc71', glyph: '跳', base: 9, per: 2, weight: 2 },
  shield: { name: '防護罩', desc: '抵擋一次撞擊', color: '#2fa8ff', glyph: '盾', base: 20, per: 5, weight: 1.6 },
  mystery: { name: '神秘寶箱', desc: '隨機得到金幣、分數或其他道具', color: '#ff7ac8', glyph: '？', weight: 1.4 },
};
export const UPGRADABLE = ['dash', 'jetpack', 'magnet', 'double', 'spring', 'shield'];
export const UPGRADE_COST = [120, 300, 600, 1200, 2400];
export const MAX_LEVEL = UPGRADE_COST.length;

export function upgrades() {
  return store.get('upgrades', {});
}
export function powerDuration(kind) {
  const p = POWERUPS[kind];
  return p.base + (upgrades()[kind] || 0) * p.per;
}

// ---------- 服裝 ----------
// hat：cap / conductor / none / helmet / beanie / visor / cowboy / headband / pith / fire / bubble / crown
export const OUTFITS = [
  {
    id: 'street', name: '街頭小子',
    colors: { top: '#ff5a1f', trim: '#d9430f', pants: '#2d4f8c', hat: '#1768d9', hair: '#2b1b12', pack: '#ffd23f', shoe: '#f7f7f5', sole: '#e5293b' },
    hat: 'cap', extras: ['phones'],
  },
  {
    id: 'conductor', name: '列車長',
    colors: { top: '#1f2d5a', trim: '#d4a017', pants: '#1f2d5a', hat: '#1f2d5a', hair: '#2b1b12', pack: '#6b4a32', shoe: '#1a1a1a', sole: '#333333' },
    hat: 'conductor', extras: [],
  },
  {
    id: 'surfer', name: '衝浪少年',
    colors: { top: '#20c9b0', trim: '#ffffff', pants: '#ff9f1c', hat: '#e8c170', hair: '#e8c170', pack: '#ff6b6b', shoe: '#ffe066', sole: '#1b1b1b' },
    hat: 'none', extras: ['sunglasses'],
  },
  {
    id: 'miner', name: '隧道工程師',
    colors: { top: '#ff8c00', trim: '#e0e0e0', pants: '#3a3a3a', hat: '#ffd000', hair: '#3b2a1e', pack: '#555a60', shoe: '#5a3b1e', sole: '#222222' },
    hat: 'helmet', extras: ['headlamp'],
  },
  {
    id: 'snow', name: '雪地探險家',
    colors: { top: '#d7263d', trim: '#ffffff', pants: '#2b2d42', hat: '#f4f4f4', hair: '#6b3e26', pack: '#8d99ae', shoe: '#4a4e69', sole: '#222222' },
    hat: 'beanie', extras: ['scarf'],
  },
  {
    id: 'cyber', name: '賽博浪人',
    colors: { top: '#6a3fc1', trim: '#ff3db5', pants: '#1a1a2e', hat: '#3dfcff', hair: '#ff5ec4', pack: '#1a1a2e', shoe: '#1a1a2e', sole: '#3dfcff' },
    hat: 'visor', extras: ['phones'],
  },
  {
    id: 'cowboy', name: '西部牛仔',
    colors: { top: '#b5651d', trim: '#f5e6c8', pants: '#3b5b8c', hat: '#7a4a24', hair: '#8a5a2b', pack: '#7a4a24', shoe: '#5a3a1a', sole: '#2a1a0a' },
    hat: 'cowboy', extras: ['scarf'],
  },
  {
    id: 'ninja', name: '櫻花忍者',
    colors: { top: '#1b1b2f', trim: '#d23a1f', pants: '#1b1b2f', hat: '#d23a1f', hair: '#111111', pack: '#d23a1f', shoe: '#1b1b2f', sole: '#111111' },
    hat: 'headband', extras: ['scarf'],
  },
  {
    id: 'explorer', name: '叢林探險家',
    colors: { top: '#c2b280', trim: '#8a7a50', pants: '#6b5b3a', hat: '#e8dcb5', hair: '#4a2f1a', pack: '#4a6b2a', shoe: '#5a3b1e', sole: '#2a1a0a' },
    hat: 'pith', extras: [],
  },
  {
    id: 'fire', name: '熔岩消防員',
    colors: { top: '#d9a400', trim: '#c9d1d9', pants: '#d9a400', hat: '#c62828', hair: '#2b1b12', pack: '#c62828', shoe: '#1a1a1a', sole: '#333333' },
    hat: 'fire', extras: [],
  },
  {
    id: 'astro', name: '太空人',
    colors: { top: '#f0f0f0', trim: '#ff6a2a', pants: '#e6e6e6', hat: '#bfe6ff', hair: '#2b1b12', pack: '#cfd6de', shoe: '#9aa3b5', sole: '#555555' },
    hat: 'bubble', extras: [],
  },
  {
    id: 'golden', name: '黃金傳奇',
    colors: { top: '#ffc21a', trim: '#fff1b0', pants: '#b8860b', hat: '#ffd700', hair: '#2b1b12', pack: '#ffd700', shoe: '#ffd700', sole: '#b8860b' },
    hat: 'crown', extras: ['sunglasses'], metallic: true,
  },
];

// ---------- 關卡：每個場景一關，破關解鎖一套服裝 ----------
export const STAGES = THEME_ORDER.map((scene, i) => ({
  no: i + 1,
  scene,
  name: THEMES[scene].name,
  distance: 700 + i * 150,
  coins: 50 + i * 20,
  outfit: OUTFITS[i + 1].id,
}));

export function clearedStages() {
  return store.get('stages', []);
}

export function isCleared(scene) {
  return clearedStages().includes(scene);
}

export function markCleared(scene) {
  const list = clearedStages();
  if (!list.includes(scene)) {
    list.push(scene);
    store.set('stages', list);
  }
  return list;
}

export function outfitUnlocked(id) {
  if (id === 'street') return true;
  if (id === 'golden') return clearedStages().length >= STAGES.length;
  const st = STAGES.find((s) => s.outfit === id);
  return st ? isCleared(st.scene) : false;
}

export function outfitRequirement(id) {
  if (id === 'golden') return '完成全部 10 關';
  const st = STAGES.find((s) => s.outfit === id);
  return st ? `完成第 ${st.no} 關「${st.name}」` : '';
}

// 分數倍率：每破一關 +1
export function scoreMultiplier() {
  return 1 + clearedStages().length;
}

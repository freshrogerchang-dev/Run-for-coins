// 長期進度：統計、每日任務、成就、角色、滑板
import { store, clearedStages, OUTFITS, STAGES, outfitUnlocked } from './progress.js';
import { ownedPets, PETS } from './pets.js';

// ---------- 角色 ----------
export const CHARACTERS = [
  { id: 'kid', name: '阿橘', desc: '活力滿滿的街頭跑者', perk: '衝刺鞋和加速帶多 1 秒', price: 0 },
  { id: 'girl', name: '小美', desc: '綁著馬尾的敏捷少女', perk: '金幣磁鐵多 3 秒', price: 800 },
  { id: 'robot', name: '機器人波特', desc: '發光面罩和天線的鐵皮跑者', perk: '續跑費用減半', price: 1800 },
  { id: 'fox', name: '狐狸阿福', desc: '有蓬鬆大尾巴的狐狸', perk: '跳得更高', price: 3000 },
];

export function ownedCharacters() {
  const list = store.get('chars', ['kid']);
  return list.includes('kid') ? list : ['kid', ...list];
}

// ---------- 滑板 ----------
export const BOARD_PRICE = 200;
export const BOARD_TIME = 30;
export const boards = () => store.get('boards', 2);
export const setBoards = (n) => store.set('boards', Math.max(0, n));

// ---------- 每日任務 ----------
const POOL = [
  { key: 'jumps', text: (n) => `跳躍 ${n} 次`, ns: [20, 35, 50] },
  { key: 'slides', text: (n) => `滑鏟 ${n} 次`, ns: [15, 25, 40] },
  { key: 'coins', text: (n) => `收集 ${n} 枚金幣`, ns: [150, 300, 500] },
  { key: 'distance', text: (n) => `累積跑 ${n} 公尺`, ns: [1500, 3000, 5000] },
  { key: 'run', text: (n) => `單場跑到 ${n} 公尺`, ns: [600, 1000, 1500], single: true },
  { key: 'powerups', text: (n) => `撿 ${n} 個道具`, ns: [3, 6, 10] },
  { key: 'smashes', text: (n) => `用衝刺鞋撞飛 ${n} 個柵欄`, ns: [2, 4, 6] },
  { key: 'roof', text: (n) => `在車頂上跑 ${n} 公尺`, ns: [100, 250, 400] },
  { key: 'lanes', text: (n) => `換軌道 ${n} 次`, ns: [60, 120, 200] },
  { key: 'nearMiss', text: (n) => `和障礙擦身而過 ${n} 次`, ns: [15, 30, 50] },
  { key: 'hoverboards', text: (n) => `使用滑板 ${n} 次`, ns: [1, 2, 3] },
  { key: 'escapes', text: (n) => `甩掉站務員 ${n} 次`, ns: [1, 2, 3] },
  { key: 'storm', text: (n) => `在暴風雨中跑 ${n} 秒`, ns: [20, 40, 60] },
  { key: 'combo', text: (n) => `單場金幣連擊達到 ${n}`, ns: [15, 25, 40], single: true },
  { key: 'boosts', text: (n) => `踩加速帶 ${n} 次`, ns: [3, 6, 10] },
  { key: 'giantSmash', text: (n) => `用巨人蘑菇撞飛 ${n} 個障礙`, ns: [3, 6, 10] },
];
// 「單場最佳」類型：記錄最大值而不是累加
const SINGLE = { run: 'bestRun', combo: 'maxCombo' };
export const DAILY_BONUS = 500;

export function today(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 用日期當種子，同一天每次打開都是同樣三個任務
export function seeded(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeDaily(date) {
  const rnd = seeded(date);
  const pool = [...POOL];
  const missions = [];
  while (missions.length < 3) {
    const t = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    const tier = Math.floor(rnd() * t.ns.length);
    missions.push({ key: t.key, n: t.ns[tier], progress: 0, done: false, reward: 80 + tier * 70 });
  }
  return { date, missions, bonus: false };
}

export function missionText(m) {
  return POOL.find((p) => p.key === m.key).text(m.n);
}

// ---------- 成就 ----------
const STAGE_OUTFITS = OUTFITS.filter((o) => !o.event).length;
export const ACHIEVEMENTS = [
  { id: 'first', name: '第一步', desc: '完成第一場奔跑', stat: 'runs', goal: 1, reward: 50 },
  { id: 'jump500', name: '跳跳虎', desc: '累積跳躍 500 次', stat: 'jumps', goal: 500, reward: 300 },
  { id: 'slide300', name: '滑壘高手', desc: '累積滑鏟 300 次', stat: 'slides', goal: 300, reward: 300 },
  { id: 'coin1k', name: '小富翁', desc: '累積收集 1,000 枚金幣', stat: 'coins', goal: 1000, reward: 200 },
  { id: 'coin10k', name: '大富翁', desc: '累積收集 10,000 枚金幣', stat: 'coins', goal: 10000, reward: 1000 },
  { id: 'dist10k', name: '長跑選手', desc: '累積跑 10 公里', stat: 'distance', goal: 10000, reward: 300 },
  { id: 'marathon', name: '馬拉松', desc: '累積跑 42.195 公里', stat: 'distance', goal: 42195, reward: 1500 },
  { id: 'run2k', name: '一口氣兩公里', desc: '單場跑到 2,000 公尺', stat: 'bestRun', goal: 2000, reward: 500 },
  { id: 'run5k', name: '停不下來', desc: '單場跑到 5,000 公尺', stat: 'bestRun', goal: 5000, reward: 1500 },
  { id: 'power50', name: '道具收藏家', desc: '累積撿 50 個道具', stat: 'powerups', goal: 50, reward: 400 },
  { id: 'smash30', name: '破壞王', desc: '用衝刺鞋撞飛 30 個柵欄', stat: 'smashes', goal: 30, reward: 400 },
  { id: 'roof2k', name: '屋頂漫步', desc: '在車頂上累積跑 2,000 公尺', stat: 'roof', goal: 2000, reward: 400 },
  { id: 'board10', name: '滑板少年', desc: '累積使用滑板 10 次', stat: 'hoverboards', goal: 10, reward: 400 },
  { id: 'near200', name: '千鈞一髮', desc: '和障礙擦身而過 200 次', stat: 'nearMiss', goal: 200, reward: 300 },
  { id: 'escape20', name: '逃脫專家', desc: '甩掉站務員 20 次', stat: 'escapes', goal: 20, reward: 300 },
  { id: 'storm120', name: '風雨無阻', desc: '在暴風雨中累積跑 120 秒', stat: 'storm', goal: 120, reward: 300 },
  { id: 'daily15', name: '每日好習慣', desc: '完成 15 個每日任務', stat: 'missionsDone', goal: 15, reward: 800 },
  { id: 'stages10', name: '全關制霸', desc: `完成全部 ${STAGES.length} 關`, stat: 'stages', goal: STAGES.length, reward: 3000 },
  { id: 'outfits', name: '衣櫃滿滿', desc: `解鎖全部 ${STAGE_OUTFITS} 套關卡服裝`, stat: 'outfits', goal: STAGE_OUTFITS, reward: 1500 },
  { id: 'chars', name: '好朋友們', desc: '擁有全部 4 個角色', stat: 'chars', goal: 4, reward: 1000 },
  { id: 'combo100', name: '連擊大師', desc: '單場金幣連擊達到 100', stat: 'maxCombo', goal: 100, reward: 800 },
  { id: 'boost50', name: '加速狂', desc: '累積踩 50 次加速帶', stat: 'boosts', goal: 50, reward: 400 },
  { id: 'giant50', name: '巨人來了', desc: '用巨人蘑菇撞飛 50 個障礙', stat: 'giantSmash', goal: 50, reward: 500 },
  { id: 'pets', name: '寵物之家', desc: `擁有全部 ${PETS.length} 隻寵物`, stat: 'pets', goal: PETS.length, reward: 1000 },
];

export class Meta {
  constructor() {
    this.stats = store.get('stats', {});
    this.ach = store.get('ach', []);
    this.daily = store.get('daily', null);
    this.refreshDaily();
    this.notes = [];
    this.lastSave = 0;
  }

  refreshDaily() {
    const d = today();
    if (!this.daily || this.daily.date !== d) {
      this.daily = makeDaily(d);
      store.set('daily', this.daily);
    }
  }

  stat(key) {
    if (key === 'stages') return clearedStages().length;
    if (key === 'outfits') return OUTFITS.filter((o) => !o.event && outfitUnlocked(o.id)).length;
    if (key === 'chars') return ownedCharacters().length;
    if (key === 'pets') return ownedPets().length;
    return this.stats[key] || 0;
  }

  addBank(n) {
    store.set('bank', store.get('bank', 0) + n);
  }

  // 記錄一個事件；run 用於「單場」類型的任務
  track(key, n = 1, runValue) {
    if (SINGLE[key]) {
      this.stats[SINGLE[key]] = Math.max(this.stats[SINGLE[key]] || 0, runValue);
    } else {
      this.stats[key] = (this.stats[key] || 0) + n;
    }
    this.refreshDaily();
    for (const m of this.daily.missions) {
      if (m.done || m.key !== key) continue;
      m.progress = SINGLE[key] ? Math.max(m.progress, runValue) : m.progress + n;
      if (m.progress >= m.n) {
        m.progress = m.n;
        m.done = true;
        this.stats.missionsDone = (this.stats.missionsDone || 0) + 1;
        this.addBank(m.reward);
        this.notes.push({ type: 'mission', text: `任務完成：${missionText(m)}　+${m.reward} 金幣` });
      }
    }
    if (!this.daily.bonus && this.daily.missions.every((m) => m.done)) {
      this.daily.bonus = true;
      this.addBank(DAILY_BONUS);
      setBoards(boards() + 1);
      this.notes.push({ type: 'daily', text: `今日任務全部完成！+${DAILY_BONUS} 金幣、滑板 +1` });
    }
    this.checkAchievements();
    this.save();
  }

  checkAchievements() {
    for (const a of ACHIEVEMENTS) {
      if (this.ach.includes(a.id)) continue;
      if (this.stat(a.stat) >= a.goal) {
        this.ach.push(a.id);
        this.addBank(a.reward);
        this.notes.push({ type: 'ach', text: `成就解鎖：${a.name}　+${a.reward} 金幣` });
      }
    }
  }

  save(force = false) {
    const now = performance.now();
    if (!force && now - this.lastSave < 3000) {
      this.pending = true;
      return;
    }
    this.lastSave = now;
    this.pending = false;
    store.set('stats', this.stats);
    store.set('ach', this.ach);
    store.set('daily', this.daily);
  }

  flush() {
    this.save(true);
  }

  takeNotes() {
    const n = this.notes;
    this.notes = [];
    return n;
  }
}

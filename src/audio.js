// 以 Web Audio 即時合成的音效、環境音與配樂（不需要任何音檔）
//
// 訊號路徑：
//   sfx ──┬──────────────► master ─► 喇叭
//         └► reverb(send) ─┘
//   music / ambience / wind / rumble ─► master

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rand = (a, b) => a + Math.random() * (b - a);
const pickNote = () => [1320, 1760, 1980, 2640][(Math.random() * 4) | 0];

// 每個場景的配樂風格
const MUSIC = {
  city: {
    bpm: 128,
    prog: [[45, 57, 60, 64], [41, 53, 57, 60], [48, 55, 60, 64], [43, 55, 59, 62]],
    bass: 'triangle', bassVol: 0.5, lead: 'square', leadVol: 0.07, leadCut: 0,
    kick: true, snare: false, hat: true,
  },
  seaside: {
    bpm: 112,
    prog: [[48, 60, 64, 67], [43, 55, 59, 62], [45, 57, 60, 64], [41, 53, 57, 60]],
    bass: 'sine', bassVol: 0.6, lead: 'triangle', leadVol: 0.13, leadCut: 0,
    kick: false, snare: false, hat: true, shaker: true,
  },
  tunnel: {
    bpm: 138,
    prog: [[38, 50, 53, 57], [34, 46, 50, 53], [36, 48, 52, 55], [33, 45, 48, 52]],
    bass: 'sawtooth', bassVol: 0.3, lead: 'square', leadVol: 0.05, leadCut: 1800,
    kick: true, snare: true, hat: true, sparse: true,
  },
  snow: {
    bpm: 104,
    prog: [[41, 53, 57, 60], [36, 48, 52, 55], [38, 50, 53, 57], [34, 46, 50, 53]],
    bass: 'sine', bassVol: 0.55, lead: 'sine', leadVol: 0.12, leadCut: 0,
    kick: false, snare: false, hat: false, bell: true,
  },
  neon: {
    bpm: 118,
    prog: [[45, 57, 60, 64], [41, 53, 57, 60], [48, 52, 55, 60], [43, 55, 59, 62]],
    bass: 'sawtooth', bassVol: 0.32, lead: 'sawtooth', leadVol: 0.05, leadCut: 2400,
    kick: true, snare: true, hat: true, octaveBass: true,
  },
  // 西部風：小調、撥弦感
  desert: {
    bpm: 96,
    prog: [[40, 52, 55, 59], [38, 50, 53, 57], [36, 48, 52, 55], [35, 47, 50, 54]],
    bass: 'sine', bassVol: 0.55, lead: 'sawtooth', leadVol: 0.06, leadCut: 1400,
    kick: true, snare: false, hat: false, shaker: true, sparse: true,
  },
  // 日本陰旋法（都節音階）
  sakura: {
    bpm: 92,
    prog: [[45, 57, 58, 62], [45, 57, 60, 64], [41, 57, 58, 62], [40, 52, 57, 59]],
    bass: 'sine', bassVol: 0.45, lead: 'triangle', leadVol: 0.14, leadCut: 0,
    kick: false, snare: false, hat: false, sparse: true, bell: true,
  },
  // 馬林巴風
  jungle: {
    bpm: 114,
    prog: [[43, 55, 59, 62], [40, 52, 55, 59], [36, 48, 55, 60], [38, 50, 54, 57]],
    bass: 'sine', bassVol: 0.5, lead: 'sine', leadVol: 0.16, leadCut: 0,
    kick: true, snare: false, hat: false, shaker: true,
  },
  volcano: {
    bpm: 146,
    prog: [[40, 52, 55, 59], [36, 48, 52, 55], [38, 50, 53, 57], [35, 47, 50, 54]],
    bass: 'sawtooth', bassVol: 0.36, lead: 'square', leadVol: 0.05, leadCut: 1600,
    kick: true, snare: true, hat: true, octaveBass: true,
  },
  underwater: {
    bpm: 90,
    prog: [[41, 53, 57, 60], [38, 50, 53, 57], [43, 55, 58, 62], [36, 48, 52, 55]],
    bass: 'sine', bassVol: 0.5, lead: 'sine', leadVol: 0.12, leadCut: 0,
    kick: false, snare: false, hat: false, sparse: true, bell: true,
  },
  candy: {
    bpm: 132,
    prog: [[48, 60, 64, 67], [45, 57, 60, 64], [41, 53, 57, 60], [43, 55, 59, 62]],
    bass: 'triangle', bassVol: 0.45, lead: 'square', leadVol: 0.06, leadCut: 4000,
    kick: true, snare: false, hat: true, shaker: true, bell: true,
  },
  dino: {
    bpm: 108,
    prog: [[38, 50, 53, 57], [41, 53, 57, 60], [36, 48, 52, 55], [43, 55, 58, 62]],
    bass: 'sawtooth', bassVol: 0.3, lead: 'triangle', leadVol: 0.12, leadCut: 0,
    kick: true, snare: true, hat: false, sparse: true,
  },
  halloween: {
    bpm: 116,
    prog: [[45, 57, 60, 63], [44, 56, 59, 62], [41, 53, 56, 60], [40, 52, 55, 59]],
    bass: 'square', bassVol: 0.25, lead: 'triangle', leadVol: 0.1, leadCut: 0,
    kick: true, snare: false, hat: true, sparse: true,
  },
  skycity: {
    bpm: 112,
    prog: [[48, 60, 64, 67], [53, 60, 65, 69], [50, 57, 62, 65], [43, 55, 59, 62]],
    bass: 'sine', bassVol: 0.5, lead: 'triangle', leadVol: 0.13, leadCut: 0,
    kick: false, snare: false, hat: true, bell: true,
  },
  bamboo: {
    bpm: 98,
    prog: [[43, 55, 57, 62], [45, 57, 60, 64], [40, 52, 55, 59], [38, 50, 55, 57]],
    bass: 'sine', bassVol: 0.45, lead: 'triangle', leadVol: 0.14, leadCut: 0,
    kick: false, snare: false, hat: false, sparse: true, shaker: true,
  },
  // 日系城市流行：明亮的七和弦、鐘琴
  japan: {
    bpm: 126,
    prog: [[41, 57, 60, 64], [43, 55, 59, 62], [40, 55, 59, 64], [45, 57, 60, 64]],
    bass: 'triangle', bassVol: 0.5, lead: 'triangle', leadVol: 0.12, leadCut: 0,
    kick: true, snare: true, hat: true, bell: true,
  },
  // 南國海港：輕快、沙鈴
  taiwan: {
    bpm: 116,
    prog: [[43, 55, 59, 62], [48, 55, 60, 64], [45, 57, 60, 64], [50, 57, 62, 66]],
    bass: 'sine', bassVol: 0.55, lead: 'triangle', leadVol: 0.13, leadCut: 0,
    kick: true, snare: false, hat: true, shaker: true,
  },
  space: {
    bpm: 122,
    prog: [[45, 57, 64, 69], [41, 57, 60, 65], [43, 55, 62, 67], [40, 52, 59, 64]],
    bass: 'sine', bassVol: 0.5, lead: 'sawtooth', leadVol: 0.045, leadCut: 2000,
    kick: true, snare: false, hat: true, bell: true,
  },
};

export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicEnabled = true;
    this.coinStreak = 0;
    this.lastCoin = 0;
    this.musicOn = false;
    this.theme = 'city';
    this.style = MUSIC.city;
    this.beds = {};
    this.nextEvent = 0;
  }

  // ---------- 初始化 ----------
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(ctx.destination);

      this.sfxBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this.impulse(2.6, 2.2);
      this.reverbSend = ctx.createGain();
      this.reverbSend.gain.value = 0.08;
      this.sfxBus.connect(this.reverbSend).connect(this.reverb).connect(this.master);

      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = this.musicEnabled ? 0.2 : 0;
      this.musicGain.connect(this.master);
      this.musicGain.connect(this.reverbSend);

      this.ambGain = ctx.createGain();
      this.ambGain.gain.value = 0.9;
      this.ambGain.connect(this.master);

      this.noiseBuf = this.makeNoise(3);
      this.buildWind();
      this.buildRumble();
      this.setTheme(this.theme, true);
      this.startTicker();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  makeNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  impulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  loopNoise() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.start(0, Math.random() * 2);
    return src;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  setMusicEnabled(on) {
    this.musicEnabled = on;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(on ? 0.2 : 0, this.ctx.currentTime, 0.1);
  }

  // ---------- 基本發聲 ----------
  tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0, dest, cut = 0, attack = 0.01 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (cut) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cut;
      node = o.connect(f);
    }
    node.connect(g).connect(dest || this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  burst(dur, { vol = 0.3, freq = 1200, q = 0.8, type = 'bandpass', delay = 0, dest, sweep = 0, attack = 0.004 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest || this.sfxBus);
    src.start(t, Math.random() * 2, dur + 0.05);
  }

  // ---------- 動作音效 ----------
  // combo：連擊數，音高沿大調音階往上爬（最多兩個八度）
  coin(combo = 1) {
    if (!this.ctx) return;
    const SCALE = [0, 2, 4, 5, 7, 9, 11];
    const i = Math.min(Math.max(0, combo - 1), 14);
    const semi = SCALE[i % 7] + 12 * Math.floor(i / 7);
    const base = 880 * Math.pow(2, semi / 12);
    this.tone(base, 0.08, { type: 'square', vol: 0.07 });
    this.tone(base * 1.5, 0.22, { type: 'triangle', vol: 0.12, delay: 0.05 });
    if (combo > 0 && combo % 15 === 0) this.sparkle(0.12);
  }

  // 迎面車輛警示：兩聲短嗶
  warn() {
    this.tone(1175, 0.09, { type: 'square', vol: 0.07 });
    this.tone(1175, 0.09, { type: 'square', vol: 0.07, delay: 0.14 });
  }

  token() {
    this.tone(1319, 0.1, { type: 'triangle', vol: 0.12 });
    this.tone(1976, 0.22, { type: 'triangle', vol: 0.1, delay: 0.06 });
    this.burst(0.2, { vol: 0.05, freq: 5000, q: 2, delay: 0.04 });
  }

  letter() {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.16, { type: 'triangle', vol: 0.1, delay: i * 0.05 }));
  }

  nearMiss() {
    this.tone(1568, 0.12, { type: 'sine', vol: 0.08, slide: 600 });
  }

  // 撞擊的低頻重擊（打擊感）
  thud() {
    this.tone(90, 0.28, { type: 'sine', vol: 0.4, slide: -50 });
    this.burst(0.14, { vol: 0.2, freq: 300, q: 0.7, type: 'lowpass' });
  }

  tutorialStep() {
    this.tone(1047, 0.12, { type: 'triangle', vol: 0.14 });
    this.tone(1568, 0.25, { type: 'triangle', vol: 0.12, delay: 0.08 });
  }

  sparkle(delay = 0) {
    [2093, 2637, 3136, 4186].forEach((f, i) => this.tone(f, 0.18, { type: 'sine', vol: 0.06, delay: delay + i * 0.04 }));
  }

  jump() {
    this.tone(320, 0.22, { type: 'triangle', vol: 0.18, slide: 380 });
    this.burst(0.18, { vol: 0.06, freq: 1800, q: 0.7, sweep: 1500 });
  }

  slide(surface = 'gravel') {
    const f = { gravel: 900, snow: 700, wet: 2200, metal: 3000 }[surface] || 900;
    this.burst(0.38, { vol: 0.28, freq: f, q: 0.6, sweep: -f * 0.5 });
    if (surface === 'wet') this.burst(0.25, { vol: 0.12, freq: 4200, q: 3, delay: 0.05 });
  }

  lane() {
    this.burst(0.14, { vol: 0.12, freq: 1600, q: 1.1, sweep: 1400 });
  }

  // 腳步聲，依地面材質
  step(surface = 'gravel') {
    if (!this.ctx) return;
    switch (surface) {
      case 'metal':
        this.tone(rand(700, 900), 0.06, { type: 'triangle', vol: 0.05 });
        this.burst(0.04, { vol: 0.08, freq: 3500, q: 1.5, type: 'bandpass' });
        this.tone(80, 0.07, { type: 'sine', vol: 0.12, slide: -30 });
        break;
      case 'snow':
        this.burst(0.13, { vol: 0.13, freq: rand(900, 1300), q: 0.6, type: 'lowpass', attack: 0.02 });
        break;
      case 'sand':
        this.burst(0.1, { vol: 0.12, freq: rand(1500, 2100), q: 0.5, type: 'lowpass', attack: 0.015 });
        break;
      case 'grass':
        this.burst(0.09, { vol: 0.1, freq: rand(2500, 3500), q: 0.7, attack: 0.01 });
        this.tone(85, 0.05, { vol: 0.06, slide: -35 });
        break;
      case 'wood':
        this.tone(rand(180, 240), 0.08, { type: 'triangle', vol: 0.1, slide: -60 });
        this.burst(0.05, { vol: 0.06, freq: 1400, q: 1.2 });
        break;
      case 'wet':
        this.burst(0.07, { vol: 0.07, freq: rand(3000, 4000), q: 2.5 });
        this.tone(90, 0.05, { vol: 0.08, slide: -40 });
        break;
      default:
        this.burst(0.06, { vol: 0.1, freq: rand(1800, 2600), q: 0.9 });
        this.tone(90, 0.05, { vol: 0.08, slide: -40 });
    }
  }

  land(surface = 'gravel') {
    if (surface === 'metal') {
      this.tone(160, 0.25, { type: 'sine', vol: 0.3, slide: -90 });
      this.tone(620, 0.35, { type: 'triangle', vol: 0.06 });
      this.burst(0.12, { vol: 0.15, freq: 2600, q: 2 });
    } else {
      this.tone(120, 0.14, { type: 'sine', vol: 0.25, slide: -60 });
      this.burst(0.12, { vol: 0.12, freq: surface === 'snow' ? 800 : 1500, q: 0.7 });
    }
  }

  bump() {
    this.tone(180, 0.18, { type: 'square', vol: 0.12, slide: -90 });
    this.burst(0.15, { vol: 0.3, freq: 500 });
  }

  crash() {
    this.burst(0.9, { vol: 0.6, freq: 300, q: 0.4, type: 'lowpass' });
    this.tone(220, 0.6, { type: 'sawtooth', vol: 0.15, slide: -170 });
    this.tone(55, 0.5, { type: 'sine', vol: 0.5, slide: -25 });
  }

  // 擦身而過的風聲
  whoosh() {
    this.burst(0.4, { vol: 0.2, freq: 500, q: 1.2, sweep: 2200, attack: 0.08 });
  }

  horn() {
    if (!this.ctx) return;
    for (const f of [311, 392, 466]) {
      this.tone(f * 0.998, 1.3, { type: 'sawtooth', vol: 0.045, cut: 1600, attack: 0.05 });
      this.tone(f * 1.003, 1.3, { type: 'sawtooth', vol: 0.03, cut: 1600, attack: 0.05 });
    }
  }

  // 迎面而來的交通工具或動物的提示聲
  vehicleCall(kind) {
    if (!this.ctx) return;
    switch (kind) {
      case 'bus':
        for (let i = 0; i < 2; i++) this.tone(466, 0.22, { type: 'square', vol: 0.05, delay: i * 0.3, cut: 2000 });
        break;
      case 'plow':
        this.tone(185, 1.2, { type: 'sawtooth', vol: 0.08, cut: 900, attack: 0.05 });
        this.tone(233, 1.2, { type: 'sawtooth', vol: 0.05, cut: 900, attack: 0.05 });
        break;
      case 'hoverbus':
        this.tone(300, 0.8, { type: 'sawtooth', vol: 0.05, slide: 600, cut: 2500 });
        this.tone(900, 0.5, { type: 'sine', vol: 0.05, slide: -300, delay: 0.3 });
        break;
      case 'camels':
        for (let i = 0; i < 2; i++) this.tone(150, 0.45, { type: 'sawtooth', vol: 0.08, slide: -60, delay: i * 0.5, cut: 700 });
        break;
      case 'floats':
        for (let i = 0; i < 3; i++) this.tone(90, 0.3, { vol: 0.35, slide: -40, delay: i * 0.22 });
        this.tone(1320, 0.8, { type: 'triangle', vol: 0.05, delay: 0.1, attack: 0.05 });
        break;
      case 'elephants':
        this.tone(520, 0.9, { type: 'sawtooth', vol: 0.08, slide: 380, cut: 3000, attack: 0.04 });
        this.tone(530, 0.9, { type: 'square', vol: 0.03, slide: 360, cut: 2000, attack: 0.04 });
        break;
      case 'tortoises':
        this.burst(1.4, { vol: 0.4, freq: 200, q: 0.8, type: 'lowpass', attack: 0.1 });
        this.tone(70, 1.2, { type: 'sawtooth', vol: 0.1, slide: -20, cut: 400, attack: 0.1 });
        break;
      case 'rovers':
        [1760, 1320, 1760, 2093].forEach((f, i) => this.tone(f, 0.1, { type: 'square', vol: 0.03, delay: i * 0.12 }));
        break;
      case 'subs':
        // 聲納 ping
        this.tone(1400, 1.4, { vol: 0.07, dest: this.sfxBus });
        this.tone(1400, 1.0, { vol: 0.03, delay: 0.6, dest: this.sfxBus });
        break;
      case 'icecream':
        [76, 79, 84, 79, 81, 77].forEach((m, i) => this.tone(mtof(m), 0.16, { type: 'triangle', vol: 0.08, delay: i * 0.14 }));
        break;
      case 'dinos':
        this.tone(160, 1.3, { type: 'sawtooth', vol: 0.1, slide: -80, cut: 900, attack: 0.08 });
        this.burst(1.2, { vol: 0.25, freq: 350, q: 0.6, type: 'lowpass', attack: 0.08 });
        break;
      case 'pumpkins':
        // 巫婆笑聲
        for (let i = 0; i < 5; i++) this.tone(900 - i * 40, 0.12, { type: 'sawtooth', vol: 0.04, slide: 200, delay: i * 0.13, cut: 3000 });
        break;
      case 'airships':
        this.tone(220, 1.2, { type: 'square', vol: 0.05, cut: 800, attack: 0.1 });
        this.tone(330, 1.2, { type: 'square', vol: 0.03, cut: 800, attack: 0.1 });
        break;
      case 'pandas':
        for (let i = 0; i < 2; i++) this.tone(700, 0.15, { type: 'triangle', vol: 0.06, slide: 300, delay: i * 0.22 });
        break;
      case 'metro':
        // 電車警笛：短促的電子喇叭
        this.tone(698, 0.5, { type: 'square', vol: 0.05, cut: 2400 });
        this.tone(880, 0.5, { type: 'square', vol: 0.04, cut: 2400 });
        break;
      case 'tram':
        // 輕軌的叮叮鈴
        for (let i = 0; i < 2; i++) {
          this.tone(1568, 0.5, { vol: 0.08, delay: i * 0.25 });
          this.tone(2350, 0.4, { vol: 0.03, delay: i * 0.25 });
        }
        break;
      default:
        this.horn();
    }
  }

  clack() {
    this.burst(0.05, { vol: 0.18, freq: 1100, q: 2 });
    this.tone(140, 0.06, { vol: 0.15, slide: -50 });
    this.burst(0.05, { vol: 0.14, freq: 1000, q: 2, delay: 0.11 });
    this.tone(130, 0.06, { vol: 0.12, slide: -50, delay: 0.11 });
  }

  // ---------- 道具音效 ----------
  powerup(kind) {
    const base = { dash: 72, jetpack: 67, magnet: 76, double: 79, spring: 74, shield: 71, mystery: 81 }[kind] || 72;
    [0, 4, 7, 12].forEach((d, i) => this.tone(mtof(base + d), 0.18, { type: 'square', vol: 0.06, delay: i * 0.05, cut: 5000 }));
    this.tone(mtof(base + 24), 0.5, { type: 'sine', vol: 0.08, delay: 0.2 });
    this.burst(0.35, { vol: 0.08, freq: 3000, q: 0.8, sweep: 3000 });
  }

  // 道具快結束時的提醒
  powerWarn() {
    this.tone(mtof(88), 0.06, { type: 'square', vol: 0.03 });
  }

  powerEnd() {
    [79, 74, 67].forEach((m, i) => this.tone(mtof(m), 0.14, { type: 'triangle', vol: 0.07, delay: i * 0.07 }));
  }

  dash() {
    this.burst(0.6, { vol: 0.3, freq: 300, q: 1, sweep: 3500, attack: 0.05 });
    this.tone(110, 0.5, { type: 'sawtooth', vol: 0.08, slide: 220, cut: 1200 });
  }

  smash() {
    this.burst(0.25, { vol: 0.35, freq: 900, q: 0.7 });
    this.tone(260, 0.2, { type: 'square', vol: 0.08, slide: -160, cut: 2000 });
    this.burst(0.12, { vol: 0.15, freq: 4000, q: 2, delay: 0.05 });
  }

  shieldBreak() {
    [2600, 3100, 2200, 3500].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.06, delay: i * 0.03 }));
    this.burst(0.4, { vol: 0.25, freq: 5000, q: 0.8, type: 'highpass' });
  }

  mystery() {
    for (let i = 0; i < 8; i++) this.tone(mtof(72 + ((i * 5) % 12)), 0.06, { type: 'square', vol: 0.05, delay: i * 0.05 });
    this.sparkle(0.42);
  }

  // 噴射背包的持續噴射聲
  setJet(on) {
    if (!this.ctx) return;
    if (!this.jetGain) {
      const src = this.loopNoise();
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      this.jetGain = this.ctx.createGain();
      this.jetGain.gain.value = 0;
      src.connect(f).connect(this.jetGain).connect(this.master);
    }
    this.jetGain.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, on ? 0.1 : 0.4);
  }

  stageClear() {
    const seq = [60, 64, 67, 72, 67, 72, 76, 79, 84];
    seq.forEach((m, i) => this.tone(mtof(m), i === seq.length - 1 ? 1.2 : 0.16, { type: 'square', vol: 0.07, delay: i * 0.09, cut: 4000 }));
    [48, 55, 60].forEach((m) => this.tone(mtof(m), 1.4, { type: 'triangle', vol: 0.12, delay: 0.72 }));
    this.sparkle(0.8);
    this.sparkle(1.0);
  }

  buy() {
    this.tone(mtof(84), 0.08, { type: 'square', vol: 0.06 });
    this.tone(mtof(91), 0.3, { type: 'square', vol: 0.06, delay: 0.08 });
    this.burst(0.2, { vol: 0.1, freq: 6000, q: 2, delay: 0.05 });
  }

  denied() {
    this.tone(160, 0.2, { type: 'square', vol: 0.06, cut: 900 });
  }

  revive() {
    [60, 67, 72, 79].forEach((m, i) => this.tone(mtof(m), 0.25, { type: 'triangle', vol: 0.12, delay: i * 0.08 }));
    this.burst(0.6, { vol: 0.12, freq: 600, q: 0.6, sweep: 4000 });
  }

  // ---------- 新道具 ----------
  slowmo() {
    this.tone(880, 1.0, { type: 'sine', vol: 0.1, slide: -660, attack: 0.05 });
    this.burst(0.9, { vol: 0.12, freq: 3000, q: 1, sweep: -2600, attack: 0.1 });
  }

  coinRain() {
    for (let i = 0; i < 10; i++) this.tone(mtof(84 + ((i * 7) % 12)), 0.12, { type: 'square', vol: 0.04, delay: i * 0.05 });
    this.sparkle(0.5);
  }

  giant() {
    this.tone(60, 1.0, { type: 'sawtooth', vol: 0.15, slide: 120, cut: 800, attack: 0.05 });
    [48, 55, 60, 67].forEach((m, i) => this.tone(mtof(m), 0.25, { type: 'square', vol: 0.06, delay: 0.1 + i * 0.1, cut: 2000 }));
  }

  giantStomp() {
    this.tone(55, 0.5, { vol: 0.5, slide: -25 });
    this.burst(0.5, { vol: 0.4, freq: 180, q: 0.6, type: 'lowpass' });
  }

  boost() {
    this.tone(300, 0.35, { type: 'sawtooth', vol: 0.06, slide: 1200, cut: 4000 });
    this.burst(0.4, { vol: 0.2, freq: 600, q: 1, sweep: 4000 });
  }

  combo(n) {
    const base = 72 + Math.min(12, Math.floor(n / 10) * 2);
    [0, 4, 7, 12].forEach((d, i) => this.tone(mtof(base + d), 0.12, { type: 'square', vol: 0.05, delay: i * 0.05, cut: 5000 }));
  }

  // ---------- 天氣 ----------
  setRain(amount) {
    if (!this.ctx) return;
    if (!this.rainGain) {
      const src = this.loopNoise();
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1200;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 7000;
      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.value = 0;
      src.connect(hp).connect(lp).connect(this.rainGain).connect(this.master);
    }
    this.rainGain.gain.setTargetAtTime(amount * 0.16, this.ctx.currentTime, 0.5);
  }

  thunder(delay = 0.5) {
    this.burst(0.25, { vol: 0.5, freq: 1800, q: 0.4, type: 'lowpass', delay });
    this.burst(3.2, { vol: 0.7, freq: 160, q: 0.5, type: 'lowpass', delay: delay + 0.05, attack: 0.08 });
    this.tone(38, 2.6, { vol: 0.35, slide: -10, delay: delay + 0.1, attack: 0.1 });
  }

  // ---------- 追趕者 ----------
  whistle() {
    for (let i = 0; i < 2; i++) {
      this.tone(2900, 0.22, { type: 'sine', vol: 0.09, delay: i * 0.28, attack: 0.01 });
      this.tone(3050, 0.22, { type: 'sine', vol: 0.06, delay: i * 0.28 });
    }
  }

  bark() {
    for (let i = 0; i < 2; i++) {
      this.tone(420, 0.1, { type: 'sawtooth', vol: 0.09, slide: -180, delay: i * 0.18, cut: 1800 });
      this.burst(0.08, { vol: 0.12, freq: 900, q: 1.5, delay: i * 0.18 });
    }
  }

  // ---------- 滑板 ----------
  boardOn() {
    this.tone(220, 0.5, { type: 'sawtooth', vol: 0.06, slide: 440, cut: 2200 });
    this.burst(0.5, { vol: 0.15, freq: 500, q: 1, sweep: 3000 });
    this.sparkle(0.2);
  }

  boardBreak() {
    this.burst(0.4, { vol: 0.35, freq: 1200, q: 0.7 });
    this.tone(300, 0.4, { type: 'square', vol: 0.08, slide: -240, cut: 2000 });
  }

  // ---------- 任務與成就 ----------
  mission() {
    [76, 79, 84].forEach((m, i) => this.tone(mtof(m), 0.2, { type: 'triangle', vol: 0.12, delay: i * 0.08 }));
  }

  achievement() {
    [72, 76, 79, 84, 88].forEach((m, i) => this.tone(mtof(m), 0.25, { type: 'square', vol: 0.06, delay: i * 0.07, cut: 4000 }));
    this.sparkle(0.35);
  }

  // ---------- 介面與事件音效 ----------
  click() {
    this.tone(1400, 0.04, { type: 'square', vol: 0.05 });
  }

  startChime() {
    [72, 76, 79, 84].forEach((m, i) => this.tone(mtof(m), 0.45, { type: 'triangle', vol: 0.16, delay: i * 0.11 }));
    this.tone(mtof(60), 0.8, { type: 'sine', vol: 0.2, delay: 0.33 });
  }

  milestone() {
    this.tone(mtof(84), 0.2, { type: 'square', vol: 0.06 });
    this.tone(mtof(88), 0.35, { type: 'square', vol: 0.06, delay: 0.1 });
    this.sparkle(0.2);
  }

  themeChange() {
    [67, 71, 74, 79, 83, 86].forEach((m, i) => this.tone(mtof(m), 0.3, { type: 'sine', vol: 0.1, delay: i * 0.06 }));
  }

  gameOver() {
    [67, 63, 60, 55].forEach((m, i) => this.tone(mtof(m), 0.35, { type: 'square', vol: 0.07, delay: 0.2 + i * 0.18, cut: 2400 }));
  }

  record() {
    [60, 64, 67, 72].forEach((m, i) => this.tone(mtof(m), 0.25, { type: 'square', vol: 0.07, delay: 0.25 + i * 0.1 }));
    this.tone(mtof(76), 0.9, { type: 'triangle', vol: 0.15, delay: 0.7 });
    this.sparkle(0.8);
  }

  // ---------- 連續音：速度風聲、列車轟隆聲 ----------
  buildWind() {
    const src = this.loopNoise();
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 300;
    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 800;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    src.connect(hp).connect(this.windFilter).connect(this.windGain).connect(this.master);
  }

  setSpeed(sf, running) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(running ? 0.02 + sf * 0.07 : 0, t, 0.3);
    this.windFilter.frequency.setTargetAtTime(700 + sf * 2200, t, 0.3);
  }

  buildRumble() {
    const src = this.loopNoise();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 160;
    this.rumbleGain = this.ctx.createGain();
    this.rumbleGain.gain.value = 0;
    src.connect(lp).connect(this.rumbleGain).connect(this.master);
  }

  setRumble(p) {
    if (!this.ctx) return;
    this.rumbleGain.gain.setTargetAtTime(p * 0.9, this.ctx.currentTime, 0.15);
  }

  // ---------- 場景氛圍 ----------
  setTheme(id, instant = false) {
    this.theme = id;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const wet = { city: 0.08, seaside: 0.05, tunnel: 0.55, snow: 0.14, neon: 0.2, desert: 0.12, sakura: 0.18, jungle: 0.12, volcano: 0.22, space: 0.35, underwater: 0.6, candy: 0.1, dino: 0.15, halloween: 0.35, skycity: 0.12, bamboo: 0.2, japan: 0.45, taiwan: 0.06 }[id] ?? 0.1;
    this.reverbSend.gain.setTargetAtTime(wet, t, instant ? 0.01 : 0.8);
    this.nextStyle = MUSIC[id] || MUSIC.city;
    if (instant) this.style = this.nextStyle;
    for (const key of Object.keys(MUSIC)) {
      if (key === id && !this.beds[key]) this.beds[key] = this.buildBed(key);
      const bed = this.beds[key];
      if (bed) bed.gain.gain.setTargetAtTime(key === id ? 1 : 0, t, instant ? 0.01 : 0.9);
    }
    this.nextEvent = t + 1;
  }

  // 每個場景的背景環境音（持續播放）
  buildBed(id) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.ambGain);
    const noiseLayer = (type, freq, q, vol) => {
      const src = this.loopNoise();
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(f).connect(g).connect(out);
      return { f, g };
    };
    const lfo = (rate, depth, param) => {
      const o = ctx.createOscillator();
      o.frequency.value = rate;
      const d = ctx.createGain();
      d.gain.value = depth;
      o.connect(d).connect(param);
      o.start();
    };
    switch (id) {
      case 'city':
        noiseLayer('lowpass', 320, 0.5, 0.05);
        break;
      case 'seaside': {
        const waves = noiseLayer('bandpass', 650, 0.4, 0.07);
        lfo(0.13, 0.06, waves.g.gain);
        lfo(0.09, 250, waves.f.frequency);
        noiseLayer('highpass', 5000, 0.5, 0.008);
        break;
      }
      case 'tunnel': {
        noiseLayer('lowpass', 130, 0.7, 0.14);
        const o = ctx.createOscillator();
        o.frequency.value = 47;
        const g = ctx.createGain();
        g.gain.value = 0.03;
        o.connect(g).connect(out);
        o.start();
        break;
      }
      case 'snow': {
        const howl = noiseLayer('bandpass', 650, 4, 0.1);
        lfo(0.07, 280, howl.f.frequency);
        lfo(0.11, 0.05, howl.g.gain);
        break;
      }
      case 'desert': {
        const whistle = noiseLayer('bandpass', 1300, 8, 0.07);
        lfo(0.06, 500, whistle.f.frequency);
        lfo(0.1, 0.05, whistle.g.gain);
        noiseLayer('lowpass', 400, 0.5, 0.03);
        break;
      }
      case 'sakura': {
        const breeze = noiseLayer('bandpass', 900, 0.6, 0.03);
        lfo(0.08, 0.02, breeze.g.gain);
        break;
      }
      case 'jungle': {
        // 蟬鳴：高頻噪音以 30Hz 調幅
        const bugs = noiseLayer('bandpass', 5200, 6, 0.05);
        lfo(31, 0.045, bugs.g.gain);
        lfo(0.2, 600, bugs.f.frequency);
        noiseLayer('lowpass', 500, 0.5, 0.03);
        break;
      }
      case 'volcano': {
        const rumble = noiseLayer('lowpass', 90, 0.8, 0.22);
        lfo(0.15, 0.1, rumble.g.gain);
        noiseLayer('bandpass', 700, 0.8, 0.02);
        break;
      }
      case 'underwater': {
        const deep = noiseLayer('lowpass', 220, 0.8, 0.14);
        lfo(0.1, 0.06, deep.g.gain);
        break;
      }
      case 'candy':
        noiseLayer('bandpass', 1200, 0.6, 0.015);
        break;
      case 'dino': {
        const bugs = noiseLayer('bandpass', 4200, 5, 0.03);
        lfo(18, 0.025, bugs.g.gain);
        noiseLayer('lowpass', 400, 0.5, 0.03);
        break;
      }
      case 'halloween': {
        const wind = noiseLayer('bandpass', 500, 5, 0.07);
        lfo(0.09, 250, wind.f.frequency);
        break;
      }
      case 'skycity': {
        const wind = noiseLayer('bandpass', 900, 0.7, 0.05);
        lfo(0.12, 0.04, wind.g.gain);
        break;
      }
      case 'bamboo': {
        const rustle = noiseLayer('highpass', 3000, 0.5, 0.02);
        lfo(0.2, 0.015, rustle.g.gain);
        break;
      }
      case 'japan': {
        // 地下的低鳴與空調聲
        noiseLayer('lowpass', 160, 0.7, 0.1);
        noiseLayer('bandpass', 2500, 0.8, 0.008);
        break;
      }
      case 'taiwan': {
        // 蟬鳴 + 海風
        const bugs = noiseLayer('bandpass', 4800, 7, 0.035);
        lfo(26, 0.03, bugs.g.gain);
        const sea = noiseLayer('bandpass', 600, 0.4, 0.05);
        lfo(0.12, 0.04, sea.g.gain);
        break;
      }
      case 'space': {
        for (const [f, v] of [[110, 0.025], [164.8, 0.018], [220.5, 0.012]]) {
          const o = ctx.createOscillator();
          o.frequency.value = f;
          const g = ctx.createGain();
          g.gain.value = v;
          o.connect(g).connect(out);
          o.start();
          lfo(0.05 + f / 5000, v * 0.8, g.gain);
        }
        break;
      }
      case 'neon': {
        noiseLayer('lowpass', 260, 0.5, 0.06);
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = 120;
        const hp = ctx.createBiquadFilter();
        hp.type = 'bandpass';
        hp.frequency.value = 2400;
        hp.Q.value = 6;
        const g = ctx.createGain();
        g.gain.value = 0.012;
        o.connect(hp).connect(g).connect(out);
        o.start();
        break;
      }
    }
    return { gain: out };
  }

  // 場景裡的隨機事件聲：鳥、海鷗、滴水、風鈴、遠方喇叭
  ambientEvent() {
    const amb = this.ambGain;
    switch (this.theme) {
      case 'city':
        for (let i = 0; i < 3; i++) {
          const f = rand(2800, 4200);
          this.tone(f, 0.08, { vol: 0.025, slide: rand(-800, 600), delay: i * 0.12, dest: amb });
        }
        return rand(3, 7);
      case 'seaside':
        for (let i = 0; i < 2; i++) {
          const f = rand(1300, 1700);
          this.tone(f, 0.35, { type: 'sawtooth', vol: 0.018, slide: -600, delay: i * 0.4, dest: amb, cut: 3000, attack: 0.04 });
        }
        return rand(4, 9);
      case 'tunnel': {
        const f = rand(1600, 2600);
        this.tone(f, 0.12, { vol: 0.05, slide: -f * 0.4, dest: this.sfxBus });
        return rand(1.2, 3.5);
      }
      case 'snow':
        [88, 91, 95].forEach((m, i) =>
          this.tone(mtof(m + (Math.random() < 0.5 ? 0 : 2)), 1.2, { vol: 0.02, delay: i * rand(0.15, 0.4), dest: amb }),
        );
        return rand(6, 11);
      case 'desert':
        if (Math.random() < 0.6) {
          // 老鷹叫聲
          this.tone(2200, 0.9, { type: 'sine', vol: 0.03, slide: -900, dest: amb, attack: 0.05 });
        } else {
          // 響尾蛇
          for (let i = 0; i < 14; i++) this.burst(0.03, { vol: 0.03, freq: 6500, q: 1.5, type: 'highpass', delay: i * 0.045, dest: amb });
        }
        return rand(5, 10);
      case 'sakura':
        if (Math.random() < 0.45) {
          // 寺院鐘聲
          for (const [f, v] of [[146, 0.08], [293, 0.035], [392, 0.02], [587, 0.012]]) {
            this.tone(f, 4.5, { vol: v, dest: this.sfxBus, attack: 0.005 });
          }
        } else {
          // 樹鶯：長音後接顫音
          this.tone(1300, 0.5, { vol: 0.03, slide: 700, dest: amb, attack: 0.08 });
          for (let i = 0; i < 4; i++) this.tone(2300 - i * 120, 0.09, { vol: 0.025, delay: 0.6 + i * 0.1, dest: amb });
        }
        return rand(6, 11);
      case 'jungle':
        if (Math.random() < 0.5) {
          // 青蛙
          for (let i = 0; i < 3; i++) this.tone(rand(170, 230), 0.08, { type: 'square', vol: 0.02, delay: i * 0.13, dest: amb, cut: 900 });
        } else {
          // 熱帶鳥
          this.tone(900, 0.25, { vol: 0.035, slide: 900, dest: amb });
          this.tone(1800, 0.3, { vol: 0.03, slide: -800, delay: 0.28, dest: amb });
        }
        return rand(2.5, 6);
      case 'volcano':
        if (Math.random() < 0.7) {
          // 熔岩冒泡
          for (let i = 0; i < 3; i++) this.tone(rand(80, 140), 0.15, { vol: 0.12, slide: 120, delay: i * rand(0.1, 0.3), dest: amb });
        } else {
          // 遠方爆發
          this.burst(1.6, { vol: 0.35, freq: 140, q: 0.5, type: 'lowpass', dest: amb, attack: 0.02 });
          this.tone(45, 1.2, { vol: 0.25, slide: -15, dest: amb });
        }
        return rand(2, 5);
      case 'underwater':
        // 氣泡聲、鯨魚歌聲
        if (Math.random() < 0.7) {
          for (let i = 0; i < 4; i++) this.tone(rand(500, 900), 0.08, { vol: 0.04, slide: 400, delay: i * rand(0.06, 0.15), dest: amb });
        } else {
          this.tone(260, 2.2, { type: 'sine', vol: 0.05, slide: 180, dest: this.sfxBus, attack: 0.4 });
        }
        return rand(2, 5);
      case 'candy':
        [84, 88, 91, 96].forEach((m, i) => this.tone(mtof(m), 0.2, { type: 'triangle', vol: 0.03, delay: i * 0.08, dest: amb }));
        return rand(5, 9);
      case 'dino':
        if (Math.random() < 0.5) {
          this.tone(120, 1.4, { type: 'sawtooth', vol: 0.05, slide: -50, cut: 700, dest: amb, attack: 0.2 });
          this.burst(1.2, { vol: 0.08, freq: 300, q: 0.7, type: 'lowpass', dest: amb, attack: 0.2 });
        } else {
          this.tone(1800, 0.4, { type: 'sawtooth', vol: 0.02, slide: -700, cut: 3000, dest: amb });
        }
        return rand(4, 9);
      case 'halloween':
        if (Math.random() < 0.5) {
          // 貓頭鷹
          this.tone(420, 0.3, { vol: 0.05, slide: -40, dest: amb, attack: 0.05 });
          this.tone(400, 0.5, { vol: 0.05, slide: -60, delay: 0.4, dest: amb, attack: 0.05 });
        } else {
          // 幽靈嗚嗚聲
          this.tone(600, 2, { type: 'sine', vol: 0.03, slide: -250, dest: this.sfxBus, attack: 0.5 });
        }
        return rand(5, 9);
      case 'skycity':
        [79, 83, 86].forEach((m, i) => this.tone(mtof(m), 1.5, { vol: 0.02, delay: i * 0.2, dest: amb }));
        return rand(6, 10);
      case 'bamboo':
        // 竹子互相敲擊
        for (let i = 0; i < 3; i++) this.tone(rand(700, 1100), 0.08, { type: 'triangle', vol: 0.05, delay: i * rand(0.1, 0.25), dest: amb });
        return rand(3, 7);
      case 'japan':
        if (Math.random() < 0.5) {
          // 發車旋律
          [76, 79, 84, 83, 79, 81, 84].forEach((m, i) => this.tone(mtof(m), 0.28, { type: 'triangle', vol: 0.04, delay: i * 0.16, dest: this.sfxBus }));
        } else {
          // 車門關閉的叮咚聲
          this.tone(mtof(81), 0.6, { vol: 0.06, dest: this.sfxBus });
          this.tone(mtof(77), 0.9, { vol: 0.06, delay: 0.35, dest: this.sfxBus });
        }
        return rand(6, 11);
      case 'taiwan':
        if (Math.random() < 0.25) {
          // 垃圾車的《給愛麗絲》
          [76, 75, 76, 75, 76, 71, 74, 72, 69].forEach((m, i) => this.tone(mtof(m), 0.2, { type: 'square', vol: 0.02, delay: i * 0.2, dest: amb, cut: 2200 }));
        } else if (Math.random() < 0.5) {
          // 海鷗
          this.tone(1500, 0.35, { type: 'sawtooth', vol: 0.016, slide: -600, dest: amb, cut: 3000, attack: 0.04 });
        } else {
          // 遠方機車聲
          this.tone(95, 1.6, { type: 'sawtooth', vol: 0.03, slide: 60, dest: amb, cut: 500, attack: 0.3 });
        }
        return rand(4, 8);
      case 'space': {
        // 通訊嗶嗶聲
        const n = 2 + ((Math.random() * 4) | 0);
        for (let i = 0; i < n; i++) this.tone(pickNote(), 0.07, { type: 'square', vol: 0.02, delay: i * 0.09, dest: amb });
        return rand(3, 7);
      }
      case 'neon':
        if (Math.random() < 0.5) {
          this.tone(rand(380, 460), 0.5, { type: 'square', vol: 0.012, dest: amb, cut: 1200 });
        } else {
          this.tone(700, 1.6, { type: 'sine', vol: 0.012, slide: 300, dest: amb });
        }
        return rand(5, 10);
    }
    return 5;
  }

  // ---------- 配樂 ----------
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.step16 = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
  }

  stopMusic() {
    this.musicOn = false;
  }

  startTicker() {
    const tick = () => {
      const ctx = this.ctx;
      if (ctx.state === 'running') {
        if (this.musicOn) this.scheduleMusic();
        if (ctx.currentTime > this.nextEvent) this.nextEvent = ctx.currentTime + this.ambientEvent();
      }
      setTimeout(tick, 60);
    };
    tick();
  }

  scheduleMusic() {
    const ctx = this.ctx;
    while (this.nextTime < ctx.currentTime + 0.25) {
      if (this.step16 % 16 === 0 && this.nextStyle) this.style = this.nextStyle;
      const st = this.style;
      const spb = 60 / st.bpm / 2;
      const bar = Math.floor(this.step16 / 16) % 4;
      const chord = st.prog[bar];
      const s = this.step16 % 16;
      const delay = Math.max(0, this.nextTime - ctx.currentTime);
      const dest = this.musicGain;

      // 貝斯
      if (s % 4 === 0 || s % 4 === 3 || (st.octaveBass && s % 2 === 0)) {
        const up = st.octaveBass ? (s % 4 === 2 ? 12 : 0) : s % 8 === 3 ? 12 : 0;
        this.tone(mtof(chord[0] - 12 + up), spb * 1.8, {
          type: st.bass,
          vol: st.bassVol,
          delay,
          dest,
          cut: st.bass === 'sawtooth' ? 700 : 0,
        });
      }
      // 琶音 / 主旋律
      const play = !st.sparse || s % 2 === 0;
      if (play) {
        const arp = chord[1 + (s % 3)] + (s % 8 >= 4 ? 12 : 0) + (st.bell ? 12 : 0);
        this.tone(mtof(arp), st.bell ? spb * 5 : spb * 0.9, {
          type: st.lead,
          vol: st.leadVol,
          delay,
          dest,
          cut: st.leadCut,
        });
      }
      // 鼓組
      if (st.kick && (s === 0 || s === 8 || (s === 10 && bar % 2))) {
        this.tone(120, 0.18, { vol: 0.55, slide: -80, delay, dest });
      }
      if (st.snare && (s === 4 || s === 12)) this.drumNoise(delay, 1800, 0.14, 0.3);
      if (st.hat && s % 4 === 2) this.drumNoise(delay, 7000, 0.05, 0.3, 'highpass');
      if (st.shaker && s % 2 === 1) this.drumNoise(delay, 6000, 0.04, 0.12, 'highpass');

      this.nextTime += spb;
      this.step16++;
    }
  }

  drumNoise(delay, freq, dur, vol, type = 'bandpass') {
    this.burst(dur, { vol, freq, q: 0.8, type, delay, dest: this.musicGain, attack: 0.002 });
  }
}

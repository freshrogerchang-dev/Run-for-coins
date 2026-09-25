// 以 Web Audio 即時合成的音效與背景音樂（不需要音檔）
export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.coinStreak = 0;
    this.lastCoin = 0;
    this.musicOn = false;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.22;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0, dest } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 0.3, freq = 1200, q = 0.8, type = 'bandpass' } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  coin() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.coinStreak = now - this.lastCoin < 0.45 ? Math.min(this.coinStreak + 1, 12) : 0;
    this.lastCoin = now;
    const base = 988 * Math.pow(2, (this.coinStreak % 13) / 24);
    this.tone(base, 0.08, { type: 'square', vol: 0.07 });
    this.tone(base * 1.5, 0.22, { type: 'triangle', vol: 0.12, delay: 0.05 });
  }

  jump() {
    this.tone(320, 0.22, { type: 'triangle', vol: 0.18, slide: 380 });
  }

  slide() {
    this.noise(0.3, { vol: 0.25, freq: 900, q: 0.6 });
  }

  lane() {
    this.noise(0.12, { vol: 0.12, freq: 2400, q: 1.2 });
  }

  land() {
    this.tone(120, 0.12, { type: 'sine', vol: 0.2, slide: -60 });
  }

  bump() {
    this.tone(180, 0.18, { type: 'square', vol: 0.12, slide: -90 });
    this.noise(0.15, { vol: 0.3, freq: 500 });
  }

  crash() {
    this.noise(0.8, { vol: 0.6, freq: 300, q: 0.4, type: 'lowpass' });
    this.tone(220, 0.6, { type: 'sawtooth', vol: 0.15, slide: -170 });
  }

  horn() {
    if (!this.ctx) return;
    for (const f of [311, 392]) this.tone(f, 0.9, { type: 'sawtooth', vol: 0.06 });
  }

  // 簡單的循環背景音樂：貝斯 + 琶音，120 BPM
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    const prog = [
      [45, 57, 60, 64],
      [41, 53, 57, 60],
      [48, 55, 60, 64],
      [43, 55, 59, 62],
    ];
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const spb = 60 / 128 / 2;
    const tick = () => {
      if (!this.musicOn) return;
      while (this.nextTime < this.ctx.currentTime + 0.25) {
        const bar = Math.floor(this.step / 16) % 4;
        const chord = prog[bar];
        const s = this.step % 16;
        const delay = this.nextTime - this.ctx.currentTime;
        if (s % 4 === 0 || s % 4 === 3) {
          this.tone(mtof(chord[0] - 12 + (s % 8 === 3 ? 12 : 0)), spb * 1.6, {
            type: 'triangle',
            vol: 0.5,
            delay,
            dest: this.musicGain,
          });
        }
        const arp = chord[1 + (s % 3)] + (s % 8 >= 4 ? 12 : 0);
        this.tone(mtof(arp), spb * 0.9, { type: 'square', vol: 0.07, delay, dest: this.musicGain });
        if (s % 4 === 2) this.hat(delay);
        this.nextTime += spb;
        this.step++;
      }
      this.musicTimer = setTimeout(tick, 60);
    };
    tick();
  }

  hat(delay) {
    const t = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * 0.05);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.value = 0.35;
    src.connect(f).connect(g).connect(this.musicGain);
    src.start(t);
  }

  stopMusic() {
    this.musicOn = false;
    clearTimeout(this.musicTimer);
  }
}

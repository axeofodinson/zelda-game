// A tiny Web Audio synth kit (§7). All sound is synthesized — no files. One
// shared AudioContext, created lazily and resumed on the first user gesture
// (browsers block audio until then). Offline rendering (for tests) doesn't need
// a gesture, so bell params are computed purely and can be rendered headless.
export class Synth {
  constructor() {
    this.ctx = null;
    this.master = null;
    this._noise = null;
    this.enabled = true;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  resume() {
    this.ensure();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  noiseBuffer() {
    if (this._noise) return this._noise;
    const ctx = this.ensure();
    const len = ctx.sampleRate * 1.0;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noise = buf;
    return buf;
  }

  // Filtered noise burst — steam, quench hiss, strike transients.
  noise(dur = 0.2, freq = 3000, q = 1, gain = 0.3) {
    if (!this.enabled) return;
    const ctx = this.resume() || this.ctx;
    const t = this.now;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // Short FM clang — metal-on-metal, blocks.
  clang(freq = 320, dur = 0.18, gain = 0.25) {
    if (!this.enabled) return;
    const ctx = this.resume() || this.ctx;
    const t = this.now;
    const carrier = ctx.createOscillator();
    carrier.type = 'square';
    carrier.frequency.value = freq;
    const mod = ctx.createOscillator();
    mod.type = 'square';
    mod.frequency.value = freq * 2.7;
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(freq * 3, t);
    modGain.gain.exponentialRampToValueAtTime(freq * 0.2, t + dur);
    mod.connect(modGain).connect(carrier.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    carrier.connect(g).connect(this.master);
    carrier.start(t); mod.start(t);
    carrier.stop(t + dur + 0.02); mod.stop(t + dur + 0.02);
  }

  // Sub-thump + noise — the Crucible's step.
  thump(gain = 0.5) {
    if (!this.enabled) return;
    const ctx = this.resume() || this.ctx;
    const t = this.now;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + 0.32);
    this.noise(0.12, 800, 0.7, gain * 0.4);
  }
}

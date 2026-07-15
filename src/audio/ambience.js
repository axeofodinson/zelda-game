import { Synth } from './synth.js';
import { soundBell } from './bell.js';

// The audio director. No music — the bell is the music (§7). A detuned saw pad
// drones under everything and RISES IN PITCH as the arena's total remaining
// enemy heat rises, so the room sounds tense while things are still hot.
export class Audio {
  constructor() {
    this.synth = new Synth();
    this.pad = null;
    this.padGain = null;
    this.padBase = 55; // A1-ish
    this._lastRing = -1;
  }

  start() {
    const ctx = this.synth.ensure();
    this.synth.resume();
    if (this.pad) return;
    // Two detuned saws through a lowpass — a cold drone.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.value = 0.06;
    g.connect(this.synth.master);
    lp.connect(g);
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = this.padBase;
      o.detune.value = det;
      o.connect(lp);
      o.start();
    }
    this.pad = lp;
    this.padGain = g;
  }

  // heatFrac: total remaining enemy heat / initial total (0..1).
  setTension(heatFrac) {
    if (!this.pad) return;
    const f = Math.max(0, Math.min(1, heatFrac));
    const t = this.synth.now;
    // pad rises ~an octave as tension climbs; filter opens.
    this.pad.frequency.setTargetAtTime(500 + f * 900, t, 0.4);
    this.padGain.gain.setTargetAtTime(0.04 + f * 0.05, t, 0.4);
  }

  // Ring Knell at a target's heat (0..1). Throttled so it doesn't machine-gun.
  ring(heat01, force = false) {
    const ctx = this.synth.ensure();
    const now = this.synth.now;
    if (!force && now - this._lastRing < 0.4) return;
    this._lastRing = now;
    soundBell(ctx, this.synth.master, heat01, now, 0.5);
  }

  steam() { this.synth.noise(0.35, 2200, 0.6, 0.12); }
  spark() { this.synth.noise(0.08, 4200, 2, 0.08); }
  clang() { this.synth.clang(300, 0.18, 0.22); }
  thump() { this.synth.thump(0.4); }
  tink() { this.synth.clang(1400, 0.05, 0.1); }
}

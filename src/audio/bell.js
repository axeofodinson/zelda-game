// Knell's bell (§7) — the priority, and the game's audio thesis. A bell is
// inharmonic; that's what makes it a bell. The fundamental maps to the target's
// heat, and the upper partials DAMP as heat drops (a cooling god rings deader),
// so the player hears the kill coming without looking.

// (ratio, gain, decay seconds) — the §7 spectrum + 2 upper inharmonics.
export const PARTIALS = [
  { r: 0.5, g: 0.2, d: 4.0, name: 'hum' },
  { r: 1.0, g: 1.0, d: 3.0, name: 'prime' },
  { r: 1.2, g: 0.6, d: 2.2, name: 'tierce' },
  { r: 1.5, g: 0.4, d: 1.6, name: 'quint' },
  { r: 2.0, g: 0.7, d: 1.4, name: 'nominal' },
  { r: 2.7, g: 0.28, d: 0.7, name: 'upper1' },
  { r: 3.4, g: 0.22, d: 0.55, name: 'upper2' },
];

// Pure: everything needed to sound the bell for a given heat (0..1). No context.
export function bellParams(heat01) {
  const h = Math.max(0, Math.min(1, heat01));
  const fundamental = 180 + (620 - 180) * h; // lerp(180, 620)
  // Damp partials above the prime as heat drops; the two upper inharmonics fade
  // hardest. Decays also shorten when cold — a deader ring.
  const partials = PARTIALS.map((p, i) => {
    let damp = 1;
    if (i >= 2) damp = 0.18 + 0.82 * h; // tierce and up
    if (i >= 5) damp *= 0.25 + 0.75 * h; // the inharmonics fade hardest
    return { freq: fundamental * p.r, gain: p.g * damp, decay: p.d * (0.5 + 0.5 * h) };
  });
  return { fundamental, heat: h, partials };
}

// Schedule the bell on a live (or offline) context at time `when`.
export function soundBell(ctx, destination, heat01, when = ctx.currentTime, level = 0.5) {
  const { partials } = bellParams(heat01);
  const out = ctx.createGain();
  out.gain.value = level;
  out.connect(destination);

  for (const p of partials) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = p.freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(p.gain, 0.0002), when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + p.decay);
    osc.connect(g).connect(out);
    osc.start(when);
    osc.stop(when + p.decay + 0.05);
  }

  // Strike transient: 8ms noise burst through a bandpass at 3.5kHz.
  const len = Math.ceil(ctx.sampleRate * 0.03);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 3500;
  bp.Q.value = 1.5;
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.5 * level, when);
  sg.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
  src.connect(bp).connect(sg).connect(destination);
  src.start(when);
  src.stop(when + 0.05);
}

// Spectral centroid of a bell at a given heat — a single number that captures
// "how bright/high the instrument is". Used by the gate to prove two bells are
// audibly different instruments without listening.
export function bellCentroid(heat01) {
  const { partials } = bellParams(heat01);
  let num = 0, den = 0;
  for (const p of partials) {
    num += p.freq * p.gain;
    den += p.gain;
  }
  return den > 0 ? num / den : 0;
}

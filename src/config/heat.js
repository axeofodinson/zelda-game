// §4 — the heat system. Every number here, none in systems code.
//
// RECONCILIATION (see §12 read): §3.4's per-enemy "cooling X/hit -> N hits"
// cards disagreed with §4's universal slash values (-14/-14/-22). §4 is the
// single source of truth; per-enemy toughness is expressed as a COOL_RESIST
// multiplier applied to cooling dealt to that enemy, so "hits to kill" is
// derived, never hand-authored. COOL_RESIST 1.0 = takes §4 values as written.

// ---- Blade heat (0..100) ----------------------------------------------------
export const BLADE = {
  slash1: { blade: +18, enemy: -14 },
  slash2: { blade: +18, enemy: -14 },
  // PHASE 6 RETUNE: slash3 blade cost 26 -> 20. At 26 a fresh full combo
  // (18+18+26=62) plus any prior heat pushed you across searing (85) mid-way
  // through the uncancelable finisher — the combo punished its own finish.
  // At 20 a full combo tops out at 56, so entering searing is a deliberate
  // second-combo choice. Enemy cooling (-22) is unchanged, so TTK is unchanged.
  slash3: { blade: +20, enemy: -22 },
  plunge: { blade: +34, enemy: -70 },
  wardAbsorb: { blade: +25, enemy: 0 },
  quenchPoolPerSec: -40,
  max: 100,

  searingAt: 85, // >= this: renders --sear, cooling output x0.5, +2 melt/sec
  searingCoolMult: 0.5,
  searingMeltPerSec: 2,

  ventMin: 30, // below this, Vent does nothing (dry tink)
  overheatStaggerMs: 700, // at blade==100
  overheatMelt: 10,
};

// Vent radius — the core risk/reward (§4). DO NOT soften.
export function ventParams(bladeHeat) {
  const t = (bladeHeat - BLADE.ventMin) / (BLADE.max - BLADE.ventMin); // 0..1
  const c = Math.max(0, Math.min(1, t));
  return {
    radius: 2.0 + (5.5 - 2.0) * c,
    damage: 15 + bladeHeat * 0.45,
    staggerMs: 400 + bladeHeat * 6,
  };
}

// ---- Enemy heat -------------------------------------------------------------
export const ENEMY = {
  reheatPerSec: 3, // after 4s without being hit
  reheatDelay: 4, // seconds
  runnelReheatPerSec: 25,
  brittleAt: 25, // < this: speed x0.6, verdigris cracks, plunge = shatter-kill
  brittleSpeedMult: 0.6,
  seizeAt: 0, // seize -> topple -> static climbable geometry
};

// ---- Melt — Tinn's health (0..100). His model is the bar (§3.2). -----------
export const MELT = {
  max: 100,
  cullSlam: +18,
  spruePourPer100ms: +4,
  flashlingSlice: +8,
  crucibleCharge: +30,
  runnelPerSec: +30,
  handprintPerSec: +12,
  searingPerSec: +2,
  verdigrisPerSec: -15,
  quenchPerSec: -8,
  passivePerSec: -1, // only after 3s since last hit
  passiveDelay: 3,

  // §3.2 melt state thresholds -> movement multipliers / visuals
  softAt: 30,
  runningAt: 60,
  failingAt: 85,
  runningSpeedMult: 0.85,
  failingSpeedMult: 0.6,
};

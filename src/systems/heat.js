import { BLADE, MELT } from '../config/heat.js';

// Tinn's two meters. Blade heat is a resource that charges the Vent and gates
// Searing; melt is his health (and his silhouette). No HUD — combat reads these
// off the blade's glow and Tinn's sag (§11).
export class TinnHeat {
  constructor() {
    this.blade = 0;
    this.melt = 0;
    this.timeSinceHit = 99; // seconds since Tinn last took a melt hit
    this.overheatPending = false; // consumed by combat to force a stagger+vent
  }

  get searing() {
    return this.blade >= BLADE.searingAt;
  }

  // Cooling output multiplier — a too-hot blade quenches at half rate.
  get coolMult() {
    return this.searing ? BLADE.searingCoolMult : 1;
  }

  // 0..1, how hot toward searing (drives blade colour lerp iron->molten->sear).
  get bladeGlow() {
    return Math.min(this.blade / BLADE.max, 1);
  }

  addBlade(x) {
    this.blade = Math.min(BLADE.max, Math.max(0, this.blade + x));
    if (this.blade >= BLADE.max) this.overheatPending = true;
  }

  ventReset() {
    this.blade = 0;
  }

  hurt(amount) {
    this.melt = Math.min(MELT.max, this.melt + amount);
    this.timeSinceHit = 0;
  }

  // 0=solid .. 1=melted, for sag/pose/desaturate.
  get meltFactor() {
    return Math.min(this.melt / MELT.max, 1);
  }

  get meltSpeedMult() {
    if (this.melt >= MELT.failingAt) return MELT.failingSpeedMult;
    if (this.melt >= MELT.runningAt) return MELT.runningSpeedMult;
    return 1;
  }

  // env: { quench, verdigris, runnel, handprint } booleans for where Tinn stands
  update(dt, env = {}) {
    this.timeSinceHit += dt;

    // Blade: quench pool cools fast; searing bleeds a little melt.
    if (env.quench) this.addBlade(BLADE.quenchPoolPerSec * dt);
    if (this.searing) this.melt = Math.min(MELT.max, this.melt + BLADE.searingMeltPerSec * dt);

    // Melt environment.
    if (env.runnel) this.hurt(MELT.runnelPerSec * dt);
    else if (env.handprint) this.hurt(MELT.handprintPerSec * dt);
    if (env.verdigris) this.melt = Math.max(0, this.melt + MELT.verdigrisPerSec * dt);
    if (env.quench) this.melt = Math.max(0, this.melt + MELT.quenchPerSec * dt);

    // Passive melt recovery once Tinn hasn't been hit for a beat.
    if (this.timeSinceHit >= MELT.passiveDelay && !env.runnel && !env.handprint) {
      this.melt = Math.max(0, this.melt + MELT.passivePerSec * dt);
    }
  }
}

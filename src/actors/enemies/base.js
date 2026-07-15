import { Group, Vector3, Color } from 'three';
import { ENEMY } from '../../config/heat.js';
import { RGB } from '../../render/palette.js';
import { IMPACT_FLASH_MS } from '../../config/feel.js';

const _w = new Vector3();

// Shared enemy heat/cooling/telegraph/topple. Phase 3 subclasses add geometry
// and AI. "Every enemy telegraphs by getting brighter" (§3.4) — the core's
// emissive is driven here, boosted by `telegraph` during a windup.
export class Enemy {
  constructor({ heat = 80, maxHeat = 80, coolResist = 1, position = [0, 0, 0] } = {}) {
    this.root = new Group();
    this.root.position.set(position[0], position[1], position[2]);
    this.heat = heat;
    this.maxHeat = maxHeat;
    this.coolResist = coolResist;
    this.timeSinceHit = 99;
    this.telegraph = 0; // 0..1 windup brightness boost
    this.flash = 0; // impact-flash timer (s)
    this.dead = false; // reached heat 0
    this.toppleT = 0;
    this.staggerMs = 0;
    this.standSize = { w: 1.2, d: 1.2, h: 0.5 }; // statue footprint (subclass sets)
    this.noStatue = false; // swarm enemies shatter instead of toppling
    this._platform = null;
    this.cores = []; // { mat } emissive materials tracking heat
    this.coolable = []; // { offset:Vector3, r } spheres where cooling lands
    this.armored = []; // { offset:Vector3, r } spheres that clang (Crucible)
    this._molten = new Color().setRGB(...RGB.molten);
    this._verdigris = new Color().setRGB(...RGB.verdigris);
    this._sear = new Color().setRGB(...RGB.sear);
  }

  get position() {
    return this.root.position;
  }
  get brittle() {
    return this.heat <= ENEMY.brittleAt;
  }
  get glow() {
    return Math.max(0, Math.min(this.heat / this.maxHeat, 1));
  }

  registerCore(mat) {
    this.cores.push(mat);
  }

  worldSpheres(list) {
    return list.map((s) => ({
      center: _w.copy(s.offset).applyMatrix4(this.root.matrixWorld).clone(),
      r: s.r,
    }));
  }
  coolSpheres() {
    this.root.updateMatrixWorld();
    return this.worldSpheres(this.coolable);
  }
  armorSpheres() {
    this.root.updateMatrixWorld();
    return this.worldSpheres(this.armored);
  }

  // Apply cooling. Returns { cooled, killed, shatter }. Plunge on a brittle
  // enemy is an instant shatter-kill (§4).
  cool(amount, { plunge = false } = {}) {
    if (this.dead) return { cooled: 0, killed: false, shatter: false };
    this.flash = IMPACT_FLASH_MS / 1000;
    this.timeSinceHit = 0;
    if (plunge && this.brittle) {
      this.heat = 0;
      this._die();
      return { cooled: this.maxHeat, killed: true, shatter: true };
    }
    const before = this.heat;
    this.heat = Math.max(0, this.heat - amount * this.coolResist);
    const killed = this.heat <= ENEMY.seizeAt && before > 0;
    if (killed) this._die();
    return { cooled: before - this.heat, killed, shatter: false };
  }

  _die() {
    this.dead = true;
    this.heat = 0;
    this.toppleT = 0;
    this.onDeath?.();
  }

  // A cooled enemy topples and becomes static, standable geometry (§4).
  get standable() {
    return this.dead && this.toppleT > 0.6;
  }

  _registerStatue(platforms) {
    const p = this.position;
    const hw = this.standSize.w / 2;
    const hd = this.standSize.d / 2;
    this._platform = platforms.add({
      minX: p.x - hw, maxX: p.x + hw,
      minZ: p.z - hd, maxZ: p.z + hd,
      top: this.standSize.h, tag: 'statue',
    });
  }

  // ctx: { dt, tinn, heat, fx, runnelAt, platforms, hurtTinn, playerPos, runnels }
  update(ctx) {
    const dt = ctx.dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
    if (this.staggerMs > 0) this.staggerMs = Math.max(0, this.staggerMs - dt * 1000);

    if (!this.dead) {
      this.timeSinceHit += dt;
      const inRunnel = ctx.runnelAt && ctx.runnelAt(this.position.x, this.position.z);
      if (inRunnel) {
        this.heat = Math.min(this.maxHeat, this.heat + ENEMY.runnelReheatPerSec * dt);
      } else if (this.timeSinceHit >= ENEMY.reheatDelay) {
        this.heat = Math.min(this.maxHeat, this.heat + ENEMY.reheatPerSec * dt);
      }
      if (this.staggerMs <= 0) this.think?.(ctx);
      // Molten drips — hot enemies, always (§6). Fall from a core.
      if (ctx.fx && this.glow > 0.35 && Math.random() < this.glow * 0.12) {
        ctx.fx.pools.drips?.spawn?.({
          x: this.position.x + (Math.random() * 2 - 1) * 0.3,
          y: 0.9 + Math.random() * 0.7,
          z: this.position.z + (Math.random() * 2 - 1) * 0.3,
          vx: 0, vy: -0.5, vz: 0, life: 0.6, size: 0.06,
          color: [1, 0.42, 0.1], alpha: 0.9,
        });
      }
    } else if (!this.noStatue && this.toppleT < 1) {
      this.toppleT = Math.min(1, this.toppleT + dt / 0.7);
      const e = 1 - Math.pow(1 - this.toppleT, 3);
      this.root.rotation.x = e * (Math.PI / 2);
      if (this.toppleT >= 0.6 && !this._platform && ctx.platforms) {
        this._registerStatue(ctx.platforms);
      }
    }

    // Drive core colour/emissive: hot=molten, cold/brittle=verdigris, flash=sear.
    const g = this.glow;
    const col = this.brittle
      ? this._verdigris
      : this._molten.clone().lerp(this._verdigris, 1 - g);
    const emissive = Math.max(g, this.brittle ? 0.25 : 0) + this.telegraph * 0.8;
    for (const mat of this.cores) {
      const u = mat.uniforms;
      if (this.flash > 0) u.uTint.value.copy(this._sear);
      else u.uTint.value.copy(col).multiplyScalar(0.7 + 0.6 * g);
      u.uEmissive.value = this.dead ? 0.0 : Math.min(1.2, emissive + (this.flash > 0 ? 0.6 : 0));
    }
  }
}

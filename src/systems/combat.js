import { Vector3 } from 'three';
import { FRAMES, VENT_OVERCHARGE_BONUS } from '../config/frames.js';
import { BLADE, ventParams } from '../config/heat.js';

const _dir = new Vector3();
const _hit = new Vector3();
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// The moveset state machine (§5). Owns slash combo (+cancels/buffer), the
// charged Vent (radius scales with blade heat — the game, §4), plunge, ward,
// and the overheat failure state. Drives Tinn's rig upper body via `attackPose`
// and moves his root for the spin/lunge. Blade heat + enemy cooling happen here.
export class Combat {
  constructor({ tinn, heat, fx, getEnemies, lockon, feel = {} }) {
    this.tinn = tinn;
    this.heat = heat;
    this.fx = fx;
    this.getEnemies = getEnemies;
    this.lockon = lockon;
    this.feel = feel; // { shake(mag), punch(), hitstop(ms), onKill(enemy) }

    this.state = 'idle';
    this.warding = false;
    this.active = false;
    this.attackPose = null;
    this.t = 0;
    this.step = 0;
    this.frames = null;
    this.moveDur = 0;
    this.hitSet = new Set();
    this._didHit = false;
    this.buffered = false;
    this._lmbDownT = 0;
    this.spinFrom = 0;
    this.ventRadius = 0;
  }

  cancel() {
    this.state = 'idle';
    this.active = false;
    this.attackPose = null;
    this.warding = false;
  }

  facingDir() {
    return _dir.set(Math.sin(this.tinn.root.rotation.y), 0, Math.cos(this.tinn.root.rotation.y));
  }

  // ---- public triggers (also used by the verify hooks) ----------------------
  forceSlash() { if (this.state === 'idle') this._startSlash(0); }
  forceVent() {
    if (this.state === 'idle' && this.heat.blade >= BLADE.ventMin) this._startVent(false);
  }

  update(dt, input, basis, canAct = true) {
    const ms = dt * 1000;

    // Overheat: blade hit 100 -> forced stagger + auto-vent + melt (§4).
    if (this.heat.overheatPending) {
      this.heat.overheatPending = false;
      this._overheat();
    }

    if (!canAct && this.state !== 'idle') {
      // A roll (i-frame dodge) interrupts attacks.
      this.cancel();
    }

    switch (this.state) {
      case 'idle': if (canAct) this._idle(input, basis); break;
      case 'slash': this._slash(ms, input); break;
      case 'ventCharge': this._ventCharge(ms, input); break;
      case 'vent': this._vent(ms); break;
      case 'plunge': this._plunge(ms); break;
      case 'stagger': this._stagger(ms); break;
    }
    this.active = this.state !== 'idle';
  }

  _idle(input, basis) {
    this.attackPose = null;

    // Ward (hold RMB / K) — modal; movement continues (slowed) via warding flag.
    this.warding = (input.rmbDown || input.isDown('k'));

    const now = performance.now();
    if (input.pressed.has('lmb')) this._lmbDownT = now;

    let slashNow = input.wasPressed('j');
    if (input.released.has('lmb')) {
      const held = now - this._lmbDownT;
      if (held < 220) slashNow = true; // quick click = slash
    }
    if (this.warding) return;

    // Vent charge from a sustained LMB hold.
    if (input.lmbDown && now - this._lmbDownT >= 220 && this.heat.blade >= 1) {
      this._startVentCharge();
      return;
    }

    if (slashNow) {
      // Plunge: locked + forward + slash (§5).
      if (this.lockon.active && input.move.y > 0.5) this._startPlunge();
      else this._startSlash(0);
    }
  }

  // ---- slash combo ----------------------------------------------------------
  _startSlash(step) {
    this.state = 'slash';
    this.step = step;
    this.t = 0;
    this.hitSet.clear();
    this._didHit = false;
    this.buffered = false;
    this.frames = step === 0 ? FRAMES.slash1 : step === 1 ? FRAMES.slash2 : FRAMES.slash3;
    this.moveDur = this.frames.windup + this.frames.active + this.frames.recovery;
    // Face the target (locked) or camera forward on swing start.
    this._orientToAttack();
  }

  _orientToAttack() {
    if (this.lockon.active && this.lockon.target) {
      _dir.copy(this.lockon.target.position).sub(this.tinn.position).setY(0);
      if (_dir.lengthSq() > 1e-4) this.tinn.root.rotation.y = Math.atan2(_dir.x, _dir.z);
    }
  }

  _slash(ms, input) {
    this.t += ms;
    const f = this.frames;

    if (this.t >= f.windup && this.t <= f.windup + f.active && !this._didHit) {
      this._doMeleeHit(this.step === 2 ? BLADE.slash3 : this.step === 1 ? BLADE.slash2 : BLADE.slash1, 1.15, 0.9);
      this._didHit = true;
    }

    // Buffer a follow-up press any time during the move.
    if (input.wasPressed('j') || input.released.has('lmb')) this.buffered = true;

    const cancelOpen = f.cancelAt != null && this.t >= f.windup + f.active + f.cancelAt;
    if (this.buffered && cancelOpen && this.step < 2) {
      this._startSlash(this.step + 1);
      return;
    }
    if (this.t >= this.moveDur) this.state = 'idle';

    this.attackPose = this._slashPose();
  }

  _doMeleeHit(spec, reach, radius) {
    this.facingDir();
    _hit.copy(this.tinn.position).addScaledVector(_dir, reach);
    _hit.y = 0.9;
    let landed = false;
    for (const e of this.getEnemies()) {
      if (e.dead || this.hitSet.has(e)) continue;
      if (this._overlaps(e.coolSpheres(), _hit, radius)) {
        const amount = -spec.enemy * this.heat.coolMult;
        const res = e.cool(amount, { plunge: false });
        this.hitSet.add(e);
        landed = true;
        this.fx.steamBurst({ x: _hit.x, y: 1.0, z: _hit.z });
        this.feel.hitstop?.(res.killed ? 90 : 60);
        this.feel.shake?.(0.04);
        if (res.killed) this.feel.onKill?.(e);
      } else if (this._overlaps(e.armorSpheres(), _hit, radius)) {
        // armored body: clang, sparks, knockback, no cooling (Crucible teach).
        this.fx.sparks({ x: _hit.x, y: 1.0, z: _hit.z }, 14, _dir);
        this.feel.shake?.(0.05);
        this.hitSet.add(e);
        landed = true;
        this.tinn.knockback?.(_dir.clone().multiplyScalar(-2));
      }
    }
    if (landed) this.heat.addBlade(spec.blade);
  }

  _overlaps(spheres, p, r) {
    for (const s of spheres) {
      const dr = s.r + r;
      if (s.center.distanceToSquared(p) <= dr * dr) return true;
    }
    return false;
  }

  // ---- vent -----------------------------------------------------------------
  _startVentCharge() {
    this.state = 'ventCharge';
    this.t = 0;
    this.attackPose = { shoulderR: [-0.4, 0, -0.9], shoulderL: [-0.4, 0, 0.9], torso: [0.05, 0, 0] };
  }

  _ventCharge(ms, input) {
    this.t += ms;
    // wisps of steam while charging a hot blade
    if (this.heat.searing && Math.random() < 0.3) this.fx.steamBurst({ x: this.tinn.position.x, y: 1.0, z: this.tinn.position.z }, 2);
    if (!input.lmbDown) {
      if (this.heat.blade < BLADE.ventMin) {
        // dry tink — never a silent input (§8). Small blade twitch handled in pose relax.
        this.feel.tink?.();
        this.state = 'idle';
      } else {
        this._startVent(this.t >= FRAMES.vent.fullHold);
      }
    }
  }

  _startVent(overcharge) {
    const p = ventParams(this.heat.blade);
    this.ventRadius = p.radius * (overcharge ? 1 + VENT_OVERCHARGE_BONUS : 1);
    this.state = 'vent';
    this.t = 0;
    this.moveDur = FRAMES.vent.active + FRAMES.vent.recovery;
    this.spinFrom = this.tinn.root.rotation.y;

    // The spin hit: everything within the radius cools + staggers.
    for (const e of this.getEnemies()) {
      if (e.dead) continue;
      const d = e.position.distanceTo(this.tinn.position);
      if (d <= this.ventRadius) {
        const res = e.cool(p.damage * this.heat.coolMult, { plunge: false });
        e.staggerMs = p.staggerMs;
        this.fx.steamBurst({ x: e.position.x, y: 1.0, z: e.position.z }, 12);
        if (res.killed) this.feel.onKill?.(e);
      }
    }
    this.fx.ventRing(this.tinn.position, this.ventRadius);
    this.feel.shake?.(0.22);
    this.feel.punch?.();
    this.feel.hitstop?.(80);
    this.heat.ventReset();
    this.attackPose = { shoulderR: [-0.2, 0, -1.3], shoulderL: [-0.2, 0, 1.3], torso: [0.12, 0, 0] };
  }

  _vent(ms) {
    this.t += ms;
    const spin = clamp(this.t / FRAMES.vent.active, 0, 1);
    this.tinn.root.rotation.y = this.spinFrom + spin * Math.PI * 2;
    if (this.t >= this.moveDur) this.state = 'idle';
  }

  // ---- plunge ---------------------------------------------------------------
  _startPlunge() {
    this.state = 'plunge';
    this.t = 0;
    this._didHit = false;
    this.moveDur = FRAMES.plunge.windup + FRAMES.plunge.active + FRAMES.plunge.recovery;
    this._orientToAttack();
    this.tinn.invuln = true; // i-frames during the rise
  }

  _plunge(ms) {
    this.t += ms;
    const f = FRAMES.plunge;
    // rise then drop (visualised via pose + a small root hop)
    const rise = clamp(this.t / f.windup, 0, 1);
    const drop = clamp((this.t - f.windup) / f.active, 0, 1);
    this.tinn.root.position.y = this.state === 'plunge' ? Math.sin(rise * Math.PI) * 0.6 * (1 - drop) : 0;
    this.tinn.invuln = this.t < f.windup;

    if (this.t >= f.windup && !this._didHit) {
      this._didHit = true;
      this.tinn.root.position.y = 0;
      this.facingDir();
      _hit.copy(this.tinn.position).addScaledVector(_dir, 1.1);
      _hit.y = 0.7;
      let landed = false;
      for (const e of this.getEnemies()) {
        if (e.dead) continue;
        if (this._overlaps(e.coolSpheres(), _hit, 1.4)) {
          const res = e.cool(-BLADE.plunge.enemy * this.heat.coolMult, { plunge: true });
          this.fx.steamBurst({ x: e.position.x, y: 1.0, z: e.position.z }, 16);
          landed = true;
          if (res.killed) this.feel.onKill?.(e);
        }
      }
      this.fx.ashPuff(this.tinn.position, 10);
      this.feel.shake?.(0.18);
      this.feel.hitstop?.(120);
      if (landed) this.heat.addBlade(BLADE.plunge.blade);
    }
    if (this.t >= this.moveDur) {
      this.tinn.root.position.y = 0;
      this.state = 'idle';
    }
    this.attackPose = this._plungePose();
  }

  // ---- overheat / stagger ---------------------------------------------------
  _overheat() {
    const p = ventParams(BLADE.max);
    this.ventRadius = p.radius;
    for (const e of this.getEnemies()) {
      if (e.dead) continue;
      if (e.position.distanceTo(this.tinn.position) <= p.radius) {
        e.cool(p.damage * this.heat.coolMult);
        e.staggerMs = p.staggerMs;
      }
    }
    this.fx.ventRing(this.tinn.position, p.radius);
    this.heat.ventReset();
    this.heat.hurt(BLADE.overheatMelt);
    this.state = 'stagger';
    this.t = 0;
    this.moveDur = BLADE.overheatStaggerMs;
    this.feel.shake?.(0.15);
  }

  _stagger(ms) {
    this.t += ms;
    this.attackPose = { torso: [-0.4, 0, 0.1], head: [-0.3, 0, 0], shoulderR: [0.4, 0, 0], shoulderL: [0.4, 0, 0] };
    if (this.t >= this.moveDur) this.state = 'idle';
  }

  // ---- poses ----------------------------------------------------------------
  _slashPose() {
    const f = this.frames;
    const through = clamp((this.t - f.windup) / f.active, 0, 1);
    const wind = clamp(this.t / f.windup, 0, 1);
    const mirror = this.step % 2 === 0 ? 1 : -1;
    if (this.step === 2) {
      const raise = 1 - through;
      const chop = through;
      return {
        torso: [-0.3 * raise + 0.6 * chop, 0, 0],
        shoulderR: [-2.2 * raise + 2.9 * chop - 2.2, 0, 0],
        shoulderL: [-0.6 * raise + 0.3 * chop, 0, 0],
        head: [0.2 * chop, 0, 0],
      };
    }
    return {
      torso: [0.1, (-0.5 * (1 - through) + 0.5 * through) * mirror, 0],
      shoulderR: [-1.0 + through * 0.5 - 0.4 * wind, mirror * (-0.5 + through * 1.3), -0.5 * mirror],
      shoulderL: [-0.3, -mirror * 0.3, 0],
      head: [0, 0.25 * mirror * (through - 0.5), 0],
    };
  }

  _plungePose() {
    const f = FRAMES.plunge;
    const rise = clamp(this.t / f.windup, 0, 1);
    const drop = clamp((this.t - f.windup) / (f.active + f.recovery), 0, 1);
    return {
      shoulderR: [-2.6 * rise + 3.6 * drop - 0.2, 0, 0],
      shoulderL: [-2.6 * rise + 3.6 * drop - 0.2, 0, 0],
      torso: [-0.25 * rise + 0.5 * drop, 0, 0],
      head: [-0.2 * rise + 0.3 * drop, 0, 0],
    };
  }

  wardPose() {
    return { shoulderR: [-1.6, 0, -0.4], shoulderL: [-1.2, 0, 0.3], torso: [0.05, 0.25, 0] };
  }
}

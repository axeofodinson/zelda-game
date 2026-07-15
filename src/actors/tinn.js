import {
  Group,
  Mesh,
  BoxGeometry,
  CylinderGeometry,
  Vector3,
  MathUtils,
} from 'three';
import { bakeFlat } from '../render/geo.js';
import { makeN64Material } from '../render/n64material.js';
import { makeBlobShadow } from '../render/shadow.js';
import { Rig } from '../anim/rig.js';
import { ANIM } from '../anim/poses.js';
import { FRAMES, MOVE } from '../config/frames.js';
import { RGB } from '../render/palette.js';

const STRIDE_K = 0.45; // stride phase per unit travelled (kills foot sliding)
const _v = new Vector3();
const _dv = new Vector3();
const _steel = RGB.iron.map((x) => x + 0.35); // cold blade steel
const _molten = RGB.molten;
const _sear = RGB.sear;
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// A Quenchling: waist-high, hooded, tin, big cold-iron blade. ~12 boxes/cyls,
// budget 700 tris. His model is his health bar (melt system, Phase 2).
export class Tinn {
  constructor() {
    this.root = new Group();
    this.rig = new Rig();
    this.velocity = new Vector3();
    this.speed = 0;
    this.state = 'idle';
    this.time = 0;
    this.stridePhase = 0;
    this.rollTime = 0;
    this.rollDir = new Vector3(0, 0, 1);
    this.invuln = false;
    this.prevYaw = 0;
    this.turnRate = 0;
    this._lastStep = 0;
    this.combat = null;
    this.keepFacing = false; // true during locked hops (face target, not motion)
    this.platforms = null;
    this.vy = 0;
    this._prevX = 0;
    this._prevZ = 0;

    this._build();
  }

  // Step up onto low standable geometry (statues), fall off edges, be blocked
  // by tall walls. The basin floor is y=0.
  _resolveVertical(dt) {
    const step = 0.8;
    let x = this.root.position.x;
    let z = this.root.position.z;
    if (this.platforms && this.platforms.blockedAt(x, z, this.root.position.y, step)) {
      this.root.position.x = this._prevX;
      this.root.position.z = this._prevZ;
      x = this._prevX;
      z = this._prevZ;
      this.velocity.multiplyScalar(0.2);
    }
    const g = this.platforms ? this.platforms.heightAt(x, z) : 0;
    if (this.root.position.y > g + 0.02) {
      this.vy -= 22 * dt;
      this.root.position.y += this.vy * dt;
      if (this.root.position.y <= g) {
        this.root.position.y = g;
        this.vy = 0;
      }
    } else {
      this.root.position.y = g;
      this.vy = 0;
    }
  }

  setCombat(c) {
    this.combat = c;
  }
  knockback(v) {
    this.velocity.add(v);
  }

  get position() {
    return this.root.position;
  }

  _build() {
    const rig = this.rig;
    const iron = () => makeN64Material();

    const boneOf = (parent, name, pos) => {
      const g = new Group();
      g.position.set(pos[0], pos[1], pos[2]);
      parent.add(g);
      rig.addBone(name, g);
      return g;
    };
    const skin = (bone, geo, base, off, matOverride) => {
      const m = new Mesh(bakeFlat(geo, base), matOverride || iron());
      m.position.set(off[0], off[1], off[2]);
      bone.add(m);
      return m;
    };

    // pelvis
    const pelvis = boneOf(this.root, 'pelvis', [0, 0.52, 0]);
    skin(pelvis, new BoxGeometry(0.3, 0.18, 0.2), 'iron', [0, 0, 0]);

    // torso
    const torso = boneOf(pelvis, 'torso', [0, 0.12, 0]);
    skin(torso, new BoxGeometry(0.34, 0.34, 0.22), 'iron', [0, 0.16, 0]);

    // head + hood
    const head = boneOf(torso, 'head', [0, 0.4, 0]);
    skin(head, new BoxGeometry(0.2, 0.2, 0.2), 'iron', [0, 0.08, 0]);
    // hood: a slightly bigger, darker shell over the head, front-open
    const hoodMat = makeN64Material();
    skin(head, new BoxGeometry(0.28, 0.22, 0.28), 'iron', [0, 0.12, -0.02], hoodMat);
    // two pale glints under the hood
    const glintMat = makeN64Material({ emissive: 0.7, tint: [1, 1, 1] });
    skin(head, new BoxGeometry(0.035, 0.03, 0.02), 'sear', [0.05, 0.06, 0.11], glintMat);
    skin(head, new BoxGeometry(0.035, 0.03, 0.02), 'sear', [-0.05, 0.06, 0.11], glintMat);

    // shoulders / arms / hands
    const shL = boneOf(torso, 'shoulderL', [0.21, 0.28, 0]);
    skin(shL, new BoxGeometry(0.1, 0.28, 0.1), 'iron', [0, -0.14, 0]);
    const shR = boneOf(torso, 'shoulderR', [-0.21, 0.28, 0]);
    skin(shR, new BoxGeometry(0.1, 0.28, 0.1), 'iron', [0, -0.14, 0]);
    const handL = boneOf(shL, 'handL', [0, -0.3, 0]);
    skin(handL, new BoxGeometry(0.09, 0.1, 0.09), 'iron', [0, -0.04, 0]);
    const handR = boneOf(shR, 'handR', [0, -0.3, 0]);
    skin(handR, new BoxGeometry(0.09, 0.1, 0.09), 'iron', [0, -0.04, 0]);

    // The cold-iron blade — nearly his own height. Held in handR, angled so it
    // rests forward-up rather than clipping the ground. Its own material so its
    // heat can recolour it (Phase 2).
    // White base so blade colour is fully driven by uTint from blade heat
    // (steel -> molten -> sear). Default cold steel tint set in _updateBlade.
    this.bladeMat = makeN64Material({ tint: [0.5, 0.53, 0.58] });
    const blade = new Group();
    blade.position.set(0, -0.05, 0.02);
    blade.rotation.x = -1.15; // tilt the down-hang forward toward horizontal
    handR.add(blade);
    this.bladeBone = blade;
    const bladeMesh = new Mesh(bakeFlat(new BoxGeometry(0.06, 0.95, 0.11), [1, 1, 1], { top: 1.1, floor: 0.7 }), this.bladeMat);
    bladeMesh.position.set(0, -0.5, 0);
    blade.add(bladeMesh);
    const guard = new Mesh(bakeFlat(new BoxGeometry(0.2, 0.05, 0.14), [1, 1, 1]), this.bladeMat);
    guard.position.set(0, -0.08, 0);
    blade.add(guard);
    this.blade = bladeMesh;

    // hips / legs / feet
    const hipL = boneOf(pelvis, 'hipL', [0.1, -0.08, 0]);
    skin(hipL, new BoxGeometry(0.12, 0.28, 0.13), 'iron', [0, -0.15, 0]);
    const hipR = boneOf(pelvis, 'hipR', [-0.1, -0.08, 0]);
    skin(hipR, new BoxGeometry(0.12, 0.28, 0.13), 'iron', [0, -0.15, 0]);
    const footL = boneOf(hipL, 'footL', [0, -0.3, 0]);
    skin(footL, new BoxGeometry(0.13, 0.07, 0.2), 'iron', [0, -0.02, 0.04]);
    const footR = boneOf(hipR, 'footR', [0, -0.3, 0]);
    skin(footR, new BoxGeometry(0.13, 0.07, 0.2), 'iron', [0, -0.02, 0.04]);

    // Cloak: a short trailing strip off the back of the torso (procedural sway).
    const cloak = new Group();
    cloak.position.set(0, 0.16, -0.13);
    torso.add(cloak);
    const cloakMat = makeN64Material({ side: 'double' });
    const cloakMesh = new Mesh(bakeFlat(new BoxGeometry(0.32, 0.5, 0.03), 'iron', { top: 0.9, floor: 0.6 }), cloakMat);
    cloakMesh.position.set(0, -0.22, 0);
    cloak.add(cloakMesh);
    this.cloak = cloak;

    // Blob shadow (added to scene, positioned each frame).
    this.shadow = makeBlobShadow(0.55);
  }

  addToScene(scene) {
    scene.add(this.root);
    scene.add(this.shadow);
  }

  // ---- update ---------------------------------------------------------------
  // ctx: { basis, fx, heat, lockon }
  update(dt, input, ctx) {
    this.time += dt;
    this.prevYaw = this.root.rotation.y;
    const { basis, fx, heat, lockon } = ctx;
    if (ctx.platforms) this.platforms = ctx.platforms;
    this._prevX = this.root.position.x;
    this._prevZ = this.root.position.z;

    // Roll (Space) interrupts anything — the i-frame dodge out (§5).
    if (this.state !== 'roll' && input.wasPressed(' ')) {
      this.combat?.cancel();
      this._startRoll(input, basis, fx, lockon);
    }

    const canAct = this.state !== 'roll';
    this.combat?.update(dt, input, basis, canAct);

    if (this.state === 'roll') {
      this._updateRoll(dt, fx);
    } else if (this.combat?.active) {
      // Planted during an attack; combat moves the root (spin/lunge).
      this.velocity.multiplyScalar(0.8);
      this.speed = this.velocity.length();
      this.state = 'attack';
    } else {
      this._updateGround(dt, input, basis, fx, lockon, heat);
    }

    if (this.state !== 'attack') this._resolveVertical(dt);
    this._updateBlade(heat);
    this.turnRate = shortestAngle(this.root.rotation.y - this.prevYaw) / Math.max(dt, 1e-4);
    this._animate(dt, fx, heat);
    this._secondary(dt);
    this._updateMelt(heat, fx);

    this.shadow.position.set(this.root.position.x, 0.02, this.root.position.z);
    const s = (1 - Math.min(this.speed / MOVE.runSpeed, 1) * 0.15) * (1 + (heat?.meltFactor || 0) * 0.2);
    this.shadow.scale.setScalar(s);
  }

  _updateGround(dt, input, basis, fx, lockon, heat) {
    const locked = lockon && lockon.active && lockon.target;
    _v.set(0, 0, 0);
    if (input.move.lengthSq() > 0) {
      _v.addScaledVector(basis.right, input.move.x).addScaledVector(basis.forward, input.move.y);
      _v.y = 0;
      _v.normalize();
    }
    const moving = _v.lengthSq() > 0.001;
    let top = MOVE.runSpeed * (heat?.meltSpeedMult ?? 1);
    if (this.combat?.warding) top *= 0.5;
    const targetSpeed = moving ? top : 0;
    _dv.copy(_v).multiplyScalar(targetSpeed).sub(this.velocity);
    const maxDelta = (moving ? MOVE.accel : MOVE.friction) * dt;
    if (_dv.length() > maxDelta) _dv.setLength(maxDelta);
    this.velocity.add(_dv);
    this.velocity.y = 0;

    this.root.position.addScaledVector(this.velocity, dt);
    this.speed = this.velocity.length();

    if (locked) {
      // Strafe: keep facing the target.
      _v.copy(lockon.target.position).sub(this.root.position).setY(0);
      if (_v.lengthSq() > 1e-4) {
        const yaw = Math.atan2(_v.x, _v.z);
        this.root.rotation.y = dampAngle(this.root.rotation.y, yaw, MOVE.turnLerp * 1.4, dt);
      }
    } else if (this.speed > 0.25) {
      const yaw = Math.atan2(this.velocity.x, this.velocity.z);
      this.root.rotation.y = dampAngle(this.root.rotation.y, yaw, MOVE.turnLerp, dt);
    }
    this.state = this.speed > 0.3 ? 'move' : 'idle';
    this.invuln = false;
  }

  // Cold steel -> molten -> white-hot sear, driven by blade heat.
  _updateBlade(heat) {
    if (!heat) return;
    const g = heat.bladeGlow;
    let c;
    if (heat.searing) c = _sear;
    else if (g < 0.5) c = lerp3(_steel, _molten, g / 0.5);
    else c = lerp3(_molten, _sear, (g - 0.5) / 0.5);
    this.bladeMat.uniforms.uTint.value.setRGB(c[0], c[1], c[2]);
    this.bladeMat.uniforms.uEmissive.value = heat.searing ? 1.0 : g * 0.85;
  }

  _updateMelt(heat, fx) {
    const m = heat?.meltFactor || 0;
    // Geometric sag: squash down and spread as he softens/puddles.
    this.root.scale.set(1 + m * 0.14, 1 - m * 0.28, 1 + m * 0.14);
    // Drip particles once he's Running/Failing.
    if (m > 0.6 && fx && Math.random() < (m - 0.6) * 0.8) {
      const off = Math.random() > 0.5 ? 0.22 : -0.22;
      fx.pools.drips?.spawn?.({
        x: this.root.position.x + off, y: 0.5 + Math.random() * 0.4, z: this.root.position.z + 0.1,
        vx: 0, vy: -0.2, vz: 0, life: 0.7, size: 0.08, color: [_molten[0], _molten[1], _molten[2]],
      });
    }
  }

  _startRoll(input, basis, fx, lockon) {
    this.state = 'roll';
    this.rollTime = 0;
    const locked = lockon && lockon.active && lockon.target;
    _v.set(0, 0, 0);
    if (input.move.lengthSq() > 0) {
      _v.addScaledVector(basis.right, input.move.x).addScaledVector(basis.forward, input.move.y);
      _v.y = 0;
      _v.normalize();
    } else if (locked) {
      // Backhop: away from the target.
      _v.copy(this.root.position).sub(lockon.target.position).setY(0).normalize();
    } else {
      _v.set(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
    }
    this.rollDir.copy(_v);
    // Locked dodges keep facing the target (backhop/sidehop feel); free rolls turn.
    this.keepFacing = !!locked;
    if (!locked) this.root.rotation.y = Math.atan2(_v.x, _v.z);
    if (fx) fx.ashPuff(this.root.position, 10);
  }

  _updateRoll(dt, fx) {
    this.rollTime += dt;
    const dur = FRAMES.roll.total / 1000;
    const t = this.rollTime / dur;
    const spd = MOVE.rollSpeed * (1 - MathUtils.smoothstep(t, 0.15, 1.0));
    this.velocity.copy(this.rollDir).multiplyScalar(spd);
    this.root.position.addScaledVector(this.velocity, dt);
    this.speed = spd;

    const ms = this.rollTime * 1000;
    this.invuln = ms >= FRAMES.roll.iFrom && ms <= FRAMES.roll.iTo;

    if (this.rollTime >= dur) {
      this.state = 'idle';
      this.velocity.multiplyScalar(0.25);
      this.invuln = false;
      if (fx) fx.ashPuff(this.root.position, 8);
    }
  }

  _locoPose(dt, fx) {
    const prev = this.stridePhase;
    this.stridePhase = (this.stridePhase + this.speed * dt * STRIDE_K) % 1;
    if (this.speed > 1.5 && fx) {
      for (const plant of [0.0, 0.5]) {
        if (crossed(prev, this.stridePhase, plant)) {
          const side = plant === 0 ? 0.12 : -0.12;
          _v.set(side, 0, 0).applyAxisAngle(new Vector3(0, 1, 0), this.root.rotation.y);
          fx.ashPuff(_v.add(this.root.position), 4);
        }
      }
    }
    const idlePose = Rig.sample(ANIM.idle, this.time);
    const walkPose = Rig.sample(ANIM.walk, this.stridePhase * ANIM.walk.duration);
    const runPose = Rig.sample(ANIM.run, this.stridePhase * ANIM.run.duration);
    const sN = MathUtils.clamp(this.speed / MOVE.runSpeed, 0, 1);
    const wr = Rig.blend(
      walkPose,
      runPose,
      MathUtils.clamp((this.speed - MOVE.walkSpeed) / (MOVE.runSpeed - MOVE.walkSpeed), 0, 1)
    );
    return Rig.blend(idlePose, wr, MathUtils.smoothstep(sN, 0.05, 0.55));
  }

  _animate(dt, fx, heat) {
    let pose;
    if (this.state === 'attack' && this.combat?.attackPose) {
      pose = this.combat.attackPose; // upper body attack; legs relax to stance
    } else if (this.state === 'roll') {
      pose = Rig.sample(ANIM.roll, this.rollTime);
    } else if (this.combat?.warding) {
      pose = Rig.blend(this._locoPose(dt, fx), this.combat.wardPose(), 0.85);
    } else {
      pose = this._locoPose(dt, fx);
    }

    // §3.2: blend the whole rig toward a slumped pose weighted by melt (pose
    // half; the geometric sag is the other half in _updateMelt).
    const m = heat?.meltFactor || 0;
    if (m > 0.02 && this.state !== 'roll') {
      pose = Rig.blend(pose, SLUMP, m * 0.7);
    }
    this.rig.apply(pose);
  }

  _secondary(dt) {
    // Cloak sway: trails backward with forward speed + a slow wobble.
    const lean = MathUtils.clamp(this.speed / MOVE.runSpeed, 0, 1);
    const wobble = Math.sin(this.time * 6) * 0.06 * (0.3 + lean);
    this.cloak.rotation.x = -0.15 - lean * 0.7 + wobble;
    this.cloak.rotation.z = Math.sin(this.time * 3.3) * 0.05;

    // Hood lag: head counter-rotates against turn rate, then relaxes.
    const lag = MathUtils.clamp(-this.turnRate * 0.04, -0.35, 0.35);
    this.rig.addRotation('head', [0, lag, 0]);
  }
}

// The slumped "melting" pose (§3.2): shoulders drop, torso and head droop.
const SLUMP = {
  torso: [0.35, 0, 0],
  head: [0.45, 0, 0],
  pelvis: [0.12, 0, 0],
  shoulderL: [0.2, 0, 0.55],
  shoulderR: [0.2, 0, -0.55],
  hipL: [0.15, 0, 0],
  hipR: [0.15, 0, 0],
};

// --- small helpers -----------------------------------------------------------
function shortestAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function dampAngle(current, target, rate, dt) {
  const d = shortestAngle(target - current);
  return current + d * (1 - Math.exp(-rate * dt));
}
function crossed(a, b, p) {
  if (b >= a) return a < p && b >= p;
  return a < p || b >= p; // wrapped
}

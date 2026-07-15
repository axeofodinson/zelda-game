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

    this._build();
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
    this.bladeMat = makeN64Material({ tint: [1, 1, 1] });
    const blade = new Group();
    blade.position.set(0, -0.05, 0.02);
    blade.rotation.x = -1.15; // tilt the down-hang forward toward horizontal
    handR.add(blade);
    this.bladeBone = blade;
    // guard + long blade
    const bladeMesh = new Mesh(bakeFlat(new BoxGeometry(0.06, 0.95, 0.11), 'iron', { top: 1.1, floor: 0.7 }), this.bladeMat);
    bladeMesh.position.set(0, -0.5, 0);
    blade.add(bladeMesh);
    const guard = new Mesh(bakeFlat(new BoxGeometry(0.2, 0.05, 0.14), 'iron'), this.bladeMat);
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
  update(dt, input, basis, fx) {
    this.time += dt;
    this.prevYaw = this.root.rotation.y;

    if (this.state === 'roll') this._updateRoll(dt, fx);
    else this._updateGround(dt, input, basis, fx);

    this.turnRate = shortestAngle(this.root.rotation.y - this.prevYaw) / Math.max(dt, 1e-4);
    this._animate(dt, fx);
    this._secondary(dt);

    // shadow under Tinn, flat on the ground
    this.shadow.position.set(this.root.position.x, 0.02, this.root.position.z);
    const s = 1 - Math.min(this.speed / MOVE.runSpeed, 1) * 0.15;
    this.shadow.scale.setScalar(s);
  }

  _updateGround(dt, input, basis, fx) {
    // Roll input (Space) — free dodge.
    if (input.wasPressed(' ') && this.state !== 'roll') {
      this._startRoll(input, basis, fx);
      return;
    }

    _v.set(0, 0, 0);
    if (input.move.lengthSq() > 0) {
      _v.addScaledVector(basis.right, input.move.x).addScaledVector(basis.forward, input.move.y);
      _v.y = 0;
      _v.normalize();
    }
    const moving = _v.lengthSq() > 0.001;
    const targetSpeed = moving ? MOVE.runSpeed : 0;
    _dv.copy(_v).multiplyScalar(targetSpeed).sub(this.velocity);
    const maxDelta = (moving ? MOVE.accel : MOVE.friction) * dt;
    if (_dv.length() > maxDelta) _dv.setLength(maxDelta);
    this.velocity.add(_dv);
    this.velocity.y = 0;

    this.root.position.addScaledVector(this.velocity, dt);
    this.root.position.y = 0;
    this.speed = this.velocity.length();

    if (this.speed > 0.25) {
      const yaw = Math.atan2(this.velocity.x, this.velocity.z);
      this.root.rotation.y = dampAngle(this.root.rotation.y, yaw, MOVE.turnLerp, dt);
    }
    this.state = this.speed > 0.3 ? 'move' : 'idle';
    this.invuln = false;
  }

  _startRoll(input, basis, fx) {
    this.state = 'roll';
    this.rollTime = 0;
    _v.set(0, 0, 0);
    if (input.move.lengthSq() > 0) {
      _v.addScaledVector(basis.right, input.move.x).addScaledVector(basis.forward, input.move.y);
      _v.y = 0;
      _v.normalize();
    } else {
      _v.set(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
    }
    this.rollDir.copy(_v);
    this.root.rotation.y = Math.atan2(_v.x, _v.z);
    if (fx) fx.ashPuff(this.root.position, 10);
  }

  _updateRoll(dt, fx) {
    this.rollTime += dt;
    const dur = FRAMES.roll.total / 1000;
    const t = this.rollTime / dur;
    const spd = MOVE.rollSpeed * (1 - MathUtils.smoothstep(t, 0.15, 1.0));
    this.velocity.copy(this.rollDir).multiplyScalar(spd);
    this.root.position.addScaledVector(this.velocity, dt);
    this.root.position.y = 0;
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

  _animate(dt, fx) {
    let pose;
    if (this.state === 'roll') {
      pose = Rig.sample(ANIM.roll, this.rollTime);
    } else {
      const prev = this.stridePhase;
      this.stridePhase = (this.stridePhase + this.speed * dt * STRIDE_K) % 1;
      // footstep puffs at the two plants of the cycle
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
      pose = Rig.blend(idlePose, wr, MathUtils.smoothstep(sN, 0.05, 0.55));
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

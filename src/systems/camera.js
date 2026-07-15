import { Vector3, Raycaster } from 'three';
import { CAMERA } from '../config/feel.js';

// Spring-damped follow camera (§8). Phase 1 implements free mode + free-look +
// lookahead + geometry collision. Locked (orbit) mode is added in Phase 2.
const _desired = new Vector3();
const _lookTarget = new Vector3();
const _tmp = new Vector3();
const UP = new Vector3(0, 1, 0);

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.yaw = 0;
    this.pitch = 0.32; // slight downward tilt
    this.pos = new Vector3(0, CAMERA.free.height, CAMERA.free.distance);
    this.vel = new Vector3();
    this.lookAt = new Vector3();
    this.sensitivity = 0.0022;
    this.raycaster = new Raycaster();
    this.colliders = [];
    this.shake = 0;
    this.punchT = 0;
    this.shakeClock = 0;
  }

  addShake(m) {
    this.shake = Math.min(this.shake + m, 0.5);
  }
  punch() {
    this.punchT = 1;
  }

  setColliders(objs) {
    this.colliders = objs;
  }

  applyLook(mouse) {
    this.yaw -= mouse.x * this.sensitivity;
    this.pitch -= mouse.y * this.sensitivity;
    this.pitch = Math.max(-0.2, Math.min(1.1, this.pitch));
  }

  // Ground-plane movement basis derived from yaw (camera-relative WASD).
  groundBasis() {
    const forward = new Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    const right = new Vector3(forward.z, 0, -forward.x); // cross(forward, up)
    return { forward, right };
  }

  setOverhead(h) {
    this.overhead = h; // null to clear
  }

  // lockPos: world position of the locked target, or null for free mode.
  update(dt, target, travelDir, lockPos = null) {
    // Debug overhead framing (used by the vent-radius gate).
    if (this.overhead) {
      this.cam.position.set(target.x, target.y + this.overhead, target.z + this.overhead * 0.12);
      this.cam.lookAt(target.x, target.y, target.z);
      return;
    }
    // Ease the mode blend (0 free .. 1 locked) over ~transitionMs.
    const goal = lockPos ? 1 : 0;
    const rate = 1000 / CAMERA.transitionMs;
    this._mode = (this._mode ?? 0) + Math.sign(goal - (this._mode ?? 0)) * Math.min(rate * dt, Math.abs(goal - (this._mode ?? 0)));
    const m = this._mode < 0 ? 0 : this._mode > 1 ? 1 : this._mode;
    const me = m * m * (3 - 2 * m); // smoothstep ~ easeOutCubic-ish

    const f = CAMERA.free;
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const viewDir = new Vector3(Math.sin(this.yaw) * cp, -sp, Math.cos(this.yaw) * cp).normalize();

    // Free desired.
    _lookTarget.copy(target);
    _lookTarget.y += f.height * 0.55;
    if (travelDir && travelDir.lengthSq() > 0.001) {
      _tmp.copy(travelDir).setY(0).normalize().multiplyScalar(f.lookahead);
      _lookTarget.add(_tmp);
    }
    _desired.copy(_lookTarget).addScaledVector(viewDir, -f.distance);
    _desired.y += 0.2;

    // Locked desired: frame midpoint Tinn<->target biased toward target; camera
    // sits behind Tinn along the Tinn->target axis.
    if (lockPos && me > 0.001) {
      const L = CAMERA.locked;
      const mid = _tmp.copy(target).lerp(lockPos, L.targetBias);
      const axis = new Vector3().subVectors(lockPos, target).setY(0);
      if (axis.lengthSq() < 1e-4) axis.set(0, 0, 1);
      axis.normalize();
      // keep the current yaw roughly aligned so free-look resumes smoothly
      this.yaw = Math.atan2(axis.x, axis.z);
      const lookedAt = new Vector3(mid.x, target.y + L.height * 0.6, mid.z);
      const camPos = new Vector3()
        .copy(target)
        .addScaledVector(axis, -L.distance)
        .setY(target.y + L.height);
      _lookTarget.lerp(lookedAt, me);
      _desired.lerp(camPos, me);
    }

    // Damped spring toward desired.
    this.vel.addScaledVector(_tmp.copy(_desired).sub(this.pos), f.stiffness * dt);
    const damp = Math.pow(f.damping, dt * 60);
    this.vel.multiplyScalar(damp);
    this.pos.addScaledVector(this.vel, dt);

    // Collision: sphere-ish cast from look target toward camera; pull in.
    this._collide(_lookTarget);

    this.cam.position.copy(this.pos);
    this.cam.lookAt(_lookTarget);
    this.lookAt.copy(_lookTarget);

    // Directional, decaying shake — smooth (sine layers), not white noise (§8).
    if (this.shake > 0.0005) {
      this.shakeClock += dt;
      const s = this.shake;
      const c = this.shakeClock;
      _tmp.set(
        Math.sin(c * 47) * 0.6 + Math.sin(c * 91) * 0.4,
        Math.sin(c * 53 + 1.7) * 0.6 + Math.sin(c * 83) * 0.4,
        Math.sin(c * 61 + 3.1) * 0.5
      ).multiplyScalar(s);
      this.cam.position.add(_tmp);
      this.shake *= Math.pow(0.0025, dt); // fast decay
    }

    // FOV punch on vent: +CAM_PUNCH.fov, ease out.
    const baseFov = CAMERA.fov;
    if (this.punchT > 0.001) {
      this.punchT = Math.max(0, this.punchT - dt / (CAMERA.transitionMs / 1000));
      const e = this.punchT; // 1..0
      this.cam.fov = baseFov + 4 * e;
      this.cam.updateProjectionMatrix();
    } else if (this.cam.fov !== baseFov) {
      this.cam.fov = baseFov;
      this.cam.updateProjectionMatrix();
    }
  }

  _collide(from) {
    if (!this.colliders.length) return;
    _tmp.copy(this.pos).sub(from);
    const dist = _tmp.length();
    if (dist < 1e-3) return;
    _tmp.divideScalar(dist);
    this.raycaster.set(from, _tmp);
    this.raycaster.far = dist;
    const hits = this.raycaster.intersectObjects(this.colliders, false);
    if (hits.length) {
      const d = Math.max(hits[0].distance - CAMERA.collisionRadius, 0.6);
      this.pos.copy(from).addScaledVector(_tmp, d);
    }
  }
}

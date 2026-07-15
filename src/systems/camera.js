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

  update(dt, target, travelDir) {
    const f = CAMERA.free;
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    // Camera looks in `viewDir`; sits opposite it at `distance`.
    const viewDir = new Vector3(
      Math.sin(this.yaw) * cp,
      -sp,
      Math.cos(this.yaw) * cp
    ).normalize();

    _lookTarget.copy(target);
    _lookTarget.y += f.height * 0.55;
    if (travelDir && travelDir.lengthSq() > 0.001) {
      _tmp.copy(travelDir).setY(0).normalize().multiplyScalar(f.lookahead);
      _lookTarget.add(_tmp);
    }

    _desired.copy(_lookTarget).addScaledVector(viewDir, -f.distance);
    _desired.y += 0.2;

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

import { Quaternion, Euler, Vector3 } from 'three';

// Pose-table animation (§9). No external format: an animation is a list of
// keyframes, each a {t, pose} where pose maps bone-name -> [rx,ry,rz] euler
// offsets applied on top of the bone's rest transform. We interpolate with
// easing. Procedural secondary motion (cloak sway, hood lag) is layered on top
// in the actor's update, not here.

const _qa = new Quaternion();
const _qb = new Quaternion();
const _e = new Euler();
const _va = new Vector3();
const _vb = new Vector3();

export class Rig {
  constructor() {
    this.bones = new Map(); // name -> Object3D
    this.rest = new Map(); // name -> { quat, pos }
  }

  addBone(name, obj) {
    this.bones.set(name, obj);
    this.rest.set(name, {
      quat: obj.quaternion.clone(),
      pos: obj.position.clone(),
    });
    return obj;
  }

  // Sample an animation at time `t` seconds into a plain pose object.
  static sample(anim, t) {
    const dur = anim.duration;
    let time = anim.loop ? t % dur : Math.min(t, dur);
    const keys = anim.keys;
    let i = 0;
    while (i < keys.length - 1 && keys[i + 1].t <= time) i++;
    const a = keys[i];
    const b = keys[Math.min(i + 1, keys.length - 1)];
    const span = Math.max(b.t - a.t, 1e-6);
    let f = (time - a.t) / span;
    f = f < 0 ? 0 : f > 1 ? 1 : f;
    f = f * f * (3 - 2 * f); // smoothstep ease

    const out = {};
    const names = new Set([...Object.keys(a.pose), ...Object.keys(b.pose)]);
    for (const n of names) {
      const pa = a.pose[n] || [0, 0, 0];
      const pb = b.pose[n] || [0, 0, 0];
      out[n] = [
        pa[0] + (pb[0] - pa[0]) * f,
        pa[1] + (pb[1] - pa[1]) * f,
        pa[2] + (pb[2] - pa[2]) * f,
      ];
    }
    return out;
  }

  // Blend two pose objects by weight w (0 = A, 1 = B).
  static blend(a, b, w) {
    const out = {};
    const names = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const n of names) {
      const pa = a[n] || [0, 0, 0];
      const pb = b[n] || [0, 0, 0];
      out[n] = [
        pa[0] + (pb[0] - pa[0]) * w,
        pa[1] + (pb[1] - pa[1]) * w,
        pa[2] + (pb[2] - pa[2]) * w,
      ];
    }
    return out;
  }

  // Apply a pose: bone.quaternion = restQuat * euler(offset). Bones absent from
  // the pose relax to rest.
  apply(pose) {
    for (const [name, obj] of this.bones) {
      const rest = this.rest.get(name);
      const off = pose[name];
      if (off) {
        _e.set(off[0], off[1], off[2], 'XYZ');
        _qb.setFromEuler(_e);
        obj.quaternion.copy(rest.quat).multiply(_qb);
      } else {
        obj.quaternion.copy(rest.quat);
      }
    }
  }

  // Additive per-bone rotation on top of the current quaternion (secondary
  // motion). rot is [x,y,z] radians.
  addRotation(name, rot) {
    const obj = this.bones.get(name);
    if (!obj) return;
    _e.set(rot[0], rot[1], rot[2], 'XYZ');
    _qa.setFromEuler(_e);
    obj.quaternion.multiply(_qa);
  }
}

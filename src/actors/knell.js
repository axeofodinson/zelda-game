import { Group, Mesh, CylinderGeometry, ConeGeometry, Vector3 } from 'three';
import { bakeFlat } from '../render/geo.js';
import { makeN64Material } from '../render/n64material.js';

const _target = new Vector3();
const _tmp = new Vector3();

// A cracked bronze bell, hand-sized, floating at Tinn's shoulder — companion,
// lock-on reticle, boomerang. Procedural motion only: spring-follow with
// overshoot, slow bob, lag on turns, tilts toward whatever it rings at.
// It never talks. It rings (audio in Phase 4).
export class Knell {
  constructor() {
    this.root = new Group();
    this.pos = new Vector3();
    this.vel = new Vector3();
    this.t = 0;

    const mat = () => makeN64Material({ tint: [1, 1, 1] });
    // bell body (open cone) + crown
    const body = new Mesh(bakeFlat(new ConeGeometry(0.14, 0.22, 7, 1, true), 'verdigris', { top: 1.0, floor: 0.7 }), mat());
    body.rotation.x = Math.PI; // mouth down
    this.root.add(body);
    const crown = new Mesh(bakeFlat(new CylinderGeometry(0.03, 0.03, 0.06, 5), 'iron'), mat());
    crown.position.y = 0.13;
    this.root.add(crown);
    // clapper glint
    this.ringMat = makeN64Material({ emissive: 0.0, tint: [1, 1, 1] });
    const clapper = new Mesh(bakeFlat(new ConeGeometry(0.04, 0.06, 5), 'sear'), this.ringMat);
    clapper.position.y = -0.06;
    this.root.add(clapper);
  }

  addToScene(scene) {
    scene.add(this.root);
  }

  // shoulderPos: default anchor. lockTarget: enemy (or null). ringHeat 0..1.
  update(dt, shoulderPos, lockTarget, ringHeat = 0) {
    this.t += dt;
    if (lockTarget) {
      _target.copy(lockTarget.position);
      _target.y += 1.4;
    } else {
      _target.copy(shoulderPos);
      _target.y += 0.15 + Math.sin(this.t * 2.2) * 0.06; // slow bob
    }

    // Damped spring with overshoot.
    _tmp.copy(_target).sub(this.pos);
    this.vel.addScaledVector(_tmp, 22 * dt);
    this.vel.multiplyScalar(Math.pow(0.86, dt * 60));
    this.pos.addScaledVector(this.vel, dt);
    this.root.position.copy(this.pos);

    // Tilt toward what it rings at (velocity-led), plus a slow spin.
    this.root.rotation.z = -this.vel.x * 0.12;
    this.root.rotation.x = this.vel.z * 0.12;
    this.root.rotation.y += dt * 1.2;

    // The clapper glows with target heat (foreshadows the heat-pitched bell).
    this.ringMat.uniforms.uEmissive.value = lockTarget ? 0.4 + ringHeat * 0.6 : 0;
  }
}

import { Mesh, BoxGeometry, Vector3 } from 'three';
import { Enemy } from './base.js';
import { bakeFlat } from '../../render/geo.js';
import { makeN64Material } from '../../render/n64material.js';
import { MELT } from '../../config/heat.js';
import { faceTo, dist2D } from '../ai.js';

// FLASHLINGS — swarm. Flat ragged bronze sheets (mold-seam squeeze-out) gliding
// like manta rays, edges glowing. Any hit kills. Brittle: one quenchflask
// shatters the whole swarm at once (§3.4). ~40 tris.
export class Flashling extends Enemy {
  constructor(position = [0, 1.6, -8], phase = 0) {
    super({ heat: 15, maxHeat: 15, coolResist: 1, position });
    this.noStatue = true;
    this.orbitPhase = phase;
    this.orbitR = 3 + Math.random() * 2;
    this.height = 1.3 + Math.random() * 0.8;
    this.mode = 'orbit';
    this.mt = 0;
    this.diveTarget = new Vector3();

    // A flat ragged sheet with glowing edges.
    this.coreMat = makeN64Material({ emissive: 1.0, side: 'double' });
    const body = new Mesh(bakeFlat(new BoxGeometry(0.7, 0.04, 0.5), 'slag', { top: 1.0, floor: 0.9 }), makeN64Material({ side: 'double' }));
    this.root.add(body);
    // glowing rim
    const rim = new Mesh(bakeFlat(new BoxGeometry(0.8, 0.02, 0.08), 'molten'), this.coreMat);
    rim.position.z = 0.26;
    this.root.add(rim);
    const rim2 = new Mesh(bakeFlat(new BoxGeometry(0.8, 0.02, 0.08), 'molten'), this.coreMat);
    rim2.position.z = -0.26;
    this.root.add(rim2);
    this.registerCore(this.coreMat);

    this.coolable = [{ offset: new Vector3(0, 0, 0), r: 0.5 }];
  }

  // Any hit kills (§3.4). Shatter into glass.
  cool(amount, opts) {
    if (this.dead) return { cooled: 0, killed: false, shatter: false };
    this.heat = 0;
    this._die();
    return { cooled: this.maxHeat, killed: true, shatter: true };
  }

  onDeath() {
    this.root.visible = false;
  }

  shatter(ctx) {
    if (this.dead) return;
    ctx.fx.glassShards(this.position, 20);
    this.cool(999);
  }

  think(ctx) {
    if (this.dead) return;
    const p = ctx.playerPos;
    this.orbitPhase += ctx.dt * 0.9;

    if (this.mode === 'orbit') {
      this.telegraph = Math.max(0, this.telegraph - ctx.dt * 2);
      const tx = p.x + Math.cos(this.orbitPhase) * this.orbitR;
      const tz = p.z + Math.sin(this.orbitPhase) * this.orbitR;
      this.position.x += (tx - this.position.x) * Math.min(1, ctx.dt * 3);
      this.position.z += (tz - this.position.z) * Math.min(1, ctx.dt * 3);
      this.position.y = this.height + Math.sin(this.orbitPhase * 2) * 0.2;
      faceTo(this, p, ctx.dt, 6);
      this.root.rotation.z = Math.sin(this.orbitPhase * 3) * 0.3; // banking glide
      this.mt += ctx.dt * 1000;
      if (this.mt > 2200 + Math.random() * 1500) { this.mode = 'windup'; this.mt = 0; }
    } else if (this.mode === 'windup') {
      this.mt += ctx.dt * 1000;
      this.telegraph = Math.min(1, this.mt / 320);
      if (this.mt >= 320) {
        this.diveTarget.set(p.x, 0.6, p.z);
        this.mode = 'dive';
        this.mt = 0;
      }
    } else if (this.mode === 'dive') {
      this.mt += ctx.dt * 1000;
      const dir = this.diveTarget.clone().sub(this.position);
      this.position.addScaledVector(dir.normalize(), 14 * ctx.dt);
      if (dist2D(this.position, ctx.playerPos) < 0.9 && this.position.y < 1.4) {
        ctx.hurtTinn?.(MELT.flashlingSlice);
        this.mode = 'recover';
        this.mt = 0;
      }
      if (this.mt >= 500) { this.mode = 'recover'; this.mt = 0; }
    } else {
      this.mt += ctx.dt * 1000;
      // climb back up
      this.position.y += (this.height - this.position.y) * Math.min(1, ctx.dt * 4);
      this.telegraph = Math.max(0, this.telegraph - ctx.dt * 3);
      if (this.mt >= 400) { this.mode = 'orbit'; this.mt = 0; }
    }
  }
}

import { Mesh, CylinderGeometry, Vector3 } from 'three';
import { Enemy } from './base.js';
import { bakeFlat } from '../../render/geo.js';
import { makeN64Material } from '../../render/n64material.js';
import { MELT } from '../../config/heat.js';
import { faceTo, moveToward, dist2D } from '../ai.js';

const _f = new Vector3();

// CRUCIBLE — heavy. Squat, headless, barrel-bodied, full of sloshing molten
// metal. Armored everywhere: blade hits on the body do ZERO (clang + spark +
// knockback). Only the open top is coolable — and only reachable after you bait
// its charge into a wall, which stuns it bent-over for 2.5s. Plunge: 70 cooling,
// three to kill. Death: becomes a climbable platform (§3.4).
export class Crucible extends Enemy {
  constructor(position = [0, 0, -12]) {
    super({ heat: 200, maxHeat: 200, coolResist: 1, position });
    this.mode = 'approach';
    this.mt = 0;
    this.speed = 1.8;
    this.exposed = false;
    this.chargeDir = new Vector3(0, 0, 1);
    this.standSize = { w: 2.3, d: 2.3, h: 1.4 };

    const add = (geo, base, off, mat, opts) => {
      const m = new Mesh(bakeFlat(geo, base, opts), mat || makeN64Material());
      m.position.set(off[0], off[1], off[2]);
      this.root.add(m);
      return m;
    };

    // Barrel body (armored) with glowing seams.
    add(new CylinderGeometry(1.0, 1.15, 1.4, 10), 'slag', [0, 0.7, 0]);
    this.seamMat = makeN64Material({ emissive: 0.4 });
    add(new CylinderGeometry(1.02, 1.02, 0.12, 10, 1, true), 'molten', [0, 0.5, 0], this.seamMat, { top: 1, floor: 0.9 });
    add(new CylinderGeometry(1.04, 1.04, 0.1, 10, 1, true), 'molten', [0, 1.0, 0], this.seamMat, { top: 1, floor: 0.9 });
    this.registerCore(this.seamMat);

    // Open top with a sloshing molten surface (weak point when exposed).
    this.coreMat = makeN64Material({ emissive: 1.0 });
    this.slosh = new Mesh(bakeFlat(new CylinderGeometry(0.85, 0.85, 0.1, 12), 'molten'), this.coreMat);
    this.slosh.position.set(0, 1.42, 0);
    this.root.add(this.slosh);
    this.registerCore(this.coreMat);

    // Armored body spheres (clang). Coolable top only when exposed.
    this.armored = [
      { offset: new Vector3(0, 0.7, 0), r: 1.1 },
      { offset: new Vector3(0, 1.2, 0), r: 0.9 },
    ];
    this._topSphere = { offset: new Vector3(0, 1.45, 0), r: 0.9 };
    this.coolable = [];
  }

  think(ctx) {
    if (this.dead) return;
    const p = ctx.playerPos;
    // slosh tilt tracks velocity
    this.slosh.rotation.x = this._vz * 0.4 || 0;
    this.slosh.rotation.z = -(this._vx * 0.4 || 0);

    if (this.mode === 'approach') {
      this.telegraph = Math.max(0, this.telegraph - ctx.dt * 2);
      faceTo(this, p, ctx.dt, 3);
      const d = moveToward(this, p, this.speed, ctx.dt, 5.5);
      if (d <= 5.6) { this.mode = 'windup'; this.mt = 0; }
    } else if (this.mode === 'windup') {
      this.mt += ctx.dt * 1000;
      faceTo(this, p, ctx.dt, 2);
      this.telegraph = Math.min(1, this.mt / 900); // seams flood with glow
      this.root.rotation.x = -(this.mt / 900) * 0.25; // lean back
      if (this.mt >= 900) {
        _f.set(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
        this.chargeDir.copy(_f);
        this.mode = 'charge';
        this.mt = 0;
      }
    } else if (this.mode === 'charge') {
      this.mt += ctx.dt * 1000;
      this.root.rotation.x = 0;
      const step = 11 * ctx.dt;
      const nx = this.position.x + this.chargeDir.x * step;
      const nz = this.position.z + this.chargeDir.z * step;
      this._vx = this.chargeDir.x;
      this._vz = this.chargeDir.z;
      // crash into a wall/shell -> stun, bend over, expose the top
      if (ctx.platforms && ctx.platforms.blockedAt(nx, nz, 0, 0.6)) {
        this._crash(ctx);
      } else {
        this.position.x = nx;
        this.position.z = nz;
        if (dist2D(this.position, p) < 1.6) { ctx.hurtTinn?.(MELT.crucibleCharge); ctx.tinn?.knockback?.(this.chargeDir.clone().multiplyScalar(4)); this.mode = 'recover'; this.mt = 0; }
      }
      if (this.mt >= 1400) { this.mode = 'recover'; this.mt = 0; }
    } else if (this.mode === 'stunned') {
      this.mt += ctx.dt * 1000;
      this.exposed = true;
      this.coolable = [this._topSphere];
      this.root.rotation.x = 1.0; // bent over — top is now low and plungeable
      if (this.mt >= 2500) { this.mode = 'recover'; this.mt = 0; this.exposed = false; this.coolable = []; }
    } else {
      this.mt += ctx.dt * 1000;
      this.exposed = false;
      this.coolable = [];
      this.root.rotation.x += (0 - this.root.rotation.x) * Math.min(1, ctx.dt * 4);
      if (this.mt >= 700) { this.mode = 'approach'; this.mt = 0; }
    }
  }

  _crash(ctx) {
    this.mode = 'stunned';
    this.mt = 0;
    ctx.fx.sparks({ x: this.position.x + this.chargeDir.x, y: 0.8, z: this.position.z + this.chargeDir.z }, 24, this.chargeDir);
    ctx.fx.ashPuff(this.position, 16);
    ctx.feel?.shake?.(0.14);
  }
}

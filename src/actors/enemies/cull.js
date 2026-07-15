import { Mesh, BoxGeometry, Vector3 } from 'three';
import { Enemy } from './base.js';
import { bakeFlat } from '../../render/geo.js';
import { makeN64Material } from '../../render/n64material.js';
import { MELT } from '../../config/heat.js';
import { faceTo, moveToward, maybeRetreatToRunnel, dist2D } from '../ai.js';

const _f = new Vector3();

// CULL — grunt. A god's severed hand walking on its fingertips. The molten
// wrist-stump is the weak point and the light source. Slam leaves a molten
// handprint (persistent heat pool). Death: topples into climbable geometry.
export class Cull extends Enemy {
  constructor(position = [0, 0, -8]) {
    super({ heat: 60, maxHeat: 60, coolResist: 1, position });
    this.mode = 'approach';
    this.mt = 0;
    this.speed = 2.4;
    this.standSize = { w: 1.8, d: 1.8, h: 0.55 };

    const iron = () => makeN64Material();
    const add = (geo, base, off, mat, opts) => {
      const m = new Mesh(bakeFlat(geo, base, opts), mat || iron());
      m.position.set(off[0], off[1], off[2]);
      this.root.add(m);
      return m;
    };

    // Palm.
    this.palm = add(new BoxGeometry(1.0, 0.35, 1.1), 'slag', [0, 0.5, 0]);
    // Five fingers splayed to the ground (walking on fingertips).
    const fingerAngles = [-0.7, -0.35, 0, 0.35, 0.7];
    this.fingers = [];
    for (const a of fingerAngles) {
      const f = new Mesh(bakeFlat(new BoxGeometry(0.16, 0.16, 0.7), 'slag'), iron());
      f.position.set(Math.sin(a) * 0.55, 0.32, 0.5 + Math.cos(a) * 0.2);
      f.rotation.x = 0.5;
      f.rotation.y = a;
      this.root.add(f);
      this.fingers.push(f);
    }
    // Molten wrist-stump — weak point + light.
    this.coreMat = makeN64Material({ emissive: 1.0 });
    add(new BoxGeometry(0.5, 0.5, 0.4), 'molten', [0, 0.62, -0.5], this.coreMat);
    this.registerCore(this.coreMat);

    this.coolable = [
      { offset: new Vector3(0, 0.62, -0.45), r: 0.55 },
      { offset: new Vector3(0, 0.5, 0.1), r: 0.6 },
    ];
  }

  think(ctx) {
    if (this.dead) return;
    const p = ctx.playerPos;
    // scuttle bob
    this.palm.position.y = 0.5 + Math.sin((ctx.dt ? performance.now() : 0) * 0.006) * 0.03;

    if (this.heat < 30 && maybeRetreatToRunnel(this, ctx, this.speed)) return;

    const d = dist2D(this.position, p);
    faceTo(this, p, ctx.dt, 5);

    if (this.mode === 'approach') {
      this.telegraph = Math.max(0, this.telegraph - ctx.dt * 3);
      if (moveToward(this, p, this.speed * (this.brittle ? 0.6 : 1), ctx.dt, 1.7) <= 1.8) {
        this.mode = 'windup';
        this.mt = 0;
      }
    } else if (this.mode === 'windup') {
      this.mt += ctx.dt * 1000;
      this.telegraph = Math.min(1, this.mt / 620); // brighten over the windup
      // rear back
      this.root.position.y = Math.sin((this.mt / 620) * Math.PI) * 0.25;
      if (this.mt >= 620) {
        this.mode = 'slam';
        this.mt = 0;
        this._slam(ctx, d);
      }
    } else if (this.mode === 'slam') {
      this.mt += ctx.dt * 1000;
      this.root.position.y = 0;
      if (this.mt >= 140) { this.mode = 'recover'; this.mt = 0; }
    } else {
      this.mt += ctx.dt * 1000;
      this.telegraph = Math.max(0, this.telegraph - ctx.dt * 3);
      if (this.mt >= 500) this.mode = 'approach';
    }
  }

  _slam(ctx, d) {
    _f.set(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
    const hx = this.position.x + _f.x * 1.4;
    const hz = this.position.z + _f.z * 1.4;
    ctx.fx.ashPuff({ x: hx, y: 0.1, z: hz }, 12);
    ctx.fx.sparks({ x: hx, y: 0.2, z: hz }, 8);
    ctx.addHandprint?.(hx, hz);
    ctx.feel?.shake?.(0.06);
    // hit if player is near the slam point and not dodging
    if (dist2D(ctx.playerPos, { x: hx, z: hz }) < 1.5) ctx.hurtTinn?.(MELT.cullSlam);
  }
}

import { Mesh, BoxGeometry, CylinderGeometry, Vector3 } from 'three';
import { Enemy } from './base.js';
import { bakeFlat } from '../../render/geo.js';
import { makeN64Material } from '../../render/n64material.js';
import { MELT } from '../../config/heat.js';
import { faceTo, moveToward, maybeRetreatToRunnel, dist2D } from '../ai.js';

// SPRUE — ranged. A funnel head, inverted, on stork stilt-legs. Tallest
// silhouette in the game. Must TILT to pour (windup 900ms). While tilted the
// throat is exposed and cold: a hit there does double cooling (40) and cancels
// the pour (§3.4).
export class Sprue extends Enemy {
  constructor(position = [6, 0, -14]) {
    super({ heat: 80, maxHeat: 80, coolResist: 1, position });
    this.mode = 'approach';
    this.mt = 0;
    this.speed = 2.2;
    this.tilted = false;
    this.pourTarget = new Vector3();
    this.standSize = { w: 1.4, d: 1.4, h: 0.6 };

    const iron = () => makeN64Material();
    const add = (geo, base, off, mat, opts, parent) => {
      const m = new Mesh(bakeFlat(geo, base, opts), mat || iron());
      m.position.set(off[0], off[1], off[2]);
      (parent || this.root).add(m);
      return m;
    };

    // Stilt legs.
    for (const sx of [-0.35, 0.35]) {
      const leg = add(new BoxGeometry(0.12, 1.7, 0.12), 'iron', [sx, 0.85, 0]);
      leg.rotation.x = sx > 0 ? 0.15 : -0.15;
    }
    add(new BoxGeometry(0.12, 1.5, 0.12), 'iron', [0, 0.75, 0.3]).rotation.x = 0.3;

    // The tilting head (funnel). A pivot group so tilt exposes the throat.
    this.head = new Mesh(bakeFlat(new CylinderGeometry(0.55, 0.18, 0.8, 8, 1, true), 'slag', { top: 1.0, floor: 0.6 }), makeN64Material({ side: 'double' }));
    this.head.position.set(0, 1.9, 0);
    this.root.add(this.head);
    // Throat — molten weak point inside the funnel.
    this.coreMat = makeN64Material({ emissive: 1.0 });
    const throat = new Mesh(bakeFlat(new CylinderGeometry(0.14, 0.14, 0.3, 7), 'molten'), this.coreMat);
    throat.position.set(0, -0.1, 0);
    this.head.add(throat);
    this.registerCore(this.coreMat);

    this.coolable = [{ offset: new Vector3(0, 1.9, 0), r: 0.5 }];
  }

  // While tilted the throat is cold & open: double cooling + cancels the pour.
  cool(amount, opts) {
    if (this.tilted) {
      const res = super.cool(amount * 2, opts);
      this.mode = 'recover';
      this.mt = 0;
      this.tilted = false;
      this.head.rotation.x = 0;
      return res;
    }
    return super.cool(amount, opts);
  }

  think(ctx) {
    if (this.dead) return;
    const p = ctx.playerPos;
    if (this.heat < 30 && maybeRetreatToRunnel(this, ctx, this.speed)) return;
    const d = dist2D(this.position, p);
    faceTo(this, p, ctx.dt, 4);

    if (this.mode === 'approach') {
      this.telegraph = Math.max(0, this.telegraph - ctx.dt * 2);
      if (d < 6) moveToward(this, p, -this.speed, ctx.dt); // back off
      else if (d > 11) moveToward(this, p, this.speed, ctx.dt, 10);
      else { this.mode = 'windup'; this.mt = 0; }
    } else if (this.mode === 'windup') {
      this.mt += ctx.dt * 1000;
      this.tilted = true;
      this.telegraph = Math.min(1, this.mt / 900);
      this.head.rotation.x = (this.mt / 900) * 1.1; // tilt to pour
      if (this.mt >= 900) {
        this.pourTarget.set(p.x, 0, p.z); // pours at Tinn's last position
        this.mode = 'pour';
        this.mt = 0;
      }
    } else if (this.mode === 'pour') {
      this.mt += ctx.dt * 1000;
      // molten stream to the target; damages Tinn if he stands in it
      const tx = this.pourTarget.x, tz = this.pourTarget.z;
      ctx.fx.pools.drips?.spawn?.({
        x: tx + (Math.random() * 2 - 1) * 0.4, y: 1.6, z: tz + (Math.random() * 2 - 1) * 0.4,
        vx: 0, vy: -5, vz: 0, life: 0.4, size: 0.12, color: [1, 0.42, 0.1], alpha: 0.9,
      });
      if (dist2D(ctx.playerPos, { x: tx, z: tz }) < 0.9) ctx.hurtTinn?.(MELT.spruePourPer100ms * (ctx.dt / 0.1));
      if (this.mt >= 1200) { this.mode = 'recover'; this.mt = 0; this.tilted = false; this.head.rotation.x = 0; }
    } else {
      this.mt += ctx.dt * 1000;
      this.telegraph = Math.max(0, this.telegraph - ctx.dt * 2);
      if (this.mt >= 700) this.mode = 'approach';
    }
  }

  // Quenchflask in the funnel: plug -> bulge -> burst -> 60 area (§3.4).
  plug(ctx) {
    ctx.fx.steamBurst({ x: this.position.x, y: 1.9, z: this.position.z }, 20);
    ctx.fx.sparks({ x: this.position.x, y: 1.9, z: this.position.z }, 20);
    if (dist2D(ctx.playerPos, this.position) < 3) ctx.hurtTinn?.(60);
    this.cool(this.heat + 999); // bursting kills it
  }
}

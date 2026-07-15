import { Pool, AshSnow } from './particles.js';
import { RGB } from '../render/palette.js';

// Particle manager. Owns every pool, updates them, and exposes typed emitters
// the actors/systems call. Phase 1 ships ash snow + ash puffs; later phases add
// steam, sparks, drips, flakes, vent rings, glass, embers, Knell rings.
export class FX {
  constructor(scene) {
    this.scene = scene;
    this.ashSnow = new AshSnow(1200, 22);
    scene.add(this.ashSnow.points);

    this.pools = {
      ashPuff: new Pool(400, { gravity: 1.2, drag: 3.5, grow: true }),
    };
    for (const p of Object.values(this.pools)) scene.add(p.points);
  }

  // §6 ash puff — every roll, land, dodge, footstep. Tiny, cheap, 30% of feel.
  ashPuff(pos, count = 6) {
    const ash = RGB.ash;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.4 + Math.random() * 1.1;
      this.pools.ashPuff.spawn({
        x: pos.x + (Math.random() * 2 - 1) * 0.12,
        y: 0.06 + Math.random() * 0.1,
        z: pos.z + (Math.random() * 2 - 1) * 0.12,
        vx: Math.cos(ang) * spd,
        vy: 0.5 + Math.random() * 0.6,
        vz: Math.sin(ang) * spd,
        life: 0.4 + Math.random() * 0.3,
        size: 5 + Math.random() * 4,
        color: [ash[0] * 0.95, ash[1] * 0.92, ash[2] * 0.88],
      });
    }
  }

  update(dt, camPos) {
    this.ashSnow.update(dt, camPos);
    for (const p of Object.values(this.pools)) p.update(dt);
  }
}

import { Mesh, IcosahedronGeometry, Vector3 } from 'three';
import { bakeFlat } from '../render/geo.js';
import { makeN64Material } from '../render/n64material.js';
import { dist2D } from '../actors/ai.js';

// Quenchflask (§3.4, input `1`). A thrown flask of quench that detonates on
// impact: shatters the whole Flashling swarm at once (its showcase) and plugs a
// Sprue's funnel (bulge -> burst). Cheap AoE cooling on everything nearby.
export class Flasks {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.geo = bakeFlat(new IcosahedronGeometry(0.14, 0), 'verdigris');
  }

  throw(fromPos, dir) {
    const mat = makeN64Material({ emissive: 0.2, tint: [1, 1, 1] });
    const mesh = new Mesh(this.geo, mat);
    mesh.position.copy(fromPos);
    this.scene.add(mesh);
    this.list.push({
      mesh,
      vel: new Vector3(dir.x * 9, 5.5, dir.z * 9),
      alive: true,
    });
  }

  update(dt, ctx) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.vel.y -= 20 * dt;
      f.mesh.position.addScaledVector(f.vel, dt);
      f.mesh.rotation.x += dt * 8;
      f.mesh.rotation.y += dt * 6;

      // impact: ground, or close to an enemy
      let hit = f.mesh.position.y <= 0.12;
      if (!hit) {
        for (const e of ctx.getEnemies()) {
          if (!e.dead && e.position.distanceTo(f.mesh.position) < 1.0) { hit = true; break; }
        }
      }
      if (hit) {
        this._detonate(f.mesh.position, ctx);
        this.scene.remove(f.mesh);
        this.list.splice(i, 1);
      }
    }
  }

  _detonate(pos, ctx) {
    ctx.fx.steamBurst({ x: pos.x, y: Math.max(pos.y, 0.4), z: pos.z }, 16);
    ctx.fx.glassShards({ x: pos.x, y: Math.max(pos.y, 0.4), z: pos.z }, 10);
    const R = 4.5;
    const SWARM_R = 12; // flashlings are brittle mist-bait — the WHOLE swarm goes
    for (const e of ctx.getEnemies()) {
      if (e.dead) continue;
      const d = dist2D(e.position, pos);
      if (e.shatter) { if (d <= SWARM_R) e.shatter(ctx); } // whole swarm shatters at once
      else if (d > R) continue;
      else if (e.plug && e.tilted) e.plug(ctx); // Sprue mid-pour — plug + burst
      else e.cool(20); // generic quench splash
    }
    ctx.feel?.shake?.(0.05);
  }
}

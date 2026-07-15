import { Mesh, BoxGeometry, CylinderGeometry, Vector3 } from 'three';
import { Enemy } from './base.js';
import { Cull } from './cull.js';
import { bakeFlat } from '../../render/geo.js';
import { makeN64Material } from '../../render/n64material.js';
import { dist2D } from '../ai.js';

// The Orant's heart — the chest seam that was never sealed, an open channel of
// molten metal. Coolable only in Phase 3; plunging it dumps 90 heat into the
// blade instantly (you must Vent or melt). Three plunges to kill (§3.5).
class Heart extends Enemy {
  constructor(pos) {
    super({ heat: 210, maxHeat: 210, coolResist: 1, position: pos });
    this.dumpsBladeHeat = 90;
    this.noStatue = true;
    this.coolable = [];
    this._top = { offset: new Vector3(0, 0, 0), r: 1.0 };
    this.coreMat = makeN64Material({ emissive: 1.0 });
    const chan = new Mesh(bakeFlat(new BoxGeometry(0.7, 1.4, 0.4), 'molten'), this.coreMat);
    this.root.add(chan);
    this.registerCore(this.coreMat);
  }
  expose(on) { this.coolable = on ? [this._top] : []; }
  onDeath() { this.root.visible = false; }
}

// THE ORANT (§3.5). Cast only from the waist up, fused into the pit floor. It
// cannot move. Three phases: the Hands (two giant Culls) -> the Climb (cooled
// hands are the only safe ground) -> the Heart (plunge + forced vent).
export class Orant {
  constructor(scene, arena) {
    this.scene = scene;
    this.arena = arena;
    this.phase = 1;
    this.deathT = -1;
    this.won = false;
    this.pourT = 0;

    this.root = new Mesh(); // container is unused; we add children to scene
    // Torso — waist-up, fused into the floor.
    const mk = (geo, base, pos, mat, opts) => {
      const m = new Mesh(bakeFlat(geo, base, opts), mat || makeN64Material());
      m.position.set(pos[0], pos[1], pos[2]);
      scene.add(m);
      return m;
    };
    mk(new CylinderGeometry(2.2, 2.6, 3.2, 10), 'iron', [0, 1.4, 0]);
    mk(new BoxGeometry(1.4, 1.2, 1.2), 'iron', [0, 3.4, 0]); // head, bowed
    // raised-arm stumps (the hands detach)
    mk(new BoxGeometry(0.7, 1.8, 0.7), 'iron', [-1.7, 3.0, 0.2]).rotation.z = 0.6;
    mk(new BoxGeometry(0.7, 1.8, 0.7), 'iron', [1.7, 3.0, 0.2]).rotation.z = -0.6;

    // The heart, on the chest, reachable by climbing a cooled hand.
    this.heart = new Heart(new Vector3(0, 2.6, 2.4));
    scene.add(this.heart.root);

    // Phase 1 — the Hands: two giant Culls (2.5x, heat 120), they alternate.
    this.hands = [this._makeHand([-6, 0, 6]), this._makeHand([6, 0, 6])];
    for (const h of this.hands) scene.add(h.root);
    this.hands[1].mode = 'wait'; // alternate: the second waits its turn
  }

  _makeHand(pos) {
    const h = new Cull(pos);
    h.root.scale.setScalar(2.4);
    h.heat = 120; h.maxHeat = 120;
    h.speed = 1.6;
    h.standSize = { w: 4.6, d: 4.6, h: 1.5 }; // big statue -> climbable staircase
    return h;
  }

  enemies() {
    return [...this.hands, this.heart];
  }

  update(ctx) {
    if (this.deathT >= 0) return this._death(ctx);

    if (this.phase === 1) {
      // Alternate: the second hand stays passive (kept stunned) until the first
      // falls, then it wakes.
      const [a, b] = this.hands;
      if (!a.dead && !this._woke) b.staggerMs = Math.max(b.staggerMs, 60);
      if (a.dead && !this._woke) { this._woke = true; b.mode = 'approach'; b.staggerMs = 0; }
      if (this.hands.every((h) => h.dead)) {
        this.phase = 2;
        this.arena.deadlyFloor = true; // the floor is now death
      }
    } else if (this.phase === 2) {
      // Pour sweeping molten streams across the pit floor.
      this.pourT += ctx.dt;
      const a = this.pourT * 1.2;
      const tx = Math.cos(a) * 12, tz = Math.sin(a) * 12;
      ctx.fx.pools.drips?.spawn?.({ x: tx, y: 3, z: tz, vx: 0, vy: -6, vz: 0, life: 0.5, size: 0.14, color: [1, 0.42, 0.1], alpha: 0.9 });
      // Reaching the chest: elevated (on a cooled hand) and near the torso.
      if (ctx.tinn.root.position.y > 1.0 && dist2D(ctx.playerPos, { x: 0, z: 2.4 }) < 4.5) {
        this.phase = 3;
        this.heart.expose(true);
      }
    } else if (this.phase === 3) {
      if (this.heart.dead) { this.deathT = 0; this.arena.deadlyFloor = false; }
    }
  }

  // §3.5 death: cools from the heart outward over 8s; teal floods; runnels go
  // dark; the fog LIFTS — for the first time the player can see the sky.
  _death(ctx) {
    this.deathT += ctx.dt;
    const k = Math.min(this.deathT / 8, 1);
    this.arena.liftFog(k);
    for (const r of this.arena.root.children) {
      if (r.material?.uniforms?.uEmissive) r.material.uniforms.uEmissive.value *= 1 - ctx.dt * 0.5; // runnels darken
    }
    if (k >= 1 && !this.won) { this.won = true; }
  }
}

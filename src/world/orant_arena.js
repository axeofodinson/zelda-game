import { Group, Mesh, BoxGeometry, CylinderGeometry, Vector3 } from 'three';
import { bakeFlat } from '../render/geo.js';
import { makeN64Material, addLight } from '../render/n64material.js';
import { buildSky } from '../render/sky.js';
import { RGB } from '../render/palette.js';

// The Orant's pit (§3.5). A circular pit; four quench pools at the compass
// points; molten runnels spiralling inward toward the boss, which is the only
// light. Implements the same interface main.js expects from a level.
export class OrantArena {
  constructor(platforms) {
    this.root = new Group();
    this.platforms = platforms;
    this.colliders = [];
    this.runnels = [];
    this._runnelRects = [];
    this._pools = [];
    this._patches = [];
    this.spawns = [];
    this.deadlyFloor = false; // Phase 2: the pit floor is death
    this._handprints = [];

    const sky = buildSky();
    sky.mat.uniforms.uAsh.value.multiplyScalar(0.5); // start darker; lifts on death
    sky.mat.uniforms.uHigh.value.multiplyScalar(0.4);
    this.sky = sky;
    this.root.add(sky.mesh);

    this._build();
  }

  _add(geo, base, mat, x, y, z, collide = false, opts) {
    const m = new Mesh(bakeFlat(geo, base, opts), mat || makeN64Material());
    m.position.set(x, y, z);
    this.root.add(m);
    if (collide) this.colliders.push(m);
    return m;
  }

  _build() {
    // Pit floor (dark).
    this._add(new CylinderGeometry(20, 20, 1, 32), 'iron', undefined, 0, -0.5, 0);
    // Pit wall ring (a lip so it reads as a pit).
    const wallMat = makeN64Material();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      this._add(new BoxGeometry(3, 3, 1.4), 'iron', wallMat, Math.cos(a) * 20, 1.0, Math.sin(a) * 20, false, { top: 0.7, floor: 0.4 }).rotation.y = -a;
    }

    // Four quench pools at the compass points (blade + respawn).
    const poolMat = makeN64Material();
    for (const [x, z] of [[0, -14], [0, 14], [-14, 0], [14, 0]]) {
      this._add(new CylinderGeometry(2.4, 2.4, 0.12, 16), [0.05, 0.06, 0.08], poolMat, x, 0.06, z);
      this._pools.push({ x, z, r: 2.4 });
      this.spawns.push({ x, z });
    }

    // Molten runnels spiralling inward — the only light.
    const runnelMat = makeN64Material({ emissive: 1.0 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const r = 11;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const seg = this._add(new BoxGeometry(1.6, 0.2, 10), 'molten', runnelMat, x, 0.1, z, false, { top: 1, floor: 0.9, variance: 0.03 });
      seg.rotation.y = -a + 0.5;
      this.runnels.push({ x, z });
      this._runnelRects.push({ minX: x - 2, maxX: x + 2, minZ: z - 5, maxZ: z + 5 });
      addLight({ position: new Vector3(x, 0.6, z), color: RGB.molten, range: 14, intensity: 1.0 });
    }
    addLight({ position: new Vector3(0, 3, 0), color: RGB.molten, range: 20, intensity: 1.3 });

    this._handMat = makeN64Material({ emissive: 1.0 });
  }

  _inRect(x, z, r) { return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ; }
  _inCircle(x, z, c) { return (x - c.x) ** 2 + (z - c.z) ** 2 <= c.r * c.r; }
  runnelAt(x, z) { return this._runnelRects.some((r) => this._inRect(x, z, r)); }

  envAt(x, z) {
    return {
      runnel: this.runnelAt(x, z),
      quench: this._pools.some((c) => this._inCircle(x, z, c)),
      verdigris: false,
      handprint: this._handprints.some((h) => this._inCircle(x, z, h)),
    };
  }

  // Phase 2: standing on the pit floor (not on a cooled hand) is death.
  floorHazard(x, z, y) {
    if (!this.deadlyFloor) return 0;
    if (y > 0.9) return 0; // safe on a raised hand statue
    if (x * x + z * z > 19 * 19) return 0; // outside pit
    return 30; // melt/sec — like standing in a runnel
  }

  nearestSpawn(pos) {
    let best = this.spawns[0], bd = Infinity;
    for (const s of this.spawns) { const d = (s.x - pos.x) ** 2 + (s.z - pos.z) ** 2; if (d < bd) { bd = d; best = s; } }
    return best;
  }

  addHandprint(x, z) {
    const mat = makeN64Material({ emissive: 1.0 });
    const m = new Mesh(bakeFlat(new CylinderGeometry(0.9, 0.9, 0.05, 10), 'molten'), mat);
    m.position.set(x, 0.04, z);
    this.root.add(m);
    this._handprints.push({ x, z, r: 1.0, t: 0, mesh: m, mat });
  }

  emitEmbers(fx) {
    for (const r of this._runnelRects) if (Math.random() < 0.4) fx.emberMote(r.minX + Math.random() * (r.maxX - r.minX), r.minZ + Math.random() * (r.maxZ - r.minZ));
  }

  update(dt) {
    for (let i = this._handprints.length - 1; i >= 0; i--) {
      const h = this._handprints[i]; h.t += dt;
      const k = Math.max(0, 1 - h.t / 4);
      h.mat.uniforms.uEmissive.value = k;
      if (h.t >= 4) { this.root.remove(h.mesh); this._handprints.splice(i, 1); }
    }
  }

  // Death sequence: lift the fog + lighten the sky so the player finally sees it.
  liftFog(k) {
    this.sky.mat.uniforms.uLift.value = k;
    this.sky.mat.uniforms.uAsh.value.setRGB(...RGB.ash).multiplyScalar(0.5 + 0.5 * k);
    this.sky.mat.uniforms.uHigh.value.setRGB(...RGB.ash).multiplyScalar(0.4 + 0.6 * k);
  }
}

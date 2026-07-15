import { Group, Mesh, BoxGeometry, CylinderGeometry, Vector3 } from 'three';
import { bakeFlat } from '../render/geo.js';
import { makeN64Material, addLight } from '../render/n64material.js';
import { buildSky } from '../render/sky.js';
import { RGB } from '../render/palette.js';

// Ashfall Basin (§3.1). The combat triangle rule: quench pool (blade), verdigris
// patch (health), and runnel (danger) are never the same place. Molten runnels
// are the light source and the reheat station enemies flee to.
export class Basin {
  constructor(platforms) {
    this.root = new Group();
    this.platforms = platforms;
    this.colliders = [];
    this.runnels = []; // { x, z } centres for AI targeting
    this._runnelRects = []; // { minX, maxX, minZ, maxZ }
    this._pools = []; // { x, z, r }  quench (blade cool + respawn)
    this._patches = []; // { x, z, r } verdigris (melt heal)
    this._handprints = []; // { x, z, r, t }
    this.spawns = []; // { x, z } respawn points at pools

    const sky = buildSky();
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
    // Ground.
    this._add(new BoxGeometry(100, 1, 100), 'slag', undefined, 0, -0.5, 0);

    // Mold shells — cracked stone half-shells, cover + walls (bait the Crucible
    // into these). Registered as tall platforms so Tinn (and charges) collide.
    const shells = [
      [-9, 0, -12, 4, 3, 2.2],
      [11, 0, -6, 3.2, 2.6, 4],
      [2, 0, -20, 5, 3.4, 2.4],
      [-16, 0, 2, 3, 2.8, 3],
      [14, 0, 10, 3.6, 3, 2.6],
    ];
    for (const [x, , z, w, h, d] of shells) {
      this._add(new BoxGeometry(w, h, d), 'iron', undefined, x, h / 2, z, true, { top: 0.9, floor: 0.5 });
      this.platforms.add({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: h, tag: 'shell' });
    }

    // Molten runnels — long emissive strips; the light source.
    const runnelMat = makeN64Material({ emissive: 1.0 });
    const rns = [
      [-6, -6, 2.2, 18, 0], // x, z, width, length, rot(0=Z-aligned)
      [8, -16, 2.0, 14, 0],
    ];
    for (const [x, z, w, len] of rns) {
      this._add(new BoxGeometry(w, 0.22, len), 'molten', runnelMat, x, 0.11, z, false, { top: 1.0, floor: 0.9, variance: 0.03 });
      this.runnels.push({ x, z });
      this._runnelRects.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - len / 2, maxZ: z + len / 2 });
      addLight({ position: new Vector3(x, 0.6, z), color: RGB.molten, range: 15, intensity: 1.1 });
    }

    // Quench pools — dark still water; blade cool + checkpoint/respawn (3).
    const poolMat = makeN64Material();
    for (const [x, z] of [[-14, -14], [12, 4], [0, 12]]) {
      this._add(new CylinderGeometry(2.2, 2.2, 0.12, 16), [0.05, 0.06, 0.08], poolMat, x, 0.06, z);
      this._pools.push({ x, z, r: 2.2 });
      this.spawns.push({ x, z });
    }

    // Verdigris patches — cooled bronze; melt heal (4).
    const patchMat = makeN64Material({ emissive: 0.12 });
    for (const [x, z] of [[6, -4], [-4, 6], [16, -12], [-12, -4]]) {
      this._add(new CylinderGeometry(1.8, 1.8, 0.08, 14), 'verdigris', patchMat, x, 0.05, z, false, { top: 1.0, floor: 0.8 });
      this._patches.push({ x, z, r: 1.8 });
    }

    // Fill light from the kiln-sun direction (cool, dim — keep the world grey).
    addLight({ position: new Vector3(18, 12, -20), color: [0.5, 0.42, 0.4], range: 60, intensity: 0.22 });

    // Molten handprint decals (pre-made, reused).
    this._handMat = makeN64Material({ emissive: 1.0 });
  }

  _inRect(x, z, r) {
    return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
  }
  _inCircle(x, z, c) {
    return (x - c.x) ** 2 + (z - c.z) ** 2 <= c.r * c.r;
  }

  runnelAt(x, z) {
    return this._runnelRects.some((r) => this._inRect(x, z, r));
  }

  // Booleans for Tinn's heat environment.
  envAt(x, z) {
    return {
      runnel: this.runnelAt(x, z),
      quench: this._pools.some((c) => this._inCircle(x, z, c)),
      verdigris: this._patches.some((c) => this._inCircle(x, z, c)),
      handprint: this._handprints.some((h) => this._inCircle(x, z, h)),
    };
  }

  nearestSpawn(pos) {
    let best = this.spawns[0];
    let bd = Infinity;
    for (const s of this.spawns) {
      const d = (s.x - pos.x) ** 2 + (s.z - pos.z) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  // Cull slam leaves a molten handprint — a persistent heat pool (§3.4).
  addHandprint(x, z) {
    const m = new Mesh(bakeFlat(new CylinderGeometry(0.7, 0.7, 0.05, 10), 'molten', { top: 1.0, floor: 0.9 }), this._handMat.clone ? this._handMat : this._handMat);
    // clone material so each fades independently
    const mat = makeN64Material({ emissive: 1.0 });
    m.material = mat;
    m.position.set(x, 0.04, z);
    this.root.add(m);
    this._handprints.push({ x, z, r: 0.8, t: 0, mesh: m, mat });
  }

  // §6 ember motes rising from the runnels — ambient, light the fog.
  emitEmbers(fx) {
    for (const r of this._runnelRects) {
      if (Math.random() < 0.4) {
        fx.emberMote(
          r.minX + Math.random() * (r.maxX - r.minX),
          r.minZ + Math.random() * (r.maxZ - r.minZ)
        );
      }
    }
  }

  update(dt) {
    for (let i = this._handprints.length - 1; i >= 0; i--) {
      const h = this._handprints[i];
      h.t += dt;
      const life = 4;
      const k = Math.max(0, 1 - h.t / life);
      h.mat.uniforms.uEmissive.value = k;
      h.mesh.scale.setScalar(0.6 + k * 0.5);
      if (h.t >= life) {
        this.root.remove(h.mesh);
        this._handprints.splice(i, 1);
      }
    }
  }
}

import { Mesh, BoxGeometry, CylinderGeometry, Vector3 } from 'three';
import { Enemy } from './base.js';
import { bakeFlat } from '../../render/geo.js';
import { makeN64Material } from '../../render/n64material.js';

// Phase 2 training dummy: a static bronze post with a molten core. No AI. Its
// glow IS its heat readout (no HUD, §11) — slash it and watch it cool from
// molten toward verdigris; plunge it once it's brittle to shatter it.
export class Dummy extends Enemy {
  constructor(position = [0, 0, -6], heat = 80) {
    super({ heat, maxHeat: 80, coolResist: 1, position });

    const slag = () => makeN64Material();
    const add = (geo, base, off, mat) => {
      const m = new Mesh(bakeFlat(geo, base), mat || slag());
      m.position.set(off[0], off[1], off[2]);
      this.root.add(m);
      return m;
    };

    // Base + body + head (dead bronze).
    add(new CylinderGeometry(0.5, 0.6, 0.25, 8), 'slag', [0, 0.12, 0]);
    add(new BoxGeometry(0.55, 1.0, 0.4), 'slag', [0, 0.75, 0]);
    add(new BoxGeometry(0.42, 0.34, 0.36), 'slag', [0, 1.42, 0]);

    // Molten core — the emissive weak point.
    this.coreMat = makeN64Material({ emissive: 1.0 });
    add(new BoxGeometry(0.3, 0.4, 0.28), 'molten', [0, 0.85, 0.06], this.coreMat);
    // crack seams down the body glow with the core
    add(new BoxGeometry(0.06, 0.7, 0.05), 'molten', [0.18, 0.75, 0.21], this.coreMat);
    add(new BoxGeometry(0.05, 0.5, 0.05), 'molten', [-0.16, 0.7, 0.21], this.coreMat);
    this.registerCore(this.coreMat);

    // Coolable everywhere (dummy has no armor).
    this.coolable = [
      { offset: new Vector3(0, 0.85, 0.1), r: 0.55 },
      { offset: new Vector3(0, 1.42, 0), r: 0.4 },
    ];
  }
}

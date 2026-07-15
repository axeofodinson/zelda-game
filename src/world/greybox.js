import { Group, Mesh, BoxGeometry, Vector3 } from 'three';
import { bakeFlat } from '../render/geo.js';
import { makeN64Material, addLight } from '../render/n64material.js';
import { buildSky } from '../render/sky.js';
import { RGB } from '../render/palette.js';

// Phase 0/1 scaffold: a grey-box arena to move around in. No gameplay hazards
// yet. Replaced by world/basin.js (runnels/pools/patches/mold shells) in Ph3+.
export function buildGreybox() {
  const root = new Group();
  const colliders = []; // for camera collision

  const sky = buildSky();
  root.add(sky.mesh);

  const add = (geo, base, mat, x, y, z, collide = false) => {
    const m = new Mesh(bakeFlat(geo, base), mat || makeN64Material());
    m.position.set(x, y, z);
    root.add(m);
    if (collide) colliders.push(m);
    return m;
  };

  // Ground — big and flat, room to run circles.
  add(new BoxGeometry(90, 1, 90), 'slag', undefined, 0, -0.5, 0);

  // A scatter of mold-shell-ish blocks receding into the fog (cover + collision
  // for the camera). Far ones get eaten by fog.
  const rng = mulberry32(1337);
  for (let i = 0; i < 40; i++) {
    const ang = rng() * Math.PI * 2;
    const rad = 8 + rng() * 30;
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    const h = 1.2 + rng() * 4.5;
    const w = 1.2 + rng() * 2.5;
    const base = rng() > 0.5 ? 'iron' : 'slag';
    add(new BoxGeometry(w, h, w), base, undefined, x, h / 2, z, true);
  }

  // Near reference blocks so flat vertex-lit faces stay legible.
  add(new BoxGeometry(3, 3, 3), 'iron', undefined, -6, 1.5, -6, true);
  add(new BoxGeometry(2, 5, 2), 'slag', undefined, 7, 2.5, -8, true);

  // A molten runnel foreshadow — emissive bar + dynamic light lifting the fog.
  const moltenMat = makeN64Material({ emissive: 1.0 });
  add(
    new BoxGeometry(2.0, 0.25, 16),
    'molten',
    moltenMat,
    -11,
    0.12,
    -8
  );
  addLight({ position: new Vector3(-11, 0.6, -8), color: RGB.molten, range: 14, intensity: 1.0 });
  // Cool, dim kiln-sun fill so the world stays dead grey, not warm cream.
  addLight({ position: new Vector3(16, 10, -18), color: [0.5, 0.42, 0.4], range: 55, intensity: 0.22 });

  return { root, colliders, sky };
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

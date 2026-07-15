import {
  Group,
  Mesh,
  BoxGeometry,
  CapsuleGeometry,
  Vector3,
} from 'three';
import { bakeFlat } from '../render/geo.js';
import { makeN64Material, addLight } from '../render/n64material.js';
import { buildSky } from '../render/sky.js';
import { RGB } from '../render/palette.js';

// Phase 0 scaffold: an arena of grey boxes + one capsule. No gameplay.
// Purpose is purely to prove the render pipeline reads as an N64 game.
// This whole file gets replaced by world/basin.js in Phase 1+.
export function buildGreybox() {
  const root = new Group();

  const sky = buildSky();
  root.add(sky.mesh);

  const add = (geo, base, mat, x, y, z) => {
    const m = new Mesh(bakeFlat(geo, base), mat || makeN64Material());
    m.position.set(x, y, z);
    root.add(m);
    return m;
  };

  // Ground.
  add(new BoxGeometry(80, 1, 80), 'slag', undefined, 0, -0.5, 0);

  // A scatter of grey blocks receding into the fog. Far ones should be eaten.
  const rng = mulberry32(1337);
  for (let i = 0; i < 40; i++) {
    const z = -6 - i * 2.0 - rng() * 2;
    const x = (rng() * 2 - 1) * 26;
    const h = 1.2 + rng() * 4.5;
    const w = 1.2 + rng() * 2.5;
    const base = rng() > 0.5 ? 'iron' : 'slag';
    add(new BoxGeometry(w, h, w), base, undefined, x, h / 2, z);
  }

  // A couple of near reference blocks so flat vertex-lit faces are legible.
  add(new BoxGeometry(3, 3, 3), 'iron', undefined, -4, 1.5, -5);
  add(new BoxGeometry(2, 5, 2), 'slag', undefined, 4.5, 2.5, -7);

  // One capsule stand-in for Tinn.
  const tinnMat = makeN64Material();
  const tinn = new Mesh(bakeFlat(new CapsuleGeometry(0.5, 1.0, 4, 10), 'iron'), tinnMat);
  tinn.position.set(0, 1.0, 0);
  root.add(tinn);

  // A molten runnel foreshadow: a low emissive bar + a dynamic light that
  // lifts the fog from below and proves per-vertex dynamic lighting works.
  const moltenMat = makeN64Material({ emissive: 1.0 });
  const runnel = new Mesh(bakeFlat(new BoxGeometry(2.0, 0.25, 14), 'molten', { top: 1.0, floor: 0.9, variance: 0.03 }), moltenMat);
  runnel.position.set(-9, 0.12, -10);
  root.add(runnel);

  addLight({
    position: new Vector3(-9, 0.6, -10),
    color: RGB.molten,
    range: 16,
    intensity: 1.4,
  });
  // A second, cooler fill from the kiln-sun gash direction.
  addLight({
    position: new Vector3(14, 8, -18),
    color: [0.9, 0.55, 0.3],
    range: 60,
    intensity: 0.5,
  });

  return { root, tinn };
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

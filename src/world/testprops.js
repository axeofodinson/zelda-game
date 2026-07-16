// P0 §3.2/§3.4 style test. The gate: an imported asset must be indistinguishable
// in style from the palette boxes. We exercise the EXACT production import path
// (addSmoothNormals -> makeToonMaterial+LUT -> makeHull) on a flat-shaded
// displaced rock with an OFF-PALETTE colour + SPLIT normals — the exact case
// §3.4 says tears the inverted hull open.
//
// Real CC0 packs are P1's job ("P1 — Assets"); the asset hosts (Kenney/Poly
// Pizza) are network-blocked in this environment (only GitHub raw is reachable).
// See PROGRESS.md / CREDITS.md.
import * as THREE from 'three';
import { makeToonMaterial } from '../render/toon.js';
import { addSmoothNormals } from '../render/smoothNormals.js';
import { makeHull } from '../render/outline.js';
import { heightAt } from './terrain.js';

// Small standalone value-noise for the displacement.
function hash(x, y, z) {
  let h = x * 374761393 + y * 668265263 + z * 2246822519;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295 - 0.5;
}

// A flat-shaded boulder: icosphere + radial noise, non-indexed so every face
// keeps its own hard normals (split verts). OFF-PALETTE colour on purpose.
export function makeRock(lut, { radius = 4, x = 0, z = 0, seed = 1, color = '#6b6257' } = {}) {
  let geo = new THREE.IcosahedronGeometry(radius, 2);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = 0.55 * (hash(Math.round(v.x * 3 + seed), Math.round(v.y * 3), Math.round(v.z * 3))
      + 0.5 * hash(Math.round(v.x * 7), Math.round(v.y * 7 + seed), Math.round(v.z * 7)));
    v.multiplyScalar(1 + n);
    v.y *= 0.8; // squash
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo = geo.toNonIndexed();      // split verts -> hard faceted normals
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  addSmoothNormals(geo);         // §3.4 — the hull must ride these, not `normal`

  // The LUT snaps the off-palette grey-brown to rock/rockLo. Low spec so the
  // faceted highlights don't blow out.
  const mat = makeToonMaterial({ color, lut, rim: 0.3, spec: 0.25 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, heightAt(x, z) + radius * 0.55, z);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.add(makeHull(mesh, { thickness: 0.9 }));
  return mesh;
}

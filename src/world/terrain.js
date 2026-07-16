// §3.9 — Terrain. Flat colour bands by height and slope, palette-locked. Ridges
// and creases come from the §3.5 edge pass, not from geometry detail. No hull
// (does nothing on a heightmap).
//
// P0 note: this is a placeholder procedural surface so the render gate has real
// relief to draw. The authored heightmap bake is P5 (§8). Kept deliberately
// simple — one central peak, rolling ground — not the shipping terrain.
import * as THREE from 'three';
import { PC } from '../render/palette.js';
import { makeToonMaterial } from '../render/toon.js';

// Cheap value noise (hash + smooth interpolation). Deterministic.
function hash(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

export function heightAt(x, z) {
  let h = 0, amp = 1, freq = 0.012, sum = 0;
  for (let o = 0; o < 5; o++) {
    h += vnoise(x * freq + 31.4, z * freq + 12.7) * amp;
    sum += amp; amp *= 0.5; freq *= 2.0;
  }
  h = (h / sum) * 22.0 - 6.0;
  // One central peak (§8): a broad radial bump.
  const d = Math.sqrt(x * x + z * z);
  h += Math.max(0, 26 - d * 0.35) * Math.exp(-d * d / 9000);
  return h;
}

export function buildTerrain(size = 320, seg = 200) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();

  // Flat colour bands by height + slope (§3.9), written to vertex colours.
  const colors = new Float32Array(pos.count * 3);
  const n = geo.attributes.normal;
  const up = new THREE.Vector3(0, 1, 0);
  const nv = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    nv.set(n.getX(i), n.getY(i), n.getZ(i));
    const slope = 1.0 - nv.dot(up);            // 0 flat .. 1 vertical
    if (slope > 0.55) c.copy(PC.rockLo);
    else if (slope > 0.32) c.copy(PC.rock);
    else if (y > 14) c.copy(PC.rock);
    else if (y > 2) c.copy(PC.grass);
    else if (y > -2) c.copy(PC.grassLo);
    else c.copy(PC.soil);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = makeToonMaterial({ color: '#ffffff', lut: buildTerrainLUT.lut,
    vertexColors: true, rim: 0.0, spec: 0.0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.userData.isTerrain = true;
  return mesh;
}

// Terrain shares the global LUT; injected from main to avoid a second build.
export const buildTerrainLUT = { lut: null };

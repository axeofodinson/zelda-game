// P0 boot. The fixed-60Hz sim + interpolated render is a later phase (§9); here
// we only exercise the render chain: procedural sky, palette boxes on a
// heightmap, sun scrub, and the screenshot hooks the shot tool drives.
//
// URL params (all optional): hour=0..24 | sun=0..1 [az] | pos=x,y,z | look=x,y,z
//   quality=low | rock=1 (the §3.2 import test) | orbit=1
import * as THREE from 'three';
import { sky, makeSkyDome } from './render/sky.js';
import { buildPaletteLUT } from './render/lut.js';
import { makeToonMaterial } from './render/toon.js';
import { addSmoothNormals } from './render/smoothNormals.js';
import { makeHull } from './render/outline.js';
import { Pipeline } from './render/pipeline.js';
import { buildTerrain, heightAt, buildTerrainLUT } from './world/terrain.js';
import { makeRock } from './world/testprops.js';
import { P } from './render/palette.js';

const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) ? parseFloat(params.get(k)) : d);
const vec = (k, d) => (params.has(k) ? params.get(k).split(',').map(Number) : d);

const quality = params.get('quality') === 'low' ? 'low' : 'high';

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.5, 4000);

// --- Sky (§3.1) ---
if (params.has('hour')) sky.setHour(num('hour', 12));
else sky.setElevation(num('sun', 0.62), num('az', 0.55));
scene.add(makeSkyDome());

// --- Palette LUT (§3.2), shared by every material ---
const lut = buildPaletteLUT(32);
buildTerrainLUT.lut = lut;

// --- Terrain (§3.9) ---
scene.add(buildTerrain(360, 200));

// --- Palette boxes: the P0 test rig (§10 P0) ---
function addBox(colorHex, w, h, d, x, z, { rot = 0 } = {}) {
  const geo = addSmoothNormals(new THREE.BoxGeometry(w, h, d));
  const mesh = new THREE.Mesh(geo, makeToonMaterial({ color: colorHex, lut }));
  mesh.position.set(x, heightAt(x, z) + h / 2, z);
  mesh.rotation.y = rot;
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.add(makeHull(mesh)); // hull follows via parenting
  scene.add(mesh);
  return mesh;
}

// A foreground cluster (ramp, hull, creases up close) + boxes into the distance
// (aerial + line fade). One red `cloth` box — the only red in the world.
addBox(P.rock, 6, 8, 6, -8, 6);
addBox(P.wood, 4, 5, 4, -2, 9, { rot: 0.4 });
addBox(P.grass, 5, 3, 5, 6, 7);
addBox(P.metal, 3, 6, 3, 11, 4, { rot: 0.7 });
addBox(P.soil, 7, 4, 4, 2, 2, { rot: 0.2 });
addBox(P.cloth, 2.2, 3.2, 2.2, 4, 12);
addBox(P.water, 8, 2, 8, -14, -4);
addBox(P.rock, 8, 12, 8, -34, -30);
addBox(P.wood, 6, 9, 6, 30, -26, { rot: 0.5 });
addBox(P.rockLo, 10, 16, 10, -60, -70);
addBox(P.grassLo, 12, 8, 12, 70, -80);
addBox(P.rock, 14, 20, 14, -110, -120);
addBox(P.wood, 12, 22, 12, 120, -130);

// --- §3.2/§3.4 style test (?rock=1): imported-style props must be
// indistinguishable from the boxes. Off-palette colour + split normals. ---
if (params.get('rock') === '1') {
  scene.add(makeRock(lut, { radius: 4.0, x: -18, z: 30, seed: 3, color: '#9a8b76' }));
  scene.add(makeRock(lut, { radius: 2.8, x: -6, z: 34, seed: 11, color: '#4f463c' }));
}

// --- Camera ---
const camPos = vec('pos', [46, 34, 52]);
const look = vec('look', [-6, 8, -8]);
camera.position.set(camPos[0], camPos[1], camPos[2]);
camera.lookAt(look[0], look[1], look[2]);

// --- Pipeline (§3.7) ---
const pipeline = new Pipeline(renderer, scene, camera, quality);

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  pipeline.setSize(renderer.domElement.width, renderer.domElement.height);
});

// --- Screenshot hooks (§0.5) ---
const orbit = params.get('orbit') === '1';
const t0 = performance.now();
window.__setSun = (elev, az = 0.55) => sky.setElevation(elev, az);
window.__setHour = (h) => sky.setHour(h);
window.__ready = false;

function frame() {
  const t = (performance.now() - t0) / 1000;
  if (orbit) {
    const r = 70, a = t * 0.2;
    camera.position.set(Math.cos(a) * r, 30 + Math.sin(t * 0.1) * 6, Math.sin(a) * r);
    camera.lookAt(0, 10, 0);
  }
  pipeline.render();
  window.__ready = true;
  requestAnimationFrame(frame);
}
frame();

console.log('[plateau] p0 ready', { quality, sun: sky.sunDir.toArray().map((n) => +n.toFixed(2)) });

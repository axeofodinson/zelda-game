// P0 boot. The fixed-60Hz sim + interpolated render is a later phase (§9); here
// we only exercise the render chain: procedural sky, palette boxes on a
// heightmap, sun scrub, and the screenshot hooks the shot tool drives.
//
// URL params (all optional): hour=0..24 | sun=0..1 [az] | pos=x,y,z | look=x,y,z
//   quality=low | rock=1 (the §3.2 import test) | orbit=1
//   glb=<model>   P1 loader smoke test: fetch+parse one GLB, gate __ready on it
//   p1=<dist>     P1 silhouette rig: the pack lineup on flat ground at <dist> m
//   set=a,b,c     override the models in the p1 rig (set=all loads all 329)
import * as THREE from 'three';
import { sky, makeSkyDome } from './render/sky.js';
import { buildPaletteLUT } from './render/lut.js';
import { makeToonMaterial } from './render/toon.js';
import { addSmoothNormals } from './render/smoothNormals.js';
import { makeHull } from './render/outline.js';
import { Pipeline } from './render/pipeline.js';
import { buildTerrain, heightAt, buildTerrainLUT } from './world/terrain.js';
import { makeRock } from './world/testprops.js';
import { loadGLB } from './world/glb.js';
import { loadProps, placeProp, packModels, SILHOUETTE_SET, PACK } from './world/props.js';
import { P } from './render/palette.js';

const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) ? parseFloat(params.get(k)) : d);
const vec = (k, d) => (params.has(k) ? params.get(k).split(',').map(Number) : d);

const quality = params.get('quality') === 'low' ? 'low' : 'high';

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance',
  preserveDrawingBuffer: params.has('probe') }); // probe reads back the canvas
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

// The P1 silhouette rig replaces the P0 box scene: a lineup on flat ground, so
// the only thing between the camera and the sky is the prop's outline.
const p1 = params.has('p1') ? (parseFloat(params.get('p1')) || 25) : 0;

// --- Terrain (§3.9) ---
if (!p1) scene.add(buildTerrain(360, 200));

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
if (!p1) {
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
}

// --- §3.2/§3.4 style test (?rock=1): imported-style props must be
// indistinguishable from the boxes. Off-palette colour + split normals. ---
if (params.get('rock') === '1' && !p1) {
  scene.add(makeRock(lut, { radius: 4.0, x: -18, z: 30, seed: 3, color: '#9a8b76' }));
  scene.add(makeRock(lut, { radius: 2.8, x: -6, z: 34, seed: 11, color: '#4f463c' }));
}

// --- Camera ---
// The p1 rig frames the lineup from exactly <dist> metres, eye at mid-height.
const camPos = vec('pos', p1 ? [0, 4.5, p1] : [46, 34, 52]);
const look = vec('look', p1 ? [0, 3.5, 0] : [-6, 8, -8]);
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

// --- P1 asset ingest (§10). Both paths gate `__ready` on the load finishing,
// so "did the loader hang" is a question the instrument can answer instead of a
// hypothesis — P0's GLB load hung __ready with no pageerror. ---
let gate = null;

// ?glb=<model> — loader smoke test. Fetch + parse one file, nothing else.
if (params.has('glb')) {
  gate = { done: false };
  loadGLB(params.get('glb')).then(({ gltf, info }) => {
    let meshes = 0, tris = 0;
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      const g = o.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    console.log(`[plateau] glb ok ${info.url} status=${info.status} type=${info.type} bytes=${info.bytes} ms=${info.ms} meshes=${meshes} tris=${tris}`);
    gate.done = true;
  }).catch((e) => {
    console.error('[plateau] glb FAILED', e.message, JSON.stringify(e.info || {}));
    gate.done = true;
  });
}

// ?p1=<dist> — the silhouette rig. Flat ground, the pack lineup across frame.
if (p1) {
  gate = { done: false };
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
    makeToonMaterial({ color: P.grassLo, lut, rim: 0.0, spec: 0.0 })
  );
  ground.receiveShadow = true;
  scene.add(ground);

  const arg = params.get('set');
  const all = arg === 'all';
  const namesP = all ? packModels() : Promise.resolve(arg ? arg.split(',') : SILHOUETTE_SET);
  namesP.then((names) => loadProps(names, { lut }).then(({ props, failed }) => {
    // One row for the silhouette rig; a grid when the whole pack is loaded.
    const span = 5.5;
    const cols = all ? Math.ceil(Math.sqrt(props.length)) : props.length;
    const x0 = -((cols - 1) * span) / 2;
    const z0 = all ? ((Math.ceil(props.length / cols) - 1) * span) / 2 : 0;
    props.forEach((prop, i) => {
      const col = i % cols, row = (i / cols) | 0;
      scene.add(placeProp(prop, x0 + col * span, 0, z0 - row * span));
      if (all) return;
      const s = prop.userData.stats;
      const size = prop.userData.size;
      console.log(`[plateau] prop ${prop.name}  ${size.x.toFixed(2)}x${size.y.toFixed(2)}x${size.z.toFixed(2)}m  meshes=${s.meshes} tris=${s.tris} uvDropped=${s.uvsDropped} mats=${[...s.materials.keys()].join('+')}${s.unmapped.size ? ' UNMAPPED=' + [...s.unmapped].join(',') : ''}`);
    });
    for (const f of failed) console.error(`[plateau] prop FAILED ${f.name}: ${f.error}`);
    const tot = props.reduce((a, p) => {
      a.meshes += p.userData.stats.meshes; a.tris += p.userData.stats.tris;
      a.uv += p.userData.stats.uvsDropped;
      for (const m of p.userData.stats.unmapped) a.unmapped.add(m);
      for (const m of p.userData.stats.materials.keys()) a.mats.add(m);
      return a;
    }, { meshes: 0, tris: 0, uv: 0, mats: new Set(), unmapped: new Set() });
    console.log(`[plateau] pack ${PACK.id} scale=${PACK.scale} loaded=${props.length}/${names.length} meshes=${tot.meshes} tris=${tot.tris} uvDropped=${tot.uv} materials=${tot.mats.size} unmapped=${tot.unmapped.size ? [...tot.unmapped].join(',') : 'none'}`);
    gate.done = true;
  })).catch((e) => { console.error('[plateau] pack FAILED', e.message); gate.done = true; });
}

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
  if (!gate || gate.done) window.__ready = true;
  requestAnimationFrame(frame);
}
frame();

console.log('[plateau] p0 ready', { quality, sun: sky.sunDir.toArray().map((n) => +n.toFixed(2)) });

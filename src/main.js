import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Color,
  ColorManagement,
  LinearSRGBColorSpace,
} from 'three';
// Stylized retro: no automatic color management. Palette values are the pixels.
ColorManagement.enabled = false;
import { Pipeline } from './render/pipeline.js';
import { uploadLights } from './render/n64material.js';
import { RGB } from './render/palette.js';
import { buildGreybox } from './world/greybox.js';

const canvas = document.getElementById('app');

const renderer = new WebGLRenderer({
  canvas,
  antialias: false, // §2.7 — never
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(1);
renderer.outputColorSpace = LinearSRGBColorSpace; // we manage color ourselves
// Clear alpha MUST be 0: the alpha channel is the bloom's emissive mask, so a
// cleared (alpha-1) sky would bloom itself to white. RGB is still the ash sky.
renderer.setClearColor(new Color().setRGB(...RGB.ash), 0);

const scene = new Scene();
scene.background = null; // sky comes from the (alpha-0) clear, not a fill

const camera = new PerspectiveCamera(55, 1, 0.1, 90);
camera.position.set(0, 3.2, 8);

const pipeline = new Pipeline(renderer);

const gb = buildGreybox();
scene.add(gb.root);
const tinnMesh = gb.tinn;

// ---- Fixed-timestep loop (§9): 60Hz sim, interpolated render ----------------
const STEP = 1 / 60;
let acc = 0;
let last = performance.now() / 1000;
let simTime = 0;

function fixedUpdate(dt) {
  simTime += dt;
  // Phase 0 has no gameplay; animate the camera + capsule so the gate can
  // confirm the scene is actually live (3 shots 500ms apart must differ).
  const a = simTime * 0.25;
  camera.position.set(
    Math.sin(a) * 8.5,
    3.2 + Math.sin(simTime * 0.6) * 0.4,
    Math.cos(a) * 8.5
  );
  camera.lookAt(0, 1.2, -6);
  if (tinnMesh) tinnMesh.position.y = 1.0 + Math.sin(simTime * 1.5) * 0.08;
}

function frame() {
  const now = performance.now() / 1000;
  let elapsed = now - last;
  last = now;
  if (elapsed > 0.25) elapsed = 0.25; // spiral-of-death guard
  acc += elapsed;
  while (acc >= STEP) {
    fixedUpdate(STEP);
    acc -= STEP;
  }
  uploadLights(camera.position);
  pipeline.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---- Resize -----------------------------------------------------------------
function resize() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---- Debug: resolution toggle (§2.1) ---------------------------------------
window.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') pipeline.toggleResolution();
});

// Tiny hook for the Playwright verification gate.
window.__CINDERCAST__ = { ready: true, pipeline, renderer };

requestAnimationFrame(frame);

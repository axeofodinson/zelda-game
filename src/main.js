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
import { CAMERA } from './config/feel.js';
import { buildGreybox } from './world/greybox.js';
import { Input } from './systems/input.js';
import { CameraRig } from './systems/camera.js';
import { Tinn } from './actors/tinn.js';
import { FX } from './fx/fx.js';

const canvas = document.getElementById('app');
const params = new URLSearchParams(location.search);
const DEMO = params.has('demo');

const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.outputColorSpace = LinearSRGBColorSpace;
renderer.setClearColor(new Color().setRGB(...RGB.ash), 0);

const scene = new Scene();
scene.background = null;

const camera = new PerspectiveCamera(CAMERA.fov, 1, 0.1, 90);
const pipeline = new Pipeline(renderer);

const { root: world, colliders } = buildGreybox();
scene.add(world);

const fx = new FX(scene);
const input = new Input(canvas);
const cameraRig = new CameraRig(camera);
cameraRig.setColliders(colliders);

const tinn = new Tinn();
tinn.addToScene(scene);
cameraRig.pos.set(0, CAMERA.free.height, CAMERA.free.distance);

// ---- fixed-timestep loop (§9) ----------------------------------------------
const STEP = 1 / 60;
let acc = 0;
let last = performance.now() / 1000;
let demoT = 0;
let demoRoll = 0;

function fixedUpdate(dt) {
  const basis = cameraRig.groundBasis();
  tinn.update(dt, input, basis, fx);
  cameraRig.update(dt, tinn.position, tinn.velocity);
  fx.update(dt, camera.position);
}

function driveDemo(elapsed) {
  demoT += elapsed;
  demoRoll += elapsed;
  // Orbit the aim slowly so camera-relative "forward" sweeps a circle.
  cameraRig.yaw += 0.5 * elapsed;
  input.move.set(0, 1); // hold forward
  if (demoRoll > 2.4) {
    demoRoll = 0;
    input.pressed.add(' '); // roll
  }
}

function frame() {
  const now = performance.now() / 1000;
  let elapsed = now - last;
  last = now;
  if (elapsed > 0.25) elapsed = 0.25;

  if (DEMO) driveDemo(elapsed);
  else input.begin();
  cameraRig.applyLook(input.mouse);

  acc += elapsed;
  while (acc >= STEP) {
    fixedUpdate(STEP);
    acc -= STEP;
  }
  input.end();

  uploadLights(camera.position);
  pipeline.render(scene, camera);
  requestAnimationFrame(frame);
}

function resize() {
  const w = canvas.clientWidth || innerWidth;
  const h = canvas.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') pipeline.toggleResolution();
});

window.__CINDERCAST__ = { ready: true, tinn, cameraRig };
requestAnimationFrame(frame);

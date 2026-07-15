import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Color,
  ColorManagement,
  LinearSRGBColorSpace,
} from 'three';
ColorManagement.enabled = false;
import { Pipeline } from './render/pipeline.js';
import { uploadLights } from './render/n64material.js';
import { RGB } from './render/palette.js';
import { CAMERA } from './config/feel.js';
import { MELT } from './config/heat.js';
import { buildGreybox } from './world/greybox.js';
import { Input } from './systems/input.js';
import { CameraRig } from './systems/camera.js';
import { Tinn } from './actors/tinn.js';
import { Knell } from './actors/knell.js';
import { FX } from './fx/fx.js';
import { TinnHeat } from './systems/heat.js';
import { LockOn } from './systems/lockon.js';
import { Combat } from './systems/combat.js';
import { Dummy } from './actors/enemies/dummy.js';

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

const heat = new TinnHeat();
const tinn = new Tinn();
tinn.addToScene(scene);
const knell = new Knell();
knell.addToScene(scene);

// Enemies — a couple of training dummies that report heat by their glow.
const enemies = [new Dummy([0, 0, -6], 80), new Dummy([4, 0, -9], 80)];
for (const e of enemies) scene.add(e.root);
const getEnemies = () => enemies;

const lockon = new LockOn(getEnemies, { range: 15 });

// ---- feel hooks (§8) — hitstop + kill slowmo + shake + punch ----------------
let hitstopUntil = 0;
let slowUntil = 0;
let slowEaseUntil = 0;
const feel = {
  shake: (m) => cameraRig.addShake(m),
  punch: () => cameraRig.punch(),
  hitstop: (ms) => { hitstopUntil = Math.max(hitstopUntil, performance.now() + ms); },
  tink: () => {},
  onKill: (e) => {
    fx.verdigrisFlakes(e.position);
    slowUntil = performance.now() + 200;
    slowEaseUntil = slowUntil + 300;
  },
};

const combat = new Combat({ tinn, heat, fx, getEnemies, lockon, feel });
tinn.setCombat(combat);

// ---- fixed-timestep loop ----------------------------------------------------
const STEP = 1 / 60;
let acc = 0;
let last = performance.now() / 1000;
let demoT = 0, demoAtk = 0;

function timeScaleNow() {
  const now = performance.now();
  if (now < slowUntil) return 0.25;
  if (now < slowEaseUntil) return 0.25 + 0.75 * (1 - (slowEaseUntil - now) / 300);
  return 1;
}

function fixedUpdate(dt) {
  lockon.update(input.lockHeld, tinn.position);
  const basis = cameraRig.groundBasis();
  tinn.update(dt, input, { basis, fx, heat, lockon });
  heat.update(dt, {}); // env hazards arrive in Phase 3
  for (const e of enemies) e.update(dt);
  const shoulder = tinn.position.clone();
  shoulder.y += 1.1;
  shoulder.x += Math.sin(tinn.root.rotation.y) * -0.3 + Math.cos(tinn.root.rotation.y) * 0.35;
  shoulder.z += Math.cos(tinn.root.rotation.y) * -0.3 - Math.sin(tinn.root.rotation.y) * 0.35;
  const lockT = lockon.active ? lockon.target : null;
  knell.update(dt, shoulder, lockT, lockT ? lockT.glow : 0);
  cameraRig.update(dt, tinn.position, tinn.velocity, lockT ? lockT.position : null);
  fx.update(dt, camera.position);
}

function driveDemo(elapsed) {
  demoT += elapsed;
  demoAtk += elapsed;
  input.down.add('shift'); // hold lock
  const d = enemies[0];
  const toE = d.position.clone().sub(tinn.position); toE.y = 0;
  const dist = toE.length();
  if (dist > 2.4) {
    const basis = cameraRig.groundBasis();
    // move toward the dummy in camera-relative space
    const f = basis.forward, r = basis.right;
    input.move.set(toE.dot(r) > 0 ? 0.4 : -0.4, 0.9);
  } else {
    input.move.set(0, 0);
    if (demoAtk > 0.42 && combat.state === 'idle') {
      demoAtk = 0;
      if (heat.blade >= 80) combat.forceVent();
      else combat.forceSlash();
    }
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

  const frozen = performance.now() < hitstopUntil;
  if (!frozen) {
    acc += elapsed * timeScaleNow();
    while (acc >= STEP) { fixedUpdate(STEP); acc -= STEP; }
  }
  input.end();

  // Melt desaturation toward molten (§3.2 Failing).
  const mf = heat.meltFactor;
  pipeline.postMat.uniforms.uDesat.value = Math.max(0, Math.min(1, (mf - MELT.failingAt / 100) / 0.15));

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
addEventListener('keydown', (e) => { if (e.key === 'f' || e.key === 'F') pipeline.toggleResolution(); });

// Debug hooks for the verification gate.
window.__CINDERCAST__ = {
  ready: true, tinn, cameraRig, combat, heat, enemies, fx, pipeline, lockon,
  setBlade: (v) => (heat.blade = v),
  forceVent: () => combat.forceVent(),
  forceSlash: () => combat.forceSlash(),
  placeAtDummy: () => { tinn.root.position.set(0, 0, -3.6); tinn.root.rotation.y = Math.PI; },
  overhead: (h) => cameraRig.setOverhead(h),
  dummyHeat: () => enemies[0].heat,
};
requestAnimationFrame(frame);

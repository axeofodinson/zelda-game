import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Color,
  ColorManagement,
  LinearSRGBColorSpace,
  Vector3,
} from 'three';
ColorManagement.enabled = false;
import { Pipeline } from './render/pipeline.js';
import { uploadLights } from './render/n64material.js';
import { RGB } from './render/palette.js';
import { CAMERA } from './config/feel.js';
import { MELT } from './config/heat.js';
import { Basin } from './world/basin.js';
import { Platforms } from './systems/platforms.js';
import { Input } from './systems/input.js';
import { CameraRig } from './systems/camera.js';
import { Tinn } from './actors/tinn.js';
import { Knell } from './actors/knell.js';
import { FX } from './fx/fx.js';
import { TinnHeat } from './systems/heat.js';
import { LockOn } from './systems/lockon.js';
import { Combat } from './systems/combat.js';
import { Flasks } from './systems/flask.js';
import { Audio } from './audio/ambience.js';
import { bellCentroid, bellParams } from './audio/bell.js';
import { Cull } from './actors/enemies/cull.js';
import { Sprue } from './actors/enemies/sprue.js';
import { Flashling } from './actors/enemies/flashling.js';
import { Crucible } from './actors/enemies/crucible.js';
import { OrantArena } from './world/orant_arena.js';
import { Orant } from './actors/enemies/orant.js';

const canvas = document.getElementById('app');
const params = new URLSearchParams(location.search);
const DEMO = params.has('demo');
const BOSS = params.has('boss');

const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.outputColorSpace = LinearSRGBColorSpace;
renderer.setClearColor(new Color().setRGB(...RGB.ash), 0);

const scene = new Scene();
scene.background = null;
const camera = new PerspectiveCamera(CAMERA.fov, 1, 0.1, 90);
const pipeline = new Pipeline(renderer);

const platforms = new Platforms();
const arena = BOSS ? new OrantArena(platforms) : new Basin(platforms);
scene.add(arena.root);

const fx = new FX(scene);
const input = new Input(canvas);
const cameraRig = new CameraRig(camera);
cameraRig.setColliders(arena.colliders);

const heat = new TinnHeat();
const tinn = new Tinn();
tinn.addToScene(scene);
const knell = new Knell();
knell.addToScene(scene);
const flasks = new Flasks(scene);

// Enemies — the vertical-slice arena, or the Orant boss.
let orant = null;
let enemies;
if (BOSS) {
  orant = new Orant(scene, arena);
  enemies = orant.enemies();
  tinn.root.position.set(0, 0, 10);
} else {
  enemies = [new Cull([-4, 0, -8]), new Sprue([8, 0, -16]), new Crucible([-2, 0, -14])];
  for (let i = 0; i < 6; i++) enemies.push(new Flashling([3 + i * 0.4, 1.6, -6], (i / 6) * Math.PI * 2));
  for (const e of enemies) scene.add(e.root);
}
const getEnemies = () => enemies;

const lockon = new LockOn(getEnemies, { range: 16 });

// ---- feel hooks -------------------------------------------------------------
let hitstopUntil = 0, slowUntil = 0, slowEaseUntil = 0;
const feel = {
  shake: (m) => cameraRig.addShake(m),
  punch: () => cameraRig.punch(),
  hitstop: (ms) => { hitstopUntil = Math.max(hitstopUntil, performance.now() + ms); },
  tink: () => {},
  onKill: (e) => { fx.verdigrisFlakes(e.position); slowUntil = performance.now() + 200; slowEaseUntil = slowUntil + 300; },
};

const audio = new Audio();
feel.clang = () => audio.clang();
feel.tink = () => audio.tink();
feel.swing = () => audio.swing();
feel.steam = () => audio.steam();
const startAudio = () => audio.start();
addEventListener('keydown', startAudio, { once: true });
addEventListener('pointerdown', startAudio, { once: true });

const combat = new Combat({ tinn, heat, fx, getEnemies, lockon, feel });
tinn.setCombat(combat);

const hurtTinn = (amt) => { if (!tinn.invuln) heat.hurt(amt); };
const initialHeat = enemies.reduce((s, e) => s + e.maxHeat, 0);
let prevTarget = null;

// ---- loop -------------------------------------------------------------------
const STEP = 1 / 60;
let acc = 0, last = performance.now() / 1000;
let demoAtk = 0;

function timeScaleNow() {
  const now = performance.now();
  if (now < slowUntil) return 0.25;
  if (now < slowEaseUntil) return 0.25 + 0.75 * (1 - (slowEaseUntil - now) / 300);
  return 1;
}

function respawnIfMelted() {
  if (heat.melt >= MELT.max) {
    const s = arena.nearestSpawn(tinn.position);
    tinn.root.position.set(s.x, 0, s.z);
    tinn.velocity.set(0, 0, 0);
    heat.melt = 0;
    heat.blade = 0;
    heat.timeSinceHit = 0;
  }
}

function fixedUpdate(dt) {
  lockon.update(input.lockHeld, tinn.position);
  const basis = cameraRig.groundBasis();
  tinn.update(dt, input, { basis, fx, heat, lockon, platforms });

  if (input.wasPressed('1')) {
    const dir = new Vector3(Math.sin(tinn.root.rotation.y), 0, Math.cos(tinn.root.rotation.y));
    flasks.throw(new Vector3(tinn.position.x, 1.0, tinn.position.z), dir);
  }

  const env = arena.envAt(tinn.position.x, tinn.position.z);
  heat.update(dt, env);
  // Boss Phase 2: the pit floor is death unless you're up on a cooled hand.
  if (arena.floorHazard) {
    const fh = arena.floorHazard(tinn.position.x, tinn.position.z, tinn.root.position.y);
    if (fh) hurtTinn(fh * dt);
  }
  respawnIfMelted();

  const ectx = {
    dt, tinn, fx, feel, playerPos: tinn.position,
    runnelAt: (x, z) => arena.runnelAt(x, z),
    runnels: arena.runnels, platforms,
    hurtTinn, addHandprint: (x, z) => arena.addHandprint(x, z),
    getEnemies,
  };
  for (const e of enemies) e.update(ectx);
  if (orant) orant.update(ectx);
  arena.update(dt);
  arena.emitEmbers(fx);
  flasks.update(dt, { fx, feel, getEnemies, playerPos: tinn.position, hurtTinn });

  const shoulder = tinn.position.clone();
  shoulder.y += 1.1;
  const lockT = lockon.active ? lockon.target : null;
  knell.update(dt, shoulder, lockT, lockT ? lockT.glow : 0);

  // Knell rings + sounds at the locked target; pitch tracks its heat (§7).
  if (lockT) {
    if (lockT !== prevTarget) {
      fx.knellRing({ x: lockT.position.x, y: lockT.position.y + 1.4, z: lockT.position.z });
      audio.ring(lockT.glow, true);
    } else {
      audio.ring(lockT.glow); // throttled inside; you hear it cool as you slash
    }
  }
  prevTarget = lockT;
  const totalHeat = enemies.reduce((s, e) => s + (e.dead ? 0 : e.heat), 0);
  audio.setTension(initialHeat ? totalHeat / initialHeat : 0);
  cameraRig.update(dt, tinn.position, tinn.velocity, lockT ? lockT.position : null);
  fx.update(dt, camera.position);
}

function driveDemo(elapsed) {
  demoAtk += elapsed;
  input.down.add('shift');
  const live = enemies.filter((e) => !e.dead);
  if (!live.length) { input.move.set(0, 0); return; }
  let near = live[0], nd = Infinity;
  for (const e of live) { const d = e.position.distanceTo(tinn.position); if (d < nd) { nd = d; near = e; } }
  if (nd > 2.6) {
    const basis = cameraRig.groundBasis();
    const to = near.position.clone().sub(tinn.position); to.y = 0;
    input.move.set(to.dot(basis.right) > 0 ? 0.5 : -0.5, 0.9);
  } else {
    input.move.set(0, 0);
    if (demoAtk > 0.7 && combat.state === 'idle') { demoAtk = 0; heat.blade >= 82 ? combat.forceVent() : combat.forceSlash(); }
  }
}

function frame() {
  const now = performance.now() / 1000;
  let elapsed = now - last; last = now;
  if (elapsed > 0.25) elapsed = 0.25;
  if (DEMO) driveDemo(elapsed); else input.begin();
  cameraRig.applyLook(input.mouse);

  if (performance.now() >= hitstopUntil) {
    acc += elapsed * timeScaleNow();
    while (acc >= STEP) { fixedUpdate(STEP); acc -= STEP; }
  }
  input.end();

  const mf = heat.meltFactor;
  pipeline.postMat.uniforms.uDesat.value = Math.max(0, Math.min(1, (mf - MELT.failingAt / 100) / 0.15));
  uploadLights(camera.position);
  pipeline.render(scene, camera);
  requestAnimationFrame(frame);
}

function resize() {
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
addEventListener('keydown', (e) => { if (e.key === 'f' || e.key === 'F') pipeline.toggleResolution(); });

window.__CINDERCAST__ = {
  ready: true, tinn, cameraRig, combat, heat, enemies, fx, pipeline, lockon, arena, platforms,
  orant, getEnemies,
  setBlade: (v) => (heat.blade = v),
  forceVent: () => combat.forceVent(),
  forceSlash: () => combat.forceSlash(),
  overhead: (h) => cameraRig.setOverhead(h),
  killEnemy: (i) => { const e = enemies[i]; if (e && !e.dead) e.cool(e.heat + 999); },
  standOn: (i) => {
    const e = enemies[i];
    tinn.root.position.set(e.position.x, 3, e.position.z);
    return { enemyTop: e.standSize.h };
  },
  tinnY: () => tinn.root.position.y,
  detonateFlask: (x, z) =>
    flasks._detonate(new Vector3(x, 0.4, z), { fx, feel, getEnemies, playerPos: tinn.position, hurtTinn }),
  exposeCrucible: (i) => { const e = enemies[i]; e.mode = 'stunned'; e.mt = 0; e.exposed = true; e.coolable = [e._topSphere]; },
  audio,
  bellCentroid,
  bellParams,
  feelState: () => ({
    hitstop: performance.now() < hitstopUntil,
    slow: timeScaleNow() < 1,
    timeScale: timeScaleNow(),
    squashY: tinn.squashY,
  }),
  triggerHitstop: (ms) => feel.hitstop(ms),
  triggerKillSlow: () => feel.onKill(enemies.find((e) => !e.dead) || enemies[0]),
};
requestAnimationFrame(frame);

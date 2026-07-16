// §3.1 — Sky drives everything. One procedural gradient keyed by sun elevation
// with a warm lobe near the sun. Every material, the fog, and the grass read
// sunColor / ambientSky / fogColor from here. Change the hour, the world moves.
import * as THREE from 'three';
import { PC } from './palette.js';

// Working colours reused each sample to avoid per-frame allocation.
const _c = new THREE.Color();
const _horizon = new THREE.Color();
const _zenith = new THREE.Color();

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function smooth(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

// The single source of truth for lighting state. Shared uniforms are handed to
// every toon material and post pass; mutating these + calling update() swings
// the whole render together.
export const sky = {
  sunDir: new THREE.Vector3(0.4, 0.6, 0.35).normalize(),
  sunColor: new THREE.Color(),   // lit tone
  ambientSky: new THREE.Color(),  // shadow tone — BLUE, never grey
  fogColor: new THREE.Color(),    // horizon
  zenithColor: new THREE.Color(),
  horizonColor: new THREE.Color(),

  // Uniform bundle referenced by every material (§3.1). One object, one update.
  uniforms: {
    uSunDir:     { value: new THREE.Vector3() },
    uSunColor:   { value: new THREE.Color() },
    uAmbientSky: { value: new THREE.Color() },
    uFogColor:   { value: new THREE.Color() },
    uZenith:     { value: new THREE.Color() },
    uHorizon:    { value: new THREE.Color() },
    // §3.6 aerial density, shared by toon/outline/edge so it tunes in one place.
    // Higher than the spec's 0.0022 because the P0 test terrain is only ~360m;
    // "push until distant terrain is nearly featureless" (§3.6). Retune at P5.
    uAerial:     { value: 0.0030 },
  },

  // Sample the sky in a direction. Mirrors the dome shader exactly so JS-side
  // lighting and the rendered background agree.
  sample(dir, out = _c) {
    const up = clamp01(dir.y * 0.5 + 0.5);
    const grad = smooth(0.0, 0.55, dir.y); // horizon->zenith blend
    out.copy(_horizon).lerp(_zenith, grad);
    // Warm lobe near the sun.
    const d = clamp01(dir.dot(this.sunDir));
    const lobe = Math.pow(d, 6.0) * this.sunLobeStrength;
    out.lerp(PC.sun, clamp01(lobe));
    return out;
  },

  // elev is sin(elevation angle) = the final sunDir.y. 1 = overhead, 0 = horizon.
  setElevation(elev, azimuth = 0.55) {
    const e = Math.max(0.02, Math.min(1, elev));
    const h = Math.sqrt(Math.max(0, 1 - e * e));
    this.sunDir.set(Math.cos(azimuth) * h, e, Math.sin(azimuth) * h).normalize();
    this.update();
  },

  // Convenience: hour of day 6..18 -> a RAKING key light. Peak stays well off
  // vertical (0.82, not 1.0): an overhead sun puts every vertical face at the
  // ramp midpoint and the two bands collapse. Illustrators never light from
  // straight up either.
  setHour(hour) {
    const t = clamp01((hour - 6) / 12);       // 0 at 6am, 1 at 6pm
    const elev = Math.sin(t * Math.PI) * 0.82; // peak 0.82 at noon
    const az = 0.25 + t * 1.7;                  // sweep east -> west
    this.setElevation(elev, az);
  },

  update() {
    const elev = this.sunDir.y;               // 0 horizon .. 1 zenith
    const day = smooth(0.05, 0.45, elev);     // 0 at dusk, 1 at midday
    this.sunLobeStrength = 0.85 * (1.0 - day * 0.55); // fatter lobe at low sun

    // Zenith: day blue deepening slightly as sun climbs.
    this.zenithColor.copy(PC.skyDay).multiplyScalar(0.72 + 0.28 * day);
    // Horizon: warm dusk orange at low sun, pale blue by midday.
    this.horizonColor.copy(PC.skyDusk).lerp(PC.skyDay, day);

    _zenith.copy(this.zenithColor);
    _horizon.copy(this.horizonColor);

    // Lit tone: the near-sun sky, warmed toward `sun`. Warmer, dimmer at dusk.
    this.sample(this.sunDir, this.sunColor);
    this.sunColor.lerp(PC.sun, 0.5 + 0.3 * (1 - day));
    this.sunColor.multiplyScalar(0.85 + 0.35 * day);

    // Shadow tone: the zenith sky. BLUE, never grey (§11). Never let it go flat.
    this.ambientSky.copy(this.zenithColor).multiplyScalar(0.75);
    // Nudge saturation toward blue so overcast midday shadows stay chromatic.
    this.ambientSky.b = Math.min(1, this.ambientSky.b * 1.12 + 0.04);

    // Fog: the horizon tone, where distance dissolves to.
    this.sample(new THREE.Vector3(this.sunDir.x, 0.05, this.sunDir.z).normalize(), this.fogColor);
    this.fogColor.lerp(this.horizonColor, 0.5);

    // Push into the shared uniform bundle.
    const u = this.uniforms;
    u.uSunDir.value.copy(this.sunDir);
    u.uSunColor.value.copy(this.sunColor);
    u.uAmbientSky.value.copy(this.ambientSky);
    u.uFogColor.value.copy(this.fogColor);
    u.uZenith.value.copy(this.zenithColor);
    u.uHorizon.value.copy(this.horizonColor);
  },
};

// A big inward-facing dome that reproduces sample() in-shader for the
// background. Kept in sync with the JS model through the shared uniforms.
export function makeSkyDome() {
  const geo = new THREE.SphereGeometry(4000, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: sky.uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uSunDir, uSunColor, uZenith, uHorizon;
      varying vec3 vDir;
      float smooth3(float a, float b, float x){ float t = clamp((x-a)/(b-a),0.0,1.0); return t*t*(3.0-2.0*t); }
      void main() {
        vec3 dir = normalize(vDir);
        float grad = smooth3(0.0, 0.55, dir.y);
        vec3 col = mix(uHorizon, uZenith, grad);
        float d = clamp(dot(dir, uSunDir), 0.0, 1.0);
        // disc + warm lobe
        col = mix(col, uSunColor, clamp(pow(d, 6.0) * 0.85, 0.0, 1.0));
        col = mix(col, vec3(1.0), smoothstep(0.9975, 0.9990, d));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(geo, mat);
  dome.frustumCulled = false;
  dome.renderOrder = -1000;
  dome.userData.isSky = true; // excluded from prepass + shadow passes
  return dome;
}

sky.update();

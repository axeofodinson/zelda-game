// §3.4 — Inverted-hull outlines. Front-face culled (render back faces), `ink`,
// depth-write on, before the main pass. Three load-bearing things:
//   · thickness × depth  → constant screen-space width
//   · smoothNormal (baked) → the hull doesn't tear at hard corners
//   · weight by N·L      → heavier where the form turns from the light
import * as THREE from 'three';
import { PC } from './palette.js';
import { sky } from './sky.js';

const VERT = /* glsl */ `
  in vec3 smoothNormal;
  uniform vec3 uSunDir;
  uniform float uThickness;
  uniform float uWindup;      // §6.5: telegraph flares the line during windup
  out float vDist;
  void main() {
    vec3 sN = normalize(normalMatrix * smoothNormal);
    vec3 viewLightDir = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
    vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
    float depth = -viewPos.z;
    vDist = depth;
    float weight = mix(1.45, 0.65, dot(sN, viewLightDir) * 0.5 + 0.5);
    float t = uThickness * (1.0 + uWindup * 2.5);
    viewPos.xyz += sN * (0.0022 * depth * weight * t);
    gl_Position = projectionMatrix * viewPos;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uInk, uFogColor, uWindupTint;
  uniform float uWindup, uAerial;
  in float vDist;
  out vec4 pFragColor;
  void main() {
    // §3.6 — fade ink into the fog with distance so far hills don't tangle into
    // a black scribble. The line-opacity fade the two failure modes hinge on.
    float aer = 1.0 - exp(-vDist * uAerial);
    vec3 ink = mix(uInk, uWindupTint, uWindup * 0.7);   // flare warms on windup
    vec3 col = mix(ink, uFogColor, aer * 0.92);
    pFragColor = vec4(col, 1.0);
  }
`;

export function makeOutlineMaterial({ thickness = 1.0 } = {}) {
  const uniforms = Object.assign({}, {
    uSunDir:   sky.uniforms.uSunDir,
    uFogColor: sky.uniforms.uFogColor,
    uAerial:   sky.uniforms.uAerial,
  }, {
    uInk:        { value: PC.ink.clone() },
    uWindupTint: { value: PC.sear.clone() },
    uThickness:  { value: thickness },
    uWindup:     { value: 0.0 },
  });
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,   // front-face culled
    depthWrite: true,
    depthTest: true,
  });
}

// Build a hull mesh that shares geometry with `mesh` (must carry smoothNormal).
export function makeHull(mesh, opts = {}) {
  const hull = new THREE.Mesh(mesh.geometry, makeOutlineMaterial(opts));
  hull.renderOrder = (mesh.renderOrder || 0) - 0.5; // before the main pass
  hull.frustumCulled = mesh.frustumCulled;
  hull.castShadow = false;
  hull.receiveShadow = false;
  hull.userData.isHull = true;
  return hull;
}

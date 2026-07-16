// §3.5 — Interior lines. The hull gives silhouettes only; creases need a post
// pass over a depth+normal prepass (Roberts cross). §3.6 fades the line with
// distance. Thresholds SCALE BY DEPTH — a fixed threshold turns the horizon into
// a black scribble.
import * as THREE from 'three';
import { sky } from './sky.js';
import { PC } from './palette.js';

// Prepass override material: view normal in rgb, eye-space depth (metres) in a.
export function makeNormalDepthMaterial() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: /* glsl */ `
      out vec3 vViewNormal;
      out float vViewDepth;
      void main() {
        vViewNormal = normalize(normalMatrix * normal);
        vec4 vp = modelViewMatrix * vec4(position, 1.0);
        vViewDepth = -vp.z;
        gl_Position = projectionMatrix * vp;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      in vec3 vViewNormal;
      in float vViewDepth;
      out vec4 pFragColor;
      void main() {
        pFragColor = vec4(normalize(vViewNormal) * 0.5 + 0.5, vViewDepth);
      }`,
  });
}

// Full-screen edge detect + composite over the beauty buffer.
export function makeEdgeMaterial() {
  const uniforms = Object.assign({
    uScene:       { value: null },
    uNormalDepth: { value: null },
    uTexel:       { value: new THREE.Vector2(1 / 960, 1 / 720) },
    uDepthThresh: { value: 0.015 },
    uNormalThresh: { value: 0.34 },
    uInk:         { value: PC.ink.clone() },
  }, { uFogColor: sky.uniforms.uFogColor, uAerial: sky.uniforms.uAerial });

  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `
      out vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D uScene, uNormalDepth;
      uniform vec2 uTexel;
      uniform float uDepthThresh, uNormalThresh, uAerial;
      uniform vec3 uInk, uFogColor;
      in vec2 vUv;
      out vec4 pFragColor;

      void main() {
        vec3 beauty = texture(uScene, vUv).rgb;

        // Roberts cross: 2x2 diagonal taps.
        vec4 s00 = texture(uNormalDepth, vUv);
        vec4 s10 = texture(uNormalDepth, vUv + vec2(uTexel.x, 0.0));
        vec4 s01 = texture(uNormalDepth, vUv + vec2(0.0, uTexel.y));
        vec4 s11 = texture(uNormalDepth, vUv + uTexel);

        float d0 = max(s00.a, 0.0001);
        float gd = length(vec2(s00.a - s11.a, s10.a - s01.a));
        float gn = length(s00.rgb - s11.rgb) + length(s10.rgb - s01.rgb);

        // depthThresh scaled by depth (§3.5) — the whole point.
        float edge = max(step(uDepthThresh * d0, gd), step(uNormalThresh, gn));

        // §3.6 — fade the line with distance so far terrain flattens to bands.
        float aer = 1.0 - exp(-d0 * uAerial);
        float lineA = edge * (1.0 - aer);
        vec3 ink = mix(uInk, uFogColor, aer * 0.92);

        pFragColor = vec4(mix(beauty, ink, lineA), 1.0);
      }`,
  });
}

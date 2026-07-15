import { ShaderMaterial, Vector3, Color, DoubleSide, FrontSide } from 'three';
import { RGB } from './palette.js';

// ---------------------------------------------------------------------------
// N64 vertex-lit material.
//
// The whole era hinges on this: NO per-pixel lighting. Static light is baked
// into the `color` vertex attribute at geometry-build time. Dynamic lights
// (runnels, glowing enemies) are summed PER-VERTEX in the vertex shader,
// max 4 per object, attenuated by distance, and added on top of the baked
// color. Fog is FogExp2, evaluated per-fragment only because that's the one
// place a gradient must stay smooth for the dither to bite into.
//
// This is deliberately NOT MeshStandardMaterial. No PBR, no shadow maps.
// ---------------------------------------------------------------------------

export const MAX_LIGHTS = 4;

// Shared light uniforms — every N64 material references the SAME objects, so
// updating positions/colors once per frame updates the whole world at once.
export const lightUniforms = {
  uLightPos: { value: Array.from({ length: MAX_LIGHTS }, () => new Vector3()) },
  uLightColor: { value: Array.from({ length: MAX_LIGHTS }, () => new Color(0, 0, 0)) },
  uLightRange: { value: new Float32Array(MAX_LIGHTS) },
  uNumLights: { value: 0 },
};

// Fog uniforms, shared the same way.
export const fogUniforms = {
  uFogColor: { value: new Color().setRGB(...RGB.ash) },
  uFogDensity: { value: 0.035 },
};

// Ambient floor so unlit faces never crush to pure black (very N64).
export const ambientUniform = { value: new Color(0.2, 0.19, 0.17) };

const vertexShader = /* glsl */ `
  attribute vec3 color;

  uniform vec3 uLightPos[${MAX_LIGHTS}];
  uniform vec3 uLightColor[${MAX_LIGHTS}];
  uniform float uLightRange[${MAX_LIGHTS}];
  uniform int uNumLights;
  uniform vec3 uAmbient;

  varying vec3 vColor;
  varying vec2 vUv;
  varying float vFogDepth;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vec3 worldNormal = normalize(mat3(modelMatrix) * normal);

    // Start from baked vertex color + a flat ambient term.
    vec3 lit = color * uAmbient;
    lit += color; // baked color carries its own daylight; ambient lifts shadow

    // Sum up to MAX_LIGHTS dynamic point lights, per-vertex.
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
      if (i >= uNumLights) break;
      vec3 toLight = uLightPos[i] - worldPos.xyz;
      float dist = length(toLight);
      float range = max(uLightRange[i], 0.0001);
      float att = clamp(1.0 - dist / range, 0.0, 1.0);
      att *= att; // quadratic-ish falloff
      // Half-lambert keeps back faces from going flat black (N64 flavour).
      float ndl = 0.5 + 0.5 * dot(worldNormal, normalize(toLight));
      lit += uLightColor[i] * (att * ndl);
    }

    vColor = lit;
    vUv = uv;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;

  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uEmissive;      // 0..1 — feeds the bloom mask (alpha channel)
  uniform vec3 uTint;

  varying vec3 vColor;
  varying vec2 vUv;
  varying float vFogDepth;

  void main() {
    vec3 rgb = vColor * uTint;

    // FogExp2 — the draw-distance hider. Deliberately thick.
    float f = uFogDensity * vFogDepth;
    float fogFactor = 1.0 - exp(-f * f);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    rgb = mix(rgb, uFogColor, fogFactor);

    // Emissive stays lit through fog a bit (heat cuts the ash); write the
    // emissive amount to alpha so the post pass can bloom only hot things.
    float emitMask = uEmissive * (1.0 - fogFactor * 0.6);
    gl_FragColor = vec4(rgb, emitMask);
  }
`;

// Factory. Pass { emissive, tint, side, transparent } as needed.
export function makeN64Material(opts = {}) {
  const { emissive = 0.0, tint = [1, 1, 1], side = 'front', transparent = false } = opts;
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent,
    side: side === 'double' ? DoubleSide : FrontSide,
    fog: false, // we do fog ourselves
    uniforms: {
      uLightPos: lightUniforms.uLightPos,
      uLightColor: lightUniforms.uLightColor,
      uLightRange: lightUniforms.uLightRange,
      uNumLights: lightUniforms.uNumLights,
      uFogColor: fogUniforms.uFogColor,
      uFogDensity: fogUniforms.uFogDensity,
      uAmbient: ambientUniform,
      uEmissive: { value: emissive },
      uTint: { value: new Color(tint[0], tint[1], tint[2]) },
    },
  });
}

// ---- Dynamic light registry -------------------------------------------------
// Systems register lights; the pipeline uploads the nearest MAX_LIGHTS to the
// active camera each frame. For Phase 0 we just take the first four.
const _lights = [];

export function addLight({ position, color, range = 12, intensity = 1 }) {
  const light = {
    position: position.clone ? position.clone() : new Vector3(...position),
    color: color.clone ? color.clone() : new Color(color),
    range,
    intensity,
  };
  _lights.push(light);
  return light;
}

export function clearLights() {
  _lights.length = 0;
}

// Upload the four lights nearest `cameraPos` into the shared uniforms.
export function uploadLights(cameraPos) {
  const chosen =
    _lights.length <= MAX_LIGHTS
      ? _lights
      : [..._lights]
          .sort(
            (a, b) =>
              a.position.distanceToSquared(cameraPos) -
              b.position.distanceToSquared(cameraPos)
          )
          .slice(0, MAX_LIGHTS);

  lightUniforms.uNumLights.value = chosen.length;
  for (let i = 0; i < chosen.length; i++) {
    lightUniforms.uLightPos.value[i].copy(chosen[i].position);
    lightUniforms.uLightColor.value[i]
      .copy(chosen[i].color)
      .multiplyScalar(chosen[i].intensity);
    lightUniforms.uLightRange.value[i] = chosen[i].range;
  }
  for (let i = chosen.length; i < MAX_LIGHTS; i++) {
    lightUniforms.uLightColor.value[i].setRGB(0, 0, 0);
  }
}

export function getLights() {
  return _lights;
}

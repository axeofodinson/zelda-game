// §3.3 hard ramp · §3.2 palette lock · §3.6 aerial perspective.
// Two bands. The smoothstep window is ANTIALIASING, never softening — it never
// widens past 0.03. Shadows are BLUE (ambientSky), never grey.
import * as THREE from 'three';
import { sky } from './sky.js';
import { LUT_GLSL } from './lut.js';

// Self-managed sun shadow (§3.7: shadows to 40m). Shared so one update per frame
// propagates to every toon material.
export const shadowUniforms = {
  uShadowMap:    { value: null },
  uShadowMatrix: { value: new THREE.Matrix4() },
  uShadowTexel:  { value: 1 / 2048 },
  uShadowBias:   { value: 0.0016 },
  uShadowStrength: { value: 0.72 },
};

const VERT = /* glsl */ `
  out vec3 vWorldNormal;
  out vec3 vWorldPos;
  out float vDist;
  #ifdef USE_VCOLOR
    out vec3 vColor;
  #endif
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vDist = length(cameraPosition - wp.xyz);
    #ifdef USE_VCOLOR
      vColor = color;
    #endif
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  precision highp sampler3D;
  precision highp sampler2D;

  uniform vec3 uSunDir, uSunColor, uAmbientSky, uFogColor;
  uniform float uAerial;
  uniform vec3 uAlbedo;
  uniform sampler3D uLut;
  uniform float uLutSize, uLutMix;
  uniform sampler2D uShadowMap;
  uniform mat4 uShadowMatrix;
  uniform float uShadowTexel, uShadowBias, uShadowStrength;
  uniform float uRimStrength, uSpecStrength;

  in vec3 vWorldNormal;
  in vec3 vWorldPos;
  in float vDist;
  #ifdef USE_VCOLOR
    in vec3 vColor;
  #endif
  out vec4 pFragColor;

  ${LUT_GLSL}

  float sampleShadow() {
    vec4 lp = uShadowMatrix * vec4(vWorldPos, 1.0);
    vec3 sc = lp.xyz / lp.w;
    sc = sc * 0.5 + 0.5;
    if (sc.x <= 0.0 || sc.x >= 1.0 || sc.y <= 0.0 || sc.y >= 1.0 || sc.z >= 1.0) return 1.0;
    float bias = uShadowBias;
    float lit = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        float d = texture(uShadowMap, sc.xy + vec2(float(x), float(y)) * uShadowTexel).r;
        lit += (sc.z - bias > d) ? 0.0 : 1.0;
      }
    }
    return lit / 9.0;
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(uSunDir);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 H = normalize(L + V);

    // Palette-locked albedo (§3.2). Source is the flat material colour (× vcolor).
    vec3 src = uAlbedo;
    #ifdef USE_VCOLOR
      src *= vColor;
    #endif
    vec3 albedo = mix(src, paletteLock(uLut, uLutSize, src), uLutMix);

    // Hard two-band ramp (§3.3). Window is AA, not softening.
    float ndl = dot(N, L) * 0.5 + 0.5;
    float lit = smoothstep(0.49, 0.51, ndl);

    // Cast shadow pushes toward the shadow band.
    float sh = mix(1.0, sampleShadow(), uShadowStrength);
    lit *= sh;

    vec3 col = mix(albedo * uAmbientSky, albedo * uSunColor, lit);

    // Rim in ambientSky — hard edge, not a glow (§3.3).
    float rim = step(0.72, pow(1.0 - max(dot(N, V), 0.0), 2.0)) * uRimStrength;
    col = mix(col, uAmbientSky, rim * 0.6);

    // Specular in sear tone (§3.3), gated to lit faces.
    float spec = step(0.98, pow(max(dot(N, H), 0.0), 64.0)) * lit * uSpecStrength;
    col += vec3(1.0, 0.968, 0.839) * spec;

    // Atmospheric perspective (§3.6). 0.92, not 0.5.
    float aer = 1.0 - exp(-vDist * uAerial);
    col = mix(col, uFogColor, aer * 0.92);

    pFragColor = vec4(col, 1.0);
  }
`;

export function makeToonMaterial({ color = '#ffffff', lut, vertexColors = false,
  rim = 1.0, spec = 1.0, lutMix = 1.0, side = THREE.FrontSide } = {}) {
  const uniforms = Object.assign({}, sky.uniforms, shadowUniforms, {
    uAlbedo:      { value: new THREE.Color(color) },
    uLut:         { value: lut },
    uLutSize:     { value: lut ? lut.__size : 32 },
    uLutMix:      { value: lut ? lutMix : 0.0 },
    uRimStrength: { value: rim },
    uSpecStrength: { value: spec },
  });

  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines: vertexColors ? { USE_VCOLOR: '' } : {},
    vertexColors,
    side,
  });
  mat.userData.isToon = true;
  return mat;
}

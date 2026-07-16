// §3.2 — Palette lock. A 32³ LUT built at load: every source colour maps to the
// nearest of the 14 palette entries by OKLAB distance (not RGB — RGB
// nearest-neighbour picks arbitrary garbage). Three packs go in, one game comes
// out. Banding is not a bug; flat colour is the brief.
import * as THREE from 'three';
import { PALETTE_LIST } from './palette.js';

// linear sRGB -> Oklab (Björn Ottosson). Inputs are LINEAR, matching Three's
// internal working space (ColorManagement decodes hex to linear on construct).
function linToOklab(r, g, b, out) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  out[0] = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  out[1] = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  out[2] = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  return out;
}

// Pre-convert the palette to Oklab once.
const PAL_OK = PALETTE_LIST.map((c) => linToOklab(c.r, c.g, c.b, [0, 0, 0]));

function nearestPalette(r, g, b, ok) {
  linToOklab(r, g, b, ok);
  let best = 0, bestD = Infinity;
  for (let i = 0; i < PAL_OK.length; i++) {
    const p = PAL_OK[i];
    const dl = ok[0] - p[0], da = ok[1] - p[1], db = ok[2] - p[2];
    // Lightness weighted slightly under chroma: keep hue families together.
    const d = dl * dl * 0.9 + da * da + db * db;
    if (d < bestD) { bestD = d; best = i; }
  }
  return PALETTE_LIST[best];
}

// Build the 32³ Data3DTexture. NearestFilter = a hard snap (the palette lock).
export function buildPaletteLUT(size = 32) {
  const data = new Uint8Array(size * size * size * 4);
  const ok = [0, 0, 0];
  let ptr = 0;
  for (let bz = 0; bz < size; bz++) {
    for (let gy = 0; gy < size; gy++) {
      for (let rx = 0; rx < size; rx++) {
        const r = rx / (size - 1);
        const g = gy / (size - 1);
        const b = bz / (size - 1);
        const c = nearestPalette(r, g, b, ok);
        data[ptr++] = Math.round(THREE.MathUtils.clamp(c.r, 0, 1) * 255);
        data[ptr++] = Math.round(THREE.MathUtils.clamp(c.g, 0, 1) * 255);
        data[ptr++] = Math.round(THREE.MathUtils.clamp(c.b, 0, 1) * 255);
        data[ptr++] = 255;
      }
    }
  }
  const tex = new THREE.Data3DTexture(data, size, size, size);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.wrapR = tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace; // raw linear palette values, no decode
  tex.needsUpdate = true;
  tex.__size = size;
  return tex;
}

// GLSL snippet: sample the 3D LUT with a linear colour. Half-texel offset keeps
// nearest sampling on-cell.
export const LUT_GLSL = /* glsl */ `
  vec3 paletteLock(sampler3D lut, float size, vec3 c) {
    vec3 uv = clamp(c, 0.0, 1.0) * (size - 1.0) / size + 0.5 / size;
    return texture(lut, uv).rgb;
  }
`;

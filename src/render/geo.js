import { BufferAttribute, Color } from 'three';
import { RGB } from './palette.js';

// Bake flat, hemisphere-shaded vertex colors into a geometry so faces read as
// discrete flat quads (the N64 look) with cheap static "daylight" already in
// them. Converts to non-indexed so each face owns its verts.
//
//   geometry : any BufferGeometry
//   base     : palette name (string) or [r,g,b] linear triplet
//   opts.floor / opts.top : shade multipliers for down- vs up-facing verts
//   opts.variance : per-face random tint jitter (fake dirt/wear)
export function bakeFlat(geometry, base, opts = {}) {
  const { floor = 0.5, top = 1.0, variance = 0.06 } = opts;
  const rgb = typeof base === 'string' ? RGB[base] : base;

  let geo = geometry.index ? geometry.toNonIndexed() : geometry;
  geo.computeVertexNormals();

  const pos = geo.getAttribute('position');
  const nrm = geo.getAttribute('normal');
  const count = pos.count;
  const colors = new Float32Array(count * 3);

  const c = new Color();
  let jitter = 1;
  for (let f = 0; f < count; f += 3) {
    // One flat normal per triangle (average of its 3 vertex normals).
    let ny = (nrm.getY(f) + nrm.getY(f + 1) + nrm.getY(f + 2)) / 3;
    const shade = top * (0.5 + 0.5 * ny) + floor * (0.5 - 0.5 * ny);
    // Re-roll once per quad face (every 2 triangles), not per triangle —
    // otherwise a face's two triangles jitter independently and split
    // visibly along their shared diagonal.
    if (f % 6 === 0) jitter = 1 + (Math.random() * 2 - 1) * variance;
    c.setRGB(rgb[0], rgb[1], rgb[2]).multiplyScalar(shade * jitter);
    for (let k = 0; k < 3; k++) {
      colors[(f + k) * 3 + 0] = c.r;
      colors[(f + k) * 3 + 1] = c.g;
      colors[(f + k) * 3 + 2] = c.b;
    }
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  return geo;
}

// §3.4 — Baked smooth normals. Hard-edged meshes have split verts (three
// normals at one corner); extruding the inverted hull along those tears it open
// at every corner. This kills inverted-hull outlines on every asset pack.
//
// Fix: accumulate face normals per UNIQUE position, normalize, and write to a
// `smoothNormal` attribute. Run every imported mesh through this, always. The
// beauty pass still shades with the original `normal`.
import * as THREE from 'three';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _ab = new THREE.Vector3();
const _ac = new THREE.Vector3();
const _fn = new THREE.Vector3();

// Quantize a coordinate to weld positions that are numerically-equal-ish.
function key(x, y, z) {
  const q = 1e4; // 1e-4 quantum
  return `${Math.round(x * q)}_${Math.round(y * q)}_${Math.round(z * q)}`;
}

export function addSmoothNormals(geometry) {
  const g = geometry.index ? geometry : geometry.toNonIndexed
    ? geometry
    : geometry;
  const pos = g.attributes.position;
  const count = pos.count;

  // Map unique position -> accumulated normal.
  const acc = new Map();

  const index = g.index;
  const triCount = index ? index.count / 3 : count / 3;

  for (let t = 0; t < triCount; t++) {
    const i0 = index ? index.getX(t * 3) : t * 3;
    const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;

    _a.fromBufferAttribute(pos, i0);
    _b.fromBufferAttribute(pos, i1);
    _c.fromBufferAttribute(pos, i2);

    _ab.subVectors(_b, _a);
    _ac.subVectors(_c, _a);
    _fn.crossVectors(_ab, _ac); // area-weighted face normal (not normalized)

    for (const [idx, v] of [[i0, _a], [i1, _b], [i2, _c]]) {
      const k = key(v.x, v.y, v.z);
      let n = acc.get(k);
      if (!n) { n = new THREE.Vector3(); acc.set(k, n); }
      n.add(_fn);
    }
  }

  const smooth = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    _a.fromBufferAttribute(pos, i);
    const n = acc.get(key(_a.x, _a.y, _a.z));
    if (n) {
      _fn.copy(n).normalize();
      smooth[i * 3] = _fn.x;
      smooth[i * 3 + 1] = _fn.y;
      smooth[i * 3 + 2] = _fn.z;
    } else {
      smooth[i * 3] = 0; smooth[i * 3 + 1] = 1; smooth[i * 3 + 2] = 0;
    }
  }

  g.setAttribute('smoothNormal', new THREE.BufferAttribute(smooth, 3));
  return g;
}

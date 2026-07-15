import {
  BufferGeometry,
  BufferAttribute,
  Points,
  ShaderMaterial,
  CustomBlending,
  AddEquation,
  SrcAlphaFactor,
  OneMinusSrcAlphaFactor,
  OneFactor,
  ZeroFactor,
  Color,
  Sphere,
  Vector3,
} from 'three';
import { fogUniforms } from '../render/n64material.js';
import { RGB } from '../render/palette.js';

// Points are never frustum-culled and their verts move on the GPU/CPU, so give
// them a permanent huge bounding sphere (avoids null-boundingSphere crashes and
// NaN recompute warnings from moving/dead verts).
function pinBounds(geo) {
  geo.boundingSphere = new Sphere(new Vector3(0, 0, 0), 1e5);
  geo.computeBoundingSphere = () => {};
}

// Pooled GPU Points (§6). One pool per system, pre-allocated, never `new` in
// the loop. CPU-side integration (fine for our counts). Alpha carries both the
// blend weight and — for additive/hot systems — the bloom emissive mask.

const pointVert = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uPixelScale;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vFogDepth;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vFogDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelScale / max(-mv.z, 0.1);
  }
`;

function pointFrag(emissive) {
  return /* glsl */ `
    precision mediump float;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    varying float vAlpha;
    varying vec3 vColor;
    varying float vFogDepth;
    void main() {
      vec2 d = gl_PointCoord - 0.5;
      float r = length(d);
      if (r > 0.5) discard;
      float soft = smoothstep(0.5, 0.15, r);
      float a = soft * vAlpha;
      float f = uFogDensity * vFogDepth;
      float fog = clamp(1.0 - exp(-f * f), 0.0, 1.0);
      vec3 col = mix(vColor, uFogColor, fog * ${emissive ? '0.3' : '1.0'});
      gl_FragColor = vec4(col, a);
    }
  `;
}

// The RT's alpha channel is the bloom's emissive mask, so particles must not
// pollute it: colour blends normally, but the ALPHA channel is either left
// untouched (cold particles: ash, steam, glass) or ADDED (hot particles:
// sparks, embers, vent) so only genuinely emissive fx bloom.
function makePointMaterial(emissive) {
  return new ShaderMaterial({
    vertexShader: pointVert,
    fragmentShader: pointFrag(emissive),
    transparent: true,
    depthWrite: false,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: SrcAlphaFactor,
    blendDst: emissive ? OneFactor : OneMinusSrcAlphaFactor, // additive vs normal
    blendEquationAlpha: AddEquation,
    blendSrcAlpha: emissive ? SrcAlphaFactor : ZeroFactor,
    blendDstAlpha: OneFactor, // never overwrite existing emissive mask; only add
    uniforms: {
      uPixelScale: { value: 240 },
      uFogColor: fogUniforms.uFogColor,
      uFogDensity: fogUniforms.uFogDensity,
    },
  });
}

export class Pool {
  constructor(capacity, opts = {}) {
    this.cap = capacity;
    this.opts = opts;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.size0 = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.peak = new Float32Array(capacity);
    this.col = new Float32Array(capacity * 3);
    this.cursor = 0;

    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.pos, 3).setUsage(35048));
    g.setAttribute('aColor', new BufferAttribute(this.col, 3).setUsage(35048));
    g.setAttribute('aSize', new BufferAttribute(this.size, 1).setUsage(35048));
    g.setAttribute('aAlpha', new BufferAttribute(this.alpha, 1).setUsage(35048));
    g.setDrawRange(0, capacity);
    pinBounds(g);

    const mat = makePointMaterial(!!opts.emissive);
    this.points = new Points(g, mat);
    this.points.frustumCulled = false;
    this.geo = g;
    this.gravity = opts.gravity ?? 0;
    this.drag = opts.drag ?? 0;
  }

  spawn({ x, y, z, vx = 0, vy = 0, vz = 0, life = 1, size = 4, color = [1, 1, 1], alpha = 1 }) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.cap;
    this.peak[i] = alpha;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = size;
    this.size0[i] = size;
    this.col[i * 3] = color[0];
    this.col[i * 3 + 1] = color[1];
    this.col[i * 3 + 2] = color[2];
    this.alpha[i] = 1;
  }

  update(dt) {
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        this.size[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const k = i * 3;
      this.vel[k + 1] += this.gravity * dt;
      if (this.drag) {
        const d = Math.max(0, 1 - this.drag * dt);
        this.vel[k] *= d;
        this.vel[k + 1] *= d;
        this.vel[k + 2] *= d;
      }
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      const t = Math.max(this.life[i] / this.maxLife[i], 0);
      this.alpha[i] = t * this.peak[i]; // linear fade toward the per-particle peak
      this.size[i] = this.size0[i] * (this.opts.grow ? 2 - t : 1);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }
}

// Ambient ash-snow (§6): always on, wraps in a box around the camera.
export class AshSnow {
  constructor(count = 1200, radius = 22) {
    this.count = count;
    this.radius = radius;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    const g = new BufferGeometry();
    const size = new Float32Array(count);
    const alpha = new Float32Array(count);
    const col = new Float32Array(count * 3);
    const ash = RGB.ash;
    for (let i = 0; i < count; i++) {
      this.pos[i * 3] = (Math.random() * 2 - 1) * radius;
      this.pos[i * 3 + 1] = Math.random() * radius;
      this.pos[i * 3 + 2] = (Math.random() * 2 - 1) * radius;
      this.vel[i * 3] = (Math.random() * 2 - 1) * 0.3;
      this.vel[i * 3 + 1] = -0.4 - Math.random() * 0.5;
      this.vel[i * 3 + 2] = (Math.random() * 2 - 1) * 0.3;
      size[i] = 0.035 + Math.random() * 0.03;
      alpha[i] = 0.25 + Math.random() * 0.35;
      col[i * 3] = ash[0];
      col[i * 3 + 1] = ash[1];
      col[i * 3 + 2] = ash[2];
    }
    g.setAttribute('position', new BufferAttribute(this.pos, 3).setUsage(35048));
    g.setAttribute('aColor', new BufferAttribute(col, 3));
    g.setAttribute('aSize', new BufferAttribute(size, 1));
    g.setAttribute('aAlpha', new BufferAttribute(alpha, 1));
    pinBounds(g);
    const mat = makePointMaterial(false);
    this.points = new Points(g, mat);
    this.points.frustumCulled = false;
    this.geo = g;
  }

  update(dt, camPos) {
    const r = this.radius;
    for (let i = 0; i < this.count; i++) {
      const k = i * 3;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      // Wrap around the camera so snow is everywhere, forever.
      for (let a = 0; a < 3; a++) {
        const c = a === 1 ? camPos.y : a === 0 ? camPos.x : camPos.z;
        let d = this.pos[k + a] - c;
        if (d > r) this.pos[k + a] -= 2 * r;
        else if (d < -r) this.pos[k + a] += 2 * r;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

// A tiny convenience for the puff colour (ash/slag mix).
export const ASH_PUFF_COLOR = new Color().setRGB(...RGB.ash).multiplyScalar(0.9).toArray();

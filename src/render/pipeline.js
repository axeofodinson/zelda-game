import {
  WebGLRenderTarget,
  ShaderMaterial,
  BufferGeometry,
  BufferAttribute,
  Mesh,
  Scene,
  OrthographicCamera,
  NearestFilter,
  LinearFilter,
  RGBAFormat,
  GLSL3,
  Vector2,
  Vector3,
} from 'three';

// ---------------------------------------------------------------------------
// The N64 post chain (§2):
//
//   scene --> RT(320x240) --> [ bloom(emissive) + Bayer dither + 5551 quantize ]
//         --> RT(320x240) --> [ LINEAR upscale to canvas ]
//
// The dither/quantize MUST run at internal resolution so the Bayer grid is one
// cell per internal pixel; the linear upscale afterwards is what makes N64
// output soft rather than crunchy.
// ---------------------------------------------------------------------------

export const RES_LOW = new Vector2(320, 240);
export const RES_HIGH = new Vector2(640, 480);

// A fullscreen triangle whose clip coords come straight from the vertex data,
// so no camera math is involved.
class FullScreenTri {
  constructor(material) {
    this.geo = new BufferGeometry();
    this.geo.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)
    );
    this.geo.setAttribute(
      'uv',
      new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2)
    );
    this.mesh = new Mesh(this.geo, material);
    this.mesh.frustumCulled = false;
    this.scene = new Scene();
    this.scene.add(this.mesh);
    this.cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  set material(m) {
    this.mesh.material = m;
  }
  render(renderer) {
    renderer.render(this.scene, this.cam);
  }
}

// three injects `in vec3 position;` and `in vec2 uv;` for a GLSL3
// ShaderMaterial, so we only declare our own varying and use position.xy.
const postVert = /* glsl */ `
  out vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Recursive 4x4 Bayer, no array indexing (works everywhere).
const bayerGLSL = /* glsl */ `
  float bayer2(vec2 a) {
    a = floor(a);
    return fract(a.x * 0.5 + a.y * a.y * 0.75);
  }
  float bayer4(vec2 a) {
    return bayer2(0.5 * a) * 0.25 + bayer2(a);
  }
`;

const postFrag = /* glsl */ `
  precision mediump float;
  uniform sampler2D uScene;
  uniform vec2 uResolution;
  uniform float uBloom;
  uniform float uDesat;      // 0..1 — screen desaturates toward molten (melt≥85)
  uniform vec3 uMolten;
  in vec2 vUv;
  out vec4 outColor;

  ${bayerGLSL}

  void main() {
    vec2 texel = 1.0 / uResolution;
    vec4 s = texture(uScene, vUv);
    vec3 col = s.rgb;

    // --- Emissive-only bloom (threshold 0.85), cheap cross of taps ---------
    // Alpha carries the per-fragment emissive mask written by n64material.
    vec3 bloom = vec3(0.0);
    float wsum = 0.0;
    for (int i = -2; i <= 2; i++) {
      for (int j = -2; j <= 2; j++) {
        vec2 o = vec2(float(i), float(j)) * texel * 1.5;
        vec4 n = texture(uScene, vUv + o);
        float e = smoothstep(0.85, 1.0, n.a);
        float w = 1.0 / (1.0 + float(i * i + j * j));
        bloom += n.rgb * e * w;
        wsum += w;
      }
    }
    if (wsum > 0.0) bloom /= wsum;
    col += bloom * uBloom;

    // --- Melt desaturation: world drains toward molten as Tinn fails -------
    if (uDesat > 0.001) {
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 drained = mix(vec3(l), uMolten * (0.6 + l), 0.5);
      col = mix(col, drained, uDesat);
    }

    // --- Ordered dither + RGB5551 quantize --------------------------------
    float b = bayer4(gl_FragCoord.xy);
    vec3 q = floor(col * 31.0 + b) / 31.0; // 5 bits per channel
    outColor = vec4(q, 1.0);
  }
`;

const upscaleFrag = /* glsl */ `
  precision mediump float;
  uniform sampler2D uTex;
  in vec2 vUv;
  out vec4 outColor;
  void main() {
    outColor = texture(uTex, vUv);
  }
`;

export class Pipeline {
  constructor(renderer) {
    this.renderer = renderer;
    this.res = RES_LOW.clone();

    this.rtScene = new WebGLRenderTarget(this.res.x, this.res.y, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      format: RGBAFormat,
      depthBuffer: true,
      stencilBuffer: false,
    });
    // rtPost is sampled by the upscale with LINEAR filtering — the softness.
    this.rtPost = new WebGLRenderTarget(this.res.x, this.res.y, {
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      format: RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
    });

    this.postMat = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: postVert,
      fragmentShader: postFrag,
      uniforms: {
        uScene: { value: this.rtScene.texture },
        uResolution: { value: this.res.clone() },
        uBloom: { value: 0.5 }, // subtle — CRT bleed, not Unreal (§2)
        uDesat: { value: 0 },
        uMolten: { value: new Vector3(1.0, 0.42, 0.1) },
      },
    });
    this.upscaleMat = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: postVert,
      fragmentShader: upscaleFrag,
      uniforms: { uTex: { value: this.rtPost.texture } },
    });

    this.quad = new FullScreenTri(this.postMat);
  }

  setInternalResolution(vec) {
    this.res.copy(vec);
    this.rtScene.setSize(this.res.x, this.res.y);
    this.rtPost.setSize(this.res.x, this.res.y);
    this.postMat.uniforms.uResolution.value.copy(this.res);
  }

  toggleResolution() {
    this.setInternalResolution(this.res.x === RES_LOW.x ? RES_HIGH : RES_LOW);
  }

  render(scene, camera) {
    const r = this.renderer;

    // Pass A — scene to the internal-res target.
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(scene, camera);

    // Pass B — bloom + dither + quantize at internal res.
    r.setRenderTarget(this.rtPost);
    this.quad.material = this.postMat;
    this.quad.render(r);

    // Pass C — linear upscale to the canvas.
    r.setRenderTarget(null);
    this.quad.material = this.upscaleMat;
    this.quad.render(r);
  }
}

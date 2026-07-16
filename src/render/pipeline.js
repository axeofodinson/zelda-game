// §3.7 — The render chain. prepass → hull → main → edge → bloom → LUT grade → AA.
// Shadows: single cascade to 40m (§3.7 lists 2-cascade CSM; P0 ships one tight
// cascade — see PROGRESS). Quality toggle lives here from day one, not phase 7.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { sky } from './sky.js';
import { shadowUniforms } from './toon.js';
import { makeNormalDepthMaterial, makeEdgeMaterial } from './edges.js';

const HALF = THREE.HalfFloatType;

function makeRT(w, h, opts = {}) {
  return new THREE.WebGLRenderTarget(w, h, {
    type: HALF, format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    depthBuffer: opts.depth ?? false, stencilBuffer: false,
    ...opts,
  });
}

export class Pipeline {
  constructor(renderer, scene, camera, quality = 'high') {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.quality = quality;
    this.ss = quality === 'high' ? 1.25 : 1.0;

    // Shadow (single cascade, 40m).
    const S = quality === 'high' ? 2048 : 1024;
    this.shadowSize = S;
    this.shadowCam = new THREE.OrthographicCamera(-42, 42, 42, -42, 1, 300);
    const depthTex = new THREE.DepthTexture(S, S);
    depthTex.type = THREE.UnsignedIntType;
    this.shadowRT = new THREE.WebGLRenderTarget(S, S, {
      depthTexture: depthTex, depthBuffer: true,
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    });
    shadowUniforms.uShadowMap.value = depthTex;
    shadowUniforms.uShadowTexel.value = 1 / S;
    this.depthOverride = new THREE.MeshBasicMaterial();

    this.normalDepthMat = makeNormalDepthMaterial();
    this.edgeMat = makeEdgeMaterial();

    // Bloom (threshold 0.9, strength 0.5).
    this.brightMat = this._bright();
    this.blurMat = this._blur();
    this.combineMat = this._combine();
    this.finalMat = this._final();
    this.fsq = new FullScreenQuad();

    this.setSize(renderer.domElement.width, renderer.domElement.height);
  }

  setSize(w, h) {
    this.width = w; this.height = h;
    const rw = Math.ceil(w * this.ss), rh = Math.ceil(h * this.ss);
    this.rw = rw; this.rh = rh;
    for (const rt of [this.normalRT, this.beautyRT, this.sceneRT, this.compRT,
      this.bloomA, this.bloomB]) rt?.dispose();
    this.normalRT = makeRT(rw, rh, { depth: true }); // needs its own depth test,
    // else occluded meshes still write normals/depth and the edge pass draws
    // phantom silhouettes over whatever is actually in front.
    this.beautyRT = makeRT(rw, rh, { depth: true });
    this.sceneRT = makeRT(rw, rh);
    this.compRT = makeRT(rw, rh);
    const bw = Math.ceil(rw / 2), bh = Math.ceil(rh / 2);
    this.bloomA = makeRT(bw, bh);
    this.bloomB = makeRT(bw, bh);
    this.edgeMat.uniforms.uTexel.value.set(1 / rw, 1 / rh);
    this.finalMat.uniforms.uTexel.value.set(1 / rw, 1 / rh);
    this.blurMat.uniforms.uTexel.value.set(1 / bw, 1 / bh);
  }

  _pass(mat, target) {
    this.fsq.material = mat;
    this.renderer.setRenderTarget(target);
    this.fsq.render(this.renderer);
  }

  _hide(pred) {
    const hidden = [];
    this.scene.traverse((o) => {
      if (o.visible && pred(o)) { o.visible = false; hidden.push(o); }
    });
    return hidden;
  }
  _show(list) { for (const o of list) o.visible = true; }

  _updateShadow() {
    const center = new THREE.Vector3();
    // Centre the cascade a little ahead of the camera along its ground heading.
    this.camera.getWorldDirection(center);
    center.multiplyScalar(20).add(this.camera.position);
    center.y = 0;
    const cam = this.shadowCam;
    cam.position.copy(sky.sunDir).multiplyScalar(140).add(center);
    cam.lookAt(center);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    shadowUniforms.uShadowMatrix.value
      .multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  }

  render() {
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();

    // 1. Shadow map.
    this._updateShadow();
    let hidden = this._hide((o) => o.userData.isHull || o.userData.isSky);
    this.scene.overrideMaterial = this.depthOverride;
    r.setRenderTarget(this.shadowRT);
    r.clear();
    r.render(this.scene, this.shadowCam);
    this.scene.overrideMaterial = null;
    this._show(hidden);

    // 2. Depth+normal prepass (exclude hull + sky).
    hidden = this._hide((o) => o.userData.isHull || o.userData.isSky);
    this.scene.overrideMaterial = this.normalDepthMat;
    r.setRenderTarget(this.normalRT);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(this.scene, this.camera);
    this.scene.overrideMaterial = null;
    this._show(hidden);

    // 3. Beauty (hull + main, sky dome fills background).
    r.setRenderTarget(this.beautyRT);
    r.clear();
    r.render(this.scene, this.camera);

    // 4. Edge detect + composite.
    this.edgeMat.uniforms.uScene.value = this.beautyRT.texture;
    this.edgeMat.uniforms.uNormalDepth.value = this.normalRT.texture;
    this._pass(this.edgeMat, this.sceneRT);

    // 5. Bloom.
    this.brightMat.uniforms.uTex.value = this.sceneRT.texture;
    this._pass(this.brightMat, this.bloomA);
    this.blurMat.uniforms.uTex.value = this.bloomA.texture;
    this.blurMat.uniforms.uDir.value.set(1, 0);
    this._pass(this.blurMat, this.bloomB);
    this.blurMat.uniforms.uTex.value = this.bloomB.texture;
    this.blurMat.uniforms.uDir.value.set(0, 1);
    this._pass(this.blurMat, this.bloomA);
    this.combineMat.uniforms.uScene.value = this.sceneRT.texture;
    this.combineMat.uniforms.uBloom.value = this.bloomA.texture;
    this._pass(this.combineMat, this.compRT);

    // 6+7. LUT grade + AA + sRGB, straight to the canvas (downsamples on high).
    this.finalMat.uniforms.uTex.value = this.compRT.texture;
    this.renderer.setRenderTarget(null);
    this.fsq.material = this.finalMat;
    this.fsq.render(this.renderer);

    r.setRenderTarget(prevTarget);
  }

  _bright() {
    return new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { uTex: { value: null }, uThreshold: { value: 0.9 } },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        precision highp float; uniform sampler2D uTex; uniform float uThreshold;
        in vec2 vUv; out vec4 pFragColor;
        void main() {
          vec3 c = texture(uTex, vUv).rgb;
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          pFragColor = vec4(c * max(l - uThreshold, 0.0) / max(l, 1e-4), 1.0);
        }`,
    });
  }
  _blur() {
    return new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { uTex: { value: null }, uTexel: { value: new THREE.Vector2() },
        uDir: { value: new THREE.Vector2(1, 0) } },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        precision highp float; uniform sampler2D uTex; uniform vec2 uTexel, uDir;
        in vec2 vUv; out vec4 pFragColor;
        void main() {
          vec2 o = uTexel * uDir;
          vec3 c = texture(uTex, vUv).rgb * 0.227027;
          c += texture(uTex, vUv + o * 1.3846).rgb * 0.316216;
          c += texture(uTex, vUv - o * 1.3846).rgb * 0.316216;
          c += texture(uTex, vUv + o * 3.2308).rgb * 0.070270;
          c += texture(uTex, vUv - o * 3.2308).rgb * 0.070270;
          pFragColor = vec4(c, 1.0);
        }`,
    });
  }
  _combine() {
    return new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { uScene: { value: null }, uBloom: { value: null }, uStrength: { value: 0.5 } },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        precision highp float; uniform sampler2D uScene, uBloom; uniform float uStrength;
        in vec2 vUv; out vec4 pFragColor;
        void main() {
          pFragColor = vec4(texture(uScene, vUv).rgb + texture(uBloom, vUv).rgb * uStrength, 1.0);
        }`,
    });
  }
  _final() {
    return new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      defines: this.quality === 'high' ? { AA_BOX: '' } : { AA_FXAA: '' },
      uniforms: { uTex: { value: null }, uTexel: { value: new THREE.Vector2() } },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        precision highp float; uniform sampler2D uTex; uniform vec2 uTexel;
        in vec2 vUv; out vec4 pFragColor;
        vec3 srgb(vec3 c){ return mix(1.055*pow(c,vec3(1.0/2.4))-0.055, c*12.92, step(c,vec3(0.0031308))); }
        void main() {
          vec3 c;
          #ifdef AA_BOX
            // supersample downsample: 4-tap box at half-texel of the hi-res RT.
            vec2 o = uTexel * 0.5;
            c  = texture(uTex, vUv + vec2( o.x,  o.y)).rgb;
            c += texture(uTex, vUv + vec2(-o.x,  o.y)).rgb;
            c += texture(uTex, vUv + vec2( o.x, -o.y)).rgb;
            c += texture(uTex, vUv + vec2(-o.x, -o.y)).rgb;
            c *= 0.25;
          #elif defined(AA_FXAA)
            // cheap FXAA — luma-directional blend. Enough to soften jaggies on low.
            vec3 rgbNW = texture(uTex, vUv + vec2(-1.0,-1.0)*uTexel).rgb;
            vec3 rgbNE = texture(uTex, vUv + vec2( 1.0,-1.0)*uTexel).rgb;
            vec3 rgbSW = texture(uTex, vUv + vec2(-1.0, 1.0)*uTexel).rgb;
            vec3 rgbSE = texture(uTex, vUv + vec2( 1.0, 1.0)*uTexel).rgb;
            vec3 rgbM  = texture(uTex, vUv).rgb;
            vec3 luma = vec3(0.299, 0.587, 0.114);
            float lNW=dot(rgbNW,luma), lNE=dot(rgbNE,luma), lSW=dot(rgbSW,luma), lSE=dot(rgbSE,luma), lM=dot(rgbM,luma);
            float lMin=min(lM,min(min(lNW,lNE),min(lSW,lSE)));
            float lMax=max(lM,max(max(lNW,lNE),max(lSW,lSE)));
            vec2 dir = vec2(-((lNW+lNE)-(lSW+lSE)), ((lNW+lSW)-(lNE+lSE)));
            float red = max((lNW+lNE+lSW+lSE)*0.25*0.5, 1.0/128.0);
            float rcp = 1.0/(min(abs(dir.x),abs(dir.y))+red);
            dir = clamp(dir*rcp, -8.0, 8.0) * uTexel;
            vec3 a = 0.5*(texture(uTex, vUv+dir*(1.0/3.0-0.5)).rgb + texture(uTex, vUv+dir*(2.0/3.0-0.5)).rgb);
            vec3 b = a*0.5 + 0.25*(texture(uTex, vUv+dir*-0.5).rgb + texture(uTex, vUv+dir*0.5).rgb);
            float lB = dot(b, luma);
            c = (lB < lMin || lB > lMax) ? a : b;
          #else
            c = texture(uTex, vUv).rgb;
          #endif
          pFragColor = vec4(srgb(clamp(c, 0.0, 1.0)), 1.0);
        }`,
    });
  }
}

const FS_VERT = /* glsl */ `
  out vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

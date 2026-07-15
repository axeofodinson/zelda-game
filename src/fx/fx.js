import {
  Mesh,
  RingGeometry,
  ShaderMaterial,
  DoubleSide,
  CustomBlending,
  AddEquation,
  SrcAlphaFactor,
  OneMinusSrcAlphaFactor,
  OneFactor,
  ZeroFactor,
  Vector3,
} from 'three';
import { Pool, AshSnow } from './particles.js';
import { RGB } from '../render/palette.js';
import { fogUniforms } from '../render/n64material.js';

// Particle + effect manager. Owns every pool and the vent/knell rings, updates
// them, exposes typed emitters. (§6 has ten systems; this grows each phase.)
export class FX {
  constructor(scene) {
    this.scene = scene;
    this.ashSnow = new AshSnow(1200, 22);
    scene.add(this.ashSnow.points);

    this.pools = {
      ashPuff: new Pool(400, { gravity: 1.2, drag: 3.5, grow: true }),
      steam: new Pool(600, { gravity: 0.6, drag: 2.2, grow: true }),
      sparks: new Pool(500, { gravity: -14, drag: 0.2, emissive: true }),
      drips: new Pool(400, { gravity: -9, emissive: true }),
      flakes: new Pool(400, { gravity: -2.5, drag: 1.2 }),
      glass: new Pool(500, { gravity: -10, drag: 0.4, emissive: true }),
    };
    for (const p of Object.values(this.pools)) scene.add(p.points);

    this._rings = this._makeRings(6);
    for (const r of this._rings) scene.add(r.mesh);
  }

  // §6 ash puff — rolls, lands, footsteps.
  ashPuff(pos, count = 6) {
    const ash = RGB.ash;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.4 + Math.random() * 1.1;
      this.pools.ashPuff.spawn({
        x: pos.x + (Math.random() * 2 - 1) * 0.12,
        y: 0.06 + Math.random() * 0.1,
        z: pos.z + (Math.random() * 2 - 1) * 0.12,
        vx: Math.cos(ang) * spd, vy: 0.5 + Math.random() * 0.6, vz: Math.sin(ang) * spd,
        life: 0.4 + Math.random() * 0.3, size: 0.12 + Math.random() * 0.1,
        color: [ash[0] * 0.95, ash[1] * 0.92, ash[2] * 0.88], alpha: 0.7,
      });
    }
  }

  // §6 steam burst — THE signature. Cold iron on hot bronze: a fat white puff,
  // verdigris-tinted, expands + rises + dissipates over ~900ms. Every quench.
  steamBurst(pos, count = 6) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.3 + Math.random() * 0.8;
      this.pools.steam.spawn({
        x: pos.x + (Math.random() * 2 - 1) * 0.15,
        y: pos.y + (Math.random() * 2 - 1) * 0.15,
        z: pos.z + (Math.random() * 2 - 1) * 0.15,
        vx: Math.cos(ang) * spd, vy: 0.6 + Math.random() * 0.5, vz: Math.sin(ang) * spd,
        life: 0.5 + Math.random() * 0.3, size: 0.22 + Math.random() * 0.18,
        color: [0.5, 0.58, 0.55], // wispy grey-teal quench steam
        alpha: 0.5,
      });
    }
  }

  // §6 sparks — metal-on-metal, blocks, body hits. Fast, gravity, short trail.
  sparks(pos, count = 12, dir = null) {
    const s = RGB.sear;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const el = 0.3 + Math.random() * 0.9;
      let vx = Math.cos(ang) * el * 4, vz = Math.sin(ang) * el * 4;
      if (dir) { vx += dir.x * 3; vz += dir.z * 3; }
      this.pools.sparks.spawn({
        x: pos.x, y: pos.y, z: pos.z,
        vx, vy: 2 + Math.random() * 4, vz,
        life: 0.18 + Math.random() * 0.12, size: 0.05 + Math.random() * 0.04,
        color: [s[0], s[1] * 0.9, s[2] * 0.7], alpha: 0.85,
      });
    }
  }

  // §6 vent ring — expanding steam+sparks; radius MUST match the hitbox (§4).
  ventRing(pos, radius) {
    const r = this._rings.find((x) => !x.active);
    if (r) {
      r.active = true;
      r.t = 0;
      r.radius = radius;
      r.mesh.position.set(pos.x, 0.08, pos.z);
      r.mesh.visible = true;
    }
    // a modest burst of steam + sparks around the rim (the ring is the hero)
    this.steamBurst({ x: pos.x, y: 0.4, z: pos.z }, 8);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.sparks({ x: pos.x + Math.cos(a) * radius * 0.7, y: 0.3, z: pos.z + Math.sin(a) * radius * 0.7 }, 1);
    }
  }

  // §6 verdigris flakes — the reward particle. Teal flakes shed off a new
  // statue when an enemy reaches heat 0.
  verdigrisFlakes(pos, count = 24) {
    const v = RGB.verdigris;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.6 + Math.random() * 1.6;
      this.pools.flakes.spawn({
        x: pos.x + (Math.random() * 2 - 1) * 0.3,
        y: pos.y + Math.random() * 1.2,
        z: pos.z + (Math.random() * 2 - 1) * 0.3,
        vx: Math.cos(ang) * spd, vy: 1.5 + Math.random() * 1.5, vz: Math.sin(ang) * spd,
        life: 0.8 + Math.random() * 0.6, size: 0.06 + Math.random() * 0.04,
        color: [v[0], v[1], v[2]],
      });
    }
  }

  // §6 glass shards — slag glass + Flashling deaths. Sharp, spinning, catch light.
  glassShards(pos, count = 14, tint = null) {
    const c = tint || [RGB.verdigris[0], RGB.verdigris[1] + 0.2, RGB.verdigris[2] + 0.1];
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 1.5 + Math.random() * 3.5;
      this.pools.glass.spawn({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.cos(ang) * spd, vy: 1 + Math.random() * 3, vz: Math.sin(ang) * spd,
        life: 0.3 + Math.random() * 0.3, size: 0.05 + Math.random() * 0.04, color: c, alpha: 0.9,
      });
    }
  }

  _makeRings(n) {
    const rings = [];
    for (let i = 0; i < n; i++) {
      const mat = new ShaderMaterial({
        transparent: true, depthWrite: false, side: DoubleSide,
        blending: CustomBlending, blendEquation: AddEquation,
        blendSrc: SrcAlphaFactor, blendDst: OneMinusSrcAlphaFactor,
        blendEquationAlpha: AddEquation, blendSrcAlpha: ZeroFactor, blendDstAlpha: OneFactor,
        uniforms: { uAlpha: { value: 0 }, uColor: { value: new Vector3(...RGB.verdigris) },
          uFogColor: fogUniforms.uFogColor, uFogDensity: fogUniforms.uFogDensity },
        vertexShader: `varying float vFog; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vFog=-mv.z; gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `precision mediump float; uniform float uAlpha; uniform vec3 uColor; uniform vec3 uFogColor; uniform float uFogDensity; varying float vFog;
          void main(){ float f=uFogDensity*vFog; float fog=clamp(1.0-exp(-f*f),0.0,1.0); vec3 c=mix(uColor,uFogColor,fog); gl_FragColor=vec4(c,uAlpha); }`,
      });
      const mesh = new Mesh(new RingGeometry(0.82, 1.0, 40), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      rings.push({ mesh, mat, active: false, t: 0, radius: 1 });
    }
    return rings;
  }

  update(dt, camPos) {
    this.ashSnow.update(dt, camPos);
    for (const p of Object.values(this.pools)) p.update(dt);
    for (const r of this._rings) {
      if (!r.active) continue;
      r.t += dt;
      const life = 0.5;
      const grow = Math.min(r.t / 0.28, 1);
      const rad = r.radius * (grow * grow * (3 - 2 * grow)); // ease to exact radius
      r.mesh.scale.set(Math.max(rad, 0.001), 1, Math.max(rad, 0.001));
      r.mat.uniforms.uAlpha.value = Math.max(0, 1 - r.t / life) * 0.8;
      if (r.t >= life) { r.active = false; r.mesh.visible = false; }
    }
  }
}

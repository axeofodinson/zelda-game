import { Mesh, SphereGeometry, ShaderMaterial, BackSide, Vector3, Color } from 'three';
import { RGB } from './palette.js';

// The ash sky (§3.1): a flat gradient with a single orange gash where the
// kiln-sun is. Rendered as a big inside-out dome so it fills the background as
// real geometry — which lets it write a ZERO emissive mask (alpha) and stay
// out of the bloom pass. No fog (it IS the fog colour).
//
// Later phases lighten this dome as the boss dies and the fog lifts.
export function buildSky() {
  const geo = new SphereGeometry(70, 24, 16);

  const mat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uAsh: { value: new Color().setRGB(...RGB.ash) },
      uHigh: { value: new Color().setRGB(...RGB.ash).multiplyScalar(0.82) },
      uSun: { value: new Color().setRGB(...RGB.molten) },
      uSunDir: { value: new Vector3(0.55, 0.18, -0.82).normalize() },
      uLift: { value: 0.0 }, // 0..1, raised as the world cools (Phase 5)
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      uniform vec3 uAsh;
      uniform vec3 uHigh;
      uniform vec3 uSun;
      uniform vec3 uSunDir;
      uniform float uLift;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(uAsh, uHigh, smoothstep(0.35, 1.0, h));
        // The kiln-sun: a soft warm gash low on the horizon.
        float s = max(dot(normalize(vDir), uSunDir), 0.0);
        float gash = pow(s, 6.0) * (1.0 - smoothstep(0.0, 0.35, abs(vDir.y)));
        col = mix(col, uSun, gash * 0.6);
        col = mix(col, vec3(1.0), uLift * 0.4); // fog lifts -> lighter sky
        gl_FragColor = vec4(col, 0.0); // alpha 0 -> never blooms
      }
    `,
  });

  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return { mesh, mat };
}

import { Mesh, PlaneGeometry, ShaderMaterial, MultiplyBlending } from 'three';

// The only shadow in the game (§2.6): a dark blob quad on the ground under each
// character. MultiplyBlending darkens the ground without touching the emissive
// mask (alpha stays 1). Procedural radial falloff — no texture.
export function makeBlobShadow(radius = 0.6) {
  const geo = new PlaneGeometry(radius * 2, radius * 2);
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: MultiplyBlending,
    uniforms: { uStrength: { value: 0.55 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float shade = smoothstep(0.45, 1.0, r); // 0 center .. 1 edge
        float dark = mix(1.0 - uStrength, 1.0, shade);
        gl_FragColor = vec4(vec3(dark), 1.0);
      }
    `,
  });
  const mesh = new Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1;
  return mesh;
}

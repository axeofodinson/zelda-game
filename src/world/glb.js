// §10 P1 — GLB ingest. Kenney Nature Kit (CC0), assets/raw/kenney-nature-kit/.
//
// The loader is deliberately fetch-first: `fetch()` then `GLTFLoader.parse()`,
// never `loader.load(url)`. P0's GLB load hung `window.__ready` with no
// pageerror, and the suspect was an intermittent proxy 403 — three.js's XHR
// path swallows the HTTP status, so a 403 body arrives as an opaque parse
// failure (or nothing at all). Going through fetch keeps the status, the
// content-type and the byte length in hand, so "is this a network problem"
// is a question with a printed answer instead of a hypothesis.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const PACK_ROOT = '/assets/raw/kenney-nature-kit/';

const loader = new GLTFLoader();

// glTF magic — first four bytes of a binary .glb.
const GLB_MAGIC = 0x46546c67; // 'glTF'

// Fetch one .glb and report exactly what came back over the wire.
export async function fetchGLB(name) {
  const url = PACK_ROOT + (name.endsWith('.glb') ? name : `${name}.glb`);
  const t0 = performance.now();
  const res = await fetch(url);
  const buf = res.ok ? await res.arrayBuffer() : null;
  const info = {
    url,
    status: res.status,
    ok: res.ok,
    type: res.headers.get('content-type'),
    bytes: buf ? buf.byteLength : 0,
    ms: Math.round(performance.now() - t0),
  };
  if (!res.ok) throw Object.assign(new Error(`GLB fetch ${res.status} ${url}`), { info });
  // A proxy error page is 200 + HTML, not a 403 — check the magic, not the status.
  const magicOK = buf.byteLength >= 4 && new DataView(buf).getUint32(0, true) === GLB_MAGIC;
  info.magic = magicOK;
  if (!magicOK) throw Object.assign(new Error(`not a GLB (bad magic) ${url}`), { info });
  return { buf, info };
}

// Fetch + parse. Returns { gltf, info }.
export async function loadGLB(name) {
  const { buf, info } = await fetchGLB(name);
  const gltf = await new Promise((resolve, reject) => {
    loader.parse(buf, PACK_ROOT, resolve, reject);
  });
  return { gltf, info };
}

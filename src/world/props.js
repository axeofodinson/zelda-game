// §10 P1 — the asset pipeline. Kenney Nature Kit (CC0) in, palette-locked
// inked props out. Mesh only: §3.2 takes "mesh, rig, animation clips. Nothing
// else" — every glTF material is discarded and rebuilt as a toon material.
//
// The kit has NO textures (verified over all 329 files, see assets/raw/README.md):
// the shared atlas was flattened to per-material `baseColorFactor` at export, so
// the palette lock is a name -> colour lookup, not image processing.
//
// P1b: that lookup is now SEMANTIC (see roles.js). The source `baseColorFactor`
// values are no longer read at all — P1 measured that quantising them by Oklab
// distance collapses the whole kit onto 6 entries, 4 of them sky-and-light
// roles, and that no weighting fixes it. The pack states intent in the material
// name; the map reads the name.
import * as THREE from 'three';
import { loadGLB, PACK_ROOT } from './glb.js';
import { addSmoothNormals } from '../render/smoothNormals.js';
import { makeHull } from '../render/outline.js';
import { makeToonMaterial } from '../render/toon.js';
import { assertCoverage, isExcluded, resolveRole, roleColour, EXCLUDED_MODELS } from './roles.js';

export const PACK = {
  id: 'kenney-nature-kit',
  name: 'Kenney Nature Kit',
  author: 'Kenney',
  url: 'https://kenney.nl/assets/nature-kit',
  licence: 'CC0 1.0 Universal (public domain)',
  models: 329,
  // The kit is authored small — tallest model is 2.08 units. At 1 unit = 1 m a
  // "tall pine" would be chest height and have no silhouette at 25 m, so the
  // pack carries a scale. 4.0 puts tree_default at 6.8 m and the tallest pine
  // at 8.3 m, which is the read the §10 silhouette check needs.
  scale: 4.0,
};

// Eight models spanning the kit's shape range and its material spread — canopy,
// conifer, bush, boulder, standing stone, cliff block, stump, mushroom. This is
// the §10 "silhouettes at 25 m" set.
//
// P1b: `mushroom_redTall` -> `mushroom_tanTall`. The red one is excluded on §2
// accent grounds and the tan one is the same geometry, so the scan stays
// comparable to P1's table.
export const SILHOUETTE_SET = [
  'tree_default', 'tree_pineTallD', 'plant_bushLarge', 'rock_tallE',
  'stone_largeD', 'cliff_blockSlope_rock', 'stump_round', 'mushroom_tanTall',
];

// --- Palette lock (§3.2, P1b semantics) ------------------------------------
// No LUT sampling, no distance metric. `roles.js` maps material name -> §2 role
// and throws on anything it does not know, so an unrecognised material is a
// build failure with a name in it rather than a prop that silently comes out
// the colour of the sky.

// The pack manifest (scripts/manifest.mjs, `npm run assets`) — a browser cannot
// list a directory, so the README's "scan recursively" happens at tooling time.
let _manifestPromise = null;
export function loadManifest() {
  if (!_manifestPromise) {
    _manifestPromise = fetch('/assets/raw/manifest.json').then((res) => {
      if (!res.ok) throw new Error(`manifest.json ${res.status} — run \`npm run assets\``);
      return res.json();
    });
  }
  return _manifestPromise;
}

// Every loadable model in a pack, in manifest order. The §2 exclusions are
// filtered here rather than at the call site, so "load the pack" cannot quietly
// mean "load the pack plus the red flowers".
export async function packModels(pack = PACK.id) {
  const m = await loadManifest();
  if (!m.packs[pack]) throw new Error(`pack "${pack}" not in manifest`);
  return m.packs[pack].models.filter((n) => !isExcluded(n));
}

// The excluded names, for reporting.
export function excludedModels() {
  return [...EXCLUDED_MODELS];
}

let _packPromise = null;

// palette.json is no longer a colour source — the map is. It is still fetched,
// as the pack's own declaration of which materials exist: `assertCoverage`
// fails the load if the pack carries a material with no role. A pack update
// that adds one is caught here, not at whatever framing first shows it.
export function loadPackPalette() {
  if (_packPromise) return _packPromise;
  _packPromise = fetch(`${PACK_ROOT}palette.json`).then(async (res) => {
    if (!res.ok) throw new Error(`palette.json ${res.status}`);
    const json = await res.json();
    const names = Object.keys(json.materials);
    assertCoverage(names);
    return { json, names };
  });
  return _packPromise;
}

// --- Model ingest ----------------------------------------------------------
// Every mesh: drop the atlas leftovers, bake smooth normals (§3.4 — without
// them the inverted hull tears open at every hard corner), swap the glTF
// material for a palette-locked toon material, attach a hull.
function prepareMesh(mesh, { model, lut, stats }) {
  const geo = mesh.geometry;

  // Unreferenced TEXCOORD_0 left over from the atlas mapping (§ assets README).
  // Nothing samples it and §3.2 imports no maps, so it is dead weight.
  if (geo.attributes.uv) { geo.deleteAttribute('uv'); stats.uvsDropped++; }

  addSmoothNormals(geo);                       // §3.4, every mesh, always

  // §3.2 P1b — name -> role -> §2 colour. `resolveRole` throws on anything it
  // does not know; the throw propagates out of `loadProp` and lands in
  // `loadProps().failed`, which the rig prints. Loud, not silent.
  const srcName = mesh.material?.name || '_defaultMat';
  const role = resolveRole(model, srcName);
  const colour = roleColour(role);
  stats.materials.set(srcName, (stats.materials.get(srcName) || 0) + 1);
  stats.roles.set(role, (stats.roles.get(role) || 0) + 1);

  // Discard the glTF material outright (§3.2 / §11: no MeshStandardMaterial).
  mesh.material?.dispose?.();
  mesh.material = makeToonMaterial({
    color: colour,
    lut,
    lutMix: 0,   // the colour IS a palette entry — do not snap a palette entry
  });

  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.add(makeHull(mesh));                    // hull follows via parenting
  stats.meshes++;
  stats.tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
}

// Load one model, fully prepared and scaled to world metres. Returns a Group.
export async function loadProp(name, { lut, scale = PACK.scale } = {}) {
  if (isExcluded(name)) throw new Error(`model "${name}" is excluded (§2 accent rule) and must not be loaded`);
  await loadPackPalette();                       // coverage assert, once per session
  const { gltf, info } = await loadGLB(name);
  const stats = { meshes: 0, tris: 0, uvsDropped: 0, materials: new Map(), roles: new Map() };

  // Collect first, prepare second: `prepareMesh` parents a hull onto each mesh,
  // and traverse() would walk straight into that new child and hull the hull.
  const root = gltf.scene;
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && !o.userData.isHull) meshes.push(o); });
  for (const m of meshes) prepareMesh(m, { model: name, lut, stats });

  const group = new THREE.Group();
  group.name = name;
  group.scale.setScalar(scale);
  group.add(root);

  // Sit the model's base on y=0 so callers place it by ground height.
  const box = new THREE.Box3().setFromObject(group);
  group.userData.size = box.getSize(new THREE.Vector3());
  group.userData.stats = stats;
  group.userData.info = info;
  group.userData.baseOffset = -box.min.y;
  return group;
}

// Load several models in parallel. Rejects nothing — a failed model is reported
// in `failed` so one bad file cannot hang `__ready` for the whole pack.
export async function loadProps(names, opts = {}) {
  const settled = await Promise.allSettled(names.map((n) => loadProp(n, opts)));
  const props = [];
  const failed = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') props.push(r.value);
    else failed.push({ name: names[i], error: r.reason?.message || String(r.reason) });
  });
  return { props, failed };
}

// Place a prepared prop in the world, base sitting on `y`.
export function placeProp(prop, x, y, z, rotY = 0) {
  prop.position.set(x, y + prop.userData.baseOffset, z);
  prop.rotation.y = rotY;
  return prop;
}

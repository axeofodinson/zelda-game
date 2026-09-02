// §3.2 P1b — resolve every material of every model in every pack through
// `src/world/roles.js`, and fail if any of them cannot be resolved.
//
// The browser path asserts the same thing at load, but only for models a rig
// actually places, and only once the app boots. This walks all 329 GLBs offline
// in ~200 ms, so "the map covers the pack" is a command, not a screenshot.
//
//   npm run roles          check + print the palette-entry histogram
//
// Exits nonzero on: an unmapped material, an `_defaultMat` model matching no
// prefix, an excluded-only material on a loaded model, or any role that is not
// a §2 surface role (`cloth` included — see roles.js, PLAYER_ONLY_ROLE).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { P } from '../src/render/palette.js';
import { resolveRole, isExcluded, EXCLUDED_MODELS, assertCoverage, DEFAULT_MAT_PREFIX } from '../src/world/roles.js';

const RAW = new URL('../assets/raw/', import.meta.url).pathname;

// glTF material names straight out of the GLB's JSON chunk. An unnamed material
// is `_defaultMat`, matching what GLTFLoader hands the browser path.
function materialsOf(file) {
  const buf = readFileSync(file);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error(`not a GLB: ${file}`);
  const len = dv.getUint32(12, true);
  if (dv.getUint32(16, true) !== 0x4e4f534a) throw new Error(`first chunk is not JSON: ${file}`);
  const json = JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
  return (json.materials || []).map((m) => m.name || '_defaultMat');
}

// Self-test: assert the guards actually guard. A map whose failure path is
// broken is worse than no map — it is the silent fallback this replaced,
// wearing a seatbelt. Same discipline as `shot --selftest`.
function throws(label, fn) {
  try { fn(); } catch { return; }
  console.error(`  guard self-test FAILED: ${label} did not throw`);
  process.exitCode = 1;
}
throws('unmapped material', () => resolveRole('tree_default', 'notAMaterial'));
throws('_defaultMat with no prefix rule', () => resolveRole('zzz_unknown', '_defaultMat'));
throws('excluded-only material on a loaded model', () => resolveRole('tree_default', 'colorPurple'));
throws('loading an excluded model', () => resolveRole('flower_redA', 'colorRed'));
throws('a pack material with no role', () => assertCoverage(['grass', 'brandNewMaterial']));
console.log('guard self-test passed (5 failure paths throw).\n');

let failures = 0;
for (const pack of readdirSync(RAW, { withFileTypes: true })) {
  if (!pack.isDirectory()) continue;
  const dir = join(RAW, pack.name);
  const files = readdirSync(dir).filter((f) => /\.glb$/i.test(f)).sort();
  if (!files.length) continue;

  const paletteFile = join(dir, 'palette.json');
  if (existsSync(paletteFile)) {
    const names = Object.keys(JSON.parse(readFileSync(paletteFile, 'utf8')).materials);
    assertCoverage(names);
    console.log(`${pack.name}: palette.json declares ${names.length} materials — all classified`);
  }

  const roles = new Map();   // role -> { meshes, files }
  const mats = new Map();    // material -> role (for the by-material table)
  let loaded = 0, excluded = 0;

  for (const f of files) {
    const model = f.replace(/\.glb$/i, '');
    if (isExcluded(model)) { excluded++; continue; }
    loaded++;
    const seen = new Set();
    for (const mat of materialsOf(join(dir, f))) {
      let role;
      try { role = resolveRole(model, mat); }
      catch (e) { console.error(`  FAIL ${model} [${mat}]: ${e.message}`); failures++; continue; }
      const e = roles.get(role) || { meshes: 0, files: 0 };
      e.meshes++;
      if (!seen.has(role)) { e.files++; seen.add(role); }
      roles.set(role, e);
      // Label `_defaultMat` by the prefix rule that matched, not by the model —
      // `path_stone*` and `path_wood*` take different roles and a "path_*" row
      // would report one of them wrongly.
      const prefix = mat === '_defaultMat' ? DEFAULT_MAT_PREFIX.find(([q]) => model.startsWith(q))[0] : null;
      mats.set(prefix ? `_defaultMat(${prefix}*)` : mat, role);
    }
  }

  console.log(`${pack.name}: ${loaded} models loaded, ${excluded} excluded (${[...EXCLUDED_MODELS].length} on the list)`);
  console.log('\n  role      hex       meshes  files');
  const hist = [...roles.entries()].sort((a, b) => b[1].meshes - a[1].meshes);
  for (const [role, e] of hist) {
    console.log(`  ${role.padEnd(9)} ${P[role]}  ${String(e.meshes).padStart(6)} ${String(e.files).padStart(6)}`);
  }
  const unused = Object.keys(P).filter((k) => !roles.has(k));
  console.log(`\n  used   (${hist.length}/14): ${hist.map(([r]) => r).join(', ')}`);
  console.log(`  unused (${unused.length}/14): ${unused.join(', ')}`);

  console.log('\n  material -> role');
  for (const [m, r] of [...mats.entries()].sort()) console.log(`    ${m.padEnd(26)} ${r}`);
  console.log('');
}

if (failures) { console.error(`\n${failures} unresolved material use(s) — the map is incomplete.`); process.exit(1); }
console.log('all materials resolved.');

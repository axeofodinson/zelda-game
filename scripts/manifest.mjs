// P1 — scan assets/raw recursively for .glb/.gltf and write a manifest the app
// can fetch. The README's contract is "scan this folder recursively"; a browser
// cannot list a directory, so the scan happens here and ships as data.
// One entry per pack subfolder, because CREDITS.md logs licence per pack and a
// flat dump loses that mapping.
//
//   npm run assets
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../assets/raw/', import.meta.url).pathname;

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(glb|gltf)$/i.test(e)) out.push(p);
  }
  return out;
}

const packs = {};
for (const pack of readdirSync(ROOT)) {
  if (!statSync(join(ROOT, pack)).isDirectory()) continue;
  const models = walk(join(ROOT, pack))
    .map((p) => relative(join(ROOT, pack), p).replace(/\.glb$/i, ''))
    .sort();
  packs[pack] = { count: models.length, models };
}

const out = { generated: new Date().toISOString().slice(0, 10), packs };
writeFileSync(`${ROOT}manifest.json`, JSON.stringify(out, null, 2) + '\n');
for (const [k, v] of Object.entries(packs)) console.log(`${k}: ${v.count} models`);

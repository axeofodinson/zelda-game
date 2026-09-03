// §10 — the silhouette scan. P0 and P1 both gated on "is the inverted hull
// continuous at 25 m", both answered it with a column scan over a canvas
// readback, and neither committed the scanner — so P1b would have had to
// re-derive the instrument before it could compare against P1's numbers. It is
// committed now.
//
//   npm run scan -- [--dist 25] [--set a,b,c] [--w 1280] [--h 720]
//
// Method (P1's, restated): render the rig, read the canvas back, and for every
// column that crosses a prop's upper silhouette against the backdrop record
//   · bg      backdrop luminance just above the crossing
//   · dark    darkest luminance across the crossing — the ink line
//   · fill    interior luminance a few rows below it
// A torn hull (split verts, missing smooth normals) shows as columns where no
// pixel is measurably darker than what it sits against: `drop(bg)` and
// `drop(fill)`. Props are segmented out of the frame by pixel data alone, so
// the same scanner runs unchanged against any revision.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = '/opt/pw-browsers/chromium';
const launchOpts = { headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] };
if (existsSync(CHROME)) launchOpts.executablePath = CHROME;

const argv = process.argv.slice(2);
const flags = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    const k = argv[i].slice(2);
    flags[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : '1';
  }
}
const W = parseInt(flags.w || '1280', 10);
const H = parseInt(flags.h || '720', 10);
const DIST = flags.dist || '25';
const PORT = parseInt(flags.port || '5179', 10);

const q = new URLSearchParams();
for (const [k, v] of Object.entries(flags)) { if (['w', 'h', 'dist', 'port'].includes(k)) continue; q.set(k, v); }
q.set('p1', DIST);
q.set('probe', '1');

// A vite left over from an earlier run holds the port, `--strictPort` makes the
// new one exit, and this script — which resolves its start on a timeout — then
// scans WHATEVER that stale server is serving. That produced a bogus baseline
// during P1b: a worktree at the previous revision was scanned and handed back
// the CURRENT tree's numbers, identical to the decimal. Refuse to start rather
// than measure the wrong repo.
function assertPortFree() {
  return new Promise((resolve, reject) => {
    const s = createServer()
      .once('error', () => reject(new Error(
        `port ${PORT} is in use — a previous vite is still running. Kill it, or pass ` +
        '--port: whatever that server is serving is what would be measured.')))
      .once('listening', () => s.close(resolve))
      .listen(PORT, '127.0.0.1');
  });
}

// `npx vite` is a shell wrapper around the real server, so SIGTERM to the child
// kills the wrapper and orphans vite, which then holds the port and trips
// `assertPortFree` on the NEXT run. Own the whole process group and kill the
// group. Registered on exit paths too, so a crashed scan does not leak either.
let _group = null;
function stopServer() {
  if (_group === null) return;
  try { process.kill(-_group, 'SIGTERM'); } catch { /* already gone */ }
  _group = null;
}
process.on('exit', stopServer);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stopServer(); process.exit(1); });

function startServer() {
  const proc = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
    { cwd: new URL('..', import.meta.url).pathname, env: process.env, detached: true });
  _group = proc.pid;
  return new Promise((resolve) => {
    let out = '';
    const onData = (d) => { out += d.toString(); if (/Local:.*http/.test(out) || /ready in/.test(out)) resolve(proc); };
    proc.stdout.on('data', onData); proc.stderr.on('data', onData);
    setTimeout(() => resolve(proc), 8000);
  });
}

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// P0's verified hull band, restated here so the scan checks itself rather than
// handing a number to a human to compare. P0's §3.2 test rock measured 69.8.
const P0_BAND = [61, 101];
const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : NaN);

function analyse(px, w, h, bounds) {
  const at = (x, y) => { const i = (y * w + x) * 4; return [px[i], px[i + 1], px[i + 2]]; };

  return bounds.map((b) => {
    // Scan only this prop's own screen box, and take each column's backdrop
    // from a few rows above the box top — sky for a tall prop, ground or the
    // fogged horizon band for a short one. Comparing every column against its
    // OWN backdrop is what lets one scan span all three at once, and it is why
    // `drop(bg)` can be high on a prop whose backdrop is darker than its ink.
    const top = Math.max(6, b.y0 - 10);
    const bot = Math.min(h - 2, b.y1 + 2);
    const dark = [], fill = [], bg = [];
    let dropFill = 0, dropBg = 0, cols = 0;

    for (let x = Math.max(0, b.x0); x <= Math.min(w - 1, b.x1); x++) {
      const ref = at(x, top);
      let e = -1;
      for (let y = top + 2; y <= bot; y++) {
        const p = at(x, y);
        if (Math.abs(p[0] - ref[0]) + Math.abs(p[1] - ref[1]) + Math.abs(p[2] - ref[2]) > 24) { e = y; break; }
      }
      if (e < 0) continue;                       // column never crosses the prop
      cols++;
      const bl = lum(...at(x, Math.max(0, e - 3)));
      let d = Infinity;
      for (let y = Math.max(0, e - 2); y <= Math.min(h - 1, e + 4); y++) d = Math.min(d, lum(...at(x, y)));
      const inner = [];
      for (let y = e + 6; y <= Math.min(bot, e + 14); y++) inner.push(lum(...at(x, y)));
      const f = med(inner);
      dark.push(d); fill.push(f); bg.push(bl);
      if (Number.isFinite(f) && d > f - 6) dropFill++;
      if (d > bl - 6) dropBg++;
    }

    const r1 = (n) => (Number.isFinite(n) ? n.toFixed(1) : '-');
    // `darkMin` is a single-pixel extreme by construction, so on its own it
    // cannot distinguish "the whole line is darker" from "one column caught two
    // ink lines crossing". `subLo` counts the columns actually below P0's floor.
    const subLo = dark.filter((d) => d < P0_BAND[0]).length;
    return { name: b.name, cols,
      darkMin: r1(Math.min(...dark)), darkMed: r1(med(dark)),
      fillMed: r1(med(fill)), bgMed: r1(med(bg)), dropFill, dropBg,
      subLo, subLoPct: cols ? Math.round((subLo / cols) * 100) : 0 };
  });
}

async function main() {
  await assertPortFree();
  await startServer();
  await sleep(1000);
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const logs = [], errors = [];
  page.on('console', (m) => { const t = m.text(); if (/^\[plateau\]/.test(t)) logs.push(t);
    if (m.type() === 'error' && !/favicon\.ico/.test(t)) errors.push(t); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

  const url = `http://localhost:${PORT}/?${q.toString()}`;
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  try { await page.waitForFunction(() => window.__ready === true, { timeout: 30000 }); }
  catch { errors.push('timeout: window.__ready never became true'); }
  await sleep(500);

  const { px, w, h, bounds } = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const t = document.createElement('canvas'); t.width = c.width; t.height = c.height;
    t.getContext('2d').drawImage(c, 0, 0);
    const d = t.getContext('2d').getImageData(0, 0, c.width, c.height);
    return { px: Array.from(d.data), w: c.width, h: c.height,
      bounds: typeof window.__props === 'function' ? window.__props() : null };
  });
  if (!bounds) { console.error('page exposed no window.__props — nothing to scan'); process.exit(1); }
  await browser.close(); stopServer();

  const rows = analyse(px, w, h, bounds);
  console.log(`\n=== scan @ ${DIST} m ===  ${url}`);
  console.log(`  serving: ${new URL('..', import.meta.url).pathname}`);
  for (const l of logs) console.log('  ' + l);
  console.log(`\n  model                   cols  darkMin  darkMed  fillMed   bgMed  drop(fill)  drop(bg)  below${P0_BAND[0]}`);
  for (const r of rows) {
    console.log(`  ${r.name.padEnd(22)}  ${String(r.cols).padStart(4)}  ${r.darkMin.padStart(7)}  ${r.darkMed.padStart(7)}  ${r.fillMed.padStart(7)}  ${r.bgMed.padStart(6)}  ${String(r.dropFill).padStart(10)}  ${String(r.dropBg).padStart(8)}  ${String(r.subLo + '/' + r.cols).padStart(8)}`);
  }
  const mins = rows.map((r) => parseFloat(r.darkMin)).filter(Number.isFinite);
  const meds = rows.map((r) => parseFloat(r.darkMed)).filter(Number.isFinite);
  console.log(`\n  darkMin band: ${Math.min(...mins).toFixed(1)} - ${Math.max(...mins).toFixed(1)}   darkMed band: ${Math.min(...meds).toFixed(1)} - ${Math.max(...meds).toFixed(1)}`);
  console.log(`  P0 verified band: ${P0_BAND[0]} - ${P0_BAND[1]} (test rock 69.8). Below the floor means a DARKER`);
  console.log('  line than P0 measured, which is the safe direction — a torn hull shows as a');
  console.log('  BRIGHTER line with dark close to fill, i.e. as drop(fill)/drop(bg), not here.');
  if (errors.length) { console.error('errors: ' + errors.join('; ')); process.exit(1); }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

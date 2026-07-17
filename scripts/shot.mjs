// §0.5 — The screenshot loop. P0's first deliverable, built before the renderer.
// Claude Code cannot see; every visual bug otherwise costs a human round trip.
// Headless Playwright -> shots/<name>.png. Mandatory instrument requirements:
//   · forward EVERY param verbatim (no whitelist)
//   · burn the resolved URL into the PNG (a misforwarded param must be visible)
//   · print the URL, exit nonzero on any console error (filter only favicon)
//   · self-test on first run (a known 2x2 grid) — a broken instrument makes
//     every other conclusion this session untrustworthy
//
//   npm run shot -- <name> [--any key value ...]
//   npm run shot -- --selftest        (run only the instrument self-test)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = '/opt/pw-browsers/chromium';
const launchOpts = { headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] };
if (existsSync(CHROME)) launchOpts.executablePath = CHROME;

const argv = process.argv.slice(2);
const name = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'shot';
const flags = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    const k = argv[i].slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : '1';
    flags[k] = v;
  }
}

const W = parseInt(flags.w || '1280', 10);
const H = parseInt(flags.h || '720', 10);
const PORT = 5178;
const ROOT = new URL('..', import.meta.url).pathname;
const OUT = new URL('../shots/', import.meta.url).pathname;
const MARKER = `${OUT}.selftest-ok`;
mkdirSync(OUT, { recursive: true });

function startServer() {
  const proc = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
    { cwd: ROOT, env: process.env });
  return new Promise((resolve) => {
    let out = '';
    const onData = (d) => { out += d.toString(); if (/Local:.*http/.test(out) || /ready in/.test(out)) resolve(proc); };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    setTimeout(() => resolve(proc), 8000);
  });
}

// Read the four quadrant-centre pixels of a page's canvas via a 2D readback.
async function readQuadrants(page) {
  return page.evaluate(({ w, h }) => {
    const c = document.querySelector('canvas');
    const t = document.createElement('canvas'); t.width = c.width; t.height = c.height;
    const ctx = t.getContext('2d'); ctx.drawImage(c, 0, 0);
    const pt = (x, y) => { const d = ctx.getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]]; };
    return { TL: pt(w * 0.25, h * 0.25), TR: pt(w * 0.75, h * 0.25), BL: pt(w * 0.25, h * 0.75), BR: pt(w * 0.75, h * 0.75) };
  }, { w: W, h: H });
}

// Assert the instrument itself works: render selftest.html's known grid and
// confirm the four pixels read back correctly.
async function selfTest(page) {
  await page.goto(`http://localhost:${PORT}/selftest.html`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => window.__ready === true, { timeout: 10000 });
  await sleep(200);
  const q = await readQuadrants(page);
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 24);
  const ok = near(q.TL, [255, 0, 0]) && near(q.TR, [0, 255, 0]) && near(q.BL, [0, 0, 255]) && near(q.BR, [255, 255, 255]);
  if (!ok) throw new Error(`instrument self-test FAILED: ${JSON.stringify(q)} (expected TL red, TR green, BL blue, BR white)`);
  writeFileSync(MARKER, new Date().toISOString());
  return q;
}

async function main() {
  const server = await startServer();
  await sleep(1000);
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon\.ico/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

  // Self-test: forced with --selftest, else once per repo (marker absent).
  const forceSelfTest = 'selftest' in flags;
  if (forceSelfTest || !existsSync(MARKER)) {
    try {
      const q = await selfTest(page);
      console.log(`instrument self-test PASSED  ${JSON.stringify(q)}`);
    } catch (e) {
      console.error(String(e.message || e));
      await browser.close(); server.kill('SIGTERM'); process.exit(1);
    }
    if (forceSelfTest) { await browser.close(); server.kill('SIGTERM'); process.exit(0); }
  }

  // Forward every flag as a query param (except tool-only w/h/selftest).
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(flags)) { if (k === 'w' || k === 'h' || k === 'selftest') continue; q.set(k, v); }
  const url = `http://localhost:${PORT}/?${q.toString()}`;

  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  try { await page.waitForFunction(() => window.__ready === true, { timeout: 15000 }); }
  catch { errors.push('timeout: window.__ready never became true'); }
  await sleep(600);

  // Burn the resolved URL into the PNG — a misforwarded param must be visible
  // in the artifact, because that's the only place you'll look.
  await page.evaluate((text) => {
    const d = document.createElement('div');
    d.textContent = text;
    Object.assign(d.style, {
      position: 'fixed', left: '0', top: '0', zIndex: '99999',
      font: '12px/1.4 monospace', color: '#fff', background: 'rgba(0,0,0,0.55)',
      padding: '2px 6px', whiteSpace: 'pre', pointerEvents: 'none',
    });
    document.body.appendChild(d);
  }, url);
  await sleep(50);

  const outPath = `${OUT}${name}.png`;
  await page.screenshot({ path: outPath });
  await browser.close();
  server.kill('SIGTERM');

  console.log(`\n=== shot [${name}] ===  ${url}`);
  console.log(`saved: ${outPath}`);
  if (errors.length) {
    console.error(`console/page errors (${errors.length}):`);
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }
  console.log('no console errors.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

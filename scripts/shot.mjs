// §0.5 — The screenshot loop. Phase 0's first deliverable, built before the
// renderer. Claude Code cannot see; every visual bug otherwise costs a human
// round trip. Headless Playwright -> shots/<name>.png, prints console errors,
// exits nonzero on any error.
//
//   npm run shot -- <name> [--sun 0.3] [--hour 12] [--pos x,y,z] [--look x,y,z]
//                          [--quality low] [--w 1280] [--h 720] [--orbit]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = '/opt/pw-browsers/chromium';
const launchOpts = { headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] };
if (existsSync(CHROME)) launchOpts.executablePath = CHROME;

// ---- args ----
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

// Forward every flag to the page as a query param (except tool-only w/h).
const q = new URLSearchParams();
for (const [k, v] of Object.entries(flags)) {
  if (k === 'w' || k === 'h') continue;
  q.set(k, v);
}

const W = parseInt(flags.w || '1280', 10);
const H = parseInt(flags.h || '720', 10);
const PORT = 5178;
const OUT = new URL('../shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

function startServer() {
  const proc = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
    { cwd: new URL('..', import.meta.url).pathname, env: process.env });
  return new Promise((resolve) => {
    let out = '';
    const onData = (d) => { out += d.toString(); if (/Local:.*http/.test(out) || /ready in/.test(out)) resolve(proc); };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    setTimeout(() => resolve(proc), 8000);
  });
}

async function main() {
  const server = await startServer();
  await sleep(1000);

  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

  const errors = [];
  const ignore = (t) => /favicon\.ico/.test(t); // headless has no favicon route
  page.on('console', (m) => { if (m.type() === 'error' && !ignore(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

  const url = `http://localhost:${PORT}/?${q.toString()}`;
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });

  // wait for first rendered frame
  try {
    await page.waitForFunction(() => window.__ready === true, { timeout: 15000 });
  } catch { errors.push('timeout: window.__ready never became true'); }
  await sleep(600); // let a few frames settle (bloom/AA)

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

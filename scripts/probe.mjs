// §0.5 — `probe`: pixel-readback ground truth. NOT a last resort — the second
// thing you reach for. Reads the final canvas at given screen coords and prints
// RGB, so a defect can be stated as a testable assertion before any hypothesis.
//
//   npm run probe -- <name> --at x,y[;x,y;...] [--any key value ...]
//
// Forwards every flag to the page as a query param (same rule as shot), and adds
// probe=1 so the app enables preserveDrawingBuffer for an accurate readback.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = '/opt/pw-browsers/chromium';
const launchOpts = { headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] };
if (existsSync(CHROME)) launchOpts.executablePath = CHROME;

const argv = process.argv.slice(2);
const name = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'probe';
const flags = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    const k = argv[i].slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : '1';
    flags[k] = v;
  }
}

const at = (flags.at || '640,360').split(';').map((p) => p.split(',').map(Number));
const W = parseInt(flags.w || '1280', 10);
const H = parseInt(flags.h || '720', 10);

const q = new URLSearchParams();
for (const [k, v] of Object.entries(flags)) { if (k === 'w' || k === 'h' || k === 'at') continue; q.set(k, v); }
q.set('probe', '1');

const PORT = 5178;

function startServer() {
  const proc = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
    { cwd: new URL('..', import.meta.url).pathname, env: process.env });
  return new Promise((resolve) => {
    let out = '';
    const onData = (d) => { out += d.toString(); if (/Local:.*http/.test(out) || /ready in/.test(out)) resolve(proc); };
    proc.stdout.on('data', onData); proc.stderr.on('data', onData);
    setTimeout(() => resolve(proc), 8000);
  });
}

async function main() {
  const server = await startServer();
  await sleep(1000);
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon\.ico/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

  const url = `http://localhost:${PORT}/?${q.toString()}`;
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  try { await page.waitForFunction(() => window.__ready === true, { timeout: 15000 }); }
  catch { errors.push('timeout: window.__ready never became true'); }
  await sleep(400);

  const rgb = await page.evaluate((coords) => {
    const c = document.querySelector('canvas');
    const t = document.createElement('canvas'); t.width = c.width; t.height = c.height;
    const ctx = t.getContext('2d'); ctx.drawImage(c, 0, 0);
    return coords.map(([x, y]) => {
      const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
      return [d[0], d[1], d[2]];
    });
  }, at);

  await browser.close(); server.kill('SIGTERM');

  console.log(`\n=== probe [${name}] ===  ${url}`);
  for (let i = 0; i < at.length; i++) {
    console.log(`  (${at[i][0]},${at[i][1]}) -> rgb(${rgb[i].join(', ')})  #${rgb[i].map((n) => n.toString(16).padStart(2, '0')).join('')}`);
  }
  if (errors.length) { console.error('errors: ' + errors.join('; ')); process.exit(1); }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

// Gate harness (§10). Boots the dev server, loads the page headless, asserts
// zero console errors, screenshots, and confirms the scene is actually moving.
//
//   node scripts/verify.mjs [label]
//
// Screenshots land in .verify/<label>-{a,b,c}.png. Exit code is nonzero if any
// gate assertion fails.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

// The environment ships a Chromium that may not match the npm playwright's
// expected revision; point straight at it when present.
const CHROME = '/opt/pw-browsers/chromium';
const launchOpts = { headless: true };
if (existsSync(CHROME)) launchOpts.executablePath = CHROME;

const label = process.argv[2] || 'phase';
const PORT = 5178;
const PAGE_URL = `http://localhost:${PORT}/`;
const OUT = new URL('../.verify/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

function startServer() {
  const proc = spawn(
    'npx',
    ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
    { cwd: new URL('..', import.meta.url).pathname, env: process.env }
  );
  return new Promise((resolve, reject) => {
    let out = '';
    const onData = (d) => {
      out += d.toString();
      if (/Local:.*http/.test(out) || /ready in/.test(out)) resolve(proc);
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('exit', (code) => reject(new Error(`vite exited early (${code})\n${out}`)));
    setTimeout(() => resolve(proc), 8000); // fallback: assume up
  });
}

async function main() {
  const server = await startServer();
  await sleep(1200);

  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 20000 });
  await sleep(3000); // §10 step 2

  const shotA = `${OUT}${label}-a.png`;
  const shotB = `${OUT}${label}-b.png`;
  const shotC = `${OUT}${label}-c.png`;
  const bufA = await page.screenshot({ path: shotA });
  await sleep(500);
  const bufB = await page.screenshot({ path: shotB });
  await sleep(500);
  const bufC = await page.screenshot({ path: shotC });

  const movedAB = !bufA.equals(bufB);
  const movedBC = !bufB.equals(bufC);

  await browser.close();
  server.kill('SIGTERM');

  // ---- Report ----
  const fail = [];
  if (consoleErrors.length) fail.push(`console errors:\n  ${consoleErrors.join('\n  ')}`);
  if (pageErrors.length) fail.push(`page errors:\n  ${pageErrors.join('\n  ')}`);
  if (!(movedAB || movedBC)) fail.push('scene did not change across 3 frames (no motion)');

  console.log(`\n=== VERIFY [${label}] ===`);
  console.log(`console errors : ${consoleErrors.length}`);
  console.log(`page errors    : ${pageErrors.length}`);
  console.log(`motion A!=B    : ${movedAB}`);
  console.log(`motion B!=C    : ${movedBC}`);
  console.log(`screenshots    : ${shotA}\n                 ${shotB}\n                 ${shotC}`);

  if (fail.length) {
    console.error(`\nGATE FAILED:\n- ${fail.join('\n- ')}`);
    process.exit(1);
  }
  console.log('\nGATE PASSED (automated checks). Now LOOK at the screenshot.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

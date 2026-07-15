// Phase 6 gate (§10): hitstop, shake, and kill-slowdown are in. Confirms each
// mechanism actually engages (not just "no errors").
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = '/opt/pw-browsers/chromium';
const launchOpts = { headless: true };
if (existsSync(CHROME)) launchOpts.executablePath = CHROME;
const PORT = 5178;
const PAGE_URL = `http://localhost:${PORT}/`;

function startServer() {
  const proc = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
    { cwd: new URL('..', import.meta.url).pathname, env: process.env });
  return new Promise((r) => { let o = ''; const on = (d) => { o += d; if (/Local:.*http|ready in/.test(o)) r(proc); }; proc.stdout.on('data', on); proc.stderr.on('data', on); setTimeout(() => r(proc), 8000); });
}

async function main() {
  const server = await startServer();
  await sleep(1200);
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(PAGE_URL, { waitUntil: 'load' });
  await sleep(1200);

  const r = await page.evaluate(async () => {
    const C = window.__CINDERCAST__;
    // hitstop
    C.triggerHitstop(150);
    const hitstop = C.feelState().hitstop;
    // kill slowdown
    C.triggerKillSlow();
    const slow = C.feelState().slow;
    const ts = C.feelState().timeScale;
    // shake (camera) — read magnitude after a vent
    C.setBlade(100);
    C.forceVent();
    await new Promise((res) => setTimeout(res, 16));
    const shake = C.cameraRig.shake;
    // squash on plunge rise
    C.tinn.setSquash(1.12);
    const squash = C.feelState().squashY;
    return { hitstop, slow, ts, shake, squash };
  });

  await browser.close();
  server.kill('SIGTERM');

  console.log('\n=== FEEL (PHASE 6) ===');
  console.log(`hitstop engages : ${r.hitstop}`);
  console.log(`kill slowdown   : ${r.slow} (timeScale=${r.ts})`);
  console.log(`vent shake mag  : ${r.shake?.toFixed(3)}`);
  console.log(`squash/stretch  : ${r.squash}`);

  const fail = [];
  if (errs.length) fail.push('errors: ' + errs.join('; '));
  if (!r.hitstop) fail.push('hitstop did not engage');
  if (!(r.slow && r.ts <= 0.3)) fail.push('kill slowdown did not engage');
  if (!(r.shake > 0.1)) fail.push('vent did not shake the camera');
  if (!(r.squash > 1.0)) fail.push('squash & stretch not applied');
  if (fail.length) { console.error('\nGATE FAILED:\n- ' + fail.join('\n- ')); process.exit(1); }
  console.log('\nGATE PASSED — hitstop, kill-slowdown, shake, and squash all engage.');
}
main().catch((e) => { console.error(e); process.exit(1); });

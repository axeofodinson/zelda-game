// Phase 2 gate (§10): prove the vent radius scales with blade heat. Vents at 30
// and 100 heat, screenshots each from overhead, and asserts the ring radius
// (and the actual hitbox radius reported by combat) differ as §4 specifies.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = '/opt/pw-browsers/chromium';
const launchOpts = { headless: true };
if (existsSync(CHROME)) launchOpts.executablePath = CHROME;

const PORT = 5178;
const PAGE_URL = `http://localhost:${PORT}/`;
const OUT = new URL('../.verify/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

function startServer() {
  const proc = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: new URL('..', import.meta.url).pathname, env: process.env,
  });
  return new Promise((resolve) => {
    let out = '';
    const on = (d) => { out += d; if (/Local:.*http|ready in/.test(out)) resolve(proc); };
    proc.stdout.on('data', on); proc.stderr.on('data', on);
    setTimeout(() => resolve(proc), 8000);
  });
}

async function main() {
  const server = await startServer();
  await sleep(1200);
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 720, height: 720 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(PAGE_URL, { waitUntil: 'load' });
  await sleep(1500);

  // Overhead camera, Tinn in the open.
  await page.evaluate(() => {
    const C = window.__CINDERCAST__;
    C.tinn.root.position.set(0, 0, 0);
    C.overhead(11);
  });
  await sleep(400);

  async function ventAt(heat, tag) {
    await page.evaluate((h) => {
      const C = window.__CINDERCAST__;
      C.tinn.root.position.set(0, 0, 0);
      C.setBlade(h);
      C.forceVent();
    }, heat);
    await sleep(140); // near the ring's peak radius
    const radius = await page.evaluate(() => window.__CINDERCAST__.combat.ventRadius);
    await page.screenshot({ path: `${OUT}vent-${tag}.png` });
    await sleep(700); // let the vent finish before the next
    return radius;
  }

  const r30 = await ventAt(30, '30');
  const r100 = await ventAt(100, '100');

  // Heat-loop sanity: slashing cools the enemy and heats the blade to searing.
  // Use a tanky enemy so it survives long enough to observe searing.
  const loop = await page.evaluate(async () => {
    const C = window.__CINDERCAST__;
    C.placeAtDummy();
    C.heat.blade = 0;
    C.enemies[0].heat = 200;
    C.enemies[0].maxHeat = 200;
    const before = C.enemies[0].heat;
    for (let i = 0; i < 12 && C.heat.blade < 90; i++) {
      if (C.combat.state === 'idle') C.forceSlash();
      await new Promise((r) => setTimeout(r, 200));
    }
    return { before, afterDummy: C.enemies[0].heat, blade: C.heat.blade, searing: C.heat.searing };
  });

  await browser.close();
  server.kill('SIGTERM');

  console.log('\n=== VENT RADIUS GATE ===');
  console.log(`radius @30 heat : ${r30?.toFixed(2)} (expect ~2.0)`);
  console.log(`radius @100 heat: ${r100?.toFixed(2)} (expect ~5.5)`);
  console.log(`screenshots     : ${OUT}vent-30.png , ${OUT}vent-100.png`);
  console.log('\n=== HEAT LOOP ===');
  console.log(`dummy heat ${loop.before} -> ${loop.afterDummy.toFixed(1)} (cooled by slashes)`);
  console.log(`blade heat after 6 slashes: ${loop.blade.toFixed(1)}  searing=${loop.searing}`);

  const fail = [];
  if (errs.length) fail.push('page errors: ' + errs.join('; '));
  if (!(r100 > r30 + 2)) fail.push(`vent radius did not scale (${r30} -> ${r100})`);
  if (!(loop.afterDummy < loop.before)) fail.push('slashes did not cool the dummy');
  if (!(loop.blade >= 85)) fail.push('blade did not reach searing after 6 slashes');
  if (fail.length) { console.error('\nGATE FAILED:\n- ' + fail.join('\n- ')); process.exit(1); }
  console.log('\nGATE PASSED. Now compare vent-30.png and vent-100.png.');
}
main().catch((e) => { console.error(e); process.exit(1); });

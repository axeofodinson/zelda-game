// Phase 3 gate (§10): each enemy's trick works + a cooled statue is standable.
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
  const page = await browser.newPage({ viewport: { width: 720, height: 540 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(PAGE_URL, { waitUntil: 'load' });
  await sleep(1500);

  // --- Crucible: body armored (no cool), open top coolable only when exposed.
  const crucible = await page.evaluate(() => {
    const C = window.__CINDERCAST__;
    const cr = C.enemies[2];
    const armoredWhenClosed = cr.coolSpheres().length === 0 && cr.armorSpheres().length > 0;
    C.exposeCrucible(2);
    const before = cr.heat;
    cr.cool(70, { plunge: true }); // plunge the exposed top
    return { armoredWhenClosed, cooledWhenExposed: before - cr.heat };
  });

  // --- Sprue: a hit while tilted does double cooling and cancels the pour.
  const sprue = await page.evaluate(() => {
    const C = window.__CINDERCAST__;
    const s = C.enemies[1];
    s.heat = 80; s.tilted = true; s.mode = 'pour';
    const before = s.heat;
    const res = s.cool(14); // a normal 14 becomes 28 while tilted
    return { cooled: res.cooled, cancelled: s.mode === 'recover' && s.tilted === false };
  });

  // --- Flashlings: one flask shatters the whole swarm.
  const flash = await page.evaluate(() => {
    const C = window.__CINDERCAST__;
    const fls = C.enemies.filter((e) => e.constructor.name === 'Flashling');
    const before = fls.filter((e) => !e.dead).length;
    const p = fls[0].position;
    C.detonateFlask(p.x, p.z);
    const after = fls.filter((e) => !e.dead).length;
    return { before, after };
  });

  // --- Statue standability: cool a Cull, let it topple, stand Tinn on it.
  await page.evaluate(() => window.__CINDERCAST__.killEnemy(0));
  await sleep(1400); // topple + register platform
  const stand = await page.evaluate(async () => {
    const C = window.__CINDERCAST__;
    const info = C.standOn(0); // drop Tinn above the fallen Cull
    await new Promise((r) => setTimeout(r, 700)); // let him fall + land
    return { top: info.enemyTop, tinnY: C.tinnY() };
  });

  await page.evaluate(() => window.__CINDERCAST__.cameraRig.setOverhead(9));
  await sleep(300);
  await page.screenshot({ path: new URL('../.verify/phase3-tricks.png', import.meta.url).pathname });

  await browser.close();
  server.kill('SIGTERM');

  console.log('\n=== PHASE 3 TRICKS ===');
  console.log(`Crucible: body armored=${crucible.armoredWhenClosed}, exposed-top cooled=${crucible.cooledWhenExposed}`);
  console.log(`Sprue:    tilt cooling=${sprue.cooled} (expect ~28), pour cancelled=${sprue.cancelled}`);
  console.log(`Flashlings: alive ${flash.before} -> ${flash.after} after one flask`);
  console.log(`Statue:   Cull top=${stand.top}, Tinn landed at y=${stand.tinnY?.toFixed(2)} (expect ~${stand.top})`);

  const fail = [];
  if (errs.length) fail.push('errors: ' + errs.join('; '));
  if (!crucible.armoredWhenClosed) fail.push('Crucible body not armored when closed');
  if (!(crucible.cooledWhenExposed >= 60)) fail.push('Crucible top not coolable when exposed');
  if (!(sprue.cooled >= 27)) fail.push('Sprue tilt did not double cooling');
  if (!sprue.cancelled) fail.push('Sprue pour not cancelled by tilt hit');
  if (!(flash.before >= 4 && flash.after === 0)) fail.push('flask did not shatter the whole swarm');
  if (!(stand.tinnY > stand.top - 0.15)) fail.push(`Tinn did not stand on the statue (y=${stand.tinnY})`);
  if (fail.length) { console.error('\nGATE FAILED:\n- ' + fail.join('\n- ')); process.exit(1); }
  console.log('\nGATE PASSED.');
}
main().catch((e) => { console.error(e); process.exit(1); });

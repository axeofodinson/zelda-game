// Phase 5 gate (§10): Phase 1's cooled hands must be climbable to reach Phase 2.
// If they aren't, the whole boss is broken. Also verifies the arc completes:
// heart plunge dumps blade heat, and death lifts the fog.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = '/opt/pw-browsers/chromium';
const launchOpts = { headless: true };
if (existsSync(CHROME)) launchOpts.executablePath = CHROME;
const PORT = 5178;
const PAGE_URL = `http://localhost:${PORT}/?boss=1`;

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

  const setup = await page.evaluate(() => {
    const C = window.__CINDERCAST__;
    return { phase: C.orant.phase, hands: C.orant.hands.length, enemies: C.enemies.length };
  });

  // Phase 1: cool both hands. They topple into verdigris statues.
  await page.evaluate(() => { window.__CINDERCAST__.killEnemy(0); window.__CINDERCAST__.killEnemy(1); });
  await sleep(1600); // topple + register platforms

  // THE GATE: stand Tinn on a cooled hand — it must hold him aloft (climbable).
  const climb = await page.evaluate(async () => {
    const C = window.__CINDERCAST__;
    const standable = C.orant.hands.every((h) => h.standable);
    const info = C.standOn(0); // drop Tinn onto hand 0
    await new Promise((r) => setTimeout(r, 800));
    return { standable, top: info.enemyTop, tinnY: C.tinnY(), phase: C.orant.phase };
  });

  // Arc completes: reach the chest -> expose + plunge the heart -> death -> fog lifts.
  const finish = await page.evaluate(async () => {
    const C = window.__CINDERCAST__;
    C.orant.phase = 3;
    C.orant.heart.expose(true);
    const dumps = C.orant.heart.dumpsBladeHeat;
    C.orant.heart.cool(70, { plunge: true });
    C.orant.heart.cool(70, { plunge: true });
    C.orant.heart.cool(70, { plunge: true });
    await new Promise((r) => setTimeout(r, 1500)); // let the death sequence run
    return { dumps, heartDead: C.orant.heart.dead, deathStarted: C.orant.deathT >= 0, skyLift: C.arena.sky.mat.uniforms.uLift.value };
  });

  await page.evaluate(() => window.__CINDERCAST__.cameraRig.setOverhead(16));
  await sleep(300);
  await page.screenshot({ path: new URL('../.verify/orant.png', import.meta.url).pathname });

  await browser.close();
  server.kill('SIGTERM');

  console.log('\n=== ORANT (PHASE 5) ===');
  console.log(`setup: phase=${setup.phase} hands=${setup.hands} enemies=${setup.enemies}`);
  console.log(`GATE — hands standable=${climb.standable}, hand top=${climb.top}, Tinn stands at y=${climb.tinnY?.toFixed(2)}, phase->${climb.phase}`);
  console.log(`arc: heart dumps ${finish.dumps} blade heat, heart dead=${finish.heartDead}, death started=${finish.deathStarted}, fog lift=${finish.skyLift?.toFixed(2)}`);

  const fail = [];
  if (errs.length) fail.push('errors: ' + errs.join('; '));
  if (!(setup.phase === 1 && setup.hands === 2)) fail.push('boss did not start in Phase 1 with two hands');
  if (!climb.standable) fail.push('cooled hands are not standable geometry');
  if (!(climb.tinnY > climb.top - 0.2)) fail.push(`Tinn cannot climb the cooled hand (y=${climb.tinnY})`);
  if (!(climb.phase === 2)) fail.push('boss did not advance to Phase 2 after both hands cooled');
  if (!(finish.dumps === 90)) fail.push('heart does not dump 90 blade heat');
  if (!finish.heartDead) fail.push('heart did not die after 3 plunges');
  if (!(finish.deathStarted && finish.skyLift > 0.05)) fail.push('death sequence / fog lift did not run');
  if (fail.length) { console.error('\nGATE FAILED:\n- ' + fail.join('\n- ')); process.exit(1); }
  console.log('\nGATE PASSED — cooled hands are climbable into Phase 2; the arc completes and the fog lifts.');
}
main().catch((e) => { console.error(e); process.exit(1); });

// Phase 7 gate (§10): open the built index.html from file:// with the network
// disabled — it must play. No dev server; loads the single file directly.
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = '/opt/pw-browsers/chromium';
const launchOpts = { headless: true };
if (existsSync(CHROME)) launchOpts.executablePath = CHROME;

const FILE = new URL('../dist/index.html', import.meta.url).pathname;
const FILE_URL = `file://${FILE}?demo=1`;

async function main() {
  if (!existsSync(FILE)) { console.error('dist/index.html not found — run `npm run build`'); process.exit(1); }

  const browser = await chromium.launch(launchOpts);
  const context = await browser.newContext({ viewport: { width: 720, height: 540 } });
  await context.setOffline(true); // network is OFF

  // Belt and braces: abort any http(s) request that somehow gets attempted.
  let networkAttempts = 0;
  await context.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('http://') || u.startsWith('https://')) { networkAttempts++; return route.abort(); }
    return route.continue();
  });

  const page = await context.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(e.message));

  await page.goto(FILE_URL, { waitUntil: 'load' });
  await sleep(3000);

  const a = await page.screenshot();
  await sleep(600);
  const b = await page.screenshot({ path: new URL('../.verify/ship.png', import.meta.url).pathname });
  const moved = !a.equals(b);
  const ready = await page.evaluate(() => !!(window.__CINDERCAST__ && window.__CINDERCAST__.ready));

  await browser.close();

  console.log('\n=== SHIP (PHASE 7) ===');
  console.log(`file://           : ${FILE}`);
  console.log(`network attempts  : ${networkAttempts} (blocked)`);
  console.log(`app ready         : ${ready}`);
  console.log(`console errors    : ${errs.length}`);
  console.log(`scene animating   : ${moved}`);

  const fail = [];
  if (errs.length) fail.push('console/page errors:\n  ' + errs.join('\n  '));
  if (!ready) fail.push('app did not initialize');
  if (!moved) fail.push('scene not animating (not playing)');
  if (networkAttempts > 0) fail.push(`${networkAttempts} network request(s) attempted — not fully self-contained`);
  if (fail.length) { console.error('\nGATE FAILED:\n- ' + fail.join('\n- ')); process.exit(1); }
  console.log('\nGATE PASSED — the built file plays offline from file://.');
}
main().catch((e) => { console.error(e); process.exit(1); });

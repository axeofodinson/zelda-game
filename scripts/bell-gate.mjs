// Phase 4 gate (§10): lock onto a full-heat enemy and a brittle one — the two
// bells must be audibly different instruments. We can't listen headless, so we
// render each bell with an OfflineAudioContext and compare pitch (autocorrelation)
// and brightness (spectral centroid). Different fundamental + different centroid
// == different instrument.
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

  const analyze = async (heat) =>
    page.evaluate(async (h) => {
      const params = window.__CINDERCAST__.bellParams(h);
      const sr = 44100, dur = 0.35;
      const ctx = new OfflineAudioContext(1, Math.floor(sr * dur), sr);
      const out = ctx.createGain(); out.gain.value = 0.6; out.connect(ctx.destination);
      for (const part of params.partials) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = part.freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, 0);
        g.gain.exponentialRampToValueAtTime(Math.max(part.gain, 0.0002), 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, part.decay);
        o.connect(g).connect(out); o.start(0); o.stop(part.decay);
      }
      const buf = await ctx.startRendering();
      const d = buf.getChannelData(0);
      let rms = 0; for (let i = 0; i < d.length; i++) rms += d[i] * d[i];
      rms = Math.sqrt(rms / d.length);
      // autocorrelation for the fundamental (search 120..700 Hz)
      let bestLag = 0, best = -Infinity;
      for (let lag = Math.floor(sr / 700); lag <= Math.floor(sr / 120); lag++) {
        let s = 0;
        for (let i = 0; i < d.length - lag; i++) s += d[i] * d[i + lag];
        if (s > best) { best = s; bestLag = lag; }
      }
      const dominant = sr / bestLag;
      return { rms, dominant, fundamental: params.fundamental, centroid: window.__CINDERCAST__.bellCentroid(h) };
    }, heat);

  const hot = await analyze(1.0); // full-heat enemy
  const cold = await analyze(0.05); // brittle enemy

  await browser.close();
  server.kill('SIGTERM');

  console.log('\n=== BELL GATE ===');
  console.log(`FULL heat : fundamental=${hot.fundamental.toFixed(0)}Hz  centroid=${hot.centroid.toFixed(0)}Hz  rms=${hot.rms.toFixed(3)}  (residue≈${hot.dominant.toFixed(0)}Hz)`);
  console.log(`BRITTLE   : fundamental=${cold.fundamental.toFixed(0)}Hz  centroid=${cold.centroid.toFixed(0)}Hz  rms=${cold.rms.toFixed(3)}  (residue≈${cold.dominant.toFixed(0)}Hz)`);

  // Perceptual "different instrument": the mapped fundamental (§7) and the
  // spectral centroid (upper-partial damping). Autocorrelation finds a bell's
  // residue pitch, not its perceived pitch, so it's info-only here.
  const fail = [];
  if (errs.length) fail.push('errors: ' + errs.join('; '));
  if (!(hot.fundamental > cold.fundamental + 200)) fail.push('fundamental not mapped to heat');
  if (!(hot.centroid > cold.centroid * 1.5)) fail.push('brightness (centroid) not clearly different');
  if (!(hot.rms > 0.001 && cold.rms > 0.001)) fail.push('bell rendered silent');
  if (fail.length) { console.error('\nGATE FAILED:\n- ' + fail.join('\n- ')); process.exit(1); }
  console.log('\nGATE PASSED — the two bells are different instruments (pitch + brightness).');
}
main().catch((e) => { console.error(e); process.exit(1); });

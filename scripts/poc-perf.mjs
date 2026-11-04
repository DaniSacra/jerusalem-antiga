// 3D proof of concept: frame rate and screenshots on a simulated mid-range phone (844 x 390,
// deviceScaleFactor 2.6, CPU slowed 4x), for 40 and 150 buildings by day, by night and in the rain,
// at automatic quality (as a player gets it) and forced high quality; and the 2D game in the
// same browser, on the same 150-building city (through the 2D/3D toggle).
//
// Usage: node scripts/poc-perf.mjs [--soft] [--shots-only]
//   default: the real GPU when the WSL D3D12 driver is there (else Chromium's default);
//   --soft:  software rendering (SwiftShader), a pessimistic, fill-rate bound measure.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5175;
const BASE = `http://localhost:${PORT}`;
const OUT = 'screenshots/poc';
const soft = process.argv.includes('--soft');
const shotsOnly = process.argv.includes('--shots-only');
mkdirSync(OUT, { recursive: true });

const server = spawn('node_modules/.bin/vite', ['--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'inherit'] });
server.stdout.resume();
for (let k = 0; k < 60; k++) {
  if (await fetch(BASE).then(() => true, () => false)) break;
  await new Promise((r) => setTimeout(r, 500));
}

const wslGpu = !soft && existsSync('/usr/lib/wsl/lib/libd3d12.so');
const browser = await chromium.launch({
  args: wslGpu ? ['--use-angle=gl-egl', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--ignore-gpu-blocklist'],
  env: wslGpu ? { ...process.env, LD_LIBRARY_PATH: '/usr/lib/wsl/lib', GALLIUM_DRIVER: 'd3d12' } : process.env,
});
const PHONE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true };
const CITIES = { 40: 'weeks=60', 150: 'b=150' };
const CONDITIONS = {
  dia: (pos) => ({ pos: Math.floor(pos) + 0.27 }),
  noite: (pos) => ({ pos: Math.floor(pos) + 0.75 }),
  chuva: (pos) => ({ pos: Math.floor(pos) + 0.3, weather: { rain: 1, overcast: 1, wet: 1, puddles: 1, wind: 0.3, snowing: false } }),
  // The simulation running at 4x with its own weather (days pass, the city changes).
  rodando: () => null,
};

const ctx = await browser.newContext(PHONE);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

/** Frames per second over `ms`, counted with requestAnimationFrame. */
const measure = (ms) => page.evaluate((ms) => new Promise((ok) => {
  let n = 0;
  const t0 = performance.now();
  const f = () => (++n, performance.now() - t0 < ms ? requestAnimationFrame(f) : ok((n * 1000) / (performance.now() - t0)));
  requestAnimationFrame(f);
}), ms);

const results = [];
await page.goto(`${BASE}/poc.html?weeks=1`);
const renderer = await page.evaluate(() => {
  const g = document.createElement('canvas').getContext('webgl2');
  const e = g?.getExtension('WEBGL_debug_renderer_info');
  return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
console.log('renderer:', renderer, '| CPU 4x slower');
try {
  for (const [n, q] of Object.entries(CITIES)) {
    for (const quality of shotsOnly ? ['high'] : ['auto', 'high']) {
      await page.goto(`${BASE}/poc.html?${q}&quality=${quality}`);
      await page.waitForFunction(() => window.poc?.ready, null, { timeout: 180000 });
      for (const [cond, view] of Object.entries(CONDITIONS)) {
        const pos = await page.evaluate(() => window.poc.driver.pos);
        await page.evaluate((v) => {
          window.poc.driver.speed = v ? 0 : 4;
          window.poc.view(v);
        }, view(pos));
        // Automatic quality checks 2.5 s windows after the first 4 s: give it time to settle.
        await page.waitForTimeout(quality === 'auto' && cond === 'dia' ? 11000 : 2500);
        const fps = shotsOnly ? 0 : await measure(5000);
        const info = await page.evaluate(() => window.poc.info());
        const row = { city: Number(n), quality, cond, fps: Math.round(fps * 10) / 10, level: info.level, pixelRatio: info.pixelRatio, calls: info.calls, triangles: info.triangles };
        results.push(row);
        console.log(JSON.stringify(row));
        if (quality === 'high') await page.screenshot({ path: `${OUT}/phone-${n}-${cond}.png` });
      }
    }
  }
  if (!shotsOnly) {
    // The 2D game on the same 150-building city, through the toggle.
    await page.goto(`${BASE}/poc.html?b=150&quality=auto`);
    await page.waitForFunction(() => window.poc?.ready, null, { timeout: 180000 });
    await page.evaluate(() => document.getElementById('toggle').click());
    await page.waitForTimeout(8000);
    const fps2d = await measure(5000);
    results.push({ city: 150, quality: '2d', cond: 'dia', fps: Math.round(fps2d * 10) / 10 });
    console.log('2D game, 150 buildings:', fps2d.toFixed(1));
    await page.screenshot({ path: `${OUT}/phone-150-2d.png` });
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(JSON.stringify({ renderer, results }));
process.exit(0);

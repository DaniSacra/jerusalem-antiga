// 3D proof of concept: screenshots and frame rate on a simulated mid-range phone and on PC.
// Usage: node scripts/poc-perf.mjs [--shots-only]
// Also measures the current 2D game in the same browser, for a fair comparison.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5199;
const BASE = `http://localhost:${PORT}`;
const OUT = 'screenshots/poc';
const shotsOnly = process.argv.includes('--shots-only');
mkdirSync(OUT, { recursive: true });

const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'inherit'] });
server.stdout.resume();
for (let k = 0; k < 60; k++) {
  if (await fetch(BASE).then(() => true, () => false)) break;
  await new Promise((r) => setTimeout(r, 500));
}

const DEVICES = {
  phone: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true },
  pc: { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 },
};
// ~40, ~100 and ~150 buildings (eficiente bot, seed 3).
const CITIES = { 40: 'months=30', 100: 'months=100', 150: 'months=200' };

const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const results = [];
try {
  for (const [dev, opts] of Object.entries(DEVICES)) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error('page error:', e.message));
    for (const [n, q] of Object.entries(CITIES)) {
      if (shotsOnly && n !== '100') continue;
      for (const quality of shotsOnly ? ['high'] : ['high', 'low']) {
        await page.goto(`${BASE}/poc.html?${q}${quality === 'low' ? '&quality=low' : ''}`);
        await page.waitForFunction(() => window.poc?.ready, null, { timeout: 120000 });
        await page.waitForTimeout(3000);
        const info = await page.evaluate(() => window.poc.info());
        results.push({ dev, city: n, quality, ...info });
        console.log(dev, n, quality, JSON.stringify(info));
        if (quality === 'high') {
          await page.screenshot({ path: `${OUT}/${dev}-${n}.png` });
          if (n === '100') {
            await page.evaluate(() => window.poc.rig.set({ dist: 12, pitch: 0.7 }));
            await page.waitForTimeout(800);
            await page.screenshot({ path: `${OUT}/${dev}-close.png` });
            await page.evaluate(() => window.poc.rig.set({ dist: 60, pitch: 0.75, yaw: 0.6 }));
            await page.waitForTimeout(800);
            await page.screenshot({ path: `${OUT}/${dev}-far.png` });
          }
        }
      }
    }
    if (!shotsOnly) {
      // The 2D game in the same browser: title, then a game with the tutorial off.
      await page.addInitScript(() => localStorage.setItem('jerusalem.tutorialDone', '1'));
      await page.goto(`${BASE}/`);
      await page.waitForTimeout(2000);
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.state, null, { timeout: 30000 });
      await page.waitForTimeout(3000);
      const fps2d = await page.evaluate(() => new Promise((ok) => {
        let n = 0;
        const t0 = performance.now();
        const f = () => (++n, performance.now() - t0 < 3000 ? requestAnimationFrame(f) : ok((n * 1000) / (performance.now() - t0)));
        requestAnimationFrame(f);
      }));
      results.push({ dev, city: '2d-start', fps: fps2d });
      console.log(dev, '2D game (start city)', fps2d.toFixed(1));
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(JSON.stringify(results));
process.exit(0);

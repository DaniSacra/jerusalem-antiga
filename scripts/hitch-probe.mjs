// Dev probe: plays the game at top speed and logs every frame longer than 200 ms with the game week.
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const PORT = Number(process.env.VISUAL_PORT ?? 5182);
const SECONDS = Number(process.argv[2] ?? 240);
const server = await createServer({ server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const wslGpu = existsSync('/usr/lib/wsl/lib/libd3d12.so');
const browser = await chromium.launch({
  args: wslGpu ? ['--use-angle=gl-egl', '--ignore-gpu-blocklist', '--enable-gpu'] : [],
  env: wslGpu ? { ...process.env, LD_LIBRARY_PATH: '/usr/lib/wsl/lib', GALLIUM_DRIVER: 'd3d12' } : process.env,
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && console.log('console', m.type(), m.text().slice(0, 200)));
await page.addInitScript(() => localStorage.setItem('jerusalem.tutorialDone', '1'));
try {
  await page.goto(`http://localhost:${PORT}/?seed=5`, { timeout: 90000 });
  await page.waitForSelector('[data-spot="start"]', { timeout: 60000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.view3d?.ready && window.view3d.frames > 3 && window.session, null, { timeout: 180000 });
  await page.evaluate(() => {
    window.__hitches = [];
    let last = performance.now();
    const f = () => {
      const now = performance.now();
      if (now - last > 200) window.__hitches.push({ ms: Math.round(now - last), week: window.state.week, t: Math.round(now / 1000), geo: window.view3d?.renderer?.info?.memory?.geometries, prog: window.view3d?.renderer?.info?.programs?.length });
      last = now;
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
    window.session.setSpeed(3);
  });
  const t0 = Date.now();
  while (Date.now() - t0 < SECONDS * 1000) {
    await page.waitForTimeout(15000);
    const r = await page.evaluate(() => { const h = window.__hitches; window.__hitches = []; return { week: window.state.week, speed: window.session.speed, frames: window.view3d.frames, hitches: h }; });
    if (r.speed === 0 || r.speed === 1) await page.evaluate(() => window.session.setSpeed(3));
    console.log(JSON.stringify(r));
  }
} finally {
  await browser.close();
  await server.close();
}

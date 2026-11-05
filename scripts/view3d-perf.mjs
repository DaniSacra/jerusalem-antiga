// Frame rate of the 3D game (`?view=3d`) on a simulated mid-range phone (844 x 390,
// deviceScaleFactor 2.6, touch, CPU slowed 4x), on a town of ~50 buildings, by day, at night and in
// the rain, at automatic quality (as a player gets it); then a road dragged across the town: the
// slowest world rebuild and the frames over 50 ms (targets in docs/arquitetura-3d.md §11.5).
// Screenshots in $VIEW3D_OUT (default screenshots/view3d-perf).
//
// Usage: node scripts/view3d-perf.mjs [--soft]
//   default: the real GPU when the WSL D3D12 driver is there (else Chromium's default);
//   --soft:  software rendering (SwiftShader), a pessimistic, fill-rate bound measure.
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const PORT = Number(process.env.VISUAL_PORT ?? 5196);
const OUT = process.env.VIEW3D_OUT ?? 'screenshots/view3d-perf';
const soft = process.argv.includes('--soft');
mkdirSync(OUT, { recursive: true });

const server = await createServer({ server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const wslGpu = !soft && existsSync('/usr/lib/wsl/lib/libd3d12.so');
const browser = await chromium.launch({
  args: wslGpu ? ['--use-angle=gl-egl', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  env: wslGpu ? { ...process.env, LD_LIBRARY_PATH: '/usr/lib/wsl/lib', GALLIUM_DRIVER: 'd3d12' } : process.env,
});
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.addInitScript(() => localStorage.setItem('jerusalem.tutorialDone', '1'));

/** Frames per second over `ms`, counted with requestAnimationFrame. */
const measure = (ms) =>
  page.evaluate(
    (ms) =>
      new Promise((ok) => {
        let n = 0;
        const t0 = performance.now();
        const f = () => (++n, performance.now() - t0 < ms ? requestAnimationFrame(f) : ok((n * 1000) / (performance.now() - t0)));
        requestAnimationFrame(f);
      }),
    ms,
  );

const results = [];
try {
  await page.goto(`http://localhost:${PORT}/?view=3d&seed=5`, { timeout: 90000 });
  await page.waitForSelector('[data-spot="start"]', { timeout: 60000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.view3d?.frames > 3 && window.session, null, { timeout: 180000 });
  await page.evaluate(() => window.session.setSpeed(0));
  const renderer = await page.evaluate(() => {
    const g = document.createElement('canvas').getContext('webgl2');
    const e = g?.getExtension('WEBGL_debug_renderer_info');
    return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  // A town of ~40 buildings: rows of houses of every level along a grid of streets, a few services and fields.
  const buildings = await page.evaluate(() => {
    const { state: s, core } = window;
    Object.assign(s, { silver: 1e6, wood: 1e6, stone: 1e6 });
    s.unlocked = ['road', 'house', 'field', 'plaza', 'fisher', 'gatherer', 'lumber', 'quarry', 'granary', 'market', 'workshop', 'park', 'temple'];
    for (const b of s.buildings.filter((b) => b.kind !== 'altar')) core.clearCell(s, b.x, b.y);
    for (let x = 10; x <= 38; x++) for (const y of [18, 24, 31]) core.place(s, 'road', x, y);
    for (let y = 18; y <= 31; y++) for (const x of [10, 38]) core.place(s, 'road', x, y);
    let n = 0;
    const put = (k, x, y, level = 1) => {
      if (!core.place(s, k, x, y).ok) return;
      const b = s.grid[y * s.cols + x];
      if (k === 'house' || b.kind !== 'field') b.level = level;
      n++;
    };
    for (let k = 0; k < 13; k++) put('house', 11 + 2 * k, 19, (k % 4) + 1);
    for (let k = 0; k < 13; k++) put('house', 11 + 2 * k, 29, ((k + 2) % 4) + 1);
    for (let k = 0; k < 13; k++) put('house', 11 + 2 * k, 22, ((k + 1) % 4) + 1);
    for (let k = 0; k < 13; k++) put('house', 11 + 2 * k, 25, ((k + 3) % 4) + 1);
    for (const [k, x, y, l] of [['granary', 11, 27, 3], ['workshop', 31, 27, 2], ['field', 15, 27, 1], ['field', 18, 27, 1], ['plaza', 22, 27, 1], ['park', 25, 27, 1]]) put(k, x, y, l);
    for (const b of s.buildings.filter((b) => b.kind === 'house' && b.level > 0))
      for (let k = 0; k < 4; k++) core.addPerson(s, { sex: k % 2 ? 'f' : 'm', age: 30, houseId: b.id, caravan: 0, clan: k }, () => 0.5);
    core.refreshCity(s);
    window.session.refresh();
    return s.buildings.length;
  });
  console.log(`renderer: ${renderer} | CPU 4x slower | ${buildings} buildings`);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const CONDITIONS = {
    dia: { day: 0.27 },
    noite: { day: 0.75 },
    chuva: { day: 0.3, weather: { rain: 1, overcast: 1, wet: 1, puddles: 1, wind: 0.3, snowing: false } },
  };
  for (const [cond, o] of Object.entries(CONDITIONS)) {
    await page.evaluate((o) => window.view3d.view({ pos: window.state.week + 0.3, ...o }), o);
    // The automatic quality checks 2.5 s windows after the first 4 s: give it time to settle.
    await page.waitForTimeout(cond === 'dia' ? 11000 : 3000);
    const fps = await measure(5000);
    const info = await page.evaluate(() => window.view3d.info());
    const row = { cond, fps: Math.round(fps * 10) / 10, level: info.level, pixelRatio: info.pixelRatio, calls: info.calls, triangles: info.triangles, walkers: info.walkers };
    results.push(row);
    console.log(JSON.stringify(row));
    await page.screenshot({ path: `${OUT}/phone-${cond}.png` });
  }
  // A road dragged across the town, a cell every 60 ms (a quick finger): each placement asks the
  // world to draw the city again (throttled); record every rebuild and every long frame.
  const drag = await page.evaluate(
    () =>
      new Promise((ok) => {
        const v = window.view3d;
        const se = window.session;
        se.selectTool('road');
        const memo = { roads: [], toastedSilver: false, toastedFood: false };
        const rebuilds = [];
        const frames = [];
        let last = performance.now();
        let seen = v.info().rebuildMs;
        let x = 12;
        let done = false;
        const tick = () => {
          const now = performance.now();
          frames.push(now - last);
          last = now;
          const r = v.info().rebuildMs;
          if (r !== seen) rebuilds.push((seen = r));
          if (!done) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        const step = () => {
          se.apply({ x, y: 21 }, x === 12, true, memo);
          if (++x <= 36) return setTimeout(step, 60);
          setTimeout(() => {
            done = true;
            ok({ cells: memo.roads.length, rebuilds, frames });
          }, 600);
        };
        step();
      }),
  );
  const max = (a) => Math.round(Math.max(0, ...a) * 10) / 10;
  const row = { cond: 'arrasto', roads: drag.cells, syncs: drag.rebuilds.length, rebuildMaxMs: max(drag.rebuilds), frameMaxMs: max(drag.frames), over50ms: drag.frames.filter((f) => f > 50).length, frames: drag.frames.length };
  results.push(row);
  console.log(JSON.stringify(row));
} finally {
  await browser.close();
  await server.close();
}
process.exit(results.length ? 0 : 1);

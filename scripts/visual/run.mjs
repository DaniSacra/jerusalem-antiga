/**
 * Visual / end-to-end checks in a real browser (Playwright + Chromium).
 *
 * Starts the Vite dev server, plays scripted scenarios, saves screenshots to screenshots/
 * and fails if an assertion breaks or the page logs an error.
 *
 *   npm run test:visual            # all scenarios
 *   npm run test:visual -- touch   # only scenarios whose name contains "touch"
 *
 * Scenarios use the dev-only hooks window.game, window.state and window.core
 * (exposed by GameScene in dev builds) to read state and set up situations quickly.
 */
import { mkdir, rm } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const OUT = 'screenshots';
const PORT = 5199;
const URL = `http://localhost:${PORT}/`;
const GAME_W = 1280;
const GAME_H = 720;
const filter = process.argv[2] ?? '';

// ---------- helpers ----------

function assert(cond, msg) {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

/** Screen position (game pixels) of the center of grid cell (x, y), using the live camera. */
function cellToScreen(page, x, y) {
  return page.evaluate(([x, y]) => {
    const cam = window.game.cameras.main;
    const wx = (x - y) * 32;
    const wy = (x + y + 1) * 16;
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    return [(wx - cam.scrollX - cx) * cam.zoom + cx, (wy - cam.scrollY - cy) * cam.zoom + cy];
  }, [x, y]);
}

/** Opens the game, leaves the title screen and waits for the UI to be attached. */
async function startGame(page) {
  await page.goto(URL);
  await page.waitForFunction(() => document.querySelector('canvas'));
  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.game?.ui && window.state && window.core, null, { timeout: 15000 });
  await page.waitForTimeout(300);
}

/** Selects a tool by its 1-based toolbar position (keyboard shortcut). */
const tool = (page, n) => page.keyboard.press(`Digit${n}`);

async function mouseDrag(page, cells) {
  await page.mouse.move(...(await cellToScreen(page, ...cells[0])));
  await page.mouse.down();
  for (const c of cells.slice(1)) await page.mouse.move(...(await cellToScreen(page, ...c)), { steps: 5 });
  await page.mouse.up();
}

const stats = (page) =>
  page.evaluate(() => {
    const s = window.state;
    const cam = window.game.cameras.main;
    return {
      roads: s.roads.filter(Boolean).length,
      buildings: s.buildings.map((b) => b.kind),
      houses: s.buildings.filter((b) => b.kind === 'house').map((b) => b.level),
      zoom: cam.zoom,
      won: s.won,
    };
  });

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });

// ---------- scenarios ----------

const scenarios = {
  async title(page) {
    await page.goto(URL);
    await page.waitForTimeout(1200);
    await shot(page, 'title');
  },

  async 'build-with-mouse'(page) {
    await startGame(page);
    const before = await stats(page);
    assert(before.roads === 15, `starting road has 15 cells (got ${before.roads})`);
    assert(before.buildings.join() === 'altar', 'only the altar at start');

    await tool(page, 2); // Rua
    await mouseDrag(page, [[17, 16], [22, 16]]);
    await tool(page, 3); // Casa
    await mouseDrag(page, [[17, 17], [21, 17]]);
    await tool(page, 4); // Campo
    await page.mouse.click(...(await cellToScreen(page, 15, 20)));
    await tool(page, 5); // Poço
    await page.mouse.click(...(await cellToScreen(page, 15, 18)));
    await page.mouse.move(...(await cellToScreen(page, 18, 20)));
    await page.waitForTimeout(300);
    await shot(page, 'build-with-mouse');

    const after = await stats(page);
    assert(after.roads === 21, `dragged road adds 6 cells (got ${after.roads})`);
    assert(after.houses.length === 5, `dragged 5 houses (got ${after.houses.length})`);
    assert(after.buildings.includes('field') && after.buildings.includes('well'), 'field and well placed');
  },

  async 'families-arrive'(page) {
    await startGame(page);
    await tool(page, 3);
    await mouseDrag(page, [[15, 18], [15, 22]]);
    await page.keyboard.press('Space'); // 3x
    await tool(page, 1);
    await page.waitForFunction(() => window.state.families.length > 0, null, { timeout: 20000 });
    await page.waitForTimeout(400);
    await shot(page, 'families-walking');
    await page.waitForFunction(() => window.state.buildings.some((b) => b.kind === 'house' && b.level >= 1), null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    await shot(page, 'families-arrived');
  },

  async 'town-art'(page) {
    await startGame(page);
    await page.evaluate(() => {
      const { state: s, core } = window;
      s.silver = 1e6;
      s.unlocked = ['road', 'house', 'field', 'well', 'market', 'workshop', 'temple'];
      s.feature = s.feature.map(() => null);
      for (let x = 8; x <= 24; x++) {
        core.place(s, 'road', x, 13);
        core.place(s, 'road', x, 19);
      }
      for (let y = 13; y <= 19; y++) {
        core.place(s, 'road', 8, y);
        core.place(s, 'road', 24, y);
      }
      for (let x = 17; x <= 24; x++) core.place(s, 'road', x, 16);
      const put = (k, x, y, level = 0) => {
        core.place(s, k, x, y);
        s.grid[y * s.cols + x].level = level;
      };
      for (let x = 9; x <= 15; x++) put('house', x, 14, (x % 4) + 1);
      for (let x = 9; x <= 15; x++) put('house', x, 18, (x + 2) % 5);
      put('well', 17, 17);
      put('market', 18, 17);
      put('workshop', 19, 17);
      put('field', 20, 17);
      put('field', 21, 17);
      put('house', 22, 17, 4);
      put('house', 23, 17, 3);
      put('temple', 17, 20);
      put('field', 3, 3); // disconnected: shows the "no road" balloon
      window.game.refresh();
      const cam = window.game.cameras.main;
      cam.setZoom(1.5);
      cam.centerOn(-8, 544);
    });
    await page.waitForTimeout(1500);
    await shot(page, 'town-art');
    const t = await page.evaluate(() => window.state.buildings.find((b) => b.kind === 'temple'));
    assert(t?.connected, 'temple is connected');

    await page.evaluate(() => {
      const cam = window.game.cameras.main;
      cam.setZoom(1);
      cam.centerOn(0, 600);
      window.game.selectTool('temple');
    });
    await page.mouse.move(700, 350);
    await page.waitForTimeout(300);
    await shot(page, 'overlay-temple-preview');
    await page.evaluate(() => window.game.selectTool('house'));
    await page.mouse.move(500, 300);
    await page.waitForTimeout(300);
    await shot(page, 'overlay-house-sacred-area');
  },

  async 'camera-wheel'(page) {
    await startGame(page);
    await page.mouse.move(640, 330);
    for (let k = 0; k < 6; k++) await page.mouse.wheel(0, -100);
    await page.waitForTimeout(300);
    const zin = (await stats(page)).zoom;
    await shot(page, 'camera-zoom-in');
    for (let k = 0; k < 14; k++) await page.mouse.wheel(0, 100);
    await page.waitForTimeout(300);
    const zout = (await stats(page)).zoom;
    await shot(page, 'camera-zoom-out');
    assert(zin > 1 && zin <= 2, `zoom in within limits (got ${zin})`);
    assert(zout < 1 && zout >= 0.5, `zoom out within limits (got ${zout})`);
  },

  /** Phone in landscape with real multi-touch events sent through the Chrome DevTools Protocol. */
  touch: {
    context: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
    async run(page) {
      const cdp = await page.context().newCDPSession(page);
      const scale = 390 / GAME_H;
      const offsetX = (844 - GAME_W * scale) / 2;
      const toPage = ([x, y]) => ({ x: offsetX + x * scale, y: y * scale });
      const touch = (type, pts) =>
        cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, id) => ({ ...toPage(p), id })) });
      const tap = async (p) => {
        await touch('touchStart', [p]);
        await page.waitForTimeout(60);
        await touch('touchEnd', []);
        await page.waitForTimeout(150);
      };

      await page.goto(URL);
      await page.waitForTimeout(1200);
      await shot(page, 'touch-title');
      await tap([640, 570]); // Começar
      await page.waitForFunction(() => window.game?.ui && window.state, null, { timeout: 15000 });
      await page.waitForTimeout(500);

      await tap([12 + 138 + 66, 672]); // Rua (2nd toolbar button)
      const a = await cellToScreen(page, 17, 16);
      const b = await cellToScreen(page, 21, 16);
      const s0 = await stats(page);
      await touch('touchStart', [a]);
      for (let k = 1; k <= 10; k++) {
        await touch('touchMove', [[a[0] + ((b[0] - a[0]) * k) / 10, a[1] + ((b[1] - a[1]) * k) / 10]]);
        await page.waitForTimeout(20);
      }
      await touch('touchEnd', []);
      await page.waitForTimeout(200);
      const s1 = await stats(page);
      assert(s1.roads === s0.roads + 5, `one-finger drag builds 5 roads (got ${s1.roads - s0.roads})`);
      assert(s1.zoom === s0.zoom, 'one-finger drag with a build tool does not move the camera');

      await touch('touchStart', [[600, 300], [700, 300]]);
      for (let k = 1; k <= 10; k++) {
        await touch('touchMove', [[600 - k * 5, 300 + k * 3], [700 + k * 5, 300 + k * 3]]);
        await page.waitForTimeout(20);
      }
      await touch('touchEnd', []);
      await page.waitForTimeout(300);
      const s2 = await stats(page);
      assert(s2.zoom > s1.zoom, `pinch zooms in (${s1.zoom} -> ${s2.zoom})`);
      assert(s2.roads === s1.roads, 'two fingers never build');
      await shot(page, 'touch-after-pinch');
    },
  },

  async victory(page) {
    await startGame(page);
    await page.evaluate(() => {
      const s = window.state;
      s.silver = 500;
      s.goalIndex = 5;
      s.unlocked.push('temple');
      window.game.refresh();
    });
    await tool(page, 8); // Templo
    await page.mouse.click(...(await cellToScreen(page, 18, 21)));
    await page.waitForTimeout(250);
    await shot(page, 'temple-celebration');
    await page.waitForFunction(() => window.state.won, null, { timeout: 15000 });
    await page.waitForTimeout(500);
    await shot(page, 'victory');
  },
};

// ---------- runner ----------

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

let failed = 0;
for (const [name, def] of Object.entries(scenarios)) {
  if (filter && !name.includes(filter)) continue;
  const run = typeof def === 'function' ? def : def.run;
  const context = await browser.newContext(def.context ?? { viewport: { width: GAME_W, height: GAME_H } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const t0 = Date.now();
  try {
    await run(page);
    assert(errors.length === 0, `no page errors (${errors.join(' | ')})`);
    console.log(`✓ ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } catch (e) {
    failed++;
    console.log(`✗ ${name}: ${e.message}`);
    await page.screenshot({ path: `${OUT}/FAILED-${name}.png` }).catch(() => {});
  }
  await context.close();
}

await browser.close();
await server.close();
console.log(failed ? `\n${failed} scenario(s) failed. Screenshots in ${OUT}/` : `\nAll scenarios passed. Screenshots in ${OUT}/`);
process.exit(failed ? 1 : 0);

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

/** Screen position (game pixels) of the center of grid cell (x, y), using the live camera and view rotation. */
function cellToScreen(page, x, y) {
  return page.evaluate(([x, y]) => {
    const cam = window.game.cameras.main;
    const { x: wx, y: wy } = window.iso.gridToWorld(x + 0.5, y + 0.5);
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    return [(wx - cam.scrollX - cx) * cam.zoom + cx, (wy - cam.scrollY - cy) * cam.zoom + cy];
  }, [x, y]);
}

/** Presses Space until the game runs at the given speed (a key press can be lost or doubled). */
async function setSpeed(page, speed) {
  for (let k = 0; k < 6; k++) {
    if (await page.evaluate((v) => window.game.speed === v, speed)) return;
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
  }
  throw new Error(`setSpeed: could not reach ${speed}x`);
}

/** Opens the game, leaves the title screen and waits for the UI to be attached. */
async function startGame(page) {
  await page.goto(URL);
  await page.waitForFunction(() => document.querySelector('canvas'));
  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.game?.ui && window.state && window.core && window.iso, null, { timeout: 15000 });
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
    assert(before.roads === 41, `starting roads (ring + road south) have 41 cells (got ${before.roads})`);
    assert(before.buildings.join() === 'altar', 'only the altar at start');

    await tool(page, 2); // Rua
    await mouseDrag(page, [[27, 24], [32, 24]]);
    await tool(page, 3); // Casa: 2x2, so dragging 6 cells places 3 houses
    await mouseDrag(page, [[27, 25], [32, 25]]);
    await tool(page, 4); // Campo: 2x2 at the clicked cell
    await page.mouse.click(...(await cellToScreen(page, 22, 29)));
    await tool(page, 5); // Poço
    await page.mouse.click(...(await cellToScreen(page, 22, 32)));
    await page.mouse.move(...(await cellToScreen(page, 27, 30)));
    await page.waitForTimeout(300);
    await shot(page, 'build-with-mouse');

    const after = await stats(page);
    assert(after.roads === 47, `dragged road adds 6 cells (got ${after.roads})`);
    assert(after.houses.length === 3, `dragged 3 houses (got ${after.houses.length})`);
    assert(after.buildings.includes('field') && after.buildings.includes('well'), 'field and well placed');
  },

  async 'families-arrive'(page) {
    await startGame(page);
    await tool(page, 3);
    await mouseDrag(page, [[22, 28], [22, 36]]);
    await setSpeed(page, 3);
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
      for (let x = 12; x <= 36; x++) {
        core.place(s, 'road', x, 18);
        core.place(s, 'road', x, 31);
      }
      for (let y = 18; y <= 31; y++) {
        core.place(s, 'road', 12, y);
        core.place(s, 'road', 36, y);
      }
      for (let x = 27; x <= 36; x++) core.place(s, 'road', x, 24);
      const put = (k, x, y, level = 0, rotated = false) => {
        const r = core.place(s, k, x, y, rotated);
        if (!r.ok) throw new Error(`town-art: cannot place ${k} at ${x},${y}: ${r.reason}`);
        s.grid[y * s.cols + x].level = level;
      };
      for (let k = 0; k < 5; k++) put('house', 13 + 2 * k, 19, (k % 4) + 1);
      for (let k = 0; k < 5; k++) put('house', 13 + 2 * k, 29, (k + 2) % 5);
      put('well', 27, 25);
      put('market', 29, 25, 0, true); // rotated 4x2
      put('workshop', 33, 25);
      put('field', 26, 29);
      put('field', 29, 29);
      put('house', 32, 29, 4);
      put('house', 34, 29, 3);
      put('market', 34, 19); // 2x4 upright
      put('temple', 25, 32);
      put('field', 3, 3); // disconnected: shows the "no road" balloon
      window.game.refresh();
      const cam = window.game.cameras.main;
      cam.setZoom(1.1);
      cam.centerOn(-64, 780);
    });
    await page.waitForTimeout(1500);
    await shot(page, 'town-art');
    const t = await page.evaluate(() => window.state.buildings.find((b) => b.kind === 'temple'));
    assert(t?.connected, 'temple is connected');

    await page.evaluate(() => {
      const cam = window.game.cameras.main;
      cam.setZoom(1);
      cam.centerOn(-64, 900);
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

  /** Farmers working inside fields: count follows efficiency, none on a field without a road. */
  async 'field-work'(page) {
    await startGame(page);
    const farmers = () =>
      page.evaluate(() =>
        [...window.game.map.views.values()].filter((v) => v.kind === 'field').map((v) => v.crew.count),
      );
    const centerOnFields = (zoom) =>
      page.evaluate((zoom) => {
        const cam = window.game.cameras.main;
        const c = window.iso.gridToWorld(18, 21);
        cam.setZoom(zoom);
        cam.centerOn(c.x, c.y);
      }, zoom);
    await page.evaluate(() => {
      const { state: s, core } = window;
      s.silver = 1e6;
      s.unlocked = ['road', 'house', 'field', 'well', 'market', 'workshop', 'temple'];
      s.feature = s.feature.map(() => null);
      for (let x = 12; x <= 36; x++) core.place(s, 'road', x, 18);
      for (let y = 18; y <= 31; y++) core.place(s, 'road', 12, y);
      for (let x = 12; x <= 24; x++) core.place(s, 'road', x, 31);
      const put = (k, x, y, level = 0) => {
        const r = core.place(s, k, x, y);
        if (!r.ok) throw new Error(`field-work: cannot place ${k} at ${x},${y}: ${r.reason}`);
        return s.grid[y * s.cols + x];
      };
      // 8 connected fields (16 jobs), all four crops, both drawings, and 3 big houses (19 workers).
      [13, 15, 17, 19, 21, 23].forEach((x, k) => {
        const f = put('field', x, 19);
        f.variant = k % 4;
        f.mirrored = k % 2 === 1;
      });
      [21, 23].forEach((y) => put('field', 13, y));
      put('house', 13, 29).level = 4;
      put('house', 15, 29).level = 4;
      put('house', 17, 29).level = 4;
      put('field', 16, 23); // no road: no farmers
      window.game.cycleSpeed();
      window.game.cycleSpeed(); // pause
      core.refreshCity(s);
      window.game.refresh();
    });
    await page.waitForTimeout(300);
    const eff = await page.evaluate(() => window.core.computeEconomy(window.state).efficiency);
    let n = await farmers();
    assert(eff === 1, `full efficiency (got ${eff})`);
    assert(n.filter((c) => c === 2).length === 8 && n.filter((c) => c === 0).length === 1, `2 farmers per connected field, none on the loose one (got ${n})`);
    await centerOnFields(2);
    await page.waitForTimeout(200);
    await shot(page, 'field-work-zoom-max');
    await page.evaluate(() => (window.game.map.work += 0.5)); // a moment later: other strokes
    await page.waitForTimeout(200);
    await shot(page, 'field-work-zoom-max-later');
    await centerOnFields(0.5);
    await page.waitForTimeout(200);
    await shot(page, 'field-work-zoom-min');

    await page.evaluate(() => {
      window.game.turnMap(1);
      window.state.buildings.filter((b) => b.kind === 'house').forEach((b) => (b.level = 2)); // 7 workers for 16 jobs
      window.game.refresh();
    });
    await centerOnFields(1.5);
    await page.waitForTimeout(300);
    n = await farmers();
    assert(n.filter((c) => c === 1).length === 8, `1 farmer per field at a third of the jobs filled (got ${n})`);
    await shot(page, 'field-work-turned');
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
      // Same rule as src/render/layout.ts: the game height follows the screen shape (1280 x 591 here).
      const phoneH = Math.round(Math.min(720, Math.max(560, (GAME_W * 390) / 844)));
      const scale = 390 / phoneH;
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
      await tap([640, (phoneH - 520) / 2 + 520 - 62]); // Começar (title panel 520 tall, button 62 above its bottom)
      await page.waitForFunction(() => window.game?.ui && window.state, null, { timeout: 15000 });
      await page.waitForTimeout(500);

      await tap([12 + 138 + 66, phoneH - 48]); // Rua (2nd toolbar button)
      assert(await page.evaluate((h) => window.game.scale.height === h, phoneH), `phone game height is ${phoneH}`);
      const a = await cellToScreen(page, 27, 23);
      const b = await cellToScreen(page, 31, 23);
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

  async clarity(page) {
    await startGame(page);
    await page.evaluate(() => {
      const { state: s, core } = window;
      s.silver = 1e4;
      s.feature = s.feature.map(() => null);
      core.place(s, 'field', 22, 30); // connected, but nobody lives here yet
      window.game.cycleSpeed();
      window.game.cycleSpeed(); // pause, so the setup stays as built
    });
    await tool(page, 2); // Rua
    await mouseDrag(page, [[30, 14], [33, 14]]);
    await page.waitForTimeout(250);
    const c = await page.evaluate(() => {
      const s = window.state;
      const field = s.buildings.find((b) => b.kind === 'field');
      return {
        loose: [30, 31, 32, 33].every((x) => s.roads[14 * s.cols + x] && !s.network[14 * s.cols + x]),
        balloon: window.core.balloonNeed(s, field),
      };
    });
    assert(c.loose, 'dragged road far from the network is built but not connected');
    assert(c.balloon === 'workers', 'field with no residents shows the "no workers" balloon');
    await shot(page, 'clarity-loose-road');

    await page.evaluate(() => {
      const s = window.state;
      s.famine = true;
      s.food = 0;
      window.game.selectTool('view');
      window.game.refresh();
    });
    await page.waitForTimeout(200);
    await shot(page, 'clarity-famine');

    await page.evaluate(() => {
      const s = window.state;
      s.famine = false;
      s.unlocked.push('temple');
      window.game.selectTool('temple');
    });
    await page.mouse.move(...(await cellToScreen(page, 19, 38)));
    await page.waitForTimeout(250);
    await shot(page, 'overlay-temple-spots');

    const none = await page.evaluate(() => {
      const { state: s, core } = window;
      s.feature = s.feature.map((f, i) => (s.roads[i] || s.grid[i] ? f : 'rock'));
      window.game.selectTool('temple');
      return core.templeSpots(s).length === 0;
    });
    assert(none, 'no temple spot once every free cell is rock');
    await page.waitForTimeout(250);
    await shot(page, 'temple-no-spot');
  },
  async 'turn-map'(page) {
    await startGame(page);
    await page.evaluate(() => {
      const { state: s, core } = window;
      s.silver = 1e4;
      s.unlocked.push('market');
      s.feature = s.feature.map(() => null);
      core.place(s, 'market', 22, 30); // upright 2x4, west of the road
      core.place(s, 'house', 25, 30);
      core.place(s, 'well', 25, 33);
      window.game.cycleSpeed();
      window.game.cycleSpeed(); // pause
      window.game.refresh();
    });
    await page.waitForTimeout(200);
    await shot(page, 'turn-0');
    await page.mouse.click(1280 - 128 + 27 + 54 + 8, 56 + 10 + 27); // ↻
    await page.waitForTimeout(300);
    assert((await page.evaluate(() => window.iso.getRotation())) === 1, 'the clockwise arrow turns the view');
    assert((await stats(page)).roads === 41, 'clicking the arrow builds nothing');
    await tool(page, 2); // Rua: picking must follow the turned view
    await mouseDrag(page, [[25, 36], [28, 36]]);
    const built = await page.evaluate(() => [25, 26, 27, 28].every((x) => window.state.roads[36 * window.state.cols + x]));
    assert(built, 'dragging in the turned view builds on the right grid cells');
    await tool(page, 1);
    await shot(page, 'turn-1');
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(150);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(300);
    await shot(page, 'turn-3');
    await page.keyboard.press('KeyQ');
    await page.waitForTimeout(300);
    const rot = await page.evaluate(() => window.iso.getRotation());
    assert(rot === 2, `Q turns back (rotation ${rot})`);
    await shot(page, 'turn-2');
  },
  async debt(page) {
    await startGame(page);
    await page.evaluate(() => {
      const { state: s, core } = window;
      s.silver = 1e4;
      s.feature = s.feature.map(() => null);
      s.unlocked.push('market', 'workshop');
      core.place(s, 'market', 25, 27);
      core.place(s, 'field', 25, 31);
      core.place(s, 'workshop', 30, 34); // off the road: makes nothing but still pays its upkeep
      for (let y = 27; y <= 35; y += 2) {
        core.place(s, 'house', 22, y);
        s.grid[y * s.cols + 22].level = 1;
      }
      s.silver = -5;
      s.debtMonths = 20;
      s.famine = true;
      s.food = 0;
      window.game.walkers.leave(s, 22, 29); // a family walking out, as when a tent is abandoned
      window.game.cycleSpeed();
      window.game.cycleSpeed(); // pause
      window.game.refresh();
      window.game.cameras.main.centerOn(0, 920);
    });
    await tool(page, 2); // Rua: building is blocked in debt
    await page.mouse.click(...(await cellToScreen(page, 24, 20)));
    await page.waitForTimeout(700);
    await shot(page, 'debt-alerts');
    const chips = await page.evaluate(() => window.core.alerts(window.state).map((a) => a.kind));
    assert(chips[0] === 'debt' && chips.includes('deficit'), `debt and deficit alerts (${chips})`);
    assert(await page.evaluate(() => !window.state.roads[20 * window.state.cols + 24]), 'no road is built in debt');

    await page.mouse.click(60, 28); // tap the silver
    await page.waitForTimeout(200);
    await shot(page, 'debt-silver-info');

    await page.evaluate(() => (window.state.debtMonths = window.core.RULES.debtMonthsToLose - 1));
    await setSpeed(page, 1);
    await page.waitForFunction(() => window.state.lost, null, { timeout: 5000 });
    await page.waitForTimeout(400);
    assert(await page.evaluate(() => window.game.ui.modalOpen), 'the defeat screen is open');
    await shot(page, 'defeat');

    await page.mouse.click(GAME_W / 2, GAME_H / 2 + 80); // Tentar de novo
    await page.waitForFunction(() => window.state && !window.state.lost && window.state.month === 0 && window.state.silver >= 0, null, { timeout: 5000 });
    await page.waitForTimeout(600);
    assert(await page.evaluate(() => !window.game.ui?.modalOpen), 'a new game starts without the dialog');
    await shot(page, 'defeat-retry');
  },
  async victory(page) {
    await startGame(page);
    await page.evaluate(() => {
      const s = window.state;
      s.silver = 900;
      s.goalIndex = window.core.GOALS.length - 1; // last goal: build the temple
      s.unlocked.push('temple');
      s.feature = s.feature.map(() => null);
      window.game.refresh();
      window.game.cameras.main.centerOn(-224, 1008); // around the temple spot (25..30, 32..37)
    });
    await tool(page, 8); // Templo
    await page.mouse.click(...(await cellToScreen(page, 27, 34))); // 6x6 centered: top-left (25, 32)
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

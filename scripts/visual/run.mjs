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

/** Page position of a game point (the canvas is scaled to fit the page and centered). */
function gameToPage(page, x, y) {
  return page.evaluate(([x, y]) => {
    const r = document.querySelector('canvas').getBoundingClientRect();
    const k = r.width / window.game.scale.width;
    return [r.left + x * k, r.top + y * k];
  }, [x, y]);
}

/** Game position of a UI element from the layout helpers, e.g. ('buildButton', 2) or ('plaqueSlot', 1). */
const uiPoint = (page, fn, k) =>
  page.evaluate(([fn, k]) => {
    const p = window.layout[fn](k);
    return 'w' in p ? [p.x + p.w / 2, p.y + p.h / 2] : [p.x, p.y];
  }, [fn, k]);

/** Clicks a UI element with the mouse (see uiPoint). */
const clickUi = async (page, fn, k) => page.mouse.click(...(await gameToPage(page, ...(await uiPoint(page, fn, k)))));

/** Real multi-touch through the Chrome DevTools Protocol, in game coordinates. */
async function touchInput(page) {
  const cdp = await page.context().newCDPSession(page);
  const toPage = (pts) => Promise.all(pts.map((p) => gameToPage(page, ...p)));
  const touch = async (type, pts) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: (await toPage(pts)).map(([x, y], id) => ({ x, y, id })) });
  const tap = async (p) => {
    await touch('touchStart', [p]);
    await page.waitForTimeout(60);
    await touch('touchEnd', []);
    await page.waitForTimeout(150);
  };
  return { touch, tap };
}

const PHONE = { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const PC = { viewport: { width: 1366, height: 768 } };

/** Presses Space until the game runs at the given speed (a key press can be lost or doubled). */
async function setSpeed(page, speed) {
  for (let k = 0; k < 6; k++) {
    if (await page.evaluate((v) => window.game.speed === v, speed)) return;
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
  }
  throw new Error(`setSpeed: could not reach ${speed}x`);
}

/** Opens the game, leaves the title screen and waits for the UI to be attached. The first-game
 * tutorial is skipped (marked as seen) unless `tutorial` is set. */
async function startGame(page, { tutorial = false } = {}) {
  if (!tutorial) await page.addInitScript(() => localStorage.setItem('jerusalem.tutorialDone', '1'));
  await page.goto(URL);
  await page.waitForFunction(() => document.querySelector('canvas'));
  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.game?.ui && window.state && window.core && window.iso, null, { timeout: 15000 });
  // Software rendering is slow: keep the image finish on so screenshots do not depend on the frame rate.
  await page.evaluate(() => (window.game.dayNight.fpsGuard = false));
  await page.waitForTimeout(300);
}

/** Selects a tool by its 1-based toolbar position (keyboard shortcut). */
const tool = (page, n) => page.keyboard.press(`Digit${n}`);

/** Page position of the center of a grid cell. */
const cellToPage = async (page, x, y) => gameToPage(page, ...(await cellToScreen(page, x, y)));

/** Drags the mouse through grid cells; every cell must be on the open map (not under the UI). */
async function mouseDrag(page, cells) {
  for (const c of cells) {
    const [x, y] = await cellToScreen(page, ...c);
    assert(!(await page.evaluate(([x, y]) => window.game.ui.isOverUi(x, y), [x, y])), `cell ${c} is not under the UI`);
  }
  await page.mouse.move(...(await cellToPage(page, ...cells[0])));
  await page.mouse.down();
  for (const c of cells.slice(1)) await page.mouse.move(...(await cellToPage(page, ...c)), { steps: 5 });
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

/** Pause, a few houses, idle workers and services that cost more than the taxes: two alerts at once. */
async function setupHudCity(page) {
  await page.evaluate(() => {
    const { state: s, core } = window;
    s.silver = 1e4;
    s.feature = s.feature.map(() => null);
    s.unlocked.push('market', 'workshop');
    for (let y = 27; y <= 41; y += 2) {
      core.place(s, 'house', 22, y);
      s.grid[y * s.cols + 22].level = 2;
    }
    core.place(s, 'field', 25, 27);
    for (let k = 0; k < 6 && core.computeEconomy(s).silverDelta >= 0; k++) core.place(s, 'well', 4 + 3 * k, 4); // off the road
    s.silver = 180;
    s.goalIndex = core.RULES.upkeepStartsAfterGoal; // upkeep is charged from goal 2 on
    window.game.setSpeed(0);
    core.refreshCity(s);
    window.game.refresh();
  });
  await page.waitForTimeout(200);
  const kinds = await page.evaluate(() => window.core.alerts(window.state).map((a) => a.kind));
  assert(kinds.includes('deficit') && kinds.includes('unemployed'), `deficit and unemployment alerts (${kinds})`);
}

/** A walled town with every building kind and house level, framed at zoom 1.1. */
async function buildTown(page) {
  await page.evaluate(() => {
    const { state: s, core } = window;
    s.silver = 1e6;
    s.unlocked = ['road', 'house', 'field', 'well', 'market', 'workshop', 'garden', 'temple'];
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
    put('garden', 19, 22); // beside the altar ring, cheers the houses above it
    put('field', 3, 3); // disconnected: shows the "no road" balloon
    window.game.refresh();
    const cam = window.game.cameras.main;
    cam.setZoom(1.1);
    cam.centerOn(-64, 780);
  });
}

/** Screenshot; waits for new buildings to finish going up unless `scaffolds` is set. */
async function shot(page, name, { scaffolds = false } = {}) {
  if (!scaffolds)
    await page
      .waitForFunction(() => !window.game?.map || [...window.game.map.views.values()].every((v) => !v.scaffold), null, { timeout: 20000 })
      .catch(() => {}); // title and other screens without a map
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

/** Presses a button of the tutorial bubble ('skipBtn' or 'okBtn'). */
async function clickTutorial(page, which) {
  const [x, y] = await page.evaluate((k) => {
    const v = window.game.ui.tutorial;
    const c = k === 'skipBtn' ? v.skipBtn.root : v.okBtn.container;
    return [c.x, c.y];
  }, which);
  await page.mouse.click(...(await gameToPage(page, x, y)));
  await page.waitForTimeout(200);
}

/** Builds a kind at the free spot next to the network closest to a cell (default: the altar). */
const placeNear = (page, kind, near) =>
  page.evaluate(([kind, near]) => {
    const { state: s, core } = window;
    const to = near ?? core.RULES.map.altar;
    const spots = core.placeSpots(s, kind).sort((a, b) => Math.abs(a.x - to.x) + Math.abs(a.y - to.y) - (Math.abs(b.x - to.x) + Math.abs(b.y - to.y)));
    const r = core.place(s, kind, spots[0].x, spots[0].y);
    if (!r.ok) throw new Error(`placeNear ${kind}: ${r.reason}`);
    window.game.refresh();
    return spots[0];
  }, [kind, near ?? null]);

const tutorialStep = (page) => page.evaluate(() => window.game.guide?.step?.id ?? null);

/** Taps (phone) or clicks (PC) a game point. */
async function press(page, x, y) {
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) {
    const { tap } = await touchInput(page);
    await tap([x, y]);
  } else await page.mouse.click(...(await gameToPage(page, x, y)));
  await page.waitForTimeout(150);
}

/** Drags through grid cells with one finger (phone) or the mouse (PC). */
async function dragCells(page, cells) {
  if (!(await page.evaluate(() => navigator.maxTouchPoints > 0))) return mouseDrag(page, cells);
  const { touch } = await touchInput(page);
  const pts = await Promise.all(cells.map((c) => cellToScreen(page, ...c)));
  await touch('touchStart', [pts[0]]);
  await page.waitForTimeout(220); // a touch drag builds only after a short hold
  for (const p of pts.slice(1)) {
    await touch('touchMove', [p]);
    await page.waitForTimeout(40);
  }
  await touch('touchEnd', []);
  await page.waitForTimeout(200);
}

/** Plays the whole tutorial as a new player would, with a screenshot of each step. */
async function playTutorial(page, suffix) {
  await startGame(page, { tutorial: true });
  const shotStep = (name) => shot(page, `tutorial-${name}${suffix}`);
  const pressTool = async (name, k) => press(page, ...(await uiPoint(page, name, k)));

  // 1. Road: the arrow points at Rua, then along the marked road.
  assert((await tutorialStep(page)) === 'road', 'the tutorial starts with the road');
  await page.evaluate(() => window.game.setSpeed(0));
  await shotStep('step-1');
  await tool(page, 4); // Campo is locked during the step
  assert(await page.evaluate(() => window.game.tool === 'view'), 'only the step tool can be picked');
  await pressTool('leftButton', 1); // Rua
  assert(await page.evaluate(() => window.game.tool === 'road'), 'the Rua button picks the road');
  const ghost = await page.evaluate(() => window.game.ghost.map((c) => [c.x, c.y]));
  assert(ghost.length === 6, `a marked road of 6 cells (${ghost.length})`);
  await dragCells(page, ghost);
  assert((await tutorialStep(page)) === 'houses', 'dragging the marked road ends step 1');

  // 2. Houses: green spots next to the road.
  await pressTool('buildButton', 0); // Casa
  await page.waitForTimeout(200);
  await shotStep('step-2');
  for (let k = 0; k < 3; k++) await placeNear(page, 'house');
  assert((await tutorialStep(page)) === 'family', '3 houses end step 2');

  // 3. A family arrives; the camera follows it.
  await page.evaluate(() => window.game.setSpeed(1));
  await page.waitForFunction(() => window.state.families.length > 0, null, { timeout: 20000 });
  await page.waitForTimeout(700);
  await shotStep('step-3');
  await page.waitForFunction(() => window.game.guide?.step?.id === 'field', null, { timeout: 30000 });

  // 4. Field.
  await page.evaluate(() => window.game.setSpeed(0));
  await shotStep('step-4');
  await placeNear(page, 'field');
  assert((await tutorialStep(page)) === 'well', 'a field ends step 4');

  // 5. Well: the preview shows its radius and the houses it serves.
  await pressTool('buildButton', 2); // Poço
  const house = await page.evaluate(() => window.state.buildings.find((b) => b.kind === 'house' && b.level >= 1));
  const spot = await page.evaluate(([x, y]) => {
    const { state: s, core } = window;
    return core.placeSpots(s, 'well').sort((a, b) => Math.abs(a.x - x) + Math.abs(a.y - y) - (Math.abs(b.x - x) + Math.abs(b.y - y)))[0];
  }, [house.x, house.y]);
  await page.mouse.move(...(await cellToPage(page, spot.x + 1, spot.y + 1)));
  await page.evaluate(([x, y]) => window.game.setHover({ x, y }), [spot.x + 1, spot.y + 1]);
  await page.waitForTimeout(200);
  const serves = await page.evaluate(() => window.game.map.serves.visible && window.game.map.serves.text);
  assert(serves && serves.startsWith('Atende'), `the well preview says how many houses it serves (${serves})`);
  await shotStep('step-5');
  await page.evaluate(([x, y]) => {
    window.core.place(window.state, 'well', x, y);
    window.game.refresh();
  }, [spot.x, spot.y]);
  assert((await tutorialStep(page)) === 'grow', 'a well ends step 5');

  // 6. Watch a tent become a mud house; then every unlocked tool is free.
  await shotStep('step-6');
  await page.evaluate(() => window.game.setSpeed(3));
  await page.waitForFunction(() => window.game.guide?.step === null, null, { timeout: 60000 });
  assert(await page.evaluate(() => window.game.guide.allowed() === null), 'tools are free after step 6');

  // Goal 2: the balance message, then the market.
  await page.evaluate(() => {
    window.game.setSpeed(0);
    window.state.unlocked.push('market');
    window.game.handleEvents([{ type: 'upkeepStart' }]);
    window.game.refresh();
  });
  assert((await tutorialStep(page)) === 'upkeep', 'goal 2 shows the balance message');
  await shotStep('saldo');
  await clickTutorial(page, 'okBtn');
  assert((await tutorialStep(page)) === 'market', '"Entendi" moves on to the market');
  await shotStep('market');
  await placeNear(page, 'market');
  assert((await tutorialStep(page)) === null, 'a market ends the tutorial');
  assert(await page.evaluate(() => localStorage.getItem('jerusalem.tutorialDone') === '1'), 'the tutorial is remembered as done');
}

// ---------- scenarios ----------

const scenarios = {
  async title(page) {
    await page.goto(URL);
    await page.waitForTimeout(1200);
    await shot(page, 'title');
    // Once the tutorial was seen, the title offers it again.
    await page.evaluate(() => localStorage.setItem('jerusalem.tutorialDone', '1'));
    await page.reload();
    await page.waitForTimeout(1200);
    await shot(page, 'title-again');
  },

  /** First game on a phone: the six tutorial steps, then the balance and the market. */
  tutorial: { context: PHONE, run: (page) => playTutorial(page, '') },
  'tutorial-pc': { context: PC, run: (page) => playTutorial(page, '-pc') },

  /** Skipping ends the tutorial for good; with the storage blocked the game still runs. */
  async 'tutorial-skip'(page) {
    await startGame(page, { tutorial: true });
    assert(await page.evaluate(() => window.game.guide?.step?.id === 'road'), 'a first game starts the tutorial');
    await clickTutorial(page, 'skipBtn');
    assert(await page.evaluate(() => window.game.guide === null), 'Pular tutorial ends it');
    assert(await page.evaluate(() => localStorage.getItem('jerusalem.tutorialDone') === '1'), 'skipping is remembered');
    await tool(page, 4); // Campo is free again
    assert(await page.evaluate(() => window.game.tool === 'field'), 'every unlocked tool is free after skipping');

    const blocked = await page.context().newPage();
    const errors = [];
    blocked.on('pageerror', (e) => errors.push(String(e)));
    await blocked.addInitScript(() => {
      const no = () => {
        throw new Error('storage blocked');
      };
      Object.defineProperty(window, 'localStorage', { get: no });
    });
    await startGame(blocked, { tutorial: true });
    assert(await blocked.evaluate(() => window.game.guide !== null), 'with blocked storage the tutorial runs');
    await clickTutorial(blocked, 'skipBtn');
    assert(await blocked.evaluate(() => window.game.guide === null), 'and skipping still works');
    assert(errors.length === 0, `no errors with blocked storage (${errors})`);
    await blocked.close();
  },

  /** A tap on the options panel (title or edges) never reaches the map or the tools. */
  async options(page) {
    await startGame(page);
    const gear = await page.evaluate(() => [window.layout.OPTIONS.x + window.layout.OPTIONS.w / 2, window.layout.OPTIONS.y + window.layout.OPTIONS.h / 2]);
    await page.mouse.click(...(await gameToPage(page, ...gear)));
    await page.waitForTimeout(150);
    assert(await page.evaluate(() => window.game.ui.options.panel.visible), 'the gear opens the options');
    const t0 = await page.evaluate(() => window.game.tool);
    const [x, y] = await page.evaluate(() => {
      const r = window.game.ui.options.rect;
      return [r.x + r.w / 2, r.y + 12];
    });
    await page.mouse.click(...(await gameToPage(page, x, y)));
    await page.waitForTimeout(150);
    assert(await page.evaluate((t) => window.game.tool === t && !window.game.selected, t0), 'tapping the panel title changes nothing on the map');
    assert(await page.evaluate(() => window.game.ui.options.panel.visible), 'and the panel stays open');
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

  'day-night': {
    context: PC,
    async run(page) {
      await startGame(page);
      await buildTown(page);
      await page.evaluate(() => window.game.setSpeed(0));
      const phases = [
        ['morning', 0.22, 'sun'],
        ['golden', 0.47, 'sun'],
        ['sunset', 0.56, 'dusk'],
        ['night', 0.76, 'moon'],
      ];
      for (const [name, t, icon] of phases) {
        await page.evaluate((t) => window.game.dayNight.setTime(t), t);
        await page.waitForTimeout(400);
        const got = await page.evaluate(() => ({ icon: window.game.ui.hud.phase.texture.key, light: window.game.dayNight.current }));
        assert(got.icon === `icon-${icon}`, `${name}: ${icon} next to the month (got ${got.icon})`);
        await shot(page, `day-night-${name}`);
      }
      const night = await page.evaluate(() => window.game.dayNight.current);
      assert(night.night === 1 && Math.abs(night.walkers - 0.5) < 1e-9, `half the walkers at night (${night.walkers})`);
      assert(await page.evaluate(() => window.game.map.lights.groups.size > 10), 'windows, lamps and fires are lit at night');
      // Turning the cycle off from the options panel: always day.
      const opt = await page.evaluate(() => window.layout.OPTIONS);
      await page.mouse.click(...(await gameToPage(page, opt.x + opt.w / 2, opt.y + opt.h / 2)));
      await page.waitForTimeout(200);
      const row = await page.evaluate(() => {
        const r = window.game.ui.options.rect;
        return [r.x + r.w / 2, r.y + 6 + 36 + 30];
      });
      await shot(page, 'day-night-options');
      await page.mouse.click(...(await gameToPage(page, ...row)));
      await page.waitForTimeout(300);
      const off = await page.evaluate(() => window.game.dayNight.current);
      assert(off.night === 0 && off.phase !== 'night', `cycle off shows the day (${off.phase})`);
      await shot(page, 'day-night-off');
      await page.mouse.click(...(await gameToPage(page, ...row))); // back on for the next runs (saved in the browser)
    },
  },

  async 'scaffold-roads'(page) {
    await startGame(page);
    await buildTown(page);
    await page.evaluate(() => window.game.setSpeed(0));
    // Busy streets: the north road worn, the east road paved (steps only change the looks).
    await page.evaluate(() => {
      const { state: s, game } = window;
      for (let x = 12; x <= 36; x++) for (let k = 0; k < 80; k++) game.wear.step(s, x, 18);
      for (let y = 18; y <= 31; y++) for (let k = 0; k < 300; k++) game.wear.step(s, 36, y);
      game.refresh();
    });
    await page.waitForTimeout(200);
    const wear = await page.evaluate(() => {
      const { state: s, game } = window;
      return [game.wear.level(s, 20, 18), game.wear.level(s, 36, 25), game.wear.level(s, 20, 31)];
    });
    assert(wear[0] === 1 && wear[1] === 2 && wear[2] === 0, `worn, paved and plain streets (${wear})`);
    await shot(page, 'roads-wear');
    // A new building goes up behind a scaffold, then shows its drawing.
    await page.evaluate(() => {
      window.core.place(window.state, 'workshop', 13, 23);
      window.game.refresh();
    });
    await page.waitForTimeout(300);
    const up = () => page.evaluate(() => !!window.game.map.views.get(window.state.buildings.at(-1).id).scaffold);
    assert(await up(), 'a new building shows a scaffold');
    await shot(page, 'scaffold', { scaffolds: true });
    await page.waitForFunction(() => !window.game.map.views.get(window.state.buildings.at(-1).id).scaffold, null, { timeout: 20000 });
    await shot(page, 'scaffold-done');
  },

  async ambient(page) {
    await startGame(page);
    await buildTown(page);
    await page.evaluate(() => window.game.dayNight.setTime(0.3));
    await page.waitForTimeout(1500); // animals walk a little (the game keeps running)
    const kinds = await page.evaluate(() => {
      const out = {};
      for (const g of window.game.ambient.groups.values()) for (const m of g.movers) out[m.kind] = (out[m.kind] ?? 0) + 1;
      out.laundry = [...window.game.ambient.groups.keys()].filter((k) => k.startsWith('l')).length;
      return out;
    });
    for (const k of ['chicken', 'donkey', 'dove', 'boat', 'washer', 'sheep'])
      assert(kinds[k] > 0, `${k} around the city (${JSON.stringify(kinds)})`);
    assert(kinds.laundry > 0, 'laundry lines on some houses');
    const missing = await page.evaluate(() =>
      [...window.game.ambient.groups.values()].flatMap((g) => g.movers).filter((m) => m.img.texture.key === '__MISSING').map((m) => m.kind),
    );
    assert(missing.length === 0, `every animal has a texture (missing: ${missing})`);
    await shot(page, 'ambient-town');
    // Zoom on the river near the first boat.
    await page.evaluate(() => {
      const boat = [...window.game.ambient.groups.values()].flatMap((g) => g.movers).find((m) => m.kind === 'boat');
      const cam = window.game.cameras.main;
      cam.setZoom(1.6);
      cam.centerOn(boat.img.x, boat.img.y);
    });
    await page.waitForTimeout(400);
    await shot(page, 'ambient-river');
  },

  /** PC, paused town: each season's colours and the season icon, then rain, snow and a season toast. */
  'seasons': {
    context: PC,
    async run(page) {
      await startGame(page);
      await buildTown(page);
      await page.evaluate(() => {
        window.game.setSpeed(0);
        window.game.dayNight.setTime(0.3);
      });
      const M = await page.evaluate(() => window.core.RULES.monthsPerSeason);
      for (const [k, season] of ['spring', 'summer', 'autumn', 'winter'].entries()) {
        await page.evaluate(([m]) => {
          window.state.month = m;
          window.game.weather.force('clear', 0);
          window.game.refresh();
        }, [k * M + 3]);
        await page.waitForTimeout(2500); // petals, dust and leaves drift in
        const icon = await page.evaluate(() => window.game.ui.hud.seasonIcon.texture.key);
        assert(icon === `icon-${season}`, `the month shows the ${season} icon (${icon})`);
        await shot(page, `seasons-${season}`);
      }
      await page.evaluate(() => window.game.weather.force('rain'));
      await page.waitForTimeout(1200);
      const rain = await page.evaluate(() => window.game.weather.rain.getAliveParticleCount());
      assert(rain > 20, `rain falls (${rain} drops)`);
      await shot(page, 'weather-rain');
      await page.evaluate(() => window.game.weather.force('snow'));
      await page.waitForTimeout(2500);
      await shot(page, 'weather-snow');
      // Back to the seasons: one season toast when a month opens a new season.
      await page.evaluate(([m]) => {
        window.game.weather.force(null);
        window.state.month = m - 1;
        window.game.handleEvents(window.core.stepMonth(window.state, window.core.createRng(1)));
        window.game.refresh();
      }, [4 * M]);
      const toasts = await page.evaluate(() => window.game.ui.toasts.list.map((t) => t.msg));
      assert(toasts.some((m) => m.startsWith('Chegou a primavera')), `a toast announces the spring (${toasts})`);
      await page.waitForTimeout(300);
      await shot(page, 'seasons-toast');
    },
  },

  async 'town-art'(page) {
    await startGame(page);
    await buildTown(page);
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

  /** Happiness: the face on the plaque, its breakdown, a house's mood, the garden's radius and a sad balloon. */
  async happiness(page) {
    await startGame(page);
    await setSpeed(page, 0);
    await buildTown(page);
    await page.evaluate(() => {
      window.state.food = 500; // no famine until the scenario asks for it
      window.game.refresh();
    });
    const eco = await page.evaluate(() => window.game.eco);
    assert(eco.moods.happy + eco.moods.neutral + eco.moods.sad > 0, `houses have moods (${JSON.stringify(eco.moods)})`);
    const [face, want] = await page.evaluate(() => [window.game.ui.hud.face.texture.key, `mood-${window.core.moodOf(window.game.eco.happiness)}`]);
    assert(face === want, `plaque face follows the mood (${face}, ${want})`);

    await clickUi(page, 'plaqueSlot', 4);
    assert(await page.evaluate(() => window.game.infoMode === 'happiness'), 'tapping the face shows the happiness breakdown');
    await shot(page, 'happiness-breakdown');

    // A house next to the garden: happy, with its reasons in the info line.
    const mood = await page.evaluate(() => {
      const { state: s, core } = window;
      const b = s.grid[19 * s.cols + 19];
      window.game.select({ x: 19, y: 19 });
      return core.houseInfo(s, b).happiness;
    });
    assert(mood?.parts.some((p) => p.kind === 'garden'), `the house beside the garden counts it (${JSON.stringify(mood)})`);
    await shot(page, 'happiness-house');

    // Famine makes every house sad: sad balloons and a red face.
    await page.evaluate(() => {
      window.state.famine = true;
      window.game.refresh();
    });
    await page.waitForTimeout(300);
    assert((await page.evaluate(() => window.game.ui.hud.face.texture.key)) === 'mood-sad', 'famine turns the face sad');
    await shot(page, 'happiness-sad');

    // Picking the garden shows its radius.
    await page.evaluate(() => {
      window.state.famine = false;
      window.game.selectTool('garden');
    });
    await page.mouse.move(...(await cellToScreen(page, 16, 25)));
    await page.waitForTimeout(300);
    await shot(page, 'overlay-garden');
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
    context: PHONE,
    async run(page) {
      const { touch, tap } = await touchInput(page);
      // Same rule as src/render/layout.ts: the game height follows the screen shape (1280 x 591 here).
      const phoneH = Math.round(Math.min(720, Math.max(560, (GAME_W * 390) / 844)));

      await page.addInitScript(() => localStorage.setItem('jerusalem.tutorialDone', '1'));
      await page.goto(URL);
      await page.waitForTimeout(1200);
      await shot(page, 'touch-title');
      await page.waitForFunction(() => document.querySelector('canvas'));
      // Começar (title panel 520 tall, button 62 above its bottom, 160 left of center once the tutorial
      // was seen); the game is not running yet, so map by hand.
      const scale = 390 / phoneH;
      await cdpTapPage(page, (844 - GAME_W * scale) / 2 + (640 - 160) * scale, ((phoneH - 520) / 2 + 520 - 62) * scale);
      await page.waitForFunction(() => window.game?.ui && window.state && window.layout, null, { timeout: 15000 });
      await page.waitForTimeout(500);

      await tap(await uiPoint(page, 'leftButton', 1)); // Rua
      assert(await page.evaluate((h) => window.game.scale.height === h, phoneH), `phone game height is ${phoneH}`);
      assert(await page.evaluate(() => window.game.tool === 'road'), 'tapping the Rua button picks the road');
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

  /** New HUD on a phone in landscape: rails, plaque, goal and alert banners, preview above the finger. */
  'hud-phone': {
    context: PHONE,
    async run(page) {
      await startGame(page);
      const { touch, tap } = await touchInput(page);
      await setupHudCity(page);
      const game = await page.evaluate(() => [window.game.scale.width, window.game.scale.height]);
      assert(game[0] === 1280 && game[1] === 591, `phone game size is 1280 x 591 (got ${game})`);
      // Rail buttons are at least 44 screen px.
      const px = await page.evaluate(() => (window.layout.BTN * document.querySelector('canvas').getBoundingClientRect().width) / 1280);
      assert(px >= 44, `rail buttons are at least 44 screen px (got ${px.toFixed(1)})`);
      await shot(page, 'hud-phone');

      await tap(await uiPoint(page, 'buildButton', 2)); // Poço
      assert(await page.evaluate(() => window.game.tool === 'well'), 'tapping the Poço button picks the well');
      // Hold a finger on the map: the preview sits above it. Sliding onto a rail and releasing cancels.
      const count = async () => (await stats(page)).buildings.length;
      const n0 = await count();
      const finger = [820, 470];
      const under = await page.evaluate(([x, y]) => window.game.cellAt(x, y), finger);
      await touch('touchStart', [finger]);
      await touch('touchMove', [[finger[0] + 4, finger[1] + 2]]);
      await page.waitForTimeout(250);
      await shot(page, 'hud-phone-preview');
      const hover = await page.evaluate(() => window.game.hover);
      assert(hover && hover.x + hover.y < under.x + under.y, `the preview is aimed above the finger (${JSON.stringify([hover, under])})`);
      await touch('touchMove', [await uiPoint(page, 'buildButton', 4)]);
      await page.waitForTimeout(100);
      await touch('touchEnd', []);
      await page.waitForTimeout(200);
      assert((await count()) === n0, 'releasing a building over the rail cancels it');

      // A finger near the top rail edge would aim under the plaque: no preview, nothing built.
      const before = (await stats(page)).buildings.length;
      const [px0] = await uiPoint(page, 'plaqueSlot', 2);
      await touch('touchStart', [[px0, 180]]); // aims 90 px higher, at the goal banner
      await page.waitForTimeout(250);
      const hidden = await page.evaluate(() => window.game.hover);
      await touch('touchEnd', []);
      await page.waitForTimeout(200);
      assert(!hidden, 'no preview when the aimed point is under the plaque');
      assert((await stats(page)).buildings.length === before, 'nothing is built under the plaque');

      // Close the alert with its X, then tap the goal.
      const shown = await page.evaluate(() => window.game.ui.hud.shown?.kind);
      assert(shown && shown !== 'debt', `a closable alert is shown (${shown})`);
      await tap(await page.evaluate(() => {
        const r = window.game.ui.hud.closeRect;
        return [r.x + r.w / 2, r.y + r.h / 2];
      }));
      const after = await page.evaluate(() => window.game.ui.hud.shown?.kind ?? null);
      assert(after !== shown, `the closed alert is hidden (${shown} -> ${after})`);
      await tap(await page.evaluate(() => [640, window.layout.GOAL_Y + window.layout.GOAL_H / 2]));
      assert(await page.evaluate(() => window.game.infoMode === 'goal'), 'tapping the goal shows it in the info line');
      await shot(page, 'hud-phone-goal');
    },
  },

  /** The smallest phone in landscape (800 x 360): every rail and speed button is still a 44 px target. */
  'hud-small-phone': {
    context: { ...PHONE, viewport: { width: 800, height: 360 } },
    async run(page) {
      await startGame(page);
      const px = await page.evaluate(() => {
        const k = document.querySelector('canvas').getBoundingClientRect().height / window.game.scale.height;
        const { LEFT_BTN, BTN, SPEED_BTN, TOOL_W } = window.layout;
        return { left: LEFT_BTN * k, right: BTN * k, speed: SPEED_BTN * k, width: TOOL_W * k };
      });
      for (const [name, v] of Object.entries(px)) assert(v >= 44, `${name} buttons are at least 44 screen px (got ${v.toFixed(1)})`);
      const plaque = await page.evaluate(() => [window.layout.PLAQUE.x, window.layout.SPEED.x + window.layout.SPEED.w]);
      assert(plaque[0] > plaque[1], `the plaque clears the speed buttons (${plaque})`);
      await shot(page, 'hud-small-phone');
    },
  },

  /** New HUD on a PC: clicks on the rails and speed, the UI never builds, alert X, silver and goal. */
  'hud-pc': {
    context: PC,
    async run(page) {
      await startGame(page);
      await setupHudCity(page);
      const game = await page.evaluate(() => [window.game.scale.width, window.game.scale.height]);
      assert(game[0] === 1280 && game[1] === 720, `PC game size is 1280 x 720 (got ${game})`);

      await clickUi(page, 'buildButton', 3); // Mercado
      assert(await page.evaluate(() => window.game.tool === 'market'), 'clicking the Mercado button picks the market');
      const [mx, my] = await cellToPage(page, 29, 30);
      await page.mouse.move(mx - 30, my); // leaving the rail: Phaser gives this move to the UI ("out" event)
      await page.mouse.move(mx, my);
      await page.waitForTimeout(250);
      assert(await page.evaluate(() => !!window.game.hover), 'the market preview follows the mouse');
      await shot(page, 'hud-pc');

      await clickUi(page, 'speedButton', 2); // 3x
      assert(await page.evaluate(() => window.game.speed === 3), 'the 3x button sets the speed');
      await clickUi(page, 'speedButton', 0); // pause
      assert(await page.evaluate(() => window.game.speed === 0), 'the pause button pauses');

      // Dragging a road that starts on the plaque builds nothing.
      await clickUi(page, 'leftButton', 1); // Rua
      const r0 = (await stats(page)).roads;
      await page.mouse.move(...(await gameToPage(page, ...(await uiPoint(page, 'plaqueSlot', 3)))));
      await page.mouse.down();
      await page.mouse.move(...(await cellToPage(page, 30, 30)), { steps: 8 });
      await page.mouse.up();
      assert((await stats(page)).roads === r0, 'a drag that starts on the plaque builds nothing');

      // Closing the alert keeps it hidden while it lasts; it comes back after it goes away.
      const shown = await page.evaluate(() => window.game.ui.hud.shown?.kind);
      await page.mouse.click(...(await gameToPage(page, ...(await page.evaluate(() => {
        const r = window.game.ui.hud.closeRect;
        return [r.x + r.w / 2, r.y + r.h / 2];
      })))));
      const dismissed = await page.evaluate(() => [...window.game.ui.hud.dismissed]);
      assert(dismissed.includes(shown), `the X closes the alert (${shown})`);
      await page.evaluate(() => window.game.refresh());
      assert(await page.evaluate((k) => window.game.ui.hud.shown?.kind !== k, shown), 'a closed alert stays hidden');

      await clickUi(page, 'plaqueSlot', 1); // silver
      assert(await page.evaluate(() => window.game.infoMode === 'silver'), 'clicking the silver shows the breakdown');
      await shot(page, 'hud-pc-silver');
      await page.mouse.click(...(await gameToPage(page, 640, await page.evaluate(() => window.layout.GOAL_Y + 10))));
      assert(await page.evaluate(() => window.game.infoMode === 'goal'), 'clicking the goal shows it in the info line');
      await shot(page, 'hud-pc-goal');

      // Debt: the alert has no X.
      await page.evaluate(() => {
        window.state.silver = -10;
        window.state.debtMonths = 3;
        window.game.refresh();
      });
      const debt = await page.evaluate(() => [window.game.ui.hud.shown?.kind, window.game.ui.hud.closeRect]);
      assert(debt[0] === 'debt' && debt[1] === null, 'the debt alert has no X');
      await page.waitForTimeout(200);
      await shot(page, 'hud-pc-debt');
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
    await mouseDrag(page, [[28, 17], [31, 17]]);
    await page.waitForTimeout(250);
    const c = await page.evaluate(() => {
      const s = window.state;
      const field = s.buildings.find((b) => b.kind === 'field');
      return {
        loose: [28, 29, 30, 31].every((x) => s.roads[17 * s.cols + x] && !s.network[17 * s.cols + x]),
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
    await clickUi(page, 'leftButton', 5); // ↻
    await page.waitForTimeout(300);
    assert((await page.evaluate(() => window.iso.getRotation())) === 1, 'the clockwise arrow turns the view');
    assert((await stats(page)).roads === 41, 'clicking the arrow builds nothing');
    await tool(page, 2); // Rua: picking must follow the turned view
    await mouseDrag(page, [[27, 28], [30, 28]]);
    const built = await page.evaluate(() => [27, 28, 29, 30].every((x) => window.state.roads[28 * window.state.cols + x]));
    assert(built, 'dragging in the turned view builds on the right grid cells');
    await tool(page, 1);
    await shot(page, 'turn-1');
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(150);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(300);
    await shot(page, 'turn-3');
    await page.keyboard.press('KeyQ');
    await page.waitForFunction(() => window.iso.getRotation() === 2, null, { timeout: 3000 }).catch(() => {});
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
      s.goalIndex = core.RULES.upkeepStartsAfterGoal; // upkeep is charged from goal 2 on
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

    await clickUi(page, 'plaqueSlot', 1); // tap the silver
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
    await tool(page, 9); // Templo
    await page.mouse.click(...(await cellToScreen(page, 27, 34))); // 6x6 centered: top-left (25, 32)
    await page.waitForTimeout(250);
    await shot(page, 'temple-celebration');
    await page.waitForFunction(() => window.state.won, null, { timeout: 15000 });
    await page.waitForTimeout(500);
    await shot(page, 'victory');
  },
};

/** Taps a page point (before the game scene exists). */
async function cdpTapPage(page, x, y) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] });
  await page.waitForTimeout(60);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(150);
}

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

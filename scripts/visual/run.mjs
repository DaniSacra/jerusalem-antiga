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
import { mkdir, readFile, rm } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const OUT = process.env.VISUAL_OUT ?? 'screenshots';
/** Tutorial numbers (weddingStepMaxWeeks). */
const TUTORIAL = JSON.parse(await readFile('src/data/tutorial.json', 'utf8'));
const PORT = Number(process.env.VISUAL_PORT ?? 5199);
/** A fixed map (dev hook): the river and the caravan always in the same place, away from the test towns. */
const SEED = 5;
const URL = `http://localhost:${PORT}/?seed=${SEED}`;
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

/** Game position of a part of the interface by its name (see `novaPoint` in layout.ts), e.g. 'tool-road' or 'pill-silver'. */
const uiPoint = (page, name) =>
  page.evaluate((name) => {
    const p = window.layout.novaPoint(name);
    if (!p) throw new Error(`no interface part named ${name} (or it is hidden)`);
    return [p.x, p.y];
  }, name);

/** Clicks a part of the interface with the mouse (see uiPoint). */
const clickUi = async (page, name) => page.mouse.click(...(await gameToPage(page, ...(await uiPoint(page, name)))));

/** Picks a tool directly (the build column shows categories; the keys are 1 Mover, 2 Rua, 3–6 categories, 0 Demolir). */
const pick = (page, t) => page.evaluate((t) => window.game.selectTool(t), t);

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

/**
 * Waits for a started game: the dev hooks come with a dynamic import and the interface with its own
 * scene, so wait for all of them (window.layout and a laid-out UIScene too), with room for a loaded machine.
 */
const gameReady = (page) =>
  page.waitForFunction(
    () => window.game?.ui?.view && window.game.cameras?.main && window.state && window.core && window.iso && window.layout?.novaPoint('tool-road'),
    null,
    { timeout: 60000 },
  );

/** Opens the game, leaves the title screen and waits for the UI to be attached. The first-game
 * tutorial is skipped (marked as seen) unless `tutorial` is set. */
async function startGame(page, { tutorial = false } = {}) {
  if (!tutorial) await page.addInitScript(() => localStorage.setItem('jerusalem.tutorialDone', '1'));
  await page.goto(URL, { timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('canvas'));
  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  await gameReady(page);
  // Software rendering is slow: keep the image finish on so screenshots do not depend on the frame rate.
  await page.evaluate(() => (window.game.dayNight.fpsGuard = false));
  await page.waitForTimeout(300);
}

/** Presses a PC tool key: 1 Mover, 2 Rua, 3–6 the categories (again: the next building), 0 Demolir. */
const tool = (page, n) => page.keyboard.press(`Digit${n}`);

/** Page position of the center of a grid cell. */
const cellToPage = async (page, x, y) => gameToPage(page, ...(await cellToScreen(page, x, y)));

/** Clicks a grid cell, which must be on the open map (not under the UI). */
async function mouseClick(page, x, y) {
  const [sx, sy] = await cellToScreen(page, x, y);
  assert(!(await page.evaluate(([x, y]) => window.game.ui.isOverUi(x, y), [sx, sy])), `cell ${x},${y} is not under the UI`);
  await page.mouse.click(...(await cellToPage(page, x, y)));
}

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
    for (const b of s.buildings.filter((b) => b.kind !== 'altar')) core.clearCell(s, b.x, b.y); // the caravan tents
    s.unlocked.push('market', 'workshop');
    for (let y = 27; y <= 41; y += 2) {
      core.place(s, 'house', 22, y);
      s.grid[y * s.cols + 22].level = 2;
    }
    core.place(s, 'field', 25, 27);
    for (let k = 0; k < 12 && core.computeEconomy(s).silverDelta >= 0; k++) core.place(s, 'plaza', 4 + 3 * k, 4); // off the road
    s.silver = 180;
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
    s.unlocked = ['road', 'house', 'field', 'plaza', 'fisher', 'gatherer', 'granary', 'market', 'workshop', 'park', 'temple'];
    s.feature = s.feature.map(() => null);
    for (const b of s.buildings.filter((b) => b.kind !== 'altar')) core.clearCell(s, b.x, b.y); // the caravan tents
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
    put('plaza', 27, 25);
    put('market', 29, 25, 0, true); // rotated 4x2
    put('workshop', 33, 25);
    put('field', 26, 29);
    put('field', 29, 29);
    put('house', 32, 29, 4);
    put('house', 34, 29, 3);
    put('market', 34, 19); // 2x4 upright
    put('temple', 25, 32);
    put('park', 19, 22); // beside the altar ring, cheers the houses above it
    put('granary', 18, 24); // food store, beside the altar ring
    put('gatherer', 13, 26);
    for (const [x, y] of [[15, 26], [16, 27], [15, 28]]) s.feature[y * s.cols + x] = 'olive'; // its grove
    // A fisher by the river east of the town, on a road from the east wall.
    let rx = 37;
    while (s.ground[27 * s.cols + rx + 2] !== 'river' && rx < s.cols - 3) core.place(s, 'road', rx++, 27);
    put('fisher', rx, 27);
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

/**
 * Sets the look of the year on a paused town: a week, the rare years (snow, drought), the weather
 * (sky, rain level) and how wet the ground is, then waits until the map shows it (snowy copies of
 * the textures included) and the drops are on screen.
 */
async function setLook(page, week, { snow = false, drought = false, sky = 'clear', level = 'medium', wet = 0 } = {}) {
  await page.evaluate(([week, o]) => {
    const g = window.game;
    window.state.week = week;
    g.seasons.force({ snow: o.snow, drought: o.drought });
    g.weather.force(o.sky, o.sky === 'clear' ? 0 : 1, o.level);
    g.weather.forceWet(o.wet);
    g.refresh();
  }, [week, { snow, drought, sky, level, wet }]);
  // The look is applied on the next frames (a few snowy textures per frame): wait for them, not a fixed time.
  await page.waitForFunction(
    (m) => {
      const map = window.game.map;
      const M = window.core.RULES.weeksPerSeason;
      return map.look && map.look.season === window.core.seasonOf(m) && Math.floor(map.look.at) === m % M && !map.snowDirty;
    },
    week,
    { timeout: 20000 },
  );
}

async function hideUi(page, hidden) {
  await page.evaluate((h) => window.game.scene.setVisible(!h, 'ui'), hidden);
  await page.waitForTimeout(150);
}

async function seasonsScenario(page, suffix) {
  await startGame(page);
  await buildTown(page);
  await page.evaluate(() => {
    window.game.setSpeed(0);
    window.game.dayNight.setTime(0.3);
    window.state.food = window.core.foodCapacity(window.state); // full stores: no famine balloons over the captures
    // Groves around the town (buildTown clears the trees): olives (some drawn as almonds and figs) and palms.
    const s = window.state;
    for (let y = 8; y < 46; y++) {
      for (let x = 2; x < 46; x++) {
        const i = y * s.cols + x;
        const h = (x * 7 + y * 13 + ((x * y) % 5)) % 9;
        if (s.grid[i] || s.roads[i] || s.ground[i] === 'river' || h > 1) continue;
        s.feature[i] = h === 0 ? 'olive' : (x + y) % 3 ? 'olive' : 'palm';
      }
    }
    window.game.refresh();
  });
  const M = await page.evaluate(() => window.core.RULES.weeksPerSeason);
  const look = () => page.evaluate(() => {
    const l = window.game.map.look;
    return { season: l.season, almond: l.almond, fig: l.fig, crop: l.crop, harvest: l.harvest, snow: l.snow, drought: l.drought, smoke: l.smoke };
  });
  const views = () => page.evaluate(() => [...window.game.map.views.values()].map((v) => v.main.texture.key));
  const icon = () => page.evaluate(() => window.game.ui.view.top.season.icon.texture.key);
  /** The season pill's drought mark (its icon): shown, and where, in screen px for a close capture. */
  const droughtMark = () => page.evaluate(() => {
    const pill = window.game.ui.view.top.season;
    const r = document.querySelector('canvas').getBoundingClientRect();
    const key = pill.icon.texture.key;
    return { on: key === 'icon-drought', k: r.height / window.game.scale.height, left: r.left, top: r.top, key, rect: pill.rect };
  });

  // The year starts in autumn: autumn, winter, spring, summer.
  const seasons = [
    ['spring', 2 * M + 5],
    ['summer', 3 * M + 5],
    ['autumn', 0 * M + 4],
    ['winter', 1 * M + 3],
  ];
  for (const [season, week] of seasons) {
    await setLook(page, week);
    const l = await look();
    assert(l.season === season, `week ${week} is ${season} (${l.season})`);
    assert((await icon()) === `icon-${season}`, `the week shows the ${season} icon`);
    assert(!(await droughtMark()).on, `no drought mark in a normal ${season}`);
    if (season === 'spring') assert(l.crop === 'gold', `golden wheat at the spring harvest (${l.crop})`);
    if (season === 'winter') {
      assert(l.smoke === 1 && (await page.evaluate(() => window.game.map.smoke.emitting)), 'smoke from the houses in winter');
      assert(l.almond === 'bare' && l.fig === 'bare', `almonds and figs bare in early winter (${l.almond}, ${l.fig})`);
    }
    if (season === 'autumn') {
      assert(l.harvest, 'olive harvest in autumn');
      const pickers = await page.evaluate(() => [...window.game.ambient.groups.values()].reduce((n, g) => n + g.pickers.length, 0));
      assert(pickers > 0, `pickers by the olive trees (${pickers})`);
    }
    await page.waitForTimeout(1200); // petals and dust drift in
    await shot(page, `seasons-${season}${suffix}`);
    await hideUi(page, true);
    await shot(page, `seasons-${season}-noui${suffix}`);
    await hideUi(page, false);
  }

  // Late winter: the almond trees in bloom, figs still bare.
  await setLook(page, 1 * M + 9);
  const late = await look();
  assert(late.almond === 'bloom' && late.fig === 'bare', `almond bloom in late winter (${late.almond}, ${late.fig})`);
  await shot(page, `seasons-almond${suffix}`);

  // Rain in three strengths: drops all over the screen (more the heavier), splashes, wet ground and puddles.
  let last = 0;
  for (const [level, wet] of [['light', 0.4], ['medium', 0.7], ['heavy', 1]]) {
    await setLook(page, 1 * M + 2, { sky: 'rain', level, wet });
    const drops = await page.evaluate(() => window.game.weather.rain.getAliveParticleCount());
    assert(drops > Math.max(40, last), `rain falls (${level}: ${drops} drops, more than ${last})`);
    last = drops;
    const puddles = await page.evaluate(() => [...window.game.map.puddles.values()].filter((p) => p.visible && p.alpha > 0.3).length);
    assert(puddles > 0, `puddles on the roads (${puddles})`);
    await shot(page, `weather-rain-${level}${suffix}`);
  }

  // A snowy winter: snow on the ground, the roofs and the trees, and snow falling.
  await setLook(page, 1 * M + 6, { snow: true, sky: 'snow' });
  const sn = await look();
  assert(sn.snow === 1, `snow cover in a snowy winter (${sn.snow})`);
  const snowy = (await views()).filter((k) => k.endsWith('-snow')).length;
  assert(snowy > 10, `roofs under snow (${snowy} buildings)`);
  await shot(page, `weather-snow${suffix}`);

  // A summer drought: cracked earth, brown grass, the river shrunk to mud banks, dry low wheat.
  await setLook(page, 3 * M + 6, { drought: true });
  const dr = await look();
  assert(dr.drought === 1, `drought (${dr.drought})`);
  // Each field shows its own stage now (the drought thins the thirsty ones).
  const stages = await page.evaluate(() => [...window.game.map.views.values()].filter((v) => v.kind === 'field').map((v) => v.stage));
  assert(stages.length > 0 && stages.every(Boolean), `every field shows a crop stage in a dry summer (${stages})`);
  const mud = await page.evaluate(() => window.game.map.tiles.filter((t) => t.show === 'mud').length);
  assert(mud > 20, `dry river banks (${mud} cells)`);
  const mark = await droughtMark();
  assert(mark.on, `the season pill shows the drought mark (${JSON.stringify(mark)})`);
  await shot(page, `seasons-drought${suffix}`);
  // Close-up of the season pill with the drought icon.
  const P = mark.rect;
  await page.screenshot({ path: `${OUT}/seasons-drought-icon${suffix}.png`, clip: { x: mark.left + (P.x - 8) * mark.k, y: mark.top + (P.y - 8) * mark.k, width: (P.w + 16) * mark.k, height: (P.h + 16) * mark.k } });
  // Zoomed out over the river: the drought's mud banks and the sky behind the diorama.
  const cam = await page.evaluate(() => {
    const c = window.game.cameras.main;
    const old = { zoom: c.zoom, x: c.midPoint.x, y: c.midPoint.y };
    const r = window.iso.gridToWorld(42, 24);
    c.setZoom(0.5);
    c.centerOn(r.x, r.y);
    return old;
  });
  await page.waitForTimeout(300);
  await shot(page, `seasons-drought-zoom${suffix}`);
  await page.evaluate((o) => {
    const c = window.game.cameras.main;
    c.setZoom(o.zoom);
    c.centerOn(o.x, o.y);
  }, cam);
  await hideUi(page, true);
  await shot(page, `seasons-drought-noui${suffix}`);
  await hideUi(page, false);

  // Back to the seasons: one season toast when a week opens a new season.
  await page.evaluate(([m]) => {
    window.game.weather.force(null);
    window.game.weather.forceWet(null);
    window.game.seasons.force(null);
    window.state.week = m - 1;
    window.game.handleEvents(window.core.stepWeek(window.state, window.core.createRng(1)));
    window.game.refresh();
  }, [2 * M]);
  const toasts = await page.evaluate(() => { const t = window.game.ui.view.toasts; return [...t.list, ...t.queue].map((x) => x.msg); });
  assert(toasts.some((m) => m.startsWith('Chegou a primavera')), `a toast announces the spring (${toasts})`);
  await page.waitForTimeout(300);
  assert(!(await droughtMark()).on, 'the drought mark goes away after the drought');
  await shot(page, `seasons-toast${suffix}`);
}

/** Presses a button of the tutorial bubble ('skipBtn' or 'okBtn'). */
async function clickTutorial(page, which) {
  const [x, y] = await page.evaluate((k) => {
    const v = window.game.ui.view.tutorial;
    const c = k === 'skipBtn' ? v.skipBtn.root : v.okBtn.container;
    const m = c.getWorldTransformMatrix(); // the buttons sit inside the (scaled) tutorial balloon
    return [m.tx, m.ty];
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

/**
 * After the tutorial camera glides to the step's place: the place (and on the phone the finger point
 * under it) is on the free map, clear of the interface, the tutorial bubble and the toasts.
 */
async function assertStepInView(page, step) {
  await page.waitForFunction(() => window.game.pan === null, null, { timeout: 5000 }).catch(() => {});
  const r = await page.evaluate(() => {
    const g = window.game;
    const at = g.stepSpot(g.guide.step.id);
    if (!at) return null;
    const p = g.cellScreen(at.x, at.y, at.w, at.h);
    const touch = navigator.maxTouchPoints > 0;
    const pts = [[p.x, p.y], ...(touch && at.w * at.h <= 9 ? [[p.x, p.y + 90]] : [])];
    const toastTop = g.ui.view.toasts.top ?? Infinity;
    return { p: [Math.round(p.x), Math.round(p.y)], bad: pts.filter(([x, y]) => g.ui.isOverUi(x, y) || y >= toastTop || y < 0 || x < 0 || x > 1280) };
  });
  assert(r && r.bad.length === 0, `the ${step} place is on the free map after the camera glides (${JSON.stringify(r)})`);
}

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

/**
 * Presses a building in the build column: the first press opens its category (the column shows the
 * 4 categories), the second picks it from the strip. Returns the tool picked.
 */
async function pressBuild(page, kind) {
  for (let k = 0; k < 2; k++) {
    await press(page, ...(await uiPoint(page, `build-${kind}`)));
    if (await page.evaluate((t) => window.game.tool === t, kind)) break;
  }
  return page.evaluate(() => window.game.tool);
}

/** Centers the camera on a building's footprint at a zoom. */
const centerOnBuilding = (page, b, zoom = 1.2) =>
  page.evaluate(([b, zoom]) => {
    const cam = window.game.cameras.main;
    const w = window.iso.gridToWorld(b.x + b.w / 2, b.y + b.h / 2);
    cam.setZoom(zoom);
    cam.centerOn(w.x, w.y);
  }, [b, zoom]);

/** Text lines of the tapped building's balloon. */
const inspectorLines = (page) => page.evaluate(() => window.game.ui.view.inspector.card?.lines.map((l) => l.text) ?? []);

/**
 * Pacote 2 interface: a mud-brick house balloon with the locked market (lock on the map, "libera no
 * objetivo 3" in the balloon), toasts held while that balloon is open (a stale one is dropped), Demolir
 * aimed at a full granary ("Perde N de comida"), and the Moradia strip with Praça and Parque.
 */
async function p2Interface(page, suffix) {
  await startGame(page);
  await page.waitForFunction(() => window.game.ui.view.toasts.list.length === 0, null, { timeout: 90000 }); // the opening sentence goes away
  const house = await page.evaluate(() => {
    const { state: s, core, game } = window;
    game.setSpeed(0);
    s.silver = 1e4;
    const at = core.campPlazaSpot();
    const r = core.place(s, 'plaza', at.x, at.y);
    if (!r.ok) throw new Error(`plaza: ${r.reason}`);
    for (const b of s.buildings.filter((b) => b.kind === 'house' && b.level >= 1 && core.needMet(s, b, 'plaza'))) b.level = 2;
    core.refreshCity(s);
    game.refresh();
    const h = s.buildings.find((b) => b.kind === 'house' && b.level === 2);
    return { x: h.x, y: h.y, w: h.w, h: h.h };
  });
  await centerOnBuilding(page, house);
  await page.waitForTimeout(300);
  const balloon = await page.evaluate(([x, y]) => {
    const { state: s, game } = window;
    const b = s.grid[y * s.cols + x];
    const v = game.map.balloons.get(b.id);
    return v ? { need: v.need, lock: v.lock.visible } : null;
  }, [house.x, house.y]);
  assert(balloon?.need === 'market' && balloon.lock, `the mud-brick house balloon shows the market with a lock (${JSON.stringify(balloon)})`);
  await shot(page, `balloon-locked${suffix}`);

  // Tapped: "✗ Mercado (libera no objetivo 3)", and no "Onde pôr" for a locked building.
  await page.evaluate(([x, y]) => {
    window.game.selected = { x, y };
    window.game.refresh();
  }, [house.x, house.y]);
  await page.waitForTimeout(200);
  const lines = await inspectorLines(page);
  const goal = await page.evaluate(() => window.core.unlockingGoal('market'));
  assert(lines.includes(`✗ Mercado (libera no objetivo ${goal})`), `the house balloon says when the market comes (${lines})`);
  assert(await page.evaluate(() => !window.game.ui.view.inspector.card.action), 'no "Onde pôr" action for a locked building');
  await shot(page, `balloon-locked-house${suffix}`);

  // Toasts wait while the balloon is open; one that is no longer true is dropped.
  await page.evaluate(() => {
    window.__valid = true;
    window.game.ui.toast('Teste: aviso com o balão aberto', 'info');
    window.game.ui.toast('Teste: aviso que deixa de valer', 'bad', { valid: () => window.__valid });
  });
  await page.waitForTimeout(300);
  const held = await page.evaluate(() => window.game.ui.view.toasts.list.length);
  assert(held === 0, `no toast over the open balloon (${held})`);
  await shot(page, `toast-inspector${suffix}`);
  await page.evaluate(() => {
    window.__valid = false;
    window.game.deselect();
  });
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => window.game.ui.view.toasts.list.map((t) => t.msg));
  assert(after.length === 1 && after[0] === 'Teste: aviso com o balão aberto', `the toast comes when the balloon closes, the stale one does not (${after})`);
  await shot(page, `toast-inspector-closed${suffix}`);

  // Demolir aimed at a full granary: "Perde N de comida" over it.
  const granary = await page.evaluate(() => {
    const { state: s, core, game } = window;
    s.unlocked.push('granary');
    const to = core.RULES.map.altar;
    const spot = core.placeSpots(s, 'granary').sort((a, b) => Math.abs(a.x - to.x) + Math.abs(a.y - to.y) - (Math.abs(b.x - to.x) + Math.abs(b.y - to.y)))[0];
    core.place(s, 'granary', spot.x, spot.y);
    core.refreshCity(s);
    s.food = core.foodCapacity(s);
    game.refresh();
    const g = s.grid[spot.y * s.cols + spot.x];
    return { x: g.x, y: g.y, w: g.w, h: g.h, lost: core.foodLostIfRemoved(s, g.x, g.y) };
  });
  assert(granary.lost > 0, `demolishing the full granary loses food (${granary.lost})`);
  await centerOnBuilding(page, granary);
  await page.evaluate(([x, y]) => {
    window.game.selectTool('clear');
    window.game.setHover({ x, y });
  }, [granary.x + 1, granary.y + 1]);
  await page.waitForTimeout(300);
  const tag = await page.evaluate(() => window.game.ui.view.tag.visible && window.game.ui.view.tagText.text);
  assert(tag && tag.startsWith('Perde'), `Demolir over the granary says the food lost (${tag})`);
  await shot(page, `demolish-granary${suffix}`);
  await page.evaluate(([x, y]) => {
    window.game.setHover(null);
    window.game.selectTool('view');
    window.game.selected = { x, y };
    window.game.refresh();
  }, [granary.x, granary.y]);
  await page.waitForTimeout(200);
  const glines = await inspectorLines(page);
  assert(glines.some((l) => l.includes('Perde')), `the granary balloon says the food Demolir would lose (${glines})`);
  await shot(page, `demolish-granary-balloon${suffix}`);
  await page.evaluate(() => window.game.deselect());

  // The Moradia strip: Casa, Praça and Parque; the plaza chosen with its balloon.
  await page.evaluate(() => {
    window.state.unlocked.push('park');
    window.game.ui.unlocked('park');
    window.game.refresh();
  });
  await page.evaluate(() => window.game.ui.openCategory('home'));
  await page.waitForTimeout(200);
  const strip = await page.evaluate(() => window.game.ui.view.column.strip?.items.map((i) => i.kind) ?? null);
  assert(!strip || (strip.includes('plaza') && strip.includes('park')), `Moradia has the plaza and the park (${strip})`);
  await shot(page, `column-home${suffix}`);
  await page.evaluate(() => window.game.ui.view.column.closeStrip());
  assert((await pressBuild(page, 'park')) === 'park', 'the column picks the park');
  await shot(page, `column-park${suffix}`);
}

/**
 * P2 fixes: choosing the Temple shows where it fits (green: ready, yellow: a road is missing), its
 * preview says "+10 de Alegria em N casas", and any building that fits away from the road previews in
 * yellow with "Cabe aqui: falta ligar à rua".
 */
async function templeAreas(page, suffix) {
  await startGame(page);
  await page.waitForFunction(() => window.game.ui.view.toasts.list.length === 0, null, { timeout: 90000 }); // the opening sentence goes away
  const areas = await page.evaluate(() => {
    const { state: s, core, game } = window;
    game.setSpeed(0);
    s.silver = 1e4;
    s.unlocked.push('temple');
    // A grown city: the land along the roads near the altar is taken (here by plots in the middle of
    // the nearest ready areas), so some of the nearest areas need a road.
    game.selectTool('temple');
    for (let k = 0; k < 40 && !game.templeAreas.some((a) => !a.ready); k++) {
      const a = game.templeAreas.find((o) => o.ready);
      if (!a || !core.place(s, 'house', a.x + 2, a.y + 2).ok) break;
      game.refresh();
    }
    return game.templeAreas.map((a) => ({ ...a }));
  });
  const apart = areas.every((a, i) => areas.every((b, j) => i === j || Math.abs(a.x - b.x) >= 6 || Math.abs(a.y - b.y) >= 6));
  assert(areas.length > 0 && areas.length <= 6 && apart, `at most 6 temple areas that do not overlap (${JSON.stringify(areas)})`);
  assert(areas.some((a) => a.ready) && areas.some((a) => !a.ready), `green and yellow temple areas (${JSON.stringify(areas)})`);
  const yellow = areas.find((a) => !a.ready);
  await centerOnBuilding(page, { ...yellow, w: 6, h: 6 }, 0.8);
  await page.waitForTimeout(300);
  await shot(page, `temple-areas${suffix}`);

  // The preview over a yellow area: yellow, with the Alegria it gives and "falta ligar à rua".
  await page.evaluate(([x, y]) => window.game.setHover({ x, y }), [yellow.x + 2, yellow.y + 2]);
  await page.waitForTimeout(200);
  const label = await page.evaluate(() => window.game.map.serves.visible && window.game.map.serves.text);
  assert(label && /^\+10 de Alegria em \d+ casas?\nCabe aqui: falta ligar à rua$/.test(label), `the temple preview says its Alegria and the missing road (${label})`);
  await shot(page, `temple-preview-yellow${suffix}`);

  // Any building: a house away from the road previews yellow with "Cabe aqui: falta ligar à rua".
  const far = await page.evaluate(() => {
    const { state: s, core, game } = window;
    game.selectTool('house');
    for (let y = 2; y < s.rows - 2; y++)
      for (let x = 2; x < s.cols - 2; x++) if (core.onlyNeedsRoad(s, 'house', x, y)) return { x, y };
    return null;
  });
  assert(far, 'a free house spot away from the road');
  await centerOnBuilding(page, { ...far, w: 2, h: 2 });
  await page.evaluate(([x, y]) => window.game.setHover({ x, y }), [far.x, far.y]);
  await page.waitForTimeout(200);
  const houseLabel = await page.evaluate(() => window.game.map.serves.visible && window.game.map.serves.text);
  assert(houseLabel === 'Cabe aqui: falta ligar à rua', `the house preview away from the road (${houseLabel})`);
  await shot(page, `preview-needs-road${suffix}`);

  // No silver: the preview over a green area is red and says why.
  const green = areas.find((a) => a.ready);
  await page.evaluate(() => {
    window.state.silver = 100;
    window.game.selectTool('temple');
  });
  await page.evaluate(([x, y]) => window.game.setHover({ x, y }), [green.x + 2, green.y + 2]);
  await page.waitForTimeout(200);
  const poorLabel = await page.evaluate(() => window.game.map.serves.visible && window.game.map.serves.text);
  assert(poorLabel && /\nFalta prata: custa 800$/.test(poorLabel), `the temple preview without silver says so (${poorLabel})`);

  // No area near the roads (rocks block the land one and two cells from the network, but for one
  // path): the nearest free place is marked with the road to it, and the camera goes there.
  const remote = await page.evaluate(() => {
    const { state: s, core, game } = window;
    s.silver = 1e4;
    game.selectTool('view');
    const { dist, prev } = core.roadDistances(s);
    const free = (x, y) => x >= 0 && y >= 0 && x + 6 <= s.cols && y + 6 <= s.rows && [...Array(36).keys()].every((k) => core.isFreeLand(s, x + (k % 6), y + Math.floor(k / 6)) && dist[core.indexOf(s, x + (k % 6), y + Math.floor(k / 6))] >= 3);
    let end = -1;
    for (let y = 0; y < s.rows && end < 0; y++)
      for (let x = 0; x < s.cols && end < 0; x++) {
        if (!free(x, y)) continue;
        for (const c of core.borderCells(s, { x, y, w: 6, h: 6 })) {
          if (!core.inBounds(s, c.x, c.y)) continue;
          const i = core.indexOf(s, c.x, c.y);
          if (dist[i] === 3) { end = i; break; }
        }
      }
    if (end < 0) return null;
    const keep = new Set();
    for (let i = end; i >= 0 && dist[i] > 0; i = prev[i]) keep.add(i);
    dist.forEach((d, i) => { if ((d === 1 || d === 2) && !keep.has(i)) s.feature[i] = 'rock'; });
    game.refresh();
    if (core.templeSpotsNear(s).length) return null;
    const cam = game.cameras.main;
    const before = { x: cam.scrollX, y: cam.scrollY };
    game.selectTool('temple');
    return { areas: game.templeAreas.map((a) => ({ ...a })), road: game.map.templeRoad.length, before };
  });
  assert(remote && remote.areas.length === 1 && !remote.areas[0].ready && remote.road > 0, `with no area near the roads, the nearest place and its road (${JSON.stringify(remote)})`);
  await page.waitForTimeout(1500);
  const moved = await page.evaluate((b) => { const c = window.game.cameras.main; return Math.hypot(c.scrollX - b.x, c.scrollY - b.y); }, remote.before);
  assert(moved > 20, `the camera goes to the temple area (${moved})`);
  await shot(page, `temple-far-road${suffix}`);
}

/**
 * Demolir on a full granary: on the phone the touch opens the balloon ("Perde N de comida" and its own
 * Demolir), it never demolishes at once; with the mouse a click still demolishes.
 */
async function demolishLoss(page, suffix) {
  await startGame(page);
  await page.waitForFunction(() => window.game.ui.view.toasts.list.length === 0, null, { timeout: 90000 });
  const granary = await page.evaluate(() => {
    const { state: s, core, game } = window;
    game.setSpeed(0);
    s.silver = 1e4;
    s.unlocked.push('granary');
    const to = core.RULES.map.altar;
    const spot = core.placeSpots(s, 'granary').sort((a, b) => Math.abs(a.x - to.x) + Math.abs(a.y - to.y) - (Math.abs(b.x - to.x) + Math.abs(b.y - to.y)))[0];
    core.place(s, 'granary', spot.x, spot.y);
    s.food = core.foodCapacity(s);
    game.refresh();
    const g = s.grid[spot.y * s.cols + spot.x];
    return { id: g.id, x: g.x, y: g.y, w: g.w, h: g.h };
  });
  await centerOnBuilding(page, granary);
  await page.evaluate(() => window.game.selectTool('clear'));
  await page.waitForTimeout(200);
  const at = await cellToScreen(page, granary.x + 1, granary.y + 1);
  await press(page, ...at);
  await page.waitForTimeout(300);
  const after = await page.evaluate((id) => ({ standing: window.state.buildings.some((b) => b.id === id), lines: window.game.ui.view.inspector.card?.lines.map((l) => l.text) ?? [] }), granary.id);
  if (suffix === '-pc') {
    assert(!after.standing, 'with the mouse, Demolir removes the granary at once');
  } else {
    assert(after.standing, 'on the phone, Demolir does not remove a granary that would spoil food');
    assert(after.lines.some((l) => l.includes('Perde')), `the granary balloon opens with the food lost (${after.lines})`);
  }
  await shot(page, `demolish-loss${suffix}`);
}

/** Plays the whole tutorial as a new player would, with a screenshot of each step. */
async function playTutorial(page, suffix) {
  await startGame(page, { tutorial: true });
  const shotStep = (name) => shot(page, `tutorial-${name}${suffix}`);
  await page.evaluate(() => window.game.setSpeed(0));
  await page.waitForTimeout(300);
  await shot(page, `tutorial-caravan${suffix}`); // the opening sentence over the start
  const caravan = await page.evaluate(() => window.game.ui.view.toasts.list.map((t) => t.msg));
  assert(caravan.some((m) => m.startsWith('A caravana chegou com')), `the caravan sentence opens the game (${caravan})`);

  // 1. Road to the best food spot, along the marked road. The clock stands still on build steps.
  assert((await tutorialStep(page)) === 'road', 'the tutorial starts with the road to the food');
  await page.evaluate(() => window.game.setSpeed(3));
  const week0 = await page.evaluate(() => window.state.week);
  await page.waitForTimeout(1500);
  assert((await page.evaluate(() => window.state.week)) === week0, 'the clock stands still on a build step');
  await page.evaluate(() => window.game.setSpeed(0));
  await assertStepInView(page, 'road');
  const ghostClear = await page.evaluate(() => {
    const g = window.game;
    const top = g.ui.view.toasts.top ?? Infinity;
    return g.ghost.filter((c) => {
      const p = g.cellScreen(c.x, c.y, 1, 1);
      return g.ui.isOverUi(p.x, p.y) || p.y >= top;
    });
  });
  assert(ghostClear.length === 0, `the caravan toast and the interface leave the marked road clear (${JSON.stringify(ghostClear)})`);
  await shotStep('step-1');
  await tool(page, 2);
  assert(await page.evaluate(() => window.game.tool === 'road'), 'the Rua key picks the road');
  await page.evaluate(() => window.game.selectTool('view'));
  assert((await pressBuild(page, 'plaza')) === 'plaza', 'tools never lock: the plaza can be picked on the road step');
  await page.evaluate(() => window.game.selectTool('view'));
  await press(page, ...(await uiPoint(page, 'tool-road')));
  assert(await page.evaluate(() => window.game.tool === 'road'), 'the Rua button picks the road');
  const ghost = await page.evaluate(() => window.game.ghost.map((c) => [c.x, c.y]));
  assert(ghost.length >= 2, `a marked road (${ghost.length})`);
  await dragCells(page, ghost);
  const built = await page.evaluate((g) => g.map(([x, y]) => window.state.roads[window.core.indexOf(window.state, x, y)] ? 1 : 0).join(''), ghost);
  assert((await tutorialStep(page)) === 'gather', `dragging the marked road ends step 1 (${JSON.stringify(ghost)} built ${built}, silver ${await page.evaluate(() => window.state.silver)})`);

  // 2. Fisher or gatherer at the end of the road: the preview says what it yields.
  await assertStepInView(page, 'gather');
  await shotStep('step-2');
  const spot = await page.evaluate(() => window.game.spot);
  assert(spot && spot.food >= 1.2, `the road leads to a spot that brings food (${JSON.stringify(spot)})`);
  assert((await pressBuild(page, spot.kind)) === spot.kind, `the column picks the ${spot.kind}`);
  await page.evaluate(([x, y]) => window.game.setHover({ x, y }), [spot.x, spot.y]);
  await page.waitForTimeout(200);
  const yields = await page.evaluate(() => window.game.ui.view.tag.visible && window.game.ui.view.tagText.text);
  assert(yields && yields.startsWith('Rende'), `the preview says what it yields (${yields})`);
  await shotStep('step-2-preview');
  const placed = await page.evaluate(([k, x, y]) => {
    const r = window.core.place(window.state, k, x, y);
    window.game.refresh();
    return r.ok ? 'ok' : r.reason;
  }, [spot.kind, spot.x, spot.y]);
  assert((await tutorialStep(page)) === 'field', `a fisher or gatherer ends step 2 (place: ${placed}, step ${await tutorialStep(page)})`);

  // 3. Field: the camera brings the free field spot nearest the altar into view.
  await assertStepInView(page, 'field');
  await pressBuild(page, 'field');
  await shotStep('step-3');
  await placeNear(page, 'field');
  assert((await tutorialStep(page)) === 'plaza', 'a field ends step 3');

  // 4. Plaza near the caravan tents: the preview says how many houses it serves.
  await assertStepInView(page, 'plaza');
  assert((await pressBuild(page, 'plaza')) === 'plaza', 'the column picks the plaza (category, then the building)');
  // The arrow's spot (campPlazaSpot) is free and reaches the caravan tents.
  const plazaAt = await page.evaluate(() => {
    const { state: s, core } = window;
    const at = core.campPlazaSpot();
    return { ...at, ok: core.checkPlace(s, 'plaza', at.x, at.y).ok, serves: core.servedHouses(s, 'plaza', at.x, at.y).length };
  });
  assert(plazaAt.ok && plazaAt.serves > 0, `the tutorial plaza spot is free and serves the tents (${JSON.stringify(plazaAt)})`);
  await page.evaluate(([x, y]) => window.game.setHover({ x, y }), [plazaAt.x, plazaAt.y]);
  await page.waitForTimeout(200);
  const serves = await page.evaluate(() => window.game.map.serves.visible && window.game.map.serves.text);
  assert(serves && serves.startsWith('Atende'), `the plaza preview says how many houses it serves (${serves})`);
  await shotStep('plaza');
  await page.evaluate(([x, y]) => {
    window.core.place(window.state, 'plaza', x, y);
    window.game.refresh();
  }, [plazaAt.x, plazaAt.y]);
  assert((await tutorialStep(page)) === 'house', 'a plaza ends step 4');

  // 5. House next to the road, near the plaza.
  await pressBuild(page, 'house');
  await page.waitForTimeout(200);
  const hintNear = await page.evaluate(() => {
    const { state: s, game } = window;
    const h = game.houseHint;
    return !!h && [0, 1].some((dx) => [0, 1].some((dy) => s.coverage.plaza[(h.y + dy) * s.cols + h.x + dx]));
  });
  assert(hintNear, 'the arrow points at a house spot near the plaza');
  await shotStep('step-5');
  await placeNear(page, 'house');
  assert((await tutorialStep(page)) === 'wedding', 'a house ends step 5');

  // 6. The wedding step: the opening couple walks to the new house and marries there, or the step
  // ends by itself after weddingStepMaxWeeks weeks (no help from the test).
  const wedStart = await page.evaluate(() => window.state.week);
  await page.evaluate(() => window.game.setSpeed(3));
  await page.waitForTimeout(700);
  await shotStep('step-6');
  await page.waitForFunction(() => window.game.guide?.step === null, null, { timeout: 90000 });
  const wed = await page.evaluate((w) => ({ weeks: window.state.week - w, wedding: window.state.milestones.includes('firstWedding') }), wedStart);
  assert(wed.weeks <= TUTORIAL.weddingStepMaxWeeks + 1, `the wedding step ends within weddingStepMaxWeeks (${JSON.stringify(wed)})`);
  assert(wed.wedding, `the opening couple married in the new house (${JSON.stringify(wed)})`);
  assert(await page.evaluate(() => !window.game.guide.running), 'the main steps end after step 6');
  const end = await page.evaluate(() => [...window.game.ui.view.toasts.list, ...window.game.ui.view.toasts.queue].map((t) => t.msg));
  assert(end.some((m) => m.includes('Casais novos precisam de casa')), `the last tutorial toast says couples need houses (${end})`);

  // The goal that unlocks the market brings its short step.
  await page.evaluate(() => {
    window.game.setSpeed(0);
    window.state.unlocked.push('market');
    window.game.guide.marketUnlocked();
    window.game.refresh();
  });
  assert((await tutorialStep(page)) === 'market', 'unlocking the market starts its step');
  await shotStep('market');
  await page.evaluate(() => (window.state.silver = 500));
  await placeNear(page, 'market');
  assert((await tutorialStep(page)) === null, 'a market ends the tutorial');
  assert(await page.evaluate(() => localStorage.getItem('jerusalem.tutorialDone') === '1'), 'the tutorial is remembered as done');
}

/** The wedding step never traps the player: with no free house the clock runs and the step ends by itself. */
async function tutorialBlocked(page) {
  await startGame(page, { tutorial: true });
  await page.evaluate(() => {
    window.game.setSpeed(0);
    // Jump to the wedding step with no free house for the couple.
    const g = window.game.guide;
    while (g.step && g.step.id !== 'wedding') g.k++;
    window.game.refresh();
  });
  const why = await page.evaluate(() => [window.game.guide.step?.id, window.game.guide.holdsClock]);
  assert(why[0] === 'wedding' && why[1] === false, `the wedding step lets the clock run (${JSON.stringify(why)})`);
  await shot(page, 'tutorial-wedding-waiting');
  const week = await page.evaluate(() => window.state.week);
  await page.evaluate(() => window.game.setSpeed(3));
  await page.waitForFunction(() => window.game.guide?.step === null, null, { timeout: 90000 });
  const end = await page.evaluate((w) => ({ weeks: window.state.week - w, wedding: window.state.milestones.includes('firstWedding'), toasts: [...window.game.ui.view.toasts.list, ...window.game.ui.view.toasts.queue].map((t) => t.msg) }), week);
  assert(!end.wedding && end.weeks >= TUTORIAL.weddingStepMaxWeeks && end.weeks <= TUTORIAL.weddingStepMaxWeeks + 1, `the wedding step with no house ends after ${TUTORIAL.weddingStepMaxWeeks} weeks (${JSON.stringify(end)})`);
  assert(end.toasts.some((m) => m.includes('Casais novos precisam de casa')), `the usual last tutorial toast (${end.toasts})`);
  await page.evaluate(() => window.game.setSpeed(0));
  await shot(page, 'tutorial-wedding-timeout');
}

/**
 * A road drag (finger on the phone, mouse on the PC) from a map cell that ends over a button: the
 * button must not fire, because the press did not start on it.
 */
async function dragOntoButton(page, from, [bx, by]) {
  const start = await cellToScreen(page, ...from);
  const mid = [(start[0] + bx) / 2, (start[1] + by) / 2];
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) {
    const { touch } = await touchInput(page);
    await touch('touchStart', [start]);
    await page.waitForTimeout(220);
    for (const p of [mid, [bx, by]]) {
      await touch('touchMove', [p]);
      await page.waitForTimeout(60);
    }
    await touch('touchEnd', []);
  } else {
    await page.mouse.move(...(await gameToPage(page, ...start)));
    await page.mouse.down();
    await page.mouse.move(...(await gameToPage(page, ...mid)), { steps: 5 });
    await page.mouse.move(...(await gameToPage(page, bx, by)), { steps: 5 });
    await page.mouse.up();
  }
  await page.waitForTimeout(250);
}

/** Releasing a road drag over "Pular tutorial" or the pause skips nothing and pauses nothing. */
async function dragReleaseOnButton(page, suffix) {
  await startGame(page, { tutorial: true });
  await page.evaluate(() => window.game.setSpeed(1));
  await press(page, ...(await uiPoint(page, 'tool-road')));
  assert(await page.evaluate(() => window.game.tool === 'road'), 'the road is picked');
  const skip = await page.evaluate(() => {
    const m = window.game.ui.view.tutorial.skipBtn.root.getWorldTransformMatrix();
    return [m.tx, m.ty];
  });
  const from = await page.evaluate(() => window.game.ghost[0]);
  await dragOntoButton(page, [from.x, from.y], skip);
  assert(await page.evaluate(() => window.game.guide !== null), 'a drag released on "Pular tutorial" does not skip it');
  const pause = await page.evaluate(() => window.layout.novaPoint('speed-0') ?? window.layout.novaPoint('speed-1'));
  assert(pause, 'the speed button is on screen');
  await dragOntoButton(page, [from.x, from.y], [pause.x, pause.y]);
  assert(await page.evaluate(() => window.game.speed === 1), 'a drag released on the speed button does not change it');
  await shot(page, `drag-release-on-button${suffix}`);
}

/** "Comida depois" on the preview of a food building and in the balloon of a workplace that takes workers. */
async function previewFoodAfter(page, suffix) {
  await startGame(page);
  await page.evaluate(() => {
    window.game.setSpeed(0);
    window.state.silver = 1e4;
  });
  const spot = await page.evaluate(() => window.core.foodSpot(window.state));
  await page.evaluate((road) => {
    for (const c of road) window.core.place(window.state, 'road', c.x, c.y);
    window.game.refresh();
  }, spot.road);
  await pick(page, spot.kind);
  await page.evaluate(([x, y]) => window.game.setHover({ x, y }), [spot.x, spot.y]);
  await page.waitForTimeout(250);
  const tag = await page.evaluate(() => window.game.ui.view.tag.visible && window.game.ui.view.tagText.text);
  assert(tag && tag.startsWith('Rende') && tag.includes('Comida depois'), `the preview says what it yields and the food after (${tag})`);
  await shot(page, `preview-food-after${suffix}`);
  // A market with 1 worker for many jobs: the balloon warns about the food it costs.
  await page.evaluate(() => {
    window.state.unlocked.push('market');
    window.game.setHover(null);
  });
  await page.evaluate((s) => {
    const st = window.state;
    window.core.place(st, s.kind, s.x, s.y);
    // Workshops until the jobs reach the workers: the market's 3 jobs then take workers from the food.
    st.unlocked.push('workshop');
    const eco = () => window.core.computeEconomy(st);
    while (eco().jobs < eco().workers) {
      const at = window.core.placeSpots(st, 'workshop')[0];
      if (!at || !window.core.place(st, 'workshop', at.x, at.y).ok) break;
    }
    window.game.refresh();
  }, spot);
  await pick(page, 'market');
  await page.waitForTimeout(250);
  const lines = await page.evaluate(() => JSON.parse(window.game.ui.view.column.balloon.key || '[]').map((l) => l.text));
  await shot(page, `preview-food-after-market${suffix}`);
  return lines;
}

/** The season pill counts down to the winter (and to the spring in winter); the food pill says FOME in a famine. */
async function harvestCountdown(page, suffix) {
  await startGame(page);
  await page.evaluate(() => window.game.setSpeed(0));
  await page.waitForTimeout(200);
  const pill = () => page.evaluate(() => window.game.ui.view.top.season.texts.filter((t) => t.visible).map((t) => t.text).join(' '));
  const autumn = await pill();
  assert(autumn.includes('inverno em'), `autumn counts down to the winter (${autumn})`);
  await shot(page, `harvest-countdown-autumn${suffix}`);
  await page.evaluate(() => {
    const s = window.state;
    s.week = window.core.RULES.weeksPerSeason + 4; // winter
    s.food = 0;
    s.famine = true;
    window.game.refresh();
  });
  await page.waitForTimeout(200);
  const winter = await pill();
  assert(winter.includes('primavera em'), `winter counts down to the spring (${winter})`);
  const food = await page.evaluate(() => window.game.ui.view.top.food.texts.filter((t) => t.visible).map((t) => t.text).join(' '));
  assert(food.includes('FOME'), `the food pill says FOME in a famine (${food})`);
  const fit = await page.evaluate(() => {
    const p = window.game.ui.view.top.season;
    return { right: p.root.x + p.w, width: window.game.ui.cameras.main.width };
  });
  assert(fit.right <= fit.width, `the season pill fits the screen (${JSON.stringify(fit)})`);
  await shot(page, `harvest-countdown-winter${suffix}`);
}

// ---------- scenarios ----------

const scenarios = {
  async title(page) {
    await page.goto(URL, { timeout: 90000 });
    await page.waitForTimeout(1200);
    await shot(page, 'title');
    // Once the tutorial was seen, the title offers it again.
    await page.evaluate(() => localStorage.setItem('jerusalem.tutorialDone', '1'));
    await page.reload();
    await page.waitForTimeout(1200);
    await shot(page, 'title-again');
    // When the browser offers to install the app, the title shows its own button, which opens the prompt.
    await page.evaluate(() => {
      const e = new Event('beforeinstallprompt');
      e.prompt = () => {
        window.__installPrompted = true;
        return Promise.resolve();
      };
      e.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(e);
    });
    await page.waitForTimeout(300);
    await shot(page, 'title-install');
    const btn = await page.evaluate(() => {
      const r = document.querySelector('canvas').getBoundingClientRect();
      const k = r.width / 1280; // no game scene yet: map from the canvas size
      return [r.left + (1280 - 130) * k, r.top + 50 * k];
    });
    await page.mouse.click(...btn);
    await page.waitForTimeout(200);
    assert(await page.evaluate(() => window.__installPrompted === true), 'the Instalar app button opens the install prompt');
  },

  /** First game on a phone: the six tutorial steps, then the market. */
  tutorial: { context: PHONE, run: (page) => playTutorial(page, '') },
  'tutorial-pc': { context: PC, run: (page) => playTutorial(page, '-pc') },
  /** The wedding step with no free house: the clock runs and the step ends by itself (never stuck). */
  'tutorial-blocked': { context: PC, run: tutorialBlocked },
  /** "Comida depois" on the food preview, and on the balloon of a workplace that takes workers. */
  'preview-food-after': { context: PHONE, run: (page) => previewFoodAfter(page, '') },
  'preview-food-after-pc': {
    context: PC,
    async run(page) {
      const lines = await previewFoodAfter(page, '-pc');
      assert(lines.some((l) => l.startsWith('Comida depois')), `the market balloon says the food after (${lines})`);
    },
  },
  /** Countdown to the winter and the spring on the season pill; FOME on the food pill. */
  'harvest-countdown': { context: PHONE, run: (page) => harvestCountdown(page, '') },
  'harvest-countdown-pc': { context: PC, run: (page) => harvestCountdown(page, '-pc') },
  /** A toast that comes while a panel is open waits until the panel closes. */
  async 'toast-panel'(page) {
    await startGame(page);
    await page.waitForFunction(() => window.game.ui.view.toasts.list.length === 0, null, { timeout: 90000 }); // the opening sentence goes away
    await clickUi(page, 'side-stats');
    await page.waitForTimeout(200);
    assert(await page.evaluate(() => window.game.ui.view.panels.open === 'stats'), 'the statistics are open');
    await page.evaluate(() => window.game.ui.toast('Teste: um aviso chegando', 'info'));
    await page.waitForTimeout(300);
    const over = await page.evaluate(() => window.game.ui.view.toasts.list.map((t) => t.msg));
    assert(over.length === 0, `no toast over the open panel (${over})`);
    await shot(page, 'toast-panel-open');
    await clickUi(page, 'side-stats');
    await page.waitForTimeout(400);
    assert((await page.evaluate(() => window.game.ui.view.toasts.list.length)) === 1, 'the toast comes when the panel closes');
    await shot(page, 'toast-panel-closed');
  },
  /** Pacote 2: lock on the house balloon, toasts held by the tapped balloon, Demolir on a granary, Praça and Parque. */
  'p2-ui': { context: PHONE, run: (page) => p2Interface(page, '') },
  'p2-ui-pc': { context: PC, run: (page) => p2Interface(page, '-pc') },
  /** P2 fixes: temple areas (green and yellow), the yellow preview, Demolir with a food loss (phone and PC). */
  'temple-areas': { context: PHONE, run: (page) => templeAreas(page, '') },
  'temple-areas-pc': { context: PC, run: (page) => templeAreas(page, '-pc') },
  'demolish-loss': { context: PHONE, run: (page) => demolishLoss(page, '') },
  'demolish-loss-pc': { context: PC, run: (page) => demolishLoss(page, '-pc') },
  /** A drag that ends over a button does not press it (phone and PC). */
  'drag-release-on-button': { context: PHONE, run: (page) => dragReleaseOnButton(page, '') },
  'drag-release-on-button-pc': { context: PC, run: (page) => dragReleaseOnButton(page, '-pc') },

  /** Skipping ends the tutorial for good; with the storage blocked the game still runs. */
  async 'tutorial-skip'(page) {
    await startGame(page, { tutorial: true });
    assert(await page.evaluate(() => window.game.guide?.step?.id === 'road'), 'a first game starts the tutorial');
    await clickTutorial(page, 'skipBtn');
    assert(await page.evaluate(() => window.game.guide === null), 'Pular tutorial ends it');
    assert(await page.evaluate(() => localStorage.getItem('jerusalem.tutorialDone') === '1'), 'skipping is remembered');
    await tool(page, 2); // Rua is free again
    assert(await page.evaluate(() => window.game.tool === 'road'), 'every unlocked tool is free after skipping');

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

  /** A tap on the settings panel (title or edges) never reaches the map or the tools. */
  async options(page) {
    await startGame(page);
    await clickUi(page, 'gear');
    await page.waitForTimeout(150);
    assert(await page.evaluate(() => window.game.ui.view.panels.open === 'settings'), 'the gear opens the settings');
    const t0 = await page.evaluate(() => window.game.tool);
    const [x, y] = await page.evaluate(() => {
      const r = window.game.ui.view.panels.rect;
      return [r.x + r.w / 2, r.y + 12];
    });
    await page.mouse.click(...(await gameToPage(page, x, y)));
    await page.waitForTimeout(150);
    assert(await page.evaluate((t) => window.game.tool === t && !window.game.selected, t0), 'tapping the panel title changes nothing on the map');
    assert(await page.evaluate(() => window.game.ui.view.panels.open === 'settings'), 'and the panel stays open');
    await shot(page, 'options');
  },

  async 'build-with-mouse'(page) {
    await startGame(page);
    const before = await stats(page);
    assert(before.roads > 0, `the city starts with roads (${before.roads})`);
    assert(before.buildings.filter((k) => k !== 'house').join() === 'altar', `only the altar and the caravan tents at start (${before.buildings})`);
    await page.evaluate(() => (window.state.silver = 1e4));

    await tool(page, 2); // Rua
    await mouseDrag(page, [[27, 24], [32, 24]]);
    await tool(page, 3); // Moradia: Casa first, 2x2, so dragging 6 cells places 3 houses
    assert(await page.evaluate(() => window.game.tool === 'house'), 'key 3 picks the house');
    await mouseDrag(page, [[27, 25], [32, 25]]);
    // The same key again: the next one of Moradia, Praça (called directly: a key press is sometimes lost or doubled under software rendering).
    await page.evaluate(() => window.game.pickCategory('home'));
    const again = await page.evaluate(() => window.game.tool);
    assert(again === 'plaza', `key 3 again picks the plaza (${again})`);
    await mouseClick(page, 22, 32);
    await tool(page, 4); // Comida: Campo first
    assert(await page.evaluate(() => window.game.tool === 'field'), 'key 4 picks the field');
    await mouseClick(page, 22, 29);
    await page.mouse.move(...(await cellToPage(page, 27, 30)));
    await page.waitForTimeout(300);
    await shot(page, 'build-with-mouse');

    const after = await stats(page);
    assert(after.roads === before.roads + 6, `dragged road adds 6 cells (got ${after.roads - before.roads})`);
    assert(after.houses.length === before.houses.length + 3, `dragged 3 houses (got ${after.houses.length - before.houses.length})`);
    assert(after.buildings.includes('field') && after.buildings.includes('plaza'), 'field and plaza placed');
  },

  async 'families-arrive'(page) {
    await startGame(page);
    await page.evaluate(() => (window.state.silver = 1e4));
    await tool(page, 3); // Casa
    await mouseDrag(page, [[22, 28], [22, 36]]);
    await setSpeed(page, 3);
    await tool(page, 1);
    // The opening couple walks to one of the new houses and marries there.
    await page.waitForFunction(() => window.state.families.length > 0, null, { timeout: 20000 });
    await page.waitForTimeout(400);
    await shot(page, 'families-walking');
    await page.waitForFunction(() => window.state.milestones.includes('firstWedding'), null, { timeout: 30000 });
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
      for (const [name, t, phase] of phases) {
        await page.evaluate((t) => window.game.dayNight.setTime(t), t);
        await page.waitForTimeout(400);
        const got = await page.evaluate(() => window.game.dayNight.current.phase);
        assert(phase !== 'moon' || got === 'night', `${name}: night at ${t} (got ${got})`);
        await shot(page, `day-night-${name}`);
      }
      const night = await page.evaluate(() => window.game.dayNight.current);
      assert(night.night === 1 && Math.abs(night.walkers - 0.5) < 1e-9, `half the walkers at night (${night.walkers})`);
      assert(await page.evaluate(() => window.game.map.lights.groups.size > 10), 'windows, lamps and fires are lit at night');
      // Turning the cycle off from the settings panel: always day.
      await clickUi(page, 'gear');
      await page.waitForTimeout(200);
      await shot(page, 'day-night-options');
      await clickUi(page, 'setting-dayNight');
      await page.waitForTimeout(300);
      const off = await page.evaluate(() => window.game.dayNight.current);
      assert(off.night === 0 && off.phase !== 'night', `cycle off shows the day (${off.phase})`);
      await shot(page, 'day-night-off');
      await clickUi(page, 'setting-dayNight'); // back on for the next runs (saved in the browser)
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

  /** PC, paused town: every season, late-winter almond bloom, rain light / medium / heavy, snow and drought, with and without the UI. */
  'seasons': { context: PC, run: (page) => seasonsScenario(page, '') },
  /** The same on a landscape phone (844 x 390). */
  'seasons-phone': { context: PHONE, run: (page) => seasonsScenario(page, '-phone') },

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
    await shot(page, 'overlay-house-plaza-area');
  },

  /** Happiness: the face on the plaque, its breakdown, a house's mood, the park's radius and a sad balloon. */
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
    const face = () => page.evaluate(() => window.game.ui.view.top.joy.icon.texture.key);
    const want = await page.evaluate(() => `mood-${window.core.moodOf(window.game.eco.happiness)}`);
    assert((await face()) === want, `the Alegria pill face follows the mood (${await face()}, ${want})`);

    const joy = await page.evaluate(() => {
      const r = window.game.ui.view.top.joy.rect;
      return [r.x + r.w / 2, r.y + r.h / 2];
    });
    await page.mouse.click(...(await gameToPage(page, ...joy)));
    await page.waitForTimeout(150);
    assert(await page.evaluate(() => window.game.ui.view.panels.open === 'stats'), 'tapping the Alegria pill opens the statistics');
    await shot(page, 'happiness-breakdown');
    await page.keyboard.press('Escape');

    // A house next to the park: happy, with its reasons in the info line.
    const mood = await page.evaluate(() => {
      const { state: s, core } = window;
      const b = s.grid[19 * s.cols + 19];
      window.game.select({ x: 19, y: 19 });
      return core.houseInfo(s, b).happiness;
    });
    assert(mood?.parts.some((p) => p.kind === 'park'), `the house beside the park counts it (${JSON.stringify(mood)})`);
    assert(await page.evaluate(() => window.game.ui.view.inspector.open), 'the house balloon shows its mood');
    await shot(page, 'happiness-house');

    // Famine makes every house sad: sad balloons and a red face.
    await page.evaluate(() => {
      window.state.famine = true;
      window.game.refresh();
    });
    await page.waitForTimeout(300);
    assert((await face()) === 'mood-sad', 'famine turns the face sad');
    await shot(page, 'happiness-sad');

    // Picking the park shows its radius.
    await page.evaluate(() => {
      window.state.famine = false;
      window.game.selectTool('park');
    });
    await page.mouse.move(...(await cellToScreen(page, 16, 25)));
    await page.waitForTimeout(300);
    await shot(page, 'overlay-park');
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
      s.unlocked = ['road', 'house', 'field', 'plaza', 'market', 'workshop', 'temple'];
      s.feature = s.feature.map(() => null);
      for (const b of s.buildings.filter((b) => b.kind !== 'altar')) core.clearCell(s, b.x, b.y); // the caravan tents
      for (const c of core.campRoad()) s.roads[c.y * s.cols + c.x] = false; // and their camp road
      core.refreshCity(s);
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
      s.week = 2 * core.RULES.weeksPerSeason; // the first spring: fields only take workers while they harvest
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
      await page.goto(URL, { timeout: 90000 });
      await page.waitForTimeout(1200);
      await shot(page, 'touch-title');
      await page.waitForFunction(() => document.querySelector('canvas'));
      // Começar (title panel 520 tall, button 62 above its bottom, 160 left of center once the tutorial
      // was seen); the game is not running yet, so map by hand.
      const scale = 390 / phoneH;
      await cdpTapPage(page, (844 - GAME_W * scale) / 2 + (640 - 160) * scale, ((phoneH - 520) / 2 + 520 - 62) * scale);
      await gameReady(page);
      await page.waitForTimeout(500);

      await tap(await uiPoint(page, 'tool-road')); // Rua
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

  /** Phone input: the preview above the finger, releasing over the column cancels, nothing under the top bar, gaps between buttons never build. */
  'input-phone': {
    context: PHONE,
    async run(page) {
      await startGame(page);
      const { touch, tap } = await touchInput(page);
      await setupHudCity(page);
      const game = await page.evaluate(() => [window.game.scale.width, window.game.scale.height]);
      assert(game[0] === 1280 && game[1] === 591, `phone game size is 1280 x 591 (got ${game})`);

      await tap(await uiPoint(page, 'build-plaza')); // opens Moradia
      await tap(await uiPoint(page, 'build-plaza')); // Praça in the strip
      assert(await page.evaluate(() => window.game.tool === 'plaza'), 'the column picks the plaza');
      // Hold a finger on the map: the preview sits above it. Sliding onto the column and releasing cancels.
      const count = async () => (await stats(page)).buildings.length;
      const n0 = await count();
      const finger = [700, 470];
      const under = await page.evaluate(([x, y]) => window.game.cellAt(x, y), finger);
      await touch('touchStart', [finger]);
      await touch('touchMove', [[finger[0] + 4, finger[1] + 2]]);
      await page.waitForTimeout(250);
      await shot(page, 'input-phone-preview');
      const hover = await page.evaluate(() => window.game.hover);
      assert(hover && hover.x + hover.y < under.x + under.y, `the preview is aimed above the finger (${JSON.stringify([hover, under])})`);
      await touch('touchMove', [await uiPoint(page, 'column')]);
      await page.waitForTimeout(100);
      await touch('touchEnd', []);
      await page.waitForTimeout(200);
      assert((await count()) === n0, 'releasing a building over the column cancels it');

      // A finger just under the goal pill aims under it: no preview, nothing built.
      const [gx, gy] = await uiPoint(page, 'pill-goal');
      await touch('touchStart', [[gx, gy + 80]]); // aims 90 px higher, at the goal pill
      await page.waitForTimeout(250);
      const hidden = await page.evaluate(() => window.game.hover);
      await touch('touchEnd', []);
      await page.waitForTimeout(200);
      assert(!hidden, 'no preview when the aimed point is under the top bar');
      assert((await count()) === n0, 'nothing is built under the top bar');

      // Demolir, then a tap in the gap between two side buttons: nothing is demolished.
      await tap(await uiPoint(page, 'tool-clear'));
      const [ax, ay] = await uiPoint(page, 'side-alerts');
      const [, sy] = await uiPoint(page, 'side-stats');
      const gap = [ax, (ay + sy) / 2];
      assert(await page.evaluate(([x, y]) => window.game.ui.isOverUi(x, y), gap), 'the gap between side buttons counts as interface');
      await tap(gap);
      assert((await count()) === n0, 'a tap between two buttons demolishes nothing');
      await shot(page, 'input-phone-clear');
      await page.keyboard.press('Escape');
      assert(await page.evaluate(() => window.game.tool === 'view'), 'one Esc goes from Demolir back to Mover');
    },
  },

  /** The smallest phone in landscape (800 x 360): the Nova still fits, with 44 px buttons. */
  'nova-small-phone': { context: { ...PHONE, viewport: { width: 800, height: 360 } }, run: (page) => novaScenario(page, 'small-phone') },

  /** PC input: speed buttons, a drag that starts on a pill builds nothing, the silver opens the statistics. */
  'input-pc': {
    context: PC,
    async run(page) {
      await startGame(page);
      await setupHudCity(page);
      const game = await page.evaluate(() => [window.game.scale.width, window.game.scale.height]);
      assert(game[0] === 1280 && game[1] === 720, `PC game size is 1280 x 720 (got ${game})`);

      await tool(page, 5); // Trabalho: Mercado first
      assert(await page.evaluate(() => window.game.tool === 'market'), 'key 5 picks the market');
      const [mx, my] = await cellToPage(page, 29, 30);
      await page.mouse.move(mx - 30, my);
      await page.mouse.move(mx, my);
      await page.waitForTimeout(250);
      assert(await page.evaluate(() => !!window.game.hover), 'the market preview follows the mouse');
      await shot(page, 'input-pc');

      await clickUi(page, 'speed-3');
      assert(await page.evaluate(() => window.game.speed === 3), 'the 3x button sets the speed');
      await clickUi(page, 'speed-0');
      assert(await page.evaluate(() => window.game.speed === 0), 'the pause button pauses');

      // Dragging a road that starts on a pill builds nothing.
      await tool(page, 2); // Rua
      const r0 = (await stats(page)).roads;
      await page.mouse.move(...(await gameToPage(page, ...(await uiPoint(page, 'pill-food')))));
      await page.mouse.down();
      await page.mouse.move(...(await cellToPage(page, 30, 30)), { steps: 8 });
      await page.mouse.up();
      assert((await stats(page)).roads === r0, 'a drag that starts on a pill builds nothing');

      await tool(page, 1);
      await clickUi(page, 'pill-silver');
      assert(await page.evaluate(() => window.game.ui.view.panels.open === 'stats'), 'clicking the silver opens the statistics');
      await shot(page, 'input-pc-stats');
      await clickUi(page, 'pill-goal');
      assert(await page.evaluate(() => window.game.ui.view.panels.open === 'goals'), 'clicking the goal opens the goals');
      await shot(page, 'input-pc-goals');
    },
  },

  'nova-phone': { context: PHONE, run: (page) => novaScenario(page, 'phone') },
  'nova-phone-wide': { context: { ...PHONE, viewport: { width: 915, height: 412 } }, run: (page) => novaScenario(page, 'phone-wide') },
  'nova-pc': { context: PC, run: (page) => novaScenario(page, 'pc') },

  async clarity(page) {
    await startGame(page);
    await page.evaluate(() => {
      const { state: s, core } = window;
      s.silver = 1e4;
      s.feature = s.feature.map(() => null);
      for (const b of s.buildings.filter((b) => b.kind !== 'altar')) core.clearCell(s, b.x, b.y); // the caravan tents
      core.place(s, 'field', 22, 30); // connected, but nobody lives here yet
      s.week = 2 * core.RULES.weeksPerSeason; // its harvest: now it needs workers
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
      window.roadsBefore = s.roads.filter(Boolean).length;
      core.place(s, 'house', 25, 30);
      core.place(s, 'plaza', 25, 33);
      window.game.cycleSpeed();
      window.game.cycleSpeed(); // pause
      window.game.refresh();
    });
    await page.waitForTimeout(200);
    await shot(page, 'turn-0');
    await clickUi(page, 'gear');
    await page.waitForTimeout(150);
    await clickUi(page, 'setting-turn-right'); // ↻
    await page.waitForTimeout(300);
    assert((await page.evaluate(() => window.iso.getRotation())) === 1, 'the clockwise arrow turns the view');
    await page.keyboard.press('Escape');
    assert((await stats(page)).roads === (await page.evaluate(() => window.roadsBefore)), 'clicking the arrow builds nothing');
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
      for (const b of s.buildings.filter((b) => b.kind !== 'altar')) core.clearCell(s, b.x, b.y); // the caravan tents
      s.unlocked.push('market', 'workshop');
      core.place(s, 'market', 25, 27);
      core.place(s, 'field', 25, 31);
      core.place(s, 'workshop', 30, 34); // off the road: makes nothing but still pays its upkeep
      for (let y = 27; y <= 35; y += 2) {
        core.place(s, 'house', 22, y);
        s.grid[y * s.cols + 22].level = 1;
      }
      s.silver = -5;
      s.debtWeeks = 20;
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

    await tool(page, 1);
    await clickUi(page, 'pill-silver'); // tap the silver: the statistics
    await page.waitForTimeout(200);
    assert(await page.evaluate(() => window.game.ui.view.panels.open === 'stats'), 'the silver opens the statistics');
    await shot(page, 'debt-silver-info');
    await clickUi(page, 'side-alerts');
    await page.waitForTimeout(200);
    await shot(page, 'debt-alerts-panel');
    await page.keyboard.press('Escape');

    await page.evaluate(() => (window.state.debtWeeks = window.core.RULES.debtWeeksToLose - 1));
    await setSpeed(page, 1);
    await page.waitForFunction(() => window.state.lost, null, { timeout: 5000 });
    await page.waitForTimeout(400);
    assert(await page.evaluate(() => window.game.ui.modalOpen), 'the defeat screen is open');
    await shot(page, 'defeat');

    await page.mouse.click(GAME_W / 2, GAME_H / 2 + 80); // Tentar de novo
    await page.waitForFunction(() => window.state && !window.state.lost && window.state.week === 0 && window.state.silver >= 0, null, { timeout: 5000 });
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
    await pick(page, 'temple');
    await page.mouse.click(...(await cellToScreen(page, 27, 34))); // 6x6 centered: top-left (25, 32)
    await page.waitForTimeout(250);
    await shot(page, 'temple-celebration');
    await page.waitForFunction(() => window.state.won, null, { timeout: 15000 });
    await page.waitForTimeout(500);
    await shot(page, 'victory');
  },
};

/** Minimum size (real screen px) of the visible texts of the interface. */
const minUiText = (page) =>
  page.evaluate(() => {
    const k = document.querySelector('canvas').getBoundingClientRect().width / 1280;
    let min = Infinity;
    const walk = (o, sc) => {
      if (!o.visible) return;
      const s2 = sc * (o.scaleY ?? 1);
      if (o.type === 'Text' && o.text.trim()) min = Math.min(min, parseFloat(o.style.fontSize) * s2 * k);
      if (o.list) o.list.forEach((c) => walk(c, s2));
    };
    window.game.ui.children.list.forEach((o) => walk(o, 1));
    return min;
  });

/**
 * The Nova interface on one screen size: start, sizes (44 px touch, 12 px text, the 4 category buttons
 * fit, no top bar overlaps), chosen building balloon (never over the top right controls), locked
 * building, tapped house balloon with the main action, Avisos, Objetivos, Estatísticas (both tabs)
 * and Configurações, a milestone toast and a burst of toasts.
 */
async function novaScenario(page, suffix) {
  await startGame(page);
  const phone = suffix !== 'pc';
  const { tap } = phone ? await touchInput(page) : { tap: null };
  const press = async (name) => {
    const p = await uiPoint(page, name);
    if (tap) await tap(p);
    else await page.mouse.click(...(await gameToPage(page, ...p)));
    await page.waitForTimeout(150);
  };
  await shot(page, `nova-${suffix}`);

  // Every round button is at least 44 real px; the column buttons (categories) fit the screen height.
  const sizes = await page.evaluate(() => {
    const k = document.querySelector('canvas').getBoundingClientRect().width / 1280;
    const names = ['level', 'gear', 'speed-1', 'side-goals', 'side-alerts', 'side-stats', 'tool-view', 'tool-road', 'tool-clear',
      ...['house', 'plaza', 'market', 'temple'].map((b) => `build-${b}`)];
    return names.map((n) => {
      const p = window.layout.novaPoint(n);
      return { n, real: p.d * k, top: p.y - p.d / 2, bottom: p.y + p.d / 2 };
    });
  });
  const H = await page.evaluate(() => window.game.scale.height);
  for (const b of sizes) {
    // 0.01 px tolerance for float rounding of the scale.
    assert(b.real >= 44 - 0.01, `${b.n} is at least 44 real px (got ${b.real.toFixed(1)})`);
    assert(b.top >= 0 && b.bottom <= H, `${b.n} fits the screen height (${b.top.toFixed(0)}..${b.bottom.toFixed(0)} of ${H})`);
  }
  const overlaps = await page.evaluate(() => {
    const r = window.game.ui.view.top.rects().filter(Boolean);
    const out = [];
    for (let i = 0; i < r.length; i++)
      for (let j = i + 1; j < r.length; j++) {
        const a = r[i];
        const b = r[j];
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) out.push([i, j]);
      }
    return out;
  });
  assert(overlaps.length === 0, `no top bar parts overlap (${JSON.stringify(overlaps)})`);

  // Chosen building: the balloon at the left of the column, never over the season, speed and gear.
  await setupHudCity(page);
  await press('build-market'); // opens Trabalho
  await press('build-market');
  assert(await page.evaluate(() => window.game.tool === 'market'), 'the Mercado button picks the market');
  assert(await page.evaluate(() => window.game.ui.view.column.balloon.visible), 'the chosen building balloon shows');
  await press('build-house'); // Moradia
  await press('build-house');
  const clear = await page.evaluate(() => {
    const v = window.game.ui.view;
    return v.column.balloon.rect.y >= v.top.rightBottom;
  });
  assert(clear, 'the Casa balloon stays under the season pill and the gear');
  assert((await minUiText(page)) >= 11.9, 'no text under 12 real px');
  await shot(page, `nova-${suffix}-chosen`);

  // Locked: "Libera no objetivo N", nothing picked.
  await page.evaluate(() => {
    window.state.unlocked = window.state.unlocked.filter((k) => k !== 'park');
    window.game.selectTool('view');
  });
  await press('build-park'); // opens Moradia
  await press('build-park');
  assert(await page.evaluate(() => window.game.tool === 'view'), 'a locked building is not picked');
  await shot(page, `nova-${suffix}-locked`);

  // Tapped house (Mover): balloon with what it has and lacks, and the main action.
  await page.evaluate(() => {
    const s = window.state;
    const b = s.buildings.find((x) => x.kind === 'house' && x.level === 2);
    const w = window.iso.gridToWorld(b.x + 1, b.y + 1);
    window.game.cameras.main.centerOn(w.x, w.y);
    window.game.selected = { x: b.x, y: b.y };
    window.game.refresh();
  });
  await page.waitForTimeout(150);
  assert(await page.evaluate(() => window.game.ui.view.inspector.open), 'the tapped house balloon shows');
  await shot(page, `nova-${suffix}-house`);
  const action = await page.evaluate(() => {
    const b = window.game.ui.view.inspector.btns[0].root.getWorldTransformMatrix();
    return [b.tx, b.ty];
  });
  if (tap) await tap(action);
  else await page.mouse.click(...(await gameToPage(page, ...action)));
  await page.waitForTimeout(200);
  await shot(page, `nova-${suffix}-spots`);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.game.selectTool('view'));

  // A few weeks of history and two milestones, for the statistics charts and list.
  await page.evaluate(() => {
    const s = window.state;
    s.history = Array.from({ length: 30 }, (_, k) => ({ silver: 120 + 4 * k - (k > 20 ? 30 : 0), food: Math.min(40, 10 + 2 * k), residents: 10 + k, happiness: 50 + (k % 7), capacity: k > 18 ? 190 : 40 }));
    s.milestones.push('firstWedding', 'firstHarvest');
    s.milestoneWeeks = { firstWedding: 5, firstHarvest: 27 };
    window.game.ui.milestone('firstWedding');
    window.game.ui.milestone('firstHarvest');
    window.game.refresh();
  });
  await page.waitForTimeout(300);
  await shot(page, `nova-${suffix}-milestone`);

  // Panels never cover the bottom tools.
  for (const [name, kind] of [['side-alerts', 'alerts'], ['side-goals', 'goals'], ['side-stats', 'stats'], ['gear', 'settings']]) {
    await press(name);
    assert(await page.evaluate((k) => window.game.ui.view.panels.open === k, kind), `${name} opens ${kind}`);
    assert((await minUiText(page)) >= 11.9, `no text under 12 real px in ${kind}`);
    const covers = await page.evaluate(() => {
      const v = window.game.ui.view;
      return v.panels.rect.y + v.panels.rect.h > v.tools.top && v.panels.rect.x < v.tools.bottomRight;
    });
    if (covers) await shot(page, `nova-${suffix}-${kind}-covers`);
    assert(!covers, `${kind} does not cover Mover, Rua and Demolir`);
    await shot(page, `nova-${suffix}-${kind}`);
    if (kind === 'stats') {
      await press('stats-history');
      assert((await minUiText(page)) >= 11.9, 'no text under 12 real px in the history');
      await shot(page, `nova-${suffix}-history`);
      await press('stats-now');
    }
    await page.keyboard.press('Escape');
    assert(await page.evaluate(() => window.game.ui.view.panels.open === null), `Esc closes ${kind}`);
  }

  // A burst of toasts: none is lost, they wait in line.
  const sent = await page.evaluate(() => {
    const msgs = ['Primeira mensagem', 'Segunda mensagem', 'Terceira mensagem', 'Quarta mensagem', 'Quinta mensagem'];
    for (const m of msgs) window.game.ui.toast(m);
    const t = window.game.ui.view.toasts;
    const all = [...t.list, ...t.queue].map((x) => x.msg);
    return { lost: msgs.filter((m) => !all.includes(m)), shown: t.list.length };
  });
  assert(sent.lost.length === 0 && sent.shown <= 3, `no toast of a burst is lost, at most 3 on screen (${JSON.stringify(sent)})`);
  await shot(page, `nova-${suffix}-toasts`);
}

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

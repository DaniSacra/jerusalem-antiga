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
    window.state.food = 1e4; // no famine balloons over the captures
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
 * Opens the families' door: two granaries and food to reach the harvest, and a well for every house
 * (new families only come when every house has water and the food lasts until the harvest).
 */
async function openFamilyDoor(page) {
  await page.evaluate(() => {
    window.state.silver = 1e4;
    window.state.unlocked.push('granary');
  });
  await placeNear(page, 'granary');
  await placeNear(page, 'granary');
  await page.evaluate(() => {
    const { state: s, core } = window;
    s.food = 300;
    // Every house with water too (one well may not reach all the caravan tents).
    for (const b of s.buildings.filter((h) => h.kind === 'house' && !core.needMet(s, h, 'well'))) {
      if (core.needMet(s, b, 'well')) continue;
      const near = core.placeSpots(s, 'well').sort((p, q) => Math.abs(p.x - b.x) + Math.abs(p.y - b.y) - (Math.abs(q.x - b.x) + Math.abs(q.y - b.y)))[0];
      if (near) core.place(s, 'well', near.x, near.y);
    }
    window.game.refresh();
  });
  assert((await page.evaluate(() => window.core.familyBlock(window.state))) !== 'water', 'every house has water before the family step');
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

/** Plays the whole tutorial as a new player would, with a screenshot of each step. */
async function playTutorial(page, suffix) {
  await startGame(page, { tutorial: true });
  const shotStep = (name) => shot(page, `tutorial-${name}${suffix}`);
  await page.evaluate(() => window.game.setSpeed(0));
  await page.waitForTimeout(300);
  await shot(page, `tutorial-caravan${suffix}`); // the opening sentence over the start
  const caravan = await page.evaluate(() => window.game.ui.view.toasts.list.map((t) => t.msg));
  assert(caravan.some((m) => m.startsWith('A caravana chegou com')), `the caravan sentence opens the game (${caravan})`);

  // 1. Well near the caravan tents: the preview says how many houses it serves.
  assert((await tutorialStep(page)) === 'well', 'the tutorial starts with the well');
  await shotStep('step-1');
  await tool(page, 2); // Rua is locked during the step
  assert(await page.evaluate(() => window.game.tool === 'view'), 'only the step tool can be picked');
  assert((await pressBuild(page, 'well')) === 'well', 'the column picks the well (category, then the building)');
  const tent = await page.evaluate(() => window.state.buildings.find((b) => b.kind === 'house' && b.level >= 1));
  const spot = await page.evaluate(([x, y]) => {
    const { state: s, core } = window;
    return core.placeSpots(s, 'well').sort((a, b) => Math.abs(a.x - x) + Math.abs(a.y - y) - (Math.abs(b.x - x) + Math.abs(b.y - y)))[0];
  }, [tent.x, tent.y]);
  await page.evaluate(([x, y]) => window.game.setHover({ x, y }), [spot.x, spot.y]);
  await page.waitForTimeout(200);
  const serves = await page.evaluate(() => window.game.map.serves.visible && window.game.map.serves.text);
  assert(serves && serves.startsWith('Atende'), `the well preview says how many houses it serves (${serves})`);
  await shotStep('step-1-preview');
  await placeNear(page, 'well', tent);
  assert((await tutorialStep(page)) === 'road', 'a well ends step 1');

  // 2. Road toward the river or the grove, along the marked road.
  await shotStep('step-2');
  await press(page, ...(await uiPoint(page, 'tool-road')));
  assert(await page.evaluate(() => window.game.tool === 'road'), 'the Rua button picks the road');
  const ghost = await page.evaluate(() => window.game.ghost.map((c) => [c.x, c.y]));
  assert(ghost.length >= 4, `a marked road of at least 4 cells (${ghost.length})`);
  await dragCells(page, ghost);
  assert((await tutorialStep(page)) === 'gather', 'dragging the marked road ends step 2');

  // 3. Fisher or gatherer: the preview says what it yields.
  await shotStep('step-3');
  assert((await pressBuild(page, 'gatherer')) === 'gatherer', 'the step also allows the gatherer (alt)');
  await page.evaluate(() => window.game.setHover(window.game.ghost.at(-1)));
  await page.waitForTimeout(200);
  const yields = await page.evaluate(() => window.game.ui.view.tag.visible && window.game.ui.view.tagText.text);
  assert(yields && yields.startsWith('Rende'), `the gatherer preview says what it yields (${yields})`);
  await shotStep('step-3-preview');
  await placeNear(page, 'gatherer', await page.evaluate(() => window.game.ghost.at(-1)));
  assert((await tutorialStep(page)) === 'field', 'a gatherer ends step 3');

  // 4. Field: "colhe na primavera do ano 1".
  await pressBuild(page, 'field');
  await shotStep('step-4');
  await placeNear(page, 'field');
  assert((await tutorialStep(page)) === 'house', 'a field ends step 4');

  // 5. House next to the road, near the well.
  await pressBuild(page, 'house');
  await page.waitForTimeout(200);
  await shotStep('step-5');
  await placeNear(page, 'house');
  assert((await tutorialStep(page)) === 'family', 'a house ends step 5');

  // 6. A family arrives; the camera follows it. If nothing blocks the families, it comes.
  await openFamilyDoor(page);
  await page.evaluate(() => window.game.setSpeed(3));
  await page.waitForFunction(() => window.state.families.length > 0, null, { timeout: 30000 });
  await page.waitForTimeout(700);
  await shotStep('step-6');
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
  await page.evaluate(() => (window.state.silver = 500));
  await placeNear(page, 'market');
  assert((await tutorialStep(page)) === null, 'a market ends the tutorial');
  assert(await page.evaluate(() => localStorage.getItem('jerusalem.tutorialDone') === '1'), 'the tutorial is remembered as done');
}

/** The family step never traps the player: with the families blocked, the bubble says why and the tools are free. */
async function tutorialBlocked(page) {
  await startGame(page, { tutorial: true });
  await page.evaluate(() => {
    const { state: s, core } = window;
    window.game.setSpeed(0);
    s.silver = 1e4;
    // Jump to the family step, with a house far from any well (the "water" block).
    const g = window.game.guide;
    while (g.step && g.step.id !== 'family') g.k++;
    const spot = core.placeSpots(s, 'house').at(-1);
    core.place(s, 'house', spot.x, spot.y);
    window.game.refresh();
  });
  const why = await page.evaluate(() => [window.core.familyBlock(window.state), window.game.guide.allowed()]);
  assert(why[0] === 'water' && why[1] === null, `blocked families free the tools (${JSON.stringify(why)})`);
  await shot(page, 'tutorial-family-blocked');
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

  /** First game on a phone: the six tutorial steps, then the balance and the market. */
  tutorial: { context: PHONE, run: (page) => playTutorial(page, '') },
  'tutorial-pc': { context: PC, run: (page) => playTutorial(page, '-pc') },
  /** The family step with the families blocked: the reason shows and the tools are free (never stuck). */
  'tutorial-blocked': { context: PC, run: tutorialBlocked },

  /** Skipping ends the tutorial for good; with the storage blocked the game still runs. */
  async 'tutorial-skip'(page) {
    await startGame(page, { tutorial: true });
    assert(await page.evaluate(() => window.game.guide?.step?.id === 'well'), 'a first game starts the tutorial');
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
    await tool(page, 4); // Água e comida: Poço first
    assert(await page.evaluate(() => window.game.tool === 'well'), 'key 4 picks the well');
    await mouseClick(page, 22, 32);
    // The same key again: the next one, Campo (called directly: a key press is sometimes lost or doubled under software rendering).
    await page.evaluate(() => window.game.pickCategory('supply'));
    const again = await page.evaluate(() => window.game.tool);
    assert(again === 'field', `key 4 again picks the field (${again})`);
    await mouseClick(page, 22, 29);
    await page.mouse.move(...(await cellToPage(page, 27, 30)));
    await page.waitForTimeout(300);
    await shot(page, 'build-with-mouse');

    const after = await stats(page);
    assert(after.roads === before.roads + 6, `dragged road adds 6 cells (got ${after.roads - before.roads})`);
    assert(after.houses.length === before.houses.length + 3, `dragged 3 houses (got ${after.houses.length - before.houses.length})`);
    assert(after.buildings.includes('field') && after.buildings.includes('well'), 'field and well placed');
  },

  async 'families-arrive'(page) {
    await startGame(page);
    await page.evaluate(() => (window.state.silver = 1e4));
    await tool(page, 3); // Casa
    await mouseDrag(page, [[22, 28], [22, 36]]);
    await openFamilyDoor(page);
    await setSpeed(page, 3);
    await tool(page, 1);
    await page.waitForFunction(() => window.state.families.length > 0, null, { timeout: 20000 });
    await page.waitForTimeout(400);
    await shot(page, 'families-walking');
    await page.waitForFunction(() => window.state.milestones.includes('firstFamily'), null, { timeout: 30000 });
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

    // A house next to the garden: happy, with its reasons in the info line.
    const mood = await page.evaluate(() => {
      const { state: s, core } = window;
      const b = s.grid[19 * s.cols + 19];
      window.game.select({ x: 19, y: 19 });
      return core.houseInfo(s, b).happiness;
    });
    assert(mood?.parts.some((p) => p.kind === 'garden'), `the house beside the garden counts it (${JSON.stringify(mood)})`);
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
      for (const b of s.buildings.filter((b) => b.kind !== 'altar')) core.clearCell(s, b.x, b.y); // the caravan tents
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

      await tap(await uiPoint(page, 'build-well')); // opens Água e comida
      await tap(await uiPoint(page, 'build-well')); // Poço in the strip
      assert(await page.evaluate(() => window.game.tool === 'well'), 'the column picks the well');
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
    await clickUi(page, 'gear');
    await page.waitForTimeout(150);
    await clickUi(page, 'setting-turn-right'); // ↻
    await page.waitForTimeout(300);
    assert((await page.evaluate(() => window.iso.getRotation())) === 1, 'the clockwise arrow turns the view');
    await page.keyboard.press('Escape');
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
      s.goalIndex = core.RULES.upkeepStartsAfterGoal; // upkeep is charged from goal 2 on
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
      ...['house', 'well', 'market', 'temple'].map((b) => `build-${b}`)];
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
    window.state.unlocked = window.state.unlocked.filter((k) => k !== 'garden');
    window.game.selectTool('view');
  });
  await press('build-garden'); // opens Moradia
  await press('build-garden');
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
    s.milestones.push('firstFamily', 'firstHarvest');
    s.milestoneWeeks = { firstFamily: 5, firstHarvest: 27 };
    window.game.ui.milestone('firstFamily');
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

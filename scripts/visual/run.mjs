/**
 * Visual / end-to-end checks in a real browser (Playwright + Chromium).
 *
 * Starts the Vite dev server, plays scripted scenarios, saves screenshots to screenshots/
 * and fails if an assertion breaks or the page logs an error.
 *
 *   npm run test:visual            # the 3D scenarios, plus "title" (the legacy 2D still opens)
 *   npm run test:visual -- touch   # only scenarios whose name contains "touch" (2D ones too)
 *   VISUAL_2D=1 npm run test:visual   # every scenario, the frozen legacy 2D ones too
 *   VISUAL_SHARD=0/4 npm run test:visual   # a quarter of them (0/4, 1/4, 2/4, 3/4 cover all)
 *
 * Scenarios use the dev-only hooks window.game, window.state and window.core
 * (exposed by GameScene in dev builds) to read state and set up situations quickly.
 */
import { rmSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';

/** Screenshot folder (`VISUAL_OUT` lets two runs at once keep apart; it is emptied at the start). */
const OUT = process.env.VISUAL_OUT ?? 'screenshots';
/** Tutorial numbers (weddingStepMaxWeeks). */
const TUTORIAL = JSON.parse(await readFile('src/data/tutorial.json', 'utf8'));
const PORT = Number(process.env.VISUAL_PORT ?? 5199);
/** A fixed map (dev hook): the river and the caravan always in the same place, away from the test towns. */
const SEED = 5;
/** The legacy 2D game (the 3D scenarios open `?view=3d` themselves). */
const URL = `http://localhost:${PORT}/?seed=${SEED}&view=2d`;
const GAME_W = 1280;
const GAME_H = 720;
const filter = process.argv[2] ?? '';
/** `VISUAL_SHARD=k/n` runs only every n-th scenario starting at k (0-based): long suites in short runs. */
const [SHARD_K, SHARD_N] = (process.env.VISUAL_SHARD ?? '0/1').split('/').map(Number);

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
    Object.assign(s, { silver: 1e4, wood: 1e4, stone: 1e4 }); // materials too: scenarios build freely
    s.feature = s.feature.map(() => null);
    for (const b of s.buildings.filter((b) => b.kind !== 'altar')) core.clearCell(s, b.x, b.y); // the caravan tents
    s.unlocked.push('market', 'workshop');
    s.people = [];
    for (let y = 27; y <= 41; y += 2) {
      core.place(s, 'house', 22, y);
      const b = s.grid[y * s.cols + 22];
      b.level = 2;
      // Four adults living there (the people are who work and eat).
      for (let k = 0; k < 4; k++) core.addPerson(s, { sex: k % 2 ? 'f' : 'm', age: 30, houseId: b.id, caravan: 0, clan: k }, () => 0.5);
    }
    core.place(s, 'field', 25, 27);
    // Off the road, in rows of 12, until the upkeep beats the taxes.
    for (let k = 0; k < 36 && core.computeEconomy(s).silverDelta >= 0; k++) core.place(s, 'plaza', 4 + 3 * (k % 12), 4 + 3 * Math.floor(k / 12));
    s.silver = 180;
    window.game.setSpeed(0);
    core.refreshCity(s);
    window.game.refresh();
  });
  await page.waitForTimeout(200);
  const kinds = await page.evaluate(() => window.core.alerts(window.state).map((a) => a.kind));
  assert(kinds.includes('deficit') && kinds.includes('unemployed'), `deficit and unemployment alerts (${kinds})`);
}

/** Puts `n` adults in every house without people (with the People package, people work and eat). */
async function fillHouses(page, n = 4) {
  await page.evaluate((n) => {
    const { state: s, core } = window;
    for (const b of s.buildings.filter((b) => b.kind === 'house' && !s.people.some((p) => p.houseId === b.id))) {
      for (let k = 0; k < n; k++) core.addPerson(s, { sex: k % 2 ? 'f' : 'm', age: 30, houseId: b.id, caravan: 0, clan: k }, () => 0.5);
    }
    core.refreshCity(s);
    window.game.refresh();
  }, n);
}

/** A walled town with every building kind and house level, framed at zoom 1.1. */
async function buildTown(page) {
  await page.evaluate(() => {
    const { state: s, core } = window;
    Object.assign(s, { silver: 1e6, wood: 1e6, stone: 1e6 }); // materials too: scenarios build freely
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
    Object.assign(s, { wood: 120, stone: 60 }); // a town's stock, so the top bar has its real width
    window.game.refresh();
    const cam = window.game.cameras.main;
    cam.setZoom(1.1);
    cam.centerOn(-64, 780);
  });
}

/**
 * Lumber west of the town in a small grove (with fresh stumps and stumps sprouting) and a quarry
 * outside the east wall among rocks; both connected. Call after buildTown.
 */
async function addWoodStone(page) {
  await page.evaluate(() => {
    const { state: s, core } = window;
    s.unlocked.push('lumber', 'quarry');
    const at = (x, y) => y * s.cols + x;
    const put = (k, x, y) => {
      const r = core.place(s, k, x, y);
      if (!r.ok) throw new Error(`wood-stone: cannot place ${k} at ${x},${y}: ${r.reason}`);
    };
    put('lumber', 13, 22);
    for (const [x, y, f] of [[15, 21, 'olive'], [16, 22, 'palm'], [15, 23, 'olive'], [17, 23, 'olive'], [16, 24, 'palm'], [17, 21, 'olive']]) s.feature[at(x, y)] = f;
    // Stumps: just cut (week now) and growing back (cut more than half the regrowth ago).
    const half = Math.ceil(core.RULES.treeRegrowWeeks / 2);
    for (const [x, y, kind, ago] of [[16, 23, 'olive', 0], [17, 22, 'palm', 0], [15, 24, 'olive', half + 4], [17, 24, 'palm', half + 4]]) {
      s.feature[at(x, y)] = 'stump';
      s.stumps.push({ i: at(x, y), kind, week: s.week - ago });
    }
    put('quarry', 37, 19);
    for (const [x, y] of [[39, 19], [39, 20], [37, 21], [38, 21], [39, 21], [40, 20], [38, 17]]) if (s.ground[at(x, y)] !== 'river') s.feature[at(x, y)] = 'rock';
    core.refreshCity(s);
    window.game.refresh();
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
    return { p: [Math.round(p.x), Math.round(p.y)], fc: g.ui.view.freeCenter(), pan: g.pan, tut: g.ui.view.tutorial.top, top: g.ui.view.top.bottom, bad: pts.filter(([x, y]) => g.ui.isOverUi(x, y) || y >= toastTop || y < 0 || x < 0 || x > 1280) };
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

/** Text lines of the tapped building's balloon (with the phone's second column). */
const inspectorLines = (page) => page.evaluate(() => {
  const c = window.game.ui.view.inspector.card;
  return c ? [...c.lines, ...c.aside].map((l) => l.text) : [];
});

/**
 * Pacote 2 interface: a mud-brick house balloon with the locked market (lock on the map, "libera no
 * objetivo 3" in the balloon), toasts held while that balloon is open (only the first warning that still holds comes back), Demolir
 * aimed at a full granary ("Perde N de comida"), and the Moradia strip with Praça and Parque.
 */
async function p2Interface(page, suffix) {
  await startGame(page);
  await page.waitForFunction(() => window.game.ui.view.toasts.list.length === 0, null, { timeout: 90000 }); // the opening sentence goes away
  const house = await page.evaluate(() => {
    const { state: s, core, game } = window;
    game.setSpeed(0);
    Object.assign(s, { silver: 1e4, wood: 1e4, stone: 1e4 }); // materials too: scenarios build freely
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

  // Toasts wait while the balloon is open; on closing, only the first warning that still holds comes back
  // (past news and a warning that stopped holding are dropped).
  await page.evaluate(() => {
    window.__first = 0;
    window.game.ui.toast('Teste: notícia com o balão aberto', 'good');
    window.game.ui.toast('Teste: aviso que deixa de valer', 'bad', { alert: () => window.__first });
    window.game.ui.toast('Teste: aviso menos importante', 'info', { alert: () => 5 });
    window.game.ui.toast('Teste: aviso que continua', 'info', { alert: () => 2 });
  });
  await page.waitForTimeout(300);
  const held = await page.evaluate(() => window.game.ui.view.toasts.list.length);
  assert(held === 0, `no toast over the open balloon (${held})`);
  await shot(page, `toast-inspector${suffix}`);
  await page.evaluate(() => {
    window.__first = -1;
    window.game.deselect();
  });
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => window.game.ui.view.toasts.list.map((t) => t.msg));
  assert(after.length === 1 && after[0] === 'Teste: aviso que continua', `only the first warning that still holds comes when the balloon closes (${after})`);
  assert((await page.evaluate(() => window.game.ui.view.toasts.queue.length)) === 0, 'nothing else waits in line');
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
  const after = await page.evaluate((id) => ({ standing: window.state.buildings.some((b) => b.id === id), lines: [...(window.game.ui.view.inspector.card?.lines ?? []), ...(window.game.ui.view.inspector.card?.aside ?? [])].map((l) => l.text) }), granary.id);
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
  await page.waitForFunction(() => window.game.ui.view.tag.visible && window.game.ui.view.tagText.text.startsWith('Rende'), null, { timeout: 3000 }).catch(() => {});
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
  await page.waitForFunction(() => window.game.guide?.step?.id === 'lumber', null, { timeout: 90000 });
  const wed = await page.evaluate((w) => ({ weeks: window.state.week - w, wedding: window.state.milestones.includes('firstWedding') }), wedStart);
  assert(wed.weeks <= TUTORIAL.weddingStepMaxWeeks + 1, `the wedding step ends within weddingStepMaxWeeks (${JSON.stringify(wed)})`);
  assert(wed.wedding, `the opening couple married in the new house (${JSON.stringify(wed)})`);

  // 7. Lumber: the camera brings the lumber spot into view; its preview says the wood and the cuts.
  await page.evaluate(() => window.game.setSpeed(0));
  await assertStepInView(page, 'lumber');
  await shotStep('lumber');
  const lumber = await page.evaluate(() => window.game.lumberHint);
  assert(lumber && lumber.food > 0, `the lumber step points at a spot with trees (${JSON.stringify(lumber)})`);
  if (lumber.road.length) {
    // Past the grove's edge: the bubble asks for the marked road first and the arrow points at Rua.
    const say = await page.evaluate(() => window.game.ui.view.tutorial.label.text);
    assert(say.includes('rua marcada'), `the lumber bubble asks for the marked road (${say})`);
    const target = await page.evaluate(() => window.game.tutorialTarget());
    const rua = await uiPoint(page, 'tool-road');
    assert(target && Math.abs(target.x - rua[0]) < 60, `the arrow points at Rua first (${JSON.stringify(target)} vs ${rua}; ${say})`);
    await page.evaluate((road) => {
      for (const c of road) window.core.place(window.state, 'road', c.x, c.y);
      window.game.refresh();
    }, lumber.road);
  }
  assert((await pressBuild(page, 'lumber')) === 'lumber', 'the column picks the lumber');
  await page.evaluate(([x, y]) => window.game.setHover({ x, y }), [lumber.x, lumber.y]);
  await page.waitForFunction(() => window.game.ui.view.tag.visible && window.game.ui.view.tagText.text.includes('Corta'), null, { timeout: 3000 }).catch(() => {});
  const wood = await page.evaluate(() => window.game.ui.view.tag.visible && window.game.ui.view.tagText.text);
  assert(wood && wood.startsWith('Rende') && wood.includes('madeira') && wood.includes('Corta 1 árvore'), `the lumber preview says the wood and the cuts (${wood})`);
  await shotStep('lumber-preview');
  await page.evaluate((l) => {
    const s = window.state;
    window.core.place(s, 'lumber', l.x, l.y);
    window.game.setHover(null);
    window.game.refresh();
  }, lumber);
  await page.waitForFunction(() => window.game.guide?.step === null, null, { timeout: 60000 });
  assert(await page.evaluate(() => !window.game.guide.running), 'the main steps end after the lumber step');
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
    Object.assign(window.state, { silver: 1e4, wood: 1e4, stone: 1e4 }); // materials too: scenarios build freely
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
  // The wedding step gives up and the lumber step follows (it holds the clock).
  await page.waitForFunction(() => window.game.guide?.step?.id === 'lumber', null, { timeout: 90000 });
  const end = await page.evaluate((w) => ({ weeks: window.state.week - w, wedding: window.state.milestones.includes('firstWedding'), toasts: [...window.game.ui.view.toasts.list, ...window.game.ui.view.toasts.queue].map((t) => t.msg) }), week);
  assert(!end.wedding && end.weeks >= TUTORIAL.weddingStepMaxWeeks && end.weeks <= TUTORIAL.weddingStepMaxWeeks + 1, `the wedding step with no house ends after ${TUTORIAL.weddingStepMaxWeeks} weeks (${JSON.stringify(end)})`);
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
    Object.assign(window.state, { silver: 1e4, wood: 1e4, stone: 1e4 });
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
  const lines = await page.evaluate(() => (JSON.parse(window.game.ui.view.column.balloon.key || '[[]]')[0]).map((l) => l.text)); // key: [lines, aside, reserve]
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

/** Every visible text of the interface (to find a line in a panel). */
const uiTexts = (page) =>
  page.evaluate(() => {
    const out = [];
    const walk = (o) => {
      if (!o.visible) return;
      if (o.type === 'Text' && o.text.trim()) out.push(o.text);
      if (o.list) o.list.forEach(walk);
    };
    window.game.ui.children.list.forEach(walk);
    return out;
  });

/** Texts of a top bar pill ('materials', 'stone', 'food'...). */
const pillText = (page, name) =>
  page.evaluate((n) => {
    const top = window.game.ui.view.top;
    const p = n === 'materials' ? top.mats[0] : n === 'stone' ? top.mats.at(-1) : top[n];
    return p.root.visible ? p.texts.filter((t) => t.visible).map((t) => t.text).join(' ') : null;
  }, name);

/** No two parts of the top bar overlap. */
async function assertTopFits(page, when) {
  const overlaps = await page.evaluate(() => {
    const r = window.game.ui.view.top.rects().filter(Boolean);
    const out = [];
    for (let i = 0; i < r.length; i++)
      for (let j = i + 1; j < r.length; j++) {
        const a = r[i];
        const b = r[j];
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) out.push([i, j]);
      }
    const right = Math.max(...r.map((x) => x.x + x.w));
    return { out, right, column: window.game.ui.view.column.rect.x };
  });
  assert(overlaps.out.length === 0 && overlaps.right <= overlaps.column, `no top bar parts overlap ${when} (${JSON.stringify(overlaps)})`);
}

/**
 * PC top bar with a grown city's stock (4-digit silver, 3-digit wood and stone, the Alegria pill on):
 * the stat pills shorten (`MAX_FIT`) and end left of the speed buttons; the Alegria pill can be tapped.
 */
async function topFitScenario(page, suffix) {
  await startGame(page);
  const r = await page.evaluate(() => {
    const { state: s, game } = window;
    game.setSpeed(0);
    s.unlocked.push('quarry', 'park');
    Object.assign(s, { silver: 9876, wood: 987, stone: 876 });
    game.refresh();
    const top = game.ui.view.top;
    const pills = [top.silver, top.food, ...top.mats, top.people, top.joy].filter((p) => p?.root.visible).map((p) => p.rect);
    const joy = top.joy.rect;
    return { right: Math.max(...pills.map((q) => q.x + q.w)), speed: top.speedRect.x, joyHit: game.ui.isOverUi(joy.x + joy.w / 2, joy.y + joy.h / 2) };
  });
  assert(r.right < r.speed && r.joyHit, `the stat pills end left of the speed buttons with a big stock (${JSON.stringify(r)})`);
  await assertTopFits(page, 'with a big stock');
  await shot(page, `top-fit${suffix}`);
}

/**
 * Pacote 3 materials: the Materiais pill (wood only, then the stone with its unlock toast), a house
 * waiting for stone (red ⚠ in the pill, "Pronta para virar…: falta N de pedra", "Onde pôr uma
 * pedreira"), the Materiais section of the statistics, the quarry balloon short of wood and its toast.
 */
/**
 * Lenha e inverno (P4): the caravan tents in winter with wood (smoke, "Lenha no inverno" in the house
 * balloon), then wood 0 and one week: cold, the wood pill red with ⚠, the firewood alert and its
 * toast, "Frio: falta lenha" in red in the balloon and no chimney smoke.
 */
async function winterColdScenario(page, suffix) {
  await startGame(page);
  await page.evaluate(() => window.game.setSpeed(0));
  await page.waitForFunction(() => window.game.ui.view.toasts.list.length === 0, null, { timeout: 30000 }); // the opening sentence goes away
  const M = await page.evaluate(() => window.core.RULES.weeksPerSeason);
  const house = await page.evaluate(() => {
    const s = window.state;
    s.food = window.core.foodCapacity(s); // no famine: the cold alone
    s.wood = 100;
    const h = s.buildings.find((b) => b.kind === 'house' && b.level >= 1 && s.people.some((p) => p.houseId === b.id));
    return { x: h.x, y: h.y, w: h.w, h: h.h };
  });
  await setLook(page, M + 2); // early winter
  await centerOnBuilding(page, house, 1.4);
  const select = () =>
    page.evaluate(([x, y]) => {
      window.game.selected = { x, y };
      window.game.refresh();
    }, [house.x, house.y]);
  await select();
  await page.waitForTimeout(300);
  let lines = await inspectorLines(page);
  assert(lines.some((l) => l.startsWith('Lenha no inverno: ')), `a warm house says its firewood (${lines})`);
  assert(await page.evaluate(() => window.game.map.smoke.emitting), 'chimney smoke in winter with wood');
  await shot(page, `winter-warm${suffix}`);

  // No wood: one week burns nothing, it is cold.
  await page.evaluate(() => {
    const s = window.state;
    s.wood = 0;
    window.game.handleEvents(window.core.stepWeek(s, window.core.createRng(1)));
    s.food = window.core.foodCapacity(s);
    window.game.refresh();
  });
  await select();
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => ({ cold: window.state.cold, smoke: window.game.map.smoke.emitting, alerts: window.core.alerts(window.state).filter((a) => a.kind === 'firewood') }));
  assert(st.cold && st.alerts.length === 1 && st.alerts[0].cold, `cold, with the firewood alert (${JSON.stringify(st)})`);
  assert(!st.smoke, 'no chimney smoke while it is cold');
  const pill = await pillText(page, 'materials');
  const red = await page.evaluate(() => { const t = window.game.ui.view.top.mats[0].texts.find((x) => x.visible && x.text.startsWith('⚠')); return t?.style.color; });
  assert(pill && pill.includes('⚠ 0') && red && red !== (await page.evaluate(() => window.game.ui.view.top.people.texts.at(-1).style.color)), `the wood pill is red with ⚠ (${pill}, ${red})`);
  lines = await inspectorLines(page);
  assert(lines.includes('Frio: falta lenha'), `the house balloon says the cold (${lines})`);
  await shot(page, `winter-cold${suffix}`);
  await page.evaluate(() => {
    window.game.selected = null;
    window.game.refresh();
  });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => [...window.game.ui.view.toasts.list, ...window.game.ui.view.toasts.queue].map((t) => t.msg));
  // The balloon held the toasts; closing it brings back the cold warning (the alert or the coldStart toast).
  assert(after.some((m) => m.startsWith('Frio!')), `a cold toast shows (${after})`);
  await assertTopFits(page, 'in the cold');
  await shot(page, `winter-cold-toast${suffix}`);
  await clickUi(page, 'side-alerts');
  await page.waitForTimeout(250);
  await shot(page, `winter-cold-alerts${suffix}`);
}

/** Stone at the cap (400) with a quarry: its balloon says it stopped, and the storageFull alert. */
async function quarryFullScenario(page, suffix) {
  await startGame(page);
  await buildTown(page);
  await addWoodStone(page);
  await fillHouses(page, 4); // workers for the quarry: the balloon shows a working quarry that stopped
  const q = await page.evaluate(() => {
    const s = window.state;
    window.game.setSpeed(0);
    s.food = window.core.foodCapacity(s);
    s.stone = window.core.RULES.materialStorage;
    window.game.refresh();
    const b = s.buildings.find((x) => x.kind === 'quarry');
    return { x: b.x, y: b.y, w: b.w, h: b.h };
  });
  await centerOnBuilding(page, q, 1.4);
  await page.evaluate(([x, y]) => {
    window.game.selected = { x, y };
    window.game.refresh();
  }, [q.x, q.y]);
  await page.waitForTimeout(300);
  const cap = await page.evaluate(() => window.core.RULES.materialStorage);
  const lines = await inspectorLines(page);
  assert(lines.includes(`Parado: estoque cheio (${cap})`), `the quarry balloon says it stopped (${lines})`);
  assert(!lines.some((l) => l.includes('Sem rochas')), `the quarry among rocks never says there are none (${lines})`);
  const alerts = await page.evaluate(() => window.core.alerts(window.state).filter((a) => a.kind === 'storageFull').map((a) => a.material));
  assert(alerts.includes('stone'), `the storageFull alert for stone (${alerts})`);
  await shot(page, `quarry-full${suffix}`);
  await page.evaluate(() => {
    window.game.selected = null;
    window.game.refresh();
  });
  await clickUi(page, 'side-alerts');
  await page.waitForTimeout(250);
  await shot(page, `quarry-full-alerts${suffix}`);
}

async function materialsScenario(page, suffix) {
  await startGame(page);
  const phone = !suffix.includes('pc');
  await page.evaluate(() => window.game.setSpeed(0));
  await page.waitForFunction(() => window.game.ui.view.toasts.list.length === 0, null, { timeout: 20000 }); // the opening sentence goes away
  const start = await pillText(page, 'materials');
  const wood = await page.evaluate(() => String(window.core.RULES.startMaterials.wood));
  assert(start && start.includes(wood), `the caravan brings ${wood} wood to the pill (${start})`);
  if (!phone) assert((await pillText(page, 'stone')) === null, 'no stone pill before the quarry');
  assert(start && !start.includes('Pedra'), `no stone before the quarry (${start})`);
  await assertTopFits(page, 'with the wood');
  await shot(page, `materials-top${suffix}`);

  // Goal 6 unlocks the quarry: the toast says it and the stone joins the pill with a glow.
  await page.evaluate(() => {
    window.state.unlocked.push('quarry');
    window.game.handleEvents([{ type: 'goal', reward: 40, unlock: 'quarry' }]);
    window.game.refresh();
  });
  await page.waitForTimeout(250);
  const toasts = await page.evaluate(() => [...window.game.ui.view.toasts.list, ...window.game.ui.view.toasts.queue].map((t) => t.msg));
  assert(toasts.some((m) => m.includes('Nova construção: Pedreira')), `the goal toast names the quarry (${toasts})`);
  const stone = await pillText(page, phone ? 'materials' : 'stone');
  assert(stone !== null && (phone ? stone.split(' ').length >= 2 : stone.includes('/sem')), `the stone shows after the quarry (${stone})`);
  await assertTopFits(page, 'with the stone');
  await shot(page, `materials-top-stone${suffix}`);

  // A house ready for the stone house without stone: it waits, the pill turns red with ⚠.
  const house = await page.evaluate(() => {
    const { state: s, core, game } = window;
    Object.assign(s, { silver: 1e4, wood: 1e4 });
    s.unlocked.push('market');
    const at = core.campPlazaSpot();
    core.place(s, 'plaza', at.x, at.y);
    core.refreshCity(s);
    const h = s.buildings.find((b) => b.kind === 'house' && b.level >= 1 && core.needMet(s, b, 'plaza'));
    h.level = 2;
    const m = core.spotsServing(s, 'market', h)[0];
    const r = core.place(s, 'market', m.x, m.y, m.rotated);
    if (!r.ok) throw new Error(`market: ${r.reason}`);
    core.refreshCity(s);
    s.stone = 3;
    h.waiting = 'stone';
    h.upStreak = h.upWeeks;
    game.refresh();
    return { x: h.x, y: h.y, w: h.w, h: h.h };
  });
  await page.waitForTimeout(200);
  const red = await pillText(page, phone ? 'materials' : 'stone');
  assert(red && red.includes('⚠ 3'), `the stone is red with ⚠ while a house waits (${red})`);
  const alertToast = await page.evaluate(() => [...window.game.ui.view.toasts.list, ...window.game.ui.view.toasts.queue].map((t) => t.msg));
  assert(alertToast.some((m) => m.startsWith('1 casa esperando pedra')), `the first house waiting says so in a toast (${alertToast})`);
  await centerOnBuilding(page, house);
  await page.evaluate(([x, y]) => {
    window.game.selected = { x, y };
    window.game.refresh();
  }, [house.x, house.y]);
  await page.waitForTimeout(200);
  const lines = await inspectorLines(page);
  assert(lines.some((l) => l === 'Pronta para virar Casa de pedra: falta 7 de pedra'), `the house says what it waits for (${lines})`);
  const label = await page.evaluate(() => window.game.ui.view.inspector.card.action?.label);
  assert(label === 'Onde pôr uma pedreira', `the main action finds a quarry spot (${label})`);
  // The toast that was on screen steps out while the balloon is open (a warning: it may come back).
  const behind = await page.evaluate(() => ({ shown: window.game.ui.view.toasts.list.length, waiting: window.game.ui.view.toasts.queue.map((t) => t.msg) }));
  assert(behind.shown === 0 && behind.waiting.some((m) => m.startsWith('1 casa esperando pedra')), `no toast behind the open balloon; it waits in line (${JSON.stringify(behind)})`);
  await shot(page, `house-waiting-stone${suffix}`);
  await page.evaluate(() => window.game.ui.view.inspector.host.act(window.game.ui.view.inspector.card.action));
  await page.waitForTimeout(250);
  assert(await page.evaluate(() => window.game.tool === 'quarry'), '"Onde pôr uma pedreira" picks the quarry');
  // The spots by the rocks light up, or (none next to a road) the toast says to take a road there.
  const where = await page.evaluate(() => ({ lit: window.game.map.solve.visible, toasts: [...window.game.ui.view.toasts.list, ...window.game.ui.view.toasts.queue].map((x) => x.msg) }));
  assert(where.lit || where.toasts.some((m) => m.startsWith('Nenhum lugar com rochas')), `the quarry spots light up, or the toast says why (${JSON.stringify(where)})`);
  // Closing the balloon brings back one toast at most: the stone warning, which still holds.
  const back = where.toasts.filter((m) => !m.startsWith('Nenhum lugar com rochas'));
  assert(back.length === 1 && back[0].startsWith('1 casa esperando pedra'), `only the stone warning comes back after the balloon (${JSON.stringify(back)})`);
  await shot(page, `house-waiting-stone-spots${suffix}`);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.game.selectTool('view'));
  // Not waiting yet (still counting): the balloon says what climbing will ask.
  const asks = await page.evaluate(([x, y]) => {
    const { state: s, game } = window;
    const h = s.grid[y * s.cols + x];
    h.waiting = undefined;
    h.upStreak = 2;
    game.selected = { x, y };
    game.refresh();
    const card = game.ui.view.inspector.card;
    const lines = [...card.lines, ...card.aside].map((l) => l.text); // the phone keeps the level beside the people
    h.waiting = 'stone';
    h.upStreak = h.upWeeks;
    game.selected = null;
    game.refresh();
    return lines;
  }, [house.x, house.y]);
  assert(asks.includes('Ao evoluir: pede 10 de pedra'), `a counting house says what climbing asks (${asks})`);

  // Estatísticas: the Materiais section.
  await page.evaluate(() => window.game.ui.view.panels.toggle('stats'));
  await page.waitForTimeout(200);
  const texts = await uiTexts(page);
  assert(texts.includes('Materiais') && texts.some((t) => t.startsWith('Casas esperando pedra')), `the statistics have the Materiais section (${texts.filter((t) => /Materiais|esperando|Madeira|Pedra/.test(t))})`);
  assert((await minUiText(page)) >= 11.9, 'no text under 12 real px in the statistics');
  await shot(page, `materials-stats${suffix}`);
  await page.keyboard.press('Escape');

  // The quarry without wood: grey button, the cost in red with what the city has, and the toast.
  await page.evaluate(() => {
    window.state.wood = 4;
    window.game.refresh();
  });
  assert((await pressBuild(page, 'quarry')) === 'quarry', 'the column picks the quarry');
  const cost = await page.evaluate(() => (JSON.parse(window.game.ui.view.column.balloon.key || '[[]]')[0]).map((l) => l.text));
  assert(cost.includes('40 prata · 10 madeira (tem 4)'), `the balloon says the wood lacking (${cost})`);
  await shot(page, `quarry-balloon-lacking${suffix}`);
  const spot = await page.evaluate(() => window.core.placeSpots(window.state, 'quarry')[0]);
  await page.evaluate((c) => window.game.apply(c, true), spot);
  await page.waitForTimeout(200);
  const lack = await page.evaluate(() => [...window.game.ui.view.toasts.list, ...window.game.ui.view.toasts.queue].map((t) => t.msg));
  assert(lack.includes('Falta madeira: construa um lenhador'), `building without wood says what to do (${lack})`);
  await shot(page, `toast-lacking-wood${suffix}`);
}

/** The lumber preview beside a gatherer: "Divide o bosque com a Coletora" (and the gatherer's, with the lumber). */
async function lumberShared(page, suffix) {
  await startGame(page);
  const at = await page.evaluate(() => {
    const { state: s, core, game } = window;
    game.setSpeed(0);
    Object.assign(s, { silver: 1e4, wood: 1e4, stone: 1e4 });
    // The lumber's best spot and its road, then a gatherer on the same grove.
    const l = core.lumberSpot(s);
    for (const c of l.road) core.place(s, 'road', c.x, c.y);
    const trees = (x, y) => core.foodAfter(s, 'gatherer', { x, y, rotated: false }).yields;
    const g = core.placeSpots(s, 'gatherer').filter((c) => Math.abs(c.x - l.x) + Math.abs(c.y - l.y) <= 6 && (c.x + 1 < l.x || c.x > l.x + 1 || c.y + 1 < l.y || c.y > l.y + 1)).sort((a, b) => trees(b.x, b.y) - trees(a.x, a.y))[0];
    if (!g) throw new Error('no gatherer spot by the grove');
    const r = core.place(s, 'gatherer', g.x, g.y);
    if (!r.ok) throw new Error(`gatherer: ${r.reason}`);
    game.refresh();
    return { x: l.x, y: l.y, w: 2, h: 2, shared: core.sharedTrees(s, l.x, l.y, 'lumber') };
  });
  assert(at.shared > 0, `the lumber spot shares trees with the gatherer (${JSON.stringify(at)})`);
  await centerOnBuilding(page, at, 1.3);
  await pick(page, 'lumber');
  await page.evaluate(([x, y]) => window.game.setHover({ x, y }), [at.x, at.y]);
  await page.waitForFunction(() => window.game.ui.view.tag.visible && window.game.ui.view.tagText.text.includes('Divide'), null, { timeout: 3000 }).catch(() => {});
  const tag = await page.evaluate(() => window.game.ui.view.tag.visible && window.game.ui.view.tagText.text);
  assert(tag && tag.includes('Divide o bosque com a Coletora') && tag.includes('madeira'), `the lumber preview says it shares the grove (${tag})`);
  await shot(page, `lumber-preview-shared${suffix}`);

  // A tent ready for the mud house without wood: "Onde pôr um lenhador" lights the spots by the grove.
  const tent = await page.evaluate(() => {
    const { state: s, core, game } = window;
    game.setHover(null);
    game.selectTool('view');
    s.wood = 0;
    const p = core.campPlazaSpot();
    core.place(s, 'plaza', p.x, p.y);
    core.refreshCity(s);
    const h = s.buildings.find((b) => b.kind === 'house' && b.level === 1 && core.needMet(s, b, 'plaza'));
    h.waiting = 'wood';
    h.upStreak = h.upWeeks;
    game.selected = { x: h.x, y: h.y };
    game.refresh();
    return { x: h.x, y: h.y, label: game.ui.view.inspector.card.action?.label };
  });
  assert(tent.label === 'Onde pôr um lenhador', `the waiting tent offers a lumber spot (${tent.label})`);
  await page.evaluate(() => window.game.ui.view.inspector.host.act(window.game.ui.view.inspector.card.action));
  await page.waitForTimeout(200);
  const lit = await page.evaluate(() => window.game.tool === 'lumber' && window.game.map.solve.visible);
  assert(lit, 'the lumber spots by the grove light up');
  await centerOnBuilding(page, at, 1);
  await shot(page, `lumber-spots${suffix}`);
}

// ---------- scenarios ----------

// ---------- Pacote Povo: people on screen ----------

/**
 * A paused town of named people (Ano 4): a mud house (Baruque and Ana, their son Natã engaged to
 * Débora, their daughter Miriã born in the city; Baruque's father Ezequias died at 71 and his son
 * Joás left in Ano 3), a stone house (Joel's family of five with his mother), a tent of a later
 * caravan, an empty stone house, a field and a granary. Returns the ids by name.
 */
async function setupPeople(page, { freeHouse = true } = {}) {
  return page.evaluate((freeHouse) => {
    const { state: s, core } = window;
    const Y = core.RULES.people.weeksPerLifeYear;
    // The 2D game, or the 3D one (its session).
    const g = window.view3d ? window.session : window.game;
    g.setSpeed(0);
    s.week = 3 * core.WEEKS_PER_YEAR + 5;
    s.silver = 500;
    s.wood = 200; // materials: the scenario builds freely
    s.stone = 100;
    s.feature = s.feature.map(() => null);
    for (const b of s.buildings.filter((b) => b.kind !== 'altar')) core.clearCell(s, b.x, b.y); // the caravan tents
    s.people = [];
    s.departed = [];
    s.families = [];
    s.unlocked.push('granary', 'market', 'workshop');
    s.caravans = [{ week: 2 * core.WEEKS_PER_YEAR - 10, families: 2, warn: 6, status: 'arrived', housed: 1, left: 1 }];
    const house = (y, level) => {
      if (!core.place(s, 'house', 22, y).ok) throw new Error(`no house at 22,${y}`);
      const b = s.grid[y * s.cols + 22];
      b.level = level;
      return b;
    };
    const ids = {};
    const add = (name, b, sex, age, clan, o = {}) => {
      const p = core.addPerson(s, { sex, age, houseId: b ? b.id : null, caravan: o.caravan === undefined ? 0 : o.caravan, clan, fatherId: o.father?.id, motherId: o.mother?.id }, () => 0.5);
      p.name = name;
      p.birthWeek = s.week - age * Y - 2;
      ids[name] = p.id;
      return p;
    };
    const a = house(27, 2);
    const b = house(29, 3);
    const c = house(31, 1);
    const ezequias = add('Ezequias', a, 'm', 71, 3);
    const baruque = add('Baruque', a, 'm', 44, 3, { father: ezequias });
    const ana = add('Ana', a, 'f', 40, 3);
    core.wed(baruque, ana);
    const nata = add('Natã', a, 'm', 19, 3, { father: baruque, mother: ana });
    const joas = add('Joás', a, 'm', 16, 3, { father: baruque, mother: ana });
    add('Miriã', a, 'f', 6, 3, { father: baruque, mother: ana, caravan: null });
    core.depart(s, ezequias, 'age');
    core.depart(s, joas, 'noHouse');
    s.departed.find((p) => p.id === joas.id).end.week = 2 * core.WEEKS_PER_YEAR + 20;
    const hamutal = add('Hamutal', b, 'f', 66, 5);
    const joel = add('Joel', b, 'm', 46, 5, { mother: hamutal });
    const ester = add('Ester', b, 'f', 43, 5);
    core.wed(joel, ester);
    const debora = add('Débora', b, 'f', 18, 5, { father: joel, mother: ester });
    add('Abias', b, 'm', 12, 5, { father: joel, mother: ester });
    nata.spouseId = debora.id;
    debora.spouseId = nata.id;
    nata.engaged = debora.engaged = s.week - 4;
    const uziel = add('Uziel', c, 'm', 30, 8, { caravan: 1 });
    const dina = add('Diná', c, 'f', 27, 8, { caravan: 1 });
    core.wed(uziel, dina);
    add('Eli', c, 'm', 1, 8, { father: uziel, mother: dina, caravan: null });
    if (freeHouse) {
      const d = house(33, 0);
      d.emptyLevel = 3;
    }
    if (!core.place(s, 'field', 25, 27).ok) throw new Error('no field');
    if (!core.place(s, 'granary', 25, 30).ok) throw new Error('no granary');
    s.food = 120;
    core.refreshCity(s);
    g.refresh();
    if (window.view3d) {
      window.view3d.rig.set({ x: a.x + 1, z: a.y + 1 });
      return ids;
    }
    const w = window.iso.gridToWorld(a.x + 1, a.y + 1);
    window.game.cameras.main.setZoom(1);
    window.game.cameras.main.centerOn(w.x, w.y);
    return ids;
  }, freeHouse);
}

/** Opens the balloon of the building at (x, y) as a tap with Mover does, and waits for the camera to settle. */
async function openBalloon(page, x, y) {
  await page.evaluate(([x, y]) => {
    window.game.selectTool('view');
    window.game.selected = { x, y };
    window.game.refresh();
  }, [x, y]);
  await page.waitForTimeout(150);
  await page.waitForFunction(() => !window.game.pan, null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(150);
  assert(await page.evaluate(() => window.game.ui.view.inspector.open), `the balloon of ${x},${y} shows`);
}

/** Taps (touch) or clicks (mouse) a game point. */
const pressAt = async (page, tap, p) => {
  if (tap) await tap(p);
  else await page.mouse.click(...(await gameToPage(page, ...p)));
  await page.waitForTimeout(200);
};

/** Waits (up to 5 s, the machine may be slow) until a page condition holds; false if it never does. */
const until = (page, fn, arg) =>
  page
    .waitForFunction(fn, arg, { timeout: 5000 })
    .then(() => true)
    .catch(() => false);

/** The person rows of the open balloon: game rect and real height. */
const balloonChips = (page) =>
  page.evaluate(() => {
    const k = document.querySelector('canvas').getBoundingClientRect().width / 1280;
    const bl = window.game.ui.view.inspector.balloon;
    return bl.body.list
      .filter((o) => o.type === 'Container' && o.input)
      .map((o) => {
        const m = o.getWorldTransformMatrix();
        return { x: m.tx + o.width / 2, y: m.ty + o.height / 2, w: o.width, h: o.height, real: o.height * k, text: o.list.filter((t) => t.type === 'Text').map((t) => t.text) };
      });
  });

/** The open balloon stays on screen, beside (never over) its building. */
async function balloonFits(page, what) {
  const r = await page.evaluate(() => {
    const v = window.game.ui.view.inspector;
    const b = v.balloon.rect;
    const f = v.card.foot;
    const p = window.game.cellScreen(f.x, f.y, f.w, f.h);
    return { b, p, W: window.game.scale.width, H: window.game.scale.height };
  });
  assert(r.b.x >= 0 && r.b.y >= 0 && r.b.x + r.b.w <= r.W && r.b.y + r.b.h <= r.H, `${what}: the balloon is on screen (${JSON.stringify(r.b)})`);
  const over = r.p.x > r.b.x && r.p.x < r.b.x + r.b.w && r.p.y > r.b.y && r.p.y < r.b.y + r.b.h;
  assert(!over, `${what}: the balloon does not cover its building (${JSON.stringify(r)})`);
}

/** Balloon of a house with people: header, rows of 44 px (two columns on the phone), births line; an empty stone house. */
async function housePeople(page, suffix) {
  await startGame(page);
  const phone = !suffix.includes('pc');
  await setupPeople(page);
  await openBalloon(page, 22, 27);
  await balloonFits(page, 'mud house');
  const chips = await balloonChips(page);
  assert(chips.length === 4, `four people in the mud house (${chips.length})`);
  for (const c of chips) assert(c.real >= 43.9, `a person row is at least 44 real px (${c.real.toFixed(1)})`);
  const cols = new Set(chips.map((c) => Math.round(c.x))).size;
  assert(cols === (phone ? 2 : 1), `${phone ? 'two columns' : 'one column'} of people (${cols})`);
  assert((await minUiText(page)) >= 11.9, 'no text under 12 real px in the house balloon');
  const lines = await inspectorLines(page);
  assert(lines[0] === 'Casa de barro · 4/4 pessoas', `header with the people (${lines[0]})`);
  assert(lines.some((l) => l.includes('Sem filhos: casa cheia')), `births line (${lines})`);
  await shot(page, `house-people${suffix}`);
  // Stone house: five people, one of them an elder.
  await openBalloon(page, 22, 29);
  await balloonFits(page, 'stone house');
  await shot(page, `house-people-stone${suffix}`);
  // A big house with eight people: four rows on the phone, still on screen with its buttons.
  await page.evaluate(() => {
    const { state: s, core } = window;
    const b = s.grid[29 * s.cols + 22];
    b.level = 4;
    for (const [name, sex, age] of [['Sefatias', 'm', 9], ['Ada', 'f', 7], ['Zacarias', 'm', 3]]) {
      const p = core.addPerson(s, { sex, age, houseId: b.id, caravan: null, clan: 5 }, () => 0.5);
      p.name = name;
    }
    window.game.selected = null;
    window.game.refresh();
  });
  await openBalloon(page, 22, 29);
  await balloonFits(page, 'big house');
  const tools = await page.evaluate(() => {
    const v = window.game.ui.view;
    const r = v.inspector.balloon.rect;
    const btns = v.inspector.btns.map((b) => b.root.getWorldTransformMatrix().ty + b.h / 2);
    return { bottom: Math.max(r.y + r.h, ...btns), toolsTop: v.tools.top, left: r.x, toolsRight: v.tools.bottomRight };
  });
  assert(tools.left > tools.toolsRight || tools.bottom <= tools.toolsTop, `the big house balloon and its buttons stay above Mover, Rua and Demolir (${JSON.stringify(tools)})`);
  await shot(page, `house-people-big${suffix}`);
  // Empty stone house: what it waits for.
  await openBalloon(page, 22, 33);
  const empty = await page.evaluate(() => window.game.ui.view.inspector.card.lines[0].text);
  assert(empty.startsWith('Casa de pedra vazia'), `empty stone house (${empty})`);
  await shot(page, `house-people-empty${suffix}`);
}

/** The person sheet: from the balloon, to a relative and back (Voltar), then to the house (camera and balloon). */
async function personSheet(page, suffix) {
  await startGame(page);
  const phone = !suffix.includes('pc');
  const { tap } = phone ? await touchInput(page) : { tap: null };
  const ids = await setupPeople(page);
  await openBalloon(page, 22, 27);
  const chips = await balloonChips(page);
  const nata = chips.find((c) => c.text[0].startsWith('Natã'));
  assert(nata, `Natã is in the balloon (${chips.map((c) => c.text[0])})`);
  await pressAt(page, tap, [nata.x, nata.y]);
  const open = () => page.evaluate(() => window.game.ui.view.sheet.current);
  const shows = (id) => until(page, (id) => window.game.ui.view.sheet.current === id, id);
  assert(await shows(ids['Natã']), 'tapping a name opens the sheet');
  assert(!(await page.evaluate(() => window.game.ui.view.inspector.open)), 'the balloon closes under the sheet');
  const sheetFits = async (who) => {
    const fits = await page.evaluate(() => {
      const v = window.game.ui.view;
      const r = v.sheet.rect;
      return { r, toolsTop: v.tools.top, colX: v.column.rect.x };
    });
    assert(fits.r.y + fits.r.h <= fits.toolsTop && fits.r.x + fits.r.w <= fits.colX, `${who}: the sheet stays above the tools and left of the column (${JSON.stringify(fits)})`);
  };
  await sheetFits('Natã');
  assert((await minUiText(page)) >= 11.9, 'no text under 12 real px in the sheet');
  await shot(page, `person-sheet${suffix}`);
  // Parents first: Baruque, whose father died and whose son left.
  await pressAt(page, tap, await uiPoint(page, 'sheet-kin-0'));
  assert(await shows(ids['Baruque']), 'a parent button opens his sheet');
  const texts = await page.evaluate(() => window.game.ui.view.sheet.root.list.flatMap((o) => (o.type === 'Text' ? [o.text] : o.list ? o.list.filter((t) => t.type === 'Text').map((t) => t.text) : [])));
  assert(texts.some((t) => t.includes('Ezequias · † aos 71')), `the dead father is greyed with his age (${texts})`);
  assert(texts.some((t) => t.includes('Joás · foi embora no Ano 3')), `the son who left says when (${texts})`);
  await sheetFits('Baruque');
  assert((await minUiText(page)) >= 11.9, 'no text under 12 real px in the second sheet');
  await shot(page, `person-sheet-father${suffix}`);
  await pressAt(page, tap, await uiPoint(page, 'sheet-back'));
  assert(await shows(ids['Natã']), 'Voltar goes back to the sheet before');
  await pressAt(page, tap, await uiPoint(page, 'sheet-house'));
  assert(await shows(null), `the house button closes the sheet (${await open()})`);
  const sel = await page.evaluate(() => window.game.selected);
  assert(sel && sel.x === 22 && sel.y === 27, `the house button opens the balloon of the house (${JSON.stringify(sel)})`);
  await page.waitForTimeout(1200);
  await shot(page, `person-sheet-house${suffix}`);
}

/** Estatísticas, tab Povo; a family button goes to its house. */
async function statsPeople(page, suffix) {
  await startGame(page);
  const phone = !suffix.includes('pc');
  const { tap } = phone ? await touchInput(page) : { tap: null };
  await setupPeople(page);
  await page.evaluate(() => {
    const s = window.state;
    s.yearStats = { births: 2, deaths: 1, weddings: 1 };
    s.caravans.push({ week: s.week + 6, families: 3, warn: 6, status: 'announced', housed: 0, left: 0 });
    window.game.refresh();
  });
  await pressAt(page, tap, await uiPoint(page, 'side-stats'));
  await pressAt(page, tap, await uiPoint(page, 'stats-people'));
  const covers = await page.evaluate(() => {
    const v = window.game.ui.view;
    return v.panels.rect.y + v.panels.rect.h > v.tools.top || v.panels.rect.x + v.panels.rect.w > v.column.rect.x;
  });
  assert(!covers, 'the Povo tab does not cover the tools or the column');
  assert((await minUiText(page)) >= 11.9, 'no text under 12 real px in the Povo tab');
  await shot(page, `stats-people${suffix}`);
  await pressAt(page, tap, await uiPoint(page, 'family-0'));
  await until(page, () => window.game.ui.view.panels.open === null);
  const sel = await page.evaluate(() => [window.game.ui.view.panels.open, window.game.selected]);
  assert(sel[0] === null && sel[1] && sel[1].y === 29, `a family button closes the panel and opens its house (${JSON.stringify(sel)})`);
  await page.waitForTimeout(1200);
  await shot(page, `stats-people-house${suffix}`);
}

/** Melhorar on the granary balloon: gold with the next level, grey without silver, the top level; the build balloon says how far it goes. */
async function granaryUpgrade(page, suffix) {
  await startGame(page);
  const phone = !suffix.includes('pc');
  const { tap } = phone ? await touchInput(page) : { tap: null };
  await setupPeople(page);
  const action = () => page.evaluate(() => window.game.ui.view.inspector.card.action);
  const btn0 = () => page.evaluate(() => {
    const m = window.game.ui.view.inspector.btns[0].root.getWorldTransformMatrix();
    return [m.tx, m.ty];
  });
  await openBalloon(page, 25, 30);
  let a = await action();
  assert(a && a.label === 'Melhorar · 60 · 20 pedra' && !a.dim, `gold Melhorar with the cost (${JSON.stringify(a?.label)})`);
  const lines = await inspectorLines(page);
  assert(lines.some((l) => l.startsWith('Nível 2: guarda 600')), `the next level line (${lines})`);
  assert((await minUiText(page)) >= 11.9, 'no text under 12 real px in the granary balloon');
  await shot(page, `granary-upgrade${suffix}`);
  await pressAt(page, tap, await btn0());
  assert(await until(page, () => window.state.grid[30 * window.state.cols + 25].level === 2), 'Melhorar raises the granary');
  await page.evaluate(() => {
    window.state.silver = 20;
    window.game.refresh();
  });
  await page.waitForTimeout(150);
  a = await action();
  assert(a && a.dim && a.label === 'Falta prata: custa 100', `grey without the silver (${JSON.stringify(a)})`);
  await shot(page, `granary-upgrade-nosilver${suffix}`);
  await pressAt(page, tap, await btn0());
  const toasts = await page.evaluate(() => [...window.game.ui.view.toasts.list, ...window.game.ui.view.toasts.queue].map((t) => t.msg));
  assert(toasts.includes('Falta prata: custa 100'), `a tap says what is missing (${toasts})`);
  await page.evaluate(() => {
    window.state.grid[30 * window.state.cols + 25].level = 3;
    window.game.refresh();
  });
  await page.waitForTimeout(150);
  const top = await inspectorLines(page);
  assert(top.includes('Nível máximo') && !(await action()), `top level: no action (${top})`);
  await shot(page, `granary-upgrade-top${suffix}`);
  await page.evaluate(() => window.game.selectTool('granary'));
  await page.waitForTimeout(200);
  const build = await page.evaluate(() => window.game.ui.view.column.balloon.body.list.filter((o) => o.type === 'Text').map((o) => o.text));
  assert(build.includes('Guarda 300 · melhora até 1000'), `the build balloon says how far it goes (${build})`);
  await shot(page, `granary-upgrade-build${suffix}`);
}

/** A caravan announced: its toast, the Avisos line with the houses missing, the Povo tab line. */
async function caravanAnnounced(page, suffix) {
  await startGame(page);
  const phone = !suffix.includes('pc');
  const { tap } = phone ? await touchInput(page) : { tap: null };
  await page.waitForFunction(() => window.game?.ui?.view?.toasts.list.length === 0, null, { timeout: 90000 }); // the opening sentence goes away
  await setupPeople(page);
  await page.evaluate(() => {
    const s = window.state;
    const week = s.week + 6;
    s.caravans.push({ week, families: 3, warn: 6, status: 'announced', housed: 0, left: 0 });
    window.game.handleEvents([{ type: 'caravanAnnounced', families: 3, week }]);
    window.game.refresh();
  });
  await page.waitForTimeout(400);
  const notes = await page.evaluate(() => window.game.ui.view.list.map((n) => n.text));
  assert(notes.some((n) => n.startsWith('Caravana com 3 famílias em 6 semanas: faltam')), `the caravan warning (${notes})`);
  await shot(page, `caravan-announced${suffix}`);
  await pressAt(page, tap, await uiPoint(page, 'side-alerts'));
  assert((await minUiText(page)) >= 11.9, 'no text under 12 real px in Avisos');
  await shot(page, `caravan-announced-alerts${suffix}`);
}

/** An engaged couple with no empty house: the warning, then the countdown with their names. */
async function coupleWaiting(page, suffix) {
  await startGame(page);
  const phone = !suffix.includes('pc');
  const { tap } = phone ? await touchInput(page) : { tap: null };
  await page.waitForFunction(() => window.game?.ui?.view?.toasts.list.length === 0, null, { timeout: 90000 });
  await setupPeople(page, { freeHouse: false });
  let notes = await page.evaluate(() => window.game.ui.view.list.map((n) => n.text));
  assert(notes.includes('Casal esperando casa: construa uma casa'), `couple waiting (${notes})`);
  await page.waitForTimeout(400);
  await shot(page, `couple-waiting${suffix}`);
  await page.evaluate(() => {
    const s = window.state;
    for (const p of s.people) if (p.engaged !== null) p.engaged = s.week - window.core.RULES.people.coupleWaitWeeks + 8;
    window.game.refresh();
  });
  notes = await page.evaluate(() => window.game.ui.view.list.map((n) => n.text));
  assert(notes.includes('Natã e Débora vão embora em 8 semanas: falta casa'), `the couple leaving, by name (${notes})`);
  await pressAt(page, tap, await uiPoint(page, 'side-alerts'));
  await shot(page, `couple-waiting-leaving${suffix}`);
}

/** Phone tutorial: a burst of toasts stays above the tutorial bubble (they used to touch it). */
async function toastsOverTutorial(page) {
  await startGame(page, { tutorial: true });
  await page.evaluate(() => {
    for (const m of ['Primeira mensagem do teste', 'Segunda mensagem do teste', 'Terceira mensagem do teste']) window.game.ui.toast(m);
  });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const v = window.game.ui.view;
    const t = v.toasts;
    const bottom = Math.max(...t.list.map((o) => o.root.y + o.h / 2));
    return { bottom, bubble: v.tutorial.top };
  });
  assert(r.bubble !== null && r.bottom <= r.bubble - 2, `the toasts stay above the tutorial bubble (${JSON.stringify(r)})`);
  await shot(page, 'toasts-tutorial');
}

/**
 * The 3D button: the built town (every kind, service levels 2–3, an empty stone house, stumps and
 * people, a caravan family walking to the empty house) opens in 3D over the game; the game is paused and Phaser sleeps while it is open; by day,
 * at night and a snowy winter; "Voltar" (Esc on PC the second time) gives the speed and the 2D back.
 * Opened and closed twice.
 */
/**
 * The playable 3D from the 2D's 3D button: the same game goes on in 3D (the weeks run, the day
 * too), the HTML interface over it builds, and "2D" comes back to the same session.
 */
async function view3dScenario(page, suffix) {
  await startGame(page);
  await buildTown(page);
  await addWoodStone(page);
  await fillHouses(page);
  await page.evaluate(() => {
    const s = window.state;
    const at = (x, y) => s.grid[y * s.cols + x];
    at(18, 24).level = 3; // granary
    at(33, 25).level = 2; // workshop
    at(29, 25).level = 3; // market, rotated
    const empty = at(32, 29); // big house, now empty: keeps its level
    s.people = s.people.filter((p) => p.houseId !== empty.id);
    empty.level = 0;
    empty.emptyLevel = 4;
    window.core.refreshCity(s);
    // A caravan family (two parents, two children, a grandmother) walking from the entrance to the empty house.
    const rng = () => 0.5;
    const members = [['m', 32], ['f', 30], ['m', 7], ['f', 4], ['f', 68]].map(([sex, age]) => window.core.addPerson(s, { sex, age, houseId: null, caravan: 1, clan: 2 }, rng).id);
    window.core.sendWalking(s, window.core.startCell(s), [empty], members);
    const f = s.families[s.families.length - 1];
    f.step = Math.max(0, f.path.length - 10);
    s.silver = 900;
    window.game.refresh();
  });
  await setSpeed(page, 1);
  const phone = suffix === 'phone';
  const { tap } = phone ? await touchInput(page) : { tap: null };
  const press3d = async () => {
    const p = await uiPoint(page, 'side-3d');
    if (tap) await tap(p);
    else await page.mouse.click(...(await gameToPage(page, ...p)));
  };
  /** Taps (phone) or clicks (PC) a page point. */
  const hit = (x, y) => (phone ? cdpTapPage(page, x, y) : page.mouse.click(x, y));
  const spotOf = (sel) =>
    page.evaluate((sel) => {
      const b = document.querySelector(sel).getBoundingClientRect();
      return [b.x + b.width / 2, b.y + b.height / 2, b.width, b.height];
    }, sel);
  const look = async (o, name) => {
    await page.evaluate((o) => window.view3d.view(o), o);
    const f0 = await page.evaluate(() => window.view3d.frames);
    await page.waitForFunction((f0) => window.view3d.frames > f0 + 2, f0, { timeout: 60000 });
    await page.screenshot({ path: `${OUT}/${name}.png` });
  };
  for (const round of [1, 2]) {
    await press3d();
    await page.waitForFunction(() => window.view3d?.ready && window.view3d.frames > 3, null, { timeout: 180000 });
    const st = await page.evaluate(() => ({ attached: window.view3d.game.session === window.session, running: window.game.game.loop.running, canvases: document.querySelectorAll('canvas').length, label: window.view3d.info().label }));
    assert(st.attached, 'the 3D plays the same session as the 2D');
    assert(!st.running, 'the 2D loop sleeps while the 3D is open');
    assert(st.canvases === 2, `one 3D canvas over the game (${st.canvases})`);
    assert(/ · Ano \d+$/.test(st.label), `season and year label (${st.label})`);
    if (round === 1) {
      const inf = await page.evaluate(() => window.view3d.info());
      assert(inf.families === 1, `the caravan family walks home as a group (${inf.families})`);
      // The weeks go on in the 3D (other families may arrive meanwhile).
      const week = await page.evaluate(() => window.state.week);
      await page.waitForFunction((w) => window.state.week > w, week, { timeout: 60000 });
      await page.evaluate(() => window.session.setSpeed(0));
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/view3d-${suffix}.png` });
      // The 3D is turned like the 2D (the camera on the side the 2D looks from).
      const rot2d = await page.evaluate(() => window.iso.getRotation());
      const yawWant = Math.PI / 4 + (rot2d * Math.PI) / 2;
      assert(Math.abs(Math.atan2(Math.sin(inf.yaw - yawWant), Math.cos(inf.yaw - yawWant))) < 0.01, `the 3D turn matches the 2D rotation ${rot2d} (yaw ${inf.yaw})`);
      // Close on the family (and its donkey) on the road, then on the levelled services and the empty house.
      const home = await page.evaluate(() => ({ x: window.view3d.rig.focus.x, z: window.view3d.rig.focus.z }));
      await page.evaluate(() => {
        const f = window.state.families[0];
        const c = f.path[Math.min(f.path.length - 1, f.step + 3)];
        window.view3d.view({ pos: window.state.week + 0.3, day: 0.25 });
        window.view3d.rig.set({ yaw: 0.7, pitch: 0.6, dist: 6, x: c.x + 0.5, z: c.y + 0.5 });
      });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${OUT}/view3d-${suffix}-people.png` });
      await page.evaluate(() => window.view3d.rig.set({ yaw: -0.5, pitch: 0.75, dist: 16, x: 30, z: 27 }));
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/view3d-${suffix}-levels.png` });
      await page.evaluate(([home, yaw]) => window.view3d.rig.set({ yaw, pitch: 0.9, dist: 30, ...home }), [home, inf.yaw]);
      // The middle of the next summer and winter (looks only: the state's week is untouched).
      const mid = (season) =>
        page.evaluate((season) => {
          const { seasonOf, RULES } = window.core;
          let w = window.state.week;
          while (seasonOf(w) !== season) w++;
          return w + Math.floor(RULES.weeksPerSeason / 2) + 0.3;
        }, season);
      const summer = await mid('summer');
      await look({ pos: summer, day: 0.27 }, `view3d-${suffix}-day`);
      await look({ pos: summer, day: 0.72 }, `view3d-${suffix}-night`);
      await look({ pos: await mid('winter'), day: 0.3, force: { snow: true }, weather: { rain: 0.6, snowing: true, overcast: 0.8, wet: 0, puddles: 0, wind: 0.2 } }, `view3d-${suffix}-winter`);
      const labels = await page.evaluate(() => window.view3d.info().label);
      assert(labels.startsWith('Inverno'), `the label follows the season shown (${labels})`);
      await page.evaluate(() => window.view3d.view({ pos: window.state.week + 0.3, day: 0.25 }));

      // Build a house in 3D: pick Casa in the column, tap a free spot beside a road.
      const before = await page.evaluate(() => window.state.buildings.length);
      const b = await spotOf('[data-spot="build-house"]');
      assert(b[2] >= 44 && b[3] >= 40, `the Casa button is thumb-sized (${b[2]}x${b[3]})`);
      await hit(b[0], b[1]);
      await page.waitForFunction(() => window.session.tool === 'house', null, { timeout: 5000 }).catch(() => {});
      const picked = await page.evaluate((b) => ({ tool: window.session.tool, under: document.elementFromPoint(b[0], b[1])?.outerHTML.slice(0, 80) }), b);
      assert(picked.tool === 'house', `the Casa button picks Casa (${JSON.stringify({ ...picked, b })})`);
      const cell = await page.evaluate(() => {
        const s = window.state;
        for (let y = 20; y < 36; y++)
          for (let x = 14; x < 40; x++) if (window.core.checkPlace(s, 'house', x, y).ok && !window.core.onlyNeedsRoad(s, 'house', x, y)) return { x, y };
        return null;
      });
      assert(cell, 'a free house spot beside a road');
      // Picking a building may glide the camera to a suggested spot: stop it before aiming.
      await page.evaluate((c) => {
        window.view3d.game.stopGlide();
        window.view3d.rig.set({ dist: 18, x: c.x + 0.5, z: c.y + 0.5 });
      }, cell);
      await page.waitForTimeout(500);
      const p = await page.evaluate((c) => window.view3d.cellPoint(c.x, c.y), cell);
      if (!phone) {
        await page.mouse.move(p.x, p.y);
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${OUT}/view3d-${suffix}-ghost.png` });
      }
      // A single building on touch is aimed 90 px above the finger (the finger does not hide it).
      await hit(p.x, p.y + (phone ? 90 : 0));
      await page.waitForFunction((n) => window.state.buildings.length > n, before, { timeout: 5000 }).catch(() => {});
      const built = await page.evaluate(([n, p]) => ({ added: window.state.buildings.length - n, tool: window.session.tool, hover: window.session.hover, at: window.view3d.cellAt(p.x, p.y), under: document.elementFromPoint(p.x, p.y)?.tagName }), [before, p]);
      assert(built.added > 0, `a tap builds the house (${JSON.stringify({ ...built, cell, p })})`);
      assert(await page.evaluate((c) => window.state.grid[c.y * window.state.cols + c.x]?.kind === 'house', cell), 'the house stands on the aimed cell');
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${OUT}/view3d-${suffix}-built.png` });

      // Mover, then a tap on the house: its balloon (Demolir) points at it.
      const mover = await spotOf('[data-spot="tool-view"]');
      await hit(mover[0], mover[1]);
      await page.waitForFunction(() => window.session.tool === 'view', null, { timeout: 5000 }).catch(() => {});
      assert((await page.evaluate(() => window.session.tool)) === 'view', `Mover is picked (${await page.evaluate(() => window.session.tool)})`);
      const q = await page.evaluate((c) => window.view3d.cellPoint(c.x, c.y), cell);
      await hit(q.x, q.y);
      await page.waitForFunction(() => window.session.selected && !document.querySelector('.balloon').classList.contains('hidden'), null, { timeout: 5000 }).catch(() => {});
      const sel = await page.evaluate(([x, y]) => ({ selected: window.session.selected, at: window.view3d.cellAt(x, y), balloon: !document.querySelector('.balloon').classList.contains('hidden') }), [q.x, q.y]);
      assert(sel.selected && sel.balloon, `a tap on the house opens its balloon (${JSON.stringify({ ...sel, cell, q })})`);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/view3d-${suffix}-balloon.png` });
      await page.evaluate(() => window.session.deselect());

      // Turn with the button and zoom in on the town.
      const turn = await spotOf('[aria-label="Girar para a esquerda"]');
      await hit(turn[0], turn[1]);
      await page.evaluate(() => window.view3d.rig.set({ dist: 14 }));
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/view3d-${suffix}-close.png` });
      await page.evaluate(() => window.session.setSpeed(1));
    }
    // "2D" comes back to the same game, at the speed it runs at.
    const r = await spotOf('[data-spot="exit3d"]');
    assert(r[2] >= 44 && r[3] >= 44, `the 2D button is thumb-sized (${r[2]}x${r[3]})`);
    await hit(r[0], r[1]);
    await page.waitForFunction(() => !window.view3d && !document.querySelector('.g3d'), null, { timeout: 20000 });
    await page.waitForTimeout(400);
    const back = await page.evaluate(() => ({ speed: window.game.speed, running: window.game.game.loop.running, canvases: document.querySelectorAll('canvas').length }));
    assert(back.speed === 1, `the game keeps its speed (${back.speed})`);
    assert(back.running, 'the 2D loop runs again');
    assert(back.canvases === 1, `the 3D canvas is gone (${back.canvases})`);
  }
  await shot(page, `view3d-${suffix}-back`);
}

/**
 * The 3D game on its own (`?view=3d`): no Phaser at all, the HTML interface over the map, the
 * tutorial's first step and its marked road, and a road pulled by drag along the marked cells.
 */
async function play3dScenario(page, suffix) {
  const phone = suffix === 'phone';
  await page.goto(`${URL.replace(/\?.*$/, '')}?view=3d&seed=7`, { timeout: 90000 });
  // The HTML title screen first: Começar (no "Rever o tutorial" before the first game).
  await page.waitForSelector('[data-spot="start"]', { timeout: 60000 });
  assert(!(await page.$('[data-spot="tutorial-again"]')), 'no "Rever o tutorial" before the tutorial was seen');
  await page.screenshot({ path: `${OUT}/play3d-${suffix}-title.png` });
  const startBtn = await page.evaluate(() => {
    const b = document.querySelector('[data-spot="start"]').getBoundingClientRect();
    return [b.x + b.width / 2, b.y + b.height / 2, b.width, b.height];
  });
  assert(startBtn[3] >= 44, `Começar is thumb-sized (${startBtn[2]}x${startBtn[3]})`);
  if (phone) await cdpTapPage(page, startBtn[0], startBtn[1]);
  else await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.view3d?.ready && window.view3d.frames > 3 && window.session, null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const st = await page.evaluate(() => ({ phaser: !!window.Phaser || !!window.game?.scene || performance.getEntriesByType('resource').some((e) => /phaser/i.test(e.name)), canvases: document.querySelectorAll('canvas').length, form: document.querySelector('#hud').dataset.form, tutorial: !document.querySelector('.tutorial').classList.contains('hidden') }));
  assert(!st.phaser, 'the 3D game loads no Phaser');
  assert(st.canvases === 1, `one canvas (${st.canvases})`);
  assert(st.form === (phone ? 'phone' : 'pc'), `the interface is laid out for the ${suffix} (${st.form})`);
  assert(st.tutorial, 'the first game opens the tutorial');
  await page.screenshot({ path: `${OUT}/play3d-${suffix}.png` });
  // Nothing of the interface spills off the screen.
  const out = await page.evaluate(() =>
    [...document.querySelectorAll('#hud .pill, #hud button')].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width && (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) && !e.closest('.column');
    }).map((e) => e.textContent),
  );
  assert(!out.length, `the interface fits the screen (${out.join(' | ')})`);
  // The tutorial road step: Rua, then drag along the marked road.
  await page.evaluate(() => window.session.selectTool('road'));
  const cells = await page.evaluate(() => window.session.guideGhost.filter((c) => !window.state.roads[c.y * window.state.cols + c.x]).slice(0, 4));
  assert(cells.length >= 2, `a marked road to pull (${cells.length})`);
  await page.evaluate((c) => window.view3d.rig.set({ dist: 16, x: c.x + 0.5, z: c.y + 0.5 }), cells[1]);
  await page.waitForTimeout(600);
  const pts = await page.evaluate((cells) => cells.map((c) => window.view3d.cellPoint(c.x, c.y)), cells);
  const roads = () => page.evaluate(() => window.state.roads.filter(Boolean).length);
  const before = await roads();
  if (phone) {
    const cdp = await page.context().newCDPSession(page);
    const t = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y, id: 0 }] : [] });
    await t('touchStart', pts[0]);
    await page.waitForTimeout(220);
    for (const p of pts.slice(1)) {
      await t('touchMove', p);
      await page.waitForTimeout(80);
    }
    await t('touchEnd');
  } else {
    await page.mouse.move(pts[0].x, pts[0].y);
    await page.mouse.down();
    for (const p of pts.slice(1)) await page.mouse.move(p.x, p.y, { steps: 4 });
    await page.mouse.up();
  }
  await page.waitForFunction((n) => window.state.roads.filter(Boolean).length > n, before, { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/play3d-${suffix}-road.png` });
  assert((await roads()) >= before + pts.length - 1, `the drag built the road (${before} → ${await roads()})`);

  // The gear: day and night on and off (always midday when off), and the map choice.
  const hitSpot = async (spot) => {
    const r = await page.evaluate((spot) => {
      const b = document.querySelector(`[data-spot="${spot}"]`).getBoundingClientRect();
      return [b.x + b.width / 2, b.y + b.height / 2];
    }, spot);
    if (phone) await cdpTapPage(page, r[0], r[1]);
    else await page.mouse.click(r[0], r[1]);
  };
  await hitSpot('settings');
  await page.waitForSelector('.settings:not(.hidden)', { timeout: 5000 });
  const day0 = await page.evaluate(() => JSON.parse(localStorage.getItem('jerusalem-antiga.settings') ?? '{}').dayNight ?? true);
  await hitSpot('set-daynight');
  const day1 = await page.evaluate(() => JSON.parse(localStorage.getItem('jerusalem-antiga.settings')).dayNight);
  assert(day1 === !day0, `the gear switches day and night (${day0} → ${day1})`);
  await page.screenshot({ path: `${OUT}/play3d-${suffix}-settings.png` });
  await hitSpot('set-daynight');
  if (phone) await hitSpot('settings');
  else await page.keyboard.press('Escape');
  await page.waitForSelector('.settings.hidden', { state: 'attached', timeout: 5000 });
}

/** Opens the 3D game on its own and leaves the title screen (tutorial marked as seen). */
async function open3dGame(page, seed = 7) {
  await page.addInitScript(() => localStorage.setItem('jerusalem.tutorialDone', '1'));
  await page.goto(`${URL.replace(/\?.*$/, '')}?view=3d&seed=${seed}`, { timeout: 90000 });
  await page.waitForSelector('[data-spot="start"]', { timeout: 60000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.view3d?.ready && window.view3d.frames > 3 && window.session, null, { timeout: 180000 });
  await page.evaluate(() => window.session.setSpeed(0));
}

/** The 3D camera on PC: WASD moves, Q/E turn a quarter, the wheel zooms about the cursor, the right button drags the map, Space and digits pick speed and tools. */
async function input3dScenario(page) {
  await open3dGame(page);
  const cam = () => page.evaluate(() => ({ x: window.view3d.rig.focus.x, z: window.view3d.rig.focus.z, yaw: window.view3d.rig.heading, zoom: window.view3d.rig.zoom }));
  const c0 = await cam();
  await page.mouse.move(600, 380);
  for (let k = 0; k < 4; k++) await page.keyboard.press('d');
  const c1 = await cam();
  assert(Math.hypot(c1.x - c0.x, c1.z - c0.z) > 1, `D moves the camera (${JSON.stringify([c0, c1])})`);
  await page.keyboard.press('q');
  await page.waitForTimeout(800);
  const c2 = await cam();
  assert(Math.abs(Math.abs(c2.yaw - c1.yaw) - Math.PI / 2) < 0.01, `Q turns a quarter (${c1.yaw} → ${c2.yaw})`);
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(300);
  const c3 = await cam();
  assert(c3.zoom > c2.zoom, `the wheel zooms in (${c2.zoom} → ${c3.zoom})`);
  await page.mouse.move(600, 380);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(700, 420, { steps: 5 });
  await page.mouse.up({ button: 'right' });
  const c4 = await cam();
  assert(Math.hypot(c4.x - c3.x, c4.z - c3.z) > 0.5, 'the right button drags the map');
  await page.keyboard.press('2');
  assert((await page.evaluate(() => window.session.tool)) === 'road', '2 picks Rua');
  await page.keyboard.press('Escape');
  assert((await page.evaluate(() => window.session.tool)) === 'view', 'Esc goes back to Mover');
  await page.keyboard.press(' ');
  assert((await page.evaluate(() => window.session.speed)) !== 0, 'Space changes the speed');
  await page.screenshot({ path: `${OUT}/input3d-pc.png` });
}

/** The 3D on touch: a pinch zooms and never builds, a two-finger twist turns, one finger with Mover moves the map. */
async function touch3dScenario(page) {
  await open3dGame(page);
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  const cam = () => page.evaluate(() => ({ x: window.view3d.rig.focus.x, z: window.view3d.rig.focus.z, yaw: window.view3d.rig.heading, zoom: window.view3d.rig.zoom }));
  // One finger with Mover moves the map.
  const c0 = await cam();
  await touch('touchStart', [[420, 200]]);
  for (let k = 1; k <= 5; k++) await touch('touchMove', [[420 - k * 20, 200]]);
  await touch('touchEnd', []);
  const c1 = await cam();
  assert(Math.hypot(c1.x - c0.x, c1.z - c0.z) > 0.5, 'one finger with Mover moves the map');
  // With Rua in hand, a pinch zooms and builds nothing.
  await page.evaluate(() => window.session.selectTool('road'));
  const roads = () => page.evaluate(() => window.state.roads.filter(Boolean).length);
  const r0 = await roads();
  await touch('touchStart', [[380, 200], [460, 200]]);
  for (let k = 1; k <= 6; k++) {
    await touch('touchMove', [[380 - k * 15, 200], [460 + k * 15, 200]]);
    await page.waitForTimeout(40);
  }
  await touch('touchEnd', []);
  const c2 = await cam();
  assert(c2.zoom > c1.zoom * 1.3, `a pinch zooms in (${c1.zoom} → ${c2.zoom})`);
  assert((await roads()) === r0, 'a pinch with Rua builds no road');
  // A two-finger twist turns the map.
  await touch('touchStart', [[380, 200], [460, 200]]);
  for (let k = 1; k <= 6; k++) {
    const a = (k * Math.PI) / 24;
    await touch('touchMove', [[420 - 40 * Math.cos(a), 200 - 40 * Math.sin(a)], [420 + 40 * Math.cos(a), 200 + 40 * Math.sin(a)]]);
    await page.waitForTimeout(40);
  }
  await touch('touchEnd', []);
  const c3 = await cam();
  assert(Math.abs(c3.yaw - c2.yaw) > 0.3, `a twist turns the map (${c2.yaw} → ${c3.yaw})`);
  assert((await roads()) === r0, 'a twist with Rua builds no road');
  await page.screenshot({ path: `${OUT}/touch3d.png` });
}

/**
 * The full 3D interface (phase 2): the house balloon with its people (two columns on the phone),
 * the person sheet and Voltar, Objetivos, Avisos with its selo, Estatísticas and its three tabs, the
 * chosen building's balloon, problem balloons over the buildings and the famine tone. No text under
 * 12 px; the balloon never covers the controls.
 */
async function ui3dScenario(page, name) {
  await open3dGame(page);
  const phone = name !== 'pc';
  const ids = await setupPeople(page);
  await page.evaluate(() => window.session.setSpeed(0));
  const minText = () =>
    page.evaluate(() => {
      let min = 99;
      for (const el of document.querySelectorAll('#hud *')) {
        const r = el.getBoundingClientRect();
        if (!r.width || el.closest('.hidden') || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        min = Math.min(min, parseFloat(getComputedStyle(el).fontSize));
      }
      return min;
    });
  const inFree = () =>
    page.evaluate(() => {
      const b = document.querySelector('.balloon').getBoundingClientRect();
      const col = document.querySelector('nav.column').getBoundingClientRect();
      const side = document.querySelector('nav.side').getBoundingClientRect();
      const tools = document.querySelector('nav.tools').getBoundingClientRect();
      const r = (x) => [x.left, x.top, x.right, x.bottom].map(Math.round);
      return { ok: b.right <= col.left + 1 && b.left >= side.right - 1 && b.bottom <= tools.top + 1, b: r(b), col: r(col), side: r(side), tools: r(tools), free: window.view3d.game.hud.free };
    });
  // A panel or the sheet never covers the controls.
  const clear = (sel) =>
    page.evaluate((sel) => {
      const a = document.querySelector(sel).getBoundingClientRect();
      const hit = (b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
      return ['header.top', 'nav.side', 'nav.tools', 'nav.column'].filter((g) => [...document.querySelectorAll(`${g} button, ${g} .pill, ${g} .level`)].some((e) => hit(e.getBoundingClientRect())));
    }, sel);
  let t0 = Date.now();
  const lap = (what) => {
    if (process.env.VISUAL_TIMING) console.log(`  ${what}: ${Date.now() - t0} ms`);
    t0 = Date.now();
  };
  // The people of the food buildings: a carrier walks from the field (it harvests out of winter).
  await page.evaluate(() => {
    window.view3d.rig.set({ x: 25, z: 28.5, dist: 9 });
    window.session.setSpeed(1);
  });
  await page.waitForFunction(() => window.view3d.info().haulers > 0, null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const haulers = await page.evaluate(() => window.view3d.info().haulers);
  await page.screenshot({ path: `${OUT}/ui3d-${name}-haulers.png` });
  assert(haulers >= 1, `a harvest carrier walks from the field (${haulers})`);
  await page.evaluate(() => {
    window.session.setSpeed(0);
    window.view3d.rig.set({ x: 23, z: 28, dist: 34 });
  });
  // The mud house: its four people, in two columns on the phone.
  await page.evaluate(() => {
    const b = window.state.grid[27 * window.state.cols + 22];
    window.session.selectHouse(b.id);
  });
  await page.waitForTimeout(400);
  const chips = await page.evaluate(() => [...document.querySelectorAll('.balloon .chip')].map((c) => c.getBoundingClientRect()).map((r) => ({ x: Math.round(r.left), h: r.height })));
  assert(chips.length === 4, `four people in the mud house (${chips.length})`);
  assert(new Set(chips.map((c) => c.x)).size === (phone ? 2 : 1), `${phone ? 'two columns' : 'one column'} of people`);
  assert(chips.every((c) => c.h >= 44), 'person rows of 44 px or more');
  const head = await page.evaluate(() => document.querySelector('.balloon .line.big').textContent);
  assert(head === 'Casa de barro · 4/4 pessoas', `the house head (${head})`);
  await page.screenshot({ path: `${OUT}/ui3d-${name}-house.png` });
  const fits = await inFree();
  assert(fits.ok, `the balloon stays in the map's free area ${JSON.stringify(fits)}`);
  assert((await minText()) >= 12, 'no text under 12 px with the house balloon');
  // A person's sheet, then a relative's, then Voltar.
  await page.click('.balloon .chip >> nth=1');
  await page.waitForSelector('.sheet:not(.hidden)');
  const title = await page.evaluate(() => document.querySelector('.sheet .line.big').textContent);
  assert(title.startsWith('Ana') || title.length > 0, `the sheet opens (${title})`);
  await page.screenshot({ path: `${OUT}/ui3d-${name}-sheet.png` });
  lap('house and sheet');
  const sheetOver = await clear('.sheet');
  assert(sheetOver.length === 0, `the sheet covers ${sheetOver}`);
  const kin = await page.$('.sheet .kin .chip[data-person]');
  if (kin) {
    await kin.click();
    await page.waitForTimeout(200);
    assert((await page.evaluate(() => document.querySelector('[data-spot="sheet-back"]').textContent)) === 'Voltar', 'a relative\'s sheet offers Voltar');
    await page.click('[data-spot="sheet-back"]');
  }
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  assert(await page.evaluate(() => document.querySelector('.sheet').classList.contains('hidden')), 'Esc closes the sheet');
  // The panels.
  await page.click('[data-spot="panel-goals"]');
  await page.waitForSelector('.panelbox:not(.hidden):not(.sheet)');
  assert((await page.evaluate(() => document.querySelector('.panelbox:not(.sheet) .pline .big').textContent)) === 'Objetivos', 'Objetivos opens');
  assert((await minText()) >= 12, 'no text under 12 px in Objetivos');
  await page.screenshot({ path: `${OUT}/ui3d-${name}-goals.png` });
  lap('goals');
  const goalsOver = await clear('.panelbox:not(.sheet)');
  assert(goalsOver.length === 0, `Objetivos covers ${goalsOver}`);
  await page.click('[data-spot="panel-alerts"]');
  await page.waitForTimeout(150);
  const badge = await page.evaluate(() => ({ shown: !document.querySelector('.badge').classList.contains('hidden'), n: document.querySelector('.badge').textContent, lines: document.querySelectorAll('.panelbox:not(.sheet) .pline').length }));
  assert(badge.lines >= 2, `Avisos lists the warnings (${JSON.stringify(badge)})`);
  await page.screenshot({ path: `${OUT}/ui3d-${name}-alerts.png` });
  await page.click('[data-spot="panel-stats"]');
  for (const tab of ['now', 'people', 'history']) {
    await page.click(`[data-spot="tab-${tab}"]`);
    await page.waitForTimeout(150);
    assert((await minText()) >= 12, `no text under 12 px in Estatísticas (${tab})`);
    await page.screenshot({ path: `${OUT}/ui3d-${name}-stats-${tab}.png` });
    const over = await clear('.panelbox:not(.sheet)');
    assert(over.length === 0, `Estatísticas (${tab}) covers ${over}`);
  }
  lap('stats');
  // A family of the Povo tab goes to its house.
  await page.click('[data-spot="tab-people"]');
  await page.click('.panelbox .chip.family >> nth=0');
  await page.waitForTimeout(300);
  assert(await page.evaluate(() => document.querySelector('.panelbox:not(.sheet)').classList.contains('hidden') && !!window.session.selected), 'a family opens its house');
  await page.keyboard.press('Escape');
  // The chosen building's balloon.
  await page.evaluate(() => window.session.selectTool('plaza'));
  await page.waitForTimeout(200);
  const tip = await page.evaluate(() => ({ shown: !document.querySelector('.toolballoon').classList.contains('hidden'), text: document.querySelector('.toolballoon').textContent }));
  assert(tip.shown && tip.text.startsWith('Praça') && tip.text.includes('prata'), `the chosen building's balloon (${tip.text})`);
  await page.screenshot({ path: `${OUT}/ui3d-${name}-tool.png` });
  lap('panels to tool');
  // The preview pill: what a gatherer would bring there (or that it brings nothing off the road),
  // and with Demolir the silver to cut a tree.
  const pill = (tool, cell) =>
    page.evaluate(([tool, cell]) => {
      window.session.selectTool(tool);
      window.session.setHover(cell);
      window.session.refresh();
      return new Promise((ok) => setTimeout(() => {
        const t = document.querySelector('.tag');
        ok({ shown: !t.classList.contains('hidden'), text: t.textContent, bad: t.classList.contains('bad') });
      }, 250));
    }, [tool, cell]);
  const far = await pill('gatherer', { x: 4, y: 4 });
  assert(far.shown && far.bad && far.text.startsWith('Sem rua'), `a gatherer off the road says it brings nothing (${JSON.stringify(far)})`);
  const tree = await page.evaluate(() => {
    const s = window.state;
    for (let i = 0; i < s.feature.length; i++) if ((s.feature[i] === 'olive' || s.feature[i] === 'palm') && !s.grid[i] && !s.roads[i]) return { x: i % s.cols, y: Math.floor(i / s.cols) };
    return null;
  });
  if (tree) {
    const cut = await pill('clear', tree);
    assert(cut.shown && cut.text.startsWith('Cortar árvore'), `Demolir on a tree tells its price (${JSON.stringify(cut)})`);
  }
  const near = await page.evaluate(() => {
    const s = window.state;
    for (let y = 2; y < s.rows - 2; y++)
      for (let x = 2; x < s.cols - 2; x++)
        if (window.core.checkPlace(s, 'gatherer', x, y).ok && window.core.borderCells(s, { x, y, w: 2, h: 2 }).some((c) => s.network[window.core.indexOf(s, c.x, c.y)])) return { x, y };
    return null;
  });
  const yields = await pill('gatherer', near);
  assert(yields.shown && yields.text.startsWith('Rende'), `a gatherer by the road says what it brings (${JSON.stringify(yields)})`);
  await page.evaluate((c) => window.view3d.rig.set({ x: c.x + 0.5, z: c.y + 0.5 }), near);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/ui3d-${name}-pill.png` });
  await page.evaluate(() => {
    window.session.setHover(null);
    window.session.selectTool('view');
    window.view3d.rig.set({ x: 23, z: 29 });
  });
  // Problem balloons: a building off the road shows the road icon; famine tints the map.
  await page.evaluate(() => {
    const { state: s, core } = window;
    s.silver = 500;
    core.place(s, 'fisher', 3, 3);
    s.famine = true;
    core.refreshCity(s);
    window.session.refresh();
  });
  await page.waitForTimeout(200);
  const marks = await page.evaluate(() => ({ road: document.querySelectorAll('.need[data-need="road"]').length, famine: document.querySelector('.famine').classList.contains('on') }));
  assert(marks.road >= 1 && marks.famine, `problem balloons and the famine tone (${JSON.stringify(marks)})`);
  await page.screenshot({ path: `${OUT}/ui3d-${name}-problems.png` });
  // From far they shrink (never under 60%).
  const sizes = await page.evaluate(async () => {
    // The camera on the fisher off the road at each zoom (balloons off the free map hide).
    const shown = () => [...document.querySelectorAll('.need')].filter((e) => e.style.visibility !== 'hidden');
    const w = () => Math.max(0, ...shown().map((e) => e.getBoundingClientRect().width));
    const r = window.view3d.rig;
    const at = async (zoom) => {
      r.zoomAt(innerWidth / 2, innerHeight / 2, zoom);
      r.set({ x: 3.5, z: 3.5 });
      await new Promise((ok) => setTimeout(ok, 250));
      return w();
    };
    const near = await at(3);
    const far = await at(0.5);
    r.zoomAt(innerWidth / 2, innerHeight / 2, 1);
    return { near, far };
  });
  assert(sizes.far < sizes.near * 0.75 && sizes.far >= sizes.near * 0.55, `problem balloons smaller from far (${JSON.stringify(sizes)})`);
  lap('problems');
  void ids;
}

/**
 * The whole tutorial in the 3D game, as a new player plays it: real taps or clicks on the buttons
 * and on the map (single buildings aimed 90 px above the finger on touch), a drag along the marked
 * road. Each step: the arrow points at the step's button, then at its place; the camera brings the
 * place onto the free map; the preview pill says what it yields or serves.
 */
async function tutorial3dScenario(page, name) {
  const phone = name === 'phone';
  await page.goto(`${URL.replace(/\?.*$/, '')}?view=3d&seed=7`, { timeout: 90000 });
  await page.waitForSelector('[data-spot="start"]', { timeout: 60000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.view3d?.ready && window.view3d.frames > 3 && window.session, null, { timeout: 180000 });
  await page.evaluate(() => window.session.setSpeed(0));
  await page.waitForTimeout(600);
  const shotStep = (step) => page.screenshot({ path: `${OUT}/tutorial3d-${name}-${step}.png` });
  const step = () => page.evaluate(() => window.session.guide?.step?.id ?? null);
  const settle = async () => {
    await page.waitForFunction(() => !window.view3d.game.scene.glide, null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(250);
  };
  const tap = async (x, y) => {
    if (phone) await cdpTapPage(page, x, y);
    else {
      await page.mouse.click(x, y);
      await page.waitForTimeout(150);
    }
  };
  const tapSpot = async (spot) => {
    const r = await page.evaluate((spot) => {
      const b = document.querySelector(`[data-spot="${spot}"]`).getBoundingClientRect();
      return [b.x + b.width / 2, b.y + b.height / 2];
    }, spot);
    await tap(r[0], r[1]);
  };
  /** The cell a tap must hit for a building to take the rect (the hover is its centre cell). */
  const aimOf = (r) => ({ x: r.x + Math.floor((r.w - 1) / 2), y: r.y + Math.floor((r.h - 1) / 2) });
  /** The step's place is on the free map: not under the interface, the bubble or a toast. */
  const inView = async (label) => {
    await settle();
    const r = await page.evaluate((phone) => {
      const at = window.session.stepSpot(window.session.guide.step.id);
      if (!at) return null;
      const c = { x: at.x + Math.floor((at.w - 1) / 2), y: at.y + Math.floor((at.h - 1) / 2) };
      const p = window.view3d.cellPoint(c.x, c.y);
      const pts = [[p.x, p.y], ...(phone && at.w * at.h <= 9 ? [[p.x, p.y + 90]] : [])];
      const canvas = document.querySelector('.g3d canvas');
      const bad = pts.filter(([x, y]) => x < 0 || y < 0 || x > innerWidth || y > innerHeight || document.elementFromPoint(x, y) !== canvas).map(([x, y]) => [Math.round(x), Math.round(y), document.elementFromPoint(x, y)?.className]);
      return { p: [Math.round(p.x), Math.round(p.y)], bad, fp: window.view3d.game.hud.focusPoint(90) };
    }, phone);
    assert(r && r.bad.length === 0, `the ${label} place is on the free map after the camera glides (${JSON.stringify(r)})`);
  };
  /** The tutorial arrow shows, near a button (by its spot) or over the map. */
  const arrowAt = (spot) =>
    page.evaluate((spot) => {
      const a = document.querySelector('.arrow');
      if (a.classList.contains('hidden')) return { shown: false };
      const r = a.getBoundingClientRect();
      if (!spot) return { shown: true };
      // How far the arrow's centre is from the button's edge (0 over it).
      const b = document.querySelector(`[data-spot="${spot}"]`).getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = Math.hypot(Math.max(b.left - cx, 0, cx - b.right), Math.max(b.top - cy, 0, cy - b.bottom));
      return { shown: true, d: Math.round(d) };
    }, spot);
  const pill = async () => {
    await page.waitForFunction(() => !document.querySelector('.tag').classList.contains('hidden'), null, { timeout: 3000 }).catch(() => {});
    return page.evaluate(() => {
      const t = document.querySelector('.tag');
      return t.classList.contains('hidden') ? '' : t.textContent;
    });
  };
  /** Taps the map at the rect's aim cell (90 px lower on touch: the aim is above the finger). */
  const build = async (r) => {
    await settle();
    const c = aimOf(r);
    const p = await page.evaluate((c) => window.view3d.cellPoint(c.x, c.y), c);
    const n = await page.evaluate(() => window.state.buildings.length);
    await tap(p.x, p.y + (phone ? 90 : 0));
    await page.waitForFunction((n) => window.state.buildings.length > n, n, { timeout: 5000 }).catch(() => {});
    return page.evaluate(([n, c]) => ({ added: window.state.buildings.length - n, at: window.state.grid[c.y * window.state.cols + c.x]?.kind ?? null, tool: window.session.tool, silver: window.state.silver }), [n, c]);
  };
  const hoverAt = async (r) => {
    await settle();
    await page.evaluate((c) => {
      window.session.setHover(c);
      window.session.refresh();
    }, aimOf(r));
    await page.waitForTimeout(250);
  };

  const opening = await page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent));
  assert(opening.some((m) => m.startsWith('A caravana chegou com')), `the caravan sentence opens the game (${opening})`);
  assert(!(await page.evaluate(() => document.querySelector('.tutorial').classList.contains('hidden'))), 'the tutorial bubble shows');

  // 1. Road along the marked road; the clock stands still on build steps.
  assert((await step()) === 'road', `the tutorial starts with the road (${await step()})`);
  await page.evaluate(() => window.session.setSpeed(3));
  const week0 = await page.evaluate(() => window.state.week);
  await page.waitForTimeout(1500);
  assert((await page.evaluate(() => window.state.week)) === week0, 'the clock stands still on a build step');
  await page.evaluate(() => window.session.setSpeed(0));
  await inView('road');
  const toRua = await arrowAt('tool-road');
  assert(toRua.shown && toRua.d < 50, `the arrow points at Rua (${JSON.stringify(toRua)})`);
  await shotStep('1-road');
  await tapSpot('tool-road');
  assert((await page.evaluate(() => window.session.tool)) === 'road', 'the Rua button picks the road');
  assert((await arrowAt(null)).shown, 'then the arrow points at the marked road');
  const ghost = await page.evaluate(() => window.session.guideGhost.map((c) => ({ x: c.x, y: c.y })));
  assert(ghost.length >= 2, `a marked road (${ghost.length})`);
  const pts = await page.evaluate((g) => g.map((c) => window.view3d.cellPoint(c.x, c.y)), ghost);
  if (phone) {
    const cdp = await page.context().newCDPSession(page);
    const t = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y, id: 0 }] : [] });
    await t('touchStart', pts[0]);
    await page.waitForTimeout(220);
    for (const p of pts.slice(1)) {
      await t('touchMove', p);
      await page.waitForTimeout(60);
    }
    await t('touchEnd');
  } else {
    await page.mouse.move(pts[0].x, pts[0].y);
    await page.mouse.down();
    for (const p of pts.slice(1)) await page.mouse.move(p.x, p.y, { steps: 3 });
    await page.mouse.up();
  }
  await page.waitForFunction(() => window.session.guide?.step?.id !== 'road', null, { timeout: 8000 }).catch(() => {});
  const built = await page.evaluate((g) => g.map((c) => (window.state.roads[c.y * window.state.cols + c.x] ? 1 : 0)).join(''), ghost);
  assert((await step()) === 'gather', `dragging the marked road ends step 1 (built ${built})`);

  // 2. Fisher or gatherer at the end of the road.
  await inView('gather');
  const spot = await page.evaluate(() => window.session.spot);
  assert(spot && spot.food >= 1.2, `the road leads to a spot that brings food (${JSON.stringify(spot)})`);
  const toCol = await arrowAt(`build-${spot.kind}`);
  assert(toCol.shown && toCol.d < 50, `the arrow points at the ${spot.kind} button (${JSON.stringify(toCol)})`);
  await shotStep('2-gather');
  await tapSpot(`build-${spot.kind}`);
  assert((await page.evaluate(() => window.session.tool)) === spot.kind, `the column picks the ${spot.kind}`);
  const gatherRect = await page.evaluate(() => window.session.stepSpot('gather'));
  await hoverAt(gatherRect);
  const yields = await pill();
  assert(yields.startsWith('Rende'), `the preview says what it yields (${yields})`);
  await shotStep('2-preview');
  const g = await build(gatherRect);
  assert((await step()) === 'field', `a fisher or gatherer ends step 2 (${JSON.stringify(g)})`);

  // 3. Field.
  await inView('field');
  await tapSpot('build-field');
  await settle();
  await shotStep('3-field');
  const f = await build(await page.evaluate(() => window.session.stepSpot('field')));
  assert((await step()) === 'plaza', `a field ends step 3 (${JSON.stringify(f)})`);

  // 4. Plaza near the tents: the preview says how many houses it serves.
  await inView('plaza');
  await tapSpot('build-plaza');
  await settle();
  const plazaRect = await page.evaluate(() => window.session.stepSpot('plaza'));
  await hoverAt(plazaRect);
  const serves = await pill();
  assert(serves.startsWith('Atende'), `the plaza preview says how many houses it serves (${serves})`);
  await shotStep('4-plaza');
  const pz = await build(plazaRect);
  // The new plaza goes up inside a scaffold for a moment.
  await page.waitForTimeout(450);
  await shotStep('4-scaffold');
  assert((await step()) === 'house', `a plaza ends step 4 (${JSON.stringify(pz)})`);

  // 5. House near the plaza: the green spots show.
  await tapSpot('build-house');
  await settle();
  await inView('house');
  await shotStep('5-house');
  const hs = await build(await page.evaluate(() => window.session.stepSpot('house')));
  assert((await step()) === 'wedding', `a house ends step 5 (${JSON.stringify(hs)})`);

  // 6. The wedding: the clock runs; the step ends with the first wedding or after its weeks.
  const wedStart = await page.evaluate(() => window.state.week);
  await page.evaluate(() => window.session.setSpeed(3));
  await page.waitForTimeout(800);
  await shotStep('6-wedding');
  await page.waitForFunction(() => window.session.guide?.step?.id === 'lumber', null, { timeout: 120000 });
  const wed = await page.evaluate((w) => ({ weeks: window.state.week - w, wedding: window.state.milestones.includes('firstWedding') }), wedStart);
  assert(wed.weeks <= TUTORIAL.weddingStepMaxWeeks + 1, `the wedding step ends within weddingStepMaxWeeks (${JSON.stringify(wed)})`);

  // 7. Lumber: its preview says the wood and the cuts.
  await page.evaluate(() => window.session.setSpeed(0));
  const lumber = await page.evaluate(() => window.session.lumberHint);
  assert(lumber && lumber.food > 0, `the lumber step points at a spot with trees (${JSON.stringify(lumber)})`);
  if (lumber.road.length) {
    const rua = await arrowAt('tool-road');
    assert(rua.shown && rua.d < 50, `past the grove's edge the arrow points at Rua first (${JSON.stringify(rua)})`);
    await page.evaluate((road) => {
      for (const c of road) window.core.place(window.state, 'road', c.x, c.y);
      window.session.refresh();
    }, lumber.road);
  }
  await tapSpot('build-lumber');
  await inView('lumber');
  const lumberRect = await page.evaluate(() => window.session.stepSpot('lumber'));
  await hoverAt(lumberRect);
  const wood = await pill();
  assert(wood.startsWith('Rende') && wood.includes('madeira') && wood.includes('Corta 1 árvore'), `the lumber preview says the wood and the cuts (${wood})`);
  await shotStep('7-lumber');
  const tipOver = await page.evaluate(() => {
    const a = document.querySelector('.toolballoon').getBoundingClientRect();
    const b = document.querySelector('.tutorial').getBoundingClientRect();
    return a.bottom > b.top + 1 && a.right > b.left && b.right > a.left;
  });
  assert(!tipOver, 'the chosen building\'s balloon stays above the tutorial bubble');
  const lb = await build(lumberRect);
  await page.waitForFunction(() => window.session.guide?.step === null, null, { timeout: 60000 }).catch(() => {});
  assert(await page.evaluate(() => !!window.session.guide && !window.session.guide.running), `the main steps end after the lumber step (${JSON.stringify(lb)})`);
  await page.waitForTimeout(300);
  const end = await page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | '));
  assert(end.includes('Casais novos precisam de casa'), `the last tutorial toast says couples need houses (${end})`);
  assert(await page.evaluate(() => document.querySelector('.tutorial').classList.contains('hidden')), 'the bubble closes between the main steps and the market');

  // The goal that unlocks the market brings its short step.
  await page.evaluate(() => {
    window.state.unlocked.push('market');
    window.state.silver = 500;
    window.session.guide.marketUnlocked();
    window.session.refresh();
  });
  assert((await step()) === 'market', 'unlocking the market starts its step');
  await shotStep('8-market');
  await page.evaluate(() => {
    const { state: s, core } = window;
    const to = core.RULES.map.altar;
    const spots = core.placeSpots(s, 'market').sort((a, b) => Math.abs(a.x - to.x) + Math.abs(a.y - to.y) - (Math.abs(b.x - to.x) + Math.abs(b.y - to.y)));
    core.place(s, 'market', spots[0].x, spots[0].y);
    window.session.refresh();
  });
  assert((await step()) === null, 'a market ends the tutorial');
  assert(await page.evaluate(() => localStorage.getItem('jerusalem.tutorialDone') === '1'), 'the tutorial is remembered as done');
}

/**
 * The Temple in 3D: picking it marks the free 6x6 areas (green ready, yellow needing a road), the
 * preview pill says its Alegria and the missing road or silver; with no area near the roads the
 * nearest free place is marked with its golden road and the camera goes there.
 */
async function temple3dScenario(page, name) {
  // The 2D's map (seed 5): its land leaves a free place three cells from the roads.
  await open3dGame(page, SEED);
  const tag = async () => {
    await page.waitForFunction(() => !document.querySelector('.tag').classList.contains('hidden'), null, { timeout: 3000 }).catch(() => {});
    return page.evaluate(() => (document.querySelector('.tag').classList.contains('hidden') ? '' : document.querySelector('.tag').textContent));
  };
  // The pill is drawn with the marks on the next frame: wait two of them.
  const hover = (c) =>
    page.evaluate(
      (c) =>
        new Promise((ok) => {
          window.session.setHover(c);
          window.session.refresh();
          requestAnimationFrame(() => requestAnimationFrame(ok));
        }),
      c,
    );
  const areas = await page.evaluate(() => {
    const { state: s, core, session: g } = window;
    s.silver = 1e4;
    s.unlocked.push('temple');
    g.selectTool('temple');
    // A grown city: plots in the middle of the nearest ready areas, so some areas need a road.
    for (let k = 0; k < 40 && !g.templeAreas.some((a) => !a.ready); k++) {
      const a = g.templeAreas.find((o) => o.ready);
      if (!a || !core.place(s, 'house', a.x + 2, a.y + 2).ok) break;
      g.refresh();
    }
    return g.templeAreas.map((a) => ({ ...a }));
  });
  assert(areas.length > 0 && areas.length <= 6, `at most 6 temple areas (${areas.length})`);
  assert(areas.some((a) => a.ready) && areas.some((a) => !a.ready), `green and yellow temple areas (${JSON.stringify(areas)})`);
  const yellow = areas.find((a) => !a.ready);
  await page.evaluate((a) => {
    window.view3d.game.stopGlide();
    window.view3d.rig.set({ x: a.x + 3, z: a.y + 3, dist: 30 });
  }, yellow);
  await hover({ x: yellow.x + 2, y: yellow.y + 2 });
  const label = await tag();
  assert(/^\+10 de Alegria em \d+ casas?\nCabe aqui: falta ligar à rua$/.test(label), `the temple preview says its Alegria and the missing road (${label})`);
  await page.screenshot({ path: `${OUT}/temple3d-${name}-areas.png` });
  const green = areas.find((a) => a.ready);
  await page.evaluate(() => (window.state.silver = 100));
  await hover({ x: green.x + 2, y: green.y + 2 });
  const poor = await tag();
  assert(/\nFalta prata: custa 800$/.test(poor), `the temple preview without silver says so (${poor})`);

  // No area near the roads: the nearest free place, its golden road, and the camera goes there.
  const remote = await page.evaluate(() => {
    const { state: s, core, session: g } = window;
    s.silver = 1e4;
    g.setHover(null);
    g.selectTool('view');
    const { dist, prev } = core.roadDistances(s);
    const free = (x, y) => x >= 0 && y >= 0 && x + 6 <= s.cols && y + 6 <= s.rows && [...Array(36).keys()].every((k) => core.isFreeLand(s, x + (k % 6), y + Math.floor(k / 6)) && dist[core.indexOf(s, x + (k % 6), y + Math.floor(k / 6))] >= 3);
    let end = -1;
    for (let y = 0; y < s.rows && end < 0; y++)
      for (let x = 0; x < s.cols && end < 0; x++) {
        if (!free(x, y)) continue;
        for (const c of core.borderCells(s, { x, y, w: 6, h: 6 })) {
          if (!core.inBounds(s, c.x, c.y)) continue;
          const i = core.indexOf(s, c.x, c.y);
          if (dist[i] === 3) {
            end = i;
            break;
          }
        }
      }
    if (end < 0) return null;
    const keep = new Set();
    for (let i = end; i >= 0 && dist[i] > 0; i = prev[i]) keep.add(i);
    dist.forEach((d, i) => {
      if ((d === 1 || d === 2) && !keep.has(i)) s.feature[i] = 'rock';
    });
    g.refresh();
    if (core.templeSpotsNear(s).length) return null;
    const before = { x: window.view3d.rig.focus.x, z: window.view3d.rig.focus.z };
    g.selectTool('temple');
    return { areas: g.templeAreas.map((a) => ({ ...a })), road: g.templeRoad.length, before };
  });
  assert(remote && remote.areas.length === 1 && !remote.areas[0].ready && remote.road > 0, `with no area near the roads, the nearest place and its road (${JSON.stringify(remote)})`);
  await page.waitForFunction(() => !window.view3d.game.scene.glide, null, { timeout: 8000 }).catch(() => {});
  const moved = await page.evaluate((b) => Math.hypot(window.view3d.rig.focus.x - b.x, window.view3d.rig.focus.z - b.z), remote.before);
  assert(moved > 1, `the camera goes to the temple area (${moved})`);
  const inView = await page.evaluate((a) => {
    const p = window.view3d.cellPoint(a.x + 3, a.y + 3);
    return document.elementFromPoint(p.x, p.y) === document.querySelector('.g3d canvas');
  }, remote.areas[0]);
  assert(inView, 'the far temple area is on the free map');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/temple3d-${name}-far.png` });
}

/** The 3D keeps the phone cool and survives a lost GPU: 10 frames a second while paused and still; the city comes back after the WebGL context is lost and restored. */
async function context3dScenario(page) {
  await open3dGame(page);
  await page.waitForFunction(() => window.view3d.ready, null, { timeout: 60000 });
  const framesIn = (ms) => page.evaluate((ms) => new Promise((ok) => { const f0 = window.view3d.frames; setTimeout(() => ok(window.view3d.frames - f0), ms); }), ms);
  await page.waitForTimeout(500);
  const paused = await framesIn(2000);
  assert(paused <= 26, `paused and still: about 10 frames a second (${paused} in 2 s)`);
  await page.evaluate(() => window.session.setSpeed(1));
  const running = await framesIn(2000);
  assert(running > paused, `running draws more frames than paused (${running} vs ${paused} in 2 s)`);
  await page.evaluate(() => window.session.setSpeed(0));
  const lost = await page.evaluate(() => {
    const gl = document.querySelector('.g3d canvas').getContext('webgl2');
    const ext = gl.getExtension('WEBGL_lose_context');
    if (!ext) return false;
    window.__lose = ext;
    ext.loseContext();
    return true;
  });
  assert(lost, 'the WebGL context can be lost (WEBGL_lose_context)');
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__lose.restoreContext());
  const f0 = await page.evaluate(() => window.view3d.frames);
  await page.waitForFunction((f0) => window.view3d.frames > f0 + 5, f0, { timeout: 30000 });
  // A tap wakes the frame rate up; the city is drawn again in full.
  await page.mouse.move(600, 300);
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => window.view3d.info());
  assert(info.calls > 20 && info.triangles > 20000, `the city is drawn again after the context came back (${info.calls} calls, ${info.triangles} triangles)`);
  await page.screenshot({ path: `${OUT}/context3d-pc.png` });
}

/**
 * The 3D interface on a screen size: no text under 12 px, touch targets of 44 px or more on a phone,
 * nothing overlapping (top bar, turns, tools, column, toasts, tutorial), all on screen; with the
 * tutorial bubble, a balloon open and a toast, then the settings panel.
 */
async function hud3dScenario(page, name) {
  await page.addInitScript(() => localStorage.removeItem('jerusalem.tutorialDone'));
  await page.goto(`${URL.replace(/\?.*$/, '')}?view=3d&seed=7`, { timeout: 90000 });
  await page.waitForSelector('[data-spot="start"]', { timeout: 60000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.view3d?.ready && window.view3d.frames > 3 && window.session, null, { timeout: 180000 });
  await page.evaluate(() => window.session.setSpeed(0));
  await page.waitForTimeout(400);
  const check = () =>
    page.evaluate(() => {
      const hud = document.getElementById('hud');
      const phone = hud.dataset.form === 'phone';
      const shown = (el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('.hidden');
      };
      const bad = [];
      for (const el of hud.querySelectorAll('*')) {
        if (!shown(el)) continue;
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (own && parseFloat(getComputedStyle(el).fontSize) < 12) bad.push(`small text "${el.textContent.trim().slice(0, 20)}" ${getComputedStyle(el).fontSize}`);
      }
      if (phone)
        for (const b of hud.querySelectorAll('button')) {
          if (!shown(b)) continue;
          const r = b.getBoundingClientRect();
          if (Math.min(r.width, r.height) < 44) bad.push(`small button ${b.dataset.spot ?? b.textContent.trim().slice(0, 12)} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      const W = innerWidth;
      const H = innerHeight;
      // Each control (button, pill, toast, the tutorial bubble) by its group; two groups must not overlap.
      const GROUPS = ['header.top', 'nav.side', 'nav.tools', 'nav.column', '.toasts', '.tutorial', '.balloon', '.settings', '.arrow'];
      const items = [];
      for (const el of hud.querySelectorAll('button, .pill, .level, .toast, .tutorial, .balloon, .settings, .arrow')) {
        if (!shown(el)) continue;
        const g = GROUPS.find((q) => el.closest(q));
        if (!g) continue;
        let r = el.getBoundingClientRect();
        // Inside a scrolling list (the column): only the part in view counts.
        const box = el.closest('nav.column')?.getBoundingClientRect();
        if (box && g === 'nav.column') {
          if (r.bottom <= box.top || r.top >= box.bottom) continue;
          r = { left: r.left, right: r.right, top: Math.max(r.top, box.top), bottom: Math.min(r.bottom, box.bottom) };
        }
        items.push({ g, r, name: el.dataset.spot ?? el.className });
      }
      for (const { g, r, name } of items) if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) bad.push(`${g} ${name} off screen ${JSON.stringify([r.left, r.top, r.right, r.bottom].map(Math.round))}`);
      for (let i = 0; i < items.length; i++)
        for (let j = i + 1; j < items.length; j++) {
          const A = items[i];
          const B = items[j];
          // The settings panel is a menu dropping from the gear: it may cover the column while open.
          if (A.g === B.g || A.g === '.settings' || B.g === '.settings') continue;
          // Toasts pass over a balloon for a few seconds (drawn on top of it, so they stay readable).
          const pair = [A.g, B.g].sort().join();
          if (pair === '.balloon,.toasts') continue;
          const [a, b] = [A.r, B.r];
          if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) bad.push(`${A.g} ${A.name} overlaps ${B.g} ${B.name}`);
        }
      return { phone, bad: [...new Set(bad)], n: items.length };
    });
  // With the tutorial bubble and a toast.
  await page.evaluate(() => window.session.say('Uma mensagem de teste para ver o tamanho', 'info'));
  await page.waitForTimeout(300);
  const a = await check();
  await page.screenshot({ path: `${OUT}/hud3d-${name}.png` });
  assert(a.bad.length === 0, `tutorial and toast: ${a.bad.join('; ')}`);
  assert(await page.evaluate(() => !document.querySelector('.tutorial').classList.contains('hidden')), 'the tutorial bubble shows on a first game');
  // A balloon open on the altar: it stays clear of the controls.
  await page.evaluate(() => {
    window.session.skipTutorial();
    const altar = window.state.buildings.find((b) => b.kind === 'altar');
    window.session.selectTool('view');
    window.session.select({ x: altar.x, y: altar.y });
  });
  await page.waitForTimeout(300);
  const b = await check();
  await page.screenshot({ path: `${OUT}/hud3d-${name}-balloon.png` });
  assert(b.bad.length === 0, `balloon: ${b.bad.join('; ')}`);
  // The settings panel.
  await page.keyboard.press('Escape');
  await page.click('[data-spot="settings"]');
  await page.waitForTimeout(200);
  const c = await check();
  await page.screenshot({ path: `${OUT}/hud3d-${name}-settings.png` });
  assert(c.bad.length === 0, `settings: ${c.bad.join('; ')}`);
}

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
  materials: { context: PHONE, run: (page) => materialsScenario(page, '') },
  /** Lenha e inverno: a winter week without wood, phone and PC. */
  'winter-cold': { context: PHONE, run: (page) => winterColdScenario(page, '') },
  'winter-cold-pc': { context: PC, run: (page) => winterColdScenario(page, '-pc') },
  /** Stone at the cap with a quarry, phone and PC. */
  'quarry-full': { context: PHONE, run: (page) => quarryFullScenario(page, '') },
  'quarry-full-pc': { context: PC, run: (page) => quarryFullScenario(page, '-pc') },
  'materials-wide': { context: { ...PHONE, viewport: { width: 915, height: 412 } }, run: (page) => materialsScenario(page, '-wide') },
  'materials-pc': { context: PC, run: (page) => materialsScenario(page, '-pc') },
  'top-fit': { context: PC, run: (page) => topFitScenario(page, '') },
  'top-fit-1280': { context: { viewport: { width: 1280, height: 720 } }, run: (page) => topFitScenario(page, '-1280') },
  'lumber-shared': { context: PHONE, run: (page) => lumberShared(page, '') },
  'lumber-shared-pc': { context: PC, run: (page) => lumberShared(page, '-pc') },
  'harvest-countdown': { context: PHONE, run: (page) => harvestCountdown(page, '') },
  'harvest-countdown-pc': { context: PC, run: (page) => harvestCountdown(page, '-pc') },
  /** Toasts that come while a panel is open wait; on closing, the warning comes back and the news does not. */
  async 'toast-panel'(page) {
    await startGame(page);
    await page.waitForFunction(() => window.game.ui.view.toasts.list.length === 0, null, { timeout: 90000 }); // the opening sentence goes away
    await clickUi(page, 'side-stats');
    await page.waitForTimeout(200);
    assert(await page.evaluate(() => window.game.ui.view.panels.open === 'stats'), 'the statistics are open');
    await page.evaluate(() => {
      window.game.ui.toast('Teste: uma notícia chegando', 'good');
      window.game.ui.toast('Teste: um aviso chegando', 'info', { alert: () => 0 });
    });
    await page.waitForTimeout(300);
    const over = await page.evaluate(() => window.game.ui.view.toasts.list.map((t) => t.msg));
    assert(over.length === 0, `no toast over the open panel (${over})`);
    await shot(page, 'toast-panel-open');
    await clickUi(page, 'side-stats');
    await page.waitForTimeout(400);
    const back = await page.evaluate(() => [...window.game.ui.view.toasts.list, ...window.game.ui.view.toasts.queue].map((t) => t.msg));
    assert(back.length === 1 && back[0] === 'Teste: um aviso chegando', `only the warning comes back when the panel closes (${back})`);
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
  /** Pacote Povo: the house balloon with its people (phone two columns, PC one), the person sheet, the Povo tab, Melhorar, caravan and couple warnings. */
  'house-people': { context: PHONE, run: (page) => housePeople(page, '') },
  'house-people-wide': { context: { ...PHONE, viewport: { width: 915, height: 412 } }, run: (page) => housePeople(page, '-wide') },
  'house-people-pc': { context: PC, run: (page) => housePeople(page, '-pc') },
  'person-sheet': { context: PHONE, run: (page) => personSheet(page, '') },
  'person-sheet-wide': { context: { ...PHONE, viewport: { width: 915, height: 412 } }, run: (page) => personSheet(page, '-wide') },
  'person-sheet-pc': { context: PC, run: (page) => personSheet(page, '-pc') },
  'stats-people': { context: PHONE, run: (page) => statsPeople(page, '') },
  'stats-people-wide': { context: { ...PHONE, viewport: { width: 915, height: 412 } }, run: (page) => statsPeople(page, '-wide') },
  'stats-people-pc': { context: PC, run: (page) => statsPeople(page, '-pc') },
  'granary-upgrade': { context: PHONE, run: (page) => granaryUpgrade(page, '') },
  'granary-upgrade-pc': { context: PC, run: (page) => granaryUpgrade(page, '-pc') },
  'caravan-announced': { context: PHONE, run: (page) => caravanAnnounced(page, '') },
  'caravan-announced-pc': { context: PC, run: (page) => caravanAnnounced(page, '-pc') },
  'couple-waiting': { context: PHONE, run: (page) => coupleWaiting(page, '') },
  'couple-waiting-pc': { context: PC, run: (page) => coupleWaiting(page, '-pc') },
  'toasts-tutorial': { context: PHONE, run: toastsOverTutorial },

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
    await page.evaluate(() => Object.assign(window.state, { silver: 1e4, wood: 1e4, stone: 1e4 }));

    await tool(page, 2); // Rua
    await mouseDrag(page, [[27, 24], [32, 24]]);
    await tool(page, 3); // Moradia: Casa first; only Rua builds by drag, so a drag places one house where it is released
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
    assert(after.houses.length === before.houses.length + 1, `a drag with Casa places one house (got ${after.houses.length - before.houses.length})`);
    assert(after.buildings.includes('field') && after.buildings.includes('plaza'), 'field and plaza placed');
  },

  async 'families-arrive'(page) {
    await startGame(page);
    await page.evaluate(() => Object.assign(window.state, { silver: 1e4, wood: 1e4, stone: 1e4 }));
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

  /** The 3D view of the city (button in the left column), phone and PC. */
  view3d: { context: PHONE, run: (page) => view3dScenario(page, 'phone') },
  'view3d-pc': { context: PC, run: (page) => view3dScenario(page, 'pc') },
  play3d: { context: PHONE, run: (page) => play3dScenario(page, 'phone') },
  'play3d-pc': { context: PC, run: (page) => play3dScenario(page, 'pc') },
  'input3d-pc': { context: PC, run: input3dScenario },
  touch3d: { context: PHONE, run: touch3dScenario },
  'context3d-pc': { context: PC, run: context3dScenario },
  'tutorial3d-phone': { context: PHONE, run: (page) => tutorial3dScenario(page, 'phone') },
  'tutorial3d-pc': { context: PC, run: (page) => tutorial3dScenario(page, 'pc') },
  'temple3d-phone': { context: PHONE, run: (page) => temple3dScenario(page, 'phone') },
  'temple3d-pc': { context: PC, run: (page) => temple3dScenario(page, 'pc') },
  'ui3d-phone': { context: PHONE, run: (page) => ui3dScenario(page, 'phone') },
  'ui3d-pc': { context: PC, run: (page) => ui3dScenario(page, 'pc') },
  'hud3d-phone': { context: PHONE, run: (page) => hud3dScenario(page, 'phone') },
  'hud3d-wide': { context: { ...PHONE, viewport: { width: 915, height: 412 } }, run: (page) => hud3dScenario(page, 'wide') },
  'hud3d-small-phone': { context: { ...PHONE, viewport: { width: 667, height: 375 } }, run: (page) => hud3dScenario(page, 'small-phone') },
  'hud3d-pc': { context: PC, run: (page) => hud3dScenario(page, 'pc') },

  async 'town-art'(page) {
    await startGame(page);
    await buildTown(page);
    await addWoodStone(page);
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

  /**
   * People package art: granary, workshop and market at levels 1, 2 and 3 side by side; lived houses
   * of levels 2-4 next to empty ones that kept those levels (door shut, no washing); a couple and a
   * caravan family walking to a house; a birth over a house. Zoom 1.2 and the minimum zoom.
   */
  async 'people-art'(page) {
    await startGame(page);
    await setSpeed(page, 0);
    await buildTown(page);
    const missing = await page.evaluate(() => {
      const { state: s, core } = window;
      const bad = [];
      Object.assign(s, { silver: 5000, wood: 1000, stone: 1000 }); // every building here costs materials
      for (let x = 12; x <= 39; x++) core.place(s, 'road', x, 13);
      for (let y = 13; y <= 18; y++) core.place(s, 'road', 12, y);
      const put = (k, x, y, level, extra = {}) => {
        const { w, h } = core.dimsOf(k);
        for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) core.clearCell(s, i, j); // the caravan's camp road
        const r = core.place(s, k, x, y);
        if (!r.ok) return bad.push(`${k}@${x},${y}: ${r.reason}`);
        Object.assign(s.grid[y * s.cols + x], { level }, extra);
      };
      [1, 2, 3].forEach((l, k) => put('granary', 13 + 3 * k, 15, l));
      [1, 2, 3].forEach((l, k) => put('workshop', 22 + 3 * k, 15, l, { variant: k }));
      [1, 2, 3].forEach((l, k) => put('market', 31 + 3 * k, 14, l));
      // Lived (level 2-4) and empty houses that kept the same level, north of the new road.
      [2, 3, 4].forEach((l, k) => {
        put('house', 13 + 4 * k, 11, l);
        put('house', 15 + 4 * k, 11, 0, { emptyLevel: l, variant: k % 2 });
      });
      // A couple and a caravan family walking along the new road toward the last empty house.
      const home = s.grid[11 * s.cols + 23];
      const path = (x0, x1) => {
        const d = Math.sign(x1 - x0);
        return [...Array.from({ length: Math.abs(x1 - x0) + 1 }, (_, i) => ({ x: x0 + i * d, y: 13 })), { x: home.x, y: home.y }];
      };
      const add = (o) => core.addPerson(s, { clan: 0, caravan: null, houseId: null, ...o }, Math.random);
      const man = add({ sex: 'm', age: 20, houseId: s.grid[11 * s.cols + 13].id });
      const woman = add({ sex: 'f', age: 19, houseId: s.grid[11 * s.cols + 17].id });
      man.spouseId = woman.id;
      woman.spouseId = man.id;
      s.families.push({ id: s.nextId++, houseId: home.id, members: [man.id, woman.id], path: path(14, 23), step: 4.3 });
      const kin = [add({ sex: 'm', age: 30, caravan: 1 }), add({ sex: 'f', age: 28, caravan: 1 }), add({ sex: 'f', age: 6, caravan: 1 })];
      s.families.push({ id: s.nextId++, houseId: home.id, members: kin.map((p) => p.id), path: path(31, 24), step: 3.5 });
      window.game.refresh();
      const cam = window.game.cameras.main;
      cam.setZoom(1.2);
      cam.centerOn(...Object.values(window.iso.gridToWorld(25, 14)));
      return bad;
    });
    assert(missing.length === 0, `people-art buildings placed (${missing.join('; ')})`);
    await page.waitForTimeout(1500);
    await page.waitForFunction(() => [...window.game.map.views.values()].every((v) => !v.scaffold), null, { timeout: 20000 });
    await page.waitForFunction(() => window.game.ui.view.toasts.list.length === 0, null, { timeout: 30000 }).catch(() => {});
    const keys = await page.evaluate(() => [...window.game.map.views.values()].map((v) => v.key));
    for (const k of ['granary-l2-', 'granary-l3-', 'workshop-l2-', 'workshop-l3-', 'market-l2', 'market-l3', 'house-e2-', 'house-e3-', 'house-e4-'])
      assert(keys.some((key) => key.startsWith(k)), `a building drawn as ${k}`);
    await shot(page, 'people-art');
    // Close-ups (zoom 2) of each row: houses with the walkers, granaries, workshops, markets.
    for (const [name, x, y] of [['houses', 20, 12], ['granary', 17, 16], ['workshop', 26, 16], ['market', 35, 15]]) {
      await page.evaluate(([x, y]) => {
        const cam = window.game.cameras.main;
        cam.setZoom(2);
        cam.centerOn(...Object.values(window.iso.gridToWorld(x, y)));
      }, [x, y]);
      await page.waitForTimeout(300);
      await shot(page, `people-art-${name}`);
    }
    await page.evaluate(() => {
      const cam = window.game.cameras.main;
      cam.setZoom(1.2);
      cam.centerOn(...Object.values(window.iso.gridToWorld(19, 12)));
    });
    await page.evaluate(() => {
      const s = window.state;
      const b = s.grid[11 * s.cols + 17];
      const p = s.people.find((o) => o.houseId === b.id);
      window.game.handleEvents([{ type: 'birth', id: p.id, x: b.x, y: b.y }]);
    });
    await page.waitForTimeout(250);
    await shot(page, 'people-art-birth');
    await page.evaluate(() => {
      const cam = window.game.cameras.main;
      cam.setZoom(0.5);
      cam.centerOn(...Object.values(window.iso.gridToWorld(25, 15)));
    });
    await page.waitForTimeout(400);
    await shot(page, 'people-art-zoom-out');
  },

  /** Happiness: the face on the plaque, its breakdown, a house's mood, the park's radius and a sad balloon. */
  async happiness(page) {
    await startGame(page);
    await setSpeed(page, 0);
    await buildTown(page);
    await fillHouses(page);
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
      Object.assign(s, { silver: 1e6, wood: 1e6, stone: 1e6 }); // materials too: scenarios build freely
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
    await fillHouses(page, 7); // 3 big houses: 21 adults for 16 jobs
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
      const s = window.state;
      const homes = new Set(s.buildings.filter((b) => b.kind === 'house').map((b) => b.id));
      let keep = 7; // 7 workers for 16 jobs
      s.people = s.people.filter((p) => !homes.has(p.houseId) || keep-- > 0);
      window.core.refreshCity(s);
      window.game.refresh();
    });
    await centerOnFields(1.5);
    await page.waitForTimeout(300);
    n = await farmers();
    assert(n.filter((c) => c === 1).length === 8, `1 farmer per field at a third of the jobs filled (got ${n})`);
    await shot(page, 'field-work-turned');
  },

  /**
   * Lumber and quarry up close (zoom max) and far (zoom min), stumps and sprouts of olive and palm,
   * a tree falling on a cut, the woodcutter and the mason, and the lot under snow.
   */
  async 'wood-stone'(page) {
    await startGame(page);
    await buildTown(page);
    await addWoodStone(page);
    await page.evaluate(() => window.game.setSpeed(0));
    const look = (x, y, zoom) =>
      page.evaluate(
        ([x, y, zoom]) => {
          const cam = window.game.cameras.main;
          const p = window.iso.gridToWorld(x, y);
          cam.setZoom(zoom);
          cam.centerOn(p.x, p.y);
        },
        [x, y, zoom],
      );
    const built = await page.evaluate(() => window.state.buildings.filter((b) => ['lumber', 'quarry'].includes(b.kind) && b.connected).length);
    assert(built === 2, `lumber and quarry connected (${built})`);
    const keys = await page.evaluate(() => [...window.game.map.features.values()].filter((f) => f.tree === 'stump').map((f) => f.key));
    assert(keys.some((k) => k.includes('olive-cut')) && keys.some((k) => k.includes('palm-sprout')), `stumps cut and sprouting (${keys})`);
    await look(15.5, 23, 2);
    await page.waitForTimeout(400);
    await shot(page, 'wood-stone-lumber');
    await look(38.5, 20, 2);
    await page.waitForTimeout(400);
    await shot(page, 'wood-stone-quarry');
    // The new walkers, lined up on the road by the lumber (their textures, all looks).
    await look(13.5, 21.5, 2);
    await page.evaluate(() => {
      const sc = window.game;
      const p = window.iso.gridToWorld(12.5, 20.5);
      window.__lineup = ['woodcutter', 'mason'].flatMap((t, row) =>
        [0, 1, 2].map((look, k) => sc.add.image(p.x - 50 + k * 50, p.y + row * 40, `walker-${t}-${look}-${k % 2}`).setOrigin(0.5, 1).setDepth(1e6)),
      );
    });
    await page.waitForTimeout(200);
    await shot(page, 'wood-stone-walkers');
    assert(await page.evaluate(() => window.__lineup.every((i) => i.texture.key !== '__MISSING')), 'woodcutter and mason textures exist');
    await page.evaluate(() => window.__lineup.forEach((i) => i.destroy()));
    // A cut: the olive falls (under a second), then the cell shows a stump.
    await look(17.5, 23.5, 2);
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const { state: s } = window;
      const i = 23 * s.cols + 17;
      window.__falling = window.game.map.features.get(i).img;
      s.feature[i] = 'stump';
      s.stumps.push({ i, kind: 'olive', week: s.week });
      window.game.handleEvents([{ type: 'treeCut', x: 17, y: 23, kind: 'olive' }]);
      window.game.refresh();
    });
    await page.waitForFunction(() => Math.abs(window.__falling.angle) > 30, null, { timeout: 5000 });
    await page.evaluate(() => window.game.tweens.pauseAll());
    await shot(page, 'wood-stone-fall');
    await page.evaluate(() => window.game.tweens.resumeAll());
    await page.waitForFunction(() => !window.__falling.active, null, { timeout: 5000 });
    const after = await page.evaluate(() => window.game.map.features.get(23 * window.state.cols + 17)?.key ?? null);
    assert(after?.startsWith('stump-olive-cut'), `the cut olive is a stump (${after})`);
    // Far away: both still read at the minimum zoom.
    await look(26, 21, 0.5);
    await page.waitForTimeout(300);
    await shot(page, 'wood-stone-zoom-min');
    // Under snow.
    await setLook(page, 13 + 6, { snow: true });
    await look(15.5, 22.5, 1.4);
    await page.waitForTimeout(300);
    await shot(page, 'wood-stone-snow-lumber');
    await look(38.5, 20, 1.6);
    await page.waitForTimeout(300);
    await shot(page, 'wood-stone-snow-quarry');
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

      await tool(page, 5); // Trabalho: the Lenhador first, then the next unlocked one (the Pedreira is locked)
      assert(await page.evaluate(() => window.game.tool === 'lumber'), 'key 5 picks the lumber');
      await page.waitForTimeout(150);
      await tool(page, 5);
      await page.waitForTimeout(150);
      assert(await page.evaluate(() => window.game.tool === 'market'), 'key 5 again picks the market');
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
      Object.assign(s, { silver: 1e4, wood: 1e4, stone: 1e4 }); // materials too: scenarios build freely
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
      Object.assign(s, { silver: 1e4, wood: 1e4, stone: 1e4 }); // materials too: scenarios build freely
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
      Object.assign(s, { silver: 1e4, wood: 1e4, stone: 1e4 }); // materials too: scenarios build freely
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
    await fillHouses(page, 2);
    await page.evaluate(() => {
      const { state: s, core } = window;
      const silver = s.silver;
      s.silver = 1e4; // room to build, then back in debt
      // Off the road, until the upkeep beats the taxes.
      for (let k = 0; k < 36 && core.computeEconomy(s).silverDelta >= 0; k++) core.place(s, 'plaza', 4 + 3 * (k % 12), 4 + 3 * Math.floor(k / 12));
      s.silver = silver;
      window.game.refresh();
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

    // Mesmo mapa (left button): a new game on the same seed. The seed is changed first so the replay
    // is proven to come from the game's seed, not from the ?seed of the test URL.
    await page.evaluate(() => {
      window.game.seed = 4242;
      window.state.oldGame = true; // marks the lost game: the new one has no mark
    });
    await page.mouse.click(GAME_W / 2 - 157, GAME_H / 2 + 80); // Mesmo mapa
    await page.waitForFunction(() => window.state && !window.state.oldGame && !window.state.lost && window.state.week === 0, null, { timeout: 5000 });
    await page.waitForTimeout(600);
    assert(await page.evaluate(() => window.game.seed === 4242), 'Mesmo mapa keeps the seed');
    assert(await page.evaluate(() => !window.game.ui?.modalOpen), 'Mesmo mapa starts without the dialog');
    await shot(page, 'defeat-same-map');

    await page.evaluate(() => window.game.ui.showDefeat(3, 10));
    await page.waitForTimeout(300);
    await page.evaluate(() => (window.state.oldGame = true));
    await page.mouse.click(GAME_W / 2 + 157, GAME_H / 2 + 80); // Tentar de novo (right button)
    await page.waitForFunction(() => window.state && !window.state.oldGame && !window.state.lost && window.state.week === 0 && window.state.silver >= 0, null, { timeout: 5000 });
    await page.waitForTimeout(600);
    assert(await page.evaluate(() => window.game.seed !== 4242), 'Tentar de novo draws a new map (here the ?seed of the URL)');
    assert(await page.evaluate(() => !window.game.ui?.modalOpen), 'a new game starts without the dialog');
    await shot(page, 'defeat-retry');
  },
  async victory(page) {
    await startGame(page);
    await page.evaluate(() => {
      const s = window.state;
      Object.assign(s, { silver: 900, wood: 600, stone: 600 }); // the temple also costs wood and stone
      s.goalIndex = window.core.GOALS.length - 1; // last goal: build the temple
      s.unlocked.push('temple');
      s.feature = s.feature.map(() => null);
      window.game.refresh();
    });
    // The nearest ready temple spot (the map and the caravan tents change with the rules).
    const spot = await page.evaluate(() => {
      const a = window.core.templeSpotsNear(window.state).find((o) => o.ready);
      const w = window.iso.gridToWorld(a.x + 3, a.y + 3);
      window.game.cameras.main.centerOn(w.x, w.y);
      return a;
    });
    await pick(page, 'temple');
    await page.mouse.click(...(await cellToScreen(page, spot.x + 2, spot.y + 2))); // 6x6 centered on the click
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
    const names = ['level', 'gear', 'speed-1', 'side-goals', 'side-alerts', 'side-stats', 'side-3d', 'tool-view', 'tool-road', 'tool-clear',
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
  // The left column keeps clear gaps: between its round buttons, and from the 3D button down to Mover.
  const k = await page.evaluate(() => document.querySelector('canvas').getBoundingClientRect().width / 1280);
  const by = Object.fromEntries(sizes.map((b) => [b.n, b]));
  const column = ['side-goals', 'side-alerts', 'side-stats', 'side-3d'];
  for (let i = 1; i < column.length; i++) {
    const gap = (by[column[i]].top - by[column[i - 1]].bottom) * k;
    assert(gap >= 6, `${column[i - 1]} and ${column[i]} are at least 6 real px apart (got ${gap.toFixed(1)})`);
  }
  const toMover = (by['tool-view'].top - by['side-3d'].bottom) * k;
  assert(toMover >= 12, `the 3D button is at least 12 real px above Mover (got ${toMover.toFixed(1)})`);
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

  // A goal done, then a Casa grande: the 3D button pulses gently (gold border) for a few seconds and never opens.
  const pulse = () => page.evaluate(() => ({ on: window.game.ui.view.tools.inviting3D, scale: window.game.ui.view.tools.view3d.root.scale, open: !!window.view3d }));
  for (const [what, ev] of [
    ['a goal', { type: 'goal', reward: 0 }],
    ['a Casa grande', { type: 'houseUp', x: 22, y: 27, level: 4, delta: 4 }],
  ]) {
    await page.evaluate((e) => window.game.handleEvents([e]), ev);
    // The tween runs on frames (slow under load): wait for the swell, not a fixed time.
    await page.waitForFunction(() => window.game.ui.view.tools.view3d.root.scale > 1.02, null, { timeout: 4000 }).catch(() => {});
    const p = await pulse();
    assert(p.on && p.scale > 1.02 && !p.open, `${what} makes the 3D button pulse without opening it (${JSON.stringify(p)})`);
    if (what === 'a goal') await shot(page, `nova-${suffix}-3d-invite`);
    await page.waitForFunction(() => !window.game.ui.view.tools.inviting3D, null, { timeout: 8000 });
    const end = await pulse();
    assert(end.scale === 1 && !end.open, `the 3D pulse ends at rest, still closed (${JSON.stringify(end)})`);
  }

  // Opening the 3D closes the open panel and the tapped building's balloon: nothing is left open under it or on the way back.
  if (suffix === 'phone' || suffix === 'pc') {
    await press('side-stats');
    await page.evaluate(() => {
      window.game.selected = { x: 22, y: 27 };
      window.game.refresh();
    });
    await page.waitForTimeout(200);
    const before = await page.evaluate(() => ({ panel: window.game.ui.view.panels.open, balloon: window.game.ui.view.inspector.open }));
    assert(before.panel === 'stats' && before.balloon, `the statistics and a balloon are open before the 3D (${JSON.stringify(before)})`);
    await press('side-3d');
    const closed = await page.evaluate(() => ({ panel: window.game.ui.view.panels.open, balloon: window.game.ui.view.inspector.open, selected: window.game.selected }));
    assert(!closed.panel && !closed.balloon && !closed.selected, `the 3D button closes the panel and the balloon (${JSON.stringify(closed)})`);
    await page.waitForFunction(() => window.view3d?.ready && window.view3d.frames > 3 && document.querySelector('[data-spot="exit3d"]'), null, { timeout: 180000 });
    const r = await page.evaluate(() => {
      const b = document.querySelector('[data-spot="exit3d"]').getBoundingClientRect();
      return [b.x + b.width / 2, b.y + b.height / 2];
    });
    if (tap) await cdpTapPage(page, r[0], r[1]);
    else await page.mouse.click(r[0], r[1]);
    await page.waitForFunction(() => !window.view3d && !document.querySelector('.g3d'), null, { timeout: 20000 });
    await page.waitForTimeout(300);
    const back = await page.evaluate(() => ({ panel: window.game.ui.view.panels.open, balloon: window.game.ui.view.inspector.open }));
    assert(!back.panel && !back.balloon, `nothing is open on the way back from the 3D (${JSON.stringify(back)})`);
    await shot(page, `nova-${suffix}-after-3d`);
  }

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

// One visual run at a time on this machine: each Chromium draws WebGL on the CPU (SwiftShader) and
// takes 1+ GB; several at once filled the WSL memory and froze it (2026-11-05). Others wait here.
const LOCK = 'logs/visual.lock';
await mkdir('logs', { recursive: true });
for (let waited = 0; ; waited += 5) {
  try {
    await writeFile(LOCK, String(process.pid), { flag: 'wx' });
    break;
  } catch {
    const pid = Number(await readFile(LOCK, 'utf8').catch(() => '0'));
    let alive = false;
    try {
      alive = pid > 0 && process.kill(pid, 0);
    } catch {}
    if (!alive) {
      await rm(LOCK, { force: true });
      continue;
    }
    if (waited % 60 === 0) console.log(`waiting for another visual run (pid ${pid}) to finish…`);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
const unlock = () => rmSync(LOCK, { force: true });
process.on('exit', unlock);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(130));

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
// No file watching or hot reload: an edit made while the scenarios run (another agent at work) must not reload the page mid-scenario.
const server = await createServer({ server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const launch = () => chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let browser = await launch();
/** A fresh browser (the old one may still look connected for a moment after it was killed). */
const relaunch = async () => {
  await browser.close().catch(() => {});
  return launch();
};
/** Another process on the machine killed the browser (not a failure of the scenario). */
const killed = (e) => /has been closed|Browser closed|Target closed/.test(String(e?.message ?? e));

/** A 3D scenario (the 2D's "3D" button ones, view3d*, belong to the 2D); "title" checks the 2D opens. */
const isThreeD = (name) => name === 'title' || (name.includes('3d') && !name.startsWith('view3d'));

let failed = 0;
for (const [k, [name, def]] of Object.entries(scenarios).entries()) {
  if (filter && !filter.split(',').some((f) => name.includes(f))) continue;
  // The 2D is frozen (user decision, 2026-11-05): its scenarios run only when named or with VISUAL_2D.
  if (!filter && !process.env.VISUAL_2D && !isThreeD(name)) continue;
  if (k % SHARD_N !== SHARD_K) continue;
  const run = typeof def === 'function' ? def : def.run;
  for (let attempt = 0; attempt < 3; attempt++) {
    // Another process may have killed the browser (other projects' scripts kill every headless Chrome).
    if (!browser.isConnected()) browser = await relaunch();
    let context, page;
    try {
      context = await browser.newContext(def.context ?? { viewport: { width: GAME_W, height: GAME_H } });
      page = await context.newPage();
    } catch (e) {
      if (attempt === 2 || !killed(e)) throw e;
      browser = await relaunch();
      continue;
    }
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    const t0 = Date.now();
    try {
      await run(page);
      assert(errors.length === 0, `no page errors (${errors.join(' | ')})`);
      console.log(`✓ ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    } catch (e) {
      if (attempt < 2 && killed(e)) {
        console.log(`↻ ${name}: the browser was killed from outside; running it again`);
        browser = await relaunch();
        continue;
      }
      failed++;
      console.log(`✗ ${name}: ${e.message}`);
      await page.screenshot({ path: `${OUT}/FAILED-${name}.png` }).catch(() => {});
    }
    await context.close().catch(() => {});
    break;
  }
}

await browser.close();
await server.close();
console.log(failed ? `\n${failed} scenario(s) failed. Screenshots in ${OUT}/` : `\nAll scenarios passed. Screenshots in ${OUT}/`);
process.exit(failed ? 1 : 0);

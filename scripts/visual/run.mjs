/**
 * Visual / end-to-end checks in a real browser (Playwright + Chromium).
 *
 * Starts the Vite dev server, plays scripted scenarios, saves screenshots to screenshots/
 * and fails if an assertion breaks or the page logs an error.
 *
 *   npm run test:visual            # every scenario
 *   npm run test:visual -- touch   # only scenarios whose name contains "touch" (comma: several)
 *   VISUAL_SHARD=0/4 npm run test:visual   # a quarter of them (0/4, 1/4, 2/4, 3/4 cover all)
 *
 * Scenarios use the dev-only hooks window.session, window.state, window.core and window.view3d
 * (exposed by start3d and Play3D in dev builds) to read state and set up situations quickly.
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
/** The game (`?seed=N` fixes the map in dev builds). */
const BASE = `http://localhost:${PORT}/`;
const filter = process.argv[2] ?? '';
/** `VISUAL_SHARD=k/n` runs only every n-th scenario starting at k (0-based): long suites in short runs. */
const [SHARD_K, SHARD_N] = (process.env.VISUAL_SHARD ?? '0/1').split('/').map(Number);

// ---------- helpers ----------

function assert(cond, msg) {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}


const PHONE = { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const PC = { viewport: { width: 1366, height: 768 } };

/** Screenshot into the output folder. */
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });

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
    const g = window.session;
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
    window.view3d.rig.set({ x: a.x + 1, z: a.y + 1 });
    return ids;
  }, freeHouse);
}

/**
 * The 3D game: no Phaser at all, the HTML interface over the map, the
 * tutorial's first step and its marked road, and a road pulled by drag along the marked cells.
 */
async function play3dScenario(page, suffix) {
  const phone = suffix === 'phone';
  await page.goto(`${BASE}?seed=7`, { timeout: 90000 });
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
  const st = await page.evaluate(() => ({ phaser: !!window.Phaser || performance.getEntriesByType('resource').some((e) => /phaser/i.test(e.name)), canvases: document.querySelectorAll('canvas').length, form: document.querySelector('#hud').dataset.form, tutorial: !document.querySelector('.tutorial').classList.contains('hidden') }));
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

/**
 * Music (not heard: its state via `window.music`): no audio before the first gesture, running after;
 * the gear turns it off and the volume − / + moves the target; both persist after a reload; a hidden
 * tab suspends it. Shoots the settings panel.
 */
async function music3dScenario(page, name) {
  const phone = name === 'phone';
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}?seed=7`, { timeout: 90000 });
  await page.waitForSelector('[data-spot="start"]', { timeout: 60000 });
  const st = () => page.evaluate(() => window.music.state());
  assert((await st()).ctx === 'none', `no audio before the first gesture (${JSON.stringify(await st())})`);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.view3d?.ready && window.view3d.frames > 3 && window.session, null, { timeout: 180000 });
  await page.waitForFunction(() => window.music.state().ctx === 'running', null, { timeout: 10000 }).catch(() => {});
  const on = await st();
  assert(on.ctx === 'running' && on.target > 0, `the music runs after the first gesture (${JSON.stringify(on)})`);
  const hitSpot = async (spot) => {
    const r = await page.evaluate((spot) => {
      const b = document.querySelector(`[data-spot="${spot}"]`).getBoundingClientRect();
      return [b.x + b.width / 2, b.y + b.height / 2];
    }, spot);
    if (phone) await cdpTapPage(page, r[0], r[1]);
    else await page.mouse.click(r[0], r[1]);
    await page.waitForTimeout(150);
  };
  await hitSpot('settings');
  // The first frames after the start can be slow on the phone (shaders compiling): a tap again if it was lost.
  if (!(await page.waitForSelector('.settings:not(.hidden)', { timeout: 2500 }).catch(() => null))) {
    await hitSpot('settings');
    await page.waitForSelector('.settings:not(.hidden)', { timeout: 5000 });
  }
  await hitSpot('set-volume-up');
  const louder = await st();
  assert(louder.target > on.target, `+ raises the volume (${on.target} → ${louder.target})`);
  await hitSpot('set-volume-down');
  await hitSpot('set-volume-down');
  await page.screenshot({ path: `${OUT}/music3d-${name}-settings.png` });
  await hitSpot('set-music');
  assert((await st()).target === 0, 'the gear turns the music off');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jerusalem-antiga.settings')));
  assert(saved.music === false && saved.musicVolume === 0.4, `off and the volume are saved (${JSON.stringify(saved)})`);
  if (!phone) {
    await page.keyboard.press('Escape');
    await page.keyboard.press('m');
    await page.waitForTimeout(150);
    assert((await st()).target > 0, 'M turns the music back on');
  } else await hitSpot('set-music');
  // A hidden tab fades out and suspends the audio.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  // (The fade runs first; on a busy machine it may take longer than its nominal time.)
  await page.waitForFunction(() => window.music.state().ctx === 'suspended', null, { timeout: 4000 }).catch(() => {});
  const hidden = await st();
  assert(hidden.target === 0 && hidden.ctx === 'suspended', `a hidden tab suspends the music (${JSON.stringify(hidden)})`);
  assert(!errors.length, `no page errors (${errors.join(' | ')})`);
}

/** Opens the 3D game on its own and leaves the title screen (tutorial marked as seen). */
async function open3dGame(page, seed = 7) {
  await page.addInitScript(() => localStorage.setItem('jerusalem.tutorialDone', '1'));
  await page.goto(`${BASE}?seed=${seed}`, { timeout: 90000 });
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
  // The balloon points at its house (once the camera moved it aside when it did not fit).
  await page.waitForFunction(() => document.querySelector('.balloon').dataset.arrow, null, { timeout: 3000 }).catch(() => {});
  const arrow = await page.evaluate(() => document.querySelector('.balloon').dataset.arrow ?? null);
  await page.screenshot({ path: `${OUT}/ui3d-${name}-house.png` });
  assert(arrow, `the house balloon has an arrow (${arrow})`);
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
  await page.evaluate(() => {
    if (!window.state.unlocked.includes('plaza')) window.state.unlocked.push('plaza'); // opens with goal 5
    window.session.selectTool('plaza');
  });
  await page.waitForTimeout(200);
  const tip = await page.evaluate(() => ({ shown: !document.querySelector('.toolballoon').classList.contains('hidden'), text: document.querySelector('.toolballoon').textContent }));
  assert(tip.shown && tip.text.startsWith('Praça') && tip.text.includes('prata'), `the chosen building's balloon (${tip.text})`);
  // Three toasts at once: the phone shows two, below the middle; none covers the tool balloon.
  await page.evaluate(() => {
    for (const m of ['Primeira mensagem de teste para os avisos', 'Segunda mensagem de teste, um pouco maior que a primeira', 'Terceira mensagem']) window.session.say(m, 'info');
  });
  await page.waitForTimeout(400);
  const toasts = await page.evaluate(() => {
    const t = document.querySelector('.toolballoon').getBoundingClientRect();
    return [...document.querySelectorAll('.toast:not(.out)')].map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, over: r.left < t.right && t.left < r.right && r.top < t.bottom && t.top < r.bottom };
    });
  });
  assert(toasts.length === (name === 'phone' ? 2 : 3), `toasts at once on ${name} (${toasts.length})`);
  assert(toasts.every((t) => !t.over), 'no toast covers the tool balloon');
  if (name === 'phone') assert(toasts.every((t) => t.top >= 390 / 2 - 1), `phone toasts stay below the middle (${toasts.map((t) => Math.round(t.top))})`);
  await page.screenshot({ path: `${OUT}/ui3d-${name}-tool.png` });
  lap('panels to tool');
  // The preview pill: what a gatherer would bring there (or that it brings nothing off the road),
  // and with Demolir the silver to cut a tree.
  const pill = (tool, cell) =>
    page.evaluate(([tool, cell]) => {
      window.session.selectTool(tool);
      window.session.setHover(cell);
      const before = document.querySelector('.tag').textContent;
      window.session.refresh();
      // Wait for the pill to change from the last hover (up to 2 s), then read it.
      return new Promise((ok) => {
        const t0 = performance.now();
        const read = () => {
          const t = document.querySelector('.tag');
          if (t.textContent === before && performance.now() - t0 < 2000) return setTimeout(read, 50);
          ok({ shown: !t.classList.contains('hidden'), text: t.textContent, bad: t.classList.contains('bad') });
        };
        setTimeout(read, 250);
      });
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
  await page.goto(`${BASE}?seed=7`, { timeout: 90000 });
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
      // As a player would: a button below the fold of the column is scrolled into view first.
      const el = document.querySelector(`[data-spot="${spot}"]`);
      el.scrollIntoView({ block: 'nearest' });
      const b = el.getBoundingClientRect();
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
  /** The hover pill's text; `want` waits (up to 3 s) for it to contain that word, so an earlier step's pill is not read. */
  const pill = async (want = '') => {
    await page
      .waitForFunction((w) => { const t = document.querySelector('.tag'); return !t.classList.contains('hidden') && t.textContent.includes(w); }, want, { timeout: 3000 })
      .catch(() => {});
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
  assert((await step()) === 'lumber', `a field ends step 3 (${JSON.stringify(f)})`);

  // 4. Lumber (wood before the house; no plaza in the tutorial): its preview says the wood and the cuts.
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
  const wood = await pill('Corta');
  assert(wood.startsWith('Rende') && wood.includes('madeira') && wood.includes('Corta 1 árvore'), `the lumber preview says the wood and the cuts (${wood})`);
  await shotStep('4-lumber');
  const tipOver = await page.evaluate(() => {
    const a = document.querySelector('.toolballoon').getBoundingClientRect();
    const b = document.querySelector('.tutorial').getBoundingClientRect();
    return a.bottom > b.top + 1 && a.right > b.left && b.right > a.left;
  });
  assert(!tipOver, 'the chosen building\'s balloon stays above the tutorial bubble');
  const lb = await build(lumberRect);
  // The new lumber goes up inside a scaffold for a moment.
  await page.waitForTimeout(450);
  await shotStep('4-scaffold');
  assert((await step()) === 'house', `a lumber ends step 4 (${JSON.stringify(lb)})`);

  // 5. House near the tents: the green spots show (any free plot on the road).
  await tapSpot('build-house');
  await settle();
  await inView('house');
  await shotStep('5-house');
  const houseRect = await page.evaluate(() => window.session.stepSpot('house'));
  assert(houseRect, 'the house step has a spot without any plaza');
  const hs = await build(houseRect);
  assert((await step()) === 'wedding', `a house ends step 5 (${JSON.stringify(hs)})`);

  // 6. The wedding: the clock runs; the step ends with the first wedding or after its weeks.
  const wedStart = await page.evaluate(() => window.state.week);
  // Every toast shown from here on (on the phone one may wait in line, then come and go).
  await page.evaluate(() => {
    window.toastsSeen = [];
    const box = document.querySelector('.toasts');
    new MutationObserver(() => {
      for (const t of box.querySelectorAll('.toast')) if (!window.toastsSeen.includes(t.textContent)) window.toastsSeen.push(t.textContent);
    }).observe(box, { childList: true });
  });
  await page.evaluate(() => window.session.setSpeed(3));
  await page.waitForTimeout(800);
  await shotStep('6-wedding');
  await page.waitForFunction(() => window.session.guide?.step === null, null, { timeout: 120000 }).catch(() => {});
  const wed = await page.evaluate((w) => ({ weeks: window.state.week - w, wedding: window.state.milestones.includes('firstWedding') }), wedStart);
  assert(wed.weeks <= TUTORIAL.weddingStepMaxWeeks + 1, `the wedding step ends within weddingStepMaxWeeks (${JSON.stringify(wed)})`);
  await page.evaluate(() => window.session.setSpeed(0));
  assert(await page.evaluate(() => !!window.session.guide && !window.session.guide.running), 'the main steps end after the wedding step');
  // On the phone (two toasts at once) it may wait in line behind the goal and the wedding.
  await page.waitForFunction(() => window.toastsSeen.some((t) => t.includes('Casais novos precisam de casa')), null, { timeout: 8000 }).catch(() => {});
  const end = await page.evaluate(() => window.toastsSeen.join(' | '));
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
  // The throttle itself (frame counts alone depend on how fast this machine draws with SwiftShader):
  // paused and still it holds frames back, running it never does.
  const idle = () => page.evaluate(() => window.view3d.game.idle);
  assert((await idle()) === true, 'paused and still: frames are held back');
  await page.evaluate(() => window.session.setSpeed(1));
  await page.waitForTimeout(300);
  const running = await framesIn(2000);
  assert((await idle()) === false && running > 0, `running: no frame is held back (${running} in 2 s)`);
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
  await page.goto(`${BASE}?seed=7`, { timeout: 90000 });
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

/**
 * A rich street in 3D (PC): houses of every level in their six looks (yard jars or a washing line, on
 * the side of the mirroring), the road paved near the altar and beside stone houses, worn beside mud
 * houses and the market, packed earth by the tents; a full granary yard and a level-3 market.
 */
async function town3dScenario(page) {
  await open3dGame(page);
  const out = await page.evaluate(() => {
    const { state: s, core } = window;
    s.silver = s.wood = s.stone = 1e6;
    s.feature = s.feature.map(() => null);
    for (const b of s.buildings.filter((b) => b.kind !== 'altar')) core.clearCell(s, b.x, b.y);
    s.unlocked.push('granary', 'plaza', 'market', 'workshop', 'quarry', 'park');
    const put = (kind, x, y) => {
      const r = core.place(s, kind, x, y);
      if (!r.ok) throw new Error(`no ${kind} at ${x},${y}: ${r.reason}`);
      return s.grid[y * s.cols + x];
    };
    // East side: levels 1..4 down the road; west side: level 2 and 3 in the other looks.
    [[28, 1, 1], [30, 2, 1], [32, 3, 2], [34, 4, 4]].forEach(([y, level, variant], k) => Object.assign(put('house', 25, y), { level, variant, mirrored: k % 2 === 1 }));
    [[28, 2, 2], [30, 2, 4], [32, 3, 1], [34, 3, 5]].forEach(([y, level, variant], k) => Object.assign(put('house', 22, y), { level, variant, mirrored: k % 2 === 0 }));
    const g = put('granary', 25, 38);
    const m = put('market', 22, 38);
    m.level = 3;
    // Every walker type has its building: field, workshop, plaza, woodcutter and quarry along the road.
    put('field', 25, 42);
    put('workshop', 21, 42).variant = 1; // the smithy: anvil and forge in the yard
    put('plaza', 25, 44);
    put('lumber', 22, 45);
    put('quarry', 25, 46);
    // People in the houses: more walkers on the streets.
    for (const h of s.buildings.filter((b) => b.kind === 'house'))
      for (let k = 0; k < 4; k++) core.addPerson(s, { sex: k % 2 ? 'f' : 'm', age: 20 + k * 9, houseId: h.id, caravan: 0, clan: h.id }, () => 0.5);
    core.refreshCity(s);
    s.food = core.foodCapacity(s);
    window.session.refresh();
    window.view3d.rig.set({ x: 24.5, z: 34, dist: 15 });
    return { granary: g.connected, market: m.connected };
  });
  assert(out.granary && out.market, `the granary and the market are on the road (${JSON.stringify(out)})`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/town3d-pc.png` });
  await page.evaluate(() => window.view3d.rig.set({ x: 24.5, z: 38.5, dist: 9 }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/town3d-pc-granary.png` });
  await page.evaluate(() => window.view3d.rig.set({ x: 24, z: 31, dist: 8 }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/town3d-pc-houses.png` });
  // The streets with people carrying their things (jar, basket, sickle, log, cart, staff, goods) and their animals.
  const walkers = await page.evaluate(() => window.view3d.info().walkers);
  assert(walkers >= 12, `a lived-in street has walkers (${walkers})`);
  await page.evaluate(() => {
    window.session.setSpeed(1);
    window.view3d.rig.set({ x: 24.5, z: 36, dist: 7 });
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/town3d-pc-people.png` });
  await page.evaluate(() => window.session.setSpeed(0));
  // Every walker is a resident: a click on one opens their sheet with their name.
  await page.waitForTimeout(300);
  const free = (p) => p.sx > 120 && p.sx < 1100 && p.sy > 150 && p.sy < 620;
  // An adult (who can change job): the sheet shows "Mudar" (plan B2).
  const adult = (id) => window.core.canWork(window.state, window.state.people.find((p) => p.id === id));
  const shown = await page.evaluate((src) => {
    const ok = new Function('return ' + src)();
    // Only a walker a click picks (not a neighbour standing beside them at a door).
    return window.view3d.residents().map((r) => ({ ...r, adult: ok(r.id), alone: window.view3d.personAt(r.sx, r.sy) === r.id }));
  }, adult.toString());
  const pickable = shown.filter((r) => free(r) && r.alone);
  const someone = pickable.find((r) => r.adult) ?? pickable[0];
  assert(someone, 'a resident walks in view');
  const name = await page.evaluate((id) => window.session.nameOf(id), someone.id);
  await page.mouse.click(someone.sx, someone.sy);
  await page.waitForTimeout(400);
  const sheet = await page.evaluate(() => {
    const el = document.querySelector('[data-spot="sheet"]');
    return el && !el.classList.contains('hidden') ? el.textContent : null;
  });
  assert(sheet && sheet.includes(name), `a click on a walker opens ${name}'s sheet (${sheet?.slice(0, 60)})`);
  await page.screenshot({ path: `${OUT}/town3d-pc-person.png` });
  // "Mudar" opens the short list of free jobs (and "Sem trabalho"); Esc closes the list, then the sheet.
  if (someone.adult) {
    await page.click('[data-spot="sheet-job"]');
    await page.waitForTimeout(200);
    const list = await page.evaluate(() => ({
      jobs: [...document.querySelectorAll('[data-spot="sheet"] [data-job]')].map((b) => b.textContent),
      text: document.querySelector('[data-spot="sheet"]').textContent,
    }));
    assert(list.jobs.length >= 1 || list.text.includes('Nenhuma vaga livre'), `Mudar lists the free jobs or says there is none (${JSON.stringify(list.jobs)})`);
    await page.screenshot({ path: `${OUT}/town3d-pc-person-job.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    assert(await page.evaluate(() => !document.querySelector('[data-spot="sheet"]').classList.contains('hidden') && !document.querySelector('[data-job]')), 'Esc closes the list first');
  }
  await page.keyboard.press('Escape');
  // Around the town: pigeons on the altar court, a goat and chickens by the tent, the donkey at the market.
  const ambient = await page.evaluate(() => window.view3d.info().ambient);
  assert(ambient >= 6 + 2 + 3, `animals, boats and washerwomen around the town (${ambient})`);
  await page.evaluate(() => window.view3d.rig.set({ x: 24, z: 26, dist: 9 }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/town3d-pc-altar.png` });
  // The river nearest the altar: fishing boats and washerwomen on the bank.
  await page.evaluate(() => {
    const s = window.state;
    let best = null;
    for (let i = 0; i < s.ground.length; i++)
      if (s.ground[i] === 'river') {
        const x = i % s.cols, y = Math.floor(i / s.cols), d = Math.hypot(x - 24, y - 24);
        if (!best || d < best.d) best = { x, y, d };
      }
    window.view3d.rig.set({ x: best.x + 0.5, z: best.y + 0.5, dist: 10 });
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/town3d-pc-river.png` });
  // The plaza: flagstones, an ochre awning over a mat, benches and a fig tree (no well).
  await page.evaluate(() => window.view3d.rig.set({ x: 26, z: 45, dist: 6 }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/town3d-pc-plaza.png` });
  // The workshop's yard shows its craft.
  await page.evaluate(() => window.view3d.rig.set({ x: 22.5, z: 43.5, dist: 7 }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/town3d-pc-workshop.png` });
  if (process.env.CRAFTS)
    for (let v = 2; v <= 5; v++) {
      await page.evaluate((v) => {
        window.state.grid[42 * window.state.cols + 21].variant = v;
        window.session.refresh();
      }, v);
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/town3d-pc-workshop-${v}.png` });
    }
}

/**
 * The town at night and in a winter without firewood (plano-beleza E1-E3, Q1-Q6): a street of houses of
 * every level with an empty stone house and an empty big house, two fields and a loose road off the
 * network. Lit windows on the lived-in .glb stone and big houses (none on the empty ones); with
 * `s.cold` no house smokes; the loose road is dashed; the altar fire burns in layers; at most 120 calls.
 */
async function night3dScenario(page, form) {
  await open3dGame(page);
  const n = (name) => `night3d-${form}-${name}`;
  await page.evaluate(() => {
    const { state: s, core } = window;
    s.silver = s.wood = s.stone = 1e6;
    for (const b of s.buildings.filter((b) => b.kind !== 'altar')) core.clearCell(s, b.x, b.y);
    s.unlocked.push('field');
    const put = (kind, x, y) => {
      const r = core.place(s, kind, x, y);
      if (!r.ok) throw new Error(`no ${kind} at ${x},${y}: ${r.reason}`);
      return s.grid[y * s.cols + x];
    };
    for (let x = 24; x <= 41; x++) core.place(s, 'road', x, 32);
    [[25, 1], [27, 2], [29, 3], [31, 4], [33, 3], [35, 4]].forEach(([x, level], k) => Object.assign(put('house', x, 30), { level, variant: k }));
    [[37, 3], [39, 4]].forEach(([x, kept]) => Object.assign(put('house', x, 30), { level: 0, emptyLevel: kept }));
    put('field', 27, 33);
    put('field', 29, 33);
    // A loose road: never joined to the altar's network.
    for (let x = 28; x <= 36; x++) core.place(s, 'road', x, 37);
    for (let y = 37; y <= 40; y++) core.place(s, 'road', 36, y);
    for (const h of s.buildings.filter((b) => b.kind === 'house' && b.level > 0))
      for (let k = 0; k < 4; k++) core.addPerson(s, { sex: k % 2 ? 'f' : 'm', age: 20 + k * 9, houseId: h.id, caravan: 0, clan: h.id }, () => 0.5);
    core.refreshCity(s);
    window.session.refresh();
  });
  await page.waitForTimeout(1500);
  const world = () =>
    page.evaluate(() => {
      const w = window.view3d.game.scene.stage.world;
      const count = (name) => {
        let c = 0;
        w.group.traverse((o) => {
          if (o.name === name) c += o.count;
        });
        return c;
      };
      return { panes: count('pane'), loose: count('loose'), share: w.smoke.mesh.material.uniforms.uShare.value, calls: window.view3d.info().calls };
    });
  const clear = { rain: 0, wet: 0, overcast: 0, puddles: 0, wind: 0.3, snowing: false };
  const look = async (view, cam, name) => {
    await page.evaluate(([view, cam]) => {
      window.view3d.view(view);
      window.view3d.rig.set(cam);
    }, [view, cam]);
    await page.waitForTimeout(1000);
    await shot(page, n(name));
    return world();
  };
  const above = { yaw: Math.PI / 4, pitch: 0.85 };
  // Night, close: windows lit on the lived-in stone and big houses (2 panes each), none on the empty ones.
  const night = await look({ day: 0.72, weather: clear }, { x: 31, z: 32, dist: 12, ...above }, 'houses');
  assert(night.panes === 4 * 2 + 1, `the 4 lived-in .glb stone and big houses have their window panes, the mud house its door, the 2 empty ones none (${night.panes})`);
  assert(night.calls <= 120, `at most 120 draw calls at night (${night.calls})`);
  await look({ day: 0.72, weather: clear }, { x: 31, z: 33, dist: 40 }, 'far');
  // The altar fire at night: tongues, embers and sparks.
  await look({ day: 0.72, weather: clear }, { x: 24, z: 24, dist: 9, ...above }, 'altar');
  // The loose road off the network: dashed and faded, also from the farthest zoom, by day.
  const day = await look({ day: 0.3, weather: clear }, { x: 32, z: 36, dist: 70 }, 'loose-far');
  assert(day.loose >= 10, `the loose road is drawn dashed (${day.loose} dashes)`);
  await look({ day: 0.3, weather: clear }, { x: 32, z: 37, dist: 14 }, 'loose');
  // Winter: every house smokes; in a winter without firewood (s.cold) none does, the altar smokes on.
  const winter = await look({ day: 0.3, pos: 20.5, weather: clear }, { x: 30, z: 31, dist: 12, ...above }, 'winter');
  assert(winter.share >= 1, `every house smokes in winter (share ${winter.share})`);
  await page.evaluate(() => (window.state.cold = true));
  const cold = await look({ day: 0.3, pos: 20.5, weather: clear }, { x: 30, z: 31, dist: 12, ...above }, 'cold');
  assert(cold.share > 0 && cold.share <= 0.05, `with s.cold no house smokes, the altar does (share ${cold.share})`);
  await look({ day: 0.72, pos: 20.5, weather: clear }, { x: 28, z: 31, dist: 12, ...above }, 'cold-night');
  await page.evaluate(() => (window.state.cold = false));
}

/**
 * The still life of the streets (plano-beleza C2): neighbours at the doors that grow with the house
 * level (a woman at the tent fire, a child playing, an elder with a staff, two neighbours talking),
 * buyers at a staffed level-3 market, olive pickers under a tree in autumn, a betrothed couple walking
 * hand in hand to the house where they marry, a family walking out of town after leaving its tent,
 * washing and awnings in the wind. Fewer at night, none from the farthest zoom; at most 120 calls.
 */
/**
 * Varied houses (plano beleza C3): the six looks of every house level along the starting road, each
 * lived in, and a row of ten mud houses as the core draws them (no two neighbours alike).
 */
async function houses3dScenario(page, form) {
  await open3dGame(page);
  const n = (name) => `houses3d-${form}-${name}`;
  await page.evaluate(() => {
    const { state: s, core } = window;
    s.silver = s.wood = s.stone = 1e6;
    s.feature = s.feature.map(() => null);
    for (const b of s.buildings.filter((b) => b.kind !== 'altar')) core.clearCell(s, b.x, b.y);
    const put = (x, y, level, variant, mirrored) => {
      const r = core.place(s, 'house', x, y);
      if (!r.ok) throw new Error(`no house at ${x},${y}: ${r.reason}`);
      const h = s.grid[y * s.cols + x];
      Object.assign(h, { level, variant, mirrored });
      for (const [sex, age] of [['m', 34], ['f', 31], ['m', 8], ['f', 66]].slice(0, level + 1)) core.addPerson(s, { sex, age, houseId: h.id, caravan: 0, clan: h.id }, () => 0.5);
      return h;
    };
    // Rows 28..38: by the road mud houses (east) and stone houses (west); behind them tents and big houses.
    for (let v = 0; v < 6; v++) {
      put(27, 28 + v * 2, 1, v, v % 2 === 1);
      put(25, 28 + v * 2, 2, v, v % 2 === 1);
      put(22, 28 + v * 2, 3, v, v % 2 === 1);
      put(20, 28 + v * 2, 4, v, v % 2 === 1);
    }
    core.refreshCity(s);
    s.food = core.foodCapacity(s);
    window.session.refresh();
    return true;
  });
  // The problem balloons (tents behind, no plaza) would hide the houses.
  await page.addStyleTag({ content: '.labels { display: none !important; }' });
  await page.waitForTimeout(1500);
  const clear = { rain: 0, wet: 0, overcast: 0, puddles: 0, wind: 0.3, snowing: false };
  const look = async (cam, name, day = 0.3) => {
    await page.evaluate(([cam, day, clear]) => {
      window.view3d.view({ day, pos: 30.5, weather: clear });
      window.view3d.rig.set(cam);
    }, [cam, day, clear]);
    await page.waitForTimeout(900);
    await shot(page, n(name));
    return page.evaluate(() => window.view3d.info());
  };
  const side = { yaw: Math.PI / 2 + 0.35, pitch: 0.6 };
  const west = { yaw: -Math.PI / 2 - 0.35, pitch: 0.6 };
  await look({ x: 27.5, z: 34, dist: 11, ...side }, 'tents');
  await look({ x: 25.5, z: 34, dist: 13, ...side }, 'mud');
  await look({ x: 22.5, z: 34, dist: 13, ...west }, 'stone');
  await look({ x: 20.5, z: 34, dist: 15, ...west }, 'big');
  const all = await look({ x: 24, z: 34, dist: 26, yaw: Math.PI / 4, pitch: 0.8 }, 'all');
  assert(all.calls <= 120, `at most 120 draw calls (${all.calls})`);
  assert(all.triangles <= 300000, `at most 300 thousand triangles (${all.triangles})`);
  // At night the kits stay dark and the street still lit.
  await look({ x: 25.5, z: 34, dist: 13, ...side }, 'night', 0.72);
  // A street of ten mud houses with the looks the core draws: no two neighbours alike.
  const row = await page.evaluate(() => {
    const { state: s, core } = window;
    for (const b of s.buildings.filter((b) => b.kind === 'house')) core.clearCell(s, b.x, b.y);
    let seed = 11;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const houses = [];
    for (let k = 0; k < 10; k++) {
      core.place(s, 'house', 25, 28 + k * 2);
      const h = s.grid[(28 + k * 2) * s.cols + 25];
      h.level = 2;
      core.rollLook(s, h, rng);
      core.addPerson(s, { sex: 'f', age: 30, houseId: h.id, caravan: 0, clan: h.id }, () => 0.5);
      houses.push(h);
    }
    core.refreshCity(s);
    window.session.refresh();
    return houses.map((h) => [h.variant, h.mirrored]);
  });
  for (let k = 1; k < row.length; k++) assert(row[k][0] !== row[k - 1][0], `neighbouring mud houses differ (${JSON.stringify(row)})`);
  await page.waitForTimeout(800);
  await look({ x: 25.5, z: 37, dist: 16, ...side }, 'mud-row');
  await look({ x: 25.5, z: 37, dist: 20, yaw: -Math.PI / 2 - 0.3, pitch: 0.55 }, 'mud-row-street');
}

/**
 * The river by the town (plano beleza C6): reeds and stones at the water's edge up close, and the
 * sun glinting on the ripples in the late afternoon (looking toward the sun; none with it behind).
 */
async function river3dScenario(page) {
  await open3dGame(page);
  const n = (name) => `river3d-pc-${name}`;
  const at = await page.evaluate(() => {
    const s = window.state;
    const altar = s.buildings.find((b) => b.kind === 'altar');
    let best = null;
    for (let y = 1; y < s.rows - 1; y++)
      for (let x = 1; x < s.cols - 1; x++) {
        if (s.ground[y * s.cols + x] === 'river') continue;
        const bank = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => s.ground[(y + dy) * s.cols + x + dx] === 'river');
        const d = Math.hypot(x - altar.x, y - altar.y);
        if (bank && (!best || d < best.d)) best = { x: x + 0.5, z: y + 0.5, d };
      }
    return best;
  });
  assert(at && at.d <= 22, `a river bank near the town (${JSON.stringify(at)})`);
  const reeds = await page.evaluate(() => {
    let n = 0;
    window.view3d.game.scene.stage.world.detail.traverse((m) => (n += m.isInstancedMesh ? m.count : 0));
    return n;
  });
  assert(reeds > 0, 'the ground detail is drawn');
  await page.addStyleTag({ content: '.labels { display: none !important; }' });
  const clear = { rain: 0, wet: 0, overcast: 0, puddles: 0, wind: 0.4, snowing: false };
  const look = async (name, day, cam) => {
    await page.evaluate(([at, day, clear, cam]) => {
      window.view3d.view({ day, pos: 30.5, weather: clear, force: { snow: false, drought: false } });
      window.view3d.rig.set({ x: at.x, z: at.z, ...cam });
    }, [at, day, clear, cam]);
    await page.waitForTimeout(900);
    await shot(page, n(name));
  };
  await look('bank', 0.3, { dist: 8, yaw: Math.PI / 4, pitch: 0.6 });
  // Late afternoon, looking west toward the low sun over the water.
  // Late afternoon: toward the sun the ripples sparkle; with the sun behind, none.
  await look('glint', 0.44, { dist: 16, yaw: Math.PI, pitch: 0.42 });
  await look('glint-away', 0.44, { dist: 16, yaw: 0, pitch: 0.42 });
}

/**
 * Trees (plano beleza C6): a grove of olive cells (drawn as olives, almonds and figs) with a row of
 * palms, up close through the year: almonds in white-pink bloom at the end of winter, everything in
 * leaf in summer, figs yellow and almonds bare in late autumn, both bare in winter.
 */
async function trees3dScenario(page) {
  await open3dGame(page);
  const n = (name) => `trees3d-pc-${name}`;
  const at = await page.evaluate(() => {
    const { state: s, core } = window;
    s.feature = s.feature.map(() => null);
    for (const b of s.buildings.filter((b) => b.kind !== 'altar')) core.clearCell(s, b.x, b.y);
    // An open 7 x 6 block of land nearest the altar.
    const altar = s.buildings.find((b) => b.kind === 'altar');
    let best = null;
    for (let y = 2; y < s.rows - 8; y++)
      for (let x = 2; x < s.cols - 9; x++) {
        let ok = true;
        for (let dy = 0; dy < 6 && ok; dy++) for (let dx = 0; dx < 7 && ok; dx++) { const i = (y + dy) * s.cols + x + dx; ok = s.ground[i] !== 'river' && !s.grid[i] && !s.roads[i]; }
        const d = Math.hypot(x - altar.x - 6, y - altar.y);
        if (ok && (!best || d < best.d)) best = { x, y, d };
      }
    for (let dy = 0; dy < 6; dy++) for (let dx = 0; dx < 7; dx++) s.feature[(best.y + dy) * s.cols + best.x + dx] = dx === 6 ? 'palm' : 'olive';
    core.refreshCity(s);
    window.session.refresh();
    return { x: best.x + 3.5, z: best.y + 3 };
  });
  await page.addStyleTag({ content: '.labels { display: none !important; }' });
  await page.waitForTimeout(1500);
  const clear = { rain: 0, wet: 0, overcast: 0, puddles: 0, wind: 0.3, snowing: false };
  const look = async (name, pos) => {
    await page.evaluate(([at, pos, clear]) => {
      window.view3d.view({ day: 0.33, pos, weather: clear, force: { snow: false, drought: false } });
      window.view3d.rig.set({ x: at.x, z: at.z, dist: 10, yaw: Math.PI / 4, pitch: 0.55 });
    }, [at, pos, clear]);
    await page.waitForTimeout(900);
    await shot(page, n(name));
    return page.evaluate(() => window.view3d.info());
  };
  await look('bloom', 22);
  const summer = await look('summer', 44);
  await look('autumn', 11);
  await look('winter', 16);
  assert(summer.calls <= 120, `at most 120 draw calls (${summer.calls})`);
  assert(summer.triangles <= 300000, `at most 300 thousand triangles (${summer.triangles})`);
}

/**
 * Fields (plano beleza C6): the four crops by the river and away from it, up close; in a dry year
 * the fields away from the water grow thin and yellow while those by it stay green; ripe gold in
 * spring. Within the draw-call and triangle limits.
 */
async function fields3dScenario(page) {
  await open3dGame(page);
  const n = (name) => `fields3d-pc-${name}`;
  const spots = await page.evaluate(() => {
    const { state: s, core } = window;
    s.silver = s.wood = s.stone = 1e6;
    s.unlocked = [...new Set([...s.unlocked, 'field'])];
    s.feature = s.feature.map(() => null);
    for (const b of s.buildings.filter((b) => b.kind !== 'altar')) core.clearCell(s, b.x, b.y);
    const river = [];
    for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++) if (s.ground[y * s.cols + x] === 'river') river.push([x, y]);
    const dist = (x, y) => Math.min(...river.map(([rx, ry]) => Math.max(Math.abs(rx - x), Math.abs(ry - y), Math.abs(rx - x - 1), Math.abs(ry - y - 1))));
    const altar = s.buildings.find((b) => b.kind === 'altar');
    const placed = { near: [], far: [] };
    // Four fields in a square (one per crop) by the river and four far from it, nearest the altar.
    const AT = [[0, 0], [2, 0], [0, 2], [2, 2]];
    const rowAt = (ok) => {
      const cands = [];
      for (let y = 2; y < s.rows - 5; y++)
        for (let x = 2; x < s.cols - 5; x++) {
          let good = true;
          for (let k = 0; k < 4 && good; k++) good = ok(dist(x + AT[k][0], y + AT[k][1])) && core.checkPlace(s, 'field', x + AT[k][0], y + AT[k][1]).ok;
          if (good) cands.push({ x, y, d: Math.hypot(x - altar.x, y - altar.y) });
        }
      return cands.sort((a, b) => a.d - b.d)[0];
    };
    for (const [key, ok] of [['near', (d) => d <= 3], ['far', (d) => d >= 8]]) {
      const r = rowAt(ok);
      if (!r) throw new Error(`no row of fields ${key}`);
      for (let k = 0; k < 4; k++) {
        const [fx, fy] = [r.x + AT[k][0], r.y + AT[k][1]];
        const res = core.place(s, 'field', fx, fy);
        if (!res.ok) throw new Error(`no field at ${fx},${fy}: ${res.reason}`);
        s.grid[fy * s.cols + fx].variant = k;
      }
      placed[key] = { x: r.x + 2, z: r.y + 2 };
    }
    core.refreshCity(s);
    window.session.refresh();
    return placed;
  });
  await page.addStyleTag({ content: '.labels { display: none !important; }' });
  await page.waitForTimeout(1500);
  const clear = { rain: 0, wet: 0, overcast: 0, puddles: 0, wind: 0.4, snowing: false };
  const look = async (at, name, pos, drought = false) => {
    await page.evaluate(([at, pos, drought, clear]) => {
      window.view3d.view({ day: 0.32, pos, weather: clear, force: { drought } });
      window.view3d.rig.set({ x: at.x, z: at.z, dist: 9, yaw: Math.PI / 4, pitch: 0.62 });
    }, [at, pos, drought, clear]);
    await page.waitForTimeout(900);
    await shot(page, n(name));
    return page.evaluate(() => window.view3d.info());
  };
  // Late winter: green and grown. Mid spring: ripe gold; in a dry year (the drought shows from mid
  // spring) the fields by the river stay gold, those away from it thin and straw-brown.
  await look(spots.near, 'winter', 22);
  const spring = await look(spots.near, 'spring', 33);
  await look(spots.near, 'dry-near', 33, true);
  await look(spots.far, 'dry-far', 33, true);
  assert(spring.calls <= 120, `at most 120 draw calls (${spring.calls})`);
  assert(spring.triangles <= 300000, `at most 300 thousand triangles (${spring.triangles})`);
}

/**
 * Ground and roads (plano beleza C4): trodden earth before the doors and along the roads, paths
 * between houses 1 to 3 cells apart, a side street with an edge and wheel ruts, a trail, the busy
 * street by the altar paved with flagstones and a kerb, tufts on the grass; from far away the roads
 * still read and the tufts are gone.
 */
async function ground3dScenario(page, form) {
  await open3dGame(page);
  const n = (name) => `ground3d-${form}-${name}`;
  await page.evaluate(() => {
    const { state: s, core } = window;
    s.silver = s.wood = s.stone = 1e6;
    s.feature = s.feature.map(() => null);
    for (const b of s.buildings.filter((b) => b.kind !== 'altar')) core.clearCell(s, b.x, b.y);
    const put = (x, y, level, people) => {
      const r = core.place(s, 'house', x, y);
      if (!r.ok) throw new Error(`no house at ${x},${y}: ${r.reason}`);
      const h = s.grid[y * s.cols + x];
      Object.assign(h, { level, variant: (x + y) % 6, mirrored: false });
      for (let k = 0; k < people; k++) core.addPerson(s, { sex: k % 2 ? 'f' : 'm', age: 30, houseId: h.id, caravan: 0, clan: h.id }, () => 0.5);
      return h;
    };
    // West of the starting road: stone houses full of people (the street by the altar gets busy).
    for (const y of [28, 30, 32, 34, 36, 40]) put(22, y, 3, 6);
    // A side street east at row 38, two mud houses below it with a gap of 2 cells (a path between them).
    for (let x = 25; x <= 36; x++) core.place(s, 'road', x, 38);
    put(27, 39, 2, 4);
    put(31, 39, 2, 4);
    // A trail: a short branch north with one tent on it.
    for (let y = 33; y <= 37; y++) core.place(s, 'road', 30, y);
    put(31, 33, 1, 2);
    core.refreshCity(s);
    s.food = core.foodCapacity(s);
    window.session.refresh();
  });
  // The open grass nearest the town (for the tufts).
  const grass = await page.evaluate(() => {
    const s = window.state;
    let best = null;
    for (let y = 2; y < s.rows - 2; y++)
      for (let x = 2; x < s.cols - 2; x++) {
        let ok = true;
        for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1 && ok; dx++) ok = s.ground[(y + dy) * s.cols + x + dx] === 'grass' && !s.grid[(y + dy) * s.cols + x + dx] && !s.roads[(y + dy) * s.cols + x + dx];
        const d = Math.hypot(x - 28, y - 34);
        if (ok && (!best || d < best.d)) best = { x: x + 0.5, z: y + 0.5, d };
      }
    return best;
  });
  assert(grass, 'there is open grass on the map');
  await page.addStyleTag({ content: '.labels { display: none !important; }' });
  await page.waitForTimeout(1500);
  const clear = { rain: 0, wet: 0, overcast: 0, puddles: 0, wind: 0.3, snowing: false };
  const look = async (cam, name, day = 0.3, pos = 30.5) => {
    await page.evaluate(([cam, day, clear, pos]) => {
      window.view3d.view({ day, pos, weather: clear });
      window.view3d.rig.set(cam);
    }, [cam, day, clear, pos]);
    await page.waitForTimeout(900);
    await shot(page, n(name));
    return page.evaluate(() => ({ ...window.view3d.info(), detail: window.view3d.game.scene.stage.world.detail.visible }));
  };
  const above = { yaw: Math.PI / 4, pitch: 0.85 };
  const near = await look({ x: 30, z: 39, dist: 9, ...above }, 'side-street');
  assert(near.detail, 'tufts and pebbles show from near');
  assert(near.calls <= 120, `at most 120 draw calls (${near.calls})`);
  await look({ x: 30.5, z: 35, dist: 7, ...above }, 'trail');
  await look({ x: 23.5, z: 29, dist: 8, ...above }, 'flags');
  await look({ x: 29, z: 41, dist: 6, yaw: 0.2, pitch: 1.2 }, 'path');
  await look({ x: grass.x, z: grass.z, dist: 6, ...above }, 'grass');
  // Straight down on the side street: the earth before the doors, the path between the two houses.
  await look({ x: 30, z: 39.5, dist: 10, yaw: 0, pitch: 1.5 }, 'top');
  await look({ x: 30, z: 39, dist: 9, ...above }, 'side-street-summer', 0.3, 45.5);
  const all = await look({ x: 26, z: 34, dist: 22, ...above }, 'town');
  assert(all.triangles <= 300000, `at most 300 thousand triangles (${all.triangles})`);
  const far = await look({ x: 26, z: 30, dist: 60 }, 'far');
  assert(!far.detail, 'no tufts from far away');
}

async function street3dScenario(page, form) {
  await open3dGame(page);
  const n = (name) => `street3d-${form}-${name}`;
  const setup = await page.evaluate(() => {
    const { state: s, core } = window;
    s.silver = s.wood = s.stone = 1e6;
    s.feature = s.feature.map(() => null);
    for (const b of s.buildings.filter((b) => b.kind !== 'altar')) core.clearCell(s, b.x, b.y);
    s.unlocked.push('market');
    const put = (kind, x, y) => {
      const r = core.place(s, kind, x, y);
      if (!r.ok) throw new Error(`no ${kind} at ${x},${y}: ${r.reason}`);
      return s.grid[y * s.cols + x];
    };
    const add = (h, sex, age) => core.addPerson(s, { sex, age, houseId: h.id, caravan: 0, clan: h.id }, () => 0.5);
    // East of the starting road: a tent, a mud house, stone houses and big houses (washing lines: variant 2 and 5).
    const east = [[28, 1, 2], [30, 2, 5], [32, 3, 2], [34, 4, 5], [36, 3, 1], [38, 4, 2]].map(([y, level, variant]) => Object.assign(put('house', 25, y), { level, variant }));
    const west = [[28, 2, 1], [30, 3, 5], [32, 4, 0]].map(([y, level, variant]) => Object.assign(put('house', 22, y), { level, variant }));
    for (const h of [...east, ...west]) {
      add(h, 'm', 34);
      add(h, 'f', 31);
      if (h.level >= 2) add(h, 'm', 8);
      if (h.level >= 3) add(h, 'f', 68);
    }
    const m = put('market', 22, 38);
    m.level = 3;
    // An olive tree behind the east houses.
    s.feature[31 * s.cols + 28] = 'olive';
    // A tent that will be left, further down the road.
    const tent = Object.assign(put('house', 25, 42), { level: 1, variant: 0 });
    for (const [sex, age] of [['m', 36], ['f', 33], ['m', 9], ['f', 5]]) add(tent, sex, age);
    // A betrothed couple walking from down the road to an empty plot to marry there.
    const plot = put('house', 22, 44);
    const home = west[0];
    const a = add(home, 'm', 21);
    const b = add(home, 'f', 19);
    a.spouseId = b.id;
    b.spouseId = a.id;
    a.engaged = b.engaged = s.week;
    const path = core.findPath(s, { x: 24, y: 36 }, core.doorsOf(s, plot));
    s.families.push({ id: s.nextId++, houseId: plot.id, members: [a.id, b.id], path: [...path, { x: plot.x, y: plot.y }], step: 0 });
    core.refreshCity(s);
    s.food = core.foodCapacity(s);
    window.session.refresh();
    return { market: m.connected && s.people.some((p) => p.jobId === m.id), tent: { id: tent.id, x: tent.x, y: tent.y }, path: path.length };
  });
  assert(setup.market, `the market is on the road and staffed (${JSON.stringify(setup)})`);
  await page.waitForTimeout(1500);
  const info = () => page.evaluate(() => window.view3d.info());
  const clear = { rain: 0, wet: 0, overcast: 0, puddles: 0, wind: 0.3, snowing: false };
  const autumn = await page.evaluate(() => {
    let w = 0;
    while (window.core.calendar(w).season !== 'autumn') w++;
    return w + 4.5;
  });
  const summer = await page.evaluate(() => {
    let w = 0;
    while (window.core.calendar(w).season !== 'summer') w++;
    return w + 4.5;
  });
  const look = async (view, cam, name, wait = 900) => {
    await page.evaluate(([view, cam]) => {
      window.view3d.view(view);
      window.view3d.rig.set(cam);
    }, [view, cam]);
    await page.waitForTimeout(wait);
    await shot(page, n(name));
    return info();
  };
  const above = { yaw: Math.PI / 4, pitch: 0.75 };
  // By day, close: the neighbours at the doors of the east houses.
  const day = await look({ day: 0.3, pos: summer, weather: clear }, { x: 24.5, z: 33, dist: 12, ...above }, 'doors');
  assert(day.idlePlanned >= 12, `the street plans its still life (${day.idlePlanned})`);
  assert(day.idle >= 10, `by day most of it is out (${day.idle} of ${day.idlePlanned})`);
  assert(day.calls <= 120, `at most 120 draw calls (${day.calls})`);
  await look({ day: 0.3, pos: summer, weather: clear }, { x: 24.5, z: 33, dist: 10, yaw: -Math.PI / 4, pitch: 0.75 }, 'doors-other-side');
  await look({ day: 0.3, pos: summer, weather: clear }, { x: 23.5, z: 40, dist: 10, ...above }, 'market');
  // Autumn: two pickers under the olive tree, one beating the branches with a pole.
  await look({ day: 0.3, pos: autumn, weather: clear }, { x: 28, z: 31.5, dist: 9, ...above }, 'olives');
  // Strong wind: the washing lines and the market's awnings move (two frames apart).
  await look({ day: 0.3, pos: summer, weather: { ...clear, wind: 1 } }, { x: 24.5, z: 36, dist: 10, ...above }, 'wind-a');
  await page.waitForTimeout(350);
  await shot(page, n('wind-b'));
  // The couple walking hand in hand up the road (their walk loops while the game is paused).
  // Wait until they are on the way (not resting at the end of their loop).
  await page.waitForFunction(() => window.view3d.game.scene.stage.world.families.figures.objects[0].instanceMatrix.array[0] !== 0, null, { timeout: 20000 }).catch(() => {});
  const at = await page.evaluate(() => {
    const m = window.view3d.game.scene.stage.world.families.figures.objects[0].instanceMatrix.array;
    return { x: m[12], z: m[14], gap: Math.hypot(m[12] - m[28], m[14] - m[30]) };
  });
  assert(at.gap > 0.05 && at.gap < 0.3, `the betrothed walk side by side, hand in hand (${at.gap.toFixed(2)} apart)`);
  await look({ day: 0.3, pos: summer, weather: clear }, { x: at.x, z: at.z, dist: 7, ...above }, 'couple', 150);
  assert((await info()).families === 1, 'the betrothed couple walks');
  // The tent's family leaves: they walk out of town with their bundles. First the caravan tents
  // cleared at the start finish walking out (on a slow phone they may still hold both groups).
  await page.waitForFunction(() => window.view3d.game.scene.stage.world.leavers.walking === 0, null, { timeout: 60000 });
  await page.evaluate((t) => {
    const { state: s, core } = window;
    core.leaveHouse(s, t.id, 'famine');
    core.vacate(s, t.id);
    window.session.refresh();
    window.view3d.game.scene.effect({ do: 'leave', x: t.x, y: t.y });
  }, setup.tent);
  // Checked as soon as they set out: on a slow phone the photo alone takes seconds, and a walk out of
  // town lasts about ten.
  await page.waitForTimeout(1200);
  const leaving = await info();
  await look({ day: 0.3, pos: summer, weather: clear }, { x: 24.5, z: 44, dist: 9, ...above }, 'leave', 600);
  const dbg = await page.evaluate((t) => {
    const s = window.state;
    const l = window.view3d.game.scene.stage.world.leavers;
    return { departed: s.departed.map((p) => [p.houseId, p.end.week, p.end.cause]), week: s.week, tent: t, grid: s.grid[t.y * s.cols + t.x]?.id, groups: l.groups.map((g) => g && g.path.length) };
  }, setup.tent);
  assert(leaving.leaving === 1, `the family walks out of town (${leaving.leaving}) ${JSON.stringify(dbg)}`);
  // Night: fewer people out, the street still reads.
  const night = await look({ day: 0.72, pos: summer, weather: clear }, { x: 24.5, z: 33, dist: 12, ...above }, 'night');
  assert(night.idle < day.idle, `fewer at night (${night.idle} < ${day.idle})`);
  assert(night.calls <= 120, `at most 120 draw calls at night (${night.calls})`);
  // From far away the still life is gone (specks), the walkers stay.
  const far = await look({ day: 0.3, pos: summer, weather: clear }, { x: 25, z: 33, dist: 60 }, 'far');
  assert(far.idle === 0, `no still life from the farthest zoom (${far.idle})`);
}

const scenarios = {
  /** The HTML title: start and, once the tutorial was seen, the tutorial again; the install button when the browser offers it. */
  async title(page) {
    await page.goto(`${BASE}?seed=${SEED}`, { timeout: 90000 });
    await page.waitForSelector('[data-spot="start"]', { timeout: 60000 });
    await shot(page, 'title');
    assert(!(await page.$('[data-spot="tutorial-again"]')), 'a first game offers no tutorial again');
    // Once the tutorial was seen, the title offers it again.
    await page.evaluate(() => localStorage.setItem('jerusalem.tutorialDone', '1'));
    await page.reload();
    await page.waitForSelector('[data-spot="tutorial-again"]', { timeout: 60000 });
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
    const install = page.locator('.install button');
    await install.waitFor({ timeout: 3000 });
    await shot(page, 'title-install');
    await install.click();
    await page.waitForTimeout(200);
    assert(await page.evaluate(() => window.__installPrompted === true), 'the Instalar app button opens the install prompt');
  },

  /** First game on a phone: the six tutorial steps, then the market. */
  play3d: { context: PHONE, run: (page) => play3dScenario(page, 'phone') },
  'play3d-pc': { context: PC, run: (page) => play3dScenario(page, 'pc') },
  'input3d-pc': { context: PC, run: input3dScenario },
  touch3d: { context: PHONE, run: touch3dScenario },
  'context3d-pc': { context: PC, run: context3dScenario },
  'town3d-pc': { context: PC, run: town3dScenario },
  'night3d-pc': { context: PC, run: (page) => night3dScenario(page, 'pc') },
  'night3d-phone': { context: PHONE, run: (page) => night3dScenario(page, 'phone') },
  'street3d-pc': { context: PC, run: (page) => street3dScenario(page, 'pc') },
  'street3d-phone': { context: PHONE, run: (page) => street3dScenario(page, 'phone') },
  'houses3d-pc': { context: PC, run: (page) => houses3dScenario(page, 'pc') },
  'river3d-pc': { context: PC, run: (page) => river3dScenario(page) },
  'trees3d-pc': { context: PC, run: (page) => trees3dScenario(page) },
  'fields3d-pc': { context: PC, run: (page) => fields3dScenario(page) },
  'ground3d-pc': { context: PC, run: (page) => ground3dScenario(page, 'pc') },
  'ground3d-phone': { context: PHONE, run: (page) => ground3dScenario(page, 'phone') },
  'houses3d-phone': { context: PHONE, run: (page) => houses3dScenario(page, 'phone') },
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
  'music3d-phone': { context: PHONE, run: (page) => music3dScenario(page, 'phone') },
  'music3d-pc': { context: PC, run: (page) => music3dScenario(page, 'pc') },

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

let failed = 0;
for (const [k, [name, def]] of Object.entries(scenarios).entries()) {
  if (filter && !filter.split(',').some((f) => name.includes(f))) continue;
  if (k % SHARD_N !== SHARD_K) continue;
  const run = typeof def === 'function' ? def : def.run;
  for (let attempt = 0; attempt < 3; attempt++) {
    // Another process may have killed the browser (other projects' scripts kill every headless Chrome).
    if (!browser.isConnected()) browser = await relaunch();
    let context, page;
    try {
      context = await browser.newContext(def.context ?? PC);
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

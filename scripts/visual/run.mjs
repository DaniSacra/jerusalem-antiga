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
 * The maquete finish: tilt-shift at the top and bottom, a warm grade, and the contact shadow at the foot
 * of the buildings (stronger under clouds and at night); off at the minimum quality.
 */
async function maquete3dScenario(page) {
  await open3dGame(page);
  const n = (name) => `maquete3d-pc-${name}`;
  const at = await page.evaluate(() => {
    const { state: s, core } = window;
    s.silver = s.wood = s.stone = 1e6;
    s.unlocked = [...new Set([...s.unlocked, 'house'])];
    const altar = s.buildings.find((b) => b.kind === 'altar');
    const cands = [];
    for (let y = 1; y < s.rows - 1; y++) for (let x = 1; x < s.cols - 1; x++) if (core.checkPlace(s, 'house', x, y).ok) cands.push({ x, y, d: Math.hypot(x - altar.x, y - altar.y) });
    let built = 0;
    for (const c of cands.sort((a, b) => a.d - b.d)) if (built < 10 && core.place(s, 'house', c.x, c.y).ok) built++;
    core.refreshCity(s);
    window.session.refresh();
    return { x: altar.x + 1, z: altar.y + 1, built };
  });
  assert(at.built >= 6, `houses around the altar (${at.built})`);
  await page.addStyleTag({ content: '.labels { display: none !important; }' });
  const look = async (name, day, overcast) => {
    await page.evaluate(([at, day, overcast]) => {
      window.view3d.view({ day, pos: 30.5, weather: { rain: 0, wet: 0, overcast, puddles: 0, wind: 0.3, snowing: false } });
      window.view3d.rig.set({ x: at.x, z: at.z, dist: 16, yaw: Math.PI / 4, pitch: 0.8 });
    }, [at, day, overcast]);
    await page.waitForTimeout(1000);
    await shot(page, n(name));
    return page.evaluate(() => window.view3d.info());
  };
  const sunny = await look('day', 0.3, 0);
  assert(sunny.calls <= 120, `ten empty plots and houses: at most 120 draw calls (${sunny.calls})`);
  assert(sunny.finish === true, 'the finish is on at high quality');
  await look('overcast', 0.3, 1);
  await look('night', 0.72, 0);
  await page.evaluate(() => window.view3d.quality('min'));
  const min = await look('min', 0.3, 0);
  assert(min.finish === false, 'the finish is off at the minimum quality');
  await page.evaluate(() => window.view3d.quality('high'));
}

/**
 * The Temple in stages (plano Desafio 2.5): the ruins, the altar's works and the altar restored with
 * its flock, each stage of the Temple under way with its builders (and one stopped, tools on the
 * ground), the consecrated Temple; by night too and from afar (≤ 120 draw calls at the works).
 */
async function templeStages3dScenario(page, phone) {
  await open3dGame(page);
  const n = (name) => `templestages3d-${phone ? 'phone' : 'pc'}-${name}`;
  const at = await page.evaluate(() => {
    const { state: s, core } = window;
    s.silver = s.wood = s.stone = 1e6;
    s.unlocked = [...new Set([...s.unlocked, 'temple'])];
    const altar = s.buildings.find((b) => b.kind === 'altar');
    let t = s.buildings.find((b) => b.kind === 'temple');
    if (!t) {
      let best = null;
      for (let y = 1; y < s.rows - 7; y++)
        for (let x = 1; x < s.cols - 7; x++) {
          const d = Math.hypot(x - altar.x, y - altar.y);
          if ((!best || d < best.d) && core.checkPlace(s, 'temple', x, y).ok) best = { x, y, d };
        }
      if (!best || !core.place(s, 'temple', best.x, best.y).ok) return null;
      t = s.buildings.find((b) => b.kind === 'temple');
    }
    core.refreshCity(s);
    window.session.refresh();
    return { temple: { x: t.x + t.w / 2, z: t.y + t.h / 2 }, altar: { x: altar.x + altar.w / 2, z: altar.y + altar.h / 2 } };
  });
  assert(at, 'the Temple has a place');
  await page.addStyleTag({ content: '.labels { display: none !important; }' });
  // Sets the stages built, the one under way (its share of work done) and its builders at work.
  const stage = (done, active, share, crew) =>
    page.evaluate(([done, active, share, crew]) => {
      const { state: s, core } = window;
      const st = core.TEMPLE_STAGES[done];
      s.temple = { done, active: active && !!st, progress: st ? Math.floor(st.work * share) : 0 };
      for (const b of s.buildings) if (b.kind === 'altar' || b.kind === 'temple') b.builders = undefined;
      s.people = s.people.filter((p) => p.houseId !== -7);
      const site = st && s.buildings.find((b) => b.kind === st.site);
      if (active && site) {
        site.builders = st.builders;
        for (let k = 0; k < crew; k++) core.addPerson(s, { sex: 'm', age: 30, houseId: -7, caravan: 0, clan: 1 }, () => 0.5);
      }
      core.refreshCity(s);
      if (active && site) for (const p of s.people.filter((p) => p.houseId === -7)) p.jobId = site.id;
      // Stopped works: nobody at them (the town's own people would fill the jobs).
      if (active && site && !crew) for (const p of s.people) if (p.jobId === site.id) p.jobId = null;
      s.livestock = done >= 1 ? 20 : 0;
      s.offered = done >= 1;
      window.session.refresh();
      window.view3d.cityChanged?.();
      return core.buildersAtWork(s);
    }, [done, active, share, crew]);
  // The builders walk and hammer only while the game runs: the clock runs for less than a week per shot.
  const look = async (name, where, day = 0.32, cam = {}) => {
    await page.evaluate(([where, day, cam]) => {
      window.view3d.view({ day, pos: 30.5, weather: { rain: 0, wet: 0, overcast: 0, puddles: 0, wind: 0.3, snowing: false } });
      window.view3d.rig.set({ x: where.x, z: where.z, dist: 13, pitch: 0.62, ...cam });
      window.session.setSpeed(1);
    }, [where, day, cam]);
    await page.waitForTimeout(1600);
    await shot(page, n(name));
    return page.evaluate(() => {
      window.session.setSpeed(0);
      return window.view3d.info();
    });
  };
  await stage(0, false, 0, 0);
  await look('ruins', at.temple, 0.32, { dist: 18 });
  if (!phone) {
    const busy = await stage(0, true, 0.5, 2);
    assert(busy >= 2, `builders at the altar (${busy})`);
    const w = await look('altar-works', at.altar, 0.32, { dist: 10 });
    assert(w.haulers >= 2, `the altar's builders are drawn (${w.haulers})`);
  }
  await stage(1, false, 0, 0);
  await look('altar-restored', at.altar, 0.32, { dist: 10 });
  if (!phone) {
    // Without the week's offering the restored altar's fire is out.
    await page.evaluate(() => {
      window.state.offered = false;
      window.session.refresh();
    });
    await look('altar-cold', at.altar, 0.72, { dist: 10 });
  }
  await stage(1, true, 0.5, 4);
  await look('alicerce', at.temple);
  await stage(2, true, 0.5, 5);
  const walls = await look('paredes', at.temple);
  assert(walls.haulers >= 5, `the builders of the walls are drawn (${walls.haulers})`);
  const far = await look('paredes-far', at.temple, 0.32, { dist: 34 });
  assert(far.calls <= 120, `the works from afar: at most 120 draw calls (${far.calls})`);
  if (!phone) {
    await stage(2, true, 0.5, 0);
    await look('paredes-stopped', at.temple);
  }
  await stage(3, true, 0.6, 6);
  await look('portico', at.temple);
  if (!phone) {
    await look('portico-night', at.temple, 0.72);
    await stage(4, true, 0.5, 4);
    await look('consagracao', at.temple);
  }
  await stage(5, false, 0, 0);
  await look('consecrated', at.temple, 0.32, { dist: 15 });
  if (phone) return;
  // A pasture on grass with its shepherd and flock (half the most livestock), then in winter at the shelter.
  const pasture = await page.evaluate(() => {
    const { state: s, core } = window;
    s.unlocked = [...new Set([...s.unlocked, 'pasture'])];
    const altar = s.buildings.find((b) => b.kind === 'altar');
    // On the map's own grass (the flock grazes the grass around it), nearest the altar.
    const grass = (x, y) => {
      let k = 0;
      for (let j = y - 2; j < y + 5; j++) for (let i = x - 2; i < x + 5; i++) if (s.ground[j * s.cols + i] === 'grass') k++;
      return k;
    };
    let best = null;
    for (let y = 3; y < s.rows - 6; y++)
      for (let x = 3; x < s.cols - 6; x++) {
        const d = Math.hypot(x - altar.x, y - altar.y);
        if ((!best || d < best.d) && core.checkPlace(s, 'pasture', x, y).ok && grass(x, y) >= 30) best = { x, y, d };
      }
    if (!best) return null;
    core.place(s, 'pasture', best.x, best.y);
    const b = s.grid[best.y * s.cols + best.x];
    core.addPerson(s, { sex: 'm', age: 30, houseId: -7, caravan: 0, clan: 1 }, () => 0.5).jobId = b.id;
    s.livestock = core.RULES.livestockStorage / 2;
    core.refreshCity(s);
    for (const p of s.people.filter((p) => p.houseId === -7)) p.jobId = b.id;
    window.session.refresh();
    return { x: b.x + 1.5, z: b.y + 1.5 };
  });
  assert(pasture, 'room for a pasture');
  const p = await look('pasture', pasture, 0.32, { dist: 9 });
  assert(p.ambient > 0, 'the flock is drawn');
  await page.evaluate(() => {
    const s = window.state;
    for (let w = s.week; w < s.week + 60; w++) if (window.core.seasonOf(w) === 'winter') { s.week = w; break; }
    window.session.refresh();
  });
  await look('pasture-winter', pasture, 0.32, { dist: 9 });
}

/** The Temple drawn in code (plano beleza C8): close by day from the front and the side, at night, and from the opening view. */
async function sanctuary3dScenario(page) {
  await open3dGame(page);
  const n = (name) => `sanctuary3d-pc-${name}`;
  const at = await page.evaluate(() => {
    const { state: s, core } = window;
    s.silver = s.wood = s.stone = 1e6;
    s.unlocked = [...new Set([...s.unlocked, 'temple'])];
    s.feature = s.feature.map(() => null);
    const altar = s.buildings.find((b) => b.kind === 'altar');
    let best = null;
    for (let y = 1; y < s.rows - 7; y++)
      for (let x = 1; x < s.cols - 7; x++) {
        const d = Math.hypot(x - altar.x, y - altar.y);
        if ((!best || d < best.d) && core.checkPlace(s, 'temple', x, y).ok) best = { x, y, d };
      }
    if (!s.buildings.some((b) => b.kind === 'temple') && (!best || !core.place(s, 'temple', best.x, best.y).ok)) return null;
    // Consecrated: the whole Temple (the stages are templestages3d).
    s.temple = { done: core.TEMPLE_STAGES.length, active: false, progress: 0 };
    core.refreshCity(s);
    window.session.refresh();
    const t = s.buildings.find((b) => b.kind === 'temple');
    return { x: t.x + t.w / 2, z: t.y + t.h / 2 };
  });
  assert(at, 'the Temple has a place near the altar');
  await page.addStyleTag({ content: '.labels { display: none !important; }' });
  const look = async (name, day, cam) => {
    await page.evaluate(([at, day, cam]) => {
      window.view3d.view({ day, pos: 30.5, weather: { rain: 0, wet: 0, overcast: 0, puddles: 0, wind: 0.3, snowing: false } });
      window.view3d.rig.set({ x: at.x, z: at.z, ...cam });
    }, [at, day, cam]);
    await page.waitForTimeout(1000);
    await shot(page, n(name));
    return page.evaluate(() => window.view3d.info());
  };
  const front = await page.evaluate(() => window.view3d.rig.heading);
  await look('near', 0.32, { dist: 13, pitch: 0.55 });
  await look('side', 0.32, { dist: 13, pitch: 0.5, yaw: front + Math.PI / 2 });
  await look('night', 0.72, { dist: 15, pitch: 0.6 });
  const far = await look('far', 0.32, { dist: 34 });
  assert(far.calls <= 120, `at most 120 draw calls (${far.calls})`);
}

/** Workshops by craft (plano beleza C8): the six crafts in a row, each read by its silhouette and colour from mid distance; and a market of each level. */
async function crafts3dScenario(page) {
  await open3dGame(page);
  const n = (name) => `crafts3d-pc-${name}`;
  const at = await page.evaluate(() => {
    const { state: s, core } = window;
    s.silver = s.wood = s.stone = 1e6;
    s.unlocked = [...new Set([...s.unlocked, 'workshop', 'market'])];
    s.feature = s.feature.map(() => null);
    const altar = s.buildings.find((b) => b.kind === 'altar');
    // A row of six workshops (3x3) and three markets (2x4) on free land, nearest the altar.
    const fits = (x, y) => {
      for (let k = 0; k < 6; k++) if (!core.checkPlace(s, 'workshop', x + k * 3, y).ok) return false;
      for (let k = 0; k < 3; k++) if (!core.checkPlace(s, 'market', x + k * 3, y + 4).ok) return false;
      return true;
    };
    let best = null;
    for (let y = 1; y < s.rows - 10; y++)
      for (let x = 1; x < s.cols - 19; x++) {
        const d = Math.hypot(x - altar.x, y - altar.y);
        if ((!best || d < best.d) && fits(x, y)) best = { x, y, d };
      }
    if (!best) return null;
    for (let k = 0; k < 6; k++) {
      core.place(s, 'workshop', best.x + k * 3, best.y);
      s.grid[best.y * s.cols + best.x + k * 3].variant = k;
    }
    for (let k = 0; k < 3; k++) {
      core.place(s, 'market', best.x + k * 3, best.y + 4);
      s.grid[(best.y + 4) * s.cols + best.x + k * 3].level = k + 1;
    }
    core.refreshCity(s);
    window.session.refresh();
    return { x: best.x + 9, z: best.y + 1.5, mz: best.y + 6 };
  });
  assert(at, 'room for six workshops and three markets');
  await page.addStyleTag({ content: '.labels { display: none !important; }' });
  const look = async (name, cam, day = 0.32) => {
    await page.evaluate(([day, cam]) => {
      window.view3d.view({ day, pos: 30.5, weather: { rain: 0, wet: 0, overcast: 0, puddles: 0, wind: 0.5, snowing: false } });
      window.view3d.rig.set(cam);
    }, [day, cam]);
    await page.waitForTimeout(1000);
    await shot(page, n(name));
    return page.evaluate(() => window.view3d.info());
  };
  const mid = await look('row', { x: at.x, z: at.z, dist: 26, yaw: 0, pitch: 0.8 });
  assert(mid.calls <= 120, `at most 120 draw calls (${mid.calls})`);
  await look('near-a', { x: at.x - 4.5, z: at.z, dist: 11, yaw: 0, pitch: 0.65 });
  await look('near-b', { x: at.x + 4.5, z: at.z, dist: 11, yaw: 0, pitch: 0.65 });
  await look('night', { x: at.x, z: at.z, dist: 22, yaw: 0, pitch: 0.8 }, 0.72);
  await look('markets', { x: at.x - 4.5, z: at.mz, dist: 13, yaw: 0, pitch: 0.7 });
  // A quarry by the road network cuts stone: dust over it by day, none at night.
  const q = await page.evaluate(() => {
    const { state: s, core } = window;
    s.unlocked = [...new Set([...s.unlocked, 'quarry'])];
    s.stone = 100; // under the store's limit: the quarry cuts
    const altar = s.buildings.find((b) => b.kind === 'altar');
    let best = null;
    for (let y = 1; y < s.rows - 3; y++)
      for (let x = 1; x < s.cols - 3; x++) {
        const d = Math.hypot(x - altar.x, y - altar.y);
        if ((!best || d < best.d) && core.checkPlace(s, 'quarry', x, y).ok) best = { x, y, d };
      }
    if (!best || !core.place(s, 'quarry', best.x, best.y).ok) return null;
    core.refreshCity(s);
    window.session.refresh();
    const b = s.grid[best.y * s.cols + best.x];
    return { x: b.x + 1, z: b.y + 1, connected: b.connected };
  });
  await page.waitForTimeout(800);
  if (q) q.dust = await page.evaluate(() => window.view3d.game.scene.stage.world.dust.mesh.visible);
  assert(q && q.connected && q.dust, `a working quarry raises dust (${JSON.stringify(q)})`);
  await look('quarry', { x: q.x, z: q.z, dist: 9, yaw: 0, pitch: 0.6 });
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
  // Tranquilo / Normal / Difícil (plano-dificuldade F): three cards on the screen, Normal marked the first time; a tap moves the mark.
  const levels = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.title-screen .diff')].map((b) => {
        const r = b.getBoundingClientRect();
        return { spot: b.dataset.spot, on: b.getAttribute('aria-pressed') === 'true', x: r.x + r.width / 2, y: r.y + r.height / 2, inside: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
      }),
    );
  const cards = await levels();
  assert(cards.length === 3 && cards.every((l) => l.inside), `three difficulty cards on the screen (${JSON.stringify(cards)})`);
  assert(cards.find((l) => l.on)?.spot === 'difficulty-normal', 'Normal comes marked the first time');
  const hard = cards.find((l) => l.spot === 'difficulty-hard');
  if (phone) await cdpTapPage(page, hard.x, hard.y);
  else await page.mouse.click(hard.x, hard.y);
  assert((await levels()).find((l) => l.on)?.spot === 'difficulty-hard', 'a tap marks Difícil');
  await page.screenshot({ path: `${OUT}/play3d-${suffix}-title-hard.png` });
  const normal = cards.find((l) => l.spot === 'difficulty-normal');
  if (phone) await cdpTapPage(page, normal.x, normal.y);
  else await page.mouse.click(normal.x, normal.y);
  if (phone) await cdpTapPage(page, startBtn[0], startBtn[1]);
  else await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.view3d?.ready && window.view3d.frames > 3 && window.session, null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const st = await page.evaluate(() => ({ phaser: !!window.Phaser || performance.getEntriesByType('resource').some((e) => /phaser/i.test(e.name)), canvases: document.querySelectorAll('canvas').length, form: document.querySelector('#hud').dataset.form, tutorial: !document.querySelector('.tutorial').classList.contains('hidden') }));
  assert(!st.phaser, 'the 3D game loads no Phaser');
  assert(st.canvases === 1, `one canvas (${st.canvases})`);
  assert(st.form === (phone ? 'phone' : 'pc'), `the interface is laid out for the ${suffix} (${st.form})`);
  assert(st.tutorial, 'the first game opens the tutorial');
  assert((await page.evaluate(() => window.state.difficulty)) === 'normal', 'the game plays the difficulty marked on the title');
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

  // Contemplate (D3): the eye hides the interface and drops the camera low; it turns slowly; the faint eye (or Esc) comes back.
  const pitch0 = await page.evaluate(() => window.view3d.rig.camera.position.y);
  const yaw0 = await page.evaluate(() => window.view3d.info().yaw);
  // (The phone's Contemplar disc waits for the end of the tutorial, open here: the key C does the same.)
  if (phone) await page.keyboard.press('c');
  else await hitSpot('contemplate');
  await page.waitForTimeout(2500);
  const calm = await page.evaluate(() => ({
    on: document.getElementById('hud').classList.contains('contemplate'),
    bar: getComputedStyle(document.querySelector('[data-spot="settings"]')).visibility,
    leave: getComputedStyle(document.querySelector('[data-spot="leave-contemplate"]')).display,
    y: window.view3d.rig.camera.position.y,
    yaw: window.view3d.info().yaw,
  }));
  await page.screenshot({ path: `${OUT}/play3d-${suffix}-contemplate.png` });
  assert(calm.on && calm.bar === 'hidden' && calm.leave !== 'none', `contemplate hides the interface but the way back (${JSON.stringify(calm)})`);
  assert(calm.y < pitch0 * 0.85, `the camera drops low (${pitch0.toFixed(1)} → ${calm.y.toFixed(1)})`);
  assert(calm.yaw !== yaw0, `the camera turns slowly (${yaw0} → ${calm.yaw})`);
  if (phone) await hitSpot('leave-contemplate');
  else await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('hud').classList.contains('contemplate'), null, { timeout: 5000 });
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
  // The audio starts with the first gesture, but its context resumes only when the page has time:
  // the first frames compile the shaders (seconds on a busy machine). Wait for it, not a fixed time.
  await page.waitForFunction(() => window.music.state().ctx === 'running', null, { timeout: 60000 }).catch(() => {});
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
    await page.waitForFunction(() => window.music.state().target > 0, null, { timeout: 10000 }).catch(() => {});
    assert((await st()).target > 0, 'M turns the music back on');
  } else await hitSpot('set-music');
  // A hidden tab fades out and suspends the audio.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  // (The fade runs first; on a busy machine it may take much longer than its nominal 0.3 s.)
  await page.waitForFunction(() => window.music.state().ctx === 'suspended', null, { timeout: 60000 }).catch(() => {});
  const hidden = await st();
  assert(hidden.target === 0 && hidden.ctx === 'suspended', `a hidden tab suspends the music (${JSON.stringify(hidden)})`);
  assert(!errors.length, `no page errors (${errors.join(' | ')})`);
}

/** The victory and defeat cards: gold branches, the medals, the blurred city, all on screen. */
async function end3dScenario(page, suffix) {
  await open3dGame(page);
  const check = async (name, medals) => {
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/end3d-${suffix}-${name}.png` });
    const fit = await page.evaluate(() => {
      const r = document.querySelector('.modal.end .card').getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: innerWidth, h: innerHeight, medals: document.querySelectorAll('.modal.end .medal').length, branches: document.querySelectorAll('.modal.end .branch svg').length };
    });
    assert(fit.medals === medals && fit.branches === 2, `the ${name} card has its ${medals} medals and two branches (${JSON.stringify(fit)})`);
    assert(fit.top >= 0 && fit.bottom <= fit.h && fit.left >= 0 && fit.right <= fit.w, `the ${name} card fits the screen (${JSON.stringify(fit)})`);
  };
  await page.evaluate(() => window.view3d.game.hud.showVictory(160, 84, 23, 11, 'hard'));
  await check('victory', 3);
  // The end cards say the difficulty (plano-dificuldade F).
  const said = () => page.evaluate(() => document.querySelector('.modal')?.textContent ?? '');
  assert((await said()).includes('Dificuldade: Difícil.'), 'the victory card says the difficulty');
  await page.evaluate(() => window.view3d.game.hud.showDefeat(70, 31, 'easy'));
  await check('defeat', 2);
  assert((await said()).includes('Dificuldade: Tranquilo.'), 'the defeat card says the difficulty');
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
    // Off the road and clear of the map's edge (at the edge the zoomed camera cannot centre it and
    // its balloon rose under the "O que fazer agora" line on the phone).
    let spot = { x: 3, y: 3 };
    for (let k = 0; k < 400; k++) {
      const x = 8 + (k % 20), y = 8 + Math.floor(k / 20);
      if (core.checkPlace(s, 'fisher', x, y).ok && !core.placeSpots(s, 'fisher').some((o) => o.x === x && o.y === y)) { spot = { x, y }; break; }
    }
    core.place(s, 'fisher', spot.x, spot.y);
    window.__fisherAt = spot;
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
      // Aimed a little behind it, so the zoomed-in balloon sits mid-screen, below the top bar and the line.
      r.set({ x: window.__fisherAt.x - 1, z: window.__fisherAt.y - 1 });
      // The balloons follow the camera on the next frames: wait for them to settle.
      await new Promise((ok) => setTimeout(ok, 700));
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
    return a.bottom > b.top + 1 && a.top < b.bottom - 1 && a.right > b.left && b.right > a.left;
  });
  assert(!tipOver, 'the chosen building\'s balloon stays clear of the tutorial card (under the bar)');
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
      const GROUPS = ['header.top', 'nav.side', 'nav.tools', 'nav.column', '.toasts', '.tutorial', '.balloon', '.settings', '.arrow', '.nextstep', '.clock'];
      const items = [];
      for (const el of hud.querySelectorAll('button, .pill, .level, .toast, .tutorial, .balloon, .settings, .arrow, .nextstep, .clock')) {
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
  assert(await page.evaluate(() => document.querySelector('.nextstep').classList.contains('hidden')), '"O que fazer agora" waits while the tutorial speaks');
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
    s.unlocked.push('granary', 'plaza', 'market', 'workshop', 'quarry', 'park', 'tannery');
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
    // plano-dificuldade E: shed, awning, hides on frames and vats (the first free spot down the street).
    const spots = [];
    for (let d = 0; d <= 8; d++) for (let y = 44 - d; y <= 47 + d; y++) for (let x = 20 - d; x <= 27 + d; x++) spots.push([x, y]);
    const tan = spots.find(([x, y]) => core.checkPlace(s, 'tannery', x, y).ok);
    if (!tan) throw new Error('no room for the tannery');
    put('tannery', ...tan);
    window.tanAt = tan;
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
  await page.evaluate(() => window.view3d.rig.set({ x: window.tanAt[0] + 1, z: window.tanAt[1] + 1, dist: 7 }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/town3d-pc-tannery.png` });
  // The streets with people carrying their things (jar, basket, sickle, log, cart, staff, goods) and their animals.
  const walkers = await page.evaluate(() => window.view3d.info().walkers);
  assert(walkers >= 12, `a lived-in street has walkers (${walkers})`);
  await page.evaluate(() => {
    window.session.setSpeed(1);
    // Noon: people walking to the market (mid-morning the streets are calmer: the day's routine, D1).
    window.view3d.view({ day: 0.27 });
    window.view3d.rig.set({ x: 24.5, z: 36, dist: 7 });
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/town3d-pc-people.png` });
  await page.evaluate(() => window.session.setSpeed(0));
  // Every walker is a resident: a click on one opens their sheet with their name. The walkers go on
  // walking while paused (a cell a second): once no redraw of the people is pending, they are held
  // still, so the one found below is still under the cursor when the click lands on a slow machine.
  await page.waitForFunction(() => window.view3d.settled, null, { timeout: 30000 });
  await page.evaluate(() => window.view3d.holdWalkers(true));
  await page.waitForFunction((f) => window.view3d.frames > f, await page.evaluate(() => window.view3d.frames), { timeout: 30000 });
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
  await page.waitForFunction(() => document.querySelector('[data-spot="sheet"]:not(.hidden)'), null, { timeout: 10000 }).catch(() => {});
  const sheet = await page.evaluate(() => {
    const el = document.querySelector('[data-spot="sheet"]');
    return el && !el.classList.contains('hidden') ? el.textContent : null;
  });
  assert(sheet && sheet.includes(name), `a click on a walker opens ${name}'s sheet (${sheet?.slice(0, 60)})`);
  await page.screenshot({ path: `${OUT}/town3d-pc-person.png` });
  await page.evaluate(() => window.view3d.holdWalkers(false));
  await page.evaluate(() => window.view3d.view(null));
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
 * network, two street lamps. Lit windows on the lived-in .glb stone and big houses (none on the empty ones), the lamps glow; with
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
    // Two street lamps by the road (plano-dificuldade D): lit at night while there is wood.
    s.unlocked.push('lamp');
    put('lamp', 32, 33);
    put('lamp', 35, 33);
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
      return { panes: count('pane'), loose: count('loose'), lamps: w.fires.kinds.filter((k) => k === 'lamp').length, share: w.smoke.mesh.material.uniforms.uShare.value, calls: window.view3d.info().calls };
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
  assert(night.lamps === 2, `the 2 street lamps glow at night (${night.lamps})`);
  await look({ day: 0.72, weather: clear }, { x: 33.5, z: 33, dist: 7, ...above }, 'lamps');
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
  // A day in the city (D1): early in the morning the market is thin and the doors quieter than at noon;
  // by the end of the afternoon the children are in.
  const early = await look({ day: 0.07, pos: summer, weather: clear }, { x: 24.5, z: 33, dist: 12, ...above }, 'morning');
  assert(early.idle < day.idle, `fewer at the doors and the market early in the morning (${early.idle} < ${day.idle})`);
  const evening = await look({ day: 0.6, pos: summer, weather: clear }, { x: 24.5, z: 33, dist: 12, ...above }, 'evening');
  assert(evening.idle < day.idle, `the children are in by the evening (${evening.idle} < ${day.idle})`);
  await look({ day: 0.3, pos: summer, weather: clear }, { x: 23.5, z: 40, dist: 10, ...above }, 'market');
  // Autumn: two pickers under the olive tree, one beating the branches with a pole.
  await look({ day: 0.3, pos: autumn, weather: clear }, { x: 28, z: 31.5, dist: 9, ...above }, 'olives');
  // Strong wind: the washing lines and the market's awnings move (two frames apart).
  await look({ day: 0.3, pos: summer, weather: { ...clear, wind: 1 } }, { x: 24.5, z: 36, dist: 10, ...above }, 'wind-a');
  await page.waitForTimeout(350);
  await shot(page, n('wind-b'));
  // The couple walking hand in hand up the road (they stand on their way while the game is paused).
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

/**
 * People never vanish nor jump (playtest 2026-11-07, bugs 1 and 2): a paused town of walkers is
 * sampled frame by frame while the network changes (a road built), more people move in (more
 * walkers) and a harvest sends a carrier out (the workers' layer alone): every walker kept moves on
 * smoothly and the count never drops at once. In the rain they walk to a door and go in a few at a
 * time, and come out of doors after it. A family walks once from the entrance into its house with
 * the game running, and stays in. Screenshots: the street by day, in the rain (people heading in),
 * after the rain, the family on its way.
 */
async function walkers3dScenario(page, form) {
  const n = (name) => `walkers3d-${form}-${name}`;
  await open3dGame(page);
  const clear = { rain: 0, wet: 0, overcast: 0, puddles: 0, wind: 0, snowing: false };
  const setup = await page.evaluate(() => {
    const { state: s, core } = window;
    s.silver = s.wood = s.stone = 1e6;
    s.feature = s.feature.map(() => null);
    for (const b of s.buildings.filter((b) => b.kind !== 'altar')) core.clearCell(s, b.x, b.y);
    s.people = [];
    s.families = [];
    s.unlocked.push('granary', 'market', 'workshop', 'plaza');
    const put = (kind, x, y) => {
      const r = core.place(s, kind, x, y);
      if (!r.ok) throw new Error(`no ${kind} at ${x},${y}: ${r.reason}`);
      return s.grid[y * s.cols + x];
    };
    const houses = [];
    for (const y of [28, 30, 32, 34, 36]) for (const x of [22, 25]) houses.push(Object.assign(put('house', x, y), { level: 2 + (y % 4 ? 1 : 0), variant: 1 }));
    put('market', 22, 38);
    put('granary', 25, 38);
    const field = put('field', 25, 42);
    for (const h of houses.slice(0, 7))
      for (let k = 0; k < 4; k++) core.addPerson(s, { sex: k % 2 ? 'f' : 'm', age: 20 + k * 9, houseId: h.id, caravan: 0, clan: h.id }, () => 0.5);
    core.refreshCity(s);
    s.food = core.foodCapacity(s) / 2;
    window.session.refresh();
    window.view3d.rig.set({ x: 24.5, z: 33, dist: 13, yaw: Math.PI / 4, pitch: 0.75 });
    return { empty: houses.slice(7).map((h) => h.id), field: field.id };
  });
  // Frame by frame for `ms`: the walkers on the streets and how far each resident moved since the last frame.
  const sample = (ms, change) =>
    page.evaluate(
      ([ms, change]) =>
        new Promise((done) => {
          const w = () => window.view3d.game.scene.stage.world.walkers;
          const world = window.view3d.game.scene.stage.world;
          const was = { walkers: world.walkers, haulers: world.haulers };
          const out = { frames: 0, maxJump: 0, maxDrop: 0, counts: [], kept: 0, redrawn: [] };
          let last = null;
          let t0 = performance.now();
          let tp = t0;
          let changed = false;
          const tick = () => {
            const now = performance.now();
            if (!changed && now - t0 > 300 && change) {
              changed = true;
              new Function(change)();
              window.session.refresh();
            }
            const at = new Map([...w().residents()].map((p) => [p.id, p]));
            const count = w().count;
            if (last) {
              const dt = (now - tp) / 1000;
              for (const [id, p] of at) {
                const q = last.at.get(id);
                if (!q) continue;
                out.kept++;
                // Faster than any walker (cheering ones 1.3x of 1.4 cells/s), with room for a slow frame.
                out.maxJump = Math.max(out.maxJump, Math.hypot(p.x - q.x, p.z - q.z) - dt * 2.5);
              }
              out.maxDrop = Math.max(out.maxDrop, last.count - count);
            }
            out.counts.push(count);
            out.frames++;
            last = { at, count };
            tp = now;
            if (now - t0 < ms) requestAnimationFrame(tick);
            else done({ ...out, redrawn: Object.keys(was).filter((k) => world[k] !== was[k]) });
          };
          requestAnimationFrame(tick);
        }),
      [ms, change],
    );
  await page.evaluate((clear) => window.view3d.view({ day: 0.3, weather: clear }), clear);
  await page.waitForFunction(() => window.view3d.settled, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  await shot(page, n('day'));
  // A road built off the street: the network changes, the walkers' layer is drawn again.
  const road = await sample(3500, `const s = window.state; for (const x of [25, 26, 27, 28]) window.core.place(s, 'road', x, 40); window.core.refreshCity(s);`);
  // More people move in: more walkers (they come out of doors).
  const more = await sample(3500, `const s = window.state; for (const id of ${JSON.stringify(setup.empty)}) { const h = s.buildings.find((b) => b.id === id); for (let k = 0; k < 6; k++) window.core.addPerson(s, { sex: k % 2 ? 'f' : 'm', age: 22 + k * 7, houseId: h.id, caravan: 0, clan: h.id }, () => 0.5); } window.core.refreshCity(s);`);
  // The harvest: a carrier sets out from the field (only the workers' layer changes).
  const harvest = await sample(3000, `const s = window.state, c = window.core; let w = s.week; while (!c.harvestsIn(w)) w++; s.week = w; c.refreshCity(s);`);
  // The walkers were drawn again for the road and the newcomers; the harvest redrew the workers alone.
  assert(more.redrawn.includes('walkers'), `the walkers' layer was drawn again (${more.redrawn})`);
  // (When the week was already a harvest one nothing changes; either way the walkers and families stay.)
  assert(!harvest.redrawn.some((k) => k !== 'haulers'), `the harvest redraws the workers alone (${harvest.redrawn})`);
  for (const [what, r] of Object.entries({ road, more, harvest })) {
    assert(r.kept > 20 && r.maxJump < 0.35, `${what}: the walkers kept walk on smoothly (${r.kept} seen, largest jump ${r.maxJump.toFixed(2)} cells over their pace)`);
    assert(r.maxDrop <= 2, `${what}: nobody vanishes at once (largest drop ${r.maxDrop} in a frame; ${r.counts.slice(0, 8).join(',')}…)`);
  }
  console.log(`  walkers3d: ${Object.entries({ road, more, harvest }).map(([k, r]) => `${k} ${r.frames} frames, jump ${r.maxJump.toFixed(2)}, drop ${r.maxDrop}`).join('; ')}`);
  assert(more.counts[more.counts.length - 1] > more.counts[0], `more people, more walkers (${more.counts[0]} → ${more.counts[more.counts.length - 1]})`);
  const haulers = await page.evaluate(() => window.view3d.info().haulers);
  assert(haulers >= 1, `the harvest carrier is out (${haulers})`);
  // Rain: the streets empty a few at a time, people walking in by the doors.
  const before = await page.evaluate(() => window.view3d.info().walkers);
  const rain = { rain: 1, wet: 1, overcast: 1, puddles: 1, wind: 0.4, snowing: false };
  const wet = sample(9000, `window.view3d.view({ day: 0.3, weather: ${JSON.stringify(rain)} });`);
  await page.waitForTimeout(2200);
  await shot(page, n('rain'));
  const inRain = await wet;
  // On a slow machine (a few frames a second) the walk to the doors takes longer.
  await page.waitForFunction((n) => window.view3d.info().walkers < n * 0.7, before, { timeout: 60000 }).catch(() => {});
  const rainy = await page.evaluate(() => window.view3d.info().walkers);
  assert(rainy < before * 0.7, `fewer people out in the rain (${before} → ${rainy})`);
  // A slow machine draws a few frames a second: a few reach their doors in the same frame.
  assert(inRain.maxDrop <= Math.max(3, before * 0.2) && inRain.maxJump < 0.35, `in the rain they walk in, not vanish (largest drop ${inRain.maxDrop} of ${before}, jump ${inRain.maxJump.toFixed(2)})`);
  assert(new Set(inRain.counts.filter((c) => c < before)).size > 3, `they go in over many frames (${inRain.counts.join(',')})`);
  // After the rain they come out of the doors again.
  const after = await sample(7000, `window.view3d.view({ day: 0.3, weather: ${JSON.stringify(clear)} });`);
  assert(after.counts[after.counts.length - 1] > rainy && after.maxJump < 0.35, `out again after the rain (${rainy} → ${after.counts[after.counts.length - 1]}, jump ${after.maxJump.toFixed(2)})`);
  await shot(page, n('after-rain'));
  // A family walks once from the entrance into its house with the game running, and stays in.
  const fam = await page.evaluate((id) => {
    const { state: s, core } = window;
    const house = s.buildings.find((b) => b.id === id);
    const members = [0, 1, 2].map((k) => core.addPerson(s, { sex: k ? 'f' : 'm', age: 30 - k * 12, houseId: null, caravan: 0, clan: 77 }, () => 0.5).id);
    for (const p of s.people.filter((p) => p.houseId === house.id)) p.houseId = null;
    s.people = s.people.filter((p) => p.houseId !== null || members.includes(p.id));
    const start = s.network.findIndex((v, i) => v && Math.floor(i / s.cols) > 44);
    const from = start >= 0 ? { x: start % s.cols, y: Math.floor(start / s.cols) } : { x: 24, y: 46 };
    const path = core.findPath(s, from, core.doorsOf(s, house));
    s.families.push({ id: s.nextId++, houseId: house.id, members, path: [...path, { x: house.x, y: house.y }], step: 0 });
    core.refreshCity(s);
    window.session.refresh();
    window.session.setSpeed(1);
    return { cells: path.length, x: house.x, y: house.y };
  }, setup.empty[0]);
  await page.waitForFunction(() => window.view3d.info().families === 1, null, { timeout: 20000 });
  await page.evaluate((f) => window.view3d.rig.set({ x: f.x, z: f.y + 3, dist: 11 }), fam);
  await page.waitForTimeout(900);
  await shot(page, n('family'));
  await page.waitForFunction(() => window.state.families.length === 0 && window.view3d.info().families === 0, null, { timeout: 60000 });
  // Stays in: no loop out of the house again.
  const again = await page.evaluate(
    () =>
      new Promise((done) => {
        let seen = 0;
        const t0 = performance.now();
        const tick = () => {
          seen = Math.max(seen, window.view3d.info().families);
          if (performance.now() - t0 < 4000) requestAnimationFrame(tick);
          else done(seen);
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.evaluate(() => window.session.setSpeed(0));
  assert(again === 0, `the family is home and stays in (${again} walking again)`);
}

/**
 * The Profissões panel (plan "Desafio" 1.3): a town with eight professions built and a few targets
 * set (one short of workers). Opened by its side button (P on PC), by the Moradores pill; the
 * "Sem trabalho" row first, one row per profession, − and + of 44 px or more, the "auto" seal; two
 * columns without scrolling on the phone, one on PC; + with nobody free says so in the head; − takes a worker off;
 * Automático clears the targets; Esc, ✕ and a click on the map close it.
 */
async function jobs3dScenario(page, name) {
  const phone = name === 'phone';
  await open3dGame(page);
  await setupPeople(page);
  const built = await page.evaluate(() => {
    const { state: s, core } = window;
    s.unlocked.push('quarry', 'lumber');
    s.silver = 2000;
    // Each workplace on the nearest free spot that is on the road.
    const altar = s.buildings.find((b) => b.kind === 'altar');
    const out = [];
    for (const kind of ['lumber', 'workshop', 'market', 'quarry', 'fisher', 'gatherer']) {
      const cands = [];
      for (let y = 1; y < s.rows - 4; y++) for (let x = 1; x < s.cols - 4; x++) if (core.checkPlace(s, kind, x, y).ok) cands.push({ x, y, d: Math.hypot(x - altar.x, y - altar.y) });
      cands.sort((a, b) => a.d - b.d);
      for (const c of cands.slice(0, 400)) {
        if (!core.place(s, kind, c.x, c.y).ok) continue;
        const b = s.grid[c.y * s.cols + c.x];
        if (b.connected) {
          out.push(kind);
          break;
        }
        core.clearCell(s, c.x, c.y);
      }
    }
    core.refreshCity(s);
    window.session.refresh();
    return out;
  });
  assert(built.length >= 4, `the town's workplaces are built (${built})`);
  // A few targets: fewer farmers and craftsmen, one more lumberjack than people free (falta 1).
  await page.evaluate(() => {
    const g = window.session;
    g.changeJobTarget('workshop', -1);
    g.changeJobTarget('workshop', -1);
    g.changeJobTarget('field', -1);
    g.changeJobTarget('lumber', -1);
    g.changeJobTarget('lumber', 1);
    g.changeJobTarget('lumber', 1);
  });
  const panel = '.panelbox.jobs:not(.hidden)';
  // The phone has it as a labelled disc after the tools; PC beside Estatísticas, and the key P.
  if (phone) await page.click('[data-spot="jobs-button"]');
  else await page.keyboard.press('p');
  await page.waitForSelector(panel, { timeout: 5000 });
  const look = () =>
    page.evaluate(() => {
      const el = document.querySelector('.panelbox.jobs');
      const rows = [...el.querySelectorAll('.jobrow')].map((r) => ({ kind: r.dataset.job, x: Math.round(r.getBoundingClientRect().left), h: r.getBoundingClientRect().height, text: r.textContent }));
      const steps = [...el.querySelectorAll('.act.step, .jobshead .act')].map((b) => b.getBoundingClientRect()).map((r) => Math.min(r.width, r.height));
      let min = 99;
      for (const e of el.querySelectorAll('*')) if ([...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) min = Math.min(min, parseFloat(getComputedStyle(e).fontSize));
      const box = el.getBoundingClientRect();
      return { rows, steps, min, scroll: el.scrollHeight - el.clientHeight, box: [box.left, box.top, box.right, box.bottom].map(Math.round), targets: { ...window.state.jobTargets } };
    });
  const v = await look();
  await shot(page, `jobs3d-${name}`);
  assert(v.rows[0].kind === 'idle' && v.rows[0].text.startsWith('Sem trabalho'), `"Sem trabalho" is the first row (${v.rows[0].text})`);
  assert(v.rows.length >= 6, `one row per profession built (${v.rows.map((r) => r.kind)})`);
  assert(v.rows.every((r) => r.h >= 44), 'rows of 44 px or more');
  assert(v.steps.every((n) => n >= 44), `− , + and Automático of 44 px or more (${v.steps})`);
  // The tax row (package G) right after "Sem trabalho": + raises it to 30% and says what it costs in Alegria.
  assert(v.rows[1].kind === 'tax' && v.rows[1].text.includes('20%'), `the tax row comes second, at 20% (${v.rows[1].text})`);
  await page.click('[data-spot="tax-plus"]');
  await page.waitForFunction(() => window.state.taxRate === 30, null, { timeout: 5000 });
  const taxed = await page.evaluate(() => document.querySelector('.jobrow.tax').textContent);
  assert(taxed.includes('30%') && taxed.includes('−8 de Alegria'), `the tax row says the new rate and its cost (${taxed})`);
  await shot(page, `jobs3d-${name}-tax`);
  await page.click('[data-spot="tax-minus"]');
  await page.waitForFunction(() => window.state.taxRate === 20, null, { timeout: 5000 });
  assert(v.min >= 12, `no text under 12 px (${v.min})`);
  assert(new Set(v.rows.map((r) => r.x)).size === (phone ? 2 : 1), `${phone ? 'two columns' : 'one column'} of rows`);
  assert(v.scroll <= 1, `the panel fits without scrolling (${v.scroll} px over)`);
  assert(v.box[3] <= (phone ? 390 : 768) && v.box[2] <= (phone ? 844 : 1366), `the panel is on screen ${v.box}`);
  const lumber = v.rows.find((r) => r.kind === 'lumber');
  assert(lumber && lumber.text.includes('falta'), `the lumber camp short of its target says "falta" (${lumber?.text})`);
  assert(v.rows.some((r) => r.text.includes('auto')), 'an automatic profession wears the "auto" seal');
  // + with nobody free: the target goes up and the panel's head says why nobody came.
  const free = await page.evaluate(() => window.core.unemployed(window.state));
  if (free === 0 && (await page.$('[data-spot="job-workshop-plus"]:not(.dim)'))) {
    await page.click('[data-spot="job-workshop-plus"]');
    await page.waitForFunction(() => document.querySelector('.jobshead small')?.textContent.includes('Ninguém livre'), null, { timeout: 15000 }).catch(() => {});
    const note = await page.evaluate(() => document.querySelector('.jobshead small')?.textContent ?? '');
    assert(note.includes('Ninguém livre'), `+ with nobody free says so (${note})`);
    await shot(page, `jobs3d-${name}-nobody`);
  }
  // − takes a farmer off the field at once (they go to a profession with free jobs, or to "Sem trabalho").
  const farmers = () => page.evaluate(() => window.state.buildings.filter((b) => b.kind === 'field').reduce((n, b) => n + window.core.crewOf(window.state, b).length, 0));
  const f0 = await farmers();
  await page.click('[data-spot="job-field-minus"]');
  await page.waitForTimeout(150);
  assert((await farmers()) === f0 - 1, `− takes a farmer off at once (${f0} → ${await farmers()})`);
  // Esc closes; the Moradores pill opens it again; Automático clears every target.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  assert(!(await page.$(panel)), 'Esc closes Profissões');
  const pill = await page.evaluate(() => {
    const r = document.querySelector('[data-pill="people"]').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (phone) await cdpTapPage(page, pill.x, pill.y);
  else await page.mouse.click(pill.x, pill.y);
  await page.waitForSelector(panel, { timeout: 5000 });
  await page.click('[data-spot="jobs-auto"]');
  await page.waitForTimeout(150);
  assert((await page.evaluate(() => Object.keys(window.state.jobTargets).length)) === 0, 'Automático clears every target');
  await shot(page, `jobs3d-${name}-auto`);
  // A click on the map closes it (PC); on the phone the panel fills the map, its ✕ closes it.
  if (phone) await page.click('.panelbox.jobs [data-spot="panel-close"]');
  else await page.mouse.click(700, 500);
  await page.waitForTimeout(200);
  assert(!(await page.$(panel)), `${phone ? '✕' : 'a click on the map'} closes Profissões`);
}

/**
 * "O que fazer agora" and the Temple's stage balloon (plan "Desafio" 2.3/2.4): the line under the top
 * bar (one line, clear of it; 28 px on the phone, beside the goal pill when it fits; hidden in the tutorial, see hud3d);
 * a tap opens the altar's balloon with "Começar: Altar restaurado" and Profissões and points the arrow;
 * Começar pays it (the bar and the builders show), the line asks for builders and opens Profissões;
 * short of stone the button is grey and says what is missing; a debt comes first (Avisos and Demolir);
 * Objetivos marks the five stages.
 */
async function nextstep3dScenario(page, name) {
  const phone = name === 'phone';
  await open3dGame(page);
  const n = (k) => `nextstep3d-${name}${k ? `-${k}` : ''}`;
  const set = (f) => page.evaluate(f);
  await set(() => {
    const { state: s, core } = window;
    s.goalIndex = core.GOALS.findIndex((g) => g.type === 'templeStage' && g.stage === 1);
    if (!s.unlocked.includes('pasture')) s.unlocked.push('pasture'); // the Gado pill shows
    s.livestock = 12;
    s.silver = 500;
    s.wood = 100;
    s.stone = 100;
    s.food = 200;
    window.session.refresh();
  });
  await page.waitForTimeout(300);
  const line = () =>
    page.evaluate(() => {
      const el = document.querySelector('.nextstep');
      const r = el.getBoundingClientRect();
      const bar = [...document.querySelectorAll('header.top .pill:not(.aside), header.top .level, header.top button')].map((e) => e.getBoundingClientRect());
      const top = Math.max(...bar.map((b) => b.bottom));
      const hits = bar.filter((b) => r.left < b.right - 1 && b.left < r.right - 1 && r.top < b.bottom - 1 && b.top < r.bottom - 1).length;
      const txt = el.querySelector('.txt');
      return {
        shown: !el.classList.contains('hidden'),
        text: el.textContent,
        kind: el.dataset.kind,
        box: [r.left, r.top, r.right, r.bottom].map(Math.round),
        h: Math.round(r.height),
        oneLine: txt.getBoundingClientRect().height <= parseFloat(getComputedStyle(txt).lineHeight || '20') + 2 || txt.getBoundingClientRect().height < 24,
        font: parseFloat(getComputedStyle(el).fontSize),
        below: r.top >= top,
        clear: hits === 0 && r.right <= document.querySelector('nav.column').getBoundingClientRect().left,
        mid: Math.round((r.left + r.right) / 2 - innerWidth / 2),
      };
    });
  const v = await line();
  await shot(page, n(''));
  assert(v.shown && v.kind === 'stage' && v.text.includes('toque no altar'), `the line says to start the altar's stage (${JSON.stringify(v)})`);
  // PC: under the bar; the phone: under it or beside the goal pill, clear of the bar and the column.
  assert((phone || v.below) && v.clear && v.oneLine && v.font >= 12, `one line clear of the top bar, text 12 px or more (${JSON.stringify(v)})`);
  if (phone) assert(v.h === 28, `28 px on the phone (${v.h})`);
  else assert(Math.abs(v.mid) <= 2, `centred on PC (${v.mid})`);
  // The Gado pill is in: the PC bar's pills stay on one row.
  const rows = await page.evaluate(() => new Set([...document.querySelectorAll('header.top [data-pill]')].map((e) => Math.round(e.getBoundingClientRect().top))).size);
  const gado = await page.evaluate(() => !!document.querySelector('[data-pill="livestock"]'));
  assert(gado && (phone || rows === 1), `the Gado pill shows${phone ? '' : ' and the PC pills stay on one row'} (${gado}, ${rows} rows)`);
  // A tap opens the altar's balloon and the arrow points at the altar.
  await page.click('[data-spot="next-step"]');
  await page.waitForSelector('[data-spot="balloon-stage"]', { timeout: 5000 });
  await page.waitForFunction(() => [...document.querySelectorAll('.arrow')].some((a) => !a.classList.contains('hidden')), null, { timeout: 8000 }).catch(() => {});
  const opened = await page.evaluate(() => {
    const altar = window.state.buildings.find((b) => b.kind === 'altar');
    const arrows = [...document.querySelectorAll('.arrow')].filter((a) => !a.classList.contains('hidden'));
    return { altar: window.session.selected?.x === altar.x && window.session.selected?.y === altar.y, arrows: arrows.length, start: document.querySelector('[data-spot="balloon-stage"]').textContent, jobs: !!document.querySelector('[data-spot="balloon-jobs"]'), text: document.querySelector('.balloon').textContent };
  });
  await shot(page, n('stage'));
  assert(opened.altar && opened.arrows === 1, `the tap opens the altar and points the arrow (${JSON.stringify(opened)})`);
  assert(opened.start === 'Começar: Altar restaurado' && opened.jobs, `Começar and Profissões in the balloon (${JSON.stringify(opened)})`);
  assert(/Etapa 1 de 5: Altar restaurado/.test(opened.text) && /prata/.test(opened.text), `the stage, its cost (${opened.text})`);
  // Começar pays it: the builders and the bar show.
  await page.click('[data-spot="balloon-stage"]');
  await page.waitForFunction(() => window.state.temple.active, null, { timeout: 5000 });
  await page.waitForTimeout(400);
  const work = await page.evaluate(() => ({ bar: !!document.querySelector('.balloon .barline .bar'), text: document.querySelector('.balloon').textContent, line: document.querySelector('.nextstep').textContent }));
  await shot(page, n('work'));
  assert(work.bar && /Construtores: \d de 2/.test(work.text), `under way: builders and the bar (${work.text})`);
  // Short of builders: the line opens Profissões (with its builders' row).
  if (/ponha construtores/.test(work.line)) {
    await page.keyboard.press('Escape');
    await page.click('[data-spot="next-step"]');
    await page.waitForSelector('.panelbox.jobs:not(.hidden)', { timeout: 5000 });
    assert(await page.$('.jobrow[data-job="altar"]'), 'Profissões shows the altar builders');
    await shot(page, n('jobs'));
    await page.keyboard.press('Escape');
  }
  // Short of stone: the button is grey and says what is missing; the line says how much.
  await set(() => {
    const s = window.state;
    s.temple.active = false;
    s.temple.progress = 0;
    s.stone = 4;
    window.session.refresh();
  });
  await page.evaluate(() => {
    const altar = window.state.buildings.find((b) => b.kind === 'altar');
    window.session.select({ x: altar.x, y: altar.y });
  });
  await page.waitForTimeout(300);
  const lack = await page.evaluate(() => ({ dim: document.querySelector('[data-spot="balloon-stage"]').classList.contains('dim'), label: document.querySelector('[data-spot="balloon-stage"]').textContent, line: document.querySelector('.nextstep').textContent }));
  await shot(page, n('lack'));
  assert(lack.dim && lack.label.startsWith('Falta pedra') && /junte (\d+) pedra · 4\/\1/.test(lack.line), `short of stone (${JSON.stringify(lack)})`);
  // A debt comes first: red, Avisos opens and the arrow points at Demolir.
  await page.keyboard.press('Escape');
  await set(() => {
    window.state.silver = -10;
    window.session.refresh();
  });
  await page.waitForTimeout(200);
  const debt = await line();
  assert(debt.kind === 'crisis' && debt.text.startsWith('Dívida'), `a debt comes first (${debt.text})`);
  await page.click('[data-spot="next-step"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.arrow')].some((a) => !a.classList.contains('hidden')), null, { timeout: 8000 }).catch(() => {});
  const crisis = await page.evaluate(() => ({ alerts: !document.querySelector('.panelbox').classList.contains('hidden'), arrows: [...document.querySelectorAll('.arrow')].filter((a) => !a.classList.contains('hidden')).length }));
  await shot(page, n('crisis'));
  assert(crisis.alerts && crisis.arrows === 1, `the debt opens Avisos and points at Demolir (${JSON.stringify(crisis)})`);
  // Objetivos: the five stages with the construction mark.
  await page.keyboard.press('Escape');
  await page.click('[data-spot="panel-goals"]');
  await page.waitForTimeout(300);
  const stages = await page.evaluate(() => document.querySelectorAll('.panelbox .withicon svg').length);
  await shot(page, n('goals'));
  assert(stages === 5, `Objetivos marks the five stages (${stages})`);
}

const scenarios = {
  /** The HTML title: start and, once the tutorial was seen, the tutorial again; the install button when the browser offers it. */
  async title(page) {
    await page.goto(`${BASE}?seed=${SEED}`, { timeout: 90000 });
    await page.waitForSelector('[data-spot="start"]', { timeout: 60000 });
    await shot(page, 'title');
    assert(!(await page.$('[data-spot="tutorial-again"]')), 'a first game offers no tutorial again');
    // The city opens behind the title: the backdrop clears, the camera circles, the weeks and the interface wait.
    await page.waitForSelector('.title-screen.live', { timeout: 180000 });
    await page.waitForFunction(() => window.view3d?.ready && window.view3d.frames > 3, null, { timeout: 180000 });
    const h0 = await page.evaluate(() => window.view3d.rig.heading);
    await page.waitForTimeout(3000);
    await shot(page, 'title-live');
    const behind = await page.evaluate(() => ({ heading: window.view3d.rig.heading, hud: getComputedStyle(document.querySelector('.g3d #hud')).visibility }));
    assert(behind.heading !== h0, `the camera circles behind the title (${h0} → ${behind.heading})`);
    assert(behind.hud === 'hidden', `the game's interface waits behind the title (${behind.hud})`);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.session, null, { timeout: 30000 });
    const begun = await page.evaluate(() => ({ heading: window.view3d.rig.heading, hud: getComputedStyle(document.querySelector('.g3d #hud')).visibility, title: !!document.querySelector('.title-screen') }));
    const offView = Math.abs(((begun.heading - Math.PI / 4) % (Math.PI / 2) + Math.PI / 2) % (Math.PI / 2));
    assert(Math.min(offView, Math.PI / 2 - offView) < 0.01 && begun.hud === 'visible' && !begun.title, `Começar shows the game from the opening view (${JSON.stringify(begun)})`);
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
  end3d: { context: PHONE, run: (page) => end3dScenario(page, 'phone') },
  'end3d-pc': { context: PC, run: (page) => end3dScenario(page, 'pc') },
  touch3d: { context: PHONE, run: touch3dScenario },
  'context3d-pc': { context: PC, run: context3dScenario },
  'town3d-pc': { context: PC, run: town3dScenario },
  'night3d-pc': { context: PC, run: (page) => night3dScenario(page, 'pc') },
  'night3d-phone': { context: PHONE, run: (page) => night3dScenario(page, 'phone') },
  'street3d-pc': { context: PC, run: (page) => street3dScenario(page, 'pc') },
  'street3d-phone': { context: PHONE, run: (page) => street3dScenario(page, 'phone') },
  'walkers3d-pc': { context: PC, run: (page) => walkers3dScenario(page, 'pc') },
  'walkers3d-phone': { context: PHONE, run: (page) => walkers3dScenario(page, 'phone') },
  'houses3d-pc': { context: PC, run: (page) => houses3dScenario(page, 'pc') },
  'river3d-pc': { context: PC, run: (page) => river3dScenario(page) },
  'maquete3d-pc': { context: PC, run: (page) => maquete3dScenario(page) },
  'crafts3d-pc': { context: PC, run: (page) => crafts3dScenario(page) },
  'sanctuary3d-pc': { context: PC, run: (page) => sanctuary3dScenario(page) },
  'templestages3d-pc': { context: PC, run: (page) => templeStages3dScenario(page, false) },
  'templestages3d-phone': { context: PHONE, run: (page) => templeStages3dScenario(page, true) },
  'trees3d-pc': { context: PC, run: (page) => trees3dScenario(page) },
  'fields3d-pc': { context: PC, run: (page) => fields3dScenario(page) },
  'ground3d-pc': { context: PC, run: (page) => ground3dScenario(page, 'pc') },
  'ground3d-phone': { context: PHONE, run: (page) => ground3dScenario(page, 'phone') },
  'houses3d-phone': { context: PHONE, run: (page) => houses3dScenario(page, 'phone') },
  'tutorial3d-phone': { context: PHONE, run: (page) => tutorial3dScenario(page, 'phone') },
  'tutorial3d-pc': { context: PC, run: (page) => tutorial3dScenario(page, 'pc') },
  'ui3d-phone': { context: PHONE, run: (page) => ui3dScenario(page, 'phone') },
  'ui3d-pc': { context: PC, run: (page) => ui3dScenario(page, 'pc') },
  'jobs3d-phone': { context: PHONE, run: (page) => jobs3dScenario(page, 'phone') },
  'jobs3d-pc': { context: PC, run: (page) => jobs3dScenario(page, 'pc') },
  'nextstep3d-phone': { context: PHONE, run: (page) => nextstep3dScenario(page, 'phone') },
  'nextstep3d-pc': { context: PC, run: (page) => nextstep3dScenario(page, 'pc') },
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
      // The calm entry of balloons and panels (120 ms) starts on the next frame drawn, and SwiftShader
      // draws a few frames a second: shots would catch them half faded. Shown at once in the tests.
      await context.addInitScript(() => addEventListener('DOMContentLoaded', () => {
        const st = document.createElement('style');
        st.textContent = '.balloon, .toolballoon, .panelbox, .sheet, .settings, .modal, .modal .card, .tutorial { animation: none !important; }';
        document.head.append(st);
      }));
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

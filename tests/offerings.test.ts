import { describe, expect, it } from 'vitest';
import {
  altarRadius,
  BUILDINGS,
  changeJobTarget,
  checkGoal,
  computeEconomy,
  createGame,
  createRng,
  crewOf,
  gatherCells,
  gatherYield,
  GOALS,
  HOUSE_LEVELS,
  indexOf,
  isGatherSource,
  place,
  refreshCity,
  RULES,
  seasonOf,
  stageSite,
  startStage,
  stepWeek,
  storageFull,
  storageOf,
  TEMPLE_STAGES,
  buildersAtWork,
  type GameEvent,
  type GameState,
} from '../src/core';
import { constRng, EAST, emptyGame, hire, put, restoreAltar, road, ROADSIDE, westOf } from './helpers';

const never = constRng(0.99);
const P = BUILDINGS.pasture.gather!;
const DOWN = RULES.weeksToDowngrade;
const stageDef = (stage: number) => TEMPLE_STAGES[stage - 1];
const goalOf = (stage: number) => GOALS.findIndex((g) => g.type === 'templeStage' && g.stage === stage);
/** First week of a season from week 0. */
const firstWeekOf = (season: string) => {
  let w = 0;
  while (seasonOf(w) !== season) w++;
  return w;
};
const WINTER = firstWeekOf('winter');
const SUMMER = firstWeekOf('summer');
const offerEvents = (events: GameEvent[]) => events.filter((e) => e.type === 'offeringsMissing' || e.type === 'offeringsBack').map((e) => e.type);

/** Grass on the cells of a rect (the test map is sand everywhere). */
function grass(s: GameState, x0: number, y0: number, w: number, h: number) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) s.ground[indexOf(s, x, y)] = 'grass';
}

/** A pasture west of the starting road (21..23 x 30..32, radius 2: x 19..25, y 28..34). */
const PASTURE_X = westOf('pasture');
const PASTURE_Y = 30;

describe('pasture data', () => {
  it('Pasto: 3 x 3, 1 job, 30 silver and 10 wood, gathers free grass into the livestock', () => {
    expect(BUILDINGS.pasture).toMatchObject({ name: 'Pasto', category: 'supply', cost: 30, upkeep: 1, w: 3, h: 3, jobs: 1, materials: { wood: 10 } });
    expect(P).toMatchObject({ source: 'grass', radius: 2, max: 1.5, winterFactor: 0.5, product: 'livestock' });
    expect(P.perCell).toBeGreaterThan(0);
    expect(storageOf('livestock')).toBe(RULES.livestockStorage);
    expect(RULES.livestockStorage).toBeGreaterThan(0);
    expect(storageOf('wood')).toBe(RULES.materialStorage);
    expect(RULES.jobPriority.indexOf('pasture')).toBe(RULES.jobPriority.indexOf('quarry') + 1);
    expect(createGame(createRng(3)).livestock).toBe(0);
  });
});

describe('free grass', () => {
  it('counts only grass with no building, road, tree, stump or rock on it; sand and river do not count', () => {
    const s = emptyGame();
    grass(s, 19, 28, 2, 7); // x 19..20, y 28..34: 14 cells inside the radius
    const b = put(s, 'pasture', PASTURE_X, PASTURE_Y);
    expect(gatherCells(s, b)).toBe(14);
    const river = s.ground.findIndex((g) => g === 'river');
    expect(isGatherSource(s, river, 'grass')).toBe(false);
    expect(isGatherSource(s, indexOf(s, 26, 30), 'grass')).toBe(false); // sand
    s.feature[indexOf(s, 19, 34)] = 'olive';
    s.feature[indexOf(s, 20, 34)] = 'rock';
    s.feature[indexOf(s, 19, 32)] = 'stump';
    expect(gatherCells(s, b)).toBe(11);
    road(s, [[19, 33], [20, 33]]);
    expect(gatherCells(s, b)).toBe(9);
    // Building on the grass takes the cells: a house on 19..20 x 28..29 eats four.
    put(s, 'house', 19, 28);
    expect(gatherCells(s, b)).toBe(5);
    expect(isGatherSource(s, indexOf(s, 19, 28), 'grass')).toBe(false);
    // The pasture's own footprint never counts, even on grass.
    grass(s, PASTURE_X, PASTURE_Y, 3, 3);
    expect(gatherCells(s, b)).toBe(5);
  });

  it('a pasture with no free grass shows the "no source" balloon data: it makes nothing', () => {
    const s = emptyGame();
    const b = put(s, 'pasture', PASTURE_X, PASTURE_Y);
    hire(s, b);
    expect(gatherCells(s, b)).toBe(0);
    expect(computeEconomy(s).livestock).toBe(0);
  });
});

describe('pasture yield', () => {
  it('cells x perCell a week by its crew; crew 0 makes 0', () => {
    const s = emptyGame({ week: SUMMER });
    grass(s, 19, 28, 2, 7);
    const b = put(s, 'pasture', PASTURE_X, PASTURE_Y);
    expect(crewOf(s, b)).toHaveLength(0); // nobody lives in the test city
    expect(gatherYield(s, b)).toBeCloseTo(14 * P.perCell);
    expect(computeEconomy(s).livestock).toBe(0); // no shepherd, no livestock
    hire(s, b);
    expect(computeEconomy(s).livestock).toBeCloseTo(14 * P.perCell);
  });

  it('is capped at max on a wide meadow, and only winterFactor of it in winter', () => {
    const s = emptyGame({ week: SUMMER });
    grass(s, 0, 0, s.cols, s.rows);
    const b = put(s, 'pasture', PASTURE_X, PASTURE_Y);
    hire(s, b);
    expect(gatherCells(s, b) * P.perCell).toBeGreaterThan(P.max);
    expect(computeEconomy(s).livestock).toBe(P.max);
    s.week = WINTER;
    expect(computeEconomy(s).livestock).toBeCloseTo(P.max * P.winterFactor!);
    s.week = WINTER - 1; // the last week of autumn: the whole yield
    expect(computeEconomy(s).livestock).toBe(P.max);
  });

  it('a disconnected pasture makes nothing', () => {
    const s = emptyGame({ week: SUMMER });
    grass(s, 0, 0, 6, 6);
    const b = put(s, 'pasture', 1, 1);
    expect(b.connected).toBe(false);
    expect(gatherYield(s, b)).toBe(0);
    expect(computeEconomy(s).livestock).toBe(0);
  });

  it('stops at the pens\' cap (what fits, then nothing), and the stock never goes past it', () => {
    const s = emptyGame({ week: SUMMER });
    grass(s, 0, 0, s.cols, s.rows);
    hire(s, put(s, 'pasture', PASTURE_X, PASTURE_Y));
    const cap = storageOf('livestock');
    s.livestock = cap - 0.5;
    expect(computeEconomy(s).livestock).toBe(0.5); // only what fits
    expect(computeEconomy(s).stored.livestock).toBeCloseTo(0.5 / P.max);
    expect(storageFull(s, 'livestock')).toBe(false);
    stepWeek(s, never);
    expect(s.livestock).toBe(cap);
    expect(storageFull(s, 'livestock')).toBe(true);
    expect(computeEconomy(s).livestock).toBe(0);
    for (let k = 0; k < 5; k++) stepWeek(s, never);
    expect(s.livestock).toBe(cap); // the altar is in ruins: nothing burns, nothing more comes in
  });
});

describe('offerings', () => {
  it('the altar in ruins burns nothing and covers nothing, whatever the pens hold', () => {
    const s = emptyGame();
    s.livestock = 10;
    expect(altarRadius(s)).toBe(0);
    const events = stepWeek(s, never);
    expect(s.livestock).toBe(10);
    expect(s.offered).toBe(false);
    expect(offerEvents(events)).toEqual([]);
    expect(s.coverage.sacred.some(Boolean)).toBe(false);
  });

  it('each stage built burns its own offering a week (the last one built)', () => {
    for (let stage = 1; stage <= TEMPLE_STAGES.length; stage++) {
      const s = emptyGame();
      restoreAltar(s, stage, 10);
      const events = stepWeek(s, never);
      expect(s.livestock, `stage ${stage}`).toBeCloseTo(10 - stageDef(stage).offering);
      expect(s.offered).toBe(true);
      expect(offerEvents(events)).toEqual([]);
    }
    // The offering grows with every stage.
    const offerings = TEMPLE_STAGES.map((st) => st.offering);
    offerings.forEach((o, k) => expect(o).toBeGreaterThan(k ? offerings[k - 1] : 0));
  });

  it('an exact offering is enough and leaves the pens empty; a hair short burns nothing and covers nothing', () => {
    const s = emptyGame();
    restoreAltar(s, 1, stageDef(1).offering);
    stepWeek(s, never);
    expect([s.livestock, s.offered]).toEqual([0, true]);
    const t = emptyGame();
    restoreAltar(t, 2, stageDef(2).offering - 0.01);
    const events = stepWeek(t, never);
    expect([t.livestock, t.offered]).toEqual([stageDef(2).offering - 0.01, false]);
    expect(offerEvents(events)).toEqual(['offeringsMissing']);
    expect(altarRadius(t)).toBe(0);
    expect(t.coverage.sacred.some(Boolean)).toBe(false); // refreshed at the week's end
  });

  it('is burned after the week\'s livestock came in: a pasture feeding the altar from empty pens', () => {
    const s = emptyGame({ week: SUMMER });
    grass(s, 0, 0, s.cols, s.rows);
    hire(s, put(s, 'pasture', PASTURE_X, PASTURE_Y));
    restoreAltar(s, 1, 0);
    const events = stepWeek(s, never);
    expect(s.offered).toBe(true);
    expect(s.livestock).toBeCloseTo(P.max - stageDef(1).offering);
    expect(offerEvents(events)).toEqual([]);
  });

  it('"offeringsMissing" once per episode, at the altar; "offeringsBack" when the pens have enough again', () => {
    const s = emptyGame();
    const altar = s.buildings.find((b) => b.kind === 'altar')!;
    const o = stageDef(1).offering;
    restoreAltar(s, 1, 2 * o); // two offerings
    const log: string[][] = [];
    const all: GameEvent[] = [];
    const week = () => {
      const e = stepWeek(s, never);
      all.push(...e);
      log.push(offerEvents(e));
    };
    week();
    week();
    expect(s.livestock).toBe(0);
    week(); // nothing left
    expect(s.offered).toBe(false);
    week();
    week();
    s.livestock = 3 * o;
    week(); // back
    expect(s.offered).toBe(true);
    expect(s.livestock).toBeCloseTo(2 * o);
    week();
    s.livestock = 0;
    week(); // a second episode
    expect(log).toEqual([[], [], ['offeringsMissing'], [], [], ['offeringsBack'], [], ['offeringsMissing']]);
    expect(all.find((e) => e.type === 'offeringsMissing')).toEqual({ type: 'offeringsMissing', x: altar.x, y: altar.y });
  });

  it('restoring the altar (stage 1 done) makes it offered at once: the lack shows from the next week', () => {
    const s = emptyGame({ goalIndex: goalOf(1) });
    expect(startStage(s)).toEqual({ ok: true });
    hire(s, stageSite(s)!);
    s.temple.progress = stageDef(1).work - buildersAtWork(s);
    s.livestock = 0;
    const done = stepWeek(s, never);
    expect(done).toContainEqual(expect.objectContaining({ type: 'stageDone', stage: 1 }));
    expect(s.offered).toBe(true);
    expect(offerEvents(done)).toEqual([]);
    expect(s.coverage.sacred[indexOf(s, 22 - stageDef(1).sacredRadius, 24)]).toBe(true);
    expect(offerEvents(stepWeek(s, never))).toEqual(['offeringsMissing']);
    expect(s.coverage.sacred.some(Boolean)).toBe(false);
  });
});

describe('the altar\'s sacred radius', () => {
  it('grows with the stages (sacredRadius of the last one built, from the altar\'s edge), 0 without the offering', () => {
    expect(TEMPLE_STAGES.map((st) => st.sacredRadius)).toEqual([6, 7, 8, 10, 10]);
    for (let stage = 1; stage <= TEMPLE_STAGES.length; stage++) {
      const s = emptyGame();
      restoreAltar(s, stage);
      const r = stageDef(stage).sacredRadius;
      expect(altarRadius(s)).toBe(r);
      // The altar covers x, y = 22..25: r cells beyond each edge, not one more.
      expect(s.coverage.sacred[indexOf(s, 22 - r, 22 - r)], `stage ${stage}`).toBe(true);
      expect(s.coverage.sacred[indexOf(s, 25 + r, 25 + r)]).toBe(true);
      expect(s.coverage.sacred[indexOf(s, 22 - r - 1, 24)]).toBe(false);
      expect(s.coverage.sacred[indexOf(s, 24, 25 + r + 1)]).toBe(false);
      s.offered = false;
      refreshCity(s);
      expect(altarRadius(s)).toBe(0);
      expect(s.coverage.sacred.some(Boolean)).toBe(false);
    }
  });
});

describe('stone houses and the altar', () => {
  /** A stone house by the altar (rows 27..28) with a plaza: all its needs while the altar is fed. */
  function stoneStreet(livestock: number) {
    const s = emptyGame();
    restoreAltar(s, 1, livestock);
    const h = put(s, 'house', ROADSIDE, 27, 3);
    put(s, 'plaza', ROADSIDE, 29);
    return { s, h };
  }
  const run = (s: GameState, weeks: number) => {
    for (let k = 0; k < weeks; k++) {
      s.food = 1000;
      stepWeek(s, never);
    }
  };

  it('keeps its level while the altar has its offering', () => {
    const { s, h } = stoneStreet(100);
    run(s, 4 * DOWN);
    expect(h.level).toBe(3);
  });

  it('falls to mud-brick weeksToDowngrade weeks after the altar lost its offering (the stock is the cushion)', () => {
    const { s, h } = stoneStreet(stageDef(1).offering * 2); // two weeks of offerings
    run(s, 2);
    expect(s.offered).toBe(true);
    run(s, 1); // the pens are empty: the altar stops covering at this week's end
    expect(s.offered).toBe(false);
    expect(h.level).toBe(3);
    run(s, DOWN - 1);
    expect(h.level).toBe(3);
    run(s, 1);
    expect(h.level).toBe(2);
  });

  it('livestock back before weeksToDowngrade weeks keeps the stone house', () => {
    const { s, h } = stoneStreet(0);
    run(s, DOWN - 1);
    expect(s.offered).toBe(false);
    s.livestock = 10;
    run(s, 2 * DOWN);
    expect(h.level).toBe(3);
  });

  it('before the altar is restored, no house climbs past mud-brick even with a plaza', () => {
    const s = emptyGame();
    const h = put(s, 'house', ROADSIDE, 27, 2);
    put(s, 'plaza', ROADSIDE, 29);
    s.livestock = 40; // livestock alone does nothing
    run(s, 3 * RULES.weeksToUpgrade[1]);
    expect(h.level).toBe(2);
    expect(HOUSE_LEVELS[3].needs).toContain('sacred');
    expect(HOUSE_LEVELS[4].needs).toContain('sacred');
    expect(HOUSE_LEVELS[2].needs).not.toContain('sacred');
  });
});

describe('pasture goals', () => {
  it('goal 19 asks for 2 connected pastures', () => {
    const i = GOALS.findIndex((g) => g.type === 'build' && g.kind === 'pasture' && g.target === 2);
    expect(i).toBe(18);
    const s = emptyGame({ goalIndex: i, silver: 0 });
    put(s, 'pasture', PASTURE_X, PASTURE_Y);
    put(s, 'pasture', 1, 1); // off the road
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(events).toEqual([]);
    put(s, 'pasture', EAST, 27);
    checkGoal(s, events);
    expect(events).toEqual([{ type: 'goal', index: i, reward: GOALS[i].reward, unlock: undefined }]);
  });

  it('a pasture is placed with its silver and wood', () => {
    const s = emptyGame({ silver: 30, wood: 10, unlocked: ['pasture'] });
    expect(place(s, 'pasture', PASTURE_X, PASTURE_Y).ok).toBe(true);
    expect([s.silver, s.wood]).toEqual([0, 0]);
  });
});

describe('asked-for professions fill first', () => {
  /**
   * Three workshops (9 jobs) and a big house (8 adults): everyone at work, one workshop job free.
   * Then a lumber (2 jobs, nobody free to take them) and the Alicerce under way (4 builders asked).
   */
  function city() {
    const s = emptyGame({ goalIndex: goalOf(2) });
    s.temple = { done: 1, active: false, progress: 0 };
    s.offered = true;
    s.livestock = 100;
    put(s, 'temple', EAST, 30);
    for (const y of [27, 30, 33]) put(s, 'workshop', westOf('workshop'), y);
    put(s, 'house', EAST, 27, HOUSE_LEVELS.length - 1);
    const lumber = put(s, 'lumber', westOf('lumber'), 36);
    expect(startStage(s)).toEqual({ ok: true });
    return { s, lumber };
  }
  const workshops = (s: GameState) => s.buildings.filter((b) => b.kind === 'workshop').reduce((a, b) => a + crewOf(s, b).length, 0);

  it('new adults go to the builders before the free jobs of automatic professions', () => {
    const { s, lumber } = city();
    expect(workshops(s)).toBe(HOUSE_LEVELS.at(-1)!.capacity);
    expect(buildersAtWork(s)).toBe(0); // nobody free
    put(s, 'house', ROADSIDE, 40, 1); // a tent: 3 new adults
    expect(buildersAtWork(s)).toBe(HOUSE_LEVELS[1].capacity);
    expect(crewOf(s, lumber)).toHaveLength(0); // the lumber ranks before the works, but was not asked for
    expect(workshops(s)).toBe(HOUSE_LEVELS.at(-1)!.capacity);
  });

  it('a worker freed by − elsewhere goes to the works, not to a free automatic job', () => {
    const { s, lumber } = city();
    expect(changeJobTarget(s, 'workshop', -1)).toBe(true);
    expect(buildersAtWork(s)).toBe(1);
    expect(crewOf(s, lumber)).toHaveLength(0);
    // With every builder in, the next freed worker takes the automatic job.
    for (let k = 0; k < stageDef(2).builders - 1; k++) changeJobTarget(s, 'workshop', -1);
    expect(buildersAtWork(s)).toBe(stageDef(2).builders);
    changeJobTarget(s, 'workshop', -1);
    expect(crewOf(s, lumber)).toHaveLength(1);
  });
});

describe('determinism', () => {
  it('the same seed gives the same livestock, offerings and events', () => {
    const play = (seed: number) => {
      const s = createGame(createRng(seed));
      const rng = createRng(seed);
      s.temple = { done: 1, active: false, progress: 0 };
      s.offered = true;
      s.livestock = 3;
      Object.assign(s, { silver: 1000, wood: 1000, unlocked: [...s.unlocked, 'pasture'] });
      // The first pasture spot that fits west of the starting road.
      for (let y = 28; y < 44 && !s.buildings.some((b) => b.kind === 'pasture'); y++) place(s, 'pasture', westOf('pasture'), y);
      const log: unknown[] = [];
      for (let k = 0; k < 80; k++) log.push(offerEvents(stepWeek(s, rng)), s.livestock, s.offered);
      return JSON.stringify(log);
    };
    expect(play(5)).toBe(play(5));
    expect(play(19)).toBe(play(19));
  });
});

import { describe, expect, it } from 'vitest';
import {
  alerts,
  clearCell,
  BUILDINGS,
  byRiver,
  checkGoal,
  computeEconomy,
  createGame,
  createRng,
  fieldHarvest,
  firstHarvestWeek,
  foodCapacity,
  foodForecast,
  foodLastsToHarvest,
  goalFraction,
  goalProgress,
  goalTarget,
  harvestsIn,
  HOUSE_LEVELS,
  RULES,
  seasonOf,
  stepWeek,
  weeksToHarvest,
  type GameEvent,
  type GoalDef,
} from '../src/core';
import { besideRiver, constRng, EAST, emptyGame, put, ROADSIDE, westOf } from './helpers';

const W = RULES.weeksPerSeason; // 13
const YEAR = 4 * W;
/** First week of each season of year 1 (the game starts in autumn). */
const WINTER = W;
const SPRING = 2 * W;
const SUMMER = 3 * W;
const AUTUMN2 = YEAR;
const never = constRng(0.99);
const always = constRng(0);

describe('caravan', () => {
  it('founds the city with 2 to 4 tents by the altar and 10 to 20 weeks of food, capped by the stores', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      const s = createGame(createRng(seed));
      const tents = s.buildings.filter((b) => b.kind === 'house');
      expect(tents.length).toBeGreaterThanOrEqual(RULES.caravan.families[0]);
      expect(tents.length).toBeLessThanOrEqual(RULES.caravan.families[1]);
      expect(s.start.families).toBe(tents.length);
      seen.add(tents.length);
      for (const t of tents) expect(t).toMatchObject({ level: 1, connected: true, built: 0 });
      const eaten = tents.length * HOUSE_LEVELS[1].residents * HOUSE_LEVELS[1].food;
      expect(s.food).toBeLessThanOrEqual(RULES.baseFoodStorage);
      expect(s.start.foodWeeks).toBe(Math.floor(s.food / eaten + 1e-9));
      expect(s.start.foodWeeks).toBeLessThanOrEqual(RULES.caravan.foodWeeks[1]);
      // Below 10 weeks only when the store limit cut it.
      if (s.start.foodWeeks < RULES.caravan.foodWeeks[0]) expect(s.food).toBe(RULES.baseFoodStorage);
    }
    expect([...seen].sort()).toEqual([2, 3, 4]);
  });

  it('is the same for the same seed', () => {
    const a = createGame(createRng(9));
    const b = createGame(createRng(9));
    expect(a.start).toEqual(b.start);
    expect(a.food).toBe(b.food);
  });

  it('starts in autumn with the new prices and silver', () => {
    const s = createGame(createRng(3));
    expect(seasonOf(s.week)).toBe('autumn');
    expect(RULES.startSilver).toBe(180);
    expect([BUILDINGS.house.cost, BUILDINGS.field.cost, BUILDINGS.well.cost, RULES.roadCost]).toEqual([20, 30, 40, 2]);
  });
});

describe('harvest', () => {
  it('a field built in autumn harvests in the next spring only', () => {
    expect(harvestsIn({ built: 0 }, 0)).toBe(false); // autumn
    expect(harvestsIn({ built: 0 }, WINTER)).toBe(false);
    expect(harvestsIn({ built: 0 }, SPRING)).toBe(true);
    expect(harvestsIn({ built: 0 }, SPRING + W - 1)).toBe(true);
    expect(harvestsIn({ built: 0 }, SUMMER)).toBe(false);
    expect(harvestsIn({ built: W - 1 }, SPRING)).toBe(true); // last week of autumn still sows
  });

  it('a field built after the autumn waits for the spring of the next year', () => {
    expect(harvestsIn({ built: WINTER }, SPRING)).toBe(false);
    expect(harvestsIn({ built: WINTER }, SPRING + YEAR)).toBe(true);
    expect(harvestsIn({ built: SPRING + 3 }, SPRING + YEAR)).toBe(true);
    expect(firstHarvestWeek(0)).toBe(SPRING);
    expect(firstHarvestWeek(WINTER)).toBe(SPRING + YEAR);
    expect(firstHarvestWeek(SUMMER)).toBe(SPRING + YEAR);
  });

  it('delivers the yearly harvest over the spring weeks, nothing in the other seasons', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 4); // 16 residents: enough workers
    const f = put(s, 'field', westOf('field'), 30);
    let total = 0;
    const perSeason: Record<string, number> = { autumn: 0, winter: 0, spring: 0, summer: 0 };
    for (let w = 0; w < YEAR; w++) {
      const h = fieldHarvest(s, f, w);
      perSeason[seasonOf(w)] += h;
      total += h;
    }
    expect(total).toBeCloseTo(BUILDINGS.field.harvest!);
    expect(perSeason).toMatchObject({ autumn: 0, winter: 0, summer: 0 });
  });

  it('fields feed nobody outside spring, while the houses eat every week', () => {
    const s = emptyGame({ food: 30 });
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'field', westOf('field'), 30);
    stepWeek(s, never);
    expect(s.food).toBeCloseTo(30 - 3 * 0.2);
    s.week = SPRING;
    const before = s.food;
    stepWeek(s, never);
    expect(s.food).toBeGreaterThan(before);
  });

  it('weeks to the harvest count to the next first week of spring', () => {
    expect(weeksToHarvest(0)).toBe(SPRING);
    expect(weeksToHarvest(SPRING - 1)).toBe(1);
    expect(weeksToHarvest(SPRING)).toBe(YEAR);
    expect(weeksToHarvest(SUMMER)).toBe(YEAR - W);
  });

  it('announces the first harvest week and counts what was harvested', () => {
    const s = emptyGame({ week: SPRING });
    put(s, 'house', ROADSIDE, 27, 4);
    put(s, 'field', westOf('field'), 30).built = 0;
    put(s, 'granary', EAST, 30);
    const events = stepWeek(s, never);
    expect(events.find((e) => e.type === 'harvestStart')).toBeDefined();
    expect(s.harvested).toBeGreaterThan(0);
    expect(stepWeek(s, never).find((e) => e.type === 'harvestStart')).toBeUndefined();
  });
});

describe('stores and granary', () => {
  it('keeps 40 without a granary and adds 150 per connected granary', () => {
    const s = emptyGame();
    expect(foodCapacity(s)).toBe(40);
    put(s, 'granary', EAST, 30);
    expect(foodCapacity(s)).toBe(190);
    put(s, 'granary', EAST, 34);
    expect(foodCapacity(s)).toBe(340);
    put(s, 'granary', 2, 2); // not connected
    expect(foodCapacity(s)).toBe(340);
    expect(BUILDINGS.granary).toMatchObject({ cost: 60, upkeep: 2, w: 3, h: 3, jobs: 1, storage: 150, category: 'supply' });
  });

  it('spoils the food above the stores, with one event per stretch and an alert', () => {
    const s = emptyGame({ food: 39 });
    put(s, 'workshop', EAST, 30); // a place for the field workers
    put(s, 'house', ROADSIDE, 27, 4);
    put(s, 'field', westOf('field'), 30).built = 0;
    s.week = SPRING;
    const first = stepWeek(s, never);
    expect(first).toContainEqual({ type: 'spoilStart' });
    expect(s.food).toBe(40);
    expect(s.spoiled).toBeGreaterThan(0);
    expect(alerts(s).map((a) => a.kind)).toContain('spoiling');
    expect(stepWeek(s, never)).not.toContainEqual({ type: 'spoilStart' });
  });
});

describe('forecast', () => {
  it('counts the whole weeks of food left and the season they end in', () => {
    const s = emptyGame({ food: 6 });
    put(s, 'house', ROADSIDE, 27, 1); // eats 0.6 a week
    expect(foodForecast(s)).toEqual({ weeks: 9, season: 'autumn' });
    s.food = 30;
    expect(foodForecast(s)).toEqual({ weeks: 49, season: 'summer' });
  });

  it('counts the coming harvest and the store limit', () => {
    const s = emptyGame({ food: 20 });
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29, 2); // 9 residents
    put(s, 'field', westOf('field'), 31);
    expect(foodLastsToHarvest(s)).toBe(false); // 1.8 a week for 26 weeks
    s.food = 40;
    put(s, 'granary', EAST, 30);
    s.food = 60;
    expect(foodLastsToHarvest(s)).toBe(true);
    expect(foodForecast(s)).toBeNull(); // the spring harvest fills the granary for the rest of the year
  });

  it('is null when nothing is eaten', () => {
    expect(foodForecast(emptyGame())).toBeNull();
  });
});

describe('winter and drought', () => {
  it('tents leave more easily in a winter famine', () => {
    expect(RULES.winterFamineLeaveChance).toBeGreaterThan(RULES.famineLeaveChance);
    const between = constRng((RULES.winterFamineLeaveChance + RULES.famineLeaveChance) / 2);
    const tent = (week: number) => {
      const s = emptyGame({ food: 0, famine: true, week });
      put(s, 'well', EAST, 27);
      return [s, put(s, 'house', ROADSIDE, 27, 1)] as const;
    };
    const [autumn, a] = tent(2);
    stepWeek(autumn, between);
    expect(a.level).toBe(1);
    const [winter, w] = tent(WINTER + 2);
    expect(stepWeek(winter, between)).toContainEqual({ type: 'familyLeft', x: ROADSIDE, y: 27 });
    expect(w.level).toBe(0);
  });

  it('a mud-brick house protects from the winter', () => {
    const s = emptyGame({ food: 0, famine: true, week: WINTER + 2 });
    put(s, 'well', EAST, 27);
    const b = put(s, 'house', ROADSIDE, 27, 2);
    expect(stepWeek(s, constRng(0.3)).find((e) => e.type === 'familyLeft')).toBeUndefined();
    expect(b.level).toBe(2);
  });

  it('a dry year cuts the harvest of fields away from the river', () => {
    const s = emptyGame({ week: SPRING });
    const dry = put(s, 'field', westOf('field'), 30);
    dry.built = 0;
    const full = fieldHarvest(s, dry, SPRING, false);
    expect(fieldHarvest(s, dry, SPRING, true)).toBeCloseTo(full * RULES.drought.harvestFactor);
    expect(RULES.drought.harvestFactor).toBe(0.4);
  });

  it('fields touching the river harvest in full in a dry year', () => {
    const s = emptyGame({ week: SPRING });
    const y = 30;
    const left = besideRiver(s, y);
    const f = put(s, 'field', left, y);
    f.built = 0;
    expect(byRiver(s, f)).toBe(true);
    expect(fieldHarvest(s, f, SPRING, true)).toBeCloseTo(fieldHarvest(s, f, SPRING, false));
  });

  it('rolls the drought each winter (never in year 1), announces it and ends it in autumn', () => {
    expect(RULES.drought).toMatchObject({ chance: 0.25, safeYears: 1, neverTwice: true });
    const s = emptyGame({ week: WINTER - 1 });
    stepWeek(s, always);
    expect(s.drought).toBe(false); // first winter: year 1 is safe
    s.week = WINTER + YEAR - 1;
    const events = stepWeek(s, always);
    expect(s.drought).toBe(true);
    expect(events).toContainEqual({ type: 'drought' });
    expect(alerts(s).map((a) => a.kind)).toContain('drought');
    s.week = AUTUMN2 + YEAR - 1;
    stepWeek(s, never);
    expect(s.drought).toBe(false);
    expect(s.lastDrought).toBe(true);
  });

  it('is never dry two years in a row, nor in year 1, even when every roll hits', () => {
    const s = emptyGame();
    const dry: boolean[] = [];
    for (let year = 0; year < 5; year++) {
      while (s.week < WINTER + year * YEAR) stepWeek(s, always);
      dry.push(s.drought);
    }
    expect(dry).toEqual([false, true, false, true, false]);
  });

  it('a missed roll keeps the year normal (chance 25%)', () => {
    const s = emptyGame({ week: WINTER + YEAR - 1 });
    const events = stepWeek(s, constRng(RULES.drought.chance));
    expect(s.drought).toBe(false);
    expect(events).not.toContainEqual({ type: 'drought' });
    const t = emptyGame({ week: WINTER + YEAR - 1 });
    stepWeek(t, constRng(RULES.drought.chance - 0.01));
    expect(t.drought).toBe(true);
  });

  it('the drought alert shows in winter and spring, not in summer', () => {
    const s = emptyGame({ drought: true, week: WINTER + YEAR });
    expect(alerts(s).map((a) => a.kind)).toContain('drought');
    s.week = SPRING + YEAR;
    expect(alerts(s).map((a) => a.kind)).toContain('drought');
    s.week = SUMMER + YEAR;
    expect(alerts(s).map((a) => a.kind)).not.toContain('drought');
  });

  it('a dry spring lowers the food a field brings in a week of the simulation', () => {
    const run = (drought: boolean) => {
      const s = emptyGame({ week: SPRING + YEAR, drought, food: 0 });
      put(s, 'house', ROADSIDE, 27, 4); // 16 residents: 6 workers for 2 jobs
      put(s, 'field', westOf('field'), 30).built = 0;
      return computeEconomy(s).harvest;
    };
    expect(run(false)).toBeCloseTo(BUILDINGS.field.harvest! / W);
    expect(run(true)).toBeCloseTo((BUILDINGS.field.harvest! / W) * RULES.drought.harvestFactor);
  });
});

describe('alerts', () => {
  it('warns about the winter at the end of autumn while there are tents', () => {
    const s = emptyGame({ week: W - RULES.winterWarningWeeks });
    put(s, 'well', EAST, 27);
    put(s, 'house', ROADSIDE, 27, 1);
    s.food = 40;
    expect(alerts(s).map((a) => a.kind)).toContain('winterComing');
    s.week = W - RULES.winterWarningWeeks - 1;
    expect(alerts(s).map((a) => a.kind)).not.toContain('winterComing');
  });

  it('warns in summer when the food will not last until the harvest', () => {
    const s = emptyGame({ week: SUMMER, food: 10 });
    put(s, 'house', ROADSIDE, 27, 1);
    expect(alerts(s).map((a) => a.kind)).toContain('foodShort');
    s.week = WINTER;
    expect(alerts(s).map((a) => a.kind)).not.toContain('foodShort');
  });
});

describe('milestones', () => {
  const milestones = (events: GameEvent[]) => events.flatMap((e) => (e.type === 'milestone' ? [e.id] : []));

  it('a new family, the first mud-brick and stone houses: once each', () => {
    const s = emptyGame();
    put(s, 'well', EAST, 27); // families only come with water for every house
    put(s, 'house', ROADSIDE, 27);
    put(s, 'house', ROADSIDE, 29);
    const got: string[] = [];
    for (let k = 0; k < 10; k++) got.push(...milestones(stepWeek(s, always)));
    expect(s.buildings.filter((b) => b.kind === 'house' && b.level >= 1)).toHaveLength(2);
    expect(got.filter((m) => m === 'firstFamily')).toEqual(['firstFamily']);
    expect(s.milestones).toContain('firstFamily');
    expect(Object.keys(s.milestoneWeeks).sort()).toEqual([...s.milestones].sort());
    // Levels reached by houses that did not come from a family.
    const t = emptyGame();
    put(t, 'well', EAST, 27);
    put(t, 'market', EAST, 30);
    const h = put(t, 'house', ROADSIDE, 27, 1);
    const seen: string[] = [];
    for (let k = 0; k < 2 * RULES.weeksToChange; k++) seen.push(...milestones(stepWeek(t, never)));
    expect(h.level).toBe(3);
    expect(seen).toEqual(['firstMud', 'firstStone']);
    expect(t.milestones).toEqual(['firstMud', 'firstStone']);
  });

  it('keeps the week each milestone was reached, and never moves it', () => {
    const s = emptyGame();
    put(s, 'well', EAST, 27);
    put(s, 'house', ROADSIDE, 27);
    let at = -1;
    for (let k = 0; k < 10; k++) {
      const before = s.week;
      if (milestones(stepWeek(s, always)).includes('firstFamily')) at = before;
    }
    expect(at).toBeGreaterThanOrEqual(0);
    const w = s.milestoneWeeks.firstFamily!;
    expect(w === at || w === at + 1).toBe(true);
    for (let k = 0; k < 5; k++) stepWeek(s, always);
    expect(s.milestoneWeeks.firstFamily).toBe(w);
  });

  it('the caravan tents do not count as the first family', () => {
    const s = createGame(createRng(4));
    for (let k = 0; k < 3; k++) stepWeek(s, never);
    expect(s.milestones).not.toContain('firstFamily');
  });

  it('the first harvest and the first winter, only once', () => {
    const s = emptyGame({ week: SPRING - 1, food: 40 });
    put(s, 'house', ROADSIDE, 27, 4);
    put(s, 'field', westOf('field'), 30).built = 0;
    const got: string[] = [];
    for (let k = 0; k < 3; k++) got.push(...milestones(stepWeek(s, never)));
    expect(got).toContain('firstWinter');
    expect(got).toContain('firstHarvest');
    expect(got.filter((m) => m === 'firstHarvest')).toHaveLength(1);
  });

  it('a year without famine is reached when the autumn comes back without a famine week', () => {
    const s = emptyGame({ week: AUTUMN2 - 1 });
    expect(milestones(stepWeek(s, never))).toContain('yearWithoutFamine');
    const t = emptyGame({ week: AUTUMN2 - 1, famineThisYear: true });
    expect(milestones(stepWeek(t, never))).not.toContain('yearWithoutFamine');
    expect(t.famineThisYear).toBe(false); // a new year starts
  });
});

describe('history', () => {
  it('keeps one record per week, at most historyWeeks', () => {
    const s = emptyGame();
    for (let k = 0; k < RULES.historyWeeks + 5; k++) stepWeek(s, never);
    expect(s.history).toHaveLength(RULES.historyWeeks);
    const last = s.history.at(-1)!;
    expect(last).toEqual({ silver: s.silver, food: s.food, residents: computeEconomy(s).residents, happiness: computeEconomy(s).happiness, capacity: foodCapacity(s) });
    expect(s.history[0]).not.toBe(last);
  });
});

describe('survival goals', () => {
  const goal = (type: GoalDef['type'], target = 1): GoalDef => ({ type, target, reward: 0, text: '' });

  it('food until spring: weeks the food lasts, out of the weeks left until the first spring', () => {
    const s = emptyGame({ food: 5, goalIndex: 0 });
    put(s, 'house', ROADSIDE, 27, 1); // eats 0.6 a week: famine in the 9th week
    const g = goal('foodUntilSpring');
    expect(goalTarget(s, g)).toBe(SPRING);
    expect(goalProgress(s, g)).toBe(8);
    s.food = 40;
    put(s, 'granary', EAST, 30);
    s.food = 100;
    expect(goalProgress(s, g)).toBe(SPRING);
    s.week = WINTER;
    expect(goalTarget(s, g)).toBe(SPRING - WINTER); // the target shrinks as the spring comes
    expect(goalProgress(s, g)).toBe(SPRING - WINTER);
  });

  it('food until spring is done by the forecast, or once the first spring begins', () => {
    const s = emptyGame({ food: 40, goalIndex: 0 });
    put(s, 'house', ROADSIDE, 27, 1); // 40 / 0.6 = 66 weeks
    const events: GameEvent[] = [];
    checkGoal(s, events);
    expect(s.goalIndex).toBe(1);
    const t = emptyGame({ food: 1, goalIndex: 0, week: SPRING - 1 });
    put(t, 'house', ROADSIDE, 27, 1);
    put(t, 'house', ROADSIDE, 29, 1);
    put(t, 'house', ROADSIDE, 31, 1); // 1.8 a week: famine this week
    checkGoal(t, []);
    expect(t.goalIndex).toBe(0);
    t.week = SPRING;
    expect(goalTarget(t, goal('foodUntilSpring'))).toBe(0);
    checkGoal(t, []);
    expect(t.goalIndex).toBe(1);
  });

  it('water for every house: plots too, at least the target', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29, 1);
    const g = goal('water', 4);
    expect(goalTarget(s, g)).toBe(4);
    expect(goalProgress(s, g)).toBe(0);
    put(s, 'well', EAST, 27);
    expect(goalProgress(s, g)).toBe(2);
    for (let y = 31; y <= 37; y += 2) put(s, 'house', ROADSIDE, y); // 4 plots more, some out of the well
    expect(goalTarget(s, g)).toBe(6);
    expect(goalProgress(s, g)).toBeLessThan(6);
    expect(goalFraction({ ...s, goalIndex: 1 })).toBeCloseTo(goalProgress(s, g) / 6);
    put(s, 'house', 2, 2); // a house off the roads counts neither way, like the family gate
    expect(goalTarget(s, g)).toBe(6);
  });

  it('the first harvest counts the food harvested since the start', () => {
    const s = emptyGame();
    const g = goal('harvest', 12);
    expect(goalProgress(s, g)).toBe(0);
    s.harvested = 5;
    expect(goalProgress(s, g)).toBe(5);
    expect(goalTarget(s, g)).toBe(12);
  });
});

describe('harvest (simulation edges)', () => {
  it('a field placed in winter stays empty in the coming spring and harvests in the next one', () => {
    const s = emptyGame({ week: WINTER });
    put(s, 'house', ROADSIDE, 27, 4); // enough workers
    const f = put(s, 'field', westOf('field'), 30);
    expect(f.built).toBe(WINTER);
    s.week = SPRING;
    expect(computeEconomy(s).harvest).toBe(0);
    s.week = SPRING + YEAR;
    expect(computeEconomy(s).harvest).toBeCloseTo(BUILDINGS.field.harvest! / W);
  });

  it('a field placed in the last week of autumn harvests in the first spring', () => {
    const s = emptyGame({ week: W - 1 });
    put(s, 'house', ROADSIDE, 27, 4);
    put(s, 'field', westOf('field'), 30);
    s.week = SPRING;
    expect(computeEconomy(s).harvest).toBeCloseTo(BUILDINGS.field.harvest! / W);
  });

  it('a disconnected field harvests nothing', () => {
    const s = emptyGame({ week: SPRING });
    put(s, 'house', ROADSIDE, 27, 4);
    const f = put(s, 'field', 2, 2);
    f.built = 0;
    expect(f.connected).toBe(false);
    expect(fieldHarvest(s, f, SPRING)).toBe(0);
    expect(computeEconomy(s).harvest).toBe(0);
  });

  it('the harvest is scaled by the worker efficiency', () => {
    const s = emptyGame({ week: SPRING });
    put(s, 'house', ROADSIDE, 27, 1); // 1 worker for 2 jobs
    put(s, 'field', westOf('field'), 30).built = 0;
    expect(computeEconomy(s).harvest).toBeCloseTo((BUILDINGS.field.harvest! / W) * 0.5);
  });

  it('announces the whole harvest of the season in its first week and adds up every week', () => {
    const s = emptyGame({ week: SPRING, food: 0 });
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29, 1); // 2 tents without a well stay tents: 2 workers for the 2 jobs
    put(s, 'field', westOf('field'), 31).built = 0;
    const weekly = computeEconomy(s).harvest;
    expect(stepWeek(s, never)).toContainEqual({ type: 'harvestStart', amount: BUILDINGS.field.harvest });
    for (let k = 1; k < W; k++) expect(stepWeek(s, never).some((e) => e.type === 'harvestStart')).toBe(false);
    expect(s.harvested).toBeCloseTo(weekly * W);
    expect(seasonOf(s.week)).toBe('summer');
    stepWeek(s, never);
    expect(s.harvested).toBeCloseTo(weekly * W); // nothing in summer
  });
});

describe('stores (edges)', () => {
  it('food exactly at the limit does not spoil', () => {
    const s = emptyGame({ food: 40 });
    expect(stepWeek(s, never)).not.toContainEqual({ type: 'spoilStart' });
    expect(s.food).toBe(40);
    expect(s.spoiled).toBe(0);
  });

  it('losing the granary spoils what no longer fits, and the spoiling ends when the food fits again', () => {
    const s = emptyGame({ food: 40 });
    put(s, 'granary', EAST, 30);
    s.food = 100;
    clearCell(s, EAST, 30);
    expect(foodCapacity(s)).toBe(40);
    expect(stepWeek(s, never)).toContainEqual({ type: 'spoilStart' });
    expect(s.food).toBe(40);
    expect(s.spoiled).toBe(60);
    put(s, 'house', ROADSIDE, 27, 1);
    stepWeek(s, never);
    expect(s.spoiled).toBe(0);
    expect(alerts(s).map((a) => a.kind)).not.toContain('spoiling');
  });

  it('a disconnected granary keeps nothing', () => {
    const s = emptyGame();
    const g = put(s, 'granary', 2, 2);
    expect(g.connected).toBe(false);
    expect(foodCapacity(s)).toBe(RULES.baseFoodStorage);
  });
});

describe('forecast (edges)', () => {
  /** Two big houses (9.6 a week) and one field, in the first week of the spring of year 2. */
  const town = (drought: boolean) => {
    const s = emptyGame({ week: SPRING + YEAR, food: 40, drought });
    put(s, 'house', ROADSIDE, 27, 4);
    put(s, 'house', ROADSIDE, 29, 4);
    put(s, 'field', westOf('field'), 31).built = 0;
    return s;
  };

  it('counts the dry harvest once the drought is announced', () => {
    expect(foodForecast(town(false))).toEqual({ weeks: 17, season: 'summer' }); // full stores until the spring ends
    expect(foodForecast(town(true))).toEqual({ weeks: 8, season: 'spring' }); // 12 × 0.4 = 4.8 a week
  });

  it('in spring, "until the harvest" means the spring of the next year', () => {
    const s = town(false);
    expect(weeksToHarvest(s.week)).toBe(YEAR);
    expect(foodLastsToHarvest(s)).toBe(false);
  });

  it('accepts a shorter horizon and the economy already computed', () => {
    const s = emptyGame({ food: 6 });
    put(s, 'house', ROADSIDE, 27, 1);
    expect(foodForecast(s, computeEconomy(s), 9)).toBeNull(); // famine in week 9: beyond the horizon
    expect(foodForecast(s, computeEconomy(s), 10)).toEqual({ weeks: 9, season: 'autumn' });
  });

  it('a food stock that runs out at the last week before the harvest still does not last', () => {
    const s = emptyGame({ week: SPRING - 2, food: 1.2 });
    put(s, 'house', ROADSIDE, 27, 1); // 0.6 a week: 0 in the second week
    expect(weeksToHarvest(s.week)).toBe(2);
    expect(foodLastsToHarvest(s)).toBe(false);
    s.food = 1.21;
    expect(foodLastsToHarvest(s)).toBe(true);
  });
});

describe('winter (edges)', () => {
  it('a mud-brick house dropping in a winter famine is a winter loss; a new winter clears it', () => {
    const s = emptyGame({ food: 0, famine: true, week: WINTER + 2 });
    put(s, 'well', EAST, 27);
    const b = put(s, 'house', ROADSIDE, 27, 2);
    stepWeek(s, constRng(RULES.famineDropChance - 0.01));
    expect(b.level).toBe(1);
    expect(s.winterLoss).toBe(true);
    const t = emptyGame({ week: WINTER - 1, winterLoss: true });
    stepWeek(t, never);
    expect(t.winterLoss).toBe(false);
  });

  it('a tent leaving in a winter famine is a winter loss, and the first winter is not won', () => {
    const s = emptyGame({ food: 0, famine: true, week: SPRING - 1 });
    put(s, 'well', EAST, 27);
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29, 2); // stays (the roll is above the drop chance)
    const events = stepWeek(s, constRng(RULES.winterFamineLeaveChance - 0.01));
    expect(events).toContainEqual({ type: 'familyLeft', x: ROADSIDE, y: 27 });
    expect(s.winterLoss).toBe(true);
    expect(events).not.toContainEqual({ type: 'milestone', id: 'firstWinter' });
  });

  it('a famine outside winter is not a winter loss', () => {
    const s = emptyGame({ food: 0, famine: true, week: SUMMER + 2 });
    put(s, 'well', EAST, 27);
    put(s, 'house', ROADSIDE, 27, 1);
    expect(stepWeek(s, constRng(RULES.famineLeaveChance - 0.01))).toContainEqual({ type: 'familyLeft', x: ROADSIDE, y: 27 });
    expect(s.winterLoss).toBe(false);
  });

  it('the first winter needs residents at the start of spring', () => {
    const s = emptyGame({ week: SPRING - 1 });
    expect(stepWeek(s, never)).not.toContainEqual({ type: 'milestone', id: 'firstWinter' });
  });
});

describe('milestones (once)', () => {
  it('a year without famine is not repeated in the next years', () => {
    const s = emptyGame({ week: AUTUMN2 - 1 });
    expect(stepWeek(s, never)).toContainEqual({ type: 'milestone', id: 'yearWithoutFamine' });
    s.week = AUTUMN2 + YEAR - 1;
    expect(stepWeek(s, never)).not.toContainEqual({ type: 'milestone', id: 'yearWithoutFamine' });
    expect(s.milestones.filter((m) => m === 'yearWithoutFamine')).toHaveLength(1);
  });

  it('a famine week marks the year', () => {
    const s = emptyGame({ food: 0 });
    put(s, 'house', ROADSIDE, 27, 1);
    stepWeek(s, never);
    expect(s.famine).toBe(true);
    expect(s.famineThisYear).toBe(true);
  });
});

describe('caravan (layout)', () => {
  it('pitches the tents by the ring, north of it first and then west, for free', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = createGame(createRng(seed));
      expect(s.silver).toBe(RULES.startSilver);
      expect(s.families).toEqual([]);
      const tents = s.buildings.filter((b) => b.kind === 'house');
      const spots = [{ x: 21, y: 19 }, { x: 23, y: 19 }, { x: 25, y: 19 }, { x: 19, y: 23 }].slice(0, tents.length);
      expect(tents.map((t) => ({ x: t.x, y: t.y }))).toEqual(spots);
      for (const t of tents) expect(s.grid[t.y * s.cols + t.x]).toBe(t);
    }
  });

  it('the opening food lasts the weeks it announces, and never more than the stores', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = createGame(createRng(seed));
      const eaten = computeEconomy(s).foodEaten;
      expect(s.food).toBeLessThanOrEqual(foodCapacity(s));
      expect(s.food / eaten).toBeGreaterThanOrEqual(s.start.foodWeeks - 1e-9);
      expect(s.food / eaten).toBeLessThan(s.start.foodWeeks + 1);
    }
  });
});

describe('alerts (order)', () => {
  it('in summer: debt, food short, spoiling, then the deficit', () => {
    const s = emptyGame({ week: SUMMER, silver: -5, food: 10, spoiled: 3 });
    put(s, 'well', EAST, 27);
    put(s, 'house', ROADSIDE, 27, 1);
    expect(alerts(s).map((a) => a.kind)).toEqual(['debt', 'foodShort', 'spoiling', 'deficit']);
  });

  it('at the end of autumn: spoiling before the winter warning; no warning without tents', () => {
    const s = emptyGame({ week: W - 1, spoiled: 2, food: 40 });
    const tent = put(s, 'house', ROADSIDE, 27, 1);
    expect(alerts(s).map((a) => a.kind)).toEqual(['spoiling', 'winterComing']);
    tent.level = 2;
    expect(alerts(s).map((a) => a.kind)).toEqual(['spoiling']);
  });

  it('the winter warning is only in autumn, not at the end of other seasons', () => {
    const s = emptyGame({ week: SPRING + W - 1, food: 40 });
    put(s, 'house', ROADSIDE, 27, 1);
    expect(alerts(s).map((a) => a.kind)).not.toContain('winterComing');
  });
});

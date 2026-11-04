import { describe, expect, it } from 'vitest';
import {
  alerts,
  BUILDINGS,
  checkClear,
  checkGoal,
  checkPlace,
  clearCell,
  computeEconomy,
  createGame,
  createRng,
  familyBlock,
  foodAfter,
  gatherCells,
  gatherYield,
  GOALS,
  HOUSE_LEVELS,
  housesWaiting,
  indexOf,
  isFreeLand,
  lumberSpot,
  markTutorial,
  materialsOf,
  missingMaterial,
  nextTreeToCut,
  place,
  RULES,
  sharedTrees,
  stepWeek,
  TUTORIAL_STEPS,
  tutorialProgress,
  unlockingGoal,
  upgradeGain,
  weeksPerCut,
  type GameEvent,
  type GameState,
  type Placeable,
} from '../src/core';
import { constRng, EAST, emptyGame, meetGoal, put, ROADSIDE, westOf } from './helpers';

const never = constRng(0.99);
const UP = RULES.weeksToUpgrade;
const lumber = BUILDINGS.lumber.gather!;
const quarry = BUILDINGS.quarry.gather!;
const EVERY = BUILDINGS.lumber.cutEvery!;

/** Steps the weeks with the food topped up (no famine gets in the way); returns the events. */
function run(s: GameState, weeks: number, rng = never): GameEvent[] {
  const events: GameEvent[] = [];
  for (let k = 0; k < weeks; k++) {
    s.food = 1000;
    events.push(...stepWeek(s, rng));
  }
  return events;
}

/** A city with workers (two tents at the far end of the starting road: 4 workers) and no wood or stone. */
function city(): GameState {
  const s = emptyGame();
  put(s, 'house', ROADSIDE, 44, 1);
  put(s, 'house', ROADSIDE, 46, 1);
  s.wood = 0;
  s.stone = 0;
  return s;
}

/** Puts a feature on each (x, y). */
const plant = (s: GameState, f: 'olive' | 'palm' | 'rock', cells: [number, number][]) => {
  for (const [x, y] of cells) s.feature[indexOf(s, x, y)] = f;
};

/** A lumber east of the starting road (x 25..26, y 30..31): radius 3 reaches x 22..29, y 27..34. */
const lumberAt = (s: GameState) => put(s, 'lumber', EAST, 30);

describe('materials data', () => {
  it('lumber and quarry: work buildings gathering wood from trees and stone from rocks', () => {
    expect(BUILDINGS.lumber).toMatchObject({ category: 'work', cost: 25, upkeep: 1, w: 2, h: 2, jobs: 2, cutEvery: 10 });
    expect(lumber).toEqual({ source: 'tree', radius: 3, perCell: 0.25, max: 3, product: 'wood' });
    expect(BUILDINGS.quarry).toMatchObject({ category: 'work', cost: 40, upkeep: 2, w: 2, h: 2, jobs: 3, materials: { wood: 10 } });
    expect(quarry).toEqual({ source: 'rock', radius: 2, perCell: 0.4, max: 3, product: 'stone' });
  });

  it('building costs: wood for houses and works, stone for the park, both for the temple; food and wood never need material', () => {
    const cost = (k: Placeable) => materialsOf(k);
    expect(cost('house')).toEqual({ wood: 5 });
    for (const k of ['granary', 'market', 'workshop', 'quarry'] as const) expect(cost(k)).toEqual({ wood: 10 });
    expect(cost('park')).toEqual({ stone: 5 });
    expect(cost('temple')).toEqual({ stone: 300, wood: 150 });
    for (const k of ['road', 'field', 'plaza', 'fisher', 'gatherer', 'lumber'] as const) expect(cost(k)).toEqual({});
  });

  it('house levels: tents are free, then mud 5 wood, stone 10 stone, big 10 stone and 5 wood', () => {
    expect(HOUSE_LEVELS.map((l) => l.materials ?? {})).toEqual([{}, {}, { wood: 5 }, { stone: 10 }, { stone: 10, wood: 5 }]);
    expect(upgradeGain(1, 0)!.materials).toEqual({ wood: 5 });
    expect(upgradeGain(3, 0)!.materials).toEqual({ stone: 10, wood: 5 });
  });

  it('the caravan brings 20 wood and no stone; the lumber is open from the start, the quarry from goal 2', () => {
    const s = createGame(createRng(7));
    expect([s.wood, s.stone]).toEqual([20, 0]);
    expect(s.stumps).toEqual([]);
    expect(s.unlocked).toContain('lumber');
    expect(s.unlocked).not.toContain('quarry');
    expect(unlockingGoal('quarry')).toBe(2);
    expect(checkPlace(s, 'quarry', 0, 0).ok).toBe(false);
  });

  it('goal 2 unlocks the quarry', () => {
    const s = emptyGame({ goalIndex: 1, unlocked: ['road', 'house'] });
    meetGoal(s, GOALS[1]);
    checkGoal(s, []);
    expect(s.goalIndex).toBe(2);
    expect(s.unlocked).toContain('quarry');
  });
});

describe('lumber and quarry yield', () => {
  it('lumber: min(max, trees × perCell) wood a week, after the worker efficiency, into the stock', () => {
    const s = city();
    const b = lumberAt(s);
    plant(s, 'olive', [[28, 30], [28, 31], [29, 32]]);
    plant(s, 'palm', [[30, 30]]); // one column beyond the radius
    expect(gatherCells(s, b)).toBe(3);
    expect(gatherYield(s, b)).toBeCloseTo(3 * lumber.perCell);
    const e = computeEconomy(s);
    expect(e.efficiency).toBe(1);
    expect(e.wood).toBeCloseTo(3 * lumber.perCell);
    expect(e.foodMade).toBe(0); // wood is not food
    run(s, 1);
    expect(s.wood).toBeCloseTo(3 * lumber.perCell);
  });

  it('lumber: capped at max, and scaled by the worker efficiency', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 1); // a tent: 2 workers
    const b = lumberAt(s);
    put(s, 'field', 1, 1); // disconnected: no jobs
    for (let y = 27; y <= 34; y++) plant(s, 'olive', [[27, y], [28, y]]);
    expect(gatherYield(s, b)).toBe(lumber.max);
    put(s, 'market', westOf('market'), 31); // 3 more jobs: 2 workers for 5 jobs
    const e = computeEconomy(s);
    expect(e.efficiency).toBeCloseTo(2 / 5);
    expect(e.wood).toBeCloseTo(lumber.max * (2 / 5));
  });

  it('lumber: stumps do not count', () => {
    const s = city();
    const b = lumberAt(s);
    plant(s, 'olive', [[28, 30], [28, 31]]);
    s.feature[indexOf(s, 28, 32)] = 'stump';
    expect(gatherCells(s, b)).toBe(2);
  });

  it('quarry: counts the rocks in radius 2, stone a week up to max', () => {
    const s = city();
    const b = put(s, 'quarry', EAST, 30); // radius 2 reaches x 23..28, y 28..33
    plant(s, 'rock', [[27, 30], [28, 33], [29, 30]]); // the last one is out of reach
    plant(s, 'olive', [[27, 31]]); // trees are not stone
    expect(gatherCells(s, b)).toBe(2);
    expect(computeEconomy(s).stone).toBeCloseTo(2 * quarry.perCell);
    for (let y = 28; y <= 33; y++) plant(s, 'rock', [[27, y], [28, y]]);
    expect(gatherYield(s, b)).toBe(quarry.max);
    run(s, 2);
    expect(s.stone).toBeCloseTo(2 * quarry.max);
  });

  it('a disconnected lumber or quarry brings nothing', () => {
    const s = city();
    const l = put(s, 'lumber', 2, 2);
    const q = put(s, 'quarry', 2, 8);
    plant(s, 'olive', [[5, 2], [5, 3]]);
    plant(s, 'rock', [[5, 8], [5, 9]]);
    expect(gatherCells(s, l)).toBe(2);
    expect(gatherCells(s, q)).toBe(2);
    expect([gatherYield(s, l), gatherYield(s, q)]).toEqual([0, 0]);
    run(s, 3);
    expect([s.wood, s.stone]).toEqual([0, 0]);
  });

  it('work all year: in winter the lumber still brings wood', () => {
    const s = city();
    s.week = 2 * RULES.weeksPerSeason - 1; // last week of winter
    lumberAt(s);
    plant(s, 'olive', [[28, 30]]);
    expect(computeEconomy(s).wood).toBeCloseTo(lumber.perCell);
  });
});

describe('cutting trees', () => {
  it('cuts the nearest tree in its radius, the lower cell index on ties', () => {
    const s = city();
    const b = lumberAt(s); // x 25..26, y 30..31
    plant(s, 'olive', [[27, 32], [27, 29], [28, 30]]); // (27, 32) and (27, 29) at squared distance 2, (28, 30) at 4
    plant(s, 'palm', [[27, 31]]); // 1 away: the nearest
    expect(nextTreeToCut(s, b)).toBe(indexOf(s, 27, 31));
    s.feature[indexOf(s, 27, 31)] = 'stump';
    expect(nextTreeToCut(s, b)).toBe(indexOf(s, 27, 29)); // tie with (27, 32): the lower index
  });

  it('cuts one tree on the 10th wood: the cell becomes a stump of the same kind, with an event', () => {
    const s = city();
    const b = lumberAt(s);
    plant(s, 'olive', [[27, 30], [28, 30], [28, 31], [29, 31]]); // 4 trees: 1 wood a week
    expect(EVERY).toBe(10);
    let events = run(s, EVERY - 1);
    expect(events.some((e) => e.type === 'treeCut')).toBe(false);
    expect(b.cutProgress).toBeCloseTo(EVERY - 1);
    const week = s.week;
    events = run(s, 1);
    expect(events).toContainEqual({ type: 'treeCut', x: 27, y: 30, kind: 'olive' });
    expect(s.feature[indexOf(s, 27, 30)]).toBe('stump');
    expect(s.stumps).toEqual([{ i: indexOf(s, 27, 30), kind: 'olive', week }]);
    expect(b.cutProgress).toBeCloseTo(0);
    expect(s.wood).toBeCloseTo(EVERY);
    expect(gatherCells(s, b)).toBe(3);
  });

  it('a lumber with no workers makes no wood and cuts nothing', () => {
    const s = emptyGame(); // nobody lives here
    lumberAt(s);
    plant(s, 'olive', [[27, 30], [28, 30], [28, 31], [29, 31]]);
    expect(run(s, 20).some((e) => e.type === 'treeCut')).toBe(false);
    expect(s.stumps).toEqual([]);
  });

  it('the gatherer loses the tree the lumber cut', () => {
    const s = city();
    lumberAt(s);
    const g = put(s, 'gatherer', EAST, 27); // radius 3 reaches y 24..31
    plant(s, 'olive', [[27, 30], [28, 30], [28, 31], [29, 31]]);
    expect(gatherCells(s, g)).toBe(4);
    run(s, EVERY);
    expect(gatherCells(s, g)).toBe(3);
  });

  it('a stump grows back into the same tree after treeRegrowWeeks', () => {
    expect(RULES.treeRegrowWeeks).toBe(104);
    const s = city();
    plant(s, 'palm', [[27, 30], [28, 30], [28, 31], [29, 31]]);
    lumberAt(s);
    run(s, EVERY);
    const [stump] = s.stumps;
    clearCell(s, EAST, 30); // no more cuts
    run(s, stump.week + RULES.treeRegrowWeeks - s.week);
    expect(s.feature[stump.i]).toBe('stump');
    const events = run(s, 1);
    expect(events).toContainEqual({ type: 'treeRegrown', x: 27, y: 30, kind: 'palm' });
    expect(s.feature[stump.i]).toBe('palm');
    expect(s.stumps).toEqual([]);
  });
});

describe('stumps', () => {
  /** A city with a stump of an olive on (x, y), cut this week. */
  const withStump = (x: number, y: number) => {
    const s = city();
    const i = indexOf(s, x, y);
    s.feature[i] = 'stump';
    s.stumps.push({ i, kind: 'olive', week: s.week });
    return { s, i };
  };

  it('do not block: building on one removes it for free and it never grows back', () => {
    const { s, i } = withStump(EAST + 1, 33);
    expect(isFreeLand(s, EAST + 1, 33)).toBe(true);
    s.silver = 20;
    s.wood = 0;
    expect(place(s, 'field', EAST, 32).ok).toBe(true);
    expect(s.silver).toBe(0); // only the field's price
    expect(s.feature[i]).toBeNull();
    expect(s.stumps).toEqual([]);
    clearCell(s, EAST, 32);
    run(s, RULES.treeRegrowWeeks + 1);
    expect(s.feature[i]).toBeNull();
  });

  it('a road on a stump removes it too', () => {
    const { s, i } = withStump(EAST, 33);
    s.silver = RULES.roadCost;
    expect(place(s, 'road', EAST, 33).ok).toBe(true);
    expect(s.silver).toBe(0);
    expect([s.feature[i], s.stumps]).toEqual([null, []]);
  });

  it('are not trees for the clear tool (nothing to cut)', () => {
    const { s } = withStump(EAST, 33);
    expect(checkClear(s, EAST, 33)).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('building with materials', () => {
  it('fails without the material and spends nothing; with it, pays silver and material', () => {
    const s = city();
    s.silver = 100;
    s.wood = 4;
    expect(missingMaterial(s, 'house')).toBe('wood');
    expect(checkPlace(s, 'house', EAST, 33)).toEqual({ ok: false, reason: 'materials' });
    expect(place(s, 'house', EAST, 33)).toEqual({ ok: false, reason: 'materials' });
    expect([s.silver, s.wood]).toEqual([100, 4]);
    s.wood = 5;
    expect(missingMaterial(s, 'house')).toBeNull();
    expect(place(s, 'house', EAST, 33).ok).toBe(true);
    expect([s.silver, s.wood]).toEqual([100 - BUILDINGS.house.cost, 0]);
  });

  it('silver is checked before material; free kinds never miss material', () => {
    const s = city();
    s.silver = 0;
    expect(checkPlace(s, 'house', EAST, 33)).toEqual({ ok: false, reason: 'silver' });
    for (const k of ['road', 'field', 'plaza', 'fisher', 'gatherer', 'lumber'] as const) expect(missingMaterial(s, k)).toBeNull();
    expect(missingMaterial(s, 'park')).toBe('stone');
    s.stone = 300;
    expect(missingMaterial(s, 'temple')).toBe('wood');
  });

  it('the temple pays 800 silver, 300 stone and 150 wood', () => {
    const s = city();
    Object.assign(s, { silver: 1000, wood: 200, stone: 400 });
    expect(place(s, 'temple', EAST, 34).ok).toBe(true);
    expect([s.silver, s.stone, s.wood]).toEqual([200, 100, 50]);
  });
});

describe('houses waiting for material', () => {
  const MARKET_X = westOf('market');

  /** Two mud-brick houses with a plaza and a market around (ready to become stone houses), oldest first. */
  function street() {
    const s = city();
    const a = put(s, 'house', EAST, 27, 2);
    const b = put(s, 'house', EAST, 29, 2);
    put(s, 'plaza', ROADSIDE, 29);
    put(s, 'market', MARKET_X, 31);
    return { s, a, b };
  }

  it('a ready house without the material waits at the full count, then climbs and pays the week it comes', () => {
    const { s, a } = street();
    run(s, UP + 5);
    expect(a.level).toBe(2);
    expect(a.upStreak).toBe(UP);
    expect(a.waiting).toBe('stone');
    expect(housesWaiting(s)).toEqual({ wood: 0, stone: 2 });
    s.stone = 12;
    const events = run(s, 1);
    expect(events).toContainEqual({ type: 'houseUp', x: EAST, y: 27, level: 3, delta: HOUSE_LEVELS[3].residents - HOUSE_LEVELS[2].residents });
    expect(a.level).toBe(3);
    expect(a.waiting).toBeUndefined();
    expect(s.stone).toBe(2);
  });

  it('climbs the same week the stock gets there from a quarry', () => {
    const { s, a } = street();
    run(s, UP);
    expect(a.waiting).toBe('stone');
    s.stone = 10 - quarry.max;
    put(s, 'quarry', EAST, 37);
    for (let y = 35; y <= 40; y++) plant(s, 'rock', [[27, y], [28, y]]); // 12 rocks: max a week
    run(s, 1);
    expect(a.level).toBe(3);
    expect(s.stone).toBeCloseTo(0);
  });

  it('two ready houses with material for one: the oldest climbs, the other waits', () => {
    const { s, a, b } = street();
    run(s, UP - 1);
    s.stone = 15;
    run(s, 1);
    expect([a.level, b.level]).toEqual([3, 2]);
    expect(b.waiting).toBe('stone');
    expect(s.stone).toBe(5);
  });

  it('losing a need clears the wait', () => {
    const { s, a } = street();
    run(s, UP);
    expect(a.waiting).toBe('stone');
    clearCell(s, MARKET_X, 31);
    run(s, 1);
    expect(a.waiting).toBeUndefined();
    expect(a.upStreak).toBe(0);
  });

  it('a house that drops gives nothing back, and pays again to climb back', () => {
    const { s, a } = street();
    s.stone = 10;
    run(s, UP);
    expect(a.level).toBe(3);
    expect(s.stone).toBe(0);
    clearCell(s, MARKET_X, 31);
    run(s, RULES.weeksToDowngrade);
    expect(a.level).toBe(2);
    expect(s.stone).toBe(0);
  });

  it('a tent becomes a mud-brick house paying 5 wood', () => {
    const s = city();
    const t = put(s, 'house', EAST, 29, 1);
    put(s, 'plaza', ROADSIDE, 29);
    s.wood = 7;
    run(s, UP);
    expect(t.level).toBe(2);
    expect(s.wood).toBe(2);
  });

  it('the material alert counts the waiting houses, after the food and before the balance', () => {
    const { s } = street();
    run(s, UP);
    s.food = 0;
    s.silver = 50;
    put(s, 'temple', EAST, 40); // upkeep 10: a negative balance
    const list = alerts(s);
    const kinds = list.map((a) => a.kind);
    expect(list).toContainEqual({ kind: 'material', material: 'stone', count: 2 });
    expect(kinds.indexOf('foodShort')).toBeLessThan(kinds.indexOf('material'));
    expect(kinds.indexOf('material')).toBeLessThan(kinds.indexOf('deficit'));
    s.silver = -1;
    expect(alerts(s)[0].kind).toBe('debt');
  });

  it('the families door ignores materials', () => {
    const s = emptyGame({ wood: 0, stone: 0 });
    put(s, 'house', ROADSIDE, 27);
    expect(familyBlock(s)).toBeNull();
  });
});

describe('material readouts and tutorial', () => {
  it('sharedTrees: trees a new lumber would share with the gatherers (and back)', () => {
    const s = city();
    put(s, 'gatherer', EAST, 27); // radius 3: x 22..29, y 24..31
    plant(s, 'olive', [[28, 31], [28, 32], [29, 34]]);
    s.feature[indexOf(s, 27, 31)] = 'stump';
    // A lumber at (25, 33) reaches x 22..29, y 30..37: shares (28, 31) only.
    expect(sharedTrees(s, EAST, 33, 'lumber')).toBe(1);
    expect(sharedTrees(s, 2, 2, 'lumber')).toBe(0);
    expect(sharedTrees(s, EAST, 33, 'fisher')).toBe(0);
    put(s, 'lumber', EAST, 33);
    expect(sharedTrees(s, EAST, 27, 'gatherer')).toBe(1);
  });

  it('weeksPerCut: cutEvery over the weekly wood, rounded up', () => {
    expect(weeksPerCut(lumber.max)).toBe(Math.ceil(EVERY / lumber.max));
    expect(weeksPerCut(1)).toBe(EVERY);
    expect(weeksPerCut(0)).toBeNull();
  });

  it('foodAfter tells the product of the preview: wood for a lumber', () => {
    const s = city();
    plant(s, 'olive', [[28, 30], [28, 31]]);
    const f = foodAfter(s, 'lumber', { x: EAST, y: 30, rotated: false });
    expect(f.product).toBe('wood');
    expect(f.yields).toBeCloseTo(2 * lumber.perCell);
    expect(foodAfter(s, 'gatherer', { x: EAST, y: 30, rotated: false }).product).toBe('food');
  });

  it('the lumber step comes right after the family step, with a spot found like the food spot', () => {
    const ids = TUTORIAL_STEPS.map((t) => t.id);
    expect(ids.slice(-2)).toEqual(['family', 'lumber']);
    const s = createGame(createRng(3));
    const spot = lumberSpot(s)!;
    expect(spot.kind).toBe('lumber');
    expect(spot.food).toBeGreaterThan(0);
    const step = TUTORIAL_STEPS.at(-1)!;
    const mark = markTutorial(s);
    expect(tutorialProgress(s, step, mark)).toBe(0);
    for (const c of spot.road) place(s, 'road', c.x, c.y);
    expect(place(s, 'lumber', spot.x, spot.y).ok).toBe(true);
    expect(tutorialProgress(s, step, mark)).toBe(1);
  });
});

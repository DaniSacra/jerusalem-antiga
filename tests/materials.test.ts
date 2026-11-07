import { describe, expect, it } from 'vitest';
import {
  alerts,
  BUILDINGS,
  checkClear,
  checkGoal,
  checkPlace,
  checkUpgrade,
  clearCell,
  clearStump,
  cutTrees,
  computeEconomy,
  createGame,
  createRng,
  foodAfter,
  gatherCells,
  gatherYield,
  HOUSE_LEVELS,
  houseInfo,
  housesWaiting,
  indexOf,
  isFreeLand,
  isGatherSource,
  lackingMaterial,
  levelMaterials,
  lumberSpot,
  markTutorial,
  materialsOf,
  missingMaterial,
  nextTreeToCut,
  payMaterials,
  place,
  productOf,
  refreshCity,
  regrowTrees,
  RULES,
  sharedTrees,
  stepWeek,
  TUTORIAL_STEPS,
  tutorialProgress,
  unlockingGoal,
  upgradeBuilding,
  upgradeGain,
  weeksToNextLevel,
  weeksPerCut,
  type GameEvent,
  type GameState,
  type Placeable,
} from '../src/core';
import { constRng, EAST, emptyGame, put, ROADSIDE, UP_WEEKS, westOf } from './helpers';

/** Stone a house pays to become a stone house (houses.json). */
const STONE = HOUSE_LEVELS[3].materials!.stone!;

const never = constRng(0.99);
const UP = UP_WEEKS;
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
    expect(BUILDINGS.lumber).toMatchObject({ category: 'work', cost: 25, upkeep: 0.5, w: 2, h: 2, jobs: 2, cutEvery: 10 });
    expect(lumber).toEqual({ source: 'tree', radius: 3, perCell: 0.25, max: 2.5, product: 'wood' });
    expect(BUILDINGS.quarry).toMatchObject({ category: 'work', cost: 40, upkeep: 1.75, w: 2, h: 2, jobs: 3, materials: { wood: 10 } });
    expect(quarry).toEqual({ source: 'rock', radius: 2, perCell: 0.3, max: 1.4, product: 'stone' });
  });

  it('building costs: wood for houses and works, stone for the park, both for the temple; food and wood never need material', () => {
    const cost = (k: Placeable) => materialsOf(k);
    expect(cost('house')).toEqual({ wood: 10 });
    for (const k of ['granary', 'market', 'workshop', 'quarry'] as const) expect(cost(k)).toEqual({ wood: 10 });
    expect(cost('park')).toEqual({ stone: 5 });
    expect(cost('temple')).toEqual({ stone: 300, wood: 200 });
    for (const k of ['road', 'field', 'plaza', 'fisher', 'gatherer', 'lumber'] as const) expect(cost(k)).toEqual({});
  });

  it('house levels: tents are free, then mud 5 wood, stone 15 stone, big 15 stone and 5 wood', () => {
    expect(HOUSE_LEVELS.map((l) => l.materials ?? {})).toEqual([{}, {}, { wood: 5 }, { stone: 15 }, { stone: 15, wood: 5 }]);
    expect(upgradeGain(1)!.materials).toEqual({ wood: 5 });
    expect(upgradeGain(3)!.materials).toEqual({ stone: 15, wood: 5 });
  });

  it('the caravan brings 40 wood and no stone; the lumber is open from the start, the quarry from goal 4 (first birth)', () => {
    const s = createGame(createRng(7));
    expect([s.wood, s.stone]).toEqual([40, 0]);
    expect(s.stumps).toEqual([]);
    expect(s.unlocked).toContain('lumber');
    expect(s.unlocked).not.toContain('quarry');
    expect(unlockingGoal('quarry')).toBe(4);
    expect(checkPlace(s, 'quarry', 0, 0).ok).toBe(false);
  });

  it('goal 4 (the first winter passed) unlocks the quarry', () => {
    const s = emptyGame({ goalIndex: 3, unlocked: ['road', 'house'] });
    s.milestones.push('firstSpring');
    checkGoal(s, []);
    expect(s.goalIndex).toBe(4);
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

  it('lumber: capped at max, and scaled by its own crew; a market elsewhere takes nobody from it', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 1, false, 1); // a tent with 1 worker
    s.wood = 0; // below the store cap
    const b = lumberAt(s);
    for (let y = 27; y <= 34; y++) plant(s, 'olive', [[27, y], [28, y]]);
    expect(gatherYield(s, b)).toBe(lumber.max);
    expect(computeEconomy(s).wood).toBeCloseTo(lumber.max / 2); // 1 of its 2 jobs
    put(s, 'market', westOf('market'), 31); // 3 more jobs, nobody free to take them
    expect(computeEconomy(s).wood).toBeCloseTo(lumber.max / 2);
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
    const wood = BUILDINGS.house.materials!.wood!;
    s.silver = 100;
    s.wood = wood - 1;
    expect(missingMaterial(s, 'house')).toBe('wood');
    expect(checkPlace(s, 'house', EAST, 33)).toEqual({ ok: false, reason: 'materials' });
    expect(place(s, 'house', EAST, 33)).toEqual({ ok: false, reason: 'materials' });
    expect([s.silver, s.wood]).toEqual([100, wood - 1]);
    s.wood = wood;
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

  it('the temple pays 800 silver, 300 stone and 200 wood', () => {
    const s = city();
    Object.assign(s, { silver: 1000, wood: 350, stone: 400 });
    expect(place(s, 'temple', EAST, 34).ok).toBe(true);
    expect([s.silver, s.stone, s.wood]).toEqual([200, 100, 150]);
  });
});

describe('houses waiting for material', () => {
  const MARKET_X = westOf('market');

  /** Two mud-brick houses with a plaza around (ready to become stone houses), oldest first; a market too. */
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
    expect(housesWaiting(s)).toEqual({ wood: 2, stone: 2 }); // the city's two tents wait for wood
    s.stone = STONE + 2;
    s.wood = 50; // firewood, should the week be a winter one
    const events = run(s, 1);
    expect(events).toContainEqual({ type: 'houseUp', x: EAST, y: 27, level: 3, delta: HOUSE_LEVELS[3].capacity - HOUSE_LEVELS[2].capacity });
    expect(a.level).toBe(3);
    expect(a.waiting).toBeUndefined();
    expect(s.stone).toBe(2);
  });

  it('climbs the same week the stock gets there from a quarry', () => {
    const { s, a } = street();
    run(s, UP);
    expect(a.waiting).toBe('stone');
    s.stone = STONE - quarry.max;
    put(s, 'quarry', EAST, 37);
    for (let y = 35; y <= 40; y++) plant(s, 'rock', [[27, y], [28, y]]); // 12 rocks: max a week
    run(s, 1);
    expect(a.level).toBe(3);
    expect(s.stone).toBeCloseTo(0);
  });

  it('two ready houses with material for one: the oldest climbs, the other waits', () => {
    const { s, a, b } = street();
    run(s, UP - 1);
    s.stone = STONE + 5;
    run(s, 1);
    expect([a.level, b.level]).toEqual([3, 2]);
    expect(b.waiting).toBe('stone');
    expect(s.stone).toBe(5);
  });

  it('losing a need clears the wait', () => {
    const { s, a } = street();
    run(s, UP);
    expect(a.waiting).toBe('stone');
    clearCell(s, ROADSIDE, 29); // the plaza
    run(s, 1);
    expect(a.waiting).toBeUndefined();
    expect(a.upStreak).toBe(0);
  });

  it('a house that drops gives nothing back, and pays again to climb back', () => {
    const { s, a } = street();
    s.stone = STONE;
    run(s, UP);
    expect(a.level).toBe(3);
    expect(s.stone).toBe(0);
    clearCell(s, ROADSIDE, 29); // the plaza
    run(s, RULES.weeksToDowngrade);
    expect(a.level).toBe(2);
    expect(s.stone).toBe(0);
  });

  it('a tent becomes a mud-brick house paying 5 wood, with no plaza', () => {
    const s = emptyGame({ week: 2 * RULES.weeksPerSeason }); // spring: no firewood to keep
    const t = put(s, 'house', EAST, 29, 1);
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
    // Disconnected quarries far away: their upkeep makes the balance negative.
    for (let k = 0; computeEconomy(s).silverDelta >= 0; k++) put(s, 'quarry', 2 + 3 * k, 2);
    const list = alerts(s);
    const kinds = list.map((a) => a.kind);
    expect(list).toContainEqual({ kind: 'material', material: 'stone', count: 2, making: false });
    expect(kinds.indexOf('foodShort')).toBeLessThan(kinds.indexOf('material'));
    expect(kinds.indexOf('material')).toBeLessThan(kinds.indexOf('deficit'));
    s.silver = -1;
    expect(alerts(s)[0].kind).toBe('debt');
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

  it('the lumber step comes right before the house step, with a spot found like the food spot', () => {
    const ids = TUTORIAL_STEPS.map((t) => t.id);
    expect(ids.slice(3, 5)).toEqual(['lumber', 'house']);
    const s = createGame(createRng(3));
    const spot = lumberSpot(s)!;
    expect(spot.kind).toBe('lumber');
    expect(spot.food).toBeGreaterThan(0);
    const step = TUTORIAL_STEPS.find((t) => t.id === 'lumber')!;
    const mark = markTutorial(s);
    expect(tutorialProgress(s, step, mark)).toBe(0);
    for (const c of spot.road) place(s, 'road', c.x, c.y);
    expect(place(s, 'lumber', spot.x, spot.y).ok).toBe(true);
    expect(tutorialProgress(s, step, mark)).toBe(1);
  });
});

describe('materials and trees: edge cases', () => {
  it('productOf and isGatherSource: food by default, wood from trees, stone from rocks; a stump is no source', () => {
    expect(['fisher', 'gatherer', 'lumber', 'quarry', 'field', 'house'].map((k) => productOf(k as never))).toEqual(['food', 'food', 'wood', 'stone', null, null]);
    const s = city();
    const i = indexOf(s, 5, 5);
    s.feature[i] = 'rock';
    expect([isGatherSource(s, i, 'rock'), isGatherSource(s, i, 'tree')]).toEqual([true, false]);
    s.feature[i] = 'palm';
    expect([isGatherSource(s, i, 'rock'), isGatherSource(s, i, 'tree')]).toEqual([false, true]);
    s.feature[i] = 'stump';
    expect([isGatherSource(s, i, 'rock'), isGatherSource(s, i, 'tree')]).toEqual([false, false]);
  });

  it('levelMaterials: none for a plot, a tent or a level past the top', () => {
    expect(levelMaterials(0)).toEqual({});
    expect(levelMaterials(1)).toEqual({});
    expect(levelMaterials(4)).toEqual({ stone: 15, wood: 5 });
    expect(levelMaterials(HOUSE_LEVELS.length)).toEqual({});
  });

  it('lackingMaterial: wood is reported before stone; the exact amount is enough', () => {
    const s = city();
    expect(lackingMaterial(s, { stone: 10, wood: 5 })).toBe('wood');
    s.wood = 5;
    expect(lackingMaterial(s, { stone: 10, wood: 5 })).toBe('stone');
    s.stone = 10;
    expect(lackingMaterial(s, { stone: 10, wood: 5 })).toBeNull();
    expect(lackingMaterial(city(), {})).toBeNull();
  });

  it('payMaterials takes both materials and rounds fractional stock to cents', () => {
    const s = city();
    s.wood = 5.3;
    s.stone = 10.1;
    payMaterials(s, { stone: 10, wood: 5 });
    expect([s.wood, s.stone]).toEqual([0.3, 0.1]);
    payMaterials(s, {});
    expect([s.wood, s.stone]).toEqual([0.3, 0.1]);
  });

  it('the quarry has no winterFactor: in winter it brings all its stone (the fisher does not)', () => {
    expect(quarry.winterFactor).toBeUndefined();
    expect(lumber.winterFactor).toBeUndefined();
    const s = city();
    const q = put(s, 'quarry', EAST, 30);
    plant(s, 'rock', [[27, 30], [27, 31]]);
    s.week = RULES.weeksPerSeason * 3; // first week of winter
    expect(gatherYield(s, q)).toBeCloseTo(2 * quarry.perCell);
    expect(computeEconomy(s).stone).toBeCloseTo(2 * quarry.perCell);
    expect(BUILDINGS.fisher.gather!.winterFactor).toBeLessThan(1);
  });

  it('cutTrees cuts as many trees as whole cutEvery the week reaches (nearest first)', () => {
    const s = city();
    const b = lumberAt(s);
    plant(s, 'olive', [[27, 30], [28, 30], [28, 31], [29, 31]]); // 1 wood a week
    b.cutProgress = 2 * EVERY - 1;
    const events: GameEvent[] = [];
    cutTrees(s, computeEconomy(s), events);
    expect(events.filter((e) => e.type === 'treeCut')).toEqual([
      { type: 'treeCut', x: 27, y: 30, kind: 'olive' },
      { type: 'treeCut', x: 28, y: 30, kind: 'olive' },
    ]);
    expect(b.cutProgress).toBeCloseTo(0);
    expect(s.stumps).toHaveLength(2);
  });

  it('cutTrees with fewer trees than owed: cuts what is there and keeps one cut waiting, no more', () => {
    const s = city();
    const b = lumberAt(s);
    plant(s, 'olive', [[27, 30]]); // 0.25 wood a week
    b.cutProgress = 2 * EVERY;
    const events: GameEvent[] = [];
    cutTrees(s, computeEconomy(s), events);
    expect(events).toHaveLength(1);
    expect(b.cutProgress).toBe(EVERY);
    expect(nextTreeToCut(s, b)).toBeNull();
  });

  it('a disconnected lumber neither counts nor cuts, whatever its count', () => {
    const s = city();
    const b = put(s, 'lumber', 2, 2);
    plant(s, 'olive', [[5, 2], [5, 3]]);
    b.cutProgress = EVERY + 3;
    const events: GameEvent[] = [];
    cutTrees(s, computeEconomy(s), events);
    expect(events).toEqual([]);
    expect(b.cutProgress).toBe(EVERY + 3);
  });

  it('regrowTrees: a stump stays until exactly treeRegrowWeeks have passed', () => {
    const s = city();
    const i = indexOf(s, 30, 30);
    s.feature[i] = 'stump';
    s.stumps.push({ i, kind: 'olive', week: 5 });
    const events: GameEvent[] = [];
    s.week = 5 + RULES.treeRegrowWeeks - 1;
    regrowTrees(s, events);
    expect([s.feature[i], events.length]).toEqual(['stump', 0]);
    s.week++;
    regrowTrees(s, events);
    expect(s.feature[i]).toBe('olive');
    expect(events).toEqual([{ type: 'treeRegrown', x: 30, y: 30, kind: 'olive' }]);
    expect(s.stumps).toEqual([]);
  });

  it('clearStump only removes stumps: trees and rocks stay', () => {
    const s = city();
    const t = indexOf(s, 30, 30);
    const r = indexOf(s, 31, 30);
    plant(s, 'palm', [[30, 30]]);
    plant(s, 'rock', [[31, 30]]);
    clearStump(s, t);
    clearStump(s, r);
    expect([s.feature[t], s.feature[r]]).toEqual(['palm', 'rock']);
  });

  it('building over trees or rocks is still refused (only stumps are free land)', () => {
    const s = city();
    plant(s, 'olive', [[EAST, 33]]);
    expect(isFreeLand(s, EAST, 33)).toBe(false);
    expect(checkPlace(s, 'field', EAST, 33)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('the same seed gives the same cuts and stock', () => {
    const play = () => {
      const s = createGame(createRng(11));
      const rng = createRng(11);
      const spot = lumberSpot(s)!;
      for (const c of spot.road) place(s, 'road', c.x, c.y);
      place(s, 'lumber', spot.x, spot.y);
      const events = run(s, 60, rng).filter((e) => e.type === 'treeCut');
      return { events, wood: s.wood, stumps: s.stumps };
    };
    expect(play()).toEqual(play());
  });
});

describe('waiting houses: edge cases', () => {
  const MARKET_X = westOf('market');
  function street() {
    const s = city();
    const a = put(s, 'house', EAST, 27, 2);
    put(s, 'plaza', ROADSIDE, 29);
    put(s, 'market', MARKET_X, 31);
    return { s, a };
  }

  it('houseInfo shows the next level materials and the wait; weeksToNextLevel shows 1', () => {
    const { s, a } = street();
    expect(houseInfo(s, a)!.next!.materials).toEqual({ stone: STONE });
    expect(houseInfo(s, a)!.waiting).toBeNull();
    run(s, UP + 2);
    expect(houseInfo(s, a)!.waiting).toBe('stone');
    expect(weeksToNextLevel(s, a)).toBe(1);
  });

  it('losing its own need (the road) clears the wait too', () => {
    const { s, a } = street();
    run(s, UP);
    expect(a.waiting).toBe('stone');
    // The roads around the 2x2 house: the starting road west of it and the ring above it.
    for (const [x, y] of [[EAST - 1, 27], [EAST - 1, 28], [EAST, 26], [EAST + 1, 26]]) s.roads[indexOf(s, x, y)] = false;
    refreshCity(s);
    expect(a.connected).toBe(false);
    run(s, 1);
    expect(a.waiting).toBeUndefined();
    expect(a.upStreak).toBe(0);
  });

  it('a famine pauses a waiting house: stone arriving during it is not spent', () => {
    const { s, a } = street();
    run(s, UP);
    expect(a.waiting).toBe('stone');
    s.stone = STONE;
    s.food = 0;
    stepWeek(s, never);
    expect(s.famine).toBe(true);
    expect([a.level, s.stone]).toEqual([2, STONE]);
    run(s, 1); // fed again
    expect([a.level, s.stone]).toEqual([3, 0]);
  });
});

describe('service levels and stone: edge cases', () => {
  it('level 3 asks 40 stone: 39 fail with materials, nothing charged', () => {
    const s = emptyGame();
    const m = put(s, 'market', westOf('market'), 31);
    m.level = 2;
    refreshCity(s);
    s.silver = 1000;
    s.stone = 39;
    expect(checkUpgrade(s, m.x, m.y)).toEqual({ ok: false, reason: 'materials' });
    expect(upgradeBuilding(s, m.x, m.y)).toEqual({ ok: false, reason: 'materials' });
    expect([m.level, s.silver, s.stone]).toEqual([2, 1000, 39]);
    s.stone = 40;
    expect(upgradeBuilding(s, m.x, m.y).ok).toBe(true);
    expect([m.level, s.silver, s.stone]).toEqual([3, 1000 - BUILDINGS.market.levels![1].cost, 0]);
  });

  it('upgrading costs no wood', () => {
    const s = emptyGame();
    put(s, 'workshop', EAST, 36);
    s.wood = 0;
    s.stone = 20;
    expect(upgradeBuilding(s, EAST, 36).ok).toBe(true);
    expect(s.wood).toBe(0);
  });
});

describe('tutorial lumber step: edge cases', () => {
  const step = TUTORIAL_STEPS.find((t) => t.id === 'lumber')!;

  it('a disconnected lumber does not finish it', () => {
    const s = city();
    const mark = markTutorial(s);
    put(s, 'lumber', 2, 2);
    expect(tutorialProgress(s, step, mark)).toBe(0);
    lumberAt(s);
    expect(tutorialProgress(s, step, mark)).toBe(1);
  });

  it('lumberSpot is null with no trees on the map', () => {
    expect(lumberSpot(city())).toBeNull();
  });
});

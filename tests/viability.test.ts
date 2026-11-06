import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  costOf,
  createGame,
  createRng,
  foodCapacity,
  foodLastsToHarvest,
  freeHouse,
  plainEating,
  waitingCouples,
  foodSpot,
  lumberSpot,
  GOALS,
  place,
  placeSpots,
  RULES,
  stepWeek,
  WEEKS_PER_YEAR,
  type BuildableKind,
  type Cell,
  type GameState,
} from '../src/core';
import { besideRiver, constRng, emptyGame, fill, put } from './helpers';

/**
 * Viability: a minimal plan, the one the tutorial teaches, must get through the first year on
 * every map. It is the guard against "the game is impossible": if a number change breaks it,
 * this test fails before any player sees it.
 *
 * The plan: road to the best food spot and a fisher or gatherer there, a field, a lumber at the
 * tutorial's spot (no plaza: it opens later); then each week, with the silver it has, the granary
 * once unlocked, more food when the forecast does not reach the spring and a plot near the altar
 * when a couple waits for a house. It never spends below 0.
 */
const altar = RULES.map.altar;
/** Free house spots touching the network with a cell in a plaza's reach. */
const plazaHouseSpots = (s: GameState) =>
  placeSpots(s, 'house').filter((o) => [0, 1].some((dx) => [0, 1].some((dy) => s.coverage.plaza[(o.y + dy) * s.cols + o.x + dx])));
const near = (to: Cell) => (a: Cell, b: Cell) => Math.abs(a.x - to.x) + Math.abs(a.y - to.y) - (Math.abs(b.x - to.x) + Math.abs(b.y - to.y));

function build(s: GameState, kind: BuildableKind, at: Cell | undefined, rotated = false): boolean {
  if (!at || s.silver < costOf(kind)) return false;
  return place(s, kind, at.x, at.y, rotated).ok;
}

/** A building at a tutorial spot (food or lumber), with its road; false if there is none or no silver. */
function addAt(s: GameState, spot: ReturnType<typeof foodSpot>): boolean {
  if (!spot || s.silver < costOf(spot.kind) + spot.road.length * costOf('road')) return false;
  for (const c of spot.road) place(s, 'road', c.x, c.y);
  return build(s, spot.kind, spot);
}

/** A fisher or gatherer at the best spot, with its road. */
const addFood = (s: GameState) => addAt(s, foodSpot(s));

/** A plot near the altar, for a couple waiting for a house. */
const addPlot = (s: GameState) => build(s, 'house', placeSpots(s, 'house').sort(near(altar))[0]);

function playWeek(s: GameState) {
  const has = (k: BuildableKind) => s.buildings.some((b) => b.kind === k && b.connected);
  if (!has('fisher') && !has('gatherer')) addFood(s);
  if (!has('field')) build(s, 'field', placeSpots(s, 'field').sort(near(altar))[0]);
  // The tutorial's lumber step, right after the field.
  if (has('field') && !has('lumber')) addAt(s, lumberSpot(s));
  if (s.unlocked.includes('granary') && !has('granary')) build(s, 'granary', placeSpots(s, 'granary').sort(near(altar))[0]);
  if (!foodLastsToHarvest(s)) addFood(s);
  const free = s.buildings.filter((b) => freeHouse(s, b)).length;
  if (waitingCouples(s).length > free && s.silver >= costOf('house') + 10) addPlot(s);
}

interface Run {
  firstFamine: number | null;
  goalsYear1: number;
  /** Week each goal was done in the first year. */
  goalWeeks: number[];
  lowestSilver: number;
}

function play(seed: number): Run {
  const rng = createRng(seed);
  const s = createGame(rng);
  const out: Run = { firstFamine: null, goalsYear1: 0, goalWeeks: [], lowestSilver: s.silver };
  while (s.week < WEEKS_PER_YEAR && !s.lost) {
    playWeek(s);
    out.lowestSilver = Math.min(out.lowestSilver, s.silver);
    for (const e of stepWeek(s, rng)) if (e.type === 'goal') out.goalWeeks.push(s.week);
    if (s.famine && out.firstFamine === null) out.firstFamine = s.week;
    out.lowestSilver = Math.min(out.lowestSilver, s.silver);
  }
  out.goalsYear1 = s.goalIndex;
  return out;
}

const SEEDS = Array.from({ length: 20 }, (_, k) => k + 1);

describe('viability of the first year (minimal plan, 20 maps)', () => {
  const runs = SEEDS.map((seed) => ({ seed, ...play(seed) }));

  it('no famine before week 26', () => {
    expect(runs.filter((r) => r.firstFamine !== null && r.firstFamine < 26)).toEqual([]);
  });

  it('goal 1 (food until the spring) and goal 2 (the first wedding) are done in the first autumn', () => {
    expect(GOALS[0].type).toBe('foodUntilSpring');
    expect(GOALS[1]).toMatchObject({ type: 'milestone', milestone: 'firstWedding' });
    expect(runs.filter((r) => !(r.goalWeeks[1] < RULES.weeksPerSeason))).toEqual([]);
  });

  it('goal 3 (the first birth) and goal 4 (the first winter passed) are done by the first spring', () => {
    expect(GOALS[2]).toMatchObject({ type: 'milestone', milestone: 'firstBirth' });
    expect(GOALS[3]).toMatchObject({ type: 'milestone', milestone: 'firstSpring' });
    expect(runs.filter((r) => !(r.goalWeeks[3] <= 2 * RULES.weeksPerSeason))).toEqual([]);
    expect(runs.filter((r) => r.goalsYear1 < 4)).toEqual([]);
  });

  it('the silver never goes negative', () => {
    expect(runs.filter((r) => r.lowestSilver < 0)).toEqual([]);
  });
});

describe('invariants of the start', () => {
  it('the starting silver pays the minimal kit: roads, fisher or gatherer, field, lumber, a plot', () => {
    for (const seed of SEEDS) {
      const s = createGame(createRng(seed));
      const spot = foodSpot(s);
      expect(spot).not.toBeNull();
      const wood = lumberSpot(s)!;
      const kit = (spot!.road.length + wood.road.length) * costOf('road') + costOf(spot!.kind) + costOf('field') + costOf('lumber') + costOf('house');
      expect(kit).toBeLessThanOrEqual(s.silver);
    }
  });

  it('one field, the best food spot and the base store feed the caravan through the winter', () => {
    const W = RULES.weeksPerSeason;
    const fieldWeek = (BUILDINGS.field.harvest ?? 0) / (3 * W);
    for (const seed of SEEDS) {
      const s = createGame(createRng(seed));
      const spot = foodSpot(s)!;
      const eats = (week: number) => plainEating(s.people, week);
      // A field built in the first autumn and the fisher or gatherer fill the store before the winter...
      expect(fieldWeek + spot.food, `seed ${seed}`).toBeGreaterThan(eats(0));
      const stored = Math.min(RULES.baseFoodStorage, s.food + (fieldWeek + spot.food - eats(0)) * W);
      // ...and the store and the spot's winter food (cut by winterFactor) cover the winter, when the tents eat more.
      const winterSpot = spot.food * BUILDINGS[spot.kind].gather!.winterFactor!;
      expect(stored + winterSpot * W, `seed ${seed}`).toBeGreaterThanOrEqual(eats(W) * W);
      expect(foodCapacity(s)).toBe(RULES.baseFoodStorage);
    }
  });
});

describe('a granary of level 1 is enough for a city of 15 houses (A8)', () => {
  it('15 mud-brick houses (~52 people), 2 fields, a fisher, a gatherer and one full granary: no famine until the spring', () => {
    const W = RULES.weeksPerSeason;
    const s = emptyGame({ week: W }); // the first week of winter
    s.unlocked = Object.keys(BUILDINGS) as BuildableKind[];
    const plazas = placeSpots(s, 'plaza').sort(near(altar));
    put(s, 'fisher', besideRiver(s, 30), 30);
    put(s, 'granary', placeSpots(s, 'granary').sort(near(altar))[0].x, placeSpots(s, 'granary').sort(near(altar))[0].y);
    for (let k = 0; k < 2; k++) {
      const c = placeSpots(s, 'field').sort(near(altar))[0];
      put(s, 'field', c.x, c.y);
    }
    const g = placeSpots(s, 'gatherer').sort(near(altar))[0];
    put(s, 'gatherer', g.x, g.y);
    let people = 0;
    for (let k = 0; k < 15; k++) {
      let spot = plazaHouseSpots(s).sort(near(altar))[0];
      if (!spot) {
        const p = placeSpots(s, 'plaza').sort(near(altar))[0] ?? plazas[0];
        put(s, 'plaza', p.x, p.y);
        spot = plazaHouseSpots(s).sort(near(altar))[0];
      }
      const n = k < 7 ? 4 : 3; // 7 × 4 + 8 × 3 = 52
      fill(s, put(s, 'house', spot.x, spot.y, 2, false, 0), n);
      people += n;
    }
    expect(people).toBe(52);
    expect(s.buildings.filter((b) => b.kind === 'house' && b.level === 2 && b.connected)).toHaveLength(15);
    expect(s.buildings.filter((b) => b.kind === 'granary')).toHaveLength(1);
    s.food = foodCapacity(s);
    const never = constRng(0.99);
    for (let k = 0; k < W; k++) {
      stepWeek(s, never);
      expect(s.famine, `week ${k}`).toBe(false);
    }
  });
});

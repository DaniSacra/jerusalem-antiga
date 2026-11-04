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
  plazaHouseSpots,
  waitingCouples,
  foodSpot,
  GOALS,
  needMet,
  place,
  placeSpots,
  RULES,
  spotsServing,
  stepWeek,
  WEEKS_PER_YEAR,
  type BuildableKind,
  type Building,
  type Cell,
  type GameState,
} from '../src/core';
import { besideRiver, constRng, emptyGame, fill, put } from './helpers';

/**
 * Viability: a minimal plan, the one the tutorial teaches, must get through the first year on
 * every map. It is the guard against "the game is impossible": if a number change breaks it,
 * this test fails before any player sees it.
 *
 * The plan: road to the best food spot and a fisher or gatherer there, a field, a plaza for the
 * caravan tents; then each week, with the silver it has, the granary once unlocked, more food when
 * the forecast does not reach the spring, a plot near a plaza when a couple waits for a house,
 * and a plaza for a tent without one. It never spends below 0.
 */
const altar = RULES.map.altar;
const near = (to: Cell) => (a: Cell, b: Cell) => Math.abs(a.x - to.x) + Math.abs(a.y - to.y) - (Math.abs(b.x - to.x) + Math.abs(b.y - to.y));

function build(s: GameState, kind: BuildableKind, at: Cell | undefined, rotated = false): boolean {
  if (!at || s.silver < costOf(kind)) return false;
  return place(s, kind, at.x, at.y, rotated).ok;
}

/** A fisher or gatherer at the best spot, with its road; false if there is none or no silver. */
function addFood(s: GameState): boolean {
  const spot = foodSpot(s);
  if (!spot || s.silver < costOf(spot.kind) + spot.road.length * costOf('road')) return false;
  for (const c of spot.road) place(s, 'road', c.x, c.y);
  return build(s, spot.kind, spot);
}

/** A plaza for this house: the spot that also reaches the most houses with a family. */
function plazaFor(s: GameState, house: Building): boolean {
  const families = s.buildings.filter((b) => b.kind === 'house' && b.level > 0 && !needMet(s, b, 'plaza'));
  const reach = (c: Cell) => families.filter((h) => Math.max(c.x - h.x - h.w, h.x - c.x - 2, c.y - h.y - h.h, h.y - c.y - 2) < (BUILDINGS.plaza.radius ?? 0)).length;
  const spot = spotsServing(s, 'plaza', house).sort((a, b) => reach(b) - reach(a))[0];
  return build(s, 'plaza', spot, spot?.rotated);
}

/** A plot near a plaza, so the couple's tent can become a mud-brick house. */
function addPlot(s: GameState): boolean {
  const plazas = s.buildings.filter((b) => b.kind === 'plaza' && b.connected);
  if (!plazas.length) return false;
  const spot = placeSpots(s, 'house').sort(near(plazas[0]))[0];
  return build(s, 'house', spot);
}

function playWeek(s: GameState) {
  const has = (k: BuildableKind) => s.buildings.some((b) => b.kind === k && b.connected);
  if (!has('fisher') && !has('gatherer')) addFood(s);
  if (!has('field')) build(s, 'field', placeSpots(s, 'field').sort(near(altar))[0]);
  const bare = s.buildings.find((b) => b.kind === 'house' && b.level > 0 && !needMet(s, b, 'plaza'));
  if (bare) plazaFor(s, bare);
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

  it('goal 1 (the first wedding) is done in the first autumn and goal 2 (food until the spring) before the spring', () => {
    expect(GOALS[0]).toMatchObject({ type: 'milestone', milestone: 'firstWedding' });
    expect(GOALS[1].type).toBe('foodUntilSpring');
    expect(runs.filter((r) => !(r.goalWeeks[0] < RULES.weeksPerSeason))).toEqual([]);
    expect(runs.filter((r) => !(r.goalWeeks[1] < 2 * RULES.weeksPerSeason))).toEqual([]);
  });

  it('goals 1 and 2 are done within the first year', () => {
    expect(runs.filter((r) => r.goalsYear1 < 2)).toEqual([]);
  });

  it('the silver never goes negative', () => {
    expect(runs.filter((r) => r.lowestSilver < 0)).toEqual([]);
  });
});

describe('invariants of the start', () => {
  it('the starting silver pays the minimal kit: road to food, fisher or gatherer, field, plaza, a plot', () => {
    for (const seed of SEEDS) {
      const s = createGame(createRng(seed));
      const spot = foodSpot(s);
      expect(spot).not.toBeNull();
      const kit = spot!.road.length * costOf('road') + costOf(spot!.kind) + costOf('field') + costOf('plaza') + costOf('house');
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

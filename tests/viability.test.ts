import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  costOf,
  createGame,
  createRng,
  familyBlock,
  foodCapacity,
  foodLastsToHarvest,
  foodPerResident,
  foodSpot,
  lumberSpot,
  GOALS,
  HOUSE_LEVELS,
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

/**
 * Viability: a minimal plan, the one the tutorial teaches, must get through the first year on
 * every map. It is the guard against "the game is impossible": if a number change breaks it,
 * this test fails before any player sees it.
 *
 * The plan: road to the best food spot and a fisher or gatherer there, a field, a plaza for the
 * caravan tents; then each week, with the silver it has, the granary once unlocked, more food when
 * the forecast does not reach the spring, a lumber at the tutorial's spot once the first family
 * came, a plot near a plaza when a family could come, and a plaza for a tent without one. It
 * never spends below 0.
 */
const altar = RULES.map.altar;
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

/** A plaza for this house: the spot that also reaches the most houses with a family. */
function plazaFor(s: GameState, house: Building): boolean {
  const families = s.buildings.filter((b) => b.kind === 'house' && b.level > 0 && !needMet(s, b, 'plaza'));
  const reach = (c: Cell) => families.filter((h) => Math.max(c.x - h.x - h.w, h.x - c.x - 2, c.y - h.y - h.h, h.y - c.y - 2) < (BUILDINGS.plaza.radius ?? 0)).length;
  const spot = spotsServing(s, 'plaza', house).sort((a, b) => reach(b) - reach(a))[0];
  return build(s, 'plaza', spot, spot?.rotated);
}

/** A plot near a plaza, so the tent that comes can become a mud-brick house. */
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
  // The tutorial's lumber step, right after the first family.
  if (s.milestones.includes('firstFamily') && !has('lumber')) addAt(s, lumberSpot(s));
  if (familyBlock(s) === 'noPlot' && s.silver >= costOf('house') + 10) addPlot(s);
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

  it('goal 1 (food until the spring, which unlocks the granary) is done in the first autumn', () => {
    expect(GOALS[0].type).toBe('foodUntilSpring');
    expect(runs.filter((r) => !(r.goalWeeks[0] < RULES.weeksPerSeason))).toEqual([]);
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
      const tents = s.start.families;
      const spot = foodSpot(s)!;
      const eats = (week: number) => tents * HOUSE_LEVELS[1].residents * foodPerResident(1, week);
      // A field built in the first autumn and the fisher or gatherer fill the store before the winter...
      expect(fieldWeek + spot.food, `seed ${seed}`).toBeGreaterThan(eats(0));
      const stored = Math.min(RULES.baseFoodStorage, s.food + (fieldWeek + spot.food - eats(0)) * W);
      // ...and the store and the spot's winter food cover the winter, when the tents eat more.
      expect(stored + spot.food * W, `seed ${seed}`).toBeGreaterThanOrEqual(eats(W) * W);
      expect(foodCapacity(s)).toBe(RULES.baseFoodStorage);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { BUILDINGS, computeEconomy, lampGuards, lampLit, lampsBurn, litBy, noteTheft, RULES, statOf, stepWeek, theftAt, theftTotal, type GameEvent, type GameState } from '../src/core';
import { constRng, EAST, emptyGame, fill, hire, put, ROADSIDE } from './helpers';

const T = RULES.theft;
const BASE = RULES.baseFoodStorage;

/** A city of `n` residents (houses of 4 on the road's west side) and a granary east of the road. */
function city(n: number, food = BASE + 200): { s: GameState; granary: ReturnType<typeof put> } {
  const s = emptyGame({ food });
  for (let k = 0, left = n; left > 0; k++, left -= 4) fill(s, put(s, 'house', ROADSIDE, 27 + 2 * k, 2, false, 0), Math.min(4, left));
  const granary = put(s, 'granary', EAST, 36);
  return { s, granary };
}

describe('theft data (plano-dificuldade C)', () => {
  it('from 20 residents, 3% a week; the granary fills right after the fields', () => {
    expect(T).toEqual({ minPeople: 20, share: 0.03, litTheft: 0.25 });
    expect(RULES.jobPriority.indexOf('granary')).toBe(RULES.jobPriority.indexOf('field') + 1);
  });
});

describe('theft from unguarded granaries', () => {
  it('below minPeople residents nothing is stolen', () => {
    const { s } = city(T.minPeople - 1);
    expect(theftAt(s).size).toBe(0);
    expect(computeEconomy(s).theft).toBe(0);
  });

  it('an unguarded granary loses share of the food above the base store; with its keeper nothing', () => {
    const { s, granary } = city(T.minPeople);
    for (const p of s.people) p.jobId = null; // nobody keeps it
    expect(theftAt(s).get(granary.id)).toBeCloseTo(200 * T.share);
    expect(computeEconomy(s).theft).toBeCloseTo(200 * T.share);
    hire(s, granary, 1);
    expect(theftAt(s).size).toBe(0);
  });

  it('only the food above the base store can be stolen', () => {
    const { s } = city(T.minPeople, BASE);
    for (const p of s.people) p.jobId = null;
    expect(theftTotal(s)).toBe(0);
  });

  it('two granaries share the stored food by capacity; only the unguarded one is robbed', () => {
    const { s, granary } = city(T.minPeople, BASE + 300);
    const big = put(s, 'granary', EAST, 39, 2);
    hire(s, big, 1); // refreshes the city: the free adults take jobs again
    for (const p of s.people) if (p.jobId !== big.id) p.jobId = null;
    const a = statOf(granary, 'storage');
    const b = statOf(big, 'storage');
    expect(theftAt(s).get(granary.id)).toBeCloseTo((300 * a) / (a + b) * T.share);
    expect(theftAt(s).has(big.id)).toBe(false);
  });

  it('the economy takes the theft out of foodDelta', () => {
    const { s } = city(T.minPeople);
    for (const p of s.people) p.jobId = null;
    const e = computeEconomy(s);
    expect(e.foodDelta).toBeCloseTo(e.foodMade - e.foodEaten - e.theft);
  });

  it('the toast comes once per episode, with what was taken; a guarded week ends it', () => {
    const { s, granary } = city(T.minPeople);
    const events: GameEvent[] = [];
    noteTheft(s, new Map([[granary.id, 10]]), events);
    expect(events).toEqual([{ type: 'granaryRobbed', amount: 10, x: granary.x, y: granary.y }]);
    noteTheft(s, new Map([[granary.id, 9]]), events);
    expect(events).toHaveLength(1);
    noteTheft(s, new Map(), events);
    expect(granary.robbed).toBeUndefined();
    noteTheft(s, new Map([[granary.id, 8]]), events);
    expect(events).toHaveLength(2);
  });

  it('a week of the game: an unguarded granary in a city of 20 is robbed (the event)', () => {
    const { s } = city(T.minPeople, BASE + 400);
    s.jobTargets.granary = 0; // the player kept nobody there
    const events = stepWeek(s, constRng(0.99));
    expect(events.some((e) => e.type === 'granaryRobbed')).toBe(true);
    expect(BUILDINGS.granary.storage).toBeGreaterThan(0);
  });
});

describe('lamps (plano-dificuldade D)', () => {
  it('Lamparina: 1 x 1, 8 silver, no upkeep (it burns wood), burns 0.05 wood a week, radius 3; unlocked at 30 residents', () => {
    expect(BUILDINGS.lamp).toMatchObject({ cost: 8, w: 1, h: 1, jobs: 0, radius: 3, burns: 0.05 });
    expect(BUILDINGS.lamp.upkeep).toBeUndefined();
    expect(T.litTheft).toBe(0.25);
  });

  it('a lit lamp near an unguarded granary cuts its theft to litTheft; out of wood it guards nothing', () => {
    const { s, granary } = city(T.minPeople);
    s.jobTargets.granary = 0;
    for (const p of s.people) p.jobId = null;
    const full = theftAt(s).get(granary.id)!;
    const lamp = put(s, 'lamp', EAST, 35); // by the road, right above the granary
    for (const p of s.people) p.jobId = null;
    expect(lamp.connected).toBe(true);
    expect(lampGuards(s, lamp)).toBe(1);
    expect(lampLit(s, lamp)).toBe(true);
    expect(theftAt(s).get(granary.id)).toBeCloseTo(full * T.litTheft);
    s.wood = 0;
    expect(lampLit(s, lamp)).toBe(false);
    expect(theftAt(s).get(granary.id)).toBeCloseTo(full);
  });

  it('a lamp far from the granary guards nothing', () => {
    const { s, granary } = city(T.minPeople);
    for (const p of s.people) p.jobId = null;
    const far = put(s, 'lamp', EAST, 27);
    expect(lampGuards(s, far)).toBe(0);
    expect(litBy(s, granary)).toEqual([]);
  });

  it('the connected lamps burn wood every week, never below 0', () => {
    const { s } = city(4);
    const before = computeEconomy(s).wood;
    put(s, 'lamp', EAST, 27);
    put(s, 'lamp', EAST, 28);
    expect(lampsBurn(s)).toBeCloseTo(2 * BUILDINGS.lamp.burns!);
    expect(computeEconomy(s).wood).toBeCloseTo(before - 2 * BUILDINGS.lamp.burns!);
    s.wood = 0.05;
    stepWeek(s, constRng(0.99));
    expect(s.wood).toBeGreaterThanOrEqual(0);
  });
});

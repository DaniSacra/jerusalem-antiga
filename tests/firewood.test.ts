import { describe, expect, it } from 'vitest';
import {
  alerts,
  burnFirewood,
  computeEconomy,
  firewoodPerWeek,
  firewoodShort,
  HOUSE_LEVELS,
  RULES,
  seasonOf,
  stepWeek,
  type GameEvent,
  type Rng,
} from '../src/core';
import { constRng, EAST, emptyGame, put, ROADSIDE } from './helpers';

const W = RULES.weeksPerSeason;
const AUTUMN = 0;
const WINTER = W;
const SPRING = 2 * W;
const fw = (level: number) => HOUSE_LEVELS[level].firewood ?? 0;

/** Counts the draws of a constant rng. */
function counting(v: number): Rng & { calls: number } {
  const r = (() => {
    r.calls++;
    return v;
  }) as Rng & { calls: number };
  r.calls = 0;
  return r;
}

describe('firewood data and seasons', () => {
  it('the levels burn 0 / 0.3 / 0.2 / 0.15 / 0.15 and the game starts in autumn', () => {
    expect([0, 1, 2, 3, 4].map(fw)).toEqual([0, 0.3, 0.2, 0.15, 0.15]);
    expect([seasonOf(AUTUMN), seasonOf(WINTER), seasonOf(SPRING)]).toEqual(['autumn', 'winter', 'spring']);
    expect(RULES.materialStorage).toBe(400);
  });
});

describe('burning', () => {
  it('in winter each house with people burns its level; an empty plot burns nothing; other seasons burn nothing', () => {
    const s = emptyGame({ week: WINTER });
    put(s, 'house', ROADSIDE, 27, 1);
    put(s, 'house', ROADSIDE, 29, 2);
    put(s, 'house', ROADSIDE, 31, 0);
    expect(firewoodPerWeek(s)).toBeCloseTo(fw(1) + fw(2));
    s.wood = 10;
    burnFirewood(s, []);
    expect(s.wood).toBeCloseTo(10 - fw(1) - fw(2));
    for (const week of [AUTUMN, SPRING, SPRING + W]) {
      s.week = week;
      s.wood = 10;
      burnFirewood(s, []);
      expect(s.wood).toBe(10);
    }
  });

  it('with no wood made and none stored, a winter week with people is cold', () => {
    const s = emptyGame({ week: WINTER, food: 1000 });
    s.wood = 0;
    put(s, 'house', ROADSIDE, 44, 1, false, 3);
    const eco = computeEconomy(s);
    s.wood = 0;
    // No lumber: no wood, cold.
    stepWeek(s, constRng(0.99));
    expect(s.cold).toBe(true);
    expect(eco.wood).toBe(0);
  });

  it('cold starts when the wood does not pay the burn (stock to 0) and ends with wood or out of winter', () => {
    const s = emptyGame({ week: WINTER });
    put(s, 'house', ROADSIDE, 27, 1);
    s.wood = 0.1;
    const events: GameEvent[] = [];
    burnFirewood(s, events);
    expect([s.cold, s.wood]).toEqual([true, 0]);
    burnFirewood(s, events);
    expect(events.filter((e) => e.type === 'coldStart')).toHaveLength(1);
    s.wood = 5;
    burnFirewood(s, events);
    expect(s.cold).toBe(false);
    expect(events.at(-1)).toEqual({ type: 'coldEnd' });
    s.wood = 0;
    burnFirewood(s, events);
    expect(s.cold).toBe(true);
    s.week = SPRING;
    burnFirewood(s, events);
    expect(s.cold).toBe(false);
  });
});

describe('cold hurts houses as a famine does', () => {
  it('without famine: a tent leaves (cause cold), a higher house drops, the climb pauses, winterLoss is marked', () => {
    const s = emptyGame({ week: WINTER, food: 1000 });
    s.wood = 0;
    const tent = put(s, 'house', ROADSIDE, 44, 1, false, 3);
    const mud = put(s, 'house', ROADSIDE, 27, 2, false, 3);
    put(s, 'plaza', ROADSIDE, 29);
    const events = stepWeek(s, constRng(0));
    expect(s.cold).toBe(true);
    expect(s.famine).toBe(false);
    expect(s.winterLoss).toBe(true);
    expect(tent.level).toBe(0);
    expect(events).toContainEqual(expect.objectContaining({ type: 'familyLeft', reason: 'cold' }));
    expect(mud.level).toBe(1);
    expect(s.departed.some((p) => p.end?.cause === 'cold')).toBe(true);
  });

  it('a lucky draw keeps the houses, the climb count stays (paused, not reset)', () => {
    const s = emptyGame({ week: WINTER, food: 1000 });
    s.wood = 0;
    const tent = put(s, 'house', ROADSIDE, 27, 1, false, 3);
    tent.upStreak = 3;
    stepWeek(s, constRng(0.99));
    expect([s.cold, tent.level, tent.upStreak]).toEqual([true, 1, 3]);
  });

  it('famine and cold together make one draw per house and week', () => {
    const run = (cold: boolean) => {
      const s = emptyGame({ week: WINTER, food: 0 });
      s.wood = cold ? 0 : 1000;
      put(s, 'house', ROADSIDE, 27, 1, false, 3);
      const rng = counting(0.99);
      stepWeek(s, rng);
      expect(s.famine).toBe(true);
      expect(s.cold).toBe(cold);
      return rng.calls;
    };
    expect(run(true)).toBe(run(false));
  });
});

describe('store cap', () => {
  it('production stops at materialStorage; a stock above it is never cut; a full lumber fells no tree', () => {
    const s = emptyGame({ week: SPRING });
    put(s, 'house', ROADSIDE, 44, 1, false, 3);
    put(s, 'house', ROADSIDE, 46, 1, false, 3);
    const b = put(s, 'lumber', EAST, 30);
    s.feature.fill(null as never);
    for (let y = 27; y <= 34; y++) for (const x of [28, 29]) s.feature[y * s.cols + x] = 'olive';
    s.wood = RULES.materialStorage - 0.5;
    const eco = computeEconomy(s);
    expect(eco.wood).toBeCloseTo(0.5);
    s.wood = 1000;
    expect(computeEconomy(s).wood).toBe(0);
    s.food = 1000;
    stepWeek(s, constRng(0.99));
    expect(s.wood).toBe(1000);
    expect(b.cutProgress ?? 0).toBe(0);
  });
});

describe('firewoodShort and alerts', () => {
  it('is 0 in spring and summer; in autumn it counts the whole winter against stock plus production; rounds up', () => {
    const s = emptyGame({ week: AUTUMN });
    put(s, 'house', ROADSIDE, 27, 1);
    s.wood = 0;
    const need = fw(1) * W;
    expect(firewoodShort(s, { wood: 0 })).toBe(Math.ceil(need));
    expect(firewoodShort(s, { wood: 1 })).toBe(0);
    s.wood = need;
    expect(firewoodShort(s, { wood: 0 })).toBe(0);
    s.wood = 0;
    s.week = SPRING;
    expect(firewoodShort(s, { wood: 0 })).toBe(0);
    s.week = SPRING + W;
    expect(firewoodShort(s, { wood: 0 })).toBe(0);
  });

  it('alerts: firewood (short or cold) right after the food; storageFull when a working maker is full', () => {
    const s = emptyGame({ week: AUTUMN, food: 1000 });
    put(s, 'house', ROADSIDE, 27, 1);
    s.wood = 0;
    s.stone = 0;
    expect(alerts(s).find((a) => a.kind === 'firewood')).toEqual({ kind: 'firewood', missing: Math.ceil(fw(1) * W), cold: false });
    s.cold = true;
    expect(alerts(s).find((a) => a.kind === 'firewood')).toMatchObject({ cold: true });
    expect(alerts(s).some((a) => a.kind === 'storageFull')).toBe(false);
    s.cold = false;
    s.wood = 500;
    put(s, 'lumber', EAST, 30);
    expect(alerts(s).filter((a) => a.kind === 'storageFull')).toEqual([{ kind: 'storageFull', material: 'wood' }]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  checkUpgrade,
  computeCoverage,
  computeEconomy,
  createRng,
  fieldBonus,
  foodCapacity,
  foodForecast,
  gatherFood,
  indexOf,
  nextLevelOf,
  place,
  RULES,
  statOf,
  stepWeek,
  upgradeBuilding,
  weeksToNextLevel,
  type GameEvent,
} from '../src/core';
import { besideRiver, constRng, EAST, emptyGame, hire, put, ROADSIDE } from './helpers';

const W = RULES.weeksPerSeason;
const WINTER = W;

describe('service building levels', () => {
  it('granary, market and workshop list their next levels; the definition is level 1', () => {
    expect(BUILDINGS.granary).toMatchObject({ cost: 40, upkeep: 1, storage: 300 });
    expect(BUILDINGS.granary.levels).toMatchObject([{ cost: 60, upkeep: 2, storage: 600 }, { cost: 100, upkeep: 4, storage: 1000 }]);
    expect(BUILDINGS.market.levels).toMatchObject([{ cost: 60, upkeep: 3, radius: 6 }, { cost: 90, upkeep: 5, radius: 7 }]);
    expect(BUILDINGS.workshop.levels).toMatchObject([{ cost: 50, upkeep: 2, fieldBonus: 0.2 }, { cost: 80, upkeep: 3, fieldBonus: 0.3 }]);
  });

  it('statOf reads the value of the level (or of the definition when the level does not set it)', () => {
    const s = emptyGame();
    const g = put(s, 'granary', EAST, 36);
    expect(g.level).toBe(1);
    expect([statOf(g, 'storage'), statOf(g, 'upkeep'), statOf(g, 'jobs')]).toEqual([300, 1, 1]);
    g.level = 3;
    expect([statOf(g, 'storage'), statOf(g, 'upkeep'), statOf(g, 'jobs')]).toEqual([1000, 4, 1]);
    expect(statOf({ kind: 'field', level: 1 }, 'upkeep')).toBe(0.5);
    expect(statOf({ kind: 'house', level: 3 }, 'upkeep')).toBe(0);
  });

  it('upgrading pays the level (silver and stone), raises it and changes the store and the upkeep, with an event', () => {
    const s = emptyGame();
    s.silver = 500;
    s.stone = 70;
    const g = put(s, 'granary', EAST, 36);
    const events: GameEvent[] = [];
    expect(foodCapacity(s)).toBe(RULES.baseFoodStorage + 300);
    expect(upgradeBuilding(s, EAST + 1, 37, events)).toEqual({ ok: true });
    expect([g.level, s.silver, foodCapacity(s), computeEconomy(s).upkeep.granary]).toEqual([2, 440, RULES.baseFoodStorage + 600, 2]);
    expect(events).toEqual([{ type: 'buildingUp', x: EAST, y: 36, level: 2 }]);
    expect(upgradeBuilding(s, EAST, 36).ok).toBe(true);
    expect([g.level, s.silver, foodCapacity(s)]).toEqual([3, 340, RULES.baseFoodStorage + 1000]);
    expect(s.stone).toBe(10);
  });

  it('every service level asks stone: 20 for level 2 and 40 for level 3', () => {
    for (const kind of ['granary', 'market', 'workshop'] as const) {
      expect(BUILDINGS[kind].levels!.map((l) => l.materials)).toEqual([{ stone: 20 }, { stone: 40 }]);
    }
  });

  it('fails without the stone (materials) and then charges nothing; silver is checked first', () => {
    const s = emptyGame();
    const g = put(s, 'granary', EAST, 36);
    s.silver = 500;
    s.stone = 19;
    expect(upgradeBuilding(s, EAST, 36)).toEqual({ ok: false, reason: 'materials' });
    expect([g.level, s.silver, s.stone]).toEqual([1, 500, 19]);
    s.silver = 59;
    expect(checkUpgrade(s, EAST, 36)).toEqual({ ok: false, reason: 'silver' });
    s.silver = 60;
    s.stone = 20;
    expect(upgradeBuilding(s, EAST, 36).ok).toBe(true);
    expect([g.level, s.silver, s.stone]).toEqual([2, 0, 0]);
  });

  it('fails at the top level (locked), without the silver, in debt, and on buildings without levels', () => {
    const s = emptyGame();
    const g = put(s, 'granary', EAST, 36);
    put(s, 'field', EAST, 30);
    s.silver = 59;
    expect(upgradeBuilding(s, EAST, 36)).toEqual({ ok: false, reason: 'silver' });
    s.silver = -1;
    expect(upgradeBuilding(s, EAST, 36)).toEqual({ ok: false, reason: 'debt' });
    s.silver = 1000;
    g.level = 3;
    expect(checkUpgrade(s, EAST, 36)).toEqual({ ok: false, reason: 'locked' });
    expect(nextLevelOf(g)).toBeNull();
    expect(checkUpgrade(s, EAST, 30)).toEqual({ ok: false, reason: 'locked' });
    expect(checkUpgrade(s, 0, 0)).toEqual({ ok: false, reason: 'locked' });
    expect(s.silver).toBe(1000);
  });

  it('a market level widens its reach', () => {
    const s = emptyGame();
    const m = put(s, 'market', EAST, 30);
    hire(s, m);
    const reach = () => computeCoverage(s).market.filter(Boolean).length;
    const before = reach();
    m.level = 2;
    expect(reach()).toBeGreaterThan(before);
  });

  it('workshop levels add up to the same cap: one workshop at level 3 gives what three at level 1 give', () => {
    const s = emptyGame();
    const w = put(s, 'workshop', EAST, 30);
    expect(fieldBonus(s)).toBe(0); // nobody works there: no bonus
    hire(s, w);
    expect(fieldBonus(s)).toBe(0.1);
    w.level = 3;
    expect(fieldBonus(s)).toBe(0.3);
    put(s, 'workshop', EAST, 34);
    expect(fieldBonus(s)).toBe(BUILDINGS.workshop.fieldBonusMax);
  });
});

describe('upkeep from the first week', () => {
  it('every building pays its upkeep from the week it is built, connected or not: no goal frees it', () => {
    const s = emptyGame({ goalIndex: 0 });
    put(s, 'field', EAST, 30);
    put(s, 'plaza', 10, 10); // no road
    put(s, 'market', EAST, 33);
    const e = computeEconomy(s);
    expect(e.upkeep).toEqual({ field: 0.5, plaza: 0.5, market: 2 });
    expect(e.silverDelta).toBe(-3);
    const before = s.silver;
    stepWeek(s, constRng(0.99));
    expect(s.silver).toBe(before - 3);
  });

  it('level-1 upkeep: small food and plaza buildings 0.5, park, granary and workshop 1, market 2, temple and houses 0', () => {
    expect(['field', 'plaza', 'fisher', 'gatherer'].map((k) => BUILDINGS[k as 'field'].upkeep)).toEqual([0.5, 0.5, 0.5, 0.5]);
    expect([BUILDINGS.park.upkeep, BUILDINGS.granary.upkeep, BUILDINGS.workshop.upkeep, BUILDINGS.market.upkeep, BUILDINGS.temple.upkeep]).toEqual([1, 1, 1, 2, 0]);
    expect(BUILDINGS.house.upkeep).toBeUndefined();
  });
});

describe('winter for the fisher and the gatherer', () => {
  it('bring winterFactor of their food in winter, in the week and in the forecast', () => {
    const s = emptyGame();
    const x = besideRiver(s, 30);
    const f = put(s, 'fisher', x, 30);
    const full = gatherFood(s, f, 0);
    expect(full).toBeGreaterThan(0);
    expect(BUILDINGS.fisher.gather?.winterFactor).toBe(0.3);
    expect(BUILDINGS.gatherer.gather?.winterFactor).toBe(0.3);
    expect(gatherFood(s, f, WINTER)).toBeCloseTo(full * 0.3);
    // A house of 8 (the workers) eats less than the fisher brings, but more than its winter catch.
    put(s, 'house', ROADSIDE, 27, 4);
    s.week = WINTER;
    expect(computeEconomy(s).foodMade).toBeCloseTo(full * 0.3, 2);
    put(s, 'granary', EAST, 36);
    s.food = 5; // from the first week of winter
    const winterCut = foodForecast(s);
    const g = BUILDINGS.fisher.gather!;
    g.winterFactor = 1;
    const noCut = foodForecast(s);
    g.winterFactor = 0.3;
    expect(winterCut?.season).toBe('winter');
    expect(noCut).toBeNull();
  });
});

describe('house climbing time', () => {
  it('each house draws upWeeks in weeksToUpgrade when built and at every level; it climbs after upWeeks', () => {
    expect(RULES.weeksToUpgrade).toEqual([11, 15]);
    const seen = new Set<number>();
    const s = emptyGame();
    for (let k = 0; k < 40; k++) {
      place(s, 'house', 2 + (k % 10) * 2, 2 + Math.floor(k / 10) * 2, false, createRng(k + 1));
      const b = s.grid[indexOf(s, 2 + (k % 10) * 2, 2 + Math.floor(k / 10) * 2)]!;
      seen.add(b.upWeeks);
    }
    expect(Math.min(...seen)).toBe(11);
    expect(Math.max(...seen)).toBe(15);

    const t = emptyGame();
    put(t, 'plaza', EAST, 30);
    const h = put(t, 'house', ROADSIDE, 29, 1, false, 2);
    h.upWeeks = 12;
    expect(weeksToNextLevel(t, h)).toBe(12);
    for (let k = 0; k < 11; k++) stepWeek(t, constRng(0.99));
    expect(h.level).toBe(1);
    stepWeek(t, constRng(0.99));
    expect(h.level).toBe(2);
    expect(h.upWeeks).toBeGreaterThanOrEqual(11);
    expect(h.upWeeks).toBeLessThanOrEqual(15);
  });
});

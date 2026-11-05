import { describe, expect, it } from 'vitest';
import { balloonNeed, BUILDINGS, clearCell, computeEconomy, foodOf, HOUSE_LEVELS, gatherCells, gatherYield, indexOf, RULES, seasonOf, stepWeek, type Building, type GameState } from '../src/core';
import { besideRiver, constRng, EAST, emptyGame, put, ROADSIDE } from './helpers';

const W = RULES.weeksPerSeason;
const fish = BUILDINGS.fisher.gather!;
const tree = BUILDINGS.gatherer.gather!;

/** River cells in the square radius around a footprint, counted here independently of the core. */
function riverInReach(s: GameState, b: Building, r: number): number {
  let n = 0;
  for (let y = b.y - r; y <= b.y + b.h - 1 + r; y++) {
    for (let x = b.x - r; x <= b.x + b.w - 1 + r; x++) {
      if (x >= 0 && y >= 0 && x < s.cols && y < s.rows && s.ground[indexOf(s, x, y)] === 'river') n++;
    }
  }
  return n;
}

/** A gatherer east of the starting road (x 25..26, y 30..31): radius 3 reaches x 22..29, y 27..34. */
const gathererAt = (s: GameState) => put(s, 'gatherer', EAST, 30);

describe('fisher and gatherer data', () => {
  it('cost 20, upkeep 1, 1 job, 2x2, in the supply group, unlocked from the start', () => {
    for (const k of ['fisher', 'gatherer'] as const) {
      expect(BUILDINGS[k]).toMatchObject({ cost: 20, upkeep: 0.5, jobs: 1, w: 2, h: 2, category: 'supply' });
      expect(RULES.startUnlocked).toContain(k);
    }
    expect(fish).toEqual({ source: 'river', radius: 2, perCell: 0.75, max: 4.5, winterFactor: 0.3 });
    expect(tree).toEqual({ source: 'tree', radius: 3, perCell: 0.3, max: 3.5, winterFactor: 0.3 });
  });
});

describe('fisher', () => {
  it('counts the river cells in its radius and brings perCell each, at most max', () => {
    const s = emptyGame();
    const b = put(s, 'fisher', besideRiver(s, 30), 30);
    const n = riverInReach(s, b, fish.radius);
    expect(n).toBeGreaterThan(0);
    expect(gatherCells(s, b)).toBe(n);
    expect(gatherYield(s, b)).toBeCloseTo(Math.min(fish.max, n * fish.perCell));
  });

  it('brings less when only the edge of its radius reaches the river', () => {
    const s = emptyGame();
    const left = besideRiver(s, 30);
    const b = put(s, 'fisher', left - 3, 28); // above the road, 3 cells farther west
    const near = put(s, 'fisher', left, 30);
    const n = riverInReach(s, b, fish.radius);
    expect(gatherCells(s, b)).toBe(n);
    expect(gatherCells(s, b)).toBeLessThan(gatherCells(s, near));
    expect(gatherYield(s, b)).toBeCloseTo(Math.min(fish.max, n * fish.perCell));
  });

  it('far from the river brings nothing and shows the "no source" balloon', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 2); // 2 workers for its job
    const b = put(s, 'fisher', ROADSIDE, 30);
    expect(gatherCells(s, b)).toBe(0);
    expect(gatherYield(s, b)).toBe(0);
    expect(balloonNeed(s, b)).toBe('noSource');
  });

  it('a disconnected fisher by the river brings nothing and shows the road balloon', () => {
    const s = emptyGame();
    const left = besideRiver(s, 30);
    const b = put(s, 'fisher', left, 30);
    clearCell(s, left - 1, 30); // cut the road right before it
    expect(b.connected).toBe(false);
    expect(gatherCells(s, b)).toBeGreaterThan(0);
    expect(gatherYield(s, b)).toBe(0);
    expect(balloonNeed(s, b)).toBe('road');
  });

  it('feeds the city every week of the year (winterFactor in winter), scaled by the worker efficiency', () => {
    const s = emptyGame({ food: 20 });
    const b = put(s, 'fisher', besideRiver(s, 30), 30);
    const caught = gatherYield(s, b);
    expect(computeEconomy(s)).toMatchObject({ workers: 0, efficiency: 0, foodMade: 0 }); // nobody to fish
    put(s, 'house', ROADSIDE, 27, 1); // a tent: enough workers for the 1 job
    const eats = (week: number) => HOUSE_LEVELS[1].capacity * foodOf('adult', 1, week);
    const winter = (week: number) => (seasonOf(week) === 'winter' ? (BUILDINGS.fisher.gather!.winterFactor ?? 1) : 1);
    for (const week of [0, W, 2 * W, 3 * W]) {
      s.week = week;
      const e = computeEconomy(s);
      expect(e.efficiency).toBe(1);
      expect(e.harvest).toBe(0);
      expect(e.foodMade).toBeCloseTo(caught * winter(week));
      expect(e.foodDelta).toBeCloseTo(caught * winter(week) - eats(week));
    }
    s.week = 2;
    const before = s.food;
    stepWeek(s, constRng(0.99));
    expect(s.food).toBeCloseTo(before + caught - eats(2));
    expect(seasonOf(2)).toBe('autumn');
  });
});

describe('gatherer', () => {
  it('counts olives and palms in its radius (not rocks), 0.1 each', () => {
    const s = emptyGame();
    const b = gathererAt(s);
    expect(gatherCells(s, b)).toBe(0);
    s.feature[indexOf(s, 28, 30)] = 'olive';
    s.feature[indexOf(s, 29, 34)] = 'palm'; // the far corner of the radius
    s.feature[indexOf(s, 27, 31)] = 'rock';
    s.feature[indexOf(s, 30, 30)] = 'olive'; // one column beyond the radius
    expect(gatherCells(s, b)).toBe(2);
    expect(gatherYield(s, b)).toBeCloseTo(2 * tree.perCell);
  });

  it('is capped at 1.5 a week', () => {
    const s = emptyGame();
    const b = gathererAt(s);
    let n = 0;
    for (let y = 27; y <= 34; y++) for (const x of [27, 28, 29]) s.feature[indexOf(s, x, y)] = (n++ % 2 ? 'palm' : 'olive');
    expect(gatherCells(s, b)).toBe(24);
    expect(gatherYield(s, b)).toBe(tree.max);
  });

  it('cutting a tree lowers what it brings', () => {
    const s = emptyGame();
    const b = gathererAt(s);
    s.feature[indexOf(s, 28, 30)] = 'olive';
    s.feature[indexOf(s, 28, 32)] = 'olive';
    const before = gatherYield(s, b);
    expect(clearCell(s, 28, 30)).toEqual({ ok: true });
    expect(gatherYield(s, b)).toBeCloseTo(before - tree.perCell);
  });

  it('with no trees shows the "no source" balloon, which goes away with one tree', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 2);
    const b = gathererAt(s);
    expect(balloonNeed(s, b)).toBe('noSource');
    s.feature[indexOf(s, 28, 30)] = 'olive';
    expect(balloonNeed(s, b)).toBeNull();
  });

  it('two gatherers by the same trees both count them', () => {
    const s = emptyGame();
    const a = gathererAt(s);
    const b = put(s, 'gatherer', EAST, 32);
    s.feature[indexOf(s, 28, 31)] = 'olive';
    s.feature[indexOf(s, 28, 33)] = 'palm';
    put(s, 'house', ROADSIDE, 27, 2); // 2 workers for 2 jobs
    expect(gatherCells(s, a)).toBe(2);
    expect(gatherCells(s, b)).toBe(2);
    expect(computeEconomy(s).foodMade).toBeCloseTo(4 * tree.perCell);
  });

  it('with no workers at all the workers balloon comes first', () => {
    const s = emptyGame();
    const b = gathererAt(s);
    expect(balloonNeed(s, b)).toBe('workers');
  });
});

describe('gathering (other kinds)', () => {
  it('buildings without a gather rule count no cells and bring nothing', () => {
    const s = emptyGame();
    const f = put(s, 'field', besideRiver(s, 30), 30);
    expect(gatherCells(s, f)).toBe(0);
    expect(gatherYield(s, f)).toBe(0);
  });
});

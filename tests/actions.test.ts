import { describe, expect, it } from 'vitest';
import { BUILDINGS, checkPlace, clearCell, createGame, createRng, dimsOf, GOALS, indexOf, onlyNeedsRoad, place, placeSpots, RULES } from '../src/core';
import { EAST, emptyGame, put, ROADSIDE, westOf } from './helpers';

describe('placing buildings', () => {
  it('charges the cost and occupies every cell of the footprint', () => {
    const s = emptyGame({ silver: 100 });
    expect(place(s, 'plaza', ROADSIDE, 30)).toEqual({ ok: true });
    expect(s.silver).toBe(100 - BUILDINGS.plaza.cost);
    const w = s.grid[indexOf(s, ROADSIDE, 30)]!;
    expect(w).toMatchObject({ kind: 'plaza', w: 2, h: 2, connected: true });
    expect(s.grid[indexOf(s, ROADSIDE + 1, 31)]).toBe(w);
    expect(s.grid[indexOf(s, ROADSIDE, 32)]).toBeNull();
  });

  it('uses the configured footprints', () => {
    const s = emptyGame();
    const dims = (kind: Parameters<typeof put>[1], x: number, y: number) => {
      const b = put(s, kind, x, y);
      return [b.w, b.h];
    };
    expect(dims('house', 1, 1)).toEqual([2, 2]);
    expect(dims('field', 4, 1)).toEqual([2, 2]);
    expect(dims('market', 8, 1)).toEqual([2, 4]);
    expect(dims('workshop', 11, 1)).toEqual([3, 3]);
  });

  it('rotates the market to 4x2; rotation does nothing on square buildings', () => {
    const s = emptyGame();
    const m = put(s, 'market', 1, 1, 0, true);
    expect([m.w, m.h]).toEqual([4, 2]);
    expect(s.grid[indexOf(s, 4, 2)]).toBe(m);
    expect(s.grid[indexOf(s, 1, 3)]).toBeNull();
    const f = put(s, 'field', 1, 5, 0, true);
    expect([f.w, f.h]).toEqual([2, 2]);
  });

  it('rejects invalid cells, missing silver and locked buildings', () => {
    const s = emptyGame({ silver: 12 });
    s.feature[indexOf(s, 2, 2)] = 'rock';
    put(s, 'house', 6, 1);
    expect(place(s, 'house', 1, 1)).toEqual({ ok: false, reason: 'invalid' }); // rock in the 2x2
    expect(place(s, 'house', 5, 1)).toEqual({ ok: false, reason: 'invalid' }); // overlaps a house
    expect(place(s, 'house', 23, 30)).toEqual({ ok: false, reason: 'invalid' }); // over the road
    expect(place(s, 'house', 46, 0)).toEqual({ ok: false, reason: 'invalid' }); // river
    expect(place(s, 'house', 47, 10)).toEqual({ ok: false, reason: 'invalid' }); // past the edge
    expect(place(s, 'house', -1, 0)).toEqual({ ok: false, reason: 'invalid' });
    expect(place(s, 'field', 10, 10)).toEqual({ ok: false, reason: 'silver' });
    s.unlocked = ['house'];
    expect(place(s, 'field', 10, 10)).toEqual({ ok: false, reason: 'locked' });
    expect(s.silver).toBe(12);
  });
});

describe('the temple site', () => {
  it('is never placed: the ruin stands from the start and no goal unlocks the temple tool', () => {
    const s = createGame(createRng(3));
    expect(s.buildings.filter((b) => b.kind === 'temple')).toHaveLength(1);
    expect(s.unlocked).not.toContain('temple');
    expect(GOALS.some((g) => g.unlock === 'temple')).toBe(false);
  });

  it('onlyNeedsRoad: free and paid for, but away from the network', () => {
    const s = emptyGame({ silver: 1000 });
    expect(onlyNeedsRoad(s, 'house', ROADSIDE - 1, 30)).toBe(true); // it could be built, cut off
    expect(onlyNeedsRoad(s, 'house', ROADSIDE, 30)).toBe(false);
    expect(onlyNeedsRoad(s, 'house', ROADSIDE + 1, 30)).toBe(false); // over the road: taken, not "needs a road"
    expect(onlyNeedsRoad(s, 'road', 2, 2)).toBe(false);
    s.silver = BUILDINGS.house.cost - 1;
    expect(onlyNeedsRoad(s, 'house', ROADSIDE - 1, 30)).toBe(false); // the silver is missing too
    s.silver = 1000;
    s.unlocked = s.unlocked.filter((k) => k !== 'house');
    expect(onlyNeedsRoad(s, 'house', ROADSIDE - 1, 30)).toBe(false);
  });

  it('lists house spots (tutorial) only on free land touching the connected network', () => {
    const s = emptyGame({ silver: 0 });
    const spots = placeSpots(s, 'house');
    expect(spots.length).toBeGreaterThan(0);
    expect(spots).toContainEqual({ x: ROADSIDE, y: 30 });
    expect(spots).not.toContainEqual({ x: ROADSIDE - 1, y: 30 }); // one cell away from the road
    const { w, h } = dimsOf('house');
    s.silver = 1e6;
    for (const o of spots) {
      expect(checkPlace(s, 'house', o.x, o.y)).toEqual({ ok: true });
      const touches = [...Array(w + 2)].some((_, dx) => [...Array(h + 2)].some((_, dy) => s.network[indexOf(s, o.x - 1 + dx, o.y - 1 + dy)]));
      expect(touches).toBe(true);
    }
  });
});

describe('placement spots', () => {
  it('lists rotated market spots that fit rotated, ignoring silver and locks', () => {
    const s = emptyGame({ silver: 0, unlocked: ['road'] });
    const up = placeSpots(s, 'market');
    const turned = placeSpots(s, 'market', true);
    expect(turned.length).toBeGreaterThan(0);
    expect(turned).not.toEqual(up);
    s.silver = 1e6;
    s.unlocked = ['market'];
    for (const o of turned) expect(checkPlace(s, 'market', o.x, o.y, true)).toEqual({ ok: true });
    // Upright, a 2x4 market fits beside the starting road.
    expect(up).toContainEqual({ x: westOf('market'), y: 30 });
  });
});

describe('clearing', () => {
  it('removes buildings and roads without refund and cuts trees for silver', () => {
    const s = emptyGame({ silver: 7 });
    put(s, 'plaza', ROADSIDE, 30);
    expect(clearCell(s, ROADSIDE + 1, 31)).toEqual({ ok: true }); // any cell of the footprint
    expect(s.grid[indexOf(s, ROADSIDE, 30)]).toBeNull();
    expect(s.coverage.plaza.some(Boolean)).toBe(false);
    expect(clearCell(s, 24, 46)).toEqual({ ok: true });
    expect(s.roads[indexOf(s, 24, 46)]).toBe(false);
    expect(s.silver).toBe(7);

    for (const tree of ['palm', 'olive'] as const) s.feature[indexOf(s, tree === 'palm' ? 2 : 3, 2)] = tree;
    expect(clearCell(s, 2, 2)).toEqual({ ok: true });
    expect(s.feature[indexOf(s, 2, 2)]).toBeNull();
    expect(s.silver).toBe(7 - RULES.treeClearCost);
    expect(clearCell(s, 3, 2)).toEqual({ ok: false, reason: 'silver' });

    s.feature[indexOf(s, 5, 2)] = 'rock';
    expect(clearCell(s, 5, 2)).toEqual({ ok: false, reason: 'invalid' });
    expect(clearCell(s, 6, 2)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('protects the altar, and the temple once its foundation began', () => {
    const s = emptyGame();
    put(s, 'temple', EAST, 30);
    s.temple = { done: 1, active: true, progress: 0 };
    expect(clearCell(s, 25, 25)).toEqual({ ok: false, reason: 'protected' });
    expect(clearCell(s, EAST + 3, 33)).toEqual({ ok: false, reason: 'protected' });
    expect(s.buildings.map((b) => b.kind)).toEqual(['altar', 'temple']);
  });
});

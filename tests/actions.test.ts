import { describe, expect, it } from 'vitest';
import { BUILDINGS, checkPlace, clearCell, dimsOf, indexOf, onlyNeedsRoad, place, placeSpots, RULES, templeRoadSpot, templeSpots, templeSpotsNear } from '../src/core';
import { EAST, emptyGame, put, road, ROADSIDE, westOf } from './helpers';

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

describe('temple placement', () => {
  it('occupies 6x6 cells and costs 800', () => {
    const s = emptyGame({ silver: 850 });
    expect(place(s, 'temple', EAST, 30)).toEqual({ ok: true });
    expect(s.silver).toBe(50);
    const t = s.grid[indexOf(s, EAST, 30)]!;
    expect(t).toMatchObject({ kind: 'temple', w: 6, h: 6, connected: true });
    expect(s.grid[indexOf(s, EAST + 5, 35)]).toBe(t);
    expect(s.grid[indexOf(s, EAST + 6, 35)]).toBeNull();
  });

  it('is invalid if any of its cells is blocked', () => {
    const s = emptyGame();
    s.feature[indexOf(s, EAST + 5, 35)] = 'rock';
    expect(checkPlace(s, 'temple', EAST, 30)).toEqual({ ok: false, reason: 'invalid' });
    expect(checkPlace(s, 'temple', 20, 30)).toEqual({ ok: false, reason: 'invalid' }); // over the road
    expect(checkPlace(s, 'temple', 40, 5)).toEqual({ ok: false, reason: 'invalid' }); // river / edge
  });

  it('must touch a connected road', () => {
    const s = emptyGame();
    expect(checkPlace(s, 'temple', EAST + 1, 30)).toEqual({ ok: false, reason: 'noRoad' });
    expect(checkPlace(s, 'temple', 18, 36)).toEqual({ ok: true }); // west side of the road
  });

  it('lists every spot where it fits, ignoring silver', () => {
    const s = emptyGame({ silver: 0 });
    const spots = templeSpots(s);
    expect(spots).toContainEqual({ x: EAST, y: 30 });
    expect(spots).toContainEqual({ x: 18, y: 36 });
    expect(spots).not.toContainEqual({ x: EAST + 1, y: 30 });
    s.silver = 1e6;
    for (const o of spots) expect(checkPlace(s, 'temple', o.x, o.y)).toEqual({ ok: true });
  });

  it('has no spot when no free 6x6 touches a connected road', () => {
    const s = emptyGame();
    s.feature = s.feature.map(() => 'rock');
    expect(templeSpots(s)).toEqual([]);
  });

  it('templeSpotsNear: touching the network is ready, one free cell away needs a road, two away is left out', () => {
    expect(RULES.templeSpotRoadGap).toBe(1);
    const s = emptyGame({ silver: 0 });
    const at = (x: number, y: number) => templeSpotsNear(s).find((o) => o.x === x && o.y === y);
    expect(at(EAST, 30)).toEqual({ x: EAST, y: 30, ready: true });
    expect(at(EAST + 1, 30)).toEqual({ x: EAST + 1, y: 30, ready: false }); // a 1-cell road at x = EAST links it
    expect(at(EAST + 2, 30)).toBeUndefined();
    road(s, [[EAST, 30]]);
    expect(at(EAST + 1, 30)).toEqual({ x: EAST + 1, y: 30, ready: true });
    // Every ready spot is a place the temple can be built; the others are not (yet).
    s.silver = 1e6;
    for (const o of templeSpotsNear(s)) expect(checkPlace(s, 'temple', o.x, o.y).ok, `${o.x},${o.y}`).toBe(o.ready);
    expect(templeSpotsNear(s).filter((o) => o.ready).length).toBe(templeSpots(s).length);
  });

  it('templeSpotsNear lists the spots nearest the altar first, and none over rocks', () => {
    const s = emptyGame();
    const a = { x: s.altar.x + 2, y: s.altar.y + 2 };
    const far = templeSpotsNear(s).map((o) => Math.abs(o.x + 3 - a.x) + Math.abs(o.y + 3 - a.y));
    expect(far).toEqual([...far].sort((p, q) => p - q));
    s.feature = s.feature.map(() => 'rock');
    expect(templeSpotsNear(s)).toEqual([]);
  });

  it('templeRoadSpot: with no area near the roads, the free place the shortest road reaches, and that road', () => {
    const s = emptyGame({ silver: 1e6 });
    const d = dimsOf('temple');
    // Rocks everywhere but one free 6x6 two cells east of the road at x = EAST - 1, and a 1-cell-wide path to it.
    s.feature = s.feature.map(() => 'rock');
    const fx = EAST + 2;
    for (let y = 30; y < 30 + d.h; y++) for (let x = fx; x < fx + d.w; x++) s.feature[indexOf(s, x, y)] = null;
    for (let x = EAST; x < fx; x++) s.feature[indexOf(s, x, 30)] = null;
    expect(templeSpotsNear(s)).toEqual([]);
    const far = templeRoadSpot(s)!;
    expect(far).toMatchObject({ x: fx, y: 30, ready: false });
    expect(far.road).toHaveLength(2);
    // Building that road makes it a ready spot, where the temple can be built.
    road(s, far.road.map((c) => [c.x, c.y] as [number, number]));
    expect(checkPlace(s, 'temple', fx, 30).ok).toBe(true);
    expect(templeRoadSpot(s)).toMatchObject({ ready: true, road: [] });
    s.feature = s.feature.map(() => 'rock');
    expect(templeRoadSpot(s)).toBeNull();
  });

  it('onlyNeedsRoad: free and paid for, but away from the network', () => {
    const s = emptyGame({ silver: 1000 });
    expect(onlyNeedsRoad(s, 'temple', EAST + 1, 30)).toBe(true);
    expect(onlyNeedsRoad(s, 'temple', EAST, 30)).toBe(false); // touches the road: it can be built
    expect(onlyNeedsRoad(s, 'house', ROADSIDE - 1, 30)).toBe(true); // it could be built, cut off
    expect(onlyNeedsRoad(s, 'house', ROADSIDE, 30)).toBe(false);
    expect(onlyNeedsRoad(s, 'house', ROADSIDE + 1, 30)).toBe(false); // over the road: taken, not "needs a road"
    expect(onlyNeedsRoad(s, 'road', 2, 2)).toBe(false);
    s.silver = BUILDINGS.temple.cost - 1;
    expect(onlyNeedsRoad(s, 'temple', EAST + 1, 30)).toBe(false); // the silver is missing too
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

  it('protects the altar and the temple', () => {
    const s = emptyGame();
    put(s, 'temple', EAST, 30);
    expect(clearCell(s, 25, 25)).toEqual({ ok: false, reason: 'protected' });
    expect(clearCell(s, EAST + 3, 33)).toEqual({ ok: false, reason: 'protected' });
    expect(s.buildings.map((b) => b.kind)).toEqual(['altar', 'temple']);
  });
});

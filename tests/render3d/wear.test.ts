import { describe, expect, it } from 'vitest';
import { indexOf, refreshCity } from '../../src/core';
import LOOK from '../../src/render3d/look3d.json';
import { doorOf, pathPairs, standMap, WEAR_RES, wearAt, wearMap } from '../../src/render3d/wear';
import { emptyGame, put } from '../helpers';

const W = LOOK.wear;

describe('trodden ground (wear map)', () => {
  it('has WEAR_RES samples per cell side, 0..1', () => {
    const s = emptyGame();
    const map = wearMap(s);
    expect(map.length).toBe(s.cols * WEAR_RES * s.rows * WEAR_RES);
    for (const v of map) expect(v >= 0 && v <= 1).toBe(true);
  });

  it("wears the ground before a lived-in house's door, not behind it", () => {
    const s = emptyGame();
    const h = put(s, 'house', 25, 27, 2); // right of the starting road (x = 24): its front faces west
    const door = doorOf(s, h);
    expect(door).toMatchObject({ x: 25, z: 28, fx: -1, fz: 0 });
    const map = wearMap(s);
    // Right before the door (on the road's border) it is well worn; at the back of the house nothing.
    expect(wearAt(s, map, 24.9, 28)).toBeGreaterThan(0.6);
    expect(wearAt(s, map, 27.3, 28)).toBe(0);
  });

  it('leaves no door patch for an empty plot', () => {
    const s = emptyGame();
    const plot = put(s, 'house', 30, 10); // level 0, away from roads
    const map = wearMap(s);
    const d = doorOf(s, plot);
    expect(wearAt(s, map, d.x + d.fx * 0.2, d.z + d.fz * 0.2)).toBe(0);
  });

  it('wears a soft border along the roads, fading with the distance', () => {
    const s = emptyGame();
    const map = wearMap(s);
    // The starting road runs down x = 24: its border at x = 25.05, 25.2 and 25.5 (beyond the reach).
    const y = 40.5;
    expect(s.roads[indexOf(s, 24, 40)]).toBe(true);
    const near = wearAt(s, map, 25.05, y);
    const mid = wearAt(s, map, 25.3, y);
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(0);
    expect(wearAt(s, map, 25 + W.road.reach + 0.1, y)).toBe(0);
  });

  it('keeps the border of a kerbed road cleaner than a common road', () => {
    expect(W.road.kerb).toBeLessThan(W.road.road);
    expect(W.road.loose).toBeLessThan(W.road.trail);
  });

  it('draws a faint path between houses 1 to 3 cells apart, not between neighbours or far ones', () => {
    const s = emptyGame();
    const a = put(s, 'house', 30, 10, 2);
    const b = put(s, 'house', 34, 10, 2); // a gap of 2 cells
    const c = put(s, 'house', 36, 10, 2); // touching b
    const d = put(s, 'house', 30, 20, 2); // 8 cells below a
    refreshCity(s);
    const pairs = pathPairs([a, b, c, d]).map(([p, q]) => [p.id, q.id]);
    expect(pairs).toContainEqual([a.id, b.id]);
    expect(pairs).not.toContainEqual([a.id, c.id]); // a gap of 4 cells
    expect(pairs).not.toContainEqual([b.id, c.id]);
    expect(pairs).not.toContainEqual([a.id, d.id]);
    const map = wearMap(s);
    // On the gap between a and b, along the line between their centres.
    expect(wearAt(s, map, 33, 11)).toBeGreaterThan(0.3);
    expect(wearAt(s, map, 33, 11.6)).toBe(0);
  });
});

describe('stand map (contact shadow)', () => {
  it('marks the cells under standing buildings, not fields, empty plots or open ground', () => {
    const s = emptyGame();
    put(s, 'house', 25, 27, 2);
    put(s, 'field', 25, 29);
    put(s, 'house', 25, 32);
    const m = standMap(s);
    expect(m[indexOf(s, 25, 32)]).toBe(0);
    expect(m[indexOf(s, 25, 27)]).toBe(1);
    for (let i = 0; i < m.length; i++) if (!s.grid[i]) expect(m[i]).toBe(0);
    expect(m[indexOf(s, 25, 29)]).toBe(0);
    expect(m[indexOf(s, 26, 30)]).toBe(0);
    const altar = s.buildings.find((b) => b.kind === 'altar')!;
    expect(m[indexOf(s, altar.x, altar.y)]).toBe(1);
  });
});

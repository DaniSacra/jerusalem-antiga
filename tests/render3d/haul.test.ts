import { describe, expect, it } from 'vitest';
import { createRng, doorsOf, indexOf, refreshCity } from '../../src/core';
import { edgeToward, haulJobs, legOf, toward, waitAfter, workSpot, HAUL } from '../../src/render3d/haul';
import { besideRiver, emptyGame, put, ROADSIDE } from '../helpers';

describe('the people of the food buildings (3D, as data)', () => {
  it('a fisher goes to the nearest river bank and back to the hut; only a connected one goes out', () => {
    const s = emptyGame();
    const b = put(s, 'fisher', besideRiver(s, 30), 30);
    refreshCity(s);
    b.connected = false;
    expect(haulJobs(s)).toEqual([]);
    b.connected = true;
    const spot = workSpot(s, b)!;
    expect(s.ground[indexOf(s, Math.floor(spot.x), Math.floor(spot.y))]).toBe('river');
    expect(haulJobs(s)).toContainEqual({ job: 'fish', home: b.id });
    const rng = createRng(3);
    const out = legOf(s, 'fish', b, true, [], rng);
    expect(out).toHaveLength(2);
    // Out from the hut's edge toward the bank (stopping short of the water), back the other way.
    expect(Math.hypot(out[1].x - spot.x, out[1].y - spot.y)).toBeCloseTo(0.62, 5);
    expect(legOf(s, 'fish', b, false, out, rng)).toEqual([out[1], out[0]]);
  });

  it('a carrier walks the roads from its field to the altar when there is no granary, and back the same way', () => {
    const s = emptyGame();
    put(s, 'field', ROADSIDE, 30);
    refreshCity(s);
    const b = s.buildings.find((o) => o.kind === 'field')!;
    const rng = createRng(5);
    const leg = legOf(s, 'harvest', b, true, [], rng);
    expect(leg.length).toBeGreaterThan(1);
    const altar = s.buildings.find((o) => o.kind === 'altar')!;
    const last = leg[leg.length - 1];
    expect(doorsOf(s, altar).some((d) => d.x + 0.5 === last.x && d.y + 0.5 === last.y)).toBe(true);
    expect(legOf(s, 'harvest', b, false, leg, rng)).toEqual([...leg].reverse());
  });

  it('nobody goes out from a building that gathers nothing, and none of the fishers or gatherers without a source', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 30);
    refreshCity(s);
    expect(haulJobs(s)).toEqual([]);
  });

  it('steps out at the footprint edge nearest the target; a point a set distance along a line', () => {
    const b = { x: 10, y: 10, w: 2, h: 2 } as Parameters<typeof edgeToward>[0];
    expect(edgeToward(b, { x: 20, y: 11 })).toEqual({ x: 12.3, y: 11 });
    expect(edgeToward(b, { x: 11, y: 0 })).toEqual({ x: 11, y: 9.7 });
    expect(toward({ x: 0, y: 0 }, { x: 3, y: 4 }, 1)).toEqual({ x: 0.6, y: 0.8 });
  });

  it('waits at the end of a leg within the numbers of visual.json', () => {
    const rng = createRng(9);
    for (let k = 0; k < 20; k++) {
      const w = waitAfter('fish', true, rng);
      expect(w).toBeGreaterThanOrEqual(HAUL.workSeconds[0]);
      expect(w).toBeLessThanOrEqual(HAUL.workSeconds[1]);
      const e = waitAfter('harvest', true, rng);
      expect(e).toBeGreaterThanOrEqual(HAUL.endWait[0]);
      expect(e).toBeLessThanOrEqual(HAUL.endWait[1]);
    }
  });
});

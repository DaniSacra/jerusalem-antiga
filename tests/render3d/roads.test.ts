import { describe, expect, it } from 'vitest';
import { addPerson, indexOf, refreshCity } from '../../src/core';
import { cityPlan, MODEL_KEYS } from '../../src/render3d/plan';
import { ROAD_KEYS, roadLevel, roadPieces, roadTraffic, turnTo } from '../../src/render3d/roads';
import LOOK from '../../src/render3d/look3d.json';
import { emptyGame, put, road } from '../helpers';

const R = LOOK.roads;

/** A house on the road down x = 24 with `n` people in it. */
function houseWith(s: ReturnType<typeof emptyGame>, y: number, n: number) {
  const h = put(s, 'house', 25, y, 1, false, 0);
  for (let k = 0; k < n; k++) addPerson(s, { sex: 'm', age: 30, houseId: h.id, caravan: 0, clan: 1 }, () => 0.5);
  return h;
}

describe('roads by the people who walk them', () => {
  it('counts the people of each building along its way to the altar, nothing past it', () => {
    const s = emptyGame();
    // The altar fills 22..25; its road goes down x = 24 from y = 27.
    houseWith(s, 40, 5);
    refreshCity(s);
    const t = roadTraffic(s);
    const at = (y: number) => t[indexOf(s, 24, y)];
    expect(at(40)).toBe(5);
    expect(at(30)).toBe(5);
    expect(at(27)).toBe(5);
    // Below the house nobody walks.
    expect(at(44)).toBe(0);
    houseWith(s, 30, 3);
    const u = roadTraffic(s);
    expect(u[indexOf(s, 24, 28)]).toBe(8);
    expect(u[indexOf(s, 24, 35)]).toBe(5);
  });

  it('draws a trail where few walk, a road on a common way and a kerbed road on a busy one', () => {
    const s = emptyGame();
    const t = new Float32Array(s.cols * s.rows);
    const i = indexOf(s, 24, 40);
    expect(roadLevel(s, t, 24, 40)).toBe(0);
    t[i] = R.road;
    expect(roadLevel(s, t, 24, 40)).toBe(1);
    t[i] = R.kerb;
    expect(roadLevel(s, t, 24, 40)).toBe(2);
    // Near the altar a road is never a trail.
    expect(roadLevel(s, t, 21, 21)).toBe(1);
    expect(roadLevel(s, t, 24, 27)).toBe(1);
    expect(roadLevel(s, t, 24, 28)).toBe(0);
  });

  it('joins a trail to the roads beside it and kerbs only the open sides of a busy road', () => {
    const s = emptyGame();
    // (24, 40) has roads above and below.
    const trail = roadPieces(s, 24, 40, 0);
    expect(trail.map((p) => p.key).sort()).toEqual(['trail', 'trail-arm', 'trail-arm']);
    expect(trail.filter((p) => p.key === 'trail-arm').map((p) => p.rot).sort()).toEqual([turnTo(0, 1), turnTo(0, -1)].sort());
    const kerbed = roadPieces(s, 24, 40, 2);
    expect(kerbed.filter((p) => p.key === 'kerb').map((p) => p.rot).sort()).toEqual([turnTo(1, 0), turnTo(-1, 0)].sort());
    // A busy road is paved with flagstones (no plain road under them), turned a quarter by the cell.
    expect(kerbed.filter((p) => p.key === 'flags')).toHaveLength(1);
    expect(kerbed.some((p) => p.key === 'road')).toBe(false);
    expect((kerbed.find((p) => p.key === 'flags')!.rot / (Math.PI / 2)) % 1).toBeCloseTo(0);
    // A common road: the road, a dark edge on each open side and wheel ruts toward each road beside it.
    const common = roadPieces(s, 24, 40, 1);
    expect(common.filter((p) => p.key !== 'road-stones').map((p) => p.key).sort()).toEqual(['road', 'road-edge', 'road-edge', 'ruts', 'ruts']);
    expect(common.filter((p) => p.key === 'road-edge').map((p) => p.rot).sort()).toEqual([turnTo(1, 0), turnTo(-1, 0)].sort());
    expect(common.filter((p) => p.key === 'ruts').map((p) => p.rot).sort()).toEqual([turnTo(0, 1), turnTo(0, -1)].sort());
    // A junction: no kerb or edge toward the new road, and ruts toward it.
    road(s, [[25, 40]]);
    expect(roadPieces(s, 24, 40, 2).filter((p) => p.key === 'kerb')).toHaveLength(1);
    expect(roadPieces(s, 24, 40, 1).filter((p) => p.key === 'road-edge')).toHaveLength(1);
    expect(roadPieces(s, 24, 40, 1).filter((p) => p.key === 'ruts')).toHaveLength(3);
    for (const k of ROAD_KEYS) expect(MODEL_KEYS).toContain(k);
  });

  it('the city plan draws the far end of a new road as a trail and a crowded street kerbed', () => {
    const s = emptyGame();
    for (let y = 30; y <= 42; y += 2) houseWith(s, y, 6);
    refreshCity(s);
    const keys = (y: number) => cityPlan(s).props.filter((p) => Math.floor(p.x) === 24 && Math.floor(p.z) === y).map((p) => p.key);
    expect(keys(46)).toContain('trail');
    expect(keys(29)).toContain('kerb');
    expect(keys(29)).toContain('flags');
  });

  it('dashes a road off the network: a dash in the middle and half dashes toward its road neighbours', () => {
    const s = emptyGame();
    // A loose road far from the starting one: three cells in a row, not joined to the altar.
    road(s, [[5, 40], [6, 40], [7, 40]]);
    expect(s.network[indexOf(s, 6, 40)]).toBe(false);
    const mid = roadPieces(s, 6, 40, 1);
    expect(mid.map((p) => p.key).sort()).toEqual(['loose', 'loose-arm', 'loose-arm']);
    expect(mid.filter((p) => p.key === 'loose-arm').map((p) => p.rot).sort()).toEqual([turnTo(1, 0), turnTo(-1, 0)].sort());
    // Whatever its traffic level, a loose road is never a full road, trail or kerb.
    for (const level of [0, 1, 2] as const) expect(roadPieces(s, 5, 40, level).map((p) => p.key).sort()).toEqual(['loose', 'loose-arm']);
    const plan = cityPlan(s).props.filter((p) => p.z > 40 && p.z < 41 && p.x < 8);
    expect(plan.every((p) => p.key === 'loose' || p.key === 'loose-arm')).toBe(true);
    // Joined to the network (down to the starting road), it is drawn as a road again.
    road(s, [...Array(19).keys()].map((k): [number, number] => [8 + k, 40]));
    expect(s.network[indexOf(s, 6, 40)]).toBe(true);
    expect(roadPieces(s, 6, 40, 1).map((p) => p.key)).toContain('road');
    for (const k of ['loose', 'loose-arm'] as const) expect(MODEL_KEYS).toContain(k);
  });
});

describe('stones on the common roads', () => {
  it('puts a few stones on a share of the common roads only', () => {
    const s = emptyGame();
    let stones = 0;
    let roads = 0;
    for (let y = 28; y < 48; y++) {
      if (!s.roads[indexOf(s, 24, y)]) continue;
      roads++;
      if (roadPieces(s, 24, y, 1).some((p) => p.key === 'road-stones')) stones++;
      expect(roadPieces(s, 24, y, 2).some((p) => p.key === 'road-stones')).toBe(false);
      expect(roadPieces(s, 24, y, 0).some((p) => p.key === 'road-stones')).toBe(false);
    }
    expect(stones).toBeGreaterThan(0);
    expect(stones).toBeLessThan(roads);
  });
});

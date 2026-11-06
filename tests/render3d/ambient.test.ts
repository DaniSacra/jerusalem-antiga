import { describe, expect, it } from 'vitest';
import { indexOf } from '../../src/core';
import { ambientCounts, ambientPlan, ambientPose } from '../../src/render3d/ambient';
import LOOK from '../../src/render3d/look3d.json';
import { emptyGame, put } from '../helpers';

const A = LOOK.ambient;

describe('the life around the town', () => {
  it('puts pigeons on the altar court and nothing else in an empty sandy town', () => {
    const s = emptyGame();
    const n = ambientCounts(ambientPlan(s));
    expect(n.pigeon).toBe(A.pigeons);
    expect(n.goat + n.chicken + n.sheep + n.donkey).toBe(0);
  });

  it('keeps a goat and two chickens by some tents and ties a donkey at each connected market', () => {
    const s = emptyGame();
    for (let y = 28; y <= 44; y += 2) put(s, 'house', 25, y, 1);
    const m = put(s, 'market', 22, 34);
    const spots = ambientPlan(s);
    const n = ambientCounts(spots);
    expect(n.goat).toBeGreaterThan(0);
    expect(n.goat).toBeLessThan(9);
    expect(n.chicken).toBe(n.goat * 2);
    expect(n.donkey).toBe(1);
    // Every animal stands on free ground: no building, road or river under it.
    for (const o of spots.filter((o) => o.kind !== 'pigeon' && o.kind !== 'boat')) {
      const i = indexOf(s, Math.floor(o.x), Math.floor(o.z));
      expect(s.roads[i] || s.ground[i] === 'river').toBe(false);
      if (o.kind === 'goat' || o.kind === 'donkey') expect(s.grid[i]).toBeNull();
    }
    m.connected = false;
    expect(ambientCounts(ambientPlan(s)).donkey).toBe(0);
  });

  it('grazes flocks of sheep on open grass near the altar, apart from each other', () => {
    const s = emptyGame();
    s.ground = s.ground.map((g) => (g === 'river' ? g : 'grass'));
    const sheep = ambientPlan(s).filter((o) => o.kind === 'sheep');
    expect(sheep).toHaveLength(A.flocks * A.flockSize);
    const altar = s.buildings[0];
    for (const o of sheep) expect(Math.hypot(o.x - (altar.x + 2), o.z - (altar.y + 2))).toBeLessThan(A.flockRadius + 1);
  });

  it('never has more animals than the cap', () => {
    const s = emptyGame();
    s.ground = s.ground.map((g) => (g === 'river' ? g : 'grass'));
    for (let y = 28; y <= 46; y += 2) for (const x of [20, 25, 28, 31]) put(s, 'house', x, y, 1);
    const n = ambientCounts(ambientPlan(s));
    expect(n.goat + n.chicken + n.sheep + n.donkey + n.pigeon).toBeLessThanOrEqual(A.maxAnimals);
  });

  it('floats boats on open water and kneels washerwomen on the bank facing the river', () => {
    const s = emptyGame();
    const spots = ambientPlan(s);
    const boats = spots.filter((o) => o.kind === 'boat');
    const washers = spots.filter((o) => o.kind === 'washer');
    expect(s.ground.includes('river')).toBe(true);
    expect(boats).toHaveLength(A.boats);
    expect(washers).toHaveLength(A.washers);
    for (const b of boats) expect(s.ground[indexOf(s, Math.floor(b.x), Math.floor(b.z))]).toBe('river');
    for (const w of washers) {
      const x = Math.floor(w.x);
      const y = Math.floor(w.z);
      expect(s.ground[indexOf(s, x, y)]).not.toBe('river');
      // The cell she faces is the river.
      expect(s.ground[indexOf(s, x + Math.round(Math.sin(w.yaw)), y + Math.round(Math.cos(w.yaw)))]).toBe('river');
    }
  });

  it('moves grazers within their range, flies pigeons up and back, and keeps tied ones in place', () => {
    const sheep = { kind: 'sheep' as const, x: 10, z: 10, range: 1, yaw: 0, k: 0.3 };
    for (let t = 0; t < 200; t += 3.7) {
      const p = ambientPose(sheep, t);
      expect(Math.hypot(p.x - 10, p.z - 10)).toBeLessThanOrEqual(1.2);
      expect(p.y).toBe(0);
    }
    const pigeon = { kind: 'pigeon' as const, x: 5, z: 5, range: 0.5, yaw: 0, k: 0 };
    const heights = Array.from({ length: 300 }, (_, i) => ambientPose(pigeon, (i / 300) * A.pigeonFlight).y);
    expect(Math.max(...heights)).toBeGreaterThan(1);
    expect(heights.filter((h) => h === 0).length).toBeGreaterThan(200);
    const donkey = { kind: 'donkey' as const, x: 3, z: 4, range: 0, yaw: 1, k: 0.5 };
    expect(ambientPose(donkey, 50)).toMatchObject({ x: 3, z: 4, y: 0 });
    const washer = { kind: 'washer' as const, x: 3, z: 4, range: 0, yaw: 1, k: 0.5 };
    expect(ambientPose(washer, 10).pitch).toBeGreaterThan(0.5);
  });
});

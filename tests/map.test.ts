import { describe, expect, it } from 'vitest';
import { altarRing, createGame, createRng, findPath, generateTerrain, indexOf, isReserved, isRiver, RULES } from '../src/core';

const { cols, rows } = RULES.map;

describe('map generation', () => {
  it('is 48 x 48 with a river along the east edge, 3 to 4 cells wide', () => {
    expect([cols, rows]).toEqual([48, 48]);
    for (let y = 0; y < rows; y++) {
      for (let k = 1; k <= 3; k++) expect(isRiver(cols - k, y)).toBe(true);
      expect(isRiver(cols - 5, y)).toBe(false);
    }
  });

  it.each([1, 2, 3, 42, 999])('places rocks and trees outside the reserved area and river (seed %i)', (seed) => {
    const { ground, feature } = generateTerrain(createRng(seed));
    expect(ground).toHaveLength(cols * rows);
    expect(feature.filter((f) => f === 'rock')).toHaveLength(RULES.map.rocks);
    expect(feature.filter((f) => f === 'olive')).toHaveLength(RULES.map.olives);
    expect(feature.filter((f) => f === 'palm')).toHaveLength(RULES.map.palms);
    expect(ground.includes('sand') && ground.includes('grass')).toBe(true);
    feature.forEach((f, i) => {
      const x = i % cols;
      const y = Math.floor(i / cols);
      if (isRiver(x, y)) expect(ground[i]).toBe('river');
      if (f) expect(isReserved(x, y) || isRiver(x, y)).toBe(false);
    });
  });

  it('keeps 9 cells free around the 4x4 altar and the starting road', () => {
    expect(isReserved(13, 13)).toBe(true);
    expect(isReserved(34, 34)).toBe(true);
    expect(isReserved(12, 24)).toBe(false);
    expect(isReserved(30, 35)).toBe(false);
    expect(isReserved(24, 47)).toBe(true); // road
    expect(isReserved(23, 47)).toBe(false);
  });

  it('starts with a 4x4 altar at the center and a road to the south edge (the entrance)', () => {
    const s = createGame(createRng(5));
    expect(s.silver).toBe(200);
    expect(s.food).toBe(30);
    expect(s.unlocked).toEqual(['road', 'house', 'field', 'well']);
    expect(s.buildings).toEqual([expect.objectContaining({ kind: 'altar', x: 22, y: 22, w: 4, h: 4, connected: true })]);
    expect(s.grid[indexOf(s, 25, 25)]?.kind).toBe('altar');
    expect(s.entrance).toEqual({ x: 24, y: 47 });
    for (let y = 26; y < 48; y++) expect(s.network[indexOf(s, 24, y)]).toBe(true);
    expect(s.network[indexOf(s, 22, 22)]).toBe(true); // altar cells start the network
  });

  it.each([1, 5, 42])('starts with a free, connected road ring around the altar (seed %i)', (seed) => {
    const s = createGame(createRng(seed));
    const ring = altarRing();
    expect(ring).toHaveLength(20); // the 6 x 6 perimeter of x, y = 21..26
    for (let y = 21; y <= 26; y++) {
      for (let x = 21; x <= 26; x++) {
        const i = indexOf(s, x, y);
        const onRing = x === 21 || x === 26 || y === 21 || y === 26;
        expect(ring.some((c) => c.x === x && c.y === y)).toBe(onRing);
        if (!onRing) continue;
        expect(s.roads[i] && s.network[i]).toBe(true);
        expect(s.feature[i]).toBeNull();
        expect(isReserved(x, y)).toBe(true);
      }
    }
    // Every ring cell is walkable from the entrance, and the south road still reaches it.
    for (const c of ring) expect(findPath(s, s.entrance, [c])).not.toBeNull();
    expect(findPath(s, s.entrance, [{ x: 24, y: 26 }])).toHaveLength(22);
    expect(s.silver).toBe(RULES.startSilver); // the starting roads are free
  });
});

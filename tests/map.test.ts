import { describe, expect, it } from 'vitest';
import { createGame, createRng, generateTerrain, indexOf, isReserved, isRiver, RULES } from '../src/core';

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
});

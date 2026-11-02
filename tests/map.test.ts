import { describe, expect, it } from 'vitest';
import { createGame, createRng, generateTerrain, indexOf, isReserved, isRiver, RULES } from '../src/core';

const { cols, rows } = RULES.map;

describe('map generation', () => {
  it('has a river along the east edge, 2 to 3 cells wide', () => {
    for (let y = 0; y < rows; y++) {
      expect(isRiver(cols - 1, y)).toBe(true);
      expect(isRiver(cols - 2, y)).toBe(true);
      expect(isRiver(cols - 4, y)).toBe(false);
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

  it('keeps 7 cells free around the altar and the starting road', () => {
    expect(isReserved(9, 9)).toBe(true);
    expect(isReserved(23, 23)).toBe(true);
    expect(isReserved(8, 16)).toBe(false);
    expect(isReserved(16, 31)).toBe(true);
    expect(isReserved(15, 31)).toBe(false);
  });

  it('starts with the altar at the center and a road to the south edge (the entrance)', () => {
    const s = createGame(createRng(5));
    expect(s.silver).toBe(200);
    expect(s.food).toBe(30);
    expect(s.unlocked).toEqual(['road', 'house', 'field', 'well']);
    expect(s.buildings).toEqual([expect.objectContaining({ kind: 'altar', x: 16, y: 16, size: 1, connected: true })]);
    expect(s.entrance).toEqual({ x: 16, y: 31 });
    for (let y = 17; y < 32; y++) expect(s.network[indexOf(s, 16, y)]).toBe(true);
    expect(s.network[indexOf(s, 16, 16)]).toBe(true);
  });
});

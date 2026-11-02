import { describe, expect, it } from 'vitest';
import { createRng, generateTerrain, isFreeArea, isValley, RULES } from '../src/core';

const { cols, rows } = RULES.map;

describe('map generation', () => {
  it('has the valley on the last column and rows 3-7 of the second-to-last', () => {
    for (let y = 0; y < rows; y++) {
      expect(isValley(cols - 1, y)).toBe(true);
      expect(isValley(cols - 2, y)).toBe(y >= 3 && y <= 7);
      expect(isValley(cols - 3, y)).toBe(false);
    }
  });

  it.each([1, 2, 3, 42, 999])('places 10 rocks and 18 trees outside the center and valley (seed %i)', (seed) => {
    const t = generateTerrain(createRng(seed));
    expect(t).toHaveLength(cols * rows);
    expect(t.filter((c) => c === 'rock')).toHaveLength(10);
    expect(t.filter((c) => c === 'tree')).toHaveLength(18);
    t.forEach((c, i) => {
      const x = i % cols;
      const y = Math.floor(i / cols);
      if (isValley(x, y)) expect(c).toBe('valley');
      else if (isFreeArea(x, y)) expect(c).toBe('grass');
    });
  });
});

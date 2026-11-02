import { RULES } from './data';
import { shuffle } from './rng';
import type { Rng, Terrain } from './types';

const { cols, rows, rocks, trees, freeArea, valley } = RULES.map;

/** Kidron Valley: the whole last column plus the second-to-last column in the configured rows. */
export function isValley(x: number, y: number): boolean {
  if (x === cols - 1) return true;
  return x === cols - 2 && y >= valley.partialRows[0] && y <= valley.partialRows[1];
}

export function isFreeArea(x: number, y: number): boolean {
  return x >= freeArea.x0 && x <= freeArea.x1 && y >= freeArea.y0 && y <= freeArea.y1;
}

export function generateTerrain(rng: Rng): Terrain[] {
  const terrain: Terrain[] = [];
  const candidates: number[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const valleyCell = isValley(x, y);
      terrain.push(valleyCell ? 'valley' : 'grass');
      if (!valleyCell && !isFreeArea(x, y)) candidates.push(y * cols + x);
    }
  }
  shuffle(candidates, rng);
  candidates.slice(0, rocks).forEach((i) => (terrain[i] = 'rock'));
  candidates.slice(rocks, rocks + trees).forEach((i) => (terrain[i] = 'tree'));
  return terrain;
}

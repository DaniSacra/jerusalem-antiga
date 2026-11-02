import { RULES } from './data';
import { shuffle } from './rng';
import type { Cell, Feature, Ground, Rng } from './types';

const { cols, rows, altar, clearRadius, rocks, olives, palms, grassShare, river } = RULES.map;

/** River width along the east edge for a given row (deterministic meander). */
export function riverWidth(y: number): number {
  const wave = Math.sin(y * 0.45) + Math.sin(y * 0.17 + 1);
  return wave > 0.4 ? river.maxWidth : river.minWidth;
}

export const isRiver = (x: number, y: number) => x >= cols - riverWidth(y);

/** The starting road runs straight south from the altar to the map edge. */
export const startRoad = (): Cell[] => Array.from({ length: rows - 1 - altar.y }, (_, k) => ({ x: altar.x, y: altar.y + 1 + k }));
export const entranceCell = (): Cell => ({ x: altar.x, y: rows - 1 });

/** Cells kept free of rocks and trees: around the altar and along the starting road. */
export function isReserved(x: number, y: number): boolean {
  const nearAltar = Math.max(Math.abs(x - altar.x), Math.abs(y - altar.y)) <= clearRadius;
  return nearAltar || (x === altar.x && y > altar.y);
}

export interface Terrain {
  ground: Ground[];
  feature: (Feature | null)[];
}

export function generateTerrain(rng: Rng): Terrain {
  const p = [rng(), rng(), rng()].map((v) => v * Math.PI * 2);
  const noise = (x: number, y: number) => Math.sin(x * 0.35 + p[0]) + Math.sin(y * 0.3 + p[1]) + Math.sin((x + y) * 0.21 + p[2]);
  const threshold = 3 - 6 * grassShare;

  const ground: Ground[] = [];
  const candidates: number[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const water = isRiver(x, y);
      ground.push(water ? 'river' : noise(x, y) > threshold ? 'grass' : 'sand');
      if (!water && !isReserved(x, y)) candidates.push(y * cols + x);
    }
  }
  const feature: (Feature | null)[] = new Array(cols * rows).fill(null);
  shuffle(candidates, rng);
  const counts: [Feature, number][] = [['rock', rocks], ['olive', olives], ['palm', palms]];
  let k = 0;
  for (const [f, n] of counts) for (let j = 0; j < n; j++) feature[candidates[k++]] = f;
  return { ground, feature };
}

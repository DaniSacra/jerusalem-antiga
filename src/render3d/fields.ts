import { indexOf, type GameState } from '../core';
import LOOK from './look3d.json';

/**
 * How moist the land is by the river (plano beleza C6), as plain data (no Three.js): 1 per cell up to
 * `near` cells from the water, fading to 0 at `far`. The crop shader reads it as a texture: in a
 * drought the fields away from the river grow thin and yellow, those by the water stay green. Pure
 * and tested; the river does not move, so it is built once with the terrain.
 */
const F = LOOK.fields;

export function moistMap(s: Pick<GameState, 'cols' | 'rows' | 'ground'>): Float32Array {
  const n = s.cols * s.rows;
  const dist = new Float32Array(n).fill(Infinity);
  // Breadth-first (8 neighbours) from every river cell.
  const queue: number[] = [];
  for (let i = 0; i < n; i++)
    if (s.ground[i] === 'river') {
      dist[i] = 0;
      queue.push(i);
    }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const x = i % s.cols;
    const y = (i - x) / s.cols;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= s.cols || ny >= s.rows) continue;
        const j = indexOf(s, nx, ny);
        if (dist[j] > dist[i] + 1) {
          dist[j] = dist[i] + 1;
          queue.push(j);
        }
      }
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.max(0, Math.min(1, (F.moistFar - dist[i]) / (F.moistFar - F.moistNear)));
  return out;
}

import { indexOf, type GameState } from '../core';
import LOOK from './look3d.json';
import { hash } from './plan';
import { wearAt } from './wear';

/**
 * Small ground detail (plano beleza C4), as plain data (no Three.js): tufts of grass on the grass
 * cells and pebbles on some sand cells, on open ground only (not on roads, buildings, trees, rocks or
 * the river) and never on trodden ground (`wear`); by the river near the town (plano beleza C6),
 * clumps of reeds at the water's edge and a few bigger stones (the tuft and pebble models, larger: no
 * new draw calls). Pure and tested; built again with the city and drawn in one instanced layer that
 * the stage hides from far away and at the minimum quality.
 */
const D = LOOK.detail;
const SIDES: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

export interface DetailPiece {
  key: 'tuft' | 'pebbles' | 'flowers' | 'flowers-b';
  x: number;
  z: number;
  rot: number;
  scale: number;
}

/** How much a patch of flowers blooms around cell (x, y): 0 .. 2.5, slow noise so the patches are a few cells wide. */
function flowerPatch(x: number, y: number): number {
  const n = Math.sin(x * 0.37 + 1.3) * Math.sin(y * 0.41 - 0.6) + Math.sin((x + y) * 0.19 + 2.0) * 0.6;
  return Math.max(0, n - 0.1) * 2.2;
}

export function groundDetail(s: GameState, wear: Float32Array): DetailPiece[] {
  const out: DetailPiece[] = [];
  const open = (x: number, z: number) => wearAt(s, wear, x, z) < D.wornOut;
  const altar = s.buildings.find((b) => b.kind === 'altar');
  const ax = altar ? altar.x + altar.w / 2 : s.cols / 2;
  const az = altar ? altar.y + altar.h / 2 : s.rows / 2;
  const river = (x: number, y: number) => x >= 0 && y >= 0 && x < s.cols && y < s.rows && s.ground[indexOf(s, x, y)] === 'river';
  for (let y = 0; y < s.rows; y++)
    for (let x = 0; x < s.cols; x++) {
      const i = indexOf(s, x, y);
      if (s.roads[i] || s.grid[i] || s.feature[i] || s.ground[i] === 'river') continue;
      // The bank near the town: reeds along each side that meets the water, now and then a stone.
      if (Math.hypot(x + 0.5 - ax, y + 0.5 - az) <= D.bankReach)
        for (const [dx, dy] of SIDES) {
          if (!river(x + dx, y + dy)) continue;
          const k = dx * 7 + dy * 3;
          const along = 0.15 + hash(x, y, 91 + k) * 0.7;
          const px = x + 0.5 + dx * 0.48 + (dy !== 0 ? along - 0.5 : 0);
          const pz = y + 0.5 + dy * 0.48 + (dx !== 0 ? along - 0.5 : 0);
          if (hash(x, y, 92 + k) < D.reedShare) out.push({ key: 'tuft', x: px, z: pz, rot: hash(x, y, 93 + k) * 6.28, scale: D.reedScale * (0.8 + hash(x, y, 94 + k) * 0.5) });
          else if (hash(x, y, 95 + k) < D.stoneShare) out.push({ key: 'pebbles', x: px - dx * 0.15, z: pz - dy * 0.15, rot: hash(x, y, 96 + k) * 6.28, scale: D.stoneScale });
        }
      // Tall grass at the edge of what is built (roads, houses) and of the trees and rocks: the clumps
      // stand on the side that meets it, so the lawn seems to grow into the road and round the walls.
      for (const [dx, dy] of SIDES) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= s.cols || yy >= s.rows) continue;
        const j = indexOf(s, xx, yy);
        if (!(s.roads[j] || s.grid[j] || s.feature[j]) || hash(x, y, 70 + dx * 3 + dy) >= D.edgeShare) continue;
        for (let k = 0; k < 2; k++) {
          const along = 0.1 + hash(x + k, y, 71 + dx + dy * 5) * 0.8;
          const px = x + 0.5 + dx * (0.2 + hash(x, y + k, 72) * 0.26) + (dy !== 0 ? along - 0.5 : 0);
          const pz = y + 0.5 + dy * (0.2 + hash(x + k, y, 73) * 0.26) + (dx !== 0 ? along - 0.5 : 0);
          if (wearAt(s, wear, px, pz) < D.edgeWorn) out.push({ key: 'tuft', x: px, z: pz, rot: hash(x + k, y + k, 74) * 6.28, scale: D.edgeScale[0] + hash(x, y, 75 + k) * (D.edgeScale[1] - D.edgeScale[0]) });
        }
      }
      const lawn = s.ground[i] === 'grass';
      // Clumps of grass: a few tufts close together (they read as one fuller tuft), not single blades.
      if (hash(x, y, 80) < (lawn ? D.tuftShare : D.meadowTuftShare)) {
        const cx = x + 0.2 + hash(x, y, 82) * 0.6;
        const cz = y + 0.2 + hash(x, y, 83) * 0.6;
        const n = 2 + Math.floor(hash(x, y, 81) * (lawn ? D.tuftsMax : D.meadowTuftsMax));
        for (let k = 0; k < n; k++) {
          const a = hash(x + k, y, 84) * 6.28;
          const px = cx + Math.cos(a) * 0.17 * (k > 0 ? 1 : 0);
          const pz = cz + Math.sin(a) * 0.17 * (k > 0 ? 1 : 0);
          if (open(px, pz)) out.push({ key: 'tuft', x: px, z: pz, rot: hash(x + k, y + k, 85) * 6.28, scale: 0.8 + hash(x, y, 86 + k) * 0.6 });
        }
      }
      // Wild flowers, in patches: a share of the cells, more where the (slow) noise says a meadow is in bloom.
      const bloom = flowerPatch(x, y);
      if (lawn && hash(x, y, 60) < D.flowerShare * bloom) {
        const px = x + 0.2 + hash(x, y, 61) * 0.6;
        const pz = y + 0.2 + hash(x, y, 62) * 0.6;
        if (open(px, pz)) out.push({ key: hash(x, y, 63) < 0.5 ? 'flowers' : 'flowers-b', x: px, z: pz, rot: hash(x, y, 64) * 6.28, scale: 1 + hash(x, y, 65) * 0.5 });
      }
      if (!lawn && hash(x, y, 98) < D.pebbleShare) {
        const px = x + 0.2 + hash(x, y, 87) * 0.6;
        const pz = y + 0.2 + hash(x, y, 88) * 0.6;
        if (open(px, pz)) out.push({ key: 'pebbles', x: px, z: pz, rot: hash(x, y, 89) * 6.28, scale: 0.8 + hash(x, y, 90) * 0.6 });
      }
    }
  return out;
}

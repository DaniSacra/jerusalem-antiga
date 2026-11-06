import { indexOf, type Building, type GameState } from '../core';
import LOOK from './look3d.json';
import { facing } from './plan';
import { roadLevel, roadTraffic, sacredOf } from './roads';

/**
 * Where the ground is trodden (plano beleza C4), as plain data (no Three.js): a map of `WEAR_RES`
 * samples per cell side, 0 (untouched sand or grass) .. 1 (bare trodden earth). The terrain shader
 * blends its earth colour by it (`Terrain.setWear`). Pure and tested; built again when the city changes.
 *
 * - before the door of each lived-in house and each workplace, a half disc of trodden earth;
 * - along the roads, a soft worn border (wider on a trail and a common road; a kerbed road keeps its
 *   border clean, a road off the network hardly wears);
 * - between houses 1 to 3 cells apart, a faint path (as the 2D drew them).
 */
const W = LOOK.wear;
export const WEAR_RES = W.res;

/** Kinds with no door patch: fields are soil, the altar, temple, plaza and park have their own ground. */
const NO_DOOR = new Set(['field', 'altar', 'temple', 'plaza', 'park']);

/** The trodden map of `s`: (cols * WEAR_RES) x (rows * WEAR_RES) samples, row by row (z), 0..1. */
export function wearMap(s: GameState): Float32Array {
  const res = WEAR_RES;
  const w = s.cols * res;
  const h = s.rows * res;
  const out = new Float32Array(w * h);
  /** Raises the samples whose centre is in [x0, x1] x [z0, z1] (world units) to `f` there. */
  const stamp = (x0: number, z0: number, x1: number, z1: number, f: (x: number, z: number) => number) => {
    const i0 = Math.max(0, Math.floor(x0 * res));
    const i1 = Math.min(w - 1, Math.ceil(x1 * res));
    const j0 = Math.max(0, Math.floor(z0 * res));
    const j1 = Math.min(h - 1, Math.ceil(z1 * res));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const v = f((i + 0.5) / res, (j + 0.5) / res);
        const k = j * w + i;
        if (v > out[k]) out[k] = Math.min(1, v);
      }
  };

  // Roads: a worn border fading out over `reach` from the road's cell.
  const traffic = roadTraffic(s);
  const sacred = sacredOf(s);
  const R = W.road;
  for (let y = 0; y < s.rows; y++)
    for (let x = 0; x < s.cols; x++) {
      const i = indexOf(s, x, y);
      if (!s.roads[i]) continue;
      const level = s.network[i] ? roadLevel(s, traffic, x, y, sacred) : -1;
      const k = level < 0 ? R.loose : level === 0 ? R.trail : level === 1 ? R.road : R.kerb;
      stamp(x - R.reach, y - R.reach, x + 1 + R.reach, y + 1 + R.reach, (px, pz) => {
        const d = Math.hypot(Math.max(x - px, 0, px - x - 1), Math.max(y - pz, 0, pz - y - 1));
        return k * Math.max(0, 1 - d / R.reach);
      });
    }

  // Doors: a half disc of trodden earth before the front of lived-in houses and workplaces.
  const D = W.door;
  for (const b of s.buildings) {
    if (s.grid[indexOf(s, b.x, b.y)] !== b || NO_DOOR.has(b.kind)) continue;
    if (b.kind === 'house' && b.level < 1) continue;
    const k = b.kind === 'house' ? D.house : D.work;
    const door = doorOf(s, b);
    stamp(door.x - D.reach, door.z - D.reach, door.x + D.reach, door.z + D.reach, (px, pz) => {
      const dx = px - door.x;
      const dz = pz - door.z;
      // In front of the wall only (a little round its corners).
      if (dx * door.fx + dz * door.fz < -0.08) return 0;
      const d = Math.hypot(dx, dz) / D.reach;
      return k * Math.max(0, 1 - d * d);
    });
  }

  // Paths between houses standing 1 to 3 cells apart, centre to centre.
  const P = W.path;
  const houses = s.buildings.filter((b) => b.kind === 'house' && b.level >= 1 && s.grid[indexOf(s, b.x, b.y)] === b);
  for (const [a, b] of pathPairs(houses)) {
    const ax = a.x + a.w / 2;
    const az = a.y + a.h / 2;
    const bx = b.x + b.w / 2;
    const bz = b.y + b.h / 2;
    const len2 = (bx - ax) ** 2 + (bz - az) ** 2;
    stamp(Math.min(ax, bx) - P.width, Math.min(az, bz) - P.width, Math.max(ax, bx) + P.width, Math.max(az, bz) + P.width, (px, pz) => {
      const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (pz - az) * (bz - az)) / len2));
      const d = Math.hypot(px - ax - t * (bx - ax), pz - az - t * (bz - az));
      // A full middle half as wide, fading to nothing at `width`.
      return P.strength * Math.min(1, Math.max(0, (P.width - d) / (P.width / 2)));
    });
  }
  return out;
}

/** The pairs of houses with a gap of `gapMin`..`gapMax` cells between their footprints. */
export function pathPairs(houses: readonly Building[]): [Building, Building][] {
  const out: [Building, Building][] = [];
  for (let i = 0; i < houses.length; i++)
    for (let j = i + 1; j < houses.length; j++) {
      const a = houses[i];
      const b = houses[j];
      const gap = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h));
      if (gap >= W.path.gapMin && gap <= W.path.gapMax) out.push([a, b]);
    }
  return out;
}

/** The middle of a building's front edge (world x, z) and the way its front faces (fx, fz). */
export function doorOf(s: GameState, b: Building): { x: number; z: number; fx: number; fz: number } {
  const rot = facing(s, b);
  const fx = Math.round(Math.sin(rot));
  const fz = Math.round(Math.cos(rot));
  // Half the footprint along the way it faces.
  const half = fx !== 0 ? b.w / 2 : b.h / 2;
  return { x: b.x + b.w / 2 + fx * half, z: b.y + b.h / 2 + fz * half, fx, fz };
}

/** The wear at a world point (nearest sample; 0 off the map). */
export function wearAt(s: Pick<GameState, 'cols' | 'rows'>, map: Float32Array, x: number, z: number): number {
  const i = Math.floor(x * WEAR_RES);
  const j = Math.floor(z * WEAR_RES);
  const w = s.cols * WEAR_RES;
  if (i < 0 || j < 0 || i >= w || j >= s.rows * WEAR_RES) return 0;
  return map[j * w + i];
}

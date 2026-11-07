import { indexOf, type GameState } from '../core';
import type { HerdKind } from './animals';
import LOOK from './look3d.json';
import { hash } from './plan';
import { PEN, penAnimals } from './works';

/**
 * The life around the town, as plain data (no Three.js): where the animals, boats and washerwomen
 * stay. Goats and chickens by the tents, a donkey tied at each market, flocks of sheep on the open
 * grass near the altar, pigeons on the altar court, the offerings' flock in the restored altar's pen, fishing boats and washerwomen on the river
 * nearest the town. Only a sight; tested in tests/render3d/ambient.test.ts. `pasture.ts` draws and
 * moves them.
 */
export type AmbientKind = HerdKind | 'washer';

export interface AmbientSpot {
  kind: AmbientKind;
  /** Where it stays (cell units, centres at +0.5). */
  x: number;
  z: number;
  /** How far it wanders from there (0: tied or kneeling). */
  range: number;
  /** Facing when it stands still (radians about y; the washerwomen face the water). */
  yaw: number;
  /** 0..1, stable: the phase of its motion. */
  k: number;
}

const A = LOOK.ambient;
const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** A cell nobody uses: no building, road, tree or rock, and not the river. */
const free = (s: GameState, x: number, y: number) => {
  if (x < 0 || y < 0 || x >= s.cols || y >= s.rows) return false;
  const i = indexOf(s, x, y);
  return !s.grid[i] && !s.roads[i] && !s.feature[i] && s.ground[i] !== 'river';
};

export function ambientPlan(s: GameState): AmbientSpot[] {
  const out: AmbientSpot[] = [];
  const altar = s.buildings.find((b) => b.kind === 'altar');
  const cx = altar ? altar.x + altar.w / 2 : s.cols / 2;
  const cz = altar ? altar.y + altar.h / 2 : s.rows / 2;
  const animals = () => out.filter((o) => o.kind !== 'boat' && o.kind !== 'washer').length;
  const add = (o: AmbientSpot) => {
    if (o.kind !== 'boat' && o.kind !== 'washer' && animals() >= A.maxAnimals) return;
    out.push(o);
  };

  // Pigeons on the altar court.
  if (altar) for (let k = 0; k < A.pigeons; k++) add({ kind: 'pigeon', x: cx + (hash(k, 1, 40) - 0.5) * 3, z: cz + (hash(k, 2, 40) - 0.5) * 3, range: 0.5, yaw: hash(k, 3, 40) * 6.28, k: hash(k, 4, 40) });

  // The offerings' flock in the restored altar's pen (works.ts), sheep and a goat.
  if (altar)
    for (let k = 0; k < penAnimals(s); k++)
      add({ kind: k % 3 === 2 ? 'goat' : 'sheep', x: cx + PEN.x + (hash(k, 1, 52) - 0.5) * PEN.w * 0.6, z: cz + PEN.z + (hash(k, 2, 52) - 0.5) * PEN.d * 0.6, range: 0.2, yaw: hash(k, 3, 52) * 6.28, k: hash(k, 4, 52) });

  for (const b of s.buildings) {
    // Every other lived-in tent keeps a goat and two chickens on the free ground beside it.
    if (b.kind === 'house' && b.level === 1 && hash(b.x, b.y, 41) < A.tentShare) {
      const spot = besideOf(s, b);
      if (!spot) continue;
      add({ kind: 'goat', x: spot.x + 0.5, z: spot.z + 0.5, range: 0.35, yaw: hash(b.x, b.y, 42) * 6.28, k: hash(b.x, b.y, 43) });
      for (let c = 0; c < 2; c++) add({ kind: 'chicken', x: spot.x + 0.3 + c * 0.4, z: spot.z + 0.7, range: 0.3, yaw: c * 2, k: hash(b.x + c, b.y, 44) });
    }
    // A donkey tied beside each market.
    if (b.kind === 'market' && b.connected) {
      const spot = besideOf(s, b);
      if (spot) add({ kind: 'donkey', x: spot.x + 0.5, z: spot.z + 0.5, range: 0, yaw: hash(b.x, b.y, 45) * 6.28, k: hash(b.x, b.y, 46) });
    }
  }

  // Flocks of sheep on open grass near the altar: the free grass cells far enough apart.
  const grass: { x: number; y: number; d: number }[] = [];
  for (let y = 0; y < s.rows; y++)
    for (let x = 0; x < s.cols; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cz);
      if (d <= A.flockRadius && d > 5 && s.ground[indexOf(s, x, y)] === 'grass' && free(s, x, y) && N4.every(([dx, dy]) => free(s, x + dx, y + dy))) grass.push({ x, y, d });
    }
  grass.sort((a, b) => hash(a.x, a.y, 47) - hash(b.x, b.y, 47));
  const flocks: { x: number; y: number }[] = [];
  for (const g of grass) {
    if (flocks.length >= A.flocks) break;
    if (flocks.some((f) => Math.hypot(f.x - g.x, f.y - g.y) < 6)) continue;
    flocks.push(g);
    for (let k = 0; k < A.flockSize; k++) add({ kind: 'sheep', x: g.x + 0.5 + (hash(g.x, k, 48) - 0.5), z: g.y + 0.5 + (hash(g.y, k, 49) - 0.5), range: 1, yaw: hash(g.x, k, 50) * 6.28, k: hash(g.y, k, 51) });
  }

  // The river nearest the town: boats on the water, washerwomen kneeling on the bank, facing it.
  const water: { x: number; y: number; d: number }[] = [];
  const bank: { x: number; y: number; d: number; yaw: number }[] = [];
  for (let y = 0; y < s.rows; y++)
    for (let x = 0; x < s.cols; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cz);
      if (s.ground[indexOf(s, x, y)] === 'river') {
        // A boat needs water all around it.
        if (N4.every(([dx, dy]) => x + dx >= 0 && y + dy >= 0 && x + dx < s.cols && y + dy < s.rows && s.ground[indexOf(s, x + dx, y + dy)] === 'river')) water.push({ x, y, d });
      } else if (free(s, x, y)) {
        const w = N4.find(([dx, dy]) => x + dx >= 0 && y + dy >= 0 && x + dx < s.cols && y + dy < s.rows && s.ground[indexOf(s, x + dx, y + dy)] === 'river');
        if (w) bank.push({ x, y, d, yaw: Math.atan2(w[0], w[1]) });
      }
    }
  const spaced = <T extends { x: number; y: number; d: number }>(list: T[], n: number, gap: number): T[] => {
    const got: T[] = [];
    for (const c of [...list].sort((a, b) => a.d - b.d)) {
      if (got.length >= n) break;
      if (got.every((o) => Math.hypot(o.x - c.x, o.y - c.y) >= gap)) got.push(c);
    }
    return got;
  };
  for (const w of spaced(water, A.boats, 5)) out.push({ kind: 'boat', x: w.x + 0.5, z: w.y + 0.5, range: 0.6, yaw: hash(w.x, w.y, 52) * 6.28, k: hash(w.x, w.y, 53) });
  for (const b of spaced(bank, A.washers, 2)) out.push({ kind: 'washer', x: b.x + 0.5, z: b.y + 0.5, range: 0, yaw: b.yaw, k: hash(b.x, b.y, 54) });
  return out;
}

/** A free cell next to a building's footprint (the first in a stable order), or null. */
function besideOf(s: GameState, b: { x: number; y: number; w: number; h: number }): { x: number; z: number } | null {
  const ring: { x: number; z: number }[] = [];
  for (let x = b.x - 1; x <= b.x + b.w; x++) ring.push({ x, z: b.y - 1 }, { x, z: b.y + b.h });
  for (let y = b.y; y < b.y + b.h; y++) ring.push({ x: b.x - 1, z: y }, { x: b.x + b.w, z: y });
  ring.sort((p, q) => hash(p.x, p.z, 55) - hash(q.x, q.z, 55));
  return ring.find((c) => free(s, c.x, c.z)) ?? null;
}

/** How many of each kind (for the meshes' sizes). */
export function ambientCounts(spots: AmbientSpot[]): Record<AmbientKind, number> {
  const out = { donkey: 0, sheep: 0, goat: 0, chicken: 0, pigeon: 0, boat: 0, washer: 0 } as Record<AmbientKind, number>;
  for (const o of spots) out[o.kind]++;
  return out;
}

/** Where a spot is at `time` (seconds) and how it holds itself. `y` is above the ground (the water for a boat). */
export interface AmbientPose {
  x: number;
  z: number;
  y: number;
  yaw: number;
  /** Head down (grazing, pecking) or a washerwoman bent over the water. */
  pitch: number;
  roll: number;
}

/** Wander speed (radians a second along its loop) of the grazing kinds. */
const WANDER: Partial<Record<AmbientKind, number>> = { sheep: 0.07, goat: 0.12, chicken: 0.25, pigeon: 0.3 };

/**
 * The motion of each spot: grazers walk a slow loop around their place, heads down now and then
 * (chickens and pigeons peck quickly); pigeons fly up in an arc every `pigeonFlight` seconds and
 * land; a boat drifts a little along its heading, bobbing and rocking; a tied donkey shifts its
 * weight; a washerwoman bends over the water and scrubs.
 */
export function ambientPose(o: AmbientSpot, time: number): AmbientPose {
  const ph = o.k * 6.283;
  if (o.kind === 'boat') {
    const d = Math.sin(time * 0.05 + ph) * o.range;
    return { x: o.x + Math.sin(o.yaw) * d, z: o.z + Math.cos(o.yaw) * d, y: Math.sin(time * 1.3 + ph) * 0.015, yaw: o.yaw + Math.sin(time * 0.1 + ph) * 0.15, pitch: 0, roll: Math.sin(time * 1.1 + ph) * 0.05 };
  }
  if (o.kind === 'washer') return { x: o.x, z: o.z, y: 0, yaw: o.yaw, pitch: 0.55 + Math.max(0, Math.sin(time * 2.2 + ph)) * 0.3, roll: 0 };
  if (o.kind === 'donkey') return { x: o.x, z: o.z, y: 0, yaw: o.yaw + Math.sin(time * 0.2 + ph) * 0.2, pitch: Math.max(0, Math.sin(time * 0.4 + ph)) * 0.15, roll: Math.sin(time * 0.6 + ph) * 0.02 };
  const w = WANDER[o.kind] ?? 0.1;
  const a = time * w + ph;
  const x = o.x + Math.sin(a) * o.range;
  const z = o.z + Math.sin(a * 2) * o.range * 0.5;
  // Heading along the loop (its derivative).
  const yaw = Math.atan2(Math.cos(a), Math.cos(a * 2));
  const peck = o.kind === 'chicken' || o.kind === 'pigeon';
  const pitch = peck ? Math.max(0, Math.sin(time * 5 + ph * 3)) * 0.6 : Math.sin(time * 0.6 + ph * 5) > 0.3 ? 0.35 : 0;
  if (o.kind === 'pigeon') {
    const u = (time / A.pigeonFlight + o.k) % 1;
    if (u > 0.85) {
      const f = (u - 0.85) / 0.15;
      return { x: x + Math.sin(f * 6.283) * 1.6, z: z + (1 - Math.cos(f * 6.283)) * 0.8, y: Math.sin(f * Math.PI) * 1.6, yaw: yaw + f * 6.283, pitch: 0, roll: 0.3 };
    }
  }
  return { x, z, y: 0, yaw, pitch, roll: 0 };
}

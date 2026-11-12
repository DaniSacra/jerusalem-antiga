import { crewCounts, indexOf, RULES, seasonOf, type Building, type GameState } from '../core';
import type { HerdKind } from './animals';
import LOOK from './look3d.json';
import { facing, hash, SHELTER_AT } from './plan';
import { PEN, penAnimals } from './works';

/**
 * The life around the town, as plain data (no Three.js): where the animals, boats and washerwomen
 * stay. Goats and chickens by the tents, a donkey tied at each market, flocks of sheep on the open
 * grass near the altar, each pasture's flock on the grass around it (huddled at its shelter in
 * winter) with its shepherd, pigeons on the altar court, the offerings' flock in the restored altar's pen, fishing boats and washerwomen on the river
 * nearest the town. Only a sight; tested in tests/render3d/ambient.test.ts. `pasture.ts` draws and
 * moves them.
 */
export type AmbientKind = HerdKind | 'washer' | 'shepherd';

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
/** The kinds drawn as people (figures), not as a herd. */
export const PEOPLE: readonly AmbientKind[] = ['washer', 'shepherd'];

/** Sheep and goats around each pasture: the city's livestock as a share of the most it keeps, up to `pastureFlock`. */
export function pastureFlock(s: Pick<GameState, 'livestock'>): number {
  return s.livestock > 0 ? Math.ceil(Math.min(1, s.livestock / RULES.livestockStorage) * A.pastureFlock) : 0;
}

/** What the pastures' flocks look like now (the city is drawn again when it changes; diff.ts). */
export const herdKey = (s: GameState) => (s.buildings.some((b) => b.kind === 'pasture') ? `${pastureFlock(s)}:${seasonOf(s.week) === 'winter' ? 1 : 0}` : '');

/**
 * A pasture's flock and its shepherd (one with a crew): on the free grass cells of its radius, in a
 * stable order; in winter all of them under the shelter.
 */
function pastureSpots(s: GameState, b: Building, n: number, staffed: boolean, add: (o: AmbientSpot) => void) {
  const rot = facing(s, b);
  const mx = b.x + b.w / 2;
  const mz = b.y + b.h / 2;
  const sx = mx + SHELTER_AT[0] * Math.cos(rot) + SHELTER_AT[1] * Math.sin(rot);
  const sz = mz - SHELTER_AT[0] * Math.sin(rot) + SHELTER_AT[1] * Math.cos(rot);
  const winter = seasonOf(s.week) === 'winter';
  const grass: { x: number; y: number }[] = [];
  for (let y = b.y - 2; y < b.y + b.h + 2; y++) for (let x = b.x - 2; x < b.x + b.w + 2; x++) if (free(s, x, y) && s.ground[indexOf(s, x, y)] === 'grass') grass.push({ x, y });
  grass.sort((p, q) => hash(p.x, p.y, 56) - hash(q.x, q.y, 56));
  // Inside the fence when the grass around is grazed out (or none).
  const spots = grass.length ? grass.map((g) => ({ x: g.x + 0.5, z: g.y + 0.5, range: 0.4 })) : [{ x: mx + 0.4, z: mz + 0.3, range: 0.6 }];
  for (let k = 0; k < n; k++) {
    const g = spots[k % spots.length];
    const kind = k % 4 === 3 ? 'goat' : 'sheep';
    const j = (hash(b.id, k, 57) - 0.5) * 0.5;
    if (winter) add({ kind, x: sx + j, z: sz + (hash(b.id, k, 58) - 0.5) * 0.5, range: 0.08, yaw: hash(b.id, k, 59) * 6.28, k: hash(b.id, k, 60) });
    else add({ kind, x: g.x + j * 0.6, z: g.z + (hash(b.id, k, 58) - 0.5) * 0.4, range: g.range, yaw: hash(b.id, k, 59) * 6.28, k: hash(b.id, k, 60) });
  }
  if (!staffed) return;
  // The shepherd stands with his flock (by the shelter in winter), his staff in hand.
  const at = winter || !n ? { x: sx + 0.5, z: sz + 0.5 } : spots[0];
  add({ kind: 'shepherd', x: at.x + 0.3, z: at.z + 0.2, range: winter ? 0 : 0.6, yaw: hash(b.id, 1, 61) * 6.28, k: hash(b.id, 2, 61) });
}
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
  const animals = () => out.filter((o) => o.kind !== 'boat' && !PEOPLE.includes(o.kind)).length;
  const add = (o: AmbientSpot) => {
    if (!PEOPLE.includes(o.kind) && o.kind !== 'boat' && animals() >= A.maxAnimals) return;
    out.push(o);
  };

  // Pigeons on the altar court.
  if (altar) for (let k = 0; k < A.pigeons; k++) add({ kind: 'pigeon', x: cx + (hash(k, 1, 40) - 0.5) * 3, z: cz + (hash(k, 2, 40) - 0.5) * 3, range: 0.5, yaw: hash(k, 3, 40) * 6.28, k: hash(k, 4, 40) });

  // The lambs of the offerings in the restored altar's pen (works.ts).
  if (altar)
    for (let k = 0; k < penAnimals(s); k++)
      add({ kind: 'sheep', x: cx + PEN.x + (hash(k, 1, 52) - 0.5) * PEN.w * 0.6, z: cz + PEN.z + (hash(k, 2, 52) - 0.5) * PEN.d * 0.6, range: 0.2, yaw: hash(k, 3, 52) * 6.28, k: hash(k, 4, 52) });

  // Each pasture's flock first (the cap leaves them whole), with its shepherd.
  const flock = pastureFlock(s);
  const crews = crewCounts(s);
  for (const b of s.buildings) if (b.kind === 'pasture') pastureSpots(s, b, flock, !!crews.get(b.id), add);

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

  // Cows grazing in a few small herds on the open grass farther out, and geese in the grass by the water.
  const cowGrass = grass.filter((g) => g.d > 8);
  const herds: { x: number; y: number }[] = [];
  for (const g of cowGrass) {
    if (herds.length >= A.cowHerds) break;
    if (herds.some((f) => Math.hypot(f.x - g.x, f.y - g.y) < 8) || flocks.some((f) => Math.hypot(f.x - g.x, f.y - g.y) < 4)) continue;
    herds.push(g);
    for (let k = 0; k < A.cowHerd; k++) add({ kind: 'cow', x: g.x + 0.5 + (hash(g.x, k, 140) - 0.5) * 1.1, z: g.y + 0.5 + (hash(g.y, k, 141) - 0.5) * 1.1, range: 0.5, yaw: hash(g.x, k, 142) * 6.28, k: hash(g.y, k, 143) });
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
  for (const [j, b] of spaced(bank, A.gooseFlocks, 6).entries())
    for (let k = 0; k < A.gooseFlock; k++) add({ kind: 'goose', x: b.x + 0.5 + (hash(b.x, k + j, 144) - 0.5) * 0.5, z: b.y + 0.5 + (hash(b.y, k + j, 145) - 0.5) * 0.5, range: 0.2, yaw: hash(b.x, k, 146) * 6.28, k: hash(b.y, k, 147) });
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
  const out = { donkey: 0, sheep: 0, goat: 0, chicken: 0, pigeon: 0, cow: 0, goose: 0, boat: 0, washer: 0, shepherd: 0 } as Record<AmbientKind, number>;
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
const WANDER: Partial<Record<AmbientKind, number>> = { sheep: 0.07, goat: 0.12, chicken: 0.25, pigeon: 0.3, shepherd: 0.05, cow: 0.05, goose: 0.15 };

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
  // The shepherd walks his slow loop upright, leaning on the staff.
  if (o.kind === 'shepherd') return { x, z, y: 0, yaw, pitch: 0.06, roll: 0 };
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

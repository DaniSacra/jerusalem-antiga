import { BUILDINGS, cellOf, cellsInRadius, crewCounts, doorsOf, fieldHarvest, findPath, isGatherSource, type Building, type Cell, type GameState, type Rng } from '../core';
import VISUAL from '../data/visual.json';

/**
 * The people of the food buildings, as plain data (no Three.js; the 2D's Haulers): who is out and
 * the legs they walk. In the harvest a carrier takes sacks from each harvesting field along the
 * roads to the nearest granary (the altar when there is none) and comes back; all year a fisherman
 * walks from his hut to the river bank and stands there, and a gatherer to a tree near her hut.
 * Only a sight: the core counts the food. Tested in tests/render3d/haul.test.ts.
 */

export type HaulJob = 'harvest' | 'fish' | 'gather';
/** A grid point (cell centres are at +0.5). */
export type Pt = { x: number; y: number };

export const HAUL = VISUAL.haulers;

const centre = (c: Cell): Pt => ({ x: c.x + 0.5, y: c.y + 0.5 });

/** Who should be out now: a carrier per harvesting field (up to `harvestMax`), each fisher and gatherer with a source. */
export function haulJobs(s: GameState): { job: HaulJob; home: number }[] {
  const out: { job: HaulJob; home: number }[] = [];
  // Only where someone works (plan B2): an empty fisher or field shows nobody.
  const crews = crewCounts(s);
  const harvesting = s.buildings.filter((b) => b.kind === 'field' && crews.get(b.id) && fieldHarvest(s, b, s.week) > 0 && doorsOf(s, b).length);
  for (const b of harvesting.slice(0, HAUL.harvestMax)) out.push({ job: 'harvest', home: b.id });
  for (const b of s.buildings) {
    const g = BUILDINGS[b.kind].gather;
    if (!g || !b.connected || !crews.get(b.id) || (g.source !== 'river' && g.source !== 'tree') || !workSpot(s, b)) continue;
    out.push({ job: g.source === 'river' ? 'fish' : 'gather', home: b.id });
  }
  return out;
}

/** The river cell (fisher) or tree (gatherer) a worker heads for: the nearest one in the building's radius. */
export function workSpot(s: GameState, b: Building): Pt | null {
  const g = BUILDINGS[b.kind].gather;
  if (!g) return null;
  const mid = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  let best: Pt | null = null;
  let bestD = Infinity;
  for (const i of cellsInRadius(s, b.x, b.y, g.radius, b.w, b.h)) {
    if (!isGatherSource(s, i, g.source)) continue;
    const c = centre(cellOf(s, i));
    const d = Math.hypot(c.x - mid.x, c.y - mid.y);
    if (d < bestD) [best, bestD] = [c, d];
  }
  return best;
}

/** The point of a footprint (grown a little) nearest to a target: where its worker steps out. */
export function edgeToward(b: Building, to: Pt): Pt {
  const m = 0.3;
  return { x: Math.min(b.x + b.w + m, Math.max(b.x - m, to.x)), y: Math.min(b.y + b.h + m, Math.max(b.y - m, to.y)) };
}

/** A point `d` cells from `p` toward `q`. */
export function toward(p: Pt, q: Pt, d: number): Pt {
  const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
  return { x: p.x + ((q.x - p.x) * d) / len, y: p.y + ((q.y - p.y) * d) / len };
}

/**
 * The next leg of a worker of `job` from building `b`: `out` heading to work (a carrier with a sack
 * to the store). A carrier walks the roads and comes back the way it went (`prev`); the others go
 * straight over the ground, the fisherman to the bank, the gatherer under the tree's crown. Fewer
 * than two points: nowhere to go now.
 */
export function legOf(s: GameState, job: HaulJob, b: Building, out: boolean, prev: readonly Pt[], rng: Rng): Pt[] {
  if (job === 'harvest') {
    if (!out && prev.length > 1) return [...prev].reverse();
    const doors = doorsOf(s, b);
    const from = doors[Math.floor(rng() * doors.length)];
    const stores = s.buildings.filter((o) => o.kind === 'granary' && o.connected);
    const goals = (stores.length ? stores : s.buildings.filter((o) => o.kind === 'altar')).flatMap((o) => doorsOf(s, o));
    const path = from && goals.length ? findPath(s, from, goals) : null;
    return path && path.length > 1 ? path.map(centre) : [];
  }
  const spot = workSpot(s, b);
  if (!spot) return [];
  const mid = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const work = toward(spot, mid, job === 'fish' ? 0.62 : 0.45);
  const door = edgeToward(b, work);
  return out ? [door, work] : [work, door];
}

/** How long a worker stays at the end of a leg (seconds): carriers drop the sack, the others work or rest. */
export function waitAfter(job: HaulJob, wasOut: boolean, rng: Rng): number {
  const [a, b] = job === 'harvest' ? HAUL.endWait : wasOut ? HAUL.workSeconds : HAUL.homeSeconds;
  return a + rng() * (b - a);
}

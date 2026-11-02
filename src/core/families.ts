import { HOUSE_LEVELS, RULES } from './data';
import { computeEconomy } from './economy';
import { familyFactor } from './happiness';
import { indexOf } from './grid';
import { rollLook } from './looks';
import { doorsOf, findPath } from './network';
import type { Building, Cell, GameEvent, GameState, Rng } from './types';

/** Families start at the city entrance; if it was cut off, at a road next to the altar. */
function startCell(s: GameState): Cell | null {
  if (s.network[indexOf(s, s.entrance.x, s.entrance.y)]) return s.entrance;
  const altar = s.buildings.find((b) => b.kind === 'altar');
  return (altar && doorsOf(s, altar)[0]) ?? null;
}

function pathTo(s: GameState, from: Cell | null, house: Building): Cell[] | null {
  if (!from) return null;
  const path = findPath(s, from, doorsOf(s, house));
  return path && [...path, { x: house.x, y: house.y }];
}

const awaitsFamily = (s: GameState, b: Building) => s.families.some((f) => f.houseId === b.id);

/** Families already living in the city or on their way. */
const settledOrComing = (s: GameState) => s.buildings.filter((b) => b.kind === 'house' && b.level >= 1).length + s.families.length;

/**
 * Each connected empty plot without a family on the way may receive one (not during famine).
 * The first few families come for sure, so the start has no dead time. A happy city draws
 * families faster (the chance is scaled by the average happiness).
 */
export function dispatchFamilies(s: GameState, rng: Rng): void {
  if (s.famine) return;
  const chance = RULES.familyChance * familyFactor(computeEconomy(s).happiness);
  for (const b of s.buildings) {
    if (b.kind !== 'house' || b.level !== 0 || !b.connected || awaitsFamily(s, b)) continue;
    const guaranteed = settledOrComing(s) < RULES.guaranteedFamilies;
    if (!guaranteed && rng() >= chance) continue;
    const path = pathTo(s, startCell(s), b);
    if (path) s.families.push({ id: s.nextId++, houseId: b.id, path, step: 0 });
  }
}

/** Remaining road cells (excluding the house cell) are still part of the network. */
function routeIntact(s: GameState, path: Cell[], from: number): boolean {
  return path.slice(from, -1).every((c) => s.network[indexOf(s, c.x, c.y)]);
}

/** Moves families along the roads; arrivals turn the plot into a tent. Broken routes are recalculated. */
export function moveFamilies(s: GameState, events: GameEvent[], rng: Rng): void {
  s.families = s.families.filter((f) => {
    const house = s.buildings.find((b) => b.id === f.houseId);
    if (!house || house.level !== 0 || !house.connected) return false;
    const here = Math.floor(f.step);
    if (!routeIntact(s, f.path, here)) {
      const path = pathTo(s, f.path[Math.min(here, f.path.length - 2)], house);
      if (!path) return false;
      f.path = path;
      f.step = 0;
    }
    f.step += RULES.familyCellsPerMonth;
    if (f.step < f.path.length - 1) return true;
    house.level = 1;
    house.upStreak = 0;
    house.downStreak = 0;
    rollLook(s, house, rng);
    events.push({ type: 'houseUp', x: house.x, y: house.y, level: 1, delta: HOUSE_LEVELS[1].residents });
    return false;
  });
}

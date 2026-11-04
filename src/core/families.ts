import { HOUSE_LEVELS, RULES } from './data';
import { computeEconomy, type Economy } from './economy';
import { foodLastsToHarvest } from './forecast';
import { needMet } from './houses';
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

/** Why no new family can set out now, or null when one can. */
export type FamilyBlock = 'famine' | 'water' | 'food' | 'storage' | 'wait' | 'noPlot';

/** Houses with a family that lack water (empty plots do not count). */
export const housesWithoutWater = (s: GameState) =>
  s.buildings.filter((b) => b.kind === 'house' && b.level > 0 && b.connected && !needMet(s, b, 'well'));

/**
 * New families only come to a city where every house with a family has water and the food lasts
 * until the next harvest with a reserve of `familyFoodReserveWeeks` weeks of eating (counting
 * every house at its planned level, the families on the way and the new one), at most one every
 * `familyIntervalWeeks`, and only to a connected empty plot.
 * An empty city (no residents, nobody on the way) skips the water and food checks, so it can
 * always start again. The checks go in this order, so the reason shown is the most important one.
 * `storage` means the food would last but the store cannot hold it.
 */
export function familyBlock(s: GameState, eco: Economy = computeEconomy(s)): FamilyBlock | null {
  if (s.famine) return 'famine';
  const empty = eco.residents === 0 && s.families.length === 0;
  if (!empty) {
    if (housesWithoutWater(s).length > 0) return 'water';
    const opts = { extraTents: s.families.length + 1, reserveWeeks: RULES.familyFoodReserveWeeks };
    if (!foodLastsToHarvest(s, eco, opts)) {
      return foodLastsToHarvest(s, eco, { ...opts, unlimited: true }) ? 'storage' : 'food';
    }
  }
  if (s.week - s.lastFamilyWeek < RULES.familyIntervalWeeks) return 'wait';
  if (!s.buildings.some((b) => openPlot(s, b))) return 'noPlot';
  return null;
}

const openPlot = (s: GameState, b: Building) => b.kind === 'house' && b.level === 0 && b.connected && !awaitsFamily(s, b);

/**
 * When nothing blocks it, one family may set out for an empty plot: the chance is scaled by the
 * average happiness (a happy city draws families faster).
 */
export function dispatchFamilies(s: GameState, rng: Rng): void {
  const eco = computeEconomy(s);
  if (familyBlock(s, eco)) return;
  if (rng() >= RULES.familyChance * familyFactor(eco.happiness)) return;
  for (const b of s.buildings) {
    if (!openPlot(s, b)) continue;
    const path = pathTo(s, startCell(s), b);
    if (!path) continue;
    s.families.push({ id: s.nextId++, houseId: b.id, path, step: 0 });
    s.lastFamilyWeek = s.week;
    return;
  }
}

/** Cells a family walks per week. */
export const familySpeed = () => RULES.familyCellsPerWeek;

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
    f.step += familySpeed();
    if (f.step < f.path.length - 1) return true;
    house.level = 1;
    house.upStreak = 0;
    house.downStreak = 0;
    rollLook(s, house, rng);
    events.push({ type: 'houseUp', x: house.x, y: house.y, level: 1, delta: HOUSE_LEVELS[1].residents });
    return false;
  });
}

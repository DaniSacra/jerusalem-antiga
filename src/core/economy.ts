import { HOUSE_LEVELS, RULES, statOf } from './data';
import { fieldBonus, fieldHarvest, gatherYield, isWorking, productOf } from './harvest';
import { houseHappiness, moodOf, taxFactor, type Mood } from './happiness';
import { ageBand, foodOf } from './people';
import type { Building, BuildingKind, GameState, Material } from './types';
import { crewCounts, idleShare, staffOf } from './work';

export interface Economy {
  /** People living in the city (not those on the way). */
  residents: number;
  /** Adults living in the city. */
  workers: number;
  /** Jobs of the connected workplaces at work this week (frozen fields have none). */
  jobs: number;
  /** Jobs of every connected workplace, frozen fields included: the jobs of the whole year. */
  yearJobs: number;
  /** Share of this week's jobs that have someone (0..1; 1 with no jobs): for the statistics only, each workplace makes by its own crew. */
  efficiency: number;
  foodDelta: number;
  /** Food the fields harvest this week (by their crews; 0 outside spring). */
  harvest: number;
  /** Food made this week (by the crews) and eaten by the residents; foodDelta = made - eaten. */
  foodMade: number;
  foodEaten: number;
  /** Wood and stone made this week (lumbers and quarries, by their crews), up to the store cap. */
  wood: number;
  stone: number;
  /** Share of the made wood and stone that fits the store (1: all of it; 0: the store is full). */
  stored: Record<Material, number>;
  /** Weekly silver balance: taxes - upkeep. */
  silverDelta: number;
  taxes: number;
  /** Upkeep per building kind (only kinds that cost something). */
  upkeep: Partial<Record<BuildingKind, number>>;
  /** Average happiness of the houses with a family (50 with none). */
  happiness: number;
  /** Houses with a family in each mood. */
  moods: Record<Mood, number>;
}

/**
 * The people living in the city (on the way they neither count nor eat): how many, the adults
 * (workers) and the food they eat in `week` (by age band, times the winter factor of each house).
 */
export function peopleEating(s: GameState, week = s.week): { residents: number; workers: number; eaten: number } {
  const houses = new Map<number, Building>();
  for (const b of s.buildings) if (b.kind === 'house') houses.set(b.id, b);
  const out = { residents: 0, workers: 0, eaten: 0 };
  for (const p of s.people) {
    const h = p.houseId === null ? undefined : houses.get(p.houseId);
    if (!h) continue;
    const band = ageBand(p, s.week);
    out.residents++;
    if (band === 'adult') out.workers++;
    out.eaten += foodOf(band, h.level, week);
  }
  return out;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Disconnected workplaces neither produce nor offer jobs, but every building pays its upkeep from
 * the week it is built (more at higher levels, see `statOf`). Each workplace makes by the share
 * of its jobs that have someone (`staffOf`): nobody there, nothing made. The people living in the
 * city eat; each house with people pays its tax, scaled by its happiness.
 */
export function computeEconomy(s: GameState): Economy {
  const { residents, workers, eaten } = peopleEating(s);
  let taxes = 0;
  let joy = 0;
  let families = 0;
  const moods: Record<Mood, number> = { happy: 0, neutral: 0, sad: 0 };
  let jobs = 0;
  let yearJobs = 0;
  let filled = 0;
  const crews = crewCounts(s);
  let foodProd = 0;
  let harvest = 0;
  const made: Record<Material, number> = { wood: 0, stone: 0 };
  const upkeep: Partial<Record<BuildingKind, number>> = {};
  const bonus = fieldBonus(s);
  for (const b of s.buildings) {
    if (b.kind === 'house') continue;
    const cost = statOf(b, 'upkeep');
    if (cost) upkeep[b.kind] = round2((upkeep[b.kind] ?? 0) + cost);
    if (!b.connected) continue;
    const n = statOf(b, 'jobs');
    yearJobs += n;
    if (!isWorking(b, s.week)) continue;
    jobs += n;
    const staff = staffOf(b, crews);
    filled += Math.min(n, crews.get(b.id) ?? 0);
    const h = fieldHarvest(s, b, s.week, s.drought, undefined, bonus) * staff;
    harvest += h;
    const product = productOf(b.kind);
    if (product && product !== 'food') made[product] += gatherYield(s, b) * staff;
    else foodProd += (product ? gatherYield(s, b) * staff : 0) + h;
  }
  const idle = idleShare(s);
  for (const b of s.buildings) {
    if (b.kind !== 'house' || b.level === 0) continue;
    const h = houseHappiness(s, b, idle).value;
    taxes += HOUSE_LEVELS[b.level].tax * taxFactor(h);
    joy += h;
    families++;
    moods[moodOf(h)]++;
  }
  const efficiency = jobs === 0 ? 1 : filled / jobs;
  // The store keeps at most materialStorage of each material: production stops at it (never cut).
  const fits = (m: Material) => {
    const n = made[m];
    return n > 0 ? Math.min(1, Math.max(0, RULES.materialStorage - s[m]) / n) : 1;
  };
  const stored: Record<Material, number> = { wood: fits('wood'), stone: fits('stone') };
  const sum = (r: Partial<Record<BuildingKind, number>>) => Object.values(r).reduce((a, v) => a + v, 0);
  return {
    residents,
    workers,
    jobs,
    yearJobs,
    efficiency,
    foodDelta: round2(foodProd - eaten),
    harvest: round2(harvest),
    foodMade: round2(foodProd),
    foodEaten: round2(eaten),
    wood: round2(made.wood * stored.wood),
    stone: round2(made.stone * stored.stone),
    stored,
    silverDelta: round2(taxes - sum(upkeep)),
    taxes: round2(taxes),
    upkeep,
    happiness: families ? Math.round(joy / families) : 50,
    moods,
  };
}

/** The building kind with the highest total upkeep, or null if nothing costs upkeep. */
export function costliestUpkeep(eco: Economy): { kind: BuildingKind; amount: number } | null {
  let best: { kind: BuildingKind; amount: number } | null = null;
  for (const [kind, amount] of Object.entries(eco.upkeep) as [BuildingKind, number][]) {
    if (!best || amount > best.amount) best = { kind, amount };
  }
  return best;
}

import { lampLit, theftTotal } from './theft';
import { BUILDINGS, HOUSE_LEVELS, RULES, storageOf } from './data';
import { fieldBonus, fieldHarvest, gatherYield, isWorking, productOf } from './harvest';
import { houseHappiness, moodOf, taxFactor, type Mood } from './happiness';
import { ageBand, foodOf } from './people';
import type { Building, BuildingKind, GameState, Material } from './types';
import { crewCounts, idleShare, jobsAt, staffOf, upkeepPaid } from './work';

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
  /** Food stolen this week from unguarded granaries (theft.ts), taken out of foodDelta. */
  theft: number;
  /** Food the fields harvest this week (by their crews; 0 outside spring). */
  harvest: number;
  /** Food made this week (by the crews) and eaten by the residents; foodDelta = made - eaten. */
  foodMade: number;
  foodEaten: number;
  /** Wood and stone made this week (lumbers and quarries, by their crews), up to the store cap. */
  wood: number;
  stone: number;
  /** Livestock the pastures made this week (by their crews), up to the pens' cap, less what the tanneries took (`hides`). */
  livestock: number;
  /** Livestock the tanneries take this week (plano-dificuldade E): from the pens, before the altar's offering. */
  hides: number;
  /** Clothes the tanneries make this week (by their crews), up to the store's cap and the livestock there is. */
  clothes: number;
  /** Share of their crews' work the tanneries can do this week (0..1): the pens and the store allow it. */
  tanned: number;
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
 * the week it is built (more at higher levels, see `statOf`; an empty workplace half, `upkeepPaid`). Each workplace makes by the share
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
  const made: Record<Material, number> = { wood: 0, stone: 0, livestock: 0 };
  const tan = { livestock: 0, clothes: 0 };
  const upkeep: Partial<Record<BuildingKind, number>> = {};
  const bonus = fieldBonus(s);
  for (const b of s.buildings) {
    if (b.kind === 'house') continue;
    const cost = upkeepPaid(b, crews);
    if (cost) upkeep[b.kind] = round2((upkeep[b.kind] ?? 0) + cost);
    if (!b.connected) continue;
    const n = jobsAt(b);
    yearJobs += n;
    if (!isWorking(b, s.week)) continue;
    jobs += n;
    const staff = staffOf(b, crews);
    filled += Math.min(n, crews.get(b.id) ?? 0);
    const h = fieldHarvest(s, b, s.week, s.drought, undefined, bonus) * staff;
    harvest += h;
    const tans = BUILDINGS[b.kind].tans;
    if (tans) {
      tan.livestock += tans.livestock * staff;
      tan.clothes += tans.clothes * staff;
    }
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
  const theft = theftTotal(s, crews);
  // The store keeps at most `storageOf` each material: production stops at it (never cut).
  const fits = (m: Material) => {
    const n = made[m];
    return n > 0 ? Math.min(1, Math.max(0, storageOf(m) - s[m]) / n) : 1;
  };
  const stored: Record<Material, number> = { wood: fits('wood'), stone: fits('stone'), livestock: fits('livestock') };
  // The tanneries work as far as the pens and the clothes store allow.
  const pens = s.livestock + made.livestock * stored.livestock;
  const room = Math.max(0, RULES.clothes.storage - s.clothes);
  const tanned = tan.livestock > 0 ? Math.min(1, pens / tan.livestock, room / tan.clothes) : 0;
  const sum = (r: Partial<Record<BuildingKind, number>>) => Object.values(r).reduce((a, v) => a + v, 0);
  return {
    residents,
    workers,
    jobs,
    yearJobs,
    efficiency,
    foodDelta: round2(foodProd - eaten - theft),
    theft,
    harvest: round2(harvest),
    foodMade: round2(foodProd),
    foodEaten: round2(eaten),
    wood: round2(made.wood * stored.wood - lampsBurn(s)),
    stone: round2(made.stone * stored.stone),
    livestock: round2(made.livestock * stored.livestock - tan.livestock * tanned),
    hides: round2(tan.livestock * tanned),
    clothes: round2(tan.clothes * tanned),
    tanned,
    stored,
    silverDelta: round2(taxes - sum(upkeep)),
    taxes: round2(taxes),
    upkeep,
    happiness: families ? Math.round(joy / families) : 50,
    moods,
  };
}

/** Wood the lit lamps burn a week (plano-dificuldade D): with none left they go dark and burn nothing. */
export const lampsBurn = (s: GameState) => s.buildings.reduce((a, b) => a + (lampLit(s, b) ? (BUILDINGS[b.kind].burns ?? 0) : 0), 0);

/** The building kind with the highest total upkeep, or null if nothing costs upkeep. */
export function costliestUpkeep(eco: Economy): { kind: BuildingKind; amount: number } | null {
  let best: { kind: BuildingKind; amount: number } | null = null;
  for (const [kind, amount] of Object.entries(eco.upkeep) as [BuildingKind, number][]) {
    if (!best || amount > best.amount) best = { kind, amount };
  }
  return best;
}

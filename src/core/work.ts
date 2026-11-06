import { BUILDINGS, RULES, statOf } from './data';
import { ageBand } from './people';
import type { Building, BuildingKind, GameState, Person } from './types';

/**
 * Work (plan B2): every adult keeps a job (`Person.jobId`) at a connected workplace. Each week,
 * and after any change to the city, `assignJobs` frees the jobs nobody can hold any more and
 * hands the free jobs to the adults without one. Nobody with a job is ever moved by the game;
 * only the player moves people (`setJob` in actions.ts).
 */

/** An adult living in the city (not on the way): the only people who work. */
export const canWork = (s: GameState, p: Person) => p.houseId !== null && ageBand(p, s.week) === 'adult';

/** Workplaces whose work shows: what they make, the workshops' bonus, a market's coverage (not a granary or the temple). */
export const madeByCrew = (kind: BuildingKind) => {
  const d = BUILDINGS[kind];
  return d.jobs > 0 && !!(d.gather || d.harvest || d.fieldBonus || RULES.staffedServices.includes(kind));
};

/** Jobs a building offers: 0 while it is off the road. */
export const seatsOf = (b: Building) => (b.connected ? statOf(b, 'jobs') : 0);

/** How many people work at each building (by id). */
export function crewCounts(s: GameState): Map<number, number> {
  const out = new Map<number, number>();
  for (const p of s.people) if (p.jobId != null) out.set(p.jobId, (out.get(p.jobId) ?? 0) + 1);
  return out;
}

/** People working at this building, by id. */
export const crewOf = (s: GameState, b: Pick<Building, 'id'>) => s.people.filter((p) => p.jobId === b.id).sort((a, c) => a.id - c.id);

/**
 * Share of its jobs a building has filled (0..1): what it makes is scaled by it, so a workplace
 * nobody works at makes nothing. Buildings without jobs count as full.
 */
export function staffOf(b: Building, crews: Map<number, number>): number {
  const seats = seatsOf(b);
  if (statOf(b, 'jobs') === 0) return 1;
  return seats === 0 ? 0 : Math.min(1, (crews.get(b.id) ?? 0) / seats);
}

/**
 * Silver a building pays a week: its upkeep, times `emptyUpkeepFactor` for a workplace whose work
 * shows (`madeByCrew`) with nobody working there, connected or not (B2 measured: a careless city sank
 * in debt from empty places). A granary, the plaza and the park pay in full.
 */
export function upkeepPaid(b: Building, crews: Map<number, number>): number {
  const cost = statOf(b, 'upkeep');
  return madeByCrew(b.kind) && !crews.get(b.id) ? Math.round(cost * RULES.emptyUpkeepFactor * 100) / 100 : cost;
}

/** Someone could be moved to an empty workplace: an adult without a job, or one at a place with 2 or more workers. */
export function anyoneToMove(s: GameState): boolean {
  const crews = crewCounts(s);
  return s.people.some((p) => canWork(s, p) && (p.jobId == null || (crews.get(p.jobId) ?? 0) >= 2));
}

const rank = (kind: BuildingKind) => {
  const k = RULES.jobPriority.indexOf(kind);
  return k < 0 ? RULES.jobPriority.length : k;
};

/** Workplaces in the order free adults fill them: `jobPriority`, then the oldest (lowest id). */
const workplaces = (s: GameState) =>
  s.buildings.filter((b) => seatsOf(b) > 0).sort((a, b) => rank(a.kind) - rank(b.kind) || a.id - b.id);

/** Distance from a person's house to a building (Manhattan, top-left corners). */
function distance(p: Person, b: Building, houses: Map<number, Building>): number {
  const h = p.houseId === null ? undefined : houses.get(p.houseId);
  return h ? Math.abs(h.x - b.x) + Math.abs(h.y - b.y) : Infinity;
}

/**
 * Frees the jobs nobody can hold (a child grown old, a person gone, a workplace demolished or off
 * the road, more crew than jobs: the newest by id go), then fills each free job: workplaces by
 * `jobPriority` and age, each job to the free adult living nearest (ties by id). An adult the
 * player left without work this week (`quitWeek`) waits for the next.
 */
export function assignJobs(s: GameState): void {
  const byId = new Map(s.buildings.map((b) => [b.id, b]));
  const kept = new Map<number, number>();
  for (const p of [...s.people].sort((a, c) => a.id - c.id)) {
    if (p.jobId == null) continue;
    const b = byId.get(p.jobId);
    const n = kept.get(p.jobId) ?? 0;
    if (!canWork(s, p) || !b || n >= seatsOf(b)) p.jobId = null;
    else kept.set(p.jobId, n + 1);
  }
  const free = s.people.filter((p) => p.jobId == null && p.quitWeek !== s.week && canWork(s, p));
  if (!free.length) return;
  const houses = new Map(s.buildings.filter((b) => b.kind === 'house').map((b) => [b.id, b]));
  for (const b of workplaces(s)) {
    for (let n = kept.get(b.id) ?? 0; n < seatsOf(b) && free.length; n++) {
      let best = 0;
      for (let k = 1; k < free.length; k++) {
        const d = distance(free[k], b, houses) - distance(free[best], b, houses);
        if (d < 0 || (d === 0 && free[k].id < free[best].id)) best = k;
      }
      free.splice(best, 1)[0].jobId = b.id;
    }
    if (!free.length) return;
  }
}

/** Adults living in the city without a job (frozen fields keep their farmers: they are not out of work). */
export const unemployed = (s: GameState) => s.people.filter((p) => p.jobId == null && canWork(s, p)).length;

/** Share (0..1) of the adults without a job, as used by house happiness. */
export function idleShare(s: GameState): number {
  let adults = 0;
  let idle = 0;
  for (const p of s.people) {
    if (!canWork(s, p)) continue;
    adults++;
    if (p.jobId == null) idle++;
  }
  return adults ? idle / adults : 0;
}

/** Adults without a job to warn about, or 0 below the alert threshold. */
export function unemploymentAlert(s: GameState): number {
  const n = unemployed(s);
  return n >= RULES.unemploymentAlert ? n : 0;
}

/** A job a person could move to: a connected workplace with a free job, the nearest to the house first. */
export interface JobOption {
  buildingId: number;
  kind: BuildingKind;
  crew: number;
  seats: number;
}

/** Where this person could work now (empty for a child, an elder or someone on the way). */
export function jobOptions(s: GameState, personId: number): JobOption[] {
  const p = s.people.find((o) => o.id === personId);
  if (!p || !canWork(s, p)) return [];
  const crews = crewCounts(s);
  const houses = new Map(s.buildings.filter((b) => b.kind === 'house').map((b) => [b.id, b]));
  return s.buildings
    .filter((b) => b.id !== p.jobId && (crews.get(b.id) ?? 0) < seatsOf(b))
    .sort((a, b) => distance(p, a, houses) - distance(p, b, houses) || a.id - b.id)
    .map((b) => ({ buildingId: b.id, kind: b.kind, crew: crews.get(b.id) ?? 0, seats: seatsOf(b) }));
}

/**
 * Where each adult in the city works (for the screen and the walkers): adults with a job map to
 * their workplace, the others to null. Children and elders are not in the map.
 */
export function jobsOf(s: GameState): Map<number, { kind: BuildingKind; buildingId: number } | null> {
  const byId = new Map(s.buildings.map((b) => [b.id, b]));
  const out = new Map<number, { kind: BuildingKind; buildingId: number } | null>();
  for (const p of s.people) {
    if (!canWork(s, p)) continue;
    const b = p.jobId == null ? undefined : byId.get(p.jobId);
    out.set(p.id, b ? { kind: b.kind, buildingId: b.id } : null);
  }
  return out;
}

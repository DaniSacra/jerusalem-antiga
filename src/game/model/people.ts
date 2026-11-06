import { ageBand, ageOf, BUILDINGS, craftOf, harvestsIn, jobOptions, type Building, type BuildingKind, type GameState, type Person } from '../../core';
import { T } from '../strings';

/** People as the interface tells them (pure): age band, age, work and a house's residents. */

/** A person's age band now (or when they died or left). */
export const bandOf = (s: GameState, p: Person) => ageBand(p, p.end?.week ?? s.week);

/**
 * What a person does, in a word or two: the work of an adult (from `jobsOf`; a farmer in winter
 * rests on the frozen field), "Sem trabalho", an elder resting, or the band of a child.
 */
export function jobText(s: GameState, p: Person, jobs: Map<number, { kind: BuildingKind; buildingId: number } | null>): string {
  const N = T.nova.people;
  if (p.houseId === null) return N.walking;
  const band = ageBand(p, s.week);
  if (band === 'elder') return N.elderRest(p.sex);
  if (band !== 'adult') return N.band(band, p.sex);
  const job = jobs.get(p.id);
  if (!job) return N.noJob;
  const f = p.sex === 'f' ? 1 : 0;
  if (job.kind === 'workshop') {
    const b = s.buildings.find((o) => o.id === job.buildingId);
    const craft = b && craftOf(b);
    if (craft) return N.craft[craft][f];
  }
  const text = N.job[job.kind]?.[f] ?? BUILDINGS[job.kind].name;
  return BUILDINGS[job.kind].harvest && !harvestsIn(s.week) ? N.winterRest(text) : text;
}

/** The short list "Mudar" opens: each free job (nearest first, "Lenhador 1/2"), then "Sem trabalho" when the person has a job. */
export function jobChoices(s: GameState, p: Person): { id: number | null; label: string }[] {
  const N = T.nova.people;
  const out: { id: number | null; label: string }[] = jobOptions(s, p.id).map((o) => ({ id: o.buildingId, label: N.option(BUILDINGS[o.kind].name, o.crew, o.seats) }));
  if (p.jobId != null) out.push({ id: null, label: N.leaveJob });
  return out;
}

/** People of a house, eldest first. */
export const residentsOf = (s: GameState, b: Building) => s.people.filter((p) => p.houseId === b.id).sort((a, c) => a.birthWeek - c.birthWeek || a.id - c.id);

/** Age of a person now, or at the week they died or left. */
export const ageNow = (s: GameState, p: Person) => ageOf(p, p.end?.week ?? s.week);

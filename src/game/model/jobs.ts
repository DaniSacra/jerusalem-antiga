import { bandCounts, BUILDINGS, crewByKind, jobsBuilt, loweredTarget, RULES, seatsOfKind, targetOf, unemployed, type BuildingKind, type GameState } from '../../core';
import { T } from '../strings';

/**
 * The Profissões panel as data (pure): who has no work, then one row per profession built (a
 * workplace kind with jobs), in the order free adults fill them (`jobPriority`).
 */

export interface JobRow {
  kind: BuildingKind;
  name: string;
  /** People working in the profession now. */
  crew: number;
  /** Jobs its workplaces on the road offer now. */
  seats: number;
  /** "2 de 4 vagas", or "sem rua" when none of its workplaces is on the road. */
  label: string;
  /** The number between − and +: the player's target, or every job when automatic. */
  target: number;
  auto: boolean;
  /** Fewer workers than the target ("falta 1"); 0 when it is met. */
  missing: number;
  /** − changes something (someone to free, or a target above 0). */
  canLower: boolean;
  /** + changes something (a number target below the jobs built; automatic already wants them all). */
  canRaise: boolean;
}

export interface JobsView {
  /** Adults living in the city without a job. */
  idle: number;
  /** "2 crianças, 1 idoso": who does not work by age. */
  others: string;
  rows: JobRow[];
  /** Some profession has a number target (Automático would change something). */
  anyTarget: boolean;
  /** "Ninguém livre…" whenever a profession waits for workers and nobody is free (the game never moves a worker by itself). */
  note: string | null;
}

const rank = (kind: BuildingKind) => {
  const k = RULES.jobPriority.indexOf(kind);
  return k < 0 ? RULES.jobPriority.length : k;
};

export function jobsView(s: GameState): JobsView {
  const N = T.nova.professions;
  const crewOf = crewByKind(s);
  const kinds = [...new Set(s.buildings.map((b) => b.kind))].filter((k) => jobsBuilt(s, k) > 0).sort((a, b) => rank(a) - rank(b));
  const rows = kinds.map((kind): JobRow => {
    const crew = crewOf.get(kind) ?? 0;
    const seats = seatsOfKind(s, kind);
    const t = s.jobTargets[kind];
    const auto = t === undefined;
    return {
      kind,
      name: N.name[kind] ?? BUILDINGS[kind].name,
      crew,
      seats,
      label: seats ? N.crew(crew, seats) : N.noRoad,
      target: auto ? seats : t,
      auto,
      missing: Math.max(0, targetOf(s, kind) - crew),
      canLower: loweredTarget(t, crew) !== t,
      canRaise: !auto && t < jobsBuilt(s, kind),
    };
  });
  const bands = bandCounts(s);
  const idle = unemployed(s);
  const note = idle === 0 && rows.some((r) => r.missing > 0) ? N.nobodyFree : null;
  return { idle, others: N.others(bands.child, bands.elder), rows, anyTarget: rows.some((r) => !r.auto), note };
}

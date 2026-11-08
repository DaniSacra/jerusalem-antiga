import difficulty from '../data/difficulty.json';
import { TEMPLE_STAGES } from './data';
import { seasonOf, WEEKS_PER_YEAR } from './seasons';
import type { Difficulty, GameState, TempleStageDef } from './types';

/**
 * Difficulty (plano-dificuldade F): Tranquilo, Normal or Difícil, chosen on the title screen and
 * fixed for the game (`s.difficulty`). Multipliers of `src/data/difficulty.json` on the points that
 * exist: starting silver, food eaten, firewood, clothes, upkeep, an empty workplace's upkeep, theft,
 * the altar's offering and the Temple stages (silver and materials, work). Winters grow harder from
 * Year 3 (`winterGrowth` a year, up to `winterGrowthMax`): food, firewood and clothes in winter.
 */
export interface DifficultyDef {
  startSilver: number;
  food: number;
  firewood: number;
  clothes: number;
  upkeep: number;
  emptyUpkeep: number;
  theft: number;
  offering: number;
  templeCost: number;
  templeWork: number;
  winterGrowth: number;
  winterGrowthMax: number;
}

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];
export const DIFFICULTY = difficulty as Record<Difficulty, DifficultyDef>;

/** The multipliers of this game. */
export const difficultyOf = (s: Pick<GameState, 'difficulty'>): DifficultyDef => DIFFICULTY[s.difficulty];

/** Extra share of the winter's needs in this week's year: 0 out of winter and in Years 1-2, then a step a year up to the cap. */
export function winterGrowth(s: Pick<GameState, 'difficulty'>, week: number): number {
  if (seasonOf(week) !== 'winter') return 0;
  const d = difficultyOf(s);
  const steps = Math.max(0, Math.floor(week / WEEKS_PER_YEAR) + 1 - 2);
  return Math.min(d.winterGrowthMax, Math.round(d.winterGrowth * steps * 100) / 100);
}

/** The growth of the current winter, or of the next one (the autumn's forecasts see it coming). */
export function comingWinterGrowth(s: Pick<GameState, 'difficulty'>, week: number): number {
  let w = week;
  while (seasonOf(w) !== 'winter') w++;
  return winterGrowth(s, w);
}

/** Scaled stages, built once per difficulty and stage (render code asks every frame). */
const scaled = new Map<string, TempleStageDef>();

/** The Temple stage `k` (0-based) of this game: silver, materials and work scaled, and the offering once built. */
export function stageOf(s: Pick<GameState, 'difficulty'>, k: number): TempleStageDef | undefined {
  const st = TEMPLE_STAGES[k];
  if (!st) return undefined;
  const d = difficultyOf(s);
  if (d.templeCost === 1 && d.templeWork === 1 && d.offering === 1) return st;
  const key = `${s.difficulty}:${k}`;
  const hit = scaled.get(key);
  if (hit) return hit;
  const materials = Object.fromEntries(Object.entries(st.materials).map(([m, n]) => [m, Math.round((n ?? 0) * d.templeCost)]));
  const out = {
    ...st,
    cost: Math.round(st.cost * d.templeCost),
    materials,
    work: Math.max(1, Math.round(st.work * d.templeWork)),
    offering: Math.round(st.offering * d.offering * 100) / 100,
  };
  scaled.set(key, out);
  return out;
}

/** Sets the game's difficulty before it starts (week 0): its starting silver too. */
export function setDifficulty(s: GameState, d: Difficulty): void {
  s.difficulty = d;
  if (s.week === 0) s.silver = DIFFICULTY[d].startSilver;
}

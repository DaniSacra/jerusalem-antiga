import { RULES } from './data';
import { cellsOf, indexOf } from './grid';
import { seasonOf } from './seasons';
import type { Building, GameState, ServiceKind } from './types';

const H = RULES.happiness;

export type Mood = 'happy' | 'neutral' | 'sad';
/** One reason for a house's happiness, with its points (positive or negative). */
export interface HappinessPart {
  kind: 'sacred' | 'park' | 'plaza' | 'market' | 'tax' | 'famine' | 'cold' | 'tentWinter' | 'ragged' | 'idle';
  value: number;
}
export interface Happiness {
  /** 0..100 (50 = neutral). */
  value: number;
  mood: Mood;
  parts: HappinessPart[];
}

const covered = (s: GameState, b: Building, k: ServiceKind) => cellsOf(b).some((c) => s.coverage[k][indexOf(s, c.x, c.y)]);

export const moodOf = (value: number): Mood => (value >= H.happy ? 'happy' : value < H.sad ? 'sad' : 'neutral');

/**
 * Happiness of a house (from the start of the game, B4): 50, plus being near the altar or temple, a
 * park, a plaza and a market, minus famine, a winter without firewood (or, with it, in a tent or
 * without clothes) and the share of the city's workers without a job (`idleShare`, 0..1).
 */
export function houseHappiness(s: GameState, b: Building, idleShare: number): Happiness {
  const parts: HappinessPart[] = [];
  for (const k of ['sacred', 'park', 'plaza', 'market'] as const) if (covered(s, b, k)) parts.push({ kind: k, value: H[k] });
  const tax = taxJoy(s);
  if (tax) parts.push({ kind: 'tax', value: tax });
  if (s.famine) parts.push({ kind: 'famine', value: H.famine });
  if (seasonOf(s.week) === 'winter') {
    if (s.cold) parts.push({ kind: 'cold', value: H.cold });
    else if (b.level === 1) parts.push({ kind: 'tentWinter', value: H.tentWinter });
    if (s.ragged && !s.cold) parts.push({ kind: 'ragged', value: H.ragged });
  }
  const idle = Math.round(Math.min(H.idleMax, idleShare * H.idleScale));
  if (idle > 0) parts.push({ kind: 'idle', value: -idle });
  const value = Math.max(0, Math.min(100, H.base + parts.reduce((a, p) => a + p.value, 0)));
  return { value, mood: moodOf(value), parts };
}

/**
 * 1 while content (sad <= value < happy); rises linearly to `max` at 100 once happy and falls
 * linearly to `min` at 0 once sad.
 */
const scale = (value: number, min: number, max: number) =>
  value >= H.happy ? 1 + ((max - 1) * (value - H.happy)) / (100 - H.happy) : value < H.sad ? min + ((1 - min) * value) / H.sad : 1;

const X = RULES.tax;

/** Happiness the tax rate gives every house (package G): + under the default rate, − over it. */
export const taxJoy = (s: Pick<GameState, 'taxRate'>) => Math.round(((X.default - s.taxRate) / X.step) * X.joyPerStep);

/** What the tax rate does to every house's tax (1 at the default rate). */
export const taxRateFactor = (s: Pick<GameState, 'taxRate'>) => s.taxRate / X.default;

/** The tax rate one step lower or higher (within min..max); false when it cannot move. */
export function changeTax(s: Pick<GameState, 'taxRate'>, delta: 1 | -1): boolean {
  const next = Math.min(X.max, Math.max(X.min, s.taxRate + delta * X.step));
  if (next === s.taxRate) return false;
  s.taxRate = next;
  return true;
}

/** Tax multiplier of a house (happy houses pay more). */
export const taxFactor = (value: number) => scale(value, H.taxMin, H.taxMax);

/** Birth chance multiplier for the city's average happiness. */
export const birthFactor = (cityValue: number) => scale(cityValue, H.birthMin, H.birthMax);

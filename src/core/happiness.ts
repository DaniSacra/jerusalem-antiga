import { RULES } from './data';
import { cellsOf, indexOf } from './grid';
import type { Building, GameState, ServiceKind } from './types';

const H = RULES.happiness;

export type Mood = 'happy' | 'neutral' | 'sad';
/** One reason for a house's happiness, with its points (positive or negative). */
export interface HappinessPart {
  kind: 'sacred' | 'park' | 'plaza' | 'market' | 'famine' | 'idle';
  value: number;
}
export interface Happiness {
  /** 0..100 (50 = neutral). */
  value: number;
  mood: Mood;
  parts: HappinessPart[];
}

const covered = (s: GameState, b: Building, k: ServiceKind) => cellsOf(b).some((c) => s.coverage[k][indexOf(s, c.x, c.y)]);

/** Happiness is shown and has effects only once the park is unlocked. */
export const happinessOn = (s: GameState) => s.unlocked.includes('park');

export const moodOf = (value: number): Mood => (value >= H.happy ? 'happy' : value < H.sad ? 'sad' : 'neutral');

/**
 * Happiness of a house: 50, plus being near the altar or temple, a park, a plaza and a market,
 * minus famine and the share of the city's workers without a job (`idleShare`, 0..1).
 */
export function houseHappiness(s: GameState, b: Building, idleShare: number): Happiness {
  const parts: HappinessPart[] = [];
  // Happiness only counts once the park (the way to raise it) is unlocked: content until then.
  if (!happinessOn(s)) return { value: H.base, mood: moodOf(H.base), parts };
  for (const k of ['sacred', 'park', 'plaza', 'market'] as const) if (covered(s, b, k)) parts.push({ kind: k, value: H[k] });
  if (s.famine) parts.push({ kind: 'famine', value: H.famine });
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

/** Tax multiplier of a house (happy houses pay more). */
export const taxFactor = (value: number) => scale(value, H.taxMin, H.taxMax);

/** Birth chance multiplier for the city's average happiness. */
export const birthFactor = (cityValue: number) => scale(cityValue, H.birthMin, H.birthMax);

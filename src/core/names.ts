import { NAMES } from './data';
import type { GameState, Rng, Sex } from './types';

const pick = <T>(items: T[], rng: Rng): T => items[Math.floor(rng() * items.length)];

/** A given name for a new person of this sex, avoiding the names of the living (repeats once all are taken). */
export function pickName(s: GameState, sex: Sex, rng: Rng): string {
  const all = sex === 'm' ? NAMES.male : NAMES.female;
  const taken = new Set(s.people.map((p) => p.name));
  const free = all.filter((n) => !taken.has(n));
  return pick(free.length ? free : all, rng);
}

/** A family name (clan index) no one in the records has yet (repeats once all are taken), never `avoid`. */
export function pickClan(s: GameState, rng: Rng, avoid?: number): number {
  const taken = new Set([...s.people, ...s.departed].map((p) => p.clan));
  const all = NAMES.clans.map((_, k) => k).filter((k) => k !== avoid);
  const free = all.filter((k) => !taken.has(k));
  return pick(free.length ? free : all, rng);
}

export const clanName = (clan: number) => NAMES.clans[clan] ?? '';

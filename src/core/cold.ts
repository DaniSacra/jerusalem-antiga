import { RULES } from './data';
import { ageBand, ageOf, depart, vacate } from './people';
import { seasonOf } from './seasons';
import type { GameEvent, GameState, Person, Rng } from './types';

/**
 * Cold deaths (Package B3): each winter week every resident of a house draws its own chance of
 * dying of cold (`rules.coldDeath`), by the house (tent or better), whether the city has firewood
 * (`s.cold`) and whether the person is vulnerable (a small child or an elder). Famine multiplies it.
 * Runs after the firewood burn and before the houses.
 */

const C = RULES.coldDeath;

/** Small children (up to `childAge`) and elders are vulnerable to the cold. */
export const vulnerable = (s: GameState, p: Person): boolean => ageOf(p, s.week) <= C.childAge || ageBand(p, s.week) === 'elder';

/** This week's chance that this resident dies of cold (0 out of winter or on the way). */
export function coldDeathChance(s: GameState, p: Person): number {
  if (seasonOf(s.week) !== 'winter' || p.houseId === null) return 0;
  const home = s.buildings.find((b) => b.id === p.houseId);
  if (!home || home.level < 1) return 0;
  const pair = home.level === 1 ? (s.cold ? C.tentCold : C.tent) : s.cold ? C.houseCold : null;
  if (!pair) return 0;
  const chance = pair[vulnerable(s, p) ? 0 : 1];
  return s.famine ? Math.min(1, chance * C.famineFactor) : chance;
}

/** Draws the week's cold deaths (no draw when the chance is 0), with a `coldDeath` event each. */
export function coldDeaths(s: GameState, rng: Rng, events: GameEvent[]): void {
  if (seasonOf(s.week) !== 'winter') return;
  for (const p of [...s.people]) {
    const chance = coldDeathChance(s, p);
    if (chance <= 0 || rng() >= chance) continue;
    const home = s.buildings.find((b) => b.id === p.houseId)!;
    const age = ageOf(p, s.week);
    depart(s, p, 'coldDeath');
    vacate(s, home.id);
    s.winterLoss = true;
    events.push({ type: 'coldDeath', id: p.id, age, x: home.x, y: home.y });
  }
}

/** People the cold killed from this week on (the winter's toll at the spring). */
export const coldDeathsSince = (s: GameState, week: number): number =>
  s.departed.filter((p) => p.end?.cause === 'coldDeath' && p.end.week >= week).length;

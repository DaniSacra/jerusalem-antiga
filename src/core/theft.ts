import { RULES, statOf } from './data';
import type { Building, GameEvent, GameState } from './types';
import { crewCounts } from './work';

/**
 * Theft (plano-dificuldade C): from `theft.minPeople` residents on, every granary on the road with
 * nobody at work there loses `theft.share` a week of the food stored in it: the food above
 * `baseFoodStorage`, shared out between the granaries by their capacity. A granary with its keeper
 * loses nothing.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Residents of the city (people living in a house). */
const residents = (s: GameState) => s.people.reduce((n, p) => n + (p.houseId !== null ? 1 : 0), 0);

/** Food stolen this week from each unguarded granary (by id); empty below `minPeople`. */
export function theftAt(s: GameState, crews = crewCounts(s)): Map<number, number> {
  const out = new Map<number, number>();
  if (residents(s) < RULES.theft.minPeople) return out;
  const stores = s.buildings.filter((b) => b.connected && statOf(b, 'storage') > 0);
  const cap = stores.reduce((a, b) => a + statOf(b, 'storage'), 0);
  const above = Math.max(0, s.food - RULES.baseFoodStorage);
  if (!cap || !above) return out;
  for (const b of stores) {
    if (crews.get(b.id)) continue;
    const n = round2(above * (statOf(b, 'storage') / cap) * RULES.theft.share);
    if (n > 0) out.set(b.id, n);
  }
  return out;
}

/** The food stolen this week in all (counted in `Economy.foodDelta`). */
export const theftTotal = (s: GameState, crews = crewCounts(s)) => round2([...theftAt(s, crews).values()].reduce((a, n) => a + n, 0));

/** Marks the robbed granaries and tells once per episode (`Building.robbed`), with what was taken. */
export function noteTheft(s: GameState, stolen: Map<number, number>, events: GameEvent[]): void {
  for (const b of s.buildings as Building[]) {
    if (!statOf(b, 'storage')) continue;
    const n = stolen.get(b.id) ?? 0;
    if (n > 0 && !b.robbed) events.push({ type: 'granaryRobbed', amount: n, x: b.x, y: b.y });
    b.robbed = n > 0 || undefined;
  }
}

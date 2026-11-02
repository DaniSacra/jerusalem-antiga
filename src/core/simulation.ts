import { HOUSE_LEVELS, RULES } from './data';
import { computeEconomy, round2 } from './economy';
import { dispatchFamilies, moveFamilies } from './families';
import { checkGoal } from './goals';
import { hasNeeds } from './houses';
import { refreshCity } from './refresh';
import type { Building, GameEvent, GameState, Rng } from './types';

function changeLevel(b: Building, dir: 1 | -1, famine: boolean, events: GameEvent[]) {
  const before = HOUSE_LEVELS[b.level].residents;
  b.level += dir;
  b.upStreak = 0;
  b.downStreak = 0;
  const delta = HOUSE_LEVELS[b.level].residents - before;
  const { x, y } = b;
  events.push(dir > 0 ? { type: 'houseUp', x, y, level: b.level, delta } : { type: 'houseDown', x, y, level: b.level, delta, famine });
}

/** Plots (level 0) are filled by arriving families, not here. */
function updateHouse(s: GameState, b: Building, rng: Rng, events: GameEvent[]) {
  if (b.level === 0) return;
  if (!hasNeeds(s, b, HOUSE_LEVELS[b.level].needs)) {
    b.upStreak = 0;
    if (++b.downStreak >= RULES.monthsToChange) changeLevel(b, -1, false, events);
    return;
  }
  b.downStreak = 0;
  if (s.famine) {
    b.upStreak = 0;
    if (b.level > 1 && rng() < RULES.famineDropChance) changeLevel(b, -1, true, events);
    return;
  }
  const next = HOUSE_LEVELS[b.level + 1];
  if (next && hasNeeds(s, b, next.needs)) {
    if (++b.upStreak >= RULES.monthsToChange) changeLevel(b, 1, false, events);
  } else {
    b.upStreak = 0;
  }
}

/** Advances the simulation by one month and returns what happened. */
export function stepMonth(s: GameState, rng: Rng): GameEvent[] {
  const events: GameEvent[] = [];
  refreshCity(s);

  const eco = computeEconomy(s);
  const wasFamine = s.famine;
  s.food = round2(s.food + eco.foodDelta);
  s.famine = s.food <= 0 && eco.foodDelta < 0;
  if (s.food < 0) s.food = 0;
  if (s.famine && !wasFamine) events.push({ type: 'famineStart' });
  if (!s.famine && wasFamine) events.push({ type: 'famineEnd' });

  s.silver = round2(s.silver + eco.silverDelta);

  moveFamilies(s, events);
  for (const b of s.buildings) if (b.kind === 'house') updateHouse(s, b, rng, events);
  dispatchFamilies(s, rng);

  s.month++;
  checkGoal(s, events);
  return events;
}

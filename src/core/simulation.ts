import { updateCoverage } from './coverage';
import { HOUSE_LEVELS, RULES } from './data';
import { computeEconomy, round2 } from './economy';
import { checkGoal } from './goals';
import { cellOf } from './grid';
import { hasNeeds } from './houses';
import type { Building, GameEvent, GameState, Rng } from './types';

function changeLevel(s: GameState, b: Building, i: number, dir: 1 | -1, famine: boolean, events: GameEvent[]) {
  const before = HOUSE_LEVELS[b.level].residents;
  b.level += dir;
  b.upStreak = 0;
  b.downStreak = 0;
  const delta = HOUSE_LEVELS[b.level].residents - before;
  const { x, y } = cellOf(s, i);
  events.push(dir > 0 ? { type: 'houseUp', x, y, level: b.level, delta } : { type: 'houseDown', x, y, level: b.level, delta, famine });
}

function updateHouse(s: GameState, b: Building, i: number, rng: Rng, events: GameEvent[]) {
  if (b.level === 0) {
    if (!s.famine && rng() < RULES.tentChance) changeLevel(s, b, i, 1, false, events);
    return;
  }
  if (!hasNeeds(s, i, HOUSE_LEVELS[b.level].needs)) {
    b.upStreak = 0;
    if (++b.downStreak >= RULES.monthsToChange) changeLevel(s, b, i, -1, false, events);
    return;
  }
  b.downStreak = 0;
  if (s.famine) {
    b.upStreak = 0;
    if (b.level > 1 && rng() < RULES.famineDropChance) changeLevel(s, b, i, -1, true, events);
    return;
  }
  const next = HOUSE_LEVELS[b.level + 1];
  if (next && hasNeeds(s, i, next.needs)) {
    if (++b.upStreak >= RULES.monthsToChange) changeLevel(s, b, i, 1, false, events);
  } else {
    b.upStreak = 0;
  }
}

/** Advances the simulation by one month and returns what happened. */
export function stepMonth(s: GameState, rng: Rng): GameEvent[] {
  const events: GameEvent[] = [];
  updateCoverage(s);

  const eco = computeEconomy(s);
  const wasFamine = s.famine;
  s.food = round2(s.food + eco.foodDelta);
  s.famine = s.food <= 0 && eco.foodDelta < 0;
  if (s.food < 0) s.food = 0;
  if (s.famine && !wasFamine) events.push({ type: 'famineStart' });
  if (!s.famine && wasFamine) events.push({ type: 'famineEnd' });

  s.silver = round2(s.silver + eco.silverDelta);

  s.buildings.forEach((b, i) => {
    if (b?.kind === 'house') updateHouse(s, b, i, rng, events);
  });

  s.month++;
  checkGoal(s, events);
  return events;
}

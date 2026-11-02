import { HOUSE_LEVELS, RULES } from './data';
import { computeEconomy, round2 } from './economy';
import { dispatchFamilies, moveFamilies } from './families';
import { checkGoal } from './goals';
import { hasNeeds } from './houses';
import { rollLook } from './looks';
import { refreshCity } from './refresh';
import type { Building, GameEvent, GameState, Rng } from './types';

function changeLevel(s: GameState, b: Building, dir: 1 | -1, famine: boolean, rng: Rng, events: GameEvent[]) {
  const before = HOUSE_LEVELS[b.level].residents;
  b.level += dir;
  b.upStreak = 0;
  b.downStreak = 0;
  rollLook(s, b, rng);
  const delta = HOUSE_LEVELS[b.level].residents - before;
  const { x, y } = b;
  events.push(dir > 0 ? { type: 'houseUp', x, y, level: b.level, delta } : { type: 'houseDown', x, y, level: b.level, delta, famine });
}

/** Plots (level 0) are filled by arriving families, not here. */
function updateHouse(s: GameState, b: Building, rng: Rng, events: GameEvent[]) {
  if (b.level === 0) return;
  if (!hasNeeds(s, b, HOUSE_LEVELS[b.level].needs)) {
    b.upStreak = 0;
    if (++b.downStreak >= RULES.monthsToChange) changeLevel(s, b, -1, false, rng, events);
    return;
  }
  b.downStreak = 0;
  if (s.famine) {
    b.upStreak = 0;
    if (b.level > 1) {
      if (rng() < RULES.famineDropChance) changeLevel(s, b, -1, true, rng, events);
    } else if (rng() < RULES.famineLeaveChance) {
      // The family abandons its tent and walks out of the city; the plot waits for a new family.
      changeLevel(s, b, -1, true, rng, events);
      events.push({ type: 'familyLeft', x: b.x, y: b.y });
    }
    return;
  }
  const next = HOUSE_LEVELS[b.level + 1];
  if (next && hasNeeds(s, b, next.needs)) {
    if (++b.upStreak >= RULES.monthsToChange) changeLevel(s, b, 1, false, rng, events);
  } else {
    b.upStreak = 0;
  }
}

/** Counts consecutive months ended in debt; the city is lost after RULES.debtMonthsToLose. */
function updateDebt(s: GameState, events: GameEvent[]) {
  if (s.silver >= 0) {
    if (s.debtMonths > 0) events.push({ type: 'debtEnd' });
    s.debtMonths = 0;
    return;
  }
  if (s.debtMonths === 0) events.push({ type: 'debtStart' });
  s.debtMonths++;
  if (s.debtMonths >= RULES.debtMonthsToLose) {
    s.lost = true;
    events.push({ type: 'defeat', month: s.month, peak: s.peakPopulation });
  }
}

/** Advances the simulation by one month and returns what happened. Nothing happens once lost. */
export function stepMonth(s: GameState, rng: Rng): GameEvent[] {
  const events: GameEvent[] = [];
  if (s.lost) return events;
  refreshCity(s);

  const eco = computeEconomy(s);
  const wasFamine = s.famine;
  s.food = round2(s.food + eco.foodDelta);
  s.famine = s.food <= 0 && eco.foodDelta < 0;
  if (s.food < 0) s.food = 0;
  if (s.famine && !wasFamine) events.push({ type: 'famineStart' });
  if (!s.famine && wasFamine) events.push({ type: 'famineEnd' });

  s.silver = round2(s.silver + eco.silverDelta);

  // New families set out and walk in the same month, so the first tent comes quickly.
  dispatchFamilies(s, rng);
  moveFamilies(s, events, rng);
  for (const b of s.buildings) if (b.kind === 'house') updateHouse(s, b, rng, events);

  s.month++;
  s.peakPopulation = Math.max(s.peakPopulation, computeEconomy(s).residents);
  checkGoal(s, events);
  updateDebt(s, events);
  return events;
}

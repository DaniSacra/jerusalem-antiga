import { GOALS, RULES } from './data';
import { computeEconomy } from './economy';
import { foodForecast } from './forecast';
import { weeksToHarvest } from './harvest';
import { countHousesAtLeast, needMet } from './houses';
import type { GameEvent, GameState, GoalDef, Placeable } from './types';

export const currentGoal = (s: GameState): GoalDef | undefined => GOALS[s.goalIndex];

export function goalProgress(s: GameState, goal: GoalDef): number {
  if (goal.type === 'residents') return computeEconomy(s).residents;
  if (goal.type === 'foodUntilSpring') return foodWeeksUntilSpring(s);
  if (goal.type === 'water') return familyHouses(s).filter((b) => needMet(s, b, 'well')).length;
  if (goal.type === 'harvest') return s.harvested;
  if (goal.type === 'houses') return countHousesAtLeast(s, goal.level ?? 0);
  return s.buildings.filter((b) => b.kind === goal.kind && b.connected).length;
}

/** 1-based number of the goal that unlocks something, or null if it starts unlocked. */
export function unlockingGoal(kind: Placeable): number | null {
  const i = GOALS.findIndex((g) => g.unlock === kind);
  return i < 0 ? null : i + 1;
}

export function checkGoal(s: GameState, events: GameEvent[]): void {
  const goal = currentGoal(s);
  if (!goal || goalProgress(s, goal) < goalTarget(s, goal)) return;
  const index = s.goalIndex;
  s.goalIndex++;
  s.silver += goal.reward;
  if (goal.unlock && !s.unlocked.includes(goal.unlock)) s.unlocked.push(goal.unlock);
  if (goal.victory) {
    s.won = true;
    events.push({ type: 'victory', week: s.week, residents: computeEconomy(s).residents });
  } else {
    events.push({ type: 'goal', index, reward: goal.reward, unlock: goal.unlock });
  }
  if (s.goalIndex === RULES.upkeepStartsAfterGoal) events.push({ type: 'upkeepStart' });
}

/** Weeks until the first spring of the game (0 once it began). */
const FIRST_SPRING = weeksToHarvest(0);
const weeksToFirstSpring = (s: GameState) => Math.max(0, FIRST_SPRING - s.week);

/**
 * Weeks the food lasts by the forecast (every house at its target level), up to the weeks left
 * until the first spring. Once the spring came, 1 unless the city is starving (then the goal
 * waits for the food to come back).
 */
function foodWeeksUntilSpring(s: GameState): number {
  const left = weeksToFirstSpring(s);
  if (left === 0) return s.famine ? 0 : 1;
  const out = foodForecast(s, computeEconomy(s), left);
  return out ? out.weeks : left;
}

/** Houses with a family that count for the water goal. */
const familyHouses = (s: GameState) => s.buildings.filter((b) => b.kind === 'house' && b.connected && b.level > 0);

/**
 * The target shown and checked for a goal: most goals use `target`; "food until spring" is the
 * weeks left until the first spring (1 from then on), and "water" is every connected house with
 * a family, at least `target`.
 */
export function goalTarget(s: GameState, goal: GoalDef): number {
  if (goal.type === 'foodUntilSpring') return Math.max(1, weeksToFirstSpring(s));
  if (goal.type === 'water') return Math.max(goal.target, familyHouses(s).length);
  return goal.target;
}

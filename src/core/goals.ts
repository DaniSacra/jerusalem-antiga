import { GOALS } from './data';
import { computeEconomy } from './economy';
import { foodForecast } from './forecast';
import { weeksToHarvest } from './harvest';
import { countHousesAtLeast } from './houses';
import { WEEKS_PER_YEAR } from './seasons';
import type { GameEvent, GameState, GoalDef, MilestoneId, Placeable } from './types';

export const currentGoal = (s: GameState): GoalDef | undefined => GOALS[s.goalIndex];

export function goalProgress(s: GameState, goal: GoalDef): number {
  if (goal.type === 'residents') return computeEconomy(s).residents;
  if (goal.type === 'foodUntilSpring') return foodWeeksUntilSpring(s);
  if (goal.type === 'houses') return countHousesAtLeast(s, goal.level ?? 0);
  if (goal.type === 'milestone') return goal.milestone && s.milestones.includes(goal.milestone) ? 1 : 0;
  if (goal.type === 'templeStage') return s.temple.done >= (goal.stage ?? Infinity) ? 1 : 0;
  return s.buildings.filter((b) => b.kind === goal.kind && b.connected).length;
}

/** 1-based number of the goal that unlocks something, or null if it starts unlocked. */
export function unlockingGoal(kind: Placeable): number | null {
  const i = GOALS.findIndex((g) => g.unlock === kind);
  return i < 0 ? null : i + 1;
}

/** Year of the game a week falls in (1 = the first year). */
export const yearOf = (week: number) => Math.floor(week / WEEKS_PER_YEAR) + 1;

/** The goal waits for its `fromYear`: it cannot be reached before that year begins. */
export const goalOpen = (s: GameState, goal: GoalDef) => yearOf(s.week) >= (goal.fromYear ?? 1);

/** Completes the current goal if it is met: one goal per check (the next waits for the next week). */
export function checkGoal(s: GameState, events: GameEvent[]): void {
  completeGoal(s, events);
}

function completeGoal(s: GameState, events: GameEvent[]): boolean {
  const goal = currentGoal(s);
  if (!goal || !goalOpen(s, goal) || goalProgress(s, goal) < goalTarget(s, goal)) return false;
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
  return true;
}

/** Records a milestone the first time only (with its week and an event). */
export function reach(s: GameState, id: MilestoneId, events: GameEvent[]) {
  if (s.milestones.includes(id)) return;
  s.milestones.push(id);
  s.milestoneWeeks[id] = s.week;
  events.push({ type: 'milestone', id });
}

/** Weeks until the first spring of the game (0 once it began). */
const FIRST_SPRING = weeksToHarvest(0);
const weeksToFirstSpring = (s: GameState) => Math.max(0, FIRST_SPRING - s.week);

/**
 * Weeks the food lasts by the forecast (every house at its planned level), up to the weeks left
 * until the first spring. Once the spring came, 1 unless the city is starving (then the goal
 * waits for the food to come back). A city with nobody living in it has nothing to feed: 0, even
 * with a family on the way, so the goal is not met by everyone leaving.
 */
function foodWeeksUntilSpring(s: GameState): number {
  if (computeEconomy(s).residents === 0) return 0;
  const left = weeksToFirstSpring(s);
  if (left === 0) return s.famine ? 0 : 1;
  const out = foodForecast(s, computeEconomy(s), left);
  return out ? out.weeks : left;
}

/**
 * The target shown and checked for a goal: most goals use `target`; "food until spring" is the
 * weeks left until the first spring (1 from then on).
 */
export function goalTarget(s: GameState, goal: GoalDef): number {
  if (goal.type === 'foodUntilSpring') return Math.max(1, weeksToFirstSpring(s));
  return goal.target;
}

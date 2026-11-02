import { GOALS, RULES } from './data';
import { computeEconomy } from './economy';
import { countHousesAtLeast } from './houses';
import type { GameEvent, GameState, GoalDef, Placeable } from './types';

export const currentGoal = (s: GameState): GoalDef | undefined => GOALS[s.goalIndex];

export function goalProgress(s: GameState, goal: GoalDef): number {
  if (goal.type === 'residents') return computeEconomy(s).residents;
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
  if (!goal || goalProgress(s, goal) < goal.target) return;
  const index = s.goalIndex;
  s.goalIndex++;
  s.silver += goal.reward;
  if (goal.unlock && !s.unlocked.includes(goal.unlock)) s.unlocked.push(goal.unlock);
  if (goal.victory) {
    s.won = true;
    events.push({ type: 'victory', month: s.month, residents: computeEconomy(s).residents });
  } else {
    events.push({ type: 'goal', index, reward: goal.reward, unlock: goal.unlock });
  }
  if (s.goalIndex === RULES.upkeepStartsAfterGoal) events.push({ type: 'upkeepStart' });
}

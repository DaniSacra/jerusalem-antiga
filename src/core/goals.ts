import { GOALS } from './data';
import { computeEconomy } from './economy';
import { countHousesAtLeast } from './houses';
import type { BuildingKind, GameEvent, GameState, GoalDef } from './types';

export const currentGoal = (s: GameState): GoalDef | undefined => GOALS[s.goalIndex];

export function goalProgress(s: GameState, goal: GoalDef): number {
  return goal.type === 'residents' ? computeEconomy(s).residents : countHousesAtLeast(s, goal.level ?? 0);
}

/** 1-based number of the goal that unlocks a building, or null if it starts unlocked. */
export function unlockingGoal(kind: BuildingKind): number | null {
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
    events.push({ type: 'victory', month: s.month });
  } else {
    events.push({ type: 'goal', index, reward: goal.reward, unlock: goal.unlock });
  }
}

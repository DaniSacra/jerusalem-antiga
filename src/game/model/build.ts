import { BUILDINGS, costOf, GOALS, materialsOf, MATERIALS, unlockingGoal, type BuildableKind, type GameState } from '../../core';
import { T } from '../strings';
import { COLUMN_ORDER, keyOf, type Tool } from '../tools';

/** One button of the building column, as data. */
export interface BuildButton {
  kind: BuildableKind;
  name: string;
  /** Not unlocked yet: the line says which goal unlocks it. */
  locked: boolean;
  /** Unlocked but the city cannot pay for it now (the price turns red). */
  short: boolean;
  /** Picked as the tool in hand. */
  on: boolean;
  /** "40 prata · 10 madeira · 3" (the key on PC), or "objetivo 7". */
  line: string;
}

/** The building column, in its order: name, price or the goal that unlocks it, and whether it is affordable. */
export function buildColumn(s: GameState, tool: Tool, phone: boolean): BuildButton[] {
  return COLUMN_ORDER.map((kind) => {
    const locked = !s.unlocked.includes(kind);
    const cost = costOf(kind);
    const m = materialsOf(kind);
    const short = !locked && (s.silver < cost || MATERIALS.some((x) => (m[x] ?? 0) > s[x]));
    const goal = unlockingGoal(kind) ?? 0;
    const line = locked
      ? T.nova.lockedGoal(goal, GOALS[goal - 1]?.fromYear)
      : [T.nova.silverCost(cost), ...MATERIALS.filter((x) => m[x]).map((x) => T.nova.materialCost(m[x]!, x))].join(' · ') + (phone ? '' : ` · ${keyOf(kind)}`);
    return { kind, name: BUILDINGS[kind].name, locked, short, on: tool === kind, line };
  });
}

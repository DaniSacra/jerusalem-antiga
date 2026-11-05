import { BUILDINGS, RULES } from './data';
import { round2, type Economy } from './economy';
import { cellOf, cellsInRadius } from './grid';
import { gatherYield, isTree } from './harvest';
import type { Building, GameEvent, GameState, Stump, TreeFeature } from './types';

/**
 * Cutting and regrowth. Every `cutEvery` wood a lumber makes, it cuts the tree in its radius
 * nearest to it (squared distance from the cell to its footprint, ties to the lower cell index):
 * the cell becomes a stump. A stump gives nothing and blocks nothing; building or laying a road on
 * it removes it for free. A stump left alone for `treeRegrowWeeks` grows back into the same tree.
 */

/** Squared distance from cell i to the nearest cell of a building's footprint. */
function dist2(s: GameState, b: Building, i: number): number {
  const c = cellOf(s, i);
  const dx = Math.max(b.x - c.x, 0, c.x - (b.x + b.w - 1));
  const dy = Math.max(b.y - c.y, 0, c.y - (b.y + b.h - 1));
  return dx * dx + dy * dy;
}

/** The tree a lumber cuts next: the nearest in its radius, the lower index on ties; null if none. */
export function nextTreeToCut(s: GameState, b: Building): number | null {
  const g = BUILDINGS[b.kind].gather;
  if (!g) return null;
  let best: number | null = null;
  for (const i of cellsInRadius(s, b.x, b.y, g.radius, b.w, b.h)) {
    if (isTree(s.feature[i]) && (best === null || dist2(s, b, i) < dist2(s, b, best))) best = i;
  }
  return best;
}

/** Each connected lumber adds this week's wood to its count and cuts a tree for every `cutEvery`. */
export function cutTrees(s: GameState, eco: Economy, events: GameEvent[]): void {
  for (const b of s.buildings) {
    const every = BUILDINGS[b.kind].cutEvery;
    if (!every || !b.connected) continue;
    b.cutProgress = round2((b.cutProgress ?? 0) + gatherYield(s, b) * eco.efficiency * eco.stored.wood); // only the wood that was stored
    while (b.cutProgress >= every) {
      const i = nextTreeToCut(s, b);
      if (i === null) {
        b.cutProgress = every; // no tree left: one cut waits, no backlog of fellings
        break;
      }
      b.cutProgress = round2(b.cutProgress - every);
      const kind = s.feature[i] as TreeFeature;
      s.feature[i] = 'stump';
      s.stumps.push({ i, kind, week: s.week });
      events.push({ type: 'treeCut', ...cellOf(s, i), kind });
    }
  }
}

/** Stumps cut `treeRegrowWeeks` ago or more turn back into their trees. */
export function regrowTrees(s: GameState, events: GameEvent[]): void {
  s.stumps = s.stumps.filter((t) => {
    if (s.week - t.week < RULES.treeRegrowWeeks) return true;
    s.feature[t.i] = t.kind;
    events.push({ type: 'treeRegrown', ...cellOf(s, t.i), kind: t.kind });
    return false;
  });
}

/** Weeks until the stump on cell i grows back (at least 1; a full cycle when it is not listed). */
export function regrowLeft(s: GameState, i: number): number {
  const cut = s.stumps.find((t) => t.i === i);
  return cut ? Math.max(1, RULES.treeRegrowWeeks - (s.week - cut.week)) : RULES.treeRegrowWeeks;
}

/** A stump past half its regrowth shows a sprout (looks only). */
export const isSprouting = (s: GameState, t: Stump): boolean => s.week - t.week >= RULES.treeRegrowWeeks / 2;

/** Building or laying a road on a stump removes it (no cost, it never grows back). */
export function clearStump(s: GameState, i: number): void {
  if (s.feature[i] !== 'stump') return;
  s.feature[i] = null;
  s.stumps = s.stumps.filter((t) => t.i !== i);
}

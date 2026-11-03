import { alerts, familyBlock, type Economy, type GameState } from '../../core';
import { T } from '../strings';

/** One line of the Avisos list (and of the statistics problems): the core's alerts plus why no family comes. */
export interface Notice {
  /** Same key while the same problem lasts (one toast per episode). */
  key: string;
  text: string;
  /** Red (urgent) instead of orange. */
  bad: boolean;
  /** Shown as a toast when it starts. */
  toast: boolean;
}

/** The standing warnings, most urgent first. "No plot" is a normal state, so it never toasts. */
export function notices(s: GameState, eco: Economy): Notice[] {
  const out: Notice[] = alerts(s, eco).map((a) => ({ key: a.kind, text: T.alert(a), bad: a.kind === 'debt' || a.kind === 'foodShort', toast: true }));
  const block = familyBlock(s, eco);
  // "No plot" while a family walks in would be wrong: one is coming.
  if (block && block !== 'wait' && !(block === 'noPlot' && s.families.length > 0)) out.push({ key: `family-${block}`, text: T.familyBlock[block], bad: block === 'famine', toast: block !== 'noPlot' });
  return out;
}

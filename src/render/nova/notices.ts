import { alerts, seasonOf, type CityReadout, type GameState } from '../../core';
import { T } from '../strings';

/** One line of the Avisos list (and of the statistics problems): the core's alerts plus why no family comes. */
export interface Notice {
  /** Same key while the same problem lasts (one toast per episode); a waiting toast is dropped once its key is gone. */
  key: string;
  text: string;
  /** Red (urgent) instead of orange. */
  bad: boolean;
  /** Shown as a toast when it starts. */
  toast: boolean;
  /** Why no family comes (the tutorial bubble says it instead of a toast). */
  family?: boolean;
}

/** The standing warnings, most urgent first. "No plot" is a normal state, so it never toasts. */
export function notices(s: GameState, { eco, block }: CityReadout): Notice[] {
  // The food warning stands all year; it toasts only when it starts in the summer (the last call before the winter).
  const out: Notice[] = alerts(s, eco).map((a) => ({ key: a.kind === 'spoiling' ? `spoiling-${a.locked}` : a.kind, text: T.alert(a), bad: a.kind === 'debt' || a.kind === 'foodShort', toast: a.kind !== 'foodShort' || seasonOf(s.week) === 'summer' }));
  // "No plot" while a family walks in would be wrong: one is coming.
  if (block && block !== 'wait' && !(block === 'noPlot' && s.families.length > 0)) out.push({ key: `family-${block}`, text: T.familyBlockText(block, s), bad: block === 'famine', toast: block !== 'noPlot', family: true });
  return out;
}

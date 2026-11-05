import { alerts, seasonOf, type CityReadout, type GameState } from '../../core';
import { T } from '../strings';

/** One line of the Avisos list (and of the statistics problems): the core's alerts. */
export interface Notice {
  /** Same key while the same problem lasts (one toast per episode); a waiting toast is dropped once its key is gone. */
  key: string;
  text: string;
  /** Red (urgent) instead of orange. */
  bad: boolean;
  /** Shown as a toast when it starts. */
  toast: boolean;
}

/** Warnings about the couples and births: the tutorial bubble already speaks of them while it runs. */
const PEOPLE_KINDS = new Set(['couples', 'noBirths']);

/** The standing warnings, most urgent first (`tutorial`: the first-game tutorial is running). */
export function notices(s: GameState, { eco }: CityReadout, tutorial = false): Notice[] {
  // The food warning stands all year; it toasts only when it starts in the summer (the last call before the winter).
  return alerts(s, eco).map((a) => ({
    key: a.kind === 'spoiling' ? `spoiling-${a.locked}` : a.kind === 'material' ? `material-${a.material}` : a.kind,
    text: T.alert(a),
    bad: a.kind === 'debt' || a.kind === 'foodShort',
    toast: (a.kind !== 'foodShort' || seasonOf(s.week) === 'summer') && !(tutorial && PEOPLE_KINDS.has(a.kind)),
  }));
}

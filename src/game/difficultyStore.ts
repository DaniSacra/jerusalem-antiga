import { DIFFICULTIES, type Difficulty } from '../core';

/** The last difficulty chosen on the title screen, kept in the browser (Normal the first time). */

const KEY = 'jerusalem.difficulty';
/** The choice of this visit, for when the storage is blocked. */
let chosen: Difficulty | null = null;

export function savedDifficulty(): Difficulty {
  try {
    const v = localStorage.getItem(KEY) as Difficulty | null;
    if (v && DIFFICULTIES.includes(v)) return v;
  } catch {
    // Blocked storage: the choice of this visit.
  }
  return chosen ?? 'normal';
}

export function saveDifficulty(d: Difficulty) {
  chosen = d;
  try {
    localStorage.setItem(KEY, d);
  } catch {
    // Blocked storage: the choice holds for this visit only.
  }
}

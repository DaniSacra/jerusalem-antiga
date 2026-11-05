/** Whether the player finished or skipped the first-game tutorial, kept in the browser. */

const KEY = 'jerusalem.tutorialDone';

/** True once the player finished or skipped the tutorial (false if the storage is blocked). */
export function tutorialSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Remembers that the tutorial was seen (blocked storage: it simply comes back next game). */
export function saveTutorialSeen() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // Nothing to do.
  }
}

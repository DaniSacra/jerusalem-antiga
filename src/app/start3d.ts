import { Session } from '../game/session';
import { saveTutorialSeen, tutorialSeen } from '../game/tutorialStore';
import { T } from '../game/strings';
import { showTitle } from '../ui/title';

/** Dev builds: `?seed=N` fixes the map (the visual tests use it). */
function devSeed(): number | null {
  if (!import.meta.env.DEV) return null;
  const v = new URLSearchParams(location.search).get('seed');
  return v === null ? null : Number(v) >>> 0;
}

/**
 * The game: a new session drawn by Three.js under the HTML interface, after the HTML title screen.
 * A defeat starts a new session in place (no title).
 */
export async function start3d(seed = devSeed() ?? (Math.random() * 2 ** 32) >>> 0, title = true) {
  // The title screen shows while Three.js and the models download.
  const [{ Play3D }, { tutorial }] = await Promise.all([import('./play3d'), title ? showTitle() : { tutorial: false }]);
  const session = new Session({ seed, tutorial, seen: tutorialSeen(), saveSeen: saveTutorialSeen });
  const game = await Play3D.open(session, {
    restart: (sameMap) => {
      game.close();
      void start3d(sameMap ? seed : (Math.random() * 2 ** 32) >>> 0, false);
    },
  });
  const s = session.state;
  if (s.week === 0) {
    const weeks = session.city.forecast?.weeks ?? s.start.foodWeeks;
    session.say(T.caravan(s.start.families, weeks), 'good');
  }
  if (import.meta.env.DEV) {
    const core = await import('../core');
    Object.assign(window, { session, state: s, core });
  }
}

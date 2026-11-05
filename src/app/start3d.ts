import { Session } from '../game/session';
import { tutorialSeen } from '../game/tutorial';
import { T } from '../render/strings';

/** Dev builds: `?seed=N` fixes the map (the visual tests use it). */
function devSeed(): number | null {
  if (!import.meta.env.DEV) return null;
  const v = new URLSearchParams(location.search).get('seed');
  return v === null ? null : Number(v) >>> 0;
}

/**
 * The 3D game on its own (`?view=3d`, or the 3D setting): a new session drawn by Three.js under the
 * HTML interface, no Phaser at all. A defeat starts a new session in place.
 */
export async function start3d(seed = devSeed() ?? (Math.random() * 2 ** 32) >>> 0) {
  const { Game3D } = await import('../render3d/game3d');
  const session = new Session({ seed, tutorial: false, seen: tutorialSeen() });
  const game = await Game3D.open(session, {
    exit: null,
    restart: (sameMap) => {
      game.close();
      void start3d(sameMap ? seed : undefined);
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

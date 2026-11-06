import { seasonOf } from '../core';
import type { MoodInput } from '../game/music/score';
import { Session } from '../game/session';
import { onSettings } from '../game/settings';
import { Music } from './music';
import { saveTutorialSeen, tutorialSeen } from '../game/tutorialStore';
import { T } from '../game/strings';
import { showTitle } from '../ui/title';

/** Dev builds: `?seed=N` fixes the map (the visual tests use it). */
function devSeed(): number | null {
  if (!import.meta.env.DEV) return null;
  const v = new URLSearchParams(location.search).get('seed');
  return v === null ? null : Number(v) >>> 0;
}

/** What the music hears: the title plays spring by day; a game its season, night and rain. */
let listen = (): MoodInput => ({ season: 'spring', night: false, rain: false });
/** One music for the whole visit (title and games); it starts on the first tap. */
let music: Music | null = null;

/**
 * The game: a new session drawn by Three.js under the HTML interface, after the HTML title screen.
 * A defeat starts a new session in place (no title).
 */
export async function start3d(seed = devSeed() ?? (Math.random() * 2 ** 32) >>> 0, title = true) {
  if (!music) {
    const m = (music = new Music(() => listen()));
    onSettings(() => m.apply());
    if (import.meta.env.DEV) Object.assign(window, { music: m });
  }
  // The title screen shows while Three.js and the models download.
  const [{ Play3D }, { tutorial }] = await Promise.all([import('./play3d'), title ? showTitle() : { tutorial: false }]);
  const session = new Session({ seed, tutorial, seen: tutorialSeen(), saveSeen: saveTutorialSeen });
  const game = await Play3D.open(session, {
    restart: (sameMap) => {
      game.close();
      void start3d(sameMap ? seed : (Math.random() * 2 ** 32) >>> 0, false);
    },
  });
  listen = () => ({ season: seasonOf(session.state.week), night: game.scene.ambience.night > 0.5, rain: game.scene.ambience.rain > 0.3 });
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

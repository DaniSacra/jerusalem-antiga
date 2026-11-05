import type { Session } from '../game/session';
import { NOVA_CSS, NOVA_FONT } from './palette';
import { T } from './strings';

/** What the 3D game needs from the 2D around it, and how the 2D sleeps and wakes around it. */
export interface Launch3D {
  /** The game being played: the 3D takes it over (the 2D gets it back on the way out). */
  session: Session;
  /** Time of day of the 2D, so the 3D starts at the same moment. */
  dayT: number;
  /** The grid cell at the centre of the 2D screen and the 2D quarter turns (`iso.getRotation()`): the 3D starts there, turned the same way. */
  start?: { focus: { x: number; y: number }; rotation: number };
  /** Puts the 2D to sleep (only one view draws and takes input). */
  pause(): void;
  /** Wakes the 2D and gives it the session back. */
  resume(): void;
  /** A new game from the 3D's defeat screen (the 2D restarts it). */
  restart(sameMap: boolean): void;
  /** The 3D could not open (no WebGL, or the download failed offline). */
  fail(): void;
}

let busy = false;

/**
 * Opens the playable 3D on the 2D's session. Three.js and the 3D come in their own chunk (a
 * dynamic import), so the 2D's first load does not grow; a small loading card shows meanwhile.
 * "2D" in the 3D's top bar comes back.
 */
export async function launch3D(o: Launch3D): Promise<void> {
  if (busy) return;
  busy = true;
  o.pause();
  const card = document.createElement('div');
  card.textContent = T.view3d.loading;
  card.style.cssText = `position:fixed;inset:0;z-index:7;display:flex;align-items:center;justify-content:center;background:rgba(36,25,14,0.72);color:${NOVA_CSS.text};font:700 18px ${NOVA_FONT};text-align:center;padding:24px;`;
  document.body.appendChild(card);
  const done = () => {
    busy = false;
    o.resume();
  };
  try {
    const { Game3D } = await import('../render3d/game3d');
    const g: { close(): void } = await Game3D.open(o.session, {
      dayT: o.dayT,
      start: o.start,
      exit: () => {
        g.close();
        done();
      },
      restart: (sameMap) => {
        g.close();
        done();
        o.restart(sameMap);
      },
    });
  } catch (e) {
    console.warn('3D:', e);
    done();
    o.fail();
  } finally {
    card.remove();
  }
}

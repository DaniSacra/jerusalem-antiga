import type { GameState } from '../core';
import { NOVA_CSS, NOVA_FONT } from './palette';
import { T } from './strings';

/** What the 3D view needs from the game, and how the game pauses and wakes around it. */
export interface Launch3D {
  state: GameState;
  seed: number;
  /** Fraction of the current week and time of day of the 2D, so the 3D starts at the same moment. */
  weekFrac: number;
  dayT: number;
  /** The grid cell at the centre of the 2D screen and the 2D quarter turns (`iso.getRotation()`): the 3D starts there, turned the same way. */
  start?: { focus: { x: number; y: number }; rotation: number };
  /** Pauses the game and puts the 2D to sleep (only one view draws). */
  pause(): void;
  /** Wakes the 2D and gives the speed back. */
  resume(): void;
  /** The 3D could not open (no WebGL, or the download failed offline). */
  fail(): void;
}

let busy = false;

/**
 * Opens the city in 3D. Three.js and the view come in their own chunk (a dynamic import), so the
 * game's first load does not grow; a small loading card shows while the chunk and the models load.
 */
export async function launch3D(o: Launch3D): Promise<void> {
  if (busy) return;
  busy = true;
  o.pause();
  const card = document.createElement('div');
  card.textContent = T.view3d.loading;
  card.style.cssText = `position:fixed;inset:0;z-index:6;display:flex;align-items:center;justify-content:center;background:rgba(36,25,14,0.72);color:${NOVA_CSS.text};font:700 18px ${NOVA_FONT};text-align:center;padding:24px;`;
  document.body.appendChild(card);
  const done = () => {
    busy = false;
    o.resume();
  };
  try {
    const { open3D } = await import('../render3d/view');
    await open3D(o.state, o.seed, done, { weekFrac: o.weekFrac, dayT: o.dayT, start: o.start });
  } catch (e) {
    console.warn('3D view:', e);
    done();
    o.fail();
  } finally {
    card.remove();
  }
}

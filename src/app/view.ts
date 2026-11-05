import { settings } from '../render/settings';

export type ViewKind = '2d' | '3d';

/**
 * Which game opens: `?view=2d|3d` in the URL (the tests use it), else the player's setting. A device
 * without WebGL 2 always gets the 2D.
 */
export function pickView(search: string, saved: ViewKind, webgl2: boolean): ViewKind {
  const asked = new URLSearchParams(search).get('view');
  const want: ViewKind = asked === '2d' || asked === '3d' ? asked : saved;
  return want === '3d' && webgl2 ? '3d' : '2d';
}

/** True when the browser can draw WebGL 2 (the 3D view needs it). */
export function hasWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

export const chooseView = (search: string): ViewKind => pickView(search, settings.view, hasWebGL2());

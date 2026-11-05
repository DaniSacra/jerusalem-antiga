export type ViewKind = '2d' | '3d';

/**
 * Which game opens: the 3D (user decision, 2026-11-05). The legacy 2D only with `?view=2d` (its old
 * tests), or on a device without WebGL 2.
 */
export function pickView(search: string, webgl2: boolean): ViewKind {
  return new URLSearchParams(search).get('view') === '2d' || !webgl2 ? '2d' : '3d';
}

/** True when the browser can draw WebGL 2 (the 3D view needs it). */
export function hasWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

export const chooseView = (search: string): ViewKind => pickView(search, hasWebGL2());

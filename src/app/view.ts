/** True when the browser can draw WebGL 2 (the game needs it). */
export function hasWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

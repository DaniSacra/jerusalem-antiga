/** Screen layout of the UI overlay (fixed, not affected by the camera). */
/** Shortest game height: the build column and the side buttons still fit. */
const MIN_H = 560;

/** Design width. The height follows the screen shape, so wide landscape phones fill the screen
 * (no side bars) and everything looks bigger: 844x390 gives 1280x591, drawn at ~0.66x. */
export const GAME_W = 1280;
const ASPECT = typeof window === 'undefined' ? 16 / 9 : window.innerWidth / window.innerHeight;
export const GAME_H = Math.round(Math.min(720, Math.max(MIN_H, GAME_W / ASPECT)));

/** Real screen px per game px (Phaser FIT scales the 1280-wide game to the window); 1 outside a browser. */
export const SCREEN_K = typeof window === 'undefined' ? 1 : Math.min(window.innerWidth / GAME_W, window.innerHeight / GAME_H);
/** Game px for a size given in real screen px (sizes of the Nova interface are set in real px). */
export const px = (real: number) => real / SCREEN_K;
/** Phone layout of the Nova interface: decided on the real screen (short, or a touch-first pointer), not on GAME_H. */
export const IS_PHONE =
  typeof window !== 'undefined' && (window.innerHeight < 500 || (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches));

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export const inRect = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** Vertical center of the free map area (under the top bar), where the camera centers things. */
export const VIEW_CY = Math.round((108 + GAME_H) / 2);

/**
 * Live centers of the Nova interface parts (registered when it is built), for the visual tests through
 * `window.layout.novaPoint(name)`: `d` is the button size in game px. Names: level, gear, speed-N,
 * side-goals|alerts|stats|3d, tool-view|road|clear, build-<kind>, pill-silver|food|materials|stone|goal|season, column.
 */
const novaSpots = new Map<string, () => { x: number; y: number; d: number } | null>();
export const setNovaSpot = (name: string, at: () => { x: number; y: number; d: number } | null) => novaSpots.set(name, at);
export const novaPoint = (name: string) => novaSpots.get(name)?.() ?? null;

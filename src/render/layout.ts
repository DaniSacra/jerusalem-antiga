/** Screen layout of the UI overlay (fixed, not affected by the camera). */
/** Shortest game height: the map keeps room between the top bar and the tool bar. */
const MIN_H = 560;

/** Design width. The height follows the screen shape, so wide landscape phones fill the screen
 * (no side bars) and everything looks bigger: 844x390 gives 1280x591, drawn at ~0.66x. */
export const GAME_W = 1280;
const ASPECT = typeof window === 'undefined' ? 16 / 9 : window.innerWidth / window.innerHeight;
export const GAME_H = Math.round(Math.min(720, Math.max(MIN_H, GAME_W / ASPECT)));
export const TOP_H = 56;
export const TOOL_H = 96;
export const INFO_H = 32;
export const TOOL_Y = GAME_H - TOOL_H;
export const INFO_Y = TOOL_Y - INFO_H;

/** The two "turn the map" arrows, top right under the top bar. */
export const TURN = { size: 80, gap: 10, x: GAME_W - 12 - 2 * 80 - 10, y: TOP_H + 10 };

const overTurn = (sx: number, sy: number) =>
  sx >= TURN.x && sx <= TURN.x + TURN.size * 2 + TURN.gap && sy >= TURN.y && sy <= TURN.y + TURN.size;

/** True if a screen point is over the top bar, the turn arrows, the info line or the tool bar. */
export const isOverUi = (sx: number, sy: number) => sy < TOP_H || sy >= INFO_Y || overTurn(sx, sy);

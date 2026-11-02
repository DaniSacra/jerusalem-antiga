/** Screen layout of the UI overlay (fixed, not affected by the camera). */
export const GAME_W = 1280;
export const GAME_H = 720;
export const TOP_H = 56;
export const TOOL_H = 96;
export const INFO_H = 32;
export const TOOL_Y = GAME_H - TOOL_H;
export const INFO_Y = TOOL_Y - INFO_H;

/** The two "turn the map" arrows, top right under the top bar. */
export const TURN = { x: GAME_W - 128, y: TOP_H + 10, size: 54, gap: 8 };

const overTurn = (sx: number, sy: number) =>
  sx >= TURN.x && sx <= TURN.x + TURN.size * 2 + TURN.gap && sy >= TURN.y && sy <= TURN.y + TURN.size;

/** True if a screen point is over the top bar, the turn arrows, the info line or the tool bar. */
export const isOverUi = (sx: number, sy: number) => sy < TOP_H || sy >= INFO_Y || overTurn(sx, sy);

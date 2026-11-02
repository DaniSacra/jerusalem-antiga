/** Screen layout of the UI overlay (fixed, not affected by the camera). */
export const GAME_W = 1280;
export const GAME_H = 720;
export const TOP_H = 56;
export const TOOL_H = 96;
export const INFO_H = 32;
export const TOOL_Y = GAME_H - TOOL_H;
export const INFO_Y = TOOL_Y - INFO_H;

/** True if a screen point is over the top bar, info line or tool bar. */
export const isOverUi = (sy: number) => sy < TOP_H || sy >= INFO_Y;

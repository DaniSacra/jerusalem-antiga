/** Screen layout of the UI overlay (fixed, not affected by the camera). */
/** Shortest game height: the left rail (speed, Ver, Rua, Limpar, turn arrows) still fits. */
const MIN_H = 560;

/** Design width. The height follows the screen shape, so wide landscape phones fill the screen
 * (no side bars) and everything looks bigger: 844x390 gives 1280x591, drawn at ~0.66x. */
export const GAME_W = 1280;
const ASPECT = typeof window === 'undefined' ? 16 / 9 : window.innerWidth / window.innerHeight;
export const GAME_H = Math.round(Math.min(720, Math.max(MIN_H, GAME_W / ASPECT)));

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export const inRect = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** Margin from the screen edges and padding inside the rails. */
export const PAD = 6;
/** Rail buttons: 72 game px is ~48 screen px on a 844 x 390 phone (minimum touch target 44). */
export const BTN = 72;
export const BTN_GAP = 6;

/** Speed buttons (pause, 1x, 3x) in a row, top left: 68 game px is ~45 screen px on the phone. */
export const SPEED_BTN = 68;
export const SPEED: Rect = { x: PAD, y: PAD, w: 3 * SPEED_BTN + 2 * BTN_GAP + 2 * PAD, h: SPEED_BTN + 2 * PAD };

/** Gap between the view tools (Ver, Rua, Limpar) and the turn arrows. */
export const DIVIDER = 16;
/** Left rail, under the speed: 3 tools, a divider and the 2 turn arrows. */
export const LEFT_RAIL: Rect = { x: PAD, y: SPEED.y + SPEED.h + 10, w: BTN + 2 * PAD, h: 5 * BTN + 3 * BTN_GAP + DIVIDER + 2 * PAD };

/** Right rail: the 6 buildings, wider buttons for the thumbnails, centered vertically under the options button. */
export const BUILD_W = 88;
const RIGHT_H = 6 * BTN + 5 * BTN_GAP + 2 * PAD;
const RIGHT_W = BUILD_W + 2 * PAD;
const OPT_SIZE = SPEED_BTN + 2 * PAD;
const RIGHT_Y = Math.min(GAME_H - PAD - RIGHT_H, Math.max(Math.round((GAME_H - RIGHT_H) / 2), PAD + OPT_SIZE + 8));
export const RIGHT_RAIL: Rect = { x: GAME_W - PAD - RIGHT_W, y: RIGHT_Y, w: RIGHT_W, h: RIGHT_H };
/** Options (gear) in the top right corner; on very wide screens, beside the top of the rail instead. */
export const OPTIONS: Rect =
  RIGHT_Y >= PAD + OPT_SIZE + 8
    ? { x: GAME_W - PAD - OPT_SIZE, y: PAD, w: OPT_SIZE, h: OPT_SIZE }
    : { x: RIGHT_RAIL.x - 8 - OPT_SIZE, y: PAD, w: OPT_SIZE, h: OPT_SIZE };

/** Top-center plaque: city name, then month, silver, food, residents and work. */
export const PLAQUE_W = 790;
export const PLAQUE: Rect = { x: (GAME_W - PLAQUE_W) / 2, y: 0, w: PLAQUE_W, h: 66 };
/** Widths of the plaque slots (month, silver, food, residents, work), fixed so numbers never push each other. */
const SLOT_W = [112, 180, 168, 104, 196];
const SLOT_X0 = PLAQUE.x + (PLAQUE_W - SLOT_W.reduce((a, b) => a + b, 0)) / 2;
/** Slot k of the plaque, full plaque height (the silver slot is the tap target for the breakdown). */
export const plaqueSlot = (k: number): Rect => ({ x: SLOT_X0 + SLOT_W.slice(0, k).reduce((a, b) => a + b, 0), y: 0, w: SLOT_W[k], h: PLAQUE.h });
/** Goal banner under the plaque, then one alert banner under the goal. */
export const GOAL_Y = PLAQUE.h + 6;
export const GOAL_H = 36;
export const ALERT_Y = GOAL_Y + GOAL_H + 6;
/** Banners stay between the rails. */
export const BANNER_MAX_W = RIGHT_RAIL.x - (SPEED.x + SPEED.w) - 40;

/** Info line: a compact plaque at the bottom center, only shown when it has text. */
export const INFO_H = 40;
export const INFO_Y = GAME_H - PAD - INFO_H;
export const INFO_MAX_W = RIGHT_RAIL.x - (LEFT_RAIL.x + LEFT_RAIL.w) - 24;

/** Vertical center of the free map area (under the plaque and goal banner). */
export const VIEW_CY = Math.round((GOAL_Y + GOAL_H + GAME_H) / 2);

/** Centers of the buttons (also used by the visual tests through `window.layout`). */
export const speedButton = (k: number) => ({ x: SPEED.x + PAD + SPEED_BTN / 2 + k * (SPEED_BTN + BTN_GAP), y: SPEED.y + PAD + SPEED_BTN / 2 });
/** Left rail: 0 Ver, 1 Rua, 2 Limpar, then (after the divider) 3 ↺ and 4 ↻. */
export const leftButton = (k: number) => ({ x: LEFT_RAIL.x + LEFT_RAIL.w / 2, y: LEFT_RAIL.y + PAD + BTN / 2 + k * (BTN + BTN_GAP) + (k >= 3 ? DIVIDER : 0) });
/** Right rail: 0 Casa, 1 Campo, 2 Poço, 3 Mercado, 4 Oficina, 5 Templo. */
export const buildButton = (k: number) => ({ x: RIGHT_RAIL.x + RIGHT_RAIL.w / 2, y: RIGHT_RAIL.y + PAD + BTN / 2 + k * (BTN + BTN_GAP) });

import { GAME_H, GAME_W, IS_PHONE, px } from '../layout';

/** Sizes of the Nova interface in REAL screen px, phone (landscape) or PC; see `S` for game px. */
const REAL = IS_PHONE
  ? { margin: 8, gap: 6, num: 15, text: 13, small: 12, big: 20, level: 56, pillH: 30, goalH: 28, btn: 44, side: 44, sideGap: 10, tool: 44, labelH: 18, col: 46, colPad: 4, colGapMax: 8, balloonW: 230 }
  : { margin: 10, gap: 8, num: 17, text: 14, small: 13, big: 26, level: 72, pillH: 36, goalH: 32, btn: 44, side: 48, sideGap: 12, tool: 56, labelH: 22, col: 86, colPad: 6, colGapMax: 10, balloonW: 280 };

type Sizes = { [K in keyof typeof REAL]: number };

/** The same sizes in game px (the game is drawn 1280 wide and scaled to the screen). */
export const S: Sizes = Object.fromEntries(Object.entries(REAL).map(([k, v]) => [k, px(v)])) as Sizes;

export const PHONE = IS_PHONE;
export const W = GAME_W;
export const H = GAME_H;

/** Line height for a font size. */
export const lineH = (size: number) => Math.round(size * 1.38);

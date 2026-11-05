import type { AgeBand, Sex, WalkerType } from '../core';

/**
 * How the people of the 3D view look and walk, as plain data (no Three.js): robe and head cover by
 * age and sex, size, stoop and pace; the walking order of a family and its motion along its path.
 * Pure and tested (tests/render3d/crowd.test.ts); `figures.ts` draws them.
 */

/** Light, olive and dark skin. */
export const SKIN = [0xd2a07a, 0xb98463, 0x8c5c3b] as const;
/** Undyed wool and linen, brown, indigo: the men's robes. */
const MEN = [0xc9b48a, 0x8a5d3b, 0x3f5f8a, 0xe2d2b0, 0x6b5a3a, 0x5c3f2c] as const;
/** Madder red, rust, blue, ochre, green: the women's dresses. */
const WOMEN = [0xa8473a, 0xbc6440, 0x4f6f9e, 0xc89848, 0x6b7a3a, 0x7a4a6a] as const;
/** Mantles over the women's heads and shoulders. */
const MANTLES = [0x3e5279, 0x5c3f2c, 0xe6dcc4, 0x8a3b2c] as const;
/** Head cloths of the men. */
const CLOTHS = [0xf1ebdc, 0xe2d2b0, 0xc4ab82] as const;
/** Short, light tunics of the children. */
const CHILDREN = [0xecdcb8, 0xd8b65a, 0xd4a070, 0xb8c48a] as const;
/** Pale, bleached robes of the old. */
const ELDERS = [0xf1ebdc, 0xb8b0a0, 0xd8d0bc] as const;
const HAIR = 0x2e2118;
const PRIEST = { robe: 0xfaf7f0, cover: 0x2f5fb0 };

export interface FigureLook {
  robe: number;
  /** Head cover (mantle, head cloth) or hair. */
  cover: number;
  skin: number;
  /** Height scale (1 = an adult). */
  size: number;
  /** Forward lean in radians (the old walk bent). */
  stoop: number;
  /** Walking speed scale. */
  pace: number;
  /** A long mantle over head and shoulders (women, old men) instead of a cap or cloth. */
  mantle: boolean;
}

const pick = <T>(list: readonly T[], k: number): T => list[Math.min(list.length - 1, Math.floor(k * list.length))];

/** The look of a person of `sex` and age `band`; `k` (0..1, stable per person) picks the colours. */
export function figureLook(sex: Sex, band: AgeBand, k: number): FigureLook {
  const skin = pick(SKIN, (k * 7.31) % 1);
  const j = (k * 3.17) % 1;
  if (band === 'child') return { robe: pick(CHILDREN, k), cover: HAIR, skin, size: 0.64, stoop: 0, pace: 1.1, mantle: false };
  if (band === 'elder')
    return { robe: pick(ELDERS, k), cover: sex === 'f' ? pick(MANTLES, j) : pick(CLOTHS, j), skin, size: 0.94, stoop: 0.24, pace: 0.7, mantle: true };
  return sex === 'f'
    ? { robe: pick(WOMEN, k), cover: pick(MANTLES, j), skin, size: 0.95, stoop: 0, pace: 1, mantle: true }
    : { robe: pick(MEN, k), cover: pick(CLOTHS, j), skin, size: 1, stoop: 0, pace: 1, mantle: false };
}

/** Who a resident walker of `type` is: the old and the children by type, the water and basket carriers women. */
export function walkerPerson(type: WalkerType, k: number): { sex: Sex; band: AgeBand } {
  const sex: Sex = k < 0.5 ? 'm' : 'f';
  if (type === 'child') return { sex, band: 'child' };
  if (type === 'elder') return { sex, band: 'elder' };
  if (type === 'basketWoman' || type === 'waterCarrier') return { sex: 'f', band: 'adult' };
  return { sex: 'm', band: 'adult' };
}

/** The look of a resident walker of `type` (the priest in white with a blue head cloth). */
export function walkerLook(type: WalkerType, k: number): FigureLook {
  const p = walkerPerson(type, k);
  const look = figureLook(p.sex, p.band, k);
  return type === 'priest' ? { ...look, ...PRIEST, mantle: false } : look;
}

/** A place in a walking group: cells behind the leader along the path, and to the side. */
export interface Slot {
  back: number;
  side: number;
}

/** Cells between the rows of a walking group. */
export const ROW_GAP = 0.42;

/**
 * Where each member of a family walks (same order as `bands`): two abreast, the adults in front,
 * the children in the middle, the old at the back; `pack` adds a last slot for the caravan's donkey.
 */
export function groupSlots(bands: AgeBand[], pack = false): Slot[] {
  const rank: Record<AgeBand, number> = { adult: 0, child: 1, elder: 2 };
  const order = bands.map((b, i) => ({ b, i })).sort((a, c) => rank[a.b] - rank[c.b] || a.i - c.i);
  const out: Slot[] = new Array(bands.length);
  order.forEach(({ i }, n) => {
    const row = Math.floor(n / 2);
    const single = n % 2 === 0 && n === order.length - 1;
    out[i] = { back: row * ROW_GAP, side: single ? 0 : n % 2 ? 0.17 : -0.17 };
  });
  if (pack) out.push({ back: Math.ceil(order.length / 2) * ROW_GAP + 0.1, side: 0 });
  return out;
}

/** How far behind the leader the last of a group walks (cells). */
export const groupLength = (slots: Slot[]) => slots.reduce((m, s) => Math.max(m, s.back), 0);

/**
 * A family walking home in the 3D view (the game is paused while it is open): from the cell it has
 * reached (`from`), the whole group (`length` cells long) walks to the house cell (`last`) at `speed`
 * cells per second, goes in, and after `rest` seconds walks the stretch again. Returns the leader's
 * step along the path; a member `back` cells behind is at `lead - back` (see `memberAt`).
 */
export function familyLead(from: number, last: number, seconds: number, speed: number, rest: number, length: number): number {
  const way = last - from;
  if (way <= 0) return Infinity;
  const cycle = way / speed + rest;
  const t = ((seconds % cycle) + cycle) % cycle;
  return from + length + t * speed;
}

/** Step of a member `back` cells behind the leader, or null while it is not on the way (not out yet, or home). */
export function memberAt(lead: number, back: number, from: number, last: number): number | null {
  const step = lead - back;
  // In through the door half a cell before the house cell.
  if (step < from || step >= last - 0.5) return null;
  return step;
}

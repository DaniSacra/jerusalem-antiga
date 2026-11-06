/**
 * The house kits (plano beleza C3): what each of the six looks of a house level adds to the house
 * model, as plain data (no Three.js). Pure and tested; `world.ts` places the pieces with the house
 * (its turn, its mirroring and its tint) and `models.ts` builds each piece once.
 *
 * Every piece is in house model space: centred on the 2x2 footprint, front +z, y up (the roof of the
 * mud house is at 1.45, the stone house's terrace at 1.1 with a walled court up to 1.4, the big house's
 * roof at 2.2; measured on the Meshy models). A mirrored house mirrors its pieces too (`world.ts`).
 * The yard things (jars, washing line: `yardOf` in plan.ts) stand on the front right and follow
 * `variant % 3`, so the kits keep that corner free when the variant has a yard.
 */

export const KIT_KEYS = [
  'kit-ladder', 'kit-figs', 'kit-oven', 'kit-room-mud', 'kit-room-stone', 'kit-awning', 'kit-rug', 'kit-vine',
  'kit-arch', 'kit-fig', 'kit-cistern', 'kit-loom', 'kit-tripod', 'kit-fly', 'kit-goats', 'kit-lean', 'kit-stripes',
] as const;
export type KitKey = (typeof KIT_KEYS)[number];

export interface KitPiece {
  key: KitKey;
  x: number;
  y: number;
  z: number;
  /** Turn about y (radians, from the house's front). */
  rot: number;
  /** Uniform scale. */
  s: number;
  /** Daily life (washing, a pot on the fire, figs drying, goats): gone when nobody lives there. */
  life: boolean;
}

const Q = Math.PI / 2;
const P = (key: KitKey, x: number, y: number, z: number, rot = 0, s = 1, life = false): KitPiece => ({ key, x, y, z, rot, s, life });
const L = (key: KitKey, x: number, y: number, z: number, rot = 0, s = 1): KitPiece => P(key, x, y, z, rot, s, true);

/** Roof heights of the house models (see the header). */
export const ROOF = { tentEaves: 0.85, mud: 1.45, terrace: 1.1, court: 1.4, big: 2.2, bigParapet: 2.4 } as const;

/**
 * The six kits of each level, by variant. Tent: striped, with a pot over the fire, a front fly,
 * goats at a manger, a lean-to (double tent), a mat with figs. Mud house: ladder to the roof, tabun
 * oven, an upper room, an awning, a rug over the parapet, figs drying. Stone house: a vine up the
 * wall, an awning over the roof court, an arched gate, an upper storey. Big house: a fig tree in
 * the yard, a wide awning with a loom, a cistern, an upper room, a manger.
 */
const KITS: Record<1 | 2 | 3 | 4, KitPiece[][]> = {
  1: [
    [P('kit-stripes', -0.79, ROOF.tentEaves, -0.1, -Q)],
    [L('kit-tripod', -0.55, 0, 0.6)],
    [P('kit-fly', 0, 0, 0.72)],
    [L('kit-goats', 0.86, 0, -0.25, Q)],
    [P('kit-lean', 0.5, 0, -0.68)],
    [L('kit-figs', 0.08, 0.01, 0.8, 0, 0.9), P('kit-stripes', 0.79, ROOF.tentEaves, -0.1, Q)],
  ],
  2: [
    [P('kit-ladder', -0.55, 0, 0.74), L('kit-figs', -0.3, ROOF.mud, -0.3)],
    [P('kit-oven', -0.6, 0, 0.72), P('kit-room-mud', -0.35, ROOF.mud, -0.45)],
    [L('kit-awning', 0.1, ROOF.mud, -0.2), P('kit-ladder', -0.55, 0, 0.74)],
    [P('kit-room-mud', 0.4, ROOF.mud, -0.45), P('kit-oven', -0.6, 0, 0.72), L('kit-rug', -0.35, ROOF.mud + 0.05, 0.47)],
    [L('kit-figs', 0.25, ROOF.mud, -0.25, Q), P('kit-oven', -0.6, 0, 0.72)],
    [P('kit-room-mud', -0.4, ROOF.mud, -0.45), L('kit-awning', 0.35, ROOF.mud, 0.05, 0, 0.8)],
  ],
  3: [
    [P('kit-vine', -0.72, 0, -0.1, -Q)],
    [L('kit-awning', 0, ROOF.court, -0.2, 0, 0.9)],
    [P('kit-arch', -0.05, 0, 0.9)],
    [P('kit-room-stone', 0.1, ROOF.terrace, -0.5, 0, 1.1), P('kit-vine', 0.62, 0, -0.3, Q)],
    [P('kit-vine', -0.72, 0, -0.1, -Q), L('kit-rug', 0, ROOF.court, 0.27)],
    [P('kit-arch', -0.05, 0, 0.9), L('kit-awning', 0, ROOF.court, -0.2, 0, 0.9)],
  ],
  4: [
    [P('kit-fig', 0.62, 0, 0.7), L('kit-figs', -0.2, ROOF.big, -0.3)],
    [L('kit-awning', 0.25, ROOF.big, -0.3), L('kit-loom', -0.38, ROOF.big, -0.05)],
    [P('kit-room-stone', 0.25, ROOF.big, -0.45), P('kit-cistern', -0.84, 0, -0.2)],
    [P('kit-fig', 0.62, 0, 0.7), P('kit-cistern', -0.84, 0, -0.3)],
    [P('kit-room-stone', -0.25, ROOF.big, -0.45), L('kit-rug', 0.3, ROOF.bigParapet, 0.37)],
    [L('kit-awning', 0, ROOF.big, -0.25, 0, 1.3), L('kit-goats', 0.86, 0, -0.3, Q)],
  ],
};

/** Looks per house level (houses.json `variants` for levels 1–4). */
export const KIT_VARIANTS = 6;

/**
 * The kit of a house drawn at `level` (1 tent .. 4 big house; the plot has none) and `variant`; an
 * empty house keeps the built pieces and loses the daily life.
 */
export function kitOf(level: number, variant: number, vacant: boolean): KitPiece[] {
  if (level < 1 || level > 4) return [];
  const kit = KITS[level as 1 | 2 | 3 | 4][((variant % KIT_VARIANTS) + KIT_VARIANTS) % KIT_VARIANTS];
  return vacant ? kit.filter((p) => !p.life) : kit;
}

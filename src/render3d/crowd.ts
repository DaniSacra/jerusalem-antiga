import { ageBand, jobsOf, type AgeBand, type BuildingKind, type Craft, type GameState, type Sex, type WalkerType } from '../core';

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
  return residentLook(type, p.sex, p.band, k);
}

/** The look of a real resident out as a walker of `type`: their own clothes (as at home), the priest's white. */
export function residentLook(type: WalkerType, sex: Sex, band: AgeBand, k: number): FigureLook {
  const look = figureLook(sex, band, k);
  return type === 'priest' ? { ...look, ...PRIEST, mantle: false } : look;
}

/**
 * Things the walkers carry, each drawn as one instanced mesh that rides the figure (figures.ts):
 * a jar on the head, a basket on the hip, a sack on the back, a sickle, a log on the shoulder, a
 * staff, a two-wheeled cart with a stone block, and the goods of each workshop craft.
 */
export const LOADS = ['jar', 'basket', 'sack', 'sickle', 'log', 'staff', 'cart', 'pot', 'hammer', 'plank', 'bolt', 'dyed', 'hide'] as const;
export type Load = (typeof LOADS)[number];

/** What an artisan carries to and from the workshop, by its craft. */
export const CRAFT_LOAD: Record<Craft, Load> = { pottery: 'pot', smithy: 'hammer', carpentry: 'plank', weaving: 'bolt', dyeing: 'dyed', tannery: 'hide' };

/**
 * What a resident walker of `type` carries, as in the 2D game: the water carrier a jar on her head,
 * the basket woman a basket, the farmer a sickle, the porter a sack, the woodcutter a log, the mason
 * his cart of stone, the old, the shepherd and the priest a staff, the artisan the goods of a
 * workshop of the city (`craft`, or a pot with none). Children and the donkey man carry nothing.
 */
export function loadOf(type: WalkerType, craft: Craft | null = null): Load | null {
  switch (type) {
    case 'waterCarrier':
      return 'jar';
    case 'basketWoman':
      return 'basket';
    case 'farmer':
      return 'sickle';
    case 'porter':
      return 'sack';
    case 'woodcutter':
      return 'log';
    case 'mason':
      return 'cart';
    case 'elder':
    case 'shepherd':
    case 'priest':
      return 'staff';
    case 'artisan':
      return craft ? CRAFT_LOAD[craft] : 'pot';
    default:
      return null;
  }
}

/** The workplace of the walker types that walk to or from their work. */
const WORK_OF: Partial<Record<WalkerType, BuildingKind>> = { farmer: 'field', porter: 'field', artisan: 'workshop', woodcutter: 'lumber', mason: 'quarry', basketWoman: 'gatherer' };

/**
 * Who each walker on the streets is: a resident of the city, each at most once. A walker of a trade
 * is someone who works there (the farmer works a field, the artisan a workshop); otherwise someone of
 * the age the type shows (`walkerPerson`; a woman for the water and basket carriers); otherwise anyone not yet out. `k[i]` (0..1) is the
 * walker's own draw. Null: nobody left (more walkers than residents in a new town).
 */
export function castWalkers(s: GameState, types: readonly WalkerType[], k: readonly number[]): (number | null)[] {
  const jobs = jobsOf(s);
  const residents = s.people.filter((p) => p.houseId !== null).sort((a, b) => a.id - b.id);
  const used = new Set<number>();
  return types.map((type, i) => {
    const want = walkerPerson(type, k[i]);
    const work = WORK_OF[type];
    const free = residents.filter((p) => !used.has(p.id));
    // The age the type shows; the water and basket carriers are women.
    const fits = (p: (typeof residents)[number]) => ageBand(p, s.week) === want.band && (want.sex === 'm' || p.sex === 'f');
    const pick = (work && free.find((p) => jobs.get(p.id)?.kind === work)) || free.find(fits) || free[Math.floor(k[i] * free.length)];
    if (!pick) return null;
    used.add(pick.id);
    return pick.id;
  });
}

/** An animal walking beside a walker: the donkey man leads a donkey with baskets, the shepherd a sheep. */
export const companionOf = (type: WalkerType): 'donkey' | 'sheep' | null => (type === 'donkeyMan' ? 'donkey' : type === 'shepherd' ? 'sheep' : null);

/** Where a companion walks: cells to the walker's right and behind (along its heading). */
export const COMPANION_AT = { side: 0.2, back: 0.28 } as const;

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

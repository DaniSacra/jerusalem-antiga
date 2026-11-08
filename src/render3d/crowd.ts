import { ageBand, jobsOf, type AgeBand, type BuildingKind, type Cell, type Craft, type GameState, type Person, type Sex, type WalkerType } from '../core';

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
 * staff, a two-wheeled cart with a stone block, and the goods of each workshop craft; the olive
 * picker's long pole, and the arm a betrothed reaches to the right or left to hold the other's hand.
 */
export const LOADS = ['jar', 'basket', 'sack', 'sickle', 'log', 'staff', 'cart', 'pot', 'hammer', 'plank', 'bolt', 'dyed', 'hide', 'pole', 'hold-r', 'hold-l'] as const;
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
 * walker's own draw; `taken`: residents already out (walkers kept from before). Null: nobody left
 * (more walkers than residents in a new town).
 */
export function castWalkers(s: GameState, types: readonly WalkerType[], k: readonly number[], taken: Iterable<number> = []): (number | null)[] {
  const jobs = jobsOf(s);
  const residents = s.people.filter((p) => p.houseId !== null).sort((a, b) => a.id - b.id);
  const used = new Set<number>(taken);
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

/** Cells to each side of the path of a betrothed couple walking hand in hand (their hands meet in the middle). */
export const HOLD_SIDE = 0.085;

/**
 * A betrothed couple on the way to the house where they marry (`moveFamilies` weds them there): two
 * adults, each the other's betrothed, still engaged. They walk side by side, holding hands.
 */
export function betrothed(s: GameState, members: readonly Pick<Person, 'id' | 'spouseId' | 'engaged' | 'birthWeek'>[]): boolean {
  if (members.length !== 2) return false;
  const [a, b] = members;
  return a.spouseId === b.id && b.spouseId === a.id && (a.engaged !== null || b.engaged !== null) && ageBand(a, s.week) === 'adult' && ageBand(b, s.week) === 'adult';
}

/**
 * The slots of a betrothed couple, side by side in one row, and the arm each reaches: the one with
 * side > 0 walks on the -x side of the pair (in its own frame, see `Families.update`), so it reaches
 * its right hand (+x, as in figures.ts) to the other.
 */
export const HOLD_SLOTS: readonly Slot[] = [{ back: 0, side: -HOLD_SIDE }, { back: 0, side: HOLD_SIDE }];
export const holdLoad = (slot: Slot): Load => (slot.side > 0 ? 'hold-r' : 'hold-l');

/** How far behind the leader the last of a group walks (cells). */
export const groupLength = (slots: Slot[]) => slots.reduce((m, s) => Math.max(m, s.back), 0);

/**
 * Where the leader of a family walking home is (a step along its path), following the core: while
 * the family is on its way (`step`, the core's `f.step`) the leader is `perWeek` cells further each
 * week, in step with the week's fraction `frac` (never back); once the core has moved it in (`step`
 * null) the rest of the group walks on at the same pace (`dWeeks` of game time this frame) and goes in.
 */
export function familyLead(lead: number, step: number | null, frac: number, dWeeks: number, perWeek: number): number {
  if (step !== null) return Math.max(lead, step + Math.min(1, Math.max(0, frac)) * perWeek);
  // Never seen on its way (it arrived before its first frame): already in.
  if (lead === -Infinity) return Infinity;
  return lead + Math.max(0, dWeeks) * perWeek;
}

/** The whole group (`length` cells long) is in through the door of the house cell `last`. */
export const familyHome = (lead: number, length: number, last: number) => lead - length >= last - 0.5;

/** Step of a member `back` cells behind the leader, or null while it is not on the way (not out yet, or home). */
export function memberAt(lead: number, back: number, from: number, last: number): number | null {
  const step = lead - back;
  // In through the door half a cell before the house cell.
  if (step < from || step >= last - 0.5) return null;
  return step;
}

/** Buildings nobody goes into: open ground. */
const OPEN: ReadonlySet<BuildingKind> = new Set(['field', 'pasture', 'plaza', 'park']);

/**
 * The door a walker on road cell `c` can go in by, or come out of: a cell of a building next to it
 * that people go into (a lived-in house first; not a field, a pasture, a plaza or a park). Null: none.
 */
export function doorBeside(s: GameState, c: Cell): Cell | null {
  let best: Cell | null = null;
  let rank = 0;
  for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    const x = c.x + dx;
    const y = c.y + dy;
    if (x < 0 || y < 0 || x >= s.cols || y >= s.rows) continue;
    const b = s.grid[y * s.cols + x];
    if (!b || OPEN.has(b.kind)) continue;
    const r = b.kind === 'house' ? (b.level > 0 ? 3 : 1) : 2;
    if (r > rank) [best, rank] = [{ x, y }, r];
  }
  return best;
}

/**
 * What a walker does with its way when the roads change: `keep` it (the rest is still road), go on
 * `ahead` from the next cell by a new way, turn `back` to the cell it left and go from there, or
 * `lost` (no road under it either way: it goes indoors at the end of the stretch).
 */
export function reroute(path: readonly Cell[], seg: number, onRoad: (c: Cell) => boolean): 'keep' | 'ahead' | 'back' | 'lost' {
  const next = path[Math.min(seg + 1, path.length - 1)];
  let whole = true;
  for (let k = seg + 1; k < path.length && whole; k++) whole = onRoad(path[k]);
  if (whole) return 'keep';
  if (onRoad(next)) return 'ahead';
  return onRoad(path[seg]) ? 'back' : 'lost';
}

/**
 * The share (0..1) of the still figures shown at camera `distance`: all up to `far − band`, then
 * fewer and fewer, none past `far` (they thin out instead of vanishing at once).
 */
export const farFade = (distance: number, far: number, band: number) => Math.min(1, Math.max(0, (far - distance) / band));

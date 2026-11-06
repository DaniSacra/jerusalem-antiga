import { ageBand, findPath, indexOf, type AgeBand, type Building, type Cell, type GameState, type Person, type Sex } from '../core';
import type { Load } from './crowd';
import LOOK from './look3d.json';
import { hash, lookOf } from './plan';

/**
 * The still life of the streets, as plain data (no Three.js): who stands where and what they do.
 * Neighbours at the doors that grow with the house level (a woman grinding at the tent fire, a child
 * playing, someone at the door, two neighbours talking), buyers around a staffed market, olive pickers
 * under the trees near the town in autumn; and the walk out of town of a family that left.
 * Deterministic from the state; tested in tests/render3d/street.test.ts. `townsfolk.ts` draws them.
 */
export type IdleAct = 'talk' | 'play' | 'stand' | 'grind' | 'buy' | 'beat' | 'gather';

export interface IdleSpot {
  act: IdleAct;
  /** Where the figure stands (world, cell units) and its facing (radians about y, 0 = +z). */
  x: number;
  z: number;
  yaw: number;
  sex: Sex;
  band: AgeBand;
  /** 0..1, stable: the look's draw and the phase of its motion. */
  k: number;
  /** The resident it is (null: a figure with no name, in a town with nobody free). */
  id: number | null;
  load: Load | null;
  /**
   * 0..1, shared by a group (the two neighbours talking): the group shows while the street share
   * (fewer at night, in the rain, at the lower qualities) is above it.
   */
  show: number;
  /** Only in autumn (the olive harvest). */
  autumn: boolean;
}

/** A building where the world drew it: its centre and turn (front +z), as in `cityPlan`. */
export interface Placed {
  b: Building;
  x: number;
  z: number;
  rot: number;
}

const L = LOOK.street;

/** A point of a building's model (local x, z; front +z) in the world. */
export const localToWorld = (p: Placed, lx: number, lz: number) => ({
  x: p.x + lx * Math.cos(p.rot) + lz * Math.sin(p.rot),
  z: p.z - lx * Math.sin(p.rot) + lz * Math.cos(p.rot),
});

/** Someone may stand on this point: no other building there, not the river, and no tree or rock (unless `trees`). */
export function standable(s: GameState, x: number, z: number, own: Building | null = null, trees = false): boolean {
  const cx = Math.floor(x);
  const cz = Math.floor(z);
  if (cx < 0 || cz < 0 || cx >= s.cols || cz >= s.rows) return false;
  const i = indexOf(s, cx, cz);
  const b = s.grid[i];
  return (!b || b === own) && (trees || !s.feature[i]) && s.ground[i] !== 'river';
}

/** What each house shows at its door by level: none or a woman at the tent fire, then 1, 2 and 3 people. */
export function houseActs(level: number, k: number): IdleAct[] {
  if (level === 1) return k < L.tentShare ? ['grind'] : [];
  if (level === 2) return [k < 0.5 ? 'grind' : 'play'];
  if (level === 3) return k < 0.5 ? ['talk'] : ['stand', 'play'];
  if (level >= 4) return ['talk', k < 0.5 ? 'stand' : 'play'];
  return [];
}

/** People an act shows (talk: two neighbours), the age and sex it wants first. */
const WANT: Record<IdleAct, { n: number; band: AgeBand; sex?: Sex }> = {
  talk: { n: 2, band: 'adult' },
  play: { n: 1, band: 'child' },
  stand: { n: 1, band: 'elder' },
  grind: { n: 1, band: 'adult', sex: 'f' },
  buy: { n: 1, band: 'adult' },
  beat: { n: 1, band: 'adult', sex: 'm' },
  gather: { n: 1, band: 'adult', sex: 'f' },
};

/** The act someone of this age and sex does at the door when the planned one finds nobody. */
const fallbackAct = (band: AgeBand, sex: Sex): IdleAct => (band === 'child' ? 'play' : band === 'elder' || sex === 'm' ? 'stand' : 'grind');

/** What a figure holds: the old a staff, the pickers a pole or a basket, a buyer woman a basket. */
export function idleLoad(act: IdleAct, band: AgeBand, sex: Sex): Load | null {
  if (act === 'beat') return 'pole';
  if (act === 'gather' || (act === 'buy' && sex === 'f')) return 'basket';
  return band === 'elder' ? 'staff' : null;
}

/** Where each act stands in a house's model (local x, z and facing; `o` is the side away from the yard). */
function houseSpots(act: IdleAct, level: number, o: number, mirror: number): [number, number, number][] {
  switch (act) {
    case 'grind':
      // At the tent: kneeling by the fire ring (front left, right when mirrored), facing it; else at the doorstep, facing out.
      return level === 1 ? [[-0.28 * mirror, 0.66, (-Math.PI / 2) * mirror]] : [[o * 0.45, 1.06, 0]];
    case 'talk':
      return [
        [o * 0.04, 1.14, o * (Math.PI / 2 - 0.4)],
        [o * 0.32, 1.14, -o * (Math.PI / 2 - 0.4)],
      ];
    case 'stand':
      return [[o * 0.66, 1.04, -o * 0.3]];
    case 'play':
      return [[-o * 0.42, 1.3, 0]];
    default:
      return [];
  }
}

/** The residents to cast, by a stable shuffle. */
function pool(s: GameState): Person[] {
  return s.people.filter((p) => p.houseId !== null).sort((a, b) => hash(a.id, 1, 61) - hash(b.id, 1, 61));
}

/** Takes the first person of `from` of the age (and sex) wanted, or null. */
function take(s: GameState, from: Person[], band: AgeBand, sex?: Sex): Person | null {
  const i = from.findIndex((p) => ageBand(p, s.week) === band && (!sex || p.sex === sex));
  return i < 0 ? null : from.splice(i, 1)[0];
}

/**
 * Who stands where now: buyers at each staffed market (2 to 4 by level), two olive pickers under each
 * of a few olive trees near the houses (autumn only), and the neighbours at the house doors (houses
 * with the higher level first), each a resident at most once. At most `max` figures.
 */
export function streetPlan(s: GameState, placed: readonly Placed[], max: number = L.max): IdleSpot[] {
  const out: IdleSpot[] = [];
  const free = pool(s);
  const add = (group: Omit<IdleSpot, 'show'>[], show: number) => {
    if (!group.length || out.length + group.length > max) return;
    for (const o of group) out.push({ ...o, show });
  };
  const figure = (act: IdleAct, x: number, z: number, yaw: number, p: Person | null, k: number, autumn = false): Omit<IdleSpot, 'show'> => {
    const want = WANT[act];
    const band = p ? ageBand(p, s.week) : want.band;
    const sex = p?.sex ?? want.sex ?? (k < 0.5 ? 'm' : 'f');
    return { act, x, z, yaw, sex, band, k: p ? hash(p.id, 3) : k, id: p?.id ?? null, load: idleLoad(act, band, sex), autumn };
  };

  // Buyers around each connected market that has its crew.
  for (const p of placed) {
    const b = p.b;
    if (b.kind !== 'market' || !b.connected || !s.people.some((o) => o.jobId === b.id)) continue;
    const n = 1 + Math.max(1, Math.min(3, b.level));
    const ring: [number, number, number][] = [
      [1.2, -1.2, -Math.PI / 2], [1.2, 0, -Math.PI / 2], [1.2, 1.2, -Math.PI / 2],
      [-1.2, -1.2, Math.PI / 2], [-1.2, 0, Math.PI / 2], [-1.2, 1.2, Math.PI / 2],
      [-0.4, 2.2, Math.PI], [0.4, 2.2, Math.PI], [-0.4, -2.2, 0], [0.4, -2.2, 0],
    ];
    const spots = ring
      .map(([lx, lz, yaw], j) => ({ ...localToWorld(p, lx, lz), yaw: p.rot + yaw + (hash(b.id, j, 62) - 0.5) * 0.5, j }))
      .filter((c) => standable(s, c.x, c.z, b))
      // The street sides first (where people walk), then a stable shuffle.
      .sort((a, c) => Number(!s.roads[indexOf(s, Math.floor(a.x), Math.floor(a.z))]) - Number(!s.roads[indexOf(s, Math.floor(c.x), Math.floor(c.z))]) || hash(b.id, a.j, 63) - hash(b.id, c.j, 63))
      .slice(0, n);
    spots.forEach((c, j) => {
      const who = take(s, free, 'adult', j % 2 ? 'm' : 'f') ?? take(s, free, 'adult');
      add([figure('buy', c.x, c.z, c.yaw, who, hash(b.id, j, 64))], hash(b.id, j, 65));
    });
  }

  // Olive pickers in autumn: one beats the branches with a pole, one gathers into a basket.
  const homes = s.buildings.filter((b) => b.kind === 'house' && b.level >= 1).map((b) => ({ x: b.x + b.w / 2, z: b.y + b.h / 2 }));
  if (homes.length) {
    const trees: { x: number; y: number; d: number }[] = [];
    for (let i = 0; i < s.feature.length; i++) {
      if (s.feature[i] !== 'olive') continue;
      const x = i % s.cols;
      const y = Math.floor(i / s.cols);
      const d = Math.min(...homes.map((h) => Math.hypot(h.x - x - 0.5, h.z - y - 0.5)));
      if (d <= L.pickerReach) trees.push({ x, y, d });
    }
    trees.sort((a, c) => a.d - c.d || hash(a.x, a.y, 66) - hash(c.x, c.y, 66));
    const chosen: typeof trees = [];
    for (const t of trees) if (chosen.length < L.pickerTrees && chosen.every((c) => Math.hypot(c.x - t.x, c.y - t.y) >= 2.5)) chosen.push(t);
    for (const t of chosen) {
      // The tree's drawn place (the same jitter as cityPlan).
      const tx = t.x + 0.5 + (hash(t.x, t.y, 1) - 0.5) * 0.4;
      const tz = t.y + 0.5 + (hash(t.x, t.y, 2) - 0.5) * 0.4;
      // On the side the opening view looks from (+x, +z), so the crown does not hide them.
      const a = Math.PI / 4 + (hash(t.x, t.y, 67) - 0.5) * 1.2;
      const group: Omit<IdleSpot, 'show'>[] = [];
      // Out from under the crown, so they show from above.
      for (const [act, ang, r] of [['beat', a, 0.62], ['gather', a - 1.5, 0.58]] as const) {
        const x = tx + Math.sin(ang) * r;
        const z = tz + Math.cos(ang) * r;
        if (!standable(s, x, z, null, true)) continue;
        const want = WANT[act];
        group.push(figure(act, x, z, ang + Math.PI, take(s, free, want.band, want.sex) ?? take(s, free, 'adult'), hash(t.x, t.y, act === 'beat' ? 68 : 69), true));
      }
      add(group, hash(t.x, t.y, 70));
    }
  }

  // Neighbours at the doors: more people the higher the house; the richest streets first.
  const houses = placed.filter((p) => p.b.kind === 'house' && p.b.level >= 1).sort((a, c) => c.b.level - a.b.level || hash(a.b.x, a.b.y, 71) - hash(c.b.x, c.b.y, 71));
  for (const p of houses) {
    const b = p.b;
    const home = free.filter((o) => o.houseId === b.id);
    // The side away from the yard things (front right of the model, left when it is mirrored).
    const m = lookOf(b).mirror;
    const o = b.variant % 3 === 0 ? (hash(b.x, b.y, 72) < 0.5 ? 1 : -1) : -m;
    for (const [n, planned] of houseActs(b.level, hash(b.x, b.y, 60)).entries()) {
      const want = WANT[planned];
      let act = planned;
      let who: Person[] = [];
      for (let j = 0; j < want.n; j++) {
        const q = take(s, home, want.band, want.sex) ?? (want.n > 1 ? take(s, home, 'adult') : null);
        if (q) who.push(q);
      }
      if (who.length < want.n) {
        // Nobody of that age at home: whoever is there does what fits them.
        home.unshift(...who);
        who = home.length ? [home.shift()!] : [];
        if (!who.length) continue;
        act = fallbackAct(ageBand(who[0], s.week), who[0].sex);
      }
      for (const q of who) free.splice(free.indexOf(q), 1);
      const spots = houseSpots(act, b.level, o, m);
      add(
        who.map((q, j) => {
          const [lx, lz, yaw] = spots[Math.min(j, spots.length - 1)];
          const w = localToWorld(p, lx, lz);
          return figure(act, w.x, w.z, p.rot + yaw, q, 0);
        }).filter((f) => standable(s, f.x, f.z, b)),
        hash(b.x + n, b.y, 73),
      );
    }
  }
  // In show order: the first `n` are the ones on the streets when the share allows n.
  return out.sort((a, c) => a.show - c.show);
}

/** How many of a plan (in show order) are out for a street `share` (0..1). */
export function idleShown(spots: readonly IdleSpot[], share: number): number {
  let n = 0;
  while (n < spots.length && spots[n].show < share) n++;
  return n;
}

/** Where an idle figure is at `time` (seconds) and how it holds itself (`y` above the ground). */
export interface IdlePose {
  x: number;
  z: number;
  y: number;
  yaw: number;
  /** Forward bend (radians) and sideways roll. */
  lean: number;
  roll: number;
}

/**
 * The small motions of the still life: neighbours turn a little and nod as they talk, a child runs a
 * small circle hopping, someone at the door shifts their weight, a woman kneels and bends over her
 * grinding stone, a buyer looks around the stalls and steps, a picker swings his pole at the
 * branches, another kneels and gathers.
 */
export function idlePose(o: IdleSpot, time: number): IdlePose {
  const ph = o.k * 6.283;
  const still = { x: o.x, z: o.z, y: 0, yaw: o.yaw, lean: 0, roll: 0 };
  switch (o.act) {
    case 'talk':
      return { ...still, yaw: o.yaw + Math.sin(time * 0.7 + ph) * 0.15, lean: Math.max(0, Math.sin(time * 2.3 + ph)) * 0.07, roll: Math.sin(time * 0.9 + ph) * 0.03 };
    case 'play': {
      const a = time * 2.2 + ph;
      const r = 0.15;
      return { x: o.x + Math.cos(a) * r, z: o.z + Math.sin(a) * r, y: Math.abs(Math.sin(time * 9 + ph)) * 0.05, yaw: Math.atan2(-Math.sin(a), Math.cos(a)), lean: 0.08, roll: Math.sin(time * 9 + ph) * 0.06 };
    }
    case 'stand':
      return { ...still, yaw: o.yaw + Math.sin(time * 0.3 + ph) * 0.25, roll: Math.sin(time * 0.6 + ph) * 0.035 };
    case 'grind':
    case 'gather':
      // Kneeling (lower) and bending over the stone or the ground.
      return { ...still, y: -0.06, lean: (o.act === 'gather' ? 0.5 : 0.35) + Math.max(0, Math.sin(time * 2.6 + ph)) * 0.25 };
    case 'buy': {
      const step = Math.sin(time * 0.15 + ph) * 0.08;
      return { ...still, x: o.x + Math.sin(o.yaw + Math.PI / 2) * step, z: o.z + Math.cos(o.yaw + Math.PI / 2) * step, yaw: o.yaw + Math.sin(time * 0.4 + ph) * 0.35, lean: Math.max(0, Math.sin(time * 1.1 + ph)) * 0.08 };
    }
    case 'beat':
      // The pole goes up (leaning back) and comes down on the branches, about once a second.
      return { ...still, lean: -0.12 + Math.max(0, Math.sin(time * 4 + ph)) * 0.3 };
  }
}

// ------------------------------------------------------------------ a family leaving the town

/** Who walks out of town from the house on cell (x, y): its people who left this week (the latest first), at most `max`. */
export function leavers(s: GameState, x: number, y: number, max = 6): Person[] {
  const house = x >= 0 && y >= 0 && x < s.cols && y < s.rows ? s.grid[indexOf(s, x, y)] : null;
  const recent = s.departed.filter((p) => p.end && p.end.week >= s.week - 1 && p.end.cause !== 'age' && p.end.cause !== 'coldDeath');
  const own = house ? recent.filter((p) => p.houseId === house.id) : [];
  return own.slice(-max);
}

/** What a leaving person carries: the adults a bundle on the back, the old a staff, the children nothing. */
export const leaveLoad = (band: AgeBand): Load | null => (band === 'adult' ? 'sack' : band === 'elder' ? 'staff' : null);

/**
 * The way out of town from the house on cell (x, y) (a 2x2 house): from the house to its door and
 * along the roads to the entrance; with no road there (the road was cut), straight across the land.
 */
export function leavePath(s: GameState, x: number, y: number): Cell[] {
  const home: Cell = { x, y };
  const rect = { x, y, w: 2, h: 2 };
  const doors: Cell[] = [];
  for (let k = 0; k < 2; k++) doors.push({ x: rect.x + k, y: rect.y + 2 }, { x: rect.x + k, y: rect.y - 1 }, { x: rect.x - 1, y: rect.y + k }, { x: rect.x + 2, y: rect.y + k });
  for (const d of doors) {
    const way = findPath(s, d, [s.entrance]);
    if (way) return [home, ...way, { x: s.entrance.x, y: Math.min(s.rows, s.entrance.y + 1) }];
  }
  // Across the land: along x, then along y.
  const out: Cell[] = [home];
  let c = { ...home };
  while (c.x !== s.entrance.x) out.push((c = { x: c.x + Math.sign(s.entrance.x - c.x), y: c.y }));
  while (c.y !== s.entrance.y) out.push((c = { x: c.x, y: c.y + Math.sign(s.entrance.y - c.y) }));
  return out;
}

/** The leader's step along a leaving path `seconds` after leaving at `speed` cells a second; null once the whole group (`length` long) is out. */
export function leaveLead(seconds: number, speed: number, last: number, length: number): number | null {
  const lead = Math.max(0, seconds) * speed;
  return lead - length > last ? null : lead;
}

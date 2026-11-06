import {
  GOALS,
  HOUSE_LEVELS,
  RULES,
  addPerson,
  wed,
  campRoad,
  createGame,
  createRng,
  dimsOf,
  indexOf,
  place,
  refreshCity,
  ROAD_X,
  seatsOf,
  type BuildableKind,
  type Building,
  type GameState,
  type GoalDef,
  type Person,
  type Rng,
  type Sex,
} from '../src/core';

/** A goal no test city reaches by accident (the first one asking for 100 residents): tests of goals set goalIndex. */
export const QUIET_GOAL = GOALS.findIndex((g) => g.type === 'residents' && g.target >= 100);

/**
 * A fresh game with sand everywhere (except the river), no rocks or trees, plenty of silver, wood
 * and stone, and everything unlocked. The 4x4 altar covers x, y = 22..25, a road ring surrounds it (x, y = 21..26)
 * and the starting road runs south along x = 24, from the ring (y = 26) to the entrance at (24, 47).
 * Buildings beside the starting road go at y >= 27 so they stay off the ring.
 */
export function emptyGame(overrides: Partial<GameState> = {}): GameState {
  const s = createGame(createRng(1));
  // No caravan: only the altar, nobody living, no later caravans and a fixed food stock (tests of the caravans use createGame).
  s.buildings = s.buildings.filter((b) => b.kind === 'altar');
  s.people = [];
  s.caravans = [];
  s.grid = s.grid.map((b) => (b?.kind === 'altar' ? b : null));
  for (const c of campRoad()) s.roads[indexOf(s, c.x, c.y)] = false; // no camp road without the caravan
  s.food = 30;
  s.ground = s.ground.map((g) => (g === 'river' ? 'river' : 'sand'));
  s.feature = s.feature.map(() => null);
  s.silver = 100_000;
  s.wood = 100_000;
  s.stone = 100_000;
  s.unlocked = ['road', 'house', 'field', 'plaza', 'market', 'workshop', 'park', 'temple'];
  s.goalIndex = QUIET_GOAL; // no goal reward moves the silver (tests of goals set goalIndex)
  Object.assign(s, overrides);
  refreshCity(s);
  return s;
}

/**
 * Places a building (top-left at x, y) without charging silver or materials, optionally at a given
 * house level: a house with people is filled to its capacity with adults (`fill`) unless `people`
 * says how many. Like any change in the game, it hands the free jobs out (`refreshCity`).
 */
export function put(s: GameState, kind: BuildableKind, x: number, y: number, level = 0, rotated = false, people?: number) {
  const { silver, wood, stone, unlocked } = s;
  Object.assign(s, { silver: 1e9, wood: 1e9, stone: 1e9, unlocked: [kind] });
  const r = place(s, kind, x, y, rotated);
  Object.assign(s, { silver, wood, stone, unlocked });
  if (!r.ok) throw new Error(`cannot place ${kind} at ${x},${y}: ${r.reason}`);
  const b = s.grid[indexOf(s, x, y)]!;
  b.upWeeks = UP_WEEKS; // a fixed climb (the drawn one is tested in levels.test.ts)
  if (kind === 'house' && level > 0) {
    b.level = level;
    fill(s, b, people ?? HOUSE_LEVELS[level].capacity);
    refreshCity(s); // the new adults take the free jobs, as after any change in the game
  }
  return b;
}

/**
 * Adds `n` adults to a house: married couples (man, woman) of `age` years. The default 41 is past
 * the marriage and fertile ages and far from the elder age, so they only eat, work and pay: no
 * wedding, birth or death for the next 8 years of life (104 weeks).
 */
export function fill(s: GameState, b: Building, n: number, age = 41): Person[] {
  const out = Array.from({ length: n }, (_, k) => person(s, { houseId: b.id, sex: k % 2 ? 'f' : 'm', age }));
  for (let k = 0; k + 1 < out.length; k += 2) wed(out[k], out[k + 1]);
  return out;
}

/** House id of the workers `hire` adds: no building, so they neither eat nor need a house. */
export const HIRED = -1;

/**
 * Gives a workplace `n` workers from outside the test's houses (adults with no house building, so
 * they neither eat nor pay): for tests where a market must cover or a lumber must work without
 * taking the adults of the houses.
 */
export function hire(s: GameState, b: Building, n = seatsOf(b)): Person[] {
  const out = Array.from({ length: n }, () => Object.assign(person(s, { houseId: HIRED, age: 41 }), { jobId: b.id }));
  refreshCity(s);
  return out;
}

/** Adds a person born exactly `age` years ago this week (birthday this week), of the founding caravan unless told. */
export function person(s: GameState, o: { houseId: number | null; sex?: Sex; age?: number; caravan?: number | null; fatherId?: number; motherId?: number }): Person {
  const p = addPerson(s, { sex: o.sex ?? 'm', age: o.age ?? 30, houseId: o.houseId, caravan: o.caravan === undefined ? 0 : o.caravan, clan: 0, fatherId: o.fatherId, motherId: o.motherId }, () => 0);
  p.birthWeek = s.week - (o.age ?? 30) * RULES.people.weeksPerLifeYear;
  return p;
}

/** Weeks a house put by a test needs to climb a level (the shortest of `weeksToUpgrade`). */
export const UP_WEEKS = RULES.weeksToUpgrade[0];

/** Weeks of game per year of life. */
export const LIFE_YEAR = RULES.people.weeksPerLifeYear;

/** Lays road cells without charging silver. */
export function road(s: GameState, cells: [number, number][]) {
  for (const [x, y] of cells) s.roads[indexOf(s, x, y)] = true;
  refreshCity(s);
}

export const constRng = (v: number): Rng => () => v;
/** The starting road column (x = 24) and its first cell below the altar (y = 26, on the ring). */
export { ROAD_X };
export const ROAD_TOP = 26;
/** Left column of a 2x2 house touching the starting road on its west side (x = 22..23). */
export const ROADSIDE = ROAD_X - 2;
/** Left column of a building of this kind touching the starting road on its west side. */
export const westOf = (kind: BuildableKind) => ROAD_X - dimsOf(kind).w;
/** Left column of any building touching the starting road on its east side. */
export const EAST = ROAD_X + 1;

/**
 * Left column of a 2x2 building at rows y..y+1 that touches the river on its east side (the river
 * runs east of the altar), with a road on row y from the starting road to it.
 */
export function besideRiver(s: GameState, y: number): number {
  const riverAt = (row: number) => {
    let x = ROAD_X + 2;
    while (s.ground[indexOf(s, x, row)] !== 'river') x++;
    return x;
  };
  const left = Math.min(riverAt(y), riverAt(y + 1)) - 2;
  road(s, Array.from({ length: left - ROAD_X - 1 }, (_, k) => [ROAD_X + 1 + k, y] as [number, number]));
  return left;
}

/** First spring: fields built in the first autumn harvest, so they are at work (and take workers). */
export const FIRST_SPRING = 2 * RULES.weeksPerSeason;

/** Moves to the first spring, when the fields built at the start take their workers. */
export function atHarvest(s: GameState) {
  s.week = FIRST_SPRING;
}

/**
 * Meets a "residents" or "houses" goal with connected houses beside the starting road (west side,
 * from row `y` down): big houses for residents, houses of the goal's level for houses.
 */
export function meetGoal(s: GameState, goal: GoalDef, y = 27) {
  const top = HOUSE_LEVELS.length - 1;
  let count: number;
  let level: number;
  if (goal.type === 'residents') {
    level = top;
    count = Math.ceil(goal.target / HOUSE_LEVELS[top].capacity);
  } else if (goal.type === 'houses') {
    level = goal.level ?? 1;
    count = goal.target;
  } else throw new Error(`meetGoal: goal type ${goal.type} is not supported`);
  for (let k = 0; k < count; k++) put(s, 'house', ROADSIDE, y + 2 * k, level);
}

/**
 * Test oracle: whole weeks a food stock lasts from `week` with only houses eating (no production),
 * `eat(w)` a week, rounded like the weekly step; `floor` is the reserve the food must stay above.
 */
export function weeksOfFood(food: number, week: number, eat: (w: number) => number, floor = 0): number {
  const round2 = (v: number) => Math.round(v * 100) / 100;
  for (let k = 0; ; k++) {
    food = round2(food - round2(eat(week + k)));
    if (food <= floor) return k;
  }
}

import { HOUSE_LEVELS, RULES } from './data';
import { pickName } from './names';
import { seasonOf } from './seasons';
import type { AgeBand, Building, EndCause, GameState, Person, Rng, Sex } from './types';

/** People: ages, families and houses. Pure helpers; the weekly rules are in life.ts. */

const P = RULES.people;

/** Years of life (one every `weeksPerLifeYear` weeks since the birth week). */
export const ageOf = (p: Pick<Person, 'birthWeek'>, week: number) => Math.floor((week - p.birthWeek) / P.weeksPerLifeYear);

export const bandOfAge = (age: number): AgeBand => (age < P.adultAge ? 'child' : age < P.elderAge ? 'adult' : 'elder');

export const ageBand = (p: Pick<Person, 'birthWeek'>, week: number) => bandOfAge(ageOf(p, week));

/** This week the person turns a year older (every person once a season, spread over its weeks). */
export const isBirthday = (p: Pick<Person, 'birthWeek'>, week: number) => week > p.birthWeek && (week - p.birthWeek) % P.weeksPerLifeYear === 0;

/** Chance of dying at a birthday of this age (0 before the first row of `people.death`). */
export function deathChance(age: number): number {
  let chance = 0;
  for (const [from, c] of P.death) if (age >= from) chance = c;
  return chance;
}

/** Food a person of this band eats in a week in a house of this level: more in winter, and most in a tent. */
export function foodOf(band: AgeBand, level: number, week: number): number {
  const food = P.food[band];
  if (seasonOf(week) !== 'winter') return food;
  return food * (level === 1 ? RULES.winter.tentFoodFactor : RULES.winter.foodFactor);
}

/** A person alive or in the records (dead or gone). */
export const personById = (s: GameState, id: number | null): Person | undefined =>
  id === null ? undefined : (s.people.find((p) => p.id === id) ?? s.departed.find((p) => p.id === id));

/** People living in a house. */
export const household = (s: GameState, houseId: number) => s.people.filter((p) => p.houseId === houseId);

/** Children of a person, alive or not (nothing is stored: found by father or mother). */
export const childrenOf = (s: GameState, id: number) => [...s.people, ...s.departed].filter((p) => p.fatherId === id || p.motherId === id);

/** The person is walking along the roads (caravan, newly-weds, an elder moving). */
export const isWalking = (s: GameState, id: number) => s.families.some((f) => f.members.includes(id));

/** Most people a house of this level holds. */
export const capacityOf = (b: Pick<Building, 'level'>) => HOUSE_LEVELS[b.level]?.capacity ?? 0;

/** Same parent (father or mother): siblings or half-siblings. */
export const shareParent = (a: Person, b: Person) =>
  (a.fatherId !== null && a.fatherId === b.fatherId) || (a.motherId !== null && a.motherId === b.motherId);

export interface NewPerson {
  sex: Sex;
  age: number;
  houseId: number | null;
  caravan: number | null;
  clan: number;
  fatherId?: number | null;
  motherId?: number | null;
}

/**
 * Adds a person of this age (the week of the birthday is drawn, so birthdays spread over the
 * season), with a name drawn for the sex. Returns the new person.
 */
export function addPerson(s: GameState, o: NewPerson, rng: Rng): Person {
  const birthWeek = s.week - o.age * P.weeksPerLifeYear - Math.floor(rng() * P.weeksPerLifeYear);
  const p: Person = {
    id: s.nextId++,
    name: pickName(s, o.sex, rng),
    sex: o.sex,
    clan: o.clan,
    birthWeek: o.age === 0 && o.caravan === null ? s.week : birthWeek,
    houseId: o.houseId,
    fatherId: o.fatherId ?? null,
    motherId: o.motherId ?? null,
    spouseId: null,
    engaged: null,
    caravan: o.caravan,
  };
  s.people.push(p);
  return p;
}

/** Marks two people as husband and wife (married, not engaged). */
export function wed(a: Person, b: Person) {
  a.spouseId = b.id;
  b.spouseId = a.id;
  a.engaged = null;
  b.engaged = null;
}

/** The causes that are a death (not a leaving). */
const DEATHS: readonly EndCause[] = ['age', 'coldDeath'];

/**
 * A person leaves the living: into `departed` with the week and cause. An engagement ends (the
 * other one may get engaged again); a spouse stays a widow(er). Leaves any walking group.
 */
export function depart(s: GameState, p: Person, cause: EndCause) {
  s.people = s.people.filter((o) => o !== p);
  s.departed.push({ ...p, end: { week: s.week, cause } });
  const partner = s.people.find((o) => o.id === p.spouseId);
  if (partner && partner.engaged !== null) {
    partner.engaged = null;
    partner.spouseId = null;
  }
  for (const f of s.families) f.members = f.members.filter((id) => id !== p.id);
  s.families = s.families.filter((f) => f.members.length > 0);
  if (DEATHS.includes(cause)) s.yearStats.deaths++;
  if (cause === 'coldDeath') s.yearStats.coldDeaths++;
}

/** The person died (of age or of cold), rather than leaving the city. */
export const died = (p: Person): boolean => !!p.end && DEATHS.includes(p.end.cause);

/** Everyone in a house leaves the city (famine, no road, demolished). Returns the family name's clan of the eldest, or null when empty. */
export function leaveHouse(s: GameState, houseId: number, cause: EndCause): number | null {
  const all = household(s, houseId);
  const eldest = all.reduce<Person | null>((a, p) => (!a || p.birthWeek < a.birthWeek ? p : a), null);
  for (const p of all) depart(s, p, cause);
  return eldest?.clan ?? null;
}

/**
 * A house nobody lives in any more stands empty: it keeps its level in `emptyLevel` (a tent keeps
 * none: the tent goes with the family) and drops to 0, so `level >= 1` always means people live there.
 */
export function vacate(s: GameState, houseId: number | null) {
  const b = s.buildings.find((o) => o.id === houseId);
  if (!b || b.kind !== 'house' || b.level === 0 || s.people.some((p) => p.houseId === b.id)) return;
  b.emptyLevel = b.level > 1 ? b.level : 0;
  b.level = 0;
  b.upStreak = 0;
  b.downStreak = 0;
  b.variant %= HOUSE_LEVELS[0].variants;
}

/** People living in the city (not on the way), by age band. */
export function bandCounts(s: GameState): Record<AgeBand, number> {
  const out: Record<AgeBand, number> = { child: 0, adult: 0, elder: 0 };
  for (const p of s.people) if (p.houseId !== null) out[ageBand(p, s.week)]++;
  return out;
}

/** Engaged couples (man, woman) not walking to a house: they wait for an empty house, oldest engagement first. */
export function waitingCouples(s: GameState): { man: Person; woman: Person; since: number }[] {
  const out: { man: Person; woman: Person; since: number }[] = [];
  for (const man of s.people) {
    if (man.sex !== 'm' || man.engaged === null || isWalking(s, man.id)) continue;
    const woman = s.people.find((o) => o.id === man.spouseId);
    if (woman) out.push({ man, woman, since: man.engaged });
  }
  return out.sort((a, b) => a.since - b.since || a.man.id - b.man.id);
}

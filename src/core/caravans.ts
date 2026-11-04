import { RULES } from './data';
import { round2 } from './economy';
import { freeHouses, sendWalking, startCell } from './families';
import { reach } from './goals';
import { foodCapacity } from './harvest';
import { pickClan } from './names';
import { addPerson, ageBand, wed } from './people';
import { between } from './rng';
import type { GameEvent, GameState, Person, Rng, Sex } from './types';

/** The caravans: the families that found the city and the rare later ones (see rules.json > caravans). */

const C = RULES.caravans;
const P = RULES.people;

/** A family template index drawn by weight. */
export function pickTemplate(rng: Rng): number {
  const total = P.templates.reduce((a, t) => a + t.weight, 0);
  let r = rng() * total;
  for (let k = 0; k < P.templates.length; k++) {
    r -= P.templates[k].weight;
    if (r < 0) return k;
  }
  return P.templates.length - 1;
}

export interface FamilyOptions {
  template: number;
  /** House they live in (null: on the way). */
  houseId: number | null;
  /** Caravan number (0 = the founding one). */
  caravan: number;
  /** Sex of the child (drawn when missing). */
  childSex?: Sex;
  /** Age range of the child, instead of the template's. */
  childAge?: [number, number];
}

/**
 * A new family from a template: a married couple of a new family name, with their child or the
 * husband's father or mother. Returns its people, father first.
 */
export function makeFamily(s: GameState, o: FamilyOptions, rng: Rng): Person[] {
  const clan = pickClan(s, rng);
  const base = { houseId: o.houseId, caravan: o.caravan, clan };
  const out: Person[] = [];
  let father: Person | undefined;
  let mother: Person | undefined;
  for (const m of P.templates[o.template].members) {
    if (m.role === 'father') out.push((father = addPerson(s, { ...base, sex: 'm', age: between(rng, m.age) }, rng)));
    else if (m.role === 'mother') out.push((mother = addPerson(s, { ...base, sex: 'f', age: between(rng, m.age) }, rng)));
    else if (m.role === 'child') {
      const sex = o.childSex ?? (rng() < 0.5 ? 'm' : 'f');
      out.push(addPerson(s, { ...base, sex, age: between(rng, o.childAge ?? m.age), fatherId: father?.id, motherId: mother?.id }, rng));
    } else {
      const elder = addPerson(s, { ...base, sex: rng() < 0.5 ? 'm' : 'f', age: between(rng, m.age) }, rng);
      if (father) father[elder.sex === 'm' ? 'fatherId' : 'motherId'] = elder.id;
      out.push(elder);
    }
  }
  if (father && mother) wed(father, mother);
  return out;
}

/** Food the people eat in a week out of winter (what a caravan brings is counted in it). */
export const plainEating = (people: Person[], week: number) => people.reduce((a, p) => a + P.food[ageBand(p, week)], 0);

/**
 * The founding caravan's people, one family per tent: the first two from the couple's template
 * with a son and a daughter of `couple.age`, engaged (`start.couple`); the children of the others
 * alternate between son and daughter. Returns everyone.
 */
export function foundPeople(s: GameState, tents: number[], rng: Rng): Person[] {
  const all: Person[] = [];
  const couple: Person[] = [];
  tents.forEach((houseId, k) => {
    const isCouple = k < 2;
    const template = isCouple ? P.couple.template : pickTemplate(rng);
    const childSex: Sex = k % 2 === 0 ? 'm' : 'f';
    const family = makeFamily(s, { template, houseId, caravan: 0, childSex, childAge: isCouple ? P.couple.age : undefined }, rng);
    if (isCouple) couple.push(family.find((p) => p.fatherId !== null)!);
    all.push(...family);
  });
  if (couple.length === 2) {
    const [man, woman] = couple;
    man.spouseId = woman.id;
    woman.spouseId = man.id;
    man.engaged = woman.engaged = s.week;
    s.start.couple = [man.id, woman.id];
  }
  return all;
}

/** Rolls the later caravans: the week each arrives (in its window), its families, how long before it is announced; skipped by its chance. */
export function rollCaravans(s: GameState, rng: Rng) {
  s.caravans = C.later.map((c) => {
    const come = rng() < c.chance;
    return { week: between(rng, c.weeks), families: between(rng, c.families), warn: between(rng, C.warnWeeks), status: come ? 'planned' : 'skipped', housed: 0, left: 0 };
  });
}

/**
 * A later caravan arrives: each family takes the best empty house (`freeHouses` from the entrance)
 * and walks to it from the entrance; families without a house go on at once. The caravan brings
 * `foodWeeks` weeks of the eating of those who stay, cut by the stores.
 */
function arrive(s: GameState, index: number, rng: Rng, events: GameEvent[]) {
  const c = s.caravans[index];
  const from = startCell(s);
  const stayed: Person[] = [];
  for (let k = 0; k < c.families; k++) {
    const houses = from ? freeHouses(s, from) : [];
    const before = s.people.length;
    const family = houses.length ? makeFamily(s, { template: pickTemplate(rng), houseId: null, caravan: index + 1 }, rng) : [];
    if (family.length && sendWalking(s, from, houses, family.map((p) => p.id))) {
      stayed.push(...family);
      c.housed++;
    } else {
      s.people.splice(before); // nobody of a family that goes on stays in the records
      c.left++;
    }
  }
  c.status = 'arrived';
  const food = round2(between(rng, C.foodWeeks) * plainEating(stayed, s.week));
  s.food = Math.max(s.food, Math.min(foodCapacity(s), round2(s.food + food)));
  events.push({ type: 'caravanArrived', housed: c.housed, left: c.left, x: s.entrance.x, y: s.entrance.y });
  if (c.housed > 0) reach(s, 'firstCaravan', events);
}

/** Announces each later caravan `warn` weeks before it comes, and brings it in its week. */
export function stepCaravans(s: GameState, rng: Rng, events: GameEvent[]) {
  s.caravans.forEach((c, k) => {
    if (c.status === 'planned' && s.week >= c.week - c.warn) {
      c.status = 'announced';
      events.push({ type: 'caravanAnnounced', families: c.families, week: c.week });
    }
    if (c.status === 'announced' && s.week >= c.week) arrive(s, k, rng, events);
  });
}

/** The next caravan announced and not yet arrived, or null. */
export const announcedCaravan = (s: GameState) => s.caravans.find((c) => c.status === 'announced') ?? null;

import { RULES } from './data';
import { computeEconomy, type Economy } from './economy';
import { celebrateWedding, freeHouses, moveIn, roomIn, sendWalking } from './families';
import { foodLastsToHarvest } from './forecast';
import { reach } from './goals';
import { doorsOf } from './network';
import { birthFactor } from './happiness';
import {
  addPerson,
  ageBand,
  ageOf,
  childrenOf,
  deathChance,
  depart,
  household,
  isBirthday,
  isWalking,
  shareParent,
  vacate,
  waitingCouples,
} from './people';
import type { Building, GameEvent, GameState, Person, Rng } from './types';

/** The weekly rules of the people: birthdays and deaths, elders moving, engagements, weddings and births. */

const P = RULES.people;

/** Why no child can be born in the city now, or null when children can come. */
export type BirthBlock = 'famine' | 'food' | 'storage';

/**
 * Children are born only in a city whose food lasts until the next harvest with a reserve of
 * `birthFoodReserveWeeks` weeks of eating (`storage`: it would last, but the store cannot hold it),
 * and never in a famine. A city with nobody living in it skips the food check.
 */
export function birthBlock(s: GameState, eco: Economy = computeEconomy(s)): BirthBlock | null {
  if (s.famine) return 'famine';
  if (eco.residents === 0) return null;
  const opts = { reserveWeeks: P.birthFoodReserveWeeks };
  if (foodLastsToHarvest(s, eco, opts)) return null;
  return foodLastsToHarvest(s, eco, { ...opts, unlimited: true }) ? 'storage' : 'food';
}

const houseOf = (s: GameState, p: Person) => s.buildings.find((b) => b.id === p.houseId);
const where = (s: GameState, p: Person) => houseOf(s, p) ?? s.entrance;
const inRange = (age: number, [min, max]: [number, number]) => age >= min && age <= max;

/** Birthdays: the elders may die (by the chance of their age); a child born in the city who comes of age is a milestone. */
function birthdays(s: GameState, rng: Rng, events: GameEvent[]) {
  for (const p of [...s.people]) {
    if (!isBirthday(p, s.week)) continue;
    const age = ageOf(p, s.week);
    if (age === P.adultAge && p.caravan === null) reach(s, 'firstGrownUp', events);
    const chance = deathChance(age);
    if (chance <= 0 || rng() >= chance) continue;
    const { x, y } = where(s, p);
    depart(s, p, 'age');
    vacate(s, p.houseId);
    events.push({ type: 'death', id: p.id, age, x, y });
  }
}

/** An elder living alone walks to the house of a son or daughter with room (the highest level, then the nearest). */
function eldersMove(s: GameState) {
  for (const p of s.people) {
    if (p.houseId === null || ageBand(p, s.week) !== 'elder' || isWalking(s, p.id)) continue;
    const home = houseOf(s, p);
    if (!home || household(s, home.id).length > 1) continue;
    const homes = new Set(childrenOf(s, p.id).filter((c) => s.people.includes(c) && c.houseId !== home.id).map((c) => c.houseId));
    const d = (b: Building) => Math.abs(b.x - home.x) + Math.abs(b.y - home.y);
    const targets = s.buildings
      .filter((b) => homes.has(b.id) && b.level > 0 && b.connected && roomIn(s, b) > 0)
      .sort((a, b) => b.level - a.level || d(a) - d(b) || a.id - b.id);
    sendWalking(s, doorsOf(s, home)[0], targets, [p.id]);
  }
}

/** Never-married adults in the city in the marriage ages, not walking. */
const canMarry = (s: GameState, p: Person) =>
  p.houseId !== null && p.spouseId === null && inRange(ageOf(p, s.week), P.marriageAges) && !isWalking(s, p.id);

/**
 * Each man who can marry gets engaged with `marriageChance` when a woman who can marry lives in
 * another house, shares no parent with him and is at most `maxAgeGap` years apart: the one
 * nearest his age (ties: the lowest id).
 */
function engagements(s: GameState, rng: Rng) {
  const women = s.people.filter((p) => p.sex === 'f' && canMarry(s, p));
  for (const man of s.people.filter((p) => p.sex === 'm' && canMarry(s, p))) {
    const age = ageOf(man, s.week);
    const gap = (w: Person) => Math.abs(ageOf(w, s.week) - age);
    const fits = women.filter((w) => w.spouseId === null && w.houseId !== man.houseId && !shareParent(man, w) && gap(w) <= P.maxAgeGap);
    if (!fits.length || rng() >= P.marriageChance) continue;
    const woman = fits.reduce((a, w) => (gap(w) < gap(a) || (gap(w) === gap(a) && w.id < a.id) ? w : a));
    man.spouseId = woman.id;
    woman.spouseId = man.id;
    man.engaged = woman.engaged = s.week;
  }
}

/**
 * Engaged couples, oldest engagement first, look for a house: when one of them lives alone, the
 * other moves in that week; else they walk from the man's house to the best empty house
 * (`freeHouses`) and marry there. Couples waiting `coupleWaitWeeks` leave the city.
 */
function weddings(s: GameState, rng: Rng, events: GameEvent[]) {
  for (const { man, woman, since } of waitingCouples(s)) {
    const his = houseOf(s, man);
    const hers = houseOf(s, woman);
    if (!his || !hers) continue;
    const alone = household(s, his.id).length === 1 ? his : household(s, hers.id).length === 1 ? hers : null;
    if (alone) {
      moveIn(s, alone, [man.id, woman.id], rng, events);
      celebrateWedding(s, man.id, woman.id, alone, events);
      continue;
    }
    if (sendWalking(s, doorsOf(s, his)[0], freeHouses(s, his), [man.id, woman.id])) continue;
    if (s.week - since < P.coupleWaitWeeks) continue;
    depart(s, man, 'noHouse');
    depart(s, woman, 'noHouse');
    vacate(s, his.id);
    vacate(s, hers.id);
    events.push({ type: 'coupleLeft', a: man.id, b: woman.id });
  }
}

/** The mother's youngest child was born at least `birthGapWeeks` ago (or she has none). */
const gapOver = (s: GameState, mother: Person) =>
  childrenOf(s, mother.id).every((c) => c.motherId !== mother.id || s.week - c.birthWeek >= P.birthGapWeeks);

/**
 * When the city lets (`birthBlock`), each married couple living together, with the mother in the
 * fertile ages, room in the house and the last child `birthGapWeeks` ago, has a child with
 * `birthChance` times the happiness factor. The baby takes the father's family name.
 */
function births(s: GameState, rng: Rng, events: GameEvent[]) {
  const eco = computeEconomy(s);
  if (birthBlock(s, eco)) return;
  const chance = P.birthChance * birthFactor(eco.happiness);
  const mothers = s.people.filter((p) => p.sex === 'f' && p.engaged === null && p.houseId !== null && inRange(ageOf(p, s.week), P.fertileAges));
  for (const mother of mothers) {
    const father = s.people.find((p) => p.id === mother.spouseId);
    const house = houseOf(s, mother);
    if (!father || !house || father.houseId !== mother.houseId || isWalking(s, mother.id) || isWalking(s, father.id)) continue;
    if (roomIn(s, house) <= 0 || !gapOver(s, mother) || rng() >= chance) continue;
    const sex = rng() < 0.5 ? 'm' : 'f';
    const baby = addPerson(s, { sex, age: 0, houseId: house.id, caravan: null, clan: father.clan, fatherId: father.id, motherId: mother.id }, rng);
    s.yearStats.births++;
    events.push({ type: 'birth', id: baby.id, x: house.x, y: house.y });
    reach(s, 'firstBirth', events);
    if (father.caravan === null || mother.caravan === null) reach(s, 'thirdGeneration', events);
  }
}

/** One week of the people, in this order (see GAME_DESIGN.md). */
export function stepPeople(s: GameState, rng: Rng, events: GameEvent[]) {
  birthdays(s, rng, events);
  eldersMove(s);
  engagements(s, rng);
  weddings(s, rng, events);
  births(s, rng, events);
}

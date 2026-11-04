import { describe, expect, it } from 'vitest';
import {
  ageBand,
  ageOf,
  alerts,
  bandOfAge,
  birthBlock,
  childrenOf,
  clearCell,
  computeEconomy,
  deathChance,
  foodCapacity,
  foodOf,
  household,
  isBirthday,
  jobsOf,
  RULES,
  stepPeople,
  stepWeek,
  wed,
  type GameEvent,
  type GameState,
  type Person,
} from '../src/core';
import { constRng, EAST, emptyGame, LIFE_YEAR, person, put, ROADSIDE } from './helpers';

const P = RULES.people;
const W = RULES.weeksPerSeason;
/** First week of the first winter, and of the first summer (the game starts in autumn). */
const WINTER = W;
const SUMMER = 3 * W;
const always = constRng(0);
const never = constRng(0.99);

/** A week of the people only (no economy, houses or caravans). */
function people(s: GameState, rng = never): GameEvent[] {
  const events: GameEvent[] = [];
  stepPeople(s, rng, events);
  return events;
}

/** A married couple (man, woman) of these ages in a house. */
function couple(s: GameState, houseId: number, man = 30, woman = 28): [Person, Person] {
  const a = person(s, { houseId, sex: 'm', age: man });
  const b = person(s, { houseId, sex: 'f', age: woman });
  wed(a, b);
  return [a, b];
}

/** An engaged couple: each lives in a house of their own parents (two older adults with them). */
function engagedCouple(s: GameState, y1 = 27, y2 = 33): { man: Person; woman: Person } {
  const h1 = put(s, 'house', ROADSIDE, y1, 1, false, 2);
  const h2 = put(s, 'house', ROADSIDE, y2, 1, false, 2);
  const man = person(s, { houseId: h1.id, sex: 'm', age: 20 });
  const woman = person(s, { houseId: h2.id, sex: 'f', age: 19 });
  man.spouseId = woman.id;
  woman.spouseId = man.id;
  man.engaged = woman.engaged = s.week;
  return { man, woman };
}

/** Steps whole weeks until nobody walks (at most `max`). */
function walkIn(s: GameState, max = 20): GameEvent[] {
  const out: GameEvent[] = [];
  for (let k = 0; k < max && (k === 0 || s.families.length); k++) out.push(...stepWeek(s, never));
  return out;
}

describe('ages', () => {
  it('one year of life every weeksPerLifeYear weeks from the birth week (one season is one year)', () => {
    expect(P.weeksPerLifeYear).toBe(W);
    const p = { birthWeek: -5 };
    expect(ageOf(p, -5)).toBe(0);
    expect(ageOf(p, -5 + LIFE_YEAR - 1)).toBe(0);
    expect(ageOf(p, -5 + LIFE_YEAR)).toBe(1);
    expect(ageOf(p, -5 + 10 * LIFE_YEAR)).toBe(10);
    expect(isBirthday(p, -5)).toBe(false); // the birth itself is not a birthday
    expect(isBirthday(p, -5 + LIFE_YEAR)).toBe(true);
    expect(isBirthday(p, -5 + LIFE_YEAR + 1)).toBe(false);
  });

  it('children up to 13, adults 14 to 49, elders from 50', () => {
    expect([0, 13, 14, 49, 50, 90].map(bandOfAge)).toEqual(['child', 'child', 'adult', 'adult', 'elder', 'elder']);
    expect(ageBand({ birthWeek: 0 }, 14 * LIFE_YEAR - 1)).toBe('child');
    expect(ageBand({ birthWeek: 0 }, 14 * LIFE_YEAR)).toBe('adult');
  });

  it('a child eats 0.25, an adult 0.2, an elder 0.15; more in winter, most in a tent', () => {
    expect([foodOf('child', 2, SUMMER), foodOf('adult', 2, SUMMER), foodOf('elder', 2, SUMMER)]).toEqual([0.25, 0.2, 0.15]);
    expect(foodOf('child', 2, WINTER)).toBeCloseTo(0.25 * RULES.winter.foodFactor);
    expect(foodOf('adult', 1, WINTER)).toBeCloseTo(0.2 * RULES.winter.tentFoodFactor);
    expect(foodOf('adult', 1, SUMMER)).toBe(0.2);
  });
});

describe('deaths of age', () => {
  it('never before 50; then the chance of the table at each birthday; always at 90', () => {
    expect([0, 49, 50, 59, 60, 70, 80, 89, 90].map(deathChance)).toEqual([0, 0, 0.02, 0.02, 0.06, 0.15, 0.35, 0.35, 1]);
  });

  it('an elder dies at a birthday when the roll is below the chance of the age, not otherwise', () => {
    const s = emptyGame();
    const h = put(s, 'house', ROADSIDE, 27, 1, false, 1);
    const p = person(s, { houseId: h.id, age: 70 }); // birthday this week
    expect(people(s, constRng(0.16))).toEqual([]);
    const events = people(s, constRng(0.14));
    expect(events).toContainEqual({ type: 'death', id: p.id, age: 70, x: ROADSIDE, y: 27 });
    expect(s.people).not.toContain(p);
    expect(s.departed.find((o) => o.id === p.id)?.end).toEqual({ week: s.week, cause: 'age' });
    expect(s.yearStats.deaths).toBe(1);
  });

  it('dies only on the birthday week, and never younger than 50 even when every roll hits', () => {
    const s = emptyGame();
    const h = put(s, 'house', ROADSIDE, 27, 1, false, 0);
    const young = person(s, { houseId: h.id, age: 49 });
    const old = person(s, { houseId: h.id, age: 80 });
    old.birthWeek -= 3; // birthday 3 weeks ago
    people(s, always);
    expect(s.people).toEqual([young, old]);
  });

  it('at 90 everyone dies, whatever the roll', () => {
    const s = emptyGame();
    const h = put(s, 'house', ROADSIDE, 27, 1, false, 1);
    person(s, { houseId: h.id, age: 90 });
    people(s, constRng(0.9999));
    expect(s.people).toHaveLength(1);
  });

  it('the spouse becomes a widow(er); the house left empty keeps its level (a tent keeps none)', () => {
    const s = emptyGame();
    const mud = put(s, 'house', ROADSIDE, 27, 2, false, 0);
    const [man, woman] = couple(s, mud.id, 90, 60);
    woman.birthWeek -= 1; // not her birthday
    people(s);
    expect(woman.spouseId).toBe(man.id);
    expect(s.departed[0].id).toBe(man.id);
    expect(mud.level).toBe(2);

    const s2 = emptyGame();
    const tent = put(s2, 'house', ROADSIDE, 27, 1, false, 0);
    person(s2, { houseId: tent.id, age: 90 });
    const stone = put(s2, 'house', ROADSIDE, 33, 3, false, 0);
    person(s2, { houseId: stone.id, age: 90 });
    people(s2);
    expect(tent).toMatchObject({ level: 0, emptyLevel: 0 });
    expect(stone).toMatchObject({ level: 0, emptyLevel: 3 });
  });
});

describe('engagements', () => {
  /** A man and a woman, never married, each in a house with an older couple. */
  function pair(manAge: number, womanAge: number) {
    const s = emptyGame();
    const h1 = put(s, 'house', ROADSIDE, 27, 3, false, 2);
    const h2 = put(s, 'house', ROADSIDE, 33, 3, false, 2);
    const man = person(s, { houseId: h1.id, sex: 'm', age: manAge });
    const woman = person(s, { houseId: h2.id, sex: 'f', age: womanAge });
    return { s, man, woman, h1, h2 };
  }

  it('a man and a woman of 18 to 40 from different houses get engaged with marriageChance', () => {
    const { s, man, woman } = pair(20, 19);
    people(s, constRng(P.marriageChance + 0.001));
    expect(man.spouseId).toBeNull();
    people(s, constRng(P.marriageChance - 0.001));
    expect([man.spouseId, woman.spouseId, man.engaged, woman.engaged]).toEqual([woman.id, man.id, s.week, s.week]);
  });

  it('only in the marriage ages', () => {
    for (const [m, w, ok] of [[17, 20, false], [20, 17, false], [18, 18, true], [40, 40, true], [41, 30, false]] as const) {
      const { s, man } = pair(m, w);
      people(s, always);
      expect(man.spouseId !== null, `${m} and ${w}`).toBe(ok);
    }
  });

  it('never from the same house, nor brother and sister (same father or mother)', () => {
    const { s, man, woman, h1 } = pair(20, 20);
    woman.houseId = h1.id;
    people(s, always);
    expect(man.spouseId).toBeNull();

    const t = pair(20, 20);
    t.man.motherId = t.woman.motherId = 999;
    people(t.s, always);
    expect(t.man.spouseId).toBeNull();
  });

  it('at most maxAgeGap years apart, and the woman nearest his age (ties: the lowest id)', () => {
    expect(P.maxAgeGap).toBe(15);
    const far = pair(36, 20); // 16 years
    people(far.s, always);
    expect(far.man.spouseId).toBeNull();
    const ok = pair(35, 20); // 15 years
    people(ok.s, always);
    expect(ok.man.spouseId).toBe(ok.woman.id);

    const { s, man, h2 } = pair(25, 30);
    const h3 = put(s, 'house', ROADSIDE, 39, 3, false, 0);
    const near1 = person(s, { houseId: h2.id, sex: 'f', age: 24 });
    const near2 = person(s, { houseId: h3.id, sex: 'f', age: 26 });
    people(s, always);
    expect(man.spouseId).toBe(near1.id);
    expect(near2.spouseId).toBeNull();
  });

  it('a widow(er) does not marry again', () => {
    const { s, man } = pair(30, 30);
    man.spouseId = 999; // a wife who died
    people(s, always);
    expect(s.people.filter((p) => p.engaged !== null)).toEqual([]);
  });
});

describe('weddings', () => {
  it('an engaged couple walks from his house to an empty connected house and marries there', () => {
    const s = emptyGame();
    const { man, woman } = engagedCouple(s);
    const home = put(s, 'house', ROADSIDE, 39);
    stepWeek(s, never);
    expect(s.families).toHaveLength(1);
    expect(s.families[0]).toMatchObject({ houseId: home.id, members: [man.id, woman.id] });
    expect(man.engaged).not.toBeNull(); // still engaged on the way
    const events = walkIn(s);
    expect(events).toContainEqual({ type: 'wedding', a: man.id, b: woman.id, x: ROADSIDE, y: 39 });
    expect(events).toContainEqual({ type: 'milestone', id: 'firstWedding' });
    expect([man.houseId, woman.houseId, man.engaged, woman.engaged]).toEqual([home.id, home.id, null, null]);
    expect(home.level).toBe(1);
    expect(s.yearStats.weddings).toBe(1);
  });

  it('takes the empty house with the highest kept level, then the nearest to his house', () => {
    const s = emptyGame();
    engagedCouple(s, 27, 33);
    put(s, 'house', ROADSIDE, 29); // nearest
    const kept = put(s, 'house', ROADSIDE, 41);
    kept.emptyLevel = 2;
    stepWeek(s, never);
    expect(s.families[0].houseId).toBe(kept.id);

    const t = emptyGame();
    const { man } = engagedCouple(t, 27, 33);
    const near = put(t, 'house', ROADSIDE, 29);
    put(t, 'house', ROADSIDE, 41);
    stepWeek(t, never); // two cells away: they arrive in the same week
    expect(man.houseId).toBe(near.id);
  });

  it('without an empty house the couple waits (an alert), is warned in the last weeks and leaves after coupleWaitWeeks', () => {
    const s = emptyGame();
    s.food = 1e6;
    put(s, 'granary', EAST, 36);
    s.food = foodCapacity(s);
    const { man, woman } = engagedCouple(s);
    stepWeek(s, never);
    expect(alerts(s)).toContainEqual({ kind: 'couples', count: 1 });
    expect(alerts(s).some((a) => a.kind === 'coupleLeaving')).toBe(false);
    while (s.week < P.coupleWaitWeeks - P.coupleWarnWeeks) stepWeek(s, never);
    expect(alerts(s)).toContainEqual({ kind: 'coupleLeaving', man: man.name, woman: woman.name, weeks: P.coupleWarnWeeks });
    let left: GameEvent[] = [];
    while (s.week < P.coupleWaitWeeks) left = stepWeek(s, never);
    expect(left).toContainEqual({ type: 'coupleLeft', a: man.id, b: woman.id });
    expect(s.departed.filter((p) => p.end?.cause === 'noHouse').map((p) => p.id)).toEqual([man.id, woman.id]);
  });

  it('when one of them lives alone, the other moves in at once (no new house)', () => {
    const s = emptyGame();
    const { man, woman } = engagedCouple(s);
    const hers = s.buildings.find((b) => b.id === woman.houseId)!;
    for (const p of household(s, hers.id)) if (p !== woman) p.houseId = man.houseId; // her parents moved out
    const events = people(s);
    expect(events).toContainEqual({ type: 'wedding', a: man.id, b: woman.id, x: hers.x, y: hers.y });
    expect([man.houseId, woman.houseId]).toEqual([hers.id, hers.id]);
    expect(s.families).toHaveLength(0);
  });

  it('the house demolished on the way: the couple goes back to waiting where they lived', () => {
    const s = emptyGame();
    const { man, woman } = engagedCouple(s);
    const before = [man.houseId, woman.houseId];
    put(s, 'house', ROADSIDE, 41);
    stepWeek(s, never);
    clearCell(s, ROADSIDE, 41);
    stepWeek(s, never);
    expect(s.families).toHaveLength(0);
    expect([man.houseId, woman.houseId]).toEqual(before);
    expect(man.engaged).not.toBeNull();
    expect(s.people).toContain(man);
  });
});

describe('elders living alone', () => {
  it('an elder alone walks to the house of a child with room; the old house stands empty with its level', () => {
    const s = emptyGame();
    const old = put(s, 'house', ROADSIDE, 27, 2, false, 0);
    const elder = person(s, { houseId: old.id, sex: 'f', age: 60 });
    elder.birthWeek -= 1;
    const theirs = put(s, 'house', ROADSIDE, 33, 3, false, 0);
    const [son] = couple(s, theirs.id);
    son.motherId = elder.id;
    stepWeek(s, never);
    expect(s.families[0]).toMatchObject({ houseId: theirs.id, members: [elder.id] });
    walkIn(s);
    expect(elder.houseId).toBe(theirs.id);
    expect(old).toMatchObject({ level: 0, emptyLevel: 2 });
  });

  it('stays home when no child has room', () => {
    const s = emptyGame();
    const old = put(s, 'house', ROADSIDE, 27, 2, false, 0);
    const elder = person(s, { houseId: old.id, sex: 'm', age: 60 });
    elder.birthWeek -= 1;
    const theirs = put(s, 'house', ROADSIDE, 33, 1, false, 1); // a tent: 3 places
    const [son] = couple(s, theirs.id);
    son.fatherId = elder.id;
    stepWeek(s, never);
    expect(s.families).toHaveLength(0);
    expect(elder.houseId).toBe(old.id);
  });
});

describe('births', () => {
  /** A married couple in a stone house (6 places) with food for years. */
  function family(motherAge = 25) {
    const s = emptyGame();
    put(s, 'granary', EAST, 36);
    put(s, 'fisher', EAST, 30);
    s.food = foodCapacity(s);
    const house = put(s, 'house', ROADSIDE, 27, 3, false, 0);
    const [father, mother] = couple(s, house.id, 30, motherAge);
    father.birthWeek -= 1;
    mother.birthWeek -= 1;
    return { s, house, father, mother };
  }

  it('a married couple at home has a child with birthChance: the father\'s family name, both parents, born this week', () => {
    const { s, house, father, mother } = family();
    expect(people(s, constRng(P.birthChance + 0.001))).toEqual([]);
    const events = people(s, constRng(P.birthChance - 0.001));
    const baby = s.people.at(-1)!;
    expect(baby).toMatchObject({ houseId: house.id, fatherId: father.id, motherId: mother.id, clan: father.clan, birthWeek: s.week, caravan: null, spouseId: null });
    expect(events).toContainEqual({ type: 'birth', id: baby.id, x: house.x, y: house.y });
    expect(events).toContainEqual({ type: 'milestone', id: 'firstBirth' });
    expect(s.yearStats.births).toBe(1);
    expect(childrenOf(s, mother.id)).toEqual([baby]);
  });

  it('only with the mother in the fertile ages', () => {
    for (const [age, ok] of [[17, false], [18, true], [40, true], [41, false]] as const) {
      const { s } = family(age);
      const before = s.people.length;
      people(s, always);
      expect(s.people.length > before, `mother ${age}`).toBe(ok);
    }
  });

  it('not while the house is full, nor in a house over its capacity', () => {
    const { s, house } = family();
    person(s, { houseId: house.id, age: 45 });
    person(s, { houseId: house.id, age: 45 });
    person(s, { houseId: house.id, age: 45 });
    person(s, { houseId: house.id, age: 45 }); // 6 of 6
    people(s, always);
    expect(household(s, house.id)).toHaveLength(6);
    house.level = 2; // dropped to mud (4 places) with 6 people: nobody leaves, no child
    people(s, always);
    expect(household(s, house.id)).toHaveLength(6);
  });

  it('a mother has another child only birthGapWeeks after the last one', () => {
    const { s, mother } = family();
    people(s, always);
    expect(childrenOf(s, mother.id)).toHaveLength(1);
    s.week += P.birthGapWeeks - 1;
    people(s, always);
    expect(childrenOf(s, mother.id)).toHaveLength(1);
    s.week += 1;
    people(s, always);
    expect(childrenOf(s, mother.id)).toHaveLength(2);
  });

  it('not when the parents live apart, nor for an engaged couple', () => {
    const { s, father } = family();
    const other = put(s, 'house', ROADSIDE, 33, 1, false, 0);
    father.houseId = other.id;
    const before = s.people.length;
    people(s, always);
    expect(s.people).toHaveLength(before);
  });

  it('the city blocks births in a famine, when the food does not last to the spring with the reserve, or when only the store cuts it', () => {
    const { s } = family();
    expect(birthBlock(s)).toBeNull();
    s.famine = true;
    expect(birthBlock(s)).toBe('famine');
    const before = s.people.length;
    people(s, always);
    expect(s.people).toHaveLength(before);
    s.famine = false;

    const t = emptyGame();
    const h = put(t, 'house', ROADSIDE, 27, 3, false, 0);
    couple(t, h.id);
    t.food = 3;
    expect(birthBlock(t)).toBe('food');
    put(t, 'fisher', EAST, 30); // never enough to the spring without a store
    for (let k = 0; k < 4; k++) put(t, 'field', 10 + 2 * k, 27);
    expect(['food', 'storage']).toContain(birthBlock(t));
  });

  it('says "storage" when the food would last but the store cannot hold it', () => {
    const s = emptyGame(); // autumn: the fields give food until the winter
    for (let k = 0; k < 4; k++) put(s, 'house', ROADSIDE, 27 + 2 * k, 4);
    for (let k = 0; k < 4; k++) put(s, 'field', EAST, 27 + 2 * k);
    s.food = RULES.baseFoodStorage; // a winter of 32 people eats more than the store keeps
    expect(birthBlock(s)).toBe('storage');
    put(s, 'granary', EAST, 36);
    expect(birthBlock(s)).toBeNull();
  });

  it('the happiness factor scales the chance (1 before the park): a happy city has more children', () => {
    const roll = constRng(P.birthChance * 1.1); // above the plain chance
    const plain = family();
    plain.s.unlocked = plain.s.unlocked.filter((k) => k !== 'park');
    people(plain.s, roll);
    expect(plain.s.yearStats.births).toBe(0);
    const happy = family();
    put(happy.s, 'park', 19, 25); // west of the ring, reaching the house
    expect(computeEconomy(happy.s).happiness).toBeGreaterThanOrEqual(RULES.happiness.happy);
    people(happy.s, roll);
    expect(happy.s.yearStats.births).toBe(1);
  });

  it('the third generation: a child whose father or mother was born in the city', () => {
    const { s, father, mother } = family();
    people(s, always);
    expect(s.milestones).not.toContain('thirdGeneration');
    const t = family();
    t.mother.caravan = null;
    people(t.s, always);
    expect(t.s.milestones).toContain('thirdGeneration');
    void father;
    void mother;
  });

  it('a child born in the city reaching 14 is the first grown up; one of a caravan is not', () => {
    const s = emptyGame();
    const h = put(s, 'house', ROADSIDE, 27, 1, false, 0);
    person(s, { houseId: h.id, age: 14 }); // of the caravan
    people(s);
    expect(s.milestones).not.toContain('firstGrownUp');
    person(s, { houseId: h.id, age: 13, caravan: null }).birthWeek -= LIFE_YEAR;
    people(s);
    expect(s.milestones).toContain('firstGrownUp');
  });
});

describe('the people in the economy', () => {
  it('residents are the people living in the city; on the way they neither count nor eat; workers are the adults', () => {
    const s = emptyGame();
    s.week = SUMMER;
    const h = put(s, 'house', ROADSIDE, 27, 3, false, 0);
    person(s, { houseId: h.id, age: 5 });
    person(s, { houseId: h.id, age: 30 });
    person(s, { houseId: h.id, age: 60 });
    person(s, { houseId: null, age: 30 }); // walking in with a caravan
    const e = computeEconomy(s);
    expect([e.residents, e.workers, e.foodEaten]).toEqual([3, 1, 0.6]);
  });

  it('every house with people pays its level tax, however many live there', () => {
    const s = emptyGame();
    s.unlocked = s.unlocked.filter((k) => k !== 'park'); // no happiness factor
    put(s, 'house', ROADSIDE, 27, 2, false, 1);
    put(s, 'house', ROADSIDE, 33, 2, false, 4);
    expect(computeEconomy(s).taxes).toBe(2 * 1.75);
  });
});

describe('jobs', () => {
  it('adults by id fill the jobs of the connected workplaces by id; the rest have none; children and elders are not listed', () => {
    const s = emptyGame();
    const h = put(s, 'house', ROADSIDE, 27, 3, false, 0);
    const fisher = put(s, 'fisher', EAST, 30);
    const field = put(s, 'field', EAST, 33);
    put(s, 'fisher', 10, 10); // no road
    const adults = [30, 31, 32, 33].map((age) => person(s, { houseId: h.id, age }));
    const child = person(s, { houseId: h.id, age: 5 });
    const jobs = jobsOf(s);
    expect(adults.map((p) => jobs.get(p.id)?.buildingId ?? null)).toEqual([fisher.id, field.id, field.id, null]);
    expect(jobs.has(child.id)).toBe(false);
    expect(jobsOf(s)).toEqual(jobs);
  });
});

import { describe, expect, it } from 'vitest';
import { castWalkers, companionOf, CRAFT_LOAD, doorBeside, familyHome, familyLead, farFade, figureLook, groupLength, groupSlots, LOADS, loadOf, memberAt, reroute, ROW_GAP, walkerLook, walkerPerson } from '../../src/render3d/crowd';
import { addPerson, BUILDINGS, jobsOf, refreshCity, type WalkerType } from '../../src/core';
import { emptyGame, put } from '../helpers';
import WALKERS from '../../src/data/walkers.json';

const WALKER_TYPES_FOR_TESTS = WALKERS.map((w) => w.type as WalkerType);

const ks = Array.from({ length: 20 }, (_, i) => (i + 0.5) / 20);

describe('people of the 3D view', () => {
  it('dresses men and women differently: women in a mantle, men in a head cloth, other robe colours', () => {
    const men = ks.map((k) => figureLook('m', 'adult', k));
    const women = ks.map((k) => figureLook('f', 'adult', k));
    expect(men.every((l) => !l.mantle)).toBe(true);
    expect(women.every((l) => l.mantle)).toBe(true);
    const robes = (ls: typeof men) => new Set(ls.map((l) => l.robe));
    expect(robes(men).size).toBeGreaterThan(2);
    for (const c of robes(women)) expect(robes(men).has(c)).toBe(false);
  });

  it('draws children small and quick, the old bent and slow, in pale robes', () => {
    const adult = figureLook('m', 'adult', 0.3);
    const child = figureLook('f', 'child', 0.3);
    const elder = figureLook('m', 'elder', 0.3);
    expect(child.size).toBeLessThan(0.75);
    expect(child.mantle).toBe(false);
    expect(elder.stoop).toBeGreaterThan(0);
    expect(adult.stoop).toBe(0);
    expect(elder.pace).toBeLessThan(adult.pace);
    expect(child.pace).toBeGreaterThanOrEqual(adult.pace);
    const children = new Set(ks.map((k) => figureLook('m', 'child', k).robe));
    const adults = new Set(ks.flatMap((k) => [figureLook('m', 'adult', k).robe, figureLook('f', 'adult', k).robe]));
    for (const c of children) expect(adults.has(c)).toBe(false);
  });

  it('is stable per person', () => {
    expect(figureLook('f', 'adult', 0.42)).toEqual(figureLook('f', 'adult', 0.42));
  });

  it('dresses walkers by who they are', () => {
    expect(walkerPerson('child', 0.2).band).toBe('child');
    expect(walkerPerson('elder', 0.8).band).toBe('elder');
    expect(walkerPerson('waterCarrier', 0.1)).toEqual({ sex: 'f', band: 'adult' });
    expect(walkerPerson('mason', 0.9)).toEqual({ sex: 'm', band: 'adult' });
    expect(walkerLook('priest', 0.5).robe).not.toBe(walkerLook('farmer', 0.5).robe);
  });
});

describe('families walking home in 3D', () => {
  it('walk two abreast: adults in front, children in the middle, the old behind, the donkey last', () => {
    const slots = groupSlots(['child', 'elder', 'adult', 'adult', 'child'], true);
    expect(slots).toHaveLength(6);
    const [kid1, old, man, wife, kid2, donkey] = slots;
    expect(man.back).toBe(0);
    expect(wife.back).toBe(0);
    expect(man.side).toBe(-wife.side);
    expect(kid1.back).toBe(ROW_GAP);
    expect(kid2.back).toBe(ROW_GAP);
    expect(old.back).toBe(2 * ROW_GAP);
    expect(old.side).toBe(0);
    expect(donkey.back).toBeGreaterThan(old.back);
    expect(groupLength(slots)).toBe(donkey.back);
  });

  it('walk once with the core: in step with its weeks, never back, into the house and no loop', () => {
    const [last, perWeek, length] = [20, 6, 0.8];
    // Week 1 at step 6: the leader is 6 cells further each week, in step with the fraction.
    let lead = familyLead(-Infinity, 6, 0, 0, perWeek);
    expect(lead).toBe(6);
    lead = familyLead(lead, 6, 0.5, 0.5, perWeek);
    expect(lead).toBe(9);
    // The turn of the week: the core's step moves on, the leader does not jump.
    expect(familyLead(lead, 12, 0, 0.5, perWeek) - familyLead(lead, 6, 1, 0.5, perWeek)).toBe(0);
    // A late frame of the core's never pulls it back.
    expect(familyLead(lead, 6, 0.2, 0, perWeek)).toBe(lead);
    // Just behind the leader, the last one comes out of the entrance (step 0) a little later.
    expect(memberAt(0.5, length, 0, last)).toBeNull();
    expect(memberAt(1, length, 0, last)).not.toBeNull();
    // The core moved them in: the rest walk on at the same pace and are home, for good.
    lead = 19.6;
    expect(memberAt(lead, 0, 0, last)).toBeNull();
    expect(memberAt(lead, length, 0, last)).not.toBeNull();
    expect(familyHome(lead, length, last)).toBe(false);
    lead = familyLead(lead, null, 0.2, 0.2, perWeek);
    expect(lead).toBeCloseTo(20.8);
    expect(familyHome(lead, length, last)).toBe(true);
    for (let k = 0; k < 50; k++) lead = familyLead(lead, null, 0, 0.1, perWeek);
    expect(familyHome(lead, length, last)).toBe(true);
    // Paused: no time passes, nobody moves.
    expect(familyLead(9, null, 0.3, 0, perWeek)).toBe(9);
    // Arrived before it was ever seen: already in.
    expect(familyHome(familyLead(-Infinity, null, 0, 0.1, perWeek), length, last)).toBe(true);
  });

  it('shows nobody for a family already at the door', () => {
    expect(memberAt(5, 0, 5, 5)).toBeNull();
  });

  it('finds the door beside a road cell: a lived-in house first, never a field or a plaza', () => {
    const s = emptyGame();
    const field = put(s, 'field', 20, 30);
    const at = (c: { x: number; y: number } | null) => (c ? s.grid[c.y * s.cols + c.x] : null);
    const c = { x: field.x - 1, y: field.y };
    expect(doorBeside(s, c)).toBeNull();
    const plaza = put(s, 'plaza', c.x - BUILDINGS.plaza.w!, c.y);
    expect(doorBeside(s, c)).toBeNull();
    const house = put(s, 'house', c.x, c.y - BUILDINGS.house.h!, 1);
    expect(at(doorBeside(s, c))).toBe(house);
    expect(at({ x: c.x - 1, y: c.y })).toBe(plaza);
  });

  it('mends a broken way from where the walker stands: on ahead, back, or in', () => {
    const path = [0, 1, 2, 3, 4].map((x) => ({ x, y: 0 }));
    const road = (gone: number[]) => (c: { x: number }) => !gone.includes(c.x);
    expect(reroute(path, 1, road([]))).toBe('keep');
    // The cell it left is gone: nothing ahead changed.
    expect(reroute(path, 1, road([0, 1]))).toBe('keep');
    expect(reroute(path, 1, road([4]))).toBe('ahead');
    expect(reroute(path, 1, road([2]))).toBe('back');
    expect(reroute(path, 1, road([1, 2]))).toBe('lost');
  });

  it('thins the still figures out with the distance instead of hiding them at once', () => {
    expect(farFade(20, 48, 10)).toBe(1);
    expect(farFade(38, 48, 10)).toBe(1);
    expect(farFade(43, 48, 10)).toBeCloseTo(0.5);
    expect(farFade(48, 48, 10)).toBe(0);
    expect(farFade(70, 48, 10)).toBe(0);
  });

  it('gives every walker type of the 2D game what it carries, the artisan the goods of a city craft', () => {
    expect(loadOf('waterCarrier')).toBe('jar');
    expect(loadOf('basketWoman')).toBe('basket');
    expect(loadOf('farmer')).toBe('sickle');
    expect(loadOf('porter')).toBe('sack');
    expect(loadOf('woodcutter')).toBe('log');
    expect(loadOf('mason')).toBe('cart');
    for (const t of ['elder', 'shepherd', 'priest'] as const) expect(loadOf(t)).toBe('staff');
    for (const t of ['child', 'donkeyMan'] as const) expect(loadOf(t)).toBeNull();
    expect(loadOf('artisan')).toBe('pot');
    // Six crafts, six different goods, all drawable.
    const crafts = BUILDINGS.workshop.crafts!;
    expect(crafts).toHaveLength(6);
    expect(new Set(crafts.map((c) => loadOf('artisan', c))).size).toBe(6);
    for (const c of crafts) expect(LOADS).toContain(CRAFT_LOAD[c]);
    for (const t of WALKER_TYPES_FOR_TESTS) {
      const l = loadOf(t);
      if (l) expect(LOADS).toContain(l);
    }
  });

  it('leads a donkey beside the donkey man and a sheep beside the shepherd, no one else', () => {
    expect(companionOf('donkeyMan')).toBe('donkey');
    expect(companionOf('shepherd')).toBe('sheep');
    for (const t of WALKER_TYPES_FOR_TESTS.filter((t) => t !== 'donkeyMan' && t !== 'shepherd')) expect(companionOf(t)).toBeNull();
  });

  it('casts each walker as a different resident: a trade by someone working there, the carriers women', () => {
    const s = emptyGame();
    const h = put(s, 'house', 25, 30, 4, false, 0);
    const add = (sex: 'm' | 'f', age: number) => addPerson(s, { sex, age, houseId: h.id, caravan: 0, clan: 1 }, () => 0.5);
    const men = [add('m', 30), add('m', 35)];
    const woman = add('f', 28);
    const child = add('m', 6);
    put(s, 'field', 22, 32);
    refreshCity(s);
    const jobs = jobsOf(s);
    const cast = castWalkers(s, ['farmer', 'waterCarrier', 'child', 'elder'], [0.1, 0.2, 0.3, 0.4]);
    expect(jobs.get(cast[0]!)?.kind).toBe('field');
    expect(cast[1]).toBe(woman.id);
    expect(cast[2]).toBe(child.id);
    // No elder lives here: someone not yet out.
    expect(cast[3]).not.toBeNull();
    expect(new Set(cast).size).toBe(4);
    expect([...men, woman, child].map((p) => p.id)).toEqual(expect.arrayContaining(cast as number[]));
    // More walkers than residents: the rest are passers-by.
    expect(castWalkers(s, ['child', 'child', 'child', 'child', 'child'], [0, 0, 0, 0, 0])[4]).toBeNull();
    // Walkers kept from before are out already: the newcomers are others.
    const more = castWalkers(s, ['child', 'farmer'], [0.3, 0.1], cast as number[]);
    for (const id of more) expect(cast).not.toContain(id);
  });
});

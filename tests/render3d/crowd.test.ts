import { describe, expect, it } from 'vitest';
import { familyLead, figureLook, groupLength, groupSlots, memberAt, ROW_GAP, walkerLook, walkerPerson } from '../../src/render3d/crowd';

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

  it('walk the rest of the way into the house, rest, and walk it again', () => {
    const [from, last, speed, rest, length] = [3, 13, 1, 4, 0.8];
    // The whole group is on the way at the start.
    const lead0 = familyLead(from, last, 0, speed, rest, length);
    expect(memberAt(lead0, 0, from, last)).toBe(from + length);
    expect(memberAt(lead0, length, from, last)).toBe(from);
    // Halfway, everybody walks, further along.
    const lead = familyLead(from, last, 4, speed, rest, length);
    expect(memberAt(lead, 0, from, last)).toBeGreaterThan(lead0);
    // The leader goes in first; then all of them are home.
    expect(memberAt(familyLead(from, last, 9, speed, rest, length), 0, from, last)).toBeNull();
    expect(memberAt(familyLead(from, last, 9, speed, rest, length), length, from, last)).not.toBeNull();
    expect(memberAt(familyLead(from, last, 11, speed, rest, length), length, from, last)).toBeNull();
    // After the rest they start again.
    const cycle = (last - from) / speed + rest;
    expect(familyLead(from, last, cycle + 1, speed, rest, length)).toBeCloseTo(familyLead(from, last, 1, speed, rest, length));
  });

  it('shows nobody for a family already at the door', () => {
    expect(memberAt(familyLead(5, 5, 1, 1, 4, 0), 0, 5, 5)).toBeNull();
  });
});

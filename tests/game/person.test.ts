import { describe, expect, it } from 'vitest';
import { sheetOf } from '../../src/game/model/person';
import { T } from '../../src/render/strings';
import { emptyGame, person, put, ROADSIDE } from '../helpers';

describe('the person sheet as data', () => {
  it('a child: named after a parent, with the parents and their house', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 30, 1, false, 0);
    const dad = person(s, { houseId: b.id, sex: 'm', age: 30 });
    const mum = person(s, { houseId: b.id, sex: 'f', age: 28 });
    const kid = person(s, { houseId: b.id, sex: 'f', age: 4, fatherId: dad.id, motherId: mum.id });
    const v = sheetOf(s, kid);
    expect(v.title).toBe(T.nova.people.childOf(kid.name, 'f', dad.name));
    expect(v.house?.id).toBe(b.id);
    expect(v.rows[0]).toEqual({ label: T.nova.people.parents, kin: [{ id: dad.id, label: dad.name, dim: false }, { id: mum.id, label: mum.name, dim: false }] });
    expect(v.dim).toBe(false);
  });

  it('someone who died: dim, no work and no house, the age at death', () => {
    const s = emptyGame();
    const p = person(s, { houseId: null, sex: 'm', age: 70 });
    p.end = { week: s.week, cause: 'age' };
    const v = sheetOf(s, p);
    expect(v.dim).toBe(true);
    expect(v.job).toBeNull();
    expect(v.house).toBeNull();
    expect(v.age).toContain('70');
  });
});

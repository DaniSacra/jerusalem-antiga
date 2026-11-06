import { describe, expect, it } from 'vitest';
import { MAX_HOUSE_LEVEL, type GameEvent } from '../../src/core';
import { readEvents, type GameOut, type Tally } from '../../src/game/events';
import { T } from '../../src/game/strings';
import { emptyGame, person, put } from '../helpers';

const read = (events: GameEvent[], tally: Tally = { births: 0, weddings: 0 }) => readEvents(emptyGame(), events, tally);
const toasts = (out: GameOut[]) => out.filter((o) => o.do === 'toast').map((o) => (o as { msg: string; tone: string }).tone + ':' + (o as { msg: string }).msg);

describe('week events → what the views do', () => {
  it('cheers a house that rose and invites to 3D at the top level', () => {
    expect(read([{ type: 'houseUp', x: 3, y: 4, level: 2, delta: 2 }])).toEqual([{ do: 'cheer', x: 3, y: 4, gain: '+2' }]);
    expect(read([{ type: 'houseUp', x: 3, y: 4, level: MAX_HOUSE_LEVEL, delta: 2 }]).map((o) => o.do)).toEqual(['cheer', 'invite3D']);
  });

  it('turns warnings and news into toasts with their tone', () => {
    expect(toasts(read([{ type: 'famineStart' }, { type: 'coldEnd' }, { type: 'season', season: 'winter' }]))).toEqual([
      `bad:${T.famine}`,
      `good:${T.coldEnd}`,
      `info:${T.seasonStart.winter}`,
    ]);
  });

  it('a goal says its reward and what it unlocks, tells the tutorial about the market and invites to 3D', () => {
    const out = read([{ type: 'goal', index: 3, reward: 50, unlock: 'market' }]);
    const extra = T.unlocked.market ? ['toast'] : [];
    expect(out.map((o) => o.do)).toEqual(['toast', 'marketUnlocked', ...extra, 'unlocked', 'invite3D']);
  });

  it('debt slows the game once', () => {
    expect(read([{ type: 'debtStart' }]).map((o) => o.do)).toEqual(['toast', 'slowDown']);
  });

  it('counts births and weddings into the tally and gives them to the victory', () => {
    const s = emptyGame();
    const h = put(s, 'house', 22, 30, 1, false, 0);
    const a = person(s, { houseId: h.id, sex: 'm', age: 20 });
    const b = person(s, { houseId: h.id, sex: 'f', age: 20 });
    const tally = { births: 0, weddings: 0 };
    const out = readEvents(
      s,
      [
        { type: 'wedding', a: a.id, b: b.id, x: 22, y: 30 },
        { type: 'birth', id: a.id, x: 22, y: 30 },
        { type: 'victory', week: 300, residents: 200 },
      ],
      tally,
    );
    expect(tally).toEqual({ births: 1, weddings: 1 });
    expect(out.at(-1)).toEqual({ do: 'victory', week: 300, residents: 200, births: 1, weddings: 1 });
    expect(toasts(out)[0]).toBe(`good:${T.wedding(a.name, b.name)}`);
  });

  it('celebrates a milestone on the house that rose this week', () => {
    const s = emptyGame();
    const h = put(s, 'house', 22, 30, 2);
    const out = readEvents(s, [{ type: 'houseUp', x: 22, y: 30, level: 2, delta: 1 }, { type: 'milestone', id: 'firstMud' }], { births: 0, weddings: 0 });
    expect(out[1]).toEqual({ do: 'milestone', building: h, id: 'firstMud', note: true });
  });

  it('a family leaving walks out and is told; a cut tree falls', () => {
    const out = read([
      { type: 'familyLeft', x: 1, y: 2, reason: 'famine', name: 'Levi' },
      { type: 'treeCut', x: 5, y: 6, kind: 'olive' },
    ]);
    expect(out.map((o) => o.do)).toEqual(['leave', 'toast', 'fell']);
  });
});

describe('cold deaths on screen (plan B3)', () => {
  it('one toast a week: the first by name with the place, the others summed; the winter toll at the spring', () => {
    const s = emptyGame();
    const h = put(s, 'house', 22, 30, 1, false, 0);
    const [a, b, c] = [2, 0, 61].map((age) => person(s, { houseId: h.id, age }));
    for (const p of [a, b, c]) s.departed.push({ ...p, end: { week: s.week, cause: 'coldDeath' } });
    s.people = [];
    const ev = (id: number, age: number): GameEvent => ({ type: 'coldDeath', id, age, x: 22, y: 30 });
    const out = readEvents(s, [ev(a.id, 2), ev(b.id, 0), ev(c.id, 61)], { births: 0, weddings: 0 });
    expect(toasts(out)).toEqual([`bad:${T.coldDeath(a.name, 2, 2)}`]);
    expect(out.filter((o) => o.do === 'floatBad')).toHaveLength(3);
    expect(T.coldDeath('Ana', 2, 0)).toBe('O frio levou Ana, 2 anos');
    expect(T.coldDeath('Ana', 0, 1)).toBe('O frio levou Ana, bebê e mais 1 pessoa');
    expect(toasts(read([{ type: 'winterToll', n: 3 }]))).toEqual([`bad:${T.winterToll(3)}`]);
    expect(T.winterToll(1)).toBe('O inverno levou 1 pessoa');
  });
});

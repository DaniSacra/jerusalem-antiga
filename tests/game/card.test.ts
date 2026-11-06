import { describe, expect, it } from 'vitest';
import { BUILDINGS, indexOf, readCity, refreshCity } from '../../src/core';
import { cardOf, levelStatOf } from '../../src/game/model/card';
import { T } from '../../src/game/strings';
import { EAST, emptyGame, put, ROADSIDE } from '../helpers';

const N = T.nova.inspect;

describe('the card of a tapped cell (2D and 3D balloons)', () => {
  it('plain land has none; a stump, a rock and a tree say what they are, with no Demolir', () => {
    const s = emptyGame();
    expect(cardOf(s, { x: 1, y: 1 }, readCity(s), false)).toBeNull();
    s.feature[indexOf(s, 2, 2)] = 'rock';
    const rock = cardOf(s, { x: 2, y: 2 }, readCity(s), false)!;
    expect(rock.lines[0].text).toBe(N.rock(T.feature.rock));
    expect(rock.demolish).toBe(false);
    expect(rock.foot).toEqual({ x: 2, y: 2, w: 1, h: 1 });
  });

  it('a road off the network is red; one in it is not; both can be demolished', () => {
    const s = emptyGame();
    s.roads[indexOf(s, 3, 3)] = true;
    refreshCity(s);
    const loose = cardOf(s, { x: 3, y: 3 }, readCity(s), false)!;
    expect(loose.lines[0].tone).toBe('bad');
    expect(loose.demolish).toBe(true);
    const e = s.entrance;
    expect(cardOf(s, e, readCity(s), false)!.lines[0].tone).toBe('text');
  });

  it('the altar: its name big, what it does, no action and never Demolir', () => {
    const s = emptyGame();
    const a = s.buildings.find((b) => b.kind === 'altar')!;
    const c = cardOf(s, a, readCity(s), false)!;
    expect(c.lines[0]).toEqual({ text: BUILDINGS.altar.name, big: true });
    expect(c.lines[1].text).toBe(N.altar);
    expect(c.action).toBeNull();
    expect(c.demolish).toBe(false);
  });

  it('a building off the road asks for Rua as its main action', () => {
    const s = emptyGame();
    const b = put(s, 'fisher', 2, 2);
    refreshCity(s);
    const c = cardOf(s, b, readCity(s), false)!;
    expect(b.connected).toBe(false);
    expect(c.lines).toContainEqual({ text: `✗ ${N.disconnected}`, tone: 'bad' });
    expect(c.action).toMatchObject({ kind: 'road', label: N.where.road, target: b });
  });

  it('a service with levels offers Melhorar, grey when silver is short; on the phone its levels go aside', () => {
    const s = emptyGame();
    const b = put(s, 'granary', EAST, 30);
    refreshCity(s);
    expect(b.connected).toBe(true);
    expect(levelStatOf('granary')).toBe('storage');
    s.silver = 0;
    expect(cardOf(s, b, readCity(s), false)!.action).toMatchObject({ kind: 'upgrade', dim: true });
    s.silver = 1e6;
    s.wood = s.stone = 1e6;
    const pc = cardOf(s, b, readCity(s), false)!;
    expect(pc.action).toMatchObject({ kind: 'upgrade', dim: false });
    expect(pc.aside).toEqual([]);
    const phone = cardOf(s, b, readCity(s), true)!;
    expect(phone.aside.length).toBeGreaterThan(0);
    expect(phone.lines.length + phone.aside.length).toBe(pc.lines.length);
  });

  it('a house lists its people (two columns on the phone) and its level part (aside on the phone)', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 30, 1);
    refreshCity(s);
    const pc = cardOf(s, b, readCity(s), false)!;
    const people = pc.lines.find((l) => l.people)!;
    expect(people.people!.length).toBe(s.people.filter((p) => p.houseId === b.id).length);
    expect(people.cols).toBe(1);
    expect(pc.aside).toEqual([]);
    expect(pc.demolish).toBe(true);
    const phone = cardOf(s, b, readCity(s), true)!;
    expect(phone.lines.find((l) => l.people)!.cols).toBe(2);
    // The level heads its column in gold (after whether they can have children).
    expect(phone.aside.some((l) => l.tone === 'gold' && l.text === N.nextOnly('Casa de barro'))).toBe(true);
  });

  it('a house keeping its wood as firewood says so in red, not "falta madeira"', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 30, 1);
    b.firewoodHold = true;
    refreshCity(s);
    const texts = cardOf(s, b, readCity(s), false)!.lines.map((l) => l.text);
    const all = [...texts, ...cardOf(s, b, readCity(s), true)!.aside.map((l) => l.text)];
    expect(all).toContain(N.firewoodHold('Casa de barro'));
    expect(all.some((t) => t?.startsWith('Pronta para virar Casa de barro: falta'))).toBe(false);
  });

  it('an empty plot off the road waits for one and asks for Rua', () => {
    const s = emptyGame();
    const b = put(s, 'house', 2, 2);
    refreshCity(s);
    const c = cardOf(s, b, readCity(s), false)!;
    expect(c.lines[0]).toEqual({ text: N.plotWaiting, big: true });
    expect(c.lines[1]).toEqual({ text: N.plotNoRoad, tone: 'bad' });
    expect(c.action).toMatchObject({ kind: 'road' });
  });
});

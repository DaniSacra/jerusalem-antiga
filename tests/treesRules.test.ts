import { describe, expect, it } from 'vitest';
import { BUILDINGS, computeEconomy, cutTrees, indexOf, isSprouting, makerOf, materialMadeBy, regrowLeft, RULES, stepWeek, type GameEvent } from '../src/core';
import { constRng, EAST, emptyGame, put, ROADSIDE } from './helpers';

const constRngNever = constRng(0.99);

const EVERY = BUILDINGS.lumber.cutEvery!;

function city() {
  const s = emptyGame();
  put(s, 'house', ROADSIDE, 44, 1);
  put(s, 'house', ROADSIDE, 46, 1);
  s.feature.fill(null as never);
  return s;
}

describe('materials makers', () => {
  it('lumber makes wood and the quarry stone; other kinds make no material', () => {
    expect([materialMadeBy('lumber'), materialMadeBy('quarry'), materialMadeBy('fisher'), materialMadeBy('market')]).toEqual(['wood', 'stone', null, null]);
    expect([makerOf('wood'), makerOf('stone')]).toEqual(['lumber', 'quarry']);
  });
});

describe('stump readouts', () => {
  it('regrowLeft counts down to 1 and gives a full cycle for an unknown stump; isSprouting from half way', () => {
    const s = emptyGame();
    const i = indexOf(s, 5, 5);
    s.feature[i] = 'stump';
    s.stumps.push({ i, kind: 'olive', week: 10 });
    s.week = 10;
    expect(regrowLeft(s, i)).toBe(RULES.treeRegrowWeeks);
    expect(isSprouting(s, s.stumps[0])).toBe(false);
    s.week = 10 + RULES.treeRegrowWeeks / 2;
    expect(isSprouting(s, s.stumps[0])).toBe(true);
    s.week = 10 + RULES.treeRegrowWeeks + 5;
    expect(regrowLeft(s, i)).toBe(1);
    expect(regrowLeft(s, indexOf(s, 6, 6))).toBe(RULES.treeRegrowWeeks);
  });
});

describe('cutting order and backlog', () => {
  it('a lumber with no tree keeps at most one cut waiting', () => {
    const s = city();
    const b = put(s, 'lumber', EAST, 30);
    b.cutProgress = EVERY * 5;
    cutTrees(s, computeEconomy(s), []);
    expect(b.cutProgress).toBe(EVERY);
  });

  it('a tree that grows back this week is not felled the same week', () => {
    const s = city();
    const b = put(s, 'lumber', EAST, 30);
    const i = indexOf(s, 28, 30);
    s.feature[i] = 'stump';
    s.stumps.push({ i, kind: 'olive', week: s.week - RULES.treeRegrowWeeks });
    b.cutProgress = EVERY;
    s.food = 1000;
    const events: GameEvent[] = stepWeek(s, constRngNever);
    expect(events.some((e) => e.type === 'treeRegrown')).toBe(true);
    expect(events.some((e) => e.type === 'treeCut')).toBe(false);
    expect(s.feature[i]).toBe('olive');
  });
});

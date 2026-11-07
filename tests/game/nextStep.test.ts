import { describe, expect, it } from 'vitest';
import { GOALS, refreshCity, startStage, TEMPLE_STAGES, type GameState } from '../../src/core';
import { nextStep } from '../../src/game/model/nextStep';
import { T } from '../../src/game/strings';
import { EAST, emptyGame, hire, person, put, ROADSIDE } from '../helpers';

const N = T.nova.next;
/** The index of the first goal matching. */
const goalAt = (f: (g: (typeof GOALS)[number]) => boolean) => GOALS.findIndex(f);
const STAGE1 = goalAt((g) => g.type === 'templeStage' && g.stage === 1);
const altarOf = (s: GameState) => s.buildings.find((b) => b.kind === 'altar')!;
/** The tools a game opens with (`emptyGame` leaves out the food and lumber ones). */
const game = (o: Partial<GameState> = {}) => {
  const s = emptyGame(o);
  s.unlocked.push('fisher', 'gatherer', 'lumber');
  return s;
};
const rect = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x, y: b.y, w: b.w, h: b.h });

describe('nextStep: what to do now', () => {
  describe('1. a crisis first', () => {
    it('debt: the weeks left, Demolir, opens Avisos (before the stage that is the goal)', () => {
      const s = game({ goalIndex: STAGE1 });
      s.silver = -5;
      const n = nextStep(s);
      expect(n).toMatchObject({ kind: 'crisis', tone: 'bad', aim: { tool: 'clear' }, open: { panel: 'alerts' } });
      expect(n.text).toMatch(/^Dívida: \d+ semanas? para perder/);
    });

    it('food that will not last: when it runs out, and the fisher', () => {
      const s = game({ goalIndex: STAGE1 });
      put(s, 'house', ROADSIDE, 27, 4);
      s.food = 10;
      refreshCity(s);
      const n = nextStep(s);
      expect(n).toMatchObject({ kind: 'crisis', icon: 'food', aim: { tool: 'fisher' } });
      expect(n.text.startsWith('Comida acaba em') || n.text === N.famine).toBe(true);
    });

    it('starving now says so', () => {
      const s = game();
      s.famine = true;
      expect(nextStep(s)).toMatchObject({ kind: 'crisis', text: N.famine });
    });

    it('cold without firewood: the lumber camp', () => {
      const s = game();
      s.cold = true;
      expect(nextStep(s)).toMatchObject({ kind: 'crisis', text: N.cold, icon: 'wood', aim: { tool: 'lumber' } });
    });
  });

  describe('2. the Temple stage that is the goal', () => {
    it('can start: tap the altar (opens its balloon, the arrow on it)', () => {
      const s = game({ goalIndex: STAGE1 });
      const a = rect(altarOf(s));
      expect(nextStep(s)).toEqual({ kind: 'stage', text: N.start(TEMPLE_STAGES[0].name, 'altar'), tone: 'gold', icon: 'stage', aim: { rect: a }, open: { building: a } });
    });

    it('short of a material: how much, and the quarry on the map (else its tool)', () => {
      const s = game({ goalIndex: STAGE1 });
      s.stone = 5;
      const st = TEMPLE_STAGES[0];
      const need = st.materials.stone!;
      expect(nextStep(s)).toMatchObject({ kind: 'stage', text: N.gather(st.name, 'stone', 5, need), aim: null });
      s.unlocked.push('quarry');
      expect(nextStep(s).aim).toEqual({ tool: 'quarry' });
      const q = put(s, 'quarry', EAST, 28);
      expect(nextStep(s).aim).toEqual({ rect: rect(q) });
    });

    it('short of silver only: the silver it costs', () => {
      const s = game({ goalIndex: STAGE1 });
      s.silver = 10;
      expect(nextStep(s).text).toBe(N.gather(TEMPLE_STAGES[0].name, 'silver', 10, TEMPLE_STAGES[0].cost));
    });

    it('under way without all its builders: how many, opens Profissões; full: how far and when', () => {
      const s = game({ goalIndex: STAGE1 });
      expect(startStage(s).ok).toBe(true);
      const st = TEMPLE_STAGES[0];
      expect(nextStep(s)).toMatchObject({ text: N.builders(st.name, 0, st.builders), tone: 'bad', open: { panel: 'jobs' } });
      hire(s, altarOf(s), st.builders);
      const n = nextStep(s);
      expect(n).toMatchObject({ kind: 'stage', tone: 'good', aim: { rect: rect(altarOf(s)) } });
      expect(n.text).toBe(N.going(st.name, 0, st.work, Math.ceil(st.work / st.builders)));
    });

    it('the Temple off the road: Rua', () => {
      const s = game({ goalIndex: goalAt((g) => g.type === 'templeStage' && g.stage === 2) });
      s.temple.done = 1;
      const t = put(s, 'temple', ROADSIDE - 4, 28);
      t.connected = false;
      expect(nextStep(s)).toMatchObject({ kind: 'stage', text: N.road(TEMPLE_STAGES[1].name, 'temple'), aim: { tool: 'road' } });
    });
  });

  describe('3. the current goal: its first missing thing', () => {
    it('build: the goal itself and its tool; off the road, Rua', () => {
      const i = goalAt((g) => g.type === 'build');
      const s = game({ goalIndex: i });
      expect(nextStep(s)).toMatchObject({ kind: 'goal', text: GOALS[i].text, aim: { tool: GOALS[i].kind }, open: { panel: 'goals' } });
      const w = put(s, 'workshop', 2, 2);
      expect(w.connected).toBe(false);
      expect(nextStep(s)).toMatchObject({ text: N.offRoad('workshop'), aim: { tool: 'road' } });
    });

    it('stone houses: the plaza the mud houses lack (or the goal that unlocks it)', () => {
      const s = game({ goalIndex: goalAt((g) => g.type === 'houses' && g.level === 3) });
      s.food = 1e4;
      put(s, 'house', ROADSIDE, 27, 2, false, 2);
      expect(nextStep(s)).toMatchObject({ text: N.service('plaza', 2), aim: { tool: 'plaza' } });
      s.unlocked = s.unlocked.filter((k) => k !== 'plaza');
      expect(nextStep(s)).toMatchObject({ text: N.locked('plaza', GOALS.findIndex((g) => g.unlock === 'plaza') + 1), aim: null });
    });

    it('a house off the road: Rua', () => {
      const s = game({ goalIndex: goalAt((g) => g.type === 'houses' && g.level === 2) });
      s.food = 1e4;
      put(s, 'house', 2, 2, 1, false, 2);
      expect(nextStep(s)).toMatchObject({ text: N.houseRoad, aim: { tool: 'road' } });
    });

    it('stone houses waiting for stone: how much is short, and the quarry', () => {
      const s = game({ goalIndex: goalAt((g) => g.type === 'houses' && g.level === 3) });
      s.food = 1e4;
      s.unlocked.push('quarry');
      put(s, 'plaza', EAST, 27);
      const h = put(s, 'house', ROADSIDE, 27, 2, false, 2);
      h.waiting = 'stone';
      s.stone = 2;
      expect(nextStep(s)).toMatchObject({ text: N.material(8, 'stone'), aim: { tool: 'quarry' } });
    });

    it('mud houses: more houses, then when they climb', () => {
      const s = game({ goalIndex: goalAt((g) => g.type === 'houses' && g.level === 2) });
      s.food = 1e4;
      put(s, 'house', ROADSIDE, 27, 1, false, 2);
      expect(nextStep(s)).toMatchObject({ text: N.moreHouses(0, GOALS[s.goalIndex].target), aim: { tool: 'house' } });
      for (let k = 1; k < 5; k++) put(s, 'house', ROADSIDE, 27 + 2 * k, 1, false, 2);
      const n = nextStep(s);
      expect(n.text).toMatch(/^As casas sobem em ~/);
      expect(n.tone).toBe('good');
    });

    it('residents: couples waiting for a house', () => {
      const s = game({ goalIndex: goalAt((g) => g.type === 'residents') });
      s.food = 1e4;
      const h = put(s, 'house', ROADSIDE, 27, 2, false, 2);
      const m = person(s, { houseId: h.id, sex: 'm', age: 20 });
      const f = person(s, { houseId: h.id, sex: 'f', age: 19 });
      m.spouseId = f.id;
      f.spouseId = m.id;
      m.engaged = f.engaged = s.week;
      refreshCity(s);
      expect(nextStep(s)).toMatchObject({ text: N.couples, aim: { tool: 'house' } });
    });

    it('the first caravan: the empty houses it lacks and when it comes', () => {
      const s = game({ goalIndex: goalAt((g) => g.milestone === 'firstCaravan') });
      expect(nextStep(s).text).toBe(N.caravanSoon);
      s.caravans = [{ week: s.week + 5, families: 2, warn: 6, status: 'announced', housed: 0, left: 0 }];
      expect(nextStep(s)).toMatchObject({ text: N.caravan(2, 5), aim: { tool: 'house' } });
    });

    it('a goal that comes with time: what to do meanwhile', () => {
      const s = game({ goalIndex: goalAt((g) => g.milestone === 'firstGrownUp') });
      expect(nextStep(s)).toMatchObject({ kind: 'goal', text: N.grow, tone: 'good' });
    });

    it('food until the spring: its weeks and the fisher', () => {
      const i = goalAt((g) => g.type === 'foodUntilSpring');
      const s = game({ goalIndex: i });
      expect(nextStep(s)).toMatchObject({ kind: 'goal', aim: { tool: 'fisher' } });
      expect(nextStep(s).text).toMatch(/^Comida até a primavera: /);
    });
  });

  it('4. every goal done and no crisis: Tudo em ordem', () => {
    const s = game({ goalIndex: GOALS.length });
    expect(nextStep(s)).toMatchObject({ kind: 'calm', text: N.calm });
  });
});

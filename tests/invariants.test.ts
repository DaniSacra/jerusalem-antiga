import { describe, expect, it } from 'vitest';
import { createGame, createRng, stepWeek, type GameState } from '../src/core';
import { PROFILES, SurvivalBot } from '../tools/sim/survival';

/** Every rule the people and the houses must keep, whatever happens in the game. */
function checkInvariants(s: GameState, where: string) {
  const houses = new Map(s.buildings.filter((b) => b.kind === 'house').map((b) => [b.id, b]));
  const walking = new Set(s.families.flatMap((f) => f.members));
  const living = new Map<number, number>();
  for (const p of s.people) {
    if (p.houseId === null) {
      // Without a house only while walking with a family (to a house or with the caravan).
      expect(walking.has(p.id), `${where}: person ${p.id} has no house and is not walking`).toBe(true);
      continue;
    }
    const h = houses.get(p.houseId);
    expect(h, `${where}: person ${p.id} lives in a house that does not exist`).toBeDefined();
    expect(h!.level, `${where}: person ${p.id} lives in a level-0 house`).toBeGreaterThanOrEqual(1);
    living.set(h!.id, (living.get(h!.id) ?? 0) + 1);
  }
  for (const h of houses.values()) {
    // A house has a level of 1 or more exactly when people live in it.
    expect(h.level >= 1, `${where}: house ${h.id} level ${h.level} with ${living.get(h.id) ?? 0} people`).toBe(living.has(h.id));
  }
  const ids = [...s.people, ...s.departed].map((p) => p.id);
  expect(new Set(ids).size, `${where}: repeated person ids`).toBe(ids.length);
  for (const p of s.people) {
    if (p.spouseId === null) continue;
    const spouse = s.people.find((o) => o.id === p.spouseId) ?? s.departed.find((o) => o.id === p.spouseId);
    expect(spouse, `${where}: spouse of ${p.id} unknown`).toBeDefined();
  }
}

describe('invariants of people and houses over whole games', () => {
  for (const bot of ['eficiente', 'comum', 'distraido']) {
    it(`hold every week for the ${bot} bot (3 seeds, 300 weeks), and the state survives JSON`, () => {
      for (const seed of [1, 2, 3]) {
        const rng = createRng(seed);
        const s = createGame(rng);
        const player = new SurvivalBot(PROFILES[bot], createRng(seed * 31 + 7));
        for (let w = 0; w < 300 && !s.lost && !s.won; w++) {
          player.act(s);
          stepWeek(s, rng);
          checkInvariants(s, `${bot} seed ${seed} week ${s.week}`);
        }
        expect(JSON.parse(JSON.stringify(s))).toEqual(s);
      }
    });
  }
});

import { describe, expect, it } from 'vitest';
import { GOALS, indexOf, refreshCity, startStage, TEMPLE_STAGES, type GameState } from '../../src/core';
import { stageNeeds, stagePlan, stageStatus } from '../../src/game/model/temple';
import { T } from '../../src/game/strings';
import { EAST, emptyGame, hire, put, ROAD_X } from '../helpers';

const N = T.nova.stage;
const goalOf = (stage: number) => GOALS.findIndex((g) => g.type === 'templeStage' && g.stage === stage);

/** A city whose current goal is `stage`; from stage 2 on the Temple is marked unless `mark` is false. */
function atStage(stage: number, o: Partial<GameState> = {}, mark = true) {
  const s = emptyGame({ goalIndex: goalOf(stage), ...o });
  s.temple = { done: stage - 1, active: false, progress: 0 };
  if (stage >= 2 && mark) put(s, 'temple', EAST, 30);
  return s;
}

describe('stageStatus', () => {
  it('null when the current goal is not a stage, or every stage is built', () => {
    expect(stageStatus(atStage(2, { goalIndex: goalOf(2) - 1 }))).toBeNull();
    const s = atStage(5);
    s.temple.done = TEMPLE_STAGES.length;
    expect(stageStatus(s)).toBeNull();
  });

  it('stagePlan: null off a stage goal; ready and debt as the core says', () => {
    expect(stagePlan(atStage(2, { goalIndex: goalOf(2) - 1 }))).toBeNull();
    expect(stagePlan(atStage(1))).toMatchObject({ at: 'ready', number: 1, site: { kind: 'altar' } });
    expect(stagePlan(atStage(2, { silver: -1 }))).toMatchObject({ at: 'debt' });
    expect(stageNeeds(atStage(2), TEMPLE_STAGES[1])).toEqual([]);
  });

  it('says where to tap once it can be paid (altar for stage 1, Temple after)', () => {
    expect(stageStatus(atStage(1))).toEqual({ text: N.start(TEMPLE_STAGES[0].name, 'altar'), tone: 'good' });
    expect(stageStatus(atStage(2))).toEqual({ text: N.start(TEMPLE_STAGES[1].name, 'temple'), tone: 'good' });
  });

  it('lists what is missing, rounded up, materials first and silver last', () => {
    const st = TEMPLE_STAGES[2];
    const s = atStage(3, { silver: st.cost - 30.5, stone: (st.materials.stone ?? 0) - 50, wood: (st.materials.wood ?? 0) - 0.2 });
    expect(stageNeeds(s, st)).toEqual([[1, 'wood'], [50, 'stone'], [31, 'silver']]);
    expect(stagePlan(s)).toMatchObject({ at: 'lack', number: 3, stage: st });
    s.wood = 1e5;
    expect(stageStatus(s)).toEqual({ text: N.lacking(st.name, N.need([[50, 'stone'], [31, 'silver']])), tone: 'gold' });
    s.silver = 1e5;
    expect(stageStatus(s)!.text).toBe(N.lacking(st.name, N.need([[50, 'stone']])));
  });

  it('warns in debt and off the road', () => {
    const st = TEMPLE_STAGES[1];
    expect(stageStatus(atStage(2, { silver: -5 }))).toEqual({ text: N.debt(st.name), tone: 'warn' });
    const s = atStage(2);
    for (let y = 29; y <= 36; y++) s.roads[indexOf(s, ROAD_X, y)] = false;
    refreshCity(s);
    expect(stageStatus(s)).toEqual({ text: N.noRoad('temple'), tone: 'warn' });
  });

  it('under way: progress and weeks left with builders, "no builders" without', () => {
    const st = TEMPLE_STAGES[1];
    const s = atStage(2);
    startStage(s);
    expect(stageStatus(s)).toEqual({ text: `${N.building(st.name, 0, st.work)} · ${N.idle}`, tone: 'warn' });
    hire(s, s.buildings.find((b) => b.kind === 'temple')!, 4);
    s.temple.progress = 18.5;
    expect(stagePlan(s)).toMatchObject({ at: 'work', number: 2, builders: 4, progress: 18, weeksLeft: Math.ceil((st.work - 18.5) / 4) });
    expect(stageStatus(s)).toEqual({ text: `${N.building(st.name, 18, st.work)} · ${N.weeks(Math.ceil((st.work - 18.5) / 4))}`, tone: 'good' });
  });
});

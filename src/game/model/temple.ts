import {
  buildersAtWork,
  checkStartStage,
  MATERIALS,
  nextStage,
  stageIsGoal,
  stageSite,
  stageWeeksLeft,
  type Building,
  type GameState,
  type Material,
  type TempleStageDef,
} from '../../core';
import { T } from '../strings';

/** What a stage is still short of: [amount, silver or a material]. */
export type StageNeed = [number, 'silver' | Material];

/**
 * Where the Temple's stage that is the current goal stands (pure, reads the core): its place to mark,
 * what it is short of, its road, the debt, ready to start, or under way with its builders.
 */
export type StagePlan = { stage: TempleStageDef; number: number; site: Building | undefined } & (
  | { at: 'mark' }
  | { at: 'road' }
  | { at: 'debt' }
  | { at: 'lack'; need: StageNeed[] }
  | { at: 'ready' }
  | { at: 'work'; builders: number; progress: number; weeksLeft: number | null }
);

/** The stage that is the current goal and where it stands (null when the goal is not a stage). */
export function stagePlan(s: GameState): StagePlan | null {
  const stage = nextStage(s);
  if (!stage || !stageIsGoal(s)) return null;
  const base = { stage, number: s.temple.done + 1, site: stageSite(s, stage) };
  if (s.temple.active) return { ...base, at: 'work', builders: buildersAtWork(s), progress: Math.floor(s.temple.progress), weeksLeft: stageWeeksLeft(s) };
  if (!base.site) return { ...base, at: 'mark' };
  const r = checkStartStage(s);
  if (r.ok) return { ...base, at: 'ready' };
  if (r.reason === 'noRoad') return { ...base, at: 'road' };
  if (r.reason === 'debt') return { ...base, at: 'debt' };
  return { ...base, at: 'lack', need: stageNeeds(s, stage) };
}

/** What a stage is still short of: its materials first (they take longest), then silver. */
export function stageNeeds(s: GameState, st: TempleStageDef): StageNeed[] {
  const need: StageNeed[] = [];
  for (const m of MATERIALS) if (s[m] < (st.materials[m] ?? 0)) need.push([Math.ceil((st.materials[m] ?? 0) - s[m]), m]);
  if (s.silver < st.cost) need.push([Math.ceil(st.cost - s.silver), 'silver']);
  return need;
}

/** The Temple's stage while it is the goal: what to do now, and whether it is going well. */
export interface StageStatus {
  text: string;
  tone: 'gold' | 'good' | 'warn';
}

/**
 * The goal pill's and the goals list's line for the stage that is the goal (null otherwise): mark the
 * place, gather what it costs ("junte 30 prata, 50 pedra"), start it by tapping its site, or how far
 * it has come ("Alicerce 18/40 · ~6 sem"; "sem construtores" when nobody works there).
 */
export function stageStatus(s: GameState): StageStatus | null {
  const p = stagePlan(s);
  if (!p) return null;
  const N = T.nova.stage;
  const name = p.stage.name;
  switch (p.at) {
    case 'work':
      return { text: `${N.building(name, p.progress, p.stage.work)} · ${p.weeksLeft === null ? N.idle : N.weeks(p.weeksLeft)}`, tone: p.weeksLeft === null ? 'warn' : 'good' };
    case 'mark':
      return { text: N.mark, tone: 'gold' };
    case 'ready':
      return { text: N.start(name, p.stage.site), tone: 'good' };
    case 'road':
      return { text: N.noRoad(p.stage.site), tone: 'warn' };
    case 'debt':
      return { text: N.debt(name), tone: 'warn' };
    case 'lack':
      return { text: N.lacking(name, N.need(p.need)), tone: 'gold' };
  }
}

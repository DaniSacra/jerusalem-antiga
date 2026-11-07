import { TEMPLE_STAGES } from './data';
import { currentGoal } from './goals';
import { lackingMaterial } from './materials';
import type { ActionResult, Building, GameState, TempleStageDef } from './types';

/**
 * The Temple in stages (plan "Desafio" 2): five stages in `temple.json`, each a goal. The current
 * one is paid when the player starts it (`startStage` in actions.ts); while it is under way its
 * site (the altar for stage 1, the Temple for the rest) offers `builders` jobs, and each builder
 * at work adds 1 to its `progress` a week, all year round. At `work` it is built (`advanceTemple`).
 * Only the finished Temple (the last stage) covers and lifts houses; the stages change no other rule.
 */

/** The stage to build next (stage 1 = index 0), or undefined once the Temple is consecrated. */
export const nextStage = (s: GameState): TempleStageDef | undefined => TEMPLE_STAGES[s.temple.done];

/** The Temple is consecrated: its coverage and happiness count. */
export const templeDone = (s: GameState) => s.temple.done >= TEMPLE_STAGES.length;

/** The altar's sacred radius now: the last stage built's, while it had its offering; 0 in ruins or without. */
export const altarRadius = (s: GameState): number => (s.offered ? (TEMPLE_STAGES[s.temple.done - 1]?.sacredRadius ?? 0) : 0);

/** The altar, or the Temple once its place is marked: where a stage is built. */
export const stageSite = (s: GameState, stage: TempleStageDef | undefined = nextStage(s)): Building | undefined =>
  stage && s.buildings.find((b) => b.kind === stage.site);

/** The foundation began: the marked Temple can no longer be demolished. */
export const templeLaid = (s: GameState) => s.temple.done >= 2 || (s.temple.done === 1 && s.temple.active);

/** The current goal is the next stage of the Temple (only then can it begin). */
export function stageIsGoal(s: GameState): boolean {
  const g = currentGoal(s);
  return g?.type === 'templeStage' && g.stage === s.temple.done + 1;
}

/** Why the next stage cannot begin now (OK when it can): not its goal yet, under way, no site, debt, silver, materials. */
export function checkStartStage(s: GameState): ActionResult {
  const st = nextStage(s);
  const site = stageSite(s, st);
  if (!st || s.temple.active || !stageIsGoal(s)) return { ok: false, reason: 'locked' };
  if (!site) return { ok: false, reason: 'locked' };
  if (!site.connected) return { ok: false, reason: 'noRoad' };
  if (s.silver < 0) return { ok: false, reason: 'debt' };
  if (s.silver < st.cost) return { ok: false, reason: 'silver' };
  return lackingMaterial(s, st.materials) ? { ok: false, reason: 'materials' } : { ok: true };
}

/** Builders working at the stage under way now. */
export const buildersAtWork = (s: GameState): number => {
  const site = s.temple.active ? stageSite(s) : undefined;
  return site ? s.people.filter((p) => p.jobId === site.id).length : 0;
};

/** Weeks the stage under way still needs at today's builders (null with nobody at work). */
export function stageWeeksLeft(s: GameState): number | null {
  const st = nextStage(s);
  const n = buildersAtWork(s);
  return st && s.temple.active && n > 0 ? Math.ceil((st.work - s.temple.progress) / n) : null;
}

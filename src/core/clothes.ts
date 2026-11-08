import { RULES } from './data';
import { round2, type Economy } from './economy';
import { comingWinterGrowth, difficultyOf } from './difficulty';
import { winterWeeksLeft, weeksToSpring } from './firewood';
import { seasonOf } from './seasons';
import type { GameEvent, GameState } from './types';

/**
 * Clothes against the cold (plano-dificuldade E): the tannery turns livestock into clothes
 * (`Economy.clothes`). From the first autumn after the tannery is unlocked (`s.dressing`), every
 * resident wears out `clothes.perPerson` each winter week. When the store does not pay it, the city
 * wears what it has, the store goes to 0 and it is ragged (`s.ragged`): the cold reaches children
 * and elders even with firewood (cold.ts).
 */

const C = RULES.clothes;

/** Clothes the residents wear out in a winter week (this winter's, or the coming one's: difficulty.ts). */
export const clothesPerWeek = (s: GameState, residents: number) =>
  round2(residents * C.perPerson * difficultyOf(s).clothes * (1 + comingWinterGrowth(s, s.week)));

/** Wears the week's clothes (winter only, once the city dresses) and updates `s.ragged`, with its event. */
export function wearClothes(s: GameState, residents: number, events: GameEvent[]): void {
  const was = s.ragged;
  const wear = s.dressing && seasonOf(s.week) === 'winter' ? clothesPerWeek(s, residents) : 0;
  s.ragged = wear > s.clothes;
  s.clothes = round2(Math.max(0, s.clothes - wear));
  if (s.ragged && !was) events.push({ type: 'raggedStart' });
}

/**
 * In autumn and winter, once the city dresses: the clothes missing to dress everyone until the spring
 * (store plus the tanneries' making until then against the winter weeks left), rounded up; else 0.
 * A forecast: it takes this week's making as steady (the pens may run down meanwhile).
 */
export function clothesShort(s: GameState, eco: Pick<Economy, 'clothes' | 'residents'>): number {
  if (!s.dressing) return 0;
  const need = clothesPerWeek(s, eco.residents) * winterWeeksLeft(s.week);
  if (need <= 0) return 0;
  const have = s.clothes + eco.clothes * weeksToSpring(s.week);
  return have >= need ? 0 : Math.ceil(round2(need - have));
}

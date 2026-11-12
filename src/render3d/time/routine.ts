import LOOK from '../look3d.json';
import { clamp01, lerp } from './color';
import { sunArc } from './day';

const R = LOOK.routine;

/** A bump 0..1 around `at` (sun arc), 1 there and 0 at `width` from it (smooth). */
function bump(arc: number, at: number, width: number): number {
  const d = clamp01(Math.abs(arc - at) / width);
  return 0.5 + 0.5 * Math.cos(Math.PI * d);
}

/** How the people of the town spend an hour of the day (0..1 factors on top of the night and rain shares). */
export interface Routine {
  /** Walkers on the roads: the most going to work in the morning, to the market at noon and home in the afternoon. */
  walkers: number;
  /** Buyers at the markets: full at noon, few in the early morning and the evening. */
  market: number;
  /** Children playing by the doors: all day, gone in before the dark. */
  play: number;
  /** Neighbours talking at the doors: some by day, the most at the end of the afternoon. */
  talk: number;
  /** Hands at work (fields, workplaces): from a while after sunrise to near sunset. */
  work: number;
}

/**
 * A day in the city (D1, plano-backlog): from the time of day `t` (0..1, as in day.ts) the share of
 * each kind of street life. Look only: the core does not know the hour. Night itself is in
 * `streetShare` (time/light.ts); these factors shape the day between sunrise and sunset.
 */
export function routine(t: number): Routine {
  const arc = sunArc(t);
  const day = arc >= 0 && arc <= 1;
  const noon = bump(arc, R.marketAt, R.marketWidth);
  const rush = Math.max(bump(arc, R.toWork, R.rush), bump(arc, R.home, R.rush), R.noonWalk * noon);
  return {
    walkers: lerp(R.calm, 1, rush),
    market: lerp(R.marketLow, 1, noon),
    play: day ? 1 - clamp01((arc - R.childrenIn) / (1 - R.childrenIn)) : 0,
    talk: lerp(R.talkLow, 1, bump(arc, R.talkAt, R.talkWidth)),
    work: day ? clamp01(Math.min(arc - R.workFrom, R.workTo - arc) / R.workEdge) : 0,
  };
}

/** The routine factor of a still-life act (street.ts acts; the others stand as the street share says). */
export function actShare(r: Routine, act: string): number {
  return act === 'buy' ? r.market : act === 'play' ? r.play : act === 'talk' ? r.talk : act === 'hammer' || act === 'chop' ? r.work : 1;
}

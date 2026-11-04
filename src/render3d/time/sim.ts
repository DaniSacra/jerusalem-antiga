import { advanceClock, RULES, stepWeek, WEEKS_PER_YEAR, type GameEvent, type GameState, type Rng } from '../../core';
import { seasonAt } from './season';

/** Speeds of the proof's controls: pause, 1x, 2x and 4x the game's week. */
export const SPEEDS = [0, 1, 2, 4] as const;
export type Speed3D = (typeof SPEEDS)[number];

/** Real seconds the demonstration takes for one whole year. */
export const DEMO_YEAR_SECONDS = 60;
/** Speed that runs a year in DEMO_YEAR_SECONDS. */
export const DEMO_SPEED = (WEEKS_PER_YEAR * RULES.weekSeconds) / DEMO_YEAR_SECONDS;

/** Someone who plays the city while it runs (the sim-tester bot), or nobody. */
export interface Player {
  act(s: GameState): void;
}

/**
 * Runs the real simulation for the 3D view: the core's own clock (advanceClock) and stepWeek, at
 * the chosen speed, with an optional player acting before each week like the sim-tester does.
 * The demonstration runs one year at DEMO_SPEED and then goes back to 1x.
 */
export class SimDriver {
  speed: Speed3D = 1;
  /** Week fraction of the current week (seconds of game time, as the 2D game keeps it). */
  acc = 0;
  /** Week the demonstration ends (null: not running). */
  demoUntil: number | null = null;

  constructor(readonly state: GameState, private rng: Rng, private player: Player | null) {}

  get demo() {
    return this.demoUntil !== null;
  }

  /** Current speed multiplier. */
  get rate(): number {
    return this.demo ? DEMO_SPEED : this.speed;
  }

  /** Game position in weeks, continuous (week + fraction). */
  get pos(): number {
    return this.state.week + this.acc / RULES.weekSeconds;
  }

  /** Real seconds one game week lasts at the current speed (Infinity when paused). */
  get secondsPerDay(): number {
    return this.rate > 0 ? RULES.weekSeconds / this.rate : Infinity;
  }

  startDemo() {
    this.demoUntil = this.state.week + WEEKS_PER_YEAR;
  }

  stopDemo() {
    this.demoUntil = null;
    if (this.speed === 0) this.speed = 1;
  }

  /** Advances real time `dt` seconds; returns the events of the weeks simulated. */
  update(dt: number): GameEvent[] {
    if (this.state.lost) return [];
    const { acc, steps } = advanceClock(this.acc, dt, this.rate);
    this.acc = acc;
    const events: GameEvent[] = [];
    for (let k = 0; k < steps; k++) {
      this.player?.act(this.state);
      events.push(...stepWeek(this.state, this.rng));
    }
    if (this.demoUntil !== null && this.state.week >= this.demoUntil) this.stopDemo();
    return events;
  }
}

/**
 * Look overrides of the demonstration year, so every look shows once: a snowy winter (else 1 in 5)
 * and a dry spring and summer (else 1 in 4 from the third year). The dry look stays on through the
 * first weeks of autumn, while it fades, and is off in winter (a dry winter never snows). Looks
 * only: the core's own drought is untouched.
 */
export function demoForce(pos: number): { snow: boolean; drought: boolean } {
  const { season, at } = seasonAt(pos);
  const dry = season === 'spring' || season === 'summer' || (season === 'autumn' && at < 5);
  return { snow: true, drought: dry };
}

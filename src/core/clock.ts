import { RULES } from './data';

/**
 * Accumulates real time scaled by speed and returns how many weeks to simulate.
 * Caps the steps per call so a long frame cannot trigger a burst of weeks.
 */
export function advanceClock(acc: number, dtSeconds: number, speed: number, weekSeconds = RULES.weekSeconds, maxSteps = 5) {
  acc += dtSeconds * speed;
  let steps = 0;
  while (acc >= weekSeconds && steps < maxSteps) {
    acc -= weekSeconds;
    steps++;
  }
  if (steps === maxSteps) acc = Math.min(acc, weekSeconds);
  return { acc, steps };
}

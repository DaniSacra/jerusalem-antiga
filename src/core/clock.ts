import { RULES } from './data';

/**
 * Accumulates real time scaled by speed and returns how many months to simulate.
 * Caps the steps per call so a long frame cannot trigger a burst of months.
 */
export function advanceClock(acc: number, dtSeconds: number, speed: number, monthSeconds = RULES.monthSeconds, maxSteps = 5) {
  acc += dtSeconds * speed;
  let steps = 0;
  while (acc >= monthSeconds && steps < maxSteps) {
    acc -= monthSeconds;
    steps++;
  }
  if (steps === maxSteps) acc = Math.min(acc, monthSeconds);
  return { acc, steps };
}

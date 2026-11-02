import { describe, expect, it } from 'vitest';
import { advanceClock } from '../src/core';

describe('clock', () => {
  it('advances one month every 1.2s at 1x', () => {
    let r = advanceClock(0, 1.0, 1);
    expect(r.steps).toBe(0);
    r = advanceClock(r.acc, 0.3, 1);
    expect(r.steps).toBe(1);
    expect(r.acc).toBeCloseTo(0.1);
  });

  it('runs 3x faster and stops when paused', () => {
    expect(advanceClock(0, 1.25, 3).steps).toBe(3);
    expect(advanceClock(0, 10, 0)).toEqual({ acc: 0, steps: 0 });
  });

  it('caps steps per call', () => {
    expect(advanceClock(0, 100, 3).steps).toBe(5);
  });
});

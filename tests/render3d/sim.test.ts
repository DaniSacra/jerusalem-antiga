import { describe, expect, it } from 'vitest';
import { createGame, createRng, RULES, WEEKS_PER_YEAR } from '../../src/core';
import { DEMO_SPEED, DEMO_YEAR_SECONDS, demoForce, SimDriver } from '../../src/render3d/time/sim';

const M = RULES.weeksPerSeason;

describe('the simulation in the 3D proof', () => {
  it('runs the real weeks at the chosen speed and stops when paused', () => {
    const rng = createRng(3);
    const d = new SimDriver(createGame(rng), rng, null);
    d.speed = 2;
    for (let k = 0; k < 64; k++) d.update(0.1);
    expect(d.state.week).toBe(Math.floor((6.4 * 2) / RULES.weekSeconds));
    const before = d.pos;
    d.speed = 0;
    d.update(1);
    expect(d.pos).toBe(before);
    expect(d.secondsPerDay).toBe(Infinity);
  });

  it('moves the position continuously (week plus fraction)', () => {
    const rng = createRng(4);
    const d = new SimDriver(createGame(rng), rng, null);
    d.speed = 4;
    let prev = d.pos;
    for (let k = 0; k < 200; k++) {
      d.update(1 / 30);
      expect(d.pos - prev).toBeGreaterThan(0);
      expect(d.pos - prev).toBeLessThan(0.1);
      prev = d.pos;
    }
  });

  it('lets a player act before each week', () => {
    const rng = createRng(5);
    let acts = 0;
    const d = new SimDriver(createGame(rng), rng, { act: () => acts++ });
    d.speed = 4;
    for (let k = 0; k < 40; k++) d.update(0.1);
    expect(acts).toBe(d.state.week);
  });

  it('runs a year in about a minute in the demonstration, then goes back to 1x', () => {
    const rng = createRng(6);
    const d = new SimDriver(createGame(rng), rng, null);
    d.startDemo();
    expect(d.secondsPerDay * WEEKS_PER_YEAR).toBeCloseTo(DEMO_YEAR_SECONDS, 5);
    let seconds = 0;
    while (d.demo && seconds < 120) {
      d.update(0.05);
      seconds += 0.05;
    }
    expect(seconds).toBeGreaterThan(DEMO_YEAR_SECONDS - 2);
    expect(seconds).toBeLessThan(DEMO_YEAR_SECONDS + 2);
    expect(d.rate).toBe(1);
    expect(DEMO_SPEED).toBeGreaterThan(1);
  });

  it('shows a snowy winter and a dry summer in the demonstration, never a dry winter', () => {
    // The game starts in autumn: weeks 0..12 autumn, 13..25 winter, 26..38 spring, 39..51 summer.
    expect(demoForce(M + 5)).toEqual({ snow: true, drought: false });
    expect(demoForce(3 * M + 5).drought).toBe(true);
    expect(demoForce(2 * M + 1).drought).toBe(true);
    // The dry look fades through the first weeks of autumn instead of stopping at once.
    expect(demoForce(4 * M + 2).drought).toBe(true);
    expect(demoForce(4 * M + 8).drought).toBe(false);
  });
});

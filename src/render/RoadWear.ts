import VISUAL from '../data/visual.json';
import { indexOf, type GameState } from '../core';

const R = VISUAL.roads;

/**
 * How worn each street is, only for looks: residents' steps are counted per road cell, so busy
 * streets get wider and lighter and then paved with stone. Streets next to the altar and the temple
 * start paved. Never read by the game rules.
 */
export class RoadWear {
  private steps: Uint32Array;

  constructor(s: GameState) {
    this.steps = new Uint32Array(s.cols * s.rows);
  }

  /** A walker stepped onto a cell. */
  step(s: GameState, x: number, y: number) {
    this.steps[indexOf(s, x, y)]++;
  }

  /** 0 packed earth, 1 worn, 2 paved. */
  level(s: GameState, x: number, y: number): 0 | 1 | 2 {
    const n = this.steps[indexOf(s, x, y)];
    if (n >= R.paved || this.nearSacred(s, x, y)) return 2;
    return n >= R.worn ? 1 : 0;
  }

  private nearSacred(s: GameState, x: number, y: number) {
    return s.buildings.some(
      (b) => (b.kind === 'altar' || b.kind === 'temple') && Math.max(b.x - x, x - (b.x + b.w - 1), b.y - y, y - (b.y + b.h - 1), 0) <= R.pavedNear,
    );
  }
}

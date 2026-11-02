import Phaser from 'phaser';
import { cellOf, type GameState } from '../core';
import { CELL, MAP_X, cellBottom, cellCenterX, cellLeft, worldDepth } from './layout';
import { TEX, WALKER_VARIANTS } from './textures';

const MAX_WALKERS = 40;
const PER_WALKER = 5;

interface Walker {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  path: { x: number; y: number }[];
  speed: number;
  phase: number;
  lane: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

/** Little residents strolling between buildings along the gaps between cells. */
export class Walkers {
  private list: Walker[] = [];

  constructor(private scene: Phaser.Scene) {}

  update(dtMs: number, state: GameState, residents: number) {
    const target = Math.min(MAX_WALKERS, Math.floor(residents / PER_WALKER));
    while (this.list.length > target) this.list.pop()!.img.destroy();
    if (this.list.length < target) this.spawn(state);

    const dt = dtMs / 1000;
    for (const w of this.list) {
      if (!w.path.length) this.planRoute(w, state);
      const next = w.path[0];
      if (next) {
        const dx = next.x - w.x;
        const dy = next.y - w.y;
        const dist = Math.hypot(dx, dy);
        const step = w.speed * dt;
        if (dist <= step) {
          w.x = next.x;
          w.y = next.y;
          w.path.shift();
        } else {
          w.x += (dx / dist) * step;
          w.y += (dy / dist) * step;
        }
        if (Math.abs(dx) > 0.5) w.img.setFlipX(dx < 0);
        w.phase += dt * 11;
      }
      const bob = next ? Math.abs(Math.sin(w.phase)) * 2 : 0;
      w.img.setPosition(w.x, w.y - bob).setAngle(next ? Math.sin(w.phase) * 5 : 0).setDepth(worldDepth(w.y));
    }
  }

  private spawn(state: GameState) {
    const homes = state.buildings.flatMap((b, i) => (b?.kind === 'house' && b.level > 0 ? [i] : []));
    if (!homes.length) return;
    const { x, y } = cellOf(state, pick(homes));
    const w: Walker = {
      img: this.scene.add.image(0, 0, TEX.walker(Math.floor(Math.random() * WALKER_VARIANTS))).setOrigin(0.5, 1),
      x: cellCenterX(x) + rand(-8, 8),
      y: cellBottom(y) - 1,
      path: [],
      speed: rand(20, 30),
      phase: rand(0, 6),
      lane: rand(-3, 3),
    };
    this.list.push(w);
  }

  /** L-shaped route: along the current street, up/down a column gap, then along the target street. */
  private planRoute(w: Walker, state: GameState) {
    const built = state.buildings.flatMap((b, i) => (b ? [i] : []));
    if (!built.length) return;
    const { x, y } = cellOf(state, pick(built));
    const tx = cellCenterX(x) + rand(-10, 10);
    const ty = cellBottom(y) - 1 + w.lane * 0.5;
    const gapX = cellLeft(Math.round((w.x - MAP_X) / CELL)) + w.lane;
    w.path = [
      { x: gapX, y: w.y },
      { x: gapX, y: ty },
      { x: tx, y: ty },
    ];
  }
}

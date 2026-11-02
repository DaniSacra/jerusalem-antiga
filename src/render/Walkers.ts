import Phaser from 'phaser';
import { doorsOf, findPath, indexOf, RULES, type Cell, type GameState } from '../core';
import { depthAt, gridToWorld } from './iso';
import { TEX, WALKER_VARIANTS } from './textures';

const MAX_WALKERS = 60;
const PER_WALKER = 5;
/** Cells per second at 1x. */
const WALK_SPEED = 1.6;

interface Walker {
  img: Phaser.GameObjects.Image;
  path: Cell[];
  /** Index of the cell being left. */
  seg: number;
  /** Progress 0..1 toward path[seg + 1]. */
  t: number;
  pace: number;
  lane: number;
  phase: number;
  idle: number;
}

const pick = <T>(arr: T[]): T | undefined => arr[Math.floor(Math.random() * arr.length)];

/** Position along a cell path at a fractional step, with a sideways lane offset. */
function along(path: Cell[], step: number, lane: number) {
  const i = Math.min(Math.floor(step), path.length - 1);
  const t = Math.min(1, step - i);
  const a = path[i];
  const b = path[Math.min(i + 1, path.length - 1)];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const gx = a.x + 0.5 + dx * t - dy * lane;
  const gy = a.y + 0.5 + dy * t + dx * lane;
  return { gx, gy, dx, dy, moving: dx !== 0 || dy !== 0 };
}

function place(img: Phaser.GameObjects.Image, gx: number, gy: number, dx: number, dy: number, bob: number) {
  const w = gridToWorld(gx, gy);
  img.setPosition(w.x, w.y - bob).setDepth(depthAt(gx, gy) + 5);
  const screenDx = dx - dy;
  if (screenDx !== 0) img.setFlipX(screenDx < 0);
}

/** Residents strolling between buildings, and families heading to their new homes. Roads only. */
export class Walkers {
  private list: Walker[] = [];
  private families = new Map<number, Phaser.GameObjects.Image>();

  constructor(private scene: Phaser.Scene) {}

  update(dtMs: number, s: GameState, residents: number, speed: number, monthFrac: number) {
    this.updateResidents(dtMs / 1000, s, residents, speed);
    this.updateFamilies(s, monthFrac);
  }

  private updateResidents(dt: number, s: GameState, residents: number, speed: number) {
    const target = Math.min(MAX_WALKERS, Math.floor(residents / PER_WALKER));
    while (this.list.length > target) this.list.pop()!.img.destroy();
    if (this.list.length < target) this.spawn(s);

    const onNet = (c: Cell) => s.network[indexOf(s, c.x, c.y)];
    this.list = this.list.filter((w) => {
      if (!onNet(w.path[w.seg])) {
        w.img.destroy();
        return false;
      }
      return true;
    });

    for (const w of this.list) {
      const next = w.path[w.seg + 1];
      if (!next || !onNet(next)) {
        w.idle -= dt * speed;
        if (w.idle <= 0) this.plan(w, s);
      } else {
        w.t += dt * speed * WALK_SPEED * w.pace;
        w.phase += dt * speed * 11;
        while (w.t >= 1 && w.seg < w.path.length - 1) {
          w.t -= 1;
          w.seg++;
        }
        if (w.seg >= w.path.length - 1) {
          w.t = 0;
          w.idle = 0.5 + Math.random();
        }
      }
      const p = along(w.path, w.seg + w.t, w.lane);
      const bob = p.moving && speed > 0 ? Math.abs(Math.sin(w.phase)) * 2 : 0;
      place(w.img, p.gx, p.gy, p.dx, p.dy, bob);
      w.img.setAngle(p.moving && speed > 0 ? Math.sin(w.phase) * 5 : 0);
    }
  }

  private spawn(s: GameState) {
    const homes = s.buildings.filter((b) => b.kind === 'house' && b.level > 0 && b.connected);
    const home = pick(homes);
    const door = home && pick(doorsOf(s, home));
    if (!door) return;
    const img = this.scene.add.image(0, 0, TEX.walker(Math.floor(Math.random() * WALKER_VARIANTS))).setOrigin(0.5, 1);
    const w: Walker = { img, path: [door], seg: 0, t: 0, pace: 0.8 + Math.random() * 0.4, lane: (Math.random() - 0.5) * 0.3, phase: Math.random() * 6, idle: Math.random() };
    this.list.push(w);
  }

  /** Breadth-first route over the network to a random connected building. */
  private plan(w: Walker, s: GameState) {
    const from = w.path[w.seg];
    const dest = pick(s.buildings.filter((b) => b.connected));
    const path = dest && findPath(s, from, doorsOf(s, dest));
    w.path = path && path.length > 1 ? path : [from];
    w.seg = 0;
    w.t = 0;
    w.idle = 0.6;
  }

  private updateFamilies(s: GameState, monthFrac: number) {
    const alive = new Set<number>();
    for (const f of s.families) {
      alive.add(f.id);
      let img = this.families.get(f.id);
      if (!img) {
        img = this.scene.add.image(0, 0, TEX.family).setOrigin(0.5, 1);
        this.families.set(f.id, img);
      }
      const step = Math.min(f.step + RULES.familyCellsPerMonth * monthFrac, f.path.length - 1);
      const p = along(f.path, step, 0);
      place(img, p.gx, p.gy, p.dx, p.dy, Math.abs(Math.sin(step * Math.PI * 2)) * 1.5);
    }
    for (const [id, img] of this.families) {
      if (alive.has(id)) continue;
      img.destroy();
      this.families.delete(id);
    }
  }
}

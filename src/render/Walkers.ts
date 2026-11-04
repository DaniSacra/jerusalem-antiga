import Phaser from 'phaser';
import { craftOf, doorsOf, familySpeed, findPath, indexOf, pickWalkerType, walkerDef, walkerGoal, walkerStart, type Cell, type Craft, type GameState, type WalkerType } from '../core';
import { depthAt, gridToWorld } from './iso';
import type { RoadWear } from './RoadWear';
import { TEX, WALKER_LOOKS } from './textures';

const MAX_WALKERS = 60;
const PER_WALKER = 5;
/** Cells per second at 1x, before the type's own pace. */
export const WALK_SPEED = 1.6;
/** Seconds a walker may stop on arrival (drawing water, talking at the market). */
const PAUSE = { min: 1, max: 2 };

interface Walker {
  type: WalkerType;
  look: number;
  /** Craft of the workshop an artisan heads to (shown by what he carries), else null. */
  craft: Craft | null;
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
  /** Next walk is a return leg (types that shuttle between two buildings). */
  back: boolean;
  /** Last grid position (for animals that react to people passing by). */
  gx: number;
  gy: number;
}

/** Render-side randomness (which walker, small pace differences). Game rules stay seeded in core. */
const rand = Math.random;

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

/** Puts a person's image on a grid point (sorted among the buildings), facing its grid direction (dx, dy). */
export function place(img: Phaser.GameObjects.Image, gx: number, gy: number, dx: number, dy: number, bob: number) {
  const w = gridToWorld(gx, gy);
  img.setPosition(w.x, w.y - bob).setDepth(depthAt(gx, gy) + 5);
  // Facing follows the screen direction, so it stays right when the map is turned.
  const a = gridToWorld(gx, gy);
  const b = gridToWorld(gx + dx, gy + dy);
  if (b.x !== a.x) img.setFlipX(b.x < a.x);
}

/** Residents of 12 types walking to the places of their trade, and families heading home. Roads only. */
export class Walkers {
  private list: Walker[] = [];
  private families = new Map<number, Phaser.GameObjects.Image>();
  /** Families who abandoned their tent, walking out to the city entrance (only a sight, no rules). */
  private leaving: { img: Phaser.GameObjects.Image; path: Cell[]; step: number }[] = [];

  constructor(
    private scene: Phaser.Scene,
    private wear: RoadWear,
  ) {}

  /** `share` scales how many residents are out (time of day: half at night, more in the late afternoon). */
  update(dtMs: number, s: GameState, residents: number, speed: number, weekFrac: number, share = 1) {
    this.updateResidents(dtMs / 1000, s, Math.floor(Math.min(MAX_WALKERS, residents / PER_WALKER) * share), speed);
    this.updateFamilies(s, weekFrac);
    this.updateLeaving(dtMs / 1000, speed);
  }

  /** True if a resident is within r cells of a grid point. */
  near(gx: number, gy: number, r: number) {
    return this.list.some((w) => Math.abs(w.gx - gx) < r && Math.abs(w.gy - gy) < r);
  }

  /** A family leaves the house at (x, y) on foot; with no route out they just fade away. */
  leave(s: GameState, x: number, y: number) {
    const house = s.grid[indexOf(s, x, y)];
    const door = house && doorsOf(s, house)[0];
    const path = door ? findPath(s, door, [s.entrance]) : null;
    const start = door ?? { x, y };
    const img = this.scene.add.image(0, 0, TEX.family).setOrigin(0.5, 1);
    this.leaving.push({ img, path: path && path.length > 1 ? path : [start], step: 0 });
  }

  private updateLeaving(dt: number, speed: number) {
    this.leaving = this.leaving.filter((f) => {
      const end = f.path.length - 1;
      f.step = Math.min(end, f.step + dt * speed * WALK_SPEED);
      const p = along(f.path, f.step, 0);
      place(f.img, p.gx, p.gy, p.dx, p.dy, f.step < end ? Math.abs(Math.sin(f.step * Math.PI * 2)) * 1.5 : 0);
      if (f.step < end) return true;
      f.img.setAlpha(f.img.alpha - dt * 1.5); // fade out at the entrance (or in place)
      if (f.img.alpha > 0) return true;
      f.img.destroy();
      return false;
    });
  }

  private updateResidents(dt: number, s: GameState, target: number, speed: number) {
    // Extra walkers go home once they reach where they were going (no one vanishes mid-street),
    // unless there are far too many (the city shrank).
    if (this.list.length > target) {
      const k = this.list.length > target * 2 + 4 ? this.list.length - 1 : this.list.findIndex((w) => w.seg >= w.path.length - 1);
      if (k >= 0) this.list.splice(k, 1)[0].img.destroy();
    }
    if (this.list.length < target) this.spawn(s);

    const onNet = (c: Cell) => s.network[indexOf(s, c.x, c.y)];
    this.list = this.list.filter((w) => {
      if (onNet(w.path[w.seg])) return true;
      w.img.destroy();
      return false;
    });

    for (const w of this.list) {
      const next = w.path[w.seg + 1];
      let moving = false;
      if (!next || !onNet(next)) {
        w.idle -= dt * speed;
        if (w.idle <= 0) this.plan(w, s);
      } else {
        moving = speed > 0;
        w.t += dt * speed * WALK_SPEED * w.pace;
        w.phase += dt * speed * 11 * w.pace;
        while (w.t >= 1 && w.seg < w.path.length - 1) {
          w.t -= 1;
          w.seg++;
          this.wear.step(s, w.path[w.seg].x, w.path[w.seg].y);
        }
        if (w.seg >= w.path.length - 1) {
          w.t = 0;
          w.idle = rand() < walkerDef(w.type).pauseChance ? PAUSE.min + rand() * (PAUSE.max - PAUSE.min) : 0.2;
        }
      }
      const p = along(w.path, w.seg + w.t, w.lane);
      w.gx = p.gx;
      w.gy = p.gy;
      const bob = moving ? Math.abs(Math.sin(w.phase)) * 2 : 0;
      place(w.img, p.gx, p.gy, p.dx, p.dy, bob);
      w.img.setTexture(TEX.walker(w.type, w.look, moving && Math.sin(w.phase) > 0 ? 1 : 0, w.craft));
      w.img.setAngle(moving ? Math.sin(w.phase) * 4 : 0);
    }
  }

  private spawn(s: GameState) {
    const type = pickWalkerType(s, rand);
    const door = type && walkerStart(s, type, rand);
    if (!type || !door) return;
    const look = Math.floor(rand() * WALKER_LOOKS);
    const img = this.scene.add.image(0, 0, TEX.walker(type, look, 0)).setOrigin(0.5, 1);
    const pace = walkerDef(type).speed * (0.9 + rand() * 0.2);
    this.list.push({ type, look, craft: null, img, path: [door], seg: 0, t: 0, pace, lane: (rand() - 0.5) * 0.3, phase: rand() * 6, idle: rand(), back: false, gx: door.x + 0.5, gy: door.y + 0.5 });
  }

  /** Breadth-first route over the roads to the next destination of the walker's type. */
  private plan(w: Walker, s: GameState) {
    const from = w.path[w.seg];
    const goal = walkerGoal(s, w.type, rand, w.back);
    const path = goal && findPath(s, from, goal.cells);
    w.path = path && path.length > 1 ? path : [from];
    w.craft = w.type === 'artisan' && goal?.target ? craftOf(goal.target) : null;
    w.back = !w.back;
    w.seg = 0;
    w.t = 0;
    w.idle = 0.6;
  }

  /** World position of a family on its way home (none when it has arrived). */
  familyPos(id: number): { x: number; y: number } | null {
    const img = this.families.get(id);
    return img ? { x: img.x, y: img.y } : null;
  }

  private updateFamilies(s: GameState, weekFrac: number) {
    const alive = new Set<number>();
    for (const f of s.families) {
      alive.add(f.id);
      let img = this.families.get(f.id);
      if (!img) {
        img = this.scene.add.image(0, 0, TEX.family).setOrigin(0.5, 1);
        this.families.set(f.id, img);
      }
      const step = Math.min(f.step + familySpeed() * weekFrac, f.path.length - 1);
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

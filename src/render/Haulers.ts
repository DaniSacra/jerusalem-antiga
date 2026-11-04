import Phaser from 'phaser';
import { BUILDINGS, cellsInRadius, cellOf, doorsOf, fieldHarvest, findPath, isGatherSource, type Building, type Cell, type GameState } from '../core';
import VISUAL from '../data/visual.json';
import type { HaulerKind } from './residents';
import { TEX, WALKER_LOOKS } from './textures';
import { place, WALK_SPEED } from './Walkers';

const H = VISUAL.haulers;

type Job = 'harvest' | 'fish' | 'gather';
/** A grid point (cell centres are at +0.5). */
type Pt = { x: number; y: number };

interface Hauler {
  job: Job;
  /** The field, fisher or gatherer this worker belongs to. */
  home: number;
  img: Phaser.GameObjects.Image;
  look: number;
  route: Pt[];
  seg: number;
  t: number;
  /** Heading out (a carrier with a sack to the store; a fisher to the river; a gatherer to a tree). */
  out: boolean;
  wait: number;
  phase: number;
  pace: number;
}

const rand = Math.random;
const between = ([a, b]: number[]) => a + rand() * (b - a);
const centre = (c: Cell): Pt => ({ x: c.x + 0.5, y: c.y + 0.5 });

/** The point of a building's footprint (grown a little) nearest to a target: where its worker steps out. */
function edgeToward(b: Building, to: Pt): Pt {
  const m = 0.3;
  return { x: Math.min(b.x + b.w + m, Math.max(b.x - m, to.x)), y: Math.min(b.y + b.h + m, Math.max(b.y - m, to.y)) };
}

/** A point `d` cells from `p` toward `q`. */
function toward(p: Pt, q: Pt, d: number): Pt {
  const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
  return { x: p.x + ((q.x - p.x) * d) / len, y: p.y + ((q.y - p.y) * d) / len };
}

/**
 * The people of the food buildings (only a sight; the core counts the food): in the spring harvest
 * carriers take sacks from each harvesting field along the roads to the nearest granary, or to the
 * altar when there is none, and come back for more; all year a fisherman walks from his hut to the
 * river bank and stands there a while, and a gatherer walks to a tree near her hut and picks.
 */
export class Haulers {
  private list: Hauler[] = [];
  private state: GameState | null = null;

  constructor(private scene: Phaser.Scene) {}

  /** Who should be out now (called when the city changes, never per frame). */
  sync(s: GameState) {
    this.state = s;
    const want = new Map<string, { job: Job; home: number }>();
    const harvesting = s.buildings.filter((b) => b.kind === 'field' && fieldHarvest(s, b, s.week) > 0 && doorsOf(s, b).length);
    for (const b of harvesting.slice(0, H.harvestMax)) want.set(`harvest${b.id}`, { job: 'harvest', home: b.id });
    for (const b of s.buildings) {
      const g = BUILDINGS[b.kind].gather;
      if (g && b.connected && this.target(s, b)) want.set(`${g.source === 'river' ? 'fish' : 'gather'}${b.id}`, { job: g.source === 'river' ? 'fish' : 'gather', home: b.id });
    }
    this.list = this.list.filter((h) => {
      const key = `${h.job}${h.home}`;
      if (want.delete(key)) return true;
      h.img.destroy();
      return false;
    });
    for (const { job, home } of want.values()) this.spawn(s, job, home);
  }

  /** `dt` real seconds, `speed` the game speed (0 when paused). */
  update(dt: number, speed: number) {
    const s = this.state;
    if (!s) return;
    for (const h of this.list) {
      const end = h.route.length - 1;
      if (h.seg >= end) {
        h.wait -= dt * speed;
        // At work the figure shifts its weight now and then (casting, reaching up).
        const shift = h.job !== 'harvest' && !h.out && Math.sin(h.wait * 2.4) > 0.6;
        if (h.wait <= 0) this.plan(h, s);
        else this.draw(h, false, shift ? 1 : 0);
        continue;
      }
      h.t += dt * speed * WALK_SPEED * H.pace * h.pace;
      h.phase += dt * speed * 11 * h.pace;
      while (h.t >= 1 && h.seg < end) {
        h.t -= 1;
        h.seg++;
      }
      if (h.seg >= end) {
        h.t = 0;
        h.wait = h.job === 'harvest' ? between(H.endWait) : h.out ? between(H.workSeconds) : between(H.homeSeconds);
        h.out = !h.out;
      }
      this.draw(h, speed > 0);
    }
  }

  destroyAll() {
    for (const h of this.list) h.img.destroy();
    this.list = [];
  }

  private key(h: Hauler, frame: number) {
    const kind: HaulerKind = h.job === 'fish' ? 'fisher' : h.job === 'gather' ? 'gatherer' : h.out ? 'sack' : 'empty';
    return TEX.hauler(kind, h.look, frame);
  }

  /** Places the image (every frame, so it follows a turned map); `still` is the frame when not walking. */
  private draw(h: Hauler, moving: boolean, still = 0) {
    const a = h.route[Math.min(h.seg, h.route.length - 1)];
    const b = h.route[Math.min(h.seg + 1, h.route.length - 1)];
    const gx = a.x + (b.x - a.x) * h.t;
    const gy = a.y + (b.y - a.y) * h.t;
    const walking = moving && h.seg < h.route.length - 1;
    place(h.img, gx, gy, b.x - a.x, b.y - a.y, walking ? Math.abs(Math.sin(h.phase)) * 2 : 0);
    const key = this.key(h, walking ? (Math.sin(h.phase) > 0 ? 1 : 0) : still);
    if (h.img.texture.key !== key) h.img.setTexture(key);
    h.img.setAngle(walking ? Math.sin(h.phase) * 4 : 0);
  }

  private spawn(s: GameState, job: Job, home: number) {
    const img = this.scene.add.image(0, 0, TEX.hauler('empty', 0, 0)).setOrigin(0.5, 1);
    const h: Hauler = { job, home, img, look: Math.floor(rand() * WALKER_LOOKS), route: [], seg: 0, t: 0, out: true, wait: rand() * 2, phase: rand() * 6, pace: 0.9 + rand() * 0.2 };
    this.list.push(h);
    this.plan(h, s);
  }

  /** The river cell (fisher) or tree (gatherer) a worker heads for: the nearest one in the building's radius. */
  private target(s: GameState, b: Building): Pt | null {
    const g = BUILDINGS[b.kind].gather!;
    const mid = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    let best: Pt | null = null;
    let bestD = Infinity;
    for (const i of cellsInRadius(s, b.x, b.y, g.radius, b.w, b.h)) {
      if (!isGatherSource(s, i, g.source)) continue;
      const c = centre(cellOf(s, i));
      const d = Math.hypot(c.x - mid.x, c.y - mid.y);
      if (d < bestD) [best, bestD] = [c, d];
    }
    return best;
  }

  /** The next leg: along the roads for a carrier, straight over the ground for the others. */
  private plan(h: Hauler, s: GameState) {
    const b = s.buildings.find((o) => o.id === h.home);
    const prev = h.route;
    h.seg = 0;
    h.t = 0;
    if (!b) return;
    if (h.job === 'harvest') {
      if (prev.length > 1 && !h.out) {
        // Back to the field the way it came.
        h.route = [...prev].reverse();
      } else {
        const from = doorsOf(s, b)[Math.floor(rand() * doorsOf(s, b).length)];
        const stores = s.buildings.filter((o) => o.kind === 'granary' && o.connected);
        const goals = (stores.length ? stores : s.buildings.filter((o) => o.kind === 'altar')).flatMap((o) => doorsOf(s, o));
        const path = from && goals.length ? findPath(s, from, goals) : null;
        h.route = path && path.length > 1 ? path.map(centre) : from ? [centre(from)] : [];
        h.out = true;
      }
      if (!h.route.length) h.route = [{ x: b.x - 0.3, y: b.y + b.h / 2 }];
    } else {
      const spot = this.target(s, b);
      const mid = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      // A fisherman stops on the bank, a gatherer under the tree's crown, on the side of the hut.
      const work = spot ? toward(spot, mid, h.job === 'fish' ? 0.62 : 0.45) : mid;
      const door = edgeToward(b, work);
      h.route = h.out ? [door, work] : [work, door];
    }
    // Nowhere to go (no road to a store): try again in a moment, not every frame.
    if (h.route.length < 2) h.wait = 2;
    this.draw(h, false);
  }
}

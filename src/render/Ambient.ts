import Phaser from 'phaser';
import VISUAL from '../data/visual.json';
import { indexOf, type Building, type GameState } from '../core';
import { C } from './palette';
import { cellHash, DEPTH, depthAt, footCenter, gridToWorld, WORLD } from './iso';
import { TEX } from './textures';
import type { FaunaKind } from './fauna';

const A = VISUAL.ambient;
const rand = Math.random;
/** Hanging cloth colours on the laundry lines. */
const CLOTHS = [C.red, 0x5a7fb5, C.gold, 0xf4f0e6, 0x9a6ab0, 0x7fa65a];

type Behaviour = 'wander' | 'graze' | 'still' | 'scrub' | 'boat' | 'dove';

interface Mover {
  img: Phaser.GameObjects.Image;
  kind: FaunaKind;
  frame: number;
  how: Behaviour;
  gx: number;
  gy: number;
  /** Home and how far it strays from it (grid cells). */
  hx: number;
  hy: number;
  r: number;
  tx: number;
  ty: number;
  /** Cells per second. */
  speed: number;
  /** Seconds left standing still. */
  wait: number;
  phase: number;
  /** Doves: seconds left in the air (0 = sitting). */
  flying: number;
  /** Boats: the river center of each row, so the boat stays on the water where the river bends. */
  lane?: Map<number, number>;
}

interface Group {
  movers: Mover[];
  extra: Phaser.GameObjects.GameObject[];
  cloths: Phaser.GameObjects.Image[];
}

const empty = (): Group => ({ movers: [], extra: [], cloths: [] });

/**
 * Life around the city, only for looks: goats and chickens by the tents, donkeys tied by the
 * markets, sheep grazing on open grass, doves on the altar that fly off when someone passes,
 * fishing boats and washerwomen on the river near the city, laundry lines on some houses and
 * cloud shadows drifting over the map. Positions live in grid units, so turning the map only
 * needs the laundry lines redrawn (`rebuild`).
 */
export class Ambient {
  private groups = new Map<string, Group>();
  private clouds: Phaser.GameObjects.Image[] = [];
  private animals = 0;

  constructor(
    private scene: Phaser.Scene,
    private nearPeople: (gx: number, gy: number, r: number) => boolean,
  ) {
    for (let k = 0; k < A.clouds; k++) {
      const x = WORLD.left + rand() * (WORLD.right - WORLD.left);
      const y = WORLD.top + rand() * (WORLD.bottom - WORLD.top);
      const img = scene.add.image(x, y, TEX.soft).setTint(0x1c1408).setScale(16 + rand() * 8, 7 + rand() * 3).setDepth(DEPTH.tint - 1);
      this.clouds.push(img);
    }
  }

  /** Re-creates everything placed in screen space (after turning the map). */
  rebuild(s: GameState) {
    for (const g of this.groups.values()) this.destroy(g);
    this.groups.clear();
    this.animals = 0;
    this.sync(s);
  }

  sync(s: GameState) {
    const want = new Set<string>();
    const keep = (key: string, make: () => Group) => {
      want.add(key);
      if (this.groups.has(key)) return;
      const g = make();
      this.animals += g.movers.length;
      this.groups.set(key, g);
    };
    const free = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= s.cols || y >= s.rows) return false;
      const i = indexOf(s, x, y);
      return !s.grid[i] && !s.roads[i] && !s.feature[i] && s.ground[i] !== 'river';
    };
    const altar = s.buildings.find((b) => b.kind === 'altar');
    const nearCity = (x: number, y: number) => !altar || Math.max(Math.abs(x - altar.x), Math.abs(y - altar.y)) <= A.nearCity;
    const room = () => this.animals < A.maxAnimals;
    // Groups already shown stay even when the cap is reached (so they never blink in and out).
    const keepIfRoom = (key: string, make: () => Group) => {
      if (this.groups.has(key) || room()) keep(key, make);
    };

    for (const b of s.buildings) {
      const h = cellHash(b.x, b.y);
      if (b.kind === 'house' && b.level === 1) {
        const c = this.freeNeighbour(b, free);
        if (c) keepIfRoom(`t${b.id}-${c.x},${c.y}`, () => this.yard(c.x + 0.5, c.y + 0.5, h));
      }
      if (b.kind === 'market') {
        const c = this.freeNeighbour(b, free);
        if (c) keepIfRoom(`m${b.id}`, () => ({ ...empty(), movers: [this.mover('donkey', 0, 'still', c.x + 0.5, c.y + 0.5, 0)] }));
      }
      if (b.kind === 'house' && b.level >= 2 && h % A.laundryEvery === 0) keep(`l${b.id}-${b.level}`, () => this.laundry(b));
      if (b.kind === 'altar') keep(`d${b.id}`, () => this.doves(b));
    }

    // Sheep on open grass, away from the streets and the houses.
    let flocks = 0;
    const homes: { x: number; y: number }[] = [];
    for (const i of this.byHash(s)) {
      if (flocks >= A.flocks) break;
      const x = i % s.cols;
      const y = Math.floor(i / s.cols);
      if (s.ground[i] !== 'grass' || !nearCity(x, y) || !this.open(s, x, y, 2, free)) continue;
      if (homes.some((o) => Math.abs(o.x - x) + Math.abs(o.y - y) < 8)) continue;
      homes.push({ x, y });
      flocks++;
      keep(`s${x},${y}`, () => ({ ...empty(), movers: Array.from({ length: A.flockSize }, (_, k) => this.mover('sheep', k % 2, 'graze', x + 0.5, y + 0.5, 1.4, 0.25)) }));
    }

    // Washerwomen on the free banks closest to the city, a few cells apart.
    // Measured from the altar's center, as the crow flies.
    const dist = (x: number, y: number) => (altar ? Math.hypot(x + 0.5 - (altar.x + altar.w / 2), y + 0.5 - (altar.y + altar.h / 2)) : 0);
    const banks: { x: number; y: number; dx: number; dy: number }[] = [];
    for (let y = 0; y < s.rows; y++) {
      for (let x = 0; x < s.cols; x++) {
        if (!free(x, y)) continue;
        const river = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => s.ground[indexOf(s, Math.min(s.cols - 1, Math.max(0, x + dx)), Math.min(s.rows - 1, Math.max(0, y + dy)))] === 'river');
        if (river) banks.push({ x, y, dx: river[0], dy: river[1] });
      }
    }
    banks.sort((a, b) => dist(a.x, a.y) - dist(b.x, b.y) || cellHash(a.x, a.y) - cellHash(b.x, b.y));
    const picked: typeof banks = [];
    for (const c of banks) {
      if (picked.length >= A.washers) break;
      if (picked.some((o) => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) < 4)) continue;
      picked.push(c);
      keep(`w${c.x},${c.y}`, () => {
        const m = this.mover('washer', 0, 'scrub', c.x + 0.5 + c.dx * 0.38, c.y + 0.5 + c.dy * 0.38, 0);
        // The washing stone is on her right in the sprite: mirror her when the river is to the left on screen.
        m.img.setFlipX(gridToWorld(c.x + c.dx, c.y + c.dy).x < gridToWorld(c.x, c.y).x);
        return { ...empty(), movers: [m] };
      });
    }
    for (let k = 0; k < A.boats; k++) keep(`b${k}`, () => this.boat(s, k, dist));

    for (const [key, g] of this.groups) {
      if (want.has(key)) continue;
      this.animals -= g.movers.length;
      this.destroy(g);
      this.groups.delete(key);
    }
  }

  /** `t` seconds (real), `dt` game seconds (0 when paused), `night` 0..1, `overcast` 0..1 (rain or snow). */
  update(t: number, dt: number, night: number, overcast = 0) {
    for (const c of this.clouds) {
      c.x += dt * (9 + 10 * overcast);
      if (c.x > WORLD.right + 600) c.x = WORLD.left - 600;
      c.setAlpha((0.09 + 0.1 * overcast) * (1 - night));
    }
    for (const g of this.groups.values()) {
      for (const m of g.movers) this.move(m, t, dt);
      g.cloths.forEach((c, k) => c.setAngle(Math.sin(t * 2.4 + k * 1.3 + c.x * 0.01) * 9));
    }
  }

  destroyAll() {
    for (const g of this.groups.values()) this.destroy(g);
    this.groups.clear();
    for (const c of this.clouds) c.destroy();
  }

  // ---------- behaviour ----------

  private move(m: Mover, t: number, dt: number) {
    let bob = 0;
    let dx = 0;
    switch (m.how) {
      case 'wander':
      case 'graze': {
        if (m.wait > 0) {
          m.wait -= dt;
          // Chickens peck, sheep lower the head to graze.
          if (m.kind === 'chicken') bob = Math.max(0, Math.sin(t * 9 + m.phase)) * -1.5;
          if (m.kind === 'sheep') this.frame(m, Math.sin(t * 0.7 + m.phase) > 0 ? 1 : 0);
        } else {
          const ex = m.tx - m.gx;
          const ey = m.ty - m.gy;
          const d = Math.hypot(ex, ey);
          const step = m.speed * dt;
          if (d <= step) {
            m.gx = m.tx;
            m.gy = m.ty;
            m.wait = 1 + rand() * 4;
            m.tx = m.hx + (rand() - 0.5) * 2 * m.r;
            m.ty = m.hy + (rand() - 0.5) * 2 * m.r;
          } else {
            m.gx += (ex / d) * step;
            m.gy += (ey / d) * step;
            dx = ex;
            bob = dt > 0 ? -Math.abs(Math.sin(t * 12 + m.phase)) * 1.2 : 0;
          }
        }
        break;
      }
      case 'still':
        m.img.setAngle(Math.sin(t * 0.8 + m.phase) > 0.92 ? 3 : 0); // a shake of the head now and then
        break;
      case 'scrub':
        if (dt > 0) this.frame(m, Math.sin(t * 7 + m.phase) > 0 ? 1 : 0);
        break;
      case 'boat': {
        m.gy += m.speed * dt;
        if (m.gy > m.hy + m.r || m.gy < m.hy - m.r) m.speed = -m.speed;
        m.gx += ((m.lane?.get(Math.floor(m.gy)) ?? m.tx) - m.gx) * Math.min(1, dt * 2); // river center of the current row
        bob = Math.sin(t * 1.6 + m.phase) * 1.2;
        dx = 0;
        break;
      }
      case 'dove':
        this.dove(m, t, dt);
        return;
    }
    this.place(m, bob, dx);
  }

  private dove(m: Mover, t: number, dt: number) {
    if (m.flying > 0) {
      m.flying -= dt;
      const up = 3.5 - m.flying; // seconds since take-off
      const w = gridToWorld(m.hx, m.hy);
      m.img.setPosition(w.x + up * 26 * (m.phase > 3 ? 1 : -1), w.y - up * 34);
      m.img.setAlpha(Math.max(0, 1 - up / 1.6));
      if (m.frame === 0) {
        m.frame = 1;
        m.img.setTexture(TEX.fauna('doveFly')).setDepth(DEPTH.fx - 2);
      }
      if (m.flying <= 0) m.wait = 4 + rand() * 4; // stays away a little, then lands again
      return;
    }
    if (m.wait > 0) {
      m.wait -= dt;
      m.img.setAlpha(0);
      return;
    }
    if (m.frame === 1) {
      m.frame = 0;
      m.img.setTexture(TEX.fauna('dove'));
    }
    m.img.setAlpha(Math.min(1, m.img.alpha + Math.max(dt, 0.02) * 2));
    this.place(m, Math.max(0, Math.sin(t * 5 + m.phase)) * -1, 0);
    if (dt > 0 && this.nearPeople(m.hx, m.hy, 1.2)) m.flying = 3.5;
  }

  private place(m: Mover, bob: number, dx: number) {
    const w = gridToWorld(m.gx, m.gy);
    m.img.setPosition(w.x, w.y + bob).setDepth(depthAt(m.gx, m.gy) + 3);
    if (dx) {
      const a = gridToWorld(m.gx, m.gy);
      const b = gridToWorld(m.gx + Math.sign(dx), m.gy + Math.sign(m.ty - m.gy));
      if (b.x !== a.x) m.img.setFlipX(b.x < a.x);
    }
  }

  private frame(m: Mover, f: number) {
    if (f === m.frame) return;
    m.frame = f;
    m.img.setTexture(TEX.fauna(m.kind, f));
  }

  // ---------- builders ----------

  private mover(kind: FaunaKind, frame: number, how: Behaviour, hx: number, hy: number, r: number, speed = 0.35): Mover {
    const img = this.scene.add.image(0, 0, TEX.fauna(kind, frame)).setOrigin(0.5, 1).setFlipX(rand() < 0.5);
    const gx = hx + (rand() - 0.5) * r;
    const gy = hy + (rand() - 0.5) * r;
    const m: Mover = { img, kind, frame, how, gx, gy, hx, hy, r, tx: gx, ty: gy, speed, wait: rand() * 3, phase: rand() * 6, flying: 0 };
    this.place(m, 0, 0);
    return m;
  }

  /** A goat and two chickens (or just chickens) in a free cell next to a tent. */
  private yard(x: number, y: number, h: number): Group {
    const movers = [this.mover('chicken', h % 2, 'wander', x, y, 0.4, 0.5), this.mover('chicken', (h >>> 1) % 2, 'wander', x, y, 0.4, 0.5)];
    if (h % 3) movers.push(this.mover('goat', (h >>> 2) % 2, 'wander', x, y, 0.35, 0.25));
    return { ...empty(), movers };
  }

  private doves(b: Building): Group {
    const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const movers = Array.from({ length: A.doves }, (_, k) => {
      const a = (k / A.doves) * Math.PI * 2;
      const m = this.mover('dove', 0, 'dove', c.x + Math.cos(a) * 1.7, c.y + Math.sin(a) * 1.7, 0);
      m.gx = m.hx;
      m.gy = m.hy;
      m.wait = 0;
      return m;
    });
    return { ...empty(), movers };
  }

  /** A fishing boat drifting up and down the stretch of river closest to the city. */
  private boat(s: GameState, k: number, dist: (x: number, y: number) => number): Group {
    const rows: { y: number; x: number }[] = [];
    for (let y = 3; y < s.rows - 3; y++) {
      const xs: number[] = [];
      for (let x = 0; x < s.cols; x++) if (s.ground[indexOf(s, x, y)] === 'river') xs.push(x);
      if (xs.length) rows.push({ y, x: xs.reduce((a, v) => a + v, 0) / xs.length + 0.5 });
    }
    if (!rows.length) return empty();
    rows.sort((a, b) => dist(a.x, a.y) - dist(b.x, b.y));
    const row = rows[Math.min(rows.length - 1, k * 6)];
    const m = this.mover('boat', 0, 'boat', row.x, row.y + 0.5, 2.5, 0.12 * (k % 2 ? -1 : 1));
    m.tx = row.x;
    m.gx = row.x;
    m.lane = new Map(rows.map((r) => [r.y, r.x]));
    m.gy = m.hy;
    return { ...empty(), movers: [m] };
  }

  /** Two poles and a line along the front edge of a house, with cloths swaying in the wind. */
  private laundry(b: Building): Group {
    const corners = [
      { x: b.x, y: b.y },
      { x: b.x + b.w, y: b.y },
      { x: b.x + b.w, y: b.y + b.h },
      { x: b.x, y: b.y + b.h },
    ];
    // The corner nearest the viewer, and its neighbour to the right on screen.
    const front = corners.reduce((best, c) => (gridToWorld(c.x, c.y).y > gridToWorld(best.x, best.y).y ? c : best));
    const k = corners.indexOf(front);
    const side = [corners[(k + 1) % 4], corners[(k + 3) % 4]].sort((a, b) => gridToWorld(b.x, b.y).x - gridToWorld(a.x, a.y).x)[0];
    const lerp = (f: number) => ({ x: front.x + (side.x - front.x) * f, y: front.y + (side.y - front.y) * f });
    const center = footCenter(b.x, b.y, b.w, b.h);
    // Pulled a little toward the house, so the line stands in its front yard.
    const at = (f: number) => {
      const p = gridToWorld(lerp(f).x, lerp(f).y);
      return { x: p.x + (center.x - p.x) * 0.12, y: p.y + (center.y - p.y) * 0.12 };
    };
    const a = at(0.2);
    const e = at(0.8);
    const z = 15;
    const depth = depthAt(front.x, front.y) + 1;
    const g = this.scene.add.graphics().setDepth(depth);
    g.lineStyle(1.6, C.woodDark, 1);
    g.lineBetween(a.x, a.y, a.x, a.y - z - 2);
    g.lineBetween(e.x, e.y, e.x, e.y - z - 2);
    g.lineStyle(0.8, C.rope, 1);
    g.lineBetween(a.x, a.y - z, e.x, e.y - z);
    const h = cellHash(b.x, b.y);
    const cloths = [0.3, 0.5, 0.7].map((f, i) =>
      this.scene.add
        .image(a.x + (e.x - a.x) * f, a.y + (e.y - a.y) * f - z, TEX.fauna('cloth'))
        .setOrigin(0.5, 0)
        .setTint(CLOTHS[(h + i * 2) % CLOTHS.length])
        .setDepth(depth + 0.1),
    );
    return { movers: [], extra: [g], cloths };
  }

  // ---------- helpers ----------

  private freeNeighbour(b: Building, free: (x: number, y: number) => boolean) {
    const out: { x: number; y: number }[] = [];
    for (let x = b.x - 1; x <= b.x + b.w; x++) {
      for (let y = b.y - 1; y <= b.y + b.h; y++) {
        const inside = x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
        if (!inside && free(x, y)) out.push({ x, y });
      }
    }
    return out.length ? out[cellHash(b.x, b.y) % out.length] : null;
  }

  /** No building or road within r cells. */
  private open(s: GameState, x: number, y: number, r: number, free: (x: number, y: number) => boolean) {
    for (let j = y - r; j <= y + r; j++) {
      for (let i = x - r; i <= x + r; i++) {
        if (i < 0 || j < 0 || i >= s.cols || j >= s.rows) return false;
        const k = indexOf(s, i, j);
        if (s.grid[k] || s.roads[k]) return false;
      }
    }
    return free(x, y);
  }

  /** Cell indexes in a fixed scrambled order, so picks are stable between syncs. */
  private order: number[] | null = null;
  private byHash(s: GameState) {
    this.order ??= Array.from({ length: s.cols * s.rows }, (_, i) => i).sort((a, b) => cellHash(a % s.cols, a / s.cols | 0) - cellHash(b % s.cols, b / s.cols | 0));
    return this.order;
  }

  private destroy(g: Group) {
    for (const m of g.movers) m.img.destroy();
    for (const o of g.extra) o.destroy();
    for (const c of g.cloths) c.destroy();
  }
}

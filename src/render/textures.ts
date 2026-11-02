/**
 * All art is generated here as named textures. To switch to sprite files later, load images
 * with the same keys (see TEX) and keep the anchors in ORIGIN / HEIGHT, then skip generateTextures().
 *
 * Drawing uses a tiny 3D pen: local grid units (x east, y south, tile = 1) plus z in pixels.
 * Light comes from the late-afternoon sun in the west: south faces (+y, left on screen) are lit,
 * east faces (+x, right on screen) are in shade, and shadows fall toward the east.
 */
import Phaser from 'phaser';
import { createRng, dimsOf, type BuildingKind, type Feature, type Ground, type BalloonKind } from '../core';
import { HH, HW, TH, TW } from './iso';
import { C, shade } from './palette';

type G = Phaser.GameObjects.Graphics;
type P3 = [number, number, number?];

export const TEX = {
  ground: (g: Ground, v: number) => `ground-${g}-${v}`,
  road: (mask: number) => `road-${mask}`,
  feature: (f: Feature, v: number) => `${f}-${v}`,
  /** Houses have one texture per level; non-square buildings have their own rotated drawing. */
  building: (kind: BuildingKind, level = 0, rotated = false) => (kind === 'house' ? `house-${level}` : rotated ? `${kind}-rotated` : kind),
  wheat: 'wheat',
  flame: 'flame',
  soft: 'soft',
  ring: 'ring',
  balloon: 'balloon',
  need: (k: BalloonKind) => `need-${k}`,
  walker: (v: number) => `walker-${v}`,
  family: 'family',
  icon: (name: 'view' | 'clear' | 'road' | 'silver' | 'food' | 'people' | 'work' | 'month' | 'goal') => `icon-${name}`,
};
export const VARIANTS = 4;
export const WALKER_VARIANTS = 6;

/** Texture origin (anchor = ground point at the footprint center), as Phaser origin fractions. */
export const ORIGIN: Record<string, [number, number]> = {};
/** Height in pixels above the ground, for balloons. */
export const HEIGHT: Record<string, number> = {};

/**
 * Animated parts, in local grid units from the footprint center (z in pixels): wheat tufts in rows
 * over the 2 x 2 field (back to front), the workshop kiln chimney and the altar fire (with scale).
 */
export const PARTS = {
  wheat: [-0.66, -0.33, 0, 0.33, 0.66]
    .flatMap((y, row) => [-0.68, -0.34, 0, 0.34, 0.68].map((x) => ({ x: x + (row % 2 ? 0.08 : -0.04), y, z: 4 })))
    .sort((a, b) => a.x + a.y - b.x - b.y),
  chimney: { x: 0.78, y: -0.78, z: 44 },
  altarFire: { x: 0, y: -0.2, z: 24, scale: 2.2 },
};

const SHADOW_K = 0.016;
const SQRT2 = Math.SQRT2;

class Pen {
  constructor(readonly g: G, readonly ax: number, readonly ay: number) {}

  p(x: number, y: number, z = 0) {
    return { x: this.ax + (x - y) * HW, y: this.ay + (x + y) * HH - z };
  }

  poly(color: number, pts: P3[], alpha = 1) {
    this.g.fillStyle(color, alpha);
    this.g.fillPoints(pts.map(([x, y, z]) => this.p(x, y, z ?? 0)), true);
  }

  line(color: number, width: number, a: P3, b: P3, alpha = 1) {
    const pa = this.p(a[0], a[1], a[2] ?? 0);
    const pb = this.p(b[0], b[1], b[2] ?? 0);
    this.g.lineStyle(width, color, alpha);
    this.g.lineBetween(pa.x, pa.y, pb.x, pb.y);
  }

  /** Flat quad on the ground (or at height z). */
  rect(color: number, x0: number, y0: number, x1: number, y1: number, z = 0, alpha = 1) {
    this.poly(color, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], alpha);
  }

  /** Box with a top, a lit south face and a shaded east face. */
  box(x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, top: number, lit = shade(top, 0.88), dark = shade(top, 0.66)) {
    this.poly(lit, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]);
    this.poly(dark, [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]);
    this.rect(top, x0, y0, x1, y1, z1);
  }

  /** Soft shadow of a box of height h, cast toward the east. */
  shadow(x0: number, y0: number, x1: number, y1: number, h: number, alpha = 0.24) {
    const d = h * SHADOW_K;
    for (const [grow, a] of [[0.07, alpha * 0.45], [0, alpha * 0.7]]) {
      const corners: P3[] = [[x0 - grow, y0 - grow], [x1 + grow, y0 - grow], [x1 + grow, y1 + grow], [x0 - grow, y1 + grow]];
      const shifted = corners.map(([x, y]) => [x + d, y - d * 0.25] as P3);
      this.g.fillStyle(C.shadow, a);
      this.g.fillPoints(hull([...corners, ...shifted].map(([x, y]) => this.p(x, y))), true);
    }
  }

  /** Flat circle of radius r (grid units) at height z. */
  disc(color: number, x: number, y: number, z: number, r: number, alpha = 1) {
    const c = this.p(x, y, z);
    this.g.fillStyle(color, alpha);
    this.g.fillEllipse(c.x, c.y, r * 2 * SQRT2 * HW, r * 2 * SQRT2 * HH);
  }

  /** Screen-space circle (for foliage, fruit and other round things). */
  ball(color: number, x: number, y: number, z: number, radiusPx: number, alpha = 1) {
    const c = this.p(x, y, z);
    this.g.fillStyle(color, alpha);
    this.g.fillCircle(c.x, c.y, radiusPx);
  }

  /** Quad on the south face plane (y = const), e.g. a door or window. */
  southQuad(color: number, y: number, x0: number, x1: number, z0: number, z1: number) {
    this.poly(color, [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]]);
  }

  /** Quad on the east face plane (x = const). */
  eastQuad(color: number, x: number, y0: number, y1: number, z0: number, z1: number) {
    this.poly(color, [[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]]);
  }
}

function hull(pts: { x: number; y: number }[]) {
  const s = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: typeof s) => {
    const out: typeof s = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(s), ...half([...s].reverse())];
}

// ---------- texture factory ----------

const SMALL = { w: 108, h: 128, ax: 40, ay: 96 };
const TILE = { w: TW + 2, h: TH + 2, ax: TW / 2 + 1, ay: TH / 2 + 1 };

function make(scene: Phaser.Scene, key: string, size: { w: number; h: number; ax: number; ay: number }, draw: (p: Pen) => void, height = 0) {
  ORIGIN[key] = [size.ax / size.w, size.ay / size.h];
  HEIGHT[key] = height;
  if (scene.textures.exists(key)) return;
  const g = new Phaser.GameObjects.Graphics(scene);
  draw(new Pen(g, size.ax, size.ay));
  g.generateTexture(key, size.w, size.h);
  g.destroy();
}

function makeFlat(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void) {
  ORIGIN[key] = [0.5, 0.5];
  if (scene.textures.exists(key)) return;
  const g = new Phaser.GameObjects.Graphics(scene);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

const DIAMOND = 0.515;

// ---------- ground ----------

function groundTile(p: Pen, kind: Ground, v: number) {
  const r = createRng(300 + v * 7 + kind.length);
  const base = kind === 'sand' ? C.sand[v] : kind === 'grass' ? C.grass[v] : C.water;
  p.rect(base, -DIAMOND, -DIAMOND, DIAMOND, DIAMOND);
  const spot = (m = 0.4) => [-m + r() * m * 2, -m + r() * m * 2] as const;
  if (kind === 'river') {
    p.rect(C.waterDeep, -0.2, -DIAMOND, 0.2, DIAMOND, 0, 0.35);
    return;
  }
  // Large soft patches break the tile grid; small speckles give grain.
  for (let i = 0; i < 2; i++) {
    const [x, y] = spot(0.25);
    p.disc(shade(base, r() < 0.5 ? 0.96 : 1.05), x, y, 0, 0.18 + r() * 0.1, 0.55);
  }
  for (let i = 0; i < 7; i++) {
    const [x, y] = spot();
    p.disc(shade(base, r() < 0.5 ? 0.92 : 1.08), x, y, 0, 0.03 + r() * 0.06, 0.7);
  }
  if (kind === 'sand') {
    // Wind ripples and a few pebbles.
    for (let i = 0; i < 3; i++) {
      const [x, y] = spot(0.35);
      const a = p.p(x - 0.1, y + 0.02);
      const m = p.p(x, y - 0.03);
      const b = p.p(x + 0.1, y + 0.02);
      p.g.lineStyle(1, shade(base, 1.14), 0.85);
      p.g.lineBetween(a.x, a.y, m.x, m.y);
      p.g.lineBetween(m.x, m.y, b.x, b.y);
      p.g.lineStyle(1, shade(base, 0.9), 0.5);
      p.g.lineBetween(a.x, a.y + 1, m.x, m.y + 1);
      p.g.lineBetween(m.x, m.y + 1, b.x, b.y + 1);
    }
    for (let i = 0; i < 2 + (v % 2); i++) {
      const [px, py] = spot();
      const c = p.p(px, py);
      p.g.fillStyle(C.rockDark, 0.5);
      p.g.fillEllipse(c.x + 0.6, c.y + 0.6, 3, 1.8);
      p.g.fillStyle(C.rockLight);
      p.g.fillEllipse(c.x, c.y, 2.6, 1.6);
    }
  } else {
    for (let i = 0; i < 6; i++) {
      const [x, y] = spot();
      const b = p.p(x, y);
      const tall = 3 + r() * 3;
      p.g.lineStyle(1.2, i % 3 ? C.tuft : shade(base, 1.22), 0.9);
      p.g.lineBetween(b.x, b.y, b.x - 2, b.y - tall * 0.8);
      p.g.lineBetween(b.x, b.y, b.x, b.y - tall);
      p.g.lineBetween(b.x, b.y, b.x + 2, b.y - tall * 0.8);
    }
    if (v === 0) {
      const [x, y] = spot(0.3);
      p.ball(0xf2e6b0, x, y, 2, 1.1);
      p.ball(0xd98a6a, x + 0.08, y - 0.04, 2, 1.1);
    }
  }
}

/**
 * Packed-earth street: a soft verge, a wide trodden surface with an arm toward each connected
 * neighbour (N, E, S, W), cart ruts, worn edge stones and a few pebbles.
 */
function road(p: Pen, mask: number) {
  const w = 0.32;
  const arms: [number, number, number, number][] = [
    [-w, -0.5, w, -w], // N (y - 1)
    [w, -w, 0.5, w], // E (x + 1)
    [-w, w, w, 0.5], // S (y + 1)
    [-0.5, -w, -w, w], // W (x - 1)
  ];
  const has = (k: number) => !!(mask & (1 << k));
  const draw = (color: number, grow: number, alpha: number) => {
    p.rect(color, -w - grow, -w - grow, w + grow, w + grow, 0, alpha);
    arms.forEach(([x0, y0, x1, y1], k) => {
      if (!has(k)) return;
      const gx = k % 2 ? 0 : grow;
      const gy = k % 2 ? grow : 0;
      p.rect(color, x0 - gx, y0 - gy, x1 + gx, y1 + gy, 0, alpha);
    });
  };
  draw(C.roadEdge, 0.1, 0.25);
  draw(C.roadEdge, 0.05, 0.55);
  draw(C.road, 0, 1);
  draw(shade(C.road, 1.08), -0.08, 0.7);
  const rut = shade(C.road, 0.82);
  arms.forEach((_, k) => {
    if (!has(k)) return;
    const sign = k === 0 || k === 3 ? -0.5 : 0.5;
    for (const o of [-0.13, 0.13]) {
      if (k % 2) p.line(rut, 1.2, [0, o], [sign, o], 0.7);
      else p.line(rut, 1.2, [o, 0], [o, sign], 0.7);
    }
  });
  // Worn edge stones along the open sides of each arm.
  const r = createRng(900 + mask);
  const stone = (x: number, y: number) => {
    const c = p.p(x, y);
    p.g.fillStyle(C.rockDark, 0.6);
    p.g.fillEllipse(c.x + 0.7, c.y + 0.7, 3.4, 2);
    p.g.fillStyle(r() < 0.5 ? C.rock : C.rockLight);
    p.g.fillEllipse(c.x, c.y, 3.2, 1.9);
  };
  arms.forEach(([x0, y0, x1, y1], k) => {
    if (!has(k)) return;
    for (const t of [0.55]) {
      const along = k % 2 ? x0 + (x1 - x0) * t : y0 + (y1 - y0) * t;
      if (k % 2) {
        stone(along, -w - 0.03);
        stone(along, w + 0.03);
      } else {
        stone(-w - 0.03, along);
        stone(w + 0.03, along);
      }
    }
  });
  for (let i = 0; i < 4; i++) {
    const x = -0.2 + r() * 0.4;
    const y = -0.2 + r() * 0.4;
    p.ball(i % 2 ? shade(C.road, 1.2) : shade(C.road, 0.75), x, y, 0, 0.9);
  }
}

// ---------- features ----------

function rock(p: Pen, v: number) {
  const boulders: [number, number, number][] = v % 2 ? [[-0.1, -0.05, 11], [0.17, 0.12, 7]] : [[0.05, 0, 12], [-0.2, 0.15, 6], [0.2, -0.2, 5]];
  p.shadow(-0.3, -0.25, 0.3, 0.3, 14, 0.2);
  for (const [x, y, r] of boulders) {
    const c = p.p(x, y);
    p.g.fillStyle(C.rockDark);
    p.g.fillEllipse(c.x, c.y - r * 0.45, r * 2.2, r * 1.5);
    p.g.fillStyle(C.rock);
    p.g.fillEllipse(c.x - r * 0.12, c.y - r * 0.7, r * 1.9, r * 1.2);
    p.g.fillStyle(C.rockLight);
    p.g.fillEllipse(c.x - r * 0.4, c.y - r * 0.9, r * 0.9, r * 0.5);
  }
}

function olive(p: Pen, v: number) {
  const m = v % 2 ? -1 : 1;
  p.disc(C.shadow, 0.3, -0.05, 0, 0.32, 0.2);
  p.disc(C.shadow, 0.18, 0, 0, 0.22, 0.15);
  const base = p.p(0, 0);
  p.g.lineStyle(5, C.trunk);
  p.g.lineBetween(base.x, base.y, base.x + 2 * m, base.y - 12);
  p.g.lineStyle(3, C.trunk);
  p.g.lineBetween(base.x + 2 * m, base.y - 10, base.x - 5 * m, base.y - 18);
  const blobs: [number, number, number][] = [[-8 * m, -22, 9], [7 * m, -24, 10], [0, -31, 10], [0, -19, 8]];
  for (const [color, dy] of [[C.oliveDark, 2], [C.olive, 0]] as const) {
    p.g.fillStyle(color);
    blobs.forEach(([x, y, r]) => p.g.fillCircle(base.x + x, base.y + y + dy, r));
  }
  p.g.fillStyle(C.oliveLight);
  blobs.forEach(([x, y, r]) => p.g.fillCircle(base.x + x - 3, base.y + y - 3, r * 0.45));
  p.g.fillStyle(0x4b5a33);
  [[-6, -24], [5, -28], [2, -18], [-2, -34], [9, -21]].forEach(([x, y]) => p.g.fillCircle(base.x + x * m, base.y + y, 1.3));
}

function palm(p: Pen, v: number) {
  const m = v % 2 ? -1 : 1;
  const height = 46 + (v % 3) * 4;
  const lean = 7 * m;
  p.disc(C.shadow, 0.55, -0.15, 0, 0.3, 0.18);
  p.line(C.shadow, 3, [0, 0], [0.5, -0.12], 0.15);
  const base = p.p(0, 0);
  const at = (t: number) => ({ x: base.x + lean * t * t, y: base.y - height * t });
  for (let i = 0; i < 8; i++) {
    const a = at(i / 8);
    const b = at((i + 1) / 8);
    p.g.lineStyle(5 - i * 0.25, i % 2 ? C.palmTrunk : shade(C.palmTrunk, 0.82));
    p.g.lineBetween(a.x, a.y, b.x, b.y);
  }
  const top = at(1);
  const leaves = 8;
  for (const pass of [0, 1]) {
    for (let k = 0; k < leaves; k++) {
      const ang = (k / leaves) * Math.PI * 2 + v;
      const dx = Math.cos(ang) * 20;
      const dy = Math.sin(ang) * 9;
      const back = dy < 0;
      if ((pass === 0) !== back) continue;
      const tip = { x: top.x + dx, y: top.y + dy + 9 };
      const mid = { x: top.x + dx * 0.55, y: top.y + dy * 0.55 - 4 };
      const nx = -dy * 0.18;
      const ny = dx * 0.12;
      p.g.fillStyle(back ? C.palmDark : C.palm);
      p.g.fillTriangle(top.x, top.y, mid.x + nx, mid.y + ny, tip.x, tip.y);
      p.g.fillTriangle(top.x, top.y, mid.x - nx, mid.y - ny, tip.x, tip.y);
    }
  }
  p.g.fillStyle(0x7a4f2a);
  [[-2, 3], [2, 4], [0, 2]].forEach(([x, y]) => p.g.fillCircle(top.x + x, top.y + y, 2.2));
}

// ---------- building helpers ----------

/** Draw calls collected with a painter's key (x + y of the part) and drawn back to front. */
class Layers {
  private list: { key: number; draw: () => void }[] = [];
  add(gx: number, gy: number, draw: () => void) {
    this.list.push({ key: gx + gy, draw });
  }
  flush() {
    this.list.sort((a, b) => a.key - b.key).forEach((it) => it.draw());
    this.list = [];
  }
}

/** A standing person drawn on the ground point (x, y, z). */
function person(p: Pen, x: number, y: number, z: number, v: number, scale = 0.9) {
  const c = p.p(x, y, z);
  p.g.fillStyle(C.shadow, 0.22);
  p.g.fillEllipse(c.x + 1, c.y, 9 * scale, 3 * scale);
  figure(p.g, c.x, c.y, C.clothes[v % C.clothes.length], C.skin[v % C.skin.length], v % 2 === 0, scale);
}

/** Terracotta jar with a lit rim. */
function jar(p: Pen, x: number, y: number, z: number, r = 3, color = C.terracotta) {
  p.ball(C.shadow, x + 0.04, y - 0.01, z, r * 0.8, 0.25);
  p.ball(shade(color, 0.8), x, y, z + r, r);
  p.ball(color, x - 0.012, y - 0.012, z + r + 0.6, r * 0.82);
  p.ball(shade(color, 0.6), x, y, z + r * 2 + 0.5, r * 0.45);
  p.ball(shade(color, 1.3), x - 0.02, y - 0.02, z + r * 1.3, r * 0.3);
}

/** Vertical cylinder (well head, kiln base), lit on the left like the south faces. */
function cylinder(p: Pen, x: number, y: number, r: number, z0: number, z1: number, color: number) {
  const top = p.p(x, y, z1);
  const bot = p.p(x, y, z0);
  const w = r * 2 * SQRT2 * HW;
  const eh = r * 2 * SQRT2 * HH;
  p.g.fillStyle(shade(color, 0.62));
  p.g.fillEllipse(bot.x, bot.y, w, eh);
  p.g.fillRect(bot.x - w / 2, top.y, w, bot.y - top.y);
  p.g.fillStyle(shade(color, 0.88));
  p.g.fillEllipse(bot.x - w / 5, bot.y, w * 0.6, eh * 0.92);
  p.g.fillRect(bot.x - w / 2, top.y, w * 0.5, bot.y - top.y);
  p.g.fillStyle(shade(color, 0.75));
  p.g.fillRect(bot.x - w * 0.05, top.y, w * 0.2, bot.y - top.y);
  p.g.fillStyle(color);
  p.g.fillEllipse(top.x, top.y, w, eh);
}

/** Dome sitting on the ground ellipse of radius r (bread oven, kiln). */
function dome(p: Pen, x: number, y: number, z: number, r: number, h: number, color: number) {
  const c = p.p(x, y, z);
  const rx = r * SQRT2 * HW;
  const ry = r * SQRT2 * HH;
  const shape = (cx: number, sx: number, sh: number) => {
    const pts: { x: number; y: number }[] = [];
    for (let k = 0; k <= 16; k++) {
      const a = Math.PI + (k / 16) * Math.PI;
      pts.push({ x: cx + sx * Math.cos(a), y: c.y + sh * Math.sin(a) });
    }
    for (let k = 0; k <= 16; k++) {
      const a = (k / 16) * Math.PI;
      pts.push({ x: cx + sx * Math.cos(a), y: c.y + ry * Math.sin(a) });
    }
    return pts;
  };
  p.g.fillStyle(shade(color, 0.66));
  p.g.fillPoints(shape(c.x, rx, h), true);
  p.g.fillStyle(shade(color, 0.92));
  p.g.fillPoints(shape(c.x - rx * 0.22, rx * 0.74, h * 0.96), true);
  p.g.fillStyle(shade(color, 1.12));
  p.g.fillEllipse(c.x - rx * 0.3, c.y - h * 0.62, rx * 0.5, h * 0.4);
}

/** Small fig or olive tree with a trunk, layered round foliage and a soft shadow. */
function tree(p: Pen, x: number, y: number, z: number, size: number, leaf = C.leaf) {
  const t = p.p(x, y, z);
  p.disc(C.shadow, x + 0.2 * size, y - 0.05 * size, z, 0.22 * size, 0.2);
  p.g.lineStyle(3 * size, C.trunk);
  p.g.lineBetween(t.x, t.y, t.x + 1.5 * size, t.y - 14 * size);
  p.g.lineStyle(2 * size, C.trunk);
  p.g.lineBetween(t.x + size, t.y - 10 * size, t.x - 4 * size, t.y - 16 * size);
  const blobs: [number, number, number][] = [[-6, -19, 7], [6, -21, 7.5], [0, -27, 7.5], [1, -17, 6]];
  for (const [color, dy] of [[shade(leaf, 0.72), 2], [leaf, 0]] as const) {
    p.g.fillStyle(color);
    blobs.forEach(([bx, by, r]) => p.g.fillCircle(t.x + bx * size, t.y + (by + dy) * size, r * size));
  }
  p.g.fillStyle(shade(leaf, 1.3));
  blobs.forEach(([bx, by, r]) => p.g.fillCircle(t.x + (bx - 2.5) * size, t.y + (by - 2.5) * size, r * 0.4 * size));
}

/** Stack of firewood logs along y, seen end-on from the east. */
function logs(p: Pen, x: number, y: number, z = 0, n = 3) {
  const ends: [number, number][] = n >= 3 ? [[0, 3], [-0.07, 3], [-0.035, 8]] : [[0, 3], [-0.07, 3]];
  p.box(x - 0.2, y - 0.1, x, y + 0.03, z, z + (n >= 3 ? 10 : 6), C.wood, shade(C.wood, 0.9), shade(C.woodDark, 0.9));
  for (const [dy, dz] of ends) {
    const c = p.p(x, y + dy, z + dz);
    p.g.fillStyle(C.woodDark);
    p.g.fillCircle(c.x, c.y, 3.3);
    p.g.fillStyle(0xc89a68);
    p.g.fillCircle(c.x, c.y, 2);
  }
}

/** Flat roof with a low parapet: the inner floor sits a little lower than the wall top. */
function roofTop(p: Pen, x0: number, y0: number, x1: number, y1: number, z: number, color: number) {
  const i = 0.05;
  p.rect(shade(color, 0.9), x0 + i, y0 + i, x1 - i, y1 - i, z);
  p.poly(shade(color, 0.74), [[x0 + i, y0 + i, z], [x1 - i, y0 + i, z], [x1 - i, y0 + i, z - 2.5], [x0 + i, y0 + i, z - 2.5]]);
  p.poly(shade(color, 0.8), [[x0 + i, y0 + i, z], [x0 + i, y1 - i, z], [x0 + i, y1 - i, z - 2.5], [x0 + i, y0 + i, z - 2.5]]);
}

/** Faint mud-brick courses on the visible faces of a box. */
function bricks(p: Pen, x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, color: number, alpha = 0.3) {
  let row = 0;
  for (let z = z0 + 3.5; z < z1 - 1; z += 3.5, row++) {
    p.line(shade(color, 0.72), 1, [x0, y1, z], [x1, y1, z], alpha);
    p.line(shade(color, 0.48), 1, [x1, y0, z], [x1, y1, z], alpha);
    for (let x = x0 + (row % 2 ? 0.09 : 0.18); x < x1 - 0.02; x += 0.18) p.line(shade(color, 0.72), 1, [x, y1, z - 3.5], [x, y1, z], alpha * 0.8);
    for (let y = y0 + (row % 2 ? 0.09 : 0.18); y < y1 - 0.02; y += 0.18) p.line(shade(color, 0.48), 1, [x1, y, z - 3.5], [x1, y, z], alpha * 0.8);
  }
}

/**
 * A box built of unhewn fieldstones: rough courses of irregular stones in varied tones over dark
 * mortar, on the lit south face, the shaded east face and the top.
 */
function rubble(p: Pen, x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, color: number, seed: number, course = 5) {
  const r = createRng(seed);
  const j = (a: number) => (r() - 0.5) * a;
  const lit = shade(color, 0.92);
  const dark = shade(color, 0.64);
  p.box(x0, y0, x1, y1, z0, z1, shade(color, 0.7), shade(lit, 0.62), shade(dark, 0.62));
  for (let z = z0; z < z1 - 1; z += course) {
    const zt = Math.min(z1, z + course);
    for (const face of ['south', 'east'] as const) {
      const [a0, a1] = face === 'south' ? [x0, x1] : [y0, y1];
      const base = face === 'south' ? lit : dark;
      for (let a = a0; a < a1 - 0.03; ) {
        const b = Math.min(a1, a + 0.09 + r() * 0.13);
        const q: [number, number][] = [[a + 0.012, z + 0.7 + j(1)], [b - 0.012, z + 0.7 + j(1)], [b - 0.012 + j(0.02), zt - 0.6 + j(1)], [a + 0.012 + j(0.02), zt - 0.6]];
        const col = shade(base, 0.9 + r() * 0.2);
        p.poly(col, q.map(([s, zz]) => (face === 'south' ? [s, y1, Math.min(zt, zz)] : [x1, s, Math.min(zt, zz)]) as P3));
        a = b;
      }
    }
  }
  for (let x = x0; x < x1 - 0.03; x += 0.16) {
    for (let y = y0; y < y1 - 0.03; y += 0.16) {
      const xb = Math.min(x1, x + 0.16);
      const yb = Math.min(y1, y + 0.16);
      p.poly(shade(color, 0.92 + r() * 0.22), [[x + 0.015 + j(0.02), y + 0.015, z1], [xb - 0.015, y + 0.015 + j(0.02), z1], [xb - 0.015 + j(0.02), yb - 0.015, z1], [x + 0.015, yb - 0.015 + j(0.02), z1]]);
    }
  }
}

/** Canvas for a w x h footprint (cells) with art rising up to `height` px above the ground. */
function footCanvas(w: number, h: number, height: number) {
  const pad = 8;
  const east = 36; // room for shadows cast to the east
  const halfW = ((w + h) / 2) * HW;
  const halfH = ((w + h) / 2) * HH;
  return { w: Math.ceil(halfW * 2 + pad * 2 + east), h: Math.ceil(height + halfH * 2 + pad * 2), ax: halfW + pad, ay: height + halfH + pad };
}

// ---------- houses (2 x 2: local x, y in [-1, 1]) ----------

/** Level 0: a staked plot with the foundation stones laid out and a pile of mud bricks. */
function plot(p: Pen) {
  const s = 0.82;
  p.rect(0xcfa874, -s, -s, s, s, 0, 0.7);
  p.rect(shade(0xcfa874, 0.94), -0.6, -0.6, 0.3, 0.2, 0, 0.8);
  const r = createRng(17);
  const stones: [number, number][] = [];
  for (let t = -0.6; t <= 0.3; t += 0.11) stones.push([t, -0.6], [t, 0.2]);
  for (let t = -0.49; t < 0.2; t += 0.11) stones.push([-0.6, t], [0.3, t]);
  stones.sort((a, b) => a[0] + a[1] - b[0] - b[1]).forEach(([x, y]) => {
    const h = 2 + r() * 2;
    p.box(x - 0.045, y - 0.04, x + 0.045, y + 0.04, 0, h, shade(C.rock, 1.05 + r() * 0.1));
  });
  const corners: P3[] = [[-s, -s], [s, -s], [s, s], [-s, s]];
  corners.forEach((c, k) => p.line(C.rope, 1.2, [c[0], c[1], 4], [corners[(k + 1) % 4][0], corners[(k + 1) % 4][1], 4]));
  corners.forEach(([x, y]) => p.box(x - 0.035, y - 0.035, x + 0.035, y + 0.035, 0, 8, C.wood));
  // Pile of sun-dried bricks and a brick mould with a water jar.
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < 3 - layer; i++) {
      for (let k = 0; k < 2; k++) {
        const x = 0.4 + i * 0.13 + layer * 0.06;
        const y = 0.36 + k * 0.09;
        p.box(x, y, x + 0.12, y + 0.08, layer * 3, layer * 3 + 3, shade(C.mud, 1.05), shade(C.mud, 0.92), shade(C.mud, 0.68));
      }
    }
  }
  p.box(-0.5, 0.45, -0.25, 0.6, 0, 2, C.wood);
  p.rect(shade(C.mud, 0.85), -0.47, 0.48, -0.28, 0.57, 2);
  jar(p, -0.12, 0.62, 0, 3.2);
}

/** Level 1: a long low tent of dark goat-hair cloth, open at the front, with a fire pit and a goat. */
function tent(p: Pen) {
  const x0 = -0.82;
  const x1 = 0.5;
  const yb = -0.62;
  const yf = 0.22;
  const ry = -0.2;
  const zr = 27;
  const ze = 12;
  const cloth = C.tentCloth;
  p.rect(shade(C.sand[0], 0.92), -0.9, -0.9, 0.9, 0.9, 0, 0.5);
  p.shadow(x0, yb, x1, yf, zr * 0.8);
  // Back guy ropes.
  for (const x of [x0 + 0.1, -0.16, x1 - 0.1]) p.line(C.rope, 1, [x, yb, ze], [x, yb - 0.22, 0], 0.8);
  // Back roof slope, then the dark open interior with a rug and cushions.
  p.poly(shade(cloth, 0.9), [[x0, yb, ze], [x1, yb, ze], [x1, ry, zr], [x0, ry, zr]]);
  p.southQuad(0x231a12, yb, x0, x1, 0, ze);
  p.rect(0x2e231a, x0, yb, x1, yf);
  p.rect(C.red, x0 + 0.15, ry - 0.2, x1 - 0.2, yf - 0.06, 0, 0.9);
  for (let x = x0 + 0.22; x < x1 - 0.2; x += 0.14) p.line(C.cream, 1, [x, ry - 0.2], [x, yf - 0.06], 0.5);
  p.ball(C.cream, x0 + 0.3, -0.3, 3, 3);
  p.ball(C.gold, x0 + 0.5, -0.32, 3, 3);
  // Front slope with woven strips running front to back.
  p.poly(shade(cloth, 1.18), [[x0, ry, zr], [x1, ry, zr], [x1, yf, ze], [x0, yf, ze]]);
  for (let x = x0 + 0.22; x < x1; x += 0.22) p.line(shade(cloth, 0.75), 1.5, [x, ry, zr], [x, yf, ze], 0.8);
  p.line(shade(cloth, 1.5), 1, [x0, yf, ze], [x1, yf, ze], 0.8);
  p.line(C.woodDark, 2, [x0, ry, zr], [x1, ry, zr]);
  // East end curtain.
  p.poly(shade(cloth, 0.72), [[x1, yb, 0], [x1, yf, 0], [x1, yf, ze], [x1, ry, zr], [x1, yb, ze]]);
  p.line(shade(cloth, 0.55), 1.5, [x1, ry, 0], [x1, ry, zr], 0.8);
  // Front poles and guy ropes.
  for (const x of [x0 + 0.04, -0.16, x1 - 0.04]) p.line(C.wood, 2, [x, yf, 0], [x, yf, ze + 1]);
  for (const x of [x0 + 0.04, x1 - 0.04]) p.line(C.rope, 1, [x, yf, ze], [x, yf + 0.3, 0], 0.9);
  p.line(C.rope, 1, [x1, ry, zr], [x1 + 0.32, ry, 0], 0.9);
  // Fire pit with a cooking pot, a jar and a goat in the yard.
  const fx = 0.5;
  const fy = 0.62;
  p.disc(0x3a2c20, fx, fy, 0, 0.12);
  const r = createRng(5);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    p.ball(shade(C.rock, 0.9 + r() * 0.2), fx + Math.cos(a) * 0.13, fy + Math.sin(a) * 0.13, 1.5, 2);
  }
  p.ball(0xe8742c, fx - 0.02, fy, 2, 2);
  p.ball(0x3a3330, fx, fy, 5, 3.4);
  jar(p, -0.66, 0.55, 0, 3.4);
  jar(p, -0.52, 0.66, 0, 2.6);
  const g = p.p(-0.05, 0.62, 0);
  p.g.fillStyle(C.shadow, 0.22);
  p.g.fillEllipse(g.x + 1, g.y, 14, 4);
  p.g.lineStyle(1.5, 0x3a2c20);
  for (const dx of [-4, -2, 3, 5]) p.g.lineBetween(g.x + dx, g.y - 4, g.x + dx, g.y);
  p.g.fillStyle(0xe9ddc8);
  p.g.fillEllipse(g.x, g.y - 6, 13, 6);
  p.g.fillStyle(0x6b4a30);
  p.g.fillEllipse(g.x + 1, g.y - 6.5, 5, 4);
  p.g.fillStyle(0xe9ddc8);
  p.g.fillCircle(g.x - 7, g.y - 8, 2.5);
  p.g.lineStyle(1, 0x3a2c20);
  p.g.lineBetween(g.x - 8, g.y - 10, g.x - 10, g.y - 12);
}

/** Level 2: a small one-room mud-brick house with roof beams, a reed shed and a walled yard. */
function mudHouse(p: Pen) {
  const [x0, y0, x1, y1, h] = [-0.8, -0.8, 0.3, 0.08, 28];
  const wallH = 9;
  p.rect(shade(C.sand[0], 0.9), -0.82, -0.82, 0.82, 0.82, 0, 0.85);
  p.shadow(x0, y0, x1, y1, h);
  // Back-left yard wall.
  p.box(-0.82, y1, -0.74, 0.82, 0, wallH, shade(C.mud, 0.95));
  // House body.
  p.box(x0, y0, x1, y1, 0, h, shade(C.mud, 1.06), C.mud, shade(C.mud, 0.66));
  bricks(p, x0, y0, x1, y1, 0, h, C.mud);
  roofTop(p, x0, y0, x1, y1, h, C.mud);
  for (let x = x0 + 0.1; x < x1 - 0.05; x += 0.16) p.box(x, y1, x + 0.05, y1 + 0.05, h - 6, h - 3, C.woodDark);
  p.southQuad(shade(C.mud, 0.8), y1 + 0.001, -0.42, -0.16, 0, 17);
  p.southQuad(C.door, y1 + 0.002, -0.39, -0.19, 0, 15);
  p.southQuad(0x3a2818, y1 + 0.002, 0.02, 0.14, 15, 20);
  p.eastQuad(0x3a2818, x1 + 0.002, -0.45, -0.32, 15, 20);
  // Roof: a mat of drying figs, jars and a rolled sleeping mat.
  p.rect(0xc9a46a, -0.65, -0.62, -0.25, -0.3, h);
  for (let k = 0; k < 9; k++) p.ball(0x7a4f6a, -0.6 + (k % 3) * 0.13, -0.57 + Math.floor(k / 3) * 0.1, h + 1, 1.4);
  jar(p, 0.12, -0.6, h, 3.2);
  jar(p, 0.15, -0.42, h, 2.6);
  p.box(-0.1, -0.15, 0.15, -0.05, h, h + 3, C.red);
  // Reed shed for the animals on the east side.
  p.box(x1, -0.8, 0.78, -0.3, 0, 15, shade(C.mud, 0.98), shade(C.mud, 0.88), shade(C.mud, 0.62));
  p.box(x1 - 0.02, -0.82, 0.82, -0.26, 15, 17, 0xc2a463, 0xa98a4c, 0x8a6f3a);
  for (let y = -0.78; y < -0.3; y += 0.06) p.line(0x9c7f45, 1, [x1, y, 17], [0.8, y, 17], 0.7);
  p.eastQuad(0x3a2818, 0.781, -0.66, -0.44, 0, 10);
  // Ladder to the roof.
  for (const x of [0.12, 0.22]) p.line(C.woodDark, 1.5, [x, y1 + 0.28, 0], [x, y1 + 0.02, h + 5]);
  for (let k = 1; k < 7; k++) p.line(C.wood, 1, [0.12, y1 + 0.28 - k * 0.04, k * 4.5], [0.22, y1 + 0.28 - k * 0.04, k * 4.5]);
  // Yard: bread oven, grinding stone, jars.
  dome(p, 0.48, 0.22, 0, 0.13, 12, shade(C.mud, 0.9));
  p.ball(0x2a1f17, 0.42, 0.33, 4, 2);
  p.disc(shade(C.rock, 0.8), -0.42, 0.5, 0, 0.1);
  p.disc(C.rock, -0.42, 0.48, 3, 0.09);
  p.ball(C.rockLight, -0.4, 0.46, 5, 2);
  jar(p, -0.62, 0.32, 0, 3.4);
  jar(p, 0.52, 0.55, 0, 2.8);
  // Front and east yard walls with a gap for the gate.
  p.box(0.74, -0.26, 0.82, 0.74, 0, wallH, shade(C.mud, 0.95));
  p.box(-0.82, 0.74, -0.14, 0.82, 0, wallH, shade(C.mud, 0.95));
  p.box(0.14, 0.74, 0.82, 0.82, 0, wallH, shade(C.mud, 0.95));
  for (const x of [-0.14, 0.14]) p.box(x - 0.04, 0.73, x + 0.04, 0.83, 0, wallH + 3, shade(C.mud, 1.05));
}

/** Clothesline between two posts on a roof at height z, with drying cloths. */
function clothesline(p: Pen, a: [number, number], b: [number, number], z: number, cloths: number[]) {
  p.line(C.woodDark, 1.5, [a[0], a[1], z], [a[0], a[1], z + 12]);
  p.line(C.woodDark, 1.5, [b[0], b[1], z], [b[0], b[1], z + 12]);
  p.line(C.rope, 1, [a[0], a[1], z + 12], [b[0], b[1], z + 12]);
  cloths.forEach((color, k) => {
    const t0 = (k + 0.4) / (cloths.length + 0.4);
    const t1 = t0 + 0.55 / (cloths.length + 0.4);
    const at = (t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const [ax, ay] = at(t0);
    const [bx, by] = at(t1);
    p.poly(color, [[ax, ay, z + 12], [bx, by, z + 12], [bx, by, z + 5], [ax, ay, z + 6]]);
  });
}

/**
 * Level 3: stone ground floor with mud brick above, a framed window, an outside stair to the flat
 * roof (clothesline, jars, plants, a reed shade) and a yard behind a low stone wall.
 */
function stoneHouse(p: Pen) {
  const [x0, y0, x1, y1] = [-0.86, -0.86, 0.38, 0.16];
  const base = 16;
  const h = 36;
  const wallH = 10;
  p.rect(shade(C.sand[0], 0.9), -0.84, -0.84, 0.84, 0.84, 0, 0.85);
  p.shadow(x0, y0, x1, y1, h);
  p.box(-0.86, y1, -0.76, 0.86, 0, wallH, C.stone);
  // Body: stone below, mud brick above.
  p.box(x0, y0, x1, y1, 0, base, C.stone, shade(C.stone, 0.9), shade(C.stone, 0.62));
  masonry(p, x0, y0, x1, y1, 0, base, C.stone);
  p.box(x0, y0, x1, y1, base, h, shade(C.mud, 1.08), C.mud, shade(C.mud, 0.66));
  bricks(p, x0, y0, x1, y1, base, h, C.mud, 0.22);
  roofTop(p, x0, y0, x1, y1, h, C.mud);
  // Door with a lintel, framed windows.
  p.southQuad(C.limestone, y1 + 0.002, -0.22, 0.0, 12, 15);
  p.southQuad(C.door, y1 + 0.002, -0.19, -0.03, 0, 12);
  for (const x of [0.1]) {
    p.southQuad(C.limestone, y1 + 0.002, x, x + 0.18, 21, 31);
    p.southQuad(0x3a2818, y1 + 0.003, x + 0.025, x + 0.155, 22.5, 29.5);
    p.southQuad(C.woodDark, y1 + 0.004, x + 0.08, x + 0.1, 22.5, 29.5);
  }
  p.eastQuad(C.limestone, x1 + 0.002, -0.5, -0.32, 21, 31);
  p.eastQuad(0x3a2818, x1 + 0.003, -0.475, -0.345, 22.5, 29.5);
  p.eastQuad(0x3a2818, x1 + 0.002, -0.1, 0.0, 7, 12);
  // Outside stair against the south face, rising toward the west.
  const steps = 8;
  for (let k = 0; k < steps; k++) {
    const sx = -0.86 + (steps - 1 - k) * 0.06;
    const z = (k + 1) * (h / steps);
    p.box(sx, y1, sx + 0.06, y1 + 0.13, 0, z, shade(C.stone, 1.02), shade(C.stone, 0.9), shade(C.stone, 0.64));
  }
  // Roof life: a reed shade on poles, clothesline, jars and a potted plant.
  for (const [x, y] of [[0.02, -0.8], [0.32, -0.8], [0.02, -0.4], [0.32, -0.4]] as const) p.line(C.woodDark, 1.5, [x, y, h], [x, y, h + 14]);
  p.box(-0.02, -0.84, 0.36, -0.36, h + 14, h + 16, 0xc2a463, 0xa98a4c, 0x8a6f3a);
  for (let y = -0.82; y < -0.38; y += 0.06) p.line(0x9c7f45, 1, [-0.02, y, h + 16], [0.36, y, h + 16], 0.7);
  p.rect(C.red, 0.06, -0.74, 0.28, -0.46, h, 0.9);
  clothesline(p, [-0.72, -0.72], [-0.72, -0.05], h, [C.clothes[1], C.cream, C.clothes[0]]);
  jar(p, -0.3, -0.6, h, 3.4);
  jar(p, -0.42, -0.5, h, 2.8);
  p.box(-0.32, -0.15, -0.2, -0.03, h, h + 4, C.terracotta);
  p.ball(C.leaf, -0.26, -0.09, h + 9, 5);
  p.ball(shade(C.leaf, 1.3), -0.28, -0.11, h + 11, 2);
  // Yard: olive tree, bench, jars.
  tree(p, 0.58, -0.4, 0, 0.9, C.olive);
  p.box(-0.1, 0.42, 0.3, 0.52, 0, 5, C.stone);
  jar(p, 0.55, 0.3, 0, 3.4);
  jar(p, 0.64, 0.42, 0, 2.6);
  p.ball(C.wheat, -0.42, 0.5, 4, 4);
  p.ball(shade(C.wheat, 0.8), -0.42, 0.5, 2, 4);
  // Low stone yard walls with a gate.
  const sw = (a: number, b: number, c: number, d: number) => {
    p.box(a, b, c, d, 0, wallH, C.stone, shade(C.stone, 0.9), shade(C.stone, 0.62));
    masonry(p, a, b, c, d, 0, wallH, C.stone, 0.7);
  };
  sw(0.76, -0.4, 0.86, 0.76);
  sw(-0.86, 0.76, -0.16, 0.86);
  sw(0.16, 0.76, 0.86, 0.86);
}

/** Courses of stone blocks on the lit (south) and shaded (east) faces of a box. */
function masonry(p: Pen, x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, color: number, alpha = 1) {
  const lit = shade(color, 0.8);
  const dark = shade(color, 0.5);
  let row = 0;
  for (let z = z0 + 4; z < z1; z += 4, row++) {
    p.line(lit, 1, [x0, y1, z], [x1, y1, z], 0.55 * alpha);
    p.line(dark, 1, [x1, y0, z], [x1, y1, z], 0.55 * alpha);
    for (let x = x0 + (row % 2 ? 0.07 : 0.14); x < x1; x += 0.14) p.line(lit, 1, [x, y1, z - 4], [x, y1, z], 0.45 * alpha);
    for (let y = y0 + (row % 2 ? 0.07 : 0.14); y < y1; y += 0.14) p.line(dark, 1, [x1, y, z - 4], [x1, y, z], 0.45 * alpha);
  }
}

/**
 * Level 4: a large two-storey "four-room house" of light limestone filling the plot. A broad back
 * range with an upper floor, two pillared side wings and a front wall with a gate enclose an open
 * courtyard with a bread oven, a cistern and a fig tree.
 */
function bigHouse(p: Pen) {
  const s = 0.92;
  const wing = 26;
  const tall = 52;
  const wall = C.limeWash;
  const back = -0.22; // front edge of the back range
  const cx0 = -0.36; // courtyard west edge
  const cx1 = 0.36; // courtyard east edge
  const front = 0.74; // inner edge of the front wall
  const lime = (a: number, b: number, c: number, d: number, z0: number, z1: number) =>
    p.box(a, b, c, d, z0, z1, shade(wall, 1.04), shade(wall, 0.9), shade(wall, 0.64));
  p.shadow(-s, -s, s, back, tall);
  p.shadow(-s, back, s, s, wing);
  // Back range: stone ground floor, plastered upper floor with windows.
  lime(-s, -s, s, back, 0, tall);
  masonry(p, -s, -s, s, back, 0, 22, shade(wall, 0.95), 0.6);
  p.line(shade(wall, 0.8), 1.5, [-s, back, 24], [s, back, 24]);
  p.line(shade(wall, 0.5), 1.5, [s, -s, 24], [s, back, 24]);
  roofTop(p, -s, -s, s, back, tall, wall);
  for (const x of [-0.25, -0.03, 0.19]) {
    p.southQuad(C.limestone, back + 0.002, x - 0.02, x + 0.12, 32, 45);
    p.southQuad(0x3a2818, back + 0.003, x, x + 0.1, 33.5, 43);
    p.southQuad(C.woodDark, back + 0.004, x + 0.04, x + 0.06, 33.5, 43);
  }
  for (const y of [-0.78, -0.5]) {
    p.eastQuad(C.limestone, s + 0.002, y - 0.02, y + 0.12, 32, 45);
    p.eastQuad(0x3a2818, s + 0.003, y, y + 0.1, 33.5, 43);
  }
  // Courtyard floor with oven, cistern mouth and jars.
  p.rect(shade(C.sand[0], 0.94), cx0, back, cx1, front);
  for (let y = back + 0.16; y < front; y += 0.16) p.line(shade(C.sand[0], 0.84), 1, [cx0, y], [cx1, y], 0.5);
  dome(p, 0.2, -0.05, 0, 0.11, 11, shade(C.mud, 0.9));
  p.ball(0x2a1f17, 0.15, 0.04, 4, 1.8);
  p.disc(C.stone, -0.18, 0.5, 0, 0.1);
  p.disc(0x2a3a44, -0.18, 0.5, 1, 0.055);
  jar(p, 0.24, 0.55, 0, 3);
  jar(p, 0.14, 0.62, 0, 2.6);
  // West wing with stone pillars opening onto the courtyard.
  lime(-s, back, cx0, s, 0, wing);
  masonry(p, -s, back, cx0, s, 0, 12, shade(wall, 0.95), 0.6);
  for (let y = back + 0.06; y < front - 0.1; y += 0.24) p.eastQuad(0x4a3a2c, cx0 + 0.002, y + 0.06, y + 0.2, 0, 17);
  roofTop(p, -s, back, cx0, s, wing, wall);
  p.southQuad(0x3a2818, s + 0.002, -0.78, -0.66, 13, 20);
  p.southQuad(0x3a2818, s + 0.002, -0.54, -0.42, 13, 20);
  // Fig tree in the courtyard.
  tree(p, -0.06, 0.18, 0, 1.15, C.leaf);
  // Front wall with a gate and a stone lintel.
  lime(cx0, front, -0.12, s, 0, 16);
  lime(0.12, front, cx1, s, 0, 16);
  p.box(-0.14, front, 0.14, s, 15, 20, C.limestone, shade(C.limestone, 0.88), shade(C.limestone, 0.66));
  p.southQuad(C.wood, s + 0.002, -0.12, 0.12, 0, 15);
  p.line(C.woodDark, 1, [0, s + 0.003, 0], [0, s + 0.003, 15]);
  // East wing.
  lime(cx1, back, s, s, 0, wing);
  masonry(p, cx1, back, s, s, 0, 12, shade(wall, 0.95), 0.6);
  roofTop(p, cx1, back, s, s, wing, wall);
  p.southQuad(0x3a2818, s + 0.002, 0.5, 0.62, 13, 20);
  p.southQuad(0x3a2818, s + 0.002, 0.72, 0.84, 13, 20);
  p.eastQuad(0x3a2818, s + 0.002, 0.1, 0.22, 13, 20);
  p.eastQuad(0x3a2818, s + 0.002, 0.45, 0.57, 13, 20);
  // Roof life: striped awning and clothesline up top, plants, jars and drying flax on the wings.
  for (const [x, y] of [[0.84, -0.84], [0.84, -0.32]] as const) p.line(C.woodDark, 1.5, [x, y, tall], [x, y, tall + 12]);
  const stripes = 7;
  for (let k = 0; k < stripes; k++) {
    const y0 = -0.86 + (k * 0.58) / stripes;
    const y1 = y0 + 0.58 / stripes;
    p.poly(k % 2 ? C.cream : C.red, [[0.36, y0, tall + 16], [0.86, y0, tall + 11], [0.86, y1, tall + 11], [0.36, y1, tall + 16]]);
  }
  p.rect(C.red, 0.42, -0.8, 0.78, -0.4, tall, 0.85);
  clothesline(p, [-0.78, -0.76], [-0.78, -0.34], tall, [C.clothes[3], C.clothes[2], C.cream]);
  jar(p, -0.3, -0.62, tall, 3.4);
  jar(p, -0.18, -0.7, tall, 2.8);
  p.box(-0.8, 0.5, -0.62, 0.68, wing, wing + 4, C.terracotta);
  p.ball(C.leaf, -0.71, 0.59, wing + 10, 6);
  p.ball(shade(C.leaf, 1.3), -0.74, 0.56, wing + 12, 2.4);
  p.rect(0xd8c58a, -0.82, -0.1, -0.46, 0.3, wing);
  for (let y = -0.06; y < 0.3; y += 0.06) p.line(0xb8a46a, 1, [-0.8, y, wing], [-0.48, y, wing], 0.8);
  jar(p, 0.62, 0.62, wing, 3);
  jar(p, 0.76, 0.5, wing, 3);
  p.box(0.5, 0.0, 0.8, 0.2, wing, wing + 3, C.red);
}

// ---------- other buildings ----------

/** Field (2 x 2): a terrace of ploughed soil held by a fieldstone wall; wheat tufts are sprites. */
function field(p: Pen) {
  const s = 0.96;
  const z = PARTS.wheat[0].z;
  p.shadow(-s, -s, s, s, z);
  rubble(p, -s, -s, s, s, 0, z, C.rock, 41, 4);
  p.rect(C.soilDark, -s + 0.04, -s + 0.04, s - 0.04, s - 0.04, z);
  p.rect(C.soil, -s + 0.1, -s + 0.1, s - 0.1, s - 0.1, z);
  const rows = [...new Set(PARTS.wheat.map((w) => w.y))];
  for (const y of rows) {
    p.rect(shade(C.soil, 0.82), -s + 0.12, y - 0.03, s - 0.12, y + 0.1, z);
    p.line(shade(C.soil, 1.18), 1.2, [-s + 0.12, y - 0.08, z], [s - 0.12, y - 0.08, z], 0.7);
  }
  // Grass tufts along the terrace edge.
  const r = createRng(43);
  for (let k = 0; k < 10; k++) {
    const t = -s + 0.1 + r() * (2 * s - 0.2);
    const [x, y] = k % 2 ? [t, s - 0.06] : [s - 0.06, t];
    const b = p.p(x, y, z);
    p.g.lineStyle(1.2, C.tuft, 0.9);
    p.g.lineBetween(b.x, b.y, b.x - 2, b.y - 4);
    p.g.lineBetween(b.x, b.y, b.x + 1, b.y - 5);
  }
}

/** A cluster of five wheat stalks. */
function wheat(g: G) {
  g.lineStyle(1.3, C.wheatStem, 1);
  const tips: [number, number][] = [[3, 8], [7, 4], [11, 3], [15, 5], [19, 9]];
  tips.forEach(([x, y]) => g.lineBetween(11, 21, x, y + 3));
  g.fillStyle(shade(C.wheat, 0.85));
  tips.forEach(([x, y]) => g.fillEllipse(x + 0.5, y + 0.5, 3.6, 7.5));
  g.fillStyle(C.wheat);
  tips.forEach(([x, y]) => g.fillEllipse(x, y, 3.2, 7));
  g.fillStyle(shade(C.wheat, 1.3));
  tips.forEach(([x, y]) => g.fillEllipse(x - 0.6, y - 1, 1.2, 3.5));
}

/** Well (2 x 2): a paved stone platform, a round well head with a pulley frame and a trough. */
function well(p: Pen) {
  const s = 0.78;
  const plat = 4;
  p.shadow(-s, -s, s, s, 10, 0.18);
  p.box(-s, -s, s, s, 0, plat, C.stone, shade(C.stone, 0.88), shade(C.stone, 0.64));
  for (let k = -s + 0.26; k < s; k += 0.26) {
    p.line(shade(C.stone, 0.82), 1, [k, -s, plat], [k, s, plat], 0.7);
    p.line(shade(C.stone, 0.82), 1, [-s, k, plat], [s, k, plat], 0.7);
  }
  // A small date palm leaning over the back corner.
  const pc = p.p(-0.6, -0.6, plat);
  p.g.lineStyle(4, C.palmTrunk);
  p.g.lineBetween(pc.x, pc.y, pc.x - 2, pc.y - 30);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    p.g.fillStyle(k % 2 ? C.palm : C.palmDark);
    p.g.fillTriangle(pc.x - 2, pc.y - 30, pc.x - 2 + Math.cos(a) * 18, pc.y - 26 + Math.sin(a) * 7, pc.x - 2 + Math.cos(a + 0.3) * 12, pc.y - 30 + Math.sin(a + 0.3) * 5);
  }
  // Well head with water inside.
  const wx = 0;
  const wy = -0.1;
  const r = 0.36;
  cylinder(p, wx, wy, r, plat, plat + 13, C.stone);
  for (const z of [plat + 4.5, plat + 9]) {
    const c = p.p(wx, wy, z);
    p.g.lineStyle(1, shade(C.stone, 0.62), 0.6);
    p.g.beginPath();
    p.g.arc(c.x, c.y, r * SQRT2 * HW, 0.15, Math.PI - 0.15);
    p.g.strokePath();
  }
  p.disc(C.waterDeep, wx, wy, plat + 13, r * 0.72);
  p.disc(C.water, wx - 0.03, wy - 0.03, plat + 13, r * 0.5, 0.8);
  p.disc(C.waterLight, wx - 0.1, wy - 0.06, plat + 13, 0.06, 0.8);
  // Pulley frame across the well, drawn along the screen horizontal.
  const ends: [number, number][] = [[wx - 0.42, wy + 0.42], [wx + 0.42, wy - 0.42]];
  p.box(ends[1][0] - 0.035, ends[1][1] - 0.035, ends[1][0] + 0.035, ends[1][1] + 0.035, plat, plat + 38, C.wood);
  p.line(C.woodDark, 3, [ends[0][0], ends[0][1], plat + 37], [ends[1][0], ends[1][1], plat + 37]);
  const pul = p.p(wx, wy, plat + 34);
  p.g.fillStyle(C.woodDark);
  p.g.fillCircle(pul.x, pul.y, 4);
  p.g.fillStyle(C.wood);
  p.g.fillCircle(pul.x, pul.y, 2);
  p.line(C.rope, 1, [wx, wy, plat + 33], [wx, wy, plat + 20]);
  p.box(wx - 0.05, wy - 0.05, wx + 0.05, wy + 0.05, plat + 15, plat + 21, C.wood);
  p.box(ends[0][0] - 0.035, ends[0][1] - 0.035, ends[0][0] + 0.035, ends[0][1] + 0.035, plat, plat + 38, C.wood);
  // Stone trough with water, jars and a woman carrying a jar.
  p.box(0.2, 0.36, 0.7, 0.58, plat, plat + 8, C.stone, shade(C.stone, 0.86), shade(C.stone, 0.6));
  p.rect(C.waterDeep, 0.25, 0.4, 0.65, 0.54, plat + 8);
  p.rect(C.waterLight, 0.3, 0.44, 0.45, 0.48, plat + 8, 0.6);
  jar(p, -0.6, 0.38, plat, 3.6);
  jar(p, -0.45, 0.55, plat, 3);
  person(p, -0.15, 0.55, plat, 4);
  const head = p.p(-0.15, 0.55, plat + 19);
  p.g.fillStyle(C.terracotta);
  p.g.fillEllipse(head.x, head.y - 2, 7, 6);
}

/** Market (2 x 4, or 4 x 2 when rotated): two rows of stalls with striped awnings along an aisle. */
function market(p: Pen, rotated: boolean) {
  // u runs along the long side, v across it.
  const xy = (u: number, v: number): [number, number] => (rotated ? [u, v] : [v, u]);
  const rect4 = (u0: number, v0: number, u1: number, v1: number) => (rotated ? [u0, v0, u1, v1] : [v0, u0, v1, u1]) as [number, number, number, number];
  const P = (u: number, v: number, z = 0): P3 => [...xy(u, v), z];
  const box = (u0: number, v0: number, u1: number, v1: number, z0: number, z1: number, top: number, lit?: number, dark?: number) =>
    p.box(...rect4(u0, v0, u1, v1), z0, z1, top, lit, dark);
  const L = 1.92;
  const W = 0.94;
  p.rect(shade(C.sand[0], 0.9), ...rect4(-L, -W, L, W), 0, 0.85);
  p.rect(shade(C.stone, 0.92), ...rect4(-L, -0.26, L, 0.26));
  for (let u = -L + 0.2; u < L; u += 0.2) p.line(shade(C.stone, 0.75), 1, P(u, -0.26), P(u, 0.26), 0.6);
  p.line(shade(C.stone, 0.75), 1, P(-L, 0), P(L, 0), 0.5);

  const awnings = [C.red, C.ochre, 0x5a7fb5, 0x7fa65a, C.red, 0x9a6ab0];
  const goods: ((u: number, v: number, z: number) => void)[] = [
    (u, v, z) => [-0.3, -0.1, 0.1, 0.3].forEach((d, k) => jar(p, ...xy(u + d, v), z, k % 2 ? 2.6 : 3.2)),
    (u, v, z) => [-0.32, -0.16, 0, 0.16, 0.32].forEach((d, k) => p.ball(k % 2 ? 0x8a3b5a : 0xc8402e, ...xy(u + d, v), z + 2.5, 3)),
    (u, v, z) => [0xc0503c, 0x5a7fb5, 0xe2b544, 0xf6ecd6].forEach((c, k) => box(u - 0.34 + k * 0.17, v - 0.05, u - 0.2 + k * 0.17, v + 0.05, z, z + 4, c)),
    (u, v, z) => [-0.25, 0, 0.25].forEach((d) => {
      p.ball(shade(C.fabric, 0.8), ...xy(u + d, v), z + 4, 5);
      p.ball(C.fabric, ...xy(u + d - 0.02, v - 0.02), z + 5, 4);
      p.ball(C.wheat, ...xy(u + d, v), z + 8, 2.5);
    }),
    (u, v, z) => [-0.3, -0.1, 0.1, 0.3].forEach((d, k) => p.ball(k % 2 ? 0x7a4f2a : 0x6b3f5a, ...xy(u + d, v), z + 2.5, 3)),
    (u, v, z) => [-0.28, -0.08, 0.12, 0.3].forEach((d) => p.ball(0xd8a35a, ...xy(u + d, v), z + 2, 3.4)),
  ];
  const layers = new Layers();
  const stall = (u0: number, u1: number, side: number, k: number) => {
    const front = side * 0.3;
    const back = side * 0.9;
    const [va, vb] = side < 0 ? [back, front] : [front, back];
    const um = (u0 + u1) / 2;
    const color = awnings[k % awnings.length];
    const parts: { v: number; draw: () => void }[] = [];
    // Sacks and jars at the back, the merchant, the counter with goods, the posts.
    parts.push({
      v: side * 0.78,
      draw: () => {
        p.ball(shade(C.fabric, 0.8), ...xy(u0 + 0.2, side * 0.78), 5, 5);
        p.ball(C.fabric, ...xy(u0 + 0.18, side * 0.76), 6, 4.2);
        jar(p, ...xy(u1 - 0.2, side * 0.78), 0, 3.4);
      },
    });
    parts.push({ v: side * 0.6, draw: () => person(p, ...xy(um + 0.12, side * 0.6), 0, k + 1) });
    parts.push({
      v: side * 0.37,
      draw: () => {
        box(u0 + 0.08, side < 0 ? front - 0.14 : front, u1 - 0.08, side < 0 ? front : front + 0.14, 0, 9, C.wood);
        goods[k % goods.length](um, side * 0.37, 9);
      },
    });
    for (const u of [u0 + 0.04, u1 - 0.04]) {
      parts.push({ v: back, draw: () => box(u - 0.025, back - 0.025, u + 0.025, back + 0.025, 0, 30, C.wood) });
      parts.push({ v: front, draw: () => box(u - 0.025, front - 0.025, u + 0.025, front + 0.025, 0, 24, C.wood) });
    }
    // Striped awning sloping down toward the aisle, with a valance on the edge facing the viewer.
    parts.push({
      v: 9,
      draw: () => {
        const n = 5;
        for (let i = 0; i < n; i++) {
          const a = u0 + ((u1 - u0) * i) / n;
          const b = u0 + ((u1 - u0) * (i + 1)) / n;
          const c = i % 2 ? C.cream : color;
          p.poly(c, [P(a, back, 30), P(b, back, 30), P(b, front, 24), P(a, front, 24)]);
          const ev = side < 0 ? front : back;
          const ez = side < 0 ? 24 : 30;
          p.poly(shade(c, 0.82), [P(a, ev, ez), P(b, ev, ez), P(b, ev, ez - 5), P(a, ev, ez - 5)]);
        }
        p.poly(shade(color, 0.6), [P(u1, va, side < 0 ? 30 : 24), P(u1, vb, side < 0 ? 24 : 30), P(u1, vb, side < 0 ? 19 : 25), P(u1, va, side < 0 ? 25 : 19)]);
      },
    });
    const [cx, cy] = xy(um, side * 0.6);
    layers.add(cx, cy, () => parts.sort((a, b) => a.v - b.v).forEach((it) => it.draw()));
  };
  const spans: [number, number][] = [[-L + 0.04, -0.66], [-0.62, 0.62], [0.66, L - 0.04]];
  spans.forEach(([u0, u1], k) => {
    stall(u0, u1, -1, k);
    stall(u0, u1, 1, k + 3);
  });
  // Shoppers and a donkey with baskets in the aisle.
  [[-1.0, 0.04, 0], [0.2, -0.08, 2], [1.1, 0.06, 5]].forEach(([u, v, c]) => layers.add(...xy(u, v), () => person(p, ...xy(u, v), 0, c)));
  layers.add(...xy(1.65, 0), () => {
    const d = p.p(...xy(1.65, 0));
    p.g.fillStyle(C.shadow, 0.22);
    p.g.fillEllipse(d.x + 1, d.y, 20, 5);
    p.g.lineStyle(2, 0x5a4a3c);
    for (const dx of [-6, -3, 4, 7]) p.g.lineBetween(d.x + dx, d.y - 7, d.x + dx, d.y);
    p.g.fillStyle(0x8a7a6a);
    p.g.fillEllipse(d.x, d.y - 10, 18, 8);
    p.g.fillEllipse(d.x - 10, d.y - 14, 6, 5);
    p.g.fillStyle(0x6a5a4c);
    p.g.fillTriangle(d.x - 11, d.y - 16, d.x - 10, d.y - 22, d.x - 8, d.y - 16);
    p.g.fillStyle(0xb88f35);
    p.g.fillEllipse(d.x - 3, d.y - 9, 7, 8);
    p.g.fillEllipse(d.x + 4, d.y - 9, 7, 8);
  });
  layers.flush();
}

/**
 * Potter's workshop (3 x 3): a mud-brick workroom, a domed kiln with a chimney (smoke comes from
 * PARTS.chimney), a reed shade over the wheel, rows of pots drying in the walled yard and firewood.
 */
function workshop(p: Pen) {
  const s = 1.46;
  const wallH = 10;
  const mud = 0xd2a26a;
  p.rect(shade(C.sand[0], 0.88), -s, -s, s, s, 0, 0.9);
  p.box(-s, -s, -s + 0.1, s, 0, wallH, shade(mud, 0.95));
  p.box(-s + 0.1, -s, s, -s + 0.1, 0, wallH, shade(mud, 0.95));
  // Workroom.
  const [x0, y0, x1, y1, h] = [-1.36, -1.36, 0.2, -0.3, 32];
  p.shadow(x0, y0, x1, y1, h);
  p.box(x0, y0, x1, y1, 0, h, shade(mud, 1.06), mud, shade(mud, 0.66));
  bricks(p, x0, y0, x1, y1, 0, h, mud);
  roofTop(p, x0, y0, x1, y1, h, mud);
  for (let x = x0 + 0.1; x < x1 - 0.05; x += 0.18) p.box(x, y1, x + 0.05, y1 + 0.05, h - 6, h - 3, C.woodDark);
  p.southQuad(0x3a2c20, y1 + 0.002, -0.7, -0.38, 0, 18);
  p.southQuad(0x3a2818, y1 + 0.002, -0.15, 0.0, 16, 22);
  p.eastQuad(0x3a2818, x1 + 0.002, -0.95, -0.78, 16, 22);
  // Finished pots stacked on the roof.
  for (const [x, y] of [[-1.1, -1.1], [-0.95, -1.15], [-1.0, -0.95], [-0.8, -1.0], [-0.85, -0.82]] as const) jar(p, x, y, h, 3.2);
  logs(p, -0.2, -0.75, h, 2);
  // Kiln: a round mud base with a dome and a chimney, glowing firing hole.
  const k = PARTS.chimney;
  p.shadow(k.x - 0.45, k.y - 0.45, k.x + 0.45, k.y + 0.45, 30, 0.18);
  cylinder(p, k.x, k.y, 0.46, 0, 12, shade(mud, 0.9));
  dome(p, k.x, k.y, 12, 0.46, 16, shade(mud, 0.9));
  p.box(k.x - 0.08, k.y - 0.08, k.x + 0.08, k.y + 0.08, 20, k.z, C.rock, shade(C.rock, 0.9), C.rockDark);
  p.rect(0x2a1f17, k.x - 0.05, k.y - 0.05, k.x + 0.05, k.y + 0.05, k.z);
  const hole = p.p(k.x - 0.2, k.y + 0.35, 4);
  p.g.fillStyle(0x2a1f17);
  p.g.fillEllipse(hole.x, hole.y, 12, 9);
  for (let i = 3; i >= 1; i--) {
    p.g.fillStyle(0xf08a32, 0.28 * (4 - i));
    p.g.fillCircle(hole.x, hole.y + 1, i * 2);
  }
  logs(p, 1.38, -0.15, 0, 3);
  // Reed shade over the potter's wheel.
  const [sx0, sy0, sx1, sy1, sz] = [-1.3, 0.0, -0.3, 0.85, 22];
  person(p, -0.75, 0.3, 0, 1);
  cylinder(p, -0.62, 0.42, 0.1, 0, 5, C.wood);
  p.disc(shade(C.terracotta, 0.9), -0.62, 0.42, 5, 0.08);
  p.ball(C.terracotta, -0.62, 0.42, 8, 3);
  for (const [x, y] of [[sx0, sy0], [sx1, sy0], [sx0, sy1], [sx1, sy1]] as const) p.box(x, y, x + 0.04, y + 0.04, 0, sz, C.wood);
  p.box(sx0 - 0.04, sy0 - 0.04, sx1 + 0.08, sy1 + 0.08, sz, sz + 2, 0xc2a463, 0xa98a4c, 0x8a6f3a);
  for (let y = sy0; y < sy1 + 0.05; y += 0.07) p.line(0x9c7f45, 1, [sx0 - 0.04, y, sz + 2], [sx1 + 0.08, y, sz + 2], 0.7);
  // Rows of pots drying in the yard.
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4; i++) jar(p, 0.15 + i * 0.26, 0.25 + row * 0.3, 0, row === 1 ? 3.6 : 3, row === 2 ? shade(C.terracotta, 1.15) : C.terracotta);
  }
  p.disc(0x8a5a3a, -0.05, 1.1, 0, 0.18);
  p.disc(0x6e4630, -0.05, 1.1, 0.5, 0.12);
  // Front and east yard walls with a gate.
  p.box(s - 0.1, -s, s, s, 0, wallH, shade(mud, 0.95));
  p.box(-s, s - 0.1, -0.35, s, 0, wallH, shade(mud, 0.95));
  p.box(0.35, s - 0.1, s, s, 0, wallH, shade(mud, 0.95));
  for (const x of [-0.35, 0.35]) p.box(x - 0.05, s - 0.12, x + 0.05, s, 0, wallH + 4, shade(mud, 1.05));
}

/**
 * Altar (4 x 4): a court of fieldstones with a low rough wall, and the altar itself, a square mound
 * of unhewn stones with a ramp instead of steps, horns at the corners and the fire on top.
 */
function altar(p: Pen) {
  const s = 1.94;
  const warm = 0xdcc8a0;
  p.rect(shade(warm, 0.86), -s, -s, s, s);
  const r = createRng(77);
  for (let k = 0; k < 90; k++) {
    const x = -s + 0.1 + r() * (2 * s - 0.2);
    const y = -s + 0.1 + r() * (2 * s - 0.2);
    p.disc(shade(warm, 0.9 + r() * 0.2), x, y, 0, 0.06 + r() * 0.07, 0.9);
  }
  const wallH = 7;
  rubble(p, -s, -s, s, -s + 0.16, 0, wallH, warm, 1);
  rubble(p, -s, -s + 0.16, -s + 0.16, s, 0, wallH, warm, 2);
  const [a, top] = [1.0, PARTS.altarFire.z];
  const [ax0, ay0, ax1, ay1] = [-a, -a - 0.2, a, a - 0.2];
  p.shadow(ax0, ay0, ax1, ay1, top + 10);
  // Wood stack and ash heap behind the altar.
  logs(p, 1.6, -1.2, 0, 3);
  p.disc(0x8a8278, -1.35, -1.25, 0, 0.22);
  p.disc(0x6e665c, -1.35, -1.25, 2, 0.14);
  rubble(p, ax0, ay0, ax1, ay1, 0, top, warm, 3);
  // Hearth with embers on top, rough horns at the corners.
  p.disc(0x3a2c20, PARTS.altarFire.x, PARTS.altarFire.y, top, 0.4);
  p.disc(0x5a3a22, PARTS.altarFire.x, PARTS.altarFire.y, top, 0.28);
  for (let k = 0; k < 8; k++) p.ball(k % 2 ? 0xe8742c : 0xf6c84c, PARTS.altarFire.x - 0.22 + r() * 0.44, PARTS.altarFire.y - 0.22 + r() * 0.44, top, 1.6);
  for (const [x, y] of [[ax0 + 0.12, ay0 + 0.12], [ax1 - 0.12, ay0 + 0.12], [ax0 + 0.12, ay1 - 0.12], [ax1 - 0.12, ay1 - 0.12]] as const) {
    const c = p.p(x, y, top);
    p.g.fillStyle(shade(warm, 0.62));
    p.g.fillEllipse(c.x + 1, c.y - 4, 11, 10);
    p.g.fillStyle(shade(warm, 0.95));
    p.g.fillEllipse(c.x - 1, c.y - 6, 9, 8);
    p.g.fillStyle(shade(warm, 1.15));
    p.g.fillEllipse(c.x - 2.5, c.y - 8, 4, 3);
  }
  // Ramp up the south side (no steps), with rough stones along its edges.
  const [rx0, rx1, ry0, ry1] = [-0.36, 0.36, ay1, s - 0.12];
  p.poly(shade(warm, 0.6), [[rx1, ry0, 0], [rx1, ry1, 0], [rx1, ry0, top]]);
  p.poly(shade(warm, 1.02), [[rx0, ry0, top], [rx1, ry0, top], [rx1, ry1, 0], [rx0, ry1, 0]]);
  for (let t = 0.05; t < 0.98; t += 0.09) {
    const y = ry0 + (ry1 - ry0) * t;
    const z = top * (1 - t);
    for (let x = rx0 + 0.08 + r() * 0.06; x < rx1 - 0.05; x += 0.13 + r() * 0.06) p.disc(shade(warm, 0.84 + r() * 0.24), x, y, z + 0.5, 0.045, 0.9);
    p.ball(shade(warm, 0.75 + r() * 0.2), rx1 - 0.02, y, z + 1, 2.4);
    p.ball(shade(warm, 0.9 + r() * 0.2), rx0 + 0.02, y, z + 1, 2.2);
  }
  // Water jar and a basin for washing.
  cylinder(p, -1.3, 1.2, 0.2, 0, 6, C.stone);
  p.disc(C.waterDeep, -1.3, 1.2, 6, 0.14);
  jar(p, -1.0, 1.45, 0, 3.6);
  // Front and east walls of the court, open where the ramp meets it.
  rubble(p, s - 0.16, -s + 0.16, s, s, 0, wallH, warm, 4);
  rubble(p, -s + 0.16, s - 0.16, -0.7, s, 0, wallH, warm, 5);
  rubble(p, 0.7, s - 0.16, s - 0.16, s, 0, wallH, warm, 6);
}

/**
 * The temple (6 x 6), the finest building in the city: a raised limestone platform with stairs,
 * an enclosing wall with a gatehouse, columned porticoes along the back and west sides, a paved
 * court with a laver and a rough-stone altar, and a tall sanctuary with a porch and two columns.
 */
function temple(p: Pen) {
  const top = 14;
  const S = 2.92;
  const lime = C.limestone;
  const white = 0xfbf6ea;
  const limeBox = (x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, c = lime) =>
    p.box(x0, y0, x1, y1, z0, z1, c, shade(c, 0.88), shade(c, 0.64));
  p.shadow(-S, -S, S, 2.4, top, 0.2);
  p.shadow(-1.2, -2.2, 1.2, -0.1, top + 100, 0.16);
  // Platform with dressed blocks and a cornice.
  limeBox(-S, -S, S, 2.4, 0, top);
  masonry(p, -S, -S, S, 2.4, 0, top - 2, lime);
  p.box(-S - 0.03, -S - 0.03, S + 0.03, 2.43, top - 2, top, white, shade(white, 0.9), shade(white, 0.68));
  // Stairs up the front.
  for (let k = 3; k >= 0; k--) {
    const z = top - k * (top / 4);
    limeBox(-1.0, 2.4, 1.0, 2.4 + (k + 1) * 0.14, 0, z, shade(lime, 1.04));
  }
  // Court paving.
  for (let k = -2.6; k < 2.4; k += 0.4) p.line(shade(lime, 0.84), 1, [k, -2.7, top], [k, 2.2, top], 0.55);
  for (let k = -2.6; k < 2.2; k += 0.4) p.line(shade(lime, 0.84), 1, [-2.7, k, top], [2.7, k, top], 0.55);

  const wallH = top + 22;
  const wall = (x0: number, y0: number, x1: number, y1: number) => {
    limeBox(x0, y0, x1, y1, top, wallH, C.stone);
    masonry(p, x0, y0, x1, y1, top, wallH - 3, C.stone, 0.6);
    p.box(x0 - 0.02, y0 - 0.02, x1 + 0.02, y1 + 0.02, wallH - 3, wallH, white, shade(white, 0.9), shade(white, 0.68));
  };
  const tower = (x: number, y: number, h: number) => {
    limeBox(x - 0.2, y - 0.2, x + 0.2, y + 0.2, top, h);
    masonry(p, x - 0.2, y - 0.2, x + 0.2, y + 0.2, top, h - 4, lime, 0.6);
    p.box(x - 0.23, y - 0.23, x + 0.23, y + 0.23, h - 4, h, white, shade(white, 0.9), shade(white, 0.68));
    p.rect(C.gold, x - 0.12, y - 0.12, x + 0.12, y + 0.12, h);
  };
  const column = (x: number, y: number, h: number, r = 0.06) => {
    limeBox(x - r - 0.03, y - r - 0.03, x + r + 0.03, y + r + 0.03, top, top + 3);
    p.box(x - r, y - r, x + r, y + r, top + 3, top + h - 3, white, 0xf0e6d2, 0xc9bb9c);
    p.line(0xe2d6bc, 1, [x - r * 0.3, y + r, top + 3], [x - r * 0.3, y + r, top + h - 3], 0.8);
    limeBox(x - r - 0.04, y - r - 0.04, x + r + 0.04, y + r + 0.04, top + h - 3, top + h, white);
  };

  tower(-2.7, -2.7, wallH + 10);
  wall(-2.5, -2.88, 2.5, -2.66);
  wall(-2.88, -2.5, -2.66, 2.0);
  tower(2.7, -2.7, wallH + 10);
  // Back portico: a roof on a row of columns.
  const pz = 22;
  limeBox(-2.66, -2.66, 2.66, -2.52, top, top + pz - 3, shade(lime, 0.92));
  for (let x = -2.3; x <= 2.35; x += 0.46) column(x, -2.1, pz);
  limeBox(-2.66, -2.66, 2.66, -1.96, top + pz, top + pz + 3, white);
  // West portico.
  for (let y = -1.6; y <= 1.8; y += 0.46) column(-2.1, y, pz);
  limeBox(-2.66, -1.96, -1.96, 2.0, top + pz, top + pz + 3, white);

  // Sanctuary on a raised base: a long hall, a taller porch with a great doorway, gold cornices.
  const base = top + 6;
  limeBox(-1.3, -2.2, 1.3, 0.35, top, base);
  for (let k = 2; k >= 0; k--) limeBox(-0.55, 0.35, 0.55, 0.35 + (k + 1) * 0.1, top, base - k * 2);
  const hall = base + 76;
  limeBox(-0.85, -2.0, 0.85, -0.6, base, hall);
  masonry(p, -0.85, -2.0, 0.85, -0.6, base, hall - 4, lime, 0.45);
  p.box(-0.89, -2.04, 0.89, -0.56, hall - 4, hall, C.gold, shade(C.gold, 0.9), shade(C.gold, 0.68));
  p.rect(shade(lime, 0.94), -0.8, -1.95, 0.8, -0.65, hall);
  for (const y of [-1.75, -1.35, -0.95]) p.eastQuad(0x5c4a36, 0.851, y, y + 0.1, hall - 22, hall - 10);
  const porch = base + 96;
  limeBox(-1.2, -0.6, 1.2, -0.18, base, porch);
  masonry(p, -1.2, -0.6, 1.2, -0.18, base, porch - 6, lime, 0.45);
  p.box(-1.25, -0.65, 1.25, -0.13, porch - 6, porch, C.gold, shade(C.gold, 0.9), shade(C.gold, 0.68));
  p.rect(shade(C.gold, 1.15), -1.18, -0.58, 1.18, -0.2, porch);
  p.southQuad(shade(lime, 0.8), -0.179, -1.2, 1.2, porch - 20, porch - 18);
  p.southQuad(shade(C.gold, 0.85), -0.179, -0.38, 0.38, base, base + 56);
  p.southQuad(white, -0.178, -0.34, 0.34, base, base + 53);
  p.southQuad(0x4a3626, -0.177, -0.29, 0.29, base, base + 50);
  p.southQuad(0x6a4a2e, -0.176, -0.24, 0.24, base, base + 45);
  p.line(C.gold, 1, [0, -0.175, base], [0, -0.175, base + 45]);
  for (const x of [-0.85, 0.55]) p.southQuad(0x5c4a36, -0.179, x, x + 0.3, porch - 34, porch - 26);
  p.eastQuad(0x5c4a36, 1.201, -0.48, -0.32, porch - 30, porch - 14);
  // Two free-standing columns before the porch.
  for (const x of [-0.75, 0.75]) {
    const cz = 64;
    limeBox(x - 0.13, -0.02, x + 0.13, 0.24, base, base + 4);
    p.box(x - 0.09, 0.02, x + 0.09, 0.2, base + 4, base + cz, white, 0xf0e6d2, 0xc9bb9c);
    for (const dx of [-0.045, 0.0, 0.045]) p.line(0xe2d6bc, 1, [x + dx, 0.2, base + 6], [x + dx, 0.2, base + cz - 2], 0.9);
    p.box(x - 0.14, -0.03, x + 0.14, 0.25, base + cz, base + cz + 6, C.gold, shade(C.gold, 0.9), shade(C.gold, 0.68));
  }
  // Laver on its stand and a small rough-stone altar in the court.
  cylinder(p, 1.45, 0.9, 0.3, top, top + 9, 0xb8803e);
  p.disc(C.waterDeep, 1.45, 0.9, top + 9, 0.22);
  p.disc(C.waterLight, 1.4, 0.86, top + 9, 0.06, 0.8);
  rubble(p, -1.75, 0.6, -1.05, 1.3, top, top + 12, 0xd8ccb0, 9, 4);
  p.disc(0x3a2c20, -1.4, 0.95, top + 12, 0.18);
  p.ball(0xe8742c, -1.42, 0.95, top + 13, 1.8);
  // Front wall with the gatehouse, east wall and front towers.
  wall(-2.88, 2.0, -0.95, 2.22);
  wall(0.95, 2.0, 2.66, 2.22);
  limeBox(-0.95, 1.95, 0.95, 2.27, wallH + 2, wallH + 10);
  p.box(-0.99, 1.91, 0.99, 2.31, wallH + 10, wallH + 13, white, shade(white, 0.9), shade(white, 0.68));
  p.southQuad(C.gold, 2.271, -0.95, 0.95, wallH + 4, wallH + 6);
  tower(-0.95, 2.11, wallH + 18);
  tower(0.95, 2.11, wallH + 18);
  wall(2.66, -2.5, 2.88, 2.22);
  tower(-2.7, 2.11, wallH + 10);
  tower(2.7, 2.11, wallH + 10);
}

// ---------- effects and UI ----------

function flame(g: G) {
  g.fillStyle(0xe8742c);
  g.fillCircle(8, 15, 6.5);
  g.fillTriangle(1.8, 14, 14.2, 14, 8, 0);
  g.fillStyle(0xf6c84c);
  g.fillCircle(8, 16.5, 3.8);
  g.fillTriangle(4.4, 16, 11.6, 16, 8, 6);
  g.fillStyle(0xfff3c4);
  g.fillCircle(8, 18, 1.8);
}

function balloon(g: G) {
  g.fillStyle(C.shadow, 0.2);
  g.fillCircle(14, 14, 11);
  g.fillStyle(0xfffaf0);
  g.fillCircle(13, 12, 11);
  g.fillTriangle(9, 20, 17, 20, 13, 27);
  g.lineStyle(1.5, C.border, 0.6);
  g.strokeCircle(13, 12, 11);
}

/** Red "not allowed" sign: a ring with a diagonal bar. */
function noSign(g: G, x: number, y: number, r: number) {
  g.lineStyle(2.2, C.need.road);
  g.strokeCircle(x, y, r);
  g.lineBetween(x - r * 0.7, y - r * 0.7, x + r * 0.7, y + r * 0.7);
}

function needIcon(g: G, k: BalloonKind) {
  if (k === 'road') {
    // A dirt road broken in the middle, crossed out.
    g.fillStyle(C.road);
    g.fillPoints([{ x: 0, y: 14 }, { x: 4, y: 16 }, { x: 7, y: 13.5 }, { x: 3, y: 11.5 }], true);
    g.fillPoints([{ x: 9, y: 8.5 }, { x: 13, y: 10.5 }, { x: 16, y: 8 }, { x: 12, y: 6 }], true);
    noSign(g, 8, 11, 6.5);
  } else if (k === 'workers') {
    // A worker crossed out.
    g.fillStyle(C.skin[0]);
    g.fillCircle(8, 6, 2.6);
    g.fillStyle(C.clothes[1]);
    g.fillRoundedRect(4.5, 9, 7, 9, 2.5);
    noSign(g, 8, 11, 7);
  } else if (k === 'well') {
    g.fillStyle(C.need.well);
    g.fillCircle(8, 11, 5);
    g.fillTriangle(3.3, 9.5, 12.7, 9.5, 8, 2);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(6.3, 11, 1.4);
  } else if (k === 'market') {
    g.fillStyle(C.cream);
    g.fillRoundedRect(1, 3, 14, 12, 2);
    g.fillStyle(C.need.market);
    [1.5, 6.5, 11.5].forEach((x) => g.fillRect(x, 3, 3, 12));
  } else {
    flame(g);
  }
}

function walker(g: G, v: number) {
  const cloth = C.clothes[v];
  g.fillStyle(C.shadow, 0.25);
  g.fillEllipse(8, 19.5, 9, 3.5);
  figure(g, 6, 20, cloth, C.skin[v % C.skin.length], v % 2 === 0);
}

function figure(g: G, x: number, bottom: number, cloth: number, skin: number, scarf: boolean, scale = 1) {
  const s = scale;
  g.fillStyle(cloth);
  g.fillRoundedRect(x - 4 * s, bottom - 12 * s, 8 * s, 11 * s, 3 * s);
  g.fillStyle(shade(cloth, 0.75));
  g.fillRect(x - 4 * s, bottom - 7 * s, 8 * s, 1.5 * s);
  g.fillStyle(skin);
  g.fillCircle(x, bottom - 15 * s, 3.6 * s);
  g.fillStyle(scarf ? shade(cloth, 1.35) : 0x4a3523);
  g.fillEllipse(x, bottom - 17 * s, 7 * s, 3.5 * s);
}

function family(g: G) {
  g.fillStyle(C.shadow, 0.25);
  g.fillEllipse(16, 21, 28, 4);
  figure(g, 6, 21, C.clothes[1], C.skin[1], false);
  figure(g, 15, 21, C.clothes[0], C.skin[0], true);
  figure(g, 23, 21, C.clothes[2], C.skin[2], true, 0.7);
  g.fillStyle(C.fabric);
  g.fillCircle(15, 3, 3.5);
  g.lineStyle(1, shade(C.fabric, 0.7));
  g.strokeCircle(15, 3, 3.5);
}

function icons(scene: Phaser.Scene) {
  const icon = (name: Parameters<typeof TEX.icon>[0], draw: (g: G) => void) => makeFlat(scene, TEX.icon(name), 40, 40, draw);
  icon('view', (g) => {
    g.lineStyle(5, C.woodDark, 1);
    g.lineBetween(25, 25, 35, 35);
    g.fillStyle(0xd9eef7);
    g.fillCircle(17, 17, 11);
    g.lineStyle(4, C.ink, 1);
    g.strokeCircle(17, 17, 11);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(13, 13, 3);
  });
  icon('clear', (g) => {
    g.lineStyle(4, C.wood, 1);
    g.lineBetween(10, 34, 28, 10);
    g.fillStyle(C.rockLight);
    g.fillTriangle(22, 6, 36, 10, 30, 20);
    g.fillStyle(C.rockDark);
    g.fillTriangle(26, 12, 36, 10, 30, 20);
  });
  icon('road', (g) => {
    g.fillStyle(C.sand[0]);
    g.fillPoints([{ x: 20, y: 8 }, { x: 38, y: 20 }, { x: 20, y: 32 }, { x: 2, y: 20 }], true);
    g.fillStyle(C.road);
    g.fillPoints([{ x: 26, y: 12 }, { x: 32, y: 16 }, { x: 14, y: 28 }, { x: 8, y: 24 }], true);
    g.lineStyle(1, shade(C.road, 0.8));
    g.lineBetween(28, 14, 11, 26);
  });
  icon('silver', (g) => {
    g.fillStyle(0x8f949b);
    g.fillCircle(20, 21, 14);
    g.fillStyle(0xd3d7dc);
    g.fillCircle(20, 19, 14);
    g.lineStyle(2, 0x9aa0a8, 1);
    g.strokeCircle(20, 19, 9);
    g.fillStyle(0xffffff, 0.8);
    g.fillEllipse(15, 13, 6, 3);
  });
  icon('food', (g) => {
    g.fillStyle(shade(0xd8a35a, 0.75));
    g.fillEllipse(20, 24, 32, 18);
    g.fillStyle(0xd8a35a);
    g.fillEllipse(20, 21, 32, 18);
    g.lineStyle(2, shade(0xd8a35a, 0.7), 1);
    [12, 20, 28].forEach((x) => g.lineBetween(x - 2, 16, x + 2, 25));
  });
  icon('people', (g) => {
    figure(g, 26, 36, C.clothes[1], C.skin[0], false, 1.6);
    figure(g, 14, 36, C.clothes[0], C.skin[1], true, 1.6);
  });
  icon('work', (g) => {
    g.lineStyle(5, C.wood, 1);
    g.lineBetween(12, 34, 26, 14);
    g.fillStyle(C.rockDark);
    g.fillRoundedRect(17, 5, 20, 10, 2);
    g.fillStyle(C.rockLight);
    g.fillRect(17, 5, 20, 3);
  });
  icon('month', (g) => {
    g.fillStyle(C.cream);
    g.fillRoundedRect(6, 8, 28, 26, 4);
    g.fillStyle(C.red);
    g.fillRoundedRect(6, 8, 28, 9, { tl: 4, tr: 4, bl: 0, br: 0 });
    g.lineStyle(2, C.border, 1);
    g.strokeRoundedRect(6, 8, 28, 26, 4);
    g.fillStyle(C.ink);
    [[12, 22], [20, 22], [28, 22], [12, 28], [20, 28]].forEach(([x, y]) => g.fillRect(x - 1.5, y - 1.5, 3, 3));
  });
  icon('goal', (g) => {
    g.lineStyle(3, C.woodDark, 1);
    g.lineBetween(10, 6, 10, 36);
    g.fillStyle(C.red);
    g.fillTriangle(11, 7, 34, 13, 11, 20);
  });
}

export function generateTextures(scene: Phaser.Scene): void {
  for (let v = 0; v < VARIANTS; v++) {
    for (const g of ['sand', 'grass', 'river'] as Ground[]) make(scene, TEX.ground(g, v), TILE, (p) => groundTile(p, g, v));
    make(scene, TEX.feature('rock', v), SMALL, (p) => rock(p, v), 20);
    make(scene, TEX.feature('olive', v), SMALL, (p) => olive(p, v), 40);
    make(scene, TEX.feature('palm', v), SMALL, (p) => palm(p, v), 56);
  }
  for (let mask = 0; mask < 16; mask++) make(scene, TEX.road(mask), TILE, (p) => road(p, mask));
  // Every building is drawn at its real footprint: [draw, canvas height above ground, balloon height].
  const houses: [(p: Pen) => void, number, number][] = [[plot, 14, 12], [tent, 34, 30], [mudHouse, 40, 36], [stoneHouse, 58, 50], [bigHouse, 76, 64]];
  houses.forEach(([draw, top, h], level) => make(scene, TEX.building('house', level), footCanvas(2, 2, top), draw, h));
  const buildings: [BuildingKind, (p: Pen) => void, number, number][] = [
    ['field', field, 30, 26],
    ['well', well, 48, 44],
    ['market', (p) => market(p, false), 40, 36],
    ['workshop', workshop, 50, 50],
    ['altar', altar, 34, 44],
    ['temple', temple, 136, 128],
  ];
  buildings.forEach(([kind, draw, top, h]) => {
    const { w, h: d } = dimsOf(kind);
    make(scene, TEX.building(kind), footCanvas(w, d, top), draw, h);
  });
  const { w: mw, h: mh } = dimsOf('market', true);
  make(scene, TEX.building('market', 0, true), footCanvas(mw, mh, 40), (p) => market(p, true), 36);

  ORIGIN[TEX.wheat] = [0.5, 1];
  ORIGIN[TEX.flame] = [0.5, 1];
  ORIGIN[TEX.walker(0)] = [0.5, 1];
  const raw = (key: string, w: number, h: number, draw: (g: G) => void) => {
    if (scene.textures.exists(key)) return;
    const g = new Phaser.GameObjects.Graphics(scene);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  raw(TEX.wheat, 22, 22, wheat);
  raw(TEX.flame, 16, 22, flame);
  raw(TEX.soft, 32, 32, (g) => {
    for (let k = 5; k >= 1; k--) {
      g.fillStyle(0xffffff, (6 - k) / 15);
      g.fillCircle(16, 16, (16 * k) / 5);
    }
  });
  raw(TEX.ring, 64, 64, (g) => {
    g.lineStyle(6, 0xffffff, 0.35);
    g.strokeCircle(32, 32, 27);
    g.lineStyle(3, 0xffffff, 1);
    g.strokeCircle(32, 32, 27);
  });
  raw(TEX.balloon, 28, 28, balloon);
  (['road', 'well', 'market', 'sacred', 'workers'] as BalloonKind[]).forEach((k) => raw(TEX.need(k), 16, 22, (g) => needIcon(g, k)));
  for (let v = 0; v < WALKER_VARIANTS; v++) raw(TEX.walker(v), 16, 22, (g) => walker(g, v));
  raw(TEX.family, 30, 23, family);
  icons(scene);
}

/** Wheat tuft images over a field whose ground anchor is at (x, y), drawn at scale k (back to front). */
export function wheatImages(scene: Phaser.Scene, x = 0, y = 0, k = 1): Phaser.GameObjects.Image[] {
  return PARTS.wheat.map((w) =>
    scene.add
      .image(x + (w.x - w.y) * HW * k, y + ((w.x + w.y) * HH - w.z + 2) * k, TEX.wheat)
      .setOrigin(0.5, 1)
      .setScale(k),
  );
}

/** Applies a texture and its ground anchor to an image. */
export function setTex(img: Phaser.GameObjects.Image, key: string): Phaser.GameObjects.Image {
  const [ox, oy] = ORIGIN[key] ?? [0.5, 0.5];
  return img.setTexture(key).setOrigin(ox, oy);
}

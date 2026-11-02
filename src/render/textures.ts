/**
 * All art is generated here as named textures. To switch to sprite files later, load images
 * with the same keys (see TEX) and keep the anchors in ORIGIN / HEIGHT, then skip generateTextures().
 *
 * Drawing uses a tiny 3D pen: local grid units (x east, y south, tile = 1) plus z in pixels.
 * Light comes from the late-afternoon sun in the west: south faces (+y, left on screen) are lit,
 * east faces (+x, right on screen) are in shade, and shadows fall toward the east.
 */
import Phaser from 'phaser';
import { createRng, type BuildingKind, type Feature, type Ground, type NeedKind } from '../core';
import { HH, HW, TH, TW } from './iso';
import { C, shade } from './palette';

type G = Phaser.GameObjects.Graphics;
type P3 = [number, number, number?];

export const TEX = {
  ground: (g: Ground, v: number) => `ground-${g}-${v}`,
  road: (mask: number) => `road-${mask}`,
  feature: (f: Feature, v: number) => `${f}-${v}`,
  building: (kind: BuildingKind, level = 0) => (kind === 'house' ? `house-${level}` : kind),
  wheat: 'wheat',
  flame: 'flame',
  soft: 'soft',
  ring: 'ring',
  balloon: 'balloon',
  need: (k: NeedKind) => `need-${k}`,
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

/** Local grid offsets of wheat tufts inside a field, and of animated parts. */
export const PARTS = {
  wheat: [-0.27, 0, 0.27].flatMap((x) => [-0.27, 0, 0.27].map((y) => ({ x, y }))),
  chimney: { x: 0.19, y: -0.23, z: 42 },
  altarFire: { x: 0, y: 0, z: 22 },
};

const SHADOW_K = 0.022;
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
const LARGE = { w: 264, h: 208, ax: 110, ay: 128 };
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

// ---------- houses ----------

function plot(p: Pen) {
  p.rect(0xcfa874, -0.38, -0.38, 0.38, 0.38, 0, 0.9);
  const corners: P3[] = [[-0.38, -0.38], [0.38, -0.38], [0.38, 0.38], [-0.38, 0.38]];
  corners.forEach((c, k) => p.line(C.rope, 1.2, [c[0], c[1], 3], [corners[(k + 1) % 4][0], corners[(k + 1) % 4][1], 3]));
  corners.forEach(([x, y]) => p.box(x - 0.03, y - 0.03, x + 0.03, y + 0.03, 0, 6, C.wood));
  p.box(0.08, 0.08, 0.28, 0.2, 0, 4, C.mud);
  p.box(0.12, 0.1, 0.24, 0.18, 4, 7, shade(C.mud, 1.08));
}

/** Level 1: a tent of dark goat-hair cloth on poles, with guy ropes and a lighter door flap. */
function tent(p: Pen) {
  const h = 20;
  const cloth = C.tentCloth;
  p.shadow(-0.36, -0.32, 0.36, 0.32, h * 0.7);
  const corners: P3[] = [[-0.36, -0.32], [0.36, -0.32], [0.36, 0.32], [-0.36, 0.32]];
  corners.forEach(([x, y]) => p.line(C.rope, 1, [x * 0.7, y, h * 0.5], [x * 1.25, y * 1.3, 0]));
  p.poly(shade(cloth, 1.25), [[-0.36, -0.32, 0], [-0.36, 0.32, 0], [0, 0.32, h], [0, -0.32, h]]);
  p.poly(shade(cloth, 0.78), [[0, -0.32, h], [0, 0.32, h], [0.36, 0.32, 0], [0.36, -0.32, 0]]);
  // Woven strips of the cloth.
  for (const t of [0.25, 0.5, 0.75]) {
    p.line(shade(cloth, 1.45), 1.5, [-0.36 * (1 - t), -0.32, h * t], [-0.36 * (1 - t), 0.32, h * t], 0.55);
    p.line(shade(cloth, 0.6), 1.5, [0.36 * (1 - t), -0.32, h * t], [0.36 * (1 - t), 0.32, h * t], 0.6);
  }
  p.poly(shade(cloth, 1.1), [[-0.36, 0.32, 0], [0.36, 0.32, 0], [0, 0.32, h]]);
  p.poly(0x2a1f17, [[-0.1, 0.32, 0], [0.1, 0.32, 0], [0, 0.32, h * 0.62]]);
  p.poly(C.fabric, [[0.02, 0.32, 0], [0.14, 0.32, 0], [0.02, 0.32, h * 0.55]]);
  p.line(C.woodDark, 2, [0, -0.32, h], [0, 0.32, h]);
  p.line(C.wood, 2, [0, 0.33, 0], [0, 0.33, h + 3]);
  // Water jar and a mat by the door.
  p.ball(C.terracotta, -0.22, 0.42, 4, 3.2);
  p.ball(shade(C.terracotta, 1.25), -0.23, 0.41, 6, 1.2);
  p.rect(C.red, 0.12, 0.36, 0.3, 0.46, 0, 0.8);
}

/** Flat-roofed house body with a parapet and a door on the lit side. */
function house(p: Pen, s: number, h: number, color: number) {
  p.shadow(-s, -s, s, s, h);
  p.box(-s, -s, s, s, 0, h, shade(color, 1.08), color, shade(color, 0.68));
  const i = 0.06;
  p.rect(shade(color, 0.96), -s + i, -s + i, s - i, s - i, h);
  p.poly(shade(color, 0.85), [[-s + i, -s + i, h], [s - i, -s + i, h], [s - i, -s + i, h - 2], [-s + i, -s + i, h - 2]]);
  p.southQuad(C.door, s, -0.08, 0.08, 0, Math.min(14, h * 0.55));
}

function windows(p: Pen, s: number, z: number) {
  p.southQuad(C.door, s, -0.28 * s * 2.6, -0.18 * s * 2.6, z, z + 5);
  p.eastQuad(shade(C.door, 0.8), s, -0.1, 0.06, z, z + 5);
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

/** Clothesline between two posts on a roof at height z, with drying cloths. */
function clothesline(p: Pen, a: [number, number], b: [number, number], z: number, cloths: number[]) {
  p.line(C.woodDark, 1.5, [a[0], a[1], z], [a[0], a[1], z + 10]);
  p.line(C.woodDark, 1.5, [b[0], b[1], z], [b[0], b[1], z + 10]);
  p.line(C.rope, 1, [a[0], a[1], z + 10], [b[0], b[1], z + 10]);
  cloths.forEach((color, k) => {
    const t0 = (k + 0.4) / (cloths.length + 0.4);
    const t1 = t0 + 0.55 / (cloths.length + 0.4);
    const at = (t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const [x0, y0] = at(t0);
    const [x1, y1] = at(t1);
    p.poly(color, [[x0, y0, z + 10], [x1, y1, z + 10], [x1, y1, z + 4], [x0, y0, z + 5]]);
  });
}

/** Level 2: a small mud-brick house with roof beams and a jar on the roof. */
function mudHouse(p: Pen) {
  const s = 0.33;
  house(p, s, 22, C.mud);
  windows(p, s, 11);
  for (const x of [-0.24, -0.08, 0.08, 0.24]) p.southQuad(C.woodDark, s + 0.001, x, x + 0.04, 18, 20);
  p.rect(shade(C.mud, 0.8), -0.25, -0.25, -0.08, -0.08, 22);
  p.rect(C.red, -0.02, 0.05, 0.22, 0.2, 22, 0.85);
  p.disc(C.terracotta, 0.17, -0.17, 22, 0.07);
  p.ball(C.terracotta, 0.17, -0.17, 26, 3.2);
}

/**
 * Level 3: stone ground floor with mud brick above, a framed window, an outside stair up to the
 * flat roof, and a roof used for living (clothesline, jars, a potted plant).
 */
function stoneHouse(p: Pen) {
  const s = 0.36;
  const h = 30;
  const base = 13;
  p.shadow(-s, -s, s, s, h);
  p.box(-s, -s, s, s, 0, base, C.stone, shade(C.stone, 0.9), shade(C.stone, 0.62));
  masonry(p, -s, -s, s, s, 0, base, C.stone);
  p.box(-s, -s, s, s, base, h, shade(C.mud, 1.08), C.mud, shade(C.mud, 0.66));
  // Parapet and roof.
  const i = 0.05;
  p.rect(shade(C.mud, 0.92), -s + i, -s + i, s - i, s - i, h);
  p.poly(shade(C.mud, 0.78), [[-s + i, -s + i, h], [s - i, -s + i, h], [s - i, -s + i, h - 2], [-s + i, -s + i, h - 2]]);
  // Door with a stone lintel, framed window, small east window.
  p.southQuad(C.limestone, s + 0.002, -0.12, 0.04, 11, 14);
  p.southQuad(C.door, s + 0.002, -0.1, 0.02, 0, 11);
  p.southQuad(C.limestone, s + 0.002, 0.12, 0.28, 16, 25);
  p.southQuad(0x3a2818, s + 0.003, 0.14, 0.26, 17.5, 23.5);
  p.southQuad(C.woodDark, s + 0.004, 0.19, 0.21, 17.5, 23.5);
  p.eastQuad(shade(C.door, 0.7), s + 0.002, -0.08, 0.04, 18, 23);
  // Outside stair against the south face, rising toward the west corner.
  for (let k = 0; k < 5; k++) {
    const x0 = -s + (4 - k) * 0.045;
    const z = (k + 1) * (h / 5);
    p.box(x0, s, x0 + 0.045, s + 0.09, 0, z, shade(C.mud, 1.15), shade(C.mud, 0.92), shade(C.mud, 0.62));
    p.line(shade(C.mud, 1.3), 1, [x0, s + 0.09, z], [x0 + 0.045, s + 0.09, z]);
  }
  // Rooftop life.
  clothesline(p, [-0.24, -0.26], [0.24, -0.26], h, [C.clothes[1], C.cream, C.clothes[0]]);
  p.ball(C.terracotta, 0.22, 0.16, h + 4, 3.4);
  p.ball(shade(C.terracotta, 1.25), 0.21, 0.15, h + 6, 1.3);
  p.ball(C.terracotta, 0.12, 0.22, h + 3, 2.6);
  p.box(-0.06, 0.02, 0.06, 0.14, h, h + 4, C.terracotta);
  p.ball(C.leaf, 0, 0.08, h + 9, 5);
  p.ball(shade(C.leaf, 1.3), -0.02, 0.06, h + 11, 2);
}

/**
 * Level 4: a large two-storey "four-room house" of light limestone. A broad back range with an
 * upper floor, two side wings and a front wall with a gate enclose an open courtyard with a bread
 * oven and a fig tree.
 */
function bigHouse(p: Pen) {
  const s = 0.45;
  const wing = 22;
  const tall = 42;
  const wall = C.limeWash;
  const back = -0.08; // front edge of the back range
  const cx0 = -0.16; // courtyard west edge
  const cx1 = 0.17; // courtyard east edge
  const front = 0.34; // inner edge of the front wall
  p.shadow(-s, -s, s, back, tall);
  p.shadow(-s, back, s, s, wing);
  const roof = (x0: number, y0: number, x1: number, y1: number, z: number) => {
    const i = 0.04;
    p.rect(shade(wall, 0.9), x0 + i, y0 + i, x1 - i, y1 - i, z);
    p.poly(shade(wall, 0.75), [[x0 + i, y0 + i, z], [x1 - i, y0 + i, z], [x1 - i, y0 + i, z - 2], [x0 + i, y0 + i, z - 2]]);
  };
  // Back range: stone ground floor, plastered upper floor with windows.
  p.box(-s, -s, s, back, 0, tall, shade(wall, 1.04), shade(wall, 0.9), shade(wall, 0.64));
  masonry(p, -s, -s, s, back, 0, 16, shade(wall, 0.95), 0.6);
  roof(-s, -s, s, back, tall);
  for (const x of [-0.08, 0.06]) {
    p.southQuad(C.limestone, back + 0.002, x - 0.015, x + 0.075, 26, 35);
    p.southQuad(0x3a2818, back + 0.003, x, x + 0.06, 27, 34);
  }
  p.eastQuad(0x3a2818, s + 0.002, -0.32, -0.24, 27, 34);
  // Courtyard floor with oven, jar and fig tree.
  p.rect(shade(C.sand[0], 0.92), cx0, back, cx1, front);
  const oven = p.p(0.08, 0.02, 0);
  p.g.fillStyle(shade(C.mud, 0.8));
  p.g.fillEllipse(oven.x, oven.y - 3, 10, 8);
  p.g.fillStyle(C.mud);
  p.g.fillEllipse(oven.x - 1, oven.y - 4, 7, 5);
  p.ball(0x2a1f17, 0.08, 0.06, 2, 1.4);
  p.ball(C.terracotta, -0.08, 0.26, 3, 2.6);
  // West wing (its east face looks into the courtyard).
  p.box(-s, back, cx0, s, 0, wing, shade(wall, 1.04), shade(wall, 0.9), shade(wall, 0.7));
  masonry(p, -s, back, cx0, s, 0, 12, shade(wall, 0.95), 0.6);
  roof(-s, back, cx0, s, wing);
  p.eastQuad(C.door, cx0 + 0.002, 0.04, 0.14, 0, 12);
  p.southQuad(0x3a2818, s + 0.002, -0.36, -0.28, 13, 18);
  // Fig tree rising from the courtyard.
  const trunk = p.p(-0.02, 0.12, 0);
  p.g.lineStyle(3, C.trunk);
  p.g.lineBetween(trunk.x, trunk.y, trunk.x + 1, trunk.y - 16);
  for (const [dx, dy, r, col] of [[-5, -20, 7, C.oliveDark], [5, -21, 7, C.leaf], [0, -26, 7, C.leaf], [-3, -24, 3, shade(C.leaf, 1.3)]] as const) {
    p.g.fillStyle(col);
    p.g.fillCircle(trunk.x + dx, trunk.y + dy, r);
  }
  // Front wall with a gate.
  p.box(cx0, front, -0.06, s, 0, 14, wall, shade(wall, 0.9), shade(wall, 0.66));
  p.box(0.07, front, cx1, s, 0, 14, wall, shade(wall, 0.9), shade(wall, 0.66));
  p.box(-0.06, front, 0.07, s, 12, 16, C.limestone, shade(C.limestone, 0.88), shade(C.limestone, 0.66));
  p.southQuad(C.wood, s + 0.002, -0.06, 0.07, 0, 12);
  p.line(C.woodDark, 1, [0.005, s + 0.003, 0], [0.005, s + 0.003, 12]);
  // East wing.
  p.box(cx1, back, s, s, 0, wing, shade(wall, 1.04), shade(wall, 0.9), shade(wall, 0.66));
  masonry(p, cx1, back, s, s, 0, 12, shade(wall, 0.95), 0.6);
  roof(cx1, back, s, s, wing);
  p.southQuad(0x3a2818, s + 0.002, 0.26, 0.36, 13, 18);
  p.eastQuad(0x3a2818, s + 0.002, 0.1, 0.2, 13, 18);
  // Roof life: striped awning and clothesline up top, plants and jars on the wings.
  for (const [x, y] of [[0.4, -0.4], [0.4, -0.14]] as const) p.line(C.woodDark, 1.5, [x, y, tall], [x, y, tall + 10]);
  const stripes = 5;
  for (let k = 0; k < stripes; k++) {
    const y0 = -0.42 + (k * 0.3) / stripes;
    const y1 = y0 + 0.3 / stripes;
    p.poly(k % 2 ? C.cream : C.red, [[0.16, y0, tall + 13], [0.42, y0, tall + 9], [0.42, y1, tall + 9], [0.16, y1, tall + 13]]);
  }
  clothesline(p, [-0.38, -0.34], [-0.38, -0.12], tall, [C.clothes[3], C.clothes[2]]);
  p.ball(C.terracotta, -0.12, -0.3, tall + 3, 3);
  p.box(-0.37, 0.22, -0.27, 0.32, wing, wing + 4, C.terracotta);
  p.ball(C.leaf, -0.32, 0.27, wing + 9, 5);
  p.ball(shade(C.leaf, 1.3), -0.34, 0.25, wing + 11, 2);
  p.ball(C.terracotta, 0.3, 0.3, wing + 3, 2.8);
  p.ball(C.terracotta, 0.38, 0.22, wing + 3, 2.8);
}

// ---------- other buildings ----------

function field(p: Pen) {
  p.rect(C.soilDark, -0.46, -0.46, 0.46, 0.46);
  p.rect(C.soil, -0.43, -0.43, 0.43, 0.43);
  for (let x = -0.36; x < 0.4; x += 0.12) p.line(C.soilDark, 1.5, [x, -0.42], [x, 0.42], 0.8);
}

function wheat(g: G) {
  g.lineStyle(1.3, C.wheatStem, 1);
  const tips: [number, number][] = [[3, 6], [7, 3], [11, 6]];
  tips.forEach(([x, y]) => g.lineBetween(7, 18, x, y + 2));
  g.fillStyle(C.wheat);
  tips.forEach(([x, y]) => g.fillEllipse(x, y, 3.4, 7));
  g.fillStyle(shade(C.wheat, 1.3));
  tips.forEach(([x, y]) => g.fillEllipse(x - 0.6, y - 1, 1.2, 3.5));
}

function well(p: Pen) {
  const r = 0.27;
  const h = 10;
  p.shadow(-0.25, -0.25, 0.25, 0.25, 22, 0.2);
  const top = p.p(0, 0, h);
  const bottom = p.p(0, 0, 0);
  const w = r * 2 * SQRT2 * HW;
  const eh = r * 2 * SQRT2 * HH;
  p.g.fillStyle(shade(C.stone, 0.6));
  p.g.fillEllipse(bottom.x, bottom.y, w, eh);
  p.g.fillRect(bottom.x, top.y, w / 2, bottom.y - top.y);
  p.g.fillStyle(shade(C.stone, 0.85));
  p.g.fillRect(bottom.x - w / 2, top.y, w / 2, bottom.y - top.y);
  p.g.fillEllipse(bottom.x - w / 4, bottom.y, w / 2, eh * 0.9);
  p.g.fillStyle(C.stone);
  p.g.fillEllipse(top.x, top.y, w, eh);
  p.g.fillStyle(C.waterDeep);
  p.g.fillEllipse(top.x, top.y + 1, w * 0.66, eh * 0.62);
  p.g.fillStyle(C.waterLight, 0.8);
  p.g.fillEllipse(top.x - 4, top.y, w * 0.2, eh * 0.18);
  for (const [x, y] of [[-0.22, 0.22], [0.22, -0.22]] as const) p.box(x - 0.03, y - 0.03, x + 0.03, y + 0.03, 0, 28, C.wood);
  p.line(C.woodDark, 3, [-0.24, 0.24, 28], [0.24, -0.24, 28]);
  p.line(C.rope, 1, [0, 0, 27], [0, 0, 16]);
  p.box(-0.04, -0.04, 0.04, 0.04, 12, 17, C.wood);
}

function market(p: Pen) {
  p.shadow(-0.42, -0.42, 0.42, 0.25, 30, 0.2);
  const posts: [number, number][] = [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.18], [0.38, 0.18]];
  const post = ([x, y]: [number, number]) => p.box(x - 0.025, y - 0.025, x + 0.025, y + 0.025, 0, 30, C.wood);
  posts.slice(0, 2).forEach(post);
  p.box(-0.34, -0.3, 0.34, 0.12, 0, 11, C.wood);
  [[-0.2, 0xe8742c], [0, 0x8fae4a], [0.2, 0x8a4f8f]].forEach(([x, color]) => {
    p.ball(color, x, -0.05, 13, 2.5);
    p.ball(color, x + 0.06, -0.1, 13, 2.5);
  });
  posts.slice(2).forEach(post);
  const stripes = 6;
  for (let k = 0; k < stripes; k++) {
    const x0 = -0.44 + (k * 0.88) / stripes;
    const x1 = x0 + 0.88 / stripes;
    p.poly(k % 2 ? C.cream : C.red, [[x0, -0.44, 34], [x1, -0.44, 34], [x1, 0.24, 28], [x0, 0.24, 28]]);
    p.poly(shade(k % 2 ? C.cream : C.red, 0.85), [[x0, 0.24, 28], [x1, 0.24, 28], [x1, 0.24, 24], [x0, 0.24, 24]]);
  }
  [[-0.2, 0.36, 0xe8742c], [0.1, 0.38, 0x8fae4a]].forEach(([x, y, fruit]) => {
    p.disc(C.woodDark, x, y, 0, 0.09);
    p.box(x - 0.07, y - 0.07, x + 0.07, y + 0.07, 0, 5, C.wood);
    p.ball(fruit, x, y, 7, 2.2);
    p.ball(fruit, x + 0.04, y + 0.03, 7, 2.2);
  });
}

function workshop(p: Pen) {
  const s = 0.38;
  p.shadow(-s, -s, s, s, 30);
  p.box(-s, -s, s, s, 0, 24, 0xc9a06c, 0xb88752, 0x8d6539);
  for (let y = -0.3; y < 0.35; y += 0.12) p.line(shade(0xc9a06c, 0.85), 1, [-0.34, y, 24], [0.34, y, 24], 0.8);
  const { x, y } = PARTS.chimney;
  p.box(x - 0.07, y - 0.07, x + 0.07, y + 0.07, 24, 40, C.rock, shade(C.rock, 0.9), C.rockDark);
  p.rect(0x3a2c20, x - 0.04, y - 0.04, x + 0.04, y + 0.04, 40);
  p.southQuad(0x3a2c20, s, -0.16, 0.16, 0, 14);
  const glow = p.p(0, s, 4);
  for (let k = 3; k >= 1; k--) {
    p.g.fillStyle(0xf08a32, 0.25 * (4 - k));
    p.g.fillCircle(glow.x, glow.y, k * 2.5);
  }
  for (const [lx, ly, lz] of [[0.42, -0.2, 3], [0.42, -0.06, 3], [0.42, -0.13, 9]] as const) {
    const c = p.p(lx, ly, lz);
    p.g.fillStyle(C.woodDark);
    p.g.fillCircle(c.x, c.y, 3.5);
    p.g.fillStyle(C.wood);
    p.g.fillCircle(c.x, c.y, 2);
  }
}

function altar(p: Pen) {
  p.rect(shade(C.stone, 0.9), -0.5, -0.5, 0.5, 0.5);
  for (let k = -0.25; k <= 0.25; k += 0.25) {
    p.line(shade(C.stone, 0.75), 1, [k, -0.5], [k, 0.5], 0.6);
    p.line(shade(C.stone, 0.75), 1, [-0.5, k], [0.5, k], 0.6);
  }
  p.shadow(-0.36, -0.36, 0.36, 0.36, 22);
  p.box(-0.36, -0.36, 0.36, 0.36, 0, 8, C.limestone);
  p.box(-0.26, -0.26, 0.26, 0.26, 8, 20, C.stone);
  for (const [x, y] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]] as const) {
    p.box(x - 0.04, y - 0.04, x + 0.04, y + 0.04, 20, 26, shade(C.stone, 1.05));
  }
  p.disc(0x4a3a2a, 0, 0, 20, 0.15);
  p.ball(0xe8742c, -0.05, 0.03, 21, 1.6);
  p.ball(0xe8742c, 0.06, -0.02, 21, 1.6);
}

/** The temple (3x3): platform, thick walls, inner columns, a tall sanctuary with a columned porch. */
function temple(p: Pen) {
  const top = 10;
  p.shadow(-0.9, -1.3, 0.9, 0.2, 64, 0.22);
  p.shadow(-1.45, -1.45, 1.45, 1.45, 16, 0.2);
  p.box(-1.45, -1.45, 1.45, 1.15, 0, top, C.limestone, shade(C.limestone, 0.88), shade(C.limestone, 0.66));
  // Courtyard paving.
  for (let k = -1.1; k < 1.1; k += 0.3) {
    p.line(shade(C.limestone, 0.86), 1, [k, -1.3, top], [k, 1.0, top], 0.6);
    p.line(shade(C.limestone, 0.86), 1, [-1.3, k, top], [1.3, k, top], 0.6);
  }
  // Front stairs (bottom step first so upper steps sit on it).
  for (let k = 2; k >= 0; k--) p.box(-0.5, 1.15, 0.5, 1.15 + (k + 1) * 0.1, 0, top - k * 3.3, shade(C.limestone, 1.02));

  const parts: { key: number; draw: () => void }[] = [];
  const add = (gx: number, gy: number, draw: () => void) => parts.push({ key: gx + gy, draw });
  const wallH = top + 14;
  const wall = (x0: number, y0: number, x1: number, y1: number) =>
    add((x0 + x1) / 2, (y0 + y1) / 2, () => {
      p.box(x0, y0, x1, y1, top, wallH, C.stone);
      p.rect(shade(C.stone, 1.12), x0, y0, x1, y1, wallH);
    });
  wall(-1.42, -1.42, 1.42, -1.28); // back
  wall(-1.42, -1.28, -1.28, 1.12); // west
  wall(1.28, -1.28, 1.42, 1.12); // east
  wall(-1.42, 0.98, -0.42, 1.12); // front left
  wall(0.42, 0.98, 1.42, 1.12); // front right
  for (const [x, y] of [[-1.42, -1.42], [1.24, -1.42], [-1.42, 0.94], [1.24, 0.94]] as const) {
    add(x + 0.09, y + 0.09, () => {
      p.box(x, y, x + 0.18, y + 0.18, top, wallH + 10, C.limestone);
      p.rect(C.gold, x + 0.03, y + 0.03, x + 0.15, y + 0.15, wallH + 10);
    });
  }
  const column = (x: number, y: number, h: number) =>
    add(x, y, () => {
      p.box(x - 0.05, y - 0.05, x + 0.05, y + 0.05, top, top + h, 0xfbf6ea, 0xf0e6d2, 0xc9bb9c);
      p.box(x - 0.08, y - 0.08, x + 0.08, y + 0.08, top + h, top + h + 3, C.limestone);
    });
  for (const y of [-0.8, -0.3, 0.2, 0.7]) {
    column(-1.1, y, 22);
    column(1.1, y, 22);
  }
  // Sanctuary with a gold-trimmed roof and a columned porch.
  add(0, -0.5, () => {
    const h = top + 52;
    p.box(-0.62, -1.15, 0.62, -0.05, top, h, C.limestone, shade(C.limestone, 0.9), shade(C.limestone, 0.66));
    p.box(-0.66, -1.19, 0.66, -0.01, h, h + 3, C.gold, shade(C.gold, 0.9), shade(C.gold, 0.7));
    p.rect(shade(C.limestone, 0.95), -0.56, -1.09, 0.56, -0.11, h + 3);
    p.southQuad(shade(C.gold, 0.8), -0.05, -0.16, 0.16, top, top + 30);
    p.southQuad(C.door, -0.05, -0.12, 0.12, top, top + 26);
    p.box(-0.62, -0.05, 0.62, 0.35, top, top + 2, shade(C.limestone, 1.04));
    for (const [x, y] of [[-0.56, -1.13], [0.5, -1.13], [-0.56, -0.13], [0.5, -0.13]] as const) {
      p.box(x, y, x + 0.06, y + 0.06, h + 3, h + 9, C.gold);
    }
  });
  for (const x of [-0.5, -0.17, 0.17, 0.5]) column(x, 0.28, 40);
  add(0, 0.28, () => p.box(-0.6, 0.2, 0.6, 0.36, top + 43, top + 48, C.limestone));
  // Bronze basin in the courtyard.
  add(0.75, 0.55, () => {
    p.box(0.65, 0.45, 0.85, 0.65, top, top + 7, 0xb8803e, 0xa86f32, 0x7f5224);
    p.rect(C.waterDeep, 0.69, 0.49, 0.81, 0.61, top + 7);
  });
  parts.sort((a, b) => a.key - b.key).forEach((part) => part.draw());
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

function needIcon(g: G, k: NeedKind) {
  if (k === 'road') {
    g.fillStyle(C.road);
    g.fillPoints([{ x: 8, y: 4 }, { x: 16, y: 9 }, { x: 8, y: 14 }, { x: 0, y: 9 }], true);
    g.lineStyle(2.5, C.need.road);
    g.lineBetween(3, 4, 13, 15);
    g.lineBetween(13, 4, 3, 15);
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
  const houses: [(p: Pen) => void, number][] = [[plot, 6], [tent, 22], [mudHouse, 26], [stoneHouse, 44], [bigHouse, 56]];
  houses.forEach(([draw, h], level) => make(scene, TEX.building('house', level), SMALL, draw, h));
  const buildings: [BuildingKind, (p: Pen) => void, number][] = [
    ['field', field, 14],
    ['well', well, 30],
    ['market', market, 34],
    ['workshop', workshop, 42],
    ['altar', altar, 28],
  ];
  buildings.forEach(([kind, draw, h]) => make(scene, TEX.building(kind), SMALL, draw, h));
  make(scene, TEX.building('temple'), LARGE, temple, 80);

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
  raw(TEX.wheat, 14, 19, wheat);
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
  (['road', 'well', 'market', 'sacred'] as NeedKind[]).forEach((k) => raw(TEX.need(k), 16, 22, (g) => needIcon(g, k)));
  for (let v = 0; v < WALKER_VARIANTS; v++) raw(TEX.walker(v), 16, 22, (g) => walker(g, v));
  raw(TEX.family, 30, 23, family);
  icons(scene);
}

/** Applies a texture and its ground anchor to an image. */
export function setTex(img: Phaser.GameObjects.Image, key: string): Phaser.GameObjects.Image {
  const [ox, oy] = ORIGIN[key] ?? [0.5, 0.5];
  return img.setTexture(key).setOrigin(ox, oy);
}

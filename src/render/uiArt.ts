/**
 * Interface art drawn on 2D canvases: round-button thumbnails of the buildings and of the build-menu
 * categories (made from the same textures as the map), the line icons of the interface and the mouse
 * hand cursor. Call generateUiArt() after generateTextures(). Like textures.ts, every piece is a named
 * texture (see TEX.thumb, TEX.categoryThumb, TEX.uiIcon), so it can be swapped for image files later.
 */
import type Phaser from 'phaser';
import { type BuildableKind, type BuildingCategory } from '../core';
import { HH, HW } from './iso';
import { C } from './palette';
import { GRANARY_STOCKS, ORIGIN, PARTS, TEX, type UiIcon } from './textures';

/** Side of the thumbnail textures: enough for a ~80 px button on PC (shown scaled down). */
export const THUMB = 128;
/** Side of the line icon textures. */
export const ICON = 64;

type Ctx = CanvasRenderingContext2D;
const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

function canvas(w: number, h = w): [HTMLCanvasElement, Ctx] {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return [cv, cv.getContext('2d')!];
}

/** A canvas texture drawn once, anchored at its center. */
function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void) {
  ORIGIN[key] = [0.5, 0.5];
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  draw(tex.getContext());
  tex.refresh();
}

/** Draws a texture with its anchor at (x, y), at a scale. */
function stamp(ctx: Ctx, scene: Phaser.Scene, key: string, x: number, y: number, k = 1) {
  const src = scene.textures.get(key).getSourceImage() as HTMLCanvasElement;
  const [ox, oy] = ORIGIN[key] ?? [0.5, 0.5];
  const w = src.width * k;
  const h = src.height * k;
  ctx.drawImage(src, x - ox * w, y - oy * h, w, h);
}

// ---------- building thumbnails ----------

/**
 * How a thumbnail frames a map texture: the square of side `size` centered at (cx, cy), in pixels of
 * the texture from its ground anchor. Some crop in to make the telling part bigger (the field rows,
 * the market awnings); `extra` adds what the small size needs (the field's crops, a bigger bucket).
 */
interface Shot {
  key: string;
  cx: number;
  cy: number;
  size: number;
  extra?: (ctx: Ctx, scene: Phaser.Scene) => void;
}

/** The field's crop tufts, drawn a little bigger than on the map so the rows of wheat read. */
function fieldCrops(ctx: Ctx, scene: Phaser.Scene) {
  for (const w of PARTS.wheat) stamp(ctx, scene, TEX.crop(0), (w.x - w.y) * HW, (w.x + w.y) * HH - w.z + 2, 1.3);
}

/** Smoke rising from the pottery kiln chimney. */
function kilnSmoke(ctx: Ctx) {
  const { x, y, z } = PARTS.craftFire.pottery!.smoke;
  const sx = (x - y) * HW;
  const sy = (x + y) * HH - z;
  for (const [dx, dy, r, a] of [[2, -8, 6, 0.85], [6, -19, 8, 0.7], [12, -32, 10, 0.5]]) {
    ctx.fillStyle = `rgba(232, 228, 220, ${a})`;
    ctx.beginPath();
    ctx.arc(sx + dx, sy + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

const SHOTS: Record<BuildableKind, Shot> = {
  // The stone house with a mud-brick upper floor, its outside stair and jars on the roof.
  house: { key: TEX.building('house', 3), cx: 0, cy: -20, size: 118 },
  field: { key: TEX.building('field', 0), cx: 0, cy: -10, size: 128, extra: fieldCrops },
  plaza: { key: TEX.building('plaza'), cx: 0, cy: -16, size: 92 },
  // The middle of the two rows of stalls, the striped awnings filling the circle.
  market: { key: TEX.building('market'), cx: 0, cy: -18, size: 120 },
  // The potter: domed kiln with smoke, workroom and rows of jars.
  workshop: { key: TEX.building('workshop', 0, false, 0), cx: 4, cy: -30, size: 176, extra: kilnSmoke },
  park: { key: TEX.building('park'), cx: 0, cy: -20, size: 128 },
  // The full granary: domed silos, the stone storehouse and sacks piled in the yard.
  granary: { key: TEX.building('granary', 0, false, GRANARY_STOCKS - 1), cx: 8, cy: -16, size: 150 },
  // The net drying on its poles and the boat pulled up in front.
  fisher: { key: TEX.building('fisher'), cx: 6, cy: -10, size: 100 },
  // Baskets heaped with olives, figs and dates in front of the hut.
  gatherer: { key: TEX.building('gatherer'), cx: 6, cy: -6, size: 92 },
  // Placeholders until the lumber and quarry art.
  lumber: { key: TEX.building('lumber'), cx: 6, cy: -6, size: 92 },
  quarry: { key: TEX.building('quarry'), cx: 6, cy: -10, size: 100 },
  // The sanctuary, white and gold, framed by the court walls.
  temple: { key: TEX.building('temple'), cx: 0, cy: -40, size: 320 },
};

/** Food: the field with its crops. */
const supplyShot: Shot = SHOTS.field;

const CATEGORY_SHOTS: Record<BuildingCategory, Shot> = {
  home: SHOTS.house,
  supply: supplyShot,
  work: SHOTS.market,
  special: SHOTS.temple,
};

/** The framed drawing of a shot, before the outline and the round crop. */
function shotArt(scene: Phaser.Scene, shot: Shot): HTMLCanvasElement {
  const [cv, ctx] = canvas(THUMB);
  const k = THUMB / shot.size;
  ctx.imageSmoothingQuality = 'high';
  ctx.setTransform(k, 0, 0, k, THUMB / 2 - shot.cx * k, THUMB / 2 - shot.cy * k);
  stamp(ctx, scene, shot.key, 0, 0);
  shot.extra?.(ctx, scene);
  return cv;
}

const OUTLINE = 2;
const OUTLINE_ALPHA = 0.55;

/** A soft dark outline around the drawing (so pale stone reads on a pale button), clipped to a circle. */
function finishThumb(ctx: Ctx, art: HTMLCanvasElement) {
  const [sil, s] = canvas(THUMB);
  s.drawImage(art, 0, 0);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = css(C.ui.thumbOutline);
  s.fillRect(0, 0, THUMB, THUMB);
  const [ring, r] = canvas(THUMB);
  for (let a = 0; a < 8; a++) r.drawImage(sil, Math.round(Math.cos((a * Math.PI) / 4) * OUTLINE), Math.round(Math.sin((a * Math.PI) / 4) * OUTLINE));
  ctx.globalAlpha = OUTLINE_ALPHA;
  ctx.drawImage(ring, 0, 0);
  ctx.globalAlpha = 1;
  ctx.drawImage(art, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath();
  ctx.arc(THUMB / 2, THUMB / 2, THUMB / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

/** Locked look: the colours turned to a light grey and faded. */
function greyOut(ctx: Ctx, from: HTMLCanvasElement) {
  ctx.drawImage(from, 0, 0);
  const img = ctx.getImageData(0, 0, THUMB, THUMB);
  const d = img.data;
  const g0 = C.ui.lockedGrey;
  const base = [(g0 >> 16) & 255, (g0 >> 8) & 255, g0 & 255];
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
    for (let c = 0; c < 3; c++) d[i + c] = Math.round(base[c] * (0.7 + lum * 0.55));
    d[i + 3] = Math.round(d[i + 3] * 0.7);
  }
  ctx.putImageData(img, 0, 0);
}

function makeThumbs(scene: Phaser.Scene, shot: Shot, key: string, lockedKey: string) {
  if (!scene.textures.exists(shot.key) || scene.textures.exists(key)) return;
  const [done, d] = canvas(THUMB);
  finishThumb(d, shotArt(scene, shot));
  canvasTexture(scene, key, THUMB, THUMB, (ctx) => ctx.drawImage(done, 0, 0));
  canvasTexture(scene, lockedKey, THUMB, THUMB, (ctx) => greyOut(ctx, done));
}

// ---------- line icons ----------

/** Rounded rectangle path. */
function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A rounded rectangle turned by `a` around (x, y) (given relative to that point). */
function turned(x: number, y: number, a: number, rx: number, ry: number, w: number, h: number, r: number) {
  return (ctx: Ctx) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    rr(ctx, rx, ry, w, h, r);
    ctx.restore();
  };
}

type Part = (ctx: Ctx) => void;

/**
 * The outline of the union of some shapes, `width` thick outside them. Without `fill` the inside is
 * cut out (a line icon on any button); gaps between shapes stay as dark lines (between fingers).
 */
function outlined(ctx: Ctx, parts: Part[], line: string, width: number, fill: string | null = null) {
  ctx.lineJoin = 'round';
  ctx.fillStyle = line;
  ctx.strokeStyle = line;
  ctx.lineWidth = width * 2;
  for (const p of parts) {
    ctx.beginPath();
    p(ctx);
    ctx.fill();
    ctx.stroke();
  }
  if (fill) ctx.fillStyle = fill;
  else ctx.globalCompositeOperation = 'destination-out';
  for (const p of parts) {
    ctx.beginPath();
    p(ctx);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** An open hand (fingers apart) in a 64 x 64 box. */
const OPEN_HAND: Part[] = [
  ...[[16, 15], [26, 9], [36, 11], [46, 17]].map(([x, top]) => (ctx: Ctx) => rr(ctx, x, top, 7, 36 - top, 3.5)),
  (ctx) => rr(ctx, 14, 30, 41, 25, 11),
  turned(14, 38, -0.6, -4, -11, 8, 20, 4),
];

/** A closed hand (dragging): curled fingers on top of the palm, the thumb across. */
const GRAB_HAND: Part[] = [
  ...[16, 26, 36, 46].map((x) => (ctx: Ctx) => rr(ctx, x, 20, 8, 16, 4)),
  (ctx) => rr(ctx, 13, 27, 43, 27, 11),
];

function grabDetails(ctx: Ctx, line: string, width: number) {
  ctx.strokeStyle = line;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(17, 40);
  ctx.quadraticCurveTo(28, 44, 38, 37);
  ctx.stroke();
}

const W = 5;

const ICONS: Record<UiIcon, (ctx: Ctx, line: string) => void> = {
  hand: (ctx, line) => outlined(ctx, OPEN_HAND, line, 4),
  handGrab: (ctx, line) => {
    outlined(ctx, GRAB_HAND, line, 4);
    grabDetails(ctx, line, 4);
  },
  // A road going away: its two edges and the dashes down the middle.
  road: (ctx, line) => {
    ctx.strokeStyle = line;
    ctx.lineCap = 'round';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(25, 9);
    ctx.lineTo(9, 56);
    ctx.moveTo(39, 9);
    ctx.lineTo(55, 56);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (const [a, b] of [[12, 17], [26, 34], [43, 54]]) {
      ctx.moveTo(32, a);
      ctx.lineTo(32, b);
    }
    ctx.stroke();
  },
  hammer: (ctx, line) =>
    outlined(ctx, [turned(28, 36, Math.PI / 4, -3.5, -14, 7, 36, 3.5), turned(28, 36, Math.PI / 4, -13, -26, 26, 12, 3)], line, 4),
  flag: (ctx, line) => {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.fillStyle = css(C.red);
    ctx.strokeStyle = line;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(18, 10);
    ctx.quadraticCurveTo(36, 4, 52, 14);
    ctx.quadraticCurveTo(44, 22, 52, 32);
    ctx.quadraticCurveTo(36, 24, 18, 34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = W;
    ctx.beginPath();
    ctx.moveTo(16, 8);
    ctx.lineTo(16, 58);
    ctx.stroke();
  },
  // Warning triangle: gold inside, the "!" always in ink so it reads on the gold.
  alert: (ctx, line) => {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.fillStyle = css(C.gold);
    ctx.strokeStyle = line;
    ctx.lineWidth = W;
    ctx.beginPath();
    ctx.moveTo(32, 8);
    ctx.lineTo(58, 54);
    ctx.lineTo(6, 54);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = css(C.ink);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(32, 24);
    ctx.lineTo(32, 38);
    ctx.stroke();
    ctx.fillStyle = css(C.ink);
    ctx.beginPath();
    ctx.arc(32, 46, 3.6, 0, Math.PI * 2);
    ctx.fill();
  },
  stats: (ctx, line) => {
    ctx.strokeStyle = line;
    ctx.lineCap = 'round';
    ctx.lineWidth = W;
    ctx.beginPath();
    ctx.moveTo(8, 56);
    ctx.lineTo(56, 56);
    ctx.stroke();
    ctx.lineWidth = 8;
    ctx.beginPath();
    for (const [x, top] of [[18, 38], [32, 14], [46, 28]]) {
      ctx.moveTo(x, 48);
      ctx.lineTo(x, top);
    }
    ctx.stroke();
  },
  gear: (ctx, line) => {
    const teeth: Part[] = Array.from({ length: 8 }, (_, k) => turned(32, 32, (k * Math.PI) / 4, -5, -24, 10, 10, 2));
    outlined(ctx, [...teeth, (c) => c.arc(32, 32, 17, 0, Math.PI * 2)], line, 4);
    ctx.strokeStyle = line;
    ctx.lineWidth = W;
    ctx.beginPath();
    ctx.arc(32, 32, 7, 0, Math.PI * 2);
    ctx.stroke();
  },
  pause: (ctx, line) => {
    ctx.fillStyle = line;
    ctx.beginPath();
    rr(ctx, 17, 14, 11, 36, 3);
    rr(ctx, 36, 14, 11, 36, 3);
    ctx.fill();
  },
  play: (ctx, line) => {
    ctx.fillStyle = line;
    ctx.strokeStyle = line;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(22, 15);
    ctx.lineTo(48, 32);
    ctx.lineTo(22, 49);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  },
  lock: (ctx, line) => {
    ctx.strokeStyle = line;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(21, 32);
    ctx.lineTo(21, 24);
    ctx.arc(32, 24, 11, Math.PI, 0);
    ctx.lineTo(43, 32);
    ctx.stroke();
    ctx.fillStyle = line;
    ctx.beginPath();
    rr(ctx, 14, 29, 36, 27, 5);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(32, 40, 4.5, 0, Math.PI * 2);
    rr(ctx, 30, 41, 4, 9, 1.5);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  },
};

const TONES = { dark: C.ink, light: C.ui.iconLight } as const;

// ---------- mouse cursor ----------

const CURSOR = 32;
const cursors: Partial<Record<'open' | 'grab', string>> = {};

/** CSS cursor of the hand (filled light with an ink outline), drawn once. */
function cursorCss(mode: 'open' | 'grab'): string {
  if (!cursors[mode]) {
    const [cv, ctx] = canvas(CURSOR);
    ctx.scale(CURSOR / ICON, CURSOR / ICON);
    outlined(ctx, mode === 'open' ? OPEN_HAND : GRAB_HAND, css(C.ink), 5, css(C.ui.cursorFill));
    if (mode === 'grab') grabDetails(ctx, css(C.ink), 4);
    cursors[mode] = `url(${cv.toDataURL()}) ${CURSOR / 2} ${CURSOR / 2}, ${mode === 'open' ? 'grab' : 'grabbing'}`;
  }
  return cursors[mode]!;
}

/** The mouse cursor over the map: the open hand (Mover), the closed hand while dragging, or the default. */
export function setHandCursor(scene: Phaser.Scene, mode: 'open' | 'grab' | null) {
  scene.input.setDefaultCursor(mode ? cursorCss(mode) : 'default');
}

// ---------- all ----------

/** Draws the thumbnails and icons (once; later calls do nothing). Needs generateTextures() first. */
export function generateUiArt(scene: Phaser.Scene) {
  for (const kind of Object.keys(SHOTS) as BuildableKind[]) makeThumbs(scene, SHOTS[kind], TEX.thumb(kind), TEX.thumbLocked(kind));
  for (const c of Object.keys(CATEGORY_SHOTS) as BuildingCategory[]) makeThumbs(scene, CATEGORY_SHOTS[c], TEX.categoryThumb(c), TEX.categoryThumbLocked(c));
  for (const name of Object.keys(ICONS) as UiIcon[])
    for (const tone of ['dark', 'light'] as const) canvasTexture(scene, TEX.uiIcon(name, tone), ICON, ICON, (ctx) => ICONS[name](ctx, css(TONES[tone])));
}

/**
 * All art is generated here as named textures. To switch to sprite files later,
 * load images with the same keys (see TEX) in a preload step and skip generateTextures().
 */
import Phaser from 'phaser';
import { createRng, type BuildingKind, type ServiceKind } from '../core';
import { CELL } from './layout';
import { C, shade } from './palette';

type G = Phaser.GameObjects.Graphics;

/** Building textures are one cell wide and have extra headroom above the cell. */
export const HEADROOM = 12;
export const BW = CELL;
export const BH = CELL + HEADROOM;

export const TEX = {
  grass: (v: number) => `grass-${v}`,
  valley: (v: number) => `valley-${v}`,
  rock: (v: number) => `rock-${v}`,
  tree: (v: number) => `tree-${v}`,
  house: (level: number) => `house-${level}`,
  building: (kind: BuildingKind, level = 0) => (kind === 'house' ? `house-${level}` : kind),
  wheat: 'wheat',
  flame: 'flame',
  soft: 'soft',
  ring: 'ring',
  balloon: 'balloon',
  need: (k: ServiceKind) => `need-${k}`,
  walker: (v: number) => `walker-${v}`,
  icon: (name: 'view' | 'clear' | 'silver' | 'food' | 'people' | 'work' | 'month' | 'goal') => `icon-${name}`,
};
export const GRASS_VARIANTS = 4;
export const WALKER_VARIANTS = 6;

/** Offsets (from a building's bottom-center anchor) used by animations. */
export const ANCHORS = {
  chimney: { x: 11.5, y: -52 },
  altarFire: { x: 0, y: -28 },
  wheat: [-12, 0, 12].flatMap((x) => [-34, -22, -10].map((y) => ({ x, y }))),
  balloonY: -38,
};

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void, headroom = 0) {
  if (scene.textures.exists(key)) return;
  const g = new Phaser.GameObjects.Graphics(scene);
  g.translateCanvas(0, headroom);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

// ---------- helpers (coordinates are cell-local: 0..48, headroom above is negative y) ----------

function softShadowBox(g: G, x: number, y: number, w: number, h: number) {
  for (let k = 2; k >= 0; k--) {
    g.fillStyle(C.shadow, 0.06 + (2 - k) * 0.04);
    g.fillRoundedRect(x + 3 - k, y + 3 - k, w + 2 * k, h + 2 * k, 4 + k);
  }
}

function softShadowEllipse(g: G, cx: number, cy: number, w: number, h: number) {
  for (let k = 2; k >= 0; k--) {
    g.fillStyle(C.shadow, 0.06 + (2 - k) * 0.04);
    g.fillEllipse(cx, cy, w + k * 4, h + k * 3);
  }
}

/** Flat-roofed block: roof seen from above plus the front wall below it. */
function block(g: G, x: number, y: number, w: number, roofH: number, wallH: number, roof: number, wall: number) {
  softShadowBox(g, x, y + 2, w, roofH + wallH);
  g.fillStyle(wall);
  g.fillRoundedRect(x, y + roofH - 4, w, wallH + 4, 3);
  g.fillStyle(shade(wall, 0.82));
  g.fillRect(x + 1, y + roofH + wallH - 2, w - 2, 2);
  g.fillStyle(roof);
  g.fillRoundedRect(x, y, w, roofH, 3);
  g.fillStyle(shade(roof, 1.25));
  g.fillRect(x + 2, y + 1, w - 4, 2);
  g.fillStyle(shade(roof, 0.86));
  g.fillRect(x + 1, y + roofH - 2, w - 2, 2);
}

/** Inner darker floor that makes the roof edge read as a parapet. */
function parapet(g: G, x: number, y: number, w: number, h: number, roof: number) {
  g.fillStyle(shade(roof, 0.92));
  g.fillRoundedRect(x, y, w, h, 2);
  g.fillStyle(shade(roof, 0.84));
  g.fillRect(x, y, w, 1.5);
}

function archDoor(g: G, x: number, y: number, w: number, h: number, color = C.door) {
  g.fillStyle(color);
  g.fillRect(x, y + w / 2, w, h - w / 2);
  g.fillCircle(x + w / 2, y + w / 2, w / 2);
}

function windows(g: G, xs: number[], y: number, w = 5, h = 4) {
  g.fillStyle(C.window);
  xs.forEach((x) => g.fillRoundedRect(x, y, w, h, 1));
}

function stoneLines(g: G, x: number, y: number, w: number, h: number, color: number) {
  g.lineStyle(1, shade(color, 0.85), 0.8);
  const mid = y + h / 2;
  g.lineBetween(x + 1, mid, x + w - 1, mid);
  for (let xx = x + 5; xx < x + w - 2; xx += 9) {
    g.lineBetween(xx, y + 1, xx, mid);
    g.lineBetween(xx + 4, mid, xx + 4, y + h - 2);
  }
}

function softCircle(g: G, cx: number, cy: number, r: number, color: number, alpha = 1) {
  for (let k = 5; k >= 1; k--) {
    g.fillStyle(color, (alpha * (6 - k)) / 15);
    g.fillCircle(cx, cy, (r * k) / 5);
  }
}

// ---------- ground ----------

function grass(g: G, v: number) {
  const base = C.grass[v];
  const r = createRng(100 + v);
  g.fillStyle(base);
  g.fillRect(0, 0, CELL, CELL);
  for (let i = 0; i < 4; i++) {
    g.fillStyle(shade(base, r() < 0.5 ? 0.96 : 1.06), 0.6);
    g.fillCircle(10 + r() * 28, 10 + r() * 28, 5 + r() * 6);
  }
  for (let i = 0; i < 3 + (v % 2); i++) {
    const x = 6 + r() * 36;
    const y = 10 + r() * 32;
    g.lineStyle(1.5, r() < 0.7 ? C.tuft : C.tuftLight, 0.9);
    g.lineBetween(x, y, x - 2.5, y - 5);
    g.lineBetween(x, y, x, y - 6);
    g.lineBetween(x, y, x + 2.5, y - 5);
  }
  if (v === 3) {
    g.fillStyle(0xfdf6e3);
    g.fillCircle(14, 34, 1.6);
    g.fillCircle(33, 15, 1.6);
    g.fillStyle(C.gold);
    g.fillCircle(36, 38, 1.6);
  }
}

function valley(g: G, v: number) {
  const base = C.valley[v];
  const r = createRng(200 + v);
  g.fillStyle(base);
  g.fillRect(0, 0, CELL, CELL);
  g.lineStyle(1.5, C.valleyLine, 0.5);
  for (let y = 8 + v * 4; y < CELL; y += 14) {
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= CELL; x += 8) g.lineTo(x, y + Math.sin((x + v * 10) * 0.25) * 2);
    g.strokePath();
  }
  for (let i = 0; i < 5; i++) {
    g.fillStyle(r() < 0.5 ? C.rockLight : C.rock, 0.9);
    g.fillEllipse(4 + r() * 40, 4 + r() * 40, 3 + r() * 3, 2 + r() * 2);
  }
}

// ---------- terrain objects ----------

function rock(g: G, v: number) {
  const m = v === 0 ? 1 : -1;
  const cx = 24;
  softShadowEllipse(g, cx + 3, 40, 34, 14);
  g.fillStyle(C.rockDark);
  g.fillEllipse(cx, 36, 32, 20);
  g.fillStyle(C.rock);
  g.fillEllipse(cx - 1 * m, 33, 28, 17);
  g.fillStyle(C.rockLight);
  g.fillEllipse(cx - 5 * m, 29, 12, 6);
  g.fillStyle(C.rockDark);
  g.fillEllipse(cx + 13 * m, 41, 11, 8);
  g.fillStyle(C.rock);
  g.fillEllipse(cx + 13 * m, 39.5, 9, 6);
  g.lineStyle(1, C.rockDark, 0.7);
  g.lineBetween(cx + 3 * m, 28, cx + 7 * m, 35);
}

function tree(g: G, v: number) {
  const m = v === 0 ? 1 : -1;
  softShadowEllipse(g, 27, 42, 36, 13);
  g.fillStyle(C.trunk);
  g.fillRoundedRect(21, 30, 6, 13, 2);
  g.fillRoundedRect(23 + 3 * m, 28, 3, 8, 1);
  const blobs: [number, number, number][] = [
    [24 - 8 * m, 22, 10],
    [24 + 7 * m, 20, 11],
    [24, 12, 11],
    [24 + 1 * m, 27, 9],
  ];
  g.fillStyle(C.oliveDark);
  blobs.forEach(([x, y, r]) => g.fillCircle(x, y + 2, r));
  g.fillStyle(C.olive);
  blobs.forEach(([x, y, r]) => g.fillCircle(x, y, r));
  g.fillStyle(C.oliveLight);
  blobs.forEach(([x, y, r]) => g.fillCircle(x - 2, y - 3, r * 0.45));
  g.fillStyle(0x4b5a33);
  [[18, 20], [30, 15], [27, 25], [20, 11], [33, 22]].forEach(([x, y]) => g.fillCircle(24 + (x - 24) * m, y, 1.4));
}

// ---------- houses ----------

function plot(g: G) {
  g.fillStyle(0xc8ab7c, 0.85);
  g.fillRoundedRect(8, 10, 32, 30, 4);
  g.lineStyle(1.5, C.rope, 1);
  for (let x = 8; x < 40; x += 6) {
    g.lineBetween(x, 9, x + 3, 9);
    g.lineBetween(x, 41, x + 3, 41);
  }
  for (let y = 9; y < 41; y += 6) {
    g.lineBetween(7, y, 7, y + 3);
    g.lineBetween(41, y, 41, y + 3);
  }
  g.fillStyle(C.woodDark);
  [[6, 7], [40, 7], [6, 39], [40, 39]].forEach(([x, y]) => g.fillRect(x, y, 3, 4));
  g.fillStyle(C.rockLight);
  g.fillCircle(33, 34, 2.5);
  g.fillCircle(29, 35, 2);
  g.fillStyle(C.rock);
  g.fillCircle(31, 31.5, 2);
}

function tent(g: G) {
  softShadowEllipse(g, 26, 34, 42, 20);
  g.lineStyle(1, C.rope, 1);
  g.lineBetween(8, 13, 3, 8);
  g.lineBetween(40, 13, 45, 8);
  g.lineBetween(8, 37, 3, 42);
  g.lineBetween(40, 37, 45, 42);
  g.fillStyle(C.woodDark);
  [[2, 7], [44, 7], [2, 41], [44, 41]].forEach(([x, y]) => g.fillCircle(x, y, 1.5));
  g.fillStyle(C.fabric);
  g.fillRoundedRect(8, 12, 32, 14, { tl: 4, tr: 4, bl: 0, br: 0 });
  g.fillStyle(C.fabricDark);
  g.fillRoundedRect(8, 25, 32, 13, { tl: 0, tr: 0, bl: 3, br: 3 });
  g.fillStyle(shade(C.fabricDark, 0.85), 0.5);
  for (let x = 12; x < 40; x += 8) g.fillRect(x, 12, 3, 26);
  g.lineStyle(2, C.woodDark, 1);
  g.lineBetween(8, 25, 40, 25);
  g.fillStyle(0x5c3f28);
  g.fillTriangle(19, 38, 29, 38, 24, 28);
  g.fillStyle(C.woodDark);
  g.fillCircle(8, 25, 2);
  g.fillCircle(40, 25, 2);
}

function mudHouse(g: G) {
  block(g, 7, 10, 34, 22, 12, C.mudRoof, C.mudWall);
  g.fillStyle(shade(C.mudRoof, 0.82));
  g.fillRect(12, 14, 7, 6);
  g.fillStyle(C.red, 0.85);
  g.fillRoundedRect(21, 17, 11, 6, 1);
  g.fillStyle(C.terracotta);
  g.fillCircle(35, 15, 3);
  g.fillStyle(shade(C.terracotta, 0.7));
  g.fillCircle(35, 15, 1.2);
  g.fillStyle(C.woodDark);
  [10, 17, 30, 37].forEach((x) => g.fillRect(x, 32, 2, 2));
  archDoor(g, 20, 34, 8, 10);
  windows(g, [11, 32], 36);
}

function stoneHouse(g: G) {
  block(g, 5, 6, 38, 24, 14, C.stoneRoof, C.stoneWall);
  parapet(g, 8, 9, 32, 18, C.stoneRoof);
  stoneLines(g, 6, 30, 36, 13, C.stoneWall);
  g.fillStyle(C.terracotta);
  g.fillRoundedRect(11, 14, 6, 5, 1);
  g.fillStyle(C.leaf);
  g.fillCircle(14, 13, 3.5);
  g.fillStyle(shade(C.stoneRoof, 0.78));
  g.fillRect(29, 15, 7, 7);
  g.lineStyle(1, C.woodDark, 1);
  g.lineBetween(30, 15, 30, 22);
  g.lineBetween(35, 15, 35, 22);
  archDoor(g, 20, 32, 8, 12);
  windows(g, [10, 33], 34);
}

function bigHouse(g: G) {
  block(g, 2, 0, 44, 30, 16, C.bigRoof, C.bigWall);
  parapet(g, 5, 3, 38, 24, C.bigRoof);
  g.fillStyle(0xcdb68b);
  g.fillRoundedRect(14, 8, 18, 14, 2);
  g.fillStyle(C.shadow, 0.15);
  g.fillRect(14, 8, 18, 3);
  softCircle(g, 24, 16, 6, C.shadow, 0.5);
  g.fillStyle(C.leaf);
  g.fillCircle(23, 14, 4.5);
  g.fillStyle(shade(C.leaf, 1.2));
  g.fillCircle(22, 12.5, 2);
  for (let i = 0; i < 4; i++) {
    g.fillStyle(i % 2 ? C.cream : C.red);
    g.fillRect(35 + i * 2, 5, 2, 10);
  }
  g.fillStyle(C.terracotta);
  g.fillCircle(9, 9, 2.5);
  g.fillCircle(9, 15, 2.5);
  stoneLines(g, 3, 31, 42, 14, C.bigWall);
  archDoor(g, 20, 32, 9, 13);
  windows(g, [6, 13, 32, 39], 34, 4, 5);
}

// ---------- other buildings ----------

function field(g: G) {
  softShadowBox(g, 3, 3, 42, 42);
  g.fillStyle(C.soil);
  g.fillRoundedRect(3, 3, 42, 42, 5);
  g.fillStyle(shade(C.soil, 1.15));
  g.fillRect(5, 4, 38, 2);
  g.lineStyle(2, C.soilDark, 0.8);
  for (let y = 10; y < 44; y += 6) g.lineBetween(6, y, 42, y);
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

function well(g: G) {
  softShadowEllipse(g, 27, 36, 38, 18);
  g.fillStyle(shade(C.rock, 0.85));
  g.fillEllipse(24, 37, 32, 18);
  g.fillRect(8, 28, 32, 9);
  g.lineStyle(1, C.rockDark, 0.8);
  [13, 19, 26, 33].forEach((x) => g.lineBetween(x, 31, x, 42));
  g.fillStyle(C.rockLight);
  g.fillEllipse(24, 28, 32, 18);
  g.fillStyle(0x3f86b8);
  g.fillEllipse(24, 28, 21, 11);
  g.fillStyle(C.water);
  g.fillEllipse(24, 29, 19, 9);
  g.fillStyle(C.waterLight, 0.9);
  g.fillEllipse(20, 27.5, 7, 2.5);
  g.fillStyle(C.woodDark);
  g.fillRect(6, 12, 3, 20);
  g.fillRect(39, 12, 3, 20);
  g.fillStyle(C.wood);
  g.fillRoundedRect(4, 9, 40, 4, 1);
  g.lineStyle(1, C.rope, 1);
  g.lineBetween(24, 13, 24, 21);
  g.fillStyle(C.wood);
  g.fillRect(21, 21, 6, 5);
  g.fillStyle(C.woodDark);
  g.fillRect(21, 21, 6, 1.5);
}

function market(g: G) {
  softShadowBox(g, 4, 4, 40, 34);
  g.fillStyle(C.wood);
  g.fillRoundedRect(6, 22, 36, 14, 2);
  g.lineStyle(1, C.woodDark, 0.9);
  for (let x = 12; x < 42; x += 6) g.lineBetween(x, 27, x, 35);
  g.fillStyle(C.woodDark);
  g.fillRect(6, 34, 36, 2);
  g.fillStyle(C.red);
  g.fillRoundedRect(4, 2, 40, 23, 3);
  g.fillStyle(C.cream);
  for (let x = 9; x < 42; x += 10) g.fillRect(x, 2, 5, 23);
  for (let i = 0; i < 8; i++) {
    g.fillStyle(i % 2 ? C.cream : C.red);
    g.fillCircle(6.5 + i * 5, 25, 2.6);
  }
  g.fillStyle(shade(C.cream, 1.2), 0.5);
  g.fillRect(5, 3, 38, 2);
  const baskets: [number, number, number][] = [[12, 41, 0xe8742c], [24, 42, 0x8fae4a], [36, 41, 0x8a4f8f]];
  baskets.forEach(([x, y, fruit]) => {
    g.fillStyle(C.shadow, 0.18);
    g.fillEllipse(x + 1.5, y + 2, 11, 6);
    g.fillStyle(C.woodDark);
    g.fillEllipse(x, y, 10, 7);
    g.fillStyle(fruit);
    g.fillCircle(x - 2, y - 1, 2);
    g.fillCircle(x + 2, y - 1, 2);
    g.fillCircle(x, y - 2.5, 2);
  });
}

function workshop(g: G) {
  block(g, 4, 6, 40, 24, 14, 0xc49a6a, 0xa07a50);
  g.lineStyle(1, shade(0xc49a6a, 0.85), 0.9);
  for (let y = 12; y < 28; y += 5) g.lineBetween(7, y, 26, y);
  g.fillStyle(C.woodDark);
  [[9, 20], [13, 20], [17, 20], [11, 16.5], [15, 16.5]].forEach(([x, y]) => g.fillCircle(x, y, 2.2));
  g.fillStyle(C.wood);
  [[9, 20], [13, 20], [17, 20], [11, 16.5], [15, 16.5]].forEach(([x, y]) => g.fillCircle(x, y, 1.2));
  g.fillStyle(C.rockDark);
  g.fillRoundedRect(31, -4, 9, 14, 1);
  g.fillStyle(C.rock);
  g.fillRect(31, -4, 9, 3);
  g.fillStyle(0x3a2c20);
  g.fillRect(33, -3.5, 5, 2);
  g.fillStyle(0x3a2c20);
  g.fillRoundedRect(16, 32, 16, 12, { tl: 3, tr: 3, bl: 0, br: 0 });
  softCircle(g, 24, 41, 5, 0xf08a32, 0.9);
  g.lineStyle(1.5, C.woodDark, 1);
  g.strokeCircle(10, 38, 4);
  g.lineBetween(10, 34, 10, 42);
  g.lineBetween(6, 38, 14, 38);
}

function altar(g: G) {
  block(g, 5, 12, 38, 22, 10, C.stoneRoof, C.stoneWall);
  stoneLines(g, 6, 34, 36, 9, C.stoneWall);
  g.fillStyle(shade(C.stoneWall, 0.9));
  g.fillRect(11, 26, 26, 6);
  g.fillStyle(shade(C.stoneRoof, 1.1));
  g.fillRoundedRect(11, 8, 26, 19, 2);
  g.fillStyle(shade(C.stoneRoof, 0.95));
  [[10, 7], [34, 7], [10, 23], [34, 23]].forEach(([x, y]) => g.fillRoundedRect(x, y, 4, 4, 1));
  g.fillStyle(0x4a3a2a);
  g.fillEllipse(24, 18, 15, 9);
  g.fillStyle(0xe8742c);
  [[21, 19], [26, 18], [24, 20]].forEach(([x, y]) => g.fillCircle(x, y, 1.6));
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

function needIcon(g: G, k: ServiceKind) {
  if (k === 'well') {
    g.fillStyle(C.need.well);
    g.fillCircle(8, 10, 5);
    g.fillTriangle(3.3, 8.5, 12.7, 8.5, 8, 1);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(6.3, 10, 1.4);
  } else if (k === 'market') {
    g.fillStyle(C.cream);
    g.fillRoundedRect(1, 2, 14, 12, 2);
    g.fillStyle(C.need.market);
    [1.5, 6.5, 11.5].forEach((x) => g.fillRect(x, 2, 3, 12));
  } else {
    flame(g);
  }
}

function walker(g: G, v: number) {
  const cloth = C.clothes[v];
  const skin = C.skin[v % C.skin.length];
  g.fillStyle(C.shadow, 0.25);
  g.fillEllipse(6, 18.5, 10, 4);
  g.fillStyle(cloth);
  g.fillRoundedRect(2, 7, 8, 11, 3);
  g.fillStyle(shade(cloth, 0.8));
  g.fillRect(2, 12, 8, 1.5);
  g.fillStyle(skin);
  g.fillCircle(6, 5, 3.6);
  if (v % 2 === 0) {
    g.fillStyle(shade(cloth, 1.35));
    g.fillEllipse(6, 3, 8, 4.5);
  } else {
    g.fillStyle(0x4a3523);
    g.fillEllipse(6, 2.6, 6.5, 3);
  }
}

function icon(scene: Phaser.Scene, name: Parameters<typeof TEX.icon>[0], draw: (g: G) => void) {
  make(scene, TEX.icon(name), 40, 40, draw);
}

function icons(scene: Phaser.Scene) {
  icon(scene, 'view', (g) => {
    g.lineStyle(5, C.woodDark, 1);
    g.lineBetween(25, 25, 35, 35);
    g.fillStyle(0xd9eef7);
    g.fillCircle(17, 17, 11);
    g.lineStyle(4, C.ink, 1);
    g.strokeCircle(17, 17, 11);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(13, 13, 3);
  });
  icon(scene, 'clear', (g) => {
    g.lineStyle(4, C.wood, 1);
    g.lineBetween(10, 34, 28, 10);
    g.fillStyle(C.rockLight);
    g.fillTriangle(22, 6, 36, 10, 30, 20);
    g.fillStyle(C.rockDark);
    g.fillTriangle(26, 12, 36, 10, 30, 20);
  });
  icon(scene, 'silver', (g) => {
    g.fillStyle(0x8f949b);
    g.fillCircle(20, 21, 14);
    g.fillStyle(0xd3d7dc);
    g.fillCircle(20, 19, 14);
    g.lineStyle(2, 0x9aa0a8, 1);
    g.strokeCircle(20, 19, 9);
    g.fillStyle(0xffffff, 0.8);
    g.fillEllipse(15, 13, 6, 3);
  });
  icon(scene, 'food', (g) => {
    g.fillStyle(shade(0xd8a35a, 0.75));
    g.fillEllipse(20, 24, 32, 18);
    g.fillStyle(0xd8a35a);
    g.fillEllipse(20, 21, 32, 18);
    g.lineStyle(2, shade(0xd8a35a, 0.7), 1);
    [12, 20, 28].forEach((x) => g.lineBetween(x - 2, 16, x + 2, 25));
  });
  icon(scene, 'people', (g) => {
    const person = (x: number, cloth: number) => {
      g.fillStyle(cloth);
      g.fillRoundedRect(x - 7, 18, 14, 18, 5);
      g.fillStyle(C.skin[0]);
      g.fillCircle(x, 12, 6);
    };
    person(27, C.clothes[1]);
    person(14, C.clothes[0]);
  });
  icon(scene, 'work', (g) => {
    g.lineStyle(5, C.wood, 1);
    g.lineBetween(12, 34, 26, 14);
    g.fillStyle(C.rockDark);
    g.fillRoundedRect(17, 5, 20, 10, 2);
    g.fillStyle(C.rockLight);
    g.fillRect(17, 5, 20, 3);
  });
  icon(scene, 'month', (g) => {
    g.fillStyle(C.cream);
    g.fillRoundedRect(6, 8, 28, 26, 4);
    g.fillStyle(C.red);
    g.fillRoundedRect(6, 8, 28, 9, { tl: 4, tr: 4, bl: 0, br: 0 });
    g.lineStyle(2, C.border, 1);
    g.strokeRoundedRect(6, 8, 28, 26, 4);
    g.fillStyle(C.ink);
    [[12, 22], [20, 22], [28, 22], [12, 28], [20, 28]].forEach(([x, y]) => g.fillRect(x - 1.5, y - 1.5, 3, 3));
  });
  icon(scene, 'goal', (g) => {
    g.lineStyle(3, C.woodDark, 1);
    g.lineBetween(10, 6, 10, 36);
    g.fillStyle(C.red);
    g.fillTriangle(11, 7, 34, 13, 11, 20);
  });
}

export function generateTextures(scene: Phaser.Scene): void {
  for (let v = 0; v < GRASS_VARIANTS; v++) make(scene, TEX.grass(v), CELL, CELL, (g) => grass(g, v));
  for (let v = 0; v < 2; v++) {
    make(scene, TEX.valley(v), CELL, CELL, (g) => valley(g, v));
    make(scene, TEX.rock(v), BW, BH, (g) => rock(g, v), HEADROOM);
    make(scene, TEX.tree(v), BW, BH, (g) => tree(g, v), HEADROOM);
  }
  [plot, tent, mudHouse, stoneHouse, bigHouse].forEach((draw, level) => make(scene, TEX.house(level), BW, BH, draw, HEADROOM));
  const buildings: [BuildingKind, (g: G) => void][] = [
    ['field', field],
    ['well', well],
    ['market', market],
    ['workshop', workshop],
    ['altar', altar],
  ];
  buildings.forEach(([kind, draw]) => make(scene, TEX.building(kind), BW, BH, draw, HEADROOM));
  make(scene, TEX.wheat, 14, 19, wheat);
  make(scene, TEX.flame, 16, 22, flame);
  make(scene, TEX.soft, 32, 32, (g) => softCircle(g, 16, 16, 16, 0xffffff));
  make(scene, TEX.ring, 64, 64, (g) => {
    g.lineStyle(6, 0xffffff, 0.35);
    g.strokeCircle(32, 32, 27);
    g.lineStyle(3, 0xffffff, 1);
    g.strokeCircle(32, 32, 27);
  });
  make(scene, TEX.balloon, 28, 28, balloon);
  (['well', 'market', 'altar'] as ServiceKind[]).forEach((k) => make(scene, TEX.need(k), 16, 22, (g) => needIcon(g, k)));
  for (let v = 0; v < WALKER_VARIANTS; v++) make(scene, TEX.walker(v), 12, 21, (g) => walker(g, v));
  icons(scene);
}

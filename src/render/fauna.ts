import type Phaser from 'phaser';
import { C, shade } from './palette';

type G = Phaser.GameObjects.Graphics;

/**
 * Small life around the city, drawn flat facing right (images flip to face left), anchored at the
 * feet (bottom center): animals, a fishing boat, a washerwoman and hanging cloth.
 */
export const FAUNA_SIZE = {
  goat: [16, 13],
  chicken: [9, 9],
  donkey: [22, 18],
  sheep: [15, 11],
  dove: [9, 7],
  doveFly: [13, 8],
  boat: [32, 18],
  washer: [15, 15],
  cloth: [7, 9],
} as const;
export type FaunaKind = keyof typeof FAUNA_SIZE;

const legs = (g: G, color: number, xs: number[], top: number, bottom: number) => {
  g.lineStyle(1.4, color, 1);
  for (const x of xs) g.lineBetween(x, top, x, bottom);
};

const shadow = (g: G, w: number, h: number) => {
  g.fillStyle(C.shadow, 0.22);
  g.fillEllipse(w / 2, h - 1.2, w * 0.7, 2.4);
};

export function goat(g: G, frame: number) {
  const [w, h] = FAUNA_SIZE.goat;
  shadow(g, w, h);
  legs(g, 0x5a4636, [4, 6, 10, 12], 8, h - 1);
  g.fillStyle(frame ? 0xeee6d6 : 0x8a6a4c);
  g.fillEllipse(8, 7, 11, 6);
  g.fillStyle(frame ? 0xd9cfbd : 0x6e533a);
  g.fillEllipse(13.2, 4.6, 4.4, 3.6); // head
  g.lineStyle(1.2, 0x4a3a2c, 1);
  g.lineBetween(13, 3, 11.5, 0.8); // horn
  g.lineBetween(2.6, 6, 1.2, 4.4); // tail
}

export function chicken(g: G, frame: number) {
  const [w, h] = FAUNA_SIZE.chicken;
  shadow(g, w, h);
  legs(g, 0xd9962c, [4, 5.5], 6.5, h - 1);
  g.fillStyle(frame ? 0x9a5a2c : 0xf4efe4);
  g.fillEllipse(4.4, 5, 6.6, 4.6);
  g.fillCircle(6.8, 2.8, 1.9);
  g.fillStyle(0xc0392b);
  g.fillCircle(7, 1, 1);
  g.fillStyle(0xe8a23c);
  g.fillTriangle(8.4, 2.6, 9, 3.2, 8.4, 3.6);
}

export function donkey(g: G) {
  const [w, h] = FAUNA_SIZE.donkey;
  shadow(g, w, h);
  // Tethering post with the rope.
  g.lineStyle(2, C.woodDark, 1);
  g.lineBetween(20.5, h - 1, 20.5, 6);
  g.lineStyle(0.8, C.rope, 1);
  g.lineBetween(20.5, 8, 16.5, 7);
  legs(g, 0x5e5850, [4, 6.5, 11, 13.5], 11, h - 1);
  g.fillStyle(0x9a928a);
  g.fillEllipse(9, 9.5, 14, 7.5);
  g.fillStyle(0x8a8279);
  g.fillEllipse(15.6, 6.2, 5.6, 4.4); // head
  g.fillStyle(0xd8d2c8);
  g.fillEllipse(17.6, 7.2, 2.4, 2);
  g.lineStyle(1.6, 0x6e675f, 1);
  g.lineBetween(14.4, 4.4, 13.4, 0.8); // ears
  g.lineBetween(15.6, 4.2, 15.8, 0.6);
  g.fillStyle(C.red);
  g.fillRect(6, 6, 6, 3); // saddle cloth
  g.lineStyle(1, 0x5e5850, 1);
  g.lineBetween(2.2, 8.5, 1.2, 12);
}

export function sheep(g: G, frame: number) {
  const [w, h] = FAUNA_SIZE.sheep;
  shadow(g, w, h);
  legs(g, 0x3e342c, [4, 6, 9, 11], 7, h - 1);
  g.fillStyle(0xf3eee2);
  for (const [x, y] of [[4, 5.4], [7, 4.4], [10, 5.4], [7, 6.6], [5, 6.8], [9.4, 7]]) g.fillCircle(x, y, 2.6);
  g.fillStyle(0x3e342c);
  g.fillEllipse(frame ? 13 : 12.6, frame ? 7 : 4.6, 3.6, 3); // head up or grazing
}

export function dove(g: G) {
  const [w, h] = FAUNA_SIZE.dove;
  shadow(g, w, h);
  g.fillStyle(0xd9dde2);
  g.fillEllipse(4, 4.2, 6.4, 3.8);
  g.fillStyle(0xf2f4f6);
  g.fillCircle(6.6, 2.4, 1.6);
  g.fillStyle(0x9aa2ac);
  g.fillEllipse(3.4, 3.6, 3.4, 1.6);
  g.fillStyle(0xe0a07a);
  g.fillCircle(8, 2.6, 0.6);
}

export function doveFly(g: G) {
  g.fillStyle(0xf2f4f6);
  g.fillEllipse(6.5, 5, 6, 2.6);
  g.fillCircle(9.4, 4.4, 1.4);
  g.fillStyle(0xd9dde2);
  g.fillTriangle(5, 4.6, 8, 4.6, 3, 0.4);
  g.fillTriangle(5.4, 5.2, 8.6, 5.2, 10.6, 0.8);
}

export function boat(g: G) {
  const [w, h] = FAUNA_SIZE.boat;
  g.fillStyle(0x2a5e86, 0.35);
  g.fillEllipse(w / 2, h - 3, w - 2, 5); // ripple under the hull
  g.fillStyle(C.woodDark);
  g.fillPoints([{ x: 2, y: 10 }, { x: 30, y: 10 }, { x: 25, y: 16 }, { x: 7, y: 16 }], true);
  g.fillStyle(C.wood);
  g.fillRect(4, 10, 24, 2);
  // Fisherman sitting with a rod.
  g.fillStyle(C.clothes[5]);
  g.fillEllipse(17, 8, 6, 6);
  g.fillStyle(C.skin[1]);
  g.fillCircle(17.6, 3.6, 2.2);
  g.fillStyle(C.clothes[1]);
  g.fillRect(15.4, 1.4, 4.4, 1.6);
  g.lineStyle(1, C.woodDark, 1);
  g.lineBetween(19, 7, 29, 0.6);
  g.lineStyle(0.6, 0xeeeeee, 0.8);
  g.lineBetween(29, 0.6, 30.5, 9);
  // Folded net at the stern.
  g.fillStyle(0xcfc2a2);
  g.fillEllipse(7, 10, 6, 3);
}

/** Kneeling washerwoman on a river bank; frame 1 scrubs with the arms forward. */
export function washer(g: G, frame: number) {
  const [w, h] = FAUNA_SIZE.washer;
  shadow(g, w, h);
  g.fillStyle(C.clothes[frame % 2 ? 3 : 0]);
  g.fillEllipse(6, 10, 8, 7); // robe, kneeling
  g.fillStyle(C.clothes[2]);
  g.fillCircle(6.5, 4.2, 3); // head cloth
  g.fillStyle(C.skin[0]);
  g.fillCircle(7.6, 4.8, 1.8);
  g.lineStyle(1.6, C.skin[0], 1);
  g.lineBetween(8, 8, frame ? 12.6 : 11, frame ? 11 : 10);
  // Cloth on a flat washing stone.
  g.fillStyle(C.rockLight);
  g.fillEllipse(12, 13, 6, 2.6);
  g.fillStyle(0xf4f0e6);
  g.fillRect(frame ? 11 : 10, 11, 4, 2);
}

/** A white piece of cloth hanging from the top edge (tinted per colour). */
export function cloth(g: G) {
  const [w, h] = FAUNA_SIZE.cloth;
  g.fillStyle(0xffffff);
  g.fillRect(0.5, 0, w - 1, h - 1.5);
  g.fillStyle(shade(0xffffff, 0.85));
  g.fillRect(0.5, h - 2.5, w - 1, 1);
  g.lineStyle(1, 0xffffff, 1);
  g.lineBetween(1.5, h - 1.5, 2, h);
  g.lineBetween(w - 2, h - 1.5, w - 2.5, h);
}

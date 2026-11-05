/**
 * Residents walking the streets, drawn in code as small side views facing right (the walker image
 * is flipped to face left). Each type carries something oversized so it reads on a phone at the
 * minimum zoom. Feet sit on the bottom centre of the canvas (origin 0.5, 1).
 */
import type Phaser from 'phaser';
import type { Craft, WalkerType } from '../core';
import { C, shade } from './palette';

type G = Phaser.GameObjects.Graphics;
type Pt = { x: number; y: number };

/** Light, olive and dark skin tones. */
const SKIN = [0xe2b68c, 0xbf885a, 0x8c5c3b];
/** Period cloth: undyed wool and linen, brown, indigo blue, madder red, white. */
const CLOTH = {
  linen: 0xe2d2b0,
  wool: 0xc4ab82,
  brown: 0x8a5d3b,
  dark: 0x5c3f2c,
  blue: 0x4f6f9e,
  indigo: 0x3e5279,
  red: 0xa8473a,
  rust: 0xbc6440,
  white: 0xf1ebdc,
  ochre: 0xc89848,
};
const INK = 0x2e2118;
const PRIEST_WHITE = 0xfaf7f0;
const PRIEST_BLUE = 0x2f5fb0;
const HAIR = 0x2e2118;
const IRON = 0x5a5650;
const IRON_EDGE = 0xc8c2b6;
const SOIL = 0x7a5232;
const BEARD_BROWN = 0x6b4a30;

type Cover = 'mantle' | 'headcloth' | 'turban' | 'hair';
type Arm = 'swing' | 'up' | 'front' | 'back' | 'staff' | 'low' | 'reach' | 'hold';

interface Look {
  skin: number;
  robe: number;
  /** Head cloth, mantle or turban colour. */
  head: number;
  sash?: number;
  beard?: number;
}

interface Body extends Look {
  cover: Cover;
  arm: Arm;
  /** Knee-length tunic instead of a long robe. */
  short?: boolean;
  /** Body leaning forward, in px at the shoulders. */
  lean?: number;
  /** Stooped with age: head lowered and pushed forward, long beard. */
  bent?: boolean;
  /** Sash height in px (default 1.8). */
  sashW?: number;
  run?: boolean;
  s?: number;
}

/** Canvas size of a resident type: most are 26 x 36, the donkey, the sheep and the artisan's goods need room. */
export const RESIDENT_SIZE: Partial<Record<WalkerType, [number, number]>> = { donkeyMan: [50, 36], shepherd: [38, 36], artisan: [40, 40], woodcutter: [40, 36], mason: [48, 36] };
const DEFAULT_SIZE: [number, number] = [26, 36];

export const residentSize = (t: WalkerType) => RESIDENT_SIZE[t] ?? DEFAULT_SIZE;

/** Ground shadow under feet at (x, y). */
function shadowAt(g: G, x: number, y: number, w: number) {
  g.fillStyle(C.shadow, 0.25);
  g.fillEllipse(x + 1, y, w, 3.5);
}

/**
 * A person standing on (cx, F) facing right, in step frame 0 (legs apart) or 1 (passing).
 * Returns the hand, the top of the head and the upper back for props.
 */
function person(g: G, cx: number, F: number, b: Body, frame: number) {
  const s = b.s ?? 1;
  const l = b.lean ?? 0;
  const P = (dx: number, dy: number): Pt => ({ x: cx + dx * s, y: F + dy * s });
  // Legs and sandals.
  const strides = b.run ? [[-5.5, 5.5], [-2, 2.5]] : [[-3.2, 3.4], [-0.8, 1.4]];
  const hip = P(l * 0.3, -8);
  for (const f of strides[frame]) {
    const foot = P(f, -0.6);
    g.lineStyle(2 * s, shade(b.skin, 0.8));
    g.lineBetween(hip.x, hip.y, foot.x, foot.y);
    g.fillStyle(INK);
    g.fillRect(foot.x - 1 * s, foot.y - 0.4 * s, 2.6 * s, 1.3 * s);
  }
  // Robe with a shaded back fold and a dark outline.
  const hem = b.short ? -6.5 : -2.2;
  const flare = frame === 0 ? (b.short ? 4.2 : 4.8) : 3.6;
  const robe = [P(-2.8 + l, -15.8), P(2.8 + l, -15.8), P(flare, hem), P(-flare - 0.4, hem)];
  g.fillStyle(b.robe);
  g.fillPoints(robe, true);
  g.fillStyle(shade(b.robe, 0.76));
  g.fillPoints([robe[0], P(-0.8 + l, -15.8), P(-flare * 0.35, hem), robe[3]], true);
  g.lineStyle(1, shade(b.robe, 0.4), 0.9);
  g.strokePoints(robe, true);
  if (b.sash !== undefined) {
    const sw = b.sashW ?? 1.8;
    const band = [P(-3.4 + l * 0.6, -10.4), P(3.6 + l * 0.6, -10.4), P(3.8 + l * 0.5, -10.4 + sw), P(-3.6 + l * 0.5, -10.4 + sw)];
    g.fillStyle(b.sash);
    g.fillPoints(band, true);
    if (sw > 2) {
      // A wide sash: darker lower edge and a long end hanging down the front.
      g.fillStyle(shade(b.sash, 0.7));
      g.fillPoints([band[3], band[2], P(3.8 + l * 0.5, -10.9 + sw), P(-3.6 + l * 0.5, -10.9 + sw)], true);
      g.fillStyle(b.sash);
      g.fillPoints([P(1.6 + l * 0.5, -10.4 + sw), P(3 + l * 0.5, -10.4 + sw), P(3.2, -4), P(1.8, -3.6)], true);
    }
  }
  // Head, beard and head covering; a bent elder carries the head lower and forward.
  const bend = b.bent ? 1 : 0;
  const head = P(0.7 + l + bend, -18.8 + bend * 1.6);
  g.fillStyle(b.skin);
  g.fillCircle(head.x, head.y, 3 * s);
  g.lineStyle(1, shade(b.skin, 0.5), 0.8);
  g.strokeCircle(head.x, head.y, 3 * s);
  if (b.beard !== undefined) {
    g.fillStyle(b.beard);
    const bx = l + bend;
    const by = bend * 1.6;
    const tip = b.bent ? -12.4 : -14.6;
    g.fillPoints([P(0.6 + bx, -17.8 + by), P(3.9 + bx, -17.6 + by), P(3.2 + bx, tip + by), P(1.4 + bx, tip - 0.4 + by), P(0.6 + bx, -15.6 + by)], true);
  }
  g.fillStyle(INK);
  g.fillCircle(head.x + 1.6 * s, head.y - 0.6 * s, 0.6 * s);
  let top = { x: head.x, y: head.y - 3.2 * s };
  if (b.cover === 'mantle') {
    g.fillStyle(b.head);
    g.fillEllipse(head.x - 0.8 * s, head.y - 1.4 * s, 7.4 * s, 5 * s);
    g.fillPoints([P(-2.6 + l, -20), P(0 + l, -19.4), P(-1.2 + l * 0.6, -11), P(-4.6 + l * 0.4, -9.5)], true);
    g.lineStyle(1, shade(b.head, 0.45), 0.85);
    g.strokePoints([P(-2.6 + l, -21.4), P(1.6 + l, -22.2), P(3.4 + l, -19.6)], false);
  } else if (b.cover === 'headcloth') {
    g.fillStyle(b.head);
    g.fillEllipse(head.x - 0.4 * s, head.y - 1.6 * s, 7 * s, 4 * s);
    g.fillPoints([P(-2.6 + l, -19.6), P(-0.8 + l, -19.4), P(-1.4 + l, -15.4), P(-3.6 + l, -16)], true);
    g.lineStyle(1.2 * s, shade(b.head, 0.6));
    g.lineBetween(head.x - 3 * s, head.y - 1.2 * s, head.x + 2.8 * s, head.y - 1.6 * s);
  } else if (b.cover === 'turban') {
    // The priest's tall wrapped linen turban: rounded, narrowing to the top, with a blue band.
    const T = (dx: number, dy: number): Pt => ({ x: head.x + dx * s, y: head.y + dy * s });
    const wrap = [T(-3.4, -1.4), T(3.4, -1.4), T(3.3, -6.4), T(2.2, -8.8), T(0, -9.6), T(-2.2, -8.8), T(-3.3, -6.4)];
    g.fillStyle(b.head);
    g.fillPoints(wrap, true);
    g.fillStyle(shade(b.head, 0.84));
    g.fillPoints([wrap[0], T(-1.2, -1.4), T(-1, -9.4), wrap[5], wrap[6]], true);
    g.lineStyle(1, shade(b.head, 0.55), 0.9);
    g.strokePoints(wrap, true);
    g.lineStyle(1, shade(b.head, 0.7), 0.9);
    g.lineBetween(T(-3.2, -4.6).x, T(-3.2, -4.6).y, T(3.2, -6.4).x, T(3.2, -6.4).y);
    g.lineBetween(T(-2.8, -7.2).x, T(-2.8, -7.2).y, T(2.6, -8.4).x, T(2.6, -8.4).y);
    g.fillStyle(b.sash ?? CLOTH.blue);
    g.fillRect(head.x - 3.4 * s, head.y - 3.2 * s, 6.8 * s, 1.5 * s);
    top = { x: head.x, y: head.y - 10 * s };
  } else {
    g.fillStyle(HAIR);
    g.fillEllipse(head.x - 0.6 * s, head.y - 1.4 * s, 6.4 * s, 3.8 * s);
  }
  // Arm and hand.
  const shoulder = P(0.4 + l + bend * 0.5, -14.6 + bend);
  const hands: Record<Arm, Pt> = {
    swing: frame === 0 ? P(3.8 + l * 0.5, -9.6) : P(-2.6 + l * 0.5, -9.8),
    up: P(3 + l, -21.5),
    front: P(4.8 + l * 0.6, -11),
    back: P(-2 + l, -15.5),
    staff: P(5.2 + l * 0.6, -12.5),
    low: P(5.6 + l * 0.7, -8),
    reach: P(6.4 + l * 0.8, -5),
    hold: P(-4.6 + l * 0.5, -8.4),
  };
  const hand = hands[b.arm];
  g.lineStyle(2.2 * s, shade(b.robe, 0.82));
  g.lineBetween(shoulder.x, shoulder.y, hand.x, hand.y);
  g.fillStyle(b.skin);
  g.fillCircle(hand.x, hand.y, 1.2 * s);
  return { hand, top, back: P(-2.6 + l, -14), P };
}

/** Clay water jar balanced on the head. */
function headJar(g: G, top: Pt) {
  const { x, y } = top;
  g.fillStyle(shade(C.terracotta, 0.6));
  g.fillEllipse(x, y + 0.5, 6, 2);
  g.fillStyle(shade(C.terracotta, 0.82));
  g.fillEllipse(x, y - 4.5, 9, 9);
  g.fillStyle(C.terracotta);
  g.fillEllipse(x - 0.8, y - 5, 6.4, 7.6);
  g.fillStyle(shade(C.terracotta, 1.35));
  g.fillEllipse(x - 2, y - 6, 1.6, 3.4);
  g.fillStyle(shade(C.terracotta, 0.7));
  g.fillRect(x - 1.6, y - 11, 3.2, 2.6);
  g.fillStyle(shade(C.terracotta, 1.15));
  g.fillEllipse(x, y - 11, 4.6, 1.8);
  g.lineStyle(1, shade(C.terracotta, 0.45), 0.8);
  g.strokeEllipse(x, y - 4.5, 9, 9);
}

/** Woven basket heaped with fruit, held at the hip. */
function basket(g: G, hand: Pt) {
  const x = hand.x + 1;
  const y = hand.y + 2;
  g.fillStyle(0xa77a44);
  g.fillPoints([{ x: x - 6, y: y - 4 }, { x: x + 6, y: y - 4 }, { x: x + 4.5, y: y + 3 }, { x: x - 4.5, y: y + 3 }], true);
  g.lineStyle(1, 0x7a5530, 0.9);
  g.lineBetween(x - 5.4, y - 1.5, x + 5.4, y - 1.5);
  g.lineBetween(x - 4.8, y + 0.8, x + 4.8, y + 0.8);
  [[-3.6, -5, C.red], [-0.6, -6.4, 0x7fa65a], [2.6, -5.4, 0x7a4f86], [0.8, -4.4, C.gold], [-2.2, -4, C.red]].forEach(([dx, dy, c]) => {
    g.fillStyle(c);
    g.fillCircle(x + dx, y + dy, 2);
  });
  g.fillStyle(0xc9a060);
  g.fillEllipse(x, y - 4, 12, 2.2);
}

/** A big tied sack of grain carried on the back. */
function sack(g: G, back: Pt) {
  const x = back.x - 2.5;
  const y = back.y - 1;
  g.fillStyle(0xb09868);
  g.fillEllipse(x, y + 1, 11, 13);
  g.fillStyle(0xd2bb8a);
  g.fillEllipse(x - 1, y, 9, 11.5);
  g.fillStyle(0xe6d3a6);
  g.fillEllipse(x - 2.5, y - 2, 3, 4.5);
  g.fillStyle(0x9a8054);
  g.fillTriangle(x + 1, y - 6, x + 4, y - 9.5, x + 4.5, y - 5.5);
  g.lineStyle(1, 0x6e5a3a, 0.85);
  g.strokeEllipse(x, y + 1, 11, 13);
}

/** Curved iron sickle and a sheaf of wheat over the shoulder. */
function sickle(g: G, hand: Pt) {
  g.lineStyle(2, C.woodDark);
  g.lineBetween(hand.x, hand.y + 1, hand.x + 1, hand.y - 2.5);
  for (const [w, c] of [[2.8, IRON], [1.4, 0xe2ded4]] as const) {
    g.lineStyle(w, c);
    g.beginPath();
    g.arc(hand.x + 4.2, hand.y - 2.6, 3.6, Math.PI, Math.PI * 2.25, false);
    g.strokePath();
  }
}

function sheaf(g: G, back: Pt) {
  const x = back.x;
  const y = back.y;
  g.fillStyle(C.wheatStem);
  g.fillPoints([{ x: x + 1, y: y + 3 }, { x: x + 3, y: y + 2 }, { x: x - 4, y: y - 9 }, { x: x - 7, y: y - 7 }], true);
  g.fillStyle(C.wheat);
  [[-6.5, -9], [-4.5, -10.5], [-8, -7], [-5.5, -7.5]].forEach(([dx, dy]) => g.fillEllipse(x + dx, y + dy, 3.2, 5.5));
  g.fillStyle(0xc0503c);
  g.fillRect(x - 2, y - 3.5, 2.6, 1.6);
}

/** A tall walking staff, optionally with a shepherd's crook. */
function staff(g: G, hand: Pt, F: number, top: number, crook = false) {
  const x = hand.x + 0.5;
  g.lineStyle(2, C.woodDark);
  g.lineBetween(x + 0.8, F - 0.5, x - 0.3, top);
  if (!crook) return;
  g.beginPath();
  g.arc(x + 1.7, top, 2, Math.PI, Math.PI * 2.1, false);
  g.strokePath();
}

/** Leather apron over the front of the tunic. */
function apron(g: G, P: (dx: number, dy: number) => Pt, frame: number) {
  const hem = frame === 0 ? 4.2 : 3.4;
  const pts = [P(-0.6, -14.5), P(3, -14.5), P(hem + 0.6, -4), P(-1.4, -4)];
  g.fillStyle(0xe2c08a);
  g.fillPoints(pts, true);
  g.lineStyle(1, 0x7a5530, 0.9);
  g.strokePoints(pts, true);
  g.lineBetween(P(-0.4, -14.5).x, P(-0.4, -14.5).y, P(-1.6, -17).x, P(-1.6, -17).y);
}

/** Small clay pot in the hand. */
function potInHand(g: G, hand: Pt) {
  g.fillStyle(shade(C.terracotta, 0.85));
  g.fillEllipse(hand.x + 1.5, hand.y - 2, 6, 5.5);
  g.fillStyle(C.terracotta);
  g.fillEllipse(hand.x + 1, hand.y - 2.4, 4, 4);
  g.fillStyle(shade(C.terracotta, 0.6));
  g.fillRect(hand.x - 0.2, hand.y - 5.6, 3.4, 1.4);
}

// ---------- the artisan's goods, one per workshop craft (oversized to read zoomed out) ----------

/** Tall two-handled storage jar hugged in front of the chest. */
function bigJar(g: G, hand: Pt) {
  const x = hand.x + 2.5;
  const y = hand.y - 1;
  g.fillStyle(shade(C.terracotta, 0.78));
  g.fillEllipse(x, y, 11, 13);
  g.fillStyle(C.terracotta);
  g.fillEllipse(x - 1, y - 0.5, 8, 11);
  g.fillStyle(shade(C.terracotta, 1.4));
  g.fillEllipse(x - 2.6, y - 2, 2, 5);
  g.fillStyle(shade(C.terracotta, 0.7));
  g.fillRect(x - 2, y - 10, 4, 4);
  g.fillStyle(shade(C.terracotta, 1.15));
  g.fillEllipse(x, y - 10, 6, 2.2);
  g.lineStyle(1.6, shade(C.terracotta, 0.6));
  g.strokeEllipse(x - 3.6, y - 6, 3, 4);
  g.strokeEllipse(x + 3.6, y - 6, 3, 4);
  g.lineStyle(1, shade(C.terracotta, 0.4), 0.9);
  g.strokeEllipse(x, y, 11, 13);
  g.fillStyle(0xf1ebdc, 0.8);
  g.fillRect(x - 4.5, y + 1, 9, 1.2);
}

/** Big smith's hammer raised over the shoulder, with a dark iron head. */
function hammer(g: G, hand: Pt) {
  const top = { x: hand.x - 5, y: hand.y - 9 };
  g.lineStyle(2.6, C.woodDark);
  g.lineBetween(hand.x + 1, hand.y + 2, top.x, top.y);
  g.fillStyle(0x2e2c2a);
  g.fillPoints([{ x: top.x - 5, y: top.y - 1 }, { x: top.x + 4, y: top.y - 5 }, { x: top.x + 6, y: top.y }, { x: top.x - 3, y: top.y + 4 }], true);
  g.fillStyle(0x8c8780);
  g.fillPoints([{ x: top.x - 5, y: top.y - 1 }, { x: top.x + 4, y: top.y - 5 }, { x: top.x + 4.6, y: top.y - 3.6 }, { x: top.x - 4.4, y: top.y + 0.4 }], true);
  g.fillStyle(0xf0782c);
  g.fillCircle(top.x + 5.5, top.y - 1.5, 1.2);
}

/** Long sawn plank across the shoulder. */
function plank(g: G, back: Pt) {
  const a = { x: back.x - 13, y: back.y - 4 };
  const b = { x: back.x + 20, y: back.y + 3 };
  const n = { x: 0.6, y: -3.4 };
  g.fillStyle(0xb88a50);
  g.fillPoints([a, b, { x: b.x, y: b.y + 1.6 }, { x: a.x, y: a.y + 1.6 }], true);
  g.fillStyle(0xe2bc80);
  g.fillPoints([a, b, { x: b.x + n.x, y: b.y + n.y }, { x: a.x + n.x, y: a.y + n.y }], true);
  g.lineStyle(1, 0x8a6440, 0.8);
  g.lineBetween(a.x + 3, a.y - 1.6, b.x - 6, b.y - 1.6);
  g.strokePoints([{ x: a.x, y: a.y + 1.6 }, { x: b.x, y: b.y + 1.6 }, { x: b.x + n.x, y: b.y + n.y }, { x: a.x + n.x, y: a.y + n.y }], true);
}

/** Thick roll of striped woven cloth on the shoulder. */
function clothRoll(g: G, back: Pt) {
  const x = back.x + 1;
  const y = back.y - 4;
  g.fillStyle(0xa8473a);
  g.fillRoundedRect(x - 9, y - 4, 20, 8, 3.5);
  g.fillStyle(0xf1ebdc);
  for (const dx of [-5, 1, 7]) g.fillRect(x + dx, y - 4, 2, 8);
  g.fillStyle(shade(0xa8473a, 1.25));
  g.fillRect(x - 7, y - 3.4, 16, 1.4);
  g.fillStyle(shade(0xa8473a, 0.7));
  g.fillCircle(x + 10, y, 4);
  g.lineStyle(1, 0xf1ebdc, 0.9);
  g.strokeCircle(x + 10, y, 2.2);
  g.lineStyle(1, shade(0xa8473a, 0.45), 0.9);
  g.strokeRoundedRect(x - 9, y - 4, 20, 8, 3.5);
}

/** Freshly dyed cloths, blue over yellow, draped long over the forearm. */
function dyedCloth(g: G, hand: Pt) {
  const { x, y } = hand;
  const drape = (dx: number, len: number, c: number) => {
    const pts = [{ x: x - 3 + dx, y: y - 1.5 }, { x: x + 5 + dx, y: y - 1.5 }, { x: x + 4 + dx, y: y + len }, { x: x + 1.5 + dx, y: y + len - 2 }, { x: x - 1 + dx, y: y + len + 0.5 }, { x: x - 3.4 + dx, y: y + len - 1.5 }];
    g.fillStyle(c);
    g.fillPoints(pts, true);
    g.fillStyle(shade(c, 0.72));
    g.fillPoints([pts[0], { x: x - 0.6 + dx, y: y - 1.5 }, { x: x - 1 + dx, y: y + len + 0.5 }, pts[5]], true);
    g.lineStyle(1, shade(c, 0.45), 0.9);
    g.strokePoints(pts, true);
  };
  drape(2.5, 9, 0xe8b424);
  drape(0, 12, 0x2f56a8);
  g.fillStyle(0xb82e2a);
  g.fillRect(x - 3, y + 4, 8, 1.6);
}

/** A raw hide carried over the back, legs flapping. */
function hide(g: G, back: Pt) {
  const x = back.x - 2;
  const y = back.y + 1;
  const pts = [
    { x: x - 3, y: y - 9 }, { x: x + 2, y: y - 7 }, { x: x + 5, y: y - 10 }, { x: x + 4, y: y - 5 }, { x: x + 3, y: y + 3 },
    { x: x + 6, y: y + 7 }, { x: x + 1, y: y + 6 }, { x: x - 5, y: y + 8 }, { x: x - 6, y: y + 3 }, { x: x - 10, y: y + 5 },
    { x: x - 7, y: y - 1 }, { x: x - 9, y: y - 8 },
  ];
  g.fillStyle(0xb07a48);
  g.fillPoints(pts, true);
  g.fillStyle(0xd09a62);
  g.fillEllipse(x - 2.5, y - 1, 7, 10);
  g.lineStyle(1, 0x5e3e26, 0.9);
  g.strokePoints(pts, true);
}

/** Arm pose of the artisan for each craft's goods (no craft: a small pot in front). */
const ARTISAN_ARM: Record<Craft | 'none', Arm> = {
  none: 'front', pottery: 'front', smithy: 'up', carpentry: 'back', weaving: 'back', dyeing: 'front', tannery: 'back',
};

/** A grey donkey facing right, laden with two baskets, legs stepping with the frame. */
function donkey(g: G, x: number, F: number, frame: number, coat: number, load: number) {
  shadowAt(g, x, F, 22);
  const legs = frame === 0 ? [[-6, -8], [-3, -1], [3, 5], [6, 1]] : [[-5, -5], [-4, -4], [4, 4], [5, 5]];
  g.lineStyle(2, shade(coat, 0.6));
  for (const [hipX, footX] of legs) g.lineBetween(x + hipX, F - 8, x + footX, F - 0.5);
  g.fillStyle(INK);
  for (const [, footX] of legs) g.fillRect(x + footX - 1, F - 1.2, 2, 1.2);
  g.lineStyle(1.4, shade(coat, 0.6));
  g.lineBetween(x - 8, F - 12, x - 11, F - 6);
  g.fillStyle(INK);
  g.fillCircle(x - 11, F - 6, 1.2);
  g.fillStyle(coat);
  g.fillEllipse(x, F - 11, 18, 8.5);
  g.fillStyle(shade(coat, 1.25));
  g.fillEllipse(x, F - 8.5, 13, 3);
  // Neck, head with a pale muzzle, long ears.
  g.fillStyle(coat);
  g.fillPoints([{ x: x + 5, y: F - 14 }, { x: x + 9, y: F - 19 }, { x: x + 12, y: F - 17 }, { x: x + 9, y: F - 9 }], true);
  g.fillEllipse(x + 12.5, F - 17, 7.5, 4.6);
  g.fillStyle(0xd9cfc2);
  g.fillEllipse(x + 15, F - 16.2, 3.4, 3.2);
  g.fillStyle(shade(coat, 0.7));
  g.fillTriangle(x + 9.5, F - 19, x + 11, F - 19, x + 8, F - 26);
  g.fillTriangle(x + 11, F - 19, x + 12.5, F - 19, x + 11.5, F - 26);
  g.fillStyle(INK);
  g.fillCircle(x + 12.5, F - 18, 0.7);
  g.lineStyle(1.4, shade(coat, 0.5));
  g.lineBetween(x + 5.5, F - 15, x + 9.5, F - 19.5);
  // Saddle blanket and two laden baskets.
  g.fillStyle(C.red);
  g.fillRect(x - 4, F - 16, 8, 3);
  g.fillStyle(load);
  g.fillRoundedRect(x - 7, F - 19, 7, 9, 2);
  g.fillRoundedRect(x + 0.5, F - 19.5, 6.5, 9, 2);
  g.lineStyle(1, shade(load, 0.6), 0.9);
  g.strokeRoundedRect(x - 7, F - 19, 7, 9, 2);
  g.strokeRoundedRect(x + 0.5, F - 19.5, 6.5, 9, 2);
  g.lineBetween(x - 7, F - 15, x, F - 15);
  g.lineBetween(x + 0.5, F - 15.5, x + 7, F - 15.5);
  g.fillStyle(C.gold);
  g.fillCircle(x - 3.5, F - 19.5, 1.8);
  g.fillStyle(0x7fa65a);
  g.fillCircle(x + 3.5, F - 20, 1.8);
}

/** A woolly sheep facing right. */
function sheep(g: G, x: number, F: number, frame: number, face: number) {
  shadowAt(g, x, F, 13);
  const legs = frame === 0 ? [[-3, -4.5], [-1.5, -0.5], [2, 3.5], [3.5, 1.5]] : [[-3, -3], [-2, -2], [2.5, 2.5], [3.5, 3.5]];
  g.lineStyle(1.5, face);
  for (const [hx, fx] of legs) g.lineBetween(x + hx, F - 4, x + fx, F - 0.5);
  g.fillStyle(0xcfc6b4);
  g.fillEllipse(x, F - 7, 13, 8);
  g.fillStyle(0xf2ece0);
  [[-3.5, -8.5, 3], [0, -9.5, 3.2], [3.5, -8.5, 2.8], [-1.5, -6.5, 3], [2, -6.5, 3]].forEach(([dx, dy, r]) => g.fillCircle(x + dx, F + dy, r));
  g.fillStyle(face);
  g.fillEllipse(x + 7, F - 9, 4.6, 3.6);
  g.fillEllipse(x + 5.6, F - 10.4, 2.6, 1.4);
}

/** A long log carried on the shoulder, the pale cut end in front. */
function shoulderLog(g: G, back: Pt) {
  const a = { x: back.x - 12, y: back.y - 1 };
  const b = { x: back.x + 17, y: back.y - 6 };
  const n = { x: 0.9, y: 5 };
  g.fillStyle(shade(C.log, 0.75));
  g.fillPoints([a, b, { x: b.x + n.x, y: b.y + n.y }, { x: a.x + n.x, y: a.y + n.y }], true);
  g.fillStyle(C.log);
  g.fillPoints([a, b, { x: b.x + n.x * 0.5, y: b.y + n.y * 0.5 }, { x: a.x + n.x * 0.5, y: a.y + n.y * 0.5 }], true);
  g.lineStyle(1, shade(C.log, 1.3), 0.8);
  g.lineBetween(a.x + 4, a.y + 0.8, b.x - 6, b.y + 0.8);
  g.fillStyle(shade(C.log, 0.6));
  g.fillEllipse(a.x + 0.4, a.y + 2.5, 3, 5.4);
  g.fillStyle(C.logEnd);
  g.fillEllipse(b.x + 0.5, b.y + 2.5, 3.6, 5.8);
  g.fillStyle(C.logRing);
  g.fillCircle(b.x + 0.5, b.y + 2.5, 0.9);
}

/** A two-wheeled handcart pushed ahead from the hand, a cut limestone block on it (the wheel turns with the step). */
function stoneCart(g: G, hand: Pt, F: number, frame: number) {
  const x0 = hand.x + 4;
  const x1 = x0 + 17;
  const bed = F - 9;
  const wx = x0 + 9;
  const wy = F - 4.5;
  g.lineStyle(1.8, C.woodDark);
  g.lineBetween(hand.x, hand.y, x0 + 1, bed);
  g.fillStyle(C.shadow, 0.25);
  g.fillEllipse(wx + 1, F, 20, 3.5);
  // The block, then the bed and the wheel in front.
  g.fillStyle(shade(C.block, 0.7));
  g.fillRect(x0 + 2, bed - 9, 13, 9);
  g.fillStyle(shade(C.block, 0.9));
  g.fillRect(x0 + 2, bed - 9, 9, 9);
  g.fillStyle(C.block);
  g.fillPoints([{ x: x0 + 2, y: bed - 9 }, { x: x0 + 6, y: bed - 12 }, { x: x0 + 17, y: bed - 12 }, { x: x0 + 15, y: bed - 9 }], true);
  g.lineStyle(1, C.blockEdge, 0.9);
  g.strokeRect(x0 + 2, bed - 9, 13, 9);
  g.fillStyle(C.wood);
  g.fillRect(x0, bed, x1 - x0, 2.6);
  g.fillStyle(C.woodDark);
  g.fillRect(x0, bed + 2.6, x1 - x0, 1);
  g.fillStyle(C.woodDark);
  g.fillCircle(wx, wy, 4.6);
  g.fillStyle(C.wood);
  g.fillCircle(wx, wy, 3.4);
  g.lineStyle(1.2, C.woodDark);
  for (let k = 0; k < 2; k++) {
    const a = (frame * Math.PI) / 4 + (k * Math.PI) / 2;
    g.lineBetween(wx - Math.cos(a) * 3.4, wy - Math.sin(a) * 3.4, wx + Math.cos(a) * 3.4, wy + Math.sin(a) * 3.4);
  }
  g.fillStyle(C.woodDark);
  g.fillCircle(wx, wy, 1.1);
}

/** Three looks per type: skin tones and clothes vary, what they carry stays the same. */
const LOOKS: Record<WalkerType, Look[]> = {
  waterCarrier: [
    { skin: SKIN[0], robe: CLOTH.blue, head: CLOTH.linen, sash: CLOTH.red },
    { skin: SKIN[1], robe: CLOTH.red, head: CLOTH.wool, sash: CLOTH.ochre },
    { skin: SKIN[2], robe: CLOTH.linen, head: CLOTH.indigo, sash: CLOTH.rust },
  ],
  farmer: [
    { skin: SKIN[1], robe: CLOTH.wool, head: CLOTH.white, sash: CLOTH.brown, beard: HAIR },
    { skin: SKIN[2], robe: CLOTH.brown, head: CLOTH.linen, sash: CLOTH.dark, beard: HAIR },
    { skin: SKIN[0], robe: CLOTH.linen, head: CLOTH.rust, sash: CLOTH.brown, beard: BEARD_BROWN },
  ],
  basketWoman: [
    { skin: SKIN[1], robe: CLOTH.indigo, head: CLOTH.red, sash: CLOTH.ochre },
    { skin: SKIN[0], robe: CLOTH.rust, head: CLOTH.white },
    { skin: SKIN[2], robe: CLOTH.ochre, head: CLOTH.blue, sash: CLOTH.red },
  ],
  porter: [
    { skin: SKIN[2], robe: CLOTH.linen, head: CLOTH.brown, sash: CLOTH.dark, beard: HAIR },
    { skin: SKIN[1], robe: CLOTH.blue, head: CLOTH.linen, sash: CLOTH.brown, beard: HAIR },
    { skin: SKIN[0], robe: CLOTH.brown, head: CLOTH.wool, sash: CLOTH.red, beard: BEARD_BROWN },
  ],
  artisan: [
    { skin: SKIN[0], robe: CLOTH.indigo, head: CLOTH.linen, beard: BEARD_BROWN },
    { skin: SKIN[1], robe: CLOTH.red, head: CLOTH.white, beard: HAIR },
    { skin: SKIN[2], robe: CLOTH.dark, head: CLOTH.ochre, beard: HAIR },
  ],
  // Elders wear dark brown and earth tones, never white, so they never read as priests.
  elder: [
    { skin: SKIN[1], robe: CLOTH.dark, head: CLOTH.wool, sash: CLOTH.ochre, beard: 0xf4f1ea },
    { skin: SKIN[0], robe: 0x6e4a30, head: CLOTH.brown, sash: CLOTH.red, beard: 0xe8e4dc },
    { skin: SKIN[2], robe: 0x4e3626, head: CLOTH.rust, sash: CLOTH.wool, beard: 0xf4f1ea },
  ],
  child: [
    { skin: SKIN[1], robe: CLOTH.red, head: HAIR },
    { skin: SKIN[0], robe: CLOTH.linen, head: HAIR },
    { skin: SKIN[2], robe: CLOTH.blue, head: HAIR },
  ],
  donkeyMan: [
    { skin: SKIN[1], robe: CLOTH.wool, head: CLOTH.red, sash: CLOTH.dark, beard: HAIR },
    { skin: SKIN[2], robe: CLOTH.linen, head: CLOTH.blue, sash: CLOTH.brown, beard: HAIR },
    { skin: SKIN[0], robe: CLOTH.brown, head: CLOTH.white, sash: CLOTH.ochre, beard: BEARD_BROWN },
  ],
  shepherd: [
    { skin: SKIN[2], robe: CLOTH.brown, head: CLOTH.wool, sash: CLOTH.red, beard: HAIR },
    { skin: SKIN[1], robe: CLOTH.dark, head: CLOTH.linen, sash: CLOTH.ochre, beard: HAIR },
    { skin: SKIN[0], robe: CLOTH.wool, head: CLOTH.brown, sash: CLOTH.blue },
  ],
  woodcutter: [
    { skin: SKIN[1], robe: CLOTH.rust, head: CLOTH.wool, sash: CLOTH.dark, beard: HAIR },
    { skin: SKIN[2], robe: CLOTH.wool, head: CLOTH.brown, sash: CLOTH.red, beard: HAIR },
    { skin: SKIN[0], robe: CLOTH.brown, head: CLOTH.linen, sash: CLOTH.ochre, beard: BEARD_BROWN },
  ],
  mason: [
    { skin: SKIN[0], robe: CLOTH.linen, head: CLOTH.indigo, sash: CLOTH.brown, beard: BEARD_BROWN },
    { skin: SKIN[2], robe: CLOTH.ochre, head: CLOTH.white, sash: CLOTH.dark, beard: HAIR },
    { skin: SKIN[1], robe: CLOTH.blue, head: CLOTH.wool, sash: CLOTH.rust, beard: HAIR },
  ],
  // Priests: all-white linen, a wide blue sash and a tall white turban; only skin and beard vary.
  priest: [
    { skin: SKIN[1], robe: PRIEST_WHITE, head: PRIEST_WHITE, sash: PRIEST_BLUE, beard: HAIR },
    { skin: SKIN[0], robe: PRIEST_WHITE, head: PRIEST_WHITE, sash: PRIEST_BLUE, beard: BEARD_BROWN },
    { skin: SKIN[2], robe: PRIEST_WHITE, head: PRIEST_WHITE, sash: PRIEST_BLUE, beard: HAIR },
  ],
};

/**
 * Draws a resident of a type and look in step frame 0 or 1 on a canvas of residentSize(type).
 * Artisans carry the goods of the craft of the workshop they head to.
 */
export function drawResident(g: G, type: WalkerType, look: number, frame: number, craft: Craft | null = null) {
  const [w, h] = residentSize(type);
  const L = LOOKS[type][look % LOOKS[type].length];
  const F = h - 2;
  const cx = w / 2;
  switch (type) {
    case 'waterCarrier': {
      shadowAt(g, cx, F, 10);
      const r = person(g, cx, F, { ...L, cover: 'mantle', arm: 'up' }, frame);
      headJar(g, r.top);
      break;
    }
    case 'farmer': {
      shadowAt(g, cx, F, 10);
      sheaf(g, { x: cx - 1, y: F - 9 });
      const r = person(g, cx, F, { ...L, cover: 'headcloth', arm: 'front', short: true }, frame);
      sickle(g, r.hand);
      break;
    }
    case 'basketWoman': {
      shadowAt(g, cx, F, 11);
      const r = person(g, cx - 1, F, { ...L, cover: 'mantle', arm: 'front' }, frame);
      basket(g, r.hand);
      break;
    }
    case 'porter': {
      shadowAt(g, cx, F, 11);
      const r = person(g, cx + 1, F, { ...L, cover: 'headcloth', arm: 'back', short: true, lean: 2.4 }, frame);
      sack(g, r.back);
      break;
    }
    case 'artisan': {
      shadowAt(g, cx, F, 10);
      // Goods on the back go behind the body.
      const back = { x: cx - 3.6, y: F - 14 };
      if (craft === 'tannery') hide(g, back);
      if (craft === 'weaving') clothRoll(g, back);
      const r = person(g, cx - 1, F, { ...L, cover: 'headcloth', arm: ARTISAN_ARM[craft ?? 'none'], short: true }, frame);
      apron(g, r.P, frame);
      if (craft === 'pottery') bigJar(g, r.hand);
      else if (craft === 'smithy') hammer(g, r.hand);
      else if (craft === 'carpentry') plank(g, r.back);
      else if (craft === 'dyeing') dyedCloth(g, r.hand);
      else if (!craft) potInHand(g, r.hand);
      break;
    }
    case 'elder': {
      shadowAt(g, cx, F, 11);
      const r = person(g, cx - 2, F, { ...L, cover: 'headcloth', arm: 'staff', lean: 2.2, bent: true }, frame);
      staff(g, r.hand, F, F - 22);
      break;
    }
    case 'child': {
      shadowAt(g, cx, F, 7);
      person(g, cx, F - (frame === 1 ? 1.5 : 0), { ...L, cover: 'hair', arm: 'swing', short: true, run: true, lean: 1.5, s: 0.68 }, frame);
      break;
    }
    case 'donkeyMan': {
      donkey(g, cx - 9, F, frame, 0x8d8072, [0xb08a52, 0xc9b080, 0x9a7448][look % 3]);
      shadowAt(g, cx + 14, F, 10);
      const r = person(g, cx + 14, F, { ...L, cover: 'headcloth', arm: 'back' }, frame);
      g.lineStyle(1, C.rope, 0.95);
      g.lineBetween(r.hand.x, r.hand.y, cx + 6, F - 15);
      break;
    }
    case 'shepherd': {
      sheep(g, cx + 10, F, frame, [0x3a3330, 0x6b4a30, 0x3a3330][look % 3]);
      shadowAt(g, cx - 6, F, 10);
      const r = person(g, cx - 6, F, { ...L, cover: 'headcloth', arm: 'staff' }, frame);
      staff(g, r.hand, F, F - 28, true);
      break;
    }
    case 'woodcutter': {
      shadowAt(g, cx, F, 11);
      const r = person(g, cx - 2, F, { ...L, cover: 'headcloth', arm: 'back', short: true, lean: 1.6 }, frame);
      shoulderLog(g, { x: r.back.x + 2.6, y: r.back.y - 1.6 });
      break;
    }
    case 'mason': {
      shadowAt(g, cx - 12, F, 10);
      const r = person(g, cx - 12, F, { ...L, cover: 'headcloth', arm: 'low', short: true, lean: 2.2 }, frame);
      stoneCart(g, r.hand, F, frame);
      break;
    }
    case 'priest': {
      shadowAt(g, cx, F, 10);
      // Drawn about 2 px taller than the other residents.
      person(g, cx, F, { ...L, cover: 'turban', arm: 'front', sashW: 3.4, s: 1.08 }, frame);
      break;
    }
  }
}

// ---------- farmers at work inside a field ----------

/**
 * Field work poses: 0 hoe raised, 1 hoe struck into the soil, 2 and 3 stooping to cut stalks with
 * a sickle, 4 and 5 a short step carrying the hoe, 6 and 7 a short step with sickle and sheaf.
 */
export const FIELDHAND_POSES = 8;
export const FIELDHAND_SIZE: [number, number] = [34, 40];

/** A wooden hoe from the grip to the far end, with a broad iron blade bent toward `dir` at the end. */
function hoe(g: G, grip: Pt, end: Pt, dir: Pt) {
  g.lineStyle(2, C.woodDark);
  g.lineBetween(grip.x, grip.y, end.x, end.y);
  const tip = { x: end.x + dir.x * 4.5, y: end.y + dir.y * 4.5 };
  const n = { x: -dir.y * 2, y: dir.x * 2 };
  const blade = [
    { x: end.x - n.x * 0.6, y: end.y - n.y * 0.6 },
    { x: end.x + n.x * 0.6, y: end.y + n.y * 0.6 },
    { x: tip.x + n.x, y: tip.y + n.y },
    { x: tip.x - n.x, y: tip.y - n.y },
  ];
  g.fillStyle(IRON);
  g.fillPoints(blade, true);
  g.lineStyle(1, IRON_EDGE, 0.9);
  g.lineBetween(blade[2].x, blade[2].y, blade[3].x, blade[3].y);
}

/** A few cut stalks held in the hand. */
function handful(g: G, hand: Pt) {
  g.lineStyle(1.2, C.wheatStem);
  for (const dx of [-2.5, -0.5, 1.5]) g.lineBetween(hand.x, hand.y, hand.x + dx - 1, hand.y - 7);
  g.fillStyle(C.wheat);
  for (const dx of [-2.5, -0.5, 1.5]) g.fillEllipse(hand.x + dx - 1.2, hand.y - 8, 2.4, 4);
}

/**
 * Farmers in the fields wear stronger colours than the farmer walker (white linen, indigo, madder
 * red) so they stand out against golden wheat and brown soil at the minimum zoom.
 */
const FIELDHAND_LOOKS: Look[] = [
  { skin: SKIN[1], robe: CLOTH.white, head: CLOTH.red, sash: CLOTH.brown, beard: HAIR },
  { skin: SKIN[2], robe: CLOTH.indigo, head: CLOTH.white, sash: CLOTH.ochre, beard: HAIR },
  { skin: SKIN[0], robe: CLOTH.red, head: CLOTH.linen, sash: CLOTH.dark, beard: BEARD_BROWN },
];
export const FIELDHAND_LOOK_COUNT = FIELDHAND_LOOKS.length;

/** A farmer of a look in a field work pose, on a FIELDHAND_SIZE canvas. */
export function drawFieldhand(g: G, look: number, pose: number) {
  const [w, h] = FIELDHAND_SIZE;
  const L = FIELDHAND_LOOKS[look];
  const F = h - 2;
  const cx = w / 2;
  const body = { ...L, cover: 'headcloth' as Cover, short: true };
  shadowAt(g, cx, F, 11);
  switch (pose) {
    case 0: {
      const r = person(g, cx, F, { ...body, arm: 'up', lean: -0.6 }, 1);
      hoe(g, { x: r.hand.x + 1.5, y: r.hand.y + 2 }, { x: r.hand.x - 7, y: r.hand.y - 3.5 }, { x: 0.35, y: 0.94 });
      break;
    }
    case 1: {
      const r = person(g, cx, F, { ...body, arm: 'low', lean: 3 }, 0);
      hoe(g, { x: r.hand.x - 4, y: r.hand.y - 4 }, { x: cx + 12, y: F - 4 }, { x: 0.2, y: 0.98 });
      g.fillStyle(SOIL);
      [[13, -1.5], [15.5, -3], [11, -3.5]].forEach(([dx, dy]) => g.fillCircle(cx + dx, F + dy, 0.9));
      break;
    }
    case 2:
    case 3: {
      const r = person(g, cx - 1, F, { ...body, arm: pose === 2 ? 'low' : 'reach', lean: 4.5, bent: true }, 0);
      if (pose === 2) sickle(g, r.hand);
      else handful(g, r.hand);
      break;
    }
    case 4:
    case 5: {
      const r = person(g, cx, F, { ...body, arm: 'staff' }, pose - 4);
      hoe(g, { x: r.hand.x + 0.6, y: F - 1 }, { x: r.hand.x - 0.6, y: F - 27 }, { x: 0.94, y: 0.35 });
      break;
    }
    default: {
      sheaf(g, { x: cx - 1, y: F - 9 });
      const r = person(g, cx, F, { ...body, arm: 'front' }, pose - 6);
      sickle(g, r.hand);
    }
  }
}

// ---------- food workers (render only, see Haulers.ts) ----------

/** Grain carrier with a sack (to the granary) or coming back empty-handed, fisherman, fruit gatherer. */
export type HaulerKind = 'sack' | 'empty' | 'fisher' | 'gatherer';
export const HAULER_KINDS: readonly HaulerKind[] = ['sack', 'empty', 'fisher', 'gatherer'];
export const HAULER_SIZE: [number, number] = [30, 38];

const HAULER_LOOKS: Record<'fisher' | 'gatherer', Look[]> = {
  fisher: [
    { skin: SKIN[1], robe: CLOTH.linen, head: CLOTH.blue, sash: CLOTH.brown, beard: HAIR },
    { skin: SKIN[2], robe: CLOTH.wool, head: CLOTH.white, sash: CLOTH.indigo, beard: HAIR },
    { skin: SKIN[0], robe: CLOTH.blue, head: CLOTH.linen, sash: CLOTH.dark, beard: BEARD_BROWN },
  ],
  gatherer: [
    { skin: SKIN[1], robe: CLOTH.rust, head: CLOTH.linen, sash: CLOTH.dark },
    { skin: SKIN[0], robe: CLOTH.indigo, head: CLOTH.ochre, sash: CLOTH.red },
    { skin: SKIN[2], robe: CLOTH.brown, head: CLOTH.white, sash: CLOTH.blue },
  ],
};

/** A fishing net bundled over the shoulder, with its cork floats. */
function netBundle(g: G, back: Pt) {
  const x = back.x - 1;
  const y = back.y + 1;
  const outline = [{ x: x - 5, y: y - 6 }, { x: x + 2.5, y: y - 7 }, { x: x + 3, y: y + 3 }, { x: x - 1.5, y: y + 10 }, { x: x - 6.5, y: y + 6 }];
  g.fillStyle(shade(C.net, 0.7), 0.95);
  g.fillPoints(outline, true);
  g.lineStyle(0.8, shade(C.net, 1.15), 0.9);
  for (let k = 0; k < 4; k++) g.lineBetween(x - 4.5 + k * 2.2, y - 6.5, x - 5.5 + k * 2, y + 7);
  for (let k = 0; k < 5; k++) g.lineBetween(x - 5.8, y - 4 + k * 2.6, x + 2.4, y - 5 + k * 2.4);
  g.fillStyle(0xd9a85a);
  [[-4.5, -6.2], [-1, -7], [2.2, -6.6]].forEach(([dx, dy]) => g.fillCircle(x + dx, y + dy, 1.2));
}

/** A small basket of fish at the hip, tails sticking out. */
function fishBasket(g: G, hand: Pt) {
  const x = hand.x + 1;
  const y = hand.y + 2.5;
  g.fillStyle(C.fish);
  g.fillEllipse(x - 2, y - 4.5, 2.4, 5);
  g.fillEllipse(x + 1.8, y - 5, 2.4, 5.5);
  g.fillTriangle(x - 3.6, y - 8, x - 0.4, y - 8, x - 2, y - 6);
  g.fillStyle(C.wicker);
  g.fillPoints([{ x: x - 4.8, y: y - 3 }, { x: x + 4.8, y: y - 3 }, { x: x + 3.6, y: y + 3 }, { x: x - 3.6, y: y + 3 }], true);
  g.lineStyle(1, shade(C.wicker, 0.6), 0.9);
  g.lineBetween(x - 4.2, y - 0.5, x + 4.2, y - 0.5);
}

/** A wide flat basket of olives, figs and dates balanced on the head. */
function headBasket(g: G, top: Pt) {
  const { x, y } = top;
  const fruit = [C.oliveFruit, C.figFruit, C.dateFruit, C.oliveGreen, C.figFruit, C.oliveFruit, C.dateFruit];
  fruit.forEach((c, k) => {
    g.fillStyle(c);
    g.fillCircle(x - 5 + k * 1.7, y - 4.5 - Math.sin((k / 6) * Math.PI) * 2.6, 2);
  });
  g.fillStyle(shade(C.wicker, 0.75));
  g.fillPoints([{ x: x - 7, y: y - 4 }, { x: x + 7, y: y - 4 }, { x: x + 5.5, y: y + 0.5 }, { x: x - 5.5, y: y + 0.5 }], true);
  g.fillStyle(C.wicker);
  g.fillEllipse(x, y - 4, 14, 2.4);
  g.lineStyle(1, shade(C.wicker, 0.55), 0.9);
  g.lineBetween(x - 6, y - 1.8, x + 6, y - 1.8);
}

/** A food worker of a kind and look in step frame 0 or 1, on a HAULER_SIZE canvas facing right. */
export function drawHauler(g: G, kind: HaulerKind, look: number, frame: number) {
  const [w, h] = HAULER_SIZE;
  const F = h - 2;
  const cx = w / 2;
  shadowAt(g, cx, F, 11);
  switch (kind) {
    case 'sack': {
      const L = LOOKS.porter[look % LOOKS.porter.length];
      const r = person(g, cx + 1, F, { ...L, cover: 'headcloth', arm: 'back', short: true, lean: 2.6 }, frame);
      sack(g, r.back);
      break;
    }
    case 'empty': {
      const L = LOOKS.porter[look % LOOKS.porter.length];
      person(g, cx, F, { ...L, cover: 'headcloth', arm: 'swing', short: true }, frame);
      break;
    }
    case 'fisher': {
      const L = HAULER_LOOKS.fisher[look % 3];
      netBundle(g, { x: cx - 2.6, y: F - 14 });
      const r = person(g, cx, F, { ...L, cover: 'headcloth', arm: 'front', short: true }, frame);
      fishBasket(g, r.hand);
      break;
    }
    case 'gatherer': {
      const L = HAULER_LOOKS.gatherer[look % 3];
      const r = person(g, cx, F, { ...L, cover: 'mantle', arm: 'up' }, frame);
      headBasket(g, r.top);
      break;
    }
  }
}

// ---------- people walking to a house ----------

/** Who walks to a house: an engaged or married couple, or a family that came with a caravan. */
export type TravelerKind = 'couple' | 'caravan';
export const TRAVELER_KINDS: readonly TravelerKind[] = ['couple', 'caravan'];
export const TRAVELER_SIZE: Record<TravelerKind, [number, number]> = { couple: [32, 36], caravan: [64, 40] };

/** Bedding and household goods tied in bundles on a donkey's back, standing at (x, F). */
function bundles(g: G, x: number, F: number) {
  const roll = (cx: number, cy: number, w: number, h: number, c: number, stripe: number) => {
    g.fillStyle(shade(c, 0.75));
    g.fillEllipse(cx + 0.6, cy + 0.6, w, h);
    g.fillStyle(c);
    g.fillEllipse(cx, cy, w, h);
    g.fillStyle(stripe);
    g.fillRect(cx - 1, cy - h / 2 + 0.6, 2, h - 1.2);
    g.lineStyle(1, shade(c, 0.45), 0.8);
    g.strokeEllipse(cx, cy, w, h);
  };
  roll(x - 2, F - 22, 12, 6, CLOTH.wool, CLOTH.red);
  roll(x + 3, F - 26.5, 10, 5.5, CLOTH.indigo, CLOTH.linen);
  // A cooking pot hung on the side.
  g.fillStyle(0x3a3330);
  g.fillEllipse(x - 8.5, F - 12, 5, 4.5);
  g.lineStyle(1, C.rope);
  g.lineBetween(x - 8.5, F - 14, x - 6, F - 17);
}

/** A bundle wrapped in cloth balanced on the head. */
function headBundle(g: G, top: Pt) {
  g.fillStyle(shade(CLOTH.ochre, 0.75));
  g.fillEllipse(top.x + 0.5, top.y - 2.2, 11, 6);
  g.fillStyle(CLOTH.ochre);
  g.fillEllipse(top.x, top.y - 3, 10, 5.4);
  g.lineStyle(1, shade(CLOTH.ochre, 0.5), 0.9);
  g.lineBetween(top.x - 4, top.y - 3, top.x + 4, top.y - 3.4);
}

/**
 * People walking to a house, facing right, in step frame 0 or 1, on a canvas of TRAVELER_SIZE:
 * a couple hand in hand (he carries a sack, she leads), or a caravan family: the father leading a
 * donkey laden with bundles, the mother with a bundle on her head and a child.
 */
export function drawTraveler(g: G, kind: TravelerKind, frame: number) {
  const [w, h] = TRAVELER_SIZE[kind];
  const F = h - 2;
  if (kind === 'couple') {
    const he = LOOKS.porter[0];
    const she = LOOKS.basketWoman[0];
    shadowAt(g, w / 2, F, 24);
    // He walks behind with a sack, holding her hand; she reaches back to him.
    const a = person(g, w / 2 - 5.5, F, { ...he, cover: 'headcloth', arm: 'low' }, frame);
    sack(g, { x: a.back.x + 1, y: a.back.y + 1 });
    const b = person(g, w / 2 + 5.5, F, { ...she, cover: 'mantle', arm: 'hold' }, 1 - frame);
    g.lineStyle(2, she.skin);
    g.lineBetween(a.hand.x, a.hand.y, b.hand.x, b.hand.y);
    return;
  }
  const cx = w / 2;
  // Mother and child at the back, the laden donkey, the father at the halter.
  shadowAt(g, cx - 22, F, 10);
  const mom = person(g, cx - 22, F, { ...LOOKS.basketWoman[2], cover: 'mantle', arm: 'up' }, frame);
  headBundle(g, mom.top);
  shadowAt(g, cx - 13, F, 7);
  person(g, cx - 13, F - (frame === 1 ? 1 : 0), { ...LOOKS.child[0], cover: 'hair', arm: 'swing', short: true, s: 0.66 }, 1 - frame);
  donkey(g, cx + 2, F, frame, 0x8d8072, 0x9a7448);
  bundles(g, cx + 2, F);
  shadowAt(g, cx + 22, F, 10);
  const dad = person(g, cx + 22, F, { ...LOOKS.shepherd[0], cover: 'headcloth', arm: 'back' }, frame);
  g.lineStyle(1, C.rope, 0.95);
  g.lineBetween(dad.hand.x, dad.hand.y, cx + 14, F - 16);
}

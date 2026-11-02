import Phaser from 'phaser';
import { HH, HW } from './iso';
import { FIELDHAND_LOOK_COUNT as LOOKS } from './residents';
import { PARTS, TEX } from './textures';

/** Furrows the farmers work in, between crop rows (local y, from the field center). */
const FURROWS = [-0.165, 0.495];
/** Where each furrow's farmer starts (local x), plus up to SPREAD by chance. */
const START_X = [-0.5, 0.02];
const SPREAD = 0.15;
/** Short steps along the furrow: STEPS spots STEP apart, walked back and forth. */
const STEP = 0.07;
const STEPS = 4;
/** Work strokes between two steps (the next cycle is the step itself). */
const STROKES = 4;
const CROP_DEPTH = PARTS.wheat.map((w) => w.x + w.y);
/**
 * Tufts of the row just in front of a farmer that would hide him are left out (a patch already
 * worked): those from CLEAR_BEHIND before his first spot to CLEAR_AHEAD after it, along the row.
 */
const CLEAR_BEHIND = 0.2;
const CLEAR_AHEAD = STEP * (STEPS - 1) + 0.5;
/** How far in front of a farmer (local y) a tuft counts as the row just ahead of him. */
const ROW_AHEAD = 0.2;
const Z = PARTS.wheat[0].z - 2;
/**
 * Farmers sort a little in front of their own spot, so the tufts behind and to the side of them
 * (same depth in a furrow) never cover them; the row in front is cleared instead.
 */
const DEPTH_BIAS = 0.2;
/** Slightly bigger than street walkers, to read inside a field at the minimum zoom. */
const SCALE = 1.1;

interface Hand {
  img: Phaser.GameObjects.Image;
  look: number;
  hoe: boolean;
  x0: number;
  y: number;
  /** Seconds per stroke, and a random offset in strokes, so farmers never move in sync. */
  period: number;
  phase: number;
  /** Spot along the furrow the image is sorted for (-1 = not sorted yet). */
  spot: number;
}

/**
 * Farmers working in place inside one field: hoeing or stooping to cut stalks, with a short step
 * along their furrow now and then. They live in the field's container (local coordinates as seen on
 * screen, like the crop tufts) and are sorted among the tufts by local depth, so they stand between
 * the crop rows in any map rotation; a mirrored field mirrors their spots like its rows.
 */
export class FieldCrew {
  private hands: Hand[] = [];

  constructor(
    private scene: Phaser.Scene,
    private root: Phaser.GameObjects.Container,
    private crops: Phaser.GameObjects.Image[],
    private mirrored: boolean,
  ) {}

  get count() {
    return this.hands.length;
  }

  /** Adds or removes farmers (called on sync, never per frame). */
  setCount(n: number) {
    if (n === this.hands.length) return;
    while (this.hands.length > n) this.hands.pop()!.img.destroy();
    while (this.hands.length < n) {
      const k = this.hands.length % FURROWS.length;
      // A second farmer never wears the same clothes as the first.
      const prev = this.hands[this.hands.length - 1];
      const look = prev ? (prev.look + 1 + Math.floor(Math.random() * (LOOKS - 1))) % LOOKS : Math.floor(Math.random() * LOOKS);
      const hoe = Math.random() < 0.5;
      const img = this.scene.add.image(0, 0, TEX.fieldhand(look, 0)).setOrigin(0.5, 1).setScale(SCALE);
      this.root.add(img);
      this.hands.push({
        img,
        look,
        hoe,
        x0: START_X[k] + Math.random() * SPREAD,
        y: FURROWS[k],
        period: (hoe ? 0.85 : 1.3) * (0.85 + Math.random() * 0.3),
        phase: Math.random() * (STROKES + 1) * STEPS,
        spot: -1,
      });
    }
    this.clearPatches();
  }

  private clearPatches() {
    PARTS.wheat.forEach((w, k) => {
      const worked = this.hands.some((h) => w.y > h.y && w.y - h.y < ROW_AHEAD && w.x > h.x0 - CLEAR_BEHIND && w.x < h.x0 + CLEAR_AHEAD);
      this.crops[k].setVisible(!worked);
    });
  }

  /** `work` is the game-speed clock in seconds (stops when paused). */
  update(work: number) {
    for (const h of this.hands) {
      const u = work / h.period + h.phase;
      const c = Math.floor(u);
      const f = u - c;
      const round = Math.floor(c / (STROKES + 1));
      const m = round % (2 * (STEPS - 1));
      const spot = m < STEPS - 1 ? m : 2 * (STEPS - 1) - m;
      const dir = m < STEPS - 1 ? 1 : -1;
      const stepping = c % (STROKES + 1) === STROKES;
      const x = h.x0 + (spot + (stepping ? f * dir : 0)) * STEP;
      const pose = stepping ? (h.hoe ? 4 : 6) + (f < 0.5 ? 0 : 1) : h.hoe ? (f < 0.45 ? 0 : 1) : f < 0.6 ? 2 : 3;
      const key = TEX.fieldhand(h.look, pose);
      if (h.img.texture.key !== key) h.img.setTexture(key);
      const bob = stepping ? Math.abs(Math.sin(f * Math.PI * 2)) * 1.2 : 0;
      h.img.setPosition((x - h.y) * HW * (this.mirrored ? -1 : 1), (x + h.y) * HH - Z - bob);
      h.img.setFlipX(dir < 0 !== this.mirrored);
      if (spot !== h.spot) this.sort(h, spot, x + h.y + DEPTH_BIAS);
    }
  }

  /** Puts the farmer just behind the first crop tuft in front of him. */
  private sort(h: Hand, spot: number, depth: number) {
    h.spot = spot;
    const k = CROP_DEPTH.findIndex((d) => d > depth);
    this.root.remove(h.img);
    if (k < 0) this.root.add(h.img);
    else this.root.addAt(h.img, this.root.getIndex(this.crops[k]));
  }
}

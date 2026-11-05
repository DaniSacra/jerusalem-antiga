import Phaser from 'phaser';
import VISUAL from '../data/visual.json';
import { inRect, type Rect } from './layout';
import { C, CSS } from './palette';
import { T } from './strings';
import { button, panel, RailButton, text } from './ui';

/** Where the arrow points: a screen point and the direction the arrow points in. */
export interface TutorialTarget {
  x: number;
  y: number;
  dir: 'down' | 'up' | 'left' | 'right';
}

const ANGLE = { down: 0, up: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 } as const;
const BUBBLE_H = 60;
const SKIP_W = 170;
const OK_W = 130;
const BTN_H = 44;

/** Where the tutorial bubble goes: its horizontal center, its bottom edge and its widest size. */
export interface TutorialArea {
  cx: number;
  bottom: number;
  maxW: number;
  /** Size multiplier of the bubble (the Nova keeps its buttons at 44 real px on phones). */
  scale?: number;
}

/** The tutorial on the UI overlay: a one-sentence bubble above the bottom of the screen and a bobbing arrow. */
export class TutorialView {
  private root: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private skipBtn: RailButton;
  private okBtn: ReturnType<typeof button>;
  private arrow: Phaser.GameObjects.Container;
  private rect: Rect | null = null;
  private shown = '';

  constructor(scene: Phaser.Scene, onSkip: () => void, onOk: () => void, private area: TutorialArea) {
    this.bg = scene.add.graphics();
    this.label = text(scene, 0, 0, '', 20, CSS.ink, true).setOrigin(0, 0.5);
    this.skipBtn = new RailButton(scene, 0, 0, SKIP_W, BTN_H, [text(scene, 0, -1, T.tutorial.skip, 17, CSS.ink, true).setOrigin(0.5)], onSkip);
    this.okBtn = button(scene, 0, 0, OK_W, BTN_H, T.tutorial.ok, 19, onOk);
    this.root = scene.add.container(0, 0, [this.bg, this.label, this.okBtn.container, this.skipBtn.root]).setDepth(40).setVisible(false);

    // Arrow drawn pointing down with its tip at (0, 0); the container turns it, the shape bobs.
    const g = scene.add.graphics();
    g.fillStyle(C.shadow, 0.3);
    g.fillPoints(arrowShape(3), true);
    g.fillStyle(C.ui.goldLight);
    g.fillPoints(arrowShape(0), true);
    g.lineStyle(3, C.border, 1);
    g.strokePoints(arrowShape(0), true, true);
    const bob = VISUAL.tutorial.arrowBob;
    scene.tweens.add({ targets: g, y: -bob, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.arrow = scene.add.container(0, 0, [g]).setScale(VISUAL.tutorial.arrowScale).setDepth(41).setVisible(false);
  }

  /** Shows a sentence (null hides the tutorial); `ok` adds the "Entendi" button. */
  set(sentence: string | null, ok = false) {
    const key = sentence === null ? '' : `${sentence}|${ok}`;
    if (key === this.shown) return;
    this.shown = key;
    this.root.setVisible(sentence !== null);
    this.rect = null;
    if (sentence === null) {
      this.point(null);
      return;
    }
    // Laid out at scale 1 from the bubble's corner; the root is moved there and scaled.
    const k = this.area.scale ?? 1;
    const buttons = SKIP_W + 16 + (ok ? OK_W + 12 : 0);
    this.label.setText(sentence).setWordWrapWidth(this.area.maxW / k - buttons - 40);
    const h = Math.max(BUBBLE_H, this.label.height + 20);
    const w = Math.round(this.label.width + buttons + 44);
    const x = this.area.cx - (w * k) / 2;
    const y = this.area.bottom - h * k;
    this.rect = { x, y, w: w * k, h: h * k };
    this.root.setPosition(x, y).setScale(k);
    this.bg.clear();
    panel(this.bg, 0, 0, w, h, C.parchment, 14);
    this.label.setPosition(22, h / 2);
    this.okBtn.container.setVisible(ok).setPosition(22 + this.label.width + 16 + OK_W / 2, h / 2);
    this.skipBtn.root.setPosition(w - 12 - SKIP_W / 2, h / 2);
  }

  point(target: TutorialTarget | null) {
    this.arrow.setVisible(!!target && this.root.visible);
    if (target) this.arrow.setPosition(target.x, target.y).setRotation(ANGLE[target.dir]);
  }

  contains(x: number, y: number) {
    return !!this.rect && inRect(this.rect, x, y);
  }

  /** Top edge of the bubble (null while hidden). */
  get top(): number | null {
    return this.rect?.y ?? null;
  }
}

/** Arrow pointing down, tip at (0, dy). */
const arrowShape = (dy: number) =>
  [
    [0, 0],
    [-20, -22],
    [-8, -22],
    [-8, -52],
    [8, -52],
    [8, -22],
    [20, -22],
  ].map(([x, y]) => ({ x: x + dy, y: y + dy }));

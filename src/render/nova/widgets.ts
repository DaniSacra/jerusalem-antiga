import Phaser from 'phaser';
import { inRect, px, type Rect } from '../layout';
import { NOVA, NOVA_CSS, NOVA_FONT } from '../palette';
import { TEX, type UiIcon } from '../textures';
import { S } from './metrics';

/** Text in the Nova font; `size` in game px (use the sizes of `S`). */
export function ntext(scene: Phaser.Scene, x: number, y: number, str: string, size: number, color: string = NOVA_CSS.text, bold = true) {
  return scene.add.text(x, y, str, {
    fontFamily: NOVA_FONT,
    fontSize: `${Math.round(size * 10) / 10}px`,
    fontStyle: bold ? 'bold' : 'normal',
    color,
    resolution: 2,
  });
}

/** A texture shown at a size (its larger side), or a text glyph if the texture is missing. */
export function picture(scene: Phaser.Scene, key: string, size: number, glyph = '?'): Phaser.GameObjects.Image | Phaser.GameObjects.Text {
  if (scene.textures.exists(key)) {
    const img = scene.add.image(0, 0, key);
    return img.setScale(size / Math.max(img.width, img.height));
  }
  return ntext(scene, 0, 0, glyph, size * 0.8, NOVA_CSS.ink).setOrigin(0.5);
}

/** A line icon of the interface (dark on parchment, light on dark buttons). */
export const icon = (scene: Phaser.Scene, name: UiIcon, size: number, tone: 'dark' | 'light' = 'dark') => picture(scene, TEX.uiIcon(name, tone), size, '•');

/** Dark see-through panel with a subtle light border (bars and pills). */
export function darkPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, r = h / 2, alpha: number = NOVA.panelAlpha) {
  const rr = Math.min(r, h / 2, w / 2);
  g.fillStyle(NOVA.panel, alpha);
  g.fillRoundedRect(x, y, w, h, rr);
  g.lineStyle(Math.max(1, px(1.5)), NOVA.edge, NOVA.edgeAlpha);
  g.strokeRoundedRect(x, y, w, h, rr);
}

export type ArrowSide = 'left' | 'right' | 'up' | 'down';

/**
 * A dark balloon in one path, so the arrow has no seam: rounded box with a small triangle on one
 * side, its tip `s` outside the box, centered at `at` along that side (clamped to the straight part).
 */
export function balloon(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, arrow: { side: ArrowSide; at: number } | null, r = px(12)) {
  const s = px(9);
  const along = (len: number) => Math.max(r + s, Math.min(len - r - s, arrow?.at ?? 0));
  g.fillStyle(NOVA.panel, NOVA.balloonAlpha);
  g.lineStyle(Math.max(1, px(1.5)), NOVA.edge, NOVA.edgeAlpha);
  g.beginPath();
  g.moveTo(x + r, y);
  if (arrow?.side === 'up') {
    const a = x + along(w);
    g.lineTo(a - s, y);
    g.lineTo(a, y - s);
    g.lineTo(a + s, y);
  }
  g.lineTo(x + w - r, y);
  g.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  if (arrow?.side === 'right') {
    const a = y + along(h);
    g.lineTo(x + w, a - s);
    g.lineTo(x + w + s, a);
    g.lineTo(x + w, a + s);
  }
  g.lineTo(x + w, y + h - r);
  g.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  if (arrow?.side === 'down') {
    const a = x + along(w);
    g.lineTo(a + s, y + h);
    g.lineTo(a, y + h + s);
    g.lineTo(a - s, y + h);
  }
  g.lineTo(x + r, y + h);
  g.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  if (arrow?.side === 'left') {
    const a = y + along(h);
    g.lineTo(x, a + s);
    g.lineTo(x - s, a);
    g.lineTo(x, a - s);
  }
  g.lineTo(x, y + r);
  g.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  g.closePath();
  g.fillPath();
  g.strokePath();
}

export type RoundStyle = 'parchment' | 'dark' | 'gold';
export interface RoundLook {
  style?: RoundStyle;
  /** Gold border with a glow (the chosen tool or speed). */
  selected?: boolean;
  /** Dashed border and dim parchment (a building not unlocked yet). */
  locked?: boolean;
  /** Dim parchment (not enough silver). */
  dim?: boolean;
}

const sameLook = (a: RoundLook, b: RoundLook) => a.style === b.style && !!a.selected === !!b.selected && !!a.locked === !!b.locked && !!a.dim === !!b.dim;

/**
 * Everything the player touches is round: a circle (w = h) or a capsule. The touch area is never
 * under 44 real px. `onDown` reacts on press (tools), otherwise on release (toggles).
 */
export class RoundButton {
  readonly root: Phaser.GameObjects.Container;
  private g: Phaser.GameObjects.Graphics;
  private look: RoundLook;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly w: number,
    readonly h: number,
    content: Phaser.GameObjects.GameObject[],
    onPress: () => void,
    look: RoundLook = {},
    onDown = false,
  ) {
    this.look = { ...look };
    this.g = scene.add.graphics();
    this.root = scene.add.container(x, y, [this.g, ...content]).setSize(w, h);
    const touch = Math.max(px(44), h);
    const shape =
      w === h
        ? { hitArea: new Phaser.Geom.Circle(w / 2, h / 2, touch / 2), hitAreaCallback: Phaser.Geom.Circle.Contains }
        : { hitArea: new Phaser.Geom.Rectangle(0, (h - touch) / 2, w, touch), hitAreaCallback: Phaser.Geom.Rectangle.Contains };
    this.root.setInteractive({ ...shape, useHandCursor: true });
    this.draw();
    const press = (on: boolean) => this.root.setScale(on ? 0.93 : 1);
    this.root.on('pointerdown', () => {
      press(true);
      if (onDown) onPress();
    });
    this.root.on('pointerout', () => press(false));
    this.root.on('pointerup', () => {
      press(false);
      if (!onDown) onPress();
    });
  }

  setLook(look: RoundLook) {
    if (sameLook(look, this.look)) return;
    this.look = { ...look };
    this.draw();
  }

  /** True if a point (UI coordinates) is on the button. */
  contains(x: number, y: number) {
    if (!this.root.visible) return false;
    const m = this.root.getWorldTransformMatrix();
    const cx = m.tx;
    const cy = m.ty;
    if (this.w === this.h) return Math.hypot(x - cx, y - cy) <= Math.max(px(44), this.h) / 2;
    return Math.abs(x - cx) <= this.w / 2 && Math.abs(y - cy) <= this.h / 2;
  }

  private draw() {
    const { w, h } = this;
    const { style = 'parchment', selected, locked, dim } = this.look;
    const g = this.g.clear();
    const circle = w === h;
    const r = h / 2;
    const shape = (dx: number, dy: number, grow = 0, fill = true) => {
      if (circle) (fill ? g.fillCircle(dx, dy, r + grow) : g.strokeCircle(dx, dy, r + grow));
      else if (fill) g.fillRoundedRect(-w / 2 - grow + dx, -h / 2 - grow + dy, w + 2 * grow, h + 2 * grow, r + grow);
      else g.strokeRoundedRect(-w / 2 - grow + dx, -h / 2 - grow + dy, w + 2 * grow, h + 2 * grow, r + grow);
    };
    if (selected) {
      g.fillStyle(NOVA.goldLight, 0.28);
      shape(0, 0, px(5));
    }
    g.fillStyle(0x000000, 0.28);
    shape(0, px(2));
    const fill = style === 'gold' ? NOVA.gold : style === 'dark' ? NOVA.panel : locked || dim ? NOVA.parchmentDim : NOVA.parchment;
    g.fillStyle(fill, style === 'dark' ? 0.85 : 1);
    shape(0, 0);
    if (selected) {
      g.lineStyle(px(3), NOVA.gold, 1);
      shape(0, 0, 0, false);
    } else if (locked && circle) {
      g.lineStyle(px(2), NOVA.border, 0.75);
      const n = 16;
      for (let k = 0; k < n; k++) {
        g.beginPath();
        g.arc(0, 0, r - px(1), (k * 2 * Math.PI) / n, ((k + 0.55) * 2 * Math.PI) / n);
        g.strokePath();
      }
    } else if (style === 'dark') {
      g.lineStyle(Math.max(1, px(1.5)), NOVA.edge, NOVA.edgeAlpha);
      shape(0, 0, 0, false);
    } else {
      g.lineStyle(px(2), NOVA.border, 1);
      shape(0, 0, 0, false);
    }
  }
}

/** Small dark name tag under a round button. */
export function nameTag(scene: Phaser.Scene, x: number, y: number, label: string): { objects: (Phaser.GameObjects.Graphics | Phaser.GameObjects.Text)[]; w: number; h: number } {
  const t = ntext(scene, x, y, label, S.small).setOrigin(0.5);
  const w = t.width + px(12);
  const h = S.labelH;
  const g = scene.add.graphics();
  darkPanel(g, x - w / 2, y - h / 2, w, h, h / 2, 0.85);
  return { objects: [g, t], w, h };
}

/** A rectangle registry for `isOverUi`: each entry gives its current rect, or null when hidden. */
export type HitSource = () => Rect | null;
export const hitAny = (sources: HitSource[], x: number, y: number) => sources.some((f) => {
  const r = f();
  return !!r && inRect(r, x, y);
});

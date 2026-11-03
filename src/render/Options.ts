import Phaser from 'phaser';
import { GAME_W, inRect, OPTIONS, PAD, type Rect } from './layout';
import { CSS } from './palette';
import { saveSettings, settings, uiMode, type Settings } from './settings';
import { T } from './strings';
import { TEX } from './textures';
import { RailButton, stonePanel, text } from './ui';

const ROW_W = 330;
const ROW_H = 60;
const GAP = 8;
const TITLE_H = 36;

/** Gear button with a small panel of display options (interface, day and night, miniature blur). */
export class Options {
  private panel: Phaser.GameObjects.Container;
  private rect: Rect;
  private rows: { key: keyof Settings | 'ui'; label: Phaser.GameObjects.Text; btn: RailButton }[] = [];
  private gear: RailButton;
  /** Set when the miniature blur was turned off because the device is slow. */
  private slow = false;

  /** `onInterface` switches to the Nova interface (the UI scene is rebuilt). */
  constructor(scene: Phaser.Scene, onChange: () => void, onInterface: () => void) {
    const g = scene.add.graphics();
    stonePanel(g, OPTIONS.x, OPTIONS.y, OPTIONS.w, OPTIONS.h);
    const size = OPTIONS.w - 2 * PAD;
    this.gear = new RailButton(scene, OPTIONS.x + OPTIONS.w / 2, OPTIONS.y + OPTIONS.h / 2, size, size, [scene.add.image(0, -1, TEX.icon('options')).setScale(1.05)], () => this.toggle());

    const w = ROW_W + 2 * PAD + 8;
    const h = TITLE_H + 3 * (ROW_H + GAP) + 2 * PAD;
    const x = Math.min(GAME_W - PAD - w, OPTIONS.x + OPTIONS.w - w);
    const y = OPTIONS.y + OPTIONS.h + 8;
    this.rect = { x, y, w, h };
    const bg = scene.add.graphics();
    stonePanel(bg, 0, 0, w, h);
    const title = text(scene, w / 2, PAD + TITLE_H / 2 + 2, T.options.title, 20, CSS.ink, true).setOrigin(0.5);
    // A zone the size of the panel under the rows, so a tap on its title or edges stays in the panel.
    const block = scene.add.zone(0, 0, w, h).setOrigin(0).setInteractive();
    this.panel = scene.add.container(x, y, [block, bg, title]).setDepth(50).setVisible(false);
    (['dayNight', 'miniature', 'ui'] as const).forEach((key, k) => {
      const label = text(scene, 0, -2, '', 19, CSS.ink, true).setOrigin(0.5);
      const btn = new RailButton(scene, w / 2, PAD + TITLE_H + ROW_H / 2 + k * (ROW_H + GAP), ROW_W, ROW_H, [label], () => {
        if (key === 'ui') return onInterface();
        if (key === 'miniature' && this.slow) return;
        settings[key] = !settings[key];
        saveSettings();
        this.paint();
        onChange();
      });
      this.panel.add(btn.root);
      this.rows.push({ key, label, btn });
    });
    this.paint();
    // A tap anywhere else closes the panel.
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.panel.visible && !this.contains(p.x, p.y)) this.toggle(false);
    });
  }

  /** The miniature blur was switched off because the frame rate stayed low. */
  setSlow(slow: boolean) {
    if (slow === this.slow) return;
    this.slow = slow;
    this.paint();
  }

  private toggle(open = !this.panel.visible) {
    this.panel.setVisible(open);
    this.gear.setLook(open ? 'active' : 'normal');
  }

  private paint() {
    for (const r of this.rows) {
      if (r.key === 'ui') {
        r.label.setText(T.options.ui(uiMode()));
        continue;
      }
      const on = settings[r.key];
      r.label.setText(r.key === 'dayNight' ? T.options.dayNight(on) : this.slow ? T.options.miniatureSlow : T.options.miniature(on));
      r.btn.setLook(r.key === 'miniature' && this.slow ? 'disabled' : on ? 'active' : 'normal');
    }
  }

  contains(x: number, y: number) {
    return inRect(OPTIONS, x, y) || (this.panel.visible && inRect(this.rect, x, y));
  }
}

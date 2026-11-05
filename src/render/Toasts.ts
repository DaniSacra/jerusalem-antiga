import Phaser from 'phaser';
import { ToastQueue, type ToastItem, type ToastOptions, type Tone } from '../game/toastQueue';
import { GAME_W, px } from './layout';
import { NOVA, NOVA_CSS } from './palette';
import { lineH, S } from './nova/metrics';
import { darkPanel, ntext } from './nova/widgets';

export type { ToastOptions, Tone };

/** Above the balloons and panels (46–50), under the victory and defeat dialogs (100). */
const DEPTH = 60;

interface Drawn {
  root: Phaser.GameObjects.Container;
  h: number;
}

/**
 * Short messages at the bottom center, the newest with its bottom at `y0`, older ones stacking upward.
 * Which toasts show and for how long is the pure `ToastQueue` (src/game); this only draws it.
 */
export class Toasts {
  private q = new ToastQueue();
  private drawn = new Map<number, Drawn>();

  /** `y0`: bottom edge of the newest toast (see `setBottom`); `maxW`: widest a toast may be (it wraps). */
  constructor(private scene: Phaser.Scene, private y0: number, private maxW = px(520)) {
    const tick = (_t: number, dt: number) => {
      const before = this.q.list.length;
      this.q.tick(dt);
      if (this.q.list.length !== before || this.q.list.some((t) => !this.drawn.has(t.id))) this.sync();
    };
    scene.events.on('update', tick);
    scene.events.once('shutdown', () => scene.events.off('update', tick));
  }

  /** On screen, newest first, with their drawing (the visual tests read it). */
  get list(): (ToastItem & Partial<Drawn>)[] {
    return this.q.list.map((t) => ({ ...t, ...this.drawn.get(t.id) }));
  }

  /** Waiting for room (the visual tests read it). */
  get queue() {
    return this.q.queue;
  }

  /** Moves the bottom edge (e.g. above the tutorial bubble while it shows); the toasts glide there. */
  setBottom(y: number) {
    if (Math.abs(y - this.y0) < 0.5) return;
    this.y0 = y;
    this.layout();
  }

  show(msg: string, tone: Tone = 'info', opt: ToastOptions = {}) {
    this.q.show(msg, tone, opt);
    this.sync();
  }

  /** Top edge of the toasts on screen (null when there are none). */
  get top(): number | null {
    const shown = this.q.list.map((t) => this.drawn.get(t.id)).filter((d): d is Drawn => !!d);
    if (!shown.length) return null;
    return this.y0 - shown.reduce((sum, d) => sum + d.h + px(6), -px(6));
  }

  /** Holds the toasts while a panel or a tapped building's balloon is open (see ToastQueue.hold). */
  hold(on: boolean) {
    this.q.hold(on);
    this.sync(120);
  }

  /** After the city changes: warnings that no longer hold leave the line and the screen. */
  prune() {
    this.q.prune();
    this.sync();
  }

  /** Draws the toasts the queue shows now: new ones fade in, gone ones fade out. */
  private sync(fadeMs = 250) {
    const ids = new Set(this.q.list.map((t) => t.id));
    for (const [id, d] of this.drawn) {
      if (ids.has(id)) continue;
      this.drawn.delete(id);
      this.scene.tweens.add({ targets: d.root, alpha: 0, duration: fadeMs, onComplete: () => d.root.destroy() });
    }
    for (const t of this.q.list) if (!this.drawn.has(t.id)) this.drawn.set(t.id, this.draw(t));
    this.layout();
  }

  private draw(t: ToastItem): Drawn {
    const s = this.scene;
    const { msg, tone, opt } = t;
    const size = opt.big ? S.num * 1.2 : S.num;
    const pad = px(opt.big ? 16 : 12);
    const label = ntext(s, 0, 0, msg, size, tone === 'quiet' ? NOVA_CSS.muted : NOVA_CSS.text, tone !== 'quiet')
      .setOrigin(0.5)
      .setAlign('center')
      .setWordWrapWidth(this.maxW - 2 * pad)
      .setLineSpacing(lineH(size) - size * 1.15);
    const w = label.width + 2 * pad;
    const h = Math.max(label.height + px(opt.big ? 18 : 12), px(opt.big ? 44 : 34));
    const bg = s.add.graphics();
    bg.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2 + px(1), -h / 2 + px(2), w, h, Math.min(h / 2, px(16)));
    const fill = tone === 'bad' ? NOVA.toastBad : tone === 'good' ? NOVA.toastGood : NOVA.panel;
    darkPanel(bg, -w / 2, -h / 2, w, h, Math.min(h / 2, px(16)), 0.94);
    if (fill !== NOVA.panel) bg.fillStyle(fill, 0.94).fillRoundedRect(-w / 2, -h / 2, w, h, Math.min(h / 2, px(16)));
    if (opt.big) bg.lineStyle(px(2), NOVA.gold, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, Math.min(h / 2, px(16)));
    const root = s.add.container(GAME_W / 2, this.y0 - h / 2, [bg, label]).setDepth(DEPTH).setAlpha(0);
    s.tweens.add({ targets: root, alpha: 1, duration: 150 });
    return { root, h };
  }

  private layout() {
    let y = this.y0;
    let prevH = 0;
    this.q.list.forEach((t, k) => {
      const d = this.drawn.get(t.id);
      if (!d) return;
      y -= (k ? prevH / 2 + px(6) : 0) + d.h / 2;
      prevH = d.h;
      this.scene.tweens.add({ targets: d.root, y, duration: 150 });
    });
  }
}

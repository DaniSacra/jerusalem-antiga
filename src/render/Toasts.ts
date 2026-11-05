import Phaser from 'phaser';
import { GAME_W, px } from './layout';
import { NOVA, NOVA_CSS } from './palette';
import { lineH, S } from './nova/metrics';
import { darkPanel, ntext } from './nova/widgets';

const DURATION = 2600;
/** Toasts on screen at once; more wait in line (bad news first) instead of pushing the first out. */
const MAX = 3;
/** Above the balloons and panels (46–50), under the victory and defeat dialogs (100). */
const DEPTH = 60;
/** The warning that comes back when a panel or balloon closes stays at least this long. */
const BACK_MS = 1500;

interface Toast {
  msg: string;
  tone: Tone;
  opt: ToastOptions;
  big: boolean;
  alert?: () => number;
  root: Phaser.GameObjects.Container;
  h: number;
  timer: Phaser.Time.TimerEvent;
}

/** `quiet`: grey and discreet (a death of old age). */
export type Tone = 'info' | 'bad' | 'good' | 'quiet';

/** Options of one toast: `big` for the opening sentence (larger, longer on screen). */
export interface ToastOptions {
  big?: boolean;
  ms?: number;
  /**
   * A warning: its place in `alerts()` (0 is the most important), -1 once it no longer holds. It leaves
   * the line and the screen when it stops holding, and only warnings come back after a balloon or panel.
   */
  alert?: () => number;
}

/** News always holds; a warning holds while it is still in `alerts()`. */
const holds = (o: { alert?: () => number }) => !o.alert || o.alert() >= 0;

interface Waiting {
  msg: string;
  tone: Tone;
  opt: ToastOptions;
}

/** Short messages at the bottom center, the newest with its bottom at `y0`, older ones stacking upward. */
export class Toasts {
  private list: Toast[] = [];
  private queue: Waiting[] = [];
  /** A panel is open: new toasts wait in line until it closes (they would cover it). */
  private held = false;

  /** `y0`: bottom edge of the newest toast (see `setBottom`); `maxW`: widest a toast may be (it wraps). */
  constructor(private scene: Phaser.Scene, private y0: number, private maxW = px(520)) {}

  /** Moves the bottom edge (e.g. above the tutorial bubble while it shows); the toasts glide there. */
  setBottom(y: number) {
    if (Math.abs(y - this.y0) < 0.5) return;
    this.y0 = y;
    this.layout();
  }

  show(msg: string, tone: Tone = 'info', opt: ToastOptions = {}) {
    const existing = this.list.find((t) => t.msg === msg);
    if (existing) {
      existing.timer.reset({ delay: opt.ms ?? DURATION, callback: () => this.dismiss(existing) });
      return;
    }
    if (this.queue.some((q) => q.msg === msg)) return;
    if (this.list.length >= this.room()) {
      // Bad news goes before the rest of the line.
      const w = { msg, tone, opt };
      if (tone === 'bad') {
        const k = this.queue.findIndex((q) => q.tone !== 'bad');
        this.queue.splice(k < 0 ? this.queue.length : k, 0, w);
      } else this.queue.push(w);
      return;
    }
    this.add(msg, tone, opt);
  }

  /** Toasts allowed on screen now: none while a panel is open, one beside the opening sentence (big). */
  private room() {
    return this.held ? 0 : this.list.some((t) => t.big) ? 1 : MAX;
  }

  /** Top edge of the toasts on screen (null when there are none). */
  get top(): number | null {
    if (!this.list.length) return null;
    return this.y0 - this.list.reduce((sum, t) => sum + t.h + px(6), -px(6));
  }

  /**
   * Holds the toasts while a panel or a tapped building's balloon is open: the ones on screen step out
   * (they would sit behind it, half covered) and new ones wait. When it closes, at most one comes back:
   * the most important warning that still holds. Past news (a birth, a goal, a failed tap) is dropped;
   * it stays in the Avisos, Objetivos and Povo panels.
   */
  hold(on: boolean) {
    if (on === this.held) return;
    this.held = on;
    if (on) {
      for (const t of this.list) {
        // A warning on screen may be the one that comes back; one already fading out (its time is up) just goes.
        if (t.alert && !t.timer.hasDispatched) this.queue.unshift({ msg: t.msg, tone: t.tone, opt: { ...t.opt, ms: Math.max(BACK_MS, t.timer.getRemaining()) } });
        t.timer.remove();
        this.scene.tweens.add({ targets: t.root, alpha: 0, duration: 120, onComplete: () => t.root.destroy() });
      }
      this.list = [];
    } else this.queue = this.mostUrgent();
    this.flush();
  }

  /** The warning that still holds and comes first in `alerts()`, alone (or nothing). */
  private mostUrgent(): Waiting[] {
    let best: Waiting | null = null;
    let rank = Infinity;
    for (const q of this.queue) {
      const r = q.opt.alert?.() ?? -1;
      if (r >= 0 && r < rank) [best, rank] = [q, r];
    }
    return best ? [best] : [];
  }

  private flush() {
    while (this.queue.length && this.list.length < this.room()) {
      const next = this.queue.shift()!;
      if (!holds(next.opt)) continue;
      this.add(next.msg, next.tone, next.opt);
    }
  }

  /** After the city changes: warnings that no longer hold leave the line and the screen. */
  prune() {
    this.queue = this.queue.filter((q) => holds(q.opt));
    for (const t of this.list) if (!holds(t)) this.dismiss(t);
  }

  private add(msg: string, tone: Tone, opt: ToastOptions) {
    const s = this.scene;
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
    const toast: Toast = { msg, tone, opt, big: !!opt.big, alert: opt.alert, root, h, timer: s.time.delayedCall(opt.ms ?? DURATION, () => this.dismiss(toast)) };
    this.list.unshift(toast);
    this.layout();
  }

  private dismiss(t: Toast) {
    this.scene.tweens.add({ targets: t.root, alpha: 0, duration: 250, onComplete: () => this.remove(t) });
  }

  private remove(t: Toast) {
    const i = this.list.indexOf(t);
    if (i < 0) return;
    this.list.splice(i, 1);
    t.timer.remove();
    t.root.destroy();
    this.layout();
    this.flush();
  }

  private layout() {
    let y = this.y0;
    this.list.forEach((t, k) => {
      y -= (k ? this.list[k - 1].h / 2 + px(6) : 0) + t.h / 2;
      this.scene.tweens.add({ targets: t.root, y, duration: 150 });
    });
  }
}

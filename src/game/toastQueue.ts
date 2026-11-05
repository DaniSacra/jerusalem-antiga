/** The toast line without drawing (pure): which toasts show, which wait, and for how long. */

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

export const TOAST_MS = 2600;
/** Toasts on screen at once; more wait in line (bad news first) instead of pushing the first out. */
export const TOAST_MAX = 3;
/** The warning that comes back when a panel or balloon closes stays at least this long. */
export const TOAST_BACK_MS = 1500;

/** A toast on screen; `left` is its time left in ms. */
export interface ToastItem {
  id: number;
  msg: string;
  tone: Tone;
  opt: ToastOptions;
  left: number;
}

export interface Waiting {
  msg: string;
  tone: Tone;
  opt: ToastOptions;
}

/** News always holds; a warning holds while it is still in `alerts()`. */
const holds = (o: ToastOptions) => !o.alert || o.alert() >= 0;

export class ToastQueue {
  /** On screen, newest first. */
  list: ToastItem[] = [];
  /** Waiting for room, in order. */
  queue: Waiting[] = [];
  /** A panel is open: new toasts wait in line until it closes (they would cover it). */
  private held = false;
  private nextId = 1;

  show(msg: string, tone: Tone = 'info', opt: ToastOptions = {}) {
    const existing = this.list.find((t) => t.msg === msg);
    if (existing) {
      existing.left = opt.ms ?? TOAST_MS;
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

  /** Time passes: toasts whose time is up leave, and the line moves up. */
  tick(ms: number) {
    let gone = false;
    for (const t of this.list) {
      t.left -= ms;
      if (t.left <= 0) gone = true;
    }
    if (!gone) return;
    this.list = this.list.filter((t) => t.left > 0);
    this.flush();
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
      // A warning on screen may be the one that comes back.
      for (const t of this.list) if (t.opt.alert) this.queue.unshift({ msg: t.msg, tone: t.tone, opt: { ...t.opt, ms: Math.max(TOAST_BACK_MS, t.left) } });
      this.list = [];
    } else this.queue = this.mostUrgent();
    this.flush();
  }

  /** After the city changes: warnings that no longer hold leave the line and the screen. */
  prune() {
    this.queue = this.queue.filter((q) => holds(q.opt));
    const before = this.list.length;
    this.list = this.list.filter((t) => holds(t.opt));
    if (this.list.length !== before) this.flush();
  }

  /** Toasts allowed on screen now: none while a panel is open, one beside the opening sentence (big). */
  private room() {
    return this.held ? 0 : this.list.some((t) => t.opt.big) ? 1 : TOAST_MAX;
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

  private add(msg: string, tone: Tone, opt: ToastOptions) {
    this.list.unshift({ id: this.nextId++, msg, tone, opt, left: opt.ms ?? TOAST_MS });
  }
}

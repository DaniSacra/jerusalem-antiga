import { ToastQueue, type ToastOptions, type Tone } from '../game/toastQueue';
import { h } from './dom';

/** A leaving toast fades this long (ms); the others slide into place in `SLIDE_MS` (ui.css). */
const FADE_MS = 250;
const calm = matchMedia('(prefers-reduced-motion: reduce)');

/**
 * The toasts, newest at the bottom (the box stacks upward); timed by `ToastQueue`. A toast that
 * leaves fades where it was (taken out of the flow) while the others slide to their new place.
 */
export class Toasts {
  readonly el = h('div.toasts');
  private queue = new ToastQueue();
  private els = new Map<number, HTMLElement>();

  /** Phone: at most two at once (`TOAST_MAX_PHONE`). */
  setPhone(phone: boolean) {
    this.queue.setPhone(phone);
    this.draw();
  }

  show(msg: string, t: Tone = 'info', opt: ToastOptions = {}) {
    this.queue.show(msg, t, opt);
    this.draw();
  }

  update() {
    this.queue.prune();
    this.draw();
  }

  frame(dtMs: number) {
    // One may leave and the next in line take its place: the count alone would not show it.
    if (this.queue.tick(dtMs)) this.draw();
  }

  private draw() {
    const ids = new Set(this.queue.list.map((t) => t.id));
    const leaving = [...this.els].filter(([id]) => !ids.has(id));
    const live = ([...this.el.children] as HTMLElement[]).filter((el) => !el.classList.contains('out'));
    if (!leaving.length && live.length === this.queue.list.length && this.queue.list.every((t, k) => live[k] === this.els.get(t.id))) return;
    // Where each toast staying on screen is now (to slide from there).
    const before = new Map<HTMLElement, number>();
    for (const el of live) before.set(el, el.getBoundingClientRect().top);
    // Out of the flow at the same spot, fading; removed when done. Measured from the bottom (the box
    // is anchored there and shrinks from the top), all before any of them moves.
    const spots = leaving.map(([, el]) => ({ bottom: this.el.clientHeight - el.offsetTop - el.offsetHeight, left: el.offsetLeft, width: el.offsetWidth }));
    for (const [k, [id, el]] of leaving.entries()) {
      this.els.delete(id);
      if (calm.matches) {
        el.remove();
        continue;
      }
      const p = spots[k];
      Object.assign(el.style, { position: 'absolute', bottom: `${p.bottom}px`, left: `${p.left}px`, width: `${p.width}px`, boxSizing: 'border-box' });
      el.classList.add('out');
      this.el.append(el);
      setTimeout(() => el.remove(), FADE_MS);
    }
    this.queue.list.forEach((t, k) => {
      let el = this.els.get(t.id);
      if (!el) {
        el = h('div.toast.panel', { class: [t.tone, t.opt.big ? 'big' : ''].filter(Boolean).join(' ') }, t.msg);
        this.els.set(t.id, el);
      }
      if (this.el.children[k] !== el) this.el.insertBefore(el, this.el.children[k] ?? null);
    });
    if (calm.matches) return;
    // The ones that stay slide from where they were (FLIP).
    for (const [el, top] of before) {
      const dy = top - el.getBoundingClientRect().top;
      if (!dy || !el.isConnected) continue;
      el.classList.remove('slide');
      el.style.transform = `translateY(${dy}px)`;
      void el.offsetWidth;
      el.classList.add('slide');
      el.style.transform = '';
    }
  }
}

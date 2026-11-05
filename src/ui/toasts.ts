import { ToastQueue, type ToastOptions, type Tone } from '../game/toastQueue';
import { h } from './dom';

/** The toasts, newest at the bottom (the box stacks upward); timed by `ToastQueue`. */
export class Toasts {
  readonly el = h('div.toasts');
  private queue = new ToastQueue();
  private els = new Map<number, HTMLElement>();

  show(msg: string, t: Tone = 'info', opt: ToastOptions = {}) {
    this.queue.show(msg, t, opt);
    this.draw();
  }

  update() {
    this.queue.prune();
    this.draw();
  }

  frame(dtMs: number) {
    const before = this.queue.list.length;
    this.queue.tick(dtMs);
    if (this.queue.list.length !== before) this.draw();
  }

  private draw() {
    const ids = new Set(this.queue.list.map((t) => t.id));
    for (const [id, el] of this.els)
      if (!ids.has(id)) {
        el.remove();
        this.els.delete(id);
      }
    this.queue.list.forEach((t, k) => {
      let el = this.els.get(t.id);
      if (!el) {
        el = h('div.toast.panel', { class: [t.tone, t.opt.big ? 'big' : ''].filter(Boolean).join(' ') }, t.msg);
        this.els.set(t.id, el);
      }
      if (this.el.children[k] !== el) this.el.insertBefore(el, this.el.children[k] ?? null);
    });
  }
}

import { h, onTap } from './dom';

/** One dialog at a time over everything (victory, defeat); while open the game stands still. */
export class Modal {
  private el: HTMLDivElement | null = null;

  constructor(private parent: HTMLElement) {}

  get open() {
    return this.el !== null;
  }

  show(title: string, text: string, buttons: [string, () => void][]) {
    this.close();
    const acts = h('div.acts');
    for (const [label, fn] of buttons) {
      const b = h('button.act.gold', {}, label);
      onTap(b, fn);
      acts.append(b);
    }
    this.el = h('div.modal', {}, h('div.card', {}, h('h2', {}, title), h('p', {}, text), acts));
    this.parent.append(this.el);
  }

  close() {
    this.el?.remove();
    this.el = null;
  }
}

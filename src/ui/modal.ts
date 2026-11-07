import { h, onTap } from './dom';
import { ICONS } from './icons';

/** A "medal" of the end cards: a big number and what it counts. */
export type Medal = [value: number, label: string];

/** One dialog at a time over everything (victory, defeat); while open the game stands still. */
export class Modal {
  private el: HTMLDivElement | null = null;

  constructor(private parent: HTMLElement) {}

  get open() {
    return this.el !== null;
  }

  /** A card with gold branches around the title, the text, the medals (if any) and the buttons, on a blurred city. */
  show(title: string, text: string, buttons: [string, () => void][], medals: Medal[] = []) {
    this.close();
    const acts = h('div.acts');
    for (const [label, fn] of buttons) {
      const b = h('button.act.gold', {}, label);
      onTap(b, fn);
      acts.append(b);
    }
    const branch = (side: string) => {
      const el = h(`span.branch.${side}`);
      el.innerHTML = ICONS.branch;
      return el;
    };
    const head = h('div.crown', {}, branch('left'), h('h2', {}, title), branch('right'));
    const row = h('div.medals', {}, ...medals.map(([n, label]) => h('div.medal', {}, h('b', {}, String(n)), h('span', {}, label))));
    this.el = h('div.modal.end', {}, h('div.card', {}, head, h('p', {}, text), ...(medals.length ? [row] : []), acts));
    this.parent.append(this.el);
  }

  close() {
    this.el?.remove();
    this.el = null;
  }
}

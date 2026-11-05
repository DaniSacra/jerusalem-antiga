import { personById } from '../core';
import { sheetOf, type Kin } from '../game/model/person';
import type { Session } from '../game/session';
import { T } from '../game/strings';
import { h, keyed, onTap } from './dom';
import { figureSvg } from './figure';

/**
 * Ficha da pessoa: opened from a house's people (and from the relatives on another sheet). Name and
 * parent, family, figure, age, work, house (a tap goes there), parents, spouse and children as 44 px
 * buttons; Voltar goes back through the sheets seen before.
 */
export class PersonSheet {
  readonly el = h('div.panelbox.sheet.panel.hidden', { 'data-spot': 'sheet' });
  private current: number | null = null;
  private trail: number[] = [];

  constructor(private s: Session, private showHouse: (houseId: number) => void) {}

  get open() {
    return this.current !== null;
  }

  /** Opens a person's sheet (`fresh`: from the map, forgetting the sheets seen before). */
  show(id: number, fresh = false) {
    if (fresh) this.trail = [];
    else if (this.current !== null && this.current !== id) this.trail.push(this.current);
    this.current = id;
    this.update();
  }

  close(): boolean {
    const was = this.open;
    this.current = null;
    this.trail = [];
    this.el.classList.add('hidden');
    return was;
  }

  /** Voltar: the sheet seen before, or closed. */
  back() {
    const prev = this.trail.pop();
    if (prev === undefined) return this.close();
    this.current = prev;
    this.update();
  }

  update() {
    const p = this.current === null ? undefined : personById(this.s.state, this.current);
    if (!p) return void this.close();
    const v = sheetOf(this.s.state, p);
    const N = T.nova.people;
    keyed(this.el, JSON.stringify([v, this.trail.length]), () => {
      const fig = h('span.fig.big');
      fig.innerHTML = figureSvg(v.band, v.sex, v.dim);
      const head = h('div.head', {}, fig, h('div', {}, h('div.line.big', {}, v.title), h('div.line.plain.t-muted', {}, v.clan)));
      const lines = [h('div.line', {}, v.age), v.job ? h('div.line.plain', {}, v.job) : null, h('div.line.plain.t-muted', {}, v.origin)];
      let home: HTMLElement | null = null;
      if (v.house) {
        const id = v.house.id;
        const b = h('button.chip.family', { 'data-spot': 'sheet-house' }, v.house.name);
        onTap(b, () => this.showHouse(id));
        home = h('div.kin', {}, h('div.line.plain.t-muted', {}, N.house), b);
      }
      const rows = v.rows.map((r) => h('div.kin', {}, h('div.line.t-gold', {}, r.label), h('div.chips', {}, ...r.kin.map((k) => this.kinButton(k)))));
      const back = h('button.act', { 'data-spot': 'sheet-back' }, this.trail.length ? N.back : N.close);
      onTap(back, () => this.back());
      // Voltar / Fechar at the top, in reach without scrolling.
      head.append(back);
      return [head, ...lines, home, ...rows];
    });
    this.el.classList.remove('hidden');
  }

  private kinButton(k: Kin) {
    const b = h('button.chip.family', { class: k.dim ? 'dim' : null, 'data-person': k.id }, k.label);
    onTap(b, () => this.show(k.id));
    return b;
  }
}

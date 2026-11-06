import { personById } from '../core';
import { sheetOf, type Kin } from '../game/model/person';
import type { Session } from '../game/session';
import { T } from '../game/strings';
import { h, keyed, onTap } from './dom';
import { figureSvg } from './figure';

/**
 * Ficha da pessoa: opened from a house's people (and from the relatives on another sheet). Name and
 * parent, family, figure, age, work, house (a tap goes there), parents, spouse and children as 44 px
 * buttons; Voltar goes back through the sheets seen before. An adult's work has "Mudar": a short
 * list of the free jobs (nearest first) and "Sem trabalho"; a tap picks, Esc closes the list.
 */
export class PersonSheet {
  readonly el = h('div.panelbox.sheet.panel.hidden', { 'data-spot': 'sheet' });
  private current: number | null = null;
  private trail: number[] = [];
  /** The "Mudar" list is open. */
  private choosing = false;

  constructor(private s: Session, private showHouse: (houseId: number) => void) {}

  get open() {
    return this.current !== null;
  }

  /** Opens a person's sheet (`fresh`: from the map, forgetting the sheets seen before). */
  show(id: number, fresh = false) {
    if (fresh) this.trail = [];
    else if (this.current !== null && this.current !== id) this.trail.push(this.current);
    this.current = id;
    this.choosing = false;
    this.update();
  }

  close(): boolean {
    // Esc or a tap on the map closes the "Mudar" list first.
    if (this.choosing) {
      this.choosing = false;
      this.update();
      return true;
    }
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
    keyed(this.el, JSON.stringify([v, this.trail.length, this.choosing]), () => {
      const fig = h('span.fig.big');
      fig.innerHTML = figureSvg(v.band, v.sex, v.dim);
      const head = h('div.head', {}, fig, h('div', {}, h('div.line.big', {}, v.title), h('div.line.plain.t-muted', {}, v.clan)));
      const lines = [h('div.line', {}, v.age), this.work(v.job, v.choices), h('div.line.plain.t-muted', {}, v.origin)];
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

  /** The work line, with "Mudar" for an adult; open, the list of free jobs (or why there is none). */
  private work(job: string | null, choices: { id: number | null; label: string }[] | null): HTMLElement | null {
    if (!job) return null;
    const N = T.nova.people;
    if (!choices) return h('div.line.plain', {}, job);
    // Open, the button turns gold (one "Fechar" only, at the top); a tap closes the list again.
    const change = h('button.act.small', { 'data-spot': 'sheet-job', class: this.choosing ? 'gold' : null }, N.change);
    onTap(change, () => {
      this.choosing = !this.choosing;
      this.update();
    });
    const row = h('div.work', {}, h('div.line.plain', {}, job), change);
    if (!this.choosing) return row;
    const list = choices.length
      ? h('div.chips', { 'data-spot': 'job-list' }, ...choices.map((c) => this.choiceButton(c)))
      : h('div.line.plain.t-bad', {}, N.noOption);
    return h('div.kin', {}, row, h('div.line.t-gold', {}, N.changeTitle), list);
  }

  private choiceButton(c: { id: number | null; label: string }) {
    const b = h('button.chip.family', { 'data-job': c.id ?? 'none' }, c.label);
    onTap(b, () => {
      if (this.current !== null && this.s.setJob(this.current, c.id)) this.choosing = false;
      this.update();
    });
    return b;
  }

  private kinButton(k: Kin) {
    const b = h('button.chip.family', { class: k.dim ? 'dim' : null, 'data-person': k.id }, k.label);
    onTap(b, () => this.show(k.id));
    return b;
  }
}

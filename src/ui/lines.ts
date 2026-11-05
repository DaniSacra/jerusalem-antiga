import type { CardLine, CardTone, PersonChip } from '../game/model/card';
import type { PanelLine } from '../game/model/panels';
import { chartSvg } from './charts';
import { h, onTap } from './dom';
import { figureSvg } from './figure';

/** Lines of a balloon or a panel (from src/game/model) as HTML. */

const toneClass = (t?: CardTone) => (t && t !== 'text' ? `t-${t}` : '');

/** One card line: a text with its tone and weight, a boxed line, or the rows of people. */
export function cardLine(l: CardLine, onPerson: (id: number) => void): HTMLElement {
  const style = l.gap ? `margin-top:${l.gap}px` : null;
  if (l.people) {
    const grid = h('div.people', { style: `${style ?? ''};grid-template-columns:repeat(${Math.min(l.cols ?? 1, l.people.length)}, auto)` });
    for (const p of l.people) grid.append(personChip(p, onPerson));
    return grid;
  }
  const cls = [toneClass(l.tone), l.big ? 'big' : '', l.plain ? 'plain' : '', l.box ? 'box' : ''].filter(Boolean).join(' ');
  if (l.parts) return h('div.line', { class: cls || null, style }, ...l.parts.map((p) => h('span', { class: toneClass(p.tone) || null }, p.text)));
  return h('div.line', { class: cls || null, style }, l.text);
}

/** A person row: figure, "Natã, 22" and the work under it; a tap opens the person's sheet. */
export function personChip(p: PersonChip, onPerson: (id: number) => void): HTMLElement {
  const fig = h('span.fig');
  fig.innerHTML = figureSvg(p.band, p.sex);
  const b = h('button.chip', { 'data-person': p.id }, fig, h('span.who', {}, h('b', {}, p.title), h('small', { class: toneClass(p.subTone ?? 'muted') || null }, p.sub)));
  onTap(b, () => onPerson(p.id));
  return b;
}

/** One panel line: parts in a row, a wrapped note, a chart or the family chips. */
export function panelLine(l: PanelLine, onHouse: (id: number) => void): HTMLElement {
  const style = l.gap ? `margin-top:${l.gap}px` : null;
  if (l.chart) {
    const el = h('div.chart', { style });
    el.innerHTML = chartSvg(l.chart);
    return el;
  }
  if (l.chips) {
    const row = h('div.chips', { style });
    for (const c of l.chips) {
      const b = h('button.chip.family', { 'data-house': c.houseId }, c.label);
      onTap(b, () => onHouse(c.houseId));
      row.append(b);
    }
    return row;
  }
  return h(
    'div.pline',
    { class: l.wrap ? 'wrap' : null, style },
    ...l.parts.map((p) => h('span', { class: [toneClass(p.tone), p.big ? 'big' : '', p.small ? 'small' : '', p.plain ? 'plain' : ''].filter(Boolean).join(' ') || null }, p.text)),
  );
}

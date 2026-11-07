import { BUILDINGS, type BuildableKind } from '../core';
import { buildColumn } from '../game/model/build';
import { toolCard } from '../game/model/card';
import { arrowOf, setArrow } from './anchors';
import { cardLine } from './lines';
import type { Session } from '../game/session';
import { T } from '../game/strings';
import { COLUMN_ORDER, keyOf, toolName, type Tool } from '../game/tools';
import { h, onTap, setText } from './dom';
import { LOCK } from './labels';
import { iconButton, toolButton } from './parts';

/** The map turns (left side), the tools (Mover, Rua, Demolir) and the build column. */
export class Tools {
  readonly turns = h('nav.side');
  readonly tools = h('nav.tools');
  readonly column = h('nav.column.panel');
  /** The chosen building's balloon, left of the column at its button (`toolCard`). */
  readonly tip = h('div.toolballoon.panel.hidden', { 'data-spot': 'tool-balloon' });
  private tipKey = '';
  private toolEls = new Map<Tool, HTMLElement>();
  private builds = new Map<BuildableKind, HTMLButtonElement>();

  constructor(private s: Session, turn: (dir: 1 | -1) => void) {
    for (const [dir, icon, label] of [[1, 'turnLeft', T.view3d.turnLeft], [-1, 'turnRight', T.view3d.turnRight]] as const) this.turns.append(iconButton(icon, label, () => turn(dir)));
    for (const t of ['view', 'road', 'clear'] as Tool[]) {
      const b = toolButton(t, () => s.selectTool(t));
      this.toolEls.set(t, b);
      this.tools.append(b);
    }
    for (const k of COLUMN_ORDER) {
      // A round thumbnail of the building (its lock and "novo" dot on it), the name and the price beside it (PC).
      const thumb = h('span.thumb', {}, h('img', { alt: '' }), h('i.fresh'));
      thumb.insertAdjacentHTML('beforeend', `<span class="lock">${LOCK}</span>`);
      const b = h('button.build', { 'data-spot': `build-${k}`, 'aria-label': BUILDINGS[k].name }, thumb, h('span.text', {}, h('span.name', {}, h('b', {}, BUILDINGS[k].name), h('kbd.hidden')), h('small')));
      onTap(b, () => s.selectTool(k));
      this.builds.set(k, b);
      this.column.append(b);
    }
  }

  /** The buildings' thumbnails (data URLs, render3d/thumbs.ts), once the models are ready. */
  setThumbs(urls: Partial<Record<BuildableKind, string>>) {
    for (const [k, b] of this.builds) {
      const url = urls[k];
      if (url) b.querySelector('img')!.src = url;
    }
  }

  /** `bottom`: the tool balloon stays above it (the tutorial bubble's top when it shows). */
  update(phone: boolean, bottom = innerHeight - 8) {
    const s = this.s;
    for (const [t, el] of this.toolEls) {
      el.classList.toggle('on', s.tool === t);
      // PC: the key beside the name ("Mover · 1"), as the 2D.
      setText(el.querySelector('.label')!, phone ? toolName(t) : `${toolName(t)} · ${keyOf(t)}`);
    }
    for (const btn of buildColumn(s.state, s.tool, phone)) {
      const el = this.builds.get(btn.kind)!;
      el.classList.toggle('on', btn.on);
      el.classList.toggle('locked', btn.locked);
      el.classList.toggle('short', btn.short);
      el.classList.toggle('fresh', btn.fresh);
      setText(el.querySelector('small')!, btn.line);
      const kbd = el.querySelector('kbd')!;
      kbd.classList.toggle('hidden', !btn.key);
      setText(kbd, btn.key ?? '');
    }
    this.updateTip(phone, bottom);
  }

  private updateTip(phone: boolean, bottom: number) {
    const s = this.s;
    const kind = s.tool as BuildableKind;
    const btn = this.builds.get(kind);
    if (!btn || !s.state.unlocked.includes(kind)) {
      this.tip.classList.add('hidden');
      this.tipKey = '';
      return;
    }
    const lines = toolCard(s.state, kind, phone);
    const key = JSON.stringify(lines);
    if (key !== this.tipKey) {
      this.tipKey = key;
      this.tip.replaceChildren(...lines.map((l) => cardLine(l, () => {})));
    }
    this.tip.classList.remove('hidden');
    // Beside its button, kept on screen (measured on update only).
    const b = btn.getBoundingClientRect();
    const col = this.column.getBoundingClientRect();
    const h = this.tip.offsetHeight;
    const y = Math.max(8, Math.min(bottom - h, b.top + b.height / 2 - h / 2));
    const x = col.left - 12 - this.tip.offsetWidth;
    // The arrow points at its button.
    setArrow(this.tip, arrowOf({ x: col.left, y: b.top + b.height / 2 }, x, y, this.tip.offsetWidth, h));
    this.tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  /** Where the tutorial arrow points for a tool or building button, scrolled into view (measured: call on update/resize only). */
  arrowFor(tool: Tool): { x: number; y: number; dir: 'down' | 'right' } | null {
    const build = this.builds.get(tool as BuildableKind);
    const el = this.toolEls.get(tool) ?? build;
    if (!el) return null;
    // A building below the fold of the column (the phone): scroll it into view first.
    if (build) {
      const c = this.column.getBoundingClientRect();
      const b = build.getBoundingClientRect();
      if (b.bottom > c.bottom - 6) this.column.scrollTop += b.bottom - c.bottom + 12;
      else if (b.top < c.top + 6) this.column.scrollTop -= c.top - b.top + 12;
    }
    const r = el.getBoundingClientRect();
    return build ? { x: r.left - 4, y: r.top + r.height / 2, dir: 'right' } : { x: r.left + r.width / 2, y: r.top - 4, dir: 'down' };
  }
}

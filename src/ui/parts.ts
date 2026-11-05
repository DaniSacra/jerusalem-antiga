import type { Part, Tone as PartTone } from '../game/model/topbar';
import { toolName, type Tool } from '../game/tools';
import { h, keyed, onTap } from './dom';
import { ICONS } from './icons';

/** Shared pieces of the interface: tone classes, text parts, icons and tool buttons. */

export const tone = (t?: PartTone) => (t && t !== 'text' ? `t-${t}` : '');

/** Draws text parts (with bars and icons) into an element, only when they changed. */
export function partsTo(el: HTMLElement, parts: Part[]) {
  keyed(el, JSON.stringify(parts), () =>
    parts.map((p) => {
      if ('bar' in p) return h('span.bar', {}, h('i', { style: `width:${Math.round(p.bar * 100)}%` }));
      if ('icon' in p) return iconEl(p.icon);
      return h('span', { class: [tone(p.tone), p.size ? `s-${p.size}` : ''].filter(Boolean).join(' ') || null }, p.text);
    }),
  );
}

export function iconEl(name: string): Element {
  const s = h('span.icon');
  s.innerHTML = ICONS[name] ?? '';
  return s.firstElementChild ?? s;
}

/** A round button with an icon only. */
export function iconButton(icon: string, label: string, onPick: () => void, spot?: string) {
  const b = h('button.round.pill', { 'aria-label': label, 'data-spot': spot ?? null });
  b.innerHTML = ICONS[icon] ?? '';
  onTap(b, onPick);
  return b;
}

/** A disc button with an icon and a label under it (the tools). */
export function toolButton(tool: Tool, onPick: () => void) {
  const disc = h('span.disc');
  disc.innerHTML = ICONS[tool] ?? '';
  const b = h('button.tool', { 'data-spot': `tool-${tool}`, 'aria-label': toolName(tool) }, disc, h('span', {}, toolName(tool)));
  onTap(b, onPick);
  return b;
}

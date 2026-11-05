/** A tiny DOM helper (no framework): the interface is small and comes as data from src/game/model. */

type Attrs = Record<string, string | number | boolean | null | undefined | ((e: Event) => void)>;
type Child = Node | string | null | undefined | false;

/** Creates an element: `h('button.tool', { onclick, 'data-spot': 'tool-road' }, 'Rua')`. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K | `${K}.${string}`, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name) as HTMLElementTagNameMap[K];
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v as EventListener);
    else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

/** Sets a text only when it changed (no layout work for the same text). */
export function setText(el: HTMLElement, text: string) {
  if (el.textContent !== text) el.textContent = text;
}

/** Replaces the children only when the key of what they show changed. */
export function keyed(el: HTMLElement & { _key?: string }, key: string, build: () => Child[]) {
  if (el._key === key) return;
  el._key = key;
  el.replaceChildren(...(build().filter(Boolean) as (Node | string)[]));
}

/** The next `keyed` call on `el` builds again, whatever its key. */
export function resetKey(el: HTMLElement & { _key?: string }) {
  el._key = '';
}

/** How far (px) a finger may slide on a button and still tap it; more is a scroll of its list. */
const TAP_MOVE = 10;

/**
 * A button that only fires for a press that began on it (a drag from the map passing over it does
 * nothing), stayed on it (a finger scrolling the column or a panel does not pick), and never taps through.
 */
export function onTap(el: HTMLElement, fn: (e: PointerEvent) => void) {
  let down: number | null = null;
  let x = 0;
  let y = 0;
  el.addEventListener('pointerdown', (e) => {
    down = e.pointerId;
    [x, y] = [e.clientX, e.clientY];
    e.stopPropagation();
    // No mouse events after a touch: a button that closes the 3D would otherwise "tap through"
    // to what wakes up under it (the 2D's buttons in the same corner).
    e.preventDefault();
  });
  el.addEventListener('pointerup', (e) => {
    if (down !== e.pointerId) return;
    down = null;
    e.stopPropagation();
    if (Math.hypot(e.clientX - x, e.clientY - y) <= TAP_MOVE) fn(e);
  });
  el.addEventListener('pointercancel', () => (down = null));
  el.addEventListener('pointerleave', () => (down = null));
}

/** Phone or PC, decided on the real screen (short, or a touch-first pointer), as `layout.ts > IS_PHONE`. */
export const formOf = () => (innerHeight < 500 || matchMedia('(pointer: coarse)').matches ? 'phone' : 'pc');

import type { Rect } from '../core';
import type { Session } from '../game/session';
import type { ToastOptions, Tone } from '../game/toastQueue';
import { NOVA_CSS, NOVA_FONT } from '../render/palette';
import { T } from '../render/strings';
import { Anchors } from './anchors';
import { Balloon } from './balloon';
import { formOf, h, setText } from './dom';
import { Modal } from './modal';
import { SettingsPanel } from './settings';
import { Toasts } from './toasts';
import { TopBar } from './topbar';
import { Tools } from './tools';
import { Tutorial, type ArrowTarget } from './tutorial';
import './ui.css';

/** What the interface asks of the 3D game around it. */
export interface HudHost {
  readonly session: Session;
  /** Screen point of the top centre of a footprint (null when behind the camera). */
  screenOf(r: Rect, top?: number): { x: number; y: number } | null;
  turn(dir: 1 | -1): void;
  /** Back to the classic 2D game (null when there is none behind). */
  exit: (() => void) | null;
  /** A new game: the same map or a new one. */
  restart(sameMap: boolean): void;
  /** The player chose the classic 2D map (back to it, or a new game in it). */
  toClassic(): void;
}

/** How long a floating text lasts (ms). */
const FLOAT_MS = 1600;

/**
 * The HTML interface over the 3D map, made of components (`TopBar`, `Tools`, `Balloon`, `Toasts`,
 * `Tutorial`, `Modal`, `SettingsPanel`) plus the preview pill and rising texts. It reads the session
 * on `update` (after each refresh); what is pinned to the world follows the camera in one pass per
 * frame (`Anchors`, transforms only).
 */
export class Hud {
  readonly root: HTMLDivElement;
  private anchors: Anchors;
  private top: TopBar;
  private tools: Tools;
  private balloon: Balloon;
  private toasts = new Toasts();
  private tutorial: Tutorial;
  private modal: Modal;
  private settings: SettingsPanel;
  private tag = h('div.anchor.tag.panel.hidden');

  constructor(parent: HTMLElement, private host: HudHost) {
    const root = (this.root = h('div', { id: 'hud', 'data-form': formOf() }));
    for (const [k, v] of Object.entries({ text: NOVA_CSS.text, muted: NOVA_CSS.muted, gold: NOVA_CSS.gold, good: NOVA_CSS.good, bad: NOVA_CSS.bad, warn: NOVA_CSS.warn, ink: NOVA_CSS.ink, 'ink-bad': NOVA_CSS.inkBad }))
      root.style.setProperty(`--c-${k}`, v);
    root.style.setProperty('--c-parchment', '#f4e8cc');
    root.style.setProperty('--font', NOVA_FONT);
    const s = host.session;
    this.anchors = new Anchors((r, top) => host.screenOf(r, top));
    this.settings = new SettingsPanel({ standalone: !host.exit, toClassic: () => host.toClassic() });
    this.top = new TopBar(s, { exit: host.exit, settings: () => this.settings.toggle() });
    this.tools = new Tools(s, (d) => host.turn(d));
    this.balloon = new Balloon(s, this.anchors);
    this.tutorial = new Tutorial(s, this.anchors, (t) => this.tools.arrowFor(t));
    this.modal = new Modal(root);
    root.append(this.tag, this.balloon.el, this.top.el, this.tools.turns, this.tools.tools, this.tools.column, this.toasts.el, this.tutorial.bubble, this.tutorial.arrow, this.settings.el);
    parent.append(root);
    addEventListener('resize', this.onResize);
  }

  private onResize = () => {
    this.root.setAttribute('data-form', formOf());
    this.tutorial.remeasure();
  };

  dispose() {
    removeEventListener('resize', this.onResize);
    this.root.remove();
  }

  get phone() {
    return this.root.dataset.form === 'phone';
  }

  get modalOpen() {
    return this.modal.open;
  }

  /** True when a screen point is over a control (the map ignores it). */
  overUi(sx: number, sy: number): boolean {
    const el = document.elementFromPoint(sx, sy);
    return !!el && !!el.closest('#hud') && el !== this.root;
  }

  /** After each refresh of the session. */
  update() {
    this.top.update(this.phone);
    this.tools.update(this.phone);
    this.balloon.update();
    this.toasts.update();
    // A locked button may have opened up: buttons are measured again for the arrow.
    this.tutorial.remeasure();
  }

  /** Per frame: time for the toasts, and what is pinned to the world follows the camera. */
  frame(dtMs: number) {
    this.toasts.frame(dtMs);
    this.anchors.frame(dtMs);
  }

  toast(msg: string, t: Tone = 'info', opt: ToastOptions = {}) {
    this.toasts.show(msg, t, opt);
  }

  setTutorial(sentence: string | null) {
    this.tutorial.setSentence(sentence);
  }

  /** Where the tutorial arrow points: a button (tool, building) or a place on the map. */
  setArrow(target: ArrowTarget) {
    this.tutorial.point(target);
  }

  /** The lines over the previewed building (null hides the pill). */
  setTag(lines: string[] | null, at: Rect | null) {
    const on = !!lines?.length && !!at;
    this.tag.classList.toggle('hidden', !on);
    if (!on) return this.anchors.unpin(this.tag);
    setText(this.tag, lines!.join('\n'));
    this.anchors.pin(this.tag, at, (p) => `translate(${Math.round(p.x)}px, ${Math.round(p.y - 8)}px) translate(-50%, -100%)`);
  }

  /** A short text rising from a building and fading (a house's gain, a failure on the spot). */
  float(text: string, at: Rect, t: 'gold' | 'bad') {
    const el = h('div.anchor.float', { class: `t-${t}` }, text);
    this.root.append(el);
    this.anchors.pin(
      el,
      at,
      (p, age) => {
        const k = age / FLOAT_MS;
        el.style.opacity = String(k < 0.7 ? 1 : (1 - k) / 0.3);
        return `translate(${Math.round(p.x)}px, ${Math.round(p.y - 40 * k)}px) translate(-50%, -100%)`;
      },
      1.4,
      FLOAT_MS,
    );
  }

  showVictory(week: number, residents: number, births: number, weddings: number) {
    this.modal.show(T.victoryTitle, `${T.victoryText(week, residents)}\n${T.victoryPeople(births, weddings)}`, [[T.keepBuilding, () => this.modal.close()]]);
  }

  showDefeat(week: number, peak: number) {
    this.modal.show(T.defeatTitle, T.defeatText(week, peak), [
      [T.sameMap, () => this.host.restart(true)],
      [T.retry, () => this.host.restart(false)],
    ]);
  }

  /** Esc: closes the settings or the open balloon; false when nothing was open. */
  closeTop(): boolean {
    if (this.settings.open) {
      this.settings.close();
      return true;
    }
    if (this.balloon.rect && this.host.session.selected) {
      this.host.session.deselect();
      return true;
    }
    return false;
  }
}

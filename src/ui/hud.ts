import type { Rect } from '../core';
import type { Session } from '../game/session';
import type { ToastOptions, Tone } from '../game/toastQueue';
import { NOVA_CSS, NOVA_FONT } from '../render/palette';
import { T } from '../render/strings';
import { Anchors } from './anchors';
import { CardBalloon, type Free } from './cardBalloon';
import { Panels, type PanelKind } from './panels';
import { PersonSheet } from './sheet';
import { ProblemLabels } from './labels';
import { notices, type Notice } from '../render/nova/notices';
import { iconButton } from './parts';
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
  /** The camera's zoom (1 at the opening distance). */
  readonly zoom: number;
  /** The camera slides to a footprint. */
  glideTo(r: Rect): void;
  /** The camera slides so the map moves `dx` px sideways on screen. */
  nudge(dx: number): void;
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
  private balloon: CardBalloon;
  private panels: Panels;
  private sheet: PersonSheet;
  private labels: ProblemLabels;
  /** Objetivos, Avisos (with the red selo of how many) and Estatísticas, under the turn buttons. */
  private sideButtons = new Map<PanelKind, HTMLButtonElement>();
  private badge = h('span.badge.hidden');
  /** The standing warnings, and the keys seen (a new one toasts once and the Avisos button pulses). */
  private notices: Notice[] = [];
  private noticeKeys = new Set<string>();
  private toasts = new Toasts();
  private tutorial: Tutorial;
  private modal: Modal;
  private settings: SettingsPanel;
  private tag = h('div.anchor.tag.panel.hidden');
  /** A reddish tone over the map while the city starves (the interface stays clear). */
  private famine = h('div.famine');
  /** The map's free area, measured on update and resize (the balloon stays in it). */
  private below = '';
  private free: Free = { left: 8, top: 8, right: innerWidth - 8, bottom: innerHeight - 8 };

  constructor(parent: HTMLElement, private host: HudHost) {
    const root = (this.root = h('div', { id: 'hud', 'data-form': formOf() }));
    for (const [k, v] of Object.entries({ text: NOVA_CSS.text, muted: NOVA_CSS.muted, gold: NOVA_CSS.gold, good: NOVA_CSS.good, bad: NOVA_CSS.bad, warn: NOVA_CSS.warn, ink: NOVA_CSS.ink, 'ink-bad': NOVA_CSS.inkBad }))
      root.style.setProperty(`--c-${k}`, v);
    root.style.setProperty('--c-parchment', '#f4e8cc');
    root.style.setProperty('--font', NOVA_FONT);
    const s = host.session;
    this.anchors = new Anchors((r, top) => host.screenOf(r, top));
    this.settings = new SettingsPanel();
    this.top = new TopBar(s, { exit: host.exit, settings: () => this.settings.toggle(), goals: () => this.togglePanel('goals') });
    this.tools = new Tools(s, (d) => host.turn(d));
    this.sheet = new PersonSheet(s, (id) => this.showHouse(id));
    this.labels = new ProblemLabels(this.anchors, () => host.zoom);
    this.balloon = new CardBalloon(s, this.anchors, () => this.free, () => this.phone, (id) => {
      this.panels.close();
      this.sheet.show(id, true);
    }, (dx) => host.nudge(dx));
    this.panels = new Panels(s, () => this.phone, (id) => this.showHouse(id));
    // Objetivos opens from the level ring and the goal (top bar).
    for (const [kind, icon, label] of [['alerts', 'alert', T.nova.buttons.alerts], ['stats', 'stats', T.nova.buttons.stats]] as const) {
      const b = iconButton(icon, label, () => this.togglePanel(kind), `panel-${kind}`);
      if (kind === 'alerts') b.append(this.badge);
      this.sideButtons.set(kind, b);
      this.tools.turns.append(b);
    }
    this.tutorial = new Tutorial(s, this.anchors, (t) => this.tools.arrowFor(t));
    this.modal = new Modal(root);
    root.append(this.famine, this.labels.el, this.tag, this.balloon.el, this.panels.el, this.sheet.el, this.top.el, this.tools.turns, this.tools.tools, this.tools.column, this.tools.tip, this.toasts.el, this.tutorial.bubble, this.tutorial.arrow, this.settings.el);
    parent.append(root);
    addEventListener('resize', this.onResize);
  }

  private onResize = () => {
    this.root.setAttribute('data-form', formOf());
    this.tutorial.remeasure();
    this.measureFree();
  };

  /** Below the top bar, left of the column, above the tools (8 px clear of each). */
  private measureFree() {
    const bottomOf = (els: Iterable<Element>) => Math.max(0, ...[...els].map((e) => e.getBoundingClientRect().bottom));
    const top = bottomOf(this.top.el.querySelectorAll('.pill, .level, button'));
    const col = this.tools.column.getBoundingClientRect();
    const tools = this.tools.tools.getBoundingClientRect();
    const right = col.width ? col.left : innerWidth;
    const side = this.tools.turns.getBoundingClientRect();
    this.free = { left: (side.width ? side.right : 0) + 8, top: top + 8, right: right - 8, bottom: (tools.height ? tools.top : innerHeight) - 8 };
    // Panels and the person sheet end above the tools too.
    const below = `${Math.round(innerHeight - this.free.bottom)}px`;
    if (below !== this.below) this.root.style.setProperty('--free-bottom', (this.below = below));
  }

  dispose() {
    this.balloon.dispose();
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
    this.tools.update(this.phone, this.tutorial.open ? this.tutorial.bubble.getBoundingClientRect().top - 8 : innerHeight - 8);
    this.measureFree();
    this.updateNotices();
    this.labels.update(this.host.session.state, this.host.session.city.eco);
    this.famine.classList.toggle('on', this.host.session.state.famine);
    this.balloon.update();
    this.panels.update(this.notices);
    this.sheet.update();
    for (const [k, b] of this.sideButtons) b.classList.toggle('on', this.panels.open === k);
    this.toasts.update();
    // A locked button may have opened up: buttons are measured again for the arrow.
    this.tutorial.remeasure();
  }

  /** The warnings now: the selo on Avisos; a new one toasts once (while it holds) and the button pulses. */
  private updateNotices() {
    const s = this.host.session;
    const list = (this.notices = notices(s.state, s.city, !!s.guide));
    setText(this.badge, String(list.length));
    this.badge.classList.toggle('hidden', !list.length);
    const fresh = list.filter((n) => !this.noticeKeys.has(n.key));
    this.noticeKeys = new Set(list.map((n) => n.key));
    for (const n of fresh) if (n.toast) this.toasts.show(n.text, n.bad ? 'bad' : 'info', { alert: () => this.notices.findIndex((o) => o.key === n.key) });
    if (fresh.length) {
      const b = this.sideButtons.get('alerts')!;
      b.classList.remove('pulse');
      void b.offsetWidth;
      b.classList.add('pulse');
    }
  }

  private togglePanel(kind: PanelKind) {
    this.sheet.close();
    this.host.session.deselect();
    this.panels.toggle(kind);
    this.update();
  }

  /** A family or a sheet's house: the camera goes there and its balloon opens (panels and sheet close). */
  private showHouse(houseId: number) {
    this.panels.close();
    this.sheet.close();
    const b = this.host.session.selectHouse(houseId);
    if (b) this.host.glideTo(b);
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
  setTag(lines: string[] | null, at: Rect | null, bad = false) {
    const on = !!lines?.length && !!at;
    this.tag.classList.toggle('hidden', !on);
    this.tag.classList.toggle('bad', bad);
    if (!on) return this.anchors.unpin(this.tag);
    setText(this.tag, lines!.join('\n'));
    this.anchors.pin(this.tag, at, (p) => `translate(${Math.round(p.x)}px, ${Math.round(p.y - 8)}px) translate(-50%, -100%)`);
  }

  /**
   * Where the camera brings a place: the middle of the free map, above the tutorial bubble when it
   * shows, and `lift` px higher so a point that far below it stays free too (the finger on touch).
   */
  focusPoint(lift = 0): { x: number; y: number } {
    const f = this.free;
    const bubble = this.tutorial.open ? this.tutorial.bubble.getBoundingClientRect().top - 8 : f.bottom;
    const bottom = Math.min(f.bottom, bubble) - lift;
    return { x: (f.left + f.right) / 2, y: Math.max(f.top + 20, (f.top + bottom) / 2) };
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

  /** Esc: closes the settings, the person sheet, a panel or the open balloon; false when nothing was open. */
  closeTop(): boolean {
    if (this.settings.open) {
      this.settings.close();
      return true;
    }
    if (this.sheet.close() || this.panels.close()) {
      this.update();
      return true;
    }
    if (this.balloon.rect && this.host.session.selected) {
      this.host.session.deselect();
      return true;
    }
    return false;
  }
}

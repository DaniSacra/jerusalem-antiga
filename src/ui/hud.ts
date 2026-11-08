import type { BuildableKind, Difficulty, Rect } from '../core';
import type { Session } from '../game/session';
import type { ToastOptions, Tone } from '../game/toastQueue';
import { NOVA_CSS, NOVA_FONT, TITLE_FONT } from '../game/palette';
import { T } from '../game/strings';
import { Anchors, type Free } from './anchors';
import { CardBalloon } from './cardBalloon';
import { Panels, type PanelKind } from './panels';
import { PersonSheet } from './sheet';
import { ProblemLabels } from './labels';
import { notices, type Notice } from '../game/notices';
import { iconButton } from './parts';
import { formOf, h, onTap, setText } from './dom';
import { ICONS } from './icons';
import { Modal } from './modal';
import { SettingsPanel } from './settings';
import { Toasts } from './toasts';
import { TopBar } from './topbar';
import { Tools } from './tools';
import { Tutorial, type ArrowTarget } from './tutorial';
import { NextStepLine } from './nextStep';
import { nextStep, type NextStep } from '../game/model/nextStep';
import './ui.css';

/** What the interface asks of the 3D game around it. */
export interface HudHost {
  readonly session: Session;
  /** Screen point of the top centre of a footprint (null when behind the camera). */
  screenOf(r: Rect, top?: number): { x: number; y: number } | null;
  turn(dir: 1 | -1): void;
  /** A new game: the same map or a new one. */
  restart(sameMap: boolean): void;
  /** The camera's zoom (1 at the opening distance). */
  readonly zoom: number;
  /** The camera slides to a footprint. */
  glideTo(r: Rect): void;
  /** The camera slides so the map moves `dx` px sideways on screen. */
  nudge(dx: number): void;
}

/** Room (px) the phone needs beside the goal pill to put the "O que fazer agora" line there. */
const NEXT_BESIDE_MIN = 220;

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
  /** Avisos (with the red selo of how many), Estatísticas and Profissões, under the turn buttons. */
  private sideButtons = new Map<PanelKind, HTMLButtonElement>();
  private badge = h('span.badge.hidden');
  /** Phone: Profissões as a labelled disc after the tools (five side buttons do not fit above them). */
  private jobsTool: HTMLButtonElement;
  /** The standing warnings, and the keys seen (a new one toasts once and the Avisos button pulses). */
  private notices: Notice[] = [];
  private noticeKeys = new Set<string>();
  private toasts = new Toasts();
  private tutorial: Tutorial;
  /** "O que fazer agora", under the top bar (hidden during the tutorial). */
  private next: NextStepLine;
  private modal: Modal;
  private settings: SettingsPanel;
  private tag = h('div.anchor.tag.panel.hidden');
  /** A reddish tone over the map while the city starves (the interface stays clear). */
  private famine = h('div.famine');
  /** The screen's edges a little darker, as a painting (CSS only, no GPU pass). */
  private vignette = h('div.vignette');
  /** The map's free area, measured on update and resize (the balloon stays in it). */
  private below = '';
  private free: Free = { left: 8, top: 8, right: innerWidth - 8, bottom: innerHeight - 8 };

  constructor(parent: HTMLElement, private host: HudHost) {
    const root = (this.root = h('div', { id: 'hud', 'data-form': formOf() }));
    for (const [k, v] of Object.entries({ text: NOVA_CSS.text, muted: NOVA_CSS.muted, gold: NOVA_CSS.gold, good: NOVA_CSS.good, bad: NOVA_CSS.bad, warn: NOVA_CSS.warn, ink: NOVA_CSS.ink, 'ink-bad': NOVA_CSS.inkBad, parchment: NOVA_CSS.parchment, 'gold-light': NOVA_CSS.goldLight, shadow: NOVA_CSS.shadow, vignette: NOVA_CSS.vignette }))
      root.style.setProperty(`--c-${k}`, v);
    root.style.setProperty('--font', NOVA_FONT);
    root.style.setProperty('--title-font', TITLE_FONT);
    const s = host.session;
    this.anchors = new Anchors((r, top) => host.screenOf(r, top));
    this.settings = new SettingsPanel();
    this.top = new TopBar(s, { settings: () => this.settings.toggle(), goals: () => this.togglePanel('goals'), stats: () => this.togglePanel('stats'), jobs: () => this.togglePanel('jobs') });
    this.tools = new Tools(s, (d) => host.turn(d));
    this.sheet = new PersonSheet(s, (id) => this.showHouse(id));
    this.labels = new ProblemLabels(this.anchors, () => host.zoom, () => this.free);
    this.balloon = new CardBalloon(s, this.anchors, () => this.free, () => this.phone, (id) => {
      this.panels.close();
      this.sheet.show(id, true);
    }, (dx) => host.nudge(dx), () => this.openPanel('jobs'));
    this.panels = new Panels(s, () => this.phone, (id) => this.showHouse(id), () => this.closeTop());
    // Objetivos opens from the level ring and the goal (top bar).
    for (const [kind, icon, label] of [['alerts', 'alert', T.nova.buttons.alerts], ['stats', 'stats', T.nova.buttons.stats], ['jobs', 'jobs', T.nova.buttons.jobs]] as const) {
      const b = iconButton(icon, label, () => this.togglePanel(kind), `panel-${kind}`);
      if (kind === 'alerts') b.append(this.badge);
      this.sideButtons.set(kind, b);
      this.tools.turns.append(b);
    }
    const disc = h('span.disc');
    disc.innerHTML = ICONS.jobs;
    this.jobsTool = h('button.tool.jobs', { 'data-spot': 'jobs-button', 'aria-label': T.nova.buttons.jobs }, disc, h('span.label', {}, T.nova.buttons.jobs));
    onTap(this.jobsTool, () => this.togglePanel('jobs'));
    this.tools.tools.append(this.jobsTool);
    this.tutorial = new Tutorial(s, this.anchors, (t) => this.tools.arrowFor(t));
    this.next = new NextStepLine(this.anchors, (t) => this.tools.arrowFor(t), () => s.tool, (step) => this.actOn(step));
    this.modal = new Modal(root);
    root.append(this.vignette, this.famine, this.labels.el, this.tag, this.balloon.el, this.panels.el, this.sheet.el, this.top.el, this.tools.turns, this.tools.tools, this.tools.column, this.tools.tip, this.next.el, this.toasts.el, this.tutorial.bubble, this.tutorial.arrow, this.next.arrow, this.settings.el);
    parent.append(root);
    this.toasts.setPhone(this.phone);
    addEventListener('resize', this.onResize);
  }

  private onResize = () => {
    this.root.setAttribute('data-form', formOf());
    this.toasts.setPhone(this.phone);
    this.tutorial.remeasure();
    this.measureFree();
  };

  /** Below the top bar (and the "O que fazer agora" line), left of the column, above the tools (8 px clear of each). */
  private measureFree() {
    const bottomOf = (els: Iterable<Element>) => Math.max(0, ...[...els].map((e) => e.getBoundingClientRect().bottom));
    let top = bottomOf(this.top.el.querySelectorAll('.pill, .level, button'));
    const col = this.tools.column.getBoundingClientRect();
    const tools = this.tools.tools.getBoundingClientRect();
    const right = col.width ? col.left : innerWidth;
    this.placeNext(top, right);
    if (this.next.shown) top = Math.max(top, this.next.el.getBoundingClientRect().bottom);
    const side = this.tools.turns.getBoundingClientRect();
    this.free = { left: (side.width ? side.right : 0) + 8, top: top + 8, right: right - 8, bottom: (tools.height ? tools.top : innerHeight) - 8 };
    // Panels and the person sheet end above the tools too.
    const below = `${Math.round(innerHeight - this.free.bottom)}px`;
    if (below !== this.below) this.root.style.setProperty('--free-bottom', (this.below = below));
  }

  /**
   * "O que fazer agora": centred right under the bar; on the phone beside the goal pill when there is
   * room before the column (the short screen keeps its map), else under it.
   */
  private placeNext(barBottom: number, colLeft: number) {
    const el = this.next.el;
    if (!this.next.shown) return;
    let style = { left: '50%', top: `${Math.round(barBottom + 4)}px`, transform: 'translateX(-50%)', maxWidth: '' };
    const goal = this.phone ? this.top.el.querySelector('.goal')?.getBoundingClientRect() : null;
    // Up to the column, and to the bar's right group (season, speed, gear) when it reaches down to the goal's row.
    const right = this.top.el.querySelector('.right')?.getBoundingClientRect();
    const end = goal && right && right.bottom > goal.top + 2 ? Math.min(colLeft, right.left) : colLeft;
    const room = goal ? end - 8 - (goal.right + 6) : 0;
    if (goal && goal.width && room >= NEXT_BESIDE_MIN)
      style = { left: `${Math.round(goal.right + 6)}px`, top: `${Math.round(goal.top + (goal.height - el.offsetHeight) / 2)}px`, transform: 'none', maxWidth: `${Math.floor(room)}px` };
    Object.assign(el.style, style);
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
  /** The buildings' thumbnails (data URLs) for the column and the balloon's buttons. */
  setThumbs(urls: Partial<Record<BuildableKind, string>>) {
    this.tools.setThumbs(urls);
    this.balloon.setThumbs(urls);
    this.panels.setThumbs(urls);
  }

  update() {
    this.top.update(this.phone);
    const s = this.host.session;
    // It waits while the tutorial speaks, or a panel or the person sheet covers the map (they open from it).
    this.next.update(this.tutorial.open ? null : nextStep(s.state, s.city), !this.panels.open && !this.sheet.open);
    this.tools.update(this.phone, this.tutorial.open ? this.tutorial.bubble.getBoundingClientRect().top - 8 : innerHeight - 8);
    this.measureFree();
    // The toasts end left of the tool balloon (its cost line explains a failure).
    const tip = this.tools.tip.classList.contains('hidden') ? null : this.tools.tip.getBoundingClientRect();
    this.toasts.el.style.right = tip ? `${Math.round(innerWidth - tip.left + 8)}px` : '';
    this.updateNotices();
    this.labels.update(this.host.session.state);
    this.famine.classList.toggle('on', this.host.session.state.famine);
    this.balloon.update();
    this.panels.update(this.notices);
    this.sheet.update();
    this.balloon.el.classList.toggle('under', this.sheet.open);
    for (const [k, b] of this.sideButtons) b.classList.toggle('on', this.panels.open === k);
    this.jobsTool.classList.toggle('on', this.panels.open === 'jobs');
    // The tutorial's bubble sits right of the tools on a phone: the disc waits for it (the Moradores pill still opens the panel).
    this.jobsTool.classList.toggle('hidden', this.tutorial.open);
    // The Profissões panel fills the phone's screen: the toasts wait until it closes.
    this.toasts.hold(this.phone && this.panels.open === 'jobs');
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

  /** A tap on "O que fazer agora": the stage's site (camera and balloon) or its panel. */
  private actOn(step: NextStep) {
    const s = this.host.session;
    if ('panel' in step.open) return this.openPanel(step.open.panel);
    const r = step.open.building;
    this.panels.close();
    this.sheet.close();
    if (s.tool !== 'view') s.selectTool('view');
    s.select({ x: r.x, y: r.y });
    this.host.glideTo(r);
  }

  /** Opens a panel (open already: it stays). */
  private openPanel(kind: PanelKind) {
    if (this.panels.open !== kind) this.togglePanel(kind);
  }

  private togglePanel(kind: PanelKind) {
    this.sheet.close();
    this.host.session.deselect();
    this.panels.toggle(kind);
    this.update();
  }

  /** Key P: opens or closes Profissões. */
  toggleJobs() {
    this.togglePanel('jobs');
  }

  /** A resident tapped on the street: their sheet opens (panels close). */
  showPerson(id: number) {
    this.panels.close();
    this.sheet.show(id, true);
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
    this.next.frame(dtMs);
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
    // On a phone the pill says what matters: the tool balloon steps aside so the place stays in view.
    this.tools.tip.classList.toggle('aside', on && this.phone);
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

  showVictory(week: number, residents: number, births: number, weddings: number, difficulty: Difficulty) {
    const m = T.medal;
    this.modal.show(T.victoryTitle, T.victoryText(week, residents, difficulty), [[T.keepBuilding, () => this.modal.close()]], [
      [residents, m.residents(residents)],
      [births, m.births(births)],
      [weddings, m.weddings(weddings)],
    ]);
  }

  showDefeat(week: number, peak: number, difficulty: Difficulty) {
    this.modal.show(T.defeatTitle, T.defeatText(week, peak, difficulty), [
      [T.sameMap, () => this.host.restart(true)],
      [T.retry, () => this.host.restart(false)],
    ], [
      [week, T.medal.weeks(week)],
      [peak, T.medal.peak(peak)],
    ]);
  }

  /** Closes a panel or the person sheet (a touch on the map); false when none was open. */
  closePanels(): boolean {
    const was = this.sheet.close() || this.panels.close();
    if (was) this.update();
    return was;
  }

  /** Esc: closes the settings, the person sheet, a panel or the open balloon; false when nothing was open. */
  closeTop(): boolean {
    if (this.settings.open) {
      this.settings.close();
      return true;
    }
    if (this.closePanels()) return true;
    if (this.balloon.rect && this.host.session.selected) {
      this.host.session.deselect();
      return true;
    }
    return false;
  }
}

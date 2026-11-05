import { BUILDINGS, type BuildableKind, type Rect } from '../core';
import { buildColumn } from '../game/model/build';
import { balloonOf } from '../game/model/inspect';
import { topBar, type Part, type Tone as PartTone } from '../game/model/topbar';
import type { Session } from '../game/session';
import { ToastQueue, type ToastOptions, type Tone } from '../game/toastQueue';
import { NOVA_CSS, NOVA_FONT } from '../render/palette';
import { saveSettings, settings } from '../render/settings';
import { T } from '../render/strings';
import { COLUMN_ORDER, toolName, type Tool } from '../render/tools';
import { formOf, h, keyed, onTap, setText } from './dom';
import { ICONS } from './icons';
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

const tone = (t?: PartTone) => (t && t !== 'text' ? `t-${t}` : '');

function partsTo(el: HTMLElement, parts: Part[]) {
  keyed(el, JSON.stringify(parts), () =>
    parts.map((p) => {
      if ('bar' in p) return h('span.bar', {}, h('i', { style: `width:${Math.round(p.bar * 100)}%` }));
      if ('icon' in p) return iconEl(p.icon);
      return h('span', { class: [tone(p.tone), p.size ? `s-${p.size}` : ''].filter(Boolean).join(' ') || null }, p.text);
    }),
  );
}

function iconEl(name: string) {
  const s = h('span.icon');
  s.innerHTML = ICONS[name] ?? '';
  return s.firstElementChild ?? s;
}

/** A disc button with an icon and a label under it (the tools). */
function toolButton(tool: Tool, onPick: () => void) {
  const disc = h('span.disc');
  disc.innerHTML = ICONS[tool] ?? '';
  const b = h('button.tool', { 'data-spot': `tool-${tool}`, 'aria-label': toolName(tool) }, disc, h('span', {}, toolName(tool)));
  onTap(b, onPick);
  return b;
}

/**
 * The HTML interface over the 3D map: top bar, rotation buttons, tools, build column, toasts, the
 * tutorial bubble and arrow, the tapped building's balloon, the preview pill and the victory and
 * defeat dialogs. It reads the session on `update` (after each refresh) and repositions what is
 * pinned to the world on `frame` (transforms only).
 */
export class Hud {
  readonly root: HTMLDivElement;
  private pills = h('div.pills');
  private level = h('div.level', {}, h('b'), h('small', {}, T.nova.level));
  private goal = h('div.pill.goal');
  private season = h('div.pill.season');
  private speed: HTMLButtonElement;
  private tools = new Map<Tool, HTMLElement>();
  private column = h('nav.column.panel');
  private builds = new Map<BuildableKind, HTMLButtonElement>();
  private toastBox = h('div.toasts');
  private queue = new ToastQueue();
  private toastEls = new Map<number, HTMLElement>();
  private tutorial: HTMLDivElement;
  private tutorialText = h('span');
  private arrow = h('div.anchor.arrow.hidden');
  private tag = h('div.anchor.tag.panel.hidden');
  private balloon = h('div.anchor.balloon.panel.hidden');
  private modal: HTMLDivElement | null = null;
  /** The tapped building's footprint (the balloon points at it). */
  private balloonAt: Rect | null = null;
  /** The preview pill's footprint and the arrow's target (world or a button). */
  private tagAt: Rect | null = null;
  private arrowAt: { rect: Rect; lift: number } | { x: number; y: number; dir: 'down' | 'left' | 'right' } | null = null;

  constructor(parent: HTMLElement, private host: HudHost) {
    const root = (this.root = h('div', { id: 'hud', 'data-form': formOf() }));
    for (const [k, v] of Object.entries({ text: NOVA_CSS.text, muted: NOVA_CSS.muted, gold: NOVA_CSS.gold, good: NOVA_CSS.good, bad: NOVA_CSS.bad, warn: NOVA_CSS.warn, ink: NOVA_CSS.ink, 'ink-bad': NOVA_CSS.inkBad }))
      root.style.setProperty(`--c-${k}`, v);
    root.style.setProperty('--c-parchment', '#f4e8cc');
    root.style.setProperty('--font', NOVA_FONT);
    const s = host.session;

    this.speed = h('button.round.gold', { 'data-spot': 'speed', 'aria-label': 'velocidade' });
    onTap(this.speed, () => s.cycleSpeed());
    const right = h('div.right', {}, this.season, this.speed);
    if (host.exit) {
      const exit = h('button.round.pill', { 'data-spot': 'exit3d', 'aria-label': T.view3d.classicHint }, T.view3d.classic);
      onTap(exit, () => host.exit?.());
      right.append(exit);
    }
    const gear = h('button.round.pill', { 'data-spot': 'settings', 'aria-label': T.nova.buttons.settings });
    gear.innerHTML = ICONS.gear;
    onTap(gear, () => this.toggleSettings());
    right.append(gear);
    const top = h('header.top', {}, h('div.left', {}, this.level, h('div.rows', {}, this.pills, this.goal)), right);

    const turns = h('nav.side');
    for (const [dir, icon, label] of [[1, 'turnLeft', T.view3d.turnLeft], [-1, 'turnRight', T.view3d.turnRight]] as const) {
      const b = h('button.round.pill', { 'aria-label': label });
      b.innerHTML = ICONS[icon];
      onTap(b, () => host.turn(dir));
      turns.append(b);
    }

    const tools = h('nav.tools');
    for (const t of ['view', 'road', 'clear'] as Tool[]) {
      const b = toolButton(t, () => s.selectTool(t));
      this.tools.set(t, b);
      tools.append(b);
    }

    for (const k of COLUMN_ORDER) {
      const b = h('button.build', { 'data-spot': `build-${k}` }, h('b', {}, BUILDINGS[k].name), h('small'));
      onTap(b, () => s.selectTool(k));
      this.builds.set(k, b);
      this.column.append(b);
    }

    const skip = h('button', {}, T.tutorial.skip);
    onTap(skip, () => s.skipTutorial());
    this.tutorial = h('div.tutorial.hidden', {}, this.tutorialText, skip);
    this.arrow.innerHTML = ICONS.arrow;

    root.append(this.tag, this.balloon, top, turns, tools, this.column, this.toastBox, this.tutorial, this.arrow, this.settingsBox);
    parent.append(root);
    addEventListener('resize', this.onResize);
  }

  private onResize = () => this.root.setAttribute('data-form', formOf());

  dispose() {
    removeEventListener('resize', this.onResize);
    this.root.remove();
  }

  get phone() {
    return this.root.dataset.form === 'phone';
  }

  get modalOpen() {
    return this.modal !== null;
  }

  /** True when a screen point is over a control (the map ignores it). */
  overUi(sx: number, sy: number): boolean {
    const el = document.elementFromPoint(sx, sy);
    return !!el && !!el.closest('#hud') && el !== this.root;
  }

  /** Screen rect of a tool or building button (the tutorial arrow points at it). */
  buttonOf(tool: Tool): DOMRect | null {
    const el = this.tools.get(tool) ?? this.builds.get(tool as BuildableKind);
    return el ? el.getBoundingClientRect() : null;
  }

  // ---------- after each refresh ----------

  update() {
    const s = this.host.session;
    const st = s.state;
    const bar = topBar(st, s.city, this.phone);
    const levelNum = this.level.querySelector('b')!;
    setText(levelNum, String(bar.level));
    this.level.style.setProperty('--f', String(bar.goalFraction));
    keyed(this.pills, bar.pills.map((p) => p.key).join(), () =>
      bar.pills.map((p) => h('div.pill', { 'data-pill': p.key }, iconEl(p.icon), h('span.parts'))),
    );
    for (const p of bar.pills) {
      const el = this.pills.querySelector<HTMLElement>(`[data-pill="${p.key}"]`)!;
      el.classList.toggle('alarm', p.alarm);
      partsTo(el.querySelector('.parts')!, p.parts);
    }
    partsTo(this.goal, bar.goal);
    keyed(this.season, bar.seasonIcon, () => [iconEl(bar.seasonIcon), h('span.parts')]);
    partsTo(this.season.querySelector<HTMLElement>('.parts')!, bar.season);
    keyed(this.speed, String(s.speed), () => (s.speed === 0 ? [iconEl('pause')] : [`${s.speed}x`]));
    this.speed.setAttribute('aria-label', s.speed === 0 ? 'pausado' : `${s.speed}x`);

    for (const [t, el] of this.tools) el.classList.toggle('on', s.tool === t);
    for (const btn of buildColumn(st, s.tool, this.phone)) {
      const el = this.builds.get(btn.kind)!;
      el.classList.toggle('on', btn.on);
      el.classList.toggle('locked', btn.locked);
      el.classList.toggle('short', btn.short);
      setText(el.querySelector('small')!, btn.line);
    }

    this.updateBalloon();
    this.queue.prune();
    this.drawToasts();
  }

  /** The tapped building's balloon: its name, road and level, and Melhorar / Demolir (`balloonOf`). */
  private updateBalloon() {
    const s = this.host.session;
    const c = s.selected;
    const bal = balloonOf(s.state, c);
    if (!c || !bal) {
      this.balloon.classList.add('hidden');
      this.balloonAt = null;
      return;
    }
    this.balloonAt = bal.rect;
    const affordable = s.state.silver >= (bal.upgrade?.cost ?? 0);
    keyed(this.balloon, bal.key + affordable, () => {
      const acts = h('div.acts');
      if (bal.upgrade) {
        const up = h('button.act.gold', {}, bal.upgrade.label);
        onTap(up, () => s.upgradeAt(c));
        acts.append(up);
      }
      if (bal.demolish) {
        const del = h('button.act.red', {}, T.nova.inspect.demolish);
        onTap(del, () => s.demolishAt(c));
        acts.append(del);
      }
      return [h('h3', {}, bal.title), ...bal.lines.map((l) => h('div', { class: tone(l.tone) || null }, l.text)), acts.childElementCount ? acts : null];
    });
    this.balloon.classList.remove('hidden');
  }

  // ---------- toasts ----------

  toast(msg: string, t: Tone = 'info', opt: ToastOptions = {}) {
    this.queue.show(msg, t, opt);
    this.drawToasts();
  }

  private drawToasts() {
    const ids = new Set(this.queue.list.map((t) => t.id));
    for (const [id, el] of this.toastEls)
      if (!ids.has(id)) {
        el.remove();
        this.toastEls.delete(id);
      }
    // Newest at the bottom (the box stacks upward).
    this.queue.list.forEach((t, k) => {
      let el = this.toastEls.get(t.id);
      if (!el) {
        el = h('div.toast.panel', { class: [t.tone, t.opt.big ? 'big' : ''].filter(Boolean).join(' ') }, t.msg);
        this.toastEls.set(t.id, el);
      }
      if (this.toastBox.children[k] !== el) this.toastBox.insertBefore(el, this.toastBox.children[k] ?? null);
    });
  }

  // ---------- tutorial ----------

  setTutorial(sentence: string | null) {
    this.tutorial.classList.toggle('hidden', sentence === null);
    if (sentence !== null) setText(this.tutorialText, sentence);
    if (sentence === null) this.arrowAt = null;
  }

  // ---------- preview pill ----------

  /** The lines over the previewed building (null hides the pill). */
  setTag(lines: string[] | null, at: Rect | null) {
    const on = !!lines?.length && !!at;
    this.tag.classList.toggle('hidden', !on);
    this.tagAt = on ? at : null;
    if (on) setText(this.tag, lines!.join('\n'));
  }

  // ---------- floating text ----------

  private floats: { el: HTMLElement; at: Rect; age: number }[] = [];

  /** A short text rising from a building and fading (a house's gain, a failure on the spot). */
  float(text: string, at: Rect, t: 'gold' | 'bad') {
    const el = h('div.anchor.float', { class: `t-${t}` }, text);
    this.root.append(el);
    this.floats.push({ el, at, age: 0 });
  }

  private moveFloats(dtMs: number) {
    this.floats = this.floats.filter((f) => {
      f.age += dtMs;
      const k = f.age / FLOAT_MS;
      if (k >= 1) {
        f.el.remove();
        return false;
      }
      const p = this.host.screenOf(f.at, 1.4);
      f.el.style.visibility = p ? 'visible' : 'hidden';
      if (p) f.el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y - 40 * k)}px) translate(-50%, -100%)`;
      f.el.style.opacity = String(k < 0.7 ? 1 : (1 - k) / 0.3);
      return true;
    });
  }

  // ---------- per frame ----------

  /** Per frame: time for the toasts, and what is pinned to the world follows the camera. */
  frame(dtMs: number) {
    const before = this.queue.list.length;
    this.queue.tick(dtMs);
    if (this.queue.list.length !== before) this.drawToasts();
    this.place(this.balloon, this.balloonAt, (p) => `translate(${Math.round(p.x + 24)}px, ${Math.round(p.y - 30)}px)`);
    this.place(this.tag, this.tagAt, (p) => `translate(${Math.round(p.x)}px, ${Math.round(p.y - 8)}px) translate(-50%, -100%)`);
    this.pointArrow();
    if (this.floats.length) this.moveFloats(dtMs);
  }

  private place(el: HTMLElement, at: Rect | null, transform: (p: { x: number; y: number }) => string) {
    if (!at) return;
    const p = this.host.screenOf(at);
    el.style.visibility = p ? 'visible' : 'hidden';
    if (p) el.style.transform = transform(p);
  }

  /** Where the tutorial arrow points: a button (tool, building) or a place on the map. */
  setArrow(target: { tool: Tool } | { rect: Rect; lift: number } | null) {
    if (!target) this.arrowAt = null;
    else if ('tool' in target) {
      const r = this.buttonOf(target.tool);
      if (!r) this.arrowAt = null;
      else if (this.builds.has(target.tool as BuildableKind)) this.arrowAt = { x: r.left - 4, y: r.top + r.height / 2, dir: 'right' };
      else this.arrowAt = { x: r.left + r.width / 2, y: r.top - 4, dir: 'down' };
    } else this.arrowAt = target;
  }

  private pointArrow() {
    const a = this.arrowAt;
    this.arrow.classList.toggle('hidden', !a || this.tutorial.classList.contains('hidden'));
    if (!a) return;
    let p: { x: number; y: number } | null;
    let dir: 'down' | 'left' | 'right' = 'down';
    if ('rect' in a) {
      const top = this.host.screenOf(a.rect, 1);
      p = top && { x: top.x, y: top.y + a.lift };
    } else {
      p = a;
      dir = a.dir;
    }
    if (!p) {
      this.arrow.classList.add('hidden');
      return;
    }
    const rot = dir === 'down' ? 0 : dir === 'right' ? -90 : 90;
    // The arrow is drawn pointing down with its tip at the bottom centre.
    this.arrow.style.transform = `translate(${Math.round(p.x - 20)}px, ${Math.round(p.y - 56)}px) rotate(${rot}deg)`;
  }

  // ---------- dialogs ----------

  showVictory(week: number, residents: number, births: number, weddings: number) {
    this.dialog(T.victoryTitle, `${T.victoryText(week, residents)}\n${T.victoryPeople(births, weddings)}`, [[T.keepBuilding, () => this.closeModal()]]);
  }

  showDefeat(week: number, peak: number) {
    this.dialog(T.defeatTitle, T.defeatText(week, peak), [
      [T.sameMap, () => this.host.restart(true)],
      [T.retry, () => this.host.restart(false)],
    ]);
  }

  private dialog(title: string, text: string, buttons: [string, () => void][]) {
    this.closeModal();
    const acts = h('div.acts');
    for (const [label, fn] of buttons) {
      const b = h('button.act.gold', {}, label);
      onTap(b, fn);
      acts.append(b);
    }
    this.modal = h('div.modal', {}, h('div.card', {}, h('h2', {}, title), h('p', {}, text), acts));
    this.root.append(this.modal);
  }

  private closeModal() {
    this.modal?.remove();
    this.modal = null;
  }

  // ---------- settings (the gear) ----------

  private settingsBox = h('div.settings.panel.hidden');

  get settingsOpen() {
    return !this.settingsBox.classList.contains('hidden');
  }

  /** The gear's panel: day and night, and which map the game opens with (3D or the classic 2D). */
  private toggleSettings() {
    if (this.settingsOpen) {
      this.settingsBox.classList.add('hidden');
      return;
    }
    const S = T.nova.settings;
    const row = (label: string, value: string, spot: string, fn: () => void, note?: string) => {
      const b = h('button.act', { 'data-spot': spot }, value);
      onTap(b, fn);
      return h('div.row', {}, h('span', {}, label), b, note ? h('small.t-muted', {}, note) : null);
    };
    this.settingsBox.replaceChildren(
      h('h3', {}, T.nova.buttons.settings),
      row(S.dayNight, settings.dayNight ? S.on : S.off, 'set-daynight', () => {
        settings.dayNight = !settings.dayNight;
        saveSettings();
        this.toggleSettings();
        this.toggleSettings();
      }),
      row(S.view, S.view3d, 'set-view', () => {
        settings.view = '2d';
        saveSettings();
        this.settingsBox.classList.add('hidden');
        this.host.toClassic();
      }, this.host.exit ? undefined : S.viewNewGame),
    );
    this.settingsBox.classList.remove('hidden');
  }

  /** Esc: closes the settings or the open balloon; false when nothing was open. */
  closeTop(): boolean {
    if (this.settingsOpen) {
      this.settingsBox.classList.add('hidden');
      return true;
    }
    if (this.balloonAt && this.host.session.selected) {
      this.host.session.deselect();
      return true;
    }
    return false;
  }
}

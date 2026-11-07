import { fitPills, topBar, type MeasureText, type PillMetrics } from '../game/model/topbar';
import type { Session } from '../game/session';
import { T } from '../game/strings';
import type { Speed } from '../game/tools';
import { h, keyed, onTap, setText } from './dom';
import { iconButton, iconEl, partsTo } from './parts';

/** Room left beside the pills (px): the text measure is an estimate. */
const FIT_SLACK = 10;

/**
 * The top bar: level ring, resource pills, the goal, the season, speed and the gear. The
 * level ring and the goal open Objetivos (as in the 2D), the other pills Estatísticas; the goal
 * follows the pills on their row when it fits, else on the next one. On PC the pills shorten
 * (`fitPills`) so they stay on one row before the season.
 */
export class TopBar {
  readonly el: HTMLElement;
  private pills = h('span.pillset');
  private level = h('div.level.hit', { 'data-spot': 'panel-goals', role: 'button', 'aria-label': T.nova.buttons.goals }, h('b'), h('small', {}, T.nova.level));
  private goal = h('div.pill.goal.hit', { role: 'button' });
  private season = h('div.pill.season');
  private speed: HTMLButtonElement;
  /** PC: pause, 1x and 3x side by side, the one in use gold (as the 2D); the phone cycles one button. */
  private speeds = new Map<Speed, HTMLButtonElement>();
  private right: HTMLElement;
  /** The pills shown so far: a pill that appears (stone, happiness) glows gold three times. */
  private seen: Set<string> | null = null;
  /** The page's sizes for `fitPills`, read again when the window changes. */
  private metrics: { key: string; m: PillMetrics; measure: MeasureText } | null = null;

  constructor(private s: Session, o: { settings: () => void; goals: () => void; stats: () => void }) {
    this.speed = h('button.round.gold', { 'data-spot': 'speed', 'aria-label': T.nova.buttons.speed });
    onTap(this.speed, () => s.cycleSpeed());
    onTap(this.level, o.goals);
    onTap(this.goal, o.goals);
    onTap(this.pills, o.stats);
    onTap(this.season, o.stats);
    const group = h('div.speeds');
    for (const v of [0, 1, 3] as Speed[]) {
      const b = h('button.round.speedbtn', { 'data-spot': `speed-${v}`, 'aria-label': v === 0 ? T.nova.buttons.paused : `${v}x` }, v === 0 ? iconEl('pause') : `${v}x`);
      onTap(b, () => s.setSpeed(v));
      this.speeds.set(v, b);
      group.append(b);
    }
    const right = (this.right = h('div.right', {}, this.season, this.speed, group));
    right.append(iconButton('gear', T.nova.buttons.settings, o.settings, 'settings'));
    this.el = h('header.top', {}, h('div.left', {}, this.level, h('div.pills', {}, this.pills, this.goal)), right);
  }

  update(phone: boolean) {
    const s = this.s;
    let bar = topBar(s.state, s.city, phone);
    keyed(this.season, bar.seasonIcon, () => [iconEl(bar.seasonIcon), h('span.parts')]);
    partsTo(this.season.querySelector<HTMLElement>('.parts')!, bar.season);
    if (!phone && this.el.isConnected) {
      const { m, measure } = this.measures();
      const room = this.el.clientWidth - this.level.offsetWidth - this.right.offsetWidth - 2 * m.gap - FIT_SLACK;
      const fit = fitPills((f) => topBar(s.state, s.city, false, f).pills, room, measure, m);
      if (fit) bar = topBar(s.state, s.city, false, fit);
    }
    setText(this.level.querySelector('b')!, String(bar.level));
    this.level.style.setProperty('--f', String(bar.goalFraction));
    keyed(this.pills, bar.pills.map((p) => p.key).join(), () => bar.pills.map((p) => h('div.pill', { 'data-pill': p.key }, iconEl(p.icon), h('span.parts'))));
    const seen = this.seen;
    this.seen = new Set(bar.pills.map((p) => p.key));
    for (const p of bar.pills) {
      const el = this.pills.querySelector<HTMLElement>(`[data-pill="${p.key}"]`)!;
      if (seen && !seen.has(p.key)) el.classList.add('new');
      el.classList.toggle('alarm', p.alarm);
      partsTo(el.querySelector('.parts')!, p.parts);
    }
    partsTo(this.goal, bar.goal);
    keyed(this.speed, String(s.speed), () => (s.speed === 0 ? [iconEl('pause')] : [`${s.speed}x`]));
    this.speed.setAttribute('aria-label', s.speed === 0 ? T.nova.buttons.paused : `${s.speed}x`);
    for (const [v, b] of this.speeds) b.classList.toggle('on', s.speed === v);
  }

  /** Pill sizes from ui.css and a text measure with the bar's fonts (once per window size). */
  private measures() {
    const key = `${innerWidth}x${innerHeight}`;
    if (this.metrics?.key === key) return this.metrics;
    const cs = getComputedStyle(this.el);
    const px = (v: string) => parseFloat(cs.getPropertyValue(v)) || 0;
    const pill = px('--pill');
    const ctx = document.createElement('canvas').getContext('2d')!;
    const font = cs.fontFamily;
    const fonts = { num: `800 ${px('--num')}px ${font}`, text: `700 ${px('--text')}px ${font}`, small: `700 ${px('--small')}px ${font}` };
    const measure: MeasureText = (text, size) => {
      ctx.font = fonts[size ?? 'text'];
      return ctx.measureText(text).width;
    };
    // .pill: 12 px padding and a 1.5 px border each side, the icon 0.6 of its height, gaps of 6 and 4.
    const m: PillMetrics = { pad: 27, icon: pill * 0.7, iconGap: 6, partGap: 4, gap: px('--gap'), bar: 80 };
    return (this.metrics = { key, m, measure });
  }
}

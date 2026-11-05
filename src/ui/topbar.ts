import { topBar } from '../game/model/topbar';
import type { Session } from '../game/session';
import { T } from '../render/strings';
import { h, keyed, onTap, setText } from './dom';
import { iconButton, iconEl, partsTo } from './parts';

/** The top bar: level ring, resource pills, the goal, the season, speed, back to 2D and the gear. */
export class TopBar {
  readonly el: HTMLElement;
  private pills = h('div.pills');
  private level = h('div.level', {}, h('b'), h('small', {}, T.nova.level));
  private goal = h('div.pill.goal');
  private season = h('div.pill.season');
  private speed: HTMLButtonElement;

  constructor(private s: Session, o: { exit: (() => void) | null; settings: () => void }) {
    this.speed = h('button.round.gold', { 'data-spot': 'speed', 'aria-label': 'velocidade' });
    onTap(this.speed, () => s.cycleSpeed());
    const right = h('div.right', {}, this.season, this.speed);
    if (o.exit) {
      const exit = h('button.round.pill', { 'data-spot': 'exit3d', 'aria-label': T.view3d.classicHint }, T.view3d.classic);
      onTap(exit, () => o.exit?.());
      right.append(exit);
    }
    right.append(iconButton('gear', T.nova.buttons.settings, o.settings, 'settings'));
    this.el = h('header.top', {}, h('div.left', {}, this.level, h('div.rows', {}, this.pills, this.goal)), right);
  }

  update(phone: boolean) {
    const s = this.s;
    const bar = topBar(s.state, s.city, phone);
    setText(this.level.querySelector('b')!, String(bar.level));
    this.level.style.setProperty('--f', String(bar.goalFraction));
    keyed(this.pills, bar.pills.map((p) => p.key).join(), () => bar.pills.map((p) => h('div.pill', { 'data-pill': p.key }, iconEl(p.icon), h('span.parts'))));
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
  }
}

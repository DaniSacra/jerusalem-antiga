import { readCity, type BuildableKind } from '../core';
import { jobsView } from '../game/model/jobs';
import { alertsPanel, goalsPanel, STATS_TABS, statsPanel, type PanelSection, type StatsTab } from '../game/model/panels';
import type { Session } from '../game/session';
import type { Notice } from '../game/notices';
import { T } from '../game/strings';
import { h, keyed, onTap, resetKey } from './dom';
import { jobsContent } from './jobs';
import { panelLine } from './lines';

export type PanelKind = 'goals' | 'alerts' | 'stats' | 'jobs';

/**
 * One panel at a time over the map, right of the side buttons: Objetivos, Avisos, Estatísticas
 * (tabs Agora, Povo, Histórico) and Profissões (`jobs.ts`). Sections flow into columns (CSS) and the
 * panel scrolls when they do not fit. Redrawn only when what it shows changed.
 */
export class Panels {
  readonly el = h('div.panelbox.panel.hidden', { 'data-spot': 'panel' });
  open: PanelKind | null = null;
  private tab: StatsTab = 'now';
  /** The buildings' thumbnails: the Profissões rows show them. */
  private thumbs: Partial<Record<BuildableKind, string>> = {};

  constructor(
    private s: Session,
    private phone: () => boolean,
    private onHouse: (houseId: number) => void,
    private onClose: () => void,
  ) {}

  toggle(kind: PanelKind) {
    if (this.open === kind) this.close();
    else {
      this.open = kind;
      resetKey(this.el);
    }
  }

  setThumbs(urls: Partial<Record<BuildableKind, string>>) {
    this.thumbs = urls;
    resetKey(this.el);
  }

  close(): boolean {
    const was = this.open !== null;
    this.open = null;
    this.el.classList.add('hidden');
    return was;
  }

  update(notices: Notice[]) {
    const kind = this.open;
    if (!kind) return this.el.classList.add('hidden');
    const s = this.s;
    const phone = this.phone();
    this.el.classList.toggle('jobs', kind === 'jobs');
    if (kind === 'jobs') {
      const v = jobsView(s.state);
      keyed(this.el, JSON.stringify([kind, v, Object.keys(this.thumbs).length]), () =>
        jobsContent(v, this.thumbs, v.note, { change: (k, d) => s.changeJobTarget(k, d), auto: () => s.autoJobs(), close: () => this.onClose() }),
      );
      return this.el.classList.remove('hidden');
    }
    let sections: PanelSection[];
    if (kind === 'goals') sections = [goalsPanel(s.state, phone)];
    else if (kind === 'alerts') sections = alertsPanel(notices);
    else {
      const city = s.city ?? readCity(s.state);
      sections = statsPanel(this.tab, { s: s.state, e: city.eco, forecast: city.forecast, notices }, phone);
    }
    keyed(this.el, JSON.stringify([kind, this.tab, sections]), () => {
      const x = h('button.act.close.x', { 'data-spot': 'panel-close', 'aria-label': T.nova.inspect.close }, '✕');
      onTap(x, () => this.onClose());
      const body = h('div.sections', { class: kind === 'goals' ? 'goals' : null });
      for (const sec of sections) body.append(h('div.section', {}, ...sec.map((l) => panelLine(l, (id) => this.onHouse(id)))));
      if (kind !== 'stats') return [x, body];
      const tabs = h('div.tabs');
      for (const t of STATS_TABS) {
        const b = h('button.tab', { class: t === this.tab ? 'on' : null, 'data-spot': `tab-${t}` }, T.nova.tabs[t]);
        onTap(b, () => {
          this.tab = t;
          this.update(notices);
        });
        tabs.append(b);
      }
      return [x, tabs, body];
    });
    this.el.classList.remove('hidden');
  }
}

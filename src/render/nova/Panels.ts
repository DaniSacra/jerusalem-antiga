import Phaser from 'phaser';
import {
  BUILDINGS,
  calendar,
  foodCapacity,
  foodForecast,
  gatherFood,
  goalProgress,
  goalTarget,
  GOALS,
  happinessOn,
  HOUSE_LEVELS,
  housesByLevel,
  RULES,
  seasonOf,
  lastsToHarvest,
  type BuildingKind,
  type Economy,
  type GameState,
  type WeekRecord,
} from '../../core';
import { px, setNovaSpot, type Rect } from '../layout';
import { NOVA, NOVA_CSS } from '../palette';
import { saveSettings, settings } from '../settings';
import { fmt, fmtInt, signed, T } from '../strings';
import type { Notice } from './notices';
import type { PanelKind } from './Tools';
import { lineH, PHONE, S } from './metrics';
import { darkPanel, ntext, RoundButton } from './widgets';

/** A piece of a panel line. */
interface Part {
  text: string;
  color?: string;
  size?: number;
  bold?: boolean;
}

/** A small line chart of the last weeks; `limit` is drawn dashed (the food store limit). */
interface Chart {
  values: number[];
  color: number;
  limit?: number[];
}

/** A panel line: parts in a row, one wrapped text (`wrap`) or a chart. */
interface PLine {
  parts: Part[];
  gap?: number;
  wrap?: boolean;
  chart?: Chart;
}
/** Lines that stay together in one column. */
type Section = PLine[];

const title = (text: string): PLine => ({ parts: [{ text, color: NOVA_CSS.gold, size: S.num }] });
const row = (label: string, value: string, color: string = NOVA_CSS.text): PLine => ({ parts: [{ text: label, color: NOVA_CSS.muted, bold: false }, { text: value, color }] });
const tone = (n: number) => (n < 0 ? NOVA_CSS.bad : n > 0 ? NOVA_CSS.good : NOVA_CSS.text);
const note = (text: string, color: string = NOVA_CSS.muted): PLine => ({ parts: [{ text, color, bold: false, size: S.small }], wrap: true });

/** Size of a chart (game px). */
const CHART_W = px(PHONE ? 150 : 200);
const CHART_H = px(PHONE ? 46 : 64);

export interface PanelHandlers {
  onTurn(dir: 1 | -1): void;
  onSettings(): void;
}

/** Where a panel opens: its top-left corner and the room it has. */
export interface PanelArea {
  x: number;
  y: number;
  maxW: number;
  maxH: number;
  /** Right-aligned at x + maxW (settings, under the gear). */
  alignRight?: boolean;
}

/** What the panels show besides the state: the warnings and the week each milestone came. */
export interface PanelData {
  s: GameState;
  e: Economy;
  notices: Notice[];
}

type StatsTab = 'now' | 'history';

/**
 * One panel at a time, over the map: Objetivos (done, current with progress, next), Avisos (the
 * warnings), Estatísticas (two tabs: the numbers now with the problems, and the charts of the last
 * weeks with the milestones) and Configurações.
 */
export class Panels {
  private root: Phaser.GameObjects.Container | null = null;
  private rect: Rect | null = null;
  open: PanelKind | null = null;
  private tab: StatsTab = 'now';
  private slow = false;
  private last: PanelData | null = null;

  constructor(private scene: Phaser.Scene, private area: (kind: PanelKind) => PanelArea, private h: PanelHandlers) {}

  toggle(kind: PanelKind) {
    if (this.open === kind) this.close();
    else {
      this.open = kind;
      this.build();
    }
  }

  close(): boolean {
    const was = this.open !== null;
    this.open = null;
    this.root?.destroy();
    this.root = null;
    this.rect = null;
    return was;
  }

  refresh(data: PanelData) {
    this.last = data;
    if (this.open) this.build();
  }

  setSlow(slow: boolean) {
    if (slow === this.slow) return;
    this.slow = slow;
    if (this.open === 'settings') this.build();
  }

  contains(x: number, y: number) {
    const r = this.rect;
    return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  private build() {
    this.root?.destroy();
    this.root = null;
    const kind = this.open;
    if (!kind) return;
    const a = this.area(kind);
    const root = this.scene.add.container(0, 0).setDepth(50);
    this.root = root;
    const pad = px(14);
    let w: number;
    let h: number;
    if (kind === 'settings') [w, h] = this.settingsBody(root, pad);
    else {
      const top = kind === 'stats' ? this.tabs(root, pad) : 0;
      const sections = this.last ? this.sections(kind, this.last) : [];
      [w, h] = this.flow(root, sections, pad, top, a.maxH - 2 * pad - top, a.maxW - 2 * pad);
      w = Math.max(w, top ? this.tabsW : 0);
      h += top;
    }
    w += 2 * pad;
    h += 2 * pad;
    const x = a.alignRight ? a.x + a.maxW - w : a.x;
    const bg = this.scene.add.graphics();
    darkPanel(bg, 0, 0, w, h, px(16), NOVA.balloonAlpha);
    // Taps on the panel stay on it (never reach the map or the buttons under it).
    const block = this.scene.add.zone(0, 0, w, h).setOrigin(0).setInteractive();
    root.addAt(block, 0);
    root.addAt(bg, 1);
    root.setPosition(x, a.y);
    this.rect = { x, y: a.y, w, h };
  }

  private tabsW = 0;

  /** The two stats tabs (round capsules, the open one gold); returns the height they take. */
  private tabs(root: Phaser.GameObjects.Container, pad: number): number {
    const N = T.nova.tabs;
    const capW = px(120);
    const gap = px(8);
    (['now', 'history'] as const).forEach((tab, k) => {
      const t = ntext(this.scene, 0, 0, N[tab], S.text, NOVA_CSS.ink).setOrigin(0.5);
      const b = new RoundButton(this.scene, pad + capW / 2 + k * (capW + gap), pad + S.btn / 2, capW, S.btn, [t], () =>
        this.scene.time.delayedCall(0, () => {
          this.tab = tab;
          if (this.open === 'stats') this.build();
        }),
        { style: this.tab === tab ? 'gold' : 'parchment' },
      );
      root.add(b.root);
      this.spot(`stats-${tab}`, b, capW);
    });
    this.tabsW = 2 * capW + gap;
    return S.btn + px(10);
  }

  /** Lays the sections out in columns that fit `maxH`, from `top` down; returns the size used. */
  private flow(root: Phaser.GameObjects.Container, sections: Section[], pad: number, top: number, maxH: number, maxW: number): [number, number] {
    const colGap = px(22);
    let x = pad;
    let y = pad + top;
    let colW = 0;
    let usedH = 0;
    let right = 0;
    for (const sec of sections) {
      let sy = 0;
      let sw = 0;
      const lines = sec.map((l) => {
        const out: (Phaser.GameObjects.Text | Phaser.GameObjects.Graphics)[] = [];
        let lx = 0;
        let lh = 0;
        if (l.chart) {
          out.push(this.chart(l.chart));
          lx = CHART_W + px(6);
          lh = CHART_H;
        }
        for (const p of l.parts) {
          const size = p.size ?? S.text;
          const t = ntext(this.scene, lx, 0, p.text, size, p.color ?? NOVA_CSS.text, p.bold ?? true);
          if (l.wrap) t.setWordWrapWidth(Math.min(maxW, px(PHONE ? 300 : 420))).setLineSpacing(lineH(size) - size * 1.15);
          out.push(t);
          lx += t.width + px(6);
          lh = Math.max(lh, t.height);
        }
        sy += l.gap ?? 0;
        const ly = sy;
        sy += Math.max(lh, lineH(S.text)) + px(2);
        sw = Math.max(sw, lx - px(6));
        return { out, ly };
      });
      const secH = sy;
      if (y > pad + top && y - pad - top + secH > maxH) {
        x += colW + colGap;
        y = pad + top;
        colW = 0;
      }
      for (const { out, ly } of lines) for (const t of out) {
        t.setPosition(x + t.x, y + ly);
        root.add(t);
      }
      colW = Math.max(colW, sw);
      right = Math.max(right, x + colW);
      y += secH + px(8);
      usedH = Math.max(usedH, y - px(8) - top);
    }
    return [right - pad, usedH - pad];
  }

  /** A line chart at (0, 0): the values scaled between 0 (or the lowest) and the highest. */
  private chart(c: Chart): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    g.fillStyle(NOVA.box, 0.95).fillRoundedRect(0, 0, CHART_W, CHART_H, px(6));
    const all = [...c.values, ...(c.limit ?? [])];
    const lo = Math.min(0, ...all);
    const hi = Math.max(1, ...all);
    const n = c.values.length;
    const ix = (k: number) => px(4) + (n <= 1 ? 0 : (k / (n - 1)) * (CHART_W - px(8)));
    const iy = (v: number) => CHART_H - px(4) - ((v - lo) / (hi - lo)) * (CHART_H - px(8));
    // Zero line when the values go negative (debt).
    if (lo < 0) g.lineStyle(px(1), NOVA.bad, 0.6).lineBetween(px(4), iy(0), CHART_W - px(4), iy(0));
    if (c.limit && n > 1) {
      g.lineStyle(px(1.5), NOVA.chart.capacity, 0.8);
      for (let k = 0; k < n - 1; k++) if (k % 2 === 0) g.lineBetween(ix(k), iy(c.limit[k]), ix(k + 1), iy(c.limit[k + 1]));
    }
    if (n > 1) {
      g.lineStyle(px(2), c.color, 1).beginPath();
      c.values.forEach((v, k) => (k ? g.lineTo(ix(k), iy(v)) : g.moveTo(ix(k), iy(v))));
      g.strokePath();
    }
    if (n) g.fillStyle(c.color, 1).fillCircle(ix(n - 1), iy(c.values[n - 1]), px(3));
    return g;
  }

  private sections(kind: PanelKind, d: PanelData): Section[] {
    const { s } = d;
    const N = T.nova;
    if (kind === 'goals') {
      const lines: PLine[] = [];
      GOALS.forEach((g, i) => {
        const done = i < s.goalIndex;
        const cur = i === s.goalIndex;
        const mark = done ? N.goals.done : cur ? N.goals.current : N.goals.next;
        // Phone: the reward and the unlock only on the current goal (the list must fit the short screen).
        const extra = PHONE && !cur ? '' : [g.victory ? N.goals.victory : N.goals.reward(g.reward), ...(g.unlock ? [N.goals.unlocks(g.unlock)] : [])].join(' · ');
        const progress = cur ? [{ text: N.progress(goalProgress(s, g), goalTarget(s, g)), color: NOVA_CSS.gold }] : [];
        lines.push({
          parts: [
            { text: mark, color: done ? NOVA_CSS.good : cur ? NOVA_CSS.gold : NOVA_CSS.muted },
            { text: `${i + 1}. ${g.text}`, color: done ? NOVA_CSS.muted : NOVA_CSS.text, bold: cur },
            ...progress,
            ...(extra ? [{ text: extra, color: NOVA_CSS.muted, size: S.small, bold: false }] : []),
          ],
          gap: cur ? px(2) : 0,
        });
      });
      // Two halves, so a short screen lays them out in two columns.
      const half = Math.ceil(lines.length / 2);
      return [[title(N.buttons.goals), ...lines.slice(0, half)], lines.slice(half)];
    }
    if (kind === 'alerts') return [[title(N.buttons.alerts), ...this.noticeLines(d.notices)]];
    return this.tab === 'history' ? this.history(d) : this.numbers(d);
  }

  /** The warnings, one wrapped line each (always with the ⚠ mark, never only the color). */
  private noticeLines(list: Notice[]): PLine[] {
    if (!list.length) return [{ parts: [{ text: T.nova.noAlerts, color: NOVA_CSS.good }] }];
    return list.map((n) => ({ parts: [{ text: '⚠ ' + n.text, color: n.bad ? NOVA_CSS.bad : NOVA_CSS.warn }], wrap: true, gap: px(4) }));
  }

  /** Estatísticas, tab "Agora": silver, food, work, houses, happiness and the problems. */
  private numbers({ s, e, notices }: PanelData): Section[] {
    const N = T.nova;
    const st = N.stats;
    const per = N.perWeek;
    const kinds = Object.keys(BUILDINGS) as BuildingKind[];
    const silver: Section = [title(st.silver), row(st.taxes, `+${fmt(e.taxes)}${per}`, NOVA_CSS.good)];
    for (const k of kinds) if (e.production[k] !== undefined) silver.push(row(BUILDINGS[k].name, `+${fmt(e.production[k]!)}${per}`, NOVA_CSS.good));
    const costs = kinds.filter((k) => e.upkeep[k] !== undefined);
    // The upkeep and the balance are a section of their own, so a short screen can move them to the next column.
    const upkeep: Section = [];
    if (costs.length) upkeep.push({ parts: [{ text: st.upkeep, color: NOVA_CSS.muted, bold: false }] });
    for (const k of costs) upkeep.push(row('  ' + BUILDINGS[k].name, `−${fmt(e.upkeep[k]!)}${per}`, NOVA_CSS.bad));
    upkeep.push(row(st.balance, `${signed(e.silverDelta)}${per}`, tone(e.silverDelta)));

    // Food: what comes in by source (harvest, fishing, gathering), what is eaten, the stock and the forecast.
    const gathered = (kind: BuildingKind) => s.buildings.reduce((n, b) => n + (b.kind === kind ? gatherFood(s, b) : 0), 0) * e.efficiency;
    const out = foodForecast(s, e);
    const lasts = lastsToHarvest(s, out);
    const when = lasts ? st.toHarvest : out!.season === seasonOf(s.week) && out!.weeks < RULES.weeksPerSeason ? st.weeks(out!.weeks) : `${st.weeks(out!.weeks)} · ${N.foodUntil[out!.season]}`;
    const cap = foodCapacity(s);
    const food: Section = [title(st.food)];
    if (e.harvest > 0) food.push(row(BUILDINGS.field.name, `+${fmt(e.harvest)}${per}`, NOVA_CSS.good));
    for (const k of ['fisher', 'gatherer'] as const) {
      const n = gathered(k);
      if (n > 0) food.push(row(BUILDINGS[k].name, `+${fmt(n)}${per}`, NOVA_CSS.good));
    }
    food.push(
      row(st.eaten, `−${fmt(e.foodEaten)}${per}`, NOVA_CSS.bad),
      row(st.balance, `${signed(e.foodDelta)}${per}`, tone(e.foodDelta)),
      row(st.stock, N.stock(Math.floor(s.food), cap), s.spoiled > 0 ? NOVA_CSS.warn : NOVA_CSS.text),
      row(st.forecast, when, lasts ? NOVA_CSS.good : NOVA_CSS.bad),
    );
    const idle = Math.max(0, e.workers - e.jobs);
    const eff = Math.round(e.efficiency * 100);
    const work: Section = [
      title(st.work),
      row(st.workers, fmtInt(e.workers)),
      row(st.jobs, fmtInt(e.jobs)),
      row(st.idle, fmtInt(idle), idle > 0 ? NOVA_CSS.warn : NOVA_CSS.text),
      row(st.efficiency, `${eff}%`, eff < 100 ? NOVA_CSS.bad : NOVA_CSS.good),
    ];
    const byLevel = housesByLevel(s);
    const houses: Section = [title(st.houses), ...HOUSE_LEVELS.map((l, i) => row(l.name, fmtInt(byLevel[i])))];
    const out2: Section[] = [silver, upkeep, food, work, houses];
    if (happinessOn(s))
      out2.push([
        title(st.happiness),
        row(st.happiness, String(e.happiness)),
        row(T.mood.happy, fmtInt(e.moods.happy), NOVA_CSS.good),
        row(T.mood.neutral, fmtInt(e.moods.neutral)),
        row(T.mood.sad, fmtInt(e.moods.sad), e.moods.sad ? NOVA_CSS.bad : NOVA_CSS.text),
        note(st.why),
      ]);
    // Phone: the problems are left to the Avisos button (no room for them here).
    if (!PHONE) out2.push([title(st.problems), ...(notices.length ? this.noticeLines(notices) : [row('', st.none, NOVA_CSS.good)])]);
    return out2;
  }

  /** Estatísticas, tab "Histórico": a chart per number over the last weeks, then the milestones. */
  private history({ s }: PanelData): Section[] {
    const st = T.nova.stats;
    const h = s.history;
    const last = (f: (r: WeekRecord) => number) => (h.length ? f(h[h.length - 1]) : 0);
    const chart = (name: string, value: string, values: number[], color: number, limit?: number[]): Section => [
      { parts: [{ text: name, color: NOVA_CSS.gold }, { text: value }] },
      { parts: [], chart: { values, color, limit } },
    ];
    const out: Section[] = [];
    if (h.length < 2) out.push([title(T.nova.tabs.history), note(st.noHistory)]);
    else {
      out.push([title(T.nova.tabs.history), note(st.lastWeeks(h.length))]);
      out.push(chart(st.silver, fmtInt(last((r) => r.silver)), h.map((r) => r.silver), NOVA.chart.silver));
      out.push([
        ...chart(st.food, T.nova.stock(Math.floor(last((r) => r.food)), last((r) => r.capacity)), h.map((r) => r.food), NOVA.chart.food, h.map((r) => r.capacity)),
        note(`- - ${st.capacity}`),
      ]);
      out.push(chart(st.residents, fmtInt(last((r) => r.residents)), h.map((r) => r.residents), NOVA.chart.residents));
      if (happinessOn(s)) out.push(chart(st.happiness, String(Math.round(last((r) => r.happiness))), h.map((r) => r.happiness), NOVA.chart.happiness));
    }
    const marks: PLine[] = [title(st.milestones)];
    if (!s.milestones.length) marks.push(note(st.noMilestones));
    for (const id of s.milestones) {
      const w = s.milestoneWeeks[id];
      const c = w === undefined ? null : calendar(w);
      marks.push({ parts: [{ text: '★', color: NOVA_CSS.gold }, { text: c ? st.milestoneAt(T.milestoneName[id], T.nova.calendar(c.season, c.year, c.week, true)) : T.milestoneName[id], bold: false }] });
    }
    out.push(marks);
    return out;
  }

  /** Registers a panel button for the visual tests (window.layout.novaPoint); null once the panel is closed. */
  private spot(name: string, b: RoundButton, d: number) {
    setNovaSpot(name, () => {
      if (!b.root.active) return null;
      const m = b.root.getWorldTransformMatrix();
      return { x: m.tx, y: m.ty, d };
    });
  }

  /** Configurações: Girar a visão, Dia e noite, Efeito maquete. Returns the body size. */
  private settingsBody(root: Phaser.GameObjects.Container, pad: number): [number, number] {
    const N = T.nova.settings;
    const s = this.scene;
    const rowH = S.btn;
    const labelW = px(LABEL_W);
    const capW = px(118);
    const gap = px(8);
    let y = pad;
    const add = (o: Phaser.GameObjects.GameObject[]) => root.add(o);
    add([ntext(s, pad, y, T.nova.buttons.settings, S.num, NOVA_CSS.gold)]);
    y += lineH(S.num) + px(6);
    const later = (f: () => void) => () => this.scene.time.delayedCall(0, () => {
      f();
      if (this.open === 'settings') this.build();
    });
    const label = (text: string) => add([ntext(s, pad, y + rowH / 2, text, S.text, NOVA_CSS.text).setOrigin(0, 0.5)]);
    const capsule = (x: number, text: string, on: boolean, onPress: () => void, disabled = false) => {
      const t = ntext(s, 0, 0, text, S.text, NOVA_CSS.ink).setOrigin(0.5);
      const b = new RoundButton(s, x + capW / 2, y + rowH / 2, capW, rowH, [t], onPress, { style: on ? 'gold' : 'parchment', dim: disabled });
      if (disabled) b.root.setAlpha(0.6);
      add([b.root]);
      return b;
    };
    const x0 = pad + labelW;
    label(N.turn);
    (['↺', '↻'] as const).forEach((arrow, k) => {
      const b = new RoundButton(s, x0 + rowH / 2 + k * (rowH + gap), y + rowH / 2, rowH, rowH, [ntext(s, 0, 0, arrow, S.num, NOVA_CSS.ink).setOrigin(0.5)], () => this.h.onTurn(k ? 1 : -1));
      add([b.root]);
      this.spot(`setting-turn-${k ? 'right' : 'left'}`, b, rowH);
    });
    y += rowH + gap;
    const toggle = (key: 'dayNight' | 'miniature', text: string) => {
      label(text);
      const slow = key === 'miniature' && this.slow;
      const on = settings[key] && !slow;
      const word = slow ? `${N.off} (${N.slow})` : on ? N.on : N.off;
      const b = capsule(x0, word, on, later(() => {
        if (slow) return;
        settings[key] = !settings[key];
        saveSettings();
        this.h.onSettings();
      }), slow);
      this.spot(`setting-${key}`, b, rowH);
      y += rowH + gap;
    };
    toggle('dayNight', N.dayNight);
    toggle('miniature', N.miniature);
    return [labelW + Math.max(capW, 2 * rowH + gap), y - gap - pad];
  }
}

/** Width (real px) of the labels column in the settings panel. */
const LABEL_W = 150;

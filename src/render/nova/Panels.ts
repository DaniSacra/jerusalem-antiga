import Phaser from 'phaser';
import type { Economy, FoodForecast, GameState } from '../../core';
import { alertsPanel, goalsPanel, statsPanel, type PanelLine } from '../../game/model/panels';
import type { CardTone } from '../../game/model/card';
import { px, setNovaSpot, type Rect } from '../layout';
import { NOVA, NOVA_CSS } from '../palette';
import { saveSettings, settings } from '../settings';
import { T } from '../strings';
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

/** A 44 px parchment capsule in a panel (a family of the Povo tab). */
interface PChip {
  label: string;
  press: () => void;
}

/** A panel line: parts in a row, one wrapped text (`wrap`), a chart or wrapping capsules (`chips`). */
interface PLine {
  parts: Part[];
  gap?: number;
  wrap?: boolean;
  chart?: Chart;
  chips?: PChip[];
}
/** Lines that stay together in one column. */
type Section = PLine[];


const COLOR: Record<CardTone, string> = { text: NOVA_CSS.text, good: NOVA_CSS.good, bad: NOVA_CSS.bad, warn: NOVA_CSS.warn, gold: NOVA_CSS.gold, muted: NOVA_CSS.muted };

/** Size of a chart (game px). */
const CHART_W = px(PHONE ? 150 : 200);
const CHART_H = px(PHONE ? 46 : 64);

export interface PanelHandlers {
  onTurn(dir: 1 | -1): void;
  onSettings(): void;
  /** A family of the Povo tab was tapped: go to its house. */
  onHouse(houseId: number): void;
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
  forecast: FoodForecast;
  notices: Notice[];
}

type StatsTab = 'now' | 'people' | 'history';
const TABS: StatsTab[] = ['now', 'people', 'history'];

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
    const capW = px(PHONE ? 104 : 120);
    const gap = px(8);
    TABS.forEach((tab, k) => {
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
    this.tabsW = TABS.length * capW + (TABS.length - 1) * gap;
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
        const out: (Phaser.GameObjects.Text | Phaser.GameObjects.Graphics | Phaser.GameObjects.Container)[] = [];
        let lx = 0;
        let lh = 0;
        if (l.chips) {
          const room = Math.min(maxW, px(PHONE ? 320 : 460));
          let cx = 0;
          let cy = 0;
          l.chips.forEach((c, k) => {
            const t = ntext(this.scene, 0, 0, c.label, S.text, NOVA_CSS.ink).setOrigin(0.5);
            const w = Math.max(S.btn, t.width + px(24));
            if (cx > 0 && cx + w > room) {
              cx = 0;
              cy += S.btn + px(6);
            }
            const b = new RoundButton(this.scene, cx + w / 2, cy + S.btn / 2, w, S.btn, [t], () => this.scene.time.delayedCall(0, c.press));
            this.spot(`family-${k}`, b, w);
            out.push(b.root);
            cx += w + px(6);
            lx = Math.max(lx, cx);
          });
          lh = cy + S.btn;
        }
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
        t.setPosition(x + t.x, y + ly + t.y);
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
    if (kind === 'goals') {
      const [head, ...lines] = goalsPanel(s, PHONE).map((l) => this.line(l));
      // As many lines per column as the panel height holds (at least two columns), so a short screen lays them out side by side.
      const a = this.area('goals');
      const fit = Math.floor((a.maxH - 2 * px(14) - lineH(S.num) - px(2)) / (lineH(S.text) + px(2)));
      const per = Math.max(1, Math.min(Math.ceil(lines.length / 2), fit));
      const cols: Section[] = [];
      for (let k = 0; k < lines.length; k += per) cols.push(lines.slice(k, k + per));
      cols[0]?.unshift(head);
      return cols;
    }
    const sections = kind === 'alerts' ? alertsPanel(d.notices) : statsPanel(this.tab, { s, e: d.e, forecast: d.forecast, notices: d.notices }, PHONE);
    return sections.map((sec) => sec.map((l) => this.line(l)));
  }

  /** A panel line (`src/game/model/panels`, shared with the 3D) as a line of the 2D panel. */
  private line(l: PanelLine): PLine {
    return {
      parts: l.parts.map((p) => ({ text: p.text, color: p.tone ? COLOR[p.tone] : undefined, size: p.big ? S.num : p.small ? S.small : undefined, bold: p.plain ? false : undefined })),
      gap: l.gap ? px(l.gap) : undefined,
      wrap: l.wrap,
      chart: l.chart && { values: l.chart.values, color: NOVA.chart[l.chart.color], limit: l.chart.limit },
      chips: l.chips?.map((c) => ({ label: c.label, press: () => this.h.onHouse(c.houseId) })),
    };
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

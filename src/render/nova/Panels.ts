import Phaser from 'phaser';
import { alerts, BUILDINGS, foodRunsOut, goalProgress, GOALS, happinessOn, HOUSE_LEVELS, housesByLevel, type BuildingKind, type Economy, type GameState } from '../../core';
import { px, type Rect } from '../layout';
import { NOVA, NOVA_CSS } from '../palette';
import { saveSettings, settings, uiMode, type UiMode } from '../settings';
import { fmt, fmtInt, signed, T } from '../strings';
import type { PanelKind } from './Tools';
import { lineH, S } from './metrics';
import { darkPanel, ntext, RoundButton } from './widgets';

/** A piece of a panel line. */
interface Part {
  text: string;
  color?: string;
  size?: number;
  bold?: boolean;
}
/** A panel line: parts in a row, or one wrapped text (`wrap`). */
interface PLine {
  parts: Part[];
  gap?: number;
  wrap?: boolean;
}
/** Lines that stay together in one column. */
type Section = PLine[];

const title = (text: string): PLine => ({ parts: [{ text, color: NOVA_CSS.gold, size: S.num }] });
const row = (label: string, value: string, color: string = NOVA_CSS.text): PLine => ({ parts: [{ text: label, color: NOVA_CSS.muted, bold: false }, { text: value, color }] });
const tone = (n: number) => (n < 0 ? NOVA_CSS.bad : n > 0 ? NOVA_CSS.good : NOVA_CSS.text);

export interface PanelHandlers {
  onUi(mode: UiMode): void;
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

/**
 * One panel at a time, over the map: Objetivos (done, current with progress, next), Avisos (the
 * core's list), Estatísticas (numbers the core already computes, no charts) and Configurações.
 */
export class Panels {
  private root: Phaser.GameObjects.Container | null = null;
  private rect: Rect | null = null;
  open: PanelKind | null = null;
  private slow = false;
  private last: { s: GameState; e: Economy } | null = null;

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

  refresh(s: GameState, e: Economy) {
    this.last = { s, e };
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
      const sections = this.last ? this.sections(kind, this.last.s, this.last.e) : [];
      [w, h] = this.flow(root, sections, pad, a.maxH - 2 * pad, a.maxW - 2 * pad);
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

  /** Lays the sections out in columns that fit `maxH`; returns the size used. */
  private flow(root: Phaser.GameObjects.Container, sections: Section[], pad: number, maxH: number, maxW: number): [number, number] {
    const colGap = px(22);
    let x = pad;
    let y = pad;
    let colW = 0;
    let usedH = 0;
    let right = 0;
    for (const sec of sections) {
      let sy = 0;
      let sw = 0;
      const lines = sec.map((l) => {
        const out: Phaser.GameObjects.Text[] = [];
        let lx = 0;
        let lh = 0;
        for (const p of l.parts) {
          const size = p.size ?? S.text;
          const t = ntext(this.scene, lx, 0, p.text, size, p.color ?? NOVA_CSS.text, p.bold ?? true);
          if (l.wrap) t.setWordWrapWidth(Math.min(maxW, px(420))).setLineSpacing(lineH(size) - size * 1.15);
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
      if (y > pad && y - pad + secH > maxH) {
        x += colW + colGap;
        y = pad;
        colW = 0;
      }
      for (const { out, ly } of lines) for (const t of out) {
        t.setPosition(x + t.x, y + ly);
        root.add(t);
      }
      colW = Math.max(colW, sw);
      right = Math.max(right, x + colW);
      y += secH + px(8);
      usedH = Math.max(usedH, y - px(8));
    }
    return [right - pad, usedH - pad];
  }

  private sections(kind: PanelKind, s: GameState, e: Economy): Section[] {
    const N = T.nova;
    if (kind === 'goals') {
      const lines: PLine[] = [title(N.buttons.goals)];
      GOALS.forEach((g, i) => {
        const done = i < s.goalIndex;
        const cur = i === s.goalIndex;
        const mark = done ? N.goals.done : cur ? N.goals.current : N.goals.next;
        const extra = [g.victory ? N.goals.victory : N.goals.reward(g.reward), ...(g.unlock ? [N.goals.unlocks(g.unlock)] : [])].join(' · ');
        const progress = cur ? [{ text: N.progress(goalProgress(s, g), g.target), color: NOVA_CSS.gold }] : [];
        lines.push({
          parts: [
            { text: mark, color: done ? NOVA_CSS.good : cur ? NOVA_CSS.gold : NOVA_CSS.muted },
            { text: `${i + 1}. ${g.text}`, color: done ? NOVA_CSS.muted : NOVA_CSS.text, bold: cur },
            ...progress,
            { text: extra, color: NOVA_CSS.muted, size: S.small, bold: false },
          ],
          gap: cur ? px(2) : 0,
        });
      });
      return [lines];
    }
    if (kind === 'alerts') {
      const list = alerts(s);
      const lines: PLine[] = [title(N.buttons.alerts)];
      if (!list.length) lines.push({ parts: [{ text: N.noAlerts, color: NOVA_CSS.good }] });
      for (const a of list) lines.push({ parts: [{ text: '⚠ ' + T.alert(a), color: a.kind === 'debt' ? NOVA_CSS.bad : NOVA_CSS.warn }], wrap: true, gap: px(4) });
      return [lines];
    }
    // Estatísticas.
    const st = N.stats;
    const per = N.perWeek;
    const kinds = Object.keys(BUILDINGS) as BuildingKind[];
    const silver: Section = [title(st.silver), row(st.taxes, `+${fmt(e.taxes)}${per}`, NOVA_CSS.good)];
    for (const k of kinds) if (e.production[k] !== undefined) silver.push(row(BUILDINGS[k].name, `+${fmt(e.production[k]!)}${per}`, NOVA_CSS.good));
    const costs = kinds.filter((k) => e.upkeep[k] !== undefined);
    if (costs.length) silver.push({ parts: [{ text: st.upkeep, color: NOVA_CSS.muted, bold: false }], gap: px(2) });
    for (const k of costs) silver.push(row('  ' + BUILDINGS[k].name, `−${fmt(e.upkeep[k]!)}${per}`, NOVA_CSS.bad));
    silver.push(row(st.balance, `${signed(e.silverDelta)}${per}`, tone(e.silverDelta)));

    const out = foodRunsOut(s.food, e.foodDelta, s.month);
    const food: Section = [
      title(st.food),
      row(st.made, `+${fmt(e.foodMade)}${per}`, NOVA_CSS.good),
      row(st.eaten, `−${fmt(e.foodEaten)}${per}`, NOVA_CSS.bad),
      row(st.balance, `${signed(e.foodDelta)}${per}`, tone(e.foodDelta)),
      row(st.runsOut, out ? `${st.weeks(out.months)} · ${N.foodUntil[out.season]}` : st.never, out ? NOVA_CSS.bad : NOVA_CSS.good),
    ];
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
    const out2: Section[] = [silver, food, work, houses];
    if (happinessOn(s))
      out2.push([
        title(st.happiness),
        row(st.happiness, String(e.happiness)),
        row(T.mood.happy, fmtInt(e.moods.happy), NOVA_CSS.good),
        row(T.mood.neutral, fmtInt(e.moods.neutral)),
        row(T.mood.sad, fmtInt(e.moods.sad), e.moods.sad ? NOVA_CSS.bad : NOVA_CSS.text),
        { parts: [{ text: st.why, color: NOVA_CSS.muted, bold: false, size: S.small }], wrap: true },
      ]);
    return out2;
  }

  /** Configurações: Interface, Girar a visão, Dia e noite, Efeito maquete. Returns the body size. */
  private settingsBody(root: Phaser.GameObjects.Container, pad: number): [number, number] {
    const N = T.nova.settings;
    const s = this.scene;
    const rowH = S.btn;
    const labelW = px(LABEL_W);
    const capW = px(118);
    const gap = px(8);
    let y = pad;
    const add = (o: Phaser.GameObjects.GameObject[]) => root.add(o);
    add([ntext(s, pad, y, T.options.title, S.num, NOVA_CSS.gold)]);
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
    };
    const x0 = pad + labelW;
    label(N.ui);
    capsule(x0, N.nova, uiMode() === 'nova', later(() => this.h.onUi('nova')));
    capsule(x0 + capW + gap, N.classic, uiMode() === 'classic', later(() => this.h.onUi('classic')));
    y += rowH + gap;
    label(N.turn);
    (['↺', '↻'] as const).forEach((arrow, k) => {
      const b = new RoundButton(s, x0 + rowH / 2 + k * (rowH + gap), y + rowH / 2, rowH, rowH, [ntext(s, 0, 0, arrow, S.num, NOVA_CSS.ink).setOrigin(0.5)], () => this.h.onTurn(k ? 1 : -1));
      add([b.root]);
    });
    y += rowH + gap;
    const toggle = (key: 'dayNight' | 'miniature', text: string) => {
      label(text);
      const slow = key === 'miniature' && this.slow;
      const on = settings[key] && !slow;
      const word = slow ? `${N.off} (${N.slow})` : on ? N.on : N.off;
      capsule(x0, word, on, later(() => {
        if (slow) return;
        settings[key] = !settings[key];
        saveSettings();
        this.h.onSettings();
      }), slow);
      y += rowH + gap;
    };
    toggle('dayNight', N.dayNight);
    toggle('miniature', N.miniature);
    return [labelW + 2 * capW + gap, y - gap - pad];
  }
}

/** Width (real px) of the labels column in the settings panel. */
const LABEL_W = 150;

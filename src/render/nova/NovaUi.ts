import Phaser from 'phaser';
import {
  isTree,
  BUILDINGS,
  dimsOf,
  foodAfter,
  foodLostIfRemoved,
  harvestsIn,
  weeksToHarvest,
  indexOf,
  type BuildingCategory,
  type Cell,
  type CityReadout,
  type GameState,
  type MilestoneId,
  type Placeable,
} from '../../core';
import { px, setNovaSpot } from '../layout';
import { NOVA_CSS } from '../palette';
import { originFor } from '../MapView';
import { T } from '../strings';
import { HEIGHT, TEX } from '../textures';
import { Toasts, type ToastOptions, type Tone } from '../Toasts';
import { COLUMN_ORDER, type Speed, type Tool } from '../tools';
import { TutorialView, type TutorialTarget } from '../Tutorial';
import type { UiHost } from '../../scenes/UIScene';
import { BuildColumn } from './BuildColumn';
import { Inspector } from './Inspector';
import { H, S, W } from './metrics';
import { notices, type Notice } from './notices';
import { Panels, type PanelArea } from './Panels';
import { Tools, type PanelKind } from './Tools';
import { TopBar } from './TopBar';
import { darkPanel, ntext } from './widgets';

/** Where a tool button is, for the tutorial arrow: center, size and the side the arrow comes from. */
export interface ButtonSpot {
  x: number;
  y: number;
  w: number;
  side: 'left' | 'right' | 'bottom';
}

/** Taps this close to a control count as on it (the gaps between buttons never reach the map). */
const SLOP = px(8);

/**
 * Interface Nova: thin dark bars over the map, everything touchable round. Top bar (level, stats,
 * goal, season, speed, gear), side buttons (Objetivos, Avisos, Estatísticas), bottom tools (Mover,
 * Rua, Demolir), the build column at the right, balloons for the chosen and the tapped building.
 */
export class NovaUi {
  private top: TopBar;
  private column: BuildColumn;
  private tools: Tools;
  private panels: Panels;
  private inspector: Inspector;
  private toasts: Toasts;
  private tutorial: TutorialView;
  /** Pill over the map cell under the pointer: "Cortar árvore · 5 prata", "Rende N comida/sem", "Colhe na primavera do ano N". */
  private tag: Phaser.GameObjects.Container;
  private tagText: Phaser.GameObjects.Text;
  private tagBg: Phaser.GameObjects.Graphics;
  private tagKey = '';
  private tagAt: { x: number; y: number; w: number; h: number; lift: number } | null = null;
  private hover: Cell | null = null;
  private state: GameState | null = null;
  private tool: Tool = 'view';
  private list: Notice[] = [];

  constructor(scene: Phaser.Scene, private host: UiHost) {
    this.column = new BuildColumn(scene, (kind) => host.selectTool(kind), () => this.top.rightBottom);
    this.top = new TopBar(scene, this.column.rect.x, {
      onGoals: () => this.togglePanel('goals'),
      onStats: () => this.togglePanel('stats'),
      onSpeed: (v) => host.setSpeed(v),
      onSettings: () => this.togglePanel('settings'),
    });
    this.tools = new Tools(scene, (p) => this.togglePanel(p), (t) => host.selectTool(t));
    this.panels = new Panels(scene, (k) => this.panelArea(k), {
      onTurn: (dir) => host.turnMap(dir),
      onSettings: () => host.applySettings(),
    });
    this.inspector = new Inspector(scene, {
      cellScreen: (x, y, w, h) => host.cellScreen(x, y, w, h),
      act: (a) => host.showSpots(a.kind, a.target),
      demolish: (c) => host.demolishAt(c),
      close: () => host.deselect(),
      limits: () => ({ top: this.top.bottom, toolsRight: this.tools.bottomRight + S.gap, toolsTop: this.tools.top }),
    });
    // Toasts and the tutorial bubble at the bottom, between the tools and the column.
    const left = this.tools.bottomRight + S.gap;
    const right = this.column.rect.x - S.gap;
    // Toasts above the bottom tools, so a long one never covers a button; centered, so they never reach the column.
    const half = Math.min(W / 2 - S.margin, right - W / 2);
    this.toasts = new Toasts(scene, this.tools.top - S.gap * 2, 2 * half);
    this.tutorial = new TutorialView(scene, () => host.skipTutorial(), () => host.tutorialOk(), {
      cx: (left + right) / 2,
      bottom: H - S.margin,
      maxW: right - left,
      scale: Math.max(1, px(44) / 44),
    });
    this.tagBg = scene.add.graphics();
    this.tagText = ntext(scene, 0, 0, '', S.small).setOrigin(0.5);
    this.tag = scene.add.container(0, 0, [this.tagBg, this.tagText]).setDepth(30).setVisible(false);

    // Where everything is, for the visual tests (window.layout.novaPoint).
    const spot = (b: { x: number; y: number; w: number } | null) => (b ? { x: b.x, y: b.y, d: b.w } : null);
    for (const t of ['view', 'road', 'clear'] as const) setNovaSpot(`tool-${t}`, () => spot(this.tools.buttonOf(t)));
    for (const k of COLUMN_ORDER) setNovaSpot(`build-${k}`, () => spot(this.column.buttonOf(k)));
    for (const k of ['goals', 'alerts', 'stats'] as const) setNovaSpot(`side-${k}`, () => {
      const p = this.tools.sideButton(k);
      return p ? { ...p, d: S.side } : null;
    });
    for (const n of ['level', 'gear', 'silver', 'food', 'goal', 'season', 'speed-0', 'speed-1', 'speed-3'] as const) setNovaSpot(n === 'level' || n === 'gear' || n.startsWith('speed') ? n : `pill-${n}`, () => this.top.spot(n));
    setNovaSpot('column', () => ({ x: this.column.rect.x + this.column.rect.w / 2, y: this.column.rect.y + this.column.rect.h / 2, d: this.column.rect.w }));

    // A tap on the map closes the panels and the balloons (the tapped building opens its own).
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.isOverUi(p.x, p.y)) return;
      this.panels.close();
      this.column.closeAll();
      this.tools.closeTip();
    });
  }

  private togglePanel(kind: PanelKind) {
    this.panels.toggle(kind);
    this.tools.refresh(this.tool, this.list, this.panels.open);
  }

  /** Side panels open right of the side buttons, settings under the gear; both end above the bottom tools. */
  private panelArea(kind: PanelKind): PanelArea {
    const right = this.column.rect.x - S.gap;
    const bottom = this.tools.top - S.gap;
    if (kind === 'settings') {
      const y = this.top.rightBottom + S.gap;
      return { x: S.margin, y, maxW: right - S.margin, maxH: bottom - y, alignRight: true };
    }
    const x = this.tools.sideRight + S.gap * 2;
    const y = this.tools.sideTop;
    return { x, y, maxW: right - x, maxH: bottom - y };
  }

  refresh(s: GameState, city: CityReadout, speed: Speed, tool: Tool, tutorial: boolean, selected: Cell | null) {
    this.state = s;
    this.tool = tool;
    this.top.refresh(s, city, speed);
    this.column.refresh(s, tool);
    this.list = notices(s, city);
    // During the tutorial the bubble already says why no family comes: no toast for it.
    // A warning toast waiting in line (or on screen) goes away once its problem is gone.
    for (const n of this.tools.newAlerts(this.list))
      if (n.toast && !(tutorial && n.family)) this.toasts.show(n.text, n.bad ? 'bad' : 'info', { valid: () => this.list.some((o) => o.key === n.key) });
    this.toasts.prune();
    this.tools.refresh(tool, this.list, this.panels.open);
    this.panels.refresh({ s, e: city.eco, forecast: city.forecast, notices: this.list });
    this.inspector.refresh(s, city, tool === 'view' ? selected : null);
    this.tagKey = '';
  }

  setTutorial(sentence: string | null, ok: boolean) {
    this.tutorial.set(sentence, ok);
  }

  pointTutorial(target: TutorialTarget | null) {
    this.tutorial.point(target);
  }

  /**
   * Center of the map left free by the interface: under the top bar, right of the side buttons, left
   * of the column, above the tutorial bubble and the toasts. The tutorial camera brings its place here.
   */
  freeCenter(): { x: number; y: number } {
    const top = this.top.bottom + S.gap;
    const bottom = Math.min(this.tutorial.top ?? this.tools.top, this.tools.top, this.toasts.top ?? H) - S.gap;
    const left = this.tools.sideRight + S.gap;
    const right = this.column.rect.x - S.gap;
    return { x: (left + right) / 2, y: (top + bottom) / 2 };
  }

  buttonOf(tool: Tool): ButtonSpot | null {
    return this.tools.buttonOf(tool) ?? this.column.buttonOf(tool);
  }

  anchor(name: 'silver' | 'goal'): TutorialTarget {
    return this.top.anchor(name);
  }

  private hit(x: number, y: number) {
    return (
      this.top.contains(x, y) ||
      this.column.contains(x, y) ||
      this.tools.contains(x, y) ||
      this.panels.contains(x, y) ||
      this.inspector.contains(x, y) ||
      this.tutorial.contains(x, y)
    );
  }

  /** On a control or within SLOP of one: a tap in the gap between two buttons never builds. */
  isOverUi(x: number, y: number) {
    return this.hit(x, y) || this.hit(x - SLOP, y) || this.hit(x + SLOP, y) || this.hit(x, y - SLOP) || this.hit(x, y + SLOP);
  }

  setSlow(slow: boolean) {
    this.panels.setSlow(slow);
  }

  setDrought(d: number) {
    this.top.setDrought(d);
  }

  toast(msg: string, tone: Tone, opt: ToastOptions = {}) {
    this.toasts.show(msg, tone, opt);
  }

  milestone(id: MilestoneId) {
    this.toasts.show(T.milestone[id], 'good');
  }

  openCategory(c: BuildingCategory) {
    this.panels.close();
    this.column.openCategory(c);
  }

  unlocked(kind: Placeable) {
    this.column.markNew(kind);
  }

  setHover(cell: Cell | null) {
    this.hover = cell;
    this.tagKey = '';
  }

  /** Esc: closes the open panel or category strip (a tool's own tip or balloon goes away with the tool). */
  closeTop() {
    return this.panels.close() || this.column.closeStrip();
  }

  update() {
    // An open panel or the tapped building's balloon holds the toasts (they would cover it).
    this.toasts.hold(!!this.panels.open || this.inspector.open);
    this.inspector.update();
    this.updateTag();
  }

  /** What the pill over the hovered cell says for the current tool, or null. */
  private tagFor(s: GameState, c: Cell): { text: string; bad?: boolean; x: number; y: number; w: number; h: number; lift: number } | null {
    const t = this.tool;
    if (t === 'clear') {
      const i = indexOf(s, c.x, c.y);
      if (i < 0) return null;
      const tree = !s.grid[i] && !s.roads[i] && isTree(s.feature[i]);
      if (tree) return { text: T.nova.cutTree, ...c, w: 1, h: 1, lift: px(40) };
      // A granary, or the road that links one: the food that would spoil.
      const b = s.grid[i];
      if (b ? !BUILDINGS[b.kind].storage : !s.roads[i]) return null;
      const lost = foodLostIfRemoved(s, c.x, c.y);
      if (lost <= 0) return null;
      const foot = b ? { x: b.x, y: b.y, w: b.w, h: b.h } : { ...c, w: 1, h: 1 };
      return { text: T.nova.foodLost(lost), bad: true, ...foot, lift: (b ? (HEIGHT[TEX.building(b.kind)] ?? 40) : 20) + px(14) };
    }
    if (t === 'view' || t === 'road') return null;
    const def = BUILDINGS[t];
    if (!def.gather && !def.harvest) return null;
    const o = originFor(t, c);
    const { w, h } = dimsOf(t);
    const lift = (HEIGHT[TEX.building(t)] ?? 40) + px(14);
    if (def.harvest && !harvestsIn(s.week)) return { text: T.nova.inspect.frozen(weeksToHarvest(s.week)), ...o, w, h, lift };
    // What it brings with the workers there are, and the city's food balance after it.
    const after = foodAfter(s, t, { ...o, rotated: false });
    return { text: `${T.nova.yields(after.yields)}\n${T.nova.foodAfter(after.delta)}`, bad: after.delta < 0, ...o, w, h, lift };
  }

  /** The hover pill follows the camera; its text is redone only when the cell, tool or city changes. */
  private updateTag() {
    const s = this.state;
    const c = this.hover;
    if (!s || !c) {
      this.tag.setVisible(false);
      return;
    }
    const key = `${this.tool}|${c.x},${c.y}`;
    if (key !== this.tagKey) {
      this.tagKey = key;
      const t = this.tagFor(s, c);
      this.tagAt = t;
      if (t) {
        this.tagText.setText(t.text).setColor(t.bad ? NOVA_CSS.bad : NOVA_CSS.text);
        const tw = this.tagText.width + px(16);
        const th = Math.max(S.labelH, this.tagText.height) + px(4);
        this.tagBg.clear();
        darkPanel(this.tagBg, -tw / 2, -th / 2, tw, th);
      }
    }
    const at = this.tagAt;
    this.tag.setVisible(!!at);
    if (at) {
      const p = this.host.cellScreen(at.x, at.y, at.w, at.h);
      this.tag.setPosition(p.x, p.y - at.lift * Math.max(0.6, p.zoom));
    }
  }
}

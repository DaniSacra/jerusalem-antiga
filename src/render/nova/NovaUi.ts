import Phaser from 'phaser';
import { alerts, indexOf, type Cell, type Economy, type GameState, type Placeable } from '../../core';
import type { Speed } from '../Hud';
import type { Segment } from '../info';
import { px, setNovaSpot } from '../layout';
import type { UiMode } from '../settings';
import { T } from '../strings';
import { Toasts, type Tone } from '../Toasts';
import type { Tool } from '../tools';
import { TutorialView, type TutorialTarget } from '../Tutorial';
import type { ButtonSpot, UiView } from '../uiView';
import type { UiHost } from '../../scenes/UIScene';
import { BuildColumn, COLUMN_ORDER } from './BuildColumn';
import { Inspector } from './Inspector';
import { H, S } from './metrics';
import { Panels, type PanelArea } from './Panels';
import { Tools, type PanelKind } from './Tools';
import { TopBar } from './TopBar';
import { darkPanel, ntext } from './widgets';

/**
 * Interface Nova: thin dark bars over the map, everything touchable round. Top bar (level, stats,
 * goal, season, speed, gear), side buttons (Objetivos, Avisos, Estatísticas), bottom tools (Mover,
 * Rua, Demolir), the build column at the right, balloons for the chosen and the tapped building.
 */
export class NovaUi implements UiView {
  private top: TopBar;
  private column: BuildColumn;
  private tools: Tools;
  private panels: Panels;
  private inspector: Inspector;
  private toasts: Toasts;
  private tutorial: TutorialView;
  private treeTag: Phaser.GameObjects.Container;
  private treeText: Phaser.GameObjects.Text;
  private treeBg: Phaser.GameObjects.Graphics;
  private hover: Cell | null = null;
  private state: GameState | null = null;
  private tool: Tool = 'view';
  private allowed: ReadonlySet<Tool> | null = null;

  constructor(scene: Phaser.Scene, private host: UiHost, onInterface: (mode: UiMode) => void) {
    this.column = new BuildColumn(scene, (kind) => host.selectTool(kind));
    this.top = new TopBar(scene, this.column.rect.x, {
      onGoals: () => this.togglePanel('goals'),
      onStats: () => this.togglePanel('stats'),
      onSpeed: (v) => host.setSpeed(v),
      onSettings: () => this.togglePanel('settings'),
    });
    this.tools = new Tools(scene, (p) => this.togglePanel(p), (t) => host.selectTool(t));
    this.panels = new Panels(scene, (k) => this.panelArea(k), {
      onUi: (mode) => onInterface(mode),
      onTurn: (dir) => host.turnMap(dir),
      onSettings: () => host.applySettings(),
    });
    this.inspector = new Inspector(scene, {
      cellScreen: (x, y, w, h) => host.cellScreen(x, y, w, h),
      act: (a) => host.showSpots(a.kind, a.target),
      demolish: (c) => host.demolishAt(c),
      close: () => host.deselect(),
    });
    // Toasts and the tutorial bubble at the bottom, between the tools and the column.
    const left = this.tools.bottomRight + S.gap;
    const right = this.column.rect.x - S.gap;
    // Toasts above the bottom tools, so a long one never covers a button.
    this.toasts = new Toasts(scene, H - S.margin - S.labelH - S.tool - 2 * S.gap - 20);
    this.tutorial = new TutorialView(scene, () => host.skipTutorial(), () => host.tutorialOk(), {
      cx: (left + right) / 2,
      bottom: H - S.margin,
      maxW: right - left,
      scale: Math.max(1, px(44) / 44),
    });
    this.treeBg = scene.add.graphics();
    this.treeText = ntext(scene, 0, 0, T.nova.cutTree, S.small).setOrigin(0.5);
    this.treeTag = scene.add.container(0, 0, [this.treeBg, this.treeText]).setDepth(30).setVisible(false);
    const tw = this.treeText.width + px(16);
    darkPanel(this.treeBg, -tw / 2, -S.labelH / 2 - px(2), tw, S.labelH + px(4));

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
    if (this.state) this.tools.refresh(this.tool, this.allowed, alerts(this.state), this.panels.open);
  }

  /** Side panels open right of the side buttons; settings under the gear. */
  private panelArea(kind: PanelKind): PanelArea {
    const right = this.column.rect.x - S.gap;
    if (kind === 'settings') {
      const y = S.margin + S.btn + S.gap;
      return { x: S.margin, y, maxW: right - S.margin, maxH: H - y - S.margin, alignRight: true };
    }
    const x = this.tools.sideRight + S.gap * 2;
    const y = this.tools.sideTop;
    return { x, y, maxW: right - x, maxH: H - y - S.margin };
  }

  refresh(s: GameState, eco: Economy, speed: Speed, tool: Tool, allowed: ReadonlySet<Tool> | null, selected: Cell | null) {
    this.state = s;
    this.tool = tool;
    this.allowed = allowed;
    this.top.refresh(s, eco, speed);
    this.column.refresh(s, tool, allowed);
    const list = alerts(s);
    for (const a of this.tools.newAlerts(list)) this.toasts.show(T.alert(a), a.kind === 'debt' ? 'bad' : 'info');
    this.tools.refresh(tool, allowed, list, this.panels.open);
    this.panels.refresh(s, eco);
    this.inspector.refresh(s, eco, tool === 'view' ? selected : null);
  }

  setInfo(_segments: Segment[]) {}

  hint(msg: string, bad: boolean) {
    this.toasts.show(msg, bad ? 'bad' : 'info');
  }

  setTutorial(sentence: string | null, ok: boolean) {
    this.tutorial.set(sentence, ok);
  }

  pointTutorial(target: TutorialTarget | null) {
    this.tutorial.point(target);
  }

  buttonOf(tool: Tool): ButtonSpot | null {
    return this.tools.buttonOf(tool) ?? this.column.buttonOf(tool);
  }

  anchor(name: 'silver' | 'goal'): TutorialTarget {
    return this.top.anchor(name);
  }

  isOverUi(x: number, y: number) {
    return (
      this.top.contains(x, y) ||
      this.column.contains(x, y) ||
      this.tools.contains(x, y) ||
      this.panels.contains(x, y) ||
      this.inspector.contains(x, y) ||
      this.tutorial.contains(x, y)
    );
  }

  setDayPhase(_icon: 'sun' | 'dusk' | 'moon', slow: boolean) {
    this.panels.setSlow(slow);
  }

  setDrought(d: number) {
    this.top.setDrought(d);
  }

  toast(msg: string, tone: Tone) {
    this.toasts.show(msg, tone);
  }

  unlocked(kind: Placeable) {
    this.column.markNew(kind);
  }

  setHover(cell: Cell | null) {
    this.hover = cell;
  }

  closeTop() {
    return this.panels.close() || this.column.closeAll() || this.tools.closeTip();
  }

  update() {
    this.inspector.update();
    // Demolir over a tree: "Cortar árvore · 5 prata" above it.
    const s = this.state;
    const c = this.hover;
    const i = s && c ? indexOf(s, c.x, c.y) : -1;
    const tree = !!s && i >= 0 && this.tool === 'clear' && !s.grid[i] && !s.roads[i] && !!s.feature[i] && s.feature[i] !== 'rock';
    this.treeTag.setVisible(tree);
    if (tree) {
      const p = this.host.cellScreen(c!.x, c!.y, 1, 1);
      this.treeTag.setPosition(p.x, p.y - px(40) * Math.max(0.6, p.zoom));
    }
  }
}

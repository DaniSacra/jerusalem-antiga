import Phaser from 'phaser';
import {
  advanceClock,
  build,
  clearCell,
  computeEconomy,
  createGame,
  createRng,
  stepMonth,
  type ActionResult,
  type Economy,
  type GameEvent,
  type GameState,
  type Rng,
} from '../core';
import { Effects } from '../render/Effects';
import { Hud, SPEEDS, type Speed } from '../render/Hud';
import { describeCell, hintSegments } from '../render/info';
import { CELL, DEPTH, GAME_H, GAME_W, cellBottom, cellCenterX, pointToCell } from '../render/layout';
import { MapView } from '../render/MapView';
import { C, CSS } from '../render/palette';
import { T, toolHint } from '../render/strings';
import { generateTextures } from '../render/textures';
import { Toasts } from '../render/Toasts';
import { Toolbar } from '../render/Toolbar';
import { DRAG_TOOLS, isBuildTool, TOOLS, type Tool } from '../render/tools';
import { button, panel, text } from '../render/ui';
import { Walkers } from '../render/Walkers';

type Cell = { x: number; y: number };

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private rng!: Rng;
  private eco!: Economy;
  private map!: MapView;
  private walkers!: Walkers;
  private fx!: Effects;
  private hud!: Hud;
  private toolbar!: Toolbar;
  private toasts!: Toasts;

  private tool: Tool = 'view';
  private speedIndex = 0;
  private clock = 0;
  private modal: Phaser.GameObjects.Container | null = null;
  private hover: Cell | null = null;
  private selected: Cell | null = null;
  private dragging = false;
  private lastDragCell = '';
  private dragToasted = false;

  constructor() {
    super('game');
  }

  private get speed(): Speed {
    return SPEEDS[this.speedIndex];
  }

  create() {
    generateTextures(this);
    this.rng = createRng((Math.random() * 2 ** 32) >>> 0);
    this.state = createGame(this.rng);
    this.tool = 'view';
    this.speedIndex = 0;
    this.clock = 0;
    this.modal = null;

    this.map = new MapView(this, this.state);
    this.walkers = new Walkers(this);
    this.fx = new Effects(this);
    this.hud = new Hud(this, () => this.cycleSpeed());
    this.toolbar = new Toolbar(this, (t) => this.selectTool(t));
    this.toasts = new Toasts(this);

    this.setupInput();
    this.selectTool('view');
    if (import.meta.env.DEV) Object.assign(window, { game: this, state: this.state });
  }

  update(_time: number, delta: number) {
    const speed = this.modal ? 0 : this.speed;
    const { acc, steps } = advanceClock(this.clock, delta / 1000, speed);
    this.clock = acc;
    for (let k = 0; k < steps; k++) this.handleEvents(stepMonth(this.state, this.rng));
    if (steps) this.refresh();
    this.map.update(this.time.now);
    this.walkers.update(delta, this.state, this.eco.residents);
  }

  // ---------- state -> view ----------

  private refresh() {
    this.eco = computeEconomy(this.state);
    this.map.sync(this.state);
    this.hud.refresh(this.state, this.eco, this.speed);
    this.toolbar.refresh(this.state, this.tool);
    this.map.showOverlay(this.state, this.tool, this.hover, this.selected);
    if (this.tool === 'view' && this.selected) this.toolbar.setInfo(describeCell(this.state, this.selected.x, this.selected.y));
  }

  private handleEvents(events: GameEvent[]) {
    for (const e of events) {
      switch (e.type) {
        case 'houseUp': {
          const { px, py } = this.center(e);
          this.map.bounce(e.x, e.y);
          this.fx.ring(px, py);
          this.fx.floatText(px, py - 24, `+${e.delta}`);
          break;
        }
        case 'houseDown': {
          const { px, py } = this.center(e);
          this.fx.floatText(px, py - 24, e.famine ? `Fome ${e.delta}` : `${e.delta}`, CSS.bad);
          break;
        }
        case 'famineStart':
          this.toasts.show(T.famine, 'bad');
          break;
        case 'goal':
          this.toasts.show(T.goalDone(e.reward, e.unlock), 'good');
          break;
        case 'victory':
          this.showVictory(e.month);
          break;
      }
    }
  }

  private center(c: Cell) {
    return { px: cellCenterX(c.x), py: cellBottom(c.y) - CELL / 2 };
  }

  // ---------- input ----------

  private setupInput() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.modal) return;
      const cell = pointToCell(p.x, p.y);
      if (!cell) return;
      this.hover = cell;
      this.dragging = true;
      this.dragToasted = false;
      this.lastDragCell = `${cell.x},${cell.y}`;
      this.applyTool(cell, true);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.modal) return;
      const cell = pointToCell(p.x, p.y);
      const key = cell ? `${cell.x},${cell.y}` : '';
      if (key !== (this.hover ? `${this.hover.x},${this.hover.y}` : '')) {
        this.hover = cell;
        this.map.showOverlay(this.state, this.tool, this.hover, this.selected);
      }
      if (cell && this.dragging && p.isDown && DRAG_TOOLS.has(this.tool) && key !== this.lastDragCell) {
        this.lastDragCell = key;
        this.applyTool(cell, false);
      }
    });
    const release = (p: Phaser.Input.Pointer) => {
      this.dragging = false;
      if (p.wasTouch) {
        this.hover = null;
        this.map.showOverlay(this.state, this.tool, this.hover, this.selected);
      }
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);

    const keys = this.input.keyboard;
    TOOLS.forEach((t, k) => keys?.on(`keydown-${k + 1}`, () => this.selectTool(t)));
    keys?.on('keydown-SPACE', () => this.cycleSpeed());
    keys?.on('keydown-ESC', () => this.selectTool('view'));
  }

  private selectTool(tool: Tool) {
    if (this.modal) return;
    if (isBuildTool(tool) && !this.state.unlocked.includes(tool)) {
      this.toolbar.setInfo(hintSegments(T.lockedHint(tool)));
      return;
    }
    this.tool = tool;
    this.selected = null;
    this.toolbar.setInfo(hintSegments(toolHint(tool)));
    this.refresh();
  }

  private cycleSpeed() {
    if (this.modal) return;
    this.speedIndex = (this.speedIndex + 1) % SPEEDS.length;
    this.refresh();
  }

  private applyTool(cell: Cell, first: boolean) {
    const { x, y } = cell;
    if (this.tool === 'view') {
      this.selected = cell;
      this.refresh();
      return;
    }
    const r: ActionResult = isBuildTool(this.tool) ? build(this.state, this.tool, x, y) : clearCell(this.state, x, y);
    const { px, py } = this.center(cell);
    if (r.ok) {
      if (this.tool === 'clear') this.fx.dust(px, py + 8);
      else this.fx.ring(px, py);
      this.refresh();
      return;
    }
    if (r.reason === 'silver' && !this.dragToasted) {
      this.dragToasted = true;
      this.toasts.show(T.noSilver, 'bad');
    } else if (r.reason === 'invalid' && first) {
      this.toasts.show(T.invalid, 'bad');
    }
  }

  // ---------- victory ----------

  private showVictory(months: number) {
    const w = 560;
    const h = 260;
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, C.shadow, 0.5).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    panel(g, (GAME_W - w) / 2, (GAME_H - h) / 2, w, h, C.parchment, 18);
    const title = text(this, GAME_W / 2, GAME_H / 2 - 80, T.victoryTitle, 44, CSS.ink, true).setOrigin(0.5);
    const msg = text(this, GAME_W / 2, GAME_H / 2 - 20, T.victoryText(months), 22, CSS.ink).setOrigin(0.5);
    const btn = button(this, GAME_W / 2, GAME_H / 2 + 65, 320, 58, T.keepBuilding, 22, () => {
      this.modal?.destroy();
      this.modal = null;
    });
    this.modal = this.add.container(0, 0, [dim, g, title, msg, btn.container]).setDepth(DEPTH.modal);
  }
}

import Phaser from 'phaser';
import type { Economy, GameState } from '../core';
import { Hud, type Speed } from '../render/Hud';
import type { Segment } from '../render/info';
import { GAME_H, GAME_W, INFO_Y, TOP_H, TURN } from '../render/layout';
import { C, CSS } from '../render/palette';
import { T } from '../render/strings';
import { Toasts, type Tone } from '../render/Toasts';
import { Toolbar } from '../render/Toolbar';
import type { Tool } from '../render/tools';
import { button, panel, text } from '../render/ui';

export interface UiHost {
  selectTool(tool: Tool): void;
  cycleSpeed(): void;
  turnMap(dir: 1 | -1): void;
  showSilver(): void;
  restart(): void;
  attachUi(ui: UIScene): void;
}

/** Fixed overlay (not affected by the camera): top bar, info line, tool bar, toasts and dialogs. */
export class UIScene extends Phaser.Scene {
  private hud!: Hud;
  private toolbar!: Toolbar;
  private toasts!: Toasts;
  private famineTint!: Phaser.GameObjects.Rectangle;
  private famine = false;
  private modal: Phaser.GameObjects.Container | null = null;
  private host!: UiHost;

  constructor() {
    super('ui');
  }

  get modalOpen() {
    return this.modal !== null;
  }

  create(data: { host: UiHost }) {
    const host = data.host;
    this.famine = false;
    this.modal = null;
    this.famineTint = this.add.rectangle(0, TOP_H, GAME_W, INFO_Y - TOP_H, C.famine, 1).setOrigin(0).setAlpha(0);
    this.hud = new Hud(this, () => host.cycleSpeed(), () => host.showSilver());
    this.host = host;
    const half = TURN.size / 2;
    button(this, TURN.x + half, TURN.y + half, TURN.size, TURN.size, '↺', 40, () => host.turnMap(-1));
    button(this, TURN.x + TURN.size + TURN.gap + half, TURN.y + half, TURN.size, TURN.size, '↻', 40, () => host.turnMap(1));
    this.toolbar = new Toolbar(this, (t) => host.selectTool(t));
    this.toasts = new Toasts(this);
    host.attachUi(this);
  }

  refresh(state: GameState, eco: Economy, speed: Speed, tool: Tool) {
    this.hud.refresh(state, eco, speed);
    this.toolbar.refresh(state, tool);
    this.setFamine(state.famine);
  }

  setInfo(segments: Segment[]) {
    this.toolbar.setInfo(segments);
  }

  toast(msg: string, tone: Tone = 'info') {
    this.toasts.show(msg, tone);
  }

  private setFamine(on: boolean) {
    if (on === this.famine) return;
    this.famine = on;
    this.tweens.add({ targets: this.famineTint, alpha: on ? 0.22 : 0, duration: 600 });
  }

  showVictory(months: number, residents: number) {
    this.dialog(T.victoryTitle, T.victoryText(months, residents), T.keepBuilding, () => {
      this.modal?.destroy();
      this.modal = null;
    });
  }

  /** The game stays paused behind it; "Tentar de novo" starts a new map. */
  showDefeat(months: number, peak: number) {
    this.dialog(T.defeatTitle, T.defeatText(months, peak), T.retry, () => this.host.restart());
  }

  /** Modal panel (pauses the game) with a title, a message and one button. */
  private dialog(title: string, message: string, label: string, onClick: () => void) {
    const w = 680;
    const h = 300;
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, C.shadow, 0.5).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    panel(g, (GAME_W - w) / 2, (GAME_H - h) / 2, w, h, C.parchment, 18);
    const head = text(this, GAME_W / 2, GAME_H / 2 - 100, title, 44, CSS.ink, true).setOrigin(0.5);
    const msg = text(this, GAME_W / 2, GAME_H / 2 - 22, message, 22, CSS.ink).setOrigin(0.5).setAlign('center').setWordWrapWidth(w - 80);
    const btn = button(this, GAME_W / 2, GAME_H / 2 + 80, 380, 84, label, 28, onClick);
    this.modal = this.add.container(0, 0, [dim, g, head, msg, btn.container]).setDepth(100);
  }
}

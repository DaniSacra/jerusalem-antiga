import Phaser from 'phaser';
import type { Economy, GameState } from '../core';
import { Hud, type Speed } from '../render/Hud';
import type { Segment } from '../render/info';
import { GAME_H, GAME_W, INFO_Y, TOP_H } from '../render/layout';
import { C, CSS } from '../render/palette';
import { T } from '../render/strings';
import { Toasts, type Tone } from '../render/Toasts';
import { Toolbar } from '../render/Toolbar';
import type { Tool } from '../render/tools';
import { button, panel, text } from '../render/ui';

export interface UiHost {
  selectTool(tool: Tool): void;
  cycleSpeed(): void;
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
    this.hud = new Hud(this, () => host.cycleSpeed());
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
    const w = 640;
    const h = 260;
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, C.shadow, 0.5).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    panel(g, (GAME_W - w) / 2, (GAME_H - h) / 2, w, h, C.parchment, 18);
    const title = text(this, GAME_W / 2, GAME_H / 2 - 80, T.victoryTitle, 44, CSS.ink, true).setOrigin(0.5);
    const msg = text(this, GAME_W / 2, GAME_H / 2 - 20, T.victoryText(months, residents), 21, CSS.ink).setOrigin(0.5);
    const btn = button(this, GAME_W / 2, GAME_H / 2 + 65, 320, 58, T.keepBuilding, 22, () => {
      this.modal?.destroy();
      this.modal = null;
    });
    this.modal = this.add.container(0, 0, [dim, g, title, msg, btn.container]).setDepth(100);
  }
}

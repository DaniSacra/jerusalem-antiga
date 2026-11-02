import Phaser from 'phaser';
import type { Economy, GameState } from '../core';
import { Hud, type Speed } from '../render/Hud';
import type { Segment } from '../render/info';
import { InfoLine } from '../render/InfoLine';
import { Options } from '../render/Options';
import { GAME_H, GAME_W } from '../render/layout';
import { C, CSS } from '../render/palette';
import { T } from '../render/strings';
import { Toasts, type Tone } from '../render/Toasts';
import { Toolbar } from '../render/Toolbar';
import type { Tool } from '../render/tools';
import { button, panel, text } from '../render/ui';

export interface UiHost {
  selectTool(tool: Tool): void;
  setSpeed(v: Speed): void;
  turnMap(dir: 1 | -1): void;
  showBreakdown(mode: 'silver' | 'happiness'): void;
  showGoal(): void;
  applySettings(): void;
  restart(): void;
  attachUi(ui: UIScene): void;
}

/** Fixed overlay (not affected by the camera): plaque, banners, rails, info line, toasts and dialogs. */
export class UIScene extends Phaser.Scene {
  private hud!: Hud;
  private toolbar!: Toolbar;
  private info!: InfoLine;
  private toasts!: Toasts;
  private options!: Options;
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
    this.famineTint = this.add.rectangle(0, 0, GAME_W, GAME_H, C.famine, 1).setOrigin(0).setAlpha(0);
    this.host = host;
    this.hud = new Hud(this, { onSpeed: (v) => host.setSpeed(v), onSilver: () => host.showBreakdown('silver'), onHappiness: () => host.showBreakdown('happiness'), onGoal: () => host.showGoal() });
    this.toolbar = new Toolbar(this, (t) => host.selectTool(t), (dir) => host.turnMap(dir));
    this.info = new InfoLine(this);
    this.toasts = new Toasts(this);
    this.options = new Options(this, () => host.applySettings());
    host.attachUi(this);
  }

  refresh(state: GameState, eco: Economy, speed: Speed, tool: Tool) {
    this.hud.refresh(state, eco, speed);
    this.toolbar.refresh(state, tool);
    this.setFamine(state.famine);
  }

  /** Empty segments hide the info line. */
  setInfo(segments: Segment[]) {
    this.info.set(segments);
  }

  /** True if a screen point is over the plaque, the banners, the rails, the speed or the info line. */
  isOverUi(x: number, y: number) {
    return this.hud.contains(x, y) || this.toolbar.contains(x, y) || this.info.contains(x, y) || this.options.contains(x, y);
  }

  /** Sun, dusk or moon next to the month; `slow` greys out the miniature option. */
  setDayPhase(icon: 'sun' | 'dusk' | 'moon', slow: boolean) {
    this.hud.setPhase(icon);
    this.options.setSlow(slow);
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

import Phaser from 'phaser';
import type { BuildableKind, BuildingCategory, Building, Cell, CityReadout, GameState, MilestoneId, Placeable } from '../core';
import { GAME_H, GAME_W } from '../render/layout';
import { NovaUi, type ButtonSpot } from '../render/nova/NovaUi';
import { C, CSS } from '../render/palette';
import { T } from '../render/strings';
import type { ToastOptions, Tone } from '../render/Toasts';
import type { Speed, Tool } from '../render/tools';
import type { TutorialTarget } from '../render/Tutorial';
import { button, panel, text } from '../render/ui';

export interface UiHost {
  selectTool(tool: Tool): void;
  setSpeed(v: Speed): void;
  turnMap(dir: 1 | -1): void;
  applySettings(): void;
  restart(): void;
  skipTutorial(): void;
  tutorialOk(): void;
  attachUi(ui: UIScene): void;
  /** Screen point (UI coordinates) of the center of a grid footprint, and the camera zoom. */
  cellScreen(x: number, y: number, w: number, h: number): { x: number; y: number; zoom: number };
  /** Picks a building and highlights the free places whose reach covers `target` (Rua: just picks it). */
  showSpots(kind: BuildableKind | 'road', target: Building): void;
  /** Demolishes what is on a cell (the Demolir button of the tapped building's balloon). */
  demolishAt(cell: Cell): void;
  /** Raises the building on a cell one level (Melhorar in its balloon). */
  upgradeAt(cell: Cell): void;
  /** Closes the tapped building's balloon. */
  deselect(): void;
}

/**
 * Fixed overlay (not affected by the camera): the interface (Nova), the famine tint and the
 * victory/defeat dialogs.
 */
export class UIScene extends Phaser.Scene {
  private view!: NovaUi;
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
    this.view = new NovaUi(this, host);
    host.attachUi(this);
  }

  update() {
    this.view.update();
  }

  /** `tutorial`: the first-game steps are running; `selected`: the cell tapped with Mover. */
  refresh(state: GameState, city: CityReadout, speed: Speed, tool: Tool, tutorial = false, selected: Cell | null = null) {
    this.view.refresh(state, city, speed, tool, tutorial, selected);
    this.setFamine(state.famine);
  }

  /** The tutorial sentence (null hides it); `ok` adds the "Entendi" button. */
  setTutorial(sentence: string | null, ok = false) {
    this.view.setTutorial(sentence, ok);
  }

  pointTutorial(target: TutorialTarget | null) {
    this.view.pointTutorial(target);
  }

  /** Center of the map area the interface leaves free (the tutorial camera brings its place there). */
  freeCenter(): { x: number; y: number } {
    return this.view.freeCenter();
  }

  /** Screen center of a tool's button and the side the tutorial arrow comes from. */
  buttonOf(tool: Tool): ButtonSpot | null {
    return this.view.buttonOf(tool);
  }

  /** Tutorial arrow at the silver or the goal of the top bar. */
  anchor(name: 'silver' | 'goal'): TutorialTarget {
    return this.view.anchor(name);
  }

  /** A short message (toast). */
  hint(msg: string, bad = false) {
    this.view.toast(msg, bad ? 'bad' : 'info');
  }

  /** True if a screen point is over any part of the interface (the map ignores it). */
  isOverUi(x: number, y: number) {
    return this.view.isOverUi(x, y);
  }

  /** `slow`: the device is slow (the miniature option shows it is off). */
  setSlow(slow: boolean) {
    this.view.setSlow(slow);
  }

  /** The drought mark (looks only), from the season look's drought (0..1). */
  setDrought(d: number) {
    this.view.setDrought(d);
  }

  toast(msg: string, tone: Tone = 'info', opt: ToastOptions = {}) {
    this.view.toast(msg, tone, opt);
  }

  /** A milestone was reached this week: its sentence (the statistics read the week from the state). */
  milestone(id: MilestoneId) {
    this.view.milestone(id);
  }

  /** PC keys 3–6: shows the strip of a category of the build column. */
  openCategory(c: BuildingCategory) {
    this.view.openCategory(c);
  }

  /** A goal unlocked this building. */
  unlocked(kind: Placeable) {
    this.view.unlocked(kind);
  }

  /** The map cell under the pointer. */
  setHover(cell: Cell | null) {
    this.view.setHover(cell);
  }

  /** Esc: closes the open panel or balloon; false if nothing was open. */
  closeTop() {
    return this.view.closeTop();
  }

  private setFamine(on: boolean) {
    if (on === this.famine) return;
    this.famine = on;
    this.tweens.add({ targets: this.famineTint, alpha: on ? 0.22 : 0, duration: 600 });
  }

  showVictory(weeks: number, residents: number) {
    this.dialog(T.victoryTitle, T.victoryText(weeks, residents), T.keepBuilding, () => {
      this.modal?.destroy();
      this.modal = null;
    });
  }

  /** The game stays paused behind it; "Tentar de novo" starts a new map. */
  showDefeat(weeks: number, peak: number) {
    this.dialog(T.defeatTitle, T.defeatText(weeks, peak), T.retry, () => this.host.restart());
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

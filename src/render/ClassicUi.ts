import Phaser from 'phaser';
import type { Cell, Economy, GameState, Placeable } from '../core';
import { Hud, type Speed } from './Hud';
import { hintSegments, type Segment } from './info';
import { InfoLine } from './InfoLine';
import { GAME_W, GOAL_H, GOAL_Y, PLAQUE, plaqueSlot } from './layout';
import { Options } from './Options';
import { CSS } from './palette';
import { Toasts, type Tone } from './Toasts';
import { Toolbar } from './Toolbar';
import type { Tool } from './tools';
import { TutorialView, type TutorialTarget } from './Tutorial';
import type { UiHost } from '../scenes/UIScene';
import type { ButtonSpot, UiView } from './uiView';

/** Interface Clássica: plaque, banners, the two stone rails, the info line and the options. */
export class ClassicUi implements UiView {
  private hud: Hud;
  private toolbar: Toolbar;
  private info: InfoLine;
  private toasts: Toasts;
  private options: Options;
  private tutorial: TutorialView;

  constructor(scene: Phaser.Scene, host: UiHost, onInterface: () => void) {
    this.hud = new Hud(scene, { onSpeed: (v) => host.setSpeed(v), onSilver: () => host.showBreakdown('silver'), onHappiness: () => host.showBreakdown('happiness'), onGoal: () => host.showGoal() });
    this.toolbar = new Toolbar(scene, (t) => host.selectTool(t), (dir) => host.turnMap(dir));
    this.info = new InfoLine(scene);
    this.toasts = new Toasts(scene);
    this.options = new Options(scene, () => host.applySettings(), onInterface);
    this.tutorial = new TutorialView(scene, () => host.skipTutorial(), () => host.tutorialOk());
  }

  refresh(state: GameState, eco: Economy, speed: Speed, tool: Tool, allowed: ReadonlySet<Tool> | null) {
    this.hud.refresh(state, eco, speed);
    this.toolbar.refresh(state, tool, allowed);
  }

  setInfo(segments: Segment[]) {
    this.info.set(segments);
  }

  hint(msg: string, bad: boolean) {
    this.info.set(bad ? [{ text: msg, color: CSS.badLight }] : hintSegments(msg));
  }

  setTutorial(sentence: string | null, ok: boolean) {
    this.tutorial.set(sentence, ok);
  }

  pointTutorial(target: TutorialTarget | null) {
    this.tutorial.point(target);
  }

  buttonOf(tool: Tool): ButtonSpot | null {
    return this.toolbar.buttonOf(tool);
  }

  anchor(name: 'silver' | 'goal'): TutorialTarget {
    if (name === 'goal') return { x: GAME_W / 2, y: GOAL_Y + GOAL_H + 2, dir: 'up' };
    return { x: plaqueSlot(1).x + 24, y: PLAQUE.h + 2, dir: 'up' };
  }

  isOverUi(x: number, y: number) {
    return this.hud.contains(x, y) || this.toolbar.contains(x, y) || this.info.contains(x, y) || this.options.contains(x, y) || this.tutorial.contains(x, y);
  }

  setDayPhase(icon: 'sun' | 'dusk' | 'moon', slow: boolean) {
    this.hud.setPhase(icon);
    this.options.setSlow(slow);
  }

  setDrought(d: number) {
    this.hud.setDrought(d);
  }

  toast(msg: string, tone: Tone) {
    this.toasts.show(msg, tone);
  }

  unlocked(_kind: Placeable) {}

  setHover(_cell: Cell | null) {}

  closeTop() {
    return false;
  }

  update() {}
}

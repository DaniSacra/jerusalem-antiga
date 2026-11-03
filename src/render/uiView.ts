import type { Cell, Economy, GameState, Placeable } from '../core';
import type { Speed } from './Hud';
import type { Segment } from './info';
import type { Tone } from './Toasts';
import type { Tool } from './tools';
import type { TutorialTarget } from './Tutorial';

/** Where a tool button is, for the tutorial arrow: center, size and the side the arrow comes from. */
export interface ButtonSpot {
  x: number;
  y: number;
  w: number;
  side: 'left' | 'right' | 'bottom';
}

/** One of the two interfaces (Nova or Clássica) over the same game; the UIScene holds one. */
export interface UiView {
  /** `allowed`: tools the tutorial leaves on (null: all); `selected`: the cell tapped with Mover. */
  refresh(state: GameState, eco: Economy, speed: Speed, tool: Tool, allowed: ReadonlySet<Tool> | null, selected: Cell | null): void;
  /** The classic info line (the Nova shows the same things in balloons and panels). */
  setInfo(segments: Segment[]): void;
  /** A short message: the info line in the Clássica, a toast in the Nova. */
  hint(msg: string, bad: boolean): void;
  setTutorial(sentence: string | null, ok: boolean): void;
  pointTutorial(target: TutorialTarget | null): void;
  buttonOf(tool: Tool): ButtonSpot | null;
  /** Arrow target of the tutorial steps that point at the top bar. */
  anchor(name: 'silver' | 'goal'): TutorialTarget;
  isOverUi(x: number, y: number): boolean;
  setDayPhase(icon: 'sun' | 'dusk' | 'moon', slow: boolean): void;
  setDrought(d: number): void;
  toast(msg: string, tone: Tone): void;
  /** A goal just unlocked this building (the Nova marks it "novo"). */
  unlocked(kind: Placeable): void;
  /** The map cell under the pointer (the Nova labels trees under Demolir). */
  setHover(cell: Cell | null): void;
  /** Esc: closes the open panel or balloon; false if nothing was open. */
  closeTop(): boolean;
  /** Every frame (balloons that follow the camera). */
  update(): void;
}

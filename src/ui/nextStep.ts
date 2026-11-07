import type { NextStep } from '../game/model/nextStep';
import type { Tool } from '../game/tools';
import type { Anchors } from './anchors';
import { h, keyed, onTap, setText } from './dom';
import { iconEl } from './parts';
import { Pointer, type ButtonArrow } from './tutorial';

/** How long the arrow stays after a tap on the line (ms), unless the step changes or its tool is picked. */
const ARROW_MS = 8000;

/**
 * "O que fazer agora": one fixed line under the top bar (an icon and a short sentence, `nextStep`);
 * hidden while the tutorial speaks. A tap opens where to act (the host) and shows the tutorial's arrow there.
 */
export class NextStepLine {
  readonly el = h('div.nextstep.panel.hit.hidden', { 'data-spot': 'next-step', role: 'button' });
  private icon = h('span.ico');
  private text = h('span.txt');
  private pointer: Pointer;
  private step: NextStep | null = null;
  /** The step the arrow was asked for (its text), and the time left for it. */
  private armed: string | null = null;
  private left = 0;

  constructor(anchors: Anchors, buttonArrow: ButtonArrow, private tool: () => Tool, act: (step: NextStep) => void) {
    this.pointer = new Pointer(anchors, buttonArrow);
    this.el.append(this.icon, this.text);
    onTap(this.el, () => {
      if (!this.step) return;
      act(this.step);
      this.armed = this.step.text;
      this.left = ARROW_MS;
      this.pointer.remeasure();
    });
  }

  get arrow() {
    return this.pointer.el;
  }

  get shown() {
    return this.visible;
  }

  private visible = false;

  /**
   * After each refresh: the step now (null: none, the tutorial speaks), and whether the line shows (a
   * panel opened from it hides it; its arrow stays).
   */
  update(step: NextStep | null, visible = true) {
    this.step = step;
    this.visible = !!step && visible;
    this.el.classList.toggle('hidden', !this.visible);
    if (!step) return;
    this.el.className = `nextstep panel hit t-${step.tone}${this.visible ? '' : ' hidden'}`;
    this.el.dataset.kind = step.kind;
    keyed(this.icon, step.icon, () => [iconEl(step.icon)]);
    setText(this.text, step.text);
    this.el.title = step.text;
    // Buttons may have moved (a refresh): measured again for the arrow.
    this.pointer.remeasure();
  }

  /** Per frame: the arrow while it is asked for and its step lasts. */
  frame(dtMs: number) {
    const s = this.step;
    if (this.armed && (!s || s.text !== this.armed || (this.left -= dtMs) <= 0)) this.armed = null;
    const aim = this.armed ? s!.aim : null;
    // Its tool picked: the arrow did its job.
    if (aim && 'tool' in aim && this.tool() === aim.tool) this.armed = null;
    this.pointer.point(!this.armed || !aim ? null : 'tool' in aim ? aim : { rect: aim.rect, lift: 0 });
  }
}

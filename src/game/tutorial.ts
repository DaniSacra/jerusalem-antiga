import { markTutorial, TUTORIAL_EXTRAS, TUTORIAL_STEPS, tutorialHoldsClock, tutorialStepDone, type GameState, type TutorialMark, type TutorialStep } from '../core';

/** The first-game tutorial's progress (pure; the views draw its bubble and arrow). */

/**
 * Where the tutorial is: the six main steps (the clock stands still on the build steps), then waiting for
 * the market to unlock, then its short step, then off.
 */
type Phase = 'steps' | 'wait' | 'extras' | 'off';

/** Tutorial progress of one game; the conditions are the pure ones of `core/tutorial`. */
export class TutorialGuide {
  private phase: Phase = 'steps';
  private k = 0;
  private mark: TutorialMark;
  /** The market unlocked while the main steps were still running: its step follows them. */
  private extrasPending = false;

  /** `seen` remembers that the player finished or skipped it (the app stores it). */
  constructor(s: GameState, private seen: () => void = () => {}) {
    this.mark = markTutorial(s);
  }

  get step(): TutorialStep | null {
    if (this.phase === 'steps') return TUTORIAL_STEPS[this.k];
    if (this.phase === 'extras') return TUTORIAL_EXTRAS[this.k];
    return null;
  }

  /** The main steps are running (the bubble speaks for the city: no family toasts). */
  get running(): boolean {
    return this.phase === 'steps';
  }

  /** The clock stands still on a main build step. */
  get holdsClock(): boolean {
    return this.phase === 'steps' && tutorialHoldsClock(this.step);
  }

  /** Skips finished steps. Returns 'done' when the main steps just ended, 'next' on any other change. */
  update(s: GameState): 'next' | 'done' | null {
    let out: 'next' | 'done' | null = null;
    while (this.step && tutorialStepDone(s, this.step, this.mark)) out = this.advance(s) === 'done' ? 'done' : (out ?? 'next');
    return out;
  }

  /** The market was unlocked: its short step follows the main steps (or starts now). */
  marketUnlocked() {
    if (this.phase === 'steps') this.extrasPending = true;
    else if (this.phase === 'wait') this.start('extras');
  }

  /** Ends the tutorial for good. */
  skip() {
    this.seen();
    this.phase = 'off';
  }

  private start(phase: Phase) {
    this.phase = phase;
    this.k = 0;
  }

  private advance(s: GameState): 'next' | 'done' {
    this.k++;
    this.mark = markTutorial(s);
    if (this.phase === 'steps' && this.k >= TUTORIAL_STEPS.length) {
      this.seen();
      this.start(this.extrasPending ? 'extras' : 'wait');
      return 'done';
    }
    if (this.phase === 'extras' && this.k >= TUTORIAL_EXTRAS.length) this.phase = 'off';
    return 'next';
  }
}

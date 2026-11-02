import Phaser from 'phaser';
import { alerts, currentGoal, goalProgress, type Alert, type Economy, type GameState } from '../core';
import { GAME_W, TOP_H } from './layout';
import { C, CSS } from './palette';
import { signed, T } from './strings';
import { TEX } from './textures';
import { button, text } from './ui';

/** Debt, negative balance and unemployment can all show at once. */
const ALERT_KINDS = 3;

export const SPEEDS = [1, 3, 0] as const;
export type Speed = (typeof SPEEDS)[number];

interface Stat {
  value: Phaser.GameObjects.Text;
  sub: Phaser.GameObjects.Text;
}

/** Top bar: resources, workforce, month, goal and speed toggle. */
export class Hud {
  private stats: Record<'silver' | 'food' | 'residents' | 'work' | 'month', Stat>;
  private goal: Phaser.GameObjects.Text;
  private speedLabel: Phaser.GameObjects.Text;
  /** Blinking values (food during famine, silver in debt). */
  private blinks = new Map<Phaser.GameObjects.Text, Phaser.Tweens.Tween>();
  /** Standing warnings stacked under the bar, at the left (debt, negative balance, unemployment). */
  private chips: Phaser.GameObjects.Text[] = [];

  constructor(private scene: Phaser.Scene, onSpeed: () => void, onSilver: () => void) {
    const g = scene.add.graphics();
    g.fillStyle(C.shadow, 0.25);
    g.fillRect(0, TOP_H, GAME_W, 3);
    g.fillStyle(C.parchment);
    g.fillRect(0, 0, GAME_W, TOP_H);
    g.lineStyle(2, C.border, 1);
    g.lineBetween(0, TOP_H, GAME_W, TOP_H);

    this.stats = {
      silver: this.stat(14, 'silver', T.silver),
      food: this.stat(184, 'food', T.food),
      residents: this.stat(350, 'people', T.residents),
      work: this.stat(464, 'work', T.work),
      month: this.stat(684, 'month', T.month),
    };
    scene.add.image(784, TOP_H / 2, TEX.icon('goal')).setScale(0.7);
    text(scene, 802, 5, T.goal, 14, CSS.muted, true);
    this.goal = text(scene, 802, 22, '', 18, CSS.ink, true);
    this.speedLabel = button(scene, GAME_W - 72, TOP_H / 2, 132, TOP_H - 6, T.speed(1), 20, onSpeed).label;
    // Tapping the silver shows where it comes from and where it goes.
    scene.add.zone(0, 0, 176, TOP_H).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', onSilver);
    for (let k = 0; k < ALERT_KINDS; k++) {
      this.chips.push(text(scene, 14, TOP_H + 10 + k * 46, '', 18, CSS.light, true).setPadding(12, 7, 12, 7).setVisible(false));
    }
  }

  private stat(x: number, icon: Parameters<typeof TEX.icon>[0], label: string): Stat {
    const s = this.scene;
    s.add.image(x + 16, TOP_H / 2, TEX.icon(icon)).setScale(0.75);
    text(s, x + 38, 5, label, 14, CSS.muted, true);
    return { value: text(s, x + 38, 22, '', 22, CSS.ink, true), sub: text(s, x + 38, 27, '', 15, CSS.muted, true) };
  }

  /** Colors a stat value; `blink` makes it pulse (famine, debt). */
  private tone(value: Phaser.GameObjects.Text, color: string, blink: boolean) {
    if (value.style.color !== color) value.setColor(color);
    const tween = this.blinks.get(value);
    if (blink === !!tween) return;
    if (blink) {
      this.blinks.set(value, this.scene.tweens.add({ targets: value, alpha: 0.25, duration: 380, yoyo: true, repeat: -1 }));
    } else {
      tween!.remove();
      this.blinks.delete(value);
      value.setAlpha(1);
    }
  }

  private showAlerts(list: Alert[]) {
    this.chips.forEach((chip, k) => {
      const a = list[k];
      chip.setVisible(!!a);
      if (!a) return;
      chip.setText(T.alert(a)).setBackgroundColor(a.kind === 'debt' ? CSS.bad : CSS.warn);
    });
  }

  /** Long goals shrink the font so they never run into the speed button. */
  private fitGoal(str: string) {
    const max = GAME_W - 150 - this.goal.x;
    let size = 18;
    this.goal.setText(str).setFontSize(size);
    while (this.goal.width > max && size > 12) this.goal.setFontSize(--size);
  }

  private set(stat: Stat, value: string, sub = '', subColor: string = CSS.muted) {
    stat.value.setText(value);
    stat.sub.setText(sub).setX(stat.value.x + stat.value.width + 6);
    if (stat.sub.style.color !== subColor) stat.sub.setColor(subColor);
  }

  refresh(state: GameState, eco: Economy, speed: Speed) {
    const { silver, food, residents, work, month } = this.stats;
    this.set(silver, String(Math.floor(state.silver)), signed(eco.silverDelta) + T.perMonth, eco.silverDelta < 0 ? CSS.bad : CSS.good);
    const debt = state.silver < 0;
    this.tone(silver.value, debt ? CSS.bad : eco.silverDelta < 0 ? CSS.warn : CSS.ink, debt);
    this.set(food, String(Math.floor(state.food)), signed(eco.foodDelta) + T.perMonth, eco.foodDelta < 0 ? CSS.bad : CSS.good);
    this.tone(food.value, state.famine ? CSS.bad : CSS.ink, state.famine);
    this.set(residents, String(eco.residents));
    const eff = Math.round(eco.efficiency * 100);
    if (eco.workers === 0 && eco.jobs === 0) this.set(work, T.noJobs);
    else if (eco.workers > eco.jobs) this.set(work, `${eco.workers}/${eco.jobs}`, T.idle(eco.workers - eco.jobs), CSS.warn);
    else this.set(work, `${eco.workers}/${eco.jobs}`, `${eff}%`, eff < 100 ? CSS.bad : CSS.good);
    this.set(month, String(state.month + 1));
    const goal = currentGoal(state);
    const goalText = goal ? `${state.goalIndex + 1}. ${goal.text} (${Math.min(goalProgress(state, goal), goal.target)}/${goal.target})` : T.allGoals;
    if (goalText !== this.goal.text) this.fitGoal(goalText);
    this.speedLabel.setText(T.speed(speed));
    this.showAlerts(alerts(state));
  }
}

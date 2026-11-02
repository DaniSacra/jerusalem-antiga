import Phaser from 'phaser';
import { currentGoal, goalProgress, type Economy, type GameState } from '../core';
import { DEPTH, GAME_W, TOP_H } from './layout';
import { C, CSS } from './palette';
import { signed, T } from './strings';
import { TEX } from './textures';
import { button, text } from './ui';

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

  constructor(private scene: Phaser.Scene, onSpeed: () => void) {
    const g = scene.add.graphics().setDepth(DEPTH.ui);
    g.fillStyle(C.shadow, 0.25);
    g.fillRect(0, TOP_H, GAME_W, 3);
    g.fillStyle(C.parchment);
    g.fillRect(0, 0, GAME_W, TOP_H);
    g.lineStyle(2, C.border, 1);
    g.lineBetween(0, TOP_H, GAME_W, TOP_H);

    this.stats = {
      silver: this.stat(14, 'silver', T.silver),
      food: this.stat(190, 'food', T.food),
      residents: this.stat(366, 'people', T.residents),
      work: this.stat(500, 'work', T.work),
      month: this.stat(664, 'month', T.month),
    };
    scene.add.image(790, TOP_H / 2, TEX.icon('goal')).setScale(0.7).setDepth(DEPTH.ui);
    text(scene, 808, 6, T.goal, 13, CSS.muted, true).setDepth(DEPTH.ui);
    this.goal = text(scene, 808, 22, '', 18, CSS.ink, true).setDepth(DEPTH.ui);

    const speed = button(scene, GAME_W - 62, TOP_H / 2, 104, 40, '1x', 20, onSpeed);
    speed.container.setDepth(DEPTH.ui);
    this.speedLabel = speed.label;
  }

  private stat(x: number, icon: Parameters<typeof TEX.icon>[0], label: string): Stat {
    const s = this.scene;
    s.add.image(x + 16, TOP_H / 2, TEX.icon(icon)).setScale(0.75).setDepth(DEPTH.ui);
    text(s, x + 38, 6, label, 13, CSS.muted, true).setDepth(DEPTH.ui);
    const value = text(s, x + 38, 22, '', 22, CSS.ink, true).setDepth(DEPTH.ui);
    const sub = text(s, x + 38, 27, '', 15, CSS.muted, true).setDepth(DEPTH.ui);
    return { value, sub };
  }

  private set(stat: Stat, value: string, sub = '', subColor: string = CSS.muted) {
    stat.value.setText(value);
    stat.sub.setText(sub).setX(stat.value.x + stat.value.width + 6);
    if (stat.sub.style.color !== subColor) stat.sub.setColor(subColor);
  }

  refresh(state: GameState, eco: Economy, speed: Speed) {
    const { silver, food, residents, work, month } = this.stats;
    this.set(silver, String(Math.floor(state.silver)), signed(eco.silverDelta) + T.perMonth, eco.silverDelta < 0 ? CSS.bad : CSS.good);
    this.set(food, String(Math.floor(state.food)), signed(eco.foodDelta) + T.perMonth, eco.foodDelta < 0 ? CSS.bad : CSS.good);
    this.set(residents, String(eco.residents));
    const eff = Math.round(eco.efficiency * 100);
    this.set(work, `${eco.workers}/${eco.jobs}`, `${eff}%`, eff < 100 ? CSS.bad : CSS.good);
    this.set(month, String(state.month + 1));
    const goal = currentGoal(state);
    this.goal.setText(
      goal ? `${state.goalIndex + 1}. ${goal.text} (${Math.min(goalProgress(state, goal), goal.target)}/${goal.target})` : T.allGoals,
    );
    this.speedLabel.setText(speed === 0 ? T.pause : `${speed}x`);
  }
}

import Phaser from 'phaser';
import { alerts, currentGoal, goalProgress, happinessOn, moodOf, seasonOf, type Alert, type Economy, type GameState } from '../core';
import { ALERT_Y, BANNER_MAX_W, GAME_W, GOAL_H, GOAL_Y, inRect, PLAQUE, plaqueSlot, SPEED, SPEED_BTN, speedButton, type Rect } from './layout';
import { C, CSS } from './palette';
import { signed, T } from './strings';
import { TEX } from './textures';
import { RailButton, stonePanel, text } from './ui';

export const SPEEDS = [1, 3, 0] as const;
export type Speed = (typeof SPEEDS)[number];
/** Speed buttons, left to right. */
const SPEED_ORDER: Speed[] = [0, 1, 3];

type StatKey = 'month' | 'silver' | 'food' | 'residents' | 'happiness' | 'work';
/** Plaque slots, left to right (widths in `plaqueSlot`); the happiness icon is the mood face. */
const SLOTS: [StatKey, string][] = [
  ['month', TEX.icon('spring')],
  ['silver', TEX.icon('silver')],
  ['food', TEX.icon('food')],
  ['residents', TEX.icon('people')],
  ['happiness', TEX.mood('neutral')],
  ['work', TEX.icon('work')],
];
const ROW_Y = 46;
const TITLE_Y = 15;
/** The X of a dismissable alert: a touch target bigger than the drawn cross. */
const CLOSE_W = 64;

interface Stat {
  value: Phaser.GameObjects.Text;
  sub: Phaser.GameObjects.Text;
}

export interface HudHandlers {
  onSpeed(v: Speed): void;
  onSilver(): void;
  onHappiness(): void;
  onGoal(): void;
}

/** Top of the screen: speed (top left), the city plaque, the goal banner and one alert banner. */
export class Hud {
  private stats = {} as Record<StatKey, Stat>;
  /** Sun, dusk or moon right after the month number. */
  private phase: Phaser.GameObjects.Image;
  private face!: Phaser.GameObjects.Image;
  /** The month's icon is the season. */
  private seasonIcon!: Phaser.GameObjects.Image;
  /** Tap target of the happiness slot (off, like the face, until the garden is unlocked). */
  private faceZone!: Phaser.GameObjects.Zone;
  private speedButtons: [Speed, RailButton][] = [];
  /** Blinking values (food during famine, silver in debt). */
  private blinks = new Map<Phaser.GameObjects.Text, Phaser.Tweens.Tween>();

  private goalBg: Phaser.GameObjects.Graphics;
  private goalFlag: Phaser.GameObjects.Image;
  private goal: Phaser.GameObjects.Text;
  private goalZone: Phaser.GameObjects.Zone;
  private goalRect: Rect = { x: 0, y: GOAL_Y, w: 0, h: GOAL_H };

  private alertBg: Phaser.GameObjects.Graphics;
  private alertText: Phaser.GameObjects.Text;
  private alertMark: Phaser.GameObjects.Text;
  private closeZone: Phaser.GameObjects.Zone;
  private alertRect: Rect | null = null;
  private closeRect: Rect | null = null;
  private alertKey = '';
  private shown: Alert | null = null;
  /** Alerts closed with the X: hidden until they go away and come back. */
  private dismissed = new Set<Alert['kind']>();
  private lastAlerts: Alert[] = [];

  constructor(private scene: Phaser.Scene, h: HudHandlers) {
    const g = scene.add.graphics();

    // Speed: pause, 1x, 3x; the active one in gold.
    stonePanel(g, SPEED.x, SPEED.y, SPEED.w, SPEED.h);
    SPEED_ORDER.forEach((v, k) => {
      const { x, y } = speedButton(k);
      const label = text(scene, 0, -2, T.speed(v), v === 0 ? 22 : 26, CSS.ink, true).setOrigin(0.5);
      this.speedButtons.push([v, new RailButton(scene, x, y, SPEED_BTN, SPEED_BTN, [label], () => h.onSpeed(v))]);
    });

    // Plaque hanging from the top edge: city name, then icon + number for each stat.
    stonePanel(g, PLAQUE.x, PLAQUE.y - 14, PLAQUE.w, PLAQUE.h + 14, 14);
    const name = text(scene, GAME_W / 2, TITLE_Y, T.cityName, 17, CSS.ink, true).setOrigin(0.5);
    const half = name.width / 2 + 14;
    g.lineStyle(1.5, C.gold, 1);
    g.lineBetween(GAME_W / 2 - half - 90, TITLE_Y, GAME_W / 2 - half, TITLE_Y);
    g.lineBetween(GAME_W / 2 + half, TITLE_Y, GAME_W / 2 + half + 90, TITLE_Y);
    g.fillStyle(C.gold);
    for (const sx of [-1, 1]) g.fillPoints(diamond(GAME_W / 2 + sx * (half - 6), TITLE_Y, 4), true);
    SLOTS.forEach(([key, icon], k) => {
      const { x, w, h: sh } = plaqueSlot(k);
      const img = scene.add.image(x + 16, ROW_Y, icon).setScale(0.7);
      if (key === 'happiness') this.face = img;
      if (key === 'month') this.seasonIcon = img;
      this.stats[key] = {
        value: text(scene, x + 36, ROW_Y, '', 22, CSS.ink, true).setOrigin(0, 0.5),
        sub: text(scene, x + 36, ROW_Y + 2, '', 14, CSS.muted, true).setOrigin(0, 0.5),
      };
      // Tapping the silver shows where it comes from and where it goes; the face, what moves the mood.
      const onTap = key === 'silver' ? h.onSilver : key === 'happiness' ? h.onHappiness : null;
      if (!onTap) return;
      const zone = scene.add.zone(x, 0, w, sh).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', onTap);
      if (key === 'happiness') this.faceZone = zone;
    });

    this.phase = scene.add.image(0, ROW_Y, TEX.icon('sun')).setScale(0.62);

    // Goal banner: tapping shows the whole goal in the info line.
    this.goalBg = scene.add.graphics();
    this.goalFlag = scene.add.image(0, GOAL_Y + GOAL_H / 2, TEX.icon('goal')).setScale(0.6);
    this.goal = text(scene, 0, GOAL_Y + GOAL_H / 2, '', 18, CSS.ink, true).setOrigin(0, 0.5);
    this.goalZone = scene.add.zone(0, GOAL_Y, 10, GOAL_H).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', h.onGoal);

    // One alert banner; every alert but the debt can be closed.
    this.alertBg = scene.add.graphics();
    this.alertMark = text(scene, 0, 0, '!', 20, CSS.ink, true).setOrigin(0.5).setVisible(false);
    this.alertText = text(scene, 0, 0, '', 17, CSS.light, true).setOrigin(0.5).setAlign('center').setVisible(false);
    this.closeZone = scene.add.zone(0, 0, CLOSE_W, 10).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', () => {
      if (!this.shown || this.shown.kind === 'debt') return;
      this.dismissed.add(this.shown.kind);
      this.showAlert();
    });
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

  private set(stat: Stat, value: string, sub = '', subColor: string = CSS.muted) {
    stat.value.setText(value);
    stat.sub.setText(sub).setX(stat.value.x + stat.value.width + 5);
    if (stat.sub.style.color !== subColor) stat.sub.setColor(subColor);
  }

  /** Gold ribbon centered under the plaque; long goals shrink the font. */
  private setGoal(str: string) {
    let size = 18;
    this.goal.setText(str).setFontSize(size);
    while (this.goal.width > BANNER_MAX_W - 56 && size > 12) this.goal.setFontSize(--size);
    const w = Math.round(this.goal.width + 56);
    const x = (GAME_W - w) / 2;
    this.goalRect = { x, y: GOAL_Y, w, h: GOAL_H };
    this.goalFlag.setX(x + 20);
    this.goal.setX(x + 36);
    this.goalZone.setPosition(x, GOAL_Y).setSize(w, GOAL_H);
    const g = this.goalBg.clear();
    g.fillStyle(C.shadow, 0.25);
    g.fillRoundedRect(x + 2, GOAL_Y + 3, w, GOAL_H, 10);
    g.fillStyle(C.ui.goldLight);
    g.fillRoundedRect(x, GOAL_Y, w, GOAL_H, 10);
    g.lineStyle(2, C.ui.goldDark, 1);
    g.strokeRoundedRect(x, GOAL_Y, w, GOAL_H, 10);
  }

  /** The most important alert not closed by the player. */
  private showAlert() {
    const a = this.lastAlerts.find((x) => !this.dismissed.has(x.kind)) ?? null;
    const key = a ? T.alert(a) : '';
    this.shown = a;
    if (key === this.alertKey) return;
    this.alertKey = key;
    const g = this.alertBg.clear();
    this.alertText.setVisible(!!a);
    this.alertMark.setVisible(!!a);
    this.closeZone.setVisible(!!a && a.kind !== 'debt');
    this.alertRect = null;
    this.closeRect = null;
    if (!a) return;
    const closable = a.kind !== 'debt';
    this.alertText.setText(key).setWordWrapWidth(BANNER_MAX_W - 48 - (closable ? CLOSE_W : 16));
    const w = Math.round(this.alertText.width + 48 + (closable ? CLOSE_W - 12 : 16));
    const h = Math.max(40, Math.round(this.alertText.height + 14));
    const x = (GAME_W - w) / 2;
    this.alertRect = { x, y: ALERT_Y, w, h };
    g.fillStyle(C.shadow, 0.25);
    g.fillRoundedRect(x + 2, ALERT_Y + 3, w, h, 10);
    g.fillStyle(a.kind === 'debt' ? C.ui.alertBad : C.ui.alertWarn, 0.96);
    g.fillRoundedRect(x, ALERT_Y, w, h, 10);
    g.lineStyle(2, C.ui.goldLight, 1);
    g.strokeRoundedRect(x, ALERT_Y, w, h, 10);
    // Warning mark at the left, so the banner reads as a problem without relying on color.
    g.fillStyle(C.ui.goldLight);
    g.fillCircle(x + 22, ALERT_Y + h / 2, 12);
    this.alertMark.setPosition(x + 22, ALERT_Y + h / 2);
    this.alertText.setPosition(x + 40 + this.alertText.width / 2, ALERT_Y + h / 2);
    if (!closable) return;
    const cx = x + w - 26;
    const cy = ALERT_Y + h / 2;
    g.lineStyle(3, C.ui.goldLight, 1);
    g.lineBetween(cx - 7, cy - 7, cx + 7, cy + 7);
    g.lineBetween(cx - 7, cy + 7, cx + 7, cy - 7);
    const zh = Math.max(h, 60);
    this.closeRect = { x: x + w - CLOSE_W, y: cy - zh / 2, w: CLOSE_W, h: zh };
    this.closeZone.setPosition(this.closeRect.x, this.closeRect.y).setSize(CLOSE_W, zh);
  }

  refresh(state: GameState, eco: Economy, speed: Speed) {
    const { silver, food, residents, happiness, work, month } = this.stats;
    this.set(month, String(state.month + 1));
    const season = TEX.icon(seasonOf(state.month));
    if (this.seasonIcon.texture.key !== season) this.seasonIcon.setTexture(season);
    this.phase.setX(month.value.x + month.value.width + 16);
    this.set(silver, String(Math.floor(state.silver)), signed(eco.silverDelta) + T.perMonth, eco.silverDelta < 0 ? CSS.bad : CSS.good);
    const debt = state.silver < 0;
    this.tone(silver.value, debt ? CSS.bad : eco.silverDelta < 0 ? CSS.warn : CSS.ink, debt);
    this.set(food, String(Math.floor(state.food)), signed(eco.foodDelta) + T.perMonth, eco.foodDelta < 0 ? CSS.bad : CSS.good);
    this.tone(food.value, state.famine ? CSS.bad : CSS.ink, state.famine);
    this.set(residents, String(eco.residents));
    // The face and its number only exist once the garden is unlocked (before it everyone is content).
    const on = happinessOn(state);
    for (const o of [this.face, happiness.value, happiness.sub]) o.setVisible(on);
    if (this.faceZone.input) this.faceZone.input.enabled = on;
    const mood = moodOf(eco.happiness);
    const face = TEX.mood(mood);
    if (this.face.texture.key !== face) this.face.setTexture(face);
    this.set(happiness, String(eco.happiness));
    this.tone(happiness.value, mood === 'sad' ? CSS.bad : mood === 'happy' ? CSS.good : CSS.ink, false);
    const eff = Math.round(eco.efficiency * 100);
    if (eco.workers === 0 && eco.jobs === 0) this.set(work, T.noJobs);
    else if (eco.workers > eco.jobs) this.set(work, `${eco.workers}/${eco.jobs}`, T.idle(eco.workers - eco.jobs), CSS.warn);
    else this.set(work, `${eco.workers}/${eco.jobs}`, `${eff}%`, eff < 100 ? CSS.bad : CSS.good);

    const goal = currentGoal(state);
    const goalText = goal ? T.goalBanner(state.goalIndex + 1, goal, goalProgress(state, goal)) : T.allGoals;
    if (goalText !== this.goal.text) this.setGoal(goalText);

    for (const [v, btn] of this.speedButtons) btn.setLook(v === speed ? 'active' : 'normal');

    this.lastAlerts = alerts(state);
    for (const kind of this.dismissed) if (!this.lastAlerts.some((a) => a.kind === kind)) this.dismissed.delete(kind);
    this.showAlert();
  }

  setPhase(icon: 'sun' | 'dusk' | 'moon') {
    const key = TEX.icon(icon);
    if (this.phase.texture.key !== key) this.phase.setTexture(key);
  }

  contains(x: number, y: number) {
    return (
      inRect(SPEED, x, y) ||
      inRect(PLAQUE, x, y) ||
      inRect(this.goalRect, x, y) ||
      (!!this.alertRect && inRect(this.alertRect, x, y)) ||
      (!!this.closeRect && inRect(this.closeRect, x, y))
    );
  }
}

const diamond = (x: number, y: number, r: number) => [
  { x, y: y - r },
  { x: x + r, y },
  { x, y: y + r },
  { x: x - r, y },
];

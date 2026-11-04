import Phaser from 'phaser';
import VISUAL from '../../data/visual.json';
import { calendar, cityLevel, nextFieldTurn, RULES, seasonOf, currentGoal, foodCapacity, goalCount, goalFraction, goalProgress, goalTarget, happinessOn, moodOf, lastsToHarvest, type CityReadout, type GameState, type Season } from '../../core';
import { px, type Rect } from '../layout';
import { NOVA, NOVA_CSS } from '../palette';
import { fmtInt, signed, T } from '../strings';
import { TEX } from '../textures';
import { SPEEDS, type Speed } from '../tools';
import { onTap as tapOnly } from '../ui';
import type { TutorialTarget } from '../Tutorial';
import { PHONE, S } from './metrics';
import { darkPanel, icon, ntext, picture, RoundButton } from './widgets';

const DROUGHT_HUD = VISUAL.seasons.drought.hud;
/** The stock shows "38/40" from this share of the store limit up (food about to spoil). */
const STOCK_SHOWN = 0.75;

/** One piece of a pill: a text (with its size and color) or a progress bar. */
type Part = { text: string; color?: string; size?: number } | { bar: number; w: number };

/** Informative pill (rounded, dark): an optional icon, then texts and bars in a row. Tapping it may open a panel. */
class Pill {
  readonly root: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private icon: Phaser.GameObjects.Image | Phaser.GameObjects.Text | null;
  private texts: Phaser.GameObjects.Text[] = [];
  private bars: Phaser.GameObjects.Graphics;
  private key = '';
  private blinks = new Map<number, Phaser.Tweens.Tween>();
  private zone: Phaser.GameObjects.Zone | null = null;
  w = 0;

  constructor(private scene: Phaser.Scene, iconKey: string | null, readonly h: number, onTap: (() => void) | null) {
    this.bg = scene.add.graphics();
    this.bars = scene.add.graphics();
    this.icon = iconKey ? picture(scene, iconKey, h * 0.62) : null;
    this.root = scene.add.container(0, 0, [this.bg, this.bars, ...(this.icon ? [this.icon] : [])]);
    if (onTap) {
      this.zone = scene.add.zone(0, 0, 10, h).setOrigin(0).setInteractive({ useHandCursor: true });
      tapOnly(this.zone, onTap);
      this.root.add(this.zone);
    }
  }

  setIcon(key: string) {
    if (this.icon instanceof Phaser.GameObjects.Image && this.icon.texture.key !== key && this.scene.textures.exists(key)) {
      const size = this.h * 0.62;
      this.icon.setTexture(key).setScale(size / Math.max(this.icon.width, this.icon.height));
    }
  }

  /** Sets the parts; returns true if the width changed. */
  set(parts: Part[], maxW = Infinity): boolean {
    const key = JSON.stringify(parts) + maxW;
    if (key === this.key) return false;
    this.key = key;
    const s = this.scene;
    while (this.texts.length < parts.length) {
      const t = ntext(s, 0, this.h / 2, '', S.text).setOrigin(0, 0.5);
      this.texts.push(t);
      this.root.add(t);
    }
    const pad = this.h * 0.38;
    const gap = px(5);
    let x = pad;
    if (this.icon) {
      this.icon.setPosition(x + (this.h * 0.62) / 2, this.h / 2);
      x += this.h * 0.62 + gap;
    }
    this.bars.clear();
    parts.forEach((p, k) => {
      const t = this.texts[k];
      if ('bar' in p) {
        t.setVisible(false);
        const bh = px(6);
        this.bars.fillStyle(NOVA.track, 1).fillRoundedRect(x, this.h / 2 - bh / 2, p.w, bh, bh / 2);
        if (p.bar > 0) this.bars.fillStyle(NOVA.good, 1).fillRoundedRect(x, this.h / 2 - bh / 2, Math.max(bh, p.w * Math.min(1, p.bar)), bh, bh / 2);
        x += p.w + gap;
        return;
      }
      t.setVisible(true).setText(p.text).setFontSize(p.size ?? S.text).setColor(p.color ?? NOVA_CSS.text).setX(x);
      x += t.width + gap;
    });
    for (let k = parts.length; k < this.texts.length; k++) this.texts[k].setVisible(false);
    const w = Math.round(x - gap + pad);
    // Too long (the goal on a narrow screen): the longest text is cut with "…".
    if (w > maxW) {
      let k = -1;
      parts.forEach((p, i) => {
        if ('text' in p && (k < 0 || p.text.length > (parts[k] as { text: string }).text.length)) k = i;
      });
      const p = parts[k] as { text: string };
      if (k >= 0 && p.text.length > 4) {
        const cut = { ...p, text: p.text.replace(/…$/, '').slice(0, -2).trimEnd() + '…' };
        this.set(parts.map((q, i) => (i === k ? cut : q)), maxW);
        this.key = key; // the same long parts next time give the same cut: no work
        return true;
      }
    }
    const changed = w !== this.w;
    this.w = w;
    this.bg.clear();
    darkPanel(this.bg, 0, 0, w, this.h);
    this.zone?.setSize(w, this.h);
    return changed;
  }

  /** Shows or hides the pill (and its touch area). */
  show(on: boolean) {
    this.root.setVisible(on);
    if (this.zone?.input) this.zone.input.enabled = on;
  }

  /** Makes a part pulse (famine, debt). */
  blink(k: number, on: boolean) {
    const tween = this.blinks.get(k);
    if (on === !!tween) return;
    const t = this.texts[k];
    if (on) this.blinks.set(k, this.scene.tweens.add({ targets: t, alpha: 0.25, duration: 380, yoyo: true, repeat: -1 }));
    else {
      tween!.remove();
      this.blinks.delete(k);
      t.setAlpha(1);
    }
  }

  get rect(): Rect | null {
    return this.root.visible ? { x: this.root.x, y: this.root.y, w: this.w, h: this.h } : null;
  }
}

export interface TopBarHandlers {
  onGoals(): void;
  onStats(): void;
  onSpeed(v: Speed): void;
  onSettings(): void;
}

/**
 * Top of the Nova: level circle with the goal ring, stat pills and the goal pill (left); the season
 * pill, speed and the settings gear (right, left of the build column).
 */
export class TopBar {
  private levelRing: Phaser.GameObjects.Graphics;
  private levelNum: Phaser.GameObjects.Text;
  private silver: Pill;
  private food: Pill;
  private people: Pill;
  private joy: Pill | null;
  private goal: Pill;
  private season: Pill;
  private speedBg: Phaser.GameObjects.Graphics;
  private speeds: [Speed, RoundButton][] = [];
  private speedOne: RoundButton | null = null;
  private speedLabel: Phaser.GameObjects.Text | null = null;
  private speedPause: Phaser.GameObjects.Image | Phaser.GameObjects.Text | null = null;
  readonly gear: RoundButton;
  private levelRect: Rect;
  private speedRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private drought = false;
  private lastSeason = '';
  /** The season and the core's dry year last shown, for the icon (also set between refreshes). */
  private iconOf: { season: Season; dry: boolean } = { season: 'autumn', dry: false };
  private speed: Speed = 1;

  /** `right`: left edge of the build column (the top right buttons sit left of it). */
  constructor(scene: Phaser.Scene, private right: number, h: TopBarHandlers) {
    const L = S.level;
    const cx = S.margin + L / 2;
    const cy = S.margin + L / 2;
    this.levelRect = { x: S.margin, y: S.margin, w: L, h: L };
    const disc = scene.add.graphics();
    disc.fillStyle(0x000000, 0.28).fillCircle(cx, cy + px(2), L / 2);
    disc.fillStyle(NOVA.panel, 0.9).fillCircle(cx, cy, L / 2);
    this.levelRing = scene.add.graphics();
    this.levelNum = ntext(scene, cx, cy - L * 0.08, '1', S.big).setOrigin(0.5);
    ntext(scene, cx, cy + L * 0.24, T.nova.level, S.small, NOVA_CSS.gold).setOrigin(0.5);
    const goals = scene.add.zone(cx, cy, L, L).setInteractive({ hitArea: new Phaser.Geom.Circle(L / 2, L / 2, Math.max(L, px(44)) / 2), hitAreaCallback: Phaser.Geom.Circle.Contains, useHandCursor: true });
    tapOnly(goals, h.onGoals);

    this.silver = new Pill(scene, TEX.icon('silver'), S.pillH, h.onStats);
    this.food = new Pill(scene, TEX.icon('food'), S.pillH, h.onStats);
    this.people = new Pill(scene, TEX.icon('people'), S.pillH, h.onStats);
    this.joy = PHONE ? null : new Pill(scene, TEX.mood('neutral'), S.pillH, h.onStats);
    this.goal = new Pill(scene, null, S.goalH, h.onGoals);
    this.season = new Pill(scene, TEX.icon('spring'), S.pillH, null);

    // Gear, then speed, right to left.
    const by = S.margin + S.btn / 2;
    const gx = right - S.gap - S.btn / 2;
    this.gear = new RoundButton(scene, gx, by, S.btn, S.btn, [icon(scene, 'gear', S.btn * 0.58, 'light')], h.onSettings, { style: 'dark' });
    this.speedBg = scene.add.graphics();
    if (PHONE) {
      // One gold button: 1x -> 3x -> pause.
      const x = gx - S.btn - S.gap;
      this.speedLabel = ntext(scene, 0, 0, '1x', S.num, NOVA_CSS.ink).setOrigin(0.5);
      this.speedPause = icon(scene, 'pause', S.btn * 0.5);
      this.speedOne = new RoundButton(scene, x, by, S.btn, S.btn, [this.speedLabel, this.speedPause], () => h.onSpeed(SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length]), { style: 'gold' });
      this.speedRect = { x: x - S.btn / 2, y: by - S.btn / 2, w: S.btn, h: S.btn };
    } else {
      const inner = px(3);
      const w = 3 * S.btn + 4 * inner;
      const x0 = gx - S.btn / 2 - S.gap - w;
      this.speedRect = { x: x0, y: by - S.btn / 2 - inner, w, h: S.btn + 2 * inner };
      darkPanel(this.speedBg, x0, by - S.btn / 2 - inner, w, S.btn + 2 * inner);
      ([0, 1, 3] as Speed[]).forEach((v, k) => {
        const content = v === 0 ? [icon(scene, 'pause', S.btn * 0.45, 'light')] : [ntext(scene, 0, 0, `${v}x`, S.text, NOVA_CSS.text).setOrigin(0.5)];
        const btn = new RoundButton(scene, x0 + inner + S.btn / 2 + k * (S.btn + inner), by, S.btn, S.btn, content, () => h.onSpeed(v), { style: 'dark' });
        this.speeds.push([v, btn]);
      });
    }
  }

  refresh(s: GameState, { eco, forecast: out }: CityReadout, speed: Speed) {
    this.speed = speed;
    const L = S.level;
    const cx = S.margin + L / 2;
    const cy = S.margin + L / 2;
    this.levelNum.setText(String(cityLevel(s)));
    const ring = this.levelRing.clear();
    const rw = px(PHONE ? 4 : 5);
    ring.lineStyle(rw, NOVA.track, 1).strokeCircle(cx, cy, L / 2 - rw / 2);
    const f = goalFraction(s);
    if (f > 0) {
      ring.lineStyle(rw, NOVA.gold, 1).beginPath();
      ring.arc(cx, cy, L / 2 - rw / 2, -Math.PI / 2, -Math.PI / 2 + f * 2 * Math.PI);
      ring.strokePath();
    }

    const N = T.nova;
    const label = (t: string): Part[] => (PHONE ? [] : [{ text: t, color: NOVA_CSS.muted }]);
    const delta = (d: number): Part => ({ text: signed(d) + (PHONE ? '' : N.perWeek), color: d < 0 ? NOVA_CSS.bad : NOVA_CSS.good, size: S.text });
    const debt = s.silver < 0;
    const silverColor = debt ? NOVA_CSS.bad : eco.silverDelta < 0 ? NOVA_CSS.warn : NOVA_CSS.text;
    const sv = label(N.silver).length;
    this.silver.set([...label(N.silver), { text: fmtInt(s.silver), color: silverColor, size: S.num }, delta(eco.silverDelta)]);
    this.silver.blink(sv, debt);
    // Forecast: "até a colheita" (green) when the food lasts, else when it runs out (red; phone: "⚠ N sem").
    const lasts = lastsToHarvest(s, out);
    const cap = foodCapacity(s);
    const food = Math.floor(s.food);
    const full = food >= cap * STOCK_SHOWN;
    const dot = PHONE ? '' : '· ';
    const forecast: Part[] = s.famine
      ? [{ text: N.famine, color: NOVA_CSS.bad }]
      : !lasts
        ? [{ text: PHONE ? N.foodShortPhone(out!.weeks) : dot + N.foodForecast(out!, seasonOf(s.week)), color: NOVA_CSS.bad }]
        : s.spoiled > 0
          ? [{ text: dot + N.full, color: NOVA_CSS.warn }]
          : PHONE ? [] : [{ text: dot + N.foodToHarvest, color: NOVA_CSS.good }];
    const fv = label(N.food).length;
    this.food.set([
      ...label(N.food),
      { text: full ? N.stock(food, cap) : fmtInt(food), color: s.famine ? NOVA_CSS.bad : s.spoiled > 0 ? NOVA_CSS.warn : NOVA_CSS.text, size: S.num },
      delta(eco.foodDelta),
      ...forecast,
    ]);
    this.food.blink(fv + 2, s.famine); // the "FOME" part
    this.people.set([...label(N.residents), { text: fmtInt(eco.residents), size: S.num }]);
    if (this.joy) {
      const on = happinessOn(s);
      this.joy.show(on);
      const mood = moodOf(eco.happiness);
      this.joy.setIcon(TEX.mood(mood));
      this.joy.set([...label(N.happiness), { text: String(eco.happiness), size: S.num, color: mood === 'sad' ? NOVA_CSS.bad : mood === 'happy' ? NOVA_CSS.good : NOVA_CSS.text }]);
    }

    const { season, year, week } = calendar(s.week);
    const sKey = `${season}|${year}|${week}|${s.drought}`;
    if (sKey !== this.lastSeason) {
      this.lastSeason = sKey;
      // When the fields freeze (or thaw) next: the year turns around it.
      const turn = nextFieldTurn(s.week);
      const turnColor = turn.season === 'winter' && turn.weeks <= RULES.winterWarningWeeks ? NOVA_CSS.warn : NOVA_CSS.muted;
      this.season.set([
        ...(PHONE ? [{ text: N.calendarPhone(season, turn) }] : [{ text: N.calendar(season, year, week, true) }, { text: '· ' + N.fieldTurn(turn), color: turnColor }]),
        ...(s.drought ? [{ text: '· ' + N.drought, color: NOVA_CSS.warn }] : []),
      ]);
    }
    this.iconOf = { season, dry: s.drought };
    this.seasonIcon();

    // Speed: the active one in gold (PC); the single phone button shows what runs now.
    for (const [v, btn] of this.speeds) btn.setLook({ style: v === speed ? 'gold' : 'dark' });
    if (this.speedLabel && this.speedPause) {
      this.speedLabel.setText(`${speed}x`).setVisible(speed !== 0);
      this.speedPause.setVisible(speed === 0);
    }

    this.layout(s);
  }

  /** Pills left to right; the season pill moves under the speed if it would touch them; the goal fits what is left. */
  private layout(s: GameState) {
    let x = S.margin + S.level + S.gap;
    const y = S.margin;
    for (const p of [this.silver, this.food, this.people, this.joy]) {
      if (!p || !p.root.visible) continue;
      p.root.setPosition(x, y);
      x += p.w + S.gap;
    }
    const pillsRight = x - S.gap;
    const leftOfButtons = this.speedRect.x - S.gap;
    const by = S.margin + S.btn / 2;
    let seasonRow2 = false;
    if (leftOfButtons - this.season.w >= pillsRight + S.gap) this.season.root.setPosition(leftOfButtons - this.season.w, by - this.season.h / 2);
    else {
      seasonRow2 = true;
      this.season.root.setPosition(this.right - S.gap - this.season.w, S.margin + S.btn + S.gap);
    }

    const goalY = S.margin + S.pillH + S.gap * 0.7;
    const gx = S.margin + S.level + S.gap;
    const seasonTop = this.season.root.y;
    const blocked = seasonRow2 && goalY + S.goalH > seasonTop ? this.season.root.x : this.speedRect.y + this.speedRect.h > goalY ? this.speedRect.x : this.right;
    const maxW = blocked - S.gap - gx;
    const goal = currentGoal(s);
    const N = T.nova;
    if (!goal) this.goal.set([{ text: T.allGoals, color: NOVA_CSS.gold }], maxW);
    else {
      const p = goalProgress(s, goal);
      const target = goalTarget(s, goal);
      const head = PHONE ? N.goal : N.goalOf(s.goalIndex + 1, goalCount());
      this.goal.set(
        [
          { text: head, color: NOVA_CSS.gold, size: S.small },
          { text: N.goalText(goal) },
          ...(PHONE ? [] : [{ bar: goalFraction(s), w: px(80) } as Part]),
          { text: N.progress(p, target, goal.type === 'foodUntilSpring' && target > 1), color: NOVA_CSS.gold },
        ],
        maxW,
      );
    }
    this.goal.root.setPosition(gx, goalY);
  }

  setDrought(d: number) {
    const on = d >= DROUGHT_HUD.from + DROUGHT_HUD.fade / 2;
    if (on === this.drought) return;
    this.drought = on;
    this.seasonIcon();
  }

  private seasonIcon() {
    this.season.setIcon(TEX.icon(this.drought || this.iconOf.dry ? 'drought' : this.iconOf.season));
  }

  /**
   * Tutorial arrow targets: the goal from under its pill; the silver from its right end (under it
   * sits the goal pill, which the arrow would seem to point at).
   */
  anchor(name: 'silver' | 'goal'): TutorialTarget {
    const r = (name === 'silver' ? this.silver.rect : this.goal.rect) ?? this.levelRect;
    if (name === 'silver') return { x: r.x + r.w - 2, y: r.y + r.h / 2, dir: 'left' };
    return { x: r.x + Math.min(r.w / 2, px(40)), y: r.y + r.h + 2, dir: 'up' };
  }

  /** Center and size of a part, for the visual tests (see `setNovaSpot`). */
  spot(name: 'level' | 'gear' | 'silver' | 'food' | 'goal' | 'season' | `speed-${Speed}`) {
    const c = (r: Rect | null, d: number) => (r ? { x: r.x + r.w / 2, y: r.y + r.h / 2, d } : null);
    if (name === 'level') return c(this.levelRect, S.level);
    if (name === 'gear') return { x: this.gear.root.x, y: this.gear.root.y, d: S.btn };
    if (name.startsWith('speed-')) {
      const v = Number(name.slice(6)) as Speed;
      const b = this.speedOne ?? this.speeds.find(([x]) => x === v)?.[1];
      return b ? { x: b.root.x, y: b.root.y, d: S.btn } : null;
    }
    const pill = { silver: this.silver, food: this.food, goal: this.goal, season: this.season }[name as 'silver'];
    return c(pill.rect, pill.h);
  }

  /** Lowest edge of the top bar (balloons stay under it). */
  get bottom() {
    return Math.max(...this.rects().map((r) => (r ? r.y + r.h : 0)), this.gear.root.y + S.btn / 2);
  }

  /** Lowest edge of the top right controls (season, speed, gear): the column balloons stay under it. */
  get rightBottom() {
    const r = this.season.rect;
    return Math.max(this.speedRect.y + this.speedRect.h, this.gear.root.y + S.btn / 2, r ? r.y + r.h : 0);
  }

  rects(): (Rect | null)[] {
    return [this.levelRect, this.silver.rect, this.food.rect, this.people.rect, this.joy?.rect ?? null, this.goal.rect, this.season.rect, this.speedRect];
  }

  contains(x: number, y: number) {
    if (this.gear.contains(x, y) || this.speedOne?.contains(x, y)) return true;
    return this.rects().some((r) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  }
}

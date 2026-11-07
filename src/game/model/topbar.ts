import {
  calendar,
  cityLevel,
  currentGoal,
  firewoodShort,
  foodCapacity,
  goalCount,
  goalFraction,
  goalProgress,
  goalTarget,
  happinessOn,
  housesWaiting,
  lastsToHarvest,
  moodOf,
  nextFieldTurn,
  RULES,
  seasonOf,
  TEMPLE_STAGES,
  type CityReadout,
  type GameState,
  type Material,
  type Mood,
  type Season,
} from '../../core';
import { fmt, fmtInt, signed, T } from '../strings';

/** A role, not a colour: each view turns it into its palette. */
export type Tone = 'text' | 'good' | 'bad' | 'warn' | 'muted' | 'gold';
export type Size = 'num' | 'text' | 'small';

/** One piece of a pill: a text, a progress bar (0..1) or an icon by name. */
export type Part = { text: string; tone?: Tone; size?: Size } | { bar: number } | { icon: string };

export interface Pill {
  /** Stable key (the HTML keeps one element per pill). */
  key: 'silver' | 'food' | 'wood' | 'stone' | 'livestock' | 'people' | 'joy';
  icon: string;
  parts: Part[];
  /** Blinks (debt, famine). */
  alarm: boolean;
}

export interface TopBar {
  level: number;
  /** Share of the current goal done (the ring around the level). */
  goalFraction: number;
  pills: Pill[];
  goal: Part[];
  season: Part[];
  seasonIcon: Season | 'drought';
}

/** The stock shows "38/40" from this share of the store limit up (food about to spoil). */
const STOCK_SHOWN = 0.75;

/**
 * The top bar as data. `phone`: short texts (no names, icons only); `fit` 0..5 shortens a PC bar
 * step by step when it does not fit (1 drops material names, 2 every name, 3 the materials' "+N/sem",
 * 4 the "/sem", 5 the food forecast's words).
 */
export function topBar(s: GameState, city: CityReadout, phone: boolean, fit = 0): TopBar {
  const N = T.nova;
  const { eco, forecast: out } = city;
  const label = (t: string): Part[] => (phone || fit >= 2 ? [] : [{ text: t, tone: 'muted' }]);
  const short = phone || fit >= 5;
  const delta = (d: number): Part => ({ text: signed(d) + (phone || fit >= 4 ? '' : N.perWeek), tone: d < 0 ? 'bad' : 'good', size: 'text' });
  const debt = s.silver < 0;
  const pills: Pill[] = [];
  pills.push({
    key: 'silver',
    icon: 'silver',
    alarm: debt,
    parts: [...label(N.silver), { text: fmtInt(s.silver), tone: debt ? 'bad' : eco.silverDelta < 0 ? 'warn' : 'text', size: 'num' }, delta(eco.silverDelta)],
  });
  // Forecast: "até a colheita" (green) when the food lasts, else when it runs out (red; phone: "⚠ N sem").
  const lasts = lastsToHarvest(s, out);
  const cap = foodCapacity(s);
  const food = Math.floor(s.food);
  const full = food >= cap * STOCK_SHOWN;
  const dot = short ? '' : '· ';
  const forecast: Part[] = s.famine
    ? [{ text: N.famine, tone: 'bad' }]
    : !lasts
      ? [{ text: short ? N.foodShortPhone(out!.weeks) : dot + N.foodForecast(out!, seasonOf(s.week)), tone: 'bad' }]
      : s.spoiled > 0
        ? [{ text: dot + N.full, tone: 'warn' }]
        : short || eco.residents === 0
          ? []
          : [{ text: dot + N.foodToHarvest, tone: 'good' }];
  pills.push({
    key: 'food',
    icon: 'food',
    alarm: s.famine,
    parts: [...label(N.food), { text: full ? N.stock(food, cap) : fmtInt(food), tone: s.famine ? 'bad' : s.spoiled > 0 ? 'warn' : 'text', size: 'num' }, delta(eco.foodDelta), ...forecast],
  });
  // Wood (and stone once the quarry is unlocked): red with ⚠ while a house waits for it.
  const waiting = housesWaiting(s);
  // Livestock: what the pastures bring less the altar's weekly offering (red while the restored altar goes without).
  const offering = s.temple.done >= 1 ? TEMPLE_STAGES[s.temple.done - 1].offering : 0;
  const made: Record<Material, number> = { wood: eco.wood, stone: eco.stone, livestock: Math.round((eco.livestock - offering) * 100) / 100 };
  const bad = (m: Material) => waiting[m] > 0 || (m === 'wood' && (s.cold || firewoodShort(s, { wood: made.wood }) > 0)) || (m === 'livestock' && s.temple.done >= 1 && !s.offered);
  const mats: Material[] = ['wood'];
  if (s.unlocked.includes('quarry') || s.stone > 0) mats.push('stone');
  if (s.unlocked.includes('pasture') || s.livestock > 0) mats.push('livestock');
  for (const m of mats)
    pills.push({
      key: m,
      icon: m,
      alarm: false,
      parts: [
        ...(phone || fit >= 1 ? [] : [{ text: N.material[m], tone: 'muted' } as Part]),
        { text: (bad(m) ? '⚠ ' : '') + fmtInt(s[m]), tone: bad(m) ? 'bad' : 'text', size: 'num' },
        ...(phone || fit >= 3 ? [] : [{ text: `${made[m] < 0 ? '−' : '+'}${fmt(Math.abs(made[m]))}${N.perWeek}`, tone: made[m] > 0 ? 'good' : made[m] < 0 ? 'bad' : 'muted', size: 'text' } as Part]),
      ],
    });
  pills.push({ key: 'people', icon: 'people', alarm: false, parts: [...label(N.residents), { text: fmtInt(eco.residents), size: 'num' }] });
  if (!phone && happinessOn(s)) {
    const mood: Mood = moodOf(eco.happiness);
    pills.push({ key: 'joy', icon: `mood-${mood}`, alarm: false, parts: [...label(N.happiness), { text: String(eco.happiness), size: 'num', tone: mood === 'sad' ? 'bad' : mood === 'happy' ? 'good' : 'text' }] });
  }

  const { season, year, week } = calendar(s.week);
  const turn = nextFieldTurn(s.week);
  const turnTone: Tone = turn.season === 'winter' && turn.weeks <= RULES.winterWarningWeeks ? 'warn' : 'muted';
  const seasonParts: Part[] = [
    ...(phone ? [{ text: N.calendarPhone(year, turn) }] : [{ text: N.calendar(season, year, week, true) }, { text: '· ' + N.fieldTurn(turn), tone: turnTone } as Part]),
    ...(s.drought ? [{ text: '· ' + N.drought, tone: 'warn' } as Part] : []),
  ];
  return { level: cityLevel(s), goalFraction: goalFraction(s), pills, goal: goalParts(s, phone), season: seasonParts, seasonIcon: s.drought ? 'drought' : season };
}

/** The goal pill: "Objetivo 3 de 18", its text, a bar (PC), the progress and the temple savings. */
export function goalParts(s: GameState, phone: boolean): Part[] {
  const goal = currentGoal(s);
  const N = T.nova;
  if (!goal) return [{ text: T.allGoals, tone: 'gold' }];
  const p = goalProgress(s, goal);
  const progress = N.goalProgress(goal, p, goalTarget(s, goal));
  return [
    { text: phone ? N.goal : N.goalOf(s.goalIndex + 1, goalCount()), tone: 'gold', size: 'small' },
    { text: N.goalText(goal) },
    ...(phone ? [] : [{ bar: goalFraction(s) } as Part]),
    ...(progress ? [{ text: progress, tone: 'gold' } as Part] : []),
  ];
}

/** The tightest step of `topBar`'s `fit`. */
export const FIT_MAX = 5;

/** Widths of a pill in px, as in ui.css (read from the page): padding and border, icon, gaps. */
export interface PillMetrics {
  /** Padding plus border of a pill, both sides. */
  pad: number;
  icon: number;
  /** Between the icon and the text. */
  iconGap: number;
  /** Between two parts of the text. */
  partGap: number;
  /** Between two pills. */
  gap: number;
  /** A progress bar. */
  bar: number;
}

/** Width of a text part in px (the page measures it with the font of its size). */
export type MeasureText = (text: string, size: Size | undefined) => number;

/** Width of a row of pills, without drawing them. */
export function pillsWidth(pills: Pill[], measure: MeasureText, m: PillMetrics): number {
  let w = 0;
  for (const p of pills) {
    w += m.pad + m.icon + m.iconGap + m.partGap * Math.max(0, p.parts.length - 1);
    for (const part of p.parts) w += 'text' in part ? measure(part.text, part.size) : 'bar' in part ? m.bar : m.icon;
  }
  return w + m.gap * Math.max(0, pills.length - 1);
}

/**
 * The smallest `fit` (0..FIT_MAX) whose pills fit in `room` px on one row, as the 2D bar shortened
 * (names of the materials first, then every name, then the "+N/sem"...); FIT_MAX when none fits.
 */
export function fitPills(pillsAt: (fit: number) => Pill[], room: number, measure: MeasureText, m: PillMetrics): number {
  for (let fit = 0; fit < FIT_MAX; fit++) if (pillsWidth(pillsAt(fit), measure, m) <= room) return fit;
  return FIT_MAX;
}

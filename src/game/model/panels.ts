import {
  announcedCaravan,
  crewCounts,
  staffOf,
  unemployed,
  bandCounts,
  BUILDINGS,
  calendar,
  clanName,
  foodCapacity,
  gatherYield,
  goalProgress,
  GOALS,
  goalTarget,
  HOUSE_LEVELS,
  householdsOf,
  housesByLevel,
  housesWaiting,
  lastsToHarvest,
  RULES,
  seasonOf,
  waitingCouples,
  TEMPLE_STAGES,
  type BuildingKind,
  type Economy,
  type FoodForecast,
  type GameState,
  type WeekRecord,
} from '../../core';
import type { Notice } from '../notices';
import { fmt, fmtInt, signed, T } from '../strings';
import { stageStatus } from './temple';
import type { CardTone } from './card';

/**
 * The panels as data (pure): Objetivos, Avisos and the three tabs of Estatísticas (Agora, Povo,
 * Histórico). Each is a list of sections (lines that stay together in one column); the views lay
 * the sections out in columns that fit their screen.
 */

/** A piece of a panel line. */
export interface PanelPart {
  text: string;
  tone?: CardTone;
  /** A heading (the section's title). */
  big?: boolean;
  small?: boolean;
  plain?: boolean;
  /** An ICONS key drawn before the text (the Temple's stages in Objetivos). */
  icon?: string;
}

/** A small line chart of the last weeks; `limit` is drawn dashed (the food store limit). */
export interface PanelChart {
  values: number[];
  color: 'silver' | 'food' | 'residents' | 'happiness';
  limit?: number[];
}

/** A family of the Povo tab: a tap goes to its house. */
export interface PanelChip {
  label: string;
  houseId: number;
}

/** A panel line: parts in a row, one wrapped text (`wrap`), a chart or wrapping capsules (`chips`). */
export interface PanelLine {
  parts: PanelPart[];
  /** Extra space above (real px). */
  gap?: number;
  wrap?: boolean;
  chart?: PanelChart;
  chips?: PanelChip[];
}
export type PanelSection = PanelLine[];

export type StatsTab = 'now' | 'people' | 'history';
export const STATS_TABS: StatsTab[] = ['now', 'people', 'history'];

const title = (text: string): PanelLine => ({ parts: [{ text, tone: 'gold', big: true }] });
const row = (label: string, value: string, tone: CardTone = 'text'): PanelLine => ({ parts: [{ text: label, tone: 'muted', plain: true }, { text: value, tone }] });
const signTone = (n: number): CardTone => (n < 0 ? 'bad' : n > 0 ? 'good' : 'text');
const note = (text: string, tone: CardTone = 'muted'): PanelLine => ({ parts: [{ text, tone, plain: true, small: true }], wrap: true });

/** Objetivos: every goal (done, current with its progress, next) and the temple savings; the title first. */
export function goalsPanel(s: GameState, phone: boolean): PanelLine[] {
  const N = T.nova;
  const lines: PanelLine[] = [title(N.buttons.goals)];
  GOALS.forEach((g, i) => {
    const done = i < s.goalIndex;
    const cur = i === s.goalIndex;
    const mark = done ? N.goals.done : cur ? N.goals.current : N.goals.next;
    // Phone: the reward and the unlock only on the current goal (the list must fit the short screen).
    const extra = phone && !cur ? '' : [g.victory ? N.goals.victory : N.goals.reward(g.reward), ...(g.unlock ? [N.goals.unlocks(g.unlock)] : [])].join(' · ');
    const shown = cur ? N.goalProgress(g, goalProgress(s, g), goalTarget(s, g)) : null;
    // The Temple's stages stand out: the construction mark, gold, and "etapa 2/5".
    const stage = g.type === 'templeStage';
    lines.push({
      parts: [
        { text: mark, tone: done ? 'good' : cur ? 'gold' : 'muted' },
        { text: `${i + 1}. ${N.goalText(g)}`, tone: done ? 'muted' : stage ? 'gold' : 'text', plain: !cur, ...(stage ? { icon: 'stage' } : {}) },
        ...(stage ? [{ text: N.stage.ofStages(g.stage ?? 0, TEMPLE_STAGES.length), tone: 'muted' as const, small: true, plain: true }] : []),
        ...(shown ? [{ text: shown, tone: 'gold' as const }] : []),
        ...(extra ? [{ text: extra, tone: 'muted' as const, small: true, plain: true }] : []),
      ],
      gap: cur ? 2 : 0,
    });
  });
  const stage = stageStatus(s);
  if (stage) lines.push({ parts: [{ text: stage.text, tone: stage.tone }], gap: 2 });
  return lines;
}

/** The warnings, one wrapped line each (always with the ⚠ mark, never only the color). */
export function noticeLines(list: Notice[]): PanelLine[] {
  if (!list.length) return [{ parts: [{ text: T.nova.noAlerts, tone: 'good' }] }];
  return list.map((n) => ({ parts: [{ text: '⚠ ' + n.text, tone: n.bad ? 'bad' : 'warn' }], wrap: true, gap: 4 }));
}

/** Avisos: the title and the warnings in one column, one under another (a long list scrolls). */
export function alertsPanel(list: Notice[]): PanelSection[] {
  return [[title(T.nova.buttons.alerts), ...noticeLines(list)]];
}

export interface StatsData {
  s: GameState;
  e: Economy;
  forecast: FoodForecast;
  notices: Notice[];
}

export function statsPanel(tab: StatsTab, d: StatsData, phone: boolean): PanelSection[] {
  return tab === 'history' ? statsHistory(d.s) : tab === 'people' ? statsPeople(d.s, phone) : statsNow(d, phone);
}

/** Estatísticas, tab "Agora": silver, food, work, houses, happiness and the problems. */
function statsNow({ s, e, forecast: out, notices }: StatsData, phone: boolean): PanelSection[] {
  const N = T.nova;
  const st = N.stats;
  const per = N.perWeek;
  const kinds = Object.keys(BUILDINGS) as BuildingKind[];
  const silver: PanelSection = [title(st.silver), row(st.taxes, `+${fmt(e.taxes)}${per}`, 'good')];
  const costs = kinds.filter((k) => e.upkeep[k] !== undefined);
  // The upkeep and the balance are a section of their own, so a short screen can move them to the next column.
  const upkeep: PanelSection = [];
  if (costs.length) upkeep.push({ parts: [{ text: st.upkeep, tone: 'muted', plain: true }] });
  for (const k of costs) upkeep.push(row('  ' + BUILDINGS[k].name, `−${fmt(e.upkeep[k]!)}${per}`, 'bad'));
  upkeep.push(row(st.balance, `${signed(e.silverDelta)}${per}`, signTone(e.silverDelta)));
  // The game's difficulty (plano-dificuldade F), small under the silver.
  upkeep.push({ parts: [{ text: T.difficulty.played(s.difficulty), tone: 'muted', plain: true }] });

  // Food: what comes in by source (harvest, fishing, gathering), what is eaten, the stock and the forecast.
  const crews = crewCounts(s);
  const gathered = (kind: BuildingKind) => s.buildings.reduce((n, b) => n + (b.kind === kind ? gatherYield(s, b) * staffOf(b, crews) : 0), 0);
  const lasts = lastsToHarvest(s, out);
  const when = lasts ? st.toHarvest : out!.season === seasonOf(s.week) && out!.weeks < RULES.weeksPerSeason ? st.weeks(out!.weeks) : `${st.weeks(out!.weeks)} · ${N.foodEnds[out!.season]}`;
  const food: PanelSection = [title(st.food)];
  if (e.harvest > 0) food.push(row(BUILDINGS.field.name, `+${fmt(e.harvest)}${per}`, 'good'));
  for (const k of ['fisher', 'gatherer'] as const) {
    const n = gathered(k);
    if (n > 0) food.push(row(BUILDINGS[k].name, `+${fmt(n)}${per}`, 'good'));
  }
  food.push(
    row(st.eaten, `−${fmt(e.foodEaten)}${per}`, 'bad'),
    row(st.balance, `${signed(e.foodDelta)}${per}`, signTone(e.foodDelta)),
    row(st.stock, N.stock(Math.floor(s.food), foodCapacity(s)), s.spoiled > 0 ? 'warn' : 'text'),
    row(st.forecast, when, lasts ? 'good' : 'bad'),
  );
  // Materials: stock and what comes in a week, the houses waiting for each, the stumps left by the lumbers.
  const waiting = housesWaiting(s);
  const mats: PanelSection = [title(st.materials)];
  for (const m of ['wood', 'stone'] as const) {
    if (m === 'stone' && !s.unlocked.includes('quarry') && s.stone <= 0) continue;
    mats.push(row(N.material[m], st.materialRow(Math.floor(s[m]), `+${fmt(e[m])}${per}`), waiting[m] ? 'bad' : 'text'));
    if (waiting[m]) mats.push(row(st.waiting(m), `⚠ ${waiting[m]}`, 'bad'));
  }
  if (s.stumps.length) mats.push(row(st.stumps, fmtInt(s.stumps.length)));
  // Jobs of the year (a frozen field keeps its farmers), who has none, and the jobs nobody took.
  const idle = unemployed(s);
  const free = Math.max(0, e.yearJobs - (e.workers - idle));
  const work: PanelSection = [
    title(st.work),
    row(st.workers, fmtInt(e.workers)),
    row(st.jobs, fmtInt(e.yearJobs)),
    row(st.idle, fmtInt(idle), idle > 0 ? 'warn' : 'text'),
    row(st.freeJobs, fmtInt(free), free > 0 ? 'warn' : 'text'),
  ];
  const byLevel = housesByLevel(s);
  const houses: PanelSection = [title(st.houses), ...HOUSE_LEVELS.map((l, i) => row(l.name, fmtInt(byLevel[i])))];
  const joy: PanelSection = [
    title(st.happiness),
    row(st.happiness, String(e.happiness)),
    row(T.mood.happy, fmtInt(e.moods.happy), 'good'),
    row(T.mood.neutral, fmtInt(e.moods.neutral)),
    row(T.mood.sad, fmtInt(e.moods.sad), e.moods.sad ? 'bad' : 'text'),
    note(st.why),
  ];
  const all: PanelSection[] = [silver, upkeep, food, mats, work, houses, joy];
  // Phone: the problems are left to the Avisos button (no room for them here).
  if (!phone) all.push([title(st.problems), ...(notices.length ? noticeLines(notices) : [row('', st.none, 'good')])]);
  return all;
}

/** Estatísticas, tab "Povo": the people by age, this year's births, deaths and weddings, couples waiting, the next caravan and the families. */
function statsPeople(s: GameState, phone: boolean): PanelSection[] {
  const st = T.nova.stats;
  const bands = bandCounts(s);
  const y = s.yearStats;
  // Label and number pairs on one line each, so the numbers, the caravan and the families fit a phone.
  const pairs = (list: [string, number][]): PanelLine => ({ parts: list.flatMap(([label, n]) => [{ text: label, tone: 'muted' as const, plain: true }, { text: fmtInt(n) }]) });
  const yearRows: [string, number][] = [[st.births, y.births], [st.deaths, y.deaths]];
  if (y.coldDeaths) yearRows.push([st.coldDeaths, y.coldDeaths]);
  yearRows.push([st.weddings, y.weddings]);
  const couples = waitingCouples(s);
  const caravan = announcedCaravan(s);
  const at = caravan && calendar(caravan.week);
  const out: PanelSection[] = [
    [
      title(st.people),
      pairs((['child', 'adult', 'elder'] as const).map((b) => [st.bands[b], bands[b]])),
      { parts: [{ text: st.workLine(bands.adult - unemployed(s), bands.adult, unemployed(s)), tone: unemployed(s) ? 'warn' : 'text', plain: true }] },
      title(st.thisYear),
      pairs(yearRows),
      row(st.couples, fmtInt(couples.length), couples.length ? 'warn' : 'text'),
      // Phone: the names are in Avisos (no room here).
      ...(couples.length && !phone ? [note(couples.map((c) => `${c.man.name} e ${c.woman.name}`).join(' · '))] : []),
      title(st.caravan),
      { parts: [{ text: at ? st.caravanAt(at.season, at.year, caravan.families) : st.noCaravan, tone: at ? 'text' : 'muted', plain: !at }] },
    ],
  ];
  const all = householdsOf(s);
  const max = phone ? 6 : 12;
  const fams: PanelLine[] = [title(st.families)];
  if (!all.length) fams.push(note(st.noFamilies));
  else fams.push({ parts: [], chips: all.slice(0, max).map((f) => ({ label: st.family(clanName(f.clan), f.people), houseId: f.house.id })) });
  if (all.length > max) fams.push(note(st.moreFamilies(all.length - max)));
  out.push(fams);
  return out;
}

/** Estatísticas, tab "Histórico": a chart per number over the last weeks, then the milestones. */
function statsHistory(s: GameState): PanelSection[] {
  const st = T.nova.stats;
  const h = s.history;
  const last = (f: (r: WeekRecord) => number) => (h.length ? f(h[h.length - 1]) : 0);
  const chart = (name: string, value: string, values: number[], color: PanelChart['color'], limit?: number[]): PanelSection => [
    { parts: [{ text: name, tone: 'gold' }, { text: value }] },
    { parts: [], chart: { values, color, limit } },
  ];
  const out: PanelSection[] = [];
  if (h.length < 2) out.push([title(T.nova.tabs.history), note(st.noHistory)]);
  else {
    out.push([title(T.nova.tabs.history), note(st.lastWeeks(h.length))]);
    out.push(chart(st.silver, fmtInt(last((r) => r.silver)), h.map((r) => r.silver), 'silver'));
    out.push([
      ...chart(st.food, T.nova.stock(Math.floor(last((r) => r.food)), last((r) => r.capacity)), h.map((r) => r.food), 'food', h.map((r) => r.capacity)),
      note(`- - ${st.capacity}`),
    ]);
    out.push(chart(st.residents, fmtInt(last((r) => r.residents)), h.map((r) => r.residents), 'residents'));
    out.push(chart(st.happiness, String(Math.round(last((r) => r.happiness))), h.map((r) => r.happiness), 'happiness'));
  }
  const marks: PanelLine[] = [title(st.milestones)];
  if (!s.milestones.length) marks.push(note(st.noMilestones));
  for (const id of s.milestones) {
    const w = s.milestoneWeeks[id];
    const c = w === undefined ? null : calendar(w);
    marks.push({ parts: [{ text: '★', tone: 'gold' }, { text: c ? st.milestoneAt(T.milestoneName[id], T.nova.calendar(c.season, c.year, c.week, true)) : T.milestoneName[id], plain: true }] });
  }
  out.push(marks);
  return out;
}

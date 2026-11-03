/** Runs one seeded game with a bot and records the balance metrics. No Phaser, only src/core. */
import {
  GOALS,
  RULES,
  computeEconomy,
  createGame,
  createRng,
  stepWeek,
  templeSpots,
  unemploymentAlert,
  type GameState,
} from '../../src/core';
import { Bot, type BotProfile, type BotStats } from './bots';

export interface Sample {
  week: number;
  silver: number;
  food: number;
  residents: number;
  efficiency: number;
  silverDelta: number;
  foodDelta: number;
  unemployed: number;
}

export interface RunResult {
  bot: string;
  seed: number;
  won: boolean;
  lost: boolean;
  /** Week of victory or defeat, or the week limit. */
  weeks: number;
  /** Week each goal was completed (index = goal), null if never. */
  goalWeeks: (number | null)[];
  minSilver: number;
  /** Highest silver before the temple was unlocked (nothing big to save for yet). */
  maxSilverBeforeTemple: number;
  /** Weeks before the temple unlock with silver above the idle threshold. */
  idleSilverWeeks: number;
  /** Weeks (before victory) whose weekly balance was negative. */
  negBalanceWeeks: number;
  /** Weeks (before victory) that ended with silver below 0, and the longest such run. */
  debtWeeks: number;
  longestDebt: number;
  debtEpisodes: number;
  /** Weeks (before victory) really short of silver: in debt, or a deficit the silver would not carry for a year. */
  tightWeeks: number;
  /** Weeks after the victory that were played (up to --after) and whether the city was lost then. */
  afterWeeks: number;
  lostAfterWin: boolean;
  /** Weeks after the victory with silver below 0, and the lowest silver then. */
  afterDebtWeeks: number;
  afterMinSilver: number;
  /** Demolitions made by the bot to cut upkeep. */
  trimmed: number;
  famineWeeks: number;
  famineEpisodes: number;
  longestFamine: number;
  endedInFamine: boolean;
  peakResidents: number;
  alertWeeks: number;
  /** Longest run of weeks where the bot wanted to act but had nothing useful (temple saving excluded). */
  longestDead: number;
  /** Longest run of weeks spent only saving for the temple. */
  longestSaving: number;
  templeSpotAtUnlock: boolean | null;
  /** Weeks from the temple unlock until a valid temple spot existed. */
  weeksToTempleSpot: number | null;
  stats: BotStats;
  samples: Sample[];
}

/**
 * Defeat hook for the next package (debt/defeat): any of these state flags ends the run as lost.
 * Kept loose so the runner works before and after the rule exists.
 */
export function isDefeated(s: GameState): boolean {
  const any = s as unknown as Record<string, unknown>;
  return Boolean(any.lost ?? any.defeated ?? any.gameOver);
}

/** Silver above this, before the temple unlock, counts as idle (more than the dearest regular building x 3). */
export const IDLE_SILVER = 120;

/**
 * Plays until victory, defeat or maxWeeks; after a victory keeps playing `after` more weeks
 * (upkeep still applies) to check the city survives.
 */
export function runGame(profile: BotProfile, seed: number, maxWeeks = 2000, sampleEvery = 3, after = 24): RunResult {
  const gameRng = createRng(seed);
  const s = createGame(gameRng);
  const bot = new Bot(s, profile, createRng(seed * 7919 + 13));
  const r: RunResult = {
    bot: profile.name,
    seed,
    won: false,
    lost: false,
    weeks: maxWeeks,
    goalWeeks: GOALS.map(() => null),
    minSilver: s.silver,
    maxSilverBeforeTemple: s.silver,
    idleSilverWeeks: 0,
    negBalanceWeeks: 0,
    debtWeeks: 0,
    longestDebt: 0,
    debtEpisodes: 0,
    tightWeeks: 0,
    afterWeeks: 0,
    lostAfterWin: false,
    afterDebtWeeks: 0,
    afterMinSilver: Infinity,
    trimmed: 0,
    famineWeeks: 0,
    famineEpisodes: 0,
    longestFamine: 0,
    endedInFamine: false,
    peakResidents: 0,
    alertWeeks: 0,
    longestDead: 0,
    longestSaving: 0,
    templeSpotAtUnlock: null,
    weeksToTempleSpot: null,
    stats: bot.stats,
    samples: [],
  };
  let famineRun = 0;
  let deadRun = 0;
  let savingRun = 0;
  let templeUnlockWeek: number | null = null;
  let debtRun = 0;

  while (s.week < maxWeeks) {
    if (r.won) {
      // Victory reached: keep playing to see whether the city holds.
      bot.act(s);
      stepWeek(s, gameRng);
      r.afterWeeks++;
      r.afterMinSilver = Math.min(r.afterMinSilver, s.silver);
      if (s.silver < 0) r.afterDebtWeeks++;
      if (isDefeated(s)) {
        r.lostAfterWin = true;
        break;
      }
      if (r.afterWeeks >= after) break;
      continue;
    }
    if (templeUnlockWeek !== null && r.weeksToTempleSpot === null && templeSpots(s).length > 0) {
      r.weeksToTempleSpot = s.week - templeUnlockWeek;
    }
    bot.act(s);
    deadRun = bot.lastWeek === 'dead' ? deadRun + 1 : 0;
    savingRun = bot.lastWeek === 'saving' ? savingRun + 1 : 0;
    r.longestDead = Math.max(r.longestDead, deadRun);
    r.longestSaving = Math.max(r.longestSaving, savingRun);

    const goalBefore = s.goalIndex;
    const events = stepWeek(s, gameRng);
    for (let g = goalBefore; g < s.goalIndex; g++) r.goalWeeks[g] = s.week;

    const eco = computeEconomy(s);
    r.minSilver = Math.min(r.minSilver, s.silver);
    r.peakResidents = Math.max(r.peakResidents, eco.residents);
    if (eco.silverDelta < 0) r.negBalanceWeeks++;
    if (s.silver < 0 || s.silver + eco.silverDelta * 12 < 0) r.tightWeeks++;
    if (s.silver < 0) {
      r.debtWeeks++;
      if (debtRun === 0) r.debtEpisodes++;
      debtRun++;
      r.longestDebt = Math.max(r.longestDebt, debtRun);
    } else debtRun = 0;
    if (unemploymentAlert(s) > 0) r.alertWeeks++;
    if (s.famine) {
      r.famineWeeks++;
      if (famineRun === 0) r.famineEpisodes++;
      famineRun++;
      r.longestFamine = Math.max(r.longestFamine, famineRun);
    } else famineRun = 0;

    const templeOpen = s.unlocked.includes('temple');
    if (!templeOpen) {
      r.maxSilverBeforeTemple = Math.max(r.maxSilverBeforeTemple, s.silver);
      if (s.silver > IDLE_SILVER) r.idleSilverWeeks++;
    } else if (templeUnlockWeek === null) {
      templeUnlockWeek = s.week;
      r.templeSpotAtUnlock = templeSpots(s).length > 0;
      if (r.templeSpotAtUnlock) r.weeksToTempleSpot = 0;
    }

    if (s.week % sampleEvery === 0) {
      r.samples.push({ week: s.week, silver: s.silver, food: s.food, residents: eco.residents, efficiency: eco.efficiency, silverDelta: eco.silverDelta, foodDelta: eco.foodDelta, unemployed: Math.max(0, eco.workers - eco.jobs) });
    }
    if (events.some((e) => e.type === 'victory') || s.won) {
      r.won = true;
      r.weeks = s.week;
      r.endedInFamine = s.famine;
      if (after > 0) continue;
      break;
    }
    if (isDefeated(s)) {
      r.lost = true;
      r.weeks = s.week;
      break;
    }
  }
  if (!r.won) r.endedInFamine = s.famine;
  if (r.afterMinSilver === Infinity) r.afterMinSilver = NaN;
  r.trimmed = bot.stats.trimmed ?? 0;
  if (r.won && templeUnlockWeek !== null && r.weeksToTempleSpot === null) r.weeksToTempleSpot = r.weeks - templeUnlockWeek;
  return r;
}

/** Real minutes at 1x for a week count. */
export const minutes = (weeks: number) => (weeks * RULES.weekSeconds) / 60;

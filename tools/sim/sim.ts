/** Runs one seeded game with a bot and records the balance metrics. No Phaser, only src/core. */
import {
  GOALS,
  RULES,
  computeEconomy,
  createGame,
  createRng,
  stepMonth,
  templeSpots,
  unemploymentAlert,
  type GameState,
} from '../../src/core';
import { Bot, type BotProfile, type BotStats } from './bots';

export interface Sample {
  month: number;
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
  /** Month of victory or defeat, or the month limit. */
  months: number;
  /** Month each goal was completed (index = goal), null if never. */
  goalMonths: (number | null)[];
  minSilver: number;
  /** Highest silver before the temple was unlocked (nothing big to save for yet). */
  maxSilverBeforeTemple: number;
  /** Months before the temple unlock with silver above the idle threshold. */
  idleSilverMonths: number;
  /** Months (before victory) whose monthly balance was negative. */
  negBalanceMonths: number;
  /** Months (before victory) that ended with silver below 0, and the longest such run. */
  debtMonths: number;
  longestDebt: number;
  debtEpisodes: number;
  /** Months (before victory) really short of silver: in debt, or a deficit the silver would not carry for a year. */
  tightMonths: number;
  /** Months after the victory that were played (up to --after) and whether the city was lost then. */
  afterMonths: number;
  lostAfterWin: boolean;
  /** Months after the victory with silver below 0, and the lowest silver then. */
  afterDebtMonths: number;
  afterMinSilver: number;
  /** Demolitions made by the bot to cut upkeep. */
  trimmed: number;
  famineMonths: number;
  famineEpisodes: number;
  longestFamine: number;
  endedInFamine: boolean;
  peakResidents: number;
  alertMonths: number;
  /** Longest run of months where the bot wanted to act but had nothing useful (temple saving excluded). */
  longestDead: number;
  /** Longest run of months spent only saving for the temple. */
  longestSaving: number;
  templeSpotAtUnlock: boolean | null;
  /** Months from the temple unlock until a valid temple spot existed. */
  monthsToTempleSpot: number | null;
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
 * Plays until victory, defeat or maxMonths; after a victory keeps playing `after` more months
 * (upkeep still applies) to check the city survives.
 */
export function runGame(profile: BotProfile, seed: number, maxMonths = 2000, sampleEvery = 3, after = 24): RunResult {
  const gameRng = createRng(seed);
  const s = createGame(gameRng);
  const bot = new Bot(s, profile, createRng(seed * 7919 + 13));
  const r: RunResult = {
    bot: profile.name,
    seed,
    won: false,
    lost: false,
    months: maxMonths,
    goalMonths: GOALS.map(() => null),
    minSilver: s.silver,
    maxSilverBeforeTemple: s.silver,
    idleSilverMonths: 0,
    negBalanceMonths: 0,
    debtMonths: 0,
    longestDebt: 0,
    debtEpisodes: 0,
    tightMonths: 0,
    afterMonths: 0,
    lostAfterWin: false,
    afterDebtMonths: 0,
    afterMinSilver: Infinity,
    trimmed: 0,
    famineMonths: 0,
    famineEpisodes: 0,
    longestFamine: 0,
    endedInFamine: false,
    peakResidents: 0,
    alertMonths: 0,
    longestDead: 0,
    longestSaving: 0,
    templeSpotAtUnlock: null,
    monthsToTempleSpot: null,
    stats: bot.stats,
    samples: [],
  };
  let famineRun = 0;
  let deadRun = 0;
  let savingRun = 0;
  let templeUnlockMonth: number | null = null;
  let debtRun = 0;

  while (s.month < maxMonths) {
    if (r.won) {
      // Victory reached: keep playing to see whether the city holds.
      bot.act(s);
      stepMonth(s, gameRng);
      r.afterMonths++;
      r.afterMinSilver = Math.min(r.afterMinSilver, s.silver);
      if (s.silver < 0) r.afterDebtMonths++;
      if (isDefeated(s)) {
        r.lostAfterWin = true;
        break;
      }
      if (r.afterMonths >= after) break;
      continue;
    }
    if (templeUnlockMonth !== null && r.monthsToTempleSpot === null && templeSpots(s).length > 0) {
      r.monthsToTempleSpot = s.month - templeUnlockMonth;
    }
    bot.act(s);
    deadRun = bot.lastMonth === 'dead' ? deadRun + 1 : 0;
    savingRun = bot.lastMonth === 'saving' ? savingRun + 1 : 0;
    r.longestDead = Math.max(r.longestDead, deadRun);
    r.longestSaving = Math.max(r.longestSaving, savingRun);

    const goalBefore = s.goalIndex;
    const events = stepMonth(s, gameRng);
    for (let g = goalBefore; g < s.goalIndex; g++) r.goalMonths[g] = s.month;

    const eco = computeEconomy(s);
    r.minSilver = Math.min(r.minSilver, s.silver);
    r.peakResidents = Math.max(r.peakResidents, eco.residents);
    if (eco.silverDelta < 0) r.negBalanceMonths++;
    if (s.silver < 0 || s.silver + eco.silverDelta * 12 < 0) r.tightMonths++;
    if (s.silver < 0) {
      r.debtMonths++;
      if (debtRun === 0) r.debtEpisodes++;
      debtRun++;
      r.longestDebt = Math.max(r.longestDebt, debtRun);
    } else debtRun = 0;
    if (unemploymentAlert(s) > 0) r.alertMonths++;
    if (s.famine) {
      r.famineMonths++;
      if (famineRun === 0) r.famineEpisodes++;
      famineRun++;
      r.longestFamine = Math.max(r.longestFamine, famineRun);
    } else famineRun = 0;

    const templeOpen = s.unlocked.includes('temple');
    if (!templeOpen) {
      r.maxSilverBeforeTemple = Math.max(r.maxSilverBeforeTemple, s.silver);
      if (s.silver > IDLE_SILVER) r.idleSilverMonths++;
    } else if (templeUnlockMonth === null) {
      templeUnlockMonth = s.month;
      r.templeSpotAtUnlock = templeSpots(s).length > 0;
      if (r.templeSpotAtUnlock) r.monthsToTempleSpot = 0;
    }

    if (s.month % sampleEvery === 0) {
      r.samples.push({ month: s.month, silver: s.silver, food: s.food, residents: eco.residents, efficiency: eco.efficiency, silverDelta: eco.silverDelta, foodDelta: eco.foodDelta, unemployed: Math.max(0, eco.workers - eco.jobs) });
    }
    if (events.some((e) => e.type === 'victory') || s.won) {
      r.won = true;
      r.months = s.month;
      r.endedInFamine = s.famine;
      if (after > 0) continue;
      break;
    }
    if (isDefeated(s)) {
      r.lost = true;
      r.months = s.month;
      break;
    }
  }
  if (!r.won) r.endedInFamine = s.famine;
  if (r.afterMinSilver === Infinity) r.afterMinSilver = NaN;
  r.trimmed = bot.stats.trimmed ?? 0;
  if (r.won && templeUnlockMonth !== null && r.monthsToTempleSpot === null) r.monthsToTempleSpot = r.months - templeUnlockMonth;
  return r;
}

/** Real minutes at 1x for a month count. */
export const minutes = (months: number) => (months * RULES.monthSeconds) / 60;

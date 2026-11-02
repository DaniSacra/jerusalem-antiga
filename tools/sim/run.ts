/**
 * Headless balance simulation. Usage (see docs/TESTING.md):
 *   npm run sim                         # all bots, 20 seeds each
 *   npm run sim -- --bots comum --seeds 5 --months 2000
 *   npm run sim -- --csv out-dir        # also writes per-run curves (silver, food, residents, efficiency)
 *   npm run sim -- --json               # raw results as JSON
 *   npm run sim -- --after 48           # months played on after a victory (default 24, 0 = stop)
 *   npm run sim -- --set buildings.temple.cost=1200 --set rules.familyChance=0.25 --drop-goal 4
 *        # tries balance numbers in memory only (src/data is not touched); --drop-goal is 1-based
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GOALS } from '../../src/core';
import { BOTS } from './bots';
import { applyOverrides } from './overrides';
import { minutes, runGame, type RunResult } from './sim';

const args = process.argv.slice(2);
const opt = (name: string, def: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const flag = (name: string) => args.includes(`--${name}`);

const botNames = opt('bots', Object.keys(BOTS).join(',')).split(',');
const seeds = Number(opt('seeds', '20'));
const firstSeed = Number(opt('seed0', '1'));
const maxMonths = Number(opt('months', '2000'));
const csvDir = opt('csv', '');
const after = Number(opt('after', '24'));

const overrides = applyOverrides(args);
if (overrides.length) console.error(`overrides: ${overrides.join(' ')}`);

const median = (v: number[]) => {
  if (!v.length) return NaN;
  const a = [...v].sort((x, y) => x - y);
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
};
const fmt = (n: number, d = 0) => (Number.isFinite(n) ? n.toFixed(d) : '-');
const range = (v: number[]) => (v.length ? `${fmt(Math.min(...v))}-${fmt(Math.max(...v))}` : '-');

function summarize(name: string, runs: RunResult[]) {
  const won = runs.filter((r) => r.won);
  console.log(`\n=== ${name}: ${won.length}/${runs.length} won, ${runs.filter((r) => r.lost).length} lost, ${runs.length - won.length - runs.filter((r) => r.lost).length} unfinished`);
  console.log('goal                                          | done | month med (min-max) | min@1x med | goal took (min, med)');
  let prev: number[] = runs.map(() => 0);
  GOALS.forEach((g, i) => {
    const m = runs.map((r) => r.goalMonths[i]);
    const done = m.filter((x): x is number => x !== null);
    const took = runs.map((r, k) => (r.goalMonths[i] !== null ? r.goalMonths[i]! - prev[k] : null)).filter((x): x is number => x !== null);
    prev = runs.map((r, k) => r.goalMonths[i] ?? prev[k]);
    console.log(
      `${String(i + 1).padStart(2)} ${g.text.padEnd(43).slice(0, 43)} | ${String(done.length).padStart(4)} | ${fmt(median(done)).padStart(5)} (${range(done).padEnd(9)}) | ${fmt(minutes(median(done)), 1).padStart(10)} | ${fmt(minutes(median(took)), 2)}`,
    );
  });
  const per = (f: (r: RunResult) => number) => `${fmt(median(runs.map(f)), 0)} (${range(runs.map(f))})`;
  console.log(`months to win     ${won.length ? `${fmt(median(won.map((r) => r.months)))} (${range(won.map((r) => r.months))}) = ${fmt(minutes(median(won.map((r) => r.months))), 1)} min at 1x` : 'never'}`);
  console.log(`min silver        ${per((r) => r.minSilver)}`);
  console.log(`max silver <temple ${per((r) => r.maxSilverBeforeTemple)}   idle-silver months (> 120, before temple) ${per((r) => r.idleSilverMonths)}`);
  console.log(`neg balance months ${per((r) => r.negBalanceMonths)}   runs with any ${runs.filter((r) => r.negBalanceMonths > 0).length}`);
  console.log(`debt months       ${per((r) => r.debtMonths)}   episodes ${per((r) => r.debtEpisodes)}   longest ${per((r) => r.longestDebt)}   runs in debt ${runs.filter((r) => r.debtMonths > 0).length}   upkeep cuts ${per((r) => r.trimmed)}`);
  console.log(`tight months      ${per((r) => r.tightMonths)}   runs with any ${runs.filter((r) => r.tightMonths > 0).length}   (in debt, or deficit x 12 > silver)`);
  if (after > 0 && won.length) {
    console.log(`after victory     ${after} months: lost ${won.filter((r) => r.lostAfterWin).length}/${won.length}   in debt ${won.filter((r) => r.afterDebtMonths > 0).length}/${won.length}   min silver ${fmt(median(won.map((r) => r.afterMinSilver)))} (${range(won.map((r) => r.afterMinSilver))})`);
  }
  console.log(`famine months     ${per((r) => r.famineMonths)}   episodes ${per((r) => r.famineEpisodes)}   longest ${per((r) => r.longestFamine)}   ended in famine ${runs.filter((r) => r.endedInFamine).length}`);
  console.log(`peak residents    ${per((r) => r.peakResidents)}`);
  console.log(`alert months      ${per((r) => r.alertMonths)}`);
  console.log(`longest dead run  ${per((r) => r.longestDead)}   longest saving run ${per((r) => r.longestSaving)}`);
  const spot = runs.filter((r) => r.templeSpotAtUnlock !== null);
  console.log(`temple spot at unlock ${spot.filter((r) => r.templeSpotAtUnlock).length}/${spot.length}   months to a spot ${per((r) => r.monthsToTempleSpot ?? NaN)}`);
  console.log(`actions           ${per((r) => r.stats.actions)}`);
  const kinds = [...new Set(runs.flatMap((r) => Object.keys(r.stats.spent)))];
  console.log(`spent (median)    ${kinds.map((k) => `${k} ${fmt(median(runs.map((r) => r.stats.spent[k] ?? 0)))}`).join(', ')}`);
}

const all: RunResult[] = [];
for (const name of botNames) {
  const profile = BOTS[name];
  if (!profile) throw new Error(`unknown bot "${name}" (have: ${Object.keys(BOTS).join(', ')})`);
  const runs: RunResult[] = [];
  for (let k = 0; k < seeds; k++) runs.push(runGame(profile, firstSeed + k, maxMonths, 3, after));
  all.push(...runs);
  if (!flag('json')) summarize(name, runs);
  if (csvDir) {
    mkdirSync(csvDir, { recursive: true });
    for (const r of runs) {
      const rows = ['month,silver,food,residents,efficiency,silverDelta,foodDelta,unemployed', ...r.samples.map((x) => [x.month, x.silver, x.food, x.residents, x.efficiency.toFixed(2), x.silverDelta, x.foodDelta, x.unemployed].join(','))];
      writeFileSync(join(csvDir, `${name}-${r.seed}.csv`), rows.join('\n'));
    }
  }
}
if (flag('json')) console.log(JSON.stringify(all.map(({ samples: _s, ...r }) => r), null, 1));

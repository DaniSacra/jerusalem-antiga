/**
 * Headless balance simulation with the survival bots (see docs/TESTING.md):
 *   npm run sim                                  # all bots, 20 seeds each
 *   npm run sim -- --bots comum --seeds 100      # one bot, more seeds
 *   npm run sim -- --brief | --json | --rows     # one line per bot, raw results, one line per run
 *   npm run sim -- --trace comum:1:80            # week by week of one game (bot:seed:weeks)
 *   npm run sim -- --set rules.workerShare=0.5 --drop-goal 4
 *        # tries balance numbers in memory only (src/data is not touched); --drop-goal is 1-based
 */
import {
  computeEconomy,
  createGame,
  createRng,
  familyBlock,
  foodCapacity,
  foodForecast,
  GOALS,
  RULES,
  seasonOf,
  stepWeek,
} from '../../src/core';
import { applyOverrides } from './overrides';
import { PROFILES, run, SurvivalBot, type Result } from './survival';

const args = process.argv.slice(2);
const opt = (n: string, d: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const ov = applyOverrides(args);
const bots = opt('bots', Object.keys(PROFILES).join(',')).split(',');
const seeds = Number(opt('seeds', '20'));
const maxWeeks = Number(opt('weeks', '1000'));
const med = (v: number[]) => { const a = v.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) / 2)] : NaN; };
const f = (n: number, d = 0) => (Number.isFinite(n) ? n.toFixed(d) : '-');
const mins = (w: number) => (w * RULES.weekSeconds) / 60;
if (ov.length) console.log('overrides', ov.join(' '));
const all: Result[] = [];
for (const name of bots) {
  const rs: Result[] = [];
  for (let k = 1; k <= seeds; k++) rs.push(run(PROFILES[name], k, maxWeeks));
  all.push(...rs);
  if (args.includes('--json')) continue;
  const n = rs.length;
  if (args.includes('--brief')) {
    const won = rs.filter((r) => r.won);
    const goals = rs.map((r) => r.goalWeeks.filter((x) => x !== null).length);
    const g = (i: number) => f(med(rs.map((r) => r.goalWeeks[i] ?? NaN)));
    console.log(`${name.padEnd(9)} Y1 ${rs.filter((r) => r.year1).length}/${n} empt ${rs.filter((r) => r.emptied).length} debt ${rs.filter((r) => r.lost).length} won ${won.length} dY1 ${rs.filter((r) => r.debtY1).length} dY2 ${rs.filter((r) => r.debtY2).length} wait>52 ${rs.filter((r) => r.goalWait > 52).length} winwk ${f(med(won.map((r) => r.weeks)))} | res52 ${f(med(rs.map((r) => r.residents52)))} res104 ${f(med(rs.map((r) => r.residents104)))} peak ${f(med(rs.map((r) => r.peak)))} | famY1 ${f(med(rs.map((r) => r.famineY1)))} left ${f(med(rs.map((r) => r.left)))} | goals med ${f(med(goals))} | g4 ${g(3)} g5 ${g(4)} g6 ${g(5)} g9 ${g(8)} g10 ${g(9)}`);
    continue;
  }
  const won = rs.filter((r) => r.won);
  console.log(`\n=== ${name}  (${n} seeds)`);
  console.log(`year 1 survived ${rs.filter((r) => r.year1).length}/${n} | emptied ever ${rs.filter((r) => r.emptied).length} | lost (debt) ${rs.filter((r) => r.lost).length} | won ${won.length} | unfinished ${n - won.length - rs.filter((r) => r.lost).length}`);
  console.log(`residents w52 med ${f(med(rs.map((r) => r.residents52)))}  w104 ${f(med(rs.map((r) => r.residents104)))}  lowest Y1 med ${f(med(rs.map((r) => r.lowestResidentsY1)))}  peak ${f(med(rs.map((r) => r.peak)))}`);
  console.log(`famine Y1 weeks med ${f(med(rs.map((r) => r.famineY1)))} (runs with any ${rs.filter((r) => r.famineY1 > 0).length})  total med ${f(med(rs.map((r) => r.famineWeeks)))}  longest med ${f(med(rs.map((r) => r.longestFamine)))}  tents left med ${f(med(rs.map((r) => r.left)))} winter1 ${f(med(rs.map((r) => r.leftWinter1)))}`);
  console.log(`first field wk med ${f(med(rs.map((r) => r.firstFieldWeek ?? NaN)))}  first harvest wk med ${f(med(rs.map((r) => r.firstHarvestWeek ?? NaN)))} (none ${rs.filter((r) => r.firstHarvestWeek === null).length})  first granary wk med ${f(med(rs.map((r) => r.firstGranaryWeek ?? NaN)))} (none ${rs.filter((r) => r.firstGranaryWeek === null).length})`);
  const tot = (k: keyof Result['food']) => rs.reduce((a, r) => a + r.food[k], 0);
  const made = tot('field') + tot('fisher') + tot('gatherer');
  console.log(`food made share: field ${f((100 * tot('field')) / made)}%  fisher ${f((100 * tot('fisher')) / made)}%  gatherer ${f((100 * tot('gatherer')) / made)}%  spoiled = ${f((100 * tot('spoiled')) / made)}% of made`);
  const bsum: Record<string, number> = {}; const b1: Record<string, number> = {};
  for (const r of rs) { for (const [k, v] of Object.entries(r.blocks)) bsum[k] = (bsum[k] ?? 0) + v; for (const [k, v] of Object.entries(r.blocksY1)) b1[k] = (b1[k] ?? 0) + v; }
  const pct = (o: Record<string, number>) => { const t = Object.values(o).reduce((a, v) => a + v, 0); return Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${f((100 * v) / t)}%`).join(', '); };
  console.log(`family block Y1: ${pct(b1)}`);
  console.log(`family block all: ${pct(bsum)}`);
  console.log(`silver below 0: Y1 ${rs.filter((r) => r.debtY1).length}/${n}  Y2 ${rs.filter((r) => r.debtY2).length}/${n}  ever ${rs.filter((r) => r.debtEver).length}/${n} | longest wait on one goal med ${f(med(rs.map((r) => r.goalWait)))} max ${f(Math.max(...rs.map((r) => r.goalWait)))}  runs > 52 wk ${rs.filter((r) => r.goalWait > 52).length} (goals ${[...new Set(rs.filter((r) => r.goalWait > 52).map((r) => r.goalWaitIndex + 1))].sort((x, y) => x - y).join(',') || '-'})`);
  for (const fam of [...new Set(rs.map((r) => r.families0))].sort()) {
    const c = rs.filter((r) => r.families0 === fam);
    console.log(`caravan ${fam} families: ${c.length} runs | Y1 ${c.filter((r) => r.year1).length}/${c.length}  famine Y1 med ${f(med(c.map((r) => r.famineY1)))}  debt Y1 ${c.filter((r) => r.debtY1).length}  lost ${c.filter((r) => r.lost).length}  won ${c.filter((r) => r.won).length}  win wk med ${f(med(c.filter((r) => r.won).map((r) => r.weeks)))}  res52 med ${f(med(c.map((r) => r.residents52)))}`);
  }
  console.log(`drought years med ${f(med(rs.map((r) => r.droughtYears)))}  famine weeks in dry years med ${f(med(rs.map((r) => r.famineAfterDrought)))}`);
  console.log('goal                                  done  week med (min-max)  min@1x');
  GOALS.forEach((g, i) => {
    const d = rs.map((r) => r.goalWeeks[i]).filter((x): x is number => x !== null);
    console.log(`${String(i + 1).padStart(2)} ${g.text.padEnd(36).slice(0, 36)} ${String(d.length).padStart(3)}  ${f(med(d)).padStart(5)} (${d.length ? Math.min(...d) + '-' + Math.max(...d) : '-'})  ${f(mins(med(d)), 1)}`);
  });
  console.log(`win weeks med ${f(med(won.map((r) => r.weeks)))} = ${f(mins(med(won.map((r) => r.weeks))), 1)} min`);
  const kinds = [...new Set(rs.flatMap((r) => Object.keys(r.built)))];
  console.log(`built med: ${kinds.map((k) => `${k} ${f(med(rs.map((r) => r.built[k] ?? 0)))}`).join(', ')}`);
}
if (args.includes('--json')) console.log(JSON.stringify(all));
if (args.includes('--rows')) for (const r of all) console.log([r.bot, r.seed, r.families0, r.foodWeeks0, r.riverDist, r.year1 ? 'Y1ok' : 'Y1x', r.residents52, r.famineY1, r.firstHarvestWeek, r.firstGranaryWeek, r.won ? r.weeks : r.lost ? 'L' + r.weeks : '-', JSON.stringify(r.built)].join(' '));

if (args.includes('--trace')) {
  const [bn, sd, upto] = opt('trace', 'comum:1:80').split(':');
  const rng = createRng(Number(sd));
  const s = createGame(rng);
  const bot = new SurvivalBot(PROFILES[bn], createRng(Number(sd) * 7919 + 13));
  let prevB = '';
  while (s.week < Number(upto) && !s.lost && !s.won) {
    bot.act(s);
    const bl = s.buildings.filter((b) => b.kind !== 'altar').map((b) => b.kind === 'house' ? 'h' + b.level : b.kind[0] + b.kind[1]).sort().join('');
    const eco = computeEconomy(s);
    const fc = foodForecast(s, eco);
    console.log(`w${s.week} ${seasonOf(s.week).slice(0, 2)} $${f(s.silver)} (${eco.silverDelta >= 0 ? '+' : ''}${eco.silverDelta}) food ${s.food}/${foodCapacity(s)} (${eco.foodDelta}) res ${eco.residents} wk ${eco.workers}/${eco.jobs} fc ${fc ? fc.weeks : '-'} blk ${familyBlock(s, eco) ?? 'open'} g${s.goalIndex + 1}${s.drought ? ' DRY' : ''}${s.famine ? ' FAMINE' : ''} ${bl !== prevB ? bl : ''}`);
    prevB = bl;
    stepWeek(s, rng);
  }
}

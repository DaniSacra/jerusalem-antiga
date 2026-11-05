/**
 * Headless balance simulation with the survival bots (see docs/TESTING.md):
 *   npm run sim                                  # all bots, 20 seeds each
 *   npm run sim -- --bots comum --seeds 100      # one bot, more seeds
 *   npm run sim -- --brief | --json | --rows     # one line per bot, raw results, one line per run
 *   npm run sim -- --trace comum:1:80            # week by week of one game (bot:seed:weeks)
 *   npm run sim -- --profile savesTemple=true   # changes a bot profile field for this run
 *   npm run sim -- --set rules.people.birthChance=0.04 --drop-goal 4
 *        # tries balance numbers in memory only (src/data is not touched); --drop-goal is 1-based
 */
import {
  computeEconomy,
  createGame,
  createRng,
  birthBlock,
  foodCapacity,
  foodForecast,
  GOALS,
  RULES,
  seasonOf,
  stepWeek,
  ageOf,
  bandCounts,
  waitingCouples,
} from '../../src/core';
import { applyOverrides } from './overrides';
import { PROFILES, run, SurvivalBot, type Result } from './survival';

const args = process.argv.slice(2);
const opt = (n: string, d: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const ov = applyOverrides(args);
const bots = opt('bots', Object.keys(PROFILES).join(',')).split(',');
// --profile key=json: changes a profile field of every bot run (e.g. savesTemple=true).
args.forEach((a, i) => {
  if (a !== '--profile') return;
  const [k, raw] = args[i + 1].split('=');
  for (const b of bots) (PROFILES[b] as unknown as Record<string, unknown>)[k] = JSON.parse(raw);
});
const seeds = Number(opt('seeds', '20'));
const maxWeeks = Number(opt('weeks', '1000'));
const med = (v: number[]) => { const a = v.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) / 2)] : NaN; };
/** Quantile q (0-1) of the finite values, nearest rank below. */
const qt = (v: number[], q: number) => { const a = v.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) * q)] : NaN; };
const f = (n: number, d = 0) => (Number.isFinite(n) ? n.toFixed(d) : '-');
const mins = (w: number) => (w * RULES.weekSeconds) / 60;
if (ov.length) console.log('overrides', ov.join(' '));
const all: Result[] = [];
/** End pace: wait from the second-to-last goal to the last regular one, and from that one to victory. */
const endPace = (rs: Result[]) => {
  const last = GOALS.length - 2;
  const reached = rs.filter((r) => r.goalWeeks[last] != null);
  const toWin = reached.filter((r) => r.won).map((r) => r.weeks - (r.goalWeeks[last] as number));
  const wait = rs.map((r) => (r.goalWeeks[last] ?? NaN) - (r.goalWeeks[last - 1] ?? NaN));
  return `end g${last}→${last + 1} med ${f(med(wait))} p75 ${f(qt(wait, 0.75))} | g${last + 1}→win med ${f(med(toWin))} p75 ${f(qt(toWin, 0.75))} | g${last + 1} reached ${reached.length} won ${toWin.length} (${f((100 * toWin.length) / reached.length)}%)`;
};
const pc = (k: number, n: number) => (n ? `${f((100 * k) / n)}%` : '-');
/** The acceptance criteria A1-A11 of the People package (plano.md 8.3) for one bot's runs. */
function criteria(rs: Result[]): string {
  const n = rs.length;
  const won = rs.filter((r) => r.won);
  const lost = rs.filter((r) => r.lost);
  const ww = med(won.map((r) => r.weeks));
  const g15 = rs.filter((r) => r.g15);
  const gap = med(rs.map((r) => r.goalWait));
  const y2 = (k: 'weddings' | 'births') => f(med(rs.map((r) => r.peopleByYear[1]?.[k] ?? NaN)));
  const arrived = rs.filter((r) => r.caravansArrived > 0);
  return [
    `A1 won ${pc(won.length, n)} wk ${f(ww)} (${f(mins(ww), 1)} min) p25-p75 ${f(mins(qt(won.map((r) => r.weeks), 0.25)), 1)}-${f(mins(qt(won.map((r) => r.weeks), 0.75)), 1)}`,
    `A4 grow med ${f(med(rs.map((r) => r.growthMax)), 2)} >2 ${pc(rs.filter((r) => r.growthMax > 2).length, n)}`,
    `A5 gap med ${f(gap)} wk (${f(mins(gap), 1)} min) >75 ${pc(rs.filter((r) => r.goalWait > 75).length, n)} worst-goal med ${worstGoalGap(rs)}`,
    `A6 famWinter ${pc(rs.filter((r) => r.famineWinters > 0).length, n)} lost ${pc(lost.length, n)}`,
    `A7 debtY2 ${pc(rs.filter((r) => r.debtY2).length, n)}`,
    `A8 g15 ${g15.length} gran<=1 ${pc(g15.filter((r) => r.g15!.granaries <= 1).length, g15.length)} famine ${pc(g15.filter((r) => r.g15!.famine).length, g15.length)}`,
    `A9 Y2 wed ${y2('weddings')} births ${y2('births')} car>=1 ${pc(arrived.filter((r) => r.caravansSome === r.caravansArrived).length, arrived.length)} all ${pc(rs.reduce((a, r) => a + r.caravansAll, 0), rs.reduce((a, r) => a + r.caravansArrived, 0))} stayed ${rs.reduce((a, r) => a + r.caravanHoused, 0)}/${rs.reduce((a, r) => a + r.caravanHoused + r.caravanLeft, 0)}`,
    `A10 crisis ${pc(rs.filter((r) => r.crises > 0).length, n)} recov ${pc(rs.filter((r) => r.recoveries > 0).length, n)} lost<150 ${lost.filter((r) => r.weeks < 150).length}`,
    `A11 granMax ${Math.max(...rs.map((r) => r.maxGranaries))} >3 ${rs.filter((r) => r.maxGranaries > 3).length}`,
    `Y1 houses ${f(med(rs.map((r) => r.houses52)))} res ${f(med(rs.map((r) => r.residents52)))} | couplesLeft ${f(med(rs.map((r) => r.couplesLeft)))} wait ${f(med(rs.map((r) => r.coupleWaitMax)))} | idle>26 ${rs.filter((r) => r.silverIdle > 26).length}`,
  ].join(' | ');
}
/** A5 read per goal: the median wait for each goal (from the goal before; runs that reached it) and the worst of them. */
function worstGoalGap(rs: Result[]): string {
  const gaps = GOALS.map((_, i) => med(rs.map((r) => (r.goalWeeks[i] ?? NaN) - (i ? (r.goalWeeks[i - 1] ?? NaN) : 0))));
  const i = gaps.reduce((b, g, k) => (g > gaps[b] ? k : b), 0);
  return `${f(gaps[i])} wk (g${i + 1})`;
}
/** A2 and A3 over the bots run: overall win rate, and the order Eficiente > Comum > Distraido. */
function ranking(byBot: Record<string, Result[]>): string {
  const all = Object.values(byBot).flat();
  const rate = (k: string) => (byBot[k] ? byBot[k].filter((r) => r.won).length / byBot[k].length : NaN);
  const wk = (k: string) => (byBot[k] ? med(byBot[k].filter((r) => r.won).map((r) => r.weeks)) : NaN);
  const order = rate('eficiente') > rate('comum') && rate('comum') > rate('distraido') && (wk('eficiente') < wk('comum') || !Number.isFinite(wk('comum')));
  return `A2 overall won ${pc(all.filter((r) => r.won).length, all.length)} | A3 ${['eficiente', 'comum', 'distraido'].map((k) => `${k} ${f(100 * rate(k))}% wk ${f(wk(k))}`).join(' > ')} => ${order ? 'ok' : 'FAIL'}`;
}
const byBot: Record<string, Result[]> = {};
for (const name of bots) {
  const rs: Result[] = [];
  byBot[name] = rs;
  for (let k = 1; k <= seeds; k++) rs.push(run(PROFILES[name], k, maxWeeks));
  all.push(...rs);
  if (args.includes('--json')) continue;
  const n = rs.length;
  if (args.includes('--brief')) {
    console.log(`${name.padEnd(9)} ${criteria(rs)} | goals ${GOALS.map((_, i) => f(med(rs.map((r) => r.goalWeeks[i] ?? NaN)))).join(' ')}`);
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
  console.log(`birth block Y1: ${pct(b1)}`);
  console.log(`birth block all: ${pct(bsum)}`);
  const py = (y: number, k: 'births' | 'deaths' | 'weddings') => f(med(rs.map((r) => r.peopleByYear[y]?.[k] ?? NaN)));
  console.log(`people per year (med births/deaths/weddings): ${Array.from({ length: 8 }, (_, y) => `Y${y + 1} ${py(y, 'births')}/${py(y, 'deaths')}/${py(y, 'weddings')}`).join('  ')}`);
  const cbs = (y: number) => { const o: Record<string, number> = {}; for (const r of rs) for (const [k, v] of Object.entries(r.coupleBlocksByYear[y] ?? {})) o[k] = (o[k] ?? 0) + v; return o; };
  for (let y = 0; y < 8; y++) console.log(`  fertile couple-weeks Y${y + 1}: ${f(Object.values(cbs(y)).reduce((a, v) => a + v, 0) / n)} per run (${pct(cbs(y))})`);
  console.log(`criteria: ${criteria(rs)}`);
  console.log(`end people med child/adult/elder ${['child', 'adult', 'elder'].map((k) => f(med(rs.map((r) => r.endBands[k as 'child'])))).join('/')} | unemployed ${f(med(rs.map((r) => r.endUnemployed)))} | death age med ${f(med(rs.map((r) => r.deathAge)))} | couples left med ${f(med(rs.map((r) => r.couplesLeft)))} (runs with any ${rs.filter((r) => r.couplesLeft > 0).length}) | couple wait max med ${f(med(rs.map((r) => r.coupleWaitMax)))} | caravans arrived ${rs.reduce((a, r) => a + r.caravansArrived, 0)} all housed ${rs.reduce((a, r) => a + r.caravansAll, 0)} some ${rs.reduce((a, r) => a + r.caravansSome, 0)}`);
  console.log(`caravans: families stayed ${rs.reduce((a, r) => a + r.caravanHoused, 0)} went on ${rs.reduce((a, r) => a + r.caravanLeft, 0)} | granaries max at once med ${f(med(rs.map((r) => r.maxGranaries)))} max ${Math.max(...rs.map((r) => r.maxGranaries))}`);
  console.log(`silver below 0: Y1 ${rs.filter((r) => r.debtY1).length}/${n}  Y2 ${rs.filter((r) => r.debtY2).length}/${n}  ever ${rs.filter((r) => r.debtEver).length}/${n} | longest wait on one goal med ${f(med(rs.map((r) => r.goalWait)))} max ${f(Math.max(...rs.map((r) => r.goalWait)))}  runs > 52 wk ${rs.filter((r) => r.goalWait > 52).length} (goals ${[...new Set(rs.filter((r) => r.goalWait > 52).map((r) => r.goalWaitIndex + 1))].sort((x, y) => x - y).join(',') || '-'})`);
  for (const fam of [...new Set(rs.map((r) => r.families0))].sort()) {
    const c = rs.filter((r) => r.families0 === fam);
    console.log(`caravan ${fam} families: ${c.length} runs | Y1 ${c.filter((r) => r.year1).length}/${c.length}  famine Y1 med ${f(med(c.map((r) => r.famineY1)))}  debt Y1 ${c.filter((r) => r.debtY1).length}  lost ${c.filter((r) => r.lost).length}  won ${c.filter((r) => r.won).length}  win wk med ${f(med(c.filter((r) => r.won).map((r) => r.weeks)))}  res52 med ${f(med(c.map((r) => r.residents52)))}  houses52 med ${f(med(c.map((r) => r.houses52)))}`);
  }
  console.log(`houses w52 med ${f(med(rs.map((r) => r.houses52)))} (min ${Math.min(...rs.map((r) => r.houses52))} max ${Math.max(...rs.map((r) => r.houses52))}) | famine in a winter ${rs.filter((r) => r.famineWinters > 0).length}/${n}  winters med ${f(med(rs.map((r) => r.famineWinters)))}`);
  console.log(`crisis ${rs.filter((r) => r.crises > 0).length}/${n} (first wk med ${f(med(rs.map((r) => r.firstCrisisWeek ?? NaN)))})  recovered ${rs.filter((r) => r.recoveries > 0).length}/${n} | lost before wk 150 ${rs.filter((r) => r.lost && r.weeks < 150).length}  loss wk med ${f(med(rs.filter((r) => r.lost).map((r) => r.weeks)))}`);
  console.log(`workshops max at once: med ${f(med(rs.map((r) => r.maxWorkshops)))} max ${Math.max(...rs.map((r) => r.maxWorkshops))}  runs > 4 ${rs.filter((r) => r.maxWorkshops > 4).length} | silver > 300 before temple, longest run med ${f(med(rs.map((r) => r.silverIdle)))} max ${Math.max(...rs.map((r) => r.silverIdle))}  runs > 26 wk ${rs.filter((r) => r.silverIdle > 26).length}`);
  const years = Math.max(...rs.map((r) => r.residentsByYear.length));
  console.log(`residents at year end (med): ${Array.from({ length: years }, (_, y) => `Y${y + 1} ${f(med(rs.map((r) => r.residentsByYear[y] ?? NaN)))}`).join('  ')}`);
  for (let y = 0; y < Math.min(years, 12); y++) {
    const o: Record<string, number> = {};
    for (const r of rs) for (const [k, v] of Object.entries(r.blocksByYear[y] ?? {})) o[k] = (o[k] ?? 0) + v;
    console.log(`  birth block Y${y + 1}: ${pct(o)}`);
  }
  if (won.length) console.log(`houses per level at victory (med tent/mud/stone/big): ${[0, 1, 2, 3].map((l) => f(med(won.map((r) => r.levelsAtEnd[l])))).join('/')}`);
  console.log(`drought years med ${f(med(rs.map((r) => r.droughtYears)))}  famine weeks in dry years med ${f(med(rs.map((r) => r.famineAfterDrought)))}`);
  console.log('goal                                  done  week med (min-max)  min@1x');
  GOALS.forEach((g, i) => {
    const d = rs.map((r) => r.goalWeeks[i]).filter((x): x is number => x !== null);
    console.log(`${String(i + 1).padStart(2)} ${g.text.padEnd(36).slice(0, 36)} ${String(d.length).padStart(3)}  ${f(med(d)).padStart(5)} (${d.length ? Math.min(...d) + '-' + Math.max(...d) : '-'})  ${f(mins(med(d)), 1)}`);
  });
  // When each mark was first reached (median of the runs that reached it, and how many): to place goals.
  const keys = [...new Set(rs.flatMap((r) => Object.keys(r.marks)))].sort((a, b) => med(rs.map((r) => r.marks[a] ?? NaN)) - med(rs.map((r) => r.marks[b] ?? NaN)));
  console.log(`marks (week med/runs): ${keys.map((k) => `${k} ${f(med(rs.map((r) => r.marks[k] ?? NaN)))}/${rs.filter((r) => r.marks[k] != null).length}`).join('  ')}`);
  console.log(`win weeks med ${f(med(won.map((r) => r.weeks)))} = ${f(mins(med(won.map((r) => r.weeks))), 1)} min | ${endPace(rs)}`);
  const kinds = [...new Set(rs.flatMap((r) => Object.keys(r.built)))];
  console.log(`built med: ${kinds.map((k) => `${k} ${f(med(rs.map((r) => r.built[k] ?? 0)))}`).join(', ')}`);
}
if (!args.includes('--json')) console.log(ranking(byBot));
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
    const bands = bandCounts(s);
    const single = (sex: 'm' | 'f') => s.people.filter((p) => p.sex === sex && p.houseId !== null && p.spouseId === null && ageOf(p, s.week) >= RULES.people.marriageAges[0] && ageOf(p, s.week) <= RULES.people.marriageAges[1]).length;
    const ppl = `ppl ${bands.child}/${bands.adult}/${bands.elder} single ${single('m')}/${single('f')} wait ${waitingCouples(s).length}`;
    console.log(`w${s.week} ${ppl} ${seasonOf(s.week).slice(0, 2)} $${f(s.silver)} (${eco.silverDelta >= 0 ? '+' : ''}${eco.silverDelta}) food ${s.food}/${foodCapacity(s)} (${eco.foodDelta}) res ${eco.residents} wk ${eco.workers}/${eco.jobs} fc ${fc ? fc.weeks : '-'} res ${eco.residents} births ${birthBlock(s, eco) ?? 'open'} g${s.goalIndex + 1}${s.drought ? ' DRY' : ''}${s.famine ? ' FAMINE' : ''} ${bl !== prevB ? bl : ''}`);
    prevB = bl;
    stepWeek(s, rng);
  }
}

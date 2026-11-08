/**
 * Headless balance simulation with the survival bots (see docs/TESTING.md):
 *   npm run sim                                  # all bots, 20 seeds each
 *   npm run sim -- --bots comum --seeds 100      # one bot, more seeds
 *   npm run sim -- --brief | --json | --rows     # one line per bot, raw results, one line per run
 *   npm run sim -- --trace comum:1:80            # week by week of one game (bot:seed:weeks)
 *   npm run sim -- --profile stageAhead=1       # changes a bot profile field for this run
 *   npm run sim -- --set rules.people.birthChance=0.04 --drop-goal 4
 *        # tries balance numbers in memory only (src/data is not touched); --drop-goal is 1-based
 *   npm run sim -- --scale temple.work=0.8 --add temple.builders=1
 *   npm run sim -- --difficulty easy               # plays Tranquilo (normal, hard)
 *        # the same for a field of every row of a list table (the Temple's stages), rounded
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
  TEMPLE_STAGES,
  buildersAtWork,
  seasonOf,
  stepWeek,
  ageOf,
  bandCounts,
  waitingCouples,
  DIFFICULTIES,
} from '../../src/core';
import { applyOverrides } from './overrides';
import { PROFILES, run, simDifficulty, SurvivalBot, type Result } from './survival';

const args = process.argv.slice(2);
const opt = (n: string, d: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const ov = applyOverrides(args);
if (args.includes('--difficulty')) {
  const d = args[args.indexOf('--difficulty') + 1] as typeof simDifficulty.d;
  if (!DIFFICULTIES.includes(d)) throw new Error(`--difficulty: one of ${DIFFICULTIES.join(', ')} (got ${d})`);
  simDifficulty.d = d;
}
const bots = opt('bots', Object.keys(PROFILES).join(',')).split(',');
// --profile key=json: changes a profile field of every bot run (e.g. stageAhead=1).
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
    `A4 grow med ${f(med(rs.map((r) => r.growthMax)), 2)} >2 ${pc(rs.filter((r) => r.growthMax > 2).length, n)} (over best year >2 ${pc(rs.filter((r) => r.growthPeak > 2).length, n)})`,
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
/** P3 materials (plano-p3 8.2 W1-W6 and 8.3): one line per material and one with the W criteria. */
function materialLines(rs: Result[]): string[] {
  const n = rs.length;
  const m = (get: (r: Result) => number, d = 0) => f(med(rs.map(get)), d);
  const years = [1, 3, 5, 8, 10];
  const line = (k: 'wood' | 'stone', prod: string, count: (r: Result) => number) =>
    `  ${k.padEnd(5)} ${prod} med ${m(count)} max ${Math.max(...rs.map(count))} | stock ${years.map((y) => `Y${y} ${m((r) => r.mat.byYear[k][y - 1] ?? NaN)}`).join(' ')}` +
    ` | houses waiting: runs ${pc(rs.filter((r) => r.mat.waitWeeks[k] > 0).length, n)} weeks med ${m((r) => r.mat.waitWeeks[k])} p75 ${f(qt(rs.map((r) => r.mat.waitWeeks[k]), 0.75))}` +
    ` | builds blocked wks med ${m((r) => r.mat.blocked[k])} | made ${m((r) => r.mat.made[k])} spent build ${m((r) => r.mat.spentBuild[k])} levels ${m((r) => r.mat.spentLevel[k])} | end ${m((r) => r.mat.end[k])} per 100 made ${m((r) => (100 * r.mat.end[k]) / Math.max(1, r.mat.made[k]))} p75 ${f(qt(rs.map((r) => (100 * r.mat.end[k]) / Math.max(1, r.mat.made[k])), 0.75))}`;
  const food = (k: 'field' | 'fisher' | 'gatherer') => rs.reduce((a, r) => a + r.food[k], 0);
  const anyWait = rs.filter((r) => r.mat.waitWeeks.wood + r.mat.waitWeeks.stone > 0).length;
  return [
    line('wood', 'lumbers', (r) => r.mat.lumbers),
    line('stone', 'quarries', (r) => r.mat.quarries),
    `  W1 any house waiting ${pc(anyWait, n)} | W2 longest house wait med ${m((r) => r.mat.houseWaitMax)} p75 ${f(qt(rs.map((r) => r.mat.houseWaitMax), 0.75))} >52 ${rs.filter((r) => r.mat.houseWaitMax > 52).length}` +
      ` | W3 Y1 wood-blocked wks med ${m((r) => r.mat.woodBlockedY1)} | W4 >300 for >52 wk ${rs.filter((r) => r.mat.idle300 > 52).length} | W5 idle w200 med ${m((r) => r.mat.unemployed200)}` +
      ` | W6 gatherer ${f((100 * food('gatherer')) / (food('field') + food('fisher') + food('gatherer')))}% | stumps w260 ${m((r) => r.mat.stumps260)} w520 ${m((r) => r.mat.stumps520)} cut ${m((r) => r.mat.cut)}`,
  ];
}
/** Economy squeeze (sim-tester-aperto): wins, defeats, hunger or cold, spoiled food, silver never spent, stone at its cap. */
function squeezeLine(rs: Result[]): string {
  const n = rs.length;
  const m = (get: (r: Result) => number, d = 0) => f(med(rs.map(get)), d);
  const won = rs.filter((r) => r.won).map((r) => r.weeks);
  const made = rs.reduce((a, r) => a + r.food.field + r.food.fisher + r.food.gatherer, 0);
  const hungry = rs.filter((r) => r.famineWeeks > 0);
  const lostY1 = rs.filter((r) => r.lost && r.weeks <= 52).length;
  return `  SQ won ${pc(won.length, n)} lost ${pc(rs.filter((r) => r.lost).length, n)} (Y1 ${lostY1}) | win ${f(mins(med(won)), 1)} min p10-p90 ${f(mins(qt(won, 0.1)), 1)}-${f(mins(qt(won, 0.9)), 1)}` +
    ` | hunger|cold ${pc(rs.filter((r) => r.famineWeeks > 0 || r.b1.coldWeeks > 0).length, n)} hunger ${pc(hungry.length, n)} wks med ${m((r) => r.famineWeeks)} (of hungry ${f(med(hungry.map((r) => r.famineWeeks)))}) p90 ${f(qt(rs.map((r) => r.famineWeeks), 0.9))} Y1 ${pc(rs.filter((r) => r.famineY1 > 0).length, n)}` +
    ` | spoiled ${f((100 * rs.reduce((a, r) => a + r.food.spoiled, 0)) / made)}% stolen ${f((100 * rs.reduce((a, r) => a + r.food.stolen, 0)) / made, 1)}% (runs ${pc(rs.filter((r) => r.food.stolen > 0).length, n)}) | ragged runs ${pc(rs.filter((r) => r.ragged.winters > 0).length, n)} wks med ${m((r) => r.ragged.weeks)} cold deaths med ${m((r) => r.b3.coldAll)} p90 ${f(qt(rs.map((r) => r.b3.coldAll), 0.9))} tanneries med ${m((r) => r.ragged.tanneries)} | silver unspent med ${m((r) => (100 * Math.max(0, r.endSilver)) / r.sq.silverIn)}% | stone cap wks med ${m((r) => (100 * r.sq.stoneCap) / Math.max(1, r.sq.weeks))}% | res52 ${m((r) => r.residents52)} res104 ${m((r) => r.residents104)} | food bldgs Y1-5 ${[0, 1, 2, 3, 4].map((y) => m((r) => r.sq.foodBuildings[y] ?? NaN)).join('/')}`;
}
/** Package B1 (plano-sobrevivencia 7): S1-S4, cold, wood in year 1, the firewood hold, year-1 losses. */
function b1Lines(rs: Result[]): string[] {
  const n = rs.length;
  const m = (get: (r: Result) => number, d = 0) => f(med(rs.map(get)), d);
  const q = (get: (r: Result) => number, x: number) => f(qt(rs.map(get), x));
  const mud = (r: Result) => r.marks.h2x1 ?? NaN;
  const market = (r: Result) => r.b1.unlockWeek.market ?? NaN;
  const lostY1 = rs.filter((r) => r.lost && r.weeks <= 52).length;
  const causes = [...new Set(rs.flatMap((r) => Object.keys(r.b1.endsY1)))].sort();
  const ends = (r: Result) => Object.values(r.b1.endsY1).reduce((a, v) => a + v, 0);
  return [
    `  S1 houses w52 med ${m((r) => r.houses52)} p10-p90 ${q((r) => r.houses52, 0.1)}-${q((r) => r.houses52, 0.9)} in 4-7 ${pc(rs.filter((r) => r.houses52 >= 4 && r.houses52 <= 7).length, n)}` +
      ` | S2 1st mud wk med ${m(mud)} p25-p75 ${q(mud, 0.25)}-${q(mud, 0.75)} in 8-20 ${pc(rs.filter((r) => mud(r) >= 8 && mud(r) <= 20).length, n)}` +
      ` | S3 market wk med ${m(market)} p25 ${q(market, 0.25)} >=78 ${pc(rs.filter((r) => market(r) >= 78).length, rs.filter((r) => Number.isFinite(market(r))).length)}` +
      ` | S4 lost Y1 ${pc(lostY1, n)} emptied Y1 ${rs.filter((r) => r.b1.emptyWeek !== null && r.b1.emptyWeek < 52).length}`,
    `  cold: Y1 runs ${pc(rs.filter((r) => r.b1.coldY1 > 0).length, n)} wks med ${m((r) => r.b1.coldY1)} p90 ${q((r) => r.b1.coldY1, 0.9)} | any winter ${pc(rs.filter((r) => r.b1.coldWeeks > 0).length, n)} total wks med ${m((r) => r.b1.coldWeeks)} winters med ${m((r) => r.b1.coldWinters)}` +
      ` | hold: runs ${pc(rs.filter((r) => r.b1.holdAll > 0).length, n)} Y1 runs ${pc(rs.filter((r) => r.b1.holdY1 > 0).length, n)} house-wks Y1 med ${m((r) => r.b1.holdY1)} p90 ${q((r) => r.b1.holdY1, 0.9)} all med ${m((r) => r.b1.holdAll)} houses med ${m((r) => r.b1.holdHouses)}`,
    `  wood Y1 (wk 0,4..52 med): ${Array.from({ length: 14 }, (_, k) => m((r) => r.b1.woodY1[k] ?? NaN)).join(' ')} | p10 ${Array.from({ length: 14 }, (_, k) => q((r) => r.b1.woodY1[k] ?? NaN, 0.1)).join(' ')} | 1st lumber wk med ${m((r) => r.b1.firstLumber ?? NaN)} p75 ${q((r) => r.b1.firstLumber ?? NaN, 0.75)}`,
    `  Y1 ends (died/left) med ${m(ends)} p90 ${q(ends, 0.9)} runs>0 ${pc(rs.filter((r) => ends(r) > 0).length, n)} by cause (sum): ${causes.map((c) => `${c} ${rs.reduce((a, r) => a + (r.b1.endsY1[c] ?? 0), 0)}`).join(', ') || '-'} | famine Y1 runs ${pc(rs.filter((r) => r.famineY1 > 0).length, n)} wks med ${m((r) => r.famineY1)} | idle Y1 med ${m((r) => r.b1.idleY1)} p90 ${q((r) => r.b1.idleY1, 0.9)}`,
    `  per goal med wk: ${GOALS.map((_, i) => `g${i + 1} ${m((r) => r.goalWeeks[i] ?? NaN)}`).join(' ')} | gaps: ${GOALS.map((_, i) => m((r) => (r.goalWeeks[i] ?? NaN) - (i ? (r.goalWeeks[i - 1] ?? NaN) : 0))).join(' ')}`,
  ];
}
/** Package B2 (plano-sobrevivencia 7): J1-J3, empty workplaces, job moves, unemployment in year 1. */
function b2Lines(rs: Result[]): string[] {
  const n = rs.length;
  const m = (get: (r: Result) => number, d = 0) => f(med(rs.map(get)), d);
  const q = (get: (r: Result) => number, x: number) => f(qt(rs.map(get), x));
  const kinds = [...new Set(rs.flatMap((r) => Object.keys(r.b2.emptyByKind)))].sort();
  const longKinds: Record<string, number> = {};
  for (const r of rs) if (r.b2.emptyLongest > 8 && r.b2.emptyLongestKind) longKinds[r.b2.emptyLongestKind] = (longKinds[r.b2.emptyLongestKind] ?? 0) + 1;
  return [
    `  J1 empty >8 wk runs ${pc(rs.filter((r) => r.b2.emptyLongest > 8).length, n)} (active: no frozen field or cut grove ${pc(rs.filter((r) => r.b2.emptyLongestActive > 8).length, n)}; no field ${pc(rs.filter((r) => r.b2.emptyLongestNoField > 8).length, n)}) longest med ${m((r) => r.b2.emptyLongest)} p90 ${q((r) => r.b2.emptyLongest, 0.9)} kinds ${Object.entries(longKinds).map(([k, v]) => `${k} ${v}`).join(', ') || '-'}` +
      ` | J2 idle Y1 med ${m((r) => r.b1.idleY1)} p90 ${q((r) => r.b1.idleY1, 0.9)}` +
      ` | J3 lumber empty in a winter ${pc(rs.filter((r) => r.b2.lumberEmptyWinter).length, n)} (live lumber ${pc(rs.filter((r) => r.b2.liveLumberEmptyWinter).length, n)}, all lumbers empty ${pc(rs.filter((r) => r.b2.noWoodWinter).length, n)})`,
    `  empty building-weeks med ${m((r) => r.b2.emptyWeeks)} p90 ${q((r) => r.b2.emptyWeeks, 0.9)} Y1 ${m((r) => r.b2.emptyY1)} | by kind (sum/run): ${kinds.map((k) => `${k} ${f(rs.reduce((a, r) => a + (r.b2.emptyByKind[k] ?? 0), 0) / n)}`).join(', ')}` +
      ` | moves med empty ${m((r) => r.b2.moves.empty)} firewood ${m((r) => r.b2.moves.firewood)} | idle w200 med ${m((r) => r.mat.unemployed200)}`,
  ];
}
/** Package B3 (plano-sobrevivencia 4 and 7): F1, F2, D1-D3, J1 new, A2b and the defeats. */
function b3Lines(rs: Result[]): string[] {
  const n = rs.length;
  const m = (get: (r: Result) => number, d = 0) => f(med(rs.map(get)), d);
  const q = (get: (r: Result) => number, x: number) => f(qt(rs.map(get), x));
  const sum = (k: string) => rs.reduce((a, r) => a + (r.b3.cold[k] ?? 0), 0);
  const split = (y: string) => ['tent_v', 'tent_o', 'house_v', 'house_o', 'unknown'].map((k) => `${k} ${sum(`${y}_${k}`)}`).join(' ');
  const lost = rs.filter((r) => r.lost);
  const causes: Record<string, number> = {};
  for (const r of lost) causes[r.b3.loss?.cause ?? '?'] = (causes[r.b3.loss?.cause ?? '?'] ?? 0) + 1;
  const won = rs.filter((r) => r.won);
  const nowin = rs.filter((r) => !r.won);
  const u5lost = lost.map((r) => r.b3.loss?.under5Weeks ?? NaN).filter(Number.isFinite);
  const u5ghost = rs.filter((r) => !r.lost && !r.won && r.b3.under5Weeks !== null).map((r) => r.b3.under5Weeks as number);
  const j1Kinds: Record<string, number> = {};
  for (const r of rs) if (r.b3.j1 > 8 && r.b3.j1Kind) j1Kinds[r.b3.j1Kind] = (j1Kinds[r.b3.j1Kind] ?? 0) + 1;
  return [
    `  F1 cold any winter ${pc(rs.filter((r) => r.b1.coldWeeks > 0).length, n)} | F2 tents w13 med ${m((r) => r.b3.tentsW1)} p10-p90 ${q((r) => r.b3.tentsW1, 0.1)}-${q((r) => r.b3.tentsW1, 0.9)} (mud+ ${m((r) => r.b3.housesW1)}, vulnerable in tents med ${m((r) => r.b3.tentVulnW1)} p90 ${q((r) => r.b3.tentVulnW1, 0.9)}; their winter-1 weeks med ${m((r) => r.b3.tentVulnWeeksY1)} p75 ${q((r) => r.b3.tentVulnWeeksY1, 0.75)} p90 ${q((r) => r.b3.tentVulnWeeksY1, 0.9)} zero ${pc(rs.filter((r) => r.b3.tentVulnWeeksY1 === 0).length, n)})` +
      ` | D1 cold death Y1 runs ${pc(rs.filter((r) => r.b3.coldY1 > 0).length, n)} p90 ${q((r) => r.b3.coldY1, 0.9)} max ${Math.max(...rs.map((r) => r.b3.coldY1))} | D2 per game med ${m((r) => r.b3.coldAll)} p90 ${q((r) => r.b3.coldAll, 0.9)} max ${Math.max(...rs.map((r) => r.b3.coldAll))} runs>0 ${pc(rs.filter((r) => r.b3.coldAll > 0).length, n)}`,
    `  cold deaths (sum) Y1: ${split('Y1')} | all: ${split('all')}`,
    `  J1new ${pc(rs.filter((r) => r.b3.j1 > 8).length, n)} (live lumber ${pc(rs.filter((r) => r.b3.j1Live > 8).length, n)}) longest med ${m((r) => r.b3.j1)} p90 ${q((r) => r.b3.j1, 0.9)} kinds ${Object.entries(j1Kinds).map(([k, v]) => `${k} ${v}`).join(', ') || '-'}` +
      ` | J1 as in B3 (field always) ${pc(rs.filter((r) => r.b3.j1Old > 8).length, n)}` +
      ` | A2b lost with 5+ residents ${pc(lost.filter((r) => (r.b3.loss?.residents ?? 0) >= 5).length, n)} | D3 lost ${pc(lost.length, n)} Y1 ${pc(lost.filter((r) => r.weeks <= 52).length, n)} wk med ${f(med(lost.map((r) => r.weeks)))} causes ${Object.entries(causes).map(([k, v]) => `${k} ${v}`).join(', ') || '-'} | end residents med ${m((r) => r.endResidents)} <5 ${pc(rs.filter((r) => r.endResidents < 5).length, n)}`,
    `  under 5 → defeat wks (lost under 5: ${u5lost.length}) med ${f(med(u5lost))} p75 ${f(qt(u5lost, 0.75))} p90 ${f(qt(u5lost, 0.9))} max ${u5lost.length ? Math.max(...u5lost) : '-'} >26 ${u5lost.filter((w) => w > 26).length}` +
      ` | not lost, ended under 5: ${u5ghost.length} wks med ${f(med(u5ghost))} max ${u5ghost.length ? Math.max(...u5ghost) : '-'}`,
    `  no win ${pc(nowin.length, n)} (lost ${lost.length}, unfinished ${nowin.length - lost.length}; reached g${GOALS.length - 1} ${nowin.filter((r) => r.goalWeeks[GOALS.length - 2] != null).length})` +
      ` cold deaths there med ${f(med(nowin.map((r) => r.b3.coldAll)))} max ${nowin.length ? Math.max(...nowin.map((r) => r.b3.coldAll)) : '-'} end wood med ${f(med(nowin.map((r) => r.mat.end.wood)))} stone ${f(med(nowin.map((r) => r.mat.end.stone)))} silver ${f(med(nowin.map((r) => r.endSilver)))} res ${f(med(nowin.map((r) => r.endResidents)))}` +
      ` | D2 in wins med ${f(med(won.map((r) => r.b3.coldAll)))} p90 ${f(qt(won.map((r) => r.b3.coldAll), 0.9))} max ${won.length ? Math.max(...won.map((r) => r.b3.coldAll)) : '-'}`,
  ];
}
/** Temple in stages (plano-desafio 2.7): E1-E7, per stage its wait to be paid and its length, the builders. */
function templeLines(rs: Result[]): string[] {
  const n = rs.length;
  const m = (v: number[], d = 0) => f(med(v), d);
  const won = rs.filter((r) => r.won).map((r) => r.weeks);
  const lost = rs.filter((r) => r.lost).length;
  const stages = TEMPLE_STAGES.map((st, k) => {
    const pay = rs.map((r) => (r.tp.stages[k].start ?? (r.tp.stages[k].goal !== null ? r.weeks : NaN)) - (r.tp.stages[k].goal ?? NaN));
    const len = rs.map((r) => (r.tp.stages[k].done ?? NaN) - (r.tp.stages[k].start ?? NaN));
    const min = Math.ceil(st.work / st.builders);
    const last = ['silver', 'wood', 'stone'].map((x) => rs.filter((r) => r.tp.last[k] === x).length).join('/');
    return `    s${k + 1} ${st.name.slice(0, 10).padEnd(10)} goal wk ${m(rs.map((r) => r.tp.stages[k].goal ?? NaN))} paid ${rs.filter((r) => r.tp.stages[k].start !== null).length} built ${rs.filter((r) => r.tp.stages[k].done !== null).length}` +
      ` | E4 wait to pay p50 ${m(pay)} p90 ${f(qt(pay, 0.9))} (last silver/wood/stone ${last}) | E3 length p50 ${m(len)} p90 ${f(qt(len, 0.9))} min ${min} (x${f(med(len) / min, 2)})`;
  });
  const gaps = GOALS.map((_, i) => med(rs.map((r) => (r.goalWeeks[i] ?? NaN) - (i ? (r.goalWeeks[i - 1] ?? NaN) : 0))));
  const worst = gaps.reduce((b, g, k) => (g > gaps[b] ? k : b), 0);
  const logKeys = [...new Set(rs.flatMap((r) => Object.keys(r.tp.log)))].sort();
  return [
    `  E1 win med ${m(won)} wk = ${f(mins(med(won)), 1)} min (p10-p90 ${f(mins(qt(won, 0.1)), 1)}-${f(mins(qt(won, 0.9)), 1)}) | E2 won ${pc(won.length, n)} lost ${pc(lost, n)} unfinished ${pc(n - won.length - lost, n)}` +
      ` | E5 worst goal gap (per-goal p50) ${f(gaps[worst])} wk (g${worst + 1}) longest wait per run p50 ${m(rs.map((r) => r.goalWait))} | E6 altar restored wk p50 ${m(rs.map((r) => r.tp.stages[0].done ?? NaN))} p10-p90 ${f(qt(rs.map((r) => r.tp.stages[0].done ?? NaN), 0.1))}-${f(qt(rs.map((r) => r.tp.stages[0].done ?? NaN), 0.9))} in 30-80 ${pc(rs.filter((r) => (r.tp.stages[0].done ?? -1) >= 30 && (r.tp.stages[0].done ?? -1) <= 80).length, n)}`,
    `  E7 stage paid & 0 builders >26 wk: ${pc(rs.filter((r) => r.tp.idleRun > 26).length, n)} (longest p50 ${m(rs.map((r) => r.tp.idleRun))} p90 ${f(qt(rs.map((r) => r.tp.idleRun), 0.9))} max ${Math.max(...rs.map((r) => r.tp.idleRun))})` +
      ` | builders per active wk ${f(rs.reduce((a, r) => a + r.tp.builderWeeks, 0) / Math.max(1, rs.reduce((a, r) => a + r.tp.activeWeeks, 0)), 2)} short wks p50 ${m(rs.map((r) => r.tp.shortWeeks))} | famine wks in stages p50 ${m(rs.map((r) => r.tp.famineActive))} runs>0 ${pc(rs.filter((r) => r.tp.famineActive > 0).length, n)}` +
      ` | builders from (sum/run): ${logKeys.map((k) => `${k} ${f(rs.reduce((a, r) => a + (r.tp.log[k] ?? 0), 0) / n, 1)}`).join(', ') || '-'}`,
    ...stages,
  ];
}
/** Ruins package (plano-ruinas 6): R1-R10, the stages' start and end weeks and the herd. */
function ruinsLine(rs: Result[]): string[] {
  const n = rs.length;
  const m = (get: (r: Result) => number, d = 0) => f(med(rs.map(get)), d);
  const q = (get: (r: Result) => number, x: number, d = 0) => f(qt(rs.map(get), x), d);
  const won = rs.filter((r) => r.won).map((r) => r.weeks);
  const restored = rs.filter((r) => r.tp.stages[0].done !== null);
  const ls = (y: number) => m((r) => r.mat.byYear.livestock[y] ?? NaN);
  return [
    `  RV R1 won ${pc(won.length, n)} R2 lost ${pc(rs.filter((r) => r.lost).length, n)} | R3 altar ever without offering ${pc(rs.filter((r) => r.rv.missWeeks > 0).length, n)} (of restored ${pc(restored.filter((r) => r.rv.missWeeks > 0).length, restored.length)}) wks med ${m((r) => r.rv.missWeeks)} p90 ${q((r) => r.rv.missWeeks, 0.9)}` +
      ` | R4 >8 wk in a row ${pc(rs.filter((r) => r.rv.missRun > 8).length, n)} longest med ${m((r) => r.rv.missRun)} p90 ${q((r) => r.rv.missRun, 0.9)} | R5 altar restored wk med ${m((r) => r.tp.stages[0].done ?? NaN)} | R6 win ${f(mins(med(won)), 1)} min` +
      ` | R7 1st pasture yield p10 ${q((r) => r.rv.firstYield, 0.1, 2)} p50 ${q((r) => r.rv.firstYield, 0.5, 2)} p90 ${q((r) => r.rv.firstYield, 0.9, 2)} | R8 pastures med ${m((r) => r.rv.pastures)} max ${Math.max(...rs.map((r) => r.rv.pastures))} | R9 herd full >26 wk ${pc(rs.filter((r) => r.rv.fullRun > 26).length, n)}`,
    `  RV stages start/done wk med: ${TEMPLE_STAGES.map((_, k) => `s${k + 1} ${m((r) => r.tp.stages[k].start ?? NaN)}/${m((r) => r.tp.stages[k].done ?? NaN)}`).join(' ')} | herd at year start Y2-Y12 ${[1, 2, 3, 4, 5, 6, 8, 10, 12].map((y) => ls(y)).join('/')} | end med ${m((r) => r.mat.end.livestock)}`,
  ];
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
  if (args.includes('--squeeze')) { console.log(`${name.padEnd(9)}${squeezeLine(rs)}`); continue; }
  if (args.includes('--ruins')) { console.log(`${name.padEnd(9)}${squeezeLine(rs)}`); for (const l of [...ruinsLine(rs), ...templeLines(rs)]) console.log(l); continue; }
  if (args.includes('--brief')) {
    console.log(`${name.padEnd(9)} ${criteria(rs)} | goals ${GOALS.map((_, i) => f(med(rs.map((r) => r.goalWeeks[i] ?? NaN)))).join(' ')}`);
    for (const l of materialLines(rs)) console.log(l);
    for (const l of b1Lines(rs)) console.log(l);
    for (const l of b2Lines(rs)) console.log(l);
    for (const l of b3Lines(rs)) console.log(l);
    for (const l of templeLines(rs)) console.log(l);
    console.log(squeezeLine(rs));
    for (const l of ruinsLine(rs)) console.log(l);
    if (args.includes('--losses')) for (const r of rs.filter((x) => x.b3.loss)) console.log(`    loss seed ${r.seed} ${JSON.stringify(r.b3.loss)}`);
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
  for (const l of materialLines(rs)) console.log(l);
  for (const l of b1Lines(rs)) console.log(l);
  for (const l of b2Lines(rs)) console.log(l);
  for (const l of b3Lines(rs)) console.log(l);
  for (const l of templeLines(rs)) console.log(l);
  if (args.includes('--losses')) for (const r of rs.filter((x) => x.b3.loss)) console.log(`    loss seed ${r.seed} ${JSON.stringify(r.b3.loss)}`);
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
if (args.includes('--coldrows')) for (const r of all) console.log(`cold ${r.bot} s${r.seed} ${r.won ? 'W' + r.weeks : r.lost ? 'L' + r.weeks : '-'} deaths ${r.b3.coldAll} byYear ${r.b3.coldByYear.join(',')} coldWks ${r.b3.coldWeeksByYear.join(',')} tents ${r.b3.tentsByWinter.join(',')}`);
if (args.includes('--rows')) for (const r of all) console.log([r.bot, r.seed, r.families0, r.foodWeeks0, r.riverDist, r.year1 ? 'Y1ok' : 'Y1x', r.residents52, r.famineY1, r.firstHarvestWeek, r.firstGranaryWeek, r.won ? r.weeks : r.lost ? 'L' + r.weeks : '-', JSON.stringify(r.built)].join(' '));

if (args.includes('--trace')) {
  const [bn, sd, upto] = opt('trace', 'comum:1:80').split(':');
  const rng = createRng(Number(sd));
  const s = createGame(rng, simDifficulty.d);
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
    console.log(`w${s.week} ${ppl} ${seasonOf(s.week).slice(0, 2)} $${f(s.silver)} (${eco.silverDelta >= 0 ? '+' : ''}${eco.silverDelta}) food ${s.food}/${foodCapacity(s)} (${eco.foodDelta}) wood ${s.wood} (+${eco.wood}) stone ${s.stone} (+${eco.stone}) herd ${s.livestock} (+${eco.livestock})${s.temple.done && !s.offered ? ' NO-OFFERING' : ''} gado ${s.livestock} (+${eco.livestock})${s.temple.done && !s.offered ? " NOOFFER" : ""} res ${eco.residents} wk ${eco.workers}/${eco.jobs} fc ${fc ? fc.weeks : '-'} res ${eco.residents} births ${birthBlock(s, eco) ?? 'open'} g${s.goalIndex + 1} T${s.temple.done}${s.temple.active ? `*${s.temple.progress} b${buildersAtWork(s)}` : ''} tg ${JSON.stringify(s.jobTargets)}${s.drought ? ' DRY' : ''}${s.famine ? ' FAMINE' : ''} ${bl !== prevB ? bl : ''}`);
    prevB = bl;
    stepWeek(s, rng);
  }
}

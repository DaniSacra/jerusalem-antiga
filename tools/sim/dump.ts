/**
 * Prints the map of one bot game at a given week, to see why a run got stuck.
 *   npm run sim:dump -- <seed> <bot> <week> [--set table.path=json ...] [--drop-goal N]
 * Legend: 0-4 house level, f field, W well, M market, K workshop, T temple, A altar,
 * # connected road, + loose road, R rock, t tree, ~ river.
 */
import { computeEconomy, createGame, createRng, indexOf, stepWeek } from '../../src/core';
import { Bot, BOTS } from './bots';
import { applyOverrides } from './overrides';

applyOverrides(process.argv.slice(2));

const [seed, bot, until] = [Number(process.argv[2] ?? 1), process.argv[3] ?? 'comum', Number(process.argv[4] ?? 60)];
const rng = createRng(seed);
const s = createGame(rng);
const player = new Bot(s, BOTS[bot], createRng(seed * 7919 + 13));
while (s.week < until && !s.won) {
  player.act(s);
  stepWeek(s, rng);
}
const CH: Record<string, string> = { field: 'f', well: 'W', market: 'M', workshop: 'K', temple: 'T', altar: 'A' };
for (let y = 0; y < s.rows; y++) {
  let line = '';
  for (let x = 0; x < s.cols; x++) {
    const i = indexOf(s, x, y);
    const b = s.grid[i];
    if (b) line += b.kind === 'house' ? String(b.level) : CH[b.kind];
    else if (s.roads[i]) line += s.network[i] ? '#' : '+';
    else if (s.ground[i] === 'river') line += '~';
    else line += s.feature[i] === 'rock' ? 'R' : s.feature[i] ? 't' : '.';
  }
  console.log(line);
}
console.log({ week: s.week, goal: s.goalIndex + 1, silver: s.silver, food: s.food, famine: s.famine, ...computeEconomy(s) });

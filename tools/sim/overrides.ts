/** In-memory overrides of the data tables (and bot profiles), to measure proposals without editing src/data. */
import { BUILDINGS, GOALS, HOUSE_LEVELS, RULES } from '../../src/core';
import { BOTS } from './bots';

const TABLES: Record<string, unknown> = { buildings: BUILDINGS, goals: GOALS, houses: HOUSE_LEVELS, rules: RULES, bots: BOTS };

/**
 * Applies `--set table.path=json` and `--drop-goal N` (1-based; its unlock moves to the goal before).
 * Returns the override arguments found, for printing.
 */
export function applyOverrides(args: string[]): string[] {
  args.forEach((a, i) => {
    if (a !== '--set') return;
    const [path, raw] = args[i + 1].split('=');
    const keys = path.split('.');
    let obj = TABLES as Record<string, unknown>;
    for (const k of keys.slice(0, -1)) obj = obj[k] as Record<string, unknown>;
    const last = keys[keys.length - 1];
    if (!(last in obj)) console.warn(`note: ${path} did not exist`);
    obj[last] = JSON.parse(raw);
  });
  const dropped = args.flatMap((a, i) => (a === '--drop-goal' ? [Number(args[i + 1]) - 1] : [])).sort((a, b) => b - a);
  for (const g of dropped) {
    const [goal] = GOALS.splice(g, 1);
    if (goal?.unlock && GOALS[g - 1]) GOALS[g - 1].unlock ??= goal.unlock;
  }
  return args.filter((a, i) => a === '--set' || a === '--drop-goal' || args[i - 1] === '--set' || args[i - 1] === '--drop-goal');
}

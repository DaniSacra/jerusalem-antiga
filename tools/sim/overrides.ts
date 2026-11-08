/** In-memory overrides of the data tables, to measure proposals without editing src/data. */
import { BUILDINGS, DIFFICULTY, GOALS, HOUSE_LEVELS, RULES, TEMPLE_STAGES } from '../../src/core';

const TABLES: Record<string, unknown> = { difficulty: DIFFICULTY, buildings: BUILDINGS, goals: GOALS, houses: HOUSE_LEVELS, rules: RULES, temple: TEMPLE_STAGES };

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
  // --scale list.field=x / --add list.field=n: every row of a list table (e.g. temple.work=0.8), rounded.
  args.forEach((a, i) => {
    if (a !== '--scale' && a !== '--add') return;
    const [path, raw] = args[i + 1].split('=');
    const [table, field] = path.split('.');
    for (const row of TABLES[table] as Record<string, number>[]) row[field] = Math.max(1, Math.round(a === '--scale' ? row[field] * Number(raw) : row[field] + Number(raw)));
  });
  const dropped = args.flatMap((a, i) => (a === '--drop-goal' ? [Number(args[i + 1]) - 1] : [])).sort((a, b) => b - a);
  for (const g of dropped) {
    const [goal] = GOALS.splice(g, 1);
    if (goal?.unlock && GOALS[g - 1]) GOALS[g - 1].unlock ??= goal.unlock;
  }
  const flags = ['--set', '--drop-goal', '--scale', '--add'];
  return args.filter((a, i) => flags.includes(a) || flags.includes(args[i - 1]));
}

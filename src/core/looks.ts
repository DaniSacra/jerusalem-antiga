import { BUILDINGS, HOUSE_LEVELS } from './data';
import { borderCells, indexOf } from './grid';
import type { Building, Craft, GameState, Rng } from './types';

/** Buildings of the same kind and level sharing an edge with this one. */
function sameLookNeighbours(s: GameState, b: Building): Building[] {
  const out = new Set<Building>();
  for (const c of borderCells(s, b)) {
    const o = s.grid[indexOf(s, c.x, c.y)];
    if (o && o !== b && o.kind === b.kind && o.level === b.level) out.add(o);
  }
  return [...out];
}

/** Number of looks a building can have (houses per level, workshop crafts, others from buildings.json). */
export function variantCount(b: Building): number {
  if (b.kind === 'house') return HOUSE_LEVELS[b.level].variants;
  const def = BUILDINGS[b.kind];
  return def.crafts?.length ?? def.variants ?? 1;
}

/** Trade of a workshop, stored as its variant; null for other kinds. */
export const craftOf = (b: Building): Craft | null => BUILDINGS[b.kind].crafts?.[b.variant] ?? null;

/**
 * Draws a variant and mirroring for buildings with several looks (houses per level, fields,
 * workshop crafts).
 * Avoids the variants of same-kind, same-level neighbours when another one is left.
 * Called when built and, for houses, at every level change.
 */
export function rollLook(s: GameState, b: Building, rng: Rng): void {
  const count = variantCount(b);
  if (count <= 1) return;
  const taken = new Set(sameLookNeighbours(s, b).map((o) => o.variant));
  const all = Array.from({ length: count }, (_, k) => k);
  const free = all.filter((v) => !taken.has(v));
  const pool = free.length ? free : all;
  b.variant = pool[Math.floor(rng() * pool.length)];
  b.mirrored = rng() < 0.5;
}

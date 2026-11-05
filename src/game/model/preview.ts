import {
  BUILDINGS,
  borderCells,
  checkClear,
  computeEconomy,
  foodAfter,
  foodLostIfRemoved,
  harvestsIn,
  indexOf,
  isTree,
  sharedTrees,
  weeksPerCut,
  weeksToHarvest,
  checkPlace,
  costOf,
  onlyNeedsRoad,
  servedHouses,
  serviceOf,
  type Building,
  type Cell,
  type GameState,
  type Rect,
  type ServiceKind,
} from '../../core';
import { T } from '../../render/strings';
import { isPlaceTool, type Tool } from '../../render/tools';
import { originFor, toolDims } from '../placement';

/** `ok` fits now, `road` fits but needs a road (yellow), `bad` something is in the way or no silver (red). */
export type PreviewFit = 'ok' | 'road' | 'bad';

/** The tool preview under the cursor, as data: every view draws it its own way. */
export interface Preview {
  /** Footprint the tool would take. */
  rect: Rect;
  fit: PreviewFit;
  /** The building drawn translucent (null for Mover and Demolir). */
  kind: Exclude<Tool, 'view' | 'clear'> | null;
  /** A service building: what it serves, its reach (clipped to the map) and the houses inside it. */
  service: ServiceKind | null;
  reach: Rect | null;
  served: Building[];
  /** Lines over the preview ("Atende 3 casas", "Rende 2 de comida/sem", "Falta prata…"). */
  lines: string[];
  /** The pill is a warning (red): food lost, nothing yielded off the road, food going negative. */
  bad: boolean;
}

/** The preview of `tool` centred on `hover` (null without a hovered cell or with Mover). */
export function previewOf(s: GameState, tool: Tool, hover: Cell | null, rotated = false): Preview | null {
  if (!hover || tool === 'view') return null;
  const o = originFor(tool, hover, rotated);
  const { w, h } = toolDims(tool, rotated);
  const place = isPlaceTool(tool) ? tool : null;
  const service = place && place !== 'road' ? serviceOf(place) : null;
  const lines: string[] = [];
  let reach: Rect | null = null;
  let served: Building[] = [];
  if (service && place && place !== 'road') {
    const r = BUILDINGS[place].radius ?? 0;
    const x0 = Math.max(0, o.x - r);
    const y0 = Math.max(0, o.y - r);
    reach = { x: x0, y: y0, w: Math.min(s.cols, o.x + w + r) - x0, h: Math.min(s.rows, o.y + h + r) - y0 };
    served = servedHouses(s, place, o.x, o.y, rotated);
    lines.push(place === 'temple' ? T.templeServes(served.length) : T.serves(served.length));
  }
  const roadOnly = !!place && onlyNeedsRoad(s, place, o.x, o.y, rotated);
  const check = place ? checkPlace(s, place, o.x, o.y, rotated) : checkClear(s, o.x, o.y);
  if (roadOnly) lines.push(T.needsRoad);
  // Red only for lack of silver: say so, or the red looks like a bad spot.
  else if (!check.ok && place && (check.reason === 'silver' || check.reason === 'debt')) lines.push(check.reason === 'silver' ? T.missingSilver(costOf(place)) : T.fail.debt);
  const fit: PreviewFit = roadOnly ? 'road' : check.ok ? 'ok' : 'bad';
  const rect = { x: o.x, y: o.y, w, h };
  const out = outputOf(s, tool, rect);
  return { rect, fit, kind: place, service, reach, served, lines: [...out.lines, ...lines], bad: out.bad };
}

/**
 * What the tool gives or takes on that spot: with Demolir, cutting a tree or the food a granary (or
 * the road to one) would spoil; for a gatherer, field or lumber camp, what it brings with the workers
 * there are, the city's food after it, or why it brings nothing (winter, no road).
 */
export function outputOf(s: GameState, tool: Tool, r: Rect): { lines: string[]; bad: boolean } {
  const N = T.nova;
  const none = { lines: [], bad: false };
  if (tool === 'clear') {
    const i = indexOf(s, r.x, r.y);
    if (i < 0) return none;
    const b = s.grid[i];
    if (!b && !s.roads[i] && isTree(s.feature[i])) return { lines: [N.cutTree], bad: false };
    if (b ? !BUILDINGS[b.kind].storage : !s.roads[i]) return none;
    const lost = foodLostIfRemoved(s, r.x, r.y);
    return lost > 0 ? { lines: [N.foodLost(lost)], bad: true } : none;
  }
  if (tool === 'view' || tool === 'road') return none;
  const def = BUILDINGS[tool];
  if (!def.gather && !def.harvest) return none;
  if (def.harvest && !harvestsIn(s.week)) return { lines: [N.inspect.frozen(weeksToHarvest(s.week))], bad: false };
  // Off the road it brings nothing: say so instead of "Rende 0".
  if (def.gather && !borderCells(s, r).some((c) => s.network[indexOf(s, c.x, c.y)])) return { lines: [N.offRoad], bad: true };
  const after = foodAfter(s, tool, { x: r.x, y: r.y, rotated: false });
  const lines = [N.yields(after.yields, after.product)];
  if (tool === 'lumber') {
    const every = weeksPerCut(after.yields);
    if (every) lines.push(N.cutsEvery(every));
  }
  if ((tool === 'lumber' || tool === 'gatherer') && sharedTrees(s, r.x, r.y, tool) > 0) lines.push(N.sharesGrove(tool));
  // Wood and stone: the food line only when its workers would lower the food.
  const food = after.product === 'food' || after.delta < computeEconomy(s).foodDelta;
  if (food) lines.push(N.foodAfter(after.delta));
  return { lines, bad: food && after.delta < 0 };
}

/** Cells of a coverage map that are on (the area a service already reaches). */
export function coveredCells(s: GameState, covered: readonly boolean[]): Cell[] {
  const out: Cell[] = [];
  covered.forEach((on, i) => on && out.push({ x: i % s.cols, y: Math.floor(i / s.cols) }));
  return out;
}

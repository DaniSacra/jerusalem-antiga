import {
  BUILDINGS,
  checkClear,
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
  /** Lines over the preview ("Atende 3 casas", "Cabe aqui: falta ligar à rua", "Falta prata…"). */
  lines: string[];
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
  return { rect: { x: o.x, y: o.y, w, h }, fit, kind: place, service, reach, served, lines };
}

/** Cells of a coverage map that are on (the area a service already reaches). */
export function coveredCells(s: GameState, covered: readonly boolean[]): Cell[] {
  const out: Cell[] = [];
  covered.forEach((on, i) => on && out.push({ x: i % s.cols, y: Math.floor(i / s.cols) }));
  return out;
}

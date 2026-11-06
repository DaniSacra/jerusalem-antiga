import { dimsOf, footprint, indexOf, placeSpots, serviceOf, type Building, type Cell, type GameState, type Rect, type TempleSpot } from '../core';
import { previewOf, coveredCells, type Preview } from '../game/model/preview';
import { C } from '../game/palette';
import { isPlaceTool, type Tool } from '../game/tools';

/** Cells painted on the ground (a translucent colour). */
export interface Fill {
  cells: readonly Cell[];
  color: number;
  alpha: number;
}

/** A rectangle outlined on the ground. */
export interface Outline {
  rect: Rect;
  color: number;
  alpha: number;
}

/** Everything the 3D draws on the ground over the city for the tool in hand, as data. */
export interface Marks {
  fills: Fill[];
  outlines: Outline[];
  /** The building drawn translucent at the cursor, in the fit colour. */
  ghost: { kind: Exclude<Preview['kind'], null | 'road'>; rect: Rect; rotated: boolean; color: number } | null;
  /** The building the demolish tool would remove (drawn red). */
  doomed: Building | null;
  preview: Preview | null;
}

export interface MarksInput {
  tool: Tool;
  hover: Cell | null;
  selected: Cell | null;
  rotated: boolean;
  /** The marked road (tutorial, or the road to a far temple area). */
  ghostRoad: readonly Cell[];
  /** The tutorial's house step: the plaza house spots light up. */
  houseSpots: boolean;
  templeAreas: readonly TempleSpot[];
  /** Spots of the "where to build" helper (balloon), or null. */
  spots: readonly Rect[] | null;
  doomed: Building | null;
}

export const FIT_COLOR = { ok: 0xfff3b0, road: C.needsRoad, bad: C.famine } as const;

const cellsOf = (r: Rect) => footprint(r.x, r.y, r.w, r.h);

/** The ground marks of a moment, as the 2D map's overlay draws them. */
export function marksOf(s: GameState, m: MarksInput): Marks {
  const fills: Fill[] = [];
  const outlines: Outline[] = [];
  const ghostRoad = m.ghostRoad.filter((c) => !s.roads[indexOf(s, c.x, c.y)]);
  if (ghostRoad.length) fills.push({ cells: ghostRoad, color: C.ui.goldLight, alpha: 0.55 });
  if (m.spots) for (const r of m.spots) spot(fills, outlines, r, C.fits);

  if (m.tool === 'view') {
    if (m.selected) {
      const b = s.grid[indexOf(s, m.selected.x, m.selected.y)];
      outlines.push({ rect: b ? { x: b.x, y: b.y, w: b.w, h: b.h } : { ...m.selected, w: 1, h: 1 }, color: 0xfff3b0, alpha: 0.95 });
    }
    return { fills, outlines, ghost: null, doomed: null, preview: null };
  }

  const place = isPlaceTool(m.tool) ? m.tool : null;
  const service = place && place !== 'road' ? serviceOf(place) : null;
  if (place === 'house') fills.push({ cells: coveredCells(s, s.coverage.plaza), color: C.need.plaza, alpha: 0.18 });
  if (service) fills.push({ cells: coveredCells(s, s.coverage[service]), color: C.need[service], alpha: 0.2 });
  if (place === 'temple') {
    const { w, h } = dimsOf('temple');
    for (const a of m.templeAreas) spot(fills, outlines, { x: a.x, y: a.y, w, h }, a.ready ? C.fits : C.needsRoad);
  }
  if (place === 'house' && m.houseSpots) {
    const { w, h } = dimsOf('house');
    for (const o of placeSpots(s, 'house')) spot(fills, outlines, { x: o.x, y: o.y, w, h }, C.fits);
  }

  const preview = previewOf(s, m.tool, m.hover, m.rotated);
  if (!preview) return { fills, outlines, ghost: null, doomed: m.doomed, preview };
  if (preview.reach && preview.service) {
    const color = C.need[preview.service];
    fills.push({ cells: cellsOf(preview.reach), color, alpha: 0.14 });
    outlines.push({ rect: preview.reach, color, alpha: 0.9 });
    for (const b of preview.served) outlines.push({ rect: { x: b.x, y: b.y, w: b.w, h: b.h }, color, alpha: 1 });
  }
  const color = FIT_COLOR[preview.fit];
  fills.push({ cells: cellsOf(preview.rect), color, alpha: 0.35 });
  outlines.push({ rect: preview.rect, color, alpha: 0.9 });
  const ghost = preview.kind && preview.kind !== 'road' ? { kind: preview.kind, rect: preview.rect, rotated: m.rotated, color } : null;
  return { fills, outlines, ghost, doomed: m.doomed, preview };
}

function spot(fills: Fill[], outlines: Outline[], r: Rect, color: number) {
  fills.push({ cells: cellsOf(r), color, alpha: 0.45 });
  outlines.push({ rect: r, color: C.cream, alpha: 0.95 });
}

import { describe, expect, it } from 'vitest';
import { checkClear, indexOf } from '../../src/core';
import { C } from '../../src/game/palette';
import { pitchFor } from '../../src/render3d/camera';
import { FIT_COLOR, marksOf, type MarksInput } from '../../src/render3d/marks';
import { emptyGame, put } from '../helpers';

const input = (o: Partial<MarksInput>): MarksInput => ({ tool: 'view', hover: null, selected: null, rotated: false, ghostRoad: [], houseSpots: false, templeAreas: [], spots: null, doomed: null, ...o });

describe('3D ground marks (as the 2D overlay)', () => {
  it('Mover: only the tapped building is outlined, nothing else', () => {
    const s = emptyGame();
    const b = put(s, 'house', 22, 30, 1);
    const m = marksOf(s, input({ selected: { x: 22, y: 30 } }));
    expect(m.fills).toEqual([]);
    expect(m.outlines).toEqual([{ rect: { x: b.x, y: b.y, w: b.w, h: b.h }, color: 0xfff3b0, alpha: 0.95 }]);
    expect(m.ghost).toBeNull();
    expect(marksOf(s, input({})).outlines).toEqual([]);
  });

  it('a building in hand: its footprint in the fit colour and its ghost model', () => {
    const s = emptyGame();
    const ok = marksOf(s, input({ tool: 'house', hover: { x: 22, y: 30 } }));
    expect(ok.preview!.fit).toBe('ok');
    expect(ok.ghost).toMatchObject({ kind: 'house', color: FIT_COLOR.ok });
    expect(ok.fills.at(-1)!.cells.length).toBe(ok.preview!.rect.w * ok.preview!.rect.h);
    const far = marksOf(s, input({ tool: 'house', hover: { x: 5, y: 5 } }));
    expect(far.ghost!.color).toBe(FIT_COLOR.road);
  });

  it('a road in hand has no ghost model, only the cell', () => {
    const s = emptyGame();
    const m = marksOf(s, input({ tool: 'road', hover: { x: 5, y: 5 } }));
    expect(m.ghost).toBeNull();
    expect(m.fills.at(-1)!.cells).toEqual([{ x: 5, y: 5 }]);
  });

  it('a service shows the area it already covers, its reach and the houses it would serve', () => {
    const s = emptyGame();
    const h = put(s, 'house', 22, 30, 1);
    const m = marksOf(s, input({ tool: 'plaza', hover: { x: 26, y: 30 } }));
    expect(m.outlines.some((o) => o.rect.x === h.x && o.rect.y === h.y && o.color === C.need.plaza)).toBe(true);
    expect(m.outlines.some((o) => o.rect === m.preview!.reach)).toBe(true);
  });

  it('the marked road skips cells already built', () => {
    const s = emptyGame();
    const free = { x: 3, y: 3 };
    const built = { x: 4, y: 3 };
    s.roads[indexOf(s, built.x, built.y)] = true;
    const m = marksOf(s, input({ ghostRoad: [free, built] }));
    expect(m.fills[0].cells).toEqual([free]);
  });

  it('temple areas: green when ready, yellow when a road is missing', () => {
    const s = emptyGame();
    const m = marksOf(s, input({ tool: 'temple', templeAreas: [{ x: 2, y: 2, ready: true }, { x: 8, y: 2, ready: false }] }));
    expect(m.fills.filter((f) => f.color === C.fits).length).toBe(1);
    expect(m.fills.filter((f) => f.color === C.needsRoad).length).toBe(1);
  });

  it('Demolir passes the doomed building on (drawn red)', () => {
    const s = emptyGame();
    const b = put(s, 'house', 22, 30, 1);
    expect(checkClear(s, 22, 30).ok).toBe(true);
    const m = marksOf(s, input({ tool: 'clear', hover: { x: 22, y: 30 }, doomed: b }));
    expect(m.doomed).toBe(b);
  });
});

describe('3D camera tilt follows the zoom', () => {
  it('low over the roofs up close, steeper from far, never past the limits', () => {
    expect(pitchFor(7)).toBeCloseTo(0.62);
    expect(pitchFor(70)).toBeCloseTo(1.22);
    expect(pitchFor(20)).toBeGreaterThan(pitchFor(10));
    expect(pitchFor(1)).toBeCloseTo(0.62);
    expect(pitchFor(200)).toBeCloseTo(1.22);
  });
});

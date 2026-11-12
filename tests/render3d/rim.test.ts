import { describe, expect, it } from 'vitest';
import { entranceCell, indexOf } from '../../src/core';
import LOOK from '../../src/render3d/look3d.json';
import { outside, rimLift, woodland, type Frame } from '../../src/render3d/rim';
import { Terrain } from '../../src/render3d/terrain';
import { emptyGame } from '../helpers';

const R = LOOK.rim;
const frame: Frame = { cols: 48, rows: 48, entranceX: entranceCell().x + 0.5, seed: 3 };
const dry = () => false;

describe('the hills and woods round the map', () => {
  it('measures the distance outside the map rectangle (0 inside)', () => {
    expect(outside(frame, 10, 10)).toBe(0);
    expect(outside(frame, -5, 10)).toBe(5);
    expect(outside(frame, 52, 10)).toBe(4);
    expect(outside(frame, -3, -4)).toBe(5);
  });

  it('lifts the ground only outside the map, rising with the distance, never past the hill height', () => {
    expect(rimLift(frame, 20, 20, 0)).toBe(0);
    expect(rimLift(frame, -0.5, 20, 0)).toBeLessThan(0.1);
    let peak = 0;
    for (let d = 0; d <= 40; d += 2) peak = Math.max(peak, rimLift(frame, -d, 20, 0));
    expect(peak).toBeGreaterThan(R.height * 0.4);
    expect(peak).toBeLessThanOrEqual(R.height);
    expect(rimLift(frame, -20, 20, 0)).toBeGreaterThan(rimLift(frame, -3, 20, 0));
  });

  it('keeps a pass open at the entrance road and a valley where the river runs', () => {
    const out = rimLift(frame, 5, 60, 0);
    expect(rimLift(frame, frame.entranceX, 60, 0)).toBeLessThan(out * 0.2 + 0.01);
    expect(rimLift(frame, 5, 60, 1)).toBe(0);
  });

  it('plants woods only outside the map, off the river and out of the entrance pass', () => {
    const river = (x: number) => x > 60;
    const wood = woodland(frame, () => 0, (x) => river(x));
    expect(wood.length).toBeGreaterThan(500);
    for (const w of wood) {
      expect(outside(frame, w.x, w.z)).toBeGreaterThan(0);
      expect(river(w.x)).toBe(false);
      if (w.z > frame.rows) expect(Math.abs(w.x - frame.entranceX)).toBeGreaterThanOrEqual(R.passWidth * 0.8);
    }
  });

  it('is dense near the edge and thins out with the distance; far pieces are the cheap ones', () => {
    const wood = woodland(frame, () => 0, dry);
    const band = (a: number, b: number) => wood.filter((w) => outside(frame, w.x, w.z) >= a && outside(frame, w.x, w.z) < b).length;
    // The ring grows with the distance, so compare per unit of area: pieces per ring cell.
    const area = (a: number, b: number) => ((48 + 2 * b) ** 2 - (48 + 2 * a) ** 2);
    expect(band(1, 8) / area(1, 8)).toBeGreaterThan(band(30, 44) / area(30, 44));
    for (const w of wood) if (w.far) expect(['pine', 'wood']).toContain(w.key);
    expect(wood.some((w) => w.key === 'oak')).toBe(true);
    expect(wood.some((w) => w.key === 'pine')).toBe(true);
    // Full oaks and olives only close to the map (they cost most).
    for (const w of wood) if (w.key === 'oak' || w.key === 'olive') expect(outside(frame, w.x, w.z)).toBeLessThan(R.richTo + 1);
    expect(wood.length).toBeLessThan(2600);
  });

  it('puts pines up the hills and not on the plain', () => {
    const hilly = woodland(frame, (x, z) => rimLift(frame, x, z, 0), dry);
    const flat = woodland(frame, () => 0, dry);
    const share = (l: typeof flat) => l.filter((w) => w.key === 'pine').length / l.length;
    expect(share(hilly)).toBeGreaterThan(share(flat) * 1.5);
  });

  it('is the same for the same frame (stable)', () => {
    expect(woodland(frame, () => 0, dry)).toEqual(woodland(frame, () => 0, dry));
  });

  it('shapes the terrain: hills outside the map, the map as before, the river bed kept', () => {
    const s = emptyGame();
    const t = new Terrain(s, 11);
    const edge = (z: number) => Math.max(...[2, 12, 22, 32, 40].map((x) => t.height(x, z)));
    expect(edge(-30)).toBeGreaterThan(1.5);
    expect(edge(-30)).toBeGreaterThan(edge(-3));
    // Inside the map the relief stays gentle, as before.
    for (let x = 1; x < 47; x += 5) expect(t.height(x, 20)).toBeLessThan(1);
    for (let z = -40; z < 90; z += 7) for (let x = -40; x < 90; x += 7) if (t.isRiver(x, z)) expect(t.height(x, z)).toBeLessThan(0.9);
    expect(s.ground[indexOf(s, 0, 0)]).toBeDefined();
  });
});

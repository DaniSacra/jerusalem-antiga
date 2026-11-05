import { describe, expect, it } from 'vitest';
import { Anchors, besideX, insideFree, labelScale } from '../../src/ui/anchors';

/** A stand-in for an element: only what Anchors touches. */
const fake = () => {
  const el = { style: { visibility: '', transform: '' }, removed: false, remove() { el.removed = true; } };
  return el;
};
const as = (e: ReturnType<typeof fake>) => e as unknown as HTMLElement;

describe('things pinned to the 3D world', () => {
  it('follow the screen point of their footprint each frame, hidden behind the camera', () => {
    let behind = false;
    const a = new Anchors((r, top = 0) => (behind ? null : { x: r.x * 10, y: r.y * 10 - top }));
    const el = fake();
    a.pin(as(el), { x: 2, y: 3, w: 1, h: 1 }, (p) => `${p.x},${p.y}`, 1);
    a.frame(16);
    expect(el.style).toEqual({ visibility: 'visible', transform: '20,29' });
    behind = true;
    a.frame(16);
    expect(el.style.visibility).toBe('hidden');
    expect(el.style.transform).toBe('20,29');
  });

  it('a still camera writes nothing: styles change only when the point does', () => {
    let x = 1;
    const a = new Anchors(() => ({ x, y: 0 }));
    const writes: string[] = [];
    const el = { style: new Proxy({} as Record<string, string>, { set: (o, k, v) => (writes.push(`${String(k)}=${v}`), (o[k as string] = v), true) }) };
    a.pin(el as unknown as HTMLElement, { x: 0, y: 0, w: 1, h: 1 }, (p) => `${p.x}`);
    a.frame(16);
    a.frame(16);
    expect(writes).toEqual(['visibility=visible', 'transform=1']);
    x = 2;
    a.frame(16);
    expect(writes).toEqual(['visibility=visible', 'transform=1', 'transform=2']);
  });

  it('a rising text ages and leaves the page when its life ends; unpinned things stay put', () => {
    const a = new Anchors((r) => ({ x: r.x, y: r.y }));
    const text = fake();
    const ages: number[] = [];
    a.pin(as(text), { x: 0, y: 0, w: 1, h: 1 }, (_p, age) => (ages.push(age), ''), 0, 100);
    a.frame(40);
    a.frame(40);
    a.frame(40);
    expect(ages).toEqual([40, 80]);
    expect(text.removed).toBe(true);
    const still = fake();
    a.pin(as(still), { x: 1, y: 1, w: 1, h: 1 }, () => 'moved');
    a.unpin(as(still));
    a.frame(16);
    expect(still.style.transform).toBe('');
  });
});

describe('what hides off the free map', () => {
  it('a point under the bars or the column is outside; a pin whose place says null hides', () => {
    const f = { left: 60, top: 90, right: 700, bottom: 300 };
    expect(insideFree({ x: 300, y: 200 }, f)).toBe(true);
    expect(insideFree({ x: 300, y: 40 }, f)).toBe(false);
    expect(insideFree({ x: 760, y: 200 }, f)).toBe(false);
    const a = new Anchors((r) => ({ x: r.x, y: r.y }));
    const el = fake();
    a.pin(as(el), { x: 1, y: 1, w: 1, h: 1 }, () => null);
    a.frame(16);
    expect(el.style.visibility).toBe('hidden');
  });
});

describe('balloons over the buildings at each zoom', () => {
  it('full size up close, never under 60% from far', () => {
    expect(labelScale(3)).toBe(1);
    expect(labelScale(1)).toBe(1);
    expect(labelScale(0.8)).toBeCloseTo(0.8);
    expect(labelScale(0.49)).toBe(0.6);
  });
});

describe('the balloon beside its building', () => {
  it('right of it when it fits, else left; no camera move then', () => {
    expect(besideX(100, 200, 60, 700)).toEqual({ x: 130, nudge: 0 });
    expect(besideX(600, 200, 60, 700)).toEqual({ x: 370, nudge: 0 });
  });

  it('too wide for both sides: kept inside, and the building is asked to move away from it', () => {
    // Building in the middle of a narrow area, more room on the right: balloon on the right edge,
    // the building moves left by what is missing.
    const r = besideX(300, 400, 60, 682);
    expect(r).toEqual({ x: 282, nudge: 282 - 330 });
    // More room on the left: the balloon at the left edge, the building moves right.
    const l = besideX(450, 400, 60, 682);
    expect(l).toEqual({ x: 60, nudge: 60 - (450 - 30 - 400) });
  });

  it('a building past the free area (under the column) keeps the balloon inside and comes back', () => {
    const r = besideX(570, 271, 60, 505);
    expect(r.x).toBe(60);
    expect(r.x + 271).toBeLessThanOrEqual(505);
    expect(r.nudge).toBeLessThan(0);
  });
});

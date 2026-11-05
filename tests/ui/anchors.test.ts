import { describe, expect, it } from 'vitest';
import { Anchors } from '../../src/ui/anchors';

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

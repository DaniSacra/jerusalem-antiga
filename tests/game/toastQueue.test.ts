import { describe, expect, it } from 'vitest';
import { TOAST_BACK_MS, TOAST_MAX, TOAST_MAX_PHONE, TOAST_MS, ToastQueue } from '../../src/game/toastQueue';

const msgs = (q: ToastQueue) => q.list.map((t) => t.msg);

describe('toast line', () => {
  it('shows at most 3, newest first; more wait and come in as others leave', () => {
    const q = new ToastQueue();
    for (const m of ['a', 'b', 'c', 'd']) q.show(m);
    expect(TOAST_MAX).toBe(3);
    expect(msgs(q)).toEqual(['c', 'b', 'a']);
    q.tick(TOAST_MS);
    expect(msgs(q)).toEqual(['d']);
  });

  it('on a phone at most 2; turning to PC lets the waiting one in, back to phone sends the oldest to wait', () => {
    const q = new ToastQueue();
    q.setPhone(true);
    for (const m of ['a', 'b', 'c']) q.show(m);
    expect(TOAST_MAX_PHONE).toBe(2);
    expect(msgs(q)).toEqual(['b', 'a']);
    q.setPhone(false);
    expect(msgs(q)).toEqual(['c', 'b', 'a']);
    q.setPhone(true);
    expect(msgs(q)).toEqual(['c', 'b']);
    expect(q.tick(TOAST_MS)).toBe(true);
    expect(msgs(q)).toEqual(['a']);
    expect(q.tick(10)).toBe(false);
  });

  it('puts bad news before the rest of the line', () => {
    const q = new ToastQueue();
    for (const m of ['a', 'b', 'c', 'good']) q.show(m);
    q.show('bad', 'bad');
    q.tick(TOAST_MS);
    expect(msgs(q)).toEqual(['good', 'bad']);
  });

  it('a repeated message only renews its time', () => {
    const q = new ToastQueue();
    q.show('a');
    q.tick(TOAST_MS - 100);
    q.show('a');
    expect(q.list).toHaveLength(1);
    q.tick(TOAST_MS - 100);
    expect(msgs(q)).toEqual(['a']);
  });

  it('the opening sentence (big) leaves room for one more only', () => {
    const q = new ToastQueue();
    q.show('open', 'good', { big: true });
    q.show('a');
    q.show('b');
    expect(msgs(q)).toEqual(['open']);
  });

  it('a warning that no longer holds leaves the screen and the line', () => {
    const q = new ToastQueue();
    let rank = 0;
    q.show('warn', 'bad', { alert: () => rank });
    rank = -1;
    q.prune();
    expect(q.list).toHaveLength(0);
  });

  it('holds while a panel is open; on close, only the most urgent warning that still holds comes back', () => {
    const q = new ToastQueue();
    q.show('news');
    q.show('w2', 'bad', { alert: () => 2 });
    q.show('w0', 'bad', { alert: () => 0 });
    q.hold(true);
    expect(q.list).toHaveLength(0);
    q.show('birth');
    expect(q.list).toHaveLength(0);
    q.hold(false);
    expect(msgs(q)).toEqual(['w0']);
    expect(q.list[0].left).toBeGreaterThanOrEqual(TOAST_BACK_MS);
  });
});

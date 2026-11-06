import { describe, expect, it } from 'vitest';
import { FADE, MASTER, stepVolume, targetGain } from '../../src/game/music/mix';
import { chordOf, MAJOR, MAX_VOICES, mood, piece, polyphony, RANGE, TONICS, type Note } from '../../src/game/music/score';

const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
const pcOf = (n: Note, tonic: number) => (((n.midi - tonic) % 12) + 12) % 12;

describe('music score (generated, original by construction)', () => {
  const pieces = Array.from({ length: 40 }, (_, k) => piece(k + 1, mood({ season: SEASONS[k % 4], night: k % 5 === 0, rain: k % 7 === 0 })));

  it('the same seed and mood give the same piece; another seed another piece', () => {
    const m = mood({ season: 'spring', night: false, rain: false });
    expect(piece(7, m)).toEqual(piece(7, m));
    expect(piece(8, m).notes).not.toEqual(piece(7, m).notes);
  });

  it('every note is in the major key, in its voice range; keys D, G, F or C', () => {
    for (const p of pieces) {
      expect(TONICS).toContain(p.tonic);
      for (const n of p.notes) {
        expect(MAJOR).toContain(pcOf(n, p.tonic));
        const [lo, hi] = RANGE[n.voice];
        expect(n.midi).toBeGreaterThanOrEqual(lo - 3);
        expect(n.midi).toBeLessThanOrEqual(hi + 2);
        expect(n.vel).toBeGreaterThan(0);
        expect(n.vel).toBeLessThanOrEqual(1);
      }
    }
  });

  it('16 bars (64 beats), at most 6 voices at once, nothing past the end', () => {
    for (const p of pieces) {
      expect(p.beats).toBe(64);
      expect(polyphony(p.notes)).toBeLessThanOrEqual(MAX_VOICES);
      expect(Math.max(...p.notes.map((n) => n.beat + n.dur))).toBeLessThanOrEqual(64);
    }
  });

  it('ends home: the last bar is the I chord and the melody ends on the tonic', () => {
    for (const p of pieces) {
      const lastBar = p.notes.filter((n) => n.voice === 'pad' && n.beat === 60).map((n) => pcOf(n, p.tonic)).sort((a, b) => a - b);
      expect(lastBar).toEqual([...chordOf(0)].sort((a, b) => a - b));
      const lead = p.notes.filter((n) => n.voice === 'harp' || n.voice === 'flute');
      expect(pcOf(lead[lead.length - 1], p.tonic)).toBe(0);
    }
  });

  it('the melody puts chord tones on the strong beats', () => {
    for (const p of pieces) {
      for (const n of p.notes.filter((o) => (o.voice === 'harp' || o.voice === 'flute') && o.beat % 2 === 0)) {
        const chordPcs = p.notes.filter((o) => o.voice === 'pad' && o.beat === Math.floor(n.beat / 4) * 4).map((o) => pcOf(o, p.tonic));
        expect(chordPcs).toContain(pcOf(n, p.tonic));
      }
    }
  });

  it('mood: spring and summer on harp and faster; autumn and winter on flute, slower and lower; night softer, slower and sparser', () => {
    const m = (season: (typeof SEASONS)[number], night = false, rain = false) => mood({ season, night, rain });
    expect([m('spring').lead, m('summer').lead, m('autumn').lead, m('winter').lead]).toEqual(['harp', 'harp', 'flute', 'flute']);
    expect(m('winter').bpm).toBeLessThan(m('spring').bpm);
    expect(m('winter').register).toBeLessThan(m('spring').register);
    for (const s of SEASONS) {
      expect(m(s).bpm).toBeGreaterThanOrEqual(60);
      expect(m(s).bpm).toBeLessThanOrEqual(76);
      expect(m(s, true).gain).toBeCloseTo(m(s).gain * 0.7);
      expect(m(s, true).lead).toBe('flute');
      expect(m(s, true).density).toBeLessThan(m(s).density);
      expect(m(s, false, true).gain).toBeLessThan(m(s).gain);
    }
  });
});

describe('music mix', () => {
  it('silent when off or the tab is hidden; volume² times the mood otherwise, rising with the volume', () => {
    expect(targetGain({ on: false, volume: 1, hidden: false, moodGain: 1 })).toBe(0);
    expect(targetGain({ on: true, volume: 1, hidden: true, moodGain: 1 })).toBe(0);
    expect(targetGain({ on: true, volume: 1, hidden: false, moodGain: 1 })).toBe(MASTER);
    expect(targetGain({ on: true, volume: 0.5, hidden: false, moodGain: 0.7 })).toBeCloseTo(MASTER * 0.25 * 0.7);
    const curve = [0, 0.1, 0.3, 0.5, 0.8, 1].map((volume) => targetGain({ on: true, volume, hidden: false, moodGain: 1 }));
    expect([...curve].sort((a, b) => a - b)).toEqual(curve);
    expect(FADE.hide).toBeLessThan(FADE.out);
  });

  it('the − / + buttons move the volume 0.1, kept in 0..1', () => {
    expect([stepVolume(0.5, 1), stepVolume(0.5, -1), stepVolume(1, 1), stepVolume(0, -1), stepVolume(0.7, 1)]).toEqual([0.6, 0.4, 1, 0, 0.8]);
  });
});

describe('music settings and key', () => {
  it('on by default at 50%; M turns it off and on, and the listeners hear each saved change', async () => {
    const { settings, onSettings } = await import('../../src/game/settings');
    const { keyCommand, runKey } = await import('../../src/game/keys');
    expect([settings.music, settings.musicVolume]).toEqual([true, 0.5]);
    expect(keyCommand('M')).toEqual({ do: 'music' });
    let heard = 0;
    const off = onSettings(() => heard++);
    const view = { closeTop: () => false, turnMap: () => {} };
    runKey({ do: 'music' }, {} as never, view);
    expect([settings.music, heard]).toEqual([false, 1]);
    runKey({ do: 'music' }, {} as never, view);
    expect([settings.music, heard]).toEqual([true, 2]);
    off();
    runKey({ do: 'music' }, {} as never, view);
    expect(heard).toBe(2);
    settings.music = true;
  });
});

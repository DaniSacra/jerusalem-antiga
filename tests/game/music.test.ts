import { describe, expect, it } from 'vitest';
import { FADE, MASTER, stepVolume, targetGain } from '../../src/game/music/mix';
import { chordOf, DRUM, MAJOR, MAX_VOICES, mood, piece, polyphony, RANGE, silenceAfter, STYLE, TONICS, type Note } from '../../src/game/music/score';

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
        if (n.voice !== 'drum') expect(MAJOR).toContain(pcOf(n, p.tonic));
        const [lo, hi] = n.voice === 'piano' ? [RANGE.piano[0] - 3, RANGE.piano[1] + 7] : RANGE[n.voice];
        expect(n.midi).toBeGreaterThanOrEqual(lo - 3);
        expect(n.midi).toBeLessThanOrEqual(hi + 2);
        expect(n.vel).toBeGreaterThan(0);
        expect(n.vel).toBeLessThanOrEqual(1);
      }
    }
  });

  it('16 bars (64 beats), at most 10 voices at once, nothing past the end', () => {
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
      const lead = p.notes.filter((n) => n.voice === 'piano');
      expect(pcOf(lead[lead.length - 1], p.tonic)).toBe(0);
    }
  });

  it('one piece per season: its own key, and the first phrase is the theme note for note whatever the seed', () => {
    expect(SEASONS.map((s) => STYLE[s].tonic)).toEqual(TONICS);
    for (const s of SEASONS) {
      const m = mood({ season: s, night: false, rain: false });
      const theme = (seed: number) => piece(seed, m).notes.filter((n) => n.voice === 'piano' && n.beat < 16);
      expect(piece(3, m).tonic).toBe(STYLE[s].tonic);
      expect(theme(3)).toEqual(theme(99));
    }
    // The four themes differ from each other.
    const first = SEASONS.map((s) => JSON.stringify(piece(1, mood({ season: s, night: false, rain: false })).notes.filter((n) => n.voice === 'piano' && n.beat < 16).map((n) => [n.beat, n.dur])));
    expect(new Set(first).size).toBe(4);
  });

  it('piano over synths, no flute: each season has its accompaniment', () => {
    const day = (s: (typeof SEASONS)[number]) => piece(5, mood({ season: s, night: false, rain: false }));
    for (const s of SEASONS) {
      const p = day(s);
      expect(new Set(p.notes.map((n) => n.voice)).has('piano')).toBe(true);
      expect(p.notes.filter((n) => n.voice === 'keys').length).toBeGreaterThan(16);
      expect(p.notes.filter((n) => n.voice === 'bass').length).toBeGreaterThanOrEqual(16);
      expect(p.notes.filter((n) => n.voice === 'pad').length).toBe(48);
      const drums = p.notes.filter((n) => n.voice === 'drum');
      expect(drums.every((n) => n.beat >= 16 && n.beat < 60 && (n.midi === DRUM.low || n.midi === DRUM.shaker))).toBe(true);
    }
    // Happy but calm (2026-11-08): the drum by day in every season; the arpeggio but in winter, the music box.
    for (const s of SEASONS) expect(day(s).notes.some((n) => n.voice === 'drum')).toBe(true);
    expect(day('summer').notes.filter((n) => n.voice === 'arp').length).toBeGreaterThan(day('spring').notes.filter((n) => n.voice === 'arp').length);
    expect(day('spring').notes.some((n) => n.voice === 'arp' && n.beat < 16)).toBe(false);
    expect(day('autumn').notes.some((n) => n.voice === 'arp' && n.beat < 16)).toBe(false);
    expect(day('autumn').notes.some((n) => n.voice === 'arp')).toBe(true);
    expect(day('winter').notes.some((n) => n.voice === 'arp')).toBe(false);
    expect(day('summer').notes.filter((n) => n.voice === 'drum').length).toBeGreaterThan(day('winter').notes.filter((n) => n.voice === 'drum').length);
    // No chord held through the bar but the ending: winter chimes in eighths, autumn dances 1-and-2.
    for (const s of SEASONS) expect(day(s).notes.filter((n) => n.voice === 'keys' && n.beat < 60).every((n) => n.dur <= 1)).toBe(true);
    expect(day('winter').notes.filter((n) => n.voice === 'keys' && n.beat < 60).every((n) => n.dur === 0.5)).toBe(true);
    expect(day('spring').notes.filter((n) => n.voice === 'keys' && n.beat < 60).every((n) => n.dur === 0.5)).toBe(true);
    // Darker pad in autumn, more echo in winter, short echoes everywhere.
    expect(day('autumn').pad).toBeLessThan(day('summer').pad);
    expect(day('winter').echo).toBeGreaterThan(day('summer').echo);
    for (const s of SEASONS) expect(day(s).echo).toBeLessThanOrEqual(0.4);
    const rng = () => 0.5;
    expect(silenceAfter(() => 0)).toBeGreaterThanOrEqual(4);
    expect(silenceAfter(rng)).toBeGreaterThanOrEqual(4);
    expect(silenceAfter(() => 0.999)).toBeLessThanOrEqual(8);
  });

  it('the melody puts chord tones on the strong beats', () => {
    for (const p of pieces) {
      for (const n of p.notes.filter((o) => o.voice === 'piano' && o.beat % 2 === 0)) {
        const chordPcs = p.notes.filter((o) => o.voice === 'pad' && o.beat === Math.floor(n.beat / 4) * 4).map((o) => pcOf(o, p.tonic));
        expect(chordPcs).toContain(pcOf(n, p.tonic));
      }
    }
  });

  it('mood: summer the fastest, winter the slowest; night softer, a touch slower, sparser and without drum', () => {
    const m = (season: (typeof SEASONS)[number], night = false, rain = false) => mood({ season, night, rain });
    expect(m('winter').bpm).toBeLessThan(m('autumn').bpm);
    expect(m('autumn').bpm).toBeLessThan(m('spring').bpm);
    expect(m('spring').bpm).toBeLessThan(m('summer').bpm);
    for (const s of SEASONS) {
      // Happy and calm (the 60–76 and then 84–100 bpm versions were sleepy): 96–112 bpm, night included.
      expect(m(s, true).bpm).toBeGreaterThanOrEqual(96);
      expect(m(s).bpm).toBeLessThanOrEqual(112);
      expect(m(s, true).bpm).toBeLessThan(m(s).bpm);
      expect(m(s, true).gain).toBeCloseTo(m(s).gain * 0.75);
      expect(m(s, true).drums).toBe(0);
      expect(m(s, true).density).toBeLessThan(m(s).density);
      expect(m(s, false, true).gain).toBeLessThan(m(s).gain);
      expect(piece(2, m(s, true)).notes.some((n) => n.voice === 'drum')).toBe(false);
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

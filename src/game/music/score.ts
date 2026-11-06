import { createRng, type Rng, type Season } from '../../core';

/**
 * The background music's score (pure: no Web Audio). Not random notes: a hand-written bank of major
 * progressions, an AABA form of 4-bar phrases, a 2-bar motif repeated and varied, and a melody on the
 * major pentatonic with chord tones on the strong beats. `src/app/music.ts` plays it.
 * See docs/arquitetura-3d.md section 12.
 */

export type Voice = 'harp' | 'flute' | 'pad' | 'bass';

/** One note: `beat` from the start of the piece, `dur` in beats, `vel` 0..1. */
export interface Note {
  voice: Voice;
  beat: number;
  midi: number;
  dur: number;
  vel: number;
}

export interface Piece {
  /** MIDI number of the tonic (the key). */
  tonic: number;
  bpm: number;
  /** Length in beats (4 per bar). */
  beats: number;
  notes: Note[];
}

/** How the music feels now: tempo, the melody's instrument, register, how many notes, loudness. */
export interface Mood {
  bpm: number;
  lead: 'harp' | 'flute';
  /** Semitones added to the melody's range (lower in autumn and winter). */
  register: number;
  /** 0..1: arpeggios and passing notes. */
  density: number;
  /** Loudness factor (night is softer). */
  gain: number;
}

export interface MoodInput {
  season: Season;
  night: boolean;
  rain: boolean;
}

const BY_SEASON: Record<Season, Mood> = {
  spring: { bpm: 72, lead: 'harp', register: 0, density: 0.8, gain: 1 },
  summer: { bpm: 76, lead: 'harp', register: 2, density: 0.7, gain: 1 },
  autumn: { bpm: 66, lead: 'flute', register: -2, density: 0.5, gain: 0.9 },
  winter: { bpm: 60, lead: 'flute', register: -3, density: 0.3, gain: 0.85 },
};

/** The mood of a season, softer, slower and sparser at night (flute) and a little in the rain. */
export function mood({ season, night, rain }: MoodInput): Mood {
  const m = { ...BY_SEASON[season] };
  if (night) Object.assign(m, { bpm: m.bpm - 6, lead: 'flute', density: m.density * 0.5, gain: m.gain * 0.7 });
  if (rain) Object.assign(m, { density: m.density * 0.8, gain: m.gain * 0.9 });
  return m;
}

/** Semitones of the major scale and of its pentatonic. */
export const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const PENTA = [0, 2, 4, 7, 9];
/** The keys: D, G, F and C major. */
export const TONICS = [62, 55, 65, 60];
/** Melody, accompaniment and bass ranges (MIDI). */
export const RANGE: Record<Voice, [number, number]> = { harp: [60, 84], flute: [62, 86], pad: [50, 67], bass: [36, 52] };
export const MAX_VOICES = 6;

/** Progressions of 4 chords as scale degrees (0 = I, 3 = IV, 4 = V, 5 = vi): one chord per bar. */
const A_PROGS = [
  [0, 5, 3, 4],
  [0, 3, 0, 4],
  [0, 2, 3, 4],
  [0, 3, 5, 4],
];
const B_PROGS = [
  [3, 4, 2, 5],
  [5, 3, 1, 4],
  [3, 0, 3, 4],
];
/** The last phrase ends home: a cadence to I. */
const END = [3, 4, 0, 0];

/** Two-bar rhythms (beat offset, length) for the motif. */
const RHYTHMS: [number, number][][] = [
  [[0, 1.5], [1.5, 0.5], [2, 2], [4, 1], [5, 1], [6, 2]],
  [[0, 1], [1, 1], [2, 1.5], [3.5, 0.5], [4, 3], [7, 1]],
  [[0, 2], [2, 1], [3, 1], [4, 2], [6, 2]],
  [[0, 1], [1, 0.5], [1.5, 0.5], [2, 2], [4, 1.5], [5.5, 0.5], [6, 2]],
];

const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)];
const pc = (midi: number, tonic: number) => (((midi - tonic) % 12) + 12) % 12;

/** Pitch classes (from the tonic) of the triad on a scale degree. */
export function chordOf(degree: number): number[] {
  return [0, 2, 4].map((k) => MAJOR[(degree + k) % 7]);
}

/** All MIDI notes in [lo, hi] whose pitch class (from the tonic) is in `set`. */
function notesIn(set: number[], tonic: number, [lo, hi]: [number, number]): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (set.includes(pc(m, tonic))) out.push(m);
  return out;
}

const nearest = (list: number[], to: number) => list.reduce((a, m) => (Math.abs(m - to) < Math.abs(a - to) ? m : a));

/** The melody of one phrase (4 bars): the motif twice, the second time varied; chord tones on strong beats. */
function phrase(rng: Rng, tonic: number, prog: number[], motif: { rhythm: [number, number][]; steps: number[] }, range: [number, number], start: number, end: boolean, from: number): { notes: Omit<Note, 'voice'>[]; last: number } {
  const penta = notesIn(PENTA, tonic, range);
  const notes: Omit<Note, 'voice'>[] = [];
  let prev = from;
  for (let half = 0; half < 2; half++) {
    const vary = half === 1 && rng() < 0.6;
    motif.rhythm.forEach(([at, dur], k) => {
      const beat = half * 8 + at;
      const chord = chordOf(prog[Math.floor(beat / 4)]);
      const step = vary && k === motif.rhythm.length - 1 ? -motif.steps[k] : motif.steps[k];
      const i = penta.indexOf(nearest(penta, prev));
      let midi = penta[Math.max(0, Math.min(penta.length - 1, i + step))];
      if (beat % 2 === 0) midi = nearest(notesIn(chord, tonic, range), midi); // strong beats: a chord tone
      notes.push({ beat: start + beat, midi, dur, vel: beat % 4 === 0 ? 0.62 : 0.5 });
      prev = midi;
    });
  }
  if (end) {
    // Home: the last note is the tonic, held to the end of the phrase.
    const last = notes[notes.length - 1];
    last.midi = nearest(notesIn([0], tonic, range), last.midi);
    last.dur = start + 16 - last.beat;
  }
  return { notes, last: prev };
}

/** A piece of 16 bars (AABA), seeded: the same seed and mood give the same piece. */
export function piece(seed: number, m: Mood): Piece {
  const rng = createRng(seed);
  const tonic = pick(rng, TONICS);
  const a = pick(rng, A_PROGS);
  const b = pick(rng, B_PROGS);
  const form = [a, a, b, END];
  const motif = (steps: number[]) => {
    const rhythm = pick(rng, RHYTHMS);
    return { rhythm, steps: rhythm.map(() => pick(rng, steps)) };
  };
  const motifA = motif([-2, -1, -1, 0, 1, 1, 2]);
  const motifB = motif([-1, 1, 1, 2, -2]);
  const [lo, hi] = RANGE[m.lead];
  const range: [number, number] = [lo + m.register, hi + m.register];
  const notes: Note[] = [];
  let prev = nearest(notesIn([0], tonic, range), (range[0] + range[1]) / 2);
  form.forEach((prog, p) => {
    const start = p * 16;
    const mel = phrase(rng, tonic, prog, p === 2 ? motifB : motifA, range, start, p === 3, prev);
    prev = mel.last;
    for (const n of mel.notes) notes.push({ voice: m.lead, ...n });
    prog.forEach((degree, bar) => {
      const at = start + bar * 4;
      const chord = chordOf(degree);
      // Pad: the triad held through the bar, close to the middle of its range.
      const pad = RANGE.pad;
      for (const c of chord) notes.push({ voice: 'pad', beat: at, midi: nearest(notesIn([c], tonic, pad), (pad[0] + pad[1]) / 2), dur: 4, vel: 0.28 });
      // Bass: the root on beat 1 (and the fifth on beat 3 when it moves).
      const root = nearest(notesIn([chord[0]], tonic, RANGE.bass), 43);
      const last = p === 3 && bar === 3;
      notes.push({ voice: 'bass', beat: at, midi: root, dur: last ? 4 : 2, vel: 0.45 });
      if (!last && rng() < m.density) notes.push({ voice: 'bass', beat: at + 2, midi: nearest(notesIn([chord[2]], tonic, RANGE.bass), root + 7), dur: 2, vel: 0.35 });
    });
  });
  return { tonic, bpm: m.bpm, beats: 64, notes: notes.sort((x, y) => x.beat - y.beat || x.midi - y.midi) };
}

/** Most notes sounding at once (a note sounds over [beat, beat + dur)). */
export function polyphony(notes: readonly Note[]): number {
  const edges = notes.flatMap((n) => [[n.beat, 1] as const, [n.beat + n.dur, -1] as const]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let now = 0;
  let most = 0;
  for (const [, d] of edges) most = Math.max(most, (now += d));
  return most;
}

/** Seconds of quiet after a piece (15–40 s): what keeps hours of play restful. */
export const silenceAfter = (rng: Rng) => 15 + rng() * 25;

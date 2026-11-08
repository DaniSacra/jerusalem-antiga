import { createRng, type Rng, type Season } from '../../core';

/**
 * The background music's score (pure: no Web Audio). Four pieces, one per season, each with its own
 * key, tempo, theme and accompaniment, played on piano over soft synthesizers. The user asked for
 * "piano with synths that keep us calm and wanting to play" and then (2026-11-08) for happier music,
 * calm but not sleepy: every season now walks at 100-112 bpm on bright major progressions, with a
 * light drum and short echoes.
 * - spring (D major, 108 bpm): a skipping, dotted theme that climbs over rising broken chords and a
 *   light synth arpeggio, the town waking up;
 * - summer (G major, 112 bpm): a syncopated, bright theme, chord stabs, a full arpeggio and the
 *   hand drum and shaker, the long warm days;
 * - autumn (F major, 104 bpm): a village dance, bass and chord in turn (oom-pah), a playful theme in
 *   eighths, the harvest feast;
 * - winter (C major, 100 bpm): a music box, high bell-like notes over a chiming eighth figure, a soft
 *   shaker, the plagal "amen" ending, the warm house by the fire.
 * Form AABA of 4-bar phrases: the first A is always the season's theme note for note (so each season
 * is one recognizable piece); the seed varies the second A, the bridge and the accompaniment's fills.
 * `src/app/music.ts` plays it. See docs/arquitetura-3d.md section 12.
 */

export type Voice = 'piano' | 'keys' | 'arp' | 'pad' | 'bass' | 'drum';

/** The drum's two sounds (its `midi`): a soft low hand drum and a light shaker. */
export const DRUM = { low: 36, shaker: 42 };

/** One note: `beat` from the start of the piece, `dur` in beats, `vel` 0..1. */
export interface Note {
  voice: Voice;
  beat: number;
  midi: number;
  dur: number;
  vel: number;
}

export interface Piece {
  season: Season;
  /** MIDI number of the tonic (the key). */
  tonic: number;
  bpm: number;
  /** Length in beats (4 per bar). */
  beats: number;
  /** The synth pad's filter (Hz) and the echo's send (0..1), for the player. */
  pad: number;
  echo: number;
  notes: Note[];
}

/** How the music feels now. */
export interface Mood {
  season: Season;
  bpm: number;
  /** 0..1: passing notes and fills. */
  density: number;
  /** 0..1: how much of the synth arpeggio plays (0: none). */
  arp: number;
  /** 0..1: how much of the hand drum and shaker plays (0: none). */
  drums: number;
  /** Loudness factor (night is softer). */
  gain: number;
}

export interface MoodInput {
  season: Season;
  night: boolean;
  rain: boolean;
}

type Keys = 'rise' | 'stab' | 'bounce' | 'chime';

/** What makes each season's piece its own (hand-written). */
interface Style {
  tonic: number;
  bpm: number;
  density: number;
  arp: number;
  drums: number;
  gain: number;
  /** Semitones added to the melody's range. */
  register: number;
  /** The theme: a 2-bar rhythm (beat offset, length) and its steps on the pentatonic. */
  rhythm: [number, number][];
  steps: number[];
  /** Steps the seed may pick for the bridge's motif. */
  bridgeSteps: number[];
  /** The A progression (one chord per bar, scale degrees: 0 = I, 3 = IV, 4 = V, 5 = vi), the bridges, the ending. */
  a: number[];
  b: number[][];
  end: number[];
  keys: Keys;
  pad: number;
  echo: number;
}

export const STYLE: Record<Season, Style> = {
  spring: {
    tonic: 62, bpm: 108, density: 0.85, arp: 0.6, drums: 0.6, gain: 1, register: 0,
    rhythm: [[0, 0.75], [0.75, 0.25], [1, 0.5], [1.5, 0.5], [2, 1], [3, 0.5], [3.5, 0.5], [4, 0.75], [4.75, 0.25], [5, 1], [6, 1.5], [7.5, 0.5]],
    steps: [0, 1, 1, 1, -1, 1, 1, 2, -1, -1, 1, 1],
    bridgeSteps: [-1, 1, 1, 2],
    a: [0, 3, 4, 0], b: [[3, 4, 0, 5], [5, 3, 4, 4]], end: [3, 4, 0, 0],
    keys: 'rise', pad: 1700, echo: 0.25,
  },
  summer: {
    tonic: 55, bpm: 112, density: 1, arp: 1, drums: 1, gain: 1, register: 7,
    rhythm: [[0, 0.5], [0.5, 1], [1.5, 0.5], [2, 0.5], [2.5, 1], [3.5, 0.5], [4, 1], [5, 0.5], [5.5, 0.5], [6, 2]],
    steps: [0, 2, -1, 1, 2, -1, -2, 1, 1, 0],
    bridgeSteps: [-2, -1, 1, 2],
    a: [0, 3, 0, 4], b: [[5, 3, 0, 4], [3, 4, 5, 4]], end: [3, 4, 0, 0],
    keys: 'stab', pad: 1900, echo: 0.22,
  },
  autumn: {
    tonic: 65, bpm: 104, density: 0.8, arp: 0.35, drums: 0.7, gain: 1, register: 0,
    rhythm: [[0, 0.5], [0.5, 0.5], [1, 1], [2, 0.5], [2.5, 0.5], [3, 1], [4, 0.5], [4.5, 0.5], [5, 0.5], [5.5, 0.5], [6, 2]],
    steps: [0, 1, 1, -1, 1, 1, -1, -1, -1, 2, 1],
    bridgeSteps: [-1, 1, 2, -2],
    a: [0, 5, 3, 4], b: [[3, 0, 3, 4], [5, 3, 1, 4]], end: [3, 4, 0, 0],
    keys: 'bounce', pad: 1400, echo: 0.28,
  },
  winter: {
    tonic: 60, bpm: 100, density: 0.7, arp: 0, drums: 0.35, gain: 0.95, register: 5,
    rhythm: [[0, 1], [1, 0.5], [1.5, 0.5], [2, 1], [3, 1], [4, 0.5], [4.5, 0.5], [5, 0.5], [5.5, 0.5], [6, 2]],
    steps: [0, 2, -1, 1, -1, 1, 1, -1, 1, -2],
    bridgeSteps: [-1, 1, 2, -2],
    a: [0, 3, 5, 4], b: [[3, 0, 3, 4], [5, 3, 0, 4]], end: [3, 3, 0, 0],
    keys: 'chime', pad: 1500, echo: 0.38,
  },
};

/** The mood of a season; at night softer, a touch slower and sparser with no drum; a little in the rain. */
export function mood({ season, night, rain }: MoodInput): Mood {
  const s = STYLE[season];
  const m: Mood = { season, bpm: s.bpm, density: s.density, arp: s.arp, drums: s.drums, gain: s.gain };
  if (night) Object.assign(m, { bpm: m.bpm - 4, density: m.density * 0.7, arp: m.arp * 0.6, drums: 0, gain: m.gain * 0.75 });
  if (rain) Object.assign(m, { density: m.density * 0.8, gain: m.gain * 0.9 });
  return m;
}

/** Semitones of the major scale and of its pentatonic. */
export const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const PENTA = [0, 2, 4, 7, 9];
/** The keys: D, G, F and C major (spring, summer, autumn, winter). */
export const TONICS = [62, 55, 65, 60];
/** Voice ranges (MIDI); the melody's moves with the season's register. */
export const RANGE: Record<Voice, [number, number]> = { piano: [60, 84], keys: [50, 72], arp: [67, 86], pad: [48, 67], bass: [33, 52], drum: [36, 42] };
export const MAX_VOICES = 10;

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

interface Motif {
  rhythm: [number, number][];
  steps: number[];
}

/** The melody of one phrase (4 bars): the motif twice (the second time varied when `vary`); chord tones on strong beats. */
function phrase(tonic: number, prog: number[], motif: Motif, range: [number, number], start: number, end: boolean, from: number, vary: boolean): { notes: Omit<Note, 'voice'>[]; last: number } {
  const penta = notesIn(PENTA, tonic, range);
  const notes: Omit<Note, 'voice'>[] = [];
  let prev = from;
  for (let half = 0; half < 2; half++) {
    motif.rhythm.forEach(([at, dur], k) => {
      const beat = half * 8 + at;
      const chord = chordOf(prog[Math.floor(beat / 4)]);
      const step = half === 1 && vary && k === motif.rhythm.length - 1 ? -motif.steps[k] : motif.steps[k];
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

/** The piano's left hand over one bar, by the season's style. */
function keysBar(out: Note[], rng: Rng, style: Keys, chord: number[], tonic: number, at: number, density: number) {
  const tones = notesIn(chord, tonic, RANGE.keys);
  const root = tones.find((t) => pc(t, tonic) === chord[0]) ?? tones[0];
  const up = tones.filter((t) => t >= root).slice(0, 4);
  const u = (k: number) => up[Math.min(k, up.length - 1)];
  const add = (beat: number, midi: number, dur: number, vel: number) => out.push({ voice: 'keys', beat: at + beat, midi, dur, vel });
  if (style === 'rise') {
    // Rising broken chord in eighths, the town's step.
    [0, 1, 2, 3, 2, 1, 2, 3].forEach((k, e) => (e % 2 === 0 || rng() < density) && add(e * 0.5, u(k), 0.5, e % 2 ? 0.26 : 0.34));
  } else if (style === 'stab') {
    // Syncopated two-note stabs (the bass has the root).
    for (const [b, d] of [[0, 1], [1.5, 0.5], [2.5, 1], [3.5, 0.5]] as const) {
      if (b === 3.5 && rng() > density) continue;
      add(b, u(1), d, 0.3);
      add(b, u(2), d, 0.28);
    }
  } else if (style === 'bounce') {
    // A village dance: the root on 1 and 3, the chord on 2 and 4, a pick-up on the last "and".
    for (const b of [0, 2]) add(b, u(0), 1, 0.32);
    for (const b of [1, 3]) {
      add(b, u(1), 0.5, 0.27);
      add(b, u(2), 0.5, 0.25);
    }
    if (rng() < density) add(3.5, u(1), 0.5, 0.22);
  } else {
    // A music box: a chiming eighth figure, root, fifth, third, fifth.
    [0, 2, 1, 2, 0, 2, 1, 3].forEach((k, e) => (e % 2 === 0 || rng() < density + 0.2) && add(e * 0.5, u(k), 0.5, e % 2 ? 0.22 : 0.28));
  }
}

/** The ending: a rolled chord held through the last bar. */
function keysEnd(out: Note[], chord: number[], tonic: number, at: number) {
  const tones = notesIn(chord, tonic, RANGE.keys);
  const root = tones.find((t) => pc(t, tonic) === chord[0]) ?? tones[0];
  tones.filter((t) => t >= root).slice(0, 3).forEach((midi, k) => out.push({ voice: 'keys', beat: at + k * 0.25, midi, dur: 4 - k * 0.25, vel: 0.28 }));
}

/** A piece of 16 bars (AABA) for the mood's season, seeded: the same seed and mood give the same piece. */
export function piece(seed: number, m: Mood): Piece {
  const rng = createRng(seed);
  const s = STYLE[m.season];
  const tonic = s.tonic;
  const form = [s.a, s.a, pick(rng, s.b), s.end];
  const theme: Motif = { rhythm: s.rhythm, steps: s.steps };
  const rhythmB = s.rhythm.map(([at, dur]) => [at, dur] as [number, number]);
  const bridge: Motif = { rhythm: rhythmB, steps: rhythmB.map(() => pick(rng, s.bridgeSteps)) };
  const range: [number, number] = [RANGE.piano[0] + s.register, RANGE.piano[1] + s.register];
  const notes: Note[] = [];
  let prev = nearest(notesIn([0], tonic, range), (range[0] + range[1]) / 2);
  form.forEach((prog, p) => {
    const start = p * 16;
    // The first A is the theme note for note; later phrases may vary.
    const mel = phrase(tonic, prog, p === 2 ? bridge : theme, range, start, p === 3, prev, p > 0 && rng() < 0.6);
    prev = mel.last;
    for (const n of mel.notes) notes.push({ voice: 'piano', ...n });
    prog.forEach((degree, bar) => {
      const at = start + bar * 4;
      const chord = chordOf(degree);
      const last = p === 3 && bar === 3;
      // Pad: the triad held through the bar, close to the middle of its range.
      const pad = RANGE.pad;
      for (const c of chord) notes.push({ voice: 'pad', beat: at, midi: nearest(notesIn([c], tonic, pad), (pad[0] + pad[1]) / 2), dur: 4, vel: m.season === 'winter' ? 0.2 : 0.17 });
      if (last) keysEnd(notes, chord, tonic, at);
      else keysBar(notes, rng, s.keys, chord, tonic, at, m.density);
      // Synth arpeggio (summer throughout, spring and autumn from the second phrase; never winter): eighths up and down an octave higher.
      if (m.arp > 0 && !last && (m.season === 'summer' || p > 0)) {
        const tones = notesIn(chord, tonic, RANGE.arp).slice(0, 4);
        [0, 1, 2, 3, 2, 1, 2, 1].forEach((k, e) => {
          if (rng() < m.arp) notes.push({ voice: 'arp', beat: at + e * 0.5, midi: tones[Math.min(k, tones.length - 1)], dur: 0.5, vel: e % 2 ? 0.26 : 0.32 });
        });
      }
      // Hand drum on 1 and the "and" of 2, a shaker on the off-beats: soft, never in the first phrase or the last bar.
      if (m.drums > 0 && !last && p > 0) {
        notes.push({ voice: 'drum', beat: at, midi: DRUM.low, dur: 0.5, vel: 0.5 });
        if (rng() < m.drums) notes.push({ voice: 'drum', beat: at + 2.5, midi: DRUM.low, dur: 0.5, vel: 0.3 });
        for (const off of [0.5, 1.5, 2.5, 3.5]) if (rng() < m.drums * (off % 2 === 1.5 ? 1 : 0.5)) notes.push({ voice: 'drum', beat: at + off, midi: DRUM.shaker, dur: 0.25, vel: 0.22 });
      }
      // Bass: the root on beat 1, the fifth on 3 and a passing note on the last "and" (winter and autumn walk plainer).
      const root = nearest(notesIn([chord[0]], tonic, RANGE.bass), 43);
      if (last) {
        notes.push({ voice: 'bass', beat: at, midi: root, dur: 4, vel: 0.45 });
        return;
      }
      notes.push({ voice: 'bass', beat: at, midi: root, dur: 1.5, vel: 0.5 });
      notes.push({ voice: 'bass', beat: at + 2, midi: nearest(notesIn([chord[2]], tonic, RANGE.bass), root + 7), dur: 1, vel: 0.38 });
      if (m.season !== 'autumn' && m.season !== 'winter' && rng() < m.density) notes.push({ voice: 'bass', beat: at + 3.5, midi: nearest(notesIn([chord[1]], tonic, RANGE.bass), root + 4), dur: 0.5, vel: 0.3 });
    });
  });
  return { season: m.season, tonic, bpm: m.bpm, beats: 64, pad: s.pad, echo: s.echo, notes: notes.sort((x, y) => x.beat - y.beat || x.midi - y.midi) };
}

/** Most notes sounding at once (a note sounds over [beat, beat + dur)). */
export function polyphony(notes: readonly Note[]): number {
  const edges = notes.flatMap((n) => [[n.beat, 1] as const, [n.beat + n.dur, -1] as const]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let now = 0;
  let most = 0;
  for (const [, d] of edges) most = Math.max(most, (now += d));
  return most;
}

/** Seconds of quiet after a piece (4–8 s): a breath between pieces for hours of play, short enough to keep the step. */
export const silenceAfter = (rng: Rng) => 4 + rng() * 4;

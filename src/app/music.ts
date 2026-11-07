import { createRng } from '../core';
import { FADE, targetGain } from '../game/music/mix';
import { DRUM, mood, piece, silenceAfter, type Mood, type MoodInput, type Note, type Voice } from '../game/music/score';
import { settings } from '../game/settings';

/**
 * The background music (the only Web Audio code): plays the pieces of `game/music/score.ts` with
 * small synthesized voices (piano over soft synths), a soft echo and quiet between pieces. The audio context starts on the
 * first tap, click or key (browsers allow sound only after a gesture); notes are scheduled about a
 * second ahead every 250 ms (never per frame); a hidden tab fades out and suspends it.
 * See docs/arquitetura-3d.md section 12.
 */

const AHEAD = 1.2;
const TICK_MS = 250;

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export interface MusicState {
  ctx: 'none' | 'suspended' | 'running' | 'closed';
  target: number;
  playing: boolean;
  mood: Mood | null;
}

export class Music {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private dry: GainNode | null = null;
  private wet: GainNode | null = null;
  private timer = 0;
  private queue: { at: number; n: Note; spb: number }[] = [];
  /** When the next piece may start (context time). */
  private nextAt = 0;
  private seed: number;
  private rng = createRng(1);
  private mood: Mood | null = null;
  private target = 0;
  private padHz = 1400;
  private unlock = () => this.start();
  private onVisible = () => this.apply(document.hidden ? FADE.hide : FADE.in);

  /** `listen` gives the season, night and rain when a new piece begins. */
  constructor(private listen: () => MoodInput, seed = Date.now()) {
    this.seed = seed >>> 0;
    this.rng = createRng(this.seed ^ 0x9e3779b1);
    for (const ev of ['pointerdown', 'keydown'] as const) window.addEventListener(ev, this.unlock, { capture: true });
    document.addEventListener('visibilitychange', this.onVisible);
  }

  /** On the first gesture: the context, the voices' bus and the echo; then the scheduler. */
  private start() {
    if (this.ctx) return;
    for (const ev of ['pointerdown', 'keydown'] as const) window.removeEventListener(ev, this.unlock, { capture: true });
    const Ctx = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return; // no Web Audio: no music, no error
    const ctx = new Ctx();
    this.ctx = ctx;
    const bus = makeBus(ctx);
    this.master = bus.master;
    this.dry = bus.dry;
    this.wet = bus.wet;
    this.nextAt = ctx.currentTime + 0.5;
    void ctx.resume();
    this.apply(FADE.in);
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  /** Fades the master to the settings' target (and suspends the context when it is silent and hidden). */
  apply(fade = FADE.out) {
    const ctx = this.ctx;
    this.target = targetGain({ on: settings.music, volume: settings.musicVolume, hidden: document.hidden, moodGain: this.mood?.gain ?? 1 });
    if (!ctx || !this.master) return;
    if (!document.hidden && ctx.state === 'suspended') void ctx.resume();
    const g = this.master.gain;
    const now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(this.target, now + fade);
    if (document.hidden) window.setTimeout(() => document.hidden && ctx.state === 'running' && void ctx.suspend(), fade * 1000 + 50);
  }

  /** Every 250 ms: a new piece after the quiet, then the notes that start within the next second. */
  private tick() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (!this.queue.length && now >= this.nextAt - AHEAD && settings.music) {
      this.mood = mood(this.listen());
      this.apply(FADE.in);
      const p = piece((this.seed = (this.seed + 1) >>> 0), this.mood);
      const spb = 60 / p.bpm;
      const at = Math.max(now + 0.1, this.nextAt);
      this.queue = p.notes.map((n) => ({ at: at + n.beat * spb, n, spb }));
      this.padHz = p.pad;
      this.wet!.gain.setTargetAtTime(p.echo, at, 1);
      this.nextAt = at + p.beats * spb + silenceAfter(this.rng);
    }
    while (this.queue.length && this.queue[0].at < now + AHEAD) {
      const { at, n, spb } = this.queue.shift()!;
      if (at >= now - 0.05) this.voice(at, n, spb);
    }
  }

  private voice(at: number, n: Note, spb: number) {
    voice(this.ctx!, this.dry!, this.wet!, at, n, spb, this.padHz);
  }

  /** Dev and tests: what the music is doing. */
  state(): MusicState {
    return { ctx: this.ctx ? (this.ctx.state as MusicState['ctx']) : 'none', target: this.target, playing: this.queue.length > 0, mood: this.mood };
  }

  dispose() {
    window.clearInterval(this.timer);
    for (const ev of ['pointerdown', 'keydown'] as const) window.removeEventListener(ev, this.unlock, { capture: true });
    document.removeEventListener('visibilitychange', this.onVisible);
    void this.ctx?.close();
    this.ctx = null;
  }
}

/** Each voice's loudness under the master (the pad, keys and bass stay under the melody). */
const LEVEL: Record<Voice, number> = { piano: 0.4, keys: 0.2, arp: 0.07, pad: 0.035, bass: 0.34, drum: 0.28 };

/** Half a second of white noise per context, made once (the shaker). */
const NOISE = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseOf(ctx: BaseAudioContext): AudioBuffer {
  let b = NOISE.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const d = b.getChannelData(0);
    const r = createRng(3);
    for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
    NOISE.set(ctx, b);
  }
  return b;
}

/** The hand drum (a sine falling 140 → 55 Hz) or the shaker (high-passed noise), short and soft. */
function drum(ctx: BaseAudioContext, dry: AudioNode, wet: AudioNode, at: number, n: Note) {
  const env = ctx.createGain();
  const peak = n.vel * LEVEL.drum;
  env.gain.setValueAtTime(0, at);
  let src: AudioScheduledSourceNode;
  let end: number;
  if (n.midi === DRUM.low) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(140, at);
    o.frequency.exponentialRampToValueAtTime(55, at + 0.18);
    o.connect(env);
    end = at + 0.32;
    env.gain.linearRampToValueAtTime(peak, at + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    src = o;
  } else {
    const s = ctx.createBufferSource();
    s.buffer = noiseOf(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6500;
    s.connect(hp).connect(env);
    end = at + 0.07;
    env.gain.linearRampToValueAtTime(peak * 0.6, at + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    src = s;
  }
  env.connect(dry);
  if (n.midi === DRUM.low) env.connect(wet);
  src.start(at);
  src.stop(end + 0.02);
  src.onended = () => env.disconnect();
}

/** One note: piano (melody and left hand), a soft synth arpeggio, a synth pad (filtered at `padHz`), the bass or the drum. */
export function voice(ctx: BaseAudioContext, dry: AudioNode, wet: AudioNode, at: number, n: Note, spb: number, padHz = 1400) {
  if (n.voice === 'drum') return drum(ctx, dry, wet, at, n);
  const dur = n.dur * spb;
  const f = hz(n.midi);
  const env = ctx.createGain();
  const peak = n.vel * LEVEL[n.voice];
  const g = env.gain;
  g.setValueAtTime(0, at);
  let end: number;
  const oscs: OscillatorNode[] = [];
  const osc = (type: OscillatorType, freq = f, detune = 0) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    oscs.push(o);
    return o;
  };
  const lowpass = (hzFrom: number, q = 0.7) => {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(hzFrom, at);
    filter.Q.value = q;
    return filter;
  };
  if (n.voice === 'piano' || n.voice === 'keys') {
    // A soft electric-acoustic piano: a sine frequency-modulated at the same pitch, the modulation
    // (the hammer's brightness) fading fast, a quiet octave partial, a long natural decay (shorter
    // higher up) and a short release when the key lifts.
    const car = osc('sine');
    const mod = osc('sine');
    const index = ctx.createGain();
    index.gain.setValueAtTime(f * (0.5 + 1.4 * n.vel), at);
    index.gain.setTargetAtTime(f * 0.12, at, 0.22);
    mod.connect(index).connect(car.frequency);
    const filter = lowpass(4200);
    car.connect(filter);
    const octave = ctx.createGain();
    octave.gain.setValueAtTime(0.18, at);
    octave.gain.setTargetAtTime(0, at, 0.35);
    osc('sine', f * 2, 3).connect(octave).connect(filter);
    filter.connect(env);
    const tau = Math.min(2.4, Math.max(0.7, 2.4 - (n.midi - 48) * 0.035));
    g.linearRampToValueAtTime(peak, at + 0.005);
    g.setTargetAtTime(0, at + 0.005, tau);
    g.setTargetAtTime(0, at + dur, 0.18);
    end = at + dur + 1;
  } else if (n.voice === 'arp') {
    // A short synth pluck: two detuned saws in a resonant low-pass that closes quickly.
    const filter = lowpass(2400, 2);
    filter.frequency.exponentialRampToValueAtTime(500, at + 0.22);
    osc('sawtooth', f, -6).connect(filter);
    osc('sawtooth', f, 6).connect(filter);
    filter.connect(env);
    end = at + 0.5;
    g.linearRampToValueAtTime(peak, at + 0.004);
    g.exponentialRampToValueAtTime(0.0001, end);
  } else if (n.voice === 'pad') {
    // A warm synth pad: two saws detuned apart, low-passed by the season (darker in autumn), slow in and out.
    const filter = lowpass(padHz, 0.5);
    osc('sawtooth', f, -7).connect(filter);
    osc('sawtooth', f, 7).connect(filter);
    filter.connect(env);
    end = at + dur + 1.5;
    g.linearRampToValueAtTime(peak, at + Math.min(1.2, dur * 0.5));
    g.setValueAtTime(peak, at + dur);
    g.linearRampToValueAtTime(0, end);
  } else {
    osc('sine').connect(env);
    osc('triangle').connect(env); // a little body so the bass reads on phone speakers
    end = at + dur + 0.3;
    g.linearRampToValueAtTime(peak, at + 0.02);
    g.exponentialRampToValueAtTime(0.0001, end);
  }
  env.connect(dry);
  env.connect(wet);
  for (const o of oscs) {
    o.start(at);
    o.stop(end + 0.05);
  }
  oscs[0].onended = () => env.disconnect();
}

/** The output chain: a master gain (starting silent), the dry bus and the echo (a convolver with a decaying noise made once, about 1.8 s). */
export function makeBus(ctx: BaseAudioContext) {
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  const dry = ctx.createGain();
  dry.connect(master);
  const verb = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 1.8);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  const noise = createRng(7);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (noise() * 2 - 1) * (1 - i / len) ** 3;
  }
  verb.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  wet.connect(verb).connect(master);
  return { master, dry, wet };
}

/** Dev (scripts/music-render.mjs): `seconds` of music for a mood rendered offline, pieces one after another with their quiet. */
export async function renderOffline(input: MoodInput, seconds: number, seed = 1, quiet = 4): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * 44100), 44100);
  const bus = makeBus(ctx);
  const m = mood(input);
  bus.master.gain.value = targetGain({ on: true, volume: 0.7, hidden: false, moodGain: m.gain });
  let at = 0.2;
  for (let k = 0; at < seconds; k++) {
    const p = piece(seed + k, m);
    const spb = 60 / p.bpm;
    bus.wet.gain.setValueAtTime(p.echo, at);
    for (const n of p.notes) if (at + n.beat * spb < seconds) voice(ctx, bus.dry, bus.wet, at + n.beat * spb, n, spb, p.pad);
    at += p.beats * spb + quiet;
  }
  return ctx.startRendering();
}

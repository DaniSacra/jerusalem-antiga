import { createRng } from '../core';
import { FADE, targetGain } from '../game/music/mix';
import { mood, piece, silenceAfter, type Mood, type MoodInput, type Note, type Voice } from '../game/music/score';
import { settings } from '../game/settings';

/**
 * The background music (the only Web Audio code): plays the pieces of `game/music/score.ts` with
 * small synthesized voices, a soft echo and quiet between pieces. The audio context starts on the
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
      this.nextAt = at + p.beats * spb + silenceAfter(this.rng);
    }
    while (this.queue.length && this.queue[0].at < now + AHEAD) {
      const { at, n, spb } = this.queue.shift()!;
      if (at >= now - 0.05) this.voice(at, n, spb);
    }
  }

  private voice(at: number, n: Note, spb: number) {
    voice(this.ctx!, this.dry!, this.wet!, at, n, spb);
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

/** Each voice's loudness under the master (the pad and bass stay under the melody). */
const LEVEL: Record<Voice, number> = { harp: 0.55, flute: 0.4, pad: 0.12, bass: 0.3 };

/** One note: harp (plucked triangle), flute (sine with vibrato), pad (two detuned sines) or bass. */
export function voice(ctx: BaseAudioContext, dry: AudioNode, wet: AudioNode, at: number, n: Note, spb: number) {
  const dur = n.dur * spb;
  const env = ctx.createGain();
  const peak = n.vel * LEVEL[n.voice];
  const g = env.gain;
  g.setValueAtTime(0, at);
  let end: number;
  const oscs: OscillatorNode[] = [];
  const osc = (type: OscillatorType, detune = 0) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz(n.midi);
    o.detune.value = detune;
    oscs.push(o);
    return o;
  };
  if (n.voice === 'harp') {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, at);
    filter.frequency.exponentialRampToValueAtTime(900, at + 1.2);
    osc('triangle').connect(filter).connect(env);
    end = at + dur + 1.6;
    g.linearRampToValueAtTime(peak, at + 0.006);
    g.exponentialRampToValueAtTime(0.0001, end);
  } else if (n.voice === 'flute') {
    const o = osc('sine');
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 5;
    depth.gain.value = 4; // cents
    lfo.connect(depth).connect(o.detune);
    lfo.start(at);
    o.connect(env);
    end = at + dur + 0.45;
    g.linearRampToValueAtTime(peak, at + 0.09);
    g.setValueAtTime(peak, at + dur);
    g.linearRampToValueAtTime(0, end);
    lfo.stop(end);
  } else if (n.voice === 'pad') {
    osc('sine', -5).connect(env);
    osc('sine', 5).connect(env);
    end = at + dur + 1.5;
    g.linearRampToValueAtTime(peak, at + Math.min(1.2, dur * 0.5));
    g.setValueAtTime(peak, at + dur);
    g.linearRampToValueAtTime(0, end);
  } else {
    osc('sine').connect(env);
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
    for (const n of p.notes) if (at + n.beat * spb < seconds) voice(ctx, bus.dry, bus.wet, at + n.beat * spb, n, spb);
    at += p.beats * spb + quiet;
  }
  return ctx.startRendering();
}

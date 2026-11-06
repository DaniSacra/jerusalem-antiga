/**
 * The music's loudness (pure: no Web Audio): the target gain from the settings, the tab and the mood,
 * and how long each fade takes. See docs/arquitetura-3d.md section 12.
 */

export interface MixInput {
  on: boolean;
  /** 0..1 from the settings. */
  volume: number;
  /** The tab is hidden: silence (the audio is suspended after the fade). */
  hidden: boolean;
  /** The mood's loudness factor (night is softer). */
  moodGain: number;
}

/** Loudest master gain (the voices are summed under it). */
export const MASTER = 1;

/** The gain to fade to: 0 when off or hidden; else the volume on a perceptual curve (volume²) times the mood. */
export function targetGain({ on, volume, hidden, moodGain }: MixInput): number {
  if (!on || hidden) return 0;
  const v = Math.min(1, Math.max(0, volume));
  return MASTER * v * v * moodGain;
}

/** Fade lengths in seconds: in on start or return, out when turned off, quick when the tab hides. */
export const FADE = { in: 4, out: 1.5, hide: 0.3 };

/** The volume after a step of the − / + buttons (0.1 apart, kept in 0..1, rounded). */
export const stepVolume = (v: number, dir: 1 | -1) => Math.round(Math.min(1, Math.max(0, v + dir * 0.1)) * 10) / 10;

/** Player display options, kept in the browser between games (render only, never game rules). */
export interface Settings {
  /** Day and night cycle; off = always day. */
  dayNight: boolean;
  /** Background music on (it starts on the first tap; see app/music.ts). */
  music: boolean;
  /** Music volume 0..1 (steps of 0.1). */
  musicVolume: number;
}

const KEY = 'jerusalem-antiga.settings';
const DEFAULTS: Settings = { dayNight: true, music: true, musicVolume: 0.5 };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings: Settings = load();

const listeners = new Set<() => void>();

/** Called after every saved change (the music follows its switch and volume). */
export function onSettings(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Private mode or blocked storage: the option still works for this session.
  }
  for (const fn of listeners) fn();
}

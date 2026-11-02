/** Player display options, kept in the browser between games (render only, never game rules). */
export interface Settings {
  /** Day and night cycle; off = always day. */
  dayNight: boolean;
  /** Blurred top and bottom edges (miniature look). */
  miniature: boolean;
}

const KEY = 'jerusalem-antiga.settings';
const DEFAULTS: Settings = { dayNight: true, miniature: true };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings: Settings = load();

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Private mode or blocked storage: the option still works for this session.
  }
}

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

/** The two interfaces over the same game: Nova (default) and Clássica. */
export type UiMode = 'nova' | 'classic';
const UI_KEY = 'jerusalem.ui';
let uiChoice: UiMode | null = null;

export function uiMode(): UiMode {
  if (uiChoice) return uiChoice;
  try {
    uiChoice = localStorage.getItem(UI_KEY) === 'classic' ? 'classic' : 'nova';
  } catch {
    uiChoice = 'nova';
  }
  return uiChoice;
}

export function setUiMode(mode: UiMode) {
  uiChoice = mode;
  try {
    localStorage.setItem(UI_KEY, mode);
  } catch {
    // Blocked storage: the choice lasts for this session.
  }
}

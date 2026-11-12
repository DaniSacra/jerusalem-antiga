export const C = {
  bg: 0x6b5236,
  rock: 0xa89c88,
  rockLight: 0xcdc2ad,
  rockDark: 0x7d7262,
  trunk: 0x7a5636,
  olive: 0x8a9a5e,
  oliveLight: 0xa9b679,
  palm: 0x6f9a3e,
  palmDark: 0x557a2f,
  mud: 0xd9ab72,
  cream: 0xf6ecd6,
  gold: 0xe2b544,
  famine: 0xc0392b,
  /** Cells where a building fits (temple spots). */
  fits: 0x6cc35a,
  /** Cells where a building fits but a road is missing (yellow temple spots, the "falta ligar à rua" preview). */
  needsRoad: 0xf2c230,
  need: { road: 0xc0392b, plaza: 0xb89a6a, market: 0xc0503c, sacred: 0xe8742c, park: 0x5aa83c },
  /** Light gold of the marks (selection and temple edges). */
  ui: { goldLight: 0xf6dc8c },
  /** Dust raised when something is demolished (the pebbles use the rock colours). */
  dust: 0xd9c49a,
  grain: 0xe8c45c,
  /** Effects: milestone gold and glow; spoiling food (a sickly green puff) and its flies. */
  milestone: 0xffd86a,
  milestoneGlow: 0xfff3c4,
  spoil: 0x9aa65c,
  fly: 0x2a2620,
};

// ---------- Interface Nova (ui-designer) ----------

/** Interface Nova: dark see-through panels, parchment buttons, gold highlight, light text. */
export const NOVA = {
  parchment: 0xf4e8cc,
  /** Chart lines in the statistics: silver, food, residents, happiness, and the food capacity (dashed). */
  chart: { silver: 0xd9dde3, food: 0x8fd17f, residents: 0xf0c27a, happiness: 0xffd77a, capacity: 0xd2c09a },
};

/** A palette number as a CSS colour. */
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export const NOVA_CSS = {
  text: '#fff4dc',
  muted: '#d2c09a',
  gold: '#e2a93b',
  /** Gold of the chosen tool and the highlights on dark. */
  goldBright: '#ffd77a',
  good: '#8fd17f',
  bad: '#ff8a7a',
  warn: '#ffb15c',
  ink: '#3b2a1a',
  /** Price on a parchment button without enough silver. */
  inkBad: '#b02a1c',
  parchment: hex(NOVA.parchment),
  /** The soft halo around a selected button (with a gold ring), as the 2D's. */
  goldLight: 'rgba(255, 215, 122, 0.4)',
  /** The offset shadow under parchment buttons (they look raised; pressed, they sink 2 px). */
  shadow: 'rgba(0, 0, 0, 0.28)',
  /** The vignette darkening the screen's edges (over the map, under the interface). */
  vignette: 'rgba(28, 18, 8, 0.32)',
  /** Behind the map while it loads (the earth brown). */
  bg: hex(C.bg),
  // ---- Foundation-style surfaces (2026-11-12): dark brown glass with a thin gold edge; wood and parchment windows ----
  /** Pills, side panels, the tool discs: translucent dark brown. */
  panel: 'rgba(38, 26, 14, 0.8)',
  /** Balloons and menus that must read over any ground. */
  panelDeep: 'rgba(30, 20, 10, 0.95)',
  /** The thin gold edge of every panel (and its softer inner line). */
  edge: 'rgba(226, 169, 59, 0.72)',
  edgeSoft: 'rgba(226, 169, 59, 0.28)',
  /** The round tool buttons: dark, a little more solid than a pill. */
  disc: 'rgba(44, 30, 16, 0.9)',
  /** Wood of the window frames (dark to light) and the cream-orange parchment inside. */
  wood: '#5b3a1c',
  woodDark: '#34200d',
  woodLight: '#7d5330',
  paper: '#f3dcab',
  paperDeep: '#e6c286',
  /** Ochre buttons of the windows (light to dark) and their ink. */
  ochre: '#e0a043',
  ochreDark: '#b8741d',
  ochreInk: '#3b2a1a',
  /** Ink on the parchment: muted, good, bad and warn tones that read on cream. */
  paperMuted: '#7a6446',
  paperGood: '#2f6f26',
  paperBad: '#a52a1c',
  paperWarn: '#9a5a0c',
  paperGold: '#a8710f',
};

/** Rounded and readable, system fonts only (the game is an offline app): falls back to the classic font. */
/** The game's name and the victory and defeat titles: a carved-stone serif (system fonts only: the app works offline). */
export const TITLE_FONT = '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Times New Roman", serif';
export const NOVA_FONT = 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Nunito", "Varela Round", "Trebuchet MS", Verdana, sans-serif';

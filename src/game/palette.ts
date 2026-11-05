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
  good: '#8fd17f',
  bad: '#ff8a7a',
  warn: '#ffb15c',
  ink: '#3b2a1a',
  /** Price on a parchment button without enough silver. */
  inkBad: '#b02a1c',
  parchment: hex(NOVA.parchment),
  /** Behind the map while it loads (the earth brown). */
  bg: hex(C.bg),
};

/** Rounded and readable, system fonts only (the game is an offline app): falls back to the classic font. */
export const NOVA_FONT = 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Nunito", "Varela Round", "Trebuchet MS", Verdana, sans-serif';

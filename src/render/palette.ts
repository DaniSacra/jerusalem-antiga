export const C = {
  bg: 0x6b5236,
  sand: [0xe2c38d, 0xe0c08a, 0xe4c590, 0xdfbf88],
  grass: [0xbbae67, 0xb8ab64, 0xbeb16a, 0xb6a962],
  tuft: 0x8e8a44,
  earthLit: 0xa9825a,
  earthDark: 0x7f5f3f,
  water: 0x4f9cc9,
  waterDeep: 0x3f86b8,
  waterLight: 0xc4e8f7,
  bank: 0xefd9a9,
  road: 0xc4975f,
  roadEdge: 0x8a6239,
  shadow: 0x3b2a1a,
  rock: 0xa89c88,
  rockLight: 0xcdc2ad,
  rockDark: 0x7d7262,
  trunk: 0x7a5636,
  palmTrunk: 0x9a7448,
  olive: 0x8a9a5e,
  oliveLight: 0xa9b679,
  oliveDark: 0x66764a,
  palm: 0x6f9a3e,
  palmDark: 0x557a2f,
  mud: 0xd9ab72,
  stone: 0xe7dcc4,
  limestone: 0xf1e8d4,
  ochre: 0xc98f4a,
  wood: 0x9c7048,
  woodDark: 0x6e4b2e,
  door: 0x5c3d24,
  red: 0xc0503c,
  cream: 0xf6ecd6,
  terracotta: 0xb8653e,
  leaf: 0x6f9a48,
  lawn: 0x8fb04e,
  gold: 0xe2b544,
  soil: 0x9a6c42,
  soilDark: 0x7a5232,
  wheat: 0xeacb5e,
  wheatStem: 0xb88f35,
  fabric: 0xe5c99a,
  tentCloth: 0x4e3d30,
  limeWash: 0xf4ecdb,
  rope: 0xeadfc4,
  parchment: 0xf3e6c8,
  parchmentDark: 0xe3d1a9,
  ink: 0x4a3523,
  border: 0x8a6a45,
  famine: 0xc0392b,
  /** Cells where a building fits (temple spots). */
  fits: 0x6cc35a,
  clothes: [0xc0503c, 0x5a7fb5, 0xe2b544, 0x7fa65a, 0x9a6ab0, 0xe9ddc8],
  skin: [0xd9a77c, 0xc28a5e, 0xe8bf96],
  mood: { happy: 0x8cc152, neutral: 0xf2c94c, sad: 0xe0704c },
  need: { road: 0xc0392b, well: 0x4a9bd8, market: 0xc0503c, sacred: 0xe8742c, garden: 0x5aa83c },
  /** Interface: light stone plaques and rails with gold trim. */
  ui: {
    stone: 0xf1e8d4,
    stoneDark: 0xdccdb0,
    stoneEdge: 0xb8a582,
    goldLight: 0xf6dc8c,
    goldDark: 0xa87d22,
    /** Line icons drawn light, for dark buttons (the dark ones use `ink`). */
    iconLight: 0xfdf7e8,
    /** Soft outline around the building thumbnails, so light stone reads on a light button. */
    thumbOutline: 0x4a3523,
    /** Locked thumbnails: their colours are turned to grey and lifted toward this. */
    lockedGrey: 0x8f8a80,
    /** Mouse hand cursor (Mover): fill inside the ink outline. */
    cursorFill: 0xfdf7e8,
  },
  /** Building under the demolish tool, pulsing between the two. */
  demolish: { soft: 0xffb4a4, strong: 0xff6a52 },
  /** Places that would solve a need (e.g. "where to put a market"): fill, edge and inner glow. */
  solve: { fill: 0xcfe07a, edge: 0xf6dc8c, glow: 0xfff6c8 },
  /** Dust raised when something is demolished (the pebbles use the rock colours). */
  dust: 0xd9c49a,
  /** Granary stock: burlap grain sacks, the grain itself and the wooden pallets under them. */
  sack: 0xd4b582,
  sackDark: 0xa88a5a,
  grain: 0xe8c45c,
  /** Fisher: drying nets, fish (silver) and a tarred boat hull. */
  net: 0xc9b38a,
  fish: 0xc4ccd0,
  hull: 0x5e4630,
  /** Gatherer: wicker baskets and the fruits in them (olives, figs, dates). */
  wicker: 0xb48c52,
  oliveFruit: 0x4e4a2c,
  oliveGreen: 0x8a9a3e,
  figFruit: 0x6e3a5c,
  dateFruit: 0xc2702e,
  /** Effects: milestone gold and glow; spoiling food (a sickly green puff) and its flies. */
  milestone: 0xffd86a,
  milestoneGlow: 0xfff3c4,
  spoil: 0x9aa65c,
  fly: 0x2a2620,
};

export const CSS = {
  ink: '#4a3523',
  muted: '#8a7356',
  good: '#3c8a37',
  bad: '#c0392b',
  /** Warnings that are not yet a failure (idle workers, negative weekly balance). */
  warn: '#d9771f',
  light: '#fdf7e8',
  gold: '#f2d27a',
};

export const FONT = '"Trebuchet MS", Verdana, sans-serif';

/** Multiplies (f < 1) or lightens toward white (f > 1) a color. */
export function shade(color: number, f: number): number {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1))));
  return (ch((color >> 16) & 255) << 16) | (ch((color >> 8) & 255) << 8) | ch(color & 255);
}

// ---------- Interface Nova (ui-designer) ----------

/** Interface Nova: dark see-through panels, parchment buttons, gold highlight, light text. */
export const NOVA = {
  panel: 0x24190e,
  panelAlpha: 0.75,
  /** Subtle light border of the panels. */
  edge: 0xfff4dc,
  edgeAlpha: 0.2,
  parchment: 0xf4e8cc,
  /** Parchment of a button without silver or locked. */
  parchmentDim: 0xcfc4ad,
  /** Dark brown border of the parchment buttons. */
  border: 0x3b2a1a,
  gold: 0xe2a93b,
  goldLight: 0xffd77a,
  text: 0xfff4dc,
  good: 0x6fbf5a,
  bad: 0xd8483a,
  /** Progress bar track and the empty part of the level ring. */
  track: 0x5a4630,
  /** Balloon of the building tapped with Mover: the "Ao evoluir" box. */
  box: 0x3a2a18,
  /** Balloons and panels with several lines of text: a bit denser than the bars, to stay readable over the map. */
  balloonAlpha: 0.88,
  /** Red selo of the alerts button. */
  badge: 0xc8372b,
  /** Toast backgrounds for bad and good news (info toasts use the panel color). */
  toastBad: 0x8e2a1f,
  toastGood: 0x3f6b2a,
  /** Chart lines in the statistics: silver, food, residents, happiness, and the food capacity (dashed). */
  chart: { silver: 0xd9dde3, food: 0x8fd17f, residents: 0xf0c27a, happiness: 0xffd77a, capacity: 0xd2c09a },
};

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
};

/** Rounded and readable, system fonts only (the game is an offline app): falls back to the classic font. */
export const NOVA_FONT = 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Nunito", "Varela Round", "Trebuchet MS", Verdana, sans-serif';

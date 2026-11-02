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
  need: { road: 0xc0392b, well: 0x4a9bd8, market: 0xc0503c, sacred: 0xe8742c },
};

export const CSS = {
  ink: '#4a3523',
  muted: '#8a7356',
  good: '#3c8a37',
  bad: '#c0392b',
  /** Warnings that are not yet a failure (idle workers, negative monthly balance). */
  warn: '#d9771f',
  light: '#fdf7e8',
  gold: '#f2d27a',
  okLight: '#8fd17f',
  badLight: '#ff8a7a',
};

export const FONT = '"Trebuchet MS", Verdana, sans-serif';

/** Multiplies (f < 1) or lightens toward white (f > 1) a color. */
export function shade(color: number, f: number): number {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1))));
  return (ch((color >> 16) & 255) << 16) | (ch((color >> 8) & 255) << 8) | ch(color & 255);
}

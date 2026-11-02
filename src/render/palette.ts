export const C = {
  bg: 0x5f7740,
  frame: 0x4b6131,
  grass: [0x9db86a, 0x97b363, 0xa2bc6f, 0x93af60],
  tuft: 0x7b9b4b,
  tuftLight: 0xb8cf84,
  valley: [0xbba274, 0xb59c6d],
  valleyLine: 0x9f865b,
  sand: 0xd8c497,
  water: 0x5aa6d6,
  waterLight: 0xbfe6f7,
  shadow: 0x2b2416,
  rock: 0x9d978b,
  rockLight: 0xbdb7aa,
  rockDark: 0x77716a,
  trunk: 0x7a5a3a,
  olive: 0x7d9656,
  oliveLight: 0x9bb36f,
  oliveDark: 0x5f7842,
  mudRoof: 0xdcbc8c,
  mudWall: 0xb88c5c,
  stoneRoof: 0xdcd3c0,
  stoneWall: 0xb6aa92,
  bigRoof: 0xe9e0cb,
  bigWall: 0xc4b597,
  door: 0x6e4b2e,
  window: 0x4a3523,
  fabric: 0xdcbf91,
  fabricDark: 0xc09b69,
  rope: 0xeadfc4,
  soil: 0x9a7448,
  soilDark: 0x7d5c38,
  wheat: 0xe8c95c,
  wheatStem: 0xb88f35,
  wood: 0x9c7048,
  woodDark: 0x76512f,
  red: 0xc65a46,
  cream: 0xf4ead2,
  terracotta: 0xb8653e,
  leaf: 0x6f9a48,
  parchment: 0xf3e6c8,
  parchmentDark: 0xe3d1a9,
  ink: 0x4a3523,
  border: 0x8a6a45,
  gold: 0xe0b84f,
  famine: 0xc0392b,
  clothes: [0xc65a46, 0x5a7fb5, 0xe0b84f, 0x7fa65a, 0x9a6ab0, 0xe9ddc8],
  skin: [0xd9a77c, 0xc28a5e, 0xe8bf96],
  need: { well: 0x4a9bd8, market: 0xc65a46, altar: 0xe8742c },
};

export const CSS = {
  ink: '#4a3523',
  muted: '#8a7356',
  good: '#3c8a37',
  bad: '#c0392b',
  light: '#fdf7e8',
};

export const FONT = '"Trebuchet MS", Verdana, sans-serif';

/** Multiplies (f < 1) or lightens toward white (f > 1) a color. */
export function shade(color: number, f: number): number {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1))));
  return (ch((color >> 16) & 255) << 16) | (ch((color >> 8) & 255) << 8) | ch(color & 255);
}

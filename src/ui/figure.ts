import type { AgeBand, Sex } from '../core';

/** Colors of the people figures (as the 2D's): tunic of a man, robe of a woman, skin, hair, an elder's white hair and staff. */
const FIG = { man: '#7fa6c9', woman: '#d07a5a', skin: '#e9c39a', hair: '#4a3322', grey: '#e8e2d6', staff: '#b98a52', dim: '#8a8174', dimSkin: '#b5aa98' };

/**
 * A small person as inline SVG in a dark round badge: a child is small with a big head, an elder has
 * white hair and a staff; a man wears a straight tunic with a belt, a woman a flared robe with a veil
 * (the shape tells the sex, not only the colour). `dim`: someone who died or left.
 */
export function figureSvg(band: AgeBand, sex: Sex, dim = false): string {
  const k = band === 'child' ? 0.68 : 1;
  const u = 3.2 * k;
  const foot = 36;
  const bodyH = 6 * u;
  const top = foot - bodyH;
  const head = 1.7 * u * (band === 'child' ? 1.2 : 1);
  const hy = top - head * 0.95;
  const robe = dim ? FIG.dim : sex === 'f' ? FIG.woman : FIG.man;
  const hair = dim ? FIG.dim : band === 'elder' ? FIG.grey : sex === 'f' ? robe : FIG.hair;
  const body =
    sex === 'f'
      ? `<path d="M25 ${top - u * 0.4}L${25 - 3.2 * u} ${foot}H${25 + 3.2 * u}z" fill="${robe}"/>`
      : `<rect x="${25 - 1.8 * u}" y="${top}" width="${3.6 * u}" height="${bodyH}" fill="${robe}"/><rect x="${25 - 1.8 * u}" y="${top + bodyH * 0.45}" width="${3.6 * u}" height="${Math.max(1, u * 0.6)}" fill="#3b2a1a" opacity="0.8"/>`;
  const veil = sex === 'f' ? `<path d="M${25 - head * 1.25} ${hy + head * 1.3}V${hy}A${head * 1.25} ${head * 1.25} 0 0 1 ${25 + head * 1.25} ${hy}V${hy + head * 1.3}" fill="${hair}"/>` : `<path d="M${25 - head * 1.05} ${hy}A${head * 1.05} ${head * 1.05} 0 0 1 ${25 + head * 1.05} ${hy}z" fill="${hair}"/>`;
  const staff = band === 'elder' ? `<path d="M${25 + 3.4 * u} ${hy - head * 0.6}V${foot}" stroke="${dim ? FIG.dim : FIG.staff}" stroke-width="${Math.max(1, u * 0.8)}"/>` : '';
  return `<svg viewBox="0 0 50 50" aria-hidden="true"><circle cx="25" cy="25" r="24" fill="#2b1f14" stroke="#c9a46a" stroke-opacity="0.35" stroke-width="1.5"/>${body}<circle cx="25" cy="${hy}" r="${head}" fill="${dim ? FIG.dimSkin : FIG.skin}"/>${veil}${staff}</svg>`;
}

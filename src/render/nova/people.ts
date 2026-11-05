import Phaser from 'phaser';
import type { AgeBand, Sex } from '../../core';
import { px } from '../layout';
import { NOVA } from '../palette';

/** Colors of the people figures: tunic of a man, robe of a woman, skin, hair, an elder's white hair and staff. */
const FIG = { man: 0x7fa6c9, woman: 0xd07a5a, skin: 0xe9c39a, hair: 0x4a3322, grey: 0xe8e2d6, staff: 0xb98a52 };

/**
 * A small person drawn in code, centered at (0, 0) in a dark round badge of diameter `size`: a child
 * is small with a big head, an adult tall, an elder has white hair and a staff. A man wears a straight
 * tunic with a belt, a woman a flared robe with a veil (the shape tells the sex, not only the color).
 * `dim`: someone who died or left (grey).
 */
export function personFigure(scene: Phaser.Scene, band: AgeBand, sex: Sex, size: number, dim = false): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const r = size / 2;
  g.fillStyle(NOVA.box, 1).fillCircle(0, 0, r);
  g.lineStyle(Math.max(1, px(1.5)), NOVA.edge, 0.35).strokeCircle(0, 0, r);
  const k = band === 'child' ? 0.68 : 1;
  const u = size * 0.08 * k; // one unit of the figure
  const foot = r * 0.72;
  const bodyH = 6 * u;
  const top = foot - bodyH; // shoulders
  const head = 1.7 * u * (band === 'child' ? 1.2 : 1);
  const hy = top - head * 0.95;
  const robe = dim ? 0x8a8174 : sex === 'f' ? FIG.woman : FIG.man;
  g.fillStyle(robe, 1);
  if (sex === 'f') {
    // Flared robe and a veil over the head.
    g.fillTriangle(0, top - u * 0.4, -3.2 * u, foot, 3.2 * u, foot);
    g.fillRect(-1.4 * u, top - u * 0.2, 2.8 * u, bodyH * 0.5);
  } else {
    g.fillRect(-1.8 * u, top, 3.6 * u, bodyH);
    g.fillStyle(NOVA.border, 0.8).fillRect(-1.8 * u, top + bodyH * 0.45, 3.6 * u, Math.max(1, u * 0.6));
  }
  g.fillStyle(dim ? 0xb5aa98 : FIG.skin, 1).fillCircle(0, hy, head);
  const hair = band === 'elder' ? FIG.grey : FIG.hair;
  if (sex === 'f') {
    g.fillStyle(dim ? 0x8a8174 : band === 'elder' ? FIG.grey : robe, 1);
    g.slice(0, hy, head * 1.25, Math.PI, 0, false).fillPath();
    g.fillRect(-head * 1.25, hy, head * 0.5, head * 1.3);
    g.fillRect(head * 0.75, hy, head * 0.5, head * 1.3);
  } else {
    g.fillStyle(dim ? 0x8a8174 : hair, 1);
    g.slice(0, hy, head * 1.05, Math.PI, 0, false).fillPath();
    if (band === 'elder') g.fillTriangle(-head * 0.6, hy + head * 0.4, head * 0.6, hy + head * 0.4, 0, hy + head * 1.7); // beard
  }
  if (band === 'elder') {
    g.lineStyle(Math.max(1, u * 0.8), dim ? 0x8a8174 : FIG.staff, 1).lineBetween(3.4 * u, hy - head * 0.6, 3.4 * u, foot);
  }
  return g;
}

export { ageNow, bandOf, jobText, residentsOf } from '../../game/model/people';

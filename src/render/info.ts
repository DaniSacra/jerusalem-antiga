import { BUILDINGS, computeEconomy, houseInfo, indexOf, type GameState } from '../core';
import { CSS } from './palette';
import { fmt, T } from './strings';

export type Segment = { text: string; color?: string };

const GOLD = '#f2d27a';
const SEP: Segment = { text: '  ·  ' };

/** Describes the content of a cell for the info line (Ver tool). */
export function describeCell(state: GameState, x: number, y: number): Segment[] {
  const i = indexOf(state, x, y);
  const b = state.buildings[i];
  if (!b) return [{ text: T.terrain[state.terrain[i]] }];

  if (b.kind === 'house') {
    const h = houseInfo(state, i)!;
    if (h.level === 0) {
      const segs: Segment[] = [{ text: h.name, color: GOLD }, SEP, { text: 'esperando uma família chegar' }];
      if (state.famine) segs.push(SEP, { text: 'a fome impede novas famílias', color: '#ff8a7a' });
      return segs;
    }
    const segs: Segment[] = [
      { text: h.name, color: GOLD },
      SEP,
      { text: `${h.residents} moradores` },
      SEP,
      { text: `imposto ${fmt(h.tax)}${T.perMonth}` },
      SEP,
    ];
    if (!h.next) return [...segs, { text: 'nível máximo' }];
    segs.push({ text: `Para ${h.next.name}: ` });
    h.next.needs.forEach((n, k) => {
      if (k) segs.push({ text: '  ' });
      segs.push({ text: `${T.needName(n.kind)} ${n.ok ? '✓' : '✗'}`, color: n.ok ? '#8fd17f' : '#ff8a7a' });
    });
    if (!h.next.needs.length) segs.push({ text: 'nada' });
    if (state.famine) segs.push(SEP, { text: 'fome: não evolui', color: '#ff8a7a' });
    return segs;
  }

  const def = BUILDINGS[b.kind];
  const eff = computeEconomy(state).efficiency;
  const segs: Segment[] = [{ text: def.name, color: GOLD }];
  if (def.jobs) segs.push(SEP, { text: `${def.jobs} vagas` });
  if (def.food) segs.push(SEP, { text: `${fmt(def.food * eff)} de comida${T.perMonth}` });
  if (def.silver) segs.push(SEP, { text: `${fmt(def.silver * eff)} de prata${T.perMonth}` });
  if (def.jobs && eff < 1) segs.push({ text: ` (eficiência ${Math.round(eff * 100)}%)`, color: '#ff8a7a' });
  if (def.radius) segs.push(SEP, { text: `raio ${def.radius}` });
  return segs;
}

export const hintSegments = (hint: string): Segment[] => [{ text: hint, color: CSS.light }];

import { BUILDINGS, computeEconomy, houseInfo, indexOf, RULES, type GameState } from '../core';
import { CSS } from './palette';
import { fmt, T } from './strings';

export type Segment = { text: string; color?: string };

const SEP: Segment = { text: '  ·  ' };
const ok = (yes: boolean, label: string): Segment => ({ text: `${label} ${yes ? '✓' : '✗'}`, color: yes ? CSS.okLight : CSS.badLight });
const bad = (text: string): Segment => ({ text, color: CSS.badLight });
const title = (text: string): Segment => ({ text, color: CSS.gold });

/** Describes the content of a cell for the info line (Ver tool). */
export function describeCell(s: GameState, x: number, y: number): Segment[] {
  const i = indexOf(s, x, y);
  const b = s.grid[i];
  if (!b) {
    if (s.roads[i]) {
      const segs = [title(x === s.entrance.x && y === s.entrance.y ? 'Rua · entrada da cidade' : 'Rua'), SEP];
      return [...segs, ok(s.network[i], 'ligada ao altar')];
    }
    const f = s.feature[i];
    if (f === 'rock') return [title(T.feature.rock), SEP, { text: 'não dá para construir aqui' }];
    if (f) return [title(T.feature[f]), SEP, { text: `use Limpar para cortar (${RULES.treeClearCost} prata)` }];
    const g = s.ground[i];
    return [title(T.ground[g]), SEP, { text: g === 'river' ? 'não dá para construir aqui' : 'livre para construir' }];
  }

  if (b.kind === 'house') {
    const h = houseInfo(s, b)!;
    if (h.level === 0) {
      const segs = [title(h.name), SEP];
      if (!b.connected) return [...segs, bad('sem rua: nenhuma família vai chegar')];
      if (s.families.some((f) => f.houseId === b.id)) return [...segs, { text: 'uma família está a caminho' }];
      return [...segs, { text: 'esperando uma família' }, ...(s.famine ? [SEP, bad('a fome impede novas famílias')] : [])];
    }
    const segs: Segment[] = [title(h.name), SEP, { text: `${h.residents} moradores` }, SEP, { text: `imposto ${fmt(h.tax)}${T.perMonth}` }, SEP];
    if (!h.next) return [...segs, { text: 'nível máximo' }, ...(b.connected ? [] : [SEP, bad('sem rua')])];
    segs.push({ text: `Para ${h.next.name}: ` });
    h.next.needs.forEach((n, k) => {
      if (k) segs.push({ text: '  ' });
      segs.push(ok(n.ok, n.kind === 'road' && !n.ok ? 'sem rua' : T.need[n.kind]));
    });
    if (s.famine) segs.push(SEP, bad('fome: não evolui'));
    return segs;
  }

  const def = BUILDINGS[b.kind];
  const eff = computeEconomy(s).efficiency;
  const segs: Segment[] = [title(def.name)];
  if (b.kind === 'altar') return [...segs, SEP, { text: `raio ${def.radius}` }, SEP, { text: 'centro da cidade, onde as ruas começam' }];
  segs.push(SEP, ok(b.connected, b.connected ? 'ligado à rua' : 'sem rua'));
  if (!b.connected) return [...segs, SEP, bad(def.radius ? 'não atende ninguém' : 'não funciona')];
  if (def.jobs) segs.push(SEP, { text: `${def.jobs} vagas` });
  if (def.food) segs.push(SEP, { text: `${fmt(def.food * eff)} de comida${T.perMonth}` });
  if (def.silver) segs.push(SEP, { text: `${fmt(def.silver * eff)} de prata${T.perMonth}` });
  if (def.jobs && eff < 1) segs.push(bad(` (eficiência ${Math.round(eff * 100)}%)`));
  if (def.radius) segs.push(SEP, { text: `raio ${def.radius}` });
  return segs;
}

export const hintSegments = (hint: string): Segment[] => [{ text: hint, color: CSS.light }];

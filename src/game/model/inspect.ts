import { BUILDINGS, indexOf, nextLevelOf, type Cell, type GameState, type Materials, type Rect } from '../../core';
import { T } from '../../render/strings';

/** A line of the balloon: its text and tone. */
export interface BalloonLine {
  text: string;
  tone: 'good' | 'bad' | 'gold' | 'text';
}

/** The tapped building's (or road's) balloon, as data. */
export interface Balloon {
  /** Footprint the balloon points at. */
  rect: Rect;
  title: string;
  lines: BalloonLine[];
  /** Melhorar: its label (cost and materials), or null at the top level / for what does not level. */
  upgrade: { label: string; cost: number; materials: Materials } | null;
  /** Demolir is offered (never for the altar or the temple). */
  demolish: boolean;
  /** Changes whenever what the balloon shows changes (redraw only then). */
  key: string;
}

/** The balloon of the selected cell, or null when nothing worth one is there. */
export function balloonOf(s: GameState, c: Cell | null): Balloon | null {
  if (!c) return null;
  const b = s.grid[indexOf(s, c.x, c.y)];
  const road = !b && s.roads[indexOf(s, c.x, c.y)];
  if (!b && !road) return null;
  const N = T.nova.inspect;
  const rect = b ? { x: b.x, y: b.y, w: b.w, h: b.h } : { x: c.x, y: c.y, w: 1, h: 1 };
  const lines: BalloonLine[] = [];
  if (b && b.kind !== 'altar') lines.push(b.connected ? { text: `✓ ${N.connected}`, tone: 'good' } : { text: `✗ ${N.disconnected}`, tone: 'bad' });
  const levels = b ? BUILDINGS[b.kind].levels?.length : 0;
  if (b && levels) lines.push({ text: N.levelOf(b.level, levels + 1), tone: 'gold' });
  const next = b ? nextLevelOf(b) : null;
  const upgrade = next ? { label: N.upgrade(next.cost, next.materials), cost: next.cost, materials: next.materials ?? {} } : null;
  const demolish = !b || (b.kind !== 'altar' && b.kind !== 'temple');
  const title = b ? BUILDINGS[b.kind].name : T.need.road;
  return { rect, title, lines, upgrade, demolish, key: JSON.stringify([rect, title, lines, upgrade?.label, demolish]) };
}

import type { PanelChart } from '../game/model/panels';
import { NOVA } from '../game/palette';

const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const W = 200;
const H = 60;

/** Points of a line chart of `values` in a W x H box, scaled to [0, max]. */
function points(values: number[], max: number): string {
  const n = Math.max(1, values.length - 1);
  return values.map((v, i) => `${((i / n) * W).toFixed(1)},${(H - 2 - (Math.max(0, v) / max) * (H - 4)).toFixed(1)}`).join(' ');
}

/** A small SVG line chart of the last weeks; the limit (the food store) dashed. */
export function chartSvg(c: PanelChart): string {
  const max = Math.max(1, ...c.values, ...(c.limit ?? []));
  const color = css(NOVA.chart[c.color]);
  const limit = c.limit ? `<polyline points="${points(c.limit, max)}" fill="none" stroke="${css(NOVA.chart.capacity)}" stroke-width="1.5" stroke-dasharray="4 3"/>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><rect width="${W}" height="${H}" rx="6" fill="rgba(0,0,0,0.25)"/>${limit}<polyline points="${points(c.values, max)}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
}

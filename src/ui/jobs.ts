import type { BuildableKind, BuildingKind } from '../core';
import type { JobRow, JobsView } from '../game/model/jobs';
import { T } from '../game/strings';
import { h, onTap } from './dom';
import { iconEl } from './parts';

/** What the Profissões panel asks of the game: − / + on a profession, Automático and close. */
export interface JobsHost {
  change(kind: BuildingKind, delta: 1 | -1): void;
  auto(): void;
  close(): void;
}

/** A − or + of 44 px or more: dim (still a target) when it would change nothing. */
function stepButton(sign: '−' | '+', on: boolean, label: string, spot: string, fn: () => void) {
  const b = h('button.act.step', { class: on ? null : 'dim', 'data-spot': spot, 'aria-label': label, 'aria-disabled': on ? null : 'true' }, sign);
  onTap(b, () => on && fn());
  return b;
}

/** One profession: its building's thumbnail, name, "2 de 4 vagas" (and "falta 1" in amber), − [target] +. */
function jobRow(r: JobRow, thumb: string | undefined, host: JobsHost) {
  const N = T.nova.professions;
  const pic = h('span.thumb', {}, h('img', { alt: '', src: thumb ?? null }));
  const sub = h('span.sub', {}, h('span.t-muted', {}, r.label), r.missing ? h('span.t-warn', {}, N.missing(r.missing)) : null);
  const target = h('span.target', { class: r.auto ? 'auto' : null }, h('b', {}, String(r.target)), r.auto ? h('small', {}, N.autoSeal) : null);
  return h(
    'div.jobrow',
    { 'data-job': r.kind },
    pic,
    h('span.who', {}, h('b', {}, r.name), sub),
    h(
      'span.steps',
      {},
      stepButton('−', r.canLower, N.lower(r.name), `job-${r.kind}-minus`, () => host.change(r.kind, -1)),
      target,
      stepButton('+', r.canRaise, N.raise(r.name), `job-${r.kind}-plus`, () => host.change(r.kind, 1)),
    ),
  );
}

/**
 * The Profissões panel's content: the head (title, Automático, close), the fixed first row "Sem
 * trabalho N" with the children and elders small beside it, then one row per profession built.
 * The rows flow into two columns on a phone (CSS), one on PC. `note`: a short warning beside the title.
 */
export function jobsContent(v: JobsView, thumbs: Partial<Record<BuildableKind, string>>, note: string | null, host: JobsHost): Node[] {
  const N = T.nova.professions;
  const auto = h('button.act.small', { class: v.anyTarget ? 'gold' : 'dim', 'data-spot': 'jobs-auto', 'aria-disabled': v.anyTarget ? null : 'true' }, N.auto);
  onTap(auto, () => v.anyTarget && host.auto());
  const x = h('button.act.close.x', { 'data-spot': 'panel-close', 'aria-label': T.nova.inspect.close }, '✕');
  onTap(x, () => host.close());
  const head = h('div.jobshead', {}, h('b.t-gold', {}, N.title, note ? h('small.t-warn', {}, note) : null), auto, x);
  const idle = h(
    'div.jobrow.idle',
    { 'data-job': 'idle' },
    h('span.thumb.icon', {}, iconEl('people')),
    h('span.who', {}, h('b', {}, N.idle), h('span.sub.t-muted', {}, v.others)),
    h('span.count', { class: v.idle ? 't-warn' : null }, String(v.idle)),
  );
  // A phone fills the first column, then the second (CSS reads the rows per column).
  const rows = h('div.jobrows', { style: `--rows:${Math.ceil((v.rows.length + 1) / 2)}` }, idle, ...v.rows.map((r) => jobRow(r, thumbs[r.kind as BuildableKind], host)));
  return [head, rows];
}

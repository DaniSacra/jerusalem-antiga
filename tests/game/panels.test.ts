import { describe, expect, it } from 'vitest';
import { GOALS, readCity, refreshCity } from '../../src/core';
import { alertsPanel, goalsPanel, statsPanel, type StatsData } from '../../src/game/model/panels';
import { notices } from '../../src/render/nova/notices';
import { T } from '../../src/render/strings';
import { emptyGame, put, ROADSIDE } from '../helpers';

const data = (s: ReturnType<typeof emptyGame>): StatsData => {
  const city = readCity(s);
  return { s, e: city.eco, forecast: city.forecast, notices: notices(s, city) };
};
const texts = (lines: { parts: { text: string }[] }[]) => lines.flatMap((l) => l.parts.map((p) => p.text));

describe('panels as data (2D and 3D)', () => {
  it('Objetivos: the title, then every goal; the current one in gold with its progress; reward only on it on the phone', () => {
    const s = emptyGame();
    s.goalIndex = 1;
    const pc = goalsPanel(s, false);
    expect(pc[0].parts[0].text).toBe(T.nova.buttons.goals);
    expect(pc.length).toBeGreaterThanOrEqual(GOALS.length + 1);
    expect(pc[1].parts[0]).toEqual({ text: T.nova.goals.done, tone: 'good' });
    expect(pc[2].parts[0].tone).toBe('gold');
    expect(pc[2].parts.length).toBeGreaterThan(2);
    const phone = goalsPanel(s, true);
    expect(phone[3].parts.length).toBeLessThan(pc[3].parts.length);
  });

  it('Avisos: "no warnings" in green when there are none; each warning with ⚠', () => {
    expect(alertsPanel([])[0][1].parts[0]).toEqual({ text: T.nova.noAlerts, tone: 'good' });
    const two = alertsPanel([{ key: 'a', text: 'Falta comida', bad: true, toast: true }, { key: 'b', text: 'Casal', bad: false, toast: false }]);
    expect(two.length).toBe(2);
    expect(two[0][1].parts[0]).toEqual({ text: '⚠ Falta comida', tone: 'bad' });
    expect(two[1][0].parts[0].tone).toBe('warn');
  });

  it('Estatísticas "Agora": silver, food and work; the problems only on PC', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 30, 1);
    refreshCity(s);
    const pc = statsPanel('now', data(s), false);
    const all = texts(pc.flat());
    for (const t of [T.nova.stats.silver, T.nova.stats.food, T.nova.stats.work]) expect(all).toContain(t);
    expect(all).toContain(T.nova.stats.problems);
    expect(texts(statsPanel('now', data(s), true).flat())).not.toContain(T.nova.stats.problems);
  });

  it('"Povo": each family is a chip that goes to its house; "Histórico" waits for two weeks', () => {
    const s = emptyGame();
    const b = put(s, 'house', ROADSIDE, 30, 1);
    refreshCity(s);
    const chips = statsPanel('people', data(s), false).flat().find((l) => l.chips)!.chips!;
    expect(chips.map((c) => c.houseId)).toContain(b.id);
    s.history = [];
    expect(texts(statsPanel('history', data(s), false).flat())).toContain(T.nova.stats.noHistory);
  });
});

import { describe, expect, it } from 'vitest';
import { autoJobs, changeJobTarget, refreshCity } from '../../src/core';
import { jobsView } from '../../src/game/model/jobs';
import { T } from '../../src/game/strings';
import { EAST, emptyGame, person, put, ROADSIDE, westOf } from '../helpers';

/** A town of 4 adults (one elder, one child), a field (2 jobs, built first) and two lumber camps (2 jobs each). */
function town() {
  const s = emptyGame();
  const home = put(s, 'house', ROADSIDE, 30, 1, false, 4);
  person(s, { houseId: home.id, age: 70 });
  person(s, { houseId: home.id, age: 5 });
  put(s, 'field', westOf('field'), 41);
  put(s, 'lumber', EAST, 27);
  put(s, 'lumber', EAST, 29);
  return s;
}

describe('Profissões panel as data', () => {
  it('one row per profession built, in the jobPriority order; "Sem trabalho" with the children and elders', () => {
    const s = town();
    const v = jobsView(s);
    expect(v.rows.map((r) => r.kind)).toEqual(['field', 'lumber']);
    expect(v.rows[0].name).toBe(T.nova.professions.name.field);
    expect(v.idle).toBe(0);
    expect(v.others).toBe(T.nova.professions.others(1, 1));
    expect(v.anyTarget).toBe(false);
  });

  it('an automatic profession shows every job as its target, the auto seal, and + changes nothing', () => {
    const v = jobsView(town());
    const lumber = v.rows.find((r) => r.kind === 'lumber')!;
    expect(lumber).toMatchObject({ seats: 4, target: 4, auto: true, canRaise: false, canLower: true });
    expect(lumber.label).toBe(T.nova.professions.crew(lumber.crew, 4));
    // 4 adults: the field takes 2, the lumber camps the other 2.
    expect(lumber.crew).toBe(2);
    expect(lumber.missing).toBe(2);
  });

  it('"Ninguém livre" shows on its own whenever a profession waits and nobody is free, and only then', () => {
    const s = town();
    // 4 adults, 6 jobs: the lumber camps wait for 2 and nobody is free.
    expect(jobsView(s).note).toBe(T.nova.professions.nobodyFree);
    // Two lumber targets lowered to their crew: nothing waits.
    changeJobTarget(s, 'lumber', -1);
    expect(jobsView(s).note).toBeNull();
    // Someone free and a job waiting: no note (the free one takes it next week).
    changeJobTarget(s, 'field', -1);
    const v = jobsView(s);
    expect(v.idle + v.rows.find((r) => r.kind === 'lumber')!.crew).toBeGreaterThan(0);
    if (v.idle > 0) expect(v.note).toBeNull();
  });

  it('− frees a worker into "Sem trabalho" and the target becomes a number; + on it can raise again', () => {
    const s = town();
    changeJobTarget(s, 'field', -1);
    const v = jobsView(s);
    const field = v.rows.find((r) => r.kind === 'field')!;
    expect(field).toMatchObject({ crew: 1, target: 1, auto: false, missing: 0, canRaise: true, canLower: true });
    expect(v.anyTarget).toBe(true);
    // The worker freed went to the lumber camps (automatic, with free jobs) or waits without work.
    expect(v.idle + v.rows.find((r) => r.kind === 'lumber')!.crew).toBe(3);
  });

  it('a target above the crew reads "falta N"; at 0 with nobody there − changes nothing', () => {
    const s = town();
    changeJobTarget(s, 'lumber', -1);
    changeJobTarget(s, 'lumber', -1);
    let lumber = jobsView(s).rows.find((r) => r.kind === 'lumber')!;
    expect(lumber).toMatchObject({ crew: 0, target: 0, canLower: false, missing: 0 });
    changeJobTarget(s, 'field', -1);
    changeJobTarget(s, 'field', -1);
    changeJobTarget(s, 'lumber', 1);
    changeJobTarget(s, 'lumber', 1);
    changeJobTarget(s, 'lumber', 1);
    lumber = jobsView(s).rows.find((r) => r.kind === 'lumber')!;
    expect(lumber.target).toBe(3);
    expect(lumber.missing).toBe(lumber.target - lumber.crew);
    expect(T.nova.professions.missing(1)).toBe('falta 1');
  });

  it('a workplace off the road says "sem rua"; Automático brings the auto seal back', () => {
    const s = town();
    s.roads.fill(false); // every workplace off the road
    refreshCity(s);
    const field = jobsView(s).rows.find((r) => r.kind === 'field')!;
    expect(field.seats).toBe(0);
    expect(field.label).toBe(T.nova.professions.noRoad);
    changeJobTarget(s, 'lumber', -1);
    autoJobs(s);
    expect(jobsView(s).rows.every((r) => r.auto)).toBe(true);
  });
});

describe('the tax row (package G)', () => {
  it('shows the rate and its effect; − and + dim at the ends', () => {
    const s = town();
    expect(jobsView(s).tax).toEqual({ rate: 20, label: 'sem efeito na Alegria', tone: 'muted', canLower: true, canRaise: true });
    s.taxRate = 30;
    expect(jobsView(s).tax).toMatchObject({ label: '−8 de Alegria', tone: 'warn', canRaise: false });
    s.taxRate = 0;
    expect(jobsView(s).tax).toMatchObject({ label: '+16 de Alegria', tone: 'good', canLower: false });
  });
});

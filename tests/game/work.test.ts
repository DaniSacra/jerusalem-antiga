import { describe, expect, it } from 'vitest';
import { alerts, BUILDINGS, crewOf, jobsOf, readCity, refreshCity, RULES, stepWeek, type GameState } from '../../src/core';
import { cardOf } from '../../src/game/model/card';
import { statsPanel } from '../../src/game/model/panels';
import { jobChoices, jobText } from '../../src/game/model/people';
import { sheetOf } from '../../src/game/model/person';
import { readEvents } from '../../src/game/events';
import { Session, type SessionView } from '../../src/game/session';
import { T } from '../../src/game/strings';
import { besideRiver, constRng, EAST, emptyGame, fill, LIFE_YEAR, person, put, ROADSIDE, westOf } from '../helpers';

const P = T.nova.people;
const W = RULES.weeksPerSeason;

/** A session over a test city (the session's own state is swapped for it), recording its toasts. */
function sessionOn(s: GameState) {
  const toasts: string[] = [];
  const view = { modalOpen: false, redraw: () => {}, overlay: () => {}, toast: (m: string) => toasts.push(m), out: () => {}, drawSpots: () => {}, glideTo: () => {}, openCategory: () => {}, setTutorial: () => {} } as SessionView;
  const session = new Session({ seed: 5, tutorial: false, seen: true });
  (session as unknown as { state: GameState }).state = s;
  session.attach(view);
  return { session, toasts };
}

describe('work on screen (plan B2)', () => {
  it('jobText: the work, a farmer resting in winter, an elder resting; the sheet says when every job is taken', () => {
    const s = emptyGame({ week: 0 });
    put(s, 'field', westOf('field'), 30);
    const tent = put(s, 'house', ROADSIDE, 27, 1, false, 3);
    const [a, b, c] = s.people.filter((p) => p.houseId === tent.id);
    const jobs = jobsOf(s);
    expect([a, b].map((p) => jobText(s, p, jobs))).toEqual([P.job.field![0], P.job.field![1]]);
    expect(jobText(s, c, jobs)).toBe(P.noJob); // short in the house's list
    expect(sheetOf(s, c).job).toBe(P.noJobFull); // the sheet says why: the field is full and there is nothing else
    s.week = W; // winter
    expect(jobText(s, a, jobsOf(s))).toBe(P.winterRest(P.job.field![0]));
    const elder = person(s, { houseId: tent.id, sex: 'f', age: 60 });
    expect(jobText(s, elder, jobsOf(s))).toBe(P.elderRest('f'));
    put(s, 'lumber', EAST, 40); // takes c
    expect(jobText(s, c, jobsOf(s))).toBe(P.job.lumber![1 - (c.sex === 'm' ? 1 : 0)]);
  });

  it('the sheet of an adult offers "Mudar": the free jobs (nearest first) and "Sem trabalho"; a child gets none', () => {
    const s = emptyGame();
    const lumber = put(s, 'lumber', EAST, 27);
    const tent = put(s, 'house', ROADSIDE, 27, 1, false, 2);
    const far = put(s, 'fisher', besideRiver(s, 40), 40);
    const near = put(s, 'field', EAST, 30);
    const [a] = s.people.filter((p) => p.houseId === tent.id);
    expect(a.jobId).toBe(lumber.id);
    expect(jobChoices(s, a)).toEqual([
      { id: near.id, label: P.option(BUILDINGS.field.name, 0, 2) },
      { id: far.id, label: P.option(BUILDINGS.fisher.name, 0, 1) },
      { id: null, label: P.leaveJob },
    ]);
    expect(sheetOf(s, a).choices).toEqual(jobChoices(s, a));
    const kid = person(s, { houseId: tent.id, age: 5 });
    expect(sheetOf(s, kid).choices).toBeNull();
  });

  it('a workplace balloon says "Trabalhadores n/m" with the names; empty, it says how to staff it or that adults are missing, and the half upkeep', () => {
    const s = emptyGame();
    const lumber = put(s, 'lumber', EAST, 27);
    const texts = () => cardOf(s, lumber, readCity(s), false)!.lines.map((l) => l.text);
    expect(texts()).toContain(T.nova.inspect.crew(0, 2));
    expect(texts()).toContain(T.nova.inspect.noAdults(0)); // nobody to move
    expect(texts()).toContain(T.nova.inspect.upkeepEmpty(BUILDINGS.lumber.upkeep! * RULES.emptyUpkeepFactor));
    expect(T.nova.inspect.noAdults(3)).toBe('Ninguém trabalha aqui: faltam adultos (3 crianças na cidade)');
    const tent = put(s, 'house', ROADSIDE, 31, 1, false, 0);
    fill(s, tent, 2);
    const field = put(s, 'field', westOf('field'), 33); // takes both: earlier in jobPriority
    expect(crewOf(s, field)).toHaveLength(2);
    expect(crewOf(s, lumber)).toEqual([]);
    expect(texts()).toContain(T.nova.inspect.noWorkers); // someone could be moved
    s.buildings = s.buildings.filter((b) => b !== field && b !== tent);
    s.people = [];
    refreshCity(s);
    put(s, 'house', ROADSIDE, 27, 1, false, 1);
    let lines = cardOf(s, lumber, readCity(s), false)!.lines;
    expect(lines.map((l) => l.text)).toContain(T.nova.inspect.upkeep(BUILDINGS.lumber.upkeep!));
    lines = cardOf(s, lumber, readCity(s), false)!.lines;
    expect(lines.map((l) => l.text)).toContain(T.nova.inspect.crew(1, 2));
    expect(lines.find((l) => l.people)!.people!.map((p) => p.id)).toEqual(crewOf(s, lumber).map((p) => p.id));
  });

  it('the Povo tab says who works of the adults; the Agora tab has the free jobs', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 1, false, 3);
    put(s, 'lumber', EAST, 27);
    const people = JSON.stringify(statsPanel('people', { s, e: readCity(s).eco, forecast: null, notices: [] }, false));
    expect(people).toContain(T.nova.stats.workLine(2, 3, 1));
    const now = JSON.stringify(statsPanel('now', { s, e: readCity(s).eco, forecast: null, notices: [] }, false));
    expect(now).toContain(T.nova.stats.freeJobs);
  });

  it('alerts: unemployment from 3, and the first empty workplace that makes something', () => {
    const s = emptyGame();
    put(s, 'granary', EAST, 36); // stores even empty: no alert
    expect(alerts(s).map((a) => a.kind)).not.toContain('noCrew');
    put(s, 'lumber', EAST, 27);
    put(s, 'fisher', besideRiver(s, 32), 32);
    expect(alerts(s).filter((a) => a.kind === 'noCrew')).toEqual([{ kind: 'noCrew', building: 'lumber' }]);
    expect(T.alert({ kind: 'noCrew', building: 'lumber' })).toBe(`${BUILDINGS.lumber.name} sem trabalhadores: toque numa pessoa e mude a profissão`);
  });

  it('a market that loses its last worker says it covers nothing (week event and Mudar alike)', () => {
    const s = emptyGame({ food: 1000 });
    const market = put(s, 'market', westOf('market'), 31);
    const tent = put(s, 'house', ROADSIDE, 27, 1, false, 1);
    const [p] = s.people.filter((o) => o.houseId === tent.id);
    expect(p.jobId).toBe(market.id);
    p.birthWeek = s.week + 1 - RULES.people.elderAge * LIFE_YEAR; // an elder from next week
    const events = stepWeek(s, constRng(0.99));
    expect(events).toContainEqual({ type: 'serviceEmpty', kind: 'market', x: market.x, y: market.y });
    expect(readEvents(s, events, { births: 0, weddings: 0 })).toContainEqual({ do: 'toast', msg: T.serviceEmpty('market'), tone: 'bad' });
    const t = emptyGame();
    const m = put(t, 'market', westOf('market'), 31);
    put(t, 'house', ROADSIDE, 27, 1, false, 1);
    const lumber = put(t, 'lumber', EAST, 40);
    const [q] = crewOf(t, m);
    const { session, toasts } = sessionOn(t);
    expect(session.setJob(q.id, lumber.id)).toBe(true);
    expect(toasts).toContain(T.serviceEmpty('market'));
    expect(t.coverage.market.some(Boolean)).toBe(false);
  });

  it('building a workplace with nobody free says so', () => {
    const s = emptyGame();
    put(s, 'house', ROADSIDE, 27, 1, false, 1);
    put(s, 'lumber', EAST, 27);
    refreshCity(s);
    s.unlocked.push('fisher');
    const { session, toasts } = sessionOn(s);
    session.selectTool('fisher');
    session.apply({ x: besideRiver(s, 34), y: 34 }, true);
    expect(toasts).toContain(T.noCrewBuilt('fisher'));
  });
});

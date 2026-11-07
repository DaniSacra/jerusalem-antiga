import { describe, expect, it } from 'vitest';
import { createRng, TEMPLE_STAGES, type GameState } from '../../src/core';
import { haulJobs, legOf, waitAfter } from '../../src/render3d/haul';
import { cityPlan, footprintOf, MODEL_KEYS } from '../../src/render3d/plan';
import { cityKeys } from '../../src/render3d/diff';
import { ambientPlan } from '../../src/render3d/ambient';
import { BUILD_SPOTS, builderFloor, COURT, GROW_STEPS, growOf, PEN, penAnimals, SITE_KEYS, siteKey, siteLook } from '../../src/render3d/works';
import LOOK from '../../src/render3d/look3d.json';
import { emptyGame, hire, put } from '../helpers';

/** A town with the Temple and `done` stages built; `active`: the next one under way with `crew` builders at work. */
function town(done: number, active = false, crew = 0, progress = 0) {
  const s = emptyGame();
  // The ruined Temple stands by the altar from the start; a map without it gets one by the road.
  const temple = s.buildings.find((b) => b.kind === 'temple') ?? put(s, 'temple', 18, 27);
  const altar = s.buildings.find((b) => b.kind === 'altar')!;
  s.temple = { done, active, progress };
  const st = TEMPLE_STAGES[done];
  const site = st?.site === 'altar' ? altar : temple;
  if (active && st) site.builders = st.builders;
  if (crew) hire(s, site, crew);
  return { s, temple, altar, site };
}

const keys = (s: GameState, kind: 'altar' | 'temple') => siteLook(s, { kind })!.adds.map((a) => a.key);

describe('the Temple in stages (3D, as data)', () => {
  it('has a code model of the Temple\'s size for every stage, rise and works key', () => {
    for (const k of SITE_KEYS) expect(MODEL_KEYS).toContain(k);
    for (const k of ['temple-0', 'temple-3', 'rise-3', 'rise-4', 'works-2', 'works-5'] as const) expect(footprintOf(k)).toEqual([6, 6]);
    for (const k of ['altar-new', 'altar-ruin', 'works-1'] as const) expect(footprintOf(k)).toEqual([4, 4]);
  });

  it('only draws something for the altar and the Temple', () => {
    const { s } = town(0);
    expect(siteLook(s, { kind: 'house' })).toBeNull();
    expect(siteLook(s, { kind: 'market' })).toBeNull();
  });

  it('starts with the altar and the Temple in ruins: no fire, no works, nobody', () => {
    const { s } = town(0);
    expect(siteLook(s, { kind: 'altar' })).toMatchObject({ key: 'altar-ruin', fire: 0, adds: [], builders: 0, works: false, dust: false });
    expect(siteLook(s, { kind: 'temple' })).toMatchObject({ key: 'temple-0', sy: 1, adds: [], works: false, smokes: false });
  });

  it('restores the altar with its stacked stones, the new wall rising and the builders at work', () => {
    const { s } = town(0, true, 2, 6);
    const look = siteLook(s, { kind: 'altar' })!;
    expect(look).toMatchObject({ key: 'altar-ruin', builders: 2, works: true, dust: true });
    expect(look.adds).toEqual([{ key: 'altar-new', y: 0, sy: 0.5 }, { key: 'works-1', y: 0, sy: 1 }]);
    // Nothing happens at the Temple meanwhile.
    expect(siteLook(s, { kind: 'temple' })!.adds).toEqual([]);
  });

  it('a restored altar burns bigger, with its new steps and wall, and keeps the city\'s flock in its pen', () => {
    const { s } = town(1);
    const look = siteLook(s, { kind: 'altar' })!;
    expect(look).toMatchObject({ key: 'altar', fire: LOOK.works.restoredFire, works: false });
    expect(look.fire).toBeGreaterThan(1);
    expect(look.adds).toEqual([{ key: 'altar-new', y: 0, sy: 1 }]);
    expect(penAnimals(s)).toBe(0);
    Object.assign(s, { livestock: 9 });
    expect(penAnimals(s)).toBe(PEN.max);
    const altar = s.buildings.find((b) => b.kind === 'altar')!;
    const pen = ambientPlan(s).filter((o) => Math.hypot(o.x - (altar.x + 2 + PEN.x), o.z - (altar.y + 2 + PEN.z)) < PEN.w);
    expect(pen.filter((o) => o.kind === 'sheep' || o.kind === 'goat')).toHaveLength(PEN.max);
    // Not before it is restored.
    s.temple.done = 0;
    expect(penAnimals(s)).toBe(0);
  });

  it('works stopped with nobody: the works stand, the tools lie on the ground, no dust', () => {
    const { s } = town(1, true, 0, 10);
    const look = siteLook(s, { kind: 'temple' })!;
    expect(look).toMatchObject({ builders: 0, works: true, dust: false });
    expect(look.adds.map((a) => a.key)).toEqual(['temple-1', 'works-2', 'tools']);
    expect(look.adds.find((a) => a.key === 'tools')!.y).toBe(0);
  });

  it('the Alicerce rises over the ruins as they are cleared, the builders on the rising platform', () => {
    const { s } = town(1, true, 4, 20);
    const look = siteLook(s, { kind: 'temple' })!;
    expect(look.key).toBe('temple-0');
    expect(look.sy).toBeLessThan(1);
    expect(look.adds[0]).toEqual({ key: 'temple-1', y: 0, sy: 0.5 });
    expect(look.builders).toBe(4);
    expect(builderFloor(s)).toBeCloseTo(COURT * 0.5, 5);
  });

  it('each stage built is the Temple\'s model; the stage under way rises on it with its works', () => {
    expect(siteLook(town(2).s, { kind: 'temple' })!.key).toBe('temple-1');
    expect(keys(town(2, true, 1).s, 'temple')).toEqual(['rise-3', 'works-3']);
    expect(siteLook(town(3).s, { kind: 'temple' })!.key).toBe('temple-2');
    expect(keys(town(3, true, 1).s, 'temple')).toEqual(['rise-4', 'works-4']);
    expect(siteLook(town(4).s, { kind: 'temple' })!.key).toBe('temple-3');
    // The Consagração adds nothing rising, only its works; stopped, the tools lie on the court.
    expect(keys(town(4, true, 1).s, 'temple')).toEqual(['works-5']);
    const stopped = siteLook(town(4, true, 0).s, { kind: 'temple' })!;
    expect(stopped.adds.find((a) => a.key === 'tools')!.y).toBe(COURT);
    // Consecrated: the whole Temple, its court altar smoking, nothing else.
    expect(siteLook(town(5).s, { kind: 'temple' })).toMatchObject({ key: 'temple', adds: [], smokes: true, works: false });
  });

  it('rises in steps, never flat, full at the work', () => {
    expect(growOf(0, 40)).toBe(1 / GROW_STEPS);
    expect(growOf(20, 40)).toBe(0.5);
    expect(growOf(21, 40)).toBe(5 / GROW_STEPS);
    expect(growOf(40, 40)).toBe(1);
    expect(growOf(99, 40)).toBe(1);
  });

  it('draws builders only up to the stage\'s jobs', () => {
    const { s } = town(1, true, 6);
    expect(siteLook(s, { kind: 'temple' })!.builders).toBeLessThanOrEqual(TEMPLE_STAGES[1].builders);
  });

  it('the city is drawn again when a stage begins, rises a step, stops or is built, not every week of work', () => {
    const { s } = town(1, true, 4, 0);
    const k0 = siteKey(s);
    s.temple.progress = 1;
    expect(siteKey(s)).toBe(k0); // same step
    s.temple.progress = 10;
    const k1 = siteKey(s);
    expect(k1).not.toBe(k0);
    expect(cityKeys(s).buildings).toContain(k1);
    s.temple = { done: 2, active: false, progress: 0 };
    expect(siteKey(s)).not.toBe(k1);
  });

  it('the plan draws the Temple by its stage', () => {
    const { s, temple } = town(3);
    const p = cityPlan(s).buildings.find((o) => o.b === temple)!;
    expect(p.key).toBe('temple-2');
    expect(p.site?.key).toBe('temple-2');
  });

  it('builders walk from the site\'s door to a pile, carry the stone to where the stage rises, and back to the pile', () => {
    const { s, temple } = town(2, true, 3);
    const jobs = haulJobs(s).filter((j) => j.job === 'build');
    expect(jobs).toEqual([1, 2, 3].map(() => ({ job: 'build', home: temple.id })));
    const rng = createRng(4);
    const out = legOf(s, 'build', temple, true, [], rng);
    expect(out).toHaveLength(3);
    const mid = { x: temple.x + 3, y: temple.y + 3 };
    const local = (p: { x: number; y: number }) => [+(p.x - mid.x).toFixed(5), +(p.y - mid.y).toFixed(5)];
    expect(out[0].up).toBe(0); // from the road
    expect(BUILD_SPOTS[3].piles.map((p) => p.map((v) => +v.toFixed(5)))).toContainEqual(local(out[1]));
    expect(BUILD_SPOTS[3].work.map((p) => p.map((v) => +v.toFixed(5)))).toContainEqual(local(out[2]));
    expect(out[2].up).toBe(COURT); // on the court
    const back = legOf(s, 'build', temple, false, out, rng);
    expect(back).toEqual([out[2], out[1]]);
    expect(legOf(s, 'build', temple, true, back, rng)[0]).toEqual(out[1]);
    // They hammer longer than they rest at the pile.
    expect(waitAfter('build', true, () => 0)).toBe(LOOK.works.workSeconds[0]);
    expect(waitAfter('build', false, () => 0)).toBe(LOOK.works.pileSeconds[0]);
  });

  it('nobody goes to works that stopped, and nobody to a Temple off the road', () => {
    const { s, temple } = town(2, true, 0);
    expect(haulJobs(s).some((j) => j.job === 'build')).toBe(false);
    const busy = town(2, true, 2);
    busy.temple.connected = false;
    expect(haulJobs(busy.s).some((j) => j.job === 'build')).toBe(false);
    expect(temple).toBeTruthy();
  });
});

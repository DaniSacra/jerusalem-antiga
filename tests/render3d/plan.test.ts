import { describe, expect, it } from 'vitest';
import { BUILDINGS, indexOf, RULES, type BuildableKind, type BuildingKind } from '../../src/core';
import { cityPlan, facing, footprintOf, LEVELLED, lookOf, MODEL_KEYS, regrowth, residentsOf, SAPLING_FROM, TRIM_KEYS, VACANT_TINT, walkerCount } from '../../src/render3d/plan';
import { emptyGame, put } from '../helpers';

const house = (level: number, emptyLevel = 0) => ({ kind: 'house' as const, level, emptyLevel, variant: 0, w: 2, h: 2 });

describe('what the 3D view draws', () => {
  it('has a model for every building kind, tree, rock and road', () => {
    for (const k of Object.keys(BUILDINGS) as BuildingKind[]) {
      const look = lookOf({ kind: k, level: k === 'house' ? 1 : 1, emptyLevel: 0, variant: 0, w: BUILDINGS[k].w ?? 1, h: BUILDINGS[k].h ?? 1 });
      expect(MODEL_KEYS).toContain(look.key);
    }
    for (const k of ['olive', 'palm', 'rock', 'stump', 'sapling', 'road', 'lumber', 'quarry', 'plaza', 'park'] as const) expect(MODEL_KEYS).toContain(k);
  });

  it('draws houses by level, and an empty house by the level it kept, dimmed', () => {
    expect([0, 1, 2, 3, 4].map((l) => lookOf(house(l)).key)).toEqual(['house-0', 'house-1', 'house-2', 'house-3', 'house-4']);
    expect(lookOf(house(2)).vacant).toBe(false);
    // Empty with a kept stone house: the stone house, dimmer, nobody in it.
    const kept = lookOf(house(0, 3));
    expect(kept).toMatchObject({ key: 'house-3', tint: VACANT_TINT, vacant: true, houseLevel: 3 });
    // A tent keeps nothing: an empty plot.
    expect(lookOf(house(0, 0))).toMatchObject({ key: 'house-0', tint: 1, vacant: true });
  });

  it('draws fields by crop', () => {
    expect([0, 1, 2, 3, 5].map((v) => lookOf({ kind: 'field', level: 1, emptyLevel: 0, variant: v, w: 2, h: 2 }).key)).toEqual(['field-0', 'field-1', 'field-2', 'field-3', 'field-1']);
  });

  it('makes service buildings taller and richer at levels 2 and 3, with a stone trim of their footprint', () => {
    expect(LEVELLED.sort()).toEqual(['granary', 'market', 'workshop']);
    for (const kind of LEVELLED) {
      const [w, h] = [BUILDINGS[kind].w!, BUILDINGS[kind].h ?? BUILDINGS[kind].w!];
      const at = (level: number) => lookOf({ kind, level, emptyLevel: 0, variant: 0, w, h });
      expect(at(1)).toMatchObject({ key: kind, trim: null, sy: 1, tint: 1 });
      expect(at(2).trim).toBe(`trim-${w}x${h}-2`);
      expect(at(3).trim).toBe(`trim-${w}x${h}-3`);
      expect(at(2).sy).toBeGreaterThan(at(1).sy);
      expect(at(3).sy).toBeGreaterThan(at(2).sy);
      expect(at(3).tint).toBeGreaterThan(at(2).tint);
      for (const l of [2, 3]) expect(TRIM_KEYS).toContain(at(l).trim);
      expect(footprintOf(at(2).trim!)).toEqual([w, h]);
    }
    // Kinds without levels never get a trim.
    expect(lookOf({ kind: 'plaza', level: 1, emptyLevel: 0, variant: 0, w: 2, h: 2 }).trim).toBeNull();
  });

  it('gives each model key the footprint of its building', () => {
    expect(footprintOf('market')).toEqual([2, 4]);
    expect(footprintOf('temple')).toEqual([6, 6]);
    expect(footprintOf('house-3')).toEqual([2, 2]);
    expect(footprintOf('field-2')).toEqual([2, 2]);
    expect(footprintOf('lumber')).toEqual([2, 2]);
    expect(footprintOf('olive')).toEqual([1, 1]);
  });

  it('places every building once, centred on its footprint, facing a road beside it', () => {
    const s = emptyGame();
    const h = put(s, 'house', 25, 27, 2); // right of the starting road (x = 24)
    const m = put(s, 'market', 20, 27); // 2x4 upright, left of the road
    const r = put(s, 'market', 26, 35, 0, true); // rotated 4x2
    const plan = cityPlan(s);
    const of = (id: number) => plan.buildings.filter((p) => p.b.id === id);
    expect(of(h.id)).toHaveLength(1);
    expect(of(h.id)[0]).toMatchObject({ key: 'house-2', x: 26, z: 28 });
    // The road is on the house's west side: it turns its front (+z) to -x.
    expect(facing(s, h)).toBeCloseTo(-Math.PI / 2);
    expect(of(m.id)[0]).toMatchObject({ key: 'market', x: 21, z: 29 });
    expect(facing(s, r)).toBeCloseTo(Math.PI / 2);
    const altar = plan.buildings.find((p) => p.b.kind === 'altar')!;
    expect(altar.rot).toBe(0);
  });

  it('draws trees, rocks and roads off the buildings, and a cut tree as a stump with a sapling as it grows back', () => {
    const s = emptyGame();
    const at = (x: number, y: number) => indexOf(s, x, y);
    s.feature[at(5, 5)] = 'olive';
    s.feature[at(6, 5)] = 'rock';
    s.feature[at(7, 5)] = 'stump';
    s.feature[at(8, 5)] = 'stump';
    s.week = 200;
    s.stumps = [
      { i: at(7, 5), kind: 'olive', week: 200 },
      { i: at(8, 5), kind: 'palm', week: 200 - Math.ceil(RULES.treeRegrowWeeks * 0.6) },
    ];
    expect(regrowth(s, at(7, 5))).toBe(0);
    expect(regrowth(s, at(8, 5))).toBeGreaterThanOrEqual(SAPLING_FROM);
    const props = cityPlan(s).props;
    const near = (x: number) => props.filter((p) => Math.floor(p.x) === x && Math.floor(p.z) === 5).map((p) => p.key);
    expect(near(5)).toEqual(['olive']);
    expect(near(6)).toEqual(['rock']);
    expect(near(7)).toEqual(['stump']);
    expect(near(8).sort()).toEqual(['sapling', 'stump']);
    const roads = props.filter((p) => p.key === 'road').length;
    expect(roads).toBe(s.roads.filter((r, i) => r && !s.grid[i]).length);
    expect(cityPlan(s).roads).toHaveLength(roads);
  });

  it('puts more walkers on the streets of a bigger city, within a cap', () => {
    const s = emptyGame();
    expect(residentsOf(s)).toBe(0);
    put(s, 'house', 25, 27, 2, false, 6);
    expect(residentsOf(s)).toBe(6);
    expect(walkerCount(0)).toBeGreaterThan(0);
    expect(walkerCount(100)).toBeGreaterThan(walkerCount(10));
    expect(walkerCount(10_000)).toBe(walkerCount(20_000));
  });

  it('draws every buildable kind the player can place', () => {
    const s = emptyGame();
    const spots: [BuildableKind, number, number][] = [['lumber', 27, 28], ['quarry', 27, 31], ['plaza', 27, 34], ['park', 27, 37]];
    for (const [k, x, y] of spots) put(s, k, x, y);
    const keys = cityPlan(s).buildings.map((p) => p.key);
    for (const [k] of spots) expect(keys).toContain(k);
  });
});

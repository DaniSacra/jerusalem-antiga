import { describe, expect, it } from 'vitest';
import { foodCapacity, harvestsIn, indexOf, refreshCity } from '../../src/core';
import { changedLayers, cityKeys } from '../../src/render3d/diff';
import { emptyGame, put, road, ROADSIDE } from '../helpers';

describe('what changed in the drawn city', () => {
  it('everything the first time, nothing when the city is the same', () => {
    const s = emptyGame();
    const k = cityKeys(s);
    expect(changedLayers(null, k)).toEqual(['buildings', 'props', 'people']);
    expect(changedLayers(k, cityKeys(s))).toEqual([]);
  });

  it('a new building, a level up or a lost road connection changes the buildings layer', () => {
    const s = emptyGame();
    const a = cityKeys(s);
    const h = put(s, 'house', 22, 30, 1);
    const b = cityKeys(s);
    expect(changedLayers(a, b)).toContain('buildings');
    h.level = 2;
    expect(changedLayers(b, cityKeys(s))).toContain('buildings');
    const c = cityKeys(s);
    h.connected = !h.connected;
    expect(changedLayers(c, cityKeys(s))).toEqual(['buildings']);
  });

  it('the granary yard filling up changes the buildings layer, a few sacks more of food do not', () => {
    const s = emptyGame();
    put(s, 'granary', 25, 30);
    s.food = 0;
    const a = cityKeys(s);
    s.food = 1;
    expect(changedLayers(a, cityKeys(s))).toEqual([]);
    s.food = foodCapacity(s);
    expect(changedLayers(a, cityKeys(s))).toEqual(['buildings']);
  });

  it('a road changes the props and who walks; a tree cut into a stump only the props', () => {
    const s = emptyGame();
    const a = cityKeys(s);
    road(s, [[24, 20]]);
    expect(changedLayers(a, cityKeys(s))).toEqual(expect.arrayContaining(['props', 'people']));
    s.feature[indexOf(s, 5, 5)] = 'olive';
    const b = cityKeys(s);
    s.feature[indexOf(s, 5, 5)] = 'stump';
    refreshCity(s);
    expect(changedLayers(b, cityKeys(s))).toEqual(['props']);
  });

  it('a harvesting field sends a carrier out (people); in winter it sends nobody', () => {
    const s = emptyGame();
    s.week = [...Array(52).keys()].find((w) => harvestsIn(w))!;
    const a = cityKeys(s);
    put(s, 'field', ROADSIDE, 30);
    refreshCity(s);
    expect(changedLayers(a, cityKeys(s))).toContain('people');
    const b = cityKeys(s);
    s.week = [...Array(52).keys()].find((w) => !harvestsIn(w))!;
    expect(changedLayers(b, cityKeys(s))).toEqual(['people']);
  });
});

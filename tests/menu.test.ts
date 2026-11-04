import { describe, expect, it } from 'vitest';
import { BUILDINGS, buildMenu, CATEGORIES, RULES, type BuildableKind } from '../src/core';

const ALL: BuildableKind[] = ['house', 'field', 'plaza', 'market', 'workshop', 'park', 'temple'];

describe('build menu', () => {
  it('gives every buildable kind a category and none to the altar', () => {
    for (const k of ALL) expect(CATEGORIES).toContain(BUILDINGS[k].category);
    expect(BUILDINGS.altar.category).toBeUndefined();
  });

  it('uses the configured categories', () => {
    expect([BUILDINGS.house.category, BUILDINGS.plaza.category, BUILDINGS.park.category]).toEqual(['home', 'home', 'home']);
    expect(BUILDINGS.field.category).toBe('supply');
    expect([BUILDINGS.market.category, BUILDINGS.workshop.category]).toEqual(['work', 'work']);
    expect(BUILDINGS.temple.category).toBe('special');
  });

  it('lists every building, in the given order, up to the limit', () => {
    expect(RULES.toolColumnMax).toBe(8);
    expect(buildMenu(ALL)).toEqual({ mode: 'list', items: ALL });
    const eight = [...ALL, 'house'] as BuildableKind[];
    expect(buildMenu(eight).mode).toBe('list');
  });

  it('does not share the input array', () => {
    const menu = buildMenu(ALL);
    if (menu.mode !== 'list') throw new Error('expected a list');
    expect(menu.items).not.toBe(ALL);
  });

  it('shows the categories in order above the limit, each keeping the given order', () => {
    expect(buildMenu(ALL, 6)).toEqual({
      mode: 'categories',
      groups: [
        { category: 'home', items: ['house', 'plaza', 'park'] },
        { category: 'supply', items: ['field'] },
        { category: 'work', items: ['market', 'workshop'] },
        { category: 'special', items: ['temple'] },
      ],
    });
  });

  it('leaves out empty categories', () => {
    expect(buildMenu(['plaza', 'field', 'house'], 2)).toEqual({
      mode: 'categories',
      groups: [
        { category: 'home', items: ['plaza', 'house'] },
        { category: 'supply', items: ['field'] },
      ],
    });
  });
});

import { describe, expect, it } from 'vitest';
import { pickView } from '../../src/app/view';

describe('which view opens', () => {
  it('the URL wins over the setting, and no WebGL 2 means 2D', () => {
    expect(pickView('', '2d', true)).toBe('2d');
    expect(pickView('', '3d', true)).toBe('3d');
    expect(pickView('?view=3d', '2d', true)).toBe('3d');
    expect(pickView('?seed=5&view=2d', '3d', true)).toBe('2d');
    expect(pickView('?view=3d', '3d', false)).toBe('2d');
    expect(pickView('?view=xyz', '2d', true)).toBe('2d');
  });
});

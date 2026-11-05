import { describe, expect, it } from 'vitest';
import { pickView } from '../../src/app/view';

describe('which view opens', () => {
  it('the 3D, unless the URL asks for the legacy 2D or there is no WebGL 2', () => {
    expect(pickView('', true)).toBe('3d');
    expect(pickView('?view=3d&seed=7', true)).toBe('3d');
    expect(pickView('?view=xyz', true)).toBe('3d');
    expect(pickView('?seed=5&view=2d', true)).toBe('2d');
    expect(pickView('', false)).toBe('2d');
    expect(pickView('?view=3d', false)).toBe('2d');
  });
});

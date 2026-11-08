import { describe, expect, it } from 'vitest';
import { contemplatePitch, pitchFor } from '../../src/render3d/camera';

describe('contemplate mode (D3)', () => {
  it('the view drops lower than the playable tilt at every distance, never flat', () => {
    for (let d = 7; d <= 70; d += 7) {
      expect(contemplatePitch(d)).toBeLessThan(pitchFor(d));
      expect(contemplatePitch(d)).toBeGreaterThanOrEqual(0.26);
    }
  });

  it('it still follows the zoom: higher from afar', () => {
    expect(contemplatePitch(60)).toBeGreaterThan(contemplatePitch(10));
  });
});

import LOOK from './look3d.json';
import { hash } from './plan';

/**
 * The country around the map (look only, no Three.js): the hills that rise beyond its edge so the
 * ground never ends in a straight cut, and the woods that grow on them (oaks and pines, dense near
 * the edge, thinning into the haze). Pure and tested; `terrain.ts` lifts the ground by `rimLift` and
 * `world.ts` draws `woodland`.
 */
const R = LOOK.rim;

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The map's size and where its entrance road leaves it (a pass is kept open there). */
export interface Frame {
  cols: number;
  rows: number;
  /** Column of the entrance road on the south edge. */
  entranceX: number;
  seed: number;
}

/** Distance from a point to the map rectangle (0 inside it). */
export function outside(f: Pick<Frame, 'cols' | 'rows'>, x: number, z: number): number {
  const dx = Math.max(-x, 0, x - f.cols);
  const dz = Math.max(-z, 0, z - f.rows);
  return Math.hypot(dx, dz);
}

/** Slow noise 0..1 for the hills and the clearings of the woods. */
function noise(x: number, z: number, seed: number): number {
  const a = Math.sin(x * 0.075 + seed) * Math.cos(z * 0.068 - seed * 1.7);
  const b = Math.sin(x * 0.19 + z * 0.16 + seed * 0.6) * 0.5;
  const c = Math.sin(x * 0.41 - z * 0.37 + seed * 2.3) * 0.18;
  return Math.min(1, Math.max(0, (a + b + c + 1.7) / 3.4));
}

/**
 * How high the ground is lifted at a point outside the map: nothing at the edge, rising in rolling
 * hills (taller in some places than others), with a pass kept open at the entrance road and a valley
 * where the river runs (`river`: how much river is near, 0..1).
 */
export function rimLift(f: Frame, x: number, z: number, river: number): number {
  const d = outside(f, x, z);
  if (d <= 0) return 0;
  const rise = smooth(R.start, R.full, d);
  const tall = R.height * (0.45 + 0.55 * noise(x + 40, z - 25, f.seed));
  const pass = z > f.rows ? smooth(R.passWidth * 0.3, R.passWidth, Math.abs(x - f.entranceX)) : 1;
  return rise * tall * pass * (1 - smooth(0, 0.3, river));
}

/** A tree or bush of the woods: where, which model, turn and size. */
export interface WoodPiece {
  key: 'oak' | 'olive' | 'pine' | 'wood' | 'shrub' | 'rock';
  x: number;
  z: number;
  rot: number;
  scale: number;
  /** Far pieces (cheap trees past `R.nearReach`), which the stage drops at the lower qualities. */
  far: boolean;
}

/**
 * The woods around the map: a jittered grid over the ring of land outside it, thick near the edge
 * and thinning out with the distance, in clumps with clearings between them, oaks and olives low
 * and pines up the hills, bushes and rocks at the edge of the wood. `heightAt` is the ground there
 * and `isRiver` keeps the water clear. Nothing grows inside the map or in the entrance pass.
 */
export function woodland(f: Frame, heightAt: (x: number, z: number) => number, isRiver: (x: number, z: number) => boolean): WoodPiece[] {
  const out: WoodPiece[] = [];
  const reach = R.reach;
  const x0 = -reach;
  const x1 = f.cols + reach;
  const z0 = -reach;
  const z1 = f.rows + reach;
  for (const [step, near] of [[R.nearStep, true], [R.farStep, false]] as const) {
    for (let gz = z0; gz < z1; gz += step)
      for (let gx = x0; gx < x1; gx += step) {
        const k = Math.round(gx * 7.3 + gz * 131.7 + step * 1000);
        const x = gx + hash(k, 1, 31) * step;
        const z = gz + hash(k, 2, 32) * step;
        const d = outside(f, x, z);
        // The near ring is dense woods up to nearReach; the far ring takes over beyond it, and not before.
        if (d < R.edge || (near ? d >= R.nearReach : d < R.nearReach) || d >= reach) continue;
        if (z > f.rows && Math.abs(x - f.entranceX) < R.passWidth * 0.8) continue;
        if (isRiver(x, z)) continue;
        // Clumps: slow noise with clearings between; thinner as the distance grows.
        const clump = noise(x * 1.7, z * 1.7, f.seed + 9);
        const density = (1 - smooth(R.thinFrom, reach, d)) * (0.3 + 0.9 * clump) * (near ? R.nearDensity : R.farDensity);
        if (hash(k, 3, 33) >= density) continue;
        const y = heightAt(x, z);
        const u = hash(k, 4, 34);
        const hill = smooth(R.pineFrom, R.pineFrom + 2.5, y);
        let key: WoodPiece['key'];
        let scale = 0.9 + hash(k, 5, 35) * 0.7;
        if (!near) {
          key = u < 0.12 + 0.7 * hill ? 'pine' : 'wood';
          scale *= R.farScale;
        } else if (d < R.edge + 1.5 && u > 0.55) {
          key = u > 0.85 ? 'rock' : 'shrub';
          scale *= 0.9;
        } else {
          // The full trees (oaks, olives) only close to the map; cheap round ones farther in, pines up the hills.
          const rich = 1 - smooth(R.richFrom, R.richTo, d);
          key = u < 0.07 + 0.8 * hill ? 'pine' : hash(k, 7, 37) < rich * R.richShare ? (hash(k, 8, 38) < 0.65 ? 'oak' : 'olive') : 'wood';
        }
        out.push({ key, x, z, rot: hash(k, 6, 36) * 6.28, scale, far: !near });
      }
  }
  return out;
}

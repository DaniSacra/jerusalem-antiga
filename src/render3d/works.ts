import { buildersAtWork, nextStage, TEMPLE_STAGES, type Building, type GameState } from '../core';
import LOOK from './look3d.json';

/**
 * The Temple in stages, as plain data (no Three.js): what the altar and the Temple's place show for
 * `s.temple` (the stages built, the one under way and its work). Pure and tested
 * (tests/render3d/works.test.ts); `world.ts` places the models, `haul.ts` walks the builders.
 *
 * The Temple's model is the stages built: the ruins of the old Temple on its old platform (fallen
 * walls, a broken stair, column drums, rubble and weeds; the Alicerce clears them as it rises), the
 * platform (Alicerce), the court and the roofless sanctuary (Paredes), the porch, columns and roofs
 * (Pórtico e telhado) and, consecrated, the whole Temple with its gold, the bronze sea and the altar.
 * The stage under way rises on it with its work (`grow`, in steps), with its works around it (stone
 * piles, scaffolds, the treadwheel crane); stopped (nobody at work), its tools lie on the ground.
 * The altar starts ruined (scattered blackened stones, no fire); restored, it is the altar with new
 * stone steps, a low wall and a pen of lambs for the offerings (ambient.ts), and its fire burns
 * while the offerings are made (out, cold stones, without them: the crisis reads from afar).
 */

/** The Temple's model by the stages of it built (0 the ruins .. 3 roofed, before the Consagração). */
export type TempleKey = `temple-${0 | 1 | 2 | 3}`;
/** What each stage adds, drawn rising while it is built (the Alicerce rises as `temple-1`). */
export type RiseKey = 'rise-3' | 'rise-4';
/** The works of each stage (1 the altar's .. 5 the Consagração's). */
export type WorksKey = `works-${1 | 2 | 3 | 4 | 5}`;
/** The restored altar's steps and wall; the tools left on the ground while the works stand still. */
export type SiteKey = TempleKey | RiseKey | WorksKey | 'altar-new' | 'altar-ruin' | 'tools';

export const SITE_KEYS: SiteKey[] = ['temple-0', 'temple-1', 'temple-2', 'temple-3', 'rise-3', 'rise-4', 'works-1', 'works-2', 'works-3', 'works-4', 'works-5', 'altar-new', 'altar-ruin', 'tools'];

/** Height of the Temple's court over the ground (models.ts builds the platform to it). */
export const COURT = 0.45;
/** The stage under way rises in this many steps (each one draws the city again). */
export const GROW_STEPS = 8;

/** A model drawn over a site, with its turn and place (`y` up, `sy` its height share). */
export interface SiteAdd {
  key: SiteKey;
  y: number;
  sy: number;
}

export interface SiteLook {
  /** The site's own model (the altar ruined or restored; the Temple is its stages built). */
  key: 'altar' | 'altar-ruin' | 'temple' | TempleKey;
  /** Its height share (the ruins sink as the Alicerce clears them and rises). */
  sy: number;
  /** Drawn over it: the restored altar, the stage rising, its works, the tools. */
  adds: SiteAdd[];
  /** Builders at work now (each one is drawn, see haul.ts). */
  builders: number;
  /** A stage under way here (its works stand), with builders (`builders` > 0) or stopped. */
  works: boolean;
  /** Light dust over the works while they go on (by day, as a quarry's). */
  dust: boolean;
  /** Size of the altar's fire: lit once restored and only while its offerings are made (`s.offered`); 0 ruined, without offerings and for the Temple. */
  fire: number;
  /** The Temple is consecrated: its court altar smokes. */
  smokes: boolean;
}

/** Stages of the Temple itself built (0..4: the stages after the altar's). */
export const templeBuilt = (s: Pick<GameState, 'temple'>) => Math.max(0, s.temple.done - 1);

/** How far up the stage under way stands (one of GROW_STEPS steps, never flat). */
export function growOf(progress: number, work: number): number {
  const share = work > 0 ? Math.min(1, Math.max(0, progress / work)) : 1;
  return Math.max(1, Math.ceil(share * GROW_STEPS)) / GROW_STEPS;
}

/** What the altar or the Temple shows now (null for any other building). */
export function siteLook(s: GameState, b: Pick<Building, 'kind'>): SiteLook | null {
  if (b.kind !== 'altar' && b.kind !== 'temple') return null;
  const st = nextStage(s);
  const here = !!st && s.temple.active && st.site === b.kind;
  const builders = here ? Math.min(st!.builders, buildersAtWork(s)) : 0;
  const grow = here ? growOf(s.temple.progress, st!.work) : 1;
  const stage = s.temple.done + 1;
  const adds: SiteAdd[] = [];
  if (b.kind === 'altar') {
    const restored = s.temple.done >= 1;
    if (restored) adds.push({ key: 'altar-new', y: 0, sy: 1 });
    if (here) adds.push({ key: 'altar-new', y: 0, sy: grow }, { key: 'works-1', y: 0, sy: 1 });
    if (here && !builders) adds.push({ key: 'tools', y: 0, sy: 1 });
    return { key: restored ? 'altar' : 'altar-ruin', sy: 1, adds, builders, works: here, dust: here && builders > 0, fire: restored && s.offered ? LOOK.works.restoredFire : 0, smokes: false };
  }
  const built = templeBuilt(s);
  const key = built >= TEMPLE_STAGES.length - 1 ? 'temple' : (`temple-${built}` as TempleKey);
  // The Alicerce clears the ruins as the new platform rises over them.
  const sy = built === 0 && here ? Math.max(0.15, 1 - grow) : 1;
  if (here) {
    const rise: SiteKey | null = stage === 2 ? 'temple-1' : stage === 3 ? 'rise-3' : stage === 4 ? 'rise-4' : null;
    if (rise) adds.push({ key: rise, y: 0, sy: grow });
    // The Alicerce's blocks lie on the platform as it rises; the later works stand on the court.
    adds.push({ key: `works-${stage as 2 | 3 | 4 | 5}`, y: stage === 2 ? COURT * grow : 0, sy: 1 });
    // The tools lie on the court once there is one, else on the ground by the ruins.
    if (!builders) adds.push({ key: 'tools', y: built >= 1 ? COURT : 0, sy: 1 });
  }
  return { key, sy, adds, builders, works: here, dust: here && builders > 0, fire: 0, smokes: key === 'temple' };
}

/** A short key of what the sites show (the city is drawn again when it changes; see diff.ts). */
export function siteKey(s: GameState): string {
  const st = nextStage(s);
  const at = st && s.temple.active ? `${growOf(s.temple.progress, st.work)}:${buildersAtWork(s) > 0 ? 1 : 0}` : '-';
  return `${s.temple.done}:${s.temple.active ? 1 : 0}:${at}:${penAnimals(s)}:${s.offered ? 1 : 0}`;
}

/** A point of a site's model (x, z from its middle, front +z) and how high a builder stands there. */
export type SpotAt = [x: number, z: number];

/**
 * Where the builders of each stage take stone (piles, by the works' stacks in models.ts) and lay it
 * (work: along the part rising), in the model's space. Stage 1 is the altar's.
 */
export const BUILD_SPOTS: Record<1 | 2 | 3 | 4 | 5, { piles: SpotAt[]; work: SpotAt[] }> = {
  1: { piles: [[-1.25, 1.35], [1.3, -1.25], [1.3, 1.25]], work: [[-1.55, 0], [1.55, 0.3], [0, -1.55], [0.7, 1.55]] },
  2: { piles: [[-2.2, 1.95], [1.85, -2.2], [-2.3, -1.85]], work: [[-0.6, -0.15], [0.5, 1.05], [1.4, -0.95], [-1.2, 1.15], [0.2, -1.75], [-1.6, -0.6]] },
  3: { piles: [[-1.9, 1.0], [1.6, 1.05]], work: [[-1.65, -1.4], [1.65, -1.2], [-0.6, -2.95], [0.6, -2.95], [-0.5, 0.35], [0.5, 0.35]] },
  4: { piles: [[-1.7, 1.05], [1.6, 1.35]], work: [[-0.4, 1.15], [0.4, 1.15], [-1.3, 0.9], [1.3, 0.9], [-0.6, -2.95], [0.6, -2.95]] },
  5: { piles: [[-1.7, 1.0], [1.5, 1.2]], work: [[-1.0, 1.6], [0.0, 1.7], [1.0, 1.6], [-0.4, 1.2]] },
};

/** How high the builders of the stage under way stand over the ground: on the court once the platform is laid, on the rising one while it is. */
export function builderFloor(s: GameState): number {
  const st = nextStage(s);
  if (!st || st.site !== 'temple') return 0;
  if (templeBuilt(s) >= 1) return COURT;
  return s.temple.active ? COURT * growOf(s.temple.progress, st.work) : 0;
}

/** Sheep and goats in the restored altar's pen (model space of the altar, see `altarNew` in models.ts): its middle and size. */
export const PEN = { x: -1.45, z: 1.2, w: 0.65, d: 0.9, max: 4 } as const;

/** Lambs kept in the restored altar's pen for the offerings: from the city's livestock (empty without it). */
export function penAnimals(s: Pick<GameState, 'temple' | 'livestock'>): number {
  return s.temple.done >= 1 ? Math.max(0, Math.min(PEN.max, Math.floor(s.livestock))) : 0;
}

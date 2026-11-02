export type Terrain = 'grass' | 'rock' | 'tree' | 'valley';
export type BuildingKind = 'house' | 'field' | 'well' | 'market' | 'workshop' | 'altar';
export type ServiceKind = 'well' | 'market' | 'altar';
export const SERVICE_KINDS: readonly ServiceKind[] = ['well', 'market', 'altar'];

export type Rng = () => number;

export interface BuildingDef {
  name: string;
  cost: number;
  jobs: number;
  radius?: number;
  food?: number;
  silver?: number;
}

export interface HouseLevelDef {
  name: string;
  residents: number;
  tax: number;
  needs: ServiceKind[];
}

export interface GoalDef {
  type: 'residents' | 'houses';
  target: number;
  /** Minimum house level, for type "houses". */
  level?: number;
  reward: number;
  unlock?: BuildingKind;
  victory?: boolean;
  text: string;
}

export interface Rules {
  startSilver: number;
  startFood: number;
  startUnlocked: BuildingKind[];
  monthSeconds: number;
  workerShare: number;
  foodPerResident: number;
  tentChance: number;
  monthsToChange: number;
  famineDropChance: number;
  treeClearCost: number;
  map: {
    cols: number;
    rows: number;
    rocks: number;
    trees: number;
    freeArea: { x0: number; x1: number; y0: number; y1: number };
    valley: { partialRows: [number, number] };
  };
}

export interface Building {
  kind: BuildingKind;
  /** House level (0..4). Unused by other kinds. */
  level: number;
  /** Consecutive months meeting the next level's needs. */
  upStreak: number;
  /** Consecutive months missing a need of the current level. */
  downStreak: number;
}

export type Coverage = Record<ServiceKind, boolean[]>;

export interface GameState {
  cols: number;
  rows: number;
  terrain: Terrain[];
  buildings: (Building | null)[];
  coverage: Coverage;
  silver: number;
  food: number;
  /** Months elapsed. */
  month: number;
  famine: boolean;
  goalIndex: number;
  unlocked: BuildingKind[];
  won: boolean;
}

export type GameEvent =
  | { type: 'houseUp'; x: number; y: number; level: number; delta: number }
  | { type: 'houseDown'; x: number; y: number; level: number; delta: number; famine: boolean }
  | { type: 'famineStart' }
  | { type: 'famineEnd' }
  | { type: 'goal'; index: number; reward: number; unlock?: BuildingKind }
  | { type: 'victory'; month: number };

export type FailReason = 'locked' | 'invalid' | 'silver';
export type ActionResult = { ok: true } | { ok: false; reason: FailReason };

export const isService = (k: string): k is ServiceKind => (SERVICE_KINDS as readonly string[]).includes(k);

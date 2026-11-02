export type Ground = 'sand' | 'grass' | 'river';
export type Feature = 'rock' | 'palm' | 'olive';
export type BuildingKind = 'house' | 'field' | 'well' | 'market' | 'workshop' | 'temple' | 'altar';
/** Buildings the player can place (the altar is fixed). */
export type BuildableKind = Exclude<BuildingKind, 'altar'>;
/** Everything the player can place: buildings and road. */
export type Placeable = BuildableKind | 'road';
/** Area services; "sacred" is the radius of the altar or a temple. */
export type ServiceKind = 'well' | 'market' | 'sacred';
export type NeedKind = 'road' | ServiceKind;
/** What a building's balloon can point out: a missing need, or a workplace with no workers. */
export type BalloonKind = NeedKind | 'workers';

export const SERVICE_KINDS: readonly ServiceKind[] = ['well', 'market', 'sacred'];

export type Rng = () => number;

export interface Cell {
  x: number;
  y: number;
}

export interface BuildingDef {
  name: string;
  cost: number;
  jobs: number;
  size?: number;
  radius?: number;
  food?: number;
  silver?: number;
  protected?: boolean;
}

export interface HouseLevelDef {
  name: string;
  residents: number;
  tax: number;
  needs: NeedKind[];
}

export interface GoalDef {
  type: 'residents' | 'houses' | 'build';
  target: number;
  /** Minimum house level, for type "houses". */
  level?: number;
  /** Building kind, for type "build". */
  kind?: BuildingKind;
  reward: number;
  unlock?: Placeable;
  victory?: boolean;
  text: string;
}

export interface Rules {
  startSilver: number;
  startFood: number;
  startUnlocked: Placeable[];
  monthSeconds: number;
  workerShare: number;
  foodPerResident: number;
  familyChance: number;
  /** The first plots get a family for sure (tents or better plus families on the way below this). */
  guaranteedFamilies: number;
  familyCellsPerMonth: number;
  monthsToChange: number;
  famineDropChance: number;
  treeClearCost: number;
  roadCost: number;
  map: {
    cols: number;
    rows: number;
    altar: Cell;
    clearRadius: number;
    rocks: number;
    olives: number;
    palms: number;
    grassShare: number;
    river: { minWidth: number; maxWidth: number };
  };
}

export interface Building {
  id: number;
  kind: BuildingKind;
  /** Top-left cell of the footprint. */
  x: number;
  y: number;
  size: number;
  /** House level (0..4). Unused by other kinds. */
  level: number;
  /** Consecutive months meeting the next level's needs. */
  upStreak: number;
  /** Consecutive months missing a need of the current level. */
  downStreak: number;
  /** Touches the road network connected to the altar. */
  connected: boolean;
}

/** A family walking from the city entrance to an empty plot. */
export interface Family {
  id: number;
  houseId: number;
  /** Road cells followed by the house cell. */
  path: Cell[];
  /** Cells walked along the path. */
  step: number;
}

export type Coverage = Record<ServiceKind, boolean[]>;

export interface GameState {
  cols: number;
  rows: number;
  ground: Ground[];
  feature: (Feature | null)[];
  roads: boolean[];
  /** Cells of the road network connected to the altar (altar cell included). */
  network: boolean[];
  buildings: Building[];
  /** Building occupying each cell. */
  grid: (Building | null)[];
  coverage: Coverage;
  families: Family[];
  altar: Cell;
  entrance: Cell;
  silver: number;
  food: number;
  /** Months elapsed. */
  month: number;
  famine: boolean;
  goalIndex: number;
  unlocked: Placeable[];
  won: boolean;
  nextId: number;
}

export type GameEvent =
  | { type: 'houseUp'; x: number; y: number; level: number; delta: number }
  | { type: 'houseDown'; x: number; y: number; level: number; delta: number; famine: boolean }
  | { type: 'famineStart' }
  | { type: 'famineEnd' }
  | { type: 'goal'; index: number; reward: number; unlock?: Placeable }
  | { type: 'victory'; month: number; residents: number };

export type FailReason = 'locked' | 'invalid' | 'silver' | 'noRoad' | 'protected';
export type ActionResult = { ok: true } | { ok: false; reason: FailReason };

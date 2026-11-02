export type Ground = 'sand' | 'grass' | 'river';
export type Feature = 'rock' | 'palm' | 'olive';
export type BuildingKind = 'house' | 'field' | 'well' | 'market' | 'workshop' | 'garden' | 'temple' | 'altar';
/** Buildings the player can place (the altar is fixed). */
/** The four seasons, in order. */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type BuildableKind = Exclude<BuildingKind, 'altar'>;
/** Everything the player can place: buildings and road. */
export type Placeable = BuildableKind | 'road';
/** Area services; "sacred" is the radius of the altar or a temple. Gardens only add happiness. */
export type ServiceKind = 'well' | 'market' | 'sacred' | 'garden';
export type NeedKind = 'road' | ServiceKind;
/** What a building's balloon can point out: a missing need, a workplace with no workers or a sad house. */
export type BalloonKind = NeedKind | 'workers' | 'sad';

export const SERVICE_KINDS: readonly ServiceKind[] = ['well', 'market', 'sacred', 'garden'];

export type Rng = () => number;

export type WalkerType =
  | 'waterCarrier'
  | 'farmer'
  | 'basketWoman'
  | 'porter'
  | 'artisan'
  | 'elder'
  | 'child'
  | 'donkeyMan'
  | 'shepherd'
  | 'priest';

/**
 * A kind of resident walker. `to` lists the building kinds it heads for (any of them), or a
 * special target: "any" connected building, a "mainRoad" cell or a road near the city "edge".
 * `from` makes it start at a building of that kind instead of at home.
 */
export interface WalkerDef {
  type: WalkerType;
  to: BuildingKind[] | 'any' | 'mainRoad' | 'edge';
  from?: BuildingKind;
  /** Pace multiplier (render only). */
  speed: number;
  /** Chance of stopping a moment on arrival (render only). */
  pauseChance: number;
}

export interface Cell {
  x: number;
  y: number;
}

/** A footprint: top-left cell plus width and height. */
export interface Rect extends Cell {
  w: number;
  h: number;
}

export interface Dims {
  w: number;
  h: number;
}

/** Trade shown by a workshop variant. */
export type Craft = 'pottery' | 'smithy' | 'carpentry' | 'weaving' | 'dyeing' | 'tannery';

export interface BuildingDef {
  name: string;
  cost: number;
  jobs: number;
  /** Footprint width (x) and height (y) in cells; default 1x1, h defaults to w. */
  w?: number;
  h?: number;
  radius?: number;
  /** Silver charged every month, connected or not; default 0. */
  upkeep?: number;
  /** Number of drawn looks (variant 0..n-1); default 1. */
  variants?: number;
  /** Workshop trades, one per variant (the variant is the index of the craft). */
  crafts?: Craft[];
  food?: number;
  silver?: number;
  protected?: boolean;
}

export interface HouseLevelDef {
  name: string;
  residents: number;
  tax: number;
  /** Food eaten per resident per month. */
  food: number;
  /** Number of drawn variants for this level. */
  variants: number;
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
  /** The guaranteed first families walk this many times faster. */
  earlyFamilySpeedMultiplier: number;
  /** Upkeep is charged only once this many goals are done (the first goals are free of it). */
  upkeepStartsAfterGoal: number;
  /** Months in each season (spring, summer, autumn, winter; the game starts in spring). Looks only for now. */
  monthsPerSeason: number;
  workerShare: number;
  /** Workers without a job from which the unemployment alert shows (once the workshop is unlocked). */
  unemploymentAlert: number;
  familyChance: number;
  /** The first plots get a family for sure (tents or better plus families on the way below this). */
  guaranteedFamilies: number;
  familyCellsPerMonth: number;
  monthsToChange: number;
  famineDropChance: number;
  treeClearCost: number;
  /** Chance per month, during famine, that a tent is abandoned (back to an empty plot). */
  famineLeaveChance: number;
  /** Consecutive months with negative silver that lose the game. */
  debtMonthsToLose: number;
  roadCost: number;
  /** House happiness 0..100 (see happiness.ts): bonuses, penalties and what it changes. */
  happiness: {
    base: number;
    sacred: number;
    garden: number;
    well: number;
    market: number;
    famine: number;
    /** Penalty = share of workers without a job x idleScale, at most idleMax. */
    idleScale: number;
    idleMax: number;
    /** From this value up a house is happy; below `sad` it is sad. */
    happy: number;
    sad: number;
    /** Tax multiplier at happiness 0 and 100 (1 at 50). */
    taxMin: number;
    taxMax: number;
    /** Family arrival chance multiplier at city happiness 0 and 100 (1 at 50). */
    familyMin: number;
    familyMax: number;
  };
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
  /** Footprint in cells (x by y). */
  w: number;
  h: number;
  /** House level (0..4). Unused by other kinds. */
  level: number;
  /** Consecutive months meeting the next level's needs. */
  upStreak: number;
  /** Consecutive months missing a need of the current level. */
  downStreak: number;
  /** Touches the road network connected to the altar. */
  connected: boolean;
  /** Drawn variant: house look for its level, field crop or workshop craft (0 for single-look kinds). */
  variant: number;
  /** Drawn mirrored. */
  mirrored: boolean;
}

/** A family walking from the city entrance to an empty plot. */
export interface Family {
  id: number;
  houseId: number;
  /** Road cells followed by the house cell. */
  path: Cell[];
  /** Cells walked along the path. */
  step: number;
  /** One of the guaranteed first families: walks faster so the start has no dead time. */
  fast?: boolean;
}

export type Coverage = Record<ServiceKind, boolean[]>;

export interface GameState {
  cols: number;
  rows: number;
  ground: Ground[];
  feature: (Feature | null)[];
  roads: boolean[];
  /** Cells of the road network connected to the altar (altar cells included). */
  network: boolean[];
  buildings: Building[];
  /** Building occupying each cell. */
  grid: (Building | null)[];
  coverage: Coverage;
  families: Family[];
  /** Top-left cell of the altar footprint. */
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
  /** Consecutive months ended with negative silver (0 when out of debt). */
  debtMonths: number;
  /** Most residents the city ever had (shown on the defeat screen). */
  peakPopulation: number;
  lost: boolean;
  nextId: number;
}

export type GameEvent =
  | { type: 'houseUp'; x: number; y: number; level: number; delta: number }
  | { type: 'houseDown'; x: number; y: number; level: number; delta: number; famine: boolean }
  | { type: 'famineStart' }
  | { type: 'famineEnd' }
  | { type: 'goal'; index: number; reward: number; unlock?: Placeable }
  | { type: 'victory'; month: number; residents: number }
  /** A family abandoned its tent during famine and walks out of the city from (x, y). */
  | { type: 'familyLeft'; x: number; y: number }
  /** Upkeep starts being charged (once, right after goal `upkeepStartsAfterGoal`). */
  | { type: 'upkeepStart' }
  /** A new season began (looks only for now). */
  | { type: 'season'; season: Season }
  | { type: 'debtStart' }
  | { type: 'debtEnd' }
  | { type: 'defeat'; month: number; peak: number };

export type FailReason = 'locked' | 'invalid' | 'silver' | 'debt' | 'noRoad' | 'protected';
export type ActionResult = { ok: true } | { ok: false; reason: FailReason };

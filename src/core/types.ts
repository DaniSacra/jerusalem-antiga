export type Ground = 'sand' | 'grass' | 'river';
export type Feature = 'rock' | 'palm' | 'olive';
export type BuildingKind = 'house' | 'field' | 'well' | 'fisher' | 'gatherer' | 'granary' | 'market' | 'workshop' | 'garden' | 'temple' | 'altar';
/** Buildings the player can place (the altar is fixed). */
/** The four seasons, in order. */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type BuildableKind = Exclude<BuildingKind, 'altar'>;
/** Groups of the build menu (see menu.ts): housing, water and food, work, special. */
export type BuildingCategory = 'home' | 'supply' | 'work' | 'special';
/** Everything the player can place: buildings and road. */
export type Placeable = BuildableKind | 'road';
/** Area services; "sacred" is the radius of the altar or a temple. Gardens only add happiness. */
export type ServiceKind = 'well' | 'market' | 'sacred' | 'garden';
export type NeedKind = 'road' | ServiceKind;
/** What a building's balloon can point out: a missing need, a workplace with no workers or a sad house. */
export type BalloonKind = NeedKind | 'workers' | 'sad' | 'noSource';

export const SERVICE_KINDS: readonly ServiceKind[] = ['well', 'market', 'sacred', 'garden'];

export type Rng = () => number;

/** Moments celebrated once per game. */
export type MilestoneId = 'firstFamily' | 'firstMud' | 'firstHarvest' | 'firstWinter' | 'firstStone' | 'yearWithoutFamine';

/** One week of the city, for the statistics charts. */
export interface WeekRecord {
  silver: number;
  food: number;
  residents: number;
  happiness: number;
  /** Food the city could keep that week. */
  capacity: number;
}

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
  /** Build menu group; only buildings the player can place have one. */
  category?: BuildingCategory;
  cost: number;
  jobs: number;
  /** Footprint width (x) and height (y) in cells; default 1x1, h defaults to w. */
  w?: number;
  h?: number;
  radius?: number;
  /** Silver charged every week, connected or not; default 0. */
  upkeep?: number;
  /** Number of drawn looks (variant 0..n-1); default 1. */
  variants?: number;
  /** Workshop trades, one per variant (the variant is the index of the craft). */
  crafts?: Craft[];
  /** Food a field makes in a year, all of it delivered over the spring weeks (see harvest.ts). */
  harvest?: number;
  /** Food gathered every week from the river or trees in a radius: min(max, cells × perCell). */
  gather?: { source: 'river' | 'tree'; radius: number; perCell: number; max: number };
  /** Food this building lets the city keep (granary). */
  storage?: number;
  /** Silver made per week at full efficiency (no building makes silver for now; kept for later). */
  silver?: number;
  /** Workshop: each connected one adds this share to the fields' food, up to `fieldBonusMax` in all. */
  fieldBonus?: number;
  fieldBonusMax?: number;
  protected?: boolean;
}

export interface HouseLevelDef {
  name: string;
  residents: number;
  tax: number;
  /** Food eaten per resident per week. */
  food: number;
  /** Number of drawn variants for this level. */
  variants: number;
  needs: NeedKind[];
}

export interface GoalDef {
  /**
   * residents: at least `target` residents; houses: houses of at least `level`; build: connected
   * buildings of `kind`; foodUntilSpring: weeks the food lasts, up to the first spring (see
   * goalTarget); water: houses (plots too) with a well, out of max(target, all houses).
   */
  type: 'residents' | 'houses' | 'build' | 'foodUntilSpring' | 'water';
  target: number;
  /** Minimum house level, for type "houses". */
  level?: number;
  /** Building kind, for type "build". */
  kind?: BuildingKind;
  reward: number;
  unlock?: Placeable;
  victory?: boolean;
  /** The goal can only be reached from this year on (1 = the first year). */
  fromYear?: number;
  text: string;
}

export interface Rules {
  startSilver: number;
  startUnlocked: Placeable[];
  weekSeconds: number;
  /** Upkeep is charged only once this many goals are done (the first goals are free of it). */
  upkeepStartsAfterGoal: number;
  /** Weeks in each season (spring, summer, autumn, winter; the game starts in spring). Looks only for now. */
  weeksPerSeason: number;
  /** Season of the first week. */
  startSeason: Season;
  /** Up to this many buildings the build column lists them all; above it, it shows the categories. */
  toolColumnMax: number;
  /** Food the city keeps without a granary; the rest spoils. */
  baseFoodStorage: number;
  /** New families set out at most once every this many weeks. */
  familyIntervalWeeks: number;
  /** A new family comes only if the forecast food never drops below this many weeks of eating. */
  familyFoodReserveWeeks: number;
  /** In winter every resident eats `foodFactor` times more; tent dwellers `tentFoodFactor` instead. */
  winter: { foodFactor: number; tentFoodFactor: number };
  /** Chance per week, in winter during famine, that a tent is abandoned (instead of famineLeaveChance). */
  winterFamineLeaveChance: number;
  /** Last weeks of autumn that show the winter warning. */
  winterWarningWeeks: number;
  /** Weeks of history kept for the statistics. */
  historyWeeks: number;
  /** Dry years: chance rolled each winter, harvest factor of fields away from the river, first years that are never dry, never two in a row. */
  drought: { chance: number; harvestFactor: number; safeYears: number; neverTwice: boolean };
  /** The founding caravan: [min, max] families and weeks of food. */
  caravan: { families: [number, number]; foodWeeks: [number, number] };
  workerShare: number;
  /** Workers without a job from which the unemployment alert shows (once the workshop is unlocked). */
  unemploymentAlert: number;
  familyChance: number;
  familyCellsPerWeek: number;
  /** Weeks in a row with the next level's needs met before a house climbs one level. */
  weeksToUpgrade: number;
  /** Weeks in a row missing its own needs before a house drops one level. */
  weeksToDowngrade: number;
  famineDropChance: number;
  treeClearCost: number;
  /** Chance per week, during famine, that a tent is abandoned (back to an empty plot). */
  famineLeaveChance: number;
  /** Consecutive weeks with negative silver that lose the game. */
  debtWeeksToLose: number;
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
    /** Counts drawn by the seed, [min, max]. */
    rocks: [number, number];
    olives: [number, number];
    palms: [number, number];
    grassShare: number;
    /** River width, and the distance (cells, Chebyshev) from the altar's border to its nearest cell. */
    river: { minWidth: number; maxWidth: number; distance: [number, number] };
    /** At least `min` groves of `trees`+ trees in a square of `radius` around a center `distance` cells from the altar's border. */
    denseGrove: { min: number; trees: number; radius: number; distance: [number, number] };
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
  /** Consecutive weeks meeting the next level's needs. */
  upStreak: number;
  /** Consecutive weeks missing a need of the current level. */
  downStreak: number;
  /** Touches the road network connected to the altar. */
  connected: boolean;
  /** Drawn variant: house look for its level, field crop or workshop craft (0 for single-look kinds). */
  variant: number;
  /** Drawn mirrored. */
  mirrored: boolean;
  /** Week it was built (a field only harvests in a spring after an autumn it stood through). */
  built: number;
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
  /** Weeks elapsed. */
  week: number;
  famine: boolean;
  goalIndex: number;
  unlocked: Placeable[];
  won: boolean;
  /** Consecutive weeks ended with negative silver (0 when out of debt). */
  debtWeeks: number;
  /** Most residents the city ever had (shown on the defeat screen). */
  peakPopulation: number;
  lost: boolean;
  /** This year's spring harvest is cut by a dry year (rolled at the start of winter). */
  drought: boolean;
  /** Last year was dry (with `neverTwice`, this one cannot be). */
  lastDrought: boolean;
  /** A house was abandoned or dropped by famine during this winter. */
  winterLoss: boolean;
  /** Week the last new family set out (families come at most every `familyIntervalWeeks`). */
  lastFamilyWeek: number;
  /** Food spoiled this week because the stores were full (0 when nothing spoiled). */
  spoiled: number;
  /** Food harvested so far in the whole game. */
  harvested: number;
  /** A week of famine happened since the last autumn began. */
  famineThisYear: boolean;
  /** Milestones already reached, in order. */
  milestones: MilestoneId[];
  /** Week each milestone was reached. */
  milestoneWeeks: Partial<Record<MilestoneId, number>>;
  /** Weekly snapshots, oldest first, at most `historyWeeks`. */
  history: WeekRecord[];
  /** The caravan that founded the city (shown in the opening sentence). */
  start: { families: number; foodWeeks: number };
  nextId: number;
}

export type GameEvent =
  | { type: 'houseUp'; x: number; y: number; level: number; delta: number }
  | { type: 'houseDown'; x: number; y: number; level: number; delta: number; famine: boolean }
  | { type: 'famineStart' }
  | { type: 'famineEnd' }
  | { type: 'goal'; index: number; reward: number; unlock?: Placeable }
  | { type: 'victory'; week: number; residents: number }
  /** A family abandoned its tent during famine and walks out of the city from (x, y). */
  | { type: 'familyLeft'; x: number; y: number }
  /** Upkeep starts being charged (once, right after goal `upkeepStartsAfterGoal`). */
  | { type: 'upkeepStart' }
  /** A new season began (looks only for now). */
  | { type: 'season'; season: Season }
  | { type: 'debtStart' }
  | { type: 'debtEnd' }
  | { type: 'defeat'; week: number; peak: number }
  /** Food spoiled because the stores were full (once per stretch of spoiling weeks). */
  | { type: 'spoilStart' }
  /** The first week of a spring harvest (food came in from the fields). */
  | { type: 'harvestStart'; amount: number }
  /** Winter began and the coming spring will be dry. */
  | { type: 'drought' }
  | { type: 'milestone'; id: MilestoneId };

export type FailReason = 'locked' | 'invalid' | 'silver' | 'debt' | 'noRoad' | 'protected';
export type ActionResult = { ok: true } | { ok: false; reason: FailReason };

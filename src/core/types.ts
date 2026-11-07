export type Ground = 'sand' | 'grass' | 'river';
/** A stump is a cut tree (see trees.ts): it does not block building and grows back. */
export type Feature = 'rock' | 'palm' | 'olive' | 'stump';
/** The trees on the map (a stump remembers which one it was). */
export type TreeFeature = 'olive' | 'palm';
/** Building materials kept by the city, like silver. */
export type Material = 'wood' | 'stone' | 'livestock';
export const MATERIALS: readonly Material[] = ['wood', 'stone', 'livestock'];
/** Materials a building or a house level costs (missing = none). */
export type Materials = Partial<Record<Material, number>>;
/** What a gathering building brings every week. */
export type Product = 'food' | Material;
export type BuildingKind = 'house' | 'field' | 'plaza' | 'fisher' | 'gatherer' | 'lumber' | 'quarry' | 'pasture' | 'granary' | 'market' | 'workshop' | 'park' | 'temple' | 'altar';
/** Buildings the player can place (the altar is fixed). */
/** The four seasons, in order. */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type BuildableKind = Exclude<BuildingKind, 'altar'>;
/** Groups of the build menu (see menu.ts): housing, food, work, special. */
export type BuildingCategory = 'home' | 'supply' | 'work' | 'special';
/** Everything the player can place: buildings and road. */
export type Placeable = BuildableKind | 'road';
/** Area services; "sacred" is the radius of the altar or a temple (happiness only). */
export type ServiceKind = 'plaza' | 'market' | 'sacred' | 'park';
/** What a house level asks for: a road and the services around it (the altar is not one). */
export type NeedKind = 'road' | Exclude<ServiceKind, 'sacred'>;
/** What a building's balloon can point out: a missing need, a workplace with no workers or a sad house. */
export type BalloonKind = NeedKind | 'workers' | 'sad' | 'noSource';

export const SERVICE_KINDS: readonly ServiceKind[] = ['plaza', 'market', 'sacred', 'park'];

export type Rng = () => number;

/** Cells a gathering building takes from: river water, trees (olive or palm) or rocks. */
export type GatherSource = 'river' | 'tree' | 'rock' | 'grass';

/** Moments celebrated once per game. */
export type MilestoneId =
  | 'firstWedding'
  | 'firstBirth'
  | 'firstCaravan'
  | 'firstGrownUp'
  | 'thirdGeneration'
  | 'firstMud'
  | 'firstHarvest'
  | 'firstWinter'
  /** The first spring with someone living in the city (even after losses). */
  | 'firstSpring'
  | 'firstStone'
  | 'yearWithoutFamine';

export type Sex = 'm' | 'f';
export type AgeBand = 'child' | 'adult' | 'elder';
/**
 * Why a person left the city: died of age or of cold (`coldDeath`, B3), left with the family
 * (famine, `cold`: no firewood, no road, demolished house) or found no house.
 */
export type EndCause = 'age' | 'coldDeath' | 'famine' | 'cold' | 'road' | 'demolished' | 'noHouse';

/**
 * A person of the city. Children are not stored (see `childrenOf`); a family is everyone with the
 * same `houseId`. An adult keeps a job (`jobId`, see work.ts) until the game or the player moves it.
 */
export interface Person {
  /** From the same counter as buildings (`nextId`). */
  id: number;
  /** Given name (names.json). */
  name: string;
  sex: Sex;
  /** Index in names.json > clans: the family name, from the father. */
  clan: number;
  /** May be negative (born before the game). */
  birthWeek: number;
  /** null: on the way with a caravan (neither counts nor eats). */
  houseId: number | null;
  fatherId: number | null;
  motherId: number | null;
  /** Betrothed or spouse (alive or not); null: never married. */
  spouseId: number | null;
  /** Week of the engagement; null once married (or never engaged). */
  engaged: number | null;
  /** 0 = the founding caravan, 1.. = later caravans, null = born in the city. */
  caravan: number | null;
  /** Only in `departed`: when and why the person left. */
  end?: { week: number; cause: EndCause };
  /** The workplace (building id) the adult works at; missing or null: no job. */
  jobId?: number | null;
}

/** A later caravan, rolled when the game is created (see `rollCaravans`). */
export interface CaravanPlan {
  /** Week it arrives. */
  week: number;
  families: number;
  /** How many of the families are surely a young engaged pair (`caravans.later[k].engaged`; 0 when missing). */
  engaged?: number;
  /** Weeks before arriving that it is announced. */
  warn: number;
  status: 'planned' | 'announced' | 'arrived' | 'skipped';
  /** Families that found a house, and families that went on (no house). */
  housed: number;
  left: number;
}

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
  | 'priest'
  | 'woodcutter'
  | 'mason';

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
  /** Silver charged every week, connected or not, from the week it is built; default 0. */
  upkeep?: number;
  /**
   * Levels after the first (the definition itself is level 1): the silver to climb to it and what
   * changes there (see `statOf`).
   */
  levels?: BuildingLevelDef[];
  /** Number of drawn looks (variant 0..n-1); default 1. */
  variants?: number;
  /** Workshop trades, one per variant (the variant is the index of the craft). */
  crafts?: Craft[];
  /** Food a field makes in a year, all of it delivered over the spring weeks (see harvest.ts). */
  harvest?: number;
  /**
   * Gathered every week from the river, trees or rocks in a radius: min(max, cells × perCell) of
   * `product` (food when missing); in winter only `winterFactor` of it (all of it when missing).
   */
  gather?: { source: GatherSource; radius: number; perCell: number; max: number; product?: Product; winterFactor?: number };
  /** Lumber: cuts the nearest tree in its radius every this much wood made (see trees.ts). */
  cutEvery?: number;
  /** Materials paid on top of the silver cost when built. */
  materials?: Materials;
  /** Food this building lets the city keep (granary). */
  storage?: number;
  /** Workshop: each connected one adds this share to the fields' food, up to `fieldBonusMax` in all. */
  fieldBonus?: number;
  fieldBonusMax?: number;
  protected?: boolean;
}

/** What a service building's next level costs and changes. */
export interface BuildingLevelDef {
  cost: number;
  /** Wood and stone paid on top of the silver to reach this level. */
  materials?: Materials;
  upkeep?: number;
  storage?: number;
  radius?: number;
  fieldBonus?: number;
}

/** Stats of a building that change with its level (see `statOf`). */
export type LevelStat = 'upkeep' | 'storage' | 'radius' | 'fieldBonus' | 'jobs';

export interface HouseLevelDef {
  name: string;
  /** Most people living in a house of this level (births stop when it is full). */
  capacity: number;
  /** Silver a week per house with people (scaled by happiness). */
  tax: number;
  /** Number of drawn variants for this level. */
  variants: number;
  needs: NeedKind[];
  /** Materials paid when a house climbs to this level (see houses in simulation.ts). */
  materials?: Materials;
  /** Wood a house of this level burns in a winter week (see firewood.ts). */
  firewood?: number;
}

export interface GoalDef {
  /**
   * residents: at least `target` residents; houses: houses of at least `level`; build: connected
   * buildings of `kind`; foodUntilSpring: weeks the food lasts, up to the first spring (see
   * goalTarget); milestone: the `milestone` was reached (even before the goal came up);
   * templeStage: the Temple's stage `stage` (1-based, `temple.json`) is built.
   */
  type: 'residents' | 'houses' | 'build' | 'foodUntilSpring' | 'milestone' | 'templeStage';
  /** For type "templeStage": the stage, from 1. */
  stage?: number;
  /** For type "milestone". */
  milestone?: MilestoneId;
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

/** A stage of the Temple (`temple.json`): where it is built, what it costs, its builders' jobs and its work in builder-weeks. */
export interface TempleStageDef {
  name: string;
  site: 'altar' | 'temple';
  cost: number;
  materials: Materials;
  builders: number;
  work: number;
  /** Once built: the altar's sacred radius (from its edge) and the livestock it burns a week. */
  sacredRadius: number;
  offering: number;
}

export interface Rules {
  startSilver: number;
  startUnlocked: Placeable[];
  /** Materials the founding caravan brings. */
  startMaterials: Record<Material, number>;
  /** Weeks a free stump takes to grow back into its tree. */
  treeRegrowWeeks: number;
  /** "Onde pôr um lenhador": spots bringing at least this share of the best one are shown. */
  goodGatherShare: number;
  /** Most wood and most stone the city stores; a lumber or quarry stops at it. */
  materialStorage: number;
  /** Most livestock the city keeps (the pastures stop at it). */
  livestockStorage: number;
  weekSeconds: number;
  /** Weeks in each season (spring, summer, autumn, winter; the game starts in spring). Looks only for now. */
  weeksPerSeason: number;
  /** Season of the first week. */
  startSeason: Season;
  /** Up to this many buildings the build column lists them all; above it, it shows the categories. */
  toolColumnMax: number;
  /** Food the city keeps without a granary; the rest spoils. */
  baseFoodStorage: number;
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
  /** People: ages, eating, deaths, marriages and births (see people.ts). */
  people: PeopleRules;
  /** The founding caravan and the later ones (see caravans.ts). */
  caravans: {
    start: { families: [number, number]; foodWeeks: [number, number] };
    /** `engaged`: how many of the families are surely a young engaged pair (the others are drawn). */
    later: { weeks: [number, number]; families: [number, number]; chance: number; engaged?: number }[];
    warnWeeks: [number, number];
    /** Weeks of the newcomers' eating a later caravan brings. */
    foodWeeks: [number, number];
  };
  /** Adults without a job from which the unemployment alert shows. */
  unemploymentAlert: number;
  /** Order in which free adults fill the free jobs each week (food first); kinds left out come last. */
  jobPriority: BuildingKind[];
  /** Services that cover nothing while nobody works there. */
  staffedServices: BuildingKind[];
  familyCellsPerWeek: number;
  /** Weeks in a row with the next level's needs met before a house climbs one level: drawn per house in [min, max]. */
  weeksToUpgrade: [number, number];
  /** Weeks in a row missing its own needs before a house drops one level. */
  weeksToDowngrade: number;
  famineDropChance: number;
  treeClearCost: number;
  /** The temple's areas also show where it fits this many free cells away from the network (a road there links it). */
  templeSpotRoadGap: number;
  /** Chance per week, during famine, that a tent is abandoned (back to an empty plot). */
  famineLeaveChance: number;
  /** A workplace with nobody working there pays this share of its upkeep (see `upkeepPaid`). */
  emptyUpkeepFactor: number;
  /**
   * Cold deaths in winter (Package B3), per resident and week; pairs are [vulnerable, others]
   * (vulnerable: up to `childAge` years old, or an elder). `tent`: a tent with firewood;
   * `tentCold`, `houseCold`: a tent or a better house without firewood. Famine multiplies by `famineFactor`.
   */
  coldDeath: { childAge: number; tent: [number, number]; tentCold: [number, number]; houseCold: [number, number]; famineFactor: number };
  /** Consecutive weeks with negative silver that lose the game. */
  debtWeeksToLose: number;
  /** No defeat by debt while a later caravan (planned or announced) is due within these weeks. */
  debtCaravanWeeks: number;
  roadCost: number;
  /** House happiness 0..100 (see happiness.ts): bonuses, penalties and what it changes. */
  happiness: {
    base: number;
    sacred: number;
    park: number;
    plaza: number;
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
    /** Birth chance multiplier at city happiness 0 and 100 (1 at 50). */
    birthMin: number;
    birthMax: number;
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
    /** `trees` (or `rocks`) is the least a group has; `extra` more are drawn in that range. */
    denseGrove: { min: number; trees: number; extra: [number, number]; radius: number; distance: [number, number] };
    /** At least `min` outcrops of `rocks`+ rocks (taken from `rocks`) in a square of `radius` around a center `distance` cells from the altar's border. */
    rockOutcrop: { min: number; rocks: number; extra: [number, number]; radius: number; distance: [number, number] };
  };
}

/** A member of a caravan family template: father, mother, their child, or a grandparent (the father's parent). */
export interface TemplateMember {
  role: 'father' | 'mother' | 'child' | 'grandparent';
  age: [number, number];
}

export interface PeopleRules {
  /** Weeks of the game per year of life (13: one season is one year). */
  weeksPerLifeYear: number;
  /** Ages where adults (who work) and elders begin. */
  adultAge: number;
  elderAge: number;
  /** Food eaten per week by each age band (times the winter factor of the house). */
  food: Record<AgeBand, number>;
  /** [age, chance]: chance of dying at each birthday from that age on (the last row that applies). */
  death: [number, number][];
  /** Ages a never-married adult can get engaged. */
  marriageAges: [number, number];
  /** Chance per week that a man who can get engaged does, when a woman can. */
  marriageChance: number;
  maxAgeGap: number;
  /** An engaged couple without a house leaves after these weeks, warned in the last `coupleWarnWeeks`. */
  coupleWaitWeeks: number;
  coupleWarnWeeks: number;
  /** Ages a mother can have a child. */
  fertileAges: [number, number];
  /** Weeks between two children of the same mother. */
  birthGapWeeks: number;
  /** Chance per week of a child for a couple that can have one (times the happiness factor). */
  birthChance: number;
  /** Children are born only if the forecast food stays above this many weeks of eating until the harvest (negative: they are born even if the food runs out up to that many weeks before it). */
  birthFoodReserveWeeks: number;
  /**
   * Families of the caravans, drawn by weight. `engaged`: a young pair (father and mother roles)
   * of two family names, engaged, who marry on taking a house; never in the founding caravan.
   */
  templates: { weight: number; members: TemplateMember[]; engaged?: boolean }[];
  /** The founding caravan's first two families use this template, with a child of these ages: the engaged couple. */
  couple: { template: number; age: [number, number] };
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
  /** House level (0..4, 0 = empty); level of a service building (1..); 1 for the rest. */
  level: number;
  /** Houses: weeks with the next level's needs met it takes to climb (drawn at every level). */
  upWeeks: number;
  /** Houses: the level kept while it stands empty (a tent leaves none); 0 for the rest. */
  emptyLevel: number;
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
  /** Altar or Temple while a stage of the Temple is being built there: the builders' jobs (see temple.ts). */
  builders?: number;
  /** Lumber: wood made since its last cut tree (see trees.ts). */
  cutProgress?: number;
  /** House: ready to climb (13/13 weeks with the needs) but the city lacks this material. */
  waiting?: Material;
  /** House: the wood is there, but in autumn and winter it keeps the firewood (it climbs in spring). */
  firewoodHold?: boolean;
}

/** A cut tree on cell `i`, cut in `week`; it grows back into `kind` after `treeRegrowWeeks`. */
export interface Stump {
  i: number;
  kind: TreeFeature;
  week: number;
}

/** People walking along the roads to a house: a caravan family, a married couple or an elder moving in with a child. */
export interface Family {
  id: number;
  /** House they walk to. */
  houseId: number;
  /** Ids of the people walking. */
  members: number[];
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
  /** Building materials in store (no limit). */
  wood: number;
  stone: number;
  /** Livestock in the pens (pastures make it; the restored altar burns it). */
  livestock: number;
  /** Cut trees waiting to grow back (their cells hold the 'stump' feature). */
  stumps: Stump[];
  /** Weeks elapsed. */
  week: number;
  famine: boolean;
  /** Winter without firewood: houses suffer as in a famine (see firewood.ts). */
  cold: boolean;
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
  /** Food spoiled this week because the stores were full (0 when nothing spoiled). */
  spoiled: number;
  /** A week of famine happened since the last autumn began. */
  famineThisYear: boolean;
  /** Milestones already reached, in order. */
  milestones: MilestoneId[];
  /** Week each milestone was reached. */
  milestoneWeeks: Partial<Record<MilestoneId, number>>;
  /** Weekly snapshots, oldest first, at most `historyWeeks`. */
  history: WeekRecord[];
  /** The caravan that founded the city (shown in the opening sentence) and its engaged couple (man, woman). */
  start: { families: number; foodWeeks: number; couple: [number, number] };
  /** People alive: in the city or on the way. */
  people: Person[];
  /** People who died or left, with `end`. */
  departed: Person[];
  /**
   * Workers the player wants per profession (workplace kind): a missing kind is automatic (every
   * job filled, the game before the Profissões panel); a number caps the crew of that kind.
   */
  jobTargets: Partial<Record<BuildingKind, number>>;
  /** The Temple in stages (temple.ts): stages built, the current one paid and under way, and its work done. */
  temple: { done: number; active: boolean; progress: number };
  /** The restored altar had its offering this week (it covers its sacred radius); false before it is restored. */
  offered: boolean;
  /** Later caravans, rolled at the start. */
  caravans: CaravanPlan[];
  /** Births, deaths (of age and of cold; `coldDeaths` of cold only) and weddings since the last autumn began. */
  yearStats: { births: number; deaths: number; coldDeaths: number; weddings: number };
  nextId: number;
}

export type GameEvent =
  /** A stage of the Temple was paid and its work begins (`stage` from 1). */
  | { type: 'stageStart'; stage: number }
  /** The restored altar had no livestock for its offering: it covers nothing until it has (once per episode). */
  | { type: 'offeringsMissing'; x: number; y: number }
  /** The offerings are back after a week without. */
  | { type: 'offeringsBack' }
  /** A stage of the Temple is built (`stage` from 1). */
  | { type: 'stageDone'; stage: number; x: number; y: number }
  /** A `staffedServices` building (the market) lost its last worker: it covers nothing now. */
  | { type: 'serviceEmpty'; kind: BuildingKind; x: number; y: number }
  | { type: 'houseUp'; x: number; y: number; level: number; delta: number }
  | { type: 'houseDown'; x: number; y: number; level: number; delta: number; famine: boolean }
  | { type: 'famineStart' }
  | { type: 'famineEnd' }
  | { type: 'coldStart' }
  | { type: 'coldEnd' }
  | { type: 'goal'; index: number; reward: number; unlock?: Placeable }
  | { type: 'victory'; week: number; residents: number }
  /** A family abandoned its tent (during famine, or because it lost its road) and walks out of the city from (x, y); `name` is its family name. */
  | { type: 'familyLeft'; x: number; y: number; reason: LeaveReason; name: string }
  /** An engaged couple (man a, woman b) moved into their own house at (x, y). */
  | { type: 'wedding'; a: number; b: number; x: number; y: number }
  | { type: 'birth'; id: number; x: number; y: number }
  | { type: 'death'; id: number; age: number; x: number; y: number }
  /** Someone died of cold this winter week. */
  | { type: 'coldDeath'; id: number; age: number; x: number; y: number }
  /** The first week of spring: the cold killed `n` people this winter (only when n > 0). */
  | { type: 'winterToll'; n: number }
  /** An engaged couple gave up waiting for a house and left the city. */
  | { type: 'coupleLeft'; a: number; b: number }
  /** A later caravan will arrive at `week`. */
  | { type: 'caravanAnnounced'; families: number; week: number }
  /** A later caravan came to the entrance (x, y): families that found a house and families that went on. */
  | { type: 'caravanArrived'; housed: number; left: number; x: number; y: number }
  /** A service building climbed a level. */
  | { type: 'buildingUp'; x: number; y: number; level: number }
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
  | { type: 'milestone'; id: MilestoneId }
  /** A lumber cut the tree on (x, y): it is a stump now. */
  | { type: 'treeCut'; x: number; y: number; kind: TreeFeature }
  /** The stump on (x, y) grew back into its tree. */
  | { type: 'treeRegrown'; x: number; y: number; kind: TreeFeature };

/** Why a family left its tent: famine, or the tent lost its road (it dropped back to a plot). */
export type LeaveReason = 'famine' | 'cold' | 'road';

/** `materials`: not enough wood or stone (see `missingMaterial`). */
export type FailReason = 'locked' | 'invalid' | 'silver' | 'materials' | 'debt' | 'noRoad' | 'protected';
export type ActionResult = { ok: true } | { ok: false; reason: FailReason };

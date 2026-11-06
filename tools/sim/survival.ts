/**
 * Survival bots: four player profiles that play the rules of src/core (no interface), seeded.
 * The command line is in run.ts (`npm run sim`).
 */
import {
  BUILDINGS,
  HOUSE_LEVELS,
  RULES,
  GOALS,
  borderCells,
  byRiver,
  computeEconomy,
  costOf,
  createGame,
  createRng,
  currentGoal,
  dimsOf,
  birthBlock,
  announcedCaravan,
  freeHouse,
  newBuilding,
  nextLevelOf,
  statOf,
  upgradeBuilding,
  waitingCouples,
  foodCapacity,
  foodForecast,
  gatherYield,
  fieldBonus,
  fieldHarvest,
  goalProgress,
  goalTarget,
  indexOf,
  isFreeLand,
  needMet,
  neighbors,
  place,
  clearCell,
  seasonOf,
  stepWeek,
  templeSpots,
  templeSpotsNear,
  weeksToHarvest,
  unemployed,
  ageOf,
  bandCounts,
  household,
  roomIn,
  housesWaiting,
  materialsOf,
  missingMaterial,
  levelMaterials,
  sharedTrees,
  MATERIALS,
  type Material,
  type Building,
  type Person,
  type BuildableKind,
  type GameState,
  type Rect,
  type Rng,
} from '../../src/core';

// ------------------------------------------------------------------ profiles

export interface Profile {
  name: string;
  actions: number;
  idleChance: number;
  /** Weeks a visible problem must last before the bot reacts. */
  delay: number;
  /** Uses foodForecast to plan (knows the rules); otherwise only reacts to on-screen signals. */
  planner: boolean;
  /** Plans fields ahead (sows them out of winter, when they give food at once). */
  knowsAutumn: boolean;
  /** Reacts to food only in famine (forgets the forecast and the no-births message). */
  foodOnlyInFamine: boolean;
  /** Reacts to a stalled house only after seeing its balloon for `delay` weeks. */
  reactsToBalloons: boolean;
  /** From the goal that unlocks the temple on, keeps a 6x6 free for it and saves silver for it. */
  reservesTemple: boolean;
  /** Reads the "Junte 800 para o Templo" line: from the unlock until the temple stands, keeps its price
   * (only food, the granary and houses may use it) and waits for it on the last goal. Off by default;
   * `--profile savesTemple=true` turns it on. */
  savesTemple?: boolean;
  /** Weights for choosing a food building when not planning [fisher, gatherer, field]. */
  foodMix: [number, number, number];
  /** Keeps jobs <= workers (does not build workplaces without people). */
  staffAware: boolean;
  /** Empty houses kept ready beyond the waiting couples and the announced caravan. */
  plotsAhead: number;
  housesPerAction: number;
  /** Builds the granary as soon as it is unlocked (else only when spoiling or the goal asks). */
  granaryEarly: boolean;
  /** Places houses only inside plaza coverage. */
  planPlazas: boolean;
  noise: number;
  /** Max road cells the bot is willing to lay to reach a food spot. */
  roadReach: number;
  /** Multiplies `delay` for the "couple waiting" and "caravan" warnings (the distracted player looks late). */
  houseDelayFactor: number;
  /** Chance of never preparing houses for an announced caravan (drawn once per caravan). */
  caravanSkip: number;
  /** Weeks a material shortage must last before the bot builds another lumber or quarry (planners use production instead). */
  materialWait: number;
  /** Keeps wood (and stone) for the houses about to climb and for new houses before spending it on other buildings. */
  materialReserve: boolean;
  /** Plays the tutorial's build steps in week 0 (the clock stands still on them, see tutorial.json): food, field, lumber, house. `--profile tutorial=true`. */
  tutorial?: boolean;
}

export const PROFILES: Record<string, Profile> = {
  eficiente: { name: 'eficiente', actions: 2, idleChance: 0, delay: 0, planner: true, knowsAutumn: true, foodOnlyInFamine: false, reactsToBalloons: false, reservesTemple: true, foodMix: [1, 1, 1], staffAware: true, plotsAhead: 1, housesPerAction: 2, granaryEarly: true, planPlazas: true, noise: 0.2, roadReach: 30, houseDelayFactor: 1, caravanSkip: 0, materialWait: 4, materialReserve: true },
  /** Expert that sows no fields; feeds the city with fishers and gatherers. */
  pescador: { name: 'pescador', actions: 2, idleChance: 0, delay: 0, planner: true, knowsAutumn: true, foodOnlyInFamine: false, reactsToBalloons: false, reservesTemple: false, foodMix: [1, 1, 0], staffAware: true, plotsAhead: 1, housesPerAction: 2, granaryEarly: false, planPlazas: true, noise: 0.2, roadReach: 30, houseDelayFactor: 1, caravanSkip: 0, materialWait: 4, materialReserve: true },
  comum: { name: 'comum', actions: 2, idleChance: 0.1, delay: 3, planner: false, knowsAutumn: false, foodOnlyInFamine: false, reactsToBalloons: false, reservesTemple: false, foodMix: [0.4, 0.3, 0.3], staffAware: false, plotsAhead: 0, housesPerAction: 3, granaryEarly: false, planPlazas: false, noise: 1.5, roadReach: 14, houseDelayFactor: 1, caravanSkip: 0, materialWait: 13, materialReserve: true },
  distraido: { name: 'distraido', actions: 2, idleChance: 0.3, delay: 2, planner: false, knowsAutumn: false, foodOnlyInFamine: true, reactsToBalloons: true, reservesTemple: false, foodMix: [0.2, 0.2, 0.6], staffAware: false, plotsAhead: 0, housesPerAction: 4, granaryEarly: false, planPlazas: false, noise: 4, roadReach: 10, houseDelayFactor: 2, caravanSkip: 0.5, materialWait: 26, materialReserve: false },
};

// ------------------------------------------------------------------ geometry

const passable = (s: GameState, x: number, y: number) => {
  const i = indexOf(s, x, y);
  return isFreeLand(s, x, y) || (!s.grid[i] && !s.roads[i] && s.ground[i] !== 'river' && (s.feature[i] === 'palm' || s.feature[i] === 'olive'));
};

/** A cell a road can go through after demolishing what is on it (any building but the protected ones). */
const diggable = (s: GameState, x: number, y: number) => {
  const b = s.grid[indexOf(s, x, y)];
  return !!b && !BUILDINGS[b.kind].protected;
};

/**
 * BFS road distance from the connected road network over passable cells (0 = a network road cell).
 * With `dig`, buildings count as passable too: the bot demolishes them to open the way (a boxed-in city).
 */
function roadDist(s: GameState, dig = false): { dist: Int32Array; prev: Int32Array } {
  const n = s.cols * s.rows;
  const dist = new Int32Array(n).fill(-1);
  const prev = new Int32Array(n).fill(-1);
  const q: number[] = [];
  for (let i = 0; i < n; i++) if (s.network[i] && s.roads[i]) { dist[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    for (const c of neighbors(s, i % s.cols, Math.floor(i / s.cols))) {
      const j = indexOf(s, c.x, c.y);
      if (dist[j] >= 0 || !(passable(s, c.x, c.y) || (dig && diggable(s, c.x, c.y)))) continue;
      dist[j] = dist[i] + 1;
      prev[j] = i;
      q.push(j);
    }
  }
  return { dist, prev };
}

const freeRect = (s: GameState, r: Rect) => {
  for (let dy = 0; dy < r.h; dy++) for (let dx = 0; dx < r.w; dx++) if (!isFreeLand(s, r.x + dx, r.y + dy)) return false;
  return true;
};

/** Road cells needed for a rect to touch the network (0 if it already does), and the best border cell. */
function rectReach(s: GameState, r: Rect, rd: ReturnType<typeof roadDist>): { d: number; cell: number } {
  let best = { d: Infinity, cell: -1 };
  for (const c of borderCells(s, r)) {
    const i = indexOf(s, c.x, c.y);
    const d = s.network[i] ? 0 : rd.dist[i] >= 0 ? rd.dist[i] : Infinity;
    if (d < best.d) best = { d, cell: i };
  }
  return best;
}

const fake = (s: GameState, kind: BuildableKind, r: Rect): Building => ({ ...newBuilding(-1, kind, r, s.week), connected: true });

const altarRect = (s: GameState) => s.buildings.find((b) => b.kind === 'altar')!;
const cheb = (a: Rect, b: Rect) => Math.max(0, a.x - (b.x + b.w - 1), b.x - (a.x + a.w - 1), a.y - (b.y + b.h - 1), b.y - (a.y + a.h - 1));

// ------------------------------------------------------------------ bot

/** Road cells a bot lays to reach a plaza, market or park spot. */
const SERVICE_ROAD = 6;

interface Stats {
  actions: number;
  built: Record<string, number>;
  roadCells: number;
}

type ServiceBuilding = 'plaza' | 'market' | 'park';
/** What a family house of each level waits for to climb: the services its next level adds (from houses.json; none for a tent). */
const EVOLUTION: [number, ServiceBuilding][] = HOUSE_LEVELS.slice(1, -1).flatMap((def, k) =>
  HOUSE_LEVELS[k + 2].needs
    .filter((n) => !def.needs.includes(n))
    .map((need): [number, ServiceBuilding] => {
      if (need !== 'plaza' && need !== 'market' && need !== 'park') throw new Error(`no service the bot builds for house level ${k + 1}: ${need}`);
      return [k + 1, need];
    }),
);

/** Connected houses of a level that wait for this service to climb. */
const stalled = (s: GameState, level: number, kind: ServiceBuilding) =>
  s.buildings.filter((b) => b.kind === 'house' && b.connected && b.level === level && !needMet(s, b, kind));

/** A married couple lives together with the wife in the fertile ages. */
const fertileCouple = (s: GameState, mother: Person) => {
  if (mother.sex !== 'f' || mother.engaged !== null || mother.houseId === null) return false;
  const age = ageOf(mother, s.week);
  if (age < RULES.people.fertileAges[0] || age > RULES.people.fertileAges[1]) return false;
  return s.people.some((p) => p.id === mother.spouseId && p.houseId === mother.houseId);
};
/** A full house with a fertile couple: only a higher level lets a child be born there. */
const fertileFull = (s: GameState, h: Building) => roomIn(s, h) <= 0 && household(s, h.id).some((p) => fertileCouple(s, p));

/** The goal that unlocks the temple (the Eficiente reserves its ground and silver from then on). */
const TEMPLE_UNLOCK = GOALS.findIndex((g) => g.unlock === 'temple');
/** Kinds the temple savings never hold back. */
/** Stone a bot keeps for the next stone house before raising a service level. */
const UPGRADE_STONE_RESERVE = 10;
const SAVINGS_FREE: ReadonlySet<BuildableKind> = new Set<BuildableKind>(['fisher', 'gatherer', 'field', 'granary', 'house', 'temple']);
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

type Producer = 'lumber' | 'quarry';
/** The building that makes each material, and the one each building makes. */
const PRODUCER: Record<Material, Producer> = { wood: 'lumber', stone: 'quarry' };
/** Most productive lumbers or quarries a bot keeps. */
const MAX_PRODUCERS = 4;
/** Below this a lumber or quarry counts as stopped (its grove is cut). */
const DEAD_YIELD = 0.5;
/** Goal index from which the planner expects big houses (more stone). */
const BIG_HOUSES_GOAL = GOALS.findIndex((g) => g.type === 'houses' && (g.level ?? 0) >= 4);

export class SurvivalBot {
  stats: Stats = { actions: 0, built: {}, roadCells: 0 };
  /** Materials a wanted build lacked during the last `act` (the next act reacts to it; the runner reads it for W3). */
  lacked: Record<Material, boolean> = { wood: false, stone: false };
  private streak: Record<string, number> = {};
  /** A pending target: the bot laid road toward it and builds it once connected. */
  private pending: { kind: BuildableKind; r: Rect; dig: boolean } | null = null;
  /** The 6x6 kept free for the temple (see `reservesTemple`), or null. */
  private reserved: Rect | null = null;
  constructor(readonly p: Profile, private rng: Rng) {}

  /** Free land, and not on the ground kept for the temple (unless it is the temple). */
  private open(s: GameState, r: Rect, kind?: BuildableKind) {
    return freeRect(s, r) && (kind === 'temple' || !this.reserved || !overlaps(r, this.reserved));
  }

  /** From the goal that unlocks the temple on: keeps the nearest place it fits (ready first) free for it. */
  private updateReserve(s: GameState) {
    if (!this.p.reservesTemple || s.goalIndex < TEMPLE_UNLOCK || s.buildings.some((b) => b.kind === 'temple')) {
      this.reserved = null;
      return;
    }
    if (this.reserved && freeRect(s, this.reserved)) return;
    const spots = templeSpotsNear(s);
    const at = spots.find((o) => o.ready) ?? spots[0] ?? this.spotFor(s, 'temple')?.r;
    this.reserved = at ? { x: at.x, y: at.y, ...dimsOf('temple') } : null;
  }

  /** Silver kept for the temple: half its price while its goal runs, all of it once unlocked. */
  private savings(s: GameState) {
    if (this.p.savesTemple && s.unlocked.includes('temple') && !s.buildings.some((b) => b.kind === 'temple')) return costOf('temple');
    if (!this.reserved) return 0;
    return s.unlocked.includes('temple') ? costOf('temple') : costOf('temple') / 2;
  }

  /** Only food, the granary and houses may eat into the temple savings. */
  private spends(s: GameState, kind: BuildableKind) {
    return SAVINGS_FREE.has(kind) || s.silver - costOf(kind) >= this.savings(s);
  }

  /** Wood or stone kept back from other buildings: houses ready (or, for a planner, about) to climb, a new house, the temple. */
  private materialKeep(s: GameState, m: Material): number {
    if (!this.p.materialReserve) return 0;
    let keep = m === 'wood' ? (materialsOf('house').wood ?? 0) * (this.p.planner ? 2 : 1) : 0;
    for (const h of s.buildings) {
      if (h.kind !== 'house' || h.level === 0 || h.level + 1 >= HOUSE_LEVELS.length) continue;
      if (h.waiting || (this.p.planner && h.upStreak >= h.upWeeks - 4)) keep += levelMaterials(h.level + 1)[m] ?? 0;
    }
    const temple = materialsOf('temple')[m] ?? 0;
    // Once the temple is open everyone with a reserve keeps its material; the planner starts earlier (see `reserved`).
    if (s.unlocked.includes('temple') && !s.buildings.some((b) => b.kind === 'temple')) keep += temple;
    else if (this.reserved) keep += s.unlocked.includes('temple') ? temple : temple / 2;
    return keep;
  }

  /** Has the materials for this build and keeps the reserve (houses, lumbers and quarries never wait for it). */
  private hasMaterials(s: GameState, kind: BuildableKind): boolean {
    const miss = missingMaterial(s, kind);
    if (miss) { this.lacked[miss] = true; return false; }
    if (kind === 'house' || kind === 'lumber' || kind === 'quarry' || kind === 'temple') return true;
    const cost = materialsOf(kind);
    return MATERIALS.every((m) => !cost[m] || s[m] - cost[m]! >= this.materialKeep(s, m));
  }

  private bump(k: string, on: boolean) { this.streak[k] = on ? (this.streak[k] ?? 0) + 1 : 0; }
  private seen(k: string, factor = 1) { return (this.streak[k] ?? 0) > this.p.delay * factor; }
  private lasted(k: string, weeks: number) { return (this.streak[k] ?? 0) > weeks; }
  /** Caravans (by week) the bot decided not to prepare for (`caravanSkip`). */
  private skipped = new Map<number, boolean>();
  private prepares(c: { week: number }) {
    if (!this.skipped.has(c.week)) this.skipped.set(c.week, this.rng() < this.p.caravanSkip);
    return !this.skipped.get(c.week);
  }

  act(s: GameState) {
    const eco = computeEconomy(s);
    const block = birthBlock(s, eco);
    this.bump('famine', s.famine);
    this.bump('blockFood', block === 'food');
    this.bump('blockStorage', block === 'storage');
    this.bump('spoil', s.spoiled > 0);
    this.bump('deficit', eco.silverDelta < 0);
    // The core counts the jobs of the whole year (frozen fields included), like the on-screen alert.
    this.bump('idle', unemployed(s) >= RULES.unemploymentAlert);
    this.bump('debt', s.silver < 0);
    this.bump('couples', waitingCouples(s).length > 0);
    this.bump('caravan', announcedCaravan(s) !== null);
    for (const [level, kind] of EVOLUTION) this.bump(`stall_${kind}`, stalled(s, level, kind).length > 0);
    // Materials: houses waiting (the alert), a build that lacked them (the toast), the temple short of them.
    const waitingMat = housesWaiting(s);
    const templeOpen = s.unlocked.includes('temple') && !s.buildings.some((b) => b.kind === 'temple');
    for (const m of MATERIALS) {
      this.bump(`wait_${m}`, waitingMat[m] > 0);
      this.bump(`short_${m}`, this.lacked[m]);
      this.bump(`temple_${m}`, templeOpen && s[m] < (materialsOf('temple')[m] ?? 0));
      this.lacked[m] = false;
    }
    this.updateReserve(s);
    if (this.p.tutorial && s.week === 0 && !this.tutored) this.playTutorial(s);
    if (this.rng() < this.p.idleChance) return;
    for (let k = 0; k < this.p.actions; k++) {
      if (!this.step(s)) break;
      this.stats.actions++;
    }
  }

  private tutored = false;
  /** The tutorial's build steps (no clock): a fisher or a gatherer, a field, a lumber and a house. */
  private playTutorial(s: GameState) {
    this.tutored = true;
    for (let k = 0; k < 4 && !this.place(s, 'fisher', true, true) && !this.place(s, 'gatherer', true, true); k++);
    for (const kind of ['field', 'lumber'] as const) for (let k = 0; k < 4 && !s.buildings.some((b) => b.kind === kind && b.connected); k++) if (!this.place(s, kind, true, true)) break;
    for (let k = 0; k < 3 && !this.houses(s, 1); k++);
  }

  private step(s: GameState): boolean {
    if (this.seen('debt') || (this.p.planner && s.silver < 0)) return this.trim(s);
    if (s.silver < 0) return false;
    if (this.pending) {
      const { kind, r, dig } = this.pending;
      if (!freeRect(s, r)) this.pending = null;
      else if (this.reach(s, kind, r, dig)) return true;
    }
    const goal = currentGoal(s);
    const season = seasonOf(s.week);

    // 1. Food.
    if (this.seen('famine') && this.food(s, true)) return true;
    if (!this.p.foodOnlyInFamine) {
      if (this.p.planner) {
        if (this.plannerFields(s)) return true;
        if (this.plannerFood(s)) return true;
      } else {
        const goalFood = goal?.type === 'foodUntilSpring' && goalProgress(s, goal) < goalTarget(s, goal);
        if ((goalFood || this.seen('blockFood')) && this.food(s, false)) return true;
      }
    }

    // 2. Granary.
    const granaries = s.buildings.filter((b) => b.kind === 'granary').length;
    if (s.unlocked.includes('granary')) {
      const want = goal?.type === 'build' && goal.kind === 'granary' && granaries === 0;
      // "The store only keeps N" (block `storage`) asks for a granary, like spoiled food.
      // Nobody keeps more than half a year of food: spoiling past that is accepted.
      const roomy = foodCapacity(s) >= computeEconomy(s).foodEaten * 26 + RULES.baseFoodStorage;
      const spoil = !roomy && (this.seen('spoil') || (!this.p.foodOnlyInFamine && this.seen('blockStorage')));
      const plan = this.p.planner && this.plannerWantsGranary(s);
      // Raises a granary before building another (except the distracted player, who only builds).
      if ((spoil || plan) && granaries > 0 && !this.p.foodOnlyInFamine && this.upgradeGranary(s)) return true;
      if ((want || spoil || plan || (this.p.granaryEarly && granaries === 0)) && this.place(s, 'granary')) return true;
    }

    // 2a. A "build" goal on screen (the workshop): every player builds one once it can (the granary and the temple have their own rules).
    const goalKind = goal?.type === 'build' ? (goal.kind as BuildableKind | undefined) : undefined;
    if (goal && goalKind && goalKind !== 'granary' && goalKind !== 'temple' && goalProgress(s, goal) < goalTarget(s, goal) && this.place(s, goalKind, false, true)) return true;

    // 2b. Materials: lumbers and quarries.
    if (this.materials(s)) return true;

    // 3. Evolution: family houses stalled for the next unlocked service (2 → plaza, 3 → market and park).
    // Workshops for jobs come first only while their field bonus is below the cap the player reads.
    const bonusLeft = fieldBonus(s) < (BUILDINGS.workshop.fieldBonusMax ?? 0);
    if (s.unlocked.includes('workshop') && bonusLeft && this.seen('idle') && this.place(s, 'workshop')) return true;
    for (const [level, kind] of EVOLUTION) {
      if (!s.unlocked.includes(kind)) continue;
      const waiting = stalled(s, level, kind);
      // The planner serves at once a full house with a fertile couple (the next level gives room for a child).
      const urgent = this.p.planner && waiting.some((h) => fertileFull(s, h));
      // The distracted player reacts only after seeing the balloon for `delay` weeks.
      const enough = (urgent || waiting.length >= (this.p.planner ? 2 : 3)) && (!this.p.reactsToBalloons || this.seen(`stall_${kind}`));
      if (enough && this.service(s, kind, waiting)) return true;
    }

    // 5. Temple: built as soon as it is unlocked and affordable (with a little margin).
    const templeReady = s.unlocked.includes('temple') && !s.buildings.some((b) => b.kind === 'temple');
    const templeMaterials = !missingMaterial(s, 'temple');
    if (templeReady && s.silver >= costOf('temple') + 40 && templeMaterials) {
      if (this.reserved) return this.reach(s, 'temple', this.reserved);
      if (templeSpots(s).length) return this.place(s, 'temple');
    }
    if (goal?.type === 'build' && goal.kind === 'temple') {
      if (templeSpots(s).length) {
        if (s.silver >= costOf('temple') && templeMaterials) return this.place(s, 'temple');
      } else if (this.place(s, 'temple')) return true;
      if (this.p.planner || this.p.savesTemple) return false; // saves
    }

    // 6. Houses: one empty house per waiting couple and per family of an announced caravan (the
    // planner at once, the others once they saw the warning for `delay` weeks), plus `plotsAhead`.
    const free = s.buildings.filter((b) => freeHouse(s, b)).length;
    const couples = this.p.planner || this.seen('couples', this.p.houseDelayFactor) ? waitingCouples(s).length : 0;
    const coming = announcedCaravan(s);
    const caravan = coming && (this.p.planner || this.seen('caravan', this.p.houseDelayFactor)) && this.prepares(coming) ? coming.families : 0;
    const need = couples + caravan + this.p.plotsAhead - free;
    if (need > 0 && this.houses(s, need)) return true;
    // 7. Planner: grow food ahead of growth.
    if (this.p.planner && this.plannerGrowth(s)) return true;
    // 8. Spare silver and stone: service levels.
    if (this.upgradeServices(s)) return true;
    void season;
    return false;
  }

  /** In debt: demolishes one building of the costliest upkeep kind, the one that serves least. */
  private trim(s: GameState): boolean {
    const eco = computeEconomy(s);
    if (eco.silverDelta >= 0 && s.silver + eco.silverDelta * (RULES.debtWeeksToLose - s.debtWeeks) >= 0) return false;
    const value = (b: Building) => {
      if (b.kind === 'plaza' || b.kind === 'market' || b.kind === 'park') return 2 * s.buildings.filter((h) => h.kind === 'house' && h.level > 0 && cheb(h, b) <= (BUILDINGS[b.kind].radius ?? 0)).length;
      if (b.kind === 'fisher' || b.kind === 'gatherer' || b.kind === 'lumber' || b.kind === 'quarry') return gatherYield(s, b) * 3;
      if (b.kind === 'field') return 3;
      if (b.kind === 'granary') return s.food > RULES.baseFoodStorage ? 6 : 1;
      return 4;
    };
    const isFood = (x: Building) => x.kind === 'fisher' || x.kind === 'gatherer' || x.kind === 'field';
    const per = (b: Building) => value(b) / (statOf(b, 'upkeep') || 1);
    // Never the last granary (its food would spoil) nor the last two food buildings.
    const last = (kind: BuildableKind) => s.buildings.filter((x) => x.kind === kind).length <= 1;
    const keep = (b: Building) => (isFood(b) && s.buildings.filter(isFood).length <= 2) || ((b.kind === 'granary' || b.kind === 'lumber' || b.kind === 'quarry') && last(b.kind));
    const cands = s.buildings.filter((b) => statOf(b, 'upkeep') > 0 && !BUILDINGS[b.kind].protected && !keep(b)).sort((a, b) => per(a) - per(b));
    if (!cands.length) return false;
    this.stats.built.trim = (this.stats.built.trim ?? 0) + 1;
    return clearCell(s, cands[0].x, cands[0].y).ok;
  }

  // ---------------------------------------------------------------- materials

  /** Builds a lumber or a quarry when the profile thinks the city needs one more (see `wantsProducer`). */
  private materials(s: GameState): boolean {
    for (const m of MATERIALS) {
      const kind = PRODUCER[m];
      if (!s.unlocked.includes(kind)) continue;
      // Only the ones still making something count (a lumber in a cut grove makes little until it regrows).
      const all = s.buildings.filter((b) => b.kind === kind);
      const own = all.filter((b) => gatherYield(s, b) >= DEAD_YIELD);
      if (own.length >= MAX_PRODUCERS) continue;
      const made = own.reduce((a, b) => a + gatherYield(s, b), 0);
      const essential = own.length === 0 || housesWaiting(s)[m] > 0;
      if (!this.wantsProducer(s, m, own.length, made) || !this.place(s, kind, false, essential)) continue;
      // A new producer: the shortage starts to count again. The attentive players pull down the
      // ones that stopped producing (the distracted one leaves them standing).
      for (const k of [`wait_${m}`, `short_${m}`, `temple_${m}`]) this.streak[k] = 0;
      if (!this.p.reactsToBalloons) {
        for (const b of all) if (gatherYield(s, b) < DEAD_YIELD && clearCell(s, b.x, b.y).ok) this.stats.built[`${kind}Down`] = (this.stats.built[`${kind}Down`] ?? 0) + 1;
      }
      return true;
    }
    return false;
  }

  /**
   * Eficiente (planner): the first lumber at once and the first quarry at its unlock, then more while
   * the production is below `materialNeed`. Comum: the first lumber when the wood runs low, the first
   * quarry when the goal asks for stone houses, or when a shortage shows; another after `materialWait`
   * weeks of shortage. Distraido: only after seeing the warning (houses waiting, a build that failed).
   */
  private wantsProducer(s: GameState, m: Material, n: number, made: number): boolean {
    const f = this.p.houseDelayFactor;
    const short = this.seen(`wait_${m}`, f) || this.seen(`short_${m}`, f) || this.seen(`temple_${m}`, f);
    const long = [`wait_${m}`, `short_${m}`, `temple_${m}`].some((k) => this.lasted(k, this.p.materialWait));
    // The planner adds one only while the stock is low (it does not pile up more than it plans to use).
    if (this.p.planner) return n === 0 || ((made < this.materialNeed(s, m) || long) && s[m] < this.materialKeep(s, m) + 40);
    if (n === 0) {
      if (short) return true;
      if (this.p.reactsToBalloons) return false;
      const goal = currentGoal(s);
      return m === 'wood' ? s.wood < 15 : goal?.type === 'houses' && (goal.level ?? 0) >= 3;
    }
    return long || (short && made < 1);
  }

  /** Planner: material per week to aim for (grows with the city, the big houses and the temple savings). */
  private materialNeed(s: GameState, m: Material): number {
    const houses = s.buildings.filter((b) => b.kind === 'house' && b.level > 0).length;
    const temple = this.reserved !== null && s[m] < (materialsOf('temple')[m] ?? 0);
    if (m === 'wood') return 2 + houses * 0.08 + (temple ? 2 : 0);
    return 2.5 + (s.goalIndex >= BIG_HOUSES_GOAL ? 2.5 : 0) + (temple ? 3 : 0);
  }

  // ---------------------------------------------------------------- food

  /** Food choice for a reacting (non planner) bot. */
  private food(s: GameState, emergency: boolean): boolean {
    if (this.p.planner) return this.plannerFood(s, true);
    const [a, b, c] = this.p.foodMix;
    const r = this.rng() * (a + b + c);
    const order: BuildableKind[] = r < a ? ['fisher', 'gatherer', 'field'] : r < a + b ? ['gatherer', 'fisher', 'field'] : ['field', 'fisher', 'gatherer'];
    void emergency;
    for (const k of order) if (this.place(s, k)) return true;
    return false;
  }

  /** Score of a city copy: weeks the food lasts over two years and the food left. */
  private outlook(s: GameState) {
    s = settle(s);
    const eco = computeEconomy(s);
    const out = foodForecast(s, eco, 104);
    return out ? out.weeks : 104;
  }

  /** Planner: keeps the forecast past the next harvest (+ margin) and a year ahead. */
  private plannerFood(s: GameState, force = false): boolean {
    const st = settle(s);
    const out = foodForecast(st, computeEconomy(st), 60);
    const need = weeksToHarvest(s.week) + 6;
    if (!force && out && out.weeks >= Math.min(need, 60)) return false;
    if (!force && !out) return false;
    return this.bestFood(s);
  }

  /** Tries fisher, gatherer and (if it will harvest) a field on copies and builds the best. */
  private bestFood(s: GameState, kinds: BuildableKind[] = this.p.foodMix[2] === 0 ? ['fisher', 'gatherer'] : ['fisher', 'gatherer', 'field']): boolean {
    const base = this.outlook(s);
    let best: { kind: BuildableKind; r: Rect; v: number; d: number } | null = null;
    for (const kind of kinds) {
      if (!s.unlocked.includes(kind) || s.silver < costOf(kind)) continue;
      const cand = this.spotFor(s, kind);
      if (!cand) continue;
      const copy = structuredClone(s);
      copy.silver = 1e6;
      place(copy, kind, cand.r.x, cand.r.y);
      const b = copy.buildings[copy.buildings.length - 1];
      b.connected = true;
      const v = this.outlook(copy) - base - cand.d * 0.05;
      if (!best || v > best.v) best = { kind, r: cand.r, v, d: cand.d };
    }
    if (!best || best.v <= 0) return false;
    return this.reach(s, best.kind, best.r);
  }

  /** Autumn: sows enough fields for next year's food gap (and one for the harvest goal). */
  private plannerFields(s: GameState): boolean {
    // Fields give food from the week they are built, except in winter (see harvest.ts).
    if (!this.p.knowsAutumn || seasonOf(s.week) === 'winter' || s.silver < costOf('field')) return false;
    const st = settle(s);
    const eco = computeEconomy(st);
    const steady = st.buildings.reduce((a, b) => a + gatherYield(st, b), 0) * eco.efficiency;
    // A year of eating: three seasons as now, the winter at the winter factor.
    const yearEaten = eco.foodEaten * (3 + RULES.winter.foodFactor) * RULES.weeksPerSeason;
    const gap = yearEaten * 1.15 - steady * 52;
    const sown = s.buildings.filter((b) => b.kind === 'field' && b.connected).length;
    const want = this.p.foodMix[2] === 0 ? 0 : Math.ceil(gap / ((BUILDINGS.field.harvest ?? 1) * Math.max(0.5, eco.efficiency)));
    if (sown >= want) return false;
    if (this.p.staffAware && eco.yearJobs + BUILDINGS.field.jobs > eco.workers + 1 && sown >= 1) return false;
    return this.place(s, 'field');
  }

  private plannerWantsGranary(s: GameState) {
    // Fields give food every week out of winter (see harvest.ts); the store must hold the winter's food.
    if (!s.buildings.some((b) => b.kind === 'field' && b.connected)) return false;
    const eco = computeEconomy(settle(s));
    return foodCapacity(s) < eco.foodEaten * RULES.winter.foodFactor * RULES.weeksPerSeason * 1.2 + 10;
  }

  /** Planner: in autumn adds fields when next year's food is short; adds steady food when needed. */
  private plannerGrowth(s: GameState): boolean {
    const eco = computeEconomy(s);
    if (this.p.staffAware && eco.yearJobs >= eco.workers) return false;
    const st = settle(s);
    const out = foodForecast(st, computeEconomy(st), 60);
    if (!out) return false;
    if (s.silver < 60) return false;
    return this.bestFood(s);
  }

  // ---------------------------------------------------------------- placement

  /** Best spot for a kind (connected or reachable by road): returns rect and road cells needed. */
  private spotFor(s: GameState, kind: BuildableKind, dig = false, far = false): { r: Rect; d: number; dig: boolean } | null {
    const { w, h } = dimsOf(kind);
    const rd = roadDist(s, dig);
    const altar = altarRect(s);
    let best: { r: Rect; d: number; v: number } | null = null;
    // Food and the temple are worth a long road; other buildings a short one (SERVICE_ROAD).
    const gathers = kind === 'fisher' || kind === 'gatherer' || kind === 'lumber' || kind === 'quarry';
    const reach = far || gathers || (kind === 'field' && this.p.planner) || kind === 'temple' ? this.p.roadReach : Math.min(this.p.roadReach, SERVICE_ROAD);
    for (let y = 0; y + h <= s.rows; y++) for (let x = 0; x + w <= s.cols; x++) {
      const r = { x, y, w, h };
      if (!this.open(s, r, kind)) continue;
      const { d } = rectReach(s, r, rd);
      if (d > reach) continue;
      let v = 0;
      if (gathers) {
        const g = gatherYield(s, fake(s, kind, r));
        if (g < (kind === 'lumber' || kind === 'quarry' ? 1 : 0.5)) continue;
        v = g * 10;
        // The planner keeps lumbers and gatherers in different groves (the preview's "shares the grove").
        if (this.p.planner && (kind === 'lumber' || kind === 'gatherer')) v -= sharedTrees(s, x, y, kind) * (kind === 'lumber' ? 1 : 0.5);
      } else if (kind === 'field') {
        v = this.p.planner && byRiver(s, fake(s, kind, r)) ? 3 : 0;
        v -= cheb(r, altar) < 5 ? 2 : 0; // keep the altar's ground for houses
      } else if (kind === 'temple') {
        v = -cheb(r, altar) * 0.2;
      } else {
        v = -cheb(r, altar) * 0.2;
      }
      v += -d * 0.4 + this.rng() * this.p.noise;
      if (!best || v > best.v) best = { r, d, v };
    }
    // The temple must go somewhere: in a boxed-in city the bot demolishes its way out.
    if (!best && (kind === 'temple' || far) && !dig) return this.spotFor(s, kind, true, far);
    return best && { r: best.r, d: best.d, dig };
  }

  /** `essential`: built even without free workers (the first lumber or quarry, or one for houses waiting on it). */
  private place(s: GameState, kind: BuildableKind, emergency = false, essential = false): boolean {
    if (!s.unlocked.includes(kind) || s.silver < costOf(kind)) return false;
    if (!this.hasMaterials(s, kind)) return false;
    if (!emergency && kind !== 'temple' && !this.affords(s, kind)) return false;
    if (!emergency && !this.spends(s, kind)) return false;
    if (this.p.staffAware && !essential && BUILDINGS[kind].jobs > 0 && kind !== 'fisher' && kind !== 'gatherer' && kind !== 'field' && kind !== 'granary' && kind !== 'temple') {
      const eco = computeEconomy(s);
      if (eco.yearJobs + BUILDINGS[kind].jobs > eco.workers + 1) return false;
    }
    // A boxed-in city lays a long road (demolishing if needed) to reach open land for food and services.
    const far = ['granary', 'field', 'fisher', 'gatherer', 'lumber', 'quarry', 'market', 'plaza', 'park'].includes(kind);
    const spot = this.spotFor(s, kind) ?? (far ? this.spotFor(s, kind, false, true) : null);
    if (!spot) return false;
    return this.reach(s, kind, spot.r, spot.dig);
  }

  /** Builds the rect if it touches the network, else lays one road stroke toward it. */
  private reach(s: GameState, kind: BuildableKind, r: Rect, dig = false): boolean {
    if (s.silver < costOf(kind) || !this.hasMaterials(s, kind)) return false;
    const rd = roadDist(s, dig);
    const { d, cell } = rectReach(s, r, rd);
    if (d === 0) {
      this.pending = null;
      const ok = place(s, kind, r.x, r.y, r.w !== dimsOf(kind).w).ok;
      if (ok) this.stats.built[kind] = (this.stats.built[kind] ?? 0) + 1;
      return ok;
    }
    if (!Number.isFinite(d) || s.silver < costOf(kind) + d * costOf('road')) return false;
    const path: number[] = [];
    for (let k = cell; k >= 0 && rd.dist[k] > 0; k = rd.prev[k]) path.unshift(k);
    let laid = 0;
    for (const i of path.slice(0, 12)) {
      const x = i % s.cols, y = Math.floor(i / s.cols);
      if (this.reserved && overlaps({ x, y, w: 1, h: 1 }, this.reserved)) break;
      if (dig && s.grid[i]) this.stats.built.dug = (this.stats.built.dug ?? 0) + 1;
      if ((s.feature[i] || (dig && s.grid[i])) && !clearCell(s, x, y).ok) break;
      if (!place(s, 'road', x, y).ok) break;
      laid++;
    }
    this.stats.roadCells += laid;
    this.pending = laid ? { kind, r, dig } : null;
    return laid > 0;
  }

  /** A planner keeps 20 weeks of a negative balance in the bank (counting the new upkeep). */
  private affords(s: GameState, kind: BuildableKind, cost = costOf(kind), upkeep = BUILDINGS[kind].upkeep ?? 0) {
    if (!this.p.planner) return true;
    const after = computeEconomy(s).silverDelta - upkeep;
    return !(after < 0 && s.silver - cost < -after * 20);
  }

  /** Raises the lowest granary one level when the silver allows it. */
  private upgradeGranary(s: GameState): boolean {
    return this.upgrade(s, 'granary');
  }

  /**
   * Raises the lowest building of this kind one level when the silver and the materials allow it
   * (levels cost stone; the bot keeps the stone its houses and the temple wait for, see `materialKeep`).
   */
  private upgrade(s: GameState, kind: 'granary' | 'market' | 'workshop'): boolean {
    const g = s.buildings.filter((b) => b.kind === kind && nextLevelOf(b)).sort((a, b) => a.level - b.level)[0];
    const next = g && nextLevelOf(g);
    if (!g || !next || s.silver < next.cost || !this.spends(s, kind)) return false;
    if (!this.affords(s, kind, next.cost, (next.upkeep ?? 0) - statOf(g, 'upkeep'))) return false;
    const cost = next.materials ?? {};
    if (MATERIALS.some((m) => (cost[m] ?? 0) > 0 && s[m] - cost[m]! < this.materialKeep(s, m) + UPGRADE_STONE_RESERVE)) return false;
    const ok = upgradeBuilding(s, g.x, g.y).ok;
    if (ok) this.stats.built[`${kind}Up`] = (this.stats.built[`${kind}Up`] ?? 0) + 1;
    return ok;
  }

  /** Spare silver and stone: raises a market, or a workshop while the field bonus is below its cap. */
  private upgradeServices(s: GameState): boolean {
    if (this.p.foodOnlyInFamine) return false; // the distracted player does not look for upgrades
    if (fieldBonus(s) < (BUILDINGS.workshop.fieldBonusMax ?? 0) && this.upgrade(s, 'workshop')) return true;
    return this.upgrade(s, 'market');
  }

  private service(s: GameState, kind: ServiceBuilding, targets: Building[]) {
    if (s.silver < costOf(kind) || !this.affords(s, kind) || !this.spends(s, kind) || !this.hasMaterials(s, kind)) return false;
    const { w, h } = dimsOf(kind);
    const rad = BUILDINGS[kind].radius ?? 0;
    // Spots touching the network, or a few road cells away (the bot lays the road first).
    const rd = roadDist(s);
    let best: { r: Rect; v: number; n: number; d: number } | null = null;
    for (const rot of kind === 'market' ? [false, true] : [false]) {
      const d = rot ? { w: h, h: w } : { w, h };
      for (let y = 0; y + d.h <= s.rows; y++) for (let x = 0; x + d.w <= s.cols; x++) {
        const r = { x, y, ...d };
        if (!this.open(s, r)) continue;
        const reach = rectReach(s, r, rd).d;
        if (reach > SERVICE_ROAD) continue;
        const n = targets.filter((t) => cheb(r, t) <= rad).length;
        if (n === 0) continue;
        const v = n - reach * 0.3 + this.rng() * this.p.noise * 0.3;
        if (!best || v > best.v) best = { r, v, n, d: reach };
      }
    }
    if (!best) return false;
    const r = best.r;
    const rotated = r.w !== w;
    if (best.d > 0) return this.reach(s, kind, r);
    const ok = place(s, kind, r.x, r.y, rotated).ok;
    if (ok) this.stats.built[kind] = (this.stats.built[kind] ?? 0) + 1;
    return ok;
  }

  private houses(s: GameState, max: number) {
    const cost = costOf('house');
    if (s.silver < cost || !this.hasMaterials(s, 'house')) return false;
    const woodEach = materialsOf('house').wood ?? 0;
    const byWood = woodEach ? Math.floor(s.wood / woodEach) : Infinity;
    if (byWood < Math.min(max, this.p.housesPerAction)) this.lacked.wood = true;
    const { w, h } = dimsOf('house');
    const altar = altarRect(s);
    const goal = currentGoal(s);
    const bigGoal = goal?.type === 'houses' && (goal.level ?? 0) >= 4;
    const cands: { r: Rect; v: number }[] = [];
    for (let y = 0; y + h <= s.rows; y++) for (let x = 0; x + w <= s.cols; x++) {
      const r = { x, y, w, h };
      if (!this.open(s, r) || !borderCells(s, r).some((c) => s.network[indexOf(s, c.x, c.y)])) continue;
      const f = fake(s, 'house', r);
      const plaza = needMet(s, f, 'plaza');
      // Before the plaza is unlocked (B1: it comes with the mud-brick goal) any plot on the network will do.
      if (this.p.planPlazas && s.unlocked.includes('plaza') && !plaza) continue;
      let v = -cheb(r, altar) * 0.3 + (plaza ? 2 : 0) + (needMet(s, f, 'market') ? 1 : 0) + (bigGoal && needMet(s, f, 'park') ? 6 : 0);
      v += this.rng() * this.p.noise;
      cands.push({ r, v });
    }
    if (!cands.length) {
      if (this.p.planPlazas && s.unlocked.includes('plaza')) {
        // Place a plaza near the city edge where plots can go.
        const spot = this.spotFor(s, 'plaza');
        if (spot && spot.d === 0 && s.silver >= costOf('plaza') + cost) { const ok = place(s, 'plaza', spot.r.x, spot.r.y).ok; if (ok) this.stats.built.plaza = (this.stats.built.plaza ?? 0) + 1; return ok; }
      }
      if (this.roadStroke(s)) return true;
      // No straight stroke out of the city: a road (demolishing if boxed in) to the nearest free plot.
      const spot = this.spotFor(s, 'house', false, true);
      return !!spot && this.reach(s, 'house', spot.r, spot.dig);
    }
    cands.sort((a, b) => b.v - a.v);
    let n = 0;
    for (const c of cands) {
      if (n >= Math.min(max, this.p.housesPerAction, byWood) || s.silver < cost) break;
      if (place(s, 'house', c.r.x, c.r.y).ok) n++;
    }
    this.stats.built.house = (this.stats.built.house ?? 0) + n;
    return n > 0;
  }

  /** A straight road of 6 cells out of the network, toward open land near the altar. */
  private roadStroke(s: GameState) {
    const altar = altarRect(s);
    let best: { x: number; y: number; dx: number; dy: number; v: number } | null = null;
    for (let i = 0; i < s.cols * s.rows; i++) {
      if (!(s.network[i] && s.roads[i])) continue;
      const x = i % s.cols, y = Math.floor(i / s.cols);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let ok = 0;
        for (let k = 1; k <= 6; k++) if (isFreeLand(s, x + dx * k, y + dy * k) && this.open(s, { x: x + dx * k, y: y + dy * k, w: 1, h: 1 })) ok++; else break;
        if (ok < 4) continue;
        const v = -cheb({ x, y, w: 1, h: 1 }, altar) + this.rng() * 3;
        if (!best || v > best.v) best = { x, y, dx, dy, v };
      }
    }
    if (!best || s.silver < 12) return false;
    let laid = 0;
    for (let k = 1; k <= 6; k++) {
      const c = { x: best.x + best.dx * k, y: best.y + best.dy * k, w: 1, h: 1 };
      if (this.open(s, c) && place(s, 'road', c.x, c.y).ok) laid++;
      else break;
    }
    this.stats.roadCells += laid;
    return laid > 0;
  }
}

/** A copy where every house with a family is one level up when its needs allow (what it becomes this season). */
function settle(s: GameState): GameState {
  const c = structuredClone(s);
  for (const h of c.buildings) {
    if (h.kind !== 'house' || h.level === 0 || !h.connected) continue;
    if (h.level + 1 < HOUSE_LEVELS.length && HOUSE_LEVELS[h.level + 1].needs.every((n) => needMet(c, h, n))) h.level++;
  }
  return c;
}

// ------------------------------------------------------------------ runner

export interface Result {
  bot: string;
  seed: number;
  families0: number;
  foodWeeks0: number;
  riverDist: number;
  won: boolean;
  lost: boolean;
  weeks: number;
  /** City had residents at week 52 and was not lost. */
  year1: boolean;
  residents52: number;
  residents104: number;
  lowestResidentsY1: number;
  famineY1: number;
  famineWeeks: number;
  longestFamine: number;
  left: number;
  leftWinter1: number;
  emptied: boolean;
  firstHarvestWeek: number | null;
  firstFieldWeek: number | null;
  firstGranaryWeek: number | null;
  goalWeeks: (number | null)[];
  blocks: Record<string, number>;
  blocksY1: Record<string, number>;
  food: { field: number; fisher: number; gatherer: number; spoiled: number };
  droughtYears: number;
  famineAfterDrought: number;
  debtLoss: boolean;
  /** Silver went below 0 in year 1 (weeks 1-52) / year 2 (53-104) / ever. */
  debtY1: boolean;
  debtY2: boolean;
  debtEver: boolean;
  /** Longest wait on a single goal in weeks (the unfinished one counts until the end), and its index. */
  goalWait: number;
  goalWaitIndex: number;
  built: Record<string, number>;
  peak: number;
  /** Houses with a family, connected, at week 52. */
  houses52: number;
  /** Winters (by year, 0-based) with at least one famine week. */
  famineWinters: number;
  /** Crises (residents >= 25% below the peak so far, or 4+ weeks of famine in a row) and recoveries (back to that peak). */
  crises: number;
  recoveries: number;
  /** Week the first crisis started, or null. */
  firstCrisisWeek: number | null;
  /** Most workshops standing at the same time. */
  maxWorkshops: number;
  /** Longest run of weeks with more than 300 silver before the temple is unlocked. */
  silverIdle: number;
  /** Residents at the end of each year (weeks 52, 104, ...). */
  residentsByYear: number[];
  /** Birth block counts per year (0-based). */
  blocksByYear: Record<string, number>[];
  /** Births, deaths and weddings of each year (autumn to autumn). */
  peopleByYear: { births: number; deaths: number; weddings: number }[];
  /** Later caravans that arrived: families that stayed and that went on. */
  caravanHoused: number;
  caravanLeft: number;
  /** Most granaries at once. */
  maxGranaries: number;
  /** Houses with a family per level (1..4) at the end. */
  levelsAtEnd: number[];
  /** Cells with a tree or rock on the starting map. */
  features0: number;
  /** M2 (plano-p2-correcoes 2.3): at the temple unlock, a free 6x6 at most `templeSpotRoadGap` cells from the network (null: never unlocked). */
  templeGap: boolean | null;
  /** Diagnostic only: the temple had a ready spot (touching the network) the week it was unlocked. */
  templeRoom: boolean | null;
  /** At the temple unlock: a 6x6 spot of free land or trees within SERVICE_ROAD road cells / anywhere on free land or trees. */
  templeNear: boolean | null;
  templeAny: boolean | null;
  /** Silver spent cutting trees (bot actions only). */
  clearSpent: number;
  /** Big houses (level 4) at week 260. */
  big260: number;
  /** Upkeep per building kind at week 156 (start of year 4 = end of year 3). */
  upkeepY3: Record<string, number>;
  /** At the end of the run: silver, weekly silver change, and whether the temple had a ready spot / any 6x6 of free land or trees. */
  endSilver: number;
  endIncome: number;
  endTempleRoom: boolean;
  endTempleAny: boolean;
  /** A4: largest residents(year N) / residents(year N-1) from year 2 on (completed years before the end). */
  growthMax: number;
  /** A4 without recoveries: largest residents(year N) / the best year-end before it or the founding caravan (a city back at an old size is not an explosion). */
  growthPeak: number;
  /** Residents in the founding caravan. */
  residentsStart: number;
  /** Couples that left for lack of a house, and the longest wait of a couple (weeks). */
  couplesLeft: number;
  coupleWaitMax: number;
  /** Later caravans that arrived; with every family housed; with at least one housed. */
  caravansArrived: number;
  caravansAll: number;
  caravansSome: number;
  /** A8: the first winter with >= 15 houses with people: most granaries at once, store capacity, and famine. */
  g15: { year: number; granaries: number; capacity: number; famine: boolean } | null;
  /** Week-couples of the fertile couples living together, by reason they had no child (per year). */
  coupleBlocksByYear: Record<string, number>[];
  /** At the end: people by age band, unemployed adults; median age at death (by age). */
  endBands: { child: number; adult: number; elder: number };
  endUnemployed: number;
  deathAge: number;
  /** Residents in the city at the week of victory or the end. */
  endResidents: number;
  /** Week each milestone, residents mark (`res<n>`, n = 10..200 by 5) and houses mark (`h<level>x<n>`) was first reached: for goal design. */
  marks: Record<string, number>;
  /** P3 materials: the numbers below (W1-W6 of plano-p3 8.2 and the 8.3 reports). */
  mat: MatResult;
  /** Package B1 (plano-sobrevivencia 7): survival of the first year. */
  b1: B1Result;
}

export interface B1Result {
  /** Weeks with the city cold (no firewood), in year 1 and in the whole game; winters (by year) with any. */
  coldY1: number;
  coldWeeks: number;
  coldWinters: number;
  /** Wood stock at weeks 0, 4, ..., 52. */
  woodY1: number[];
  /** House-weeks in firewoodHold (year 1 / all) and houses that ever sat in it. */
  holdY1: number;
  holdAll: number;
  holdHouses: number;
  /** People who died / left the city in year 1 (weeks 0-51), by cause. */
  endsY1: Record<string, number>;
  /** Unemployed adults per week in year 1 (median of the weeks). */
  idleY1: number;
  /** Week each kind was unlocked. */
  unlockWeek: Record<string, number>;
  /** Week of the first lumber. */
  firstLumber: number | null;
  /** Week the city first had no residents and no family walking in (null: never). */
  emptyWeek: number | null;
}

export interface MatResult {
  /** Most lumbers / quarries standing at once. */
  lumbers: number;
  quarries: number;
  /** Weeks with at least one house waiting for wood / stone, and the longest wait of a single house (any material). */
  waitWeeks: Record<Material, number>;
  houseWaitMax: number;
  /** W3: weeks of year 1 in which the bot wanted to build and lacked wood. */
  woodBlockedY1: number;
  /** Weeks (all game) in which a wanted build lacked wood / stone. */
  blocked: Record<Material, number>;
  /** W4: longest run of wood or stone above 300 before the temple is unlocked. */
  idle300: number;
  /** W5: adults without work at week 200 (NaN if the game ended before). */
  unemployed200: number;
  /** Stumps standing at weeks 260 and 520, and trees cut in the game. */
  stumps260: number;
  stumps520: number;
  cut: number;
  /** Made, spent on buildings and spent on house levels. */
  made: Record<Material, number>;
  spentBuild: Record<Material, number>;
  spentLevel: Record<Material, number>;
  /** Stock at the end of the run (victory, defeat or the week limit). */
  end: Record<Material, number>;
  /** Stock at the end of each year. */
  byYear: Record<Material, number[]>;
  /** What the temple waited for last (silver, wood or stone), and weeks from its unlock to its building. */
  templeLast: string | null;
  templeWait: number;
}

const riverDistance = (s: GameState) => {
  const a = altarRect(s);
  let d = Infinity;
  for (let i = 0; i < s.ground.length; i++) if (s.ground[i] === 'river') d = Math.min(d, cheb({ x: i % s.cols, y: Math.floor(i / s.cols), w: 1, h: 1 }, a));
  return d;
};

/** Diagnostic for M2: a 6x6 rect of free land or trees (cuttable) near the network (<= SERVICE_ROAD road cells) / anywhere. */
function templeRoomLoose(s: GameState): [boolean, boolean] {
  const { w, h } = dimsOf('temple');
  const open = (x: number, y: number) => { const i = indexOf(s, x, y); return isFreeLand(s, x, y) || (!s.grid[i] && !s.roads[i] && s.ground[i] !== 'river' && (s.feature[i] === 'palm' || s.feature[i] === 'olive')); };
  const rd = roadDist(s);
  let near = false, any = false;
  for (let y = 0; y + h <= s.rows; y++) for (let x = 0; x + w <= s.cols; x++) {
    let ok = true;
    for (let dy = 0; dy < h && ok; dy++) for (let dx = 0; dx < w && ok; dx++) ok = open(x + dx, y + dy);
    if (!ok) continue;
    any = true;
    if (rectReach(s, { x, y, w, h }, rd).d <= SERVICE_ROAD) near = true;
  }
  return [near, any];
}

export function run(p: Profile, seed: number, maxWeeks = 1000): Result {
  const rng = createRng(seed);
  const s = createGame(rng);
  const bot = new SurvivalBot(p, createRng(seed * 7919 + 13));
  const res: Result = {
    bot: p.name, seed, families0: s.start.families, foodWeeks0: s.start.foodWeeks, riverDist: riverDistance(s), won: false, lost: false, weeks: maxWeeks,
    year1: false, residents52: 0, residents104: 0, lowestResidentsY1: Infinity, famineY1: 0, famineWeeks: 0, longestFamine: 0, left: 0, leftWinter1: 0, emptied: false,
    firstHarvestWeek: null, firstFieldWeek: null, firstGranaryWeek: null, goalWeeks: GOALS.map(() => null), blocks: {}, blocksY1: {},
    food: { field: 0, fisher: 0, gatherer: 0, spoiled: 0 }, droughtYears: 0, famineAfterDrought: 0, debtLoss: false, debtY1: false, debtY2: false, debtEver: false, goalWait: 0, goalWaitIndex: -1, built: bot.stats.built, peak: 0,
    houses52: 0, famineWinters: 0, crises: 0, recoveries: 0, firstCrisisWeek: null, maxWorkshops: 0, silverIdle: 0, residentsByYear: [], blocksByYear: [], peopleByYear: [], caravanHoused: 0, caravanLeft: 0, maxGranaries: 0, levelsAtEnd: [],
    features0: s.feature.filter((f) => f).length, templeGap: null, templeRoom: null, templeNear: null, templeAny: null, clearSpent: 0, big260: 0, upkeepY3: {},
    endSilver: 0, endIncome: 0, endTempleRoom: false, endTempleAny: false,
    growthMax: NaN, growthPeak: NaN, residentsStart: computeEconomy(s).residents, couplesLeft: 0, coupleWaitMax: 0, caravansArrived: 0, caravansAll: 0, caravansSome: 0, g15: null, coupleBlocksByYear: [],
    endBands: { child: 0, adult: 0, elder: 0 }, endUnemployed: 0, deathAge: NaN, endResidents: 0, marks: {},
    mat: {
      lumbers: 0, quarries: 0, waitWeeks: { wood: 0, stone: 0 }, houseWaitMax: 0, woodBlockedY1: 0, blocked: { wood: 0, stone: 0 }, idle300: 0, unemployed200: NaN,
      stumps260: 0, stumps520: 0, cut: 0, made: { wood: 0, stone: 0 }, spentBuild: { wood: 0, stone: 0 }, spentLevel: { wood: 0, stone: 0 }, end: { wood: 0, stone: 0 },
      byYear: { wood: [], stone: [] }, templeLast: null, templeWait: NaN,
    },
    b1: { coldY1: 0, coldWeeks: 0, coldWinters: 0, woodY1: [], holdY1: 0, holdAll: 0, holdHouses: 0, endsY1: {}, idleY1: NaN, unlockWeek: {}, firstLumber: null, emptyWeek: null },
  };
  const b1 = res.b1;
  const coldYears = new Set<number>();
  const held = new Set<number>();
  const idleY1: number[] = [];
  const mat = res.mat;
  const houseWait = new Map<number, number>();
  let matRun = 0;
  let templeUnlockWeek: number | null = null;
  /** Week each temple resource last became enough (null: not enough now). */
  const enoughSince: Record<string, number | null> = { silver: null, wood: null, stone: null };
  const templeCost: Record<string, number> = { silver: costOf('temple'), ...materialsOf('temple') };
  const famineYears = new Set<number>();
  let crisisPeak: number | null = null;
  let richRun = 0;
  let run = 0;
  let dryYear = false;
  let goalSince = 0;
  const trees = () => s.feature.filter((f) => f === 'palm' || f === 'olive').length;
  while (s.week < maxWeeks) {
    const t0 = trees();
    for (const k of Object.keys(enoughSince)) {
      const have = k === 'silver' ? s.silver : s[k as Material];
      enoughSince[k] = have >= (templeCost[k] ?? 0) ? (enoughSince[k] ?? s.week) : null;
    }
    const hadTemple = s.buildings.some((b) => b.kind === 'temple');
    const before = { wood: s.wood, stone: s.stone };
    bot.act(s);
    for (const m of MATERIALS) {
      mat.spentBuild[m] += Math.max(0, before[m] - s[m]);
      if (bot.lacked[m]) mat.blocked[m]++;
    }
    if (s.week < 52 && bot.lacked.wood) mat.woodBlockedY1++;
    if (!hadTemple && s.buildings.some((b) => b.kind === 'temple')) {
      mat.templeLast = Object.keys(enoughSince).reduce((a, k) => ((enoughSince[k] ?? -1) > (enoughSince[a] ?? -1) ? k : a), 'silver');
      if (templeUnlockWeek !== null) mat.templeWait = s.week - templeUnlockWeek;
    }
    res.clearSpent += (t0 - trees()) * RULES.treeClearCost;
    const eco = computeEconomy(s);
    const block = birthBlock(s, eco) ?? 'open';
    res.blocks[block] = (res.blocks[block] ?? 0) + 1;
    if (s.week < 52) res.blocksY1[block] = (res.blocksY1[block] ?? 0) + 1;
    const by = (res.blocksByYear[Math.floor(s.week / 52)] ??= {});
    by[block] = (by[block] ?? 0) + 1;
    // Why each fertile couple living together had no child this week.
    const cb = (res.coupleBlocksByYear[Math.floor(s.week / 52)] ??= {});
    for (const m of s.people) {
      if (!fertileCouple(s, m)) continue;
      const house = s.buildings.find((b) => b.id === m.houseId);
      const young = s.people.some((c) => c.motherId === m.id && s.week - c.birthWeek < RULES.people.birthGapWeeks);
      const why = block !== 'open' ? 'city' : !house || roomIn(s, house) <= 0 ? 'full' : young ? 'gap' : 'open';
      cb[why] = (cb[why] ?? 0) + 1;
    }
    for (const c of waitingCouples(s)) res.coupleWaitMax = Math.max(res.coupleWaitMax, s.week - c.since);
    res.maxWorkshops = Math.max(res.maxWorkshops, s.buildings.filter((b) => b.kind === 'workshop').length);
    res.maxGranaries = Math.max(res.maxGranaries, s.buildings.filter((b) => b.kind === 'granary').length);
    // The year's people counts, read in its last week (they reset when the autumn begins).
    if ((s.week + 1) % 52 === 0) res.peopleByYear.push({ ...s.yearStats });
    const bonus = fieldBonus(s);
    for (const b of s.buildings) {
      if (!b.connected) continue;
      if (b.kind === 'field') res.food.field += fieldHarvest(s, b, s.week, s.drought, undefined, bonus) * eco.efficiency;
      if (b.kind === 'fisher') res.food.fisher += gatherYield(s, b) * eco.efficiency;
      if (b.kind === 'gatherer') res.food.gatherer += gatherYield(s, b) * eco.efficiency;
    }
    if (res.firstFieldWeek === null && s.buildings.some((b) => b.kind === 'field' && b.connected)) res.firstFieldWeek = s.week;
    if (res.firstGranaryWeek === null && s.buildings.some((b) => b.kind === 'granary' && b.connected)) res.firstGranaryWeek = s.week;
    const goalBefore = s.goalIndex;
    const wasDrought = s.drought;
    const mid = { wood: s.wood, stone: s.stone };
    if (s.week % 4 === 0 && s.week <= 52) b1.woodY1.push(s.wood);
    if (s.week < 52) idleY1.push(unemployed(s));
    b1.firstLumber ??= s.buildings.some((b) => b.kind === 'lumber') ? s.week : null;
    const events = stepWeek(s, rng);
    for (const k of s.unlocked) b1.unlockWeek[k] ??= s.week;
    if (s.cold) { b1.coldWeeks++; if (s.week < 52) b1.coldY1++; coldYears.add(Math.floor(s.week / 52)); b1.coldWinters = coldYears.size; }
    for (const b of s.buildings) if (b.kind === 'house' && b.firewoodHold) { b1.holdAll++; if (s.week < 52) b1.holdY1++; held.add(b.id); }
    b1.holdHouses = held.size;
    if (b1.emptyWeek === null && s.week > 0 && computeEconomy(s).residents === 0 && s.families.length === 0) b1.emptyWeek = s.week;
    for (const m of MATERIALS) {
      mat.made[m] += eco[m];
      // What the week's production does not explain went into house levels.
      mat.spentLevel[m] += Math.max(0, mid[m] + eco[m] - s[m]);
    }
    mat.cut += events.filter((e) => e.type === 'treeCut').length;
    for (const b of s.buildings) {
      if (b.kind !== 'house') continue;
      if (!b.waiting) { houseWait.delete(b.id); continue; }
      const w = (houseWait.get(b.id) ?? 0) + 1;
      houseWait.set(b.id, w);
      mat.houseWaitMax = Math.max(mat.houseWaitMax, w);
    }
    const waitingNow = housesWaiting(s);
    for (const m of MATERIALS) if (waitingNow[m] > 0) mat.waitWeeks[m]++;
    mat.lumbers = Math.max(mat.lumbers, s.buildings.filter((b) => b.kind === 'lumber').length);
    mat.quarries = Math.max(mat.quarries, s.buildings.filter((b) => b.kind === 'quarry').length);
    if (templeUnlockWeek === null && s.unlocked.includes('temple')) templeUnlockWeek = s.week;
    matRun = (s.wood > 300 || s.stone > 300) && !s.unlocked.includes('temple') ? matRun + 1 : 0;
    mat.idle300 = Math.max(mat.idle300, matRun);
    if (s.week === 200) mat.unemployed200 = unemployed(s);
    if (s.week === 260) mat.stumps260 = s.stumps.length;
    if (s.week === 520) mat.stumps520 = s.stumps.length;
    if (s.week % 52 === 0) for (const m of MATERIALS) mat.byYear[m].push(s[m]);
    if (s.drought && !wasDrought) { res.droughtYears++; dryYear = true; }
    if (seasonOf(s.week) === 'autumn' && s.week % RULES.weeksPerSeason === 0) dryYear = false;
    for (let g = goalBefore; g < s.goalIndex; g++) res.goalWeeks[g] = s.week;
    if (res.templeRoom === null && s.unlocked.includes('temple')) {
      res.templeGap = templeSpotsNear(s).length > 0;
      res.templeRoom = templeSpots(s).length > 0;
      [res.templeNear, res.templeAny] = templeRoomLoose(s);
    }
    if (s.week === 260) res.big260 = s.buildings.filter((b) => b.kind === 'house' && b.level === 4).length;
    if (s.week === 156) for (const b of s.buildings) { const u = statOf(b, 'upkeep'); if (u) res.upkeepY3[b.kind] = (res.upkeepY3[b.kind] ?? 0) + u; }
    if (s.goalIndex > goalBefore) goalSince = s.week;
    if (s.goalIndex < GOALS.length && s.week - goalSince > res.goalWait) { res.goalWait = s.week - goalSince; res.goalWaitIndex = s.goalIndex; }
    if (s.silver < 0) { res.debtEver = true; if (s.week <= 52) res.debtY1 = true; else if (s.week <= 104) res.debtY2 = true; }
    res.food.spoiled += s.spoiled;
    res.couplesLeft += events.filter((e) => e.type === 'coupleLeft').length;
    for (const e of events) if (e.type === 'caravanArrived') {
      res.caravansArrived++;
      if (e.left === 0 && e.housed > 0) res.caravansAll++;
      if (e.housed > 0) res.caravansSome++;
    }
    if (seasonOf(s.week) === 'winter') {
      const year = Math.floor(s.week / 52);
      const lived = s.buildings.filter((b) => b.kind === 'house' && b.connected && b.level > 0).length;
      if (lived >= 15 && (!res.g15 || res.g15.year === year)) {
        const granaries = s.buildings.filter((b) => b.kind === 'granary' && b.connected).length;
        res.g15 = { year, granaries: Math.max(granaries, res.g15?.granaries ?? 0), capacity: Math.max(foodCapacity(s), res.g15?.capacity ?? 0), famine: s.famine || !!res.g15?.famine };
      }
    }
    // Tents left in famine (a tent cut off from the road leaves too, but that is the bot's own doing).
    const lefts = events.filter((e) => e.type === 'familyLeft' && e.reason === 'famine').length;
    res.left += lefts;
    if (s.week <= 26) res.leftWinter1 += lefts;
    const resid = computeEconomy(s).residents;
    // Crisis: well below the peak so far, or a long famine; recovered once back at that peak.
    if (crisisPeak === null && res.peak >= 10 && (resid <= 0.75 * res.peak || (s.famine && run + 1 >= 4))) {
      crisisPeak = res.peak;
      res.crises++;
      res.firstCrisisWeek ??= s.week;
    } else if (crisisPeak !== null && resid >= crisisPeak) {
      crisisPeak = null;
      res.recoveries++;
    }
    res.peak = Math.max(res.peak, resid);
    for (let n = 10; n <= Math.min(200, resid); n += 5) res.marks[`res${n}`] ??= s.week;
    for (const l of [2, 3, 4]) {
      const k = s.buildings.filter((b) => b.kind === 'house' && b.level >= l).length;
      for (let n = 1; n <= Math.min(10, k); n++) res.marks[`h${l}x${n}`] ??= s.week;
    }
    richRun = s.silver > 300 && !s.unlocked.includes('temple') ? richRun + 1 : 0;
    res.silverIdle = Math.max(res.silverIdle, richRun);
    if (s.famine && seasonOf(s.week) === 'winter') famineYears.add(Math.floor(s.week / 52));
    res.famineWinters = famineYears.size;
    if (s.week % 52 === 0) res.residentsByYear.push(resid);
    if (s.week <= 52) res.lowestResidentsY1 = Math.min(res.lowestResidentsY1, resid);
    if (resid === 0 && s.families.length === 0) res.emptied = true;
    if (s.week === 52) {
      res.residents52 = resid;
      res.year1 = !s.lost && resid > 0;
      res.houses52 = s.buildings.filter((b) => b.kind === 'house' && b.connected && b.level > 0).length;
    }
    if (s.week === 104) res.residents104 = resid;
    if (res.firstHarvestWeek === null && eco.harvest > 0) res.firstHarvestWeek = s.week;
    if (s.famine) {
      res.famineWeeks++;
      if (s.week <= 52) res.famineY1++;
      if (dryYear) res.famineAfterDrought++;
      run++;
      res.longestFamine = Math.max(res.longestFamine, run);
    } else run = 0;
    if (s.won) { res.won = true; res.weeks = s.week; if (s.week < 52) res.year1 = true; break; }
    if (s.lost) { res.lost = true; res.debtLoss = true; res.weeks = s.week; break; }
  }
  res.endSilver = s.silver;
  res.endIncome = computeEconomy(s).silverDelta;
  res.endTempleRoom = templeSpots(s).length > 0;
  res.endTempleAny = templeRoomLoose(s)[1];
  res.caravanHoused = s.caravans.reduce((a, c) => a + c.housed, 0);
  res.caravanLeft = s.caravans.reduce((a, c) => a + c.left, 0);
  res.levelsAtEnd = [1, 2, 3, 4].map((l) => s.buildings.filter((b) => b.kind === 'house' && b.level === l).length);
  // A4: growth of each completed year over the one before, from year 2 on.
  const ry = res.residentsByYear;
  const start = res.residentsStart;
  for (let y = 1; y < ry.length; y++) if (ry[y - 1] > 0) res.growthMax = Math.max(Number.isNaN(res.growthMax) ? 0 : res.growthMax, ry[y] / ry[y - 1]);
  for (let y = 1; y < ry.length; y++) {
    const best = Math.max(start, ...ry.slice(0, y));
    if (best > 0) res.growthPeak = Math.max(Number.isNaN(res.growthPeak) ? 0 : res.growthPeak, ry[y] / best);
  }
  res.mat.end = { wood: s.wood, stone: s.stone };
  res.endBands = bandCounts(s);
  res.endUnemployed = unemployed(s);
  const ages = s.departed.filter((p) => p.end?.cause === 'age').map((p) => ageOf(p, p.end!.week)).sort((a, b) => a - b);
  res.deathAge = ages.length ? ages[Math.floor((ages.length - 1) / 2)] : NaN;
  res.endResidents = computeEconomy(s).residents;
  for (const p of s.departed) if (p.end && p.end.week < 52) b1.endsY1[p.end.cause] = (b1.endsY1[p.end.cause] ?? 0) + 1;
  { const a = [...idleY1].sort((x, y) => x - y); b1.idleY1 = a.length ? a[Math.floor((a.length - 1) / 2)] : NaN; }
  for (const [id, w] of Object.entries(s.milestoneWeeks)) res.marks[id] = w as number;
  return res;
}

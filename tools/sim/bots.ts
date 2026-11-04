/**
 * Automatic players for the headless simulation. They only use the public core API (place,
 * clearCell, computeEconomy, needMet...) and read costs from the data, so a balance or rule
 * change in src/core / src/data is picked up without touching the bots.
 *
 * One bot = one BotProfile (pure numbers/flags) + the shared decision code below.
 */
import {
  BUILDINGS,
  HOUSE_LEVELS,
  RULES,
  WEEKS_PER_YEAR,
  costOf,
  clearCell,
  computeEconomy,
  currentGoal,
  hasNeeds,
  dimsOf,
  goalProgress,
  inBounds,
  indexOf,
  isFreeLand,
  needMet,
  neighbors,
  place,
  templeSpots,
  touchesNetwork,
  unemployed,
  unemploymentAlert,
  type BuildableKind,
  type BuildingKind,
  type Building,
  type Cell,
  type GameState,
  type Rect,
  type Rng,
} from '../../src/core';

export interface BotProfile {
  name: string;
  /** Max actions (one tool gesture: a road stroke, a house drag or one placement) per week. */
  actionsPerWeek: number;
  /** Chance of doing nothing at all in a week (distraction). */
  idleChance: number;
  /** Weeks a problem must last before the bot reacts to it. */
  reactDelay: number;
  /** Food is noticed only during famine (otherwise: when the weekly balance is negative). */
  foodOnlyInFamine: boolean;
  /** Plans food ahead: keeps the weekly food balance above 1 + foodMarginPerResident x residents. */
  foodPlanning: boolean;
  foodMarginPerResident: number;
  /** Unemployed workers that make the bot build a workshop (Infinity = only the alert / goal). */
  workshopAt: number;
  /** Reacts to the on-screen unemployment alert (after reactDelay + alertExtraDelay weeks). */
  alertExtraDelay: number;
  /** Empty plots kept waiting for families. */
  plotsAhead: number;
  /** Houses placed per house drag. */
  housesPerAction: number;
  /** Puts houses only where a well already reaches (placing a well first). */
  planServices: boolean;
  /** A well or market must reach at least this many houses that miss it. */
  minServiceTargets: number;
  /** Spot score weights for houses. */
  wSacred: number;
  wWell: number;
  wMarket: number;
  /** Random term added to every spot score (0 = always the best spot). */
  noise: number;
  /** Chance per week of building an unneeded well or market. */
  extraServiceChance: number;
  /** Keeps a 6x6 lot next to a planned road free for the temple from the start. */
  reserveTemple: boolean;
  /**
   * While the temple is unlocked but not built: 'roi' = only things that pay back (houses,
   * workshops, food), 'strict' = only emergencies (food), 'none' = keeps spending as before.
   */
  templeSaving: 'roi' | 'strict' | 'none';
  /** Respects the planned street grid (does not build on future road cells). */
  followsPlan: boolean;
  /** Keeps fields, wells, markets and workshops out of the altar/temple radius when it can. */
  keepSacredForHouses: boolean;
  /** Weeks stuck on the same goal before demolishing a non-house in the sacred radius to make room. */
  fixStuckAfter: number;
  /** Never spends below this silver, except for food during famine. */
  reserveSilver: number;
  /** Weeks of negative weekly balance (orange silver) before cutting upkeep (Infinity = never notices). */
  deficitDelay: number;
  /** Weeks in debt (red silver and alert) before cutting upkeep. */
  debtDelay: number;
  /** Chance per week of actually cutting once noticed (1 = always). */
  trimChance: number;
  /**
   * Looks at the +X/week before building something with upkeep: builds into a deficit only if the
   * silver left covers it for this many weeks (0 = does not look; food emergencies aside).
   */
  runwayWeeks: number;
}

export const BOTS: Record<string, BotProfile> = {
  eficiente: {
    name: 'eficiente',
    actionsPerWeek: 2,
    idleChance: 0,
    reactDelay: 0,
    foodOnlyInFamine: false,
    foodPlanning: true,
    foodMarginPerResident: 0.02,
    workshopAt: 3,
    alertExtraDelay: 0,
    plotsAhead: 6,
    housesPerAction: 3,
    planServices: true,
    minServiceTargets: 2,
    wSacred: 6,
    wWell: 4,
    wMarket: 3,
    noise: 0.2,
    extraServiceChance: 0,
    reserveTemple: true,
    templeSaving: 'roi',
    followsPlan: true,
    keepSacredForHouses: true,
    fixStuckAfter: 12,
    reserveSilver: 0,
    deficitDelay: 0,
    debtDelay: 0,
    trimChance: 1,
    runwayWeeks: 24,
  },
  comum: {
    name: 'comum',
    actionsPerWeek: 2,
    idleChance: 0.1,
    reactDelay: 3,
    foodOnlyInFamine: false,
    foodPlanning: false,
    foodMarginPerResident: 0,
    workshopAt: Infinity,
    alertExtraDelay: 0,
    plotsAhead: 4,
    housesPerAction: 3,
    planServices: false,
    minServiceTargets: 1,
    wSacred: 2,
    wWell: 2,
    wMarket: 1,
    noise: 1.5,
    extraServiceChance: 0.06,
    reserveTemple: false,
    templeSaving: 'strict',
    followsPlan: true,
    keepSacredForHouses: false,
    fixStuckAfter: 24,
    reserveSilver: 0,
    deficitDelay: 6,
    debtDelay: 3,
    trimChance: 0.5,
    runwayWeeks: 0,
  },
  distraido: {
    name: 'distraido',
    actionsPerWeek: 2,
    idleChance: 0.3,
    reactDelay: 2,
    foodOnlyInFamine: true,
    foodPlanning: false,
    foodMarginPerResident: 0,
    workshopAt: Infinity,
    alertExtraDelay: 8,
    plotsAhead: 5,
    housesPerAction: 4,
    planServices: false,
    minServiceTargets: 1,
    wSacred: 0.5,
    wWell: 0.5,
    wMarket: 0.5,
    noise: 4,
    extraServiceChance: 0.12,
    reserveTemple: false,
    templeSaving: 'none',
    followsPlan: false,
    keepSacredForHouses: false,
    fixStuckAfter: 48,
    reserveSilver: 0,
    deficitDelay: Infinity,
    debtDelay: 8,
    trimChance: 0.2,
    runwayWeeks: 0,
  },
};

// ---------------------------------------------------------------- geometry helpers

/** Planned street grid: every 5th row and column, aligned with the ring around the altar. */
const GRID_STEP = 5;
const isGridLine = (v: number, altarRing: number) => (((v - altarRing) % GRID_STEP) + GRID_STEP) % GRID_STEP === 0;

/** Chebyshev distance between two rectangles (0 when touching or overlapping). */
export const rectDist = (a: Rect, b: Rect) =>
  Math.max(0, a.x - (b.x + b.w - 1), b.x - (a.x + a.w - 1), a.y - (b.y + b.h - 1), b.y - (a.y + a.h - 1));

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inRect = (r: Rect, x: number, y: number) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

// ---------------------------------------------------------------- bot

type Problem = 'food' | 'famine' | 'jobs' | 'alert' | 'well' | 'market' | 'goalWorkshop' | 'deficit' | 'debt';

export interface BotStats {
  actions: number;
  /** Weeks where the bot wanted to act but had nothing useful and affordable to do. */
  deadWeeks: number;
  spent: Record<string, number>;
  demolished?: number;
  /** Demolitions made to cut upkeep. */
  trimmed?: number;
}

export class Bot {
  readonly p: BotProfile;
  private rng: Rng;
  private streak: Record<Problem, number> = { food: 0, famine: 0, jobs: 0, alert: 0, well: 0, market: 0, goalWorkshop: 0, deficit: 0, debt: 0 };
  private goalSeen = -1;
  private goalSince = 0;
  private reserved: Rect | null = null;
  private altar: Building;
  private ringX: number;
  private ringY: number;
  stats: BotStats = { actions: 0, deadWeeks: 0, spent: {} };
  /** Last week's outcome: 'acted', 'idle' (chose to idle), 'dead' (nothing to do) or 'saving'. */
  lastWeek: 'acted' | 'idle' | 'dead' | 'saving' = 'idle';

  constructor(s: GameState, profile: BotProfile, rng: Rng) {
    this.p = profile;
    this.rng = rng;
    this.altar = s.buildings.find((b) => b.kind === 'altar')!;
    this.ringX = this.altar.x - 1;
    this.ringY = this.altar.y - 1;
    if (profile.reserveTemple) this.reserved = this.pickTempleLot(s);
  }

  // ------------------------------------------------------------ perception

  private plannedRoad(x: number, y: number) {
    if (this.reserved && inRect(this.reserved, x, y)) return false;
    return isGridLine(x, this.ringX) || isGridLine(y, this.ringY);
  }

  private houses(s: GameState) {
    return s.buildings.filter((b) => b.kind === 'house');
  }

  private uncovered(s: GameState, need: 'well' | 'market', minLevel: number) {
    return this.houses(s).filter((b) => b.connected && b.level >= minLevel && !needMet(s, b, need));
  }

  private updateStreaks(s: GameState) {
    if (s.goalIndex !== this.goalSeen) [this.goalSeen, this.goalSince] = [s.goalIndex, s.week];
    const eco = computeEconomy(s);
    const goal = currentGoal(s);
    const bump = (k: Problem, on: boolean) => (this.streak[k] = on ? this.streak[k] + 1 : 0);
    const margin = this.p.foodPlanning ? 1 + this.p.foodMarginPerResident * eco.residents : 0;
    bump('famine', s.famine);
    bump('food', this.p.foodPlanning ? eco.foodDelta < margin : eco.foodDelta < 0);
    bump('jobs', s.unlocked.includes('workshop') && unemployed(s) >= this.p.workshopAt);
    bump('alert', unemploymentAlert(s) > 0);
    bump('well', this.uncovered(s, 'well', 1).length > 0);
    bump('market', s.unlocked.includes('market') && this.uncovered(s, 'market', 2).length > 0);
    bump('goalWorkshop', goal?.type === 'build' && goal.kind === 'workshop');
    bump('deficit', eco.silverDelta < 0);
    bump('debt', s.silver < 0);
  }

  private noticed(k: Problem, extra = 0) {
    return this.streak[k] > this.p.reactDelay + extra;
  }

  private wantsFood(s: GameState) {
    const eco = computeEconomy(s);
    if (this.noticed('famine')) return true;
    if (this.p.foodOnlyInFamine) return false;
    if (!this.p.foodPlanning) return s.food <= 40 || eco.foodDelta <= -1 ? this.noticed('food') : false;
    // Planner: only when another field really adds food (enough workers) and the stock is not plenty.
    if (!this.noticed('food') || s.food / Math.max(0.1, -eco.foodDelta) > 24) return false;
    return this.fieldGain(s) >= 1;
  }

  /** Food per week gained by one more connected field, with the current workers. */
  private fieldGain(s: GameState) {
    const eco = computeEconomy(s);
    const fields = s.buildings.filter((b) => b.kind === 'field' && b.connected).length;
    const perField = (BUILDINGS.field.harvest ?? 0) / WEEKS_PER_YEAR; // the spring harvest spread over the year
    const eff = (jobs: number) => (jobs === 0 ? 1 : Math.min(1, eco.workers / jobs));
    const jobs = BUILDINGS.field.jobs;
    return (fields + 1) * perField * eff(eco.jobs + jobs) - fields * perField * eco.efficiency;
  }

  // ------------------------------------------------------------ spots

  /** Free top-left cells for a building that would be connected to the network. */
  private spots(s: GameState, kind: BuildableKind, rotated = false): Rect[] {
    const { w, h } = dimsOf(kind, rotated);
    const out: Rect[] = [];
    for (let y = 0; y + h <= s.rows; y++) {
      for (let x = 0; x + w <= s.cols; x++) {
        const r = { x, y, w, h };
        if (this.reserved && kind !== 'temple' && overlaps(r, this.reserved)) continue;
        let ok = true;
        for (let dy = 0; dy < h && ok; dy++) {
          for (let dx = 0; dx < w && ok; dx++) {
            const cx = x + dx;
            const cy = y + dy;
            if (!isFreeLand(s, cx, cy) || (this.p.followsPlan && this.plannedRoad(cx, cy))) ok = false;
          }
        }
        if (ok && touchesNetwork(s, r)) out.push(r);
      }
    }
    return out;
  }

  private spotsAnyRotation(s: GameState, kind: BuildableKind) {
    const a = this.spots(s, kind).map((r) => ({ r, rotated: false }));
    if (dimsOf(kind).w === dimsOf(kind).h) return a;
    return a.concat(this.spots(s, kind, true).map((r) => ({ r, rotated: true })));
  }

  private altarDist(r: Rect) {
    return rectDist(r, this.altar);
  }

  private covers(service: BuildingKind, at: Rect, target: Rect) {
    return rectDist(at, target) <= (BUILDINGS[service].radius ?? 0);
  }

  private sacredAt(s: GameState, r: Rect) {
    return s.buildings.some((b) => (b.kind === 'altar' || b.kind === 'temple') && b.connected && this.covers(b.kind, b, r));
  }

  private serviceAt(s: GameState, kind: 'well' | 'market', r: Rect) {
    return s.buildings.some((b) => b.kind === kind && b.connected && this.covers(kind, b, r));
  }

  // ------------------------------------------------------------ spending

  private canAfford(s: GameState, cost: number, emergency = false) {
    // A planner also keeps this week's deficit in hand, so the silver never ends the week below 0.
    const deficit = this.p.runwayWeeks > 0 ? Math.max(0, -computeEconomy(s).silverDelta) : 0;
    return s.silver - cost - deficit >= (emergency ? 0 : this.p.reserveSilver);
  }

  private spend(kind: string, cost: number) {
    this.stats.spent[kind] = (this.stats.spent[kind] ?? 0) + cost;
  }

  private build(s: GameState, kind: BuildableKind, r: Rect, rotated = false, emergency = false) {
    if (this.p.runwayWeeks > 0 && !emergency && this.shortRunway(s, kind)) return false;
    const before = s.silver;
    const res = place(s, kind, r.x, r.y, rotated);
    if (res.ok) this.spend(kind, before - s.silver);
    return res.ok;
  }

  /** True if the building's upkeep would leave a deficit the remaining silver cannot carry for runwayWeeks. */
  private shortRunway(s: GameState, kind: BuildableKind) {
    const upkeep = BUILDINGS[kind].upkeep ?? 0;
    const balance = computeEconomy(s).silverDelta - upkeep;
    return upkeep > 0 && balance < 0 && s.silver - costOf(kind) < -balance * this.p.runwayWeeks;
  }

  /**
   * Balance and food once every house (empty plots included: a family will come) settled at the
   * highest level its needs allow (read from the data; measured on a copy of the state),
   * optionally after removing building b.
   */
  private settled(s: GameState, b?: Building) {
    const copy = structuredClone(s);
    if (b) clearCell(copy, b.x, b.y);
    for (const h of copy.buildings) {
      if (h.kind !== 'house' || !h.connected) continue;
      h.level = 1;
      while (h.level + 1 < HOUSE_LEVELS.length && hasNeeds(copy, h, HOUSE_LEVELS[h.level + 1].needs)) h.level++;
    }
    return computeEconomy(copy);
  }

  /** Demolishes the upkeep building whose removal improves the weekly balance the most without starving the city. */
  private trimUpkeep(s: GameState): boolean {
    const eco = this.settled(s);
    let best: Building | null = null;
    let bestGain = 0;
    for (const b of s.buildings) {
      if (!BUILDINGS[b.kind].upkeep || BUILDINGS[b.kind].protected) continue;
      const after = this.settled(s, b);
      if (after.foodDelta < Math.min(0, eco.foodDelta)) continue;
      const gain = after.silverDelta - eco.silverDelta;
      if (gain > bestGain) [best, bestGain] = [b, gain];
    }
    if (!best) return false;
    this.stats.demolished = (this.stats.demolished ?? 0) + 1;
    this.stats.trimmed = (this.stats.trimmed ?? 0) + 1;
    return clearCell(s, best.x, best.y).ok;
  }

  /** Short of silver: the balance is negative (or the city is in debt) and the bot has noticed it. */
  private wantsTrim(s: GameState) {
    const eco = computeEconomy(s);
    // A planner cuts only when the silver would not carry the deficit for its runway.
    const short = this.p.runwayWeeks === 0 || s.silver + eco.silverDelta * this.p.runwayWeeks < 0;
    const deficit = eco.silverDelta < 0 && this.streak.deficit > this.p.deficitDelay && short;
    // In debt, a positive balance that cannot pay it back in the weeks left still needs cuts.
    const left = RULES.debtWeeksToLose - s.debtWeeks;
    const debt = this.streak.debt > this.p.debtDelay && s.silver + eco.silverDelta * left < 0;
    return (deficit || debt) && this.rng() < this.p.trimChance;
  }

  // ------------------------------------------------------------ actions (each returns true if it acted)

  /** Non-house spots, outside the sacred radius when the bot keeps it for houses and has a choice. */
  private serviceSpots<T extends { r: Rect } | Rect>(s: GameState, spots: T[]): T[] {
    if (!this.p.keepSacredForHouses) return spots;
    const out = spots.filter((x) => !this.sacredAt(s, 'r' in x ? x.r : x));
    return out.length ? out : spots;
  }

  /**
   * Stuck on the big-house goal: first brings a missing well or market to the sacred houses, then
   * (no usable free sacred plot) demolishes a field or workshop near them to make room, then a small
   * house next to them. Tries again a few weeks after each fix.
   */
  private fixStuck(s: GameState): boolean {
    const goal = currentGoal(s);
    const top = HOUSE_LEVELS.length - 1;
    if (!goal || goal.type !== 'houses' || (goal.level ?? 0) < top) return false;
    if (s.week - this.goalSince < this.p.fixStuckAfter) return false;
    const targets = this.houses(s).filter((h) => h.connected && h.level < top && this.sacredAt(s, h));
    for (const need of ['well', 'market'] as const) {
      const missing = targets.filter((h) => s.unlocked.includes(need) && !needMet(s, h, need));
      if (missing.length && this.buildService(s, need, missing, 0)) return true;
    }
    const usable = (r: Rect) => this.sacredAt(s, r) && this.serviceAt(s, 'well', r) && (!s.unlocked.includes('market') || this.serviceAt(s, 'market', r));
    if (this.spots(s, 'house').some(usable)) return false;
    const near = (b: Building) => this.sacredAt(s, b) || targets.some((h) => this.covers('market', b, h));
    const order = ['field', 'workshop', 'house'];
    const victims = s.buildings
      .filter((b) => order.includes(b.kind) && near(b) && !(b.kind === 'house' && (b.level >= 2 || this.sacredAt(s, b))))
      .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || this.altarDist(a) - this.altarDist(b));
    if (!victims.length) return false;
    this.goalSince = s.week - this.p.fixStuckAfter + 3;
    this.stats.demolished = (this.stats.demolished ?? 0) + 1;
    return clearCell(s, victims[0].x, victims[0].y).ok;
  }

  private buildField(s: GameState, emergency: boolean) {
    if (!this.canAfford(s, costOf('field'), emergency)) return false;
    const spots = this.serviceSpots(s, this.spots(s, 'field'));
    if (!spots.length) return this.expandRoads(s);
    // Fields go away from the altar: its radius is for houses.
    const best = this.pick(spots, (r) => Math.min(this.altarDist(r), 10) * 0.5);
    return this.build(s, 'field', best, false, emergency);
  }

  private buildWorkshop(s: GameState) {
    if (!s.unlocked.includes('workshop') || !this.canAfford(s, costOf('workshop'))) return false;
    const spots = this.serviceSpots(s, this.spots(s, 'workshop'));
    if (!spots.length) return this.expandRoads(s);
    const best = this.pick(spots, (r) => Math.min(this.altarDist(r), 10) * 0.5);
    return this.build(s, 'workshop', best);
  }

  /** Well or market where it reaches the most houses that miss it (sacred-area houses count more). */
  private buildService(s: GameState, kind: 'well' | 'market', targets: Building[], plotsWeight: number) {
    if (!s.unlocked.includes(kind) || !this.canAfford(s, costOf(kind))) return false;
    const cands = this.serviceSpots(s, this.spotsAnyRotation(s, kind));
    if (!cands.length) return this.expandRoads(s);
    const plots = plotsWeight > 0 ? this.spots(s, 'house') : [];
    const reach = (r: Rect) => targets.filter((t) => this.covers(kind, r, t)).length;
    const score = (r: Rect) => {
      let v = 0;
      for (const t of targets) if (this.covers(kind, r, t)) v += 1 + (this.sacredAt(s, t) ? 1 : 0);
      for (const pl of plots) if (!this.serviceAt(s, kind, pl) && this.covers(kind, r, pl)) v += plotsWeight;
      return v;
    };
    let best = cands[0];
    let bestV = -Infinity;
    for (const c of cands) {
      const v = score(c.r) + this.rng() * this.p.noise;
      if (v > bestV) [best, bestV] = [c, v];
    }
    if (targets.length && reach(best.r) < Math.min(this.p.minServiceTargets, targets.length)) return false;
    return this.build(s, kind, best.r, best.rotated);
  }

  private buildHouses(s: GameState) {
    const cost = costOf('house');
    if (!this.canAfford(s, cost)) return false;
    let spots = this.spots(s, 'house');
    if (!spots.length) return this.expandRoads(s);
    if (this.p.planServices && s.unlocked.includes('well')) {
      const watered = spots.filter((r) => this.serviceAt(s, 'well', r));
      if (!watered.length) return this.buildService(s, 'well', [], 1) || this.expandRoads(s);
      spots = watered;
      // With the market open, new houses go where a market reaches (placing one first).
      if (s.unlocked.includes('market')) {
        const traded = spots.filter((r) => this.serviceAt(s, 'market', r));
        if (traded.length) spots = traded;
        else if (this.canAfford(s, costOf('market') + cost)) return this.buildService(s, 'market', [], 1);
      }
    }
    const goal = currentGoal(s);
    const sacredBoost = goal?.type === 'houses' && (goal.level ?? 0) >= HOUSE_LEVELS.length - 1 ? 4 : 0;
    const score = (r: Rect) =>
      (this.sacredAt(s, r) ? this.p.wSacred + sacredBoost : 0) +
      (this.serviceAt(s, 'well', r) ? this.p.wWell : 0) +
      (this.serviceAt(s, 'market', r) ? this.p.wMarket : 0) -
      this.altarDist(r) * 0.1;
    const ranked = spots.map((r) => ({ r, v: score(r) + this.rng() * this.p.noise })).sort((a, b) => b.v - a.v);
    let placed = 0;
    for (const { r } of ranked) {
      if (placed >= this.p.housesPerAction || !this.canAfford(s, cost)) break;
      if (this.build(s, 'house', r)) placed++;
    }
    return placed > 0;
  }

  /** One road stroke along the planned grid (or a random direction when not following the plan). */
  private expandRoads(s: GameState): boolean {
    const roadCost = costOf('road');
    if (!this.canAfford(s, roadCost * 3)) return false;
    const starts: { c: Cell; d: Cell; v: number }[] = [];
    const center = this.altar;
    for (let y = 0; y < s.rows; y++) {
      for (let x = 0; x < s.cols; x++) {
        const i = indexOf(s, x, y);
        if (s.roads[i] || !this.passable(s, x, y)) continue;
        if (this.p.followsPlan && !this.plannedRoad(x, y)) continue;
        if (this.reserved && inRect(this.reserved, x, y)) continue;
        for (const n of neighbors(s, x, y)) {
          if (!s.network[indexOf(s, n.x, n.y)] || !s.roads[indexOf(s, n.x, n.y)]) continue;
          const d = { x: x - n.x, y: y - n.y };
          const v = -rectDist({ x, y, w: 1, h: 1 }, center) + this.rng() * (this.p.noise + 0.5);
          starts.push({ c: { x, y }, d, v });
        }
      }
    }
    if (!starts.length) return false;
    starts.sort((a, b) => b.v - a.v);
    const { c, d } = starts[0];
    let built = 0;
    for (let k = 0; k < GRID_STEP + 1; k++) {
      const x = c.x + d.x * k;
      const y = c.y + d.y * k;
      if (!inBounds(s, x, y) || s.roads[indexOf(s, x, y)] || !this.passable(s, x, y)) break;
      if (this.p.followsPlan && !this.plannedRoad(x, y)) break;
      if (!this.canAfford(s, roadCost + (s.feature[indexOf(s, x, y)] ? RULES.treeClearCost : 0))) break;
      if (s.feature[indexOf(s, x, y)]) {
        const before = s.silver;
        if (!clearCell(s, x, y).ok) break;
        this.spend('clear', before - s.silver);
      }
      const before = s.silver;
      if (!place(s, 'road', x, y).ok) break;
      this.spend('road', before - s.silver);
      built++;
    }
    return built > 0;
  }

  /** Free land, or a tree that can be cut. */
  private passable(s: GameState, x: number, y: number) {
    const i = indexOf(s, x, y);
    if (isFreeLand(s, x, y)) return true;
    return !s.grid[i] && !s.roads[i] && s.ground[i] !== 'river' && (s.feature[i] === 'palm' || s.feature[i] === 'olive');
  }

  private pick(spots: Rect[], score: (r: Rect) => number) {
    let best = spots[0];
    let bestV = -Infinity;
    for (const r of spots) {
      const v = score(r) + this.rng() * this.p.noise;
      if (v > bestV) [best, bestV] = [r, v];
    }
    return best;
  }

  /** 6x6 lot near the altar (outside its radius) touching a planned road. */
  private pickTempleLot(s: GameState): Rect | null {
    const { w, h } = dimsOf('temple');
    let best: Rect | null = null;
    let bestD = Infinity;
    for (let y = 0; y + h <= s.rows; y++) {
      for (let x = 0; x + w <= s.cols; x++) {
        const r = { x, y, w, h };
        const d = this.altarDist(r);
        if (d < (BUILDINGS.altar.radius ?? 0) + 1 || d >= bestD) continue;
        let free = true;
        for (let dy = 0; dy < h && free; dy++) for (let dx = 0; dx < w && free; dx++) free = isFreeLand(s, x + dx, y + dy);
        if (!free) continue;
        this.reserved = r;
        const border = [] as Cell[];
        for (let k = 0; k < w; k++) border.push({ x: x + k, y: y - 1 }, { x: x + k, y: y + h });
        for (let k = 0; k < h; k++) border.push({ x: x - 1, y: y + k }, { x: x + w, y: y + k });
        const touchesPlan = border.some((c) => inBounds(s, c.x, c.y) && (this.plannedRoad(c.x, c.y) || s.roads[indexOf(s, c.x, c.y)]));
        this.reserved = null;
        if (touchesPlan) [best, bestD] = [r, d];
      }
    }
    return best;
  }

  /** Builds the temple, or a road toward the closest free 6x6 lot when no spot exists. */
  private buildTemple(s: GameState): boolean {
    if (!s.unlocked.includes('temple')) return false;
    const spots = templeSpots(s);
    if (spots.length) {
      if (!this.canAfford(s, costOf('temple'))) return false;
      const reserved = this.reserved;
      const best = reserved && spots.some((c) => c.x === reserved.x && c.y === reserved.y)
        ? reserved
        : this.pick(spots.map((c) => ({ ...c, ...dimsOf('temple') })), (r) => -this.altarDist(r));
      return this.build(s, 'temple', best);
    }
    return this.roadToFreeLot(s);
  }

  /**
   * Makes room for the temple, one gesture per call: cuts the trees of a 6x6 lot that already touches
   * the network, or lays a road stroke (up to 8 cells, cutting trees on the way) toward the nearest
   * lot that has no rock, building or road (trees allowed, fewest first).
   */
  private roadToFreeLot(s: GameState): boolean {
    const STROKE = 8;
    const { w, h } = dimsOf('temple');
    const treesIn = (r: Rect) => {
      let n = 0;
      for (let dy = 0; dy < r.h; dy++) for (let dx = 0; dx < r.w; dx++) {
        if (!this.passable(s, r.x + dx, r.y + dy)) return Infinity;
        if (s.feature[indexOf(s, r.x + dx, r.y + dy)]) n++;
      }
      return n;
    };
    let lots: { r: Rect; trees: number }[] = [];
    if (this.reserved) lots.push({ r: this.reserved, trees: treesIn(this.reserved) });
    else for (let y = 0; y + h <= s.rows; y++) for (let x = 0; x + w <= s.cols; x++) {
      const r = { x, y, w, h };
      const trees = treesIn(r);
      if (trees < Infinity) lots.push({ r, trees });
    }
    lots = lots.filter((l) => l.trees < Infinity);
    if (!lots.length) return false;
    const fewest = Math.min(...lots.map((l) => l.trees));
    lots = lots.filter((l) => l.trees <= fewest + 2);

    const touching = lots.filter((l) => touchesNetwork(s, l.r)).sort((a, b) => a.trees - b.trees);
    if (touching.length) {
      let cut = 0;
      const r = touching[0].r;
      for (let dy = 0; dy < r.h && cut < STROKE; dy++) for (let dx = 0; dx < r.w && cut < STROKE; dx++) {
        if (!s.feature[indexOf(s, r.x + dx, r.y + dy)] || !this.canAfford(s, RULES.treeClearCost)) continue;
        const before = s.silver;
        if (clearCell(s, r.x + dx, r.y + dy).ok) {
          this.spend('clear', before - s.silver);
          cut++;
        }
      }
      return cut > 0;
    }

    // BFS from connected road cells over free land or trees toward any lot border.
    const lotCells = new Set<number>();
    const goal = new Set<number>();
    for (const { r } of lots) {
      for (let dy = 0; dy < r.h; dy++) for (let dx = 0; dx < r.w; dx++) lotCells.add(indexOf(s, r.x + dx, r.y + dy));
      const border: Cell[] = [];
      for (let k = 0; k < r.w; k++) border.push({ x: r.x + k, y: r.y - 1 }, { x: r.x + k, y: r.y + r.h });
      for (let k = 0; k < r.h; k++) border.push({ x: r.x - 1, y: r.y + k }, { x: r.x + r.w, y: r.y + k });
      for (const c of border) if (inBounds(s, c.x, c.y)) goal.add(indexOf(s, c.x, c.y));
    }
    const prev = new Map<number, number>();
    const queue: number[] = [];
    s.network.forEach((on, i) => {
      if (on && s.roads[i]) {
        prev.set(i, -1);
        queue.push(i);
      }
    });
    let found = -1;
    for (let q = 0; q < queue.length && found < 0; q++) {
      const i = queue[q];
      if (goal.has(i) && !s.roads[i]) {
        found = i;
        break;
      }
      for (const n of neighbors(s, i % s.cols, Math.floor(i / s.cols))) {
        const j = indexOf(s, n.x, n.y);
        if (prev.has(j) || lotCells.has(j) || !this.passable(s, n.x, n.y)) continue;
        prev.set(j, i);
        queue.push(j);
      }
    }
    if (found < 0) return false;
    const path: number[] = [];
    for (let k = found; k !== -1 && !s.roads[k]; k = prev.get(k)!) path.unshift(k);
    let built = 0;
    for (const i of path.slice(0, STROKE)) {
      const [x, y] = [i % s.cols, Math.floor(i / s.cols)];
      if (s.feature[i]) {
        const before = s.silver;
        if (!this.canAfford(s, RULES.treeClearCost + costOf('road')) || !clearCell(s, x, y).ok) break;
        this.spend('clear', before - s.silver);
      }
      if (!this.canAfford(s, costOf('road'))) break;
      const before = s.silver;
      if (!place(s, 'road', x, y).ok) break;
      this.spend('road', before - s.silver);
      built++;
    }
    return built > 0;
  }

  // ------------------------------------------------------------ week

  /** Runs the bot's turn for this week (before stepWeek). */
  act(s: GameState): void {
    this.updateStreaks(s);
    if (this.rng() < this.p.idleChance) {
      this.lastWeek = 'idle';
      return;
    }
    let acted = 0;
    let saving = false;
    for (let k = 0; k < this.p.actionsPerWeek; k++) {
      const r = this.chooseAndAct(s);
      if (r === 'saving') saving = true;
      if (r !== true) break;
      acted++;
    }
    this.stats.actions += acted;
    if (acted) this.lastWeek = 'acted';
    else if (saving) this.lastWeek = 'saving';
    else {
      this.lastWeek = 'dead';
      this.stats.deadWeeks++;
    }
  }

  private chooseAndAct(s: GameState): boolean | 'saving' {
    const goal = currentGoal(s);
    const templeGoal = goal?.type === 'build' && goal.kind === 'temple';

    if (this.wantsTrim(s) && this.trimUpkeep(s)) return true;
    if (this.wantsFood(s) && this.buildField(s, s.famine)) return true;
    if (this.fixStuck(s)) return true;

    if (templeGoal && s.unlocked.includes('temple')) {
      if (this.buildTemple(s)) return true;
      if (templeSpots(s).length === 0) return false;
    }
    const saving = templeGoal && this.p.templeSaving !== 'none';
    // 'roi' still invests while the temple is far, but just saves once the balance gets there within a year.
    const templeNear = (costOf('temple') - s.silver) / Math.max(0.1, computeEconomy(s).silverDelta) <= 12;
    const roiOnly = templeGoal && this.p.templeSaving === 'roi' && !templeNear;

    const wantWorkshop =
      (goal?.type === 'build' && goal.kind === 'workshop' && this.noticed('goalWorkshop') &&
        goalProgress(s, goal) < goal.target) ||
      this.noticed('jobs') ||
      this.noticed('alert', this.p.alertExtraDelay);
    if (wantWorkshop && (!saving || roiOnly) && this.buildWorkshop(s)) return true;
    if (saving && !roiOnly) return 'saving';

    if (this.noticed('well') && this.buildService(s, 'well', this.uncovered(s, 'well', 1), 0)) return true;
    if (this.noticed('market') && this.buildService(s, 'market', this.uncovered(s, 'market', 2), 0)) return true;

    const plots = this.houses(s).filter((b) => b.connected && b.level === 0).length;
    if (plots < this.p.plotsAhead && this.buildHouses(s)) return true;

    if (!saving && this.rng() < this.p.extraServiceChance) {
      const kind = s.unlocked.includes('market') && this.rng() < 0.5 ? 'market' : 'well';
      const cands = this.spotsAnyRotation(s, kind);
      if (cands.length && this.canAfford(s, costOf(kind))) {
        const c = cands[Math.floor(this.rng() * cands.length)];
        if (this.build(s, kind, c.r, c.rotated)) return true;
      }
    }
    return saving ? 'saving' : false;
  }
}

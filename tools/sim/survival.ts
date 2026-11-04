/**
 * TEMPORARY survival-rules bots and runner (review of the survival package 1). Only src/core.
 *   rolldown tools/sim/survival.ts --file node_modules/.cache/sim/survival.mjs --platform node --format esm
 *   node node_modules/.cache/sim/survival.mjs --seeds 20 [--bots a,b] [--set rules.x=json] [--json]
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
  familyBlock,
  foodCapacity,
  foodForecast,
  gatherCells,
  gatherFood,
  fieldHarvest,
  goalProgress,
  goalTarget,
  harvestsIn,
  indexOf,
  isFreeLand,
  needMet,
  neighbors,
  place,
  clearCell,
  seasonOf,
  stepWeek,
  templeSpots,
  weeksToHarvest,
  unemployed,
  type Building,
  type BuildableKind,
  type GameState,
  type Rect,
  type Rng,
} from '../../src/core';
import { applyOverrides } from './overrides';

// ------------------------------------------------------------------ profiles

export interface Profile {
  name: string;
  actions: number;
  idleChance: number;
  /** Weeks a visible problem must last before the bot reacts. */
  delay: number;
  /** Uses foodForecast to plan (knows the rules); otherwise only reacts to on-screen signals. */
  planner: boolean;
  /** Knows fields must be sown in autumn. */
  knowsAutumn: boolean;
  /** Reacts to food only in famine (forgets the forecast and the family-block message). */
  foodOnlyInFamine: boolean;
  /** Weights for choosing a food building when not planning [fisher, gatherer, field]. */
  foodMix: [number, number, number];
  /** Keeps jobs <= workers (does not build workplaces without people). */
  staffAware: boolean;
  plotsAhead: number;
  housesPerAction: number;
  /** Builds the granary as soon as it is unlocked (else only when spoiling or the goal asks). */
  granaryEarly: boolean;
  /** Places houses only inside well coverage. */
  planWells: boolean;
  noise: number;
  /** Max road cells the bot is willing to lay to reach a food spot. */
  roadReach: number;
}

export const PROFILES: Record<string, Profile> = {
  eficiente: { name: 'eficiente', actions: 2, idleChance: 0, delay: 0, planner: true, knowsAutumn: true, foodOnlyInFamine: false, foodMix: [1, 1, 1], staffAware: true, plotsAhead: 2, housesPerAction: 2, granaryEarly: true, planWells: true, noise: 0.2, roadReach: 30 },
  /** Expert that only sows the one field the harvest goal asks for; feeds the city with fishers and gatherers. */
  pescador: { name: 'pescador', actions: 2, idleChance: 0, delay: 0, planner: true, knowsAutumn: true, foodOnlyInFamine: false, foodMix: [1, 1, 0], staffAware: true, plotsAhead: 2, housesPerAction: 2, granaryEarly: false, planWells: true, noise: 0.2, roadReach: 30 },
  comum: { name: 'comum', actions: 2, idleChance: 0.1, delay: 3, planner: false, knowsAutumn: false, foodOnlyInFamine: false, foodMix: [0.4, 0.3, 0.3], staffAware: false, plotsAhead: 3, housesPerAction: 3, granaryEarly: false, planWells: false, noise: 1.5, roadReach: 14 },
  distraido: { name: 'distraido', actions: 2, idleChance: 0.3, delay: 2, planner: false, knowsAutumn: false, foodOnlyInFamine: true, foodMix: [0.2, 0.2, 0.6], staffAware: false, plotsAhead: 4, housesPerAction: 4, granaryEarly: false, planWells: false, noise: 4, roadReach: 10 },
};

// ------------------------------------------------------------------ geometry

const passable = (s: GameState, x: number, y: number) => {
  const i = indexOf(s, x, y);
  return isFreeLand(s, x, y) || (!s.grid[i] && !s.roads[i] && s.ground[i] !== 'river' && (s.feature[i] === 'palm' || s.feature[i] === 'olive'));
};

/** BFS road distance from the connected road network over passable cells (0 = a network road cell). */
function roadDist(s: GameState): { dist: Int32Array; prev: Int32Array } {
  const n = s.cols * s.rows;
  const dist = new Int32Array(n).fill(-1);
  const prev = new Int32Array(n).fill(-1);
  const q: number[] = [];
  for (let i = 0; i < n; i++) if (s.network[i] && s.roads[i]) { dist[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    for (const c of neighbors(s, i % s.cols, Math.floor(i / s.cols))) {
      const j = indexOf(s, c.x, c.y);
      if (dist[j] >= 0 || !passable(s, c.x, c.y)) continue;
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

const fake = (s: GameState, kind: BuildableKind, r: Rect): Building => ({ id: -1, kind, ...r, level: 0, upStreak: 0, downStreak: 0, connected: true, variant: 0, mirrored: false, built: s.week });

const altarRect = (s: GameState) => s.buildings.find((b) => b.kind === 'altar')!;
const cheb = (a: Rect, b: Rect) => Math.max(0, a.x - (b.x + b.w - 1), b.x - (a.x + a.w - 1), a.y - (b.y + b.h - 1), b.y - (a.y + a.h - 1));

// ------------------------------------------------------------------ bot

interface Stats {
  actions: number;
  built: Record<string, number>;
  roadCells: number;
}

export class SurvivalBot {
  stats: Stats = { actions: 0, built: {}, roadCells: 0 };
  private streak: Record<string, number> = {};
  /** A pending target: the bot laid road toward it and builds it once connected. */
  private pending: { kind: BuildableKind; r: Rect } | null = null;
  constructor(readonly p: Profile, private rng: Rng) {}

  private bump(k: string, on: boolean) { this.streak[k] = on ? (this.streak[k] ?? 0) + 1 : 0; }
  private seen(k: string) { return (this.streak[k] ?? 0) > this.p.delay; }

  act(s: GameState) {
    const eco = computeEconomy(s);
    const block = familyBlock(s, eco);
    this.bump('famine', s.famine);
    this.bump('blockFood', block === 'food');
    this.bump('blockWater', block === 'water');
    this.bump('spoil', s.spoiled > 0);
    this.bump('deficit', eco.silverDelta < 0);
    this.bump('idle', unemployed(s, eco) >= RULES.unemploymentAlert);
    this.bump('debt', s.silver < 0);
    if (this.rng() < this.p.idleChance) return;
    for (let k = 0; k < this.p.actions; k++) {
      if (!this.step(s)) break;
      this.stats.actions++;
    }
  }

  private step(s: GameState): boolean {
    if (this.seen('debt') || (this.p.planner && s.silver < 0)) return this.trim(s);
    if (s.silver < 0) return false;
    if (this.pending) {
      const { kind, r } = this.pending;
      if (!freeRect(s, r)) this.pending = null;
      else if (this.reach(s, kind, r)) return true;
    }
    const eco = computeEconomy(s);
    const goal = currentGoal(s);
    const season = seasonOf(s.week);
    const block = familyBlock(s, eco);

    // 1. Food.
    if (this.seen('famine') && this.food(s, true)) return true;
    if (!this.p.foodOnlyInFamine) {
      if (this.p.planner) {
        if (this.plannerFields(s)) return true;
        if (this.plannerFood(s)) return true;
      } else {
        const goalFood = goal?.type === 'foodUntilSpring' && goalProgress(s, goal) < goalTarget(s, goal);
        if ((goalFood || this.seen('blockFood')) && this.food(s, false)) return true;
        if (goal?.type === 'harvest' && !s.buildings.some((b) => b.kind === 'field') && this.place(s, 'field')) return true;
      }
    } else if (goal?.type === 'harvest' && !s.buildings.some((b) => b.kind === 'field') && this.place(s, 'field')) return true;

    // 2. Granary.
    const granaries = s.buildings.filter((b) => b.kind === 'granary').length;
    if (s.unlocked.includes('granary')) {
      const want = goal?.type === 'build' && goal.kind === 'granary' && granaries === 0;
      const spoil = this.seen('spoil');
      const plan = this.p.planner && this.plannerWantsGranary(s);
      if ((want || spoil || plan || (this.p.granaryEarly && granaries === 0)) && this.place(s, 'granary')) return true;
    }

    // 3. Water.
    const dry = s.buildings.filter((b) => b.kind === 'house' && b.connected && !needMet(s, b, 'well'));
    const waterGoal = goal?.type === 'water';
    if (dry.length && (this.p.planner || waterGoal || this.seen('blockWater')) && this.well(s, dry)) return true;

    // 4. Workshops / markets for the goals and jobs.
    if (goal?.type === 'build' && goal.kind === 'workshop' && goalProgress(s, goal) < goal.target && this.place(s, 'workshop')) return true;
    if (s.unlocked.includes('workshop') && this.seen('idle') && this.place(s, 'workshop')) return true;
    if (s.unlocked.includes('market')) {
      const noMarket = s.buildings.filter((b) => b.kind === 'house' && b.connected && b.level >= 2 && !needMet(s, b, 'market'));
      if (noMarket.length >= (this.p.planner ? 2 : 3) && this.service(s, 'market', noMarket)) return true;
    }

    // 5. Temple.
    if (goal?.type === 'build' && goal.kind === 'temple') {
      if (templeSpots(s).length) {
        if (s.silver >= costOf('temple')) return this.place(s, 'temple');
      } else if (this.place(s, 'temple')) return true;
      if (this.p.planner) return false; // saves
    }

    // 6. Houses.
    const plots = s.buildings.filter((b) => b.kind === 'house' && b.connected && b.level === 0).length;
    const wantHouses = this.p.planner ? (block === 'noPlot' || block === 'wait' || block === null) && plots < this.p.plotsAhead : plots < this.p.plotsAhead;
    if (wantHouses && this.houses(s)) return true;
    // 7. Planner: grow food ahead of growth.
    if (this.p.planner && this.plannerGrowth(s)) return true;
    void season;
    return false;
  }

  /** In debt: demolishes one building of the costliest upkeep kind, the one that serves least. */
  private trim(s: GameState): boolean {
    const eco = computeEconomy(s);
    if (eco.silverDelta >= 0 && s.silver + eco.silverDelta * (RULES.debtWeeksToLose - s.debtWeeks) >= 0) return false;
    const value = (b: Building) => {
      if (b.kind === 'well' || b.kind === 'market') return 2 * s.buildings.filter((h) => h.kind === 'house' && h.level > 0 && cheb(h, b) <= (BUILDINGS[b.kind].radius ?? 0)).length;
      if (b.kind === 'fisher' || b.kind === 'gatherer') return gatherFood(s, b) * 3;
      if (b.kind === 'field') return 3;
      if (b.kind === 'granary') return s.food > RULES.baseFoodStorage ? 6 : 1;
      return 4;
    };
    const isFood = (x: Building) => x.kind === 'fisher' || x.kind === 'gatherer' || x.kind === 'field';
    const per = (b: Building) => value(b) / (BUILDINGS[b.kind].upkeep ?? 1);
    // Wells that water a family are kept (removing them would close the family gate).
    const cands = s.buildings.filter((b) => (BUILDINGS[b.kind].upkeep ?? 0) > 0 && !BUILDINGS[b.kind].protected && !(b.kind === 'well' && value(b) > 0) && !(isFood(b) && s.buildings.filter(isFood).length <= 2)).sort((a, b) => per(a) - per(b));
    if (!cands.length) return false;
    this.stats.built.trim = (this.stats.built.trim ?? 0) + 1;
    return clearCell(s, cands[0].x, cands[0].y).ok;
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
    if (!this.p.knowsAutumn || seasonOf(s.week) !== 'autumn' || s.silver < costOf('field')) return false;
    const st = settle(s);
    const eco = computeEconomy(st);
    const steady = st.buildings.reduce((a, b) => a + gatherFood(st, b), 0) * eco.efficiency;
    const gap = (eco.foodEaten * 1.15 - steady) * 52;
    const sown = s.buildings.filter((b) => b.kind === 'field' && b.connected).length;
    const goal = currentGoal(s);
    const want = this.p.foodMix[2] === 0 ? (goal?.type === 'harvest' && sown === 0 ? 1 : 0) : Math.max(goal?.type === 'harvest' ? 1 : 0, Math.ceil(gap / ((BUILDINGS.field.harvest ?? 1) * Math.max(0.5, eco.efficiency))));
    if (sown >= want) return false;
    if (this.p.staffAware && eco.jobs + BUILDINGS.field.jobs > eco.workers + 1 && sown >= 1) return false;
    return this.place(s, 'field');
  }

  private plannerWantsGranary(s: GameState) {
    // Expected spring harvest vs. what can be kept.
    const fields = s.buildings.filter((b) => b.kind === 'field' && b.connected);
    const eco = computeEconomy(s);
    const spring = fields.reduce((sum, b) => sum + (BUILDINGS.field.harvest ?? 0) * (harvestsNext(s, b) ? 1 : 0), 0) * eco.efficiency;
    const keep = spring - eco.foodEaten * RULES.weeksPerSeason;
    return keep > foodCapacity(s) - 10;
  }

  /** Planner: in autumn adds fields when next year's food is short; adds steady food when needed. */
  private plannerGrowth(s: GameState): boolean {
    const eco = computeEconomy(s);
    if (this.p.staffAware && eco.jobs >= eco.workers) return false;
    const st = settle(s);
    const out = foodForecast(st, computeEconomy(st), 60);
    if (!out) return false;
    if (s.silver < 60) return false;
    return this.bestFood(s);
  }

  // ---------------------------------------------------------------- placement

  /** Best spot for a kind (connected or reachable by road): returns rect and road cells needed. */
  private spotFor(s: GameState, kind: BuildableKind): { r: Rect; d: number } | null {
    const { w, h } = dimsOf(kind);
    const rd = roadDist(s);
    const altar = altarRect(s);
    let best: { r: Rect; d: number; v: number } | null = null;
    const reach = kind === 'fisher' || kind === 'gatherer' || (kind === 'field' && this.p.planner) || kind === 'temple' ? this.p.roadReach : 0;
    for (let y = 0; y + h <= s.rows; y++) for (let x = 0; x + w <= s.cols; x++) {
      const r = { x, y, w, h };
      if (!freeRect(s, r)) continue;
      const { d } = rectReach(s, r, rd);
      if (d > reach) continue;
      let v = 0;
      if (kind === 'fisher' || kind === 'gatherer') {
        const g = gatherFood(s, fake(s, kind, r));
        if (g < 0.5) continue;
        v = g * 10;
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
    return best;
  }

  private place(s: GameState, kind: BuildableKind, emergency = false): boolean {
    if (!s.unlocked.includes(kind) || s.silver < costOf(kind)) return false;
    if (this.p.planner && !emergency && kind !== 'temple') {
      const eco = computeEconomy(s);
      const after = eco.silverDelta - (BUILDINGS[kind].upkeep ?? 0);
      if (after < 0 && s.silver - costOf(kind) < -after * 20) return false;
    }
    if (this.p.staffAware && BUILDINGS[kind].jobs > 0 && kind !== 'fisher' && kind !== 'gatherer' && kind !== 'field' && kind !== 'granary' && kind !== 'temple') {
      const eco = computeEconomy(s);
      if (eco.jobs + BUILDINGS[kind].jobs > eco.workers + 1) return false;
    }
    const spot = this.spotFor(s, kind);
    if (!spot) return false;
    return this.reach(s, kind, spot.r);
  }

  /** Builds the rect if it touches the network, else lays one road stroke toward it. */
  private reach(s: GameState, kind: BuildableKind, r: Rect): boolean {
    if (s.silver < costOf(kind)) return false;
    const rd = roadDist(s);
    const { d, cell } = rectReach(s, r, rd);
    if (d === 0) {
      this.pending = null;
      const ok = place(s, kind, r.x, r.y).ok;
      if (ok) this.stats.built[kind] = (this.stats.built[kind] ?? 0) + 1;
      return ok;
    }
    if (!Number.isFinite(d) || s.silver < costOf(kind) + d * costOf('road')) return false;
    const path: number[] = [];
    for (let k = cell; k >= 0 && rd.dist[k] > 0; k = rd.prev[k]) path.unshift(k);
    let laid = 0;
    for (const i of path.slice(0, 12)) {
      const x = i % s.cols, y = Math.floor(i / s.cols);
      if (s.feature[i] && !clearCell(s, x, y).ok) break;
      if (!place(s, 'road', x, y).ok) break;
      laid++;
    }
    this.stats.roadCells += laid;
    this.pending = laid ? { kind, r } : null;
    return laid > 0;
  }

  private well(s: GameState, dry: Building[]) {
    return this.service(s, 'well', dry);
  }

  private service(s: GameState, kind: 'well' | 'market', targets: Building[]) {
    if (s.silver < costOf(kind)) return false;
    const { w, h } = dimsOf(kind);
    const rad = BUILDINGS[kind].radius ?? 0;
    let best: { r: Rect; v: number } | null = null;
    for (const rot of kind === 'market' ? [false, true] : [false]) {
      const d = rot ? { w: h, h: w } : { w, h };
      for (let y = 0; y + d.h <= s.rows; y++) for (let x = 0; x + d.w <= s.cols; x++) {
        const r = { x, y, ...d };
        if (!freeRect(s, r) || !borderCells(s, r).some((c) => s.network[indexOf(s, c.x, c.y)])) continue;
        const v = targets.filter((t) => cheb(r, t) <= rad).length + this.rng() * this.p.noise * 0.3;
        if (!best || v > best.v) best = { r, v };
      }
    }
    if (!best || best.v < 1) return false;
    const r = best.r;
    const rotated = r.w !== w;
    const ok = place(s, kind, r.x, r.y, rotated).ok;
    if (ok) this.stats.built[kind] = (this.stats.built[kind] ?? 0) + 1;
    return ok;
  }

  private houses(s: GameState) {
    const cost = costOf('house');
    if (s.silver < cost) return false;
    const { w, h } = dimsOf('house');
    const altar = altarRect(s);
    const goal = currentGoal(s);
    const sacredGoal = goal?.type === 'houses' && (goal.level ?? 0) >= 4;
    const cands: { r: Rect; v: number }[] = [];
    for (let y = 0; y + h <= s.rows; y++) for (let x = 0; x + w <= s.cols; x++) {
      const r = { x, y, w, h };
      if (!freeRect(s, r) || !borderCells(s, r).some((c) => s.network[indexOf(s, c.x, c.y)])) continue;
      const f = fake(s, 'house', r);
      const well = needMet(s, f, 'well');
      if (this.p.planWells && !well) continue;
      let v = -cheb(r, altar) * 0.3 + (well ? 2 : 0) + (needMet(s, f, 'market') ? 1 : 0) + (sacredGoal && needMet(s, f, 'sacred') ? 6 : 0);
      v += this.rng() * this.p.noise;
      cands.push({ r, v });
    }
    if (!cands.length) {
      if (this.p.planWells) {
        // Place a well near the city edge where plots can go.
        const spot = this.spotFor(s, 'well');
        if (spot && spot.d === 0 && s.silver >= costOf('well') + cost) { const ok = place(s, 'well', spot.r.x, spot.r.y).ok; if (ok) this.stats.built.well = (this.stats.built.well ?? 0) + 1; return ok; }
      }
      return this.roadStroke(s);
    }
    cands.sort((a, b) => b.v - a.v);
    let n = 0;
    for (const c of cands) {
      if (n >= this.p.housesPerAction || s.silver < cost) break;
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
        for (let k = 1; k <= 6; k++) if (isFreeLand(s, x + dx * k, y + dy * k)) ok++; else break;
        if (ok < 4) continue;
        const v = -cheb({ x, y, w: 1, h: 1 }, altar) + this.rng() * 3;
        if (!best || v > best.v) best = { x, y, dx, dy, v };
      }
    }
    if (!best || s.silver < 12) return false;
    let laid = 0;
    for (let k = 1; k <= 6; k++) if (place(s, 'road', best.x + best.dx * k, best.y + best.dy * k).ok) laid++; else break;
    this.stats.roadCells += laid;
    return laid > 0;
  }
}

/** A copy where every house with a family is at the level its needs allow (what it will become). */
function settle(s: GameState): GameState {
  const c = structuredClone(s);
  for (const h of c.buildings) {
    if (h.kind !== 'house' || h.level === 0 || !h.connected) continue;
    while (h.level + 1 < HOUSE_LEVELS.length && HOUSE_LEVELS[h.level + 1].needs.every((n) => needMet(c, h, n))) h.level++;
  }
  return c;
}

/** The field will harvest in the next spring. */
function harvestsNext(s: GameState, b: Building) {
  return harvestsIn(b, s.week + weeksToHarvest(s.week));
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
  built: Record<string, number>;
  peak: number;
}

const riverDistance = (s: GameState) => {
  const a = altarRect(s);
  let d = Infinity;
  for (let i = 0; i < s.ground.length; i++) if (s.ground[i] === 'river') d = Math.min(d, cheb({ x: i % s.cols, y: Math.floor(i / s.cols), w: 1, h: 1 }, a));
  return d;
};

export function run(p: Profile, seed: number, maxWeeks = 1000): Result {
  const rng = createRng(seed);
  const s = createGame(rng);
  const bot = new SurvivalBot(p, createRng(seed * 7919 + 13));
  const res: Result = {
    bot: p.name, seed, families0: s.start.families, foodWeeks0: s.start.foodWeeks, riverDist: riverDistance(s), won: false, lost: false, weeks: maxWeeks,
    year1: false, residents52: 0, residents104: 0, lowestResidentsY1: Infinity, famineY1: 0, famineWeeks: 0, longestFamine: 0, left: 0, leftWinter1: 0, emptied: false,
    firstHarvestWeek: null, firstFieldWeek: null, firstGranaryWeek: null, goalWeeks: GOALS.map(() => null), blocks: {}, blocksY1: {},
    food: { field: 0, fisher: 0, gatherer: 0, spoiled: 0 }, droughtYears: 0, famineAfterDrought: 0, debtLoss: false, built: bot.stats.built, peak: 0,
  };
  let run = 0;
  let dryYear = false;
  while (s.week < maxWeeks) {
    bot.act(s);
    const eco = computeEconomy(s);
    const block = familyBlock(s, eco) ?? 'open';
    res.blocks[block] = (res.blocks[block] ?? 0) + 1;
    if (s.week < 52) res.blocksY1[block] = (res.blocksY1[block] ?? 0) + 1;
    for (const b of s.buildings) {
      if (!b.connected) continue;
      if (b.kind === 'field') res.food.field += fieldHarvest(s, b, s.week) * eco.efficiency;
      if (b.kind === 'fisher') res.food.fisher += gatherFood(s, b) * eco.efficiency;
      if (b.kind === 'gatherer') res.food.gatherer += gatherFood(s, b) * eco.efficiency;
    }
    if (res.firstFieldWeek === null && s.buildings.some((b) => b.kind === 'field' && b.connected)) res.firstFieldWeek = s.week;
    if (res.firstGranaryWeek === null && s.buildings.some((b) => b.kind === 'granary' && b.connected)) res.firstGranaryWeek = s.week;
    const goalBefore = s.goalIndex;
    const wasDrought = s.drought;
    const events = stepWeek(s, rng);
    if (s.drought && !wasDrought) { res.droughtYears++; dryYear = true; }
    if (seasonOf(s.week) === 'autumn' && s.week % RULES.weeksPerSeason === 0) dryYear = false;
    for (let g = goalBefore; g < s.goalIndex; g++) res.goalWeeks[g] = s.week;
    res.food.spoiled += s.spoiled;
    const lefts = events.filter((e) => e.type === 'familyLeft').length;
    res.left += lefts;
    if (s.week <= 26) res.leftWinter1 += lefts;
    const resid = computeEconomy(s).residents;
    res.peak = Math.max(res.peak, resid);
    if (s.week <= 52) res.lowestResidentsY1 = Math.min(res.lowestResidentsY1, resid);
    if (resid === 0 && s.families.length === 0) res.emptied = true;
    if (s.week === 52) { res.residents52 = resid; res.year1 = !s.lost && resid > 0; }
    if (s.week === 104) res.residents104 = resid;
    if (res.firstHarvestWeek === null && s.harvested > 0) res.firstHarvestWeek = s.week;
    if (s.famine) {
      res.famineWeeks++;
      if (s.week <= 52) res.famineY1++;
      if (dryYear) res.famineAfterDrought++;
      run++;
      res.longestFamine = Math.max(res.longestFamine, run);
    } else run = 0;
    if (s.won) { res.won = true; res.weeks = s.week; break; }
    if (s.lost) { res.lost = true; res.debtLoss = true; res.weeks = s.week; break; }
  }
  return res;
}

// ------------------------------------------------------------------ CLI

const args = process.argv.slice(2);
const opt = (n: string, d: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const ov = applyOverrides(args);
const bots = opt('bots', Object.keys(PROFILES).join(',')).split(',');
const seeds = Number(opt('seeds', '20'));
const maxWeeks = Number(opt('weeks', '1000'));
const med = (v: number[]) => { const a = v.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) / 2)] : NaN; };
const f = (n: number, d = 0) => (Number.isFinite(n) ? n.toFixed(d) : '-');
const mins = (w: number) => (w * RULES.weekSeconds) / 60;
if (ov.length) console.log('overrides', ov.join(' '));
const all: Result[] = [];
for (const name of bots) {
  const rs: Result[] = [];
  for (let k = 1; k <= seeds; k++) rs.push(run(PROFILES[name], k, maxWeeks));
  all.push(...rs);
  if (args.includes('--json')) continue;
  const n = rs.length;
  if (args.includes('--brief')) {
    const won = rs.filter((r) => r.won);
    const goals = rs.map((r) => r.goalWeeks.filter((x) => x !== null).length);
    const g = (i: number) => f(med(rs.map((r) => r.goalWeeks[i] ?? NaN)));
    console.log(`${name.padEnd(9)} Y1 ${rs.filter((r) => r.year1).length}/${n} empt ${rs.filter((r) => r.emptied).length} debt ${rs.filter((r) => r.lost).length} won ${won.length} winwk ${f(med(won.map((r) => r.weeks)))} | res52 ${f(med(rs.map((r) => r.residents52)))} res104 ${f(med(rs.map((r) => r.residents104)))} peak ${f(med(rs.map((r) => r.peak)))} | famY1 ${f(med(rs.map((r) => r.famineY1)))} left ${f(med(rs.map((r) => r.left)))} | goals med ${f(med(goals))} | g4 ${g(3)} g5 ${g(4)} g6 ${g(5)} g9 ${g(8)} g10 ${g(9)}`);
    continue;
  }
  const won = rs.filter((r) => r.won);
  console.log(`\n=== ${name}  (${n} seeds)`);
  console.log(`year 1 survived ${rs.filter((r) => r.year1).length}/${n} | emptied ever ${rs.filter((r) => r.emptied).length} | lost (debt) ${rs.filter((r) => r.lost).length} | won ${won.length} | unfinished ${n - won.length - rs.filter((r) => r.lost).length}`);
  console.log(`residents w52 med ${f(med(rs.map((r) => r.residents52)))}  w104 ${f(med(rs.map((r) => r.residents104)))}  lowest Y1 med ${f(med(rs.map((r) => r.lowestResidentsY1)))}  peak ${f(med(rs.map((r) => r.peak)))}`);
  console.log(`famine Y1 weeks med ${f(med(rs.map((r) => r.famineY1)))} (runs with any ${rs.filter((r) => r.famineY1 > 0).length})  total med ${f(med(rs.map((r) => r.famineWeeks)))}  longest med ${f(med(rs.map((r) => r.longestFamine)))}  tents left med ${f(med(rs.map((r) => r.left)))} winter1 ${f(med(rs.map((r) => r.leftWinter1)))}`);
  console.log(`first field wk med ${f(med(rs.map((r) => r.firstFieldWeek ?? NaN)))}  first harvest wk med ${f(med(rs.map((r) => r.firstHarvestWeek ?? NaN)))} (none ${rs.filter((r) => r.firstHarvestWeek === null).length})  first granary wk med ${f(med(rs.map((r) => r.firstGranaryWeek ?? NaN)))} (none ${rs.filter((r) => r.firstGranaryWeek === null).length})`);
  const tot = (k: keyof Result['food']) => rs.reduce((a, r) => a + r.food[k], 0);
  const made = tot('field') + tot('fisher') + tot('gatherer');
  console.log(`food made share: field ${f((100 * tot('field')) / made)}%  fisher ${f((100 * tot('fisher')) / made)}%  gatherer ${f((100 * tot('gatherer')) / made)}%  spoiled = ${f((100 * tot('spoiled')) / made)}% of made`);
  const bsum: Record<string, number> = {}; const b1: Record<string, number> = {};
  for (const r of rs) { for (const [k, v] of Object.entries(r.blocks)) bsum[k] = (bsum[k] ?? 0) + v; for (const [k, v] of Object.entries(r.blocksY1)) b1[k] = (b1[k] ?? 0) + v; }
  const pct = (o: Record<string, number>) => { const t = Object.values(o).reduce((a, v) => a + v, 0); return Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${f((100 * v) / t)}%`).join(', '); };
  console.log(`family block Y1: ${pct(b1)}`);
  console.log(`family block all: ${pct(bsum)}`);
  console.log(`drought years med ${f(med(rs.map((r) => r.droughtYears)))}  famine weeks in dry years med ${f(med(rs.map((r) => r.famineAfterDrought)))}`);
  console.log('goal                                  done  week med (min-max)  min@1x');
  GOALS.forEach((g, i) => {
    const d = rs.map((r) => r.goalWeeks[i]).filter((x): x is number => x !== null);
    console.log(`${String(i + 1).padStart(2)} ${g.text.padEnd(36).slice(0, 36)} ${String(d.length).padStart(3)}  ${f(med(d)).padStart(5)} (${d.length ? Math.min(...d) + '-' + Math.max(...d) : '-'})  ${f(mins(med(d)), 1)}`);
  });
  console.log(`win weeks med ${f(med(won.map((r) => r.weeks)))} = ${f(mins(med(won.map((r) => r.weeks))), 1)} min`);
  const kinds = [...new Set(rs.flatMap((r) => Object.keys(r.built)))];
  console.log(`built med: ${kinds.map((k) => `${k} ${f(med(rs.map((r) => r.built[k] ?? 0)))}`).join(', ')}`);
}
if (args.includes('--json')) console.log(JSON.stringify(all));
if (args.includes('--rows')) for (const r of all) console.log([r.bot, r.seed, r.families0, r.foodWeeks0, r.riverDist, r.year1 ? 'Y1ok' : 'Y1x', r.residents52, r.famineY1, r.firstHarvestWeek, r.firstGranaryWeek, r.won ? r.weeks : r.lost ? 'L' + r.weeks : '-', JSON.stringify(r.built)].join(' '));
void HOUSE_LEVELS; void goalTarget;

if (args.includes('--trace')) {
  const [bn, sd, upto] = opt('trace', 'comum:1:80').split(':');
  const rng = createRng(Number(sd));
  const s = createGame(rng);
  const bot = new SurvivalBot(PROFILES[bn], createRng(Number(sd) * 7919 + 13));
  let prevB = '';
  while (s.week < Number(upto) && !s.lost && !s.won) {
    bot.act(s);
    const bl = s.buildings.filter((b) => b.kind !== 'altar').map((b) => b.kind === 'house' ? 'h' + b.level : b.kind[0] + b.kind[1]).sort().join('');
    const eco = computeEconomy(s);
    const fc = foodForecast(s, eco);
    console.log(`w${s.week} ${seasonOf(s.week).slice(0, 2)} $${f(s.silver)} (${eco.silverDelta >= 0 ? '+' : ''}${eco.silverDelta}) food ${s.food}/${foodCapacity(s)} (${eco.foodDelta}) res ${eco.residents} wk ${eco.workers}/${eco.jobs} fc ${fc ? fc.weeks : '-'} blk ${familyBlock(s, eco) ?? 'open'} g${s.goalIndex + 1}${s.drought ? ' DRY' : ''}${s.famine ? ' FAMINE' : ''} ${bl !== prevB ? bl : ''}`);
    prevB = bl;
    stepWeek(s, rng);
  }
}

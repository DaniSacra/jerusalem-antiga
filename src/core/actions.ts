import { BUILDINGS, dimsOf, newBuilding, nextLevelOf, RULES, statOf } from './data';
import { rollUpWeeks } from './houses';
import { leaveHouse } from './people';
import { borderCells, cellsOf, footprint, inBounds, indexOf } from './grid';
import { touchesNetwork } from './network';
import { refreshCity } from './refresh';
import { rollLook } from './looks';
import { createRng } from './rng';
import { lackingMaterial, materialsOf, missingMaterial, payMaterials } from './materials';
import { checkStartStage, nextStage, stageSite } from './temple';
import { clearStump } from './trees';
import type { ActionResult, BuildableKind, BuildingKind, Cell, Dims, FailReason, GameEvent, GameState, Placeable, Rng } from './types';
import { canWork, crewByKind, jobOptions, jobsBuilt, loweredTarget } from './work';

const fail = (reason: FailReason): ActionResult => ({ ok: false, reason });
const OK: ActionResult = { ok: true };

export const costOf = (kind: Placeable) => (kind === 'road' ? RULES.roadCost : BUILDINGS[kind].cost);
/** Footprint of a placeable; only non-square buildings change when rotated. */
export const placeSize = (kind: Placeable, rotated = false): Dims => (kind === 'road' ? { w: 1, h: 1 } : dimsOf(kind, rotated));

/** Free land: inside the map, not river, no rock or tree (a stump is free), no building or road. */
export function isFreeLand(s: GameState, x: number, y: number): boolean {
  if (!inBounds(s, x, y)) return false;
  const i = indexOf(s, x, y);
  return s.ground[i] !== 'river' && (!s.feature[i] || s.feature[i] === 'stump') && !s.grid[i] && !s.roads[i];
}

const isFreeRect = (s: GameState, x: number, y: number, { w, h }: Dims) => footprint(x, y, w, h).every((c) => isFreeLand(s, c.x, c.y));

/** Validates placing a road or building with its top-left cell at (x, y). */
export function checkPlace(s: GameState, kind: Placeable, x: number, y: number, rotated = false): ActionResult {
  if (!s.unlocked.includes(kind)) return fail('locked');
  const d = placeSize(kind, rotated);
  if (!isFreeRect(s, x, y, d)) return fail('invalid');
  if (kind === 'temple' && !touchesNetwork(s, { x, y, ...d })) return fail('noRoad');
  if (s.silver < 0) return fail('debt');
  if (s.silver < costOf(kind)) return fail('silver');
  if (missingMaterial(s, kind)) return fail('materials');
  return OK;
}

/** Top-left cells where a building fits on free land touching the connected road network (silver ignored). */
export function placeSpots(s: GameState, kind: BuildableKind, rotated = false): Cell[] {
  const d = placeSize(kind, rotated);
  const out: Cell[] = [];
  for (let y = 0; y + d.h <= s.rows; y++) {
    for (let x = 0; x + d.w <= s.cols; x++) {
      if (isFreeRect(s, x, y, d) && touchesNetwork(s, { x, y, ...d })) out.push({ x, y });
    }
  }
  return out;
}

/** Top-left cells where the temple fits. */
export const templeSpots = (s: GameState) => placeSpots(s, 'temple');

/**
 * Placing here is held back only by the road: the footprint is free, the silver is there, but it
 * would not touch the network (the temple cannot be built; the others would stand cut off).
 */
export function onlyNeedsRoad(s: GameState, kind: Placeable, x: number, y: number, rotated = false): boolean {
  if (kind === 'road' || !s.unlocked.includes(kind)) return false;
  const d = placeSize(kind, rotated);
  return isFreeRect(s, x, y, d) && !touchesNetwork(s, { x, y, ...d }) && s.silver >= costOf(kind);
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Road steps over free land from the connected network (0 on it), with the previous cell of each. */
export function roadDistances(s: GameState): { dist: Int32Array; prev: Int32Array } {
  const dist = new Int32Array(s.cols * s.rows).fill(-1);
  const prev = new Int32Array(s.cols * s.rows).fill(-1);
  const queue: number[] = [];
  s.network.forEach((on, i) => {
    if (on && s.roads[i]) {
      dist[i] = 0;
      queue.push(i);
    }
  });
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const x = i % s.cols;
    const y = Math.floor(i / s.cols);
    for (const [dx, dy] of DIRS) {
      if (!isFreeLand(s, x + dx, y + dy)) continue;
      const j = indexOf(s, x + dx, y + dy);
      if (dist[j] >= 0) continue;
      dist[j] = dist[i] + 1;
      prev[j] = i;
      queue.push(j);
    }
  }
  return { dist, prev };
}

/** A place where the temple fits: `ready` touches the network; otherwise a short road links it. */
export interface TempleSpot extends Cell {
  ready: boolean;
}

/**
 * Top-left cells where the temple fits on free land, touching the network (`ready`) or at most
 * `templeSpotRoadGap` free cells away from it (a road that long links it). Nearest the altar first
 * (Manhattan distance between the centers).
 */
export function templeSpotsNear(s: GameState): TempleSpot[] {
  const d = dimsOf('temple');
  const { dist } = roadDistances(s);
  const out: (TempleSpot & { far: number })[] = [];
  const a = { x: s.altar.x + dimsOf('altar').w / 2, y: s.altar.y + dimsOf('altar').h / 2 };
  for (let y = 0; y + d.h <= s.rows; y++) {
    for (let x = 0; x + d.w <= s.cols; x++) {
      if (!isFreeRect(s, x, y, d)) continue;
      const rect = { x, y, ...d };
      const ready = touchesNetwork(s, rect);
      const near = (c: Cell) => {
        const k = dist[indexOf(s, c.x, c.y)];
        return k > 0 && k <= RULES.templeSpotRoadGap;
      };
      if (!ready && !borderCells(s, rect).some(near)) continue;
      out.push({ x, y, ready, far: Math.abs(x + d.w / 2 - a.x) + Math.abs(y + d.h / 2 - a.y) });
    }
  }
  return out.sort((p, q) => p.far - q.far).map(({ far: _far, ...spot }) => spot);
}

/**
 * When no temple spot is near the network: the free place for it that needs the shortest new road,
 * with that road (from the network to the cell beside the place). Ties go to the place nearest the
 * altar. Null when the temple fits nowhere a road can reach.
 */
export function templeRoadSpot(s: GameState): (TempleSpot & { road: Cell[] }) | null {
  const d = dimsOf('temple');
  const { dist, prev } = roadDistances(s);
  const a = { x: s.altar.x + dimsOf('altar').w / 2, y: s.altar.y + dimsOf('altar').h / 2 };
  let best: { x: number; y: number; end: number; far: number } | null = null;
  for (let y = 0; y + d.h <= s.rows; y++) {
    for (let x = 0; x + d.w <= s.cols; x++) {
      if (!isFreeRect(s, x, y, d)) continue;
      let end = -1;
      for (const c of borderCells(s, { x, y, ...d })) {
        if (!inBounds(s, c.x, c.y)) continue;
        const i = indexOf(s, c.x, c.y);
        if (dist[i] >= 0 && (end < 0 || dist[i] < dist[end])) end = i;
      }
      if (end < 0) continue;
      const far = Math.abs(x + d.w / 2 - a.x) + Math.abs(y + d.h / 2 - a.y);
      if (best && (dist[end] > dist[best.end] || (dist[end] === dist[best.end] && far >= best.far))) continue;
      best = { x, y, end, far };
    }
  }
  if (!best) return null;
  const road: Cell[] = [];
  for (let i = best.end; dist[i] > 0; i = prev[i]) road.unshift({ x: i % s.cols, y: Math.floor(i / s.cols) });
  return { x: best.x, y: best.y, ready: road.length === 0, road };
}

/**
 * Builds a road or building, paying its silver and materials; stumps under it go away. `rng`
 * draws the look of houses (seeded from the id if not given).
 */
export function place(s: GameState, kind: Placeable, x: number, y: number, rotated = false, rng?: Rng): ActionResult {
  const r = checkPlace(s, kind, x, y, rotated);
  if (!r.ok) return r;
  s.silver -= costOf(kind);
  payMaterials(s, materialsOf(kind));
  const { w, h } = placeSize(kind, rotated);
  for (const c of footprint(x, y, w, h)) clearStump(s, indexOf(s, c.x, c.y));
  if (kind === 'road') {
    s.roads[indexOf(s, x, y)] = true;
  } else {
    const id = s.nextId++;
    const b = newBuilding(id, kind, { x, y, ...placeSize(kind, rotated) }, s.week);
    s.buildings.push(b);
    for (const c of cellsOf(b)) s.grid[indexOf(s, c.x, c.y)] = b;
    const r = rng ?? createRng(id);
    rollLook(s, b, r);
    if (kind === 'house') rollUpWeeks(b, r);
    addJobsToTarget(s, b.kind, statOf(b, 'jobs'));
  }
  refreshCity(s);
  return r;
}

export function checkClear(s: GameState, x: number, y: number): ActionResult {
  if (!inBounds(s, x, y)) return fail('invalid');
  const i = indexOf(s, x, y);
  const b = s.grid[i];
  if (b) return BUILDINGS[b.kind].protected ? fail('protected') : OK;
  if (s.roads[i]) return OK;
  if (s.feature[i] !== 'palm' && s.feature[i] !== 'olive') return fail('invalid');
  if (s.silver < 0) return fail('debt');
  return s.silver < RULES.treeClearCost ? fail('silver') : OK;
}

/** Removes a building or road (no refund) or cuts a tree (costs silver). The family of a demolished house leaves the city. */
export function clearCell(s: GameState, x: number, y: number): ActionResult {
  const r = checkClear(s, x, y);
  if (!r.ok) return r;
  const i = indexOf(s, x, y);
  const b = s.grid[i];
  if (b) {
    if (b.kind === 'house') leaveHouse(s, b.id, 'demolished');
    s.buildings = s.buildings.filter((o) => o !== b);
    for (const c of cellsOf(b)) s.grid[indexOf(s, c.x, c.y)] = null;
    const t = s.jobTargets[b.kind];
    if (t !== undefined) s.jobTargets[b.kind] = Math.min(t, jobsBuilt(s, b.kind));
  } else if (s.roads[i]) {
    s.roads[i] = false;
  } else {
    s.feature[i] = null;
    s.silver -= RULES.treeClearCost;
  }
  refreshCity(s);
  return r;
}

/** Checks raising the service building at (x, y) one level: it must have a next level, and the silver and materials for it. */
export function checkUpgrade(s: GameState, x: number, y: number): ActionResult {
  const b = inBounds(s, x, y) ? s.grid[indexOf(s, x, y)] : null;
  const next = b && nextLevelOf(b);
  if (!next) return fail('locked');
  if (s.silver < 0) return fail('debt');
  if (s.silver < next.cost) return fail('silver');
  return lackingMaterial(s, next.materials ?? {}) ? fail('materials') : OK;
}

/**
 * Raises a granary, market or workshop one level at once (no refund on demolishing): pays the
 * level's silver and materials; its stats and upkeep change (see `statOf`). Pushes a `buildingUp` event.
 */
export function upgradeBuilding(s: GameState, x: number, y: number, events: GameEvent[] = []): ActionResult {
  const r = checkUpgrade(s, x, y);
  if (!r.ok) return r;
  const b = s.grid[indexOf(s, x, y)]!;
  const next = nextLevelOf(b)!;
  s.silver -= next.cost;
  payMaterials(s, next.materials ?? {});
  const jobs = statOf(b, 'jobs');
  b.level++;
  addJobsToTarget(s, b.kind, statOf(b, 'jobs') - jobs);
  refreshCity(s);
  events.push({ type: 'buildingUp', x: b.x, y: b.y, level: b.level });
  return r;
}

/** New jobs of a profession with a number as target join it: who builds a lumber camp wants lumberjacks. */
function addJobsToTarget(s: GameState, kind: BuildingKind, jobs: number) {
  const t = s.jobTargets[kind];
  if (t !== undefined && jobs > 0) s.jobTargets[kind] = t + jobs;
}

/** One worker fewer in a profession: its target becomes a number one below the crew (or the target). */
const lowerTarget = (s: GameState, kind: BuildingKind) => {
  s.jobTargets[kind] = loweredTarget(s.jobTargets[kind], crewByKind(s).get(kind) ?? 0);
};

/** + in the panel: one worker more in a profession with a number as target (automatic already wants every job). */
const raiseTarget = (s: GameState, kind: BuildingKind) => {
  const t = s.jobTargets[kind];
  if (t !== undefined) s.jobTargets[kind] = Math.min(t + 1, jobsBuilt(s, kind));
};

/**
 * The player moves an adult to a workplace with a free job (connected, not full), or leaves them
 * without work (`buildingId` null). The professions' targets follow (`jobTargets`): the one left
 * has one worker fewer, the one joined one more, so the game does not undo the move. Free and at
 * once; a job left in an automatic profession goes to someone free. False (nothing changes) for a
 * child, an elder, someone on the way, or a workplace full, off the road or without jobs.
 */
export function setJob(s: GameState, personId: number, buildingId: number | null): boolean {
  const p = s.people.find((o) => o.id === personId);
  if (!p || !canWork(s, p)) return false;
  if (p.jobId === buildingId) return true;
  if (buildingId !== null && !jobOptions(s, personId).some((o) => o.buildingId === buildingId)) return false;
  const from = s.buildings.find((b) => b.id === p.jobId)?.kind;
  const to = s.buildings.find((b) => b.id === buildingId)?.kind;
  if (from !== to) {
    if (from && (buildingId === null || s.jobTargets[from] !== undefined)) lowerTarget(s, from);
    // The one joined keeps room for the newcomer: a profession short of its target is not raised.
    const t = to && s.jobTargets[to];
    if (to && t !== undefined) s.jobTargets[to] = Math.min(Math.max(t, (crewByKind(s).get(to) ?? 0) + 1), jobsBuilt(s, to));
  }
  p.jobId = buildingId;
  refreshCity(s);
  return true;
}

/**
 * − / + on a profession in the Profissões panel: − frees the worker living farthest at once (the
 * target becomes a number); + raises a number target by one, up to the jobs built, and the nearest
 * free adult takes the job if there is one. False when nothing changes (+ on an automatic one, −
 * with nobody there and a target of 0).
 */
export function changeJobTarget(s: GameState, kind: BuildingKind, delta: 1 | -1): boolean {
  const was = s.jobTargets[kind];
  if (delta < 0) lowerTarget(s, kind);
  else raiseTarget(s, kind);
  if (s.jobTargets[kind] === was) return false;
  refreshCity(s);
  return true;
}

/** "Automático" in the Profissões panel: every profession fills all its jobs again. */
export function autoJobs(s: GameState): void {
  s.jobTargets = {};
  refreshCity(s);
}

/**
 * Begins the next stage of the Temple (its goal is the current one): pays its silver and materials
 * at once and opens its builders' jobs at the site, with a number target of all of them: free
 * adults go there before the automatic professions. Pushes a `stageStart` event.
 */
export function startStage(s: GameState, events: GameEvent[] = []): ActionResult {
  const r = checkStartStage(s);
  if (!r.ok) return r;
  const st = nextStage(s)!;
  const site = stageSite(s, st)!;
  s.silver -= st.cost;
  payMaterials(s, st.materials);
  s.temple.active = true;
  s.temple.progress = 0;
  site.builders = st.builders;
  // The builders are asked for: they come before the automatic professions (see `assignJobs`).
  s.jobTargets[site.kind] = st.builders;
  refreshCity(s);
  events.push({ type: 'stageStart', stage: s.temple.done + 1 });
  return r;
}

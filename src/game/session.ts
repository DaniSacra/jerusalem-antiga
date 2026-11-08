import {
  advanceClock,
  canRotate,
  checkClear,
  clearCell,
  createGame,
  createRng,
  dimsOf,
  fieldHint,
  foodLostIfRemoved,
  foodSpot,
  gatherSpots,
  houseHint,
  inBounds,
  indexOf,
  lackingMaterial,
  lumberSpot,
  materialMadeBy,
  missingMaterial,
  nextLevelOf,
  personById,
  place,
  readCity,
  RULES,
  spotsServing,
  stepWeek,
  upgradeBuilding,
  madeByCrew,
  setJob,
  changeJobTarget,
  startStage,
  autoJobs,
  type ActionResult,
  type BuildableKind,
  type Building,
  type BuildingKind,
  type BuildingCategory,
  type Cell,
  type CityReadout,
  type FoodSpot,
  type GameEvent,
  type GameState,
  type Rect,
  type Rng,
  type TutorialStepId,
  setDifficulty,
  type Difficulty,
} from '../core';
import { T } from './strings';
import { categoryKinds, DRAG_TOOLS, isPlaceTool, SPEEDS, type Speed, type Tool } from './tools';
import { readEvents, type GameOut, type Tally } from './events';
import { originFor, sameCell, whyInvalid } from './placement';
import type { ToastOptions, Tone } from './toastQueue';
import { TutorialGuide } from './tutorial';

/** What a view (2D or 3D) does for the session: draw, speak and move its camera. */
export interface SessionView {
  /** A victory or defeat dialog is open: the game stands still and ignores the player. */
  readonly modalOpen: boolean;
  /** The city or the controls changed: redraw the map and the interface from the session. */
  redraw(): void;
  /** Only the tool overlay changed (hover, rotation). */
  overlay(): void;
  toast(msg: string, tone: Tone, opt?: ToastOptions): void;
  /** Effects and interface news (see GameOut). `toast` items are given to `toast` instead. */
  out(o: GameOut): void;
  /** "Onde pôr…": the highlighted places (null clears them). */
  drawSpots(rects: readonly Rect[] | null): void;
  /** The camera glides to bring this footprint to the middle of the free map. */
  glideTo(r: Rect | null): void;
  /** PC keys 3–6: opens a category's strip of the build column. */
  openCategory(c: BuildingCategory): void;
  /** The tutorial sentence (null hides the tutorial). */
  setTutorial(sentence: string | null): void;
}

/** What one drag remembers between the cells it builds on (toasts said once, roads to check). */
export interface DragMemo {
  toastedSilver: boolean;
  /** A touch drag of Demolir skipped something that would lose food (said once). */
  toastedFood: boolean;
  /** A workplace built with nobody free to take it (said once). */
  toastedCrew?: boolean;
  /** Road cells placed during this drag, checked for connection when it ends. */
  roads: Cell[];
}

export const newDrag = (): DragMemo => ({ toastedSilver: false, toastedFood: false, roads: [] });

/** Where the tutorial arrow points: a tool button, or a place on the map. */
export type TutorialPoint = { tool: Tool } | { road: Cell } | { spot: Rect; lift: boolean };

export interface SessionOptions {
  seed: number;
  /** The difficulty (Normal unless told; the title screen may change it before the game begins). */
  difficulty?: Difficulty;
  /** Forces the tutorial ("Ver tutorial de novo"); otherwise it runs while `seen` is false. */
  tutorial: boolean;
  seen: boolean;
  /** Called when the tutorial ends or is skipped (the app stores it). */
  saveSeen?: () => void;
}

/**
 * One game being played, without drawing: the state, the clock and speed, the tool, the tapped
 * building, the tutorial and every player action. The 2D and the 3D views both drive it.
 */
export class Session {
  /** The map seed ("Mesmo mapa" replays it). */
  seed: number;
  readonly state: GameState;
  readonly rng: Rng;
  /** Economy, food forecast and family gate, computed once per refresh. */
  city: CityReadout;
  tool: Tool = 'view';
  /** Non-square buildings (the market) are placed rotated; kept between placements. */
  rotated = false;
  speedIndex = 0;
  /** Seconds into the current week. */
  clock = 0;
  hover: Cell | null = null;
  selected: Cell | null = null;
  /** First-game tutorial (null when seen before or skipped). */
  guide: TutorialGuide | null;
  /** The road the tutorial suggests (chosen once per game). */
  ghost: Cell[];
  /** The fisher or gatherer spot at the end of that road (the gather step points at it). */
  spot: FoodSpot | null;
  /** A free house spot for the tutorial arrow (houses step). */
  houseHint: Cell | null = null;
  /** The lumber step's spot and the road to it, found once when the step starts. */
  lumberHint: FoodSpot | null = null;
  /** The free field spot nearest the altar (field step), found once when the step starts. */
  fieldHint: Cell | null = null;
  /** The tutorial step the camera last went to. */
  private pannedFor: string | null = null;
  readonly tally: Tally = { births: 0, weddings: 0 };
  /** "Onde pôr um mercado": the places where this kind would reach the target are highlighted. */
  spots: { kind: BuildableKind; target: Building } | null = null;
  /** Inside a drag step: builds wait and the city refreshes once at the end. */
  private batching = false;
  private pending = false;
  private view: SessionView | null = null;

  constructor(o: SessionOptions) {
    this.seed = o.seed;
    this.rng = createRng(o.seed);
    this.state = createGame(this.rng, o.difficulty);
    this.guide = o.tutorial || !o.seen ? new TutorialGuide(this.state, o.saveSeen) : null;
    this.spot = this.guide ? foodSpot(this.state) : null;
    this.ghost = this.spot?.road ?? [];
    this.city = readCity(this.state);
    this.saveSeen = o.saveSeen;
  }

  private saveSeen?: () => void;

  /**
   * The game starts (the title screen closed over the city): the tutorial too when it was asked for
   * ("Ver tutorial de novo"), and the camera goes again to the current step.
   */
  begin(tutorial: boolean, difficulty?: Difficulty) {
    if (difficulty) setDifficulty(this.state, difficulty);
    if (tutorial && !this.guide) {
      this.guide = new TutorialGuide(this.state, this.saveSeen);
      this.spot = foodSpot(this.state);
      this.ghost = this.spot?.road ?? [];
    }
    this.pannedFor = null;
    this.refresh();
  }

  /** The view that draws this session (set once it exists). */
  attach(view: SessionView) {
    this.view = view;
  }

  /** A view closing lets go of the session (only if it is the one attached). */
  detach(view: SessionView) {
    if (this.view === view) this.view = null;
  }

  get speed(): Speed {
    return SPEEDS[this.speedIndex];
  }

  private get modal() {
    return this.view?.modalOpen ?? false;
  }

  /** Time passes: the weeks of `dt` seconds at the current speed. True if a week went by. */
  tick(dt: number): boolean {
    const speed = this.modal ? 0 : this.speed;
    // The tutorial holds the weeks on its build steps (the first city is built without hurry).
    const { acc, steps } = advanceClock(this.clock, dt, this.guide?.holdsClock ? 0 : speed);
    this.clock = acc;
    for (let k = 0; k < steps; k++) this.handleEvents(stepWeek(this.state, this.rng));
    if (steps) this.refresh();
    return steps > 0;
  }

  /** Fraction of the current week (0..1). */
  get weekFrac() {
    return this.clock / RULES.weekSeconds;
  }

  handleEvents(events: GameEvent[]) {
    for (const o of readEvents(this.state, events, this.tally)) {
      if (o.do === 'slowDown') {
        if (this.speed === 3) this.speedIndex = SPEEDS.indexOf(1); // slow down once so the player can react
      } else if (o.do === 'marketUnlocked') this.guide?.marketUnlocked();
      else this.emit(o);
    }
  }

  private emit(o: GameOut) {
    if (o.do === 'toast') this.view?.toast(o.msg, o.tone, o.opt);
    else this.view?.out(o);
  }

  /** A toast from the session (hints, failures, warnings). */
  say(msg: string, tone: Tone = 'info') {
    this.view?.toast(msg, tone);
  }

  // ---------- state -> view ----------

  refresh() {
    this.city = readCity(this.state);
    this.checkTutorial();
    this.view?.redraw();
  }

  /** The building the demolish tool would remove now (red under the cursor). */
  get doomed(): Building | null {
    const s = this.state;
    const h = this.tool === 'clear' ? this.hover : null;
    return h && checkClear(s, h.x, h.y).ok ? s.grid[indexOf(s, h.x, h.y)] : null;
  }

  /** The tutorial's marked road on its step (to the food, or to the lumber spot), else none. */
  get guideGhost(): Cell[] {
    const id = this.guide?.step?.id;
    return id === 'road' ? this.ghost : id === 'lumber' ? (this.lumberHint?.road ?? []) : [];
  }

  setHover(cell: Cell | null) {
    if (sameCell(cell, this.hover) || (!cell && !this.hover)) return false;
    this.hover = cell;
    this.view?.overlay();
    return true;
  }

  // ---------- player actions ----------

  selectTool(tool: Tool) {
    if (this.modal) return;
    if (tool === this.tool && isPlaceTool(tool) && tool !== 'road' && canRotate(tool)) {
      this.rotate();
      return;
    }
    if (isPlaceTool(tool) && !this.state.unlocked.includes(tool)) {
      this.say(T.lockedHint(tool));
      return;
    }
    this.tool = tool;
    this.selected = null;
    this.spots = null;
    this.drawSpots();
    this.refresh();
  }

  /** Turns the footprint of the current tool (only non-square buildings). */
  rotate() {
    if (!isPlaceTool(this.tool) || this.tool === 'road' || !canRotate(this.tool)) return;
    this.rotated = !this.rotated;
    this.view?.overlay();
  }

  /**
   * PC keys 3–6: opens the category's strip and picks its first unlocked building; the same key
   * again picks the next one of the category.
   */
  pickCategory(c: BuildingCategory) {
    if (this.modal) return;
    this.view?.openCategory(c);
    const all = categoryKinds(c);
    const open = all.filter((k) => this.state.unlocked.includes(k));
    if (!open.length) {
      this.say(T.lockedHint(all[0]));
      return;
    }
    const k = open.indexOf(this.tool as BuildableKind);
    const next = open[(k + 1) % open.length];
    if (next !== this.tool) this.selectTool(next);
  }

  cycleSpeed() {
    this.setSpeed(SPEEDS[(this.speedIndex + 1) % SPEEDS.length]);
  }

  setSpeed(v: Speed) {
    if (this.modal) return;
    this.speedIndex = SPEEDS.indexOf(v);
    this.refresh();
  }

  /** Picks a building and highlights the free places where it would reach `target` (Rua: just picks it). */
  showSpots(kind: BuildableKind | 'road', target: Building) {
    if (this.tool !== kind) this.selectTool(kind);
    if (this.tool !== kind || kind === 'road') return;
    this.spots = { kind, target };
    const m = materialMadeBy(kind);
    if (!this.drawSpots()) this.say(m ? T.nova.noGatherSpot(m) : T.nova.inspect.noSpot, 'bad');
  }

  /** The highlighted places now (null when there is nothing to show). */
  spotRects(): Rect[] | null {
    const sp = this.spots;
    if (!sp || !this.state.buildings.includes(sp.target)) return null;
    const spots: (Cell & { rotated?: boolean })[] = materialMadeBy(sp.kind) ? gatherSpots(this.state, sp.kind) : spotsServing(this.state, sp.kind, sp.target);
    return spots.map((c) => ({ x: c.x, y: c.y, ...dimsOf(sp.kind, c.rotated) }));
  }

  /** Gives the highlighted places to the view; false if there are none. */
  private drawSpots(): boolean {
    const rects = this.spotRects();
    this.view?.drawSpots(rects);
    return !!rects?.length;
  }

  /**
   * Moves a person to a free job, or leaves them without work (`buildingId` null): "Mudar" on the
   * person's sheet. A market left with nobody says it covers nothing now.
   */
  setJob(personId: number, buildingId: number | null): boolean {
    const s = this.state;
    const was = s.people.find((p) => p.id === personId)?.jobId ?? null;
    if (!setJob(s, personId, buildingId)) return false;
    const left = s.buildings.find((b) => b.id === was);
    if (left && RULES.staffedServices.includes(left.kind) && !s.people.some((p) => p.jobId === left.id)) this.say(T.serviceEmpty(left.kind), 'bad');
    this.refresh();
    return true;
  }

  /** "Começar" in the altar's or the Temple's balloon: pays the next stage and opens its builders' jobs. */
  startStage(): ActionResult {
    const events: GameEvent[] = [];
    const r = startStage(this.state, events);
    if (!r.ok) this.say(T.fail[r.reason], 'bad');
    this.handleEvents(events);
    this.refresh();
    return r;
  }

  /** − / + on a profession in the Profissões panel (see `changeJobTarget`). */
  changeJobTarget(kind: BuildingKind, delta: 1 | -1): boolean {
    if (!changeJobTarget(this.state, kind, delta)) return false;
    this.refresh();
    return true;
  }

  /** "Automático" in the Profissões panel: every profession fills all its jobs again. */
  autoJobs() {
    autoJobs(this.state);
    this.refresh();
  }

  /** Raises the tapped granary, market or workshop one level (Melhorar in its balloon). */
  upgradeAt(cell: Cell) {
    const events: GameEvent[] = [];
    const b = this.state.grid[indexOf(this.state, cell.x, cell.y)];
    const next = b ? nextLevelOf(b) : null;
    const lack = next && lackingMaterial(this.state, next.materials ?? {});
    const r = upgradeBuilding(this.state, cell.x, cell.y, events);
    if (!r.ok) {
      const say = r.reason === 'silver' && next ? T.missingSilver(next.cost) : r.reason === 'materials' && lack ? T.lackingAmount(lack, next?.materials?.[lack] ?? 0, this.state[lack]) : T.fail[r.reason];
      this.say(say, 'bad');
      return;
    }
    if (b) this.emit({ do: 'upgraded', building: b });
    this.handleEvents(events);
    this.refresh();
  }

  /** Demolishes what is on a cell (Demolir in the tapped building's balloon). */
  demolishAt(cell: Cell) {
    const r = this.demolish(cell);
    if (!r.ok) {
      this.say(T.fail[r.reason], 'bad');
      return;
    }
    this.selected = null;
    this.refresh();
  }

  /**
   * Removes what is on a cell (a building, a road or a tree) with its dust, and floats what it cost:
   * the silver of a tree or the food that spoils (a granary, or the road to one). No refresh.
   */
  private demolish(cell: Cell): ActionResult {
    const s = this.state;
    if (!inBounds(s, cell.x, cell.y)) return clearCell(s, cell.x, cell.y);
    const i = indexOf(s, cell.x, cell.y);
    // Read before it is gone: what is removed (the size of the dust) and the food that spoils.
    const b = s.grid[i];
    const tree = !b && !s.roads[i] && !!s.feature[i];
    const lost = foodLostIfRemoved(s, cell.x, cell.y);
    const r = clearCell(s, cell.x, cell.y);
    if (!r.ok) return r;
    const at = b ? { x: b.x, y: b.y, w: b.w, h: b.h } : { x: cell.x, y: cell.y, w: 1, h: 1 };
    this.emit({ do: 'dust', ...at });
    if (tree) this.emit({ do: 'floatBad', ...at, text: `−${RULES.treeClearCost}` });
    else if (lost > 0) this.emit({ do: 'floatBad', ...at, text: T.nova.foodLost(lost) });
    return r;
  }

  /** Closes the tapped building's balloon. */
  deselect() {
    this.selected = null;
    this.spots = null;
    this.drawSpots();
    this.refresh();
  }

  /** A tap with Mover: opens the building's balloon; plain land (or the river) closes it. */
  select(cell: Cell) {
    const s = this.state;
    const i = indexOf(s, cell.x, cell.y);
    const plain = !s.grid[i] && !s.roads[i] && !s.feature[i];
    this.selected = plain ? null : cell;
    this.refresh();
  }

  /** Opens a house's balloon (person sheet, Povo tab); the view moves its camera there. */
  selectHouse(houseId: number): Building | null {
    const b = this.state.buildings.find((o) => o.id === houseId);
    if (!b) return null;
    if (this.tool !== 'view') this.selectTool('view');
    this.selected = { x: b.x, y: b.y };
    this.refresh();
    return b;
  }

  /** A drag builds on several cells: the city refreshes once at the end of `fn`. */
  batch(fn: () => void) {
    this.batching = true;
    try {
      fn();
    } finally {
      this.batching = false;
    }
    if (this.pending) {
      this.pending = false;
      this.refresh();
    }
  }

  /**
   * Uses the current tool on a cell; `first` for the first cell of a gesture, `touch` when a finger
   * did it, `drag` the memory of the drag it belongs to (null for a single tap or release).
   */
  apply(cell: Cell, first: boolean, touch = false, drag: DragMemo | null = null) {
    if (this.tool === 'view') return;
    const s = this.state;
    const o = originFor(this.tool, cell, this.rotated);
    // Continuing a road from an existing one: nothing to build there, and nothing wrong either.
    if (this.tool === 'road' && s.roads[indexOf(s, o.x, o.y)]) return;
    if (this.tool === 'clear') {
      // On touch, Demolir never removes what would spoil food at once: the first touch opens the
      // building's balloon ("Perde N de comida" and its own Demolir, with a second tap).
      if (touch && inBounds(s, o.x, o.y) && foodLostIfRemoved(s, o.x, o.y) > 0) {
        if (first) this.select(o);
        else if (drag && !drag.toastedFood) {
          // A drag passes over it: say why it stayed.
          drag.toastedFood = true;
          this.say(T.demolishKeepsFood, 'bad');
        }
        return;
      }
      // Any other touch or click with Demolir closes a balloon it opened.
      if (first && this.selected) {
        this.selected = null;
        this.refresh();
      }
    }
    const r: ActionResult = this.tool === 'clear' ? this.demolish(o) : place(s, this.tool, o.x, o.y, this.rotated, this.rng);
    if (r.ok) {
      if (this.tool === 'road') {
        if (drag) drag.roads.push(o);
        else this.warnLooseRoads([o]); // a tap ends the gesture before placing
      }
      if (this.tool !== 'clear') {
        const b = s.grid[indexOf(s, o.x, o.y)];
        this.emit({ do: 'placed', ...(b ? { x: b.x, y: b.y, w: b.w, h: b.h } : { x: o.x, y: o.y, w: 1, h: 1 }), temple: this.tool === 'temple' });
      }
      // A workplace nobody is free to take: say how to staff it (the player moves someone).
      const built = this.tool !== 'clear' ? s.grid[indexOf(s, o.x, o.y)] : null;
      if (built && built.connected && madeByCrew(built.kind) && !drag?.toastedCrew && !s.people.some((p) => p.jobId === built.id)) {
        if (drag) drag.toastedCrew = true;
        this.say(T.noCrewBuilt(built.kind), 'bad');
      }
      if (this.spots && this.tool !== 'road') {
        this.spots = null;
        this.drawSpots();
      }
      if (this.batching) this.pending = true;
      else this.refresh();
      return;
    }
    // Short of silver or a material: said once per drag (the drag may run out half way).
    if (r.reason === 'silver' || r.reason === 'materials') {
      if (drag?.toastedSilver) return;
      if (drag) drag.toastedSilver = true;
      const m = isPlaceTool(this.tool) ? missingMaterial(s, this.tool) : null;
      this.say(r.reason === 'materials' && m ? T.lacking(m) : T.fail[r.reason], 'bad');
    } else if (first) {
      this.say(r.reason === 'invalid' ? whyInvalid(s, this.tool, o, this.rotated) : T.fail[r.reason], 'bad');
    }
  }

  /** Warns once if any road just built is not connected to the altar. */
  warnLooseRoads(cells: Cell[]) {
    const s = this.state;
    if (cells.some((c) => !s.network[indexOf(s, c.x, c.y)])) this.say(T.looseRoad, 'bad');
  }

  /** Whether the tool builds by dragging (Rua, Casa, Campo, Demolir). */
  get drags() {
    return DRAG_TOOLS.has(this.tool);
  }

  // ---------- tutorial ----------

  skipTutorial() {
    if (!this.guide) return;
    this.guide.skip();
    this.guide = null;
    this.view?.setTutorial(null);
    this.refresh();
  }

  /** A tutorial sentence; the house and wedding steps name the caravan's engaged couple. */
  private stepText(id: TutorialStepId): string {
    const [a, b] = this.state.start.couple.map((p) => this.nameOf(p));
    if ((id === 'house' || id === 'wedding') && a && b) return T.tutorial.couple[id](a, b);
    return T.tutorial.step[id];
  }

  /** Name of a person alive or in the records ('' when unknown). */
  nameOf(id: number | null): string {
    return personById(this.state, id)?.name ?? '';
  }

  /** Moves the tutorial past finished steps and shows the current one. */
  private checkTutorial() {
    const guide = this.guide;
    if (!guide) return;
    const change = guide.update(this.state);
    if (change === 'done') this.say(T.tutorial.done, 'good');
    const step = guide.step;
    if (!step) {
      this.view?.setTutorial(null);
      return;
    }
    if (step.id === 'house') this.houseHint = houseHint(this.state);
    if (step.id !== this.pannedFor && step.id === 'lumber') this.lumberHint = lumberSpot(this.state);
    this.view?.setTutorial(this.lumberRoadLeft() ? T.tutorial.lumberRoad : this.stepText(step.id));
    if (step.id !== this.pannedFor) {
      this.pannedFor = step.id;
      if (step.id === 'field') this.fieldHint = fieldHint(this.state);
      this.view?.glideTo(this.stepSpot(step.id));
    }
  }

  /** On the lumber step, part of the marked road to its spot is still to build. */
  lumberRoadLeft(): boolean {
    const road = this.guide?.step?.id === 'lumber' ? (this.lumberHint?.road ?? []) : [];
    return road.some((c) => !this.state.roads[indexOf(this.state, c.x, c.y)]);
  }

  /** The place a tutorial step is about (the road, the food spot, the field, lumber or house spot), if any. */
  stepSpot(id: string): Rect | null {
    if (id === 'road' && this.ghost.length) {
      const xs = this.ghost.map((c) => c.x);
      const ys = this.ghost.map((c) => c.y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1 };
    }
    if (id === 'gather' && this.spot) return { ...this.spot, ...dimsOf(this.spot.kind) };
    if (id === 'field' && this.fieldHint) return { ...this.fieldHint, ...dimsOf('field') };
    if (id === 'house' && this.houseHint) return { ...this.houseHint, ...dimsOf('house') };
    if (id === 'lumber' && this.lumberHint) return { ...this.lumberHint, ...dimsOf('lumber') };
    return null;
  }

  /**
   * Where the tutorial arrow points now: the step's tool button until it is picked, then the next
   * road cell to build or the step's spot (`lift` on touch for a single building). Null: no arrow.
   */
  tutorialPoint(touch: boolean): TutorialPoint | null {
    const step = this.guide?.step;
    if (!step) return null;
    // A marked road to follow: the road step's, or the one to a lumber spot past the grove's edge (Rua first).
    const road = step.id === 'road' ? this.ghost : this.lumberRoadLeft() ? this.lumberHint!.road : null;
    const tool = road ? 'road' : step.tool;
    if (tool && this.tool !== tool && this.tool !== step.alt) return { tool };
    if (road) {
      const cell = road.find((c) => !this.state.roads[indexOf(this.state, c.x, c.y)]);
      return cell ? { road: cell } : null;
    }
    if (step.id === 'gather' && this.tool !== this.spot?.kind) return null;
    const spot = this.stepSpot(step.id);
    if (!spot || !isPlaceTool(this.tool) || this.tool === 'road') return null;
    return { spot, lift: touch && !DRAG_TOOLS.has(this.tool) };
  }
}

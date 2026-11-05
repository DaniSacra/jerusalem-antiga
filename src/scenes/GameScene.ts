import Phaser from 'phaser';
import {
  advanceClock,
  campPlazaSpot,
  canRotate,
  checkClear,
  clearCell,
  readCity,
  createGame,
  createRng,
  dimsOf,
  fieldHarvest,
  fieldHint,
  foodLostIfRemoved,
  type CityReadout,
  foodSpot,
  houseHint,
  type FoodSpot,
  inBounds,
  indexOf,
  place,
  RULES,
  spotsServing,
  stepWeek,
  templeSpotsNear,
  templeRoadSpot,
  templeWaitsForGoal,
  personById,
  seasonOf,
  upgradeBuilding,
  nextLevelOf,
  grownUpThisWeek,
  type TutorialStepId,
  BUILDINGS,
  type TempleSpot,
  type ActionResult,
  type BuildableKind,
  type BuildingCategory,
  type Building,
  type Cell,
  type Economy,
  type GameEvent,
  type GameState,
  type Rng,
} from '../core';
import { Ambient } from '../render/Ambient';
import { CameraRig } from '../render/CameraRig';
import { DayNight } from '../render/DayNight';
import { Effects, milestoneSite, spoilSite } from '../render/Effects';
import { Haulers } from '../render/Haulers';
import { footCenter, getRotation, gridToWorld, setRotation, worldToCell, worldToGrid } from '../render/iso';
import { VIEW_CY } from '../render/layout';
import { MapView, originFor, type OverlayGuide } from '../render/MapView';
import { TutorialGuide, tutorialSeen, type TutorialTarget } from '../render/Tutorial';
import VISUAL from '../data/visual.json';
import { RoadWear } from '../render/RoadWear';
import { C, CSS } from '../render/palette';
import { T } from '../render/strings';
import { generateTextures, HEIGHT, TEX } from '../render/textures';
import { generateUiArt, setHandCursor } from '../render/uiArt';
import { CATEGORY_KEYS, categoryKinds, DRAG_TOOLS, isPlaceTool, SPEEDS, TOOL_KEYS, type Speed, type Tool } from '../render/tools';
import { Walkers } from '../render/Walkers';
import { mulColor, SeasonClock } from '../render/Seasons';
import type { Weather } from '../render/Weather';
import type { UIScene, UiHost } from './UIScene';

const TAP_SLOP = 10;
/** A touch drag only starts building after this long with one finger, so a pinch never builds. */
const TOUCH_BUILD_DELAY = 150;
/** On touch, single buildings are aimed this far above the finger so the preview is not hidden by it. */
const TOUCH_LIFT = 90;
const sameCell = (a: Cell | null, b: Cell | null) => !!a && !!b && a.x === b.x && a.y === b.y;

/** Cells from a to b (excluding a), stepping orthogonally so dragged roads stay connected. */
function orthoSteps(a: Cell, b: Cell): Cell[] {
  const out: Cell[] = [];
  let { x, y } = a;
  while (x !== b.x || y !== b.y) {
    if (Math.abs(b.x - x) >= Math.abs(b.y - y)) x += Math.sign(b.x - x);
    else y += Math.sign(b.y - y);
    out.push({ x, y });
  }
  return out;
}

interface Gesture {
  id: number;
  start: Cell | null;
  last: Cell | null;
  downX: number;
  downY: number;
  /** Time of the press (ms), for TOUCH_BUILD_DELAY. */
  downAt: number;
  touch: boolean;
  lastX: number;
  lastY: number;
  moved: boolean;
  applied: boolean;
  cancelled: boolean;
  toastedSilver: boolean;
  /** A touch drag of Demolir skipped something that would lose food (said once). */
  toastedFood: boolean;
  /** Road cells placed during this gesture, checked for connection when it ends. */
  roads: Cell[];
  /** The drag went over the interface after building: it stopped there (a toast says so). */
  cutByUi: boolean;
}

/** Dev builds: `?seed=N` fixes the map (the visual tests use it); null otherwise. */
function devSeed(): number | null {
  if (!import.meta.env.DEV) return null;
  const v = new URLSearchParams(location.search).get('seed');
  return v === null ? null : Number(v) >>> 0;
}

export class GameScene extends Phaser.Scene implements UiHost {
  private state!: GameState;
  private rng!: Rng;
  /** Economy, food forecast and family gate, computed once per refresh. */
  private city!: CityReadout;
  private get eco(): Economy {
    return this.city.eco;
  }
  private map!: MapView;
  private walkers!: Walkers;
  private fx!: Effects;
  /** Grain carriers in the harvest, fishermen and fruit gatherers (only a sight). */
  private haulers!: Haulers;
  private rig!: CameraRig;
  private dayNight!: DayNight;
  private wear!: RoadWear;
  private ambient!: Ambient;
  private ui: UIScene | null = null;
  /** Rain, snow and what the wind carries, on its own overlay scene (null until it starts). */
  private weather: Weather | null = null;
  /** The look of the year (seasons, and the rare snowy winters and droughts drawn from the map seed). */
  private seasons!: SeasonClock;

  private tool: Tool = 'view';
  /** Non-square buildings (the market) are placed rotated; kept between placements. */
  private rotated = false;
  private speedIndex = 0;
  private clock = 0;
  private hover: Cell | null = null;
  private selected: Cell | null = null;
  /** First-game tutorial (null when seen before or skipped). */
  private guide: TutorialGuide | null = null;
  /** The road the tutorial suggests (chosen once per game). */
  private ghost: Cell[] = [];
  /** The fisher or gatherer spot at the end of that road (the gather step points at it). */
  private spot: FoodSpot | null = null;
  /** A free house spot for the tutorial arrow (houses step). */
  private houseHint: Cell | null = null;
  /** The free field spot nearest the altar (field step), found once when the step starts. */
  private fieldHint: Cell | null = null;
  /** The camera follows the first family for a moment (family step). */
  private follow: { id: number; until: number } | null = null;
  private followed = false;
  /** Births and weddings of this game (the victory screen tells them). */
  private births = 0;
  private weddings = 0;
  /** The camera glides to the place of a new tutorial step (world point), and which step it did it for. */
  private pan: { x: number; y: number } | null = null;
  private pannedFor: string | null = null;
  private gesture: Gesture | null = null;
  /** Inside a drag step: builds wait and the city refreshes once at the end. */
  private batching = false;
  private pending = false;
  /** Where the temple fits while it is chosen (see updateTempleAreas). */
  private templeAreas: TempleSpot[] = [];
  /** "Onde pôr um mercado": the places where this kind would reach the target are highlighted. */
  private spots: { kind: BuildableKind; target: Building } | null = null;
  private touches = new Map<number, { x: number; y: number }>();
  private pinch: { dist: number; zoom: number; midX: number; midY: number } | null = null;
  private rightPan: { id: number; x: number; y: number } | null = null;
  /** Mouse cursor shown now (see updateCursor), and whether the mouse is over the interface. */
  private cursor: 'open' | 'grab' | null = null;
  private pointerOverUi = false;

  constructor() {
    super('game');
  }

  private get speed(): Speed {
    return SPEEDS[this.speedIndex];
  }

  /** `tutorial` forces the tutorial ("Ver tutorial de novo"); otherwise it runs until seen once. */
  create(data?: { tutorial?: boolean }) {
    generateTextures(this);
    generateUiArt(this);
    const seed = devSeed() ?? (Math.random() * 2 ** 32) >>> 0;
    this.rng = createRng(seed);
    this.seasons = new SeasonClock(seed);
    this.state = createGame(this.rng);
    this.guide = data?.tutorial || !tutorialSeen() ? new TutorialGuide(this.state) : null;
    this.spot = this.guide ? foodSpot(this.state) : null;
    this.ghost = this.spot?.road ?? [];
    this.houseHint = null;
    this.fieldHint = null;
    this.follow = null;
    this.followed = false;
    this.births = 0;
    this.weddings = 0;
    this.pan = null;
    this.pannedFor = null;
    this.city = readCity(this.state);
    this.tool = 'view';
    this.rotated = false;
    this.speedIndex = 0;
    this.clock = 0;
    this.ui = null;
    this.cursor = null;
    this.pointerOverUi = false;
    this.weather = null;
    this.selected = null;
    this.spots = null;

    setRotation(0);
    this.cameras.main.setBackgroundColor(C.bg);
    this.wear = new RoadWear(this.state);
    this.map = new MapView(this, this.state, this.wear);
    this.dayNight = new DayNight(this);
    this.walkers = new Walkers(this, this.wear);
    this.haulers = new Haulers(this);
    this.haulers.sync(this.state);
    this.ambient = new Ambient(this, (x, y, r) => this.walkers.near(x, y, r));
    this.ambient.sync(this.state);
    this.fx = new Effects(this);
    this.rig = new CameraRig(this.cameras.main);
    const a = this.state.buildings.find((b) => b.kind === 'altar')!;
    const altar = footCenter(a.x, a.y, a.w, a.h);
    this.rig.centerAt(altar.x, altar.y - 20, this.cameras.main.width / 2, VIEW_CY);

    this.setupInput();
    this.scene.launch('weather', { host: this });
    this.scene.launch('ui', { host: this });
    if (import.meta.env.DEV) {
      Promise.all([import('../core'), import('../render/iso'), import('../render/layout')]).then(([core, iso, layout]) =>
        Object.assign(window, { game: this, state: this.state, core, iso, layout }),
      );
    }
  }

  attachWeather(w: Weather) {
    this.weather = w;
  }

  attachUi(ui: UIScene) {
    this.ui = ui;
    // The opening sentence first, with the caravan the seed drew (the game does not pause): the
    // warnings of the first refresh wait behind it.
    // The weeks are the forecast's, the same the food pill and goal 1 show.
    const c = this.state.start;
    const weeks = this.city.forecast?.weeks ?? c.foodWeeks;
    if (this.state.week === 0) {
      ui.toast(T.caravan(c.families, weeks), 'good', { big: true, ms: 5000 });
      // The tutorial's house step speaks of the couple; out of it, a toast names them.
      const [a, b] = c.couple.map((id) => personById(this.state, id)?.name);
      if (a && b && !this.guide) ui.toast(T.wantToMarry(a, b), 'good', { ms: 5000 });
    }
    this.selectTool('view');
  }

  update(_time: number, delta: number) {
    const speed = this.ui?.modalOpen ? 0 : this.speed;
    // The tutorial holds the weeks on its build steps (the first city is built without hurry);
    // the city stays alive around it.
    const { acc, steps } = advanceClock(this.clock, delta / 1000, this.guide?.holdsClock ? 0 : speed);
    this.clock = acc;
    for (let k = 0; k < steps; k++) this.handleEvents(stepWeek(this.state, this.rng));
    if (steps) this.refresh();
    // Seasons and weather: the ground, trees, river and roads of the season, wet ground and
    // puddles after rain, a tint over the world and the sky, rain or snow, heat shimmer in summer.
    const look = this.seasons.at(this.state.week, this.clock / RULES.weekSeconds, this.state);
    const w = this.weather;
    w?.update((delta / 1000) * speed, look, this.dayNight.degraded);
    this.map.setSeason(look, w?.wet ?? 0, w?.puddles ?? 0);
    this.dayNight.setExtraTint(mulColor(look.tint, w?.tint ?? 0xffffff), mulColor(look.sky, w?.skyTint ?? 0xffffff));
    this.dayNight.setShimmer(w && w.sky !== 'clear' ? 0 : look.shimmer);
    this.dayNight.update((delta / 1000) * speed, delta);
    const light = this.dayNight.current;
    if (this.dayNight.degraded !== this.map.degraded) {
      this.map.degraded = this.dayNight.degraded;
      this.map.sync(this.state, this.eco);
    }
    this.map.update(this.time.now, this.rig.zoom, (delta / 1000) * speed, light.night);
    this.ambient.update(this.time.now / 1000, (delta / 1000) * speed, light.night, Math.max(look.clouds, w?.clouds ?? 0), look);
    this.walkers.update(delta, this.state, this.eco.residents, speed, this.clock / RULES.weekSeconds, light.walkers * (this.weather?.walkers ?? 1));
    this.haulers.update(delta / 1000, speed);
    if (this.guide) this.updateTutorial(delta);
    else if (this.pan && (this.gesture || this.glide(this.pan, delta))) this.pan = null; // the camera going to a temple area
    this.ui?.setSlow(this.dayNight.degraded);
    this.ui?.setDrought(look.drought);
  }

  // ---------- state -> view ----------

  private refresh() {
    this.city = readCity(this.state);
    this.updateTempleAreas();
    this.map.sync(this.state, this.eco);
    this.ambient.sync(this.state);
    this.haulers.sync(this.state);
    this.checkTutorial();
    this.drawOverlay();
    this.ui?.refresh(this.state, this.city, this.speed, this.tool, this.guide?.running ?? false, this.selected);
  }

  /** A house that grew (a level or a baby): it hops, a ring of light spreads and the gain floats up. */
  private cheerHouse(x: number, y: number, gain: string) {
    const b = this.state.grid[indexOf(this.state, x, y)];
    const c = footCenter(x, y);
    this.map.bounce(this.state, x, y);
    this.fx.ring(c.x, c.y);
    this.fx.floatText(c.x, c.y - (b ? this.map.heightOf(b) : 20) - 8, gain);
  }

  private handleEvents(events: GameEvent[]) {
    /** Where houses rose this week, by level (a milestone celebrates the house that reached it). */
    const ups = new Map<number, Cell>();
    for (const e of events) {
      switch (e.type) {
        case 'houseUp':
          ups.set(e.level, { x: e.x, y: e.y });
          this.cheerHouse(e.x, e.y, `+${e.delta}`);
          break;
        case 'houseDown': {
          const c = footCenter(e.x, e.y);
          this.fx.floatText(c.x, c.y - 30, T.houseDown(e.delta, e.famine), CSS.bad);
          break;
        }
        case 'famineStart':
          this.ui?.toast(T.famine, 'bad');
          break;
        case 'goal':
          this.ui?.toast(T.goalDone(e.reward, e.unlock), 'good');
          if (e.unlock === 'market') this.guide?.marketUnlocked();
          if (e.unlock && T.unlocked[e.unlock]) this.ui?.toast(T.unlocked[e.unlock]!, 'good');
          if (e.unlock) this.ui?.unlocked(e.unlock);
          break;
        case 'victory':
          this.ui?.showVictory(e.week, e.residents, this.births, this.weddings);
          break;
        case 'familyLeft':
          this.walkers.leave(this.state, e.x, e.y);
          this.ui?.toast(T.familyLeft(e.reason, e.name), 'bad');
          break;
        case 'debtStart':
          this.ui?.toast(T.debtStart, 'bad');
          if (this.speed === 3) this.speedIndex = SPEEDS.indexOf(1); // slow down once so the player can react
          break;
        case 'debtEnd':
          this.ui?.toast(T.debtEnd, 'good');
          break;
        case 'defeat':
          this.ui?.showDefeat(e.week, e.peak);
          break;
        case 'season':
          this.ui?.toast(T.seasonStart[e.season], 'info');
          break;
        case 'milestone': {
          const b = milestoneSite(this.state, e.id, ups);
          this.map.shine(b.id);
          this.fx.milestone(this.state, b, this.map.heightOf(b));
          // The first child of the city to come of age is named.
          const grown = e.id === 'firstGrownUp' ? grownUpThisWeek(this.state) : null;
          if (grown) this.ui?.toast(T.grownUp(grown.name, grown.sex === 'f'), 'good');
          else this.ui?.milestone(e.id);
          break;
        }
        case 'spoilStart': {
          const b = spoilSite(this.state);
          const c = footCenter(b.x, b.y, b.w, b.h);
          this.fx.spoil(c.x, c.y - 12);
          break;
        }
        case 'harvestStart':
          // A golden ring on every field that starts harvesting.
          for (const b of this.state.buildings) {
            if (b.kind !== 'field' || fieldHarvest(this.state, b, this.state.week - 1) <= 0) continue;
            const c = footCenter(b.x, b.y, b.w, b.h);
            this.fx.ring(c.x, c.y, C.grain, 2.4);
          }
          break;
        case 'wedding':
          this.weddings++;
          this.ui?.toast(T.wedding(this.nameOf(e.a), this.nameOf(e.b)), 'good');
          break;
        case 'birth': {
          this.births++;
          const p = personById(this.state, e.id);
          if (p) this.ui?.toast(T.birth(p.name, p.sex === 'f', this.nameOf(p.fatherId), this.nameOf(p.motherId)), 'info');
          this.cheerHouse(e.x, e.y, '+1');
          break;
        }
        case 'death':
          this.ui?.toast(T.death(this.nameOf(e.id), e.age), 'quiet');
          break;
        case 'coupleLeft':
          this.ui?.toast(T.coupleLeft(this.nameOf(e.a), this.nameOf(e.b)), 'bad');
          break;
        case 'caravanAnnounced':
          this.ui?.toast(T.caravanAnnounced(e.families, seasonOf(e.week)), 'info');
          break;
        case 'caravanArrived':
          this.ui?.toast(T.caravanArrived(e.housed, e.left), e.left ? 'info' : 'good');
          break;
        case 'buildingUp': {
          const b = this.state.grid[indexOf(this.state, e.x, e.y)];
          if (b) this.ui?.toast(T.buildingUp(BUILDINGS[b.kind].name, e.level), 'good');
          break;
        }
      }
    }
  }

  // ---------- UI host ----------

  selectTool(tool: Tool) {
    if (this.ui?.modalOpen) return;
    if (tool === this.tool && isPlaceTool(tool) && tool !== 'road' && canRotate(tool)) {
      this.rotate();
      return;
    }
    if (isPlaceTool(tool) && !this.state.unlocked.includes(tool)) {
      this.ui?.hint(T.lockedHint(tool));
      return;
    }
    this.tool = tool;
    this.selected = null;
    this.spots = null;
    this.drawSpots();
    this.refresh();
    if (tool !== 'temple') return;
    if (!this.templeAreas.some((a) => a.ready)) this.ui?.hint(this.templeAreas.length ? T.noTempleSpotRoad : T.noTempleSpot, true);
    // The camera goes to the best area, so it is never off screen.
    const first = this.templeAreas[0];
    if (first) this.pan = footCenter(first.x, first.y, dimsOf('temple').w, dimsOf('temple').h);
  }

  /**
   * While the temple is chosen: where it fits (nearest the altar first), at most
   * `maxTempleSpots` areas that do not overlap. Redone on each refresh, never per frame.
   */
  private updateTempleAreas() {
    const areas: TempleSpot[] = [];
    if (this.tool === 'temple') {
      const { w, h } = dimsOf('temple');
      const apart = (a: Cell, b: Cell) => Math.abs(a.x - b.x) >= w || Math.abs(a.y - b.y) >= h;
      for (const a of templeSpotsNear(this.state)) {
        if (areas.length >= VISUAL.temple.maxTempleSpots) break;
        if (areas.every((b) => apart(a, b))) areas.push(a);
      }
    }
    // None near the roads: the free place a road can reach soonest, with that road marked.
    const far = this.tool === 'temple' && !areas.length ? templeRoadSpot(this.state) : null;
    if (far) areas.push(far);
    this.templeAreas = areas;
    this.map.setTempleAreas(areas, far?.road ?? []);
  }

  /** Screen point of the center of a grid footprint (UI coordinates) and the camera zoom. */
  cellScreen(x: number, y: number, w: number, h: number) {
    const p = footCenter(x, y, w, h);
    return { ...this.toScreen(p.x, p.y), zoom: this.cameras.main.zoom };
  }

  /** Picks a building and highlights the free places where it would reach `target` (Rua: just picks it). */
  showSpots(kind: BuildableKind | 'road', target: Building) {
    if (this.tool !== kind) this.selectTool(kind);
    if (this.tool !== kind || kind === 'road') return;
    this.spots = { kind, target };
    if (!this.drawSpots()) this.ui?.hint(T.nova.inspect.noSpot, true);
  }

  /** Draws the highlighted places (again after the map is rebuilt); false if there are none. */
  private drawSpots(): boolean {
    const sp = this.spots;
    if (!sp || !this.state.buildings.includes(sp.target)) {
      this.map.clearSpots();
      return false;
    }
    const rects = spotsServing(this.state, sp.kind, sp.target).map((c) => ({ x: c.x, y: c.y, ...dimsOf(sp.kind, c.rotated) }));
    this.map.showSpots(rects);
    return rects.length > 0;
  }

  /** Demolishes what is on a cell (Demolir in the tapped building's balloon). */
  /** Raises the tapped granary, market or workshop one level (Melhorar in its balloon). */
  upgradeAt(cell: Cell) {
    const events: GameEvent[] = [];
    const b = this.state.grid[indexOf(this.state, cell.x, cell.y)];
    const cost = b ? nextLevelOf(b)?.cost : undefined;
    const r = upgradeBuilding(this.state, cell.x, cell.y, events);
    if (!r.ok) {
      this.ui?.toast(r.reason === 'silver' && cost !== undefined ? T.missingSilver(cost) : T.fail[r.reason], 'bad');
      return;
    }
    if (b) {
      const c = footCenter(b.x, b.y, b.w, b.h);
      this.map.bounce(this.state, b.x, b.y);
      this.fx.ring(c.x, c.y, C.ui.goldLight, Math.max(b.w, b.h));
    }
    this.handleEvents(events);
    this.refresh();
  }

  demolishAt(cell: Cell) {
    const r = this.demolish(cell);
    if (!r.ok) {
      this.ui?.toast(T.fail[r.reason], 'bad');
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
    const c = b ? footCenter(b.x, b.y, b.w, b.h) : footCenter(cell.x, cell.y);
    this.fx.dust(c.x, c.y, b ? Math.max(b.w, b.h) : 1);
    if (tree) this.fx.floatText(c.x, c.y - 30, `−${RULES.treeClearCost}`, CSS.bad);
    else if (lost > 0) this.fx.floatText(c.x, c.y - 30, T.nova.foodLost(lost), CSS.bad);
    return r;
  }

  /** Moves the camera to a house (at once) and opens its balloon (person sheet, Povo tab). */
  showHouse(houseId: number) {
    const b = this.state.buildings.find((o) => o.id === houseId);
    if (!b) return;
    if (this.tool !== 'view') this.selectTool('view');
    const at = this.ui?.freeCenter() ?? { x: this.cameras.main.width / 2, y: VIEW_CY };
    const c = footCenter(b.x, b.y, b.w, b.h);
    this.rig.centerAt(c.x, c.y, at.x, at.y);
    this.pan = null;
    this.selected = { x: b.x, y: b.y };
    this.refresh();
  }

  /** The tapped building's balloon is too wide beside it: the camera glides so the building goes `dx` screen px sideways. */
  nudge(dx: number) {
    const at = this.ui?.freeCenter() ?? { x: this.cameras.main.width / 2, y: VIEW_CY };
    this.pan = this.rig.toWorld(at.x - dx, at.y);
  }

  /** Closes the tapped building's balloon. */
  deselect() {
    this.selected = null;
    this.spots = null;
    this.drawSpots();
    this.refresh();
  }

  /** Turns the footprint of the current tool (only non-square buildings). */
  rotate() {
    if (!isPlaceTool(this.tool) || this.tool === 'road' || !canRotate(this.tool)) return;
    this.rotated = !this.rotated;
    this.drawOverlay();
  }

  /** Turns the view a quarter turn (1 = clockwise, -1 = counterclockwise), keeping the same spot centered. */
  turnMap(dir: 1 | -1) {
    if (this.ui?.modalOpen) return;
    const cam = this.cameras.main;
    const sx = cam.width / 2;
    const sy = VIEW_CY;
    const w = this.rig.toWorld(sx, sy);
    const g = worldToGrid(w.x, w.y);
    setRotation(getRotation() + dir);
    this.map.destroy();
    this.map = new MapView(this, this.state, this.wear);
    this.map.degraded = this.dayNight.degraded;
    this.ambient.rebuild(this.state);
    this.drawSpots();
    const n = gridToWorld(g.x, g.y);
    this.rig.centerAt(n.x, n.y, sx, sy);
    this.refresh();
  }

  /**
   * PC keys 3–6: opens the category's strip and picks its first unlocked building; the same key
   * again picks the next one of the category.
   */
  pickCategory(c: BuildingCategory) {
    if (this.ui?.modalOpen) return;
    this.ui?.openCategory(c);
    const all = categoryKinds(c);
    const open = all.filter((k) => this.state.unlocked.includes(k));
    if (!open.length) {
      this.ui?.hint(T.lockedHint(all[0]));
      return;
    }
    const k = open.indexOf(this.tool as BuildableKind);
    const next = open[(k + 1) % open.length];
    if (next !== this.tool) this.selectTool(next);
  }

  /** The player changed the display options (day and night, miniature blur). */
  applySettings() {
    this.dayNight.applySettings();
  }

  /** New map, new seed: back to the start of the game. */
  restart() {
    this.scene.stop('ui');
    this.scene.stop('weather');
    this.scene.restart();
  }

  cycleSpeed() {
    this.setSpeed(SPEEDS[(this.speedIndex + 1) % SPEEDS.length]);
  }

  setSpeed(v: Speed) {
    if (this.ui?.modalOpen) return;
    this.speedIndex = SPEEDS.indexOf(v);
    this.refresh();
  }

  // ---------- tutorial ----------

  skipTutorial() {
    if (!this.guide) return;
    this.guide.skip();
    this.guide = null;
    this.ui?.setTutorial(null);
    this.refresh();
  }

  tutorialOk() {
    this.refresh();
  }

  /** A tutorial sentence; the house and wedding steps name the caravan's engaged couple. */
  private stepText(id: TutorialStepId): string {
    const [a, b] = this.state.start.couple.map((p) => this.nameOf(p));
    if ((id === 'house' || id === 'wedding') && a && b) return T.tutorial.couple[id](a, b);
    return T.tutorial.step[id];
  }

  /** Name of a person alive or in the records ('' when unknown). */
  private nameOf(id: number | null): string {
    return personById(this.state, id)?.name ?? '';
  }

  private drawOverlay() {
    const id = this.guide?.step?.id;
    const guide: OverlayGuide | null = id === 'road' || id === 'house' ? { ghost: id === 'road' ? this.ghost : [], houseSpots: id === 'house' } : null;
    this.map.showOverlay(this.state, this.tool, this.hover, this.selected, this.rotated, guide);
    // The building the demolish tool would remove turns red.
    const s = this.state;
    const h = this.tool === 'clear' ? this.hover : null;
    const doomed = h && checkClear(s, h.x, h.y).ok ? s.grid[indexOf(s, h.x, h.y)] : null;
    this.map.highlightDemolish(doomed);
    this.updateCursor();
  }

  /** Mouse only: the open hand over the map with Mover, the closed hand while dragging the map. */
  private updateCursor() {
    const panning = !!this.rightPan || (this.tool === 'view' && !!this.gesture && this.gesture.moved && !this.gesture.touch);
    const mode = panning ? 'grab' : this.tool === 'view' && !this.pointerOverUi ? 'open' : null;
    if (mode === this.cursor) return;
    this.cursor = mode;
    setHandCursor(this, mode);
  }

  /** Moves the tutorial past finished steps and shows the current one. */
  private checkTutorial() {
    const guide = this.guide;
    if (!guide) return;
    const change = guide.update(this.state);
    if (change === 'done') this.ui?.toast(T.tutorial.done, 'good');
    const step = guide.step;
    if (!step) {
      this.ui?.setTutorial(null);
      return;
    }
    if (step.id === 'house') this.houseHint = houseHint(this.state);
    this.ui?.setTutorial(this.stepText(step.id), false);
    if (step.id !== this.pannedFor) {
      this.pannedFor = step.id;
      if (step.id === 'field') this.fieldHint = fieldHint(this.state);
      const at = this.stepSpot(step.id);
      this.pan = at && footCenter(at.x, at.y, at.w, at.h);
    }
  }

  /** The place a tutorial step is about (the road, the food spot, the field, plaza or house spot), if any. */
  private stepSpot(id: string): (Cell & { w: number; h: number }) | null {
    if (id === 'road' && this.ghost.length) {
      const xs = this.ghost.map((c) => c.x);
      const ys = this.ghost.map((c) => c.y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1 };
    }
    if (id === 'gather' && this.spot) return { ...this.spot, ...dimsOf(this.spot.kind) };
    if (id === 'field' && this.fieldHint) return { ...this.fieldHint, ...dimsOf('field') };
    if (id === 'plaza') return { ...campPlazaSpot(), ...dimsOf('plaza') };
    if (id === 'house' && this.houseHint) return { ...this.houseHint, ...dimsOf('house') };
    return null;
  }

  /** Per frame: the arrow follows the map under the camera, and the camera follows the first family. */
  private updateTutorial(delta: number) {
    const step = this.guide!.step;
    if (step?.id === 'wedding' && !this.followed && this.state.families.length) {
      this.follow = { id: this.state.families[0].id, until: this.time.now + VISUAL.tutorial.followSeconds * 1000 };
      this.followed = true;
    }
    if (this.gesture) this.pan = null; // a press on the map (a road being dragged) stops the glide under it
    if (this.follow) {
      const p = this.walkers.familyPos(this.follow.id);
      if (!p || this.time.now > this.follow.until) this.follow = null;
      else this.glide(p, delta);
    } else if (this.pan && this.glide(this.pan, delta)) this.pan = null;
    this.ui?.pointTutorial(step ? this.tutorialTarget() : null);
  }

  /**
   * Moves the camera a step toward bringing a world point to the middle of the free map (clear of
   * the top bar, the column, the tutorial bubble and the toasts); true once it is there.
   */
  private glide(p: { x: number; y: number }, delta: number): boolean {
    const cam = this.cameras.main;
    const at = this.ui?.freeCenter() ?? { x: cam.width / 2, y: VIEW_CY };
    const c = this.rig.toWorld(at.x, at.y);
    const k = Math.min(1, (delta / 1000) * 4);
    this.rig.centerAt(c.x + (p.x - c.x) * k, c.y + (p.y - c.y) * k, at.x, at.y);
    // There, or held back by the map edge (the camera no longer moves).
    const now = this.rig.toWorld(at.x, at.y);
    return Math.hypot(p.x - c.x, p.y - c.y) < 2 || Math.hypot(now.x - c.x, now.y - c.y) < 0.05;
  }

  /** Where the arrow points: the step's tool button until it is picked, then the spot on the map. */
  private tutorialTarget(): TutorialTarget | null {
    const step = this.guide!.step!;
    const tool = step.tool;
    if (tool && this.tool !== tool && this.tool !== step.alt) {
      const b = this.ui?.buttonOf(tool);
      if (!b) return null;
      if (b.side === 'bottom') return { x: b.x, y: b.y - b.w / 2 - 4, dir: 'down' };
      return b.side === 'right' ? { x: b.x - b.w / 2 + 4, y: b.y, dir: 'right' } : { x: b.x + b.w / 2 - 4, y: b.y, dir: 'left' };
    }
    if (step.id === 'road') {
      const cell = this.ghost.find((c) => !this.state.roads[indexOf(this.state, c.x, c.y)]);
      if (!cell) return null;
      const p = footCenter(cell.x, cell.y);
      const at = this.toScreen(p.x, p.y);
      return { x: at.x, y: at.y, dir: 'down' };
    }
    if (step.id === 'gather' && this.tool !== this.spot?.kind) return null;
    const spot = this.stepSpot(step.id);
    if (!spot || !isPlaceTool(this.tool) || this.tool === 'road') return null;
    const p = footCenter(spot.x, spot.y, spot.w, spot.h);
    const at = this.toScreen(p.x, p.y);
    // On touch a single building is aimed TOUCH_LIFT above the finger: the arrow shows where the
    // finger goes, so a tap on its tip builds on the marked spot. Otherwise the tip stays over the
    // top of the building, so the arrow never covers its preview.
    if (this.input.activePointer.wasTouch && !DRAG_TOOLS.has(this.tool)) return { x: at.x, y: at.y + TOUCH_LIFT, dir: 'down' };
    const top = (HEIGHT[TEX.building(this.tool)] ?? 20) * this.cameras.main.zoom;
    return { x: at.x, y: at.y - top, dir: 'down' };
  }

  private toScreen(wx: number, wy: number) {
    const cam = this.cameras.main;
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    return { x: (wx - cam.scrollX - cx) * cam.zoom + cx, y: (wy - cam.scrollY - cy) * cam.zoom + cy };
  }

  // ---------- input ----------

  private overUi(sx: number, sy: number) {
    return this.ui?.isOverUi(sx, sy) ?? false;
  }

  /** Cell a pointer aims at: lifted above the finger for single buildings on touch; none if the
   * finger or the aimed point is under the interface (the preview is never hidden by it). */
  private aimAt(p: Phaser.Input.Pointer): Cell | null {
    const lift = p.wasTouch && isPlaceTool(this.tool) && !DRAG_TOOLS.has(this.tool) ? TOUCH_LIFT : 0;
    if (this.overUi(p.x, p.y) || (lift && this.overUi(p.x, p.y - lift))) return null;
    return this.cellAt(p.x, p.y - lift);
  }

  private cellAt(sx: number, sy: number): Cell | null {
    const w = this.rig.toWorld(sx, sy);
    return worldToCell(w.x, w.y);
  }

  private setHover(cell: Cell | null) {
    if (sameCell(cell, this.hover) || (!cell && !this.hover)) return;
    this.hover = cell;
    this.ui?.setHover(cell);
    this.drawOverlay();
  }

  private setupInput() {
    this.input.mouse?.disableContextMenu();
    this.input.addPointer(1);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.pan = null; // the player moves the camera: the tutorial leaves it there
      this.rig.zoomAt(p.x, p.y, this.rig.zoom * (dy > 0 ? 0.9 : 1.1));
    });
    const keys = this.input.keyboard;
    const digit = (n: string) => `keydown-${['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'][Number(n)]}`;
    for (const [t, n] of Object.entries(TOOL_KEYS) as [Tool, string][]) keys?.on(digit(n), () => this.selectTool(t));
    for (const [c, n] of Object.entries(CATEGORY_KEYS) as [BuildingCategory, string][]) keys?.on(digit(n), () => this.pickCategory(c));
    keys?.on('keydown-SPACE', () => this.cycleSpeed());
    keys?.on('keydown-R', () => this.rotate());
    keys?.on('keydown-Q', () => this.turnMap(-1));
    keys?.on('keydown-E', () => this.turnMap(1));
    // Esc closes the open panel or balloon first, then goes back to Mover.
    keys?.on('keydown-ESC', () => {
      if (this.ui?.closeTop()) return;
      if (this.tool === 'view' && this.selected) this.deselect();
      else this.selectTool('view');
    });
  }

  private onDown(p: Phaser.Input.Pointer) {
    if (this.ui?.modalOpen || this.overUi(p.x, p.y)) return;
    if (p.rightButtonDown() || p.middleButtonDown()) {
      this.rightPan = { id: p.id, x: p.x, y: p.y };
      this.updateCursor();
      return;
    }
    this.touches.set(p.id, { x: p.x, y: p.y });
    if (this.touches.size >= 2) {
      if (this.gesture) this.gesture.cancelled = true;
      const [a, b] = [...this.touches.values()];
      this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.rig.zoom, midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2 };
      return;
    }
    const cell = this.aimAt(p);
    this.gesture = {
      id: p.id,
      start: cell,
      last: cell,
      downX: p.x,
      downY: p.y,
      downAt: this.time.now,
      touch: p.wasTouch,
      lastX: p.x,
      lastY: p.y,
      moved: false,
      applied: false,
      cancelled: false,
      toastedSilver: false,
      toastedFood: false,
      roads: [],
      cutByUi: false,
    };
    if (this.tool !== 'view') this.setHover(cell);
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (this.rightPan?.id === p.id) {
      this.pan = null;
      this.rig.panBy(p.x - this.rightPan.x, p.y - this.rightPan.y);
      this.rightPan.x = p.x;
      this.rightPan.y = p.y;
      return;
    }
    if (this.touches.has(p.id)) this.touches.set(p.id, { x: p.x, y: p.y });

    if (this.pinch && this.touches.size >= 2) {
      const [a, b] = [...this.touches.values()];
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      this.pan = null;
      this.rig.panBy(midX - this.pinch.midX, midY - this.pinch.midY);
      this.rig.zoomAt(midX, midY, (this.pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, this.pinch.dist));
      this.pinch.midX = midX;
      this.pinch.midY = midY;
      return;
    }

    const g = this.gesture;
    if (!g || g.id !== p.id || !p.isDown) {
      if (!p.isDown && !p.wasTouch) {
        this.pointerOverUi = this.overUi(p.x, p.y);
        this.setHover(this.pointerOverUi ? null : this.cellAt(p.x, p.y));
        this.updateCursor();
      }
      return;
    }
    if (g.cancelled) return;
    if (Math.hypot(p.x - g.downX, p.y - g.downY) > TAP_SLOP) g.moved = true;

    if (this.tool === 'view') {
      if (g.moved) {
        this.updateCursor();
        this.pan = null;
        this.rig.panBy(p.x - g.lastX, p.y - g.lastY);
      }
    } else {
      const cell = this.aimAt(p);
      this.setHover(cell);
      if (!cell && g.applied && this.overUi(p.x, p.y)) g.cutByUi = true;
      // Never build under the UI, and give a second finger time to land before a touch drag builds.
      const ready = g.moved && (!g.touch || this.time.now - g.downAt >= TOUCH_BUILD_DELAY);
      if (DRAG_TOOLS.has(this.tool) && ready && cell && !sameCell(cell, g.last)) {
        this.batching = true;
        if (!g.applied && g.start) this.apply(g.start, true, g.touch);
        for (const c of g.last ? orthoSteps(g.last, cell) : [cell]) this.apply(c, false, g.touch);
        this.batching = false;
        if (this.pending) {
          this.pending = false;
          this.refresh();
        }
        g.last = cell;
        g.applied = true;
      }
    }
    g.lastX = p.x;
    g.lastY = p.y;
  }

  private onUp(p: Phaser.Input.Pointer) {
    if (this.rightPan?.id === p.id) {
      this.rightPan = null;
      this.updateCursor();
      return;
    }
    this.touches.delete(p.id);
    if (this.touches.size < 2) this.pinch = null;
    const g = this.gesture;
    if (!g || g.id !== p.id) return;
    this.gesture = null;
    if (g.moved && this.tool === 'view') this.updateCursor();
    if (!g.cancelled) {
      if (this.tool === 'view') {
        if (!g.moved && g.start) this.select(g.start);
      } else if (!g.applied) {
        // Single-placement tools drop where the finger is released, so the preview can be adjusted.
        // Releasing a single building over the UI cancels it.
        const cell = DRAG_TOOLS.has(this.tool) ? g.start : this.aimAt(p);
        if (cell) this.apply(cell, true, g.touch);
      }
      this.warnLooseRoads(g.roads);
      if (g.cutByUi && this.tool === 'road') this.ui?.toast(T.roadUnderUi, 'bad');
    }
    if (p.wasTouch) this.setHover(null);
  }

  /** Warns once if any road just built is not connected to the altar. */
  private warnLooseRoads(cells: Cell[]) {
    const s = this.state;
    if (cells.some((c) => !s.network[indexOf(s, c.x, c.y)])) this.ui?.toast(T.looseRoad, 'bad');
  }

  private select(cell: Cell) {
    // Nova: a tap on plain land (or the river) closes the tapped building's balloon.
    const s = this.state;
    const i = indexOf(s, cell.x, cell.y);
    const plain = !s.grid[i] && !s.roads[i] && !s.feature[i];
    this.selected = plain ? null : cell;
    this.refresh();
  }

  /** Uses the current tool on a cell; `first` for the first cell of a gesture, `touch` when a finger did it. */
  private apply(cell: Cell, first: boolean, touch = false) {
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
        else if (this.gesture && !this.gesture.toastedFood) {
          // A drag passes over it: say why it stayed.
          this.gesture.toastedFood = true;
          this.ui?.toast(T.demolishKeepsFood, 'bad');
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
        if (this.gesture) this.gesture.roads.push(o);
        else this.warnLooseRoads([o]); // a tap ends the gesture before placing
      }
      if (this.tool !== 'clear') {
        const b = s.grid[indexOf(s, o.x, o.y)];
        const c = b ? footCenter(b.x, b.y, b.w, b.h) : footCenter(o.x, o.y);
        if (this.tool === 'temple') this.fx.celebrate(c.x, c.y);
        else this.fx.ring(c.x, c.y);
      }
      // A temple built before goal 9: the victory waits for it (and says what it is).
      if (this.tool === 'temple' && templeWaitsForGoal(s)) this.ui?.toast(T.templeEarly, 'good');
      if (this.spots && this.tool !== 'road') {
        this.spots = null;
        this.drawSpots();
      }
      if (this.batching) this.pending = true;
      else this.refresh();
      return;
    }
    const g = this.gesture;
    if (r.reason === 'silver') {
      if (g?.toastedSilver) return;
      if (g) g.toastedSilver = true;
      this.ui?.toast(T.fail.silver, 'bad');
    } else if (first) {
      this.ui?.toast(r.reason === 'invalid' ? this.whyInvalid(o) : T.fail[r.reason], 'bad');
    }
  }

  /** Why the current tool cannot be used here: the first thing in the way (more precise than "invalid"). */
  private whyInvalid(o: Cell): string {
    const s = this.state;
    const B = T.blocked;
    if (this.tool === 'clear') {
      if (!inBounds(s, o.x, o.y)) return B.edge;
      return s.feature[indexOf(s, o.x, o.y)] === 'rock' ? B.rockClear : B.nothing;
    }
    const { w, h } = isPlaceTool(this.tool) && this.tool !== 'road' ? dimsOf(this.tool, this.rotated) : { w: 1, h: 1 };
    const reasons: string[] = [];
    for (let y = o.y; y < o.y + h; y++)
      for (let x = o.x; x < o.x + w; x++) {
        if (!inBounds(s, x, y)) return B.edge;
        const i = indexOf(s, x, y);
        if (s.grid[i] || s.roads[i]) reasons.push(B.taken);
        else if (s.ground[i] === 'river') reasons.push(B.river);
        else if (s.feature[i] === 'rock') reasons.push(B.rock);
        else if (s.feature[i]) reasons.push(B.tree);
      }
    return reasons[0] ?? T.fail.invalid;
  }
}

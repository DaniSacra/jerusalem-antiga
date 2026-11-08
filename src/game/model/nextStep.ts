import {
  alerts,
  crewOf,
  seatsOf,
  unemployed,
  announcedCaravan,
  birthBlock,
  currentGoal,
  freeHouse,
  goalOpen,
  goalProgress,
  goalTarget,
  housesWaiting,
  houseInfo,
  makerOf,
  MATERIALS,
  readCity,
  TEMPLE_STAGES,
  unlockingGoal,
  waitingCouples,
  weeksToNextLevel,
  type BuildableKind,
  type Building,
  type CityReadout,
  type GameState,
  type GoalDef,
  type NeedKind,
  type Rect,
} from '../../core';
import { T } from '../strings';
import type { Tool } from '../tools';
import { stagePlan, type StagePlan } from './temple';

/**
 * "O que fazer agora" (plan "Desafio" 2.3): the one thing to do next, in a fixed order, read from
 * the core (no rule of its own): a crisis that kills or loses the city first (debt, hunger, firewood),
 * then the Temple's stage when it is the goal, then the first thing the current goal lacks, else
 * "Tudo em ordem". The line under the top bar shows it; a tap opens where to act and an arrow points there.
 */

/** Where the arrow points: a tool's button, or a building on the map. */
export type StepAim = { tool: Tool } | { rect: Rect } | null;

/** What a tap on the line opens: a panel, or a building's balloon (the stage's site). */
export type StepOpen = { panel: 'goals' | 'alerts' | 'jobs' } | { building: Rect };

export interface NextStep {
  kind: 'crisis' | 'stage' | 'goal' | 'calm';
  text: string;
  tone: 'bad' | 'warn' | 'gold' | 'good';
  /** An ICONS key (src/ui/icons.ts): the line is never told by its colour alone. */
  icon: string;
  aim: StepAim;
  open: StepOpen;
}

const N = () => T.nova.next;
const rectOf = (b: Building): Rect => ({ x: b.x, y: b.y, w: b.w, h: b.h });
const GOALS_PANEL: StepOpen = { panel: 'goals' };
/** A tool to point at, when it is open (a locked one has nothing to tap yet). */
const toolAim = (s: GameState, kind: BuildableKind | 'road'): StepAim => (kind === 'road' || s.unlocked.includes(kind) ? { tool: kind } : null);

export function nextStep(s: GameState, city: CityReadout = readCity(s)): NextStep {
  return crisis(s, city) ?? stageStep(s) ?? goalStep(s, city) ?? calm();
}

const calm = (): NextStep => ({ kind: 'calm', text: N().calm, tone: 'good', icon: 'mood-happy', aim: null, open: GOALS_PANEL });

/** 1. What kills or loses the city: the debt, hunger (now or before the harvest), firewood for the winter. */
function crisis(s: GameState, city: CityReadout): NextStep | null {
  const one = (text: string, icon: string, aim: StepAim): NextStep => ({ kind: 'crisis', text, tone: 'bad', icon, aim, open: { panel: 'alerts' } });
  // A maker on the road with nobody at it while nobody is free: building another would stay empty too
  // (playtest 2026-11-07: "1 pescador, 0 de 1 vaga"), so the line opens Profissões instead.
  const make = (text: string, icon: string, kind: BuildableKind): NextStep => {
    const stuck = unemployed(s) === 0 && s.buildings.some((b) => b.kind === kind && seatsOf(b) > 0 && !crewOf(s, b).length);
    return stuck ? { kind: 'crisis', text: N().noCrew(kind), tone: 'bad', icon, aim: null, open: { panel: 'jobs' } } : one(text, icon, toolAim(s, kind));
  };
  for (const a of alerts(s, city.eco)) {
    if (a.kind === 'debt') return one(N().debt(a.weeksLeft), 'silver', { tool: 'clear' });
    if (a.kind === 'foodShort') return make(s.famine || !city.forecast ? N().famine : N().food(city.forecast.weeks), 'food', 'fisher');
    if (a.kind === 'firewood') return make(a.cold ? N().cold : N().firewood(Math.ceil(a.missing)), 'wood', 'lumber');
  }
  if (s.famine) return make(N().famine, 'food', 'fisher');
  // The restored altar without its offering (it covers no house), or its livestock about to end.
  if (s.temple.done >= 1) {
    if (!s.offered) return make(N().offerings, 'livestock', 'pasture');
    const net = city.eco.livestock - TEMPLE_STAGES[s.temple.done - 1].offering;
    const left = net < 0 ? Math.floor(s.livestock / -net) : Infinity;
    if (left <= LIVESTOCK_WARN_WEEKS) return make(N().livestock(left), 'livestock', 'pasture');
  }
  return null;
}

/** Weeks of livestock left for the offerings under which the line warns. */
const LIVESTOCK_WARN_WEEKS = 8;

/** 2. The Temple's stage, while it is the goal. */
function stageStep(s: GameState): NextStep | null {
  const p = stagePlan(s);
  if (!p) return null;
  const name = p.stage.name;
  const site = rectOf(p.site);
  const one = (text: string, tone: NextStep['tone'], aim: StepAim, open: StepOpen = { building: site }): NextStep => ({ kind: 'stage', text, tone, icon: 'stage', aim, open });
  const at = { rect: site };
  switch (p.at) {
    case 'road':
      return one(N().road(name, p.stage.site), 'warn', { tool: 'road' });
    case 'debt':
      return one(T.nova.stage.debt(name), 'warn', { tool: 'clear' });
    case 'ready':
      return one(N().start(name, p.stage.site), 'gold', at);
    case 'lack':
      return lackStep(s, p, one);
    case 'work':
      return p.builders < p.stage.builders
        ? one(N().builders(name, p.builders, p.stage.builders), p.builders ? 'warn' : 'bad', null, { panel: 'jobs' })
        : one(N().going(name, p.progress, p.stage.work, p.weeksLeft ?? 0), 'good', at);
  }
}

/** Short of what the stage costs: the first thing missing, and where it comes from (its maker on the map, else its tool). */
function lackStep(s: GameState, p: StagePlan & { at: 'lack' }, one: (text: string, tone: NextStep['tone'], aim: StepAim) => NextStep): NextStep {
  const [n, what] = p.need[0];
  if (what === 'silver') return one(N().gather(p.stage.name, 'silver', s.silver, p.stage.cost), 'gold', { rect: rectOf(p.site) });
  const need = p.stage.materials[what] ?? n;
  const maker = makerOf(what);
  const built = s.buildings.find((b) => b.kind === maker && b.connected);
  return one(N().gather(p.stage.name, what, s[what], need), 'gold', built ? { rect: rectOf(built) } : toolAim(s, maker));
}

/** 3. The current goal: the first thing it lacks. */
function goalStep(s: GameState, city: CityReadout): NextStep | null {
  const g = currentGoal(s);
  if (!g) return null;
  const one = (text: string, aim: StepAim, tone: NextStep['tone'] = 'gold'): NextStep => ({ kind: 'goal', text, tone, icon: 'flag', aim, open: GOALS_PANEL });
  if (!goalOpen(s, g)) return one(N().year(g.fromYear ?? 1), null);
  switch (g.type) {
    case 'build':
      return buildStep(s, g, one);
    case 'houses':
      return housesStep(s, g.level ?? 1, goalTarget(s, g), goalProgress(s, g), one);
    case 'residents':
      return residentsStep(s, city, one);
    case 'foodUntilSpring':
      return one(N().foodUntilSpring(goalProgress(s, g), goalTarget(s, g)), toolAim(s, 'fisher'));
    case 'milestone':
      return milestoneStep(s, city, g, one);
    default:
      return null;
  }
}

type One = (text: string, aim: StepAim, tone?: NextStep['tone']) => NextStep;

function buildStep(s: GameState, g: GoalDef, one: One): NextStep {
  const kind = g.kind as BuildableKind;
  const off = s.buildings.find((b) => b.kind === kind && !b.connected);
  return off ? one(N().offRoad(kind), { tool: 'road' }, 'warn') : one(g.text, toolAim(s, kind));
}

/**
 * Houses of `level` (or more people, `level` the top): what the house nearest to it lacks for its
 * next level (a road, a service, a material); else more houses, else when they climb.
 */
function housesStep(s: GameState, level: number, target: number, have: number, one: One): NextStep | null {
  const below = s.buildings
    .filter((b) => b.kind === 'house' && b.level > 0 && b.level < level)
    .map((b) => ({ b, info: houseInfo(s, b)! }))
    .map((h) => ({ ...h, missing: h.info.next?.needs.filter((n) => !n.ok).map((n) => n.kind) ?? [] }))
    .sort((a, b) => b.b.level - a.b.level || a.missing.length - b.missing.length || a.b.id - b.b.id);
  const top = below[0];
  // The nearest house lacks a need: that need (a road, a service or the goal that unlocks it).
  if (top && top.missing.length) return needStep(s, top.missing[0], top.b.level, one);
  // Ready but short of a material.
  const waiting = housesWaiting(s);
  for (const m of MATERIALS)
    if (waiting[m] > 0) {
      const short = Math.max(1, ...below.filter((h) => h.info.waiting === m).map((h) => Math.ceil((h.info.next?.materials[m] ?? 0) - s[m])));
      return one(N().material(short, m), toolAim(s, makerOf(m)));
    }
  if (have + below.length < target) {
    // A plot alone makes no family (playtest 2026-11-07, stuck at "5 casas de barro"): with one empty, say who comes.
    const plot = s.buildings.find((b) => b.kind === 'house' && b.level === 0);
    if (!plot) return one(N().moreHouses(have, target), toolAim(s, 'house'));
    const next = s.caravans.filter((c) => c.status === 'planned' || c.status === 'announced').sort((a, b) => a.week - b.week)[0];
    return one(next ? N().familyByCaravan(Math.max(1, next.week - s.week)) : N().familyByWedding, { rect: rectOf(plot) });
  }
  const climbing = below.map((h) => weeksToNextLevel(s, h.b)).filter((w): w is number => w !== null);
  return climbing.length ? one(N().climbing(Math.min(...climbing)), { rect: rectOf(top.b) }, 'good') : null;
}

function needStep(s: GameState, need: NeedKind, level: number, one: One): NextStep {
  if (need === 'road') return one(N().houseRoad, { tool: 'road' }, 'warn');
  // The altar: restore it, feed it, or build nearer it.
  if (need === 'sacred') {
    const altar = s.buildings.find((b) => b.kind === 'altar');
    const at = altar ? { rect: rectOf(altar) } : null;
    if (s.temple.done === 0) return one(N().altarRuins, at);
    return s.offered ? one(N().nearAltar, at) : one(N().offerings, toolAim(s, 'pasture'), 'bad');
  }
  if (!s.unlocked.includes(need)) return one(N().locked(need, unlockingGoal(need) ?? 0), null);
  return one(N().service(need, level), { tool: need });
}

/** Residents: couples or a caravan without an empty house, houses waiting for material, births held by food, then the houses' next level. */
function residentsStep(s: GameState, city: CityReadout, one: One): NextStep | null {
  const free = s.buildings.filter((b) => freeHouse(s, b)).length;
  const caravan = announcedCaravan(s);
  if (caravan) {
    const missing = Math.max(0, caravan.families + waitingCouples(s).length - free);
    if (missing) return one(N().caravan(missing, Math.max(0, caravan.week - s.week)), toolAim(s, 'house'));
  }
  if (waitingCouples(s).length > free) return one(N().couples, toolAim(s, 'house'));
  const waiting = housesWaiting(s);
  for (const m of MATERIALS) if (waiting[m] > 0) return housesStep(s, Infinity, 0, 0, one);
  const block = city.births ?? birthBlock(s, city.eco);
  if (block === 'food' || block === 'storage') return one(N().noBirths, toolAim(s, 'fisher'));
  return housesStep(s, Infinity, 0, 0, one);
}

/** A milestone: what helps it come (an empty house for the caravan or the wedding), else what to do meanwhile. */
function milestoneStep(s: GameState, city: CityReadout, g: GoalDef, one: One): NextStep {
  const caravan = announcedCaravan(s);
  switch (g.milestone) {
    case 'firstCaravan': {
      if (!caravan) return one(N().caravanSoon, toolAim(s, 'house'));
      const free = s.buildings.filter((b) => freeHouse(s, b)).length;
      const missing = Math.max(0, caravan.families - free);
      return one(N().caravan(missing, Math.max(0, caravan.week - s.week)), missing ? toolAim(s, 'house') : null, missing ? 'gold' : 'good');
    }
    case 'firstWedding':
      return one(N().wedding, toolAim(s, 'house'));
    case 'firstBirth': {
      const block = city.births;
      return block === 'food' || block === 'storage' ? one(N().noBirths, toolAim(s, 'fisher')) : one(N().grow, null, 'good');
    }
    case 'firstSpring':
      return one(N().winter, toolAim(s, 'lumber'));
    default:
      // The children grow (and the generations come) by time: meanwhile, the houses' next level.
      return one(N().grow, null, 'good');
  }
}

import {
  balanceAfter,
  BUILDINGS,
  computeEconomy,
  costOf,
  foodAfter,
  GOALS,
  MATERIALS,
  materialsOf,
  byRiver,
  craftOf,
  fieldBonus,
  fieldHarvest,
  foodLostIfRemoved,
  gatherYield,
  harvestsIn,
  HOUSE_LEVELS,
  houseBirths,
  houseInfo,
  housesServed,
  indexOf,
  isWalking,
  jobsOf,
  crewCounts,
  crewOf,
  seatsOf,
  staffOf,
  lackingMaterial,
  makerOf,
  materialMadeBy,
  needLocked,
  nextLevelOf,
  personById,
  regrowLeft,
  RULES,
  seasonOf,
  statOf,
  storageFull,
  unlockingGoal,
  upgradeGain,
  weeksPerCut,
  weeksToHarvest,
  weeksToNextLevel,
  type AgeBand,
  type BirthBlock,
  type BuildableKind,
  type Building,
  type Cell,
  type CityReadout,
  type Person,
  type GameState,
  type LevelStat,
  type NeedKind,
  type Rect,
  type Sex,
} from '../../core';
import { treeKind } from '../seasons';
import { T } from '../strings';
import { ageNow, bandOf, jobText, residentsOf } from './people';

/**
 * The card of a tapped cell (pure): the lines of its balloon, the main action and Demolir. The 2D
 * and the 3D draw the same card; `phone` makes it shorter (the house's level part goes into a second
 * column beside its people, `aside`).
 */

export type CardTone = 'text' | 'good' | 'bad' | 'warn' | 'gold' | 'muted';

/** A tappable row of a person (house balloon): figure, "Natã, 22" and the work under it. */
export interface PersonChip {
  id: number;
  title: string;
  sub: string;
  subTone?: CardTone;
  band: AgeBand;
  sex: Sex;
}

export interface CardLine {
  text: string;
  tone?: CardTone;
  /** A heading line (the name; the house's head). */
  big?: boolean;
  /** Regular weight (lines are bold unless said). */
  plain?: boolean;
  /** On a darker rounded box (the "Ao evoluir" gains). */
  box?: boolean;
  /** Extra space above the line (real px). */
  gap?: number;
  /**
   * Pieces of a short line in their own tones (the cost "25 prata · 10 madeira" with what is missing
   * in red); `text` is then the whole line. Never wraps.
   */
  parts?: { text: string; tone: CardTone }[];
  /** Instead of the text: rows of people in `cols` columns. */
  people?: PersonChip[];
  cols?: number;
}

/**
 * What the main (gold) button does: pick a building and show where it would solve the need, pick
 * Rua, or raise a service building a level (`dim`: grey, the silver or a material is short).
 */
export type CardAction = { label: string; kind: BuildableKind | 'road' | 'upgrade'; target: Building; dim?: boolean };

export interface Card {
  lines: CardLine[];
  /** Phone: a second column at the right of the lines (the house's level, beside its people). */
  aside: CardLine[];
  /** Footprint the balloon points at. */
  foot: Rect;
  building: Building | null;
  action: CardAction | null;
  demolish: boolean;
}

const ok = (yes: boolean, label: string): CardLine => ({ text: `${yes ? '✓' : '✗'} ${label}`, tone: yes ? 'good' : 'bad' });

/** The stat a service building's levels change (granary storage, market reach, workshop field bonus). */
export function levelStatOf(kind: BuildableKind): (LevelStat & keyof typeof T.nova.levelStat) | null {
  const first = BUILDINGS[kind].levels?.[0];
  return first ? ((['storage', 'radius', 'fieldBonus'] as const).find((k) => first[k] !== undefined) ?? null) : null;
}

/** The card of a tapped cell; null for plain land and the river (a tap there closes the balloon). */
export function cardOf(s: GameState, c: Cell, { births }: CityReadout, phone: boolean): Card | null {
  const N = T.nova.inspect;
  const i = indexOf(s, c.x, c.y);
  const b = s.grid[i];
  const one = { x: c.x, y: c.y, w: 1, h: 1 };
  const plainCard = (lines: CardLine[], demolish = false): Card => ({ lines, foot: one, building: null, action: null, demolish, aside: [] });
  if (!b) {
    if (s.roads[i]) {
      const linked = s.network[i];
      return plainCard([{ text: N.road(linked, c.x === s.entrance.x && c.y === s.entrance.y), tone: linked ? 'text' : 'bad' }, ...lossLine(s, c)], true);
    }
    const f = s.feature[i];
    if (f === 'stump') return plainCard([{ text: N.stump(regrowLeft(s, i)) }]);
    if (f === 'rock') return plainCard([{ text: N.rock(T.feature.rock) }]);
    if (f) return plainCard([{ text: N.tree(T.feature[treeKind(f, c.x, c.y)]) }]);
    return null;
  }
  const foot = { x: b.x, y: b.y, w: b.w, h: b.h };
  if (b.kind === 'house') return houseCard(s, b, births, phone);
  const lines: CardLine[] = [];
  let action: CardAction | null = null;
  const def = BUILDINGS[b.kind];
  const craft = craftOf(b);
  lines.push({ text: craft ? `${def.name} (${T.craft[craft]})` : def.name, big: true });
  if (b.kind === 'altar') {
    lines.push({ text: N.altar, plain: true }, { text: T.nova.reach(def.radius ?? 0), tone: 'muted', plain: true });
    return { lines, foot, building: b, action: null, demolish: false, aside: [] };
  }
  lines.push({ text: T.nova.effect[b.kind], plain: true });
  lines.push(ok(b.connected, b.connected ? N.connected : N.disconnected));
  if (!b.connected) action = { label: N.where.road, kind: 'road', target: b };
  else {
    const served = housesServed(s, b);
    if (served !== null) lines.push({ text: N.serves(served) });
    if (def.jobs) {
      // Who works here: "Trabalhadores 1/2" and their names (a tap opens the person's sheet).
      const crew = crewOf(s, b);
      lines.push({ text: N.crew(crew.length, seatsOf(b)), tone: crew.length ? 'text' : 'bad' });
      if (crew.length) lines.push({ text: '', people: crew.map((p) => chipOf(s, p, jobsOf(s))), cols: phone ? 2 : 1, gap: 2 });
      else lines.push({ text: N.noWorkers, tone: 'bad' });
    }
    if (def.fieldBonus) lines.push({ text: N.fieldBonus(Math.round(fieldBonus(s) * 100)), tone: 'good' });
  }
  lines.push(...foodLines(s, b));
  const upkeep = statOf(b, 'upkeep');
  if (upkeep) lines.push({ text: N.upkeep(upkeep), tone: 'gold' });
  // Service levels: what the next one changes, and the gold Melhorar (grey without the silver).
  const levels: CardLine[] = [];
  if (def.levels) {
    const next = nextLevelOf(b);
    const stat = levelStatOf(b.kind);
    levels.push({ text: N.levelOf(b.level, def.levels.length + 1), tone: 'muted', plain: true, gap: phone ? 0 : 4 });
    if (!next) levels.push({ text: N.topLevel, tone: 'gold' });
    else if (stat) {
      const up = { kind: b.kind, level: b.level + 1 };
      const say = T.nova.levelStat[stat];
      levels.push({ text: N.nextLevel(b.level + 1, say(statOf(up, stat)), statOf(up, 'upkeep'), say(statOf(b, stat)), upkeep), tone: 'gold', box: true });
    }
    if (next && !action) {
      const short = s.silver < next.cost;
      const lack = lackingMaterial(s, next.materials ?? {});
      const label = short ? T.missingSilver(next.cost) : lack ? T.lackingAmount(lack, next.materials?.[lack] ?? 0, s[lack]) : N.upgrade(next.cost, next.materials);
      action = { label, kind: 'upgrade', target: b, dim: short || !!lack };
    }
  }
  if (!def.protected) levels.push(...lossLine(s, c));
  // Phone: a building with levels shows them in a second column, with the buttons under it (the screen is short).
  if (phone && def.levels) return { lines, foot, building: b, action, demolish: !def.protected, aside: levels };
  return { lines: [...lines, ...levels], foot, building: b, action, demolish: !def.protected, aside: [] };
}

/**
 * A house: "Casa de barro · 3/4 pessoas", its people (tap opens the sheet; two columns on the
 * phone), whether they can have children, then the level part: next level, needs, joy and the
 * gain (beside the people on the phone, under them on PC). An empty house says what it waits for.
 */
function houseCard(s: GameState, b: Building, births: BirthBlock | null, phone: boolean): Card {
  const N = T.nova.inspect;
  const P = T.nova.people;
  const h = houseInfo(s, b)!;
  const foot = { x: b.x, y: b.y, w: b.w, h: b.h };
  const lines: CardLine[] = [];
  let action: CardAction | null = null;
  const walking = s.families.filter((f) => f.houseId === b.id).flatMap((f) => f.members.map((id) => personById(s, id)?.name ?? ''));
  const coming: CardLine[] = walking.length ? [{ text: P.coming(walking.filter(Boolean).join(', ')), tone: 'good' }] : [];
  if (h.level === 0) {
    const kept = b.emptyLevel > 0 ? HOUSE_LEVELS[b.emptyLevel].name : null;
    lines.push({ text: kept ? P.empty(kept) : N.plotWaiting, big: !kept });
    if (!b.connected) {
      lines.push({ text: N.plotNoRoad, tone: 'bad' });
      action = { label: N.where.road, kind: 'road', target: b };
    } else lines.push(...coming);
    return { lines, foot, building: b, action, demolish: true, aside: [] };
  }
  lines.push({ text: P.head(h.name, h.residents, h.capacity), big: true });
  const jobs = jobsOf(s);
  const people: PersonChip[] = residentsOf(s, b).map((p) => chipOf(s, p, jobs));
  if (people.length) lines.push({ text: '', people, cols: phone ? 2 : 1, gap: 4 });
  // Whether they can have children, and who is on the way (phone: at the top of the level column).
  const family: CardLine[] = [];
  const kids = houseBirths(s, b, births);
  if (kids) family.push(ok(kids === 'ok', P.births[kids]));
  family.push(...coming);

  // Phone: the level part sits beside the people, so it is short (the next level only, no tax line).
  const head = h.next ? (phone ? N.nextOnly(h.next.name) : N.next(h.name, h.next.name)) : `${h.name} · ${N.top}`;
  const level: CardLine[] = [{ text: head, big: !phone, tone: phone ? 'gold' : 'text', gap: phone ? 0 : 6 }];
  if (!phone) level.push({ text: N.tax(h.tax), tone: 'muted', plain: true });
  if (h.happiness) {
    const { value, mood, parts } = h.happiness;
    const why = parts.map((p) => `${T.happinessPart[p.kind]} ${p.value > 0 ? '+' : '−'}${Math.abs(p.value)}`).join(', ');
    level.push({ text: N.happiness(value, mood, why), tone: mood === 'sad' ? 'bad' : mood === 'happy' ? 'good' : 'text', plain: true });
  }
  if (h.next) {
    const needs = h.next.needs;
    // A missing service still locked says which goal unlocks it.
    const label = (kind: NeedKind, has: boolean) => {
      if (kind === 'road' && !has) return N.noRoad;
      const goal = needLocked(s, kind) ? unlockingGoal(kind as BuildableKind) : null;
      return goal ? N.lockedNeed(T.need[kind], goal) : T.need[kind];
    };
    // Ready but short of wood or stone: "Pronta…" says every need is met, so the ✓ list goes (a shorter balloon).
    const wait = h.waiting ?? (h.firewoodHold ? 'wood' : null);
    // What it has on one line (green ✓) and what it lacks on another (red ✗).
    let gap = 4;
    for (const has of wait ? [] : [true, false]) {
      const names = needs.filter((n) => n.ok === has).map((n) => label(n.kind, n.ok));
      if (!names.length) continue;
      level.push({ ...ok(has, names.join(', ')), gap });
      gap = 0;
    }
    const left = weeksToNextLevel(s, b);
    const season = seasonOf(s.week);
    if (s.cold) level.push({ text: T.nova.cold, tone: 'bad' });
    else if (season === 'autumn' || season === 'winter') level.push({ text: T.nova.firewood(HOUSE_LEVELS[h.level].firewood ?? 0), tone: 'muted', plain: true });
    if (s.famine) level.push({ text: N.famine, tone: 'bad' });
    else if (h.firewoodHold) level.push({ text: N.firewoodHold(h.next.name), tone: 'bad', gap: 4 });
    else if (wait) level.push({ text: N.waiting(h.next.name, Math.ceil((h.next.materials[wait] ?? 0) - s[wait]), wait), tone: 'bad', gap: 4 });
    else if (left !== null) level.push({ text: N.nextIn(h.next.name, left), tone: 'good' });
    const gain = upgradeGain(h.level);
    // Phone: the gain goes right under "Próximo nível" as one plain line (the column is short).
    if (gain && phone) level.splice(1, 0, { text: N.gain(gain.capacity, gain.tax), tone: 'gold', plain: true });
    else if (gain) level.push({ text: `${N.evolve}: ${N.gain(gain.capacity, gain.tax)}`, tone: 'gold', box: true, gap: 4 });
    // What climbing asks (waiting, the red line above already says what is missing).
    if (gain && !wait && Object.keys(gain.materials).length) level.push({ text: N.asks(gain.materials), tone: 'gold', plain: true });
    // Main action: the first missing need the player can build now; waiting, where to put the lumber or quarry.
    const miss = h.next.needs.find((n) => !n.ok);
    const maker = wait ? makerOf(wait) : null;
    if (miss?.kind === 'road') action = { label: N.where.road, kind: 'road', target: b };
    else if (miss && s.unlocked.includes(miss.kind)) action = { label: N.where[miss.kind], kind: miss.kind, target: b };
    else if (!miss && maker && s.unlocked.includes(maker)) action = { label: N.where[maker], kind: maker, target: b };
  } else if (!b.connected) level.push(ok(false, N.noRoad));
  // Phone: the level beside the people (the screen is short); PC: under them.
  if (phone && family.length) level[0].gap = 4;
  return phone ? { lines, foot, building: b, action, demolish: true, aside: [...family, ...level] } : { lines: [...lines, ...family, ...level], foot, building: b, action, demolish: true, aside: [] };
}

/** "Perde N de comida" when demolishing this would spoil food (a granary, or the road to one). */
function lossLine(s: GameState, c: Cell): CardLine[] {
  const n = foodLostIfRemoved(s, c.x, c.y);
  return n > 0 ? [ok(false, T.nova.foodLost(n))] : [];
}

/** A person as a chip in a house's or a workplace's balloon: name, age and work (a tap opens the sheet). */
function chipOf(s: GameState, p: Person, jobs: ReturnType<typeof jobsOf>): PersonChip {
  const P = T.nova.people;
  return {
    id: p.id,
    title: P.row(p.name, ageNow(s, p)),
    sub: isWalking(s, p.id) ? P.walking : jobText(s, p, jobs),
    subTone: jobs.get(p.id) === null ? 'warn' : undefined,
    band: bandOf(s, p),
    sex: p.sex,
  };
}

/** Field, fisher, gatherer and granary: when it harvests, what it yields, what it keeps. */
function foodLines(s: GameState, b: Building): CardLine[] {
  const def = BUILDINGS[b.kind];
  const N = T.nova;
  const out: CardLine[] = [];
  const staff = staffOf(b, crewCounts(s)); // it makes by its own crew
  if (def.harvest) {
    if (!harvestsIn(s.week)) out.push({ text: N.inspect.frozen(weeksToHarvest(s.week)), tone: 'warn' });
    else if (b.connected) out.push({ text: N.inspect.harvesting(fieldHarvest(s, b, s.week) * staff), tone: 'good' });
    if (s.drought) out.push(byRiver(s, b) ? { text: N.inspect.droughtRiver, tone: 'good' } : { text: N.inspect.droughtDry, tone: 'warn' });
  }
  if (def.gather && b.connected) {
    const raw = gatherYield(s, b);
    const n = raw * staff;
    const made = materialMadeBy(b.kind as BuildableKind);
    // A full store stops it: that line alone, not a green yield beside it. No source only when there
    // is none (without workers the balloon already says "Sem trabalhadores").
    if (made && storageFull(s, made)) out.push({ text: N.storeFull(RULES.materialStorage), tone: 'bad' });
    else if (n > 0) out.push({ text: N.yields(n, def.gather.product), tone: 'good' });
    else if (raw <= 0) out.push(ok(false, N.inspect.noSource[def.gather.source]));
    const every = def.cutEvery ? weeksPerCut(n) : null;
    if (every) out.push({ text: N.cutsEvery(every), tone: 'muted', plain: true });
  }
  const working = def.gather || (def.harvest && harvestsIn(s.week));
  if (working && b.connected && staff > 0 && staff < 1) out.push({ text: N.inspect.fewWorkers(Math.round(staff * 100)), tone: 'warn' });
  if (def.storage) out.push({ text: N.stores(statOf(b, 'storage')), tone: b.connected ? 'text' : 'muted' });
  return out;
}

/** "25 prata · 10 madeira", gold, with what is short in red and how much there is. */
export function costLine(s: GameState, kind: BuildableKind): CardLine {
  const N = T.nova;
  const piece = (text: string, need: number, has: number) => (has < need ? { text: text + N.have(has), tone: 'bad' as const } : { text, tone: 'gold' as const });
  const cost = costOf(kind);
  const parts = [piece(N.silverCost(cost), cost, s.silver)];
  const m = materialsOf(kind);
  for (const k of MATERIALS) if (m[k]) parts.push({ text: ' · ', tone: 'gold' }, piece(N.materialCost(m[k]!, k), m[k]!, s[k]));
  return { text: parts.map((p) => p.text).join(''), parts };
}

/**
 * The balloon of the building chosen to build: name, cost, upkeep and jobs, what it does, its levels
 * or store, the workshop's field bonus, its reach, the silver balance after it (PC) and the food it
 * costs when it takes workers from the food buildings.
 */
export function toolCard(s: GameState, kind: BuildableKind, phone: boolean): CardLine[] {
  const d = BUILDINGS[kind];
  const N = T.nova;
  const upkeep = [...(d.upkeep ? [N.upkeep(d.upkeep)] : []), ...(!phone && d.jobs ? [N.jobs(d.jobs)] : [])].join(' · ');
  const lines: CardLine[] = [{ text: d.name, big: true }, costLine(s, kind), ...(upkeep ? [{ text: upkeep, tone: 'gold' as const }] : []), { text: N.effect[kind], plain: true }];
  if (d.gather) lines.push({ text: N.gatherRule(d.gather.source, d.gather.perCell, d.gather.radius, d.gather.max, d.gather.product), tone: 'muted', plain: true });
  // A building with levels: its first and last ("Guarda 300 · melhora até 1000").
  const stat = levelStatOf(kind);
  if (stat && d.levels) {
    const say = N.levelStat[stat];
    lines.push({ text: N.growsTo(say(statOf({ kind, level: 1 }, stat)), say(statOf({ kind, level: d.levels.length + 1 }, stat))), tone: 'gold', plain: true });
  } else if (d.storage) lines.push({ text: N.stores(d.storage), tone: 'muted', plain: true });
  if (d.fieldBonus) {
    // The workshop's field bonus: the city's total after it, and when it is already at the cap.
    const pct = (n: number) => Math.round(n * 100);
    const now = fieldBonus(s);
    const max = d.fieldBonusMax ?? 0;
    const after = Math.min(max, now + d.fieldBonus);
    lines.push(now >= max ? { text: N.workshopFull(pct(max)), tone: 'warn' } : { text: N.workshopBonus(pct(d.fieldBonus), pct(after), pct(max)), tone: 'good' });
  }
  if (!phone && d.radius && stat !== 'radius') lines.push({ text: N.reach(d.radius), tone: 'muted', plain: true });
  if (!phone) {
    const after = balanceAfter(s, kind);
    lines.push({ text: N.balanceAfter(after), tone: after < 0 ? 'bad' : 'good' });
  }
  // A workplace that takes workers from the food buildings: the food it costs (fisher, gatherer
  // and field say it on the map, where their spot is known).
  if (d.jobs && !d.gather && !d.harvest) {
    const food = foodAfter(s, kind).delta;
    if (food < computeEconomy(s).foodDelta) lines.push({ text: N.foodAfter(food), tone: food < 0 ? 'bad' : 'warn' });
  }
  return lines;
}

/** A locked building's balloon: the goal that opens it. */
export function lockedCard(kind: BuildableKind): CardLine[] {
  const n = unlockingGoal(kind) ?? 0;
  return [{ text: T.nova.unlocksAt(n, GOALS[n - 1]?.fromYear) }];
}

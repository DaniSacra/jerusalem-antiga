import Phaser from 'phaser';
import {
  BUILDINGS,
  byRiver,
  craftOf,
  gatherYield,
  harvestsIn,
  weeksToHarvest,
  fieldHarvest,
  houseInfo,
  housesServed,
  indexOf,
  upgradeGain,
  unlockingGoal,
  lackingMaterial,
  nextLevelOf,
  statOf,
  weeksToNextLevel,
  fieldBonus,
  foodLostIfRemoved,
  needLocked,
  RULES,
  weeksPerCut,
  houseBirths,
  HOUSE_LEVELS,
  isWalking,
  jobsOf,
  personById,
  type BirthBlock,
  type LevelStat,
  type CityReadout,
  type BuildableKind,
  type Building,
  type Cell,
  type Economy,
  type GameState,
  type NeedKind,
} from '../../core';
import { HW } from '../iso';
import { px, type Rect } from '../layout';
import { NOVA_CSS } from '../palette';
import { treeKind } from '../Seasons';
import { T } from '../strings';
import { TEX } from '../textures';
import { TextBalloon, type Chip, type Line } from './Balloon';
import { H, PHONE, S, W } from './metrics';
import { ageNow, bandOf, jobText, residentsOf } from './people';
import { icon, nameTag, ntext, RoundButton } from './widgets';

/**
 * What the main (gold) button does: pick a building and show where it would solve the need, pick
 * Rua, or raise a service building a level (`dim`: grey, the silver is short).
 */
export type Action = { label: string; kind: BuildableKind | 'road' | 'upgrade'; target: Building; dim?: boolean };

interface Card {
  lines: Line[];
  /** Phone: a second column at the right of the lines (the house's level, beside its people). */
  aside: Line[];
  /** Footprint the balloon points at. */
  foot: { x: number; y: number; w: number; h: number };
  building: Building | null;
  action: Action | null;
  demolish: boolean;
}

export interface InspectorHost {
  /** Screen point (UI coordinates) of the center of a grid footprint, and the camera zoom. */
  cellScreen(x: number, y: number, w: number, h: number): { x: number; y: number; zoom: number };
  act(a: Action): void;
  demolish(cell: Cell): void;
  close(): void;
  /** Where the balloon may go: under the top bar, and above the bottom tools when over them. */
  limits(): { top: number; toolsRight: number; toolsTop: number };
  /** A person row was tapped: open the person sheet. */
  openPerson(id: number): void;
  /** The balloon does not fit beside the building: move the camera so the building goes `dx` screen px sideways. */
  nudge(dx: number): void;
}

const ok = (yes: boolean, label: string): Line => ({ text: `${yes ? '✓' : '✗'} ${label}`, color: yes ? NOVA_CSS.good : NOVA_CSS.bad });

/** The card of a tapped cell; null for plain land and the river (a tap there closes the balloon). */
function card(s: GameState, c: Cell, { eco, births }: CityReadout): Card | null {
  const N = T.nova.inspect;
  const i = indexOf(s, c.x, c.y);
  const b = s.grid[i];
  const one = { x: c.x, y: c.y, w: 1, h: 1 };
  if (!b) {
    if (s.roads[i]) {
      const linked = s.network[i];
      const lines: Line[] = [{ text: N.road(linked, c.x === s.entrance.x && c.y === s.entrance.y), color: linked ? NOVA_CSS.text : NOVA_CSS.bad }];
      return { lines: [...lines, ...lossLine(s, c)], foot: one, building: null, action: null, demolish: true, aside: [] };
    }
    const f = s.feature[i];
    if (f === 'stump') {
      const cut = s.stumps.find((t) => t.i === i);
      const left = cut ? Math.max(1, RULES.treeRegrowWeeks - (s.week - cut.week)) : RULES.treeRegrowWeeks;
      return { lines: [{ text: N.stump(left) }], foot: one, building: null, action: null, demolish: false, aside: [] };
    }
    if (f === 'rock') return { lines: [{ text: N.rock(T.feature.rock) }], foot: one, building: null, action: null, demolish: false, aside: [] };
    if (f) return { lines: [{ text: N.tree(T.feature[treeKind(f, c.x, c.y)]) }], foot: one, building: null, action: null, demolish: false, aside: [] };
    return null;
  }
  const foot = { x: b.x, y: b.y, w: b.w, h: b.h };
  const lines: Line[] = [];
  let action: Action | null = null;
  if (b.kind === 'house') return houseCard(s, b, births);
  const def = BUILDINGS[b.kind];
  const craft = craftOf(b);
  lines.push({ text: craft ? `${def.name} (${T.craft[craft]})` : def.name, size: S.num });
  if (b.kind === 'altar') {
    lines.push({ text: N.altar, bold: false }, { text: T.nova.reach(def.radius ?? 0), color: NOVA_CSS.muted, bold: false });
    return { lines, foot, building: b, action: null, demolish: false, aside: [] };
  }
  lines.push({ text: T.nova.effect[b.kind], bold: false });
  lines.push(ok(b.connected, b.connected ? N.connected : N.disconnected));
  if (!b.connected) action = { label: N.where.road, kind: 'road', target: b };
  else {
    const served = housesServed(s, b);
    if (served !== null) lines.push({ text: N.serves(served) });
    if (def.jobs) lines.push({ text: T.nova.jobs(def.jobs) + (eco.efficiency < 1 && eco.efficiency > 0 ? ` · ${N.efficiency(Math.round(eco.efficiency * 100))}` : '') });
    if (def.fieldBonus) lines.push({ text: N.fieldBonus(Math.round(fieldBonus(s) * 100)), color: NOVA_CSS.good });
    if (def.jobs && eco.efficiency === 0) lines.push({ text: N.noWorkers, color: NOVA_CSS.bad });
  }
  lines.push(...foodLines(s, b, eco));
  const upkeep = statOf(b, 'upkeep');
  if (upkeep) lines.push({ text: N.upkeep(upkeep), color: NOVA_CSS.gold });
  // Service levels: what the next one changes, and the gold Melhorar (grey without the silver).
  const levels: Line[] = [];
  if (def.levels) {
    const next = nextLevelOf(b);
    const stat = levelStatOf(b.kind);
    levels.push({ text: N.levelOf(b.level, def.levels.length + 1), color: NOVA_CSS.muted, bold: false, gap: PHONE ? 0 : px(4) });
    if (!next) levels.push({ text: N.topLevel, color: NOVA_CSS.gold });
    else if (stat) {
      const up = { kind: b.kind, level: b.level + 1 };
      const say = T.nova.levelStat[stat];
      levels.push({ text: N.nextLevel(b.level + 1, say(statOf(up, stat)), statOf(up, 'upkeep'), say(statOf(b, stat)), upkeep), color: NOVA_CSS.gold, box: true });
    }
    if (next && !action) {
      const short = s.silver < next.cost;
      const lack = lackingMaterial(s, next.materials ?? {});
      const label = short ? T.missingSilver(next.cost) : lack ? T.lacking(lack) : N.upgrade(next.cost, next.materials);
      action = { label, kind: 'upgrade', target: b, dim: short || !!lack };
    }
  }
  if (!def.protected) levels.push(...lossLine(s, c));
  // Phone: a building with levels shows them in a second column, with the buttons under it (the screen is short).
  if (PHONE && def.levels) return { lines, foot, building: b, action, demolish: !def.protected, aside: levels };
  return { lines: [...lines, ...levels], foot, building: b, action, demolish: !def.protected, aside: [] };
}

/** The stat a service building's levels change (granary storage, market reach, workshop field bonus). */
export function levelStatOf(kind: BuildableKind): LevelStat & keyof typeof T.nova.levelStat | null {
  const first = BUILDINGS[kind].levels?.[0];
  return first ? ((['storage', 'radius', 'fieldBonus'] as const).find((k) => first[k] !== undefined) ?? null) : null;
}

/**
 * A house: "Casa de barro · 3/4 pessoas", its people (tap opens the sheet; two columns on the
 * phone), whether they can have children, then the level part: next level, needs, joy and the
 * gain (beside the people on the phone, under them on PC). An empty house says what it waits for.
 */
function houseCard(s: GameState, b: Building, births: BirthBlock | null): Card {
  const N = T.nova.inspect;
  const P = T.nova.people;
  const h = houseInfo(s, b)!;
  const foot = { x: b.x, y: b.y, w: b.w, h: b.h };
  const lines: Line[] = [];
  let action: Action | null = null;
  const walking = s.families.filter((f) => f.houseId === b.id).flatMap((f) => f.members.map((id) => personById(s, id)?.name ?? ''));
  const coming: Line[] = walking.length ? [{ text: P.coming(walking.filter(Boolean).join(', ')), color: NOVA_CSS.good }] : [];
  if (h.level === 0) {
    const kept = b.emptyLevel > 0 ? HOUSE_LEVELS[b.emptyLevel].name : null;
    lines.push({ text: kept ? P.empty(kept) : N.plotWaiting, size: kept ? S.text : S.num });
    if (!b.connected) {
      lines.push({ text: N.plotNoRoad, color: NOVA_CSS.bad });
      action = { label: N.where.road, kind: 'road', target: b };
    } else lines.push(...coming);
    return { lines, foot, building: b, action, demolish: true, aside: [] };
  }
  lines.push({ text: P.head(h.name, h.residents, h.capacity), size: S.num });
  const jobs = jobsOf(s);
  const grid: Chip[] = residentsOf(s, b).map((p) => ({
    id: p.id,
    title: P.row(p.name, ageNow(s, p)),
    sub: isWalking(s, p.id) ? P.walking : jobText(s, p, jobs),
    subColor: jobs.get(p.id) === null ? NOVA_CSS.warn : undefined,
    band: bandOf(s, p),
    sex: p.sex,
  }));
  if (grid.length) lines.push({ text: '', grid, cols: PHONE ? 2 : 1, gap: px(4) });
  // Whether they can have children, and who is on the way (phone: at the top of the level column).
  const family: Line[] = [];
  const kids = houseBirths(s, b, births);
  if (kids) family.push(ok(kids === 'ok', P.births[kids]));
  family.push(...coming);

  // Phone: the level part sits beside the people, so it is short (the next level only, no tax line).
  const head = h.next ? (PHONE ? N.nextOnly(h.next.name) : N.next(h.name, h.next.name)) : `${h.name} · ${N.top}`;
  const level: Line[] = [{ text: head, size: PHONE ? S.text : S.num, color: PHONE ? NOVA_CSS.gold : NOVA_CSS.text, gap: PHONE ? 0 : px(6) }];
  if (!PHONE) level.push({ text: N.tax(h.tax), color: NOVA_CSS.muted, bold: false });
  if (h.happiness) {
    const { value, mood, parts } = h.happiness;
    const why = parts.map((p) => `${T.happinessPart[p.kind]} ${p.value > 0 ? '+' : '−'}${Math.abs(p.value)}`).join(', ');
    level.push({ text: N.happiness(value, mood, why), color: mood === 'sad' ? NOVA_CSS.bad : mood === 'happy' ? NOVA_CSS.good : NOVA_CSS.text, bold: false });
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
    const wait = h.waiting;
    // What it has on one line (green ✓) and what it lacks on another (red ✗).
    let gap = px(4);
    for (const has of wait ? [] : [true, false]) {
      const names = needs.filter((n) => n.ok === has).map((n) => label(n.kind, n.ok));
      if (!names.length) continue;
      level.push({ ...ok(has, names.join(', ')), gap });
      gap = 0;
    }
    const left = weeksToNextLevel(s, b);
    if (s.famine) level.push({ text: N.famine, color: NOVA_CSS.bad });
    else if (wait) level.push({ text: N.waiting(h.next.name, Math.ceil((h.next.materials[wait] ?? 0) - s[wait]), wait), color: NOVA_CSS.bad, gap: px(4) });
    else if (left !== null) level.push({ text: N.nextIn(h.next.name, left), color: NOVA_CSS.good });
    const gain = upgradeGain(h.level);
    // Phone: the gain goes right under "Próximo nível" as one plain line (the column is short).
    if (gain && PHONE) level.splice(1, 0, { text: N.gain(gain.capacity, gain.tax), color: NOVA_CSS.gold, bold: false });
    else if (gain) level.push({ text: `${N.evolve}: ${N.gain(gain.capacity, gain.tax)}`, color: NOVA_CSS.gold, box: true, gap: px(4) });
    // What climbing asks (waiting, the red line above already says what is missing).
    if (gain && !wait && Object.keys(gain.materials).length) level.push({ text: N.asks(gain.materials), color: NOVA_CSS.gold, bold: false });
    // Main action: the first missing need the player can build now; waiting, where to put the lumber or quarry.
    const miss = h.next.needs.find((n) => !n.ok);
    const maker = wait === 'wood' ? 'lumber' : wait === 'stone' ? 'quarry' : null;
    if (miss?.kind === 'road') action = { label: N.where.road, kind: 'road', target: b };
    else if (miss && s.unlocked.includes(miss.kind)) action = { label: N.where[miss.kind], kind: miss.kind, target: b };
    else if (!miss && maker && s.unlocked.includes(maker)) action = { label: N.where[maker], kind: maker, target: b };
  } else if (!b.connected) level.push(ok(false, N.noRoad));
  // Phone: the level beside the people (the screen is short); PC: under them.
  if (PHONE && family.length) level[0].gap = px(4);
  return PHONE ? { lines, foot, building: b, action, demolish: true, aside: [...family, ...level] } : { lines: [...lines, ...family, ...level], foot, building: b, action, demolish: true, aside: [] };
}

/** "Perde N de comida" when demolishing this would spoil food (a granary, or the road to one). */
function lossLine(s: GameState, c: Cell): Line[] {
  const n = foodLostIfRemoved(s, c.x, c.y);
  return n > 0 ? [ok(false, T.nova.foodLost(n))] : [];
}

/** Field, fisher, gatherer and granary: when it harvests, what it yields, what it keeps. */
function foodLines(s: GameState, b: Building, eco: Economy): Line[] {
  const def = BUILDINGS[b.kind];
  const N = T.nova;
  const out: Line[] = [];
  if (def.harvest) {
    if (!harvestsIn(s.week)) out.push({ text: N.inspect.frozen(weeksToHarvest(s.week)), color: NOVA_CSS.warn });
    else if (b.connected) out.push({ text: N.inspect.harvesting(fieldHarvest(s, b, s.week) * eco.efficiency), color: NOVA_CSS.good });
    if (s.drought) out.push(byRiver(s, b) ? { text: N.inspect.droughtRiver, color: NOVA_CSS.good } : { text: N.inspect.droughtDry, color: NOVA_CSS.warn });
  }
  if (def.gather && b.connected) {
    const n = gatherYield(s, b) * eco.efficiency;
    out.push(n > 0 ? { text: N.yields(n, def.gather.product), color: NOVA_CSS.good } : ok(false, N.inspect.noSource[def.gather.source]));
    const every = def.cutEvery ? weeksPerCut(n) : null;
    if (every) out.push({ text: N.cutsEvery(every), color: NOVA_CSS.muted, bold: false });
  }
  const working = def.gather || (def.harvest && harvestsIn(s.week));
  if (working && b.connected && eco.efficiency > 0 && eco.efficiency < 1) out.push({ text: N.inspect.fewWorkers(Math.round(eco.efficiency * 100)), color: NOVA_CSS.warn });
  if (def.storage) out.push({ text: N.stores(statOf(b, 'storage')), color: b.connected ? NOVA_CSS.text : NOVA_CSS.muted });
  return out;
}

/**
 * Balloon of the cell tapped with Mover, beside it with an arrow, following the camera. Round buttons
 * under it: the gold main action (when there is something to do), Demolir (never the altar or the
 * temple; a second tap confirms) and Fechar.
 */
export class Inspector {
  private balloon: TextBalloon;
  private buttons: Phaser.GameObjects.Container;
  private btns: RoundButton[] = [];
  private tags: Rect[] = [];
  private card: Card | null = null;
  private cell: Cell | null = null;
  private key = '';
  private confirm: Phaser.Time.TimerEvent | null = null;
  private side: 'left' | 'right' = 'right';
  /** Width of the row of round buttons. */
  private rowW = 0;
  /** The buttons sit inside the balloon (see `TextBalloon.slot`) instead of under it. */
  private inside = false;

  constructor(private scene: Phaser.Scene, private host: InspectorHost) {
    this.balloon = new TextBalloon(scene, 46);
    this.balloon.onChip = (id) => this.host.openPerson(id);
    this.buttons = scene.add.container(0, 0).setDepth(46).setVisible(false);
  }

  get open() {
    return !!this.card;
  }

  refresh(s: GameState, city: CityReadout, selected: Cell | null) {
    this.cell = selected;
    this.card = selected ? card(s, selected, city) : null;
    if (!this.card) {
      this.balloon.hide();
      this.buttons.setVisible(false);
      this.key = '';
      this.nudgedFor = '';
      return;
    }
    const key = JSON.stringify([selected, this.card.action?.label, this.card.action?.dim, this.card.demolish]);
    if (key !== this.key) {
      this.key = key;
      this.makeButtons();
    }
    // Phone house: the buttons go inside the balloon, under the level column (the screen is short).
    this.inside = PHONE && this.card.aside.length > 0;
    this.balloon.show(this.card.lines, this.placer(), this.card.aside, this.inside ? { w: this.rowW, h: S.btn + S.labelH + px(3) } : null);
    this.placeButtons();
  }

  private makeButtons() {
    this.buttons.removeAll(true);
    this.btns = [];
    this.tags = [];
    this.confirm?.remove();
    const c = this.card!;
    const d = S.btn;
    const list: [Phaser.GameObjects.GameObject[], string, () => void, 'gold' | 'parchment' | 'dim'][] = [];
    if (c.action) {
      const a = c.action;
      const kind = a.kind === 'upgrade' ? (a.target.kind as BuildableKind) : a.kind;
      const content = kind === 'road' ? [icon(this.scene, 'road', d * 0.56)] : [this.scene.add.image(0, 0, TEX.thumb(kind)).setDisplaySize(d - px(8), d - px(8))];
      list.push([content, a.label, () => this.host.act(a), a.dim ? 'dim' : 'gold']);
    }
    if (c.demolish) list.push([[icon(this.scene, 'hammer', d * 0.56)], T.nova.inspect.demolish, () => this.demolishTap(), 'parchment']);
    list.push([[ntext(this.scene, 0, 0, '✕', S.num, NOVA_CSS.ink).setOrigin(0.5)], T.nova.inspect.close, () => this.host.close(), 'parchment']);
    let x = 0;
    for (const [content, label, press, style] of list) {
      const tag = nameTag(this.scene, 0, d / 2 + px(3) + S.labelH / 2, label);
      const w = Math.max(d, tag.w);
      const cx = x + w / 2;
      for (const o of tag.objects) o.x += cx;
      const btn = new RoundButton(this.scene, cx, 0, d, d, content, press, style === 'dim' ? { dim: true } : { style });
      this.buttons.add([btn.root, ...tag.objects]);
      this.btns.push(btn);
      this.tags.push({ x: cx - tag.w / 2, y: d / 2, w: tag.w, h: S.labelH + px(3) });
      x += w + px(10);
    }
    this.rowW = x - px(10);
  }

  /** First tap on Demolir asks "Certeza?"; a second tap within 2.5 s demolishes. */
  private demolishTap() {
    const btn = this.btns[this.card?.action ? 1 : 0];
    if (this.confirm) {
      this.confirm.remove();
      this.confirm = null;
      if (this.cell) this.host.demolish(this.cell);
      return;
    }
    btn.setLook({ style: 'gold', selected: true });
    const tagText = this.buttons.list.find((o) => o instanceof Phaser.GameObjects.Text && o.text === T.nova.inspect.demolish) as Phaser.GameObjects.Text | undefined;
    tagText?.setText(T.nova.inspect.confirm).setColor(NOVA_CSS.bad);
    this.confirm = this.scene.time.delayedCall(2500, () => {
      this.confirm = null;
      btn.setLook({ style: 'parchment' });
      tagText?.setText(T.nova.inspect.demolish).setColor(NOVA_CSS.text);
    });
  }

  /** The selection the camera was last nudged for (once per tapped building). */
  private nudgedFor = '';

  /**
   * Beside the building: right of it if there is room, else left; never under the screen edges. A
   * balloon too wide for either side (the phone house with its people) is kept on screen and the
   * camera is asked once to move the building aside.
   */
  private placer() {
    const f = this.card!.foot;
    return (w: number, h: number) => {
      const p = this.host.cellScreen(f.x, f.y, f.w, f.h);
      const reach = Math.max(px(24), ((f.w + f.h) / 2) * HW * p.zoom);
      const right = p.x + reach + px(9);
      const left = p.x - reach - px(9) - w;
      const btnH = this.inside ? 0 : S.btn + S.labelH + px(10);
      const maxRight = W - S.col - px(30);
      const minLeft = S.margin + S.side + px(10);
      const fitsRight = right + w <= maxRight;
      const fitsLeft = left >= minLeft;
      this.side = fitsRight || (!fitsLeft && p.x < W / 2) ? 'right' : 'left';
      let x = this.side === 'right' ? right : left;
      if (!fitsRight && !fitsLeft) {
        x = Math.max(minLeft, Math.min(maxRight - w, x));
        const key = JSON.stringify(this.cell);
        if (this.nudgedFor !== key) {
          this.nudgedFor = key;
          this.host.nudge(this.side === 'right' ? maxRight - w - right : minLeft - left);
        }
      }
      // Under the top bar, and above the bottom tools when it would reach them (never hides a control).
      const lim = this.host.limits();
      const bottom = x < lim.toolsRight ? lim.toolsTop - S.gap : H - S.margin;
      const y = Math.max(lim.top + S.gap, Math.min(bottom - h - btnH, p.y - h / 2));
      return { x, y, arrow: { side: this.side === 'right' ? ('left' as const) : ('right' as const), at: p.y - y } };
    };
  }

  private placeButtons() {
    const r = this.balloon.rect;
    if (!r) return;
    const slot = this.inside ? this.balloon.slot : null;
    if (slot) this.buttons.setVisible(true).setPosition(r.x + slot.x, r.y + slot.y + S.btn / 2);
    else this.buttons.setVisible(true).setPosition(r.x + px(4), r.y + r.h + px(8) + S.btn / 2);
  }

  /** Every frame: follows the building when the camera moves. */
  update() {
    if (!this.card) return;
    this.balloon.place(this.placer());
    this.placeButtons();
  }

  contains(x: number, y: number) {
    if (!this.card) return false;
    const inR = (r: Rect | null) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    const ox = this.buttons.x;
    const oy = this.buttons.y;
    return inR(this.balloon.rect) || this.btns.some((b) => b.contains(x, y)) || this.tags.some((t) => inR({ x: t.x + ox, y: t.y + oy, w: t.w, h: t.h }));
  }
}

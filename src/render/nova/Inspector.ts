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
  upkeepCharged,
  weeksToNextLevel,
  fieldBonus,
  foodLostIfRemoved,
  needLocked,
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
import { TextBalloon, type Line } from './Balloon';
import { H, S, W } from './metrics';
import { icon, nameTag, ntext, RoundButton } from './widgets';

/** What the main (gold) button does: pick a building and show where it would solve the need, or pick Rua. */
export type Action = { label: string; kind: BuildableKind | 'road'; target: Building };

interface Card {
  lines: Line[];
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
}

const ok = (yes: boolean, label: string): Line => ({ text: `${yes ? '✓' : '✗'} ${label}`, color: yes ? NOVA_CSS.good : NOVA_CSS.bad });

/** The card of a tapped cell; null for plain land and the river (a tap there closes the balloon). */
function card(s: GameState, c: Cell, { eco, block }: CityReadout): Card | null {
  const N = T.nova.inspect;
  const i = indexOf(s, c.x, c.y);
  const b = s.grid[i];
  const one = { x: c.x, y: c.y, w: 1, h: 1 };
  if (!b) {
    if (s.roads[i]) {
      const linked = s.network[i];
      const lines: Line[] = [{ text: N.road(linked, c.x === s.entrance.x && c.y === s.entrance.y), color: linked ? NOVA_CSS.text : NOVA_CSS.bad }];
      return { lines: [...lines, ...lossLine(s, c)], foot: one, building: null, action: null, demolish: true };
    }
    const f = s.feature[i];
    if (f === 'rock') return { lines: [{ text: N.rock(T.feature.rock) }], foot: one, building: null, action: null, demolish: false };
    if (f) return { lines: [{ text: N.tree(T.feature[treeKind(f, c.x, c.y)]) }], foot: one, building: null, action: null, demolish: false };
    return null;
  }
  const foot = { x: b.x, y: b.y, w: b.w, h: b.h };
  const lines: Line[] = [];
  let action: Action | null = null;
  if (b.kind === 'house') {
    const h = houseInfo(s, b)!;
    if (h.level === 0) {
      lines.push({ text: h.name, size: S.num });
      if (!b.connected) {
        lines.push({ text: N.plotNoRoad, color: NOVA_CSS.bad });
        action = { label: N.where.road, kind: 'road', target: b };
      } else if (s.families.some((f) => f.houseId === b.id)) lines.push({ text: N.plotComing, color: NOVA_CSS.good });
      else {
        // Waiting: and why no family comes yet, if something blocks them.
        lines.push({ text: N.plotWaiting }, ...(block && block !== 'wait' ? [{ text: T.familyBlockText(block, s), color: NOVA_CSS.bad }] : []));
      }
      return { lines, foot, building: b, action, demolish: true };
    }
    lines.push({ text: h.next ? N.next(h.name, h.next.name) : `${h.name} · ${N.top}`, size: S.num });
    lines.push({ text: N.residents(h.residents, h.tax), color: NOVA_CSS.muted, bold: false });
    if (h.happiness) {
      const { value, mood, parts } = h.happiness;
      const why = parts.map((p) => `${T.happinessPart[p.kind]} ${p.value > 0 ? '+' : '−'}${Math.abs(p.value)}`).join(', ');
      lines.push({ text: N.happiness(value, mood, why), color: mood === 'sad' ? NOVA_CSS.bad : mood === 'happy' ? NOVA_CSS.good : NOVA_CSS.text, bold: false });
    }
    if (h.next) {
      // What it has (green) and what it lacks (red), always with ✓ / ✗.
      const needs = [...h.next.needs].sort((a, z) => Number(z.ok) - Number(a.ok));
      // A missing service still locked says which goal unlocks it.
      const label = (kind: NeedKind, has: boolean) => {
        if (kind === 'road' && !has) return N.noRoad;
        const goal = needLocked(s, kind) ? unlockingGoal(kind as BuildableKind) : null;
        return goal ? N.lockedNeed(T.need[kind], goal) : T.need[kind];
      };
      needs.forEach((n, k) => lines.push({ ...ok(n.ok, label(n.kind, n.ok)), gap: k ? 0 : px(4) }));
      const left = weeksToNextLevel(s, b);
      if (s.famine) lines.push({ text: N.famine, color: NOVA_CSS.bad });
      else if (left !== null) lines.push({ text: N.nextIn(h.next.name, left), color: NOVA_CSS.good });
      const gain = upgradeGain(h.level, s.week);
      if (gain) lines.push({ text: `${N.evolve}: ${N.gain(gain.residents, gain.tax, gain.food)}`, color: NOVA_CSS.gold, box: true, gap: px(4) });
      // Main action: the first missing need the player can build now.
      const miss = h.next.needs.find((n) => !n.ok);
      if (miss?.kind === 'road') action = { label: N.where.road, kind: 'road', target: b };
      else if (miss && s.unlocked.includes(miss.kind)) action = { label: N.where[miss.kind], kind: miss.kind, target: b };
    } else if (!b.connected) lines.push(ok(false, N.noRoad));
    return { lines, foot, building: b, action, demolish: true };
  }

  const def = BUILDINGS[b.kind];
  const craft = craftOf(b);
  lines.push({ text: craft ? `${def.name} (${T.craft[craft]})` : def.name, size: S.num });
  if (b.kind === 'altar') {
    lines.push({ text: N.altar, bold: false }, { text: T.nova.reach(def.radius ?? 0), color: NOVA_CSS.muted, bold: false });
    return { lines, foot, building: b, action: null, demolish: false };
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
  if (def.upkeep) lines.push({ text: N.upkeep(def.upkeep, upkeepCharged(s)), color: NOVA_CSS.gold });
  if (!def.protected) lines.push(...lossLine(s, c));
  return { lines, foot, building: b, action, demolish: !def.protected };
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
  }
  const working = def.gather || (def.harvest && harvestsIn(s.week));
  if (working && b.connected && eco.efficiency > 0 && eco.efficiency < 1) out.push({ text: N.inspect.fewWorkers(Math.round(eco.efficiency * 100)), color: NOVA_CSS.warn });
  if (def.storage) out.push({ text: N.stores(def.storage), color: b.connected ? NOVA_CSS.text : NOVA_CSS.muted });
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

  constructor(private scene: Phaser.Scene, private host: InspectorHost) {
    this.balloon = new TextBalloon(scene, 46);
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
      return;
    }
    const key = JSON.stringify([selected, this.card.action?.label, this.card.demolish]);
    if (key !== this.key) {
      this.key = key;
      this.makeButtons();
    }
    this.balloon.show(this.card.lines, this.placer());
    this.placeButtons();
  }

  private makeButtons() {
    this.buttons.removeAll(true);
    this.btns = [];
    this.tags = [];
    this.confirm?.remove();
    const c = this.card!;
    const d = S.btn;
    const list: [Phaser.GameObjects.GameObject[], string, () => void, 'gold' | 'parchment'][] = [];
    if (c.action) {
      const a = c.action;
      const content = a.kind === 'road' ? [icon(this.scene, 'road', d * 0.56)] : [this.scene.add.image(0, 0, TEX.thumb(a.kind)).setDisplaySize(d - px(8), d - px(8))];
      list.push([content, a.label, () => this.host.act(a), 'gold']);
    }
    if (c.demolish) list.push([[icon(this.scene, 'hammer', d * 0.56)], T.nova.inspect.demolish, () => this.demolishTap(), 'parchment']);
    list.push([[ntext(this.scene, 0, 0, '✕', S.num, NOVA_CSS.ink).setOrigin(0.5)], T.nova.inspect.close, () => this.host.close(), 'parchment']);
    let x = 0;
    for (const [content, label, press, style] of list) {
      const tag = nameTag(this.scene, 0, d / 2 + px(3) + S.labelH / 2, label);
      const w = Math.max(d, tag.w);
      const cx = x + w / 2;
      for (const o of tag.objects) o.x += cx;
      const btn = new RoundButton(this.scene, cx, 0, d, d, content, press, { style });
      this.buttons.add([btn.root, ...tag.objects]);
      this.btns.push(btn);
      this.tags.push({ x: cx - tag.w / 2, y: d / 2, w: tag.w, h: S.labelH + px(3) });
      x += w + px(10);
    }
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

  /** Beside the building: right of it if there is room, else left; never under the screen edges. */
  private placer() {
    const f = this.card!.foot;
    return (w: number, h: number) => {
      const p = this.host.cellScreen(f.x, f.y, f.w, f.h);
      const reach = Math.max(px(24), ((f.w + f.h) / 2) * HW * p.zoom);
      const right = p.x + reach + px(9);
      const left = p.x - reach - px(9) - w;
      const btnH = S.btn + S.labelH + px(10);
      this.side = right + w <= W - S.col - px(30) || left < S.margin + S.side + px(10) ? 'right' : 'left';
      const x = this.side === 'right' ? right : left;
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
    this.buttons.setVisible(true).setPosition(r.x + px(4), r.y + r.h + px(8) + S.btn / 2);
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

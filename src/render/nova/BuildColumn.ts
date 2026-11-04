import Phaser from 'phaser';
import { balanceAfter, BUILDINGS, fieldBonus, buildMenu, computeEconomy, costOf, foodAfter, GOALS, unlockingGoal, upkeepCharged, type BuildableKind, type BuildingCategory, type GameState, type Placeable } from '../../core';
import { px, type Rect } from '../layout';
import { NOVA, NOVA_CSS } from '../palette';
import { T } from '../strings';
import { TEX } from '../textures';
import { categoryKinds, COLUMN_ORDER, keyOf, type Tool } from '../tools';
import { TextBalloon, type Line } from './Balloon';
import { H, PHONE, S, W } from './metrics';
import { darkPanel, icon, ntext, RoundButton } from './widgets';

const LOCKED_MS = 2500;

interface Item {
  kind: BuildableKind | null;
  category: BuildingCategory | null;
  btn: RoundButton;
  thumb: Phaser.GameObjects.Image;
  lock: Phaser.GameObjects.Container;
  badge: Phaser.GameObjects.Container;
  name: Phaser.GameObjects.Text | null;
  price: Phaser.GameObjects.Text | null;
}

/**
 * The build column (right edge, top to bottom): one round button per building with its thumbnail
 * (PC: name and "price · tecla N" inside). Above `toolColumnMax` buildings it shows the categories,
 * each opening a strip with its buildings. Choosing a building opens a balloon at its left.
 */
export class BuildColumn {
  readonly rect: Rect;
  private items: Item[] = [];
  private strip: { root: Phaser.GameObjects.Container; rect: Rect; items: Item[]; category: BuildingCategory } | null = null;
  private balloon: TextBalloon;
  /** The tool the balloon talks about (null: closed). */
  private balloonFor: Tool | null = null;
  private lastTool: Tool = 'view';
  private lockedTimer: Phaser.Time.TimerEvent | null = null;
  private lockedOn: BuildableKind | null = null;
  /** Just unlocked and not chosen yet: "novo". */
  private fresh = new Set<BuildableKind>();
  private state: GameState | null = null;

  /** `minY`: the balloons stay under this (the top right controls). */
  constructor(private scene: Phaser.Scene, private onPick: (kind: BuildableKind) => void, private minY: () => number = () => S.margin) {
    const menu = buildMenu(COLUMN_ORDER);
    const n = menu.mode === 'list' ? menu.items.length : menu.groups.length;
    const colW = S.col + 2 * S.colPad;
    const avail = H - 2 * S.margin - 2 * S.colPad;
    const gap = Math.max(px(2), Math.min(S.colGapMax, (avail - n * S.col) / Math.max(1, n - 1)));
    const content = n * S.col + (n - 1) * gap + 2 * S.colPad;
    const h = PHONE ? H - 2 * S.margin : content;
    this.rect = { x: W - S.margin - colW, y: PHONE ? S.margin : Math.round((H - h) / 2), w: colW, h };
    darkPanel(scene.add.graphics(), this.rect.x, this.rect.y, colW, h, colW / 2);
    const cx = this.rect.x + colW / 2;
    const y0 = this.rect.y + (h - content) / 2 + S.colPad + S.col / 2;
    if (menu.mode === 'list') menu.items.forEach((kind, k) => this.items.push(this.item(cx, y0 + k * (S.col + gap), kind, null)));
    else menu.groups.forEach((g, k) => this.items.push(this.item(cx, y0 + k * (S.col + gap), null, g.category)));
    this.balloon = new TextBalloon(scene, 45);
  }

  /** A round button: the building (or category) thumbnail, lock and "novo" badges, PC name and price. */
  private item(x: number, y: number, kind: BuildableKind | null, category: BuildingCategory | null, parent?: Phaser.GameObjects.Container): Item {
    const s = this.scene;
    const d = S.col;
    const key = kind ? TEX.thumb(kind) : TEX.categoryThumb(category!);
    const thumb = s.add.image(0, PHONE ? 0 : -d * 0.2, key);
    thumb.setDisplaySize(PHONE ? d - px(6) : d * 0.46, PHONE ? d - px(6) : d * 0.46);
    const label = kind ? BUILDINGS[kind].name : T.nova.category[category!];
    const name = PHONE ? null : ntext(s, 0, d * 0.13, label, S.small, NOVA_CSS.ink).setOrigin(0.5);
    // A long name shrinks until it fits inside the round button, never under 12 px; a category
    // name (no price under it) that still does not fit goes on two lines ("Água e / comida").
    if (name) {
      for (let size = S.small - px(0.5); name.width > d * 0.84 && size >= px(12); size -= px(0.5)) name.setFontSize(size);
      if (name.width > d * 0.84 && !kind) name.setWordWrapWidth(d * 0.84).setAlign('center').setLineSpacing(-px(3)).setY(d * 0.2);
    }
    const price = PHONE || !kind ? null : ntext(s, 0, d * 0.28, '', px(12), NOVA_CSS.ink, false).setOrigin(0.5);
    const ls = PHONE ? px(20) : px(26);
    const lockBg = s.add.graphics().fillStyle(NOVA.parchment, 1).fillCircle(0, 0, ls / 2).lineStyle(px(1.5), NOVA.border, 1).strokeCircle(0, 0, ls / 2);
    const lock = s.add.container(d * 0.34, PHONE ? d * 0.34 : -d * 0.34, [lockBg, icon(s, 'lock', ls * 0.7)]).setVisible(false);
    // "Novo": a gold dot with a dark ring on the top right edge, clear of the drawing.
    const dot = px(PHONE ? 7 : 8);
    const dotBg = s.add.graphics().fillStyle(NOVA.goldLight, 1).fillCircle(0, 0, dot).lineStyle(px(2), NOVA.border, 1).strokeCircle(0, 0, dot);
    const badge = s.add.container(d * 0.36, -d * 0.36, [dotBg]).setVisible(false);
    const content = [thumb, ...(name ? [name] : []), ...(price ? [price] : []), lock, badge];
    const it: Item = { kind, category, thumb, lock, badge, name, price, btn: null! };
    it.btn = new RoundButton(s, x, y, d, d, content, () => this.press(it), {}, true);
    parent?.add(it.btn.root);
    return it;
  }

  private press(it: Item) {
    if (it.category) {
      this.toggleStrip(it);
      return;
    }
    const kind = it.kind!;
    if (this.state && !this.state.unlocked.includes(kind)) {
      this.showLocked(it);
      return;
    }
    this.fresh.delete(kind);
    this.closeStrip();
    this.onPick(kind);
  }

  refresh(s: GameState, tool: Tool) {
    this.state = s;
    for (const it of this.allItems()) this.paint(it, s, tool);
    if (tool !== this.lastTool) {
      this.lastTool = tool;
      this.balloonFor = tool !== 'view' && tool !== 'road' && tool !== 'clear' ? tool : null;
      if (!this.balloonFor) this.balloon.hide();
    }
    if (this.balloonFor && this.lockedOn === null) this.showToolBalloon(s, this.balloonFor as BuildableKind);
  }

  private allItems() {
    return [...this.items, ...(this.strip?.items ?? [])];
  }

  private paint(it: Item, s: GameState, tool: Tool) {
    if (it.category) {
      const kinds = categoryKinds(it.category);
      const locked = kinds.every((k) => !s.unlocked.includes(k));
      const selected = kinds.includes(tool as BuildableKind) || this.strip?.category === it.category;
      it.btn.setLook({ selected, locked });
      it.thumb.setTexture(locked ? TEX.categoryThumbLocked(it.category) : TEX.categoryThumb(it.category));
      it.lock.setVisible(locked);
      it.badge.setVisible(kinds.some((k) => this.fresh.has(k)));
      return;
    }
    const kind = it.kind!;
    const locked = !s.unlocked.includes(kind);
    const cost = costOf(kind);
    const short = !locked && s.silver < cost;
    it.btn.setLook({ selected: tool === kind, locked, dim: short });
    const key = locked ? TEX.thumbLocked(kind) : TEX.thumb(kind);
    if (it.thumb.texture.key !== key) {
      const { displayWidth: dw, displayHeight: dh } = it.thumb;
      it.thumb.setTexture(key).setDisplaySize(dw, dh);
    }
    it.lock.setVisible(locked);
    it.badge.setVisible(this.fresh.has(kind) && !locked);
    if (it.price) {
      const goal = unlockingGoal(kind) ?? 0;
      it.price.setText(locked ? T.nova.lockedGoal(goal, GOALS[goal - 1]?.fromYear) : T.nova.costKey(cost, keyOf(kind)));
      it.price.setColor(short ? NOVA_CSS.inkBad : NOVA_CSS.ink);
    }
  }

  /** The balloon of the chosen building, at the left of its button. */
  private showToolBalloon(s: GameState, kind: BuildableKind) {
    const d = BUILDINGS[kind];
    const N = T.nova;
    const head = [N.price(d.cost, d.upkeep ?? 0, upkeepCharged(s)), ...(!PHONE && d.jobs ? [N.jobs(d.jobs)] : [])].join(' · ');
    const lines: Line[] = [
      { text: d.name, size: S.num },
      { text: head, color: NOVA_CSS.gold },
      { text: N.effect[kind], bold: false },
    ];
    if (d.gather) lines.push({ text: N.gatherRule(d.gather.source, d.gather.perCell, d.gather.radius, d.gather.max), color: NOVA_CSS.muted, bold: false });
    if (d.storage) lines.push({ text: N.stores(d.storage), color: NOVA_CSS.muted, bold: false });
    if (d.fieldBonus) {
      // The workshop's field bonus: the city's total after it, and when it is already at the cap.
      const pct = (n: number) => Math.round(n * 100);
      const now = fieldBonus(s);
      const max = d.fieldBonusMax ?? 0;
      const after = Math.min(max, now + d.fieldBonus);
      lines.push(now >= max ? { text: N.workshopFull(pct(max)), color: NOVA_CSS.warn } : { text: N.workshopBonus(pct(d.fieldBonus), pct(after), pct(max)), color: NOVA_CSS.good });
    }
    if (!PHONE && d.radius) lines.push({ text: N.reach(d.radius), color: NOVA_CSS.muted, bold: false });
    if (!PHONE) {
      const after = balanceAfter(s, kind);
      lines.push({ text: N.balanceAfter(after), color: after < 0 ? NOVA_CSS.bad : NOVA_CSS.good });
    }
    // A workplace that takes workers from the food buildings: the food it costs (fisher, gatherer
    // and field say it on the map, where their spot is known).
    if (d.jobs && !d.gather && !d.harvest) {
      const food = foodAfter(s, kind).delta;
      if (food < computeEconomy(s).foodDelta) lines.push({ text: N.foodAfter(food), color: food < 0 ? NOVA_CSS.bad : NOVA_CSS.warn });
    }
    this.balloon.show(lines, this.besideButton(kind));
  }

  /** Places a balloon at the left of a building's button (or of its category), arrow pointing at it. */
  private besideButton(kind: BuildableKind) {
    const b = this.spotOf(kind);
    return (w: number, h: number) => {
      const left = this.strip ? this.strip.rect.x : this.rect.x;
      // Never over the season, speed and gear (they stay usable while a building is chosen).
      const y = Math.max(this.minY() + S.gap, Math.min(H - S.margin - h, b.y - h / 2));
      return { x: left - S.gap - px(9) - w, y, arrow: { side: 'right' as const, at: b.y - y } };
    };
  }

  private showLocked(it: Item) {
    const kind = it.kind!;
    this.lockedOn = kind;
    const n = unlockingGoal(kind) ?? 0;
    this.balloon.show([{ text: T.nova.unlocksAt(n, GOALS[n - 1]?.fromYear) }], this.besideButton(kind));
    this.lockedTimer?.remove();
    this.lockedTimer = this.scene.time.delayedCall(LOCKED_MS, () => {
      this.lockedOn = null;
      if (this.balloonFor && this.state) this.showToolBalloon(this.state, this.balloonFor as BuildableKind);
      else this.balloon.hide();
    });
  }

  private toggleStrip(it: Item) {
    const category = it.category!;
    const same = this.strip?.category === category;
    this.closeStrip();
    if (same) return;
    const kinds = categoryKinds(category);
    const d = S.col;
    const w = kinds.length * d + (kinds.length - 1) * S.gap + 2 * S.colPad;
    const h = d + 2 * S.colPad;
    const x = this.rect.x - S.gap - w;
    const y = it.btn.root.y - h / 2;
    const g = this.scene.add.graphics();
    darkPanel(g, 0, 0, w, h, h / 2, 0.85);
    const root = this.scene.add.container(x, y, [g]).setDepth(44);
    const items = kinds.map((k, i) => this.item(S.colPad + d / 2 + i * (d + S.gap), h / 2, k, null, root));
    this.strip = { root, rect: { x, y, w, h }, items, category };
    if (this.state) for (const i of this.allItems()) this.paint(i, this.state, this.lastTool);
  }

  /** Closes the category strip; false if none was open. */
  closeStrip(): boolean {
    const open = !!this.strip;
    this.strip?.root.destroy();
    this.strip = null;
    return open;
  }

  /** Opens the strip of a category (PC keys 3–6); nothing if it is open or the column lists every building. */
  openCategory(c: BuildingCategory) {
    if (this.strip?.category === c) return;
    const it = this.items.find((i) => i.category === c);
    if (it) this.toggleStrip(it);
  }

  /** "novo" until the player chooses it (not saved). */
  markNew(kind: Placeable) {
    if (kind !== 'road') this.fresh.add(kind);
  }

  /** A tap on the map: closes the strip and the balloon. */
  closeAll(): boolean {
    const open = !!this.strip || this.balloon.visible;
    this.closeStrip();
    this.balloon.hide();
    this.balloonFor = null;
    this.lockedOn = null;
    this.lockedTimer?.remove();
    return open;
  }

  /** Center of a building's button (its category's while the categories show). */
  private spotOf(kind: BuildableKind) {
    const own = this.allItems().find((i) => i.kind === kind) ?? this.items.find((i) => i.category === BUILDINGS[kind].category);
    if (!own) return { x: this.rect.x, y: this.rect.y + this.rect.h / 2 };
    const m = own.btn.root.getWorldTransformMatrix();
    return { x: m.tx, y: m.ty };
  }

  buttonOf(tool: Tool) {
    if (tool === 'view' || tool === 'road' || tool === 'clear') return null;
    const p = this.spotOf(tool);
    return { x: p.x, y: p.y, w: S.col, side: 'right' as const };
  }

  contains(x: number, y: number) {
    const inR = (r: Rect | null) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    return inR(this.rect) || inR(this.strip?.rect ?? null) || inR(this.balloon.rect);
  }
}

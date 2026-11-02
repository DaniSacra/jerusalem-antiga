import Phaser from 'phaser';
import { costOf, RULES, unlockingGoal, type GameState } from '../core';
import { BTN, BTN_GAP, BUILD_W, buildButton, DIVIDER, inRect, LEFT_BTN, LEFT_RAIL, leftButton, RIGHT_RAIL } from './layout';
import { C, CSS } from './palette';
import { T } from './strings';
import { cropImages, ORIGIN, TEX } from './textures';
import { BUILD_TOOLS, RAIL_TOOLS, type BuildTool, type Tool } from './tools';
import { RailButton, stonePanel, text } from './ui';

/** Shown on a building button when there is not enough silver. */
const SHORT_TINT = 0x8c8c8c;

interface BuildButton {
  kind: BuildTool;
  btn: RailButton;
  thumb: Phaser.GameObjects.Image[];
  coin: Phaser.GameObjects.Image;
  cost: Phaser.GameObjects.Text;
}

/** Building texture shrunk to fit a w x h button above the cost (fields get their crops on top). */
function thumbnail(scene: Phaser.Scene, kind: BuildTool, w: number, h: number): Phaser.GameObjects.Image[] {
  const key = TEX.building(kind, kind === 'house' ? 3 : 0);
  const thumbH = h - 28;
  const bottom = -h / 2 + 4 + thumbH;
  const img = scene.add.image(0, bottom, key).setOrigin(0.5, 1);
  const k = Math.min((w - 10) / img.width, thumbH / img.height);
  img.setScale(k);
  if (kind !== 'field') return [img];
  const [, oy] = ORIGIN[key];
  return [img, ...cropImages(scene, 0, bottom - img.height * (1 - oy) * k, k)];
}

/** The two side rails: Ver, Rua, Jardim, Limpar and the turn arrows on the left; the 6 buildings on the right. */
export class Toolbar {
  private tools = new Map<Tool, RailButton>();
  private builds: BuildButton[] = [];
  private roadCost!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, onSelect: (t: Tool) => void, onTurn: (dir: 1 | -1) => void) {
    const g = scene.add.graphics();
    stonePanel(g, LEFT_RAIL.x, LEFT_RAIL.y, LEFT_RAIL.w, LEFT_RAIL.h);
    stonePanel(g, RIGHT_RAIL.x, RIGHT_RAIL.y, RIGHT_RAIL.w, RIGHT_RAIL.h);

    RAIL_TOOLS.forEach((tool, k) => {
      const { x, y } = leftButton(k);
      if (tool === 'garden') {
        this.addBuild(scene, tool, x, y, BTN, LEFT_BTN, onSelect);
        return;
      }
      const content: Phaser.GameObjects.GameObject[] = [];
      if (tool === 'road') {
        content.push(scene.add.image(0, -8, TEX.icon(tool)).setScale(1.1));
        const row = this.costRow(scene, String(RULES.roadCost), CSS.ink);
        this.roadCost = row[1];
        content.push(...row);
      } else content.push(scene.add.image(0, -2, TEX.icon(tool)).setScale(1.2));
      this.tools.set(tool, new RailButton(scene, x, y, BTN, LEFT_BTN, content, () => onSelect(tool), true));
    });
    // Divider: a gold line between the tools and the turn arrows.
    const { x: lx, y: dy } = leftButton(RAIL_TOOLS.length);
    g.lineStyle(2, C.gold, 1);
    g.lineBetween(lx - BTN / 2 + 8, dy - LEFT_BTN / 2 - (BTN_GAP + DIVIDER) / 2, lx + BTN / 2 - 8, dy - LEFT_BTN / 2 - (BTN_GAP + DIVIDER) / 2);
    (['↺', '↻'] as const).forEach((label, k) => {
      const { x, y } = leftButton(RAIL_TOOLS.length + k);
      new RailButton(scene, x, y, BTN, LEFT_BTN, [text(scene, 0, -2, label, 38, CSS.ink, true).setOrigin(0.5)], () => onTurn(k ? 1 : -1));
    });

    BUILD_TOOLS.forEach((kind, k) => {
      const { x, y } = buildButton(k);
      this.addBuild(scene, kind, x, y, BUILD_W, BTN, onSelect);
    });
  }

  /** A building button: thumbnail, coin and cost (or the goal that unlocks it). */
  private addBuild(scene: Phaser.Scene, kind: BuildTool, x: number, y: number, w: number, h: number, onSelect: (t: Tool) => void) {
    const thumb = thumbnail(scene, kind, w, h);
    const [coin, cost] = this.costRow(scene, '', CSS.ink, h);
    const btn = new RailButton(scene, x, y, w, h, [...thumb, coin, cost], () => onSelect(kind), true);
    this.builds.push({ kind, btn, thumb, coin, cost });
  }

  /** Small coin + number at the bottom of a button of height h. */
  private costRow(scene: Phaser.Scene, value: string, color: string, h = LEFT_BTN): [Phaser.GameObjects.Image, Phaser.GameObjects.Text] {
    const coin = scene.add.image(0, h / 2 - 15, TEX.icon('silver')).setScale(0.4);
    const t = text(scene, 0, h / 2 - 15, value, 16, color, true).setOrigin(0, 0.5);
    this.centerCost(coin, t);
    return [coin, t];
  }

  private centerCost(coin: Phaser.GameObjects.Image, t: Phaser.GameObjects.Text) {
    const w = coin.visible ? 18 + t.width : t.width;
    coin.setX(-w / 2 + 8);
    t.setX(coin.visible ? -w / 2 + 18 : -w / 2);
  }

  refresh(state: GameState, selected: Tool) {
    for (const [tool, btn] of this.tools) btn.setLook(tool === selected ? 'active' : 'normal');
    const roadColor = state.silver < RULES.roadCost ? CSS.bad : CSS.ink;
    if (this.roadCost.style.color !== roadColor) this.roadCost.setColor(roadColor);
    for (const b of this.builds) {
      const locked = !state.unlocked.includes(b.kind);
      const short = !locked && state.silver < costOf(b.kind);
      b.btn.setLook(b.kind === selected ? 'active' : locked || short ? 'disabled' : 'normal');
      b.btn.root.setAlpha(locked ? 0.5 : 1);
      for (const img of b.thumb) {
        if (short) img.setTint(SHORT_TINT);
        else img.clearTint();
        img.setAlpha(short ? 0.75 : 1);
      }
      const label = locked ? T.lockedCost(unlockingGoal(b.kind) ?? 0) : String(costOf(b.kind));
      const color = locked ? CSS.muted : short ? CSS.bad : CSS.ink;
      if (b.cost.text !== label || b.coin.visible === locked) {
        b.cost.setText(label);
        b.coin.setVisible(!locked);
        this.centerCost(b.coin, b.cost);
      }
      if (b.cost.style.color !== color) b.cost.setColor(color);
    }
  }

  contains(x: number, y: number) {
    return inRect(LEFT_RAIL, x, y) || inRect(RIGHT_RAIL, x, y);
  }
}

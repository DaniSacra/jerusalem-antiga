import Phaser from 'phaser';
import { costOf, unlockingGoal, type GameState } from '../core';
import { BTN, BTN_GAP, buildButton, DIVIDER, inRect, LEFT_BTN, LEFT_RAIL, leftButton, RIGHT_RAIL, TOOL_W } from './layout';
import { C, CSS } from './palette';
import { T } from './strings';
import { cropImages, ORIGIN, TEX } from './textures';
import { BUILD_TOOLS, RAIL_TOOLS, toolName, type BuildTool, type Tool } from './tools';
import { RailButton, stonePanel, text } from './ui';

/** Shown on a building button when there is not enough silver. */
const SHORT_TINT = 0x8c8c8c;
/** Height of the name row at the bottom of every rail button. */
const ROW_H = 22;
const NAME_SIZE = 16;
const COST_SIZE = 15;
/** How far a locked building's thumbnail moves left for its "Meta N". */
const GOAL_SHIFT = 26;

/** The name row: the tool name, then (optional) a coin and the cost, centered at the bottom of a button. */
class NameRow {
  readonly name: Phaser.GameObjects.Text;
  readonly coin: Phaser.GameObjects.Image | null;
  readonly cost: Phaser.GameObjects.Text | null;

  constructor(scene: Phaser.Scene, label: string, h: number, withCost: boolean) {
    const y = h / 2 - ROW_H / 2 - 4;
    this.name = text(scene, 0, y, label, NAME_SIZE, CSS.ink, true).setOrigin(0, 0.5);
    this.coin = withCost ? scene.add.image(0, y, TEX.icon('silver')).setScale(0.36) : null;
    this.cost = withCost ? text(scene, 0, y, '', COST_SIZE, CSS.ink, true).setOrigin(0, 0.5) : null;
    this.layout();
  }

  get objects(): Phaser.GameObjects.GameObject[] {
    return [this.name, ...(this.coin ? [this.coin] : []), ...(this.cost ? [this.cost] : [])];
  }

  /** Sets the cost and its color; null hides the coin and the cost (only the name stays). */
  setCost(label: string | null, color: string) {
    if (!this.cost || !this.coin) return;
    if (this.cost.text !== (label ?? '') || this.coin.visible !== (label !== null)) {
      this.cost.setText(label ?? '');
      this.coin.setVisible(label !== null);
      this.layout();
    }
    if (this.cost.style.color !== color) this.cost.setColor(color);
  }

  private layout() {
    const coinW = this.coin?.visible ? 16 : 0;
    const costW = this.cost?.text ? 5 + coinW + this.cost.width : 0;
    let x = -(this.name.width + costW) / 2;
    this.name.setX(x);
    x += this.name.width + 5;
    this.coin?.setX(x + 7);
    this.cost?.setX(x + coinW);
  }
}

interface ToolButton {
  tool: Tool;
  btn: RailButton;
  row: NameRow;
  /** Building thumbnail (greyed when the silver is short). */
  thumb: Phaser.GameObjects.Image[];
  /** "Meta N" on the right of a locked building, the thumbnail moved left to make room. */
  goal: Phaser.GameObjects.Text;
  shifted: boolean;
}

/** Building texture shrunk to fit above the name row of a w x h button (fields get their crops on top). */
function thumbnail(scene: Phaser.Scene, kind: BuildTool, w: number, h: number): Phaser.GameObjects.Image[] {
  const key = TEX.building(kind, kind === 'house' ? 3 : 0);
  const thumbH = h - ROW_H - 10;
  const bottom = -h / 2 + 4 + thumbH;
  const img = scene.add.image(0, bottom, key).setOrigin(0.5, 1);
  const k = Math.min((w - 16) / img.width, thumbH / img.height);
  img.setScale(k);
  if (kind !== 'field') return [img];
  const [, oy] = ORIGIN[key];
  return [img, ...cropImages(scene, 0, bottom - img.height * (1 - oy) * k, k)];
}

/** Icon centered in the space above the name row. */
const ICON_Y = -ROW_H / 2 - 3;

/**
 * The two side rails, every button with its name under the icon: Ver, Rua, Jardim, Limpar and the
 * turn arrows on the left; the 6 buildings (with their cost) on the right.
 */
export class Toolbar {
  private buttons: ToolButton[] = [];

  constructor(scene: Phaser.Scene, onSelect: (t: Tool) => void, onTurn: (dir: 1 | -1) => void) {
    const g = scene.add.graphics();
    stonePanel(g, LEFT_RAIL.x, LEFT_RAIL.y, LEFT_RAIL.w, LEFT_RAIL.h);
    stonePanel(g, RIGHT_RAIL.x, RIGHT_RAIL.y, RIGHT_RAIL.w, RIGHT_RAIL.h);

    RAIL_TOOLS.forEach((tool, k) => {
      const { x, y } = leftButton(k);
      const icon = tool === 'garden' ? thumbnail(scene, tool, TOOL_W, LEFT_BTN) : [scene.add.image(0, ICON_Y, TEX.icon(tool))];
      this.add(scene, tool, x, y, LEFT_BTN, icon, onSelect);
    });
    // Divider: a gold line between the tools and the turn arrows.
    const { x: lx, y: dy } = leftButton(RAIL_TOOLS.length);
    const lineY = dy - LEFT_BTN / 2 - (BTN_GAP + DIVIDER) / 2;
    g.lineStyle(2, C.gold, 1);
    g.lineBetween(lx - TOOL_W / 2 + 8, lineY, lx + TOOL_W / 2 - 8, lineY);
    (['↺', '↻'] as const).forEach((label, k) => {
      const { x, y } = leftButton(RAIL_TOOLS.length + k);
      const arrow = text(scene, 0, ICON_Y, label, 32, CSS.ink, true).setOrigin(0.5);
      const row = new NameRow(scene, T.turn, LEFT_BTN, false);
      new RailButton(scene, x, y, TOOL_W, LEFT_BTN, [arrow, ...row.objects], () => onTurn(k ? 1 : -1));
    });

    BUILD_TOOLS.forEach((kind, k) => {
      const { x, y } = buildButton(k);
      this.add(scene, kind, x, y, BTN, thumbnail(scene, kind, TOOL_W, BTN), onSelect);
    });
  }

  private add(scene: Phaser.Scene, tool: Tool, x: number, y: number, h: number, icon: Phaser.GameObjects.Image[], onSelect: (t: Tool) => void) {
    const row = new NameRow(scene, toolName(tool), h, tool !== 'view' && tool !== 'clear');
    const goal = text(scene, TOOL_W / 2 - 8, ICON_Y, '', 15, CSS.ink, true).setOrigin(1, 0.5).setVisible(false);
    const btn = new RailButton(scene, x, y, TOOL_W, h, [...icon, ...row.objects, goal], () => onSelect(tool), true);
    this.buttons.push({ tool, btn, row, thumb: tool === 'road' ? [] : icon, goal, shifted: false });
  }

  /** `allowed` (tutorial): only these tools are enabled, the others are greyed without "Meta N". */
  refresh(state: GameState, selected: Tool, allowed: ReadonlySet<Tool> | null = null) {
    for (const b of this.buttons) {
      const { tool } = b;
      const blocked = !!allowed && !allowed.has(tool);
      if (tool === 'view' || tool === 'clear') {
        b.btn.setLook(tool === selected ? 'active' : blocked ? 'disabled' : 'normal');
        b.btn.root.setAlpha(blocked ? 0.5 : 1);
        continue;
      }
      const locked = !state.unlocked.includes(tool);
      const cost = costOf(tool);
      const short = !locked && state.silver < cost;
      b.btn.setLook(tool === selected ? 'active' : locked || short || blocked ? 'disabled' : 'normal');
      b.btn.root.setAlpha(locked || blocked ? 0.5 : 1);
      for (const img of b.thumb) {
        if (short) img.setTint(SHORT_TINT);
        else img.clearTint();
        img.setAlpha(short ? 0.75 : 1);
      }
      // Locked: the goal that unlocks it in the corner instead of the cost (not during the tutorial).
      const goal = locked && !allowed;
      b.row.setCost(locked ? null : String(cost), short ? CSS.bad : CSS.ink);
      if (goal) b.goal.setText(T.lockedCost(unlockingGoal(tool) ?? 0));
      b.goal.setVisible(goal);
      if (goal !== b.shifted) {
        for (const img of b.thumb) img.x += goal ? -GOAL_SHIFT : GOAL_SHIFT;
        b.shifted = goal;
      }
    }
  }

  /** Screen center of a tool's button and the side it should be pointed at from. */
  buttonOf(tool: Tool): { x: number; y: number; w: number; side: 'left' | 'right' } | null {
    const b = this.buttons.find((x) => x.tool === tool);
    if (!b) return null;
    return { x: b.btn.root.x, y: b.btn.root.y, w: TOOL_W, side: b.btn.root.x < RIGHT_RAIL.x ? 'left' : 'right' };
  }

  contains(x: number, y: number) {
    return inRect(LEFT_RAIL, x, y) || inRect(RIGHT_RAIL, x, y);
  }
}

import Phaser from 'phaser';
import { costOf, unlockingGoal, type GameState } from '../core';
import { GAME_W, INFO_H, INFO_Y, TOOL_H, TOOL_Y } from './layout';
import { C, CSS } from './palette';
import { T } from './strings';
import { ORIGIN, TEX } from './textures';
import { isPlaceTool, TOOLS, toolName, type Tool } from './tools';
import { text } from './ui';
import type { Segment } from './info';

const BTN_GAP = 6;
const BTN_W = Math.floor((GAME_W - 24 - (TOOLS.length - 1) * BTN_GAP) / TOOLS.length);
const BTN_H = TOOL_H - 10;

interface ToolButton {
  tool: Tool;
  root: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  cost: Phaser.GameObjects.Text;
}

function toolIcon(scene: Phaser.Scene, tool: Tool): Phaser.GameObjects.Image {
  if (tool === 'view' || tool === 'clear' || tool === 'road') return scene.add.image(0, -BTN_H / 2 + 24, TEX.icon(tool)).setScale(0.85);
  const key = TEX.building(tool, tool === 'house' ? 2 : 0);
  const [ox, oy] = ORIGIN[key];
  const scale = tool === 'temple' ? 0.24 : 0.62;
  return scene.add.image(0, -BTN_H / 2 + (tool === 'temple' ? 36 : 38), key).setOrigin(ox, oy).setScale(scale);
}

/** Bottom tool bar plus the info line above it. */
export class Toolbar {
  private buttons: ToolButton[] = [];
  private info: Phaser.GameObjects.Container;

  constructor(private scene: Phaser.Scene, onSelect: (t: Tool) => void) {
    const g = scene.add.graphics();
    g.fillStyle(C.shadow, 0.3);
    g.fillRect(0, INFO_Y - 2, GAME_W, 2);
    g.fillStyle(C.ink, 0.9);
    g.fillRect(0, INFO_Y, GAME_W, INFO_H);
    g.fillStyle(C.parchmentDark);
    g.fillRect(0, TOOL_Y, GAME_W, TOOL_H);
    this.info = scene.add.container(GAME_W / 2, INFO_Y + INFO_H / 2);

    const x0 = (GAME_W - TOOLS.length * BTN_W - (TOOLS.length - 1) * BTN_GAP) / 2;
    TOOLS.forEach((tool, k) => {
      const bg = scene.add.graphics();
      const name = text(scene, 0, 10, toolName(tool), 17, CSS.ink, true).setOrigin(0.5);
      const cost = text(scene, 0, 29, '', 14, CSS.muted, true).setOrigin(0.5);
      const root = scene.add.container(x0 + k * (BTN_W + BTN_GAP) + BTN_W / 2, TOOL_Y + 5 + BTN_H / 2, [bg, toolIcon(scene, tool), name, cost]);
      root.setSize(BTN_W, BTN_H).setInteractive({ useHandCursor: true });
      root.on('pointerdown', () => onSelect(tool));
      this.buttons.push({ tool, root, bg, cost });
    });
  }

  refresh(state: GameState, selected: Tool) {
    for (const b of this.buttons) {
      const kind = isPlaceTool(b.tool) ? b.tool : null;
      const locked = !!kind && !state.unlocked.includes(kind);
      const active = b.tool === selected;
      b.bg.clear();
      b.bg.fillStyle(active ? C.parchment : locked ? 0xd6c49c : 0xefe0bd);
      b.bg.fillRoundedRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, 10);
      b.bg.lineStyle(active ? 4 : 2, active ? C.gold : C.border, 1);
      b.bg.strokeRoundedRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, 10);
      b.root.setAlpha(locked ? 0.45 : 1);

      let cost = '';
      let color: string = CSS.muted;
      if (kind && locked) cost = T.lockedCost(unlockingGoal(kind) ?? 0);
      else if (b.tool === 'clear') cost = T.treeCost;
      else if (kind) {
        cost = `${costOf(kind)} prata`;
        color = state.silver < costOf(kind) ? CSS.bad : CSS.ink;
      }
      b.cost.setText(cost);
      if (b.cost.style.color !== color) b.cost.setColor(color);
    }
  }

  /** Shows colored text segments centered in the info line. */
  setInfo(segments: Segment[]) {
    this.info.removeAll(true);
    let x = 0;
    for (const seg of segments) {
      const t = text(this.scene, x, 0, seg.text, 17, seg.color ?? CSS.light, true).setOrigin(0, 0.5);
      this.info.add(t);
      x += t.width;
    }
    const maxW = GAME_W - 40;
    this.info.setScale(x > maxW ? maxW / x : 1);
    this.info.each((c: Phaser.GameObjects.Text) => c.setX(c.x - x / 2));
  }
}

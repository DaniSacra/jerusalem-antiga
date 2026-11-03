import Phaser from 'phaser';
import { px, type Rect } from '../layout';
import { NOVA } from '../palette';
import { T } from '../strings';
import { keyOf, toolName, type Tool } from '../tools';
import { TextBalloon } from './Balloon';
import { H, PHONE, S } from './metrics';
import type { Notice } from './notices';
import { icon, nameTag, ntext, RoundButton } from './widgets';

export type PanelKind = 'goals' | 'alerts' | 'stats' | 'settings';

/** The three tools at the bottom left. */
const BOTTOM = ['view', 'road', 'clear'] as const;
const BOTTOM_ICON = { view: 'hand', road: 'road', clear: 'hammer' } as const;

/**
 * Left side: Objetivos, Avisos (red selo with the count) and Estatísticas, stacked under the level;
 * bottom left: Mover, Rua and Demolir with their names (PC: "Mover · 1") and a tip balloon.
 */
export class Tools {
  private side: [PanelKind, RoundButton][] = [];
  private badge: Phaser.GameObjects.Container;
  private badgeText: Phaser.GameObjects.Text;
  private tools: { tool: Tool; btn: RoundButton; tag: Rect }[] = [];
  private tip: TextBalloon;
  private tipFor: Tool = 'view';
  private lastTool: Tool = 'view';
  private alertKeys = new Set<string>();
  private pulse: Phaser.Tweens.Tween | null = null;

  constructor(private scene: Phaser.Scene, onPanel: (p: PanelKind) => void, onTool: (t: Tool) => void) {
    const cx = S.margin + S.side / 2;
    let y = S.margin + S.level + S.gap * 2 + S.side / 2;
    for (const [kind, ic] of [['goals', 'flag'], ['alerts', 'alert'], ['stats', 'stats']] as const) {
      const btn = new RoundButton(scene, cx, y, S.side, S.side, [icon(scene, ic, S.side * 0.56)], () => onPanel(kind));
      this.side.push([kind, btn]);
      y += S.side + S.sideGap;
    }
    // Red selo with the number of alerts, top right of the Avisos button.
    const r = px(PHONE ? 10 : 11);
    const bg = scene.add.graphics().fillStyle(NOVA.badge, 1).fillCircle(0, 0, r).lineStyle(px(1.5), NOVA.text, 1).strokeCircle(0, 0, r);
    this.badgeText = ntext(scene, 0, 0, '', S.small).setOrigin(0.5);
    const alerts = this.side[1][1].root;
    this.badge = scene.add.container(alerts.x + S.side * 0.34, alerts.y - S.side * 0.34, [bg, this.badgeText]).setDepth(5).setVisible(false);

    // Bottom tools: each button as wide as its name tag, left to right.
    const by = H - S.margin - S.labelH - px(3) - S.tool / 2;
    let x = S.margin;
    for (const tool of BOTTOM) {
      const name = PHONE ? toolName(tool) : T.nova.withKey(toolName(tool), keyOf(tool));
      const probe = ntext(scene, 0, 0, name, S.small);
      const w = Math.max(S.tool, probe.width + px(12));
      probe.destroy();
      const tx = x + w / 2;
      const btn = new RoundButton(scene, tx, by, S.tool, S.tool, [icon(scene, BOTTOM_ICON[tool], S.tool * 0.56)], () => onTool(tool), {}, true);
      const tag = nameTag(scene, tx, by + S.tool / 2 + px(3) + S.labelH / 2 - px(4), name);
      this.tools.push({ tool, btn, tag: { x: tx - tag.w / 2, y: by + S.tool / 2 - px(1), w: tag.w, h: tag.h } });
      x += w + px(PHONE ? 8 : 12);
    }
    this.tip = new TextBalloon(scene, 45);
  }

  /** Right edge of the bottom tools (the tutorial bubble and toasts stay clear of it). */
  get bottomRight() {
    const last = this.tools[this.tools.length - 1];
    return Math.max(last.btn.root.x + S.tool / 2, last.tag.x + last.tag.w);
  }

  /** Top edge of the bottom tools (panels and balloons stay above it). */
  get top() {
    return H - S.margin - S.labelH - px(3) - S.tool;
  }

  refresh(tool: Tool, allowed: ReadonlySet<Tool> | null, alerts: Notice[], open: PanelKind | null) {
    for (const t of this.tools) {
      const blocked = !!allowed && !allowed.has(t.tool);
      t.btn.setLook({ selected: t.tool === tool });
      t.btn.root.setAlpha(blocked ? 0.45 : 1);
    }
    for (const [kind, btn] of this.side) btn.setLook({ selected: kind === open });
    this.badgeText.setText(String(alerts.length));
    this.badge.setVisible(alerts.length > 0);
    if (tool !== this.lastTool) {
      this.lastTool = tool;
      this.tipFor = tool;
      this.showTip();
    }
  }

  /** New warnings this time (one toast per episode): the Avisos button pulses. Returns them. */
  newAlerts(alerts: Notice[]): Notice[] {
    const fresh = alerts.filter((a) => !this.alertKeys.has(a.key));
    this.alertKeys = new Set(alerts.map((a) => a.key));
    if (fresh.length && !this.pulse) {
      const root = this.side[1][1].root;
      this.pulse = this.scene.tweens.add({ targets: root, scale: 1.18, duration: 260, yoyo: true, repeat: 3, onComplete: () => {
        root.setScale(1);
        this.pulse = null;
      } });
    }
    return fresh;
  }

  /** Tip of Rua and Demolir, above the button. */
  private showTip() {
    const t = this.tools.find((x) => x.tool === this.tipFor);
    if (!t || this.tipFor === 'view') {
      this.tip.hide();
      return;
    }
    const text = this.tipFor === 'road' ? T.nova.tip.road : T.nova.tip.clear;
    const bx = t.btn.root.x;
    const top = t.btn.root.y - S.tool / 2 - S.gap;
    this.tip.show([{ text, bold: false }], (_w, h) => {
      const x = Math.max(S.margin, bx - px(30));
      return { x, y: top - px(9) - h, arrow: { side: 'down', at: bx - x } };
    });
  }

  closeTip(): boolean {
    const open = this.tip.visible;
    this.tip.hide();
    return open;
  }

  buttonOf(tool: Tool) {
    const t = this.tools.find((x) => x.tool === tool);
    return t ? { x: t.btn.root.x, y: t.btn.root.y, w: S.tool, side: 'bottom' as const } : null;
  }

  /** Center of a side button (panels open beside it). */
  sideButton(kind: PanelKind) {
    const b = this.side.find(([k]) => k === kind)?.[1];
    return b ? { x: b.root.x, y: b.root.y } : null;
  }

  get sideRight() {
    return S.margin + S.side;
  }

  get sideTop() {
    return this.side[0][1].root.y - S.side / 2;
  }

  contains(x: number, y: number) {
    const inR = (r: Rect | null) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    return this.side.some(([, b]) => b.contains(x, y)) || this.tools.some((t) => t.btn.contains(x, y) || inR(t.tag)) || inR(this.tip.rect);
  }
}

import Phaser from 'phaser';
import { balloonNeed, BUILDINGS, cellOf, checkBuild, checkClear, indexOf, isService, isValley, type BuildingKind, type GameState, type ServiceKind } from '../core';
import { CELL, COLS, DEPTH, MAP_H, MAP_W, MAP_X, MAP_Y, ROWS, cellBottom, cellCenterX, cellHash, cellLeft, cellTop, worldDepth } from './layout';
import { C } from './palette';
import { ANCHORS, GRASS_VARIANTS, TEX } from './textures';
import { isBuildTool, type Tool } from './tools';

interface BuildingView {
  kind: BuildingKind;
  root: Phaser.GameObjects.Container;
  main: Phaser.GameObjects.Image;
  wheat: Phaser.GameObjects.Image[];
  flame?: Phaser.GameObjects.Image;
  glow?: Phaser.GameObjects.Image;
  smoke?: Phaser.GameObjects.Particles.ParticleEmitter;
}

interface Balloon {
  need: ServiceKind;
  root: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Image;
}

const STREAM_STEP = 6;

/** Stream centerline: last column, bulging into the second-to-last column in the middle rows. */
function streamX(py: number): number {
  const baseX = cellLeft(COLS - 1) + CELL * 0.55;
  const yc = MAP_Y + 5.5 * CELL;
  return baseX - CELL * 0.75 * Math.exp(-(((py - yc) / (1.7 * CELL)) ** 2)) + Math.sin(py * 0.045) * 4;
}

export class MapView {
  private terrainObjs = new Map<number, { type: string; img: Phaser.GameObjects.Image }>();
  private views = new Map<number, BuildingView>();
  private balloons = new Map<number, Balloon>();
  private stream: Phaser.GameObjects.Graphics;
  private overlay: Phaser.GameObjects.Graphics;
  private preview: Phaser.GameObjects.Image;
  private famineTint: Phaser.GameObjects.Rectangle;
  private famine = false;

  constructor(private scene: Phaser.Scene, state: GameState) {
    this.drawGround(state);
    this.stream = scene.add.graphics().setDepth(DEPTH.groundFx + 1);
    this.overlay = scene.add.graphics().setDepth(DEPTH.overlay);
    this.preview = scene.add.image(0, 0, TEX.house(0)).setOrigin(0.5, 1).setDepth(DEPTH.overlay + 1).setVisible(false);
    this.famineTint = scene.add
      .rectangle(MAP_X, MAP_Y, MAP_W, MAP_H, C.famine, 1)
      .setOrigin(0)
      .setAlpha(0)
      .setDepth(DEPTH.overlay - 1);
    this.sync(state);
  }

  private drawGround(state: GameState) {
    const s = this.scene;
    const frame = s.add.graphics().setDepth(DEPTH.ground);
    for (let k = 3; k >= 1; k--) {
      frame.fillStyle(C.shadow, 0.08 * k);
      frame.fillRoundedRect(MAP_X - k * 3, MAP_Y - k * 2, MAP_W + k * 6, MAP_H + k * 5, 6 + k * 2);
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const h = cellHash(x, y);
        const key = state.terrain[indexOf(state, x, y)] === 'valley' ? TEX.valley(h % 2) : TEX.grass(h % GRASS_VARIANTS);
        s.add.image(cellLeft(x), cellTop(y), key).setOrigin(0).setDepth(DEPTH.ground);
      }
    }
    // Soft shading along the valley edge.
    const edge = s.add.graphics().setDepth(DEPTH.groundFx);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!isValley(x, y)) continue;
        for (let k = 0; k < 4; k++) {
          edge.fillStyle(C.shadow, 0.1 - k * 0.022);
          if (!isValley(x - 1, y)) edge.fillRect(cellLeft(x) + k * 3, cellTop(y), 3, CELL);
          if (y > 0 && !isValley(x, y - 1)) edge.fillRect(cellLeft(x), cellTop(y) + k * 3, CELL, 3);
          if (y < ROWS - 1 && !isValley(x, y + 1)) edge.fillRect(cellLeft(x), cellBottom(y) - (k + 1) * 3, CELL, 3);
        }
      }
    }
    // Sandy banks under the stream.
    const banks: Phaser.Types.Math.Vector2Like[] = [];
    for (let py = MAP_Y; py <= MAP_Y + MAP_H; py += STREAM_STEP) banks.push({ x: streamX(py) - 13, y: py });
    for (let py = MAP_Y + MAP_H; py >= MAP_Y; py -= STREAM_STEP) banks.push({ x: streamX(py) + 13, y: py });
    edge.fillStyle(C.sand, 0.8);
    edge.fillPoints(banks, true);
  }

  // ---------- sync with the simulation ----------

  sync(state: GameState) {
    for (let i = 0; i < state.terrain.length; i++) {
      this.syncTerrain(state, i);
      this.syncBuilding(state, i);
      this.syncBalloon(state, i);
    }
    this.setFamine(state.famine);
  }

  private syncTerrain(state: GameState, i: number) {
    const t = state.terrain[i];
    const want = t === 'rock' || t === 'tree' ? t : null;
    const cur = this.terrainObjs.get(i);
    if (cur?.type === want) return;
    cur?.img.destroy();
    this.terrainObjs.delete(i);
    if (!want) return;
    const { x, y } = cellOf(state, i);
    const v = cellHash(x, y) % 2;
    const img = this.scene.add
      .image(cellCenterX(x), cellBottom(y), want === 'rock' ? TEX.rock(v) : TEX.tree(v))
      .setOrigin(0.5, 1)
      .setDepth(worldDepth(cellBottom(y)));
    this.terrainObjs.set(i, { type: want, img });
  }

  private syncBuilding(state: GameState, i: number) {
    const b = state.buildings[i];
    let v = this.views.get(i);
    if (v && v.kind !== b?.kind) {
      this.destroyView(v);
      this.views.delete(i);
      v = undefined;
    }
    if (!b) return;
    if (!v) {
      v = this.createView(state, i, b.kind);
      this.views.set(i, v);
    }
    const key = TEX.building(b.kind, b.level);
    if (v.main.texture.key !== key) v.main.setTexture(key);
  }

  private createView(state: GameState, i: number, kind: BuildingKind): BuildingView {
    const s = this.scene;
    const { x, y } = cellOf(state, i);
    const px = cellCenterX(x);
    const py = cellBottom(y);
    const root = s.add.container(px, py).setDepth(worldDepth(py));
    const main = s.add.image(0, 0, TEX.building(kind)).setOrigin(0.5, 1);
    root.add(main);
    const view: BuildingView = { kind, root, main, wheat: [] };
    if (kind === 'field') {
      view.wheat = ANCHORS.wheat.map((a) => s.add.image(a.x, a.y, TEX.wheat).setOrigin(0.5, 1));
      root.add(view.wheat);
    }
    if (kind === 'altar') {
      const { x: fx, y: fy } = ANCHORS.altarFire;
      view.glow = s.add.image(fx, fy - 4, TEX.soft).setTint(0xf6a03c).setAlpha(0.5).setScale(1.2);
      view.flame = s.add.image(fx, fy, TEX.flame).setOrigin(0.5, 1);
      root.add([view.glow, view.flame]);
    }
    if (kind === 'workshop') {
      view.smoke = s.add
        .particles(px + ANCHORS.chimney.x, py + ANCHORS.chimney.y, TEX.soft, {
          lifespan: 2000,
          speedY: { min: -24, max: -14 },
          speedX: { min: -3, max: 9 },
          scale: { start: 0.3, end: 0.9 },
          alpha: { start: 0.6, end: 0 },
          tint: 0xe4e0d8,
          frequency: 420,
        })
        .setDepth(DEPTH.fx);
    }
    return view;
  }

  private destroyView(v: BuildingView) {
    this.scene.tweens.killTweensOf(v.root);
    v.smoke?.destroy();
    v.root.destroy();
  }

  private syncBalloon(state: GameState, i: number) {
    const need = balloonNeed(state, i);
    const cur = this.balloons.get(i);
    if (cur && (!need || !this.views.has(i))) {
      cur.root.destroy();
      this.balloons.delete(i);
      return;
    }
    if (!need) return;
    if (cur) {
      if (cur.need !== need) {
        cur.icon.setTexture(TEX.need(need));
        cur.need = need;
      }
      return;
    }
    const { x, y } = cellOf(state, i);
    const s = this.scene;
    const bg = s.add.image(0, 0, TEX.balloon).setOrigin(0.5, 1);
    const icon = s.add.image(0, -15, TEX.need(need)).setScale(0.8);
    const root = s.add.container(cellCenterX(x) + 10, cellBottom(y) + ANCHORS.balloonY, [bg, icon]).setDepth(DEPTH.fx + 1);
    root.setData('baseY', root.y).setData('phase', cellHash(x, y) % 100);
    this.balloons.set(i, { need, root, icon });
  }

  setFamine(on: boolean) {
    if (on === this.famine) return;
    this.famine = on;
    this.scene.tweens.add({ targets: this.famineTint, alpha: on ? 0.2 : 0, duration: 600 });
  }

  // ---------- feedback ----------

  bounce(x: number, y: number) {
    const v = this.views.get(y * COLS + x);
    if (!v) return;
    const tweens = this.scene.tweens;
    tweens.killTweensOf(v.root);
    v.root.setY(cellBottom(y)).setScale(1);
    tweens.add({ targets: v.root, y: cellBottom(y) - 10, scaleX: 0.92, scaleY: 1.08, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
  }

  // ---------- tool overlay ----------

  showOverlay(state: GameState, tool: Tool, hover: { x: number; y: number } | null, selected: { x: number; y: number } | null) {
    const g = this.overlay;
    g.clear();
    this.preview.setVisible(false);

    if (tool === 'view') {
      if (selected) {
        g.lineStyle(3, 0xfff3b0, 0.95);
        g.strokeRoundedRect(cellLeft(selected.x) + 1, cellTop(selected.y) + 1, CELL - 2, CELL - 2, 4);
      }
      return;
    }

    g.lineStyle(1, C.ink, 0.16);
    for (let x = 0; x <= COLS; x++) g.lineBetween(cellLeft(x), MAP_Y, cellLeft(x), MAP_Y + MAP_H);
    for (let y = 0; y <= ROWS; y++) g.lineBetween(MAP_X, cellTop(y), MAP_X + MAP_W, cellTop(y));

    if (isService(tool)) {
      const radius = BUILDINGS[tool].radius ?? 0;
      const color = C.need[tool];
      g.fillStyle(color, 0.16);
      state.coverage[tool].forEach((on, i) => {
        if (!on) return;
        const { x, y } = cellOf(state, i);
        g.fillRect(cellLeft(x), cellTop(y), CELL, CELL);
      });
      if (hover) {
        const x0 = Math.max(0, hover.x - radius);
        const y0 = Math.max(0, hover.y - radius);
        const x1 = Math.min(COLS - 1, hover.x + radius);
        const y1 = Math.min(ROWS - 1, hover.y + radius);
        const w = (x1 - x0 + 1) * CELL;
        const h = (y1 - y0 + 1) * CELL;
        g.fillStyle(color, 0.12);
        g.fillRect(cellLeft(x0), cellTop(y0), w, h);
        g.lineStyle(3, color, 0.9);
        g.strokeRect(cellLeft(x0), cellTop(y0), w, h);
      }
    }

    if (!hover) return;
    const ok = (isBuildTool(tool) ? checkBuild(state, tool, hover.x, hover.y) : checkClear(state, hover.x, hover.y)).ok;
    g.fillStyle(ok ? 0xfff3b0 : C.famine, 0.25);
    g.fillRect(cellLeft(hover.x), cellTop(hover.y), CELL, CELL);
    g.lineStyle(2, ok ? 0xfff3b0 : C.famine, 0.9);
    g.strokeRect(cellLeft(hover.x), cellTop(hover.y), CELL, CELL);
    if (isBuildTool(tool)) {
      this.preview
        .setTexture(TEX.building(tool))
        .setPosition(cellCenterX(hover.x), cellBottom(hover.y))
        .setAlpha(0.65)
        .setVisible(true);
      if (ok) this.preview.clearTint();
      else this.preview.setTint(0xff6a5a);
    }
  }

  // ---------- per-frame animation ----------

  update(time: number) {
    const t = time / 1000;
    this.drawStream(t);
    for (const v of this.views.values()) {
      v.wheat.forEach((w, k) => w.setAngle(Math.sin(t * 2.2 + k * 0.7 + v.root.x * 0.05) * 7));
      if (v.flame) {
        const f = Math.sin(t * 14) * 0.08 + Math.sin(t * 23) * 0.05;
        v.flame.setScale(1 - f * 0.6, 1 + f);
        v.glow?.setAlpha(0.45 + f);
      }
    }
    for (const b of this.balloons.values()) {
      b.root.y = b.root.getData('baseY') + Math.sin(t * 3 + b.root.getData('phase')) * 2;
    }
  }

  private drawStream(t: number) {
    const g = this.stream;
    g.clear();
    const left: Phaser.Types.Math.Vector2Like[] = [];
    const right: Phaser.Types.Math.Vector2Like[] = [];
    for (let py = MAP_Y; py <= MAP_Y + MAP_H; py += STREAM_STEP) {
      const cx = streamX(py);
      const w = 7 + Math.sin(py * 0.15 + t * 2) * 1;
      left.push({ x: cx - w, y: py });
      right.push({ x: cx + w, y: py });
    }
    g.fillStyle(C.water);
    g.fillPoints([...left, ...right.reverse()], true);
    g.lineStyle(2, C.waterLight, 0.85);
    for (let k = 0; k < 14; k++) {
      const py = MAP_Y + ((k * 41 + t * 26) % MAP_H);
      const cx = streamX(py) + Math.sin(k * 1.7) * 2.5;
      g.lineBetween(cx - 2.5, py, cx + 2.5, py + 5);
    }
  }
}

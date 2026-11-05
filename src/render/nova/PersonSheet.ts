import Phaser from 'phaser';
import { personById, type GameState } from '../../core';
import { px, setNovaSpot, type Rect } from '../layout';
import { NOVA, NOVA_CSS } from '../palette';
import { T } from '../strings';
import type { PanelArea } from './Panels';
import { lineH, PHONE, S } from './metrics';
import { bandOf, personFigure } from './people';
import { sheetOf as viewOf, type Kin } from '../../game/model/person';
import { darkPanel, ntext, RoundButton } from './widgets';

export interface SheetHost {
  /** Moves the camera to a house and opens its balloon (the sheet closes). */
  showHouse(houseId: number): void;
}

/**
 * Ficha da pessoa: a panel like the statistics, opened from the house balloon (and from the
 * relatives on another sheet). Name and parent, family, figure, age and band, work, house (a tap
 * goes there), parents, spouse and children as 44 px buttons; Voltar goes to the sheets seen before.
 */
export class PersonSheet {
  private root: Phaser.GameObjects.Container | null = null;
  private rect: Rect | null = null;
  /** Sheets opened before the current one (Voltar). */
  private trail: number[] = [];
  private current: number | null = null;
  private key = '';
  private state: GameState | null = null;

  constructor(private scene: Phaser.Scene, private area: () => PanelArea, private host: SheetHost) {}

  get open() {
    return this.current !== null;
  }

  /** Opens a person's sheet (`fresh`: from the map, forgetting the sheets seen before). */
  show(id: number, fresh = false) {
    if (fresh) this.trail = [];
    else if (this.current !== null && this.current !== id) this.trail.push(this.current);
    this.current = id;
    this.key = '';
    this.build();
  }

  close(): boolean {
    const was = this.current !== null;
    this.current = null;
    this.trail = [];
    this.root?.destroy();
    this.root = null;
    this.rect = null;
    this.key = '';
    return was;
  }

  private back() {
    this.current = this.trail.pop() ?? null;
    if (this.current === null) this.close();
    else {
      this.key = '';
      this.build();
    }
  }

  /** After a week or an action: redrawn only when what it shows changed (an age, a death, a move). */
  refresh(s: GameState) {
    this.state = s;
    if (this.current !== null) this.build();
  }

  contains(x: number, y: number) {
    const r = this.rect;
    return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  private build() {
    const s = this.state;
    const p = s && personById(s, this.current);
    if (!s || !p) {
      if (this.current !== null && s) this.close();
      return;
    }
    const v = viewOf(s, p);
    const key = JSON.stringify([v, this.trail.length]);
    if (key === this.key) return;
    this.key = key;
    this.root?.destroy();
    const sc = this.scene;
    const a = this.area();
    const root = sc.add.container(0, 0).setDepth(50);
    this.root = root;
    const N = T.nova.people;
    const pad = px(14);
    const gap = px(6);
    const later = (f: () => void) => () => sc.time.delayedCall(0, f);

    // Header: figure, "Natã, filho de Baruque", "da família de Parós"; Voltar and Fechar at the right.
    const fig = PHONE ? px(40) : px(48);
    root.add(personFigure(sc, v.band, v.sex, fig, v.dim).setPosition(pad + fig / 2, pad + S.btn / 2));
    const tx = pad + fig + px(10);
    const title = ntext(sc, tx, pad + S.btn / 2 - px(1), v.title, PHONE ? S.num * 1.12 : S.num, v.dim ? NOVA_CSS.muted : NOVA_CSS.gold).setOrigin(0, 1);
    const clan = ntext(sc, tx, pad + S.btn / 2 + px(2), v.clan, S.text, NOVA_CSS.muted, false);
    root.add([title, clan]);
    const headW = tx - pad + Math.max(title.width, clan.width);

    // Body, left: age and band, work, house, origin.
    const leftW = px(PHONE ? 210 : 250);
    let ly = pad + S.btn + gap + px(4);
    const line = (text: string, color: string = NOVA_CSS.text, bold = true, wrap = false) => {
      const t = ntext(sc, pad, ly, text, S.text, color, bold);
      if (wrap) t.setWordWrapWidth(leftW).setLineSpacing(lineH(S.text) - S.text * 1.15);
      root.add(t);
      ly += t.height + px(4);
      return t;
    };
    line(v.age, v.dim ? NOVA_CSS.muted : NOVA_CSS.text);
    if (v.job) line(v.job, v.job === N.noJob ? NOVA_CSS.warn : NOVA_CSS.text, false);
    let leftUsed = 0;
    if (v.house) {
      const hl = ntext(sc, pad, ly + S.btn / 2, N.house, S.text, NOVA_CSS.muted, false).setOrigin(0, 0.5);
      root.add(hl);
      const id = v.house.id;
      const b = this.capsule(pad + hl.width + gap, ly, v.house.name, null, false, later(() => this.host.showHouse(id)));
      root.add(b.btn.root);
      setNovaSpot('sheet-house', () => this.spotOf(b.btn, b.w));
      leftUsed = hl.width + gap + b.w;
      ly += S.btn + gap;
    } else setNovaSpot('sheet-house', () => null);
    const origin = line(v.origin, NOVA_CSS.muted, false, true);
    leftUsed = Math.max(leftUsed, origin.width, ...root.list.filter((o): o is Phaser.GameObjects.Text => o instanceof Phaser.GameObjects.Text && o.y > pad + S.btn).map((t) => t.width));

    // Body, right: parents, spouse, children (wrapping rows of 44 px buttons).
    const rx = pad + Math.min(leftW, leftUsed) + px(22);
    const rightW = Math.max(px(180), a.maxW - rx - pad);
    let ry = pad + S.btn + gap;
    let right = rx;
    const labels = v.rows.map((r) => ntext(sc, 0, 0, r.label, S.text, NOVA_CSS.muted, false));
    const labelW = Math.max(0, ...labels.map((t) => t.width)) + gap;
    let kinK = 0;
    v.rows.forEach((r, k) => {
      const t = labels[k].setPosition(rx, ry + S.btn / 2).setOrigin(0, 0.5);
      root.add(t);
      let x = rx + labelW;
      for (const kin of r.kin) {
        const probe = this.capsuleW(kin.label);
        if (x > rx + labelW && x + probe > rx + rightW) {
          x = rx + labelW;
          ry += S.btn + gap;
        }
        const id = kin.id;
        const b = this.capsule(x, ry, kin.label, kin, kin.dim, later(() => this.show(id)));
        root.add(b.btn.root);
        const n = kinK++;
        setNovaSpot(`sheet-kin-${n}`, () => this.spotOf(b.btn, b.w));
        x += b.w + gap;
        right = Math.max(right, x - gap);
      }
      ry += S.btn + gap;
    });
    for (let n = kinK; n < kinK + 8; n++) setNovaSpot(`sheet-kin-${n}`, () => null);

    // Voltar (when there are sheets behind) and Fechar, top right.
    // The buttons share the header row with the title; the relatives below may use the whole width.
    const btnsW = (this.trail.length ? this.capsuleW(`‹ ${N.back}`, false) + gap : 0) + S.btn;
    const w = Math.max(headW + px(16) + btnsW, right - pad, leftUsed, px(PHONE ? 300 : 360)) + 2 * pad;
    const close = new RoundButton(sc, w - pad - S.btn / 2, pad + S.btn / 2, S.btn, S.btn, [ntext(sc, 0, 0, '✕', S.num, NOVA_CSS.ink).setOrigin(0.5)], later(() => this.close()));
    root.add(close.root);
    setNovaSpot('sheet-close', () => this.spotOf(close, S.btn));
    if (this.trail.length) {
      const bw = this.capsuleW(`‹ ${N.back}`, false);
      const back = new RoundButton(sc, w - pad - S.btn - gap - bw / 2, pad + S.btn / 2, bw, S.btn, [ntext(sc, 0, 0, `‹ ${N.back}`, S.text, NOVA_CSS.ink).setOrigin(0.5)], later(() => this.back()));
      root.add(back.root);
      setNovaSpot('sheet-back', () => this.spotOf(back, bw));
    } else setNovaSpot('sheet-back', () => null);

    const h = Math.max(ly, ry) - gap + pad;
    const bg = sc.add.graphics();
    darkPanel(bg, 0, 0, w, h, px(16), NOVA.balloonAlpha);
    // Taps on the panel stay on it (never reach the map under it).
    const block = sc.add.zone(0, 0, w, h).setOrigin(0).setInteractive();
    root.addAt(block, 0);
    root.addAt(bg, 1);
    root.setPosition(a.x, a.y);
    this.rect = { x: a.x, y: a.y, w, h };
  }

  /** Width of a capsule with this label (and a figure when it is a person). */
  private capsuleW(label: string, person = true) {
    const t = ntext(this.scene, 0, 0, label, S.text);
    const w = t.width + px(28) + (person ? S.btn - px(10) : 0);
    t.destroy();
    return Math.max(S.btn, w);
  }

  /** A parchment capsule of 44 px from its top-left corner: a small figure (people) and the label. */
  private capsule(x: number, y: number, label: string, kin: Kin | null, dim: boolean, press: () => void) {
    const sc = this.scene;
    const w = this.capsuleW(label, !!kin);
    const content: Phaser.GameObjects.GameObject[] = [];
    let tx = -w / 2 + px(14);
    if (kin) {
      const p = this.state && personById(this.state, kin.id);
      if (p) {
        const d = S.btn - px(10);
        content.push(personFigure(sc, bandOf(this.state!, p), p.sex, d, dim).setPosition(-w / 2 + px(5) + d / 2, 0));
        tx += d;
      }
    }
    content.push(ntext(sc, tx, 0, label, S.text, dim ? '#6b5e4c' : NOVA_CSS.ink).setOrigin(0, 0.5));
    const btn = new RoundButton(sc, x + w / 2, y + S.btn / 2, w, S.btn, content, press, { dim });
    return { btn, w };
  }

  private spotOf(b: RoundButton, d: number) {
    if (!b.root.active) return null;
    const m = b.root.getWorldTransformMatrix();
    return { x: m.tx, y: m.ty, d };
  }
}

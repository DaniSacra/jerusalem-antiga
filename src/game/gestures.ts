import type { Cell } from '../core';
import { T } from './strings';
import { DRAG_TOOLS, isPlaceTool } from './tools';
import { orthoSteps, sameCell } from './placement';
import { newDrag, type DragMemo, type Session } from './session';

/** A press moves this far (screen px) before it is a drag, not a tap. */
export const TAP_SLOP = 10;
/** A touch drag only starts building after this long with one finger, so a pinch never builds. */
export const TOUCH_BUILD_DELAY = 150;
/** On touch, single buildings are aimed this far above the finger so the preview is not hidden by it. */
export const TOUCH_LIFT = 90;
/** Zoom per wheel pixel (exponential: a 100 px notch is ~14%). */
export const WHEEL_ZOOM = 0.0015;
/** How far two fingers twist (radians, ~12°) before the map turns with them. */
export const TURN_SLOP = 0.21;

/**
 * The yaw a turn button or key goes to from `from`: the next of the four standard views (−45° plus
 * quarter turns) in direction `dir`, so a free twist before is undone by the first press.
 */
export function snapTurn(from: number, dir: 1 | -1): number {
  const q = Math.PI / 2;
  const k = (from + Math.PI / 4) / q;
  const eps = 1e-6;
  return (dir > 0 ? Math.floor(k + eps) + 1 : Math.ceil(k - eps) - 1) * q - Math.PI / 4;
}

/** One pointer event, the same for every view (screen px, ms). */
export interface PointerIn {
  id: number;
  sx: number;
  sy: number;
  touch: boolean;
  /** 0 left (or a finger), 1 middle, 2 right. */
  button: number;
  t: number;
}

/** What the gestures need from the view: where things are on screen, and its camera. */
export interface GestureView {
  /** The map cell under a screen point (null off the map). */
  cellAt(sx: number, sy: number): Cell | null;
  /** The point is over the interface (the map ignores it). */
  overUi(sx: number, sy: number): boolean;
  readonly modalOpen: boolean;
  /** Camera: move by screen px, zoom about a screen point (`zoom` is the view's own scale), turn by radians. */
  panBy(dx: number, dy: number): void;
  readonly zoom: number;
  zoomAt(sx: number, sy: number, zoom: number): void;
  turnBy?(radians: number): void;
  /** The player moved the camera: any glide (tutorial, temple) stops. */
  stopGlide(): void;
  /** The cursor may change (open hand, closed hand). */
  cursorChanged(): void;
  /** The hovered cell changed (the interface shows it). */
  hoverChanged(cell: Cell | null): void;
  /** A tap with Mover on a resident walking the streets: their sheet opens (true), else the map selects. */
  tapPerson?(sx: number, sy: number, touch: boolean): boolean;
}

interface Press extends DragMemo {
  id: number;
  start: Cell | null;
  last: Cell | null;
  downX: number;
  downY: number;
  downAt: number;
  touch: boolean;
  lastX: number;
  lastY: number;
  moved: boolean;
  applied: boolean;
  cancelled: boolean;
  /** The drag went over the interface after building: it stopped there (a toast says so). */
  cutByUi: boolean;
}

interface Pinch {
  dist: number;
  angle: number;
  /** The twist so far, before the map starts turning (`TURN_SLOP`); null once it turns. */
  twist: number | null;
  zoom: number;
  midX: number;
  midY: number;
}

/**
 * Touch, mouse and pen on the map, for every view: taps open balloons, drags build roads, houses,
 * fields and Demolir, single buildings drop on release, one finger or the left button moves the
 * map with Mover, two fingers pinch (and turn), the right or middle button always moves the map.
 */
export class Gestures {
  press: Press | null = null;
  private touches = new Map<number, { x: number; y: number }>();
  private pinch: Pinch | null = null;
  private rightPan: { id: number; x: number; y: number } | null = null;
  /** The mouse is over the interface (no open hand there). */
  pointerOverUi = false;
  /** The last press came from a finger (the tutorial arrow aims above it). */
  lastTouch = false;

  constructor(private session: Session, private view: GestureView) {}

  private get tool() {
    return this.session.tool;
  }

  /** Dragging the map now (the closed hand). */
  get panning(): boolean {
    return !!this.rightPan || (this.tool === 'view' && !!this.press && this.press.moved && !this.press.touch);
  }

  /** The mouse cursor: open hand over the map with Mover, closed while dragging it. */
  get cursor(): 'open' | 'grab' | null {
    return this.panning ? 'grab' : this.tool === 'view' && !this.pointerOverUi ? 'open' : null;
  }

  /** Cell a pointer aims at: lifted above the finger for single buildings on touch; none if the
   * finger or the aimed point is under the interface (the preview is never hidden by it). */
  aimAt(p: PointerIn): Cell | null {
    const lift = p.touch && isPlaceTool(this.tool) && !DRAG_TOOLS.has(this.tool) ? TOUCH_LIFT : 0;
    if (this.view.overUi(p.sx, p.sy) || (lift && this.view.overUi(p.sx, p.sy - lift))) return null;
    return this.view.cellAt(p.sx, p.sy - lift);
  }

  private hover(cell: Cell | null) {
    if (this.session.setHover(cell)) this.view.hoverChanged(cell);
  }

  down(p: PointerIn) {
    if (this.view.modalOpen || this.view.overUi(p.sx, p.sy)) return;
    this.lastTouch = p.touch;
    if (p.button === 1 || p.button === 2) {
      this.rightPan = { id: p.id, x: p.sx, y: p.sy };
      this.view.cursorChanged();
      return;
    }
    this.touches.set(p.id, { x: p.sx, y: p.sy });
    if (this.touches.size >= 2) {
      if (this.press) this.press.cancelled = true;
      const [a, b] = [...this.touches.values()];
      this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), angle: Math.atan2(b.y - a.y, b.x - a.x), twist: 0, zoom: this.view.zoom, midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2 };
      return;
    }
    const cell = this.aimAt(p);
    this.press = { ...newDrag(), id: p.id, start: cell, last: cell, downX: p.sx, downY: p.sy, downAt: p.t, touch: p.touch, lastX: p.sx, lastY: p.sy, moved: false, applied: false, cancelled: false, cutByUi: false };
    if (this.tool !== 'view') this.hover(cell);
  }

  /** `isDown`: a button or finger is pressed (a mouse moving freely hovers). */
  move(p: PointerIn, isDown: boolean) {
    const v = this.view;
    if (this.rightPan?.id === p.id) {
      v.stopGlide();
      v.panBy(p.sx - this.rightPan.x, p.sy - this.rightPan.y);
      this.rightPan.x = p.sx;
      this.rightPan.y = p.sy;
      return;
    }
    if (this.touches.has(p.id)) this.touches.set(p.id, { x: p.sx, y: p.sy });

    const pinch = this.pinch;
    if (pinch && this.touches.size >= 2) {
      const [a, b] = [...this.touches.values()];
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      v.stopGlide();
      v.panBy(midX - pinch.midX, midY - pinch.midY);
      v.zoomAt(midX, midY, (pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, pinch.dist));
      if (v.turnBy) {
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        let d = angle - pinch.angle;
        if (d > Math.PI) d -= 2 * Math.PI;
        if (d < -Math.PI) d += 2 * Math.PI;
        pinch.angle = angle;
        // A pinch to zoom twists a little: the map only turns past the slop, then follows freely.
        if (pinch.twist !== null) {
          pinch.twist += d;
          if (Math.abs(pinch.twist) < TURN_SLOP) d = 0;
          else [d, pinch.twist] = [pinch.twist, null];
        }
        if (d) v.turnBy(d);
      }
      pinch.midX = midX;
      pinch.midY = midY;
      return;
    }

    const g = this.press;
    if (!g || g.id !== p.id || !isDown) {
      if (!isDown && !p.touch) {
        this.pointerOverUi = v.overUi(p.sx, p.sy);
        this.hover(this.pointerOverUi ? null : v.cellAt(p.sx, p.sy));
        v.cursorChanged();
      }
      return;
    }
    if (g.cancelled) return;
    if (Math.hypot(p.sx - g.downX, p.sy - g.downY) > TAP_SLOP) g.moved = true;

    if (this.tool === 'view') {
      if (g.moved) {
        v.cursorChanged();
        v.stopGlide();
        v.panBy(p.sx - g.lastX, p.sy - g.lastY);
      }
    } else {
      const cell = this.aimAt(p);
      this.hover(cell);
      if (!cell && g.applied && v.overUi(p.sx, p.sy)) g.cutByUi = true;
      // Never build under the UI, and give a second finger time to land before a touch drag builds.
      const ready = g.moved && (!g.touch || p.t - g.downAt >= TOUCH_BUILD_DELAY);
      if (DRAG_TOOLS.has(this.tool) && ready && cell && !sameCell(cell, g.last)) {
        const s = this.session;
        s.batch(() => {
          if (!g.applied && g.start) s.apply(g.start, true, g.touch, g);
          for (const c of g.last ? orthoSteps(g.last, cell) : [cell]) s.apply(c, false, g.touch, g);
        });
        g.last = cell;
        g.applied = true;
      }
    }
    g.lastX = p.sx;
    g.lastY = p.sy;
  }

  up(p: PointerIn) {
    if (this.rightPan?.id === p.id) {
      this.rightPan = null;
      this.view.cursorChanged();
      return;
    }
    this.touches.delete(p.id);
    if (this.touches.size < 2) this.pinch = null;
    const g = this.press;
    if (!g || g.id !== p.id) return;
    this.press = null;
    if (g.moved && this.tool === 'view') this.view.cursorChanged();
    const s = this.session;
    if (!g.cancelled) {
      if (this.tool === 'view') {
        if (!g.moved && !this.view.tapPerson?.(p.sx, p.sy, g.touch) && g.start) s.select(g.start);
      } else if (!g.applied) {
        // Single-placement tools drop where the finger is released, so the preview can be adjusted.
        // Releasing a single building over the UI cancels it.
        const cell = DRAG_TOOLS.has(this.tool) ? g.start : this.aimAt(p);
        if (cell) s.apply(cell, true, g.touch);
      }
      s.warnLooseRoads(g.roads);
      if (g.cutByUi && this.tool === 'road') s.say(T.roadUnderUi, 'bad');
    }
    if (p.touch) this.hover(null);
  }

  /**
   * The mouse wheel or touchpad: zoom about the cursor by how far it scrolled (`dy` px, > 0 zooms out),
   * so a touchpad's many small steps zoom as smoothly as a wheel's notches (~14% each).
   */
  wheel(sx: number, sy: number, dy: number) {
    this.view.stopGlide();
    const k = Math.exp(-Math.max(-150, Math.min(150, dy)) * WHEEL_ZOOM);
    this.view.zoomAt(sx, sy, this.view.zoom * k);
  }
}

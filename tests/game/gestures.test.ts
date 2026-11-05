import { describe, expect, it } from 'vitest';
import { indexOf, type Cell } from '../../src/core';
import { Gestures, TAP_SLOP, TOUCH_BUILD_DELAY, TOUCH_LIFT, type GestureView, type PointerIn } from '../../src/game/gestures';
import { keyCommand, runKey } from '../../src/game/keys';
import { Session, type SessionView } from '../../src/game/session';
import { T } from '../../src/render/strings';

/** 10 screen px per cell, no camera: cell (x, y) is at (10x + 5, 10y + 5). The UI covers sy >= 900. */
const CELL = 10;
const px = (c: Cell) => ({ sx: c.x * CELL + 5, sy: c.y * CELL + 5 });

function setup() {
  const s = new Session({ seed: 5, tutorial: false, seen: true });
  // Plain land where the tests build (no trees, rocks or river in the way).
  s.state.feature = s.state.feature.map(() => null);
  s.state.ground = s.state.ground.map(() => 'sand');
  const toasts: string[] = [];
  const sv: SessionView = {
    modalOpen: false,
    redraw: () => {},
    overlay: () => {},
    toast: (m) => toasts.push(m),
    out: () => {},
    drawSpots: () => {},
    glideTo: () => {},
    openCategory: () => {},
    setTutorial: () => {},
  };
  s.attach(sv);
  const cam = { panned: [0, 0], zoom: 1, turned: 0 };
  const view: GestureView = {
    cellAt: (sx, sy) => (sx < 0 || sy < 0 ? null : { x: Math.floor(sx / CELL), y: Math.floor(sy / CELL) }),
    overUi: (_sx, sy) => sy >= 900,
    modalOpen: false,
    panBy: (dx, dy) => {
      cam.panned[0] += dx;
      cam.panned[1] += dy;
    },
    get zoom() {
      return cam.zoom;
    },
    zoomAt: (_x, _y, z) => (cam.zoom = z),
    turnBy: (a) => (cam.turned += a),
    stopGlide: () => {},
    cursorChanged: () => {},
    hoverChanged: () => {},
  };
  return { s, g: new Gestures(s, view), cam, toasts };
}

const ptr = (p: { sx: number; sy: number }, o: Partial<PointerIn> = {}): PointerIn => ({ id: 1, touch: false, button: 0, t: 0, ...p, ...o });
const road = (s: Session, x: number, y: number) => s.state.roads[indexOf(s.state, x, y)];

describe('gestures on the map (every view)', () => {
  it('a tap with Mover opens the balloon of what is there', () => {
    const { s, g } = setup();
    const a = s.state.buildings.find((b) => b.kind === 'altar')!;
    const p = px({ x: a.x, y: a.y });
    g.down(ptr(p));
    g.up(ptr(p));
    expect(s.selected).toEqual({ x: a.x, y: a.y });
  });

  it('a drag with Mover moves the camera, past the tap slop only', () => {
    const { g, cam } = setup();
    g.down(ptr({ sx: 100, sy: 100 }));
    g.move(ptr({ sx: 100 + TAP_SLOP - 1, sy: 100 }), true);
    expect(cam.panned).toEqual([0, 0]);
    g.move(ptr({ sx: 130, sy: 100 }), true);
    // From the last point seen (the press moved inside the slop first).
    expect(cam.panned[0]).toBe(30 - (TAP_SLOP - 1));
    expect(g.cursor).toBe('grab');
    g.up(ptr({ sx: 130, sy: 100 }));
  });

  it('a mouse drag with Rua builds an orthogonal road; a touch drag waits 150 ms first', () => {
    const { s, g } = setup();
    s.selectTool('road');
    g.down(ptr(px({ x: 2, y: 2 })));
    g.move(ptr(px({ x: 6, y: 2 })), true);
    g.up(ptr(px({ x: 6, y: 2 })));
    for (let x = 2; x <= 6; x++) expect(road(s, x, 2)).toBe(true);

    g.down(ptr(px({ x: 2, y: 5 }), { touch: true, t: 0 }));
    g.move(ptr(px({ x: 6, y: 5 }), { touch: true, t: TOUCH_BUILD_DELAY - 1 }), true);
    expect(road(s, 3, 5)).toBe(false);
    g.move(ptr(px({ x: 7, y: 5 }), { touch: true, t: TOUCH_BUILD_DELAY }), true);
    g.up(ptr(px({ x: 7, y: 5 }), { touch: true }));
    expect(road(s, 2, 5) && road(s, 7, 5)).toBe(true);
  });

  it('a second finger cancels the drag and pinches the zoom (and turns)', () => {
    const { s, g, cam } = setup();
    s.selectTool('road');
    g.down(ptr({ sx: 100, sy: 100 }, { touch: true }));
    g.down(ptr({ sx: 200, sy: 100 }, { id: 2, touch: true }));
    g.move(ptr({ sx: 300, sy: 100 }, { id: 2, touch: true, t: 500 }), true);
    expect(cam.zoom).toBeCloseTo(2);
    g.move(ptr({ sx: 100, sy: 300 }, { id: 2, touch: true, t: 600 }), true);
    expect(cam.turned).toBeCloseTo(Math.PI / 2);
    g.up(ptr({ sx: 100, sy: 300 }, { id: 2, touch: true }));
    g.up(ptr({ sx: 100, sy: 100 }, { touch: true }));
    expect(s.state.roads.filter(Boolean).length).toBe(createdRoads(s));
  });

  it('a single building on touch is aimed 90 px above the finger and drops on release; over the UI it cancels', () => {
    const { s, g } = setup();
    s.state.unlocked.push('fisher');
    s.selectTool('plaza');
    const target = { x: 10, y: 10 };
    const finger = { sx: px(target).sx, sy: px(target).sy + TOUCH_LIFT };
    expect(g.aimAt(ptr(finger, { touch: true }))).toEqual(target);
    expect(g.aimAt(ptr({ sx: 50, sy: 950 }, { touch: true }))).toBeNull();
  });

  it('the right button always moves the map; the wheel zooms', () => {
    const { s, g, cam } = setup();
    s.selectTool('road');
    g.down(ptr({ sx: 100, sy: 100 }, { button: 2 }));
    g.move(ptr({ sx: 140, sy: 120 }, { button: 2 }), true);
    g.up(ptr({ sx: 140, sy: 120 }, { button: 2 }));
    expect(cam.panned).toEqual([40, 20]);
    expect(road(s, 10, 10)).toBe(false);
    g.wheel(0, 0, -1);
    expect(cam.zoom).toBeCloseTo(1.1);
  });

  it('a road dragged onto a button stops there and says so', () => {
    const { s, g, toasts } = setup();
    s.selectTool('road');
    g.down(ptr(px({ x: 2, y: 80 })));
    g.move(ptr(px({ x: 2, y: 85 })), true);
    g.move(ptr({ sx: 25, sy: 950 }), true);
    g.up(ptr({ sx: 25, sy: 950 }));
    expect(toasts).toContain(T.roadUnderUi);
  });
});

/** Roads the game starts with (the starting road and the ring), so nothing new was built. */
function createdRoads(s: Session) {
  return new Session({ seed: s.seed, tutorial: false, seen: true }).state.roads.filter(Boolean).length;
}

describe('keys (PC)', () => {
  it('maps the keys to commands', () => {
    expect(keyCommand('1')).toEqual({ tool: 'view' });
    expect(keyCommand('2')).toEqual({ tool: 'road' });
    expect(keyCommand('0')).toEqual({ tool: 'clear' });
    expect(keyCommand('3')).toHaveProperty('category');
    expect(keyCommand(' ')).toEqual({ do: 'speed' });
    expect(keyCommand('R')).toEqual({ do: 'rotate' });
    expect(keyCommand('q')).toEqual({ turn: -1 });
    expect(keyCommand('Escape')).toEqual({ do: 'escape' });
    expect(keyCommand('w')).toBeNull();
    expect(keyCommand('w', true)).toHaveProperty('pan');
  });

  it('Esc closes a panel first, then the balloon, then goes back to Mover', () => {
    const { s } = setup();
    let open = true;
    const v = { closeTop: () => (open ? !(open = false) : false), turnMap: () => {} };
    const a = s.state.buildings.find((b) => b.kind === 'altar')!;
    s.select({ x: a.x, y: a.y });
    runKey({ do: 'escape' }, s, v);
    expect(s.selected).not.toBeNull();
    runKey({ do: 'escape' }, s, v);
    expect(s.selected).toBeNull();
    s.selectTool('road');
    runKey({ do: 'escape' }, s, v);
    expect(s.tool).toBe('view');
  });
});

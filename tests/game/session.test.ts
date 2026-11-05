import { describe, expect, it } from 'vitest';
import { indexOf, RULES, type Rect } from '../../src/core';
import type { GameOut } from '../../src/game/events';
import { newDrag, Session, type SessionView } from '../../src/game/session';
import { T } from '../../src/render/strings';
import { SPEEDS } from '../../src/render/tools';

/** A view that only records what the session asks of it. */
function recorder() {
  const log = { toasts: [] as string[], outs: [] as GameOut[], redraws: 0, glides: [] as (Rect | null)[], tutorial: [] as (string | null)[] };
  const view: SessionView = {
    modalOpen: false,
    redraw: () => log.redraws++,
    overlay: () => {},
    toast: (msg) => log.toasts.push(msg),
    out: (o) => log.outs.push(o),
    drawSpots: () => {},
    glideTo: (r) => log.glides.push(r),
    openCategory: () => {},
    setTutorial: (s) => log.tutorial.push(s),
  };
  return { view, log };
}

const game = (o: { tutorial?: boolean; seed?: number } = {}) => {
  const s = new Session({ seed: o.seed ?? 5, tutorial: !!o.tutorial, seen: !o.tutorial });
  const r = recorder();
  s.attach(r.view);
  return { s, ...r };
};

describe('session (one game, without drawing)', () => {
  it('the same seed gives the same game', () => {
    expect(JSON.stringify(game({ seed: 9 }).s.state)).toBe(JSON.stringify(game({ seed: 9 }).s.state));
  });

  it('runs weeks with the clock at the chosen speed, and stands still at 0', () => {
    const { s } = game();
    s.setSpeed(1);
    expect(s.tick(RULES.weekSeconds)).toBe(true);
    expect(s.state.week).toBe(1);
    s.setSpeed(0);
    expect(s.tick(RULES.weekSeconds * 5)).toBe(false);
    expect(s.state.week).toBe(1);
  });

  it('a modal dialog stops the clock and the player', () => {
    const { s, view } = game();
    (view as { modalOpen: boolean }).modalOpen = true;
    expect(s.tick(RULES.weekSeconds * 3)).toBe(false);
    s.selectTool('road');
    expect(s.tool).toBe('view');
  });

  it('the tutorial holds the clock on its build steps', () => {
    const { s } = game({ tutorial: true });
    expect(s.guide?.holdsClock).toBe(true);
    expect(s.tick(RULES.weekSeconds * 3)).toBe(false);
    s.skipTutorial();
    expect(s.guide).toBeNull();
    expect(s.tick(RULES.weekSeconds)).toBe(true);
  });

  it('the tutorial shows its sentence and glides to the road it marks', () => {
    const { s, log } = game({ tutorial: true });
    s.refresh();
    expect(log.tutorial.at(-1)).toBe(T.tutorial.step.road);
    expect(log.glides.at(-1)).toEqual(s.stepSpot('road'));
    expect(s.tutorialPoint(false)).toEqual({ tool: 'road' });
    s.selectTool('road');
    expect(s.tutorialPoint(false)).toEqual({ road: s.ghost[0] });
  });

  it('a locked building cannot be picked (a hint says so)', () => {
    const { s, log } = game();
    s.selectTool('temple');
    expect(s.tool).toBe('view');
    expect(log.toasts).toContain(T.lockedHint('temple'));
  });

  it('builds a road, warns once about a loose one, and says lack of silver once per drag', () => {
    const { s, log } = game();
    s.selectTool('road');
    const free = { x: 2, y: 2 };
    s.apply(free, true);
    expect(s.state.roads[indexOf(s.state, 2, 2)]).toBe(true);
    expect(log.toasts).toEqual([T.looseRoad]);
    expect(log.outs.at(-1)).toMatchObject({ do: 'placed', x: 2, y: 2 });
    s.state.silver = 0;
    const drag = newDrag();
    s.batch(() => {
      for (let x = 3; x < 8; x++) s.apply({ x, y: 2 }, x === 3, false, drag);
    });
    expect(log.toasts.filter((t) => t === T.fail.silver)).toHaveLength(1);
  });

  it('says why a place is blocked', () => {
    const { s, log } = game();
    s.selectTool('road');
    const altar = s.state.buildings.find((b) => b.kind === 'altar')!;
    s.apply({ x: altar.x, y: altar.y }, true);
    expect(log.toasts).toEqual([T.blocked.taken]);
  });

  it('a drag refreshes the city once at its end', () => {
    const { s, log } = game();
    s.selectTool('road');
    const before = log.redraws;
    s.batch(() => {
      for (let x = 2; x < 6; x++) s.apply({ x, y: 2 }, x === 2, false, newDrag());
    });
    expect(log.redraws - before).toBe(1);
  });

  it('demolishing raises dust; a tap with Mover opens and closes a balloon', () => {
    const { s, log } = game();
    s.selectTool('road');
    s.apply({ x: 2, y: 2 }, true);
    s.demolishAt({ x: 2, y: 2 });
    expect(log.outs.at(-1)).toEqual({ do: 'dust', x: 2, y: 2, w: 1, h: 1 });
    const altar = s.state.buildings.find((b) => b.kind === 'altar')!;
    s.selectTool('view');
    s.select({ x: altar.x, y: altar.y });
    expect(s.selected).toEqual({ x: altar.x, y: altar.y });
    s.select({ x: 2, y: 2 });
    expect(s.selected).toBeNull();
  });

  it('debt at 3x slows the game to 1x once', () => {
    const { s } = game();
    s.setSpeed(3);
    s.handleEvents([{ type: 'debtStart' }]);
    expect(s.speed).toBe(1);
    expect(SPEEDS).toContain(s.speed);
  });

  it('counts births and weddings for the victory screen', () => {
    const { s } = game();
    const [a, b] = s.state.start.couple;
    s.handleEvents([{ type: 'wedding', a, b, x: 0, y: 0 }]);
    expect(s.tally).toEqual({ births: 0, weddings: 1 });
  });

  it('the market turns with R (the same tool again) and roads do not', () => {
    const { s } = game();
    s.state.unlocked.push('market');
    s.selectTool('market');
    s.selectTool('market');
    expect(s.rotated).toBe(true);
    s.selectTool('road');
    s.rotate();
    expect(s.rotated).toBe(true);
  });
});

import { RULES } from './data';
import { reach } from './goals';
import { indexOf } from './grid';
import { rollLook } from './looks';
import { doorsOf, findPath } from './network';
import { rollUpWeeks } from './houses';
import { capacityOf, depart, vacate, wed } from './people';
import type { Building, Cell, GameEvent, GameState, Rng } from './types';

/** Caravans start at the city entrance; if it was cut off, at a road next to the altar. */
export function startCell(s: GameState): Cell | null {
  if (s.network[indexOf(s, s.entrance.x, s.entrance.y)]) return s.entrance;
  const altar = s.buildings.find((b) => b.kind === 'altar');
  return (altar && doorsOf(s, altar)[0]) ?? null;
}

/** Road path from a cell to a house, ending on the house cell (null when there is none). */
export function pathTo(s: GameState, from: Cell | null | undefined, house: Building): Cell[] | null {
  if (!from) return null;
  const path = findPath(s, from, doorsOf(s, house));
  return path && [...path, { x: house.x, y: house.y }];
}

/** Someone is already walking to this house. */
export const awaited = (s: GameState, b: Building) => s.families.some((f) => f.houseId === b.id);

/** An empty house people can move into: connected, and nobody walking to it. */
export const freeHouse = (s: GameState, b: Building) => b.kind === 'house' && b.level === 0 && b.connected && !awaited(s, b);

/**
 * Empty houses people can move into, best first: the highest kept level (`emptyLevel`), then the
 * nearest to `near` (Manhattan distance between top-left cells), then the oldest.
 */
export function freeHouses(s: GameState, near: Cell): Building[] {
  const d = (b: Building) => Math.abs(b.x - near.x) + Math.abs(b.y - near.y);
  return s.buildings.filter((b) => freeHouse(s, b)).sort((a, b) => b.emptyLevel - a.emptyLevel || d(a) - d(b) || a.id - b.id);
}

/**
 * Sends people walking from a cell to a house (the first of `houses` with a road path). Returns
 * the house, or null when none can be reached.
 */
export function sendWalking(s: GameState, from: Cell | null | undefined, houses: Building[], members: number[]): Building | null {
  for (const house of houses) {
    const path = pathTo(s, from, house);
    if (!path) continue;
    s.families.push({ id: s.nextId++, houseId: house.id, members, path, step: 0 });
    return house;
  }
  return null;
}

/** Cells a family walks per week. */
export const familySpeed = () => RULES.familyCellsPerWeek;

/** Remaining road cells (excluding the house cell) are still part of the network. */
function routeIntact(s: GameState, path: Cell[], from: number): boolean {
  return path.slice(from, -1).every((c) => s.network[indexOf(s, c.x, c.y)]);
}

/**
 * A walk that cannot go on: people of a caravan (no house yet) leave the city; the others stay
 * where they live (a couple waits again for a house, an elder stays home).
 */
function giveUp(s: GameState, members: number[]) {
  for (const id of members) {
    const p = s.people.find((o) => o.id === id);
    if (p && p.houseId === null) depart(s, p, 'noHouse');
  }
}

/** Marries an engaged couple (man a, woman b) in their house: counted for the year, an event and the first-wedding milestone. */
export function celebrateWedding(s: GameState, a: number, b: number, house: Building, events: GameEvent[]) {
  const man = s.people.find((p) => p.id === a);
  const woman = s.people.find((p) => p.id === b);
  if (!man || !woman) return;
  wed(man, woman);
  s.yearStats.weddings++;
  events.push({ type: 'wedding', a, b, x: house.x, y: house.y });
  reach(s, 'firstWedding', events);
}

/** Moves people into a house: an empty one opens at its kept level (a tent at least). Their old houses may stand empty. */
export function moveIn(s: GameState, house: Building, members: number[], rng: Rng, events: GameEvent[]) {
  const old = new Set<number>();
  for (const id of members) {
    const p = s.people.find((o) => o.id === id);
    if (!p) continue;
    if (p.houseId !== null && p.houseId !== house.id) old.add(p.houseId);
    p.houseId = house.id;
  }
  if (house.level === 0) {
    house.level = Math.max(1, house.emptyLevel);
    house.emptyLevel = 0;
    house.upStreak = 0;
    house.downStreak = 0;
    rollUpWeeks(house, rng);
    rollLook(s, house, rng);
    events.push({ type: 'houseUp', x: house.x, y: house.y, level: house.level, delta: members.length });
  }
  for (const id of old) vacate(s, id);
}

/**
 * Moves the walking people along the roads; at the house they move in (an engaged couple marries
 * there). Broken routes are recalculated; a walk with no way left, or whose house is gone, ends.
 */
export function moveFamilies(s: GameState, events: GameEvent[], rng: Rng): void {
  for (const f of [...s.families]) {
    const house = s.buildings.find((b) => b.id === f.houseId);
    const here = Math.floor(f.step);
    let ok = !!house && house.connected;
    if (ok && !routeIntact(s, f.path, here)) {
      const path = pathTo(s, f.path[Math.min(here, f.path.length - 2)], house!);
      if (path) {
        f.path = path;
        f.step = 0;
      } else ok = false;
    }
    if (!ok) {
      s.families = s.families.filter((o) => o !== f);
      giveUp(s, f.members);
      continue;
    }
    f.step += familySpeed();
    if (f.step < f.path.length - 1) continue;
    s.families = s.families.filter((o) => o !== f);
    moveIn(s, house!, f.members, rng, events);
    const [a, b] = f.members.map((id) => s.people.find((p) => p.id === id));
    if (a && b && f.members.length === 2 && a.engaged !== null && a.spouseId === b.id) {
      const man = a.sex === 'm' ? a : b;
      celebrateWedding(s, man.id, man === a ? b.id : a.id, house!, events);
    }
  }
}

/** Room left in a house (capacity of its level minus the people living there). */
export const roomIn = (s: GameState, b: Building) => capacityOf(b) - s.people.filter((p) => p.houseId === b.id).length;

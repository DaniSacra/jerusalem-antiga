import {
  BUILDINGS,
  fieldHarvest,
  grownUpThisWeek,
  indexOf,
  MAX_HOUSE_LEVEL,
  personById,
  seasonOf,
  type Building,
  type Cell,
  type GameEvent,
  type GameState,
  type MilestoneId,
  type Placeable,
} from '../core';
import { T } from '../render/strings';
import { milestoneSite, spoilSite } from './placement';
import type { ToastOptions, Tone } from './toastQueue';

/**
 * What the views do with the week's events, in order (pure: the same list for the 2D and the 3D).
 * `fx` commands are drawn by the map; the others go to the interface or the session.
 */
export type GameOut =
  | { do: 'toast'; msg: string; tone: Tone; opt?: ToastOptions }
  /** A house grew (a level or a baby): it hops, a ring of light spreads and the gain floats up. */
  | { do: 'cheer'; x: number; y: number; gain: string }
  /** Red text floating up from a footprint (a house went down, a tree cut, food lost). */
  | { do: 'floatBad'; x: number; y: number; w?: number; h?: number; text: string }
  /** The player built on this footprint: a ring of light (the temple: a celebration). */
  | { do: 'placed'; x: number; y: number; w: number; h: number; temple: boolean }
  /** Something was demolished on this footprint: dust the size of it. */
  | { do: 'dust'; x: number; y: number; w: number; h: number }
  /** A building climbed a level by the player's hand: it hops with a gold ring. */
  | { do: 'upgraded'; building: Building }
  /** A milestone: the place shines and people gather; `note` adds its sentence to the interface. */
  | { do: 'milestone'; building: Building; id: MilestoneId; note: boolean }
  | { do: 'spoil'; building: Building }
  | { do: 'harvestRing'; building: Building }
  | { do: 'fell'; x: number; y: number }
  /** A family leaves the house on this cell (walks out of town). */
  | { do: 'leave'; x: number; y: number }
  /** Something worth seeing in 3D: the 3D button pulses gently. */
  | { do: 'invite3D' }
  | { do: 'unlocked'; kind: Placeable }
  | { do: 'victory'; week: number; residents: number; births: number; weddings: number }
  | { do: 'defeat'; week: number; peak: number }
  /** Debt began at 3x: back to 1x once so the player can react. */
  | { do: 'slowDown' }
  /** The market unlocked (the tutorial adds its short step). */
  | { do: 'marketUnlocked' };

/** Births and weddings of the game so far (the victory screen tells them). */
export interface Tally {
  births: number;
  weddings: number;
}

const nameOf = (s: GameState, id: number | null) => personById(s, id)?.name ?? '';

/** Turns the week's events into what the views do; counts births and weddings into `tally`. */
export function readEvents(s: GameState, events: readonly GameEvent[], tally: Tally): GameOut[] {
  const out: GameOut[] = [];
  const toast = (msg: string, tone: Tone) => out.push({ do: 'toast', msg, tone });
  /** Where houses rose this week, by level (a milestone celebrates the house that reached it). */
  const ups = new Map<number, Cell>();
  for (const e of events) {
    switch (e.type) {
      case 'houseUp':
        ups.set(e.level, { x: e.x, y: e.y });
        out.push({ do: 'cheer', x: e.x, y: e.y, gain: `+${e.delta}` });
        if (e.level === MAX_HOUSE_LEVEL) out.push({ do: 'invite3D' }); // a Casa grande: worth seeing in 3D
        break;
      case 'houseDown':
        out.push({ do: 'floatBad', x: e.x, y: e.y, text: T.houseDown(e.delta, e.famine, e.famine && s.cold && !s.famine) });
        break;
      case 'famineStart':
        toast(T.famine, 'bad');
        break;
      case 'coldStart':
        toast(T.coldStart, 'bad');
        break;
      case 'coldEnd':
        toast(T.coldEnd, 'good');
        break;
      case 'goal':
        toast(T.goalDone(e.reward, e.unlock), 'good');
        if (e.unlock === 'market') out.push({ do: 'marketUnlocked' });
        if (e.unlock && T.unlocked[e.unlock]) toast(T.unlocked[e.unlock]!, 'good');
        if (e.unlock) out.push({ do: 'unlocked', kind: e.unlock });
        out.push({ do: 'invite3D' });
        break;
      case 'victory':
        out.push({ do: 'victory', week: e.week, residents: e.residents, births: tally.births, weddings: tally.weddings });
        break;
      case 'familyLeft':
        out.push({ do: 'leave', x: e.x, y: e.y });
        toast(T.familyLeft(e.reason, e.name), 'bad');
        break;
      case 'debtStart':
        toast(T.debtStart, 'bad');
        out.push({ do: 'slowDown' });
        break;
      case 'debtEnd':
        toast(T.debtEnd, 'good');
        break;
      case 'defeat':
        out.push({ do: 'defeat', week: e.week, peak: e.peak });
        break;
      case 'season':
        toast(T.seasonStart[e.season], 'info');
        break;
      case 'milestone': {
        // The first child of the city to come of age is named.
        const grown = e.id === 'firstGrownUp' ? grownUpThisWeek(s) : null;
        out.push({ do: 'milestone', building: milestoneSite(s, e.id, ups), id: e.id, note: !grown });
        if (grown) toast(T.grownUp(grown.name, grown.sex === 'f'), 'good');
        break;
      }
      case 'spoilStart':
        out.push({ do: 'spoil', building: spoilSite(s) });
        break;
      case 'harvestStart':
        // A golden ring on every field that starts harvesting.
        for (const b of s.buildings) if (b.kind === 'field' && fieldHarvest(s, b, s.week - 1) > 0) out.push({ do: 'harvestRing', building: b });
        break;
      case 'treeCut':
        out.push({ do: 'fell', x: e.x, y: e.y });
        break;
      case 'wedding':
        tally.weddings++;
        toast(T.wedding(nameOf(s, e.a), nameOf(s, e.b)), 'good');
        break;
      case 'birth': {
        tally.births++;
        const p = personById(s, e.id);
        if (p) toast(T.birth(p.name, p.sex === 'f', nameOf(s, p.fatherId), nameOf(s, p.motherId)), 'info');
        out.push({ do: 'cheer', x: e.x, y: e.y, gain: '+1' });
        break;
      }
      case 'death':
        toast(T.death(nameOf(s, e.id), e.age), 'quiet');
        break;
      case 'coupleLeft':
        toast(T.coupleLeft(nameOf(s, e.a), nameOf(s, e.b)), 'bad');
        break;
      case 'caravanAnnounced':
        toast(T.caravanAnnounced(e.families, seasonOf(e.week)), 'info');
        break;
      case 'caravanArrived':
        toast(T.caravanArrived(e.housed, e.left), e.left ? 'info' : 'good');
        break;
      case 'buildingUp': {
        const b = s.grid[indexOf(s, e.x, e.y)];
        if (b) toast(T.buildingUp(BUILDINGS[b.kind].name, e.level), 'good');
        break;
      }
    }
  }
  return out;
}

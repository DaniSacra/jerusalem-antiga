import { noteTheft, theftAt } from './theft';
import { HOUSE_LEVELS, RULES, TEMPLE_STAGES } from './data';
import { computeEconomy, round2, type Economy } from './economy';
import { foodCapacity } from './harvest';
import { stepCaravans } from './caravans';
import { moveFamilies } from './families';
import { checkGoal, reach } from './goals';
import { hasNeeds, rollUpWeeks } from './houses';
import { stepPeople } from './life';
import { clanName } from './names';
import { leaveHouse } from './people';
import { rollLook } from './looks';
import { refreshCity } from './refresh';
import { lackingMaterial, levelMaterials, payMaterials } from './materials';
import { cutTrees, regrowTrees } from './trees';
import { buildersAtWork, nextStage, stageSite } from './temple';
import { coldDeaths, coldDeathsSince } from './cold';
import { burnFirewood, keepsFirewood } from './firewood';
import { wearClothes } from './clothes';
import { seasonOf, seasonStarts, WEEKS_PER_YEAR } from './seasons';
import type { Building, GameEvent, GameState, LeaveReason, Rng } from './types';

function changeLevel(s: GameState, b: Building, dir: 1 | -1, famine: boolean, rng: Rng, events: GameEvent[]) {
  const before = HOUSE_LEVELS[b.level].capacity;
  b.level += dir;
  b.upStreak = 0;
  b.downStreak = 0;
  b.waiting = undefined;
  b.firewoodHold = undefined;
  rollLook(s, b, rng);
  rollUpWeeks(b, rng);
  const delta = HOUSE_LEVELS[b.level].capacity - before;
  const { x, y } = b;
  events.push(dir > 0 ? { type: 'houseUp', x, y, level: b.level, delta } : { type: 'houseDown', x, y, level: b.level, delta, famine });
}

/** Everyone in a tent leaves the city and the tent goes with them: the plot stands empty. */
function abandon(s: GameState, b: Building, reason: LeaveReason, events: GameEvent[]) {
  const clan = leaveHouse(s, b.id, reason);
  b.emptyLevel = 0;
  events.push({ type: 'familyLeft', x: b.x, y: b.y, reason, name: clan === null ? '' : clanName(clan) });
}

/**
 * A house climbs one level after its `upWeeks` weeks in a row with the next level's needs met
 * and drops one after `weeksToDowngrade` weeks missing its own. Famine pauses the climb and may
 * drop the house or send the tent's family away. Empty houses (level 0) neither climb nor drop.
 * Climbing pays the next level's materials at once; without them the house waits at `upWeeks`
 * with `waiting` set (houses are visited in list order: the oldest pays first). In autumn and
 * winter it also waits (`firewoodHold`) when paying the wood would leave the winter short of
 * firewood (`keepsFirewood`). Dropping gives nothing back.
 */
function updateHouse(s: GameState, b: Building, rng: Rng, events: GameEvent[], woodPerWeek: number) {
  if (b.level === 0) return;
  if (!hasNeeds(s, b, HOUSE_LEVELS[b.level].needs)) {
    b.upStreak = 0;
    b.waiting = undefined;
    b.firewoodHold = undefined;
    if (++b.downStreak < RULES.weeksToDowngrade) return;
    changeLevel(s, b, -1, false, rng, events);
    // A tent missing its needs lost its road: the family walks out and the plot waits for another.
    if (b.level === 0) abandon(s, b, 'road', events);
    return;
  }
  b.downStreak = 0;
  if (s.famine || s.cold) {
    // Famine or cold (one draw, not two) pauses the climb (the weeks already counted stay); losing a need resets it.
    const winter = seasonOf(s.week) === 'winter';
    if (b.level > 1) {
      if (rng() < RULES.famineDropChance) {
        changeLevel(s, b, -1, true, rng, events);
        if (winter) s.winterLoss = true;
      }
    } else if (rng() < (winter ? RULES.winterFamineLeaveChance : RULES.famineLeaveChance)) {
      if (winter) s.winterLoss = true;
      // The family abandons its tent and walks out of the city; the plot waits for a new family.
      changeLevel(s, b, -1, true, rng, events);
      abandon(s, b, s.famine ? 'famine' : 'cold', events);
    }
    return;
  }
  const next = HOUSE_LEVELS[b.level + 1];
  if (next && hasNeeds(s, b, next.needs)) {
    b.upStreak = Math.min(b.upStreak + 1, b.upWeeks);
    if (b.upStreak < b.upWeeks) return;
    const cost = levelMaterials(b.level + 1);
    const lacking = lackingMaterial(s, cost);
    if (lacking) {
      b.waiting = lacking;
      b.firewoodHold = undefined;
      return;
    }
    // In autumn and winter the wood is the firewood first: a climb waits if paying would leave the winter short.
    b.waiting = undefined;
    if (cost.wood && keepsFirewood(s, cost.wood, woodPerWeek)) {
      b.firewoodHold = true;
      return;
    }
    b.firewoodHold = undefined;
    payMaterials(s, cost);
    changeLevel(s, b, 1, false, rng, events);
  } else {
    b.upStreak = 0;
    b.waiting = undefined;
    b.firewoodHold = undefined;
  }
}

/** The connected `staffedServices` buildings (the market) with someone working there. */
const staffedServices = (s: GameState) =>
  s.buildings.filter((b) => b.connected && RULES.staffedServices.includes(b.kind) && s.people.some((p) => p.jobId === b.id));

/** A later caravan (planned or announced) is due within `debtCaravanWeeks`: the debt cannot lose the game yet. */
export const caravanSpares = (s: GameState) =>
  s.caravans.some((c) => (c.status === 'planned' || c.status === 'announced') && c.week - s.week <= RULES.debtCaravanWeeks);

/**
 * Counts consecutive weeks ended in debt; the city is lost after RULES.debtWeeksToLose, except
 * while a caravan is due soon (`caravanSpares`): then the count stops one week short of the defeat.
 */
function updateDebt(s: GameState, events: GameEvent[]) {
  if (s.silver >= 0) {
    if (s.debtWeeks > 0) events.push({ type: 'debtEnd' });
    s.debtWeeks = 0;
    return;
  }
  if (s.debtWeeks === 0) events.push({ type: 'debtStart' });
  s.debtWeeks = caravanSpares(s) ? Math.min(s.debtWeeks + 1, RULES.debtWeeksToLose - 1) : s.debtWeeks + 1;
  if (s.debtWeeks >= RULES.debtWeeksToLose) {
    s.lost = true;
    events.push({ type: 'defeat', week: s.week, peak: s.peakPopulation });
  }
}

/** Keeps the food within the stores; the rest spoils (an event when spoiling starts). */
function store(s: GameState, events: GameEvent[]) {
  const cap = foodCapacity(s);
  const was = s.spoiled > 0;
  s.spoiled = s.food > cap ? round2(s.food - cap) : 0;
  if (s.spoiled > 0) s.food = cap;
  if (s.spoiled > 0 && !was) events.push({ type: 'spoilStart' });
}

/** A new winter rolls whether the coming spring is dry; a new autumn ends the dry year. */
function newSeason(s: GameState, rng: Rng, events: GameEvent[]) {
  const season = seasonOf(s.week);
  events.push({ type: 'season', season });
  if (season === 'winter') {
    s.winterLoss = false;
    const d = RULES.drought;
    const year = Math.floor(s.week / WEEKS_PER_YEAR); // 0 in the first year
    s.drought = year >= d.safeYears && !(d.neverTwice && s.lastDrought) && rng() < d.chance;
    if (s.drought) events.push({ type: 'drought' });
  }
  if (season === 'autumn') {
    // The city dresses for the cold from the first autumn after the tannery is unlocked (a season's warning).
    if (s.unlocked.includes('tannery')) s.dressing = true;
    s.lastDrought = s.drought;
    s.drought = false;
    if (!s.famineThisYear) reach(s, 'yearWithoutFamine', events);
    s.famineThisYear = false;
    s.yearStats = { births: 0, deaths: 0, coldDeaths: 0, weddings: 0 };
  }
  if (season === 'spring') {
    const n = coldDeathsSince(s, s.week - RULES.weeksPerSeason);
    if (n > 0) events.push({ type: 'winterToll', n });
  }
  if (season === 'spring' && computeEconomy(s).residents > 0) {
    reach(s, 'firstSpring', events);
    if (!s.winterLoss) reach(s, 'firstWinter', events);
  }
}

/** Milestones of the houses: the first mud-brick and stone houses. */
function houseMilestones(s: GameState, events: GameEvent[]) {
  const ups = events.filter((e) => e.type === 'houseUp').map((e) => e.level);
  if (ups.includes(2)) reach(s, 'firstMud', events);
  if (ups.includes(3)) reach(s, 'firstStone', events);
}

function record(s: GameState, eco: Economy) {
  s.history.push({ silver: s.silver, food: s.food, residents: eco.residents, happiness: eco.happiness, capacity: foodCapacity(s) });
  if (s.history.length > RULES.historyWeeks) s.history.splice(0, s.history.length - RULES.historyWeeks);
}

/**
 * The restored altar burns its offering (`offering` of the last stage built) from the pens, after the
 * week's livestock came in: with enough it covers its sacred radius this week (`s.offered`); without,
 * it burns nothing and covers nothing (`offeringsMissing` once per episode, `offeringsBack` after).
 */
function offer(s: GameState, events: GameEvent[]) {
  const built = TEMPLE_STAGES[s.temple.done - 1];
  if (!built) return;
  const was = s.offered;
  s.offered = s.livestock >= built.offering;
  if (s.offered) s.livestock = round2(s.livestock - built.offering);
  const altar = stageSite(s, TEMPLE_STAGES[0])!;
  if (was && !s.offered) events.push({ type: 'offeringsMissing', x: altar.x, y: altar.y });
  if (!was && s.offered) events.push({ type: 'offeringsBack' });
}

/**
 * The stage of the Temple under way gains 1 a week per builder at work; at its `work` it is built:
 * the site's builders' jobs close and a `stageDone` event goes out (the goal follows in `checkGoal`).
 */
function advanceTemple(s: GameState, events: GameEvent[]) {
  const st = nextStage(s);
  if (!st || !s.temple.active) return;
  s.temple.progress += buildersAtWork(s);
  if (s.temple.progress < st.work) return;
  const site = stageSite(s, st)!;
  s.temple = { done: s.temple.done + 1, active: false, progress: 0 };
  site.builders = undefined;
  delete s.jobTargets[site.kind]; // the next stage asks for its own builders
  if (s.temple.done === 1) s.offered = true; // the restored altar burns from next week (a lack says so then)
  refreshCity(s);
  events.push({ type: 'stageDone', stage: s.temple.done, x: site.x, y: site.y });
}

/** Advances the simulation by one week and returns what happened. Nothing happens once lost. */
export function stepWeek(s: GameState, rng: Rng): GameEvent[] {
  const events: GameEvent[] = [];
  if (s.lost) return events;
  refreshCity(s);

  const eco = computeEconomy(s);
  noteTheft(s, theftAt(s), events);
  const wasFamine = s.famine;
  s.food = round2(s.food + eco.foodDelta);
  s.famine = s.food <= 0 && eco.foodDelta < 0;
  if (s.food < 0) s.food = 0;
  if (s.famine) s.famineThisYear = true;
  // A winter with famine is not "won" (the first-winter milestone), even if no house fell.
  if (s.famine && seasonOf(s.week) === 'winter') s.winterLoss = true;
  if (s.famine && !wasFamine) events.push({ type: 'famineStart' });
  if (!s.famine && wasFamine) events.push({ type: 'famineEnd' });
  store(s, events);
  if (eco.harvest > 0) {
    if (s.week % RULES.weeksPerSeason === 0 && seasonOf(s.week) === 'spring') events.push({ type: 'harvestStart', amount: round2(eco.harvest * RULES.weeksPerSeason) });
    reach(s, 'firstHarvest', events);
  }

  s.silver = round2(s.silver + eco.silverDelta);
  s.wood = Math.max(0, round2(s.wood + eco.wood));
  s.stone = round2(s.stone + eco.stone);
  s.livestock = round2(s.livestock + eco.livestock);
  s.clothes = round2(s.clothes + eco.clothes);
  offer(s, events);
  burnFirewood(s, events);
  wearClothes(s, eco.residents, events);
  if (s.cold) s.winterLoss = true;
  coldDeaths(s, rng, events);
  // Cut first: the cut count follows the trees the week's wood came from, and a tree that grows
  // back this week is not felled before it is seen.
  cutTrees(s, eco, events);
  regrowTrees(s, events);
  advanceTemple(s, events);

  for (const b of s.buildings) if (b.kind === 'house') updateHouse(s, b, rng, events, eco.wood);

  s.week++;
  if (seasonStarts(s.week)) newSeason(s, rng, events);
  // The people live the new week, the one the screen shows: then the caravans and the walkers.
  stepPeople(s, rng, events);
  stepCaravans(s, rng, events);
  moveFamilies(s, events, rng);
  // Who grew old, left or moved in this week: free their jobs and hand out the free ones (and the market's coverage follows).
  const staffed = staffedServices(s);
  refreshCity(s);
  for (const b of staffed) if (!s.people.some((p) => p.jobId === b.id)) events.push({ type: 'serviceEmpty', kind: b.kind, x: b.x, y: b.y });
  houseMilestones(s, events);
  const after = computeEconomy(s);
  s.peakPopulation = Math.max(s.peakPopulation, after.residents);
  record(s, after);
  checkGoal(s, events);
  updateDebt(s, events);
  return events;
}

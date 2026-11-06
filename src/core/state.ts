import { dimsOf, newBuilding, RULES } from './data';
import { foundPeople, plainEating, rollCaravans } from './caravans';
import { rollUpWeeks } from './houses';
import { round2 } from './economy';
import { rollLook } from './looks';
import { cellsOf, indexOf } from './grid';
import { caravanSpots, entranceCell, generateTerrain, startRoad } from './map';
import { refreshCity } from './refresh';
import { between } from './rng';
import type { GameState, Rng } from './types';

export function createGame(rng: Rng): GameState {
  const { cols, rows, altar } = RULES.map;
  const { ground, feature } = generateTerrain(rng);
  const s: GameState = {
    cols,
    rows,
    ground,
    feature,
    roads: new Array(cols * rows).fill(false),
    network: [],
    buildings: [],
    grid: new Array(cols * rows).fill(null),
    coverage: { plaza: [], market: [], sacred: [], park: [] },
    families: [],
    altar: { ...altar },
    entrance: entranceCell(),
    silver: RULES.startSilver,
    food: 0,
    wood: RULES.startMaterials.wood,
    stone: RULES.startMaterials.stone,
    stumps: [],
    week: 0,
    famine: false,
    cold: false,
    goalIndex: 0,
    unlocked: [...RULES.startUnlocked],
    won: false,
    debtWeeks: 0,
    peakPopulation: 0,
    lost: false,
    drought: false,
    lastDrought: false,
    winterLoss: false,
    spoiled: 0,
    famineThisYear: false,
    milestones: [],
    milestoneWeeks: {},
    history: [],
    start: { families: 0, foodWeeks: 0, couple: [0, 0] },
    people: [],
    departed: [],
    caravans: [],
    yearStats: { births: 0, deaths: 0, coldDeaths: 0, weddings: 0 },
    nextId: 1,
  };
  for (const c of startRoad()) s.roads[indexOf(s, c.x, c.y)] = true;
  const altarB = newBuilding(s.nextId++, 'altar', { x: altar.x, y: altar.y, ...dimsOf('altar') }, 0);
  altarB.connected = true;
  s.buildings.push(altarB);
  for (const c of cellsOf(altarB)) s.grid[indexOf(s, c.x, c.y)] = altarB;
  foundCaravan(s, rng);
  rollCaravans(s, rng);
  refreshCity(s);
  return s;
}

/**
 * The caravan that founds the city: 2–4 families in tents north of the altar (with the engaged
 * couple, see `foundPeople`) and food for 14–22 weeks of their eating, never more than the city
 * can store without a granary (the weeks shown are the real ones).
 */
function foundCaravan(s: GameState, rng: Rng) {
  const families = between(rng, RULES.caravans.start.families);
  const weeks = between(rng, RULES.caravans.start.foodWeeks);
  const tents = caravanSpots()
    .slice(0, families)
    .map((c) => {
      const b = newBuilding(s.nextId++, 'house', { x: c.x, y: c.y, ...dimsOf('house') }, 0);
      b.level = 1;
      s.buildings.push(b);
      for (const cell of cellsOf(b)) s.grid[indexOf(s, cell.x, cell.y)] = b;
      rollLook(s, b, rng);
      rollUpWeeks(b, rng);
      return b.id;
    });
  const eaten = plainEating(foundPeople(s, tents, rng), s.week);
  s.food = round2(Math.min(RULES.baseFoodStorage, weeks * eaten));
  s.start.families = families;
  s.start.foodWeeks = Math.floor(s.food / eaten + 1e-9);
}

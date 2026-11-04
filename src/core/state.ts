import { dimsOf, HOUSE_LEVELS, RULES } from './data';
import { round2 } from './economy';
import { rollLook } from './looks';
import { cellsOf, indexOf } from './grid';
import { caravanSpots, entranceCell, generateTerrain, startRoad } from './map';
import { refreshCity } from './refresh';
import { between } from './rng';
import type { Building, GameState, Rng } from './types';

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
    goalIndex: 0,
    unlocked: [...RULES.startUnlocked],
    won: false,
    debtWeeks: 0,
    peakPopulation: 0,
    lost: false,
    drought: false,
    lastDrought: false,
    winterLoss: false,
    lastFamilyWeek: -Infinity,
    spoiled: 0,
    famineThisYear: false,
    milestones: [],
    milestoneWeeks: {},
    history: [],
    start: { families: 0, foodWeeks: 0 },
    nextId: 1,
  };
  for (const c of startRoad()) s.roads[indexOf(s, c.x, c.y)] = true;
  const altarB: Building = { id: s.nextId++, kind: 'altar', x: altar.x, y: altar.y, ...dimsOf('altar'), level: 0, upStreak: 0, downStreak: 0, connected: true, variant: 0, mirrored: false, built: 0 };
  s.buildings.push(altarB);
  for (const c of cellsOf(altarB)) s.grid[indexOf(s, c.x, c.y)] = altarB;
  foundCaravan(s, rng);
  refreshCity(s);
  return s;
}

/**
 * The caravan that founds the city: 2–4 families in tents north of the altar and food for 14–22 weeks
 * of them, never more than the city can store without a granary (the weeks shown are the real ones).
 */
function foundCaravan(s: GameState, rng: Rng) {
  const families = between(rng, RULES.caravan.families);
  const weeks = between(rng, RULES.caravan.foodWeeks);
  const tent = HOUSE_LEVELS[1];
  const eaten = families * tent.residents * tent.food;
  s.food = round2(Math.min(RULES.baseFoodStorage, weeks * eaten));
  s.start = { families, foodWeeks: Math.floor(s.food / eaten + 1e-9) };
  for (const c of caravanSpots().slice(0, families)) {
    const b: Building = { id: s.nextId++, kind: 'house', x: c.x, y: c.y, ...dimsOf('house'), level: 1, upStreak: 0, downStreak: 0, connected: false, variant: 0, mirrored: false, built: 0 };
    s.buildings.push(b);
    for (const cell of cellsOf(b)) s.grid[indexOf(s, cell.x, cell.y)] = b;
    rollLook(s, b, rng);
  }
}

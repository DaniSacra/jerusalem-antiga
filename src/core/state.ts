import { dimsOf, RULES } from './data';
import { cellsOf, indexOf } from './grid';
import { entranceCell, generateTerrain, startRoad } from './map';
import { refreshCity } from './refresh';
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
    coverage: { well: [], market: [], sacred: [], garden: [] },
    families: [],
    altar: { ...altar },
    entrance: entranceCell(),
    silver: RULES.startSilver,
    food: RULES.startFood,
    month: 0,
    famine: false,
    goalIndex: 0,
    unlocked: [...RULES.startUnlocked],
    won: false,
    debtMonths: 0,
    peakPopulation: 0,
    lost: false,
    nextId: 1,
  };
  for (const c of startRoad()) s.roads[indexOf(s, c.x, c.y)] = true;
  const altarB: Building = { id: s.nextId++, kind: 'altar', x: altar.x, y: altar.y, ...dimsOf('altar'), level: 0, upStreak: 0, downStreak: 0, connected: true, variant: 0, mirrored: false };
  s.buildings.push(altarB);
  for (const c of cellsOf(altarB)) s.grid[indexOf(s, c.x, c.y)] = altarB;
  refreshCity(s);
  return s;
}

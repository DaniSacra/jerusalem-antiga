import { RULES } from './data';
import { indexOf } from './grid';
import { entranceCell, generateTerrain, startRoad } from './map';
import { refreshCity } from './refresh';
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
    coverage: { well: [], market: [], sacred: [] },
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
    nextId: 1,
  };
  for (const c of startRoad()) s.roads[indexOf(s, c.x, c.y)] = true;
  const altarB = { id: s.nextId++, kind: 'altar' as const, x: altar.x, y: altar.y, size: 1, level: 0, upStreak: 0, downStreak: 0, connected: true };
  s.buildings.push(altarB);
  s.grid[indexOf(s, altar.x, altar.y)] = altarB;
  refreshCity(s);
  return s;
}

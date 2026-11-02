import { RULES } from './data';
import type { Season } from './types';

export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

/** Season of a month (0-based); the game starts in spring. */
export const seasonOf = (month: number): Season => SEASONS[Math.floor(month / RULES.monthsPerSeason) % SEASONS.length];

/** True when this month opens a new season (not the first month of the game). */
export const seasonStarts = (month: number) => month > 0 && month % RULES.monthsPerSeason === 0;

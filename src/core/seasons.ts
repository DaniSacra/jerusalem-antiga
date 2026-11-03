import { RULES } from './data';
import type { Season } from './types';

export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

/** Index in `SEASONS` of the season the game starts in. */
/** Weeks in a year (four seasons). */
export const WEEKS_PER_YEAR = RULES.weeksPerSeason * SEASONS.length;

export const START_SEASON = SEASONS.indexOf(RULES.startSeason);

/** Seasons since spring of the year before the game, so `% 4` gives the season (0-based weeks). */
export const seasonCount = (week: number) => Math.floor(week / RULES.weeksPerSeason) + START_SEASON;

/** Season of a week (0-based); the game starts in `RULES.startSeason`. */
export const seasonOf = (week: number): Season => SEASONS[seasonCount(week) % SEASONS.length];

/** True when this week opens a new season (not the first week of the game). */
export const seasonStarts = (week: number) => week > 0 && week % RULES.weeksPerSeason === 0;

import { calendar, canWork, childrenOf, clanName, died, HOUSE_LEVELS, jobOptions, jobsOf, personById, type AgeBand, type GameState, type Person } from '../../core';
import { T } from '../strings';
import { ageNow, bandOf, jobChoices, jobText } from './people';

/** The person sheet as data (pure): name, family, age, work, house, origin and relatives. */

/** One relative button: who, and how they are shown (dead or gone: grey with "† aos 71" / "foi embora no Ano 4"). */
export interface Kin {
  id: number;
  label: string;
  dim: boolean;
}

/** Everything the sheet shows, as plain data (the sheet is rebuilt only when it changes). */
export interface SheetView {
  id: number;
  title: string;
  clan: string;
  band: AgeBand;
  sex: Person['sex'];
  dim: boolean;
  age: string;
  job: string | null;
  /** An adult living here can change job ("Mudar"): the free jobs and "Sem trabalho" (empty: none free). */
  choices: { id: number | null; label: string }[] | null;
  house: { id: number; name: string } | null;
  origin: string;
  rows: { label: string; kin: Kin[] }[];
}

/** Year of a week tick (from 1). */
const yearAt = (week: number) => calendar(week).year;

/** How a relative is named on its button. */
function kinOf(s: GameState, p: Person): Kin {
  const N = T.nova.people;
  const end = p.end;
  const label = !end ? p.name : died(p) ? `${p.name} · ${N.dead(ageNow(s, p))}` : `${p.name} · ${N.gone(yearAt(end.week))}`;
  return { id: p.id, label, dim: !!end };
}

/** The sheet's data for a person alive or in the records. */
export function sheetOf(s: GameState, p: Person): SheetView {
  const N = T.nova.people;
  const father = personById(s, p.fatherId);
  const mother = personById(s, p.motherId);
  const parent = father ?? mother;
  const band = bandOf(s, p);
  const end = p.end;
  const age = !end ? N.age(ageNow(s, p), N.band(band, p.sex)) : died(p) ? N.dead(ageNow(s, p)) : N.gone(yearAt(end.week));
  const home = !end && p.houseId !== null ? s.buildings.find((b) => b.id === p.houseId) : undefined;
  const origin = p.caravan === null ? N.born(yearAt(p.birthWeek)) : p.caravan === 0 ? N.founder : N.caravan(yearAt(s.caravans[p.caravan - 1]?.week ?? 0));
  const rows: SheetView['rows'] = [];
  const parents = [father, mother].filter((o): o is Person => !!o);
  if (parents.length) rows.push({ label: N.parents, kin: parents.map((o) => kinOf(s, o)) });
  const spouse = personById(s, p.spouseId);
  if (spouse) {
    const state = p.engaged !== null ? 'engaged' : died(spouse) && !end ? 'widow' : 'married';
    rows.push({ label: N.spouse(state, p.sex), kin: [kinOf(s, spouse)] });
  }
  const kids = childrenOf(s, p.id).sort((a, b) => a.birthWeek - b.birthWeek);
  if (kids.length) rows.push({ label: N.children, kin: kids.map((o) => kinOf(s, o)) });
  return {
    id: p.id,
    title: parent ? N.childOf(p.name, p.sex, parent.name) : p.name,
    clan: N.clan(clanName(p.clan)),
    band,
    sex: p.sex,
    dim: !!end,
    age,
    // The sheet has room to say why: every job taken (the house's list keeps it short).
    job: end ? null : canWork(s, p) && p.jobId == null && !jobOptions(s, p.id).length ? T.nova.people.noJobFull : jobText(s, p, jobsOf(s)),
    choices: !end && canWork(s, p) ? jobChoices(s, p) : null,
    house: home ? { id: home.id, name: HOUSE_LEVELS[home.level]?.name ?? '' } : null,
    origin,
    rows,
  };
}

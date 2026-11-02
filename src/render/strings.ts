import { BUILDINGS, canRotate, dimsOf, RULES, unlockingGoal, type Alert, type BuildingKind, type Craft, type Economy, type FailReason, type Feature, type GoalDef, type Ground, type NeedKind, type Placeable } from '../core';
import { toolName, type Tool } from './tools';

export const T = {
  title: 'Jerusalém Antiga',
  start: 'Começar',
  howTo: [
    'Construa casas e campos ao lado das ruas do altar. Campos dão comida e trabalho.',
    'Poço, mercado e o altar perto fazem as casas crescerem.',
    'Cumpra as metas e construa o Templo. Não deixe a cidade em dívida!',
  ],
  controls: 'Mover: arraste ou dois dedos  ·  Zoom: pinça ou roda  ·  Girar: ↺ ↻',
  cityName: 'Jerusalém',
  speed: (v: number) => (v === 0 ? '❚❚' : `${v}x`),
  perMonth: '/mês',
  noJobs: '—',
  idle: (n: number) => `+${n} sem vaga`,
  allGoals: 'Todas as metas cumpridas!',
  goalBanner: (n: number, goal: GoalDef, progress: number) => `${n}. ${goal.text}  ${Math.min(progress, goal.target)}/${goal.target}`,
  /** Info line after tapping the goal banner. */
  goalInfo: (n: number, total: number, goal: GoalDef, progress: number) =>
    [
      `Meta ${n} de ${total}: ${goal.text}`,
      `${Math.min(progress, goal.target)} de ${goal.target}`,
      goal.victory ? 'vitória' : `prêmio +${goal.reward} prata`,
      ...(goal.unlock ? [`libera ${toolName(goal.unlock)}`] : []),
    ].join('  ·  '),
  famine: 'Falta comida: construa campos',
  looseRoad: 'Esta rua não está ligada ao altar',
  noWorkers: 'Sem trabalhadores: faltam moradores',
  noTempleSpot: `Sem espaço para o templo: abra uma rua ao lado de um terreno livre ${dimsOf('temple').w} x ${dimsOf('temple').h}`,
  fail: {
    silver: 'Prata insuficiente',
    debt: 'A cidade está em dívida: nada pode ser construído',
    invalid: 'Local inválido',
    noRoad: 'O Templo precisa encostar numa rua ligada ao altar',
    protected: 'O altar e o templo não podem ser demolidos',
    locked: 'Ainda bloqueado',
  } satisfies Record<FailReason, string>,
  goalDone: (reward: number, unlock?: Placeable) =>
    `Meta cumprida! +${reward} prata` + (unlock ? ` · Nova construção: ${toolName(unlock)}` : ''),
  /** Extra message when a goal unlocks a building, explaining what it is for. */
  unlocked: { workshop: `Oficina liberada: ${BUILDINGS.workshop.jobs} vagas e ${BUILDINGS.workshop.silver} de prata/mês` } as Partial<Record<Placeable, string>>,
  alert: (a: Alert): string => {
    if (a.kind === 'debt')
      return a.famine
        ? `Em dívida e com fome: demolir serviços para juntar prata para um campo · ${months(a.monthsLeft)}`
        : `A cidade está em dívida! ${months(a.monthsLeft)} para ser abandonada`;
    if (a.kind === 'deficit')
      return `Saldo ${signed(a.balance)}/mês · maior custo: ${BUILDINGS[a.costliest].name} (${fmt(a.upkeep)}/mês) · demolir serviços que atendem poucas casas`;
    return `${a.count} pessoas sem trabalho: construa uma oficina ou um campo`;
  },
  debtStart: 'A cidade entrou em dívida! Toque na prata para ver os gastos',
  debtEnd: 'A cidade saiu da dívida!',
  /** Info line when the silver is tapped: where it comes from and where it goes. */
  silverBreakdown: (e: Economy): string => {
    // Fixed kind order (buildings.json), so the parts never shuffle between games.
    const each = (r: Partial<Record<BuildingKind, number>>, sign: string) =>
      (Object.keys(BUILDINGS) as BuildingKind[]).filter((k) => r[k] !== undefined).map((k) => `${BUILDINGS[k].name} ${sign}${fmt(r[k]!)}`);
    const costs = each(e.upkeep, '−');
    return [
      `Impostos +${fmt(e.taxes)}`,
      ...each(e.production, '+'),
      ...(costs.length ? [`Manutenção: ${costs.join(', ')}`] : []),
      `Saldo ${signed(e.silverDelta)}/mês`,
    ].join('  ·  ');
  },
  upkeep: (n: number) => `manutenção ${fmt(n)}/mês`,
  craft: {
    pottery: 'Olaria',
    smithy: 'Ferraria',
    carpentry: 'Carpintaria',
    weaving: 'Tecelagem',
    dyeing: 'Tinturaria',
    tannery: 'Curtume',
  } satisfies Record<Craft, string>,
  victoryTitle: 'Vitória!',
  victoryText: (months: number, residents: number) =>
    `O Templo foi construído em ${months} ${months === 1 ? 'mês' : 'meses'}, com ${residents} moradores.`,
  keepBuilding: 'Continuar construindo',
  defeatTitle: 'Jerusalém foi abandonada',
  defeatText: (monthsPlayed: number, peak: number) =>
    `A cidade ficou ${RULES.debtMonthsToLose} meses em dívida. Você jogou ${months(monthsPlayed)} e chegou a ${peak} moradores.`,
  retry: 'Tentar de novo',
  lockedCost: (n: number) => `Meta ${n}`,
  lockedHint: (kind: Placeable) => `${toolName(kind)}: liberado ao cumprir a Meta ${unlockingGoal(kind)}.`,
  ground: { sand: 'Areia', grass: 'Grama seca', river: 'Rio' } satisfies Record<Ground, string>,
  feature: { rock: 'Rocha', palm: 'Palmeira', olive: 'Oliveira' } satisfies Record<Feature, string>,
  need: { road: 'Rua', well: 'Poço', market: 'Mercado', sacred: 'Altar ou Templo' } satisfies Record<NeedKind, string>,
};

const months = (n: number) => `${n} ${n === 1 ? 'mês' : 'meses'}`;

/** Formats a number with up to one decimal, Brazilian style. */
export function fmt(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',');
}

export const signed = (n: number) => (n < 0 ? '−' : '+') + fmt(Math.abs(n));

/** Title of the info line when a tool is picked: name, cost and upkeep. */
export function toolHead(tool: Tool): string {
  if (tool === 'view') return 'Ver';
  if (tool === 'clear') return `Limpar · árvore ${RULES.treeClearCost} prata`;
  if (tool === 'road') return `Rua · ${RULES.roadCost} prata por célula`;
  const d = BUILDINGS[tool];
  return `${d.name} · ${d.cost} prata${d.upkeep ? ` · ${d.upkeep}/mês` : ''}`;
}

/** What the tool does, after its title in the info line. */
export function toolHint(tool: Tool): string {
  if (tool === 'view') return 'Toque para ver detalhes. Arraste para mover o mapa.';
  if (tool === 'clear') return 'Remove construções e ruas sem reembolso. Pode arrastar.';
  if (tool === 'road') return 'Ligue as construções ao altar. Arraste para construir.';
  const d = BUILDINGS[tool];
  const parts: string[] = [];
  if (tool === 'house') parts.push('terreno para uma família, ao lado de uma rua. Pode arrastar');
  const { w, h } = dimsOf(tool);
  if (w > 1 || h > 1) parts.push(`ocupa ${w}x${h}`);
  if (canRotate(tool)) parts.push('toque de novo no botão ou R para girar');
  if (d.jobs) parts.push(`${d.jobs} vagas`);
  const made = [d.food && `${d.food} de comida`, d.silver && `${d.silver} de prata`].filter(Boolean);
  if (made.length) parts.push(`produz ${made.join(' e ')}${T.perMonth}`);
  if (d.radius) parts.push(`raio ${d.radius}`);
  if (tool === 'temple') parts.push('precisa encostar numa rua; os lugares possíveis ficam verdes');
  if (tool === 'field') parts.push('pode arrastar');
  const body = parts.join(' · ');
  return body.charAt(0).toUpperCase() + body.slice(1) + '.';
}

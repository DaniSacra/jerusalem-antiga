import { BUILDINGS, canRotate, dimsOf, RULES, unlockingGoal, type Alert, type BuildingKind, type Craft, type Economy, type FailReason, type Feature, type Ground, type NeedKind, type Placeable } from '../core';
import { toolName, type Tool } from './tools';

export const T = {
  title: 'Jerusalém Antiga',
  start: 'Começar',
  howTo: [
    'Construa casas e campos encostados nas ruas do altar.',
    'Poço, mercado e o altar perto fazem as casas crescerem.',
    'Cumpra as metas e construa o Templo. Não deixe a cidade em dívida!',
  ],
  controls: 'Mover: arraste ou dois dedos  ·  Zoom: pinça ou roda  ·  Girar: ↺ ↻',
  silver: 'Prata',
  food: 'Comida',
  residents: 'Moradores',
  work: 'Trabalho',
  month: 'Mês',
  goal: 'Meta',
  speed: (v: number) => (v === 0 ? '❚❚ Pausa' : `${v === 1 ? '▶' : '▶▶'} ${v}x`),
  perMonth: '/mês',
  noJobs: '—',
  idle: (n: number) => `+${n} sem vaga`,
  allGoals: 'Todas as metas cumpridas!',
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
  unlocked: { workshop: 'Oficina liberada! Ela dá trabalho ao povo e rende prata.' } as Partial<Record<Placeable, string>>,
  alert: (a: Alert): string => {
    if (a.kind === 'debt')
      return a.famine
        ? `Em dívida e com fome: demolir serviços para juntar prata para um campo · ${months(a.monthsLeft)}`
        : `A cidade está em dívida! ${months(a.monthsLeft)} para ser abandonada`;
    if (a.kind === 'deficit')
      return `Saldo ${signed(a.balance)}/mês · maior custo: ${BUILDINGS[a.costliest].name} (${fmt(a.upkeep)}/mês) · demolir serviços que atendem poucas casas`;
    return `${a.count} pessoas sem trabalho: construa uma oficina`;
  },
  debtStart: 'A cidade entrou em dívida! Toque na prata para ver os gastos',
  debtEnd: 'A cidade saiu da dívida!',
  /** Info line when the silver is tapped: where it comes from and where it goes. */
  silverBreakdown: (e: Economy): string => {
    const costs = (Object.entries(e.upkeep) as [BuildingKind, number][]).map(([k, v]) => `${BUILDINGS[k].name} −${fmt(v)}`);
    return [`Impostos +${fmt(e.taxes)}`, `Oficinas +${fmt(e.workshops)}`, ...costs, `Saldo ${signed(e.silverDelta)}/mês`].join('  ·  ');
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
  treeCost: `árvore ${RULES.treeClearCost}`,
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

export function toolHint(tool: Tool): string {
  if (tool === 'view') return 'Ver: toque para ver detalhes. Arraste para mover o mapa.';
  if (tool === 'clear') return `Limpar: remove construções e ruas sem reembolso. Cortar árvore custa ${RULES.treeClearCost} prata. Pode arrastar.`;
  if (tool === 'road') return `Rua (${RULES.roadCost} prata por célula): ligue as construções ao altar. Arraste para construir.`;
  const d = BUILDINGS[tool];
  const parts = [`${d.name} (${d.cost} prata${d.upkeep ? `, ${d.upkeep}/mês` : ''})`];
  if (tool === 'house') parts.push('terreno para uma família. Ao lado de uma rua. Pode arrastar');
  const { w, h } = dimsOf(tool);
  if (w > 1 || h > 1) parts.push(`ocupa ${w}x${h}`);
  if (canRotate(tool)) parts.push('toque de novo no botão ou tecla R para girar');
  if (d.jobs) parts.push(`${d.jobs} vagas`);
  if (d.food) parts.push(`produz ${d.food} de comida por mês`);
  if (d.silver) parts.push(`produz ${d.silver} de prata por mês`);
  if (d.radius) parts.push(`raio ${d.radius}`);
  if (tool === 'temple') parts.push('precisa encostar numa rua; os lugares possíveis ficam verdes');
  if (tool === 'field') parts.push('pode arrastar');
  return parts.join(' · ') + '.';
}

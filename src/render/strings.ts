import { BUILDINGS, RULES, unlockingGoal, type FailReason, type Feature, type Ground, type NeedKind, type Placeable } from '../core';
import { toolName, type Tool } from './tools';

export const T = {
  title: 'Jerusalém Antiga',
  start: 'Começar',
  howTo: [
    'A cidade começa no altar. Construa ruas ligadas a ele.',
    'Toda construção precisa encostar numa rua ligada ao altar.',
    'Casas recebem famílias que chegam pela entrada da cidade, ao sul.',
    'Campos dão comida. Poço, mercado e o raio do altar fazem as casas crescerem.',
    'Cumpra as metas e construa o Templo para vencer.',
    'Ver: arraste para mover o mapa. Construindo: dois dedos ou botão direito movem. Pinça ou roda: zoom.',
  ],
  silver: 'Prata',
  food: 'Comida',
  residents: 'Moradores',
  work: 'Trabalho',
  month: 'Mês',
  goal: 'Meta',
  pause: 'Pausa',
  perMonth: '/mês',
  allGoals: 'Todas as metas cumpridas!',
  famine: 'Falta comida: construa campos',
  fail: {
    silver: 'Prata insuficiente',
    invalid: 'Local inválido',
    noRoad: 'O Templo precisa encostar numa rua ligada ao altar',
    protected: 'O altar e o templo não podem ser demolidos',
    locked: 'Ainda bloqueado',
  } satisfies Record<FailReason, string>,
  goalDone: (reward: number, unlock?: Placeable) =>
    `Meta cumprida! +${reward} prata` + (unlock ? ` · Nova construção: ${toolName(unlock)}` : ''),
  victoryTitle: 'Vitória!',
  victoryText: (months: number, residents: number) =>
    `O Templo foi construído em ${months} ${months === 1 ? 'mês' : 'meses'}, com ${residents} moradores.`,
  keepBuilding: 'Continuar construindo',
  lockedCost: (n: number) => `Meta ${n}`,
  lockedHint: (kind: Placeable) => `${toolName(kind)}: liberado ao cumprir a Meta ${unlockingGoal(kind)}.`,
  treeCost: `árvore ${RULES.treeClearCost}`,
  ground: { sand: 'Areia', grass: 'Grama seca', river: 'Rio' } satisfies Record<Ground, string>,
  feature: { rock: 'Rocha', palm: 'Palmeira', olive: 'Oliveira' } satisfies Record<Feature, string>,
  need: { road: 'Rua', well: 'Poço', market: 'Mercado', sacred: 'Altar ou Templo' } satisfies Record<NeedKind, string>,
};

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
  const parts = [`${d.name} (${d.cost} prata)`];
  if (tool === 'house') parts.push('terreno para uma família. Ao lado de uma rua. Pode arrastar');
  if (d.size) parts.push(`ocupa ${d.size}x${d.size}`);
  if (d.jobs) parts.push(`${d.jobs} vagas`);
  if (d.food) parts.push(`produz ${d.food} de comida por mês`);
  if (d.silver) parts.push(`produz ${d.silver} de prata por mês`);
  if (d.radius) parts.push(`raio ${d.radius}`);
  if (tool === 'temple') parts.push('precisa encostar numa rua');
  if (tool === 'field') parts.push('pode arrastar');
  return parts.join(' · ') + '.';
}

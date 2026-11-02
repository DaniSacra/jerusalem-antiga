import { BUILDINGS, RULES, unlockingGoal, type BuildingKind, type ServiceKind } from '../core';
import type { Tool } from './tools';

export const T = {
  title: 'Jerusalém Antiga',
  view: 'Ver',
  clear: 'Limpar',
  start: 'Começar',
  howTo: [
    'Construa casas e espere as famílias chegarem.',
    'Campos dão comida. Poço, mercado e altar fazem as casas crescerem.',
    'Casas melhores têm mais moradores e pagam mais impostos.',
    'Cumpra as metas e chegue a 200 moradores.',
    'Dica: arraste para construir várias casas ou campos de uma vez.',
  ],
  silver: 'Prata',
  food: 'Comida',
  residents: 'Moradores',
  work: 'Trabalho',
  month: 'Mês',
  goal: 'Meta',
  speed: 'Velocidade',
  pause: 'Pausa',
  perMonth: '/mês',
  allGoals: 'Todas as metas cumpridas!',
  noSilver: 'Prata insuficiente',
  invalid: 'Local inválido',
  famine: 'Falta comida: construa campos',
  goalDone: (reward: number, unlock?: BuildingKind) =>
    `Meta cumprida! +${reward} prata` + (unlock ? ` · Nova construção: ${BUILDINGS[unlock].name}` : ''),
  victoryTitle: 'Vitória!',
  victoryText: (months: number) => `Sua cidade chegou a 200 moradores em ${months} ${months === 1 ? 'mês' : 'meses'}.`,
  keepBuilding: 'Continuar construindo',
  lockedCost: (n: number) => `Meta ${n}`,
  lockedHint: (kind: BuildingKind) => `${BUILDINGS[kind].name}: liberado ao cumprir a Meta ${unlockingGoal(kind)}.`,
  treeCost: `árvore ${RULES.treeClearCost}`,
  terrain: {
    grass: 'Grama: livre para construir',
    rock: 'Rocha: não dá para construir aqui',
    tree: `Oliveira: use Limpar para cortar (${RULES.treeClearCost} prata)`,
    valley: 'Vale do Cedrom: não dá para construir aqui',
  },
  needName: (k: ServiceKind) => BUILDINGS[k].name,
};

/** Formats a number with up to one decimal, Brazilian style. */
export function fmt(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',');
}

export const signed = (n: number) => (n < 0 ? '−' : '+') + fmt(Math.abs(n));

export function toolHint(tool: Tool): string {
  if (tool === 'view') return 'Ver: toque no mapa para ver os detalhes de cada lugar.';
  if (tool === 'clear') return `Limpar: remove construções sem reembolso. Cortar oliveira custa ${RULES.treeClearCost} prata. Pode arrastar.`;
  const d = BUILDINGS[tool];
  const parts = [`${d.name} (${d.cost} prata)`];
  if (tool === 'house') parts.push('terreno onde uma família vem morar. Pode arrastar');
  if (d.jobs) parts.push(`${d.jobs} vagas de trabalho`);
  if (d.food) parts.push(`produz ${d.food} de comida por mês`);
  if (d.silver) parts.push(`produz ${d.silver} de prata por mês`);
  if (d.radius) parts.push(`atende casas num raio de ${d.radius}`);
  if (tool === 'field') parts.push('pode arrastar');
  return parts.join(' · ') + '.';
}

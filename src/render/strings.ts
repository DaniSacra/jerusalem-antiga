import { BUILDINGS, canRotate, dimsOf, RULES, unlockingGoal, type Alert, type BuildableKind, type BuildingCategory, type BuildingKind, type Craft, type Economy, type FailReason, type Feature, type GoalDef, type Ground, type HappinessPart, type Mood, type NeedKind, type Placeable, type Season, type TutorialStepId } from '../core';
import { toolName, type Tool } from './tools';

export const T = {
  title: 'Jerusalém Antiga',
  start: 'Começar',
  howTo: [
    'Construa casas e campos ao lado das ruas do altar. Campos dão comida e trabalho.',
    'Poço, mercado e o altar perto fazem as casas crescerem.',
    'Cumpra os objetivos e construa o Templo. Não deixe a cidade em dívida!',
  ],
  controls: 'Mover: arraste ou dois dedos  ·  Zoom: pinça ou roda  ·  Girar: ↺ ↻',
  cityName: 'Jerusalém',
  install: 'Instalar app',
  installIos: 'Para instalar: toque em Compartilhar e depois em "Adicionar à Tela de Início"',
  options: {
    title: 'Configurações',
    ui: (mode: 'nova' | 'classic') => `Interface: ${mode === 'nova' ? 'Nova' : 'Clássica'}`,
    dayNight: (on: boolean) => `Dia e noite: ${on ? 'ligado' : 'desligado'}`,
    miniature: (on: boolean) => `Efeito maquete: ${on ? 'ligado' : 'desligado'}`,
    miniatureSlow: 'Efeito maquete: desligado (aparelho lento)',
  },
  season: { spring: 'primavera', summer: 'verão', autumn: 'outono', winter: 'inverno' } satisfies Record<Season, string>,
  /** Toast when a season begins. */
  seasonStart: {
    spring: 'Chegou a primavera: as amendoeiras florescem',
    summer: 'Chegou o verão: dias quentes e secos',
    autumn: 'Chegou o outono: as primeiras chuvas',
    winter: 'Chegou o inverno: frio e chuva',
  } satisfies Record<Season, string>,
  /** Mark on the plaque during a summer drought (looks only). */
  drought: 'Seca',
  /** Name under the turn arrows. */
  turn: 'Girar',
  speed: (v: number) => (v === 0 ? '❚❚' : `${v}x`),
  perMonth: '/sem',
  noJobs: '—',
  idle: (n: number) => `+${n} sem vaga`,
  allGoals: 'Todos os objetivos cumpridos!',
  goalBanner: (n: number, goal: GoalDef, progress: number) => `${n}. ${goal.text}  ${Math.min(progress, goal.target)}/${goal.target}`,
  /** Info line after tapping the goal banner. */
  goalInfo: (n: number, total: number, goal: GoalDef, progress: number) =>
    [
      `Objetivo ${n} de ${total}: ${goal.text}`,
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
    `Objetivo cumprido! +${reward} prata` + (unlock ? ` · Nova construção: ${toolName(unlock)}` : ''),
  /** Extra message when a goal unlocks a building, explaining what it is for. */
  unlocked: {
    workshop: `Oficina liberada: ${BUILDINGS.workshop.jobs} vagas e ${BUILDINGS.workshop.silver} de prata por semana`,
    garden: 'Jardim liberado: casas felizes pagam mais imposto e atraem famílias',
  } as Partial<Record<Placeable, string>>,
  alert: (a: Alert): string => {
    if (a.kind === 'debt')
      return a.famine
        ? `Em dívida e com fome: demolir serviços para juntar prata para um campo · ${weeks(a.monthsLeft)}`
        : `A cidade está em dívida! ${weeks(a.monthsLeft)} para ser abandonada`;
    if (a.kind === 'deficit')
      return `Saldo ${signed(a.balance)}/sem · maior custo: ${BUILDINGS[a.costliest].name} (${fmt(a.upkeep)}/sem) · demolir serviços que atendem poucas casas`;
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
      `Saldo ${signed(e.silverDelta)}/sem`,
    ].join('  ·  ');
  },
  upkeep: (n: number) => `manutenção ${fmt(n)}/sem`,
  /** Before goal 2 no upkeep is charged yet. */
  upkeepLater: (n: number) => `manutenção ${fmt(n)}/sem depois do Objetivo ${RULES.upkeepStartsAfterGoal}`,
  upkeepStart: 'A partir de agora, poços, campos, mercados e oficinas custam prata por semana. Fique de olho no saldo.',
  /** Preview of a well, market or garden: houses with a family inside its radius. */
  serves: (n: number) => `Atende ${n} ${n === 1 ? 'casa' : 'casas'}`,
  tutorial: {
    step: {
      road: 'Puxe uma rua saindo do altar, pelo caminho marcado',
      houses: 'Construa 3 casas encostadas na rua, nos lugares verdes',
      family: 'Uma família está chegando!',
      field: 'Construa um campo para o povo comer',
      well: 'Construa um poço perto das tendas',
      grow: 'Veja: as tendas perto do poço viram casas de barro',
      upkeep: 'A partir de agora, poços, campos, mercados e oficinas custam prata por semana. Fique de olho no saldo.',
      market: 'Casas de barro com mercado perto viram casas de pedra',
    } satisfies Record<TutorialStepId, string>,
    pick: (tool: Tool) => `Toque em ${toolName(tool)}`,
    skip: 'Pular tutorial',
    ok: 'Entendi',
    again: 'Ver tutorial de novo',
    done: 'Muito bem! Agora siga os objetivos no alto da tela',
    locked: 'Siga o tutorial, ou toque em Pular tutorial',
  },
  mood: { happy: 'feliz', neutral: 'contente', sad: 'triste' } satisfies Record<Mood, string>,
  happinessPart: {
    sacred: 'Altar',
    garden: 'Jardim',
    well: 'Poço',
    market: 'Mercado',
    famine: 'Fome',
    idle: 'Desemprego',
  } satisfies Record<HappinessPart['kind'], string>,
  /** Info line when the happiness is tapped: moods, effects and what changes them. */
  happinessBreakdown: (e: Economy): string =>
    [
      `Alegria ${e.happiness}`,
      `${e.moods.happy} felizes, ${e.moods.neutral} contentes, ${e.moods.sad} tristes`,
      'Feliz paga mais imposto e atrai famílias',
      'Jardim e altar alegram; fome e desemprego entristecem',
    ].join('  ·  '),
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
    `O Templo foi construído em ${weeks(months)}, com ${residents} moradores.`,
  keepBuilding: 'Continuar construindo',
  defeatTitle: 'Jerusalém foi abandonada',
  defeatText: (monthsPlayed: number, peak: number) =>
    `A cidade ficou ${weeks(RULES.debtMonthsToLose)} em dívida. Você jogou ${weeks(monthsPlayed)} e chegou a ${peak} moradores.`,
  retry: 'Tentar de novo',
  lockedCost: (n: number) => `Objetivo ${n}`,
  lockedHint: (kind: Placeable) => `${toolName(kind)}: ${FEMININE.has(kind) ? 'liberada' : 'liberado'} ao cumprir o Objetivo ${unlockingGoal(kind)}.`,
  ground: { sand: 'Areia', grass: 'Grama seca', river: 'Rio' } satisfies Record<Ground, string>,
  /** Olive cells are drawn as olive, almond or fig trees (see treeKind). */
  feature: { rock: 'Rocha', palm: 'Palmeira', olive: 'Oliveira', almond: 'Amendoeira', fig: 'Figueira' } satisfies Record<Feature | 'almond' | 'fig', string>,
  need: { road: 'Rua', well: 'Poço', market: 'Mercado', sacred: 'Altar ou Templo', garden: 'Jardim' } satisfies Record<NeedKind, string>,
  /** Interface Nova (drafts for the copywriter). */
  nova: {
    level: 'NÍVEL',
    silver: 'Prata',
    food: 'Comida',
    residents: 'Moradores',
    happiness: 'Alegria',
    perWeek: '/sem',
    /** Where the food runs out at this pace (PC food pill). */
    foodUntil: { spring: 'até a primavera', summer: 'até o verão', autumn: 'até o outono', winter: 'até o inverno' } satisfies Record<Season, string>,
    goal: 'Objetivo',
    goalOf: (n: number, total: number) => `Objetivo ${n} de ${total}`,
    progress: (p: number, target: number) => `${Math.min(p, target)}/${target}`,
    seasonName: { spring: 'Primavera', summer: 'Verão', autumn: 'Outono', winter: 'Inverno' } satisfies Record<Season, string>,
    calendar: (season: Season, year: number, week: number, long: boolean) =>
      `${T.nova.seasonName[season]} · Ano ${year} · ${long ? 'Semana' : 'Sem'} ${week}`,
    /** Name of a bottom tool, with its key on PC ("Mover · 1"). */
    withKey: (name: string, key: string) => `${name} · ${key}`,
    /** Price and key inside a PC column button. */
    costKey: (cost: number, key: string) => `${cost} · tecla ${key}`,
    lockedGoal: (n: number) => `objetivo ${n}`,
    unlocksAt: (n: number) => `Libera no objetivo ${n}`,
    newBadge: 'novo',
    category: { home: 'Moradia', supply: 'Água e comida', work: 'Trabalho', special: 'Especiais' } satisfies Record<BuildingCategory, string>,
    /** Balloon of the chosen building: price and upkeep per week. */
    price: (cost: number, upkeep: number, charged: boolean) =>
      upkeep ? `${cost} prata · ${upkeep} por semana${charged ? '' : ` depois do Objetivo ${RULES.upkeepStartsAfterGoal}`}` : `${cost} prata`,
    jobs: (n: number) => `${n} ${n === 1 ? 'vaga' : 'vagas'}`,
    reach: (n: number) => `alcance ${n}`,
    balanceAfter: (n: number) => `Saldo depois: ${signed(n)}/sem`,
    /** What each building is for, in one sentence. */
    effect: {
      house: 'Terreno para uma família. Cresce com poço, mercado e o altar por perto.',
      field: 'Dá comida e trabalho. Pode arrastar.',
      well: 'Tendas com poço por perto viram casas de barro.',
      market: 'Casas de barro com mercado por perto viram casas de pedra.',
      workshop: 'Dá trabalho e prata.',
      garden: 'Alegra as casas por perto: pagam mais imposto e atraem famílias.',
      temple: 'Construa o Templo para vencer. Precisa encostar numa rua.',
    } satisfies Record<BuildableKind, string>,
    /** Tip of the bottom tools when picked. */
    tip: {
      road: `Rua · ${RULES.roadCost} prata por trecho. Arraste a partir de uma rua ligada ao altar.`,
      clear: `Demolir · sem reembolso. Toque ou arraste sobre o que quer tirar.`,
    },
    cutTree: `Cortar árvore · ${RULES.treeClearCost} prata`,
    buttons: { goals: 'Objetivos', alerts: 'Avisos', stats: 'Estatísticas', settings: 'Configurações' },
    goals: {
      done: '✓',
      current: '▶',
      next: '○',
      reward: (reward: number) => `+${reward} prata`,
      victory: 'vitória',
      unlocks: (kind: Placeable) => `libera ${toolName(kind)}`,
    },
    noAlerts: 'Nenhum aviso. A cidade vai bem!',
    stats: {
      silver: 'Prata',
      taxes: 'Impostos',
      upkeep: 'Manutenção',
      balance: 'Saldo',
      food: 'Comida',
      made: 'Produção',
      eaten: 'Consumo',
      runsOut: 'Acaba em',
      weeks: (n: number) => `${n} ${n === 1 ? 'semana' : 'semanas'}`,
      never: 'não acaba',
      work: 'Trabalho',
      workers: 'Trabalhadores',
      jobs: 'Vagas',
      idle: 'Sem vaga',
      efficiency: 'Eficiência',
      houses: 'Casas',
      happiness: 'Alegria',
      why: 'Jardim e altar alegram; fome e desemprego entristecem.',
    },
    settings: {
      ui: 'Interface',
      nova: 'Nova',
      classic: 'Clássica',
      turn: 'Girar a visão',
      dayNight: 'Dia e noite',
      miniature: 'Efeito maquete',
      on: 'ligado',
      off: 'desligado',
      slow: 'aparelho lento',
    },
    inspect: {
      next: (cur: string, next: string) => `${cur} → ${next}`,
      top: 'nível máximo',
      residents: (n: number, tax: number) => `${n} moradores · imposto ${fmt(tax)}/sem`,
      evolve: 'Ao evoluir',
      gain: (residents: number, tax: number) => `+${residents} moradores · +${fmt(tax)} de imposto/sem`,
      noRoad: 'sem rua',
      famine: 'fome: não evolui',
      plotNoRoad: 'Sem rua: nenhuma família vai chegar',
      plotComing: 'Uma família está a caminho',
      plotWaiting: 'Esperando uma família',
      plotFamine: 'A fome impede novas famílias',
      happiness: (value: number, mood: Mood, why: string) => `Alegria ${value}, ${T.mood[mood]}${why ? ` (${why})` : ''}`,
      serves: (n: number) => `Atende ${n} ${n === 1 ? 'casa' : 'casas'}`,
      makes: (food: number, silver: number) =>
        `Produz ${[food && `${fmt(food)} de comida`, silver && `${fmt(silver)} de prata`].filter(Boolean).join(' e ')} por semana`,
      upkeep: (n: number, charged: boolean) => `${n} por semana${charged ? '' : ` depois do Objetivo ${RULES.upkeepStartsAfterGoal}`}`,
      connected: 'ligado à rua',
      disconnected: 'sem rua: não funciona, mas paga manutenção',
      noWorkers: 'Sem trabalhadores: faltam moradores',
      efficiency: (pct: number) => `eficiência ${pct}%`,
      altar: 'Centro da cidade, onde as ruas começam.',
      road: (linked: boolean, entrance: boolean) => `${entrance ? 'Rua · entrada da cidade' : 'Rua'} · ${linked ? 'ligada ao altar ✓' : 'não ligada ao altar ✗'}`,
      tree: (name: string) => `${name} · Demolir corta por ${RULES.treeClearCost} prata`,
      rock: (name: string) => `${name} · não dá para construir aqui`,
      where: { well: 'Onde pôr um poço', market: 'Onde pôr um mercado', sacred: 'Onde pôr o templo', road: 'Ligar à rua' },
      noSpot: 'Nenhum lugar livre por perto: abra uma rua ao lado',
      demolish: 'Demolir',
      confirm: 'Certeza?',
      close: 'Fechar',
    },
  },
};

/** Tools with a feminine name (for "liberada"). */
const FEMININE: ReadonlySet<Placeable> = new Set<Placeable>(['road', 'house', 'workshop']);

const weeks = (n: number) => `${n} ${n === 1 ? 'semana' : 'semanas'}`;

/** Formats a number with up to one decimal, Brazilian style. */
export function fmt(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',');
}

export const signed = (n: number) => (n < 0 ? '−' : '+') + fmt(Math.abs(n));

/** Whole number with a dot every three digits ("1.240"), Brazilian style. */
export function fmtInt(n: number): string {
  const v = Math.trunc(n);
  const digits = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (v < 0 ? '−' : '') + digits;
}

/** Title of the info line when a tool is picked: name, cost and upkeep. */
export function toolHead(tool: Tool, upkeepOn = true): string {
  if (tool === 'view') return 'Mover';
  if (tool === 'clear') return `Demolir · árvore ${RULES.treeClearCost} prata`;
  if (tool === 'road') return `Rua · ${RULES.roadCost} prata por célula`;
  const d = BUILDINGS[tool];
  if (!d.upkeep) return `${d.name} · ${d.cost} prata`;
  return `${d.name} · ${d.cost} prata · ${upkeepOn ? `${d.upkeep}/sem` : T.upkeepLater(d.upkeep)}`;
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
  if (tool === 'garden') parts.push('alegra as casas no raio: mais imposto e mais famílias');
  if (tool === 'temple') parts.push('precisa encostar numa rua; os lugares possíveis ficam verdes');
  if (tool === 'field') parts.push('pode arrastar');
  const body = parts.join(' · ');
  return body.charAt(0).toUpperCase() + body.slice(1) + '.';
}

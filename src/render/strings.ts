import { BUILDINGS, dimsOf, foodCapacity, RULES, unlockingGoal, WEEKS_PER_YEAR, type Alert, type BuildableKind, type BuildingCategory, type Craft, type FailReason, type FamilyBlock, type Feature, type GameState, type Ground, type HappinessPart, type MilestoneId, type Mood, type NeedKind, type Placeable, type Season, type TutorialStepId } from '../core';
import { toolName, type Tool } from './tools';

export const T = {
  /** Residents lost when a house goes down (with famine, the cause). */
  houseDown: (delta: number, famine: boolean) => (famine ? `Fome ${delta}` : `${delta}`),
  title: 'Jerusalém Antiga',
  start: 'Começar',
  howTo: [
    'Comida para o inverno: pesque, colete e plante campos no outono.',
    `Dê água às casas com poços. Sem celeiro, só cabem ${RULES.baseFoodStorage} de comida.`,
    'Cumpra os objetivos e construa o Templo. Não deixe a cidade em dívida!',
  ],
  controls: 'Mapa: arraste ou dois dedos  ·  Zoom: pinça ou roda  ·  Girar: ↺ ↻',
  install: 'Instalar app',
  installIos: 'Para instalar: toque em Compartilhar e depois em "Adicionar à Tela de Início"',
  season: { spring: 'primavera', summer: 'verão', autumn: 'outono', winter: 'inverno' } satisfies Record<Season, string>,
  /** Toast when a season begins. */
  seasonStart: {
    spring: 'Chegou a primavera: os campos voltam a dar comida',
    summer: 'Chegou o verão: dias quentes e secos',
    autumn: 'Chegou o outono: hora de plantar os campos',
    winter: 'Inverno: só pescador e coletora dão comida',
  } satisfies Record<Season, string>,
  allGoals: 'Todos os objetivos cumpridos!',
  /** Opening sentence (big toast at the start of a game). */
  caravan: (families: number, foodWeeks: number) => `A caravana chegou com ${families} ${families === 1 ? 'família' : 'famílias'} e comida para ${weeks(foodWeeks)}`,
  /** One sentence when a milestone is reached (toast). */
  milestone: {
    firstFamily: 'Chegou a primeira família nova!',
    firstMud: 'A primeira casa de barro está de pé!',
    firstHarvest: 'Primeira colheita: os campos deram comida!',
    firstWinter: 'Primeiro inverno vencido sem perder ninguém!',
    firstStone: 'A primeira casa de pedra está de pé!',
    yearWithoutFamine: 'Um ano inteiro sem fome!',
  } satisfies Record<MilestoneId, string>,
  /** Milestone names in the statistics list. */
  milestoneName: {
    firstFamily: 'Primeira família',
    firstMud: 'Primeira casa de barro',
    firstHarvest: 'Primeira colheita',
    firstWinter: 'Primeiro inverno vencido',
    firstStone: 'Primeira casa de pedra',
    yearWithoutFamine: 'Primeiro ano sem fome',
  } satisfies Record<MilestoneId, string>,
  /** Why no new family comes (Avisos and the statistics problems). */
  familyBlock: {
    famine: 'Nenhuma família vem: falta comida. Pesque ou colete',
    water: 'Nenhuma família vem: casa longe do poço. Construa outro poço',
    food: 'Nenhuma família vem: a comida não dura até a primavera. Pesque ou colete',
    storage: 'Nenhuma família vem: o estoque está cheio',
    wait: 'Uma nova família pode chegar em breve',
    noPlot: 'Nenhuma família vem: não há casa vazia. Construa uma ao lado da rua',
  } satisfies Record<FamilyBlock, string>,
  /** Why no new family comes; "storage" names the store size and how to get a granary. */
  familyBlockText(block: FamilyBlock, s: GameState): string {
    if (block !== 'storage') return T.familyBlock[block];
    const granary = s.unlocked.includes('granary') ? 'Construa o celeiro' : `O celeiro libera no objetivo ${unlockingGoal('granary')}`;
    return `Nenhuma família vem: o estoque só guarda ${Math.floor(foodCapacity(s))}. ${granary}`;
  },
  familyLeft: 'Uma família foi embora: fome',
  famine: 'Falta comida: construa pescador ou coletora',
  looseRoad: 'Rua solta: ligue-a ao altar',
  noWorkers: 'Sem trabalhadores: faltam moradores',
  noTempleSpot: `Sem espaço para o Templo: abra uma rua ao lado de um terreno livre ${dimsOf('temple').w} x ${dimsOf('temple').h}`,
  fail: {
    silver: 'Prata insuficiente',
    debt: 'Em dívida: não dá para construir',
    invalid: 'Não dá para construir aqui',
    noRoad: 'O Templo precisa encostar numa rua ligada ao altar',
    protected: 'O altar e o templo não podem ser demolidos',
    locked: 'Ainda bloqueado',
  } satisfies Record<FailReason, string>,
  goalDone: (reward: number, unlock?: Placeable) =>
    `Objetivo cumprido! +${reward} prata` + (unlock ? ` · Nova construção: ${toolName(unlock)}` : ''),
  /** Extra message when a goal unlocks a building, explaining what it is for. */
  unlocked: {
    workshop: `Oficina liberada: ${BUILDINGS.workshop.jobs} vagas e ${BUILDINGS.workshop.silver} prata por semana`,
    garden: 'Jardim liberado: casas felizes pagam mais imposto e atraem famílias',
  } as Partial<Record<Placeable, string>>,
  alert: (a: Alert): string => {
    if (a.kind === 'debt')
      return a.famine
        ? `Dívida e fome: demolir serviços corta a manutenção · ${weeks(a.weeksLeft)}`
        : `Em dívida: ${weeks(a.weeksLeft)} para a cidade ser abandonada. Reduza a manutenção`;
    if (a.kind === 'deficit')
      return `Saldo ${signed(a.balance)}/sem · maior custo: ${BUILDINGS[a.costliest].name} (${fmt(a.upkeep)}/sem) · use Demolir em serviços que atendem poucas casas`;
    if (a.kind === 'foodShort') return 'A comida não dura até a primavera: pesque, colete ou plante campos';
    if (a.kind === 'spoiling')
      return a.locked
        ? `Estoque cheio (${a.capacity}): o excesso estraga. O celeiro libera no objetivo ${unlockingGoal('granary')}`
        : 'Comida estragando: construa um celeiro';
    if (a.kind === 'winterComing') return 'O inverno está chegando: com fome, famílias vão embora. Guarde comida';
    if (a.kind === 'drought') return `Ano seco: campos longe do rio colhem ${Math.round(RULES.drought.harvestFactor * 100)}%. Construa pescador ou coletora`;
    return `${a.count} ${a.count === 1 ? 'pessoa' : 'pessoas'} sem trabalho: construa uma oficina ou um campo`;
  },
  debtStart: 'Cidade em dívida: toque na prata',
  debtEnd: 'A cidade saiu da dívida!',
  /** Why a spot is not free (more precise than "invalid"). */
  blocked: {
    edge: 'Fora do mapa',
    river: 'Não dá para construir no rio',
    rock: 'Tem uma rocha aqui',
    tree: 'Tem uma árvore aqui: corte com Demolir',
    taken: 'Já tem uma construção ou rua aqui',
    nothing: 'Nada para demolir aqui',
    rockClear: 'Rochas não podem ser removidas',
  },
  upkeepStart: 'Agora poços, campos e demais construções custam prata por semana',
  /** Preview of a well, market or garden: houses with a family inside its radius. */
  serves: (n: number) => `Atende ${n} ${n === 1 ? 'casa' : 'casas'}`,
  tutorial: {
    step: {
      road: 'Puxe uma rua pelo caminho marcado, até onde há comida',
      gather: 'Construa um pescador junto ao rio ou uma coletora perto das árvores',
      field: 'Construa um campo: ele dá comida já, até o inverno congelar',
      well: 'Construa um poço perto das tendas da caravana',
      house: 'Construa uma casa encostada na rua, perto do poço',
      family: 'Uma família está chegando!',
      upkeep: 'Agora poços, campos e demais construções custam prata por semana',
      market: 'Casas de barro com mercado perto viram casas de pedra',
    } satisfies Record<TutorialStepId, string>,
    pick: (tool: Tool) => `Toque em ${toolName(tool)}`,
    skip: 'Pular tutorial',
    ok: 'Entendi',
    again: 'Rever o tutorial',
    done: 'Muito bem! Agora siga os objetivos no alto da tela',
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
  craft: {
    pottery: 'Olaria',
    smithy: 'Ferraria',
    carpentry: 'Carpintaria',
    weaving: 'Tecelagem',
    dyeing: 'Tinturaria',
    tannery: 'Curtume',
  } satisfies Record<Craft, string>,
  victoryTitle: 'Vitória!',
  victoryText: (played: number, residents: number) =>
    `O Templo foi construído em ${duration(played)}, com ${residents} moradores.`,
  keepBuilding: 'Continuar construindo',
  defeatTitle: 'Jerusalém foi abandonada',
  defeatText: (weeksPlayed: number, peak: number) =>
    `A cidade ficou ${weeks(RULES.debtWeeksToLose)} em dívida. Você jogou ${duration(weeksPlayed)} e chegou a ${peak} moradores.`,
  retry: 'Tentar de novo',
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
    /** When the food runs out: the season, or the weeks left if it is still this season. */
    foodForecast(out: { weeks: number; season: Season }, now: Season): string {
      return out.season === now && out.weeks < RULES.weeksPerSeason ? `acaba em ${out.weeks} sem` : this.foodUntil[out.season];
    },
    /** The food lasts until the next harvest. */
    foodToHarvest: 'até a primavera',
    /** The food pill in a famine, in place of the weeks left. */
    famine: 'FOME',
    /** The season pill in a dry year. */
    drought: 'Seca',
    /** The food pill when the store is nearly full and still filling (the rest would spoil). */
    full: 'cheio',
    /** Phone food pill when the food will not last: the weeks left. */
    foodShortPhone: (n: number) => `⚠ ${n} sem`,
    /** Food kept out of what the stores hold ("38/40"). */
    stock: (food: number, cap: number) => `${food}/${cap}`,
    goal: 'Objetivo',
    goalOf: (n: number, total: number) => `Objetivo ${n} de ${total}`,
    /** `weeks`: the goal counts weeks (food until spring). */
    progress: (p: number, target: number, weeks = false) => `${Math.min(p, target)}/${target}${weeks ? ' sem' : ''}`,
    seasonName: { spring: 'Primavera', summer: 'Verão', autumn: 'Outono', winter: 'Inverno' } satisfies Record<Season, string>,
    calendar: (season: Season, year: number, week: number, long: boolean) =>
      `${T.nova.seasonName[season]} · Ano ${year} · ${long ? 'Semana' : 'Sem'} ${week}`,
    /** The fields' next turn after the calendar ("inverno em 5 sem"); the phone drops the year and week for it. */
    fieldTurn: (turn: { season: 'winter' | 'spring'; weeks: number }) => `${turn.season === 'winter' ? 'inverno' : 'primavera'} em ${turn.weeks} sem`,
    calendarPhone: (season: Season, turn: { season: 'winter' | 'spring'; weeks: number }) => `${T.nova.seasonName[season]} · ${T.nova.fieldTurn(turn)}`,
    /** Name of a bottom tool, with its key on PC ("Mover · 1"). */
    withKey: (name: string, key: string) => `${name} · ${key}`,
    /** Price and key inside a PC column button. */
    costKey: (cost: number, key: string) => `${cost} · tecla ${key}`,
    lockedGoal: (n: number) => `objetivo ${n}`,
    unlocksAt: (n: number) => `Libera no objetivo ${n}`,
    category: { home: 'Moradia', supply: 'Água e comida', work: 'Trabalho', special: 'Especiais' } satisfies Record<BuildingCategory, string>,
    /** Balloon of the chosen building: price and upkeep per week. */
    price: (cost: number, upkeep: number, charged: boolean) =>
      upkeep ? `${cost} prata · ${upkeep} por semana${charged ? '' : ` depois do Objetivo ${RULES.upkeepStartsAfterGoal}`}` : `${cost} prata`,
    jobs: (n: number) => `${n} ${n === 1 ? 'vaga' : 'vagas'}`,
    reach: (n: number) => `alcance ${n}`,
    balanceAfter: (n: number) => `Saldo depois: ${signed(n)}/sem`,
    foodAfter: (n: number) => `Comida depois: ${signed(n)}/sem`,
    /** What each building is for, in one sentence. */
    effect: {
      house: 'Abriga uma família. Cresce com poço, mercado e altar perto.',
      field: 'Dá comida o ano todo, menos no inverno, quando congela. Arraste para fazer vários.',
      well: 'Tendas com poço por perto viram casas de barro.',
      granary: 'Guarda comida da colheita. Sem celeiro, a comida que passa do limite estraga.',
      fisher: 'Pesca no rio: dá comida o ano todo.',
      gatherer: 'Junta frutos das árvores: dá comida o ano todo.',
      market: 'Casas de barro com mercado por perto viram casas de pedra.',
      workshop: 'Dá trabalho e prata.',
      garden: 'Alegra as casas por perto: mais imposto e mais famílias.',
      temple: 'Vence o jogo. Precisa encostar numa rua ligada ao altar.',
    } satisfies Record<BuildableKind, string>,
    /** Tip of the bottom tools when picked. */
    tip: {
      road: `Rua · ${RULES.roadCost} prata por trecho. Arraste a partir de uma rua ligada ao altar.`,
      clear: `Demolir · sem reembolso. Toque ou arraste no que quer tirar.`,
    },
    cutTree: `Cortar árvore · ${RULES.treeClearCost} prata`,
    /** Over the preview of a fisher or gatherer, and in its balloon. */
    yields: (n: number) => `Rende ${fmt(n)} comida/sem`,
    /** Fisher and gatherer rule in the chosen building balloon. */
    gatherRule: (source: 'river' | 'tree', perCell: number, radius: number, max: number) =>
      `${fmt(perCell)} comida por ${source === 'river' ? 'trecho de rio' : 'árvore'} no alcance ${radius}, até ${fmt(max)}/sem`,
    /** Over a field preview and in its balloon. */
    fieldSeasons: 'Dá comida na primavera, no verão e no outono. No inverno congela.',
    stores: (n: number) => `Guarda ${n} de comida`,
    buttons: { goals: 'Objetivos', alerts: 'Avisos', stats: 'Estatísticas', settings: 'Configurações' },
    goals: {
      done: '✓',
      current: '▶',
      next: '○',
      reward: (reward: number) => `+${reward} prata`,
      victory: 'vitória',
      unlocks: (kind: Placeable) => `libera ${toolName(kind)}`,
    },
    noAlerts: 'Nenhum aviso. A cidade vai bem.',
    /** Stats tabs. */
    tabs: { now: 'Agora', history: 'Histórico' },
    stats: {
      silver: 'Prata',
      taxes: 'Impostos',
      upkeep: 'Manutenção',
      balance: 'Saldo',
      food: 'Comida',
      eaten: 'Consumo',
      stock: 'Estoque',
      forecast: 'Previsão',
      toHarvest: 'dura até a colheita',
      problems: 'Problemas',
      none: 'Nenhum',
      milestones: 'Marcos',
      noMilestones: 'Nenhum marco ainda',
      milestoneAt: (name: string, when: string) => `${name} · ${when}`,
      lastWeeks: (n: number) => `Últimas ${n} semanas`,
      noHistory: 'O histórico começa na próxima semana',
      capacity: 'limite',
      residents: 'Moradores',
      weeks: (n: number) => `${n} ${n === 1 ? 'semana' : 'semanas'}`,
      work: 'Trabalho',
      workers: 'Trabalhadores',
      jobs: 'Vagas',
      idle: 'Sem trabalho',
      efficiency: 'Eficiência',
      houses: 'Casas',
      happiness: 'Alegria',
      why: 'Jardim e altar alegram; fome e desemprego entristecem.',
    },
    settings: {
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
      gain: (residents: number, tax: number, food: number) => `+${residents} moradores · +${fmt(tax)} de imposto · come +${fmt(food)}/sem`,
      noRoad: 'sem rua',
      famine: 'fome: não evolui',
      plotNoRoad: 'Sem rua: nenhuma família chega. Ligue à rua',
      plotComing: 'Uma família está a caminho',
      plotWaiting: 'Esperando uma família',
      harvesting: (n: number) => `Colhendo: ${fmt(n)} comida/sem`,
      frozen: (weeks: number) => `Congelado no inverno: volta em ${weeks} sem`,
      droughtRiver: 'Ano seco: junto ao rio, colhe normal',
      droughtDry: 'Ano seco: longe do rio, colhe menos',
      noSource: { river: 'Longe do rio: não pesca nada', tree: 'Sem árvores por perto: não colhe nada' },
      happiness: (value: number, mood: Mood, why: string) => `Alegria ${value}, ${T.mood[mood]}${why ? ` (${why})` : ''}`,
      serves: (n: number) => `Atende ${n} ${n === 1 ? 'casa' : 'casas'}`,
      makes: (silver: number) => `Produz ${fmt(silver)} prata por semana`,
      upkeep: (n: number, charged: boolean) => `${n} por semana${charged ? '' : ` depois do Objetivo ${RULES.upkeepStartsAfterGoal}`}`,
      connected: 'ligado à rua',
      disconnected: 'sem rua: não funciona, mas paga manutenção',
      noWorkers: 'Sem trabalhadores: faltam moradores',
      efficiency: (pct: number) => `eficiência ${pct}%`,
      fewWorkers: (pct: number) => `Faltam trabalhadores: rende ${pct}%`,
      altar: 'Centro da cidade, onde as ruas começam.',
      road: (linked: boolean, entrance: boolean) => `${entrance ? 'Rua · entrada da cidade' : 'Rua'} · ${linked ? 'ligada ao altar ✓' : 'não ligada ao altar ✗'}`,
      tree: (name: string) => `${name} · Demolir corta por ${RULES.treeClearCost} prata`,
      rock: (name: string) => `${name} · não dá para construir aqui`,
      where: { well: 'Onde pôr um poço', market: 'Onde pôr um mercado', sacred: 'Onde pôr o Templo', road: 'Ligar à rua' },
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
/** A play time in years and weeks ("2 anos e 5 semanas"; just the weeks under a year). */
function duration(n: number): string {
  const y = Math.floor(n / WEEKS_PER_YEAR);
  const w = n % WEEKS_PER_YEAR;
  const years = `${y} ${y === 1 ? 'ano' : 'anos'}`;
  return y === 0 ? weeks(w) : w === 0 ? years : `${years} e ${weeks(w)}`;
}

/** Formats a number Brazilian style: up to two decimals below 1 (0,25), else up to one. */
export function fmt(n: number): string {
  const k = Math.abs(n) < 1 ? 100 : 10;
  return String(Math.round(n * k) / k).replace('.', ',');
}

export const signed = (n: number) => (n < 0 ? '−' : '+') + fmt(Math.abs(n));

/** Whole number with a dot every three digits ("1.240"), Brazilian style. */
export function fmtInt(n: number): string {
  const v = Math.trunc(n);
  const digits = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (v < 0 ? '−' : '') + digits;
}

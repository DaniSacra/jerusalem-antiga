import { BUILDINGS, dimsOf, foodCapacity, RULES, unlockingGoal, WEEKS_PER_YEAR, type Alert, type BuildableKind, type BuildingCategory, type Craft, type FailReason, type FamilyBlock, type Feature, type GatherSource, type Product, type GameState, type GoalDef, type Ground, type HappinessPart, type MilestoneId, type Mood, type NeedKind, type Placeable, type Season, type TutorialStepId } from '../core';
import { toolName, type Tool } from './tools';

/** Names of what gathering buildings bring (drafts for the copywriter). */
const PRODUCT: Record<Product, string> = { food: 'comida', wood: 'madeira', stone: 'pedra' };

/** Upkeep begins (toast, or the tutorial step for who did not skip it). */
const UPKEEP_START = 'Começou a manutenção: tudo, menos casas e ruas, custa prata por semana';

/** What a workshop does for the fields ("+10% de comida dos campos, até +30%"). */
const WORKSHOP_BONUS = `+${Math.round((BUILDINGS.workshop.fieldBonus ?? 0) * 100)}% de comida dos campos, até +${Math.round((BUILDINGS.workshop.fieldBonusMax ?? 0) * 100)}%`;

export const T = {
  /** Residents lost when a house goes down (with famine, the cause). */
  houseDown: (delta: number, famine: boolean) => (famine ? `Fome ${delta}` : `${delta}`),
  title: 'Jerusalém Antiga',
  start: 'Começar',
  howTo: [
    'Guarde comida para o inverno: pesque, colete e plante campos.',
    `Tendas perto de uma praça viram casas de barro. Sem celeiro, só cabem ${RULES.baseFoodStorage} de comida.`,
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
    autumn: 'Chegou o outono: guarde comida para o inverno',
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
    food: 'Nenhuma família vem: falta sobra de comida para mais uma família. Pesque ou colete',
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
  /** A dragged road reached a button or panel and stopped there. */
  roadUnderUi: 'A rua parou sob um botão: mova o mapa e continue',
  noWorkers: 'Sem trabalhadores: faltam moradores',
  noTempleSpot: `Sem espaço para o Templo: abra uma rua ao lado de um terreno livre ${dimsOf('temple').w} x ${dimsOf('temple').h}`,
  fail: {
    silver: 'Prata insuficiente',
    materials: 'Falta madeira ou pedra',
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
    workshop: `Oficina liberada: ${BUILDINGS.workshop.jobs} vagas e ${WORKSHOP_BONUS}`,
    park: 'Parque liberado: casas de pedra perto dele viram casas grandes',
  } as Partial<Record<Placeable, string>>,
  alert: (a: Alert): string => {
    if (a.kind === 'debt')
      return a.famine
        ? `Dívida e fome: demolir serviços corta a manutenção · ${weeks(a.weeksLeft)}`
        : `Em dívida: ${weeks(a.weeksLeft)} para a cidade ser abandonada. Reduza a manutenção`;
    if (a.kind === 'deficit')
      return `Saldo ${signed(a.balance)}/sem · maior custo: ${BUILDINGS[a.costliest].name} (${fmt(a.upkeep)}/sem) · use Demolir em serviços que atendem poucas casas`;
    if (a.kind === 'material')
      return `${a.count} ${a.count === 1 ? 'casa esperando' : 'casas esperando'} ${PRODUCT[a.material]}: construa ${a.material === 'wood' ? 'um lenhador' : 'uma pedreira'}`;
    if (a.kind === 'foodShort') return 'A comida não dura até a primavera: pesque, colete ou plante campos';
    if (a.kind === 'spoiling')
      return a.locked
        ? `Estoque cheio (${a.capacity}): o excesso estraga. O celeiro libera no objetivo ${unlockingGoal('granary')}`
        : 'Comida estragando: construa um celeiro';
    if (a.kind === 'winterComing') return 'O inverno está chegando: todos comem mais, nas tendas mais ainda. Guarde comida';
    if (a.kind === 'drought') return `Ano seco: campos longe do rio colhem ${Math.round(RULES.drought.harvestFactor * 100)}%. Construa pescador ou coletora`;
    return `${a.count} ${a.count === 1 ? 'pessoa' : 'pessoas'} sem trabalho: construa ${a.workshopsFull ? 'um lenhador ou uma pedreira' : 'um campo ou uma oficina'}`;
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
  upkeepStart: UPKEEP_START,
  /** Preview of a plaza, market or park: houses with a family inside its radius. */
  serves: (n: number) => `Atende ${n} ${n === 1 ? 'casa' : 'casas'}`,
  tutorial: {
    step: {
      road: 'Puxe uma rua pelo caminho marcado, até onde há comida',
      gather: 'Construa um pescador junto ao rio ou uma coletora perto das árvores',
      field: 'Construa um campo: ele dá comida já, até o inverno congelar',
      plaza: 'Construa uma praça perto das tendas da caravana',
      house: 'Construa uma casa encostada na rua, perto da praça',
      family: 'Uma família está chegando!',
      lumber: 'Casas pedem madeira: construa um lenhador perto das árvores',
      upkeep: UPKEEP_START,
      market: 'Construa um mercado perto das casas de barro: elas viram casas de pedra',
    } satisfies Record<TutorialStepId, string>,
    pick: (tool: Tool) => `Toque em ${toolName(tool)}`,
    skip: 'Pular tutorial',
    ok: 'Entendi',
    again: 'Rever o tutorial',
    done: 'Muito bem! Construa mais casas: cada uma recebe uma família',
  },
  mood: { happy: 'feliz', neutral: 'contente', sad: 'triste' } satisfies Record<Mood, string>,
  happinessPart: {
    sacred: 'Altar',
    park: 'Parque',
    plaza: 'Praça',
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
  lockedHint: (kind: Placeable) => `${toolName(kind)}: libera no objetivo ${unlockingGoal(kind)}`,
  ground: { sand: 'Areia', grass: 'Grama seca', river: 'Rio' } satisfies Record<Ground, string>,
  /** Olive cells are drawn as olive, almond or fig trees (see treeKind). */
  feature: { rock: 'Rocha', palm: 'Palmeira', olive: 'Oliveira', stump: 'Toco', almond: 'Amendoeira', fig: 'Figueira' } satisfies Record<Feature | 'almond' | 'fig', string>,
  need: { road: 'Rua', plaza: 'Praça', market: 'Mercado', park: 'Parque' } satisfies Record<NeedKind, string>,
  /** Interface Nova (drafts for the copywriter). */
  nova: {
    level: 'NÍVEL',
    silver: 'Prata',
    food: 'Comida',
    residents: 'Moradores',
    happiness: 'Alegria',
    perWeek: '/sem',
    /** The season the food runs out in at this pace (PC food pill). */
    foodEnds: { spring: 'acaba na primavera', summer: 'acaba no verão', autumn: 'acaba no outono', winter: 'acaba no inverno' } satisfies Record<Season, string>,
    /** When the food runs out: the season, or the weeks left if it is still this season. */
    foodForecast(out: { weeks: number; season: Season }, now: Season): string {
      return out.season === now && out.weeks < RULES.weeksPerSeason ? `acaba em ${out.weeks} sem` : this.foodEnds[out.season];
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
    /** A goal's progress; none for "food until spring" once spring has come (the weeks are done: "0/1" says nothing). */
    goalProgress: (g: GoalDef, p: number, target: number): string | null =>
      g.type !== 'foodUntilSpring' ? T.nova.progress(p, target) : target > 1 ? T.nova.progress(p, target, true) : null,
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
    lockedGoal: (n: number, year?: number) => `objetivo ${n}${year ? ` · Ano ${year}` : ''}`,
    unlocksAt: (n: number, year?: number) => `Libera no objetivo ${n}${year ? ` · Ano ${year}` : ''}`,
    category: { home: 'Moradia', supply: 'Comida', work: 'Trabalho', special: 'Especiais' } satisfies Record<BuildingCategory, string>,
    /** Balloon of the chosen building: price and upkeep per week. */
    price: (cost: number, upkeep: number, charged: boolean) =>
      upkeep ? `${cost} prata · ${upkeep} por semana${charged ? '' : ` depois do Objetivo ${RULES.upkeepStartsAfterGoal}`}` : `${cost} prata`,
    jobs: (n: number) => `${n} ${n === 1 ? 'vaga' : 'vagas'}`,
    reach: (n: number) => `alcance ${n}`,
    balanceAfter: (n: number) => `Saldo depois: ${signed(n)}/sem`,
    foodAfter: (n: number) => `Comida depois: ${signed(n)}/sem`,
    /** What each building is for, in one sentence. */
    effect: {
      house: 'Abriga uma família. Cresce com praça, mercado e parque perto.',
      field: 'Dá comida o ano todo, menos no inverno, quando congela. Arraste para fazer vários.',
      plaza: 'Tendas perto de uma praça viram casas de barro.',
      granary: 'Guarda comida da colheita. Sem celeiro, a comida que passa do limite estraga.',
      fisher: 'Pesca no rio: dá comida o ano todo.',
      gatherer: 'Junta frutos das árvores: dá comida o ano todo.',
      lumber: 'Corta árvores e dá madeira. Divide o bosque com a Coletora.',
      quarry: 'Tira pedra das rochas. Casas de pedra e o Templo precisam dela.',
      market: 'Casas de barro com mercado por perto viram casas de pedra.',
      workshop: `Dá trabalho e ${WORKSHOP_BONUS}.`,
      park: 'Casas de pedra perto de um parque viram casas grandes.',
      temple: 'Vence o jogo. Precisa encostar numa rua ligada ao altar.',
    } satisfies Record<BuildableKind, string>,
    /** Tip of the bottom tools when picked. */
    tip: {
      road: `Rua · ${RULES.roadCost} prata por trecho. Arraste a partir de uma rua ligada ao altar.`,
      clear: `Demolir · sem reembolso. Toque ou arraste no que quer tirar.`,
    },
    cutTree: `Cortar árvore · ${RULES.treeClearCost} prata`,
    /** Over the preview of a fisher or gatherer, and in its balloon. */
    yields: (n: number, product: Product = 'food') => `Rende ${fmt(n)} ${PRODUCT[product]}/sem`,
    /** Fisher and gatherer rule in the chosen building balloon. */
    gatherRule: (source: GatherSource, perCell: number, radius: number, max: number, product: Product = 'food') =>
      `${fmt(perCell)} ${PRODUCT[product]} por ${source === 'river' ? 'trecho de rio' : source === 'rock' ? 'rocha' : 'árvore'} no alcance ${radius}, até ${fmt(max)}/sem`,
    stores: (n: number) => `Guarda ${n} de comida`,
    /** Demolir aimed at a granary (or a road that links one): the food that would spoil. */
    foodLost: (n: number) => `Perde ${fmt(n)} de comida`,
    /** Workshop balloon: its field bonus, the city's total after it and the cap ("no teto" once there). */
    workshopBonus: (each: number, total: number, max: number) =>
      `+${each}% de comida dos campos (total ${total}%, ${total >= max ? 'no teto' : `teto ${max}%`})`,
    /** Workshop balloon when the cap is already reached: it only adds jobs. */
    workshopFull: (max: number) => `Campos já no teto (+${max}%): esta oficina só dá vagas`,
    buttons: { goals: 'Objetivos', alerts: 'Avisos', stats: 'Estatísticas', settings: 'Configurações' },
    goals: {
      done: '✓',
      current: '▶',
      next: '○',
      reward: (reward: number) => `+${reward} prata`,
      victory: 'vitória',
      unlocks: (kind: Placeable) => `libera ${toolName(kind)}`,
    },
    /** A goal's text, with the year it opens ("a partir do Ano 8"). */
    goalText: (g: GoalDef) => (g.fromYear ? `${g.text} a partir do Ano ${g.fromYear}` : g.text),
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
      why: 'Altar, praça, mercado e parque alegram; fome e desemprego entristecem.',
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
      residents: (n: number, tax: number) => `${n} moradores · imposto ${fmt2(tax)}/sem`,
      evolve: 'Ao evoluir',
      gain: (residents: number, tax: number, food: number) => `+${residents} moradores · +${fmt2(tax)} de imposto · come ${signed(food)}/sem`,
      /** A missing service that a goal still has to unlock. */
      lockedNeed: (name: string, goal: number) => `${name} (libera no objetivo ${goal})`,
      noRoad: 'sem rua',
      famine: 'fome: não evolui',
      /** Weeks until a house climbs to the next level. */
      nextIn: (name: string, weeks: number) => `${name} em ${weeks} sem`,
      /** The field bonus a connected workshop is giving the city now. */
      fieldBonus: (pct: number) => `Campos da cidade: +${pct}% de comida`,
      plotNoRoad: 'Sem rua: nenhuma família chega. Ligue à rua',
      plotComing: 'Uma família está a caminho',
      plotWaiting: 'Esperando uma família',
      harvesting: (n: number) => `Colhendo: ${fmt(n)} comida/sem`,
      frozen: (weeks: number) => `Congelado no inverno: volta em ${weeks} sem`,
      droughtRiver: 'Ano seco: junto ao rio, colhe normal',
      droughtDry: 'Ano seco: longe do rio, colhe menos',
      noSource: { river: 'Longe do rio: não pesca nada', tree: 'Sem árvores por perto: não colhe nada', rock: 'Sem rochas por perto: não tira pedra' } satisfies Record<GatherSource, string>,
      happiness: (value: number, mood: Mood, why: string) => `Alegria ${value}, ${T.mood[mood]}${why ? ` (${why})` : ''}`,
      serves: (n: number) => `Atende ${n} ${n === 1 ? 'casa' : 'casas'}`,
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
      where: { plaza: 'Onde pôr uma praça', market: 'Onde pôr um mercado', park: 'Onde pôr um parque', road: 'Ligar à rua' },
      noSpot: 'Nenhum lugar livre por perto: abra uma rua ao lado',
      demolish: 'Demolir',
      confirm: 'Certeza?',
      close: 'Fechar',
    },
  },
};

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

/** Up to two decimals at any size (1,25 and 0,25), so tax figures side by side add up. */
export const fmt2 = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

export const signed = (n: number) => (n < 0 ? '−' : '+') + fmt(Math.abs(n));

/** Whole number with a dot every three digits ("1.240"), Brazilian style. */
export function fmtInt(n: number): string {
  const v = Math.trunc(n);
  const digits = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (v < 0 ? '−' : '') + digits;
}

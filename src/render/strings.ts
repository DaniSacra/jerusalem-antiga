import { BUILDINGS, dimsOf, foodCapacity, RULES, TEMPLE_GOAL, unlockingGoal, WEEKS_PER_YEAR, type Alert, type BuildableKind, type BuildingCategory, type Craft, type FailReason, type BirthBlock, type AgeBand, type BuildingKind, type HouseBirths, type Sex, type Feature, type GameState, type GoalDef, type Ground, type HappinessPart, type LeaveReason, type MilestoneId, type Mood, type NeedKind, type Placeable, type Season, type TutorialStepId } from '../core';
import { toolName, type Tool } from './tools';

/** What a workshop does for the fields ("+10% de comida dos campos, até +30%"). */
const WORKSHOP_BONUS = `+${Math.round((BUILDINGS.workshop.fieldBonus ?? 0) * 100)}% de comida dos campos, até +${Math.round((BUILDINGS.workshop.fieldBonusMax ?? 0) * 100)}%`;

export const T = {
  /** Residents lost when a house goes down (with famine, the cause). */
  houseDown: (delta: number, famine: boolean) => (famine ? `Fome ${delta}` : `${delta}`),
  title: 'Jerusalém Antiga',
  start: 'Começar',
  howTo: [
    'Guarde comida para o inverno: pesque, colete e plante campos.',
    `Casais precisam de casa. Tendas perto de uma praça viram casas de barro. Sem celeiro, só cabem ${RULES.baseFoodStorage} de comida.`,
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
  /** Second line of the opening: the engaged couple of the caravan. */
  wantToMarry: (a: string, b: string) => `${a} e ${b} querem se casar`,
  /** People events (toasts). */
  wedding: (a: string, b: string) => `${a} e ${b} se casaram!`,
  birth: (name: string, female: boolean, father: string, mother: string) => `Nasceu ${name}, ${female ? 'filha' : 'filho'} de ${father} e ${mother}`,
  death: (name: string, age: number) => `Morreu ${name}, aos ${age} anos`,
  coupleLeft: (a: string, b: string) => `${a} e ${b} foram embora: não havia casa`,
  caravanAnnounced: (families: number, season: Season) => `Uma caravana de ${families} ${families === 1 ? 'família' : 'famílias'} chega no ${T.season[season]}`,
  caravanArrived: (housed: number, left: number) =>
    left === 0
      ? `Chegou a caravana: ${housed} ${housed === 1 ? 'família ficou' : 'famílias ficaram'}`
      : `${housed} ${housed === 1 ? 'família ficou' : 'famílias ficaram'}; ${left} ${left === 1 ? 'seguiu' : 'seguiram'} viagem: faltou casa`,
  buildingUp: (name: string, level: number) => `${name} subiu para o nível ${level}`,
  /** One sentence when a milestone is reached (toast). */
  milestone: {
    firstWedding: 'Primeiro casamento da cidade!',
    firstBirth: 'Primeiro bebê nascido em Jerusalém!',
    firstCaravan: 'A primeira caravana chegou!',
    firstGrownUp: 'Uma criança nascida aqui virou adulta!',
    thirdGeneration: 'Terceira geração: nasceu um neto da cidade!',
    firstMud: 'A primeira casa de barro está de pé!',
    firstHarvest: 'Primeira colheita: os campos deram comida!',
    firstWinter: 'Primeiro inverno vencido sem perder ninguém!',
    firstStone: 'A primeira casa de pedra está de pé!',
    yearWithoutFamine: 'Um ano inteiro sem fome!',
  } satisfies Record<MilestoneId, string>,
  /** The "virou adulta" milestone with the name of who came of age. */
  grownUp: (name: string, female: boolean) => `${name}, ${female ? 'nascida' : 'nascido'} aqui, ${female ? 'virou adulta' : 'virou adulto'}!`,
  /** Milestone names in the statistics list. */
  milestoneName: {
    firstWedding: 'Primeiro casamento',
    firstBirth: 'Primeiro nascimento',
    firstCaravan: 'Primeira caravana',
    firstGrownUp: 'Primeira criança da cidade adulta',
    thirdGeneration: 'Terceira geração',
    firstMud: 'Primeira casa de barro',
    firstHarvest: 'Primeira colheita',
    firstWinter: 'Primeiro inverno vencido',
    firstStone: 'Primeira casa de pedra',
    yearWithoutFamine: 'Primeiro ano sem fome',
  } satisfies Record<MilestoneId, string>,
  /** Why no child can be born (Avisos and the statistics problems). */
  births: {
    famine: 'Sem nascimentos: fome',
    food: 'Sem nascimentos: a comida não dura até a primavera',
    storage: 'Sem nascimentos: o estoque é pequeno',
  } satisfies Record<BirthBlock, string>,
  /** Why no child is born; "storage" names the store size and how to get a granary. */
  birthsText(block: BirthBlock, s: GameState): string {
    if (block !== 'storage') return T.births[block];
    const granary = s.unlocked.includes('granary') ? 'Construa um celeiro' : `O celeiro libera no objetivo ${unlockingGoal('granary')}`;
    return `Sem nascimentos: o estoque só guarda ${Math.floor(foodCapacity(s))}. ${granary}`;
  },
  /** A family left its tent: famine, or the tent lost its road. */
  familyLeft: (reason: LeaveReason, name: string) =>
    `${name ? `A família de ${name}` : 'Uma família'} foi embora: ${reason === 'famine' ? 'fome' : 'tenda sem rua ligada ao altar'}`,
  /** The temple was built before the goal the victory waits for (500 and 8 read from goals.json). */
  templeEarly: `Templo erguido! A vitória vem com ${TEMPLE_GOAL.goal.text.replace(/^Chegue a /, '')}`,
  famine: 'Falta comida: construa pescador ou coletora',
  looseRoad: 'Rua solta: ligue-a ao altar',
  /** A dragged road reached a button or panel and stopped there. */
  roadUnderUi: 'A rua parou sob um botão: mova o mapa e continue',
  noWorkers: 'Sem trabalhadores: faltam moradores',
  noTempleSpot: `Sem espaço para o Templo: abra uma rua ao lado de um terreno livre ${dimsOf('temple').w} x ${dimsOf('temple').h}`,
  /** Choosing the temple with no ready spot, but some a short road away (the yellow areas). */
  noTempleSpotRoad: 'Sem lugar pronto: puxe uma rua ligada ao altar até uma área amarela',
  /** Preview of any building that fits but would not touch the road network. */
  needsRoad: 'Cabe aqui: falta ligar à rua',
  /** Preview that fits but the city has not the silver yet. */
  /** A touch drag of Demolir passed over something whose removal would spoil food. */
  demolishKeepsFood: 'Isso perde comida: toque nele para demolir',
  missingSilver: (cost: number) => `Falta prata: custa ${cost}`,
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
    if (a.kind === 'foodShort') return 'A comida não dura até a primavera: pesque, colete ou plante campos';
    if (a.kind === 'caravan') {
      const fam = `Caravana com ${a.families} ${a.families === 1 ? 'família' : 'famílias'} em ${weeks(a.weeks)}`;
      const also = a.couples ? ` (${a.couples} ${a.couples === 1 ? 'casal também espera' : 'casais também esperam'})` : '';
      return a.missing ? `${fam}: ${a.missing === 1 ? 'falta 1 casa vazia' : `faltam ${a.missing} casas vazias`}${also}` : `${fam}: tem casa para todas`;
    }
    if (a.kind === 'couples') return a.count === 1 ? 'Casal esperando casa: construa uma casa' : `${a.count} casais esperando casa: construa casas`;
    if (a.kind === 'coupleLeaving') return `${a.man} e ${a.woman} vão embora em ${weeks(a.weeks)}: falta casa`;
    if (a.kind === 'noBirths') return T.births[a.reason];
    if (a.kind === 'spoiling')
      return a.locked
        ? `Estoque cheio (${a.capacity}): o excesso estraga. O celeiro libera no objetivo ${unlockingGoal('granary')}`
        : 'Comida estragando: construa um celeiro';
    if (a.kind === 'winterComing') return 'O inverno está chegando: todos comem mais, nas tendas mais ainda. Guarde comida';
    if (a.kind === 'drought') return `Ano seco: campos longe do rio colhem ${Math.round(RULES.drought.harvestFactor * 100)}%. Construa pescador ou coletora`;
    return `${a.count} ${a.count === 1 ? 'pessoa' : 'pessoas'} sem trabalho: construa ${a.workshopsFull ? 'um campo' : 'um campo ou uma oficina'}`;
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
  /** Preview of a plaza, market or park: houses with a family inside its radius. */
  serves: (n: number) => `Atende ${n} ${n === 1 ? 'casa' : 'casas'}`,
  /** Preview of the temple: it only gives Alegria (it never makes a house climb). */
  templeServes: (n: number) => `+${RULES.happiness.sacred} de Alegria em ${n} ${n === 1 ? 'casa' : 'casas'}`,
  tutorial: {
    step: {
      road: 'Puxe uma rua pelo caminho marcado, até onde há comida',
      gather: 'Construa um pescador junto ao rio ou uma coletora perto das árvores',
      field: 'Construa um campo: ele dá comida já, até o inverno congelar',
      plaza: 'Construa uma praça perto das tendas da caravana',
      house: 'Um casal quer se casar: construa uma casa perto da praça',
      wedding: 'O casal vai para a casa nova!',
      market: 'Construa um mercado perto das casas de barro: elas viram casas de pedra',
    } satisfies Record<TutorialStepId, string>,
    /** The house and wedding steps with the names of the caravan's engaged couple. */
    couple: {
      house: (a: string, b: string) => `${a} e ${b} querem se casar: construa uma casa perto da praça`,
      wedding: (a: string, b: string) => `${a} e ${b} vão para a casa nova!`,
    },
    pick: (tool: Tool) => `Toque em ${toolName(tool)}`,
    skip: 'Pular tutorial',
    ok: 'Entendi',
    again: 'Rever o tutorial',
    done: 'Muito bem! Casais novos precisam de casa; casas melhores cabem mais filhos',
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
  /** Second line of the victory: the city's own story. */
  victoryPeople: (births: number, weddings: number) =>
    `${births} ${births === 1 ? 'nascimento' : 'nascimentos'} · ${weddings} ${weddings === 1 ? 'casamento' : 'casamentos'}`,
  keepBuilding: 'Continuar construindo',
  defeatTitle: 'Jerusalém foi abandonada',
  defeatText: (weeksPlayed: number, peak: number) =>
    `A cidade ficou ${weeks(RULES.debtWeeksToLose)} em dívida. Você jogou ${duration(weeksPlayed)} e chegou a ${peak} moradores.`,
  retry: 'Tentar de novo',
  lockedHint: (kind: Placeable) => `${toolName(kind)}: libera no objetivo ${unlockingGoal(kind)}`,
  ground: { sand: 'Areia', grass: 'Grama seca', river: 'Rio' } satisfies Record<Ground, string>,
  /** Olive cells are drawn as olive, almond or fig trees (see treeKind). */
  feature: { rock: 'Rocha', palm: 'Palmeira', olive: 'Oliveira', almond: 'Amendoeira', fig: 'Figueira' } satisfies Record<Feature | 'almond' | 'fig', string>,
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
    /** The fields' next turn after the calendar ("inverno em 5 sem"); the phone drops the week for it. */
    fieldTurn: (turn: { season: 'winter' | 'spring'; weeks: number }) => `${turn.season === 'winter' ? 'inverno' : 'primavera'} em ${turn.weeks} sem`,
    calendarPhone: (season: Season, year: number, turn: { season: 'winter' | 'spring'; weeks: number }) =>
      `${T.nova.seasonName[season]} · Ano ${year} · ${T.nova.fieldTurn(turn)}`,
    /** Name of a bottom tool, with its key on PC ("Mover · 1"). */
    withKey: (name: string, key: string) => `${name} · ${key}`,
    /** Price and key inside a PC column button. */
    costKey: (cost: number, key: string) => `${cost} · tecla ${key}`,
    lockedGoal: (n: number, year?: number) => `objetivo ${n}${year ? ` · Ano ${year}` : ''}`,
    unlocksAt: (n: number, year?: number) => `Libera no objetivo ${n}${year ? ` · Ano ${year}` : ''}`,
    category: { home: 'Moradia', supply: 'Comida', work: 'Trabalho', special: 'Especiais' } satisfies Record<BuildingCategory, string>,
    /** Balloon of the chosen building: price and upkeep per week. */
    price: (cost: number, upkeep: number) => (upkeep ? `${cost} prata · ${fmt2(upkeep)} por semana` : `${cost} prata`),
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
      market: 'Casas de barro com mercado por perto viram casas de pedra.',
      workshop: `Dá trabalho e ${WORKSHOP_BONUS}.`,
      park: 'Casas de pedra perto de um parque viram casas grandes.',
      temple: `Vence o jogo com o objetivo ${TEMPLE_GOAL.number} cumprido. Encoste numa rua ligada ao altar.`,
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
    stores: (n: number) => `Guarda ${n} de comida`,
    /** The stat a service level changes, short ("guarda 600", "alcance 6", "+20% nos campos"). */
    levelStat: {
      storage: (n: number) => `guarda ${n}`,
      radius: (n: number) => `alcance ${n}`,
      fieldBonus: (n: number) => `+${Math.round(n * 100)}% nos campos`,
    },
    /** Chosen building balloon: the first level and the last ("Guarda 300 · melhora até 1000"). */
    growsTo: (now: string, top: string) => `${now[0].toUpperCase()}${now.slice(1)} · melhora até ${top.replace(/^guarda |^alcance /, '')}`,
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
      /** Silver saved for the temple while it is unlocked and not built. */
      templeSavings: (silver: number, cost: number) => `Junte ${cost} para o Templo: ${Math.min(silver, cost)}/${cost}`,
    },
    /** The same, short, at the end of the goal pill. */
    templeSavingsPill: (silver: number, cost: number) => `Templo ${Math.min(silver, cost)}/${cost}`,
    /** A goal's text, with the year it opens ("a partir do Ano 8"). */
    goalText: (g: GoalDef) => (g.fromYear ? `${g.text} a partir do Ano ${g.fromYear}` : g.text),
    noAlerts: 'Nenhum aviso. A cidade vai bem.',
    /** Stats tabs. */
    tabs: { now: 'Agora', people: 'Povo', history: 'Histórico' },
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
      /** Tab Povo. */
      people: 'Pessoas',
      bands: { child: 'Crianças', adult: 'Adultos', elder: 'Idosos' } satisfies Record<AgeBand, string>,
      thisYear: 'Este ano (desde o outono)',
      births: 'Nascimentos',
      deaths: 'Mortes',
      weddings: 'Casamentos',
      couples: 'Casais esperando casa',
      caravan: 'Próxima caravana',
      caravanAt: (season: Season, year: number, families: number) =>
        `${T.nova.seasonName[season]} do Ano ${year} · ${families} ${families === 1 ? 'família' : 'famílias'}`,
      noCaravan: 'Nenhuma anunciada',
      families: 'Famílias',
      noFamilies: 'Ninguém mora na cidade ainda',
      /** One family button: family name and people. */
      family: (clan: string, n: number) => `${clan} · ${n}`,
      moreFamilies: (n: number) => `e mais ${n} ${n === 1 ? 'família' : 'famílias'}`,
    },
    /** People: the house balloon and the person sheet. */
    people: {
      band: (band: AgeBand, sex: Sex) =>
        band === 'child' ? 'criança' : band === 'adult' ? (sex === 'f' ? 'adulta' : 'adulto') : sex === 'f' ? 'idosa' : 'idoso',
      /** A resident row: name and age. */
      row: (name: string, age: number) => `${name}, ${age}`,
      head: (house: string, n: number, cap: number) => `${house} · ${n}/${cap} ${cap === 1 ? 'pessoa' : 'pessoas'}`,
      /** An empty house that kept its level. */
      empty: (house: string) => `${house} vazia: espera um casal ou uma família da caravana`,
      /** People walking to this house. */
      coming: (names: string) => `A caminho: ${names}`,
      births: {
        ok: 'Pode ter filhos',
        full: 'Sem filhos: casa cheia',
        famine: 'Sem filhos: fome',
        food: 'Sem filhos: a comida não dura até a primavera',
        storage: 'Sem filhos: o estoque é pequeno. Construa um celeiro',
      } satisfies Record<HouseBirths, string>,
      /** Work of an adult (by the building; workshops by their craft), for a man and a woman. */
      job: {
        field: ['Lavrador', 'Lavradora'],
        fisher: ['Pescador', 'Pescadora'],
        gatherer: ['Coletor', 'Coletora'],
        granary: ['Guarda do celeiro', 'Guarda do celeiro'],
        market: ['Mercador', 'Mercadora'],
        temple: ['Levita', 'Cantora do templo'],
      } as Partial<Record<BuildingKind, [string, string]>>,
      craft: {
        pottery: ['Oleiro', 'Oleira'],
        smithy: ['Ferreiro', 'Ferreira'],
        carpentry: ['Carpinteiro', 'Carpinteira'],
        weaving: ['Tecelão', 'Tecelã'],
        dyeing: ['Tintureiro', 'Tintureira'],
        tannery: ['Curtidor', 'Curtidora'],
      } satisfies Record<Craft, [string, string]>,
      noJob: 'Sem trabalho',
      walking: 'A caminho',
      childOf: (name: string, sex: Sex, parent: string) => `${name}, ${sex === 'f' ? 'filha' : 'filho'} de ${parent}`,
      clan: (clan: string) => `da família de ${clan}`,
      age: (age: number, band: string) => `${age} ${age === 1 ? 'ano' : 'anos'} · ${band}`,
      dead: (age: number) => `† aos ${age}`,
      gone: (year: number) => `foi embora no Ano ${year}`,
      house: 'Casa',
      parents: 'Pais',
      /** The spouse label, by the person's own sex: married, engaged, widowed. */
      spouse: (state: 'married' | 'engaged' | 'widow', sex: Sex) =>
        state === 'married' ? (sex === 'f' ? 'Marido' : 'Esposa') : state === 'engaged' ? (sex === 'f' ? 'Noiva de' : 'Noivo de') : sex === 'f' ? 'Viúva de' : 'Viúvo de',
      children: 'Filhos',
      none: 'nenhum',
      founder: 'Chegou com a caravana que fundou a cidade',
      caravan: (year: number) => `Chegou com a caravana do Ano ${year}`,
      born: (year: number) => `Nasceu na cidade no Ano ${year}`,
      back: 'Voltar',
      close: 'Fechar',
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
      /** Phone house balloon: only the next level. */
      nextOnly: (next: string) => `Próximo nível: ${next}`,
      top: 'nível máximo',
      tax: (tax: number) => `Imposto ${fmt2(tax)}/sem`,
      evolve: 'Ao evoluir',
      gain: (capacity: number, tax: number) => `+${capacity} ${capacity === 1 ? 'lugar' : 'lugares'} · +${fmt2(tax)} de imposto`,
      /** A missing service that a goal still has to unlock. */
      lockedNeed: (name: string, goal: number) => `${name} (libera no objetivo ${goal})`,
      noRoad: 'sem rua',
      famine: 'fome: não evolui',
      /** Weeks until a house climbs to the next level. */
      nextIn: (name: string, weeks: number) => `${name} em ${weeks} sem`,
      /** The field bonus a connected workshop is giving the city now. */
      fieldBonus: (pct: number) => `Campos da cidade: +${pct}% de comida`,
      plotNoRoad: 'Sem rua: ninguém se muda para cá. Ligue à rua',
      plotWaiting: 'Casa vazia: espera um casal ou uma família da caravana',
      /** A service building's next level: cost and what it changes. */
      upgrade: (cost: number) => `Melhorar · ${cost}`,
      /** The level now, of the last one. */
      levelOf: (level: number, top: number) => `Nível ${level} de ${top}`,
      /** What the next level changes: "Nível 2: guarda 600 · 2/sem (hoje 300 · 1/sem)". */
      nextLevel: (level: number, stat: string, upkeep: number, nowStat: string, nowUpkeep: number) =>
        `Nível ${level}: ${stat} · ${fmt2(upkeep)}/sem (hoje ${nowStat} · ${fmt2(nowUpkeep)}/sem)`,
      topLevel: 'Nível máximo',
      harvesting: (n: number) => `Colhendo: ${fmt(n)} comida/sem`,
      frozen: (weeks: number) => `Congelado no inverno: volta em ${weeks} sem`,
      droughtRiver: 'Ano seco: junto ao rio, colhe normal',
      droughtDry: 'Ano seco: longe do rio, colhe menos',
      noSource: { river: 'Longe do rio: não pesca nada', tree: 'Sem árvores por perto: não colhe nada' },
      happiness: (value: number, mood: Mood, why: string) => `Alegria ${value}, ${T.mood[mood]}${why ? ` (${why})` : ''}`,
      serves: (n: number) => `Atende ${n} ${n === 1 ? 'casa' : 'casas'}`,
      upkeep: (n: number) => `${fmt2(n)} por semana`,
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

import { BUILDINGS, HOUSE_LEVELS, RULES, storageOf, unlockingGoal, WEEKS_PER_YEAR, type Alert, type BuildableKind, type BuildingCategory, type Craft, type FailReason, type BirthBlock, type AgeBand, type BuildingKind, type HouseBirths, type Sex, type Feature, type GatherSource, type Material, type Materials, type Product, type GoalDef, type Ground, type HappinessPart, type LeaveReason, type MilestoneId, type Mood, type NeedKind, type Placeable, type Season, type TutorialStepId } from '../core';
import { toolName, type Tool } from './tools';

/** Names of what gathering buildings bring (drafts for the copywriter). */
const PRODUCT: Record<Product, string> = { food: 'comida', wood: 'madeira', stone: 'pedra', livestock: 'gado' };

/** The building that makes each material, with its article ("um lenhador", "uma pedreira"). */
const MAKER: Record<Material, string> = { wood: 'um lenhador', stone: 'uma pedreira', livestock: 'um pasto' };
/** Buildings named with a feminine article ("a Coletora", "a Oficina"). */
const FEMININE: ReadonlySet<BuildingKind> = new Set<BuildingKind>(['gatherer', 'quarry', 'workshop', 'plaza']);

/** House levels in the plural, after "perto das" (tents to stone houses). */
const HOUSE_PLURAL = ['', 'tendas', 'casas de barro', 'casas de pedra', 'casas grandes'];

/** "10 de pedra e 5 de madeira": a materials cost in words (empty when none). */
const materialsText = (m: Materials) => (['stone', 'wood'] as const).filter((k) => m[k]).map((k) => `${m[k]} de ${PRODUCT[k]}`).join(' e ');


/** What a workshop does for the fields ("+10% de comida dos campos, até +30%"). */
const WORKSHOP_BONUS = `+${Math.round((BUILDINGS.workshop.fieldBonus ?? 0) * 100)}% de comida dos campos, até +${Math.round((BUILDINGS.workshop.fieldBonusMax ?? 0) * 100)}%`;

export const T = {
  /** Residents lost when a house goes down (with famine, the cause). */
  houseDown: (delta: number, famine: boolean, cold = false) => (cold ? `Frio ${delta}` : famine ? `Fome ${delta}` : `${delta}`),
  title: 'Jerusalém Antiga',
  /** No WebGL 2 in this browser: the game cannot draw. */
  noWebGL: 'Este navegador não consegue desenhar o jogo em 3D. Atualize o navegador ou abra em outro aparelho.',
  start: 'Começar',
  howTo: [
    'Guarde comida para o inverno: pesque, colete e plante campos.',
    `Casais precisam de casa. Com madeira de um lenhador, tendas viram casas de barro; guarde lenha para o inverno. Sem celeiro, só cabem ${RULES.baseFoodStorage} de comida.`,
    'Cumpra os objetivos e restaure o Templo em ruínas, etapa por etapa. Não deixe a cidade em dívida!',
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
  caravan: (families: number, foodWeeks: number) => 
    `A caravana chegou com ${families} ${families === 1 ? 'família' : 'famílias'}, comida para ${weeks(foodWeeks)}` +
    (RULES.startMaterials.wood ? ` e ${RULES.startMaterials.wood} de madeira` : ''),
  /** People events (toasts). */
  wedding: (a: string, b: string) => `${a} e ${b} se casaram!`,
  birth: (name: string, female: boolean, father: string, mother: string) => `Nasceu ${name}, ${female ? 'filha' : 'filho'} de ${father} e ${mother}`,
  death: (name: string, age: number) => `Morreu ${name}, aos ${age} anos`,
  /** Cold deaths of a week: the first by name, the rest summed. */
  coldDeath: (name: string, age: number, more: number) =>
    `O frio levou ${name}, ${age === 0 ? 'bebê' : `${age} ${age === 1 ? 'ano' : 'anos'}`}` + (more ? ` e mais ${more} ${more === 1 ? 'pessoa' : 'pessoas'}` : ''),
  /** Floating over the house where someone died of cold. */
  coldMark: 'Frio',
  winterToll: (n: number) => `O inverno levou ${n} ${n === 1 ? 'pessoa' : 'pessoas'}`,
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
    firstSpring: 'Primavera! A cidade passou o primeiro inverno',
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
    firstSpring: 'Primeiro inverno passado',
    firstStone: 'Primeira casa de pedra',
    yearWithoutFamine: 'Primeiro ano sem fome',
  } satisfies Record<MilestoneId, string>,
  /** Why no child can be born (Avisos and the statistics problems). */
  births: {
    famine: 'Sem nascimentos: fome',
    food: 'Sem nascimentos: a comida não dura até a primavera',
    storage: 'Sem nascimentos: o estoque é pequeno',
  } satisfies Record<BirthBlock, string>,
  /** A family left its tent: famine, or the tent lost its road. */
  familyLeft: (reason: LeaveReason, name: string) =>
    `${name ? `A família de ${name}` : 'Uma família'} foi embora: ${reason === 'famine' ? 'fome' : reason === 'cold' ? 'frio, sem lenha' : 'tenda sem rua ligada ao altar'}`,
  famine: 'Falta comida: construa pescador ou coletora',
  coldStart: 'Frio! Acabou a lenha: construa um lenhador',
  coldEnd: 'A lenha voltou: as casas se aquecem',
  looseRoad: 'Rua solta: ligue-a ao altar',
  /** A dragged road reached a button or panel and stopped there. */
  roadUnderUi: 'A rua parou sob um botão: mova o mapa e continue',
  noWorkers: 'Sem trabalhadores: faltam moradores',
  /** A market lost its last worker. */
  serviceEmpty: (kind: BuildingKind) => `${BUILDINGS[kind].name} vazio: não atende as casas`,
  /** A workplace built with nobody free to work there. */
  noCrewBuilt: (kind: BuildingKind) => `Ninguém livre para ${FEMININE.has(kind) ? 'a' : 'o'} ${BUILDINGS[kind].name}: abra Profissões`,
  /** Preview of any building that fits but would not touch the road network. */
  needsRoad: 'Cabe aqui: falta ligar à rua',
  /** Preview that fits but the city has not the silver yet. */
  /** A touch drag of Demolir passed over something whose removal would spoil food. */
  demolishKeepsFood: 'Isso perde comida: toque nele para demolir',
  missingSilver: (cost: number) => `Falta prata: custa ${cost}`,
  fail: {
    silver: 'Prata insuficiente',
    materials: 'Falta madeira ou pedra',
    debt: 'Em dívida: não dá para construir',
    invalid: 'Não dá para construir aqui',
    noRoad: 'Obra sem rua: ligue o Templo a uma rua ligada ao altar',
    protected: 'O altar e o templo não podem ser demolidos',
    locked: 'Ainda bloqueado',
  } satisfies Record<FailReason, string>,
  /** Building without the wood or stone it costs (toast). */
  lacking: (m: Material) => `Falta ${PRODUCT[m]}: construa ${MAKER[m]}`,
  /** Melhorar short of a material: how much it asks and how much the city has. */
  lackingAmount: (m: Material, need: number, have: number) => `Falta ${PRODUCT[m]}: ${need} (tem ${Math.floor(have)})`,
  goalDone: (reward: number, unlock?: Placeable) =>
    `Objetivo cumprido! +${reward} prata` + (unlock ? ` · Nova construção: ${toolName(unlock)}` : ''),
  /** Extra message when a goal unlocks a building, explaining what it is for. */
  unlocked: {
    workshop: `Oficina liberada: ${BUILDINGS.workshop.jobs} vagas e ${WORKSHOP_BONUS}`,
    park: 'Parque liberado: casas de pedra perto dele e de um mercado viram casas grandes',
    plaza: 'Praça liberada: casas de barro perto dela viram casas de pedra',
    market: 'Mercado liberado: com oficina e campos, o povo tem o que trocar',
    quarry: 'Pedreira liberada: tira pedra das rochas para casas de pedra e o Templo',
    pasture: 'Pasto liberado: dá gado do capim para as ofertas do altar',
  } as Partial<Record<Placeable, string>>,
  alert: (a: Alert): string => {
    if (a.kind === 'debt')
      return a.famine
        ? `Dívida e fome: demolir serviços corta a manutenção · ${weeks(a.weeksLeft)}`
        : `Em dívida: ${weeks(a.weeksLeft)} para a cidade ser abandonada. Reduza a manutenção`;
    if (a.kind === 'deficit')
      return `Saldo ${signed(a.balance)}/sem · maior custo: ${BUILDINGS[a.costliest].name} (${fmt2(a.upkeep)}/sem) · use Demolir em serviços que atendem poucas casas`;
    if (a.kind === 'material')
      return `${a.count} ${a.count === 1 ? 'casa esperando' : 'casas esperando'} ${PRODUCT[a.material]}: ${a.making ? `já chega aos poucos, ${MAKER[a.material]} a mais acelera` : `construa ${MAKER[a.material]}`}`;
    if (a.kind === 'foodShort') return 'A comida não dura até a primavera: pesque, colete ou plante campos';
    if (a.kind === 'firewood')
      return a.cold ? 'Frio! Sem lenha, as casas esvaziam. Construa um lenhador' : `A lenha não dura o inverno: faltam ${a.missing} de madeira. Construa um lenhador`;
    if (a.kind === 'storageFull') return `Estoque de ${PRODUCT[a.material]} cheio (${storageOf(a.material)}): ${({ wood: 'o lenhador', stone: 'a pedreira', livestock: 'o pasto' } as const)[a.material]} parou`;
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
    if (a.kind === 'winterComing')
      return a.tents
        ? `O inverno está chegando: na tenda, crianças pequenas e idosos podem morrer de frio. Suba para barro (${HOUSE_LEVELS[2].materials?.wood ?? 0} de madeira)`
        : 'O inverno está chegando: guarde comida e lenha';
    if (a.kind === 'drought') return `Ano seco: campos longe do rio colhem ${Math.round(RULES.drought.harvestFactor * 100)}%. Construa pescador ou coletora`;
    if (a.kind === 'noCrew') return `${BUILDINGS[a.building].name} sem trabalhadores: abra Profissões`;
    return `${a.count} ${a.count === 1 ? 'pessoa' : 'pessoas'} sem trabalho: faltam vagas. Construa ${a.workshopsFull ? 'um lenhador ou uma pedreira' : 'um campo, lenhador ou oficina'}`;
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
      house: 'Um casal quer se casar: construa uma casa perto das tendas',
      wedding: 'O casal vai para a casa nova!',
      lumber: 'Casas pedem madeira: construa um lenhador perto das árvores',
      market: 'Construa um mercado perto das casas de pedra: com um parque, viram casas grandes',
    } satisfies Record<TutorialStepId, string>,
    /** The lumber step when its spot needs the marked road first. */
    lumberRoad: 'Casas pedem madeira: puxe a rua marcada e ponha um lenhador no fim',
    /** The house and wedding steps with the names of the caravan's engaged couple. */
    couple: {
      house: (a: string, b: string) => `${a} e ${b} querem se casar: construa uma casa perto das tendas`,
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
    `O Templo foi consagrado em ${duration(played)}, com ${residents} moradores.`,
  /** The "medals" under the victory and defeat text: a big number and what it counts. */
  medal: {
    residents: (n: number) => (n === 1 ? 'morador' : 'moradores'),
    births: (n: number) => (n === 1 ? 'nascimento' : 'nascimentos'),
    weddings: (n: number) => (n === 1 ? 'casamento' : 'casamentos'),
    weeks: (n: number) => (n === 1 ? 'semana jogada' : 'semanas jogadas'),
    peak: (n: number) => (n === 1 ? 'morador no auge' : 'moradores no auge'),
  },
  keepBuilding: 'Continuar construindo',
  defeatTitle: 'Jerusalém foi abandonada',
  defeatText: (weeksPlayed: number, peak: number) =>
    `A cidade ficou ${weeks(RULES.debtWeeksToLose)} em dívida. Você jogou ${duration(weeksPlayed)} e chegou a ${peak} moradores.`,
  retry: 'Tentar de novo',
  /** Defeat: a new game on the same map (same seed). */
  sameMap: 'Mesmo mapa',
  lockedHint: (kind: Placeable) => `${toolName(kind)}: libera no objetivo ${unlockingGoal(kind)}`,
  ground: { sand: 'Areia', grass: 'Grama seca', river: 'Rio' } satisfies Record<Ground, string>,
  /** Olive cells are drawn as olive, almond or fig trees (see treeKind). */
  feature: { rock: 'Rocha', palm: 'Palmeira', olive: 'Oliveira', stump: 'Toco', almond: 'Amendoeira', fig: 'Figueira' } satisfies Record<Feature | 'almond' | 'fig', string>,
  need: { road: 'Rua', plaza: 'Praça', market: 'Mercado', park: 'Parque', sacred: 'Altar com ofertas' } satisfies Record<NeedKind, string>,
  /** Interface Nova (drafts for the copywriter). */
  nova: {
    level: 'NÍVEL',
    silver: 'Prata',
    food: 'Comida',
    residents: 'Moradores',
    happiness: 'Alegria',
    /** Materials pill (PC: one pill per material, with its name). */
    material: { wood: 'Madeira', stone: 'Pedra', livestock: 'Gado' } satisfies Record<Material, string>,
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
    /** The phone drops the season's name too: its icon shows it. */
    calendarPhone: (year: number, turn: { season: 'winter' | 'spring'; weeks: number }) => `Ano ${year} · ${T.nova.fieldTurn(turn)}`,
    /** The keyboard key of a tool or building, on PC buttons ("tecla 3"). */
    keyHint: (k: string) => `tecla ${k}`,
    lockedGoal: (n: number, year?: number) => `objetivo ${n}${year ? ` · Ano ${year}` : ''}`,
    unlocksAt: (n: number, year?: number) => `Libera no objetivo ${n}${year ? ` · Ano ${year}` : ''}`,
    category: { home: 'Moradia', supply: 'Comida', work: 'Trabalho', special: 'Especiais' } satisfies Record<BuildingCategory, string>,
    /** Pieces of the cost line ("25 prata · 10 madeira"), each red when the city lacks it. */
    silverCost: (n: number) => `${n} prata`,
    free: 'Grátis',
    materialCost: (n: number, m: Material) => `${n} ${PRODUCT[m]}`,
    /** After a cost piece the city lacks: how much it has. */
    have: (n: number) => ` (tem ${Math.floor(n)})`,
    /** Upkeep per week, on its own line under the cost. */
    upkeep: (upkeep: number) => T.nova.inspect.upkeep(upkeep),
    /** Balloon of the chosen building: price and upkeep per week. */
    price: (cost: number, upkeep: number) => (upkeep ? `${cost} prata · manutenção ${fmt2(upkeep)}/sem` : `${cost} prata`),
    jobs: (n: number) => `${n} ${n === 1 ? 'vaga' : 'vagas'}`,
    reach: (n: number) => `alcance ${n}`,
    balanceAfter: (n: number) => `Saldo depois: ${signed(n)}/sem`,
    foodAfter: (n: number) => `Comida depois: ${signed(n)}/sem`,
    /** What each building is for, in one sentence. */
    effect: {
      house: 'Abriga uma família. Com madeira vira barro; com praça, altar com ofertas e pedra, pedra; com mercado e parque, grande.',
      field: 'Dá comida o ano todo, menos no inverno, quando congela. Arraste para fazer vários.',
      plaza: 'Casas de barro perto de uma praça e do altar com ofertas viram casas de pedra, com pedra da pedreira.',
      granary: 'Guarda comida da colheita. Sem celeiro, a comida que passa do limite estraga.',
      fisher: 'Pesca no rio: dá comida o ano todo.',
      gatherer: 'Junta frutos das árvores: dá comida o ano todo.',
      lumber: 'Corta árvores: madeira para obras e lenha do inverno. Divide o bosque com a Coletora.',
      quarry: 'Tira pedra das rochas. Casas de pedra e o Templo precisam dela.',
      market: 'Lugar de troca: casas de pedra com mercado e parque por perto viram casas grandes.',
      workshop: `Dá trabalho e ${WORKSHOP_BONUS}.`,
      park: 'Casas de pedra perto de um parque viram casas grandes.',
      temple: 'O Templo em ruínas: toque nele para ver a próxima etapa.',
      pasture: 'Rende gado pelo capim livre em volta. O altar restaurado queima gado toda semana.',
    } satisfies Record<BuildableKind, string>,
    /** Tip of the bottom tools when picked. */
    tip: {
      road: `Rua · ${RULES.roadCost} prata por trecho. Arraste a partir de uma rua ligada ao altar.`,
      clear: `Demolir · sem reembolso. Toque ou arraste no que quer tirar.`,
    },
    cutTree: `Cortar árvore · ${RULES.treeClearCost} prata (não dá madeira: o lenhador corta sozinho)`,
    /** Over the preview of a fisher or gatherer, and in its balloon. */
    yields: (n: number, product: Product = 'food') => `Rende ${fmt(n)} ${PRODUCT[product]}/sem`,
    /** Preview of a fisher, gatherer, lumber or quarry not touching a road linked to the altar. */
    offRoad: 'Sem rua ao lado: não rende nada',
    /** Lumber preview: how often it cuts a tree at the wood it brings. */
    cutsEvery: (weeks: number) => `Corta 1 árvore a cada ${weeks} sem`,
    /** A lumber or quarry whose material store is full. */
    storeFull: (cap: number) => `Parado: estoque cheio (${cap})`,
    /** A house with people in autumn and winter: the firewood it burns; with cold, in red. */
    firewood: (n: number) => `Lenha no inverno: ${fmt(n)}/sem`,
    cold: 'Frio: falta lenha',
    /** A tent in autumn and winter (B3): the cold can kill there. */
    tentCold: 'Tenda fria: risco para crianças e idosos',
    /** Lumber or gatherer preview when its radius takes trees the other one uses. */
    sharesGrove: (kind: 'lumber' | 'gatherer') => (kind === 'lumber' ? 'Divide o bosque com a Coletora' : 'Divide o bosque com o Lenhador'),
    /** "Onde pôr um lenhador" found no spot with trees (or rocks) next to a road. */
    noGatherSpot: (m: Material) => (m === 'wood' ? 'Nenhum lugar com árvores junto à rua: leve uma rua até o bosque' : 'Nenhum lugar com rochas junto à rua: leve uma rua até as rochas'),
    /** Fisher and gatherer rule in the chosen building balloon. */
    gatherRule: (source: GatherSource, perCell: number, radius: number, max: number, product: Product = 'food') =>
      `${fmt(perCell)} ${PRODUCT[product]} por ${source === 'river' ? 'trecho de rio' : source === 'rock' ? 'rocha' : source === 'grass' ? 'trecho de capim livre' : 'árvore'} no alcance ${radius}, até ${fmt(max)}/sem`,
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
    buttons: { goals: 'Objetivos', alerts: 'Avisos', stats: 'Estatísticas', jobs: 'Profissões', settings: 'Configurações', speed: 'velocidade', paused: 'pausado' },
    /** The Profissões panel: one row per profession built, its crew, jobs and the target (− / +). */
    professions: {
      title: 'Profissões',
      /** The button that gives every profession all its jobs again. */
      auto: 'Automático',
      /** The seal of a profession left to the game (every job filled). */
      autoSeal: 'auto',
      idle: 'Sem trabalho',
      /** Beside "Sem trabalho": who does not work by age. */
      others: (children: number, elders: number) =>
        `${children} ${children === 1 ? 'criança' : 'crianças'}, ${elders} ${elders === 1 ? 'idoso' : 'idosos'}`,
      /** The crew of a profession of the jobs on the road ("2 de 4 vagas"). */
      crew: (crew: number, seats: number) => `${crew} de ${seats} ${seats === 1 ? 'vaga' : 'vagas'}`,
      /** Fewer workers than the target. */
      missing: (n: number) => `falta ${n}`,
      /** Its workplaces are all off the road. */
      noRoad: 'sem rua',
      /** + with nobody free to take the job. */
      nobodyFree: 'Ninguém livre: use − em outra profissão',
      lower: (name: string) => `Menos ${name}`,
      raise: (name: string) => `Mais ${name}`,
      /** The profession of each workplace, plural (the row's name). */
      name: {
        fisher: 'Pescadores',
        gatherer: 'Coletoras',
        field: 'Lavradores',
        lumber: 'Lenhadores',
        quarry: 'Pedreiros',
        pasture: 'Pastores',
        granary: 'Celeireiros',
        market: 'Mercadores',
        workshop: 'Artesãos',
        temple: 'Construtores',
        altar: 'Construtores',
      } as Partial<Record<BuildingKind, string>>,
    },
    goals: {
      done: '✓',
      current: '▶',
      next: '○',
      reward: (reward: number) => `+${reward} prata`,
      victory: 'vitória',
      unlocks: (kind: Placeable) => `libera ${toolName(kind)}`,
    },
    /** The Temple's stage that is the goal now (see `stageStatus`). */
    stage: {
      started: (name: string) => `Obra começou: ${name}`,
      done: (name: string) => `Etapa pronta: ${name}`,
      start: (name: string, site: 'altar' | 'temple') => `${name}: toque no ${site === 'altar' ? 'altar' : 'Templo'} para começar`,
      lacking: (name: string, what: string) => `${name}: junte ${what}`,
      debt: (name: string) => `${name}: pague a dívida antes`,
      noRoad: (site: 'altar' | 'temple') => `Ligue ${site === 'altar' ? 'o altar' : 'o Templo'} à rua`,
      building: (name: string, progress: number, work: number) => `${name} ${progress}/${work}`,
      weeks: (n: number) => `~${n} sem`,
      idle: 'sem construtores',
      /** "30 prata, 50 pedra": what the stage still needs. */
      need: (parts: [number, 'silver' | Product][]) => parts.map(([n, k]) => `${n} ${k === 'silver' ? 'prata' : PRODUCT[k]}`).join(', '),
      ruins: 'Ruínas do Templo',
      /** The site's balloon: "Etapa 2 de 5: Alicerce". */
      head: (n: number, of: number, name: string) => `Etapa ${n} de ${of}: ${name}`,
      /** Before it starts: its builders and the shortest time with all of them. */
      plan: (builders: number, weeks: number) => `${builders} construtores · ~${weeks} sem de obra`,
      builders: (n: number, of: number) => `Construtores: ${n} de ${of}`,
      /** The progress bar's number. */
      progress: (p: number, work: number) => `${p}/${work}`,
      stopped: 'Obra parada: ninguém trabalha nela',
      left: (n: number) => `Pronto em ~${n} sem`,
      begin: (name: string) => `Começar: ${name}`,
      /** Not its goal yet: the goal that comes first. */
      first: (n: number, text: string) => `Antes: objetivo ${n}, ${text}`,
      /** A stage already built, on its site's balloon. */
      built: (name: string) => `${name}: etapa pronta`,
      /** The goals list: the stage goals' mark. */
      ofStages: (n: number, of: number) => `etapa ${n}/${of}`,
    },
    /** The restored altar's weekly offering of livestock. */
    offerings: {
      missing: 'Falta gado para o altar: construa um pasto',
      back: 'As ofertas voltaram',
      none: 'Sem ofertas',
      /** Altar balloon. */
      ruins: 'Altar em ruínas: restaure para as casas de pedra',
      burns: (n: number, houses: number) => `Ofertas: ${fmt2(n)} gado/sem · cobre ${houses} ${houses === 1 ? 'casa' : 'casas'}`,
      empty: 'Sem ofertas: não cobre as casas',
      /** A house's missing need "Altar". */
      needRuins: 'Altar em ruínas',
      needNone: 'altar sem ofertas',
      needFar: 'longe do altar',
    },
    /** "O que fazer agora": one short line under the top bar (see `nextStep`). */
    next: {
      debt: (w: number) => `Dívida: ${weeks(w)} para perder. Demolir corta gastos`,
      famine: 'Fome! Construa um pescador perto do rio',
      food: (w: number) => `Comida acaba em ${weeks(w)}: construa um pescador perto do rio`,
      cold: 'Frio! Sem lenha: construa um lenhador',
      offerings: 'O altar está sem ofertas: construa um pasto no capim',
      /** A maker the crisis needs stands empty and nobody is free: move someone there. */
      noCrew: (kind: BuildingKind) => `${BUILDINGS[kind].name} sem ninguém: mude alguém em Profissões`,
      livestock: (w: number) => `Gado acaba em ${weeks(w)}: construa um pasto no capim`,
      firewood: (n: number) => `Lenha não dura o inverno: faltam ${n}. Construa um lenhador`,
      gather: (name: string, what: 'silver' | Material, has: number, need: number) => `${name}: junte ${need} ${what === 'silver' ? 'prata' : PRODUCT[what]} · ${Math.floor(Math.max(0, has))}/${need}`,
      road: (name: string, site: 'altar' | 'temple') => `${name}: ligue ${site === 'altar' ? 'o altar' : 'o Templo'} à rua`,
      start: (name: string, site: 'altar' | 'temple') => `${name}: toque no ${site === 'altar' ? 'altar' : 'Templo'} para começar`,
      builders: (name: string, n: number, of: number) => `${name}: ponha construtores · ${n} de ${of}`,
      going: (name: string, p: number, work: number, left: number) => `${name} ${p}/${work} · pronto em ~${left} sem`,
      /** A built goal's building off the road ("Oficina: ligue à rua"). */
      offRoad: (kind: BuildingKind) => `${BUILDINGS[kind].name}: ligue à rua`,
      /** Houses of a level: the service the house nearest to climbing lacks. */
      service: (kind: Exclude<NeedKind, 'road'>, level: number) =>
        kind === 'sacred' ? `Restaure o altar e mantenha as ofertas de gado: as ${HOUSE_PLURAL[level]} precisam dele` : `Construa ${({ plaza: 'uma praça', market: 'um mercado', park: 'um parque' } as const)[kind]} perto das ${HOUSE_PLURAL[level]}`,
      locked: (kind: NeedKind, goal: number) => `${T.need[kind]} libera no objetivo ${goal}`,
      houseRoad: 'Ligue as casas à rua',
      altarRuins: 'Casas de pedra pedem o altar: restaure o altar',
      nearAltar: 'Casas de pedra só perto do altar: construa perto dele',
      material: (n: number, m: Material) => `Faltam ${n} de ${PRODUCT[m]} para as casas subirem`,
      moreHouses: (have: number, target: number) => `Construa mais casas: ${have} de ${target}`,
      climbing: (n: number) => `As casas sobem em ~${weeks(n)}`,
      /** Houses goal short of families, an empty plot ready: who fills it, and when. */
      familyByCaravan: (n: number) => `Terreno pronto: uma família vem com a caravana em ~${weeks(n)}`,
      familyByWedding: 'Terreno pronto: espere o próximo casamento',
      couples: 'Construa uma casa: casais esperam casa',
      caravan: (missing: number, w: number) => (missing ? `Deixe ${missing === 1 ? '1 casa vazia' : `${missing} casas vazias`}: caravana em ${w} sem` : `Caravana em ${w} sem: há casa para todos`),
      caravanSoon: 'Deixe 1 casa vazia: a caravana vem logo',
      noBirths: 'Mais comida guardada: só assim nascem crianças',
      grow: 'As crianças crescem: enquanto isso, suba as casas',
      wedding: 'Jovens vão se casar: deixe uma casa vazia',
      winter: 'Passe o inverno: guarde comida e lenha',
      foodUntilSpring: (p: number, t: number) => `Comida até a primavera: ${Math.min(p, t)}/${t} sem. Pesque e colete`,
      year: (y: number) => `Este objetivo abre no Ano ${y}`,
      calm: 'Tudo em ordem: aproveite a cidade',
    },
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
      materials: 'Materiais',
      /** Stock and what comes in a week ("20 · +1,5/sem"). */
      materialRow: (stock: number, perWeek: string) => `${stock} · ${perWeek}`,
      waiting: (m: Material) => `Casas esperando ${PRODUCT[m]}`,
      stumps: 'Tocos (árvores cortadas)',
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
      freeJobs: 'Vagas livres',
      /** Tab Povo: who works of the adults, and how many have no job. */
      workLine: (working: number, adults: number, idle: number) => `Trabalho: ${working} de ${adults} adultos${idle ? ` · ${idle} sem vaga` : ''}`,
      houses: 'Casas',
      happiness: 'Alegria',
      why: 'Altar, praça, mercado e parque alegram; fome e desemprego entristecem.',
      /** Tab Povo. */
      people: 'Pessoas',
      bands: { child: 'Crianças', adult: 'Adultos', elder: 'Idosos' } satisfies Record<AgeBand, string>,
      thisYear: 'Este ano (desde o outono)',
      births: 'Nascimentos',
      deaths: 'Mortes',
      coldDeaths: 'De frio',
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
        lumber: ['Lenhador', 'Lenhadora'],
        quarry: ['Canteiro', 'Canteira'],
        workshop: ['Artesão', 'Artesã'],
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
      /** An adult without a job while every job is taken. */
      noJobFull: 'Sem trabalho: todas as vagas estão cheias',
      /** A farmer in winter: the field is frozen, the farmer stays. */
      winterRest: (job: string) => `${job} · descansa no inverno`,
      /** An elder does not work. */
      elderRest: (sex: Sex) => (sex === 'f' ? 'Descansa (idosa)' : 'Descansa (idoso)'),
      /** The button that changes a person's job, and the short list it opens. */
      change: 'Mudar',
      changeTitle: 'Mudar de trabalho',
      /** One free job in the list: the building and its crew. */
      option: (name: string, crew: number, seats: number) => `${name} ${crew}/${seats}`,
      noOption: 'Nenhuma vaga livre: construa um lenhador, campo ou oficina',
      leaveJob: 'Sem trabalho',
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
      dayNight: 'Dia e noite',
      music: 'Música',
      volume: 'Volume',
      volumeValue: (v: number) => `${Math.round(v * 100)}%`,
      on: 'ligado',
      off: 'desligado',
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
      /** Ready to climb, but the city lacks this much of a material (the count stays at 13/13). */
      waiting: (name: string, n: number, m: Material) => `Pronta para virar ${name}: falta ${n} de ${PRODUCT[m]}`,
      /** Ready and the wood is there, but in autumn and winter it is the firewood (it climbs in spring). */
      firewoodHold: (name: string) => `Pronta para virar ${name}: a madeira é a lenha do inverno`,
      /** What climbing costs, besides the gains. */
      asks: (m: Materials) => `Ao evoluir: pede ${materialsText(m)}`,
      stump: (weeks: number) => `Toco · vira árvore de novo em ${weeks} sem. Dá para construir em cima`,
      /** The field bonus a connected workshop is giving the city now. */
      fieldBonus: (pct: number) => `Campos da cidade: +${pct}% de comida`,
      plotNoRoad: 'Sem rua: ninguém se muda para cá. Ligue à rua',
      plotWaiting: 'Casa vazia: espera um casal ou uma família da caravana',
      /** A service building's next level: silver, then the stone it asks ("Melhorar · 60 · 20 pedra"). */
      upgrade: (cost: number, m: Materials = {}) => `Melhorar · ${cost}${materialsText(m) ? ` · ${materialsText(m).replaceAll(' de ', ' ')}` : ''}`,
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
      noSource: { river: 'Longe do rio: não pesca nada', tree: 'Sem árvores por perto: não colhe nada', rock: 'Sem rochas por perto: não tira pedra', grass: 'Sem capim livre por perto: não dá gado' } satisfies Record<GatherSource, string>,
      happiness: (value: number, mood: Mood, why: string) => `Alegria ${value}, ${T.mood[mood]}${why ? ` (${why})` : ''}`,
      serves: (n: number) => `Atende ${n} ${n === 1 ? 'casa' : 'casas'}`,
      upkeep: (n: number) => `${fmt2(n)} por semana`,
      connected: 'ligado à rua',
      disconnected: 'sem rua: não funciona, mas paga manutenção',
      noWorkers: 'Ninguém trabalha aqui: abra Profissões',
      /** An empty workplace when no adult can be moved (B2 measured). */
      noAdults: (children: number) => `Ninguém trabalha aqui: faltam adultos${children ? ` (${children} ${children === 1 ? 'criança' : 'crianças'} na cidade)` : ''}`,
      /** The upkeep of an empty workplace (it pays a share). */
      upkeepEmpty: (n: number) => `${fmt2(n)} por semana (vazio: metade)`,
      /** The crew of a workplace: who works there of its jobs. */
      crew: (n: number, seats: number) => `Trabalhadores ${n}/${seats}`,
      fewWorkers: (pct: number) => `Faltam trabalhadores: rende ${pct}%`,
      altar: 'Centro da cidade, onde as ruas começam.',
      road: (linked: boolean, entrance: boolean) => `${entrance ? 'Rua · entrada da cidade' : 'Rua'} · ${linked ? 'ligada ao altar ✓' : 'não ligada ao altar ✗'}`,
      tree: (name: string) => `${name} · Demolir corta por ${RULES.treeClearCost} prata`,
      rock: (name: string) => `${name} · não dá para construir aqui`,
      where: { plaza: 'Onde pôr uma praça', market: 'Onde pôr um mercado', park: 'Onde pôr um parque', lumber: 'Onde pôr um lenhador', quarry: 'Onde pôr uma pedreira', road: 'Ligar à rua' },
      noSpot: 'Nenhum lugar livre por perto: abra uma rua ao lado',
      demolish: 'Demolir',
      confirm: 'Certeza?',
      close: 'Fechar',
    },
  },
  /** The city in 3D (the 3D button of the left column and its view). */
  view3d: {
    turnLeft: 'Girar para a esquerda',
    turnRight: 'Girar para a direita',
    /** Label over the 3D view: "Primavera · Ano 2". */
    label: (season: Season, year: number) => `${T.nova.seasonName[season]} · Ano ${year}`,
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

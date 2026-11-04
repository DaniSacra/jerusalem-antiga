# Pacote "Povo": especificação (game-director, 2026-11-04)

Base: pedido do usuário (`pedido-povo.md`, que manda), `plano-sobrevivencia.md` (atualizado),
`docs/design.md`, `docs/GAME_DESIGN.md`, o código no main 3ab0f46 (`src/core`, `src/data`,
`tools/sim`), `plano-p3.md` (estacionado) e os relatórios `sim-tester-p2-fim.md` e
`playtester-p2-final.md`. Nada foi implementado por este plano.

Marcação: **[REC]** = recomendação do diretor; a decisão final é do usuário (seção 10). Os números
são iniciais: o sim-tester calibra com as alavancas da seção 8.4.

## 0. Pilares e escopo

| Item | Fortalece | Risco | Controle |
|---|---|---|---|
| Pessoas com nome, idade, profissão, família | Pessoas com história; Contemplação (apego); Cidade viva | Simples: muita informação | O mapa não muda; nomes só no balão da casa e na ficha. O topo continua com um número só (Moradores) |
| Casamento pede casa; nascimento pede espaço, comida e alegria | Posicionar bem e Evoluir em vez de multiplicar (a casa melhor é onde nascem os filhos); O cuidado decide o ritmo | Crescimento travado sem explicação | Toda trava tem uma frase: "Casal esperando casa", "Sem filhos: casa cheia", "Sem filhos: a comida não dura até a primavera" |
| Fim da porta das famílias; caravanas raras e anunciadas | Ritmo contemplativo (sem relógio); Dificuldade em camadas | Cidade parada no começo | Noivos já na caravana inicial; marcos e objetivos de pessoas a cada ~2 min |
| Mortes por idade | Pessoas com história (gerações) | Tristeza para 12–17 anos | Aviso discreto, sem efeito no mapa; morte só de idosos |
| Celeiro, mercado e oficina com níveis (um mecanismo) | Evoluir em vez de multiplicar; destino para a prata | Mais um botão | Ação principal "Melhorar" no balão que já existe |
| Manutenção desde a construção, crescendo com tamanho e nível | Sobrevivência (sem degrau do Ano 2) | Dívida cedo | Valores pequenos no começo (0,5) |
| Pescador e Coletora a 30% no inverno; casas sobem em 11–15 sem | Sobrevivência (inverno pesa); Cidade viva (bairro não sobe junto) | Fome demais | Alavanca: consumo do inverno de volta a 1,25 |

**Uma mecânica por vez:** a mecânica nova é **o povo** (pessoas, idades, casamentos, nascimentos,
mortes, caravanas). Os níveis de construção, a manutenção, o inverno e o tempo das casas são
**ajustes de ritmo pedidos pelo usuário no mesmo pacote** (exceção registrada, como o P1 "Ritmo").
Nada de doenças, eventos, lenha, madeira, pedra, alojamento ou governo.

## 1. Modelo de dados

### 1.1 Pessoa (`src/core/types.ts`)
```ts
export type Sex = 'm' | 'f';
export type AgeBand = 'child' | 'adult' | 'elder';
export type EndCause = 'age' | 'famine' | 'road' | 'demolished' | 'noHouse';

export interface Person {
  id: number;            // do mesmo contador s.nextId
  name: string;          // nome próprio (names.json)
  sex: Sex;
  clan: number;          // índice em names.json > clans (sobrenome de família, herdado do pai)
  birthWeek: number;     // pode ser negativa (nasceu antes do jogo)
  houseId: number | null;// null: a caminho (caravana andando), não conta nem come
  fatherId: number | null;
  motherId: number | null;
  spouseId: number | null;   // noivo(a) ou cônjuge (vivo ou morto)
  engaged: number | null;    // semana do noivado; null depois do casamento (ou sem noivado)
  caravan: number | null;    // 0 = caravana inicial, 1..3 = caravanas raras, null = nasceu na cidade
  end?: { week: number; cause: EndCause }; // só em s.departed
}
```
- **Filhos não são guardados**: `childrenOf(s, id)` procura quem tem `fatherId` ou `motherId` igual
  (DRY, sem estado duplicado).
- **Profissão não é guardada**: `jobsOf(s)` (pura) liga adultos a vagas do ano (seção 4.3).
- **Família / casa** = todas as pessoas com o mesmo `houseId`. Não há objeto "família" no estado.
  `household(s, houseId)` é pura.
- Nome na tela: "Natã, filho de Baruque" quando o pai está nos registros (vivo ou não); senão
  "Natã, da família de Parós". Mulher: "filha de". A ficha mostra os dois.

### 1.2 `GameState` (enxuto, JSON puro)
- `+ people: Person[]` vivos (na cidade ou a caminho).
- `+ departed: Person[]` mortos e quem foi embora (com `end`), para a árvore da família e as
  contas do ano. Uma partida tem ~200–400 pessoas no total: barato.
- `+ caravans: CaravanPlan[]` sorteadas no início (seção 3.5):
  `{ week: number; families: number; warn: number; status: 'planned' | 'announced' | 'arrived' | 'skipped'; housed: number; left: number }`.
- `Family` (quem anda pela rua) ganha `members: number[]` (ids). Serve para a caravana e para o
  casal que se muda. `houseId` = casa de destino.
- `Building` ganha:
  - `upWeeks: number` (casas: semanas sorteadas para o próximo nível, 11–15);
  - `emptyLevel: number` (casas: nível guardado quando a casa fica vazia; 0 nas outras);
  - `level` passa a valer também para celeiro, mercado e oficina (1 ao construir; altar e o resto
    ficam 1 e não sobem).
- `+ yearStats: { births: number; deaths: number; weddings: number }`, zerado a cada outono.
- `- lastFamilyWeek` (sai).
- `start` passa a `{ families, foodWeeks, couple: [number, number] }` (ids dos noivos da abertura).

**Invariante mantido:** casa com `level ≥ 1` ⇔ tem gente morando. Quando a última pessoa sai ou
morre, `emptyLevel = level` (tenda: 0, a tenda vai com a família) e `level = 0`. Quem se muda
depois entra em `max(1, emptyLevel)` e zera `emptyLevel`. Assim os ~20 lugares que hoje usam
`level > 0` como "tem família" continuam certos. Casa vazia não sobe nem cai. O desenho de um
terreno com `emptyLevel ≥ 2` é a casa daquele nível, de porta fechada e sem fumaça (sprite-artist).

### 1.3 Números derivados (sem estado novo)
- Moradores = pessoas com `houseId !== null`. Por casa: `household(s, id).length`.
- Crianças, adultos, idosos: por `ageBand(p, week)`.
- **Trabalhadores = adultos** na cidade (sai `workerShare`).
- Comida = soma por pessoa: `food[band] × fator do inverno` (tenda × `tentFoodFactor`, outras ×
  `foodFactor`), pelo nível da casa onde mora.
- Nascimentos, mortes e casamentos do ano: o contador `s.yearStats` (os casamentos não ficam
  guardados em outro lugar; nascimentos e mortes também poderiam vir de `birthWeek` e
  `departed[].end`, mas um contador só é mais simples).
- `peakPopulation`, histórico e objetivos de moradores continuam lendo "moradores".

### 1.4 Gerador de nomes (`src/core/names.ts`, listas em `src/data/names.json`)
- `pickName(s, sex, rng)`: sorteia na lista do sexo, evitando nomes de pessoas vivas; quando
  acabarem, repete. Determinístico pelo rng do jogo.
- Grafia da ARA. Fora da lista de propósito: Esdras, Neemias, Zorobabel, Josué, Ageu, Malaquias,
  Sambalate, Tobias, Noadia (personagens da história futura ou vilões).
- `src/data/names.json`:
```json
{
  "male": ["Abias", "Adaías", "Amarias", "Asaías", "Azarias", "Baruque", "Benaia", "Berequias",
    "Daniel", "Eliasibe", "Eliézer", "Elnatã", "Ezequias", "Gedalias", "Hananias", "Hasabias",
    "Hatus", "Hilquias", "Jaziel", "Jedaías", "Joel", "Joiada", "Jônatas", "Maaseias", "Malquias",
    "Matanias", "Meremote", "Mesulão", "Micaías", "Natã", "Obadias", "Pedaías", "Refaías", "Salum",
    "Selemias", "Semaías", "Sefatias", "Uziel", "Zacarias", "Zebadias"],
  "female": ["Abigail", "Abital", "Ada", "Ana", "Azuba", "Basemate", "Débora", "Diná", "Ester",
    "Hagite", "Hamutal", "Hulda", "Jedida", "Jemima", "Jerusa", "Joquebede", "Judite", "Lia",
    "Maaca", "Merabe", "Mical", "Miriã", "Naamá", "Noemi", "Quézia", "Raquel", "Rebeca", "Rute",
    "Sara", "Séfora", "Selomite", "Tamar", "Zeruia", "Zilpa"],
  "clans": ["Parós", "Sefatias", "Ara", "Paate-Moabe", "Elão", "Zatu", "Zacai", "Bani", "Bebai",
    "Azgade", "Adonicão", "Bigvai", "Adim", "Ater", "Besai", "Jora", "Hasum", "Gibar", "Harim",
    "Imer", "Pasur", "Jedaías"]
}
```
- Cada família de caravana ganha um clã ainda não usado (repete quando acabar). Filho herda o clã
  do pai; a mulher mantém o seu.
- Os clãs são nomes de famílias de Esdras 2 / Neemias 7, usados só como sobrenome. Não é história
  nem versículo (pilar 10 intacto).

## 2. Idades

### 2.1 Escala **[REC]**: 1 estação = 1 ano de vida
- `weeksPerLifeYear` 13: cada pessoa faz aniversário uma vez por estação, na semana em que
  `(week − birthWeek) % 13 === 0` (aniversários espalhados pelas 13 semanas).
- 1 ano de jogo = 4 anos de vida; a partida de ~10 anos de jogo = ~40 anos de vida. A criança que
  nasce no Ano 2 vira adulta no Ano 5–6 e se casa no Ano 6; os fundadores de 30–40 anos chegam aos
  70–80 no fim. Uma regra fácil de dizer: "aqui, cada estação é um ano de vida".
- Alternativa medida se a primeira falhar: 1 ano de jogo = 5 anos de vida (`weeksPerLifeYear`
  10,4; aniversários menos regulares).

### 2.2 Faixas (`rules.json > people`)
| Faixa | Idade | Trabalha | Come por semana | Ícone |
|---|---|---|---|---|
| Criança | 0–13 | não | **0,25** | criança |
| Adulto | 14–49 | sim | **0,2** | adulto |
| Idoso | 50+ | não | **0,15** | idoso de cajado |

"Criança come mais que adulto" é pedido do usuário: torna cada filho um custo real. Mistura
esperada (35% crianças, 50% adultos, 15% idosos) dá ~0,21 por pessoa e ~50% de trabalhadores, perto
dos números de hoje (0,2 e `workerShare` 0,5): a economia continua coerente.

### 2.3 Morte por idade (só idosos; doenças são outro pacote)
- No aniversário, a pessoa morre com a chance da sua idade (`people.death`, por ano de vida):

| Idade | 50–59 | 60–69 | 70–79 | 80–89 | 90 |
|---|---|---|---|---|---|
| Chance | 2% | 6% | 15% | 35% | 100% |

- Quem chega aos 50: ~82% passa dos 60, ~44% dos 70, ~9% dos 80; idade típica de morte ~68 ("Morreu
  Ezequias, aos 71 anos"). Fundadores morrem a partir do Ano 3–4; avós da caravana, no Ano 2–4.
- Ao morrer: vai para `departed` com `end.cause 'age'`; o cônjuge continua com `spouseId` (viúvo).
  Evento `death { id, name, age, x, y }`. Toast discreto (cinza), sem efeito no mapa.
- Fome e falta de rua continuam fazendo **a família inteira** ir embora como hoje (seção 3.6).

## 3. Casamentos, mudanças, nascimentos e caravanas

### 3.1 Noivado (toda semana, depois dos aniversários)
- Pode noivar: adulto **nunca casado** (`spouseId === null`), entre **18 e 40** anos
  (`marriageAges`). **[REC]** viúvos não se casam de novo neste pacote.
- Para cada homem que pode noivar, chance **0,05 por semana** (`marriageChance`) se existir uma
  mulher que pode noivar **de outra casa**, sem pai ou mãe em comum com ele, com no máximo 15 anos de
  diferença (`maxAgeGap`). Escolhe a de idade mais próxima (empate: menor id). Os dois ficam
  `engaged = semana`, `spouseId` um do outro.
- Espera média ~20 semanas: quem faz 18 casa por volta dos 19–20.

### 3.2 Casamento = mudança para uma casa vazia
- Toda semana, cada casal noivo (do mais antigo ao mais novo) procura uma casa: **casa vazia**
  (`level 0`, ligada à rua, sem ninguém a caminho), a de maior `emptyLevel`, e no empate a mais
  perto da casa do noivo. Achou: casamento (`engaged = null`, `yearStats.weddings++`, evento
  `wedding`, marco `firstWedding` na primeira vez) e o casal **anda** da porta da casa do noivo até a
  casa nova (um `Family` com os dois; a casa fica reservada). Ao chegar: `houseId` dos dois = casa
  nova, a casa vira tenda (ou `emptyLevel`).
- **Exceção:** se um dos dois já mora **sozinho**, o outro vai para a casa dele (casamento na mesma
  semana, sem casa nova).
- Sem casa: o casal espera nas casas dos pais e entra no aviso "Casal esperando casa: construa uma
  casa". **[REC]** Depois de **52 semanas** de espera (`coupleWaitWeeks`) o casal vai embora da
  cidade (`end.cause 'noHouse'`), com o aviso "Natã e Débora vão embora em N sem: falta casa" nas
  últimas **13** (`coupleWarnWeeks`). Alternativa: esperar para sempre (sem pressão).
- Rota cortada no caminho: recalcula como hoje; casa demolida: o casal volta a esperar.

### 3.3 Idoso sozinho vai morar com um filho **[REC]**
- Toda semana: um idoso que mora sozinho vai para a casa de um filho ou filha com espaço (a de maior
  nível; empate, a mais perto). Anda como o casal. A casa dele fica vazia (com `emptyLevel`) para
  outro casal. É o "às vezes avós" do pedido e libera casa sem custo para o jogador.

### 3.4 Nascimentos
- Casal pode ter filho quando: os dois moram **na mesma casa** (casa própria); a mãe tem **18–40**
  (`fertileAges`); a casa **não está cheia** (pessoas < capacidade); o último filho da mãe nasceu
  há **26 semanas** ou mais (`birthGapWeeks`, lido do `birthWeek` do filho mais novo, sem estado);
  e a cidade deixa (abaixo).
- Cidade deixa (`birthBlock(s)`, uma vez por semana, reaproveita a porta das famílias de hoje):
  - `famine` → nenhum nascimento;
  - `food`: a previsão não chega à próxima primavera com reserva de **2** semanas
    (`birthFoodReserveWeeks`, o antigo `familyFoodReserveWeeks`);
  - `storage`: chegaria, mas o estoque corta (seta para o celeiro);
  - `null` → pode.
- Chance por semana = **0,03** (`birthChance`) × fator da alegria (`birthMin` 0,5 a `birthMax` 1,5,
  a escala de hoje `familyMin/Max`; 1 antes do Parque). ~1,5 filho por ano de jogo por casal livre,
  limitado pela casa: **a casa melhor é onde a família cresce.**
- Bebê: sexo 50/50, nome sorteado, clã do pai, `caravan null`, mora com os pais. Evento `birth`;
  marco `firstBirth`. Toast pequeno "Nasceu Miriã, filha de Natã e Débora".
- Casa que cai de nível (fome) e fica acima da capacidade: ninguém sai; só não nascem filhos.

### 3.5 Caravanas
- **Caravana inicial (continua como está):** 2–4 famílias em tendas ao norte do altar, comida para
  14–22 semanas do consumo delas (estoque sem celeiro agora 100). Muda só quem vem: cada família sai
  de um modelo (`people.templates`, peso):

| Modelo | Pessoas | Peso |
|---|---|---|
| Casal com filho jovem | homem 36–46, mulher 34–44, jovem 12–19 | 3 |
| Casal com criança | homem 24–34, mulher 22–32, criança 0–8 | 3 |
| Casal jovem | homem 20–26, mulher 18–24 | 2 |
| Casal com avó/avô | homem 24–32, mulher 22–30, idoso 52–62 (pai ou mãe de um deles) | 1 |

  **[REC] Noivos na abertura:** as duas primeiras famílias são sempre "casal com filho jovem", com
  jovens de 18–19 anos e sexos opostos, **já noivos** (`start.couple`). A frase de abertura ganha a
  segunda linha "Natã e Débora querem se casar". Isso liga o tutorial, o objetivo 1 e o primeiro
  marco ao povo desde o primeiro minuto. O sexo dos outros jovens alterna entre as famílias
  (equilíbrio para casamentos no Ano 2).
- **Caravanas raras** (`caravans.later`), sorteadas na criação do jogo (semana e número de famílias):

| # | Chega entre | Famílias | Chance |
|---|---|---|---|
| 1 | Ano 2 primavera – Ano 3 verão (semanas 78–155) | 2–3 | 100% |
| 2 | Ano 5 – Ano 6 (semanas 208–311) | 2–4 | 100% |
| 3 | Ano 7 – Ano 8 (semanas 312–415) | 2–3 | 50% |

  Duas ou três por partida, como pedido. **[REC]** A 3ª só em metade das partidas.
- **Aviso:** 4–8 semanas antes (`warnWeeks`, sorteado): evento `caravanAnnounced`, toast "Uma
  caravana de 3 famílias chega no verão" e aviso na lista: "Caravana com 3 famílias em 6 sem:
  faltam 2 casas vazias" (laranja quando faltam casas; verde "tem casa para todas").
- **Chegada:** cada família (mesmos modelos, sem noivos) pega uma casa vazia (maior `emptyLevel`,
  depois mais perto da entrada) e **anda** da entrada até ela; famílias sem casa vão embora na hora.
  A caravana traz comida para **4–8 semanas** do consumo dela **[REC]** (cortada no estoque). Evento
  `caravanArrived { housed, left }`, comemorado como marco (brilho na entrada e moradores
  reunidos), marco `firstCaravan` na primeira com pelo menos 1 família que ficou. Toast "Chegou a
  caravana: 3 famílias ficaram" ou "2 famílias ficaram; 1 seguiu viagem: faltou casa".
- Casais esperando e caravana disputam as mesmas casas, sem reserva (KISS); o aviso da caravana
  conta os casais: "faltam 2 casas (1 casal também espera)".

### 3.6 Quem vai embora
- **Fome:** como hoje (tenda 20%, 35% no inverno; acima de tenda cai um nível com 12%). A tenda
  abandonada leva **todos** os moradores (`end.cause 'famine'`): "A família de Baruque foi embora:
  fome".
- **Sem rua:** como hoje (tenda que vira terreno leva a família, `'road'`).
- **Demolir casa com gente:** a família vai embora (`'demolished'`); a prévia de Demolir diz "3
  pessoas vão embora" e o balão pede "Certeza?" como hoje.
- Ninguém morre de fome neste pacote.

### 3.7 O que sai: a porta das famílias
| Onde | Hoje | Vira |
|---|---|---|
| `rules.json` | `familyChance`, `familyIntervalWeeks`, `familyFoodReserveWeeks`, `workerShare`, `upkeepStartsAfterGoal`, `caravan`, `happiness.familyMin/Max` | saem; entram `people`, `caravans`, `birthFoodReserveWeeks` (em `people`), `happiness.birthMin/Max` |
| `families.ts` | `familyBlock`, `FamilyBlock`, `dispatchFamilies`, `openPlot`, `startCell` | `birthBlock` (só `famine`/`food`/`storage`) vai para `people.ts`; `moveFamilies` fica e passa a mover `members` (caravana, casal, idoso); `startCell` fica para a caravana |
| `happiness.ts` | `familyFactor` | `birthFactor` |
| `economy.ts` | `upkeepCharged`, `workerShare`, `HOUSE_LEVELS[l].residents` | sem trava; trabalhadores = adultos; pessoas reais |
| `forecast.ts` | `plannedEating` (capacidade no nível planejado), `extraTents`, `workerShare` | consumo e adultos das pessoas reais (sem nível planejado: casa que sobe não traz gente sozinha); `reserveWeeks` e `unlimited` ficam |
| `readouts.ts` | `CityReadout.block` | `CityReadout.births` (`birthBlock`); `upgradeGain` mostra a **capacidade** ganha |
| `goals.ts` | evento `upkeepStart`; `TEMPLE_GOAL` pelo `fromYear` | sai o evento; `TEMPLE_GOAL` = o objetivo antes da vitória |
| `simulation.ts` | `dispatchFamilies`; marco `firstFamily` | `stepPeople` e `stepCaravans` (seção 5.6); `firstFamily` sai (vira `firstWedding`) |
| `state.ts` | `lastFamilyWeek`, `foundCaravan` | `foundCaravan` cria pessoas; `rollCaravans` |
| `types.ts` | `MilestoneId 'firstFamily'`, evento `upkeepStart`, campos de `Rules` | ver 1.2 e 6.3 |
| `tutorial.json` / `tutorial.ts` | passo `family`, `familyStepMaxWeeks`, `reasonTools`, `winterReasonTools`, extra `upkeep`, `reasonTool()` | passo `wedding` ("Natã e Débora vão para a casa nova!"), termina no marco `firstWedding` ou em `weddingStepMaxWeeks` 6; saem `reasonTools`, `winterReasonTools`, `reasonTool` e o extra `upkeep`; o extra `market` fica |
| `src/render` | `strings.ts` (`familyBlock`, `familyBlockText`, `upkeepStart`, "depois do Objetivo N", frase da caravana), `Inspector.ts` (`plotWaiting` + motivo da porta, `upkeepCharged`), `BuildColumn.ts` (`upkeepCharged`), `notices.ts` (aviso da porta), `GameScene.ts` (`upkeepStart`, motivo e seta do passo da família), `Tutorial.ts` (`upkeepStarted`) | textos e avisos novos (seção 7) |
| `tools/sim` | `familyBlock`, `upkeepCharged`, métricas `blocks*` | seção 8 |
| `tests/` | `families`, `economy`, `happiness`, `viability`, `forecast`, `readouts`, `survival`, `helpers` | seção 9.2 |
| `scripts/visual/run.mjs` | cenários com família chegando e porta | cenários novos (seção 9.3) |
| Docs | `GAME_DESIGN.md` (Famílias, Simulação passo 2 e 5, Tutorial passo 6, Objetivos, Marcos, manutenção depois do Objetivo 4) | reescritos na mesma mudança |

## 4. Casas, impostos e trabalho

### 4.1 `houses.json` (`residents` vira `capacity`; `food` sai para `people.food`)
| Nível | Capacidade | Imposto/sem (hoje) | Por pessoa cheia |
|---|---|---|---|
| Tenda | **3** (4) | **1,25** (1,25) | 0,42 |
| Casa de barro | **4** (6) | **1,75** (1,5) | 0,44 |
| Casa de pedra | **6** (10) | **2,5** (2,5) | 0,42 |
| Casa grande | **8** (20) | **3,25** (2,5) | 0,41 |

- Imposto **por casa com gente** (como hoje, × alegria) **[REC]**: a casa paga mesmo meio vazia;
  quem quer prata evolui a casa. Alternativa: imposto por adulto.
- Conta: cidade final de ~25 casas (3 tendas, 8 barro, 9 pedra, 5 grandes) ≈ 56/sem de imposto;
  manutenção ~30–35 → saldo ~+20/sem, perto dos +10–12 de hoje com 600 moradores. A casa grande
  passa a valer mais que a de pedra (o fun-critic pediu).
- Casa sobe em **11–15 semanas** (`weeksToUpgrade: [11, 15]`): `upWeeks` sorteado ao construir e a
  cada mudança de nível; `weeksToNextLevel` usa `upWeeks`. Cair continua 3.

### 4.2 Trabalhadores = adultos
`workers` = adultos na cidade. Eficiência, desemprego (`yearJobs`), alegria e aviso de desemprego
continuam iguais, só com esse número.

### 4.3 Profissão = onde trabalha (`jobsOf(s)`, pura, para a tela)
- Adultos em ordem de id (fundadores primeiro) preenchem as vagas **do ano** (`yearJobs`, campo
  congelado conta) das construções ligadas em ordem de id. Sobra: "sem trabalho". Crianças:
  "criança"; idosos: "idoso/idosa". Só leitura: a economia continua pela eficiência agregada.
- Nomes (copywriter, por sexo): Campo lavrador/lavradora; Pescador pescador/pescadora; Coletora
  coletor/coletora; Celeiro guarda do celeiro; Mercado mercador/mercadora; Oficina pelo ofício
  (oleiro, ferreiro, carpinteiro, tecelão, tintureiro, curtidor e femininos); Templo servo/serva do
  Templo. No inverno o lavrador aparece "lavrador (descansa no inverno)".

## 5. Ritmo

### 5.1 Celeiro e estoque
- `baseFoodStorage` 50 → **100**.
- Celeiro: nível 1 guarda **300**, nível 2 **600**, nível 3 **1000** (seção 5.2).
- Conta: 15 casas × ~3,5 = ~52 pessoas comem ~15/sem no inverno (×1,4, tendas ×1,75) = ~190 por
  inverno, menos pesca e coleta a 30% → 1 celeiro nível 1 (100 + 300) basta. 25 casas × ~5 = ~125
  pessoas ≈ 470 por inverno → nível 2 (700) ou 2 de nível 1 (700). Bate com a meta do usuário.

### 5.2 Um mecanismo de nível para construções de serviço
- `buildings.json`: o objeto da construção é o **nível 1**; `levels` lista os níveis seguintes com
  o que muda (`cost` da melhoria, `upkeep` e o efeito). Função única
  `statOf(b, key)` = valor do nível atual (ou o do nível 1). Usada por `foodCapacity`, cobertura do
  mercado (raio), `fieldBonus`, `upkeep`, `jobs`. Pronto para o P3 pôr `materials` num nível.
- Ação `upgradeBuilding(s, x, y)` em `actions.ts`: falha com `locked` (sem próximo nível), `silver`
  ou `debt`; paga, `level++`, `refreshCity`, evento `buildingUp`. Instantâneo (obras com tempo são o
  P6). Demolir não devolve nada.
- **[REC]** Sem trava por objetivo: o preço é a trava.

| Construção | Nível 1 (construir) | Nível 2 | Nível 3 |
|---|---|---|---|
| Celeiro 3 x 3 | 40 prata · 1/sem · guarda 300 | +60 · 2/sem · 600 | +100 · 4/sem · 1000 |
| Mercado 2 x 4 | 60 · 2/sem · raio 5 | +60 · 3/sem · raio 6 | +90 · 5/sem · raio 7 |
| Oficina 3 x 3 | 50 · 1/sem · +10% dos campos | +50 · 2/sem · +20% | +80 · 3/sem · +30% |

  A soma das oficinas continua com teto `fieldBonusMax` 0,3: uma oficina nível 3 = três de nível 1
  ("evoluir em vez de multiplicar").

### 5.3 Manutenção desde a construção, crescendo com tamanho e nível
- Sai `upkeepStartsAfterGoal`, o evento `upkeepStart`, o extra `upkeep` do tutorial e todo
  "depois do Objetivo N". Toda construção paga desde a semana em que é construída.
- Valores de nível 1 (`buildings.json`): Campo, Praça, Pescador, Coletora (2 x 2) **0,5** (hoje 1);
  Parque **1**; Celeiro **1**; Oficina **1** (hoje 2); Mercado **2** (hoje 4); Templo 0; Rua, Casa,
  Altar 0. Os níveis seguem a tabela 5.2.
- Abertura: 3 tendas pagam ~3,75; pescador + campo + praça custam 1,5 → saldo positivo desde o
  começo.

### 5.4 Inverno
- `gather.winterFactor` **0,3** no Pescador e na Coletora (`buildings.json`): no inverno rendem 30%.
  Vale na semana, na previsão, na prévia ("Rende 1,4 comida/sem no inverno") e no balão.
- `winter.foodFactor` 1,4 e `tentFoodFactor` 1,75 ficam. Alavanca: 1,4 → 1,25 se as derrotas
  passarem de 5%.

### 5.5 Comida que a caravana inicial traz
Sem mudança de regra (14–22 semanas, cortada no estoque, agora 100).

### 5.6 Ordem da semana (`stepWeek`)
1. `refreshCity`; economia; comida, fome, estoque, prata (como hoje, com as pessoas).
2. Casas: subir, cair, fome (abandono leva a família).
3. `week++`; estação nova (seca; outono zera `yearStats`).
4. `stepPeople`: aniversários e mortes → idosos sozinhos se mudam → noivados → casamentos (casas)
   → casais que desistem → nascimentos (`birthBlock` uma vez).
5. `stepCaravans`: anúncio, chegada.
6. `moveFamilies` (caravana, casais, idosos andando).
7. Marcos, histórico, objetivo, dívida.

## 6. Objetivos e marcos

### 6.1 `goals.json` novo (15 objetivos, ~1 a cada 2 min)
| # | Texto | Tipo | Alvo | Prêmio | Libera | Semana esperada (Comum) |
|---|---|---|---|---|---|---|
| 1 | Primeiro casamento | `milestone` firstWedding | 1 | +20 | – | 2–10 (tutorial) |
| 2 | Comida até a primavera | `foodUntilSpring` | – | +30 | Celeiro | 10–26 |
| 3 | Primeiro nascimento | `milestone` firstBirth | 1 | +30 | – | 30–60 |
| 4 | Tenha 3 casas de barro | `houses` 2 | 3 | +40 | Mercado | 50–90 |
| 5 | Chegue a 30 moradores | `residents` | 30 | +50 | – | 80–120 |
| 6 | Receba a primeira caravana | `milestone` firstCaravan | 1 | +50 | Oficina | 80–155 |
| 7 | Tenha 3 casas de pedra | `houses` 3 | 3 | +60 | Parque | 140–190 |
| 8 | Chegue a 60 moradores | `residents` | 60 | +80 | – | 180–230 |
| 9 | Uma criança da cidade virou adulta | `milestone` firstGrownUp | 1 | +80 | – | 210–250 |
| 10 | Tenha 2 casas grandes | `houses` 4 | 2 | +100 | – | 240–290 |
| 11 | Terceira geração | `milestone` thirdGeneration | 1 | +100 | – | 290–360 |
| 12 | Chegue a 100 moradores | `residents` | 100 | +120 | Templo | 340–420 |
| 13 | Tenha 5 casas grandes | `houses` 4 | 5 | +150 | – | 400–470 |
| 14 | Chegue a 150 moradores | `residents` | 150 | +200 | – | 450–620 |
| 15 | Construa o Templo | `build` temple | 1 | vitória | – | junto do 14 |

- Tipo novo único: **`milestone`** (`"milestone": "firstWedding"`); progresso 1 se o marco já foi
  alcançado (vale se aconteceu antes: o objetivo cai na semana seguinte).
- Templo liberado no 12 (o jogador junta prata); a vitória vem com o 14 e o templo erguido (regra
  de hoje: `templeWaitsForGoal`, toast "Templo erguido! A vitória vem com 150 moradores"). O
  `TEMPLE_GOAL` passa a ser o objetivo antes da vitória. **[REC]** Sem `fromYear` no início; é
  alavanca (seção 8.4) se o Eficiente vencer cedo demais.
- Meta do templo: **150** (objetivo 14, índice 13). Medir 120 e 200 com
  `--set goals.13.target=120` e `=200`.

### 6.2 Marcos (`MilestoneId`)
Saem: `firstFamily`. Entram: `firstWedding` (o primeiro casal entra na casa nova), `firstBirth`,
`firstCaravan` (primeira caravana rara com pelo menos 1 família que ficou), `firstGrownUp` (alguém
**nascido na cidade** faz 14 anos), `thirdGeneration` (nasce alguém cujo pai ou mãe **nasceu na
cidade**). Ficam: `firstMud`, `firstHarvest`, `firstWinter`, `firstStone`, `yearWithoutFamine`.
Toda chegada de caravana (não só a primeira) tem a comemoração na tela.

"Terceira geração" pelo pedido seria "neto de alguém da caravana inicial"; como os jovens da
caravana já são filhos de fundadores, isso aconteceria no Ano 1–2. Por isso a regra é "filho de
alguém nascido aqui": avô ou avó da caravana, pais nascidos na cidade, neto nascido na cidade
(~Ano 6–7). Texto na lista: "Nasce um neto de quem nasceu na cidade".

### 6.3 Eventos novos (`GameEvent`)
`wedding { a, b, x, y }`, `birth { id, x, y }`, `death { id, age, x, y }`,
`coupleLeft { a, b }`, `caravanAnnounced { families, week }`, `caravanArrived { housed, left, x, y }`,
`buildingUp { x, y, level }`. `familyLeft` ganha `names` (sobrenome ou nome do mais velho).
Sai `upkeepStart`.

## 7. Telas e textos (rascunhos; o copywriter lapida; ≤ 75 caracteres)

### 7.1 Regras de celular
Nada abaixo de 12 px reais; todo toque ≥ 44 px reais; testar em 844 x 390, 915 x 412 e
1366 x 768.

### 7.2 Balão da casa tocada
- Cabeça: "Casa de barro · 3/4 pessoas" (vazia: "Casa de pedra vazia: espera um casal ou uma
  família da caravana").
- Lista de moradores: ícone da faixa (criança, adulto, idoso), nome e idade, profissão embaixo
  em 12 px. **Celular:** duas colunas de linhas de 44 px (até 4 × 2 = 8 pessoas); **PC:** uma
  coluna. Tocar no nome abre a ficha.
- Linha dos filhos: "Pode ter filhos" (verde), "Sem filhos: casa cheia", "Sem filhos: a comida não
  dura até a primavera", "Sem filhos: o estoque é pequeno. Construa um celeiro", "Sem filhos:
  fome".
- O resto do balão (próximo nível, ao evoluir com "+1 lugar", alegria) continua.

### 7.3 Ficha da pessoa (painel, como as Estatísticas)
- "Natã, filho de Baruque" (17 px), "da família de Parós"; ícone do sexo; "22 anos · adulto";
  profissão; casa (tocar leva a câmera e abre o balão); pais; cônjuge (ou "noivo de Débora", ou
  "viúva de Ezequias"); filhos. Parentes em botões de 44 px; quem morreu aparece apagado com
  "† aos 71"; quem foi embora, "foi embora no Ano 4". Linha final: "Chegou com a caravana do Ano 3"
  ou "Nasceu na cidade no Ano 2".
- Botão Voltar (fichas visitadas) e Fechar.

### 7.4 Balão de celeiro, mercado e oficina
Ação principal dourada **"Melhorar · 60"** com a linha "Nível 2: guarda 600 · 2/sem (hoje 300 ·
1/sem)". Sem prata: cinza com "Falta prata: custa 60". No nível 3: "Nível máximo". O balão da
ferramenta escolhida diz "Guarda 300 · melhora até 1000".

### 7.5 Estatísticas
- Aba nova **Povo** **[REC]**: crianças, adultos e idosos; este ano (desde o outono): nascimentos,
  mortes e casamentos; casais esperando casa; próxima caravana ("Verão do Ano 3 · 3 famílias" ou
  "Nenhuma anunciada"); lista das famílias (sobrenome, pessoas; tocar leva à casa).
- Abas Agora e Histórico como estão.

### 7.6 Avisos (`alerts()`, lista e toast da primeira vez)
Ordem: dívida; fome ou comida curta; **caravana sem casa**; **casal esperando**; estragando;
inverno chegando; seca; **sem nascimentos (motivo da cidade)**; saldo; desemprego.
- "Casal esperando casa: construa uma casa" (2+: "3 casais esperando casa: construa casas")
- "Natã e Débora vão embora em 8 sem: falta casa"
- "Caravana com 3 famílias em 6 sem: faltam 2 casas vazias"
- "Sem nascimentos: a comida não dura até a primavera"

### 7.7 Toasts
- Abertura: "A caravana chegou com 3 famílias e comida para 14 semanas" + "Natã e Débora querem se
  casar"
- "Natã e Débora se casaram!" (bom) · "Nasceu Miriã, filha de Natã e Débora" (info)
- "Morreu Ezequias, aos 71 anos" (discreto, cinza)
- "Uma caravana de 3 famílias chega no verão" · "Chegou a caravana: 3 famílias ficaram" ·
  "2 famílias ficaram; 1 seguiu viagem: faltou casa"
- "A família de Baruque foi embora: fome" · "Natã e Débora foram embora: não havia casa"
- Marcos: "Primeiro casamento da cidade!", "Primeiro bebê nascido em Jerusalém!", "A primeira
  caravana chegou!", "Miriã, nascida aqui, virou adulta!", "Terceira geração: nasceu um neto da
  cidade!"
- Vitória: além de tempo e moradores, "N nascimentos · N casamentos" **[REC]**.

### 7.8 Tutorial
Passos: rua → pescador ou coletora → campo → praça → **casa** ("Natã e Débora querem se casar:
construa uma casa perto da praça") → **casamento** ("Natã e Débora vão para a casa nova!", câmera
acompanha os dois por 2 s, termina no marco ou em 6 semanas). Final: "Muito bem! Casais novos
precisam de casa; casas melhores cabem mais filhos". Tela inicial, passo 2 (copywriter): "Casais
precisam de casa. Tendas perto de uma praça viram casas de barro".

### 7.9 Mapa e arte (sprite-artist)
- Casal andando (dois moradores de mãos dadas) e caravana (grupo com jumento e trouxas), pelo
  walker de família que já existe.
- Nascimento: brilho curto e "+1" na casa (o efeito de subir de nível). Morte: nada no mapa.
- Celeiro, mercado e oficina com 3 desenhos por nível (celeiro: mais silos; mercado: mais
  barracas; oficina: pátio maior).
- Casa vazia com `emptyLevel`: porta fechada, sem fumaça e sem varal.
- Moradores andando: a parte de crianças e idosos acompanha a cidade (`walkers` com peso pela faixa).

## 8. Simulador

### 8.1 Como os bots jogam
| Bot | Casas | Caravana | Celeiro | Casas cheias |
|---|---|---|---|---|
| Eficiente (planejador) | 1 casa vazia à frente dos casais; constrói assim que um casal noiva | ao anúncio, constrói casas para todas as famílias | melhora quando a capacidade < consumo do inverno × 1,2 (melhorar antes de construir outro) | põe praça, mercado e parque onde há casa cheia com casal fértil |
| Comum | depois de ver "Casal esperando" por `delay` 3 sem, 1 casa por casal | depois de ver o aviso por 3 sem, casas para as famílias que faltam (com a falha de `idleChance`) | ao estragar: melhora se der, senão constrói outro | como hoje (balão parado) |
| Distraído | após 2× `delay` e às vezes nunca (`idleChance` 0,3) | muitas vezes não prepara | só ao estragar e só constrói (não melhora) | só com o balão visto |
| Pescador | como o Eficiente, sem campos | igual | igual | igual |
- `plotsAhead` vira "casas vazias à frente" (Eficiente 1, Comum 0, Distraído 0) e a meta de casas =
  casais esperando + famílias anunciadas + `plotsAhead`. Ninguém faz mais casas sem gente para elas.
- `trim()` nunca demole o último celeiro; melhoria de nível entra no `affords` (manutenção nova).
- O Eficiente continua guardando prata para o templo desde o objetivo que o libera.

### 8.2 Métricas novas (`tools/sim/run.ts`, `--brief` e relatório completo)
- **Duração e vitória:** já existem (`winwk`, % por bot).
- **G2 crescimento:** maior razão moradores(Ano N)/moradores(Ano N−1) a partir do Ano 2 (mediana e %
  de partidas com > 2).
- **Pessoas por ano:** casamentos, nascimentos, mortes (Ano 2 em destaque), noivados, casais que
  desistiram, maior espera de casal.
- **Caravanas:** chegadas; famílias que ficaram ÷ total; % de caravanas com todas abrigadas e com ao
  menos uma.
- **Objetivos:** maior intervalo entre objetivos cumpridos (semanas e min, mediana do Comum; o J3
  de hoje já mede a maior espera num objetivo).
- **Inverno:** % com fome em ao menos 1 inverno (existe), derrotas (existe).
- **Dívida Ano 2:** existe (`debtY2`).
- **Celeiros:** máximo ao mesmo tempo (critério ≤ 3), níveis no fim, e no primeiro inverno com ≥ 15
  casas com gente: celeiros ligados e se houve fome.
- **Motivos sem nascimento por ano** (`birthBlock` e "casa cheia"), no lugar das linhas da porta.
- **Estrutura no fim:** crianças/adultos/idosos, idade mediana de morte, sem trabalho.
- Distraído: crise e recuperação (existe), derrota antes da semana 150 (= 8 min, existe).

### 8.3 Critérios de aceite (pedido do usuário; 100 seeds por bot, semana 700, contra 3ab0f46)
| # | Critério | Alvo |
|---|---|---|
| A1 | Vitória do Comum | mediana 25–35 min (semanas 469–656) |
| A2 | Vitória geral | perto de 30% |
| A3 | Eficiente > Comum > Distraído | em taxa e o Eficiente mais cedo |
| A4 | Crescimento | nenhum ano com mais que o dobro do anterior a partir do Ano 2 |
| A5 | Sem objetivo | nenhum intervalo > 4 min (75 sem) entre objetivos, mediana do Comum |
| A6 | Inverno | Comum com fome em ≥ 1 inverno em 40–60%, derrotas ≤ 5% |
| A7 | Dívida | Comum no Ano 2 < 15% |
| A8 | Celeiro | cidade de 15 casas com no máximo 1 celeiro no inverno (teste Vitest + métrica) |
| A9 | Povo | Comum: ≥ 3 casamentos e ≥ 5 nascimentos no Ano 2 (mediana); caravanas abrigam ≥ 1 família na maioria das partidas |
| A10 | Distraído | crise e recuperação; nenhuma derrota antes de 8 min |
| A11 | Celeiros | nenhuma partida do Comum com mais de 3 |
| A12 | Templo | relatar 120, 150 e 200 moradores (A1–A3 em cada) |

O critério antigo "fim do Ano 1 com 6–10 casas" **sai** (não existe mais a porta): novo alvo de
relato, Comum com 4–7 casas com gente no fim do Ano 1.

### 8.4 Alavancas (uma por rodada, nesta ordem)
1. **A9 casamentos no Ano 2 < 3:** peso "casal com filho jovem" 3 → 5; depois `marriageChance` 0,05
   → 0,08; por último **(decisão do usuário)** caravana inicial 2–4 → 3–5 famílias.
2. **A9 nascimentos < 5 ou crescimento lento (A1 > 35 min):** `birthChance` 0,03 → 0,04;
   `birthGapWeeks` 26 → 20.
3. **A4 explosão:** caravana 1 com 2 famílias fixas; depois janela 78–155 → 104–155.
4. **A6 fome fora da faixa:** demais derrotas → `winter.foodFactor` 1,4 → 1,25; pouca fome →
   `winterFactor` 0,3 → 0,2.
5. **A7 dívida:** imposto da tenda 1,25 → 1,5; depois manutenção nível 1 do Mercado 2 → 1,5.
6. **A1–A3 vitória:** meta do templo (120/150/200); templo 800 → 600 se a prata faltar; `fromYear` 8
   no objetivo 14 se o Eficiente vencer antes de 25 min.
7. **A5 intervalo:** trocar a ordem 9 ↔ 10 ou pôr "Tenha 6 casas de pedra" entre 12 e 14.
8. **A8/A11 celeiros:** nível 1 300 → 400; melhoria +60 → +40.

## 9. Implementação

### 9.1 Ordem, quem ajuda e tempo (uma pessoa)
| # | Passo | Quem | Tempo |
|---|---|---|---|
| 1 | Dados: `names.json`, `rules.json > people/caravans`, `houses.json`, `buildings.json` (níveis, manutenção, `winterFactor`), `goals.json`; tipos | main | 1 h |
| 2 | `people.ts` e `names.ts`: criar pessoa, idade e faixa, aniversário e morte, noivado, casamento e mudança, idoso sozinho, nascimentos, `birthBlock`, `household`, `childrenOf`, `jobsOf`; economia e previsão pelas pessoas | main + test-reviewer | 6–7 h |
| 3 | Caravanas: inicial com modelos e noivos, `rollCaravans`, anúncio, chegada, `moveFamilies` com `members`; tirar a porta (tabela 3.7); tutorial `wedding` | main + test-reviewer | 3 h |
| 4 | Níveis de serviço (`statOf`, `upgradeBuilding`), manutenção sem trava, `winterFactor`, `upWeeks`, `emptyLevel` | main + test-reviewer | 2–3 h |
| 5 | Objetivos `milestone`, marcos novos, eventos, `TEMPLE_GOAL` | main + test-reviewer | 1–1,5 h |
| 6 | Interface: balão da casa com moradores, ficha da pessoa, Melhorar, aba Povo, avisos, toasts, tutorial | ui-designer + copywriter | 6–8 h |
| 7 | Arte: casal e caravana andando, nascimento, níveis de celeiro/mercado/oficina, casa vazia, crianças e idosos na rua | sprite-artist | 3–4 h |
| 8 | Bots e métricas (8.1, 8.2) | sim-tester | 3–4 h |
| 9 | Calibração (3–5 rodadas de 4 bots × 100 seeds × 700 sem, mais 120/150/200) | sim-tester + game-director | 4–6 h |
| 10 | Docs (`GAME_DESIGN.md`, `TESTING.md`), cenários visuais, capturas | main | 2 h |
| 11 | Revisões: code-reviewer, test-reviewer, playtester (844 x 390 toque e 1366 x 768), fun-critic (notas e a história de uma família) | agentes | 3 h |

**Total: ~35–43 h de uma pessoa; numa sessão do Claude Code, ~12–15 h.** Maior risco de prazo: a
calibração de A9 (casamentos no Ano 2 com 6–12 fundadores) e o balão de 8 pessoas no celular (pode
pedir uma rodada a mais do ui-designer, ~1 h).

Ordem: 1 → 2 → 3 → 4 → 5 (core verde em `npm test`) → 6, 7 e 8 em paralelo → 9 → 10 → 11. O
`weekSeconds` 3,2 não muda.

### 9.2 Testes Vitest por regra (seeded)
- **Idade:** `ageOf` aumenta 1 a cada 13 semanas a partir de `birthWeek`; faixas nos limites 13/14 e
  49/50; comida por faixa e inverno (tenda × 1,75).
- **Morte:** nunca antes de 50; com rng fixo morre no aniversário com a chance da tabela; 90 sempre
  morre; vai para `departed` com `end`; cônjuge vira viúvo; casa sem ninguém fica vazia com
  `emptyLevel` (tenda: 0).
- **Noivado:** só 18–40, nunca casado, de outra casa, sem pai ou mãe em comum, diferença ≤ 15,
  escolhe a idade mais próxima; viúvo não noiva.
- **Casamento:** com casa vazia ligada → anda e entra, marco `firstWedding`, `yearStats.weddings`;
  escolhe maior `emptyLevel` e depois a mais perto; sem casa espera e aparece no aviso; quem mora
  sozinho recebe o cônjuge sem casa nova; após 52 semanas vai embora (com o aviso nas 13 antes);
  casa demolida no caminho → volta a esperar.
- **Idoso sozinho:** vai para o filho com espaço; sem espaço fica.
- **Nascimento:** só com casal na mesma casa, mãe 18–40, casa com lugar, intervalo ≥ 26 sem;
  `famine`, `food` e `storage` bloqueiam; alegria multiplica; bebê com clã do pai, pais certos, marco
  `firstBirth`; casa acima da capacidade não tem filho.
- **Caravana inicial:** 2–4 famílias, ≤ 3 por tenda, noivos de sexos opostos em casas diferentes,
  comida cortada em 100, frase com os números reais.
- **Caravanas raras:** semanas dentro das janelas, 3ª com 50%, aviso 4–8 sem antes, casa para quem
  cabe (maior `emptyLevel`), as outras vão embora, comida 4–8 sem cortada no estoque, marco
  `firstCaravan` só com ≥ 1 família que ficou.
- **Ir embora:** tenda abandonada na fome leva todos; casa demolida leva a família.
- **Economia:** moradores = pessoas na cidade; a caminho não conta nem come; trabalhadores =
  adultos; imposto por casa com gente; previsão pelo consumo real.
- **Profissão:** `jobsOf` estável, por ordem de id, "sem trabalho" quando sobra.
- **Níveis:** `statOf` lê o nível; melhorar paga, sobe, muda estoque/raio/bônus e manutenção; falha
  sem prata, em dívida e no máximo; teto das oficinas 0,3 com níveis.
- **Manutenção:** cobrada desde a construção (sem objetivo); desligada também paga.
- **Inverno:** pescador e coletora × 0,3 no inverno, também na previsão.
- **Casas:** `upWeeks` entre 11 e 15, sorteado ao construir e a cada nível; sobe em `upWeeks`.
- **Objetivos:** tipo `milestone` (inclusive alcançado antes); `firstGrownUp` só para nascidos na
  cidade aos 14; `thirdGeneration` só com pai ou mãe nascido na cidade; vitória com 150 + templo.
- **Viabilidade (A8):** cidade de 15 casas de barro (~52 pessoas), 2 campos, 1 pescador, 1
  coletora, 1 celeiro nível 1 cheio no começo do inverno → nenhuma semana de fome até a primavera.
- **Tutorial:** passo `wedding` termina no marco ou em 6 semanas.
- **Invariantes:** cada pessoa viva em no máximo uma casa; nenhuma casa ocupada com `level 0`;
  ids únicos entre `people` e `departed`; estado inteiro passa por `JSON.parse(JSON.stringify)`.

### 9.3 Cenários visuais (`docs/TESTING.md`)
`house-people` (balão com 8 pessoas, celular e PC), `person-sheet` (com pais, cônjuge, filhos e um
morto), `granary-upgrade`, `stats-people`, `caravan-announced`, `couple-waiting`,
`tutorial-wedding`. Recapturar os do tutorial e das Estatísticas.

## 10. Decisões pendentes (recomendação; decisão final do usuário)
1. **Escala de idade:** 1 estação = 1 ano de vida **[REC]**, ou 1 ano de jogo = 5 anos de vida.
2. **Faixas:** criança até 13, adulto 14–49, idoso 50+ **[REC]**; ou idoso a partir de 55.
3. **Idade mínima para casar 18** **[REC]** (público de 12–17 anos); trabalho a partir de 14.
4. **Casal sem casa vai embora depois de 52 semanas**, avisado 13 antes **[REC]**; ou espera para
   sempre.
5. **Viúvos não se casam de novo** neste pacote **[REC]**.
6. **Idoso sozinho vai morar com um filho que tenha espaço** **[REC]**.
7. **Noivos já na caravana inicial** ("Natã e Débora querem se casar") **[REC]**.
8. **Imposto por casa** **[REC]** ou por adulto.
9. **Casa vazia guarda o nível** (`emptyLevel`); a tenda vazia vira terreno **[REC]**.
10. **Caravanas:** Ano 2–3, Ano 5–6 e uma 3ª no Ano 7–8 com 50% **[REC]**; trazem comida para 4–8
    semanas **[REC]**.
11. **Níveis de serviço sem trava por objetivo** (só prata) **[REC]**.
12. **Templo com 150 moradores e sem `fromYear`** **[REC]**; o número final sai das rodadas
    120/150/200.
13. **Aba Povo nas Estatísticas** com a lista das famílias **[REC]**.
14. **Se A9 falhar com as alavancas 1 e 2:** caravana inicial 2–4 → 3–5 famílias (muda a "caravana
    como está").
15. **Comida da criança:** criança come 0,25 > adulto 0,2 (pedido do usuário, mantido).

## 11. Pacote 3 "Madeira e pedra": o que recalibrar depois do Povo
O `plano-p3.md` fica estacionado. Ao retomá-lo:
- **Linha de base:** o main com o Povo calibrado, não mais da5a8bb.
- **Critério B** (6–10 casas no Ano 1) sai; usar o relato de casas do Ano 1 do Povo.
- **Gasto de madeira e pedra:** com ~25 casas (e não 58) o gasto das casas cai pela metade; refazer
  as contas da seção 2.1 do P3 (Lenhador `max`, `cutEvery`, Pedreira `max`) e o templo (300 de
  pedra, 150 de madeira).
- **Níveis de serviço:** pôr `materials` nos `levels` (ex.: celeiro nível 2 pede 10 de madeira), em
  vez de só na construção.
- **Números dos objetivos:** "Pedreira no objetivo 2" passa a ser o objetivo de 3 casas de barro
  (hoje o 4); "objetivo 8/9" do P3 vira o 12/14.
- **Trabalho:** com trabalhadores = adultos, refazer W5 (sem vaga na semana 200) na nova linha de
  base.
- **Caravanas:** a inicial e as raras trazem madeira (`startMaterials` vale para todas).
- Alavancas do P3 que deixam de existir: `familyFoodReserveWeeks`, porta das famílias, prêmio do
  objetivo 9.

## 12. Fora deste pacote
Doenças e assistência dos idosos, mortes de crianças, eventos, lenha e frio, madeira e pedra,
alojamento, governo (impostos em %, porção, reserva do celeiro), obras com tempo, viúvos casando de
novo, adoção, nomes escolhidos pelo jogador, história, versículos.

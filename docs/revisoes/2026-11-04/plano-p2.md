# Pacote 2 "Água sai e mapa": especificação (game-director, 2026-11-04)

Base: `plano.md` (roteiro, seção 1), `plano-sobrevivencia.md` (decisões do usuário de 04/11), o P1 "Ritmo"
no main (196cd9d, a06d471, números finais em `docs/design.md`), os relatórios `sim-tester.md`,
`playtester.md`, `fun-critic.md` e `code-reviewer.md` desta pasta, e `src/data/*.json`, `src/core`,
`tools/sim/survival.ts`. O usuário aprovou seguir o roteiro (P2, depois P3). Nada foi implementado
por este plano.

Objetivo do pacote: a água sai do jogo; as casas evoluem por **praça, mercado e parque**; o mapa fica
mais denso em bosques e rochas, pronto para o lenhador e a pedreira do P3. Junto entram a câmera do
tutorial, a fila de toasts e as pendências de interface do P1.

## 0. Pilares
| Item | Fortalece | Enfraquece / risco | Controle |
|---|---|---|---|
| Poço e porta da água saem | Simples (uma regra a menos, um motivo de porta a menos); Sobrevivência (a porta fala só de comida) | O Ano 1 perde uma decisão; as famílias chegam mais | A Praça ocupa o mesmo lugar na abertura (casa de barro); alavanca 1 segura as famílias |
| Praça, mercado e parque | Posicionar bem (os três serviços são escolha de lugar); Evoluir em vez de multiplicar | Uma construção a mais para entender (Praça) | Ela troca o Poço 1 por 1: mesma regra, mesmo tamanho, mesmo raio, mesmo passo do tutorial |
| Altar fora da evolução | Decisão do usuário ("não do altar"); a casa grande vira escolha em qualquer bairro | O centro perde peso | O altar continua dando Alegria (+10) e continua sendo a raiz da rede |
| Mapa mais denso | Contemplação (bosques e afloramentos); Posicionar bem (o terreno pesa) | Menos espaço livre; Coletora mais fácil | Rochas em grupos longe do centro; testes de lugar do templo; alavanca 4 |
| Câmera, toasts, textos do P1 | Simples (o jogador vê o que o tutorial pede; nenhum texto mente) | – | – |

**Uma mecânica por vez:** o P2 não cria regra nova. A Praça é o Poço com outro nome e outra arte. O
Parque é o Jardim com raio maior e uma exigência que já existia (o raio do altar) trocada de dono. A
porta da água e o objetivo `water` só saem. O resto é mapa (números), interface e texto.

## 1. Decisão: o que as casas pedem (reconciliação)
O roteiro (`plano-sobrevivencia.md`, lista de pacotes, item 2) dizia "jardim (praça e parque),
mercado e altar". As decisões do usuário de 04/11 (mesmo arquivo, linha 80) dizem "As casas evoluem
perto de praças, parques e mercados, **não do altar**". A decisão vale mais que a lista: **o altar sai
da evolução das casas.**

| Nível | Pede hoje | Pede no P2 |
|---|---|---|
| Tenda | rua | rua |
| Casa de barro | rua + poço | rua + **praça** |
| Casa de pedra | rua + poço + mercado | rua + praça + mercado |
| Casa grande | rua + poço + mercado + raio do altar (4) | rua + praça + mercado + **parque** |

- "Jardim vira praça e parque" vira **duas construções com a mesma regra** (serviço com raio, como o
  Poço e o Mercado): a **Praça** (pequena, barata, desde o início) e o **Parque** (o Jardim de hoje,
  com raio maior, liberado no meio do jogo). Uma construção só com níveis seria regra nova.
- A casa de barro não pode depender de algo liberado no objetivo 5: por isso a Praça nasce liberada
  e o Parque fica com a casa grande, que já é do meio do jogo.
- **Parque continua liberado no objetivo 5** (como o Jardim). Efeito desejado: hoje os objetivos 5 e
  6 caem na mesma semana (96) porque a casa grande nasce no raio do altar desde o Ano 1. Com o
  parque no objetivo 5, os 150 moradores vêm de casas de pedra, e a primeira casa grande só chega
  13 semanas depois. Isso espalha o Ano 2 (critério J) sem `fromYear` novo.
- **Altar e templo continuam únicos** e continuam dando Alegria (`happiness.sacred` 10, raio do altar
  4, do templo 12). O raio deles passa a valer só para a Alegria. KISS: nenhuma fórmula de Alegria
  muda além dos nomes.

## 2. Números e regras (atual → novo)

### 2.1 `buildings.json`
| Construção | Campo | Atual | Novo |
|---|---|---|---|
| `well` (Poço) | tudo | cost 25, upkeep 3, 2x2, radius 4, supply | **sai** |
| `plaza` (Praça, nova) | – | – | `{ "name": "Praça", "category": "home", "cost": 25, "upkeep": 2, "w": 2, "h": 2, "jobs": 0, "radius": 4 }` |
| `garden` → **`park`** | name | Jardim | **Parque** |
| | cost | 35 | **40** |
| | upkeep | 1 | **2** |
| | radius | 3 | **4** |
| | w × h, jobs, category | 2x2, 0, home | igual |
| `altar`, `temple` | radius | 4, 12 | igual (só Alegria) |
| `workshop`, `field` | `silver` | (não existe nos dados) | o campo `silver` sai de `BuildingDef` e a produção de prata sai do `economy.ts` e do painel (code-reviewer, item 7) |

Por quê: a Praça custa o mesmo que o Poço e cobre o mesmo, para a abertura não mudar de preço.
A manutenção cai de 3 para 2 porque agora há dois serviços de casa (praça e parque) em vez de um, e a
soma por bairro fica parecida (Comum: ~9 poços × 3 = 27/sem hoje; previsto ~7 praças × 2 + ~4
parques × 2 = 22/sem). O Parque com raio 4 cobre 10 x 10 células (o altar cobria 12 x 12); 20 casas
grandes pedem 3 a 5 parques, que viram destino de prata no meio do jogo (critério F).

### 2.2 `houses.json`
- Barro `needs`: `["road", "well"]` → `["road", "plaza"]`
- Pedra: `["road", "well", "market"]` → `["road", "plaza", "market"]`
- Casa grande: `["road", "well", "market", "sacred"]` → `["road", "plaza", "market", "park"]`
- Moradores, impostos e comida: sem mudança.

### 2.3 `rules.json`
- `startUnlocked`: `"well"` → `"plaza"`.
- `happiness.well` 5 → `happiness.plaza` **5**; `happiness.garden` 20 → `happiness.park` **20**;
  `sacred` 10 e `market` 5 iguais.
- `map`: seção 4.
- Sem mudança no resto (famílias, inverno, manutenção depois do objetivo 4, `weekSeconds` 3,2). Os
  ajustes vêm só pelas alavancas da seção 7.

### 2.4 `goals.json`
- Objetivo 5: `"unlock": "garden"` → `"unlock": "park"`. Texto e alvos iguais.
- Nenhum objetivo novo.

### 2.5 O que acontece com cada peça da água
| Peça | Destino |
|---|---|
| `well` em `buildings.json` | Sai. `BuildingKind` troca `'well'` por `'plaza'`. Nenhum id `well` fica no código |
| Necessidade `well` em `houses.json` | Vira `plaza`. `NeedKind` = `'road' \| 'plaza' \| 'market' \| 'park'` (sai `'sacred'` das necessidades) |
| `ServiceKind` / `coverage` | `'plaza' \| 'market' \| 'sacred' \| 'park'`. `sacred` fica só para a Alegria |
| `FamilyBlock` motivo `water` | Sai, com `housesWithoutWater`, `T.familyNoWell` e o texto `water`. A porta fica: `famine`, `food`, `storage`, `wait`, `noPlot` |
| Objetivo tipo `water` | Sai de `goals.ts`, de `GoalDef.type`, de `goalTarget`/`goalProgress` e dos testes (e `familyHouses`, se só ele usa) |
| Alegria do poço (+5) | Vira Alegria da praça (+5). Jardim (+20) vira Parque (+20). `happinessOn` passa a olhar `park` liberado (mesmo objetivo 5) |
| Tutorial, passo `well` | Vira passo `plaza`, no mesmo lugar da ordem: rua → pescador ou coletora → campo → **praça** → casa → família. A seta vai para `campPlazaSpot` (o atual `campWellSpot`, renomeado; o raio 4 alcança as tendas da caravana). `wateredHouseSpots` vira `plazaHouseSpots` |
| Mini passos | Iguais (`upkeep` depois do objetivo 4, `market` depois). O texto do `upkeep` lê o número do objetivo dos dados |
| Ação "Onde pôr" | `well`/`sacred` saem; entram `plaza` ("Onde pôr uma praça") e `park` ("Onde pôr um parque") |
| Arte do poço | **O sprite-artist remove** a textura do poço e a cor dela no `palette.ts` (arte sem uso confunde quem lê o código e o usuário decidiu "poço sai do jogo"). A Praça ganha arte nova: chão de pedra clara, um banco, uma árvore pequena e um toldo; **sem poço nem fonte no meio** (para não parecer que a água voltou). O Parque é a arte do Jardim de hoje |
| Walker `waterCarrier` (aguadeira) | Fica a figura (cântaro na cabeça), muda o destino: `"to": ["plaza", "market"]`. Ela vai buscar coisas na praça e no mercado; é só aparência |
| Ícone do poço na coluna e balão "✗ Poço" | Saem; entram os da Praça e do Parque |
| Saves antigos | **Não existem partidas salvas.** O `localStorage` guarda só `jerusalem.tutorialDone` e as configurações (`settings.ts`); nada a migrar. `tutorialDone` continua valendo |
| Docs | `GAME_DESIGN.md` (construções, casas, porta, objetivos, tutorial, Alegria, mapa), `TESTING.md` (cenários `tutorial-well` → `tutorial-plaza`, `turn-map` com praça, os que citam poço) |

### 2.6 Balão e "libera no objetivo"
- Necessidade trancada aparece no balão com o objetivo que a libera: "✗ Mercado (libera no objetivo
  3)", "✗ Parque (libera no objetivo 5)" (bug 7 do playtester). Hoje `needVisible` esconde a
  necessidade trancada; passa a mostrar com o cadeado.
- A ação principal da casa tocada ("Onde pôr uma praça/um mercado/um parque") só aparece se a
  construção estiver liberada.

## 3. Interface e pendências do P1 que entram
Classificação dos itens dos relatórios de 2026-11-04 e do antigo plano-pacote2.

| Item | Origem | Destino | Motivo |
|---|---|---|---|
| Câmera do tutorial: a câmera desliza até o lugar do passo (praça: `campPlazaSpot`; campo: lugar livre ligado mais perto do altar, função pura nova com teste; pescador/coletora: o lugar sugerido) e o deixa na área livre do celular, fora do balão do tutorial | plano-pacote2 2.6, playtester bug 6 | **ENTRA** | No celular o lugar do pescador fica sob o balão |
| O toast da caravana não cobre o caminho da rua no passo 1; uma rua cortada pela interface avisa | playtester bug 6 | **ENTRA** | O passo não avança e nada explica |
| Fila de toasts: o inspetor segura a fila; aviso que já não vale é descartado; toasts iguais viram um; a seta não cobre a prévia | plano-pacote2 2.7, playtester bug 11 | **ENTRA** | "Casa sem água" depois do poço, "libera no objetivo 1" junto com "Nova construção" |
| Toast final do tutorial: "Construa mais casas: cada uma recebe uma família" | playtester (confusão) | **ENTRA** | Sem ele, o Ano 1 fica parado da semana 18 à 52 |
| Demolir celeiro (e cortar a rua dele): prévia "Perde N de comida" na mira do Demolir. Função pura no core (`foodLostIfRemoved`), com teste | playtester bug 5 | **ENTRA** | O aviso de saldo manda demolir e a comida some sem aviso |
| "✗ Mercado (libera no objetivo 3)" | playtester bug 7 | **ENTRA** (2.6) | – |
| Textos da oficina: aviso de desemprego sem "construa uma oficina" com o bônus no teto; prévia com o total atual e "no teto" | playtester bug 9 | **ENTRA** | Faltou no P1 |
| "Ao evoluir: come +N/sem" com o fator do inverno; imposto com a mesma casa decimal | playtester bug 10, code-reviewer 5 | **ENTRA** | Texto que mente |
| Textos menores: balão do Campo repetido, "Templo … Objetivo 9" → objetivo 8 (o templo agora libera no 8), pílula "0/1" na primavera | playtester bug 12 | **ENTRA** | – |
| Porta mentindo sobre a comida; objetivo 1 com a cidade vazia; "inverno vencido" com fome | playtester bugs 2, 3, 4 | **Conferir** | O código de a06d471 parece já corrigir (`goals.ts:58`, `simulation.ts:101`, `strings.ts:53`). O playtester confirma; se algum voltar, entra |
| Código morto: `silver`/`silverProd`/linha de produção no painel; `harvested` no estado (o sim usa o marco `firstHarvest`) | code-reviewer 7 | **ENTRA** | Limpeza junto com o `water` (KISS) |
| `fieldBonus` simples; `foodPerResident(level, winter)` | code-reviewer 8, 9 | **ENTRA** se couber | Refatoração pequena, sem mudar número |
| Dívida do Comum no Ano 2 (bug 1) | playtester, sim-tester | **Medir** | Resolvido no P1 com a manutenção depois do objetivo 4; o P2 não pode piorar (critério 6.1) |
| Objetivos em dupla (bug 8, J) | playtester, sim-tester | **Medir** | O Parque no objetivo 5 deve separar o 5 do 6 (critério 6.2) |
| Mercado no objetivo 2; objetivo 8 = "350 moradores" `fromYear` 6 | fun-critic | **DEPOIS (alavanca 6)** | Só se o intervalo sem objetivo não melhorar com o Parque |
| Campo 468 → 390; casa grande imposto 2,5 → 3 | fun-critic | **Alavanca** (seção 7) | Equilíbrio, só se medido |
| Marco "N.º inverno vencido" a cada primavera; cartão "Ano N" com recorde | fun-critic | **DEPOIS (P5)** | Combina com "Jerusalém resistiu"; o P2 já tem interface demais |
| Distraído com 67 derrotas | sim-tester D | **P5** | Regra da derrota |
| Inverno com cara de frio (neve) | fun-critic | **P4** | – |

## 4. Mapa (`rules.json > map`, map-designer)
Hoje: rochas [35, 65], oliveiras [45, 75], palmeiras [35, 65], 1 bosque denso de 18 + 2..8 árvores.
Média ~165 células com algo (~10% das ~1.570 livres). Rochas não podem ser demolidas (só árvores, a
5 de prata).

| Campo | Atual | Novo |
|---|---|---|
| `rocks` | [35, 65] | **[70, 100]** (inclui as do afloramento) |
| `olives` | [45, 75] | **[80, 110]** |
| `palms` | [35, 65] | **[50, 80]** |
| `denseGrove.min` | 1 | **2** |
| `denseGrove.trees` | 18 | **24** (o raio 3 dá 49 células; 24 + 2..8 cabe) |
| `denseGrove.distance` | [11, 20] | **[10, 20]** |
| `rockOutcrop` (novo) | – | **`{ "min": 1, "rocks": 12, "radius": 2, "distance": [10, 18] }`**: afloramento garantido, um quadrado 5 x 5 do lado da cidade (oeste do rio) com 12 + 0..4 rochas, tiradas do total de `rocks`. Prepara a pedreira do P3 |
| `clearRadius`, `grassShare`, `river` | 9, 0,45, igual | igual |

- Média nova ~245 células (~16%, +50%). Rochas: ~85, em grupos (`CLUMPS.rock` igual).
- Os segundos bosques e o afloramento usam o mesmo algoritmo do bosque denso (DRY): um laço por
  "grupo garantido" com tipo, quantidade, raio e distância.
- Testes (map-designer + test-reviewer): mesmo seed, mesmo mapa; totais exatos; nada na área livre,
  na rua inicial nem no rio; 2 bosques densos e 1 afloramento em 200 seeds, todos do lado oeste e a
  10–20 da borda do altar; **lugar para o templo 6 x 6 fora da área do altar em 200 seeds** (já
  existe para 100); `campPlazaSpot` livre.
- Visual: o cenário `dense-town` e os de girar o mapa são recapturados; o custo por quadro não pode
  passar de 10% acima do atual (mais árvores desenhadas).

## 5. Core (com testes Vitest)
- `types.ts`, `coverage.ts`, `houses.ts`, `happiness.ts`, `state.ts`: troca de ids (`well` → `plaza`,
  `garden` → `park`, `sacred` fora de `NeedKind`).
- `families.ts`: sai o motivo `water`. Teste: cidade com casas sem praça recebe família.
- `goals.ts`: sai o tipo `water`.
- `tutorial.ts`: passo `plaza`; `plazaHouseSpots`; lugar do campo do tutorial (função pura nova).
- `map.ts`: grupos garantidos (bosques e afloramento).
- `readouts.ts`: ganho ao evoluir com o inverno.
- Função pura `foodLostIfRemoved(s, x, y)` (celeiro ou rua que desliga celeiro).
- Testes: barro só com praça; pedra com praça + mercado; casa grande só com parque (o raio do altar
  não basta); necessidade trancada aparece com o objetivo; Alegria +5 praça, +20 parque, +10 altar;
  porta nunca devolve `water`; objetivo 5 libera `park`; mapa (seção 4); comida perdida ao demolir.

## 6. Critérios de medição (sim-tester)
Comando: `npm run sim -- --seeds 100 --weeks 700`, 4 bots. **Linha de base: a06d471** (o P1 final),
rodada antes de qualquer mudança. Números do P1 final (design.md): Comum 42% de vitórias em ~30 min,
7 derrotas, prata parada 9/100, 9 casas na semana 52; Eficiente 23%; Distraído 4% (67 derrotas).

### 6.1 Não pode piorar
| # | Critério | Alvo |
|---|---|---|
| B | Comum, casas com família na semana 52 (mediana) | 6–10 |
| G | Vitória do Comum: mediana | semana 469–656 (25–35 min a 3,2 s), taxa 30–50% |
| C1 | Derrotas do Comum | ≤ 7 (P1); alvo ≤ 5 |
| C2 | Comum com fome em ao menos 1 inverno | 25–60% (não cair abaixo de 25% com a Coletora mais fácil) |
| I | Comum e Eficiente sobrevivem ao Ano 1 | ≥ 95% |
| D | Distraído: derrotas antes da semana 150 | 0 |
| E | Oficinas ao mesmo tempo | ≤ 4 |
| F | Prata > 300 por > 26 sem, sem templo para juntar (F honesto) | ≤ 9/100 (P1); alvo ≤ 5 |
| H | Aberturas de 2, 3 e 4 famílias | nenhuma melhor em tudo |
| T | Tutorial (bot do playtester) | 0 de 16 perdem no Ano 1 |

### 6.2 Deve melhorar
| # | Critério | Alvo |
|---|---|---|
| J1 | Semanas entre o objetivo 5 e o 6 (Comum, mediana) | ≥ 13 (P1: 0) |
| J2 | Objetivos num mesmo ano (Comum, mediana) | ≤ 3 em qualquer ano (P1: 4 no Ano 2) |
| J3 | Maior intervalo sem objetivo (nova métrica, mediana) | relatar; menor que no P1 (rodar também em a06d471) |
| M1 | Células com árvore ou rocha por mapa (mediana) | ≥ +40% sobre o P1 |
| M2 | Templo com lugar ao ser liberado | 100% dos 4 bots (200 seeds) |

### 6.3 Relatar
Praças e parques construídos (mediana); casas por nível na vitória; casas grandes na semana 260;
motivos da porta por ano (sem `water`; ver se `wait` e `food` sobem); % da comida por fonte (Coletora
do P1: Comum 11%); estrago; prata gasta em Limpar (P1 × P2); manutenção por tipo no Ano 3.

## 7. Alavancas de calibração (uma por rodada, nesta ordem)
1. **Famílias a mais sem a porta da água** (B > 10 ou G cedo): `familyIntervalWeeks` 6 → 7 → 8, depois
   `familyChance` 0,35 → 0,3. Lento demais (B < 6): Praça `cost` 25 → 20.
2. **Casa grande travada** (objetivo 6 > 1 ano depois do 5, ou vitória < 30%): Parque `radius` 4 → 5,
   depois Parque liberado no objetivo 4. Rápida demais: Parque `cost` 40 → 60.
3. **Prata.** Curta (derrotas do Comum > 5 ou dívida no Ano 2 > 35%): Praça `upkeep` 2 → 1, depois
   Parque `upkeep` 2 → 1. Parada (F > 9): Parque `cost` 40 → 60, depois casa 30 → 40.
4. **Comida fácil pela densidade** (Coletora > 16% da comida do Comum, ou C2 < 25%): Coletora `max`
   4,5 → 3,5, depois `perCell` 0,3 → 0,25, depois `denseGrove.min` 2 → 1.
5. **Mapa apertado** (M2 < 100% ou Limpar > +50%): `olives` [80, 110] → [70, 100], depois `rocks`
   [70, 100] → [60, 90]. Nunca mexer no bosque denso nem no afloramento (são do P3).
6. **Ritmo dos objetivos** (J falha): Mercado liberado no objetivo 2 (fun-critic); depois objetivo 8
   "Chegue a 350 moradores" com `fromYear` 6.
7. `weekSeconds` fica 3,2. Nenhum número fora desta lista entra sem o game-director.

## 8. Bots (`tools/sim`, sem tocar em `src/`)
- Saem: o passo "3. Water" inteiro (`dry`, `waterGoal`, `blockWater`, demolir casa seca,
  `dryDemolished`), `well()`, a proteção de poço no `trim`, a métrica `blockWater`.
- `planWells` (Eficiente) vira `planPlazas`: casa nova só onde já há praça; sem lugar, põe uma praça
  na borda (mesmo código, outro tipo).
- **Novo passo "Evolução"** (no lugar do 3): casas com família paradas por falta do próximo serviço
  liberado (nível 1 sem praça, 2 sem mercado, 3 sem parque) → `service(kind, casas)`. Gatilho: o
  planejador com ≥ 2 casas; os outros com ≥ 3; o Distraído só depois de ver o balão por
  `delay` semanas (usar `seen`). O passo do mercado de hoje entra nele (DRY).
- `service()` aceita `plaza | market | park`. `trim()` valoriza praça e parque como o mercado (2 por
  casa atendida).
- `houses()`: o valor do lugar usa praça (+2), mercado (+1) e parque (+6 quando o objetivo é de casa
  grande), no lugar de poço e `sacred`. Sai a penalidade do planejador no raio do altar.
- `far` em `place()`: `well` → `plaza`, mais `park`.
- Métricas novas: J1, J2, J3, M1, M2 e as da 6.3; linha `--brief` com elas.

## 9. Textos (copywriter, `strings.ts`, até 75 caracteres, números lidos dos dados)
1. Nome e dica da Praça: "Tendas perto de uma praça viram casas de barro." (prévia "Atende N casas").
2. Nome e dica do Parque: "Casas de pedra perto de um parque viram casas grandes." (+ Alegria).
3. Passo do tutorial `plaza`: "Construa uma praça perto das tendas da caravana".
4. Toast final do tutorial: "Construa mais casas: cada uma recebe uma família".
5. Necessidades no balão: Praça, Mercado, Parque; com cadeado "(libera no objetivo N)".
6. Ações: "Onde pôr uma praça", "Onde pôr um parque".
7. Toast do objetivo 5: "Nova construção: Parque".
8. Demolir: "Perde N de comida" (celeiro e rua que desliga celeiro).
9. Oficina: aviso de desemprego sem "oficina" no teto; prévia "+N% de comida dos campos (total X%, teto
   30%)".
10. "Ao evoluir": com o inverno; imposto com a mesma casa decimal.
11. Templo: "Libera no objetivo 8"; texto do balão do Campo sem repetição; pílula sem "0/1".
12. Remover: motivo `water`, `familyNoWell`, dica e nome do Poço, "Altar ou Templo" como necessidade,
    "Onde pôr o Templo" como ação de casa.
13. Estatísticas: linha de Alegria "Praça +5", "Parque +20"; manutenção por tipo com Praça e Parque.

## 10. Quem faz e estimativa
| Bloco | Quem | Tempo (uma pessoa) |
|---|---|---|
| Dados, core, troca de ids, saída da água, testes (2, 5) | main + test-reviewer | 4–5 h (a troca de ids toca ~30 arquivos) |
| Mapa (4) | map-designer | 2 h |
| Bots e métricas (8) | sim-tester | 2 h |
| Calibração (2–3 rodadas, 100 seeds × 4 bots × 700 sem) | sim-tester + game-director | 2–4 h |
| Câmera do tutorial, toasts, balões, "Perde N" (3) | ui-designer | 3–4 h |
| Arte: Praça nova, Parque renomeado, poço removido, aguadeira | sprite-artist | 2–3 h |
| Textos (9) | copywriter | 1 h |
| Docs, `test:visual`, capturas | main | 1,5 h |
| playtester e fun-critic no fim | – | 1,5 h |

Total ~19–24 h de uma pessoa; numa sessão do Claude Code, ~6–8 h. Maior risco de prazo: a troca de
ids (`well`, `garden`, `sacred`) em render, testes visuais e bots; e a calibração se a porta sem água
fizer o Ano 1 crescer demais (alavanca 1, uma rodada a mais, ~1 h).

Ordem: 1) dados + core + testes; 2) mapa; 3) bots e linha de base em a06d471; 4) em paralelo, arte,
interface e textos; 5) sim-tester com as alavancas; 6) `npm test`, `tsc`, `build`, `test:visual`,
olhar capturas (tutorial-plaza, balão de casa com cadeado, Demolir no celeiro, toast com inspetor,
dense-town, coluna com Praça e Parque) em 844 x 390 e 1366 x 768; 7) playtester e fun-critic.

## 11. Fora do P2
Madeira, pedra, lenhador, pedreira, corte de árvores (P3); lenha e neve (P4); derrota nova e marco
anual (P5); Mercado no objetivo 2 e objetivo 8 novo (só como alavanca 6); campo 390 e imposto 3 (só
como alavanca, se medidos); incêndio (P14, a proteção sem poço se decide lá).

---

## Esboço do Pacote 3 "Madeira e pedra" (para planejar; a especificação vem depois do P2 medido)

**Mecânica nova (uma):** materiais de obra. Madeira e pedra são produzidas por duas construções com a
regra da Coletora (recurso no raio × taxa, com teto) e gastas ao construir e ao evoluir casas. O
corte de árvores é a consequência da madeira no bosque, não mecânica separada.

**Construções (números iniciais, a medir)**
| | Lenhador | Pedreira |
|---|---|---|
| Tamanho, vagas | 2 x 2, 2 | 2 x 2, 3 |
| Custo / manutenção | 25 / 1 | 40 / 2 |
| Recurso no raio | árvores, raio 3 | rochas, raio 2 |
| Produção | 0,25 por árvore, teto 3/sem | 0,4 por rocha, teto 3/sem |
| Liberação | início (o Ano 1 só mostra madeira) | objetivo 2 (3 casas de barro), antes das casas de pedra |
| Inverno | trabalha (dá destino aos agricultores parados) | trabalha |

**Regras**
- Estoque de madeira e de pedra sem limite no P3 (sem depósito novo; KISS). Duas pílulas no topo; no
  celular, a pedra só aparece depois de liberada.
- Custos em material (ao construir): casa nova 5 madeira; celeiro 10 madeira; mercado 10 madeira;
  oficina 10 madeira; parque 5 pedra; templo 300 pedra + 150 madeira.
- Evolução: barro 5 madeira, pedra 10 pedra, casa grande 10 pedra + 5 madeira, gastos quando a casa
  sobe. Sem material, a contagem das 13 semanas pausa (como na fome) e o balão diz "falta madeira".
- Corte: a cada 10 de madeira produzida, o Lenhador corta a árvore mais próxima (vira toco). Toco não
  conta para Coletora nem Lenhador e volta a ser árvore depois de 104 semanas (2 anos). Rochas não
  acabam.
- Desemprego: as vagas do Lenhador e da Pedreira contam o ano todo; é o destino dos trabalhadores
  ociosos (P1: 76% sem vaga na semana 200).

**Riscos**
- Duas matérias-primas de uma vez confundem: liberar a pedra só no objetivo 2 e mostrar a pílula só
  então.
- Lenhador e Coletora no mesmo bosque: o jogador pode cortar a comida do inverno sem perceber; a
  prévia do Lenhador mostra "Coletora perde N/sem".
- A evolução parada por material pode parecer bug: o balão tem que dizer o que falta.
- Prata e material juntos podem travar a abertura: o Ano 1 do Comum (6–10 casas) é o primeiro
  critério.
- O templo com 300 pedras é a alavanca para os ~30% de vitória, mas a calibração fina fica no P6
  (obras com tempo).
- Bots: precisam de lógica de material (produzir antes de construir), ~2–3 h a mais no sim.

# Plano "P2 correções" (game-director, 2026-11-04)

Base: main em 6261b09. Fontes: `playtester-p2.md`, `sim-tester-p2.md`, `fun-critic-p2.md`, `code-reviewer-p2.md`
e a seção 12 do `plano-p3.md`. As correções entram no **main antes do merge do P3**. A linha de base do P3
(seção 8 do `plano-p3.md`) passa a ser o main com estas correções.

Nenhuma mecânica nova. São correções de regra que mentiam ou travavam, ajustes de interface e dois
números de equilíbrio, medidos em rodadas separadas.

## 1. Decisões

| # | Item | Origem | Decisão | Motivo | Quem faz |
|---|---|---|---|---|---|
| 1 | Templo antes do objetivo 9 vira armadilha de dívida ("Vence o jogo" mente) | playtester 1 | **ENTRA** | O texto promete o que a regra não faz, e a manutenção pune quem confiou nele (pilar 1). | main (dado + toast), copywriter |
| 2 | Objetivo 1 cumprido com a cidade vazia e uma família a caminho | playtester 2 | **ENTRA** | Um prêmio por todos irem embora ensina o contrário do jogo. | main + test-reviewer |
| 3a | Templo: mostrar onde cabe (verde = pronto, amarelo = falta rua) | playtester 3, sim-tester M2 | **ENTRA** | O lugar existe em 99% das partidas; falta o jogo mostrar onde (pilar 9). | main (core) + ui-designer + sprite-artist |
| 3b | Prévia amarela quando cabe mas falta rua (todas as construções) | playtester 3 | **ENTRA** | "Ocupado" e "falta rua" pedem ações diferentes e hoje têm a mesma cor. | ui-designer, copywriter |
| 3c | "Onde pôr o Templo" com rua fantasma até o 6x6 mais perto | sim-tester M2 | **DEPOIS** | O 3a resolve com menos código; a rua fantasma volta se o playtest do P3 mostrar que o amarelo não basta. | – |
| 3d | Redefinir o M2 | sim-tester M2 | **ENTRA** | O critério exato media o desenho da cidade do bot, não o jogo. | sim-tester |
| 4 | Tutorial trava no passo da família (~23 sem em 28/60 seeds) | playtester 4 | **ENTRA** | O tutorial não pode deixar o novato parado 75 s sem dizer o que fazer. | main + ui-designer |
| 5 | Celular: Demolir no celeiro sem como desistir | playtester 5 | **ENTRA** | Perder comida sem querer, sem aviso, é bug de controle. | ui-designer (com o code-reviewer 9) |
| 6a | Objetivo 8: 6 → 12 casas grandes | playtester 6, fun-critic 1 | **P3** (alavanca, ver seção 3) | No P3 a casa grande pede pedra e madeira, o que já afasta o 8 do 7; medir antes de mexer. | sim-tester |
| 6b | Prêmio do objetivo 9: 200 → 400 | fun-critic 1 | **P3** (alavanca) | O templo do P3 custa pedra e madeira; o fim muda e precisa ser medido de novo. | sim-tester |
| 7 | Prévia do Templo "Atende 21 casas" | playtester 7 | **ENTRA** | "Atende" sugere evolução, e o templo só dá Alegria. | copywriter + ui-designer |
| 8 | Testes visuais instáveis com a máquina carregada | playtester 8 | **ENTRA** | O teste visual é parte da definição de pronto; teste que falha sozinho perde o valor. | main |
| 9 | Casa que perde a rua cai até terreno sem aviso | playtester 9 | **ENTRA** | Uma família sumir em silêncio quebra o pilar 4; é só um motivo a mais no toast que já existe. | main + copywriter |
| 10 | `drought.harvestFactor` 0,4 → 0,25 | sim-tester C2 | **ENTRA** (rodada R1) | Única alavanca medida que põe o C2 em 25–60% sem tirar a vitória do Comum; faz a camada da seca morder (pilar 6). | sim-tester mede, main aplica |
| 11 | `familyFoodReserveWeeks` 2 → 1 | fun-critic 2, plano-p3 §12 | **ENTRA** (rodada R2, depois da R1) | O alvo dela é o inverno do Ano 1, e a seca não chega lá. Também deve reduzir o bloqueio `storage` do tutorial. Fica só se passar nos critérios. | sim-tester mede, main aplica |
| 12 | Casa grande `tax` 2,5 → 3,5 | fun-critic 3 | **DEPOIS** (P9 Governo) | A prata parada está em 3/100; mais imposto traz de volta a prata sobrando. | – |
| 13 | Coletora `perCell` 0,3 → 0,2 | fun-critic 3 | **P3** (alavanca, se W6 permitir) | O corte do Lenhador já tira árvores da Coletora; medir o W6 primeiro. | sim-tester |
| 14 | `treeClearCost` 5 → 10 | fun-critic | **NÃO** | No P3 o Lenhador abre o bosque e o toco não bloqueia; Limpar fica como atalho. O gasto (+106%) dá só ~0,3 de prata por semana. | – |
| 15 | Eficiente 23 → 12%, Pescador 25 → 4%, Distraído 4 → 23% | sim-tester | **Aceito, com correção de bot** (ver seção 2.8) | Pescador é perfil de teste. Distraído com metade das vitórias do Comum e 0 derrotas antes da sem. 150 combina com o pilar 1 (sempre há volta). O Eficiente cai porque o bot enche o mapa e não reserva lugar nem prata para o templo. Isso é do bot, não do jogo. | sim-tester (`tools/sim`) |
| 16 | `tools/sim` 5, 6 e 13 (tabela de evolução copiada, flag com dois sentidos, `perYear`) | code-reviewer | **ENTRA** | O P3 muda a evolução: o bot com a tabela copiada mediria o jogo errado. | sim-tester |
| 17 | GameScene 9 (demolir duplicado) e NovaUi 12 (`freeCenter`) | code-reviewer | **ENTRA** | O item 5 mexe no mesmo código; corrigir junto custa minutos. | ui-designer / main |
| 18 | Balão "poucos trabalhadores" abaixo de 50% de eficiência | playtester (confusão) | **DEPOIS** | Seria balão novo. Volta no P3 só se o W5 (desemprego) mostrar campos vazios. | – |
| 19 | Toasts cobrindo o balão da ferramenta no celular | playtester (controles) | **P3** | O ui-designer já está refazendo o topo e os balões do P3 em 844 x 390. | ui-designer |
| 20 | "Bairro completo" | fun-critic (ideia ousada) | **DEPOIS** | É gatilho novo; nunca no mesmo pacote dos materiais. | – |

## 2. Especificação do que ENTRA

### 2.1 Templo antes do objetivo 9 (item 1)
- `buildings.json`: templo `upkeep` **10 → 0**. Com isso, construir cedo vira escolha (800 de prata
  trocados por Alegria +10 no raio) e deixa de ser armadilha. A vitória continua igual: o objetivo
  10 "Construa o Templo" conta o templo já erguido, então vence assim que o objetivo 9 se cumpre.
  Conferir com teste: templo erguido antes do 9 → vitória na semana em que o 9 se cumpre.
- Dica da ferramenta (`strings.ts:230`): `Vence o jogo após o objetivo 9. Precisa encostar numa rua ligada ao altar.`
  O número 9 vem da posição do objetivo `fromYear` em `goals.json`, não do texto.
- Toast ao erguer o templo antes do objetivo 9: `Templo erguido! A vitória vem com 500 moradores, a partir do Ano 8`
  (500 e 8 lidos de `goals.json`). Um helper puro no core (`templeWaitsForGoal(s)`) com teste; o
  render só mostra o texto.
- PC, "Saldo depois": já reflete a manutenção 0 sem mudança.

### 2.2 Objetivo 1 com a cidade vazia (item 2)
- `foodWeeksUntilSpring` (`src/core/goals.ts:56`): devolve 0 sempre que há 0 moradores, **mesmo com
  famílias a caminho**. Troca a condição `residents === 0 && families.length === 0` por
  `residents === 0`.
- A cidade vazia continua sem travar (a porta abre). O objetivo só se cumpre com alguém morando.
- Testes: 0 moradores com uma família a caminho no inverno → não cumpre; a família chega e a previsão
  passa da primavera → cumpre.

### 2.3 Onde cabe o Templo e a prévia amarela (itens 3a, 3b, 3d)
- Core, função pura nova `templeSpotsNear(s)`: cantos onde o 6x6 cabe em terreno livre (sem casa,
  rocha, árvore ou rio) e fica a no máximo `templeSpotRoadGap` células da rede. Os que já encostam na
  rede são `ready`; os outros são `needsRoad`. Número novo em `rules.json`: **`templeSpotRoadGap`: 1**.
  Testes com seed: um 6x6 a 1 célula da rede aparece como `needsRoad`; ao pôr a rua, vira `ready`;
  6x6 a 2 células não aparece.
- Render: ao escolher o Templo, contornar as áreas (sem sobrepor; no máximo `maxTempleSpots`: **6**,
  as mais perto do altar, número visual em `visual.json`). Cor da área `ready` = verde atual do
  `showSpots`; cor da `needsRoad` = amarelo novo no `palette.ts` (sprite-artist). Calculado ao
  escolher a ferramenta e a cada refresh, nunca por quadro.
- Prévia de **qualquer** construção: se o único motivo para não construir é `noRoad`, a prévia fica
  amarela, com o texto fixo `Cabe aqui: falta ligar à rua`. Ocupado continua vermelho.
- Toast `noTempleSpot`:
  - se existe área amarela: `Sem lugar pronto: o Templo cabe no amarelo, falta ligar à rua`;
  - se não existe nenhuma: mantém o texto atual.
- M2 redefinido (sim-tester): **"existe um 6x6 livre a ≤ 1 célula da rede ao liberar o templo"**,
  alvo **≥ 95% no Comum**. O `templeSpots` exato passa a ser só diagnóstico.

### 2.4 Tutorial: passo da família (item 4)
- Durante o passo `family`, a seta aponta para a ferramenta que resolve o motivo da porta (o texto
  do motivo já aparece no balão). Mapa em `tutorial.json`:
  **`"reasonTools": { "storage": "granary", "food": "field" }`**. Os outros motivos não mudam a
  seta.
- O passo termina com a primeira família **ou** depois de **`familyStepMaxWeeks`: 8** semanas, em
  `tutorial.json`. No fim por tempo aparece o toast final do tutorial de sempre; o motivo continua
  em Avisos.
- Testes no core (condição do passo, com tempo). O cenário visual do tutorial deixa de precisar de
  `openFamilyDoor` para terminar.

### 2.5 Celular: Demolir com perda (itens 5 e 17)
- Com toque, a ferramenta Demolir sobre uma construção com `foodLostIfRemoved > 0` **não demole ao
  soltar**. Em vez disso, abre o balão da construção, que já tem "Perde N de comida" e o Demolir com
  segundo toque. Mouse não muda.
- Na mesma mudança: helper `demolishFx` (code-reviewer 9) e `freeCenter` simplificado
  (code-reviewer 12).

### 2.6 Textos (itens 7 e 9)
- Prévia do Templo: `Atende N casas` → `+10 de Alegria em N casas` (10 lido do templo em
  `buildings.json`). Praça, Mercado e Parque continuam com "Atende".
- Família que sai porque a casa perdeu a rua: o evento `familyLeft` ganha `reason: 'famine' | 'road'`
  (core, com teste), e o toast fica `Uma família foi embora: casa sem rua`. A regra de cair de nível
  não muda.
- O copywriter confere tudo (até 75 caracteres).

### 2.7 Testes visuais (item 8)
- `scripts/visual/run.mjs`: o `startGame` espera `window.layout` (e a `UIScene` pronta) antes de
  devolver. Timeouts por cenário com folga para máquina carregada. Rodar com `workers` limitado se
  necessário. Aceite: duas rodadas completas seguidas sem falha.

### 2.8 Bots e métricas (itens 15, 16)
- Code-reviewer 5: o bot tira a tabela de evolução de `HOUSE_LEVELS`, com o helper `stalled`.
- Code-reviewer 6: flag própria `reactsToBalloons` no `Profile`.
- Code-reviewer 13: `perYear` com `WEEKS_PER_YEAR`.
- Eficiente: a partir do objetivo 8, reserva um 6x6 para o templo (não constrói em cima) e guarda
  prata para ele. Isso já estava previsto para os materiais no P3 e vale agora para o terreno.
- Métrica nova: M2 redefinido (2.3).
- Critério de aceite dos bots: Eficiente vence ≥ Comum. Se depois da correção ainda ficar abaixo, o
  problema é do jogo, e eu decido no P3.

## 3. Rodadas de medição (sim-tester, 100 seeds × 4 bots × 700 sem, uma mudança de número por rodada)

| Rodada | Muda | Fica se |
|---|---|---|
| R0 | Itens 1, 2, 3, 4, 9 e bots (2.8); templo `upkeep` 0 | Nada piora na 6.1 do P2 (B, G, C1, I, D, E, F, H). Derrotas do Distraído ≤ 19. T: 0 de 16 e o passo da família ≤ 8 sem em todas as seeds |
| R1 | `drought.harvestFactor` 0,4 → **0,25** | C2 do Comum 25–60%; G 30–50% em sem. 469–656; C1 ≤ 5; I ≥ 95%; D = 0 |
| R2 | `familyFoodReserveWeeks` 2 → **1** | Os mesmos da R1, mais B 6–10 e T 0 de 16. Relatar a fome no inverno do Ano 1 (alvo: > 0 no Comum, ≤ 25%) e o motivo `storage` no tutorial. Se falhar, volta para 2 |

O resultado da última rodada aprovada é a **linha de base do P3**.

Alavancas novas do P3 (entram na seção 9 do `plano-p3.md`, depois das atuais, uma por rodada):
- **J3 / objetivos em dupla:** se o J3 do Comum for > 250 sem ou se os objetivos 7 e 8 ficarem a
  < 13 sem: objetivo 8 `target` 6 → **12**.
- **Fim parado:** depois disso, se as semanas do objetivo 9 até a vitória (mediana) forem > 100:
  prêmio do 9 200 → **400**.
- **Coletora:** se o W6 sobrar (Coletora > 16% da comida): `perCell` 0,3 → **0,2**.

## 4. Quem faz e estimativa (uma sessão do Claude Code)

| Bloco | Quem | Tempo |
|---|---|---|
| Core: 2.1 helper e dado, 2.2, 2.3 `templeSpotsNear`, 2.4 passo, 2.6 evento + testes | main + test-reviewer | 2–2,5 h |
| Áreas do templo, prévia amarela, tutorial com seta, Demolir no celular, helpers | ui-designer | 1,5–2 h |
| Cor amarela e contorno das áreas | sprite-artist | 0,5 h |
| Textos | copywriter | 0,3 h |
| `run.mjs` estável | main | 0,5–1 h (achar a corrida é o risco) |
| Bots e métricas (2.8) | sim-tester | 1,5 h |
| R0, R1 e R2 | sim-tester | 1,5–2 h (cada rodada ~30 min, mais a análise) |
| Docs, `test:visual`, capturas (templo com áreas, prévia amarela, tutorial sem `openFamilyDoor`) | main | 1 h |

Total: ~9–11 h de uma pessoa, ~3–4 h numa sessão do Claude Code. O que pode atrasar: a instabilidade
dos testes visuais, que é difícil de reproduzir, e a R2, se reprovar e precisar de uma nova rodada.

## 5. Fora
Rua fantasma até o templo, balão de poucos trabalhadores, mudanças nos objetivos e prêmios (P3),
imposto da casa grande (P9), Limpar mais caro, templo 5x5, liberar o templo antes, mexer no mapa para
o M2, qualquer mecânica nova.

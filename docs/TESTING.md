# Como testar

Dois níveis de teste: **unitários** (regras do jogo, rápidos, obrigatórios) e **visuais**
(o jogo de verdade num navegador, com screenshots).

```bash
npm test                        # testes unitários (Vitest), ~1 s
npm run test:visual             # testes visuais (Playwright), ~1 min
npm run test:visual -- touch    # só os cenários cujo nome contém "touch"
VISUAL_PORT=5299 VISUAL_OUT=/tmp/shots npm run test:visual   # outra porta e outra pasta (dois agentes ao mesmo tempo)
VISUAL_SHARD=0/4 npm run test:visual   # só um quarto dos cenários (0/4, 1/4, 2/4 e 3/4 cobrem todos): rodadas curtas
npx tsc --noEmit                # typecheck
npm run build && npm run test:pwa  # o build é um app instalável e abre sem internet
```

Antes de dar uma tarefa por concluída: `npm test`, `npx tsc --noEmit` e `npm run test:visual`
precisam passar, e as screenshots afetadas pela mudança devem ser **olhadas**.

## Testes unitários (`tests/`)

Cobrem `src/core` (TypeScript puro, sem Phaser) e a lógica pura da visão 3D (`tests/render3d`). **Toda regra nova ou alterada precisa de teste.**

| Arquivo | O que cobre |
|---|---|
| `map.test.ts` | mapa 48 x 48 e mesma semente = mesmo terreno; em 100 sementes: contagens de rochas e árvores nas faixas, rio contínuo de 3–4 células a 8–18 do altar, bosque denso (18+ árvores em 7 x 7) a 11–20 do altar, nada sobre área livre ou rio, rua inicial livre, tendas dentro do raio livre, 3+ lugares para o Templo a até 12 do altar; árvores agrupadas; variação do rio e do bosque entre sementes; área livre do altar e da faixa da rua, estado inicial (altar, rua, entrada, prata, liberações), anel de rua em volta do altar (20 células livres, ligadas e alcançáveis da entrada, sem custo) |
| `network.test.ts` | rede de ruas ligada a qualquer lado do altar 4 x 4, caminhos que não atravessam o altar, desconexão ao demolir, custo e validação de rua, caminhos por busca em largura, máscara de junções (anel, cantos e T com a rua sul; o altar não conta), exigência de rua para cada tipo de construção |
| `coverage.test.ts` | números da Praça e do Parque (raio 4, categoria casa; sem `well` nem `garden`), cada um cobre só o seu serviço, raio quadrado a partir de qualquer célula, sem cobertura quando desconectado, área sagrada do altar 4 x 4, raio do templo 6 x 6, áreas não quadradas |
| `economy.test.ts` | eficiência, construções desconectadas não dão comida nem contam vagas, vagas do templo, manutenção (inclusive de desconectadas; rua, casa e altar grátis; cobrada desde a primeira semana), saldo exibido = impostos − manutenção (nenhuma construção dá prata; sem `production` nem `silver`; oficina com trabalhadores não muda a prata), maior custo, consumo de comida das pessoas (pela idade) e no inverno (× `foodFactor`, tenda × `tentFoodFactor`), campo com 468 de colheita e sem `food`, bônus das oficinas nos campos (0,1/0,2/0,3, teto na 4ª, desligada não conta, pescador e coletora sem bônus), pessoas sem trabalho pelas vagas do ano (`yearJobs`: desemprego, alegria e imposto iguais no outono e no inverno) e limite do aviso de desemprego (só com a Oficina liberada) |
| `actions.test.ts` | custos e locais inválidos, tamanhos das construções, mercado girado, posicionamento do templo (6 x 6, bloqueios, exige rua, lista de posições possíveis), `templeSpotsNear` (encostado = pronto, a 1 célula = falta rua, a 2 fora; mais perto do altar primeiro; só os prontos aceitam `checkPlace`), `templeRoadSpot` (sem área perto da rede: o lugar livre que a rua mais curta alcança e essa rua; construída a rua, fica pronto; nulo sem lugar), `onlyNeedsRoad` (livre e com prata mas longe da rede; nunca ocupado, sem prata, bloqueado ou rua), lugares de casa encostados na rede (`placeSpots`, tutorial), limpar, proteção do altar e do templo |
| `houses.test.ts` | evolução em `weeksToUpgrade` e regressão em `weeksToDowngrade` (rua, praça, mercado, parque; barro só com praça, pedra com praça + mercado, casa grande só com parque: o raio do altar e o do templo não bastam; casa grande que perde o parque cai), fome pausa a subida sem zerar, perder uma necessidade zera, `weeksToNextLevel` (contagem, congela na fome, null no topo ou sem necessidade), atendimento por qualquer célula da casa, fome (casas caem; tendas abandonadas com `famineLeaveChance` e evento de família saindo com `reason: 'famine'`; sem fome nunca), casa que perde a rua (a tenda vira terreno com `familyLeft` `reason: 'road'`; uma casa de pedra só manda a família embora ao chegar a terreno), informações e balões (incluindo "sem trabalhadores"; a informação da casa lista a necessidade trancada; o balão com a necessidade trancada do plano P2 2.6 está em `it.skip` até `needVisible` mudar) |
| `families.test.ts` | pessoas andando (`sendWalking`, `freeHouses`: maior `emptyLevel`, depois a mais perto, depois o id), chegada (`moveIn`: a casa sobe ao nível guardado, no mínimo tenda; casamento na chegada), rota recalculada, desistência (casa demolida, desligada ou ocupada; quem vinha de fora vai embora com `noHouse`), saída pelo altar quando a entrada está desligada, velocidade `familyCellsPerWeek` |
| `people.test.ts` | pessoas: idade e faixas (1 estação = 1 ano), comida por faixa e inverno, chance de morte pela idade (aniversário, `departed` com causa), invariante casa nível ≥ 1 ⇔ alguém mora (`vacate` guarda `emptyLevel`, tenda guarda 0), idosos sozinhos vão para a casa de um filho com lugar, noivados (idades, chance, outra casa, sem pai ou mãe em comum, diferença máxima, a mais perto da idade), casamentos (mudança na mesma semana quando um mora sozinho; senão andam até a melhor casa vazia e casam ao chegar; esperam e vão embora após `coupleWaitWeeks` com `coupleLeft`), nascimentos (`birthBlock`: fome, comida com reserva — negativa, −3: nasce com a comida acabando 1 semana antes da colheita, não 5 —, estoque; idade fértil, lugar na casa, intervalo, chance × alegria, sobrenome do pai), marcos `firstWedding`, `firstBirth`, `firstGrownUp` (só nascidos na cidade aos 14) e `thirdGeneration` (só com pai ou mãe nascido na cidade), saídas por fome e rua com o nome da família |
| `caravans.test.ts` | caravana fundadora (3 a 5 famílias de até 3 pessoas, uma por tenda; nunca um casal de noivos jovens além de `start.couple`; o casal de noivos 18–19 em casas diferentes; filhos alternando sexo; comida 14–22 semanas cortada pelo estoque; mesma semente = mesmo jogo), caravanas seguintes sorteadas no início (janelas, famílias, aviso, a terceira em cerca de metade das partidas), anúncio `warn` semanas antes, chegada pela entrada até casas vazias (maior `emptyLevel` primeiro; sem casa seguem viagem sem registro; marco `firstCaravan` só se alguém fica), comida trazida 4–8 semanas cortada pelo estoque, modelos de família; a 1ª caravana sempre com um casal de noivos (`engaged`): dois jovens de 18–22 de nomes de família diferentes, uma casa só, casam ao chegar (casamento do ano, evento, marco); sem casa seguem viagem; quem fica recomeça a contagem da dívida |
| `levels.test.ts` | níveis de Celeiro, Mercado e Oficina (`levels`, `statOf`, `nextLevelOf`), `upgradeBuilding` (paga, sobe, muda estoque e manutenção, evento `buildingUp`; falha no topo, sem prata, em dívida e em construções sem nível), mercado de nível maior alcança mais, oficinas somam até o mesmo teto, manutenção desde a primeira semana (nenhum objetivo a libera), pescador e coletora × `winterFactor` no inverno (na semana e na previsão), `upWeeks` sorteado em 11–15 ao construir e a cada nível |
| `invariants.test.ts` | **invariantes** em partidas inteiras dos bots `eficiente`, `comum` e `distraido` (3 sementes × 300 semanas, conferidas toda semana): toda pessoa sem casa está andando; toda pessoa com casa mora numa casa que existe com nível ≥ 1; casa com nível ≥ 1 ⇔ alguém mora nela; ids únicos entre `people` e `departed`; cônjuge conhecido; o estado inteiro passa por `JSON.parse(JSON.stringify)` |
| `happiness.test.ts` | felicidade desligada antes do Parque (liga com o Objetivo 7) (contente, sem motivos, imposto e nascimentos iguais aos de uma cidade sem felicidade); felicidade da casa (base, cada fonte sozinha: praça +5, parque +20, altar +10, templo como o altar; parque só conectado e no raio, mercado, fome, desemprego com teto, limites 0–100), três humores, fator do imposto e dos nascimentos (`birthFactor`: 1 enquanto contente, extremos), imposto da casa feliz e triste, média da cidade (50 sem famílias), parte sem vaga, contagem por humor, informação da casa com felicidade e imposto real, balão de casa triste |
| `debt.test.ts` | manutenção levando a prata abaixo de 0, construir e cortar bloqueados em dívida (demolir não; prata 0 não é dívida), contagem da dívida (início, zera com prata ≥ 0, recomeça), derrota exatamente na semana 24 e simulação parada depois, sem derrota enquanto uma caravana planejada ou anunciada chega em até `debtCaravanWeeks` (contagem parada em 23, aviso com 1 semana; derrota quando ela chega sem ninguém ficar; caravana longe, pulada ou já chegada não poupa), maior população, ordem dos avisos (dívida, saldo negativo com maior custo, desemprego) |
| `goals.test.ts` | os 18 objetivos (tipos, alvos, marcos, prêmios, liberações; um só de vitória; nenhum `fromYear`), `unlockingGoal` (celeiro 2, mercado 4, oficina 6, parque 7, templo 12), Praça liberada no início e Objetivo 7 liberando o Parque, Objetivo 2 pela previsão (com pescador) e alvo que encolhe, Objetivo 2 não se cumpre sem moradores mesmo com uma família a caminho (e se cumpre quando ela chega), objetivos `milestone` (também com o marco alcançado antes), casas de barro, moradores (pessoas), casas grandes só conectadas, vitória com o templo, um objetivo por verificação, `goalOpen` com `fromYear`, `TEMPLE_GOAL` = o objetivo antes da vitória (175 moradores) e templo erguido antes dele vence na semana em que ele se cumpre (`templeWaitsForGoal`), nenhum objetivo `water` nos dados |
| `simulation.test.ts` | comida, prata, semana, fome (termina com a colheita da primavera), nenhuma prata de produção e relógio (1 semana a cada `weekSeconds` em 1x) |
| `seasons.test.ts` | 13 semanas por estação começando no outono, ordem das estações, primeira semana de cada estação, um evento `season` só quando a estação muda, `seasonCount`/`START_SEASON`, ano agrícola do outono ao verão no `calendar`, jogo novo na semana 1 do outono do Ano 1 |
| `tutorial.test.ts` | os 6 passos com a comida primeiro (rua, pescador ou coletora, campo, praça, casa, casamento), o mini passo do Lenhador depois deles e o mini passo do mercado, relógio parado nos passos de construir e andando no casamento (`tutorialHoldsClock`), `markTutorial` (ruas, casas, o caminho sugerido e a semana), condição de cada passo (rua marcada pronta ou o mesmo número de ruas novas na rede, casa nova ligada sem contar a caravana, pescador/coletora ligado, marco do primeiro casamento — também com o casal da caravana de verdade em 3 sementes — ou `weddingStepMaxWeeks` semanas no passo, campo, praça, mercado), `plazaHouseSpots`/`houseHint`, `foodSpot`/`ghostRoad` (em 200 sementes o lugar rende ≥ 1,2/sem e, construído como indicado, fica ligado e rende o prometido; caminho contínuo da rede até o lado da construção; prefere o que rende mais e depois a rua mais curta; nulo sem lugar que renda o bastante; contorna uma construção no caminho), casas atendidas por um serviço ("Atende N casas") |
| `forecast.test.ts` | nível alvo de uma casa (`targetLevel`), previsão com o consumo das pessoas que moram hoje (uma praça nova não muda nada; quem anda não conta; crianças comem mais e idosos menos), consumo de inverno (tenda e casa), previsão que atravessa o inverno, `reserveWeeks` (também negativo: a comida passa do zero até essa reserva), bônus das oficinas na previsão, `lastsToHarvest` igual a `foodLastsToHarvest`, previsão e `stepWeek` dão a mesma semana de fome em combinações semeadas, `nextFieldTurn` (inverno em N sem fora do inverno, primavera em N sem no inverno) |
| `readouts.test.ts` | nível da cidade e progresso do objetivo, calendário, saldo depois de construir, casas atendidas, ganho ao evoluir (`upgradeGain`: lugares e imposto), leitura da cidade com `birthBlock`, lugares que atendem uma construção, casas por nível, comida feita e comida, `foodAfter` (um local de trabalho que tira o único trabalhador baixa a comida; o campo rende a colheita × a eficiência com as vagas dele; num lugar sem rua não rende nem ocupa vagas; no inverno o campo não rende), `templeSavings` (só do Templo liberado até erguido, nunca abaixo de 0) |
| `peopleReadouts.test.ts` | leituras do Povo para a tela: `houseBirths` (pode ter filhos; nulo sem casal que possa; casa cheia antes da comida, fome antes de tudo; repassa `food`/`storage`; nulo em terreno e outras construções), `householdsOf` (casas com gente, as mais cheias primeiro, nome pelo mais velho), `grownUpThisWeek` (nascido na cidade no aniversário que o faz adulto) |
| `viability.test.ts` | **viabilidade do Ano 1**: um plano mínimo (rua até a melhor comida, pescador ou coletora, campo, praça para as tendas, celeiro quando liberado, mais comida quando a previsão não chega à primavera, lenhador no `lumberSpot` depois do primeiro casamento, terreno perto de praça quando um casal espera casa; construir paga madeira) em 20 sementes: sem fome antes da semana 26, objetivo 1 (primeiro casamento) no primeiro outono e objetivo 2 antes da primavera, objetivos 1 e 2 no Ano 1, prata nunca negativa; invariantes: a prata inicial paga o kit mínimo, e 1 campo com o estoque base e o pescador ou coletora (× `winterFactor` no inverno) alimentam a caravana até a primavera; **A8**: 15 casas de barro (52 pessoas), 2 campos, pescador, coletora e 1 celeiro nível 1 cheio no começo do inverno passam o inverno sem fome |
| `survival.test.ts` | caravana por semente (3–5 tendas em filas de duas dos dois lados da rua do acampamento ao norte do anel; em 500 sementes `campPlazaSpot` é livre, ligável e atende todas; comida cortada no estoque base (100), semanas anunciadas reais, prata inicial), colheita só na primavera (`harvestsIn`, `firstHarvestWeek`, campo feito no inverno colhe no ano seguinte, última semana do outono ainda semeia, desconectado não colhe, eficiência, evento `harvestStart` com o total, marco `firstHarvest`), `weeksToHarvest`, consumo semanal, estoque com e sem celeiro (desligado não guarda), estrago (`spoilStart` uma vez, limite exato não estraga, perder o celeiro), previsão (semanas e estação, colheita e limite, seca anunciada, horizonte, primavera conta até o ano seguinte), inverno (tendas saem com 35%, casa de barro protege, `winterLoss`), seca (× 0,25, campo no rio protegido, nunca no Ano 1 nem 2 seguidas, chance, aviso do inverno à primavera), avisos novos e sua ordem (comida curta em qualquer estação; estoque cheio com o tamanho e o objetivo do celeiro enquanto bloqueado), marcos uma vez só (caravana não conta), histórico com `capacity`, objetivo `foodUntilSpring` com `goalTarget`, campo dá comida na primavera, verão e outono e congela no inverno (sem comida nem vagas; pescador a 100%; manutenção mantida; previsão com a eficiência de cada semana) |
| `materials.test.ts` | Madeira e pedra (P3): dados do Lenhador e da Pedreira, custos em material (`materialsOf`; rua, campo, praça, pescador, coletora e lenhador sem material), material por nível de casa (`upgradeGain`), caravana com 20/0, Lenhador liberado no início e Pedreira só no Objetivo 6 (30 moradores); rendimento (`gatherYield`: árvores × 0,25 até 3, × eficiência, tocos não contam; Pedreira conta rochas; desligado rende 0; o ano todo) e estoque semanal; corte (árvore mais próxima, empate pelo índice; na 10ª madeira vira toco com `treeCut`; sem trabalhadores não corta; Coletora perde a árvore), rebrota em 104 semanas com o mesmo tipo (`treeRegrown`); toco não bloqueia e some ao construir ou pôr rua (não volta), Demolir não age nele; construir sem material falha sem gastar prata (`materials`, `missingMaterial`), prata conferida antes, templo paga 800 + 300 + 150; casa pronta sem material espera em 13/13 com `waiting` e sobe pagando na semana em que o material chega (também vindo da Pedreira), a mais antiga primeiro, perder uma exigência limpa a espera, cair não devolve, tenda → barro paga 5 de madeira; aviso `material` com a contagem e a ordem; porta das famílias ignora materiais; `sharedTrees`, `weeksPerCut`, `foodAfter` com o produto; mini passo do Lenhador depois da família com `lumberSpot` |
| `gather.test.ts` | Pescador e Coletora: dados, células de rio/árvore no raio (contadas à parte), 0,75 e 0,3 por célula com teto 4,5, mais longe rende menos, cortar árvore baixa, dois no mesmo recurso, desligado não rende, o ano todo com a eficiência, balões "sem fonte", "sem rua" e "sem trabalhadores" |
| `looks.test.ts` | aparência das casas: semente determinística, variante dentro do número do nível, espelhamento, vizinhas do mesmo nível com variantes diferentes, novo sorteio ao mudar de nível; plantação do campo diferente da do campo vizinho; construções de uma só aparência ficam na variante 0; ofício da oficina (sorteio determinístico, vizinhas diferentes, guardado na variante) |
| `rng.test.ts` | gerador semeado: mesma semente, mesma sequência; `shuffle` |
| `walkers.test.ts` | tipos de morador: só aparecem quando a construção existe e está ligada, destino pelo tipo (aguadeira na praça ou no mercado, cada um sozinho e os dois por semente; campo, mercado, oficina, altar/templo, ruas principais, borda), carregador campo → mercado e volta, destino aleatório de reserva, destino do artesão aponta a oficina e o ofício |
| `render3d/*.test.ts` | lógica pura da visão 3D (`src/render3d`, sem WebGL): `plan.test.ts` (o que se desenha: modelo por tipo e nível, casa vazia com o nível guardado, desbotada e com portão trancado, campo por cultura, acréscimos e altura nos níveis 2–3 de celeiro, mercado e oficina, giro da câmera igual ao do 2D, área de cada modelo, frente para a rua, tocos e mudas pelo `stumps`, número de moradores na rua), `crowd.test.ts` (roupa por idade e sexo, família em grupo andando até a casa), `day.test.ts` (hora, sol, noite, janelas), `season.test.ts` (estações contínuas, campos), `weather.test.ts` (chuva por semente, chão molhado, luz do quadro, gente na rua) |

### Utilitários (`tests/helpers.ts`)

- `emptyGame(overrides)` — jogo sem rochas/árvores, areia em tudo (exceto o rio), muita prata, madeira e pedra,
  sem a caravana (só o altar, sem pessoas nem caravanas futuras) e com 30 de comida, quase tudo
  liberado e no primeiro objetivo de moradores ≥ 100 (`QUIET_GOAL`, nenhum objetivo se cumpre por acaso). Altar 4 x 4 em x, y = 22..25, anel de rua em volta (contorno de x, y = 21..26) e
  rua inicial em x = 24, de y = 26 a 47. Construções ao lado da rua inicial ficam em y >= 27 para
  não cair no anel.
- `put(state, kind, x, y, level, rotated, people)` — coloca uma construção sem cobrar prata nem material e já no nível
  desejado; uma casa com nível ≥ 1 é enchida até a capacidade com casais adultos de 41 anos (`fill`),
  ou com `people` pessoas. `upWeeks` = `UP_WEEKS` (o mínimo de `weeksToUpgrade`).
- `person(state, { houseId, sex, age, caravan, fatherId, motherId })` — uma pessoa com aniversário
  nesta semana; `LIFE_YEAR` = semanas por ano de vida.
- `road(state, [[x, y], ...])` — coloca ruas sem cobrar.
- `constRng(v)` — gerador aleatório fixo (0 = sempre acontece, 0,99 = nunca acontece).
- `ROADSIDE = 22` — coluna de uma casa 2 x 2 encostada a oeste da rua inicial (conectada).
- `westOf(kind)` — coluna de uma construção desse tipo encostada a oeste da rua; `EAST = 25` —
  coluna de qualquer construção encostada a leste.
- `besideRiver(state, y)` — coluna de uma construção 2 x 2 nas linhas y e y + 1 encostada no rio
  (a leste), com uma rua na linha y desde a rua inicial (não depende da forma exata do rio).

## Testes visuais (`scripts/visual/run.mjs`)

O script sobe o servidor de desenvolvimento do Vite, abre o jogo no Chromium do Playwright,
executa cada cenário, salva screenshots em `screenshots/` (fora do git) e falha se uma verificação
quebrar ou a página registrar erro no console. Em falha, salva também `FAILED-<cenário>.png`.
**Uma rodada por vez na máquina:** cada Chromium desenha o WebGL na CPU (SwiftShader) e passa de
1 GB; quatro rodadas ao mesmo tempo esgotaram a memória do WSL e travaram tudo (2026-11-05). O
`run.mjs` segura a trava `logs/visual.lock`, e uma segunda rodada espera a primeira terminar. Use
`VISUAL_SHARD` para rodadas curtas. O `tools/watchdog.sh` mata o navegador de teste maior se a memória
livre cair abaixo de 1 GB, e o Vitest usa no máximo 6 workers (`vite.config.ts`).

O servidor roda sem recarga automática (`hmr: false`, sem vigiar arquivos): um arquivo editado por
outro agente durante a rodada não recarrega a página no meio de um cenário.

| Cenário | O que faz e verifica | Screenshots |
|---|---|---|
| `title` | tela inicial; depois de ver o tutorial, com "Rever o tutorial"; um `beforeinstallprompt` falso mostra "Instalar app" e o clique chama a instalação | `title`, `title-again`, `title-install` |
| `tutorial` | celular 844 x 390, primeira partida: frase da caravana; o relógio fica parado no passo de construir mesmo em 3x; ferramentas nunca travam (a tecla 2 e a Praça também funcionam no passo da rua); em cada passo a câmera desliza até o lugar (rua marcada, lugar de comida, `fieldHint`, `campPlazaSpot`, casa) e o deixa no mapa livre: fora da interface, do balão do tutorial e dos toasts (no celular também o ponto do dedo, 90 px abaixo); o toast da caravana não cobre a rua marcada (no tutorial o toast do casal e os avisos de casais e nascimentos não aparecem); os 6 passos (rua pelo caminho fantasma até o lugar de comida, arrastada com o dedo; pescador ou coletora no lugar escolhido, com "Rende N comida/sem"; campo; praça no `campPlazaSpot`, livre e atendendo as tendas, com "Atende N casas"; casa; casamento: o casal da caravana anda até a casa nova e casa (marco), dentro de `weddingStepMaxWeeks` semanas, sem ajuda do teste), a coluna abre a categoria e depois escolhe; o mini passo do Lenhador (câmera no `lumberSpot`; se o lugar pede rua, o balão pede "a rua marcada" e a seta aponta Rua; a prévia diz "Rende N madeira/sem" e "Corta 1 árvore a cada N sem"; um lenhador ligado encerra os passos); o último toast diz "Casais novos precisam de casa"; depois, ao liberar o Mercado, o passo do mercado; tutorial gravado como feito | `tutorial-caravan`, `tutorial-step-1`, `tutorial-step-2`, `tutorial-step-2-preview`, `tutorial-step-3`, `tutorial-plaza`, `tutorial-step-5`, `tutorial-step-6`, `tutorial-market` |
| `tutorial-pc` | o mesmo no PC 1366 x 768, com o mouse | as mesmas, com `-pc` no fim |
| `tutorial-blocked` | PC: salta para o passo do casamento sem casa vazia: o relógio anda; o passo termina sozinho em `weddingStepMaxWeeks` semanas, sem casamento, com o toast final | `tutorial-wedding-waiting`, `tutorial-wedding-timeout` |
| `temple-areas` / `temple-areas-pc` | celular 844 x 390 e PC 1366 x 768, pausado, Templo liberado, com terrenos ocupando as áreas prontas mais perto: no máximo 6 áreas sem sobrepor, verdes e amarelas; a prévia sobre uma amarela diz "+10 de Alegria em N casas" e "Cabe aqui: falta ligar à rua"; uma Casa longe da rua mostra a prévia amarela com "Cabe aqui: falta ligar à rua"; sem prata, a prévia sobre uma verde termina com "Falta prata: custa 800"; com rochas tirando toda área perto da rede (menos um caminho), aparece só a área mais próxima com a rua dourada até ela e a câmera vai até lá | `temple-areas`, `temple-preview-yellow`, `preview-needs-road`, `temple-far-road` (com `-pc` no PC) |
| `demolish-loss` / `demolish-loss-pc` | celeiro cheio com Demolir: no celular o toque não demole, abre o balão com "Perde N de comida"; no PC o clique demole na hora | `demolish-loss`, `demolish-loss-pc` |
| `p2-ui` / `p2-ui-pc` | celular 844 x 390 e PC 1366 x 768, pausado: praça no `campPlazaSpot` e as tendas dela viram casas de barro; o balão da casa no mapa mostra o mercado com cadeado; tocada, "✗ Mercado (libera no objetivo 3)" e nenhuma ação "Onde pôr"; com o balão aberto os toasts esperam; ao fechar volta só o primeiro aviso que ainda vale (a notícia, o aviso que deixou de valer e o menos importante são descartados); Demolir mirando um celeiro cheio diz "Perde N de comida", e o balão do celeiro também; a faixa Moradia com Casa, Praça e Parque; o Parque escolhido com o balão | `balloon-locked`, `balloon-locked-house`, `toast-inspector`, `toast-inspector-closed`, `demolish-granary`, `demolish-granary-balloon`, `column-home`, `column-park` (com `-pc` no PC) |
| `drag-release-on-button` | celular: uma rua arrastada do mapa que termina sobre "Pular tutorial" não pula o tutorial, e sobre a velocidade não a muda (botões só disparam com o toque que começou neles) | `drag-release-on-button` |
| `drag-release-on-button-pc` | o mesmo no PC 1366 x 768, com o mouse | `drag-release-on-button-pc` |
| `preview-food-after` | celular: rua até o lugar de comida e prévia do pescador ou coletora com "Rende N comida/sem" e "Comida depois"; depois o balão do Mercado com mais vagas que trabalhadores | `preview-food-after`, `preview-food-after-market` |
| `preview-food-after-pc` | o mesmo no PC; o balão do Mercado diz "Comida depois" | as mesmas, com `-pc` no fim |
| `materials` | celular 844 x 390 (P3), pausado: a pílula Materiais mostra a madeira da caravana (`startMaterials`) e nenhuma pedra; o Objetivo 6 libera a Pedreira ("Nova construção: Pedreira") e a pedra entra na pílula; nenhuma peça do topo se sobrepõe; uma casa de barro pronta sem pedra espera (pílula vermelha com "⚠ 3", toast "1 casa esperando pedra"), tocada diz "Pronta para virar Casa de pedra: falta 7 de pedra" (o toast sai de trás do balão; ao fechar, só ele volta) com a ação "Onde pôr uma pedreira" (sem lugar com rochas junto à rua neste mapa: o toast diz por quê); contando, diz "Ao evoluir: pede 10 de pedra"; Estatísticas com a seção Materiais; a Pedreira sem madeira mostra "40 prata · 10 madeira (tem 4)" e tentar construir dá "Falta madeira: construa um lenhador" | `materials-top`, `materials-top-stone`, `house-waiting-stone`, `house-waiting-stone-spots`, `materials-stats`, `quarry-balloon-lacking`, `toast-lacking-wood` |
| `winter-cold`, `winter-cold-pc` | Lenha e inverno (P4), celular 844 x 390 e PC, pausado: as tendas da caravana no inverno com madeira (fumaça das chaminés, balão da casa com "Lenha no inverno: N/sem"); madeira 0 e uma semana: frio (`s.cold`), aviso de lenha com frio, pílula da madeira vermelha com "⚠ 0", balão com "Frio: falta lenha", sem fumaça; ao fechar o balão volta um toast "Frio!..."; o topo continua sem sobreposição; painel de Avisos | `winter-warm`, `winter-cold`, `winter-cold-toast`, `winter-cold-alerts` (com `-pc` no PC) |
| `quarry-full`, `quarry-full-pc` | cidade do `town-art` com lenhador, pedreira e moradores, pedra no limite (`materialStorage`, 400): o balão da pedreira diz "Parado: estoque cheio (400)" (sem "Rende" nem "Sem rochas") e há o aviso `storageFull` da pedra; painel de Avisos | `quarry-full`, `quarry-full-alerts` (com `-pc` no PC) |
| `materials-wide` / `materials-pc` | o mesmo em 915 x 412 e no PC 1366 x 768 (no PC uma pílula por material, encurtando os rótulos se a fileira não couber) | as mesmas, com `-wide` ou `-pc` no fim |
| `top-fit` / `top-fit-1280` | PC 1366 x 768 e 1280 x 720, pausado, com estoque de cidade crescida (prata 9.876, madeira 987, pedra 876, Pedreira e Parque liberados): as pílulas encurtam (`MAX_FIT`) e terminam à esquerda da velocidade, a Alegria fica tocável e nenhuma peça do topo se sobrepõe | `top-fit`, `top-fit-1280` |
| `lumber-shared` / `lumber-shared-pc` | celular e PC: rua até o `lumberSpot`, uma Coletora no mesmo bosque; a prévia do Lenhador diz "Rende N madeira/sem", "Corta 1 árvore a cada N sem" e "Divide o bosque com a Coletora"; uma tenda pronta sem madeira oferece "Onde pôr um lenhador", que acende os lugares junto ao bosque | `lumber-preview-shared`, `lumber-spots` (com `-pc` no PC) |
| `harvest-countdown` | celular: pílula da estação com "inverno em N sem" no outono e "primavera em N sem" no inverno, cabendo na tela; na fome a pílula de comida diz "FOME" | `harvest-countdown-autumn`, `harvest-countdown-winter` |
| `harvest-countdown-pc` | o mesmo no PC 1366 x 768 | as mesmas, com `-pc` no fim |
| `toast-panel` | com as Estatísticas abertas, uma notícia e um aviso esperam; ao fechar, só o aviso aparece | `toast-panel-open`, `toast-panel-closed` |
| `tutorial-skip` | "Pular tutorial" encerra e fica gravado; a tecla 2 escolhe Rua; com o `localStorage` bloqueado o tutorial roda e pular funciona sem erro | — |
| `options` | a engrenagem abre as Configurações; um clique no título do painel não muda a ferramenta nem seleciona nada, e o painel continua aberto | `options` |
| `build-with-mouse` | começa com o altar e as tendas da caravana; rua e casas arrastando (teclas 2 e 3), praça e campo clicando (3 de novo passa para a Praça; a tecla 4 escolhe o Campo); conta ruas e construções | `build-with-mouse` |
| `families-arrive` | terrenos ao lado da rua, 3x; espera o casal da caravana andando e o marco "Primeiro casamento" | `families-walking`, `families-arrived` |
| `happiness` | pausado, cidade de `buildTown` com parque e comida: a carinha da pílula Alegria segue o humor; tocar nela abre as Estatísticas; casa ao lado do parque (balão com os motivos); fome deixa a carinha triste e põe balões tristes; prévia do Parque com raio | `happiness-breakdown`, `happiness-house`, `happiness-sad`, `overlay-park` |
| `ambient` | cidade de `buildTown` de manhã: galinhas, jumentos, pombas, barcos, lavadeiras, ovelhas e varais existem, nenhum bicho com textura faltando (`__MISSING`); zoom no rio perto do primeiro barco | `ambient-town`, `ambient-river` |
| `seasons` | PC, cidade de `buildTown` pausada com bosques em volta: as 4 estações (o ano começa no outono; ícone certo na pílula da estação, sem ícone de seca, trigo dourado na colheita da primavera, fumaça e árvores peladas no inverno, catadores no outono), com e sem a interface; amendoeiras floridas no fim do inverno; chuva fraca, média e forte (mais gotas a cada nível, poças nas ruas); inverno com neve (telhados com neve); seca no verão (rio com lama, cada campo com sua fase, ícone de seca na pílula da estação e recorte dela; de longe, no zoom mínimo, sobre o rio); toast da primavera ao chegar a semana 1 dela, e o aviso de seca sumiu | `seasons-spring`, `seasons-summer`, `seasons-autumn`, `seasons-winter` (e cada uma com `-noui`), `seasons-almond`, `weather-rain-light`, `weather-rain-medium`, `weather-rain-heavy`, `weather-snow`, `seasons-drought`, `seasons-drought-icon`, `seasons-drought-noui`, `seasons-drought-zoom`, `seasons-toast` |
| `seasons-phone` | o mesmo no celular deitado 844 x 390 | as mesmas, com `-phone` no fim |
| `town-art` | monta uma cidade com todos os níveis e prédios (inclui praça, parque e, com `addWoodStone`, Lenhador e Pedreira); templo conectado; prévias (a Casa mostra o raio das praças) | `town-art`, `overlay-temple-preview`, `overlay-house-plaza-area` |
| `wood-stone` | pausado, cidade de `buildTown` + `addWoodStone` (Lenhador num bosque com tocos novos e brotando, Pedreira entre rochas, os dois ligados): Lenhador e Pedreira no zoom máximo; lenhador e canteiro (todas as roupas) em fila; uma oliveira cortada tomba (ângulo > 30°) e vira toco; zoom mínimo; inverno com neve | `wood-stone-lumber`, `wood-stone-quarry`, `wood-stone-walkers`, `wood-stone-fall`, `wood-stone-zoom-min`, `wood-stone-snow-lumber`, `wood-stone-snow-quarry` |
| `day-night` | PC: cidade de `buildTown` pausada em manhã, tarde dourada, pôr do sol e noite (metade dos moradores e luzes acesas à noite); Configurações (engrenagem) e ciclo desligado pela opção Dia e noite (sempre dia) | `day-night-morning`, `day-night-golden`, `day-night-sunset`, `day-night-night`, `day-night-options`, `day-night-off` |
| `scaffold-roads` | ruas com passos de moradores (uma gasta, uma calçada, uma comum); oficina nova com andaime que some depois | `roads-wear`, `scaffold`, `scaffold-done` |
| `field-work` | pausado: 8 campos ligados (4 plantações, normal e espelhado) e 1 sem rua; 2 agricultores por campo com eficiência 100%, nenhum no campo sem rua; zoom máximo (dois momentos do trabalho) e mínimo; mapa girado com 1 agricultor por campo quando só parte das vagas está ocupada | `field-work-zoom-max`, `field-work-zoom-max-later`, `field-work-zoom-min`, `field-work-turned` |
| `people-art` | arte do pacote Povo, pausado: celeiro, oficina e mercado nos níveis 1, 2 e 3 lado a lado (confere as texturas `-l2`/`-l3`); casas de nível 2–4 ao lado de casas vazias que guardaram esses níveis (`house-e2..4`); um casal e uma família de caravana andando até uma casa; um nascimento ("+1" com pulinho e anel) | `people-art`, `people-art-houses`, `people-art-granary`, `people-art-workshop`, `people-art-market` (zoom 2), `people-art-birth`, `people-art-zoom-out` (zoom 0,5) |
| `camera-wheel` | zoom com a roda dentro dos limites | `camera-zoom-in`, `camera-zoom-out` |
| `view3d`, `view3d-pc` | botão 3D da coluna esquerda sobre a cidade de `town-art` (com Lenhador, Pedreira, moradores, celeiro 3, oficina 2, mercado 3, uma casa grande vazia e uma família de caravana andando até ela): abre a visão 3D girada como o 2D, a família anda em grupo (`info().families`), o jogo fica pausado (velocidade 0, laço do Phaser dormindo, semanas paradas), rótulo "estação · Ano N"; dia e noite de verão e inverno com neve (pelo gancho `window.view3d.view`); girar pelo botão; "Voltar" (toque no celular, clique no PC; Esc na 2.ª vez no PC) devolve a velocidade 3x e o 2D, sem sobrar canvas; abre e fecha duas vezes | `view3d-<phone/pc>`, `-people`, `-levels`, `-day`, `-night`, `-winter`, `-close`, `-back` |
| `touch` | celular deitado com toque real: toque no botão Rua de baixo; um dedo constrói rua sem mover a câmera; pinça dá zoom sem construir | `touch-title`, `touch-after-pinch` |
| `input-phone` | celular deitado 844 x 390 (jogo 1280 x 591), pausado com avisos de saldo negativo e desemprego: a coluna abre Moradia e escolhe a Praça; prévia mirada acima do dedo; deslizar até a coluna e soltar cancela; sem prévia nem construção quando o ponto mirado cai sob a pílula do objetivo; com Demolir, um toque na fresta entre Avisos e Estatísticas conta como interface e não demole nada; um Esc volta de Demolir para Mover | `input-phone-preview`, `input-phone-clear` |
| `nova-small-phone` | o `nova-phone` no celular 800 x 360 (o menor): tudo com 44 px e dentro da tela; a coluna esquerda com folga (os `nova-*` checam ≥ 6 px reais entre os botões e ≥ 12 px do 3D ao Mover) | as do `nova-phone`, com `small-phone` |
| `input-pc` | PC 1366 x 768 (jogo 1280 x 720), mesma cidade: tecla 5 escolhe o Mercado e a prévia segue o mouse; botões 3x e pausa; arrastar rua começando na pílula da comida não constrói; clique na prata abre as Estatísticas e no objetivo abre os Objetivos | `input-pc`, `input-pc-stats`, `input-pc-goals` |
| `clarity` | pausado: rua arrastada longe da rede (apagada, tracejada, aviso); campo sem moradores com balão "sem trabalhadores"; fome; posições do templo; mapa sem espaço para o templo | `clarity-loose-road`, `clarity-famine`, `overlay-temple-spots`, `temple-no-spot` |
| `turn-map` | mercado, casa e praça; abre as Configurações e clica ↻ (não constrói nada), arrasta rua no mapa girado e confere as células; E/E e Q | `turn-0`, `turn-1`, `turn-3`, `turn-2` |
| `debt` | pausado em dívida com fome: prata vermelha piscando, toast ao tentar construir, família saindo a pé; toque na prata abre as Estatísticas; painel de Avisos; a 1x chega à derrota (com anos e semanas); "Mesmo mapa" começa um jogo novo na semana 0 com a mesma semente do jogo perdido (trocada antes para não vir do `?seed`); de novo a derrota, "Tentar de novo" começa um mapa novo | `debt-alerts`, `debt-silver-info`, `debt-alerts-panel`, `defeat`, `defeat-same-map`, `defeat-retry` |
| `victory` | constrói o templo e espera a vitória | `temple-celebration`, `victory` |
| `nova-phone` | celular 844 x 390: todo botão redondo (nível, engrenagem, velocidade, Objetivos, Avisos, Estatísticas, Mover, Rua, Demolir e as 4 categorias da coluna) ≥ 44 px reais e dentro da altura da tela; nenhuma parte do topo encosta em outra; Mercado escolhido (categoria, depois a construção) com o balão à esquerda da coluna; o balão da Casa fica abaixo da estação, da velocidade e da engrenagem; nenhum texto < 12 px reais; Parque bloqueado não é escolhido ("Libera no objetivo N"); casa de barro tocada com o balão e a ação principal; histórico e 2 marcos falsos com o toast do marco; Avisos, Objetivos, Estatísticas (abas Agora e Histórico) e Configurações abrem sem cobrir Mover, Rua e Demolir e fecham com Esc; um objetivo cumprido e uma Casa grande fazem o botão 3D pulsar sem abrir e o pulso termina em repouso; com as Estatísticas e um balão abertos, o botão 3D fecha os dois e na volta do 3D nada está aberto (só `nova-phone` e `nova-pc`); uma rajada de 5 toasts não perde nenhum (no máximo 3 na tela, o resto em fila) | `nova-phone`, `nova-phone-chosen`, `nova-phone-locked`, `nova-phone-house`, `nova-phone-spots`, `nova-phone-milestone`, `nova-phone-3d-invite`, `nova-phone-after-3d`, `nova-phone-alerts`, `nova-phone-goals`, `nova-phone-stats`, `nova-phone-history`, `nova-phone-settings`, `nova-phone-toasts` |
| `nova-phone-wide` | o mesmo no celular 915 x 412 | as mesmas, com `phone-wide` |
| `nova-pc` | o mesmo no PC 1366 x 768 (com mouse; coluna com nome, preço e tecla; pílula da Alegria e a previsão da comida por extenso) | as mesmas, com `pc` |
| `house-people` | celular 844 x 390, cidade pausada no Ano 4 com pessoas nomeadas (`setupPeople`): balão da casa de barro com "Casa de barro · 4/4 pessoas", 4 linhas de pessoas ≥ 44 px reais em **duas colunas**, a linha dos filhos ("Sem filhos: casa cheia"), nenhum texto < 12 px, balão dentro da tela e sem cobrir a casa (a câmera desliza a casa para o lado); casa de pedra com uma idosa; casa grande com 8 pessoas (4 linhas) com balão e botões acima de Mover, Rua e Demolir; casa de pedra vazia ("Casa de pedra vazia: …") | `house-people`, `house-people-stone`, `house-people-big`, `house-people-empty` |
| `house-people-wide` / `house-people-pc` | o mesmo em 915 x 412 e no PC 1366 x 768 (PC: **uma coluna** de pessoas) | as mesmas, com `-wide` e `-pc` |
| `person-sheet` | celular: tocar em "Natã" no balão abre a ficha (o balão fecha); a ficha fica acima das ferramentas e à esquerda da coluna, sem texto < 12 px; o botão do pai abre a ficha dele com "Ezequias · † aos 71" e "Joás · foi embora no Ano 3"; Voltar volta para Natã; o botão Casa fecha a ficha e abre o balão da casa | `person-sheet`, `person-sheet-father`, `person-sheet-house` |
| `person-sheet-wide` / `person-sheet-pc` | o mesmo em 915 x 412 e no PC | as mesmas, com `-wide` e `-pc` |
| `stats-people` | celular: Estatísticas, aba **Povo** (crianças, adultos, idosos, o ano, casais esperando, caravana anunciada, famílias) sem cobrir as ferramentas nem a coluna e sem texto < 12 px; o botão da primeira família fecha o painel e abre o balão da casa dela | `stats-people`, `stats-people-house` |
| `stats-people-wide` / `stats-people-pc` | o mesmo em 915 x 412 e no PC | as mesmas, com `-wide` e `-pc` |
| `granary-upgrade` | celular: balão do celeiro com a ação dourada "Melhorar · 60" e "Nível 2: guarda 600 · …"; o toque sobe o nível; sem prata o botão fica cinza "Falta prata: custa 100" e o toque diz o mesmo num toast; no nível 3, "Nível máximo" sem ação; o balão da ferramenta Celeiro diz "Guarda 300 · melhora até 1000" | `granary-upgrade`, `granary-upgrade-nosilver`, `granary-upgrade-top`, `granary-upgrade-build` |
| `granary-upgrade-pc` | o mesmo no PC | as mesmas, com `-pc` |
| `caravan-announced` | celular: evento de caravana anunciada (toast) e o aviso "Caravana com 3 famílias em 6 semanas: faltam …"; Avisos aberto | `caravan-announced`, `caravan-announced-alerts` |
| `caravan-announced-pc` | o mesmo no PC | as mesmas, com `-pc` |
| `couple-waiting` | celular, sem casa vazia: aviso "Casal esperando casa: construa uma casa"; perto do prazo, "Natã e Débora vão embora em 8 semanas: falta casa" (Avisos aberto) | `couple-waiting`, `couple-waiting-leaving` |
| `couple-waiting-pc` | o mesmo no PC | as mesmas, com `-pc` |
| `toasts-tutorial` | celular, primeira partida: três toasts ficam acima do balão do tutorial (antes encostavam nele) | `toasts-tutorial` |

### Ganchos de desenvolvimento

Só no modo dev (`npm run dev`, e é o que o script usa), o jogo expõe no `window`:

- `?seed=N` na URL fixa o mapa (rio, bosque e caravana). O script visual usa `?seed=5`: o rio fica
  fora das cidades de teste e as tendas da caravana são removidas antes de montá-las.

- `window.game` — a `GameScene` (câmera em `game.cameras.main`, `game.refresh()`, `game.selectTool(t)`;
  em `game.map` a `MapView`: `map.work` é o relógio das animações de trabalho, que pode ser
  avançado com o jogo pausado, e `map.views` as construções desenhadas, com `crew.count` nos campos);
- `window.state` — o `GameState` atual;
- `window.core` — todas as funções do core (`core.place`, `core.clearCell`, `core.stepWeek`...);
- `window.iso` — projeção e giro do mapa (`iso.gridToWorld`, `iso.getRotation()`); o
  `cellToScreen` do script já usa o giro atual;
- `window.layout` — posições da interface: `novaPoint(nome)` dá o centro e o tamanho `d` (px do jogo)
  de `level`, `gear`, `speed-0|1|3` (no celular os três dão o mesmo botão), `side-goals|alerts|stats|3d`,
  `tool-view|road|clear`, `build-<tipo>` (o botão da categoria enquanto a faixa dela está fechada),
  `pill-silver|food|goal|season`, `column` e, com o painel aberto, `stats-now|history`,
  `setting-dayNight|miniature` e `setting-turn-left|right`.
  `window.game.weather.force('rain' | 'snow' | 'clear' | null, força = 1, 'light' | 'medium' | 'heavy')`
  fixa o clima e já enche a tela de gotas (null volta ao sorteio das estações);
  `weather.forceWet(0..1 | null)` fixa o chão molhado e as poças; `window.game.seasons.force({ snow, drought } | null)`
  força inverno com neve e/ou todo ano seco no desenho (null volta à semente para a neve e ao
  `state.drought` do core para a seca; a terra só racha da semana 4 da primavera ao começo do outono).
  A estação e o mês vêm de `state.week`. Em `game.map`: `look` (a aparência aplicada), `snowDirty`
  (texturas com neve ainda sendo desenhadas), `tiles` (o que cada célula mostra), `puddles`. `window.game.guide` é o tutorial (`guide.step`, `guide.running`, `guide.holdsClock`), `window.game.ghost` o caminho
  fantasma, `window.game.spot` o lugar de comida para onde ele leva e `window.game.ui.tutorial` o balão (`skipBtn`, `okBtn`).
  `window.game.ui.isOverUi(x, y)` diz se um ponto está sob a interface (com 8 px de folga em volta
  dos controles). A interface fica em `window.game.ui.view` (`top`, `column`, `tools`, `panels`,
  `inspector`, `toasts` com `list` e `queue`, `tag` a pílula sobre a célula sob o cursor);
  `window.game.ui.milestone(id, semana)` mostra a frase de um marco.
- `window.view3d` — só com a visão 3D aberta (`window.game.open3D()` ou o botão 3D): `frames`
  (quadros já desenhados), `fps()`, `info()` (qualidade, chamadas, triângulos, moradores, rótulo),
  `rig` (câmera: `rig.set({ yaw, pitch, dist, x, z })`), `quality('high'|'low'|'min')`, `close()` e
  `view({ pos, day, weather, force } | null)`: mostra outra semana (`pos`, semana com fração), hora
  (`day`, 0..1, 0 = amanhecer) e clima, e força neve/seca, só no desenho (o estado não muda).

Use-os para montar situações rapidamente em vez de jogar até lá. Depois de mudar o estado
diretamente, chame `window.game.refresh()`. Se mudar conexões à mão (ruas, construções), prefira
`core.place`/`core.clearCell`, que já recalculam a rede, ou chame `core.refreshCity(state)`.

### Escrever um cenário novo

Adicione uma entrada em `scenarios` no `run.mjs`:

```js
async 'meu-cenario'(page) {
  await startGame(page);              // abre o jogo e passa da tela inicial (tutorial pulado;
                                      // startGame(page, { tutorial: true }) para jogar com ele)
  await tool(page, 2);                // tecla do PC: 1 Mover, 2 Rua, 3–6 categorias, 0 Demolir
  await pick(page, 'granary');        // ou escolhe qualquer ferramenta direto
  await mouseDrag(page, [[17, 16], [20, 16]]);   // arrasta entre células da grade
  const s = await stats(page);        // ruas, construções, níveis, zoom, vitória
  assert(s.roads === 19, 'mensagem clara');
  await shot(page, 'meu-cenario');    // screenshots/meu-cenario.png
},
```

- `cellToScreen(page, x, y)` converte uma célula da grade para a posição no jogo (1280 x altura)
  usando a câmera atual; `gameToPage` e `cellToPage` convertem para a página (o canvas é escalado
  quando a janela não é 1280 x 720).
- `clickUi(page, 'pill-silver')` clica numa parte da interface pelo `novaPoint`; `uiPoint(page, nome)`
  dá a posição no jogo (para toque); `pressBuild(page, tipo)` toca a categoria e depois a construção.
- `mouseDrag` falha se alguma célula do arraste estiver sob a interface: escolha células no mapa
  aberto (a coluna à direita, os botões laterais e as ferramentas de baixo à esquerda, as pílulas no topo).
- Para celular ou PC, use a forma `{ context: PHONE | PC, run(page) {...} }` (veja `input-phone` e
  `input-pc`). No celular, `touchInput(page)` dá `touch(type, pontos)` e `tap(ponto)` com toque real
  pelo protocolo do Chrome, em coordenadas do jogo.
- No PC, o primeiro movimento do mouse depois de sair de um botão vai para a interface (evento
  "out" do Phaser); mova duas vezes antes de conferir a prévia.
- `shot(page, nome)` espera as construções novas terminarem de subir (andaime) antes da captura;
  use `{ scaffolds: true }` para fotografar o andaime. `buildTown(page)` monta a cidade de exemplo
  (com celeiro, coletora com o seu bosque e um pescador no rio a leste).
- Há uma interface só (a Nova); a chave antiga `jerusalem.ui` é ignorada.
- `startGame` espera os ganchos de dev, a `UIScene` e o `window.layout` (com `novaPoint('tool-road')`) por até 60 s, para a máquina carregada não quebrar o primeiro clique.
- `startGame` marca o tutorial como visto (`jerusalem.tutorialDone` no `localStorage`) antes de abrir
  a página, salvo com `{ tutorial: true }`.
- `startGame` desliga o controle de quadros por segundo (`game.dayNight.fpsGuard = false`), para o
  acabamento não sumir no navegador lento. Ganchos: `game.dayNight.setTime(t)` (0..1, 0,76 = noite),
  `game.dayNight.current`, `game.wear.step(state, x, y)` e `game.wear.level(state, x, y)`.
- O navegador sem placa de vídeo é lento: prefira `page.waitForFunction(...)` esperando um estado
  do jogo em vez de tempos fixos longos.
  O Phaser limita o tempo de cada quadro (no máximo ~200 ms, e 16 ms logo depois de abrir ou
  quando a janela perde o foco), então no Chromium lento 1 s de relógio pode ser só um punhado
  de quadros de jogo: partículas e animações não "andam" o que o tempo fixo sugere. Era por isso
  que a verificação "rain falls" falhava às vezes; agora `weather.force` adianta as partículas
  e o cenário espera pela condição.

## Simulação de equilíbrio (`tools/sim`)

Partidas inteiras sem interface, rodando só o `src/core` com semente fixa, para medir a
sobrevivência, a duração e a economia (usado pelo sim-tester). O script é empacotado com o
`rolldown` (já instalado com o Vite) em `node_modules/.cache/sim/` e rodado com o Node; nada vai
para `dist/`. A pasta `tools` entra no typecheck (`npx tsc --noEmit`).

```bash
npm run sim                                   # 4 jogadores x 20 sementes, até 1000 semanas
npm run sim -- --bots comum --seeds 100       # um jogador, 100 sementes
npm run sim -- --brief                        # uma linha por jogador
npm run sim -- --json                         # resultados brutos
npm run sim -- --rows                         # uma linha por partida
npm run sim -- --trace comum:1:80             # semana a semana de uma partida (jogador:semente:semanas)
npm run sim -- --set rules.workerShare=0.5 --set buildings.field.harvest=400 --drop-goal 4
npm run sim -- --profile savesTemple=true     # muda um campo do perfil dos jogadores rodados
```

`--set tabela.caminho=json` muda números **só na memória** (tabelas `buildings`, `goals`,
`houses` e `rules`), para medir propostas sem editar `src/data`. `--drop-goal N` tira a meta N
(contando de 1); o que ela liberava passa para a meta anterior. `--profile campo=json` muda um campo
do perfil de todos os jogadores da rodada (por exemplo `savesTemple`, abaixo).

| Arquivo | O que faz |
|---|---|
| `survival.ts` | os jogadores (`SurvivalBot`, perfis em `PROFILES`) e `run(perfil, semente, semanas)`, que joga uma partida e mede tudo. Só usam a API do core e leem custos dos dados |
| `run.ts` | linha de comando e resumo por jogador |
| `overrides.ts` | `--set` e `--drop-goal` |
| `node.d.ts` | o pouco do Node que o script usa (`process.argv`), para o typecheck |

Jogadores (perfis em `PROFILES`; o rng do jogador é separado do rng do jogo):

- **eficiente** — conhece as regras: planeja a comida com a previsão, planta no outono, olha
  as vagas antes de construir, faz o celeiro cedo e põe praças onde atendem mais casas e um passo "Evolução" dá a praça, o mercado ou o parque às casas paradas.
- **pescador** — como o eficiente, mas não planta campos: alimenta a cidade com pescadores e
  coletoras.
- **comum** — reage ao que vê na tela com 3 semanas de atraso, fica parado 10% das vezes, não usa
  a previsão nem sabe da época de plantar, mistura campo, pescador e coletora.
- **distraido** — só percebe a comida na fome, fica parado 30% das vezes, lugares quase ao acaso;
  reage a uma casa parada só depois de ver o balão por `delay` semanas (`reactsToBalloons`).

O eficiente, a partir do objetivo que libera o Templo (8), reserva um 6 x 6 para ele (o lugar pronto
mais perto do altar, senão o amarelo; não constrói nem abre rua em cima) e guarda prata: metade do
preço enquanto o objetivo 8 corre, o preço todo depois (comida, celeiro e casas não esperam)
(`reservesTemple`). Os serviços que cada nível de casa espera saem de `houses.json` (a necessidade
que o próximo nível acrescenta), nunca de uma tabela copiada. `savesTemple` (desligado por padrão,
`--profile savesTemple=true`) imita quem segue a linha "Junte 800 para o Templo": do Templo liberado
até erguido, guarda o preço dele (comida, celeiro e casas não esperam) e, no último objetivo, espera
juntar em vez de gastar.

Medidas por partida: sobreviveu ao Ano 1, a cidade esvaziou, perdeu por dívida, venceu (e em
quantas semanas e minutos a 1x), moradores nas semanas 52 e 104 e o pico, semanas de fome no Ano 1
e no total, maior sequência de fome, tendas abandonadas (e no primeiro inverno), semana do
primeiro campo, da primeira colheita e do primeiro celeiro, comida feita por campo, pescador e
coletora e o quanto estragou, motivos de nascimentos bloqueados (`birthBlock`, Ano 1 e total), anos secos,
semana de cada objetivo, construções feitas. Do Pacote Ritmo: casas com família na semana 52,
invernos com fome, crises (moradores 25% abaixo do pico ou 4+ semanas seguidas de fome) e
recuperações (volta ao pico de antes), maior número de oficinas ao mesmo tempo, maior sequência
com mais de 300 de prata antes de o Templo ser liberado, moradores no fim de cada ano, motivos da
bloqueio por ano e casas por nível no fim. Tendas abandonadas contam só as da fome (`reason: 'famine'`).
Pacote Povo: pessoas por ano (`peopleByYear`: casamentos, nascimentos, mortes), famílias de
caravana que ficaram ou seguiram, caravanas com todas/alguma família abrigada, maior número de
celeiros, casais que desistiram e a maior espera de um casal, a razão de crescimento ano a ano
(`growthMax`), o primeiro inverno com 15 casas com gente (`g15`: celeiros e fome), por que cada casal
fértil não teve filho em cada semana (`coupleBlocksByYear`: `city` = `birthBlock`, `full` = casa
cheia, `gap` = intervalo, `open` = podia), crianças/adultos/idosos, sem trabalho e idade mediana de
morte no fim, e a semana em que a cidade passa de cada marco, de cada múltiplo de 5 moradores e de
N casas de cada nível (`marks`, para desenhar objetivos). O `--brief` é a tabela dos critérios de
aceite A1–A11 do Pacote Povo (`docs/revisoes/2026-11-05/plano.md` 8.3) por jogador e uma linha final
com A2 (vitória geral) e A3 (Eficiente > Comum > Distraído). A5 sai de dois jeitos: a mediana do maior
intervalo de cada partida e o pior objetivo pela mediana da espera dele (`worst-goal`). O `--trace`
mostra crianças/adultos/idosos, solteiros (homens/mulheres) em idade de casar e casais esperando.
Os bots constroem casas para os casais esperando e as famílias da caravana anunciada (mais
`plotsAhead`) e melhoram o celeiro antes de fazer outro. Eficiente e Pescador servem na hora uma casa
cheia com casal fértil (praça, mercado ou parque já com 1 casa); o Distraído vê os avisos de casal e
de caravana com o dobro do atraso (`houseDelayFactor` 2) e não prepara metade das caravanas
(`caravanSkip` 0,5).
Pacote 3 (madeira e pedra): os bots nunca tentam construir sem o material e marcam `lacked` (o
"toast" que viram). Um passo "Materiais" (depois do celeiro) põe Lenhador e Pedreira no lugar de
melhor rendimento (como Pescador e Coletora, com rua se precisar). Eficiente e Pescador fazem o
primeiro logo (a Pedreira assim que libera) e outro enquanto a produção fica abaixo da meta
(`materialNeed`) com o estoque baixo; o Lenhador deles evita o bosque da Coletora (`sharedTrees`). O
Comum faz o primeiro Lenhador com menos de 15 de madeira, a primeira Pedreira quando o objetivo pede
casas de pedra (ou ao ver o aviso), e outro só depois de `materialWait` (13) semanas de falta. O
Distraído só reage ao aviso (casa esperando, obra que falhou) e espera 26 semanas para o segundo.
Contam só os que rendem ≥ 0,5/sem (no máximo 4 de cada); ao fazer um novo, Eficiente e Comum demolem
os parados (bosque cortado). O primeiro, ou um para casas esperando, sai mesmo sem trabalhador livre.
Com reserva (`materialReserve`), obras que não são casa, Lenhador, Pedreira ou Templo não gastam o
material das casas que esperam (o planejador conta as que sobem em até 4 semanas), 5 (10) de madeira
para uma casa nova, nem o do Templo depois que ele libera (o Eficiente já guarda metade no objetivo
que o libera). `trim()` nunca derruba o último Lenhador nem a última Pedreira. Medidas (`mat`):
Lenhadores e Pedreiras ao mesmo tempo, semanas com casa esperando cada material e a maior espera de
uma casa, semanas do Ano 1 com obra travada por madeira, maior sequência com madeira ou pedra acima
de 300 antes de liberar o Templo, sem trabalho na semana 200, tocos nas semanas 260 e 520, árvores
cortadas, produzido e gasto (obras e níveis de casa), estoque no fim de cada ano e o que o Templo
esperou por último. O `--brief` ganha as linhas `wood`, `stone` e `W1…W6`; A4 mostra também a razão
contra o melhor ano anterior ou a caravana fundadora (`growthPeak`, "over best year": separa a
recuperação depois de uma crise de uma explosão). O `--trace` mostra madeira e pedra.
M2 (P2 correções): ao liberar o Templo, existe um 6 x 6 livre a no máximo `templeSpotRoadGap` célula
da rede (`templeSpotsNear`); o `--brief` mostra também quantos tinham lugar pronto (diagnóstico). A
linha `--brief` resume os critérios do pacote. Ritmo do fim (P2 final): `end` mostra a espera do
objetivo 8 ao 9 (mediana e p75), do 9 à vitória (mediana e p75, só das vitórias) e quantas partidas
que chegaram ao 9 venceram; no fim de cada partida o resultado guarda a prata, a renda da semana e se
havia lugar pronto (ou qualquer 6 x 6 livre) para o Templo (`endSilver`, `endIncome`,
`endTempleRoom`, `endTempleAny`).

Os jogadores seguem o que a tela mostra: o desemprego conta as vagas do ano todo (como o
aviso), a oficina só é construída por desemprego enquanto o bônus dos campos não chegou ao teto, e
nenhum jogador guarda mais que meio ano de comida (acima disso aceita o estrago).

## Vigia de agentes (`tools/watchdog.sh`)

`tools/watchdog.sh [limite=1200] [intervalo=60]` roda enquanto houver agentes trabalhando. A cada
intervalo, encerra na hora toda espera em `pgrep -f`/`pkill -f`, que se encontra e nunca termina, e qualquer outra espera em laço (`until`/`while` com `sleep`) viva há 30 min. Também
avisa (sem encerrar) quando um teste visual, uma simulação ou um navegador headless passa do limite em
segundos. Para esperar um processo, use o PID (`wait $pid`, `kill -0 $pid`), nunca `pgrep -f`.

Ganchos em `.claude/settings.json` (valem para o agente principal e todos os subagentes):
- `tools/hooks/guard-bash.mjs` (antes de cada comando Bash) recusa laços de espera
  (`until`/`while` com `sleep`, laços com `pgrep -f`) e recusa `npm run test:visual`, `npm run sim`,
  Playwright e `tools/sim` sem `timeout N` na frente. A recusa explica ao agente o jeito certo.
- `tools/hooks/start-watchdog.sh` (ao abrir a sessão) liga o vigia em segundo plano, um só por
  vez (arquivo `logs/watchdog.pid`), com registro em `logs/watchdog.log`.

## App instalável (`scripts/pwa-check.mjs`)

`npm run test:pwa` serve o `dist/` com `vite preview` e confere no Chromium: o Chrome considera o
app instalável (sem erros de manifesto), o service worker controla a página, o jogo recarrega sem
internet e não há erro na página. Também abre a visão 3D com internet (toque no botão 3D) e de
novo sem internet, e confere que os modelos .glb estão no cache. Rode depois de `npm run build`; ao mudar arquivos em `public/`,
suba `VERSION` em `public/sw.js` para os celulares baixarem a versão nova.

Os ícones em `public/icons/` são gerados pelo próprio jogo (o templo sobre o céu):
`node tools/icons/make-icons.mjs` regera todos.

## Desempenho da visão 3D (`scripts/view3d-perf.mjs`)

`node scripts/view3d-perf.mjs` mede os quadros por segundo da visão 3D num celular simulado
(844 x 390, deviceScaleFactor 2,6, toque, CPU 4x mais lenta) numa cidade de ~45 construções, de dia,
à noite e na chuva, com qualidade automática; usa a GPU do WSL quando existe (`--soft`: SwiftShader,
pessimista). Capturas em `screenshots/view3d-perf` (`VIEW3D_OUT` muda a pasta; `VISUAL_PORT` a porta).

## Testar no celular de verdade

`npm run dev` e abra no celular o endereço "Network" que o Vite mostra (mesma rede Wi-Fi). O
teste visual de toque cobre os gestos, mas tamanho de texto e conforto dos botões só se avaliam
no aparelho.

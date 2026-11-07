# Como testar

Dois níveis de teste: **unitários** (regras do jogo, rápidos, obrigatórios) e **visuais**
(o jogo de verdade num navegador, com screenshots).

```bash
npm test                        # testes unitários (Vitest), ~1 s
npm run test:visual             # todos os cenários, ~4 min
npm run test:visual -- touch    # só os cenários cujo nome contém "touch"
npm run test:visual -- play3d,ui3d    # vários: nomes separados por vírgula
VISUAL_PORT=5299 VISUAL_OUT=/tmp/shots npm run test:visual   # outra porta e outra pasta (dois agentes ao mesmo tempo)
VISUAL_SHARD=0/4 npm run test:visual   # só um quarto dos cenários (0/4, 1/4, 2/4 e 3/4 cobrem todos): rodadas curtas
npx tsc --noEmit                # typecheck
npm run build && npm run test:pwa  # o build é um app instalável e abre sem internet
```

Antes de dar uma tarefa por concluída: `npm test`, `npx tsc --noEmit` e `npm run test:visual`
precisam passar, e as screenshots afetadas pela mudança devem ser **olhadas**.

## Testes unitários (`tests/`)

Cobrem `src/core` (TypeScript puro, sem Three.js nem DOM), a lógica pura da visão 3D (`tests/render3d`), o controle do jogo (`tests/game`) e as peças da interface HTML sem navegador (`tests/ui`). **Toda regra nova ou alterada precisa de teste.**

| Arquivo | O que cobre |
|---|---|
| `map.test.ts` | mapa 48 x 48 e mesma semente = mesmo terreno; em 100 sementes: contagens de rochas e árvores nas faixas, rio contínuo de 3–4 células a 8–18 do altar, bosque denso (18+ árvores em 7 x 7) a 11–20 do altar, nada sobre área livre ou rio, rua inicial livre, tendas dentro do raio livre, 3+ lugares para o Templo a até 12 do altar; árvores agrupadas; variação do rio e do bosque entre sementes; área livre do altar e da faixa da rua, estado inicial (altar, rua, entrada, prata, liberações), anel de rua em volta do altar (20 células livres, ligadas e alcançáveis da entrada, sem custo) |
| `network.test.ts` | rede de ruas ligada a qualquer lado do altar 4 x 4, caminhos que não atravessam o altar, desconexão ao demolir, custo e validação de rua, caminhos por busca em largura, máscara de junções (anel, cantos e T com a rua sul; o altar não conta), exigência de rua para cada tipo de construção |
| `coverage.test.ts` | números da Praça e do Parque (raio 4, categoria casa; sem `well` nem `garden`), cada um cobre só o seu serviço, raio quadrado a partir de qualquer célula, sem cobertura quando desconectado, área sagrada do altar 4 x 4, raio do templo 6 x 6, áreas não quadradas |
| `economy.test.ts` | eficiência, construções desconectadas não dão comida nem contam vagas, vagas do templo, manutenção (inclusive de desconectadas; rua, casa e altar grátis; cobrada desde a primeira semana), saldo exibido = impostos − manutenção (nenhuma construção dá prata; sem `production` nem `silver`; oficina com trabalhadores não muda a prata), maior custo, consumo de comida das pessoas (pela idade) e no inverno (× `foodFactor`, tenda × `tentFoodFactor`), campo com 468 de colheita e sem `food`, bônus das oficinas nos campos (0,1/0,2/0,3, teto na 4ª, desligada não conta, pescador e coletora sem bônus), pessoas sem trabalho pelas vagas do ano (`yearJobs`: desemprego, alegria e imposto iguais no outono e no inverno) e limite do aviso de desemprego (só com a Oficina liberada) |
| `actions.test.ts` | custos e locais inválidos, tamanhos das construções, mercado girado, posicionamento do templo (6 x 6, bloqueios, exige rua, lista de posições possíveis), `templeSpotsNear` (encostado = pronto, a 1 célula = falta rua, a 2 fora; mais perto do altar primeiro; só os prontos aceitam `checkPlace`), `templeRoadSpot` (sem área perto da rede: o lugar livre que a rua mais curta alcança e essa rua; construída a rua, fica pronto; nulo sem lugar), `onlyNeedsRoad` (livre e com prata mas longe da rede; nunca ocupado, sem prata, bloqueado ou rua), lugares de casa encostados na rede (`placeSpots`, tutorial), limpar, proteção do altar e do templo |
| `houses.test.ts` | evolução em `weeksToUpgrade` e regressão em `weeksToDowngrade` (rua, praça, mercado, parque; barro só com a rua (e a madeira), pedra com praça, casa grande com mercado + parque: o raio do altar e o do templo não bastam; casa grande que perde o parque cai), fome pausa a subida sem zerar, perder uma necessidade zera, `weeksToNextLevel` (contagem, congela na fome, null no topo ou sem necessidade), atendimento por qualquer célula da casa, fome (casas caem; tendas abandonadas com `famineLeaveChance` e evento de família saindo com `reason: 'famine'`; sem fome nunca), casa que perde a rua (a tenda vira terreno com `familyLeft` `reason: 'road'`; uma casa de pedra só manda a família embora ao chegar a terreno), informações e balões (incluindo "sem trabalhadores"; a informação da casa lista a necessidade trancada; o balão com a necessidade trancada do plano P2 2.6 está em `it.skip` até `needVisible` mudar) |
| `families.test.ts` | pessoas andando (`sendWalking`, `freeHouses`: maior `emptyLevel`, depois a mais perto, depois o id), chegada (`moveIn`: a casa sobe ao nível guardado, no mínimo tenda; casamento na chegada), rota recalculada, desistência (casa demolida, desligada ou ocupada; quem vinha de fora vai embora com `noHouse`), saída pelo altar quando a entrada está desligada, velocidade `familyCellsPerWeek` |
| `people.test.ts` | pessoas: idade e faixas (1 estação = 1 ano), comida por faixa e inverno, chance de morte pela idade (aniversário, `departed` com causa), invariante casa nível ≥ 1 ⇔ alguém mora (`vacate` guarda `emptyLevel`, tenda guarda 0), idosos sozinhos vão para a casa de um filho com lugar, noivados (idades, chance, outra casa, sem pai ou mãe em comum, diferença máxima, a mais perto da idade), casamentos (mudança na mesma semana quando um mora sozinho; senão andam até a melhor casa vazia e casam ao chegar; esperam e vão embora após `coupleWaitWeeks` com `coupleLeft`), nascimentos (`birthBlock`: fome, comida com reserva — negativa, −3: nasce com a comida acabando 1 semana antes da colheita, não 5 —, estoque; idade fértil, lugar na casa, intervalo, chance × alegria, sobrenome do pai), marcos `firstWedding`, `firstBirth`, `firstGrownUp` (só nascidos na cidade aos 14) e `thirdGeneration` (só com pai ou mãe nascido na cidade), saídas por fome e rua com o nome da família |
| `caravans.test.ts` | caravana fundadora (3 a 5 famílias de até 3 pessoas, uma por tenda; nunca um casal de noivos jovens além de `start.couple`; o casal de noivos 18–19 em casas diferentes; filhos alternando sexo; comida 14–22 semanas cortada pelo estoque; mesma semente = mesmo jogo), caravanas seguintes sorteadas no início (janelas, famílias, aviso, a terceira em cerca de metade das partidas), anúncio `warn` semanas antes, chegada pela entrada até casas vazias (maior `emptyLevel` primeiro; sem casa seguem viagem sem registro; marco `firstCaravan` só se alguém fica), comida trazida 4–8 semanas cortada pelo estoque, modelos de família; a 1ª caravana sempre com um casal de noivos (`engaged`): dois jovens de 18–22 de nomes de família diferentes, uma casa só, casam ao chegar (casamento do ano, evento, marco); sem casa seguem viagem; quem fica recomeça a contagem da dívida |
| `levels.test.ts` | níveis de Celeiro, Mercado e Oficina (`levels`, `statOf`, `nextLevelOf`), `upgradeBuilding` (paga, sobe, muda estoque e manutenção, evento `buildingUp`; falha no topo, sem prata, em dívida e em construções sem nível), mercado de nível maior alcança mais, oficinas somam até o mesmo teto, manutenção desde a primeira semana (nenhum objetivo a libera), pescador e coletora × `winterFactor` no inverno (na semana e na previsão), `upWeeks` sorteado em 11–15 ao construir e a cada nível |
| `invariants.test.ts` | **invariantes** em partidas inteiras dos bots `eficiente`, `comum` e `distraido` (3 sementes × 300 semanas, conferidas toda semana): toda pessoa sem casa está andando; toda pessoa com casa mora numa casa que existe com nível ≥ 1; casa com nível ≥ 1 ⇔ alguém mora nela; ids únicos entre `people` e `departed`; cônjuge conhecido; o estado inteiro passa por `JSON.parse(JSON.stringify)` |
| `happiness.test.ts` | felicidade desligada antes do Parque (liga com o Objetivo 7) (contente, sem motivos, imposto e nascimentos iguais aos de uma cidade sem felicidade); felicidade da casa (base, cada fonte sozinha: praça +5, parque +20, altar +10, templo como o altar; parque só conectado e no raio, mercado, fome, desemprego com teto, limites 0–100), três humores, fator do imposto e dos nascimentos (`birthFactor`: 1 enquanto contente, extremos), imposto da casa feliz e triste, média da cidade (50 sem famílias), parte sem vaga, contagem por humor, informação da casa com felicidade e imposto real, balão de casa triste |
| `debt.test.ts` | manutenção levando a prata abaixo de 0, construir e cortar bloqueados em dívida (demolir não; prata 0 não é dívida), contagem da dívida (início, zera com prata ≥ 0, recomeça), derrota exatamente na semana 24 e simulação parada depois, sem derrota enquanto uma caravana planejada ou anunciada chega em até `debtCaravanWeeks` (contagem parada em 23, aviso com 1 semana; derrota quando ela chega sem ninguém ficar; caravana longe, pulada ou já chegada não poupa), maior população, ordem dos avisos (dívida, saldo negativo com maior custo, desemprego) |
| `goals.test.ts` | os 19 objetivos na ordem do Pacote B1 (tipos, alvos, marcos, prêmios, liberações; um só de vitória; nenhum `fromYear`), `unlockingGoal` (celeiro 1, pedreira 4, praça 5, oficina 6, mercado 7, parque 9, templo 16), Praça fechada no início e liberada pelo Objetivo 5, Objetivo 9 liberando o Parque, Objetivo 1 pela previsão (com pescador) e alvo que encolhe, Objetivo 2 não se cumpre sem moradores mesmo com uma família a caminho (e se cumpre quando ela chega), objetivos `milestone` (também com o marco alcançado antes), casas de barro, moradores (pessoas), casas grandes só conectadas, vitória com o templo, um objetivo por verificação, `goalOpen` com `fromYear`, `TEMPLE_GOAL` = o objetivo antes da vitória (175 moradores) e templo erguido antes dele vence na semana em que ele se cumpre (`templeWaitsForGoal`), nenhum objetivo `water` nos dados |
| `simulation.test.ts` | comida, prata, semana, fome (termina com a colheita da primavera), nenhuma prata de produção e relógio (1 semana a cada `weekSeconds` em 1x) |
| `seasons.test.ts` | 13 semanas por estação começando no outono, ordem das estações, primeira semana de cada estação, um evento `season` só quando a estação muda, `seasonCount`/`START_SEASON`, ano agrícola do outono ao verão no `calendar`, jogo novo na semana 1 do outono do Ano 1 |
| `tutorial.test.ts` | os 6 passos com a comida primeiro e a madeira antes da casa (rua, pescador ou coletora, campo, lenhador, casa, casamento; sem praça) e o mini passo do mercado, relógio parado nos passos de construir e andando no casamento (`tutorialHoldsClock`), `markTutorial` (ruas, casas, o caminho sugerido e a semana), condição de cada passo (rua marcada pronta ou o mesmo número de ruas novas na rede, casa nova ligada sem contar a caravana, pescador/coletora ligado, marco do primeiro casamento — também com o casal da caravana de verdade em 3 sementes — ou `weddingStepMaxWeeks` semanas no passo, campo, mercado), `houseHint` (o terreno livre na rede mais perto do altar, sem praça), `foodSpot`/`ghostRoad` (em 200 sementes o lugar rende ≥ 1,2/sem e, construído como indicado, fica ligado e rende o prometido; caminho contínuo da rede até o lado da construção; prefere o que rende mais e depois a rua mais curta; nulo sem lugar que renda o bastante; contorna uma construção no caminho), casas atendidas por um serviço ("Atende N casas") |
| `forecast.test.ts` | nível alvo de uma casa (`targetLevel`), previsão com o consumo das pessoas que moram hoje (uma praça nova não muda nada; quem anda não conta; crianças comem mais e idosos menos), consumo de inverno (tenda e casa), previsão que atravessa o inverno, `reserveWeeks` (também negativo: a comida passa do zero até essa reserva), bônus das oficinas na previsão, `lastsToHarvest` igual a `foodLastsToHarvest`, previsão e `stepWeek` dão a mesma semana de fome em combinações semeadas, `nextFieldTurn` (inverno em N sem fora do inverno, primavera em N sem no inverno) |
| `readouts.test.ts` | nível da cidade e progresso do objetivo, calendário, saldo depois de construir, casas atendidas, ganho ao evoluir (`upgradeGain`: lugares e imposto), leitura da cidade com `birthBlock`, lugares que atendem uma construção, casas por nível, comida feita e comida, `foodAfter` (um local de trabalho que tira o único trabalhador baixa a comida; o campo rende a colheita × a eficiência com as vagas dele; num lugar sem rua não rende nem ocupa vagas; no inverno o campo não rende), `templeSavings` (só do Templo liberado até erguido, nunca abaixo de 0) |
| `peopleReadouts.test.ts` | leituras do Povo para a tela: `houseBirths` (pode ter filhos; nulo sem casal que possa; casa cheia antes da comida, fome antes de tudo; repassa `food`/`storage`; nulo em terreno e outras construções), `householdsOf` (casas com gente, as mais cheias primeiro, nome pelo mais velho), `grownUpThisWeek` (nascido na cidade no aniversário que o faz adulto) |
| `viability.test.ts` | **viabilidade do Ano 1**: um plano mínimo (rua até a melhor comida, pescador ou coletora, campo, lenhador no `lumberSpot` logo depois do campo, celeiro quando liberado, mais comida quando a previsão não chega à primavera, terreno perto do altar quando um casal espera casa; sem praça; construir paga madeira) em 20 sementes: sem fome antes da semana 26, objetivos 1 (comida até a primavera) e 2 (primeiro casamento) no primeiro outono, objetivos 3 (`firstBirth`) e 4 (`firstSpring`) até a primeira primavera, pelo menos 4 objetivos no Ano 1, prata nunca negativa; invariantes: a prata inicial paga o kit mínimo (ruas, comida, campo, lenhador, um terreno), e 1 campo com o estoque base e o pescador ou coletora (× `winterFactor` no inverno) alimentam a caravana até a primavera; **A8**: 15 casas de barro (52 pessoas), 2 campos, pescador, coletora e 1 celeiro nível 1 cheio no começo do inverno passam o inverno sem fome |
| `survival.test.ts` | caravana por semente (3–5 tendas em filas de duas dos dois lados da rua do acampamento ao norte do anel; em 500 sementes `campPlazaSpot` é livre, ligável e atende todas; comida cortada no estoque base (100), semanas anunciadas reais, prata inicial), colheita só na primavera (`harvestsIn`, `firstHarvestWeek`, campo feito no inverno colhe no ano seguinte, última semana do outono ainda semeia, desconectado não colhe, eficiência, evento `harvestStart` com o total, marco `firstHarvest`), `weeksToHarvest`, consumo semanal, estoque com e sem celeiro (desligado não guarda), estrago (`spoilStart` uma vez, limite exato não estraga, perder o celeiro), previsão (semanas e estação, colheita e limite, seca anunciada, horizonte, primavera conta até o ano seguinte), inverno (tendas saem com 35%, casa de barro protege, `winterLoss`; marco `firstSpring` na primeira primavera com moradores mesmo com perdas, `firstWinter` só sem perdas, uma vez cada), seca (× 0,25, campo no rio protegido, nunca no Ano 1 nem 2 seguidas, chance, aviso do inverno à primavera), avisos novos e sua ordem (comida curta em qualquer estação; estoque cheio com o tamanho e o objetivo do celeiro enquanto bloqueado), marcos uma vez só (caravana não conta), histórico com `capacity`, objetivo `foodUntilSpring` com `goalTarget`, campo dá comida na primavera, verão e outono e congela no inverno (sem comida nem vagas; pescador a 100%; manutenção mantida; previsão com a eficiência de cada semana) |
| `materials.test.ts` | Madeira e pedra (P3): dados do Lenhador e da Pedreira, custos em material (`materialsOf`; rua, campo, praça, pescador, coletora e lenhador sem material), material por nível de casa (`upgradeGain`), caravana com 20/0, Lenhador liberado no início e Pedreira no Objetivo 4 (passe o primeiro inverno); rendimento (`gatherYield`: árvores × 0,25 até 3, × eficiência, tocos não contam; Pedreira conta rochas; desligado rende 0; o ano todo) e estoque semanal; corte (árvore mais próxima, empate pelo índice; na 10ª madeira vira toco com `treeCut`; sem trabalhadores não corta; Coletora perde a árvore), rebrota em 104 semanas com o mesmo tipo (`treeRegrown`); toco não bloqueia e some ao construir ou pôr rua (não volta), Demolir não age nele; construir sem material falha sem gastar prata (`materials`, `missingMaterial`), prata conferida antes, templo paga 800 + 300 pedra + 200 madeira; casa pronta sem material espera em 13/13 com `waiting` e sobe pagando na semana em que o material chega (também vindo da Pedreira), a mais antiga primeiro, perder uma exigência limpa a espera, cair não devolve, tenda → barro paga 5 de madeira sem praça; aviso `material` com a contagem e a ordem; porta das famílias ignora materiais; `sharedTrees`, `weeksPerCut`, `foodAfter` com o produto; passo do Lenhador logo antes do da casa, com `lumberSpot` |
| `cold.test.ts` | Morte de frio (Pacote B3): vulnerável = criança até `childAge` ou idoso; chances da tabela (tenda com lenha só vulneráveis, sem lenha tenda pior que barro, barro com lenha ninguém), fome dobra, fora do inverno e a caminho ninguém; sorteio abaixo da chance mata (`coldDeath` em `departed`, evento, `winterLoss`, `yearStats`), na chance não mata e chance 0 não sorteia; último morador esvazia a casa, cônjuge viúvo, vaga livre; `winterToll` na primavera só com mortes; aviso de outono com tendas; mesma semente, mesmas mortes |
| `firewood.test.ts` | Lenha e inverno: queima por nível só no inverno, frio (`s.cold`, eventos, casas como na fome), limite do estoque, `firewoodShort` e avisos; **a madeira é a lenha primeiro** (Pacote B1): `keepsFirewood` só no outono e no inverno e só quando pagar deixaria a lenha faltar (a produção até a primavera conta), tenda pronta no outono guarda a madeira (`firewoodHold`, sem `waiting`, nada pago, `houseInfo` mostra) e sobe na primavera pagando; sem o material, espera por ele (`waiting`) e não pela lenha |
| `work.test.ts` | Trabalho de cada pessoa (Pacote B2; local vazio paga metade da manutenção: lenhador e mercado nível 2 vazios e com gente, desligado também, celeiro, praça, parque e campo no inverno pagam cheio, economia e `costliestUpkeep` pelo valor pago, `balanceAfter` com e sem adultos livres): vagas livres pela `jobPriority` (comida primeiro, não pela idade do local) e pelo adulto que mora mais perto (empate pelo id); o jogo nunca move quem tem trabalho (pescador novo sem ninguém livre fica vazio e rende 0); mais gente que vagas solta os de id maior; mesma semente = mesmos trabalhos; perde o trabalho aos 50, ao morrer, ao sair, ao demolir e ao perder a rua; `setJob` (move na hora e de graça, a vaga deixada fica livre; recusa local cheio ou sem rua, criança e idoso; "Sem trabalho" não volta na mesma semana, na seguinte vai a uma vaga livre); mercado sem ninguém não cobre, celeiro vazio guarda; `unemployed` só conta adultos que moram aqui |
| `gather.test.ts` | Pescador e Coletora: dados, células de rio/árvore no raio (contadas à parte), 0,75 e 0,3 por célula com teto 4,5, mais longe rende menos, cortar árvore baixa, dois no mesmo recurso, desligado não rende, o ano todo com a eficiência, balões "sem fonte", "sem rua" e "sem trabalhadores" |
| `looks.test.ts` | aparência das casas: semente determinística, variante dentro do número do nível, espelhamento, vizinhas do mesmo nível com variantes diferentes, novo sorteio ao mudar de nível; plantação do campo diferente da do campo vizinho; construções de uma só aparência ficam na variante 0; ofício da oficina (sorteio determinístico, vizinhas diferentes, guardado na variante) |
| `rng.test.ts` | gerador semeado: mesma semente, mesma sequência; `shuffle` |
| `walkers.test.ts` | tipos de morador: só aparecem quando a construção existe e está ligada, destino pelo tipo (aguadeira na praça ou no mercado, cada um sozinho e os dois por semente; campo, mercado, oficina, altar/templo, ruas principais, borda), carregador campo → mercado e volta, destino aleatório de reserva, destino do artesão aponta a oficina e o ofício |
| `render3d/*.test.ts` | lógica pura da visão 3D (`src/render3d`, sem WebGL): `plan.test.ts` (o que se desenha: modelo por tipo e nível, casa vazia com o nível guardado, desbotada e com portão trancado, campo por cultura, acréscimos e altura nos níveis 2–3 de celeiro, mercado e oficina, área de cada modelo, frente para a rua, tocos e mudas pelo `stumps`, número de moradores na rua), `crowd.test.ts` (roupa por idade e sexo, família em grupo andando até a casa), `day.test.ts` (hora, sol, noite, janelas), `season.test.ts` (estações contínuas, campos), `weather.test.ts` (chuva por semente, chão molhado, luz do quadro, gente na rua), `picking.test.ts` (raio até o chão, célula do ponto, caixa da construção na frente), `diff.test.ts` (que camadas da cidade mudaram), `marks.test.ts` (o que o 3D pinta no chão para cada ferramenta, e a inclinação da câmera pelo zoom), `terrain.test.ts` (rua nova aplaina o chão na malha já feita), `fx.test.ts` (efeitos do mundo: anel que se espalha e some, pulinho, árvore tombando, poeira e pedrinhas pelo tamanho da área, faíscas do templo e do marco, mofo com moscas, mesma semente dá as mesmas partículas) |
| `game/*.test.ts` | controle do jogo sem desenho (`src/game`): `session.test.ts` (mesma semente = mesmo jogo, relógio na velocidade e parado em 0, diálogo parado, tutorial segura o relógio e mostra a frase e o caminho, construção trancada, rua solta avisada, falta de prata dita uma vez por arrasto, motivo do bloqueio, arrasto atualiza a cidade uma vez, poeira ao demolir, toque abre e fecha o balão, dívida em 3x volta a 1x, nascimentos e casamentos contados, girar o mercado), `events.test.ts` (cada evento da semana vira toast ou efeito na ordem certa; mortes de frio: um toast por semana com o nome e os outros somados, `winterToll`), `toastQueue.test.ts` (máx. 3, ruins na frente, repetido só renova, grande deixa 1, aviso que deixa de valer sai, painel aberto segura e volta só o aviso mais urgente), `placement.test.ts` (tamanho e origem da ferramenta, passos ortogonais, motivo do bloqueio, celeiro enchendo, lugar do marco e do estrago), `gestures.test.ts` (toque, arrasto, pinça e giro, mira acima do dedo, interface corta a rua; teclas), `preview.test.ts` (prévia da ferramenta como dado), `topbar.test.ts` (barra do topo como dado), `build.test.ts`, `card.test.ts`, `panels.test.ts` e `person.test.ts` (coluna de construções, balão, painéis e ficha da pessoa como dado) |
| `game/music.test.ts` | Música (puro): mesma semente e clima, mesma peça; toda nota no tom maior e na faixa da voz; 16 compassos, no máximo 10 vozes, nada passa do fim; final no acorde I e melodia na tônica; uma peça por estação (tom próprio, a primeira frase é o tema nota por nota em qualquer semente, quatro temas diferentes); piano sobre sintetizadores, acompanhamento por estação (arpejo na primavera depois da primeira frase e no verão, nada de arpejo nem tambor no inverno, acordes sustentados no inverno, colcheias na primavera, fundo mais escuro no outono e mais eco no inverno); tambor fora da primeira frase e do último compasso; notas do acorde nos tempos fortes; andamento por estação, noite mais baixa, lenta, esparsa e sem tambor, chuva mais baixa; 6–12 s de silêncio; volume alvo (desligada ou aba escondida = 0, curva crescente), − / + de 10%; padrão ligada a 50%, tecla M e avisos de mudança das configurações. Para ouvir: `node scripts/music-render.mjs [segundos]` grava `music-samples/<estação>.wav` (as quatro músicas) |
| `game/work.test.ts` | Trabalho na tela (Pacote B2): `jobText` (lavrador descansa no inverno, idoso descansa; a ficha diz "Sem trabalho: todas as vagas estão cheias"), "Mudar" na ficha (`jobChoices`: vagas livres da mais perto, "Sem trabalho"; criança sem botão), balão do local "Trabalhadores n/m" com os nomes ou "Ninguém trabalha aqui", aba Povo "Trabalho: x de y adultos · z sem vaga" e Agora com as vagas livres, avisos `unemployed` e `noCrew` (o celeiro não avisa), "Mercado vazio" pelo evento `serviceEmpty` e pelo `setJob` da sessão, toast ao construir sem ninguém livre |

### Utilitários (`tests/helpers.ts`)

- `emptyGame(overrides)` — jogo sem rochas/árvores, areia em tudo (exceto o rio), muita prata, madeira e pedra,
  sem a caravana (só o altar, sem pessoas nem caravanas futuras) e com 30 de comida, quase tudo
  liberado e no primeiro objetivo de moradores ≥ 100 (`QUIET_GOAL`, nenhum objetivo se cumpre por acaso). Altar 4 x 4 em x, y = 22..25, anel de rua em volta (contorno de x, y = 21..26) e
  rua inicial em x = 24, de y = 26 a 47. Construções ao lado da rua inicial ficam em y >= 27 para
  não cair no anel.
- `put(state, kind, x, y, level, rotated, people)` — coloca uma construção sem cobrar prata nem material e já no nível
  desejado; uma casa com nível ≥ 1 é enchida até a capacidade com casais adultos de 41 anos (`fill`),
  ou com `people` pessoas. `upWeeks` = `UP_WEEKS` (o mínimo de `weeksToUpgrade`). Depois de
  encher a casa chama `refreshCity`: os adultos novos pegam as vagas livres, como no jogo.
- `hire(state, building, n)` — dá `n` trabalhadores (por padrão as vagas do local) que não moram
  em casa nenhuma (`HIRED`: não comem nem pagam), para testes em que um mercado precisa cobrir ou
  um local precisa trabalhar sem tirar os adultos das casas.
- `person(state, { houseId, sex, age, caravan, fatherId, motherId })` — uma pessoa com aniversário
  nesta semana; `LIFE_YEAR` = semanas por ano de vida.
- `noColdDeaths()` — desliga as mortes de frio (B3) para testes de outra coisa no inverno; devolve a função que as religa.
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
Os testes desligam a entrada animada de balões, painéis e fichas (um script no início de cada página):
com quadros lentos, a foto pegava o balão ainda meio transparente.

O servidor roda sem recarga automática (`hmr: false`, sem vigiar arquivos): um arquivo editado por
outro agente durante a rodada não recarrega a página no meio de um cenário.

| Cenário | O que faz e verifica | Screenshots |
|---|---|---|
| `title` | tela inicial; a cidade abre atrás dela (o fundo clareia, a câmera gira, a interface do jogo fica escondida) e Enter volta à vista de abertura com a interface; depois de ver o tutorial, com "Rever o tutorial"; um `beforeinstallprompt` falso mostra "Instalar app" e o clique chama a instalação | `title`, `title-live`, `title-again`, `title-install` |
| `play3d`, `play3d-pc` | `?seed=7`: tela inicial em HTML (Começar ≥ 44 px, sem "Rever o tutorial" no primeiro jogo; toque ou Enter), o jogo em 3D (um canvas), interface no formato do aparelho e dentro da tela, tutorial aberto; Rua e arrasto (toque ou mouse) pela rua marcada constrói a rua; a engrenagem liga e desliga dia e noite (salvo) e fecha (Esc no PC) | `play3d-<phone/pc>`, `-title`, `-road`, `-settings` |
| `end3d`, `end3d-pc` | cartões de vitória e de derrota (abertos pelo `hud`): ramos dourados, 3 e 2 medalhas, cartão inteiro na tela | `end3d-<phone/pc>-victory`, `-defeat` |
| `input3d-pc` | 3D direto no PC: D move a câmera, Q gira um quarto de volta, a roda aproxima, o botão direito arrasta o mapa, 2 escolhe Rua, Esc volta para Mover, Espaço muda a velocidade | `input3d-pc` |
| `touch3d` | 3D direto no celular: um dedo com Mover move o mapa; com Rua, a pinça aproxima e não constrói; dois dedos girando giram o mapa sem construir | `touch3d` |
| `context3d-pc` | 3D no PC: pausado e parado desenha ~10 quadros por segundo e segura os quadros (`idle`); andando nunca segura (o teste olha o estado, não a contagem: o SwiftShader é lento demais para comparar quadros); a cidade volta inteira depois de perder e recuperar o contexto WebGL (`WEBGL_lose_context`) | `context3d-pc` |
| `town3d-pc` | 3D no PC: uma rua rica com casas de todos os níveis e quintais por variante, rua com borda de pedra onde passa muita gente, trilha onde passa pouca, celeiro cheio, mercado nível 3, uma construção de cada tipo de morador e gente nas casas: ≥ 12 moradores na rua com o que carregam, bichos/barcos/lavadeiras em volta, um clique num morador da rua abre a ficha com o nome dele, a oficina-ferraria (`CRAFTS=1` fotografa também os outros 4 ofícios) | `town3d-pc`, `-granary`, `-houses`, `-people`, `-person`, `-altar`, `-river`, `-plaza`, `-workshop` (`-workshop-2..5`) |
| `night3d-pc`, `night3d-phone` | 3D de noite e no frio (plano beleza E1–E3, Q1–Q6): rua com casas de todos os níveis, uma casa de pedra e uma grande vazias, dois campos e uma rua solta fora da rede. À noite as 4 casas .glb de pedra e grandes com gente têm os vidros acesos (2 cada), a casa de barro a porta (1) e as vazias nenhum; ≤ 120 chamadas; o fogo do altar em camadas; a rua solta tracejada (de perto e no zoom mínimo, de dia); no inverno todas as casas fumam e com `s.cold` nenhuma (só o altar e o forno) | `night3d-<pc/phone>-houses`, `-far`, `-altar`, `-loose-far`, `-loose`, `-winter`, `-cold`, `-cold-night` |
| `street3d-pc`, `street3d-phone` | Vida parada na rua (plano beleza C2): casas de todos os níveis com crianças e idosos, mercado nível 3 com equipe, uma oliveira, um casal noivo andando até um terreno e uma tenda abandonada. Vizinhos nas portas (≥ 12 planejados, ≥ 10 de dia); compradores no mercado; colhedores sob a oliveira no outono; roupa e toldos ao vento forte (dois quadros); os noivos lado a lado (0,05–0,3 de distância); a família da tenda andando até a entrada; menos gente à noite; nenhuma figura parada no zoom mínimo; ≤ 120 chamadas | `street3d-<pc/phone>-doors`, `-doors-other-side`, `-market`, `-olives`, `-wind-a`, `-wind-b`, `-couple`, `-leave`, `-night`, `-far` |
| `houses3d-pc`, `houses3d-phone` | Casas variadas (plano beleza C3): as 6 variantes de cada nível (tendas, casas de barro, de pedra e grandes), metade espelhada, com gente; ≤ 120 chamadas e ≤ 300 mil triângulos de longe; de noite; e uma rua de 10 casas de barro com as variantes sorteadas pelo core (`rollLook`): nenhuma vizinha repete a variante | `houses3d-<pc/phone>-tents`, `-mud`, `-stone`, `-big`, `-all`, `-night`, `-mud-row`, `-mud-row-street` |
| `ground3d-pc`, `ground3d-phone` | Chão e ruas (plano beleza C4): casas de pedra cheias pela rua do altar (lajes e meio-fio), uma rua lateral com duas casas de barro a 2 células uma da outra (borda escura, sulcos, trilha entre elas), um ramal com uma tenda (trilha), tufos na grama mais perto; detalhe visível de perto e escondido de longe; ≤ 120 chamadas e ≤ 300 mil triângulos | `ground3d-<pc/phone>-side-street`, `-trail`, `-flags`, `-path`, `-grass`, `-top`, `-side-street-summer`, `-town`, `-far` |
| `fields3d-pc` | Campos (plano beleza C6): as quatro culturas (trigo, cevada, lentilha, linho) num quadrado perto do rio e outro longe, de perto: fim do inverno (verdes), meio da primavera (maduros), e na seca os longe do rio baixos e cor de palha enquanto os da beira seguem dourados; ≤ 120 chamadas e ≤ 300 mil triângulos | `fields3d-pc-winter`, `-spring`, `-dry-near`, `-dry-far` |
| `trees3d-pc` | Árvores (plano beleza C6): um bosque de células de oliveira (oliveiras, amendoeiras e figueiras) com uma fileira de palmeiras, de perto: amendoeiras em flor no fim do inverno, tudo em folha no verão, figueiras amarelas e amendoeiras nuas no fim do outono, as duas nuas no inverno; ≤ 120 chamadas e ≤ 300 mil triângulos | `trees3d-pc-bloom`, `-summer`, `-autumn`, `-winter` |
| `sanctuary3d-pc` | O Templo por código (plano beleza C8): posto no lugar livre mais perto do altar; de perto pela frente e de lado, de noite e da vista de abertura; ≤ 120 chamadas | `sanctuary3d-pc-near`, `-side`, `-night`, `-far` |
| `crafts3d-pc` | Oficinas por ofício (plano beleza C8): as seis oficinas lado a lado (olaria, ferraria, carpintaria, tecelagem, tinturaria, curtume) de meia distância e de perto, de noite, os mercados dos níveis 1–3 e uma pedreira ligada com o estoque abaixo do limite (a poeira aparece); ≤ 120 chamadas | `crafts3d-pc-row`, `-near-a`, `-near-b`, `-night`, `-markets`, `-quarry` |
| `maquete3d-pc` | Acabamento de maquete (plano beleza C8): casas em volta do altar de dia, nublado e de noite (sombra de contato mais forte sem sol); o acabamento ligado na qualidade alta e desligado na mínima (`info().finish`) | `maquete3d-pc-day`, `-overcast`, `-night`, `-min` |
| `river3d-pc` | Rio (plano beleza C6): a beira mais perto do altar (até 22 células), com o detalhe do chão desenhado; juncos e pedras na linha da água de perto; fim da tarde olhando para o sol (faíscas nas ondas) e de costas para ele (sem brilho) | `river3d-pc-bank`, `-glint`, `-glint-away` |
| `tutorial3d-phone`, `tutorial3d-pc` | o tutorial inteiro no 3D com toques e cliques de verdade: a frase da caravana; relógio parado nos passos de construir; a seta no botão do passo (a coluna rola até ele no celular) e depois no lugar; a câmera leva cada lugar ao meio do mapa livre, acima do balão do tutorial (e do dedo no celular); arrasto da rua marcada; pescador/coletora, campo, praça ("Atende…"), casa nos terrenos verdes, casamento, lenhador ("Rende… madeira", "Corta 1 árvore…", Rua primeiro quando o bosque está longe), o toast final e o passo do mercado; o balão da construção escolhida fica acima do balão do tutorial | `tutorial3d-*-1-road` … `-8-market`, `-4-scaffold` (andaime da praça nova) |
| `temple3d-phone`, `temple3d-pc` | o Templo em 3D (mapa da semente 5): áreas verdes e amarelas (no máximo 6), pílula "+10 de Alegria em N casas / Cabe aqui: falta ligar à rua" e "Falta prata: custa 800"; sem área perto das ruas, o lugar mais perto com a rua dourada, e a câmera vai até ele (no mapa livre) | `temple3d-*-areas`, `-far` |
| `ui3d-phone`, `ui3d-pc` | interface completa em 3D: balão da casa de barro com 4 pessoas (2 colunas no celular, 1 no PC, linhas ≥ 44 px, dentro da área livre, com seta para a casa), ficha da pessoa e de um parente com Voltar, Esc fecha; Objetivos, Avisos e Estatísticas (Agora, Povo, Histórico; uma família do Povo abre a casa); balão da construção escolhida (Praça, custo em prata) com três toasts ao mesmo tempo (2 no celular, da metade da tela para baixo; 3 no PC; nenhum sobre esse balão); pílula da prévia (Coletora sem rua em vermelho, "Rende…" ao lado da rua, "Cortar árvore" com Demolir); balão de problema "sem rua" sobre a construção e tom de fome; de longe os balões de problema ficam menores (60–75%). Nenhum texto < 12 px; a ficha e os painéis não cobrem barra, lateral, ferramentas nem coluna (`VISUAL_TIMING=1` mostra o tempo de cada etapa) | `ui3d-*-house`, `-sheet`, `-pill`, `-haulers` (um carregador sai do campo), `-goals`, `-alerts`, `-stats-*`, `-tool`, `-problems` |
| `music3d-phone`, `music3d-pc` | a música pelo `window.music.state()` (não se ouve): sem áudio antes do primeiro gesto, tocando depois; na engrenagem + sobe o volume, − desce, desligar zera, e desligado e volume ficam salvos; no PC a tecla M religa; aba escondida suspende o áudio; sem erros na página | `music3d-<phone/pc>-settings` |
| `hud3d-phone`, `hud3d-wide`, `hud3d-small-phone`, `hud3d-pc` | interface 3D em quatro telas (844x390, 915x412, 667x375, 1366x768), com o tutorial e um aviso, depois o balão do altar, depois a engrenagem: nenhum texto < 12 px, nenhum botão < 44 px no celular, tudo na tela e nada por cima de outro grupo (barra do topo, giros, ferramentas, coluna, avisos, tutorial, seta, balão; só o menu da engrenagem pode cobrir a coluna e um aviso pode passar sobre o balão) | `hud3d-*`, `-balloon`, `-settings` |

### Ganchos de desenvolvimento

Só no modo dev (`npm run dev`, e é o que o script usa), o jogo expõe no `window`:

- `?seed=N` na URL fixa o mapa (rio, bosque e caravana); sem ela, cada partida nova sorteia um mapa.
- `window.session` — a `Session` (`src/game/session.ts`): `setSpeed(n)`, `selectTool(t)`, `say(...)`,
  `city` (leituras do core) e o resto do controle do jogo;
- `window.state` — o `GameState` atual;
- `window.core` — todas as funções do core (`core.place`, `core.clearCell`, `core.stepWeek`...);
- `window.view3d` — o jogo em 3D: `game` (o `Play3D`, com `scene` e `hud`), `ready` (o pacote de
  modelos chegou, falhou ou não foi pedido: os testes esperam por ele), `frames` (quadros já
  desenhados), `fps()`, `info()` (qualidade, chamadas da cena — o passe de acabamento soma uma, fora da conta —, `finish` ligado ou não, triângulos, moradores, figuras paradas `idle`/`idlePlanned`, famílias indo embora `leaving`, rótulo, giro e foco),
  `cellPoint(x, y)` (ponto da tela do centro de uma célula), `cellAt(sx, sy)`, `rig` (câmera:
  `rig.set({ yaw, pitch, dist, x, z })`, `heading`, `zoom`, `distance`, `focus`),
  `quality('high'|'low'|'min')` e `view({ pos, day, weather, force } | null)`: mostra outra semana
  (`pos`, semana com fração), hora (`day`, 0..1, 0 = amanhecer) e clima, e força neve/seca, só no
  desenho (o estado não muda).
- Os elementos da interface HTML têm `data-spot="<nome>"` (ex.: `start`, `settings`, `set-daynight`,
  `panel-close`): os cenários tocam e clicam por eles.

Use-os para montar situações rapidamente em vez de jogar até lá. Se mudar conexões à mão (ruas,
construções), prefira `core.place`/`core.clearCell`, que já recalculam a rede, ou chame
`core.refreshCity(state)`.

### Escrever um cenário novo

Adicione uma entrada em `scenarios` no `run.mjs`, na forma `{ context: PHONE | PC, run(page) {...} }`:

```js
'meu-cenario-pc': { context: PC, async run(page) {
  await open3dGame(page);             // semente 7, tela inicial passada, tutorial visto, pausado
  const p = await page.evaluate(() => window.view3d.cellPoint(20, 16));
  await page.mouse.click(p.x, p.y);   // tocar/clicar no centro de uma célula
  assert(await page.evaluate(() => window.state.roads.length) > 0, 'mensagem clara');
  await shot(page, 'meu-cenario-pc'); // screenshots/meu-cenario-pc.png
} },
```

- `open3dGame(page, semente)` abre o jogo, passa da tela inicial com Enter e espera `view3d.ready`.
- `setupPeople(page)` monta a cidade pausada do pacote Povo (pessoas com nome) e devolve os ids.
- No celular, `cdpTapPage(page, x, y)` dá um toque real pelo protocolo do Chrome; os cenários
  `touch3d` e `tutorial3d-phone` mostram arrasto, pinça e giro com dois dedos.
- O navegador sem placa de vídeo é lento: prefira `page.waitForFunction(...)` esperando um estado
  do jogo (ou `view3d.frames` subir) em vez de tempos fixos longos.

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
internet e não há erro na página. Também abre o jogo 3D com internet e de novo sem internet, e
confere que os modelos .glb estão no cache. Rode depois de `npm run build`. Os arquivos sem hash
(página, modelos, ícones) vêm da rede primeiro, então um modelo novo chega sozinho; suba `VERSION`
em `public/sw.js` só para apagar caches velhos.

Os ícones em `public/icons/` são gerados pelo próprio jogo (o templo sobre o céu):
`node tools/icons/make-icons.mjs` regera todos.

## Desempenho da visão 3D (`scripts/view3d-perf.mjs`)

`node scripts/view3d-perf.mjs` mede os quadros por segundo do jogo 3D num celular simulado
(844 x 390, deviceScaleFactor 2,6, toque, CPU 4x mais lenta) numa cidade de ~45 construções, de dia,
à noite e na chuva, com qualidade automática, e depois uma rua arrastada pela cidade (uma célula a cada
60 ms): a reconstrução mais lenta (`rebuildMaxMs`) e os quadros acima de 50 ms; usa a GPU do WSL quando existe (`--soft`: SwiftShader,
pessimista). Capturas em `screenshots/view3d-perf` (`VIEW3D_OUT` muda a pasta; `VISUAL_PORT` a porta).

## Testar no celular de verdade

`npm run dev` e abra no celular o endereço "Network" que o Vite mostra (mesma rede Wi-Fi). O
teste visual de toque cobre os gestos, mas tamanho de texto e conforto dos botões só se avaliam
no aparelho.

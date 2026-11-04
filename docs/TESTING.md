# Como testar

Dois níveis de teste: **unitários** (regras do jogo, rápidos, obrigatórios) e **visuais**
(o jogo de verdade num navegador, com screenshots).

```bash
npm test                        # testes unitários (Vitest), ~1 s
npm run test:visual             # testes visuais (Playwright), ~1 min
npm run test:visual -- touch    # só os cenários cujo nome contém "touch"
npx tsc --noEmit                # typecheck
npm run build && npm run test:pwa  # o build é um app instalável e abre sem internet
```

Antes de dar uma tarefa por concluída: `npm test`, `npx tsc --noEmit` e `npm run test:visual`
precisam passar, e as screenshots afetadas pela mudança devem ser **olhadas**.

## Testes unitários (`tests/`)

Cobrem só `src/core` (TypeScript puro, sem Phaser). **Toda regra nova ou alterada precisa de teste.**

| Arquivo | O que cobre |
|---|---|
| `map.test.ts` | mapa 48 x 48 e mesma semente = mesmo terreno; em 100 sementes: contagens de rochas e árvores nas faixas, rio contínuo de 3–4 células a 8–18 do altar, bosque denso (18+ árvores em 7 x 7) a 11–20 do altar, nada sobre área livre ou rio, rua inicial livre, tendas dentro do raio livre, 3+ lugares para o Templo a até 12 do altar; árvores agrupadas; variação do rio e do bosque entre sementes; área livre do altar e da faixa da rua, estado inicial (altar, rua, entrada, prata, liberações), anel de rua em volta do altar (20 células livres, ligadas e alcançáveis da entrada, sem custo) |
| `network.test.ts` | rede de ruas ligada a qualquer lado do altar 4 x 4, caminhos que não atravessam o altar, desconexão ao demolir, custo e validação de rua, caminhos por busca em largura, máscara de junções (anel, cantos e T com a rua sul; o altar não conta), exigência de rua para cada tipo de construção |
| `coverage.test.ts` | números da Praça e do Parque (raio 4, categoria casa; sem `well` nem `garden`), cada um cobre só o seu serviço, raio quadrado a partir de qualquer célula, sem cobertura quando desconectado, área sagrada do altar 4 x 4, raio do templo 6 x 6, áreas não quadradas |
| `economy.test.ts` | eficiência, construções desconectadas não dão comida nem contam vagas, vagas do templo, manutenção (inclusive de desconectadas; rua, casa e altar grátis; só cobrada depois do Objetivo 4, com o evento `upkeepStart` uma vez), saldo exibido = impostos − manutenção (nenhuma construção dá prata; sem `production` nem `silver`; oficina com trabalhadores não muda a prata), maior custo, consumo de comida por nível e no inverno (× `foodFactor`, tenda × `tentFoodFactor`), campo com 468 de colheita e sem `food`, bônus das oficinas nos campos (0,1/0,2/0,3, teto na 4ª, desligada não conta, pescador e coletora sem bônus), pessoas sem trabalho pelas vagas do ano (`yearJobs`: desemprego, alegria e imposto iguais no outono e no inverno) e limite do aviso de desemprego (só com a Oficina liberada) |
| `actions.test.ts` | custos e locais inválidos, tamanhos das construções, mercado girado, posicionamento do templo (6 x 6, bloqueios, exige rua, lista de posições possíveis), lugares de casa encostados na rede (`placeSpots`, tutorial), limpar, proteção do altar e do templo |
| `houses.test.ts` | evolução em `weeksToUpgrade` e regressão em `weeksToDowngrade` (rua, praça, mercado, parque; barro só com praça, pedra com praça + mercado, casa grande só com parque: o raio do altar e o do templo não bastam; casa grande que perde o parque cai), fome pausa a subida sem zerar, perder uma necessidade zera, `weeksToNextLevel` (contagem, congela na fome, null no topo ou sem necessidade), atendimento por qualquer célula da casa, fome (casas caem; tendas abandonadas com `famineLeaveChance` e evento de família saindo; sem fome nunca), informações e balões (incluindo "sem trabalhadores"; a informação da casa lista a necessidade trancada; o balão com a necessidade trancada do plano P2 2.6 está em `it.skip` até `needVisible` mudar) |
| `families.test.ts` | chegada de famílias (da entrada até virar tenda), no máximo uma a cada `familyIntervalWeeks` (limite exato), chance × fator da alegria, porta das famílias (`familyBlock`: fome, comida até a primavera sem cair abaixo de `familyFoodReserveWeeks` semanas, com as casas no nível planejado, cada família a caminho e a nova como tenda, `storage` quando só o estoque corta, espera, sem terreno; nessa ordem; a mesma resposta no meio do passo e depois dele), cidade vazia nunca trava (sem moradores nem família a caminho, a comida não fecha; o intervalo continua), casa sem praça e cidade sem praça nenhuma recebem família, tendas da caravana sem praça só param pela comida, a porta nunca responde `water` (5 sementes × 80 semanas), terreno com família a caminho, desconexão e demolição, desvio de rota, saída pelo altar |
| `happiness.test.ts` | felicidade desligada antes do Parque (liga com o Objetivo 5) (contente, sem motivos, imposto e famílias iguais aos de uma cidade sem felicidade); felicidade da casa (base, cada fonte sozinha: praça +5, parque +20, altar +10, templo como o altar; parque só conectado e no raio, mercado, fome, desemprego com teto, limites 0–100), três humores, fator do imposto e das famílias (1 enquanto contente, extremos), imposto da casa feliz e triste, média da cidade (50 sem famílias), parte sem vaga, famílias mais rápidas na cidade feliz, contagem por humor, informação da casa com felicidade e imposto real, balão de casa triste |
| `debt.test.ts` | manutenção levando a prata abaixo de 0, construir e cortar bloqueados em dívida (demolir não; prata 0 não é dívida), contagem da dívida (início, zera com prata ≥ 0, recomeça), derrota exatamente no mês 24 e simulação parada depois, maior população, ordem dos avisos (dívida, saldo negativo com maior custo, desemprego) |
| `goals.test.ts` | os 10 objetivos (tipos, alvos, prêmios, liberações; um só de vitória), `unlockingGoal` (celeiro 1, mercado 3, oficina 4, parque 5, templo 8), Praça liberada no início e Objetivo 5 liberando o Parque (evento e `unlocked`), Objetivo 1 pela previsão (com pescador) e alvo que encolhe, `upkeepStart` depois do Objetivo 4, Templo liberado no Objetivo 8, `fromYear` segura o Objetivo 9 até a 1ª semana do Ano 8 (também em `stepWeek`), nenhum objetivo `water` nos dados, casas de barro, moradores, casas grandes só conectadas, vitória com o templo, um objetivo por verificação |
| `simulation.test.ts` | comida, prata, semana, fome (termina com a colheita da primavera), nenhuma prata de produção e relógio (1 semana a cada `weekSeconds` em 1x) |
| `seasons.test.ts` | 13 semanas por estação começando no outono, ordem das estações, primeira semana de cada estação, um evento `season` só quando a estação muda, `seasonCount`/`START_SEASON`, ano agrícola do outono ao verão no `calendar`, jogo novo na semana 1 do outono do Ano 1 |
| `tutorial.test.ts` | os 6 passos com a comida primeiro (rua, pescador ou coletora, campo, praça, casa, família) e os mini passos, relógio parado nos passos de construir e andando na família (`tutorialHoldsClock`), `markTutorial` (ruas, casas e o caminho sugerido), condição de cada passo (rua marcada pronta ou o mesmo número de ruas novas na rede, casa nova ligada sem contar a caravana, pescador/coletora ligado, marco da primeira família — também numa chegada real —, campo, praça, mercado; o do saldo só por toque), `plazaHouseSpots`/`houseHint`, `foodSpot`/`ghostRoad` (em 200 sementes o lugar rende ≥ 1,2/sem e, construído como indicado, fica ligado e rende o prometido; caminho contínuo da rede até o lado da construção; prefere o que rende mais e depois a rua mais curta; nulo sem lugar que renda o bastante; contorna uma construção no caminho), casas atendidas por um serviço ("Atende N casas") |
| `forecast.test.ts` | nível alvo de uma casa (`targetLevel`), `plannedEating` com no máximo +1 nível e o consumo de inverno, previsão que atravessa o inverno, `reserveWeeks`, bônus das oficinas na previsão, uma praça nova muda a previsão na hora, o raio do altar não sobe a casa a grande (só o parque), tendas extras (famílias a caminho), Objetivo 1 não se cumpre na semana 1 com uma caravana que vai passar fome, `lastsToHarvest` igual a `foodLastsToHarvest`, previsão e `stepWeek` dão a mesma semana de fome em combinações semeadas, `nextFieldTurn` (inverno em N sem fora do inverno, primavera em N sem no inverno) |
| `readouts.test.ts` | nível da cidade e progresso do objetivo, calendário, saldo depois de construir, casas atendidas, ganho ao evoluir (com o que a casa passa a comer), lugares que atendem uma construção, casas por nível, comida feita e comida, `foodAfter` (um local de trabalho que tira o único trabalhador baixa a comida; o campo rende a colheita × a eficiência com as vagas dele; num lugar sem rua não rende nem ocupa vagas; no inverno o campo não rende) |
| `viability.test.ts` | **viabilidade do Ano 1**: um plano mínimo (rua até a melhor comida, pescador ou coletora, campo, praça para as tendas, celeiro quando liberado, mais comida quando a previsão não chega à primavera, terreno perto de praça quando uma família pode vir) em 20 sementes: sem fome antes da semana 26, objetivo 1 no primeiro outono e objetivos 1 e 2 no Ano 1, prata nunca negativa; invariantes: a prata inicial paga o kit mínimo, e 1 campo com o estoque base alimenta a caravana até a primavera (cai se `harvest` virar 50 ou o estoque base virar 10) |
| `survival.test.ts` | caravana por semente (2–4 tendas num bloco 2 x 2 dos dois lados da rua do acampamento ao norte do anel; em 500 sementes `campPlazaSpot` é livre, ligável e atende todas; comida de 14–22 semanas cortada em 50, semanas anunciadas reais, prata inicial), colheita só na primavera (`harvestsIn`, `firstHarvestWeek`, campo feito no inverno colhe no ano seguinte, última semana do outono ainda semeia, desconectado não colhe, eficiência, evento `harvestStart` com o total, marco `firstHarvest`), `weeksToHarvest`, consumo semanal, estoque com e sem celeiro (desligado não guarda), estrago (`spoilStart` uma vez, limite exato não estraga, perder o celeiro), previsão (semanas e estação, colheita e limite, seca anunciada, horizonte, primavera conta até o ano seguinte), inverno (tendas saem com 35%, casa de barro protege, `winterLoss`), seca (× 0,4, campo no rio protegido, nunca no Ano 1 nem 2 seguidas, chance, aviso do inverno à primavera), avisos novos e sua ordem (comida curta em qualquer estação; estoque cheio com o tamanho e o objetivo do celeiro enquanto bloqueado), marcos uma vez só (caravana não conta), histórico com `capacity`, objetivo `foodUntilSpring` com `goalTarget`, campo dá comida na primavera, verão e outono e congela no inverno (sem comida nem vagas; pescador a 100%; manutenção mantida; previsão com a eficiência de cada semana) |
| `gather.test.ts` | Pescador e Coletora: dados, células de rio/árvore no raio (contadas à parte), 0,75 e 0,3 por célula com teto 4,5, mais longe rende menos, cortar árvore baixa, dois no mesmo recurso, desligado não rende, o ano todo com a eficiência, balões "sem fonte", "sem rua" e "sem trabalhadores" |
| `looks.test.ts` | aparência das casas: semente determinística, variante dentro do número do nível, espelhamento, vizinhas do mesmo nível com variantes diferentes, novo sorteio ao mudar de nível; plantação do campo diferente da do campo vizinho; construções de uma só aparência ficam na variante 0; ofício da oficina (sorteio determinístico, vizinhas diferentes, guardado na variante) |
| `rng.test.ts` | gerador semeado: mesma semente, mesma sequência; `shuffle` |
| `walkers.test.ts` | tipos de morador: só aparecem quando a construção existe e está ligada, destino pelo tipo (aguadeira na praça ou no mercado, cada um sozinho e os dois por semente; campo, mercado, oficina, altar/templo, ruas principais, borda), carregador campo → mercado e volta, destino aleatório de reserva, destino do artesão aponta a oficina e o ofício |

### Utilitários (`tests/helpers.ts`)

- `emptyGame(overrides)` — jogo sem rochas/árvores, areia em tudo (exceto o rio), muita prata,
  sem a caravana (só o altar) e com 30 de comida, quase tudo liberado e com a manutenção já cobrada
  (`goalIndex` = `upkeepStartsAfterGoal`, então a manutenção é cobrada). Altar 4 x 4 em x, y = 22..25, anel de rua em volta (contorno de x, y = 21..26) e
  rua inicial em x = 24, de y = 26 a 47. Construções ao lado da rua inicial ficam em y >= 27 para
  não cair no anel.
- `put(state, kind, x, y, level, rotated)` — coloca uma construção sem cobrar e já no nível desejado.
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

| Cenário | O que faz e verifica | Screenshots |
|---|---|---|
| `title` | tela inicial; depois de ver o tutorial, com "Rever o tutorial"; um `beforeinstallprompt` falso mostra "Instalar app" e o clique chama a instalação | `title`, `title-again`, `title-install` |
| `tutorial` | celular 844 x 390, primeira partida: frase da caravana; o relógio fica parado no passo de construir mesmo em 3x; ferramentas nunca travam (a tecla 2 e a Praça também funcionam no passo da rua); em cada passo a câmera desliza até o lugar (rua marcada, lugar de comida, `fieldHint`, `campPlazaSpot`, casa) e o deixa no mapa livre: fora da interface, do balão do tutorial e dos toasts (no celular também o ponto do dedo, 90 px abaixo); o toast da caravana não cobre a rua marcada; os 6 passos (rua pelo caminho fantasma até o lugar de comida, arrastada com o dedo; pescador ou coletora no lugar escolhido, com "Rende N comida/sem"; campo; praça no `campPlazaSpot`, livre e atendendo as tendas, com "Atende N casas"; casa; família com a câmera seguindo), a coluna abre a categoria e depois escolhe; antes da família, `openFamilyDoor` (celeiros e comida) abre a porta; o último toast pede "Construa mais casas"; depois o saldo no Objetivo 3 ("Entendi") e o mercado; tutorial gravado como feito | `tutorial-caravan`, `tutorial-step-1`, `tutorial-step-2`, `tutorial-step-2-preview`, `tutorial-step-3`, `tutorial-plaza`, `tutorial-step-5`, `tutorial-step-6`, `tutorial-saldo`, `tutorial-market` |
| `tutorial-pc` | o mesmo no PC 1366 x 768, com o mouse | as mesmas, com `-pc` no fim |
| `tutorial-blocked` | PC: no passo da família com as famílias bloqueadas (estoque vazio, motivo `food`), `familyBlock` dá o motivo no balão, o relógio anda e nenhum toast "Nenhuma família vem" aparece | `tutorial-family-blocked` |
| `p2-ui` / `p2-ui-pc` | celular 844 x 390 e PC 1366 x 768, pausado: praça no `campPlazaSpot` e as tendas dela viram casas de barro; o balão da casa no mapa mostra o mercado com cadeado; tocada, "✗ Mercado (libera no objetivo 3)" e nenhuma ação "Onde pôr"; com o balão aberto os toasts esperam, e um aviso que deixou de valer é descartado ao fechar; Demolir mirando um celeiro cheio diz "Perde N de comida", e o balão do celeiro também; a faixa Moradia com Casa, Praça e Parque; o Parque escolhido com o balão | `balloon-locked`, `balloon-locked-house`, `toast-inspector`, `toast-inspector-closed`, `demolish-granary`, `demolish-granary-balloon`, `column-home`, `column-park` (com `-pc` no PC) |
| `drag-release-on-button` | celular: uma rua arrastada do mapa que termina sobre "Pular tutorial" não pula o tutorial, e sobre a velocidade não a muda (botões só disparam com o toque que começou neles) | `drag-release-on-button` |
| `drag-release-on-button-pc` | o mesmo no PC 1366 x 768, com o mouse | `drag-release-on-button-pc` |
| `preview-food-after` | celular: rua até o lugar de comida e prévia do pescador ou coletora com "Rende N comida/sem" e "Comida depois"; depois o balão do Mercado com mais vagas que trabalhadores | `preview-food-after`, `preview-food-after-market` |
| `preview-food-after-pc` | o mesmo no PC; o balão do Mercado diz "Comida depois" | as mesmas, com `-pc` no fim |
| `harvest-countdown` | celular: pílula da estação com "inverno em N sem" no outono e "primavera em N sem" no inverno, cabendo na tela; na fome a pílula de comida diz "FOME" | `harvest-countdown-autumn`, `harvest-countdown-winter` |
| `harvest-countdown-pc` | o mesmo no PC 1366 x 768 | as mesmas, com `-pc` no fim |
| `toast-panel` | com as Estatísticas abertas, um toast novo espera; ao fechar, ele aparece | `toast-panel-open`, `toast-panel-closed` |
| `tutorial-skip` | "Pular tutorial" encerra e fica gravado; a tecla 2 escolhe Rua; com o `localStorage` bloqueado o tutorial roda e pular funciona sem erro | — |
| `options` | a engrenagem abre as Configurações; um clique no título do painel não muda a ferramenta nem seleciona nada, e o painel continua aberto | `options` |
| `build-with-mouse` | começa com o altar e as tendas da caravana; rua e casas arrastando (teclas 2 e 3), praça e campo clicando (3 de novo passa para a Praça; a tecla 4 escolhe o Campo); conta ruas e construções | `build-with-mouse` |
| `families-arrive` | terrenos ao lado da rua, `openFamilyDoor`, 3x; espera família andando e o marco "Primeira família" | `families-walking`, `families-arrived` |
| `happiness` | pausado, cidade de `buildTown` com parque e comida: a carinha da pílula Alegria segue o humor; tocar nela abre as Estatísticas; casa ao lado do parque (balão com os motivos); fome deixa a carinha triste e põe balões tristes; prévia do Parque com raio | `happiness-breakdown`, `happiness-house`, `happiness-sad`, `overlay-park` |
| `ambient` | cidade de `buildTown` de manhã: galinhas, jumentos, pombas, barcos, lavadeiras, ovelhas e varais existem, nenhum bicho com textura faltando (`__MISSING`); zoom no rio perto do primeiro barco | `ambient-town`, `ambient-river` |
| `seasons` | PC, cidade de `buildTown` pausada com bosques em volta: as 4 estações (o ano começa no outono; ícone certo na pílula da estação, sem ícone de seca, trigo dourado na colheita da primavera, fumaça e árvores peladas no inverno, catadores no outono), com e sem a interface; amendoeiras floridas no fim do inverno; chuva fraca, média e forte (mais gotas a cada nível, poças nas ruas); inverno com neve (telhados com neve); seca no verão (rio com lama, cada campo com sua fase, ícone de seca na pílula da estação e recorte dela; de longe, no zoom mínimo, sobre o rio); toast da primavera ao chegar a semana 1 dela, e o aviso de seca sumiu | `seasons-spring`, `seasons-summer`, `seasons-autumn`, `seasons-winter` (e cada uma com `-noui`), `seasons-almond`, `weather-rain-light`, `weather-rain-medium`, `weather-rain-heavy`, `weather-snow`, `seasons-drought`, `seasons-drought-icon`, `seasons-drought-noui`, `seasons-drought-zoom`, `seasons-toast` |
| `seasons-phone` | o mesmo no celular deitado 844 x 390 | as mesmas, com `-phone` no fim |
| `town-art` | monta uma cidade com todos os níveis e prédios (inclui praça e parque); templo conectado; prévias (a Casa mostra o raio das praças) | `town-art`, `overlay-temple-preview`, `overlay-house-plaza-area` |
| `day-night` | PC: cidade de `buildTown` pausada em manhã, tarde dourada, pôr do sol e noite (metade dos moradores e luzes acesas à noite); Configurações (engrenagem) e ciclo desligado pela opção Dia e noite (sempre dia) | `day-night-morning`, `day-night-golden`, `day-night-sunset`, `day-night-night`, `day-night-options`, `day-night-off` |
| `scaffold-roads` | ruas com passos de moradores (uma gasta, uma calçada, uma comum); oficina nova com andaime que some depois | `roads-wear`, `scaffold`, `scaffold-done` |
| `field-work` | pausado: 8 campos ligados (4 plantações, normal e espelhado) e 1 sem rua; 2 agricultores por campo com eficiência 100%, nenhum no campo sem rua; zoom máximo (dois momentos do trabalho) e mínimo; mapa girado com 1 agricultor por campo quando só parte das vagas está ocupada | `field-work-zoom-max`, `field-work-zoom-max-later`, `field-work-zoom-min`, `field-work-turned` |
| `camera-wheel` | zoom com a roda dentro dos limites | `camera-zoom-in`, `camera-zoom-out` |
| `touch` | celular deitado com toque real: toque no botão Rua de baixo; um dedo constrói rua sem mover a câmera; pinça dá zoom sem construir | `touch-title`, `touch-after-pinch` |
| `input-phone` | celular deitado 844 x 390 (jogo 1280 x 591), pausado com avisos de saldo negativo e desemprego: a coluna abre Moradia e escolhe a Praça; prévia mirada acima do dedo; deslizar até a coluna e soltar cancela; sem prévia nem construção quando o ponto mirado cai sob a pílula do objetivo; com Demolir, um toque na fresta entre Avisos e Estatísticas conta como interface e não demole nada; um Esc volta de Demolir para Mover | `input-phone-preview`, `input-phone-clear` |
| `nova-small-phone` | o `nova-phone` no celular 800 x 360 (o menor): tudo com 44 px e dentro da tela | as do `nova-phone`, com `small-phone` |
| `input-pc` | PC 1366 x 768 (jogo 1280 x 720), mesma cidade: tecla 5 escolhe o Mercado e a prévia segue o mouse; botões 3x e pausa; arrastar rua começando na pílula da comida não constrói; clique na prata abre as Estatísticas e no objetivo abre os Objetivos | `input-pc`, `input-pc-stats`, `input-pc-goals` |
| `clarity` | pausado: rua arrastada longe da rede (apagada, tracejada, aviso); campo sem moradores com balão "sem trabalhadores"; fome; posições do templo; mapa sem espaço para o templo | `clarity-loose-road`, `clarity-famine`, `overlay-temple-spots`, `temple-no-spot` |
| `turn-map` | mercado, casa e praça; abre as Configurações e clica ↻ (não constrói nada), arrasta rua no mapa girado e confere as células; E/E e Q | `turn-0`, `turn-1`, `turn-3`, `turn-2` |
| `debt` | pausado em dívida com fome: prata vermelha piscando, toast ao tentar construir, família saindo a pé; toque na prata abre as Estatísticas; painel de Avisos; a 1x chega à derrota (com anos e semanas); "Tentar de novo" começa um mapa novo | `debt-alerts`, `debt-silver-info`, `debt-alerts-panel`, `defeat`, `defeat-retry` |
| `victory` | constrói o templo e espera a vitória | `temple-celebration`, `victory` |
| `nova-phone` | celular 844 x 390: todo botão redondo (nível, engrenagem, velocidade, Objetivos, Avisos, Estatísticas, Mover, Rua, Demolir e as 4 categorias da coluna) ≥ 44 px reais e dentro da altura da tela; nenhuma parte do topo encosta em outra; Mercado escolhido (categoria, depois a construção) com o balão à esquerda da coluna; o balão da Casa fica abaixo da estação, da velocidade e da engrenagem; nenhum texto < 12 px reais; Parque bloqueado não é escolhido ("Libera no objetivo N"); casa de barro tocada com o balão e a ação principal; histórico e 2 marcos falsos com o toast do marco; Avisos, Objetivos, Estatísticas (abas Agora e Histórico) e Configurações abrem sem cobrir Mover, Rua e Demolir e fecham com Esc; uma rajada de 5 toasts não perde nenhum (no máximo 3 na tela, o resto em fila) | `nova-phone`, `nova-phone-chosen`, `nova-phone-locked`, `nova-phone-house`, `nova-phone-spots`, `nova-phone-milestone`, `nova-phone-alerts`, `nova-phone-goals`, `nova-phone-stats`, `nova-phone-history`, `nova-phone-settings`, `nova-phone-toasts` |
| `nova-phone-wide` | o mesmo no celular 915 x 412 | as mesmas, com `phone-wide` |
| `nova-pc` | o mesmo no PC 1366 x 768 (com mouse; coluna com nome, preço e tecla; pílula da Alegria e a previsão da comida por extenso) | as mesmas, com `pc` |

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
  de `level`, `gear`, `speed-0|1|3` (no celular os três dão o mesmo botão), `side-goals|alerts|stats`,
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
- `openFamilyDoor(page)` abre a porta das famílias (celeiros e comida até a colheita), para cenários
  que esperam famílias chegando.
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
```

`--set tabela.caminho=json` muda números **só na memória** (tabelas `buildings`, `goals`,
`houses` e `rules`), para medir propostas sem editar `src/data`. `--drop-goal N` tira a meta N
(contando de 1); o que ela liberava passa para a meta anterior.

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
- **distraido** — só percebe a comida na fome, fica parado 30% das vezes, lugares quase ao acaso.

Medidas por partida: sobreviveu ao Ano 1, a cidade esvaziou, perdeu por dívida, venceu (e em
quantas semanas e minutos a 1x), moradores nas semanas 52 e 104 e o pico, semanas de fome no Ano 1
e no total, maior sequência de fome, tendas abandonadas (e no primeiro inverno), semana do
primeiro campo, da primeira colheita e do primeiro celeiro, comida feita por campo, pescador e
coletora e o quanto estragou, motivos da porta das famílias fechada (Ano 1 e total), anos secos,
semana de cada objetivo, construções feitas. Do Pacote Ritmo: casas com família na semana 52,
invernos com fome, crises (moradores 25% abaixo do pico ou 4+ semanas seguidas de fome) e
recuperações (volta ao pico de antes), maior número de oficinas ao mesmo tempo, maior sequência
com mais de 300 de prata antes de o Templo ser liberado, moradores no fim de cada ano, motivos da
porta por ano e casas por nível no fim. A linha `--brief` resume os critérios do pacote.

Os jogadores seguem o que a tela mostra: o desemprego conta as vagas do ano todo (como o
aviso), a oficina só é construída por desemprego enquanto o bônus dos campos não chegou ao teto, e
nenhum jogador guarda mais que meio ano de comida (acima disso aceita o estrago).

## App instalável (`scripts/pwa-check.mjs`)

`npm run test:pwa` serve o `dist/` com `vite preview` e confere no Chromium: o Chrome considera o
app instalável (sem erros de manifesto), o service worker controla a página, o jogo recarrega sem
internet e não há erro na página. Rode depois de `npm run build`; ao mudar arquivos em `public/`,
suba `VERSION` em `public/sw.js` para os celulares baixarem a versão nova.

Os ícones em `public/icons/` são gerados pelo próprio jogo (o templo sobre o céu):
`node tools/icons/make-icons.mjs` regera todos.

## Testar no celular de verdade

`npm run dev` e abra no celular o endereço "Network" que o Vite mostra (mesma rede Wi-Fi). O
teste visual de toque cobre os gestos, mas tamanho de texto e conforto dos botões só se avaliam
no aparelho.

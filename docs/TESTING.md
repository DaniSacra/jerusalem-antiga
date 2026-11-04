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
| `coverage.test.ts` | raio quadrado a partir de qualquer célula, sem cobertura quando desconectado, área sagrada do altar 4 x 4, raio do templo 6 x 6, áreas não quadradas |
| `economy.test.ts` | eficiência, produção, construções desconectadas não produzem nem contam vagas, vagas do templo, manutenção (inclusive de desconectadas; rua, casa e altar grátis; só cobrada depois do Objetivo 3, com o evento `upkeepStart` uma vez), saldo exibido = impostos + oficinas + campos − manutenção, maior custo, consumo de comida por nível, campo com 468 de colheita e sem `food`, pessoas sem trabalho e limite do aviso de desemprego (só com a Oficina liberada) |
| `actions.test.ts` | custos e locais inválidos, tamanhos das construções, mercado girado, posicionamento do templo (6 x 6, bloqueios, exige rua, lista de posições possíveis), lugares de casa encostados na rede (`placeSpots`, tutorial), limpar, proteção do altar e do templo |
| `houses.test.ts` | evolução e regressão (rua, poço, mercado, altar ou templo), atendimento por qualquer célula da casa, fome (casas caem; tendas abandonadas com `famineLeaveChance` e evento de família saindo; sem fome nunca), informações e balões (incluindo "sem trabalhadores") |
| `families.test.ts` | chegada de famílias (da entrada até virar tenda), no máximo uma a cada `familyIntervalWeeks` (limite exato), chance × fator da alegria, porta das famílias (`familyBlock`: fome, água — toda casa ligada, terrenos inclusive; casa desligada não conta —, comida até a colheita, espera, sem terreno; nessa ordem), tendas da caravana sem poço fecham a porta, terreno com família a caminho, desconexão e demolição, desvio de rota, saída pelo altar |
| `happiness.test.ts` | felicidade desligada antes do Jardim (contente, sem motivos, imposto e famílias iguais aos de uma cidade sem felicidade); felicidade da casa (base, altar/templo, jardim só conectado e no raio, poço, mercado, fome, desemprego com teto, limites 0–100), três humores, fator do imposto e das famílias (1 enquanto contente, extremos), imposto da casa feliz e triste, média da cidade (50 sem famílias), parte sem vaga, famílias mais rápidas na cidade feliz, contagem por humor, informação da casa com felicidade e imposto real, balão de casa triste |
| `debt.test.ts` | manutenção levando a prata abaixo de 0, construir e cortar bloqueados em dívida (demolir não; prata 0 não é dívida), contagem da dívida (início, zera com prata ≥ 0, recomeça), derrota exatamente no mês 24 e simulação parada depois, maior população, ordem dos avisos (dívida, saldo negativo com maior custo, desemprego) |
| `goals.test.ts` | os 11 objetivos (tipos, alvos, prêmios, liberações; um só de vitória), `unlockingGoal` (celeiro 3, mercado 5, oficina 6, jardim 7, templo 10), Objetivo 1 pela previsão (com pescador) e alvo que encolhe, Objetivo 2 com alvo máx(4, casas), Objetivo 3 pela comida colhida desde o começo (também numa colheita real) e `upkeepStart`, celeiro ligado, casas de barro, 50 moradores, 2 oficinas ligadas, casas grandes só conectadas, vitória com o templo, um objetivo por verificação |
| `simulation.test.ts` | comida, prata, semana, fome (termina com a colheita da primavera), prata do campo e relógio (1 semana a cada 2,5 s em 1x) |
| `seasons.test.ts` | 13 semanas por estação começando no outono, ordem das estações, primeira semana de cada estação, um evento `season` só quando a estação muda, `seasonCount`/`START_SEASON`, ano agrícola do outono ao verão no `calendar`, jogo novo na semana 1 do outono do Ano 1 |
| `tutorial.test.ts` | os 6 passos da sobrevivência (poço, rua, pescador ou coletora, campo, casa, família) e os mini passos, `markTutorial` (ruas e casas ligadas), condição de cada passo (ruas novas na rede, casa nova ligada sem contar a caravana, pescador/coletora ligado, marco da primeira família — também numa chegada real —, campo, poço, mercado; o do saldo só por toque), caminho fantasma de 8 células livre, reto e encostado no anel em 60 seeds, escolhendo a linha que termina mais perto do rio ou de árvore, indo às árvores quando estão mais perto, trocando de lado quando bloqueado e vazio com os 4 lados bloqueados, casas atendidas por um serviço ("Atende N casas") |
| `survival.test.ts` | caravana por semente (2–4 tendas ligadas ao norte e a oeste do anel, comida de 10–20 semanas cortada em 40, semanas anunciadas reais, prata inicial), colheita só na primavera (`harvestsIn`, `firstHarvestWeek`, campo feito no inverno colhe no ano seguinte, última semana do outono ainda semeia, desconectado não colhe, eficiência, evento `harvestStart` com o total, `harvested`), `weeksToHarvest`, consumo semanal, estoque com e sem celeiro (desligado não guarda), estrago (`spoilStart` uma vez, limite exato não estraga, perder o celeiro), previsão (semanas e estação, colheita e limite, seca anunciada, horizonte, primavera conta até o ano seguinte), inverno (tendas saem com 35%, casa de barro protege, `winterLoss`), seca (× 0,4, campo no rio protegido, nunca no Ano 1 nem 2 seguidas, chance, aviso do inverno à primavera), avisos novos e sua ordem, marcos uma vez só (caravana não conta), histórico com `capacity`, objetivos `foodUntilSpring`, `water` e `harvest` com `goalTarget` , campo dá comida na primavera, verão e outono e congela no inverno (sem comida, prata nem vagas; pescador a 100%; manutenção mantida; previsão com a eficiência de cada semana) |
| `gather.test.ts` | Pescador e Coletora: dados, células de rio/árvore no raio (contadas à parte), 0,75 e 0,3 por célula com teto 4,5, mais longe rende menos, cortar árvore baixa, dois no mesmo recurso, desligado não rende, o ano todo com a eficiência, balões "sem fonte", "sem rua" e "sem trabalhadores" |
| `looks.test.ts` | aparência das casas: semente determinística, variante dentro do número do nível, espelhamento, vizinhas do mesmo nível com variantes diferentes, novo sorteio ao mudar de nível; plantação do campo diferente da do campo vizinho; construções de uma só aparência ficam na variante 0; ofício da oficina (sorteio determinístico, vizinhas diferentes, guardado na variante) |
| `walkers.test.ts` | tipos de morador: só aparecem quando a construção existe e está ligada, destino pelo tipo (poço, campo, mercado, oficina, altar/templo, ruas principais, borda), carregador campo → mercado e volta, destino aleatório de reserva, destino do artesão aponta a oficina e o ofício |

### Utilitários (`tests/helpers.ts`)

- `emptyGame(overrides)` — jogo sem rochas/árvores, areia em tudo (exceto o rio), muita prata,
  sem a caravana (só o altar) e com 30 de comida, quase tudo liberado e já no Objetivo 3
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
| `tutorial` | celular 844 x 390, primeira partida: frase da caravana; os 6 passos (poço com "Atende N casas", rua pelo caminho fantasma arrastada com o dedo, coletora com "Rende N comida/sem" (o passo aceita pescador ou coletora), campo, casa, família com a câmera seguindo), só as ferramentas do passo liberadas, a coluna abre a categoria e depois escolhe; antes da família, `openFamilyDoor` (celeiros, comida e poços) abre a porta; depois o saldo no Objetivo 3 ("Entendi") e o mercado; tutorial gravado como feito | `tutorial-caravan`, `tutorial-step-1`, `tutorial-step-1-preview`, `tutorial-step-2`, `tutorial-step-3`, `tutorial-step-3-preview`, `tutorial-step-4` … `tutorial-step-6`, `tutorial-saldo`, `tutorial-market` |
| `tutorial-pc` | o mesmo no PC 1366 x 768, com o mouse | as mesmas, com `-pc` no fim |
| `tutorial-blocked` | PC: no passo da família com as famílias bloqueadas (casa sem poço), `familyBlock` dá o motivo e todas as ferramentas ficam livres (o tutorial nunca trava) | `tutorial-family-blocked` |
| `tutorial-skip` | "Pular tutorial" encerra e fica gravado; as ferramentas voltam (tecla 2 escolhe Rua); com o `localStorage` bloqueado o tutorial roda e pular funciona sem erro | — |
| `options` | a engrenagem abre as Configurações; um clique no título do painel não muda a ferramenta nem seleciona nada, e o painel continua aberto | `options` |
| `build-with-mouse` | começa com o altar e as tendas da caravana; rua e casas arrastando (teclas 2 e 3), poço e campo clicando (tecla 4, e 4 de novo passa para o Campo); conta ruas e construções | `build-with-mouse` |
| `families-arrive` | terrenos ao lado da rua, `openFamilyDoor`, 3x; espera família andando e o marco "Primeira família" | `families-walking`, `families-arrived` |
| `happiness` | pausado, cidade de `buildTown` com jardim e comida: a carinha da pílula Alegria segue o humor; tocar nela abre as Estatísticas; casa ao lado do jardim (balão com os motivos); fome deixa a carinha triste e põe balões tristes; prévia do Jardim com raio | `happiness-breakdown`, `happiness-house`, `happiness-sad`, `overlay-garden` |
| `ambient` | cidade de `buildTown` de manhã: galinhas, jumentos, pombas, barcos, lavadeiras, ovelhas e varais existem, nenhum bicho com textura faltando (`__MISSING`); zoom no rio perto do primeiro barco | `ambient-town`, `ambient-river` |
| `seasons` | PC, cidade de `buildTown` pausada com bosques em volta: as 4 estações (o ano começa no outono; ícone certo na pílula da estação, sem ícone de seca, trigo dourado na colheita da primavera, fumaça e árvores peladas no inverno, catadores no outono), com e sem a interface; amendoeiras floridas no fim do inverno; chuva fraca, média e forte (mais gotas a cada nível, poças nas ruas); inverno com neve (telhados com neve); seca no verão (rio com lama, cada campo com sua fase, ícone de seca na pílula da estação e recorte dela; de longe, no zoom mínimo, sobre o rio); toast da primavera ao chegar a semana 1 dela, e o aviso de seca sumiu | `seasons-spring`, `seasons-summer`, `seasons-autumn`, `seasons-winter` (e cada uma com `-noui`), `seasons-almond`, `weather-rain-light`, `weather-rain-medium`, `weather-rain-heavy`, `weather-snow`, `seasons-drought`, `seasons-drought-icon`, `seasons-drought-noui`, `seasons-drought-zoom`, `seasons-toast` |
| `seasons-phone` | o mesmo no celular deitado 844 x 390 | as mesmas, com `-phone` no fim |
| `town-art` | monta uma cidade com todos os níveis e prédios (inclui jardim); templo conectado; prévias | `town-art`, `overlay-temple-preview`, `overlay-house-sacred-area` |
| `day-night` | PC: cidade de `buildTown` pausada em manhã, tarde dourada, pôr do sol e noite (metade dos moradores e luzes acesas à noite); Configurações (engrenagem) e ciclo desligado pela opção Dia e noite (sempre dia) | `day-night-morning`, `day-night-golden`, `day-night-sunset`, `day-night-night`, `day-night-options`, `day-night-off` |
| `scaffold-roads` | ruas com passos de moradores (uma gasta, uma calçada, uma comum); oficina nova com andaime que some depois | `roads-wear`, `scaffold`, `scaffold-done` |
| `field-work` | pausado: 8 campos ligados (4 plantações, normal e espelhado) e 1 sem rua; 2 agricultores por campo com eficiência 100%, nenhum no campo sem rua; zoom máximo (dois momentos do trabalho) e mínimo; mapa girado com 1 agricultor por campo quando só parte das vagas está ocupada | `field-work-zoom-max`, `field-work-zoom-max-later`, `field-work-zoom-min`, `field-work-turned` |
| `camera-wheel` | zoom com a roda dentro dos limites | `camera-zoom-in`, `camera-zoom-out` |
| `touch` | celular deitado com toque real: toque no botão Rua de baixo; um dedo constrói rua sem mover a câmera; pinça dá zoom sem construir | `touch-title`, `touch-after-pinch` |
| `input-phone` | celular deitado 844 x 390 (jogo 1280 x 591), pausado com avisos de saldo negativo e desemprego: a coluna abre Água e comida e escolhe o Poço; prévia mirada acima do dedo; deslizar até a coluna e soltar cancela; sem prévia nem construção quando o ponto mirado cai sob a pílula do objetivo; com Demolir, um toque na fresta entre Avisos e Estatísticas conta como interface e não demole nada; um Esc volta de Demolir para Mover | `input-phone-preview`, `input-phone-clear` |
| `nova-small-phone` | o `nova-phone` no celular 800 x 360 (o menor): tudo com 44 px e dentro da tela | as do `nova-phone`, com `small-phone` |
| `input-pc` | PC 1366 x 768 (jogo 1280 x 720), mesma cidade: tecla 5 escolhe o Mercado e a prévia segue o mouse; botões 3x e pausa; arrastar rua começando na pílula da comida não constrói; clique na prata abre as Estatísticas e no objetivo abre os Objetivos | `input-pc`, `input-pc-stats`, `input-pc-goals` |
| `clarity` | pausado: rua arrastada longe da rede (apagada, tracejada, aviso); campo sem moradores com balão "sem trabalhadores"; fome; posições do templo; mapa sem espaço para o templo | `clarity-loose-road`, `clarity-famine`, `overlay-temple-spots`, `temple-no-spot` |
| `turn-map` | mercado, casa e poço; abre as Configurações e clica ↻ (não constrói nada), arrasta rua no mapa girado e confere as células; E/E e Q | `turn-0`, `turn-1`, `turn-3`, `turn-2` |
| `debt` | pausado em dívida com fome: prata vermelha piscando, toast ao tentar construir, família saindo a pé; toque na prata abre as Estatísticas; painel de Avisos; a 1x chega à derrota (com anos e semanas); "Tentar de novo" começa um mapa novo | `debt-alerts`, `debt-silver-info`, `debt-alerts-panel`, `defeat`, `defeat-retry` |
| `victory` | constrói o templo e espera a vitória | `temple-celebration`, `victory` |
| `nova-phone` | celular 844 x 390: todo botão redondo (nível, engrenagem, velocidade, Objetivos, Avisos, Estatísticas, Mover, Rua, Demolir e as 4 categorias da coluna) ≥ 44 px reais e dentro da altura da tela; nenhuma parte do topo encosta em outra; Mercado escolhido (categoria, depois a construção) com o balão à esquerda da coluna; o balão da Casa fica abaixo da estação, da velocidade e da engrenagem; nenhum texto < 12 px reais; Jardim bloqueado não é escolhido ("Libera no objetivo N"); casa de barro tocada com o balão e a ação principal; histórico e 2 marcos falsos com o toast do marco; Avisos, Objetivos, Estatísticas (abas Agora e Histórico) e Configurações abrem sem cobrir Mover, Rua e Demolir e fecham com Esc; uma rajada de 5 toasts não perde nenhum (no máximo 3 na tela, o resto em fila) | `nova-phone`, `nova-phone-chosen`, `nova-phone-locked`, `nova-phone-house`, `nova-phone-spots`, `nova-phone-milestone`, `nova-phone-alerts`, `nova-phone-goals`, `nova-phone-stats`, `nova-phone-history`, `nova-phone-settings`, `nova-phone-toasts` |
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
  (texturas com neve ainda sendo desenhadas), `tiles` (o que cada célula mostra), `puddles`. `window.game.guide` é o tutorial (`guide.step`, `guide.allowed()`), `window.game.ghost` o caminho
  fantasma e `window.game.ui.tutorial` o balão (`skipBtn`, `okBtn`).
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
- `openFamilyDoor(page)` abre a porta das famílias (celeiros, comida até a colheita e poço para
  todas as casas), para cenários que esperam famílias chegando.
- `mouseDrag` falha se alguma célula do arraste estiver sob a interface: escolha células no mapa
  aberto (a coluna à direita, os botões laterais e as ferramentas de baixo à esquerda, as pílulas no topo).
- Para celular ou PC, use a forma `{ context: PHONE | PC, run(page) {...} }` (veja `input-phone` e
  `input-pc`). No celular, `touchInput(page)` dá `touch(type, pontos)` e `tap(ponto)` com toque real
  pelo protocolo do Chrome, em coordenadas do jogo.
- No PC, o primeiro movimento do mouse depois de sair de um botão vai para a interface (evento
  "out" do Phaser); mova duas vezes antes de conferir a prévia.
- `shot(page, nome)` espera as construções novas terminarem de subir (andaime) antes da captura;
  use `{ scaffolds: true }` para fotografar o andaime. `buildTown(page)` monta a cidade de exemplo.
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

Partidas inteiras sem interface, rodando só o `src/core` com semente fixa, para medir duração e
economia (usado pelo sim-tester). Os scripts são empacotados com o `rolldown` (já instalado com o
Vite) em `node_modules/.cache/sim/` e rodados com o Node; nada vai para `dist/`.

```bash
npm run sim                                   # 3 jogadores x 20 sementes, até 2000 meses, ~2 s
npm run sim -- --bots comum --seeds 5         # um jogador, 5 sementes
npm run sim -- --seed0 100 --weeks 600       # outras sementes, outro limite de meses
npm run sim -- --csv <pasta>                  # curvas por partida (a cada 3 meses): prata, comida,
                                              # moradores, eficiência, saldos, sem trabalho
npm run sim -- --json                         # resultados brutos
npm run sim -- --after 48                     # meses jogados depois da vitória (padrão 24; 0 = para na vitória)
npm run sim -- --set buildings.temple.cost=2000 --set rules.familyChance=0.25 --drop-goal 4
npm run sim -- --set bots.comum.actionsPerWeek=1
npm run sim:dump -- <semente> <jogador> <mês> # desenha o mapa da partida naquele mês (aceita --set)
```

`--set tabela.caminho=json` muda números **só na memória** (tabelas `buildings`, `goals`,
`houses`, `rules` e os perfis `bots`), para medir propostas sem editar `src/data`. `--drop-goal N`
tira a meta N (contando de 1); o que ela liberava passa para a meta anterior.

| Arquivo | O que faz |
|---|---|
| `bots.ts` | jogadores automáticos: um perfil de números (`BotProfile`) + a mesma lógica de decisão. Só usam a API do core (`place`, `clearCell`, `computeEconomy`, `needMet`, `templeSpots`...) e leem custos dos dados, então mudanças de regra ou de números valem sem mexer nos jogadores |
| `sim.ts` | `runGame(perfil, semente, meses, amostra, depois)`: roda uma partida e mede tudo; depois da vitória continua `depois` meses (a manutenção segue valendo) para ver se a cidade aguenta; `isDefeated(s)` encerra como derrota se o estado tiver `lost`, `defeated` ou `gameOver` |
| `run.ts` | linha de comando e resumo por jogador (medianas e faixa mín–máx) |
| `overrides.ts` | `--set` e `--drop-goal` |
| `dump.ts` | mapa em texto (0–4 nível da casa, f campo, W poço, M mercado, K oficina, T templo, A altar, # rua ligada, + rua solta, R rocha, t árvore, ~ rio) |

Jogadores (todos com no máximo 2 gestos por mês: um traço de rua, um arraste de casas ou uma
construção; o rng do jogador é separado do rng do jogo):

- **eficiente** — segue uma grade de ruas (a cada 5 células, alinhada ao anel do altar), põe poço
  e mercado antes das casas, casas perto do altar, campos e oficinas fora do raio do altar, campo
  só quando ele de fato aumenta a comida, oficina com 3+ pessoas sem trabalho, reserva um lote 6 x 6
  para o templo; no fim só gasta no que se paga e, quando o templo está a menos de um ano de saldo,
  só junta prata. Olha o saldo do mês: não constrói algo com manutenção se a prata restante não
  aguentar o déficit por 24 meses, e nunca gasta a ponto de terminar o mês com prata negativa.
  Se o déficit ameaça, demole o serviço que menos rende (veja abaixo) na hora.
- **comum** — segue a grade, reage aos problemas (comida negativa, casas sem poço/mercado, aviso
  de desemprego) depois de 3 meses, às vezes constrói um poço ou mercado sem precisar, fica parado
  10% dos meses e, com o templo liberado, só junta prata. Só corta manutenção depois de 6 meses de
  saldo negativo ou 3 meses em dívida, e mesmo assim só em metade dos meses.
- **distraido** — ruas e lugares quase ao acaso, só percebe a comida quando a fome chega, só reage
  ao aviso de desemprego depois de ~10 meses, constrói serviços à toa, fica parado 30% dos meses e
  não junta prata para o templo. Não percebe o saldo negativo; só corta manutenção depois de 8
  meses em dívida, e em só 20% dos meses.

Cortar manutenção: o jogador demole a construção com manutenção (poço, campo, mercado, oficina)
cuja saída mais melhora o saldo, medido numa cópia do estado com cada casa (e terreno) no nível
mais alto que suas exigências permitem, e que não deixa a comida pior que hoje. Preso na meta das
casas grandes, o jogador também leva poço ou mercado às casas da área sagrada e, sem lugar, demole
um campo, uma oficina ou uma casa pequena perto delas.

Medidas por partida: venceu/perdeu, mês de cada meta (e minutos a 1x), prata mínima, prata
máxima antes de liberar o templo, meses com prata parada (> 120 antes do templo), meses com saldo
de prata negativo, meses em dívida (prata < 0 ao fim do mês; total, episódios e maior sequência),
meses apertados (em dívida, ou déficit × 12 maior que a prata), demolições para cortar
manutenção, depois da vitória (perdeu? entrou em dívida? prata mínima), meses e episódios de fome (e se terminou em fome), pico de moradores, meses com
aviso de desemprego, maior sequência de meses sem nada útil para fazer, maior sequência só juntando
prata, se havia lugar para o templo ao liberá-lo e quantos meses até haver, ações e prata gasta por
tipo.

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

# Como testar

Dois níveis de teste: **unitários** (regras do jogo, rápidos, obrigatórios) e **visuais**
(o jogo de verdade num navegador, com screenshots).

```bash
npm test                        # testes unitários (Vitest), ~1 s
npm run test:visual             # testes visuais (Playwright), ~1 min
npm run test:visual -- touch    # só os cenários cujo nome contém "touch"
npx tsc --noEmit                # typecheck
```

Antes de dar uma tarefa por concluída: `npm test`, `npx tsc --noEmit` e `npm run test:visual`
precisam passar, e as screenshots afetadas pela mudança devem ser **olhadas**.

## Testes unitários (`tests/`)

Cobrem só `src/core` (TypeScript puro, sem Phaser). **Toda regra nova ou alterada precisa de teste.**

| Arquivo | O que cobre |
|---|---|
| `map.test.ts` | mapa 48 x 48, rio na borda leste, contagem de rochas e árvores, área livre do altar e da rua, estado inicial (altar, rua, entrada, prata, liberações), anel de rua em volta do altar (20 células livres, ligadas e alcançáveis da entrada, sem custo) |
| `network.test.ts` | rede de ruas ligada a qualquer lado do altar 4 x 4, caminhos que não atravessam o altar, desconexão ao demolir, custo e validação de rua, caminhos por busca em largura, máscara de junções (anel, cantos e T com a rua sul; o altar não conta), exigência de rua para cada tipo de construção |
| `coverage.test.ts` | raio quadrado a partir de qualquer célula, sem cobertura quando desconectado, área sagrada do altar 4 x 4, raio do templo 6 x 6, áreas não quadradas |
| `economy.test.ts` | eficiência, produção, construções desconectadas não produzem nem contam vagas, vagas do templo, manutenção (inclusive de desconectadas; rua, casa e altar grátis; só cobrada depois da Meta 2, com o evento `upkeepStart` uma vez), saldo exibido = impostos + oficinas − manutenção, maior custo, consumo de comida por nível, pessoas sem trabalho e limite do aviso de desemprego (só com a Oficina liberada) |
| `actions.test.ts` | custos e locais inválidos, tamanhos das construções, mercado girado, posicionamento do templo (6 x 6, bloqueios, exige rua, lista de posições possíveis), lugares de casa encostados na rede (`placeSpots`, tutorial), limpar, proteção do altar e do templo |
| `houses.test.ts` | evolução e regressão (rua, poço, mercado, altar ou templo), atendimento por qualquer célula da casa, fome (casas caem; tendas abandonadas com `famineLeaveChance` e evento de família saindo; sem fome nunca), informações e balões (incluindo "sem trabalhadores") |
| `families.test.ts` | chegada de famílias, 3 primeiras garantidas e 3x mais rápidas (as outras na velocidade normal), primeira tenda em até 2 meses, chance de 35%, uma por terreno, desconexão e fome, desvio de rota, saída pelo altar |
| `happiness.test.ts` | felicidade desligada antes do Jardim (contente, sem motivos, imposto e famílias iguais aos de uma cidade sem felicidade); felicidade da casa (base, altar/templo, jardim só conectado e no raio, poço, mercado, fome, desemprego com teto, limites 0–100), três humores, fator do imposto e das famílias (1 enquanto contente, extremos), imposto da casa feliz e triste, média da cidade (50 sem famílias), parte sem vaga, famílias mais rápidas na cidade feliz, contagem por humor, informação da casa com felicidade e imposto real, balão de casa triste |
| `debt.test.ts` | manutenção levando a prata abaixo de 0, construir e cortar bloqueados em dívida (demolir não; prata 0 não é dívida), contagem da dívida (início, zera com prata ≥ 0, recomeça), derrota exatamente no mês 24 e simulação parada depois, maior população, ordem dos avisos (dívida, saldo negativo com maior custo, desemprego) |
| `goals.test.ts` | as 9 metas (incluindo "construa 2 oficinas", só ligadas, que libera o Jardim), recompensas, liberações, evento `upkeepStart` ao cumprir a Meta 2, contagem só de casas conectadas, vitória com o templo |
| `simulation.test.ts` | comida, prata, mês, fome e relógio (1 mês a cada 2 s em 1x) |
| `tutorial.test.ts` | passos do tutorial e mini passos (dados), condição de cada passo (ruas novas na rede, casas ligadas, primeiro morador, campo, poço, casa de barro, mercado; o do saldo só por toque), caminho fantasma de 6 células livre em 100 seeds e por outro lado quando o oeste está ocupado, casas atendidas por um serviço ("Atende N casas") |
| `looks.test.ts` | aparência das casas: semente determinística, variante dentro do número do nível, espelhamento, vizinhas do mesmo nível com variantes diferentes, novo sorteio ao mudar de nível; plantação do campo diferente da do campo vizinho; construções de uma só aparência ficam na variante 0; ofício da oficina (sorteio determinístico, vizinhas diferentes, guardado na variante) |
| `walkers.test.ts` | tipos de morador: só aparecem quando a construção existe e está ligada, destino pelo tipo (poço, campo, mercado, oficina, altar/templo, ruas principais, borda), carregador campo → mercado e volta, destino aleatório de reserva, destino do artesão aponta a oficina e o ofício |

### Utilitários (`tests/helpers.ts`)

- `emptyGame(overrides)` — jogo sem rochas/árvores, areia em tudo (exceto o rio), muita prata,
  tudo liberado e já na Meta 3 (`goalIndex` = `upkeepStartsAfterGoal`, então a manutenção é cobrada). Altar 4 x 4 em x, y = 22..25, anel de rua em volta (contorno de x, y = 21..26) e
  rua inicial em x = 24, de y = 26 a 47. Construções ao lado da rua inicial ficam em y >= 27 para
  não cair no anel.
- `put(state, kind, x, y, level, rotated)` — coloca uma construção sem cobrar e já no nível desejado.
- `road(state, [[x, y], ...])` — coloca ruas sem cobrar.
- `constRng(v)` — gerador aleatório fixo (0 = sempre acontece, 0,99 = nunca acontece).
- `ROADSIDE = 22` — coluna de uma casa 2 x 2 encostada a oeste da rua inicial (conectada).
- `westOf(kind)` — coluna de uma construção desse tipo encostada a oeste da rua; `EAST = 25` —
  coluna de qualquer construção encostada a leste.

## Testes visuais (`scripts/visual/run.mjs`)

O script sobe o servidor de desenvolvimento do Vite, abre o jogo no Chromium do Playwright,
executa cada cenário, salva screenshots em `screenshots/` (fora do git) e falha se uma verificação
quebrar ou a página registrar erro no console. Em falha, salva também `FAILED-<cenário>.png`.

| Cenário | O que faz e verifica | Screenshots |
|---|---|---|
| `title` | tela inicial; depois de ver o tutorial, com "Ver tutorial de novo" | `title`, `title-again` |
| `tutorial` | celular 844 x 390, primeira partida: os 6 passos com a seta (no botão, depois no mapa), só a ferramenta do passo liberada, caminho fantasma arrastado com o dedo, lugares verdes, câmera seguindo a família, prévia do poço com "Atende N casas", casa de barro; depois o saldo na Meta 2 ("Entendi") e o mercado; tutorial gravado como feito | `tutorial-step-1` … `tutorial-step-6`, `tutorial-saldo`, `tutorial-market` |
| `tutorial-pc` | o mesmo no PC 1366 x 768, com o mouse | as mesmas, com `-pc` no fim |
| `tutorial-skip` | "Pular tutorial" encerra e fica gravado; as ferramentas voltam; com o `localStorage` bloqueado o tutorial roda e pular funciona sem erro | — |
| `options` | um clique no título do painel de Opções não muda a ferramenta nem seleciona nada, e o painel continua aberto | — |
| `build-with-mouse` | rua e casas arrastando, campo e poço clicando; conta ruas e construções | `build-with-mouse` |
| `families-arrive` | terrenos ao lado da rua em 3x; espera família andando e tenda pronta | `families-walking`, `families-arrived` |
| `happiness` | pausado, cidade de `buildTown` com jardim e comida: carinha da placa segue o humor; toque na carinha mostra o detalhe; casa ao lado do jardim (motivos na linha de informação); fome deixa a carinha triste e põe balões tristes; prévia do Jardim com raio | `happiness-breakdown`, `happiness-house`, `happiness-sad`, `overlay-garden` |
| `ambient` | cidade de `buildTown` de manhã: galinhas, jumentos, pombas, barcos, lavadeiras, ovelhas e varais existem, nenhum bicho com textura faltando (`__MISSING`); zoom no rio perto do primeiro barco | `ambient-town`, `ambient-river` |
| `town-art` | monta uma cidade com todos os níveis e prédios (inclui jardim); templo conectado; prévias | `town-art`, `overlay-temple-preview`, `overlay-house-sacred-area` |
| `day-night` | PC: cidade de `buildTown` pausada em manhã, tarde dourada, pôr do sol e noite (ícone certo ao lado do mês, metade dos moradores e luzes acesas à noite); painel de opções e ciclo desligado (sempre dia) | `day-night-morning`, `day-night-golden`, `day-night-sunset`, `day-night-night`, `day-night-options`, `day-night-off` |
| `scaffold-roads` | ruas com passos de moradores (uma gasta, uma calçada, uma comum); oficina nova com andaime que some depois | `roads-wear`, `scaffold`, `scaffold-done` |
| `field-work` | pausado: 8 campos ligados (4 plantações, normal e espelhado) e 1 sem rua; 2 agricultores por campo com eficiência 100%, nenhum no campo sem rua; zoom máximo (dois momentos do trabalho) e mínimo; mapa girado com 1 agricultor por campo quando só parte das vagas está ocupada | `field-work-zoom-max`, `field-work-zoom-max-later`, `field-work-zoom-min`, `field-work-turned` |
| `camera-wheel` | zoom com a roda dentro dos limites | `camera-zoom-in`, `camera-zoom-out` |
| `touch` | celular deitado com toque real: toque no botão Rua do trilho esquerdo; um dedo constrói rua sem mover a câmera; pinça dá zoom sem construir | `touch-title`, `touch-after-pinch` |
| `hud-phone` | celular deitado 844 x 390 (jogo 1280 x 591), pausado com avisos de saldo negativo e desemprego: botões dos trilhos ≥ 44 px de tela; toque no Poço do trilho direito; prévia mirada acima do dedo; deslizar até o trilho e soltar cancela; sem prévia nem construção quando o ponto mirado cai sob a interface; X fecha o aviso (aparece o próximo); toque na meta mostra a meta inteira | `hud-phone`, `hud-phone-preview`, `hud-phone-goal` |
| `hud-small-phone` | celular 800 x 360: botões dos dois trilhos e de velocidade ≥ 44 px de tela; a placa não encosta na velocidade | `hud-small-phone` |
| `hud-pc` | PC 1366 x 768 (jogo 1280 x 720), mesma cidade: clique no Mercado do trilho direito e prévia seguindo o mouse; botões 3x e pausa; arrastar rua começando na placa não constrói; X fecha o aviso e ele continua escondido; clique na prata (detalhe) e na meta; aviso de dívida sem X | `hud-pc`, `hud-pc-silver`, `hud-pc-goal`, `hud-pc-debt` |
| `clarity` | pausado: rua arrastada longe da rede (apagada, tracejada, aviso); campo sem moradores com balão "sem trabalhadores"; fome na placa; posições do templo; mapa sem espaço para o templo | `clarity-loose-road`, `clarity-famine`, `overlay-temple-spots`, `temple-no-spot` |
| `turn-map` | mercado, casa e poço; clica ↻ no trilho esquerdo (6º botão, depois de Ver, Rua, Jardim, Limpar e ↺) (não constrói nada), arrasta rua no mapa girado e confere as células; E/E e Q | `turn-0`, `turn-1`, `turn-3`, `turn-2` |
| `debt` | pausado em dívida com fome: faixa de aviso da dívida, prata vermelha, custos em vermelho nos trilhos, toast ao tentar construir, família saindo a pé; toque na prata (detalhe na linha de informação); a 1x chega à derrota; "Tentar de novo" começa um mapa novo | `debt-alerts`, `debt-silver-info`, `defeat`, `defeat-retry` |
| `victory` | constrói o templo e espera a vitória | `temple-celebration`, `victory` |

### Ganchos de desenvolvimento

Só no modo dev (`npm run dev`, e é o que o script usa), o jogo expõe no `window`:

- `window.game` — a `GameScene` (câmera em `game.cameras.main`, `game.refresh()`, `game.selectTool(t)`;
  em `game.map` a `MapView`: `map.work` é o relógio das animações de trabalho, que pode ser
  avançado com o jogo pausado, e `map.views` as construções desenhadas, com `crew.count` nos campos);
- `window.state` — o `GameState` atual;
- `window.core` — todas as funções do core (`core.place`, `core.clearCell`, `core.stepMonth`...);
- `window.iso` — projeção e giro do mapa (`iso.gridToWorld`, `iso.getRotation()`); o
  `cellToScreen` do script já usa o giro atual;
- `window.layout` — posições da interface (`src/render/layout.ts`): `speedButton(k)` (0 pausa,
  1 1x, 2 3x), `leftButton(k)` (0 Ver, 1 Rua, 2 Jardim, 3 Limpar, 4 ↺, 5 ↻), `buildButton(k)` (0 Casa …
  5 Templo), `plaqueSlot(k)` (0 mês, 1 prata, 2 comida, 3 moradores, 4 felicidade, 5 trabalho), `OPTIONS`, `GOAL_Y`, `BTN`.
  `window.game.guide` é o tutorial (`guide.step`, `guide.allowed()`), `window.game.ghost` o caminho
  fantasma e `window.game.ui.tutorial` o balão (`skipBtn`, `okBtn`).
  `window.game.ui.isOverUi(x, y)` diz se um ponto está sob a interface; `window.game.ui.hud.shown`
  é o aviso mostrado e `hud.closeRect` o X dele.

Use-os para montar situações rapidamente em vez de jogar até lá. Depois de mudar o estado
diretamente, chame `window.game.refresh()`. Se mudar conexões à mão (ruas, construções), prefira
`core.place`/`core.clearCell`, que já recalculam a rede, ou chame `core.refreshCity(state)`.

### Escrever um cenário novo

Adicione uma entrada em `scenarios` no `run.mjs`:

```js
async 'meu-cenario'(page) {
  await startGame(page);              // abre o jogo e passa da tela inicial (tutorial pulado;
                                      // startGame(page, { tutorial: true }) para jogar com ele)
  await tool(page, 2);                // escolhe a ferramenta pela posição (1 = Ver, 2 = Rua...)
  await mouseDrag(page, [[17, 16], [20, 16]]);   // arrasta entre células da grade
  const s = await stats(page);        // ruas, construções, níveis, zoom, vitória
  assert(s.roads === 19, 'mensagem clara');
  await shot(page, 'meu-cenario');    // screenshots/meu-cenario.png
},
```

- `cellToScreen(page, x, y)` converte uma célula da grade para a posição no jogo (1280 x altura)
  usando a câmera atual; `gameToPage` e `cellToPage` convertem para a página (o canvas é escalado
  quando a janela não é 1280 x 720).
- `clickUi(page, 'buildButton', 3)` clica num elemento da interface pelo `window.layout`;
  `uiPoint(page, ...)` dá a posição no jogo (para toque).
- `mouseDrag` falha se alguma célula do arraste estiver sob a interface: escolha células no mapa
  aberto (os trilhos ocupam as laterais, a placa e as faixas o centro do topo).
- Para celular ou PC, use a forma `{ context: PHONE | PC, run(page) {...} }` (veja `hud-phone` e
  `hud-pc`). No celular, `touchInput(page)` dá `touch(type, pontos)` e `tap(ponto)` com toque real
  pelo protocolo do Chrome, em coordenadas do jogo.
- No PC, o primeiro movimento do mouse depois de sair de um botão vai para a interface (evento
  "out" do Phaser); mova duas vezes antes de conferir a prévia.
- `shot(page, nome)` espera as construções novas terminarem de subir (andaime) antes da captura;
  use `{ scaffolds: true }` para fotografar o andaime. `buildTown(page)` monta a cidade de exemplo.
- `startGame` marca o tutorial como visto (`jerusalem.tutorialDone` no `localStorage`) antes de abrir
  a página, salvo com `{ tutorial: true }`.
- `startGame` desliga o controle de quadros por segundo (`game.dayNight.fpsGuard = false`), para o
  acabamento não sumir no navegador lento. Ganchos: `game.dayNight.setTime(t)` (0..1, 0,76 = noite),
  `game.dayNight.current`, `game.wear.step(state, x, y)` e `game.wear.level(state, x, y)`.
- O navegador sem placa de vídeo é lento: prefira `page.waitForFunction(...)` esperando um estado
  do jogo em vez de tempos fixos longos.

## Simulação de equilíbrio (`tools/sim`)

Partidas inteiras sem interface, rodando só o `src/core` com semente fixa, para medir duração e
economia (usado pelo sim-tester). Os scripts são empacotados com o `rolldown` (já instalado com o
Vite) em `node_modules/.cache/sim/` e rodados com o Node; nada vai para `dist/`.

```bash
npm run sim                                   # 3 jogadores x 20 sementes, até 2000 meses, ~2 s
npm run sim -- --bots comum --seeds 5         # um jogador, 5 sementes
npm run sim -- --seed0 100 --months 600       # outras sementes, outro limite de meses
npm run sim -- --csv <pasta>                  # curvas por partida (a cada 3 meses): prata, comida,
                                              # moradores, eficiência, saldos, sem trabalho
npm run sim -- --json                         # resultados brutos
npm run sim -- --after 48                     # meses jogados depois da vitória (padrão 24; 0 = para na vitória)
npm run sim -- --set buildings.temple.cost=2000 --set rules.familyChance=0.25 --drop-goal 4
npm run sim -- --set bots.comum.actionsPerMonth=1
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

## Testar no celular de verdade

`npm run dev` e abra no celular o endereço "Network" que o Vite mostra (mesma rede Wi-Fi). O
teste visual de toque cobre os gestos, mas tamanho de texto e conforto dos botões só se avaliam
no aparelho.

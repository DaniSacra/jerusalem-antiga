# Plano da revisão 2026-11-03 (game-director)

Foco: o jogo virou sobrevivência (commit 95dd36c) e o jogador achou "meio impossível".
Base: os 9 relatórios desta pasta (playtester, sim-tester, fun-critic, ui-designer, sprite-artist,
map-designer, copywriter, code-reviewer, test-reviewer), `docs/design.md` e o plano anterior
(`docs/revisoes/2026-11-02-2/plano.md`). Nada de código, dados ou `docs/design.md` foi alterado
por este plano; `docs/design.md` será atualizado quando o usuário aprovar o Pacote 1.

## 1. Resumo (como o jogo está hoje)
1. O jogo é quase impossível: nenhum bot do sim-tester venceu em 20 seeds, e o bot que segue o tutorial (playtester) perdeu 10 de 16 partidas. A causa final é a dívida, e o gatilho é a fome.
2. O Ano 1 é a parte mais difícil do jogo, quando devia ensinar. Os custos dobraram, mas o imposto não. A manutenção começa na semana 2. Com água, as casas sobem de nível e o consumo de comida dobra. A caravana de 4 famílias é pior que a de 2.
3. Três bugs de regra fazem a cidade passar fome de um jeito que o jogador não consegue prever. A porta das famílias ignora as famílias a caminho, ignora o consumo da família nova e confere uma semana a mais. O objetivo 1 se cumpre sozinho na semana 1. O tutorial trava as ferramentas e deixa o relógio correndo durante a fome.
4. A tela promete mais do que entrega. O "Rende 1,5" ignora a falta de trabalhadores. Não há contagem até a colheita. O campo plantado tarde parece produtivo. Um terreno vazio sem água bloqueia as famílias sem nenhum sinal no mapa.
5. O conserto já foi medido: o pacote M de números com `workerShare` 0,5 dá Ano 1 justo para o Comum e para o Eficiente (20/20 cada). Com ele, porém, a partida fica curta demais (cerca de 3,5 min), e o Comum ainda perde por dívida no Ano 2 em 13 de 20 seeds.

## 2. Consensos (duas ou mais fontes)
- **O poço dobra o consumo e nada avisa.** Apontado por playtester, sim-tester, fun-critic e map-designer.
- **O objetivo 1 se cumpre sozinho, e o inverno chega com fome.** Apontado por playtester, sim-tester, fun-critic e ui-designer (o alvo 0/0 na primavera).
- **A manutenção começa cedo demais.** O objetivo 2 se cumpre na semana 1 a 4 com as tendas da caravana. Apontado por playtester, sim-tester e fun-critic.
- **A porta das famílias deixa entrar mais gente do que a comida aguenta.** Apontado por test-reviewer (famílias a caminho e família nova fora da conta) e code-reviewer (descompasso de semana).
- **A água conta terrenos vazios** e a cidade trava sem sinal no mapa. Apontado por ui-designer, copywriter, sim-tester (é o bloqueio dominante: 54% no Comum e 78% no Distraído) e playtester.
- **A caravana de 4 famílias é injusta.** As tendas ficam espalhadas, e nenhum poço cobre todas. Apontado por map-designer (33 de 33 seeds com fome), playtester (62 de 200 mapas) e fun-critic.
- **A falta de trabalhadores é escondida.** O campo plantado no outono tira gente do pescador, e o "Rende N" não mostra a eficiência. Apontado por ui-designer, copywriter, code-reviewer, playtester, test-reviewer e sim-tester (espiral de vagas).
- **O tutorial com o relógio correndo atrapalha.** O tutorial pede o poço primeiro, gasta 6 das 13 semanas do outono e trava as ferramentas. Apontado por playtester e fun-critic.
- **O estoque de 40 joga a primeira colheita fora**, e o aviso manda construir um celeiro ainda bloqueado. Apontado por playtester, fun-critic, ui-designer, copywriter e test-reviewer.
- **O campo plantado tarde engana.** O texto "ano 2" e os agricultores com foice em terra vazia fazem parecer que ele vai colher. Apontado por ui-designer, sprite-artist e copywriter.
- **A seca não se lê nem se explica.** Ela é anunciada depois do plantio, a palavra "Seca" não aparece e o aviso não diz o efeito. Apontado por ui-designer e copywriter.
- **O "tendas sofrem com o frio" promete uma regra que não existe.** Apontado por copywriter e sprite-artist (o inverno parece calmo).
- **A simulação estava quebrada e os testes não pegam equilíbrio impossível.** Apontado por code-reviewer, playtester, sim-tester e test-reviewer.
- **Os toasts cobrem os painéis e a dica do tutorial.** Apontado por playtester e ui-designer.

## 3. Conflitos e decisões
| Tema | Posições | Decisão e motivo |
|---|---|---|
| Celeiro cedo | fun-critic: liberar no Objetivo 1 e trocar a ordem dos Objetivos 3 e 4. sim-tester: liberar o celeiro no início com estoque 60 teve efeito **nulo** | **FORA.** O celeiro continua liberado no objetivo 3. Medido sem efeito: quem perde morre antes de colher. O que dói (o aviso apontando para algo bloqueado) se resolve com o texto e com `baseFoodStorage` 50 |
| Quando começa a manutenção | fun-critic: depois do objetivo 4. sim-tester: depois do 3, dentro do pacote M | **Depois do 3** (primeira colheita). Foi o número medido junto com o resto (Ano 1 em 20/20). O 4 só foi medido sozinho e deixa a prata sem pressão por um ano |
| Poço que dobra o consumo | fun-critic: a casa só sobe de nível se a comida aguentar (regra nova). sim-tester: baixar o `food` das casas e prever com o nível futuro | **Números + previsão com o nível alvo** no P1. A trava de nível fica DEPOIS, condicionada ao playtest. Ela é regra nova, e travar a evolução tira o prêmio do bom lugar (pilar 6). A previsão honesta resolve o "não avisa" sem tirar o prêmio |
| Água e terrenos | Decisão de 2026-11-03: a porta conta todas as casas, terrenos também. ui-designer: pôr balão no terreno. sim-tester: não contar terrenos | **A porta passa a contar só casas com família** (a decisão de 2026-11-03 é revogada). A família nova pode ir a um terreno sem água; aí a casa dela aparece com a gota, e o problema fica visível. É mais simples que ensinar "terreno sem água", e o bloqueio dominante some |
| Tutorial e tempo | playtester: pausar ou liberar as ferramentas na fome | **Os dois, na forma mais simples.** O relógio fica parado nos passos de construir e anda nos passos de olhar (família chegando). As ferramentas nunca travam: o tutorial só destaca. Uma regra só, sem caso especial de fome |
| Ordem do tutorial | O tutorial atual pede o poço primeiro. fun-critic e playtester: comida antes | **Pescador ou coletora → campo → poço → casa.** Comida antes de crescer é a lição do ano (pilar 3) |
| Comida da caravana e estoque | sim-tester (opcional): `caravan.foodWeeks` [14,22] e `baseFoodStorage` 50. Com eles a dívida do Comum cai de 13 para 9 em 20, mas o Eficiente vence 16 em vez de 18 | **ENTRA**, porque o alvo do P1 é o jogador comum. Se a medição final do Comum piorar, volta ao M + 0,5 puro |
| Gerar mapas justos | map-designer: garantir um pescador e uma coletora cheios a até 8 células e 3 campos junto ao rio | **P1 só junta a caravana e leva a rua fantasma ao melhor lugar de comida. A garantia no gerador fica no P2.** O tutorial já resolve a abertura do novato; o gerador mexe em todas as seeds e precisa de medição própria |
| Seca anunciada depois do plantio | copywriter: o jogador não tem como reagir | **P2**: anunciar no começo do outono. Não existe seca no Ano 1, então não afeta o foco do P1. No P1 entra só o texto com o efeito |
| Espiral de vagas | sim-tester: os prédios de comida recebem trabalhadores primeiro. copywriter: um aviso de eficiência | **P2.** Essa regra é a única mecânica nova do P2. No P1 entra só mostrar a eficiência (prévia e inspetor). O Ano 1 já fecha 20/20 sem ela |
| Cidade vazia | sim-tester: hoje é derrota certa. playtester: trava para sempre, sem derrota nem aviso | **P1, como correção de travamento:** com 0 moradores a porta ignora água e comida. Uma frase e uma condição. O pilar 1 promete recuperação |
| `debtWeeksToLose` 24 → 39 | fun-critic | **FORA.** Em 2026-11-02, 36 já não salvou ninguém: as derrotas vêm de espiral, não de falta de tempo |
| Imposto ×2 | Medido: o Eficiente vence 17 em 20 na semana 85 | **FORA.** Fica fácil e curto demais; o pacote M chega ao mesmo Ano 1 sem inflar a prata |
| Manutenção do poço 3 → 2, prata inicial 300, chance de abandono no inverno 0,15 | fun-critic e variações do sim-tester | **FORA.** A prata inicial 300 e a chance 0,15 foram medidas e ajudam pouco ou nada. A manutenção do poço 2 não foi medida e é desnecessária com o M |

## 4. Pacote 1: "Um Ano 1 justo" (implantar agora)
Mecânica nova: **nenhuma**. Entram correções de regra, números medidos, tutorial, interface,
texto e um pouco de arte.
Pilares: fortalece o 1 (sobrevivência com recuperação: o Ano 1 deixa de ser uma armadilha), o 4
(a previsão diz a verdade) e o 6 (o bom lugar continua premiado, mas com o custo à vista). O
risco para o 2 (ritmo contemplativo) vem do tutorial parado; ele é controlado porque o relógio
anda nos passos de olhar.

### 1.1 Porta das famílias honesta
- **Origem:** test-reviewer, code-reviewer, copywriter (motivo `storage`).
- **Por que agora:** é o bug que manda famílias para a fome com a tela dizendo "dura até a colheita".
- **Regras:**
  - `familyBlock` prevê com o consumo de todas as casas (no nível alvo, ver 1.3), mais 1 tenda para cada família a caminho, mais a família nova.
  - `dispatchFamilies` e `moveFamilies` rodam depois de `s.week++`. Assim a porta, a pílula e os avisos leem a mesma semana.
  - Novo motivo `storage`: quando a previsão só falha porque o estoque corta a comida, aparece "o estoque só guarda N".
- **Arquivos:** `src/core/families.ts`, `simulation.ts`, `forecast.ts`, `src/render/strings.ts`, `tests/families.test.ts`, `tests/simulation.test.ts`, `docs/GAME_DESIGN.md` (Famílias).
- **Aceite:**
  - A sondagem do test-reviewer (2 tendas, 3 terrenos, comida 33) vira um teste e não passa fome antes da semana 26.
  - Um teste confirma que `familyBlock` dá o mesmo resultado no meio do passo e depois dele.
  - Um teste cobre o motivo `storage`.

### 1.2 Cidade vazia nunca trava
- **Origem:** playtester (item 9), sim-tester (4d).
- **Por que agora:** sem isso a cidade fica travada para sempre, sem derrota e sem aviso, o que quebra o pilar 1.
- **Regra:** com 0 moradores e nenhuma família a caminho, a porta ignora água e comida (o intervalo e a chance continuam valendo).
- **Arquivos:** `src/core/families.ts`, `tests/families.test.ts`, `docs/GAME_DESIGN.md`.
- **Aceite:** um teste com a reprodução do playtester mostra uma família chegando em até 6 semanas.

### 1.3 Previsão com o nível alvo e objetivo 1 de verdade
- **Origem:** playtester, sim-tester (4a), fun-critic, ui-designer (8), copywriter (4).
- **Por que agora:** é o que faz o poço "dobrar o consumo sem avisar" e o objetivo 1 se cumprir sozinho.
- **Regras:**
  - `foodForecast` usa, para cada casa com família, o consumo do nível que ela vai alcançar com os serviços de hoje (a mesma lógica do `houseInfo`). Vale para a pílula, os avisos, a porta e o objetivo.
  - Objetivo 1: o texto vira "Comida até a primavera", e o progresso ganha unidade ("12/26 sem"). O objetivo só se cumpre quando a previsão com nível alvo chega à primavera. A regra "ao chegar a primavera" sai: o objetivo passa a se cumprir ali só se não houve fome no inverno, senão se cumpre na colheita. Sem alvo 0/0.
  - Balão da casa: "Ao evoluir: +3 moradores · come mais".
  - A previsão é calculada uma vez por `refresh()`, junto com `eco`, e repassada à TopBar, aos painéis, aos avisos, ao inspetor e à GameScene (code-reviewer, item 8).
- **Arquivos:** `src/core/forecast.ts`, `houses.ts`, `goals.ts`, `src/data/goals.json`, `src/render/strings.ts`, `src/render/nova/TopBar.ts`, `Panels.ts`, `Inspector.ts`, `notices.ts`, `src/scenes/GameScene.ts`, `tests/forecast.test.ts`, `tests/goals.test.ts`, `docs/GAME_DESIGN.md`.
- **Aceite:**
  - Teste: construir um poço muda a previsão na hora, antes de a casa subir.
  - Teste: o objetivo 1 não se cumpre na semana 1 com uma caravana que vai passar fome.
  - Teste: `lastsToHarvest` concorda com `foodLastsToHarvest`, inclusive com `out === null`.
  - Teste de propriedade: a previsão e `stepWeek` dão a mesma semana de fome em combinações semeadas.

### 1.4 Pacote M de números, com `workerShare` 0,5
- **Origem:** sim-tester (propostas 1 e 2). O fun-critic pediu direções parecidas.
- **Por que agora:** é a única variação medida que dá o Ano 1 em 20/20 para o Comum e para o Eficiente.
- **Dados:**
  - `buildings.json`: casa 20 → 15, campo 30 → 20, poço 40 → 25, pescador e coletora 25 → 20, celeiro 60 → 40, mercado 80 → 60, oficina 70 → 50, jardim 50 → 35. O Templo fica 800.
  - `rules.json`: `upkeepStartsAfterGoal` 2 → 3, `workerShare` 0,4 → 0,5, `caravan.minFoodWeeks` 10 → 14, `caravan.maxFoodWeeks` 20 → 22, `baseFoodStorage` 40 → 50.
  - `houses.json`, comida por morador: barro 0,2 → 0,15, pedra 0,25 → 0,2, casa grande 0,3 → 0,22. A tenda fica 0,2.
- **Arquivos:** os três JSON, os testes que fixam números, `docs/GAME_DESIGN.md` (custos, regras, casas), a frase de abertura (o corte em 40 vira 50).
- **Aceite (sim-tester, `tools/sim/survival.ts`, 20 seeds, depois confirmado com 100):**
  - Comum e Eficiente sobrevivem ao Ano 1 em ≥ 95%.
  - Comum: mediana de ≤ 4 semanas de fome no Ano 1.
  - Eficiente: nenhuma dívida.
  - As seeds com caravana de 4 não ficam piores que as de 2.

### 1.5 Água só para casas com família e caravana compacta
- **Origem:** água: sim-tester, ui-designer, copywriter, playtester. Caravana: map-designer, playtester, fun-critic.
- **Por que agora:** são o bloqueio dominante das famílias (54% a 78%) e a causa das 33 em 33 fomes com 4 famílias.
- **Regras:**
  - A porta e o objetivo 2 contam só casas com família. Os terrenos vazios ficam de fora.
  - O objetivo 2 continua pedindo no mínimo 4 casas.
  - A caravana nasce num bloco compacto (2 x 2 tendas ao norte do anel), com um lugar livre de poço 2 x 2 ao lado que cobre todas. Com isso, 4 famílias pedem 1 poço.
- **Arquivos:** `src/core/families.ts`, `goals.ts`, `state.ts` (`caravanSpots`), `src/render/strings.ts` (`familyBlock.water`: "Nenhuma família vem: casa longe do poço. Construa outro poço"), `tests/families.test.ts`, `tests/survival.test.ts`, `docs/GAME_DESIGN.md`.
- **Aceite:**
  - Em 500 seeds existe um lugar de poço livre e ligável que cobre todas as tendas da caravana.
  - Teste: um terreno vazio sem água não fecha a porta.

### 1.6 Tutorial sem pressa
- **Origem:** playtester (itens 1 e 6), fun-critic.
- **Por que agora:** hoje o tutorial é a primeira causa de derrota de quem joga pela primeira vez.
- **Regras:**
  - O relógio fica parado nos passos de construir e volta a andar no passo de olhar a família chegando.
  - As ferramentas nunca travam: o tutorial só destaca.
  - Ordem: rua até a comida → pescador ou coletora → campo ("agora, no outono") → poço → casa → família chegando.
  - A rua fantasma (`ghostRoad`) leva ao lugar de pescador ou coletora com o melhor rendimento por célula de rua: o de maior rendimento entre os de ≥ 1,2/sem, e entre esses o de rua mais curta.
  - Sem o toast de bloqueio de família durante o tutorial.
- **Arquivos:** `src/core/tutorial.ts`, `src/data/tutorial.json`, `src/render/Tutorial.ts`, `src/scenes/GameScene.ts`, `src/render/strings.ts`, `tests/tutorial.test.ts`, `docs/GAME_DESIGN.md`, `docs/TESTING.md`.
- **Aceite:**
  - Testes: a fonte apontada pela rua fantasma rende ≥ 1,2/sem em ≥ 95% de 200 seeds, e o relógio não avança num passo de construir.
  - O bot do tutorial (sim-tester/playtester) perde ≤ 1 de 16 partidas no Ano 1.

### 1.7 Botões só disparam com o toque que começou neles
- **Origem:** playtester (item 10).
- **Por que agora:** terminar o arrasto da rua do tutorial pula o tutorial inteiro no celular.
- **Regra:** um botão só dispara quando o toque começou nele e não virou arrasto. Vale para todo widget da Nova.
- **Arquivos:** `src/render/ui.ts`, `src/render/nova/widgets.ts`.
- **Aceite:** um cenário visual novo, `drag-release-on-button`, arrasta uma rua até soltar sobre "Pular tutorial" e sobre a pausa, e nada dispara. Rodar no 844 x 390 e no 1366 x 768.

### 1.8 A comida prometida é a que chega
- **Origem:** ui-designer (1), copywriter (1), code-reviewer (3).
- **Por que agora:** a falta de trabalhadores é a armadilha mais escondida do Ano 1.
- **Regras:**
  - Uma função pura nova, `foodAfter(s, kind, x, y)`, em `readouts.ts`, que funciona como `balanceAfter`. Ela já conta as vagas novas e a eficiência que resulta delas.
  - O balão da coluna e o rótulo da prévia mostram "Comida depois: ±X/sem", em vermelho quando o valor é negativo.
  - "Rende N" passa a usar a eficiência.
  - No inspetor de pescador, coletora e campo com menos de 100% de trabalhadores: "Faltam trabalhadores: rende 67%".
  - Texto do campo: "Plante no outono: colhe na primavera. Usa 2 trabalhadores o ano todo."
- **Arquivos:** `src/core/readouts.ts`, `src/render/nova/NovaUi.ts` (`tagFor`), `BuildColumn.ts`, `Inspector.ts`, `src/render/strings.ts`, `tests/readouts.test.ts`.
- **Aceite:** um teste mostra que, com 2 tendas e um pescador, construir um campo dá "Comida depois" menor que antes. Captura `preview-food-after`.

### 1.9 Quando vem a colheita, e o campo plantado tarde
- **Origem:** ui-designer (3, 4 e 5), sprite-artist (1, versão simples), copywriter (6).
- **Por que agora:** o jogo gira em torno da primavera, e hoje nada na tela diz quando ela chega nem quais campos colhem.
- **Regras:**
  - Na pílula da estação, "Colheita em N sem". No celular, ícone de trigo e "N sem" no lugar do ano. Na primavera, "Colhendo · N sem". Usa `weeksToHarvest`.
  - Na pílula de comida:
    - na fome, "FOME" em vermelho piscando, no lugar de "0 sem";
    - colhendo com estoque ≥ 75%, "cheio" em laranja.
  - Prévia e inspetor do campo:
    - verde, "Colhe nesta primavera, em N sem";
    - laranja, "Colhe em N semanas: tarde para esta primavera".
  - Arte do campo arado que espera o ano seguinte: no máximo 1 lavrador, com enxada, e uma estaca com um feixe. A foice só aparece na colheita da primavera; a enxada nas outras estações.
- **Arquivos:** `src/render/nova/TopBar.ts`, `Panels.ts`, `BuildColumn.ts`, `NovaUi.ts`, `Inspector.ts`, `src/render/strings.ts`, `src/render/Fieldhands.ts`, `residents.ts`, `MapView.ts` (`paintCrop`), `docs/GAME_DESIGN.md`.
- **Aceite:**
  - Capturas `harvest-countdown` (outono e primavera) e `field-late` (prévia laranja, campo com estaca), no 844 x 390 e no PC.
  - A pílula da estação cabe em 844 sem corte.

### 1.10 Avisos e textos que dizem a ação certa
- **Origem:** copywriter (2, 3, 5, 7, 8, 9, 10), ui-designer (6, 7), playtester (11).
- **Regras:**
  - O aviso "a comida não chega à primavera/colheita" passa a valer em qualquer estação, não só no verão. O toast continua só no começo do verão.
  - Com o celeiro bloqueado, o aviso de estoque cheio diz "Estoque cheio (50): o excesso estraga. O celeiro libera no objetivo 3" (o `Alert` `spoiling` ganha `locked`).
  - Seca:
    - a pílula ganha "· Seca" em laranja;
    - aviso: "Ano seco: campos longe do rio colhem 40%. Construa pescador ou coletora".
  - Inverno:
    - toast: "Inverno: só pescador e coletora dão comida";
    - aviso: "O inverno está chegando: com fome, tendas são abandonadas. Guarde comida".
  - Fome: "Falta comida: construa pescador ou coletora".
  - Coletora: "Junta frutos das árvores".
  - Tela inicial: "Sem celeiro, só cabem 50 de comida".
  - Motivo `food` da porta: "a comida não dura até a primavera".
  - "plantar" em todo lugar, no lugar de "semear". "/sem" nos textos curtos.
- **Arquivos:** `src/core/alerts.ts`, `src/render/strings.ts`, `src/render/nova/TopBar.ts`, `uiArt.ts`, `tests/alerts.test.ts`, `docs/GAME_DESIGN.md`.
- **Aceite:**
  - Testes do aviso de comida no outono e no inverno, e do `spoiling` com `locked`.
  - O copywriter revisa as frases (todas com ≤ 75 caracteres).

### 1.11 Interface: toasts e pequenos cortes
- **Origem:** ui-designer (9, 10), playtester (12).
- **Regras:**
  - Com um painel aberto, os toasts esperam ou vão para baixo do painel. Na abertura, no máximo 1 toast por vez.
  - O rótulo da coluna diminui a fonte até caber (fim do "gua e comid").
  - `fmt(0.25)` passa a mostrar "0,25".
- **Arquivos:** `src/render/Toasts.ts`, `nova/NovaUi.ts`, `nova/notices.ts`, `nova/BuildColumn.ts`, `src/render/strings.ts` (ou onde mora o `fmt`).
- **Aceite:** capturas com Estatísticas aberto e um toast chegando, e a coluna do PC sem corte.

### 1.12 Medição e testes que pegam equilíbrio
- **Origem:** code-reviewer (2), test-reviewer, sim-tester, sprite-artist (9).
- **Por que agora:** este pacote é de números; sem medição confiável, voltamos ao "impossível" sem perceber.
- **Regras:**
  - `tools/sim/survival.ts` vira o simulador oficial (`npm run sim`). `tools/sim/bots.ts` mantém a correção do `WEEKS_PER_YEAR`, e os bots antigos que não conhecem a colheita saem.
  - `tools` entra no typecheck (no `tsconfig.json` ou num `tsconfig` próprio rodado no `build`).
  - Teste de viabilidade semeado, em `tests/viability.test.ts`: um plano mínimo (rua até a melhor comida, pescador ou coletora, campo no outono, poço e celeiro quando liberado) em 20 seeds. Ele não pode ter fome antes da semana 26, precisa cumprir os objetivos 1 a 3 no Ano 1 e não pode deixar a prata negativa.
  - Testes de invariantes: os 180 de prata pagam o kit mínimo, e 1 campo com o estoque base alimenta a caravana até a próxima primavera.
  - Os testes lentos (`survival`, `ghost road`, `map`) ganham um `testTimeout` maior.
  - `buildTown` dos cenários visuais passa a ter celeiro, pescador e coletora, e `seasons` deixa de usar `food = 1e4`.
- **Arquivos:** `tools/sim/*`, `package.json`, `tsconfig.json`, `tests/viability.test.ts`, `tests/*.test.ts`, `scripts/visual/run.mjs`, `docs/TESTING.md`.
- **Aceite:** `npm run sim` roda; o teste de viabilidade passa e falha se `harvest` virar 50 ou se o estoque base virar 10.

### Critérios de aceite do Pacote 1
- **sim-tester** (100 seeds por bot):
  - Comum e Eficiente sobrevivem ao Ano 1 em ≥ 95%, e o Comum tem mediana de ≤ 4 semanas de fome no Ano 1.
  - Eficiente: nenhuma dívida, vitórias ≥ 85%.
  - Comum: dívida no Ano 1 em ≤ 5%. Medir e relatar a dívida no Ano 2, que é alvo do P2.
  - Distraído: chega ao Ano 2 em ≥ 50% e pode perder depois.
  - Caravana de 4 famílias com resultado igual ou melhor que a de 2.
  - Nenhuma seed presa mais de 52 semanas num objetivo.
  - Medir e relatar a duração em minutos, que é alvo do P2.
- **playtester:** como quem nunca jogou, termina o tutorial e o Ano 1 sem perder família na fome. Isso vale no celular 844 x 390 e no PC. Ele também sabe dizer por que a família não vem.
- **fun-critic:** curva ≥ 5, vontade de jogar de novo ≥ 6 e clareza ≥ 7.
- `npm test`, `npx tsc --noEmit`, `npm run build` e `npm run test:visual` passam, e as capturas novas e as do tutorial foram olhadas.

### Estimativa do Pacote 1
| Bloco | Itens | Tempo |
|---|---|---|
| Regras do core com testes | 1.1, 1.2, 1.3, 1.5 | 4 a 5 h |
| Números e testes que fixam números | 1.4 | 1 h |
| Tutorial | 1.6 | 2 a 2,5 h |
| Toque | 1.7 | 45 min |
| Clareza da comida e da colheita, com a arte do campo | 1.8, 1.9 | 4 a 4,5 h |
| Textos, avisos e toasts | 1.10, 1.11 | 2 h |
| Simulador, viabilidade e cenários | 1.12 | 2,5 a 3 h |
| Docs, `test:visual`, olhar capturas | – | 1,5 h |
| sim-tester e playtester no final, mais uma rodada de ajuste de número se preciso | – | 1,5 a 2 h |

- **Total:** cerca de 20 a 22 h de trabalho de uma pessoa.
- **Numa sessão do Claude Code:** cerca de 6 a 8 h, contando os agentes em paralelo no final.
- **Maior risco de prazo:** o teste de viabilidade e uma segunda rodada de números, se o Comum ainda não fechar 95%.

## 5. Pacote 2 e Pacote 3

**Pacote 2 "Ano 2 em diante" (próximo).**
- **Mecânica nova (uma só):** "comida primeiro". Os trabalhadores preenchem primeiro as vagas de pescador, coletora e campo, depois o resto. Com isso, a fome deixa de derrubar a eficiência de toda a cidade, a espiral de vagas que leva o Comum à dívida no Ano 2 (13 em 20) acaba, e o aviso de poucos trabalhadores do copywriter ganha uma ação clara.
- **Duração:** com o pacote M a partida dura cerca de 3,5 min, e as metas 5 a 10 precisam de ajuste de alvo e de prêmio, medido pelo sim-tester. O Templo a 1200 sozinho só somou 9 semanas, então o tempo vem de metas que pedem anos inteiros (casas de pedra que dependem de celeiros e mercados).
  - Alvo intermediário: Comum vence em ≥ 8 min de simulação.
  - Os 15 a 25 min continuam vindo de conteúdo (P3).
- **Entram junto:**
  - a seca anunciada no começo do outono, a tempo de plantar junto ao rio;
  - a garantia no gerador de pescador e coletora cheios a até 8 células e 3 campos junto ao rio (map-designer);
  - o equilíbrio pescador × campo (o pescador quase dispensa o campo);
  - a tela de derrota com a causa ("A fome levou N famílias");
  - a arte que lê a sobrevivência: culturas maduras e secas, canal de irrigação, silhueta do celeiro cheio e vazio, rede do pescador, coletora própria, tendas de inverno;
  - a trava "casa só sobe com comida", e só se o playtest do P1 mostrar que o poço ainda é armadilha.

**Pacote 3 "Madeira" (depois).**
- **Mecânica nova:** madeira, o candidato 1 de `docs/design.md`: o bosque denso finalmente rende material para construir. É o primeiro conteúdo que alonga a partida sem metas gigantes.
- **Entram junto:**
  - o "Placar do inverno" (cartão com estrelas no fim de cada inverno, só interface sobre os marcos, ideia do fun-critic para dar vontade de jogar de novo);
  - o restante da arte de prioridade 2 e 3 do sprite-artist (eira, terraços, prensa, carregadores do pescador e da coletora, transição da seca);
  - a dívida técnica do code-reviewer: `newBuilding`, números do mapa no `rules.json`, cores no `palette.ts`, nomes das ferramentas no `strings.ts`, rota dos carregadores em cache;
  - a faixa de categorias do celular com nome.

## 6. Fora (não voltar na próxima revisão sem fato novo)
- **Celeiro liberado no início ou no Objetivo 1, e estoque 60 sozinho:** medido com efeito nulo.
- **Imposto ×2:** fica fácil e curto, e o M resolve o Ano 1 sem inflar a prata.
- **`startSilver` 300 e `winterFamineLeaveChance` 0,15:** medidos, ajudam pouco ou nada.
- **`debtWeeksToLose` 39:** em 2026-11-02, 36 não salvou ninguém; as derrotas vêm de espiral.
- **Manutenção do poço 3 → 2:** desnecessária com o pacote M.
- **Mexer na chance da seca:** medido quase sem efeito; o problema da seca é o momento do anúncio (P2), não a chance.
- **Alongar a partida só com o Templo mais caro:** medido; 1200 somou só 9 semanas.
- **Tutorial que trava ferramentas:** sai de vez. O tutorial só destaca.
- **Balão de "terreno sem água":** o terreno sai da regra, então o balão é desnecessário.
- **Trocar a ordem dos Objetivos 3 e 4 ("celeiro antes da primavera"):** pede prata que o Ano 1 não tem, e o efeito medido do celeiro cedo é nulo.

## 7. Prompt de implantação do Pacote 1
```
Implemente o Pacote 1 "Um Ano 1 justo" descrito em
docs/revisoes/2026-11-03/plano.md (seção 4, itens 1.1 a 1.12). Nenhuma
mecânica nova e nada de história. Os números são exatamente os do item 1.4.

Agentes:
- Implementação: você (agente principal) faz core, dados e testes.
- map-designer: caravana compacta com lugar de poço que cobre todas as
  tendas (1.5) e a rua fantasma até a melhor fonte de comida (1.6).
- ui-designer: pílulas, prévias, inspetor, toasts e o toque que só
  dispara no botão onde começou (1.7 a 1.9 e 1.11).
- sprite-artist: o campo que espera o ano seguinte (estaca, um lavrador
  com enxada) e a ferramenta do agricultor conforme a estação (1.9).
- copywriter: todas as frases do 1.3, 1.8, 1.9 e 1.10, em strings.ts e
  goals.json, com no máximo 75 caracteres.
- test-reviewer: confere os testes de 1.1, 1.2, 1.3, 1.5, 1.6, 1.8 e o
  teste de viabilidade (1.12); pode escrever testes faltando.
- code-reviewer: antes de terminar (arquitetura, strings, palette, previsão
  calculada uma vez por refresh).

Ordem:
1. Core e dados, com testes Vitest junto de cada regra: 1.1 (porta honesta,
   dispatch depois de s.week++, motivo storage), 1.2 (cidade vazia), 1.3
   (previsão com nível alvo, objetivo 1), 1.4 (pacote M), 1.5 (água só em
   casas com família, caravana compacta), 1.6 (tutorial: relógio parado nos
   passos de construir, ferramentas livres, nova ordem, rua fantasma),
   foodAfter (1.8), avisos (1.10).
2. tools/sim/survival.ts vira o npm run sim; tools no typecheck; teste de
   viabilidade e invariantes (1.12).
3. Render e interface (1.7 a 1.11). Cores em palette.ts, textos em
   strings.ts.
4. Docs no mesmo trabalho: docs/GAME_DESIGN.md (custos, regras, casas,
   famílias, objetivos, tutorial, previsão, avisos, toasts, tela inicial) e
   docs/TESTING.md (drag-release-on-button, preview-food-after,
   harvest-countdown, field-late, toasts com painel, buildTown com celeiro,
   pescador e coletora). docs/design.md fica para o game-director.
5. Rode npm test, npx tsc --noEmit, npm run build, npm run test:visual e
   npm run test:pwa; olhe as capturas novas e as do tutorial em 844x390 e
   1366x768.

No final rode, em paralelo:
- sim-tester (100 seeds por bot, com tools/sim/survival.ts): os critérios da
  seção 4 do plano (Ano 1 >= 95% para Comum e Eficiente, fome <= 4 semanas
  no Comum, Eficiente sem dívida, Distraído chega ao Ano 2 em >= 50%,
  caravana de 4 não pior que a de 2, ninguém preso > 52 semanas num
  objetivo, duração em minutos e dívida do Comum no Ano 2 relatadas). Se o
  Comum piorar com caravan 14-22 e baseFoodStorage 50, compare com o M +
  workerShare 0,5 puro e traga os dois.
- playtester: como quem nunca jogou, termina o tutorial e o Ano 1 sem perder
  família na fome, no 844x390 e no PC; diz por que a família não vem.
Traga os relatórios ao game-director. Qualquer número fora do item 1.4 só
entra com a aprovação dele.

Quando todos os testes passarem, o build estiver ok e o game-director
aprovar os relatórios: faça o commit do Pacote 1 e o push na main para
publicar no GitHub Pages (o workflow .github/workflows/deploy.yml publica a
cada push na main). Esta mensagem é a minha ordem para esse commit e esse
push. Confira que o deploy terminou e que o jogo abre no endereço do Pages.
```

# Pacote 3 "Madeira e pedra": interface (ui-designer, 2026-11-04)

Trabalho na worktree `jerusalem-antiga-p3` (branch p3), sem commit. Capturas olhadas em 844 x 390,
915 x 412 e 1366 x 768.

## O que entrou

1. **Pílula Materiais** (`nova/TopBar.ts`), entre Comida e Moradores.
   - Celular: uma pílula com o ícone da tora + número; o ícone da pedra + número só depois de
     liberar a Pedreira. PC: uma pílula por material, "Madeira 20 +1,5/sem" (Pedra idem, também só
     depois da Pedreira, como pede a decisão "a pedra só aparece quando serve").
   - Vermelho **com "⚠"** enquanto há casa esperando aquele material (nunca só cor). A pedra entra
     com um brilho dourado (3 piscadas). Tocar abre Estatísticas.
   - Não cabe: as pílulas encurtam por etapas (`MAX_FIT`): rótulos dos materiais, depois todos os
     rótulos, depois o "+N/sem" dos materiais. Em 1366 x 768 com a pedra, a 1ª etapa basta.
   - Celular: padding das pílulas 0,38 → 0,30 da altura, para a estação continuar na 1ª linha em
     844 x 390 (sem isso a barra crescia 27 px e o passo 2 do tutorial falhava no teste).
   - `Pill` ganhou partes `{ icon }` (ícones no meio do texto).
2. **Coluna:** Lenhador e Pedreira em Trabalho (vinha do core); botão cinza e preço vermelho também
   quando falta material (`missingMaterial`).
3. **Balão da construção escolhida:** linha de custo "40 prata · 10 madeira", cada parte que falta
   em vermelho com o que a cidade tem ("10 madeira (tem 4)"); manutenção numa linha própria
   (`Line.parts` novo em `Balloon.ts`). **Prévia no mapa:** Lenhador/Pedreira "Rende N
   madeira/sem", Lenhador "Corta 1 árvore a cada N sem", "Divide o bosque com a Coletora"
   (`sharedTrees`); Coletora "Divide o bosque com o Lenhador". "Comida depois" no Lenhador e na
   Pedreira só quando as vagas baixam a comida. Fora da rua: "Sem rua ao lado: não rende nada"
   (antes dizia "Rende 0").
4. **Toast** "Falta madeira: construa um lenhador" / "Falta pedra: construa uma pedreira" ao
   construir sem material (uma vez por arrasto, como a prata).
5. **Casa tocada:** esperando material, as exigências (todas ✓) saem e entra a linha vermelha
   "Pronta para virar Casa de pedra: falta 7 de pedra" no lugar do contador (o core mostra 1);
   ação dourada "Onde pôr uma pedreira/um lenhador", que acende os lugares ligados à rua que rendem
   ≥ 75% do melhor (sem nenhum: "Nenhum lugar com rochas junto à rua: leve uma rua até as rochas").
   Contando: "Ao evoluir: pede 10 de pedra". Toco tocado: "Toco · vira árvore de novo em N sem. Dá
   para construir em cima". Lenhador tocado: "Corta 1 árvore a cada N sem".
6. **Estatísticas:** seção Materiais (estoque · +N/sem, "Casas esperando pedra ⚠ N", tocos).
7. **Toasts:** a 1ª casa esperando dispara o aviso `material` (toast + Avisos); ao liberar,
   "Objetivo cumprido! … · Nova construção: Pedreira" e "Pedreira liberada: tira pedra das rochas
   para casas de pedra e o Templo". Caravana: "… comida para N semanas e 20 de madeira".
8. **Tutorial, passo `lumber`:** câmera no `lumberSpot`; se o lugar pede rua, a rua aparece marcada,
   o balão diz "Casas pedem madeira: puxe a rua marcada e ponha um lenhador no fim" e a seta aponta
   Rua e depois a rua; com a rua pronta, Lenhador e o lugar. No PC a seta para acima da pílula da
   prévia (antes cobria o "Rende N…", também no passo do pescador).
9. Textos novos em `strings.ts` (≤ 75 caracteres, números dos dados); `T.nova.price` saiu.
10. **Testes visuais:** `materials`, `materials-wide`, `materials-pc`, `lumber-shared`,
    `lumber-shared-pc`; `tutorial`/`tutorial-pc` com o passo do Lenhador. `VISUAL_OUT` novo no
    runner (outra pasta de capturas: o sprite-artist e eu apagávamos as capturas um do outro).
    `TESTING.md` e `GAME_DESIGN.md` atualizados.

## Verificação
- `npx tsc --noEmit` e `npx vitest run` (1168 testes) passam.
- `test:visual` completo na porta 5399: 7 cenários falharam na 1ª rodada e passaram depois de
  corrigidos e rodados de novo: `victory` (o templo agora pede 300 pedra + 150 madeira: o cenário
  não dava material), `input-pc` (a tecla 5 agora escolhe primeiro o Lenhador), `tutorial` (o
  passo do Lenhador e esperas pelo texto certo da prévia), os 3 `materials` (asserção minha) e
  `families-arrive` (lento com a máquina carregada; passou sozinho). A máquina estava com carga
  ~20 (outros agentes), então há tempos longos.
- Ícones: uso `TEX.icon('wood')` e `TEX.icon('stone')`, já criados pelo sprite-artist.

## Arquivos
`src/render/nova/TopBar.ts`, `BuildColumn.ts`, `Balloon.ts`, `Inspector.ts`, `NovaUi.ts`,
`Panels.ts`, `src/render/strings.ts`, `src/render/layout.ts` (comentário), `src/scenes/GameScene.ts`,
`src/scenes/UIScene.ts`, `scripts/visual/run.mjs`, `docs/GAME_DESIGN.md`, `docs/TESTING.md`.

## Pendências e sugestões (em ordem de impacto)
1. **Balão no mapa sobre a casa esperando** (ícone da tora/pedra, como o de "falta mercado"):
   hoje o sinal contínuo é a pílula vermelha com ⚠ e os Avisos; no mapa a casa não mostra nada.
   Arquivo: `MapView.ts` (sprite-artist).
2. **`gatherSpots` para o core** (`GameScene.ts` → `readouts.ts`): a escolha dos lugares do
   "Onde pôr um lenhador" é leitura de regra; deveria ser `bestGatherSpots(s, kind)` com teste.
3. **Gasto no ano e árvores cortadas no total** nas Estatísticas: o core não guarda (só `stumps`).
   Arquivo: `src/core` + `Panels.ts`.
4. **Toast que já estava na tela continua sob o balão da casa tocada** (pré-existente: só os novos
   esperam). Arquivo: `Toasts.ts`.
5. Copywriter: revisar "Pronta para virar … : falta N de …" (2 linhas no celular) e
   "Sem rua ao lado: não rende nada".

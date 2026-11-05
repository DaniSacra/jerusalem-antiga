# Playtester — madeira e pedra, limite de toasts e botão 3D (commit 8534702)

Testado em uma cópia congelada do commit 8534702 (`git archive`), porque outros agentes estavam
mudando `src/core` durante o teste (o Vite recarregou a página no meio). Vite próprio na porta 5191,
Playwright em 844x390 com toque (CDP) e em 1366x768 com mouse, além de simulação sem interface.

## Invariantes da simulação: ok
4 bots x 8 seeds x 400 semanas (32 partidas), checadas toda semana. Nenhuma falha: madeira, pedra e comida
nunca negativas; `feature === 'stump'` igual à lista `stumps`; nenhum toco, árvore ou rocha sob prédio ou rua;
`waiting` só em casa com moradores e contagem cheia (e só quando falta de verdade); `cutProgress` limitado;
metas nunca voltam; altar sempre presente. Casos extremos: Lenhador sem rua não corta nem rende; rua e
prédio sobre toco aceitos (o toco some); Demolir em toco recusa ("invalid"); casa sem madeira recusa
("materials"); toco volta a ser árvore depois de `treeRegrowWeeks`. Nenhum erro de console nos dois aparelhos.

## Bugs e confusão (do mais grave ao menos grave)
1. **[Médio] A visão 3D abre sempre centrada no altar com o mesmo giro e ignora o giro e a câmera do 2D.**
   Passos: no PC, gire o mapa (Q), afaste-se do altar e toque em 3D. Esperado: ver o mesmo lugar e o mesmo
   lado. Visto: a cidade aparece girada uns 90° (a rua que no 2D desce para a esquerda desce para a direita)
   e centrada no altar (`yaw` -0,785 com qualquer giro do 2D). O jogador se perde. Arquivos:
   `src/render3d/view.ts` (~linha 120: `centre` = altar, `rig.set({ dist: 30 })`), `src/scenes/GameScene.ts:652`.
   Correção: passar em `Launch3D` a célula no centro da câmera 2D e `iso.getRotation()`; usar como foco e
   `yaw = giro * π/2 + deslocamento` para o 3D começar igual ao 2D.
2. **[Baixo] "Melhorar" sem pedra esconde quanto falta.** Com pedra 0, o botão do Mercado mostra só
   "Falta pedra: construa uma pedreira" e some o "20 pedra". `src/render/nova/Inspector.ts:143` e
   `src/scenes/GameScene.ts:519`. Correção: "Falta pedra: 20 (você tem 0)".
3. **[Baixo] O aviso manda construir lenhador mesmo quando já existe um.** "1 casa esperando madeira:
   construa um lenhador" aparece com Lenhador funcionando. `src/render/strings.ts:142` e `:125`.
   Correção: com produção > 0, "1 casa esperando madeira: chega 0,5/sem" (ou "faça mais um lenhador").
4. **[Baixo] A tela inicial não fala de madeira.** O item 2 diz "Tendas perto de uma praça viram casas de
   barro", mas agora elas também pedem 5 de madeira; a casa custa 10. Correção (copywriter): "...viram
   casas de barro (pedem madeira: faça um lenhador)".
5. **[Baixo] Cortar árvore com Demolir custa 5 de prata e não dá madeira.** Um jogador novo, num jogo com
   madeira, espera ganhar madeira. Correção: dica "Cortar árvore · 5 prata (não dá madeira; o lenhador corta
   sozinho)" em `cutTree`/`tree` de `strings.ts`.
6. **[Baixo] O 3D abre por cima do painel de Estatísticas aberto** (não há proteção; só `modalOpen`). Ao
   voltar, o painel ainda está lá. Sem dano, mas fica estranho. Correção: fechar painéis e balões em
   `open3D()` (`GameScene.ts:652`).
7. **[Info] Toque duplo rápido no 3D abre uma visão só** (a trava `busy` funciona); 6 aberturas seguidas
   (Voltar, Esc e `close`) sempre deixam 1 canvas, velocidade restaurada (3x→3x, pausa→pausa), laço
   acordado, ferramenta ativa mantida; Espaço e 2 não chegam ao 2D com o 3D aberto; o relógio fica parado.
   Arrastar, pinça e roda funcionam. Girar o aparelho com o 3D aberto ajusta o canvas sem erro.

## Limite de toasts depois dos balões: ok
3 na tela, o resto na fila (más notícias na frente). Com balão aberto, nenhum aparece; ao fechar, volta só o
aviso mais importante que ainda vale ("1 casa esperando madeira..."); notícias antigas somem, como projetado.

## Controles
- Celular 844x390: botão 3D de 66 px na coluna esquerda, com folga acima de Mover; "Voltar" 112x52 no canto
  superior esquerdo e setas de giro 52x52 embaixo à direita, sem cortes. O aviso "Qualidade reduzida..."
  aparece cedo em aparelhos fracos (no navegador sem GPU caiu para "min" em ~5 s), sem cobrir botões.
- PC 1366x768: Esc fecha o 3D; o Esc seguinte no 2D não faz nada estranho.
- Balão de casa esperando madeira lê bem nos dois tamanhos ("Pronta para virar Casa de barro: falta 5 de
  madeira"); o balão do toco ("vira árvore de novo em 50 sem. Dá para construir em cima") também.

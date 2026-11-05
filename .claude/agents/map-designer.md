---
name: map-designer
description: Cuida da geração do mapa e do layout inicial. Use ao mexer em terreno, rio, rochas, vegetação, altar inicial, rua inicial ou entrada da cidade.
tools: Read, Grep, Glob, Bash, Write, Edit
---
Você desenha o mapa do jogo (grade lógica 48 x 48 em src/core, desenhada em 3D no
`src/render3d/terrain.ts`: relevo suave, rio e vegetação; a grade lógica continua plana e quadrada).
Os números atuais ficam em src/data (rules.json > map e buildings.json);
confira lá antes de mudar qualquer coisa.

JOGO EM 3D (migração concluída em 2026-11-05)
- A cidade é Three.js (`src/render3d`) e a interface é HTML/CSS por cima do canvas (`src/ui`), para
  celular deitado e PC por igual. Arquitetura: `docs/arquitetura-3d.md` (agente `architect`).
- O 2D em Phaser foi removido; o último código dele está na tag `ultimo-2d` (só para consulta).
- `src/core` e `src/data` guardam regras e números, puros (sem Three.js, sem DOM). Lógica pura de
  tela fica em `src/game`; textos da tela em `src/game/strings.ts`, cores em `src/game/palette.ts`.

Garanta em todo mapa gerado:
- Altar 4 x 4 no centro (canto em 22,22) com 9 células livres a partir da
  borda dele.
- Rua inicial na coluna 24, do altar até a borda sul (entrada em 24,47),
  sem obstáculos; entrada da cidade bem visível.
- Rio na borda leste, contínuo e com curvas naturais.
- Vegetação em bosques: oliveiras, figueiras e palmeiras agrupadas, com
  clareiras entre os grupos, emoldurando a área de construção. Evitar
  árvores espalhadas por igual.
- Rochas também agrupadas, formando cantos interessantes sem bloquear a
  expansão da cidade.
- Pelo menos 3 posições válidas para o templo 6 x 6 a até 12 células da
  borda do altar, sem precisar cortar árvores.
- Espaço para campos afastados do centro.
- Geração por seed, para reproduzir mapas em testes.
Valide com testes em src/core (raio livre, rua sem obstáculo, rio
contínuo, espaço para o templo) e descreva o resultado em poucas linhas.
PROCESSOS LONGOS (para não travar)
- Nunca espere um processo com `pgrep -f`/`pkill -f` em laço: o comando acha a si mesmo e a espera
  nunca termina. Rode em primeiro plano com `timeout` (ex.: `timeout 900 npm run sim -- ...`) ou
  espere pelo PID (`cmd & pid=$!; wait $pid`).
- Testes visuais: use `VISUAL_PORT` e `VISUAL_OUT` próprios (outro agente pode estar rodando) e
  `timeout 1500`. Uma falha só por tempo com a máquina carregada: rode o cenário de novo sozinho.
- Salve o relatório aos poucos, a cada etapa, para não perder tudo se algo travar.

Nunca faça commit nem push.

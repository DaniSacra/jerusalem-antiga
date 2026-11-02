---
description: Roda todos os agentes de avaliação, salva os relatórios do dia e pede ao game-director um plano de implantação
argument-hint: [foco opcional, ex.: dificuldade, arte das casas, celular]
---
Faça uma revisão completa do jogo, sem alterar código, dados ou arte.

FOCO DESTA REVISÃO: $ARGUMENTS
(se estiver vazio, a revisão é geral)

PASSO 1: PREPARAR
- Descubra a data de hoje com `date +%F`.
- A pasta da revisão é docs/revisoes/<data>/. Se já existir, use
  docs/revisoes/<data>-2/ (ou -3, -4...).
- Leia docs/design.md e o plano.md da revisão anterior mais recente, se
  existir, para saber o que já foi decidido e implantado.
- Rode testes e build uma vez e anote o resultado.

PASSO 2: RODAR OS AGENTES EM PARALELO
Chame os agentes abaixo ao mesmo tempo. Diga a cada um: o foco desta
revisão, que é uma revisão somente leitura (não podem editar, criar ou
apagar arquivos do projeto, nem fazer commit) e que devem devolver o
relatório no formato do próprio agente.
- playtester: bugs, confusão e controles
- sim-tester: duração da partida, equilíbrio e dificuldade (pode criar
  scripts temporários apenas fora do projeto ou em tools/sim, sem
  alterar src)
- fun-critic: diversão, desafio e vontade de jogar de novo
- ui-designer: interface, legibilidade e controles no celular e no PC
- sprite-artist: qualidade e variedade da arte, legibilidade no zoom
  mínimo, o que mais melhoraria a beleza da cidade
- map-designer: qualidade dos mapas gerados em 5 seeds
- copywriter: clareza e consistência dos textos da tela
- code-reviewer: qualidade do código
- test-reviewer: cobertura e qualidade dos testes de src/core

PASSO 3: SALVAR OS RELATÓRIOS
Salve o relatório devolvido por cada agente, sem resumir, em
docs/revisoes/<data>/<nome-do-agente>.md, com um cabeçalho:
"# <nome-do-agente> - <data>" e "Foco: <foco ou geral>".
Se algum agente falhar, salve o arquivo explicando o erro e continue.

PASSO 4: PLANO DO GAME-DIRECTOR
Chame o game-director, peça que leia todos os arquivos da pasta da
revisão, o docs/design.md e o plano anterior, e que escreva
docs/revisoes/<data>/plano.md com:

1. Resumo em 5 linhas: como o jogo está hoje
2. Consensos: o que dois ou mais agentes apontaram
3. Conflitos: onde os agentes discordam e a decisão tomada, com motivo
4. Pacote 1 (implantar agora): no máximo UMA mecânica nova, mais ajustes
   de equilíbrio, interface, arte e correções de bugs. Para cada item:
   - origem (quais agentes)
   - por que entra agora
   - arquivos e dados afetados
   - critério de aceite (como saber que ficou bom)
5. Pacote 2 (próximo) e Pacote 3 (depois), com um parágrafo cada
6. Fora: sugestões rejeitadas e o motivo, para não voltarem na próxima
   revisão
7. Prompt de implantação do Pacote 1: texto pronto para eu colar no
   Claude Code, incluindo quais agentes usar e rodar o sim-tester e o
   playtester no final
Respeite os pilares: simples, cidade viva, diversão em posicionar bem,
só mecânica sem história, uma mecânica nova por vez.

PASSO 5: ENTREGAR
- Faça um commit apenas da pasta docs/revisoes/<data>/ com a mensagem
  "Add game review <data>".
- Mostre para mim: o resumo, a lista do Pacote 1 e o caminho do plano.
- NÃO implemente nada. Pergunte se eu aprovo o Pacote 1.
- Só depois da minha aprovação, o game-director atualiza docs/design.md
  com as decisões tomadas.

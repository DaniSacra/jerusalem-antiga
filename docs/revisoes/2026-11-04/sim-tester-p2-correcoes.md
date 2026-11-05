# sim-tester · P2 correções (e1e42b3), rodadas R0, R1 e R2

- **Comando:** `npm run sim -- --bots <bot> --seeds 100 --weeks 700` com `--brief`, `--json` e o
  relatório completo do Comum. São 4 bots × 100 seeds por rodada, no main e sem worktree.
- **Rodadas** (números só em memória, por `--set`):
  - R0: estado atual;
  - R1: `rules.drought.harvestFactor=0.25`;
  - R2: R1 + `rules.familyFoodReserveWeeks=1`.
- **Conferência extra:** Comum com 200 seeds na R1 e na R2, porque a R2 ficou no limite do C2.
- **Tutorial (T):** bot próprio no scratchpad.
  - Segue os passos à risca: rua fantasma, `foodSpot`, `fieldHint`, praça para a tenda, `houseHint`.
  - No passo da família, segue a seta (`reasonTool`: celeiro em `storage`, campo em `food`).
  - Depois disso, joga como o Comum (e como o Distraído) até a semana 52.
- **Tempo real:** 3,2 s por semana.
- **Ruído:** com 100 seeds, uma taxa varia cerca de ±5 pontos de uma rodada para outra.
- **Comum da R0 igual ao P2:** o resultado bate semente por semente com o do relatório anterior (46%,
  semana 513). As correções não mudaram o jogo do Comum.

## Tabela R0 / R1 / R2 (Comum, salvo indicação)

| # | Alvo | R0 | R1 (seca 0,25) | R2 (+ reserva 1) |
|---|---|---|---|---|
| B | casas com família na sem. 52: 6–10 | 9 | 9 | 9 |
| G | vitória 30–50%, mediana sem. 469–656 (25–35 min) | 46%, sem. 513 (27,4 min) | **49%, sem. 522 (27,8 min)** | 49%, sem. 529 (28,2 min) |
| C1 | derrotas ≤ 5 | 0 | 1 | 1 |
| C2 | fome em ≥ 1 inverno: 25–60% | **11%** ❌ | **28%** ✅ | **21%** ❌ |
| I | sobrevive ao Ano 1 (Comum / Eficiente) ≥ 95% | 100 / 100 | 100 / 100 | 100 / 100 |
| D | Distraído: derrotas antes da sem. 150 = 0 | 0 | 0 | 0 |
| | Distraído: derrotas no total (≤ 19) | 4 | 5 | **15** |
| E | oficinas ao mesmo tempo ≤ 4 | 3 | 3 | 3 |
| F | prata > 300 por > 26 sem. antes do templo ≤ 9 (alvo ≤ 5) | 3 | 4 | 7 |
| H | nenhuma abertura melhor em tudo | ok | ok | ok |
| T | tutorial: 0 de 16 perdem no Ano 1 | 0/16 (0/60) | 0/16 (0/60) | 0/16 (0/60) |
| | passo da família ≤ 8 sem. | máx. 8; 16/60 terminam por tempo | igual | igual |
| | tutorial com bloqueio `storage` no passo da família | 34/60 (mediana de 2 sem.) | 34/60 | **22/60** |
| | fome no inverno do Ano 1 (alvo da R2: > 0 e ≤ 25%) | 0% | 0% | **0%** |
| J1 | semanas do objetivo 5 ao 6 ≥ 13 | 15 | 15 | 14 |
| J2 | objetivos no mesmo ano ≤ 3 | 3 | 3 | 3 |
| J3 | maior espera (P1: 324) | 302 | 293 | 282 |
| M1 | árvores e rochas ≥ +40% | 246 (+53%) | 246 | 246 |
| M2 | 6x6 livre a ≤ 1 célula da rede ao liberar o templo ≥ 95% | **34%** ❌ | **36%** ❌ | **37%** ❌ |
| – | Eficiente vence ≥ Comum | **72%** ≥ 46% ✅ | 75% ≥ 49% ✅ | 73% ≥ 49% ✅ |

**Outros bots (vitórias / derrotas / fome no inverno)**

| Bot | R0 | R1 | R2 |
|---|---|---|---|
| Eficiente | 72% / 0 / 0%, sem. 423 (22,6 min) | 75% / 0 / 0%, sem. 424 | 73% / 0 / 0%, sem. 421 |
| Pescador | 4% / 0 / 60% | 4% / 0 / 60% (sem campos: a seca não pega) | **23%** / 0 / 42% |
| Distraído | 33% / 4 / 100%, sem. 620 (33,1 min) | 27% / 5 / 100%, sem. 612 | 32% / 15 / 100%, sem. 587 |

**Conferência com 200 seeds (Comum):**

| Rodada | Seeds | C2 | Vitórias | Semana | Derrotas |
|---|---|---|---|---|---|
| R1 | 1–100 | 28% | 49% | 522 | 1 |
| R1 | 101–200 | 30% | 36% | 490 | 4 |
| R1 | 1–200 | **29%** | **42,5%** | 506 (27,0 min) | 5 |
| R2 | 1–100 | 21% | 49% | 529 | 1 |
| R2 | 101–200 | 34% | 43% | 455 | 2 |
| R2 | 1–200 | **27,5%** | **46%** | 483 (25,8 min) | 3 |

## Decisão: linha de base = R1

- **R0** passa no que lhe cabia. Nada da 6.1 piora: o Comum fica idêntico ao P2, o Distraído tem 4
  derrotas (≤ 19), o T fica em 0 de 16 e o passo da família dura no máximo 8 semanas. O C2 continua
  em 11%, como esperado.
- **R1 passa.** C2 28% (29% em 200 seeds), G 49% na semana 522, C1 1, I 100%, D 0. O Eficiente
  vence mais que o Comum, e nada da 6.1 piora.
- **R2 não passa** no protocolo de 100 seeds: o C2 cai para 21%. Com 200 seeds chega a 27,5%, no
  limite de 25%, dentro do ruído. Mesmo assim fica de fora por quatro motivos:
  1. **Não cumpre o motivo dela.** A fome no inverno do Ano 1 continua 0% no Comum, e também no
     bot do tutorial (0 de 60). A reserva de 1 semana não leva o inverno do Ano 1 ao limite.
  2. **Ela tira a fome do inverno e põe fora dele.** Semanas de fome por partida: mediana 0 → 5.
     Crises: 41% → 58%. Fome em anos secos: mediana 0 → 5 semanas. Fome em pelo menos 1 inverno:
     28% → 21%. Chegam mais famílias, e a fome vem na seca da primavera e do verão, não no inverno.
  3. As derrotas do Distraído quase triplicam: 5 → 15. Ainda ficam dentro de ≤ 19, mas perto do
     limite.
  4. O bloqueio `storage` no tutorial cai de 34 para 22 em 60, mas o passo já termina em 8 semanas
     de qualquer jeito.
- Pela regra do plano ("Se falhar, volta para 2"), a reserva fica em 2.

**Aplicado:**
- `src/data/rules.json`: `drought.harvestFactor` 0,4 → **0,25**.
- `tests/survival.test.ts:238`: o valor fixo esperado passou de 0.4 para 0.25.
- `docs/GAME_DESIGN.md`: "× 0,25" e "colhem 25%" no aviso.
- `docs/TESTING.md`: "× 0,25".

O texto do aviso em `strings.ts` já lê o número do JSON. `npx vitest run`: 1144 testes passam.
Nada foi commitado.

**Atenção à leitura literal da regra:** o M2 falha nas três rodadas e não depende de nenhum dos dois
números (34/36/37%, puro ruído). Por isso não serve para escolher entre as rodadas. Usei os critérios
"fica se" da seção 3 do plano, mais os extras do pedido. Se a game-director quiser o M2 como critério
de rodada, nenhuma passa, e é só desfazer a linha 19 do `rules.json` e as três linhas de documentação
e teste.

## M2: por que 99% no meu relatório, 40% no do implementador e 34% aqui

**O erro foi da métrica, e foi meu.** O "6x6 sem árvores a ≤ 1 rua" do `sim-tester-p2.md`, que deu
99%, media a distância de Chebyshev entre o 6x6 livre e qualquer rua da rede, com limite de 2. Essa
conta tem dois furos:
- aceita rua na diagonal do canto. A célula do canto não é vizinha, então ligar exige 2 ou mais
  ruas;
- não confere se a célula do meio está livre. Muitas vezes ela é uma casa.

A métrica certa é a do core, `templeSpotsNear` com `templeSpotRoadGap` 1. Ela exige uma célula livre,
de lado, a 1 passo da rede, e dá 34% no Comum com 100 seeds. Os 40% do implementador vieram de 20
seeds; com 100 a diferença é ruído. O bot do Comum não mudou: a R0 bate semente por semente com o
P2. O jogo também não mudou nesse ponto.

**O que existe de fato quando o templo é liberado (R0, 100 seeds):**

| Bot | Pronto (encosta) | ≤ 1 célula (M2) | ≤ 2 | ≤ 3 | ≤ 6 | Nenhum 6x6 livre alcançável por terra livre | Métrica antiga (Chebyshev) |
|---|---|---|---|---|---|---|---|
| Comum | 26% | **34%** | 50% | 57% | 72% | 10% | 99% |
| Eficiente | 77% | **79%** (71/90) | 81% | 84% | 90% | 8% | 90% |
| Pescador | 74% | **81%** | 87% | 90% | 96% | 1% | 100% |
| Distraído | 29% | **37%** | 51% | 63% | 79% | 7% | 98% |

**Fica pior com o tempo.** O Comum leva 330 semanas (mediana) entre liberar o templo e construí-lo:
junta 800 de prata e espera o Ano 8. Nesse tempo a cidade cresce por cima dos bolsões. Fiz a mesma
medida em dois momentos, com R1 e 100 seeds:

| Momento (Comum) | Pronto | ≤ 1 | ≤ 2 | ≤ 3 | ≤ 6 | ≤ 12 |
|---|---|---|---|---|---|---|
| 1ª semana com 800 de prata, templo liberado (52 partidas) | 4% | **8%** | 13% | 21% | 42% | 60% |
| objetivo 9 cumprido, sem templo (95 partidas) | 13% | **19%** | 32% | 39% | 55% | 74% |

**Conclusão:** a métrica explica a diferença entre 99% e 34–40%. Por trás dos 34% estão o bot e o
jogo juntos:
- **O bot:** o Comum faz ruas de 6 em 6 células e enche de casas.
- **O jogo:**
  - nada pede ao jogador que guarde um 6x6;
  - as áreas amarelas só aparecem a ≤ 1 célula da rede;
  - quando o jogador tem prata para o templo, quase nunca sobra uma área assim (8%).

Nenhum número em `src/data` leva o M2 a 95%: nem `templeSpotRoadGap` 12 chega lá (60% e 74%). O
Comum sempre acaba construindo o templo, porque o bot demole. Mas um jogador real, na hora de
construir, não vê área nenhuma em 9 de cada 10 partidas e recebe o toast antigo.

**Para a game-director decidir (P3, nada aplicado):**
1. Trazer de volta o 3c: rua fantasma até o 6x6 livre mais perto, mesmo longe, ou um "Onde pôr o
   Templo" que aponte o lugar que pede menos demolição. Isso cobre os 100%.
2. Mostrar o contorno do 6x6 livre desde o objetivo 8, que é o que o Eficiente faz e lhe dá 79%.
   Assim o jogador guarda o lugar antes de o perder.
3. `templeSpotRoadGap` 1 → 6 sozinho dá só 72% ao liberar e 42% na hora da prata. Não recomendo
   como solução.
4. Manter o M2 como está no plano é medir uma coisa que o jogo atual não garante. Proposta de
   critério: "existe área verde ou amarela na semana em que o jogador tem 800 de prata", hoje 8%,
   com alvo a definir depois da escolha entre 1 e 2.

## Outros achados

- **A fome no inverno do Ano 1 é 0% no Comum** nas três rodadas, como no P1 e no P2. O Distraído
  passa fome em 100% das partidas no Ano 1 (mediana de 5 semanas) e se recupera em 98–99%. Nenhum
  dos dois números mexe no Ano 1:
  - a seca nunca cai nos Anos 1 e 2;
  - a reserva 1 não aperta o primeiro inverno.

  Se a intenção é ter medo no primeiro inverno, as alavancas candidatas são a caravana (`foodWeeks`)
  ou o `winter.tentFoodFactor`. Elas ficam para outra rodada.
- **A seca a 0,25 morde onde devia:** na R1, a fome do Comum aparece do Ano 4 em diante, quase
  sempre depois de uma seca. Crises: 8% → 41%. Recuperação: 5% → 34% das partidas. A prata parada
  não volta (F 4).
- **Prata parada do Eficiente:** F 17 na R0 (8 no P2). Ele agora guarda 800 para o templo a partir
  do objetivo 8, e a reserva conta como "prata > 300". Isso é efeito do bot (2.8), não excesso de
  prata. O F da 6.1 vale para o Comum.
- **Pescador:** a R1 não muda nada nele, porque não tem campos. A R2 sobe a vitória dele de 4% para
  23%. A reserva menor deixa crescer quem vive de pesca.
- **Aberturas (H, R1):**

  | Famílias | Vitórias | Semana | Casas na sem. 52 |
  |---|---|---|---|
  | 2 | 21/38 | 518 | 8 |
  | 3 | 12/27 | 543 | 9 |
  | 4 | 16/35 | 476 | 10 |

  Nenhuma abertura ganha em tudo.
- **Objetivos do Comum na R1 (semana mediana / minuto a 1x):**

  | Objetivo | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | Templo |
  |---|---|---|---|---|---|---|---|---|---|---|
  | Semana | 1 | 15 | 67 | 80 | 130 | 151 | 172 | 174 | 368 | 522 |
  | Minuto | 0,1 | 0,8 | 3,6 | 4,3 | 6,9 | 8,1 | 9,2 | 9,3 | 19,6 | 27,8 |

  Do objetivo 9 até a vitória são 98 semanas (mediana), abaixo da alavanca de 100 do P3. Os
  objetivos 7 e 8 continuam em dupla (2 semanas), como já previa a alavanca J3 do P3.

## Arquivos

- Alterados (sem commit): `src/data/rules.json`, `tests/survival.test.ts`, `docs/GAME_DESIGN.md`,
  `docs/TESTING.md`.
- Scripts e saídas em `/tmp/claude-1000/-home-dani-projects-jerusalem-antiga/37d9aff3-8951-436f-909e-2afc3836bcab/scratchpad/p2c/`:
  - `rounds.sh`: as rodadas;
  - `an.mjs`: análise do JSON;
  - `m2.ts` e `m2b.ts`: diagnóstico do M2;
  - `tut.ts`: bot do tutorial;
  - `R0/`, `R1/`, `R2/`, `X1/`, `X2/`: saídas.

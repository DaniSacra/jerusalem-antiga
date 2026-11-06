# Sim-tester — Pacote B3 "O frio pesa" (2026-11-06)

Base: commit 8a8d5ad (B2 + P1 + P2 + B3 + P3 + manutenção pela metade). 1000 semanas, 1 semana = 3,2 s em 1x.
Comum, plano, tutorial e Distraído com 100 seeds; Eficiente e Pescador com 20. Nada mudou em `src/`; só
`tools/sim/survival.ts` e `tools/sim/run.ts`. Alavancas medidas com `--set`, uma por rodada.

## 0. O que mudou nos bots e nas medidas
- Bots: o `trim` (demolir na dívida) usa a manutenção paga (`upkeepPaid`) e dá valor 0 ao local vazio; o
  `affords` do planejador conta metade da manutenção do local novo quando ninguém está livre. O Comum tem prata
  sobrando o tempo todo: com `emptyUpkeepFactor` 0 o resultado dele é igual, dígito a dígito.
- Medidas novas (`Result.b3`, linhas `F1…`, `cold deaths…`, `J1new…` em `--brief`):
  - mortes de frio no Ano 1 e na partida, por tenda/casa e vulnerável/outro (lido antes do passo da semana);
  - tendas com gente e vulneráveis nelas na semana 13 (1ª do inverno), e as pessoa-semanas de vulneráveis em tenda
    no inverno do Ano 1 (a exposição do D1);
  - J1 novo (seção 1c): pescador, coletora, campo, lenhador ou mercado ligado com equipe 0 por mais de 8 semanas
    seguidas fora do inverno (o inverno pausa a contagem), enquanto havia um adulto sem trabalho, ou um adulto num
    local de prioridade menor ou do mesmo tipo com 2+ pessoas;
  - derrota: semana, moradores, adultos, fome nas últimas 26 semanas, impostos, manutenção, manutenção dos vazios
    e a causa lida: `emptied` (< 5 moradores), `famine` (13+ das 26 semanas), `emptyPlaces` (os vazios custam o
    déficit), `overbuilt` (outro déficit), `lateRecovery` (saldo já positivo, mas a dívida não fechou a tempo).
  - `--losses` lista cada derrota; `--coldrows` dá mortes e semanas de frio por ano de cada partida.

## 1. Metas por jogador (mediana da semana; minuto em 1x)
| # | Meta | Comum | Tutorial | Bot do plano | Eficiente | Pescador | Distraído |
|---|---|---|---|---|---|---|---|
| 1 | Comida até a primavera | 1 (0,1) | 1 (0,1) | 1 (0,1) | 1 (0,1) | 1 (0,1) | 27 (1,4) |
| 2 | Primeiro casamento | 7 (0,4) | 2 (0,1) | 4 (0,2) | 3 (0,2) | 3 (0,2) | 28 (1,5) |
| 3 | Primeiro nascimento | 10 (0,5) | 5 (0,3) | 7 (0,4) | 5 (0,3) | 5 (0,3) | 31 (1,7) |
| 4 | Passe o primeiro inverno | 26 (1,4) | 26 (1,4) | 26 (1,4) | 26 (1,4) | 26 (1,4) | 32 (1,7) |
| 5 | 5 casas de barro | 27 (1,4) | 27 (1,4) | 28 (1,5) | 27 (1,4) | 27 (1,4) | 201 (10,7) |
| 6 | Primeira caravana | 79 (4,2) | 79 (4,2) | 78 (4,2) | 76 (4,1) | 76 (4,1) | 202 (10,8) |
| 7 | Construa uma oficina | 98 (5,2) | 98 (5,2) | 91 (4,9) | 77 (4,1) | 77 (4,1) | 204 (10,9) |
| 8 | 30 moradores | 114 (6,1) | 116 (6,2) | 104 (5,5) | 96 (5,1) | 97 (5,2) | 337 (18,0) |
| 9 | 6 casas de pedra | 126 (6,7) | 122 (6,5) | 122 (6,5) | 97 (5,2) | 98 (5,2) | 374 (19,9) |
| 10 | Criança virou adulta | 193 (10,3) | 189 (10,1) | 193 (10,3) | 187 (10,0) | 187 (10,0) | 375 (20,0) |
| 11 | 45 moradores | 209 (11,1) | 224 (11,9) | 268 (14,3) | 191 (10,2) | 191 (10,2) | 588 (31,4) |
| 12 | 4 casas grandes | 212 (11,3) | 225 (12,0) | 277 (14,8) | 195 (10,4) | 201 (10,7) | 695 (37,1) |
| 13 | Terceira geração | 277 (14,8) | 274 (14,6) | 297 (15,8) | 271 (14,5) | 269 (14,3) | 696 (37,1) |
| 14 | 65 moradores | 322 (17,2) | 320 (17,1) | 358 (19,1) | 284 (15,1) | 288 (15,4) | 788 (42,0) |
| 15 | 85 moradores | 392 (20,9) | 384 (20,5) | 427 (22,8) | 333 (17,8) | 337 (18,0) | 904 (48,2) |
| 16 | 100 moradores (Templo) | 432 (23,0) | 432 (23,0) | 525 (28,0) | 355 (18,9) | 379 (20,2) | 855 (45,6) |
| 17 | 130 moradores | 533 (28,4) | 533 (28,4) | 625 (33,3) | 405 (21,6) | 451 (24,1) | 794 (42,3) |
| 18 | 160 moradores | 610 (32,5) | 596 (31,8) | 680 (36,3) | 474 (25,3) | 513 (27,4) | 909 (48,5) |
| 19 | Templo (vitória) | **617 (32,9)** | 599 (31,9) | 735 (39,2) | 530 (28,3) | 528 (28,2) | 994 (53,0) |
| | Vencem / derrotas | **77% / 0%** | 82% / 0% | 48% / 20% | 100% / 0% | 95% / 0% | 1% / **65%** |

Esperas do Comum entre metas: 1 6 2 16 1 31 2 10 3 60 16 1 54 45 61 40 **77** 70 0. A pior é a 17 (77 sem = 4,1 min),
abaixo do teto de 5 min. O P3 cumpriu o papel: as metas 3 e 5 já não chegam "prontas" juntas (3 na sem 10, 5 na 27).
As metas 4 e 5 ainda saem com 1 semana de diferença (a 5ª casa de barro sobe no fim do inverno).

## 2. Critérios (seção 7)
| # | Alvo | Comum | Tutorial | Plano | Eficiente | Pescador | Distraído |
|---|---|---|---|---|---|---|---|
| A1 vitória | 25–35 min | **32,9** ok (p25–p75 29,7–35,6) | 31,9 | 39,2 | 28,3 | 28,2 | 53,0 |
| A2 vence / derrotas | 50–80% / ≤ 5% (Distraído ≤ 20% de vitória) | **77% / 0%** ok | 82% / 0% | 48% / 20% | 100% | 95% | **1%** ok |
| **A2b** derrotas do Distraído | ≤ 25% | | | | | | **65% falha** |
| S1 casas com gente na sem 52 | 4–7 | **5** ok | 5 | 5 | 5 | 5 | 2 |
| S2 1ª casa de barro | sem 8–20 | **11** ok | 11 | 12 | 11 | 11 | 11 |
| S3 Mercado liberado | ≥ 78 | **98** ok (81% ≥ 78) | 98 | 91 | 77 (50%) | 77 (50%) | 204 |
| S4 derrota no Ano 1 | ≤ 2% | **0%** ok | 0% | 0% | 0% | 0% | 0% |
| F1 frio em algum inverno | 40–70% | **51%** ok | 55% | 66% | 10% | 20% | 91% |
| F2 tendas com gente na sem 13 | 2–4 | **3** ok (p10–p90 1–4) | 2 | 4 | 3 | 3 | 3 |
| **D1** morte de frio no Ano 1 (partidas); p90 | 20–40%; ≤ 2 | **5% falha**; 0 ok | **4%** (≤ 40% ok) | 12%; 1 | 10% | 10% | 5% |
| D2 mortes de frio na partida: mediana; p90 | ≤ 3; ≤ 6 | **1; 4** ok até a sem 675 e nas vitórias (1000 sem: p90 **26**, ver 3c) | 1; 3 | 3; 7 | 0; 1 | 0; 6 | 2; 5 |
| D3 derrota no Ano 1 (Distraído) | ≤ 10% | | | | | | **0%** ok |
| **J1 novo** | ≤ 10% | **50% falha** (sem campos: 4%) | 59% | 94% | 0% | 5% | 99% |
| J2 desempregados no Ano 1 | ≤ 2 | **0** ok (p90 1) | 0 | 7 | 0 | 2 | 0 |
| A9 Ano 2 casamentos / nascimentos | ≥ 3 / ≥ 5 | 3 / 6 ok | 3 / 6 | 3 / 7 | 3 / 8 | 3 / 7 | 3 / 3 |

Mortes de frio (soma de 100 partidas do Comum): Ano 1 só tenda-vulnerável (5). Na partida: tenda-vulnerável 236,
tenda-outros 189, casa-vulnerável 323, casa-outros 0. Distraído: Ano 1 5 (tenda-vulnerável); partida 122 / 70 / 64 / 0.

Comparação com o B2 (f1ccb01, mesmo bot): Comum 71% → **77%**, 34,0 → **32,9 min**, pior espera 129 → 77 sem.
Frio em algum inverno 54% → 51%. Distraído derrotas 46% → **65%**.

## 3. O que falhou e por quê

### 3a. A2b: Distraído perde 65% (alvo ≤ 25%)
| Rodada (Distraído, 100 seeds) | Derrotas | Causas (emptied / lateRecovery / emptyPlaces / famine / overbuilt) | Fim com < 5 moradores |
|---|---|---|---|
| Hoje (`emptyUpkeepFactor` 0,5) | **65%** | 42 / 0 / 17 / 4 / 2 (sem a correção da causa: os 17 são quase todos lateRecovery) | — |
| Dados do B2 (fator 1, sem frio, meta 5 = 3, lenha 2, metas 150/175, 3↔4) | 46% | 26 / 17 / 0 / 1 / 2 | 27% |
| B2 + só a metade (0,5) | 59% | 39 / 17 / 0 / 2 / 1 | 41% |
| B2 + só o frio do B3 | 52% | | 30% |
| B2 + só meta 5 = 5 casas | 53% | | 23% |
| B2 + só P1 | 49% | | 28% |
| B2 + só P2 / só a troca 3↔4 | 46% / 43% | | 27% |
| Hoje com o fator 1 / sem frio nenhum | 61% / 70% | | |
| **Alavanca 6: fator 0,25** | 59% | 44 / 10 / 0 / 2 / 3 | 44% (fim) |
| **Alavanca 6: fator 0** | **6%** ok | 5 / 1 / 0 / 0 / 0 | **68%**, mediana de moradores no fim **0** |
| Info (fora da lista): saída por fome pela metade (0,05 / 0,075) | 58% | 41 / 14 / … | 42% |

- A mudança de 46% para 65% não vem de uma causa só. Cada mudança, sozinha sobre os dados do B2, soma 0 a 13
  pontos. O sistema é caótico: a metade muda a prata em poucos centavos e muda as decisões do bot (27 seeds
  passam a perder e 14 deixam de perder). Mesmo assim, **a metade não ajuda o Distraído** (46 → 59%).
- **A causa real:** 2 de cada 3 derrotas são de cidade que já morreu (`emptied`, menos de 5 moradores). O
  Distraído perde gente pela fome no Ano 1 (S1 = 2 casas, 6 saídas por partida), pula metade das caravanas e
  a cidade envelhece até ficar vazia. Depois disso, a manutenção que sobra (0,75/sem) leva à derrota pela dívida.
- **A alavanca 6 (fator 0) passa o A2b, mas por um motivo ruim.** As derrotas viram cidades fantasma: 68% das partidas
  terminam com menos de 5 moradores e a mediana é 0 moradores, sem vitória (0%) e sem tela de derrota. Isso é uma
  "situação sem saída" pior que a derrota. Para o Comum, o fator 0 não muda nada (ele tem prata sobrando).
- Leitura do A2b sem as cidades mortas: derrotas com 5+ moradores = 65 − 42 = **23%** (dentro do alvo).

### 3b. D1: 5% das partidas do Comum perdem alguém no 1º inverno (alvo 20–40%)
| Rodada (Comum, 100 seeds) | D1 | p90 Ano 1 | D2 vitórias med; p90 | D2 1000 sem p90 | Vence | S2 |
|---|---|---|---|---|---|---|
| Hoje `tent` [0,01, 0] | 5% | 0 | 1; 4 | 26 | 77% | 11 |
| **Alavanca 1: [0,015, 0]** | 7% | 0 | 1; 4 | 30 | 77% | 11 |
| Info: [0,03, 0] | 12% | 1 | 2; **7** (falha) | 21 | 83% | 11 |
| Alavanca 4 (barro 8 de madeira, só informação: F2 passa) | 5% | 0 | 1; 3 | 32 | 82% | 11 |

- A conta do plano esperava 2–3 vulneráveis na tenda por 13 semanas. Medido: **1 vulnerável** (p90 2) na semana 13 e
  só **6 pessoa-semanas** (p75 8, p90 9; 16% das partidas com 0), porque o Comum sobe a 1ª casa na semana 11 e as
  outras sobem durante o inverno. 6 × 1% ≈ 6%, que é o medido.
- Para chegar a 20%, a chance da tenda com lenha teria de ficar perto de 4%, igual à da tenda sem lenha (a tabela
  perde o sentido), e o D2 das vitórias já passa de 6 com 3%. O barro mais caro (8) não segura ninguém na tenda:
  há 40 de madeira no começo e o lenhador vem na semana 3.
- O perigo existe e é bem direcionado: todas as mortes do Ano 1 são de vulneráveis em tenda, como o plano quer.
  Quem demora para sair da tenda (bot do plano: 2 vulneráveis, 4 tendas) perde mais (12%).

### 3c. D2 passa na partida de 700 semanas, mas há uma cauda nas partidas que travam no Templo
- Nas 77 vitórias: mediana 1, p90 4, máximo 11. Até a semana 675: p90 4. Com o `houseCold` [0,005, 0] (alavanca 2):
  p90 2 até a 675, sem mudar as vitórias (78%).
- Nas 23 partidas sem vitória em 1000 semanas: mediana **26** mortes, até 51. 22 delas chegaram aos 160 moradores e
  esperam o Templo, que espera **madeira** (300; "faltou por último" em 75 de 77 templos). No fim dessas partidas
  há 9–12 semanas de frio por inverno: a madeira do Templo e a lenha disputam o mesmo estoque. A alavanca 2 não muda
  essa cauda (p90 em 1000 semanas 26 → 26). A alavanca 3 para baixo (lenhador 2,25) pioraria.

### 3d. J1 novo: 50% (alvo ≤ 10%)
- 46 das 50 partidas são de **campo** vazio fora do inverno, com alguém de lenhador, pedreira, mercado ou oficina
  (2+) que poderia ir. Sem campos: **4%** (lenhador 3, mercado 1). Sequência mais longa: mediana 8, p90 41 semanas.
- O Comum só tira gente de outro trabalho para o campo quando a comida aparece como problema na tela. Com comida
  sobrando, o campo extra fica vazio e paga metade. Pela seção 1c, "o problema é o aviso ou o balão, não os números":
  nenhum dado resolve isso. O bot do plano (não mexe nas profissões) fica em 94% (mercado 27, campo 44, pescador 13).

## 4. Propostas (aprovação do game-director)
| # | Mudança | Antes → depois | Recomendação |
|---|---|---|---|
| L6 | `rules.emptyUpkeepFactor` 0,5 → 0 | A2b 65% → 6%; mas 68% das partidas do Distraído acabam com < 5 moradores (mediana 0), sem vitória e sem derrota | **Não aplicar sozinho.** Se entrar, precisa de uma regra que encerre a cidade vazia (por exemplo, derrota quando a cidade fica sem moradores e sem caravana a caminho). |
| L6b | `emptyUpkeepFactor` 0,5 → 0,25 | 65% → 59% | Não (não muda o quadro) |
| — | A2b reescrito: "derrotas do Distraído com 5+ moradores ≤ 25%" (a cidade morta perder é o fim certo) | hoje **23%** | **Recomendo** (critério, não dado) |
| L1 | `coldDeath.tent` [0,01, 0] → [0,015, 0] | D1 5% → 7%; D2 igual | Não (ganho dentro do ruído) |
| — | D1 reescrito para **5–15%** (o Comum sai da tenda cedo, na semana 11; só ~6 pessoa-semanas de exposição) | hoje 5%, tutorial 4%, plano 12% | **Recomendo**; manter `tent` 0,01 |
| L2 | `coldDeath.houseCold` [0,01, 0] → [0,005, 0] | D2 até a 675: p90 4 → 2; cauda de 1000 sem igual | Não é preciso (D2 passa) |
| L3, L4, L5 | lenhador, barro 8, `famineFactor` | F1, F2 e D3 passam | Não |
| — | J1 | 50% (campo); sem campos 4% | Sem dado: aviso ou balão do campo vazio quando há gente de prioridade menor (seção 1c) |

Problemas para depois (fora do B3):
- **Templo e lenha disputam a madeira** no fim: 22% das partidas do Comum travam no Templo com 160 moradores e morrem
  de frio aos poucos (mediana 26 mortes). Candidato: reduzir a madeira do Templo (300) ou fazer a lenha vir antes
  da reserva do Templo na tela. Medir no próximo pacote.
- **Prata parada** (W4/idle): 100% das partidas do Comum com mais de 300 de prata por mais de 26 semanas. Pedra acima
  de 300 por mais de 52 semanas em 97%. Igual ao B1/B2.
- S3 do Eficiente/Pescador: mercado na semana 77 (50% ≥ 78), no limite (informação: o alvo é do Comum).

## Como reproduzir
`timeout 600 npm run sim -- --bots comum --seeds 100 --weeks 1000 --brief [--coldrows]`
`--bots distraido ... --losses` (cada derrota com a causa) · `--profile tutorial=true` · `--profile jobDonors='"plan"' --profile answersIdle=false`
Alavancas: `--set rules.emptyUpkeepFactor=0` · `--set 'rules.coldDeath.tent=[0.015,0]'` (mude sempre o campo de
dentro: `cold.ts` guarda `RULES.coldDeath` ao carregar) · `--set 'rules.coldDeath.houseCold=[0.005,0]'` · `--set houses.2.materials.wood=8`.
Eficiente/Pescador: `--seeds 20` (cerca de 5 min cada).

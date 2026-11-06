# Sim-tester — ajuste "Fim sem frio" (2026-11-06)

Base: main em 25a2975 (o mesmo jogo do B3, 8a8d5ad; a linha de base repete o B3 dígito a dígito: Comum 77%,
semana 617). 1000 semanas, 1 semana = 3,2 s em 1x. Comum, tutorial, bot do plano e Distraído com 100 seeds
(Comum também com 200); Eficiente e Pescador com 20. Nada mudou em `src/`; só `tools/sim/survival.ts` e
`tools/sim/run.ts`. Alavanca medida com `--set buildings.temple.materials.wood=N`.

## 0. Mudanças nas medidas (pedidas na seção 1d)
- **A2b**: nova leitura `A2b lost with 5+ residents` (só derrotas com 5+ moradores na semana da derrota).
- **J1**: o campo vazio só conta quando a previsão de comida não chega à próxima colheita (`foodLastsToHarvest`);
  os outros tipos contam como antes. A leitura antiga fica ao lado (`J1 as in B3`) para comparar.
- **Cidade morta → derrota**: semanas entre a última queda para menos de 5 moradores e a derrota
  (`under 5 → defeat`), e as partidas que terminam sem derrota com menos de 5.
- **Partidas sem vitória** (`no win`): quantas, quantas chegaram à meta 18 (160 moradores), mortes de frio nelas,
  madeira, pedra, prata e moradores no fim; e o D2 só nas vitórias.

## 1. Metas do Comum (mediana da semana; minuto em 1x), antes e depois
| # | Meta | Antes (madeira 300) | Depois (madeira 200) |
|---|---|---|---|
| 1 | Comida até a primavera | 1 (0,1) | 1 (0,1) |
| 2 | Primeiro casamento | 7 (0,4) | 7 (0,4) |
| 3 | Primeiro nascimento | 10 (0,5) | 10 (0,5) |
| 4 | Passe o primeiro inverno | 26 (1,4) | 26 (1,4) |
| 5 | 5 casas de barro | 27 (1,4) | 27 (1,4) |
| 6 | Primeira caravana | 79 (4,2) | 79 (4,2) |
| 7 | Construa uma oficina | 98 (5,2) | 98 (5,2) |
| 8 | 30 moradores | 114 (6,1) | 114 (6,1) |
| 9 | 6 casas de pedra | 126 (6,7) | 126 (6,7) |
| 10 | Criança virou adulta | 193 (10,3) | 193 (10,3) |
| 11 | 45 moradores | 209 (11,1) | 209 (11,1) |
| 12 | 4 casas grandes | 212 (11,3) | 212 (11,3) |
| 13 | Terceira geração | 277 (14,8) | 277 (14,8) |
| 14 | 65 moradores | 322 (17,2) | 322 (17,2) |
| 15 | 85 moradores | 392 (20,9) | 392 (20,9) |
| 16 | 100 moradores (Templo) | 432 (23,0) | 432 (23,0) |
| 17 | 130 moradores | 533 (28,4) | 531 (28,3) |
| 18 | 160 moradores | 610 (32,5) | 614 (32,7) |
| 19 | Templo (vitória) | **617 (32,9)** | **614 (32,7)** |
| | Sem vitória em 1000 sem (100 seeds / 200 seeds) | **23% / 22%** | **11% / 9%** |

Até a meta 16 nada muda (a madeira do Templo só pesa depois que ele abre). A vitória quase não se move porque
quem vence já tinha a madeira quando chegou aos 160 moradores: o que manda no tempo é a meta 18. Pior espera entre
metas: 77 sem (4,1 min, meta 17), igual.

## 2. Rodadas da alavanca 1 (Comum, 100 seeds salvo indicação)
| Madeira do Templo | Sem vitória | Chegaram aos 160 e travaram | Mortes de frio nelas (med; máx) | A1 vitória (p25–p75) | D2 em 1000 sem p90 | D2 nas vitórias med; p90 | "faltou por último" madeira |
|---|---|---|---|---|---|---|---|
| 300 (hoje) | 23% (200 seeds: 22%) | 22 | 26; 51 | 32,9 min (29,7–35,6) | 26 | 1; 4 | 75 de 77 templos |
| 250 | 16% | 15 | 23; 51 | 32,4 (29,0–35,5) | 23 | 0; 2 | 81 de 84 templos |
| **200** | **11% (200 seeds: 9%)** | 10 | 23; 47 | **32,7 (28,4–36,2)** | **10** (200 seeds: 9) | 1; 4 | 86 de 90 templos |
| 150 (só informação) | 7% | 5 | 23; 47 | 32,7 (29,1–35,9) | 8 | 1; 4 | 87 de 95 templos |

- 200 não deixa o A1 rápido demais (Comum 32,7 min, Eficiente 26,6 min, os dois dentro de 25–35), então a rodada
  de 250 é só para comparar: ela fica longe do alvo (16%).
- Com 200, o alvo "≤ 10% sem vitória" passa por pouco: 11% em 100 seeds e 9% em 200 seeds (a diferença é ruído
  de ±3 pontos).

## 3. Critérios com a madeira 200 (antes → depois)
| # | Alvo | Comum | Tutorial | Bot do plano | Eficiente | Pescador | Distraído |
|---|---|---|---|---|---|---|---|
| Sem vitória em 1000 sem | ≤ 10% (Comum) | 23% → **11%** (200 seeds 22% → **9%**) | 18% → 6% | 52% → 38% | 0% → 0% | 5% → 0% | 99% → 99% |
| A1 vitória | 25–35 min | 32,9 → **32,7** ok | 31,9 → 31,8 | 39,2 → 36,2 | 28,3 → 26,6 | 28,2 → 27,3 | 53,0 → 47,9 (1 vitória) |
| A2 vence / derrotas | 50–80% / ≤ 5% | 77% → **89%** (200 seeds 91%) **acima de 80%**; 0% derrotas | 82% → 94% | 48% → 62%; 20% | 100% | 95% → 100% | 1%; 65% |
| A2b derrotas do Distraído com 5+ moradores | ≤ 25% | | | | | | 23% → 23% ok |
| S1 casas com gente na sem 52 | 4–7 | 5 ok | 5 | 5 | 5 | 5 | 2 |
| S2 1ª casa de barro | sem 8–20 | 11 ok | 11 | 12 | 11 | 11 | 11 |
| S3 Mercado | ≥ 78 | 98 ok (81%) | 98 | 91 | 77 | 77 | 204 |
| S4 derrota no Ano 1 | ≤ 2% | 0% ok | 0% | 0% | 0% | 0% | 0% |
| F1 frio em algum inverno | 40–70% | 51% → **50%** ok | 55% → 54% | 66% → 55% | 10% → 30% | 20% → 15% | 91% → 92% |
| F2 tendas na sem 13 | 2–4 | 3 ok | 2 | 4 | 3 | 3 | 3 |
| D1 morte de frio no Ano 1; p90 | 5–15%; ≤ 2 | 5%; 0 ok | 4%; 0 | 12%; 1 | 10%; 0 | 10%; 0 | 5%; 0 |
| D2 mortes de frio: med; p90 (vitórias) | ≤ 3; ≤ 6 | 1; 4 → 1; 4 ok | 1; 3 → 1; 5 | 3; 15 → 3; 12 | 0; 1 → 0; 4 | 0; 4 → 0; 4 | — |
| D2 na partida de 1000 sem: p90 | (≤ 6) | 26 → **10** | 27 → 8 | 36 → 15 | 1 → 4 | 6 → 4 | 5 → 5 |
| D3 derrota no Ano 1 (Distraído) | ≤ 10% | | | | | | 0% ok |
| J1 (campo só sem comida até a primavera) | ≤ 10% | **9% → 8%** ok (antiga 50% → 47%) | 3% → 5% | 91% → 91% | 0% | 5% | 86% |
| J2 desempregados no Ano 1 | ≤ 2 | 0 ok | 0 | 0 | 0 | 2 | 0 |

- **Tudo o que passava continua passando.** A única tensão é o **A2**: com menos travas o Comum vence 89–91%,
  acima do teto de 80%. O teto do A2 e o alvo deste ajuste ("≤ 10% sem vitória", que é ≥ 90% de vitórias com 0
  derrotas) não cabem juntos. Proponho reescrever o A2 do Comum para **50–90% de vitória em 1000 semanas** (o
  Comum não perde nenhuma partida; quem não vence está travado, e travar é o que este ajuste quer evitar).
- O F1 do Eficiente sobe (10% → 30%): ele constrói o Templo antes e as cidades seguem crescendo até a vitória em
  invernos maiores. Só informação (o F1 é do Comum).

## 4. J1 com a exceção do campo
| Bot | J1 antigo (B3) | J1 novo | Tipos no J1 novo |
|---|---|---|---|
| Comum | 50% | **9%** ok | lumber 5, market 2, field 2 |
| Tutorial | 59% | 3% | lumber 3 |
| Bot do plano | 94% | 91% | market 33, field 30, fisher 14, lumber 7, gatherer 7 |
| Distraído | 99% | 86% | gatherer 34, market 32, fisher 18, lumber 2 |

O campo vazio com a comida garantida era quase todo o J1 do Comum. Os 2 campos que sobram são de partidas em que a
previsão não chegava à colheita e ninguém foi para lá por mais de 8 semanas. O bot do plano e o Distraído não mudam
de profissão: o J1 deles mede o "chamar trabalhador" que ficou para depois (seção 1d).

## 5. Cidade morta: semanas entre "< 5 moradores" e a derrota (Distraído, 100 seeds)
| Medida | Valor |
|---|---|
| Derrotas com < 5 moradores (`emptied`) | 42 de 65 |
| Semanas de "< 5" até a derrota: mediana; p75; p90; máximo | **52** (2,8 min); 70; 108; 172 (9,2 min) |
| Das 42, mais de 26 semanas | **34 (81%)** |
| Partidas que acabam em 1000 sem com < 5 moradores e sem derrota | 1 (29 semanas) |
| Bot do plano (Comum que não muda profissão) | 12 derrotas `emptied` |

A conta passa do limite da seção 1d (~26 sem): a mediana é o dobro (52 sem, 2,8 min de tela sem nada a fazer)
e 81% das cidades mortas levam mais de 26 semanas para mostrar a derrota. Pelo critério do diretor, a regra
"derrota quando a cidade fica vazia (sem moradores e sem caravana a caminho)" **entra** no pacote
"Recuperação e vitória". A madeira do Templo não muda isso (o Distraído quase nunca abre o Templo).

## 6. Alavanca 2: "a lenha do inverno vem antes da reserva do Templo"
Não foi preciso para o alvo, mas a análise mostra que **ela não mudaria nada no sim**, e por quê:
- No core a lenha já sai primeiro: `burnFirewood` queima do estoque toda semana de inverno, antes de qualquer
  coisa, e o Templo só paga a madeira no momento de construir. Não existe "reserva" do Templo no core; ela só
  existe no bot (`materialKeep`), e lá ela nunca segura lenhador, pedreira nem a subida de casa (que é automática no
  core). Construir o Templo no outono sem lenha também não pesa: o Templo é a vitória e o jogo acaba ali.
- **A trava real é a produção de madeira no fim.** Exemplo, seed 2 (madeira 200): na semana 509 a cidade tem 160
  moradores, 1 lenhador ativo com rendimento 0,25/sem por trabalhador (o máximo é 2,5) e queima 4,3/sem de lenha no
  inverno; na semana 700, 3 lenhadores rendem 0,25–0,75 e a lenha pede 8,8/sem. O estoque sobe até 137 no verão e
  zera em todo inverno. Os bosques perto das ruas foram cortados (o Comum constrói 31 lenhadores e derruba 27 na
  partida) e as árvores que restam ficam longe do alcance dele (`roadReach` 14).
- Se o diretor quiser a ideia na tela, a regra de core seria igual à da casa (`keepsFirewood`): no outono e no
  inverno o botão do Templo avisaria (ou esperaria) quando pagar a madeira deixasse `firewoodShort` > 0, e o
  painel do Templo mostraria "madeira livre = estoque − lenha até a primavera". Efeito estimado no sim: **0 ponto**
  (o jogo termina na construção). É só clareza para o jogador.
- O que mexeria nos 9–11% que sobram (fora da lista, não medido): o rendimento de lenhador em bosque cortado,
  `treeRegrowWeeks` 104, ou o aviso do lenhador fraco. Fica para depois, se o diretor quiser.

## 7. Recomendação de dados (aprovação do game-director)
| Mudança | Antes → depois | Efeito medido | Recomendação |
|---|---|---|---|
| `buildings.temple.materials.wood` | **300 → 200** | Comum sem vitória 23% → 11% (200 seeds 22% → 9%); A1 32,9 → 32,7 min; D2 de 1000 sem p90 26 → 10; Eficiente 28,3 → 26,6 min; nenhum critério do Pacote B piora | **Aplicar** |
| `temple.materials.wood` 250 | 300 → 250 | sem vitória 16% | Não (não chega ao alvo) |
| `temple.materials.wood` 150 | 300 → 150 | sem vitória 7%; A1 igual | Não agora (200 basta; 150 deixa a madeira quase igual à de uma rodada de casas grandes) |
| A2 do Comum (critério) | 50–80% → **50–90%** de vitória, ≤ 5% de derrota | com 200: 89–91% | **Reescrever** junto com a madeira (os dois alvos não cabem juntos) |
| Alavanca 2 (lenha antes do Templo) | — | 0 ponto no sim | Não precisa; só como clareza de tela, se o diretor quiser |
| Derrota da cidade vazia | — | "< 5" → derrota: mediana 52 sem, 81% > 26 sem | **Entra** no pacote "Recuperação e vitória" (critério da seção 1d) |

Ao aplicar, atualizar `docs/GAME_DESIGN.md` (custo do Templo) e a tabela de critérios em `docs/design.md`.

## Como reproduzir
`timeout 600 npm run sim -- --bots comum,distraido --seeds 100 --weeks 1000 --brief --losses [--set buildings.temple.materials.wood=200]`
Tutorial: `--profile tutorial=true` · Bot do plano: `--profile 'jobDonors="plan"' --profile answersIdle=false` ·
Eficiente/Pescador: `--bots eficiente,pescador --seeds 20` (cerca de 2,5 min).

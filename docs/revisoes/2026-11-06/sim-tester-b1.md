# Sim-tester — Pacote B1 "Madeira antes da praça" (2026-11-06)

Base: commit d90403f. 100 seeds por jogador, 1000 semanas (o Comum passa de 700), 1 semana = 3,2 s em 1x.
Comparação "antes do B1": commit 108ae49 numa cópia de rascunho, com os mesmos bots corrigidos.
Nada mudou em `src/`. Propostas medidas com `--set` (só em memória).

## 0. O bot era o gargalo (corrigido só em `tools/sim`)
1. **Objetivo 7 "Construa uma oficina"**: o bot só fazia oficina quando via desemprego. Mediana do Comum
   no objetivo 7: semana 228 (150 semanas de espera, 8 min). Agora todo jogador constrói o que um objetivo
   "build" pede, assim que pode (o celeiro e o templo seguem regras próprias). Comum: 89.
2. **Eficiente (`planPlazas`)**: só punha casa dentro da praça. Sem praça no começo, não havia lote:
   casamento só na semana 333 (mediana), 33% das cidades esvaziaram e 2% venceram. Agora vale qualquer lote
   antes da praça ser liberada. Resultado: 95% vencem, 29,9 min.
3. **Medidas novas** (`b1Lines` em `run.ts`, `Result.b1`): S1–S4, semanas de frio, madeira no Ano 1,
   `firewoodHold`, mortes e saídas do Ano 1, desemprego no Ano 1.
4. **Perfil novo opcional `tutorial`** (`--profile tutorial=true`): faz na semana 0 os passos de construção
   do tutorial (comida, campo, lenhador, casa), que seguram o relógio. Fica desligado por padrão para as
   medidas poderem ser comparadas.

O Comum faz o primeiro lenhador quando a madeira cai abaixo de 15 (mediana: semana 17). É tarde, mas não chega
a dar frio: a reserva de lenha segura a madeira. Com o tutorial, o lenhador sai na semana 0.

## 1. Metas por jogador (mediana da semana; minuto em 1x)
| # | Meta | Comum sem | min | Eficiente sem | Distraído sem | Pescador |
|---|---|---|---|---|---|---|
| 1 | Comida até a primavera | 1 | 0,1 | 1 | 26 | |
| 2 | Primeiro casamento | 4 | 0,2 | 4 | 27 | |
| 3 | Passe o primeiro inverno | 26 | 1,4 | 26 | 28 | |
| 4 | Primeiro nascimento | 27 | 1,4 | 27 | 30 | |
| 5 | 3 casas de barro (Praça) | 28 | 1,5 | 28 | 68 | |
| 6 | Primeira caravana (Oficina) | 77 | 4,1 | 74 | 85 | |
| 7 | Construa uma oficina (Mercado) | 89 | 4,7 | 76 | 93 | |
| 8 | 30 moradores | 107 | 5,7 | 87 | 338 | |
| 9 | 6 casas de pedra (Parque) | 116 | 6,2 | 97 | 359 | |
| 10 | Criança virou adulta | 190 | 10,1 | 188 | 360 | |
| 11 | 45 moradores | 217 | 11,6 | 190 | 420 | |
| 12 | 4 casas grandes | 218 | 11,6 | 192 | 421 | |
| 13 | Terceira geração | 277 | 14,8 | 264 | 422 | |
| 14 | 65 moradores | 331 | 17,7 | 275 | 574 | |
| 15 | 85 moradores | 403 | 21,5 | 335 | 660 | |
| 16 | 100 moradores (Templo) | 467 | 24,9 | 371 | 710 | |
| 17 | 150 moradores | 620 | 33,1 | 466 | 870 | |
| 18 | 175 moradores | 661 | 35,3 | 529 | 915 | |
| 19 | Templo (vitória) | **742** | **39,6** | 561 (29,9 min) | 887 (47 min) | 581 (31,0 min) |
| | Vencem em 1000 sem | **37%** | | 95% | 3% | 98% |

Antes do B1 (108ae49, mesmo bot): o Comum vencia 23% das partidas, em 827 semanas (44,1 min). **O B1 melhora:
+14 pontos de vitória e −85 semanas.** Mas ainda falha nos alvos A1 (25–35 min) e A2 (50–80%).

Entre uma meta e a seguinte, o Comum espera: 1 3 22 1 1 49 11 6 1 72 17 1 57 51 66 49 **139** 46 0.
A pior espera é a do objetivo 17 (de 100 para 150 moradores): 139 semanas = 7,4 min, acima do teto de 5 min.
Desde que o 125 saiu, esse salto ficou grande. As metas 4 e 5 chegam já cumpridas, uma semana depois do
inverno (3 s cada). O motivo: o primeiro nascimento sai na semana 7 e a 3ª casa de barro na semana 18,
enquanto a meta do inverno segura até a semana 26.

## 2. Critérios do plano (seção 7)
| # | Alvo | Comum | Eficiente | Distraído |
|---|---|---|---|---|
| S1 casas com gente na sem 52 | 4–7 | **5** (p10–p90 4–6) ok | 5 | 2 (p10–p90 1–3) |
| S2 1ª casa de barro | sem 8–20 | **12** (p25–p75 11–14) ok | 11 | 11 |
| S3 Mercado liberado | ≥ 78 | **89** (85% ≥ 78) ok | 76 (46%) | 93 |
| S4 derrota no Ano 1 | ≤ 2% | **0%** ok | 0% | 0% |
| A1 vitória do Comum | 25–35 min | **39,6 min** falha | | |
| A2 Comum vence / Distraído / derrotas | 50–80 / ≤ 20 / ≤ 5 | **37%** falha / 3% / 0% | | |
| A9 Ano 2: casamentos, nascimentos | ≥ 3 / ≥ 5 | 2 / 8 (casamentos falham, como antes) | 3 / 10 | 2 / 4 |
| W2 espera por material | ≤ 26 sem | 24 (p75 32) ok | | |
| J2 desempregados no Ano 1 (o B2 ainda não existe) | ≤ 2 | **7** (p90 10) falha | 2 | 0 |

J1, J3 e D1–D3 precisam do B2 e do B3. F1/F2 com as regras de hoje: veja a seção 3.

## 3. Primeiro ano: frio, madeira, reserva de lenha, perdas
| Medida | Comum | Comum com tutorial | Eficiente | Distraído |
|---|---|---|---|---|
| Frio no Ano 1 (partidas) | 0% | 0% | 0% | 1% |
| Frio em algum inverno / semanas na partida | 87% / 30 | 91% / 33 | 25% / 0 | 82% / 15 |
| `firewoodHold` no Ano 1 (partidas; casa-semanas, mediana e p90) | 73%; 14, p90 31 | 0% | 0% | 75%; 16, p90 41 |
| `firewoodHold` na partida (casa-semanas; casas) | 423; 25 | 532; 33 | 0 | 51; 7 |
| Perdas no Ano 1 (mediana; partidas com alguma) | 0; 10% (idade 5, fome 18 no total) | 0; 5% (só idade) | 0; 3% | 5 (p90 10); 95% (fome 587) |
| Fome no Ano 1 (partidas) | 8% | 0% | 0% | 100% (7 sem) |

Madeira do Comum no Ano 1, nas semanas 0, 4, …, 52 (mediana):
40 30 30 25 16 **2** 4 7 15 21 27 25 29 30. Na semana 20, o p10 chega a 0.
Com o tutorial: 30 38 45 34 22 24 26 30 36 40 43 36 39 41 (nunca falta).

Leitura:
- **A reserva de lenha funciona.** No Ano 1, mesmo com a madeira em 2, ninguém passa frio: a casa espera a primavera.
- **O frio de hoje vem dos anos seguintes.** Em média 30 semanas na partida. Conforme a cidade cresce, a
  lenha passa a disputar a madeira com as casas e o templo (o templo espera a madeira em 42 de 42 vitórias).
  Isso é um risco para o D2 do B3 (≤ 4 mortes de frio na partida), porque o frio do barro também mata.
- **Para o B3:** com Tenda 0,5 (medido agora, sem morte de frio) o Comum fica com frio no Ano 1 em só 2%
  das partidas. A reserva segura as tendas sem subir: S2 vai de 12 para **22** (só 16% das partidas na
  faixa 8–20), o Ano 1 passa a ter 100% das partidas com reserva (37 casa-semanas) e há 12 saídas por frio.
  Com o tutorial: 0% de frio. **Pelas regras de hoje, F2 (20–40% com frio no Ano 1) não chega a 20%.**
  A alavanca 1 (lenha da tenda) atrasa o S2 antes de produzir frio. Isso deve entrar no plano do B3.

## 4. Objetivo 1 "Comida até a primavera" cumprido na semana 1
Medido em 40 seeds, com uma única construção na semana 0:
| Na semana 0 | Comida prevista (sem) | Meta 1 | Fome antes da primavera |
|---|---|---|---|
| Nada | 16 (15–18) de 26 | nunca | 100% das partidas (e 55% das cidades esvaziam) |
| 1 coletora | 66 (16–104) | sem 1 em 29/40 | 16/40 |
| **1 campo** | **104 (todas)** | **sem 1 em 40/40** | **0/40** |

- **A hipótese está errada:** a comida da caravana sozinha não dura (16 semanas, faltam 10). O que cumpre a
  meta é **um campo**. No outono, ele rende 12 de comida por semana; a cidade come cerca de 2,5. O celeiro
  base (100) enche antes do inverno.
- **Contra o plano?** Pouco. A meta 1 é a meta do tutorial: o passo "campo" segura o relógio, e a meta 1 é a
  única fora da regra dos 30 s. Ela ensina a coisa certa, e quem não constrói passa fome de verdade.
  O que contraria o "pouca comida" é o depois: um campo de 20 de prata resolve a comida do Ano 1 inteiro
  (o Comum tem fome no Ano 1 em 8% das partidas; com o tutorial, 0%).
- **Mudar a comida inicial não resolve.** `caravans.start.foodWeeks` [18,24] → [12,16]: a meta continua na
  semana 1 (o bot faz 2 construções), a fome no Ano 1 do Comum vai de 8% para 14%, vitória 30%.
- **Alavanca opcional (só se o diretor quiser a meta com 2 construções):** `rules.baseFoodStorage` 100 → 60.
  Aí um campo sozinho só cumpre na semana 11 (13 de 40 seeds nunca, 20 de 40 com fome). O Comum ainda cumpre
  na semana 1. Resultado: vence 46% em 686 semanas (antes: 37% em 742), S2 vai a 17, fome no Ano 1 de 4%.
  Risco: mexe no celeiro da partida inteira (A8: 1 celeiro ou menos em 89% das partidas, antes 97%).
  **Não recomendo no B1.**

## 5. Propostas para `src/data` (aprovação do game-director)
| # | Mudança | Antes → depois (Comum, 100 seeds) | Recomendação |
|---|---|---|---|
| P1 | `buildings.json > lumber.gather.max` 2 → **2,5** (alavanca 6 do plano) | vitória 37% → **68%**; 742 → **647 sem (39,6 → 34,5 min)**; `firewoodHold` na partida 423 → 62 casa-semanas; frio 30 → 12 semanas; casas esperando madeira 100 → 50 sem; S1–S4 iguais (5 / 12 / 88 / 0%). Distraído: 3% → 7% | **Entra** |
| P2 | `goals.json`: objetivo 17 150 → **130**, objetivo 18 175 → **160** (com P1) | pior espera 139 → **83 sem (4,4 min)**; objetivo 18 em 77 sem; vitória 69%, **629 sem (33,5 min)** | **Entra** (textos: "Chegue a 130/160 moradores") |
| P3 | `goals.json`: nascimento antes do inverno (3 ↔ 4) e barro 3 → **5** casas | esperas no Ano 1: 1 3 22 1 1 49 → 1 3 2 19 4 29; vitória 40% / 740 sem (igual); Praça na semana 30 | Opcional (o diretor decide; tira as duas metas "já cumpridas") |
| — | `rules.baseFoodStorage` 100 → 60 | seção 4 | Não agora |
| — | Tenda `firewood` 0,3 → 0,5 (B3) | S2 12 → 22; frio no Ano 1 em 2% | Rever no plano do B3 |

P1 + P2 juntos: o Comum vence em **33,5 min com 69% de vitória**. A1 e A2 passam, e nenhuma meta passa de 5 min.

## 6. Outros problemas (para registro)
- **Prata parada:** o Comum fica com mais de 300 de prata por 396 semanas seguidas (mediana) antes do templo,
  em 100% das partidas (antes do B1 também era assim). Já na primavera do Ano 1 tem 300–400 sem onde gastar:
  o limite é a madeira, não a prata.
- **Pedra sobrando:** o estoque fica acima de 300 por mais de 52 semanas em 100% das partidas (W4). O teto de 400 é atingido por volta do Ano 5.
- **Distraído:** fome no Ano 1 em 100% das partidas, 5 pessoas vão embora (mediana), 2 casas na semana 52,
  e 3% vencem. Sai da fome (recupera em 81% das crises). Está dentro do alvo (≤ 20%).
- **A9:** 2 casamentos no Ano 2 contra o alvo de ≥ 3 (igual antes do B1).
- **Templo:** nas vitórias do Comum, o último recurso que faltou foi sempre a madeira (42 de 42), nunca a prata ou a pedra. O espaço para o templo não foi medido à parte nesta rodada.

## Como reproduzir
`timeout 600 npm run sim -- --bots comum --seeds 100 --weeks 1000 --brief [--set buildings.lumber.gather.max=2.5]
[--set goals.16.target=130 --set goals.17.target=160] [--profile tutorial=true]`

# sim-tester · Pacote 2 medido contra o plano-p2, seção 6

- **Comando:** `npm run sim -- --seeds 100 --weeks 700`, 4 bots, 100 seeds cada, saída `--json`.
  Analisei a saída com um script no scratchpad.
- **Atual:** ea74959, com a calibração do main: Praça e Parque com manutenção 1, Parque custo 60,
  Casa 40, Coletora máx. 3,5. Durante as rodadas entraram da5a8bb e ef94a7b. Nelas, `src/core` e
  `src/data` só mudam por refatoração: `extra` dos grupos do mapa foi para o JSON com os mesmos
  valores. O resultado é o mesmo.
- **Linha de base:** a06d471, numa worktree temporária. A worktree já foi removida e não houve
  commit.
- **Tempo real:** 3,2 s por semana. 1 min = 18,75 semanas.
- Não mexi em `src/`. Em `tools/sim` entraram métricas novas:
  - `templeNear` / `templeAny`: lugar para o templo ao ser liberado, com regra mais solta;
  - `clearSpent`: prata gasta para cortar árvores;
  - `big260`: casas grandes na semana 260;
  - `upkeepY3`: manutenção por tipo na semana 156.
  Coloquei as mesmas métricas na base para comparar. A linha `--brief` agora mostra
  `≤6 roads`, `clear$` e `big260`.
- **Ruído:** com 100 seeds, uma taxa varia cerca de ±5 pontos de uma rodada para outra.

## 6.1 Não pode piorar (Comum, salvo indicação)

| # | Alvo | P1 (a06d471) | P2 (ea74959) | |
|---|---|---|---|---|
| B | casas com família na sem. 52: 6–10 | 9 | 9 | ✅ |
| G | vitória: mediana sem. 469–656, taxa 30–50% | sem. 559 (29,8 min), 42% | sem. 513 (27,4 min), 46% | ✅ |
| C1 | derrotas ≤ 7 (alvo ≤ 5) | 7 | **0** | ✅ |
| C2 | fome em ≥ 1 inverno: 25–60% | 22% | **11%** | ❌ (ver seção C2) |
| I | Comum e Eficiente sobrevivem ao Ano 1 ≥ 95% | 100% / 100% | 100% / 100% | ✅ |
| D | Distraído: derrotas antes da sem. 150 = 0 | 0 (67 derrotas no total) | 0 (19 no total) | ✅ |
| E | oficinas ao mesmo tempo ≤ 4 | máx. 3 | máx. 3 (todos os bots) | ✅ |
| F | prata > 300 por > 26 sem. antes do templo ≤ 9 (alvo ≤ 5) | 9 | **3** | ✅ |
| H | nenhuma abertura (2, 3 ou 4 famílias) melhor em tudo | – | ver abaixo | ✅ |
| T | tutorial: 0 de 16 perdem no Ano 1 | – | não medido aqui (o bot é do playtester). `npm test` passa (1134), incluindo `viability.test.ts` | – |

**F nos outros bots:** Eficiente 0 → 8, Pescador 59 → 61, Distraído 71 → 76.

**H (Comum, P2):**

| Caravana | Partidas | Vitórias | Semana da vitória | Casas na sem. 52 | Fome no inverno |
|---|---|---|---|---|---|
| 2 famílias | 38 | 19 (50%) | **459** | 8 | 4 |
| 3 famílias | 27 | 10 (37%) | 630 | 9 | 5 |
| 4 famílias | 35 | 17 (49%) | 513 | **10** | 2 |

Nenhuma abertura ganha em tudo: 2 famílias vencem mais cedo, 4 famílias têm mais casas no Ano 1.

## 6.2 Deve melhorar

| # | Alvo | Bot | P1 | P2 | |
|---|---|---|---|---|---|
| J1 | ≥ 13 semanas entre os objetivos 5 e 6 (mediana) | **Comum** | 1 (98 de 99 abaixo de 13) | **15** (0 de 100 abaixo de 13) | ✅ |
| | | Eficiente / Pescador / Distraído | 1 / 1 / 1 | 73 / 13 / 15 | |
| J2 | ≤ 3 objetivos no mesmo ano (mediana) | **Comum** | 4 (76 partidas com ano de 4+) | **3** (24 partidas com ano de 4+) | ✅ |
| | | Eficiente / Pescador / Distraído | 4 / 4 / 3 | 3 / 3 / 3 (2, 30 e 21 partidas com ano de 4+) | |
| J3 | maior espera por um objetivo (mediana): menor que no P1 | **Comum** | 324 | **302** | ✅ (por pouco) |
| | | Eficiente / Pescador / Distraído | 457 / 548 / 238 | 336 / 492 / **294** | o Distraído piora |
| M1 | árvores e rochas por mapa: ≥ +40% | todos | 161 | **246 (+53%)** | ✅ |
| M2 | templo com lugar ao ser liberado: 100% | Comum | 47/93 (51%) | **26/100 (26%)** | ❌ |
| | | Eficiente | 78/96 | 65/91 (71%) | ❌ |
| | | Pescador | 88/95 | 73/99 (74%) | ❌ |
| | | Distraído | 14/42 | 27/90 (30%) | ❌ |
| | | **total** | 227/326 (70%) | **191/380 (50%)** | ❌ |

**Onde fica a maior espera do Comum (J3)**
- P1: no objetivo 9 em 74 partidas. Esse objetivo só pode ser cumprido a partir do Ano 8.
- P2: no objetivo 9 em 43 partidas e no templo em 53.

## 6.3 Relatar

| Medida | Bot | P1 | P2 |
|---|---|---|---|
| Praças / parques construídos (mediana, inclui reconstruções) | Comum | – | 14 / 11 |
| | Eficiente / Pescador / Distraído | – | 7/5, 5/5, 7/6 |
| Casas por nível na vitória (tenda / barro / pedra / grande) | Comum | 1/5/29/11 | 5/6/11/**26** |
| | Eficiente | 0/4/25/13 | 1/3/10/21 |
| Casas grandes na sem. 260 (mediana) | Comum | 9 | **13** |
| | Eficiente / Pescador / Distraído | 10 / 12 / 0 | 9 / 13 / 0 |
| Comida por fonte (campo / pescador / coletora) | Comum | 65/24/**12**% | 64/22/**13**% (abaixo de 16% ✅) |
| | Eficiente / Pescador / Distraído | 85/11/4, 0/81/19, 72/14/14 | 97/1/2, 0/68/32, 80/9/11 |
| Estrago (comida perdida ÷ comida produzida) | Comum | 12,4% | 10,8% |
| | Eficiente / Pescador / Distraído | 27,1% / 2,4% / 15,5% | 31,9% / 2,1% / 16,3% |
| Prata gasta em Limpar árvores (mediana por partida) | Comum | 90 | **185 (+106%)** |
| | Eficiente / Pescador / Distraído | 15 / 50 / 15 | 20 / 55 / 45 |
| Manutenção na sem. 156 (média, prata por semana) | Comum | 32,4: poço 10,0, mercado 6,7, celeiro 4,5, pescador 3,5, campo 2,9, oficina 2,6, coletora 2,3 | 35,7: mercado 11,2, oficina 5,9, celeiro 4,9, **praça 3,5**, campo 3,0, pescador 3,0, coletora 2,5, **parque 1,8** |
| Dívida no Ano 2 | Comum | 41% | **4%** |

**Por que a porta fecha para famílias novas (Comum, % das semanas):**

| Ano | P1 | P2 |
|---|---|---|
| 1 | espera 57, aberta 23, comida 9, água 8 | espera 60, aberta 24, comida 10, depósito 5 |
| 2 | espera 44, comida 20, aberta 20, depósito 11, água 5 | espera **62**, aberta 25, comida 11, depósito 3 |
| 3 | espera 34, comida 23, aberta 16, água 14, depósito 8 | espera **52**, aberta 22, comida 17, depósito 8 |
| 4 | espera 32, comida 20, aberta 16, depósito 12, água 10 | espera **47**, comida 20, aberta 19, depósito 13 |

O motivo "água" sumiu. O peso dele foi para "espera", não para "comida".

## Objetivos por bot (P2, mediana; entre parênteses o P1)

**Comum**

| # | Objetivo | Semana | Minuto |
|---|---|---|---|
| 1 | Comida até a primavera | 1 (1) | 0,1 |
| 2 | 3 casas de barro | 15 (16) | 0,8 |
| 3 | 60 moradores | 67 (68) | 3,6 |
| 4 | 3 casas de pedra | 80 (81) | 4,3 |
| 5 | 150 moradores | 130 (95) | 6,9 |
| 6 | 2 casas grandes | 151 (96) | 8,1 |
| 7 | 250 moradores | 172 (217) | 9,2 |
| 8 | 6 casas grandes | 174 (218) | 9,3 |
| 9 | 500 moradores (a partir do Ano 8) | 364 (514) | 19,4 |
| 10 | Templo (vitória) | 513 (559) | 27,4 |

**Eficiente:** 2, 14, 64, 77, 135, 214, 228, 238, 424, vitória 459 (24,5 min). Taxa de vitória
**23% → 12%**.

**Pescador:** 1, 14, 89, 102, 150, 167, 193, 194, 563, vitória 481. Taxa de vitória **25% → 4%**.

**Distraído:** 20, 56, 116, 130, 263, 292, 351, 349, 559, vitória 566 (30,2 min). Taxa de vitória
**4% → 23%**, derrotas 67 → 19.

## C2 · alavanca proposta: `rules.drought.harvestFactor` 0,4 → 0,25 (alavanca nova)

**Diagnóstico.** O Comum nunca passa fome no Ano 1: em 0 de 100 partidas, no P1 e no P2. A fome
de inverno dele aparece do Ano 4 em diante, quase sempre depois de uma seca. Por isso as alavancas
da Coletora mexem pouco. Ela é só 13% da comida dele, e cair de 4,5 para 3,5 já foi feito.

**Rodadas.** Comum e Distraído com 100 seeds e 700 semanas, por `--set`. Linhas marcadas com "wt"
rodaram numa worktree temporária, porque o bloco `map` não aceita `--set`.

| Rodada | Fome no inverno (Comum) | Vitórias | Semana da vitória | Derrotas (Comum) | Distraído: derrotas / vitórias |
|---|---|---|---|---|---|
| P2 atual | 11% | 46% | 513 | 0 | 19 / 23% |
| Coletora `perCell` 0,3 → 0,25 (alavanca 4b) | 17% | 42% | 494 | 0 | 22 / 26% |
| wt: `denseGrove.min` 2 → 1 (alavanca 4c) | 10% | 37% | 517 | 0 | 18 / 35% |
| wt: as duas acima | 16% | 35% | 522 | 0 | 24 / 25% |
| `winter.foodFactor` 1,4 → 1,5 | 13% | 40% | 510 | 0 | 20 / 18% |
| `winter.foodFactor` 1,4 → 1,6 | 16% | **26%** | 495 | 1 | 15 / 13% |
| `perCell` 0,25 + `foodFactor` 1,5 | 8% | 36% | 526 | 0 | 28 / 16% |
| Pescador `max` 4,5 → 4 | 16% | 39% | 544 | 0 | 26 / 20% |
| Pescador `max` 4,5 → 3,5 | 25% | **28%** | 528 | 0 | 20 / 19% |
| `perCell` 0,25 + Pescador `max` 4 | 19% | 34% | 500 | 0 | 27 / 19% |
| `drought.chance` 0,25 → 0,33 | 10% | 48% | 513 | 0 | 16 / 28% |
| `drought.chance` 0,33 + `perCell` 0,25 | 13% | 42% | 502 | 0 | 22 / 23% |
| `drought.harvestFactor` 0,4 → 0,3 | 24% | 51% | 513 | 0 | 25 / 24% |
| `harvestFactor` 0,3 + `perCell` 0,25 | 22% | 34% | 485 | 0 | 29 / 17% |
| **`drought.harvestFactor` 0,4 → 0,25** | **28%** | **49%** | **522 (27,8 min)** | **1** | **18 / 20%** |
| wt: `harvestFactor` 0,25 + `olives` [70, 100] | 26% | 40% | 475 | 2 | – |

**Com `harvestFactor` 0,25, todos os bots:**
- **Comum:** 41% das partidas têm crise, e 34 de 41 se recuperam. Ano 1 continua em 100%, nenhuma
  derrota antes da semana 150, J1 15, J2 3, J3 293 (era 302).
- **Eficiente:** fome no inverno 0%, vitórias 14% (era 12%; dentro do ruído).
- **Pescador:** nada muda, porque não planta.
- **Distraído:** 0 derrotas antes da semana 150.

**Proposta (a game-director aprova):** `rules.drought.harvestFactor` **0,4 → 0,25**.
- Fica só um número em `src/data/rules.json`.
- Atinge só os anos de seca: chance de 25%, nunca dois anos seguidos, nunca nos 2 primeiros anos.
- É a única alavanca medida que põe C2 dentro de 25–60% sem tirar a vitória do Comum de 30–50%.
- A alternativa, Pescador `max` 4,5 → 3,5, também chega a 25%, mas a vitória cai para 28%.

**Ponto para a game-director:** se a intenção do C2 era ter medo da fome já no primeiro inverno,
nenhuma destas alavancas faz isso. A fome do Ano 1 do Comum é 0 desde o P1.

## M2 · a falta de lugar vem do desenho da cidade, não do mapa. Nenhuma alavanca de dados chega a 100%

**Diagnóstico.** Olhei a cidade no momento em que o templo é liberado, 100 seeds por bot:

| Bot | Lugar exato (`templeSpots`) | 6x6 sem árvores a ≤ 1 rua | 6x6 a ≤ 6 ruas, contando árvores que dá para cortar | Semanas até surgir o 1º lugar exato (mediana / p90) |
|---|---|---|---|---|
| Comum | 26/100 | **99/100** | 90/100 | 11 / 125 |
| Distraído | 27/90 | **88/90** | 83/90 | 28 / 190 |
| Pescador | 73/99 | **99/99** | 98/99 | 0 / 49 |
| Eficiente | 65/91 | 81/91 | 86/91 | 0 / 53 (9 partidas nunca têm) |

- "6x6 sem árvores a ≤ 1 rua" é um bloco de terra livre a no máximo uma célula de rua da rede.
- Em quase todos os casos existe um 6x6 livre, mas ele não encosta na rua.
- O Comum faz ruas em trechos de 6 células e encosta as casas nelas. Por isso sobram bolsões livres
  separados da rede por uma célula.
- No P1, com menos árvores, o lugar exato do Comum era 51%. As árvores a mais pesam, mas tirar 10
  oliveiras não muda nada.
- O bot do Comum sempre acaba construindo o templo. A alavanca de jogo é avisar o jogador, não
  abrir espaço.

**Alavancas medidas (lugar exato ao liberar):**

| Alavanca | Comum | Eficiente | Pescador | Distraído |
|---|---|---|---|---|
| atual | 26% | 71% | 74% | 30% |
| templo 5x5 (`--set buildings.temple.w=5`, `h=5`) | 38% | 84% | 92% | 38% |
| templo liberado no objetivo 6, não no 8 | 28% | 76% | – | – |
| wt: `olives` [80, 110] → [70, 100] (alavanca 5) | 20% | – | – | – |
| main: tirar árvores e rochas | ~26% | – | – | – |

**Propostas para a game-director:**
1. **Redefinir o M2** como "existe um 6x6 livre a ≤ 1 célula de rua da rede". Com essa regra:
   Comum 99%, Pescador 100%, Distraído 98%, Eficiente 89%. A regra exata (`templeSpots`) vira só
   um diagnóstico.
2. **Alavanca nova, fora de `src/data`:** a ação "Onde pôr o Templo" aponta o 6x6 livre mais perto
   e desenha a rua fantasma, reaproveitando o ponto de comida com rua fantasma do tutorial.
   - É uma mudança em core e render: não mede por `--set`.
   - O diagnóstico acima mostra que ela atenderia 99% do Comum com uma célula de rua.
   - Estimativa: 1–2 h (main + ui-designer), mais testes.
3. **Não recomendo** o templo 5x5: muda a arte e não passa de 38% no Comum. **Também não
   recomendo** liberar o templo antes (+2 pontos) nem mexer no mapa (nenhum efeito).
4. **Eficiente:** a cidade enche o mapa ("sem terreno" é 47–72% das semanas da porta do Ano 3 em
   diante). Em 1 de 91 partidas não sobra nenhum 6x6 nem cortando árvores. Demolir sempre abre
   espaço, então não há partida sem saída. Mas o bot deveria reservar o terreno do templo; é
   mudança só em `tools/sim`, para quando a game-director quiser.

## Outros problemas encontrados (não estavam no pedido)

1. **A reta final do Comum é longa.**
   - Do objetivo 8 ao 9 são cerca de 190 semanas (10 min), por causa do "a partir do Ano 8".
   - Do objetivo 9 até a vitória são 102 semanas na mediana dos vencedores (5,4 min; de 1 a 318).
   - 52 das 98 partidas que chegam aos 500 moradores não erguem o templo em 700 semanas.
   - Motivo: com 500–900 moradores a renda fica em torno de +10 por semana, e o templo custa 800.
     O bot não junta prata e gasta em casas e celeiros.
   - Pelo meu alvo, isso passa de 5 min por objetivo.
2. **Os objetivos 7 e 8 do Comum saem quase juntos:** 172 e 174, menos de 30 s de diferença.
3. **Eficiente** cai de 23% para 12% de vitórias. Só 52% chegam ao objetivo 9 e, desses, só 12
   vencem. A porta fecha por "sem terreno", e o templo fica sem lugar ou sem prata.
   **Pescador** cai de 25% para 4%: a porta fecha por falta de comida (64–74% a partir do Ano 5),
   e chegar a 500 moradores sem campos ficou difícil. O Pescador é um perfil de teste.
4. **O Distraído ficou bem mais fácil:** 67 derrotas viraram 19, e as vitórias foram de 4% para
   23%, a metade do Comum.
5. **Limpar subiu +106% no Comum** (90 → 185 por partida). Isso dispara o gatilho da alavanca 5.
   Mesmo assim, `olives` [70, 100] não muda o gasto (160, dentro do ruído). São cerca de 0,3 de
   prata por semana. Proposta: não mexer.

## Ajustes propostos em `src/data` (precisam da aprovação da game-director)

| Arquivo | Número | Antes | Depois | Efeito medido (Comum, 100 seeds) |
|---|---|---|---|---|
| `rules.json` | `drought.harvestFactor` | 0,4 | **0,25** | C2 11% → 28%; vitórias 46% → 49%; semana 513 → 522; derrotas 0 → 1 |

Para o M2 não há número a propor: a proposta é a redefinição do critério ou a mudança no "Onde pôr
o Templo".

# Linha de base de dificuldade (sim-tester, 2026-11-07)

Pedido: "o jogo está fácil demais". Medida do `main` no **0e82a80**, sem mudar `src/data` nem código.

Como foi medido:
- `npm run sim -- --bots comum,eficiente,distraido --seeds 100 --losses` (sims de sempre em `tools/sim`,
  até 1000 semanas, 2 ações por semana no máximo).
- Um rastreador avulso (fora do repositório) que roda os **mesmos** bots e seeds semana a semana e mede
  o que o `run.ts` não mede: ações por semana, semanas sem nada a decidir, prata parada, estoques e as
  curvas a cada 26 semanas. Os números batem com o `run.ts` (mesma vitória, mesmas semanas das metas).
- Sondas de alavanca com `--set` (só em memória), 40 seeds, Comum e Eficiente (e Distraído quando dito).
- Tempo real: 1 semana = 3,2 s em 1x (`rules.weekSeconds`), ou seja 1 min = 18,75 semanas.
- Conferido: o `main` mudou na árvore de trabalho durante a medida (outro agente), então tudo foi rodado de
  novo numa cópia limpa do 0e82a80 (`git archive`): os resultados, o rastreador e as sondas deram idênticos.

---

## 1. Resultado geral (100 seeds por jogador)

| | Comum | Eficiente | Distraído |
|---|---|---|---|
| Venceu | **89%** | **96%** | 1% |
| Perdeu | **0%** | **0%** | 65% (sem moradores 42, recuperação tardia 16, fome 4, outros 3) |
| Não terminou em 1000 sem. | 11% (10 já tinham 160 moradores, parados no Templo sem madeira) | 4% | 34% |
| Duração da vitória, mediana | 614 sem = **32,7 min** (p10–p90 26,0–40,7) | 500 sem = **26,7 min** (22,5–32,2) | 899 sem (1 vitória) |
| Prata abaixo de 0 alguma vez | 0/100 | 5/100 | 97/100 |
| Semanas de fome por partida, mediana (p90) | **0** (0); 5 partidas com alguma | **0** (0); 6 partidas | 9 (29); todas |
| Semanas de frio (sem lenha no inverno), mediana (p90) | **0** (17); 48 partidas com alguma | **0** (7); 23 partidas | 18 (33) |
| Mortes de frio por partida, mediana (p90) | 1 (10) | 0 (4) | 2 (5) |
| Famílias que foram embora, mediana (p90) | 0 (14) | 0 (4) | 8 (12) |
| Crise (moradores 25% abaixo do pico ou 4+ sem. de fome) | 10% | 10% | 88% (recuperou 53%) |

Leitura: quem joga com atenção (Comum e Eficiente) **não perde nunca** e quase não passa fome nem frio.
Quem esquece a comida (Distraído) perde 2 de 3 partidas. A dificuldade é binária: não existe meio-termo
em que o jogador comum sinta a cidade apertada e consiga sair do aperto.

## 2. Metas por jogador (semana e minuto em 1x, mediana; "espera" = desde a meta anterior)

### Comum

| # | Meta | Semana | Min | Espera (sem / min) |
|---|---|---|---|---|
| 1 | Comida até a primavera | 1 | 0,1 | 1 / 0,1 |
| 2 | Primeiro casamento | 7 | 0,4 | 6 / 0,3 |
| 3 | Primeiro nascimento | 10 | 0,5 | 2 / 0,1 |
| 4 | Passe o primeiro inverno | 26 | 1,4 | 16 / 0,9 |
| 5 | 5 casas de barro | 27 | 1,4 | **1 / 0,1** |
| 6 | Primeira caravana | 79 | 4,2 | 31 / 1,7 |
| 7 | Construa uma oficina | 98 | 5,2 | **2 / 0,1** |
| 8 | 30 moradores | 114 | 6,1 | 10 / 0,5 |
| 9 | 6 casas de pedra | 126 | 6,7 | **3 / 0,2** |
| 10 | Criança virou adulta | 193 | 10,3 | 60 / 3,2 |
| 11 | 45 moradores | 209 | 11,1 | 16 / 0,9 |
| 12 | 4 casas grandes | 212 | 11,3 | **1 / 0,1** |
| 13 | Terceira geração | 277 | 14,8 | 54 / 2,9 |
| 14 | 65 moradores | 322 | 17,2 | 45 / 2,4 |
| 15 | 85 moradores | 392 | 20,9 | 61 / 3,3 |
| 16 | 100 moradores (libera o Templo) | 432 | 23,0 | 40 / 2,1 |
| 17 | 130 moradores | 531 | 28,3 | 77 / 4,1 (p90 124 = 6,6 min) |
| 18 | 160 moradores | 614 | 32,7 | 70 / 3,7 (p90 131 = 7,0 min) |
| 19 | Construa o Templo | 614 | 32,7 | 0 (o Templo já está de pé) |

### Eficiente

| # | Meta | Semana | Min | Espera |
|---|---|---|---|---|
| 1–4 | até passar o inverno | 1 / 3 / 5 / 26 | 0,1–1,4 | |
| 5 | 5 casas de barro | 27 | 1,4 | 1 |
| 6 | Primeira caravana | 77 | 4,1 | 31 |
| 7–9 | oficina, 30 moradores, 6 de pedra | 79 / 90 / 98 | 4,2–5,2 | 1 / 3 / 1 |
| 10 | Criança virou adulta | 187 | 10,0 | **90 / 4,8** (p90 123 = 6,6 min) |
| 11–12 | 45 moradores, 4 grandes | 191 / 194 | 10,2–10,3 | 1 / 1 |
| 13 | Terceira geração | 264 | 14,1 | 68 / 3,6 |
| 14 | 65 moradores | 276 | 14,7 | 1 |
| 15 | 85 moradores | 334 | 17,8 | 53 |
| 16 | 100 moradores | 364 | 19,4 | 35 |
| 17 | 130 moradores | 427 | 22,8 | 58 |
| 18 | 160 moradores | 488 | 26,0 | 56 |
| 19 | Templo | 500 | 26,7 | 0 (p90 54) |

### Distraído (das partidas que chegaram lá)

| # | Meta | Chegaram | Semana | Min |
|---|---|---|---|---|
| 1 | Comida até a primavera | 100 | 27 | 1,4 |
| 4 | Passe o primeiro inverno | 100 | 32 | 1,7 |
| 5 | 5 casas de barro | **48** | 201 | 10,7 (espera 144 sem = 7,7 min) |
| 8 | 30 moradores | 33 | 337 | 18,0 (espera 194 = 10,3 min) |
| 11 | 45 moradores | 24 | 588 | 31,4 |
| 16 | 100 moradores | 5 | 855 | 45,6 |
| 19 | Templo | 1 | 899 | 47,9 |

Fora do alvo: 6 metas do Comum caem em menos de 30 s depois da anterior (2, 3, 5, 7, 9 e 12; a 8 fica em
30 s), e o par 17–18 passa de 5 min no p90. No Eficiente, 9 metas chegam em 1–3 semanas (2, 3, 5, 7, 8, 9, 11, 12, 14)
(o jogador já cumpriu antes de ler). As esperas longas são sempre metas de **esperar** (criança virou
adulta, terceira geração, N moradores), sem ação nova.

## 3. Curvas (mediana a cada 26 semanas = 1,4 min)

Comum:

| Semana | 0 | 52 | 104 | 156 | 208 | 260 | 312 | 364 | 416 | 468 | 520 | 572 | 624 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Prata | 154 | 296 | 401 | 579 | 910 | 1246 | 1812 | 2428 | 3550 | 4503 | 5547 | 6040 | 6810 |
| Prata/semana | +5 | +4 | +7 | +7 | +8 | +10 | +16 | +21 | +26 | +30 | +32 | +35 | +38 |
| Moradores | 12 | 19 | 29 | 36 | 44 | 52 | 61 | 76 | 94 | 109 | 116 | 126 | 138 |
| Madeira | 40 | 51 | 20 | 31 | 34 | 65 | 74 | 87 | 100 | 103 | 132 | 117 | 90 |
| Pedra | 0 | 4 | 14 | 26 | 48 | 177 | 379 | 398 | 400 | 400 | 400 | 400 | 390 |
| Comida (inverno/verão alternam) | 49 | 400 | 400 | 400 | 400 | 700 | 700 | 700 | 1000 | 1100 | 1100 | 1100 | 1300 |

Eficiente: prata 150 → 544 (sem. 208) → 2220 (364) → 4431 (494); moradores 12 → 55 (208) → 99 (364) → 139 (494);
pedra encosta em 400 a partir da semana ~312.

## 4. Recursos parados e "nada a decidir"

| Medida | Comum | Eficiente | Distraído |
|---|---|---|---|
| Ações por semana, mediana | 0,21 | 0,21 | 0,09 |
| Semanas **sem nenhuma ação** do jogador | **86%** | **86%** | 94% |
| Semanas sem ação **e sem nenhum alerta de pressão** (fome, frio, dívida, casal, caravana, material, desemprego, posto vazio, comida estragando) | 25% (p90 32%) | 30% (p90 39%) | 0% |
| Maior trecho seguido sem ação | 55 sem = 2,9 min | 48 sem = 2,6 min | 120 sem = 6,4 min |
| Maior trecho seguido sem ação e sem alerta | 24 sem = 1,3 min (p90 34) | 34 sem = 1,8 min (p90 52 = 2,8 min) | 2 |
| Semanas com prata ≥ 3× a coisa mais cara liberada (fora o Templo) | **98%** | **84%** | 63% |
| Semanas com prata ≥ 500 | 77% | 60% | 0% |
| Semanas com prata < 20 (sem poder comprar) | 0% | 1% | 15% |
| Prata no dia em que o Templo é liberado (custa 800) | **3916** (4,9 Templos) | 2399 (3,0) | 1006 |
| Prata no fim da partida | 8288 (p90 do pico 17 393) | 6199 | −15 |
| Prata ganha que nunca foi gasta | **76%** | **71%** | – |
| Tinha prata, madeira e pedra do Templo juntas, semana | 469 (o Templo libera na 432) | **344 (antes de liberar, na 364)** | 768 |
| Pedra parada no teto de 400 do depósito | da semana ~310 até o fim; 58% das semanas ≥ 150 | ~300 até o fim; 60% | – |
| Pedra feita que sobrou no fim | 19% (344) | 19% (300) | 0 |
| Obras travadas por falta de pedra, semanas | **0** | **0** | 0 |
| Madeira ≥ 100 | 25% das semanas | 36% | 0% |
| Obras travadas por falta de madeira, semanas | 25 | 1 | 57 |
| Último recurso que faltou para o Templo | madeira em 86 de 89 | madeira em 92 de 96 | madeira |
| Comida que estragou (% do que foi produzido) | **74%** | 29% | 58% |
| Semanas com comida ≥ 95% do depósito | 57% | 23% | 53% |
| Semanas com comida para ≥ 26 semanas | 84% | 63% | 68% |

Leitura: o jogador fica sem nada a fazer em 6 de cada 7 semanas. Em 1 de cada 4 semanas não existe nem
alerta pedindo algo. A prata para de limitar perto da semana 150 (8 min) e depois só cresce. A pedra bate
no teto do depósito na metade da partida e fica lá. A comida sobra tanto que três quartos estragam. **A
madeira é o único recurso que aperta**, e só no Templo: as 11 partidas do Comum sem vitória têm 160+
moradores, 25 mil de prata e pouca madeira. Elas não perdem, ficam presas (problema de saída, não desafio).

## 5. Sondas de alavanca (40 seeds, `--set` em memória, nada gravado)

| Sonda | Comum vence / duração | Eficiente | Distraído | Leitura |
|---|---|---|---|---|
| Base | 90% / 31,9 min | 100%* | 3%, perdeu 60% | |
| Imposto de todas as casas −40% (1,25/1,75/2,5/3,25 → 0,75/1,05/1,5/1,95) | **30% / 47,1 min**, 3% perdem | – | 3%, perdeu 38% | Forte demais: o início já é apertado em prata (150–400 nos 2 primeiros anos) |
| Imposto só de pedra e grande (2,5/3,25 → 1,75/2,25) | 93% / 32,4 min, prata final 18 405 → 2 728 | 95% / 30,2 min | – | Tira a prata parada **sem mudar** vitória nem fome |
| Colheita do campo −47% (468 → 250) | 95% / 33,1 min, fome 0 | 95% / 26,8 min | – | A comida nem sente: o Comum faz 19 campos |
| Templo 800 → 2500 de prata | 90% / 31,9 min (igual) | 100% / 26,6 min | – | A prata do Templo não importa |

(*) Eficiente nas 40 primeiras seeds da base: 100%.

## 6. Onde a economia está mais frouxa (alavancas, em ordem)

1. **Prata no meio e no fim do jogo.** Depois da semana ~150 ela não limita nada: 76% da prata ganha
   nunca é gasta, e o Templo é liberado com 5 vezes o preço dele em caixa. Alavanca: imposto das casas de
   pedra e grandes (`houses.json` 2,5 e 3,25) e as recompensas das metas (1415 de prata no total),
   **junto com** algo para gastar (o Templo em etapas do `plano-desafio.md`). Mexer no imposto da tenda e
   do barro derruba o Comum: o começo já está no ponto.
2. **Comida.** Fome praticamente nunca acontece para quem planta (0 semanas na mediana, 5% das partidas),
   74% da produção estraga e cortar a colheita quase pela metade não cria fome. O que segura a comida é
   o número de campos que o jogador pode pôr, não a colheita. Alavancas: o consumo por pessoa e o inverno
   (fator de inverno, seca) mais que a `harvest`; ou limitar campos pelo terreno ou pela água.
3. **Pedra.** Encosta no teto de 400 na metade da partida e nunca trava uma obra. Alavanca: pedra nos
   níveis de casa (10 → 15–20), no mercado e na oficina, ou no Templo por etapas; ou um rendimento menor
   da pedreira (`gather.max` 2).
4. **Tempo morto.** Semanas sem ação: 86%; sem ação e sem alerta: 25–30%; o maior trecho calmo passa de
   2,5 min no p90 do Eficiente. As metas de espera (10, 13, 15, 17, 18) são a causa: 3 a 7 min sem uma
   construção nova. Alavanca: metas com obra (é o Templo em etapas) e demandas que crescem com a cidade.
5. **Ninguém atento perde.** 0 derrotas em 200 partidas do Comum e do Eficiente; a única derrota é a
   dívida, que só o Distraído alcança. Alavanca para o pacote Dificuldade: um custo que cresce com a
   cidade (manutenção por construção, consumo de lenha nas casas grandes) para que a prata parada
   volte a ter destino, e não um corte no começo.
6. **Cuidado, não apertar.** Madeira (já é o último recurso do Templo e prende 11% das partidas do Comum
   sem vitória nem derrota) e o primeiro ano (o Distraído já perde 65%). Antes de endurecer, a saída
   da madeira no fim precisa existir (árvores que voltam, ou o Templo pedindo menos madeira de uma vez).

Nenhum número de `src/data` foi alterado; as sondas acima são só medida, para o game-director decidir.

# Pacote Povo: calibração (sim-tester, 2026-11-05)

Base: main 1d34b79 (core do Povo recém-implementado). Bots e métricas do plano 8.1/8.2 completados em
`tools/sim`. Rodadas: 4 bots × 100 seeds × 700 semanas (`npm run sim -- --brief --seeds 100 --weeks 700`);
explorações com 30 seeds. Relatório escrito aos poucos (cada etapa abaixo).

## Etapa 1: bots e métricas (feito)

- **Bots (8.1):** Eficiente e Pescador servem na hora uma casa cheia com casal fértil (praça, mercado
  ou parque com 1 casa, em vez de 2); o Distraído vê o aviso de casal e de caravana só depois de
  `2 × delay` (`houseDelayFactor` 2) e não prepara metade das caravanas (`caravanSkip` 0,5, sorteado
  uma vez por caravana). O resto já estava: casas = casais esperando + famílias anunciadas +
  `plotsAhead` (1, 1, 0, 0), melhoria do celeiro antes de outro, `trim` nunca derruba o último celeiro.
- **Métricas (8.2):** a linha `--brief` agora é a tabela A1–A11 por bot e uma linha final A2/A3:
  - A1 vitória (%, semana e minuto da mediana, p25–p75); A4 maior razão moradores(ano N)/(ano N−1)
    a partir do Ano 2 (mediana e % > 2); A5 maior intervalo entre objetivos (mediana, % > 75 sem);
    A6 fome em ≥ 1 inverno e derrotas; A7 dívida no Ano 2; A8 primeiro inverno com ≥ 15 casas com
    gente (celeiros ligados, fome); A9 casamentos e nascimentos do Ano 2, partidas em que toda
    caravana abrigou ≥ 1 família, caravanas com todas abrigadas, famílias que ficaram; A10 crise,
    recuperação, derrotas antes da semana 150; A11 máximo de celeiros e partidas com > 3;
    casas e moradores do Ano 1, casais que desistiram, maior espera de casal, prata parada.
  - Relatório completo: semanas-casal férteis por ano e o motivo de não nascer (`city` = bloqueio
    da cidade, `full` = casa cheia, `gap` = intervalo, `open` = podia), estrutura no fim
    (crianças/adultos/idosos, sem trabalho, idade mediana de morte), marcos e semanas em que a cidade
    passa de cada múltiplo de 5 moradores e de N casas de cada nível (`marks`, para desenhar objetivos).
  - `--trace` mostra crianças/adultos/idosos, solteiros (h/m) em idade de casar e casais esperando.

## Etapa 2: antes (1d34b79, 100 seeds, 700 semanas)

| Bot | A1 vitória | A4 >2 | A5 maior intervalo | A6 fome inv. / derrota | A7 dívida Y2 | A9 Y2 cas./nasc. | A10 <150 | A11 |
|---|---|---|---|---|---|---|---|---|
| Eficiente | 0% | 14% | 300 sem (16,0 min) | 0% / 0% | 0% | 0 / 2 | 0 | máx 2 |
| Pescador | 0% | 12% | 329 sem | 1% / 0% | 0% | 0 / 1 | 0 | máx 1 |
| Comum | 0% | 13% | 345 sem (18,4 min) | 0% / 0% | 0% | 0 / 1 | 0 | máx 1 |
| Distraído | 0% | 39% | 450 sem | 100% / 28% | 24% | 0 / 0 | **23** | máx 2 |

Moradores no fim de cada ano (Comum, mediana): 10, 12, 20, 21, 28, 35, 38, 42, 46, 51, 55, 59, 63.
Objetivo 5 (30 moradores) só cai na semana ~267; os objetivos 1–4 caem nas primeiras 20 semanas.
Prata do Comum passa de 1000 no Ano 4 e de 8000 no fim (nada onde gastar).

## Etapa 3: diagnóstico (por que a cidade não cresce)

`--trace` e os motivos por casal mostram três travas, nesta ordem:
1. **Poucos casais férteis.** No Ano 2 há ~100 semanas-casal férteis por partida (≈ 2 casais): o
   casal da abertura e uma mãe de modelo "casal com criança". As mães dos modelos "filho jovem"
   (34–44) saem da janela 18–40 logo. Nascimentos ≈ 0,9 por casal por ano com 0,03 e 26 semanas.
2. **Casa cheia.** Do Ano 3 em diante 40–80% das semanas-casal são `full` (tenda 3 = casal + 1).
3. **Geração longa.** Quem nasce no Ano 1 só casa no Ano 5,5–6 (18 anos × 13 semanas). Até lá só
   caravanas criam casais novos; casamentos no Ano 2–5 ficam em 0 por ano.

**A9 casamentos no Ano 2 ≥ 3 é inalcançável com estes dados.** Solteiros em idade de casar no Ano 2:
0–2 por partida (os jovens dos fundadores 3 e 4, quando existem, e só se forem de sexos opostos).
Medido (Comum, 30 seeds, mediana de casamentos no Ano 2): plano 8.4 alavanca 1 (peso 3 → 5 e
`marriageChance` 0,08) = **0**; caravana 1 no Ano 2 = 0; modelo novo "viúva com dois jovens" (peso 3,
ou até 30) = 0; caravana inicial 3–5 famílias (não aprovado) = 0; tudo junto + casar aos 16 = 0.
Só uma mudança de regra (ou um critério diferente, ver Decisões) muda isso.

### Rodadas de exploração (Comum, 30 seeds, 700 sem; moradores no fim dos Anos 2/5/9 e vitória)

| Mudança | Y2 / Y5 / Y9 | Y2 nasc. | Vitória |
|---|---|---|---|
| base 1d34b79 | 12 / 28 / 46 | 1 | 0% |
| peso 3→5 + `marriageChance` 0,08 (alav. 1) | 12 / 27 / 49 | 1 | 0% |
| `birthChance` 0,04 + gap 20 (alav. 2) | 14 / 27 / 52 | 2 | 0% |
| `weeksPerLifeYear` 10 (alternativa 10.1) | 13 / 25 / 42 | 1 | 0% |
| `weeksPerLifeYear` 8 | 11 / 23 / 36 | 1 | 0% |
| `birthChance` 0,08 + gap 13 | 16 / 31 / 73 | 2 | 27% |
| idem + `fertileAges` [18, 45] | 19 / 35 / 91 | 3 | 70% |
| idem + caravana 1 em 52–104 (Ano 2) | 26 / 40 / 95 | 5 | 80% |
| idem + caravana inicial 3–5 (NÃO aprovado, só medido) | 24 / 42 / 98 | 4 | 97% |

Envelhecer mais rápido (10 ou 8 semanas por ano de vida) piora: os fundadores morrem antes de os
netos nascerem. A alavanca que funciona é o **ritmo de nascimentos** (chance e intervalo), a janela
fértil e trazer a 1ª caravana para o Ano 2.

### Fome (A6) e o Distraído (A10)
- O Comum **nunca** passa fome no inverno (0% em todas as variantes): ele lê "Sem filhos: a comida
  não dura até a primavera" (`birthBlock food`, 3 semanas) e faz comida antes da fome; a cidade
  pequena e lenta não surpreende a previsão. Medido (30 seeds): `winterFactor` 0,2 = 0%; 0,1 +
  `winter.foodFactor` 1,6 = 0%; celeiro 200 = 0%; pescador 3 / coletora 2,5 / campo 350 = 0%;
  seca 50% = 0%; comida inicial 8–12 sem = 0%. Só `birthFoodReserveWeeks` **negativo** (−4: nascem
  filhos mesmo faltando 4 semanas de comida) dá 50% (com `winterFactor` 0,2: 80%), sem derrotas.
- O Distraído perde antes da semana 150 em 23% (base): fome no 1º inverno → tendas vão embora
  (35%/sem) → 1 casa paga 1,25 e a manutenção (celeiro + 2 comidas + praça ≈ 2,5) não fecha → dívida.
  Sem porta das famílias não há volta. Medido (100 seeds, com o pacote de crescimento): saída na fome
  0,2/0,35 → 0,1/0,15 = 9%; + comida inicial 14–22 → 18–24 sem = **4%**; dívida 24 → 36 sem = 7%.
- Caravana 2 em 156–260 (Ano 4–5, era Ano 5–6) alisa o platô dos Anos 3–5 (Comum 30/32/38 → 31/38/46).

## Etapa 4: números aplicados em `src/data` (rodada R2)

| Arquivo | Número | Antes | Depois | Por quê |
|---|---|---|---|---|
| rules.json | `people.birthChance` | 0,03 | **0,08** | alavanca 2 estendida: 0,04 não move nada (Y9 52) |
| rules.json | `people.birthGapWeeks` | 26 | **13** | alavanca 2 estendida (1 estação entre filhos) |
| rules.json | `people.fertileAges` | [18, 40] | **[18, 45]** | as mães dos fundadores (34–44) seguem férteis; Y2 nasc. 2 → 3 |
| rules.json | `caravans.later[0].weeks` | [78, 155] | **[52, 104]** | caravana 1 sempre no Ano 2: Y2 nasc. 3 → 5, Y2 moradores 19 → 26 |
| rules.json | `caravans.later[1].weeks` | [208, 311] | **[156, 260]** | alisa o platô dos Anos 3–5 (sem casais novos até a 1ª geração casar) |
| rules.json | `famineLeaveChance` / `winterFamineLeaveChance` | 0,2 / 0,35 | **0,1 / 0,15** | sem porta, família que sai não volta: fome tem de ser recuperável (A10) |
| rules.json | `caravans.start.foodWeeks` | [14, 22] | **[18, 24]** | o Distraído atravessa melhor o 1º inverno (A10: 9% → 4%) |
| goals.json | lista | 15 objetivos | **17 objetivos** | A5: os de casas e marcos caíam juntos; só "N moradores" esperava |

Objetivos novos (Comum, semana mediana): 1 casamento (5) · 2 comida até a primavera (6, Celeiro) ·
3 nascimento (9) · 4 três casas de barro (15, Mercado) · **5 primeira caravana (81, Oficina)** ·
6 30 moradores (152) · 7 três casas de pedra (153, Parque) · 8 criança virou adulta (194) ·
**9 45 moradores (251)** · **10 quatro casas grandes (252)** · 11 terceira geração (281) ·
**12 65 moradores (336)** · **13 85 moradores (406)** · 14 100 moradores (469, Templo) ·
**15 120 moradores (560)** · 16 150 moradores (598) · 17 Templo. A meta do Templo passou para o
**objetivo 16 = índice 15** (`--set goals.15.target=N`). Saíram "60 moradores", "2 casas grandes" e
"5 casas grandes" (caíam na mesma semana do objetivo anterior).

Testes ajustados: `tests/goals.test.ts` (lista, quem libera o quê, "um objetivo por verificação") e
`tests/people.test.ts` (janela fértil lida de `fertileAges`). `npm test` 1186/1186, `tsc` limpo.
Docs: `GAME_DESIGN.md` (comida inicial, nascimentos, caravanas, saída na fome, tabela de
objetivos, números dos objetivos do Templo e da Oficina) e `TESTING.md` (métricas e bots).

Testado e **não** aplicado: `weeksPerLifeYear` 10/8 (piora), `marriageAges` [16, 40] (+ rápido,
decisão 10.3 do usuário), modelo "viúva com dois jovens" (não muda A9), imposto da tenda 1,5 e
dívida 36 sem (não mudam A7/A10), `birthFoodReserveWeeks` −4 (ver Decisões), 21 objetivos (A5 por
partida 120 → 110 sem, monótono demais).

## Etapa 5: depois (R2, 100 seeds × 700 sem; Comum também com 200)

| # | Critério | Alvo | 3ab0f46 | Antes (1d34b79) | Depois (R2) | |
|---|---|---|---|---|---|---|
| A1 | Vitória do Comum | 25–35 min | 27,7 min, 50% | nenhuma vitória | **31,9 min** (p25–p75 29,0–34,1), 83% (200 seeds: 82%, 31,9) | ✅ |
| A2 | Vitória geral | ~30% | ~54% | 0% | 4 bots **50%** (Ef 97, Pe 7, Co 83, Di 13); 3 bots 64% | ❌ alto (dial = meta do Templo) |
| A3 | Ef > Co > Di, Ef mais cedo | sim | 85 > 50 > 28 | — | 97% (28,7 min) > 83% (31,9) > 13% (33,4) | ✅ |
| A4 | Nenhum ano > 2× o anterior | 0 | — | med 1,72; 13% > 2 | med **1,76**; 20% das partidas têm um ano > 2 (o Ano 2, quando a caravana chega a 2 famílias) | ⚠️ |
| A5 | Maior intervalo sem objetivo ≤ 75 sem | mediana Comum | — | 345 sem | maior por partida: mediana **120 sem** (6,4 min); por objetivo (mediana de cada espera): pior **68 sem** (obj. 13) | ⚠️ ✅ na leitura por objetivo, ❌ por partida |
| A6 | Comum com fome em ≥ 1 inverno 40–60%, derrotas ≤ 5% | | 35% | 0% / 0% | **0–1%** / 0% | ❌ (ver Decisões) |
| A7 | Dívida do Comum no Ano 2 | < 15% | 5% | 0% | **0%** | ✅ |
| A8 | 15 casas com no máximo 1 celeiro no inverno | | — | 100% ≤ 1, sem fome | **100% ≤ 1 celeiro, 0% fome** (100/100 partidas chegam a 15 casas) | ✅ |
| A9 | Ano 2: ≥ 3 casamentos e ≥ 5 nascimentos; caravanas acham casa | | — | 0 / 1 | **0** / **5**; 97% das partidas com toda caravana abrigando ≥ 1 família; 98% das famílias ficam | ❌ casamentos, ✅ nascimentos e caravanas |
| A10 | Distraído: crise e recuperação; nenhuma derrota < 8 min | | — | 48% crise, 30% recup., **23** derrotas < 150 sem | 47% crise, 42% recup., **4** derrotas < 150 sem | ⚠️ |
| A11 | Comum com > 3 celeiros | 0 | 21 celeiros | 0 (máx 1) | **0** (máx 2; 2 melhorias por partida) | ✅ |
| — | Casas com gente no fim do Ano 1 (Comum) | 4–7 | 6–10 | 4 | **4** | ✅ |

Moradores no fim de cada ano (mediana): Comum 16, 26, 30, 38, 46, 57, 74, 88, 95, 102, 112, 122;
Eficiente 16, 29, 38, 48, 58, 70, 86, 104, 112, 117, 127, 138; Distraído 8, 16, 19, 22, 26, 28, 33,
40, 48, 53, 58, 64. Comum no fim: 27 casas construídas, 69 crianças / 69 adultos / 10 idosos, idade
mediana de morte 63. Pessoas por ano (Comum, nasc./mortes/casamentos): Y1 7/0/1, Y2 5/0/0, Y3 4/0/0,
Y4 2/0/0, Y5 6/1/1, Y6 12/1/3, Y7 14/1/2, Y8 15/1/1.

## Etapa 6: meta do Templo (A12; objetivo 16, `--set goals.15.target=N`, 100 seeds)

| Meta | Eficiente | Pescador | Comum | Distraído | A2 (4 bots / 3 bots) | A1 | A3 |
|---|---|---|---|---|---|---|---|
| 120 | 97%, 24,1 min | 37%, 28,6 | 97%, **29,9 min** | 30%, 34,9 | 65% / 75% | ✅ | ⚠️ Ef < 25 min (alavanca `fromYear`) |
| **150** | 97%, 28,7 | 7%, 31,6 | 83%, **31,9 min** | 13%, 33,4 | 50% / 64% | ✅ | ✅ |
| 175 | 93%, 31,3 | 2% | 65%, **33,1 min** | 8%, 34,1 | 42% / 55% | ✅ | ✅ |
| 200 | 75%, 32,9 | 1% | 56%, **34,7 min** | 4%, 35,1 | **34%** / 45% | ✅ (no limite) | ✅ |

Com 200, o intervalo 150 → 200 fica sem objetivo (mediana 165 sem): precisaria de um "Chegue a 175".
Alternativa para baixar A2 com a meta 150: `birthChance` 0,06 → Ef 91% (30,0 min), Co 70% (32,8),
Di 5%, Pe 3% (A2 42%), mas A5 por objetivo passa a 77 sem (obj. 6).

## Etapa 7: opções medidas e não aplicadas (100 seeds, sobre o R2)

| Opção | Ef | Pe | Co | Di | Efeito nos critérios |
|---|---|---|---|---|---|
| Caravana inicial 3–5 famílias (**não aprovada**) | 96%, 26,6 min | 7% | 93%, 31,2 min | 18%, 33,6 | A4 >2 cai de 20% para 6%; Y2 nasc. 6; **Y2 casamentos continuam 0**; Di derrotas < 150 sem 4 → 2; A2 sobe para 54% |
| `birthFoodReserveWeeks` 2 → −2 | | | 82%, 32,5 | | A6 fome do Comum 31%, 0 derrotas |
| `birthFoodReserveWeeks` 2 → **−3** | | | 81%, 32,6 | | **A6 50%, 0 derrotas**, crise 20% e recuperação 20% (todas recuperam) |
| `birthFoodReserveWeeks` 2 → −4 | 97%, 28,7 (igual) | | 77%, 32,8 | 14% | A6 64% (acima da faixa), crise 42% / recuperação 42% |

## Decisões que ficam (game-director e usuário)

1. **Meta do Templo (A12).** 150 cumpre A1 e A3, mas A2 fica em 50% (4 bots). 200 dá A2 34% com o
   Comum em 34,7 min (no limite de A1) e pede um objetivo "Chegue a 175". 175 é o meio-termo
   (A2 42%, Comum 33,1 min). 120 deixa o Eficiente abaixo de 25 min. Recomendação: **150 ou 175**;
   se o usuário quiser A2 perto de 30%, 200 com o objetivo extra.
2. **A9 casamentos no Ano 2 ≥ 3: inalcançável** com a regra atual (nenhuma alavanca de dados tirou a
   mediana de 0; nem a caravana inicial 3–5). Os solteiros do Ano 2 são 0–2. Opções: (a) trocar o
   critério para "≥ 3 casamentos até o fim do Ano 6" (o Comum faz 3 no Ano 6 e ~2 por ano depois);
   (b) mudança de regra: jovens da caravana 1 chegam noivos, ou os fundadores 3–4 trazem um jovem
   noivo; (c) casar a partir dos 16 (decisão 10.3; só antecipa ~1 ano).
3. **A6 fome do Comum 40–60%: só com `birthFoodReserveWeeks` −3** (50%, sem derrotas). Não apliquei
   porque muda o sentido da regra pedida ("nascimentos dependem de sobra de comida"): os filhos
   passariam a nascer mesmo com a comida acabando 3 semanas antes da colheita, e o aviso "Sem
   filhos: a comida não dura até a primavera" só apareceria depois disso. Alternativa sem mexer na
   regra: aceitar que o Comum que lê o aviso não passa fome (o Distraído passa em 100%).
4. **A10: 4% de derrotas do Distraído antes de 8 min.** Espiral: fome no 1º inverno → famílias saem
   → 1 casa não paga a manutenção → dívida antes de a caravana 1 chegar. Nenhum número de dados
   zera (imposto da tenda 1,5, dívida 36 sem, saída 0,05/0,1: 3–4%). Precisa de regra (ex.: dívida
   não derrota enquanto há caravana anunciada ou planejada, ou manutenção pela metade com ≤ 2
   casas) ou de aceitar 4%.
5. **A5 por partida (mediana do maior intervalo) 120 sem.** Cada espera, pela mediana, fica ≤ 68
   sem, mas cada partida tem uma espera longa (caravana cedo ou tarde, 2 ou 4 fundadores): a
   espera de "30 moradores" (p75 117) e de "Criança virou adulta" (marco de relógio, ~semana 190)
   trocam de lugar. 21 objetivos só baixam para 110. Recomendação: medir A5 pela mediana de cada
   espera (leitura que passa) ou aceitar.
6. **A2 com 4 ou 3 bots.** O Pescador (só pesca e coleta) vence 7%: alimenta a cidade de 100 mas não
   a de 150. Se A2 contar só Eficiente, Comum e Distraído, 150 dá 64%.
7. **Prata parada (fora dos critérios):** o Comum passa 407 semanas (mediana) com mais de 300 de
   prata antes do Templo e termina com milhares; só gasta em melhorias de celeiro. O desemprego no
   fim é alto (34 de 69 adultos). Ficam para o P3 (madeira e pedra) e para os níveis de mercado e
   oficina (os bots ainda não melhoram mercado nem oficina).
8. **A4:** 20% das partidas do Comum dobram no Ano 2 (com 2 fundadores, a caravana 1 dobra a
   cidade). A caravana inicial 3–5 baixa para 6%; com 2–4, aceitar ou fixar a caravana 1 em 2
   famílias (alavanca 3 do plano).

## Decisões do usuário (rodada 2)

Implementadas sobre o R2 (números da Etapa 4 mantidos), com testes em `tests/` e docs atualizados:

1. **Meta do Templo 175.** `goals.json`: … 100 (Templo, +120), **125 (+150), 150 (+175), 175 (+200)**,
   Templo. 18 objetivos; `TEMPLE_GOAL` = objetivo 17 (175 moradores, índice 16:
   `--set goals.16.target=N`).
2. **Caravanas trazem noivos e casados.** Caravana inicial **3–5 famílias** (a 5ª tenda abre a 3ª
   fila do acampamento, a oeste; `campRoad` agora tem 6 células; a praça de `campPlazaSpot` alcança
   todas: teste de 500 sementes passa). Modelos: o "casal jovem" virou **casados de 20–28** (peso 2) e
   entrou **"noivos jovens"** (18–22, nomes de família diferentes, noivos; peso **30**, nunca na
   fundadora). Os noivos tomam **uma** casa e casam ao chegar (`yearStats.weddings`, evento
   `wedding`, marco `firstWedding`); sem casa seguem viagem. A **1ª caravana** (semanas **52–98**,
   para casar ainda no Ano 2) traz **3 famílias: 1 casal de noivos garantido (`engaged` 1) + 2
   sorteadas**.
3. **`birthFoodReserveWeeks` −3.** A previsão aceita reserva negativa (a comida passa do zero até
   −3 semanas de consumo fora do inverno); testes em `forecast.test.ts` e `people.test.ts`.
4. **Sem derrota por dívida com caravana a caminho.** Planejada ou anunciada e chegando em até
   **52 semanas** (`debtCaravanWeeks`, `caravanSpares`): a contagem para em 23 (aviso continua, "1
   semana"). Uma caravana em que alguém fica recomeça a contagem (volta a 1), senão a cidade
   perderia na própria semana da chegada. Testes em `debt.test.ts` e `caravans.test.ts`.

### Rodadas (100 seeds × 700 sem; exploração do Comum com 40 seeds)

| Rodada | 1ª caravana | peso noivos | Comum A1 | A9 Y2 cas./nasc. (Comum) |
|---|---|---|---|---|
| R1 (100) | 2–3 fam., 1 noivo garantido | 4 | 86%, 32,7 min | **1** / 7 ❌ |
| exp. (40) | 3 fam. | 12 | 95%, 31,7 | 2 / 8 |
| exp. (40) | 3–4 fam., 2 noivos garantidos | 4 | 93%, 31,1 | 2 / 9 (A4 >2 30%) |
| exp. (40) | 3 fam. | 24 | 93%, 31,6 | 3 / 9 |
| **R2 (100, aplicado)** | **3 fam., 1 garantido** | **30** | **93%, 31,7 min** | **3** / 8 ✅ |

Com 1 garantido + 2 sorteadas, o Comum só chega a 3 casamentos no Ano 2 quando as duas sorteadas
são noivos (p² ≥ 0,5 pede ~73% de noivos entre as sorteadas); casamentos locais no Ano 2 seguem ≈ 0.

### R2: critérios (100 seeds × 700 sem)

| # | Critério | Alvo | R2 Povo (Etapa 5) | Rodada 2 | |
|---|---|---|---|---|---|
| A1 | Vitória do Comum | 25–35 min | 31,9 min, 83% (meta 150) | **31,7 min** (p25–p75 29,7–33,8), 93% (meta 175) | ✅ |
| A2 | Vitória geral | ~30% | 50% | **77%** (Ef 99, Pe 100, Co 93, Di 17) | ❌ alto |
| A3 | Ef > Co > Di, Ef mais cedo | sim | ok | 99% (26,5 min) > 93% (31,7) > 17% (34,9) | ✅ |
| A4 | Nenhum ano > 2× o anterior | 0 | med 1,76; 20% | Comum med **1,76; 7%** (Di 46%) | ⚠️ |
| A5 | Maior intervalo sem objetivo ≤ 75 sem | | 120 sem; pior objetivo 68 | por partida **112 sem**; pior objetivo (mediana) **101 sem** (obj. 8, criança virou adulta) | ❌ |
| A6 | Comum com fome ≥ 1 inverno 40–60%, derrotas ≤ 5% | | 0–1% / 0% | **59%** / 0% | ✅ (no limite) |
| A7 | Dívida do Comum no Ano 2 | < 15% | 0% | **0%** (Di 10%) | ✅ |
| A8 | 15 casas com ≤ 1 celeiro no inverno | | 100% | **100%**, fome 3% | ✅ |
| A9 | Ano 2: ≥ 3 casamentos e ≥ 5 nascimentos; caravanas acham casa | | 0 / 5 | **3 / 8**; 94% das partidas com toda caravana abrigando ≥ 1; 677/706 famílias ficam | ✅ |
| A10 | Distraído: crise e recuperação; nenhuma derrota < 8 min | | 47%/42%, 4 derrotas < 150 | crise 70%, recup. 69%, **0 derrotas** (nenhuma derrota em 700 sem) | ✅ |
| A11 | Comum com > 3 celeiros | 0 | 0 | **0** (máx 2; Di 35% > 3) | ✅ |

Semanas dos objetivos (Comum, mediana): 5 6 9 14 75 89 90 191 196 197 273 298 355 398 462 530 594
→ vitória 594. Eficiente: vitória 496; Distraído: 655.

**Para o game-director:** (a) A2 77%: a caravana inicial maior, os noivos e a reserva −3
aceleram todos os bots; o Pescador agora vence 100%. O dial continua sendo a meta do Templo (ou
`birthChance`); A1 do Comum tem folga até 35 min. (b) A5: o pior objetivo passou a ser o 8
(criança virou adulta, ~101 sem depois do 7): marco de relógio, os objetivos 5–7 caem cedo demais
(75–90). (c) A4 do Distraído 46%: com a 1ª caravana de 3 famílias, uma cidade de ~10 moradores
dobra no Ano 2. (d) Distraído com > 3 celeiros em 35%.

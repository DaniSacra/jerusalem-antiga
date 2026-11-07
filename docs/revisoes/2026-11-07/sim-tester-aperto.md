# Aperto da economia (sim-tester, 2026-11-07)

Pedido: "o jogo está fácil demais: faço um campo e um pescador e pronto". Medida no `main` (6532d40),
sondas com `--set` (só em memória) até achar os números, e depois os números gravados em `src/data`.

Como foi medido:
- `npm run sim -- --bots comum,eficiente,distraido --seeds 100 --brief --losses` (até 1000 semanas,
  2 ações por semana no máximo). Sondas com 40 seeds e as finalistas com 100.
- Linha nova `SQ` no `tools/sim/run.ts` (`--squeeze` mostra só ela): vitórias e derrotas, minutos da
  vitória, partidas com fome ou frio, comida estragada, **prata nunca gasta** (prata no fim ÷ prata que
  entrou: a inicial mais o ganho líquido de cada semana; por isso a base dá 66% e não os 76% do
  `sim-tester-base.md`, que contava de outro jeito), semanas com a pedra a 95% do teto, e as construções
  de comida no fim de cada ano.
- 1 semana = 3,2 s em 1x; 1 min = 18,75 semanas.

## 1. O que mudou em `src/data` (antes → depois)

| Onde | Antes | Depois |
|---|---|---|
| Campo `harvest` (comida/ano) | 468 (12/sem) | **180** (≈4,6/sem) |
| Pescador `perCell` / `max` | 0,75 / 4,5 | **0,38 / 1,9** |
| Coletora `perCell` / `max` | 0,3 / 3,5 | **0,16 / 1,5** |
| Pedreira `perCell` / `max` | 0,4 / 2 | **0,3 / 1,4** |
| Manutenção da praça | 0,5 | **0,75** |
| Manutenção da pedreira | 1 | **1,75** |
| Manutenção do parque | 1 | **2** |
| Manutenção do celeiro (níveis 1/2/3) | 1 / 2 / 4 | **1,75 / 3,5 / 5,5** |
| Manutenção do mercado (níveis 1/2/3) | 2 / 3 / 5 | **3,5 / 5 / 8** |
| Manutenção da oficina (níveis 1/2/3) | 1 / 2 / 3 | **1,75 / 3,5 / 5** |
| Pedra para virar casa de pedra / casa grande | 10 / 10 (+5 madeira) | **15 / 15** (+5 madeira) |

Sem mudar: madeira (lenhador, custos em madeira), impostos das casas, consumo por pessoa, inverno,
custos em prata, metas e prêmios, tenda e casa de barro. `houses.json` não tem fator de comida por
nível; esse alavanca exigiria código no core, então não foi usado.

## 2. Antes e depois (100 seeds, 1000 semanas)

| | Comum antes | Comum depois | Eficiente antes | Eficiente depois | Distraído antes | Distraído depois |
|---|---|---|---|---|---|---|
| Venceu | 89% | **75%** | 96% | **85%** | 1% | 0% |
| Perdeu | 0% | **5%** | 0% | 2% | 65% | 84% |
| Não terminou | 11% | 20% | 4% | 13% | 34% | 16% |
| Vitória, mediana (p10–p90) | 32,7 min (26,0–40,7) | **36,7 min** (28,7–48,8) | 26,7 (22,5–32,2) | 33,9 (29,7–44,5) | 47,9 | – |
| Partidas com fome ou frio | 50% | 91% | 29% | 80% | 100% | 100% |
| Partidas com fome | 5% | 79% | 6% | 74% | 100% | 100% |
| Semanas de fome, mediana (p90) | 0 (0) | **3** (25) | 0 (0) | 2 (21) | 9 (29) | 9 (29) |
| Fome no Ano 1 | 0% | **0%** | 0% | 1% | 100% | 100% |
| Comida estragada (% do feito) | 74% | **31%** | 29% | 10% | 58% | 43% |
| Prata nunca gasta, mediana | 66% | **33%** | 60% | 23% | 0% | 0% |
| Semanas com pedra no teto, mediana | 39% | **24%** | 35% | 20% | 0% | 0% |
| Construções de comida no fim dos anos 1–5 | 4/5/5/5/5 | 4/5/6/6/6 | – | 2/4/5/6/6 | 6/5/5/4/4 | 8/8/6/4/4 |
| Crise / recuperou (A10) | 10% / 3% | 50% / 46% | 10% | – | 88% / 53% | – |

Primeiro ano igual ao de hoje (Comum): S1 casas na semana 52 = 5 (100% entre 4 e 7), S2 primeira casa
de barro na semana 11, S3 mercado na semana 101 (era 98), S4 ninguém perde no Ano 1, fome no Ano 1 0%,
moradores na semana 52 = 19 (igual). A2b ("perdeu com 5+ moradores") sobe de 0% para 4% no Comum: são
as derrotas novas, todas depois do Ano 1 (semana mediana 260).

Contra os alvos (Comum): vitórias 75% (alvo 55–75%, no teto), derrotas 5% (3–10%), fome ou frio em
91% (≥ 40%), mediana de semanas de fome 3 (≤ 6), estrago 31% (≤ 35%), prata parada 33% (≤ 40%), pedra
no teto 24% (≤ 30%), vitória em 36,7 min (28–40). Eficiente 85% (≥ 80%). Distraído: vitórias 1% → 0%
(1 partida, dentro do ruído), mas as derrotas sobem de 65% para 84% (cidade esvaziada, semanas 120–450).

"Um campo e um pescador": com os números novos rendem 180 + ≈77 = ≈257 de comida por ano. A cidade do
Ano 1 (≈19 moradores, quase todos em tenda) come ≈260 com a comida da caravana ajudando; a do Ano 2
(≈26–29 moradores, filhos nascendo) come ≈350–400. Os bots passam de 4 construções de comida no fim do
Ano 1 para 5–6 a partir do Ano 3, e o celeiro passa a encher e esvaziar (estrago 74% → 31%).

## 3. Metas do Comum (semana mediana; minuto em 1x)

| # | Meta | Antes sem (min) | Depois sem (min) | Espera depois |
|---|---|---|---|---|
| 1–5 | até 5 casas de barro | 1–27 (≤ 1,4) | 2–27 (≤ 1,4) | igual |
| 6 | Primeira caravana | 79 (4,2) | 79 (4,2) | 31 |
| 7 | Oficina | 98 (5,2) | 101 (5,4) | 2 |
| 8 | 30 moradores | 114 (6,1) | 157 (8,4) | 24 |
| 9 | 6 casas de pedra | 126 (6,7) | 171 (9,1) | 4 |
| 10 | Criança virou adulta | 193 (10,3) | 196 (10,5) | 22 |
| 11 | 45 moradores | 209 (11,1) | 281 (15,0) | 63 (3,4 min) |
| 12 | 4 casas grandes | 212 (11,3) | 285 (15,2) | 1 |
| 13 | Terceira geração | 277 (14,8) | 297 (15,8) | 1 |
| 14 | 65 moradores | 322 (17,2) | 386 (20,6) | 74 (3,9 min) |
| 15 | 85 moradores | 392 (20,9) | 481 (25,7) | 83 (4,4 min) |
| 16 | 100 moradores (libera o Templo) | 432 (23,0) | 546 (29,1) | 46 |
| 17 | 130 moradores | 531 (28,3) | 630 (33,6) | 70 |
| 18 | 160 moradores | 614 (32,7) | 681 (36,3) | 62 |
| 19 | Templo | 614 (32,7) | 689 (36,7) | 0 |

Nenhuma espera mediana passa de 5 min (a maior, 83 semanas = 4,4 min, na meta 15). As metas que
caem em menos de 30 s depois da anterior continuam (2, 3, 5, 7, 9, 12, 13): não é alavanca deste aperto.

## 4. Sondas (Comum / Eficiente; 40 seeds salvo indicado)

| Sonda | Comum vence / perde / min | fome (partidas, mediana sem.) | estraga | prata parada | pedra no teto | Eficiente vence / perde |
|---|---|---|---|---|---|---|
| Comida −50% (campo 240, pescador 0,45/2,5, coletora 0,2/2) | 98% / 0 / 32,5 | 20%, 0 | 46% | 66% | 39% | 98% / 0 |
| Comida −64% (campo 170, pescador 0,35/1,8, coletora 0,15/1,4) = "yA" | 98% / 0 / 33,5 | 78%, 3 | 26% | 65% | 38% | 95% / 0 |
| Consumo +50% (0,35/0,3/0,22) | 98% / 0 / 31,6 | 5%, 0 | 57% | 63% | 38% | 100% / 0 |
| Manutenção ×2 (praça, pedreira, parque, celeiro, mercado, oficina) | 63% / 3 / 44,2 | 5%, 0 | 75% | 17% | 56% | 98% / 0 |
| Imposto pedra/grande 1,75/2,25 + pedra 20 nos níveis | 90% / 0 / 34,3 | 5%, 0 | 73% | 31% | 36% | 90% / 0 |
| yA + manutenção ×1,5 + pedreira 0,3/1,4 | 90% / 3 / 35,3 | 88%, 4 | 24% | 42% | 30% | 88% / 8 |
| yA + manutenção ×2 + pedreira | 58% / 10 / 38,2 | 85%, 5 | 36% | 5% | 31% | 90% / 0 |
| yA + imposto + pedra 15 + pedreira | 85% / 0 / 35,8 | 80%, 3 | 28% | 28% | 22% | 90% / 3 |
| yA + imposto + pedra 15 + pedreira + manutenção ×1,5 | **15%** / 5 / 36,9 | 83%, 3 | 35% | 1% | 23% | 75% / 3 |
| yA + manutenção ×1,75 + pedreira (100) | 71% / 8 / 37,0 | 84%, 7 | 32% | 24% | 29% | 75% / 6 |
| yA + manutenção ×1,75 + pedreira 0,3/1,2 (100) | 80% / 4 / 39,1 | 81%, 4 | 26% | 26% | 18% | 83% / 5 |
| yA + manutenção ×1,75 + pedreira + pedra 15 (100) | 73% / 7 / 39,4 | 88%, 6 | 32% | 25% | 23% | 82% / 1 |
| idem, celeiro sem aumento (100) | 82% / 4 / 39,4 | 84%, 5 | 27% | 31% | 21% | 79% / 5 |
| idem, praça 0,75 e parque 2 (100) | 79% / 7 / 38,4 | 89%, 6 | 25% | 32% | 23% | 77% / 5 |
| **idem com comida um pouco mais alta (campo 180, pescador 0,38/1,9, coletora 0,16/1,5) = final (100)** | **75% / 5 / 36,7** | 79%, 3 | 31% | 33% | 24% | **85% / 2** |

Leitura:
- Cortar só a comida **não aperta** o Comum: ele responde ao "N sem trabalho" com campos e a cidade
  cresce igual (98% de vitórias com a comida a 36%). Cortar a comida derruba o estrago e cria a fome
  passageira, mas não muda vitória nem duração.
- Quem segura a vitória e a duração é a **prata do meio do jogo** (manutenção dos serviços que chegam
  depois do Ano 1). Imposto das casas de pedra e grandes **junto com** manutenção é forte demais (15%).
- A pedra 15 nos níveis e a pedreira menor tiram a pedra do teto sem travar obras (obras paradas por
  pedra: mediana 1 semana).

## 5. Pontos para o game-director

1. **Distraído perde mais** (65% → 84%; vitórias 1% → 0%). A maior parte é "cidade esvaziada" entre as
   semanas 120 e 450: ele só reage à fome, e com a comida rendendo menos a fome dura mais. Se o
   Distraído deve continuar com alguma chance, a ajuda certa é na interface (aviso de comida mais cedo)
   e não nos números.
2. **Fome longa em algumas partidas**: no p90 do Comum são 25 semanas de fome numa partida (em vários
   episódios). Metade das partidas tem crise (moradores 25% abaixo do pico ou 4+ semanas seguidas de
   fome), e 46% se recuperam. É recuperável, mas o aviso de fome precisa ser claro.
3. **Cauda longa**: p90 da vitória do Comum vai a 48,8 min, e 20% das partidas não terminam em 1000
   semanas (53 min). As vitórias no teto do alvo (75%) e as não terminadas vêm da mesma prata apertada.
4. O passo do tutorial "melhor lugar de pescador ou coletora" usa `minSpotFood` 1,2/sem
   (`tutorial.json`, não mudado): com o pescador novo isso pede 4 células de rio (antes 2). O teste de
   200 mapas do tutorial continua passando.
5. As metas de menos de 30 s (2, 3, 5, 7, 9, 12, 13) seguem como antes.

## 6. Testes e documentos

- `npm test`: 1580 passaram (67 arquivos); `npx tsc --noEmit` limpo. Não rodei os testes visuais (fora
  do pedido); algum cenário que dependa do estoque de comida ou da manutenção pode precisar de olhada.
- Testes que só copiavam os números antigos (tabela de dados): atualizados para os novos números
  (`coverage`, `economy`, `gather`, `levels`, `materials`, `survival`, `houses`).
- Testes de regra que usavam os números antigos no cenário, agora lendo do JSON: `economy` (meia
  manutenção arredondada a centavos; saldo = impostos − soma das manutenções), `levels` (manutenção
  de construção vazia; o pescador de inverno agora alimenta uma casa de 4, não de 8, porque rende 1,9),
  `materials` (`STONE` lido de `houses.json` nos testes da casa que espera pedra), `forecast` (a
  multidão que fica entre o campo sozinho e o campo com bônus é calculada da colheita) e `survival`
  (a cidade da seca come ≈95% do campo, calculada da colheita). Nenhum deles mudou a regra testada.
- `docs/GAME_DESIGN.md`: tabela de construções, níveis dos serviços, pedra das casas e a Colheita.
  `docs/TESTING.md`: `--squeeze` e a linha `SQ`.

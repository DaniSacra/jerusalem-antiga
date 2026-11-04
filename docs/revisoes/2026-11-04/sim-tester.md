# sim-tester · Pacote 1 "Ritmo" (medido no working tree, igual ao commit 196cd9d)

Comando: `npm run sim -- --seeds 100 --weeks 700` (4 bots, saída completa, `--brief` e `--json`).
Linha de base: o mesmo comando em 11a95cd (worktree temporário, já removido).
Tempo real: atual 3,2 s/semana (1 ano = 166 s = 2,8 min); base 2,5 s/semana.
Nada em `src/` nem em `tools/sim` foi alterado. As propostas de bot foram medidas numa cópia em
`scratchpad` (descrita em "Bots").

## 1. Antes e depois (100 seeds por bot)

| Bot | Medida | Base 11a95cd | Atual |
|---|---|---|---|
| Eficiente | vitória | 98% | **31%** |
| | semana da vitória (mediana) | 61 (2,5 min) | 468 (25,0 min) |
| | moradores na semana 52 | 147 | 50 |
| | partidas com fome no Ano 1 | 0% | 0% |
| | oficinas construídas (mediana) | 19 (máx. 47) | 3 (no máximo 3 ao mesmo tempo) |
| | prata < 0 alguma vez / derrotas | 0% / 0 | **87%** / 0 |
| Pescador | vitória | 90% | 9% |
| | semana da vitória | 65 (2,7 min) | 527 (28,1 min) |
| | moradores sem. 52 | 140 | 46 |
| | oficinas construídas | 21 | 5 |
| | dívida alguma vez / derrotas | 8% / 8 | 88% / 0 |
| Comum | vitória | 94% | **40%** |
| | semana da vitória | 62 (2,6 min) | 572 (30,5 min) |
| | moradores sem. 52 | 140 | 50 |
| | partidas com fome no Ano 1 | 21% | 0% |
| | oficinas construídas | 19 (máx. 78) | 5 (máx. 3 ao mesmo tempo) |
| | dívida no Ano 1 / Ano 2 / alguma vez | 6% / 0% / 8% | 0% / **53%** / 94% |
| | derrotas por dívida | 3 | **9** |
| Distraído | vitória | 88% | 2% |
| | semana da vitória | 105 (4,4 min) | 670 (35,7 min) |
| | moradores sem. 52 | 108 | 22 |
| | partidas com fome no Ano 1 | 100% (5 sem) | 100% (4 sem) |
| | oficinas construídas | 18 | 5 |
| | dívida alguma vez / derrotas | 14% / 9 | 97% / **63** |

Taxa de vitória em 700 semanas: Eficiente 31%, Pescador 9%, Comum 40%, Distraído 2%.
(O plano de sobrevivência pede "cerca de 30% dos jogadores vencem".)

## 2. Critérios A–K (Comum, salvo indicação)

| # | Alvo | Resultado | |
|---|---|---|---|
| A | 1 ano = 2,5–3 min | 52 × 3,2 s = 2,8 min | ✅ |
| B | casas com família na sem. 52: 6–10 | mediana 9 (mín. 6, máx. 11) | ✅ |
| C | fome em ≥ 1 inverno em 40–60%; derrotas ≤ 2% | 39%; derrotas **9%** (2 antes da sem. 150) | ❌ |
| D | Distraído: ≥ 50% com crise e recuperação; 0 derrotas antes da sem. 150 | crise 100%, crise + recuperação 92%; 0 derrotas antes de 150 | ✅ (mas 63% perdem depois, mediana sem. 303) |
| E | oficinas ao mesmo tempo ≤ 4 | máximo 3 em todos os bots | ✅ |
| F | 0 partidas com prata > 300 por > 26 sem antes do templo liberado | **28** | ❌ |
| G | vitória mediana entre sem. 469 e 656 | 572 (30,5 min), taxa 40% | ✅ |
| H | nenhuma abertura melhor em tudo | ver tabela 3 | ✅ |
| I | Comum e Eficiente sobrevivem ao Ano 1 ≥ 95%; Eficiente sem dívida | 100% e 100%; Eficiente com prata < 0 em **87%** (51% no Ano 2) | ❌ |
| J | ≤ 2 objetivos no Ano 1 e ≤ 2 por ano depois; cada um a ±1 ano | Ano 2 tem **4** (obj. 3, 4, 5, 6); obj. 5, 6, 8 e 9 fora de ±1 ano | ❌ |
| K | relatar | seção 5 | – |

### Objetivos do Comum (mediana)
| # | Objetivo | Semana | Minuto (3,2 s) | Ano medido | Ano esperado | ±1? |
|---|---|---|---|---|---|---|
| 1 | Comida até a primavera | 1 | 0,1 | 1 | 1 | ✅ |
| 2 | 3 casas de barro | 16 | 0,9 | 1 | 1 | ✅ |
| 3 | 60 moradores | 67 | 3,6 | 2 | 2 | ✅ |
| 4 | 3 casas de pedra | 82 | 4,4 | 2 | 3 | ✅ |
| 5 | 150 moradores | 96 | 5,1 | 2 | 4 | ❌ |
| 6 | 2 casas grandes | 96 | 5,1 | 2 | 5 | ❌ |
| 7 | 250 moradores | 258 | 13,8 | 5 | 6 | ✅ |
| 8 | 6 casas grandes | 259 | 13,8 | 5 | 7 | ❌ |
| 9 | 500 moradores (Ano 8) | 531 | 28,3 | 11 | 9 | ❌ |
| 10 | Templo | 572 | 30,5 | 11 | 10 | ✅ |

Os objetivos de casas (4, 6, 8) caem juntos com os de moradores (3, 5, 7): a casa grande tem 20
moradores, então as casas grandes chegam junto com a população. Depois do Ano 2 há dois buracos
longos: Anos 3–4 (nenhum objetivo) e Anos 6–10 (só esperando o objetivo 9). Eficiente: 2, 15, 62,
77, 90, 91, 174, 175, 408, 468. Distraído: 19, 51, 120, 142, 158, 159, 433, 449, 651, 670.

## 3. Aberturas (critério H)

| Bot | Famílias | Partidas | Sobrevive Ano 1 | Fome no Ano 1 (partidas / sem.) | Casas sem. 52 | Vitória | Semana da vitória | Derrotas |
|---|---|---|---|---|---|---|---|---|
| Comum | 2 | 38 | 100% | 0% / 0 | 8 | 45% | **551** | 6 |
| Comum | 3 | 29 | 100% | 0% / 0 | 9 | 28% | 574 | 2 |
| Comum | 4 | 33 | 100% | 0% / 0 | **10** | 45% | 596 | 1 |
| Eficiente | 2 | 38 | 100% | 0% | 8 | **42%** | **443** | 0 |
| Eficiente | 3 | 29 | 100% | 0% | 9 | 28% | 507 | 0 |
| Eficiente | 4 | 33 | 100% | 0% | **10** | 21% | 458 | 0 |
| Distraído | 2 | 38 | 97% | 100% / 4 | 4 | 5% | 670 | 24 |
| Distraído | 3 | 29 | 100% | 100% / 4 | 4 | 0% | – | 17 |
| Distraído | 4 | 33 | 100% | 100% / 4 | 4 | 0% | – | 22 |

Nenhuma abertura ganha em tudo: 4 famílias dá mais casas no Ano 1 e menos derrotas; 2 famílias
vence mais cedo (e, no Eficiente, mais vezes). ✅

## 4. Critérios que falham: causa e proposta

Todas as medidas abaixo são 100 seeds × 700 semanas. "F honesto" = prata > 300 por > 26 semanas
enquanto não há templo para juntar (antes de liberado, ou já construído) e antes do objetivo 10.
Com os dados de hoje é igual ao F do sim.

### F: prata parada (Comum 28/100)
**Quando e onde.** 25 das 29 sequências começam no objetivo 9 (500 moradores, a partir do Ano 8);
o resto nos objetivos 6–8. Começam no Ano 5 a 13 (mediana Ano 8), duram 114 semanas na mediana e
chegam a ~1040 de prata (máx. 4027). Dois tipos:
1. **Cidade fechada (bot):** a cidade do Comum fica cercada pelas próprias construções. O mapa
   tem ~1500 células livres, mas `spotFor` não acha lugar para celeiro, campo, pescador ou coletora
   sem demolir (procurei nas seeds 1, 17 e 78). A porta fica em `storage`/`food` o ano inteiro e a
   prata sobe +7/sem. Um jogador abriria uma rua. Exemplo: seed 78, sem. 349–700, 308 moradores,
   prata até 2938.
2. **Espera pelos 500:** a porta fica em `wait` (uma família a cada ~8 semanas, e a tenda leva
   39 semanas para virar casa grande). Com a cidade cheia, não há o que comprar.

**Proposta (precisa do game-director, está fora da lista de alavancas):** liberar o **Templo no
objetivo 8** em vez do 9. A vitória continua exigindo o objetivo 9 (500 moradores, Ano 8), porque o
objetivo 10 só conta depois dele. O templo passa a ser o destino da prata durante a espera.
- `goals.json`: obj. 8 `"unlock": "temple"` (antes: nenhum); obj. 9 sem `unlock` (antes: `"temple"`).
- Medido com o bot construindo o templo assim que pode pagar (ajuste de bot B3 abaixo):
  `--set goals.7.unlock='"temple"' --set goals.8.unlock=null`

| | Atual | Templo no obj. 8 |
|---|---|---|
| F honesto (Comum) | 28 | **4** |
| Vitória Comum / semana | 40% / 572 | 40% / 566 |
| Vitória Eficiente / Pescador / Distraído | 31 / 9 / 2% | 31 / 36 / 4% |

Também medi:

| `--set` | F | Vitória do Comum | Derrotas do Comum |
|---|---|---|---|
| (atual) | 28 | 40% | 9 |
| `goals.8.target=450` | 20 | 40% | 9 |
| `goals.8.target=400` | 13 | 37% | 11 |
| `houses.4.tax=2` | 27 | 32% | 14 |
| `houses.4.tax=3` (valor da spec) | **61** | **70%** | 6 |
| `houses.4.tax=3` + recompensas dos obj. 7 e 8 em 40 + `goals.8.target=450` | 42 | 67% | 6 |
| bot B1 (cidade fechada abre rua) | 17 | 39% | 12 |
| bot B1 + `goals.8.target=450` | 9 | 36% | 14 |

Mexer em imposto só troca F por vitória: a curva de prata é "curta no meio, sobrando no fim", e o
imposto empurra as duas pontas juntas. Mudar o destino da prata no fim resolve sem mexer na vitória.

### C e I: dívida e derrotas (Comum 9 derrotas; dívida no Ano 2 em 53%; Eficiente em dívida em 87%)
**Causa.** A manutenção liga toda de uma vez no fim do objetivo 3 (sem. ~67). O saldo do Comum vai
de +14 para −4 a −10 por semana na hora. A mediana do saldo durante o objetivo 4 é −2,3/sem. Depois,
cada casa que sobe põe mais gente para comer (20 moradores × 0,2 = 4 de comida/sem) e paga pouco
(casa grande 2,5 = 0,125 por morador). A comida a mais custa campo, celeiro, poço e mercado. Em 29
das 100 partidas do Comum, a cidade fica presa por ≥ 26 semanas com prata < 30 e saldo ≤ +0,5. O bot
demole até o saldo dar 0 e não sobra nada para crescer (seed 7: 268 moradores, +0/sem, da sem. ~150
à 700). Na semana 200, 76% dos trabalhadores estão sem vaga, a alegria fica em 45 e o imposto cai
um pouco. 6 das 9 derrotas acontecem esperando o objetivo 9.
O Eficiente entra em dívida porque o `affords()` do planejador lê o saldo antes de a manutenção
existir (bot, ver B2). Além disso, ele guarda comida demais: 17 celeiros e 29% da comida estragada.

**Proposta (alavanca 3, "prata curta", um passo além da lista):** `upkeepStartsAfterGoal` 3 → **4**.

| `--set` | Vit. Comum | Derrotas Comum | Dívida Ano 2 | Fome em inverno | F | Vit. Eficiente | Derrotas Distraído |
|---|---|---|---|---|---|---|---|
| (atual) | 40% | 9 | 53% | 39% | 28 | 31% | 63 |
| `rules.upkeepStartsAfterGoal=4` | 52% | **3** | 35% | 27% | 38 | 34% | 58 |
| `rules.debtWeeksToLose=36` (alavanca 5) | 37% | 8 | 53% | 39% | 31 | 30% | 63 |
| `rules.happiness.idleMax=10` | 40% | 9 | 53% | 43% | 28 | 31% | 63 |
| `houses.4.tax=3` | 70% | 6 | 40% | 28% | 61 | 45% | 52 |
| `houses.4.tax=3` + `houses.3.tax=3` | 87% | 2 | 24% | 20% | 93 | 76% | 31 |

**Combinado proposto: templo no obj. 8 + manutenção depois do obj. 4** (Comum, F honesto):
vitória 52%, semana 539 (28,7 min), derrotas 3, F 7. As 7 sequências que restam ficam no Ano 2,
antes da manutenção começar (~560 de prata guardada, que depois paga o choque da manutenção).
Medidas completas dos 4 bots na tabela 4b.

#### 4b. Combinado (templo no obj. 8 + manutenção depois do obj. 4 + bot B3), 100 seeds × 700 sem.
`--set goals.7.unlock='"temple"' --set goals.8.unlock=null --set rules.upkeepStartsAfterGoal=4`

| Bot | Vitória | Semana (min) | Derrotas | Dívida Ano 2 | Fome em inverno | F | Casas sem. 52 |
|---|---|---|---|---|---|---|---|
| Eficiente | 34% (31) | 449 (24,0) | 1 | 50% | 3% | 2 | 9 |
| Pescador | 25% (9) | 438 (23,4) | 0 | 11% | 50% | 59 | 8 |
| Comum | **52%** (40) | 539 (28,7) | **3** (9) | 35% (53) | 27% (39) | **7** (28) | 9 |
| Distraído | 8% (2) | 596 (31,8) | 59 (63) | 0% | 100% | 69 | 4 |

(Entre parênteses: o valor de hoje.)

Critérios com o combinado: A, B, D, E, G e H continuam passando. Ficam no limite **C** (derrotas
3%, alvo ≤ 2%; fome em inverno 27%, alvo 40–60%) e **F** (7). **I** (bot B2) e **J** continuam
falhando. Aberturas do Comum: 2 famílias com 55% de vitória na sem. 561, 3 com 62% na 532, 4 com 39%
na 501. Nenhuma ganha em tudo.
Objetivos do Comum: 1, 16, 67, 81, 95, 96, 181, 182, 483, 539 (os obj. 7 e 8 passam para o Ano 4).
A vitória do Comum (52%) fica acima dos ~30% do plano de sobrevivência. Se o game-director quiser
voltar perto de 30%, a próxima alavanca é a 1 ao contrário do crescimento (por exemplo
`familyIntervalWeeks` 6 → 7). Não medi essa alavanca.

### C: fome no inverno no limite (39%, alvo 40–60%)
Fica 1 ponto abaixo, e cai para 27% com a manutenção depois do obj. 4. Testei a alavanca 2
(`winter.foodFactor` 1,25 → 1,4) junto com o combinado e com os `fromYear` de J: o Comum caiu de 62%
para 46% de vitória e as derrotas subiram de 2 para **11**. Não recomendo agora: o inverno já mata a
cidade do Distraído, e a regra da derrota só muda no P5. Sugiro medir C de novo depois do P5. A
primeira fome do Comum nunca vem no primeiro inverno (0% das partidas, contra 21% na base): a
reserva da porta e a comida da caravana seguram o Ano 1, e a fome aparece do Ano 3 em diante.

### D (passa, mas com alerta): o Distraído perde em 63%
Ninguém perde antes da semana 150, mas 63% perdem por dívida depois (mediana sem. 303, Ano 6).
O ciclo é sempre o mesmo: as casas sobem sozinhas e passam a comer mais do que a cidade produz.
O Distraído só reage na fome, e nessa hora a prata já foi para a manutenção. Vem a fome, ele demole
para pagar a dívida e fica 24 semanas com a prata um pouco abaixo de zero. Perde com ~30 moradores.
`debtWeeksToLose=36` não muda nada (63 → 63). Isso contraria o pilar "perder exige a cidade quase
vazia" e é assunto do P5 (derrota de verdade). Nenhum número de `src/data` resolve sem dar prata
demais aos outros bots (o imposto 3/3 baixa para 31, mas o Comum vai a 87% de vitória e F a 93).

### J: objetivos amontoados no Ano 2
**Causa.** O Ano 2 é o ano da evolução: as 9 casas do Ano 1 sobem de tenda a casa grande em
3 × 13 semanas (moradores 50 → 184). Por isso os objetivos 3, 4, 5 e 6 vencem todos no Ano 2.
Depois, a família rara (uma a cada ~8 semanas) faz a população andar devagar (Ano 3: 204, Ano 5:
246, Ano 8: 344).
Medi duas correções:
- `fromYear` 3, 4, 5, 6, 7 nos objetivos 4 a 8: J passa (anos 1,1,2,2,3,4,5,6,9,9), mas F vai a
  72 (com `houses.4.tax=3`) e a 84 (com o combinado: vitória 62%, 2 derrotas), porque o jogador cumpre
  a meta e fica esperando o ano com a prata parada.
- Metas maiores (obj. 5 = 200, obj. 6 = 4 grandes, obj. 7 = 300, obj. 8 = 10 grandes, obj. 9 = 400),
  junto com o combinado: vitória 51%, F 27 (a espera passa para o objetivo 8).

J e F puxam para lados opostos enquanto a única coisa para comprar no fim for o templo. **Não proponho
número para J agora.** Para o game-director: aceitar J como "≤ 2 por ano, exceto o Ano 2 (ano da
evolução)", ou esperar o P2/P3 (materiais e outros destinos para a prata) e então espaçar os
objetivos com `fromYear`.

### Bots (propostas para `tools/sim`, medidas numa cópia no scratchpad)
- **B1. Cidade fechada:** em `place()`, quando `spotFor(kind)` não acha lugar para celeiro, campo,
  pescador, coletora, poço ou mercado, tentar `spotFor(kind, false, true)` (rua longa, demolindo se
  for preciso), como já se faz para casa e templo. Efeito no Comum: F 28 → 17, vitória 40 → 39%.
  Os motivos `storage`/`food` nas sequências de F caem de 2594 para 183 semanas.
- **B2. Eficiente sem dívida:** o `affords()` deve contar a manutenção que vai começar (somar a
  manutenção dos prédios enquanto `upkeepCharged` for falso). Hoje ele lê um saldo sem manutenção e
  gasta tudo antes do objetivo 3. Para comparar: parar as ruas quando não há prata para poço + casa
  (B2b) piorou o Eficiente (31 → 20% de vitória). As ruas não são a causa.
- **B3. Templo:** quando o templo estiver liberado e houver prata para ele (+ 40), construir mesmo
  que o objetivo atual ainda não seja o 10. Um jogador faria isso. É necessário se o templo passar
  para o objetivo 8.
- **B4. Métrica F:** no sim, F deve parar de contar enquanto o jogador junta para um templo
  liberado e ainda não construído (o "F honesto" deste relatório).

## 5. Relatório K (atual, Comum, salvo indicação)

**Moradores no fim de cada ano (mediana)**
| Bot | A1 | A2 | A3 | A4 | A5 | A6 | A7 | A8 | A9 | A10 | A11 | A12 | A13 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Eficiente | 50 | 188 | 232 | 290 | 342 | 372 | 402 | 438 | 438 | 438 | 442 | 444 | 448 |
| Comum | 50 | 184 | 204 | 224 | 246 | 290 | 312 | 344 | 396 | 398 | 400 | 398 | 368 |
| Distraído | 22 | 48 | 106 | 134 | 148 | 170 | 192 | 210 | 222 | 242 | 262 | 280 | 316 |
| Pescador | 46 | 120 | 242 | 274 | 310 | 328 | 346 | 360 | 372 | 380 | 390 | 390 | 396 |

**Porta das famílias por ano (Comum, % das semanas)**
| Ano | Espera | Comida | Celeiro | Aberta | Água | Sem lote | Fome |
|---|---|---|---|---|---|---|---|
| 1 | 59 | 9 | 1 | 24 | 8 | 0 | 0 |
| 2 | 42 | 24 | 13 | 17 | 4 | 0 | 0 |
| 3 | 26 | 23 | 17 | 14 | 12 | 6 | 2 |
| 4 | 28 | 15 | 21 | 14 | 8 | 12 | 2 |
| 5 | 32 | 17 | 17 | 16 | 9 | 8 | 1 |
| 6 | 30 | 16 | 22 | 14 | 11 | 7 | 1 |
| 7 | 33 | 15 | 19 | 15 | 11 | 5 | 1 |
| 8 | 34 | 15 | 16 | 16 | 12 | 6 | 1 |
| 9 | 36 | 13 | 13 | 15 | 13 | 8 | 2 |
| 10 | 37 | 13 | 14 | 16 | 12 | 7 | 1 |

Eficiente: a partir do Ano 5, "sem lote" fica em 44–61% (o planejador só põe casa onde já há poço e
fora do raio do altar, e fica sem lugar). Pescador: "comida" sobe de 38% (Ano 1) para 81% (Ano 10):
sem campos, rio e árvores não bastam para 400 pessoas.

**Comida por fonte e estrago**
| Bot | Campo | Pescador | Coletora | Estragada (% do produzido) |
|---|---|---|---|---|
| Eficiente | 88% | 8% | 3% | 29% |
| Pescador | 0% | 82% | 18% | 1% |
| Comum | 67% | 21% | 11% | 18% |
| Distraído | 76% | 8% | 16% | 16% |

**Casas por nível na vitória (mediana tenda/barro/pedra/grande):** Eficiente 0/2/25/13,
Comum 1/5/30/11, Distraído 2/3/28/8, Pescador 0/1/20/15.

**Outros:** seca, mediana de 2 anos por partida (Comum), 0 semanas de fome nos anos secos. Construídos
pelo Comum (mediana): 50 casas, 11 celeiros, 9 poços, 8 campos, 7 mercados, 5 oficinas,
4 pescadores, 4 coletoras, 5 demolições por dívida e 5 casas sem água demolidas.

## 6. Resumo das propostas (nada aplicado; precisam do game-director)

| Arquivo | Campo | Antes | Depois | Critério | Efeito medido (Comum) |
|---|---|---|---|---|---|
| `goals.json` | obj. 8 `unlock` | – | `"temple"` | F | F 28 → 4, vitória igual (com bot B3) |
| `goals.json` | obj. 9 `unlock` | `"temple"` | – | F | (junto com o acima) |
| `rules.json` | `upkeepStartsAfterGoal` | 3 | 4 | C, I | derrotas 9 → 3, dívida no Ano 2 53 → 35%, vitória 40 → 52% |

Bots: B1, B2, B3 e B4 (seção 4). Sem número para J (conflito com F) nem para D (derrota no P5).

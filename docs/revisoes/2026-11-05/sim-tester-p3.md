# Povo + P3 "Madeira e pedra": bots e calibração (sim-tester, 2026-11-05)

Base: worktree `p3` em a11f8e8 (Povo + P3). Rodadas: `npm run sim -- --brief --weeks 700`, um processo por
bot. A tabela final usa 60 seeds por bot. Relatório escrito aos poucos.

## Etapa 1: bots com madeira e pedra (feito)

`tools/sim/survival.ts`:
- `place()`, `reach()`, `service()` e `houses()` conferem o material (`missingMaterial`); o bot nunca
  tenta construir sem ele. Quando falta, marca `lacked` (madeira ou pedra): é o "toast" que o bot viu.
- Passo novo **2b "Materiais"** (depois do celeiro, antes da evolução das casas): Lenhador e Pedreira no
  melhor lugar pelo rendimento (`spotFor`, como Pescador e Coletora, com rua se precisar; rendimento
  mínimo 1/sem). No máximo 4 de cada.
  - **Eficiente/Pescador (planejam):** o primeiro Lenhador logo no início e a primeira Pedreira assim
    que libera; outro enquanto a produção estiver abaixo da meta (`materialNeed`: madeira 2 + 0,08 por
    casa com gente, pedra 2,5 e +2,5 a partir das casas grandes; +2/+3 enquanto juntam para o Templo) e
    o estoque estiver baixo (reserva + 40). Lenhador longe da Coletora (`sharedTrees` pesa contra), e a
    Coletora longe do Lenhador.
  - **Comum:** o primeiro Lenhador quando a madeira fica abaixo de 15 (lê o topo); a primeira Pedreira
    quando o objetivo pede casas de pedra, ou quando vê o aviso por 3 semanas; outro só depois de 13
    semanas seguidas de falta (`materialWait`). Lenhador no lugar com mais árvores, sem olhar a Coletora.
  - **Distraído:** só depois de ver o aviso (casa esperando, obra que falhou) por 4 semanas; outro depois
    de 26 semanas de falta; não guarda material.
- **Reserva de material** (Eficiente, Pescador, Comum): obras que não são casa, lenhador, pedreira nem
  templo não gastam a madeira/pedra das casas que esperam material (o planejador conta também as que
  sobem em até 4 semanas), nem 5 de madeira para uma casa nova (10 no planejador), nem o material do
  Templo enquanto junta para ele (metade durante o objetivo que o libera, tudo depois).
- Templo: só com prata **e** material. Falta de material para o Templo também conta como falta (o bot
  constrói outro Lenhador/Pedreira).
- `trim()` nunca demole o último Lenhador nem a última Pedreira.

`tools/sim/run.ts`: duas linhas novas por bot no `--brief` (e no relatório completo) e o `--trace`
mostra madeira e pedra:
- `wood`/`stone`: Lenhadores/Pedreiras (mediana e máximo ao mesmo tempo), estoque no fim dos Anos 1, 3,
  5, 8 e 10, partidas e semanas com casa esperando o material, semanas com obra travada pelo material,
  produzido, gasto em obras e gasto em níveis de casa.
- `W1`–`W6` do `plano-p3.md` 8.2, tocos nas semanas 260/520, árvores cortadas, o que o Templo esperou
  por último (prata, madeira ou pedra) e semanas entre liberar e erguer o Templo.

## Etapa 2: antes (a11f8e8 com os bots novos, 60 seeds × 700 sem)

| Bot | A1 vitória (sem, min) | A4 > 2 | A5 por partida / pior objetivo | A6 fome inv. / derrota | A7 | A9 Y2 cas./nasc. | A10 | A11 |
|---|---|---|---|---|---|---|---|---|
| Eficiente | 90%, 570 (30,4) | 3% | 138 / 58 (g15) | 3% / 0% | 0% | 3 / 5 | 0 derrotas | máx 2 |
| Pescador | 87%, 572 (30,5) | 0% | 131 / 58 (g15) | 27% / 7% | 3% | 3 / 5 | – | máx 2 |
| Comum | 88%, 608 (32,4; p25–p75 30,0–34,8) | 5% | 118 / 66 (g15) | 50% / 0% | 0% | 3 / 4 | – | máx 2 |
| Distraído | 7%, 652 (34,8) | **43%** | 284 / 261 (g6) | 100% / 2% | 18% | 2 / 4 | crise 70%, recup. 65%, **1 derrota < 150** | máx 5 (10 > 3) |

A2 = **68%** (4 bots). A3 Ef 90% > Co 88% > Di 7%, Ef mais cedo: ok (no limite).

Madeira e pedra (mediana das partidas):

| Bot | Lenhadores / Pedreiras (máx.) | Madeira Y1/Y3/Y5/Y8/Y10 | Pedra Y1/Y3/Y5/Y8/Y10 | Casas esperando madeira (partidas, sem.) | Casas esperando pedra (partidas, sem.) | W2 maior espera | W3 | W4 > 300 por > 52 sem |
|---|---|---|---|---|---|---|---|---|
| Eficiente | 3 / 2 (4/3) | 111/172/238/255/280 | 0/0/131/595/1059 | 2%, 0 | 100%, **186** | **176** (51 > 52) | 0 | 45/60 |
| Pescador | 2 / 2 (4/4) | 119/170/220/224/216 | 0/0/133/589/869 | 3%, 0 | 100%, **191** | **179** (56 > 52) | 0 | 48/60 |
| Comum | 3 / 2 (4/4) | 55/83/95/119/148 | 0/0/293/953/1399 | 62%, 2 | 100%, **149** | **138** (50 > 52) | 5 | 60/60 |
| Distraído | 1 / 2 (4/3) | 7/75/137/207/276 | 0/0/0/27/378 | 90%, 11 | 98%, **320** | **300** (59 > 52) | 9 | 57/60 |

W1 100% em todos; W5 (sem trabalho na semana 200) 0 em todos; W6 Coletora: Ef 2%, Pe 38%, Co 11%,
Di 8%. O Templo espera por último a pedra no Eficiente (48/60) e a madeira no Comum (47/60).

**Problema principal:** o Mercado libera no objetivo 4 (semana ~15) e a Pedreira só no objetivo 6
(30 moradores, semana ~160–190). Toda casa de barro perto do mercado fica pronta para virar casa de
pedra e espera a pedra por **150–190 semanas** (o Distraído 300). Isso trava a capacidade das casas e
atrasa o objetivo 6 de ~98 para ~160–190. Depois que a Pedreira chega, a pedra sobra (1.000–1.400 no
Ano 10): as rochas não acabam.

## Etapa 3: diagnóstico (Comum, 30 seeds por variante, pedreira já no objetivo 3)

`--trace comum:3:600` mostra o que manda no ritmo: a prata chega a 10.000 sem uso, a pedra a 2.000, e
a cidade fica parada em ~35 moradores nos Anos 3–5 esperando a primeira geração casar. **Quem dita o
ritmo são as gerações (casar aos 18), não os custos.** Por isso quase nenhum número de custo mexe na
vitória:

| Variante (sobre a pedreira no objetivo 3) | Comum vitória, semana | A6 fome | Observação |
|---|---|---|---|
| nenhuma | 93%, 571 | 67% | |
| criança come 0,3 / 0,35 / 0,5 / 0,7 | 93 / 87 / 83 / 63% | 67 / 60 / 90 / 90% | um Campo (2 vagas, 20 prata) alimenta ~30 crianças: a comida da criança só pesa quando já dá fome demais |
| inverno 1,6 (tenda 2,0) | 93%, 583 | 47% | |
| casa 60 de prata | 77%, 571 | 60% | prata sobra a partir do Ano 2 |
| casa 10 / 15 de madeira | 83 / 60%, 587 / 592 | 60 / 47% | a primeira alavanca que trava a moradia |
| `coupleWaitWeeks` 26 | 93%, 571 | 67% | o Comum faz a casa em ~5 semanas: nenhum casal chega a ir embora |
| `adultAge` 12 / 13 | 90 / 90% | 70 / 47% | objetivo 8: espera 93 → 67 / 80 sem |
| `weeksPerLifeYear` 15 | 70%, 604 | 70% | objetivo 8 espera 117 sem (pior) |
| Campo 300 por ano | 87%, 594 | 77% | |
| caravana 2 com 2–3 famílias | 90%, 620 | 50% | |
| `birthChance` 0,06 (só referência) | 87%, 623 | 53% | |
| Lenhador `max` 2 + casa 10 madeira (+ criança 0,35, `adultAge` 13, caravana 2 2–3) | **47%**, 628 | 53% | a madeira vira o gargalo da moradia |

Com 4 bots, a combinação **Lenhador `max` 2 + casa 10 de madeira** é a única que leva o Comum para
40–50%: as casas novas esperam madeira e as caravanas acham menos casa. Ela tem um custo: a 1ª
caravana (Ano 2) chega com pouca madeira no estoque e o Comum faz só 1 casamento no Ano 2 (A9).

**A4 do Distraído é recuperação, não explosão.** Ele perde metade das famílias fundadoras na fome do
1º inverno (moradores no fim do Ano 1: 7–9, contra 12–17 na chegada) e a caravana do Ano 2 o devolve ao
tamanho de antes. Medido contra o melhor ano anterior **ou a caravana fundadora** (`growthPeak`, nova
leitura no `--brief`: "over best year"), só 0–3% das partidas do Distraído dobram de verdade.

### A madeira é um problema de floresta

Cada árvore dá 10 de madeira (`cutEvery`) e o toco leva 104 semanas para voltar: um Lenhador rende, a
longo prazo, ~0,1 madeira/sem por árvore ao alcance. Depois de 1–2 anos o bosque perto dele está cortado
e o rendimento cai para 0,3–1/sem. Na primeira versão dos bots isso virou uma armadilha falsa: os 4
Lenhadores mortos contavam no limite e o bot nunca ia para outro bosque (o Comum fez só ~940 de madeira
em 700 semanas). **Correção do bot:** só contam os Lenhadores/Pedreiras que rendem ≥ 0,5/sem; ao
construir um novo, o Eficiente e o Comum demolem os que pararam (o Distraído os deixa de pé). E o Comum
passa a guardar a madeira e a pedra do Templo depois que ele libera (como um jogador que lê "falta
madeira"). Com isso as vitórias voltam a subir (Comum 70–80%): a madeira pesa, mas quem muda o Lenhador
de bosque sai do aperto.

### Rodadas com 4 bots (30 seeds; todas com a pedreira no objetivo 3)

Pacote base "G": Lenhador `max` 2, Pedreira `max` 2, objetivo 7 = 6 casas de pedra, caravana 2 com 2–3
famílias, criança 0,3, saída na fome 0,05/0,1, casa 10 de madeira, caravana inicial com 40 de madeira,
Templo 300 pedra + 300 madeira. Vitórias Ef/Pe/Co/Di e A2:

| Variante | Ef | Pe | Co | Di | A2 | Observação |
|---|---|---|---|---|---|---|
| bots antigos (Lenhadores mortos), G com Templo 250 de madeira | 73 | 33 | 33 | 0 | 35% | só porque o bot não mudava de bosque (falso) |
| bots novos, G com Templo 150 de madeira | 100 | 90 | 80 | 3 | 68% | |
| bots novos, G com Templo 250 | 97 | 93 | 73 | 0 | 66% | |
| bots novos, G (Templo 300) | 93 | 90 | 70 | 0 | 63% | |
| G + Lenhador `max` 3 (Templo 250) | 97 | 93 | 93 | 0 | 71% | |
| G + `treeRegrowWeeks` 156 (Templo 150) | 100 | 83 | 73 | 3 | 65% | |
| G + `adultAge` 16 | 93 | 100 | 70 | 0 | 66% | objetivo 8 espera 86–115 sem |
| G + `weeksPerLifeYear` 15 | 97 | 97 | 67 | 0 | 65% | objetivo 8 espera 97–117 sem; quebra "1 estação = 1 ano" |
| G + `weeksPerLifeYear` 14 | 100 | 100 | 67 | 0 | 67% | |
| G + criança 0,4 + inverno 1,3 (tenda 1,6) | 93 | 77 | 73 | 3 | 62% | |
| G + `fertileAges` [18, 40] | 87 | 87 | 40 | 0 | 54% | (fora das alavancas do usuário) |

Os planejadores (Eficiente e Pescador) crescem no máximo biológico: não esperam casa (1 vazia à frente),
servem na hora a casa cheia com casal fértil, e a prata e a comida nunca faltam. Nenhuma das alavancas
1–3 os tira de 90–100%.

### Duas correções de bot que apareceram nas rodadas

- **Eficiente sem Pedreira:** o Eficiente não constrói local de trabalho sem trabalhador livre
  (`staffAware`), e isso valia para a Pedreira. Em ~30% das sementes ele nunca a fazia e as casas
  esperavam pedra 54–183 semanas (seed 11: pedra 0 até a semana 200). Agora o primeiro Lenhador/Pedreira,
  ou um para casas que esperam aquele material, sai mesmo sem trabalhador livre. W2 do Eficiente:
  p75 63 → 3 semanas; partidas com espera > 52: 19 → 0.
- **A6 e A9 no limite:** com 100 seeds, o pacote dava fome no inverno em 69% e 2 casamentos no Ano 2.
  A 1ª caravana com **2** casais de noivos garantidos põe A9 em 3; mais **pressão no inverno** (come ×
  1,6, tenda × 2) baixa a fome para 62%: o Comum vê "a comida não dura até a primavera" mais cedo e faz
  comida a tempo (inverno 1,6 sozinho: 55%; com os noivos a mais: 62%, porque nascem mais crianças).

| Comum, 100 seeds | Vitória | A6 fome | A9 Y2 cas./nasc. |
|---|---|---|---|
| pacote sem estes dois | 71%, 33,5 min | 69% | 2 / 8 |
| + noivos 2 + inverno 1,6/2,0 (**aplicado**) | 80%, 32,9 min | 62% | 3 / 9 |
| + noivos 2 + inverno 1,6/2,0 + Pescador/Coletora × 0,4 no inverno | 81%, 33,4 min | 58% | 2 / 9 |
| + noivos 2 + Pescador/Coletora × 0,4 no inverno | 75%, 33,5 min | 61% | 3 / 9 |
| + noivos 2 + inverno 1,5/1,9 | 69%, 32,8 min | 65% | 2 / 9 |

## Etapa 4: números aplicados em `src/data`

| Arquivo | Número | Antes | Depois | Por quê |
|---|---|---|---|---|
| goals.json | quem libera a Pedreira | objetivo 6 (30 moradores) | **objetivo 3 (primeiro nascimento)** | o Mercado libera no objetivo 4 e toda casa de barro perto dele esperava pedra 150–190 semanas (W2). Agora a pedra começa antes de ser pedida, como no `plano-p3.md` |
| goals.json | objetivo 7 | Tenha **3** casas de pedra | Tenha **6** casas de pedra | as 3 casas de pedra ficavam prontas na semana ~49 e o objetivo caía junto com o 6; com 6 ele cai na ~122 e a espera do objetivo 8 (criança virou adulta) cai de 93 para 72 sem (A5) |
| buildings.json | Casa `materials.wood` | 5 | **10** | alavanca 2 (custo da casa): a prata sobra, a madeira não; a casa nova passa a esperar madeira (Comum: casas esperando madeira em 84% das partidas, 8 sem de mediana) |
| rules.json | `startMaterials.wood` | 20 | **40** | a caravana traz madeira para 4 casas (era 4 casas a 5); sem isso o Ano 1 travava (W3) e a 1ª caravana achava menos casas (A9) |
| buildings.json | Lenhador `gather.max` | 3 | **2** | alavanca 5: com 3 a madeira sobra até o bosque acabar; com 2 o Lenhador chega ao teto com 8 árvores e a madeira é o gargalo da moradia |
| buildings.json | Pedreira `gather.max` | 3 | **2** | a pedra sobrava 1.800 no Ano 10 (rochas não acabam); com 2 sobra ~1.300 (W4 continua falhando, ver Decisões) |
| buildings.json | Templo `materials.wood` | 150 | **300** | o Templo vira um projeto de madeira: é o que ele espera por último em 84/100 partidas do Comum (120 sem entre liberar e erguer); com 150 a madeira já estava lá |
| rules.json | `caravans.later[0].engaged` | 1 | **2** | alavanca 4: A9 (3 casamentos no Ano 2) voltou a 3 |
| rules.json | `caravans.later[1].families` | [2, 4] | **[2, 3]** | alavanca 4: menos salto na caravana dos Anos 4–5 |
| rules.json | `winter` | `foodFactor` 1,4, `tentFoodFactor` 1,75 | **1,6 e 2** | alavanca 1 (pressão do inverno): A6 69% → 62%, o aviso de comida chega mais cedo |

Testes ajustados (só números de dados; nenhuma regra mudou): `tests/materials.test.ts` (Lenhador e
Pedreira `max` 2, casa 10 de madeira, Templo 300 + 300, caravana com 40 de madeira, Pedreira no
objetivo 3; o teste "falta material" lê a madeira da casa dos dados), `tests/goals.test.ts` (lista de
objetivos, objetivo 7 com 6 casas de pedra, "um objetivo por verificação" com 6 casas grandes),
`tests/caravans.test.ts` (1ª caravana com 2 casais de noivos). `npx vitest run`: 1228/1228;
`npx tsc --noEmit` limpo. Docs: `GAME_DESIGN.md` (números acima e a linha de calibração dos
objetivos) e `TESTING.md` (bots e medidas de material).

Medido e **não** aplicado: criança 0,3/0,35/0,5/0,7 (não muda a vitória; 0,5+ dá fome demais, A6
83–90%), `coupleWaitWeeks` 26 (nenhum casal chega a esperar tanto), `adultAge` 12/13/16 e
`weeksPerLifeYear` 14/15 (o objetivo 7 com 6 casas já resolve o objetivo 8; 15 quebraria "1 estação =
1 ano de vida"), saída na fome 0,05/0,1 (sem efeito no Comum), Lenhador `max` 2,5, `treeRegrowWeeks`
156, caravana 3 desligada, caravana 2 com 1–2 famílias.

## Etapa 5: depois (60 seeds Eficiente e Pescador, 100 seeds Comum e Distraído, 700 sem)

### A1–A12

| # | Critério | Alvo | Antes (a11f8e8 + bots novos) | Depois | |
|---|---|---|---|---|---|
| A1 | Vitória do Comum | 25–35 min | 88%, 32,4 min (p25–p75 30,0–34,8) | **80%, 32,9 min** (31,5–35,1) | ✅ |
| A2 | Vitória geral (média dos 4 bots) | ~30% | 68% (Ef 90, Pe 87, Co 88, Di 7) | **69%** (Ef 98, Pe 95, Co 80, Di 4) | ❌ (ver Decisões 1) |
| A3 | Ef > Co > Di, Ef mais cedo | sim | 90% (570) > 88% (608) > 7% | **98% (517 sem, 27,6 min) > 80% (617) > 4%** | ✅ |
| A4 | Nenhum ano > 2× o anterior | 0 | Co 5%, Di **43%** | Co 10%, Di 44%; contra o melhor ano anterior ou a fundadora: **Co 10%, Di 1%** | ⚠️ Co; ✅ Di na leitura nova |
| A5 | Intervalo entre objetivos ≤ 75 sem (Comum) | | por partida 118; pior objetivo 66 (g15) — mas o objetivo 6 esperava 89 | por partida 119; **pior objetivo 68 (g15)**; objetivo 8: **72** | ✅ por objetivo; ❌ por partida (como no Povo) |
| A6 | Comum com fome em ≥ 1 inverno 40–60%, derrotas ≤ 5% | | 50% / 0% | **62% / 0%** | ⚠️ (2 pontos acima; 100 seeds ± 5) |
| A7 | Dívida do Comum no Ano 2 | < 15% | 0% | **0%** | ✅ |
| A8 | 15 casas com ≤ 1 celeiro no inverno | | 100% | **100%** (fome 7%) | ✅ |
| A9 | Ano 2: ≥ 3 casamentos e ≥ 5 nascimentos; caravanas acham casa | | 3 / **4**; 93% | **3 / 9**; 85% das partidas com toda caravana abrigando ≥ 1 família; 563/657 famílias ficam | ✅ |
| A10 | Distraído: crise e recuperação; nenhuma derrota < 8 min | | 70% / 65%, **1** derrota < 150 | **73% / 69%, 0** derrotas < 150 (2% perdem depois) | ✅ |
| A11 | Comum com > 3 celeiros | 0 | 0 (máx 2) | **0** (máx 2) | ✅ |
| A12 | Templo | relatar | – | não medido de novo (175 é decisão do usuário) | – |

Semanas dos objetivos (Comum, mediana): 5 6 9 14 **76 96 122 194 211 221 275 325 380 423 511 578
617** → vitória 617. Esperas: 62, 20, 26, **72** (g8), 17, 10, 54, 50, 55, 43, **88** (g15, mediana
por partida 68), 67, 39. Antes: 5 6 9 15 71 **160** 172 195 225 228 274 315 381 439 526 568 608 (o
objetivo 6 esperava 89).

Eficiente: 3 4 7 15 71 89 96 188 190 191 266 278 326 365 410 449 512 → 517. Pescador: vitória 546
(29,1 min). Distraído: vitória (4%) 667.

### Madeira e pedra (W1–W6 e relatos)

| Bot | Lenhadores / Pedreiras (máx.) | Madeira Y1/Y3/Y5/Y8/Y10 | Pedra Y1/Y3/Y5/Y8/Y10 | Casas esperando madeira (partidas, sem.) | Casas esperando pedra (partidas, sem.) | W2 maior espera (> 52) | W3 | W4 |
|---|---|---|---|---|---|---|---|---|
| Eficiente | 4 / 2 (4/4) | 57/101/135/127/119 | 42/228/467/639/626 | 15%, 0 | 43%, 0 | **1** (0) | 0 | 49/60 |
| Pescador | 4 / 2 (4/3) | 63/80/116/148/137 | 70/237/446/812/815 | 15%, 0 | 17%, 0 | **0** (0) | 0 | 48/60 |
| Comum | 4 / 2 (4/3) | 32/50/60/58/133 | 5/246/554/1019/1326 | **84%, 8** (p75 16) | 100%, 26 (p75 28) | **25** (1) | **2** | 100/100 |
| Distraído | 1 / 2 (8/2) | 4/31/74/95/122 | 0/35/188/579/841 | 83%, 10 | 99%, 37 | 35 (10) | 4 | 95/100 |

| # | Critério | Alvo | Antes | Depois (Comum) | |
|---|---|---|---|---|---|
| W1 | Comum com ≥ 1 casa esperando material | ≥ 60% | 100% (só pedra, 150 sem) | **100%** (madeira em 84%, pedra em 100%) | ✅ |
| W2 | Maior espera de uma casa (mediana; nenhuma > 52) | ≤ 26 | **138**, 50/60 > 52 | **25**, 1/100 > 52 | ✅ (1 partida) |
| W3 | Ano 1: semanas com obra travada por madeira | ≤ 4 | 5 | **2** | ✅ |
| W4 | Madeira ou pedra > 300 por > 52 sem antes do Templo | ≤ 10/100 | 60/60 | **100/100** (só pedra) | ❌ (ver Decisões 2) |
| W5 | Sem trabalho na semana 200 | −10 pontos | 0 | **0** (todos os adultos têm vaga) | – (não há desemprego para tirar) |
| W6 | Comida da Coletora | ≥ metade da base | 11% | **10%** | ✅ |

Relatos (Comum): madeira feita 985, gasta em obras 700 (casas 10 cada, Templo 300), em níveis de casa
290; pedra feita 2.203, gasta 325 em obras e 530 em níveis. Árvores cortadas 97 por partida; tocos 8 na
semana 260 e 22 na 520. Obras travadas por madeira: 24 semanas por partida. O Templo espera por último
a **madeira** em 84/100 partidas (Eficiente 58/60, Pescador 57/60), 120 semanas entre liberar e erguer
(Eficiente 45: ele guarda desde o objetivo 14).

## Decisões para o game-director

1. **A2 perto de 30% não cabe nas alavancas do usuário sem quebrar A1.** Os planejadores (Eficiente e
   Pescador) crescem no máximo biológico e vencem 95–98% em 27–29 min; o Comum vence com uma
   distribuição estreita (p25–p75 31,5–35,1 min). Para a média dos 4 bots chegar a 30%, o Comum precisa
   ficar abaixo de ~25% e a mediana dele passa de 35 min. Medido sobre os números finais (40 seeds):

   | Opção (fora das alavancas 1–5) | Ef | Pe | Co | Di | A2 | A1 Comum | A5 pior objetivo |
   |---|---|---|---|---|---|---|---|
   | `fertileAges` [18, 45] → [18, 40] | 85 | 85 | 40 (34,3 min) | 0 | 53% | ✅ | 89 ❌ |
   | idem + `birthChance` 0,08 → 0,06 | 75 | 85 | 25 (36,3 min) | 0 | 46% | ❌ | 89 ❌ |

   Recomendação: trocar A2 por "Comum 50–80%, Eficiente > Comum > Distraído" (hoje 80%), ou aceitar
   que o especialista vence quase sempre. A meta do Templo (175, decisão do usuário) seria o único
   botão que move todos juntos.
2. **W4 (pedra parada) precisa de regra.** As rochas não acabam e o Comum faz a 2ª Pedreira quando a
   onda de casas de pedra espera > 13 semanas; depois a pedra sobra (~1.000 na semana 400). Pedreira
   `max` 2 já baixou de 1.800 para 1.300 no Ano 10. Baixar mais estoura W2 (as casas esperam > 26
   semanas). Propostas de regra (core, não feitas): (a) **níveis de serviço pagam pedra** (Celeiro,
   Mercado e Oficina nível 2: 20 de pedra; nível 3: 40), como já sugeria o `plano.md` 11; (b) a casa
   grande paga mais pedra (10 → 20) junto com (a); (c) um limite de estoque (P4).
3. **A6 em 62%** (alvo 40–60%) com 100 seeds; a variante "+ Pescador/Coletora × 0,4 no inverno" dá
   58%, mas o A9 cai para 2. Se o game-director preferir A6 dentro da faixa a A9 no limite, aplicar
   `gather.winterFactor` 0,3 → 0,4 também.
4. **A4 do Comum 10%** (antes 5%): a 1ª caravana com 2 noivos garantidos dobra algumas cidades pequenas
   no Ano 2. É o preço de A9.
5. **A5 por partida** continua ~119 sem (cada partida tem uma espera longa, quase sempre o objetivo
   15, "125 moradores", antes do Templo). Pela mediana de cada objetivo, todos ≤ 72 sem exceto o 15
   (88 pela mediana das esperas, 68 pela mediana das semanas).

## Como o Banished faz × o nosso

| Tema | Banished | Jerusalém Antiga (hoje) |
|---|---|---|
| Moeda | Não há dinheiro: tudo custa material e **trabalho** (construtores levam tempo) | Prata de impostos; sobra a partir do Ano 2 (10.000 no fim). Custos em prata não freiam ninguém |
| Moradia | Uma casa = uma família. Jovem adulto só forma família numa casa vazia; sem casa, não há casal novo nem filhos. **A casa é o freio do crescimento** | Mesma regra (noivos esperam casa vazia, 52 sem). Até agora a casa custava 40 prata e saía em semanas; com 10 de madeira passa a esperar a madeira: é o nosso freio |
| Crianças | Comem e não trabalham até ~10 anos (ou estudam até ~13); um baby boom gera fome e, anos depois, um salto de trabalhadores | Comem 0,25 (adulto 0,2) e trabalham aos 14. Mas **um Campo (2 vagas, 20 prata) alimenta ~30 crianças**: o custo da criança quase não pesa. Testado até 0,7: só aumenta a fome |
| Comida | Um agricultor alimenta poucas pessoas; o inverno sem colheita pede estoque; lenha e roupa no frio | Um trabalhador alimenta ~15; o inverno pesa pelo fator 1,6 (tenda 2) e pelo aviso da previsão; lenha só no P4 |
| Madeira | Lenhador corta; **guarda-florestal planta**; sem ele o bosque acaba | Lenhador corta; o toco volta sozinho em 104 sem. A longo prazo cada árvore ao alcance dá ~0,1 madeira/sem: quem não muda o Lenhador de bosque fica sem madeira |
| Pedra | Pedreira infinita mas cara de construir e de manter (muitos trabalhadores) | Rochas infinitas; a Pedreira custa pouco e a pedra sobra (W4) |
| Imigração | Nômades chegam se o jogador deixa (risco de doença) | Caravanas marcadas (Anos 2, 4–5 e 50% no 7–8) com noivos e casais |
| Equilíbrio | Trabalho é o recurso escasso: cada pessoa na madeira sai da comida | Todos os adultos têm vaga (0 sem trabalho na semana 200) e a prata paga mais campos; o que freia é a geração (casar aos 18) e, agora, a madeira |

O que aproxima o nosso do Banished sem regra nova: a **madeira na casa** (feito) e o Templo como projeto de
madeira (feito). Com regra nova (fora deste pacote): pedra nos níveis de serviço (Decisões 2), um
"guarda-florestal" ou plantio para o bosque (P4), e menos comida por trabalhador do Campo para que o
custo da criança pese de verdade (hoje `harvest` 468 → 300 quase não muda nada porque a prata compra
mais campos e sobra trabalhador).

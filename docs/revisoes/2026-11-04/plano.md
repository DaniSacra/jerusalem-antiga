# Plano 2026-11-04: sobrevivência e contemplação (game-director)

Base: `plano-sobrevivencia.md` (plano do usuário, fonte principal), `docs/design.md`, `src/data/*.json`,
`src/core` (houses, families, economy, harvest, forecast, goals, alerts, simulation),
`tools/sim/survival.ts` e os relatórios de `docs/revisoes/2026-11-03/` (sim-tester-pacote1,
playtester-pacote1, plano-pacote2). Nenhum código, dado ou teste foi alterado por este plano.

Rumo novo: partidas de cerca de 30 min (uns 10 anos de jogo), crescimento lento e conquistado, casas
difíceis, inverno que pesa, vitória com o templo e 500 moradores.

## 0. O Pacote 2 "Anos que contam" (plano-pacote2.md) fica superado
| Item do P2 | Destino | Motivo |
|---|---|---|
| Celeiro `upkeep` 2 → 1 | **Absorvido no P1** | Medido: tira a dívida rasa do inverno |
| Altar `radius` 3 → 4 | **Absorvido no P1** | Medido: era a única trava real; agora o jogo pede muitas casas grandes |
| Desemprego conta o campo congelado | **Absorvido no P1** (item 1.6) | Mesma regra, pedida pelo usuário |
| Textos que mentem (toast "hora de plantar", "acaba no inverno", "cheio" só quando estraga) | **Absorvido no P1** (1.11) | Só texto; continua errado hoje |
| Campo `harvest` 468 → 312 | **Vira alavanca** (seção 2.4) | O inverno mais caro vem antes; mexer nas duas coisas junto esconde a causa |
| `familyIntervalWeeks` 2 → 3 | **Descartado** | Substituído por 6 + `familyChance` 0,35 |
| Meta 3 "Colha 100 de comida" | **Descartado** | A colheita sai dos objetivos |
| Câmera do tutorial nos passos do campo e do poço (2.6) | **DEPOIS (P2)** | O passo do poço some quando a água sair |
| Toasts sobre o inspetor, fila velha (2.7) | **DEPOIS (P2)** | Interface; o P2 já mexe no tutorial e nos toasts |
| Aceite "Comum vence em 4–6,7 min" | **Descartado** | O alvo agora é 25–35 min |

## 1. Roteiro dos pacotes
Ordem proposta. Muda em relação ao plano do usuário: a seca no Ano 3 (antigo 12) entra no P1, porque
é um número só (`safeYears`); e a recuperação (antigo 6) vem antes das obras com tempo (antigo 5). O
número antigo está entre parênteses.

| # | Pacote | Objetivo | Risco |
|---|---|---|---|
| 1 | Ritmo (1 + 12) | Ano em 2,5–3 min, Ano 1 com 6–10 casas, 10 objetivos em ~10 anos, inverno que pesa, prata que não sobra | Muitos números ao mesmo tempo; a calibração pode levar mais de uma rodada |
| 2 | Água sai e mapa (2) | Casas evoluem por jardim (praça e parque), mercado e altar; mapa com mais bosques e rochas | Sem o poço, o Ano 1 perde uma decisão; o tutorial muda |
| 3 | Madeira e pedra (3) | Lenhador e pedreira; materiais no custo das obras e das evoluções; árvores cortadas reduzem a Coletora | Duas matérias-primas de uma vez podem confundir: mostrar só a madeira no Ano 1 |
| 4 | Lenha e inverno (4) | Lenha no inverno, "lenha até", neve nas casas, reserva do celeiro | O inverno pode ficar duro demais em cima do P1; medir com o P1 já calibrado |
| 5 | Recuperação (6, parte 1) | A dívida trava obras e as famílias vão embora aos poucos; derrota só com a cidade quase vazia; "Jerusalém resistiu" | Sem derrota, a dívida pode virar só incômodo; a pressão tem que vir da cidade encolhendo |
| 6 | Obras com tempo + templo (5 e 6, parte 2) | Canteiro e construtores; o templo leva várias estações e pede pedra e madeira; calibrar ~30% de vitórias | É o pacote que fecha a duração; ele depende de 3, 4 e 5 estarem estáveis |
| 7 | Moradores (7) | Nomes, ficha, três idades, nascimentos e mortes, caravanas anunciadas | Custo por quadro e estado grande; a ficha não pode poluir o celular |
| 8 | Casamentos e moradia (8) | Casais pedem casa própria; primeiro casamento; alojamento | Casamento pode virar só "mais casas"; tem que pesar na moradia |
| 9 | Governo (9) | Imposto em % (início 20%) e porção do povo | Duas alavancas novas na tela do celular |
| 10 | Evoluções (10) | Campo grande, oficina com tipos e níveis (ferramentas) | Substitui o bônus provisório da oficina do P1 |
| 11 | Pasto e roupas (11) | Comida no inverno, couro, roupa contra o frio | Pasto não pode repetir o campo |
| 12 | Doenças (13) | Idosos precisam de cuidado; construção de cura | Depende do P7 (idades) |
| 13 | Eventos da época (14) | Vizinhos, decretos, caravanas, mercadores, com aviso prévio | Eventos ruins demais quebram a recuperação |
| 14 | Incêndio (15) | Fogo com aviso e resposta | A proteção precisa ser definida sem o poço |

Por que a recuperação vem antes das obras: os P3 e P4 deixam as crises mais fortes. Com a derrota de
hoje (24 semanas de dívida e a partida acaba de uma vez), elas viram derrotas secas e escondem o
equilíbrio. Já a calibração dos 30% de vitórias pede materiais e obras prontos, por isso ela fica no
P6, junto com as obras.

## 2. Pacote 1 "Ritmo": especificação

### 2.1 Pilares
- Fortalece o Ritmo contemplativo (casas sobem por estação, famílias raras), a Dificuldade em camadas
  (o Ano 1 só tem o inverno; a manutenção e a seca vêm depois) e a Sobrevivência (o inverno come mais).
- Evoluir em vez de multiplicar: casas maiores e oficina com teto.
- Risco para "Simples": a casa demora 13 semanas para subir e o jogador pode achar que o poço não
  funcionou. Controle: o balão da casa mostra "Casa de barro em N sem" (1.10).
- Uma mecânica por vez: a única regra nova de verdade é o tempo de evolução. O bônus da oficina troca
  a saída dela (prata → campo), a pedido do usuário. O resto são números e correções.

### 2.2 Números e regras (valor atual → novo)
**Casas (`houses.json`)**
| Nível | Moradores | Imposto/sem | Comida por morador/sem |
|---|---|---|---|
| Tenda | 3 → **4** | 1 → **1** | 0,2 → **0,2** |
| Casa de barro | 6 → **6** | 2 → **1,5** | 0,15 → **0,2** |
| Casa de pedra | 10 → **10** | 3,5 → **2,5** | 0,2 → **0,2** |
| Casa grande | 16 → **20** | 6 → **3** | 0,22 → **0,2** |
| (futuro) Casa senhorial | 30 | – | – (só registrada; entra no P10) |

Imposto: 0,25 por morador até a casa de pedra e 0,15 na casa grande. Assim o salto de população do fim
do jogo não vira montanha de prata. A comida fica igual em todos os níveis (0,2), e a diferença vem do
inverno (abaixo).

**Evolução das casas (`rules.json` + `simulation.ts`)**
- 1.1 `weeksToChange` 3 → renomear para `weeksToDowngrade` **3** (cair continua rápido).
- 1.2 Novo `weeksToUpgrade` **13**: uma casa sobe um nível depois de 13 semanas seguidas com as
  necessidades do próximo nível atendidas.
- 1.3 Em fome, a contagem **pausa** (hoje zera). Perder uma necessidade continua zerando a contagem.
  Motivo: um inverno com fome já atrasa o bairro; zerar 13 semanas por causa de uma semana ruim seria
  punição sem explicação.

**Famílias (`rules.json` + `families.ts` + `forecast.ts`)**
- 1.4 `familyChance` 0,6 → **0,35**; `familyIntervalWeeks` 2 → **6** (com a porta aberta, uma família a
  cada ~8 semanas em média; com a porta fechada parte do ano, ~4 a 6 por ano).
- 1.5 Nova regra: a porta só abre se a comida prevista, até a próxima primavera (com as famílias a
  caminho e a nova), nunca cair abaixo de `familyFoodReserveWeeks` **4** semanas do consumo planejado.
  Hoje basta não chegar a 0. O motivo continua `food` (ou `storage`, se só o estoque corta).
- 1.5b `plannedEating` conta cada casa no máximo **1 nível acima** do atual (hoje vai até o nível final).
  Com casa grande de 20 moradores, a previsão de hoje fecharia a porta só por construir um mercado.
- Casa nova (`buildings.json` `house.cost`) 15 → **30**. As tendas da caravana continuam de graça.

**Oficina (`buildings.json` + `economy.ts`/`harvest.ts`)**
- Oficina `silver` 5 → **sai**. Novo `fieldBonus` **0,1** por oficina ligada, com teto `fieldBonusMax`
  **0,3** (3 oficinas). O bônus multiplica a comida dos campos (`fieldHarvest`, por isso entra também
  na previsão). Ele exige estar ligada à rua; os trabalhadores contam pela eficiência da cidade, como
  toda produção. Não vale para pescador e coletora. A 4ª oficina só dá vagas.
- Campo `silver` 1 → **sai**. A prata passa a vir só de impostos e prêmios. Isso também acaba com a
  dívida rasa do inverno (o campo congelado deixava de pagar).

**Desemprego (`economy.ts`)**
- 1.6 `Economy` ganha `yearJobs`: as vagas de toda construção ligada, campo congelado incluído.
  `unemployed`, `unemploymentAlert` e `idleShare` (alegria) usam `yearJobs`. A eficiência e a
  produção continuam com as vagas da semana. Em uma frase: "no inverno o agricultor descansa; ele
  não está desempregado".

**Inverno (`rules.json` + `economy.ts` + `forecast.ts`)**
- 1.7 Novo `winter` { `foodFactor` **1,25**, `tentFoodFactor` **1,5** }: no inverno cada morador come
  ×1,25 e quem mora em tenda come ×1,5 (no lugar de 1,25). A previsão usa o fator de cada semana.
- `drought.safeYears` 1 → **2** (a primeira seca possível passa a ser na primavera do Ano 3, como
  pedem as fases).

**Prata (`rules.json`, `buildings.json`)**
- Entrada menor: impostos da tabela acima, oficina e campo sem prata.
- Saída maior: casa 30.
- `upkeepStartsAfterGoal` 3 → **2** (a manutenção começa no fim do Ano 1, depois do objetivo 2: o Ano 1
  tem só o inverno).
- Celeiro `upkeep` 2 → **1**; altar `radius` 3 → **4** (vindos do P2).
- Sem mudança: `startSilver` 180, os outros custos, a manutenção dos outros prédios e o templo 800.

**Templo**
- Liberado pelo objetivo 9 "Chegue a 500 moradores", que só conta a partir do Ano 8 (`fromYear` 8). O
  custo continua 800. Na hora de construir não se confere de novo a população (KISS).

**Tempo**
- `weekSeconds` 2,5 → **3,2** (1 ano = 166 s = 2,8 min), aplicado só depois de os critérios em semanas
  passarem (2.4). Até lá, o sim-tester mede em semanas.

### 2.3 Objetivos (`goals.json` reescrito)
Novo campo opcional `fromYear`: o objetivo só se cumpre a partir desse ano, e a lista mostra
"a partir do Ano N". Saem os tipos `harvest` e `water` do arquivo. O código do `water` fica até o P2;
o do `harvest` sai junto, com os testes. "Primeira colheita" continua como marco.

| # | Texto (rascunho; o copywriter fecha) | Alvo | Prêmio | Libera | Ano esperado (Comum) |
|---|---|---|---|---|---|
| 1 | Comida até a primavera | `foodUntilSpring` | +30 | **Celeiro** | Ano 1, outono |
| 2 | Tenha 3 casas de barro | casas nível 2 × 3 | +40 | (manutenção começa) | Ano 1, primavera |
| 3 | Chegue a 60 moradores | 60 | +50 | Mercado | Ano 2 |
| 4 | Tenha 3 casas de pedra | casas nível 3 × 3 | +60 | Oficina | Ano 3 |
| 5 | Chegue a 150 moradores | 150 | +80 | Jardim | Ano 4 |
| 6 | Tenha 2 casas grandes | casas nível 4 × 2 | +100 | – | Ano 5 |
| 7 | Chegue a 250 moradores | 250 | +120 | – | Ano 6 |
| 8 | Tenha 6 casas grandes | casas nível 4 × 6 | +150 | – | Ano 7 |
| 9 | Chegue a 500 moradores | 500, `fromYear` 8 | +200 | Templo | Ano 9 |
| 10 | Construa o Templo | 1 | vitória | – | Ano 10 |

- O celeiro vem com o objetivo 1. Ele já estragava comida na semana 2, sem ação possível
  (playtester). Agora quem planta cedo já pode guardar para o inverno.
- O "Construa 2 oficinas" sai: a oficina é um bônus com teto, não uma obrigação.
- O "Água para todas as casas" sai: a porta já ensina a água (motivo `water`), e a água sai no P2.
- Tutorial: os passos não mudam. O mini passo `upkeep` passa a vir depois do objetivo 2.

### 2.4 Critérios de medição
sim-tester: `npm run sim -- --seeds 100 --weeks 700`, os 4 bots. Linha de base: rodar o mesmo comando
em 11a95cd (`git worktree`), mais os números de `sim-tester-pacote1.md`. Tudo medido em semanas;
minutos com `weekSeconds` 3,2.

| # | Critério | Alvo |
|---|---|---|
| A | 1 ano a 1x | 2,5–3 min (com 3,2 s: 2,8 min) |
| B | Comum, casas com família ligadas na semana 52 (mediana) | 6–10 |
| C | Comum, partidas com fome em ao menos 1 inverno | 40–60%, com derrotas ≤ 2% |
| D | Distraído | ≥ 50% das partidas com crise (moradores ≥ 25% abaixo do pico, ou fome ≥ 4 sem seguidas) e recuperação (volta ao pico de antes); 0 derrotas antes da semana 150 (8 min) |
| E | Oficinas existentes ao mesmo tempo, Comum | máximo ≤ 4 em todas as partidas |
| F | Prata do Comum > 300 por mais de 26 semanas seguidas, antes de o templo ser liberado | 0 partidas |
| G | Vitória do Comum | mediana entre as semanas 469 e 656 (25–35 min a 3,2 s); relatar a taxa |
| H | Aberturas de 2, 3 e 4 famílias | nenhuma melhor em todas: sobrevivência no Ano 1, fome no Ano 1, casas na semana 52, taxa e semana da vitória |
| I | Continuam valendo | Comum e Eficiente sobrevivem ao Ano 1 em ≥ 95%; Eficiente sem dívida |
| J | Ritmo dos objetivos (Comum, mediana) | no máximo 2 objetivos no Ano 1 e no máximo 2 por ano depois; cada um a ±1 ano do esperado |
| K | Relatar | residentes por ano (semanas 52k), motivos da porta por ano, % da comida por fonte, estrago, casas por nível na vitória |

**Alavancas, em ordem de ajuste** (uma por rodada; a seguinte só se a anterior não bastar):
1. Crescimento rápido demais (B > 10, G cedo): `familyIntervalWeeks` 6 → 8 → `familyChance` 0,35 → 0,25
   → `familyFoodReserveWeeks` 4 → 6 → casa 30 → 40. Lento demais: a mesma ordem ao contrário, e
   depois altar `radius` 4 → 5 se as casas grandes travarem (objetivos 6 e 8).
2. Inverno fraco (C < 40%): `tentFoodFactor` 1,5 → 1,75 → `foodFactor` 1,25 → 1,4 → campo `harvest`
   468 → 390 → 312. Forte demais (C > 60%, I falha): ao contrário, depois caravana `foodWeeks`.
3. Prata parada (F): imposto da casa grande 3 → 2,5 → pedra 2,5 → 2 → casa 30 → 40. Prata curta (dívida
   do Comum no Ano 1 ou 2 > 5%): `upkeepStartsAfterGoal` 2 → 3 → imposto da tenda 1 → 1,25.
4. Oficinas (E): `unemploymentAlert` 6 → 10 → `workerShare` 0,5 → 0,4 → `happiness.idleMax` 20 → 10.
5. Distraído perde cedo (D): `debtWeeksToLose` 24 → 36 (a derrota de verdade muda no P5).
6. Por último, `weekSeconds` (A e G em minutos), entre 2,9 e 3,4.

Nenhum número fora desta lista entra sem aprovação do game-director.

### 2.5 Mudanças no core (com testes Vitest)
- `simulation.ts`: subir com `weeksToUpgrade`; descer com `weeksToDowngrade`; a fome pausa a subida.
- `economy.ts`: consumo de comida com o fator de inverno; `yearJobs`; `unemployed`/`unemploymentAlert`/
  `idleShare` com `yearJobs`; produção de prata só onde há `silver` (nenhuma construção hoje; o código
  pode ficar).
- `harvest.ts`: `fieldHarvest` × (1 + bônus das oficinas ligadas, com teto).
- `forecast.ts`: consumo por semana com o fator de inverno; `plannedEating` com no máximo +1 nível;
  opção de reserva para a porta.
- `families.ts`: reserva de `familyFoodReserveWeeks`.
- `goals.ts`: `fromYear`; saem os tipos `harvest` e `water` do uso (o código do `water` fica até o P2).
- `houses.ts`: função pura `weeksToNextLevel(s, b)` (null se falta necessidade ou se já está no topo)
  para o balão.
- Testes: subida em 13 semanas e queda em 3; fome pausa sem zerar; inverno ×1,25 e tenda ×1,5 no
  consumo e na previsão; bônus 0,1/0,2/0,3 e teto com 4 oficinas; oficina desligada não conta;
  desemprego igual no outono e no inverno com campos; porta fechada com reserva < 4 semanas e aberta
  com ≥ 4; `fromYear` segura o objetivo 9 até o Ano 8; seca nunca antes do Ano 3; viabilidade com os
  objetivos novos.
- Docs no mesmo trabalho: `docs/GAME_DESIGN.md` (casas, famílias, oficina, inverno, objetivos, prata,
  seca, tempo) e `docs/TESTING.md` (métricas novas do sim, se estiverem lá).

### 2.6 Interface e textos (copywriter e ui-designer)
- 1.10 Balão da casa tocada: "Casa de barro em N sem" (ou "Falta: poço", como hoje).
- 1.11 Textos que mentem (vindos do P2): o toast do outono sai de "hora de plantar"; a pílula diz "acaba
  no inverno"; "cheio" só quando estraga nesta semana.
- O copywriter revisa: os 10 textos de objetivo; "a partir do Ano 8" na lista e no cadeado do Templo
  ("Libera no objetivo 9 · Ano 8"); a dica e a prévia da Oficina ("+10% de comida dos campos, até +30%",
  com o total atual); a dica do Campo sem prata; o detalhe da prata nas Estatísticas (sem as linhas de
  Oficina e Campo); o aviso de desemprego (sem mandar construir oficina quando o bônus está no teto);
  o motivo `food` da porta ("Falta sobra de comida para mais uma família"); o aviso de inverno ("No
  inverno todos comem mais; nas tendas, mais ainda"); "manutenção depois do Objetivo 2"; o toast do
  Celeiro liberado no objetivo 1; e o texto do tutorial que cita números (lidos dos dados).
- Capturas a olhar: balão de casa, lista de objetivos, cadeado do templo, prévia da oficina,
  Estatísticas da prata, nos tamanhos 844 x 390 e 1366 x 768.

### 2.7 Bots (`tools/sim`, sem tocar em `src/`)
- Desemprego: todos usam o `unemployed()` do core, que agora já conta o ano. Sai o caso especial do
  `yearJobs` no gatilho; nas vagas do `staffAware`, use o `yearJobs` do core.
- Oficina por desemprego só enquanto o bônus estiver abaixo do teto (o jogador lê "até +30%"). No teto,
  nada.
- Saem os ramos dos objetivos `harvest`, `water` e "construir oficina". O Pescador passa a ter 0 campos.
- `settle()` sobe no máximo 1 nível (como a previsão nova).
- `plannerFields` e `plannerWantsGranary` usam o consumo com o fator de inverno (pela `foodForecast`).
- Templo: o planejador guarda a prata a partir do objetivo 10.
- Métricas novas: casas com família na semana 52; invernos com fome por partida; crise e recuperação
  (definição D); máximo de oficinas ao mesmo tempo; maior sequência com prata > 300 antes do templo ser
  liberado; moradores nas semanas 52k; semana da derrota; tabela das aberturas com todas as medidas
  de H; linha `--brief` com elas.

### 2.8 Estimativa
| Bloco | Tempo (uma pessoa) |
|---|---|
| Dados, regras do core e testes (2.2, 2.3, 2.5) | 4–5 h |
| Bots e métricas (2.7) | 2 h |
| Calibração do sim-tester (2 a 4 rodadas de 100 seeds × 4 bots × 700 semanas) | 3–5 h |
| Interface e textos (2.6) | 2 h |
| Docs, `test:visual`, capturas | 1 h |
| playtester e fun-critic no fim | 1,5 h |

Total: ~14–17 h de uma pessoa; numa sessão do Claude Code, ~5–7 h. O maior risco de prazo é a
calibração (critérios B, C e G puxam para lados diferentes): conte com uma rodada a mais com o
game-director (~1 h).

### 2.9 Fora do P1
Água e poço, madeira, pedra, lenha, nomes, casamentos, governo, eventos, campo `harvest` (só como
alavanca), casa senhorial, câmera do tutorial, fila de toasts.

## 3. Pendências recomendadas (a decisão é do usuário)
- **Campo grande 4x4 ou 6x6.** Recomendação: 4x4 com o dobro da comida, e "evoluir para 6x6" só se o
  playtest pedir. No mapa 48 x 48, um 6x6 ocupa o lugar de 9 casas.
- **Incêndio sem o poço.** Recomendação: o risco é maior em casas coladas e longe de praça ou do rio; a
  resposta é tocar no fogo para mandar vizinhos (tira trabalhadores por algumas semanas). Fechar no
  P14.
- **Construção de cuidado médico.** Recomendação: "Casa de cura", com raio; o idoso atendido não adoece.
- **O pescador continua?** Recomendação: sim. É a fonte de comida do rio e dá peso ao lugar.
- **Ano do templo.** Recomendação: Ano 8, como `fromYear` no objetivo dos 500 moradores, sem conferir de
  novo na hora de construir.
- **Capacidade das casas.** Recomendação: 4/6/10/20 agora e a senhorial (30) no P10. Com isso, 500
  moradores pedem ~20 casas grandes e ~10 de pedra (30–35 casas).
- **Ritmo de crescimento.** Recomendação: aceitar a curva do P1 (60 no Ano 2, 150 no Ano 4, 250 no Ano
  6, 500 no Ano 9); o crescimento grande vem das casas grandes, não de mais famílias.
- **Desemprego estrutural (achado meu).** Com `workerShare` 0,5, uma cidade de 150 moradores tem ~75
  trabalhadores e ~20 vagas sem oficinas. O P1 segura isso com o teto da oficina e a alavanca 4. O
  destino de verdade dos trabalhadores vem no P3 (lenhador e pedreira) e no P6 (construtores).
  Recomendação: não inventar empregos no P1.
- **Casas grandes antes do P2 (achado meu).** Até a água sair, a casa grande depende do raio do altar
  (4). Se os objetivos 6 e 8 travarem, use a alavanca `radius` 5 só até o P2.
- **Exceção ao "uma mecânica por vez".** O P1 traz várias regras pequenas (tempo de evolução, bônus da
  oficina, inverno, reserva da porta, `fromYear`). Recomendação: aprovar como bloco, como no Pacote 1 da
  sobrevivência, porque todas servem ao ritmo e nenhuma é um sistema novo.
- **Taxa de vitória no P1.** Recomendação: só relatar. Os ~30% se calibram no P6, com materiais e obras.
- **Imposto por casa agora e em % no P9.** Recomendação: os valores do P1 já dão ~0,25 por morador,
  então a troca para "20%" no P9 não deve mexer no equilíbrio.

## 4. Prompt de implantação do Pacote 1
```
Implemente o Pacote 1 "Ritmo" de docs/revisoes/2026-11-04/plano.md (seção 2).
Nada de água, madeira, pedra, lenha, nomes, casamentos, governo, eventos ou história.

Ordem:
1. Dados (2.2, 2.3) e regras do core (2.5), com testes Vitest. Docs GAME_DESIGN.md e TESTING.md.
2. Bots e métricas (2.7) em tools/sim.
3. sim-tester: 100 seeds x 4 bots x 700 semanas, linha de base em 11a95cd, critérios A–K.
   Ajuste só pelas alavancas da 2.4, na ordem; traga a tabela de cada rodada.
4. Em paralelo com o 3: interface e textos (2.6) com ui-designer e copywriter.
5. weekSeconds por último. npm test, tsc, build, test:visual; olhar as capturas da 2.6.
6. playtester e fun-critic no fim; relatórios ao game-director.

Não faça commit nem push sem uma ordem explícita do usuário.
```

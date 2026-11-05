# P4 "Lenha e inverno": escopo (game-director, 2026-11-05)

Base: `plano-sobrevivencia.md` (item 5 e "Lenha, madeira e pedra"), `plano-p3.md`, `decisao-p3.md`,
`sim-tester-p3.md` (W4), main em 8534702. O usuário disse "pode fazer tudo": as opções recomendadas
entram sem perguntar. Tamanho: cerca de 2 h de implementação e uma rodada de calibração do sim-tester.

## 1. O pacote numa frase

**No inverno, cada casa com gente queima lenha do estoque de madeira. Sem lenha, a cidade passa frio,
e o frio faz o mesmo que a fome faz com as casas.** Junto vai um ajuste que fecha o W4: o estoque
guarda no máximo 400 de madeira e 400 de pedra; cheio, o Lenhador e a Pedreira param.

Mecânica nova (uma): **lenha**. O limite do estoque não é uma mecânica nova. Ele copia a regra que já
existe para a comida, mas sem celeiro, e o usuário já tinha aceitado colocá-lo no P4 (`decisao-p3.md`,
"uma regra nova: manutenção em pedra ou limite de estoque").

## 2. Pilares

| Item | Fortalece | Enfraquece / risco | Decisão |
|---|---|---|---|
| Casas queimam lenha no inverno | 1 Sobrevivência (comida **e** lenha, como o usuário pediu); 6 Camadas (o Ano 1 ganha o 2º problema do inverno); 5 Evoluir (casa de pedra gasta menos lenha que tenda); 9 Posicionar (o bosque do Lenhador vale mais) | 7 Simples: um recurso a mais para olhar no inverno. Controle: é a madeira que já existe (sem "lenha" separada), com um aviso antes e um depois | **ENTRA AGORA**: é o P4 do roteiro; tem peso real sem criar construção nem recurso novo |
| Frio = efeito da fome nas casas | 1 (crise com volta: a lenha chega e o frio acaba); 7 (regra já conhecida) | Pode dobrar a dureza do inverno (fome + frio). Controle: critérios F1–F4 e alavancas | **ENTRA AGORA**: reaproveita o ramo da fome no código; nenhuma regra nova de saída |
| Estoque máximo 400 (madeira e pedra) | 3 Contemplação (sem pilha sem sentido); 9 (a Pedreira parada mostra que dá para mudar os trabalhadores de lugar) | Quem guarda para o Templo precisa de 300; o limite fica acima disso | **ENTRA AGORA**: fecha o W4 com um número e uma linha no código |
| Fumaça some sem lenha | 8 Cidade viva (dá para ver o frio no mapa) | – | **ENTRA AGORA**: a fumaça já existe (`paintSmoke`); só desliga com o frio |
| "Lenha até" no painel, gráfico de lenha | 7 | Tela nova | **DEPOIS** (P7 Estatísticas); por enquanto basta o aviso com o número |
| Roupas, guarda-florestal, plantio, depósito, lareira | 1, 9 | Cada um é uma mecânica | **FORA** deste pacote; roupas no P9, plantio quando o bosque for problema medido |
| Manutenção em pedra | – | Uma segunda regra de consumo; a pilha (~1.000) não some com valores pequenos | **FORA**: o limite resolve com menos regra |
| Frio afeta alegria, nascimentos ou mortes | 1 | Mais regras para explicar e calibrar | **FORA**: só as casas sentem o frio, como na fome |
| Reserva do celeiro ajustável (roteiro P4) | – | Não tem a ver com lenha | **DEPOIS**: só se um playtest pedir |

## 3. Regras (core)

1. **Queima.** Em cada semana de **inverno**, cada casa com gente (nível ≥ 1) queima
   `houses.json > firewood` do nível dela. O total sai de `s.wood` depois da produção da semana.
   Casa vazia (nível 0) não queima. No outono, na primavera e no verão não se queima lenha.
2. **Frio.** Se a madeira não basta para a queima da semana, a cidade queima o que tem, a madeira vai a
   0 e `s.cold = true`. Se basta (ou não é inverno), `s.cold = false`. Eventos `coldStart` e `coldEnd`,
   como em `famineStart` e `famineEnd`.
3. **Efeito do frio** = efeito da fome nas casas, com os números que já existem: em `updateHouse`, a
   condição passa de `s.famine` para `s.famine || s.cold`. A subida pausa, casa de nível > 1 cai com
   `famineDropChance` 0,12, tenda é abandonada com `winterFamineLeaveChance` 0,15 (o frio só existe
   no inverno). Fome e frio juntos fazem **um** sorteio por semana, sem somar. O frio também marca
   `winterLoss` (o marco "primeiro inverno vencido" não vem). O frio não mexe na alegria, nos
   nascimentos nem nas mortes.
4. **Limite do estoque.** `rules.json > materialStorage` 400. A produção da semana só entra até o
   limite (`ganho = min(produzido, max(0, 400 − estoque))`). Estoque acima do limite nunca é cortado.
   O corte de árvores conta **só a madeira que entrou**: Lenhador parado não derruba o bosque.
   Lenhador ou Pedreira com o estoque do seu material cheio rende 0 nessa semana. Os trabalhadores
   continuam na vaga (sem mudar o desemprego).
5. **Previsão da lenha** (função pura, uma por semana): `firewoodPerWeek(s)` = soma da queima das casas
   com gente; `firewoodShort(s, eco)` = no outono ou no inverno,
   `madeira + eco.wood × semanas até a primavera < firewoodPerWeek × semanas de inverno que faltam`.
   Devolve quanto falta (arredondado para cima) ou 0.
6. Nada de material novo: a lenha é a madeira. Construir pode gastar a madeira do inverno, e o aviso
   mostra isso. O jogo não guarda lenha sozinho (KISS; quem planeja aprende).

## 4. Números em `src/data`

| Arquivo | Chave | Valor | Conta |
|---|---|---|---|
| `houses.json` | `firewood` por nível | Terreno **0**, Tenda **0,3**, Barro **0,2**, Pedra **0,15**, Casa grande **0,15** | Ano 1: ~8 casas, metade tendas: ~0,25 × 8 × 13 = **26 por inverno**. Fim: 25 casas de pedra ou grandes: 0,15 × 25 × 13 = **49**. Ao todo, ~350–400 de madeira em 10 invernos (o Comum fez 985 no P3). Um Lenhador no teto (2/sem) faz 26 só no inverno |
| `rules.json` | `materialStorage` | **400** (madeira e pedra) | Acima dos 300 de pedra e de madeira do Templo. Com o Templo pago, a sobra no fim fica ≤ ~100 + algumas semanas de produção (W4b ≤ 15/100) |

Nada mais muda nos dados. Fora da calibração, os números atuais continuam: madeira inicial 40,
Lenhador `max` 2, rebrota 104, inverno 1,6/2.

## 5. Interface e textos (pt-BR; o copywriter afina, o sentido não muda)

- **Pílula Materiais (topo):** a madeira fica **vermelha** com `firewoodShort > 0` ou com frio (hoje já
  fica vermelha com casa esperando material). Nada de texto novo na pílula: no celular não cabe.
- **Avisos (core `alerts()`):**
  - `{ kind: 'firewood', missing, cold }`, logo depois de `foodShort`.
    - `cold: false`: "A lenha não dura o inverno: faltam N de madeira. Construa um lenhador"
    - `cold: true`: "Frio! Sem lenha, as casas esvaziam. Construa um lenhador"
  - `{ kind: 'storageFull', material }`, por último: "Estoque de pedra cheio (400): a pedreira parou"
    (ou madeira e lenhador)
  - `winterComing` (as 3 últimas semanas do outono): passa a valer com **qualquer casa com gente**.
    Texto: "O inverno está chegando: guarde lenha. As tendas sofrem mais"
- **Toasts:** `coldStart` "Frio! Acabou a lenha: construa um lenhador"; `coldEnd` "A lenha voltou: as
  casas se aquecem". Entram na fila de toasts que já existe (regra do P3: só 1 volta depois do balão)
- **Balão da casa tocada:** no outono e no inverno, uma linha "Lenha no inverno: N/sem" (o valor do
  nível). Com frio, a linha fica vermelha: "Frio: falta lenha"
- **Balão do Lenhador/Pedreira tocado e prévia:** "Parado: estoque cheio (400)" quando cheio. A dica
  do Lenhador na coluna passa a ser "Corta árvores: madeira para obras e lenha do inverno"
- **Mapa:** com frio, as casas não soltam fumaça (`paintSmoke` lê `s.cold`). Nada de balão por casa: a
  falta é do estoque da cidade, não do lugar (como decidido no P3)
- **Tutorial:** sem passo novo. O mini passo do Lenhador já existe

## 6. Testes (Vitest, `tests/firewood.test.ts` e ajustes em `materials.test.ts`)

1. Inverno: cada casa com gente queima o `firewood` do nível; o terreno vazio não queima; no outono,
   na primavera e no verão nada queima
2. Madeira suficiente: a queima sai depois da produção da semana, `cold` fica falso
3. Madeira faltando: o estoque vai a 0, `cold` verdadeiro, evento `coldStart` uma vez; na semana com
   madeira de novo, `coldEnd`; na primavera, `cold` falso mesmo com 0 de madeira
4. Frio sem fome (seed fixa): a tenda sai com `winterFamineLeaveChance`, casa de nível > 1 cai com
   `famineDropChance`, a subida pausa sem zerar `upStreak`, `winterLoss` marcado
5. Fome e frio juntos: um sorteio só por casa e semana (contar as chamadas do rng)
6. Limite: a produção para em 400; um estoque acima de 400 (posto no teste) não é cortado; com a
   madeira cheia, o Lenhador não corta árvore
7. `firewoodShort`: 0 na primavera e no verão; no outono conta 13 semanas de queima e a produção até a
   primavera; devolve o que falta arredondado para cima
8. Avisos: `firewood` com `cold` falso e verdadeiro; `storageFull`; `winterComing` sem tendas
9. Os testes do P3 que usam muita pedra ou madeira continuam passando (nenhum passa de 400; se passar,
   ajustar o teste e não a regra)

Testes visuais (ui-designer): `winter-cold` (celular e PC: pílula vermelha, aviso, balão da casa com
"Frio: falta lenha", sem fumaça) e `quarry-full` (balão "Parado: estoque cheio"). Atualizar
`docs/TESTING.md` e `docs/GAME_DESIGN.md` (inverno, materiais, avisos) na mesma mudança.

## 7. Bots (sim-tester, `tools/sim/survival.ts`)

- Todos: o passo "Materiais" lê o aviso `firewood`. Comum: faz mais um Lenhador quando vê o aviso por 2
  semanas no outono (sem esperar as 13 semanas da falta de obra). Distraído: só com frio por 4 semanas
- Planejadores (Eficiente, Pescador): a reserva de material (`materialReserve`) guarda, do outono ao fim
  do inverno, a lenha que falta até a primavera (`firewoodPerWeek × semanas de inverno restantes`)
- Lenhador e Pedreira parados por estoque cheio não contam como "rendendo" (não puxam outro) e o
  `trim()` pode demolir uma Pedreira parada há mais de 26 semanas, desde que fique uma
- `run.ts`: linhas novas por bot: semanas de frio por partida, invernos com frio, casas perdidas pelo frio
  (abandonos e quedas com `cold` e sem `famine`), madeira gasta em lenha × em obras, semanas com o estoque
  de pedra cheio antes de o Templo liberar

## 8. Critérios (100 seeds Comum e Distraído, 60 Eficiente e Pescador, 700 semanas)

| # | Critério | Alvo |
|---|---|---|
| F1 | Comum com frio (≥ 1 semana) em pelo menos 1 inverno | 25–50% das partidas |
| F2 | Comum com frio no 1º inverno (Ano 1) | ≤ 15% |
| F3 | Casas perdidas pelo frio (Comum, mediana por partida) | ≤ 3 |
| F4 | Distraído com frio em algum inverno | ≥ 60% (a lenha é um problema real para quem não cuida) |
| A1 | Vitória do Comum | 25–35 min (mediana) |
| A2 | Comum vence 50–80%, Distraído ≤ 20%, derrotas do Comum ≤ 5% | igual ao P3 |
| A3 | Ef > Co > Di | igual |
| A6 | Fome em ≥ 1 inverno no Comum | 40–60% (não pode subir por causa da lenha) |
| A9 | Ano 2: ≥ 3 casamentos, ≥ 5 nascimentos | não pode piorar (P3: 2–3 / 9) |
| W2 | Maior espera de casa por material (mediana) | ≤ 26 sem |
| W3 | Ano 1: semanas com obra travada por madeira | ≤ 4 |
| W4 | Estoque de pedra ou madeira > 400 | nunca (teste unitário) |
| W4b | Pedra que sobra no fim por 100 extraídas (Comum) | ≤ 15 (P3: 49) |
| R | Relatar: lenha × obras, semanas com Pedreira parada, invernos com frio do Eficiente | – |

**Alavancas, uma por rodada, nesta ordem:**
1. F2 ou W3 falham: `startMaterials.wood` 40 → 60
2. F1 > 50%, F3 > 3 ou A2 < 50%: `firewood` × 2/3 (Tenda 0,2, Barro 0,15, Pedra e Casa grande 0,1)
3. Ainda falta madeira (W2 > 26 ou A1 > 35 min): Lenhador `gather.max` 2 → 2,5
4. W4b > 15: `materialStorage` 400 → 300 (o Templo continua possível: 300 de cada)
5. F1 < 25% (inverno sem peso): `firewood` × 4/3 (Tenda 0,4, Barro 0,25, Pedra e Casa grande 0,2)

O sim-tester aplica as alavancas que passam e relata; o diretor aprova os números finais depois.

## 9. Ordem e estimativa (main agent)

| Parte | Quem | Tempo |
|---|---|---|
| Core: `firewood` nos níveis, queima, `s.cold`, eventos, `famine \|\| cold`, limite e corte só do que entrou, `firewoodPerWeek`/`firewoodShort`, avisos | main | 45 min |
| Testes da seção 6 | main (test-reviewer confere) | 30 min |
| Interface: pílula vermelha, linhas dos balões, toasts, avisos, fumaça, 2 cenários visuais | main / ui-designer | 30 min |
| Textos em `strings.ts` | copywriter (ou main) | 10 min |
| Docs: `GAME_DESIGN.md`, `TESTING.md` | main | 10–15 min |
| Bots e medidas novas (seção 7) | sim-tester | 30–45 min |
| Rodada base + até 3 rodadas de alavanca | sim-tester | ~1 h |

Total: **~2 h de implementação + ~1,5 h de calibração.** Risco: o frio somado à fome derrubar o A2.
A alavanca 2 está aí para isso.

## 10. Explicitamente fora

Roupas e frio sem fome por pessoa; lenha por morador; recurso "lenha" separado da madeira; depósito
ou construção de estoque; guarda-florestal ou plantio; manutenção em pedra; venda de pedra ou de
madeira; frio na alegria, nos nascimentos ou nas mortes; frio na tela de derrota (P5); "lenha até" e
gráficos nas Estatísticas (P7); reserva automática de lenha (o jogo não trava obras para guardar);
balão de frio em cada casa; neve nova nas casas (a neve atual basta); reserva do celeiro ajustável;
obras com tempo (P6); qualquer história ou versículo.

# Pacote 3 "Madeira e pedra": especificação (game-director, 2026-11-04)

Base: o esboço no fim de `plano-p2.md`, o roteiro de `docs/design.md` (item 3) e de `plano.md`
(seção 1), as decisões do usuário em `plano-sobrevivencia.md` (itens 2, 3 e 5 da lista de ideias,
"Lenha, madeira e pedra"), o P2 no main (f9dfc4c..da5a8bb) e `fun-critic-p2.md`. Os relatórios
`playtester-p2.md` e `sim-tester-p2.md` ainda não existiam quando este plano foi escrito (ver
seção 12). Nada foi implementado por este plano.

Medição do P2 (sim-tester, d901a12): Comum 46% de vitórias em ~27 min, 0 derrotas, prata parada
3/100. Pontos abertos: fome no inverno ~11% (alvo 25–60%) e templo sem lugar ao ser liberado (M2
~26%, parece ser o layout do bot).

Objetivo do pacote: **materiais de obra.** Madeira (Lenhador, no bosque) e pedra (Pedreira, nas
rochas) entram no custo de algumas obras e na evolução das casas. Cortar árvores é consequência da
madeira: o bosque da Coletora encolhe e volta a crescer devagar. Os trabalhadores sem vaga ganham
destino e o fim da partida passa a ter mais coisas a juntar além da prata.

## 0. Pilares
| Item | Fortalece | Enfraquece / risco | Controle |
|---|---|---|---|
| Madeira e pedra no custo | Sobrevivência (abrigo custa trabalho, não só prata); Ritmo (espera natural, sem cronômetro); Evoluir em vez de multiplicar (a evolução tem preço próprio) | Simples: dois números novos no topo | A pedra só aparece no objetivo 2; um balão diz sempre o que falta |
| Lenhador e Pedreira com a regra da Coletora | Posicionar bem (bosque e afloramento passam a valer); Simples (a regra já é conhecida: recurso no raio × taxa, com teto) | Duas construções a mais na coluna | Entram na categoria Trabalho; nenhuma regra de produção nova |
| Corte de árvores e rebrota | Posicionar bem (Lenhador e Coletora disputam o bosque); Contemplação (o bosque muda com os anos); Cidade viva (árvore caindo, toco, broto) | Comida do inverno cortada sem querer | Prévia "Divide o bosque com a Coletora"; o toco volta a ser árvore |
| Vagas o ano todo | Sobrevivência (trabalhador parado vira produção) | – | – |
| Materiais fora da porta das famílias | Simples (a porta fala só de comida) | – | – |

**Uma mecânica por vez:** a mecânica nova é uma só, **materiais de obra** (estoque, custo e gasto).
Lenhador e Pedreira usam a regra da Coletora; o corte é a consequência da madeira no bosque. Nada de
lenha, frio ou consumo no inverno (P4), nada de obra com tempo (P6), nada de história.

## 1. Decisões
| Pergunta | Decisão | Motivo |
|---|---|---|
| Como se guarda? | **Estoque da cidade, sem limite e sem depósito.** `s.wood` e `s.stone`, como a prata. Demolir não devolve material | KISS: um limite pediria uma construção nova (outro "celeiro"), e isso seria uma segunda mecânica. O freio é a produção com teto e o bosque que encolhe. O limite, se precisar, vem no P4 junto com a lenha |
| Onde aparece no topo? | **Uma pílula "Materiais" entre Comida e Moradores.** No celular (844 x 390): ícone da tora + número; o ícone da pedra + número só depois de liberar a Pedreira; sem variação por semana. No PC: duas pílulas com rótulo e "+N/sem". O número fica **vermelho** quando alguma casa espera aquele material. Tocar abre as Estatísticas | Phone first: um só bloco, só números. A pedra só aparece quando serve (risco "duas matérias-primas de uma vez") |
| Se não couber no celular? | O texto da pílula do objetivo encurta antes (já corta com "…"); Prata, Comida, Moradores e Materiais nunca somem | O objetivo inteiro está na lista de Objetivos |
| Falta material para construir? | **Como a prata:** o botão fica cinza, a prévia mostra o custo em vermelho e o toque dá o toast "Falta madeira: construa um lenhador" | Regra já conhecida (pilar 7) |
| Falta material para evoluir? | **A casa espera:** cumpridas as 13 semanas e as necessidades, ela sobe só se houver material, e paga na hora. Sem material, o contador fica parado em 13/13 (como a fome pausa) e o balão diz "Pronta para virar Casa de pedra: falta 10 de pedra". Casas que ficam prontas na mesma semana pagam na ordem da lista (a mais antiga primeiro) | Pausar já é a regra da fome; zerar seria punição sem explicação |
| Cair de nível devolve? Subir de novo paga? | Não devolve; paga de novo | KISS; cair já é raro (fome) |
| Materiais na porta das famílias? | **Não.** A porta continua só comida (`famine`, `food`, `storage`, `wait`, `noPlot`) | Uma condição a mais e a porta deixaria de ser uma frase. A casa nova já custa madeira, então o terreno vazio já passa pelo material |
| Lenhador × Coletora | **Disputam as mesmas árvores (tensão desejada).** O corte tira a árvore da Coletora e do Lenhador. A prévia dos dois avisa "Divide o bosque com a Coletora/com o Lenhador" quando os raios dividem árvores | É a escolha do usuário ("cortar reduz os frutos do ano seguinte"). Com 2 bosques densos sempre há como separar |
| Corte | A cada **10 de madeira** produzida, o Lenhador corta a **árvore mais próxima no raio** (distância à construção, empate pelo índice da célula). A árvore vira **toco** | Determinístico e testável; o jogador vê o bosque abrir em volta do Lenhador |
| Toco | Não conta para Coletora nem Lenhador. **Não bloqueia:** dá para construir e pôr rua em cima, de graça, e o toco some. Toco livre volta a ser a mesma árvore (oliveira ou palmeira) depois de **104 semanas** | O Lenhador vira também o jeito barato de abrir espaço (o fun-critic viu que ninguém contorna o bosque com Limpar a 5) e ajuda o templo a achar lugar (M2) |
| Rochas | Não acabam e continuam sem demolir | O afloramento é fixo; a pedra é um ritmo, não um esgotamento |
| Inverno | Lenhador e Pedreira trabalham o ano todo; os trabalhadores do campo congelado preenchem as vagas deles. **O inverno não consome material no P3** | Dá destino ao desemprego do inverno; lenha é o P4 |
| Fome no inverno baixa (C2 ~11%) | **O P3 não é a ferramenta.** O corte pode tirar comida da Coletora, mas a correção é um ajuste do P2 (`familyFoodReserveWeeks` 2 → 1, seção 12) feito **antes** da linha de base do P3, e depois a lenha do P4. No P3, C2 não pode cair | Não misturar a medida de uma mecânica nova com o conserto de um número antigo |
| Tutorial | Os passos não mudam. A caravana traz **20 de madeira** (dá para a casa do tutorial e mais 3). Mini passo novo **logo depois** do último passo: "Construa um lenhador perto das árvores" com a seta no melhor lugar (a mesma função do lugar da Coletora, para árvores) | Passo a mais no tutorial pesa no pilar 7; o mini passo chega quando a madeira começa a importar |
| Destrava a pedra | Pedreira liberada pelo **objetivo 2** (3 casas de barro). A casa de pedra precisa do Mercado (objetivo 3), então a pedra junta antes de ser pedida | A pedra entra quando o jogador já entende a madeira |
| O que **não** custa material | Rua, Campo, Praça, Pescador, Coletora, Lenhador (comida e madeira nunca travam por material: sempre há caminho de volta) | Pilar 1: sem material, a cidade continua podendo comer e produzir madeira |

## 2. Números e regras (atual → novo)

### 2.1 `buildings.json`
| Construção | Campo | Atual | Novo |
|---|---|---|---|
| `lumber` (Lenhador, novo) | – | – | `{ "name": "Lenhador", "category": "work", "cost": 25, "upkeep": 1, "w": 2, "h": 2, "jobs": 2, "gather": { "source": "tree", "radius": 3, "perCell": 0.25, "max": 3, "product": "wood" }, "cutEvery": 10 }` |
| `quarry` (Pedreira, nova) | – | – | `{ "name": "Pedreira", "category": "work", "cost": 40, "upkeep": 2, "w": 2, "h": 2, "jobs": 3, "gather": { "source": "rock", "radius": 2, "perCell": 0.4, "max": 3, "product": "stone" }, "materials": { "wood": 10 } }` |
| `fisher`, `gatherer` | `gather.product` | (comida implícita) | `"food"` (padrão quando falta; sem mudança de número) |
| `house` | `materials` | – | `{ "wood": 5 }` |
| `granary` | `materials` | – | `{ "wood": 10 }` |
| `market` | `materials` | – | `{ "wood": 10 }` |
| `workshop` | `materials` | – | `{ "wood": 10 }` |
| `park` | `materials` | – | `{ "stone": 5 }` |
| `temple` | `materials` | – | `{ "stone": 300, "wood": 150 }` (prata 800 igual) |
| `field`, `plaza`, `fisher`, `gatherer`, `lumber`, rua | `materials` | – | nenhum |

Contas (para o sim-tester conferir):
- Lenhador: o raio 3 de um 2 x 2 tem 60 células; bate o teto 3/sem com 12 árvores. Corta ~0,3
  árvore/sem no teto. Num bosque de N árvores, com rebrota em 104 semanas, o equilíbrio é ~N/3,6
  árvores vivas: um bosque denso de 26 sustenta ~1,8/sem por anos. Ou seja, **um Lenhador cai do
  teto depois de 1–2 anos** e a cidade precisa de um segundo bosque ou de esperar.
- Pedreira: o raio 2 tem 32 células; bate o teto com 8 rochas (o afloramento tem 12–16). 3/sem
  ≈ 156/ano.
- Gasto estimado de uma partida do Comum (~10 anos): madeira ~900–1.000 (casas novas ~200, barro
  ~200, casa grande ~125, obras ~300, templo 150); pedra ~800–900 (pedra ~300, casa grande ~250,
  parques ~25, templo 300). Dá 1–2 Lenhadores e 1–2 Pedreiras: **5–10 vagas novas**, contra ~76%
  de trabalhadores sem vaga na semana 200 do P1.

### 2.2 `houses.json`
| Nível | `materials` (novo) |
|---|---|
| Terreno, Tenda | – (a casa nova já pagou 5 de madeira) |
| Casa de barro | `{ "wood": 5 }` |
| Casa de pedra | `{ "stone": 10 }` |
| Casa grande | `{ "stone": 10, "wood": 5 }` |
Moradores, impostos, comida e necessidades sem mudança.

### 2.3 `rules.json`
- `startUnlocked`: + `"lumber"`.
- `startMaterials` (novo): `{ "wood": 20, "stone": 0 }` (a caravana traz a madeira).
- `treeRegrowWeeks` (novo): **104**.
- Sem mudança no resto (famílias, inverno, manutenção, `treeClearCost` 5, `weekSeconds` 3,2).

### 2.4 `goals.json`
- Objetivo 2 "Tenha 3 casas de barro": + `"unlock": "quarry"`. Texto, alvo e prêmio iguais.
- Nenhum objetivo novo.

### 2.5 `walkers.json` (só aparência)
- Lenhador com a tora no ombro: `"from": "lumber"`, `"to": ["house", "market"]`.
- Canteiro com a pedra no carrinho: `"from": "quarry"`, `"to": ["house", "temple"]`.

## 3. Core (com testes Vitest)
- `types.ts`: `GameState` + `wood`, `stone`, `stumps: { i, kind: 'olive' | 'palm', week }[]`;
  `gather.source` + `'rock'`; `gather.product` `'food' | 'wood' | 'stone'`; `materials` em
  `BuildingDef` e no nível de casa; feature `'stump'`; `BuildingKind` + `lumber`, `quarry`.
- `harvest.ts`: `isGatherSource` aceita `rock`; `gatherFood` vira `gatherYield(s, b)` (DRY), e a
  semana soma o produto certo × eficiência. Fisher e Coletora sem mudança de número.
- Corte (`trees.ts`, novo e pequeno): cada Lenhador guarda o acumulado; a cada `cutEvery` corta a
  árvore mais próxima no raio (vira toco, entra em `stumps`); evento `treeCut` (o render anima a
  queda). Rebrota: toco livre há `treeRegrowWeeks` volta à árvore de antes (evento `treeRegrown`).
  Construir ou pôr rua num toco remove o toco, sem custo.
- `build.ts` (ou onde está o custo): construir exige prata **e** materiais; paga os dois. Função
  pura `missingMaterial(s, kind)` para a interface (botão, prévia, toast).
- `houses.ts`: ao completar `weeksToUpgrade` com as necessidades, sobe só se houver o material do
  nível seguinte e paga na hora; sem material, fica em 13/13 com `waiting: 'wood' | 'stone'`.
  Ordem: a da lista de construções.
- `alerts.ts`: aviso novo `material` ("N casas esperando madeira/pedra"), ordem: dívida, fome ou
  comida acabando, **material**, saldo, desemprego. O aviso de desemprego, com o bônus da oficina
  no teto, manda para o Lenhador/Pedreira.
- `readouts.ts`: "Ao evoluir: pede N de madeira/pedra"; `sharedTrees(s, x, y, kind)` para a prévia
  "Divide o bosque"; "Rende N madeira/sem" e "corta 1 árvore a cada N sem".
- `tutorial.ts`: mini passo `lumber` logo depois do último passo; lugar = a função do lugar da
  Coletora, com `source: tree` (DRY).
- Testes: Lenhador rende `min(max, árvores × perCell)` × eficiência e não conta tocos; Pedreira
  conta rochas; desligado rende 0; corte na 10ª madeira, na árvore mais próxima, empate pelo índice;
  toco não bloqueia, some ao construir, volta na semana 104 com o mesmo tipo e não volta se
  construído; construir sem material falha e não gasta prata; templo paga 800 + 300 + 150; casa
  pronta sem material espera e sobe na semana em que o material chega, pagando; duas casas prontas
  com material para uma: sobe a mais antiga; casa que cai não devolve; porta das famílias ignora
  materiais; Coletora perde a árvore cortada; Pedreira trancada até o objetivo 2; estoque inicial
  20/0; aviso `material` com a contagem certa.

## 4. Mapa (`map-designer`)
O P2 já deixou 2 bosques densos e 1 afloramento. **Nenhum número do mapa muda.** Só testes novos
(200 seeds):
- existe um lugar 2 x 2 livre a ≤ 4 células de rua possível com ≥ 12 árvores no raio 3 (Lenhador no
  teto) em cada bosque denso;
- existe um lugar 2 x 2 livre com ≥ 8 rochas no raio 2 (Pedreira no teto) no afloramento;
- os dois lugares acima não caem na área livre do altar nem no rio.
Se algum falhar: `rockOutcrop.rocks` 12 → 14, nunca mais rochas soltas.

## 5. Interface (ui-designer)
- Pílula **Materiais** (seção 1): celular 844 x 390 e 915 x 412, PC 1366 x 768. Números 15 px no
  celular; vermelho quando há casa esperando; a pedra entra com um brilho ao liberar a Pedreira.
- Coluna: Lenhador e Pedreira na categoria **Trabalho** (com Mercado e Oficina). O botão continua
  com o preço em prata; cinza também quando falta material.
- Balão da construção escolhida: "25 prata · 10 madeira" (o que faltar em vermelho). Prévia do
  Lenhador e da Pedreira: "Rende N/sem" (como a Coletora) + "Divide o bosque com a Coletora".
  Prévia da Coletora: "Divide o bosque com o Lenhador".
- Balão da casa tocada: "Pronta para virar Casa de pedra: falta 10 de pedra" e a ação principal
  "Onde pôr uma pedreira" (ou lenhador), como "Onde pôr um mercado".
- Estatísticas: seção Materiais (estoque, +N/sem, gasto no ano, casas esperando, árvores cortadas e
  tocos).
- Toast na primeira casa esperando material e ao liberar a Pedreira ("Nova construção: Pedreira").

## 6. Arte (sprite-artist, código em `src/render`)
- Lenhador: cabana de madeira com pilha de toras e machado; Pedreira: bancada de pedra com blocos
  cortados e guindaste de madeira pequeno. 2 x 2, no estilo das outras.
- Toco (oliveira e palmeira) e, na segunda metade das 104 semanas, um broto (só render, lendo a
  semana do toco).
- Árvore caindo no evento `treeCut` (curta, ≤ 1 s, só na câmera); poeira de pedra na Pedreira.
- Ícones da tora e da pedra para a pílula, o balão e as Estatísticas (`palette.ts`).
- Walkers da seção 2.5. Custo por quadro ≤ 5% acima do P2 em `dense-town`.

## 7. Textos (copywriter, `strings.ts`, até 75 caracteres, números lidos dos dados)
1. Lenhador: "Corta árvores e dá madeira. Divide o bosque com a Coletora."
2. Pedreira: "Tira pedra das rochas. Casas de pedra e o Templo precisam dela."
3. Mini passo: "Casas pedem madeira: construa um lenhador perto das árvores".
4. Toasts: "Falta madeira: construa um lenhador", "Falta pedra: construa uma pedreira",
   "Nova construção: Pedreira", primeira casa esperando material.
5. Balão: "Pronta para virar <nível>: falta N de <material>"; "Ao evoluir: pede N de <material>".
6. Prévias: "Rende N madeira/sem", "Corta 1 árvore a cada N sem", "Divide o bosque com …".
7. Aviso `material`: "N casas esperando pedra: construa uma pedreira".
8. Desemprego no teto da oficina: mandar para Lenhador ou Pedreira.
9. Abertura: "A caravana chegou com N famílias, comida para N semanas e 20 de madeira".
10. Estatísticas: rótulos da seção Materiais.

## 8. Critérios de medição (sim-tester)
Comando: `npm run sim -- --seeds 100 --weeks 700`, 4 bots. **Linha de base:** da5a8bb mais os
ajustes do P2 aprovados na seção 12, rodada antes de qualquer mudança do P3.

### 8.1 Não pode piorar
| # | Critério | Alvo |
|---|---|---|
| B | Comum, casas com família na semana 52 (mediana) | 6–10 |
| G | Vitória do Comum | 30–50%, mediana em 25–35 min (sem. 469–656) |
| C1 | Derrotas do Comum | ≤ 5 |
| C2 | Comum com fome em ao menos 1 inverno | ≥ linha de base (alvo do roteiro 25–60%) |
| I | Comum e Eficiente sobrevivem ao Ano 1 | ≥ 95% |
| D | Distraído: derrotas antes da semana 150 | 0 |
| F | Prata > 300 por > 26 sem sem templo para juntar | ≤ 5/100 |
| H | Aberturas de 2, 3 e 4 famílias | nenhuma melhor em tudo |
| T | Tutorial (bot do playtester, com o mini passo do Lenhador) | 0 de 16 perdem no Ano 1 |
| M2 | Templo com lugar ao ser liberado | ≥ linha de base; alvo 100% |

### 8.2 Deve acontecer (a mecânica tem peso)
| # | Critério | Alvo |
|---|---|---|
| W1 | Partidas do Comum com ao menos 1 casa esperando material | ≥ 60% |
| W2 | Maior espera de uma casa por material (Comum, mediana das partidas) | ≤ 26 sem; nenhuma partida com > 52 |
| W3 | Ano 1 do Comum: semanas com construção travada por madeira | mediana ≤ 4 |
| W4 | Material parado: madeira ou pedra > 300 por > 52 sem antes de o templo ser liberado | ≤ 10/100 |
| W5 | Trabalhadores sem vaga na semana 200 (Comum) | ≥ 10 pontos abaixo da linha de base |
| W6 | Comida da Coletora (Comum, % do total) | ≥ metade da linha de base (o corte pesa, mas não apaga a Coletora) |
| J3 | Maior intervalo sem objetivo | relatar; não pode crescer |

### 8.3 Relatar
Lenhadores e Pedreiras (mediana, máximo); árvores cortadas e tocos na semana 260 e 520; madeira e
pedra produzidas e gastas por destino; o que foi pago por último no templo (prata, pedra ou
madeira) e as semanas entre o objetivo 9 e a vitória; Coletoras que dividem bosque com Lenhador;
prata gasta em Limpar (P2 × P3); casas por nível na vitória; motivos da porta por ano.

## 9. Alavancas de calibração (uma por rodada, nesta ordem)
1. **Abertura travada** (B < 6, W3 > 4 ou T falha): `startMaterials.wood` 20 → 30; depois casa nova
   `wood` 5 → 0 (só a evolução paga).
2. **Material travando o meio** (W2 falha ou G < 30%): Lenhador `perCell` 0,25 → 0,3; depois
   `treeRegrowWeeks` 104 → 78; depois Pedreira `max` 3 → 4.
3. **Material sem peso** (W1 < 60%): `cutEvery` 10 → 8; depois Lenhador `max` 3 → 2,5; depois casa de
   pedra `stone` 10 → 15.
4. **Coletora apagada** (W6 falha ou C2 abaixo da base por causa do corte): `cutEvery` 10 → 15.
5. **Material parado** (W4 falha): templo `stone` 300 → 400; depois `wood` 150 → 200.
6. **Prata** (C1 > 5 ou F > 5): Pedreira `upkeep` 2 → 1; prata parada: templo `cost` 800 igual e
   Pedreira `cost` 40 → 60.
7. `weekSeconds` fica 3,2 e o mapa não muda (seção 4). Nenhum número fora desta lista entra sem o
   game-director.

## 10. Bots (`tools/sim`, sem tocar em `src/`)
- `place()` e `canAfford()` contam materiais; o bot nunca tenta construir sem eles.
- **Passo novo "Materiais"** antes de "Casas": sem Lenhador ligado e madeira < 15 (ou casa
  esperando madeira) → Lenhador no lugar com mais árvores; com a Pedreira liberada e (pedra < 20 ou
  casa esperando pedra) → Pedreira no afloramento. Segundo Lenhador/Pedreira quando a espera passa
  de 13 semanas. O Distraído só depois de ver o aviso por `delay` semanas (`seen`).
- Eficiente: Lenhador em bosque **sem** Coletora (usa `sharedTrees`); guarda pedra e madeira para o
  templo a partir do objetivo 8; constrói em toco (vale como lugar livre).
- Comum: Lenhador no lugar com mais árvores, sem olhar a Coletora (é o jogador que corta a comida
  sem perceber).
- `trim()` nunca demole o último Lenhador nem a última Pedreira.
- Tutorial (bot do playtester): segue o mini passo.
- Métricas novas: W1–W6 e as da 8.3; linha `--brief` com elas.

## 11. Quem faz e estimativa
| Bloco | Quem | Tempo (uma pessoa) |
|---|---|---|
| Dados, core, corte e rebrota, evolução com material, testes (2, 3) | main + test-reviewer | 5–6 h (o custo em material passa por construir, casas, prévia, tutorial e alertas) |
| Testes de lugar no mapa (4) | map-designer | 1 h |
| Bots e métricas (10) | sim-tester | 3 h |
| Linha de base + calibração (2–3 rodadas, 100 seeds × 4 bots × 700 sem) | sim-tester + game-director | 2–4 h |
| Pílula Materiais, prévias, balões, Estatísticas, mini passo (5) | ui-designer | 3–4 h |
| Arte: Lenhador, Pedreira, toco, broto, árvore caindo, ícones, walkers (6) | sprite-artist | 3–4 h |
| Textos (7) | copywriter | 1 h |
| Docs (`GAME_DESIGN.md`, `TESTING.md`), `test:visual`, capturas | main | 1,5 h |
| playtester e fun-critic no fim | – | 1,5 h |

Total ~21–27 h de uma pessoa; numa sessão do Claude Code, ~7–9 h. Maior risco de prazo: a pílula
no topo do celular (844 x 390 já está cheio; pode pedir uma rodada a mais do ui-designer, ~1 h) e a
calibração se a madeira travar o Ano 1 (alavanca 1, ~1 h).

Ordem: 1) ajustes do P2 aprovados (seção 12) e linha de base; 2) dados + core + testes; 3) testes do
mapa; 4) bots; 5) em paralelo, arte, interface e textos; 6) sim-tester com as alavancas;
7) `npm test`, `tsc`, `build`, `test:visual`, olhar capturas (topo com Materiais no celular e no PC,
casa esperando pedra, prévia do Lenhador dividindo bosque, toco e broto, mini passo do Lenhador,
Estatísticas) em 844 x 390 e 1366 x 768; 8) playtester e fun-critic.

Cenários visuais novos (`TESTING.md`): `materials-top` (celular e PC, antes e depois da Pedreira),
`house-waiting-stone`, `lumber-preview-shared`, `stumps` (toco e broto), `tutorial-lumber`.

## 12. A ajustar depois das revisões do P2
`fun-critic-p2.md` já saiu; `playtester-p2.md` e `sim-tester-p2.md` ainda não. Classificação do que
já existe:

| Item | Origem | Destino | Motivo |
|---|---|---|---|
| `familyFoodReserveWeeks` 2 → 1 | fun-critic-p2 | **ENTRA como ajuste do P2**, antes da linha de base do P3, se o sim-tester-p2 confirmar C2 < 25% e I ≥ 95% | É o número que corrige o inverno fácil sem mexer no P3 |
| Templo sem lugar (M2 ~26%) | sim-tester P2 | **Conferir** no sim-tester-p2 e no playtester-p2: se for o bot, corrige o bot; se for o mapa, entra a alavanca 5 do P2 (oliveiras [80, 110] → [70, 100]) antes do P3 | O toco do P3 ajuda, mas não pode ser o conserto |
| Objetivo 8: 6 → 12 casas grandes; prêmio do 9: 200 → 400 | fun-critic-p2 | **DEPOIS (medir no P3)** | O templo com pedra e madeira muda o fim; ver J3 no P3 antes de mexer nos objetivos |
| Coletora `perCell` 0,3 → 0,2 | fun-critic-p2 | **DEPOIS** | O corte do Lenhador já tira árvores da Coletora; medir W6 primeiro |
| `treeClearCost` 5 → 10 | fun-critic-p2 | **FORA** | No P3 o Lenhador abre o bosque de graça (toco não bloqueia); Limpar fica como atalho caro |
| Casa grande `tax` 2,5 → 3,5 | fun-critic-p2 | **DEPOIS (P9 Governo)** | A prata parada está em 3/100; imposto a mais traria a prata sobrando de volta |
| "Bairro completo" (prêmio da praça) | fun-critic-p2 | **DEPOIS** | É gatilho novo; nunca no mesmo pacote dos materiais |
| Bugs e confusões do playtester-p2 | playtester-p2 | **Ajustes de interface entram no P3** se forem pequenos; regra nova não | Interface pode ir junto; mecânica não |

Quando os relatórios saírem, o game-director atualiza esta seção e a linha de base da seção 8.

## 13. Fora do P3
Lenha, frio, consumo de material no inverno, "lenha até", neve e reserva do celeiro (P4); limite de
estoque e depósito de materiais (P4, só se o estoque sem limite falhar em W4); Limpar dando madeira;
material na porta das famílias; obras com tempo, canteiro e construtores (P6); templo calibrado para
~30% (P6); tela de derrota com causa (P5); oficina produzindo ferramentas que aumentam Lenhador e
Pedreira (P10); comércio de material; "Bairro completo"; objetivos novos; história.

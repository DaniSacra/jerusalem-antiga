# Pacote 2 "Templo em ruínas + altar com ofertas + Gado" (game-director, 2026-11-07)

Pedido do usuário (2026-11-07): "o templo poderia ficar no meio em ruínas e a gente vai fazer a cidade
ao redor, uma das fases é fazer o altar, ele vira altar primeiro e a gente já precisa de gado para
holocaustos e depois a gente vai melhorando e precisa deixar o jogo mais difícil". Depois de jogar o
main: "só construir um campo, um pescador e já era" (fácil e sem rumo).

Este plano **substitui** as seções 2 (Templo em etapas) e 3 (Gado) do `plano-desafio.md`. O que já
está no worktree `jerusalem-antiga-templo` (`temple.json`, `goals.json`, `src/core/temple.ts`) é
aproveitado: as 5 etapas, a obra com construtores, o objetivo `templeStage` e a vitória ficam. A
palavra "ofertas"/"holocaustos" pode aparecer na tela (pedido do usuário); continua sem história e sem
versículo. Base de medida: o main com o aperto de economia do sim-tester (comida, prata, pedra) e as
Profissões.

## 0. Decisão por item

| Item | Pilares | Decisão |
|---|---|---|
| Ruína do Templo fixa ao lado do altar desde o mapa | 3 contemplação (+: a cidade nasce em volta da ruína), 7 simples (+: sai a ferramenta e a marcação), 9 posicionar (neutro) | **ENTRA AGORA**: é o pedido; tira um passo e dá rumo desde a semana 1 |
| Altar em ruínas que vira "Altar restaurado" na etapa 1 | 6 camadas (+), 5 evoluir (+) | **ENTRA AGORA**: o primeiro alvo real da partida |
| Ofertas: o altar restaurado queima gado toda semana | 1 sobrevivência (+: uma crise nova com volta), 6 camadas (+: a oferta cresce com as etapas) | **ENTRA AGORA**: é a **mecânica nova** do pacote (gado = produção no pasto + consumo no altar, uma mecânica) |
| `sacred` vira exigência da Casa de pedra e da Casa grande | 9 posicionar (++: o bairro de pedra em volta do altar), 1 (+) | **ENTRA AGORA** (ajuste de regra de casa, sem sistema novo): sem isso as ofertas não pesam |
| Raio do altar cresce a cada etapa | 5 evoluir (+: "a gente vai melhorando" tem efeito), 9 (+) | **ENTRA AGORA** (número por etapa): cada etapa abre espaço para mais casas de pedra |
| Pasto pelo capim livre (do `plano-backlog.md` 1.2/1.3) | 9 posicionar (+), 8 viva (+) | **ENTRA AGORA**: a fonte do gado |
| Mercado também consome gado | 1 (+) / 7 simples (−: duas bocas para o mesmo gado confundem a linha "O que fazer agora") | **DEPOIS**: última alavanca deste pacote se o Comum vencer > 75%; senão, vai para o Difícil |
| Gado como comida no inverno, lã e couro, venda de gado | 7 (−) | **FORA** deste pacote (Roupas segue no backlog) |
| Ferramenta Templo e marcar o lugar | – | **FORA**: a ruína já é o lugar |

## 1. Regra (versão mais simples)

### 1.1 Mapa: a ruína e o altar em ruínas
1. O gerador põe o **Templo em ruínas** (o prédio `temple`, 6 x 6) num lugar fixo: **ao norte do altar,
   encostado no anel de rua** (a rua inicial vem do sul, passa pelo altar e chega à ruína: um eixo só).
   Com o altar em 22,22 e o anel de 21 a 26, a ruína ocupa x 21–26, y 15–20. Cabe sempre: fica
   dentro do `clearRadius` 9, e o gerador não põe rio, rocha nem árvore ali (map-designer confere em
   1000 seeds). Ligada desde o começo pelo anel.
2. A ruína é **protegida** desde o começo (não se demole, não se constrói em cima). Sai a ferramenta
   Templo, a marcação grátis, o `templeSpotRoadGap` e as áreas verdes/amarelas.
3. O **altar começa em ruínas**: continua o centro da rede (as ruas ligam a ele) e a origem das
   famílias, e **não cobre nada** (sem `sacred`, sem Alegria). Fogo apagado.

### 1.2 Etapas (como no worktree, com dois números novos por etapa)
1. As 5 etapas, o pagamento ao começar, os construtores e a obra ficam como no `plano-desafio.md` 2.1
   (itens 2–5, 7, 9, 10). Etapa 1 no altar; 2–5 na ruína.
2. Cada etapa terminada dá ao altar um **raio sagrado** (`sacredRadius`, medido da borda do altar) e
   uma **oferta por semana** (`offering`, gado). A Consagração liga também o Templo (raio 12, Alegria
   +10, como hoje).
3. Leitura da ruína para o jogador: a ruína se desfaz em obra e sobe por etapa (seção 4); o raio
   aceso no chão (ao tocar no altar) cresce a cada etapa: "melhorar" = mais casas de pedra cabem.

### 1.3 Ofertas
1. Toda semana, depois da produção, o altar restaurado gasta `offering` do estoque de gado.
2. Com gado bastando: o altar cobre o raio da etapa. Sem gado bastando: **o altar não cobre nesta
   semana** (igual ao mercado sem gente) e não gasta nada; o fogo apaga. As casas de pedra e grandes
   fora de qualquer cobertura caem pela regra que já existe (`weeksToDowngrade` 3): o estoque é o
   colchão.
3. Evento `offeringsMissing` uma vez por episódio (até voltar a ter ofertas), toast e aviso; evento
   `offeringsBack` ao voltar.
4. "O que fazer agora": a falta de ofertas entra no nível 1 (crise), depois de dívida, fome e lenha:
   "O altar está sem ofertas: construa um pasto no capim". Previsão: "Gado acaba em N sem" quando a
   produção é menor que a oferta e o estoque dura < 8 sem.

### 1.4 Casas
- `houses.json`: Casa de pedra `["road", "plaza", "sacred"]`; Casa grande `["road", "plaza",
  "market", "park", "sacred"]`. Tenda e barro iguais.
- `sacred` = no raio do altar (cobrindo) ou do Templo consagrado. Antes do altar restaurado, nenhuma
  casa passa do barro: a etapa 1 é a porta da cidade de pedra.

### 1.5 Pasto e gado (do `plano-backlog.md` 1.2, sem o mercado)
1. **Pasto** (`pasture`): 3 x 3, 1 vaga (Pastor), coleta `grass` = capim livre no raio 2 (chão
   `grass`, sem construção, rua, árvore ou rocha). Inverno × `winterFactor`.
2. **Estoque de gado** `s.livestock`, começa em 0, teto `livestockStorage`; cheio, o pasto para.
3. Construir em cima do capim tira a célula: a cidade de pedra em volta do altar come o pasto perto
   dele (escolha de lugar).

## 2. Números (`src/data`)

`temple.json` (custos, construtores e obra iguais ao worktree; duas colunas novas):

| # | Etapa | Prata | Pedra | Madeira | Constr. | Obra | `sacredRadius` | `offering` |
|---|---|---|---|---|---|---|---|---|
| 1 | Altar restaurado | 40 | 20 | 20 | 2 | 12 | 6 | 0,5 |
| 2 | Alicerce | 150 | 80 | 0 | 4 | 40 | 7 | 0,75 |
| 3 | Paredes | 200 | 120 | 40 | 5 | 60 | 8 | 1,0 |
| 4 | Pórtico e telhado | 250 | 60 | 120 | 6 | 72 | 10 | 1,25 |
| 5 | Consagração | 200 | 0 | 40 | 4 | 32 | 10 (+ Templo 12) | 1,5 |

- `buildings.json > altar`: sai `radius` 4 (o raio vem da etapa); `temple`: `cost` 0, `materials` {},
  `jobs` 0, protegido, nasce no mapa.
- `buildings.json > pasture`: `{ "name": "Pasto", "category": "supply", "cost": 30, "upkeep": 0.5,
  "w": 3, "h": 3, "jobs": 1, "materials": { "wood": 10 }, "gather": { "source": "grass", "radius": 2,
  "perCell": 0.06, "max": 1.5, "winterFactor": 0.5, "product": "livestock" } }` (~1,1/sem no capim
  médio; prado bom bate 1,5). Um pasto cobre até o Alicerce; Paredes em diante pede o 2º; no inverno
  do fim, o 3º.
- `rules.json`: `"livestockStorage": 40`; `jobPriority` ganha `pasture` depois de `quarry`; sai
  `templeSpotRoadGap`; `map.templeRuin`: `{ "x": 21, "y": 15 }` (map-designer confirma).
- Alavancas do sim-tester, uma por rodada, nesta ordem: `offering` de todas ±0,25; `sacredRadius` da
  etapa 1 6 → 5 (mais duro) ou 7; `perCell` 0,06 → 0,05 / 0,08; `livestockStorage` 40 → 60; por
  último, só se o Comum vencer > 75%: **mercado consome gado** (0,5/0,75/1,0, a regra do
  `plano-backlog.md` 1.2 item 3).

`goals.json` (22 objetivos; os de espera do meio diminuem, entram ações):

| # | Texto | Tipo | Prêmio | Libera |
|---|---|---|---|---|
| 1 | Comida até a primavera | foodUntilSpring | +30 | Celeiro |
| 2 | Primeiro casamento | marco | +20 | – |
| 3 | Primeiro nascimento | marco | +40 | – |
| 4 | Passe o primeiro inverno | marco | +30 | **Pasto** |
| 5 | **Construa um pasto** | build pasture 1 | +40 | Pedreira |
| 6 | Tenha 5 casas de barro | casas 2 | +40 | Praça |
| 7 | **Restaure o altar** | templeStage 1 | +50 | – |
| 8 | Receba a primeira caravana | marco | +50 | Oficina |
| 9 | Construa uma oficina | build | +40 | Mercado |
| 10 | Chegue a 30 moradores | moradores | +50 | – |
| 11 | Tenha 6 casas de pedra | casas 3 | +60 | Parque |
| 12 | **Alicerce do Templo** | templeStage 2 | +80 | – |
| 13 | Uma criança da cidade virou adulta | marco | +80 | – |
| 14 | Chegue a 45 moradores | moradores | +80 | – |
| 15 | Tenha 4 casas grandes | casas 4 | +80 | – |
| 16 | **Paredes do Templo** | templeStage 3 | +100 | – |
| 17 | **Tenha 2 pastos** (era "Terceira geração") | build pasture 2 | +100 | – |
| 18 | Chegue a 65 moradores | moradores | +100 | – |
| 19 | Chegue a 85 moradores | moradores | +120 | – |
| 20 | **Pórtico e telhado** | templeStage 4 | +150 | – |
| 21 | Chegue a 120 moradores | moradores | +175 | – |
| 22 | **Consagração do Templo** | templeStage 5 | vitória | – |

O marco "Terceira geração" continua nas Estatísticas (sem objetivo). Os prêmios ficam até o aperto
do sim-tester dizer o contrário (eles são a prata do meio; a alavanca é dele).

## 3. Interface e textos (ui-designer + copywriter)
- Do `plano-desafio.md` 2.3 e 2.4: a linha "O que fazer agora", os balões da etapa, a pílula do
  objetivo, a lista com as etapas e os toasts. **Saem** a ferramenta Templo, "Escolha o lugar do
  Templo" e as áreas verdes/amarelas.
- Balão do altar em ruínas: "Altar em ruínas: restaure para as casas de pedra" (e o botão da etapa
  quando for o objetivo). Restaurado: "Ofertas: 0,5 gado/sem · cobre N casas", raio aceso no chão;
  sem gado: "Sem ofertas: não cobre as casas" em vermelho.
- Balão da ruína: "Ruínas do Templo" e a etapa que vem.
- Pílula **Gado** depois de Pedra, só depois de o Pasto ser liberado: "N · +N/sem" (pastos menos
  ofertas); vermelha com o altar sem ofertas. Toque: "Pastos +N, Altar −N".
- Prévia, balão e "Parado: estoque cheio" do Pasto como no `plano-backlog.md` 1.4.
- Motivo da casa que não sobe: "longe do altar" e "altar sem ofertas".
- Toasts: "O altar ficou sem ofertas: as casas de pedra vão cair"; "As ofertas voltaram".
- Topo do PC 1366 numa linha só; celular 844 x 390 sem quebrar.

## 4. Arte 3D (sprite-artist)
- **Ruína do Templo** (estado 0): plataforma quebrada, blocos e tambores de coluna caídos, mato e
  arbustos entre as pedras, um pedaço de muro de pé. É o que se vê do título e da primeira semana.
- Cada etapa sai da ruína: Alicerce (entulho limpo e empilhado, plataforma e escada novas); Paredes
  (pátio, muro, santuário sem telhado, andaimes, guindaste); Pórtico e telhado; Consagração (o Templo
  por código do C8). Obra viva e parada como no `plano-desafio.md` 2.5.
- **Altar em ruínas**: pedras soltas, degraus rachados, sem fogo. Restaurado: o altar de hoje com fogo
  e fumaça; **sem ofertas o fogo apaga** (a crise lida de longe). Ofertas em dia: de vez em quando um
  pastor leva uma ovelha ao altar (só aparência, plano puro testado).
- Pasto, rebanho instanciado e pastor como no `plano-backlog.md` 1.5 (sem o cercadinho do mercado).
- Custo: ≤ +6 chamadas e ≤ +20 mil triângulos no total; `view3d-perf.mjs` dentro dos limites.
  Cenários `templestages3d` (ruína + 5 etapas, celular e PC) e `pasture3d`.

## 5. Testes do core (test-reviewer)
Ruína no mapa em toda seed, ligada e protegida; altar em ruínas não cobre; etapa 1 dá raio 6 e oferta
0,5; cada etapa troca raio e oferta; oferta gasta depois da produção; sem gado não cobre e não gasta;
casa de pedra fora da cobertura cai em 3 sem; evento uma vez por episódio e a volta; `grass` só capim
livre; construir em cima tira a célula; estoque para no teto; inverno × 0,5; objetivos 5 e 17 e as
liberações; Consagração = vitória e liga o Templo; determinismo pela seed. Os testes do worktree que
falam da marcação e da ferramenta saem.

## 6. Sim-tester (Comum, Eficiente, Distraído; 100 seeds, 1000 sem; base = main com o aperto)
Bots: o Comum constrói o pasto no melhor capim assim que liberado e outro quando o gado cai por 8 sem
seguidas; casas de pedra no raio; etapas e construtores como no `plano-desafio.md` 2.7. Eficiente:
2º pasto antes das Paredes. Distraído: um pasto no primeiro lugar, nunca o segundo.

| # | Critério | Alvo |
|---|---|---|
| R1 | Comum vence | **55–75%** |
| R2 | Derrotas do Comum | **3–10%** |
| R3 | Comum com o altar sem ofertas em algum momento | **≥ 30%** das partidas |
| R4 | Comum sem ofertas > 8 sem seguidas | **≤ 15%** das partidas |
| R5 | Altar restaurado (mediana) | sem 30–80 (Ano 1–2) |
| R6 | Vitória do Comum (mediana) | 30–40 min |
| R7 | O lugar pesa: rendimento do 1º pasto, p10 / p90 | ≤ 0,8 / ≥ 1,4 |
| R8 | Pastos por partida (Comum, mediana) | 2–3 |
| R9 | Estoque de gado cheio > 26 sem seguidas (Comum) | ≤ 20% |
| R10 | Eficiente vence | ≥ 85% |
| — | E3–E5 do `plano-desafio.md` (etapas e esperas), S1–S4, F1, D1, A2b | dentro dos alvos ou sem piorar além do ruído |

O pacote Dificuldade depois calibra o Normal para 50–70% (seção 4.6 do `plano-desafio.md`); se este
pacote já entregar R1, a Dificuldade mexe só nos multiplicadores.

## 7. Quem faz e horas

| Parte | Agente | Horas |
|---|---|---|
| Ruína fixa no gerador, lugar sempre livre, conferência em 1000 seeds | map-designer | 2–3 |
| Core: ruína desde o mapa, sai a marcação/ferramenta, altar em ruínas, `sacredRadius` e `offering` por etapa, `sacred` nas casas, pasto `grass`, estoque, ofertas, eventos, objetivos | agente principal | 7–9 |
| Testes do core | test-reviewer | 3–4 |
| `nextStep` puro (crise de ofertas, etapas sem o ramo do lugar) e testes | agente principal | 2–3 |
| Balões do altar, da ruína e do pasto; pílula Gado; linha; toasts; motivos | ui-designer | 9–11 |
| Textos | copywriter | 1,5 |
| Arte: ruína, altar em ruínas e restaurado, fogo que apaga, etapas a partir da ruína, pasto, rebanho, pastor | sprite-artist | 13–16 |
| Bots e 2–3 rodadas | sim-tester | 5–7 |
| Revisão | code-reviewer | 1,5–2 |
| Depois: playtester (o rumo apareceu?) e fun-critic | – | 2–3 |
| **Total** | | **~46–59 h** (~4 sessões; mapa, core e arte em paralelo) |

O antigo pacote 3 "Gado" **sai da fila**: o pasto e o gado vêm aqui; o mercado com gado é alavanca
(seção 2) ou fica para o Difícil. Nova ordem: T0 (feito) → 1 Profissões (feito) → **2 Ruínas, altar
e Gado** → 3 Dificuldade → `plano-backlog.md` a partir do D1.

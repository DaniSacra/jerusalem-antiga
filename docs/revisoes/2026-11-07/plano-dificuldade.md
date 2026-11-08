# Pacote 3 "Dificuldade: mecânicas que se completam" (game-director, 2026-11-07)

Pedido central do usuário (playtest 2): "precisamos unir mais as mecânicas para elas se complementarem".
Mais as queixas: sobra prata, errar não custa, celeiro sem guarda, luz contra roubo, roupas de couro.
Base de medida: o main com o pacote 2 (Ruínas, altar com ofertas e Gado, `plano-ruinas.md`). Este plano
**substitui** a seção 4 do `plano-desafio.md`; os alvos A1–A2b, F1, S4 e M da 4.6 continuam valendo.
Sem história. Seis peças, cada uma publicada sozinha (commit + push do agente principal por peça). As
peças A, B e F são números e interface; C, D e E são **uma mecânica nova cada**, uma por vez (pilar 5).

## 1. Mapa das ligações

| Recurso | Vem de | Usos que disputam |
|---|---|---|
| Trabalhadores | moradores adultos | comida × lenha × pedra × pastor × curtidor × **guarda do celeiro** × construtores |
| Comida | campo, pescador, coletora | comer agora × guardar no celeiro para o inverno (e o ladrão leva o guardado sem guarda) |
| Madeira | lenhador | fogo do inverno × obras (casas, etapas) × **óleo das lamparinas** |
| Pedra | pedreira | casas de pedra e grandes × etapas do Templo × melhorias |
| Gado | pasto (capim livre) | **ofertas do altar** × **couro do curtume** |
| Roupas | curtume (gado) | só o frio, de propósito: a disputa fica no gado, que é onde o jogador decide |
| Capim | chão livre | pasto × casas de pedra perto do altar (construir come o capim) |
| Prata | impostos e prêmios | construir × manutenção × etapas × lamparinas acesas |
| Segurança | guarda ou luz | um trabalhador no celeiro **ou** lamparinas (madeira + prata) |
| Luz | lamparinas, casas com lenha | protege o celeiro; casa escura no inverno = casa sem lenha (o frio se vê de longe) |
| Templo | prata + pedra + madeira + construtores | dá o raio sagrado (casas de pedra = mais imposto) e pede mais gado a cada etapa |

Como uma peça puxa a outra: a etapa do Templo sobe a oferta → falta gado para o couro → o inverno
pede roupas → um 2º pasto no capim → menos chão para casas de pedra perto do altar. A cidade cresce →
o celeiro enche → precisa de guarda (um trabalhador a menos na comida) ou de lamparinas (madeira a
menos para o fogo). Manutenção mais cara → cada prédio a mais tem de se pagar → errar vira dívida.

## 2. Peças em ordem de entrega

### A. Manutenção e prata (ajuste de números; 3–5 h)
- Regra: nenhuma nova. Os locais de produção sobem de manutenção; os prêmios do meio descem.
- Números (`buildings.json`, `goals.json`): campo, pescador, coletora 0,5 → **0,75**; lenhador 0,5 →
  **1**; pasto 0,5 → **1**; prêmios dos objetivos 6–21 × **0,75** (o Ano 1 fica igual).
- UI: tocar na prata mostra "Impostos +N · Manutenção −N · Saldo ±N/sem" e a construção mais cara;
  saldo negativo deixa a pílula âmbar.
- Sim-tester: prata nunca gasta (Comum) **≤ 20%** (hoje 33%); S4 e fome no Ano 1 iguais; Comum vence
  60–75%. Alavanca única por rodada: a manutenção do lenhador, depois os prêmios.

### B. Errar custa (ajuste de regra e interface; 4–6 h)
- Regra: **local de trabalho vazio paga a manutenção inteira** (`emptyUpkeepFactor` 0,5 → **1**).
  Mais prédios do que gente = prata indo embora toda semana até a dívida, que já é derrota.
- UI: aviso "N locais sem ninguém custam N/sem: ponha gente ou demola" e na linha "O que fazer agora"
  (nível 1, depois de fome e lenha); o local vazio ganha um selo de poeira (sprite-artist, 1 h).
- Sim-tester: bot novo **Exagerado** (constrói cada liberado duas vezes, sem olhar trabalhadores):
  perde **30–60%** no Normal; Comum sem piorar além de 3 pontos.

### C. Roubo no celeiro (mecânica nova; 8–11 h)
- Regra: a partir de 20 moradores, todo celeiro **sem celeireiro** perde por semana `theftShare` da
  comida guardada nele (a comida acima do `baseFoodStorage`, dividida entre os celeiros pela
  capacidade). Com celeireiro, nada. Evento `granaryRobbed` uma vez por episódio.
- Números (`rules.json > theft`): `minPeople` 20, `theftShare` **0,05**; `jobPriority`: celeiro sobe
  para logo depois do campo.
- UI: toast "Roubaram 14 de comida do celeiro: ponha um celeireiro"; balão do celeiro "Sem guarda:
  −N/sem" em vermelho; a previsão de comida conta o roubo. Arte: à noite, um vulto sai do celeiro
  vazio com um saco (puro, raro).
- Sim-tester: comida roubada ≤ 8% do produzido (Comum); partidas do Comum com roubo ≥ 40%;
  Distraído (automático) quase sem roubo, porque o automático preenche o celeiro.

### D. Lamparinas nas ruas e luzes nas casas (mecânica nova; 12–16 h)
- Regra: **Lamparina** 1 x 1 posta numa célula de rua (não bloqueia); acesa, protege do roubo os
  celeiros a até `radius` (o roubo cai a × `litTheft`). Queima madeira toda semana; sem madeira, apaga
  e não protege. Liberada pelo objetivo novo depois do primeiro roubo possível; objetivo **"Ilumine o
  celeiro: 3 lamparinas"** (+40). Escolha clara: guarda (um trabalhador) ou luz (madeira + prata).
- Números (`buildings.json > lamp`): custo 8 prata, manutenção 0,1, `wood` 0,05/sem, `radius` 3;
  `rules.json > theft.litTheft` **0,25**.
- Luz das casas: toda casa com gente acende à noite; **no inverno sem lenha fica escura** (só
  aparência, `plan.ts` puro e testado). Os braseiros automáticos das ruas saem: a luz da rua passa a
  ser a do jogador (a cidade de noite é desenhada por ele).
- UI: prévia com o raio e "Protege 1 celeiro"; balão "Apagada: sem madeira"; pílula de madeira conta
  as lamparinas no "−N/sem". Arte: poste com chama e halo, instanciado (≤ +2 chamadas).
- Sim-tester: lamparinas por partida (Comum, mediana) 3–8; madeira que vai para elas ≤ 10%; o frio
  (F1) sem piorar além do ruído.

### E. Curtume → roupas → frio (mecânica nova; 16–21 h)
- Regra: **Curtume** (prédio próprio com o desenho do curtume da oficina, sem escolher ofício: KISS)
  gasta gado e faz roupas (`s.clothes`, com teto). Em cada semana de inverno, cada morador usa
  `clothesPerPerson`; sem roupa bastando, `s.ragged` e a tabela de morte de frio ganha a linha
  "com lenha, sem roupa". Não derruba casa (só a chance de morte). Vale a partir do inverno depois de
  o Curtume ser liberado. Objetivo **"Construa um curtume"** depois do Alicerce (+60).
- Números: `buildings.json > tannery` **2 x 2**, custo 50 + 10 madeira, manutenção 1,5,
  2 vagas, `livestockIn` 0,5/sem → `clothesOut` 1/sem (pela lotação); `rules.json`: `clothesPerPerson`
  **0,04**, `clothesStorage` 100; `coldDeath`: tenda com lenha sem roupa 2% / 0, casa com lenha sem
  roupa 0,5% / 0 (vulnerável / outros). Um curtume veste ~100 moradores e come 0,5 gado contra a
  oferta de 0,5–1,5: na etapa Paredes o 2º pasto vira necessário.
- UI: pílula **Roupas** depois de Gado (após liberar): "N · dura N invernos"; aviso no outono "Faltam
  N roupas para o inverno: construa um curtume"; balão da casa "Sem roupa: frio para crianças e
  idosos"; balão do altar e do curtume mostram quem leva o gado ("Altar −1 · Curtume −0,5").
- Sim-tester: Comum com falta de roupa em algum inverno **30–60%**; mortes de frio por partida
  (mediana) ≤ 3; pastos por partida 2–3 (R8); o altar sem ofertas (R3/R4) dentro dos alvos.

### F. Escolha Tranquilo / Normal / Difícil (multiplicadores; 14–19 h)
- Regra: como a 4.1 do `plano-desafio.md` (cartões no título, Normal padrão, `s.difficulty`, não muda
  na partida), **sem** o `foodFactor` por nível: lamparinas, roupas e ofertas já fazem a cidade grande
  custar mais. O inverno que piora do Ano 3 fica.
- Números (`src/data/difficulty.json`):

| Chave | Tranquilo | Normal | Difícil |
|---|---|---|---|
| `startSilver` | 220 | 180 | 150 |
| `food` (comida comida) | 0,9 | 1 | 1,1 |
| `firewood` e `clothes` | 0,8 | 1 | 1,2 |
| `upkeep` | 0,8 | 1 | 1,2 |
| `emptyUpkeep` | 0,5 | 1 | 1 |
| `theft` | 0,5 | 1 | 1,5 |
| `offering` | 0,75 | 1 | 1,25 |
| `templeCost` e `templeWork` | 0,8 | 1 | 1,25 |
| `winterGrowth` / `winterGrowthMax` | 0 / 0 | 0,05 / 0,3 | 0,08 / 0,4 |

- UI: três cartões com uma frase cada; a dificuldade nas Estatísticas, na pausa e na vitória/derrota.
- Sim-tester (100 seeds por dificuldade): A2 da 4.6 (Tranquilo 80–95%, Normal 50–70%, Difícil
  20–40%; derrotas ≤ 2% / 3–10% / 10–25%); **Distraído no Tranquilo perde ≤ 35%** (hoje ~81% por
  comida e dívida: o Tranquilo é a porta para quem aprende); M (tudo piora do Tranquilo ao Difícil).

## 3. Fora, por KISS

- Roubo de casas, de prata ou do mercado; guardas como profissão própria; crime como índice: o
  celeiro basta para ensinar a regra.
- Oficina com escolha de ofício (o Curtume é prédio próprio); lã, carne de gado, venda de couro.
- Roupas que derrubam casa ou que são exigência de nível; roupas fora do inverno.
- Lamparinas com Alegria, com alcance para casas ou com óleo de oliva como recurso novo.
- `foodFactor` por nível de casa (sai do `plano-desafio.md` 4.1); trocar a dificuldade no meio.
- Manutenção cobrada em pedra ou madeira; manutenção que cresce com o número de prédios iguais
  (a peça B já pune o excesso de um jeito que se lê).

## 4. Horas e ordem

| Peça | Horas |
|---|---|
| A Manutenção e prata | 3–5 |
| B Errar custa | 4–6 |
| C Roubo no celeiro | 8–11 |
| D Lamparinas e luzes | 12–16 |
| E Curtume, roupas e frio | 16–21 |
| F Dificuldade | 14–19 |
| **Total** | **~57–78 h** (~5 sessões); sim-tester ao fim de cada peça, playtest do usuário depois de D e de F |

Antes da peça A entram os bugs 1–5 do `playtest-usuario-2.md` (pessoas que somem, chuva, "0 de 1
vaga", avisos em coluna, objetivo 5 travado): sem eles o playtest das peças não mede nada.

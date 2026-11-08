# Jerusalém Antiga — Design do jogo

Construtor de cidade de **sobrevivência** simples, isométrico, para celular (tela deitada) e PC.
A tensão vem de comida, abrigo e pessoas; a prata é o meio de construir. O tempo passa em
semanas e o ano tem um ciclo: preparar (outono e primavera), resistir (inverno frio e verão seco),
recuperar e crescer. O foco é a mecânica.
**Não há história, versículos nem mecânicas além das descritas aqui.** Toda mudança de regra deve
atualizar este documento, os JSON em `src/data/` e os testes em `tests/`.

Os números abaixo são os valores atuais; a fonte da verdade são os arquivos em `src/data/`.

## Mapa

- Grade lógica **48 x 48** células quadradas. O core trabalha com a grade quadrada; só o desenho
  é isométrico 2:1 (losangos).
- Terreno (`map.ts`, `rules.json > map`):
  - areia e grama seca, com manchas geradas por ruído (`grassShare` ≈ 45% de grama);
  - **rio** no lado leste, com 3 a 4 células de largura, serpenteando (não constrói; desvia no
    máximo 1 coluna por linha, então é sempre contínuo); a distância da borda do altar até a célula
    de rio mais perto é sorteada pela semente, de 8 a 18 células (`river.distance`). Quando o rio
    fica longe da borda do mapa, sobra terra do outro lado (sem ponte, fora do alcance das ruas);
  - **rochas** (70 a 100, sorteado, contando as do afloramento): não constrói e não pode ser removida;
  - **oliveiras** (80 a 110) e **palmeiras** (50 a 80), sorteadas: bloqueiam, mas podem ser
    cortadas com Demolir (5 prata);
  - **grupos garantidos** (o mesmo algoritmo para todos): cada um é um quadrado todo em terra
    livre, do lado do rio onde fica a cidade (oeste), fora da área livre, com uma célula de
    clareira em volta, e com o centro sorteado a uma distância da borda do altar:
    - **2 bosques densos** (`denseGrove`: min 2) com 24 + 2..8 árvores (oliveiras e palmeiras,
      tiradas dos totais) num quadrado de raio 3 (7 x 7), centro a 10–20 células do altar (na
      prática 13–19, porque o quadrado inteiro precisa ficar fora das 9 células livres e dentro do
      mapa). Servem à Coletora e ao Lenhador (que disputam as mesmas árvores);
    - **1 afloramento de rochas** (`rockOutcrop`: min 1) com 12 + 0..4 rochas (tiradas do total)
      num quadrado de raio 2 (5 x 5), centro a 10–18 células do altar (na prática 12–18). É o lugar
      da Pedreira;
  - o resto das rochas, oliveiras e palmeiras vem em **grupos** (rochas de 4 a 9, oliveiras de 7
    a 14, palmeiras de 6 a 12), cada grupo novo começando a 5+ células de qualquer outro, com
    clareiras entre eles (`CLUMPS` em `map.ts`; forma do terreno, não equilíbrio).
- Ficam livres de rochas e árvores: tudo a até 9 células da borda do altar (as tendas da caravana
  e a ruína do Templo ficam dentro disso) e uma faixa de 5 células (a rua inicial e 2 de cada lado)
  até a entrada.
- **Templo em ruínas** (plano Ruínas 1.1, `templeRuin` em `map.ts`): o prédio `temple` 6 x 6 já
  está no mapa desde a semana 0, sempre no mesmo lugar, **ao norte do altar**, x 21–26 e y 15–20,
  com o lado sul encostado na fila norte do anel (ligado desde o começo). Entrada, rua inicial,
  altar e ruína ficam num eixo só, de sul a norte. As células dela são grama ou areia, sem rocha
  nem árvore (reservadas mesmo que o raio livre mude); o rio nunca chega (fica a 8+ do altar, a
  ruína a no máximo 7). Testado em 1000 sementes; nelas o rio fica a 5+ células da ruína, e o raio
  12 do Templo pronto cobre toda a área livre do altar até y 32.

## Início

- **Altar** fixo, 4 x 4, ocupando x e y de 22 a 25, raio 4. Não está na barra de ferramentas e não
  pode ser demolido.
- **Ruas iniciais** de terra, de graça: um **anel** de 1 célula em volta do altar (contorno de
  x e y de 21 a 26, 20 células) e a rua na coluna x = 24, do anel (y = 26) até a borda sul. A
  célula onde ela toca a borda (24,47) é a **entrada da cidade**. São ruas comuns: Limpar pode
  removê-las.
- As junções das ruas são desenhadas só com ruas vizinhas; o altar não conta, então o anel aparece
  como um contorno com cantos e um T onde a rua sul encontra o anel.
- O jogo começa na **semana 1 do outono do Ano 1**. Prata **180** no Normal (cerca de 6 construções; Tranquilo 220, Difícil 160, ver Dificuldade).
- **Caravana fundadora** (sorteada pela semente, `caravans.start` em `rules.json`): **3 a 5
  famílias** de pessoas com nome (veja Pessoas) já moram em tendas (casas comuns de nível 1, de
  graça, uma família por tenda, no máximo 3 pessoas) em **colunas de duas a oeste do anel** (ao
  norte fica a ruína do Templo), dos dois lados de uma rua curta (`campRoad`, 6 células, y 23, x 15–20)
  que sai do anel; a coluna encostada no anel enche primeiro, norte antes de sul (a 5ª tenda abre
  a 3ª coluna, ao norte). A fundadora nunca traz
  um casal de noivos jovens (modelo `engaged`): o seu casal de noivos é o de `start.couple`. Ao lado, ao sul, fica um lugar 2 x 2 livre (`campPlazaSpot`, 19,26) onde **uma praça
  alcança todas as tendas** (quando ela abrir). As duas primeiras famílias trazem um filho e uma filha de 18 ou 19
  anos **noivos** (`people.couple`, `start.couple`): o primeiro casamento espera só uma casa vazia.
  Os outros filhos alternam filho e filha entre as famílias. A comida inicial vale **18 a 24
  semanas** do consumo das pessoas, cortada no limite sem celeiro (100). Frases na abertura:
  "A caravana chegou com 3 famílias e comida para 14 semanas" (as semanas da previsão) e, fora do
  tutorial, "Zebadias e Tamar querem se casar". A caravana traz também **40 de madeira** e nenhuma
  pedra (`startMaterials` em `rules.json`).
- Nenhuma abertura é sempre a melhor: mais famílias dão mais imposto e trabalhadores, mas comem
  mais; rio perto barateia o Pescador; bosque perto favorece a Coletora; rochas tiram espaço.
- Liberados: Mover, Rua, Casa, Campo, Pescador, Coletora, Lenhador e Demolir. **A praça não abre
  no início** (Pacote B1, `docs/revisoes/2026-11-06/plano-sobrevivencia.md`): o começo é sobreviver
  (comida, madeira, o primeiro inverno); ela abre no Objetivo 5.
- **Não há água no jogo** (desde o Pacote 2, 2026-11-04): o Poço saiu, nenhuma casa pede água e a
  porta das famílias não olha água. O rio é só terreno, pesca e o bônus dos campos na seca.

## Construções

| Construção | Custo | Manutenção | Tamanho | Vagas | Produção | Raio | Observações |
|---|---|---|---|---|---|---|---|
| Rua | 2 / célula | – | 1 x 1 | – | – | – | arrastar constrói em sequência |
| Casa | 40 + 10 madeira | – | 2 x 2 | – | impostos | – | começa como terreno vazio (as tendas da caravana são grátis) |
| Campo | 20 | 0,5/sem | 2 x 2 | 2 | 180 comida/ano fora do inverno (cerca de 4,6/sem), mais o bônus das oficinas | – | 4 plantações (só aparência); ver Colheita |
| Praça | 25 | 0,75/sem | 2 x 2 | – | – | 4 | liberada pelo Objetivo 5 (5 casas de barro); casas de barro no raio viram casas de pedra |
| Pescador | 20 | 0,5/sem | 2 x 2 | 1 | células de rio no raio × 0,38, máx. 1,9 comida/sem; × 0,3 no inverno | 2 | |
| Coletora | 20 | 0,5/sem | 2 x 2 | 1 | árvores no raio × 0,16, máx. 1,5 comida/sem; × 0,3 no inverno | 3 | |
| Lenhador | 25 | 0,75/sem | 2 x 2 | 2 | árvores no raio × 0,25, máx. 2,5 madeira/sem | 3 | categoria Trabalho; o ano todo; corta 1 árvore a cada 10 de madeira (ver Madeira e pedra) |
| Pedreira | 40 + 10 madeira | 1,75/sem | 2 x 2 | 3 | rochas no raio × 0,3, máx. 1,4 pedra/sem | 2 | categoria Trabalho; o ano todo; liberada pelo Objetivo 4 (passe o primeiro inverno); as rochas não acabam |
| Celeiro | 40 + 10 madeira | 1,75/sem | 3 x 3 | 1 | guarda 300 de comida (nível 2: 600, nível 3: 1000) | – | liberado pelo Objetivo 1; melhora (veja Níveis) |
| Mercado | 60 + 10 madeira | 3,5/sem | 2 x 4 | 3 | – | 5 (nível 2: 6, nível 3: 7) | liberado pelo Objetivo 7 (construir uma oficina); casas de pedra no raio dele e de um parque viram casas grandes; pode girar para 4 x 2; melhora |
| Oficina | 50 + 10 madeira | 1,75/sem | 3 x 3 | 3 | +10% da comida dos campos (nível 2: +20%, nível 3: +30%), soma até +30% (`fieldBonusMax`); não dá prata | – | liberada pelo Objetivo 6; 6 ofícios (só aparência); melhora |
| Parque | 60 + 5 pedra | 2/sem | 2 x 2 | – | – | 4 | liberado pelo Objetivo 12 (6 casas de pedra); casas de pedra no raio (e no de um mercado) viram casas grandes; dá Alegria |
| Lamparina | 8 | – (queima 0,05 madeira/sem) | 1 x 1 | – | – | 3 | categoria Casa; liberada pelo Objetivo 10 (30 moradores); na rua e com madeira, fica acesa e corta o roubo dos celeiros no raio para 25% |
| Curtume | 50 + 10 madeira | 1,5/sem | 2 x 2 | 2 | 1 roupa/sem com 0,4 de gado, pela lotação | – | categoria Trabalho; liberado pelo Objetivo 13 (Alicerce do Templo); ver Roupas e curtume |
| Templo | grátis (o lugar); as etapas pagam | – | 6 x 6 | – (construtores na obra) | – | 12 | lugar liberado pelo Objetivo 10 (30 moradores); sem manutenção; erguido em 5 etapas (ver Objetivos); protegido depois do Alicerce; o raio só dá Alegria, e só depois da Consagração |
| Altar | – | – | 4 x 4 | – | – | 4 | fixo no início; o raio só dá Alegria (não é exigência de casa) |

- **Pescador, Coletora, Lenhador e Pedreira** (`gather` em `buildings.json`, uma regra só,
  `gatherYield`): produção por semana = mín(`max`, células do recurso no raio × `perCell`) ×
  a lotação do local (veja Trabalho), do produto `gather.product` (comida quando falta; madeira no Lenhador, pedra na
  Pedreira); Pescador e Coletora rendem **× 0,3 no inverno** (`gather.winterFactor`; também na
  previsão), Lenhador e Pedreira o ano todo. Recurso: rio (Pescador), árvore (Coletora e Lenhador;
  oliveira, amendoeira, figueira e palmeira contam, toco não) ou rocha (Pedreira). Podem ser
  construídos em qualquer lugar; rendendo 0 mostram o balão "longe do rio", "sem árvores" ou "sem
  rochas". A prévia mostra "Rende N comida/sem" (ou madeira, pedra). Cortar árvores baixa a
  Coletora. Dois no mesmo recurso contam as mesmas células.
- **Celeiro:** a cidade guarda **100** de comida sem celeiro (`baseFoodStorage`); cada celeiro
  **ligado** soma o `storage` do seu nível (300 / 600 / 1000). A capacidade não depende da vaga
  preenchida. Comida acima do limite **estraga** no fim da semana, com o aviso "Comida estragando:
  construa um celeiro".
- **Oficina:** cada oficina **ligada** soma o `fieldBonus` do seu nível (10% / 20% / 30%) à comida de
  todos os campos, até +30% no total (`fieldBonusMax`). Vale também na previsão; não vale para
  pescador e coletora. Nenhuma construção dá prata: a prata vem só de impostos e prêmios.
- **Níveis das construções** (`levels` em `buildings.json`; a definição é o nível 1, `statOf` lê o
  valor do nível): Celeiro, Mercado e Oficina sobem até o nível 3 com a ação **Melhorar** do
  balão (`upgradeBuilding`): paga o custo do nível (Celeiro 60 / 100, Mercado 60 / 90, Oficina 50 /
  80) **mais pedra** (20 no nível 2, 40 no nível 3, `materials` do nível; segura a pedra que sobrava
  no fim da partida) e passa a pagar a manutenção dele (Celeiro 3,5 / 5,5, Mercado 5 / 8, Oficina 3,5 / 5).
  Não dá em dívida, sem prata, sem a pedra (`materials`) ou no topo. Toast "Celeiro subiu para o nível 2".
- **Roubo no celeiro** (`theft.ts`, `rules.json > theft`; peça C do `plano-dificuldade.md`, 2026-11-08):
  a partir de **20 moradores**, todo celeiro na rua **sem celeireiro** perde **3% por semana** da comida
  guardada nele (a comida acima do estoque base de 100, dividida entre os celeiros pela capacidade).
  Com celeireiro, nada. O roubo sai do saldo de comida da semana (`Economy.theft`, dentro de
  `foodDelta`), então a previsão já conta com ele. Toast uma vez por episódio: "Roubaram N de comida
  do celeiro: ponha um celeireiro"; o balão do celeiro diz em vermelho "Sem guarda: roubam N de
  comida/sem". O celeiro vem logo depois do campo na ordem em que o automático preenche as vagas
  (`jobPriority`). Sim, 100 seeds: Comum vence 69% e perde 10%; roubo de 3,5% da comida produzida,
  em 98% das partidas (com 5%: Comum 62% e 14% de derrotas).
- **Lamparinas** (`theft.ts`, peça D, 2026-11-08): a Lamparina (8 de prata, 1 x 1, sem manutenção)
  queima **0,05 de madeira por semana** enquanto está ligada à rua (`lampsBurn`, sai do saldo de madeira;
  a madeira nunca fica negativa). Acesa (na rua e com madeira no estoque, `lampLit`), ela corta o roubo
  de todo celeiro a até **3 células** dela para **25%** (`theft.litTheft`). Sem madeira, apaga e não
  guarda nada. O balão da lamparina diz quantos celeiros ela guarda, ou que está apagada; a prévia ao
  construir diz quantos guardaria. À noite a chama dela brilha no 3D (no lugar dos braseiros automáticos
  das ruas). Objetivo 11: "Ilumine o celeiro: 3 lamparinas". Sim, 150 seeds (com a manutenção de campo,
  pescador e coletora em 0,5): Comum vence 59% e perde 13%. Com 0,6 o Comum caía para 45% e 20%: o
  roubo empurrava o bot reativo a construir comida mais cedo, e a lamparina tira esse empurrão.
- **Manutenção** (`upkeep` em `buildings.json`, pelo nível) é cobrada **desde a primeira semana**,
  toda semana, de toda construção, **mesmo desconectada**, e também depois da vitória. O preço na
  coluna mostra custo e manutenção. **Local de trabalho vazio paga a manutenção inteira** (`emptyUpkeepFactor`
  1 em `rules.json`, `upkeepPaid` em `work.ts`; era 0,5 até a peça B do `plano-dificuldade.md`, em
  2026-11-08: errar tem que custar). Vale para os locais cujo trabalho aparece (pescador, coletora,
  campo, lenhador, pedreira, pasto, oficina, mercado), ligados ou não, em qualquer nível, quando
  ninguém trabalha ali. O aviso junta todos: "N locais sem ninguém custam X/sem: ponha gente em
  Profissões ou demola" (um só: "Lenhador sem ninguém custa X/sem…"). Se a prata não dura 26 semanas
  com a perda da semana, a linha "O que fazer agora" vira crise: "N locais vazios custam X/sem: ponha
  gente ou demola" e o toque abre Profissões. Celeiro, praça e parque pagam cheio; o campo
  no inverno com os lavradores descansando também (tem equipe). `Economy.upkeep`, o saldo e
  `costliestUpkeep` usam o valor pago. A ficha do local vazio mostra em vermelho "0,75 por semana, mesmo vazio".

## Madeira e pedra (Pacote 3)

- **Estoque da cidade**, como a prata: `wood` e `stone` no estado, **sem limite e sem depósito**.
  Começa com **40 de madeira e 0 de pedra** (`startMaterials`). Entra toda semana a produção dos
  Lenhadores e Pedreiras ligados × a lotação de cada um (`Economy.wood`, `Economy.stone`, o "+N/sem").
  Demolir não devolve material.
- **Custo de obra** (`materials` em `buildings.json`, além da prata): Casa 10 madeira; Celeiro,
  Mercado, Oficina e Pedreira 10 madeira; Parque 5 pedra; o Templo paga por etapa (ver Objetivos). **Não
  custam material:** Rua, Campo, Praça, Pescador, Coletora e Lenhador (comida e madeira nunca
  travam por material). Construir exige prata **e** material e paga os dois; sem material, falha
  com a razão `materials` sem gastar nada (a prata é conferida antes). `missingMaterial(s, kind)`
  diz o material que falta (madeira primeiro) para o botão, a prévia e o toast.
- **Evolução das casas** (`materials` em `houses.json`, pago ao subir para o nível): Casa de barro
  5 madeira, Casa de pedra 15 pedra, Casa grande 15 pedra + 5 madeira (terreno e tenda: nada).
  Veja Casas.
- **Corte** (`trees.ts`): cada Lenhador ligado soma a madeira que fez na semana (pela sua equipe)
  em `cutProgress`; a cada **10** (`cutEvery`) corta a **árvore mais próxima no raio** (menor
  distância ao quadrado até a área do Lenhador; empate pela célula de menor índice, ou seja,
  linha de cima e depois coluna da esquerda). A árvore vira **toco** (feature `stump`, guardado em
  `stumps` com o tipo e a semana), com o evento `treeCut`. O toco não conta para Coletora nem
  Lenhador. Sem árvore no raio, o Lenhador guarda no máximo **um** corte esperando (não acumula).
  Na semana, o corte vem antes da rebrota: uma árvore que volta não é cortada na mesma semana.
- **Toco não bloqueia:** construir ou pôr rua em cima é permitido, sem custo a mais, e o toco some
  (não volta). Demolir não age num toco. Toco livre volta a ser **a mesma árvore** (oliveira ou
  palmeira) depois de **104 semanas** (`treeRegrowWeeks`), com o evento `treeRegrown`.
- **Rochas** não acabam e continuam sem demolir.
- A porta das famílias **não** olha materiais.
- **Prévias** (`readouts.ts`): `sharedTrees(s, x, y, kind)` conta as árvores que um Lenhador (ou
  Coletora) naquele lugar dividiria com as Coletoras (ou Lenhadores) existentes ("Divide o bosque
  com …"); `foodAfter` diz o produto (`product`) e o rendimento; `weeksPerCut(n)` = 10 / n semanas
  por árvore cortada, para cima ("corta 1 árvore a cada N sem"); `upgradeGain` diz o material
  pedido ao evoluir.

- Tamanho é largura (x) por altura (y) em células. O **Mercado** é o único que gira: tocar de novo
  no botão Mercado (ou a tecla R no PC) alterna entre 2 x 4 e 4 x 2; a escolha vale para as
  próximas colocações.

- O raio é **quadrado**: cobre toda célula a até N colunas e N linhas de distância. Em construções
  maiores, mede a partir de qualquer célula da construção. Uma construção é atendida se
  **qualquer** célula da sua área estiver no raio.
- Demolir remove construções e ruas sem reembolso (exceto altar e templo) e corta árvores por 5 prata.
- **Comida perdida ao demolir** (`foodLostIfRemoved` em `readouts.ts`): quanto da comida guardada
  estragaria na hora se a construção ou rua da célula sumisse (um celeiro, ou uma rua cujo corte
  desliga um celeiro, baixa o estoque); 0 quando nada se perde. Serve à prévia de Demolir
  ("Perde N de comida"). No celular, o primeiro toque de Demolir no que perderia comida abre o
  balão dele (para confirmar ali), em vez de demolir.

## Lenha e inverno (Pacote 4)
Plano: `docs/revisoes/2026-11-05/plano-p4.md`. Código: `src/core/firewood.ts`.
- **Queima:** em cada semana de **inverno**, cada casa com gente queima a `firewood` do nível
  (`houses.json`): Tenda **0,3**, Barro **0,2**, Pedra **0,15**, Casa grande **0,15**; o terreno
  vazio não queima. Sai de `s.wood` depois da produção da semana. Fora do inverno nada queima. A
  lenha é a própria madeira (sem recurso novo).
- **Frio:** se a madeira não paga a queima da semana, a cidade queima o que tem, a madeira vai a 0 e
  `s.cold` fica verdadeiro (eventos `coldStart` / `coldEnd`). No frio as casas sofrem **como na
  fome**, com os mesmos números (a subida pausa; nível > 1 cai com `famineDropChance`; tenda sai com
  `winterFamineLeaveChance`); fome e frio juntos fazem **um** sorteio só. Família que sai pelo frio tem
  o motivo `cold`. O frio marca `winterLoss`.
- **Limite do estoque:** madeira e pedra guardam no máximo **400** cada (`materialStorage`,
  `rules.json`). A produção só entra até o limite; um estoque acima não é cortado. Lenhador ou
  Pedreira com o estoque cheio rende 0, e o Lenhador só corta árvores pela madeira que entrou.
- **Previsão:** `firewoodShort(s, eco)` no outono e no inverno: a madeira que falta para queimar até a
  primavera (estoque + produção até lá contra a queima das semanas de inverno que faltam).
- **Avisos:** `firewood` logo depois da comida ("A lenha não dura o inverno: faltam N de madeira.
  Construa um lenhador"; com frio "Frio! Sem lenha, as casas esvaziam. Construa um lenhador");
  `storageFull` por último ("Estoque de pedra cheio (400): a pedreira parou"); `winterComing` vale com
  qualquer casa com gente ("O inverno está chegando: guarde comida e lenha"; com gente em tenda, "O
  inverno está chegando: na tenda, crianças pequenas e idosos podem morrer de frio. Suba para barro
  (5 de madeira)").
- **Tela:** a madeira do topo fica vermelha com ⚠ quando a lenha não dura ou com frio; toasts "Frio!
  Acabou a lenha: construa um lenhador" e "A lenha voltou: as casas se aquecem"; balão da casa no
  outono e no inverno "Lenha no inverno: N/sem" (com frio, vermelho "Frio: falta lenha"); balão do
  Lenhador/Pedreira cheio "Parado: estoque cheio (400)" no lugar da linha "Rende N" (e "Sem rochas/árvores por
  perto" só quando não há fonte, nunca por falta de trabalhadores); no frio as chaminés param de soltar fumaça;
  casa que cai no frio mostra "Frio -N".

### Morte de frio (Pacote B3 "O frio pesa")
Plano: `docs/revisoes/2026-11-06/plano-sobrevivencia.md` seção 4. Código: `src/core/cold.ts`.
- Em cada semana de **inverno**, depois da queima da lenha e antes das casas, cada morador sorteia a
  sua chance de morrer de frio (`rules.json > coldDeath`; pares = vulnerável, outros). **Vulnerável**
  = criança até **4** anos (`childAge`) ou idoso (50+).

| Onde | Vulnerável | Outros |
|---|---|---|
| Tenda, com lenha (`tent`) | 1% | 0 |
| Tenda, sem lenha (`tentCold`) | 4% | 1% |
| Barro ou melhor, sem lenha (`houseCold`) | 1% | 0 |
| Tenda, com lenha e sem roupa (`tentRagged`) | 2% | 0 |
| Barro ou melhor, com lenha e sem roupa (`houseRagged`) | 0,5% | 0 |
| Barro ou melhor, com lenha e roupa | 0 | 0 |

Sem lenha vale a linha do frio, com roupa ou sem (o frio já é pior).

- **Fome junto** multiplica a chance por **2** (`famineFactor`). Chance 0 não sorteia. Quem está a
  caminho não sorteia. O sorteio da casa (cair ou sair) continua um só.
- A morte é como a de idade: `departed` com a causa `coldDeath`, o cônjuge fica viúvo, a vaga de
  trabalho fica livre, a casa do último morador fica vazia. Evento `coldDeath`, marca
  `winterLoss` (o marco do primeiro inverno não sai). `yearStats.deaths` e `yearStats.coldDeaths` contam.
- No 1º dia da primavera, evento `winterToll` com quantos o frio levou no inverno (só se > 0).
- **Tela:** um toast por semana, "O frio levou Ana, 2 anos" (bebê: "O frio levou Ana, bebê"), os
  outros somados ("O frio levou Ana, 2 anos e mais 2 pessoas"), e "Frio" subindo de cada casa; na
  primavera "O inverno levou N pessoas". Ficha da tenda no outono e no inverno: "Tenda fria: risco
  para crianças e idosos" (amarelo; vermelho no frio). Estatísticas, aba Povo: "De frio" no ano (só
  quando há). A ficha da pessoa mostra "† aos N".

### Roupas e curtume (peça E do `plano-dificuldade.md`, 2026-11-08)
Código: `src/core/clothes.ts`, `tans` do curtume em `buildings.json`, `rules.json > clothes`.
- O **Curtume** (2 x 2, 50 de prata + 10 de madeira, manutenção 1,5, 2 vagas; categoria Trabalho)
  é liberado pelo objetivo **Alicerce do Templo**; o objetivo seguinte é "Construa um curtume" (+60).
  Pela lotação, ele tira **0,4 de gado por semana** do curral e faz **1 roupa por semana**
  (`Economy.hides` e `Economy.clothes`). Tira o gado depois do que os pastos trazem e **antes da
  oferta do altar**: curtume e altar disputam o mesmo gado. Para sem gado no curral e com o estoque de
  roupas cheio (**100**, `clothes.storage`). Na `jobPriority` vem logo depois do pasto.
- A cidade **precisa de roupa** a partir do **primeiro outono depois de liberar o curtume**
  (`s.dressing`; uma estação de aviso). Em cada semana de inverno, cada morador gasta **0,03 de roupa**
  (`clothes.perPerson`; 25 moradores gastam ~10 roupas num inverno). Se o estoque não paga, a cidade
  usa o que tem, o estoque vai a 0 e fica **sem roupa** (`s.ragged`): crianças e idosos podem morrer
  de frio mesmo com lenha (tabela acima). Não derruba casa.
- **Tela:** pílula **Roupas** depois de Gado (desde a liberação): "N · dura N invernos" (vermelha com
  ⚠ quando falta). Aviso no outono e no inverno: "Faltam N roupas para o inverno: construa um curtume";
  sem roupa, "Sem roupa! O frio pega crianças e idosos mesmo com lenha. Construa um curtume". Toast
  "Acabou a roupa…" uma vez por episódio. Balão da casa no inverno sem roupa: "Sem roupa: frio para
  crianças e idosos". Balão do curtume: "Faz N roupas/sem com N de gado" (ou "Parado: sem gado no
  curral"); balão do altar: "Curtume leva N gado/sem".

## Dificuldade (peça F do `plano-dificuldade.md`, 2026-11-08)
Código: `src/core/difficulty.ts`, números em `src/data/difficulty.json`.
- No título, acima de "Começar", três cartões: **Tranquilo** ("Invernos leves, obras mais baratas"),
  **Normal** ("O jogo como foi pensado") e **Difícil** ("Invernos cada vez mais duros e obras caras").
  Vem marcado o último escolhido (Normal na primeira vez; guardado no navegador). Fica em
  `s.difficulty` e não muda na partida; "Mesmo mapa" e "Tentar de novo" mantêm a escolha. O mapa da
  semente é o mesmo em todas. A dificuldade aparece nas Estatísticas (embaixo do saldo de prata) e nos
  cartões de vitória e derrota ("Dificuldade: Difícil.").

| Chave | Tranquilo | Normal | Difícil |
|---|---|---|---|
| Prata inicial (`startSilver`) | 220 | 180 | 160 |
| Comida comida (`food`) | × 0,9 | × 1 | × 1,05 |
| Lenha (`firewood`) e roupas (`clothes`) | × 0,8 | × 1 | × 1,1 |
| Manutenção (`upkeep`) | × 0,8 | × 1 | × 1,1 |
| Local de trabalho vazio (`emptyUpkeep`, sobre `emptyUpkeepFactor`) | × 0,5 | × 1 | × 1 |
| Roubo do celeiro (`theft`) | × 0,5 | × 1 | × 1,25 |
| Oferta do altar (`offering`) | × 0,75 | × 1 | × 1,1 |
| Etapas do Templo: prata e materiais (`templeCost`), obra (`templeWork`) | × 0,8 | × 1 | × 1,1 |
| Inverno mais duro por ano, do Ano 3 (`winterGrowth`) | 0 | 0 | +2% |
| Teto do inverno mais duro (`winterGrowthMax`) | 0 | 0 | +10% |

- **Invernos mais duros** (só no Difícil): no inverno do Ano 3 em diante, a comida comida, a lenha e
  as roupas do inverno sobem `winterGrowth` por ano depois do Ano 2, até o teto (Ano 3 +2%, Ano 4
  +4%… até +10%). As previsões contam o inverno mais duro: a da comida, semana a semana, e as do
  outono (lenha, roupas) o inverno que vem (`comingWinterGrowth`). Os balões mostram a manutenção e a
  lenha como o jogo cobra (`upkeepOf`, `houseFirewood`).
- A comida que as caravanas trazem ("comida para N semanas") é a mesma em todas as dificuldades: a
  previsão do jogo já mostra quanto ela dura de fato.
- As etapas do Templo do jogo vêm de `stageOf(s, k)` (arredondadas; obra no mínimo 1); no Normal são
  os números de `temple.json` como estão.
- Sim, 100 seeds (Comum / Eficiente / Distraído, vence-perde): Tranquilo 88/1, 95/3, 0/64; Normal
  ~49/17, 69/12, 0/92; Difícil 19/29, 43/19, 0/90. O plano pedia invernos que crescem também no
  Normal (+5% ao ano até +30%): com eles o Comum caía para 19% de vitórias e 27% de derrotas, e mesmo
  com +2% até +10% para 34/26; ficaram só no Difícil, e o Difícil ficou mais brando que o do plano
  (com os números do plano: Comum 0/54, Eficiente 9/41).

## Ruas e conexão

- A **rede conectada** são as ruas ligadas ao altar por vizinhança ortogonal (busca em largura a
  partir do altar). É recalculada a cada construção ou demolição e no início de cada semana.
- Uma construção está **conectada** se alguma célula vizinha (ortogonal) da sua área faz parte da
  rede. Encostar no próprio altar (qualquer das 16 células) também conta. Pessoas e famílias
  andam só pelas ruas, nunca por dentro do altar.
- Sem conexão:
  - casas não recebem família e regridem como se faltasse uma exigência (tenda sem rua vira
    terreno vazio após 3 semanas);
  - campos, pescadores, coletoras, oficinas, mercados, celeiros e templo não produzem nem contam
    vagas; celeiro desligado não guarda comida;
  - praças, mercados, parques e templo não dão cobertura;
  - aparece um balão "sem rua" (rua partida riscada).
- Ruas fora da rede aparecem apagadas e tracejadas. Ao terminar de construir (toque ou arraste)
  uma rua que ficou fora da rede, aparece "Esta rua não está ligada ao altar".
- Construir longe da rua é permitido (o jogador aprende pelo balão). **Exceção:** o Templo só pode
  ser colocado encostado numa rua conectada.
- Uma casa que perde a rua cai um nível a cada `weeksToDowngrade` semanas; quando a tenda vira
  terreno, as pessoas vão embora (evento `familyLeft` com `reason: 'road'` e o nome do mais velho,
  toast "A família de Abias foi embora: tenda sem rua ligada ao altar"; na fome, `reason:
  'famine'` e "… foi embora: fome").
- Casas desconectadas continuam contando moradores e impostos até regredirem.

## Trabalho (Pacote B2)
Plano: `docs/revisoes/2026-11-06/plano-sobrevivencia.md` (seção 3). Código: `src/core/work.ts`.
- **Cada adulto tem o seu trabalho** (`Person.jobId`, o id do local; só adultos que moram na
  cidade, `canWork`). Não há mais eficiência única da cidade: **cada local produz × (pessoas nele /
  vagas)** (`staffOf`); **local sem ninguém produz 0**. Isso vale para campo, pescador, coletora,
  lenhador, pedreira e para o bônus da oficina. O **mercado só atende com pelo menos 1 pessoa**
  (`staffedServices` em `rules.json`); o celeiro guarda mesmo vazio e o templo não muda.
- **Quem entra sozinho** (`assignJobs`, no `refreshCity`: começo e fim de cada semana e depois de
  construir, demolir ou mexer em rua): primeiro solta quem não pode mais ficar (fez 50 anos, morreu,
  saiu da cidade, o local foi demolido ou perdeu a rua, mais gente que vagas: saem os de id maior);
  depois cada vaga livre vai ao adulto sem trabalho que **mora mais perto** (Manhattan da casa ao
  local; empate pelo id), com os locais na ordem `jobPriority` (pescador, coletora, campo, lenhador,
  pedreira, pastor, celeiro, mercado, oficina, templo) e, no mesmo tipo, o mais antigo. **O jogo nunca move
  quem já tem trabalho.**
- **O campo no inverno** congela, mas os lavradores ficam nele, descansando (contam como empregados).
- **Mudar a profissão** (`setJob`, jogador): na ficha da pessoa, "Mudar" abre uma lista curta com
  cada local ligado com vaga livre ("Pescador 0/1", "Lenhador 1/2", o mais perto da casa primeiro)
  e "Sem trabalho". Grátis e na hora; as metas do painel Profissões acompanham (a profissão deixada
  fica com uma pessoa a menos; a de destino, se for um número, abre lugar para quem chega sem passar das vagas e sem subir se já faltava gente), para o jogo não
  desfazer a troca. "Sem trabalho" baixa a meta da profissão deixada; a pessoa pode ir para uma vaga
  livre de uma profissão automática. Lista
  vazia: "Nenhuma vaga livre: construa um lenhador, campo ou oficina". Criança, idoso e quem está a
  caminho não têm o botão. Esc ou um toque no mapa fecha a lista.
- **Balão do local de trabalho:** "Trabalhadores 1/2" e os nomes (tocar abre a ficha); vazio,
  "Ninguém trabalha aqui: abra Profissões" quando há alguém para mover (um adulto
  sem trabalho, ou num local com 2 ou mais: `anyoneToMove`); senão "Ninguém trabalha aqui: faltam
  adultos (N crianças na cidade)" (o balão sobre o mapa é o de "sem trabalhadores").
- **Toasts:** construir um local que produz sem ninguém livre: "Ninguém livre para o Lenhador:
  abra Profissões" (uma vez por arrasto); o aviso de local vazio: "Lenhador sem trabalhadores: abra
  Profissões"; o mercado que perde o último trabalhador (na
  semana, evento `serviceEmpty`, ou pelo "Mudar"): "Mercado vazio: não atende as casas".
- **Painel Profissões** (`src/ui/jobs.ts`, modelo puro `src/game/model/jobs.ts`): abre pelo botão
  Profissões (PC: na lateral, sob Estatísticas; celular: um disco com nome depois de Demolir, porque
  cinco botões não cabem na lateral), pela pílula de Moradores e pela tecla **P**; fecha com ✕, Esc,
  toque no mapa ou o mesmo botão. Cabeçalho com "Profissões", **Automático** (dourado quando alguma
  meta é um número; cinza sem efeito quando tudo já é automático) e ✕. Primeira linha fixa: **Sem
  trabalho N** e, pequeno, "N crianças, N idosos". Depois uma linha por profissão **construída**, na
  ordem `jobPriority`: miniatura da construção, nome (Pescadores, Coletoras, Lavradores, Lenhadores,
  Pedreiros, Celeireiros, Mercadores, Artesãos, Construtores), "2 de 4 vagas" (ou "sem rua"), em âmbar
  "falta N" quando há menos gente que a meta, e **− [meta] +** (botões de 44 px). Meta automática:
  o número é o das vagas, cinza, com o selo "auto"; + fica cinza (já quer todas). − tira na hora quem
  mora mais longe. Sempre que alguma profissão espera gente e ninguém está livre, o cabeçalho do painel
  diz "Ninguém livre: use − em outra profissão" (o jogo nunca tira alguém de um trabalho sozinho; playtest
  2026-11-07: um Pescador vazio em "0 de 1 vaga" sem explicação), e a linha fica com "falta N" até alguém ficar livre. Celular deitado: duas
  colunas que enchem de cima para baixo, o painel desce até a borda da tela (cobre as ferramentas
  enquanto aberto, e os toasts esperam ele fechar) e cabe sem rolar; PC: uma coluna.
- **Metas das profissões** (`s.jobTargets`, core em `work.ts`/`actions.ts`): sem chave = automática
  (todas as vagas, o jogo de antes do painel, dígito a dígito); um número limita a equipe do tipo. Toda
  semana e a cada mudança, `assignJobs` solta quem passa da meta (quem mora mais longe do trabalho;
  empate: id maior) e enche as vagas livres primeiro nas profissões com meta em número (o jogador
  pediu gente ali), depois pela `jobPriority`, pulando os tipos na meta; o jogo não
  move ninguém empregado para outro tipo. − = mín(meta, equipe) − 1 (nunca abaixo de 0); + soma 1 a
  uma meta em número, até as vagas construídas. Construir (ou melhorar) um local de um tipo com meta
  em número soma as vagas novas à meta; demolir corta a meta às vagas que sobram. Automático limpa
  todas as metas.
- **Estatísticas:** aba Agora com adultos, vagas do ano, sem trabalho e vagas livres; aba Povo com
  "Trabalho: 8 de 10 adultos · 2 sem vaga".
- **3D:** só anda quem trabalha: um local sem ninguém não manda moradores (`walkers.ts`) nem
  pescador, coletor ou carregador (`haul.ts`); quem anda até um local é uma pessoa dele (`castWalkers`).

## Casas

| Nível | Nome | Cabem | Imposto/sem | Exige |
|---|---|---|---|---|
| 0 | Terreno | 0 | 0 | – |
| 1 | Tenda | 3 | 1,25 | rua |
| 2 | Casa de barro | 4 | 1,75 | rua |
| 3 | Casa de pedra | 6 | 2,5 | rua, praça |
| 4 | Casa grande | 8 | 3,25 | rua, praça, mercado, parque |

As exigências são serviços com raio (`needs` em `houses.json`): a casa é atendida se alguma
célula dela estiver no raio de uma praça, mercado ou parque **ligado**. O altar e o templo não
fazem parte da evolução (só dão Alegria). Desde o Pacote B1 a tenda vira casa de barro **só com a
rua e a madeira**: a primeira evolução é de material, não de serviço; a praça é da casa de pedra e
o mercado (junto do parque) da casa grande.

**Moradores são pessoas** (veja Pessoas): `capacity` é quantas cabem; uma casa subir de nível não
traz ninguém, só dá lugar para filhos e parentes. **Uma casa tem nível 1 ou mais exatamente
quando mora alguém nela.** Quando a última pessoa sai, a casa vira terreno (nível 0) e guarda o
nível que tinha (`emptyLevel`; a tenda guarda 0): quem chegar depois entra direto nesse nível.
No mapa, a casa vazia com `emptyLevel` ≥ 2 mostra o desenho desse nível com a porta fechada
e uma tranca, sem gente, bichos, fumaça, varal nem toldo, num tom empoeirado.
O imposto é por casa (com o fator da Alegria), não por pessoa.

**Material ao evoluir** (coluna nova de `houses.json`): Casa de barro **5 madeira**, Casa de pedra
**15 pedra**, Casa grande **15 pedra + 5 madeira**. Cumpridas as `upWeeks` semanas e as exigências, a casa
sobe só se houver o material, e **paga na hora**. Sem material, a contagem fica parada no fim e
a casa guarda `waiting: 'wood' | 'stone'` (o primeiro que falta) até o material chegar; sobe na
semana em que ele chega (a produção entra antes da evolução). Casas prontas na mesma semana pagam
na ordem da lista (a **mais antiga primeiro**). Perder uma exigência zera a contagem e a espera.
Cair de nível não devolve; subir de novo paga de novo. **A madeira é a lenha do inverno primeiro**
(`keepsFirewood`): no outono e no inverno, se pagar a madeira deixaria a lenha faltar até a
primavera (`firewoodShort` depois de pagar, contando a produção até lá), a casa não paga, guarda
`firewoodHold` e espera no fim da contagem; o balão diz "Pronta para virar Casa de barro: a madeira é
a lenha do inverno" (vermelho). Na primavera ela sobe se houver o material. O aviso `material` ("N casas esperando
madeira/pedra: construa um lenhador", ou, se o material já chega, "já chega aos poucos, um lenhador a
mais acelera") vem logo depois da comida (ordem: dívida, comida acabando, material, estoque
cheio, inverno, seca, saldo, desemprego). Com o bônus das oficinas no teto, o aviso de desemprego
manda para o Lenhador ou a Pedreira.

**Evolução lenta:** cada casa sorteia ao ser construída, e a cada nível, quantas semanas leva para
subir: **11 a 15** (`weeksToUpgrade`, `upWeeks`). Ela sobe depois de `upWeeks` semanas seguidas
com as exigências do próximo nível. Cair continua rápido: **3 semanas** (`weeksToDowngrade`) sem uma
exigência do nível atual. O balão da casa mostra a contagem ("Casa de barro em N sem",
`weeksToNextLevel`) e "N/M moradores". Uma exigência que ainda está bloqueada também aparece, com
o objetivo que a libera, e o balão sobre a casa mostra o ícone dela com um cadeado.

## Felicidade

A felicidade (na tela, **Alegria**) vale **desde o começo da partida** (B4, 2026-11-08; antes só
depois do Parque): imposto, nascimentos, carinha na placa e balão de casa triste desde a semana 0.

Cada casa com família tem uma felicidade de 0 a 100 (`happiness` em `rules.json`, código em
`src/core/happiness.ts`), calculada toda semana:

| Motivo | Pontos |
|---|---|
| base | 50 |
| no raio do altar ou do templo | +10 |
| no raio de um parque | +20 |
| no raio de uma praça | +5 |
| no raio de um mercado | +5 |
| imposto (Governo): +8 a cada 10% abaixo de 20%, −8 a cada 10% acima | 0% +16, 10% +8, 30% −8 |
| fome na cidade | −30 |
| inverno sem lenha (frio) | −20 |
| inverno numa tenda, com lenha | −10 |
| inverno sem roupa, com lenha | −10 |
| desemprego: parte dos trabalhadores sem vaga × 40 | até −10 (era −20 até o B4) |

Só contam serviços **conectados**. O valor fica entre 0 e 100.

- **Imposto (Governo, G, 2026-11-08):** o jogador escolhe 0, 10, 20 ou 30% (começa em 20%,
  `rules.json > tax`) na linha **Imposto** do painel Profissões (logo abaixo de "Sem trabalho", com
  − / +, e o efeito na Alegria embaixo do nome). Cada casa paga o imposto do nível × taxa / 20 (0%:
  nada; 30%: uma vez e meia). É o destino da prata parada: baixar o imposto deixa a cidade feliz
  (mais nascimentos, e casas felizes pagam até +20%); subir dá prata numa crise, com a cidade mais
  triste.
- **Humor:** feliz com 65 ou mais; triste abaixo de 35; contente no meio.
- **Imposto:** contente paga o imposto normal; feliz paga mais, subindo em linha reta até
  +20% com 100; triste paga menos, até −20% com 0.
- **Nascimentos:** a felicidade da cidade é a média das casas com família (50 sem nenhuma). Ela
  multiplica a chance de nascer criança (`birthFactor`): 1 enquanto contente, até 1,5x feliz
  (`birthMax`) e até 0,5x triste (`birthMin`).
- Casa triste **não** é abandonada nem cai de nível por isso (por enquanto só paga menos e tem
  menos filhos).
- A oficina ainda não incomoda as casas vizinhas (fica para depois, a pedido).

## Pessoas

Cada morador é uma **pessoa** com nome (`names.json`; o sobrenome é o do clã do pai), sexo, semana
de nascimento, casa (`houseId`; null enquanto anda), cônjuge e caravana de origem (0 a fundadora,
1… as seguintes, null nascido na cidade). Quem sai ou morre vai para `departed` com a semana e o
motivo. Código em `people.ts`, `life.ts`, `families.ts` e `caravans.ts`; números em
`rules.json` (`people`).

- **Idade:** 1 estação (13 semanas, `weeksPerLifeYear`) = 1 ano de vida. Criança até 13 anos,
  adulto de 14 a 49 (`adultAge`), idoso de 50 (`elderAge`). Comida por semana: criança 0,25,
  adulto 0,2, idoso 0,15 (`people.food`), × o fator do inverno (tenda 2, outras casas 1,6).
  **Trabalhadores são os adultos** que moram na cidade.
- **Morte:** no aniversário, chance pela idade (`death`: 2% aos 50, 6% aos 60, 15% aos 70, 35% aos
  80, todos aos 90). Toast "Morreu Abias, aos 72 anos".
- **Idosos:** um idoso que mora sozinho vai morar com um filho que tenha lugar (a casa de nível
  mais alto, depois a mais perto), andando pelas ruas.
- **Noivado:** cada semana, cada homem solteiro de 18 a 40 anos (`marriageAges`) noiva com chance
  **5%** (`marriageChance`) se houver uma mulher solteira na idade, de outra casa, sem pai ou mãe em
  comum e com no máximo 15 anos de diferença (`maxAgeGap`): a de idade mais perto.
- **Casamento:** os noivos procuram casa, do noivado mais antigo para o mais novo. Se um deles
  mora sozinho, o outro se muda para lá na mesma semana. Senão, andam da casa dele até a melhor
  casa vazia (`freeHouses`: maior `emptyLevel`, depois a mais perto) e **casam ao chegar**
  ("Zebadias e Tamar se casaram!", marco Primeiro casamento). Sem casa vazia esperam; o aviso
  "Casal esperando casa: construa uma casa" fica na lista e, nas últimas 13 semanas
  (`coupleWarnWeeks`), "Zebadias e Tamar vão embora em N sem: falta casa". Depois de **52
  semanas** (`coupleWaitWeeks`) o casal vai embora ("… foram embora: não havia casa").
- **Nascimento:** só quando a cidade deixa (`birthBlock`): sem fome e com a comida durando até a
  próxima colheita com uma reserva de **−3 semanas** (`birthFoodReserveWeeks`): os filhos nascem
  mesmo com a comida apertada, e só param quando ela acabaria **3 semanas ou mais antes da
  colheita** (em semanas de consumo fora do inverno); motivo `storage` quando duraria, mas o
  estoque corta. Então cada casal que mora junto, com a mãe de 18 a 45 anos
  (`fertileAges`), lugar na casa e o último filho há 13 semanas ou mais (`birthGapWeeks`), tem
  um filho com chance **8%** por semana (`birthChance`) × o fator da Alegria. Toast "Nasceu Ana,
  filha de Abias e Sara". Com um casal em casa e nascimentos bloqueados, o aviso diz por quê
  ("Sem nascimentos: …").
- **Saídas:** fome ou falta de rua esvaziam a casa inteira (a família vai embora andando,
  "A família de Abias foi embora: fome"); demolir uma casa com gente também.
- **Andar:** as famílias andam pelas ruas (caminho por busca em largura), **6 células por semana**
  (`familyCellsPerWeek`), da casa delas ou da **entrada da cidade**. Se a rua do caminho for
  cortada, recalculam a rota; sem rota, ou com a casa demolida, desligada ou ocupada, desistem
  (quem vinha de fora vai embora). Se a entrada for desligada da rede, saem do altar.

## Caravanas

Além da fundadora, cada partida sorteia no início (`rollCaravans`, `caravans.later`) as caravanas
seguintes: uma entre as semanas 30 e 60 (fim do Ano 1, era 52–98 até o playtest de 2026-11-07, quando a meta de 5 casas de barro travava à espera dela; a metade mais longa da espera caiu pela metade: p75 53 → 27 sem, p90 82 → 45; **3 famílias: as duas primeiras sempre casais de noivos
jovens**, `engaged` 2, e uma sorteada), uma entre 156 e 260 (Anos 4–5, 2 a 3) e, em metade das partidas,
uma entre 312 e 415 (2 a 3). Cada uma é **anunciada 4 a 8 semanas antes**
(`warnWeeks`): toast "Uma caravana de 3 famílias chega no inverno" e o aviso "Caravana com 3
famílias em N sem: falta 1 casa vazia". Ao chegar, cada família (de um dos modelos `templates`:
pai, mãe e filho; ou um casal jovem casado de 20–28 anos; ou com o avô; ou um **casal de noivos**
de 18–22 anos, de duas famílias com nomes diferentes; pesos 3, 3, 2, 1 e 30: cerca de 3 em 4
famílias sorteadas são noivos) toma uma casa vazia (`freeHouses`) e entra
pela entrada da cidade; os noivos tomam **uma** casa e **casam ao chegar** (conta como casamento
do ano, toast de casamento e marco Primeiro casamento). As que não acham casa seguem viagem (não
ficam registradas). Quem fica traz
**4 a 8 semanas** da sua comida, cortada pelo estoque. Marco Primeira caravana (só se alguém
ficar).

## Tempo

- **1 passo = 1 semana** (3,2 s em 1x, `weekSeconds`; 1 ano ≈ 2,8 min). **13 semanas por estação**
  (`weeksPerSeason`), 52 por ano. No código o passo se chama `week` (`weeksToUpgrade`,
  `debtWeeksToLose`, `familyCellsPerWeek`…).
- O jogo começa no **outono**, e o **ano começa no outono** (ano agrícola): Ano N = outono,
  inverno, primavera e verão. Ano = semana ÷ 52 + 1 (para baixo); semana na estação de 1 a 13.

## Colheita

- O campo dá comida **na primavera, no verão e no outono**, desde a semana em que é construído:
  **180 por ano** (`harvest` em `buildings.json`) nas 39 semanas fora do inverno, ou seja
  **cerca de 4,6 por semana × a lotação do campo** (desde o aperto de 2026-11-07: um campo e um pescador
  seguram o Ano 1, mas do Ano 2 em diante a cidade pede 3 a 5 fontes de comida e o celeiro). **No inverno ele congela** (`harvestsIn`): não dá
  comida; desde o Pacote B2 os lavradores **ficam nele, descansando** (não migram para o pescador
  ou a coletora; só o jogador os move). O desafio é guardar comida para o inverno (estoque e celeiro).
- A prévia mostra "Rende N comida/sem" e "Comida depois: ±X/sem" (veja Interface Nova); no
  inverno, "Congelado no inverno: volta em N sem". O balão do campo diz que ele dá comida na
  primavera, no verão e no outono.
- O campo tem 2 vagas, ocupadas o ano todo (veja Trabalho). A colheita é anunciada uma vez por
  ano, na primeira semana da primavera.
- **Seca:** cada ano é seco ou não, sorteado pela semente do mapa (`drought` em `rules.json`):
  chance **25%**, nunca nos Anos 1 e 2 (`safeYears` 2: a primeira seca possível é na primavera do
  Ano 3), nunca dois anos seguidos. Num ano seco a colheita é **× 0,25**,
  exceto nos campos **encostados no rio** (alguma célula vizinha, lado com lado, é rio), que colhem
  normal. A seca é anunciada na **semana 1 do inverno**: "As chuvas estão fracas este ano".

## Previsão de comida

Uma função pura (`foodForecast`), calculada uma vez por atualização da tela (junto com a
economia, em `readCity`) e repassada à barra, aos painéis, aos avisos, ao inspetor e à cena,
simula semana a semana a partir de agora: o consumo **das pessoas que moram na cidade hoje** (cada
uma pela sua idade, com o fator do inverno da sua casa; quem está andando não conta), pesca e
coleta (× 0,3 no inverno), os campos (com a seca, se já anunciada) e o limite do estoque (o que
passa estraga). Ela responde em quantas semanas a comida acaba e se chega ao **começo da próxima
colheita** (a próxima semana 1 da primavera; durante a primavera, a do ano seguinte, contando o
que ainda vai ser colhido). Usada por:

- **nascimentos** (veja Pessoas);
- **pílula de comida:** "até a primavera" quando chega (nada quando a cidade não tem moradores); senão "acaba no <estação>" (a estação em
  que acaba);
- **aviso** "A comida não dura até a primavera: pesque, colete ou plante campos" (em qualquer
  estação, na lista de Avisos enquanto valer; toast só se começar no verão);
- **Objetivo 1.**

## Simulação

A cada semana, nesta ordem (`simulation.ts`):

1. Recalcular rede de ruas, conexões e cobertura (praça, mercado, parque e, para a Alegria,
   altar/templo).
2. Moradores = pessoas que moram em casas. Trabalhadores = os adultos entre elas.
   Cada adulto tem o seu trabalho (`Person.jobId`, veja Trabalho); `assignJobs` roda no
   `refreshCity` (começo e fim da semana e depois de qualquer mudança). Cada local produz × a
   sua lotação (pessoas nele / vagas, `staffOf`); local vazio produz 0. `Economy.efficiency` só
   resume as vagas ocupadas das construções que trabalham (para as Estatísticas). A previsão de
   comida usa a lotação de hoje de cada local.
3. Comida += colheita (fora do inverno, com o bônus das oficinas) + pesca + coleta (× 0,3 no
   inverno) − consumo. Cada pessoa come pela idade (veja Pessoas); **no inverno come × 1,6**
   (`winter.foodFactor`) e quem mora em **tenda come × 2** (`winter.tentFoodFactor`). Se a
   comida chega a 0 com saldo negativo: **fome**. A comida nunca fica negativa. Depois, o que
   passa do estoque (100 + celeiros) **estraga**.
4. Prata += impostos (cada casa com o fator da sua felicidade) − manutenção (sempre; o campo paga o
   ano todo). A prata **pode ficar negativa** (dívida). Esse saldo é o "+X/sem" da pílula.
   Madeira += produção dos Lenhadores, pedra += produção das Pedreiras (× a lotação de cada um). Depois os
   tocos com 104 semanas voltam a ser árvores e os Lenhadores cortam (veja Madeira e pedra).
5. Pessoas (`stepPeople`): aniversários e mortes, idosos que se mudam, noivados, casamentos e
   nascimentos; depois as caravanas (anúncio e chegada, `stepCaravans`); depois todas as famílias
   andam, e as que chegam entram na casa (o terreno vira o nível guardado, no mínimo tenda).
6. Para cada casa de nível 1 ou mais:
   - se falta uma exigência do nível atual: após 3 semanas seguidas, cai um nível (e a contagem
     de subida zera);
   - com fome: a contagem de subida **pausa** (não zera); casas acima de tenda têm 12% de chance de cair um nível (nunca vão
     embora); cada tenda tem **10%** de chance (`famineLeaveChance`) de ser **abandonada**, e
     **15% no inverno** (`winterFamineLeaveChance`): vira terreno vazio e as pessoas vão embora
     andando até a entrada;
   - se tem as exigências do próximo nível: após `upWeeks` (11 a 15) semanas seguidas, sobe de
     nível pagando o material do nível (sem material, espera no fim da contagem) e sorteia um novo
     `upWeeks`; se perde uma delas, a contagem zera.
7. Guardar a maior população (`peakPopulation`), o histórico, os marcos e verificar o objetivo
   atual.
8. **Dívida:** se a prata terminou a semana negativa, conta mais uma semana em dívida; com prata
   ≥ 0 a contagem zera. Após **24 semanas seguidas** (`debtWeeksToLose`), derrota, **menos
   enquanto uma caravana (planejada ou anunciada) chega em até 52 semanas** (`debtCaravanWeeks`,
   `caravanSpares`): aí a contagem para em 23 (o aviso de dívida fica, com "1 semana"). Uma
   caravana em que alguém fica recomeça a contagem de uma cidade em dívida (volta a 1).

## Marcos

Momentos curtos, sem pausar: brilho na construção ou casa ligada ao marco, moradores próximos se
reúnem ali por alguns segundos e um toast com 1 frase. Cada um acontece uma vez por partida e fica
na lista das Estatísticas com o ano e a semana.

| Marco | Quando |
|---|---|
| Primeiro casamento | o primeiro casal casa (entra junto numa casa) |
| Primeiro nascimento | nasce a primeira criança na cidade |
| Primeira caravana | uma caravana depois da fundadora deixa alguém na cidade |
| Uma criança da cidade virou adulta | alguém nascido na cidade faz 14 anos |
| Terceira geração | nasce uma criança com pai ou mãe nascido na cidade |
| Primeira casa de barro | a primeira casa chega ao nível 2 |
| Primeira colheita | a primeira semana em que algum campo colhe mais que 0 |
| Primeiro inverno vencido | o primeiro inverno que termina (semana 1 da primavera) sem fome e sem nenhuma casa abandonada ou caída por fome durante ele |
| Primeira casa de pedra | a primeira casa chega ao nível 3 |
| Primeiro ano sem fome | o primeiro ano inteiro (outono a verão, 52 semanas) sem nenhuma semana de fome |

## Histórico

O core guarda as últimas **52 semanas** (`historyWeeks`) de: prata, comida (com a capacidade do
estoque), moradores e alegria. As
Estatísticas mostram um gráfico simples de linha para cada uma.

Velocidades: 1x, 3x e Pausa. O jogo pausa enquanto a tela de vitória ou de derrota está aberta.

## Dívida e derrota

- Com prata negativa nada pode ser construído nem cortado ("Em dívida: não dá para construir"); demolir continua grátis.
- Ao entrar em dívida: toast "Cidade em dívida: toque na prata" e, se
  estiver em 3x, a velocidade cai para 1x. Ao sair: toast "A cidade saiu da dívida!".
- Derrota: tela "Jerusalém foi abandonada" com o tempo jogado ("N anos e N semanas") e a maior
  população alcançada, e dois botões lado a lado: "Mesmo mapa" (jogo novo na mesma semente, da
  semana 0) e "Tentar de novo" (novo mapa, nova semente). Depois da derrota a simulação para.
- **Avisos** (`alerts()` no core), no botão Avisos e na lista de problemas das Estatísticas (PC),
  nesta ordem: dívida ("Em dívida: N semanas para a cidade ser abandonada. Reduza a manutenção"; com fome ao
  mesmo tempo: "Dívida e fome: demolir serviços corta a manutenção · N semanas"); fome; "A comida
  não dura até a primavera…" (qualquer estação); "Comida estragando: construa um celeiro" (com o
  celeiro ainda bloqueado: "Estoque cheio (100): o excesso estraga. O celeiro libera no objetivo
  2"); "O inverno está chegando: todos comem mais, nas tendas mais ainda. Guarde comida" (nas últimas 3
  semanas do outono, `winterWarningWeeks`, se houver tendas); "Ano seco: campos longe do rio
  colhem 25%. Construa pescador ou coletora" (do inverno ao fim da primavera de um ano seco);
  caravana anunciada ("Caravana com N famílias em N sem: falta 1 casa vazia"); casais esperando
  casa; casal que vai embora logo; "Sem nascimentos: …" (com um casal em casa); saldo negativo ("Saldo −X/sem · maior custo: Tipo (N/sem) ·
  use Demolir em serviços que atendem poucas casas"); desemprego.

## Objetivos (em sequência)

| # | Texto | Alvo | Prêmio | Libera |
|---|---|---|---|---|
| 1 | Comida até a primavera | comida até a primavera do Ano 1 | +30 | Celeiro |
| 2 | Primeiro casamento | marco | +20 | – |
| 3 | Primeiro nascimento | marco | +40 | – |
| 4 | Passe o primeiro inverno | marco `firstSpring` | +30 | Pasto |
| 5 | **Construa um pasto** | 1 | +40 | Pedreira |
| 6 | Tenha 5 casas de barro | 5 | +35 | Praça |
| 7 | **Restaure o altar** | etapa 1 | +40 | – |
| 8 | Receba a primeira caravana | marco | +40 | Oficina |
| 9 | Construa uma oficina | 1 | +35 | Mercado |
| 10 | Chegue a 30 moradores | 30 | +40 | Lamparina |
| 11 | **Ilumine o celeiro: 3 lamparinas** | 3 | +35 | – |
| 12 | Tenha 6 casas de pedra | 6 | +50 | Parque |
| 13 | **Alicerce do Templo** | etapa 2 | +70 | Curtume |
| 14 | **Construa um curtume** | 1 | +60 | – |
| 15 | Uma criança da cidade virou adulta | marco | +70 | – |
| 16 | Chegue a 45 moradores | 45 | +70 | – |
| 17 | Tenha 4 casas grandes | 4 | +70 | – |
| 18 | **Paredes do Templo** | etapa 3 | +85 | – |
| 19 | **Tenha 2 pastos** | 2 | +85 | – |
| 20 | Chegue a 65 moradores | 65 | +85 | – |
| 21 | Chegue a 85 moradores | 85 | +100 | – |
| 22 | **Pórtico e telhado** | etapa 4 | +130 | – |
| 23 | Chegue a 120 moradores | 120 | +150 | – |
| 24 | **Consagração do Templo** | etapa 5 | vitória | – |

**Templo em ruínas** (plano "ruínas" 2026-11-07, `src/data/temple.json`, `src/core/temple.ts`): a
meta do jogo inteiro. A ruína do Templo (6 x 6) está no mapa desde a semana 0, ao norte do altar e
encostada no anel (`templeRuin()`), protegida; o altar também começa em ruínas e não cobre nada.
Cinco etapas, cada uma um objetivo (`templeStage`), refazem os dois no lugar:

| # | Etapa | Lugar | Prata | Pedra | Madeira | Construtores | Obra (sem-construtor) | Raio do altar | Oferta (gado/sem) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Altar restaurado | altar | 40 | 10 | 20 | 2 | 12 | 6 | 0,75 |
| 2 | Alicerce | ruína | 150 | 80 | 0 | 4 | 40 | 7 | 1 |
| 3 | Paredes | ruína | 200 | 120 | 40 | 5 | 60 | 8 | 1,25 |
| 4 | Pórtico e telhado | ruína | 250 | 60 | 120 | 6 | 72 | 10 | 1,5 |
| 5 | Consagração | ruína | 200 | 0 | 40 | 4 | 32 | 10 | 1,75 |

- **Ofertas** (`offer` em `simulation.ts`): toda semana, depois da produção, o altar restaurado
  queima a oferta da última etapa pronta do estoque de gado. Com gado bastando, cobre o raio dela
  (`altarRadius`, medido da borda; `s.offered`); sem, não queima nada e não cobre nada nesta semana
  (evento `offeringsMissing` uma vez por episódio, `offeringsBack` ao voltar). As casas veem a falta
  na semana seguinte (a cobertura é calculada antes das ofertas, como a do mercado).
- **O altar vale:** a Casa de pedra e a Casa grande pedem `sacred` (o raio do altar com ofertas, ou o
  do Templo consagrado). Sem altar restaurado, nenhuma casa passa do barro; sem ofertas, as casas de
  pedra caem pela regra de sempre (`weeksToDowngrade` 3): o estoque de gado é o colchão.
- **Gado** (`livestock`, um material): começa em 0, teto `livestockStorage` 50; o **Pasto** (3 x 3,
  30 prata + 10 madeira, 1 Pastor, manutenção 1) rende 0,05 por célula de **capim livre** no raio
  2 (chão `grass` sem construção, rua, árvore ou rocha), até 1,5/sem, × 0,5 no inverno; cheio, para.
  Construir em cima do capim tira a célula. Um pasto num capim médio (~1,25/sem) sustenta o altar
  restaurado (0,75/sem) fora do inverno; do Alicerce (1/sem) em diante o inverno pede o 2º, e na
  Consagração (1,75/sem) o 3º.

- Uma etapa só começa quando é o objetivo atual (`stageIsGoal`), no balão do altar (etapa 1) ou do
  Templo (2–5): paga na hora a prata e os materiais (`startStage`; recusa sem eles, em dívida ou
  fora da rua).
- Em obra, o lugar tem as vagas de **Construtores** da etapa (`Building.builders`; no painel
  Profissões: `altar`, `temple`). Começar a etapa põe a meta deles em número (todas as vagas), e as
  profissões com meta em número enchem antes das automáticas: os adultos livres, e quem o − solta em
  outra profissão, vão para a obra. Ao terminar, a meta sai. Fora da obra, 0 vagas.
- Toda semana a obra soma 1 por construtor trabalhando (`advanceTemple`), o ano inteiro; sem
  construtor ela para sem perder nada. No `work` a etapa termina: as vagas fecham, evento `stageDone`
  e o objetivo se cumpre com o prêmio.
- O Templo só cobre (raio 12, Alegria +10) depois da Consagração (`templeDone`); as etapas não mudam
  outra regra. A vitória é a Consagração terminada.
- **Balão do altar:** em ruínas, "Altar em ruínas: restaure para as casas de pedra"; restaurado,
  "Ofertas: 0,75 gado/sem · cobre N casas" e o alcance; sem gado, em vermelho "✗ Sem ofertas: não
  cobre as casas". O Templo, até o Alicerce ficar pronto, se chama **"Ruínas do Templo"** no balão (só
  as etapas, sem a frase do que faz). A casa que não sobe por causa do altar diz o motivo: "Altar em
  ruínas", "altar sem ofertas" ou "longe do altar". Toasts: "Falta gado para o altar: construa um
  pasto" (e "Sem ofertas" subindo do altar) e "As ofertas voltaram". A coluna não tem mais o
  Templo (ele está no mapa desde o começo) e ganha o Pasto, depois da Coletora.
- **Balão do altar e do Templo** (`stageCard` em `src/game/model/card.ts`): as etapas já prontas ali
  ("✓ Altar restaurado: etapa pronta") e a próxima, "Etapa 2 de 5: Alicerce". Enquanto ela é o objetivo:
  antes de começar, o custo ("150 prata · 80 pedra", o que falta em vermelho com "(tem N)"), "4
  construtores · ~10 sem de obra" e o botão dourado **"Começar: Alicerce"** (`session.startStage()`;
  cinza com o que falta, "Falta pedra: 80 (tem 30)", e o toque diz o motivo); em obra,
  "Construtores: 2 de 4" (vermelho com 0, laranja abaixo), a **barra "18/40"** e "Pronto em ~6 sem"
  (ou "Obra parada: ninguém trabalha nela"). Ao lado, o botão **Profissões** (abre o painel). Fora do
  objetivo, "Antes: objetivo 9, Chegue a 30 moradores".
- **Objetivos:** as cinco etapas em dourado com o ícone de obra (muro de pedras e colher de pedreiro) e
  "etapa 2/5".
- Lista de objetivos, embaixo (`stageStatus`): "Alicerce: junte 50 pedra, 30 prata"; "Alicerce: toque
  no Templo para começar"; "Alicerce 18/40 · ~6 sem" (ou "· sem construtores"). A pílula do objetivo
  mostra só o objetivo: a linha "O que fazer agora" diz onde está a etapa (não se repete).

Ordem do Pacote B1 (sobreviver primeiro): comida, casamento e o primeiro inverno vêm antes de
qualquer serviço; o marco `firstSpring` ("Primeiro inverno passado") chega no começo da primeira
primavera com moradores, mesmo com perdas (o marco `firstWinter`, sem perdas, continua à parte). O
mercado só abre depois da oficina, quando há o que trocar. O objetivo dos 125 moradores saiu.

Calibração do Povo com o Pacote 3 (`docs/revisoes/2026-11-05/sim-tester-p3.md`): com estes números
o Comum cumpre os objetivos 5 a 17 nas semanas ~76, 96, 122, 194, 211, 221, 275, 325, 380, 423, 511,
578 e 617 (mediana de 100 partidas), um a cada ~1 a 5 min; vence em ~33 min. (Números de antes da
ordem do Pacote B1; o sim-tester mede de novo.)

Tipos de objetivo no core: `milestone` (cumpre quando o marco foi alcançado, mesmo antes de o
objetivo chegar), `foodUntilSpring`, `houses`, `residents`, `build` e `templeStage` (a etapa
`stage` do Templo terminada).

- **Objetivo 1** (`foodUntilSpring`): progresso = semanas que a comida dura (pela previsão), até as
  semanas que faltam para a primavera do Ano 1; a pílula mostra a unidade ("12/26 sem"); na
  primavera, sem semanas a contar, a pílula não mostra número. Cumpre quando a previsão chega lá.
  Na primavera, cumpre se a cidade não está com fome; com fome, espera a comida voltar. O alvo
  nunca é 0. Uma cidade sem moradores tem progresso 0, mesmo com uma família a caminho.
- **`fromYear`** (opcional, nenhum objetivo usa agora): o objetivo só se cumpre a partir desse ano
  (`goalOpen`). Um objetivo por semana (`checkGoal`).
- Objetivos de casas e de construir contam só construções **conectadas** à rede.
- Vitória: tela com o tempo ("N anos e N semanas") e os moradores, e botão "Continuar construindo".

Ao liberar a Oficina aparece também o aviso "Oficina liberada: 3 vagas e +10% de comida dos campos,
até +30%" (números lidos de `buildings.json`); ao liberar o Parque, "Parque liberado: casas de
pedra perto dele viram casas grandes".
O balão da Oficina escolhida diz o total: "+10% de comida dos campos (total 20%, teto 30%)" ("no
teto" quando chega lá) ou, com o teto já alcançado, "Campos já no teto (+30%): esta oficina só dá
vagas".

**Aviso de desemprego** (Pacote B2): pessoas sem trabalho = adultos que moram na cidade sem
`jobId` (`unemployed`; os lavradores no inverno têm trabalho). A Alegria usa a mesma conta
(`idleShare`). Com **3 ou mais** (`unemploymentAlert` em `rules.json`), desde o começo (sem a trava
da Oficina): "N pessoas sem trabalho: faltam vagas. Construa um campo, lenhador ou oficina" (com
as oficinas no bônus inteiro: "um lenhador ou uma pedreira"). Logo depois, `noCrew`: o primeiro
local ligado que trabalha esta semana e produz algo (comida, madeira, pedra, o bônus da oficina ou
a cobertura do mercado; não o celeiro nem o templo) sem ninguém: "Lenhador sem trabalhadores:
toque numa pessoa e mude a profissão".

## Aparência e moradores

Só aparência: nenhuma regra de economia depende disso. O desenho é o do 3D (`src/render3d`, veja o
README de lá); o último desenho 2D está na tag `ultimo-2d`.

- **Variantes (core):** casas têm 6 variantes por nível e 2 de terreno vazio; campos têm 4
  plantações (trigo, cevada, lentilha, linho); oficinas têm 6 ofícios (Olaria, Ferraria,
  Carpintaria, Tecelagem, Tinturaria, Curtume, em `buildings.json`). A variante e o espelhamento
  são sorteados no core (`rollLook`, com o rng do jogo) ao construir e, nas casas, a cada mudança de
  nível. Construções vizinhas (lado com lado) do mesmo tipo e nível não repetem a variante quando
  há alternativa. O ofício da oficina fica guardado na variante.
- **Casas no 3D** (plano beleza C3): um modelo por nível (pacote Meshy, `house-1..4`), virado para a
  rua, com um tom um pouco diferente por casa. O espelhamento do core desenha a casa inteira
  espelhada (modelo, kit, quintal, porta, janelas e fogueira; protótipo espelhado `house-N-m`). A
  variante soma um **kit por código** (`src/render3d/kits.ts`), 6 por nível, todos diferentes:
  - tenda: faixas tecidas na parede, tripé com panela na fogueira, toldo na frente, cabras na
    manjedoura, tenda anexa, esteira com figos (com faixas do outro lado);
  - casa de barro: escada até o telhado, forno tabun, quarto no telhado, toldo listrado, tapete no
    parapeito, figos secando;
  - casa de pedra: parreira com uvas na parede, toldo sobre o pátio do telhado, portão em arco,
    andar de cima;
  - casa grande: figueira no quintal, toldo largo com tear, cisterna, quarto no telhado, tapete,
    manjedoura.
  E o quintal da casa com gente (`yardOf` em `plan.ts`): nada, três jarros com um vaso de planta, ou
  um varal com panos vermelho, claro e azul (variante % 3), na frente à direita (à esquerda quando
  espelhada); o kit deixa esse canto livre. Casa vazia que guardou o nível: o desenho desse nível
  desbotado, sem luz nem fumaça, com o portão trancado na porta, sem quintal e só com as peças
  construídas do kit (a vida do dia a dia, como panela, figos, toldo, tapete e cabras, some).
- **Campos** pela plantação (cor do grão) e pela estação (arado, broto, verde, dourado, palha).
- **Oficina pelos 6 ofícios:** o modelo (pacote Meshy) já é uma olaria, com forno e potes. Os outros
  ofícios põem o seu canto no pátio da frente (`craft-1..5`, por código): a ferraria tem forja de
  pedra com brasas e bigorna; a carpintaria, pilha de tábuas, toras e cavalete; a tecelagem, tear
  com pano listrado e novelos; a tinturaria, três tinas (azul, vermelho, amarelo) e panos secando
  num varal; o curtume, couros esticados em molduras e a tina de cal.
- **Celeiro, Mercado e Oficina por nível:** o modelo do nível 1 e, nos níveis 2 e 3, acréscimos por
  código por cima, mais altos e de pedra mais clara. Celeiro: andar de calcário no armazém, portal
  e, no 3, toldo no terraço. Mercado: toldo azul e, no 3, colunata de pedra. Oficina: quarto de
  pedra no telhado, prateleira de jarros e, no 3, chaminé alta.
- **Celeiro enchendo:** o pátio de cada celeiro ligado mostra o estoque da cidade pela fração
  `comida / capacidade` (`stockLevel`, limites em `visual.json` > `moments.granaryStock`: 8%, 45%, 80%).
  Abaixo de 8% o pátio fica vazio; depois aparecem dois sacos; depois uma fileira de sacos com três
  jarros; e cheio, sacos em duas camadas, um monte de grão e mais jarros.
- **Moradores andando** (`walkers.json`, destinos do core): aguadeira → praça e mercado, agricultor
  → campo, cesteira → mercado, carregador campo → mercado, artesão → oficina, idoso → altar, criança
  → qualquer lugar, homem → ruas principais, pastor → borda da cidade, sacerdote → altar ou templo,
  lenhador → casa e mercado, canteiro → casa e templo. Um tipo só aparece quando a construção dele
  existe e está ligada. No 3D a roupa vem da idade e do sexo (`crowd.ts`): homens de túnica e
  turbante, mulheres de vestido e manto, crianças menores, idosos de roupa clara, curvados e
  lentos, e o sacerdote de branco com pano azul na cabeça. **Cada um leva o que é dele**
  (`loadOf` em `crowd.ts`): a aguadeira um jarro na cabeça, a cesteira um cesto com frutas, o
  agricultor a foice, o carregador um saco nas costas, o lenhador uma tora no ombro, o canteiro
  empurra um carrinho de duas rodas com um bloco de calcário, o idoso, o pastor e o sacerdote um
  cajado. O artesão leva o produto de uma oficina da cidade: pote (olaria), martelo (ferraria),
  tábua (carpintaria), rolo de pano (tecelagem), panos tingidos na cabeça (tinturaria) ou couro
  nas costas (curtume). O homem do jumento puxa um jumento com cestos e o pastor anda com uma
  ovelha, os dois ao lado dele (`companionOf`). Criança não leva nada.
- **Um dia na cidade** (só desenho, `src/render3d/time/routine.ts`, números em `look3d.json`
  `routine`): a hora do dia muda a vida da rua, além da noite e da chuva. De manhã e no fim da
  tarde as ruas enchem (ida ao trabalho e volta para casa), no meio da manhã acalmam (65%) e ao
  meio-dia voltam a encher com quem vai ao mercado; os compradores do mercado lotam ao meio-dia
  e são poucos (25%) cedo e no fim do dia; as crianças brincam de dia e entram antes de escurecer;
  os vizinhos conversam mais na porta no fim da tarde; quem trabalha no campo começa pouco depois
  do nascer do sol e para perto do pôr do sol. O core não sabe a hora.
- **Gente indo para casa** (`families`): a família anda em grupo, os adultos na frente, as crianças
  no meio e os idosos atrás. Uma família de caravana (alguém ainda sem casa) traz um jumento com
  duas cargas.
- **Gente da comida** (só desenho, `src/render3d/haul.ts` e `life.ts`): na colheita, de cada campo
  que colhe (até 8) sai um carregador com saco nas costas pelas ruas até o celeiro ligado mais perto
  (ao altar quando não há celeiro) e volta de mãos vazias; o ano todo, o pescador sai da cabana com
  o cesto até a margem do rio mais perto e fica ali alguns segundos, e a coletora, com um cesto na
  cabeça, vai até a árvore mais perto no raio. Pescador e coletora sem rio ou árvore no raio não
  saem.

Ferramentas bloqueadas aparecem com cadeado.

## Interface

Há uma interface só, a **Nova** (Versão D). A Clássica saiu em 2026-11-03 (com a opção
"Interface" das Configurações, a chave `jerusalem.ui`, que passa a ser ignorada, e os cenários
visuais dela).

**Palavras na tela:** o passo do jogo é a **semana** ("por semana", "/sem"); a meta se chama
**Objetivo**; a felicidade, **Alegria**; a ferramenta Ver, **Mover**; Limpar, **Demolir**. No
código continuam `goal` e `happiness`; o passo passou a ser `week`.

### Interface Nova

> Escrita para a interface Nova do 2D; a interface HTML do 3D segue os mesmos textos, regras e
> tamanhos (veja "Jogo em 3D" abaixo). Detalhes de posição em px do 2D são históricos.

- **Abertura:** ao começar, um toast maior (ou balão central que some sozinho em 5 s) com a frase
  da caravana: "A caravana chegou com N famílias, comida para N semanas e 40 de madeira" (a madeira
  lida de `startMaterials`).

Mockups do usuário de 2026-11-03 (celular 844 x 390 e PC 1366 x 768). Arte desenhada em código.

- **Estilo:** painéis marrom escuro `#24190E` a 75%, borda clara a 20%, cantos arredondados; botões
  pergaminho `#F4E8CC` com borda marrom; destaque dourado `#E2A93B`; texto `#FFF4DC` (tudo em
  `palette.ts`). **Tudo que se toca é redondo**; o que só informa tem cantos arredondados.
  Tamanhos em px reais de tela (o layout converte pela escala do jogo): celular números 15, textos
  13; PC números 17, textos 13–15; **nada abaixo de 12 px**; **toque mínimo 44 px**.
- **Topo esquerdo:**
  - círculo **Nível** (= objetivos cumpridos + 1; só mostrador, não libera nada) com anel dourado
    do progresso do objetivo atual; 56 px no celular, 72 no PC;
  - pílulas **Prata** e **Comida** com a variação por semana (verde positiva, vermelha negativa) e
    **Moradores**; no PC com rótulo, mais **Alegria** (com a barra cheia é a última a sair; fica em Estatísticas). A Comida
    mostra também "até a primavera" quando a previsão chega à próxima primavera, ou "acaba no <estação>"
    (a estação em que a comida acaba, pela previsão) em vermelho; no celular só aparece quando não
    chega: "⚠ N sem" (semanas até acabar) em vermelho, e o resto fica nas Estatísticas. Na fome,
    **"FOME"** em vermelho no lugar disso; a pílula ganha um aro vermelho e só o texto pisca, devagar
    (1,6 s), enquanto a fome durar (sem piscar com `prefers-reduced-motion`: o aro e o vermelho ficam). Com o estoque a 75% do limite ou mais, o número
    vira "38/50" (laranja enquanto estraga), e **"cheio"** em laranja só nas semanas em que
    a comida está estragando. Cores de alerta: prata laranja com saldo negativo e
    vermelha piscando em dívida (do mesmo jeito: aro vermelho, só o texto pisca). Tocar numa pílula (ou na estação) abre as
    Estatísticas; nada se constrói sob a barra do topo;
  - pílula **Materiais** entre Comida e Moradores (P3): no celular uma pílula só com o ícone da tora
    e o número da madeira e, depois de liberar a Pedreira, o ícone da pedra e o número (sem
    "+N/sem"); no PC uma pílula por material, "Madeira 20 +1,5/sem" (a Pedra só depois de liberar a
    Pedreira). O número fica **vermelho com "⚠"** enquanto alguma casa espera aquele material. A
    pedra entra com um brilho dourado (3 piscadas) ao ser liberada. Tocar abre as Estatísticas (Moradores abre Profissões).
    Se a fileira não couber à esquerda da estação, as pílulas encurtam por etapas (`fitPills` em
    `src/game/model/topbar.ts`, que mede a largura sem desenhar; `src/ui/topbar.ts` mede o espaço): primeiro somem os rótulos dos materiais, depois todos os rótulos, depois o "+N/sem"
    dos materiais, depois o "/sem" da prata e da comida, e por fim a previsão da comida vira a curta
    do celular (some "até a colheita"; vermelho "⚠ N sem"). Assim prata de 4 dígitos com madeira e
    pedra de 3 cabem em 1280 e 1366 sem encostar na velocidade. Prata, Comida, Materiais e Moradores
    nunca somem;
  - pílula do objetivo: "Objetivo" + texto + "3/5"; no PC "Objetivo 3 de 17", texto, barra e "3/5".
    Tocar abre a lista de Objetivos.
- **Topo direito:** pílula "Outono · Ano 1 · Semana 5 · inverno em 9 sem" (semana 1–13; ícone da
  estação; num ano seco anunciado, o ícone da seca no lugar e "· Seca" em laranja). A contagem é
  a próxima virada dos campos (`nextFieldTurn`): fora do inverno, "inverno em N sem" (laranja nas
  últimas 3 semanas); no inverno, "primavera em N sem". No celular a pílula troca a semana
  pela contagem e sem o nome da estação, que o ícone já mostra: "Ano 1 · inverno em 9 sem"; velocidade (celular: um botão dourado que alterna 1x → 3x → pausa; PC: pausa, 1x e
  3x, o ativo dourado); engrenagem das Configurações.
- **Lateral esquerda** (botões redondos):
  - **Objetivos** (bandeira): lista dos 18 objetivos, cumpridos, atual (com progresso) e próximos,
    com prêmio e o que libera (no celular, prêmio e liberação só no objetivo atual), em duas colunas
    quando não cabem em uma;
  - **Avisos** (triângulo): selo vermelho com a contagem da lista do core (`alerts()`); tocar abre a
    lista com o texto de cada aviso, um embaixo do outro numa coluna só (lista longa rola). Quando entra um aviso novo o botão pulsa e aparece um toast com
    o texto (uma vez por episódio). **Não há faixa de aviso sobre o mapa;**
  - **Estatísticas** (gráfico): prata (impostos, manutenção por tipo, saldo),
    comida (colheita, pesca, coleta, consumo, saldo, estoque/capacidade, previsão), trabalho
    (trabalhadores, vagas do ano, sem trabalho, vagas livres), casas por nível, alegria (felizes, contentes,
    tristes e motivos), **materiais** (madeira e pedra: estoque e "+N/sem", em vermelho com
    "Casas esperando madeira/pedra ⚠ N" quando há casa esperando, e o número de tocos), **gráficos das últimas 52 semanas** (veja Histórico), a lista de
    **problemas** (a mesma dos Avisos; só no PC, no celular ela fica no botão Avisos) e a lista de **marcos** com ano e semana.
- **Jogo em 3D** (`src/app/play3d.ts` e `src/render3d/scene3d.ts`, Three.js, com a interface em HTML em `src/ui`): o
  jogo é 3D (a `Session` de `src/game` desenhada com Three.js). O 2D em Phaser foi removido em
  2026-11-05 (último código na tag `ultimo-2d`). Sem WebGL 2 a página mostra só um aviso curto:
  "Este navegador não consegue desenhar o jogo em 3D…".
  - **O jogo continua correndo** no 3D: semanas, velocidade (botão dourado no alto à direita,
    Espaço no PC) e o dia (240 s a 1x, parado na pausa).
  - Mostra todas as construções (casas por nível; casa vazia que guardou o nível com o desenho
    desse nível, mais escura e sem luz nem fumaça; celeiro, mercado e oficina mais altos e com
    acabamento de pedra nos níveis 2 e 3), ruas, árvores, tocos (com muda quando volta a crescer),
    moradores e famílias andando; estação e clima do mesmo relógio da semente do mapa. A cidade é
    redesenhada quando muda (no máximo a cada 0,25 s durante um arrasto de rua).
  - Interface HTML (Fase 1): barra do topo (nível com anel do objetivo, pílulas de prata, comida,
    madeira/pedra, moradores e alegria, objetivo, estação, velocidade), dois botões de girar à
    esquerda, Mover/Rua/Demolir embaixo à esquerda, a coluna com as 12 construções à direita (preço
    ou "objetivo N"), toasts embaixo entre as ferramentas e a coluna, a frase do tutorial com "Pular tutorial" e a seta, o
    balão da construção tocada (nome, ligada à rua, nível, Melhorar e Demolir), a pílula sobre a
    prévia ("Atende N casas", "falta ligar à rua") e as telas de vitória e derrota. O balão fica ao
    lado da construção, mas sempre na área livre do mapa (nunca sobre a barra, a coluna ou as
    ferramentas; construção fora da tela: na borda dessa área); maior que ela, rola por dentro.
  - Interface bonita (plano beleza C5, 2026-11-06): cada construção da coluna tem a sua
    **miniatura 3D** num disco (o próprio modelo do mapa, desenhado uma vez ao abrir e de novo
    quando chega o pacote Meshy, num dia claro de verão: `render3d/thumbs.ts`). No PC, disco com
    nome, preço e tecla; no celular, só os discos (40 px, 44 px de toque; cabem 7). Bloqueada:
    miniatura cinza, borda tracejada e selo de cadeado. Liberada por um objetivo e ainda nenhuma
    construída: **ponto dourado "novo"** (`fresh` em `game/model/build.ts`). Os balões (da
    construção tocada e da construção escolhida) têm **seta** para a construção ou o botão
    (`arrowOf`; sem seta quando o balão cobre o ponto). A ação principal do balão mostra a
    miniatura (ou o ícone da rua) e Demolir o martelo. Ícones das pílulas e dos balões de problema
    **pintados com contorno de tinta** (estrada partida, trabalhador e peixe riscados, praça com
    banco e toldo, mercado listrado, duas árvores); pergaminho com grão leve de papel e filete
    dourado por dentro dos painéis escuros.
  - Interface HTML (Fase 2), com os mesmos textos e regras da Nova (`game/model/{card,panels,person}.ts`):
    o balão da casa tocada traz os moradores (botões com figura, nome, idade e trabalho; duas
    colunas no celular, uma no PC), filhos, nível, ✓/✗ das necessidades, "Melhorar"/"Onde pôr…",
    Demolir com "Certeza?" e ✕; no celular, a parte do nível vai numa segunda coluna e os botões
    ficam sob os moradores. Tocar num morador abre a **ficha** (parentes que abrem a ficha deles,
    "Voltar"; a casa leva a câmera até ela). O **anel do nível e a pílula do objetivo** abrem
    Objetivos; na lateral, sob os botões de girar, ficam **Avisos** (selo e pulso a cada
    aviso novo, que também vira toast), **Estatísticas** (Agora, Povo e Histórico; uma família do
    Povo leva até a casa dela) e **Profissões** (no celular, depois de Demolir; ver Trabalho). Os painéis e a ficha terminam acima das ferramentas. Escolher uma
    construção na coluna mostra o balão dela ao lado do botão (custo, manutenção, efeito, "Saldo
    depois", "Comida depois"); no celular ele some enquanto a pílula da prévia aparece, para o lugar
    ficar à vista. Os toasts terminam à esquerda desse balão. Painéis têm ✕. Sobre as construções com problema, um balão com o ícone da
    necessidade (sem rua, sem trabalhadores, sem fonte, praça, mercado, parque, triste; cadeado
    quando ainda bloqueada), em tamanho cheio de perto e menores de longe (até 60%), escondido quando
    passa sob as barras, os botões ou a coluna; na fome, o mapa
    fica avermelhado. Esc fecha na ordem: engrenagem, ficha ou painel, balão. Quando o balão não cabe
    de nenhum lado (a casa com moradores no celular), a câmera desliza uma vez para tirar a
    construção de baixo dele. No tutorial, a câmera leva o lugar de cada passo ao meio do mapa livre
    (acima do balão do tutorial; no toque, com espaço para o dedo abaixo dele) e só desliza depois que
    o dedo solta; a coluna rola até o botão que a seta aponta. A pílula sobre a prévia diz o que a construção dá ali:
    "Rende N…", "Corta 1 árvore a cada N sem", "Divide o bosque…", "Comida depois", "Sem rua ao
    lado: não rende nada" (vermelho), "Congelado no inverno…"; com Demolir, "Cortar árvore · 5 prata"
    ou, num celeiro cheio (ou na rua dele), "Perde N de comida" em vermelho.
  - **Templo por código** (plano beleza C8, 2026-11-07): a construção mais bonita da cidade, sem
    frontão grego nem ameias: plataforma em dois degraus com escadaria, pátio lajeado com muro baixo e
    portaria de duas torres, santuário alto de calcário claro ao fundo (pórtico mais alto que o salão,
    câmaras laterais, janelas estreitas no alto, telhados planos com cornija dourada fina, portas de
    ouro), as duas colunas de bronze soltas diante do pórtico, o mar de bronze e o altar de pedras com
    rampa no pátio.
  - **Oficinas por ofício e obra** (plano beleza C8, 2026-11-07): cada ofício se lê de longe por uma
    forma grande na sua cor, sobre o alpendre e no telhado: ferraria com toldo de fuligem e chaminé de
    forja acesa na boca; carpintaria com pilhas de tábuas amarelas no telhado e toras encostadas;
    tecelagem com toldo listrado azul e um tear no telhado; tinturaria com varais de panos vermelhos,
    azuis e ocres; curtume com toldo marrom e couros esticados em armações. A olaria fica como o
    modelo. O mercado de nível 2 e 3 ganha montes de romãs, laranjas e grãos nas bancas. O terreno
    vazio mostra a obra: estacas nos cantos com a linha do pedreiro, um trenó de madeira para as
    pedras e um maço. A pedreira ligada levanta poeira de pedra no pátio, de dia, sem chuva e com o
    estoque de pedra abaixo do limite (cheio, ela para e a poeira também).
  - **Acabamento de maquete** (plano beleza C8, 2026-11-07): um passe final barato sobre o 3D
    (`render3d/finish.ts`): o alto e o pé da tela ficam levemente desfocados (tilt-shift, a cidade
    parece maquete sobre a mesa; nítido numa faixa no meio), cor um pouco mais quente e com um toque de
    contraste. Sombra de contato: o chão escurece de leve ao pé das construções em pé (não campos,
    praças, parques nem terrenos vazios), mais no tempo nublado, na chuva e à noite (o sol fraco não
    segura mais os prédios no chão). Números em `look3d.json > finish`. O desfoque e a gradação
    desligam na qualidade mínima; a sombra de contato não custa nada (vem no shader do chão).
  - **Acabamento da interface HTML** (pacote beleza, 2026-11-06): uma vinheta suave escurece as bordas
    da tela (camada CSS sobre o mapa e sob a interface, sem passe na GPU); os botões de pergaminho e o
    dourado têm sombra deslocada (2 px) e afundam 2 px ao toque; o escolhido (ferramenta, construção,
    botão lateral, aba) tem aro dourado de 3 px com halo dourado claro; a construção bloqueada fica
    cinza, sem sombra e com **borda tracejada**. No PC cada construção liberada mostra "tecla N" numa
    pequena tecla ao lado do nome (o preço fica sozinho na linha de baixo); Demolir tem o martelo. A
    coluna de construção tem a altura dos botões (rola quando não cabem). Na barra do topo do PC as
    pílulas ficam numa linha só (encurtam por etapas; o objetivo vai para a linha de baixo).
  - **Engrenagem** (alto à direita): "Dia e noite: ligado/desligado" (desligado = sempre meio-dia;
    fica salvo), "Música: ligado/desligado" e "Volume − 50% +" (passos de 10%; salvos). Esc fecha.
  - **Música** (`src/game/music/score.ts` e `mix.ts`, puros; `src/app/music.ts`, Web Audio): fundo
    calmo gerado no navegador, original por construção. **Uma música por estação** (pedido do usuário
    em 2026-11-07), sempre em **piano sobre sintetizadores suaves** (sem flauta nem harpa). Desde
    2026-11-08 **alegres e calmas** (o usuário achou a versão anterior de dar sono): 100–112 bpm,
    progressões maiores claras, tambor leve de dia em todas as estações e eco curto. Primavera em Ré
    maior, 108 bpm, tema saltitante (pontuado) que sobe, acordes quebrados subindo e um arpejo de
    sintetizador (a cidade acordando); verão em Sol maior, 112 bpm, tema sincopado e agudo, acordes
    em contratempo, arpejo cheio, tambor de mão e chocalho (dias longos e quentes); outono em Fá
    maior, 104 bpm, dança de aldeia (baixo e acorde alternados, "pum-pá"), tema brincalhão em
    colcheias e arpejo leve (a festa da colheita); inverno em Dó maior, 100 bpm, caixinha de música
    (notas agudas de sino sobre uma figura de colcheias), chocalho suave, sem arpejo, final plagal
    IV–I (a casa quente junto do fogo). Peças de 16 compassos (AABA): a primeira frase é sempre o tema da estação, nota por nota;
    a semente varia a segunda frase, a ponte e os enfeites. Melodia na pentatônica (notas do acorde
    nos tempos fortes), final no I, baixo (fundamental, quinta e nota de passagem na primavera e no
    verão), fundo de acordes, no máximo 10 vozes, 4–8 s de silêncio entre as peças. A
    estação é lida a cada peça; à noite a mesma música mais baixa (−25%), 4 batidas mais lenta, mais
    esparsa e sem tambor; na chuva um pouco mais baixa. Ligada por padrão a 50% (curva volume²);
    começa no primeiro toque, clique ou tecla (regra dos navegadores), toca no título e com o jogo
    pausado; aba escondida: some em 0,3 s e o áudio é suspenso, volta em 4 s. Tecla **M** liga e
    desliga no PC. A chave de silêncio do iPhone cala a música.
  - **Tela inicial em HTML**: nome, como jogar, controles, "Começar" (Enter no
    PC) e, depois do tutorial visto, "Rever o tutorial"; "Instalar app" quando dá. Abre na hora
    sobre um fundo quente; o Three.js baixa e **a cidade da partida abre atrás dela**: o fundo
    clareia em 1,2 s para uma vinheta, a câmera gira devagar (uma volta em ~3 min), as pessoas e a
    água se mexem, mas as semanas, a interface e as teclas do jogo esperam. "Começar" volta a câmera
    à vista de abertura e o jogo começa. O nome usa uma serifa de pedra (`TITLE_FONT`, fontes do
    sistema, funciona sem rede). O jogo abre com os modelos feitos em código e troca pelos modelos do
    pacote (Meshy) quando eles chegam.
  - **Vida e efeitos no 3D**: a gente da comida (carregadores com saco do campo ao
    celeiro ou ao altar na época de colheita, pescador com o cesto na margem do rio, coletora com o
    cesto na cabeça sob a árvore mais perto; param na pausa) e o andaime de madeira com poeira em
    toda construção nova por 1,5 s (menos campos) e na casa que sobe de nível por 0,6 s.
  - **Bateria:** com o jogo pausado e nada se mexendo, o 3D desenha 10 quadros por segundo; qualquer
    toque, tecla ou acontecimento volta ao ritmo normal. Se o celular perde o contexto gráfico (ao
    voltar de outro app), a cidade é redesenhada quando ele volta.
  - No chão: a prévia da ferramenta (o modelo translúcido em branco, amarelo "falta
    ligar à rua" ou vermelho, a área do serviço e as casas que ele atenderia, o que já está coberto),
    a rua marcada do tutorial, as áreas do Templo, os lugares de "Onde construir" e, com Demolir, a
    construção sob o cursor em vermelho.
  - Controles (`src/game/gestures.ts`): arrastar com Mover move; só a Rua
    constrói arrastando; as outras construções e Demolir agem uma vez, ao soltar (no toque, as
    construções miram 90 px acima do dedo; Demolir age sob o dedo); pinça ou roda dá zoom em volta do dedo/cursor (a roda pelo quanto rolou: ~14% por dente,
    e o touchpad fica suave); dois dedos girando giram só depois de ~12° de torção (uma pinça de zoom
    não entorta o mapa); botão direito ou do meio arrasta o mapa no PC; WASD/setas movem; Q/E e os
    botões giram até a próxima das 4 vistas padrão (desfazem um giro livre); **P** abre e fecha
    Profissões. **Contemplar** (D3, 2026-11-08): o botão de olho na lateral ou a tecla **C** escondem
    toda a interface e as marcas no chão, a câmera desce para perto dos telhados (`contemplatePitch`)
    e gira devagar (uma volta em ~5 min, para enquanto o dedo arrasta); o jogo segue correndo. Um olho
    discreto no canto, Esc ou C voltam. Vitória e derrota aparecem mesmo assim. Tocar no mapa com um
    painel ou a ficha aberta só fecha o que está aberto. A
    inclinação acompanha o zoom (mais deitada de perto, mais de cima de longe).
  - Começa centrada no altar, na vista padrão.
  - O Three.js vem num pedaço separado (import dinâmico) que baixa enquanto a tela inicial está
    aberta; o jogo abre com os modelos em código e troca pelos do Meshy quando chegam.
  - Qualidade automática: abaixo de 30 qps por duas janelas de 2,5 s, a resolução, as sombras e as
    partículas descem um nível.
  - Offline: o service worker guarda o jogo e os modelos no primeiro uso; depois de abrir uma vez
    com internet, ele abre sem internet.
- **Inferior esquerdo** (botões redondos com nome embaixo; no PC com a tecla, ex. "Mover · 1"):
  - **Mover** (mão): arrastar move o mapa; tocar numa construção abre o balão dela;
  - **Rua**: arrastar constrói, como hoje;
  - **Demolir** (martelo): a construção sob o cursor/dedo fica avermelhada; ao demolir, poeira e
    pedrinhas; sobre árvore, "Cortar árvore · 5 prata". Regras de Limpar sem mudança.
- **Coluna direita de construções**: são 12 (Casa, Praça, Parque, Campo, Pescador, Coletora,
  Celeiro, Lenhador, Pedreira, Mercado, Oficina, Templo; `COLUMN_ORDER` em `tools.ts`), mais que `toolColumnMax` (8), então a coluna mostra as **4
  categorias** e tocar numa abre a faixa dela (veja Categorias). Botão redondo com a miniatura da arte do jogo; celular 46 px só o desenho; PC 86 px com
  desenho, nome e "preço · tecla N". Escolhida: borda dourada com brilho. Sem prata **ou sem o
  material** que ela custa: acinzentada e preço em vermelho. Bloqueada: cinza, borda tracejada e cadeado (PC: "objetivo N"); tocar mostra
  "Libera no objetivo N". Ao liberar ganha um ponto dourado de "novo" no canto de cima (fora do desenho) até ser tocada (não é salvo). Tocar de novo
  no Mercado gira a prévia. **Não há botão "Construir":** escolher a construção já é a ferramenta.
- **Balão da construção escolhida:** escuro, à esquerda da coluna, com seta para o botão: nome,
  o custo "25 prata · 10 madeira" (cada parte que falta em vermelho com o que a cidade tem:
  "10 madeira (tem 4)"), a manutenção por semana numa linha própria e uma frase do efeito; no PC também vagas, alcance e "Saldo
  depois: +N/sem" (saldo da semana com a manutenção e a nova construção; `balanceAfter` dá as vagas
  do local novo aos adultos livres, e sem ninguém livre conta a manutenção pela metade). Desde o Pacote B2 um
  local novo só recebe quem está sem trabalho (`foodAfter` põe nele os adultos livres; ninguém é
  tirado de outro local), então "Comida depois: ±X/sem" só muda pelo que ele mesmo faz.
  Celeiro, mercado e oficina dizem até onde melhoram: "Guarda 300 · melhora até 1000",
  "Alcance 5 · melhora até 7", "+10% nos campos · melhora até +30%".
  Fecha ao trocar de ferramenta ou ao tocar no mapa para construir.
- **Balão da construção tocada** (com Mover), ao lado dela com seta, seguindo a câmera; some ao
  tocar fora:
  - casas: cabeça **"Casa de barro · 3/4 pessoas"** e os **moradores**, um por linha de 44 px
    (figura de criança, adulto ou idoso — a forma diz homem ou mulher —, "Natã, 22" e embaixo a
    profissão em 12 px: o trabalho do adulto por `jobsOf` ("Lavrador · descansa no inverno" no
    inverno), "Sem trabalho" em laranja (a ficha diz "Sem trabalho: todas as vagas estão cheias"
    quando não há vaga livre), "criança", "Descansa (idoso/idosa)", "A caminho"); **celular: duas colunas**, **PC: uma**. Tocar num morador abre a
    **ficha da pessoa**. Linha dos filhos (`houseBirths`, só com um casal que pode ter filhos):
    "✓ Pode ter filhos" ou "✗ Sem filhos: fome / casa cheia / a comida não dura até a primavera /
    o estoque é pequeno. Construa um celeiro". Depois o nível: "nível atual → próximo" (celular:
    "Próximo nível: Casa de pedra"), imposto (só PC), alegria com os motivos, uma linha com o que
    já tem ("✓ Rua") e outra com o que falta ("✗ Praça, Mercado"; um serviço bloqueado diz "(libera
    no objetivo 4)"), "Casa de pedra em N sem" e os ganhos ao evoluir (`upgradeGain`; PC num quadro
    "Ao evoluir", celular numa linha); se a evolução pede material, "Ao evoluir: pede 15 de pedra"
    (e 5 de madeira) logo abaixo. **Casa pronta esperando material** (`houseInfo().waiting`): no
    lugar das exigências (todas cumpridas) e da contagem, a linha vermelha "Pronta para virar Casa
    de pedra: falta 7 de pedra" e a ação principal "Onde pôr uma pedreira" (ou "um lenhador"), que
    destaca os lugares livres ligados à rua onde ela renderia pelo menos 75% do melhor lugar. **No celular** o nível fica numa segunda coluna ao lado dos
    moradores, com os botões dentro do balão, embaixo dessa coluna (a tela é baixa); se o balão
    não cabe ao lado da casa, a câmera desliza a casa para o lado (`nudge`). Casa vazia: "Casa de
    pedra vazia: espera um casal ou uma família da caravana" (pelo `emptyLevel`), quem está a
    caminho ("A caminho: Natã, Débora") ou "Sem rua"; toco: "Toco · vira árvore de novo em N sem.
    Dá para construir em cima";
  - celeiro, mercado e oficina: "Nível 1 de 3", a linha do próximo nível num quadro dourado
    ("Nível 2: guarda 600 · 3,5/sem (hoje 300 · 1,75/sem)"; mercado "alcance", oficina "+20% nos
    campos") e a ação principal **"Melhorar · 60 · 20 pedra"** dourada; sem prata o botão fica cinza,
    "Falta prata: custa 60"; sem a pedra, cinza com "Falta pedra: 20 (tem 0)"; tocar nele
    diz o mesmo num toast; no topo, "Nível máximo" e nenhuma ação.
    Melhorar faz a construção pular e brilhar e o toast "Celeiro subiu para o nível 2";
  - outras construções: o que faz, quantas casas atende (serviços), vagas, produção, manutenção
    por semana e conexão (desconectada: "não funciona, mas paga manutenção"); campo: "colhe na
    primavera do ano N" e, num ano seco, se está junto ao rio; pescador e coletora: "rende N
    comida/sem"; lenhador e pedreira: "Rende N madeira/sem" (ou pedra) e o lenhador também "Corta 1
    árvore a cada N sem" (`weeksPerCut`); celeiro: "guarda 300" (pelo nível); celeiro (ou rua que liga um) com comida que estragaria ao
    demolir: "✗ Perde N de comida" (`foodLostIfRemoved`), e o mesmo sobe em vermelho ao demolir;
  - ruas, árvores e terreno: uma linha só;
  - botões redondos: **ação principal** dourada quando há algo a fazer (casa sem o próximo serviço:
    "Onde pôr um mercado" escolhe a ferramenta e destaca no mapa os lugares livres, ligados à
    rua, cujo raio atende a casa), **Demolir** (não aparece no altar e no templo) e
    **Fechar**.
- **Ficha da pessoa** (painel como as Estatísticas, aberto do balão da casa; o balão fecha):
  figura, **"Natã, filho de Baruque"** (dourado, maior), "da família de Parós"; "22 anos · adulto"
  (morto: "† aos 71"; foi embora: "foi embora no Ano 4"), a profissão, **Casa** (botão: a câmera vai
  até a casa e abre o balão dela), e à direita os parentes em **botões de 44 px** com a figura:
  **Pais**, **Esposa/Marido** ("Noivo de", "Viúva de") e **Filhos**; quem morreu ou foi embora
  fica cinza com "† aos 71" ou "foi embora no Ano 3". Tocar num parente abre a ficha dele; **Voltar**
  volta pelas fichas vistas e **✕** fecha. Última linha: "Chegou com a caravana que fundou a
  cidade", "Chegou com a caravana do Ano 3" ou "Nasceu na cidade no Ano 2". No celular o painel
  começa logo abaixo da barra do topo; fecha ao tocar no mapa, com Esc ou ao abrir outro painel.
- **Sem linha de informação:** o que ela mostrava foi para os balões, as Estatísticas e a lista de
  Objetivos; mensagens curtas ("Sem espaço para o Templo…") viram toasts.
- **Toasts** no centro de baixo (veja Mapa e mensagens).
- **Configurações:** **Girar a visão** (↺ ↻; no PC continuam Q e E), Dia e noite e Efeito maquete
  ("(aparelho lento)" quando desligado pelo desempenho). Escolhas salvas no navegador.
- **Tutorial:** a seta aponta os botões da Nova e o balão fica acima da parte de baixo da tela; o
  último passo aponta a pílula do objetivo.
- **Categorias** (`category` em `buildings.json`): Moradia (Casa, Praça, Parque), Comida (Campo,
  Pescador, Coletora, Celeiro), Trabalho (Lenhador, Pedreira, Mercado, Oficina), Especiais (Templo). Com até
  `toolColumnMax` (8, em `rules.json`) construções a coluna mostra todas; acima disso mostra as 4
  categorias e tocar numa abre uma faixa com as construções dela. São 12, então as categorias valem.
  A categoria com uma construção liberada nova ganha o selo "novo".
- **Detalhes decididos na implementação (ui-designer):**
  - celular ou PC pelo tamanho real da tela: altura real < 500 px ou ponteiro grosso (toque) = celular;
  - no PC, o cursor sobre o mapa com Mover é uma mão aberta, que fecha enquanto arrasta o mapa; com
    Demolir, a construção sob o cursor fica avermelhada (pulsando), sobre árvore aparece a pílula
    "Cortar árvore · 5 prata" e sobre um celeiro (ou a rua que liga um) com comida acima do que
    sobraria, a pílula vermelha "Perde N de comida" (nada quando 0);
  - Rua e Demolir mostram uma dica curta num balão acima do botão ao serem escolhidos (some ao tocar
    no mapa);
  - balões, painéis e fichas entram com calma (0,12 s, sobem 4 px); uma pílula de recurso que aparece
    pela primeira vez brilha três vezes; o ✕ do balão fica na linha do título (não rola com a lista);
    tudo isso some com "menos movimento" do sistema;
  - Demolir no balão da construção tocada pede confirmação: o primeiro toque vira "Certeza?" por
    2,5 s, o segundo demole;
  - no celular, a ferramenta Demolir num celeiro (ou na rua que liga um) com perda de comida não
    demole ao soltar: abre o balão dele ("Perde N de comida" e o Demolir com segundo toque). O
    mouse não muda;
  - tocar em terreno livre ou no rio fecha o balão da construção tocada; ruas, árvores e rochas
    mostram uma linha;
  - "Onde pôr uma praça/um mercado/um parque" (só se a construção já estiver liberada) escolhe a
    construção e destaca no mapa os lugares; sem
    nenhum, toast "Nenhum lugar livre por perto: abra uma rua ao lado". Os destaques somem ao
    construir, trocar de ferramenta ou fechar o balão (e voltam depois de girar o mapa). Casa sem
    rua ou construção desligada: "Ligar à rua" escolhe Rua;
  - toasts da Nova ficam acima das ferramentas de baixo; o balão do tutorial fica embaixo, entre as
    ferramentas e a coluna, e cresce para os botões terem 44 px reais;
  - a pílula da estação fica à esquerda da velocidade: na primeira linha se couber; senão na linha
    do objetivo (alinhada pela base dele, então o topo não cresce), se o objetivo inteiro couber ao
    lado; só em último caso desce para baixo da velocidade (uma terceira linha, que encurta o mapa
    livre). Nunca cobre as pílulas; o texto do objetivo é cortado com "…" se não couber;
  - Esc fecha primeiro o painel aberto ou a faixa de uma categoria, depois o balão da construção
    tocada, e só então volta para Mover (a dica de Rua/Demolir e o balão da construção escolhida
    somem com a ferramenta: um Esc basta para sair de Demolir);
  - toques a até 8 px de um controle contam como interface (as frestas entre botões nunca
    constroem nem demolem no mapa);
  - os balões (construção escolhida e tocada) nunca cobrem controles: ficam abaixo da estação, da
    velocidade e da engrenagem, abaixo das pílulas do topo e acima de Mover, Rua e Demolir; os
    painéis terminam acima das ferramentas de baixo;
  - toasts: no máximo 3 na tela (**2 no celular**, `TOAST_MAX_PHONE`, menores e só da metade da
    tela para baixo, para não cobrir o centro da cidade); os outros esperam em fila (os vermelhos na frente) e nenhum se
    perde; ficam acima dos balões. Com um **painel aberto** ou o **balão da construção tocada**
    nenhum toast aparece (os que estavam na tela saem, em vez de ficar meio cobertos atrás do balão).
    Ao fechar, volta **no máximo 1 toast**: o aviso mais importante que ainda vale, na ordem de
    `alerts()` (com o tempo que faltava, no mínimo 1,5 s). As notícias que passaram nesse tempo
    (nascimento, morte, casamento, marco, objetivo, liberação, toque que falhou) são descartadas: ficam
    na lista de Avisos, no painel Objetivos e na aba Povo. Toasts iguais viram um. Um toast de
    aviso que deixou de valer (o problema sumiu, ou o texto mudou, como "O celeiro libera no
    objetivo 1" depois de liberado) sai da fila e da tela. A frase da caravana é um toast maior, por 5 s, e fica **sozinha**
    (os outros esperam ela sair);
  - **botões só disparam com o toque que começou neles** e não saiu deles (`onTap` em `ui.ts`):
    uma rua arrastada que termina sobre "Pular tutorial" ou sobre a pausa não aperta nada;
  - o nome de uma construção ou categoria na coluna do PC diminui a fonte até caber no botão
    ("Especiais");
  - construir sem a madeira ou a pedra: toast "Falta madeira: construa um lenhador" ou "Falta
    pedra: construa uma pedreira" (`missingMaterial`; uma vez por arrasto, como a prata);
  - a primeira casa esperando um material dispara o aviso `material` ("1 casa esperando pedra:
    construa uma pedreira"), que vira toast ao aparecer e fica nos Avisos; liberar a Pedreira dá
    "Objetivo cumprido! … · Nova construção: Pedreira" e "Pedreira liberada: tira pedra das rochas
    para casas de pedra e o Templo";
  - "Local inválido" diz o motivo: "Tem uma árvore aqui: corte com Demolir", "Tem uma rocha aqui",
    "Não dá para construir no rio", "Já tem uma construção ou rua aqui", "Fora do mapa" (Demolir:
    "Nada para demolir aqui", "Rochas não podem ser removidas");
  - cortar uma árvore faz subir "−5" em vermelho sobre ela (no toque não há pílula de cursor);
  - com Pescador, Coletora ou Campo, uma pílula sobre a prévia diz, em duas linhas, "Rende N
    comida/sem" (pelos adultos sem trabalho que iriam para ela) e "Comida depois: ±X/sem"
    (o saldo de comida da cidade com ela; a pílula fica vermelha se negativo); campo no inverno:
    "Congelado no inverno: volta em N sem". Lenhador e Pedreira: "Rende N madeira/sem" (ou pedra),
    no Lenhador "Corta 1 árvore a cada N sem" e, quando o raio pega árvores de uma Coletora,
    "Divide o bosque com a Coletora" (`sharedTrees`); a Coletora diz "Divide o bosque com o
    Lenhador". "Comida depois" não aparece no Lenhador e na Pedreira (eles não tiram ninguém da
    comida). Fora da rua ligada, a prévia de qualquer um deles diz "Sem rua ao lado: não rende nada"
    em vermelho (no lugar de "Rende 0"); O balão da construção escolhida diz a regra (por
    célula, alcance e teto) ou "Guarda 300 de comida";
  - no inspetor de pescador, coletora e campo trabalhando com menos de 100% de trabalhadores:
    "Faltam trabalhadores: rende 67%" em laranja;
  - Estatísticas em três abas: **Agora** (números e problemas), **Povo** e **Histórico** (gráficos
    e marcos); a semana de cada marco é guardada pela interface quando ele chega. **Povo:**
    crianças, adultos e idosos; este ano (desde o outono) nascimentos, mortes e casamentos; casais
    esperando casa (com os nomes); próxima caravana anunciada ("Inverno do Ano 3 · 3 famílias" ou
    "Nenhuma anunciada"); as **famílias** em botões de 44 px ("Parós · 4", as mais cheias primeiro,
    6 no celular e 12 no PC, depois "e mais N famílias"; `householdsOf`): tocar leva a câmera à casa
    e abre o balão dela;
  - toasts de pessoas: casamento (verde), nascimento (info), **morte em cinza discreto**, caravana
    anunciada e chegada, casal ou família indo embora (vermelho); o marco da primeira criança da
    cidade que vira adulta diz o nome ("Miriã, nascida aqui, virou adulta!", `grownUpThisWeek`);
  - toasts sobem para ficar acima do balão do tutorial quando ele é mais alto que as ferramentas
    (no celular encostavam nele);
  - vitória e derrota: a cidade desfocada atrás, ramos de oliveira dourados dos dois lados do
    título (serifa), um filete dourado no cartão e **medalhas** (número grande num disco dourado e o
    que ele conta): na vitória moradores, nascimentos e casamentos (contados pela cena na partida);
    na derrota semanas jogadas e moradores no auge;
  - os avisos de casais e de nascimentos ("Casal esperando casa", "Sem nascimentos: …") não viram
    toast enquanto o tutorial roda (o balão do tutorial já fala do casal).
- **Tamanhos de teste:** 844 x 390, 915 x 412 e 1366 x 768.

### "O que fazer agora" (plano Desafio 2.3)
- Uma **linha fixa** logo abaixo da barra do topo, sempre visível fora do tutorial (no tutorial ela
  some: a frase do tutorial é a ajuda): um ícone e uma frase curta (`nextStep` em
  `src/game/model/nextStep.ts`, lê o core, sem regra própria). Celular: 28 px de altura (o toque pega
  44 px), corta com reticências, ao lado da pílula do objetivo quando cabe antes da coluna, senão
  embaixo; os toasts continuam abaixo do
  meio da tela. PC: centrada sob a barra,
  numa linha. A área livre do mapa (balões) começa abaixo dela.
- Ordem: 1) **crise** (vermelha, borda vermelha): dívida ("Dívida: N semanas para perder. Demolir corta
  gastos"), fome ou comida que não chega à colheita ("Comida acaba em N semanas: construa um
  pescador perto do rio"), frio ou lenha que não dura o inverno, o altar restaurado sem ofertas ("O
  altar está sem ofertas: construa um pasto no capim") ou com gado para 8 semanas ou menos ("Gado
  acaba em N semanas: construa um pasto no capim"). Se já existe um pescador, lenhador ou pasto
  na rua sem ninguém trabalhando e ninguém está livre, a crise diz "Pescador sem ninguém: mude
  alguém em Profissões" e o toque abre Profissões (construir outro ficaria vazio
  também); 2) **a etapa do Templo** quando é o
  objetivo (borda dourada): "Altar restaurado: toque no altar para começar", "Alicerce: junte 80 pedra ·
  30/80", "Alicerce: ligue o Templo à rua", "Alicerce: ponha construtores · 1 de 4", "Alicerce 18/40 ·
  pronto em ~6 sem"; 3) **o objetivo atual**: a primeira coisa que falta (construir: o próprio
  objetivo, ou "Oficina: ligue à rua"; casas de nível N: a exigência da casa mais perto de subir,
  "Construa uma praça perto das casas de barro", "Praça libera no objetivo 5", "Faltam 8 de pedra para
  as casas subirem", "Casas de pedra pedem o altar: restaure o altar", "Casas de pedra só perto do
  altar: construa perto dele", "Construa mais casas: 2 de 5" (sem terreno vazio; com um, "Terreno pronto: uma família vem com a caravana em ~N semanas" ou "Terreno pronto: espere o próximo casamento", porque terreno não faz família), "As casas sobem em ~3 semanas"; moradores: caravana
  ou casais sem casa vazia, material, comida para nascer, depois o nível das casas; marcos: "Deixe 1
  casa vazia: caravana em 5 sem", "As crianças crescem: enquanto isso, suba as casas"); 4) "Tudo em
  ordem: aproveite a cidade".
- **Tocar na linha** abre o balão da etapa (a câmera vai ao altar ou ao Templo), Profissões (faltam
  construtores), Avisos (crise) ou Objetivos, e mostra por 8 s a **seta do tutorial** onde agir: a
  ferramenta (some quando ela é escolhida), a construção no mapa (a Pedreira que já existe) ou o lugar
  da etapa.

### Mapa e mensagens

- **Balões** sobre construções com o primeiro problema, nesta ordem: sem rua; depois, em locais de
  trabalho sem ninguém nele (fora do campo congelado), "sem trabalhadores" (trabalhador riscado); pescador "longe do rio" e
  coletora "sem árvores" quando rendem 0; depois, para casas
  de nível 1 a 3, a primeira exigência que falta (lajes claras com banco e toldo ocre = praça,
  listras vermelhas = mercado, duas árvores sobre grama = parque); se a construção que falta ainda
  está bloqueada, o ícone aparece com um **cadeado** (o jogador vê o que vem depois); por último, casa triste
  (carinha vermelha, em qualquer nível). Com zoom
  afastado os balões crescem (escala máx(1, 1,2 / zoom)) para continuar legíveis.
- **Com ferramenta de construção:** linhas da grade, prévia translúcida (vermelha se inválida ou
  sem prata), quadrado do raio e área já coberta pelo mesmo serviço. Praça, Mercado e Parque
  contornam as casas com família que atenderiam ali e mostram "Atende N casas" sobre a prévia; o
  Templo mostra "+10 de Alegria em N casas" (o 10 é `happiness.sacred`). Quando a construção cabe
  e só falta rua (`onlyNeedsRoad`: terreno livre, prata, mas sem encostar na rede), a prévia fica
  **amarela** com "Cabe aqui: falta ligar à rua" (ocupado ou sem prata continua vermelho; sem
  prata a prévia diz "Falta prata: custa N", em dívida "Em dívida: não dá para construir").
  Pescador e Coletora mostram "Rende N comida/sem" (com as células de rio ou árvores contadas
  destacadas); Campo mostra que dá comida fora do inverno. Com Casa, destaque da área coberta
  pelas praças (onde a tenda pode virar casa de barro). O Templo não é
  posto pelo jogador: as ruínas já estão no mapa desde o início (ver Objetivos).
- **Toasts** (mensagens curtas no centro de baixo, acima das ferramentas, empilhando para cima; o
  que sai esmaece em 250 ms e os outros deslizam para o lugar em 150 ms, sem movimento com
  `prefers-reduced-motion`):
  prata insuficiente, cidade em dívida (ao tentar construir), entrou/saiu da dívida, local
  inválido, templo sem rua, rua não ligada ao altar, altar/templo protegidos, objetivo cumprido,
  "Oficina liberada: …", "Falta comida: construa pescador ou coletora" (uma vez por episódio de
  fome), a frase da caravana, os marcos, o primeiro texto de cada aviso (o de comida curta só se
  começar no verão) e a chegada de cada estação ("Chegou o verão: dias quentes e secos";
  inverno: "Inverno: só pescador e coletora dão comida").
- Durante a fome, leve tom avermelhado sobre o mapa.
- Tela inicial com 3 passos numerados ("Guarde comida para o inverno: pesque, colete e plante campos.";
  "Casais precisam de casa. Com madeira de um lenhador, tendas viram casas de barro; guarde lenha para
  o inverno. Sem celeiro, só cabem 100 de comida."; objetivos, Templo e não
  ficar em dívida),
  uma linha de controles e o
  botão "Começar" (84 px de altura). Depois que o tutorial foi feito ou pulado, aparece ao lado
  "Rever o tutorial", que começa um jogo novo com o tutorial.
- Instalar no celular (PWA): quando o navegador oferece a instalação (Chrome/Android, Edge), a
  tela inicial mostra o botão "Instalar app" no canto superior direito; no iPhone/iPad (Safari)
  mostra embaixo a dica "toque em Compartilhar e depois em Adicionar à Tela de Início". Nada
  aparece quando o jogo já está aberto como app. Instalado, abre em tela cheia, deitado, e
  funciona sem internet (service worker em `public/sw.js`, manifesto em
  `public/manifest.webmanifest`, ícones em `public/icons/`).

## Tutorial (primeira partida)

Roda na primeira partida até ser concluído ou pulado (fica gravado no navegador em
`jerusalem.tutorialDone`; se o armazenamento estiver bloqueado, ele volta na próxima partida e
pular continua funcionando). Passos em `src/data/tutorial.json`, condições em
`src/core/tutorial.ts`, tela em `src/ui/tutorial.ts` e `src/app/play3d.ts`.

- Um balão com **uma frase** fica embaixo, entre as ferramentas e a coluna, com o botão "Pular tutorial".
  Uma **seta dourada** que balança aponta onde tocar: o botão da ferramenta do passo até ela ser
  escolhida, depois o lugar no mapa.
- **As ferramentas nunca travam:** o tutorial só destaca (seta e caminho marcado). Câmera, girar
  e velocidade continuam livres.
- **O relógio fica parado nos passos de construir** (1 a 5: `tutorialHoldsClock`), para a
  primeira cidade ser feita sem pressa, e volta a andar no passo 6 (o casal andando). A
  velocidade escolhida fica guardada.
- A cada passo a câmera desliza até o lugar dele (a rua marcada, o lugar do pescador ou da
  coletora, o lugar livre de campo ligado mais perto do altar (`fieldHint`), o lugar do lenhador
  (`lumberSpot`), o terreno da casa) e o deixa no **meio do mapa livre**: abaixo da
  barra do topo, entre os botões laterais e a coluna, acima do balão do tutorial e dos toasts (a
  frase da caravana não cobre a rua marcada); se o jogador mexer na câmera (arrastar, dois dedos, botão
  direito, roda), ela fica onde ele deixou, e o deslizamento para na borda do mapa.
- Passos (cada um só avança com a sua ação; comida primeiro):
  1. "Puxe uma rua pelo caminho marcado, até onde há comida": o caminho fantasma (`ghostRoad`) é
     a rua mais curta, por terra livre, da rede até o **melhor lugar de pescador ou coletora**
     (`foodSpot`): o de maior rendimento entre os que rendem pelo menos 1,2/sem
     (`minSpotFood` em `tutorial.json`) e, entre esses, o de rua mais curta. Conclui quando a rua
     marcada fica pronta, ou com o mesmo número de ruas novas ligadas ao altar em outro lugar.
  2. "Construa um pescador junto ao rio ou uma coletora perto das árvores": a seta aponta o
     lugar escolhido; a prévia mostra "Rende N comida/sem" e "Comida depois". Conclui com 1
     pescador ou coletora ligado.
  3. "Construa um campo: ele dá comida já, até o inverno congelar". Conclui com 1 campo ligado.
  4. Lenhador (Pacote B1: a madeira vem antes da casa, a praça saiu do tutorial): "Casas pedem
     madeira: construa um lenhador perto das árvores". O lugar é `lumberSpot`, a mesma busca de
     `foodSpot` (maior rendimento, depois rua mais curta) para o Lenhador. Conclui com 1 lenhador
     ligado. Se o lugar precisa de rua, a rua dele aparece marcada (como no passo 1), o balão diz
     "Casas pedem madeira: puxe a rua marcada e ponha um lenhador no fim" e a seta aponta Rua e
     depois a rua marcada; com a rua pronta, a seta aponta o Lenhador e depois o lugar. A prévia diz
     "Rende N madeira/sem" e "Corta 1 árvore a cada N sem".
  5. "Natã e Débora querem se casar: construa uma casa perto das tendas" (os nomes do casal da
     caravana, `start.couple`): os terrenos livres encostados na rede ficam verdes e a seta aponta
     o mais perto do altar (`houseHint`). Conclui com 1 casa nova ligada.
  6. "Natã e Débora vão para a casa nova!": os noivos da caravana (`start.couple`) andam até a casa
     vazia e casam ao chegar. Conclui com o marco Primeiro casamento; aparece "Muito bem! Casais
     novos precisam de casa; casas melhores cabem mais filhos". O passo também termina sozinho
     depois de `weddingStepMaxWeeks` (6) semanas (por exemplo, sem casa vazia), com o mesmo toast.
- Com a ferramenta do passo escolhida, a seta aponta o lugar no mapa (pescador ou coletora, campo,
  praça, casa, lenhador) com a ponta **acima da construção** e da pílula da prévia ("Rende N…"),
  para não cobrir a prévia nem o texto dela. No celular, a seta de
  uma construção única (pescador, coletora, praça) aponta onde o dedo vai: a mira fica 90 px acima do
  dedo, então tocar na ponta da seta constrói no lugar marcado.
- Uma rua arrastada que passa por cima de um botão ou painel para ali; ao soltar, o toast "A rua
  parou sob um botão: mova o mapa e continue" explica.
- Mini passo (só para quem não pulou), sem travar ferramentas: ao cumprir o objetivo que libera o
  Mercado (Objetivo 4; depois dos passos principais, ou logo ao fim deles), "Construa um mercado
  perto das casas de barro: elas viram casas de pedra", com a seta no Mercado. Conclui com 1
  mercado ligado.
- Na abertura, fora do tutorial, um toast nomeia o casal: "Zebadias e Tamar querem se casar".

## Estações e clima

O ano tem 4 estações de **13 semanas** cada (`weeksPerSeason` em `rules.json`; 41,6 s a 1x),
começando no **outono**: outono, inverno, primavera, verão. As regras das estações são a colheita
(primavera), o inverno com fome (tendas saem mais) e a seca (veja Colheita). O core diz a estação
da semana (`src/core/seasons.ts`), avisa quando uma começa (evento `season`) e diz se o ano é
seco; cores, fases e chances visuais ficam em `visual.json` (`seasons`, fases em semanas de 1 a
13) e o desenho em `src/game/seasons.ts` e `src/render3d/time/`. O ciclo segue o da região
de Jerusalém: inverno chuvoso e verde, verão seco.

- **Campos pela estação** (só desenho, lendo o core: `harvestsIn` na primavera do ano agrícola):
  outono brotando (terra arada com brotos, que crescem a partir da semana 7); inverno verde,
  amadurecendo nas últimas semanas; primavera dourado, com agricultores colhendo e carregadores
  levando sacos ao celeiro; verão palha baixa. Campo construído depois do outono fica arado e
  vazio até o próximo outono. Num ano seco, campos longe do rio ficam ralos e amarelados quando a
  terra racha (primavera e verão); os encostados no rio continuam normais.
- **Celeiro:** o desenho enche de sacos e jarros conforme o estoque (vazio, um terço, dois terços,
  cheio).
- **A cena inteira muda:** cada estação tem a sua grama e a sua areia (texturas próprias), e uma
  cor própria para as ruas, o rio, as oliveiras e palmeiras, a luz do mundo e o céu atrás do
  mapa. Nas últimas 2 semanas de uma estação tudo vai virando a próxima, célula por célula.
- **Inverno:** grama verde viva e limpa (sem pontinhos), céu nublado, luz mais fria, chuva
  frequente (55%, muitas vezes forte), fumaça saindo de todas as casas. Amendoeiras e figueiras
  sem folhas.
- **Fim do inverno (semanas 8–13):** as amendoeiras florescem (flores brancas e rosadas) e as
  pétalas voam com o vento; figueiras ainda peladas.
- **Primavera:** o verde no auge, com campos de anêmonas vermelhas e flores do campo na grama;
  pétalas no vento; o trigo e a cevada ficam dourados e são colhidos ao longo da estação.
  A chuva vai rareando (40% → 0).
- **Verão:** tudo seco: grama amarelada, areia mais clara e ofuscante, céu limpo, poeira no vento
  e o ar tremendo de calor. Nunca chove. Os campos ficam com a palha baixa.
- **Outono:** seco no começo (poeira); as primeiras chuvas chegam no fim (0% → 45%). Nada de
  folhas laranja caindo: oliveiras e palmeiras não perdem as folhas; as figueiras amarelam.
  Da semana 2 à 12, catadores batem os galhos e juntam azeitonas e figos em cestos ao lado das
  árvores perto da cidade (só desenho; a Coletora é a regra).
- **Árvores:** parte das oliveiras do mapa é desenhada como amendoeira (30%) ou figueira (18%),
  sempre as mesmas células; a linha de informação mostra o nome certo.
- **Chuva:** gotas pela tela inteira, inclinadas pelo vento, em três intensidades (fraca, média,
  forte: mais gotas, mais vento, céu e luz mais escuros, sombras de nuvens mais fortes), com
  respingos no chão. O chão e os telhados escurecem molhados e continuam molhados depois da chuva,
  secando devagar (mais rápido no verão); poças aparecem nas ruas e somem mais devagar ainda.
  A chuva vem em pancadas de 2 a 5 semanas (`look3d.json` > `weather.spellWeeks`) que atravessam a
  virada da semana, entrando e saindo devagar (~0,5 semana, `fadeWeeks`) e com o céu fechando antes;
  a fração do tempo com chuva é a chance da estação × `wetShare` (0,375, igual à de antes). Uma pancada
  para antes de uma semana sem chance de chuva (o verão continua seco).
- **Neve (rara, só visual):** cerca de 1 inverno em 5 (`visual.json`). Da semana 3 à 10 do inverno
  a neve cobre o chão (célula por célula), os telhados e as árvores, e a chuva cai como neve.
  Nunca num ano seco.
- **Seca (regra do core, veja Colheita):** o visual segue o ano seco do core. No inverno de um
  ano seco a chuva cai na metade da chance (`drought.winterRain`) e não neva; da semana 4 da
  primavera em diante (a chuva sumindo junto) a terra racha, a
  grama fica marrom, o rio estreita com margens de lama seca, os campos longe do rio ficam ralos e
  a poeira aumenta; segue pelo verão e passa nas primeiras semanas do outono. Enquanto durar, a
  pílula da estação mostra o ícone da seca. Neve e seca dependem só da semente do mapa, então a
  mesma partida repete os mesmos anos.
- A chuva, a neve e o vento ficam numa camada própria entre o mapa e a interface (o zoom não muda
  o tamanho deles). Em aparelhos lentos, metade das partículas (e um teto de gotas).

## Câmera e controles (estilo Pocket City)

| | Celular | PC |
|---|---|---|
| Mover (Ver) | arrastar move a câmera; tocar seleciona | idem com o mouse |
| Ferramentas de construção | Rua: arrastar constrói; as outras: tocar (arrastar ajusta a prévia); dois dedos movem | idem com o mouse; botão direito move |
| Zoom | pinça | roda do mouse |

- **Tamanho da tela:** a largura do jogo é 1280 e a altura acompanha o formato da tela, entre
  560 e 720 (celular 844 x 390 → 1280 x 591, sem faixas laterais e com tudo ~22% maior).
- Zoom entre 0,5x e 2x. A câmera começa centralizada no altar.
- **Girar o mapa:** duas setas (↺ ↻) nas Configurações giram a visão 90° (Q e E no PC). Só a
  visão gira; as regras não mudam. A câmera continua olhando o mesmo
  ponto, as junções das ruas e a ordem de desenho acompanham o giro, e as construções mantêm a luz
  do mesmo lado (o Mercado troca entre o desenho 2 x 4 e 4 x 2 conforme fica na tela).
- **Só a Rua constrói arrastando** (decisão do usuário, 2026-11-05: o jogo é de sobrevivência,
  cada construção é uma escolha); o arraste preenche as células em passos ortogonais, então a rua
  fica sempre conectada.
- Todas as outras construções (Casa e Campo inclusive) e Demolir agem uma vez, **ao soltar
  o dedo**: dá para arrastar para
  ajustar a prévia, e o segundo dedo de uma pinça nunca constrói por engano. No toque, as
  construções (não Demolir, que age sob o dedo) miram 90 px acima do dedo, para a prévia não ficar escondida; se o ponto mirado cair sob a interface,
  não há prévia (a prévia nunca fica escondida sob a interface); soltar sobre a interface cancela.
- No toque, o arraste só começa a construir depois de 150 ms com um dedo só (a pinça não
  constrói). Nada é construído nem começa um gesto sob pílulas, botões redondos, coluna, balões e
  painéis. Continuar uma rua a partir de uma rua existente não mostra "Local inválido".
- Atalhos no PC (a tecla abre a faixa e escolhe a primeira construção liberada dela): 1 Mover, 2 Rua, 0 Demolir; 3–6 abrem as categorias (Moradia, Comida,
  Trabalho, Especiais) e a mesma tecla de novo passa para a próxima construção da categoria;
  R gira o Mercado, Q e E giram o mapa, Espaço troca a velocidade, Esc fecha o balão ou painel
  aberto e, sem nenhum, volta para Mover.

## Vida na cidade

Só desenho (`src/render3d`); números em `src/render3d/look3d.json` e `src/data/visual.json`.

- **Moradores** andando **só pelas ruas**, com rota por busca em largura até uma construção
  conectada (core). Quantidade = 8 + metade dos moradores, no máximo 140 (`walkerCount`). Balançam
  de leve ao andar, param na pausa e andam mais rápido em 3x. Menos gente na rua à noite e na chuva
  (`crowd` em `look3d.json`): quem sai da conta anda até a porta mais próxima no caminho e entra; quem
  volta sai por uma porta (`doorBeside` em `crowd.ts`). Ninguém some nem pula: andarilhos, famílias e
  trabalhadores são redesenhados cada um só quando a sua parte muda (`diff.ts`), e quem continua
  mantém lugar e caminho; um caminho cortado por uma rua demolida é refeito de onde a pessoa está.
- **Quem anda na rua é gente da cidade** (`castWalkers` em `crowd.ts`): cada morador andando é um
  morador de verdade, cada um uma vez só, vestido como ele mesmo. O tipo de ofício é feito por quem
  trabalha ali (o lavrador por quem trabalha num campo, o artesão por quem trabalha na oficina, e
  ele leva o produto dessa oficina). Nos outros tipos vai alguém da idade certa, e a aguadeira e a
  cesteira são mulheres. Numa cidade com menos moradores que andarilhos, os que sobram são de fora.
  Com Mover, **tocar ou clicar numa pessoa na rua abre a ficha dela** (26 px de alcance no toque,
  16 no mouse); fora disso, o toque abre o balão do que está no mapa.
- **Famílias e caravanas** andam em grupo da entrada até a casa (veja "Aparência e moradores"), uma vez
  só, no passo do core (`f.step` com a fração da semana), e entram; não repetem o trecho.
- **Agricultores** curvados sobre as plantações, alguns por campo e mais no arado e na colheita
  (`crowd.fieldHands`); nenhum em campo sem rua.
- **Dia e noite** (só visual): 240 s a 1x, seguindo o tempo do jogo (para na pausa), com a luz do
  sol, o céu, a neblina e as sombras. Em velocidades altas a luz balança perto do meio-dia em vez de
  piscar. **Toda casa com gente acende à noite:** a casa de barro a porta, as casas de pedra e as
  grandes as janelas (nas casas .glb, um vidro quente com halo, `WINDOWS_AT` em `plan.ts`), e cada
  uma tem uma poça de luz quente no chão diante da porta (maior nas casas maiores; o mercado e a
  oficina ligados também, `DoorLights`); a tenda tem a fogueira com faíscas e uma poça forte. Casa
  vazia fica apagada. Acendem também as lamparinas que o jogador pôs (só com madeira no estoque), o fogo do
  altar e o forno da oficina, e aparecem estrelas e a lua. A lua e o céu da noite iluminam o
  bastante para ver ruas, casas e gente no celular, ainda com cara de noite (`look3d.json` > `day.keys`
  e `night`). Desligado na engrenagem: sempre meio-dia.
- **Fogo do altar** em camadas: línguas de chama que tremulam (miolo amarelo, laranja, pontas
  vermelhas), brasas pulsando no leito e faíscas subindo; tudo no shader, uma chamada só.
- **Fumaça** macia (bolas de fumaça com luz por cima, sobem, incham e se inclinam com o vento) nas
  casas de barro ou melhores (as casas .glb soltam do alto do telhado), nas tendas (fogueira), na
  oficina e no altar; casa vazia não solta fumaça. **No frio sem lenha (`s.cold`) nenhuma casa
  fuma e as fogueiras das tendas apagam** (`smokeShare` em `plan.ts`); o altar e o forno da oficina
  continuam.
- **Vento** (só no shader de vértice, sem custo na CPU): palmeiras balançam mais, oliveiras pouco,
  rochas nada; o trigo e a cevada ondulam em ondas que correm pelo campo; a roupa nos varais (e o
  pano do espantalho) balança mais na barra, e os toldos (casa de pedra, praça, mercado, oficina,
  celeiro) ondulam no meio. A força segue o vento do clima e tudo fica parado na calmaria
  (`look3d.json` > `wind.calm` = 0).
- **Vida parada na rua** (só desenho, `src/render3d/street.ts`, números em `look3d.json` > `street`),
  gente de verdade da casa, cada um uma vez:
  - Diante da porta, mais gente quanto maior a casa: na tenda, às vezes uma mulher ajoelhada na
    fogueira; na casa de barro 1 (mulher moendo na soleira ou criança brincando); na de pedra 2 (dois
    vizinhos conversando, ou um idoso com cajado e uma criança); na casa grande 3. Sem alguém da
    idade certa, quem estiver em casa faz o que combina com ele.
  - Mercado ligado com equipe: 2 a 4 compradores (conforme o nível) olhando as bancas, as mulheres
    com cesto, primeiro do lado da rua.
  - No outono, sob até 4 oliveiras a até 5 células das casas, dois colhedores: um batendo os galhos
    com vara, outra ajoelhada catando no cesto.
  - No máximo 40 figuras; menos à noite e na chuva (como os andarilhos), metade na qualidade baixa,
    nenhuma na mínima nem de longe (rareiam nas últimas 10 unidades antes de `farDist`, `farBand`);
    sombras só na qualidade alta.
- **Noivos de mãos dadas:** um casal noivo a caminho da casa onde vai casar (o core casa os dois
  ao chegar) anda lado a lado, de mãos dadas (`betrothed` em `crowd.ts`).
- **Família indo embora:** quando uma família deixa a cidade (evento `familyLeft`), quem saiu da
  casa nessa semana anda a pé, com trouxas nas costas (o idoso com cajado), pela rua até a entrada
  e some (`leavePath`; sem rua, atravessa o campo). Até 2 grupos de 6 ao mesmo tempo.
- **Ruas que evoluem** (só visual, `src/render3d/roads.ts`): a rua mostra quanta gente passa por
  ela. Cada construção manda o seu povo até o altar pelo caminho de rua mais curto: a casa manda os
  seus moradores, o local de trabalho as suas vagas e os outros serviços 2. Com menos de 6 pessoas
  passando, a rua é uma **trilha** estreita de terra batida no meio da célula, ligada às ruas ao
  lado. A partir de 6 vira uma **rua** inteira de terra, com uma borda escura nos lados sem rua (lê
  no zoom mínimo), sulcos de roda em direção às ruas vizinhas e, em 35% das células, umas pedrinhas.
  A partir de 30 vira **lajes de pedra** (fileiras com juntas desencontradas, viradas pela célula)
  com **meio-fio de pedra** nos lados sem rua (`look3d.json` > `roads`). Ruas a até 2 células do
  altar ou do templo são pelo menos rua. Na neve as ruas ficam limpas.
- **Chão pisado** (só visual, `src/render3d/wear.ts`, números em `look3d.json` > `wear`): um mapa de
  4 x 4 amostras por célula, refeito quando a cidade muda, escurece o chão para terra batida (com a
  borda quebrada por ruído): meio disco diante da porta de cada casa com gente e de cada local de
  trabalho (não no campo, altar, templo, praça e parque), uma borda macia ao longo das ruas (mais
  larga na trilha e na rua comum, quase nada na rua de lajes e na rua solta) e uma trilha fraca
  entre casas a 1–3 células uma da outra, de centro a centro, como no 2D.
- **Detalhe do chão** (só visual, `src/render3d/detail.ts`, `look3d.json` > `detail`): tufos de
  capim (1 a 3) em 80% das células de grama, com a cor da grama da estação e balançando com o vento,
  e seixos em 30% das células de areia; só no chão livre (sem rua, construção, árvore, rocha, rio
  nem chão pisado). Somem de longe (distância > 48) e na qualidade mínima.
- **Campos** (só visual, plano beleza C6; `models.ts` `field`, `fields.ts`, `look3d.json` > `fields`):
  cada campo fica num socalco com muro baixo de pedra solta e capim nos cantos; as cinco fileiras
  mostram a cultura: trigo em touceiras retas com espiga, cevada curvada pela barba, lentilha em
  moitas baixas e redondas, linho em hastes finas com flor azul. Crescem com a estação, cada campo
  um pouco mais alto ou mais baixo que o vizinho (pelo lugar). Na seca, os campos longe do rio
  (`moistMap`: úmido até 2 células da água, seco a partir de 6) ficam ralos, baixos e cor de palha;
  os da beira do rio continuam bonitos.
- **Árvores** (só visual, plano beleza C6; `models.ts`, `treeKind` em `game/seasons.ts`): as células
  de oliveira aparecem como oliveiras (30% amendoeiras e 18% figueiras, fixas por célula, como no
  2D). Oliveira de tronco torto com copa em quatro lóbulos claros e escuros, sempre verde;
  amendoeira de tronco fino e galhos, flor branco-rosada no fim do inverno, folha na primavera e
  no verão, nua do fim do outono ao meio do inverno; figueira baixa de copa larga e chata, amarela
  no outono e nua no inverno; palmeira com folhas em arco que caem e cachos de tâmara.
- **Rio** (só visual, plano beleza C6; `detail.ts`, `terrain.ts` `Water`): na beira do rio perto da
  cidade (até 22 células do altar), touceiras de junco na linha da água e algumas pedras maiores
  (os modelos de tufo e seixo, maiores: nenhuma chamada de desenho a mais). À tarde, com céu
  limpo e o sol mais baixo, quem olha o rio na direção do sol vê um brilho suave e faíscas que
  piscam nas ondas; de costas para o sol, nada.
- **Andaime:** toda construção nova, menos campo, aparece primeiro com andaime de madeira e poeira
  por 1,5 s; ao subir de nível, a casa mostra o andaime por 0,6 s.
- **Momentos** (`fx.ts`): ao construir, um anel de luz; o Templo dá anéis dourados, faíscas e
  clarão. Ao demolir sobem poeira e pedrinhas. Ao subir de nível há anel dourado, pulinho e "+N", e
  um bebê dá o mesmo com "+1". Ao cair de nível, perder comida ou cortar árvore sobe um texto
  vermelho. Num marco, a construção dele brilha com halo e faíscas douradas. Com comida
  estragando aparecem moscas e uma fumacinha verde no celeiro ligado (ou no altar). No começo da
  colheita, um anel dourado em cada campo que colhe. Árvore cortada tomba e vira toco.
- **Gente reunida no marco:** até 6 moradores que andam a até 14 células do lugar
  (`visual.json` > `moments.milestoneCrowd`) vão pelas ruas até ele. Ali pulam de alegria por
  `milestoneSeconds` (4 s) e seguem o caminho deles. O jogo não pausa.
- **Animais e rio** (só desenho, `src/render3d/ambient.ts`, números em `look3d.json` > `ambient`):
  - 6 pombas no pátio do altar, bicando o chão; a cada 14 s cada uma levanta voo em arco e pousa.
  - Metade das tendas com gente tem uma cabra e duas galinhas no chão livre ao lado.
  - Um jumento com cestos fica amarrado ao lado de cada mercado ligado.
  - Até 3 rebanhos de 4 ovelhas pastam devagar na grama aberta, a até 16 células do altar.
  - Há 2 barquinhos de pescador na água do rio mais perto da cidade, balançando, e 3 lavadeiras
    ajoelhadas na margem, de frente para a água, esfregando a roupa, com o cesto ao lado.
  - Os bichos pastam e bicam com a cabeça baixa de vez em quando. São no máximo 40 animais.
- **Ambiente:** água correndo no rio, sombras de nuvens, plantações e árvores pela estação, chuva,
  neve, folhas, pétalas e poeira (veja "Estações e clima"). No verão, a linha do horizonte do céu
  treme com o calor.

## Arte

- **3D low-poly** em Three.js (`src/render3d`): modelos feitos por código (`models.ts`) e um pacote
  de modelos .glb gerados no Meshy (`public/models/meshy`, créditos em `CREDITS.md`), trocados por
  chave. O jogo abre com os modelos de código e troca pelos .glb quando chegam. A cidade inteira
  cabe em poucas dezenas de chamadas de desenho, porque cada parte de modelo é instanciada.
- **Paleta quente:** areia, ocre, tijolo de barro, pedra calcária clara, com o verde das palmeiras e
  oliveiras e o azul do rio de contraste (`COLORS` em `models.ts`; cores da interface em
  `src/game/palette.ts`).
- **Luz:** sol e lua com sombras, céu em degradê, neblina pela distância da câmera; a qualidade
  baixa sozinha em aparelho lento (resolução, sombras e partículas). Não há efeito maquete nem
  vinheta.
- **Construções** no tamanho real da área (1 célula = 1 unidade), viradas para a rua ao lado. A
  casa tem um modelo por nível, cada um com identidade própria: terreno marcado, tenda de pano
  escuro, cubo de barro, casa de pedra e casa grande de calcário (veja "Aparência e moradores"
  para os quintais por variante). Altar 4 x 4 de pedras brutas com chifres, rampa e fogo; Templo
  6 x 6, a construção mais bonita, de calcário com detalhes dourados. Praça de lajes claras com
  toldo de linho ocre sobre esteira e jarro, bancos e uma figueira (sem poço nem fonte); parque murado com oliveiras.
- **Ruas:** terra batida, gasta e calçada (veja "Vida na cidade"); poças na chuva. Rua fora da
  rede: tracinhos claros e acinzentados no lugar da rua (`loose`/`loose-arm`), que leem no zoom mínimo.
- **Chão:** areia e grama pela estação, com manchas de 2 a 3 células e um grão fino de perto
  (desligados na qualidade mínima); o rio tem uma margem contínua de areia clara, úmida e escura na
  beira da água; na seca a margem vira lama e o leito aparece.
- **Árvores:** oliveiras, palmeiras, amendoeiras e figueiras pela estação; toco com muda quando
  volta a crescer (`regrowth`).
- **Gente** low-poly instanciada (túnica, cabeça, turbante ou manto) em 3 tons de pele, com cores da
  época (`crowd.ts`); jumento de carga nas caravanas.

## Fora do escopo por enquanto

- **Deploy:** o workflow do GitHub Pages existe (`.github/workflows/deploy.yml`), mas o `base` do
  Vite continua `'./'`. A mudança para `/jerusalem-antiga/` foi adiada a pedido.
- **Tela cheia em celulares compridos:** o jogo mantém 1280 x 720 (16:9), então sobram faixas nas
  laterais. Ocupar a tela inteira exigiria refazer o layout da interface.

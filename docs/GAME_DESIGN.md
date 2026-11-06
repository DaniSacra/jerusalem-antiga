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
  ficam dentro disso) e uma faixa de 5 células (a rua inicial e 2 de cada lado) até a entrada.
  Sempre existe lugar livre para o Templo 6 x 6 fora da área do altar (os testes pedem 3 ou mais
  posições a até 12 células do altar, ligadas à rua, sem cortar árvores).

## Início

- **Altar** fixo, 4 x 4, ocupando x e y de 22 a 25, raio 4. Não está na barra de ferramentas e não
  pode ser demolido.
- **Ruas iniciais** de terra, de graça: um **anel** de 1 célula em volta do altar (contorno de
  x e y de 21 a 26, 20 células) e a rua na coluna x = 24, do anel (y = 26) até a borda sul. A
  célula onde ela toca a borda (24,47) é a **entrada da cidade**. São ruas comuns: Limpar pode
  removê-las.
- As junções das ruas são desenhadas só com ruas vizinhas; o altar não conta, então o anel aparece
  como um contorno com cantos e um T onde a rua sul encontra o anel.
- O jogo começa na **semana 1 do outono do Ano 1**. Prata **180** (cerca de 6 construções).
- **Caravana fundadora** (sorteada pela semente, `caravans.start` em `rules.json`): **3 a 5
  famílias** de pessoas com nome (veja Pessoas) já moram em tendas (casas comuns de nível 1, de
  graça, uma família por tenda, no máximo 3 pessoas) em **filas de duas ao norte do anel**, dos
  dois lados de uma rua curta (`campRoad`, 6 células) que sai do anel; a fila encostada no anel
  enche primeiro, oeste antes de leste (a 5ª tenda abre a 3ª fila, a oeste). A fundadora nunca traz
  um casal de noivos jovens (modelo `engaged`): o seu casal de noivos é o de `start.couple`. Ao lado, a leste, fica um lugar 2 x 2 livre (`campPlazaSpot`) onde **uma praça
  alcança todas as tendas**. As duas primeiras famílias trazem um filho e uma filha de 18 ou 19
  anos **noivos** (`people.couple`, `start.couple`): o primeiro casamento espera só uma casa vazia.
  Os outros filhos alternam filho e filha entre as famílias. A comida inicial vale **18 a 24
  semanas** do consumo das pessoas, cortada no limite sem celeiro (100). Frases na abertura:
  "A caravana chegou com 3 famílias e comida para 14 semanas" (as semanas da previsão) e, fora do
  tutorial, "Zebadias e Tamar querem se casar". A caravana traz também **40 de madeira** e nenhuma
  pedra (`startMaterials` em `rules.json`).
- Nenhuma abertura é sempre a melhor: mais famílias dão mais imposto e trabalhadores, mas comem
  mais; rio perto barateia o Pescador; bosque perto favorece a Coletora; rochas tiram espaço.
- Liberados: Mover, Rua, Casa, Campo, Praça, Pescador, Coletora, Lenhador e Demolir.
- **Não há água no jogo** (desde o Pacote 2, 2026-11-04): o Poço saiu, nenhuma casa pede água e a
  porta das famílias não olha água. O rio é só terreno, pesca e o bônus dos campos na seca.

## Construções

| Construção | Custo | Manutenção | Tamanho | Vagas | Produção | Raio | Observações |
|---|---|---|---|---|---|---|---|
| Rua | 2 / célula | – | 1 x 1 | – | – | – | arrastar constrói em sequência |
| Casa | 40 + 10 madeira | – | 2 x 2 | – | impostos | – | começa como terreno vazio (as tendas da caravana são grátis) |
| Campo | 20 | 0,5/sem | 2 x 2 | 2 | 468 comida/ano fora do inverno (12/sem), mais o bônus das oficinas | – | 4 plantações (só aparência); ver Colheita |
| Praça | 25 | 0,5/sem | 2 x 2 | – | – | 4 | liberada no início; tendas no raio viram casas de barro |
| Pescador | 20 | 0,5/sem | 2 x 2 | 1 | células de rio no raio × 0,75, máx. 4,5 comida/sem; × 0,3 no inverno | 2 | |
| Coletora | 20 | 0,5/sem | 2 x 2 | 1 | árvores no raio × 0,3, máx. 3,5 comida/sem; × 0,3 no inverno | 3 | |
| Lenhador | 25 | 0,5/sem | 2 x 2 | 2 | árvores no raio × 0,25, máx. 2 madeira/sem | 3 | categoria Trabalho; o ano todo; corta 1 árvore a cada 10 de madeira (ver Madeira e pedra) |
| Pedreira | 40 + 10 madeira | 1/sem | 2 x 2 | 3 | rochas no raio × 0,4, máx. 2 pedra/sem | 2 | categoria Trabalho; o ano todo; liberada pelo Objetivo 3 (primeiro nascimento); as rochas não acabam |
| Celeiro | 40 + 10 madeira | 1/sem | 3 x 3 | 1 | guarda 300 de comida (nível 2: 600, nível 3: 1000) | – | liberado pelo Objetivo 2; melhora (veja Níveis) |
| Mercado | 60 + 10 madeira | 2/sem | 2 x 4 | 3 | – | 5 (nível 2: 6, nível 3: 7) | liberado pelo Objetivo 4; pode girar para 4 x 2; melhora |
| Oficina | 50 + 10 madeira | 1/sem | 3 x 3 | 3 | +10% da comida dos campos (nível 2: +20%, nível 3: +30%), soma até +30% (`fieldBonusMax`); não dá prata | – | liberada pelo Objetivo 5; 6 ofícios (só aparência); melhora |
| Parque | 60 + 5 pedra | 1/sem | 2 x 2 | – | – | 4 | liberado pelo Objetivo 7; casas de pedra no raio viram casas grandes; dá Alegria |
| Templo | 800 + 300 pedra + 300 madeira | – | 6 x 6 | 2 | – | 12 | liberado pelo Objetivo 14 (100 moradores); sem manutenção; a vitória ainda pede o Objetivo 17 (175 moradores); não pode ser demolido; o raio só dá Alegria |
| Altar | – | – | 4 x 4 | – | – | 4 | fixo no início; o raio só dá Alegria (não é exigência de casa) |

- **Pescador, Coletora, Lenhador e Pedreira** (`gather` em `buildings.json`, uma regra só,
  `gatherYield`): produção por semana = mín(`max`, células do recurso no raio × `perCell`) ×
  eficiência, do produto `gather.product` (comida quando falta; madeira no Lenhador, pedra na
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
  no fim da partida) e passa a pagar a manutenção dele (Celeiro 2 / 4, Mercado 3 / 5, Oficina 2 / 3).
  Não dá em dívida, sem prata, sem a pedra (`materials`) ou no topo. Toast "Celeiro subiu para o nível 2".
- **Manutenção** (`upkeep` em `buildings.json`, pelo nível) é cobrada **desde a primeira semana**,
  toda semana, de toda construção, **mesmo desconectada**, e também depois da vitória. O preço na
  coluna mostra custo e manutenção.

## Madeira e pedra (Pacote 3)

- **Estoque da cidade**, como a prata: `wood` e `stone` no estado, **sem limite e sem depósito**.
  Começa com **40 de madeira e 0 de pedra** (`startMaterials`). Entra toda semana a produção dos
  Lenhadores e Pedreiras ligados × eficiência (`Economy.wood`, `Economy.stone`, o "+N/sem").
  Demolir não devolve material.
- **Custo de obra** (`materials` em `buildings.json`, além da prata): Casa 10 madeira; Celeiro,
  Mercado, Oficina e Pedreira 10 madeira; Parque 5 pedra; Templo 300 pedra + 300 madeira. **Não
  custam material:** Rua, Campo, Praça, Pescador, Coletora e Lenhador (comida e madeira nunca
  travam por material). Construir exige prata **e** material e paga os dois; sem material, falha
  com a razão `materials` sem gastar nada (a prata é conferida antes). `missingMaterial(s, kind)`
  diz o material que falta (madeira primeiro) para o botão, a prévia e o toast.
- **Evolução das casas** (`materials` em `houses.json`, pago ao subir para o nível): Casa de barro
  5 madeira, Casa de pedra 10 pedra, Casa grande 10 pedra + 5 madeira (terreno e tenda: nada).
  Veja Casas.
- **Corte** (`trees.ts`): cada Lenhador ligado soma a madeira que fez na semana (com a eficiência)
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
  qualquer casa com gente ("O inverno está chegando: guarde comida e lenha. As tendas sofrem mais").
- **Tela:** a madeira do topo fica vermelha com ⚠ quando a lenha não dura ou com frio; toasts "Frio!
  Acabou a lenha: construa um lenhador" e "A lenha voltou: as casas se aquecem"; balão da casa no
  outono e no inverno "Lenha no inverno: N/sem" (com frio, vermelho "Frio: falta lenha"); balão do
  Lenhador/Pedreira cheio "Parado: estoque cheio (400)" no lugar da linha "Rende N" (e "Sem rochas/árvores por
  perto" só quando não há fonte, nunca por falta de trabalhadores); no frio as chaminés param de soltar fumaça;
  casa que cai no frio mostra "Frio -N".

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

## Casas

| Nível | Nome | Cabem | Imposto/sem | Exige |
|---|---|---|---|---|
| 0 | Terreno | 0 | 0 | – |
| 1 | Tenda | 3 | 1,25 | rua |
| 2 | Casa de barro | 4 | 1,75 | rua, praça |
| 3 | Casa de pedra | 6 | 2,5 | rua, praça, mercado |
| 4 | Casa grande | 8 | 3,25 | rua, praça, mercado, parque |

As exigências são serviços com raio (`needs` em `houses.json`): a casa é atendida se alguma
célula dela estiver no raio de uma praça, mercado ou parque **ligado**. O altar e o templo não
fazem parte da evolução (só dão Alegria).

**Moradores são pessoas** (veja Pessoas): `capacity` é quantas cabem; uma casa subir de nível não
traz ninguém, só dá lugar para filhos e parentes. **Uma casa tem nível 1 ou mais exatamente
quando mora alguém nela.** Quando a última pessoa sai, a casa vira terreno (nível 0) e guarda o
nível que tinha (`emptyLevel`; a tenda guarda 0): quem chegar depois entra direto nesse nível.
No mapa, a casa vazia com `emptyLevel` ≥ 2 mostra o desenho desse nível com a porta fechada
e uma tranca, sem gente, bichos, fumaça, varal nem toldo, num tom empoeirado.
O imposto é por casa (com o fator da Alegria), não por pessoa.

**Material ao evoluir** (coluna nova de `houses.json`): Casa de barro **5 madeira**, Casa de pedra
**10 pedra**, Casa grande **10 pedra + 5 madeira**. Cumpridas as `upWeeks` semanas e as exigências, a casa
sobe só se houver o material, e **paga na hora**. Sem material, a contagem fica parada no fim e
a casa guarda `waiting: 'wood' | 'stone'` (o primeiro que falta) até o material chegar; sobe na
semana em que ele chega (a produção entra antes da evolução). Casas prontas na mesma semana pagam
na ordem da lista (a **mais antiga primeiro**). Perder uma exigência zera a contagem e a espera.
Cair de nível não devolve; subir de novo paga de novo. O aviso `material` ("N casas esperando
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

A felicidade (na tela, **Alegria**) só existe **depois que o Parque é liberado** (Objetivo 7, `happinessOn`). Antes disso toda casa fica
contente (50, sem motivos), o imposto e a chance de nascer não mudam, a carinha não aparece na
placa e não há balão de casa triste.

Cada casa com família tem uma felicidade de 0 a 100 (`happiness` em `rules.json`, código em
`src/core/happiness.ts`), calculada toda semana:

| Motivo | Pontos |
|---|---|
| base | 50 |
| no raio do altar ou do templo | +10 |
| no raio de um parque | +20 |
| no raio de uma praça | +5 |
| no raio de um mercado | +5 |
| fome na cidade | −30 |
| desemprego: parte dos trabalhadores sem vaga × 40 | até −20 |

Só contam serviços **conectados**. O valor fica entre 0 e 100.

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
seguintes: uma entre as semanas 52 e 98 (Ano 2, **3 famílias: as duas primeiras sempre casais de noivos
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
  **468 por ano** (`harvest` em `buildings.json`) nas 39 semanas fora do inverno, ou seja
  **12 por semana × eficiência**. **No inverno ele congela** (`harvestsIn`): não dá comida e
  não ocupa trabalhadores (sem lavradores no desenho), que ficam livres para pescador e
  coletora. O desafio é guardar comida para o inverno (estoque e celeiro).
- A prévia mostra "Rende N comida/sem" e "Comida depois: ±X/sem" (veja Interface Nova); no
  inverno, "Congelado no inverno: volta em N sem". O balão do campo diz que ele dá comida na
  primavera, no verão e no outono.
- O campo tem 2 vagas (as do ano todo contam para o desemprego, veja Objetivos). A colheita é anunciada uma vez por
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
- **Objetivo 2.**

## Simulação

A cada semana, nesta ordem (`simulation.ts`):

1. Recalcular rede de ruas, conexões e cobertura (praça, mercado, parque e, para a Alegria,
   altar/templo).
2. Moradores = pessoas que moram em casas. Trabalhadores = os adultos entre elas.
   Vagas = soma das construções conectadas **que estão trabalhando**: o campo só tem vagas fora
   do inverno; no inverno os trabalhadores ficam livres para
   pescador, coletora e o resto (`isWorking`). Eficiência = trabalhadores / vagas, no máximo 100%
   (100% se não houver vagas). A previsão de comida segue essa eficiência semana a semana.
3. Comida += colheita (fora do inverno, com o bônus das oficinas) + pesca + coleta (× 0,3 no
   inverno) − consumo. Cada pessoa come pela idade (veja Pessoas); **no inverno come × 1,6**
   (`winter.foodFactor`) e quem mora em **tenda come × 2** (`winter.tentFoodFactor`). Se a
   comida chega a 0 com saldo negativo: **fome**. A comida nunca fica negativa. Depois, o que
   passa do estoque (100 + celeiros) **estraga**.
4. Prata += impostos (cada casa com o fator da sua felicidade) − manutenção (sempre; o campo paga o
   ano todo). A prata **pode ficar negativa** (dívida). Esse saldo é o "+X/sem" da pílula.
   Madeira += produção dos Lenhadores, pedra += produção das Pedreiras (× eficiência). Depois os
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
estoque), moradores e alegria (a alegria só aparece no gráfico depois de liberar o Parque). As
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
| 1 | Primeiro casamento | marco | +20 | – |
| 2 | Comida até a primavera | comida até a primavera do Ano 1 | +30 | Celeiro |
| 3 | Primeiro nascimento | marco | +30 | Pedreira |
| 4 | Tenha 3 casas de barro | 3 | +40 | Mercado |
| 5 | Receba a primeira caravana | marco | +50 | Oficina |
| 6 | Chegue a 30 moradores | 30 | +50 | – |
| 7 | Tenha 6 casas de pedra | 6 | +60 | Parque (e a Alegria) |
| 8 | Uma criança da cidade virou adulta | marco | +80 | – |
| 9 | Chegue a 45 moradores | 45 | +80 | – |
| 10 | Tenha 4 casas grandes | 4 | +80 | – |
| 11 | Terceira geração | marco | +100 | – |
| 12 | Chegue a 65 moradores | 65 | +100 | – |
| 13 | Chegue a 85 moradores | 85 | +120 | – |
| 14 | Chegue a 100 moradores | 100 | +120 | Templo |
| 15 | Chegue a 125 moradores | 125 | +150 | – |
| 16 | Chegue a 150 moradores | 150 | +175 | – |
| 17 | Chegue a 175 moradores | 175 | +200 | – |
| 18 | Construa o Templo | 1 | vitória | – |

Calibração do Povo com o Pacote 3 (`docs/revisoes/2026-11-05/sim-tester-p3.md`): com estes números
o Comum cumpre os objetivos 5 a 17 nas semanas ~76, 96, 122, 194, 211, 221, 275, 325, 380, 423, 511,
578 e 617 (mediana de 100 partidas), um a cada ~1 a 5 min; vence em ~33 min.

Tipos de objetivo no core: `milestone` (cumpre quando o marco foi alcançado, mesmo antes de o
objetivo chegar), `foodUntilSpring`, `houses`, `residents` e `build`.

- **Objetivo 2** (`foodUntilSpring`): progresso = semanas que a comida dura (pela previsão), até as
  semanas que faltam para a primavera do Ano 1; a pílula mostra a unidade ("12/26 sem"); na
  primavera, sem semanas a contar, a pílula não mostra número. Cumpre quando a previsão chega lá.
  Na primavera, cumpre se a cidade não está com fome; com fome, espera a comida voltar. O alvo
  nunca é 0. Uma cidade sem moradores tem progresso 0, mesmo com uma família a caminho.
- **`fromYear`** (opcional, nenhum objetivo usa agora): o objetivo só se cumpre a partir desse ano
  (`goalOpen`). O Templo libera no Objetivo 14, para o jogador juntar prata e construí-lo antes (a
  pílula do objetivo termina com "· Templo 312/800" e a lista de objetivos com "Junte 800 para o
  Templo: 312/800"; `templeSavings`); a vitória vem quando os objetivos 17 (175 moradores) e 18 (o
  Templo) se cumprem. Um objetivo por semana, menos a vitória: com o Templo já erguido, ela vem na
  mesma semana do Objetivo 17 (`checkGoal`, `TEMPLE_GOAL` = o objetivo antes da vitória). Erguido
  antes (`templeWaitsForGoal`), um toast diz o que falta.
- Objetivos de casas e de construir contam só construções **conectadas** à rede.
- Vitória: tela com o tempo ("N anos e N semanas") e os moradores, e botão "Continuar construindo".

Ao liberar a Oficina aparece também o aviso "Oficina liberada: 3 vagas e +10% de comida dos campos,
até +30%" (números lidos de `buildings.json`); ao liberar o Parque, "Parque liberado: casas de
pedra perto dele viram casas grandes".
O balão da Oficina escolhida diz o total: "+10% de comida dos campos (total 20%, teto 30%)" ("no
teto" quando chega lá) ou, com o teto já alcançado, "Campos já no teto (+30%): esta oficina só dá
vagas".

**Aviso de desemprego:** pessoas sem trabalho = trabalhadores − vagas **do ano todo** (`yearJobs`:
as do campo congelado contam, porque no inverno o agricultor descansa; nunca menos de 0). A
alegria usa a mesma conta. Com a Oficina liberada e 6 ou mais pessoas sem trabalho (`unemploymentAlert` em `rules.json`), entra
nos Avisos: "N pessoas sem trabalho: construa um campo ou uma oficina" (só "construa um campo"
quando as oficinas já dão o bônus inteiro). Some sozinho quando o
número cai abaixo de 6.

## Aparência e moradores

Só aparência: nenhuma regra de economia depende disso. O desenho é o do 3D (`src/render3d`, veja o
README de lá); o último desenho 2D está na tag `ultimo-2d`.

- **Variantes (core):** casas têm 6 variantes por nível e 2 de terreno vazio; campos têm 4
  plantações (trigo, cevada, lentilha, linho); oficinas têm 6 ofícios (Olaria, Ferraria,
  Carpintaria, Tecelagem, Tinturaria, Curtume, em `buildings.json`). A variante e o espelhamento
  são sorteados no core (`rollLook`, com o rng do jogo) ao construir e, nas casas, a cada mudança de
  nível. Construções vizinhas (lado com lado) do mesmo tipo e nível não repetem a variante quando
  há alternativa. O ofício da oficina fica guardado na variante.
- **Casas no 3D:** um modelo por nível (pacote Meshy, `house-1..4`), virado para a rua, com um tom
  um pouco diferente por casa. A variante escolhe o quintal da casa com gente (`yardOf` em
  `plan.ts`): nada, três jarros com um vaso de planta, ou um varal com panos vermelho, claro e azul
  (variante % 3), no canto da frente que o espelhamento escolhe. Isso dá 5 aparências por nível. A
  tenda tem a fogueira na frente à esquerda e por isso põe o quintal sempre à direita. Casa vazia
  que guardou o nível: o desenho desse nível desbotado, sem luz nem fumaça, com o portão trancado
  na porta e sem quintal.
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
    **Moradores**; no PC com rótulo, mais **Alegria** (só depois de liberar o Parque). A Comida
    mostra também "até a primavera" quando a previsão chega à próxima primavera, ou "acaba no <estação>"
    (a estação em que a comida acaba, pela previsão) em vermelho; no celular só aparece quando não
    chega: "⚠ N sem" (semanas até acabar) em vermelho, e o resto fica nas Estatísticas. Na fome,
    **"FOME"** em vermelho piscando no lugar disso. Com o estoque a 75% do limite ou mais, o número
    vira "38/50" (laranja enquanto estraga), e **"cheio"** em laranja só nas semanas em que
    a comida está estragando. Cores de alerta: prata laranja com saldo negativo e
    vermelha piscando em dívida. Tocar numa pílula (ou na estação) abre as
    Estatísticas; nada se constrói sob a barra do topo;
  - pílula **Materiais** entre Comida e Moradores (P3): no celular uma pílula só com o ícone da tora
    e o número da madeira e, depois de liberar a Pedreira, o ícone da pedra e o número (sem
    "+N/sem"); no PC uma pílula por material, "Madeira 20 +1,5/sem" (a Pedra só depois de liberar a
    Pedreira). O número fica **vermelho com "⚠"** enquanto alguma casa espera aquele material. A
    pedra entra com um brilho dourado (3 piscadas) ao ser liberada. Tocar abre as Estatísticas.
    Se a fileira não couber à esquerda da velocidade, as pílulas encurtam por etapas (`MAX_FIT` em
    `TopBar.ts`): primeiro somem os rótulos dos materiais, depois todos os rótulos, depois o "+N/sem"
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
    lista com o texto de cada aviso. Quando entra um aviso novo o botão pulsa e aparece um toast com
    o texto (uma vez por episódio). **Não há faixa de aviso sobre o mapa;**
  - **Estatísticas** (gráfico): prata (impostos, manutenção por tipo, saldo),
    comida (colheita, pesca, coleta, consumo, saldo, estoque/capacidade, previsão), trabalho
    (trabalhadores, vagas, sem trabalho, eficiência), casas por nível, alegria (felizes, contentes,
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
  - Interface HTML (Fase 2), com os mesmos textos e regras da Nova (`game/model/{card,panels,person}.ts`):
    o balão da casa tocada traz os moradores (botões com figura, nome, idade e trabalho; duas
    colunas no celular, uma no PC), filhos, nível, ✓/✗ das necessidades, "Melhorar"/"Onde pôr…",
    Demolir com "Certeza?" e ✕; no celular, a parte do nível vai numa segunda coluna e os botões
    ficam sob os moradores. Tocar num morador abre a **ficha** (parentes que abrem a ficha deles,
    "Voltar"; a casa leva a câmera até ela). O **anel do nível e a pílula do objetivo** abrem
    Objetivos; na lateral, sob os botões de girar, ficam **Avisos** (selo e pulso a cada
    aviso novo, que também vira toast) e **Estatísticas** (Agora, Povo e Histórico; uma família do
    Povo leva até a casa dela). Os painéis e a ficha terminam acima das ferramentas. Escolher uma
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
  - **Engrenagem** (alto à direita): "Dia e noite: ligado/desligado" (desligado = sempre meio-dia;
    fica salvo). Esc fecha.
  - **Tela inicial em HTML**: nome, como jogar, controles, "Começar" (Enter no
    PC) e, depois do tutorial visto, "Rever o tutorial"; "Instalar app" quando dá. O Three.js baixa
    enquanto ela está aberta; o jogo abre com os modelos feitos em código e troca pelos modelos do
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
    botões giram até a próxima das 4 vistas padrão (desfazem um giro livre). Tocar no mapa com um
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
  depois: +N/sem" (saldo da semana com a manutenção, as vagas e a produção da nova construção, na
  eficiência que a cidade teria). Num local de trabalho que
  não dá comida (mercado, oficina, templo…), quando as vagas dele tiram trabalhadores dos que dão
  comida, também "Comida depois: ±X/sem" (`foodAfter`; vermelho se negativo), no celular também.
  Celeiro, mercado e oficina dizem até onde melhoram: "Guarda 300 · melhora até 1000",
  "Alcance 5 · melhora até 7", "+10% nos campos · melhora até +30%".
  Fecha ao trocar de ferramenta ou ao tocar no mapa para construir.
- **Balão da construção tocada** (com Mover), ao lado dela com seta, seguindo a câmera; some ao
  tocar fora:
  - casas: cabeça **"Casa de barro · 3/4 pessoas"** e os **moradores**, um por linha de 44 px
    (figura de criança, adulto ou idoso — a forma diz homem ou mulher —, "Natã, 22" e embaixo a
    profissão em 12 px: o trabalho do adulto por `jobsOf`, "Sem trabalho" em laranja, "criança",
    "idoso/idosa", "A caminho"); **celular: duas colunas**, **PC: uma**. Tocar num morador abre a
    **ficha da pessoa**. Linha dos filhos (`houseBirths`, só com um casal que pode ter filhos):
    "✓ Pode ter filhos" ou "✗ Sem filhos: fome / casa cheia / a comida não dura até a primavera /
    o estoque é pequeno. Construa um celeiro". Depois o nível: "nível atual → próximo" (celular:
    "Próximo nível: Casa de pedra"), imposto (só PC), alegria com os motivos, uma linha com o que
    já tem ("✓ Rua") e outra com o que falta ("✗ Praça, Mercado"; um serviço bloqueado diz "(libera
    no objetivo 4)"), "Casa de pedra em N sem" e os ganhos ao evoluir (`upgradeGain`; PC num quadro
    "Ao evoluir", celular numa linha); se a evolução pede material, "Ao evoluir: pede 10 de pedra"
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
    ("Nível 2: guarda 600 · 2/sem (hoje 300 · 1/sem)"; mercado "alcance", oficina "+20% nos
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
  - toasts: no máximo 3 na tela; os outros esperam em fila (os vermelhos na frente) e nenhum se
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
    comida/sem" (com a eficiência que a cidade terá com as vagas dela) e "Comida depois: ±X/sem"
    (o saldo de comida da cidade com ela; a pílula fica vermelha se negativo); campo no inverno:
    "Congelado no inverno: volta em N sem". Lenhador e Pedreira: "Rende N madeira/sem" (ou pedra),
    no Lenhador "Corta 1 árvore a cada N sem" e, quando o raio pega árvores de uma Coletora,
    "Divide o bosque com a Coletora" (`sharedTrees`); a Coletora diz "Divide o bosque com o
    Lenhador". "Comida depois" só aparece no Lenhador e na Pedreira quando as vagas deles baixam a
    comida. Fora da rua ligada, a prévia de qualquer um deles diz "Sem rua ao lado: não rende nada"
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
  - a tela de vitória tem a linha "N nascimentos · N casamentos" (contados pela cena na partida);
  - os avisos de casais e de nascimentos ("Casal esperando casa", "Sem nascimentos: …") não viram
    toast enquanto o tutorial roda (o balão do tutorial já fala do casal).
- **Tamanhos de teste:** 844 x 390, 915 x 412 e 1366 x 768.

### Mapa e mensagens

- **Balões** sobre construções com o primeiro problema, nesta ordem: sem rua; depois, em locais de
  trabalho com eficiência 0, "sem trabalhadores" (trabalhador riscado); pescador "longe do rio" e
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
  pelas praças (onde a tenda pode virar casa de barro). O Templo mostra as 6 x 6 células
  e contorna até `maxTempleSpots` (6, em `visual.json`) áreas onde cabe, sem sobrepor, as mais
  perto do altar (`templeSpotsNear` no core, recalculado ao escolher e a cada atualização, nunca
  por quadro): **verde** se já encosta na rede, **amarela** se um 6 x 6 livre fica a no máximo
  `templeSpotRoadGap` (1, em `rules.json`) célula livre da rede. Sem nenhuma dessas, marca em
  amarelo o 6 x 6 livre que a rua mais curta alcança (`templeRoadSpot`; empate: o mais perto do
  altar) e desenha essa rua em dourado, como a do tutorial. Ao escolher o Templo a câmera desliza
  até a primeira área. Sem área verde, toast "Sem lugar pronto: puxe uma rua ligada ao altar até
  uma área amarela"; sem nenhuma, "Sem espaço para o Templo: abra uma rua ao lado de um terreno
  livre 6 x 6".
- **Toasts** (mensagens curtas no centro de baixo, acima das ferramentas, empilhando para cima):
  prata insuficiente, cidade em dívida (ao tentar construir), entrou/saiu da dívida, local
  inválido, templo sem rua, rua não ligada ao altar, altar/templo protegidos, objetivo cumprido,
  "Oficina liberada: …", "Falta comida: construa pescador ou coletora" (uma vez por episódio de
  fome), a frase da caravana, os marcos, o primeiro texto de cada aviso (o de comida curta só se
  começar no verão) e a chegada de cada estação ("Chegou o verão: dias quentes e secos";
  inverno: "Inverno: só pescador e coletora dão comida").
- Durante a fome, leve tom avermelhado sobre o mapa.
- Tela inicial com 3 passos numerados ("Guarde comida para o inverno: pesque, colete e plante campos.";
  "Tendas perto de uma praça viram casas de barro. Sem celeiro, só cabem 50 de comida."; objetivos, Templo e não
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
  coletora, o lugar livre de campo ligado mais perto do altar (`fieldHint`), o lugar da praça junto
  às tendas (`campPlazaSpot`), o terreno da casa) e o deixa no **meio do mapa livre**: abaixo da
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
  4. "Construa uma praça perto das tendas da caravana": a prévia mostra o raio e "Atende N casas";
     no lugar `campPlazaSpot` ela alcança todas as tendas. Conclui com 1 praça ligada.
  5. "Natã e Débora querem se casar: construa uma casa perto da praça" (os nomes do casal da
     caravana, `start.couple`): os terrenos livres perto de uma praça
     (alguma célula no raio de uma praça ligada, `plazaHouseSpots`) e encostados na rede ficam
     verdes, e a seta aponta o mais perto do altar (`houseHint`). Conclui com 1 casa nova ligada.
  6. "Natã e Débora vão para a casa nova!": os noivos da caravana (`start.couple`) andam até a casa
     vazia e casam ao chegar. Conclui com o marco Primeiro casamento; aparece "Muito bem! Casais
     novos precisam de casa; casas melhores cabem mais filhos". O passo também termina sozinho
     depois de `weddingStepMaxWeeks` (6) semanas (por exemplo, sem casa vazia), com o mesmo toast.
  7. Mini passo do Lenhador, logo depois do 6 (casamento) (o último de `steps` em `tutorial.json`; o relógio
     para, como nos passos de construir): "Casas pedem madeira: construa um lenhador perto das
     árvores". O lugar é `lumberSpot`, a mesma busca de `foodSpot` (maior rendimento, depois rua
     mais curta) para o Lenhador. Conclui com 1 lenhador ligado. A câmera vai até o lugar. Se o
     lugar precisa de rua, a rua dele aparece marcada (como no passo 1), o balão diz "Casas pedem
     madeira: puxe a rua marcada e ponha um lenhador no fim" e a seta aponta Rua e depois a
     rua marcada; com a rua pronta, a seta aponta o Lenhador e depois o lugar. A prévia diz "Rende
     N madeira/sem" e "Corta 1 árvore a cada N sem". "Muito bem! Casais novos precisam de casa…" vem depois
     dele.
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
  Os períodos de clima duram 6–12 s e são sorteados de novo quando a estação muda ou quando a neve
  ou a seca começam ou acabam (o clima nunca passa para a estação errada).
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
  (`crowd` em `look3d.json`).
- **Quem anda na rua é gente da cidade** (`castWalkers` em `crowd.ts`): cada morador andando é um
  morador de verdade, cada um uma vez só, vestido como ele mesmo. O tipo de ofício é feito por quem
  trabalha ali (o lavrador por quem trabalha num campo, o artesão por quem trabalha na oficina, e
  ele leva o produto dessa oficina). Nos outros tipos vai alguém da idade certa, e a aguadeira e a
  cesteira são mulheres. Numa cidade com menos moradores que andarilhos, os que sobram são de fora.
  Com Mover, **tocar ou clicar numa pessoa na rua abre a ficha dela** (26 px de alcance no toque,
  16 no mouse); fora disso, o toque abre o balão do que está no mapa.
- **Famílias e caravanas** andam em grupo da entrada até a casa (veja "Aparência e moradores").
- **Agricultores** curvados sobre as plantações, alguns por campo e mais no arado e na colheita
  (`crowd.fieldHands`); nenhum em campo sem rua.
- **Dia e noite** (só visual): 240 s a 1x, seguindo o tempo do jogo (para na pausa), com a luz do
  sol, o céu, a neblina e as sombras. Em velocidades altas a luz balança perto do meio-dia em vez de
  piscar. À noite acendem as janelas das casas de pedra e das grandes, as fogueiras das tendas, os
  braseiros em algumas esquinas das ruas principais, o fogo do altar e o forno da oficina (chama,
  halo e uma poça de luz no chão), e aparecem estrelas e a lua. Desligado na engrenagem: sempre
  meio-dia.
- **Fumaça** nas casas de barro ou melhores, nas tendas (fogueira), na oficina e no altar; casa
  vazia não solta fumaça.
- **Ruas que evoluem** (só visual, `src/render3d/roads.ts`): a rua mostra quanta gente passa por
  ela. Cada construção manda o seu povo até o altar pelo caminho de rua mais curto: a casa manda os
  seus moradores, o local de trabalho as suas vagas e os outros serviços 2. Com menos de 6 pessoas
  passando, a rua é uma **trilha** estreita de terra batida no meio da célula, ligada às ruas ao
  lado. A partir de 6 vira uma **rua** inteira de terra. A partir de 30 ganha **borda de pedra** nos
  lados sem rua (`look3d.json` > `roads`). Ruas a até 2 células do altar ou do templo são pelo menos
  rua. Na neve as ruas ficam limpas.
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
- **Ruas:** terra batida, gasta e calçada (veja "Vida na cidade"); poças na chuva.
- **Árvores:** oliveiras, palmeiras, amendoeiras e figueiras pela estação; toco com muda quando
  volta a crescer (`regrowth`).
- **Gente** low-poly instanciada (túnica, cabeça, turbante ou manto) em 3 tons de pele, com cores da
  época (`crowd.ts`); jumento de carga nas caravanas.

## Fora do escopo por enquanto

- **Deploy:** o workflow do GitHub Pages existe (`.github/workflows/deploy.yml`), mas o `base` do
  Vite continua `'./'`. A mudança para `/jerusalem-antiga/` foi adiada a pedido.
- **Tela cheia em celulares compridos:** o jogo mantém 1280 x 720 (16:9), então sobram faixas nas
  laterais. Ocupar a tela inteira exigiria refazer o layout da interface.

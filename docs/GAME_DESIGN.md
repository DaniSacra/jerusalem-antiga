# Jerusalém Antiga — Design do jogo

Construtor de cidade de **sobrevivência** simples, isométrico, para celular (tela deitada) e PC.
A tensão vem de comida, água, abrigo e pessoas; a prata é o meio de construir. O tempo passa em
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
  - **rochas** (35 a 65, sorteado): não constrói e não pode ser removida;
  - **oliveiras** (45 a 75) e **palmeiras** (35 a 65), sorteadas: bloqueiam, mas podem ser
    cortadas com Demolir (5 prata);
  - **bosque denso obrigatório:** todo mapa tem pelo menos um (`denseGrove.min` 1) com 18 ou mais
    árvores num quadrado de raio 3 (7 x 7), com o centro a 11–20 células da borda do altar, todo
    fora da área livre e do lado do rio onde fica a cidade (na prática o centro fica a 13–19, porque
    o quadrado inteiro precisa ficar fora das 9 células livres e dentro do mapa). Ele prepara a
    coleta de madeira de um pacote futuro; hoje serve à Coletora;
  - o resto das rochas, oliveiras e palmeiras vem em **grupos** (rochas de 4 a 9, oliveiras de 7
    a 14, palmeiras de 6 a 12), cada grupo novo começando a 5+ células de qualquer outro, com
    clareiras entre eles (`CLUMPS` em `map.ts`; forma do terreno, não equilíbrio).
- Ficam livres de rochas e árvores: tudo a até 9 células da borda do altar (as tendas da caravana
  ficam dentro disso) e uma faixa de 5 células (a rua inicial e 2 de cada lado) até a entrada.
  Sempre existe lugar livre para o Templo 6 x 6 fora da área do altar (os testes pedem 3 ou mais
  posições a até 12 células do altar, ligadas à rua, sem cortar árvores).

## Início

- **Altar** fixo, 4 x 4, ocupando x e y de 22 a 25, raio 3. Não está na barra de ferramentas e não
  pode ser demolido.
- **Ruas iniciais** de terra, de graça: um **anel** de 1 célula em volta do altar (contorno de
  x e y de 21 a 26, 20 células) e a rua na coluna x = 24, do anel (y = 26) até a borda sul. A
  célula onde ela toca a borda (24,47) é a **entrada da cidade**. São ruas comuns: Limpar pode
  removê-las.
- As junções das ruas são desenhadas só com ruas vizinhas; o altar não conta, então o anel aparece
  como um contorno com cantos e um T onde a rua sul encontra o anel.
- O jogo começa na **semana 1 do outono do Ano 1**. Prata **180** (cerca de 6 construções).
- **Caravana** (sorteada pela semente, `caravan` em `rules.json`): **2 a 4 famílias** já moram em
  tendas (casas comuns de nível 1, de graça) num **bloco compacto 2 x 2 ao norte do anel**, dos
  dois lados de uma rua curta (`campRoad`, 4 células) que sai do anel; a fila encostada no anel
  enche primeiro. Ao lado, a leste, fica um lugar 2 x 2 livre (`campWellSpot`) onde **um poço
  alcança todas as tendas**. A comida inicial vale
  **14 a 22 semanas** do consumo delas, cortada no limite sem celeiro (50). Uma frase na abertura
  mostra os números reais: "A caravana chegou com 3 famílias e comida para 14 semanas".
- Nenhuma abertura é sempre a melhor: mais famílias dão mais imposto e trabalhadores, mas comem
  mais; rio perto barateia o Pescador; bosque perto favorece a Coletora; rochas tiram espaço.
- Liberados: Mover, Rua, Casa, Campo, Poço, Pescador, Coletora e Demolir.

## Construções

| Construção | Custo | Manutenção | Tamanho | Vagas | Produção | Raio | Observações |
|---|---|---|---|---|---|---|---|
| Rua | 2 / célula | – | 1 x 1 | – | – | – | arrastar constrói em sequência |
| Casa | 15 | – | 2 x 2 | – | impostos | – | começa como terreno vazio |
| Campo | 20 | 1/sem | 2 x 2 | 2 | 468 comida/ano fora do inverno (12/sem) e 1 prata/sem | – | 4 plantações (só aparência); ver Colheita |
| Poço | 25 | 3/sem | 2 x 2 | – | – | 4 | |
| Pescador | 20 | 1/sem | 2 x 2 | 1 | células de rio no raio × 0,75, máx. 4,5 comida/sem | 2 | o ano todo |
| Coletora | 20 | 1/sem | 2 x 2 | 1 | árvores no raio × 0,3, máx. 4,5 comida/sem | 3 | o ano todo |
| Celeiro | 40 | 2/sem | 3 x 3 | 1 | guarda 150 de comida | – | liberado pelo Objetivo 3 |
| Mercado | 60 | 4/sem | 2 x 4 | 3 | – | 5 | liberado pelo Objetivo 5; pode girar para 4 x 2 |
| Oficina | 50 | 2/sem | 3 x 3 | 3 | 5 prata/sem | – | liberada pelo Objetivo 6; 6 ofícios (só aparência) |
| Jardim | 35 | 1/sem | 2 x 2 | – | – | 3 | liberado pelo Objetivo 7; deixa as casas no raio mais felizes |
| Templo | 800 | 10/sem | 6 x 6 | 2 | – | 12 | liberado pelo Objetivo 10; não pode ser demolido |
| Altar | – | – | 4 x 4 | – | – | 3 | fixo no início |

- **Pescador e Coletora** (`gather` em `buildings.json`, uma regra só): produção por semana =
  mín(`max`, células do recurso no raio × `perCell`) × eficiência. Recurso: rio (Pescador) ou
  árvore (Coletora; oliveira, amendoeira, figueira e palmeira contam). Podem ser construídos em
  qualquer lugar; rendendo 0 mostram o balão "longe do rio" ou "sem árvores". A prévia mostra
  "Rende N comida/sem". Cortar árvores baixa a Coletora. Dois no mesmo recurso contam as mesmas
  células.
- **Celeiro:** a cidade guarda **50** de comida sem celeiro (`baseFoodStorage`); cada celeiro
  **ligado** soma 150 (`storage`). A capacidade não depende da vaga preenchida. Comida acima do
  limite **estraga** no fim da semana, com o aviso "Comida estragando: construa um celeiro".
- **Manutenção** (`upkeep` em `buildings.json`) só começa **depois do Objetivo 3** (a primeira colheita)
  (`upkeepStartsAfterGoal` em `rules.json`). Antes disso nada é cobrado: o "+X/sem" não a desconta
  e não há aviso de saldo nem dívida por ela; os balões dizem "manutenção N/sem depois do
  Objetivo 3". Ao cumprir o Objetivo 3 aparece, uma vez, "A partir de agora, as construções custam
  prata por semana. Fique de olho no saldo." (passo do tutorial ou toast).
  A partir daí é cobrada toda semana de toda construção, **mesmo desconectada**, e também depois da
  vitória.

- Tamanho é largura (x) por altura (y) em células. O **Mercado** é o único que gira: tocar de novo
  no botão Mercado (ou a tecla R no PC) alterna entre 2 x 4 e 4 x 2; a escolha vale para as
  próximas colocações.

- O raio é **quadrado**: cobre toda célula a até N colunas e N linhas de distância. Em construções
  maiores, mede a partir de qualquer célula da construção. Uma construção é atendida se
  **qualquer** célula da sua área estiver no raio.
- Demolir remove construções e ruas sem reembolso (exceto altar e templo) e corta árvores por 5 prata.

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
  - poços, mercados e templo não dão cobertura;
  - aparece um balão "sem rua" (rua partida riscada).
- Ruas fora da rede aparecem apagadas e tracejadas. Ao terminar de construir (toque ou arraste)
  uma rua que ficou fora da rede, aparece "Esta rua não está ligada ao altar".
- Construir longe da rua é permitido (o jogador aprende pelo balão). **Exceção:** o Templo só pode
  ser colocado encostado numa rua conectada.
- Casas desconectadas continuam contando moradores e impostos até regredirem.

## Casas

| Nível | Nome | Moradores | Imposto/sem | Exige |
|---|---|---|---|---|
| 0 | Terreno | 0 | 0 | – |
| 1 | Tenda | 3 | 1 | rua |
| 2 | Casa de barro | 6 | 2 | rua, poço |
| 3 | Casa de pedra | 10 | 3,5 | rua, poço, mercado |
| 4 | Casa grande | 16 | 6 | rua, poço, mercado, raio do altar **ou** do templo |

## Felicidade

A felicidade (na tela, **Alegria**) só existe **depois que o Jardim é liberado** (Objetivo 7). Antes disso toda casa fica
contente (50, sem motivos), o imposto e a chance de família não mudam, a carinha não aparece na
placa e não há balão de casa triste.

Cada casa com família tem uma felicidade de 0 a 100 (`happiness` em `rules.json`, código em
`src/core/happiness.ts`), calculada toda semana:

| Motivo | Pontos |
|---|---|
| base | 50 |
| no raio do altar ou do templo | +10 |
| no raio de um jardim | +20 |
| no raio de um poço | +5 |
| no raio de um mercado | +5 |
| fome na cidade | −30 |
| desemprego: parte dos trabalhadores sem vaga × 40 | até −20 |

Só contam serviços **conectados**. O valor fica entre 0 e 100.

- **Humor:** feliz com 65 ou mais; triste abaixo de 35; contente no meio.
- **Imposto:** contente paga o imposto normal; feliz paga mais, subindo em linha reta até
  +20% com 100; triste paga menos, até −20% com 0.
- **Famílias:** a felicidade da cidade é a média das casas com família (50 sem nenhuma). Ela
  multiplica a chance de chegar família do mesmo jeito: 1 enquanto contente, até 1,5x feliz e
  até 0,5x triste.
- Casa triste **não** é abandonada nem cai de nível por isso (por enquanto só paga menos e atrai
  menos famílias).
- A oficina ainda não incomoda as casas vizinhas (fica para depois, a pedido).

## Famílias

- **Porta das famílias:** uma família nova só é enviada quando **as duas** condições valem:
  1. **água:** todas as casas ligadas **com família** estão no raio de um poço ligado (terrenos
     vazios não contam);
  2. **comida:** a previsão (veja Previsão de comida) diz que a comida dura até a próxima
     primavera, contando cada casa no nível que ela vai alcançar, **1 tenda por família a
     caminho** e mais 1 tenda para a família nova.
- **Cidade vazia nunca trava:** com 0 moradores e nenhuma família a caminho, a porta ignora água
  e comida (o intervalo e a chance continuam valendo).
- A porta é conferida **depois** de a semana avançar (`dispatchFamilies` e `moveFamilies` rodam
  depois de `s.week++`), na mesma semana que a tela mostra.
- Com a porta aberta, um terreno vazio conectado e sem família a caminho, e pelo menos
  **2 semanas** desde a última família enviada (`familyIntervalWeeks`), chega uma família com
  chance **0,6 por semana** (`familyChance`, vezes o fator da alegria). No máximo uma por vez.
  Não há mais famílias garantidas: a caravana é o começo.
- **Quando ninguém vem**, o aviso diz o motivo, nesta ordem: "Nenhuma família vem: casa longe do
  poço. Construa outro poço", "Nenhuma família vem: a comida não dura até a primavera. Pesque ou
  colete", "Nenhuma família vem: o estoque só guarda N. O celeiro libera no objetivo 3" (ou
  "Construa o celeiro"; motivo `storage`: a comida chegaria, mas o estoque corta), "Nenhuma
  família vem: não há casa vazia. Construa uma ao lado da rua" (sem terreno livre ligado). Com
  fome: "Nenhuma família vem: falta comida. Pesque ou colete". Durante o tutorial o motivo aparece
  no balão do tutorial, sem toast.
- A família sai da **entrada da cidade** e anda pelas ruas (caminho por busca em largura) até a
  casa, **6 células por semana** (`familyCellsPerWeek`). Ao chegar, o terreno vira tenda.
- Se a rua do caminho for cortada, a família recalcula a rota; se não houver rota, ou a casa for
  demolida ou desconectada, a família desiste.
- Se a entrada for desligada da rede, as famílias passam a sair do altar (para a cidade nunca
  travar sem explicação).

## Tempo

- **1 passo = 1 semana** (2,5 s em 1x, `weekSeconds`). **13 semanas por estação**
  (`weeksPerSeason`), 52 por ano. No código o passo se chama `week` (`weeksToChange`,
  `debtWeeksToLose`, `familyCellsPerWeek`…).
- O jogo começa no **outono**, e o **ano começa no outono** (ano agrícola): Ano N = outono,
  inverno, primavera e verão. Ano = semana ÷ 52 + 1 (para baixo); semana na estação de 1 a 13.

## Colheita

- O campo dá comida **na primavera, no verão e no outono**, desde a semana em que é construído:
  **468 por ano** (`harvest` em `buildings.json`) nas 39 semanas fora do inverno, ou seja
  **12 por semana × eficiência**. **No inverno ele congela** (`harvestsIn`): não dá comida nem
  prata e não ocupa trabalhadores (sem lavradores no desenho), que ficam livres para pescador e
  coletora. O desafio é guardar comida para o inverno (estoque e celeiro).
- A prévia mostra "Rende N comida/sem" e "Comida depois: ±X/sem" (veja Interface Nova); no
  inverno, "Congelado no inverno: volta em N sem". O balão do campo diz que ele dá comida na
  primavera, no verão e no outono.
- O campo tem 2 vagas e dá 1 prata por semana fora do inverno. A colheita é anunciada uma vez por
  ano, na primeira semana da primavera.
- **Seca:** cada ano é seco ou não, sorteado pela semente do mapa (`drought` em `rules.json`):
  chance **25%**, nunca no Ano 1, nunca dois anos seguidos. Num ano seco a colheita é **× 0,4**,
  exceto nos campos **encostados no rio** (alguma célula vizinha, lado com lado, é rio), que colhem
  normal. A seca é anunciada na **semana 1 do inverno**: "As chuvas estão fracas este ano".

## Previsão de comida

Uma função pura (`foodForecast`), calculada uma vez por atualização da tela (junto com a
economia, em `readCity`) e repassada à barra, aos painéis, aos avisos, ao inspetor e à cena,
simula semana a semana a partir de agora: o consumo com **cada casa no nível que vai alcançar com
os serviços de hoje** (`targetLevel`: um poço novo já mostra as casas de barro que vêm, comendo e
trabalhando mais), pesca e coleta, os campos (com a seca, se já anunciada) e o limite do estoque
(o que passa estraga). Ela responde em quantas semanas a comida
acaba e se chega ao **começo da próxima colheita** (a próxima semana 1 da primavera; durante a
primavera, a do ano seguinte, contando o que ainda vai ser colhido). Usada por:

- **porta das famílias** (veja Famílias);
- **pílula de comida:** "até a primavera" quando chega; senão "até o <estação>" (a estação em que
  acaba);
- **aviso** "A comida não dura até a primavera: pesque, colete ou plante campos" (em qualquer
  estação, na lista de Avisos enquanto valer; toast só se começar no verão);
- **Objetivo 1.**

## Simulação

A cada semana, nesta ordem (`simulation.ts`):

1. Recalcular rede de ruas, conexões e cobertura (poço, mercado, altar/templo).
2. Moradores = soma das casas. Trabalhadores = 50% dos moradores (para baixo; `workerShare`).
   Vagas = soma das construções conectadas **que estão trabalhando**: o campo só tem vagas (e só
   dá a prata dele) fora do inverno; no inverno os trabalhadores ficam livres para
   pescador, coletora e o resto (`isWorking`). Eficiência = trabalhadores / vagas, no máximo 100%
   (100% se não houver vagas). A previsão de comida segue essa eficiência semana a semana.
3. Comida += colheita (só na primavera) + pesca + coleta − consumo. Cada morador come conforme o
   nível da casa (`food` em `houses.json`): tenda 0,2, barro 0,15, pedra 0,2, casa grande 0,22. Se a
   comida chega a 0 com saldo negativo: **fome**. A comida nunca fica negativa. Depois, o que
   passa do estoque (50 + celeiros) **estraga**.
4. Prata += impostos (cada casa com o fator da sua felicidade) + (oficinas × 5 + campos × 1) ×
   eficiência − manutenção (só depois do Objetivo 3; o campo paga manutenção o ano todo). A prata **pode ficar negativa** (dívida).
   Esse saldo é o "+X/sem" da pílula.
5. Novas famílias (veja Famílias); depois todas andam (as novas já na mesma semana), e as que
   chegam transformam o terreno em tenda.
6. Para cada casa de nível 1 ou mais:
   - se falta uma exigência do nível atual: após 3 semanas seguidas, cai um nível;
   - com fome: não evolui; casas acima de tenda têm 12% de chance de cair um nível (nunca vão
     embora); cada tenda tem **20%** de chance (`famineLeaveChance`) de ser **abandonada**, e
     **35% no inverno** (`winterFamineLeaveChance`): vira terreno vazio e a família vai embora
     andando até a entrada (só aparência);
   - se tem as exigências do próximo nível: após 3 semanas seguidas, sobe de nível.
7. Guardar a maior população (`peakPopulation`), o histórico, os marcos e verificar o objetivo
   atual.
8. **Dívida:** se a prata terminou a semana negativa, conta mais uma semana em dívida; com prata
   ≥ 0 a contagem zera. Após **24 semanas seguidas** (`debtWeeksToLose`), derrota.

## Marcos

Momentos curtos, sem pausar: brilho na construção ou casa ligada ao marco, moradores próximos se
reúnem ali por alguns segundos e um toast com 1 frase. Cada um acontece uma vez por partida e fica
na lista das Estatísticas com o ano e a semana.

| Marco | Quando |
|---|---|
| Primeira família | a primeira família nova (não da caravana) chega à casa |
| Primeira casa de barro | a primeira casa chega ao nível 2 |
| Primeira colheita | a primeira semana em que algum campo colhe mais que 0 |
| Primeiro inverno vencido | o primeiro inverno que termina (semana 1 da primavera) sem nenhuma casa abandonada ou caída por fome durante ele |
| Primeira casa de pedra | a primeira casa chega ao nível 3 |
| Primeiro ano sem fome | o primeiro ano inteiro (outono a verão, 52 semanas) sem nenhuma semana de fome |

## Histórico

O core guarda as últimas **52 semanas** (`historyWeeks`) de: prata, comida (com a capacidade do
estoque), moradores e alegria (a alegria só aparece no gráfico depois de liberar o Jardim). As
Estatísticas mostram um gráfico simples de linha para cada uma.

Velocidades: 1x, 3x e Pausa. O jogo pausa enquanto a tela de vitória ou de derrota está aberta.

## Dívida e derrota

- Com prata negativa nada pode ser construído nem cortado ("Em dívida: não dá para construir"); demolir continua grátis.
- Ao entrar em dívida: toast "Cidade em dívida: toque na prata" e, se
  estiver em 3x, a velocidade cai para 1x. Ao sair: toast "A cidade saiu da dívida!".
- Derrota: tela "Jerusalém foi abandonada" com o tempo jogado ("N anos e N semanas") e a maior
  população alcançada, e o botão "Tentar de novo" (novo mapa, nova semente). Depois da derrota a
  simulação para.
- **Avisos** (`alerts()` no core), no botão Avisos e na lista de problemas das Estatísticas (PC),
  nesta ordem: dívida ("Em dívida: N semanas para a cidade ser abandonada. Reduza a manutenção"; com fome ao
  mesmo tempo: "Dívida e fome: demolir serviços corta a manutenção · N semanas"); fome; "A comida
  não dura até a primavera…" (qualquer estação); "Comida estragando: construa um celeiro" (com o
  celeiro ainda bloqueado: "Estoque cheio (50): o excesso estraga. O celeiro libera no objetivo
  3"); "O inverno está chegando: com fome, famílias vão embora. Guarde comida" (nas últimas 3
  semanas do outono, `winterWarningWeeks`, se houver tendas); "Ano seco: campos longe do rio
  colhem 40%. Construa pescador ou coletora" (do inverno ao fim da primavera de um ano seco);
  "Nenhuma família vem: …"; saldo negativo ("Saldo −X/sem · maior custo: Tipo (N/sem) ·
  use Demolir em serviços que atendem poucas casas"); desemprego.

## Objetivos (em sequência)

| # | Texto | Alvo | Prêmio | Libera |
|---|---|---|---|---|
| 1 | Comida até a primavera | comida até a primavera do Ano 1 | +20 | – |
| 2 | Água para todas as casas | todas as casas com família no raio de um poço ligado, com 4 ou mais | +30 | – |
| 3 | Primeira colheita | 12 de comida colhida (acumulada) | +30 | Celeiro (e a manutenção começa) |
| 4 | Construa o celeiro | 1 celeiro ligado | +40 | – |
| 5 | Tenha 6 casas de barro | 6 | +40 | Mercado |
| 6 | Chegue a 50 moradores | 50 | +50 | Oficina |
| 7 | O povo precisa de trabalho: construa 2 oficinas | 2 | +50 | Jardim |
| 8 | Tenha 6 casas de pedra | 6 | +80 | – |
| 9 | Chegue a 150 moradores | 150 | +120 | – |
| 10 | Tenha 4 casas grandes | 4 | +150 | Templo |
| 11 | Construa o Templo | 1 | vitória | – |

- **Objetivo 1** (`foodUntilSpring`): progresso = semanas que a comida dura (pela previsão, com as
  casas no nível alvo), até as semanas que faltam para a primavera do Ano 1; a pílula mostra a
  unidade ("12/26 sem"). Cumpre quando a previsão chega lá (uma caravana que vai passar fome não
  cumpre na semana 1). Na primavera, cumpre se a cidade não está com fome; com fome, espera a
  comida voltar. O alvo nunca é 0.
- **Objetivo 2** (`water`): progresso = casas ligadas **com família** no raio de um poço ligado;
  alvo = máx(4, casas ligadas com família). Terrenos vazios não contam.
- **Objetivo 3** (`harvest`): conta a comida colhida desde o começo da partida, mesmo antes de
  ele ser o atual.
- Objetivos de casas e de construir contam só construções **conectadas** à rede.
- Vitória: tela com o tempo ("N anos e N semanas") e os moradores, e botão "Continuar construindo".

Ao liberar a Oficina aparece também o aviso "Oficina liberada: 3 vagas e 5 prata por semana" (números
lidos de `buildings.json`); ao liberar o Jardim, "Jardim liberado: casas felizes pagam mais imposto
e atraem famílias".

**Aviso de desemprego:** pessoas sem trabalho = trabalhadores − vagas (nunca menos de 0). Com a
Oficina liberada e 6 ou mais pessoas sem trabalho (`unemploymentAlert` em `rules.json`), entra
nos Avisos: "N pessoas sem trabalho: construa uma oficina ou um campo". Some sozinho quando o
número cai abaixo de 6.

## Aparência e moradores

Só aparência: nenhuma regra de economia depende disso.

- **Variantes:** casas têm 6 desenhos por nível (tenda, barro, pedra, casa grande) e 2 de terreno
  vazio; campos têm 4 plantações (trigo, cevada, lentilha, linho); oficinas têm 6 ofícios
  (Olaria, Ferraria, Carpintaria, Tecelagem, Tinturaria, Curtume, em `buildings.json`). A
  variante e o espelhamento são sorteados no core (`rollLook`, com o rng do jogo) ao construir e,
  nas casas, a cada mudança de nível. Construções vizinhas (lado com lado) do mesmo tipo e nível
  não repetem a variante quando há alternativa. O ofício da oficina fica guardado na variante.
- Casas ganham ainda um pequeno deslocamento e um tom de barro/pedra diferente (só no desenho).
- **Moradores andando** (`walkers.json`): aguadeira → poço, agricultor → campo, cesteira →
  mercado, carregador campo → mercado e volta, artesão → oficina, idoso (lento) → altar,
  criança (rápida) → qualquer lugar, homem com jumento → ruas principais, pastor com ovelha →
  borda da cidade, sacerdote de branco → altar ou templo. Cada tipo tem velocidade própria e
  chance de parar 1–2 s ao chegar. Um tipo só aparece quando a construção dele existe e está
  ligada; sem destino do tipo, vai a uma construção qualquer. O artesão carrega um objeto do
  ofício da oficina para onde vai (jarro, martelo, tábua, rolo de tecido, pano tingido ou couro).
- **Gente da comida** (só desenho, `src/render/Haulers.ts`, números em `visual.json` > `haulers`):
  na colheita, de cada campo que colhe (até 8) sai um carregador com saco nas costas pelas ruas
  até o celeiro ligado mais perto (ao altar quando não há celeiro) e volta de mãos vazias; o ano
  todo, o pescador sai da cabana com a rede no ombro e o cesto até a margem do rio mais perto e
  fica ali alguns segundos, e a coletora, com um cesto de frutos na cabeça, vai até a árvore mais
  perto no raio e colhe. Pescador e coletora sem rio ou árvore no raio não saem.

Ferramentas bloqueadas aparecem com cadeado.

## Interface

Há uma interface só, a **Nova** (Versão D). A Clássica saiu em 2026-11-03 (com a opção
"Interface" das Configurações, a chave `jerusalem.ui`, que passa a ser ignorada, e os cenários
visuais dela).

**Palavras na tela:** o passo do jogo é a **semana** ("por semana", "/sem"); a meta se chama
**Objetivo**; a felicidade, **Alegria**; a ferramenta Ver, **Mover**; Limpar, **Demolir**. No
código continuam `goal` e `happiness`; o passo passou a ser `week`.

### Interface Nova

- **Abertura:** ao começar, um toast maior (ou balão central que some sozinho em 5 s) com a frase
  da caravana: "A caravana chegou com N famílias e comida para N semanas".

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
    **Moradores**; no PC com rótulo, mais **Alegria** (só depois de liberar o Jardim). A Comida
    mostra também "até a primavera" quando a previsão chega à próxima primavera, ou "até o <estação>"
    (a estação em que a comida acaba, pela previsão) em vermelho; no celular só aparece quando não
    chega: "⚠ N sem" (semanas até acabar) em vermelho, e o resto fica nas Estatísticas. Na fome,
    **"FOME"** em vermelho piscando no lugar disso. Com o estoque a 75% do limite ou mais, o número
    vira "38/50" (laranja enquanto estraga), e se a comida ainda sobe aparece **"cheio"** em
    laranja (o que passar vai estragar). Cores de alerta: prata laranja com saldo negativo e
    vermelha piscando em dívida. Tocar numa pílula abre as
    Estatísticas;
  - pílula do objetivo: "Objetivo" + texto + "3/5"; no PC "Objetivo 3 de 11", texto, barra e "3/5".
    Tocar abre a lista de Objetivos.
- **Topo direito:** pílula "Outono · Ano 1 · Semana 5 · inverno em 9 sem" (semana 1–13; ícone da
  estação; num ano seco anunciado, o ícone da seca no lugar e "· Seca" em laranja). A contagem é
  a próxima virada dos campos (`nextFieldTurn`): fora do inverno, "inverno em N sem" (laranja nas
  últimas 3 semanas); no inverno, "primavera em N sem". No celular a pílula troca o ano e a semana
  pela contagem: "Outono · inverno em 9 sem"; velocidade (celular: um botão dourado que alterna 1x → 3x → pausa; PC: pausa, 1x e
  3x, o ativo dourado); engrenagem das Configurações.
- **Lateral esquerda** (botões redondos):
  - **Objetivos** (bandeira): lista dos 11 objetivos, cumpridos, atual (com progresso) e próximos,
    com prêmio e o que libera (no celular, prêmio e liberação só no objetivo atual), em duas colunas
    quando não cabem em uma;
  - **Avisos** (triângulo): selo vermelho com a contagem da lista do core (`alerts()`); tocar abre a
    lista com o texto de cada aviso. Quando entra um aviso novo o botão pulsa e aparece um toast com
    o texto (uma vez por episódio). **Não há faixa de aviso sobre o mapa;**
  - **Estatísticas** (gráfico): prata (impostos, produção por tipo, manutenção por tipo, saldo),
    comida (colheita, pesca, coleta, consumo, saldo, estoque/capacidade, previsão), trabalho
    (trabalhadores, vagas, sem trabalho, eficiência), casas por nível, alegria (felizes, contentes,
    tristes e motivos), **gráficos das últimas 52 semanas** (veja Histórico), a lista de
    **problemas** (a mesma dos Avisos; só no PC, no celular ela fica no botão Avisos) e a lista de **marcos** com ano e semana.
- **Inferior esquerdo** (botões redondos com nome embaixo; no PC com a tecla, ex. "Mover · 1"):
  - **Mover** (mão): arrastar move o mapa; tocar numa construção abre o balão dela;
  - **Rua**: arrastar constrói, como hoje;
  - **Demolir** (martelo): a construção sob o cursor/dedo fica avermelhada; ao demolir, poeira e
    pedrinhas; sobre árvore, "Cortar árvore · 5 prata". Regras de Limpar sem mudança.
- **Coluna direita de construções**: são 10 (Casa, Jardim, Poço, Campo, Pescador, Coletora,
  Celeiro, Mercado, Oficina, Templo), mais que `toolColumnMax` (8), então a coluna mostra as **4
  categorias** e tocar numa abre a faixa dela (veja Categorias). Botão redondo com a miniatura da arte do jogo; celular 46 px só o desenho; PC 86 px com
  desenho, nome e "preço · tecla N". Escolhida: borda dourada com brilho. Sem prata: acinzentada e
  preço em vermelho. Bloqueada: cinza, borda tracejada e cadeado (PC: "objetivo N"); tocar mostra
  "Libera no objetivo N". Ao liberar ganha um ponto dourado de "novo" no canto de cima (fora do desenho) até ser tocada (não é salvo). Tocar de novo
  no Mercado gira a prévia. **Não há botão "Construir":** escolher a construção já é a ferramenta.
- **Balão da construção escolhida:** escuro, à esquerda da coluna, com seta para o botão: nome,
  "preço · manutenção por semana" e uma frase do efeito; no PC também vagas, alcance e "Saldo
  depois: +N/sem" (saldo da semana com a manutenção, as vagas e a produção da nova construção, na
  eficiência que a cidade teria; antes do Objetivo 3, sem manutenção). Num local de trabalho que
  não dá comida (mercado, oficina, templo…), quando as vagas dele tiram trabalhadores dos que dão
  comida, também "Comida depois: ±X/sem" (`foodAfter`; vermelho se negativo), no celular também.
  Fecha ao trocar de ferramenta ou ao tocar no mapa para construir.
- **Balão da construção tocada** (com Mover), ao lado dela com seta, seguindo a câmera; some ao
  tocar fora:
  - casas: "nível atual → próximo", o que já tem (verde) e o que falta (vermelho, incluindo "sem
    rua"), quadro "Ao evoluir" com os ganhos (moradores e imposto), alegria com os motivos;
    terreno vazio diz se há família a caminho;
  - outras construções: o que faz, quantas casas atende (serviços), vagas, produção, manutenção
    por semana e conexão (desconectada: "não funciona, mas paga manutenção"); campo: "colhe na
    primavera do ano N" e, num ano seco, se está junto ao rio; pescador e coletora: "rende N
    comida/sem"; celeiro: "guarda 150";
  - ruas, árvores e terreno: uma linha só;
  - botões redondos: **ação principal** dourada quando há algo a fazer (casa sem o próximo serviço:
    "Onde pôr um mercado" escolhe a ferramenta e destaca no mapa os lugares livres, ligados à
    rua, cujo raio atende a casa), **Demolir** (não aparece no altar e no templo) e
    **Fechar**.
- **Sem linha de informação:** o que ela mostrava foi para os balões, as Estatísticas e a lista de
  Objetivos; mensagens curtas ("Sem espaço para o Templo…") viram toasts.
- **Toasts** no centro de baixo (veja Mapa e mensagens).
- **Configurações:** **Girar a visão** (↺ ↻; no PC continuam Q e E), Dia e noite e Efeito maquete
  ("(aparelho lento)" quando desligado pelo desempenho). Escolhas salvas no navegador.
- **Tutorial:** a seta aponta os botões da Nova e o balão fica acima da parte de baixo da tela; o
  último passo aponta a pílula do objetivo.
- **Categorias** (`category` em `buildings.json`): Moradia (Casa, Jardim), Água e comida (Poço,
  Campo, Pescador, Coletora, Celeiro), Trabalho (Mercado, Oficina), Especiais (Templo). Com até
  `toolColumnMax` (8, em `rules.json`) construções a coluna mostra todas; acima disso mostra as 4
  categorias e tocar numa abre uma faixa com as construções dela. São 10, então as categorias valem.
  A categoria com uma construção liberada nova ganha o selo "novo".
- **Detalhes decididos na implementação (ui-designer):**
  - celular ou PC pelo tamanho real da tela: altura real < 500 px ou ponteiro grosso (toque) = celular;
  - no PC, o cursor sobre o mapa com Mover é uma mão aberta, que fecha enquanto arrasta o mapa; com
    Demolir, a construção sob o cursor fica avermelhada (pulsando), e sobre árvore aparece a pílula
    "Cortar árvore · 5 prata";
  - Rua e Demolir mostram uma dica curta num balão acima do botão ao serem escolhidos (some ao tocar
    no mapa);
  - Demolir no balão da construção tocada pede confirmação: o primeiro toque vira "Certeza?" por
    2,5 s, o segundo demole;
  - tocar em terreno livre ou no rio fecha o balão da construção tocada; ruas, árvores e rochas
    mostram uma linha;
  - "Onde pôr um poço/mercado/o Templo" escolhe a construção e destaca no mapa os lugares; sem
    nenhum, toast "Nenhum lugar livre por perto: abra uma rua ao lado". Os destaques somem ao
    construir, trocar de ferramenta ou fechar o balão (e voltam depois de girar o mapa). Casa sem
    rua ou construção desligada: "Ligar à rua" escolhe Rua;
  - toasts da Nova ficam acima das ferramentas de baixo; o balão do tutorial fica embaixo, entre as
    ferramentas e a coluna, e cresce para os botões terem 44 px reais;
  - no PC, se a pílula da estação não couber ao lado da velocidade, ela desce para baixo da
    velocidade (nunca cobre as pílulas); o texto do objetivo é cortado com "…" se não couber;
  - Esc fecha primeiro o painel aberto ou a faixa de uma categoria, depois o balão da construção
    tocada, e só então volta para Mover (a dica de Rua/Demolir e o balão da construção escolhida
    somem com a ferramenta: um Esc basta para sair de Demolir);
  - toques a até 8 px de um controle contam como interface (as frestas entre botões nunca
    constroem nem demolem no mapa);
  - os balões (construção escolhida e tocada) nunca cobrem controles: ficam abaixo da estação, da
    velocidade e da engrenagem, abaixo das pílulas do topo e acima de Mover, Rua e Demolir; os
    painéis terminam acima das ferramentas de baixo;
  - toasts: no máximo 3 na tela; os outros esperam em fila (os vermelhos na frente) e nenhum se
    perde; ficam acima dos balões. Com um **painel aberto** nenhum toast aparece: eles esperam e
    entram quando o painel fecha. A frase da caravana é um toast maior, por 5 s, e fica **sozinha**
    (os outros esperam ela sair);
  - **botões só disparam com o toque que começou neles** e não saiu deles (`onTap` em `ui.ts`):
    uma rua arrastada que termina sobre "Pular tutorial" ou sobre a pausa não aperta nada;
  - o nome de uma construção ou categoria na coluna do PC diminui a fonte até caber no botão
    ("Água e comida");
  - "Local inválido" diz o motivo: "Tem uma árvore aqui: corte com Demolir", "Tem uma rocha aqui",
    "Não dá para construir no rio", "Já tem uma construção ou rua aqui", "Fora do mapa" (Demolir:
    "Nada para demolir aqui", "Rochas não podem ser removidas");
  - cortar uma árvore faz subir "−5" em vermelho sobre ela (no toque não há pílula de cursor);
  - com Pescador, Coletora ou Campo, uma pílula sobre a prévia diz, em duas linhas, "Rende N
    comida/sem" (com a eficiência que a cidade terá com as vagas dela) e "Comida depois: ±X/sem"
    (o saldo de comida da cidade com ela; a pílula fica vermelha se negativo); campo no inverno:
    "Congelado no inverno: volta em N sem". O balão da construção escolhida diz a regra (por
    célula, alcance e teto) ou "Guarda 150 de comida";
  - no inspetor de pescador, coletora e campo trabalhando com menos de 100% de trabalhadores:
    "Faltam trabalhadores: rende 67%" em laranja;
  - Estatísticas em duas abas: **Agora** (números e problemas) e **Histórico** (gráficos e marcos);
    a semana de cada marco é guardada pela interface quando ele chega;
  - o terreno vazio tocado diz por que nenhuma família vem (o mesmo motivo dos Avisos); "Nenhuma
    família vem: construa casas" só aparece nos Avisos (sem toast) e some enquanto uma família anda.
- **Tamanhos de teste:** 844 x 390, 915 x 412 e 1366 x 768.

### Mapa e mensagens

- **Balões** sobre construções com o primeiro problema, nesta ordem: sem rua; depois, em locais de
  trabalho com eficiência 0, "sem trabalhadores" (trabalhador riscado); pescador "longe do rio" e
  coletora "sem árvores" quando rendem 0; depois, para casas
  de nível 1 a 3, a primeira exigência que falta (gota azul = poço, listras vermelhas = mercado,
  chama = altar/templo; só se a construção que falta já estiver liberada); por último, casa triste
  (carinha vermelha, em qualquer nível). Com zoom
  afastado os balões crescem (escala máx(1, 1,2 / zoom)) para continuar legíveis.
- **Com ferramenta de construção:** linhas da grade, prévia translúcida (vermelha se inválida ou
  sem prata), quadrado do raio e área já coberta pelo mesmo serviço. Poço, Mercado e Jardim
  contornam as casas com família que atenderiam ali e mostram "Atende N casas" sobre a prévia.
  Pescador e Coletora mostram "Rende N comida/sem" (com as células de rio ou árvores contadas
  destacadas); Campo mostra que dá comida fora do inverno. Com Casa, destaque dourado da
  área do altar e do templo (onde casas grandes são possíveis). O Templo mostra as 6 x 6 células
  e destaca em verde todas as posições onde cabe (6 x 6 livre encostado em rua conectada, sem
  olhar a prata); se não houver nenhuma, toast "Sem espaço para o Templo: abra uma rua ao lado de
  um terreno livre 6 x 6".
- **Toasts** (mensagens curtas no centro de baixo, acima das ferramentas, empilhando para cima):
  prata insuficiente, cidade em dívida (ao tentar construir), entrou/saiu da dívida, local
  inválido, templo sem rua, rua não ligada ao altar, altar/templo protegidos, objetivo cumprido,
  "Oficina liberada: …", "Falta comida: construa pescador ou coletora" (uma vez por episódio de
  fome), a frase da caravana, os marcos, o primeiro texto de cada aviso (o de comida curta só se
  começar no verão) e a chegada de cada estação ("Chegou o verão: dias quentes e secos";
  inverno: "Inverno: só pescador e coletora dão comida").
- Durante a fome, leve tom avermelhado sobre o mapa.
- Tela inicial com 3 passos numerados (comida para o inverno: pesque, colete e plante no outono;
  "Dê água às casas com poços. Sem celeiro, só cabem 50 de comida."; objetivos, Templo e não
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
`src/core/tutorial.ts`, tela em `src/render/Tutorial.ts`.

- Um balão com **uma frase** fica embaixo, entre as ferramentas e a coluna, com o botão "Pular tutorial".
  Uma **seta dourada** que balança aponta onde tocar: o botão da ferramenta do passo até ela ser
  escolhida, depois o lugar no mapa.
- **As ferramentas nunca travam:** o tutorial só destaca (seta e caminho marcado). Câmera, girar
  e velocidade continuam livres.
- **O relógio fica parado nos passos de construir** (1 a 5: `tutorialHoldsClock`), para a
  primeira cidade ser feita sem pressa, e volta a andar no passo 6 (a família chegando). A
  velocidade escolhida fica guardada.
- A cada passo a câmera desliza até o lugar dele (a rua marcada, o lugar do pescador ou da
  coletora, o terreno da casa); se o jogador mexer na câmera, ela fica onde ele deixou.
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
  4. "Construa um poço perto das tendas da caravana": a prévia mostra o raio e "Atende N casas".
     Conclui com 1 poço ligado.
  5. "Construa uma casa encostada na rua, perto do poço": os terrenos livres no raio do poço e
     encostados na rede ficam verdes. Conclui com 1 casa nova ligada.
  6. "Uma família está chegando!": a câmera acompanha a família por 2 s
     (`tutorial.followSeconds` em `visual.json`). Conclui quando ela chega; aparece "Muito bem!
     Agora siga os objetivos no alto da tela". Se a porta das famílias estiver fechada e nenhuma
     família estiver andando, o balão mostra o motivo no lugar da frase (sem toast repetindo).
- Mini passos (só para quem não pulou), sem travar ferramentas:
  - Ao cumprir o Objetivo 3: a seta aponta a prata e o balão traz a mensagem da manutenção com o
    botão "Entendi".
  - Depois: "Casas de barro com mercado perto viram casas de pedra", com a seta no Mercado.
    Conclui com 1 mercado ligado.
- Quem pula (ou já viu o tutorial) recebe a mensagem da manutenção como toast.

## Estações e clima

O ano tem 4 estações de **13 semanas** cada (`weeksPerSeason` em `rules.json`; 32,5 s a 1x),
começando no **outono**: outono, inverno, primavera, verão. As regras das estações são a colheita
(primavera), o inverno com fome (tendas saem mais) e a seca (veja Colheita). O core diz a estação
da semana (`src/core/seasons.ts`), avisa quando uma começa (evento `season`) e diz se o ano é
seco; cores, fases e chances visuais ficam em `visual.json` (`seasons`, fases em semanas de 1 a
13) e o desenho em `src/render/Seasons.ts`, `Weather.ts` e `MapView.ts`. O ciclo segue o da região
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
| Ferramentas de construção | arrastar constrói; dois dedos movem | arrastar constrói; botão direito move |
| Zoom | pinça | roda do mouse |

- **Tamanho da tela:** a largura do jogo é 1280 e a altura acompanha o formato da tela, entre
  560 e 720 (celular 844 x 390 → 1280 x 591, sem faixas laterais e com tudo ~22% maior).
- Zoom entre 0,5x e 2x. A câmera começa centralizada no altar.
- **Girar o mapa:** duas setas (↺ ↻) nas Configurações giram a visão 90° (Q e E no PC). Só a
  visão gira; as regras não mudam. A câmera continua olhando o mesmo
  ponto, as junções das ruas e a ordem de desenho acompanham o giro, e as construções mantêm a luz
  do mesmo lado (o Mercado troca entre o desenho 2 x 4 e 4 x 2 conforme fica na tela).
- Rua, Casa, Campo e Limpar constroem arrastando; o arraste preenche as células em passos
  ortogonais, então a rua fica sempre conectada.
- Poço, Pescador, Coletora, Celeiro, Mercado, Oficina, Jardim e Templo são colocados **ao soltar
  o dedo**: dá para arrastar para
  ajustar a prévia, e o segundo dedo de uma pinça nunca constrói por engano. No toque, eles miram
  90 px acima do dedo, para a prévia não ficar escondida; se o ponto mirado cair sob a interface,
  não há prévia (a prévia nunca fica escondida sob a interface); soltar sobre a interface cancela.
- No toque, o arraste só começa a construir depois de 150 ms com um dedo só (a pinça não
  constrói). Nada é construído nem começa um gesto sob pílulas, botões redondos, coluna, balões e
  painéis. Continuar uma rua a partir de uma rua existente não mostra "Local inválido".
- Atalhos no PC (a tecla abre a faixa e escolhe a primeira construção liberada dela): 1 Mover, 2 Rua, 0 Demolir; 3–6 abrem as categorias (Moradia, Água e comida,
  Trabalho, Especiais) e a mesma tecla de novo passa para a próxima construção da categoria;
  R gira o Mercado, Q e E giram o mapa, Espaço troca a velocidade, Esc fecha o balão ou painel
  aberto e, sem nenhum, volta para Mover.

## Vida na cidade

- Moradores andando **só pelas ruas**, com rota por busca em largura até uma construção conectada
  aleatória. Quantidade = moradores / 5, no máximo 60. Roupas variadas, balanço ao andar. Param
  quando o jogo está pausado e andam mais rápido em 3x.
- Famílias (grupo de três com uma trouxa) andando da entrada até a casa.
- Agricultores trabalhando dentro de cada campo: round(vagas do campo × eficiência), de 0 a 2;
  nenhum no campo sem rua. Param quando o jogo está pausado. Semeiam no outono, capinam no
  inverno, colhem com a foice na primavera.
- **Marcos:** brilho no lugar do marco e até 6 moradores próximos andam até ele e ficam reunidos
  por 3 s; o jogo não pausa.
- **Dia e noite** (só visual, números em `src/data/visual.json`): ciclo de 4 min reais em 1x,
  seguindo o tempo do jogo (para na pausa): amanhecer, manhã, tarde dourada, pôr do sol e noite.
  Um tom de cor é multiplicado sobre o mapa (balões, prévias e interface não mudam) e o céu atrás
  do mapa acompanha a hora; à noite tudo continua legível. À noite: janelas acesas nas casas de
  pedra e casas grandes, lamparinas em algumas ruas perto do altar e do mercado, fogo do altar e das
  oficinas mais forte, fogueiras das tendas acesas (com faíscas em até 6), estrelas no céu. Metade
  dos moradores anda à noite e 25% a mais no fim da tarde; os que sobram entram em casa ao chegar
  ao destino. Desligado nas opções: sempre de dia.
- **Andaime:** toda construção nova aparece primeiro com andaime de madeira, pedras e poeira por
  1,5 s; ao subir de nível, a casa mostra o andaime por 0,6 s antes do novo desenho. Ao abrir o jogo
  ou girar o mapa, o que já existe aparece pronto.
- **Ruas que evoluem** (só visual): cada passo de morador conta na célula; com 60 passos a rua fica
  mais larga e clara, com 240 ganha calçamento de pedra. Ruas a até 2 células do altar ou do templo
  já são calçadas.
- **Vida e ambiente** (só visual, `src/render/Ambient.ts`, números em `ambient` de `visual.json`):
  cabras e galinhas ao lado das tendas; um jumento amarrado ao lado de cada mercado; até 3 rebanhos
  de 4 ovelhas pastando na grama aberta a até 16 células do altar; 6 pombas no altar que voam
  quando alguém passa; 2 barquinhos de pescador e 3 lavadeiras nas margens do rio mais próximas da
  cidade; varais com roupas coloridas balançando em 1 de cada 3 casas de barro ou melhores; 4
  sombras de nuvens passando devagar. No máximo 40 animais. Chão com flores silvestres, arbustos e
  pedrinhas em ~15% das células; trilhas de terra apagadas entre casas a 1–3 células uma da outra;
  palmeiras e oliveiras balançando com vento leve (palmeira mais).
- Plantações balançando, fumaça na chaminé da oficina, fogo tremulando no altar, água correndo no rio.
- Ao subir de nível: pulinho, "+N" e anel de brilho. Ao cair de nível ou por fome: texto vermelho.
- Ao construir: anel de brilho. Ao limpar: nuvem de poeira. Templo: anéis dourados, faíscas e
  clarão.
- Marco (sem pausar, `Effects.milestone`): a construção ligada ao marco brilha dourada algumas
  vezes, halo e anéis dourados, faíscas douradas subindo e até 6 moradores vêm de perto, pulam de
  alegria por uns segundos e voltam (`visual.json` > `moments`). Onde: a casa que subiu (primeira
  família, barro, pedra), o primeiro campo que colhe, ou o altar (primeiro inverno, ano sem fome).
- Comida estragando (`spoilStart`): moscas e uma fumacinha verde curta no celeiro ligado (ou no
  altar sem celeiro). Começo da colheita: anel dourado em cada campo que colhe.

## Arte
- **Acabamento de imagem** (só no mapa, WebGL, `FinishPipeline.ts`): vinheta suave e efeito
  maquete (desfoque leve que cresce para as bordas de cima e de baixo; a faixa do meio fica nítida),
  numa passada só. Se a média ficar abaixo de 40 quadros por segundo por 4 s, o efeito maquete
  desliga e as faíscas das fogueiras somem até reiniciar.

- Tudo desenhado por código, sem pacotes de assets (`src/render/textures.ts`).
- Isométrico 2:1, paleta quente: areia, ocre, tijolo de barro, pedra calcária clara, com verde de
  palmeiras e azul do rio como contraste.
- Construções como pequenas maquetes: paredes em dois tons (face sul iluminada, face leste na
  sombra), telhados planos usados como área de convivência, muros grossos, jarros, toldos e plantas.
- Cada construção é desenhada no tamanho real da sua área (casa 2 x 2 com quintal, muros e
  detalhes; nada de desenho de 1 célula ampliado).
- Cada nível de casa se distingue mesmo no zoom mínimo pela identidade do nível (terreno marcado,
  tenda de pano escuro, cubo de barro ocre, casa de pedra com base alta de calcário claro (cerca de
  dois terços da parede) e só uma faixa de barro em cima, casa grande de calcário claro), e cada nível tem desenhos de forma realmente diferente (não só de cor):
  - terreno (2): estacas, cordas e valetas marcando os cômodos; fiada de fundação com pedras
    empilhadas;
  - tenda (6): comprida de pano escuro listrado; de empena com pano claro remendado; tenda dupla;
    com toldo listrado na frente; com fogueira, tripé e panela; com duas cabras amarradas e cocho;
  - casa de barro (6): cubo simples; com anexo de telhado de junco; com escada de barro até o
    telhado; com forno de barro (tabun) fumegando na frente; com cerca de galhos e galinhas; com o
    telhado cheio de jarros;
  - casa de pedra (6): janelinhas emolduradas na faixa de barro e escadinha externa; varais no telhado; parreira
    subindo a parede até uma latada; porta em arco de calcário; dois volumes (casa alta e cômodo
    baixo de pedra com terraço); quintal de muro de pedra com oliveira;
  - casa grande (6): "quatro cômodos" com pátio central (tear, forno, cisterna); figueira grande no
    pátio; toldo listrado cobrindo o telhado; bloco de dois andares com escadaria externa; em L com
    quintal aberto; com horta murada na frente.
- Casas, campos e oficinas também têm versão espelhada, desenhada à parte (e não a imagem
  virada), para a luz e as sombras continuarem do mesmo lado. Casas vizinhas variam um pouco de tom e posição.
- Campo 2 x 2 em terraço com muro de pedras e fileiras que balançam, em 4 plantações: trigo
  dourado; cevada verde-amarelada e mais densa; lentilha em moitas verdes baixas sobre terra escura;
  linho com flores azuis e um rego de água na borda. Poço numa plataforma
  de lajes, com roldana, cocho e uma mulher com jarro. Mercado: duas fileiras de barracas com toldos
  listrados ao longo de um corredor de pedra, com mercadores, fregueses e um jumento; o mercado
  girado (4 x 2) tem desenho próprio, para a luz continuar vindo do mesmo lado.
- Agricultores no campo (`src/render/Fieldhands.ts`, desenho em `residents.ts`): túnica curta de
  linho branco, índigo ou vermelho-garança (mais fortes que o lavrador da rua, para se lerem sobre
  trigo e terra no zoom mínimo), pano na cabeça. Cada um trabalha parado no seu sulco entre as
  fileiras: enxada sobe e desce, ou abaixa com a foice e junta um punhado; de tempos em tempos dá
  um passo curto ao longo do sulco, indo e voltando. Ritmo e fase sorteados, para não ficarem
  sincronizados; dois no mesmo campo nunca têm a mesma roupa. Os tufos da fileira logo à frente
  dele somem (trecho já trabalhado), para o corpo aparecer. Ficam no desenho do campo, ordenados
  entre os tufos por profundidade, e acompanham o giro do mapa e o campo espelhado.
- Oficina 3 x 3 em 6 ofícios (um desenho cada, também espelhados), todos com pátio murado e uma
  sala de trabalho, cada um com forma e cor dominantes próprias para se distinguir no zoom mínimo:
  - olaria: forno de cúpula com chaminé (fumaça e brilho no buraco do fogo), roda sob toldo de
    junco, fileiras de jarros e potes secando;
  - ferraria: sala de pedra bruta com telhado de fuligem, forja de pedra com brasas vermelhas e
    chaminé alta (fumaça escura), foles de couro, bigorna grande com barra em brasa, cavalete de
    ferramentas penduradas, monte de carvão e cocho de água;
  - carpintaria: pilha alta de tábuas claras e outra de cedro avermelhado, pirâmide de toras,
    tábuas encostadas na parede, bancada com serrote, cavalete e lascas no chão;
  - tecelagem: tear vertical de pesos sob toldo listrado azul e creme (pano listrado pela metade),
    tear de chão estacado no pátio, banco de rolos de pano coloridos, lã secando no telhado;
  - tinturaria: duas fileiras de tinas redondas de azul, vermelho e amarelo com respingos, panos
    compridos secando em varais altos, pilha de panos dobrados;
  - curtume: couros esticados e amarrados em molduras de madeira, tinas de madeira com aros,
    poço de cal branco com couro de molho, cavalete de raspar e pilha de couro pronto.
  Só olaria e ferraria soltam fumaça e têm fogo que tremula.
- Jardim 2 x 2: gramado verde numa mureta baixa de pedra, caminhos em cruz até um pequeno
  espelho d'água redondo, canteiros de flores nos cantos, uma oliveira, uma palmeira e um banco.
- Pescador 2 x 2: cabana de barro com telhado grosso de junco, rede secando entre duas varas (com
  boias de cortiça), um barquinho puxado para a terra com os remos, peixes secando num cordão e um
  cesto de peixe. Coletora 2 x 2: casinha de barro com figos secando numa esteira no telhado e
  escada encostada, esteira de figos no chão, três cestos grandes cheios (azeitonas, figos,
  tâmaras) e uma vara de bater oliveira. Celeiro 3 x 3: armazém de calcário claro no fundo, dois
  silos redondos de barro com cúpula e escada, pátio murado com toldo de junco e estrados; o
  estoque aparece em 4 desenhos pela fração `comida / capacidade` (limites em `visual.json` >
  `moments.granaryStock`): vazio (estrados nus), um terço (uma fileira de sacos e 2 jarros), dois
  terços (mais sacos e 4 jarros, grão na boca de um silo), cheio (sacos em duas camadas, 6 jarros,
  um monte de grão com pá, sacos no telhado e grão nos dois silos). Miniaturas: o celeiro cheio,
  a rede com o barco, os cestos de frutos.
- Altar 4 x 4: pátio de pedras com mureta rústica e o altar de pedras brutas não lavradas, com
  rampa (sem degraus), chifres nos cantos e fogo no alto.
- Templo 6 x 6, a construção mais bonita: plataforma de calcário com escadaria, muro com portão e
  torres, pórticos de colunas, pátio com pia de bronze e um pequeno altar, e o santuário alto com
  pórtico, grande porta e duas colunas, cornijas douradas sem ornamentos babilônicos ou egípcios.
- Chão com variação suave (manchas, ondulações na areia, seixos, tufos de capim), sem padrão de
  xadrez. Ruas de terra batida largas, com borda escura nítida (meio-fio de terra) para se lerem
  sobre a areia no zoom mínimo, sulcos de carroça e pedras gastas nas bordas; o anel em volta do
  altar usa o mesmo desenho e se lê como rua, não como borda do pátio.
- Luz de fim de tarde vinda do oeste; sombras suaves sempre para o leste.
- Moradores de 10 tipos com roupas da época (bege, marrom, azul, vermelho, branco) e 3 tons de
  pele, desenhados de lado com 2 quadros de passo, cada um com algo exagerado para ser lido no zoom
  mínimo: mulher com jarro na cabeça, lavrador com foice e feixe, mulher com cesto de frutas,
  carregador com saco nas costas, artesão de avental que leva o produto do ofício da oficina para
  onde vai (jarro grande, martelo erguido, tábua no ombro, rolo de pano, panos tingidos, couro nas
  costas; um potinho quando vai a outro lugar), ancião curvado de manto marrom escuro, barba branca
  e cajado, criança
  correndo, homem puxando um jumento com cestos, pastor com cajado e ovelha, sacerdote todo de
  branco com faixa azul larga e turbante branco alto, um pouco mais alto que os outros
  (`src/render/residents.ts`). Ancião e sacerdote contrastam (escuro x branco) mesmo no zoom mínimo.
- Desenho ordenado por profundidade (x + y do centro da área), incluindo moradores e as construções grandes.
- A camada de desenho é isolada: texturas com nome e pontos de ancoragem (`ORIGIN`, `HEIGHT`),
  para trocar por sprites no futuro.

## Fora do escopo por enquanto

- **Deploy:** o workflow do GitHub Pages existe (`.github/workflows/deploy.yml`), mas o `base` do
  Vite continua `'./'`. A mudança para `/jerusalem-antiga/` foi adiada a pedido.
- **Tela cheia em celulares compridos:** o jogo mantém 1280 x 720 (16:9), então sobram faixas nas
  laterais. Ocupar a tela inteira exigiria refazer o layout da interface.

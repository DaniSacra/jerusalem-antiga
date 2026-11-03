# Jerusalém Antiga — Design do jogo

Construtor de cidade simples, isométrico, para celular (tela deitada) e PC. O foco é a mecânica.
**Não há história, versículos nem mecânicas além das descritas aqui.** Toda mudança de regra deve
atualizar este documento, os JSON em `src/data/` e os testes em `tests/`.

Os números abaixo são os valores atuais; a fonte da verdade são os arquivos em `src/data/`.

## Mapa

- Grade lógica **48 x 48** células quadradas. O core trabalha com a grade quadrada; só o desenho
  é isométrico 2:1 (losangos).
- Terreno (`map.ts`, `rules.json > map`):
  - areia e grama seca, com manchas geradas por ruído (`grassShare` ≈ 45% de grama);
  - **rio** na borda leste, com 3 a 4 células de largura, serpenteando (não constrói);
  - **rochas** (50): não constrói e não pode ser removida;
  - **oliveiras** (60) e **palmeiras** (50): bloqueiam, mas podem ser cortadas com Limpar (5 prata).
- Ficam livres de rochas e árvores: tudo a até 9 células da borda do altar e a rua inicial.

## Início

- **Altar** fixo, 4 x 4, ocupando x e y de 22 a 25, raio 3. Não está na barra de ferramentas e não
  pode ser demolido.
- **Ruas iniciais** de terra, de graça: um **anel** de 1 célula em volta do altar (contorno de
  x e y de 21 a 26, 20 células) e a rua na coluna x = 24, do anel (y = 26) até a borda sul. A
  célula onde ela toca a borda (24,47) é a **entrada da cidade**. São ruas comuns: Limpar pode
  removê-las.
- As junções das ruas são desenhadas só com ruas vizinhas; o altar não conta, então o anel aparece
  como um contorno com cantos e um T onde a rua sul encontra o anel.
- Prata 200, Comida 30.
- Liberados: Ver, Rua, Casa, Campo, Poço e Limpar.

## Construções

| Construção | Custo | Manutenção | Tamanho | Vagas | Produção | Raio | Observações |
|---|---|---|---|---|---|---|---|
| Rua | 2 / célula | – | 1 x 1 | – | – | – | arrastar constrói em sequência |
| Casa | 10 | – | 2 x 2 | – | impostos | – | começa como terreno vazio |
| Campo | 15 | 1/mês | 2 x 2 | 2 | 3 comida/mês e 1 prata/mês | – | 4 plantações (só aparência) |
| Poço | 20 | 3/mês | 2 x 2 | – | – | 4 | |
| Mercado | 40 | 4/mês | 2 x 4 | 3 | – | 5 | liberado pela Meta 2; pode girar para 4 x 2 |
| Oficina | 35 | 2/mês | 3 x 3 | 3 | 5 prata/mês | – | liberada pela Meta 3; 6 ofícios (só aparência) |
| Jardim | 25 | 1/mês | 2 x 2 | – | – | 3 | liberado pela Meta 4; deixa as casas no raio mais felizes |
| Templo | 800 | 10/mês | 6 x 6 | 2 | – | 12 | liberado pela Meta 8; não pode ser demolido |
| Altar | – | – | 4 x 4 | – | – | 3 | fixo no início |

- **Manutenção** (`upkeep` em `buildings.json`) só começa **depois da Meta 2**
  (`upkeepStartsAfterGoal` em `rules.json`). Antes disso nada é cobrado: o "+X/mês" não a desconta
  e não há aviso de saldo nem dívida por ela; a dica e a linha de informação dizem "manutenção N/mês
  depois da Meta 2". Ao cumprir a Meta 2 aparece, uma vez, "A partir de agora, poços, campos,
  mercados e oficinas custam prata por mês. Fique de olho no saldo." (passo do tutorial ou toast).
  A partir daí é cobrada todo mês de toda construção, **mesmo desconectada**, e também depois da
  vitória.

- Tamanho é largura (x) por altura (y) em células. O **Mercado** é o único que gira: tocar de novo
  no botão Mercado (ou a tecla R no PC) alterna entre 2 x 4 e 4 x 2; a escolha vale para as
  próximas colocações.

- O raio é **quadrado**: cobre toda célula a até N colunas e N linhas de distância. Em construções
  maiores, mede a partir de qualquer célula da construção. Uma construção é atendida se
  **qualquer** célula da sua área estiver no raio.
- Limpar remove construções e ruas sem reembolso (exceto altar e templo) e corta árvores por 5 prata.

## Ruas e conexão

- A **rede conectada** são as ruas ligadas ao altar por vizinhança ortogonal (busca em largura a
  partir do altar). É recalculada a cada construção ou demolição e no início de cada mês.
- Uma construção está **conectada** se alguma célula vizinha (ortogonal) da sua área faz parte da
  rede. Encostar no próprio altar (qualquer das 16 células) também conta. Pessoas e famílias
  andam só pelas ruas, nunca por dentro do altar.
- Sem conexão:
  - casas não recebem família e regridem como se faltasse uma exigência (tenda sem rua vira
    terreno vazio após 3 meses);
  - campos, oficinas, mercados e templo não produzem nem contam vagas;
  - poços, mercados e templo não dão cobertura;
  - aparece um balão "sem rua" (rua partida riscada).
- Ruas fora da rede aparecem apagadas e tracejadas. Ao terminar de construir (toque ou arraste)
  uma rua que ficou fora da rede, aparece "Esta rua não está ligada ao altar".
- Construir longe da rua é permitido (o jogador aprende pelo balão). **Exceção:** o Templo só pode
  ser colocado encostado numa rua conectada.
- Casas desconectadas continuam contando moradores e impostos até regredirem.

## Casas

| Nível | Nome | Moradores | Imposto/mês | Exige |
|---|---|---|---|---|
| 0 | Terreno | 0 | 0 | – |
| 1 | Tenda | 3 | 1 | rua |
| 2 | Casa de barro | 6 | 2 | rua, poço |
| 3 | Casa de pedra | 10 | 3,5 | rua, poço, mercado |
| 4 | Casa grande | 16 | 6 | rua, poço, mercado, raio do altar **ou** do templo |

## Felicidade

A felicidade só existe **depois que o Jardim é liberado** (Meta 4). Antes disso toda casa fica
contente (50, sem motivos), o imposto e a chance de família não mudam, a carinha não aparece na
placa e não há balão de casa triste.

Cada casa com família tem uma felicidade de 0 a 100 (`happiness` em `rules.json`, código em
`src/core/happiness.ts`), calculada todo mês:

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

- Um terreno vazio conectado, sem fome e sem família a caminho tem **35%** de chance por mês de
  receber uma família (vezes o fator da felicidade da cidade, veja Felicidade). **Exceção:** enquanto (tendas ou melhores + famílias a caminho) for menor
  que 3, a chance é 100%, para o começo não ter tempo morto.
- A família sai da **entrada da cidade** e anda pelas ruas (caminho por busca em largura) até a
  casa, **4 células por mês**. As famílias da exceção acima (as 3 primeiras) andam **3x mais
  rápido** (`earlyFamilySpeedMultiplier`), então a primeira tenda é ocupada em até 2 meses. Ao
  chegar, o terreno vira tenda.
- Se a rua do caminho for cortada, a família recalcula a rota; se não houver rota, ou a casa for
  demolida ou desconectada, a família desiste.
- Se a entrada for desligada da rede, as famílias passam a sair do altar (para a cidade nunca
  travar sem explicação).

## Simulação (1 mês = 2,0 s em 1x)

A cada mês, nesta ordem (`simulation.ts`):

1. Recalcular rede de ruas, conexões e cobertura (poço, mercado, altar/templo).
2. Moradores = soma das casas. Trabalhadores = 40% dos moradores (para baixo).
   Vagas = soma das construções conectadas. Eficiência = trabalhadores / vagas, no máximo 100%
   (100% se não houver vagas).
3. Comida += campos × 3 × eficiência − consumo. Cada morador come conforme o nível da casa
   (`food` em `houses.json`): tenda 0,2, barro 0,2, pedra 0,25, casa grande 0,3. Se a comida chega
   a 0 com saldo negativo: **fome**. A comida nunca fica negativa.
4. Prata += impostos (cada casa com o fator da sua felicidade) + (oficinas × 5 + campos × 1) × eficiência − manutenção (só depois da Meta 2). A prata **pode ficar negativa**
   (dívida). Esse saldo é o "+X/mês" da barra.
5. Novas famílias são enviadas para terrenos elegíveis; depois todas andam (as novas já no mesmo
   mês), e as que chegam transformam o terreno em tenda.
6. Para cada casa de nível 1 ou mais:
   - se falta uma exigência do nível atual: após 3 meses seguidos, cai um nível;
   - com fome: não evolui; casas acima de tenda têm 12% de chance de cair um nível; cada tenda tem
     20% de chance (`famineLeaveChance`) de ser **abandonada**: vira terreno vazio e a família vai
     embora andando até a entrada (só aparência);
   - se tem as exigências do próximo nível: após 3 meses seguidos, sobe de nível.
7. Guardar a maior população (`peakPopulation`) e verificar a meta atual.
8. **Dívida:** se a prata terminou o mês negativa, conta mais um mês em dívida; com prata ≥ 0 a
   contagem zera. Após **24 meses seguidos** (`debtMonthsToLose`), derrota.

Velocidades: 1x, 3x e Pausa. O jogo pausa enquanto a tela de vitória ou de derrota está aberta.

## Dívida e derrota

- Com prata negativa nada pode ser construído nem cortado ("A cidade está em dívida: nada pode ser
  construído"); demolir continua grátis.
- Ao entrar em dívida: toast "A cidade entrou em dívida! Toque na prata para ver os gastos" e, se
  estiver em 3x, a velocidade cai para 1x. Ao sair: toast "A cidade saiu da dívida!".
- Derrota: tela "Jerusalém foi abandonada" com os meses jogados e a maior população alcançada, e
  o botão "Tentar de novo" (novo mapa, nova semente). Depois da derrota a simulação para.
- **Avisos** (`alerts()` no core), empilhados em etiquetas abaixo da barra superior, à esquerda,
  nesta ordem: dívida em vermelho ("A cidade está em dívida! N meses para ser abandonada"; com fome
  ao mesmo tempo: "Em dívida e com fome: demolir serviços para juntar prata para um campo · N meses"); saldo
  negativo em laranja ("Saldo −X/mês · maior custo: Tipo (N/mês) · demolir serviços que atendem
  poucas casas"); desemprego em laranja. Quando existir o painel de estatísticas, a mesma lista
  vira "principais problemas".

## Metas (em sequência)

1. Tenha 6 casas ligadas à rua (tendas ou melhores): +20 prata.
2. Chegue a 20 moradores: +30 prata, libera Mercado.
3. Tenha 5 casas de barro ou melhores: +40 prata, libera Oficina.
4. O povo precisa de trabalho: construa 2 oficinas (ligadas à rua): +40 prata, libera Jardim.
5. Chegue a 80 moradores: +60 prata.
6. Tenha 6 casas de pedra ou melhores: +80 prata.
7. Chegue a 150 moradores: +120 prata.
8. Tenha 4 casas grandes: +150 prata, libera Templo.
9. Construa o Templo: tela de vitória com meses e moradores, e botão "Continuar construindo".

Metas de casas e de construir contam só construções **conectadas** à rede.

Ao liberar a Oficina aparece também o aviso "Oficina liberada: 3 vagas e 5 de prata/mês" (números
lidos de `buildings.json`); ao liberar o Jardim, "Jardim liberado: casas felizes pagam mais imposto
e atraem famílias".

**Aviso de desemprego:** pessoas sem trabalho = trabalhadores − vagas (nunca menos de 0). Com a
Oficina liberada e 6 ou mais pessoas sem trabalho (`unemploymentAlert` em `rules.json`), aparece
uma etiqueta vermelha logo abaixo da barra superior, à esquerda: "N pessoas sem trabalho:
construa uma oficina ou um campo". Some sozinha quando o número cai abaixo de 6. Quando existir o painel de
estatísticas, o mesmo aviso entra na lista de principais problemas.

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

Ferramentas bloqueadas aparecem apagadas com o texto "Meta N".

## Interface

Layout inspirado em Pharaoh: A New Era, com arte própria desenhada em código (pedra clara com
detalhes dourados, cores e fonte de `palette.ts`). O mapa ocupa quase a tela toda: nada de barras
de largura total. Posições e tamanhos em `src/render/layout.ts`.

- **Placa no centro do topo:** "Jerusalém" em cima; embaixo, ícone + número, sem rótulo: Mês (o
  ícone é a estação: flor de amendoeira, feixe de trigo, folha ou floco de neve; ao lado, sol,
  entardecer ou lua, conforme a hora do dia),
  Prata e Comida com variação por mês (+X/mês; vermelho se negativa), Moradores, Felicidade (só
  depois de liberar o Jardim: carinha verde sorrindo, amarela séria ou vermelha triste, conforme o
  humor da média, e o número, verde quando feliz e vermelho quando triste) e Trabalho
  (trabalhadores/vagas; "—" sem ninguém; % em vermelho abaixo de 100%; "+N sem vaga" em laranja
  quando sobra gente). O valor da prata fica normal com saldo ≥ 0, laranja com saldo do mês
  negativo e vermelho piscando em dívida. Durante a fome, o valor da Comida fica vermelho e pisca.
  **Tocar na prata** mostra na linha de informação: impostos, produção por tipo ("Oficina +X ·
  Campo +Y"), "Manutenção: Campo −1, Poço −3…" e saldo (atualizado a cada mês).
  **Tocar na carinha** mostra: "Felicidade N · X felizes, Y contentes, Z tristes · Feliz paga mais
  imposto e atrai famílias · Jardim e altar alegram; fome e desemprego entristecem".
- **Opções** (engrenagem no canto superior direito; em telas muito largas, ao lado do topo do trilho
  direito): painel com "Dia e noite: ligado/desligado" e "Efeito maquete: ligado/desligado". As
  escolhas ficam salvas no navegador. Se o aparelho for lento, o efeito maquete aparece desligado
  "(aparelho lento)". Tocar fora fecha o painel.
- **Faixa da meta** (dourada, logo abaixo da placa): "1. Tenha 6 casas ligadas à rua  5/6" (a fonte
  encolhe se o texto for longo). Tocar mostra na linha de informação a meta inteira: "Meta 1 de 9:
  … · 5 de 6 · prêmio +20 prata · libera Mercado".
- **Faixa de aviso** (abaixo da meta): só uma, a mais importante da lista do core (dívida, saldo
  negativo, desemprego), com "!" à esquerda; vermelha na dívida, laranja nas outras. O X fecha o
  aviso, que fica escondido até sumir e voltar (aparece o próximo da lista, se houver). O aviso
  de dívida não tem X.
- **Velocidade** (canto superior esquerdo): 3 botões ❚❚, 1x e 3x; o ativo fica dourado.
- **Nomes nas ferramentas:** todo botão dos dois trilhos tem o **nome embaixo do ícone** (16 px do
  jogo), e os que custam prata têm ao lado a moeda e o custo. O nome nunca é cortado.
- **Trilho esquerdo** (abaixo da velocidade): Ver (lupa), Rua (com o custo 2), Jardim (miniatura e
  custo, como os botões do trilho direito), Limpar (picareta), uma divisória dourada e as setas ↺ ↻
  ("Girar") de girar o mapa. A ferramenta ativa fica dourada. Em telas muito largas (altura do
  jogo < 591) os botões desse trilho ficam um pouco mais baixos para caber.
- **Trilho direito:** Casa, Campo, Poço, Mercado, Oficina e Templo, cada um com a miniatura da
  própria construção e, embaixo, o nome e o custo (moeda + número). Sem prata suficiente: botão e
  miniatura acinzentados e custo em vermelho. Bloqueada: apagada, com "Meta N" no lugar do custo.
  Tocar de novo no Mercado gira a prévia.
- **Tamanhos:** botões dos trilhos 112 x 72 px do jogo (a altura ≈ 48 px de tela no celular
  844 x 390 e ≈ 44 px no 800 x 360, o mínimo de toque), botões de velocidade 72 px.
- **Linha de informação:** placa escura e compacta no centro de baixo, só aparece quando tem
  texto (encolhe para caber entre os trilhos). Ao escolher uma ferramenta mostra o nome, o custo e a
  manutenção em dourado e depois a dica (ex.: "Campo · 15 prata · 1/mês · Ocupa 2x2 · 2 vagas ·
  produz 3 de comida e 1 de prata/mês · pode arrastar."). Com Ver, mostra o que foi tocado:
  - casas: nível, moradores, imposto (já com a felicidade), humor e número da felicidade com os
    motivos (ex.: "contente 40 (Altar +10, Jardim +20, Desemprego −20)") e as exigências do próximo nível em verde/vermelho
    (incluindo "sem rua"); terreno vazio diz se há família a caminho;
  - outras construções: nome (a oficina com o ofício, ex.: "Oficina (Olaria)"), estado de conexão,
    manutenção (desconectada: "não funciona, mas paga manutenção"), vagas, produção, raio; com eficiência 0, "Sem
    trabalhadores: faltam moradores";
  - ruas (ligada ao altar ou não, entrada da cidade) e terreno.
- **Balões** sobre construções com o primeiro problema, nesta ordem: sem rua; depois, em campo,
  mercado, oficina e templo com eficiência 0, "sem trabalhadores" (trabalhador riscado); depois, para casas
  de nível 1 a 3, a primeira exigência que falta (gota azul = poço, listras vermelhas = mercado,
  chama = altar/templo; só se a construção que falta já estiver liberada); por último, casa triste
  (carinha vermelha, em qualquer nível). Com zoom
  afastado os balões crescem (escala máx(1, 1,2 / zoom)) para continuar legíveis.
- **Com ferramenta de construção:** linhas da grade, prévia translúcida (vermelha se inválida ou
  sem prata), quadrado do raio e área já coberta pelo mesmo serviço. Poço, Mercado e Jardim
  contornam as casas com família que atenderiam ali e mostram "Atende N casas" sobre a prévia. Com Casa, destaque dourado da
  área do altar e do templo (onde casas grandes são possíveis). O Templo mostra as 6 x 6 células
  e destaca em verde todas as posições onde cabe (6 x 6 livre encostado em rua conectada, sem
  olhar a prata); se não houver nenhuma, a linha de informação diz "Sem espaço para o templo: abra
  uma rua ao lado de um terreno livre 6 x 6".
- **Toasts** (mensagens curtas no centro de baixo, logo acima da linha de informação, empilhando para cima): prata insuficiente, cidade em dívida (ao tentar construir), entrou/saiu da dívida, local inválido, templo sem rua, rua não ligada ao altar, altar/templo protegidos, meta
  cumprida, "Oficina liberada: …", "Falta comida: construa campos" (uma vez por episódio de fome) e a
  chegada de cada estação ("Chegou o verão: dias quentes e secos").
- Durante a fome, leve tom avermelhado sobre o mapa.
- Tela inicial com 3 passos numerados (casas e campos ao lado das ruas do altar, campos dão comida e trabalho; poço, mercado e altar
  fazem as casas crescerem; metas, Templo e não ficar em dívida), uma linha de controles e o
  botão "Começar" (84 px de altura). Depois que o tutorial foi feito ou pulado, aparece ao lado
  "Ver tutorial de novo", que começa um jogo novo com o tutorial.
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

- Um balão com **uma frase** fica acima da linha de informação, com o botão "Pular tutorial".
  Uma **seta dourada** que balança aponta onde tocar: o botão da ferramenta do passo até ela ser
  escolhida, depois o lugar no mapa.
- Durante os 6 passos só a ferramenta do passo (e Ver) fica liberada; as outras ficam cinza, sem
  "Meta N". Câmera, girar e velocidade continuam livres. Uma ferramenta que o passo não permite
  volta para Ver ao fim do arraste (uma rua longa não é cortada).
- Passos (cada um só avança com a sua ação):
  1. "Puxe uma rua saindo do altar, pelo caminho marcado": um caminho fantasma de 6 células sai do
     anel em linha reta (oeste, norte ou leste, o primeiro livre). Conclui com +4 ruas ligadas ao
     altar, em qualquer lugar.
  2. "Construa 3 casas encostadas na rua, nos lugares verdes": os terrenos livres encostados na
     rede ficam verdes. Conclui com 3 casas ligadas.
  3. "Uma família está chegando!": a câmera acompanha a primeira família por 2 s
     (`tutorial.followSeconds` em `visual.json`). Conclui com o primeiro morador.
  4. "Construa um campo para o povo comer". Conclui com 1 campo ligado.
  5. "Construa um poço perto das tendas": a prévia mostra o raio e "Atende N casas". Conclui com 1
     poço ligado.
  6. "Veja: as tendas perto do poço viram casas de barro". Conclui com 1 casa de nível 2; aparece
     "Muito bem! Agora siga as metas no alto da tela" e todas as ferramentas liberadas voltam.
- Mini passos (só para quem não pulou), sem travar ferramentas:
  - Ao cumprir a Meta 2: a seta aponta a prata e o balão traz a mensagem da manutenção com o botão
    "Entendi".
  - Depois: "Casas de barro com mercado perto viram casas de pedra", com a seta no Mercado.
    Conclui com 1 mercado ligado.
- Quem pula (ou já viu o tutorial) recebe a mensagem da manutenção como toast.

## Estações e clima (só aparência, por enquanto)

O ano tem 4 estações de **12 meses** cada (`monthsPerSeason` em `rules.json`; 24 s a 1x), começando
na primavera: primavera, verão, outono, inverno. Ainda **não mudam nenhuma regra** (a mecânica,
como a seca do verão, vem depois). O core só diz a estação do mês (`src/core/seasons.ts`) e
avisa quando uma começa (evento `season`); cores e clima ficam em `visual.json` (`seasons`) e
`src/render/Seasons.ts` e `Weather.ts`.

- **Grama:** cada estação tem a sua: verde viva com flores na primavera, palha seca no verão,
  ocre com folhas caídas no outono e cinza esverdeado com geada no inverno. Nos últimos 2 meses de
  uma estação a grama vai virando a da próxima, célula por célula, espalhando pelo mapa.
- **Cor do mundo:** um leve tom por estação (fresco, quente, âmbar, frio) somado ao do dia e da
  noite; areia e árvores (palmeiras e oliveiras) também mudam de tom.
- **Clima:** períodos de 10–24 s de jogo. A cada período a estação sorteia chuva, neve ou céu
  limpo: primavera 30% de chuva, verão nunca (seco), outono 35% (as primeiras chuvas), inverno 55%
  (40% dela é neve). Chuva com respingos e céu mais escuro; neve com flocos e tom claro; as
  nuvens ficam mais fortes e só metade dos moradores sai à rua. O clima entra e sai devagar.
- **Vento:** com céu limpo, pétalas de amendoeira na primavera, poeira no verão e folhas no
  outono atravessam a tela.
- A chuva, a neve e o vento ficam numa camada própria entre o mapa e a interface (o zoom não muda
  o tamanho deles). Em aparelhos lentos, metade das partículas.

## Câmera e controles (estilo Pocket City)

| | Celular | PC |
|---|---|---|
| Ver | arrastar move a câmera; tocar seleciona | idem com o mouse |
| Ferramentas de construção | arrastar constrói; dois dedos movem | arrastar constrói; botão direito move |
| Zoom | pinça | roda do mouse |

- **Tamanho da tela:** a largura do jogo é 1280 e a altura acompanha o formato da tela, entre
  560 e 720 (celular 844 x 390 → 1280 x 591, sem faixas laterais e com tudo ~22% maior).
- Zoom entre 0,5x e 2x. A câmera começa centralizada no altar.
- **Girar o mapa:** duas setas (↺ ↻) no fim do trilho esquerdo giram a visão 90° (Q e E no PC). Só a visão gira; as regras não mudam. A câmera continua olhando o mesmo
  ponto, as junções das ruas e a ordem de desenho acompanham o giro, e as construções mantêm a luz
  do mesmo lado (o Mercado troca entre o desenho 2 x 4 e 4 x 2 conforme fica na tela).
- Rua, Casa, Campo e Limpar constroem arrastando; o arraste preenche as células em passos
  ortogonais, então a rua fica sempre conectada.
- Poço, Mercado, Oficina, Jardim e Templo são colocados **ao soltar o dedo**: dá para arrastar para
  ajustar a prévia, e o segundo dedo de uma pinça nunca constrói por engano. No toque, eles miram
  90 px acima do dedo, para a prévia não ficar escondida; se o ponto mirado cair sob a interface,
  não há prévia (a prévia nunca fica escondida sob a placa, as faixas ou os trilhos); soltar sobre a
  interface cancela.
- No toque, o arraste só começa a construir depois de 150 ms com um dedo só (a pinça não
  constrói). Nada é construído nem começa um gesto sob a placa, a faixa da meta, a faixa de aviso,
  a velocidade, os trilhos ou a linha de informação (quando aparece). Continuar uma rua a partir de uma rua existente não mostra "Local inválido".
- Atalhos no PC: 1–9 e 0 escolhem a ferramenta (Ver, Rua, Casa, Campo, Poço, Mercado, Oficina,
  Jardim, Templo, Limpar), R gira o Mercado, Q e E giram o mapa, Espaço troca a
  velocidade, Esc volta para Ver.

## Vida na cidade

- Moradores andando **só pelas ruas**, com rota por busca em largura até uma construção conectada
  aleatória. Quantidade = moradores / 5, no máximo 60. Roupas variadas, balanço ao andar. Param
  quando o jogo está pausado e andam mais rápido em 3x.
- Famílias (grupo de três com uma trouxa) andando da entrada até a casa.
- Agricultores trabalhando dentro de cada campo: round(vagas do campo × eficiência), de 0 a 2;
  nenhum no campo sem rua. Param quando o jogo está pausado.
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

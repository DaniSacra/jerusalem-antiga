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
| Campo | 15 | 1/mês | 2 x 2 | 3 | 3 comida/mês | – | 4 plantações (só aparência) |
| Poço | 20 | 1/mês | 2 x 2 | – | – | 4 | |
| Mercado | 40 | 3/mês | 2 x 4 | 3 | – | 5 | liberado pela Meta 2; pode girar para 4 x 2 |
| Oficina | 35 | 2/mês | 3 x 3 | 3 | 5 prata/mês | – | liberada pela Meta 3; 6 ofícios (só aparência) |
| Templo | 800 | 10/mês | 6 x 6 | 2 | – | 12 | liberado pela Meta 8; não pode ser demolido |
| Altar | – | – | 4 x 4 | – | – | 3 | fixo no início |

- **Manutenção** (`upkeep` em `buildings.json`) é cobrada todo mês de toda construção, **mesmo
  desconectada**, e também depois da vitória.

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

## Famílias

- Um terreno vazio conectado, sem fome e sem família a caminho tem **35%** de chance por mês de
  receber uma família. **Exceção:** enquanto (tendas ou melhores + famílias a caminho) for menor
  que 3, a chance é 100%, para o começo não ter tempo morto.
- A família sai da **entrada da cidade** e anda pelas ruas (caminho por busca em largura) até a
  casa, **4 células por mês**. Ao chegar, o terreno vira tenda.
- Se a rua do caminho for cortada, a família recalcula a rota; se não houver rota, ou a casa for
  demolida ou desconectada, a família desiste.
- Se a entrada for desligada da rede, as famílias passam a sair do altar (para a cidade nunca
  travar sem explicação).

## Simulação (1 mês = 1,2 s em 1x)

A cada mês, nesta ordem (`simulation.ts`):

1. Recalcular rede de ruas, conexões e cobertura (poço, mercado, altar/templo).
2. Moradores = soma das casas. Trabalhadores = 40% dos moradores (para baixo).
   Vagas = soma das construções conectadas. Eficiência = trabalhadores / vagas, no máximo 100%
   (100% se não houver vagas).
3. Comida += campos × 3 × eficiência − consumo. Cada morador come conforme o nível da casa
   (`food` em `houses.json`): tenda 0,2, barro 0,2, pedra 0,25, casa grande 0,3. Se a comida chega
   a 0 com saldo negativo: **fome**. A comida nunca fica negativa.
4. Prata += impostos + oficinas × 5 × eficiência − manutenção. A prata **pode ficar negativa**
   (dívida). Esse saldo é o "+X/mês" da barra.
5. Famílias andam; as que chegam transformam o terreno em tenda.
6. Para cada casa de nível 1 ou mais:
   - se falta uma exigência do nível atual: após 3 meses seguidos, cai um nível;
   - com fome: não evolui; casas acima de tenda têm 12% de chance de cair um nível; cada tenda tem
     20% de chance (`famineLeaveChance`) de ser **abandonada**: vira terreno vazio e a família vai
     embora andando até a entrada (só aparência);
   - se tem as exigências do próximo nível: após 3 meses seguidos, sobe de nível.
7. Novas famílias são enviadas para terrenos elegíveis.
8. Guardar a maior população (`peakPopulation`) e verificar a meta atual.
9. **Dívida:** se a prata terminou o mês negativa, conta mais um mês em dívida; com prata ≥ 0 a
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
  nesta ordem: dívida em vermelho ("A cidade está em dívida! N meses para ser abandonada"); saldo
  negativo em laranja ("Saldo −X/mês · maior custo: Tipo (N/mês) · demolir serviços que atendem
  poucas casas"); desemprego em laranja. Quando existir o painel de estatísticas, a mesma lista
  vira "principais problemas".

## Metas (em sequência)

1. Tenha 6 casas ligadas à rua (tendas ou melhores): +20 prata.
2. Chegue a 20 moradores: +30 prata, libera Mercado.
3. Tenha 5 casas de barro ou melhores: +40 prata, libera Oficina.
4. O povo precisa de trabalho: construa 2 oficinas (ligadas à rua): +40 prata.
5. Chegue a 80 moradores: +60 prata.
6. Tenha 6 casas de pedra ou melhores: +80 prata.
7. Chegue a 150 moradores: +120 prata.
8. Tenha 4 casas grandes: +150 prata, libera Templo.
9. Construa o Templo: tela de vitória com meses e moradores, e botão "Continuar construindo".

Metas de casas e de construir contam só construções **conectadas** à rede.

Ao liberar a Oficina aparece também o aviso "Oficina liberada! Ela dá trabalho ao povo e rende
prata."

**Aviso de desemprego:** pessoas sem trabalho = trabalhadores − vagas (nunca menos de 0). Com a
Oficina liberada e 6 ou mais pessoas sem trabalho (`unemploymentAlert` em `rules.json`), aparece
uma etiqueta vermelha logo abaixo da barra superior, à esquerda: "N pessoas sem trabalho:
construa uma oficina". Some sozinha quando o número cai abaixo de 6. Quando existir o painel de
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

- **Barra superior:** Prata e Comida com variação por mês (+X/mês; vermelho se negativa). O valor
  da prata fica normal com saldo ≥ 0, laranja com saldo do mês negativo e vermelho piscando em
  dívida. **Tocar na prata** mostra na linha de informação: impostos, oficinas, manutenção por tipo
  e saldo.
  Moradores, Trabalho (trabalhadores/vagas; "—" sem ninguém; % em vermelho abaixo de 100%;
  "+N sem vaga" em laranja quando sobra gente), Mês, Meta atual com progresso (a fonte encolhe se
  o texto for longo) e botão de velocidade da altura da barra (▶ 1x → ▶▶ 3x → ❚❚ Pausa). Durante a fome, o valor da Comida fica
  vermelho e pisca.
- **Barra de ferramentas:** Ver, Rua, Casa, Campo, Poço, Mercado, Oficina, Templo, Limpar, cada
  uma com ícone desenhado, nome e custo (vermelho se faltar prata).
- **Linha de informação:** mostra a dica da ferramenta, com custo e manutenção (ex.: "Mercado (40
  prata, 3/mês)"). Com Ver, mostra o que foi tocado:
  - casas: nível, moradores, imposto e as exigências do próximo nível em verde/vermelho
    (incluindo "sem rua"); terreno vazio diz se há família a caminho;
  - outras construções: nome (a oficina com o ofício, ex.: "Oficina (Olaria)"), estado de conexão,
    manutenção (desconectada: "não funciona, mas paga manutenção"), vagas, produção, raio; com eficiência 0, "Sem
    trabalhadores: faltam moradores";
  - ruas (ligada ao altar ou não, entrada da cidade) e terreno.
- **Balões** sobre construções com o primeiro problema, nesta ordem: sem rua; depois, em campo,
  mercado, oficina e templo com eficiência 0, "sem trabalhadores" (trabalhador riscado); depois, para casas
  de nível 1 a 3, a primeira exigência que falta (gota azul = poço, listras vermelhas = mercado,
  chama = altar/templo). Só aparece se a construção que falta já estiver liberada. Com zoom
  afastado os balões crescem (escala máx(1, 1,2 / zoom)) para continuar legíveis.
- **Com ferramenta de construção:** linhas da grade, prévia translúcida (vermelha se inválida ou
  sem prata), quadrado do raio e área já coberta pelo mesmo serviço. Com Casa, destaque dourado da
  área do altar e do templo (onde casas grandes são possíveis). O Templo mostra as 6 x 6 células
  e destaca em verde todas as posições onde cabe (6 x 6 livre encostado em rua conectada, sem
  olhar a prata); se não houver nenhuma, a linha de informação diz "Sem espaço para o templo: abra
  uma rua ao lado de um terreno livre 6 x 6".
- **Toasts** (mensagens curtas logo acima da linha de informação, empilhando para cima): prata insuficiente, cidade em dívida (ao tentar construir), entrou/saiu da dívida, local inválido, templo sem rua, rua não ligada ao altar, altar/templo protegidos, meta
  cumprida, "Oficina liberada!…" e "Falta comida: construa campos" (uma vez por episódio de fome).
- Durante a fome, leve tom avermelhado sobre o mapa.
- Tela inicial com 3 passos numerados (casas e campos nas ruas do altar; poço, mercado e altar
  fazem as casas crescerem; metas, Templo e não ficar em dívida), uma linha de controles e o
  botão "Começar". Botões principais têm pelo menos 80 px de altura (setas de girar 80 x 80).

## Câmera e controles (estilo Pocket City)

| | Celular | PC |
|---|---|---|
| Ver | arrastar move a câmera; tocar seleciona | idem com o mouse |
| Ferramentas de construção | arrastar constrói; dois dedos movem | arrastar constrói; botão direito move |
| Zoom | pinça | roda do mouse |

- **Tamanho da tela:** a largura do jogo é 1280 e a altura acompanha o formato da tela, entre
  560 e 720 (celular 844 x 390 → 1280 x 591, sem faixas laterais e com tudo ~22% maior).
- Zoom entre 0,5x e 2x. A câmera começa centralizada no altar.
- **Girar o mapa:** duas setas (↺ ↻) no canto superior direito, logo abaixo da barra, giram a
  visão 90° (Q e E no PC). Só a visão gira; as regras não mudam. A câmera continua olhando o mesmo
  ponto, as junções das ruas e a ordem de desenho acompanham o giro, e as construções mantêm a luz
  do mesmo lado (o Mercado troca entre o desenho 2 x 4 e 4 x 2 conforme fica na tela).
- Rua, Casa, Campo e Limpar constroem arrastando; o arraste preenche as células em passos
  ortogonais, então a rua fica sempre conectada.
- Poço, Mercado, Oficina e Templo são colocados **ao soltar o dedo**: dá para arrastar para
  ajustar a prévia, e o segundo dedo de uma pinça nunca constrói por engano. No toque, eles miram
  90 px acima do dedo, para a prévia não ficar escondida; soltar sobre a interface cancela.
- No toque, o arraste só começa a construir depois de 150 ms com um dedo só (a pinça não
  constrói). Nada é construído sob a barra superior, as setas, a linha de informação ou a barra
  de ferramentas. Continuar uma rua a partir de uma rua existente não mostra "Local inválido".
- Atalhos no PC: 1–9 escolhem a ferramenta, R gira o Mercado, Q e E giram o mapa, Espaço troca a
  velocidade, Esc volta para Ver.

## Vida na cidade

- Moradores andando **só pelas ruas**, com rota por busca em largura até uma construção conectada
  aleatória. Quantidade = moradores / 5, no máximo 60. Roupas variadas, balanço ao andar. Param
  quando o jogo está pausado e andam mais rápido em 3x.
- Famílias (grupo de três com uma trouxa) andando da entrada até a casa.
- Plantações balançando, fumaça na chaminé da oficina, fogo tremulando no altar, água correndo no rio.
- Ao subir de nível: pulinho, "+N" e anel de brilho. Ao cair de nível ou por fome: texto vermelho.
- Ao construir: anel de brilho. Ao limpar: nuvem de poeira. Templo: anéis dourados, faíscas e
  clarão.

## Arte

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

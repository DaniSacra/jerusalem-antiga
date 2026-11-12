# Visão 3D (Three.js)

O jogo: a `Session` de `src/game` desenhada com Three.js sob a interface em HTML (`src/ui`).
`src/app/start3d.ts` abre o jogo depois da tela inicial. Quem cuida da página, da interface e da entrada é `src/app/play3d.ts`
(`Play3D`); aqui fica só a cena. O Three.js e este código vêm num pedaço separado (import dinâmico).
Veja a seção "Jogo em 3D" de `docs/GAME_DESIGN.md` e o plano em `docs/arquitetura-3d.md`.

| Arquivo | O que faz |
|---|---|
| `scene3d.ts` | a cena sem página: palco, câmera, marcas no chão, efeitos; célula sob o ponteiro, ponto da tela sobre uma célula (retângulo do canvas medido no `resize`), câmera deslizando, um quadro |
| `stage.ts` | renderizador, céu e luz, clima, partículas, qualidade automática e o `World` refeito por camada (cidade a cada 250 ms no máximo; moradores só com a cidade parada 600 ms) |
| `marks.ts`, `overlay.ts` | **puro e testado** / desenho: prévia no chão, fantasma, áreas e destaques |
| `roads.ts` | **puro e testado**: quanta gente passa em cada rua a caminho do altar (`roadTraffic`), trilha, rua ou borda de pedra (`roadLevel`) e as peças de cada célula (`roadPieces`: trilha; rua com borda escura, sulcos e pedrinhas; lajes com meio-fio; rua fora da rede tracejada) |
| `picking.ts`, `diff.ts` | **puros e testados**: raio até o chão e caixas das construções; o que mudou na cidade (camadas) |
| `plan.ts` | **puro e testado**: o que se desenha do `GameState` (quantas chaminés fumam, `smokeShare`, nenhuma casa no frio; vidros acesos das casas .glb, `panesOf`; modelo por tipo e nível, casa vazia desbotada com portão trancado, quintal da casa por variante, acréscimos dos níveis 2–3 por tipo, celeiro enchendo, ruas gastas e calçadas, frente para a rua, árvores, tocos e mudas, número de moradores) |
| `works.ts` | **puro e testado** (`tests/render3d/works.test.ts`): o Templo em etapas (`siteLook`): o altar em ruínas (pedras enegrecidas, sem fogo) e restaurado (degraus e mureta de pedra nova, cercado do rebanho das ofertas, `PEN`/`penAnimals`, fogo maior); o Templo pelas etapas feitas (`temple-0` ruínas no platô antigo, `temple-1` plataforma, `temple-2` pátio, muro e santuário sem telhado, `temple-3` pórtico, colunas e telhados, `temple` consagrado com o ouro, o mar de bronze e o altar com fumaça); a etapa em obra subindo em `GROW_STEPS` degraus (`rise-3`, `rise-4`; o Alicerce é `temple-1` subindo enquanto as ruínas afundam), as obras de cada etapa (`works-1..5`: pedras empilhadas, blocos, andaimes, guindaste de roda nas 3–4) e as ferramentas no chão com a obra parada (`tools`); onde os construtores pegam e assentam pedra (`BUILD_SPOTS`, `builderFloor`; as pernas em `haul.ts`, desenhados pelos `Haulers` com pedra no ombro e malho) |
| `crowd.ts` | **puro e testado**: quem é cada morador andando (`castWalkers`: um morador real, o ofício por quem trabalha ali), roupa por idade e sexo (homens de turbante, mulheres de manto, crianças menores, idosos curvados e lentos), o que cada tipo de morador carrega (`loadOf`) e o bicho que anda ao lado (`companionOf`), ordem da família ao andar e o seu caminho até a casa |
| `figures.ts` | gente low-poly instanciada (túnica, cabeça, turbante ou manto), o que cada um carrega (jarro, cesto, saco, foice, tora, cajado, carrinho, produtos dos ofícios: uma malha por objeto, presa ao corpo) e as famílias e caravanas andando em grupo (`s.families`; os noivos a caminho do casamento lado a lado, de mãos dadas: `betrothed`, `HOLD_SLOTS` em `crowd.ts`) |
| `wear.ts`, `detail.ts` | **puros e testados**: o chão pisado (`wearMap`: terra batida diante das portas, borda das ruas, trilhas entre casas a 1–3 células; vai ao shader do terreno como textura, `Terrain.setWear`) e o detalhe do chão (`groundDetail`: tufos na grama e seixos na areia, fora do chão pisado; camada `World.detail` que o palco esconde de longe e na qualidade mínima) |
| `finish.ts` | o acabamento de maquete: a cena vai para um buffer e um triângulo de tela cheia desfoca o alto e o pé (tilt-shift), esquenta a cor e faz o tom (ACES); ligado nas qualidades alta e baixa. A sombra de contato é `standMap` em `wear.ts` (puro, testado) lida pelo shader do chão (`Terrain.setStand`, `uContact`) |
| `thumbs.ts` | as miniaturas das construções para a interface (`renderThumbs`: cada modelo desenhado uma vez com o próprio renderer num canto do canvas e copiado para um data URL; dia claro de verão, câmera ortográfica pelo lado da vista inicial); o modelo de cada tipo é `thumbKey` em `plan.ts` (puro, testado) |
| `fields.ts` | **puro e testado**: a umidade da beira do rio (`moistMap`, por célula; vira a textura `uMoist` do terreno) com que o shader das plantações seca na seca só os campos longe da água; a altura de cada campo varia pelo lugar (`GROW_CHUNK` em `shaders.ts`) |
| `kits.ts` | **puro e testado** (`tests/render3d/kits.test.ts`): o kit de cada uma das 6 variantes por nível de casa (`kitOf`: peças por código em cima ou em volta do modelo Meshy, sem a vida do dia a dia na casa vazia); as peças são feitas em `models.ts` com a cor nos vértices (`buildKit`: uma chamada por peça, duas com pano ou folhas; o canteiro de obra do terreno vazio, `house-0`, também, em `ONE_PART`) e a casa espelhada é um protótipo próprio (`mirrored`, `house-N-m`) |
| `street.ts` | **puro e testado** (`tests/render3d/street.test.ts`): a vida parada da rua (`streetPlan`: vizinhos na porta que crescem com o nível da casa, compradores no mercado com equipe, colhedores de oliva no outono; no máximo `look3d.json` > `street.max`, em ordem de quem sai primeiro, `idleShown`), os gestos de cada um (`idlePose`) e a família que vai embora (`leavers`, `leavePath`, `leaveLead`) |
| `townsfolk.ts` | desenha a vida parada (`Idlers`, feita com a cidade e com as pessoas; menos à noite e na chuva, metade na qualidade baixa, nenhuma na mínima nem de longe) e as famílias saindo a pé até a entrada (`Leavers`, pela saída `leave` de `familyLeft`, guardadas entre as reconstruções) |
| `animals.ts` | bichos e barcos low-poly instanciados, com a cor nos vértices (jumento, ovelha, cabra, galinha, pomba, barco com pescador): uma chamada por tipo |
| `ambient.ts` | **puro e testado**: onde ficam os bichos, os barcos e as lavadeiras (`ambientPlan`; o rebanho de cada pasto no capim do raio pela fração do gado, `pastureFlock`, até `pastureFlock` de `look3d.json`, junto ao abrigo no inverno, e o pastor com cajado quando há quem trabalhe; os cordeiros no cercado do altar restaurado) e como se mexem (`ambientPose`) |
| `pasture.ts` | desenha e mexe a vida em volta da cidade a cada quadro (feita com a cidade) |
| `world.ts` | a cidade a partir do `plan`: chão, rio, construções e árvores instanciadas, fumaça, fogueiras, gente nos campos, moradores e famílias chegando |
| `models.ts` | modelos low-poly feitos por código, por chave; carregador do pacote .glb |
| `instancer.ts` | um `InstancedMesh` por parte de modelo: a cidade inteira em poucas dezenas de chamadas |
| `rim.ts` | **puro e testado** (`tests/render3d/rim.test.ts`): o campo em volta do mapa (estilo Foundation): colinas que sobem além da borda (`rimLift`, com passagem na estrada de entrada e vale para o rio) e a mata (`woodland`: grade com jitter em manchas e clareiras, densa junto à borda e rala com a distância; carvalhos e oliveiras perto, pinheiros nas colinas, árvores baratas `wood` ao longe; nunca dentro do mapa). `World.nearWoods`/`farWoods` (o palco esconde a de longe abaixo da qualidade alta) |
| `terrain.ts` | relevo (plano na cidade), areia e grama com transição, leito do rio, água animada |
| `life.ts` | moradores andando pela rede (caminhos do core) com o que carregam e os bichos ao lado, a gente que se reúne num marco (`gather`), gente nos campos, fumaça macia (`Smoke`: bolas de fumaça na GPU, uma chamada; uma segunda, arenosa e baixa, é a poeira das pedreiras), fogo do altar em camadas e faíscas das tendas (`Flames`: uma chamada), luzes da noite (tendas apagadas no frio) e a poça de luz diante da porta de cada casa com gente, do mercado e da oficina (`DoorLights`, uma chamada) |
| `shaders.ts` | efeitos nos materiais: neve, chão molhado, sombra de nuvens, janelas acesas (e o vidro aceso das casas .glb, `paneMaterial`), campos crescendo, vento nas plantas (vértice) e nos panos (`cloth`: roupa no varal pela barra, toldos pelo meio, peso `aFlap` assado em `models.ts`), cores do chão por estação com manchas e grão (desligados na qualidade mínima) e a margem de areia úmida do rio |
| `atmosphere.ts` | sol e lua com sombras, céu, neblina |
| `particles.ts` | chuva, respingos, neve, folhas, pétalas e poeira na GPU |
| `fx.ts` | momentos do mundo : anel de luz no chão, poeira e pedrinhas ao demolir, festa do templo, brilho e faíscas do marco, mofo com moscas, árvore cortada tombando, pulinho da construção (`World.lift`); tudo em pool, 3 chamadas de desenho |
| `fxMath.ts` | **puro e testado** (`tests/render3d/fx.test.ts`): raio e esmaecer do anel, pulinho, queda da árvore e as partículas de cada efeito |
| `camera.ts` | arrastar move; pinça/roda dá zoom; dois dedos ou botões giram; Q/E e WASD no PC |
| `time/` | **puro e testado** (`tests/render3d`): hora do dia e sol, estações contínuas e campos, clima pela semente, luz do quadro |
| `look3d.json` | números e cores da luz, das estações, do clima, da multidão e dos efeitos (`fx`) |

1 célula = 1 unidade; a coluna do grid é `x` e a linha é `z`. Cada construção fica no centro da sua
área e vira a frente (`+z`) para uma rua vizinha.

## Modelos .glb (pacote Meshy)

`public/models/meshy/manifest.json` troca modelos feitos por código por arquivos .glb, por chave
(créditos e prompts em `public/models/meshy/CREDITS.md`). Chaves e áreas (células em x por z):

| Chave | Área | Chave | Área |
|---|---|---|---|
| `house-0` terreno vazio | 2x2 | `plaza` praça | 2x2 |
| `house-1` tenda | 2x2 | `park` parque | 2x2 |
| `house-2` casa de barro | 2x2 | `market` mercado | 2x4 |
| `house-3` casa de pedra | 2x2 | `workshop` oficina | 3x3 |
| `house-4` casa grande | 2x2 | `granary` celeiro | 3x3 |
| `field-0`…`field-3` trigo, cevada, lentilha, linho | 2x2 | `altar` (restaurado), `altar-ruin`, `altar-new`, `works-1` | 4x4 |
| `fisher` pescador, `gatherer` coletora | 2x2 | `temple` templo consagrado, `temple-0..3` etapas, `rise-3/4`, `works-2..5` | 6x6 |
| `lumber` lenhador, `quarry` pedreira | 2x2 | `pasture` pasto (cerca de pedra solta com porteira, abrigo de palha, cocho, pedra de sal; por código) | 3x3 |
| | | `road` rua | 1x1 |
| `olive`, `palm`, `rock`, `shrub`, `stump` toco, `sapling` muda, `closed` portão trancado | 1x1 | `up-<tipo>-2`/`-3` acréscimos | área do prédio |
| `trail`/`trail-arm` trilha e braço até a rua ao lado, `kerb` borda de pedra, `loose`/`loose-arm` rua fora da rede (tracejada), `pane` vidro aceso, `yard-1`/`yard-2` quintal (jarros, varal) | 1x1 | `stock-1..3` estoque no pátio | 3x3 (celeiro) |
| | | `craft-1..5` ofício no pátio (ferraria, carpintaria, tecelagem, tinturaria, curtume) | 3x3 (oficina) |

```json
{ "temple": { "file": "templo.glb", "rotationDeg": 180 }, "palm": { "file": "palmeira.glb", "scale": 0.012 } }
```

Sem `scale`, o modelo é encaixado na área da chave. Exporte com a frente para `+z` e a base em `y = 0`.
Cada .glb é achatado em partes, uma por material, e instanciado como os modelos por código. Um
arquivo que não carrega (sem internet antes do primeiro uso) fica com o modelo por código.
`olive.glb` está na pasta mas fora do manifesto: aparece centenas de vezes e pesaria demais. `plaza.glb`
também saiu do manifesto: o toldo sobre postes lia como tenda; a praça é o modelo por código (lajes
claras em dois tons, toldo de linho ocre sobre uma esteira, bancos e uma figueira; sem poço nem fonte).

No pacote hoje: `house-1..4`, `market`, `lumber`, `quarry`, `temple`, `workshop`, `fisher`,
`gatherer`, `altar` (bloco de pedras brutas com chifres, rampa e brasas; `scale: 3.0` para não encher
os 4x4, o fogo do código fica no topo dele) e `park` (gramado murado com oliveiras e fonte).
`granary` (celeiro) foi para o pacote Meshy depois; `plaza` ficou com o modelo por código (a tentativa no
Meshy saiu pior; ver CREDITS.md). Scripts em `scripts/meshy/` (gerar, empacotar a
1024 px, simplificar).

Os acréscimos `up-granary-2/3`, `up-market-2/3` e `up-workshop-2/3` são sempre por código, por cima do
modelo (mesmo giro e altura): celeiro com andar de pedra, portal e toldo no terraço; mercado com toldo
azul e, no 3, colunata de pedra; oficina com quarto de pedra no teto da oficina de trabalho (1,6 de
altura, no fundo à esquerda, como no modelo Meshy), prateleira de jarros e, no 3, chaminé alta sobre o
forno (`KILN` em `plan.ts`, de onde saem também a fumaça e o fogo da noite).
Também são sempre por código: as ruas pelo movimento (`roads.ts`: trilha, rua com borda escura e sulcos, e lajes com meio-fio de
pedra pela gente que passa a caminho do altar; limites em `look3d.json` > `roads`), o estoque no pátio do celeiro ligado (`stockLevel`, pela fração
comida/capacidade, limites em `visual.json` > `moments.granaryStock`) e o quintal das casas com gente (`yardOf`:
variante % 3 dá nada, jarros com vaso ou varal, no canto da frente do lado do espelhamento; a
tenda sempre à direita, longe da fogueira; posição em `YARD_AT`) e o ofício da oficina (`craft-1..5`
pela variante, no canto da frente do pátio, sobre o piso elevado do modelo Meshy: `CRAFT_FLOOR`).
Casa vazia que guardou o nível: tom `VACANT_TINT` (< 0,8), que os shaders desbotam (cinza empoeirado)
e apagam as janelas, sem fumaça, e o portão `closed` diante da porta (`CLOSED_AT`).
Janelas das casas .glb: os modelos Meshy não têm peça escura de janela para o shader acender, então
a casa de barro (na porta), a casa de pedra e a casa grande com gente ganham `pane` (vidro quente com
halo, somado à luz, preto de dia) na janela e na porta (`WINDOWS_AT` em `plan.ts`, posições medidas nos modelos; `panesOf`).
Só entram quando o modelo veio do pacote (`Prototype.glb`); a fumaça dessas casas sai do alto do
modelo (`Prototype.top`), não de dentro dele. Se o pacote for trocado, meça de novo as posições.

## Início

A câmera abre centrada no altar, na vista padrão (`yawOfRotation(0)`).

## Medir

`node scripts/view3d-perf.mjs`: quadros por segundo num celular simulado (veja `docs/TESTING.md`).

## Estilo Foundation (2026-11-12)

Veja `docs/referencia-foundation.md`. O que mudou no visual (tudo em números de `look3d.json`):
- **Chão**: o gramado é verde vivo e a "areia" do core vira prado seco amarelo-esverdeado (mesma célula,
  outra cor); a borda gramado/prado é irregular (ruído), manchas largas de turfa amarelada ao sol e
  sombreada, flores silvestres em manchas (azul, branco, amarelo, laranja; `uFlowers` por estação) e
  rocha nua no alto das colinas (`uRock`). Sombras de nuvens sempre presentes (`cloudShadow`).
- **Vegetação**: `tuft` (capim) em tufos agrupados, mais alto e cheio junto às estradas, casas, árvores
  e pedras (`detail.ts`, `edgeShare`/`edgeScale`); `flowers`/`flowers-b` (canteiros de flores 3D, só nas
  estações com flores); arbusto redondo `shrub` (2 lóbulos) espalhado e junto às casas
  (`gardenBushes` em `plan.ts`); `oak` (carvalho de copa larga), `pine` (pinheiro) e `wood` (árvore barata
  da mata de fora) como modelos novos; as células de oliveira viram uma parte de carvalhos e as de palmeira
  uma parte de pinheiros (`countryTree`, só visual); rochas com musgo. Cada cópia de planta tem um tom
  um pouco diferente (`PatchOptions.hue`).
- **Caminhos**: manchas de gramado sobre a borda das ruas de terra (`verge`, `vergePieces` em `roads.ts`) e
  cruzamentos mais gastos (`wear.junction`).
- **Campos**: cevada e linho cercados de madeira, trigo e lentilha com o muro de pedra: colcha de retalhos.
- **Luz**: sol mais baixo e quente (elevação por estação), céu azul mais forte, nuvens grandes e fofas
  (sempre alguma, com lado iluminado), névoa azulada que começa mais perto (`fog`), rebote verde do chão.
- **Câmera**: chega mais perto (`DIST_MIN` 4,5) e mais baixa (inclinação 0,5 rad de perto).

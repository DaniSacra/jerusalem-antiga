# Arte: o que o 2D tinha e o 3D ainda não tem (2026-11-06)

Auditoria só de leitura (sprite-artist). Pedido do usuário: "a cidade 3D está menos bonita e
detalhada que o 2D; o jogo é contemplativo, o visual é o principal".

Fontes lidas: tag `ultimo-2d` (`src/render/textures.ts` 4 078 linhas, `MapView`, `Ambient`,
`DayNight`, `Lights`, `Seasons`, `Weather`, `Effects`, `FinishPipeline`, `RoadWear`, `Fieldhands`,
`Haulers`, `Walkers`, `residents`, `fauna`, `src/data/visual.json`); `docs/design.md` (Pacote 5
"Cidade densa", "Variedade visual", "Cidade bonita" parte 4); `docs/arte-3d-referencia.md`;
`src/render3d` inteiro (README, `plan.ts`, `world.ts`, `terrain.ts`, `shaders.ts`, `models.ts`,
`life.ts`, `ambient.ts`, `stage.ts`, `look3d.json`). Capturas novas: uma rodada de
`town3d-pc` (PC 1366 x 768, outono, de dia) e as `ui3d-pc-*` já existentes. Não há capturas do 2D
guardadas; o 2D foi avaliado pelo código de desenho.

## Resumo

O 3D ganhou o que o 2D não podia ter: sol de verdade com sombras projetadas, relevo, céu com
gradiente, estrelas e nuvens, neve que pousa só nas faces de cima, folhas e pétalas no vento,
chuva com respingos, poças, sombra de nuvens, câmera livre. **Clima, luz e efeitos de evento estão
iguais ou melhores.**

O que ficou mais pobre é justamente o que fazia o 2D parecer uma **maquete pintada à mão**:

1. **Casas todas iguais.** O 2D tinha 6 desenhos por nível (24 casas diferentes, mais espelho e tom).
   O 3D tem **1 modelo Meshy por nível**; a única variação é um quintal (nada, jarros ou varal) e
   ±4% de tom. Uma rua de casas de barro é a mesma casa repetida.
2. **Chão liso.** O 2D tinha, em cada célula, manchas, grão, tufos de capim, flores, seixos, ondas de
   areia, terra batida e trilhas entre casas. O 3D pinta o chão com **um vértice por célula**:
   de perto é um degradê sem textura (bem visível em `town3d-pc-river.png`).
3. **Ruas são caixas chapadas.** O 2D tinha borda pisada, meio-fio escuro, sulcos de roda, pedras
   na beira, seixos e lajes nas ruas movimentadas. O 3D tem um quadrado de cor (com borda de pedra
   nas ruas cheias).
4. **Campos e árvores parados.** No 2D cada tufo de trigo balançava e as palmeiras se curvavam ao
   vento; havia amendoeiras que floresciam e figueiras que amareleciam. No 3D os campos são 5 barras
   verdes e as árvores são 2 bolhas, **sem nenhum movimento**.
5. **A noite perdeu as janelas.** As janelas acesas existem no shader, mas só nas peças de cor
   `COLORS.dark` dos modelos por código. As casas vêm do Meshy e o material delas recebe
   `patch(material)` sem `windows`: **casa nenhuma acende janela à noite** (no 2D, casa de pedra
   ou casa grande tinha duas janelas com halo).
6. **Sem acabamento de maquete.** O 2D passava vinheta, desfoque de miniatura (tilt-shift) e
   tremor de calor na imagem. O 3D tem tom ACES e neblina, mas nenhum passe de acabamento.
7. **A vida parada da rua e dos telhados quase não veio.** Telhados com toldos, esteiras, figos
   secando, varais e potes; tenda com cabras amarradas e manjedoura; forno tabun aceso no quintal;
   parreira com uvas: tudo isso estava desenhado nas casas do 2D e sumiu.

Nenhuma dessas faltas é cara por quadro se for feita do jeito certo (instancing, shader, dados
assados ao montar a cidade). Há folga: 150 construções medem hoje ~56 chamadas e ~210 mil
triângulos, com teto de 120 chamadas e 300 mil triângulos (`docs/arquitetura-3d.md`).

---

## 1. Inventário: 2D x 3D

Legenda: **igual** (ou melhor) / **mais pobre** (como) / **falta**.

### 1.1 Chão e terreno

| Detalhe do 2D | 3D hoje | Situação |
|---|---|---|
| 4 variantes de tom por célula de grama e de areia, manchas grandes e grão fino (`groundTile`) | cor por vértice (1 por canto de célula) + ruído `hash` por vértice | **mais pobre**: de perto é degradê liso, sem grão |
| Tufos de capim (3 hastes) em toda célula de grama | nenhum; só arbustos `shrub` (bolha) em 35% da grama | **mais pobre** |
| Flores silvestres em grupos (anêmonas vermelhas, brancas, amarelas, lilás na primavera; 1 no outono) | pontos de cor no shader, só primavera | **mais pobre**: pontos planos, sem tufo nem cor do outono |
| Seixos com sombra na areia; ondas de vento na areia | nada | **falta** |
| Decoração extra em 15% das células (arbusto redondo com sombra) | `shrub` em 35% da grama | **igual** |
| Terra batida na frente das portas e na borda das ruas (P5) | nada | **falta** |
| Trilhas pisadas entre casas a 1–3 células (`drawTrails`) | `trail`/`trail-arm` nas ruas pouco usadas (é rua, não trilha entre casas) | **falta** (a trilha entre casas) |
| Lados do diorama nas duas bordas da frente | saia de terreno com 900 árvores sumindo na neblina | **melhor** no 3D (não recomendo voltar o diorama) |
| Sombra de cada construção, árvore e rocha assada no chão | sombras reais do sol | **melhor** no 3D |
| Relevo | plano no 2D; no 3D ondula fora da cidade e aplaina sob ela | **melhor** no 3D |

### 1.2 Ruas

| Detalhe do 2D | 3D hoje | Situação |
|---|---|---|
| Borda pisada suave + meio-fio escuro nítido (lê no zoom mínimo) | caixa 1 x 1 de cor só (`road()`), tom ±6% por célula | **mais pobre**: sem borda, as ruas viram quadrados no chão |
| Sulcos de roda nos braços da rua | nada | **falta** |
| Pedras gastas na beira de cada braço, seixos no meio | só `kerb` (pedra de borda) nas ruas de muito movimento | **mais pobre** |
| Desgaste por passos (`RoadWear`): terra → gasta e mais larga → lajes de pedra; lajes perto do altar e templo | `roadLevel`: trilha → rua → rua com borda de pedra; perto do sagrado já é rua | **igual** na regra; **mais pobre** no desenho (não há lajes) |
| Poças nas ruas depois da chuva | poças instanciadas brilhantes | **igual** |
| Rua desligada do altar apagada e tracejada | não há diferença | **falta** (leitura, não só beleza) |

### 1.3 Rio

| Detalhe do 2D | 3D hoje | Situação |
|---|---|---|
| Faixa funda no meio do rio | leito afundado e água com transparência | **igual** |
| Linhas de correnteza descendo o rio | mapa normal de ondinhas correndo, mais forte na chuva e no vento | **igual** |
| Margem de areia clara (linha de 5 px) | nada; areia/grama encostam na água | **mais pobre** |
| Margem vira lama rachada na seca, rio mais estreito | rio baixa (`drop`) e mostra o leito de lama | **igual** |
| Barcos de pesca, lavadeiras esfregando | barcos e lavadeiras (`ambient.ts`) | **igual** |
| (não havia) juncos, pedras na beira, brilho do sol | nada | oportunidade |

### 1.4 Árvores e vegetação

| Detalhe do 2D | 3D hoje | Situação |
|---|---|---|
| Oliveira: tronco torto em 2 traços, copa de 4 bolhas com sombra, luz e pontinhos escuros; espelhada | tronco cilíndrico + 2 bolhas (`olive()`), rotação e escala aleatórias | **mais pobre**: lê "bola verde" (em outono vira bola ocre, ver `town3d-pc-river.png`) |
| Palmeira: tronco de 8 gomos curvo, 8 folhas em duas camadas, cachos de tâmara | 3 cilindros + 7 folhas planas retas + 1 bolha | **mais pobre** (folhas não caem, lê como hélice) |
| Amendoeira (30% das oliveiras): flor na primavera, folha, galhos nus no inverno | não existe | **falta** |
| Figueira (18%): folha larga, amarela no outono, nua no inverno | não existe (só a figueira da praça e da casa grande) | **falta** |
| Balanço ao vento (palmeira 1,6°, outras 0,7°) | nada se mexe | **falta** |
| Cor da folha por estação | cor da folha por estação (`leaf`, `leafDark`) | **igual** |
| Neve na copa | neve no shader nas faces de cima | **igual** |
| Toco com raízes; toco de palmeira com broto | toco cilíndrico; muda crescendo (`sapling`) | **igual** (o 3D até mostra a muda crescendo) |
| Rochas: bloco com luz e sombra | 2 bolhas achatadas | **mais pobre** |

### 1.5 Campos

| Detalhe do 2D | 3D hoje | Situação |
|---|---|---|
| Socalco de terra lavrada com muro de pedra solta (`rubble`) | caixa de solo 1,9 x 1,9 | **mais pobre**: sem muro, sem socalco |
| 4 culturas desenhadas: trigo (espigas gordas), cevada (com barba), lentilha (moitas), linho (flor azul) | 5 barras (caixas) com a cor da cultura | **mais pobre**: de perto são barras, não plantas |
| Tufos que balançam um a um | nada se mexe | **falta** |
| Linho com canal de água na frente | nada | **falta** |
| Fase do ano por cor e altura (broto, verde, maduro, ouro, palha, lavrado) | fase por cor + altura (`uGrow`) | **igual** na cor; **mais pobre**: altura é **uma só para todos os campos** (uniforme global) |
| Seca afina e amarela os campos longe do rio | não distingue campo perto do rio | **falta** |
| Agricultores capinando e se abaixando, com passinho no sulco, entre as fileiras | gente curvada no campo, balançando | **igual** |
| Capim na borda do socalco | nada | **falta** |

### 1.6 Casas

| Detalhe do 2D | 3D hoje | Situação |
|---|---|---|
| Terreno vazio: 2 variantes (estacas e corda com valas, cesto, maço; ou pedras com trenó e jarro) | um curso de alicerce e 2 pedras | **mais pobre** |
| **Tenda: 6 variantes** (listrada, remendada, dupla, com toldo, com fogueira e tripé com panela, com cabras amarradas e manjedoura) | 1 tenda Meshy | **mais pobre** (muito) |
| **Barro: 6 variantes** (simples, com anexo, escada externa, forno tabun aceso, cercado, jarros); pontas de viga; tijolos desenhados | 1 casa Meshy | **mais pobre** (muito) |
| **Pedra: 6 variantes** (janela, varal, parreira com uvas subindo a parede, arco, dois andares, pátio); alvenaria em fiadas | 1 casa Meshy | **mais pobre** (muito) |
| **Casa grande: 6 variantes** (pátio de 4 cômodos com tear, forno e cisterna; figueira no pátio; toldo largo no telhado; escadaria; em L com cisterna, cocho e manjedoura; jardim) | 1 casa Meshy (casa-torre de 2,5 de altura, sem pátio: já anotado em `arte-3d-referencia.md`) | **mais pobre** (muito) |
| Espelho, pequeno deslocamento e tom por lote; vizinhas do mesmo nível nunca repetem variante | só tom ±4%; o `mirrored` do core só escolhe o lado do quintal | **mais pobre** |
| Vida no telhado: toldos listrados, esteiras de junco, potes, varal, tapete vermelho, figos secando | o que o Meshy pôs (jarros em `house-2`) | **mais pobre** |
| Quintal: jarros, varal | `yard-1` jarros e vaso, `yard-2` varal (1/3 das casas cada) | **igual** em ideia; varal não balança |
| Andaime de madeira com poeira ao construir e subir de nível; pulinho no fim | andaime, poeira e pulinho (`fx.ts`) | **igual** |
| Casa vazia: porta fechada | desbotada e empoeirada, portão trancado, sem janela nem fumaça | **melhor** no 3D |
| Janelas acesas à noite (pedra e casa grande, 2 janelas com halo) | shader existe, mas os .glb não recebem `windows` | **falta** na prática |

### 1.7 Outras construções

| Detalhe do 2D | 3D hoje | Situação |
|---|---|---|
| Praça: lajes alternadas com rejunte, árvore em canteiro, toldo de linho caído com franja, banco, **dois vizinhos conversando** | lajes em 2 tons, toldo ocre, bancos, figueira (código) | **igual**, menos os vizinhos |
| Parque: caminhos em cruz, canteiro redondo, sombras, bancos | Meshy (retexturizado): gramado murado, oliveiras, fonte | **igual** |
| Mercado: 2–4 bancas por lado conforme o nível, **compradores no corredor**, jumento com cestos | Meshy + toldo azul (2) e colunata (3); jumento amarrado ao lado | **mais pobre**: sem compradores parados |
| Celeiro: salão de calcário, eira, silos com faixas, escada, toldo, sacos e jarros enchendo com o estoque, sacos no telhado quando cheio | código: pátio, 3 silos, armazém; `stock-1..3`; acréscimos 2–3 | **igual** |
| Oficina: **6 desenhos inteiros** (olaria com forno e rodas, ferraria com forja vermelha, carpintaria, tecelagem com tear e toldo listrado, tinturaria com tinas azul/vermelha/amarela, curtume com couros em armação) | 1 olaria Meshy + um objeto do ofício no canto (`craft-1..5`) | **mais pobre**: de longe todas parecem olaria |
| Pescador: cabana de junco, rede secando com boias, barco, varal de peixe | cabana, varal de peixe, barco (Meshy) | **igual** |
| Coletora: figos secando no telhado e no chão, vara de bater oliva, cestos cheios | Meshy | **igual** |
| Lenhador: cabana de toras, feixes, tronco, cepo com machado, lascas | Meshy (cabana de toras, já anotado como fora do Levante) | **igual** |
| Pedreira: bancada em degraus, bloco meio cortado, guindaste, blocos empilhados, canteiro com picareta, **poeira enquanto corta** | Meshy, sem poeira | **mais pobre** (falta a poeira contínua) |
| Altar: pedras brutas, chifres, rampa, lenha e cinza, jarro e bacia, muro do pátio | Meshy (pedras, chifres, rampa) + fogo do código | **igual** no modelo; o **fogo é um cone laranja chapado** (`town3d-pc-altar.png`) |
| Templo: plataforma, escadaria, pátio lajeado, pórticos, santuário com cornija de ouro, duas colunas soltas, pia, altar, portaria e torres | Meshy que lê grego/romano (anotado em `arte-3d-referencia.md`) | **mais pobre** (e é "a construção mais bonita da cidade") |

### 1.8 Gente

| Detalhe do 2D | 3D hoje | Situação |
|---|---|---|
| 12 tipos de morador com objeto grande (jarro, cesto, saco, foice e feixe, cajado, avental, pote, ânfora, martelo, tábua, rolo de pano, panos tingidos, couro, tora) | os mesmos tipos e objetos (`crowd.ts`, `figures.ts`), roupas por idade e sexo | **igual** (melhor: turbante, manto, idosos curvados) |
| Menos gente à noite, mais no fim da tarde, menos na chuva | igual (`crowd`) | **igual** |
| Família de caravana com jumento; **recém-casados de mãos dadas** | famílias e caravanas em grupo com jumento | **mais pobre**: sem o casal de mãos dadas |
| **Família que abandona a tenda saindo a pé pela entrada** | não aparece | **falta** |
| Carregadores de saco na colheita, pescador indo à margem, coletora à árvore | `Haulers` | **igual** |
| **Colhedores de oliva e figo no outono** (batendo galhos com vara, se abaixando) | não existe | **falta** |
| Gente que vem festejar um marco com pulinhos | `gather` | **igual** |
| Figuras paradas na frente das casas (P5 B: vizinhos, criança brincando) | não existe (o 2D também não chegou a fazer, mas estava aprovado) | **falta** (nos dois) |

### 1.9 Bichos e vida ambiente

| Detalhe do 2D | 3D hoje | Situação |
|---|---|---|
| Cabra e galinhas ao lado das tendas | igual (metade das tendas) | **igual** |
| Jumento amarrado no mercado | igual | **igual** |
| Rebanhos de ovelhas pastando | igual | **igual** |
| Pombas no altar que voam quando alguém passa | pombas que voam a cada 14 s | **igual** |
| Varais em 1 de cada 3 casas, panos balançando | `yard-2` parado | **mais pobre** (parado) |
| Sombras de nuvens | sombras de nuvens no shader + nuvens no céu | **melhor** no 3D |

### 1.10 Dia, noite e luzes

| Detalhe do 2D | 3D hoje | Situação |
|---|---|---|
| Tinta de cor por hora (aurora, manhã, tarde, pôr do sol, noite) e cor do céu | sol, lua, céu em gradiente, hemisfério e neblina por hora | **melhor** no 3D |
| Estrelas | estrelas piscando | **igual** |
| Janelas acesas (2 por casa de pedra ou grande) | não acendem nas casas Meshy (ver 1.6) | **falta** |
| Fogueira das tendas com faíscas (até 6) | chama, halo e poça de luz, **sem faíscas** | **mais pobre** (pouco) |
| Fogo do altar com brilho grande | `Fire` + halo; a chama é um cone de 5 lados chapado | **mais pobre** |
| Forja/forno das oficinas brilhando | fogo no forno | **igual** |
| Lamparinas nas ruas perto do altar e do mercado | braseiros nas ruas principais | **igual** |

### 1.11 Fumaça e fogo

| Detalhe do 2D | 3D hoje | Situação |
|---|---|---|
| Fumaça de chaminé/tabun: pouca no ano, de toda casa no inverno | igual em regra (`Smoke`, pela estação e pela noite) | **igual** na regra |
| Sem lenha, as chaminés esfriam (`state.cold`) | o 3D **não lê `s.cold`**: casa sem lenha continua fumegando | **falta** (regressão; também é aviso para o jogador) |
| Partículas macias de fumaça | icosaedros chapados semitransparentes | **mais pobre** de perto (lê "pedrinhas cinza") |
| Poeira da pedreira | nada | **falta** |

### 1.12 Clima e estações

| Detalhe do 2D | 3D hoje | Situação |
|---|---|---|
| Chuva em 3 forças, inclinada pelo vento, respingos | igual (GPU), com respingos em anel | **igual** |
| Neve rara (1 inverno em 5), chão, telhados e árvores brancos | neve no shader nas faces de cima, com ruído | **melhor** no 3D |
| Chão molhado e telhados mais escuros, poças enchendo e secando | `uWet` (escurece e dá brilho) + poças | **igual** |
| Pétalas de amendoeira na primavera, poeira no verão | pétalas, poeira, **e folhas no outono** | **melhor** no 3D |
| Seca: terra rachada, capim marrom, rio estreito, campos ralos longe do rio | rachaduras no shader, cores, rio baixo; campos não | **igual**, menos os campos |
| Transição de estação célula a célula (`turn`) | transição suave em `blendWeeks` | **igual** |
| Tremor de calor no verão (passe de imagem) | tremor do terreno distante (vértice) | **igual** |

### 1.13 Acabamento da imagem

| Detalhe do 2D | 3D hoje | Situação |
|---|---|---|
| Vinheta suave (`FinishPipeline`) | nada | **falta** |
| Desfoque de miniatura no alto e embaixo (tilt-shift, "maquete") | nada | **falta** |
| — | tom ACES, neblina de distância, antialias | **melhor** no 3D |
| Oclusão "assada" (cantos e pés escuros) | sombra do sol; sem oclusão de contato quando o sol está fraco (noite, nublado, chuva) | **mais pobre** com tempo fechado: prédios "flutuam" |

### 1.14 Efeitos de evento

| Detalhe do 2D | 3D hoje | Situação |
|---|---|---|
| Anel de luz no chão | anel | **igual** |
| Momento do templo: anéis dourados, brilhos, clarão | festa do templo, faíscas, halo | **igual** |
| Brilho dourado pulsando sobre o prédio do marco | brilho e faíscas do marco | **igual** |
| Árvore cortada tombando, mofo com moscas | igual | **igual** |
| Demolir: poeira; prédio piscando em vermelho sob a ferramenta | poeira e pedrinhas; vermelho no fantasma | **igual** |

---

## 2. Por que o 3D parece mais pobre (diagnóstico)

- **Repetição.** Variedade é o que fazia a cidade 2D parecer "feita à mão". Hoje o olho vê a
  mesma casa 10 vezes. É o maior problema e o mais visível em qualquer zoom.
- **Falta de frequência alta.** O 2D tinha detalhe em toda escala: célula (tufos, seixos), rua
  (sulcos, pedras), casa (fiadas, vigas, toldos). No 3D, entre o tamanho de uma casa e o de um
  morador quase não há nada: o chão, as ruas e os campos são planos de cor.
- **Nada se mexe além da gente.** Trigo, palmeiras, varais, toldos e fumaça parados (ou fumaça em
  pedrinhas). Num jogo contemplativo o movimento leve do vento é metade da beleza.
- **A noite fica escura e vazia.** Sem janelas acesas, a cidade à noite é só braseiros e tendas.
- **Sem a "lente de maquete".** A vinheta e o tilt-shift davam o clima de miniatura que a
  referência (câmera alta, maquete) pede.

---

## 3. Melhorias propostas, em ordem

Estimativa em horas de trabalho de agente (código + capturas + testes puros onde houver lógica).
Risco por quadro no celular: **baixo** (custo só ao montar a cidade ou só no shader de vértice),
**médio** (mais pixels ou mais instâncias animadas; precisa de corte por qualidade), **alto**
(evitar ou só na qualidade alta).

| # | Melhoria | O que fazer | Horas | Risco por quadro |
|---|---|---|---|---|
| 1 | **Janelas acesas nas casas Meshy** | Ao carregar o .glb, marcar as partes de janela e porta: ou um quadrinho emissivo por código em posições fixas por modelo (`WINDOWS_AT` por chave, como `CLOSED_AT`), ou máscara pela luminância escura da textura no shader `windows`. Portas com luz quente baixa; janelas por casa sorteadas como hoje (`vInst`). | 3–5 | baixo |
| 2 | **Variantes de casa (6 por nível) + espelho** | Manter a malha Meshy de cada nível e somar um **kit por código** escolhido pela `variant`: tenda (listras, remendos, toldo, tripé com panela, cabras amarradas e manjedoura), barro (anexo, escada externa, forno tabun, cercado, pontas de viga), pedra (parreira com uvas, arco, varal no terraço, meio andar), casa grande (toldo largo, figueira no pátio, cisterna, tear). Espelho: protótipo espelhado assado (InstancedMesh não inverte a face por instância). Telhados com vida: esteira, potes, figos secando, tapete. Regra "vizinhas não repetem" já vem do core. | 12–16 | baixo (+10–20 chamadas, ~300–800 triângulos por casa) |
| 3 | **Chão com detalhe e desgaste** | (a) Ruído fino no shader do terreno (grão, manchas de 2–3 células, ondas na areia), custo só de fragmento. (b) Tufos de capim, seixos e flores instanciados e **assados por pedaço do mapa** (sem objeto por célula por quadro), sumindo no zoom mínimo. (c) "Mapa de desgaste" 48 x 48 (`DataTexture`) com terra batida na frente das portas, ao redor das ruas e nas trilhas entre casas a 1–3 células; refeito só quando a cidade muda. | 10–12 | médio (fragmento + 1–2 chamadas; tufos desligados na qualidade mínima) |
| 4 | **Ruas acabadas** | Trocar a caixa por uma superfície que usa o mesmo mapa de desgaste: borda pisada macia, meio-fio escuro (lê no zoom mínimo), sulcos, pedrinhas; nível 3 vira **lajes** com rejunte (não só a borda). Rua desligada: apagada e tracejada (leitura que o 2D tinha). | 6–8 | baixo |
| 5 | **Vento: trigo, árvores, varais, toldos** | Balanço no shader de vértice por altura (peso pelo `y` do modelo), força pelo `wind` do clima: palmeiras mais, oliveiras pouco, rochas nada; panos de varal e toldos com ondulação. Uma uniform, zero CPU. | 4–6 | baixo |
| 6 | **Campos de verdade** | Fileiras de tufos instanciados por cultura (espiga de trigo, cevada com barba, moitas de lentilha, linho com flor azul), muro de pedra solta no socalco, capim na borda, canal de água no linho. Altura por campo (atributo de instância pela semana de semeadura) e campo ralo/amarelo longe do rio na seca. Usa o balanço do item 5. | 8–10 | médio (~700 triângulos por campo; 30 campos ≈ 21 mil) |
| 7 | **Árvores mais ricas + amendoeira e figueira** | Oliveira de tronco torto com 4–5 lóbulos em claro/escuro (cor por vértice), palmeira com folhas caídas em arco e cachos; amendoeira (flor branco-rosada na primavera, galhos nus no inverno) e figueira (folha larga, amarela no outono, nua no inverno) em 30% e 18% das oliveiras, como no 2D (`visual.json > seasons.treeShare`, `phases`). Rochas em bloco com faces. ≤ 150 triângulos por árvore; na saia, a versão simples sem balanço. | 6–8 | médio (centenas de árvores: segurar o polycount) |
| 8 | **Acabamento de maquete** | Um passe final barato: vinheta + desfoque de miniatura no alto e embaixo (metade da resolução, 9 leituras como no 2D) + leve gradação quente. Só nas qualidades alta e baixa; desliga na mínima e quando a qualidade cai. Opcional: sombra de contato macia (decalque escuro sob cada prédio, instanciado) para os dias nublados e a noite. | 4–6 | médio (passe de tela cheia; cortado por qualidade) |
| 9 | **Vida parada na rua e no outono** | Até 40 figuras paradas que crescem com o nível da casa (vizinhos conversando, criança brincando, mulher no forno, idoso sentado), compradores parados no mercado, colhedores de oliva e figo no outono, recém-casados de mãos dadas, família saindo pela entrada ao abandonar a tenda. Plano puro e testado (como `ambient.ts`), desenho com `figures.ts`. | 10–12 | médio (figuras instanciadas; somem no zoom mínimo e fora da câmera) |
| 10 | **Fumaça, fogo e poeira** | Fumaça em sprites macios (textura radial, billboard) no lugar dos icosaedros; fogo do altar em camadas com brasas e faíscas subindo; faíscas nas fogueiras das tendas; **chaminés frias quando `s.cold`** (o 2D fazia, é aviso de inverno); poeira lenta na pedreira enquanto trabalha. | 4–6 | baixo |
| 11 | **Templo por código** (a mais bonita) | Plataforma em degraus, escadaria, pátio lajeado, pórtico simples nos fundos, santuário alto de calcário com cornija dourada discreta, as duas colunas soltas, pia de bronze, altar de pedras brutas, muro com portaria. Sem ameias nem frontão. | 8–12 | baixo (≤ 4 000 triângulos) |
| 12 | **Oficinas por ofício + mercado vivo** | Cada ofício muda a silhueta e a cor dominante (forja escura com brilho vermelho, toras amarelas, tear sob toldo listrado, tinas azul/vermelha/amarela, couros em armação); o modelo base vira só o pátio. Mercado com mais bancas por nível e mercadoria colorida. | 6–8 | baixo |
| 13 | **Rio: margem e juncos** | Faixa de areia clara úmida na beira (shader do terreno, pela fração de rio já em `aGround`), juncos e pedras instanciados na margem perto da cidade, brilho do sol na água à tarde. | 3–5 | baixo |
| 14 | **Terreno vazio com obra** | As 2 variantes do 2D: estacas, corda e valas com cesto e maço; ou pedras com trenó e jarro. | 2–3 | baixo |

Total: ~86–117 h. Os itens 1, 5 e 10 são rápidos e mudam muito a sensação (≈ 12–17 h juntos).

### Ordem sugerida em entregas (cada uma com capturas de perto e de longe, dia e noite, celular e PC)

- **Entrega 1 "Noite e vento" (≈ 12–17 h):** itens 1, 5, 10. Mudam a cidade inteira com risco baixo.
- **Entrega 2 "Casas e chão" (≈ 28–36 h):** itens 2, 3, 4. O grosso da variedade e do detalhe.
- **Entrega 3 "Campo e árvores" (≈ 17–23 h):** itens 6, 7, 13.
- **Entrega 4 "Maquete e vida" (≈ 14–18 h):** itens 8, 9.
- **Entrega 5 "Prédios nobres" (≈ 16–23 h):** itens 11, 12, 14.

### Regras de custo para todas

- Nada novo animado por CPU por objeto: balanço e ondas no shader de vértice; o que é por objeto
  (tufos, figuras paradas, kits de casa) é montado só quando a cidade muda (`World.buildCity`).
- Medir com `scripts/view3d-perf.mjs` antes e depois de cada entrega: ≥ 30 qps no celular
  simulado com 150 construções, ≤ 120 chamadas, ≤ 300 mil triângulos (hoje ~56 e ~210 mil).
- Tufos, figuras paradas e desfoque de miniatura somem na qualidade mínima e no zoom mínimo;
  balões e moradores continuam acima de tudo.
- Lógica nova de aparência (qual kit por variante, mapa de desgaste, quem fica parado onde, fase da
  amendoeira e da figueira, altura por campo) em módulos puros com testes em `tests/render3d`.

## 4. O que manter como está

Luz do sol e sombras, céu, estrelas, neblina, neve, chuva, poças, folhas e pétalas, sombra de
nuvens, casa vazia desbotada com portão, andaime e pulinho, efeitos de evento, moradores e
carregadores, bichos e barcos. Não vale voltar os lados do diorama: a saia com árvores sumindo na
neblina fica melhor em 3D.

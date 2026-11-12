# Modelos Meshy (prova 3D)

Gerados no Meshy (text-to-3D) em 2026-11-04 (1.ª e 2.ª leva) e 2026-11-05 (3.ª leva, no fim) e
usados pela visão 3D do jogo (`src/render3d`; o manifesto deixa `olive` e `plaza` de fora; altar e parque entraram na 4.ª leva). Scripts
em `scripts/meshy/` (no main desde a 3.ª leva; `remesh.mjs` e `shots.mjs` só no branch `spike/threejs`):
`generate.mjs` (preview e refine), `pack.mjs` (textura reduzida a 1024 px JPEG), `simplify.mjs`
(versão leve local com meshoptimizer), `remesh.mjs` (Remesh do Meshy, testado e descartado),
`shots.mjs` (capturas da prova com e sem o pacote). Prompts atuais em `scripts/meshy/prompts.json`; ids de todas
as tarefas em `scripts/meshy/tasks.json`.

Configuração: preview `model_type: smart-topology`, `ai_model: meshy-t2.5`, `target_polycount` por
modelo (triângulos); refine com textura 2k sem PBR (reduzida depois para 1024 px). Custo: 5 créditos
(preview) + 10 (refine) = 15 por modelo.

Estilo comum, no fim de todos os prompts:
"Stylized low-poly game asset, desert colors (sand, ochre, mud brick, pale limestone, olive green),
neutral lighting, flat base, single centered object, no extra ground beyond the base."

Triângulos e tamanho atuais (versão leve da 2.ª leva); entre parênteses, a 1.ª leva.

| Chave | Arquivo | Triângulos | Tamanho | Tentativa | Preview | Refine | Créditos |
|---|---|---|---|---|---|---|---|
| `house-1` tenda | house-1.glb | 1 799 (2 847) | 296 KB | 1 | 01a1a7cc-e501-7085-8d35-c3b6f3f41e93 | 01a1a7cd-9236-7234-bd2e-15d56146af30 | 15 + 5 |
| `house-2` casa de barro | house-2.glb | 1 799 (3 672) | 257 KB | 1 | 01a1a7cc-e504-700b-bffd-b1ca118883b1 | 01a1a7cd-940d-7019-a23c-4cc20d7e70aa | 15 + 5 |
| `house-3` casa de pedra | house-3.glb | 1 800 (4 786) | 225 KB | 1 | 01a1a7cc-e50a-74b2-9d06-63a2c53aa6b8 | 01a1a7cd-93d4-77f4-add9-da9647dc1e39 | 15 + 5 |
| `house-4` casa grande | house-4.glb | 2 071 (6 776) | 225 KB | 3 | 01a1a7e0-3bf1-7494-b289-d0183fd3730c | 01a1a7e0-ebcd-74c2-9cc4-64ac389b681e | 15 + 15 + 15 |
| `plaza` praça | plaza.glb | 1 999 (3 494) | 283 KB | 2 | 01a1a7cf-5f40-7260-af47-a74cfc2f4417 | 01a1a7cf-e57e-726b-8cc9-b09bc3c26d37 | 15 + 15 + 5 |
| `market` mercado | market.glb | 2 499 (6 726) | 342 KB | 1 | 01a1a7cc-e50f-7365-b69f-371a1bbc4f9e | 01a1a7cd-6a59-70d8-bbf0-93003db37983 | 15 + 5 |
| `lumber` lenhador | lumber.glb | 1 999 (3 727) | 271 KB | 1 | 01a1a7cc-e527-7777-b44b-6f8fee3aaf50 | 01a1a7cd-69c3-7456-9ddc-e7b397179aaf | 15 + 5 |
| `quarry` pedreira | quarry.glb | 1 913 (5 068) | 207 KB | 3 | 01a1a7e2-2d04-77e5-8b6c-c62fdbf393fd | 01a1a7e2-8a12-732c-8ee8-7202e0dff3af | 15 + 15 + 15 |
| `temple` templo | ~~temple.glb~~ (apagado) | 4 151 (7 441) | 354 KB | 2 | 01a1a7cf-5f3e-7185-847c-d9b87013c39c | 01a1a7cf-bc54-7470-949e-70d5eb3cf3a3 | 15 + 15 + 5 |
| `olive` oliveira | olive.glb | 1 235 (1 879) | 212 KB | 2 | 01a1a7cf-5f3e-7680-89b8-1b73cceed271 | 01a1a7cf-e6aa-772c-9758-a6b471c14baf | 15 + 15 + 5 + 15 |

**`temple.glb` apagado (2026-11-07):** o Templo é desenhado por código (`temple()` em
`src/render3d/models.ts`, C8); o arquivo saiu do manifesto e depois do repositório (pacote T0). A linha
acima fica só como histórico dos créditos gastos.

**`plaza.glb` fora do manifesto (2026-11-05):** o toldo sobre postes lia como tenda; a visão 3D usa
a praça feita por código (lajes, poço, bancos, figueira). Nenhum crédito gasto nesta troca.

1.ª leva: 14 tarefas (10 modelos + 4 novas tentativas) = 210 créditos. Saldo: 1066 antes, 856 depois.
2.ª leva: 100 créditos (detalhe abaixo). Saldo: 856 antes, 756 depois. Total gasto: 310.

## 2.ª leva (versão leve, casa grande e pedreira)

- **Remesh do Meshy** (`remesh.mjs`, `topology: triangle`, 5 créditos cada; ids `remeshId` em
  `tasks.json`): feito para house-1..3 (1 800), plaza, lumber (2 000), market (2 500), temple (4 000)
  e olive (800) = 40 créditos. **Descartado**: nessas contagens o Remesh desmanchou paredes finas e
  colunas (templo virou ruína solta, oliveira virou meia dúzia de cacos) e ainda trouxe mapas de
  normal e metal/rugosidade (material metálico por padrão).
- **Versão leve em uso**: `simplify.mjs` (meshoptimizer, local, sem créditos) a partir dos .glb da
  1.ª leva, mantendo UV e a mesma textura 1024 px. Visualmente igual à 1.ª leva nas capturas.
  A oliveira para em 1 235 triângulos: a copa é feita de muitas folhas soltas, que o simplificador
  não pode fundir sem rasgar a textura.
- **Oliveira a 800 gerada direto** (tentativa 3, `olive@3` em `tasks.json`, prompt da tentativa 2 com
  `target_polycount` 800): 15 créditos, **descartada** (copa cinza de lâminas pontudas).
- **Casa grande, tentativa 3** (2 000, gerada já leve): pedra calcária clara embaixo e reboco bege
  em cima, dois andares bem marcados, terraço com parapeito, escada externa de pedra. É a casa mais
  alta da cidade (≈ 2,5 de altura no lote 2 x 2 contra ≈ 1,6 da casa de pedra). Não tem pátio
  interno visível: lê como casa-torre, não como casa de quatro cômodos.
  Prompt: Tall two-storey Judean four-room house of ancient Jerusalem about 500 BC, a compact block
  almost a cube, as tall as it is wide, clearly two full storeys high, ground floor of thick pale
  cream limestone blocks, upper storey of light beige mud plaster, a small open square inner
  courtyard in the middle with stone pillars, flat roof terrace with a low parapet, clay jars and a
  laundry line, outside stone stair climbing one side wall, few tiny windows, one wooden door, no
  balconies, no railings, no arches, not orange, on a square base.
- **Pedreira, tentativa 2** (2 000, `quarry@2`, descartada: sem afloramento, só blocos numa
  prancha, um bloco flutuando e uma haste fina): Limestone quarry of ancient Jerusalem about 500 BC,
  a low pale cream limestone rock outcrop cut into three wide stepped ledges with flat tops and sharp
  vertical cuts, rectangular cut stone blocks stacked on the ground in front, a sturdy wooden crane
  of three thick log poles tied as a tripod with a wooden pulley and a rope lifting one block, a
  hammer and chisels on a block, no pyramid, no thin pole, on a square packed-earth base.
- **Pedreira, tentativa 3** (2 000, em uso): morro de calcário claro com três degraus cortados,
  blocos retangulares empilhados na frente, guindaste de tripé de troncos com roldana e corda.
  Prompt: Limestone quarry of ancient Jerusalem about 500 BC. The main mass is a big solid hill of
  pale cream limestone rock filling most of the base, its front face cut away into three large
  stair-like steps with flat tops and sharp vertical cuts. On the ground in front, a few rectangular
  cut stone blocks stacked in a pile. Beside the hill a sturdy wooden crane of three thick log poles
  tied at the top as a tripod with a pulley, a short rope down to a block on the ground. Nothing
  floating, no pyramid, no thin pole, on a square packed-earth base.

Triângulos da cena (`window.poc.info()`, vista inicial, sombras incluídas):

| Cidade | Modelos por código | Pacote 1.ª leva | Pacote leve | Pacote leve sem `olive` |
|---|---|---|---|---|
| 48 construções (`weeks=156`) | 136 mil | 1 049 mil | 685 mil | 180 mil |
| 150 construções (`b=150`) | 161 mil | 1 299 mil | 789 mil | 327 mil |

A oliveira é a maior parte: aparece centenas de vezes no mapa. Com ela fora do manifesto (fica a
oliveira feita por código), a cidade volta a ~180–330 mil triângulos.

Fora do `manifest.json`: `lumber` e `quarry` (essas chaves ainda não existem na prova nem no jogo;
o carregador quebra com chave desconhecida). O `market` entra com `scale: 3.95` e `rotationDeg: 90`
porque o modelo saiu comprido em x e a área da chave é 2 x 4 (comprida em z).

## Prompts da 1.ª leva (antes do estilo comum)

Os de `house-4` e `quarry` abaixo foram substituídos na 2.ª leva (acima).

- `house-1` (3000): Small nomad tent of dark brown and black woven goat-hair cloth, Judean hills about
  500 BC, low sloped roof held by wooden poles and ropes tied to stakes, one side open, two clay water
  jars beside the entrance, on a square packed-earth base.
- `house-2` (4000): Small one-room house of sun-dried mud brick, ancient Jerusalem about 500 BC, cube
  shape, flat roof of wooden beams and packed mud with a low parapet, one small wooden door at the
  front, one tiny window, plain plastered ochre walls, on a square base.
- `house-3` (5000): House of ancient Jerusalem about 500 BC, lower walls of rough pale limestone blocks
  and upper walls of mud brick, one small square window, wooden door at the front, flat roof terrace
  with clay jars, a potted plant and a small outside stair along one wall, on a square base.
- `house-4` (7000), tentativa 2 (descartada na 2.ª leva: baixa e larga, laranja chapado): Large Judean four-room house of ancient Jerusalem about 500 BC, simple
  boxy mass, two storeys, thick plain walls of pale limestone blocks below and ochre mud plaster above,
  built in a U shape around a small open inner courtyard with a row of three square stone pillars, flat
  roof terraces with clay jars and a laundry line, outside stone stair on one side, few tiny windows,
  one wooden door, no balconies, no railings, no porch, no arches, on a square base.
  - Tentativa 1 (descartada: parecia casa colonial com varanda e balaústre): Large two-storey Judean
    four-room house, Jerusalem about 500 BC, pale limestone ground floor and mud brick upper floor,
    small inner courtyard open to the sky with a stone pillar row, flat roof terraces with jars, a
    laundry line and an outside stair, few small windows, wooden door at the front, on a square base.
- `plaza` (4000), tentativa 2: Square town plaza of ancient Jerusalem, the whole square paved with
  large pale limestone slabs as a thick flat stone platform with a low curb, one long low stone bench
  along one edge, one small olive tree in a square stone planter in a corner, a square linen sun
  awning on four wooden poles over the bench, no well, no fountain.
  - Tentativa 1 (descartada: só dois postes e um vaso, sem lajes nem banco): Small square town plaza
    of ancient Jerusalem, paved with pale limestone slabs, one long stone bench, one small olive tree
    in a stone planter, a linen awning stretched on four wooden poles giving shade, no well, no
    fountain, on a flat square slab base.
- `market` (7000): Long open-air market of ancient Jerusalem about 500 BC, a row of three wooden stalls
  with striped linen awnings in ochre, cream and faded red, woven baskets of grain and fruit, clay jars
  and amphorae, rolled cloth, on a rectangular packed-earth base twice as long as wide.
- `lumber` (4000): Woodcutter's yard of ancient Judea, small cabin built of rough logs with a flat
  roof, a neat stack of cut logs, a tree stump chopping block with an axe stuck in it, scattered wood
  chips, on a square packed-earth base.
- `quarry` (5000), tentativa 1 (descartada na 2.ª leva: pirâmide e haste fina): Small limestone quarry of ancient Jerusalem, pale cream rock outcrop cut into
  stepped terraces with sharp straight cuts, several rectangular cut stone blocks stacked nearby, a
  small wooden lifting crane with rope, on a square base.
- `temple` (9000), tentativa 2: Second Temple of Jerusalem about 515 BC, complete and intact, simple
  and imposing, all pale cream limestone. A tall boxy sanctuary with a flat roof and a taller
  flat-topped entrance porch, two free-standing plain columns before the doorway. It stands in a
  square courtyard with a low wall lined inside by plain square pillars, a rough unhewn stone altar in
  front. No triangular pediment, not a Greek temple, no ruins, no statues, no carvings, no Babylonian
  or Egyptian ornaments, on a square stone platform base.
  - Tentativa 1 (descartada: frontão grego triangular e blocos soltos como ruína): Second Temple of
    Jerusalem as rebuilt about 515 BC, simple and imposing, all of pale cream limestone, a tall
    rectangular sanctuary building with a flat roof and a tall plain entrance porch with two
    free-standing columns at the front, surrounded by a walled courtyard with a colonnade of plain
    square columns, a rough unhewn stone altar in the courtyard, no statues, no carvings, no Babylonian
    or Egyptian ornaments, on a square stone platform base.
- `olive` (2000), tentativa 2: Old olive tree, short thick gnarled twisted grey-brown trunk, wide
  rounded canopy made of a few big solid rounded clumps of dull olive-green foliage, smooth chunky
  blobs, no thin leaves, on a small round patch of earth.
  - Tentativa 1 (descartada: copa cinza de cacos finos): Old olive tree, short thick gnarled twisted
    trunk, wide rounded canopy of grey-green silvery leaves in a few chunky clusters, on a small round
    patch of earth.

## 3.ª leva (prédios que faltavam, 2026-11-05)

Saldo no início: **756 créditos**. Teto autorizado pelo usuário: 80 % do saldo inicial = 604 créditos
(até 40 tarefas de 15). Mesma configuração e estilo comum das levas anteriores; versão leve com
`simplify.mjs`. Scripts agora também em `scripts/meshy/` no main.

| Chave | Arquivo | Triângulos (bruto) | Tamanho | Tentativa | Preview | Refine | Créditos | Resultado |
|---|---|---|---|---|---|---|---|---|
| `workshop` oficina | workshop.glb | 2 498 (4 908) | 337 KB | 1 | 01a1ac23-95a5-72fd-8819-d62b774edd74 | 01a1ac24-19bd-70fb-b929-51ad093e9600 | 15 | **em uso** |
| `fisher` pescador | fisher.glb | 2 000 (3 814) | 260 KB | 1 | 01a1ac23-95ac-77d7-9777-30882bc26674 | 01a1ac23-f03f-74cc-a12f-d14bc1b94ad6 | 15 | **em uso** |
| `gatherer` coletora | gatherer.glb | 1 999 (3 737) | 285 KB | 1 | 01a1ac23-95d4-7083-bc61-d499de1659f6 | 01a1ac23-f075-72af-a22c-8042931f7225 | 15 | **em uso** |
| `altar` | — | (4 780) | — | 1 | 01a1ac23-95a0-76cc-b12b-a128d273ac7f | 01a1ac24-1b34-7266-8cf2-dfcea0882031 | 15 | descartado: dois pilares com lintel (parecia dólmen), não um altar |
| `altar` | — | (4 780) | — | 2 | 01a1ac27-6c68-7777-9d44-6bc52b9c2c35 | 01a1ac27-f236-7468-88fc-bbf2d29ded09 | 15 | descartado: cubo liso e menor que o altar por código (rampa, chifres, bacia de ouro) |
| `granary` celeiro | — | (4 773) | — | 1 | 01a1ac23-959c-732d-a21b-e51eb812db68 | 01a1ac24-1b79-7140-8513-32aed995bbe4 | 15 | descartado: base girada 45° (losango), arcos, silos escondidos; de cima lia como caixa marrom |
| `granary` celeiro | — | — | — | 2 | 01a1ac34-12dd-731c-8e38-9adabae8b77d | 01a1ac34-9a3b-74a4-bcf5-19fb587fc83b | 15 | descartado: telheiro aberto com dois potes, sem base, paredes soltas |
| `park` parque | — | (3 429) | — | 1 | 01a1ac23-95d8-71e4-9b09-5cee2998eece | 01a1ac24-1ab7-70ea-9ed1-e61fcd204d0b | 15 | descartado: nicho de pedra em arco no meio, folhas pretas, só uma árvore grande |
| `park` parque | — | (3 830) | — | 2 | 01a1ac27-6c6b-7599-a258-cf6af7470239 | 01a1ac27-c7c4-7031-8e60-f29e7b2be734 | 15 | descartado: muro alto e rasgado, chão vermelho e branco, árvores de folhas soltas |
| `plaza` praça | — | — | — | 3 | 01a1ac23-95ec-7159-91d0-7c9830add460 | 01a1ac23-f14c-7154-a0cd-d3eaa35da0a2 | 15 | descartado: laje vazia com um poste solto e um vaso |
| `plaza` praça | — | — | — | 4 | 01a1ac27-6c70-7403-b5de-a0e41fbe211a | 01a1ac27-c82c-7230-8621-74b3464a77bc | 15 | descartado: saiu só um poço, sem lajes nem bancos |

Altar, celeiro, parque e praça ficam com o modelo por código (as duas tentativas de cada um saíram
piores que ele). A oficina do Meshy tem a oficina de trabalho alta (1,6) no fundo à esquerda e o
forno à direita: o modelo por código foi rearrumado igual, o quarto de pedra do nível 2–3 fica no
teto (1,6), e a chaminé do nível 3, a fumaça e o fogo da noite saem do forno (`KILN` em `plan.ts`).

Prompts da 3.ª leva (antes do estilo comum; `target_polycount` entre parênteses):

- `workshop` (5000): Potter's workshop of ancient Jerusalem about 500 BC: a flat-roofed mud-brick
  workroom at the back left with a wooden door, an open shed of four wooden posts with a flat linen
  roof on the right covering a potter's wheel and a work table, a round domed clay kiln with a small
  fire opening at the front left, rows of red and ochre clay pots drying on the ground, a small pile
  of firewood, on a square packed-earth base.
- `fisher` (4000): Fisherman's hut on a riverbank of ancient Judea about 500 BC: a small low
  mud-brick hut with a flat roof of reeds at the back, a wooden drying rack beside it with a fishing
  net and a few fish hanging, a small wooden rowing boat pulled up on the sand at the front, coiled
  ropes and a wicker fish basket, on a square sandy base.
- `gatherer` (4000): Forager's shelter of ancient Judea about 500 BC: a small low mud-brick hut with
  a flat roof of branches and palm leaves at the back, one leafy fig tree beside it with a chunky
  rounded crown, woven wicker baskets full of figs, dates, olives and green herbs in front, bundles of
  herbs drying on a wooden pole, one clay jar, on a square packed-earth base.
- Os prompts descartados (altar, celeiro, parque, praça, tentativas 1 e 2) estão em
  `scripts/meshy/prompts.json` (`<chave>-prev` é a 1.ª tentativa) e `scripts/meshy/tasks.json`.
  A praça perdeu o toldo e os postes do prompt (o motivo de ter saído do manifesto), mas o Meshy
  devolveu cenas vazias.

3.ª leva: 11 tarefas (7 modelos + 4 novas tentativas) = 165 créditos. Saldo: 756 antes, 591 depois.
Total gasto em todas as levas: 475. Não foram gerados árvores, pedras nem campos: aparecem centenas
de vezes (a oliveira de 1 235 triângulos já pesava ~500 mil triângulos na cena) e os campos mudam de
cor com a estação pelo material do código, o que uma textura do Meshy perderia.

## 4.ª leva (nova tentativa de altar, celeiro, parque e praça, 2026-11-05)

Saldo no início: **591 créditos**. Teto do usuário: 80 % do saldo inicial da 3.ª leva (756) = 604
créditos no total das levas 3 e 4; no máximo 2 tentativas novas por modelo. Mesma configuração e
estilo comum; versão leve com `simplify.mjs` (alvo 2 500), textura 1024 px com `pack.mjs`.

| Chave | Arquivo | Triângulos (bruto) | Tamanho | Tentativa | Preview | Refine | Créditos | Resultado |
|---|---|---|---|---|---|---|---|---|
| `altar` | — | — | — | 3 | 01a1ac58-0eea-73bf-84f5-6f29851d8e3f | 01a1ac58-6911-7775-836f-eeccd5e10d21 | 15 | descartado: plataforma creme lisa com escada (não rampa), bloco pequeno, sem fogo |
| `altar` | altar.glb | 2 499 (4 077) | 336 KB | 4 | 01a1ac5a-4310-7367-86da-c22cd8092362 | 01a1ac5a-d55c-719a-a70e-496495f60b8b | 15 | **em uso** (`scale: 3.0`) |
| `granary` celeiro | — | (3 175) | — | 3 | 01a1ac58-0eef-7383-9382-360de7497bae | 01a1ac58-929d-7720-9aef-3be8b3246cbf | 15 | descartado: faixa comprida e fina (silos em fila diante de um muro), deixa quase todo o 3x3 vazio e o andar do nível 2–3 fica no ar |
| `granary` celeiro | — | — | — | 4 | 01a1ac6b-9876-718b-a112-b6538e62deb4 | 01a1ac6b-f70b-7214-9747-81ffd3289768 | 15 | descartado: uma caixa alta lisa num pedestal com um só silo ao lado |
| `park` parque | park.glb | 2 498 (3 523) | 318 KB | 3 | 01a1ac58-0efe-752b-92c5-b8721d49f50b | 01a1ac58-93bc-7713-9024-a0e4447f965e | 15 | **em uso** |
| `plaza` praça | — | — | — | 5 | 01a1ac58-0ef3-7616-a8bf-eef6919989d4 | 01a1ac58-935a-705e-861a-d4863ad62455 | 15 | descartado: bancos, poço e jarros soltos no ar, sem lajes |
| `plaza` praça | — | — | — | 6 | 01a1ac5a-430a-7759-8c50-9fc61bf884df | 01a1ac5a-a32b-72f1-a826-8acd55f8b35d | 15 | descartado: de novo bancos, poço e um jarro soltos, sem a laje |

- **Altar (tentativa 4, em uso):** bloco maciço de pedras brutas cinza-bege com um chifre em cada
  canto, brasas e cinza no topo e rampa lisa na frente. Lê de cima como "altar de pedras não lavradas"
  melhor que o bloco liso do código. Sem a plataforma de lajes: o `scale: 3.0` deixa o bloco com
  ~2,6 de lado e ~1,3 de altura no lote 4x4 (o fogo do código, a 1,2, fica no topo dele).
  Prompt: A massive rough fieldstone altar of ancient Israel about 500 BC: one solid square block
  built of big rough uncut grey-beige boulders, chunky and craggy, half as wide as the base and waist
  high, a rough boulder horn on each top corner, glowing orange embers and grey ash on its flat top,
  a smooth sloping earthen ramp, not stairs, rising to the top from the front, all standing on a low
  wide square platform of pale limestone slabs that fills the whole base. No steps, no stairs, no
  columns, no arches, no gate.
- **Parque (tentativa 3, em uso):** gramado verde com muro baixo de calcário em dois lados (com um
  arco no fundo), fonte redonda de água azul no meio, oliveiras de copa escura e canteiros. De longe
  é a mancha verde que o parque precisa ser; o do código lia como um quadrado marrom. A grama é da
  textura (não muda de cor com a estação; a neve e o molhado do shader valem).
  Prompt: Small square walled garden of ancient Jerusalem about 500 BC: a flat square lawn of bright
  green grass fills the base, an ankle-high pale limestone kerb around all four edges, a round pale
  stone fountain basin with blue water in the exact centre, four small olive trees with short thick
  trunks and solid smooth rounded olive-green crowns, one in each corner, red and yellow flower beds,
  a sandy path from the front to the fountain. No tall walls, no arches, no niches, no buildings.
- **Celeiro e praça** ficam com o modelo por código: em seis tentativas cada um (praça) e quatro
  (celeiro) o Meshy nunca pôs a laje da praça nem encheu o quadrado do celeiro. Os acréscimos
  `up-granary-2/3` continuam assentados no celeiro do código. Prompts em `scripts/meshy/prompts.json`
  (`<chave>@<tentativa>`) e ids em `scripts/meshy/tasks.json`.

4.ª leva: 7 tarefas = 105 créditos. Saldo: 591 antes, 486 depois. Total gasto nas levas 3 e 4: 270
(teto 604); em todas as levas: 580.

## 5.ª leva (referência Banished, 2026-11-05)

Guia de estilo: `docs/arte-3d-referencia.md` (o Banished só como referência descrita em palavras;
nenhuma imagem de jogo baixada nem enviada ao Meshy; nenhuma imagem de entrada usada nesta leva).
Saldo no início: **486 créditos**; limite do usuário: não ficar abaixo de 152. Estilo comum novo,
no fim dos prompts de geração:
"Stylized low-poly city-builder game asset seen from a high camera, muted desaturated earthy colors
(pale limestone, beige mud plaster, weathered brown wood, dusty ochre), soft baked shading, sits
directly on a thin flat ground footprint, no raised platform, single centered object."
Mesma configuração (`smart-topology`, `meshy-t2.5`, refine 2k sem PBR; 15 créditos por modelo).
Novidade: **Retexture** (`/openapi/v1/retexture`, `input_task_id` do refine antigo,
`enable_original_uv: true`, sem PBR; 10 créditos): troca só a textura e mantém a malha, os
tamanhos e o encaixe dos acréscimos por código. Versão leve com `simplify.mjs` (alvo 2 500) e
textura 1024 px com `pack.mjs` (`NORMAL=0`). Scripts desta leva ficaram fora do repositório
(cópia de `generate.mjs` e um `retexture.mjs` no rascunho do agente); ids abaixo, não em
`scripts/meshy/tasks.json`.

| Chave | Tarefa | Tentativa | Preview / Retexture | Refine | Créditos | Resultado |
|---|---|---|---|---|---|---|
| `temple` | text-to-3D | 1 | 01a1ad77-6919-71a4-bde7-65ed428ab4f9 | 01a1ad78-1a87-70b6-9d72-3e9b301b3b52 | 15 | descartado: frontão grego com telhado de duas águas, pórtico de colunas e ameias, sem pátio |
| `temple` | text-to-3D | 2 | 01a1ad7b-35cf-77ac-80f1-db81f369ca2a | 01a1ad7b-c096-7189-abe7-15ada0776566 | 15 | descartado: salão em corte (sem teto) com duas colunas, sem santuário |
| `house-4` | text-to-3D | 1 | 01a1ad77-6914-71cb-ac66-c6c0ca757108 | 01a1ad78-434e-75ee-9d86-f55f1a3a7897 | 15 | descartado: casa de bonecas (muros em U sem teto, 0,85 de altura) |
| `house-4` | text-to-3D | 2 | 01a1ad79-e765-73ba-8a95-50701585e020 | 01a1ad7a-6ef6-76c4-9315-9740d9b2246c | 15 | descartado: bloco fechado bom, mas um triângulo preto no teto (falha da textura, visível de cima) e mais baixo (1,26) que a casa de pedra (1,65) |
| `market` | text-to-3D | 1 | 01a1ad77-691a-73e2-94f3-0498b1029d32 | 01a1ad78-43ff-75ff-9442-a71b3cd07836 | 15 | descartado: três telhados bege lisos e estreitos, de cima lia como galpões, não como feira |
| `market` | text-to-3D | 2 | 01a1ad79-e767-74be-9463-d38fe4c0b4bb | 01a1ad7a-6fc4-77f9-a3d3-67061fd8779b | 15 | descartado: sem toldos, só painéis e mesas soltas |
| `lumber` | text-to-3D | 1 | 01a1ad77-6915-76b1-86a6-7ddb68072528 | 01a1ad78-1921-7695-8d26-02cfe5e8c59a | 15 | descartado: cabana de barro com telhado caído; de cima a pilha de toras some e não lê "madeira" |
| `house-2` | text-to-3D | 1 | 01a1ad7f-4a8e-771e-8051-37e25955ef08 | 01a1ad7f-a7e4-72d8-8e4b-917680700960 | 15 | descartado: boa forma (sem vigas), mas da mesma cor e quase da altura da casa de pedra: a escada de níveis ficou menos legível |
| `park` | text-to-3D | 1 | 01a1ad7f-4a8f-74ea-8c80-4a9d7dd35b0a | 01a1ad7f-a6c3-7163-8b2b-96d3c43a8e1e | 15 | descartado: chão bege com buracos, árvores pretas espinhosas |
| `market` | retexture do refine 01a1a7cd-6a59-70d8-bbf0-93003db37983 | 3 | 01a1ad81-6cd3-7177-9928-4e050911e04e | — | 10 | **em uso** (2 499 triângulos, 343 KB) |
| `park` | retexture do refine 01a1ac58-93bc-7713-9024-a0e4447f965e | 2 | 01a1ad81-6cd6-7216-8814-d824910de5e6 | — | 10 | descartado: grama virou areia, o parque deixou de ser a mancha verde |
| `park` | retexture do mesmo refine | 3 | 01a1ad84-89ac-7069-9969-df06c5cf6fbc | — | 10 | **em uso** (2 498 triângulos, 315 KB) |

- **Mercado (retexture, em uso):** mesma malha da 1.ª leva (três barracas em fila, `rotationDeg: 90`),
  toldos listrados de linho cru, ocre e terracota apagado no lugar do vermelho saturado, e a base,
  que lia como rocha, pintada de terra batida. Continua o prédio mais colorido da rua, como o
  mercado do guia, e se lê à noite.
  Prompt: Faded, muted, desaturated earthy colours of an ancient Jerusalem market: stall awnings of
  sun-bleached linen in undyed cream, dusty ochre and soft faded terracotta stripes; weathered
  grey-brown wooden posts and tables; woven straw baskets of grain and fruit; terracotta clay jars;
  the whole ground base is flat packed beige-ochre earth, not rock; soft baked shading, stylized
  low-poly game texture, no saturated red.
- **Parque (retexture, em uso):** mesma malha da 4.ª leva; gramado verde-oliva suave (ainda verde de
  longe, sem o verde-bandeira), muros e fonte de calcário creme, flores ocre e rosa apagado, copas
  cinza-esverdeadas no lugar das pretas.
  Prompt: Small walled garden of ancient Jerusalem in natural soft colours: a lawn of fresh but soft
  natural olive-green grass (clearly green, not neon, not sand), low walls, kerb and fountain basin of
  pale cream limestone, clear light blue water, olive trees with grey-brown trunks and solid
  grey-green olive leaves (never black), small flower beds of faded ochre and muted rose, a sandy
  beige path; soft baked shading, stylized low-poly game texture.
- **Bases rente ao chão (sem créditos):** pelo guia ("os prédios assentam no chão, sem pedestal"),
  o manifesto afunda a laje de base de cada modelo com `yOffset` (medida na borda de cada modelo já
  encaixado): `house-1` −0,08, `house-2` −0,11, `house-3` −0,05, `house-4` −0,07, `market` −0,12,
  `fisher` −0,07, `gatherer` −0,12. A laje vira uma pegada no chão, sem a borda laranja grossa.
  `workshop` não afunda (o quarto do nível 2–3 por código fica a 1,6, no teto da oficina do modelo),
  nem `altar` (o fogo por código fica a 1,2), `temple`, `quarry`, `lumber` e `park` (base fina ou
  irregular).
- Templo, casa grande, mercado (geometria), lenhador e casa de barro ficam como estavam: as
  tentativas saíram piores (tabela). Prompts de geração da leva:
  - `temple` 1: Second Temple of Jerusalem about 515 BC, simple and imposing, all pale cream
    limestone ashlar. At the back, one tall plain rectangular sanctuary with a flat roof; its front is
    a taller flat-topped porch with a tall dark doorway and two free-standing plain round columns. In
    front, a wide open square courtyard of pale paving slabs closed by a plain low wall with a front
    gateway. A rough unhewn stone altar in the courtyard. No colonnade around the building, no
    battlements, no pediment, not Greek, no ruins.
  - `temple` 2: Sacred precinct of the Second Temple of Jerusalem about 515 BC, all pale cream
    limestone: a square courtyard of pale slabs enclosed on all sides by a plain thick wall with one
    gateway in the middle of the front wall. In the back half stands one tall plain box-shaped
    sanctuary with a perfectly flat roof, and before it a taller flat-topped porch with a dark doorway
    between two thick plain pillars. A rough stone altar in the courtyard. Flat roofs only, no gable,
    no pediment, no portico, no battlements or Greek.
  - `house-4` 1: Large Judean four-room courtyard house of ancient Jerusalem about 500 BC, square
    plan: three long flat-roofed rooms with pale limestone lower walls and beige mud-plaster upper
    walls in a U shape around an open central courtyard; a small second-storey room on the back roof;
    three square stone pillars along the courtyard; a low front wall with a wooden gate in the centre;
    roof terraces with clay jars and a laundry line; an outside stone stair. Wider than tall, no
    tower, no balconies, no arches.
  - `house-4` 2: Large Judean courtyard house of ancient Jerusalem about 500 BC, one solid square
    block: pale limestone lower walls, beige mud-plaster upper walls; every room covered by flat
    packed-earth roofs with low parapets, only a small open courtyard in the middle; the back wing two
    storeys, the side wings one storey; a wooden door in the centre of the front wall; clay jars and a
    laundry line on the roofs; an outside stone stair on one side. A complete closed house, not a
    cutaway, no tower, no arches.
  - `market` 1: Open-air market of ancient Jerusalem about 500 BC on a long rectangle twice as long as
    wide: a row of three simple stalls side by side, each a low frame of wooden posts with a flat
    slanted shade cloth of faded linen (undyed beige, dusty ochre, muted terracotta), low tables with
    woven baskets of grain, figs and olives, clay jars and amphorae and grain sacks on the ground
    between them. Flat packed-earth ground, no rocks, no stone base, no tall poles, no bright red.
  - `market` 2: Open-air market of ancient Jerusalem about 500 BC on a long rectangle twice as long as
    wide, low and spread out: a row of three stalls side by side, each four short wooden posts holding
    a flat cloth shade at head height, the shades in different faded colours (dusty ochre, muted
    terracotta red, faded indigo blue); under them low tables with woven baskets of grain, figs and
    olives; clay jars, amphorae and grain sacks on the ground. Flat packed-earth ground, no rocks, no
    stone base, no curtains.
  - `lumber` 1: Woodcutter's yard of ancient Judea about 500 BC: at the back a small low one-room hut
    of beige mud brick on a rough stone footing, flat roof of wooden poles and brush; beside it a neat
    long stack of cut pale logs; in front on flat packed earth a big chopping stump with an axe, a
    wooden sawhorse with a log, a pile of split firewood and wood chips. Not a log cabin, no ruins, no
    broken roof.
  - `house-2` 1: Small one-room house of ancient Jerusalem about 500 BC, a low simple box clearly
    wider than tall: thick walls of sun-dried mud brick under smooth beige mud plaster, a flat roof of
    packed earth with a low rounded parapet, one small wooden door at the front slightly right of
    centre, one tiny high window, a short wooden ladder leaning up to the roof, a round clay bread oven
    and two jars by the door. No protruding roof beams, no second storey, no stone base.
  - `park` 1: Small square public garden of ancient Jerusalem about 500 BC filling a square base:
    dusty sage-green grass and packed-earth paths, an ankle-high pale limestone kerb round the edge, a
    simple round stone basin of water in the centre, four small olive trees with short gnarled trunks
    and solid rounded dull olive-green crowns, one in each corner, two low stone benches, a few clay
    planters with herbs. Muted dusty colours, no bright green, no black leaves, no walls, no arches, no
    buildings.

5.ª leva: 9 gerações (135 créditos) + 3 retextures (30) = **165 créditos**. Saldo: 486 antes,
**321 depois** (limite do usuário: 152). Total gasto em todas as levas: 745.

## 6.ª leva (estilo Foundation, 2026-11-12)

Guia: `docs/referencia-foundation.md`. Só texto nos prompts (nenhuma imagem de jogo usada; nenhum
Retexture com imagem de estilo nesta leva). Saldo: **321 antes, 111 depois** (210 gastos; parada
em ~37 não foi necessária). Mesma configuração (`smart-topology`, `meshy-t2.5`, alvo 2 500, refine 2k sem
PBR, 15 créditos por modelo); textura 1024 px com `pack.mjs` (`NORMAL=0`); todos já saíram com
≤ 2 500 triângulos (o `simplify.mjs` não reduziu nada). Fim comum dos prompts: "Stylized low-poly
city-builder game asset seen from a high tilted camera, chunky friendly proportions, warm saturated
but harmonious colors, soft baked shading, hand-painted look, small props around it (barrels, baskets,
ladder, jars), sits directly on a thin flat ground footprint, no raised platform, single centered object."

| Chave | Tentativa | Preview | Refine | Créditos | Triângulos | Resultado |
|---|---|---|---|---|---|---|
| `house-1` tenda | 1 | 01a1d16a-b080-7273-99e1-568cb643f446 | 01a1d16b-3832-72af-a0ee-71aad6a5d9cb | 15 | 2 333 | **em uso** (tenda de pano com tapete, jarros, lenha, escada) |
| `house-2` | 1 | 01a1d16a-b07d-75b0-af68-0acd7a36a221 | 01a1d16b-0dfd-72dd-9cd8-8e29030b22d3 | 15 | 2 477 | **em uso** (caixa ocre-laranja viva, escada de mão, barris e jarros) |
| `house-3` | 1 | 01a1d16a-b095-7759-bb51-f80bc72cdd76 | 01a1d16b-61b2-749f-8f84-9acc2102e61b | 15 | 2 294 | **em uso** (calcário embaixo, reboco ocre em cima, varal colorido, venezianas azuis, lenha) |
| `house-4` | 1 | 01a1d16a-b09c-742b-beb8-aee17ae46892 | 01a1d16b-382c-738e-aaf1-c89cc5d4c391 | 15 | — | descartado: uma árvore e uma viga comprida, a casa nem aparecia |
| `house-4` | 2 | 01a1d16c-b8b3-7764-a647-579ba7679eb9 | 01a1d16d-1688-73dc-831f-f6edfb2dd17e | 15 | 2 332 | **em uso** (dois andares, toldo azul, escada; tem ameias baixas no parapeito) |
| `market` | 1 | 01a1d16c-b8c7-74fe-a540-9e5b14ea22df | 01a1d16d-3fa7-7590-bd28-26ca766d3f65 | 15 | — | descartado: pátio murado e escuro, só dois toldos |
| `market` | 2 | 01a1d16e-add9-7004-9bee-307f3faef28a | 01a1d16f-0cda-72ad-ad38-980c347c34c4 | 15 | 2 190 | **em uso** (três barracas de toldo listrado, poço, cestos; `rotationDeg: 90`) |
| `lumber` | 1 | 01a1d16c-b8b8-72f8-a6ad-76613b18dd9c | 01a1d16d-40c9-7677-b9da-f61b70d7970e | 15 | 2 204 | **em uso** (cabana de reboco com telhado inclinado, pilha de toras, serra, carrinho) |
| `fisher` | 1 | 01a1d16c-b8d1-7431-a4ed-27b00cbce0e7 | 01a1d16d-4087-7265-848e-2ac862cbca5e | 15 | 2 296 | **em uso** (barco azul, rede, barris) |
| `gatherer` | 1 | 01a1d16c-b8ee-7319-977e-6a817415617a | 01a1d16d-41f3-74c8-8c11-b6da3c0c905d | 15 | 2 284 | **em uso** (abrigo com figueira, cestos de frutas, jarros) |
| `granary` | 1 | 01a1d16c-b8e7-75af-9cc0-41054f47c296 | 01a1d16d-3f8a-7638-8169-2f6a91b658c9 | 15 | 2 329 | **em uso, primeira vez no pacote** (armazém ocre, porta em arco, dois silos redondos, sacos e barris) |
| `workshop` | 1 | 01a1d16c-b8c0-76e7-8fec-3654f5a47be4 | 01a1d16d-4111-70d8-a7f7-a9f857eb2cf9 | 15 | — | descartado: base preta e só ocre; o layout também mudou e o quarto/forno por código (`KILN`, `CRAFT_FLOOR`) não encaixaria |
| `quarry` | 1 | 01a1d16c-b8d2-773a-b392-815ab5c0409f | 01a1d16d-1758-7561-a92b-5bd5d4a834b7 | 15 | — | descartado: degraus de lajes brancas chapadas, mal lê pedreira |
| `quarry` | 2 | 01a1d16e-ade4-75c9-aecc-c58d81adfb1a | 01a1d16f-0c3a-70b5-8173-6cddead9a885 | 15 | — | descartado: um bloco alto sem degraus, com pedaço preto no topo |

Prompts (antes do fim comum): `house-1` Nomad tent of ancient Judea, a wide low tent of dark brown striped
goat-hair cloth over wooden poles with ropes and pegs, one side open showing a woven rug and cushions, a
clay water jar, a basket, a small fire ring with a cooking pot, a stack of firewood beside it. `house-2`
Small one-room mud-brick house of ancient Jerusalem, a chunky box wider than tall, warm ochre plastered
walls, flat roof with a low parapet, big wooden door and one window, a wooden ladder leaning to the roof,
two barrels and baskets by the door, clay jars on the roof, a round clay bread oven. `house-3`, `house-4`
(tentativa 2), `market` (2), `lumber`, `fisher`, `gatherer` e `granary`, `workshop` e `quarry` (1 e 2): ver
o rascunho do agente; os textos acompanham o resumo da tabela. Ids acima.

Não gerados por falta de chave no jogo: poço, carroça, lenha com serrote, cercado, galpão de campo e
moinho (o carregador só aceita chaves que a cena desenha) e o curtume (é `craft-5`, por código). `yOffset`
das casas, fisher e gatherer mantidos dos modelos anteriores. Capturas conferidas: `houses3d-pc`
e `town3d-pc` (dia e noite). Fisher, gatherer e lenhador só vistos nos ícones do menu e em miniatura.

# Modelos Meshy (prova 3D)

Gerados no Meshy (text-to-3D) em 2026-11-04 para a prova em Three.js e usados pela visão 3D do
jogo (`src/render3d`; o manifesto aqui inclui `lumber` e `quarry` e deixa `olive` de fora). Scripts
no branch `spike/threejs`, em `scripts/meshy/`:
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
| `temple` templo | temple.glb | 4 151 (7 441) | 354 KB | 2 | 01a1a7cf-5f3e-7185-847c-d9b87013c39c | 01a1a7cf-bc54-7470-949e-70d5eb3cf3a3 | 15 + 15 + 5 |
| `olive` oliveira | olive.glb | 1 235 (1 879) | 212 KB | 2 | 01a1a7cf-5f3e-7680-89b8-1b73cceed271 | 01a1a7cf-e6aa-772c-9758-a6b471c14baf | 15 + 15 + 5 + 15 |

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

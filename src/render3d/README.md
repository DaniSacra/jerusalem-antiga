# Visão 3D (Three.js)

O botão **3D** da coluna esquerda abre a cidade do jogador em 3D, numa camada de tela cheia sobre o
jogo (`view.ts`, `open3D(state, seed, onClose)`). Ela lê o `GameState` vivo e nunca o muda; o jogo
fica pausado e o laço do Phaser dorme enquanto ela está aberta (`src/render/view3d.ts` e
`GameScene.open3D`). O Three.js e este código vêm num pedaço separado (import dinâmico). Veja a
seção "Visão 3D" de `docs/GAME_DESIGN.md`. Veio da prova `spike/threejs` (sem o bot, o modo
demonstração, a cidade de teste e o 2D na mesma página).

| Arquivo | O que faz |
|---|---|
| `view.ts` | abre e fecha a visão: camada, renderizador, laço, qualidade automática, botões, `close()` que libera tudo |
| `plan.ts` | **puro e testado**: o que se desenha do `GameState` (modelo por tipo e nível, casa vazia, acabamento de pedra dos níveis 2–3, frente para a rua, árvores, tocos e mudas, número de moradores) |
| `world.ts` | a cidade a partir do `plan`: chão, rio, construções e árvores instanciadas, fumaça, fogueiras, gente nos campos e moradores |
| `models.ts` | modelos low-poly feitos por código, por chave; carregador do pacote .glb |
| `instancer.ts` | um `InstancedMesh` por parte de modelo: a cidade inteira em poucas dezenas de chamadas |
| `terrain.ts` | relevo (plano na cidade), areia e grama com transição, leito do rio, água animada |
| `life.ts` | moradores andando pela rede (caminhos do core), fumaça, fogo do altar, luzes da noite |
| `shaders.ts` | efeitos nos materiais: neve, chão molhado, sombra de nuvens, janelas acesas, campos crescendo, cores do chão por estação |
| `atmosphere.ts` | sol e lua com sombras, céu, neblina |
| `particles.ts` | chuva, respingos, neve, folhas, pétalas e poeira na GPU |
| `camera.ts` | arrastar move; pinça/roda dá zoom; dois dedos ou botões giram; Q/E e WASD no PC |
| `time/` | **puro e testado** (`tests/render3d`): hora do dia e sol, estações contínuas e campos, clima pela semente, luz do quadro |
| `look3d.json` | números e cores da luz, das estações, do clima e da multidão |

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
| `field-0`…`field-3` trigo, cevada, lentilha, linho | 2x2 | `altar` | 4x4 |
| `fisher` pescador, `gatherer` coletora | 2x2 | `temple` templo | 6x6 |
| `lumber` lenhador, `quarry` pedreira | 2x2 | `road` rua | 1x1 |
| `olive`, `palm`, `rock`, `shrub`, `stump` toco, `sapling` muda | 1x1 | `trim-WxH-2`/`-3` acabamento | área do prédio |

```json
{ "temple": { "file": "templo.glb", "rotationDeg": 180 }, "palm": { "file": "palmeira.glb", "scale": 0.012 } }
```

Sem `scale`, o modelo é encaixado na área da chave. Exporte com a frente para `+z` e a base em `y = 0`.
Cada .glb é achatado em partes, uma por material, e instanciado como os modelos por código. Um
arquivo que não carrega (sem internet antes do primeiro uso) fica com o modelo por código.
`olive.glb` está na pasta mas fora do manifesto: aparece centenas de vezes e pesaria demais.

## Medir

`node scripts/view3d-perf.mjs`: quadros por segundo num celular simulado (veja `docs/TESTING.md`).

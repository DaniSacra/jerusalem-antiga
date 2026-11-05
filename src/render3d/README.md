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
| `picking.ts`, `diff.ts` | **puros e testados**: raio até o chão e caixas das construções; o que mudou na cidade (camadas) |
| `plan.ts` | **puro e testado**: o que se desenha do `GameState` (modelo por tipo e nível, casa vazia desbotada com portão trancado, acréscimos dos níveis 2–3 por tipo, frente para a rua, árvores, tocos e mudas, número de moradores) |
| `crowd.ts` | **puro e testado**: roupa por idade e sexo (homens de turbante, mulheres de manto, crianças menores, idosos curvados e lentos), ordem da família ao andar e o seu caminho até a casa |
| `figures.ts` | gente low-poly instanciada (túnica, cabeça, turbante ou manto), jumento de carga e as famílias e caravanas andando em grupo (`s.families`) |
| `world.ts` | a cidade a partir do `plan`: chão, rio, construções e árvores instanciadas, fumaça, fogueiras, gente nos campos, moradores e famílias chegando |
| `models.ts` | modelos low-poly feitos por código, por chave; carregador do pacote .glb |
| `instancer.ts` | um `InstancedMesh` por parte de modelo: a cidade inteira em poucas dezenas de chamadas |
| `terrain.ts` | relevo (plano na cidade), areia e grama com transição, leito do rio, água animada |
| `life.ts` | moradores andando pela rede (caminhos do core), gente nos campos, fumaça, fogo do altar, luzes da noite |
| `shaders.ts` | efeitos nos materiais: neve, chão molhado, sombra de nuvens, janelas acesas, campos crescendo, cores do chão por estação |
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
| `field-0`…`field-3` trigo, cevada, lentilha, linho | 2x2 | `altar` | 4x4 |
| `fisher` pescador, `gatherer` coletora | 2x2 | `temple` templo | 6x6 |
| `lumber` lenhador, `quarry` pedreira | 2x2 | `road` rua | 1x1 |
| `olive`, `palm`, `rock`, `shrub`, `stump` toco, `sapling` muda, `closed` portão trancado | 1x1 | `up-<tipo>-2`/`-3` acréscimos | área do prédio |

```json
{ "temple": { "file": "templo.glb", "rotationDeg": 180 }, "palm": { "file": "palmeira.glb", "scale": 0.012 } }
```

Sem `scale`, o modelo é encaixado na área da chave. Exporte com a frente para `+z` e a base em `y = 0`.
Cada .glb é achatado em partes, uma por material, e instanciado como os modelos por código. Um
arquivo que não carrega (sem internet antes do primeiro uso) fica com o modelo por código.
`olive.glb` está na pasta mas fora do manifesto: aparece centenas de vezes e pesaria demais. `plaza.glb`
também saiu do manifesto: o toldo sobre postes lia como tenda; a praça é o modelo por código (lajes
claras em dois tons, poço, bancos e uma figueira).

No pacote hoje: `house-1..4`, `market`, `lumber`, `quarry`, `temple`, `workshop`, `fisher`,
`gatherer`, `altar` (bloco de pedras brutas com chifres, rampa e brasas; `scale: 3.0` para não encher
os 4x4, o fogo do código fica no topo dele) e `park` (gramado murado com oliveiras e fonte).
`granary` e `plaza` foram tentados no Meshy e ficaram com o modelo por código (as tentativas saíram
piores; ver CREDITS.md). Scripts em `scripts/meshy/` (gerar, empacotar a
1024 px, simplificar).

Os acréscimos `up-granary-2/3`, `up-market-2/3` e `up-workshop-2/3` são sempre por código, por cima do
modelo (mesmo giro e altura): celeiro com andar de pedra, portal e toldo no terraço; mercado com toldo
azul e, no 3, colunata de pedra; oficina com quarto de pedra no teto da oficina de trabalho (1,6 de
altura, no fundo à esquerda, como no modelo Meshy), prateleira de jarros e, no 3, chaminé alta sobre o
forno (`KILN` em `plan.ts`, de onde saem também a fumaça e o fogo da noite).
Casa vazia que guardou o nível: tom `VACANT_TINT` (< 0,8), que os shaders desbotam (cinza empoeirado)
e apagam as janelas, sem fumaça, e o portão `closed` diante da porta (`CLOSED_AT`).

## Início

A câmera abre centrada no altar, na vista padrão (`yawOfRotation(0)`).

## Medir

`node scripts/view3d-perf.mjs`: quadros por segundo num celular simulado (veja `docs/TESTING.md`).

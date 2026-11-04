# Prova de conceito 3D (Three.js)

Página isolada, `poc.html`, que desenha em 3D uma cidade gerada pela simulação de verdade, com a
simulação rodando e a passagem do tempo (dia e noite, estações, clima). Ela não altera `src/core`,
o jogo 2D nem o deploy; do 2D só ganhou um gancho em `GameScene` para jogar uma cidade que já existe
(o botão 2D ↔ 3D). Relatório da última rodada: `RELATORIO.md`.

## Rodar

```bash
npm run poc          # abre o servidor na rede: http://<ip-do-pc>:5174/poc.html
node scripts/poc-perf.mjs               # celular simulado: qps e capturas em screenshots/poc/
node scripts/poc-perf.mjs --soft        # o mesmo em renderização por software (pessimista)
node scripts/poc-size.mjs               # tamanho do download (gzip), 3D × 2D
```

Opções na URL de `poc.html`:

| Opção | O que faz |
|---|---|
| `seed=3` | semente do mapa |
| `weeks=156` | semanas jogadas pelo bot antes de abrir (60 ≈ 40 construções, 156 ≈ 50) |
| `day=90` | segundos reais de um dia inteiro (padrão 90; o dia para na pausa) |
| `b=150` | cidade de teste com esse número de construções (o bot não passa de ~90 neste mapa) |
| `bot=eficiente` | bot do sim-tester que continua jogando enquanto a prova roda (`off`: ninguém joga) |
| `quality=auto` | `auto` (padrão) desce de nível sozinha se ficar abaixo de 30 qps; `high`; `low` |
| `shadows=off` | sem sombras |
| `models=<url>` | manifesto de um pacote de modelos .glb (veja abaixo) |

## Como é feito

| Arquivo | O que faz |
|---|---|
| `city.ts` | `createGame` + o `Bot` de `tools/sim` por N meses; o 3D só lê o `GameState` |
| `terrain.ts` | relevo suave (plano dentro da cidade), areia e grama por célula com transição, leito do rio, água com ondinhas animadas; borda de 48 células em volta, sumindo na neblina |
| `models.ts` | modelos low-poly feitos por código (provisórios), por chave; carregador de .glb |
| `instancer.ts` | um `InstancedMesh` por parte de modelo: toda a cidade em ~70 chamadas de desenho |
| `grow.ts` | cidade de teste de N construções (com o `place` do core), só para medir desempenho |
| `world.ts` | a cidade desenhada a partir do `GameState`; refeita inteira quando a cidade muda |
| `life.ts` | moradores, gente nos campos, fumaça, fogo do altar, fogueiras e braseiros à noite |
| `shaders.ts` | efeitos do mundo nos materiais (uniforms compartilhados): neve nos telhados, chão molhado, sombra de nuvens, janelas acesas, campos crescendo, cores do chão por estação, terra rachada, flores |
| `atmosphere.ts` | sol/lua com sombras, luz do céu, neblina e o céu (gradiente, nuvens, estrelas, tremor de calor) |
| `particles.ts` | chuva, respingos, neve, folhas, pétalas e poeira calculadas na GPU (uma chamada cada) |
| `twod.ts` | o jogo 2D (Phaser) na mesma página, jogando o mesmo `GameState` |
| `time/` | lógica pura e testada (`tests/render3d`): hora do dia e sol, estações contínuas, campos, clima por semente, luz do quadro, gente na rua, relógio da simulação e demonstração |
| `look3d.json` | números e cores da luz, das estações, do clima e da multidão em 3D |
| `camera.ts` | câmera de construtor: arrastar move; pinça/roda dá zoom; dois dedos girando ou botão direito giram e inclinam; WASD/QE |
| `main.ts` | monta tudo, roda a simulação, controles (velocidade, demonstração, 2D ↔ 3D) e qualidade automática |

## Passagem do tempo

- **Dia**: um relógio próprio, separado das semanas do jogo: um dia completo (amanhecer, dia,
  entardecer, noite) dura `day.seconds` (90 s; `?day=<segundos>` na URL) e para na pausa, com as chaves de
  `look3d.json`. A 4x um dia dura 0,8 s: para não piscar, a variação do dia diminui com a
  velocidade (`dayAmplitude`), sempre suave.
- **Estações**: o relógio de estações do 2D (`src/render/Seasons.ts`, `visual.json`) dá neve rara,
  seca, chance de chuva e o calendário dos campos; o 3D mistura as paletas em ±3 semanas em volta de
  cada troca (`seasonBlend`), sem troca brusca.
- **Clima**: cada semana sorteia, pela semente, chuva (com a chance da estação), força, horário e vento
  (`WeatherClock`); o chão molha e seca aos poucos, e as poças aparecem quando encharca.
- **Demonstração**: um ano em 60 s; força só no visual um inverno com neve e um verão de seca.
- **2D ↔ 3D**: uma página, um `GameState`. Só a visão que aparece roda; a outra dorme, e a fração da
  semana passa de uma para a outra. O Phaser só é baixado ao abrir o 2D.

1 célula = 1 unidade; a coluna do grid é `x` e a linha é `z`. Cada construção fica no centro da
sua área e vira a frente (`+z`) para uma rua vizinha.

## Trocar os modelos por arquivos .glb

Cada modelo tem uma chave e uma área (células em x por z):

| Chave | Área | Chave | Área |
|---|---|---|---|
| `house-0` terreno | 2x2 | `plaza` praça | 2x2 |
| `house-1` tenda | 2x2 | `market` mercado | 2x4 |
| `house-2` casa de barro | 2x2 | `workshop` oficina | 3x3 |
| `house-3` casa de pedra | 2x2 | `park` parque | 2x2 |
| `house-4` casa grande | 2x2 | `altar` | 4x4 |
| `field-0`…`field-3` trigo, cevada, lentilha, linho | 2x2 | `temple` templo | 6x6 |
| `fisher` pescador, `gatherer` coletora | 2x2 | `granary` celeiro | 3x3 |
| `olive`, `palm`, `rock`, `shrub` | 1x1 | `road` rua | 1x1 |

1. Exporte cada modelo em .glb com a frente para `+z` e a base em `y = 0`.
2. Crie um manifesto JSON ao lado dos arquivos, só com as chaves que quiser trocar:

   ```json
   {
     "house-3": { "file": "casa-pedra.glb" },
     "temple": { "file": "templo.glb", "rotationDeg": 180 },
     "palm": { "file": "palmeira.glb", "scale": 0.012, "yOffset": 0 }
   }
   ```

   Sem `scale`, o modelo é encaixado na área da chave. `rotationDeg` gira em torno do eixo vertical.
3. Abra `poc.html?models=./modelos/manifest.json`. As chaves do manifesto substituem os modelos
   feitos por código e as outras continuam. Cada .glb é achatado em partes, uma por material, e
   desenhado com instancing como os provisórios.

Para várias versões da mesma casa, o próximo passo seria uma chave por variante
(`house-3-a`, `house-3-b`), sorteada por `Building.variant` como no 2D.

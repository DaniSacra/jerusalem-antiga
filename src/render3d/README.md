# Prova de conceito 3D (Three.js)

Página isolada, `poc.html`, que desenha em 3D uma cidade gerada pela simulação de verdade. Ela não
altera `src/core`, `src/render`, o jogo 2D nem o deploy.

## Rodar

```bash
npm run poc          # abre o servidor na rede: http://<ip-do-pc>:5174/poc.html
node scripts/poc-perf.mjs               # quadros por segundo e capturas em screenshots/poc/
node scripts/poc-perf.mjs --shots-only  # só as capturas
npx vite build -c vite.poc.config.ts    # build só da prova (dist-poc/), para medir o download
```

Opções na URL de `poc.html`:

| Opção | O que faz |
|---|---|
| `seed=3` | semente do mapa |
| `months=100` | meses jogados pelo bot (30 ≈ 40 construções, 100 ≈ 100, 200 ≈ 150) |
| `bot=eficiente` | perfil do bot do sim-tester (`eficiente`, `comum`, `distraido`) |
| `quality=low` | sem antialias, resolução até 1,25x e sombra 1024 |
| `shadows=off` | sem sombras |
| `models=<url>` | manifesto de um pacote de modelos .glb (veja abaixo) |

## Como é feito

| Arquivo | O que faz |
|---|---|
| `city.ts` | `createGame` + o `Bot` de `tools/sim` por N meses; o 3D só lê o `GameState` |
| `terrain.ts` | relevo suave (plano dentro da cidade), areia e grama por célula com transição, leito do rio, água com ondinhas animadas; borda de 48 células em volta, sumindo na neblina |
| `models.ts` | modelos low-poly feitos por código (provisórios), por chave; carregador de .glb |
| `instancer.ts` | um `InstancedMesh` por parte de modelo: toda a cidade em ~70 chamadas de desenho |
| `life.ts` | moradores (caminhos e destinos do core, como no 2D), fumaça das casas e oficinas, fogo do altar |
| `camera.ts` | câmera de construtor: arrastar move; pinça/roda dá zoom; dois dedos girando ou botão direito giram e inclinam; WASD/QE |
| `main.ts` | luz de fim de tarde com sombras, luz do céu, neblina; monta tudo e mede os quadros por segundo |

1 célula = 1 unidade; a coluna do grid é `x` e a linha é `z`. Cada construção fica no centro da
sua área e vira a frente (`+z`) para uma rua vizinha.

## Trocar os modelos por arquivos .glb

Cada modelo tem uma chave e uma área (células em x por z):

| Chave | Área | Chave | Área |
|---|---|---|---|
| `house-0` terreno | 2x2 | `well` poço | 2x2 |
| `house-1` tenda | 2x2 | `market` mercado | 2x4 |
| `house-2` casa de barro | 2x2 | `workshop` oficina | 3x3 |
| `house-3` casa de pedra | 2x2 | `garden` jardim | 2x2 |
| `house-4` casa grande | 2x2 | `altar` | 4x4 |
| `field-0`…`field-3` trigo, cevada, lentilha, linho | 2x2 | `temple` templo | 6x6 |
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

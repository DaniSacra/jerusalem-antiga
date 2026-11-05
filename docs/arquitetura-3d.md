# Arquitetura da migração para 3D

Mantido pelo `architect`. Decisão do usuário (2026-11-05): "A cidade em 3D é bem mais bonita e rica,
já pode planejar para migrar tudo para 3D de maneira que tenha uma boa arquitetura e que pense tanto
no PC quanto no mobile".

**Destino:** o mapa em Three.js e a interface em HTML/CSS, sem Phaser no fim. `src/core`, `src/data`,
`strings.ts` e a lógica pura da interface são reaproveitados. O 2D fica como plano B, atrás de uma
chave, até o 3D cobrir tudo (lista de paridade na seção 8). Cada fase termina com o jogo jogável e
publicável.

Plano escrito sobre o `main` em 2026-11-05 (depois de `0d2b1e5`, com o Povo, madeira e pedra, o P4
lenha e inverno, a interface Nova em Phaser, o tutorial, a visão 3D só para olhar e o PWA).

---

## 1. O que existe hoje (medido no código)

| Parte | Arquivos | Linhas | Phaser? |
|---|---|---|---|
| Regras | `src/core/*` (33 arquivos), `src/data/*.json` | – | não (puro, testado) |
| Cena do jogo | `src/scenes/GameScene.ts` | 1146 | sim. **Mistura controle do jogo** (relógio, ferramenta, gestos, aplicar ação, eventos → toasts, tutorial, câmera indo a um lugar) com desenho |
| Interface Nova | `src/render/nova/*` (13), `UIScene.ts`, `Toasts.ts`, `Tutorial.ts`, `ui.ts`, `uiArt.ts` | ~4 000 | sim. Mas o **conteúdo já é dado**: `card()` do `Inspector`, as seções de `Panels`, `costLine` de `BuildColumn`, `notices.ts` (puro) |
| Mapa 2D | `MapView`, `textures` (4 078), `Walkers`, `residents`, `Ambient`, `fauna`, `Haulers`, `Fieldhands`, `Effects`, `Lights`, `DayNight`, `Weather`, `FinishPipeline`, `CameraRig`, `iso` | ~8 500 | sim, tudo jogado fora no fim |
| Já sem Phaser | `strings.ts` (587), `tools.ts`, `settings.ts`, `palette.ts`, `install.ts`, `RoadWear.ts`, `Seasons.ts`, `nova/notices.ts`, `nova/metrics.ts` (tabela `REAL`) | – | não: ficam |
| 3D | `src/render3d/*` (~3 400), `src/render/view3d.ts`, `public/models/meshy/` (10 .glb, ~200–360 KB cada) | – | não. **Só olha**: `World` é montado uma vez com o jogo pausado |
| Testes | 32 arquivos Vitest do core, 5 do `render3d`; 54 cenários Playwright em `scripts/visual/run.mjs` (3 213 linhas) | – | os cenários usam **481 vezes** os internos de `window.game` (`ui.view`, `map`, `cameras`, `layout.novaPoint`) |
| Pacote | `index` 1,5 MB (Phaser + jogo), `view` 650 KB (Three), sem gzip | – | – |

Na prova (`spike/threejs`), 150 construções rodaram a 60 qps em 3D e a 19 qps em 2D num celular
simulado com GPU.

**Por que a estimativa antiga (14–20 h) não vale mais:** desde ela entraram a ficha da pessoa, a aba
Povo, os gráficos, os materiais, o inspetor por morador, os passos do lenhador e do casal no tutorial,
as áreas do Templo e "Onde pôr…". Além disso, os 54 cenários visuais estão presos aos internos do
Phaser, o `GameScene` guarda regras de controle que precisam sair dele antes, e o `World` 3D não sabe
se atualizar com o jogo andando. A conta nova está na seção 7: **~42–57 h**.

---

## 2. Arquitetura alvo

### 2.1 Camadas

```
            ┌───────────────────────────────────────────────┐
            │ src/app      boot: escolhe a visão, liga tudo │
            └──────┬─────────────────┬──────────────────────┘
                   │                 │
   ┌───────────────▼──────┐   ┌──────▼──────────────────────┐
   │ src/render3d (Three) │   │ src/ui (HTML/CSS, DOM)      │
   │ mundo, câmera,       │   │ barra, coluna, balões,      │
   │ picking, prévia, fx  │   │ painéis, toasts, tutorial   │
   └───────────────┬──────┘   └──────┬──────────────────────┘
                   │  lê modelos e   │ lê modelos e manda
                   │  comandos de fx │ comandos (selectTool…)
            ┌──────▼─────────────────▼──────────────────────┐
            │ src/game  sessão, gestos, teclas, eventos→    │
            │ avisos e fx, tutorial, modelos da interface   │
            │ (TS puro: sem DOM, sem Three, sem Phaser)     │
            └──────────────────────┬────────────────────────┘
                                   │ chama
            ┌──────────────────────▼────────────────────────┐
            │ src/core + src/data   regras (não mudam)      │
            └───────────────────────────────────────────────┘
```

Regras de dependência (o `code-reviewer` confere):
- `src/core` não importa nada de fora dele (como hoje).
- `src/game` importa só `core`, `data` e `render/strings.ts` (que vai para `src/game/strings.ts` na
  fase 5; até lá fica onde está para não quebrar o 2D). Testado com Vitest em Node.
- `src/render3d` importa `core`, `game` e `three`. Nunca DOM de interface, nunca `src/ui`.
- `src/ui` importa `core`, `game` e o DOM. Nunca `three`.
- `src/app` é o único lugar que conhece os dois lados.
- Enquanto o 2D existir: `src/scenes` e `src/render` (Phaser) também passam a usar `src/game`. É isso
  que impede as duas visões de divergirem.

### 2.2 Pastas e módulos novos

```
src/
  app/
    main.ts          boot: lê a chave de visão, import() dinâmico de start3d ou start2d, service worker
    start3d.ts       cria Session, View3D, Hud; liga sinais; ganchos de dev (window.session, window.view, window.hud)
    start2d.ts       o new Phaser.Game de hoje (sai na fase 5)
  game/              TS puro, Vitest
    session.ts       Session: state, rng, seed, relógio, velocidade, ferramenta, giro do mercado, seleção,
                     hover, tutorial, spots, áreas do Templo; tick(dt); selectTool, apply, upgrade, demolish,
                     pickCategory, restart; emite sinais (refresh, toast, fx, modal, camera)
    gestures.ts      máquina de gestos: toque, arrasto, pinça, giro de dois dedos, botão direito, hover;
                     TAP_SLOP 10, TOUCH_BUILD_DELAY 150, TOUCH_LIFT 90; produz intenções
    keys.ts          tabela de teclas → comandos (1, 2, 0, 3–6, R, Q/E, Espaço, Esc, WASD/setas)
    events.ts        GameEvent[] → toasts (texto, tom) e comandos de fx (ring, float, celebrate,
                     milestone, spoil, fell, bounce); hoje é o handleEvents do GameScene
    placement.ts     originFor, toolDims, orthoSteps, whyInvalid, granaryStock, milestoneSite, spoilSite
    tutorial.ts      TutorialGuide (sai de render/Tutorial.ts) e o alvo de cada passo em CÉLULAS
    toastQueue.ts    a fila de toasts sem desenho (máx. 3, ruins na frente, alerta que deixa de valer sai,
                     segura com painel aberto, volta só 1 aviso)
    model/           o que a interface mostra, como dados (textos e tons, sem px):
      topbar.ts      pílulas, previsão, estação, encurtar por etapas (MAX_FIT)
      build.ts       coluna, categorias, custo "25 prata · 10 madeira (tem 4)", balão da construção escolhida
      inspect.ts     balão da construção tocada (o card() de hoje), moradores, ações
      panels.ts      Objetivos, Avisos, Estatísticas (Agora, Povo, Histórico), Configurações
      person.ts      ficha da pessoa
      preview.ts     pílula sobre a prévia ("Rende N…", "Atende N casas", "Cabe aqui: falta ligar à rua")
      notices.ts     (vem de render/nova/notices.ts)
  render3d/          o que já existe, mais:
    scene3d.ts       renderizador, laço, qualidade automática, perda de contexto (sai de view.ts)
    live.ts          LiveWorld: World que se atualiza por diferença (seção 2.3)
    diff.ts          puro: diferença entre dois CityPlan (entra, sai, muda), Vitest
    picking.ts       tela ↔ célula; parte pura (raio × plano, Vitest) e parte Three
    overlay.ts       grade, prévia fantasma, ladrilhos válido/amarelo/vermelho, raio, área coberta, recursos
                     contados, casas atendidas, spots, áreas do Templo, rua fantasma, Demolir avermelhado
    fx.ts            anel, poeira, celebração, marco (brilho e gente reunida), moscas, árvore caindo,
                     andaime, pulinho
    labels.ts        balões de problema sobre as construções (sprites instanciados num atlas)
    input.ts         Pointer Events do canvas → gestures.ts; câmera recebe pan/zoom/giro
    view.ts          continua para o modo "só olhar" até a fase 4; depois vira a própria visão do jogo
  ui/                HTML/CSS sem framework
    dom.ts           h() mínimo, atualização por chave (só mexe no que mudou)
    ui.css           tokens de palette.ts e tamanhos de metrics.ts como variáveis CSS
    hud.ts           raiz, regiões, forma (celular/PC), freeRect()
    topbar.ts  side.ts  tools.ts  column.ts  balloon.ts  panels.ts  charts.ts (SVG)  person.ts
    toasts.ts  tutorial.ts  modal.ts (vitória, derrota)  title.ts (tela inicial, instalar)
    anchors.ts       elementos presos a um ponto do mundo (balão tocado, pílula da prévia, seta, "−5")
```

Sem React ou Preact: a interface é pequena, muda pouco e já vem em dados (`game/model`). Um `h()` de
~40 linhas e atualização por chave bastam (KISS).

### 2.3 Fluxo estado → visão

```
           tick(dt) a cada quadro
Session ──────────────────────────► advanceClock → stepWeek × N → GameEvent[]
   │                                                   │
   │ refresh() (semana, ação do jogador, hover)        │ events.ts
   ▼                                                   ▼
 readCity(state) uma vez ──► Model (game/model/*) ──► Hud.update(model)    (DOM: só o que mudou)
   │                                             └──► toastQueue → Hud.toasts
   ├──► LiveWorld.sync(state)  (diferença por id, rua, árvore, toco)       (sem reconstruir tudo)
   ├──► Overlay.set(previewModel)  (só quando muda a célula, a ferramenta ou o estado)
   └──► fx: comandos ──► render3d/fx.ts

Por quadro (requestAnimationFrame): câmera, luz do dia, clima, partículas, gente andando,
água, fumaça; e Hud.frame() só reposiciona o que está preso ao mundo (transform, sem layout).
```

- **Nada caro por quadro.** `readCity`, os modelos da interface e o `sync` rodam só no refresh, como
  hoje. Por quadro só há números para a GPU e `transform` em ≤ 4 elementos presos ao mundo.
- **Diferença no mundo** (`live.ts` + `diff.ts`): a chave de cada construção é `id + kind + level +
  emptyLevel + variant + rotated + connected`; ruas por máscara (Uint8Array); árvores, rochas e tocos
  por célula. O `Instancer` ganha `set(key, slot, matrix)` e remoção por troca com o último (O(1)); só
  as malhas instanciadas das chaves que mudaram sobem para a GPU (`instanceMatrix.needsUpdate` por
  chave). Chão e rio nunca são refeitos; a estação e o clima já são uniformes de shader.
- **O core não muda.** Não há "dirty flags" no core: a diferença é calculada na visão, a partir do
  estado, uma vez por refresh (barato: ≤ 200 construções e 2 304 células).
- **Modelos sem espera:** o mundo abre com os modelos por código e troca pelo .glb quando ele chega
  (hoje a visão espera o pacote inteiro).

### 2.4 Modelo de entrada (um só para toque, mouse e teclado)

```
PointerEvent (canvas)  ──► render3d/input.ts ──► game/gestures.ts ──► intenção
KeyboardEvent (window) ──► game/keys.ts ───────────────────────────► comando
Clique em botão HTML   ──► ui/* onTap ─────────────────────────────► comando
```

- `input.ts` normaliza `{ id, sx, sy, touch, button, t }` e entrega a `gestures.ts`, que é puro e
  recebe `cellAt(sx, sy)` e `overUi(sx, sy)` como funções (testável sem tela).
- Intenções: `hover(cell)`, `tap(cell)`, `buildStep(cells)` (arrasto ortogonal, `orthoSteps`),
  `placeAt(cell)` ao soltar, `pan(dx, dy)`, `zoom(f, sx, sy)`, `turn(da)`, `cancel`.
- A Session trata as de jogo; o `CameraRig` trata as de câmera. A câmera do jogo **não** escuta o
  canvas sozinha (hoje `render3d/camera.ts` escuta; isso sai para `input.ts`).

| Gesto | Celular | PC |
|---|---|---|
| Mover a câmera | Mover: arrastar; com ferramenta: dois dedos | Mover: arrastar; sempre: botão direito ou do meio; WASD/setas |
| Zoom | pinça | roda (no ponto do cursor) |
| Girar | dois dedos girando; ↺ ↻ nas Configurações | Q/E (90° animado); Shift + arrastar direito (livre) |
| Tocar numa construção | toque (Mover) | clique (Mover); hover avermelha com Demolir |
| Rua, Casa, Campo, Demolir | arrastar depois de 150 ms com um dedo | arrastar |
| Construção única | ao soltar, mira 90 px acima do dedo | ao soltar, no cursor |
| Atalhos | – | 1, 2, 0, 3–6, R, Espaço, Esc (cadeia de hoje) |

- **"Sobre a interface" vira DOM:** os botões HTML recebem os eventos; o canvas só recebe o que cai
  fora deles. A folga de 8 px em volta dos controles é um `::after` invisível. Um arrasto que começou
  no mapa e passa por baixo de um botão é detectado com `document.elementFromPoint` (regra "a rua
  parou sob um botão"). `onTap` continua: botão só dispara com o toque que começou nele.
- **Hover** só com `pointerType === 'mouse'`. Cursor de mão aberta/fechada por CSS.
- `touch-action: none` no canvas; `passive: false` só na roda.

### 2.5 Interface HTML e regras de tela

```
<body>
  <canvas id="world">                       camada 0
  <div id="hud" data-form="phone|pc">
    <div class="anchors">                   10  balão tocado, pílula da prévia, "−5", seta do tutorial no mundo
    <header class="top">  .left (nível, pílulas, objetivo)  .right (estação, velocidade, engrenagem)   20
    <nav class="side">   Objetivos, Avisos, Estatísticas            (o botão 3D some: o jogo já é 3D)
    <nav class="tools">  Mover, Rua, Demolir
    <nav class="column"> categorias / faixa / balão da construção escolhida
    <div class="toasts">                     40
    <section class="panel">                  50  um painel por vez, ficha da pessoa
    <div class="tutorial">                   55  balão de uma frase, Pular, Entendi
    <div class="modal">                      60  vitória, derrota
  <div id="title">                           tela inicial (Começar, Rever o tutorial, Instalar app)
```

- **Forma decidida uma vez** (e de novo ao girar ou redimensionar), com a regra de hoje
  (`layout.ts > IS_PHONE`): altura real < 500 px ou ponteiro grosso = `phone`. O CSS usa
  `[data-form=phone]`, não larguras soltas.
- **Tamanhos em px reais.** A tabela `REAL` de `nova/metrics.ts` vira variáveis CSS (`--num`, `--text`,
  `--btn`, `--col`…). Some a escala do jogo 1280 de largura: **a tela inteira é usada**, inclusive em
  celulares compridos (isso resolve um item de "Fora do escopo"). Nada abaixo de 12 px; toque ≥ 44 px.
- **Bordas seguras:** `env(safe-area-inset-*)` no `#hud` (entalhe do celular deitado).
- **Retrato:** um aviso "Gire o aparelho" (o manifesto já pede paisagem).
- **Mapa livre:** `freeRect()` mede as regiões com `getBoundingClientRect` no refresh (não por quadro).
  É onde a câmera centra o tutorial, a casa da ficha e o Templo, e o que o `nudge` usa.
- **Barra do topo que não cabe:** as 5 etapas de `MAX_FIT` viram classes `fit-1…fit-5`; um
  `ResizeObserver` sobe a etapa enquanto a fileira transborda (cálculo em `game/model/topbar.ts`).
- **Gráficos** das Estatísticas em SVG (52 pontos por linha, sem biblioteca).
- **Miniaturas** da coluna: imagens dos modelos 3D, renderizadas uma vez num canvas fora da tela ao
  abrir o jogo e guardadas como `ObjectURL` (sem arquivos novos).
- **Redesenho:** cada componente compara o dado novo com o anterior e só toca o DOM que mudou.

### 2.6 Câmera

- Perspectiva, FOV 35°, olhando um ponto do chão (o `CameraRig` de `render3d/camera.ts`, sem os
  listeners próprios).
- Zoom por distância (12 a 70 unidades). **A inclinação acompanha o zoom** (mais perto = mais baixa,
  mais longe = mais de cima), sem gesto próprio de inclinar: evita brigar com a pinça (decisão do
  usuário, seção 10).
- Giro livre por gesto; Q/E e ↺ ↻ giram 90° animado. Começa no altar.
- Limites: o foco fica dentro do mapa mais uma margem.
- `glideTo(cell, freeRect)` para o tutorial, "Casa" na ficha, as famílias da aba Povo e o Templo;
  `nudge(dx)` para o balão largo no celular. Mexer na câmera cancela o deslizamento (como hoje).

### 2.7 Picking e posicionamento na grade 3D

- 1 célula = 1 unidade; coluna `x`, linha `z` (como o `render3d` já faz). A cidade é plana.
- **Célula sob o dedo:** raio da câmera pelo ponto da tela (com `TOUCH_LIFT` de 90 px nas construções
  únicas no toque) cruzando o plano `y = 0`, depois `floor`. Conta pura em `picking.ts`, O(1), sem
  raycast em malha a cada movimento.
- **Tocar numa construção alta** (Mover e Demolir): antes do plano, testa o raio contra as caixas das
  construções (≤ 200, lista do `CityPlan`) e fica com a mais perto. Assim tocar no telhado do Templo
  pega o Templo, não a rua atrás dele.
- **Prévia:** fantasma translúcido do modelo + ladrilhos da área (branco válido, **amarelo** "falta
  ligar à rua", vermelho inválido ou sem prata) num `InstancedMesh` de quadrados, contorno do raio
  (`LineLoop`), área já coberta, células de recurso contadas, contorno das casas atendidas e a pílula
  HTML presa ao topo do fantasma. Só muda quando muda a célula, a ferramenta ou o refresh.
- **Oclusão:** construções entre a câmera e a prévia ficam translúcidas (atributo de opacidade por
  instância) enquanto há ferramenta de construção.
- **Grade:** um `LineSegments` só, visível com ferramenta de construção.
- **Origem e tamanho:** `originFor`, `toolDims`, `dimsOf(rotated)` vêm de `game/placement.ts` (os mesmos do 2D).

### 2.8 Orçamento de desempenho

| Medida | Celular médio (perf: 844x390, DPR 2,6, CPU 4x) | PC 1366x768 |
|---|---|---|
| Quadros por segundo, 150 construções, 60 moradores andando, jogo a 3x, dia/noite/chuva | ≥ 30 (qualidade automática pode descer) | ≥ 60 |
| Chamadas de desenho | ≤ 120 | ≤ 150 |
| Triângulos | ≤ 300 mil (alta), ≤ 120 mil (mín.) | ≤ 500 mil |
| JS por quadro | ≤ 6 ms | ≤ 4 ms |
| Refresh semanal (readCity + modelos + sync por diferença) | ≤ 8 ms | ≤ 3 ms |
| Mudar a célula do hover / prévia | ≤ 1 ms | ≤ 1 ms |
| Primeira carga (gzip): app + core + UI | ≤ 150 KB | – |
| Three + render3d (gzip) | ≤ 220 KB, baixado já no boot | – |
| Modelos .glb | sob demanda, por chave, depois do primeiro quadro | – |

- Qualidade automática (já existe): resolução, sombras, partículas em 3 níveis.
- **Desenhar só quando precisa:** com o jogo pausado, câmera parada e sem efeito ativo, o laço desenha
  a 10 qps (bateria e calor no celular). Painel aberto não para o mundo.
- `webglcontextlost` / `restored`: refaz o mundo a partir do estado (o estado nunca está na GPU).

### 2.9 Offline (PWA)

- `public/sw.js` continua (rede primeiro para a página, cache primeiro para o resto).
- Novo: na instalação, **pré-cache do app, do pedaço do 3D e do `manifest.json` dos modelos**. Um
  plugin pequeno do Vite escreve a lista de arquivos com hash em `sw.js` (`VERSION` sobe a cada build).
  Os .glb entram no cache no primeiro uso; sem eles o mundo usa os modelos por código (já é assim).
- `npm run test:pwa` passa a abrir o jogo em 3D offline.

---

## 3. O que fica, o que sai do Phaser e o que se refaz

### 3.1 Fica como está
- `src/core/**`, `src/data/**` (sem mudança nenhuma por causa da migração).
- `src/render/strings.ts`, `tools.ts`, `settings.ts`, `palette.ts` (cores; o CSS lê `NOVA_CSS`),
  `install.ts`, `RoadWear.ts`, `Seasons.ts` (`SeasonClock`, `treeKind`, `mixColor`; o `cellHash` de
  `iso.ts` vem junto para `game/`), `nova/notices.ts`, `nova/metrics.ts` (a tabela `REAL`).
- `src/render3d/**` inteiro: `plan`, `crowd`, `figures`, `world`, `models`, `instancer`, `terrain`,
  `life`, `shaders`, `atmosphere`, `particles`, `camera`, `time/*`, `look3d.json`.
- `public/models/meshy/*`, `public/sw.js`, `public/manifest.webmanifest`, `public/icons/*`.
- `tools/sim/*` (só usa o core). Os testes do core e do `render3d`.

### 3.2 Sai do Phaser para `src/game` (a lógica, sem mudar o comportamento)
| De | Para | O quê |
|---|---|---|
| `scenes/GameScene.ts` (relógio, ferramenta, `apply`, `whyInvalid`, `demolish`, `upgradeAt`, `selectTool`, `pickCategory`, `restart`, `cycleSpeed`, contagem de nascimentos e casamentos) | `game/session.ts`, `game/placement.ts` | controle do jogo |
| `GameScene` `onDown/onMove/onUp`, pinça, botão direito, `orthoSteps` | `game/gestures.ts` | gestos |
| `GameScene.setupInput` | `game/keys.ts` | teclas |
| `GameScene.handleEvents` | `game/events.ts` | eventos → toasts e fx |
| `GameScene` `checkTutorial`, `tutorialTarget`, `lumberRoadLeft`; `render/Tutorial.ts > TutorialGuide, tutorialSeen` | `game/tutorial.ts` | tutorial |
| `GameScene.updateTempleAreas`, `showSpots/drawSpots` | `game/session.ts` | áreas do Templo e "Onde pôr" |
| `render/Toasts.ts` (fila, regras) | `game/toastQueue.ts` | fila de toasts |
| `nova/Inspector.ts` `card`, `houseCard`, `lossLine`, `foodLines`, `levelStatOf` | `game/model/inspect.ts` | balão da construção tocada |
| `nova/Panels.ts` (seções, linhas, gráficos como números) | `game/model/panels.ts` | painéis |
| `nova/BuildColumn.ts` `costLine` e textos | `game/model/build.ts` | coluna e balão da escolhida |
| `nova/TopBar.ts` textos e etapas `MAX_FIT` | `game/model/topbar.ts` | barra do topo |
| `nova/people.ts` `jobText`, `residentsOf`, `bandOf`, `ageNow`; `nova/PersonSheet.ts` (conteúdo) | `game/model/person.ts` | gente |
| `render/MapView.ts` `originFor`, `toolDims`, `granaryStock`; `render/Effects.ts` `milestoneSite`, `spoilSite` | `game/placement.ts` | posição |

Os modelos trocam px por **papéis** (`tone: 'good'|'bad'|'warn'|'muted'|'gold'`, `size: 'num'|'text'|'small'`);
o Phaser e o HTML traduzem o papel para cor e tamanho. Assim os dois desenham o mesmo texto.

### 3.3 Refaz (HTML ou Three) e depois apaga
| Hoje (Phaser) | Amanhã |
|---|---|
| `scenes/UIScene.ts`, `nova/NovaUi.ts`, `TopBar`, `BuildColumn`, `Tools`, `Panels`, `PersonSheet`, `Balloon`, `widgets`, `Inspector` (desenho), `render/Toasts.ts` (desenho), `Tutorial.ts > TutorialView`, `ui.ts`, `uiArt.ts`, `layout.ts` | `src/ui/*` |
| `scenes/TitleScene.ts` | `ui/title.ts` |
| `scenes/GameScene.ts` (o que sobra), `main.ts` | `app/start3d.ts`, `app/main.ts` |
| `MapView.ts` (chão, ruas, construções, prévia, grade, balões de problema, destaques) | `render3d/live.ts`, `overlay.ts`, `labels.ts` |
| `textures.ts`, `residents.ts`, `fauna.ts` | `render3d/models.ts`, `figures.ts` (já existem) + modelos Meshy |
| `Walkers.ts`, `Fieldhands.ts`, `Haulers.ts`, `Ambient.ts` | `render3d/life.ts`, `figures.ts` (moradores, famílias e campos já existem; carregadores, pescador, coletora e animais são novos) |
| `Effects.ts` | `render3d/fx.ts` |
| `DayNight.ts`, `Lights.ts`, `Weather.ts`, `WeatherScene.ts`, `Seasons` desenho | `render3d/atmosphere.ts`, `particles.ts`, `shaders.ts`, `time/*` (já existem) |
| `FinishPipeline.ts` (vinheta e maquete) | vinheta no tone mapping; maquete: decisão do usuário |
| `CameraRig.ts`, `iso.ts` | `render3d/camera.ts`, `picking.ts` |
| `render/view3d.ts` | some na fase 4 (o 3D deixa de ser uma camada por cima) |

---

## 4. A chave 2D/3D (plano B)

- `settings.view: '2d' | '3d'` em `render/settings.ts` (chave `jerusalem-antiga.settings`, já salva no
  navegador), mais `?view=2d|3d` na URL para os testes.
- `app/main.ts` faz `import('./start2d')` ou `import('./start3d')`: **quem joga em 3D não baixa o
  Phaser**, e quem joga em 2D não baixa o Three até tocar no botão 3D.
- Configurações: "Visão: 3D (novo) / 2D clássico". Fases 1–3: o padrão é o 2D e o 3D é opcional.
  Fase 4: o padrão vira 3D. Sem WebGL 2, sempre 2D (até a fase 5).
- O botão "3D" da coluna esquerda continua no 2D até a fase 4 (abre a visão só para olhar).

---

## 5. Testes

**Vitest (Node, sem tela)**
- `tests/game/session.test.ts`: ferramenta e ação (`place`, Demolir, Melhorar), toasts de falta de
  prata e material uma vez por arrasto, dívida baixa 3x para 1x, tutorial segura o relógio, nascimentos
  e casamentos contados, restart com a mesma semente.
- `tests/game/gestures.test.ts`: toque × arrasto (10 px), 150 ms antes de construir no toque, pinça
  cancela o arrasto, mira 90 px acima nas construções únicas, soltar sobre a interface cancela, rua
  cortada por botão, botão direito move.
- `tests/game/keys.test.ts`, `tests/game/events.test.ts` (cada GameEvent → toast e fx certos),
  `tests/game/toastQueue.test.ts` (máx. 3, ruins na frente, aviso que deixa de valer sai, volta só 1).
- `tests/game/model/*.test.ts`: os textos dos balões, painéis, coluna e barra (muitos já são lidos
  hoje pelos cenários visuais; passam a ser testados sem tela).
- `tests/render3d/picking.test.ts` (célula sob o ponto nos 4 giros e com zoom), `diff.test.ts`
  (entra, sai, sobe de nível, liga à rua, toco vira árvore), `overlay.test.ts` (cores dos ladrilhos).

**Playwright** (`scripts/visual/run.mjs`): todo cenário de jogo roda em **celular 844x390 com toque** e
**PC 1366x768 com mouse**; os de layout também em 915x412 e 800x360.
- Ganchos estáveis, os mesmos nas duas visões: `window.session` (state, refresh, selectTool, setSpeed,
  tool, selected, guide, handleEvents), `window.view.cellScreen(x, y)` (ponto da tela de uma célula),
  `window.view.info()` (qps, chamadas, triângulos). Os pontos da interface saem de `layout.novaPoint`
  e vêm de `[data-spot="tool-road"]` (o mesmo nome) no HTML.
- Fase 0 troca os ajudantes (`startGame`, `tool`, `pick`, `mouseDrag`, `touchDrag`, `stats`) para esses
  ganchos; cada cenário portado roda com `?view=2d` e `?view=3d`.
- Cenários de arte só do 2D (`town-art`, `day-night`, `seasons`, `nova-*` com pixels do Phaser) ganham
  equivalentes 3D e saem na fase 5.
- Desempenho: `scripts/view3d-perf.mjs` passa a medir o jogo andando (150 construções, 3x, arrasto de
  rua e hover).

---

## 6. Fases

Cada fase termina com `npm test`, `npx tsc --noEmit`, `npm run build` e `npm run test:visual` passando,
o 2D jogável e o 3D atrás da chave. Horas = sessão do agente, incluindo testes e revisão.

### Fase 0 — Costuras (sem mudança visível) · 7–9 h
- **Entra:** `src/game/` (session, gestures, keys, events, placement, tutorial, toastQueue, model/*);
  `GameScene`, `UIScene` e a Nova passam a usar esses módulos (desenham igual); `app/main.ts` com
  `import()` dinâmico e a chave `settings.view` (3D ainda abre a visão de hoje); ganchos
  `window.session` e `window.view`; ajudantes do `run.mjs` nos ganchos novos.
- **Arquivos:** novos em `src/game/**`, `src/app/**`, `tests/game/**`; mudam `scenes/GameScene.ts`,
  `scenes/UIScene.ts`, `render/nova/*`, `render/Toasts.ts`, `render/Tutorial.ts`, `render/MapView.ts`,
  `render/Effects.ts`, `src/main.ts`, `scripts/visual/run.mjs`, `docs/TESTING.md`.
- **Testes:** os Vitest de `src/game` da seção 5; todos os 54 cenários continuam passando no 2D.
- **Pronto quando:** o `GameScene` só desenha e repassa entrada (< 450 linhas); nenhuma regra de
  controle fica no Phaser; screenshots iguais às de antes.
- **Risco:** conflito com outros agentes em `src/render` e `src/scenes`; fazer com a árvore parada.

### Fase 1 — Mapa jogável em 3D com HUD mínimo · 10–13 h
- **Entra:** `?view=3d` abre o jogo em 3D: relógio andando, `LiveWorld` por diferença, picking, prévia
  (fantasma, ladrilhos, raio, amarelo "falta ligar à rua"), grade, arrasto de rua/casa/campo/Demolir,
  construções únicas ao soltar, Mercado girando (R e toque de novo), Demolir avermelhado e "Cortar
  árvore · 5 prata", câmera do jogo (seção 2.6) com a entrada única (seção 2.4). HUD HTML mínimo:
  barra do topo completa (pílulas, objetivo, estação, velocidade), Mover/Rua/Demolir, coluna com
  categorias e faixa, toasts (`toastQueue`), engrenagem com a chave 2D/3D. Tela inicial em HTML.
- **Arquivos:** novos `app/start3d.ts`, `render3d/{scene3d,live,diff,picking,overlay,input}.ts`,
  `ui/{dom,hud,topbar,tools,column,toasts,title}.ts`, `ui/ui.css`; mudam `render3d/{view,world,instancer,camera}.ts`.
- **Testes:** Vitest `picking`, `diff`, `overlay`; Playwright `play3d`, `play3d-pc` (constrói rua,
  pescador, campo, praça, casa; Demolir; Mercado girado), `touch3d` (150 ms, pinça não constrói, mira
  90 px), `input3d-pc` (teclas, botão direito, roda), `hud3d-phone|wide|pc|small-phone`.
- **Pronto quando:** dá para jogar até o objetivo 4 em 3D no celular e no PC sem abrir o 2D; ≥ 30 qps
  no perf com 150 construções e o jogo a 3x; nenhum texto < 12 px, nenhum toque < 44 px.

### Fase 2 — Interface completa · 9–12 h
- **Entra:** balão da construção escolhida (custo, manutenção, efeito, "Saldo depois", "Comida
  depois"); balão da construção tocada preso ao mundo (moradores em 1 ou 2 colunas, filhos, nível,
  ✓/✗, Melhorar, "Onde pôr…", Demolir com "Certeza?", `nudge`); ficha da pessoa com parentes e Voltar;
  painéis Objetivos, Avisos (selo e pulso), Estatísticas (Agora, Povo, Histórico em SVG),
  Configurações (girar, dia e noite, visão); vitória e derrota (Mesmo mapa, Tentar de novo); tom de
  fome; balões de problema no mapa (`labels.ts`, com cadeado e escala no zoom afastado); pílula
  "Rende N…" sobre a prévia; "−5" e "Perde N de comida".
- **Arquivos:** `ui/{balloon,panels,charts,person,modal,side,anchors}.ts`, `render3d/labels.ts`.
- **Testes:** os cenários de interface portados para `?view=3d` nos dois aparelhos: `house-people*`,
  `person-sheet*`, `stats-people*`, `granary-upgrade*`, `materials*`, `top-fit*`, `demolish-loss*`,
  `preview-food-after*`, `lumber-shared*`, `harvest-countdown*`, `caravan-announced*`,
  `couple-waiting*`, `winter-cold*`, `quarry-full*`, `drag-release-on-button*`, `p2-ui*`.
- **Pronto quando:** todo o item "Interface" da lista de paridade está ✓ em 3D; balões nunca cobrem
  controles; Esc fecha na ordem de hoje.

### Fase 3 — Tutorial, áreas do Templo, efeitos e vida · 8–11 h
- **Entra:** tutorial inteiro (balão, Pular, Entendi, seta para botões HTML e para pontos do mundo,
  rua fantasma dourada, terrenos verdes da casa, câmera deslizando ao `freeRect`, relógio parado nos
  passos de construir, passo do lenhador, mini passo do mercado); áreas do Templo (verde, amarela, rua
  dourada, câmera vai à primeira); destaques "Onde pôr…"; efeitos (anel, celebração do Templo, poeira
  ao demolir, pulinho e "+N", texto vermelho, marco com brilho e gente reunida, moscas no celeiro,
  anel dourado da colheita, árvore caindo, andaime); carregadores da colheita, pescador e coletora;
  dia e noite ligados ao relógio do jogo (seção 10).
- **Arquivos:** `ui/tutorial.ts`, `render3d/{fx,overlay,life,figures}.ts`, `game/tutorial.ts`.
- **Testes:** `tutorial3d`, `tutorial3d-pc`, `tutorial-blocked`, `toasts-tutorial`, `temple-areas*`,
  `marcos3d`; Vitest dos alvos do tutorial em células.
- **Pronto quando:** um jogador novo faz o tutorial inteiro em 3D no celular e no PC; a lista de
  paridade fica toda ✓ ou "decidido não fazer".

### Fase 4 — 3D vira o padrão · 6–9 h
- **Entra:** o resto dos cenários portados; `view3d-perf` com o jogo andando; pré-cache do PWA;
  rodada de revisão (`playtester`, `ui-designer`, `fun-critic`, `code-reviewer`) e correções; o padrão
  da chave vira 3D; o botão "3D" e `render/view3d.ts` saem; `docs/GAME_DESIGN.md` (Interface, Câmera e
  controles, Arte) e `docs/TESTING.md` reescritos para o 3D.
- **Testes:** todos os cenários em 3D nos dois aparelhos; `test:pwa` em 3D offline; perf ≥ 30 qps.
- **Pronto quando:** o usuário joga uma partida inteira no celular e no PC e aprova; o 2D continua a
  um clique nas Configurações.

### Fase 5 — O Phaser sai · 2–3 h
- **Só com a aprovação do usuário** (sugestão: depois de uma semana jogando em 3D sem voltar ao 2D).
- **Sai:** `src/scenes/**`, os arquivos Phaser de `src/render/**` (seção 3.3), `app/start2d.ts`, a
  chave de visão, `phaser` do `package.json`, cenários só do 2D. `strings.ts`, `settings.ts`,
  `palette.ts`, `tools.ts`, `Seasons.ts`, `RoadWear.ts`, `install.ts` vão para `src/game` ou `src/ui`.
- **Pronto quando:** build sem Phaser, `CLAUDE.md` e os docs sem 2D, todos os testes passando.

---

## 7. Estimativa total

| Fase | Horas |
|---|---|
| 0 Costuras | 7–9 |
| 1 Mapa jogável + HUD mínimo | 10–13 |
| 2 Interface completa | 9–12 |
| 3 Tutorial, Templo, efeitos e vida | 8–11 |
| 4 3D padrão, testes, desempenho, PWA, revisões | 6–9 |
| 5 Phaser sai | 2–3 |
| **Total** | **42–57 h** |

A faixa de cima vale se o usuário pedir paridade de arte alta (seção 10, item 5) ou se houver muitas
features novas de interface no meio da migração. Modelos novos no Meshy não estão contados.

---

## 8. Lista de paridade (`docs/GAME_DESIGN.md` → 3D)

Legenda da fase: 0–5. "Já" = o `render3d` de hoje já desenha. "Decisão" = seção 10.

| Item do design | No 3D | Onde | Fase |
|---|---|---|---|
| **Mapa** 48x48, areia/grama, rio, rochas, oliveiras, palmeiras, amendoeiras, figueiras, bosques, afloramento | já | `terrain.ts`, `plan.ts`, `Seasons.treeKind` | – |
| **Início:** altar 4x4, anel de ruas, rua até a entrada, tendas da caravana, câmera no altar | já (câmera: 1) | `plan.ts`, `camera.ts` | 1 |
| Frase da caravana (toast grande, 5 s, sozinho) e "X e Y querem se casar" | refazer | `game/events.ts`, `ui/toasts.ts` | 1 |
| **Construções:** os 12 tipos + altar, por nível, casa vazia que guardou o nível | já | `models.ts`, `plan.ts` | – |
| Celeiro, Mercado, Oficina níveis 2–3 | já | `plan.ts` (acréscimos `up-*`) | – |
| Melhorar (custo + pedra, pulo e brilho, toast) | refazer | `ui/balloon.ts`, `fx.ts` | 2 |
| Prévia com custo/material faltando, toast "Falta madeira/pedra" uma vez por arrasto | refazer | `game/session.ts`, `overlay.ts` | 1 |
| **Ruas:** arrastar ortogonal, rua solta avisa, junções | já (junções) / 1 | `gestures.ts`, `plan.ts` | 1 |
| Ruas que evoluem (largura, calçamento) | refazer | `RoadWear` + `plan.ts` | 3 / decisão |
| **Casas:** níveis, 6 variantes por nível, espelhadas, tom e deslocamento | 1 modelo por nível | `models.ts` | decisão |
| Casa esperando material, portão trancado da vazia | já (portão) / 2 | `plan.ts`, `ui/balloon.ts` | 2 |
| **Felicidade:** carinha triste no mapa | refazer | `labels.ts` | 2 |
| **Pessoas:** moradores no balão, ficha, parentes, aba Povo, famílias | refazer | `game/model/*`, `ui/*` | 2 |
| Famílias e noivos andando até a casa (jumento, trouxas) | já | `figures.ts` | – |
| **Caravanas:** anúncio, chegada, toasts | refazer | `events.ts` | 1 |
| **Tempo:** semanas, 1x/3x/pausa, Espaço | refazer | `session.ts`, `ui/topbar.ts` | 1 |
| **Colheita / previsão / estoque:** pílula da comida, "38/50", "cheio", "FOME" | refazer | `model/topbar.ts` | 1 |
| Celeiro enchendo (4 estados de estoque) | refazer | `plan.ts` + `models.ts` | 3 / decisão |
| Campos pela estação (arado, broto, verde, dourado, palha), seca longe do rio | já | `time/season.ts`, `shaders.ts` | – |
| **Madeira e pedra:** pílula Materiais, ⚠ vermelho, brilho da pedra liberada | refazer | `ui/topbar.ts` | 1 |
| Lenhador corta árvore: árvore cai, toco, broto | toco/broto já; queda 3 | `fx.ts` | 3 |
| **Lenha e inverno:** frio, casas sem fumaça no frio, toasts de frio | fumaça já (ligar ao frio) / 1 | `life.ts`, `events.ts` | 1 |
| **Marcos:** brilho, gente reunida, toast, lista com semana | refazer | `fx.ts`, `life.ts`, `ui/panels.ts` | 3 |
| **Histórico:** gráficos de 52 semanas | refazer | `ui/charts.ts` (SVG) | 2 |
| **Dívida e derrota:** toasts, 3x→1x, tela com Mesmo mapa / Tentar de novo | refazer | `session.ts`, `ui/modal.ts` | 2 |
| **Avisos** (`alerts()`), selo, pulso, toast por episódio | refazer | `model/notices`, `ui/side.ts` | 2 |
| **Objetivos:** pílula, lista em 1–2 colunas, Templo 312/800, vitória | refazer | `model/panels.ts`, `ui/*` | 1 (pílula), 2 |
| **Interface Nova:** nível, pílulas, estação "inverno em N sem", velocidade, engrenagem | refazer | `ui/topbar.ts` | 1 |
| Encurtar a barra por etapas (`MAX_FIT`) | refazer | `model/topbar.ts` + `ResizeObserver` | 1 |
| Coluna: 4 categorias, faixa, cadeado, "novo", miniaturas, tecla no PC | refazer | `ui/column.ts` | 1 |
| Balão da construção escolhida (Saldo depois, Comida depois, até onde melhora) | refazer | `model/build.ts`, `ui/balloon.ts` | 2 |
| Balão da construção tocada (todas as variações do design) | refazer | `model/inspect.ts`, `ui/balloon.ts` | 2 |
| "Onde pôr uma praça/mercado/parque/pedreira/lenhador", "Ligar à rua" | refazer | `session.ts`, `overlay.ts` | 3 |
| Ficha da pessoa | refazer | `ui/person.ts` | 2 |
| Toasts: máx. 3, fila, ruins na frente, somem com painel, volta 1 aviso | lógica pronta na fase 0 | `toastQueue.ts`, `ui/toasts.ts` | 1 |
| Configurações: girar, dia e noite, efeito maquete | refazer (maquete: decisão) | `ui/panels.ts` | 2 |
| Detalhes de toque: 8 px de folga, `onTap`, Esc em cadeia, dica de Rua/Demolir, "Certeza?" | refazer | `ui/*`, `keys.ts` | 1–2 |
| "Local inválido" com o motivo | lógica pronta na fase 0 | `placement.ts` | 1 |
| **Mapa e mensagens:** balões de problema na ordem do design, cadeado, escala no zoom | refazer | `labels.ts` | 2 |
| Prévia: grade, raio, área coberta, casas atendidas, "Atende N", recursos contados, amarelo | refazer | `overlay.ts` | 1 |
| Áreas do Templo (verde/amarela/rua dourada), câmera vai até elas, toasts | refazer | `overlay.ts`, `session.ts` | 3 |
| Tom avermelhado na fome | refazer | CSS sobre o canvas | 2 |
| Tela inicial (3 passos, Começar, Rever o tutorial, Instalar app, dica do iPhone) | refazer | `ui/title.ts` | 1 |
| PWA: instala, tela cheia deitado, offline | ajustar | `sw.js`, plugin do Vite | 4 |
| **Tutorial** (7 passos + mercado, seta, rua fantasma, relógio parado, câmera) | refazer | `game/tutorial.ts`, `ui/tutorial.ts`, `overlay.ts` | 3 |
| **Estações e clima:** cores, chuva, neve rara, seca, chão molhado, poças, pétalas, poeira | já | `time/*`, `particles.ts`, `shaders.ts` | – |
| Ar tremendo de calor no verão | não existe no 3D | `shaders.ts` | decisão |
| **Câmera:** zoom, girar 90°, começa no altar | já (reorganizar entrada) | `camera.ts`, `input.ts` | 1 |
| Celular: arrastar move / constrói, pinça, 150 ms, mira 90 px; PC: botão direito, roda, atalhos | refazer | `gestures.ts`, `keys.ts` | 1 |
| **Vida:** moradores pelas ruas, quantidade por moradores, param na pausa, 3x mais rápido | já (ligar ao relógio) | `life.ts` | 1 |
| 12 tipos de morador com o que carregam (jarro, foice, tora, carrinho…) | gente por idade e sexo | `figures.ts` | decisão |
| Agricultores nos campos | já | `life.ts` | – |
| Carregadores na colheita, pescador e coletora saindo | refazer | `life.ts` | 3 |
| Animais, pombas, barquinhos, lavadeiras, varais, flores, trilhas | parcial | `life.ts`, `world.ts` | decisão |
| Dia e noite: janelas, lamparinas, fogo do altar, fogueiras, estrelas | já | `atmosphere.ts`, `shaders.ts` | – |
| Andaime ao construir, pulinho e "+N", "+1" do bebê, texto vermelho ao cair | refazer | `fx.ts`, `ui/anchors.ts` | 3 |
| Anel ao construir, poeira ao demolir, celebração do Templo, moscas, anel da colheita | refazer | `fx.ts` | 3 |
| **Arte:** 6 ofícios da oficina | 1 modelo | `models.ts` | decisão |
| Vinheta e efeito maquete; queda do efeito em aparelho lento | qualidade automática já | `scene3d.ts` | decisão |
| Visão 3D só para olhar (botão 3D, convite pulsando) | sai | – | 4 |

---

## 9. Riscos

| Risco | Efeito | O que fazer |
|---|---|---|
| Duas interfaces vivas ao mesmo tempo | trabalho em dobro e divergência | fase 0 põe a lógica num lugar só; o 2D só recebe correções (já decidido); migração curta |
| Outros agentes mexendo em `src/render`, `src/scenes`, `scripts/visual` | conflitos na fase 0 | fazer a fase 0 com a árvore parada, num pacote só |
| Picking em perspectiva no celular | células pequenas longe da câmera, toque errado | zoom mínimo maior no celular, mira 90 px, ladrilho do hover sempre visível, caixas das construções antes do chão |
| Prédio alto escondendo a prévia ou a seta do tutorial | jogador não vê onde constrói | translucidez por instância entre câmera e prévia; tutorial gira/afasta a câmera se o alvo estiver escondido |
| Celular fraco | < 30 qps | qualidade automática, desenhar a 10 qps parado, sombras só na alta; 2D até a fase 5 |
| Perda do contexto WebGL (iOS, troca de app) | tela preta | refazer o mundo a partir do estado em `webglcontextrestored` |
| Calor e bateria | sessões longas incomodam | laço econômico parado; teto de resolução |
| Peso dos .glb (~3 MB) | primeira abertura lenta no 4G | modelos por código primeiro, .glb depois, cache do SW |
| Porte dos 54 cenários | a fase 4 escorrega | ganchos estáveis na fase 0; portar junto com cada fase |
| Texto preso ao mundo (balões) tremendo | leitura ruim | posição por `transform` arredondada a px inteiro, uma vez por quadro |
| Regra "nada cobre controles" muda de natureza | balões sob botões | regiões CSS + `freeRect()`; cenários de layout nos 4 tamanhos |

---

## 10. Decisões do usuário

1. ~~Congelar a interface 2D durante a migração?~~ **Já decidido** (CLAUDE.md, 2026-11-05): o Phaser
   2D é legado, só recebe correções; regras novas no core valem nas duas visões; telas novas só no HTML.
   Consequência para o plano: até a fase 2 terminar, um pacote de jogo com tela nova espera ou entra
   só em 3D.
2. **Câmera:** giro livre com Q/E de 90° e inclinação ligada ao zoom (recomendado), ou só 4 ângulos
   fixos como no 2D, ou inclinação livre por gesto.
3. **Aparelho sem WebGL 2 depois da fase 5:** mensagem "Seu aparelho não abre o jogo" (recomendado;
   quase todos os celulares atuais têm) ou manter o Phaser para sempre como plano B.
4. **Quando o 3D vira o padrão (fim da fase 4) e quando o Phaser sai** (sugestão: uma semana depois,
   se você não voltar ao 2D).
5. **Paridade de arte:** o que do 2D precisa vir para o 3D: 6 variantes por nível de casa, 6 ofícios
   da oficina, celeiro enchendo, ruas que evoluem, 12 tipos de morador com o que carregam, animais,
   lavadeiras, barquinhos, varais, calor no verão. Recomendo: celeiro enchendo, ruas que evoluem e
   2–3 variantes por nível na fase 3; o resto depois, com créditos do Meshy (restam ~756).
6. **Efeito maquete:** tirar (recomendado; custa uma passada inteira) ou manter só na qualidade alta.
7. **Dia e noite:** o ciclo do 2D (4 min a 1x, para na pausa; recomendado, é o jogo) ou o relógio
   próprio de 90 s da visão 3D de hoje.
8. **Ordem com os pacotes de jogo:** começar a migração já (depois do P4) ou fazer antes "Obras com
   tempo". Recomendo migrar já: cada pacote novo de interface em Phaser vira trabalho jogado fora.
9. **Tela cheia em celulares compridos** (hoje fora do escopo) passa a valer de graça com o HTML: ok?

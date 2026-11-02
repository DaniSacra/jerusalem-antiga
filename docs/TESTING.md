# Como testar

Dois níveis de teste: **unitários** (regras do jogo, rápidos, obrigatórios) e **visuais**
(o jogo de verdade num navegador, com screenshots).

```bash
npm test                        # testes unitários (Vitest), ~1 s
npm run test:visual             # testes visuais (Playwright), ~1 min
npm run test:visual -- touch    # só os cenários cujo nome contém "touch"
npx tsc --noEmit                # typecheck
```

Antes de dar uma tarefa por concluída: `npm test`, `npx tsc --noEmit` e `npm run test:visual`
precisam passar, e as screenshots afetadas pela mudança devem ser **olhadas**.

## Testes unitários (`tests/`)

Cobrem só `src/core` (TypeScript puro, sem Phaser). **Toda regra nova ou alterada precisa de teste.**

| Arquivo | O que cobre |
|---|---|
| `map.test.ts` | rio na borda leste, contagem de rochas e árvores, área livre do altar e da rua, estado inicial (altar, rua, entrada, prata, liberações) |
| `network.test.ts` | rede de ruas ligada ao altar, desconexão ao demolir, custo e validação de rua, caminhos por busca em largura, máscara de junções, exigência de rua para cada tipo de construção |
| `coverage.test.ts` | raio quadrado, sem cobertura quando desconectado, área sagrada do altar, raio do templo 3 x 3 |
| `economy.test.ts` | eficiência, produção, construções desconectadas não produzem nem contam vagas, vagas do templo |
| `actions.test.ts` | custos e locais inválidos, posicionamento do templo (3 x 3, bloqueios, exige rua, lista de posições possíveis), limpar, proteção do altar e do templo |
| `houses.test.ts` | evolução e regressão (rua, poço, mercado, altar ou templo), fome, informações e balões (incluindo "sem trabalhadores") |
| `families.test.ts` | chegada de famílias, 3 primeiras garantidas, chance de 35%, uma por terreno, desconexão e fome, desvio de rota, saída pelo altar |
| `goals.test.ts` | as 8 metas, recompensas, liberações, contagem só de casas conectadas, vitória com o templo |
| `simulation.test.ts` | comida, prata, mês, fome e relógio |

### Utilitários (`tests/helpers.ts`)

- `emptyGame(overrides)` — jogo sem rochas/árvores, areia em tudo (exceto o rio), muita prata e
  tudo liberado. Altar em (16,16) e rua inicial em x = 16, de y = 17 a 31.
- `put(state, kind, x, y, level)` — coloca uma construção sem cobrar e já no nível desejado.
- `road(state, [[x, y], ...])` — coloca ruas sem cobrar.
- `constRng(v)` — gerador aleatório fixo (0 = sempre acontece, 0,99 = nunca acontece).
- `ROADSIDE = 15` — coluna logo a oeste da rua inicial (conectada).

## Testes visuais (`scripts/visual/run.mjs`)

O script sobe o servidor de desenvolvimento do Vite, abre o jogo no Chromium do Playwright,
executa cada cenário, salva screenshots em `screenshots/` (fora do git) e falha se uma verificação
quebrar ou a página registrar erro no console. Em falha, salva também `FAILED-<cenário>.png`.

| Cenário | O que faz e verifica | Screenshots |
|---|---|---|
| `title` | tela inicial | `title` |
| `build-with-mouse` | rua e casas arrastando, campo e poço clicando; conta ruas e construções | `build-with-mouse` |
| `families-arrive` | terrenos ao lado da rua em 3x; espera família andando e tenda pronta | `families-walking`, `families-arrived` |
| `town-art` | monta uma cidade com todos os níveis e prédios; templo conectado; prévias | `town-art`, `overlay-temple-preview`, `overlay-house-sacred-area` |
| `camera-wheel` | zoom com a roda dentro dos limites | `camera-zoom-in`, `camera-zoom-out` |
| `touch` | celular deitado com toque real: um dedo constrói rua sem mover a câmera; pinça dá zoom sem construir | `touch-title`, `touch-after-pinch` |
| `clarity` | pausado: rua arrastada longe da rede (apagada, tracejada, aviso); campo sem moradores com balão "sem trabalhadores"; fome na barra; posições do templo; mapa sem espaço para o templo | `clarity-loose-road`, `clarity-famine`, `overlay-temple-spots`, `temple-no-spot` |
| `victory` | constrói o templo e espera a vitória | `temple-celebration`, `victory` |

### Ganchos de desenvolvimento

Só no modo dev (`npm run dev`, e é o que o script usa), o jogo expõe no `window`:

- `window.game` — a `GameScene` (câmera em `game.cameras.main`, `game.refresh()`, `game.selectTool(t)`);
- `window.state` — o `GameState` atual;
- `window.core` — todas as funções do core (`core.place`, `core.clearCell`, `core.stepMonth`...).

Use-os para montar situações rapidamente em vez de jogar até lá. Depois de mudar o estado
diretamente, chame `window.game.refresh()`. Se mudar conexões à mão (ruas, construções), prefira
`core.place`/`core.clearCell`, que já recalculam a rede, ou chame `core.refreshCity(state)`.

### Escrever um cenário novo

Adicione uma entrada em `scenarios` no `run.mjs`:

```js
async 'meu-cenario'(page) {
  await startGame(page);              // abre o jogo e passa da tela inicial
  await tool(page, 2);                // escolhe a ferramenta pela posição (1 = Ver, 2 = Rua...)
  await mouseDrag(page, [[17, 16], [20, 16]]);   // arrasta entre células da grade
  const s = await stats(page);        // ruas, construções, níveis, zoom, vitória
  assert(s.roads === 19, 'mensagem clara');
  await shot(page, 'meu-cenario');    // screenshots/meu-cenario.png
},
```

- `cellToScreen(page, x, y)` converte uma célula da grade para a posição na tela usando a câmera atual.
- Para celular, use a forma `{ context: {...}, run(page) {...} }` (veja o cenário `touch`), com
  eventos de toque enviados pelo protocolo do Chrome.
- O navegador sem placa de vídeo é lento: prefira `page.waitForFunction(...)` esperando um estado
  do jogo em vez de tempos fixos longos.

## Testar no celular de verdade

`npm run dev` e abra no celular o endereço "Network" que o Vite mostra (mesma rede Wi-Fi). O
teste visual de toque cobre os gestos, mas tamanho de texto e conforto dos botões só se avaliam
no aparelho.

# Revisão de código do Pacote 2 (code-reviewer, 2026-11-04)

Escopo: `git diff a06d471..HEAD` (f9dfc4c, d901a12, ea74959), spec `plano-p2.md`.

Verificações: `npx tsc --noEmit` sem erros · `npx vitest run` 22 arquivos, 1133 testes passando ·
`npm run build` ok (aviso de chunk de 1,48 MB, já existia).

Regras gerais em ordem: `src/core` não importa Phaser; nenhum `Math.random` no core; nenhum `any` novo;
nenhum id `well`/`garden`/`water` sobrou no código, nos dados, no sim ou nos cenários visuais; `sacred`
sobra só como serviço da Alegria, como pede a spec. As docs (`GAME_DESIGN.md`, `TESTING.md`) acompanham
os dados.

## Graves
Nenhum problema grave no P2. O item 1 é um bug visível que **já existia** antes do pacote, mas está no
mesmo código que o P2 mexeu.

1. **Balão "sem fonte" sem textura** (bug antigo, visível). `src/render/textures.ts:3553` gera ícones
   só para `['road', 'plaza', 'market', 'park', 'workers', 'sad']`, mas `balloonNeed` também devolve
   `'noSource'` (`src/core/houses.ts:74`), e `MapView.ts:599/607` usa `TEX.need('noSource')`, que não
   existe (o Phaser mostra a textura de "faltando"). Correção: desenhar o ícone no `needIcon` e trocar a
   lista por uma que o compilador confira, por exemplo
   `const NEED_ICONS = { road: 1, plaza: 1, …, noSource: 1 } satisfies Record<BalloonKind, 1>` e
   iterar as chaves dela.

## Médios
2. **Regra de comida duplicada no render, e um campo morto no core.** `src/render/nova/Inspector.ts:151`
   (`eatsMore`) refaz no render o cálculo de `upgradeGain` com o fator do inverno e arredonda à mão
   (repete o `round2`). Com isso o `upgradeGain(...).food` (`src/core/readouts.ts:96-100`) não é mais
   lido por ninguém (só pelo teste). Correção: `upgradeGain(level, week)` no core usando
   `foodPerResident`, testar ali, e apagar o `eatsMore`.
3. **`foodLostIfRemoved` faz mais do que precisa** (`src/core/readouts.ts:136-144`). Ele clona o estado
   e roda `clearCell`, que chama `refreshCity` (BFS da rede **e** a cobertura inteira). Além disso
   `copy.buildings[s.buildings.indexOf(o)]` roda para cada célula da grade (custo células ×
   construções). Medido numa cidade do sim (50 construções, 881 ruas): 0,39 ms por chamada. Hoje isso
   não pesa, porque a chamada acontece por troca de célula na mira (`NovaUi.ts:258`, guardada por
   `tagKey`), por refresh no inspetor (`Inspector.ts:158`) e 2x por célula ao demolir
   (`GameScene.ts:408`, `:842`). Mas o custo cresce com a cidade. Correção, sem mudar o resultado:
   - (a) sair cedo com `if (s.food <= RULES.baseFoodStorage || !s.buildings.some((b) => b.connected && BUILDINGS[b.kind].storage)) return 0`;
   - (b) refazer a grade com um `Map` velho→novo em vez do `indexOf`;
   - (c) usar só `refreshNetwork` (a capacidade não depende da cobertura), ou seja, remover a construção
     ou a rua da cópia à mão em vez de chamar `clearCell`.

   O `silver: Math.max(s.silver, 0)` não faz nada: prata só pesa para árvore, e árvore sai antes, na
   linha 139. Pode sair.
4. **Número de balanceamento fixo no código** (`src/core/map.ts:151`): `rockOutcrop.rocks + between(rng, [0, 4])`.
   O `[2, 8]` do bosque, na linha 150, já era assim. Correção: `extra: [0, 4]` em
   `rules.json > map.rockOutcrop`, e `[2, 8]` em `denseGrove` (os tipos ficam em `types.ts:217-224`).
5. **O sim copia à mão a tabela de casas** (`tools/sim/survival.ts:152`):
   `EVOLUTION = [[1,'plaza'],[2,'market'],[3,'park']]` repete o `houses.json`. Se o P3 mudar uma
   exigência, o bot passa a medir o jogo errado sem nenhum aviso. Correção: tirar a lista dos dados,
   pegando a necessidade que o nível `l+1` tem e o nível `l` não tem em `HOUSE_LEVELS`. No mesmo
   passo, o filtro "casa parada" aparece duas vezes (`:175` e `:226`); vale um helper `stalled(s, level, kind)`.
6. **Flag com dois sentidos no sim** (`tools/sim/survival.ts:228`): o "Distraído só reage ao balão
   depois de vê-lo" usa `foodOnlyInFamine`, que é a flag de comida. Correção: uma flag própria no
   `Profile` (por exemplo `reactsToBalloons: boolean`), ou usar só `seen()` para todos, já que o
   `delay` de cada perfil já existe para isso.

## Menores (DRY/KISS, textos, paleta, código morto)
7. Restos de comentários e código morto:
   - `src/core/houses.ts:65`: o doc comment do `needVisible` ficou órfão ("A need is shown only once…"). Apagar.
   - `src/render/MapView.ts:732`: "the tutorial's house spots are the ones with water" → "near a plaza".
   - `src/render/nova/BuildColumn.ts:72`: o exemplo "Água e / comida" não existe mais.
   - `tests/houses.test.ts:336-338`: o comentário diz que `needVisible` ainda esconde e manda "Unskip",
     mas o teste já roda e passa. Atualizar o comentário.
8. **Cadeado do balão** (`src/render/MapView.ts:85-86`): `SERVICE_NEEDS` é declarada depois de
   `isLocked`, que a usa, repete `NeedKind` sem `road` e precisa de dois casts. O custo está ok: roda
   por refresh, não por quadro. Correção: exportar do core um `needLocked(s, need: BalloonKind)` (ou um
   `SERVICE_NEEDS` tipado em `types.ts`), que o Inspector (`label`, linha ~110) também pode usar.
9. **Demolir duplicado na cena**: `GameScene.demolishAt` (`:405-417`) e o ramo `clear` do `apply`
   (`:838-854`) repetem a mesma sequência (ler a perda, `clearCell`, poeira, texto flutuante). Correção:
   um helper privado `demolishFx(cell, removed, lost)`.
10. **Cor fixa no código** (`src/render/textures.ts:2052-2053`): a esteira da praça usa `0x8a5d3b`,
    o mesmo marrom de `:1310`. Correção: uma entrada nova no `palette.ts` (por exemplo `C.matBrown`),
    usada nos dois lugares.
11. **Símbolo fora do `strings.ts`** (`src/render/nova/Inspector.ts:159`, e `:174`, que já existia): o
    prefixo `'✗ '` é texto de tela. Correção: `T.nova.inspect.bad(text)` ou tirar o "✗" do mesmo lugar
    que o `ok()` já usa.
12. **`NovaUi.freeCenter`** (`src/render/nova/NovaUi.ts:175`): `Math.min(this.tutorial.top ?? this.tools.top, this.tools.top, …)`
    repete `tools.top`. Basta `Math.min(this.tutorial.top ?? H, this.tools.top, this.toasts.top ?? H)`.
    O custo por quadro do glide está ok (um `reduce` sobre no máximo 3 toasts). Um detalhe: como o
    centro conta os toasts, um toast que aparece no meio do deslize muda o destino da câmera e dá um
    pequeno tranco. Se incomodar, guarde o `freeCenter` no começo do pan.
13. **`tools/sim/run.ts:39`** (`perYear`): uma linha só com `Math.floor((w - 1) / 52)` repetido duas
    vezes e o 52 escrito à mão. Correção: `WEEKS_PER_YEAR` do core e o laço em várias linhas. O
    `gap56` (`:37`) está certo (índices 4→5 são os objetivos 5→6), mas o nome no comentário ("J1") só
    se entende lendo o plano.

## Custo por quadro (conferido, sem problema)
- Balões com cadeado: `syncBalloon` roda por refresh (`MapView.ts:359`), não por quadro; o cadeado é
  uma imagem criada uma vez por balão e só alterna a visibilidade.
- Câmera do tutorial: `fieldHint`/`houseHint` são calculados por troca de passo ou por refresh
  (`GameScene.ts:545-549`), não por quadro. Por quadro rodam só `stepSpot` (objetos pequenos) e o
  `freeCenter`.
- Prévia "Perde N": calculada por troca de célula ou por refresh (`tagKey`), nunca por quadro. Ver o
  item 3 para o custo de cada chamada.
- Toasts: `prune()` roda por refresh, e `valid()` é um `some` sobre a lista de avisos.
- Texturas da praça e do parque: geradas uma vez em `generateTextures`.

## Observação (não é de código)
Os números em `buildings.json` não batem com a tabela 2.1 da spec: Praça com manutenção 1 (a spec diz
2), Parque 60/1 (a spec diz 40/2) e Casa 30→40 (fora da spec). `GAME_DESIGN.md` acompanha os dados,
então parece calibração aprovada depois da spec. Se for isso, vale registrar em `docs/design.md` com o
motivo, como o P1 fez. O texto do balão em `GAME_DESIGN.md:159` ("✗ Mercado (objetivo 3)") difere da
string real, "(libera no objetivo 3)".

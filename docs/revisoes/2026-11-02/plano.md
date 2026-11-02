# Plano da revisão de 2026-11-02 (game-director)

Base: relatórios de playtester, sim-tester, fun-critic, ui-designer, sprite-artist, map-designer,
copywriter, code-reviewer e test-reviewer desta pasta, mais `docs/design.md` e
`docs/GAME_DESIGN.md`. Primeira revisão: não há plano anterior.

## 1. Resumo (como o jogo está hoje)
1. Estável: 115 testes, typecheck, build e 17 cenários visuais passam; 3 bots × 8 seeds × 400 meses sem quebrar nenhuma invariante.
2. A cidade viva é o ponto mais forte (nota 9): dia e noite, agricultores, animais, varais e ruas gastas; os problemas são de acabamento (chão serrilhado, rio, noite lilás) e alguns bugs de animais.
3. A Felicidade está ligada mas não pesa: o imposto varia só 0–5%, a carinha nasce triste por desemprego antes de o jogador ter como resolver, e o Jardim é enfeite (não se paga).
4. A partida é curta e plana: o Comum vence no mês 64; as metas 5, 7 e 8 se cumprem sozinhas, e no fim sobra prata sem destino; o Distraído perde 68,8% (alvo ~60%).
5. Há uma dívida técnica real: a economia é recalculada por prédio a cada sync (O(N²)), o que vai pesar no celular com cidade grande.

## 2. Consensos (dois ou mais agentes)
- **Felicidade irrelevante na economia e no jogo** — sim-tester, fun-critic, playtester. O efeito no imposto é ~0, o bônus de famílias quase nunca liga, o Jardim não compensa.
- **Desemprego entristece desde o mês 1, sem remédio** — playtester, sim-tester, fun-critic, code-reviewer (item 15). Fere o pilar 5 (mecânica liberada por meta).
- **Custo O(N²) de `balloonNeed`/`houseInfo` → `computeEconomy`** — playtester, code-reviewer, test-reviewer.
- **Prata grande invade a Comida na placa; números secundários pequenos** — playtester, ui-designer.
- **Aviso de saldo dá conselho errado** (manda demolir quando o maior gasto é Campo ou Templo) — playtester, copywriter.
- **Detalhe da carinha incompleto/errado** (omite poço e mercado, "Feliz paga", cita o Jardim antes de liberar, "Altar" também para o Templo) — playtester, copywriter, ui-designer, code-reviewer.
- **"Desemprego" × "sem vaga" × "sem trabalho"** e números de trabalho confusos ("19/2", "+5 sem vaga") — copywriter, ui-designer, playtester.
- **Texto em português fora de `strings.ts`** (`info.ts`, `tools.ts`) — copywriter, code-reviewer.
- **Bugs do Ambient** (quadro −1 nos bichos, bichos sumindo no limite, quintal sem mudar, lavadeiras e barcos longe da cidade, lavadeira de costas para o rio) — playtester, code-reviewer, sprite-artist, map-designer.
- **Meio do jogo sem decisão e prata parada no fim** — sim-tester, fun-critic.
- **Altar e templo únicos** — fun-critic concorda com o usuário; lazer já existe (Jardim).

## 3. Conflitos e decisões
| Tema | Posições | Decisão e motivo |
|---|---|---|
| Como fazer a Felicidade pesar | fun-critic: só números (`taxMax` 1,4, `familyMax` 2,0, `happy` 60). sim-tester: nenhum número resolve; precisa mudar a fórmula no core | **Degrau no core**: feliz = `taxMax`, contente = 1, triste = `taxMin` (o mesmo para famílias pela média da cidade). Motivo: o sim-tester mostrou que a reta não sai de ±3%; "casa feliz paga +20%" cabe numa frase (pilar 1). Não é mecânica nova: é a mesma regra, legível |
| Desemprego no começo | playtester/code-reviewer: só depois da Oficina. sim-tester: `idleMax` 20 → 10. fun-critic: carinha só a partir da Meta 4 | **A Felicidade inteira liga com o Jardim (Meta 4)** e `idleMax` 10. Antes disso, carinha escondida e casas neutras. Motivo: pilar 5 literal (liberada por meta) e uma condição só, que já cobre "depois da Oficina" (Meta 3) |
| Altar/templo na felicidade | GAME_DESIGN: +10. Proposta ao usuário (sem resposta): tirar | **Tirar** (`sacred` sai da tabela). Motivo: com o degrau, altar + poço + mercado já dariam "feliz" de graça na zona da casa grande; sem ele, **o Jardim é o que deixa feliz** — escolha de lugar (pilar 3). O altar continua sendo o que faz a casa grande. Confirmar com o usuário ao aprovar |
| Distraído ~60% | sim-tester A1 (meta 3 = 65), A2 (prata inicial 230), B (campo 0,5 prata) | **A1 como ponto de partida**, remedido depois do degrau (o degrau pune mais a cidade triste). Motivo: A1 também ataca a armadilha da meta 4, onde caem 107 de 137 derrotas. B fica fora (ver Fora) |
| Duração / metas que se cumprem sozinhas | fun-critic: meta 5 → 110, meta 7 → "8 casas felizes". sim-tester: metas maiores só +40% e travam partidas | **Meta 7 vira "Tenha 8 casas felizes"**; meta 5 fica. Motivo: transforma uma meta automática em decisão de posicionamento (pilar 3) e dá propósito ao Jardim, sem travar o mapa |
| Próxima mecânica | lista: "oficina entristece". fun-critic e proposta ao usuário: Festa religiosa | **Festa religiosa no Pacote 2**, oficina-entristece segue em espera. Motivo: Festa dá destino à prata parada (problema medido) e é o que o usuário disse que o povo quer; oficina-entristece só pune |
| Recorde na vitória | fun-critic: recorde local de meses. Decisão anterior: sem medalha de tempo (empurra pressa) | **Resumo sim, recorde de tempo não** (Pacote 3). Recorde só de maior população/felicidade |
| Atraso de 1 mês da fome no imposto | test-reviewer: decidir | **Aceito** e fixado por teste. A fome depende da comida do próprio cálculo; o atraso é invisível ao jogador |
| Rótulo "Altar ou Templo" (copywriter) | — | Sem efeito: o motivo sai da tabela |

## 4. Pacote 1 — "Felicidade que se sente" (implantar agora)
Mecânica nova: **nenhuma**. A Felicidade já existe; o pacote a conserta (fórmula, liberação por meta,
textos), corrige bugs e mede o equilíbrio.

### 4.1 Felicidade: degrau, liberada pelo Jardim, sem altar
- Origem: sim-tester (D), fun-critic (1), playtester, code-reviewer (15), game-director.
- Por que agora: a última mecânica entregue não funciona; não se empilha outra em cima (pilar 5).
- Regras:
  - Felicidade só vale com o Jardim liberado (`unlocked.garden`). Antes: sem partes, humor contente, fatores 1, carinha escondida na placa, sem balão triste.
  - Partes: base 50, jardim +20, poço +5, mercado +5, fome −30, desemprego até −10. Altar/templo sai.
  - Humor igual (feliz ≥ 65, triste < 35). Imposto e famílias em degrau: feliz `taxMax`/`familyMax`, contente 1, triste `taxMin`/`familyMin` (famílias pela média da cidade).
- Arquivos: `src/core/happiness.ts`, `src/core/economy.ts`, `src/core/families.ts`, `src/core/types.ts` (comentário "1 at 50"), `src/data/rules.json` (`happiness.sacred` removido, `idleMax` 20 → 10; o `50` fixo em `economy.ts:80` passa a `RULES.happiness.base`), `src/render/Hud.ts` (carinha só com Jardim), `tests/happiness.test.ts`, `tests/economy.test.ts`, `tests/families.test.ts`, `docs/GAME_DESIGN.md`.
- Aceite: Jardim cobrindo uma casa conectada sem fome e sem desemprego a torna feliz (70) e ela paga exatamente +20%; antes da Meta 4 nenhuma casa tem parte de felicidade e a placa não mostra a carinha; testes novos verdes.

### 4.2 Meta 7 "Tenha 8 casas felizes"
- Origem: fun-critic (2), sim-tester (metas automáticas).
- Por que agora: dá ao Jardim e à felicidade um objetivo claro, e tira uma meta que se cumpre sozinha.
- Arquivos: `src/data/goals.json` (tipo novo `happyHouses`, alvo 8, prêmio 120 mantido), `src/core` (`goalProgress` conta casas conectadas felizes), `tests/goals.test.ts`, texto no `goals.json` pelo copywriter, `docs/GAME_DESIGN.md`.
- Aceite: progresso "N/8" na faixa da meta; teste com 8 casas felizes cumpre e com 7 não; sim-tester confirma que nenhuma partida trava nela (Comum e Eficiente).

### 4.3 Equilíbrio
- Origem: sim-tester (A1), fun-critic.
- `goals.json` meta 3 `reward` 40 → 65 como ponto de partida. Depois do 4.1 e 4.2, o sim-tester remede e propõe o valor final entre 55 e 75 para os 3 alvos: Eficiente vence sem dívida, Comum vence ≥ 90%, Distraído perde ~60%. O game-director aprova.
- Aceite: 500 seeds por bot com os 3 alvos; Jardim construído pelo bot "comum" passa a se pagar (imposto real/base > 1,03 com jardins).

### 4.4 Desempenho (custo O(N²))
- Origem: playtester (3), code-reviewer (1, 9, 12), test-reviewer.
- `computeEconomy` uma vez por sync; `balloonNeed(s, b, eco)` e `houseInfo(s, b, eco)` recebem a economia pronta (com felicidade por casa em `Map<id, Happiness>`); `idleShare` usa a mesma. `drawTrails` só redesenha quando casas mudam; `Walkers` só troca textura quando a chave muda; culling em `drawWater` e no balanço das árvores (sprite-artist 2, 12).
- Arquivos: `src/core/houses.ts`, `src/core/economy.ts`, `src/render/MapView.ts`, `src/render/Walkers.ts`.
- Aceite: arrastar 1 célula com 122 construções < 0,5 ms no Node (antes 3,8 ms); resultados de economia idênticos nos testes.

### 4.5 Bugs
- Origem: playtester, code-reviewer, ui-designer, sprite-artist, map-designer.
- `Ambient.ts`: `>>>` no lugar de `>>` (quadro −1 dos bichos); `keepIfRoom` para grupos já existentes; chave do quintal com a célula; lavadeiras e barcos medidos do centro do altar (23,5; 23,5), euclidiano; flip da lavadeira pelo lado do rio; `tx` do barco pela linha atual.
- `MapView.ts:556`: ondinha do rio com `>>>`.
- `Options.ts`: zona interativa do tamanho do painel (toque não vaza para Casa/Campo).
- Aviso de saldo: "maior gasto" só entre serviços demolíveis (poço, mercado, jardim, oficina); sem casas, "Saldo −X: construa casas para ganhar impostos"; sem serviço demolível, sem conselho de demolir.
- `GameScene.ts`: comentário "New map, new seed" no lugar certo; `docs/TESTING.md` com o Jardim no `leftButton`.
- Aceite: cenário `ambient` verifica que nenhum animal usa `__MISSING` e que bichos no limite não mudam entre dois syncs; cenário das Opções mostra que tocar no título não troca a ferramenta; teste do core do aviso de saldo com só um Campo e com Templo.

### 4.6 Interface e textos
- Origem: ui-designer (2, 3, 5, 6, 7, 8), copywriter (1–10), playtester, code-reviewer (5, 13).
- Placa: prata e comida abreviadas a partir de 10 000 ("45 mil"); sub-texto sem "/mês" ("−2,4") e fonte 17; custos 18. Trabalho com sobra mostra vagas ocupadas ("2/2") + "+17 sem vaga"; tocar em Trabalho ou Comida mostra o detalhe na linha de informação ("17 pessoas sem trabalho: campos e oficinas dão trabalho").
- Detalhe da carinha dinâmico (core expõe quantas casas têm cada parte): "Felicidade 31 · 0 felizes, 2 contentes, 4 tristes · Sem trabalho −10 · Jardim: 2 casas · Poço: nenhuma casa".
- Linha de informação quebra em 2 linhas (fonte 18) quando a escala cairia abaixo de 0,9.
- Faixa da meta: progresso cumprido em pílula verde "6/6 ✓".
- Alvos de toque ≥ 44 px de tela também no 800 x 360 (`SPEED_BTN` 72; `LEFT_BTN` e altura dos espaços da placa calculados).
- Textos do copywriter: "ligado ao altar" no lugar de "ligado à rua"; toasts ≤ 45 caracteres; avisos de dívida no imperativo com "faltam N meses"; "Sem trabalho" no lugar de "Desemprego"; "60/100" na linha da casa; unidades "N prata", "manutenção 1/mês"; "liberada"; frase da tela inicial; todos os textos de `info.ts` e `tools.ts` movidos para `T`.
- Arquivos: `src/render/Hud.ts`, `InfoLine.ts`, `layout.ts`, `Toolbar.ts`, `info.ts`, `tools.ts`, `strings.ts`, `src/data/goals.json`, `src/core/economy.ts` (agregado das partes), `docs/GAME_DESIGN.md`.
- Aceite: capturas `hud-phone*`, `hud-pc*`, `happiness-*` sem sobreposição com prata de 6 dígitos; nenhum texto em português fora de `strings.ts`/`goals.json` em `src/render`.

### 4.7 Arte (só o que serve à felicidade e bugs visuais)
- Origem: sprite-artist (8, 10, 3), fun-critic (1).
- Jardim com silhueta própria: pérgola com videira e figueira no lugar da palmeira, para não se confundir com o campo no zoom mínimo; comentário das árvores corrigido.
- Casa feliz ganha vida na frente (flores no vaso, criança brincando) pelo `Ambient` que já existe, dentro de `maxAmbient`. Números em `visual.json`.
- Varal do chão só em casas sem varal no telhado.
- Noite: tint mais azul (`0x6a78b0` como ponto de partida) em `visual.json`.
- Cores novas de `fauna.ts`, `Ambient.ts` e `garden` em `palette.ts` (`C.fauna`, `C.flowers`).
- Aceite: capturas `overlay-garden`, `happiness-house`, `day-night-night`, `town-art` olhadas no celular e no PC; jardim e campo distinguíveis no zoom mínimo.

### 4.8 Testes
- Origem: test-reviewer.
- Reescrever os testes de felicidade para o degrau e a liberação pelo Jardim; cidade triste atrai menos famílias; famílias garantidas ignoram o fator; arredondamento do desemprego; limite inferior exato (0); raio do jardim na borda; `serviceOf`/`SERVICE_SOURCES`; manutenção do jardim cobrada; `road` antes de `sad`; terreno vazio nunca `sad`; nenhum nível de casa exige `garden` (e separar `NeedKind` de `ServiceKind`, code-reviewer 7); atraso de 1 mês da fome no imposto fixado; `goalProgress` com o tipo novo.
- Aceite: `npm test` verde; test-reviewer sem lacuna de prioridade alta nas regras mexidas.

## 5. Próximos pacotes
**Pacote 2 — "Festa religiosa" (mecânica nova) + "Avisos a tempo".** Única mecânica nova: tocar no altar (ou no templo) e pagar comida e prata para uma festa que dá +felicidade à cidade inteira por alguns meses, com espera para repetir e efeito maior com o Templo; liberada por meta. Versão mais simples: um botão na linha de informação do altar, um número de bônus, duração, espera e custo em `rules.json`; procissão até o altar e tochas à noite como efeito do render. Resolve a prata parada do fim e é o "festa religiosa" que o usuário disse que o povo quer, sem multiplicar altares. Entra junto (sem mecânica): o resto já aprovado de "Avisos a tempo" (aviso de comida antes da fome, saldo só quando aperta, "Atende N casas" na prévia, derrota com causa e dica) e da interface (aviso curto e tocável, contorno no espaço da placa aberto, miniaturas do mesmo tamanho). Depende de o usuário aprovar a Festa e de o Pacote 1 mostrar a felicidade com peso.

**Pacote 3 — "Cidade densa" (só aparência e mapa) + final com resumo.** A entrega A e B já escopadas em `docs/design.md`, somando o que esta revisão achou: bosques e afloramentos de rocha (map-designer 2), rio com curva e largura pelo seed (3, com teste novo), faixa livre e marco na entrada (4), decoração pelo seed (5), `grassShare` alinhado ao texto; transição suave areia/grama (sprite-artist 1), rio com brilho irregular e juncos (2), poças de luz à noite (3), trilhas em "L" (6), blur menor no zoom mínimo (7), calçamento quente (9), janelas por `PARTS` (11). Junto, a tela de vitória com resumo (mês do templo, felicidade média, maior população) e recorde local só de população e felicidade. Nenhuma regra muda.

## 6. Fora (não volta na próxima revisão sem fato novo)
- **Mais de um altar ou templo**: o usuário decidiu; único é o que faz a casa grande ser escolha de lugar.
- **Lazer novo além do Jardim**: o Jardim já é o lazer.
- **Campo `silver` 1 → 0,5**: o usuário aprovou 1; a duração vem de conteúdo (Festa, metas), não de apertar o campo.
- **Metas maiores para alongar a partida (80 → 110, 150 → 220, 6 grandes) e Templo 1200**: medido, quase não alonga e trava partidas.
- **`startFood` 40/45, `famineLeaveChance` 0,12, `happiness.famine` −15, `startSilver` 230**: medidos, não chegam ao alvo ou pioram; a meta 3 resolve melhor.
- **`taxMax` 1,4 e `familyMax` 2,0 na reta**: substituídos pelo degrau.
- **Oficina entristece vizinhos**: continua em espera a pedido do usuário; não é a próxima.
- **Recorde de menor número de meses**: empurra pressa (decisão anterior mantida).
- **Gente nos telhados, terraços de plantação, colinas de fundo, lua**: bonitos, mas depois de "Cidade densa"; não pedir de novo antes dela.
- **Instalar `@vitest/coverage-v8`**: só com ordem do usuário (dependência nova).

## 7. Prompt de implantação do Pacote 1
```
Implemente o Pacote 1 "Felicidade que se sente" descrito em
docs/revisoes/2026-11-02/plano.md (seção 4, itens 4.1 a 4.8). Você (agente
principal) implementa direto; não use agentes durante a implementação.

Ordem:
1. Core e dados (4.1, 4.2, 4.3, 4.4, aviso de saldo do 4.5): felicidade em
   degrau, só com o Jardim liberado, sem altar/templo, idleMax 10; meta 7
   "Tenha 8 casas felizes" (tipo happyHouses); meta 3 reward 65; economia
   calculada uma vez por sync. Testes do 4.8 no Vitest junto de cada regra.
2. Render e interface (resto do 4.5, 4.6, 4.7): bugs do Ambient, Opções,
   placa, linha de informação, faixa da meta, textos para strings.ts, arte
   do jardim e da casa feliz, noite, varais, cores em palette.ts.
3. Docs no mesmo trabalho: docs/GAME_DESIGN.md (Felicidade, Metas,
   Interface, avisos), docs/TESTING.md (cenários novos e leftButton) e
   docs/design.md (estado, decisões de 2026-11-02 com motivo, candidatos:
   Pacote 2 Festa religiosa + Avisos a tempo; Pacote 3 Cidade densa).
4. Rode npm test, npx tsc --noEmit, npm run build e npm run test:visual;
   olhe as capturas hud-phone*, hud-pc*, happiness-*, overlay-garden,
   day-night-night, town-art e ambient.

No final, rode em paralelo os agentes de revisão: test-reviewer,
code-reviewer, sim-tester (500 seeds por bot; alvos: Eficiente vence sem
dívida, Comum vence >= 90%, Distraído perde ~60%; propor o valor final da
recompensa da meta 3 entre 55 e 75 e confirmar que a meta 7 não trava) e
playtester (celular 844x390 e 800x360, PC 1366x768). Traga os relatórios e
os números para o game-director aprovar. Não faça commit nem push; deixe
tudo no working tree.
```

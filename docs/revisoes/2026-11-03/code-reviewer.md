# code-reviewer - 2026-11-03

Foco: sobrevivência: o jogador achou o jogo "meio impossível" depois do Pacote 1 de sobrevivência. Descobrir por que se perde, se o Ano 1 é justo, se a curva de dificuldade, comida, colheita, celeiro, seca e chegada de famílias estão equilibradas, e o que mudar para ficar desafiador mas jogável.

## Revisão de código: Pacote 1 de sobrevivência (95dd36c)

**Verificações:** `npx tsc --noEmit`, `npm test` (19 arquivos, 756 testes) e `npm run build` passaram. O build só mostra o aviso de sempre: o bundle tem 1,47 MB.

Nenhum arquivo do repositório foi alterado. O único arquivo criado foi a sonda `probe.ts`, no scratchpad da sessão. O `npm run sim` atualizou o próprio cache em `node_modules/.cache/sim`.

Arquitetura ok:
- `src/core` não importa Phaser.
- `src/core` não usa `Math.random`, só o `rng` injetado.
- Não há `any` em `src`.
- Os usos de `Math.random` ficam no render, então estão ok: `GameScene.ts:158` (semente) e `Haulers.ts:30` (só visual).

### Graves: deixam o jogo mais difícil que o desenho ou travam a medição

1. **A porta das famílias conta uma semana a mais de consumo** (`src/core/simulation.ts:145` com `src/core/forecast.ts:42`).
   - **Causa:** `dispatchFamilies` roda depois de `s.food` receber o saldo da semana, mas antes de `s.week++` (linha 150). Por isso `foodLastsToHarvest` simula de novo a semana `s.week`, que já foi descontada, e `weeksToHarvest(s.week)` ainda conta uma semana a mais de horizonte.
   - **Efeito:** a porta fecha com 'food' em casos em que a pílula e os avisos dizem "até a colheita", porque eles leem o estado depois de `s.week++`. Para o jogador, "nenhuma família vem" sem motivo visível.
   - **Prova (sonda, semente 7, consumo 2,4/sem):** na semana 20, com comida para 5,5 semanas, o meio do passo dá `lasts=false` e a interface dá `lasts=true`. Na última semana do inverno, com meia semana de comida, a porta fecha mesmo com a colheita na semana seguinte.
   - **Correção:** chamar `dispatchFamilies` e `moveFamilies` depois de `s.week++`, ou fazer `familyBlock` olhar a partir de `s.week + 1` dentro do passo.
   - **Teste:** comparar `familyBlock` no meio do passo com o valor depois do passo.
   - **Estimativa:** 30–45 min com o teste. A ordem do passo muda, por isso o teste.

2. **A simulação de balanceamento está quebrada** (`tools/sim/bots.ts:292`).
   - **Causa:** o arquivo usa `WEEKS_PER_YEAR` sem importar. Como `tools/` não está no `include` do `tsconfig.json`, o typecheck não pega.
   - **Efeito:** `npm run sim` cai com `ReferenceError: WEEKS_PER_YEAR is not defined`. Ninguém conseguiu medir o balanço deste pacote, logo agora que o jogador acha o jogo "meio impossível".
   - **Correção:** importar `WEEKS_PER_YEAR` de `../../src/core` e incluir `tools` no `tsconfig.json`, ou criar um `tsconfig` para `tools/sim` e rodá-lo no `build`.
   - **Comentário da linha:** "the spring harvest spread over the year" também precisa ser revisto. O bot avalia o campo como se ele desse comida o ano todo, e agora ele só colhe na primavera. Isso esconde a dificuldade.
   - **Estimativa:** 15 min, mais a rodada do sim-tester.

3. **Risco de balanço, não é bug de código: os campos ocupam vagas o ano todo e só dão comida na primavera.**
   - **Mecânica:** `computeEconomy` (`src/core/economy.ts:330`) sempre soma os 2 empregos do campo, e a eficiência é uma só para tudo (`economy.ts:346`).
   - **No tutorial:** ele pede pescador, coletora e campo no outono. Com uma caravana de 2 famílias, são 2 trabalhadores para 4 empregos, ou seja, eficiência de 0,5. A pesca e a coleta caem pela metade justo quando são a única comida. Mesmo com as duas fontes no máximo, dão no máximo 1,5/sem contra 1,2 de consumo.
   - **Teto de população:** fora da primavera, a porta de comida exige estoque para cerca de 39 semanas. Cada celeiro (150) sustenta só uns 19 moradores sem comida constante. Chegar a 150 moradores exige uns 10 celeiros, ou muita pesca e coleta.
   - O `GAME_DESIGN.md` diz que isso é intencional, mas é um forte candidato ao "meio impossível". Encaminhar ao sim-tester (depois do item 2) e ao game-director.

### Médios

4. **Fábrica de `Building` ainda pendente.**
   - **Problema:** o literal do prédio está repetido em `src/core/actions.ts:60`, `src/core/state.ts:50`, `src/core/state.ts:82` e `src/core/readouts.ts:36`. O pacote acrescentou `built` em todos os quatro.
   - **Correção:** criar `newBuilding(s, kind, x, y, opts)` em `state.ts` ou `grid.ts`.
   - **Estimativa:** 20 min.

5. **Números do mapa ainda fora do `rules.json`.**
   - **Onde estão:**
     - `ROAD_CLEAR = 2` em `src/core/map.ts:12`;
     - `CLUMPS`, com tamanhos e espalhamento, em `map.ts:79-83`;
     - `CLUMP_GAP = 4` em `map.ts:85`;
     - coeficientes `0.3`, `0.6` e `1.5` em `riverRows` e no espalhamento do bosque, em `map.ts:55` e `map.ts:132`.
   - **Correção:** levar para `RULES.map` (`roadClear`, `clumps`, `clumpGap`).
   - **Estimativa:** 20 min.

6. **Cores fora de `palette.ts`.**
   - **Novas neste pacote:**
     - `0x9c7f45` em `src/render/textures.ts:995`, `2212`, `2343` e `2573`;
     - `0xd9a85a` em `textures.ts:2259` e `src/render/residents.ts:722`;
     - `0x3a2818` em `textures.ts:2170`, o mesmo valor da constante `HOLE` em `textures.ts:955`;
     - `0x9fb0b6` em `textures.ts:2349`;
     - sombra `0x000000, 0.25` em `src/render/Toasts.ts:73`.
   - **Correção:** dar nome em `palette.ts` (por exemplo `C.straw`, `C.grainDark`, `C.fishPale`, `C.shadow`) e usar `HOLE` ou `C.hole` na linha 2170.
   - **Já pendentes:** muitos hexadecimais antigos em `textures.ts`, `residents.ts` e `fauna.ts`.
   - **Estimativa:** 30 min.

7. **Nomes das ferramentas fora de `strings.ts`.**
   - **Problema:** `src/render/tools.ts:25` tem 'Mover', 'Rua' e 'Demolir' fixos no código. Os nomes das construções ('Casa', 'Campo'...) e dos níveis de casa vêm de `buildings.json` e `houses.json`. Eles aparecem na tela em:
     - `nova/Panels.ts:312`, `317`, `327`, `330` e `348`;
     - `nova/BuildColumn.ts:70`;
     - `nova/Inspector.ts:118`;
     - `strings.ts:80`.
   - **Correção:** criar `T.kindName` e `T.houseLevel` em `strings.ts` e tirar o `name` dos JSON.
   - **Estimativa:** 30–40 min.

### Leves (DRY, KISS e desempenho)

8. **A previsão roda de 4 a 5 vezes por refresh.**
   - **Onde:** `TopBar.ts:236`, `Panels.ts:322`, `notices.ts` (via `alerts` e `familyBlock`), `GameScene.ts:526` e `Inspector.ts:87`.
   - **Custo:** baixo, porque não roda a cada quadro.
   - **Correção:** calcular uma vez em `refresh()`, junto com `eco`, e repassar o resultado. Isso também evita divergências como a do item 1.

9. **`Haulers.plan` faz uma busca de caminho a cada ida de carregador** (`src/render/Haulers.ts:163-166`).
   - **Custo:** com até 8 campos, são algumas buscas por segundo.
   - **Correção:** guardar a rota de cada campo e só recalcular no `sync`.
   - **Mesma linha:** `doorsOf(s, b)` é chamado duas vezes.

10. **Comentário órfão em `src/core/seasons.ts:6`.** O texto "Index in SEASONS of the season the game starts in" ficou acima de `WEEKS_PER_YEAR`. Ele deve ir para cima de `START_SEASON` (linha 10).

### Regras de comida conferidas e corretas
- A colheita não é contada em dobro: o campo não tem `gather` (`economy.ts:331-333`).
- A previsão usa a mesma conta e o mesmo arredondamento do passo semanal.
- O corte do estoque (`store`) acontece depois da fome, como diz o documento.
- `harvestsIn` e `firstHarvestWeek` batem com "construído no outono colhe na primavera".
- A seca é sorteada no inverno, nunca no Ano 1 e nunca duas vezes seguidas, como no documento.
- O alvo e o progresso do Objetivo 1 são consistentes, porque `checkGoal` roda depois de `s.week++`.

O único defeito de regra encontrado é o descompasso de semana do item 1.

# Revisão de código — Pacote 1 "Ritmo" (working tree, 2026-11-04)

Escopo: diff contra HEAD (02e753d) em `src/core`, `src/data`, `src/render` (strings, nova/*),
`tools/sim`, `scripts/visual/run.mjs`, `tests/` e docs `GAME_DESIGN.md`/`TESTING.md`.

## Verificações

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | OK, sem erros |
| `npm test` | OK — 22 arquivos, 815 testes passaram (17 s) |
| `npm run build` | OK — `dist/` gerado (aviso de chunk de 1,48 MB, já existia) |
| `npm run test:visual` | não rodado (fora do pedido) |

Regras do CLAUDE.md: `src/core` não importa Phaser e não usa `Math.random`; regras novas
(`weeksToUpgrade`, pausa na fome, `fieldBonus`, inverno, reserva da porta, `fromYear`,
`weeksToNextLevel`, `yearJobs`) ficam no core e têm testes; números novos estão em `src/data`;
textos novos estão em `strings.ts`; cores do diff vêm de `NOVA_CSS`. Nada novo roda por quadro:
tudo é chamado em `refresh()` (troca de semana ou ação). Nenhum problema grave.

## Achados (por gravidade)

### Média

1. **Barra e progresso do objetivo ignoram `fromYear`** — `src/core/readouts.ts:33`,
   `src/render/nova/TopBar.ts:223` e `:328`, `src/render/nova/Panels.ts:281`.
   Com 500 moradores antes do Ano 8, o anel e a barra ficam cheios e o texto mostra "500/500", mas
   o objetivo não se cumpre. O texto "a partir do Ano 8" ajuda, mas o anel do nível (que não tem
   texto) fica cheio e parado por anos. **Concordo com o test-reviewer; prioridade média.**
   Proposta: em `goalFraction`, quando `!goalOpen(s, goal)`, limitar a fração (ex.: `Math.min(f, 0.95)`)
   ou mostrar o ano no lugar do progresso; teste em `readouts.test.ts`.

2. **Docs desatualizadas** (regra do CLAUDE.md: doc muda junto).
   - `docs/TESTING.md:38`: diz "objetivos 1 a 3 no Ano 1" e "1 campo com o estoque base alimenta
     a caravana até a primavera"; o teste agora é "objetivos 1 e 2 no Ano 1", "objetivo 1 no
     primeiro outono" e "campo + melhor ponto de comida + estoque passam o inverno" (por semente).
   - `docs/TESTING.md:39`: cita objetivos `harvest` (saiu) e campo congelado "sem comida, prata nem
     vagas" (o campo não dá mais prata).
   - `docs/GAME_DESIGN.md:632`: "32,5 s a 1x" por estação; com `weekSeconds` 3,2 são 41,6 s.
   Proposta: corrigir essas três linhas.

3. **Números diferentes do plano sem registro da decisão** — `src/data/rules.json`
   (`upkeepStartsAfterGoal` 3, plano 2; `familyFoodReserveWeeks` 2, plano 4; `winter.tentFoodFactor`
   1,75, plano 1,5) e `src/data/houses.json` (tenda imposto 1,25, plano 1; casa grande 2,5, plano 3).
   `GAME_DESIGN.md` bate com os dados, mas `docs/design.md` e o `plano.md` não dizem que esses
   valores vieram da calibração. Todos estão na lista de alavancas do 2.4, mas o plano exige
   aprovação do game-director. Proposta: anotar em `docs/design.md` os valores finais e a rodada
   do sim-tester que os justificou.

### Baixa

4. **Reserva da porta medida com o consumo fora do inverno** — `src/core/forecast.ts:78`
   (`floor = reserveWeeks * planned.eaten`). No inverno, 2 semanas de reserva valem ~1,6 semana
   de consumo real (casas) e ~1,1 semana numa cidade só de tendas (×1,75). **Concordo; prioridade
   baixa-média**: é coerente com o texto da doc ("semanas do consumo planejado") e os números já
   foram calibrados assim. Proposta: se o game-director quiser "N semanas de verdade", trocar por
   `reserveWeeks * eatenAt(w)` dentro do laço (uma linha) e medir de novo; senão, deixar um
   comentário dizendo que é de propósito.

5. **`upgradeGain` ignora o inverno** — `src/core/readouts.ts:92`. No inverno o quadro "Ao evoluir"
   da tenda mostra "come +0,4/sem", mas o real é +0,1 (tenda 4×0,35 = 1,4; barro 6×0,25 = 1,5).
   **Concordo; prioridade baixa** (só texto informativo). Proposta: receber `week` e usar
   `foodPerResident(level, week)` nos dois níveis.

6. **Custo escondido no parâmetro padrão `bonus = fieldBonus(s)`** — `src/core/harvest.ts:42`.
   Cada chamada sem `bonus` percorre todas as construções. Chamadas em laço por campo:
   `src/render/Haulers.ts:62`, `src/scenes/GameScene.ts:338`, `src/render/Effects.ts:26`
   (só querem saber se colhe > 0) e `tools/sim/survival.ts:647` (por construção, por semana: O(B²)
   no sim de 100 sementes × 700 semanas). Não é por quadro, então é baixo. Proposta: quem só testa
   "> 0" usa `b.connected && isWorking(b, week)` (ou um helper `fieldWorks`); o sim calcula o bônus
   uma vez por semana e passa adiante.

7. **Código morto / sobra** —
   - `silver` em `BuildingDef` (`src/core/types.ts:105`), `silverProd`/`production` em
     `src/core/economy.ts` e a linha de produção em `src/render/nova/Panels.ts:317`: nenhuma
     construção dá prata. O plano permite manter; por KISS eu removeria no P2 junto com `water`.
   - Tipo de objetivo `water` (`src/core/goals.ts:14`, `:73`): mantido de propósito até o P2. OK.
   - `harvested` (`src/core/types.ts:304`, escrito em `simulation.ts:142`): só o sim e os testes
     leem. Proposta: o sim usar o marco `firstHarvest`, e o campo sair do estado.
   - `shuffle` (`src/core/rng.ts:15`): sem uso em `src`, só no novo `tests/rng.test.ts`. Já
     existia antes do pacote. **Concordo; prioridade baixa**: remover a função e o teste dela.

8. **`fieldBonus` genérico demais** — `src/core/harvest.ts:28`. Soma e limita "por tipo" com
   `Record` e cast `as [BuildingKind, number][]`, mas só a oficina tem bônus. Proposta (KISS):
   contar as oficinas ligadas e fazer `Math.min(n * fieldBonus, fieldBonusMax)`; generalizar só
   quando houver um segundo tipo.

9. **`foodPerResident(level, week)` recebe a semana só para saber a estação** —
   `src/core/economy.ts:36`; por isso `forecast.ts:10-17` cria `SUMMER_WEEK`/`WINTER_WEEK` com um
   laço. Proposta: receber `winter: boolean` (ou a `Season`) e apagar `firstWeekOf`.

10. **Previsões repetidas no refresh** — `src/render/nova/TopBar.ts:223` e `:328` chamam
    `goalFraction` duas vezes, e `:321` chama `goalProgress` de novo; com o objetivo
    `foodUntilSpring` cada uma roda `foodForecast` (fora o de `readCity` e os até 2 de
    `familyBlock`). É por refresh, não por quadro. Proposta: calcular `goalProgress`/`goalTarget`
    uma vez no `refresh` (ou incluir em `CityReadout`) e reaproveitar.

### Trivial

11. `src/render/nova/BuildColumn.ts:193` lê `GOALS[n - 1]?.fromYear` no render. Proposta: o core
    expor o objetivo que libera (ex.: `unlockingGoalDef(kind)`), evitando o índice `n - 1` repetido.
12. `src/core/houses.ts:61` (`weeksToNextLevel`) confere as necessidades do nível atual e do
    próximo; como as necessidades são cumulativas, basta o próximo. Igual ao `updateHouse`, então
    pode ficar por clareza.
13. `tests/helpers.ts:103` (`weeksOfFood`): laço sem limite; com `eat` ≤ 0 trava o Vitest. Proposta:
    limitar a, por exemplo, 10 anos de semanas e falhar.
14. `src/render/nova/Inspector.ts:131`: a oficina mostra "Campos da cidade: +X%" mesmo desligada
    ou sendo a 4ª (que não soma). Sugestão para o ui-designer: dizer "sem rua: não soma" ou "teto
    atingido".

## Sobre os achados do test-reviewer

| Achado | Concordo? | Prioridade |
|---|---|---|
| `goalFraction` ignora `fromYear` | Sim | Média (item 1) |
| `upgradeGain` ignora o inverno | Sim | Baixa (item 5) |
| Reserva da porta com consumo fora do inverno | Sim, mas é defensável | Baixa-média (item 4) |
| `shuffle` sem uso | Sim | Baixa (item 7) |

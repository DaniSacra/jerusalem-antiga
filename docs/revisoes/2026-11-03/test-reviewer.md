# test-reviewer - 2026-11-03

Foco: sobrevivência: o jogador achou o jogo "meio impossível" depois do Pacote 1 de sobrevivência. Descobrir por que se perde, se o Ano 1 é justo, se a curva de dificuldade, comida, colheita, celeiro, seca e chegada de famílias estão equilibradas, e o que mudar para ficar desafiador mas jogável.

## Revisão de testes (somente leitura): regras de sobrevivência em src/core

Nada foi editado, criado nem apagado no repositório, e não houve commit. As sondagens e o relatório de cobertura ficaram só no scratchpad da sessão, em `probe/` e `cov`.

### Resumo
- `npm test` passa: 756 testes em 19 arquivos, cerca de 17 s.
- Cobertura de src/core (v8): 98,6% das instruções, 96,6% dos ramos, 99,1% das funções e 99,4% das linhas. harvest.ts, simulation.ts, economy.ts, seasons.ts e clock.ts estão em 100%.
- Os testes das regras novas cobrem bem fórmulas e casos de borda, mas quase todos fazem uma de duas coisas:
  - tiram o valor esperado do próprio `RULES`/`BUILDINGS`, por exemplo `BUILDINGS.field.harvest!/W`;
  - só fixam números do JSON, por exemplo `toMatchObject({cost: 25, …})`.
- Por isso pegam erro de fórmula, mas **nenhum pegaria um equilíbrio impossível**. Nenhum teste joga uma partida semeada de verdade, e nenhum relaciona os números entre si.
- **Há um defeito de regra** que, sozinho, explica boa parte do "meio impossível", e nenhum teste o pega (próxima seção).

### BUG: a porta das famílias deixa entrar famílias que levam a cidade à fome

`familyBlock` (src/core/families.ts) testa `foodLastsToHarvest(s, computeEconomy(s))` com a cidade **como está agora**. A conta deixa de fora duas coisas:
1. o consumo da família que está sendo enviada;
2. as famílias que já estão a caminho. O terreno delas é nível 0 e come 0, e a viagem leva várias semanas, então a cada `familyIntervalWeeks` (2 semanas) entra mais uma família que não é contada.

**Sondagem reproduzível:** emptyGame, outono, semana 0; 2 tendas com poço; 3 terrenos; comida 33; rng 0.
- Sem famílias novas, a comida duraria 33/1,2 = 27,5 semanas: chega à primavera (semana 26).
- Semana 0: a porta abre e uma família sai.
- Semana 2: a porta abre de novo e sai outra. Logo depois, `lasts` já é false.
- Resultado: 4 tendas e **fome na semana 10**, 16 semanas antes da colheita. Se a fome chega no inverno, cada tenda tem 35% de chance por semana de ir embora.

O jogo mostra "a comida dura até a colheita" e mesmo assim manda famílias para a fome. Isso fere a intenção do GAME_DESIGN ("a previsão diz que a comida dura até o começo da próxima colheita"), embora não a letra.

**Correção sugerida:** a porta prevê com o consumo dos terrenos que têm família a caminho, mais a família nova (nível 1). É decisão do game-director e precisa de teste junto. O código não foi alterado.

### Regras sem teste (cobertura)
- **`forecast.ts`, linha 39:** `lastsToHarvest` não tem nenhum teste, e é o que o TopBar e o Panels usam para dizer se a comida chega à colheita. Falta testar que ela concorda com `foodLastsToHarvest`, inclusive com `out === null`.
- **`families.ts`:**
  - linhas 15-19: `startCell` quando a entrada e o altar não têm rua (retorna null);
  - linha 56: `dispatchFamilies` quando o terreno aberto não tem caminho (`continue`) e o próximo é tentado;
  - linha 79: a família desiste quando a nova rota não existe.
- **`goals.ts`, linha 15:** o ramo `goal.level ?? 0`.
- **`rng.ts`, linhas 16-20:** `shuffle` não tem teste direto.
- **Previsão contra simulação:** em 150 casos sondados (1 a 5 tendas, 1 a 2 pescadores, 0 a 2 campos, eficiência fracionária), `foodForecast` acertou a semana da fome que `stepWeek` produz. **Mas nenhum teste fixa essa equivalência.** A simulação arredonda o delta com `round2` e a previsão não, então as duas podem se desalinhar sem nenhum teste falhar.

### Testes que não pegariam um erro de equilíbrio

1. **Não há teste de ponta a ponta semeado.**
   - simulation.test.ts tem 4 testes curtos, e os bots de tools/sim não rodam no `npm test`.
   - Se o `harvest` virasse 50, a caravana trouxesse comida para 2 a 4 semanas ou o `baseFoodStorage` virasse 10, só quebrariam os testes que fixam o número no JSON. E eles seriam "consertados" trocando o número.

2. **A caravana nunca chega à primavera sozinha.**
   - Nas sementes 1 a 40, a comida inicial dá 10 a 19 semanas, e a primavera está a 26. Sobreviver depende de pescador ou coletora logo no começo.
   - Só a geração do mapa está testada (rio a 8-18 células, bosque com 18 árvores).
   - Na sondagem, a melhor coletora rende 1,4 a 1,5 em todas as sementes, mas nenhum teste garante que "há fonte de comida constante alcançável e pagável com 180 de prata".

3. **Campos tiram trabalhadores o ano todo.**
   - Com 4 tendas e um pescador, o saldo no outono é −0,9/sem.
   - Com mais 2 campos, que só colhem na primavera, a eficiência cai para 0,8 e o saldo vai a −1,2/sem.
   - É uma armadilha para o jogador, e nenhum teste documenta se é intencional.

4. **O teto de crescimento depois da primavera não está fixado.**
   - Até existir um celeiro, a porta fica fechada o ano todo. Na primavera o horizonte pula para 52 semanas, e o estoque é 40.
   - Com 1 celeiro (estoque 190 e 39 semanas até a próxima colheita), o consumo líquido fica limitado a cerca de 4,9/sem, mais a comida constante.
   - A meta de 50 moradores, que consomem cerca de 10/sem, exige 2 a 3 celeiros ou vários pescadores. Nenhum teste liga as metas 5 e 6 a esse teto.

5. **O inverno de fome é quase sempre perda total, e o teste não mostra isso.**
   - O teste só verifica `winterFamineLeaveChance > famineLeaveChance`.
   - Com 35% por semana durante 13 semanas, uma tenda tem 0,65^13 ≈ 0,4% de chance de ficar.

6. **A ordem das metas pode desperdiçar a primeira colheita.**
   - O celeiro só é liberado na meta 3, que exige as metas 1 e 2 cumpridas. Se a meta 2 atrasar, a primeira colheita (12/sem por campo) estraga acima de 40.
   - O teste da meta 3 começa em `goalIndex: 2` e não verifica que as metas 1 e 2 cabem antes da semana 26 com o orçamento inicial.

7. **Seca contra a previsão.**
   - No outono, a previsão supõe uma primavera normal, e a seca só é sorteada no inverno.
   - Não há teste de que uma cidade com campo à beira do rio sobrevive a um ano seco.

### Testes que eu escreveria (quando a revisão permitir)
- **Porta das famílias** (~20 min): o caso da sondagem acima. Deve **falhar hoje** e vira teste de regressão depois da correção.
- **Previsão contra `stepWeek`** (~30 min): equivalência como propriedade sobre combinações semeadas, mais `lastsToHarvest` igual a `foodLastsToHarvest`.
- **Viabilidade semeada** (~1,5 a 2 h): um plano mínimo de referência em `createGame(seed)` para várias sementes, talvez reaproveitando um bot de tools/sim.
  - Plano: poço, pescador ou coletora no melhor lugar, campo no outono e celeiro assim que for liberado.
  - Roda até a primavera do ano 2 e verifica que não há fome antes da semana 26, que as metas 1 a 4 se cumprem e que a prata nunca fica negativa.
- **Invariantes entre números** (~45 min):
  - 180 de prata pagam o kit mínimo: poço 40 + pescador 25 + rua até o rio (18 células × 2) + campo 30 = 131;
  - 1 campo com 1 celeiro alimenta N tendas até a próxima primavera;
  - a perda esperada num inverno de fome.
- **Ramos sem cobertura** (~20 min): families.ts (sem rota, desistência) e `shuffle`.

Total: cerca de 3,5 a 4 h. O teste de viabilidade é o mais caro, porque precisa de um plano que funcione bem em todas as sementes.

### Outro problema
Com a cobertura ligada, 5 testes estouram o timeout de 5 s:
- `survival.test.ts`: caravan e caravan (layout);
- `tutorial.test.ts`: ghost road;
- um de `map.test.ts`.

Todos repetem `createGame` 30 a 60 vezes. Sem cobertura eles passam, mas podem falhar numa máquina lenta. Sugestão: um `testTimeout` maior para esses testes, ou menos sementes.

### Arquivos relevantes
- `src/core/families.ts` (`familyBlock`, `dispatchFamilies`): o bug.
- `src/core/forecast.ts`: `lastsToHarvest` sem teste.
- `tests/families.test.ts`, `tests/survival.test.ts`, `tests/simulation.test.ts`, `tests/goals.test.ts`.
- Sondagens no scratchpad da sessão:
  - `probe/gate.ts`: a porta das famílias;
  - `probe/probe.ts`: previsão contra simulação, e a partida da caravana;
  - `probe/grove.ts`: rendimento da coletora por semente.

# test-reviewer: testes do Pacote 1 "Ritmo" (2026-11-04)

Escopo: só `tests/`. Nada em `src/` foi alterado. Sem commit.

Resultado: `npx vitest run` mostra 22 arquivos e 815 testes passando (antes: 74 falhas em 14 arquivos).
`npx tsc --noEmit` está limpo.

Os números agora vêm de `RULES`, `HOUSE_LEVELS`, `BUILDINGS` e `GOALS`. Ficaram fixos de propósito só
os testes que descrevem o próprio arquivo de dados: a tabela de `goals.json`, a lista de manutenção
de `buildings.json`, os preços da caravana e o celeiro (40/1/3x3/150). Nesses, mudar o JSON deve
quebrar o teste. Também ficaram fixos `safeYears = 2` (seca nunca antes do Ano 3) e
`fromYear = 8` (objetivo 9), porque são regras pedidas no plano. Esses dois testes estão marcados.

## Helpers novos (`tests/helpers.ts`)
- `meetGoal(s, goal, y?)`: cumpre um objetivo `residents` ou `houses` com casas ligadas ao lado da
  rua inicial.
- `weeksOfFood(food, week, eat, floor?)`: oráculo simples. Diz quantas semanas inteiras um estoque
  dura com o consumo de cada semana (inclusive o de inverno), arredondando como o passo semanal.

## O que mudou, por arquivo
- **coverage**: o raio do altar vem de `BUILDINGS.altar.radius` (agora 4).
- **debt**: o imposto das casas de barro vem de `HOUSE_LEVELS`.
- **gather**: o consumo da tenda vem de `foodPerResident` (inclui o inverno).
- **happiness**: com tendas de 4 moradores, uma oficina não empregava todos. Agora são duas, e o
  teste confere `idleShare = 0`.
- **looks**: a casa sobe em `weeksToUpgrade` semanas.
- **economy**: saem os testes de prata do campo e da oficina. Entram:
  - consumo por nível lido dos dados;
  - inverno com `foodFactor` e tenda com `tentFoodFactor`, em `foodPerResident`, no `computeEconomy`
    e no `stepWeek`;
  - "nenhuma construção dá prata";
  - bônus da oficina: 0,1/0,2/0,3, e a 4ª oficina fica em 0,3 e só soma vagas (`yearJobs`);
  - oficina desligada não dá bônus;
  - o bônus não vale para pescador nem coletora;
  - campo congelado com bônus dá 0;
  - desemprego, `idleShare`, alegria, humor e impostos iguais na última semana do outono e na
    primeira do inverno com campos;
  - alerta de desemprego com o campo congelado contando como vaga;
  - início da manutenção ligado a `RULES.upkeepStartsAfterGoal` e `GOALS` (com `meetGoal`).
- **families**: o delta da casa vem de `HOUSE_LEVELS`; o intervalo é genérico
  (`familyIntervalWeeks`). A ordem dos motivos agora usa um celeiro para chegar em `wait`. A "porta
  honesta" foi refeita para os números novos, com as pré-condições conferidas. A cidade vazia tem
  até 40 semanas para receber uma família, porque a chance agora é 0,35. Bloco novo "food reserve at
  the door":
  - a comida mínima com reserva menos a mínima sem reserva dá ≈ `familyFoodReserveWeeks × eaten`
    planejado;
  - a porta fica fechada com a comida que só chega à primavera e até 0,1 abaixo da reserva;
  - a porta abre exatamente na reserva, e uma família sai no passo seguinte.
- **forecast**: os números fixos foram trocados pelo oráculo. Testes novos:
  - `plannedEating` sobe no máximo +1 nível, em todos os níveis, com todos os serviços;
  - uma casa sem as próprias necessidades é planejada no nível para onde cai;
  - `winterEaten` usa ×foodFactor para casas e ×tentFoodFactor para tendas;
  - a previsão atravessa o inverno a partir de semanas diferentes;
  - `reserveWeeks` antecipa o fim, e `reserveWeeks: 0` é igual a não passar a opção;
  - o bônus da oficina entra na previsão: um campo que não bastava passa a bastar.
- **goals**: refeito para os 10 objetivos novos:
  - a tabela agora inclui `fromYear`;
  - não há mais tipo `harvest` nem `water` no JSON;
  - `unlockingGoal` (celeiro 1, mercado 3, oficina 4, jardim 5, templo 9);
  - objetivo 1 com consumo de inverno, prêmio e liberação do celeiro;
  - todo objetivo `houses` e todo `residents` é testado de forma genérica;
  - vitória;
  - "um objetivo por checagem".
  Bloco `fromYear`:
  - `yearOf`;
  - o objetivo 9 fica preso até a 1ª semana do Ano 8, mesmo com 500 moradores, e no `stepWeek` é
    cumprido na virada para o Ano 8;
  - os objetivos sem `fromYear` ficam abertos desde a semana 0.
  O código do `water`, que fica até o P2, é testado com um `GoalDef` montado no próprio teste.
- **houses**: tudo usa `UP = weeksToUpgrade` e `DOWN = weeksToDowngrade`. O `run` repõe a comida
  para que a fome não atrapalhe, exceto nos testes de fome. Testes novos:
  - fome pausa a subida sem zerar;
  - perder uma necessidade do próximo nível zera a contagem;
  - perder uma do próprio nível também zera;
  - a necessidade volta antes de `DOWN` e a contagem de queda recomeça.
  Bloco `weeksToNextLevel`:
  - contagem regressiva semana a semana até 1, depois sobe e vira null;
  - congela na fome;
  - null no topo, em terreno, em outra construção e em casa sem rua;
  - nunca menos que 1.
- **readouts**: o progresso usa o objetivo `houses`. O progresso do objetivo de comida considera o
  inverno. `balanceAfter` diz que oficina e campo só custam manutenção. A eficiência do `foodAfter`
  vem dos dados. Novo: `foodAfter('workshop')` soma `harvest × fieldBonus` no `delta`, mas
  `yields = 0`; fora da rua não soma nada; no teto não soma mais. `upgradeGain` é genérico.
- **simulation**: comida e prata vêm dos dados. "Campo dá prata" virou "campo só custa
  manutenção". O relógio usa `RULES.weekSeconds`.
- **survival**: os preços da caravana usam casa 30 e o celeiro tem manutenção 1. A previsão usa o
  oráculo. A seca usa `SAFE = RULES.drought.safeYears`, e há um teste novo: nunca há seca antes do
  inverno do Ano 3, mesmo com rng 0. Os marcos usam `weeksToUpgrade` e celeiro. Sai o teste do
  objetivo `harvest`. A eficiência da colheita usa 2 campos. "Campos sem trabalhadores no inverno"
  usa `harvest` e `yearJobs` em vez de `production.field`.
- **rng** (arquivo novo `tests/rng.test.ts`): `createRng` determinístico, `between` com as duas
  pontas e `shuffle` (permutação no lugar, a mesma para a mesma seed).
- **readouts**: teste novo de `readCity`. **economy**: teste novo do ramo `silver`, que fica para
  construções futuras. O teste empresta `BUILDINGS.workshop.silver` e o restaura no `finally`.
- **viability**: os objetivos 1 e 2 são cumpridos no Ano 1 nos 20 mapas, e o objetivo 1 ainda no
  primeiro outono. A invariante "um campo e o estoque base alimentam a caravana" passou a considerar
  o inverno e o melhor ponto de pesca/coleta. Sem esse ponto, ela deixa de valer com 4 tendas
  (72,8 > 50).

## Suspeitas e observações sobre `src/` (nenhuma reproduz um bug claro; nenhum `it.fails`)
1. **Dados diferentes do plano.** `src/data/rules.json` tem:
   - `upkeepStartsAfterGoal: 3` (plano 2.2: 2);
   - `familyFoodReserveWeeks: 2` (plano: 4);
   - `winter.tentFoodFactor: 1.75` (plano: 1,5).
   O brief diz 3, 2 e 1,75, então parecem valores já calibrados. Os testes leem `RULES` e não
   dependem disso. Mesmo assim, `GAME_DESIGN.md` e o plano precisam bater com esses valores.
2. **Ritmo do objetivo 2.** Na viabilidade (plano mínimo, 20 mapas), o objetivo 2 ("3 casas de
   barro") é cumprido na semana 13 em 11 de 20 mapas, ou seja, no começo do primeiro inverno. O
   motivo: as 2 a 4 tendas da caravana com um poço viram casa de barro em 13 semanas. O plano espera
   "Ano 1, primavera". Na semente 13, o objetivo 3 sai na semana 52. Isso é assunto do
   sim-tester/game-director (critério J), não um bug.
3. **`goalFraction` ignora `fromYear`.** `src/core/readouts.ts:33`: com 500 moradores antes do Ano 8,
   a barra do objetivo 9 fica cheia (1) e o objetivo não se cumpre. Se a interface mostrar só a
   barra, parece travado. Funciona como especificado ("a lista mostra 'a partir do Ano N'"), mas
   vale o ui-designer conferir.
4. **`foodAfter('workshop')`.** `src/core/readouts.ts:72-81`: o ganho da oficina aparece só no
   `delta`. `yields` é 0, porque `own` soma apenas `gatherFood + fieldHarvest` do fantasma. Se a
   prévia da oficina usar `yields`, vai mostrar "+0". Está testado assim; a decisão é de quem faz a
   interface.
5. **`upgradeGain` ignora o inverno.** `src/core/readouts.ts:92-97`: o ganho de comida mostrado é o
   de fora do inverno. Tenda para barro: +0,4/sem fora do inverno, mas no inverno só +0,1 (6×0,25 −
   4×0,35). Não é bug, só um aviso.
6. **Comentário desatualizado.** `src/core/goals.ts:50` ainda diz "every house at its target level".
   A previsão agora usa o nível planejado (no máximo +1).
7. **Reserva da porta.** `src/core/forecast.ts:79`: o piso da reserva usa `planned.eaten` (consumo
   fora do inverno), mesmo quando a reserva é medida no inverno. Parece intencional ("semanas do
   consumo planejado"), mas no inverno 2 semanas de reserva valem só ~1,6 semana de consumo real.
   Decisão de design.

8. **Código morto.** `shuffle` em `src/core/rng.ts:15` não é usado em `src/` nem em `tools/`.
   Agora está testado; se continuar sem uso, pode sair.

## Cobertura de `src/core`
Comando: `npx vitest run --coverage --coverage.include='src/core/**' --coverage.reporter=text --testTimeout=300000`.
Com a instrumentação, 3 testes pesados (viabilidade e similares) passam do timeout padrão de 30 s.
Por isso o comando usa um timeout maior.

Antes dos 3 testes novos: 98,4% de instruções, 96,3% de ramos, 99,2% de funções, 99,2% de linhas.
Faltava:
- `readouts.ts:24-26` (`readCity`): agora testado;
- `rng.ts:15-20` (`shuffle`): agora testado;
- `economy.ts:83` (ramo `silver`): agora testado.

Ainda descobertos (pequenos):
- `families.ts:15-19,70,93`: início da rota pelo anel quando não há entrada, e caminho não
  encontrado no despacho e na nova rota;
- `harvest.ts:34`: `fieldBonusMax` ausente, sem teto;
- `houses.ts:29,39` e `coverage.ts:21`: ramos defensivos;
- `data.ts:17-18`;
- ramos de `map.ts`, `walkers.ts` e `network.ts`.
Nenhum desses é regra nova do P1.

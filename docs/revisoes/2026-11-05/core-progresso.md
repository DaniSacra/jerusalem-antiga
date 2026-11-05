# Pacote Povo: progresso do core (agente de implementação)

Escopo: plano.md seção 9.1 passos 1–5 + manter o jogo compilando (render, scenes, tools/sim, visual).

## Passos
- [x] 1 Dados (names, rules, houses, buildings, goals, tutorial) e tipos
- [x] 2 people.ts / names.ts; economia, previsão e alegria pelas pessoas
- [x] 3 Caravanas (inicial com noivos, raras), fim da porta, tutorial `wedding`
- [x] 4 Níveis de serviço, manutenção desde a construção, winterFactor, upWeeks, emptyLevel
- [x] 5 Objetivo `milestone`, marcos novos, eventos, TEMPLE_GOAL
- [x] Testes (9.2) e testes antigos corrigidos (26 arquivos, 1179 testes; `invariants.test.ts` novo)
- [x] Render/scenes compilando com textos mínimos
- [x] tools/sim (bots básicos 8.1)
- [x] Cenários visuais do tutorial (tutorial, tutorial-pc, tutorial-blocked, tutorial-skip e families-arrive passam)
- [x] Docs (GAME_DESIGN.md, TESTING.md)

## Decisões de implementação
- Módulos novos: `names.ts` (nomes, clãs), `people.ts` (idade, faixa, comida, household, childrenOf,
  jobsOf, depart, vacate, waitingCouples), `life.ts` (birthBlock, stepPeople), `caravans.ts`
  (modelos, caravana inicial com noivos, rollCaravans, stepCaravans). `families.ts` ficou só com o
  andar (`sendWalking`, `moveFamilies` com `members`, `moveIn`, `freeHouses`).
- `statOf`, `nextLevelOf`, `newBuilding` em `data.ts`. `reach` (marcos) foi para `goals.ts`.
- O casamento acontece na chegada à casa nova (evento, marco, yearStats); andando, o casal continua
  noivo e morando com os pais. Casa demolida no caminho → volta a esperar.
- Família de caravana sem casa não é criada (não entra em `departed`); quem estava a caminho e
  perdeu a casa vai para `departed` com `noHouse`.
- Comida da caravana: semanas × consumo fora do inverno (`people.food` por faixa).
- Tutorial: o extra `market` começa no objetivo que libera o mercado (antes: no `upkeepStart`).
- Interface mínima: toasts de casamento/nascimento/morte/casal/caravana/melhoria; avisos novos
  (caravana, casais, casal indo embora, sem nascimentos); balão com "N/cap pessoas" e botão
  dourado "Melhorar" em celeiro/mercado/oficina (ui-designer refaz depois).
- Sim: bots constroem casas para casais esperando + caravana anunciada + plotsAhead (1 no
  Eficiente/Pescador, 0 no Comum/Distraído); melhoram o celeiro antes de fazer outro; trim nunca
  derruba o último celeiro. Métricas: pessoas por ano, caravanas, celeiros no máximo.
- Primeira medição (10 seeds, 700 sem): ninguém vence; crescimento lento (Comum ~25 moradores no
  Ano 5). Motivo: janela fértil curta em semanas (22 anos = 286 sem) e casas cheias (tenda 3).
  Calibração fica com o sim-tester.
- Tutorial: o toast "X e Y querem se casar" só aparece fora do tutorial, e os avisos `couples` e
  `noBirths` não viram toast enquanto o tutorial roda (cobriam o lugar do passo no celular).
- `tutorial-blocked` virou o passo do casamento sem casa vazia (termina sozinho em 6 semanas);
  `families-arrive` espera o casal da caravana e o marco Primeiro casamento.
- Pendente para outros agentes: os toasts empilhados encostam no balão do tutorial no celular
  (ui-designer); calibração do crescimento (sim-tester); os demais cenários visuais (fora do
  tutorial) não foram rodados.

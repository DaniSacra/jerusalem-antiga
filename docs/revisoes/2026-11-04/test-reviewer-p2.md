# Test-reviewer, Pacote 2 "Água sai e mapa" (2026-11-04)

## Resultado
- `npx vitest run`: 22 arquivos, 1126 passam, 1 pulado (de propósito, ver Bug 1). `npx tsc --noEmit`: nenhum erro em `tests/` nem em `src/` (só ficam os de `tools/sim`).
- Cobertura de `src/core`: 99,2% das instruções, 96,9% dos ramos, 100% das funções e das linhas. Ficam só ramos defensivos (`families.ts` com a entrada cortada e sem caminho, `map.ts` sem lugar para o grupo garantido, `data.ts`, `walkers.ts` com destinos vazios).

## Testes atualizados (ids e regras novos)
actions, coverage, economy, families, forecast, goals, happiness, helpers, houses, looks, menu, network, readouts, survival, tutorial, viability, walkers.
- `well` → `plaza`, `garden` → `park`, `wateredHouseSpots` → `plazaHouseSpots`, `campWellSpot` → `campPlazaSpot`.
- Os números vêm dos dados (manutenção da Praça = `BUILDINGS.plaza.upkeep`). A tabela de manutenção mudou: praça 2, parque 2.
- Menu: a Praça agora fica na categoria "casa".
- Saíram os testes da porta `water` e do objetivo `water` (goals e survival).
- Saíram também o bloco "silver production", as expectativas de `production` e `s.harvested`; no lugar deles entraram o marco `firstHarvest` e "a prata da semana é só impostos − manutenção".

## Testes novos
- **houses:** os níveis pedem rua / +praça / +mercado / +parque; a casa de barro sobe só com a praça (mercado, parque e altar sem praça não bastam); a de pedra pede praça + mercado; a casa grande pede parque (perto do altar fica em pedra, e `weeksToNextLevel` dá null); o raio do templo também não basta, mas um parque longe dos dois basta; uma casa grande que perde o parque cai para pedra; o balão aponta `park` (e não mais `sacred`); a informação da casa lista a necessidade trancada (mercado, parque) e `unlockingGoal` dá 3 e 5.
- **forecast:** o raio do altar faz `targetLevel` parar em 3; com o parque, chega a 4.
- **happiness:** cada fonte sozinha soma praça +5, parque +20 e altar +10 (e nada fora do raio); o templo conta como o altar; a Alegria liga no Objetivo 5, que libera o Parque.
- **families:** uma casa ligada sem praça não fecha a porta e a família vem; uma cidade sem nenhuma praça recebe família; as tendas da caravana sem praça só param pela comida (com celeiro cheio a porta abre); a porta nunca responde `water` (5 sementes × 80 semanas, só motivos conhecidos); a ordem agora é fome, comida, espera, sem terreno.
- **goals:** a Praça está em `startUnlocked` e no `createGame`, e o Parque não; o Objetivo 5 (150 moradores) dá o evento com `unlock: 'park'` e põe o Parque em `unlocked`.
- **coverage:** os números da Praça e do Parque (25/2 e 40/2, 2x2, raio 4, categoria casa); não existe mais `well` nem `garden`; o parque cobre só `park`, com raio 4.
- **walkers:** a aguadeira tem `to: ["plaza","market"]`; ela vai à praça quando só existe a praça e ao mercado quando só existe o mercado; com as duas, a semente 7 manda aos dois.

## Bugs e pendências (não mexi em `src/`)
1. **Necessidade trancada no balão (plano 2.6) ainda não foi feita.** Em `src/core/houses.ts`, `needVisible` continua escondendo a necessidade trancada (`need === 'road' || s.unlocked.includes(need)`). Por isso o `balloonNeed` de uma casa de barro com o mercado trancado devolve `null` ou `'sad'`, e não `'market'`. O comentário "(the altar always exists)" ficou velho. O teste do plano já está escrito em `tests/houses.test.ts` como `it.skip('the balloon shows the first missing need even while it is locked (plan P2 2.6)')`: é só tirar o `.skip` quando `needVisible` mudar. Atenção: com a mudança, a casa com necessidade trancada nunca mostra o balão `'sad'`. Esse caso precisa de um teste próprio, e o texto "Libera no objetivo N" fica com o render.
2. **Tempo dos testes com cobertura.** Dois testes passam de 30 s com `--coverage`: `survival` "500 maps … plaza spot" (~41 s) e `tutorial` "200 maps … foodSpot" (~31 s). O mapa mais denso deixou a geração mais lenta. Sem cobertura, os dois arquivos rodam em 6 s. Só falham se alguém rodar a cobertura com o tempo limite padrão; usei `--testTimeout=300000`.
3. Os arquivos do map-designer (`map.test.ts`, `zz_mapstat.test.ts`) passam e eu não toquei neles. `zz_mapstat.test.ts` tem um erro de tsc (`process.stdout`) que é dele.

## Docs
`docs/TESTING.md`: atualizei as linhas da tabela de testes unitários de coverage, economy, houses, families, happiness, goals, tutorial, forecast, viability, survival e walkers. As linhas dos cenários visuais (tutorial, happiness, input-phone, turn-map, nova-phone, build-with-mouse) ainda falam em poço e jardim; ficam para quem atualizar os cenários.

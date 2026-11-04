# sim-tester - 2026-11-03

Foco: sobrevivência: o jogador achou o jogo "meio impossível" depois do Pacote 1 de sobrevivência. Descobrir por que se perde, se o Ano 1 é justo, se a curva de dificuldade, comida, colheita, celeiro, seca e chegada de famílias estão equilibradas, e o que mudar para ficar desafiador mas jogável.

## Relatório de sim: sobrevivência (commit 95dd36c), somente leitura

**Resposta curta:**
- O jogo está perto do impossível para quem não conhece as regras: na configuração atual, nenhum bot venceu em 20 sementes.
- A principal causa de derrota é a **dívida**, não a fome. A fome é o gatilho: as tendas vão embora, o imposto cai e a manutenção continua.
- Duas coisas pesam mais que tudo:
  - a prata: o custo dos prédios dobrou e o imposto ficou igual;
  - as casas que sobem de nível sozinhas e dobram o consumo de comida.
- A seca quase não pesa.

### Ferramenta
- **Script novo:** `tools/sim/survival.ts`, temporário, com bots feitos para as regras de sobrevivência. Os bots usam `foodForecast`, `familyBlock` e as estações, e cada um faz no máximo 2 ações por semana. Para rodar:
  `npx rolldown tools/sim/survival.ts --file node_modules/.cache/sim/survival.mjs --platform node --format esm && node node_modules/.cache/sim/survival.mjs --seeds 20 [--brief] [--rows] [--trace comum:5:80] [--set rules.x=json]`
- **Correção em `tools/sim/bots.ts`:** faltava importar `WEEKS_PER_YEAR`, e sem isso o `npm run sim` quebrava. Os bots antigos ainda tratam o campo como se desse comida o ano todo, por isso tudo foi medido com os bots novos.
- **Bots:**
  - **eficiente:** planeja com a previsão, a regra do outono e a subida de nível das casas;
  - **comum:** segue o tutorial e só reage aos avisos de família, ao objetivo e à dívida 3 semanas depois;
  - **distraído:** só cuida da comida quando a fome já chegou;
  - **pescador:** igual ao eficiente, mas sem campos além do que o objetivo exige.
- **Regras comuns:** 20 sementes por variação. Quando entra em dívida, o bot demole um prédio com manutenção, mas nunca um poço que atende família.
- **Tempo real:** a 1x, um minuto equivale a 24 semanas, e o Ano 1 termina por volta de 2,2 minutos.

### Atual (20 sementes por bot)
| bot | sobrevive ao Ano 1 | cidade esvaziou | perdeu por dívida | venceu | moradores na semana 52 | semanas de fome no Ano 1 |
|---|---|---|---|---|---|---|
| eficiente | 13/20 | 1 | 15 | 0 | 18 | 7 |
| comum | 13/20 | 6 | 19 | 0 | 18 | 14 |
| distraído | 8/20 | 12 | 17 | 0 | 0 | 17 |

| marco | eficiente | comum | distraído |
|---|---|---|---|
| primeiro campo | semana 0 | semana 3 | semana 14 |
| primeira colheita | semana 27, 1,1 min (8 partidas sem colheita) | semana 27 (2 sem colheita) | semana 27 (13 sem colheita) |
| primeiro celeiro | semana 199 (11 sem celeiro) | **nunca (20/20)** | semana 30 (17 sem celeiro) |
| comida estragada (% do produzido) | 13% | 32% | 35% |
| motivo que mais bloqueia famílias | casa vazia 61%, comida 17% | **água 54%**, fome 21%, comida 17% | **água 78%** |

- **Quando o comum perde:** em metade das sementes, por dívida entre as semanas 33 e 48, ainda no Ano 1. Nas outras, no Ano 2.
- **Seca:** com chance 0 ou chance 1 todo ano, o resultado do comum e do distraído quase não muda, porque eles morrem antes de depender dos campos.
  - Ela só pesa para quem já vai bem. No pacote barato, o eficiente cai de 8 para 3 vitórias com seca todo ano.
  - No pacote M (abaixo), seca todo ano custou pouco: eficiente 18 → 17 vitórias, comum 4 → 5.
- **Pescador e coletora substituem os campos? Quase.**
  - No mesmo pacote, o bot que vive só de pescador e coletora venceu 12/20, e o eficiente com campos venceu 18/20.
  - Por trabalhador os dois rendem igual: o campo dá 156/ano com 2 vagas, e o pescador dá 1,5/sem = 78/ano com 1 vaga.
  - Mas o pescador produz o ano todo, não precisa de celeiro, não sofre seca e não depende do outono. A única vantagem do campo é +1 de prata/sem.
  - O pescador não domina, mas o celeiro e o campo valem pouco a mais.

### Causas da dificuldade (vistas nos traces)

1. **A prata está apertada demais.**
   - O pacote dobrou todos os custos: casa 10→20, poço 20→40, campo 15→30, mercado 40→80, oficina 35→70.
   - O imposto e a manutenção por tick continuaram iguais, e o tick ficou 25% mais longo em tempo real (2,0 s → 2,5 s).
   - O saldo do Ano 1 fica entre +1 e +5/sem. O comum gasta os 180 iniciais até a semana 4 e depois não consegue pagar um poço.

2. **A manutenção começa na semana 2 a 4.**
   - O objetivo 2 ("Água para todas as casas") se cumpre quase na hora com as tendas da caravana, e a manutenção começa junto.
   - O poço custa 3/sem, e cada tenda paga 1.

3. **O poço dobra o consumo.**
   - Três semanas depois do poço, a tenda vira casa de barro e passa de 3 para 6 moradores: de 0,6 para 1,2 de comida/sem. No ano seguinte, o mercado sobe a casa para pedra, com 2,5/sem.
   - O objetivo 1 ("Prepare o primeiro inverno") e a porta das famílias olham o nível atual da casa. Por isso o objetivo 1 se cumpre na semana 1 ou 2, e o inverno chega com fome.
   - E o tutorial manda construir o poço primeiro.

4. **A eficiência pode entrar em espiral.**
   - Toda comida é multiplicada por trabalhadores/vagas.
   - O comum reage à fome construindo mais prédios de comida, e cada um traz vagas. Num trace havia 41 vagas para 32 trabalhadores.
   - A fome derruba moradores, a eficiência cai mais, vem a dívida e a derrota.

5. **Água para todas as casas, contando os terrenos vazios.**
   - É o bloqueio dominante do comum (54%) e do distraído (78%).
   - Com 4 tendas e terrenos espalhados, a cidade precisa de 2 poços: 80 de prata e 6/sem de manutenção.
   - Sem prata para pagar, a cidade fica travada.

6. **Cidade vazia em dívida perde sempre.**
   - Sem moradores não entra imposto.
   - Uma família que volta não dá conta das vagas e cai em fome de novo.
   - Quase nenhuma partida que esvaziou se recuperou. O distraído esvaziou 12 a 18 de 20 em todas as variações.

7. **Estoque de 40, com celeiro só depois da colheita.**
   - Explica os 13 a 35% de comida estragada no Ano 1, mas não é a causa principal.
   - Liberar o celeiro desde o início, com estoque 60, **não mudou nada** (tabela abaixo).

### Efeito medido das mudanças de JSON (20 sementes)
Formato de cada célula: **comum / eficiente**.
- "Ano 1": partidas com moradores na semana 52.
- "dívida" e "vitórias": contagens em 20.

| mudança (antes → depois) | Ano 1 | dívida | vitórias | semana da vitória |
|---|---|---|---|---|
| atual | 13 / 13 | 19 / 15 | 0 / 0 | – |
| `upkeepStartsAfterGoal` 2→4 | 19 / 20 | 17 / 9 | 0 / 6 | – / 161 |
| custos de volta aos antigos (casa 10, campo 15, poço 20, pescador e coletora 15, celeiro 40, mercado 40, oficina 35, jardim 25) | 13 / 20 | 20 / 12 | 0 / 8 | – / 155 |
| comida das `houses`: barro 0,2→0,15, pedra 0,25→0,2, grande 0,3→0,22 | 17 / 20 | 17 / 3 | 0 / 8 | – / 260 |
| `startUnlocked` com celeiro + `baseFoodStorage` 40→60 | 9 / 11 | 20 / 14 | 0 / 2 | – (medido numa versão anterior dos bots; dentro do pacote M também não mudou nada) |
| `startSilver` 180→300 | 13 / 19 | 20 / 10 | 0 / 8 | – |
| `winterFamineLeaveChance` 0,35→0,15 | 9 / 14 | 20 / 13 | 0 / 0 | – |
| imposto ×2 | 18 / 20 | 14 / 2 | 3 / 17 | 107 / 85 |
| **Pacote M**: custos no meio do caminho (casa 15, campo 20, poço 25, pescador e coletora 20, celeiro 40, mercado 60, oficina 50, jardim 35) + upkeep 2→3 + comida das casas acima | 20 / 20 | 18 / 0 | 0 / 19 | – / 89 |
| **M + `workerShare` 0,4→0,5** | **20 / 20** | **13 / 0** | **4 / 18** | 79 / 83 |
| M + workerShare 0,5 + `caravan.foodWeeks` [10,20]→[14,22] + estoque 50 | 20 / 20 | 9 / 0 | 7 / 16 | 105 / 85 |
| M + workerShare 0,5, sem a mudança de comida das casas | 20 / 20 | 19 / 6 | 1 / 12 | 84 / 145 |
| M + workerShare 0,5, com upkeep de volta a 2 | 16 / 20 | 19 / 4 | 1 / 10 | 376 / 123 |

O **distraído continua sem saída** em todas as variações. Mesmo com o pacote M e workerShare 0,5, ele esvazia em 14/20 e perde por dívida em 14/20. Isso não se resolve só com JSON (ver o item 4 das propostas).

### Propostas para o game-director aprovar (`src/data` não foi alterado)

1. **Prioridade 1: aplicar o pacote M com workerShare 0,5.** Com ele o Ano 1 fica justo: comum 20/20 e eficiente 20/20.
   - `buildings.json`: casa 20→15, campo 30→20, poço 40→25, pescador e coletora 25→20, celeiro 60→40, mercado 80→60, oficina 70→50, jardim 50→35.
   - `rules.json`: `upkeepStartsAfterGoal` 2→3 (a manutenção começa na primeira colheita) e `workerShare` 0,4→0,5.
   - `houses.json`: comida da casa de barro 0,2→0,15, de pedra 0,25→0,2, grande 0,3→0,22.

2. **Opcional:** `caravan.foodWeeks` [10,20]→[14,22] e `baseFoodStorage` 40→50. Reduz a dívida do comum de 13 para 9 de 20.

3. **Não vale a pena** (efeito medido nulo):
   - liberar o celeiro desde o início;
   - só aumentar o estoque para 60;
   - mexer na chance de seca.

4. **Fora do JSON, para decidir:**
   - (a) o objetivo 1 e a porta das famílias calculam com o nível que a casa vai ter depois de subir;
   - (b) a regra de água deixa de contar terrenos vazios, ou o poço passa a ter raio 5 (não medido);
   - (c) os prédios de comida recebem trabalhadores primeiro, para cortar a espiral;
   - (d) uma saída para a cidade vazia em dívida, que hoje é derrota certa.

### Problema novo que aparece depois do conserto
- **Com o pacote M, a partida fica curta demais.**
  - O eficiente vence por volta da semana 83 (3,5 min).
  - O comum, quando vence, vence entre as semanas 79 e 105 (3,3 a 4,4 min).
  - O alvo é 15 a 25 minutos para o comum.
  - Subir o Templo de 800 para 1200 só acrescentou cerca de 9 semanas.
- **O comum ainda perde por dívida em 13/20**, no Ano 2, na espiral de vagas acima de trabalhadores (causa 4).
- **Próximo pacote:** ajustar os alvos e as recompensas dos objetivos 5 a 10, e a regra de vagas.

### Arquivos
- `tools/sim/survival.ts` (novo, temporário).
- `tools/sim/bots.ts` (só o import de `WEEKS_PER_YEAR` corrigido).
- Saídas de cada variação: pasta `v/` no scratchpad da sessão.

Nada em `src/` foi alterado e não houve commit.

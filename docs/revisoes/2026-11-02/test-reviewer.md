# test-reviewer - 2026-11-02
Foco: tudo o que já está pronto: Interface nova, pacote visual Cidade bonita (partes 1–6), Campo é trabalho e Felicidade (com Jardim)

## Relatório do test-reviewer: testes de src/core (revisão só de leitura)

**Estado:** `npm test` passa: 13 arquivos, 115 testes, em cerca de 0,25 s. Todos os testes que olhei são determinísticos (`createRng(1)` em `emptyGame` e `constRng` nos sorteios).

**Cobertura:** não deu para rodar a cobertura automática. Falta o pacote `@vitest/coverage-v8` no projeto e, como esta revisão é só de leitura, não instalei nada. No lugar dela, comparei cada função exportada de `src/core` com os testes e rodei sondas montadas com rolldown na scratchpad: `/tmp/claude-1000/-home-dani-projects-jerusalem-antiga/07eca283-40fb-481c-a305-b854ecaa59b1/scratchpad/probe.ts` e `probe2.ts`. Nenhum arquivo do projeto foi alterado. Recomendo adicionar `@vitest/coverage-v8` como devDependency, com ordem do usuário.

### 1. Regras novas no working tree

**`src/core/happiness.ts`** (`tests/happiness.test.ts`, 13 testes): a base está bem coberta.
- **`houseHappiness`:**
  - Testado: base, os 4 serviços somados na ordem certa, jardim só quando conectado, fome, desemprego com teto (`idleMax`), humor triste.
- **`moodOf`:** os dois limites e os vizinhos de cada um estão testados (65 e 64, 35 e 34). Bom.
- **`taxFactor` e `familyFactor`:**
  - Testado: valor 1 na faixa contente, os dois extremos e o ponto médio do lado feliz.
  - A conta do teste "cidade feliz atrai famílias mais rápido" foi conferida: fator 1,114, rng 0,38 > 0,35. Então o teste realmente distingue o fator.

**`economy.ts`:**
- Testado: imposto vezes o fator, `happiness` média (50 sem famílias), `moods` (terreno vazio fora da conta), `idleShare` (0, 1 e 0,5).
- Os testes antigos foram ajustados com cuidado: casas movidas para y=27 e oficinas para dar emprego. Cada mudança tem comentário dizendo por que a casa fica contente.

**`families.ts`:** o lado feliz está coberto. O teste de 35% agora deixa a cidade contente de propósito.

**`houses.ts`:**
- Testado: `houseInfo` com `happiness` e imposto real, `null` no terreno vazio.
- Testado: balão `sad` só depois da exigência que falta, inclusive quando o mercado ainda não foi liberado e no nível 4.

**Jardim:**
- Testado: liberação pela meta 4 (`goals.test.ts`) e a linha `garden: 1` da tabela de manutenção.
- Testado: `garden` em `emptyGame().unlocked`.

**Campo é trabalho** (`economy.test.ts`, 5 testes, mais 1 em `simulation.test.ts`): completo. Cobre 2 vagas e 1 prata, eficiência 100% e 0%, campo desligado (paga manutenção, não produz) e soma com a oficina na mesma eficiência.

### 2. Comportamento para o game-director decidir (não é bug com certeza)

**A fome afeta o imposto com um mês de atraso.** Em `stepMonth`, `computeEconomy(s)` roda antes de `s.famine` ser atualizado. Por isso o imposto daquele mês usa a fome do mês anterior. Confirmei com uma sonda: casa em y=27 mais oficina, comida 0,5.

| Mês | Fome | Imposto |
|---|---|---|
| 0 → 1 | começa | ainda 1 |
| 1 → 2 | continua | 0,97 |

O mesmo atraso acontece quando a fome acaba. Já o `dispatchFamilies` usa a fome do mês atual. A especificação diz "calculada todo mês" e não fala da ordem. Se o atraso for aceito, vale um teste que o fixe. Se não for, é uma mudança de produção, que não é minha.

**Custo por quadro, para o code-reviewer:**
- `balloonNeed` chama `computeEconomy`, que agora calcula `houseHappiness` de todas as casas. Chamado uma vez por prédio, fica O(n²) por atualização de balões.
- `houseInfo` faz outro `computeEconomy` completo dentro de `idleShare(s)`.
- Não muda os testes.

### 3. Testes que faltam (em ordem de prioridade)

1. **Cidade triste atrai menos famílias** (`happiness.test.ts`). O título do teste diz "a sad one slower", mas a cidade "plain" é contente (média 53), então o lado triste nunca é testado.
   - Proposta: 3 tendas longe do altar e sem emprego dão média 30, fator 0,93, chance de cerca de 0,325.
   - Com `constRng(0.33)` não pode chegar família; numa cidade contente, com o mesmo rng, chega.
2. **Famílias garantidas ignoram o fator.** Uma cidade triste (sem fome) com menos de 3 famílias deve receber a família mesmo com `constRng(0.99)`.
3. **Arredondamento da parte de desemprego** (`Math.round(idleShare × 40)`):
   - `0.01` não gera parte `idle` nenhuma (arredonda para 0);
   - `0.0125` gera −1;
   - `1/3` gera −13;
   - `0.5` já chega no teto de −20.
   Hoje só são testados 0,25 (dá conta exata) e 1.
4. **Limite inferior exato.** Com fome e todos sem emprego, o valor é exatamente 0: `toBe(0)`, humor `sad`, `taxFactor(0)` igual a 0,8. Hoje o teste só verifica `>= 0`, o que é fraco.
   - O limite de 100 nunca é atingido: o máximo possível é 90. Um teste com `RULES` modificado ou com um comentário deixaria isso explícito.
5. **Ponto médio do lado triste** dos fatores: `taxFactor(H.sad / 2)` é aproximadamente `(H.taxMin + 1) / 2`, e o mesmo para `familyFactor`. Também `taxFactor(H.sad - 1) < 1`. Hoje só os extremos 0 e 100 estão testados.
6. **Raio do jardim** (`coverage.test.ts`): jardim conectado em (25,40) cobre x=29 e não cobre x=30; cobre y=44 e não cobre y=45 (confirmado na sonda). Hoje só se testa "perto" e "longe".
7. **`serviceOf` e `SERVICE_SOURCES`:**
   - `serviceOf('garden')` dá `'garden'`, `serviceOf('temple')` dá `'sacred'`, `serviceOf('house')` dá `null`.
   - Nenhum teste usa essas funções, e o render depende delas para mostrar o raio.
8. **Manutenção do jardim cobrada de verdade.** Pôr um jardim em `computeEconomy` e ver `upkeep.garden === 1`, com 0 vagas e sem balão `workers`. Hoje só a tabela de `BUILDINGS` é conferida.
9. **Casa desligada com família** conta felicidade, humor e imposto (sonda: 30, `sad`, imposto 0,97), mas o balão mostra `road`. Vale fixar que `road` vem antes de `sad`.
10. **Terreno vazio nunca mostra `sad`**, nem com fome: `balloonNeed` devolve `null` no nível 0 conectado.
11. **Nenhum nível de casa exige `garden`.** Agora `NeedKind` inclui `garden`, então um teste de dados em `houses.json` evitaria que alguém ponha o jardim como exigência sem querer.
12. Se o atraso da seção 2 for aceito: um teste do imposto no mês em que a fome começa e no mês em que acaba.

### 4. Lacunas mais antigas (da lista fixa do agente)

- **Fome no limite exato:** só se testa comida 0,5 com saldo negativo. Faltam comida terminando exatamente em 0 com `foodDelta < 0` (fome) e comida 0 com `foodDelta === 0` (sem fome).
- **Casa perdendo poço:** só se testa casa perdendo a rua. Falta demolir o poço de uma casa de barro e ver ela cair depois de 3 meses.
- **Templo 6x6 na borda do mapa:** o caso (40,5) mistura rio e borda. Falta um caso só de borda, por exemplo `x = cols - 5` no lado oeste ou `y = rows - 5`, além de conferir `templeSpots` perto das bordas.
- **Funções exportadas sem teste direto** (só cobertas por tabela): `costOf`, `placeSize`, `isFreeLand`, `canRotate`, `goalProgress`, `variantCount`, `shuffle`, `walkerDef`, `startRoad`, `entranceCell`, `riverWidth`, `touchesNetwork`. São baixa prioridade, mas `goalProgress` aparece na interface e merece um teste próprio.

### Arquivos relevantes
- `/home/dani/projects/jerusalem-antiga/src/core/happiness.ts`
- `/home/dani/projects/jerusalem-antiga/src/core/economy.ts`
- `/home/dani/projects/jerusalem-antiga/src/core/families.ts`
- `/home/dani/projects/jerusalem-antiga/src/core/houses.ts`
- `/home/dani/projects/jerusalem-antiga/src/core/simulation.ts` (ordem que causa o atraso da fome no imposto)
- `/home/dani/projects/jerusalem-antiga/tests/happiness.test.ts`
- `/home/dani/projects/jerusalem-antiga/tests/coverage.test.ts`
- `/home/dani/projects/jerusalem-antiga/tests/families.test.ts`
- `/home/dani/projects/jerusalem-antiga/tests/economy.test.ts`
- `/home/dani/projects/jerusalem-antiga/tests/simulation.test.ts`

Nenhum arquivo do projeto foi criado, editado ou apagado, e não houve commit.

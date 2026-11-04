# copywriter - 2026-11-03

Foco: sobrevivência: o jogador achou o jogo "meio impossível" depois do Pacote 1 de sobrevivência. Descobrir por que se perde, se o Ano 1 é justo, se a curva de dificuldade, comida, colheita, celeiro, seca e chegada de famílias estão equilibradas, e o que mudar para ficar desafiador mas jogável.

## Revisão de textos: sobreviver ao Ano 1 (somente leitura)

Nenhum arquivo foi alterado. `npm run test:visual` não foi rodado, porque ele regrava `screenshots/`. A pasta `screenshots/` tinha só 3 capturas antigas, então esta revisão parte do código e das regras, não de capturas novas.

Textos lidos: `src/render/strings.ts`, `src/data/goals.json` e `src/data/tutorial.json`. Eles foram comparados com as regras em `docs/GAME_DESIGN.md`, `src/core/families.ts`, `forecast.ts`, `economy.ts`, `alerts.ts` e com os números de `src/data/*.json`.

### Conclusão
Os textos ensinam bem o calendário: a abertura, o toast do outono, o passo 4 do tutorial ("colhe na primavera") e a pílula "Colhe na primavera do ano N". Faltam três coisas que o jogo cobra e a tela não explica:

1. **Trabalhadores e eficiência.** Cada vaga puxa trabalhadores de todas as construções. Um campo no outono ocupa 2 dos poucos trabalhadores e só produz na primavera, e nesse tempo o pescador rende menos.
   - Exemplo: 2 famílias da caravana dão 6 moradores e 2 trabalhadores. Com pescador e campo, a eficiência cai para 67%, e o pescador rende 1,0 comida/sem em vez de 1,5, menos que o consumo de 1,2.
   - O texto atual do campo diz "Dá trabalho", o que parece só uma vantagem.
   - É o maior candidato a causa do "meio impossível".
2. **O limite de 40 e o celeiro.** A previsão corta a comida no limite do estoque, e sem celeiro 40 de comida não chega até a primavera seguinte. Depois da colheita, a porta das famílias fecha com "Pesque ou colete", mas a solução real é o celeiro. Antes do Objetivo 3 o celeiro nem está liberado, e a abertura já fala dele.
3. **Seca e frio sem ação clara.** "As chuvas estão fracas este ano" não diz o efeito nem o que fazer. "Tendas sofrem com o frio" promete uma regra que não existe: o que existe é fome no inverno, com 35% de chance de abandonar a tenda.

### Mudanças propostas (em ordem de impacto)

**1. Campo e trabalhadores** (`nova.effect.field` e um aviso novo)
- Texto atual do campo: "Semeia no outono e colhe na primavera. Dá trabalho. Arraste para fazer vários."
- Proposta: "Plante no outono: colhe na primavera. Usa 2 trabalhadores o ano todo."
- Aviso novo: "Poucos trabalhadores: tudo produz 67%. Atraia famílias ou tire vagas" (cerca de 66 caracteres). Ele precisa de um tipo de alerta novo no core, então é decisão do game-director.
- Motivo: a eficiência é global e não aparece em lugar nenhum antes de o jogador perder comida, e "Dá trabalho" esconde o custo.
- Nos itens de trabalho: "trabalhadores" para quem trabalha, "vagas" para os postos.

**2. Por que as famílias não vêm, motivo `food`** (`familyBlock.food`)
- Texto atual: "Nenhuma família vem: a comida não dura até a colheita. Pesque ou colete"
- Proposta: "Nenhuma família vem: a comida não dura até a primavera. Construa pescador ou coletora"
- Motivo novo `storage`, para quando o limite do estoque corta a previsão: "Nenhuma família vem: o estoque só guarda 40. Construa um celeiro". Precisa de mudança no core.
- Motivo: "colheita" é vago para quem começa no outono, e "Pesque" pede uma ação que o jogador não faz (ele constrói um Pescador). Depois da primavera a causa real costuma ser o limite, e o texto atual aponta a solução errada.

**3. Toast do inverno** (`seasonStart.winter`)
- Texto atual: "Chegou o inverno: frio e chuva"
- Proposta: "Inverno: só pescador e coletora dão comida" (42 caracteres)
- Motivo: é a estação que mata, e o texto atual não diz nada útil. Os outros toasts de estação podem ficar; o do outono já ensina a plantar.

**4. Objetivo 1** (`goals.json`)
- Texto atual: "Prepare o primeiro inverno"
- Proposta: "Tenha comida até a primavera"
- Motivo: diz o que conta para cumprir (a previsão chegar à primavera), e o progresso em semanas passa a fazer sentido. A tabela de Objetivos do GAME_DESIGN precisa acompanhar.

**5. Aviso do fim do outono** (alerta `winterComing`)
- Texto atual: "O inverno está chegando. Tendas sofrem com o frio."
- Proposta: "O inverno está chegando: com fome, tendas são abandonadas. Guarde comida" (cerca de 71 caracteres)
- Motivo: não existe regra de frio. A regra é a fome no inverno (`winterFamineLeaveChance` 0,35), então o texto atual promete algo que o jogo não faz.

**6. Quando plantar** (`tutorial.step.field` e o efeito do campo)
- Passo do tutorial, atual: "Construa um campo agora: ele colhe na primavera"
- Proposta: "Construa um campo agora, no outono: ele colhe na primavera"
- Linha extra no balão do campo, só fora do outono: "Plantado agora, só colhe na primavera do ano N"
- Motivo: quem constrói um campo no inverno espera colher na primavera seguinte e não colhe. Hoje só a pílula sobre a prévia avisa.
- Usar "plantar" em todo lugar, no lugar de "semear".

**7. Tela inicial, linha 2** (`howTo[1]`)
- Texto atual: "Dê água às casas com poços e guarde a colheita num celeiro."
- Proposta: "Dê água às casas com poços. Sem celeiro, só cabem 40 de comida."
- Motivo: o celeiro começa bloqueado, e o jogador procura por ele sem achar. O limite de 40 só aparece na pílula a partir de 75% do estoque, e é a regra que derruba o Ano 2.

**8. Seca** (alerta `drought`)
- Texto atual: "As chuvas estão fracas este ano"
- Proposta: "Ano seco: campos longe do rio colhem menos. Construa pescador ou coletora" (cerca de 73 caracteres)
- Motivo: diz o efeito e uma ação possível.
- Não se propõe "plante junto ao rio": a seca é anunciada na semana 1 do inverno, depois do plantio, então essa ação já não serve para o ano. Isso é uma falha de regra para o game-director: o jogador não tem como reagir com campos e só aprende para o ano seguinte.

**9. Motivo `water`** (`familyBlock.water`)
- Texto atual: "Nenhuma família vem: há casa sem água. Construa um poço perto"
- Proposta: "Nenhuma família vem: casa ou terreno longe do poço. Construa outro poço" (cerca de 71 caracteres)
- Motivo: a regra conta também os terrenos vazios. O jogador constrói um terreno longe do poço, não acha nenhuma "casa sem água" e a cidade trava.

**10. Fome e o verbo "colher"** (`famine` e `nova.effect.gatherer`)
- Toast da fome, atual: "Falta comida: pesque, colete ou plante campos"
- Proposta: "Falta comida: construa pescador ou coletora" (43 caracteres)
- Coletora, atual: "Colhe frutos das árvores: dá comida o ano todo."
- Proposta: "Junta frutos das árvores: dá comida o ano todo."
- Motivo: na fome, um campo não salva ninguém a tempo. "Colher" e "colheita" ficam só para o campo, para não confundir com "até a colheita".

### Consistência (fora do top 10)
- A semana aparece em três formas: "por semana", "/sem" e "sem". Sugestão: "/sem" em todos os textos curtos e "por semana" só nos balões.
- O mesmo vale para "Rende N comida/sem" e "Colhendo: N comida/sem": ficar com uma forma só.
- `upkeepStart` aparece igual como passo do tutorial e como toast. Está certo, mas são duas cópias do mesmo texto: reaproveitar uma constante (DRY).

### Pontos para o game-director (regras, não texto)
- O campo ocupa trabalhadores durante 26 semanas sem dar comida, e o passo 4 do tutorial ensina essa armadilha.
- O celeiro só é liberado no Objetivo 3, mas o limite de 40 já fecha a porta das famílias logo depois da colheita.
- A seca é anunciada depois do plantio.

### Docs a atualizar se as mudanças entrarem
Em `docs/GAME_DESIGN.md`:
- seção Famílias (lista de motivos);
- seção Colheita (frase da seca);
- seção Previsão de comida e lista de Avisos ("O inverno está chegando…");
- tabela de Objetivos (Objetivo 1);
- seção da tela inicial (3 passos);
- passo 4 do tutorial;
- lista de toasts.

### Estimativa
- Itens 3 a 7, 9 e 10 (só texto e docs): cerca de 30 a 45 min, mais uns 10 min para testes e para olhar as capturas.
- Itens 1, 2 e 8 (aviso de eficiência e motivo `storage` exigem tipos novos no core e testes no Vitest): 1,5 a 2 h, com a aprovação do game-director.

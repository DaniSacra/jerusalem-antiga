# ui-designer - 2026-11-03

Foco: sobrevivência: o jogador achou o jogo "meio impossível" depois do Pacote 1 de sobrevivência. Descobrir por que se perde, se o Ano 1 é justo, se a curva de dificuldade, comida, colheita, celeiro, seca e chegada de famílias estão equilibradas, e o que mudar para ficar desafiador mas jogável.

## Revisão da interface Nova: sobrevivência (commit 95dd36c)

Revisão só de leitura: nada no projeto foi editado.

**Como foi testado:**
- Playwright num servidor Vite próprio (porta 5288, já desligado), mapa `?seed=5`.
- Três telas: 844x390, 915x412 e 1366x768.
- Uma vila pequena montada pelo `window.core`, com estados forçados: outono, verão com pouca comida, primavera seca, estoque perto do limite e fome.
- As capturas ficaram só no scratchpad.

**Working tree:** já havia `tools/sim/bots.ts` modificado e `tools/sim/survival.ts` e `docs/revisoes/2026-11-03/` novos. Devem ser de outros agentes.

### Resposta curta ao foco
- **Quanto de comida há e até quando dura:** razoável. A pílula mostra estoque, saldo por semana e previsão. Mas a produção prometida não bate com a real (item 1), e a previsão fica errada ou assusta à toa em dois estados (item 4).
- **Quando vem a colheita e quais campos colhem:** não está claro. Nada no topo diz em quantas semanas vem a colheita. O campo diz "ano 2" sem avisar que pula a próxima primavera.
- **Limite de estoque e celeiro:** o "38/40" aparece. Mas o aviso manda construir um celeiro que só é liberado no objetivo 3.
- **Seca:** o ícone é ilegível e a palavra "seca" não aparece. O aviso não diz o efeito.
- **Por que as famílias não chegam:** o aviso existe, mas aponta para algo invisível: terrenos vazios sem água bloqueiam as famílias e não mostram balão.

### Melhorias, em ordem de impacto

**1. A comida prometida não é a que o jogador recebe.** É a causa mais provável do "meio impossível".
- **Problema:**
  - O rótulo sobre o pescador ou a coletora diz "Rende 1,5 comida/sem". Ele usa `gatherFood(s, ghost)` sem a eficiência dos trabalhadores.
  - Com 2 tendas (2 trabalhadores) e 6 vagas, a eficiência é 33%, e as estatísticas mostram o pescador com +0,5/sem.
  - Construir um campo (2 vagas) diminui o que o pescador já dava, e nada avisa. O balão da coluna mostra "Saldo depois" só para prata.
- **Correção:**
  - Linha "Comida depois: ±X/sem", em vermelho quando negativa, no balão da coluna e no rótulo sobre a prévia. Ela vem de um `foodAfter` em `src/core/readouts.ts`, calculado como `balanceAfter` (precisa de testes).
  - No inspetor do pescador, da coletora e do campo, quando a eficiência for menor que 100%: "Faltam trabalhadores: rende 33%".
- **Arquivos:** `src/render/nova/NovaUi.ts` (`tagFor`), `src/render/nova/BuildColumn.ts` (`showToolBalloon`), `src/render/nova/Inspector.ts`, `src/core/readouts.ts`, `src/render/strings.ts`.
- **Tempo:** cerca de 1h30 (função no core com testes, mais duas linhas na interface).

**2. Terreno sem água bloqueia as famílias sem nenhum sinal no mapa.**
- **Problema:**
  - `familyBlock` conta "toda casa ligada (terrenos também)" sem poço, mas `balloonNeed` (`src/core/houses.ts:55`) devolve null para o nível 0.
  - Confirmado: o terreno em (25,27) sem água dá bloqueio `water` e balão `null`.
  - O aviso "há casa sem água" fica fixo, e o jogador procura uma casa que não existe.
- **Correção:**
  - Balão de poço também nos terrenos ligados sem água. É a mesma regra do bloqueio, então a mudança é no core, com teste.
  - Inspetor do terreno: "Sem água: nenhuma família vem".
  - Aviso: "há casa ou terreno sem água".
  - Ideal: tocar no aviso leva a câmera à primeira casa culpada.
- **Arquivos:** `src/core/houses.ts` com teste em `tests/`, `src/render/nova/Inspector.ts`, `src/render/strings.ts` (`familyBlock.water`, `inspect.plotWaiting`).
- **Tempo:** cerca de 1h.

**3. Falta a contagem para a colheita no topo.**
- **Problema:** o jogo gira em torno da primavera, mas a pílula da estação mostra só "Outono · Ano 1 · Sem 1".
- **Correção:**
  - Acrescentar "Colheita em 26 sem". No celular, um ícone de trigo e "26 sem" no lugar de "Ano 1", que cabe.
  - Na primavera, "Colhendo · 9 sem".
  - Usar `weeksToHarvest`, que já existe.
- **Arquivos:** `src/render/nova/TopBar.ts` (`refresh`, pílula `season`), `src/render/strings.ts` (`nova.calendar`).
- **Tempo:** cerca de 1h, contando o ajuste de largura em 844.

**4. A pílula de comida do celular se engana em dois estados.**
- **Problema:**
  - Na fome, ela mostra "0 −0,5 ⚠ 0 sem". Deveria mostrar "FOME" em vermelho piscando.
  - Na primavera, colhendo, mostra "30/40 +3,6 ⚠ 42 sem" em vermelho enquanto a comida sobe. A causa real é o limite de 40, que corta a colheita, e isso não aparece.
- **Correção:**
  - Durante a colheita, com o estoque a 75% do limite, mostrar "cheio" em laranja.
  - Na seção Comida das estatísticas, as linhas "Colheita em N sem · 2 de 3 campos colhem" e "Limite 40 (+150 por celeiro)".
- **Arquivos:** `src/render/nova/TopBar.ts`, `src/render/nova/Panels.ts` (bloco de comida, perto da linha 320), `src/render/strings.ts` (`foodShortPhone`, `stats`).
- **Tempo:** cerca de 1h.

**5. Campo construído tarde: o "ano 2" engana.**
- **Problema:**
  - Em "Inverno · Ano 1", o balão diz "Colhe na primavera do ano 2". Como o ano começa no outono, o campo pula a primavera que vem e espera 43 semanas.
  - O jogador lê "ano 2" e espera colher logo.
  - No mapa, o campo aparece arado e vazio, sem explicação.
- **Correção:**
  - Laranja: "Colhe em 43 semanas: tarde para esta primavera".
  - Verde: "Colhe nesta primavera, em 17 sem".
  - O mesmo texto no inspetor do campo.
- **Arquivos:** `src/render/strings.ts` (`harvestYear`), `src/render/nova/BuildColumn.ts:160`, `src/render/nova/NovaUi.ts:244`, `src/render/nova/Inspector.ts:145`.
- **Tempo:** cerca de 40 min.

**6. A seca quase não se vê e não se explica.**
- **Problema:**
  - O ícone da seca na pílula é um sol pequeno com um texto vermelho minúsculo embaixo, ilegível em 844.
  - A palavra "Seca" não aparece, o que fere a regra de nunca usar só cor ou ícone.
  - O aviso "As chuvas estão fracas este ano" não diz o efeito.
- **Correção:**
  - Pílula: "· Seca" em laranja.
  - Aviso: "Ano seco: campos longe do rio colhem 40%. Plante junto ao rio".
  - Prévia do campo durante a seca: "Junto ao rio ✓" ou "Longe do rio: colhe menos".
- **Arquivos:** `src/render/nova/TopBar.ts` (`seasonIcon`/`refresh`), `src/render/strings.ts` (`alert` drought), `src/render/nova/NovaUi.ts` (`tagFor`), ícone `drought` em `src/render/uiArt.ts`.
- **Tempo:** cerca de 1h.

**7. O aviso de comida estragando manda construir algo bloqueado.**
- **Problema:** "Comida estragando: construa um celeiro" aparece antes do objetivo 3, que é o que libera o celeiro.
- **Correção:**
  - Com o celeiro bloqueado: "Estoque cheio (40): o excesso estraga. O celeiro libera no objetivo 3".
  - Para isso, o `Alert` `spoiling` ganha um campo `locked`.
- **Arquivos:** `src/core/alerts.ts` com teste, `src/render/strings.ts` (`alert`).
- **Tempo:** cerca de 30 min.

**8. O objetivo 1 não se entende.**
- **Problema:** "Prepare o primeiro inverno 12/26" não diz que compara semanas de comida com semanas até a primavera. O painel de objetivos tem o mesmo problema.
- **Correção (texto com o copywriter):**
  - Texto: "Comida até a primavera".
  - Progresso com unidade: "12/26 sem".
- **Para o game-director:** com `weeksToFirstSpring` igual a 0, o alvo vira 0/0, e o objetivo parece se cumprir sozinho na primavera mesmo com fome. Vale conferir.
- **Arquivos:** `src/data/goals.json`, `src/render/strings.ts` (`nova.progress`), `src/render/nova/TopBar.ts` (`layout`).
- **Tempo:** cerca de 20 min.

**9. "Água e comida" cortado na coluna do PC** (problema conhecido, confirmado).
- **Problema:** aparece como "gua e comid": o texto usa `S.small` (13 px) num botão de 86 px.
- **Correção:** em `BuildColumn.item`, reduzir a fonte até caber em `d − 2·colPad`, ou quebrar em duas linhas. Vale para todo rótulo futuro.
- **Arquivo:** `src/render/nova/BuildColumn.ts` (`item`, linha do `name`).
- **Tempo:** cerca de 15 min.

**10. Os toasts cobrem os painéis e o centro do mapa.**
- **Problema:**
  - No celular, com Estatísticas aberto, os toasts cobrem as linhas Estoque e Previsão, justamente a resposta para "até quando dura".
  - No início, três toasts se empilham no meio do mapa: caravana, "nenhuma família vem" e seca.
- **Correção:**
  - Com um painel aberto, segurar os toasts ou levá-los para baixo do painel.
  - Nas primeiras semanas e no tutorial, não mostrar o toast de bloqueio de família. O botão Avisos, com contador, já cobre isso.
- **Arquivos:** `src/render/Toasts.ts`, `src/render/nova/NovaUi.ts`, `src/render/nova/notices.ts`.
- **Tempo:** cerca de 40 min.

### Legibilidade e controles
- **Tamanhos de toque:** 844x390 e 915x412 respeitam 44 px: coluna 46, botões laterais 44, nível 56.
- **Celular:** a pílula de comida, os balões de água e de "sem rua" e os textos dos painéis são legíveis.
- **PC:** a barra está limpa. O único corte é o do item 9.
- **Gestos:** arrastar, pinça e dois dedos não foram testados de novo, porque a suíte `npm run test:visual` já cobre.
- **Detalhe:** `fmt(0.25)` aparece como "0,3 comida por trecho de rio", o que superestima.

### Estimativa total
- Cerca de 7 a 8h para os 10 itens.
- Os itens 1, 2, 4 e 7 mexem no core e precisam de testes: cerca de 3h30 com o item 3. Os outros são só texto e interface.
- Para atacar o "impossível" primeiro, os itens 1, 2, 3 e 5 (cerca de 4h) já devem mudar a sensação.

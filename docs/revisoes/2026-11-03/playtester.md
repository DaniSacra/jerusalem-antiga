# playtester - 2026-11-03

Foco: sobrevivência: o jogador achou o jogo "meio impossível" depois do Pacote 1 de sobrevivência. Descobrir por que se perde, se o Ano 1 é justo, se a curva de dificuldade, comida, colheita, celeiro, seca e chegada de famílias estão equilibradas, e o que mudar para ficar desafiador mas jogável.

**Relatório de playtest: Jerusalém Antiga depois do commit de sobrevivência (95dd36c). Só leitura: nada foi editado nem commitado.**

## Como foi testado
- **Navegador:** tutorial jogado no celular (844x390) com a seed 1, e o PC (1366x768) conferido com a seed 3.
- **Simulação:** jogadores scriptados por 520 semanas em 8 seeds, mais análises de 200 mapas.

**O que se manteve correto:**
- comida e prata nunca quebraram nenhuma regra;
- os moradores sempre bateram com as casas;
- a eficiência ficou sempre entre 0 e 1;
- o altar nunca saiu do mapa;
- nenhum erro no console;
- `npx vitest run` passa (756 testes).

## Por que o jogador perde (do mais grave ao menos grave)

1. **Crítico: o tutorial trava as ferramentas enquanto a cidade passa fome.**
   - Na seed 1, o passo da casa chegou no começo do inverno, com a comida em 0 e a fome já começando. 3 das 4 famílias foram embora.
   - Só a ferramenta Casa funcionava. Havia 144 de prata sobrando, mas o jogador não podia construir pescador nem coletora.
   - O relógio continua correndo em todos os passos.
   - **Arquivos:** `src/core/tutorial.ts`, `src/render/Tutorial.ts`.
   - **Esperado:** pausar ou desacelerar o tempo durante o tutorial, ou liberar todas as ferramentas quando a comida não for durar.

2. **Crítico: o poço dobra o consumo de comida, e nada avisa.**
   - Com um poço, as tendas viram casas de barro em 3 semanas: 6 moradores em vez de 3, o dobro de comida.
   - "A caravana chegou com comida para 16 semanas" na prática dura de 7 a 11 semanas depois do poço (seeds 1, 3, 6 e 7).
   - O balão da casa, "Ao evoluir: +3 moradores · +1 imposto", não fala da comida.
   - **Arquivos:** `houses.json`, `strings.ts`.

3. **Alto: o objetivo 1, "Prepare o primeiro inverno", pode ser cumprido na semana 1, e depois a cidade passa fome no inverno.**
   - Ele confere a previsão uma vez só, antes de as casas evoluírem.
   - O progresso (16/26, 6/22, 0/9…) desce conforme o alvo encolhe, e a unidade (semanas) nunca aparece.
   - **Arquivo:** `goals.ts`.

4. **Alto: a manutenção começa na semana 2.**
   - O objetivo 2 se cumpre quase na hora, porque terrenos vazios contam. A partir daí, o saldo de prata fica perto de 0.
   - A seed 6 perdeu na semana 52 com a cidade estável: prata parada em −5 e saldo 0 durante 24 semanas.
   - Em dívida não dá para construir nada (o celeiro custa 60), e demolir é a única saída.
   - **Arquivo:** `rules.json` (`upkeepStartsAfterGoal`).

5. **Alto: o limite de estoque de 40 joga fora a primeira colheita.**
   - O celeiro só é liberado depois do objetivo 3, que é a própria colheita.
   - Nas partidas scriptadas, a comida ficou estragando de 9 a 450 semanas, e depois veio a fome no segundo inverno.

6. **Alto: a rua do tutorial leva a lugares fracos de comida.**
   - A partir do fim da rua marcada pelo tutorial, o melhor pescador ou coletora dá menos de 1 comida/sem em 125 de 200 mapas, e menos de 0,5 (muitas vezes 0) em 39.
   - Na seed 1, nem uma coletora de 0,8 (com 1 trabalhador) evitou a fome.
   - **Arquivo:** `ghostRoad` em `tutorial.ts`.

7. **Médio-alto: um poço nunca dá água a todas as tendas nos mapas de 4 famílias.**
   - Isso acontece em 62 de 200 mapas.
   - Nos mapas de 3 famílias (58 de 200), um poço só cobre todas com uma rua extra, e o tutorial não fala disso.
   - As famílias ficam bloqueadas com "há casa sem água".
   - **Arquivo:** `caravanSpots` em `state.ts`.

8. **Médio: um campo construído no outono tira 2 dos poucos trabalhadores do pescador até a primavera.** Com 2 famílias, o pescador cai para 67%.

9. **Médio: a cidade pode travar para sempre.**
   - Com 0 moradores, prata abaixo de 40 e um terreno sem água, nenhuma família vem e não dá para construir nada. Não há derrota, e a lista de avisos fica vazia.
   - **Para reproduzir:** remover as tendas, gastar a prata em terrenos até sobrar 20 e rodar 60 semanas.

Meu jogador scriptado que segue o tutorial perdeu 10 de 16 partidas, a maioria em 1 a 2 anos, e perdeu mais com 4 famílias do que com 2.

## Bugs de interface e controles

10. **Alto: todo botão dispara ao soltar o dedo, mesmo quando o arrasto não começou nele** (`ui.ts` linha 48, `widgets.ts` linha 138).
    - **Celular:** a rua marcada pelo tutorial termina embaixo de "Pular tutorial". Terminar o arrasto da rua pula o tutorial inteiro (confirmado na seed 1).
    - **PC:** arrastar o mapa e soltar em cima do botão de pausa pausa o jogo.

11. **Médio: a lista de Avisos nunca alerta sobre comida no outono ou no inverno.**
    - "Não chega à colheita" só aparece no verão.
    - A fome também não aparece na lista. Aparece só "Nenhuma família vem: falta comida".

12. **Baixo:**
    - O balão do pescador diz "0,3 por trecho de rio", mas o valor real é 0,25.
    - No PC, o botão da categoria mostra "gua e comid" (texto cortado).
    - No celular, a faixa de categorias só tem ícones, e campo, pescador e coletora se confundem.
    - Os toasts cobrem o painel de Objetivos e a dica da Rua: o toast da caravana fica em cima da dica.
    - A pílula de comida mostra "⚠ 0 sem".

## Sugestões de texto
- Ao lado da previsão: "A comida acaba no inverno: construa pescador/coletora".
- No balão da casa: "+3 moradores · come o dobro".
- Objetivo 1: "Comida até a primavera: 9 de 26 semanas".
- No balão do celeiro ou do campo: "Sem celeiro, só cabem 40: o resto estraga".

## Outras observações
- Faltava o import de `WEEKS_PER_YEAR` em `tools/sim/bots.ts`, e por isso `npm run sim` quebrava.
  - O arquivo aparece modificado no working tree, mas a mudança não é minha; deve ser do sim-tester, que rodava em paralelo.
  - Os bots atuais não conhecem pescador, coletora nem celeiro.
- O Chromium headless rodou a cerca de 5 fps, então o tempo foi avançado com `stepWeek`. A barra do topo às vezes ficava alguns quadros atrasada.

Os scripts e as capturas estão no scratchpad da sessão (pastas `sim/` e `pw/`), só para análise.

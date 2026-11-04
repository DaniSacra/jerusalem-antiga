# Playtester: Pacote 1 "Um Ano 1 justo" (commit d390712)

Testei d390712 e mais as mudanças de outro agente ainda fora do commit (`strings.ts` familyNoWell, `GameScene.attachUi`). `npm test` deu 785/785, `tsc` passou e `test:visual` passou em todos os cenários. Fiz partidas reais no Playwright, com toque no 844x390 e mouse no 1366x768, nas seeds 3, 5, 7, 11 e 12, e um bot do tutorial no core.

**Aceite: o bot do tutorial perde 0 de 16 partidas no Ano 1, sem fome e sem família embora (em 200 seeds também foram 0).** O bot segue foodSpot e ghostRoad, põe o campo perto do altar, o poço em campWellSpot e a casa na seta. Depois do tutorial, com bot comum: 0/16 (19/200 com fome, 15/200 perderam família, sempre na primavera, avisadas por foodShort). Com bot eficiente: 0/200. Com bot distraído: 8/16 com fome.

## Bugs (do mais grave ao menos grave)
1. **A casa que o tutorial indica fica sem água, e a cidade trava.** Siga a seta da casa nas seeds 3 e 7 (celular e PC). Esperado: casa dentro do poço da caravana. Aconteceu: a tenda nova fica sem poço e o motivo `water` bloqueia as famílias o Ano 1 inteiro (198/200 seeds no bot). O objetivo 2 fica parado em 2/4 nos mapas com 2 famílias. Arquivo provável: `GameScene.checkTutorial`, porque o houseHint só olha a distância até o altar e ignora a cobertura do poço.
2. **No tutorial, a câmera puxa de volta.** Basta abrir o tutorial e esperar 5 s nas seeds 3, 7 e 12. Depois disso, mover a câmera com dois dedos ou com o botão direito volta sempre ao mesmo ponto, porque `game.pan` nunca zera. No celular, com Rua ativa, dois dedos são o único jeito de mover a câmera. Esperado: a câmera para quando o jogador a move. Arquivo provável: `GameScene.updateTutorial` e `glide`. O pan só zera com `gesture.moved`, e o glide nunca chega ao alvo quando os limites da câmera prendem o centro.
3. **No celular, tocar na seta do pescador ou da coletora constrói 2 células acima.** Escolha a ferramenta e toque na ponta da seta (seeds 7, 12 e 16). O toque eleva a mira em 90 px (TOUCH_LIFT), e o resultado é "Tem uma rocha aqui" ou um prédio sem rua que custa 20 de prata. Esperado: construir no lugar marcado. Arquivo provável: `GameScene.tutorialTarget`/`aimAt`. A correção pode apontar a seta 90 px abaixo ou não elevar a mira num toque sem arrasto.
4. **O passo "upkeep" nunca mostra o texto de manutenção.** Com as famílias bloqueadas (caso do bug 1, seed 7, semana 5), o balão mostra "Nenhuma família vem…" com o botão "Entendi", e o toque em "Entendi" consome o passo. Ao mesmo tempo sai um toast com a mesma frase. No celular, a 3ª linha do balão encosta na borda de cima e o toast cobre essa borda. A seta aponta para a pílula do Objetivo, não para a prata. Arquivo provável: `GameScene.checkTutorial`, porque `stuck` vale para todo passo sem ferramenta.
5. **A abertura mostra três números diferentes para a mesma comida.** Seed 7: o toast diz "comida para 17 semanas", a pílula diz "16 sem" e o objetivo diz "16/26". Na seed 5 são 16 e 15. Arquivo provável: `state.foundCaravan` (floor) contra `foodForecast` (semanas antes da fome).
6. **Toasts ainda se sobrepõem a outras coisas.** O toast cobre o botão Demolir do inspetor (celular, seed 5), porque o inspetor não segura a fila como um painel. Toasts que ficaram na fila aparecem velhos: "casa sem água" e "falta comida" saem juntos depois de o motivo já ter mudado. A seta do tutorial cobre o texto da prévia ("Comida dep|s"). Arquivos: `Toasts.ts`, `NovaUi.ts`.

## Funcionou
- As ferramentas nunca travam. O relógio fica parado nos passos de construir (semana 0 até a casa) e anda no passo da família.
- O motivo aparece no balão sem toast, e a gota sobre a tenda mostra qual casa não tem água.
- Soltar o arrasto sobre "Pular tutorial" ou sobre a pausa não aperta nada (testei com toque real).
- A prévia mostra "Comida depois", e o inspetor mostra "Faltam trabalhadores: rende 23%".
- As pílulas mostram "inverno em N", "primavera em N", "· Seca", "FOME" e "cheio", e cabem na tela.
- O painel de Avisos fica acima das ferramentas, e os toasts esperam o painel fechar.
- A cidade vazia recebe família em 6 semanas, e um terreno sem água não bloqueia.
- Não houve erro no console.

## Ainda confunde
- O campo rende 12 por semana já no outono. Com isso os objetivos 1, 2 e 3 se cumprem nas semanas 1 a 3, dentro do tutorial, com 3 toasts de uma vez. A "Primeira colheita" aparece no outono, e o toast "Estoque cheio: o excesso estraga" sai na semana 2, sem ação possível.
- No PC, "Comida 16 · até o inverno" é ambíguo: dura até o inverno ou acaba nele? Sugestão: "acaba no inverno".
- O toast do ano 2 diz "hora de plantar os campos", mas o campo já dá comida o ano todo.
- Os passos do campo e do poço não movem a câmera e não marcam lugar no mapa. As tendas ficam fora da tela no passo "poço perto das tendas".
- A pílula diz "cheio" com 40/50.

## Invariantes
Rodei 100 partidas de 400 semanas (4 bots × 25 seeds), demolindo ruas ao acaso e tentando remover o altar e o templo. Resultado: ok, sem falha. Comida nunca negativa nem acima do estoque, moradores e trabalhadores batem, vagas e eficiência coerentes, construção sem rua não produz, objetivos em ordem, altar e templo nunca removidos, grid e famílias consistentes. A prata fica negativa só como dívida, que é regra do jogo.

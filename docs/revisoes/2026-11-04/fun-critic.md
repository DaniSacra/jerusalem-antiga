# fun-critic · Pacote 1 "Ritmo" (working tree sobre 02e753d)

Base: `npm run sim -- --seeds 40 --weeks 700` (os 4 bots), `--trace comum:1:200` e o bot Comum/Distraído jogando no navegador (celular 844x390 e PC 1366x768, seeds 1–3, Anos 1–10). Ainda não há relatório do sim-tester deste pacote; os números abaixo são dessa rodada e devem ser confirmados por ele.

## Notas (metas ≥ 7)
- **Vontade de jogar de novo: 6.** A abertura varia (caravana de 2 a 4 famílias, rio), e a onda "3 casas de barro sobem juntas" dá vontade de repetir melhor. Mas o fim da partida é esperar o Ano 8, e não fica claro o que "melhor" significaria na próxima vez.
- **Curva de dificuldade: 5.** O Ano 1 é fácil demais (Comum com fome no Ano 1: 0/40). No Ano 2 vem um degrau: ao cumprir o objetivo 3, a renda cai de +14,75 para −4 por semana, e 21/40 Comuns entram em dívida. Do Ano 3 em diante a curva fica plana, com estoque "cheio" (1100/1100, 2000/2000). E 6/40 Comuns perdem por dívida tarde (mediana na semana 215), quando a meta era ≤ 2%.
- **Gosto de olhar a minha cidade: 7.** A cidade passa de tendas para barro e depois para pedra branca, com toldos, lampiões à noite, gente na rua, chuva e o templo no fim. Entre o Ano 3 e o Ano 9, porém, a cidade só cresce de tamanho, sem mudar de cara. O inverno fica verde e chuvoso (não parece frio), e no fim do jogo há muitos balões de ícone em cima das casas.

## Esperas: contemplativas ou chatas?
- **Ano 1: contemplativas.** O jogador age a cada 6 a 10 semanas (20 a 30 s a 1x). Nesse tempo, o balão "Casa de barro em N sem", as famílias andando e a pílula da estação seguram o olhar.
- **Chatas (mais de 30 s sem decisão):**
  1. Da semana 16 à 70 (cerca de 2,9 min), o jogador espera os "60 moradores" com o Mercado travado. O balão mostra "✗ Mercado" sem que haja como resolver.
  2. Do objetivo 6 (semana 97) ao 7 (semana 260) passam cerca de 8,7 min. O 7 e o 8 caem na mesma semana. Depois vêm cerca de 14 min até o objetivo 9 ("a partir do Ano 8"), que fica travado na tela por anos.
  3. No meio do jogo a prata fica entre 2 e 30, com renda de +2/sem e 240 moradores (o trace mostra dezenas de semanas assim). Uma casa (30) leva cerca de 40 s para pagar e um mercado (60) cerca de 85 s, enquanto a comida apodrece no estoque cheio.
- Os objetivos chegam em blocos (mediana do Comum): 1 e 2 no primeiro minuto, 4, 5 e 6 juntos em 1,4 min, 7 e 8 juntos. Os blocos vêm da subida sincronizada de 13 semanas. Esse momento é ótimo ("o bairro inteiro subiu"), mas esvazia o resto da linha do tempo.

## Primeiro inverno e Ano 1
- **O primeiro inverno não pesa para quem joga normal.** Com 4 famílias, o estoque fica entre 60 e 75, e a comida sobe +1,6/sem no inverno graças ao pescador e à coletora. A pílula mostra "até a primavera" o inverno todo. Para o Distraído pesa (40/40 passam fome).
- **O Ano 1 é bom.** Fecha com 8 casas (mediana; alvo 6–10), a contagem regressiva das casas funciona e as decisões de comida são reais. Falta o susto do inverno, e o objetivo 1 se cumpre na semana 1, sem esforço.

## 3 melhorias de maior impacto (em ordem)
1. **Recompensa a cada ~3 min no meio do jogo.**
   - Problema: lacunas de 8 a 14 min sem objetivo.
   - Proposta: 1) o Mercado passa a ser liberado no objetivo 2 (em vez do 3); 2) o objetivo 8 vira "Chegue a 350 moradores" (`fromYear` 6); 3) cada primavera ganha o marco "N.º inverno vencido", com moradores e casas (é um marco que já existe, repetido por ano).
   - Efeito: sempre há um próximo passo visível, e o fim de cada inverno vira festa.
2. **Meio de jogo com fome de comida, não de prata.**
   - Problema: estoque cheio e prata zerada.
   - Proposta: campo `harvest` 468 → 390 e casa grande `tax` 2,5 → 3.
   - Efeito: a comida volta a ser a decisão (celeiro × campo × rio), e a prata deixa de travar cada obra.
3. **Um susto no primeiro inverno e nenhum degrau escondido na manutenção.**
   - Problema: o inverno 1 é trivial, e a manutenção cai de uma vez logo após uma vitória.
   - Proposta: `winter.foodFactor` 1,25 → 1,4 e `upkeepStartsAfterGoal` 3 → 2, como estava no plano (menos prédios, então um degrau menor). O objetivo 2 passa a avisar "depois dele, manutenção ~X/sem".
   - Efeito: a pílula fica laranja no inverno 1, e o jogador sente que se salvou.

## Ajustes para o sim-tester medir (src/data, antes → depois)
| Ajuste | Medir |
|---|---|
| `goals.json` Mercado `unlock` objetivo 3 → objetivo 2 | intervalo entre os objetivos 2 e 3, critério J, casas na semana 52 (B) |
| `goals.json` objetivo 8: "6 casas grandes" → `residents` 350, `fromYear` 6 | **nova métrica: maior intervalo sem objetivo (mediana ≤ 4 min)**; G |
| `buildings.json` campo `harvest` 468 → 390 | C, estrago, semanas com estoque cheio, H |
| `houses.json` casa grande `tax` 2,5 → 3 | F, dívida do Comum no Ano 2 (hoje 52%), derrotas (hoje 15%) |
| `rules.json` `winter.foodFactor` 1,25 → 1,4 | % de Comuns com a pílula "acaba no inverno" no inverno 1 (alvo 50–70%), fome no Ano 1 ≤ 20%, I |
| `rules.json` `upkeepStartsAfterGoal` 3 → 2 | dívida nos Anos 1 e 2, derrotas antes da semana 300 |

## Pacote futuro que mais faz falta
O **P3 Madeira e pedra**. Ele dá destino aos desempregados (aparece o aviso "76 pessoas sem trabalho") e põe espera com decisão no meio do jogo, onde hoje há tempo morto. Em segundo lugar vem o P4 (lenha e neve), para o inverno ter cara e peso.

## Ideia ousada (OPCIONAL)
A cada primavera, um cartão "Ano N" com moradores, invernos sem fome e casas de pedra, comparados com o melhor ano do jogador em partidas anteriores (recorde local). Isso cria o "da próxima vez faço melhor" sem mecânica nova. Arranha o pilar "uma mecânica por vez" só na interface.

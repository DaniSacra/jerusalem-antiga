# fun-critic - 2026-11-03

Foco: sobrevivência: o jogador achou o jogo "meio impossível" depois do Pacote 1 de sobrevivência. Descobrir por que se perde, se o Ano 1 é justo, se a curva de dificuldade, comida, colheita, celeiro, seca e chegada de famílias estão equilibradas, e o que mudar para ficar desafiador mas jogável.

**Fun-critic: Jerusalém Antiga depois do commit 95dd36c (sobrevivência)**

**Sobre os números.** Não há relatório do sim-tester para este pacote. O ritmo descrito aqui vem das minhas partidas, e o sim-tester precisa confirmar.

**Como joguei:**
- 12 seeds com 4 perfis de robôs simples, num script meu no scratchpad, mais uma olhada no Playwright (844 x 390).
- Planejador.
- Apressado.
- Distraído.
- Esperto: abre com pescador, coletora e campo junto ao rio.

**Resultados:**
- O esperto perdeu 5 de 12 partidas e ficou preso para sempre no Objetivo 4 em outras 2.
- Apressado e distraído perderam 23 de 24, quase todas entre as semanas 43 e 160 (2 a 7 min em 1x).

**Notas**
1. **Diversão de momento: 5.**
   - O pescador no rio e a coletora no bosque, com "Rende N", são boas escolhas de lugar.
   - Mas o poço, a escolha central, vira armadilha: com água a tenda vira casa de barro, que tem 6 moradores em vez de 3, e a fome dobra.
2. **Sempre tem algo para fazer: 3.**
   - No outono, o tutorial roda com o relógio andando: 6 das 13 semanas passam no passo do poço.
   - Depois vêm 32 s de inverno só vendo a comida cair e longas esperas para juntar os 60 de prata do celeiro.
3. **Curva de dificuldade: 2.**
   - O Ano 1 é a parte mais difícil do jogo.
   - A caravana de 4 famílias é pior que a de 2: cumpre o Objetivo 2 na semana 1, e a manutenção começa sem renda.
   - A fome derruba casas, que derrubam trabalhadores, eficiência, comida e por fim prata. Não há recuperação.
4. **Recompensas: 4.**
   - Os Objetivos 1 e 2 se cumprem sozinhos, sem sensação de conquista.
   - A colheita é o melhor momento, mas logo vira "Comida estragando". O celeiro só é liberado nesse instante, e o jogador não tem a prata.
5. **Clareza do objetivo: 5.**
   - A pílula "-1,2 ⚠ 12 sem" é ótima.
   - Mas a derrota diz "24 semanas em dívida" quando a causa foi a fome, e nada avisa que subir de nível faz comer mais.
6. **Cidade viva: 7.** Estações, carregadores e caravana são bonitos. A casa que cai por fome é triste do jeito certo.
7. **Vontade de jogar de novo: 4.** Existe o "da próxima vez planto antes", mas perder em 2 a 4 min por dívida, depois de passar fome, parece azar e não erro meu.

**Curva da partida**
- **Início** (outono, 32 s): coisas demais, com pressa. O tutorial pede o poço primeiro, e isso piora a comida.
- **Meio do Ano 1:** o inverno é tempo morto, e a primeira fome cai perto da semana 16 a 20. A primavera traz a colheita, mas ela estraga e o jogador trava no celeiro.
- **Ano 2:** quem cresce com o Mercado (a casa de pedra come o dobro) cai em fome no outono ou no inverno, entra em dívida e perde.
- **A diversão cai na primavera do Ano 1.**

**3 melhorias, em ordem**
1. **Crescer pede comida.**
   - **Problema:** posicionar bem (poço, mercado) mata de fome.
   - **Proposta:**
     - a casa só sobe de nível se a previsão usada na porta das famílias, já com o consumo maior, continuar chegando à colheita;
     - balão: "subiria: falta comida";
     - no tutorial, o pescador ou a coletora vem antes do poço.
   - **Efeito:** o pilar 6 volta a ser recompensa, e a fome fica previsível. É uma regra nova, mas reaproveita uma que já existe.
2. **A colheita é prêmio, não castigo.**
   - **Proposta:**
     - liberar o Celeiro no Objetivo 1;
     - trocar a ordem dos Objetivos 3 e 4: "Construa o celeiro antes da primavera".
   - **Efeito:** a primavera vira o melhor momento do jogo, e o inverno ganha uma meta para juntar prata.
3. **Perder pela causa certa e poder se recuperar.**
   - **Proposta:**
     - a manutenção só começa depois do Objetivo 4;
     - a tela de derrota diz a causa: "A fome levou N famílias e os impostos caíram".
   - **Efeito:** acaba a armadilha da caravana de 4, e quem perde sabe o que mudar.

**Ajustes de equilíbrio para o sim-tester medir (src/data)**
- **rules.json:** `upkeepStartsAfterGoal` de 2 para 4; `baseFoodStorage` de 40 para 60; `debtWeeksToLose` de 24 para 39.
- **goals.json:** Celeiro liberado no Objetivo 1, em vez do 3.
- **buildings.json:** `granary.cost` de 60 para 45; `well.upkeep` de 3 para 2.
- **houses.json** (só se a melhoria 1 não for aprovada): `food` da casa de barro de 0,2 para 0,15, e da casa de pedra de 0,25 para 0,2.

**Alvos:**
- o perfil comum sobrevive ao Ano 1 em 90% ou mais das seeds, com mediana de 4 semanas de fome ou menos;
- nenhuma seed fica presa mais de 52 semanas num objetivo;
- o distraído chega ao Ano 2;
- as seeds com caravana de 4 não ficam piores que as de 2.

**Ideia ousada (opcional): "Placar do inverno"**
- No fim de cada inverno, um cartão com as famílias perdidas e a comida que sobrou, e uma nota de 0 a 3 estrelas, guardada por ano.
- É só interface sobre os marcos que já existem, sem mecânica nova.
- Dá o "quero um inverno de 3 estrelas" que faz jogar de novo.

**Arquivos**
- Script das minhas partidas: `funcritic/fc.ts`, no scratchpad da sessão.
- Regras citadas: `src/core/simulation.ts` (`updateHouse`) e `src/core/families.ts` (`familyBlock`).

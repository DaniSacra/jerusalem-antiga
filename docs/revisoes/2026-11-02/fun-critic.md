# fun-critic - 2026-11-02
Foco: tudo o que já está pronto: Interface nova, pacote visual Cidade bonita (partes 1–6), Campo é trabalho e Felicidade (com Jardim)

Notas (fun-critic, 2026-11-02, olhando como jogador de 12 a 17 anos)
1. Diversão de momento: 7. Casa que sobe com poço e mercado continua gostosa. O Jardim cria uma escolha de lugar, mas o ganho dele não aparece: casa de pedra com jardim rende cerca de +0,3 prata por mês.
2. Sempre algo a fazer: 6. O começo é cheio. Na meta 4 o Comum fica cerca de 0,5 min juntando prata para as oficinas, e no fim há de 14 a 20 meses com mais de 120 de prata parada antes do templo.
3. Curva: 5. As metas 5, 7 e 8 se cumprem sozinhas (0,02 a 0,04 min cada). O Eficiente nunca entra em dívida. A felicidade não acrescenta desafio nenhum.
4. Recompensas: 7. Andaime, casa mudando de nível e toast de meta funcionam bem. Só que as recompensas vêm todas juntas no meio, e a tela de vitória não mostra nada para superar.
5. Clareza: 6. A placa nova, a faixa da meta e o aviso único estão claros. Mas a carinha já aparece triste no mês 1, por causa do desemprego, e o jogador ainda não tem Oficina nem Jardim para resolver.
6. Cidade viva: 9. Dia e noite, varais, animais, agricultores no campo e ruas que se gastam: dá prazer só de olhar.
7. Vontade de jogar de novo: 5. A partida é curta, não tem placar nem recorde, e a derrota não diz o que deu errado.

Curva da partida. Uso o último relatório do sim-tester (Eficiente mês 56, Comum 94), que é anterior a "Campo é trabalho" e à Felicidade. Uma rodada rápida minha com tools/sim, para o sim-tester confirmar, deu Eficiente mês 52 e Comum 67.
- Início (metas 1 a 3): ótimo, mas a carinha fica entre 41 e 47 no Eficiente; no Distraído, metade das casas está triste já no mês 10.
- Meio: a diversão cai em dois pontos. Primeiro, a espera pelas oficinas. Depois, a cascata das metas 5 a 8, que não pede decisão nenhuma.
- Fim: juntar 800 de prata para o templo, sem ter onde gastar.
- Felicidade, medida em 30 seeds por bot com um robô que constrói jardins (os bots atuais não constroem): casas felizes sobem de 12% para 45% (Eficiente) e de 8% para 32% (Comum). Mesmo assim, o mês da vitória piora: Eficiente 51 → 53, Comum 65 → 69. A média da cidade fica abaixo de 65, então o bônus de famílias quase nunca liga. Hoje a felicidade é um enfeite.

As 3 melhorias de maior impacto
1. Felicidade que se sente.
   - Problema: a carinha aparece antes de o jogador ter como mexer nela (fere o pilar 5), e o efeito dela é invisível.
   - Proposta: carinha e efeitos só a partir da Meta 4, junto do Jardim. O desemprego só pesa depois de a Oficina ser liberada, a mesma condição do aviso. No render, casa feliz ganha mais vida na frente (crianças, flores, usando o Ambient que já existe) e casa triste fica apagada.
   - Efeito: a sensação de "pus o jardim e o bairro sorriu" (pilares 2 e 3).
2. Meio que pede planejamento.
   - Problema: as metas 5 e 7 vêm de graça.
   - Proposta: trocar a meta 7 por "Tenha 8 casas felizes" (é preciso um tipo de meta novo, pouco código) e subir o alvo da meta 5.
   - Efeito: o Jardim ganha propósito e o meio ganha uma decisão de posicionamento.
3. Final com algo para superar.
   - Problema: a vitória diz só "Vitória!" e a derrota não diz a causa.
   - Proposta: vitória com mês do templo, felicidade média e maior população, mais o recorde local. Junto, a derrota com causa e dica, que já está no pacote "Avisos a tempo".
   - Efeito: o jogador termina pensando "da próxima vez faço em menos meses".

Ajustes para o sim-tester medir (só `rules.json` e `goals.json`, antes → depois)
- `happiness.idleMax` 20 → 10 e `idleScale` 40 → 25: o começo deixa de nascer triste.
- `happiness.happy` 65 → 60, `taxMax` 1,2 → 1,4, `familyMax` 1,5 → 2,0: estar feliz passa a valer prata e famílias.
- Meta 5: 80 → 110 moradores. Meta 7: 150 → 200, se a troca por "casas felizes" não for aprovada.
- Conferir também:
  - Com jardins, o Eficiente venceu só 24 de 30 partidas em 400 meses, o que sugere que os jardins tomam o lugar do templo.
  - O Comum teve lugar para o templo ao liberar em só 4 de 20 partidas.

Sobre altar, lazer e festas (opinião pedida): concordo com o usuário. Altar e templo únicos são o que faz a casa grande ser uma escolha de lugar (pilar 3); mais de um mataria isso. Lazer já existe: é o Jardim, e não precisa de outro agora.

OPCIONAL (ousada): "Festa no altar" como a próxima mecânica, no lugar de "oficina entristece".
- Como funciona: tocar no altar ou no templo, pagar uns 50 de prata, ganhar +15 de felicidade na cidade por 12 meses, com procissão até o altar e tochas à noite. Tem espera até poder fazer de novo.
- Por que vale: dá destino à prata parada do meio, uma recompensa a cada 1 a 3 minutos e um momento bonito.
- Pilares: é uma mecânica nova; vale como a próxima da fila (pilar 5), sem nenhuma história (pilar 4).

Arquivos olhados:
- /home/dani/projects/jerusalem-antiga/src/core/happiness.ts
- /home/dani/projects/jerusalem-antiga/src/data/rules.json
- /home/dani/projects/jerusalem-antiga/src/data/goals.json

Scripts da medição (temporários):
- /tmp/claude-1000/-home-dani-projects-jerusalem-antiga/07eca283-40fb-481c-a305-b854ecaa59b1/scratchpad/sim/happy.ts
- /tmp/claude-1000/-home-dani-projects-jerusalem-antiga/07eca283-40fb-481c-a305-b854ecaa59b1/scratchpad/sim/garden.ts

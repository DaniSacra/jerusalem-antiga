# ui-designer - 2026-11-02
Foco: tudo o que já está pronto: Interface nova, pacote visual Cidade bonita (partes 1–6), Campo é trabalho e Felicidade (com Jardim)

Revisão de interface, só leitura. Nenhum arquivo do projeto foi alterado.

Analisei as capturas em `/tmp/claude-1000/-home-dani-projects-jerusalem-antiga/07eca283-40fb-481c-a305-b854ecaa59b1/scratchpad/shots/` (hud-phone*, hud-pc*, happiness-*, day-night-*) e o código em `src/render` e `src/scenes`, incluindo o working tree. Os tamanhos em px de tela foram calculados a partir de `layout.ts`.

**O que já funciona bem:**
- A placa é legível à noite, porque o tom do dia e noite não afeta a interface.
- A carinha usa forma e cor ao mesmo tempo (vermelha triste com o número em vermelho).
- Os botões bloqueados mostram "Meta N", e sem prata o custo fica vermelho.
- O alerta tem o "!", então não depende só da cor.
- A altura adaptativa `LEFT_BTN` funciona: no celular de 591 de altura os botões ficam com 72.

## Melhorias, em ordem de impacto

**1. Painel de Opções deixa o toque passar para o trilho direito (bug)**
- Arquivo: `/home/dani/projects/jerusalem-antiga/src/render/Options.ts`
- O fundo do painel (`bg`) é um Graphics sem área de toque. O painel fica por cima de Casa e Campo, nos dois formatos (veja day-night-options).
- Por isso, tocar no título "Opções", no vão entre as linhas ou na borda escolhe Casa ou Campo por baixo, sem aviso. O painel não fecha, porque `contains()` diz que o toque foi dentro dele.
- Correção: colocar uma zona interativa do tamanho do painel no início do container (`scene.add.zone(0,0,w,h).setOrigin(0).setInteractive()`), para ela segurar o toque.

**2. A linha de informação fica pequena demais no celular justamente nos textos novos**
- Arquivos: `/home/dani/projects/jerusalem-antiga/src/render/InfoLine.ts`, `/home/dani/projects/jerusalem-antiga/src/render/layout.ts`
- A fonte é de 18 px do jogo, cerca de 11,9 px de tela no 844 x 390.
- O detalhe da felicidade e o da casa triste ("triste 30 (Altar +10, Jardim +20, Fome −30, Desemprego −20) · nível máximo") já ocupam todo o `INFO_MAX_W` de 1060 no PC e são encolhidos para cerca de 0,85. No celular isso dá uns 10 px de tela.
- Proposta: quando a escala ficar abaixo de cerca de 0,9, quebrar em 2 linhas (`INFO_H` 40 para 66, sempre com fonte de 18) em vez de encolher.

**3. O detalhe da felicidade não diz o que pesa nesta cidade, e a frase está incompleta**
- Arquivos: `/home/dani/projects/jerusalem-antiga/src/render/strings.ts` (`happinessBreakdown`) e `src/core/economy.ts` (agregação, regra do core, com teste)
- Em hud-phone a cidade está em 31, vermelha, mas os balões mostram só gotas, porque a falta de poço vem antes do balão triste. O jogador toca na carinha e lê frases fixas.
- Essas frases nem estão completas: "Jardim e altar alegram" omite que Poço e Mercado também dão +5.
- Proposta: a Economy expõe a média de cada `HappinessPart` (ou em quantas casas cada uma aparece). O texto passa a ser, por exemplo: "Felicidade 31 · 0 felizes, 2 contentes, 4 tristes · Desemprego −20 · Altar +10 (2 casas) · Poço: nenhuma casa".
- Isso também resolve o tamanho do item 2, porque tira as duas frases fixas.

**4. A pilha do topo cobre cerca de 27% da altura no celular**
- Arquivos: `/home/dani/projects/jerusalem-antiga/src/render/Hud.ts`, `/home/dani/projects/jerusalem-antiga/src/render/strings.ts` (`alert`)
- Placa (66) + meta (36) + aviso (40) somam uns 160 de 591. O aviso de saldo ocupa quase a largura entre os trilhos: "Saldo −2,4/mês · maior custo: Poço (18/mês) · demolir serviços que atendem poucas casas".
- Proposta: aviso curto ("Saldo −2,4/mês: toque para ver os gastos"). Tocar no aviso abre o detalhe da prata na linha de informação (dívida e saldo) ou mostra a dica de trabalho (desemprego).
- Hoje só o X do aviso é tocável, o resto do aviso não faz nada.

**5. Alvos de toque abaixo de 44 px nos celulares 20:9 (por exemplo 800 x 360, comum em Android)**
- Arquivo: `/home/dani/projects/jerusalem-antiga/src/render/layout.ts`
- Nesse formato o jogo fica com 1280 x 576 e escala de 0,625. A velocidade fica com 68 × 0,625 = 42,5 px. `LEFT_BTN` = 70 fica com 43,75 px.
- A carinha e a prata têm 66 de altura, cerca de 43 px já no 844 x 390.
- Proposta: `SPEED_BTN` 72, e calcular `LEFT_BTN` e a altura dos espaços da placa garantindo 44 / (altura da tela / `GAME_H`), em vez de um valor fixo.

**6. Números secundários da placa e dos trilhos com uns 9 a 10 px de tela no celular**
- Arquivos: `/home/dani/projects/jerusalem-antiga/src/render/Hud.ts`, `/home/dani/projects/jerusalem-antiga/src/render/Toolbar.ts`, `/home/dani/projects/jerusalem-antiga/src/render/strings.ts`
- Os textos "−2,4/mês" e "+17 sem vaga" usam 14 px do jogo, cerca de 9,2 px de tela. Os custos e o "Meta 4" usam 16, cerca de 10,6 px.
- Os espaços da placa não têm folga. Com um valor de prata alto, o "+15,5/mês" já encosta no pão da Comida (happiness-breakdown, prata de 6 dígitos). Comida com 4 dígitos e "−20,1/mês" também estoura os 156 do espaço.
- Proposta: tirar "/mês" do sub-texto (fica "−2,4", e o "/mês" aparece no detalhe ao tocar). Com o espaço que sobra, subir o sub-texto para 17 e os custos para 18.

**7. Meta cumprida mostra "6/6" e não reage até o mês virar**
- Arquivos: `/home/dani/projects/jerusalem-antiga/src/render/Hud.ts` (`setGoal`), `/home/dani/projects/jerusalem-antiga/src/render/strings.ts`
- `checkGoal` só roda no `stepMonth`. Em pausa (hud-phone-goal e hud-pc-debt) a faixa fica "6/6" sem nenhuma resposta, e o jogador acha que a meta não contou.
- Proposta: com progresso maior ou igual à meta, mostrar o progresso em uma pílula verde com ✓ ("6/6 ✓"). Fora isso, o progresso pode ganhar uma pílula escura, para se destacar do texto da meta.

**8. Trabalho "19/2" confunde**
- Arquivos: `/home/dani/projects/jerusalem-antiga/src/render/Hud.ts`, `/home/dani/projects/jerusalem-antiga/src/render/strings.ts`
- "19/2" parece uma data ou uma fração. Com sobra de gente, o número principal poderia ser as vagas ocupadas ("2/2") e o laranja "+17 sem vaga" continuaria explicando a sobra. Sem sobra, continua trabalhadores/vagas.
- Combina com o desemprego, que hoje é a principal causa da carinha vermelha.

**9. O detalhe da carinha e da prata não mostra resposta ao toque nem qual item está aberto**
- Arquivo: `/home/dani/projects/jerusalem-antiga/src/render/Hud.ts`
- As zonas dos espaços da placa não têm efeito de pressionar nem marca de ativo. Com o detalhe aberto, nada liga a linha de baixo à carinha.
- Proposta: um contorno dourado no espaço da placa enquanto `infoMode` for `happiness` ou `silver`, e um leve afundar ao tocar.

**10. Miniaturas da Casa e do Poço pequenas demais no trilho direito**
- Arquivo: `/home/dani/projects/jerusalem-antiga/src/render/Toolbar.ts` (`thumbnail`)
- A casa de nível 3 e o poço ocupam só uns 20 px de tela no celular. Ao lado deles, o Campo e o Mercado enchem o botão (hud-phone).
- Proposta: usar uma escala mínima por tipo (por exemplo, cortar a sombra e o chão da textura, ou usar um fator por tipo), para as 6 miniaturas parecerem do mesmo tamanho.

Observação fora da lista: como a especificação manda, o balão triste só aparece quando não falta nenhuma exigência. No começo do jogo a cidade inteira pode estar triste e o mapa só mostra gotas. Os itens 3 e 9 cobrem isso sem mudar a regra dos balões.

# copywriter - 2026-11-02
Foco: tudo o que já está pronto: Interface nova, pacote visual Cidade bonita (partes 1–6), Campo é trabalho e Felicidade (com Jardim)

## Revisão de textos de tela: Jerusalém Antiga (somente leitura)

Li `src/render/strings.ts`, `src/render/info.ts`, `src/render/tools.ts`, `src/data/goals.json`, as regras em `docs/GAME_DESIGN.md` e `src/core/happiness.ts`, e as capturas de tela. Não alterei nenhum arquivo e não rodei nenhum teste.

No geral os textos estão bons: são curtos, falam em português simples e quase todo problema já diz o que fazer. Os novos da Felicidade funcionam, e a carinha mais os motivos na linha da casa explicam bem o número. Os problemas que encontrei são cinco: um termo que confunde ("ligada à rua" contra "ligada ao altar"), toasts mais longos que o limite, dois avisos sem ação ou com o verbo no infinitivo, três nomes diferentes para "sem trabalho" e um rótulo da Felicidade que fica errado quando a casa está perto do Templo.

### Mudanças propostas, em ordem de impacto

**1. "ligado à rua" e "sem rua" para algo que na verdade é "ligado ao altar"** (`goals.json` meta 1; `info.ts`)
- Hoje:
  - Meta: "Tenha 6 casas ligadas à rua"
  - Construção: "ligado à rua ✓" / "sem rua"
  - Terreno: "sem rua: nenhuma família vai chegar"
- Proposta:
  - Meta: "Tenha 6 casas ligadas ao altar"
  - Construção: "ligado ao altar ✓" / "sem rua até o altar"
  - Terreno: "sem rua até o altar: nenhuma família vai chegar"
  - No balão e no item "Para Casa de barro:", trocar "sem rua" por "sem rua até o altar".
- Motivo: a meta e a ligação só contam ruas ligadas ao altar. Uma casa encostada numa rua solta aparece como "sem rua", mas o jogador está vendo a rua ali do lado. A própria rua já diz "ligada ao altar ✓/✗", então a palavra deve ser a mesma nas duas coisas.
- Docs: GAME_DESIGN.md (Metas item 1, "Faixa da meta", linha de informação).

**2. Toasts acima de ~45 caracteres** (`T.debtStart`, `T.fail.debt`, `T.fail.noRoad`, `T.unlocked`)

| Hoje | Proposta |
|---|---|
| "A cidade entrou em dívida! Toque na prata para ver os gastos" (59) | "Em dívida! Toque na prata para ver os gastos" (44) |
| "A cidade está em dívida: nada pode ser construído" (49) | "Em dívida: nada pode ser construído" (35) |
| "O Templo precisa encostar numa rua ligada ao altar" (50) | "Templo: encoste numa rua ligada ao altar" (40) |
| "Jardim liberado: casas felizes pagam mais imposto e atraem famílias" (67) | "Jardim liberado: deixa as casas felizes" (39) |
| "Oficina liberada: 3 vagas e 5 de prata/mês" | "Oficina liberada: 3 vagas e 5 prata/mês" (ver item 8) |

- Motivo: no celular esses toasts encolhem ou quebram em duas linhas. O do Jardim sai junto com "Meta cumprida! +40 prata · Nova construção: Jardim" (50), então são dois toasts longos empilhados. O detalhe do imposto e das famílias já está na dica do Jardim.
- Docs: GAME_DESIGN.md (Dívida e derrota; o parágrafo depois de Metas).

**3. Aviso de dívida sem ação e aviso de dívida com fome no infinitivo** (`T.alert`, kind `debt`)
- Hoje:
  - "A cidade está em dívida! 4 meses para ser abandonada"
  - "Em dívida e com fome: demolir serviços para juntar prata para um campo · 4 meses"
- Proposta:
  - "Em dívida: corte gastos (toque na prata) · faltam 4 meses para o abandono" (~72)
  - "Fome e dívida: demola serviços para sobrar prata para um campo · faltam 4 meses" (~78)
- Motivo: o primeiro diz a causa mas não o que fazer. O segundo usa infinitivo onde deveria ser imperativo e escreve os meses de um jeito diferente do primeiro. "Juntar prata" também pode fazer o jogador achar que demolir devolve prata, mas Limpar não devolve nada; o que acontece é que a manutenção para.
- Docs: GAME_DESIGN.md (Dívida e derrota, "Avisos").

**4. Aviso de saldo negativo dá um conselho errado quando o maior gasto é o Campo** (`T.alert`, kind `deficit`)
- Hoje: "Saldo −1/mês · maior custo: Campo (1/mês) · demolir serviços que atendem poucas casas"
- Proposta: "Saldo −1/mês · maior gasto: Campo (1/mês) · demola serviços que atendem poucas casas"
- Motivo: troca o infinitivo pelo imperativo, e "gasto" é a palavra usada em "ver os gastos".
- Promessa errada: na captura `clarity-famine.png` o aviso aparece no começo do jogo, com 0 casas e um único Campo. O Campo não é um serviço, e demoli-lo tira a única fonte de comida. Sugiro que o core só aponte serviços (poço, mercado, jardim) como "maior gasto", ou que, sem casas, o aviso diga "Saldo −1/mês: construa casas para ganhar impostos". Isso é uma decisão para o game-director.
- Docs: GAME_DESIGN.md ("Avisos").

**5. "Desemprego", "sem vaga" e "sem trabalho" são três nomes para a mesma coisa** (`T.happinessPart.idle`, `T.happinessBreakdown`)
- Hoje: a linha da casa diz "Desemprego −20", o aviso diz "24 pessoas sem trabalho" e a barra diz "+24 sem vaga".
- Proposta: `idle: 'Sem trabalho'` (ex.: "Sem trabalho −20"), e "fome e desemprego entristecem" vira "fome e falta de trabalho entristecem".
- Motivo: "desemprego" é uma palavra abstrata para 12 anos, e a mesma coisa deve ter um nome só. O "+N sem vaga" da barra pode ficar, porque está ao lado do número de vagas.
- Docs: GAME_DESIGN.md (exemplos "Desemprego −20" na Interface e na tela da carinha).

**6. O motivo "Altar" aparece também para casas no raio do Templo** (`T.happinessPart.sacred`)
- Hoje: `sacred: 'Altar'`
- Proposta: `sacred: 'Altar ou Templo'`, igual a `T.need.sacred`.
- Motivo: no core, `sacred` cobre o raio do altar ou do templo. Uma casa longe do altar e perto do Templo mostraria "Altar +10", o que é falso. Se o texto ficar longo, "Templo/Altar" também serve.

**7. A frase da carinha tem um erro de concordância e deixa motivos de fora** (`T.happinessBreakdown`)
- Hoje: "Felicidade 49 · 0 felizes, 11 contentes, 0 tristes · Feliz paga mais imposto e atrai famílias · Jardim e altar alegram; fome e desemprego entristecem"
- Proposta: "Felicidade 49 · 0 felizes, 11 contentes, 0 tristes · Casa feliz paga mais imposto e atrai famílias · Jardim, altar, poço e mercado alegram; fome e falta de trabalho entristecem"
- Motivo: falta o sujeito em "Feliz paga", e poço e mercado também dão +5 (as regras da Felicidade em GAME_DESIGN.md). Se a linha passar do espaço no celular, corte para "Casa feliz paga mais · Alegram: jardim, altar, poço, mercado · Entristecem: fome, falta de trabalho".
- Docs: GAME_DESIGN.md ("Tocar na carinha").

**8. Unidades misturadas: "5 de prata/mês" contra "40 prata", e "1/mês" sem dizer o que é** (`toolHead`, `toolHint`, `T.unlocked.workshop`, `info.ts`)
- Hoje:
  - "Jardim · 25 prata · 1/mês"
  - "produz 3 de comida e 1 de prata/mês"
  - "Oficina liberada: … 5 de prata/mês"
  - info.ts: "3 de comida/mês"
- Proposta:
  - "Jardim · 25 prata · manutenção 1/mês"
  - "produz 3 comida e 1 prata/mês"
  - "5 prata/mês"
  - "3 comida/mês"
- Motivo: um formato só ("N prata", "N/mês"). Sozinho, "1/mês" no título pode ser lido como produção. A linha da construção já usa "manutenção 1/mês".
- Docs: GAME_DESIGN.md (exemplo "Campo · 15 prata · 1/mês · … produz 3 de comida e 1 de prata/mês", e "Oficina liberada").

**9. A linha da casa mostra o número da felicidade sem escala** (`info.ts`)
- Hoje: "contente 60 (Altar +10, Jardim +20, Desemprego −20)"
- Proposta: "contente 60/100 (Altar +10, Jardim +20, Sem trabalho −20)"
- Motivo: os motivos somam +10, mas o número é 60, e o jogador não sabe que a base é 50 nem que o máximo é 100. O "/100" mostra que é uma nota. Uma alternativa é começar a lista com "base 50", mas fica mais longa. O texto precisa ir para `strings.ts` (ver item 10).
- Docs: GAME_DESIGN.md (exemplo na linha de informação).

**10. Texto de tela fora de `strings.ts` e uma frase truncada na tela inicial**
- Em `src/render/info.ts` há textos soltos:
  - "Rua · entrada da cidade", "ligada ao altar", "não dá para construir aqui", "use Limpar para cortar (…)", "livre para construir"
  - "sem rua: nenhuma família vai chegar", "uma família está a caminho", "esperando uma família", "a fome impede novas famílias"
  - "moradores", "imposto", "nível máximo", "Para …:", "fome: não evolui", "centro da cidade, onde as ruas começam", "não funciona/não atende ninguém, mas paga manutenção", "vagas", "eficiência"
- Em `src/render/tools.ts`, `toolName` tem 'Ver', 'Rua' e 'Limpar' repetidos de `toolHead`.
- Esses textos devem ir para `T`, por exemplo um bloco `T.info` e um bloco `T.tool`. Quem move é o ui-designer ou o código, sem mudar o texto, a não ser os itens 1 e 9.
- Na tela inicial, o passo 2 diz "Poço, mercado e o altar perto fazem as casas crescerem." O correto é "Casas crescem com poço, mercado e o altar por perto." Docs: GAME_DESIGN.md, item da tela inicial.

### Observações menores (não entram nas 10)
- **Opções:** "Dia e noite: ligado/desligado" está claro. "Efeito maquete" pode não ser entendido por todos; uma opção é "Efeito maquete (bordas borradas): ligado". O "(aparelho lento)" está bom.
- **Toasts que só dizem o problema:**
  - "Local inválido" e "Ainda bloqueado" não dizem o que fazer. Para o segundo, "Bloqueado: veja a meta no botão" (33).
  - O "Local inválido" precisaria do motivo vindo do core.
- **Meta 3** "Tenha 5 casas de barro" também conta casas melhores. Está correto pelo progresso, mas "Tenha 5 casas de barro ou melhores" é mais exato, se couber na faixa.
- **Dica de Limpar** "Remove construções e ruas sem reembolso" não fala de árvores, embora o título fale. Sugiro "Remove árvores, construções e ruas, sem devolver prata. Pode arrastar."

### Arquivos citados
- /home/dani/projects/jerusalem-antiga/src/render/strings.ts
- /home/dani/projects/jerusalem-antiga/src/render/info.ts
- /home/dani/projects/jerusalem-antiga/src/render/tools.ts
- /home/dani/projects/jerusalem-antiga/src/data/goals.json
- /home/dani/projects/jerusalem-antiga/docs/GAME_DESIGN.md
- Capturas usadas, todas em /tmp/claude-1000/-home-dani-projects-jerusalem-antiga/07eca283-40fb-481c-a305-b854ecaa59b1/scratchpad/shots/:
  - happiness-house.png
  - happiness-sad.png
  - happiness-breakdown.png
  - overlay-garden.png
  - day-night-options.png
  - debt-alerts.png
  - debt-silver-info.png
  - clarity-famine.png
  - hud-phone-goal.png
  - title.png
  - defeat.png

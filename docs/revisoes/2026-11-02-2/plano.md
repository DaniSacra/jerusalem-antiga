# Plano da revisão 2026-11-02-2 (game-director)

Base: a lista do usuário (evidências A e B, propostas 1 a 8), o plano anterior
(`docs/revisoes/2026-11-02/plano.md`, v2), o commit f9089bb (Pacote 1 "Primeira partida sem
ajuda", já implantado), o commit 4cd92f7 (estações e clima, só aparência), `docs/GAME_DESIGN.md` e
`docs/design.md`.
**Os relatórios de validação do P1 anterior ainda não chegaram** (test-reviewer, code-reviewer,
sim-tester, playtester, ui-designer e fun-critic). Os pontos que dependem deles estão marcados com
**[depende: agente]**. O plano aprovado anterior não foi alterado.

## 1. Resumo (como o jogo está hoje)
1. O começo foi atacado: tutorial de 6 passos, nomes nos botões, manutenção só depois da Meta 2, mês de 2,0 s, primeira família em até 2 meses e carinha escondida até o Jardim. Falta validar com os agentes.
2. Ainda falta a outra metade da queixa da jovem: ver a ligação ao altar, ver onde há água e mercado e ver o custo antes de gastar. Hoje isso só se aprende pelo erro ou pelos balões.
3. Os balões continuam em excesso: gota, mercado e chama aparecem sempre e escondem os avisos que travam a cidade.
4. O fim do jogo continua frágil: em ruas em grade o templo pode ficar sem lugar 6 x 6 para sempre, e as metas 7 e 8 ainda são 150 moradores e 4 casas grandes, o que deixa a partida curta.
5. Este plano tem 2 pacotes sem mecânica nova. O P1 trata da clareza ("Ver antes de construir"). O P2 trata do fim e do equilíbrio ("O templo sempre cabe"), que depende das medições do sim-tester.

## 2. Já feito (commit f9089bb) e o que falta validar
| Proposta | Feito | Aceite que ainda falta |
|---|---|---|
| 1 Tutorial guiado | 6 passos com seta, caminho fantasma, lugares verdes, câmera 2 s na família, "Atende N casas" (Poço, Mercado, Jardim), "Pular tutorial", `jerusalem.tutorialDone` com try/catch, "Ver tutorial de novo", mini passos do saldo e do Mercado na Meta 2 | **[depende: playtester]** novato chega à meta 3 sem perder e sem explicação, no 844 x 390 e no PC. **[depende: fun-critic]** clareza ≥ 8 |
| 4a Manutenção depois da Meta 2 | `upkeepStartsAfterGoal` 2 e a mensagem do usuário (mini passo ou toast) | **[depende: sim-tester]** nenhuma derrota antes da meta 2; eficiente sem dívida |
| 6 (parte) Ritmo do começo | `monthSeconds` 2,0; `earlyFamilySpeedMultiplier` 3 | **[depende: sim-tester]** primeiro morador no mês ≤ 2 em 100 seeds; duração em minutos com 2,0 s |
| 7 Nomes nas ferramentas | nome embaixo do ícone em todos os botões, com custo | **[depende: ui-designer]** legível no 844 x 390 e no PC, toque ≥ 44 px no 800 x 360 |
| Do plano anterior | carinha escondida antes do Jardim; bugs do 1.6 | **[depende: code-reviewer, test-reviewer]** |

Regra para os relatórios em andamento: **bugs e problemas de leitura do que já foi feito**
entram como item 1.6 do novo P1. Tudo o que for regra nova ou número volta ao game-director.

## 3. Consensos (duas ou mais fontes)
- **Ligação ao altar invisível antes de errar**: evidência A, fun-critic e playtester (revisão anterior). Hoje a rua desligada só fica apagada e tracejada depois de construída.
- **Poço e mercado não entendidos**: evidência A, fun-critic (clareza 5–6). O tutorial ensina o poço; o mercado só tem o mini passo; a área de cada um continua invisível com a ferramenta Casa.
- **Excesso de balões**: evidência B, ui-designer e playtester.
- **Dívida por construir tudo de uma vez**: evidência A. A manutenção depois da Meta 2 adia o problema, mas não mostra o custo na hora de construir.
- **Templo sem lugar**: evidência B, sim-tester e fun-critic.
- **Jogo curto e prata sobrando**: evidência B, sim-tester e fun-critic.
- **Custo O(N²) de `balloonNeed`/`houseInfo` → `computeEconomy`**: playtester, code-reviewer e test-reviewer. Fica mais urgente porque as prévias novas calculam a cada célula arrastada.

## 4. Conflitos e decisões
| Tema | Posições | Decisão e motivo |
|---|---|---|
| Como dividir em 2 pacotes | O antigo P2 tinha 6 itens (clareza, praça, metas e desempenho) | **P1 = clareza** (propostas 2, 3 e 4b/4c, mais o desempenho que elas exigem). **P2 = fim e equilíbrio** (proposta 5, proposta 6 metas e o alvo do Distraído). Motivo: o P1 responde ao playtest real e não depende de medição; o P2 depende do sim-tester e do map-designer |
| Fome como balão | Usuário: balão sempre visível para "fome" | **A fome não ganha balão por casa.** Já existem o tom vermelho no mapa, a comida piscando e o toast. Um balão em cada casa seria o mesmo excesso que estamos tirando |
| Gota, mercado e chama | Hoje sempre visíveis | Aparecem **só com a ferramenta correspondente** (Poço, Mercado, Templo) **ou com Ver na casa**. A casa triste só com Ver. Sempre visíveis ficam só "sem rua" e "sem trabalhadores" |
| Saldo na prévia | Calcular por célula × uma vez | **Uma vez ao escolher a ferramenta**, supondo a construção ligada: o saldo depois dela é o saldo atual − manutenção + a produção na eficiência atual. Não depende do lugar, então é barato e fácil de ler |
| Aviso do primeiro saldo negativo × etiqueta "só quando aperta" | — | **Os dois** (decisão mantida): um toast uma vez por partida, e a etiqueta só quando prata + 12 × saldo < 0 |
| Rua desligada, linha até a rede | Linha pontilhada até a rua mais próxima | **Entra, só ao tocar com Ver** numa construção sem rua. Uma linha reta em "L" até a célula da rede mais próxima (distância de Manhattan). Não é caminho e não constrói nada |
| Praça × Limpar na rua inicial | A rua inicial pode ser removida e a praça ficaria solta | **As ruas da coluna 24, do anel até o fim da praça (y 26 a 34), ficam protegidas** como o altar ("Esta rua leva à praça do Templo"). Motivo: a praça tem que estar sempre ligada, sem regra nova de conexão. **Pergunta ao usuário** |
| Praça × lugares verdes do tutorial e da Casa | — | A praça **nunca** aparece verde para Casa nem para outra construção; a prévia sobre ela fica vermelha com "Praça reservada ao Templo" |
| Templo só na praça | Proposta do usuário | **Mantida a decisão anterior**: a praça é só do Templo, mas o Templo pode ir a qualquer lugar válido (pilar 3) |
| Metas 7 = 250 e 8 = 8 | Usuário: 8. sim-tester: com 6, já havia partidas travadas | **Entra no P2 com a rede de segurança já aprovada**: se alguma partida ficar presa > 100 meses na meta 8 (500 seeds), cai para 6. **[depende: sim-tester]** |
| Distraído não perde antes de 5 min | Alvo do usuário, aprovado | **Fecha no P2** com números que o sim-tester propõe (prêmio da meta 3, `debtMonthsToLose`). **[depende: sim-tester]**: se o relatório do P1 já mostrar ≥ 5 min, o item sai |
| Comum vence em 15 a 25 min | Usuário: alvo. Decisão de 2026-11-02: alvo intermediário | **Mantida**: simulação ≥ 4 min e sessão humana ≥ 10 min nestes 2 pacotes. Os 15–25 min vêm do conteúdo (P3 Felicidade, P4 Festa). O sim-tester mede e relata |
| Toasts de estação (commit 4cd92f7) | Novo: competem com os toasts importantes | **Ajuste de interface no P1**: durante o tutorial não aparecem, e nunca empurram para cima um toast de dívida, de fome ou de meta (a estação é a de menor prioridade) |

## 5. Pacote 1: "Ver antes de construir" (implantar agora)
Mecânica nova: **nenhuma**. Prévias, camadas no chão, menos balões, avisos e desempenho.
Pilares: fortalece o 1 (a regra aparece antes do erro) e o **3** (o jogador vê, antes de
construir, até onde o lugar leva a casa e quanto o serviço custa). O 2 fica neutro: a cidade fica
mais limpa sem os balões. Risco para o 1: chão poluído. Controle: as camadas aparecem só com a
ferramenta ativa.

### 1.1 Desempenho primeiro (economia uma vez por sync)
- Origem: plano anterior 2.6; playtester, code-reviewer e test-reviewer. Novo: custo das estações e do clima no celular.
- Por que agora: as prévias do 1.2 a 1.4 calculam a cada célula arrastada. Sem isto, o celular trava.
- Regras:
  - `computeEconomy` roda uma vez por sync. `balloonNeed(s, b, eco)` e `houseInfo(s, b, eco)` recebem a economia pronta.
  - `drawTrails` só redesenha quando as casas mudam.
  - `Walkers` só troca a textura quando a chave muda.
- Arquivos: `src/core/houses.ts`, `economy.ts`, `src/render/MapView.ts`, `Walkers.ts`, `Ambient.ts`, `tests/houses.test.ts`.
- Aceite:
  - Arrastar 1 célula com 122 construções leva < 0,5 ms no Node (hoje ~3,8 ms), com resultados idênticos nos testes.
  - Cidade de 40 casas, 3x, com chuva e CPU do Playwright 4x mais lenta: média ≥ 45 quadros/s.

### 1.2 Conexão sempre visível
- Origem: proposta 2, evidência A.
- Por que agora: é a regra nº 1 do jogo, e a jovem não a entendeu.
- Regras:
  - A prévia da rua (toque ou arraste) fica verde quando a rua liga ao altar e vermelha quando não liga, com "não liga ao altar" acima do dedo. A função do core `roadLinks(s, cells)` diz se alguma célula do traço encosta na rede ou no altar.
  - A prévia das outras construções mostra "sem rua" em laranja quando não encosta na rede. Continua permitido construir (decisão de spec mantida), mas o jogador vê antes.
  - Ao tocar com Ver numa construção sem rua, uma linha pontilhada em "L" vai até a célula da rede mais próxima (`nearestNetworkCell`).
  - Já existe e fica: rua desligada apagada e tracejada, e o toast "Esta rua não está ligada ao altar".
- Arquivos: `src/core/roads.ts` (ou o módulo da rede), `src/render/MapView.ts`, `info.ts`, `strings.ts`, `palette.ts`, `tests/roads.test.ts`, `docs/GAME_DESIGN.md`.
- Aceite:
  - Testes de `roadLinks` (traço encostando na rede, no altar, solto, ligado a uma rua solta) e de `nearestNetworkCell`.
  - Capturas `road-preview-ok`, `road-preview-loose`, `building-preview-noroad` e `unlinked-line`, no 844 x 390 e no 1366 x 768.

### 1.3 Necessidades à vista e menos balões
- Origem: proposta 3, evidências A e B, ui-designer.
- Por que agora: sem ver a área, o jogador não entende poço nem mercado. Os balões de dica escondem os que travam.
- Regras:
  - Com a ferramenta **Casa** ativa, o chão mostra a área coberta pelos poços em azul e pelos mercados em laranja. O dourado do altar e do templo já existe. Só contam serviços ligados. A linha de informação ganha a legenda curta "azul: água · laranja: mercado · dourado: altar".
  - A prévia da casa mostra o nível máximo possível ali ("aqui: até Casa de barro"; sem rua: "aqui: sem rua"). A função do core `maxLevelAt(s, x, y)` é a mesma lógica que o `houseInfo` usa.
  - Balões sempre visíveis: só "sem rua" e "sem trabalhadores".
  - Balões que aparecem só com a ferramenta correspondente ou com Ver na casa:
    - gota (poço) com Poço
    - mercado com Mercado
    - chama com Templo
    - casa triste só com Ver
  - Fome continua sem balão (tom vermelho, comida piscando e toast).
- Arquivos: `src/core/houses.ts`, `src/render/MapView.ts`, `info.ts`, `strings.ts`, `palette.ts`, `tests/houses.test.ts`, `docs/GAME_DESIGN.md`.
- Aceite:
  - Testes de `maxLevelAt` (cada nível, sem rua, serviço desligado não conta, igual ao `houseInfo`).
  - Captura `needs-overlay` (celular e PC): as três cores visíveis e a legenda legível.
  - Captura `balloons-calm`: cidade de 40 casas sem nenhuma gota sem ferramenta, com o balão "sem rua" visível. Com Poço ativo, as gotas voltam.
  - O passo 5 do tutorial continua mostrando as gotas (o Poço está ativo).

### 1.4 Saldo antes do problema
- Origem: propostas 4b e 4c, evidência A; itens já aprovados de "Avisos a tempo"; playtester e copywriter (conselho errado).
- Por que agora: quem constrói tudo de uma vez precisa ver o saldo cair antes de gastar.
- Regras:
  - A prévia e a linha de informação de construção com manutenção mostram "saldo +3/mês → −1/mês" (vermelho se ficar negativo), calculado uma vez ao escolher a ferramenta (ver Conflitos). Só aparece com a manutenção ativa; antes continua "manutenção N/mês depois da Meta 2".
  - Toast na primeira vez que o saldo do mês ficar negativo, uma vez por partida (evento do core `firstDeficit`): "Seu saldo ficou negativo: toque na prata para ver os gastos".
  - A etiqueta de saldo aparece só quando aperta: prata + `deficitAlertMonths` (12) × saldo < 0.
  - O conselho é certo:
    - o "maior gasto" é escolhido só entre serviços que podem ser demolidos
    - sem casas: "construa casas para ganhar impostos"
    - sem serviço demolível: nenhum conselho de demolir
  - Aviso antes da fome: com a comida caindo e durando menos de `foodAlertMonths` (8) meses, "Comida acaba em N meses: construa um campo".
  - Ordem da etiqueta única: dívida, fome ou comida acabando, saldo, sem trabalho.
- Dados: `rules.json` `deficitAlertMonths` 12, `foodAlertMonths` 8.
- Arquivos: `src/core/economy.ts` (`previewBalance`, alertas, evento), `src/data/rules.json`, `src/render/strings.ts`, `info.ts`, `Hud.ts`, `tests/economy.test.ts`, `docs/GAME_DESIGN.md`.
- Aceite:
  - Testes de cada condição de aviso (inclui só um Campo e o Templo como maior gasto).
  - Testes de `previewBalance`.
  - Teste: o `firstDeficit` dispara uma vez só.
  - Captura `preview-balance-red`.

### 1.5 Toasts de estação com prioridade baixa
- Origem: game-director (novo, por causa do commit 4cd92f7).
- Por que agora: a cada 24 s chega uma estação, e o toast dela compete com dívida, fome e meta, justo o que este pacote quer deixar claro.
- Regra: durante o tutorial não há toast de estação. Fora dele, o toast de estação não aparece se houver outro toast na tela, e nunca empurra um toast de dívida, fome ou meta.
- Arquivos: `src/render/UIScene.ts` (ou onde os toasts ficam), `docs/GAME_DESIGN.md`.
- Aceite: captura `toast-priority` com a meta cumprida e a troca de estação no mesmo mês.

### 1.6 Correções vindas da validação do P1 anterior
- Origem: **[depende: test-reviewer, code-reviewer, playtester, ui-designer, fun-critic]**.
- Regra: entram só bugs e problemas de leitura do que já foi feito (tutorial, nomes, manutenção, ritmo). O game-director confirma a lista antes de começar. Regra nova, número novo ou texto de história voltam para decisão.
- Aceite: cada correção com teste ou captura.

### Critérios de aceite do Pacote 1
- **playtester**, como quem nunca jogou e só faz o que a tela pede, chega à **meta 3 sem perder e sem explicação**, no 844 x 390 e no PC. Ele também deve dizer, sem ajuda, por que uma rua ou casa "não funciona".
- **ui-designer**: cores das camadas, legenda, "aqui: até …", saldo da prévia e linha pontilhada legíveis no **844 x 390** e no PC 1366 x 768.
- **fun-critic**: clareza do objetivo **≥ 8**.
- **sim-tester**: nada muda no equilíbrio (só interface). Confirma que os 3 bots dão o mesmo resultado de antes nas mesmas seeds.
- `npm test`, `npx tsc --noEmit`, `npm run build` e `npm run test:visual` passam, e as capturas novas foram olhadas.

## 6. Pacote 2: "O templo sempre cabe" (implantar depois do P1 aprovado)
Mecânica nova: **nenhuma**. Uma área reservada no mapa (regra de lugar), duas metas mais longas e
ajustes de número medidos.
Pilares: fortalece o 1 (o fim nunca trava) e mantém o **3** (o templo continua podendo ir a
qualquer lugar). O 2 melhora: a praça de pedra no centro dá cara de cidade.
**Depende do sim-tester e do map-designer.**

### 2.1 Praça do templo
- Origem: proposta 5, evidência B, sim-tester e fun-critic.
- Regras:
  - O mapa nasce com uma área 6 x 6 reservada (`plaza` no `GameState`, `rules.json` `map.plaza`), encostada na rua inicial, **fora do raio do altar** (para não roubar as casas grandes) e dentro da área livre.
    - Ponto de partida: x 25..30, y 29..34, a leste da coluna 24.
    - Raio do altar: até y 28, então a praça fica fora dele.
    - O map-designer valida em todas as seeds.
  - Só o Templo constrói ali. Rua e outras construções falham com "Praça reservada ao Templo", e a prévia fica vermelha. A praça nunca aparece verde para Casa nem nos lugares verdes do tutorial.
  - As ruas da coluna 24, de y 26 a 34, ficam protegidas contra Limpar (pergunta 2).
  - O Templo continua podendo ir a qualquer lugar válido. Com a ferramenta Templo, a praça brilha além dos lugares verdes que já aparecem.
  - Desenho de praça de pedra clara (sprite-artist). Quando o templo é construído nela, a pedra fica embaixo dele.
- Arquivos: `src/core/map.ts`, `state.ts`, `types.ts`, `build.ts` (ou onde a validação do lugar mora), `tutorial.ts`, `src/data/rules.json`, `src/render/MapView.ts`, `textures.ts`, `strings.ts`, `tests/map.test.ts`, `tests/build.test.ts`, `docs/GAME_DESIGN.md`, `docs/TESTING.md`.
- Aceite:
  - Em 500 seeds, a praça está livre, ligada à rede, fora do raio do altar, e o Templo cabe nela.
  - Teste: nada além do Templo é construído na praça; as ruas protegidas não saem.
  - Captura `temple-plaza` (com Casa ativa e com Templo ativo).
  - **[depende: sim-tester]** nenhuma partida presa por falta de lugar para o templo, com o bot que faz ruas em grade.

### 2.2 Metas mais longas
- Origem: proposta 6 (parte que falta).
- Regras:
  - `goals.json`: meta 7 de 150 para **250** moradores; meta 8 de 4 para **8** casas grandes. Os prêmios não mudam.
  - Se alguma partida ficar presa mais de 100 meses na meta 8 (500 seeds), a meta 8 cai para 6.
- Arquivos: `src/data/goals.json`, `tests/goals.test.ts`, `docs/GAME_DESIGN.md`.
- Aceite: **[depende: sim-tester]** duração do Comum medida em minutos; alvo intermediário de simulação ≥ 4 min.

### 2.3 Distraído não perde antes de 5 min
- Origem: critério geral do usuário (evidência B).
- Regra: o sim-tester propõe, e o game-director aprova, no máximo **dois números**, entre prêmio da meta 3 (40 → 55..75) e `debtMonthsToLose`, para o Distraído não perder antes do mês 150 e continuar perdendo ~60% ao todo. Nenhuma regra nova.
- **[depende: sim-tester]**: se o relatório do P1 anterior já mostrar a primeira derrota no mês ≥ 150, este item sai.
- Arquivos: `src/data/goals.json` e/ou `rules.json`, testes afetados, `docs/GAME_DESIGN.md`.

### Critérios de aceite do Pacote 2
- **sim-tester**, com 500 seeds por bot:
  - o **Distraído** não perde antes de 5 minutos (mês 150) e perde ~60% ao todo
  - o **Eficiente** vence sem dívida
  - o **templo** é sempre construível
  - nenhuma partida fica presa na meta 8
  - o **Comum**: medir e relatar a duração (alvo intermediário ≥ 4 min de simulação; 15–25 min fica para depois do P3/P4)
- **map-designer**: a praça é válida em todas as seeds e não atrapalha o caminho fantasma do tutorial.
- **playtester**: o novato chega à meta 3 sem perder, e o jogador comum chega ao templo sem travar.
- **ui-designer**: praça e destaque legíveis no 844 x 390 e no PC.
- **fun-critic**: clareza ≥ 8. Medir também "curva" e "vontade de jogar de novo" com as metas novas.
- `npm test`, `npx tsc --noEmit`, `npm run build` e `npm run test:visual` passam, e as capturas foram olhadas.

## 7. Fora e para depois
**Para depois (registrado, não entra):**
- Prata sobrando: o destino principal é a **Festa na praça (P4)**, que usa a praça do P2. Depois, se não bastar, decorações ou compra de terrenos.
- Personalização: nome da cidade, decorações livres e modo foto.
- O resto da sequência continua a de `docs/design.md`:
  - P3 "Felicidade que se sente" (degrau, altar/templo fora, meta 5 = 8 casas felizes, tela de derrota com causa)
  - P4 "Festa na praça"
  - P5 "Cidade densa"
  - Seca e frio das estações (mecânica nova, pedido do usuário): entram como um pacote próprio, **depois do P4**. A escolha entre eles e os "Eventos leves" fica com o usuário.

**Fora:**
- Balão de fome em cada casa: o mapa vermelho e a comida piscando já avisam.
- Balão de incêndio: a mecânica não existe.
- Templo obrigatório na praça: tira a escolha de lugar.
- Alongar a partida só com o mês mais lento ou com metas gigantes.
- Saldo da prévia recalculado por célula: custa caro e muda pouco.
- Proibir construir sem rua: a prévia "sem rua" basta, e a regra atual ensina pelo balão.

## 8. Perguntas em aberto para o usuário
1. Aprova a divisão: **P1 "Ver antes de construir"** (clareza, agora) e **P2 "O templo sempre cabe"** (praça, metas e Distraído, depois das medições)?
2. Aprova **proteger contra Limpar a rua da coluna 24 entre o altar e a praça** (y 26 a 34)? Sem isso, a praça pode ficar desligada.
3. Fome **sem balão** por casa (já há mapa vermelho, comida piscando e toast). Concorda?
4. Gota, mercado e chama **só com a ferramenta ou com Ver**. Isso vale também fora do tutorial, para sempre?
5. Toast de estação com a **menor prioridade** e escondido durante o tutorial. Pode?
6. Seca e frio das estações (mecânica) ficam **depois do P4 (Festa)**, ou antes?

## 9. Prompt de implantação do Pacote 1
```
Implemente o Pacote 1 "Ver antes de construir" descrito em
docs/revisoes/2026-11-02-2/plano.md (seção 5, itens 1.1 a 1.6). Você (agente
principal) implementa direto; não use agentes durante a implementação.
Nenhuma mecânica nova. Nada de história. O item 1.6 só entra com a lista
confirmada pelo game-director a partir dos relatórios de validação.

Ordem:
1. Core e dados, com testes Vitest junto de cada regra:
   - Desempenho primeiro (1.1): computeEconomy uma vez por sync;
     balloonNeed(s, b, eco) e houseInfo(s, b, eco) recebem a economia pronta.
   - roadLinks(s, cells) e nearestNetworkCell(s, building).
   - maxLevelAt(s, x, y), a mesma lógica usada pelo houseInfo.
   - previewBalance(s, kind) (saldo atual - manutenção + produção na
     eficiência atual, supondo ligada); evento firstDeficit uma vez por
     partida; alertas: comida acabando (foodAlertMonths 8), saldo só quando
     aperta (deficitAlertMonths 12), conselho só com serviços demolíveis,
     "construa casas" sem casas; ordem dívida, fome/comida, saldo, sem
     trabalho.
2. Render e interface:
   - Prévia da rua verde/vermelha com "não liga ao altar"; "sem rua" na
     prévia das outras construções; linha pontilhada em L até a rede ao
     tocar com Ver numa construção sem rua.
   - Com Casa ativa: áreas de poço (azul) e mercado (laranja) no chão, com
     legenda na linha de informação; prévia "aqui: até Casa de barro".
   - Balões sempre visíveis só "sem rua" e "sem trabalhadores"; gota com
     Poço, mercado com Mercado, chama com Templo, ou com Ver na casa; triste
     só com Ver. Fome sem balão.
   - Prévia/linha de informação com "saldo +3/mês → −1/mês" (vermelho se
     negativo), só com manutenção ativa; toast do primeiro saldo negativo.
   - Toast de estação: nenhum durante o tutorial; menor prioridade fora dele.
   - drawTrails só quando as casas mudam; Walkers só troca textura quando a
     chave muda.
   - Cores em palette.ts, textos em strings.ts.
3. Docs no mesmo trabalho: docs/GAME_DESIGN.md (Ruas e conexão, Interface
   > balões e prévias, avisos, toasts) e docs/TESTING.md (cenários
   road-preview-ok, road-preview-loose, building-preview-noroad,
   unlinked-line, needs-overlay, balloons-calm, preview-balance-red,
   toast-priority e o de quadros/s com chuva). docs/design.md fica para o
   game-director depois da aprovação.
4. Rode npm test, npx tsc --noEmit, npm run build e npm run test:visual;
   olhe as capturas novas e as do tutorial (tutorial-step-1..6) em 844x390 e
   1366x768.

No final (e só no final), proponha ao usuário rodar em paralelo os agentes
de avaliação e espere o OK: test-reviewer, code-reviewer, sim-tester
(mesmos resultados de antes nas mesmas seeds; tempo por célula arrastada),
playtester (como quem nunca jogou: meta 3 sem perder e sem explicação, e
sabe dizer por que algo não funciona; celular 844x390 e PC), ui-designer
(camadas, legenda, prévias e linha legíveis no 844x390 e no PC) e
fun-critic (clareza ≥ 8). Traga os relatórios para o game-director decidir.
Não faça commit nem push; deixe tudo no working tree.
```

## 10. Prompt de implantação do Pacote 2
```
Implemente o Pacote 2 "O templo sempre cabe" descrito em
docs/revisoes/2026-11-02-2/plano.md (seção 6, itens 2.1 a 2.3). Só comece
com o Pacote 1 aprovado pelo usuário e com os números do item 2.3 aprovados
pelo game-director a partir do relatório do sim-tester. Você (agente
principal) implementa direto; não use agentes durante a implementação.
Nenhuma mecânica nova.

Ordem:
1. Core e dados, com testes Vitest junto de cada regra:
   - rules.json map.plaza (6x6, ponto de partida x 25..30, y 29..34, fora do
     raio do altar, dentro da área livre, encostada na coluna 24); plaza no
     GameState; só o Templo constrói ali ("Praça reservada ao Templo");
     ruas da coluna 24 de y 26 a 34 protegidas contra Limpar (se o usuário
     aprovou); a praça fora dos lugares verdes do tutorial e da Casa; teste
     em 500 seeds (livre, ligada, fora do raio do altar, templo cabe).
   - goals.json: meta 7 = 250 moradores, meta 8 = 8 casas grandes.
   - Item 2.3: só os números aprovados (prêmio da meta 3 e/ou
     debtMonthsToLose), ou nada se o item tiver saído.
2. Render: praça de pedra clara; brilho com a ferramenta Templo; prévia
   vermelha sobre a praça para o que não é Templo. Cores em palette.ts,
   textos em strings.ts.
3. Docs no mesmo trabalho: docs/GAME_DESIGN.md (Mapa, Início, Metas,
   Interface) e docs/TESTING.md (cenário temple-plaza).
4. Rode npm test, npx tsc --noEmit, npm run build e npm run test:visual e
   olhe temple-plaza e as capturas do tutorial em 844x390 e 1366x768.

No final (e só no final), proponha ao usuário rodar em paralelo os agentes
de avaliação e espere o OK: test-reviewer, code-reviewer, map-designer
(praça válida em todas as seeds), sim-tester (500 seeds por bot: distraído
não perde antes do mês 150 e perde ~60%, eficiente sem dívida, templo
sempre construível inclusive com ruas em grade, nenhuma partida presa
> 100 meses na meta 8 — se houver, propor meta 8 = 6 —, duração do comum em
minutos), playtester, ui-designer e fun-critic (clareza ≥ 8, curva e
vontade de jogar de novo). Traga os relatórios para o game-director decidir.
Não faça commit nem push; deixe tudo no working tree.
```

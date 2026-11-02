# Plano da revisão de 2026-11-02 (game-director), versão 2

Base: relatórios de playtester, sim-tester, fun-critic, ui-designer, sprite-artist, map-designer,
copywriter, code-reviewer e test-reviewer desta pasta; o backlog de `docs/design.md` ("Avisos a
tempo", "Cidade densa", candidatos); e a lista que o usuário capturou nos testes dele (playtest
real com uma jovem que nunca jogou, 12 simulações e partidas pela tela).
Esta versão substitui a primeira. O antigo Pacote 1 ("Felicidade que se sente") **não foi
aprovado** e passa a ser o Pacote 3. Três partes dele sobem: carinha só depois do Jardim (P1),
bugs pequenos (P1), economia uma vez por sync e conselho do aviso de saldo (P2).

## 1. Resumo (como o jogo está hoje)
1. Estável e bonito: 115 testes, build e 17 cenários visuais passam. A cidade viva tem nota 9. Nenhuma invariante quebra em 3 bots × 8 seeds × 400 meses.
2. **Quem nunca jogou não consegue jogar sozinho.** A jovem do playtest gostou, mas perdeu várias vezes e só jogou depois que alguém explicou. Ela não entendeu a ligação com o altar, o poço nem o mercado. Construiu tudo de uma vez e entrou em dívida.
3. O começo pune cedo e fica parado: a manutenção é cobrada antes de existir população, e o Distraído perde em ~1 min 20 s. As primeiras famílias levam ~7 meses para chegar, e as ferramentas não têm nome. Os balões de gota e de mercado escondem os avisos que importam.
4. A partida é curta e o fim não tem destino: o Comum vence no mês 64 (~1,3 a 2,5 min), e sobram 20–30 mil de prata. Em ruas em grade, o templo pode ficar sem lugar 6 x 6 para sempre.
5. A Felicidade está ligada, mas não pesa: o imposto varia ~3%, a carinha nasce triste e o Jardim é enfeite. Há também um custo O(N²) por sync que vai pesar no celular.

## 2. Consensos (duas ou mais fontes)
- **Regras invisíveis para o novato** (ligação ao altar, poço, mercado): playtest real, fun-critic (clareza 5–6), playtester (confusões), ui-designer.
- **Começo punitivo**: manutenção desde o mês 0 (lista do usuário, sim-tester: derrotas entre os meses 35 e 46, quase todas na meta 4) e carinha triste antes de o jogador ter remédio (playtester, sim-tester, fun-critic, code-reviewer).
- **Jogo curto, metas que se cumprem sozinhas, prata sem destino**: lista do usuário, sim-tester, fun-critic.
- **Templo sem lugar**: lista do usuário (preso para sempre com ruas em grade), sim-tester (o Comum só tem lugar ao liberar em 45 de 199 partidas), fun-critic (4 de 20).
- **Excesso de balões e avisos mal priorizados**: lista do usuário, ui-designer (a gota esconde a tristeza), playtester.
- **Custo O(N²) de `balloonNeed`/`houseInfo` → `computeEconomy`**: playtester, code-reviewer, test-reviewer.
- **Aviso de saldo com conselho errado** (manda demolir quando o maior gasto é Campo ou Templo): playtester, copywriter.
- **Felicidade irrelevante na economia**: sim-tester, fun-critic, playtester.
- **Bugs do Ambient e das Opções**: playtester, code-reviewer, sprite-artist, map-designer, ui-designer.
- **Textos fora de `strings.ts` e números da placa pequenos ou estourando**: copywriter, code-reviewer, ui-designer, playtester.

## 3. Conflitos e decisões
| Tema | Posições | Decisão e motivo |
|---|---|---|
| O que vem primeiro | Plano v1: Felicidade. Usuário: a lista dele | **A lista do usuário primeiro (P1 e P2).** Motivo: é a única evidência com o público real, e fere o pilar 1 (ninguém entende em 1 min). A Felicidade vira o P3 |
| Nomes nas ferramentas | Decisão anterior: "só ícone, nome na linha de informação". Usuário: nome embaixo do ícone | **Nome embaixo do ícone**, com o custo. Motivo: no celular não existe "passar o mouse"; a decisão anterior foi tomada sem playtest |
| Manutenção desde o mês 0 | Decisão anterior: "valores baixos mantêm o começo leve". Usuário: só depois da meta 2 | **`upkeepStartsAfterGoal` 2.** Motivo: o playtest e as 4 derrotas em ~1 min 20 s mostram que o começo não está leve. Não é mecânica nova: é a mesma regra, ligada por meta (pilar 5) |
| Mês 1,2 s → 2,0 s | Decisão anterior: o mês lento vira tempo morto. Usuário: 2,0 | **2,0 entra**, junto com famílias iniciais 3x mais rápidas. Motivo: o novato precisa de tempo para ler e reagir. O tempo morto do começo some com o tutorial e com a chegada rápida. A velocidade 3x continua lá para quem já sabe jogar |
| Passo 7 do tutorial (saldo) × manutenção depois da meta 2 | Os dois vêm do usuário | **O passo 7 vira mini passo na meta 2**, no mesmo momento em que a manutenção começa. Antes disso não há saldo para mostrar. Na meta 2 também chega o mini passo do Mercado: primeiro o saldo, depois o Mercado, nunca os dois juntos |
| Meta 8 "4 → 8 casas grandes" | Usuário: 8. sim-tester: com 6 grandes, 5 a 10 de 200 partidas travam, porque o raio do altar não comporta | **Entra com rede de segurança**: a praça do templo fica fora do raio do altar, a prévia mostra "aqui: até Casa grande" e o sim-tester mede. **Se alguma partida ficar presa mais de 100 meses na meta 8 (500 seeds), cai para 6.** Motivo: a meta tem que ser sempre possível |
| Meta 7: "8 casas felizes" (plano v1) × "250 moradores" (usuário) | — | **250 moradores agora.** A meta de casas felizes vai para o P3 no lugar da meta 5 (80 moradores, que se cumpre sozinha), logo depois da meta que libera o Jardim |
| Comum vence em 15–25 min | Usuário: alvo. Medido: Comum no mês 64, que dá 2,1 min com o mês de 2,0 s. Para 15 min seriam ~450 meses | **Não dá para alcançar nestes 2 pacotes** (estimativa depois do P2: ~3 a 4 min de simulação). Proposta: alvo intermediário de simulação ≥ 4 min e sessão humana ≥ 10 min; os 15–25 min vêm do conteúdo (P3 Felicidade, P4 Festa, depois pedidos e eventos). **Pergunta ao usuário** |
| Distraído: ~60% de derrota × "não perde antes de 5 min" | Os dois vêm do usuário | **Mantém os dois**: pode perder, mas não antes de 5 min (mês 150 com 2,0 s). O sim-tester mede com `upkeepStartsAfterGoal`, `debtMonthsToLose` e o prêmio da meta 3, e propõe os números. Se não fechar, volta ao game-director. Confirmar com o usuário |
| Aviso "na primeira vez que o saldo ficar negativo" × "Avisos a tempo: saldo só quando aperta" | — | **Os dois**: um toast ensina uma vez por partida, e a etiqueta só aparece quando aperta (prata + 12 × saldo < 0) |
| Balão triste | Spec: aparece quando não falta outra exigência | Ele não trava a casa, então **só aparece com Ver**. Balões sempre visíveis: só sem rua, sem trabalhadores e fome |
| Templo só na praça? | Proposta: só o Templo ocupa a praça | **A praça é só do Templo, mas o Templo pode ir a qualquer lugar válido.** Motivo: onde pôr o templo (raio 12) continua sendo uma escolha (pilar 3); a praça garante que ele sempre caiba |
| Onde mora o tutorial | — | **As condições de cada passo ficam no core** (puras e testadas); o fluxo, as setas e a câmera ficam no render. Os passos estão em `src/data/tutorial.json` e os textos em `strings.ts` |
| Carinha triste no começo | Plano v1: a felicidade inteira liga com o Jardim | **Sobe para o P1 só a parte "liga com o Jardim"** (carinha escondida e fatores 1 antes da Meta 4). Motivo: o novato do tutorial não pode ver uma carinha vermelha que não tem como resolver (critério de clareza ≥ 8). O resto da Felicidade fica no P3 |
| Altar/templo na felicidade | Plano v1: tirar. Usuário: não respondeu | **Fica em aberto até o P3.** Não afeta o P1 nem o P2 |
| Incêndio nos balões | Usuário: "no futuro" | Fora: essa mecânica não existe. A lista de balões que travam já deixa lugar para ele |

## 4. Pacote 1: "Primeira partida sem ajuda" (implantar agora)
Mecânica nova: **nenhuma**. Tutorial, nomes, a manutenção ligada por meta, ritmo do começo, carinha
escondida até o Jardim e bugs pequenos.
Pilares: fortalece o 1 (entender sem ninguém explicar) e o 5 (manutenção e felicidade liberadas
por meta). O 2 fica neutro ou melhora (a família chega logo). Nenhum pilar enfraquece.

### 1.1 Tutorial guiado na primeira partida
- Origem: lista do usuário (proposta 1, evidência A), fun-critic (clareza 5–6), playtester.
- Por que agora: sem ele, o público-alvo não passa da primeira partida.
- Regras (versão mais simples):
  - Cada passo tem uma frase e uma seta ou mão animada apontando onde tocar. O passo só avança quando o jogador faz a ação. Durante o tutorial, só a ferramenta do passo fica liberada (as outras ficam cinza, sem "Meta N"). Ver, câmera e velocidade continuam livres.
  - Passos:
    1. Rua: "Puxe uma rua saindo do altar". Um caminho fantasma de 6 células, numa direção livre do anel, é escolhido pelo core. Conclui com +4 células de rua ligadas ao altar, em qualquer lugar.
    2. Casa: "Construa 3 casas encostadas na rua". Os terrenos válidos ficam verdes. Conclui com 3 casas ligadas.
    3. Sem ferramenta: "Uma família está chegando!" A câmera acompanha a família por 2 s. Conclui com o primeiro morador.
    4. Campo: "Construa um campo para o povo comer". Conclui com 1 campo ligado.
    5. Poço: "Construa um poço perto das tendas". A prévia mostra o raio e "Atende N casas", com as casas atendidas destacadas. Conclui com 1 poço ligado.
    6. Sem ferramenta: "Veja: as tendas perto do poço viram casas de barro". Conclui com 1 casa de nível 2. Depois disso, as ferramentas liberadas voltam.
  - Mini passos (só para quem não pulou):
    - Ao cumprir a meta 2: seta na prata, "Agora poços, campos, mercados e oficinas custam prata por mês. Fique de olho no saldo." Conclui com um toque.
    - Logo depois, seta no Mercado: "Casas de barro com mercado perto viram casas de pedra". A prévia mostra o raio e as casas atendidas. Conclui com 1 mercado ligado.
  - Botão "Pular tutorial" sempre visível. Se o jogador pular, a mensagem da manutenção aparece mesmo assim, como toast.
  - A conclusão fica gravada em `localStorage` (`jerusalem.tutorialDone`), com try/catch. Se o armazenamento falhar, o tutorial volta na próxima partida, e pular continua funcionando.
  - A tela inicial ganha o botão "Ver tutorial de novo" (aparece só depois de feito), que começa um jogo novo com o tutorial.
- "Atende N casas" vale na prévia de Poço, Mercado e Jardim (é um item de "Avisos a tempo" que sobe para cá, porque o passo 5 precisa dele).
- Arquivos e dados:
  - `src/core/tutorial.ts` (novo: passos, `tutorialStepDone`, `ghostRoad`, `servedHouses`)
  - `src/data/tutorial.json` (passo, ferramenta, condição, alvo)
  - `src/data/visual.json` (`tutorialFollowSeconds` 2, tamanho da seta e da mão)
  - `src/render/Tutorial.ts` (novo), `UIScene.ts`, `GameScene.ts`, `Toolbar.ts`, `tools.ts`, `strings.ts`
  - `tests/tutorial.test.ts`
  - `docs/GAME_DESIGN.md`, `docs/TESTING.md`
- Aceite:
  - Cada passo conclui só com a sua ação (há teste para cada condição).
  - O caminho fantasma é válido em 100 seeds.
  - Pular e repetir funcionam, e com `localStorage` bloqueado o jogo não quebra.
  - Cenários visuais: `tutorial-step-1` a `tutorial-step-6`, `tutorial-saldo` e `tutorial-market`, no celular 844 x 390 e no PC 1366 x 768.

### 1.2 Nomes nas ferramentas
- Origem: lista do usuário (proposta 7, evidência B).
- Por que agora: o tutorial aponta para os botões, e o jogador precisa ler o nome.
- Regra: todos os botões dos dois trilhos (Ver, Rua, Limpar, Jardim, girar, as construções) mostram o nome embaixo do ícone. As construções mostram também o custo. Se faltar altura, o botão cresce ou o ícone encolhe; o nome nunca é cortado. Os nomes ficam em `strings.ts`.
- Arquivos: `src/render/Toolbar.ts`, `layout.ts`, `strings.ts`, `docs/GAME_DESIGN.md` (substitui a decisão "só ícone").
- Aceite: nome com pelo menos 16 px do jogo (~11 px de tela no 844 x 390) e alvo de toque ≥ 44 px de tela no 844 x 390 e no 800 x 360. Conferir nas capturas `hud-phone*` e `hud-pc*`.

### 1.3 Manutenção só depois da meta 2
- Origem: lista do usuário (proposta 4a, evidências A e B).
- Por que agora: é a causa das derrotas do começo, e o tutorial termina antes da meta 2.
- Regras:
  - `rules.json` ganha `"upkeepStartsAfterGoal": 2`. Antes disso, nenhuma manutenção é cobrada, o +X/mês da barra não a desconta, e não há dívida nem aviso de saldo.
  - A prévia e a dica mostram "manutenção 3/mês depois da Meta 2".
  - Ao cumprir a meta 2, aparece a mensagem do usuário (mini passo do 1.1, ou toast para quem pulou).
- Arquivos: `src/core/economy.ts`, `state.ts`, `index.ts`, `src/data/rules.json`, `src/render/strings.ts`, `info.ts`, `tests/economy.test.ts`, `docs/GAME_DESIGN.md`.
- Aceite:
  - Teste: sem cobrança antes da meta 2, cobrança no primeiro mês depois dela.
  - Teste: o evento da mensagem dispara uma vez só.

### 1.4 Ritmo do começo
- Origem: lista do usuário (proposta 6, evidência B).
- Regras:
  - `rules.json` `monthSeconds` 1,2 → **2,0**.
  - Novo `earlyFamilySpeedMultiplier` **3**: as famílias garantidas andam `familyCellsPerMonth × 3`. Com a rua inicial de 22 células, a primeira tenda é ocupada em até 2 meses.
  - As metas 7 e 8 ficam para o P2 (ver o 2.5).
- Arquivos: `src/data/rules.json`, `src/core/families.ts`, `tests/families.test.ts`, `docs/GAME_DESIGN.md`.
- Aceite:
  - Teste: a família garantida chega 3x mais rápido; as outras andam na velocidade normal.
  - Primeiro morador no mês ≤ 2 em 100 seeds.

### 1.5 Carinha só depois do Jardim
- Origem: plano v1 (4.1, parte), playtester, sim-tester, fun-critic, code-reviewer.
- Por que agora: o novato vê a carinha vermelha no mês 1 sem ter como resolver, o que fere a clareza (pilar 1) e o pilar 5.
- Regra: antes de `unlocked.garden`, a casa não tem partes de felicidade, o humor é contente e os fatores são 1. A carinha some da placa e não há balão triste. A fórmula atual não muda (o degrau e o altar ficam para o P3).
- Arquivos: `src/core/happiness.ts`, `economy.ts`, `families.ts`, `src/render/Hud.ts`, `tests/happiness.test.ts`, `docs/GAME_DESIGN.md`.
- Aceite:
  - Teste: antes da Meta 4, o imposto e as famílias ficam iguais aos de uma cidade sem Felicidade.
  - Captura `hud-phone` sem carinha no começo.

### 1.6 Bugs pequenos e visíveis
- Origem: plano v1 (4.5), playtester, code-reviewer, ui-designer, sprite-artist, map-designer.
- Por que agora: o quadrado preto ao lado de 1/3 das tendas aparece no passo 2 do tutorial.
- Correções:
  - `Ambient.ts`:
    - `>>>` no lugar de `>>` (quadro −1 dos bichos)
    - `keepIfRoom` para grupos que já existem
    - chave do quintal com a célula
    - lavadeiras e barcos medidos do centro do altar (23,5; 23,5), em distância euclidiana
    - lavadeira virada para o lado do rio
    - `tx` do barco pela linha atual
  - `MapView.ts:556`: ondinha do rio com `>>>`.
  - `Options.ts`: zona de toque do tamanho do painel.
  - `GameScene.ts`: comentário "New map, new seed" no lugar certo.
  - `docs/TESTING.md`: o Jardim no `leftButton`.
- Aceite:
  - O cenário `ambient` confere que nenhum animal usa `__MISSING`.
  - Tocar no título das Opções não troca a ferramenta.

### Critérios de aceite do Pacote 1 (gerais do usuário que se aplicam já)
- **playtester**, jogando como quem nunca jogou e só faz o que a tela pede, chega à **meta 3 sem perder e sem explicação externa**, no celular 844 x 390 e no PC.
- **sim-tester**:
  - nenhuma derrota antes da meta 2
  - eficiente vence sem dívida
  - o Distraído é medido com o mês de 2,0 s (o alvo "não perde antes de 5 min" fecha no P2)
  - mede a duração em minutos com 2,0 s
- **ui-designer**: setas, mão, destaques e nomes legíveis no **844 x 390** e no PC 1366 x 768.
- **fun-critic**: nota de clareza do objetivo **≥ 8** (se ficar abaixo, o que faltar entra no P2).
- `npm test`, `npx tsc --noEmit`, `npm run build` e `npm run test:visual` passam, e as capturas novas foram olhadas.

## 5. Pacote 2: "Ver antes de construir" (implantar depois do P1 aprovado)
Mecânica nova: **nenhuma**. Prévias, destaques, avisos, a praça reservada (regra de lugar), metas e
desempenho.
Pilares: fortalece o 1 e o **3** (o jogador vê, antes de construir, até onde o lugar leva a casa e
quanto o serviço custa). Risco para o 1: chão poluído. Controle: as camadas aparecem só com a
ferramenta ativa.

### 2.1 Conexão sempre visível
- Origem: lista do usuário (proposta 2, evidência A). Já existe: rua desligada apagada e tracejada, com toast.
- Regras:
  - A prévia da rua fica verde quando liga ao altar e vermelha quando não liga, com "não liga ao altar" acima do dedo.
  - Ao tocar com Ver numa construção sem rua, uma linha pontilhada vai até a célula de rua ligada mais próxima (função do core `nearestNetworkCell`).
- Arquivos: `src/core` (função e teste), `src/render/MapView.ts`, `strings.ts`.
- Aceite: teste da célula mais próxima; capturas `road-preview-ok`, `road-preview-loose` e `unlinked-line`.

### 2.2 Necessidades à vista e menos balões
- Origem: lista do usuário (proposta 3, evidências A e B), ui-designer.
- Regras:
  - Com a ferramenta Casa ativa, o chão mostra a área do poço em azul e a do mercado em laranja. O dourado do altar e do templo já existe. Uma legenda curta fica na linha de informação.
  - A prévia da casa mostra o nível máximo possível ali ("aqui: até Casa de barro"), pela função do core `maxLevelAt`, a mesma que o `houseInfo` usa.
  - Balões sempre visíveis só para o que trava: sem rua, sem trabalhadores e fome. A gota aparece só com a ferramenta Poço ou com Ver na casa; o mercado só com a ferramenta Mercado ou com Ver; o altar só com a ferramenta Templo ou com Ver; a casa triste só com Ver.
- Arquivos: `src/core/houses.ts`, `src/render/MapView.ts`, `info.ts`, `strings.ts`, `palette.ts`, `tests/houses.test.ts`, `docs/GAME_DESIGN.md`.
- Aceite:
  - Testes de `maxLevelAt`.
  - Capturas `needs-overlay` (celular e PC) e `balloons-calm`: cidade de 40 casas sem nenhuma gota sem ferramenta, e o balão "sem rua" visível.

### 2.3 Saldo e comida antes do problema
- Origem: lista do usuário (proposta 4b, 4c), "Avisos a tempo" (backlog), plano v1 (4.5), playtester, copywriter.
- Regras:
  - A prévia de construção com manutenção mostra o saldo depois dela ("saldo +3/mês → −1/mês"), em vermelho se ficar negativo. Só aparece com a manutenção ativa.
  - Toast na primeira vez que o saldo ficar negativo (uma vez por partida).
  - A etiqueta de saldo aparece só quando aperta: prata + `deficitAlertMonths` (12) × saldo < 0.
  - O conselho é certo:
    - o "maior gasto" é escolhido só entre serviços que podem ser demolidos
    - sem casas: "construa casas para ganhar impostos"
    - sem serviço demolível: nenhum conselho de demolir
  - Aviso antes da fome: comida caindo e durando menos de `foodAlertMonths` (8) → "Comida acaba em N meses: construa um campo". A ordem da etiqueta única fica: dívida, fome ou comida acabando, saldo, sem trabalho.
- Arquivos: `src/core/economy.ts` (alertas), `src/data/rules.json`, `src/render/strings.ts`, `info.ts`, `tests/economy.test.ts`, `docs/GAME_DESIGN.md`.
- Aceite: testes de cada condição de aviso (inclui o aviso de saldo com só um Campo e com o Templo); captura `preview-balance-red`.

### 2.4 Praça do templo
- Origem: lista do usuário (proposta 5, evidência B), sim-tester (6), fun-critic.
- Regras:
  - O mapa nasce com uma área 6 x 6 reservada (`plaza` no `GameState`), encostada na rua inicial, **fora do raio do altar** (para não roubar o lugar das casas grandes) e dentro da área livre. Ponto de partida: x 25..30, y 29..34, ao lado da rua da coluna 24. O map-designer valida depois.
  - Só o Templo constrói ali. A rua e as outras construções falham com "Praça reservada ao Templo".
  - O Templo continua podendo ir a qualquer lugar válido.
  - Desenho de praça de pedra clara. Com a ferramenta Templo, a praça brilha além dos lugares verdes que já aparecem.
- Arquivos: `src/core/map.ts`, `state.ts`, `types.ts`, `src/data/rules.json` (`map.plaza`), `src/render/MapView.ts`, `textures.ts`, `strings.ts`, `tests/map.test.ts`, `docs/GAME_DESIGN.md`.
- Aceite:
  - Em 200 seeds, a praça está livre, ligada à rede, fora do raio do altar, e o Templo cabe nela.
  - Teste: nada além do Templo é construído na praça.
  - Captura `temple-plaza`.

### 2.5 Metas mais longas
- Origem: lista do usuário (proposta 6).
- `goals.json`: meta 7 de 150 para **250** moradores; meta 8 de 4 para **8** casas grandes. Os prêmios não mudam. Se o sim-tester mostrar alguma partida presa mais de 100 meses na meta 8 (500 seeds), a meta 8 cai para 6.
- Arquivos: `src/data/goals.json`, `tests/goals.test.ts`, `docs/GAME_DESIGN.md`.

### 2.6 Desempenho (economia uma vez por sync)
- Origem: plano v1 (4.4), playtester, code-reviewer, test-reviewer.
- Por que agora: as prévias novas (nível máximo, atendidas, saldo) calculam a cada célula arrastada.
- Regras:
  - `computeEconomy` roda uma vez por sync. `balloonNeed(s, b, eco)` e `houseInfo(s, b, eco)` recebem a economia pronta.
  - `drawTrails` só redesenha quando as casas mudam.
  - `Walkers` só troca a textura quando a chave muda.
- Aceite: arrastar 1 célula com 122 construções leva < 0,5 ms no Node (hoje 3,8 ms), com resultados idênticos nos testes.

### Critérios de aceite do Pacote 2 (todos os gerais do usuário)
- **playtester** (novato, só o que a tela pede) chega à **meta 3 sem perder e sem explicação externa**.
- **sim-tester**, com 500 seeds por bot:
  - **distraído não perde antes de 5 minutos** (mês 150) e continua perdendo ~60% ao todo
  - **eficiente vence sem dívida**
  - **templo sempre construível** (nenhuma partida presa por lugar)
  - nenhuma partida presa na meta 8
  - **comum vence em 15 a 25 minutos**: medir e relatar. Esperado: não alcança (ver Conflitos). Aceitar o alvo intermediário se o usuário aprovar
- **ui-designer**: prévias, legendas, linha pontilhada e praça legíveis no **844 x 390** e no PC.
- **fun-critic**: clareza do objetivo **≥ 8**.
- `npm test`, `npx tsc --noEmit`, `npm run build` e `npm run test:visual` passam, e as capturas foram olhadas.

## 6. Pacotes seguintes (em ordem, um por vez)
**Pacote 3: "Felicidade que se sente" + acabamento** (o antigo P1, sem o que subiu para o P1 e o P2). Sem mecânica nova.
- Felicidade em degrau (feliz = `taxMax`, contente = 1, triste = `taxMin`; famílias pela média da cidade), com `idleMax` 10.
- **Altar/templo sai da felicidade? (pergunta ao usuário).**
- Meta 5 (80 moradores) vira "Tenha 8 casas felizes" (tipo `happyHouses`).
- Meta 3 com prêmio de 55 a 75, medido pelo sim-tester.
- Detalhe da carinha dinâmico.
- Placa: números abreviados ("45 mil") e trabalho "2/2 +17 sem vaga". Tocar em Comida ou Trabalho mostra o detalhe.
- Linha de informação em 2 linhas; meta cumprida em pílula verde; alvos ≥ 44 px no 800 x 360.
- Textos do copywriter, com os textos de `info.ts` e `tools.ts` movidos para `strings.ts`.
- Tela de derrota com a causa e uma dica (o resto de "Avisos a tempo").
- Arte: jardim com pérgola, vida na frente da casa feliz, noite mais azul, varal, cores em `palette.ts`.
- Testes do test-reviewer (4.8 do plano v1).

**Pacote 4: "Festa na praça" (mecânica nova).**
- Tocar no altar (ou no templo, ou na praça) e pagar prata e comida por uma festa que dá +felicidade à cidade por alguns meses. Tem espera para repetir e efeito maior com o Templo. É liberada por meta.
- Procissão e tochas são só efeito do render. Números em `rules.json`.
- Dá destino à prata que sobra (evidência B) e usa a praça do P2. Depende do P3 (a felicidade precisa pesar) e da aprovação do usuário.

**Pacote 5: "Cidade densa" (só aparência e mapa) + vitória com resumo.**
- Entregas A e B, já escopadas em `docs/design.md`.
- O que esta revisão somou:
  - bosques e afloramentos (map-designer 2)
  - rio pelo seed (3)
  - faixa livre e marco na entrada (4)
  - decoração pelo seed (5)
  - transição areia/grama, brilho e juncos no rio, poças de luz, trilhas em "L", blur menor e janelas (sprite-artist)
- A praça do P2 fica livre dos bosques.
- Vitória com mês do templo, felicidade média e maior população. Recorde local só de população e felicidade.

**Depois (candidatos, em ordem):**
1. Destino para a prata, parte 2: compra de terrenos ou decorações (só se a Festa não bastar).
2. Personalização: nome da cidade, decorações livres, modo foto.
3. Pedidos dos moradores.
4. Eventos leves e celeiro.
5. Felicidade parte 2: oficina entristece (em espera, a pedido do usuário).
6. Pasto.
7. História de Esdras e Neemias (ARA), só depois do playtest aprovar a mecânica.
8. Nível da cidade.
9. Painel de estatísticas.

## 7. Fora (não volta na próxima revisão sem fato novo)
- **Alongar a partida só com o mês mais lento ou metas gigantes**: 15–25 min vêm do conteúdo. Mês além de 2,0 vira tempo morto; metas gigantes travam.
- **Templo obrigatório na praça**: tira a escolha de lugar (pilar 3).
- **Câmera seguindo famílias além do passo 3 do tutorial**: tira o controle do jogador.
- **Tutorial com textos longos ou várias frases por passo**: o pilar 1 pede 1 frase.
- **Incêndio**: mecânica que não existe; não entra sem pedido.
- **Mais de um altar ou templo; lazer novo além do Jardim**: decisão do usuário.
- **Campo `silver` 1 → 0,5; `startFood` 40/45; `famineLeaveChance` 0,12; `happiness.famine` −15; `startSilver` 230**: medidos, não ajudam.
- **`taxMax` 1,4 e `familyMax` 2,0 na reta**: substituídos pelo degrau (P3).
- **Recorde de menor número de meses**: empurra pressa.
- **Gente nos telhados, terraços de plantação, colinas, lua**: só depois de "Cidade densa".
- **Instalar `@vitest/coverage-v8`**: só com ordem do usuário (dependência nova).

## 8. Perguntas em aberto para o usuário
1. Aprova o **Pacote 1** como está? (O Pacote 1 anterior, "Felicidade", não foi aprovado e virou o P3.)
2. Aprova levar para o P1 a **carinha escondida até o Jardim** (1.5)? É do plano antigo, não da sua lista.
3. **Altar/templo saem da felicidade** no P3? Sem eles, o Jardim é o que deixa a casa feliz.
4. **Duração**: "comum vence em 15–25 min" não dá para alcançar no P1 e no P2 (estimativa de ~3 a 4 min de simulação a 2,0 s). Aceita o alvo intermediário (simulação ≥ 4 min, sessão humana ≥ 10 min), deixando 15–25 para depois do P3 e do P4? Os 15–25 min são de jogo humano ou de simulação?
5. **Distraído**: continua o alvo de ~60% de derrota, agora sem nenhuma derrota antes de 5 min?
6. **Meta 8**: se 8 casas grandes travar partidas, aceita cair para 6?
7. **Festa na praça** como próxima mecânica nova (P4)?

## 9. Prompt de implantação do Pacote 1
```
Implemente o Pacote 1 "Primeira partida sem ajuda" descrito em
docs/revisoes/2026-11-02/plano.md (seção 4, itens 1.1 a 1.6). Você (agente
principal) implementa direto; não use agentes durante a implementação.
Nenhuma mecânica nova. Nada de história.

Ordem:
1. Core e dados, com testes Vitest junto de cada regra:
   - rules.json: monthSeconds 2.0, earlyFamilySpeedMultiplier 3,
     upkeepStartsAfterGoal 2 (sem manutenção, dívida nem aviso de saldo antes
     da meta 2; evento único ao começar a cobrar).
   - Felicidade só com o Jardim liberado (antes: sem partes, contente,
     fatores 1). Fórmula atual mantida; altar continua.
   - src/core/tutorial.ts + src/data/tutorial.json: passos 1–6 e mini passos
     (saldo na meta 2, depois Mercado), condições puras, caminho fantasma de
     6 células numa direção livre do anel, servedHouses para "Atende N casas"
     (Poço, Mercado, Jardim).
2. Render e interface:
   - src/render/Tutorial.ts: seta/mão animada, 1 frase por passo, só a
     ferramenta do passo liberada (Ver, câmera e velocidade livres), câmera
     segue a família 2 s (visual.json), "Pular tutorial", localStorage
     jerusalem.tutorialDone com try/catch, "Ver tutorial de novo" na tela
     inicial (jogo novo com tutorial).
   - Prévia de Poço/Mercado/Jardim com raio, casas atendidas e "Atende N
     casas"; dica "manutenção N/mês depois da Meta 2".
   - Nome embaixo do ícone em todos os botões dos dois trilhos, com custo nas
     construções; nome ≥ 16 px do jogo; toque ≥ 44 px de tela no 844x390 e
     800x360.
   - Carinha escondida antes do Jardim.
   - Bugs do 1.6 (Ambient >>>, keepIfRoom, quintal, lavadeiras/barcos pelo
     centro do altar, flip da lavadeira, tx do barco, ondinha do rio,
     zona de toque das Opções, comentário do GameScene).
   - Todo texto novo em src/render/strings.ts.
3. Docs no mesmo trabalho: docs/GAME_DESIGN.md (tutorial, manutenção depois
   da meta 2, ritmo, nomes nas ferramentas, felicidade com o Jardim) e
   docs/TESTING.md (cenários tutorial-step-1..6, tutorial-saldo,
   tutorial-market, leftButton com Jardim). docs/design.md fica para o
   game-director depois da aprovação.
4. Rode npm test, npx tsc --noEmit, npm run build e npm run test:visual;
   olhe as capturas novas e hud-phone*, hud-pc*, ambient, nos tamanhos
   844x390 e 1366x768.

No final (e só no final), proponha ao usuário rodar em paralelo os agentes
de avaliação e espere o OK: test-reviewer, code-reviewer, sim-tester
(500 seeds por bot com mês de 2,0 s: nenhuma derrota antes da meta 2,
eficiente sem dívida, minutos por meta, mês da primeira derrota do
Distraído), playtester (como quem nunca jogou, só fazendo o que a tela pede:
chegar à meta 3 sem perder e sem explicação; celular 844x390 e PC 1366x768),
ui-designer (setas, destaques e nomes legíveis no 844x390 e no PC) e
fun-critic (nota de clareza do objetivo ≥ 8). Traga os relatórios para o
game-director decidir. Não faça commit nem push; deixe tudo no working tree.
```

## 10. Prompt de implantação do Pacote 2
```
Implemente o Pacote 2 "Ver antes de construir" descrito em
docs/revisoes/2026-11-02/plano.md (seção 5, itens 2.1 a 2.6). Só comece com
o Pacote 1 aprovado pelo usuário. Você (agente principal) implementa direto;
não use agentes durante a implementação. Nenhuma mecânica nova.

Ordem:
1. Core e dados, com testes Vitest junto de cada regra:
   - Desempenho primeiro (2.6): computeEconomy uma vez por sync;
     balloonNeed/houseInfo recebem a economia pronta.
   - nearestNetworkCell; maxLevelAt (usado também pelo houseInfo).
   - Alertas: comida acabando (foodAlertMonths 8), saldo só quando aperta
     (deficitAlertMonths 12), conselho só com serviços demolíveis, evento de
     primeiro saldo negativo; ordem dívida, fome/comida, saldo, sem trabalho.
   - Praça do templo: rules.json map.plaza (6x6, encostada na rua inicial,
     fora do raio do altar, dentro da área livre; ponto de partida x 25..30,
     y 29..34); só o Templo constrói ali; teste em 200 seeds.
   - goals.json: meta 7 = 250 moradores, meta 8 = 8 casas grandes.
2. Render e interface:
   - Prévia da rua verde/vermelha com "não liga ao altar"; linha pontilhada
     até a rua ligada mais próxima ao tocar com Ver numa construção sem rua.
   - Com Casa ativa: áreas de poço (azul) e mercado (laranja) no chão,
     legenda na linha de informação; prévia "aqui: até Casa de barro".
   - Balões sempre visíveis só sem rua, sem trabalhadores e fome; gota,
     mercado, altar e triste só com a ferramenta correspondente ou com Ver.
   - Prévia com saldo "+3/mês → −1/mês" (vermelho se negativo), toast na
     primeira vez que o saldo ficar negativo.
   - Praça de pedra clara; destaque com a ferramenta Templo.
   - Cores em palette.ts, textos em strings.ts.
3. Docs no mesmo trabalho: docs/GAME_DESIGN.md e docs/TESTING.md (cenários
   road-preview-ok, road-preview-loose, unlinked-line, needs-overlay,
   balloons-calm, preview-balance-red, temple-plaza).
4. Rode npm test, npx tsc --noEmit, npm run build e npm run test:visual e
   olhe as capturas novas em 844x390 e 1366x768.

No final (e só no final), proponha ao usuário rodar em paralelo os agentes
de avaliação e espere o OK: test-reviewer, code-reviewer, sim-tester (500
seeds por bot: distraído não perde antes de 5 min = mês 150 e perde ~60% ao
todo, comum vence em 15–25 min (medir e relatar), eficiente sem dívida,
templo sempre construível, nenhuma partida presa > 100 meses na meta 8 —
se houver, propor meta 8 = 6), playtester (novato chega à meta 3 sem perder
e sem explicação), ui-designer (legível no 844x390 e no PC) e fun-critic
(clareza do objetivo ≥ 8). Traga os relatórios para o game-director decidir.
Não faça commit nem push; deixe tudo no working tree.
```

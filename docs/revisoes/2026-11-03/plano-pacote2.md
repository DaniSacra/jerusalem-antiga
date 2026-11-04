# Plano do Pacote 2 "Anos que contam" (game-director, 2026-11-04)

Base: `sim-tester-pacote1.md`, `playtester-pacote1.md`, `docs/design.md` e a seção 5 do `plano.md`.
O Pacote 1 está no main (d390712 e 11a95cd). Nada de código, dados ou testes foi alterado por este
plano.

## 1. Onde estamos
- O Ano 1 ficou justo: Comum e Eficiente sobrevivem em 100%, a fome mediana é 0 e o tutorial perde
  0 de 16. O Pacote 1 cumpriu o que prometeu.
- Agora o problema é o contrário. Com o rebalanceamento a01a506 (comida 3x, campo dando comida
  toda semana fora do inverno), a comida sobra e a partida acaba em cerca de 2,5 min. As metas 1 a 4
  se cumprem em 9 semanas, a meta 3 dura 1 semana, o campo dá 89% da comida e de 19% a 42% dela
  estraga. O crescimento só espera o relógio da porta (`wait` em 41% das semanas).
- Isso fere o pilar 2 (ritmo contemplativo: cada crescimento conquistado) e o pilar 3 (ciclo do
  ano: com comida sobrando, preparar o inverno não pesa). O pilar 6 também perde, porque o campo é
  sempre a resposta e o rio e o bosque pouco importam.

## 2. Decisões sobre propostas e achados
| Item | Origem | Pilares | Decisão |
|---|---|---|---|
| Celeiro `upkeep` 2 → 1 | sim-tester, proposta 1 | + 1 (dívida rasa do inverno some) | **ENTRA AGORA.** Medido: a dívida do Comum no Ano 1 cai de 6 para 3, sem mudar vitórias nem duração |
| Altar `radius` 3 → 4 | sim-tester, proposta 2 | + 1 (meta 10 destrava); o pilar 6 se mantém (casa grande ainda pede lugar) | **ENTRA AGORA.** É a única trava real do jogo (Eficiente preso 3 → 0). Com 4 o raio ainda não cobre a cidade, ao contrário do 5 que tiramos |
| Meta 9 150 → 130 | sim-tester, proposta 3 (ele mesmo não recomenda) | − 2 (encurta o jogo) | **FORA.** O jogo já está curto; a meta 9 é lenta, não travada |
| Jogo curto (2,5 min) | sim-tester, achado 1 | − 2, − 3 | **ENTRA AGORA** como números: menos comida do campo (2.1) e porta mais espaçada (2.2) |
| Metas 1–4 em 9 semanas, meta 3 em 1 semana | sim-tester, playtester | − 2, − 4 (3 toasts dentro do tutorial) | **ENTRA AGORA:** a meta 3 vira "Colha 100 de comida" (2.3) |
| Campo domina e a comida estraga | sim-tester, achado 2 | − 3, − 6 | **ENTRA AGORA:** `harvest` 468 → 312 (2.1). A regra do campo (comida fora do inverno) fica: é decisão do usuário (a01a506) |
| Desemprego no inverno | sim-tester, achado 3 | − 4 (aviso que mente), − 1 (oficinas demais tiram gente do campo) | **ENTRA AGORA:** o campo congelado mantém as vagas na conta do desemprego (2.4). É correção de regra, não mecânica nova |
| Toast do Ano 2 "hora de plantar", "cheio" com 40/50, "até o inverno" | playtester | − 4 | **ENTRA AGORA** (2.5) |
| Câmera parada nos passos do campo e do poço | playtester | − 4 | **ENTRA AGORA** (2.6) |
| Bug 6: toasts cobrem o inspetor e o balão, a fila atrasa | playtester | − 4 | **ENTRA AGORA** (2.7) |
| Cidade fechada (bots fecham as pontas de rua) | sim-tester, achado 4 | neutro | **FICA COMO ESTÁ.** Demolir resolve, e o destaque do templo já mostra onde cabe. Rever se o fun-critic reclamar |
| Arte e prévia do "campo plantado tarde" (resto do 1.9) | plano.md | – | **FORA.** A regra mudou: todo campo dá comida na semana seguinte (fora do inverno). A contagem "inverno em N / primavera em N" já está na pílula |

## 3. O Pacote 2 antigo (seção 5 do `plano.md`)
O Pacote 2 antigo **muda**: os dados que o justificavam mudaram com o Pacote 1 e o a01a506. Seus
itens ficam assim:
| Item antigo | Decisão | Motivo |
|---|---|---|
| Mecânica "comida primeiro" (trabalhadores vão antes para pescador, coletora e campo) | **DEPOIS** | A espiral de vagas que a justificava sumiu: a dívida do Comum no Ano 2 caiu de 13/20 para 0/100. Volta só se o 2.1 a trouxer de volta |
| Duração (Comum ≥ 8 min) | **ENTRA**, com alvo intermediário de ≥ 4 min | É o foco deste pacote. Os 8 min dependem de conteúdo novo (Madeira, P3), e não de números |
| Seca anunciada no começo do outono | **FORA** | Ficou obsoleta: a seca é sorteada no começo do inverno, e o campo construído no inverno junto ao rio já vale para a primavera. O jogador tem 13 semanas para reagir |
| Garantia no gerador de pescador e coletora cheios | **DEPOIS (P3)** | O tutorial perde 0 de 16 e o Pescador (sem campos) vence 90%; não há falha medida |
| Equilíbrio pescador × campo | **ENTRA**, invertido | Hoje quem domina é o campo, não o pescador (2.1) |
| Tela de derrota com a causa | **DEPOIS (P3)** | As derrotas ficaram raras; não é o problema de agora |
| Arte da sobrevivência (culturas, celeiro cheio, rede, tendas de inverno) | **DEPOIS (P3)** | É só visual; não mexe no ritmo |
| Trava "casa só sobe com comida" | **FORA** | O poço deixou de ser armadilha: o motivo `water` caiu para 7–14% e a previsão já usa o nível alvo |

O Pacote 3 continua sendo **"Madeira"** (a próxima mecânica nova). Ele é também o destino da
prata parada (Comum chega a 2.700 sem nada para comprar) e o caminho dos 8 min. Recebe os itens
marcados DEPOIS (P3).

## 4. Pacote 2: "Anos que contam" (implantar agora)
Mecânica nova: **nenhuma**. Entram números (com uma grade curta medida pelo sim-tester), a
meta 3, uma correção de regra (desemprego no inverno), tutorial, textos e toasts.
Pilares: fortalece o 2 (crescer leva anos e cada família pesa), o 3 (o inverno e o celeiro voltam
a importar), o 6 (rio e bosque voltam a contar) e o 4 (avisos e textos dizem a verdade). O risco
para o 1 (Ano 1 apertar de novo) é controlado mantendo todos os aceites do Pacote 1.

### 2.1 O campo divide a comida
- **Origem:** sim-tester (achados 1 e 2). O plano.md pedia o "equilíbrio pescador × campo".
- **Por que agora:** com 12/sem por campo, a comida sobra, estraga e a porta só espera o relógio.
  Com isso não existe decisão de comida depois da semana 9.
- **Regra:** nenhuma mudança. O campo continua dando comida toda semana, menos no inverno.
- **Dados:** `buildings.json` campo `harvest` 468 → **312** (8/sem; 4 por trabalhador, perto do
  teto do pescador, que é 4,5 com 1 vaga). Grade do sim-tester: 312 e 360.
- **Arquivos:** `src/data/buildings.json`, os testes que fixam o número, `docs/GAME_DESIGN.md`.
- **Aceite:** o campo dá ≤ 75% da comida do Eficiente, e o estrago fica ≤ 15% no Comum e ≤ 25% no
  Distraído. Os aceites do Pacote 1 continuam valendo (seção 5).

### 2.2 Famílias mais espaçadas
- **Origem:** sim-tester (achado 1, porta em `wait` 41%).
- **Por que agora:** o relógio da porta é o que dita o tamanho do jogo. Hoje ele deixa chegar
  ~25 famílias por ano, e a vitória vem com 1 ano e 9 semanas. O alvo do design.md já era um Ano 1
  com 6 a 10 casas.
- **Regra:** nenhuma mudança.
- **Dados:** `rules.json` `familyIntervalWeeks` 2 → **3**. Grade do sim-tester: 3 e 4.
- **Arquivos:** `src/data/rules.json`, os testes que fixam o número, `docs/GAME_DESIGN.md`.
- **Aceite:** o Comum termina o Ano 1 com 6 a 10 casas com família (mediana) e vence em 96 a
  160 semanas (4 a 6,7 min).

**Como escolher na grade de 2.1 × 2.2** (4 combinações, todas com 2.3 e 2.8): fica a combinação
que cumpre todos os aceites da seção 5 com a menor mudança. A ordem de preferência é 312 + 3, depois
360 + 3, depois 312 + 4, depois 360 + 4. Se nenhuma cumprir, o sim-tester traz a mais próxima e o
game-director decide. Nenhum outro número entra sem aprovação.

### 2.3 Meta 3 que pede uma estação
- **Origem:** sim-tester (achado 1) e playtester (3 toasts dentro do tutorial).
- **Por que agora:** "Primeira colheita" com 12 de comida dura 1 semana e se cumpre dentro do
  tutorial. Com um alvo maior, o celeiro chega no fim do outono, a tempo do inverno, e a manutenção
  (que começa depois da meta 3) também começa mais tarde.
- **Dados:** `goals.json` meta 3 `target` 12 → **100**. O texto vira "Colha 100 de comida"
  (copywriter). Prêmio (+30) e o desbloqueio do celeiro ficam iguais.
- **Arquivos:** `src/data/goals.json`, `tests/goals.test.ts`, os testes de viabilidade e do
  tutorial que esperam a meta 3 no Ano 1, `docs/GAME_DESIGN.md`.
- **Aceite:** no Comum, a meta 3 se cumpre entre as semanas 8 e 16 (mediana) e leva ≥ 4 semanas
  depois da meta 2. O teste de viabilidade continua cumprindo as metas 1 a 3 no Ano 1.

### 2.4 Inverno não é desemprego
- **Origem:** sim-tester (achado 3): os bots constroem de 19 a 21 oficinas, e a meta pede 2.
- **Por que agora:** o aviso manda construir oficinas no inverno, e na primavera elas roubam os
  trabalhadores dos campos. É um aviso falso que leva a uma decisão ruim (pilares 1 e 4).
- **Regra:** o campo congelado (ligado, no inverno) continua contando as suas vagas em
  `unemployed`, `unemploymentAlert` e `idleShare` (alegria). A eficiência e a produção não mudam:
  no inverno o campo não produz e não ocupa ninguém de outra construção. Em uma frase: "no inverno,
  o agricultor descansa; não está desempregado".
- **Arquivos:** `src/core/economy.ts` (uma conta só de vagas do ano, usada pelas três funções),
  `tests/economy.test.ts`, `tests/alerts.test.ts`, `docs/GAME_DESIGN.md`.
- **Aceite:**
  - Teste: uma cidade com campos e 0 desempregados no outono continua com 0 no inverno, e o aviso
    não aparece.
  - Teste: a eficiência do pescador no inverno é a mesma de antes da mudança.
  - sim-tester: a mediana de oficinas por partida no Comum fica ≤ 6.

### 2.5 Textos e pílulas que não enganam
- **Origem:** playtester ("Ainda confunde").
- **Regras e textos** (frases finais com o copywriter, ≤ 75 caracteres):
  - Toast do outono: sai "hora de plantar os campos". Entra algo como "Outono: os campos voltam a
    dar comida".
  - Pílula de comida: "até o inverno" vira "acaba no inverno", e o mesmo para as outras estações.
  - "cheio" só aparece quando a comida vai estragar nesta semana (estoque + saldo da semana >
    capacidade). Sai o limite de 75% (`STOCK_SHOWN`). Se a regra pedir uma função, ela é pura e
    fica no core, com teste.
  - O texto do Campo e do tutorial passam a dizer 8/sem (ou o número escolhido em 2.1), sem número
    escrito à mão: vem dos dados.
- **Arquivos:** `src/render/strings.ts`, `src/render/nova/TopBar.ts`, `src/core/readouts.ts` (se
  precisar), `tests/readouts.test.ts`.
- **Aceite:** capturas da pílula com estoque a 40/50 (sem "cheio") e com estoque estragando ("cheio"),
  no 844 x 390 e no PC.

### 2.6 Câmera nos passos do campo e do poço
- **Origem:** playtester ("Ainda confunde"): as tendas ficam fora da tela no passo do poço.
- **Regras:**
  - Passo do poço: a câmera desliza até `campWellSpot` (as tendas ficam na tela), e a seta marca o
    lugar.
  - Passo do campo: a câmera desliza até um lugar livre de campo ligado à rede, o mais perto do
    altar. Ele vem de uma função pura nova em `src/core/tutorial.ts`, com teste.
  - O deslize obedece à correção do bug 2 (o pan zera quando o jogador move a câmera).
- **Arquivos:** `src/core/tutorial.ts`, `tests/tutorial.test.ts`, `src/scenes/GameScene.ts`,
  `docs/TESTING.md`.
- **Aceite:** teste do lugar do campo em 200 seeds (sempre existe, é ligável e livre). Capturas
  `tutorial-field` e `tutorial-well` no 844 x 390, com as tendas e a seta visíveis.

### 2.7 Toasts no lugar e na hora (bug 6)
- **Origem:** playtester (bug 6), ui-designer (revisão de 2026-11-03).
- **Regras:**
  - O inspetor segura a fila de toasts, como os painéis.
  - Um toast de aviso que espera na fila é descartado se o aviso já não vale quando chega a vez
    dele. Toasts iguais na fila viram um só.
  - A seta do tutorial não cobre o rótulo da prévia.
- **Arquivos:** `src/render/Toasts.ts`, `src/render/nova/NovaUi.ts`, `src/render/Tutorial.ts`.
- **Aceite:** captura com o inspetor aberto e um toast chegando (o toast espera). Teste visual: um
  aviso que some antes da sua vez não aparece.

### 2.8 Números medidos que entram sem grade
- **Dados:** `buildings.json` celeiro `upkeep` 2 → **1**; altar `radius` 3 → **4**.
- **Arquivos:** `src/data/buildings.json`, testes que fixam os números, `docs/GAME_DESIGN.md`.
- **Aceite:** está na seção 5 (dívida no Ano 1 e seeds presas).

## 5. Critérios de aceite do Pacote 2
- **sim-tester** (`npm run sim`, 100 seeds por bot, até a semana 400):
  - Continuam valendo do Pacote 1: Comum e Eficiente sobrevivem ao Ano 1 em ≥ 95%; Comum com
    mediana de fome ≤ 4 semanas no Ano 1; Eficiente sem dívida e com ≥ 85% de vitórias; Distraído
    chega ao Ano 2 em ≥ 50%; caravana de 4 não é pior que a de 2.
  - Dívida do Comum no Ano 1 ≤ 5%.
  - **Duração:** o Comum vence com mediana de 96 a 160 semanas (4 a 6,7 min a 1x), e o Eficiente
    com ≥ 84 semanas (3,5 min).
  - **Ritmo:** no Comum, nenhuma meta de 2 a 10 se cumpre em ≤ 2 semanas depois da anterior
    (mediana), salvo a meta 4 (construir o celeiro); e as metas 1 a 4 não se cumprem todas antes da
    semana 13.
  - **Ano 1:** o Comum termina com 6 a 10 casas com família (mediana).
  - **Comida:** o campo dá ≤ 75% da comida do Eficiente; o estrago fica ≤ 15% no Comum e ≤ 25% no
    Distraído.
  - **Oficinas:** mediana ≤ 6 por partida no Comum.
  - **Seeds presas > 52 semanas num objetivo:** Eficiente 0 e Comum ≤ 5. O Distraído só é relatado:
    ele pode ficar preso, porque é o jogador que não cuida da cidade.
  - Relatar: a maior prata parada antes da vitória (entrada para o P3) e os motivos da porta no
    Ano 1 e no Ano 2.
- **playtester:** o bot do tutorial perde ≤ 1 de 16 no Ano 1; a câmera mostra as tendas no passo do
  poço e o lugar no passo do campo; nenhum toast cobre o inspetor nem o balão do tutorial; nenhum
  toast velho. Celular 844 x 390 e PC.
- **fun-critic** (não rodou no Pacote 1): curva ≥ 6, sempre algo a fazer ≥ 6, vontade de jogar de
  novo ≥ 6 e clareza ≥ 7. Ele diz também se o tempo de espera entre famílias parece "tempo morto".
- `npm test`, `npx tsc --noEmit`, `npm run build` e `npm run test:visual` passam, e as capturas novas
  e as do tutorial foram olhadas.

## 6. Estimativa
| Bloco | Itens | Tempo (uma pessoa) |
|---|---|---|
| Números, meta 3 e testes que fixam números | 2.1, 2.2, 2.3, 2.8 | 1 a 1,5 h |
| Grade do sim-tester (4 combinações, 100 seeds) e escolha | 2.1, 2.2 | 1,5 a 2 h |
| Desemprego no inverno, com testes | 2.4 | 1 h |
| Textos e pílulas | 2.5 | 1 h |
| Câmera do tutorial e lugar do campo | 2.6 | 1,5 a 2 h |
| Toasts | 2.7 | 1,5 h |
| Docs, `test:visual`, olhar capturas | – | 1 h |
| sim-tester, playtester e fun-critic no final, com um ajuste se preciso | – | 1,5 a 2 h |

- **Total:** cerca de 10 a 12 h de trabalho de uma pessoa.
- **Numa sessão do Claude Code:** cerca de 3 a 4 h. A grade do sim-tester roda em paralelo com o
  render (2.5 a 2.7), e os três agentes do final rodam juntos.
- **Maior risco de prazo:** nenhuma combinação da grade cumprir ao mesmo tempo a duração e o Ano 1
  do Comum. Nesse caso, uma rodada a mais com o game-director (cerca de 1 h).

## 7. Fora deste pacote
- Meta 9 150 → 130 (encurta o jogo).
- Mecânica "comida primeiro" (a espiral sumiu; ver seção 3).
- Seca anunciada no outono (obsoleta), trava "casa só sobe com comida", arte e prévia do campo
  plantado tarde.
- Alongar com o Templo mais caro ou com metas gigantes (decisão de 2026-11-02, continua valendo).
- Destino para a prata parada: vem com a Madeira (P3).

## 8. Prompt de implantação do Pacote 2
```
Implemente o Pacote 2 "Anos que contam" descrito em
docs/revisoes/2026-11-03/plano-pacote2.md (seção 4, itens 2.1 a 2.8).
Nenhuma mecânica nova e nada de história.

Agentes:
- Implementação: você (agente principal) faz core, dados e testes.
- sim-tester: mede a grade de 2.1 x 2.2 (campo harvest 312 e 360 x
  familyIntervalWeeks 3 e 4), sempre com 2.3 (meta 3 = 100) e 2.8 (celeiro
  upkeep 1, altar radius 4), 100 seeds por bot, contra os critérios da
  seção 5. Escolhe pela ordem de preferência do plano e traz a tabela.
- ui-designer: câmera do tutorial (2.6), toasts (2.7) e a pílula "cheio"
  (2.5).
- copywriter: textos de 2.3 e 2.5 em strings.ts e goals.json, até 75
  caracteres, números lidos dos dados.
- test-reviewer: confere os testes de 2.4, 2.5 (se houver função nova) e
  2.6, e os testes que fixam números.
- code-reviewer: antes de terminar.

Ordem:
1. Dados de 2.3 e 2.8 e a regra 2.4 (desemprego conta o campo congelado),
   com testes Vitest.
2. sim-tester roda a grade de 2.1 x 2.2. Aplique a combinação escolhida em
   buildings.json e rules.json. Se nenhuma cumprir os critérios, pare e
   traga a tabela ao game-director.
3. Em paralelo com o passo 2: render e interface (2.5, 2.6, 2.7). Cores em
   palette.ts, textos em strings.ts, lugar do campo do tutorial como função
   pura no core, com teste.
4. Docs no mesmo trabalho: docs/GAME_DESIGN.md (campo, famílias, meta 3,
   celeiro, altar, desemprego, pílula, toasts, tutorial) e docs/TESTING.md
   (tutorial-field, tutorial-well, pílula cheio, toast com inspetor).
   docs/design.md fica para o game-director.
5. Rode npm test, npx tsc --noEmit, npm run build, npm run test:visual e
   npm run test:pwa; olhe as capturas novas e as do tutorial em 844x390 e
   1366x768.

No final rode, em paralelo: sim-tester (confirmação com a combinação
aplicada, 100 seeds), playtester e fun-critic, com os critérios da
seção 5. Traga os relatórios ao game-director. Qualquer número fora deste
plano só entra com a aprovação dele.

Não faça commit nem push sem uma ordem explícita do usuário.
```

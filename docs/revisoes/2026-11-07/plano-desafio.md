# Plano "Desafio e rumo" (game-director, 2026-11-07)

Pedido do usuário (2026-11-07): "o jogo está fácil demais e eu fico perdido sem saber o que fazer".
**Aprovado pelo usuário no mesmo dia, inteiro e nesta ordem**, com commit + push por parte (o agente
principal faz; nenhum subagente faz commit). As perguntas abertas foram respondidas pelo diretor com a
recomendação (o usuário pediu "faça tudo o que for recomendado").

Base: `docs/design.md`, `docs/GAME_DESIGN.md`, `docs/revisoes/2026-11-07/plano-backlog.md` (T0 e seção 1
"Gado"), `src/data/*.json` e `src/core/work.ts`, `goals.ts`, `firewood.ts` no 0e82a80. Medida de hoje
(`sim-tester-fim-sem-frio.md`): Comum vence 89–91% em ~33 min, 0 derrotas; Eficiente 100%.

Diagnóstico em uma frase por queixa:
- **Fácil**: o Comum não perde e quase sempre vence; o fim é só esperar moradores e juntar prata.
- **Perdido**: os objetivos do meio são marcos de espera ("criança virou adulta", "terceira geração",
  "chegue a 65") sem uma ação concreta, e o Templo só aparece no fim.

Resposta: o **Templo em etapas** vira a espinha da partida inteira (sempre há uma obra à frente), as
**Profissões** dão a decisão de quem trabalha onde (os construtores saem da cidade), a linha **"O que
fazer agora"** diz o próximo passo, e a **Dificuldade** deixa o Normal mais duro que hoje.

---

## 0. Ordem e decisão por pacote

Cada pacote vai sozinho para o main (commit + push por parte), com o sim-tester depois dos de jogo.
Uma mecânica nova por pacote.

| # | Pacote | Mecânica nova (uma) | Pilares | Decisão |
|---|---|---|---|---|
| T0 | Arrumação técnica | nenhuma | 8 viva (+, margem de desenho) | **ENTRA AGORA**: libera chamadas para o Templo e o Pasto |
| 1 | Painel de Profissões | Metas de trabalhadores por profissão | 7 simples (+: um painel em vez de ficha por ficha), 4 pessoas (+), 1 sobrevivência (+: tirar gente da comida custa) | **ENTRA AGORA**: sem ele, os construtores do Templo seriam um micro-gerenciamento pessoa por pessoa |
| 2 | Templo em etapas + "O que fazer agora" | Obra do Templo por etapas, com construtores | 6 camadas (+), 5 evoluir (+: uma obra que cresce), 3 contemplação (+: o Templo sobe à vista), 7 simples (+ pela linha) | **ENTRA AGORA**: é a resposta às duas queixas. A linha é interface, vai junto |
| 3 | Pacote C Gado | Pasto e gado | 9 posicionar (+), 8 viva (+) | **ENTRA AGORA**, como na seção 1 do `plano-backlog.md`, renumerado |
| 4 | Dificuldade | Escolha da dificuldade (multiplicadores) | 1 sobrevivência (+), 6 camadas (+: invernos piores com os anos) | **ENTRA AGORA**: por último, para calibrar o Normal com tudo dentro |

Respostas do diretor às perguntas abertas:
1. **Só o Templo tem obra com tempo.** As outras construções continuam instantâneas (KISS). O candidato
   "Obras com tempo" para o resto vira DEPOIS, só se o playtest pedir.
2. **Profissões por meta de trabalhadores** (o core honra a meta toda semana), não por movimentos
   soltos: com movimentos, o `assignJobs` devolveria a pessoa na semana seguinte.
3. **"Chamar trabalhador" no balão**: FORA. O painel substitui.
4. **Construtores trabalham o ano inteiro**, com o mesmo ritmo no inverno: o inverno vira a estação da
   obra (o lavrador parado no campo congelado pode ir para o Templo e voltar na primavera).
5. **Pagar a etapa inteira ao começar** (prata e materiais de uma vez), como qualquer construção hoje.
6. **O lugar do Templo é marcado de graça** quando ele é liberado (estacas e linha, como o terreno
   vazio); o Alicerce é pago depois, no balão. Assim o jogador reserva o lugar cedo.
7. **Gado**: pasto pelo capim livre em volta (sim); gado não é comida no inverno (não); objetivo
   "Construa um pasto" (sim).
8. **Dificuldade padrão: Normal**, escolhida no título; não muda no meio da partida.
9. Pacote B4, Recuperação, D1 e o resto do `plano-backlog.md` seguem depois da Dificuldade, na
   mesma ordem; "Obras com tempo" sai da fila (absorvido para o Templo).

---

## T0. Arrumação técnica (como no `plano-backlog.md`, linha 0)

- Sai `public/models/meshy/temple.glb` (o Templo é por código desde o C8) e o que o carrega.
- O kit de obra do terreno vazio (estacas, linha, trenó, malho) num só instanciado: a vista com 10
  terrenos vazios fica em **≤ 120 chamadas** (`view3d-perf.mjs`).
- Estabilizar o clique numa pessoa em `town3d-pc` e o `music3d-pc` (10 rodadas seguidas sem falha).
- Sem regra, número, texto nem teste do core.
- Dono: sprite-artist (kit e glb), agente principal (testes instáveis), code-reviewer. **3–6 h.**

---

## 1. Painel de Profissões

### 1.1 Regra (versão mais simples)
1. **Profissão = tipo de local de trabalho**: Pescador, Coletora, Lavrador (campo), Lenhador,
   Pedreiro (pedreira), Celeireiro (celeiro), Mercador (mercado), Artesão (oficina), Construtor (a
   obra do Templo, pacote 2), Pastor (pasto, pacote 3). Nomes finais com o copywriter.
2. **Cada profissão tem uma meta** (`s.jobTargets[kind]`): ou **automática** (sem chave no mapa = todas
   as vagas, o jogo de hoje) ou um **número** escolhido pelo jogador (0 até as vagas daquele tipo).
3. O `assignJobs` passa a honrar a meta toda semana e depois de cada mudança:
   - um tipo com mais gente que a meta solta quem **mora mais longe** (empate: id maior) para "Sem
     trabalho";
   - as vagas livres de tipos **abaixo da meta** vão ao adulto livre que mora mais perto, com os tipos
     na ordem `jobPriority` (igual a hoje). Ninguém com trabalho é movido pelo jogo para outro tipo.
4. **−** num tipo: meta = mín(meta, pessoas nele) − 1 (nunca abaixo de 0) e solta 1 pessoa na hora.
   **+**: meta + 1 (até as vagas) e puxa na hora o adulto livre mais perto, se houver. Sem ninguém
   livre, a meta fica e é preenchida quando alguém ficar livre (um jovem que faz 14 anos, uma
   família que chega).
5. **Automático** (botão no topo do painel): todas as metas voltam a automáticas, como hoje.
6. Construir um local de um tipo com meta em número soma as vagas dele à meta (quem constrói um
   lenhador quer lenhadores); demolir corta a meta às vagas que sobraram.
7. A ficha da pessoa continua com "Mudar": mudar de A para B ajusta as metas em número de A (−1) e de B
   (+1). Sai o `quitWeek` (a meta já impede a volta).
8. Partida sem nenhum toque no painel = jogo de hoje, dígito a dígito.

### 1.2 Números (`src/data`)
- Nenhum número novo de economia. `rules.json > jobPriority` fica como está (o Construtor entra no
  pacote 2, o Pastor no 3).
- `GameState.jobTargets: Partial<Record<BuildingKind, number>>` (estado, não dado).

### 1.3 Interface e textos (ui-designer + copywriter)
- Abre por um botão **Profissões** na coluna da direita (perto de Estatísticas), por toque na pílula
  de Moradores e por uma tecla (sugestão: P). Fecha com Esc ou toque fora.
- Uma linha por profissão **construída** (sem local, sem linha): ícone pintado, nome, "2 de 4 vagas",
  **−  [3]  +**. O número do meio é a meta; com menos gente que a meta, embaixo em âmbar: "falta 1".
  Linha automática com um selo discreto "auto". Primeira linha fixa: **Sem trabalho N** (e "N
  crianças, N idosos" pequeno ao lado).
- Celular deitado (844 x 390): duas colunas de até 6 linhas de 44 px, cabeçalho de 40 px com o botão
  Automático; cabe sem rolar. PC: uma coluna.
- Toque nas linhas: − e + com alvo ≥ 44 px; + sem ninguém livre mostra "Ninguém livre: tire de outra
  profissão" (uma vez).
- O balão do local vazio passa a apontar para o painel: "Ninguém trabalha aqui: abra Profissões".
- Textos em `src/game/strings.ts`. Modelo puro em `src/game/model/` com testes.

### 1.4 Arte 3D
- Nenhuma. Quem anda já é quem trabalha (`castWalkers`).

### 1.5 Testes do core (test-reviewer)
Meta automática = hoje (mesmo resultado de `assignJobs` em cidade sorteada); − solta o mais longe;
+ puxa o mais perto; meta acima das vagas é cortada; construir soma vagas à meta numérica; demolir
corta; "Mudar" ajusta as duas metas; Automático limpa; criança que vira adulta preenche meta aberta;
determinismo pela seed.

### 1.6 Sim-tester
- P1: com todas as metas automáticas, o Comum repete a linha de base dígito a dígito (100 seeds).
- Sem rodada de equilíbrio (nenhum número muda).

### 1.7 Quem faz e horas
| Parte | Agente | Horas |
|---|---|---|
| Core: metas, `assignJobs`, ações −/+/Automático, `setJob` | agente principal | 3–4 |
| Testes do core | test-reviewer | 1,5–2 |
| Painel (celular e PC), botão, tecla, modelo puro | ui-designer | 5–7 |
| Textos | copywriter | 0,5 |
| Linha de base P1 | sim-tester | 1 |
| Revisão | code-reviewer | 1 |
| **Total** | | **12–15,5 h** |

---

## 2. Templo em etapas + "O que fazer agora"

> **Substituído em 2026-11-07** (com a seção 3) por `plano-ruinas.md`: ruína fixa no mapa, altar com
> ofertas de gado, `sacred` nas casas de pedra. O que segue vale só onde aquele plano remete para cá.

### 2.1 Regra (versão mais simples)
1. **Cinco etapas**, em `src/data/temple.json`, na ordem: **Altar restaurado** (no altar do centro),
   **Alicerce**, **Paredes**, **Pórtico e telhado**, **Consagração** (no lugar do Templo). Nomes de
   obra, sem história nem versículo.
2. **Cada etapa é um objetivo** (tipo novo `templeStage`, com `stage`): ela só pode começar quando é o
   objetivo atual. Os objetivos de moradores, casas e marcos ficam entre as etapas e são os
   pré-requisitos delas.
3. **Começar uma etapa**: no balão do altar (etapa 1) ou do Templo (2–5), botão "Começar: Alicerce".
   Paga na hora a prata e os materiais da etapa (com prata negativa ou sem material, o botão diz o
   que falta).
4. **Construtores**: enquanto a etapa está em obra, o local dela (altar ou Templo) tem `builders`
   vagas da profissão **Construtor** (painel do pacote 1; no `jobPriority`, por último, como o
   `temple` de hoje). Fora da obra, 0 vagas.
5. **Avanço**: toda semana, a obra soma 1 por construtor trabalhando (`progress`); a etapa termina com
   `work` (semanas-construtor). Ano inteiro, mesmo ritmo. Sem construtor, a obra para, sem perder nada.
   Terminar a etapa cumpre o objetivo (prêmio, evento `stageDone`, toast, a obra sobe de desenho).
6. **O lugar do Templo** (6 x 6, como hoje, a ≤ `templeSpotRoadGap` da rede) é liberado num objetivo
   antes do Alicerce e **marcado de graça**: estacas e linha. Pode ser demolido enquanto o Alicerce
   não começou; depois fica protegido.
7. **Vitória** = Consagração terminada. Saem `TEMPLE_GOAL`, `templeWaitsForGoal`, `templeSavings` e o
   toast do Templo erguido antes do tempo.
8. Efeitos do Templo (raio 12, Alegria +10) só depois da Consagração; as etapas não mudam regra
   nenhuma da cidade. O altar restaurado não muda regra (prêmio e desenho).
9. O Templo pronto não tem vagas (`jobs` 0; hoje 2 vagas sem efeito).
10. As outras construções continuam instantâneas.

### 2.2 Números (`src/data`)
`src/data/temple.json` (totais das etapas 2–5 = o Templo de hoje: 800 prata, 260 pedra, 200 madeira):

| # | Etapa | Lugar | Prata | Pedra | Madeira | Construtores | Obra (sem-construtor) | Mínimo |
|---|---|---|---|---|---|---|---|---|
| 1 | Altar restaurado | altar | 40 | 20 | 20 | 2 | 12 | 6 sem |
| 2 | Alicerce | Templo | 150 | 80 | 0 | 4 | 40 | 10 sem |
| 3 | Paredes | Templo | 200 | 120 | 40 | 5 | 60 | 12 sem |
| 4 | Pórtico e telhado | Templo | 250 | 60 | 120 | 6 | 72 | 12 sem |
| 5 | Consagração | Templo | 200 | 0 | 40 | 4 | 32 | 8 sem |

- `buildings.json > temple`: `cost` 0, `materials` {}, `jobs` 0 (a obra dá as vagas).
- `rules.json > jobPriority`: `temple` vira `builder` (a profissão da obra ativa, altar ou Templo).

`goals.json` deste pacote (21 objetivos; o pacote 3 põe o pasto no 9 e empurra o resto):

| # | Texto | Tipo | Prêmio | Libera |
|---|---|---|---|---|
| 1 | Comida até a primavera | foodUntilSpring | +30 | Celeiro |
| 2 | Primeiro casamento | marco | +20 | – |
| 3 | Primeiro nascimento | marco | +40 | – |
| 4 | Passe o primeiro inverno | marco | +30 | Pedreira |
| 5 | Tenha 5 casas de barro | casas 2 | +40 | Praça |
| 6 | **Restaure o altar** | templeStage 1 | +50 | – |
| 7 | Receba a primeira caravana | marco | +50 | Oficina |
| 8 | Construa uma oficina | build | +40 | Mercado (no pacote 3: Pasto) |
| 9 | Chegue a 30 moradores | moradores | +50 | Templo (o lugar) |
| 10 | Tenha 6 casas de pedra | casas 3 | +60 | Parque |
| 11 | **Alicerce do Templo** | templeStage 2 | +80 | – |
| 12 | Uma criança da cidade virou adulta | marco | +80 | – |
| 13 | Chegue a 45 moradores | moradores | +80 | – |
| 14 | Tenha 4 casas grandes | casas 4 | +80 | – |
| 15 | **Paredes do Templo** | templeStage 3 | +100 | – |
| 16 | Terceira geração | marco | +100 | – |
| 17 | Chegue a 65 moradores | moradores | +100 | – |
| 18 | Chegue a 85 moradores | moradores | +120 | – |
| 19 | **Pórtico e telhado** | templeStage 4 | +150 | – |
| 20 | Chegue a 120 moradores | moradores | +175 | – |
| 21 | **Consagração** | templeStage 5 | vitória | – |

Saem os objetivos de 100, 130 e 160 moradores (fica 120). Alavancas do sim-tester, uma por rodada:
obra (`work`) ×0,8 / ×1,25; objetivo 20 120 → 100 / 140; construtores da etapa ±1; prata das etapas
±20%.

### 2.3 "O que fazer agora" (interface, junto)
- **Uma linha fixa** logo abaixo da barra de cima, sempre visível fora do tutorial (no tutorial, a
  frase do tutorial ocupa o mesmo lugar). Um ícone, uma frase de até ~60 caracteres e uma **seta** para
  onde agir (ferramenta na coluna, construção no mapa ou botão do painel), a mesma seta do tutorial.
- **Tocar na linha** abre o balão da etapa (altar ou Templo) ou a lista de objetivos, e mostra a seta.
- Função pura `nextStep(state)` em `src/game/model/` (lê o core, sem regra nova), com testes. Ordem:
  1. Crise que mata ou perde: dívida, fome, lenha que não chega à primavera (o primeiro aviso, com a
     ação dele: "Comida acaba em 3 sem: construa um pescador perto do rio").
  2. Etapa atual: lugar não marcado → "Escolha o lugar do Templo"; falta pagar → "Junte 80 de pedra
     para o Alicerce: 30/80" (seta na Pedreira ou na ferramenta); pode pagar → "Comece o Alicerce:
     toque no Templo"; em obra com vagas vazias → "Ponha construtores: 1 de 4" (abre Profissões); obra
     cheia → "Alicerce 18/40 · pronto em ~6 sem".
  3. Outro objetivo: a primeira coisa que falta. Casas de nível N: a exigência que falta da casa mais
     perto de subir ("Construa uma praça perto das casas de barro"); moradores: casa vazia ("Construa
     uma casa: casais esperam casa"), material ("Faltam 10 de madeira para as casas subirem"); construir:
     a ferramenta; marcos: o que ajuda ("Deixe 1 casa vazia: caravana em 5 sem"; "As crianças crescem:
     enquanto isso, suba as casas").
  4. Nada a fazer: "Tudo em ordem: aproveite a cidade" (raro).
- Celular: uma linha de 28 px, corta com reticências; os toasts descem abaixo dela. PC: centrada sob
  a barra, numa linha. Cenários `ui3d-pc-*` e `ui3d-phone-*` continuam sem quebrar a barra.

### 2.4 Interface do Templo e textos (ui-designer + copywriter)
- Balão do altar e do Templo: nome da etapa, custo ("150 prata · 80 pedra"), construtores "2 de 4",
  barra "18/40", "~6 sem", botão "Começar: Alicerce" ou o que falta em vermelho; "Profissões" ao lado.
- Pílula do objetivo: "Alicerce 18/40" durante a obra; "Junte 80 pedra" antes de pagar.
- Lista de objetivos com as cinco etapas destacadas (ícone de obra).
- Toasts: "Começou o Alicerce", "Alicerce pronto!", "A obra parou: ninguém trabalha nela".
- Ferramenta Templo: "Marque o lugar do Templo (grátis)"; as áreas verdes e amarelas de hoje.
- Textos em `strings.ts` e `goals.json`. Sem história.

### 2.5 Arte 3D (sprite-artist)
- Altar restaurado: degraus de pedra nova, mureta, fogo maior; durante a obra, pedras empilhadas e 2
  construtores com malho.
- Templo por etapa, cortando o Templo por código do C8: lugar marcado (estacas e linha); Alicerce
  (plataforma e escada, blocos espalhados); Paredes (pátio e muro, santuário sem telhado, andaimes de
  madeira); Pórtico e telhado (pórtico, colunas, telhado; andaimes só no alto); Consagração (o Templo
  inteiro com a cornija dourada, o mar de bronze e fumaça do altar).
- Obra viva: construtores (as pessoas da profissão) andam até a obra, carregam pedra e batem malho;
  um guindaste de roda de madeira nas etapas 3 e 4; poeira leve (a fumaça de areia do C8). Obra
  parada: ninguém, ferramentas no chão.
- Cada etapa terminada: brilho e gente reunida, como os marcos.
- Custo: ≤ +4 chamadas e ≤ +15 mil triângulos na obra; `view3d-perf.mjs` dentro dos limites.
  Cenário visual novo `templestages3d` (uma foto por etapa, celular e PC).

### 2.6 Testes do core (test-reviewer)
Etapa só começa sendo o objetivo atual; paga prata e materiais; não começa sem eles nem em dívida;
vagas só durante a obra; avanço = construtores por semana; obra sem construtor para; termina no
`work` e cumpre o objetivo com o prêmio; lugar marcado de graça e demolível antes do Alicerce,
protegido depois; Consagração = vitória; marcos cumpridos antes contam; Templo pronto com 0 vagas;
determinismo pela seed. `nextStep` com testes no `src/game` (cada ramo da ordem).

### 2.7 Sim-tester (Comum, 100 seeds, 1000 sem; base = main com o pacote 1)
Bots: o Comum marca o lugar do Templo assim que liberado, paga a etapa assim que pode e põe os
construtores pelo painel, tirando primeiro de quem sobra (desempregados, oficina com o bônus no teto,
lavradores no inverno), e devolve ao fim da etapa. O Distraído fica no automático.

| # | Critério | Alvo |
|---|---|---|
| E1 | Vitória do Comum (mediana) | 30–38 min |
| E2 | Comum vence / derrotas | 50–85% / ≤ 5% (a Dificuldade aperta depois) |
| E3 | Duração real de cada etapa (p50) | ≤ 1,5 × o mínimo |
| E4 | Espera para pagar a etapa atual (p50; p90) | ≤ 20 sem; ≤ 40 sem |
| E5 | Pior espera entre objetivos (p50) | ≤ 80 sem |
| E6 | Altar restaurado (mediana) | Ano 1–2 (sem 30–80) |
| E7 | Distraído com etapa paga e 0 construtores > 26 sem | medir (informação: é o "perdido") |
| — | S1–S4, F1, D1, A2b | sem piorar além do ruído (±3 pontos) |

### 2.8 Quem faz e horas
| Parte | Agente | Horas |
|---|---|---|
| Core: `temple.json`, etapas, objetivo `templeStage`, vagas da obra, avanço, lugar grátis, vitória, saídas | agente principal | 6–8 |
| Testes do core | test-reviewer | 2–3 |
| Balões, pílula, lista, toasts, ferramenta, linha "O que fazer agora" com seta | ui-designer | 7–9 |
| `nextStep` puro e testes | agente principal | 2–3 |
| Textos (etapas, linha, toasts) | copywriter | 1–1,5 |
| Arte: altar, 4 desenhos do Templo, andaimes, guindaste, construtores, cenário | sprite-artist | 8–10 |
| Bots e 2 rodadas | sim-tester | 4–5 |
| Revisão | code-reviewer | 1–1,5 |
| Depois: playtester (a linha tira o "perdido"?) e fun-critic | — | 2–3 |
| **Total** | | **33–44 h** |

---

## 3. Pacote C Gado

Como na seção 1 do `plano-backlog.md` (regra, números, interface, arte, testes, critérios G1–G6),
com as respostas recomendadas: **pasto pelo capim livre em volta**, **gado não é comida no inverno**,
**objetivo "Construa um pasto"**. Mudanças por causa dos pacotes 1 e 2:
- Objetivos (22): o 8 "Construa uma oficina" libera **Pasto**; entra o 9 "Construa um pasto" (+40,
  libera Mercado); os seguintes descem um: 30 moradores (Templo) vira o 10, Parque no 11, Alicerce 12,
  Paredes 16, Pórtico 20, 120 moradores 21, Consagração 22.
- Profissão **Pastor** no painel; `jobPriority` ganha `pasture` depois de `quarry`.
- "O que fazer agora": mercado sem gado → "Construa um pasto no capim".
- Base do sim-tester: o main com o pacote 2. Critérios G1–G6 e E1–E5 sem piorar além do ruído.
- Horas: as do `plano-backlog.md` (**22–30 h**) + 1 h (painel, linha, renumeração).

---

## 4. Dificuldade

### 4.1 Regra (versão mais simples)
1. **Escolha no começo**: no título, "Começar" mostra três cartões, **Tranquilo / Normal / Difícil**
   (o último escolhido vem marcado; Normal na primeira vez). Fica em `s.difficulty`; não muda na
   partida. "Mesmo mapa" e "Tentar de novo" mantêm a escolha.
2. **Multiplicadores** num arquivo só (`src/data/difficulty.json`), lidos pelo core nos pontos que já
   existem: prata inicial, comida comida, lenha queimada, manutenção, custo das etapas (prata e
   materiais) e obra das etapas.
3. **Consumo cresce com a cidade** (todas as dificuldades): casas maiores comem e queimam mais.
   `houses.json` ganha `foodFactor` por nível (multiplica a comida de cada morador da casa) e a lenha
   passa a subir com o nível, em vez de descer.
4. **Invernos pioram com os anos**: a partir do Ano 3, a comida do inverno e a lenha × (1 +
   `winterGrowth` × (ano − 2)), até `winterGrowthMax`. No começo do outono de um inverno mais duro,
   toast "Este inverno vai ser mais frio que o anterior" e a pílula da estação diz "+15% frio".

### 4.2 Números (`src/data`)
`src/data/difficulty.json`:

| Chave | Tranquilo | Normal | Difícil |
|---|---|---|---|
| `startSilver` | 220 | 180 | 150 |
| `food` (comida comida) | 0,9 | 1 | 1,1 |
| `firewood` | 0,8 | 1 | 1,2 |
| `upkeep` | 0,8 | 1 | 1,2 |
| `templeCost` (prata e materiais das etapas) | 0,8 | 1 | 1,25 |
| `templeWork` (obra das etapas) | 0,8 | 1 | 1,25 |
| `winterGrowth` (por ano, do Ano 3) | 0 | 0,05 | 0,08 |
| `winterGrowthMax` | 0 | 0,3 | 0,4 |

`houses.json` (base, vale para todas):

| Nível | `foodFactor` | `firewood` hoje → novo |
|---|---|---|
| Tenda | 1 | 0,3 → 0,3 |
| Casa de barro | 1 | 0,2 → 0,25 |
| Casa de pedra | 1,1 | 0,15 → 0,3 |
| Casa grande | 1,25 | 0,15 → 0,4 |

- `rules.json > winter.foodFactor` e `tentFoodFactor` ficam; o crescimento multiplica por cima.
- Alavancas, uma por rodada, só no Normal primeiro: `foodFactor` da casa grande 1,25 → 1,15;
  `winterGrowth` 0,05 → 0,03; lenha da casa grande 0,4 → 0,3; depois Tranquilo e Difícil só pelos
  multiplicadores.

### 4.3 Interface e textos
- Cartões no título (ui-designer): nome, uma frase ("Tranquilo: invernos leves, obras mais baratas";
  "Normal: o jogo como foi pensado"; "Difícil: invernos cada vez mais duros e obras caras") e três
  ícones de comida, lenha e prata. Celular deitado: três cartões lado a lado.
- A dificuldade aparece pequena nas Estatísticas, na pausa e nos cartões de vitória e derrota
  ("Vitória no Difícil").
- Balão da casa: "Come 1,1× (casa de pedra)" junto da lenha.
- Textos em `strings.ts` (copywriter).

### 4.4 Arte 3D
- Neve e névoa mais fortes no inverno mais duro (pelo fator do ano, em `visual.json`); nada mais.
  sprite-artist, 1–2 h.

### 4.5 Testes do core
Multiplicadores aplicados em cada ponto (prata inicial, comida, lenha, manutenção, etapas); Normal
com multiplicadores 1 = sem efeito; `foodFactor` por nível; inverno do Ano 1–2 sem crescimento, Ano
3 com 1 passo, teto; previsão de comida e `firewoodShort` contam o crescimento; dificuldade guardada
e mantida no "Mesmo mapa"; determinismo.

### 4.6 Sim-tester (100 seeds por dificuldade, 1000 sem; base = main com o pacote 3)
Alvos novos, estilo A2 (substituem o A2 de hoje):

| # | Critério | Tranquilo | Normal | Difícil |
|---|---|---|---|---|
| A1 | Vitória do Comum (mediana) | 28–36 min | 32–40 min | 36–46 min |
| A2 | Comum vence | 80–95% | 50–70% | 20–40% |
| A2 | Derrotas do Comum | ≤ 2% | 3–10% | 10–25% |
| A2 | Eficiente vence | ≥ 95% | ≥ 85% | ≥ 60% |
| A2b | Derrotas do Distraído com 5+ moradores | ≤ 15% | ≤ 35% | medir |
| F1 | Frio em algum inverno (Comum) | 30–60% | 60–85% | ≥ 80% |
| S4 | Derrota no Ano 1 | ≤ 1% | ≤ 2% | ≤ 5% |
| M | Ordem: cada número acima piora do Tranquilo ao Difícil | sempre | | |
| — | S1–S3, D1, E3–E5, G1–G6 no Normal | dentro dos alvos | | |

O Normal é o alvo da calibração; se ele passar, Tranquilo e Difícil só mexem nos multiplicadores.

### 4.7 Quem faz e horas
| Parte | Agente | Horas |
|---|---|---|
| Core: `difficulty.json`, multiplicadores, `foodFactor`, lenha nova, inverno que cresce, toast | agente principal | 3–4 |
| Testes do core | test-reviewer | 1,5–2 |
| Cartões no título, rótulos, balão | ui-designer | 3–4 |
| Textos | copywriter | 0,5 |
| Neve do inverno duro | sprite-artist | 1–2 |
| Bots e 3–4 rodadas (três dificuldades) | sim-tester | 6–8 |
| Revisão | code-reviewer | 1 |
| Depois: playtester e fun-critic no Normal | — | 2–3 |
| **Total** | | **18–24,5 h** |

---

## 5. Totais e o que fica fora

| Pacote | Horas |
|---|---|
| T0 Arrumação técnica | 3–6 |
| 1 Profissões | 12–15,5 |
| 2 Templo em etapas + "O que fazer agora" | 33–44 |
| 3 Gado | 23–31 |
| 4 Dificuldade | 18–24,5 |
| **Total** | **~89–121 h** (no ritmo de ~12–15 h por sessão, ~7–9 sessões) |

Fora deste plano: obra com tempo para as outras construções (DEPOIS, se o playtest pedir); efeito do
Templo durante a obra; gado no inverno; Alegria desde o começo (B4, segue no backlog); trocar a
dificuldade no meio; mais etapas ou um segundo prédio nobre; qualquer história ou versículo.

Depois da Dificuldade, o `plano-backlog.md` segue na ordem dele a partir do D1, sem o C (feito aqui)
e sem o "O Obras com tempo" (absorvido para o Templo).

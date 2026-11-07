# Plano do backlog (game-director, 2026-11-07)

Pedido do usuário: escopo do Pacote C "Gado" e o backlog inteiro até o fim, para aprovar antes de
qualquer implementação. **Nada aqui está aprovado.** `docs/design.md` só muda depois do OK.

Base: `docs/design.md` (Próximos candidatos), `docs/revisoes/2026-11-04/plano-sobrevivencia.md`
(lista do usuário), `docs/revisoes/2026-11-06/plano-sobrevivencia.md` (seções 1, 5 e 6: gado,
B4, objetivo 7), `docs/revisoes/2026-11-06/plano-beleza.md` (C1–C8 feitos) e
`arte-2d-vs-3d.md` (o que a arte já cobriu). Dados atuais: `src/data/*.json` no a88c521.

Estado: Pacote B, "Fim sem frio", Povo, Madeira e pedra, P4 e C1–C8 feitos. Música (C1) aprovada pelo usuário em 2026-11-07.

---

## 1. Pacote C "Gado" (pronto para implementar)

### 1.1 Decisão por item

| Item | Pilares | Decisão |
|---|---|---|
| Pasto que cria gado pelo capim livre em volta | 9 posicionar (+), 8 viva (+, rebanho), 5 evoluir (neutro: 1 construção) | **ENTRA AGORA**: é a mecânica nova do pacote (uma) |
| Mercado consome gado; sem gado não atende | 1 sobrevivência (+, crise de abastecimento com volta), 7 simples (+: "o mercado vende o que o pasto cria") | **ENTRA AGORA**: é a mesma mecânica, o lado do consumo. Copia a regra "mercado sem gente não atende" |
| Objetivo novo "Construa um pasto" | 6 camadas (+) | **ENTRA AGORA** (ajuste de objetivos): ensina a ordem pasto → mercado |
| Gado como comida no inverno | 1 (+) / 11 uma mecânica (−) | **DEPOIS** (pergunta 3): seria segundo uso; vira alavanca se o inverno pesar demais |
| Lã e couro, roupas | 1 (+) / 11 (−) | **DEPOIS**: pacote "Roupas", que usa o gado deste pacote |
| Pasto com níveis, gado na caravana, venda de gado por prata | 5 (+) / 7 simples (−) | **FORA**: não muda o prazer de achar o bom capim |
| Gado indo a pé até o mercado como regra | 8 (+) / custo de código alto | **FORA como regra**; entra só como aparência (pastor levando ovelhas) |

O Pasto deixa de ser candidato separado: entra aqui como fonte do gado. O antigo "Pasto e roupas"
vira **"Roupas"**.

### 1.2 Regra (versão mais simples)
1. **Pasto** (novo, `pasture`): 3 x 3, 1 vaga (o pastor), liberado no objetivo 7. Usa a regra de
   coleta que já existe (`gather`), com fonte nova `grass`: conta as células de **capim livre** no
   raio 2 (chão `grass`, sem construção, rua, árvore ou rocha). Rende `perCell` por célula × lotação,
   com teto `max`. No inverno rende × `winterFactor` (capim seco), como o Pescador.
2. **Estoque de gado** da cidade (`s.livestock`), como madeira e pedra. Guarda no máximo
   `livestockStorage`; cheio, o Pasto para ("Parado: estoque cheio", texto que já existe). Começa em 0.
3. **Mercado consome gado**: cada Mercado ligado e com gente gasta `livestock` por semana (pelo
   nível), depois da produção. Na ordem dos mercados (mais antigo primeiro), quem não tem o gado da
   semana **não atende nesta semana** (mesma regra do mercado sem trabalhador). As casas grandes caem
   pela regra que já existe (`weeksToDowngrade` 3): o estoque é o colchão.
4. O capim some quando o jogador constrói em cima: a cidade que cresce come o pasto (escolha de lugar).
5. Nada mais muda: alegria do mercado, raio, imposto, casas, tutorial.

### 1.3 Números iniciais (`src/data`)
- `buildings.json > pasture`: `{ "name": "Pasto", "category": "supply", "cost": 30, "upkeep": 0.5,
  "w": 3, "h": 3, "jobs": 1, "materials": { "wood": 10 },
  "gather": { "source": "grass", "radius": 2, "perCell": 0.06, "max": 1.5, "winterFactor": 0.5,
  "product": "livestock" } }`. Conta: raio 2 em volta de 3 x 3 = 40 células; capim médio do mapa
  ~45% → ~18 células → ~1,1/sem; prado bom (25+) bate no teto.
- `buildings.json > market`: `"livestock": 0.5`; níveis `0.75` e `1.0`.
- `rules.json`: `"livestockStorage": 40`; `jobPriority` ganha `"pasture"` depois de `"quarry"`.
- `goals.json` (20 objetivos): o objetivo 7 "Construa uma oficina" passa a liberar **Pasto**; entra
  o objetivo 8 novo `{ "type": "build", "kind": "pasture", "target": 1, "reward": 40, "unlock":
  "market", "text": "Construa um pasto" }`; os seguintes descem um número (o Parque passa a ser o 10,
  o Templo o 17).
- Alavancas, uma por rodada, nesta ordem: `perCell` 0,06 → 0,08; consumo do mercado 0,5 → 0,35;
  `livestockStorage` 40 → 60; `winterFactor` 0,5 → 0,7.

### 1.4 Interface e textos (ui-designer + copywriter)
- Pílula **Gado** no topo depois de Pedra, só depois de o Pasto ser liberado (como a pedra):
  "N · +N/sem" (produção menos consumo); vermelha com um mercado sem gado. Toque: "Pastos +N, Mercados
  −N".
- Prévia do Pasto: "Rende N gado/sem" (a prévia de coleta que já existe) e as células de capim livre
  do raio acesas no chão. Rende 0: "Pouco capim aqui".
- Balão do Pasto: "Rende N gado/sem · N de capim"; cheio: "Parado: estoque cheio".
- Balão do Mercado: "Gado: N/sem"; sem gado: "Sem gado: não atende as casas".
- Aviso (lista de problemas): "Mercado sem gado: construa um pasto no capim". Toast quando um mercado
  fica sem gado (evento `marketNoLivestock`), uma vez por episódio.
- Motivo da casa que não sobe: "mercado sem gado" (junto dos motivos que já existem).
- Textos em `src/game/strings.ts` e `goals.json`. Sem história.
- Topo do PC 1366 continua numa linha só (cenário `ui3d-pc-*`).

### 1.5 Arte 3D (sprite-artist)
- Pasto por código: cerca baixa de pedra solta com porteira, abrigo de palha do pastor, cocho e
  pedra de sal. Ovelhas e cabras **instanciadas**, pastando no capim do raio (reusa os rebanhos que já
  existem); quantidade pela fração do estoque (até 8 por pasto). Inverno: bichos juntos no abrigo.
- Pastor andando com o rebanho e, de vez em quando, levando 2–3 ovelhas ao mercado (só aparência,
  plano puro testado).
- Mercado com gado: cercadinho com cordeiros ao lado das bancas; sem gado, cercadinho vazio.
- Custo: ≤ +3 chamadas, ≤ +6 mil triângulos com 3 pastos; `view3d-perf.mjs` dentro de ≤ 120
  chamadas, ≥ 30 qps no celular simulado (depende do T0, abaixo).
- Miniatura do Pasto na coluna (C5).

### 1.6 Bots e critérios do sim-tester (100 seeds, 1000 semanas, base = main com o T0)
Bots: Comum constrói o Pasto no melhor capim ligado assim que liberado, e um segundo quando o consumo
passa da produção por 8 semanas; Eficiente idem, antes do 1º Mercado; Distraído no primeiro lugar
que cabe e nunca o segundo.

| # | Critério | Alvo |
|---|---|---|
| G1 | Comum com gado ≥ 5 quando o 1º Mercado fica pronto | ≥ 70% das partidas |
| G2 | Comum com algum Mercado sem gado > 8 sem seguidas | ≤ 15% das partidas |
| G3 | O lugar pesa: rendimento do 1º pasto do Comum, p10 e p90 | p10 ≤ 0,8 e p90 ≥ 1,4 |
| G4 | Distraído com Mercado sem gado em algum momento | ≥ 30% (o descuido aparece) |
| G5 | Estoque de gado cheio > 26 sem seguidas (Comum) | ≤ 20% das partidas |
| G6 | Pastos por partida (Comum, mediana) | 1–2 |
| — | A1 (25–35 min), A2 (Comum 50–90%, derrotas ≤ 5%, Distraído ≤ 20%), A2b, S1–S4, F1, D1 | sem piorar além do ruído (±3 pontos) |

### 1.7 Testes do core (test-reviewer)
Fonte `grass` conta só capim livre; construir em cima tira a célula; lotação 0 rende 0; inverno ×
0,5; estoque para no teto; Mercado gasta pelo nível; sem gado não atende na semana; ordem dos
mercados quando falta; mercado sem gente não gasta; evento uma vez por episódio; objetivo 8 e
liberações; determinismo pela seed.

### 1.8 Quem faz e horas

| Parte | Agente | Horas |
|---|---|---|
| Core: fonte `grass`, estoque, consumo, cobertura, evento, objetivos, previsão do topo | agente principal | 5–7 |
| Testes do core | test-reviewer | 1,5–2 |
| Interface: pílula, prévia com capim aceso, balões, aviso, motivo | ui-designer | 3–4 |
| Textos | copywriter | 0,5–1 |
| Arte: pasto, rebanho, pastor, mercado com gado, miniatura | sprite-artist | 6–8 |
| Bots e 1–2 rodadas de medição | sim-tester | 3–4 |
| Revisão (tipos, custo por quadro, docs) | code-reviewer | 1–1,5 |
| Depois: playtester e fun-critic | — | 2–3 |
| Docs (`GAME_DESIGN.md`, `TESTING.md`, `design.md`) | junto de cada parte | incluído |

**Total: ~22–30 h** (core e arte podem correr em paralelo; ~2 sessões).

---

## 2. Backlog inteiro, priorizado

Regra de alternância: **um de jogo, um de beleza**, até o D5. Depois disso a arte de cada mecânica
vai dentro do próprio pacote de jogo (como o pasto no C). Cada pacote de jogo tem **uma** mecânica
nova; cada um vai sozinho para o main com sim-tester depois.

| # | Pacote | Tipo | Objetivo | Mecânica nova (uma) | Depende de | Horas | O playtest do usuário decide antes |
|---|---|---|---|---|---|---|---|
| 0 | **T0 Arrumação técnica** | técnico | Liberar margem de desenho para o C: sai `public/models/meshy/temple.glb`; a vista com 10 terrenos volta a ≤ 120 chamadas (kit de obra do terreno vazio num só instanciado); os testes instáveis do clique numa pessoa (`town3d-pc`) e `music3d-pc` ficam estáveis | nenhuma | — | 3–6 | nada |
| 1 | **C Gado** | jogo | O Mercado vende o que o pasto cria; achar o bom capim conta | Pasto e gado (seção 1) | T0 | 22–30 | timbre da música (só para fechar o C1) |
| 2 | **D1 Um dia na cidade** | beleza | Rotina por hora: de manhã saem para o trabalho, ao meio-dia o mercado enche, à tarde voltam, ao anoitecer acendem lamparinas e as crianças entram; fim de semana de descanso no altar | nenhuma (aparência pelos dados do core) | C (pastor no dia) | 12–16 | se a cidade à noite deve ficar quieta (recomendo: sim) |
| 3 | **B4 Alegria desde o começo** (pequeno) | jogo | A Alegria vale desde o Ano 1, com tenda no inverno e frio | Alegria sempre ligada (já especificado no plano de 06/11, seção 5) | — | 3–4 | **sim**: se a falta da Alegria no começo foi sentida |
| 4 | **R Recuperação e vitória** | jogo | A cidade morta não fica 52 semanas morrendo: a dívida trava obras e famílias saem aos poucos; perder só com a cidade quase vazia, e rápido quando ela já está; "Jerusalém resistiu" depois de uma crise vencida | Derrota pela cidade vazia (sai a derrota por 24 semanas de dívida) | B4 opcional | 14–18 | se perder tem que doer mais ou menos do que hoje |
| 5 | **D2 Retratos e família** | beleza | Apego: rosto desenhado por código em cada pessoa (idade, sexo, profissão), árvore da família na ficha, livro da cidade com casamentos, nascimentos e mortes | nenhuma | — | 12–16 | se o jogador abre a ficha (se não abre, D2 desce na fila) |
| 6 | **O Obras com tempo** | jogo | Construir leva semanas: canteiro, construtores tirados dos trabalhadores, fila de obras; o Templo pago e erguido por etapas (destino da prata e da pedra paradas) | Obra com tempo e construtores | B2 (trabalho) | 20–26 | se a espera pela obra é boa ou chata |
| 7 | **D3 Modo contemplar** | beleza | Esconder a interface, câmera baixa e livre, órbita lenta, foto da cidade; tecla e botão | nenhuma | — | 6–9 | nada |
| 8 | **G Governo** | jogo | Imposto em % (começa em 20%): mais prata ou mais Alegria; dá destino à prata parada (W4) | Imposto ajustável | B4 (a Alegria precisa valer desde o começo) | 12–16 | se a prata ainda sobra no fim |
| 9 | **D4 Festas das estações** | beleza | Festa da colheita no fim do verão e festa do inverno vencido: bandeirolas, gente reunida na praça e no altar, dança, a música muda de clima | nenhuma (dispara em eventos que já existem) | C1 aprovado | 10–14 | nada |
| 10 | **E Oficina com ofícios** (Evoluções 1) | jogo | Os 6 ofícios viram tipos reais: ferramentas (campo, lenhador e pedreira rendem mais), olaria, tecelagem; cada um com níveis pagos em pedra | Tipo da oficina | O (construtores), G | 18–24 | quais ofícios valem a pena (recomendo 3 primeiro) |
| 11 | **D5 Cidade que envelhece** | beleza | Casas antigas ganham parreira e hera, quintais ganham árvore plantada, ruas mais usadas ficam mais gastas; o Ano 10 parece outra cidade | nenhuma (pela idade da casa e uso da rua) | C4 (desgaste) | 10–12 | nada |
| 12 | **Ro Roupas** | jogo | Tecelagem e curtume fazem roupa da lã e do couro do gado; roupa diminui o frio e a lenha no inverno | Roupas (bem gasto no inverno) | C, E | 16–20 | se o inverno ainda é o problema central |
| 13 | **Do Doenças** | jogo | Ano 4+: idosos e crianças adoecem no inverno e na fome; uma construção de cuidado no raio salva | Doença e cuidado | Ro (frio e roupa calibrados) | 18–22 | nome e forma da construção de cuidado |
| 14 | **Ev Eventos da época** | jogo | Ano 5+: eventos com 1–2 semanas de aviso; começa com 4 (mercador troca prata por comida, caravana extra, praga no campo, decreto que para as obras) | Eventos sorteados com aviso | O, G | 16–22 | quais eventos (recomendo 2 bons e 2 ruins) |
| 15 | **Al Alojamento** | jogo | Moradia de emergência barata e triste para casal sem casa e família sem teto | Alojamento | R | 8–10 | **sim**: se "casal esperando casa" incomodou; senão FORA |
| 16 | **In Incêndio** | jogo | Fogo que passa entre casas coladas no verão seco; distância e um serviço de água protegem | Incêndio | Ev | 12–16 | se entra (pergunta 9) |
| 17 | **H História** (Esdras e Neemias, ARA) | história | Só depois do playtest com o público aprovar a mecânica (pilar 10); precisa do `storyteller`, em espera | — | tudo acima aprovado | a estimar | quando criar o `storyteller` |

Totais (sem a História): técnico 3–6 h; jogo ~159–208 h; beleza ~50–67 h; **~212–281 h**.
No ritmo atual (~12–15 h por sessão), ~15–20 sessões.

Fora do backlog (decisões mantidas): campo grande (Evoluções 2) só se o playtest pedir mais escolha
na comida; porção do povo e reserva do celeiro só se o Governo não bastar; som ambiente (pergunta 10).

Pendências técnicas: as três estão no T0. Cada pacote de beleza mede `view3d-perf.mjs` (≤ 120
chamadas, ≤ 300 mil triângulos, ≥ 30 qps no celular simulado) e qualquer novo teste instável entra
no pacote seguinte, antes do código novo.

---

## 3. Perguntas que só o usuário pode responder

1. **Timbre da música (C1)**: ouvir `music-samples/*.wav` e aprovar? Recomendo aprovar agora e
   ajustar no D4, quando a festa mexer na música.
2. **Pasto pelo capim livre em volta** (o lugar pesa, a cidade que cresce come o pasto): pode ser
   assim? Recomendo sim.
3. **Gado também dá comida no inverno?** Recomendo não agora: fica como alavanca se o inverno pesar
   demais depois do C.
4. **Objetivo novo "Construa um pasto"** (20 objetivos; o Mercado sai do objetivo 7 para o 8)?
   Recomendo sim.
5. **B4 Alegria desde o começo**: depois do seu playtest, entra antes do Governo? Recomendo sim (o
   imposto só faz sentido com a Alegria valendo desde o Ano 1).
6. **"Chamar trabalhador" no balão**: a ficha da pessoa bastou no seu playtest? Recomendo FORA se
   bastou.
7. **Recuperação e vitória antes de Obras com tempo?** Recomendo sim: a cidade morta que leva 52
   semanas para perder é um buraco que já existe.
8. **Alternar 1 de jogo e 1 de beleza até o D5**, depois a arte dentro de cada pacote? Recomendo sim.
9. **Incêndio**: fica no fim da fila ou sai? Recomendo deixar por último e decidir depois das Doenças.
10. **Som ambiente** (pássaros, rio, conversa no mercado, baixinho, com chave própria): entra como
    pacote de beleza depois do D4? Em 06/11 ficou FORA; recomendo sim, como D6 (~6–8 h).
11. **Alojamento**: mantém na fila? Recomendo só se o "casal esperando casa" incomodou no playtest.

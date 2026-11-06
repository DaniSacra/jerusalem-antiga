# Pacote B "Primeiro ano de sobrevivência" — plano do diretor (2026-11-06)

Pedido do usuário (06/11): o começo é sobrevivência. Poucas casas, pouca comida, tendas frias.
Casa pede madeira, a evolução seguinte pede pedra. Sem praça no começo. Mercado só quando houver
o que trocar. Quem trabalha é gente de verdade, e o jogador pode mudar a profissão. O frio pesa.

O Pacote A (só visual: ruas pelo uso, moradores reais na rua, praça sem poço) corre em paralelo e
não entra aqui. O B2 aproveita o A: o morador tocado na rua abre a ficha, e ali se muda a profissão.

## 0. Base (o que vale hoje, conferido no código e nos dados)
- Casas (`houses.json`): Tenda 3 pessoas, rua · Barro 4, rua + praça, 5 madeira · Pedra 6, + mercado,
  10 pedra · Grande 8, + parque, 10 pedra + 5 madeira. Lenha/sem no inverno 0,3 / 0,2 / 0,15 / 0,15.
- Começo: 3–5 tendas, 40 de madeira, 0 pedra, comida para 18–24 semanas, prata 180.
  Liberados: rua, casa, campo, praça, pescador, coletora, lenhador.
- Vagas no começo: campo 2, pescador 1, coletora 1, lenhador 2 = 6. A caravana traz ~8–12 adultos.
  Por isso sobra gente sem trabalho já na semana 1.
- Trabalho: eficiência única da cidade = adultos / vagas (`computeEconomy`). `jobsOf` só mostra.
- Frio (`firewood.ts`): madeira não paga a lenha → `s.cold`. Mesmo efeito da fome nas casas
  (sorteio único). Ninguém morre de frio. A Alegria nem existe antes do Parque.
- Mercado no objetivo 4, Oficina no 5, Parque no 7.

## 1. Decisões e escopo
| Item | Pilares | Decisão |
|---|---|---|
| Barro pede só rua + madeira (sai a praça) | 1 sobrevivência, 5 evoluir, 7 simples | **ENTRA (B1)**: responde "por que a praça primeiro?" |
| Pedra pede praça + pedra (sai o mercado) | 5, 7 | **ENTRA (B1)**: a praça vira coisa de cidade de pedra |
| Mercado só para casa grande, liberado depois da oficina | 1, 6 camadas | **ENTRA (B1)**: mercado quando há o que trocar |
| Nova ordem dos objetivos | 1, 2 ritmo, 6 | **ENTRA (B1)**: o Ano 1 é só sobreviver |
| Reserva de lenha na evolução (outono e inverno) | 1, 7 | **ENTRA (B1)**: a casa não gasta a lenha do inverno sozinha |
| Trabalho de cada pessoa + mudar profissão | 4 pessoas, 8 viva, 9 posicionar | **ENTRA (B2)**: mecânica nova do pacote |
| Frio que mata nas tendas | 1, 4, 6 | **ENTRA (B3)**: mecânica nova do pacote |
| Alegria desde o começo, com frio e tenda no inverno | 1, 4 / risco no 7 | **DEPOIS (B4)**: decidir depois do playtest do B3 |
| Gado / pasto | 5, 6 | **DEPOIS (Pacote C)**: o usuário disse "talvez"; uma mecânica por vez. Quando entrar, o Mercado passa a pedir gado |
| Doença | 6 | **FORA**: é o pacote Doenças (Ano 4). O frio mata direto, sem estado "doente" |
| Renomear Tenda → Cabana | 7 | **Pergunta ao usuário** (só texto; a arte é tenda) |
| "Chamar trabalhador" no balão do local de trabalho | 7 | **DEPOIS**: primeiro ver se a ficha basta |

Ordem: B1 → B2 → B3 → (B4). Cada um vai sozinho para o main, com sim-tester depois.
B1 não tem mecânica nova (dados, exigências, objetivos). B2 e B3 têm uma cada.

Fora do Pacote B: gado, pasto, roupas, doenças, eventos novos, comércio do mercado, história,
qualquer mudança visual do Pacote A.

## 2. B1 "Madeira antes da praça" (sem mecânica nova)

### Regras
1. **Casa de barro** exige só `road` e paga **5 de madeira** ao subir (igual).
2. **Casa de pedra** exige `road`, `plaza` e paga **10 de pedra** (sai `market`).
3. **Casa grande** exige `road`, `plaza`, `market`, `park` e paga 10 pedra + 5 madeira (igual).
4. **Praça** sai do começo. Liberada pelo objetivo 5 (3 casas de barro).
5. **Reserva de lenha:** no outono e no inverno, uma casa só paga madeira para subir se, depois de
   pagar, `firewoodShort` continuar 0. Senão espera pronta com `waiting: 'wood'` (regra que já
   existe), motivo novo `firewood`. A construção feita pelo jogador não tem reserva (escolha dele),
   mas a prévia avisa.
6. Tenda continua com 3 lugares. Casal na tenda cheia não tem filho (regra atual).

### Dados
- `houses.json`: Barro `needs` ["road"]; Pedra `needs` ["road", "plaza"]; Grande ["road", "plaza",
  "market", "park"].
- `rules.json > startUnlocked`: sai "plaza".
- `goals.json`: tabela da seção 6.
- `tutorial.json`: sai o passo `plaza`; o `lumber` vem antes do `house`:
  road → gather → field → lumber → house → wedding. `extras.market` fica.
- Sem número novo para a reserva (usa `firewoodShort`).

### Na tela (copywriter)
- Balão da tenda: "Casa de barro em N sem · 5 de madeira" (sem praça).
- Espera pela reserva: "Pronta para barro: a madeira é a lenha do inverno".
- Prévia da Casa no outono e no inverno: "Depois: lenha para N sem" (vermelho se não chega).
- Toast ao liberar a Praça: "Praça liberada: casas de barro perto dela viram casas de pedra".
- Toast ao liberar o Mercado: "Mercado liberado: com oficina e campos, o povo tem o que trocar".
- Objetivo novo "Passe o primeiro inverno" e "Construa uma oficina".
- Revisar textos que citam praça para o barro e mercado para a pedra (Avisos, tutorial, dicas).

### Testes do core
- Tenda com rua e madeira sobe para barro sem praça; sem madeira espera `wood`.
- Barro com praça e pedra sobe para pedra sem mercado; sem praça não sobe.
- Grande pede mercado e parque.
- Reserva: no outono, com madeira que só cobre a lenha, a casa espera com motivo `firewood`; na
  primavera, a mesma casa sobe.
- Objetivo `firstSpring` cumpre na semana 1 da primavera do Ano 1 com moradores; cidade vazia não.
- Ordem dos objetivos: Praça só no 5, Oficina no 6, Mercado no 7.

## 3. B2 "Cada um no seu trabalho" (mecânica nova)

### Regras
1. **Profissão guardada:** `Person.jobId: number | null` (id do local de trabalho). Só adultos
   têm. Sai a eficiência única da cidade.
2. **Produção por local:** cada local rende × (pessoas nele / vagas). Local sem ninguém rende 0.
   O campo no inverno congela e os lavradores ficam nele, descansando (não migram mais).
3. **Quem entra sozinho:** toda semana, adultos sem trabalho ocupam vagas livres de locais ligados,
   pela ordem `jobPriority` (comida primeiro), depois pelo local mais antigo. Entre os adultos,
   quem mora mais perto do local (distância de Manhattan da casa; empate pelo id).
   Ninguém que já tem trabalho é movido pelo jogo.
4. **Perde o trabalho:** faz 50 anos (idoso), morre, sai da cidade, ou o local é demolido ou
   desligado da rua. A vaga fica livre na hora.
5. **Mudar a profissão (jogador):** escolher um local ligado com vaga livre, ou "Sem trabalho".
   Grátis e na hora. Criança e idoso não trabalham.
6. **Serviços com gente:** o Mercado só atende com pelo menos 1 pessoa. O Celeiro guarda mesmo vazio
   (regra atual: comida não some) e o Templo não muda.
7. **Desemprego** = adultos sem `jobId`. Causa única: não há vaga livre. A Alegria usa essa conta.
8. A previsão de comida usa a lotação atual de cada local (fixa até a primavera).

### Dados
- `rules.json > jobPriority`: ["fisher", "gatherer", "field", "lumber", "quarry", "granary",
  "market", "workshop", "temple"].
- `rules.json > unemploymentAlert` 6 → **3**, e o aviso vale desde o começo (sai a trava da Oficina).
- Alavanca (só se J2 falhar): `gatherer.jobs` 1 → 2.

### Como o jogador muda (celular e PC iguais)
1. Toca numa casa → balão com os moradores → toca no nome. Ou toca no morador na rua (Pacote A).
2. Ficha da pessoa: "Lenhador · Lenhador perto do bosque" e o botão **Mudar**.
3. Mudar abre uma lista curta: cada local ligado com vaga livre, "Pescador 0/1", "Lenhador 1/2"
   (o mais perto da casa dela primeiro), e "Sem trabalho". Toque escolhe. Lista vazia: "Nenhuma
   vaga livre: construa um lenhador, campo ou oficina".
4. Balão do local de trabalho: "Trabalhadores 1/2" com os nomes; tocar abre a ficha.
5. PC: o mesmo com o mouse; Esc fecha a lista. Sem atalho novo de teclado.
6. Render: os trabalhadores desenhados no local = pessoas nele (fim do "fantasma").

### Na tela (copywriter)
- Local sem ninguém: balão "Ninguém trabalha aqui: toque numa pessoa e mude a profissão".
- Toast ao construir sem gente livre: "Ninguém livre para o Lenhador: mude a profissão de alguém".
- Aviso: "N pessoas sem trabalho: faltam vagas. Construa um campo, lenhador ou oficina".
- Aviso: "Lenhador sem trabalhadores" (um por tipo, o primeiro só).
- Ficha: "Sem trabalho: todas as vagas estão cheias". Idoso: "Descansa (idoso)". Lavrador no
  inverno: "Lavrador · descansa no inverno".
- Aba Povo: "Trabalho: 8 de 10 adultos · 2 sem vaga".
- Toast "Mercado vazio: não atende as casas" quando o último sai.

### Testes do core
- Vaga livre é ocupada pela prioridade e pela distância; quem tem trabalho não é movido.
- Produção proporcional à lotação; local vazio rende 0; campo no inverno mantém os lavradores.
- Perde o trabalho aos 50, ao morrer, ao sair, ao demolir e ao desligar o local.
- `setJob` aceita local ligado com vaga; recusa local cheio, desligado, criança e idoso; "Sem
  trabalho" libera a vaga e a pessoa não volta sozinha na mesma semana (volta na seguinte só se
  houver vaga: regra 3).
- Mercado sem ninguém não cobre; celeiro vazio guarda.
- `unemployed` = adultos sem `jobId`; a previsão segue a lotação.
- Determinismo: mesma seed, mesmas profissões.

### Bots (sim-tester)
- Comum: se um local fica vazio por 4 semanas e há lavradores sobrando ou desempregados, move um.
  Antes do inverno, se a lenha falta, move um lavrador para o lenhador.
- Distraído: nunca muda profissão.

## 4. B3 "O frio pesa" (mecânica nova: morrer de frio)

### Regras
1. **Tenda gasta mais lenha:** Tenda 0,3 → **0,5** por semana no inverno (6,5 por inverno). Com
   5 tendas, 32,5 dos 40 de madeira iniciais. Construir casas (10) e subir para barro (5) disputam a
   mesma madeira.
2. **Morte de frio**, a cada semana de inverno, por pessoa, sorteio próprio:

| Onde | Vulnerável (até 4 anos ou idoso) | Outros |
|---|---|---|
| Tenda, com lenha | 0,5% | 0 |
| Tenda, sem lenha (frio) | 4% | 1% |
| Barro ou melhor, sem lenha | 1% | 0 |
| Barro ou melhor, com lenha | 0 | 0 |

3. **Fome e frio juntos:** as chances da tabela dobram. O sorteio da casa (cair ou ir embora)
   continua um só, como hoje.
4. Morte de frio usa a morte atual (viúvo, órfão, casa que esvazia guarda o nível), causa nova
   `coldDeath`. Marca `winterLoss` (não vence o marco do inverno).
5. Ordem na semana: depois da queima da lenha e antes das casas.

Conta esperada (5 tendas, 15 pessoas, ~3 vulneráveis): inverno com lenha ≈ 0,2 mortes. 4 semanas
de frio ≈ 1 morte. Inverno inteiro sem lenha ≈ 3–4 mortes, mais as tendas que vão embora.

### Dados
- `houses.json > firewood`: Tenda 0,5.
- `rules.json > coldDeath`: `{ "childAge": 4, "tent": [0.005, 0], "tentCold": [0.04, 0.01],
  "houseCold": [0.01, 0], "famineFactor": 2 }` (pares = vulnerável, outros).

### Na tela (copywriter)
- Toast "Morreu Ana, 3 anos: frio na tenda" (discreto, como a morte por idade; 1 por semana, o resto
  soma: "Mais 2 morreram de frio").
- Aviso no outono, com tendas: "Tendas são frias: crianças e idosos podem morrer no inverno. Suba
  para barro (5 de madeira)".
- Balão da tenda no inverno: "Frio: risco para crianças e idosos" (vermelho sem lenha).
- Fim do inverno: "O inverno levou N pessoas" (só se N > 0).
- Derrota e Estatísticas: mortes de frio no ano.

### Testes do core
- Tenda com lenha: só vulneráveis morrem (chance 0,005, rng fixo); adulto nunca.
- Sem lenha: chances da tabela por tipo de casa; barro com lenha: ninguém morre.
- Fome + frio dobra; fora do inverno ninguém morre de frio.
- Morte de frio libera cônjuge, vaga de trabalho (B2) e esvazia a casa quando é o último.
- Evento `coldDeath` e `winterLoss`; determinismo pela seed.

## 5. B4 "Alegria desde o começo" (DEPOIS; decidir após o playtest do B3)
- `happinessOn` sempre (sai a ligação com o Parque). Novos motivos em `rules.json > happiness`:
  `tentWinter` −10 (tenda no inverno), `cold` −20 (casa no frio). Mesmo efeito de hoje: imposto
  ±20% e nascimentos 0,5–1,5×. Carinha na pílula desde o começo.
- Risco: o pilar 7 (entender em 1 minuto). Por isso fica para depois de sentir o B3.

## 6. Objetivos novos (`goals.json`, B1)
| # | Texto | Tipo | Prêmio | Libera |
|---|---|---|---|---|
| 1 | Comida até a primavera | foodUntilSpring | 30 | Celeiro |
| 2 | Primeiro casamento | milestone firstWedding | 20 | – |
| 3 | Passe o primeiro inverno | milestone **firstSpring** (novo) | 40 | – |
| 4 | Primeiro nascimento | milestone firstBirth | 30 | Pedreira |
| 5 | Tenha 3 casas de barro | houses 3, nível 2 | 40 | Praça |
| 6 | Receba a primeira caravana | milestone firstCaravan | 50 | Oficina |
| 7 | Construa uma oficina | build workshop 1 | 40 | Mercado |
| 8 | Chegue a 30 moradores | residents 30 | 50 | – |
| 9 | Tenha 6 casas de pedra | houses 6, nível 3 | 60 | Parque (e a Alegria) |
| 10 | Uma criança da cidade virou adulta | milestone firstGrownUp | 80 | – |
| 11 | Chegue a 45 moradores | residents 45 | 80 | – |
| 12 | Tenha 4 casas grandes | houses 4, nível 4 | 80 | – |
| 13 | Terceira geração | milestone thirdGeneration | 100 | – |
| 14 | Chegue a 65 moradores | residents 65 | 100 | – |
| 15 | Chegue a 85 moradores | residents 85 | 120 | – |
| 16 | Chegue a 100 moradores | residents 100 | 120 | Templo |
| 17 | Chegue a 150 moradores | residents 150 | 175 | – |
| 18 | Chegue a 175 moradores | residents 175 | 200 | – |
| 19 | Construa o Templo | build temple | vitória | – |

- `firstSpring`: semana 1 da primavera do Ano 1 com alguém morando. Não é "inverno vencido" (que
  pode travar um ano inteiro); quem perdeu gente ainda passa.
- Sai "125 moradores" para o total não crescer (19 objetivos).
- O Ano 1 fica com: comida, casamento, inverno, talvez o nascimento. Nada de praça ou mercado.
- Quando o gado entrar (Pacote C), o objetivo 7 vira "Tenha gado e uma oficina".

## 7. Critérios do sim-tester (100 seeds, 700 semanas, base = main com o B anterior)
Ficam: A1 (vitória do Comum em 25–35 min), A2 (Comum vence 50–80%, Distraído ≤ 20%, derrotas do
Comum ≤ 5%), A9 (Ano 2: ≥ 3 casamentos, ≥ 5 nascimentos), W2 (espera por material ≤ 26 sem).

| # | Medida | Alvo | Pacote |
|---|---|---|---|
| S1 | Casas com gente no fim do Ano 1 (Comum, mediana) | 4–7 | B1 |
| S2 | 1ª casa de barro (Comum, mediana) | semana 8–20 | B1 |
| S3 | Mercado liberado (Comum, mediana) | semana ≥ 78 | B1 |
| S4 | Derrota no Ano 1 (Comum) | ≤ 2% | B1–B3 |
| J1 | Local de trabalho vazio por > 8 semanas seguidas (Comum, partidas) | ≤ 10% | B2 |
| J2 | Desempregados no Ano 1 (Comum, mediana semanal) | ≤ 2 | B2 |
| J3 | Distraído (não muda profissão) com lenhador vazio em algum inverno | ≥ 40% | B2 |
| F1 | Comum com frio em algum inverno | 40–70% | B3 |
| F2 | Comum com frio no Ano 1 | 20–40% | B3 |
| D1 | Mortes de frio no Ano 1 (Comum) | mediana 0–1, p90 ≤ 3 | B3 |
| D2 | Mortes de frio na partida (Comum, mediana) | ≤ 4 | B3 |
| D3 | Mortes de frio no Ano 1 (Distraído, mediana) | ≥ 2 | B3 |

Alavancas, uma por rodada, nesta ordem:
1. S1 alto ou F2 baixo: Tenda `firewood` 0,5 → 0,6. F2 alto ou S4 > 2%: 0,5 → 0,4.
2. F2 alto: `startMaterials.wood` 40 → 50.
3. D1 alto: `coldDeath.tentCold` [0,04, 0,01] → [0,03, 0,005].
4. S2 cedo demais (< 8): Barro `materials.wood` 5 → 10.
5. J2 alto: Coletora `jobs` 1 → 2 (teto igual).
6. W2 ou A1 longos: Lenhador `gather.max` 2 → 2,5.
7. S3 cedo: Oficina para o objetivo 8.

## 8. Estimativa (uma pessoa)
| Sub | Trabalho | Tempo |
|---|---|---|
| B1 | dados, exigências, reserva de lenha, `firstSpring`, objetivos, tutorial, textos, testes, docs | 3–4 h + 1–1,5 h de sim |
| B2 | `jobId`, atribuição, produção por local, previsão, ficha "Mudar", balão do local, render, bots, testes | 9–11 h + 1,5–2 h de sim |
| B3 | lenha da tenda, morte de frio, toasts e avisos, testes | 3–4 h + 1–1,5 h de sim |
| B4 | Alegria desde o começo (se aprovado) | 2–3 h + 1 h de sim |

Total B1–B3: **~19–24 h**. Com B4: ~22–28 h. B2 é o maior risco (mexe em toda produção e na
previsão).

## 9. Docs a atualizar junto com cada sub
`docs/GAME_DESIGN.md` (Casas, Início, Construções, Simulação, Pessoas, Lenha e inverno, Objetivos,
Tutorial, Felicidade no B4), `docs/TESTING.md` (cenários da ficha com "Mudar" e do local vazio),
`docs/design.md`.

## 10. Perguntas ao usuário
1. Renomear "Tenda" para "Cabana"? (Recomendado: manter Tenda; a caravana chega com tendas.)
2. B4 (Alegria desde o começo) entra logo depois do B3 ou espera o playtest?
3. Gado: confirmar que fica para o Pacote C, logo depois do B.

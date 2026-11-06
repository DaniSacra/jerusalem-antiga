# Sim-tester — Pacote B2 "Cada um no seu trabalho" (2026-11-06)

Base: commit f1ccb01. 1000 semanas, 1 semana = 3,2 s em 1x. Comum e Distraído com 100 seeds; Eficiente e
Pescador com 20 seeds (o planejador é lento: 40 seeds passam de 10 min). Comparação com `sim-tester-b1.md`.
Nada mudou em `src/`. Só `tools/sim/survival.ts` e `tools/sim/run.ts`. Propostas medidas com `--set`.

## 0. Bots (só em `tools/sim`)
Campos novos no perfil: `movesJobs`, `emptyWait`, `jobDonors`, `answersIdle`. Cada troca de profissão
(`setJob`) gasta 1 das 2 ações da semana.

| Bot | O que faz com as profissões |
|---|---|
| Comum | Local vazio por **4 semanas** → move alguém: desempregado; lavrador sobrando (qualquer um com o campo congelado; fora do inverno, de campo com 2, se a comida dá para uma estação); de um local de menor prioridade com 2+ pessoas para um local de comida vazio (com fome ou "nascimentos: comida" na tela, até o único trabalhador); de outro local do mesmo tipo com 2+ (dois mercados: um em cada). Outono/inverno com o aviso de lenha visto há 3 semanas: um lavrador vai para um lenhador com vaga. Responde ao aviso "N sem trabalho" (3, desde o começo) com o que ele pede: oficina; senão lenhador (sem lenhador, madeira < 20 ou inverno) ou campo. Não constrói outra comida nem outro mercado enquanto um do tipo está vazio (vê o balão). |
| Distraído | Nunca muda profissão (igual ao plano). |
| Eficiente / Pescador | O mesmo, com espera de **1 semana** e doadores mais largos: qualquer local de prioridade menor com 2+ pessoas. Na conta da comida (`bestFood`), a cópia com o prédio novo recebe gente na mão (livres ou quem ele moveria). |

Correções do que usava a eficiência única:
- `plannerFields`: comida fixa = soma de `gatherYield × staffOf` (antes `× eco.efficiency`); campo novo conta cheio.
- `res.food.*` (participação de cada fonte): `× staffOf(b, crewCounts)` por prédio.
- **Bug achado no bot (não no core):** na cópia de `bestFood`, o prédio ainda fora da rua ficava sem equipe (`place` deixa desligado; `setJob` religa e tira). O Pescador nunca construía comida que precisasse de rua. Sem a correção: **0% de vitória, 85% de derrota**. Com a correção: **100%**. Se a prévia da tela (`foodAfter`) tiver a mesma lógica para um lugar ainda sem rua, vale conferir.
- `staffAware` (jobs ≤ adultos) continua valendo: ele compara vagas e adultos, não a eficiência.

Medidas novas (`Result.b2`, linhas `J1…`/`empty…` em `--brief`): semanas-prédio com equipe 0 (por tipo e no Ano 1),
a maior sequência de um local vazio (com e sem campo congelado/lenhador sem bosque; sem campos), lenhador vazio no inverno,
trocas do bot.

### O bot do plano, ao pé da letra, perde
| Comum (100 seeds) | Vence | Semana (min) | Derrotas | J2 |
|---|---|---|---|---|
| B1 (d90403f, bot do B1) | 37% | 742 (39,6) | 0% | 7 |
| B2 com o bot do B1 (não move ninguém) | 23% | 786 (41,9) | **16%** | 7 |
| B2, bot do plano (só desempregado e lavrador sobrando) | 23% | 738 (39,4) | **14%** | 7 |
| **B2, bot Comum final (acima)** | **71%** | **637 (34,0)** | **0%** | **0** |

As derrotas são por dívida: sem ninguém livre, o Comum faz pescador atrás de pescador, todos vazios, e paga a manutenção
(seed 8: 12 pescadores vazios, 25 crianças para 14 adultos, fome e dívida na semana 187). O ganho do bot final vem de
duas coisas: tirar alguém de um mercado/oficina para a comida vazia e responder ao aviso de desemprego.
**Leitura para o diretor:** o B2 exige que o jogador mexa nas profissões. Quem não mexe (Distraído e o bot do plano) perde
muito mais que no B1. Isso combina com o pilar, mas o balão "Ninguém trabalha aqui" e o aviso de desemprego viram
peças centrais do jogo.

## 1. Metas por jogador (mediana da semana; minuto em 1x)
| # | Meta | Comum sem | min | Eficiente sem | Pescador sem | Distraído sem |
|---|---|---|---|---|---|---|
| 1 | Comida até a primavera | 1 | 0,1 | 1 | 1 | 27 |
| 2 | Primeiro casamento | 7 | 0,4 | 3 | 4 | 28 |
| 3 | Passe o primeiro inverno | 26 | 1,4 | 26 | 26 | 29 |
| 4 | Primeiro nascimento | 27 | 1,4 | 27 | 27 | 31 |
| 5 | 3 casas de barro | 28 | 1,5 | 28 | 28 | 102 |
| 6 | Primeira caravana | 76 | 4,1 | 71 | 71 | 105 |
| 7 | Construa uma oficina | 102 | 5,4 | 72 | 77 | 115 |
| 8 | 30 moradores | 114 | 6,1 | 97 | 100 | 416 |
| 9 | 6 casas de pedra | 119 | 6,3 | 99 | 110 | 469 |
| 10 | Criança virou adulta | 192 | 10,2 | 189 | 188 | 470 |
| 11 | 45 moradores | 221 | 11,8 | 192 | 199 | 615 |
| 12 | 4 casas grandes | 225 | 12,0 | 200 | 227 | 650 |
| 13 | Terceira geração | 274 | 14,6 | 283 | 280 | 651 |
| 14 | 65 moradores | 339 | 18,1 | 285 | 292 | 781 |
| 15 | 85 moradores | 391 | 20,9 | 344 | 347 | 846 |
| 16 | 100 moradores (Templo) | 439 | 23,4 | 377 | 399 | 862 |
| 17 | 150 moradores | 588 | 31,4 | 470 | 547 | 958 |
| 18 | 175 moradores | 637 | 34,0 | 532 | 598 | 925 |
| 19 | Templo (vitória) | **637** | **34,0** | 578 (30,8) | 600 (32,0) | — |
| | Vencem em 1000 sem | **71%** | | 100% | 100% | **0%** |
| | Derrotas | 0% | | 0% | 0% | **46%** |

B1 → B2: Comum 37% → 71%, 39,6 → 34,0 min. Eficiente 95% → 100%, 29,9 → 30,8 min. Pescador 98% → 100%, 31,0 → 32,0 min.
Distraído 3% → 0% (no B1 com o mesmo bot: 1%, derrotas 2%) e **derrotas 2% → 46%** (dívida: ele constrói, os
prédios ficam vazios e cobram manutenção; 2323 semanas-prédio vazias por partida).

Esperas do Comum entre metas: 1 6 19 1 1 48 29 1 1 73 26 1 48 52 62 41 **129** 46 0. A pior continua sendo a do
objetivo 17 (100 → 150): 129 semanas = 6,9 min, acima do teto de 5 min. A meta 2 (casamento) passou de 4 para 7 semanas.

## 2. Critérios (seção 7)
| # | Alvo | Comum | Eficiente | Distraído | B1 (Comum) |
|---|---|---|---|---|---|
| S1 casas com gente na sem 52 | 4–7 | **5** (p10–p90 4–6) ok | 5 | 2 | 5 |
| S2 1ª casa de barro | sem 8–20 | **11** (p25–p75 11–12) ok | 11 | 11 | 12 |
| S3 Mercado liberado | ≥ 78 | **102** (90% ≥ 78) ok | 72 (40%) | 115 | 89 |
| S4 derrota no Ano 1 | ≤ 2% | **0%** ok | 0% | 0% | 0% |
| A1 vitória do Comum | 25–35 min | **34,0 min** ok (p25–p75 31,8–36,4) | | | 39,6 falha |
| A2 Comum / Distraído / derrotas | 50–80 / ≤ 20 / ≤ 5 | **71%** ok / 0% / 0% | | | 37% falha |
| **J1** local vazio > 8 sem seguidas (partidas) | ≤ 10% | **89% falha** | 90% | 100% | — |
| **J2** desempregados no Ano 1 (mediana) | ≤ 2 | **0** (p90 1) ok | 2 | 0 | 7 |
| **J3** Distraído com lenhador vazio em algum inverno | ≥ 40% | | | **92%** ok | — |
| A9 Ano 2 casamentos / nascimentos | ≥ 3 / ≥ 5 | 2 / 7 | 2 / 8 | 3 / 2 | 2 / 8 |

Desemprego no Ano 1: Comum 0 (p90 1), Eficiente 2 (p90 4), Pescador 4, Distraído 0 (p90 3).
Semanas-prédio com equipe 0, mediana por partida: Comum 146 (p90 717; Ano 1: 4), Eficiente 202, Distraído 2323.
Por tipo (soma por partida): Comum campo 277, lenhador 35, pedreira 29, mercado 23, oficina 19, pescador 12.
Distraído: mercado 1061, campo 516, pedreira 351, lenhador 226, coletora 209.

### J1 falha: o motivo
- O local vazio por muito tempo do Comum é quase sempre um **campo** (64 de 89 partidas). Sem contar campos,
  J1 = 68%; sem contar campo congelado e lenhador com o bosque cortado, 83%. Eficiente: oficina (10 de 18).
- Não é falta de reação: o bot move gente sempre que existe alguém livre pelas regras dele. O local fica vazio
  porque **há mais vagas que adultos**. Ex. seed 1, semana 79: 6 adultos para 4 campos, 2 lenhadores, 2 pedreiras
  e 1 coletora (19 vagas). A cidade tem muitas crianças: os adultos não dão conta.
- Antes do B2 isso não aparecia: a eficiência única espalhava a falta por todos. Agora ela aparece como prédio vazio.
- **Nenhuma alavanca de dados resolve J1 sem mudar o jogo** (menos vagas por prédio deixaria as cidades sem gente
  para os novos prédios). Proponho que o diretor reescreva J1, por exemplo: "local vazio > 8 semanas com alguém
  desempregado ou um local do mesmo tipo com 2+" (o jogador tinha como resolver). Pelo bot, isso é 0% por construção.
  Outra opção: contar só locais que importam (comida, lenhador, mercado) fora do inverno.

### J2: a alavanca do plano não resolve
| Comum que **não** responde ao aviso de desemprego | J2 | Vence |
|---|---|---|
| `gatherer.jobs` 1 (hoje) | 7 (p90 10) | 34% |
| `gatherer.jobs` **2** (alavanca 5) | 6 (p90 9) | 38% |
O desemprego do Ano 1 vem de 7 adultos sem prédio, não de uma coletora pequena. O que zera o J2 é o jogador
responder ao aviso "3 sem trabalho" desde o começo (que é o que o B2 trouxe). **Não recomendo a alavanca.**

## 3. P1 e P2 do B1 com a produção por equipe (Comum final, 100 seeds)
| Mudança | Vence | Semana (min) | Pior espera | Outras |
|---|---|---|---|---|
| Nada (B2) | 71% | 637 (34,0) | g17 129 sem (6,9 min) | frio em algum inverno 54%; casa esperando lenha 6 casa-sem |
| P1 `lumber.gather.max` 2 → 2,5 | 73% | 628 (33,5) | g17 132 | frio 57%; S3 97 (75% ≥ 78) |
| P2 metas 17/18 → 130/160 | 73% | 619 (33,0) | g17 **74 (3,9 min)**, g18 67 | S1–S4 iguais |
| P1 + P2 | 75% | 603 (32,2) | g17 76, g18 66 | S3 97 (75%) |
| B1: P1 | 37% → 68% | 742 → 647 | | |
| B1: P1 + P2 | 69% | 629 (33,5) | 83 | |

- **P1 perdeu quase todo o ganho.** No B1, ele dava +31 pontos de vitória e −95 semanas. Agora dá +2 pontos e −9 semanas.
  Motivo: o gargalo de madeira do B1 era o Comum fazendo o lenhador tarde e sem gente. Agora o lenhador ganha gente
  (aviso de desemprego, lavrador no inverno). Casa esperando lenha no Ano 1: 0 (no B1, 73% das partidas). Hoje,
  P1 também puxa o S3 para mais perto de 78 (75% das partidas ≥ 78).
- **P2 continua valendo**: a pior espera do Comum cai de 6,9 min para 3,9 min. É o único jeito, entre as medidas,
  de cumprir "nenhuma meta acima de 5 min".

## 4. Propostas para `src/data` (aprovação do game-director)
| # | Mudança | Antes → depois (Comum, 100 seeds) | Recomendação |
|---|---|---|---|
| P2 | `goals.json`: objetivo 17 150 → **130**, objetivo 18 175 → **160** (textos "Chegue a 130/160 moradores") | pior espera 129 → 74 sem (6,9 → 3,9 min); vitória 71 → 73%; 34,0 → 33,0 min; S1–S4 iguais | **Entra** |
| P1 | `buildings.json > lumber.gather.max` 2 → 2,5 | +2 pontos, −9 sem; S3 102 → 97 | **Não é mais preciso** (A1 e A2 já passam). Deixar para o B3, se o frio do barro faltar madeira. |
| — | `gatherer.jobs` 1 → 2 (alavanca 5) | J2 7 → 6 no Comum passivo; o Comum final já tem J2 = 0 | **Não** |
| — | J1 | nenhuma mudança de dados resolve | **Reescrever o critério** (seção 2) |

## 5. Outros problemas
- **Distraído perde 46% por dívida** (B1: 2%). Ele constrói comida, mercado e pedreira sem ninguém para trabalhar;
  os prédios vazios cobram manutenção. O alvo A2 é "Distraído ≤ 20% de vitória", e isso passa. Mas perder metade
  das partidas por dívida, e não por fome ou frio, pode frustrar. Sugestão para o diretor (regra, não dado): um local
  vazio não pagar manutenção, ou pagar metade. Não medi, porque é regra do core.
- **Mercado vazio**: o Comum, no B2 sem o bot novo, fazia mercados seguidos (até 12) porque o vazio não atende.
  O bot final não faz outro enquanto um está vazio. Um jogador real pode cair nisso; o toast "Mercado vazio" ajuda.
- **Prata parada:** igual ao B1 (mais de 300 por mais de 26 semanas em 99% das partidas do Comum).
- **Pedra sobrando** (W4): 99% das partidas acima de 300 por mais de 52 semanas, igual ao B1.
- **Frio:** o Comum final tem frio em algum inverno em 54% das partidas (B1: 87%). No Ano 1, 1%. Houve 6 saídas por frio
  no Ano 1 (somando as 100 partidas). F1 e F2 ficam para o B3.
- **A9:** 2 casamentos no Ano 2 (alvo ≥ 3), igual ao B1.

## Como reproduzir
`timeout 600 npm run sim -- --bots comum --seeds 100 --weeks 1000 --brief`
`[--profile jobDonors='"plan"' --profile answersIdle=false]` (bot do plano)
`[--set buildings.lumber.gather.max=2.5] [--set goals.16.target=130 --set goals.17.target=160] [--set buildings.gatherer.jobs=2]`
Eficiente/Pescador: `--bots eficiente --seeds 20` (cerca de 4 min cada).

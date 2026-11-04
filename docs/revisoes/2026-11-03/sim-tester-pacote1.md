# sim-tester - Pacote 1 "Um Ano 1 justo" (commit d390712)

Medido com `npm run sim` (tools/sim/run.ts + survival.ts), 100 seeds por bot.
Nada em `src/` foi alterado. Os bots foram corrigidos em `tools/sim` (lista no fim).
Tempo real a 1x: 1 semana = 2,5 s, 24 semanas = 1 min, 1 ano = 2,2 min.

## Critérios de aceite (100 seeds por bot)

| critério | alvo | resultado | |
|---|---|---|---|
| Eficiente sobrevive ao Ano 1 | ≥ 95% | 100/100 | passou |
| Comum sobrevive ao Ano 1 | ≥ 95% | 100/100 | passou |
| Comum: mediana de fome no Ano 1 | ≤ 4 sem | 0 sem (21 seeds com alguma fome; p90 = 4) | passou |
| Eficiente: nenhuma dívida | 0 | 0/100 com prata < 0 (Ano 1, Ano 2 e depois) | passou |
| Eficiente: vitórias | ≥ 85% | 98/100 (2 presas para sempre na meta 10) | passou |
| Comum: dívida no Ano 1 | ≤ 5% | **6/100** | **falhou por 1 seed** |
| Comum: dívida no Ano 2 (só relatar) | - | 0/100 (2 derrotas por dívida depois do Ano 2) | - |
| Distraído chega ao Ano 2 | ≥ 50% | 100/100 (mediana de 5 sem de fome no Ano 1, sempre recupera) | passou |
| Caravana de 4 igual ou melhor que a de 2 | ≥ | igual ou melhor em sobrevivência, dívida, vitória e duração; o Comum tem +0,5 sem de fome em média (tabela abaixo) | passou |
| Nenhuma seed presa > 52 sem num objetivo | 0 | **Eficiente 3, Comum 17, Distraído 48** | **falhou** |
| Duração a 1x (só relatar) | - | Eficiente 2,5 min, Comum 2,6 min, Distraído 4,4 min | - |

### Dívida do Comum no Ano 1 (6 seeds)
Todas são rasas e curtas: de −1 a −7 de prata, durante 1 ou 2 semanas, entre as semanas 17 e 26 (inverno).
A causa é a mesma em todas: no inverno o campo congela e para de dar prata, mas a manutenção continua.
O Comum compra um mercado ou um celeiro no fim do outono e fica no zero.

### Seeds presas mais de 52 semanas
| bot | meta 8 (6 casas de pedra) | meta 9 (150 moradores) | meta 10 (4 casas grandes) | nunca termina |
|---|---|---|---|---|
| eficiente | 0 | 0 | 3 | 2 |
| comum | 1 | 10 | 6 | 4 |
| distraído | 7 | 32 | 8 | 8 |

- **Meta 9:** não está travada, só lenta. A cidade cresce de ~110 para 150 em 54 a 90 semanas, e a porta passa a maior parte do tempo em `wait`, `water` e `food`. Enquanto isso, a prata fica parada: no Comum seed 3, foi de 1134 para 2723 sem nada em que gastar.
- **Meta 10:** aqui sim há trava. O raio sagrado do altar (3) já está ocupado por casas que não chegam a casa grande, e não sobra lugar com mercado. As metas 8, 10 e 11 se cumprem 1 a 3 semanas depois da anterior quando não travam.

### Caravana de 2 x 4 famílias (código atual)
| bot | caravana | seeds | Ano 1 | fome no Ano 1 (mediana / média) | dívida no Ano 1 | vitórias | semana da vitória |
|---|---|---|---|---|---|---|---|
| eficiente | 2 | 38 | 38 | 0 / 0,0 | 0 | 37 | 65 |
| eficiente | 4 | 33 | 33 | 0 / 0,0 | 0 | 33 | 57 |
| comum | 2 | 38 | 38 | 0 / 0,7 | 3 | 34 | 65 |
| comum | 4 | 33 | 33 | 0 / 1,2 | 1 | 32 | 59 |
| distraído | 2 | 38 | 38 | 5 / 5,3 | 5 | 31 | 110 |
| distraído | 4 | 33 | 33 | 5 / 5,5 | 0 | 31 | 102 |

## Motivos da porta fechada no Ano 1 (% das semanas 0 a 51)
| bot | motivos |
|---|---|
| eficiente | wait 41%, aberta 25%, noPlot 20%, storage 7%, food 6%, water 1% |
| pescador | wait 43%, aberta 26%, noPlot 15%, food 14%, water 2% |
| comum | wait 37%, aberta 22%, food 19%, water 14%, storage 5%, noPlot 2%, famine 2% |
| distraído | food 41%, wait 28%, aberta 11%, famine 10%, water 7%, storage 2%, noPlot 1% |

- A água caiu de 54% (comum) e 78% (distraído) para 14% e 7%.
- `storage` aparece de 2% a 7%, quase sempre no outono do Ano 1, antes do celeiro (estoque base 50).

## Marcos (mediana da semana; minutos a 1x)
| meta | eficiente | comum | distraído |
|---|---|---|---|
| 1 Comida até a primavera | 1 (0,0) | 1 (0,0) | 18 (0,8) |
| 2 Água para todas as casas | 6 (0,3) | 7 (0,3) | 24 (1,0) |
| 3 Primeira colheita | 7 (0,3) | 8 (0,3) | 27 (1,1) |
| 4 Construa o celeiro | 8 (0,3) | 9 (0,4) | 29 (1,2) |
| 5 6 casas de barro | 19 (0,8) | 17 (0,7) | 33 (1,4) |
| 6 50 moradores | 22 (0,9) | 20 (0,8) | 36 (1,5) |
| 7 2 oficinas | 33 (1,4) | 25 (1,0) | 41 (1,7) |
| 8 6 casas de pedra | 38 (1,6) | 30 (1,3) | 51 (2,1) |
| 9 150 moradores | 53 (2,2) | 55 (2,3) | 101 (4,2) |
| 10 4 casas grandes | 55 (2,3) | 56 (2,3) | 102 (4,3) |
| 11 Templo (vitória) | 61 (2,5) | 62 (2,6) | 105 (4,4) |

## Propostas (medidas com `--set`, 100 seeds, até a semana 400; não aplicadas)
| # | dado | antes | depois | efeito medido |
|---|---|---|---|---|
| 1 | `buildings.json` celeiro `upkeep` | 2 | 1 | Dívida no Ano 1: Comum 6 → 3, Distraído 6 → 2, Eficiente 0 → 0. Vitórias e duração iguais. |
| 2 | `buildings.json` altar `radius` | 3 | 4 | Seeds presas: Eficiente 3 → 0 (vitórias 98 → 100), Comum 17 → 9 (sem fim 4 → 1), Distraído 48 → 49. Sozinha, deu 1 seed de dívida rasa no Eficiente; junto com a 1, voltou a 0. |
| 3 (opcional) | `goals.json` meta 9 `target` | 150 | 130 | Junto com 1 e 2: Comum preso 8 → 2 e Distraído 49 → 21. Mas o jogo fica ~4 sem mais curto (Comum 58 → 53 sem, 2,2 min) e a meta 9 vira 1 a 7 semanas. Fere a duração; não recomendo sem conteúdo novo. |

Pacote 1 + 2 (o que recomendo):
| bot | Ano 1 | fome no Ano 1 (mediana) | dívida no Ano 1 / Ano 2 | vitórias | presas > 52 sem | vitória |
|---|---|---|---|---|---|---|
| eficiente | 100 | 0 | 0 / 0 | 100 | 0 | 57 sem, 2,4 min |
| pescador | 100 | 0 | 4 / 0 | 98 | 3 | 56 sem, 2,3 min |
| comum | 100 | 0 | 3 / 0 | 98 | 8 (7 na meta 9, lenta) | 58 sem, 2,4 min |
| distraído | 100 | 5 | 2 / 0 | 94 | 49 | 102 sem, 4,3 min |

Caravana com 1 + 2, de 2 para 4 famílias: Eficiente vence 38/38 e 33/33. Comum vence 36/38 e 33/33, com fome média 0,6 → 1,4 sem. Distraído vence 33/38 e 33/33.

O critério das 52 semanas continua falhando para o Comum (meta 9, lenta) e para o Distraído com qualquer número que não encurte o jogo.

## Outros achados (sem proposta, para o game-director)
1. **O jogo ficou muito curto.** Eficiente e Comum vencem em ~2,5 min, e o Distraído em 4,4 min. O alvo intermediário do design.md era ≥ 4 min na simulação.
   - As metas 1 a 4 se cumprem nas primeiras 9 semanas (22 s).
   - A meta 3 "Primeira colheita" pede 12 de comida, e um campo dá 12/sem na hora (468 / 39 sem): ela dura 1 semana.
   - As metas 3, 4, 6, 8 e 10 levam menos de 30 s depois da anterior.
2. **O campo domina a comida.** Ele dá 89% da comida do Eficiente. São 12/sem com 2 vagas, contra no máximo 4,5/sem com 1 vaga do pescador: 2,7x mais por trabalhador. O Pescador (sem campos) ainda vence 90%, então não é obrigatório, mas é a escolha óbvia. A comida estragada vai de 19% (Eficiente) a 42% (Distraído) do que se produz.
3. **Desemprego no inverno.** No inverno o campo congela e libera os trabalhadores, então o aviso de desemprego dispara. Quem obedece constrói oficinas que, na primavera, tiram gente dos campos. Os bots constroem em média 19 a 21 oficinas por partida (a meta pede 2). É uma regra do core (alerts/economy), não um número.
4. **Cidade fechada.** Sem planejar, os bots fechavam todas as pontas de rua com casas e oficinas, e o templo ficava sem lugar (templeSpots = 0 com 200 a 400 retângulos livres no mapa). Demolir resolve, como o design.md já previa. Hoje o bot demole 1 a 2 prédios por partida em média para abrir caminho.
5. **Meta 1** se cumpre na semana 1 para quem planta o campo na semana 0, o que está correto pela regra nova (é a primeira meta).

## Mudanças nos bots (tools/sim, sem tocar em src/)
- `plannerWantsGranary`: tratava o ano inteiro de colheita (468 por campo) como uma colheita só na primavera, então pedia um celeiro por campo (até 9 por partida). Agora compara a capacidade com o consumo de um inverno (13 sem x 1,2 + 10).
- `plannerFields`: só plantava no outono (regra antiga). Agora planta em qualquer estação, menos no inverno.
- O planejador contava só as vagas de quem trabalha nesta semana. No inverno o campo congelado liberava vagas, e ele construía oficinas. Agora conta as vagas do ano todo (`yearJobs`), também no gatilho de desemprego.
- `service` (poço e mercado): às vezes desistia por escolher, por causa do ruído, um lugar que não cobria nenhuma casa, e só olhava lugares já na rua. Agora ignora esses lugares, aceita até 6 células de rua (mercado girado incluso) e respeita a reserva de prata do planejador.
- O planejador não põe oficina nem celeiro no raio sagrado do altar.
- Cidade fechada: o bot abre rua demolindo (templo e terrenos novos) quando nenhuma rua sai da cidade.
- Água: se nenhum poço cabe junto de uma casa com família sem água por 4+ semanas, o bot demole essa casa (no máximo 1 por estação).
- O Comum reage ao motivo `storage` com um celeiro. O celeiro e a oficina aceitam até 6 células de rua.
- Métricas novas em `Result` e na saída: dívida no Ano 1, no Ano 2 e em qualquer momento; a maior espera num objetivo; resultados por tamanho da caravana. Corrigido: quem vencia antes da semana 52 contava como "não sobreviveu ao Ano 1".

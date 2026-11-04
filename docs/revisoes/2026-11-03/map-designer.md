# map-designer - 2026-11-03

Foco: sobrevivência: o jogador achou o jogo "meio impossível" depois do Pacote 1 de sobrevivência. Descobrir por que se perde, se o Ano 1 é justo, se a curva de dificuldade, comida, colheita, celeiro, seca e chegada de famílias estão equilibradas, e o que mudar para ficar desafiador mas jogável.

## Revisão dos mapas (somente leitura): seeds 1 a 5, mais 1000 seeds para ver a distribuição

Nada foi alterado no projeto. Os scripts temporários ficaram no scratchpad da sessão:
- `maps.ts`: mede o terreno;
- `play.ts`: joga uma abertura sensata no core real por 52 semanas;
- `five.txt`: mapas em ASCII das 5 seeds.

Como ler a tabela:
- **"Rua"** é o número de células novas de rua até o primeiro lugar que rende o máximo.
- **Rende o máximo:** pescador e coletora dão 1,5/sem cada; a coletora precisa de 15 árvores no raio 3 para isso.
- **"Lugares"** são posições de campo encostadas no rio a até 12 células de rua.

| seed | famílias / comida | rio (dist. ao altar) | bosque denso (dist.) | pescador cheio | coletora cheia | campo junto ao rio | prata que sobra (poços + pescador + coletora) |
|---|---|---|---|---|---|---|---|
| 1 | 4 / 16 sem | 14 | 18 | rua 12 | rua 13 | rua 12 (2 lugares) | **0** |
| 2 | 4 / 16 sem | 13 | 14 | rua 12 | rua 5 | rua 12 (1 lugar) | **16** |
| 3 | 2 / 10 sem (12 de comida) | 13 | 17 | rua 8 | rua 14 (1,3 com rua 6) | rua 9 (10 lugares) | 46 |
| 4 | 2 / 12 sem | 8 | 12 | rua 4 | rua 4 | rua 5 (14 lugares) | 74 |
| 5 | 2 / 13 sem | 15 | 19 | rua 14 | rua 16 (1,1 com rua 6) | rua 13 (**0 lugares**) | 30 |

**Abertura simulada:** poços, pescador, coletora e um campo no outono, se a prata der.
- **Seeds 3, 4 e 5:** nenhuma fome no ano 1, e a cidade dobra para 12 moradores.
- **Seeds 1 e 2:** fome na semana 26, logo antes da colheita, com perda de moradores. Na seed 1 a prata fica negativa.

### Sim, há começos injustos

**1. Caravana de 4 famílias: cerca de 1/3 dos mapas. É o motivo principal do "meio impossível".**
- **Tendas espalhadas.** A quarta tenda fica a oeste do altar, em (19,23), e as outras três ao norte, em y=19.
  - Pela conta, nenhum lugar livre de 2x2 para o poço (raio 4) alcança as quatro: o anel e as tendas ocupam todos os lugares que serviriam.
  - A porta das famílias exige água em todas as casas, então são 2 poços (80 de prata) antes que qualquer família chegue.
- **A conta não fecha:**
  - Com água, as tendas viram casas de barro (6 moradores) e o consumo dobra, de 2,4 para 4,8/sem. Pescador e coletora juntos dão no máximo 3/sem.
  - Em 309 de 322 mapas de 4 famílias, poços, pescador e coletora deixam menos de 30 de prata. Sem campo no outono não há colheita na primeira primavera, porque o campo feito no inverno só colhe no ano seguinte.
  - Na abertura simulada, 33 de 33 seeds de 4 famílias tiveram fome no ano 1. Sem poços não há fome, mas a cidade não cresce.
- **Comparação:** com 2 famílias, 0 de 38 tiveram fome. Com 3 famílias, 2 de 29.

**2. Rio e bosque longe ao mesmo tempo (seeds 1 e 5).**
- O rio fica a 8–18 do altar.
- O pescador cheio pede de 1 a 16 células de rua (mediana 10). A coletora cheia, de 1 a 20 (mediana 12).
- Em 108 de 1000 mapas os dois passam de 12 células. Com 4 famílias isso vira o caso da seed 1: toda a prata vai na abertura.

**3. Campos junto ao rio, os que resistem à seca.**
- Em 286 de 1000 mapas não há nenhum lugar de campo encostado no rio a até 12 células de rua (é o caso da seed 5). Em 393 de 1000 há menos de 3.
- Hoje isso não pesa no ano 1, que não tem seca (`safeYears` 1). Passa a pesar a partir do ano 2.

**4. Coletora sem lugar cheio.**
- Em 10 de 1000 mapas, nenhum lugar com rua alcança 15 árvores sem cortar árvores. Exemplo: a seed 557, com um bosque de 23 árvores.
- Perto do anel sempre há uma coletora de 1,0/sem com 1 a 6 células de rua.

### O que está bom
- Sempre há um lugar razoável para a coletora perto do anel, de 1,0/sem: as árvores ficam a 10–11 do altar, logo na borda da área livre.
- A rua sul deixa o pescador barato quando o rio passa perto da coluna 24: 1 a 5 células de rua em cerca de 10% dos mapas.
- As tendas não bloqueiam a rua, o templo nem a área livre.

### Recomendações (para o game-director decidir)

**Barato: cerca de 30 min, com teste.**
- Juntar as tendas num bloco compacto ao norte, por exemplo 2x2 tendas em y=17–20, e reservar ao lado um lugar de poço que cubra todas.
- Assim, 4 famílias custam 1 poço, não 2.
- Arquivos: `caravanSpots` em `src/core/state.ts` e o teste de mapa.

**Abertura justa no gerador: cerca de 1 a 1,5 h, com testes em `src/core`.**
- Garantir em `src/core/map.ts`:
  - um lugar de pescador cheio a até 8 células de rua da rede inicial (hoje só 397 de 1000 mapas têm);
  - uma coletora cheia a até 8 células (hoje 217 de 1000);
  - pelo menos 3 lugares de campo encostados no rio a até 12 células.
- Como fazer:
  - aproximar o bosque denso (distância [11, 15]);
  - fazer uma curva do rio chegar perto da rua sul ou do anel.
- A variedade continua no outro recurso.

**Fora do meu escopo, para o sim-tester e o game-director.**
- A armadilha do poço com 4 famílias: as casas de barro dobram o consumo antes da primeira colheita. Mesmo no mapa ideal (seed 4), 4 famílias e 2 poços apertam muito.
- Os 180 de prata da largada. Vale medir duas alternativas:
  - mais prata inicial por família;
  - comida da caravana sem o teto de 40.
- Os bots em `tools/sim/bots.ts` não constroem pescador nem coletora, então hoje `npm run sim` não mede esse começo.

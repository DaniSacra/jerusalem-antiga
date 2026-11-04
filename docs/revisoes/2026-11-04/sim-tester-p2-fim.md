# sim-tester · P2 final, ritmo do fim (rodadas R1, R2a e R2b)

- **Comando:** `npm run sim -- --bots <bot> --seeds 100 --weeks 700 --brief --set ...`, com 4 bots ×
  100 seeds por rodada. O Comum também rodou com 200 seeds.
- **Base:** main com seca 0,25 e o conserto das áreas do templo (`templeRoadSpot`, a978a90). Esse
  conserto é só de interface: o bot não usa a rua marcada, então não muda o resultado do sim.
- **Tempo real:** 3,2 s por semana.
- **Rodadas** (números só em memória):
  - R0: estado atual;
  - R1: `goals.8.reward=400`;
  - R2a: `goals.8.reward=600`;
  - R2b: R1 + `goals.8.fromYear=7`. Pelo plano, a R2b só valeria se a R1 passasse. Foi medida só
    para registro.
- **Métricas novas em `tools/sim`:**
  - `end` no `--brief`, com três números:
    - espera do objetivo 8 ao 9 (mediana e p75);
    - do 9 à vitória (mediana e p75, contando só as vitórias);
    - quantas partidas que chegaram ao 9 venceram.
  - no fim de cada partida: prata, renda e se havia lugar para o templo (`endSilver`, `endIncome`,
    `endTempleRoom`, `endTempleAny`).
  - perfil opcional `savesTemple` (`--profile savesTemple=true`): imita quem segue a linha "Junte
    800 para o Templo".

## Comum (100 seeds; entre parênteses, 200 seeds)

| Critério | Alvo | R0 (200) | R1 (400) | R2a (600) | R2b (400 + Ano 7) |
|---|---|---|---|---|---|
| Do 9 à vitória, mediana | ≤ 100 sem. | 98 (87) | **56** (56) ✅ | 13 (14) ✅ | 32 (39) |
| Do 9 à vitória, p75 | ≤ 160 sem. | 178 (171) | **165** ❌ (135) | 72 (79) ✅ | 93 (108) |
| Chegam ao 9 e vencem | ≥ 75% | 51% (44%) | **51%** ❌ (49%) | **59%** ❌ (55%) | 52% (47%) |
| Vitórias | 30–55% | 49% (43%) | 49% (48%) ✅ | **57%** ❌ (53%) | 50% (45%) |
| Vitória mediana | sem. 469–656 | 522 (506) | 509 = 27,1 min ✅ (493) | **426 = 22,7 min** ❌ (432) | 459 = 24,5 min ❌ (476) |
| Do 8 ao 9, mediana | relatar (R2b ≤ 150) | 210 | 210 | 210 | 168 ❌ |
| C1 derrotas | ≤ 5 | 1 (5) | 4 (7) | 2 (3) | 3 (5) |
| D (Distraído < sem. 150) | 0 | 0 | 0 | 0 | 0 |
| F prata parada | ≤ 9 | 4 | 4 | 4 | 4 |
| Eficiente ≥ Comum | sim | 75% ≥ 49% | 75% ≥ 49% ✅ | 75% ≥ 57% ✅ | 75% ≥ 50% |

O Eficiente fica igual em todas as rodadas: 75%, semana 424, e vence na semana do objetivo 9. Ele já
guarda prata para o templo. As 25% que ele não vence não chegam aos 500 moradores. Pescador: 4% →
5% → 8%. Distraído: vence 27% → 32% → 36%, com 5 derrotas em todas as rodadas.

## Por que nenhum prêmio chega a 75%: o Comum gasta a prata

Mais prêmio encurta a espera de quem vence, mas quase não muda quantos vencem. Olhei as 48 partidas da
R1 que chegam ao 9 e não vencem:

| Medida (fim da partida, sem. 700) | R0 | R1 |
|---|---|---|
| Chegaram ao 9 na sem. 364–425 (sobram 275+ semanas) | 37 de 48 | 39 de 48 |
| Prata no fim, mediana | 40 | 43 |
| Renda no fim, mediana | +10/sem | +12/sem |
| Com 800 ou mais no fim | 1 | 1 |
| Sem lugar pronto para o templo / sem nenhum 6x6 livre | 41 / 0 | 43 / 0 |

- Com +10 a +12 por semana durante 300 semanas, a prata não falta. O Comum é que gasta tudo em
  casas, ruas e árvores. Só o planejador guarda prata para o templo.
- Os 200 ou 400 do prêmio somem na mesma hora. Por isso a parcela que chega ao 9 e vence fica em
  ~50% com qualquer prêmio. O problema é de comportamento, não de valor.

**Comum que segue a linha de progresso** (`--profile savesTemple=true`, 100 seeds; entre parênteses,
200 seeds):

| | R0 (200) | R1 (400) | R2a (600) |
|---|---|---|---|
| Vitórias | **98%** (99%) | 98% (98%) | 99% (100%) |
| Vitória mediana | **sem. 386 = 20,6 min** (394) | 386 | 386 |
| Do 9 à vitória (mediana / p75) | 0 / 1 | 0 / 2 | 0 / 2 |
| Chegam ao 9 e vencem | 99% | 99% | 100% |
| C2 fome em ≥ 1 inverno | **1%** (3%) | 1% | 1% |
| Derrotas | 0 | 0 | 0 |

- Quem guarda prata desde o objetivo 8 já tem os 800 quando o 9 se cumpre, então o prêmio não importa.
- Nesse caso, quem decide o fim é o `fromYear` 8, e o jogo cai para cerca de 21 min. Isso fica abaixo
  do piso de 25 min, e a taxa de vitórias passa do teto de 55%.
- A fome no inverno quase some (C2 de 28% para 1–3%), porque a cidade para de crescer à frente da
  comida.
- Distraído com `savesTemple`: 35% de vitórias, semana 586, com 8 derrotas (antes eram 5).

## Decisão

Pela regra do plano, o prêmio do objetivo 9 continua 200 e o fim vai para o P3:

- **A R1 falha.** A mediana do 9 à vitória cai para 56 semanas, mas o p75 fica em 165 (acima de 160
  em 100 seeds) e só 51% das partidas que chegam ao 9 vencem (o alvo é 75%).
- **A R2a falha.** A vitória mediana cai para a semana 426 (22,7 min) e a taxa sobe para 57%, fora do
  G. Ainda assim, só 59% das partidas que chegam ao 9 vencem.
- **A R2b não se aplica**, porque a R1 não passou. Mesmo medida, ela falha: vitória na semana 459,
  com o piso em 469.

**Nada mudou em `src/data`**, então nenhum teste nem o `GAME_DESIGN.md` precisaram de ajuste.

## Para o game-director (P3)

1. **A linha "Junte 800" pode encurtar o jogo demais.** Se o jogador seguir a linha, o fim deixa de
   ser tédio e o jogo fica curto: ~21 min e ~98% de vitórias. O playtester e o fun-critic devem
   conferir se jogadores reais guardam a prata.
2. **Alavancas medidas para o P3** (100 seeds, 700 semanas). Medi só a vitória (taxa e semana); C1, D e
   F não foram conferidos nessas rodadas:

   | Muda (objetivo 9) | Comum (gasta) | Comum que guarda | Eficiente |
   |---|---|---|---|
   | `fromYear` 8 → 9 | 42%, sem. 522 | 98%, sem. 417 (22,2 min) | 75%, sem. 429 |
   | `target` 500 → 600 | 42%, sem. 533 | 97%, sem. 444 (23,7 min) | 65%, sem. 472 |
   | `target` 500 → 700 | 46%, sem. 578 | 95%, sem. 498 (26,6 min) | 50%, sem. 536 |

   - Só o alvo de 700 moradores deixa quem guarda prata acima de 25 min.
   - Mas com 700 o Eficiente quase empata com o Comum (50% contra 46%), e a espera do 8 ao 9 sobe
     para 331 semanas.
   - Não proponho nenhuma das três agora: elas dependem de como jogadores reais usam a linha de
     progresso.
3. **Cuidado com o C2.** Um jogador que guarda prata quase não passa fome no inverno. Se a linha
   funcionar, o C2 sai da faixa de 25–60%.

## Arquivos

- `tools/sim/run.ts`: `endPace` (`end` no `--brief` e no relatório completo), `qt` (quantil) e
  `--profile`.
- `tools/sim/survival.ts`: `savesTemple` (opcional, desligado por padrão) e
  `endSilver`/`endIncome`/`endTempleRoom`/`endTempleAny`.
- `docs/TESTING.md`: `--profile`, `savesTemple` e a métrica `end`. Este trecho já entrou no commit
  a978a90, feito pelo agente principal, mas o código de `tools/sim` ainda está só na árvore de
  trabalho.
- Sem mudanças em `src/data`, testes ou `GAME_DESIGN.md`. `npx vitest run`: 1146 testes passam.
  `npx tsc --noEmit` passa. Nada foi commitado.

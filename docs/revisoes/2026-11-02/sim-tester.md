# sim-tester - 2026-11-02
Foco: tudo o que já está pronto: Interface nova, pacote visual Cidade bonita (partes 1–6), Campo é trabalho e Felicidade (com Jardim)

## Relatório do sim-tester: "Campo é trabalho" + "Felicidade" (somente leitura)

Usei o código atual do working tree, com as mudanças não commitadas. Rodei `npm run sim` com 200 seeds por bot e 500 seeds nas comparações finas. Para testar números alternativos usei só `--set` em memória. Não mexi em src/, nos dados nem nos docs. Os scripts temporários (bot que conhece o Jardim e o traço mensal da felicidade) saíram de tools/sim e estão em `/tmp/claude-1000/-home-dani-projects-jerusalem-antiga/07eca283-40fb-481c-a305-b854ecaa59b1/scratchpad/_tmp_happy.ts` e `/tmp/claude-1000/-home-dani-projects-jerusalem-antiga/07eca283-40fb-481c-a305-b854ecaa59b1/scratchpad/_tmp_trace.ts`. Para rodar de novo, é preciso colocá-los outra vez em tools/sim, porque os imports são relativos a essa pasta.

### Tabelas (200 seeds, mediana; minuto = mês × 1,2 s a 1x)

**Eficiente**: venceu 200/200, sem dívida.
| Meta | Mês | Min |
|---|---|---|
| 1 6 casas | 11 | 0,2 |
| 2 20 moradores | 12 | 0,2 |
| 3 5 de barro | 13 | 0,3 |
| 4 2 oficinas | 24 | 0,5 |
| 5 80 moradores | 29 | 0,6 |
| 6 6 de pedra | 39 | 0,8 |
| 7 150 moradores | 42 | 0,8 |
| 8 4 grandes | 45 | 0,9 |
| 9 Templo | 49 | 1,0 |

**Comum**: venceu 199/200 (500 seeds: 496/500). 24/200 partidas tiveram dívida e se recuperaram.
| Meta | Mês | Min |
|---|---|---|
| 1 | 11 | 0,2 |
| 2 | 13 | 0,3 |
| 3 | 17 | 0,3 |
| 4 | 38 | 0,8 |
| 5 | 39 | 0,8 |
| 6 | 48 | 1,0 |
| 7 | 54 | 1,1 |
| 8 | 59 | 1,2 |
| 9 | 64 | 1,3 |

**Distraído**: perde 137/200, e 344/500 (**68,8%**; o alvo é ~60%).
| Meta | Mês | Min | Chegaram |
|---|---|---|---|
| 1 | 10 | 0,2 | 200 |
| 2 | 11 | 0,2 | 200 |
| 3 | 13 | 0,3 | 184 |
| 4 | 19 | 0,4 | 77 |
| 5 | 40 | 0,8 | 66 |
| 6 | 51 | 1,0 | 64 |
| 7 | 62 | 1,2 | 63 |
| 8 | 63 | 1,3 | 63 |
| 9 | 76 | 1,5 | 63 |

Nas derrotas, 107 de 137 param na meta 4 (2 oficinas). A derrota cai entre os meses 35 e 46 (quartis 39 a 46, ~0,8 min), quase sempre por fome que vira dívida (144 de 200 partidas terminam com fome).

### Problemas encontrados

1. **A partida está muito curta.** Comum vence em 64 meses (1,3 min de simulação). O alvo de 15–25 min fica ~15x acima, e até o alvo interno do design.md (120–200 meses) fica ~2x acima. Nenhuma meta passa de 5 min, mas quase todas levam menos de 30 s. Nas metas 2, 3, 5, 7 e 8, a mediana entre uma meta e a seguinte é de 1 a 3 meses (0,02–0,06 min). Só a meta 4 (0,4–0,5 min) fica perto de 30 s.

2. **"Campo é trabalho" deixou o jogo mais fácil e mais curto.** Comparei sem Felicidade, campo antigo (3 vagas, 0 prata) contra o atual (2 vagas, 1 prata), com 200 seeds:
   - Eficiente: 57 → 49 meses.
   - Comum: 87 → 64 meses; vitórias 189 → 200/200; meses de fome 13 → 5.
   - Distraído perde 74,5% → 65,5%.
   - Prata parada antes do templo (Comum): máximo 333 → 518; meses acima de 120: 18 → 23.

   Ou seja, a prata do campo vai para quem já está bem. O desemprego estrutural continua: meses com alerta de desemprego, Comum 40 e Eficiente 27.

3. **A Felicidade quase não muda a economia.** Com 100–200 seeds, imposto real dividido pelo imposto base:
   - Eficiente: 1,000 (felicidade média 49; 84% dos meses-casa contentes).
   - Comum: 0,994 (média 44,5; 14% tristes).
   - Distraído: 0,946 (média 35; 56% tristes).

   A causa está na fórmula do core: o fator sobe ou desce em linha reta a partir do limite até 100 ou 0. Uma casa "triste" com 30 paga 97%, e uma "feliz" com 70 paga 103%. O fator de famílias também nunca passa de ~1,0x, porque a média da cidade não chega a 65. Removendo a Felicidade do cálculo, o Distraído perde 65,6% em vez de 68,8%. É o único efeito medível, cerca de +3 pontos de derrota, vindo do −30 da fome e do −20 do desemprego.

4. **Desemprego entristece a cidade desde o começo, sem remédio.** No traço do Comum (seed 3), o desemprego fica entre 44% e 75% do mês 6 ao mês 50. Isso dá −16 a −20 de felicidade antes de a Oficina ser liberada. A cidade fica em ~40 (quase triste) a partida toda, por uma coisa que o jogador ainda não pode resolver.

5. **O Jardim não compensa.** Fiz um bot que conhece o Jardim e o põe onde há mais imposto em jogo:
   - Se só usa o Jardim quando sobra ação: o Eficiente constrói em 14% das partidas e não ganha nada.
   - Com prioridade: Eficiente fica em 50 meses (igual) e o Comum fica mais lento, 64 → 67 meses. O imposto sobe +0,3% a +1%.

   Na conta direta, 25 de custo mais 1/mês só se pagam em volta de 2 ou mais casas grandes, sem desemprego (+0,69/mês por casa grande; +0,30 por casa de pedra; +0,03 por tenda). Com o −20 típico de desemprego, uma casa de pedra vai de 40 para 60 e continua contente, ganho 0. Hoje o Jardim funciona como enfeite, não como decisão econômica.

6. **Lugar do templo.** Só 45 de 199 partidas do Comum têm lugar livre quando o templo é liberado (Eficiente 173/200, porque reserva o lote). Mesmo assim, o Comum abre um lugar em 1 mês na mediana (máximo 9), e nenhuma partida travou por falta de espaço.

7. **Beco sem saída raro na meta 8.** Com recompensa da meta 3 = 70, a seed 108 do Comum fica presa na meta 8 por 2000 meses, com 37 mil de prata. O raio do altar ficou ocupado por serviços e só cabem 3 casas grandes. O bot não demole poços nem mercados; um humano poderia demolir. Aparece em 1 de 200 partidas.

8. **Tempo morto e prata parada.** Tempo morto: o maior trecho sem ação na mediana é de 4–6 meses; o máximo do Comum foi 54 meses, e 7 de 200 partidas tiveram 12 meses ou mais. Prata parada: depois da meta 4 a prata acumula sem destino (Comum com máximo de 520 antes do templo) e só serve para o templo. O Jardim não absorveu esse excedente.

### Propostas em src/data (para o game-director decidir)

A. **Distraído perto de 60%** (escolher uma):
- **A1.** `goals.json` meta 3 `reward` **40 → 65**. Com 500 seeds: Distraído perde **60,8%**; Comum vence 97,4% (antes 99,2%); Eficiente fica em 46 meses (antes 50). Com 70, a perda fica em 60,4%. Com 75, cai para 56,4% (passa do alvo).
- **A2.** `rules.json` `startSilver` **200 → 230**. Com 500 seeds: Distraído perde 62,2%; Comum vence 98,4%; o ritmo quase não muda.
- Testei e não ajudam: `startFood` 30 → 40/45 (70,4%; piora), `famineLeaveChance` 0,2 → 0,12 (65,4%), `happiness.famine` −30 → −15 (65,6%), `happiness.idleMax` 20 → 10 (65,8%).

B. **Devolver parte do tempo tirado pelo campo:** `buildings.json` campo `silver` **1 → 0,5**.
- Sozinho, com 500 seeds: Eficiente 50 → 53 meses; Comum 65 → 73 meses, 98,6% de vitórias; Distraído perde 70%.
- Junto com a recompensa da meta 3 em 75: Distraído perde 61,4%, Comum vence 96,4% em 68 meses, Eficiente 47 meses.

C. **Duração.** Nenhuma mudança só em dados chega perto do alvo:
- Metas maiores (80 → 110, 150 → 220, 6 → 8 de pedra, 4 → 6 grandes): só +40% de meses (Comum 89 meses = 1,8 min). Além disso, 5–10 de 200 partidas ficam presas, porque a área do altar não comporta 6 casas grandes. **Não recomendo.**
- Templo 800 → 1200: só +2 meses, porque a renda no fim passa de 60/mês.

D. **Felicidade:** nenhum número de `rules.json.happiness` a torna relevante. Testei `happy` 65 → 60, `taxMax` 1,2 → 1,3 e `idleMax` 20 → 10: o imposto ficou entre 0,98 e 1,03, e o Jardim continua sem compensar.
- Se o game-director quiser que ela pese, a mudança tem de ser no core: um degrau em vez da reta (feliz = taxMax direto, triste = taxMin direto), ou a reta chegando ao máximo em ~85 e ao mínimo em ~15. Isso precisa de decisão de design e de testes. Não é ajuste de dados.
- Como ajuste leve possível agora: `happiness.idleMax` **20 → 10**. Não muda o equilíbrio (Distraído 65,8%) e tira a tristeza crônica do começo, antes da Oficina (Eficiente sobe de média 49 para 53).

**Recomendação:** A1 (meta 3 = 65) agora. B só se o game-director preferir a partida um pouco mais longa e aceitar o Comum em ~96–97% de vitórias. Para D, levar ao game-director a decisão sobre a fórmula no core antes de mexer em números.

Comandos para repetir as medições: `npm run sim -- --seeds 500 --set goals.2.reward=65`, `npm run sim -- --set rules.startSilver=230` e `npm run sim -- --set buildings.field.silver=0.5`.

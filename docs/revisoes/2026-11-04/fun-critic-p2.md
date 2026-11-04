# fun-critic · Pacote 2 "Água sai e mapa" (ea74959)

Base: números do sim-tester no d901a12 (Comum 46% de vitórias em ~27 min, 0 derrotas, prata parada 3/100, fome no inverno ~11%). Também joguei 40 seeds × 700 semanas com os 4 perfis, mais `--trace comum:2:600` e o mapa ASCII das seeds 1 e 2. As semanas dos objetivos citadas abaixo vêm dessas partidas e o sim-tester deve confirmá-las. Comparação com o P1: replay 6, curva 5, olhar 7.

## Notas
1. **Diversão de momento: 7.** "Ponho a praça e as tendas viram barro" e "ponho o parque e a casa vira grande, com 20 moradores" são ótimos. Mas a praça custa 25 e tem manutenção 1, então depois do Ano 1 vira carimbo (o Comum faz 17). A escolha de verdade é o mercado, que custa 60 e tem manutenção 4.
2. **Sempre tem algo para fazer: 5 (no P1 a nota implícita era 5).** Os objetivos 3 a 8 cabem em 5 min (sem. 68 a 169) e isso é bom. Depois vêm ~10 min sem objetivo (sem. 169 a 364, os "500 a partir do Ano 8") e mais ~6 min juntando os 800 do Templo.
3. **Curva de dificuldade: 5 (igual).** O Comum quase não sente o inverno: 11–15% passam fome, abaixo do piso de 25% (C2), e no Ano 1 ninguém passa. O Distraído passa fome em 100% das partidas. O planejador (Eficiente) não vence mais que o Comum, ou seja, pensar não paga no fim.
4. **Recompensas: 6.** Até ~9 min chega algo a cada 1–2 min. Os objetivos 7 e 8 continuam caindo na mesma semana (168/169). O objetivo 5 já fica separado do 6 (~20 semanas, J1 ok).
5. **Clareza do objetivo: 7 (melhor).** O balão "✗ Mercado (libera no objetivo 3)" e a câmera do tutorial respondem "por que minha casa não sobe?". No longo prazo, "500 a partir do Ano 8" e "juntar 800" não aparecem como progresso.
6. **Cidade viva: 7 (igual).** Os bosques e os afloramentos dão moldura e bairros naturais, e a Praça nova é bonita. A casa grande vale mais pelo visual do que pela economia. No fim o Comum espalha 30 celeiros e 20 campos.
7. **Vontade de jogar de novo: 6 (igual).** O mapa varia mais e "da próxima vez ponho o mercado no meio de três praças" já existe. Falta uma marca a bater.

## Curva da partida
- **Início (0–4 min):** bom. A praça é a primeira escolha de lugar real. Entre o objetivo 2 (sem. 15) e o 3 (sem. 68) o mercado fica trancado por ~2,8 min, mas o cadeado agora explica.
- **Meio (4–9 min):** o ponto alto. Mercado, oficina e parque caem em sequência e os bairros sobem em ondas.
- **Fim (9–27 min):** aqui a diversão cai. A cidade cresce sem meta, a prata líquida fica em +10–15/sem mesmo com 900 moradores, a comida lota o celeiro e o Templo vira espera. No `--trace` a seed 2 nunca junta os 800.

## As três perguntas
- **Onde pôr praça, mercado e parque:** é interessante onde os 3 raios se cruzam (praça 4, mercado 5, parque 4). Hoje só o mercado custa caro o bastante para doer.
- **O mapa denso dá decisões:** ainda pouco. O raio livre de 9 deixa os Anos 1–3 sem obstáculo. As rochas só barram (o uso delas vem no P3). Cortar árvore custa 5, então ninguém contorna o bosque. A Coletora bate o teto 3,5 em quase todo grupo de oliveiras, então o bosque denso não é um achado.
- **O inverno ficou fácil demais:** sim, para o Comum. O inverno só pune quem esquece.

## Três melhorias de maior impacto
1. **Fim sem meta e Templo como espera.** Proposta: objetivo 8 de 6 → 12 casas grandes (cai no meio do buraco) e prêmio do objetivo 9 de 200 → 400. Efeito: um marco por volta da sem. 250, e o Templo vira a última corrida em vez de 6 min de poupança.
2. **Inverno sem susto para quem joga normal.** Proposta: `familyFoodReserveWeeks` 2 → 1 (chega mais gente no outono e a pílula fica laranja). Efeito: "me salvei por pouco" no inverno 1, sem mexer no Distraído antes do inverno.
3. **A casa grande não paga e o bosque não importa.** Proposta: casa grande `tax` 2,5 → 3,5 e Coletora `perCell` 0,3 → 0,2 (só o bosque denso enche o teto). Efeito: subir o bairro também enche a bolsa, e achar o bosque bom vira decisão.

## Ajustes para o sim-tester medir (um por rodada)
| Ajuste em `src/data` (antes → depois) | Medir |
|---|---|
| `goals.json` objetivo 8 `target` 6 → 12 | J3, objetivos 7 e 8 em semanas diferentes, G |
| `goals.json` objetivo 9 `reward` 200 → 400 | G (taxa ≤ 50%), semanas do obj. 9 ao 10 |
| `rules.json` `familyFoodReserveWeeks` 2 → 1 | C2 (alvo 25–60%), I ≥ 95%, D, derrotas do Distraído |
| `houses.json` casa grande `tax` 2,5 → 3,5 | F ≤ 5/100, prata líquida no Ano 6, G |
| `buildings.json` Coletora `perCell` 0,3 → 0,2 | % da comida pela Coletora, C2, T |
| `rules.json` `treeClearCost` 5 → 10 | prata em Limpar, M2, células cortadas |

## Ideia ousada (OPCIONAL)
"Bairro completo": quando todas as casas no raio de uma praça viram casas grandes, a praça ganha enfeite (bandeirolas e lanternas) e dá um prêmio único de prata. Isso recompensa posicionar bem, mas arranha o pilar "uma mecânica por vez" (é um gatilho novo). Por isso fica para depois do P3.

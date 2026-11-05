# P3 "Madeira e pedra" + Povo: decisão da calibração (game-director, 2026-11-05)

Base: `sim-tester-p3.md`, `ui-p3.md`, `plano.md` (A1–A12), `plano-p3.md`, `docs/design.md`.
**[USUÁRIO]** = precisa da decisão do usuário. O resto o diretor decide.

## 1. Números em `src/data` (todos aprovados; nada a reverter)

| Mudança | Decisão | Por quê |
|---|---|---|
| Pedreira liberada pelo objetivo 3 | APROVADA | Tira a espera de 150–190 semanas por pedra (W2 138 → 25) sem regra nova. |
| Objetivo 7 = 6 casas de pedra | APROVADA | Separa os objetivos 6 e 7 e baixa a espera do objetivo 8 de 93 para 72 sem (A5). |
| Casa nova 10 de madeira | APROVADA | É o freio de moradia "à Banished" que o usuário pediu: a casa custa trabalho, não prata que sobra. |
| Madeira inicial 40 | APROVADA | Paga a casa mais cara sem travar o Ano 1 (W3 = 2) nem a 1ª caravana (A9). |
| Lenhador `max` 2 | APROVADA | Faz da madeira o gargalo e dá peso a escolher (e mudar) o bosque: pilar "posicionar bem". |
| Pedreira `max` 2 | APROVADA | Reduz a sobra de pedra (1.800 → 1.300) sem estourar W2. |
| Templo 300 de madeira | APROVADA | O Templo vira o grande projeto de madeira (precisa de planejamento) e A1 fica em 32,9 min. Se o fun-critic sentir o fim como espera, voltar para 250 (medido: Comum +3 pontos). |
| 2 casais de noivos na 1ª caravana | APROVADA | Garante A9 = 3 casamentos; A4 do Comum em 10% é o preço, e é crescimento que o jogador vê. |
| 2ª caravana [2, 3] | APROVADA | Salto menor nos Anos 4–5 (A4). |
| Inverno 1,6 / tenda 2 | APROVADA | Pilar 1: o inverno pesa, o aviso chega antes, 0% de derrotas. |

Os textos de `GAME_DESIGN.md` e `TESTING.md` em 9dd4a53 continuam valendo.

## 2. A2 (vitória geral ~30%): **[USUÁRIO]**

Recomendação: trocar A2 por **"Comum vence 50–80% até a semana 700, Distraído ≤ 20%, derrotas do
Comum ≤ 5%"** e manter A3 (Eficiente > Comum > Distraído).
Motivo: a média dos 4 bots mede os bots, não o jogador. Os planejadores crescem no máximo biológico e
nenhuma alavanca do usuário os tira de 95–98% sem passar A1 dos 35 min. "Não vencer" aqui quer dizer
"não terminar a tempo", não perder. O Distraído (4%) mostra que quem não cuida perde, o que é um desafio
justo para 12–17 anos. O Comum em 80% está no limite de cima. Se o usuário quiser mais aperto, a
alavanca é a meta do Templo (175 → 200), que mexe em todos os bots ao mesmo tempo.
O teste com jogadores reais decide o número final.

## 3. W4 (pedra parada): ENTRA AGORA, no fechamento do P3, **[USUÁRIO] confirma o tempo**

- Níveis de serviço (Celeiro, Mercado, Oficina) pagam pedra: **nível 2: 20; nível 3: 40**, em
  `buildings.json > levels[].materials`. Só pedra (a madeira já é o gargalo). A casa grande continua
  com 10 de pedra.
- Não é mecânica nova: o `plano.md` §11 já previa material nos níveis, e a regra usa o mesmo
  `missingMaterial` da construção. A melhoria também dá destino à prata parada (10.000).
- Tempo: ~2–3 h (core e testes) e ~1 h para medir de novo (W2 e A1 não podem piorar).
- Se W4 continuar acima de 10/100, W4 passa a ser só relatado e o limite de estoque fica para o P4,
  como já estava decidido. Nada de pedra a mais na casa grande nem limite agora.

## 4. A6 em 62%: ACEITO

Está 2 pontos acima da faixa, dentro do ruído (±5 em 100 seeds), com 0% de derrotas.
O Pescador e a Coletora ficam com `winterFactor` 0,3. Com 0,4, o A6 iria para 58%, mas o A9 cairia
para 2 casamentos no Ano 2, e o A9 é pedido do usuário.

## 5. Toasts que voltam depois do balão: APROVADO, com teto

Ao fechar o balão, volta **no máximo 1 toast**: o aviso mais importante que ainda vale, na ordem de
`alerts()`. As notícias que passaram (nascimento, morte, casamento, marco, objetivo) são descartadas:
ficam na lista de Avisos, no painel Objetivos e na aba Povo, e o marco já tem comemoração no mapa.
Os testes visuais de `materials` são atualizados e o `GAME_DESIGN.md` também (ui-designer).

## 6. Perguntas abertas do P3

- **Pílula da pedra no PC:** continua como está, aparece só depois de liberar a Pedreira. O celular
  e o PC seguem a mesma regra, e a pedra só aparece quando serve (pilar 7). Com a Pedreira no
  objetivo 3, isso acontece por volta da semana 9.
  O usuário pode mudar; não é necessário.
- **Balão de tora ou pedra no mapa em casa esperando material:** NÃO. A falta é do estoque da cidade, não
  do lugar da casa. A solução é um Lenhador ou uma Pedreira, não mexer na casa. Na onda das
  casas de pedra (100% das partidas, ~26 sem), seriam dezenas de balões no mapa. A pílula vermelha, o
  aviso "N casas esperando…" e o balão da casa tocada já explicam. O usuário pode mudar.

## Resumo para o usuário
1. **A2:** aprovar a troca para "Comum 50–80%, Distraído ≤ 20%, derrotas ≤ 5%" ou manter ~30%.
2. **W4:** aprovar pedra nos níveis de serviço (20/40) antes do merge (~3–4 h) ou deixar para depois.
3. (opcional) As duas perguntas da seção 6, se quiser mudar a recomendação.

## Decisão do usuário (2026-11-04)
- A2: aprovada a troca para "Comum 50–80%, Distraído ≤ 20%, derrotas ≤ 5%".
- W4: aprovada a pedra nos níveis de serviço (20/40) antes do merge; feita no commit "Service levels cost stone".

## Depois da rodada "pedra nos níveis" (2026-11-04)
- 20/40 fica: ritmo bom (A1 74%, A2 novo OK, A3 OK). W4 continua falhando (sobra 49 por 100 no Comum).
- Níveis mais caros (80/160, 100/200) não chegam a ≤ 10 e fazem o bot erguer celeiros a mais (A8/A11 caem): não entram.
- O P3 sai assim (o usuário prefere entregar e ajustar). A pedra parada vai para o P4: uma regra nova
  (manutenção em pedra ou limite de estoque), a escolher pelo game-director.

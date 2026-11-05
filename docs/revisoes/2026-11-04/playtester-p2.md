# Playtest do Pacote 2 "Água sai e mapa" (2026-11-04)

Base: main em ea74959. Testado com `npm test` (1133 ok), `tsc` (ok), simulação do core (scripts próprios
com os bots de `tools/sim`, `npm run sim -- --bots comum,distraido --seeds 60 --weeks 700 --brief`) e
Playwright no celular 844 x 390 (toque real via CDP) e no PC 1366 x 768, sementes 3, 5, 8, 11, 12, 19,
27 e 42. Nenhum erro no console. `npm run test:visual`: 3 cenários falharam na rodada completa
(`tutorial-pc`, `drag-release-on-button`, `tutorial-skip`) e passaram sozinhos (ver bug 8).

## Bugs (do mais grave ao menos grave)

1. **O Templo construído antes do Objetivo 9 é uma armadilha de dívida.** O balão diz "Vence o jogo",
   mas a vitória ainda pede 500 moradores a partir do Ano 8. Quem constrói ao liberar (Objetivo 8,
   Comum ~semana 174) gasta 800, paga 10/sem por até ~190 semanas e nada acontece (nenhum toast).
   Distraído (40 sementes): 15 de 25 constroem o templo antes do Objetivo 9, 10 entram em dívida
   esperando e 9 das 11 derrotas vêm depois do templo. No PC a prévia já mostra "Saldo depois: −5,1/sem".
   Reproduzir: semente 12, bot Comum até o Objetivo 9, escolher o Templo. Esperado: o texto não promete
   a vitória antes da hora ("Vence o jogo depois do objetivo 9 · Ano 8") e um aviso ao construir; ou o
   templo só libera quando ele é o último passo. `src/render/strings.ts:230`, `src/data/goals.json`.
2. **Objetivo 1 ainda se cumpre com a cidade vazia (variante do bug 3 anterior).** Quando a última tenda
   sai de fome, a regra da cidade vazia abre a porta, uma família parte, e com ela a caminho a previsão
   não conta ninguém comendo: "Objetivo cumprido! +30 · Celeiro" com 0 moradores, comida 0, no inverno.
   Distraído: 23 de 40 partidas (Comum 0). Reproduzir: bot Distraído, semente 1, semana 22. Esperado:
   contar as famílias a caminho (`extraTents: s.families.length`) ou exigir moradores.
   `src/core/goals.ts:58` (`foodWeeksUntilSpring`).
3. **Templo: lugar existe, mas o jogo não mostra onde.** Comum, 40 sementes, na semana em que o templo
   libera: lugar 6 x 6 já ligado em 9/40 (22%); terreno livre 6 x 6 no mapa em 40/40; rua que falta:
   mediana 2–3 células, 10+ células em 7/40, e 1/40 (semente 27) com a cidade fechada por casas, rochas
   e rio (só demolindo). Um jogador acha com paciência, mas: a prévia fica vermelha igual para "ocupado"
   e para "cabe, falta rua"; o aviso "Sem espaço para o Templo…" some em 2,6 s; nada marca as áreas
   livres. Esperado: ao escolher o Templo, contornar as áreas 6 x 6 livres (verde = ligada, amarela =
   precisa de rua; `showSpots` já existe) e prévia amarela no `noRoad`. `src/scenes/GameScene.ts:374`,
   `src/render/MapView.ts:813`.
4. **Tutorial: o último passo trava ~23 semanas em quase metade das sementes.** Seguindo o tutorial à
   risca (pescador ou coletora + campo + praça + casa), a 1ª família chega na semana 23–24 em 28 de 60
   sementes (mediana 9): o bloqueio é `storage` ("o estoque só guarda 50. Construa o celeiro") e depois
   `food` no inverno. O balão troca o texto pelo motivo (bom), mas o passo "Uma família está chegando!"
   fica ~75 s a 1x e o cenário visual só passa com `openFamilyDoor`. Esperado: o tutorial pede o celeiro
   (seta) quando o motivo é `storage`, ou o passo da família termina com a casa pronta.
   `src/scenes/GameScene.ts:532` (`checkTutorial`), `src/data/tutorial.json`.
5. **Celular: "Perde N de comida" no Demolir chega tarde.** Com o dedo, o rótulo só aparece enquanto o
   dedo está em cima (e sob ele), e soltar demole; não há como desistir (só pondo um 2º dedo). No PC o
   hover funciona. Esperado: no celular, Demolir de um celeiro com perda pede um 2º toque (como o
   Demolir do balão) ou abre o balão. `src/scenes/GameScene.ts:806` (`onUp`, `DRAG_TOOLS` com `clear`).
6. **Objetivos 7 e 8 ainda em dupla e um vazio enorme depois.** Comum (60 sementes, medianas): objetivo
   7 na semana 173 e 8 na 174; depois nada até o 9 (364): J3 = 289 semanas (~15 min a 1x). J1 (5→6)
   melhorou para 14. `src/data/goals.json`.
7. **Prévia do Templo diz "Atende 21 casas".** O raio do templo agora só dá Alegria; "atende" sugere
   evolução. Esperado: "+10 de Alegria em N casas" ou nada. `src/render/MapView.ts:800`.
8. **Testes visuais instáveis com a máquina carregada.** Na rodada completa (com a simulação rodando em
   paralelo) falharam `tutorial-pc` ("the Rua key picks the road"), `drag-release-on-button`
   (`layout` indefinido: `novaPoint`) e `tutorial-skip` (timeout); sozinhos passam (o `tutorial-pc` levou
   805 s numa rodada e 50 s na outra). `scripts/visual/run.mjs` (esperar `window.layout` no `startGame`).
9. **Menor:** casa que perde a rua cai barro → tenda → terreno em 6 semanas e a família some só com "−4" no mapa,
   sem "Uma família foi embora" (24 → 0 moradores no teste de cortar o bairro).

## Itens anteriores conferidos
- Corrigidos: porta com texto certo (bug 2); marco do inverno nunca com fome (0 de 40, bug 4); "Perde N"
  no PC e no balão do celeiro (bug 5); câmera do tutorial (bug 6: 5 sementes × 2 aparelhos, o lugar de
  cada passo e o ponto do dedo fora da interface, dando tempo ao deslize); cadeado "✗ Mercado (libera no
  objetivo 3)" sem ação "Onde pôr" (bug 7); textos da oficina (bug 9); "come +N/sem" com o inverno
  (bug 10); fila de toasts com o balão aberto (bug 11); textos menores (bug 12). Dívida do Comum (bug 1):
  0 derrotas em 60.
- Voltou em outra forma: objetivo 1 com a cidade vazia (bug 2 acima). Ainda aberto: objetivos em dupla
  (bug 6 acima).

## Confusão e esperas
- **Fome no inverno:** Comum 13% (60 sementes), Distraído 100%. Quem segue o tutorial não passa fome no
  1º inverno em 0 de 60 sementes (pescador 4,5/sem + campo); o inverno só morde quem foge do roteiro.
- Templo: o jogador que lotou o centro não sabe onde cabe 6 x 6 no isométrico (bug 3); o aviso some
  rápido. Sugestão de texto fixo na prévia: "Cabe aqui: falta ligar à rua".
- Campo com 14% de eficiência (4 oficinas, 1 tenda) não mostra balão; só a linha do inspetor explica.
  Sugestão: balão "poucos trabalhadores" abaixo de 50%.

## Controles
- Celular: dois dedos movem e a pinça dá zoom com Praça, Casa, Campo, Rua e Demolir sem construir nada
  (5 de 5); balão da tenda com "✗ Praça" e "Onde pôr uma praça" legível. Toasts ainda cobrem o balão da
  ferramenta escolhida (ex.: Templo) no celular.
- PC: mouse, teclas e prévias sem problema; aviso do templo aparece.

## Invariantes da simulação: ok
48 partidas (4 bots × 12 sementes × até 700 semanas, 32.051 semanas checadas): comida ≥ 0 e ≤ capacidade,
prata < 0 só depois da manutenção e com contagem de dívida, moradores = soma das casas, eficiência 0–1,
vagas ≤ vagas do ano, bônus da oficina ≤ 30%, altar único, templo nunca removido, objetivos em ordem e
um por vez, objetivo 9 nunca antes do Ano 8, liberações iguais aos objetivos cumpridos, nenhum id `well`
ou `garden`, grade e `connected` coerentes, cobertura igual à recalculada, porta nunca `water`. Extremos:
cortar a rua de um bairro desliga casas e praça (balão "sem rua"); templo na borda de baixo cabe (no
canto não); prata 0 bloqueia construir e deixa demolir; Demolir celeiro e cortar a rua dele dão a mesma
perda; casa no raio do altar sem parque não vira casa grande. Nenhuma falha.

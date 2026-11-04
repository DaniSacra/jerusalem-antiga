# Pacote 2 "Água sai e mapa": interface (ui-designer, 2026-11-04)

Escopo: seção 3 (itens ENTRA), 2.6 e 9 do `plano-p2.md`, só em render/scenes/strings, testes visuais
e docs. Nada em `src/core`, `src/data` ou `tools/`. Sem commit.

## Feito
| Item | Onde |
|---|---|
| Câmera do tutorial desliza até o lugar do passo (rua, `foodSpot`, `fieldHint`, `campPlazaSpot`, casa) e o põe no **meio do mapa livre**: abaixo do topo, entre os botões laterais e a coluna, acima do balão do tutorial e dos toasts (`NovaUi.freeCenter`) | `GameScene.stepSpot/glide`, `NovaUi`, `Toasts.top`, `Tutorial.top` |
| Seta no campo e na praça também; com a ferramenta escolhida a ponta fica acima da construção (não cobre a prévia); no celular continua no ponto do dedo (90 px abaixo) | `GameScene.tutorialTarget` |
| Toast da caravana não cobre a rua marcada (o mapa livre desconta os toasts); rua arrastada que passa sobre a interface avisa ao soltar: "A rua parou sob um botão: mova o mapa e continue de onde parou" | `GameScene.onMove/onUp`, `T.roadUnderUi` |
| Fila de toasts: o balão da construção tocada segura a fila (como os painéis); aviso que deixou de valer sai da fila e da tela (`valid`, `Toasts.prune`; o aviso do celeiro tem chave por "bloqueado", então "libera no objetivo 1" some ao liberar); iguais já viravam um | `Toasts.ts`, `NovaUi.refresh/update`, `notices.ts` |
| Toast final do tutorial: "Muito bem! Construa mais casas: cada uma recebe uma família" | `T.tutorial.done` |
| Demolir: pílula vermelha "Perde N de comida" na mira (celeiro ou rua que liga um; nada se 0), linha "✗ Perde N de comida" no balão do celeiro/rua e o número sobe em vermelho ao demolir (cobre o celular, onde não há mira parada) | `NovaUi.tagFor`, `Inspector.lossLine`, `GameScene.apply/demolishAt` |
| Oficina: balão com "+10% de comida dos campos (total 20%, teto 30%)" / "no teto", ou "Campos já no teto (+30%): esta oficina só dá vagas". O aviso de desemprego já tirava "oficina" com `workshopsFull` (core) | `BuildColumn`, `T.nova.workshopBonus/workshopFull` |
| "Ao evoluir": come ±N/sem com o inverno (`foodPerResident(level, week)`); imposto atual e ganho com até 2 casas (`fmt2`: 1,25 e +0,25) | `Inspector.eatsMore`, `strings.ts` |
| Balão do Campo sem frase repetida (`fieldSeasons` saiu); pílula do objetivo 1 sem "0/1" na primavera (`T.nova.goalProgress`, topo e painel); templo já lia `unlockingGoal` | `BuildColumn`, `TopBar`, `Panels` |
| Inspector: "✗ Mercado (libera no objetivo 3)"; "Onde pôr…" só com a construção liberada (já estava) | `Inspector`, `T.nova.inspect.lockedNeed` |
| Cadeado do balão no mapa de 10 para 12 px (legível no zoom mínimo) | `MapView.syncBalloon` |

## Testes visuais
- `run.mjs`: poço/jardim → praça/parque em todos os cenários; `openFamilyDoor` sem água; `tutorial-blocked`
  com motivo `food`; `build-with-mouse` usa 3, 3 (Praça) e 4 (Campo); `overlay-house-sacred-area` →
  `overlay-house-plaza-area`; `overlay-garden` → `overlay-park`.
- Tutorial: `assertStepInView` em cada passo (lugar e dedo fora da interface, do balão e dos toasts), rua
  marcada fora do toast da caravana, praça no `campPlazaSpot` (livre e atendendo as tendas), toast final.
  A captura do passo 4 agora é `tutorial-plaza`.
- Novo `p2-ui` / `p2-ui-pc`: balão com cadeado, "libera no objetivo 3", toast com balão aberto (e o
  descartado), Demolir no celeiro, faixa Moradia com Casa, Praça e Parque.
- `npx tsc --noEmit`, `npx vitest run` (1133) e `npm run test:visual` passam. `seasons-phone` e `town-art`
  falharam uma vez com `window.game` indefinido (recarga do Vite por outro agente editando `src` ao mesmo
  tempo) e passaram ao repetir.

## Docs
`TESTING.md` (tutorial, tutorial-blocked, build-with-mouse, happiness, town-art, input-phone, turn-map,
nova-phone, `openFamilyDoor`, novo `p2-ui`) e `GAME_DESIGN.md` (câmera e seta do tutorial, rua cortada,
toast final, fila de toasts, Demolir, oficina, "Ao evoluir", pílula do objetivo 1).

## Para outros
- copywriter: revisar `roadUnderUi`, `foodLost`, `workshopBonus/workshopFull`, `lockedNeed`, `tutorial.done`.
- sim-tester: `TESTING.md` linha dos bots ainda diz "põe poços" (seção `tools/sim`, fora do meu escopo).
- Notei os dados mudando durante a revisão (praça 1/sem, casa 40 prata): calibração em andamento de outro agente.
- Rodar testes visuais em paralelo com quem edita `src` recarrega a página no meio do cenário.

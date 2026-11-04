# Textos do Pacote 2 (copywriter, 2026-11-04)

Revisão da seção 9 do `plano-p2.md` em `src/render/strings.ts`. Nada fica de poço, água ou
jardim nos textos. Os números vêm dos dados. Praça e Parque (nomes, efeitos, `where`, `need`,
`happinessPart`), passo `plaza`, `tutorial.done`, `foodLost`, `workshopBonus`, `workshopFull`,
`lockedNeed` e o toast do Parque já estavam certos e ficaram como estavam. `goals.json` não mudou.

## Mudanças (em ordem de impacto)

| # | Texto atual | Texto novo | Motivo |
|---|---|---|---|
| 1 | Estatísticas: "Parque, praça e altar alegram; fome e desemprego entristecem." | "Altar, praça, mercado e parque alegram; fome e desemprego entristecem." | Faltava o mercado, que dá Alegria +5 (`rules.json`) |
| 2 | Manutenção (toast e passo do tutorial): "Agora praças, campos e demais construções custam prata por semana" | "Começou a manutenção: tudo, menos casas e ruas, custa prata por semana" | Usa a palavra "manutenção" (a mesma da tela de Estatísticas) e diz o que fica de fora (casas e ruas). Agora os dois usos leem uma só constante |
| 3 | `lockedHint`: "Parque: liberado ao cumprir o Objetivo 5." | "Parque: libera no objetivo 5" | Mesma frase do balão e do cadeado ("Libera no objetivo N"). Assim some a lista `FEMININE`, onde faltavam Praça e Coletora |
| 4 | Oficina: "+10% de comida aos campos, até +30%" | "+10% de comida dos campos, até +30%" | Mesma preposição do balão ("+10% de comida dos campos (total…)") e do GAME_DESIGN |
| 5 | Tela inicial, linha 2: "Praças perto das tendas fazem casas de barro. …" | "Tendas perto de uma praça viram casas de barro. …" | Mesma frase da dica da Praça. "Fazem" dava a entender que a praça constrói as casas |
| 6 | Tela inicial, linha 1: "Comida para o inverno: pesque, colete e plante campos no outono." | "Guarde comida para o inverno: pesque, colete e plante campos." | Começa com o verbo. "No outono" dava a entender que o campo só serve no outono, mas ele colhe na primavera, no verão e no outono |
| 7 | Passo `market`: "Casas de barro com mercado perto viram casas de pedra" | "Construa um mercado perto das casas de barro: elas viram casas de pedra" | O passo pede uma ação, como o passo `plaza` |
| 8 | `roadUnderUi`: "A rua parou sob um botão: mova o mapa e continue de onde parou" | "A rua parou sob um botão: mova o mapa e continue" | É um toast: cai de 62 para 48 caracteres e não repete "parou" |

O `docs/GAME_DESIGN.md` foi atualizado nos trechos que citam os textos 2, 4, 5, 6, 7 e 8.
`npx tsc --noEmit` e `npx vitest run` (1133 testes) passam. As capturas não foram refeitas.

## Para outros (não mexi)
- `docs/design.md` (linhas 62–63) diz Praça com manutenção 2 e Parque com custo 40 e manutenção 2.
  O `buildings.json` diz Praça com manutenção 1 e Parque com custo 60 e manutenção 1.
- Textos acima de 80 caracteres fora do P2: o aviso `deficit` (~95), `familyBlock.food` (82) e a
  linha 2 da tela inicial (83, mas ali cabe em duas linhas).
- `happinessPart.sacred` diz "Altar", mas o Templo também cobre essa parte (depois da vitória).
- `goals.json` repete o alvo dentro do texto ("Tenha 3 casas de barro"). Hoje bate com o alvo. Se o
  sim-tester mudar um alvo, o texto também tem de mudar.

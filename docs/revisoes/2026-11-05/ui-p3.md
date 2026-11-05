# UI no P3 (ui-designer) — 2026-11-05

Correções de interface no branch p3 (Madeira e pedra + pacote Povo). Sem commit.

## Causa comum de `house-people` e `tutorial` (celular)

A pílula Materiais (madeira + pedra) alonga a primeira linha do topo. A pílula da estação já não
cabia ao lado da velocidade e descia para **baixo da velocidade**, uma terceira linha. Com isso o
fundo do topo descia de ~70 para ~88 px reais (133 px de jogo). O balão da casa grande, que fica
abaixo do topo, passava das ferramentas (505 > 480). O centro livre do tutorial também descia, e o
ponto do dedo caía no balão do tutorial.

**Correção** (`src/render/nova/TopBar.ts`, `layout`): a estação fica à esquerda da velocidade, em uma
de três posições, na ordem:
1. na primeira linha, se couber;
2. na linha do objetivo, alinhada pela base dele, se o objetivo inteiro couber ao lado
   (`Pill.widthOf`, com cache). O topo não cresce;
3. embaixo da velocidade (último caso, como antes).

No celular 844 x 390 e 915 x 412, e também no PC 1366, ela agora fica na linha do objetivo.

## Toast atrás do balão (`house-waiting-stone`)

O toast já na tela quando o balão abria ia para baixo dele (`UNDER_PANEL`) e ficava meio coberto.
A regra é: com painel ou balão aberto, nenhum toast aparece. Agora os toasts na tela saem e voltam
para a frente da fila, com o tempo que faltava (mínimo 1,5 s). Voltam quando o balão fecha, e um
aviso que deixou de valer é descartado. Arquivo: `src/render/Toasts.ts`. Vale para todo toast,
inclusive o aviso de material.

## Pílulas e velocidade no PC (`MAX_FIT`)

`MAX_FIT` passou de 3 para 5:
- etapa 4: tira o "/sem" da prata e da comida;
- etapa 5: a previsão da comida vira a curta do celular ("⚠ N sem"; some "até a colheita").

Testado: prata 9.999 / madeira 999 / pedra 999 e até 99.999 / 9.999 / 9.999 cabem em 1280 e 1366,
com a Alegria tocável.

Novo cenário `top-fit` / `top-fit-1280`.

## Testes

- `tsc` ok; `vitest` 1228/1228. Uma rodada intermediária teve 3 falhas, vindas das mudanças do
  sim-tester em `src/data`, já corrigidas por ele.
- Visual ok:
  - `tutorial` (5 cenários, inclui `tutorial-blocked`);
  - `house-people` (3);
  - `materials` (3);
  - `happiness`;
  - `p2-ui` (2);
  - `nova` (4);
  - `top-fit` (2).
- `house-people` falhou uma vez em "o balão não cobre a casa" por 1,4 px: o empurrão de câmera não
  tinha terminado. Rodado sozinho, passou duas vezes. Fica a nota de que o teste é sensível a tempo.
- `materials`: a checagem "20 de madeira" passou a ler `RULES.startMaterials` (o sim-tester mudou
  para 40). Nova checagem: com o balão aberto não há toast na tela, e o aviso espera na fila.

## Docs

- `docs/GAME_DESIGN.md`: posição da estação, etapas 4–5 do `MAX_FIT`, toasts com balão aberto.
- `docs/TESTING.md`: linha `top-fit` e linha `materials` atualizadas.

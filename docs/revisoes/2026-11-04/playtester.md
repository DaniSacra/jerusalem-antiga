# Playtest do Pacote 1 "Ritmo" (2026-11-04)

Base: working tree sem commit (dados calibrados: reserva da porta 2 sem, tenda × 1,75 no inverno,
manutenção depois do Objetivo 3, imposto da tenda 1,25). Testado com `npm test` (815 ok), `tsc` (ok),
simulação do core (scripts próprios + `npm run sim -- --trace comum:1:80` e `comum:28:92`) e Playwright
no celular 844 x 390 com toque e no PC 1366 x 768 com mouse (semente 5), com tutorial e sem tutorial.
Nenhum erro no console. `npm run test:visual`: todos os 35 cenários passam.

## Bugs (do mais grave ao menos grave)

1. **Comum entra em dívida no Ano 2 e perde antes da semana 150.** Em 40 sementes (bot Comum, 160 sem):
   dívida no Ano 2 em 21/40, derrota em 2/40 (semanas 89 e 148). Logo depois do Objetivo 3 o saldo cai
   de +14,5 para −4 e −8/sem (poços, mercados, celeiros), e a dívida começa 4 semanas depois.
   Reproduzir: `npm run sim -- --trace comum:28:92` (dívida na sem 66, derrota na 89).
   Esperado: dívida do Comum no Ano 1–2 ≤ 5% (alavanca 3 da seção 2.4). Arquivos:
   `src/data/rules.json` (`upkeepStartsAfterGoal`), `src/data/houses.json` (imposto), `buildings.json` (manutenção).
2. **A porta das famílias mente sobre a comida.** Com a reserva de 2 semanas e a família nova contadas,
   a porta fecha com o motivo "a comida não dura até a primavera", enquanto a pílula de comida (PC) diz
   "até a primavera" em verde e a do celular não mostra alerta. A janela é larga: 20 a 35 de comida
   (ex.: semana 12, comida 71–101). Aparece no balão do terreno e nos Avisos.
   Reproduzir: celeiro, poço, 1 campo, 1 terreno, comida 75 na semana 12 → tocar no terreno.
   Esperado (texto da 2.6): "Falta sobra de comida para mais uma família". `src/render/strings.ts:53`.
3. **Objetivo 1 "Comida até a primavera" se cumpre com a cidade vazia.** Quando a última família vai
   embora de fome, a fome acaba (ninguém come) e o objetivo dá +30 e libera o Celeiro. Distraído: 24/40
   partidas. No navegador: "Uma família foi embora: fome" (sem 33) → "Objetivo cumprido! +30 prata ·
   Nova construção: Celeiro" (sem 38) com 0 moradores. Esperado: não cumprir sem moradores.
   `src/core/goals.ts:58`.
4. **"Primeiro inverno vencido sem perder ninguém!" no meio da fome.** Só conta casas perdidas; a cidade
   passou 11 semanas com FOME e o toast sai junto com "Fome −2" das casas caindo (mesma tela).
   Reproduzir: sem tutorial, poço + 4 terrenos, nada de comida, 3x até a primavera.
   Esperado: o marco só sem fome no inverno. `src/core/simulation.ts:101`.
5. **Demolir um celeiro joga fora o estoque sem avisar.** A comida acima da nova capacidade estraga na
   semana seguinte (trace Comum 28, sem 71: 193/350 → 50/50 no inverno, fome e derrota). O aviso de saldo
   negativo manda "use Demolir…", e o Demolir só pinta o prédio de vermelho. Esperado: na mira do
   Demolir (e ao cortar a rua de um celeiro), "Perde N de comida". `src/scenes/GameScene.ts:500` (prévia),
   `src/core/actions.ts` (`clearCell`).
6. **Celular, tutorial: o lugar do pescador fica sob o balão do tutorial.** Semente 5, 844 x 390: depois
   da rua, o lugar e a seta amarela ficam atrás do balão (y 471 de 591), e o toque mira 90 px acima do
   dedo, então o jogador precisa arrastar o mapa antes. No passo 1, se a rua for puxada nos primeiros
   ~5 s, o fim do caminho está sob o toast da caravana: a última célula não é construída (13 de 14) e o
   passo não avança, sem aviso. Esperado: a câmera leva o lugar para a área livre; o toast não cobre o
   caminho. `src/scenes/GameScene.ts` (câmera do tutorial, `attachUi` toast da caravana).
7. **Casa de barro não diz por que não sobe no Ano 1.** O balão mostra "✗ Mercado", mas o Mercado está
   trancado até o Objetivo 3 e não há linha "em N sem". Esperado: "✗ Mercado (libera no objetivo 3)".
   `src/render/nova/Inspector.ts:100`.
8. **Objetivos em dupla.** Comum (mediana): 5 na sem 100 e 6 na 98; 7 na 273 e 8 na 274 (dois toasts na
   mesma semana ou seguidos); "Tenha 2 casas grandes" nunca vira um objetivo de verdade.
   `src/data/goals.json`.
9. **Textos da oficina pela metade (2.6).** O aviso de desemprego manda "construa um campo ou uma
   oficina" mesmo com o bônus no teto; a prévia da oficina não mostra o total atual nem "no teto" (com 4
   oficinas, "Comida depois" cai de +2,9 para +2,1 e nada explica). `src/render/strings.ts:101`,
   `src/render/nova/BuildColumn.ts:161`.
10. **"Ao evoluir: come +0,4/sem" ignora o inverno** (no inverno tenda → barro é +0,1) e "imposto 1,3/sem"
    ao lado de "+0,25" não fecha a conta (1,25 arredondado). `src/core/readouts.ts:96`.
11. **Fila de toasts velha** (já marcado para o P2): "O celeiro libera no objetivo 1" junto com "Nova
    construção: Celeiro"; "casa sem água" depois de construir o poço.
12. **Menores de texto:** o balão do Campo diz a mesma coisa duas vezes (`strings.ts:218` e `:240`);
    "Templo: liberado ao cumprir o Objetivo 9." e o preço "objetivo 9" no PC sem "· Ano 8"
    (`strings.ts:160`, `:205`); na primavera a pílula mostra "Comida até a primavera 0/1".

## Confusão e esperas
- **Quem segue o tutorial não sente o inverno**: pescador (4,5/sem) + campo deixam 50/50 "cheio" o
  inverno todo. Comum: fome no Ano 1 em 0/40 partidas (o alvo C pede 40–60% em algum inverno).
- **Depois do tutorial nada acontece se o jogador não fizer terrenos**: da sem 18 à 52 (~1 min 50 s a 1x)
  só passam estações; o motivo ("não há casa vazia") só aparece nos Avisos. Sugestão para o toast final:
  "Construa mais casas: cada uma recebe uma família".
- Esperas sem casa nova, família ou objetivo no Ano 1: Comum mediana 10 sem (32 s), máximo 14 (45 s);
  Distraído mediana 16 sem (51 s). Primeira família nova: Comum sem 11, Distraído sem 24.
- Distraído: fome no Ano 1 em 40/40 e cidade vazia em 24/40 (sem derrota; o jogo segue vazio).
- O balão "Casa de barro em N sem" funciona e conta ao vivo; "fome: não evolui" aparece na fome. O
  cadeado "Libera no objetivo 9 · Ano 8", a lista "a partir do Ano 8" e a pílula do objetivo 9 cabem no
  celular (800 x 360 e 844 x 390). "cheio" só com estrago e "acaba no inverno" (PC) estão certos.

## Controles
- Celular: dois dedos movem a câmera com Rua, Casa, Campo, Poço e Demolir sem construir nada; pinça dá
  zoom sem construir. Ponto ruim: os toasts ainda cobrem o balão da casa (P2).
- PC: mouse, teclas e velocidade sem problema. Relógio a 1x: 3,28 s por semana (alvo 3,2).

## Invariantes da simulação: ok
48 partidas (4 bots × 12 sementes × 520 semanas), checadas toda semana: comida ≥ 0 e ≤ capacidade,
prata < 0 só em dívida e só depois da manutenção, moradores = soma das casas, eficiência 0–1, vagas da
semana ≤ vagas do ano, bônus da oficina ≤ 30%, altar único, templo nunca removido, objetivos em ordem,
objetivo 9 nunca antes do Ano 8, seca nunca antes do Ano 3, nenhuma prata produzida, campo não colhe no
inverno. "Casa … em 1 sem" → a casa subiu na semana seguinte em 3526 de 3526 casos. Nenhuma falha.

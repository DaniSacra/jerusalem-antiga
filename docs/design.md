# Jerusalém Antiga — direção do jogo

Mantido pelo game-director. As regras e os números completos ficam em `docs/GAME_DESIGN.md`.

## Rumo (2026-11-04): sobrevivência e contemplação
Plano do usuário: `docs/revisoes/2026-11-04/plano-sobrevivencia.md`. Plano do diretor, com o
roteiro e o Pacote 1 "Ritmo": `docs/revisoes/2026-11-04/plano.md`.
- Partida de ~30 min (~10 anos de jogo, 1 ano = 2,5–3 min a 1x); cerca de 30% dos jogadores vencem
- Vitória: o Templo com cerca de 150 moradores, umas 25 casas (no main ainda: 500 moradores a partir
  do Ano 8; muda com o Pacote Povo)
- Apego às famílias (2026-11-04, pedido do usuário): o jogador acompanha as mesmas famílias por
  gerações; a cidade cresce por dentro (casamentos e nascimentos) e o cuidado do jogador decide o
  ritmo. Famílias de fora só chegam em 2–3 caravanas anunciadas
- Casas difíceis: crescer por qualidade (evoluir) antes de quantidade (casas novas)
- Ciclo: preparar (primavera, verão, outono) → resistir (inverno) → recuperar → crescer
- Fases: Ano 1 só o inverno; Ano 2 casamentos; Ano 3 seca; Ano 4 doenças; Ano 5+ eventos (cada
  fase entra quando a mecânica dela existir)

## Pilares (vigentes desde 2026-11-04, plano do usuário)
1. Sobrevivência com recuperação: a tensão vem de comida, lenha, abrigo e pessoas; a prata é o
   meio de construir. Crises encolhem a cidade, mas sempre há caminho de volta. Perder exige a
   cidade quase vazia.
2. Ritmo contemplativo: tempo em semanas, crescimento lento, cada crescimento conquistado.
3. Contemplação da cidade: tempo para se apegar e gostar de olhar; a pressa vem só das crises,
   nunca do relógio.
4. Pessoas com história: nome, idade, profissão; nascem, casam, envelhecem e morrem.
5. Evoluir em vez de multiplicar: poucas construções, cada uma com tipos e níveis.
6. Dificuldade em camadas: cada fase acrescenta um problema.

Mantidos:
7. Simples: uma pessoa entende o jogo em menos de 1 minuto.
8. Cidade viva: gente nas ruas, casas evoluindo, coisas se mexendo.
9. A diversão é posicionar bem: o bairro inteiro sobe quando o lugar é bom.
10. Mecânica antes de história: nenhuma narrativa antes do playtest aprovar a mecânica.
11. Uma mecânica nova por vez. Exceção: o P1 "Ritmo" como bloco (várias regras pequenas a serviço
    do ritmo; nenhuma é sistema novo), aceita quando o usuário aprovou seguir o roteiro (04/11).

## Decisões tomadas
- 2026-11-04 (usuário): Pacote Povo antes de Madeira e pedra. Motivo: o Povo muda capacidade,
  crescimento e meta do templo; calibrar materiais antes obrigaria a refazer a conta
- 2026-11-04 (diretor): a casa vazia guarda o nível (`emptyLevel`) e "nível ≥ 1" continua querendo
  dizer "tem gente". Motivo: preserva o invariante usado em ~20 lugares do código (KISS)
- 2026-11-04 (diretor): "terceira geração" = filho de alguém nascido na cidade. Motivo: os jovens da
  caravana já são filhos de fundadores; "neto da caravana" aconteceria no Ano 1–2
- 2026-11-05 (diretor): calibração do P3 + Povo aprovada inteira (`docs/revisoes/2026-11-05/decisao-p3.md`):
  Pedreira no objetivo 3, objetivo 7 = 6 casas de pedra, casa 10 madeira, madeira inicial 40,
  Lenhador e Pedreira `max` 2, Templo 300 madeira, 2 noivos na 1ª caravana, 2ª caravana [2, 3],
  inverno 1,6/2. Motivo: a madeira vira o freio da moradia (pedido "à Banished") sem quebrar A1, W2 e A9
- 2026-11-05 (diretor): A6 62% aceito (ruído; `winterFactor` 0,4 derrubaria A9). Toast que volta
  depois do balão: só 1, o aviso que ainda vale; notícias passadas saem. Pílula da pedra só depois da
  Pedreira também no PC; sem balão de material no mapa (a falta é do estoque, não do lugar)
- Decidido pelo usuário (2026-11-04): A2 passa a ser "Comum vence 50–80%, Distraído ≤ 20%, derrotas
  do Comum ≤ 5%"; Celeiro, Mercado e Oficina pedem pedra para subir (20 no nível 2, 40 no nível 3)
  já no P3. Daqui em diante, as opções recomendadas entram sem perguntar: entregar e ajustar depois.
- W4 (pedra parada no fim) segue falhando com 20/40: aceito no P3; vai para o P4 com uma regra nova
  (manutenção em pedra ou limite de estoque).

## Próximos candidatos (ordem do plano de sobrevivência, um pacote por vez)
1. Povo (agora) · 2. Madeira e pedra (recalibrar) · 3. Lenha e inverno · 4. Obras com tempo ·
5. Recuperação e vitória · 6. Alojamento · 7. Governo · 8. Evoluções · 9. Pasto e roupas ·
10. Doenças · 11. Eventos da época · 12. Incêndio

## Estado atual (2026-11-04)
Os números e as regras completas estão em `docs/GAME_DESIGN.md` e em `src/data`. O que vale hoje
por cima das seções abaixo:
- Feitos e no main: Pacote 1 da sobrevivência (95dd36c), rebalanceamento do usuário (a01a506) e
  Pacote 1 "Um Ano 1 justo" da revisão 2026-11-03 (d390712, 11a95cd)
- Campo: dá comida toda semana, menos no inverno (congela). `harvest` 468 por ano = 12/sem com 2
  vagas. Sai "semeia no outono, colhe na primavera"
- Pescador e Coletora: `perCell` 0,75 e 0,3, teto 4,5/sem
- Custos do pacote M: casa 15, campo 20, poço 25, pescador e coletora 20, celeiro 40, mercado 60,
  oficina 50, jardim 35, templo 800. `workerShare` 0,5; manutenção depois do objetivo 3;
  caravana com comida para 14–22 semanas; estoque base 50
- Porta das famílias honesta (nível alvo, famílias a caminho, motivo `storage`); água conta só
  casas com família; cidade vazia nunca trava; caravana compacta com lugar de poço
- Tutorial: rua até a comida → pescador ou coletora → campo → poço → casa → família; relógio parado
  nos passos de construir; ferramentas nunca travam
- Pílula da estação com "inverno em N sem / primavera em N sem"
- Medido (sim-tester, 100 seeds): Ano 1 em 100% para Comum e Eficiente, fome mediana 0, Eficiente
  vence 98%; tutorial perde 0 de 16. Mas a partida dura ~2,5 min, as metas 1–4 caem em 9 semanas,
  o campo dá 89% da comida e 19–42% estraga

## Agora: Pacote "Povo" (pedido do usuário em 2026-11-04, especificado no mesmo dia)
Pedido: `docs/revisoes/2026-11-05/pedido-povo.md`. Especificação completa (números, dados, telas,
bots, testes, ordem e estimativa): `docs/revisoes/2026-11-05/plano.md`. Vem **antes** do P3, porque
muda a capacidade das casas, o crescimento e a meta do templo.

Mecânica nova (uma): **o povo**. Junto, por pedido do usuário, ajustes de ritmo (exceção à regra de
uma mecânica por vez, como o P1). Resumo:
- Cada morador é uma pessoa (nome judaico da época, sexo, nascimento, idade, profissão, casa, pais,
  cônjuge, filhos). Criança 0–13 (come 0,25), adulto 14–49 (trabalha, 0,2), idoso 50+ (0,15).
  Trabalhadores = adultos (sai `workerShare`). 1 estação = 1 ano de vida (recomendação)
- Morte só por idade (2% aos 50, até 35% aos 80), aviso discreto. Fome e falta de rua continuam
  levando a família inteira
- Noivado de solteiros 18–40 de casas diferentes; o casal só se casa ao achar casa vazia (senão
  "Casal esperando casa"); nascimentos com casal na própria casa, casa com lugar, comida até a
  primavera e alegria; casa cheia não tem filho
- Sai a porta das famílias (`familyChance`, `familyIntervalWeeks`, `familyBlock`); a caravana
  inicial fica, com noivos já na abertura; 2–3 caravanas raras (Ano 2–3, Ano 5–6, Ano 7–8 com 50%),
  anunciadas 4–8 semanas antes; família sem casa segue viagem
- Casas: capacidade 3/4/6/8, imposto 1,25/1,75/2,5/3,25, sobem em 11–15 semanas (sorteado por casa).
  Casa vazia guarda o nível
- Um mecanismo de níveis (1–3) para celeiro (300/600/1000; estoque base 100), mercado (raio 5/6/7)
  e oficina (+10/20/30%), com custo e manutenção por nível
- Manutenção desde a construção (sai `upkeepStartsAfterGoal`), 0,5 nas construções 2 x 2 do começo
- Pescador e Coletora a 30% no inverno
- 15 objetivos (tipo novo `milestone`): casamento, comida, nascimento, barro, 30, caravana, pedra,
  60, criança da cidade adulta, casas grandes, terceira geração, 100 (libera o Templo), 5 casas
  grandes, 150, Templo. Medir a meta do templo com 120, 150 e 200
- Telas: balão da casa com os moradores, ficha da pessoa, "Melhorar" nos serviços, aba Povo,
  avisos de casal e de caravana
- Estimativa: ~35–43 h de uma pessoa (~12–15 h numa sessão)
- Decisões em aberto: seção 10 do plano (escala de idade, casal que desiste em 52 semanas, viúvos,
  idoso com o filho, noivos na abertura, imposto por casa, caravanas, templo 150)

## Depois do Povo: Pacote 3 "Madeira e pedra" (estacionado; recalibrar antes de implementar)
Especificação: `docs/revisoes/2026-11-04/plano-p3.md`, feita para o jogo de 500 moradores. Antes de
implementar, refazer com o Povo no main (seção 11 do plano do Povo): nova linha de base, gasto de
madeira e pedra para ~25 casas, materiais nos níveis de serviço, números dos objetivos, critério B
fora, W5 com trabalhadores = adultos. Mecânica nova (uma): **materiais de obra**. Resumo (números
antigos):
- Lenhador (início; 25 prata, manutenção 1, 2 x 2, 2 vagas, 0,25 por árvore no raio 3, teto 3/sem) e
  Pedreira (objetivo 2; 40 prata + 10 madeira, manutenção 2, 2 x 2, 3 vagas, 0,4 por rocha no raio 2,
  teto 3/sem), com a regra da Coletora. Trabalham o ano todo
- Estoque da cidade sem limite e sem depósito; a caravana traz 20 de madeira
- Custos: casa nova 5 madeira; celeiro, mercado e oficina 10 madeira; parque 5 pedra; templo 800 +
  300 pedra + 150 madeira. Evolução: barro 5 madeira, pedra 10 pedra, casa grande 10 pedra + 5
  madeira, pagos ao subir; sem material a casa espera pronta (13/13), como a pausa da fome
- Rua, campo, praça, pescador, coletora e lenhador nunca pedem material
- Corte: a cada 10 de madeira o Lenhador corta a árvore mais próxima; o toco não bloqueia (constrói
  em cima de graça) e volta a ser árvore em 104 semanas. Lenhador e Coletora disputam o bosque
- Topo: uma pílula Materiais entre Comida e Moradores (pedra só depois do objetivo 2), vermelha
  quando há casa esperando. Materiais fora da porta das famílias. O inverno não consome material
  (lenha é o P4)
- Linha de base: o main com as "P2 correções" (abaixo), e não mais da5a8bb
- Alavancas novas, depois das da seção 9, uma por rodada: objetivo 8 6 → 12 casas grandes (se J3 > 250
  ou objetivos 7 e 8 a < 13 sem); prêmio do objetivo 9 (antecipado para o pacote final P2, ver Decisões);
  Coletora `perCell` 0,3 → 0,2 (se a Coletora > 16% da comida)
- Também no P3: toasts que cobrem o balão da ferramenta no celular (ui-designer)

## Feito: "P2 correções" (2026-11-04, no main até 5499aa1)

Decisão do usuário (2026-11-04): o fim fica como está no P2. A linha "Templo 312/800" fica no jogo,
e o objetivo 9 continua com 500 moradores e prêmio 200. O sim-tester mediu (`sim-tester-p2-fim.md`):
nenhum prêmio passa. Quem guarda prata para o Templo (`--profile savesTemple=true`) vence 98% das
partidas em cerca de 21 min. Alavanca preferida para o P3: objetivo 9 com 700 moradores (quem guarda
vence em ~27 min; o Comum, 46% em ~31 min). Decidir com o que o usuário sentir jogando.

Especificação: `docs/revisoes/2026-11-04/plano-p2-correcoes.md`. Nenhuma mecânica nova.
- Templo: `upkeep` 10 → 0; dica "Vence o jogo após o objetivo 9…"; toast ao erguer antes do 9
- Objetivo 1 exige moradores (família a caminho não basta)
- Ao escolher o Templo: áreas 6x6 verdes (prontas) e amarelas (a ≤ `templeSpotRoadGap` 1 da rede);
  prévia amarela "Cabe aqui: falta ligar à rua" em toda construção quando só falta rua
- Tutorial: seta do passo da família segue o motivo da porta (`storage` → celeiro, `food` → campo; no inverno → pescador);
  o passo termina em `familyStepMaxWeeks` 8
- Celular: Demolir em construção com perda de comida abre o balão em vez de demolir
- Textos: Templo "+10 de Alegria em N casas"; "Uma família foi embora: casa sem rua"
- Testes visuais estáveis; bots sem tabela copiada; Eficiente reserva o terreno do templo
- Medição em 3 rodadas: R0 correções; R1 `drought.harvestFactor` 0,4 → 0,25; R2
  `familyFoodReserveWeeks` 2 → 1 (fica só se passar). M2 redefinido: 6x6 livre a ≤ 1 célula da rede,
  ≥ 95% no Comum
- Medido: R1 (seca 0,25) aprovada, R2 (reserva 1) reprovada. Pacote final "ritmo do fim": linha
  "Junte 800 para o Templo" e prêmio do objetivo 9 200 → 400 (R1 do pacote final), ver Decisões

## Feito: Pacote 2 "Água sai e mapa" (no main: f9dfc4c..da5a8bb)
Especificação: `docs/revisoes/2026-11-04/plano-p2.md`. Medido (sim-tester, d901a12): Comum 46% de
vitórias em ~27 min, 0 derrotas, prata parada 3/100. Abertos: fome no inverno ~11% (alvo 25–60%) e
templo sem lugar ao ser liberado (M2 ~26%; existe 6x6 a ≤ 1 célula da rede em 99%). Revisões
terminadas; o que entra está em "P2 correções".
Nenhuma regra nova: a Praça troca o Poço, o Parque troca o Jardim e o raio do altar. Resumo (atual →
novo):
- Poço sai (dados, código, arte e textos). Sai a porta `water` e o objetivo `water`. Não há saves a
  migrar (só `tutorialDone` e configurações)
- Casas: barro = rua + **praça**; pedra = + mercado; casa grande = + **parque** (o altar sai da
  evolução, decisão do usuário: "não do altar"). Altar e templo continuam únicos e dão Alegria +10
- Praça (nova, liberada no início): 25 de prata, manutenção 1 (calibrada; plano: 2), 2 x 2, raio 4, Alegria +5
- Jardim → Parque: custo 35 → 60, manutenção 1, raio 3 → 4, Alegria +20, liberado no
  objetivo 5 (igual). Calibração do P2 também: Casa 30 → 40, Coletora máx. 4,5 → 3,5
- Tutorial: o passo do poço vira o da praça, no mesmo lugar (perto das tendas)
- Mapa: rochas [35, 65] → [70, 100], oliveiras [45, 75] → [80, 110], palmeiras [35, 65] → [50, 80],
  bosques densos 1 → 2 com 18 → 24 árvores, afloramento de rochas garantido (novo `rockOutcrop`:
  12 rochas, raio 2, a 10–18 do altar) para a pedreira do P3
- Interface: câmera do tutorial, fila de toasts, "Perde N de comida" ao demolir celeiro, necessidade
  trancada com "libera no objetivo N", textos pendentes do P1
- Medição: nada pior que o P1 (Comum 6–10 casas no Ano 1, vitória 30–50% em 25–35 min, ≤ 7 derrotas,
  prata parada ≤ 9/100, templo sempre com lugar); melhorar: objetivos 5 e 6 separados ≥ 13 semanas,
  ≤ 3 objetivos por ano
- Alavancas em ordem: famílias (intervalo 6 → 7 → 8), parque (raio 5, objetivo 4), prata (manutenção de
  praça e parque), Coletora (`max` 4,5 → 3,5), densidade, Mercado no objetivo 2

## Feito: Pacote 1 "Ritmo" (2026-11-04, no main: 196cd9d e a06d471)
Especificação completa em `docs/revisoes/2026-11-04/plano.md`, seção 2. Resumo (atual → novo):
- Casas: moradores 3/6/10/16 → 4/6/10/20; imposto 1/2/3,5/6 → 1/1,5/2,5/3; comida por morador
  0,2/0,15/0,2/0,22 → 0,2 em todos. Casa senhorial (30) só registrada, para o P10
- Sobe um nível por estação: `weeksToUpgrade` 13 (novo); cair continua em 3 (`weeksToChange` vira
  `weeksToDowngrade`); a fome pausa a subida em vez de zerar. Balão "Casa de barro em N sem"
- Famílias: `familyChance` 0,6 → 0,35; `familyIntervalWeeks` 2 → 6; porta com reserva de 4 semanas
  de comida até a primavera (`familyFoodReserveWeeks`, novo); previsão conta cada casa no máximo
  1 nível acima. Casa nova 15 → 30
- Oficina sem prata (5 → 0): +10% de comida dos campos por oficina ligada, teto +30%. Campo sem
  prata (1 → 0): a prata vem só de impostos e prêmios
- Desemprego com as vagas do ano (campo congelado conta), também na alegria
- Inverno: cada morador come ×1,25; tenda ×1,5. Seca a partir do Ano 3 (`safeYears` 1 → 2)
- Manutenção depois do objetivo 2 (era 3); celeiro `upkeep` 2 → 1; altar `radius` 3 → 4
- 10 objetivos em ~10 anos; celeiro liberado no objetivo 1; templo pelo objetivo 9 "500 moradores"
  a partir do Ano 8 (`fromYear`, novo); templo continua 800
- `weekSeconds` 2,5 → 3,2 por último, depois de os critérios em semanas passarem
- Critérios (sim-tester, 100 seeds, 700 semanas, base 11a95cd): Ano 1 do Comum com 6–10 casas;
  fome em ao menos um inverno em 40–60% das partidas do Comum; Distraído com crise e recuperação,
  sem derrota antes de 8 min; ≤ 4 oficinas; prata nunca > 300 por 26 semanas antes do templo;
  vitória do Comum em 25–35 min; nenhuma abertura melhor em tudo
- **Calibração aplicada na implementação** (pela ordem de alavancas da seção 2.4; a decisão final é
  do usuário):
  - `upkeepStartsAfterGoal` 2 → **3** e imposto da tenda 1 → **1,25** (alavanca 3: com 2, o Comum
    perdia por dívida em ~40% das partidas)
  - imposto da casa grande 3 → **2,5** (alavanca 3: prata parada)
  - `tentFoodFactor` 1,5 → **1,75** e `familyFoodReserveWeeks` 4 → **2** (alavanca 2: com a reserva
    de 4 a porta protegia demais e a fome no inverno do Comum ficava em 15–25%)
  - resultado (100 seeds): Comum com 9 casas no fim do Ano 1, 40% de vitórias na semana 572
    (~30 min), fome em algum inverno em 39%; prata parada > 26 semanas em 28/100 (critério F falha:
    cortar mais imposto derrubava as vitórias)
- **Aprovado pelo usuário depois das revisões (2026-11-04):** Templo liberado no objetivo 8 (a
  vitória continua pedindo os 500 moradores do objetivo 9); manutenção depois do objetivo 4;
  `winter.foodFactor` 1,25 → 1,4; ajustes de bot do sim-tester (cidade fechada abre rua longa,
  planejador conta a manutenção que vai começar, templo construído assim que liberado e pago).
  Medido (100 seeds): Comum 42% de vitórias em ~30 min, 7 derrotas, prata parada 9/100;
  Eficiente 23%; Distraído 4% (67 derrotas, assunto do P5)

## Superado: Pacote 2 "Anos que contam" (escopo 2026-11-04)
Escopo em `docs/revisoes/2026-11-03/plano-pacote2.md`; não foi implementado. O que foi aproveitado
(celeiro 1, altar 4, desemprego do inverno, textos) ou descartado está na seção 0 de
`docs/revisoes/2026-11-04/plano.md`.

## Feito: Pacote 1 "Ritmo em semanas + estações com colheita e celeiro"
Histórico; a regra do campo e os números mudaram depois (ver "Estado atual").
Aprovado pelo usuário em 2026-11-03; o game-director fechou os pontos abertos
no mesmo dia e o pacote segue sem nova aprovação. Regras e números completos
em `docs/GAME_DESIGN.md`. Sem sim-tester, playtester e fun-critic nesta
entrega (pedido do usuário).

Pilares: cria os pilares 1–3. Fortalece o 6 (rio, bosque e campo junto ao
rio pesam). Risco para o 4 (mais regras: colheita, celeiro, estoque, seca,
porta das famílias): controlado por uma frase de motivo para cada bloqueio e
pela previsão "até a colheita". Quebra o 8 por decisão do usuário.

### 1. Tempo em semanas
- 1 passo = 1 semana; 13 semanas por estação, 52 por ano
  (`weeksPerSeason` 13, `weekSeconds` 2,5; 1 ano = 130 s em 1x)
- O jogo e o ano começam no **outono** (o ano agrícola): Ano 1 = outono,
  inverno, primavera, verão; o Ano 2 começa no outono seguinte
- Renomear month → week em core, dados, testes e textos (`weeksToChange`,
  `debtWeeksToLose`, `familyCellsPerWeek`, `weekSeconds` …). Valores por passo
  iguais, salvo os ajustes abaixo
- Topo: "Outono · Ano 1 · Semana 3" (1–13). Vitória e derrota com "N anos e
  N semanas". Estatísticas com gráficos das últimas 52 semanas

### 2. Abertura variável
- Prata 180. Custos: Rua 2, Casa 20, Campo 30, Poço 40, Pescador 25,
  Coletora 25, Celeiro 60, Mercado 80, Oficina 70, Jardim 50, Templo 800
- Caravana sorteada pela seed: 2–4 famílias já em tendas (casas comuns de
  nível 1, de graça) encostadas no anel do altar; comida para 10–20 semanas do
  consumo delas, cortada em 40 (sem celeiro). Frase de abertura com os números
  reais: "A caravana chegou com 3 famílias e comida para 14 semanas"
- Terreno sorteado: distância do rio, rochas e árvores variam por seed;
  sempre há um bosque denso (requisito do gerador, ver Mapa)
- Liberados no início: Rua, Casa, Campo, Poço, Pescador, Coletora
- Manutenção só depois do objetivo 2 (igual)
- Famílias novas só chegam se TODAS as casas (terrenos também) estiverem no
  raio de um poço ligado e a previsão disser que a comida dura até a próxima
  colheita; no máximo 1 a cada 2 semanas (`familyIntervalWeeks` 2), com chance
  `familyChance` 0,6 por semana × fator da alegria. Sai a regra das 3 famílias
  garantidas. Sem família por causa da porta: aviso com o motivo
- Alvo: fim do Ano 1 com 6–10 casas

### 3. Colheita
- Campo semeia no outono, cresce no inverno, colhe nas 13 semanas da
  primavera: 156 por ano (`harvest` 156 → 12 por semana × eficiência).
  Mantém "1 campo alimenta 15 moradores de tenda" (antes 3 × 48 = 144)
- Campo construído no outono colhe na primavera do mesmo ano; depois do
  outono, só no ano seguinte. Prévia: "colhe na primavera do ano N"
- O campo mantém 2 vagas e 1 prata por semana o ano todo (sem vagas que
  somem no verão: o desemprego não piscaria a cada estação)

### 4. Celeiro
- Liberado pelo objetivo 3 "Primeira colheita". 3 x 3, 1 vaga, custo 60,
  manutenção 2/sem, guarda 150. Sem celeiro a cidade guarda 40
  (`baseFoodStorage`); celeiros ligados somam. O que passa do limite estraga,
  com aviso "Comida estragando: construa um celeiro"
- A capacidade não depende da vaga preenchida (comida guardada não some por
  falta de gente); celeiro desligado não guarda

### 5. Pesca e coleta (decisão a do usuário, forma escolhida pelo diretor)
- Duas construções baratas com a MESMA regra: rendem pelas células do
  recurso dentro do raio, com teto. 2 x 2, 1 vaga, custo 25, manutenção 1,
  comida toda semana do ano (sem colheita, sem celeiro)
  - Pescador: células de rio no raio 2 × 0,25, máximo 1,5/sem
  - Coletora: árvores no raio 3 × 0,1, máximo 1,5/sem (bosque denso enche)
- Construir em qualquer lugar (como as outras); rendendo 0, balão "longe do
  rio" ou "sem árvores". Prévia mostra "Rende N comida/sem" (pilar 6)
- Por que assim: uma regra só, dois botões fáceis de entender; o rio longe
  custa rua e o bosque perto vale ouro, então a abertura pesa

### 6. Previsão e avisos
- Uma função pura de previsão semana a semana (consumo atual, pesca e coleta,
  colheita dos campos semeados, seca já anunciada, limite de estoque) até o
  começo da próxima colheita. Calculada uma vez por semana
- Pílula de comida: "até a colheita" quando chega, senão "até o <estação>"
- Avisos (Avisos e lista de problemas): comida não chega à colheita (toast no
  começo do verão), comida estragando, "O inverno está chegando. Tendas sofrem
  com o frio." (3 últimas semanas do outono, com tendas), seca anunciada,
  motivo de não virem famílias

### 7. Inverno e seca
- Inverno com fome: tenda sai com 0,35/sem (`winterFamineLeaveChance`);
  fora do inverno, como hoje (tenda 0,2; barro ou melhor cai de nível com
  0,12 e nunca vai embora)
- Ano seco sorteado pela seed (25%), nunca no Ano 1, nunca dois seguidos;
  anunciado no 1º dia do inverno; colheita × 0,4, exceto campos encostados no
  rio. O visual de seca do render passa a seguir o core

### 8. Marcos
- Primeira família, primeira casa de barro, primeira colheita, primeiro
  inverno vencido, primeira casa de pedra, primeiro ano sem fome. Brilho,
  moradores reunidos, 1 frase, sem pausar; lista nas Estatísticas

### 9. Interface Clássica sai
- Fica só a Nova. Sai a opção "Interface" das Configurações, o código e os
  cenários visuais da Clássica, e a seção dela em `docs/GAME_DESIGN.md`

### Objetivos
| # | Texto | Alvo | Prêmio | Libera |
|---|---|---|---|---|
| 1 | Prepare o primeiro inverno | comida até a primavera do Ano 1 | +20 | – |
| 2 | Água para todas as casas | todas no raio de um poço, mín. 4 casas | +30 | (manutenção começa) |
| 3 | Primeira colheita | 12 de comida colhida | +30 | Celeiro |
| 4 | Construa o celeiro | 1 ligado | +40 | – |
| 5 | Tenha 6 casas de barro | 6 | +40 | Mercado |
| 6 | Chegue a 50 moradores | 50 | +50 | Oficina |
| 7 | O povo precisa de trabalho: 2 oficinas | 2 | +50 | Jardim |
| 8 | Tenha 6 casas de pedra | 6 | +80 | – |
| 9 | Chegue a 150 moradores | 150 | +120 | – |
| 10 | Tenha 4 casas grandes | 4 | +150 | Templo |
| 11 | Construa o Templo | 1 | vitória | – |

- Objetivo 1 se cumpre quando a previsão chega à primavera do Ano 1, ou ao
  chegar a primavera (o inverno passou; quem passou fome já pagou com tendas)
- Objetivo 3 conta a comida colhida acumulada (vale mesmo se a colheita
  acontecer antes de o objetivo 3 ser o atual)
- Pescador e Coletora nascem liberados: sem eles o 1º inverno é fome certa

### Números em `src/data`
- `rules.json`: `weekSeconds` 2,5; `weeksPerSeason` 13; `startSeason`
  "autumn"; `startSilver` 180; `caravan` { `minFamilies` 2, `maxFamilies` 4,
  `minFoodWeeks` 10, `maxFoodWeeks` 20 }; `baseFoodStorage` 40;
  `familyIntervalWeeks` 2; `familyChance` 0,6; `familyCellsPerWeek` 6; sai
  `guaranteedFamilies` e `earlyFamilySpeedMultiplier`; `weeksToChange` 3;
  `famineLeaveChance` 0,2; `winterFamineLeaveChance` 0,35;
  `famineDropChance` 0,12; `debtWeeksToLose` 24; `drought` { `chance` 0,25,
  `harvestFactor` 0,4, `safeYears` 1, `neverTwice` true };
  `winterWarningWeeks` 3; `historyWeeks` 52; `startUnlocked` + "fisher",
  "gatherer"; `map` com faixas (abaixo)
- `rules.json > map`: `rocks` [35, 65], `olives` [45, 75], `palms` [35, 65],
  `river.distance` [8, 18] (células da borda do altar até o rio),
  `denseGrove` { `min` 1, `trees` 18, `radius` 3, `distance` [11, 20] }
- `buildings.json`: custos novos; campo `harvest` 156 (sai `food` 3);
  `granary` { 60, upkeep 2, 3 x 3, jobs 1, `storage` 150, supply };
  `fisher` { 25, upkeep 1, 2 x 2, jobs 1, `gather` { `source` "river",
  `radius` 2, `perCell` 0,25, `max` 1,5 }, supply }; `gatherer` { 25, upkeep
  1, 2 x 2, jobs 1, `gather` { `source` "trees", `radius` 3, `perCell` 0,1,
  `max` 1,5 }, supply }
- `goals.json`: a tabela acima (tipos novos `foodUntilSpring`, `water`,
  `harvest`)
- `tutorial.json`: passos refeitos (poço, rua até rio ou bosque, pescador ou
  coletora, campo, casa, família chegando); mini passos iguais
- `visual.json`: fases das estações em 13 semanas; sai
  `seasons.years.droughtChance` (a neve continua só visual); estágios do
  campo; enchimento do celeiro; marcos
- `walkers.json`: carregador campo → celeiro na primavera; pescador
- `houses.json`: sem mudança

### Fora deste pacote
Madeira (o bosque denso só prepara), pasto, festa, caravana como evento,
outros eventos, pedidos, história, frio sem fome, pesca e coleta por
estação, vender ou comprar comida, oficina entristece vizinhos, festa na
praça, categorias desligadas (com 10 construções elas passam a valer).

### Riscos para o usuário observar no teste
- Ano 1 apertado demais: prata 180 com custos dobrados e rua até o rio
- Objetivo 3 trava um ano inteiro se o jogador não construir campo no
  outono do Ano 1 (o tutorial e a prévia avisam)
- Celeiros no fim do jogo: 150 moradores comem ~1.900 por ano; guardar 39
  semanas pede ~8–10 celeiros 3 x 3 (mapa e prata). Se pesar, subir `storage`
- Pesca e coleta empilham (dois pescadores contam o mesmo rio): podem
  dispensar campos. Se acontecer, baixar `max` ou `perCell`
- Porta das famílias fechada por muito tempo na primavera antes do celeiro
  (limite 40): crescimento pode parar e parecer quebrado; o motivo tem que
  estar visível
- Seca de 25% com 0,4: um ano seco sem campo junto ao rio pode virar espiral
- Coluna com 10 construções liga as categorias (um toque a mais)

## Estado anterior à sobrevivência (após "Manutenção e falência", 2026-11-02)
Histórico. O que mudou no Pacote 1 da sobrevivência vale acima.
- Mapa 48 x 48. Altar 4 x 4 fixo no centro (canto em 22,22), cercado por um anel
  de rua (x e y de 21 a 26), e uma rua inicial na coluna 24 do anel até a entrada
  da cidade na borda sul (24,47); 41 células de rua de graça
- Tamanhos: rua 1 x 1, casa 2 x 2, poço 2 x 2, campo 2 x 2, mercado 2 x 4
  (gira para 4 x 2 antes de construir: botão ou tecla R), oficina 3 x 3,
  altar 4 x 4, templo 6 x 6
- A visão do mapa gira 90° (setas ↺ ↻ no canto superior direito, Q e E no PC);
  só a visão gira, as regras não mudam
- Raios quadrados medidos da borda da construção: poço 4, mercado 5, altar 3,
  templo 12. A casa é atendida se qualquer uma das suas 4 células estiver no raio
- Terreno: área livre de raio 9 em volta do altar, 50 rochas, 60 oliveiras,
  50 palmeiras, rio de 3 a 4 células na borda leste
- Famílias andam 4 células por mês
- Ruas obrigatórias: toda construção precisa encostar numa rua ligada ao
  altar; moradores e famílias novas andam só pelas ruas
- Casas evoluem: tenda (rua), barro (+ poço), pedra (+ mercado),
  casa grande (+ raio do altar ou do templo)
- Categorias: casas = moradia, mercado = comércio, oficina = indústria,
  campo = comida
- Comida e trabalhadores (40% dos moradores) são o equilíbrio da cidade;
  campo e mercado têm 3 vagas, oficina 3
- As 3 primeiras casas ligadas à rua recebem família com certeza; depois, 35% por mês
- Templo 6 x 6 custa 800 e é a meta final
- 9 metas em sequência; metas liberam construções:
  1. 6 casas ligadas à rua (tenda ou melhor): +20
  2. 20 moradores: +30, libera Mercado
  3. 5 casas de barro ou melhores: +40, libera Oficina
  4. Construa 2 oficinas: +40
  5. 80 moradores: +60
  6. 6 casas de pedra ou melhores: +80
  7. 150 moradores: +120
  8. 4 casas grandes: +150, libera Templo
  9. Construa o Templo: vitória
- Metas de casas e de construir contam só construções ligadas à rua
- Aviso de desemprego (Oficina liberada e 6+ pessoas sem trabalho) numa etiqueta
  abaixo da barra superior; mensagem própria ao liberar a Oficina
- Oficina com 6 ofícios (olaria, ferraria, carpintaria, tecelagem, tinturaria,
  curtume), só aparência; o artesão carrega um objeto do ofício
- Barra no topo com prata, comida (pisca vermelha durante a fome), moradores,
  trabalho, mês e meta atual (Clássica; a Nova, padrão desde 2026-11-03, está
  na seção do pacote "Interface D")
- Clareza: rua sem ligação ao altar desenhada apagada e tracejada, com aviso
  ao construir; balão "sem rua" com ícone próprio; balão "sem trabalhadores"
  em locais de trabalho com eficiência 0; com a ferramenta Templo, destaque
  dos lugares onde ele cabe
- Variedade visual (só aparência): 6 variantes por nível de casa (tenda,
  barro, pedra, casa grande) e 2 de terreno vazio, espelháveis, com pequeno
  deslocamento e tom; sorteadas ao construir e a cada mudança de nível; duas
  casas vizinhas do mesmo nível nunca repetem variante quando há outra
- Campo com 4 plantações diferentes (trigo, cevada, hortaliças e uma quarta),
  sorteadas ao construir; campos vizinhos não repetem a plantação
- 10 tipos de morador andando pelas ruas (aguadeira, agricultor, cesteira,
  carregador, artesão, idoso, criança, homem com jumento, pastor, sacerdote),
  cada um com destino, velocidade e pausa próprios (`walkers.json`); um tipo só
  aparece quando a construção dele existe

- Pacote "Manutenção e falência" (equilíbrio aprovado 2026-11-02; falta o
  fun-critic). Única mecânica nova: manutenção, com dívida e derrota como
  consequência
- Manutenção mensal (`upkeep` em `buildings.json`): poço 3, campo 1, mercado 4,
  oficina 2, templo 10; rua, casa e altar 0. Cobrada todo mês, inclusive de
  construções desconectadas, também depois da vitória
- Mês: prata += impostos + oficinas − manutenção. O +X/mês da barra já desconta
- Prata pode ficar negativa só pela manutenção. Construir continua exigindo
  prata ≥ custo (com prata negativa nada é construído; demolir continua grátis)
- Dívida: contador de meses seguidos com prata < 0 ao fim do mês; zera com
  prata ≥ 0. Ao chegar a `debtMonthsToLose` (`rules.json`, 24): derrota
- Ao entrar em dívida, a velocidade 3x cai para 1x (uma vez por episódio)
- Tela de derrota "Jerusalém foi abandonada": meses jogados, maior população,
  botão "Tentar de novo" (seed nova, reinício completo, como um jogo novo)
- Fome: a regra de cair de nível passa a valer para tendas com chance própria
  (`famineLeaveChance` 0,2 em `rules.json`); tenda que cai vira terreno vazio
- Comida por morador por nível (`food` em `houses.json`): tenda 0,2, barro 0,2,
  pedra 0,25, casa grande 0,3
- Família que sai: só aparência. O core emite um evento com a casa; o render
  faz a família andar pela rede até a entrada e sumir (sem rota: some no lugar)
- Interface, sem painel de estatísticas:
  - avisos numa lista do core (`alerts`), mostrados como etiquetas empilhadas
    abaixo da barra, nesta ordem: dívida ("A cidade está em dívida: N meses"),
    saldo negativo ("Gastando mais do que ganha: maior custo Mercados 9/mês;
    use Demolir em serviços que atendem poucas casas"), desemprego
  - tocar na prata mostra na linha de informação: impostos, oficinas,
    manutenção por tipo e saldo
  - dica e prévia da ferramenta: "Mercado: 40 prata, 3/mês"; Ver numa
    construção mostra "Manutenção 3/mês"
  - valor da prata: normal com saldo ≥ 0, laranja com saldo do mês negativo,
    vermelho piscando em dívida
- Em dívida e com fome ao mesmo tempo, a etiqueta de dívida troca a dica para
  "Dívida e fome: demolir serviços corta a manutenção"
- Equilíbrio medido (100 seeds): Eficiente vence 100/100 sem dívida, mês 56;
  Comum vence 96/100, 82 com saldo negativo e 36 em dívida recuperada, mês 94;
  Distraído perde 81/100
- fun-critic (2026-11-02): diversão 7, sempre algo a fazer 6, curva 5,
  recompensas 7, clareza das metas 5, cidade viva 8, vontade de jogar de novo 6

## Em andamento: Pacote 1 "Primeira partida sem ajuda" (aprovado 2026-11-02)
Escopo completo em `docs/revisoes/2026-11-02/plano.md`, seção 4. Nenhuma
mecânica nova. Fortalece os pilares 1 e 5.
- Tutorial guiado na primeira partida: 6 passos (rua, 3 casas, família
  chegando, campo, poço, casa de barro) e 2 mini passos na meta 2 (saldo,
  depois Mercado); 1 frase e seta por passo; "Pular tutorial";
  `jerusalem.tutorialDone` no `localStorage`; condições no core
  (`src/core/tutorial.ts`, `src/data/tutorial.json`)
- "Atende N casas" na prévia de Poço, Mercado e Jardim
- Nome embaixo do ícone em todos os botões dos trilhos (custo nas
  construções); nome ≥ 16 px do jogo, toque ≥ 44 px de tela
- Manutenção só depois da meta 2 (`upkeepStartsAfterGoal` 2, `rules.json`):
  antes, sem cobrança, dívida nem aviso de saldo
- Ritmo: `monthSeconds` 1,2 → 2,0; `earlyFamilySpeedMultiplier` 3 para as
  famílias garantidas
- Felicidade só com o Jardim liberado: antes, sem carinha, sem balão triste,
  fatores 1. Fórmula atual mantida (altar continua até o P3)
- Bugs pequenos do Ambient, do rio, das Opções e do GameScene
- Aceite: novato chega à meta 3 sem perder e sem explicação; nenhuma derrota
  antes da meta 2; Eficiente vence sem dívida; clareza do fun-critic ≥ 8

## Em andamento: pacote "Interface D" (aprovado pelo usuário 2026-11-03)
Só interface. Nenhuma regra, custo, número de economia ou meta muda. Regras e
tamanhos completos em `docs/GAME_DESIGN.md`, seção "Interface Nova". Mockups:
celular 844 x 390 e PC 1366 x 768 enviados pelo usuário.

Pilares: fortalece o 1 (menos texto no mapa, uma palavra por coisa, toque
grande) e o 3 (balão da construção tocada mostra o que falta e o ganho de
evoluir). Neutro no 2 (o mapa fica mais livre). Não toca o 4 nem o 5 (zero
mecânica nova).

Escopo (ENTRA AGORA):
- Opção "Interface: Nova / Clássica" nas Configurações, Nova padrão, salva no
  navegador (`jerusalem.ui`). Trocar reconstrói só a `UIScene`; a partida
  continua. A Clássica fica como está, mudando só as palavras (abaixo)
- Uma palavra por coisa nas duas interfaces (copywriter): tick = "semana",
  meta = "Objetivo", felicidade = "Alegria", Ver = "Mover", Limpar =
  "Demolir". No código os nomes internos (`month`, `goal`, `happiness`)
  continuam
- Estilo: painel `#24190E` 75%, borda clara 20%, botão pergaminho `#F4E8CC`,
  destaque `#E2A93B`, texto `#FFF4DC` (tudo em `palette.ts`). Tocável redondo;
  informativo com cantos arredondados. Tamanhos em px reais de tela (o layout
  converte pela escala): nada < 12 px, toque ≥ 44 px
- Topo esquerdo: círculo de nível (= objetivos cumpridos + 1) com anel do
  progresso do objetivo atual; pílulas Prata e Comida (com variação por
  semana), Moradores; no PC também Alegria (só com o Jardim liberado, como
  hoje) e "até o <estação>" na comida quando o saldo de comida é negativo
  (estação em que a comida acaba, pedido do usuário);
  pílula do objetivo
- Topo direito: estação · Ano · Sem, velocidade (celular 1 botão que alterna
  1x → 3x → pausa; PC 3 botões), engrenagem
- Lateral esquerda: Objetivos (lista), Avisos (lista + selo com a contagem),
  Estatísticas (painel simples, sem gráficos). Sai a faixa de aviso do mapa
- Inferior esquerdo: Mover, Rua, Demolir (PC com a tecla no rótulo)
- Coluna direita: Casa, Campo, Poço, Mercado, Oficina, Jardim, Templo, com a
  miniatura da arte; bloqueada com cadeado e "Libera no objetivo N"; selo
  "novo"; balão da construção escolhida (PC com vagas, alcance e "Saldo
  depois")
- Balão da construção tocada com Mover (substitui a linha de informação),
  com ação principal, Demolir e Fechar
- Categorias em `buildings.json` e a regra "até 8 mostra a lista, acima de 8
  mostra as 4 categorias" pronta e testada, sem efeito hoje (7 construções)
- Funções puras novas, só de leitura, com testes: calendário (ano, estação,
  semana), nível da cidade, semanas de comida restantes, saldo depois de uma
  construção, grupos da coluna

Números em `src/data`: `category` por construção em `buildings.json`;
`toolColumnMax` 8 em `rules.json`. Cores e tamanhos de tela no `palette.ts` e
no `layout.ts` (visual, não são regra).

Quem faz: ui-designer (layout e controles), sprite-artist (ícones redondos,
cadeado, poeira e pedrinhas do Demolir, tom vermelho sob o cursor), copywriter
(palavras e frases dos balões), test-reviewer (funções puras), code-reviewer.
`docs/TESTING.md` ganha os cenários novos.

Aceite:
- `npm test`, `tsc`, `test:visual` com cenários da Nova em 844 x 390,
  915 x 412 e 1366 x 768 (início, balão de construção escolhida, balão de casa
  tocada, Avisos, Objetivos, Estatísticas, Configurações, bloqueada) e os da
  Clássica continuando a passar
- playtester: um novato acha Casa, Rua, Poço e o objetivo sem ajuda, e o
  tutorial funciona nas duas interfaces
- Nenhum texto < 12 px reais e nenhum toque < 44 px no 844 x 390

Fora deste pacote: gráficos nas Estatísticas (precisam guardar histórico, é
estado novo); variação por semana em Moradores; ícone de hora do dia na pílula da estação; categorias
ativas; "Saldo depois" no celular; qualquer regra nova.

## Absorvido: pacote "Avisos a tempo" (itens repartidos no P1, P2 e P3)
Aprovado antes da revisão de 2026-11-02; "Atende N casas" foi para o P1, os
avisos de saldo e comida para o P2, a tela de derrota com causa para o P3.
Sem mecânica nova: avisos, prévia, tela de derrota e números medidos.
- Aviso de comida antes da fome: comida caindo e durando menos de
  `foodAlertMonths` (8, `rules.json`) meses → "Comida acaba em N meses:
  construa um campo"
- Aviso de saldo negativo só quando aperta: prata + `deficitAlertMonths` (12,
  `rules.json`) × saldo < 0. O valor da prata continua laranja com saldo negativo
- Uma etiqueta só (a mais importante), no celular e no PC. Ordem: dívida, fome
  ou comida acabando, saldo negativo, desemprego
- Prévia de poço e mercado mostra "Atende N casas" (casas e terrenos com
  alguma célula no raio)
- Tela de derrota com a causa principal e uma dica: fome em algum mês dos
  últimos `debtMonthsToLose` → "Faltou comida por N meses" + "Construa campos
  antes de crescer"; senão "Maior gasto: Poços (N/mês)" + "Cada serviço deve
  atender várias casas"
- Para o sim-tester medir (só entram com os 3 alvos mantidos): comida inicial
  30 → 45, `famineLeaveChance` 0,2 → 0,12, recompensa da meta 3 40 → 75, e
  limites das metas 5 e 7 (hoje se cumprem sozinhas logo depois da meta 4).
  Confirmar também se falta lugar para o templo ao liberar (fun-critic: 16/18)

## Feito: pacote "Campo é trabalho" (pedido do usuário, aprovado 2026-11-02)
Sem mecânica nova: um número novo no campo, texto e arte. Ordem dos pacotes
pendentes: este, depois "Interface nova", depois "Avisos a tempo" (assim a
etiqueta única de aviso já nasce no lugar novo).
- Campo emprega menos e rende menos prata que a oficina (`buildings.json`):
  campo `jobs` 3 → 2 e `silver` 1 (novo); oficina continua 3 vagas e 5 de
  prata. Prata por trabalhador: campo 0,5, oficina 1,7. Comida do campo (3) e
  manutenção (1) não mudam: o campo "se paga" e dá comida
- Core: a produção de prata soma `silver` de todo local de trabalho ligado ×
  eficiência (hoje só a oficina tem). Mês: prata += impostos + produção −
  manutenção. Testes no Vitest; `docs/GAME_DESIGN.md` atualizado
- Texto: aviso de desemprego "N pessoas sem trabalho: construa uma oficina ou
  um campo" (condição igual: Oficina liberada e 6+ sem trabalho); detalhe da
  prata mostra "Impostos +X · Oficina +X · Campo +Y · Manutenção: … · Saldo";
  Ver no campo mostra vagas, comida e prata; dica "… 2 vagas · produz 3 de
  comida e 1 de prata/mês"
- Arte: agricultores dentro do campo, trabalhando parados (enxada subindo e
  descendo, abaixar para colher, passo curto entre as fileiras), com fase
  sorteada para não ficarem sincronizados. Quantidade = round(vagas ×
  eficiência), de 0 a 2; nenhum se o campo está sem rua ou com eficiência 0
  (o balão já explica). Só render, lendo a eficiência do core
- sim-tester mede com os 3 alvos atuais (Eficiente vence sem dívida, Comum
  vence ≥ 90% com aperto, Distraído perde ~60%; alvo mudado pelo usuário em 2026-11-02, antes ~80%). Se a prata sobrar demais,
  testar campo `silver` 0,5; se o desemprego travar o Comum antes da Oficina,
  testar oficina `jobs` 4. O game-director aprova os números finais

## Feito: pacote "Interface nova" (pedido do usuário, aprovado 2026-11-02)
(Os botões ganham nome embaixo do ícone no P1; ver Decisões.)
Só interface: troca as barras de largura total por placa no topo e dois
trilhos laterais, para o mapa ocupar quase a tela toda no celular deitado.
Layout inspirado em Pharaoh: A New Era; arte própria desenhada em código,
pedra clara com detalhes dourados. Nenhum arquivo de imagem, nada copiado.
- Placa no centro do topo (não de largura total): nome "Jerusalém" em cima
  (pedido do usuário), depois Mês, prata (+X/mês, com as
  cores atuais), comida (pisca na fome), moradores, trabalho. Ícone + número,
  sem rótulo. Tocar na prata mostra o detalhe como hoje
- Faixa da meta logo abaixo da placa; tocar mostra a meta inteira e o
  progresso na linha de informação
- Abaixo da meta, UMA faixa de aviso (a mais importante, ordem do pacote
  "Avisos a tempo") com X: fechar esconde aquele aviso até ele sumir e voltar.
  Aviso de dívida não tem X
- Canto superior esquerdo: velocidade em 3 botões (pausa, 1x, 3x), o ativo
  em dourado
- Trilho esquerdo, abaixo da velocidade: Ver, Rua, Limpar, divisória,
  girar ↺ e ↻ (saem do canto direito)
- Trilho direito: as 6 construções (Casa, Campo, Poço, Mercado, Oficina,
  Templo), ícone = miniatura da textura da própria construção, custo pequeno
  embaixo. Sem flyout de categorias: 6 cabem e um toque a menos (pilar 1).
  Cinza quando falta prata; bloqueadas como hoje
- Ao escolher uma ferramenta, a linha de informação (placa compacta no centro
  de baixo, só aparece quando tem texto) mostra nome, custo, manutenção e dica
- Toasts no centro de baixo, acima da linha de informação
- Tamanhos: botão dos trilhos ≥ 72 px do jogo (≈ 48 px de tela no celular
  844 x 390, acima do mínimo de 44); substitui a decisão "botões ≥ 80 px" da
  barra de baixo. Conferir no celular 844 x 390 e no PC 1366 x 768
- Fora: desfazer, sobreposições, mundo, lista, ajuda (não temos essas
  funções). O painel de estatísticas (candidato 7) ganhará um botão no trilho
  esquerdo quando entrar
- Absorve da revisão do ui-designer: "layout do celular", "Trabalho com — e
  +N sem vaga" e "prévia acima do dedo" (prévia não pode ficar sob os trilhos)
- `isOverUi` passa a cobrir placa, faixas, trilhos e linha de informação;
  cenários visuais novos nos dois tamanhos em `docs/TESTING.md`

## Pacote 5: "Cidade densa" (aprovado pelo usuário 2026-11-02, escopo 2026-11-02)
Só aparência e geração do mapa. Nenhuma regra, custo ou número de economia
muda. Entra depois do P4, junto com a vitória com resumo; soma os itens de
mapa e arte da revisão de 2026-11-02 e deixa a praça do templo livre. Dividido em duas entregas, cada uma
com seus testes e revisão; a B só começa com a A aprovada nas capturas.
Visual inspirado no aspecto orgânico de Banished, em 2D isométrico desenhado
em código e com tema de Jerusalém. Sem câmera 3D, sem arquivo de imagem, nada
copiado.

Pilares: fortalece o 2 (cidade viva) e o 3 (a vida da rua cresce com o nível
das casas, então o bairro bom fica visivelmente mais cheio). Risco para o 1
(mapa poluído, rua difícil de ver) controlado pelas regras de leitura abaixo.

### Entrega A: chão e árvores (map-designer, depois sprite-artist)
- map-designer (`src/core/map.ts` + testes):
  - Árvores em bosques: mesmas quantidades de hoje (oliveiras 60, palmeiras
    50, rochas 50), só a posição muda. Oliveiras em grupos na grama, palmeiras
    em grupos perto do rio e na areia, rochas em afloramentos pequenos
  - Área livre do altar (raio 9) e rua inicial continuam livres
  - Números novos em `rules.json` (`map`): quantidade de bosques e raio de
    espalhamento por tipo. Nada mais
  - Testes: mesmo seed dá o mesmo mapa; totais exatos de cada tipo; nada na
    área livre, na rua inicial nem no rio; árvores ficam agrupadas (maioria
    com vizinha do mesmo tipo); existe lugar livre para o templo 6 x 6 fora da
    área do altar em 100 seeds
- sprite-artist (`src/render`, só desenho):
  - Grama variada: 3 a 4 tons, tufos, flores pequenas e pedrinhas, sorteados
    pelo hash da célula; contraste baixo
  - Chão gasto: terra batida na borda das ruas e na frente das portas. Sem
    trilhas soltas no mato (pareceriam rua)
  - Bosque denso: cada célula de árvore pode desenhar 1 a 3 árvores (a célula
    bloqueada é a mesma), copas que se sobrepõem, sombra no chão
  - Sombras no chão de todas as construções, árvores e rochas, para um lado
    só, embutidas na textura ou numa camada estática
  - Rua continua a linha mais forte do chão; rua desligada continua tracejada

### Entrega B: construções e vida (sprite-artist)
- Textura de parede (blocos de pedra, reboco de barro rachado) e de telhado
  (terraço de barro, esteiras, toldos) nas texturas já existentes. Assado na
  textura, custo zero por quadro
- Fumaça fina de forno de barro (tabun) no terraço de casas de barro ou
  melhores e de olaria e ferraria. Não chaminé europeia
- Mais vida na rua, crescendo com o nível da casa: na frente de casas de
  barro ou melhores, figuras paradas animadas (vizinhos conversando, criança
  brincando, roupa no varal, cabras ou galinhas). Tenda tem pouco, casa grande
  tem mais. Não são andarilhos novos e não usam o core
- Números visuais (limites e quantidades por nível) num arquivo de dados
  próprio do visual em `src/data`, junto de `walkers.json`

### Regras de leitura e custo (valem para A e B)
- Celular primeiro: nada novo animado fora da câmera; no máximo
  `maxSmoke` 12 fumaças e `maxAmbient` 40 figuras paradas ativas
- Decoração do chão e sombras não criam um objeto por célula a cada quadro:
  são assadas em textura ou em pedaços estáticos
- No zoom mínimo: figuras paradas e tufos somem; balões e andarilhos ficam
  acima de tudo e com o mesmo tamanho e contraste de hoje
- Árvore não cobre balão, prévia de construção nem destaque do templo

### Como verificar
- `npm test` com os testes novos do mapa (test-reviewer confere)
- Cenário visual novo "dense-town" (cidade de ~150 moradores, com casas de
  todos os níveis, bosques e rio) no zoom mínimo e máximo, celular 844 x 390 e
  PC 1366 x 768; recapturar `town-art`, `field-work-*` e os de girar o mapa.
  Olhar: rua se distingue do chão gasto, balões legíveis no zoom mínimo
- Custo: cenário com contador de quadros a 3x em "dense-town", com a CPU do
  Playwright 4x mais lenta; média ≥ 45 quadros/s e no máximo 10% abaixo da
  mesma medida antes do pacote
- sim-tester (só na entrega A): os 3 alvos se mantêm, prata gasta em Limpar e
  mês do templo variam pouco (±10%) e o templo tem lugar ao ser liberado. Se
  os bosques tirarem lugar, reduzir o espalhamento, nunca a quantidade de
  árvores sem nova decisão
- Depois de B: playtester (leitura, toque, celular) e fun-critic (cidade viva)

### Fora
- Mais árvores ou rochas bloqueando, trilhas de terra fora das ruas, câmera
  3D, luz de dia e noite, clima, estações, construção nova, decoração que o
  jogador posiciona (jardins são do candidato 1), qualquer regra nova

## Decisões
- 2026-11-04 — Pacote final P2, ritmo do fim: entra a linha "Junte 800 para o Templo: N/800" do
  objetivo 8 até o templo (só UI), e o prêmio do objetivo 9 200 → 400 é antecipado do P3 (R1). Se
  falhar, R2a prêmio 600; R2b `fromYear` 8 → 7 só com vitória mediana ≥ 520 sem. `fromYear` 6 FORA
  (vitória ~22 min, abaixo do piso de 25); objetivo 8 → 10/12 continua no P3; praça 40/raio 5
  DEPOIS. Motivo: 38/40 Comuns chegam ao 9 e só 20 vencem; do 9 à vitória a mediana é 190 sem.
  Espera sem meta visível não é desafio. Vitórias aceitas até 55% nesta medição. Especificação:
  `docs/revisoes/2026-11-04/plano-p2-correcoes.md`, "Pacote final P2 — ritmo do fim".
- 2026-11-04: o templo fica sem manutenção (10 → 0) e o texto deixa de prometer a vitória antes do
  objetivo 9. Motivo: 15 de 25 Distraídos erguiam o templo cedo e 10 entravam em dívida esperando. A
  liberação no objetivo 8 (decisão do usuário) continua.
- 2026-11-04: o M2 passa a ser "6x6 livre a ≤ 1 célula da rede" (≥ 95% no Comum). O jogo mostra as
  áreas em amarelo. A rua fantasma fica para DEPOIS. Motivo: o lugar existe em 99% das partidas; o
  que falta é o jogo mostrar onde. Templo 5x5, liberar antes e mexer no mapa não resolvem.
- 2026-11-04: fome no inverno em duas rodadas. Primeiro a seca, `harvestFactor` 0,25 (já medida:
  C2 28%, vitória 49%). Depois a reserva da porta, 2 → 1, para o Ano 1. Motivo: uma mudança de número
  por vez; a seca faz a camada do Ano 3 morder, a reserva mira o primeiro inverno.
- 2026-11-04: aceitas as quedas do Eficiente e do Pescador e a subida do Distraído (23%, metade do
  Comum, 0 derrotas cedo). Motivo: Pescador é perfil de teste; o Eficiente cai por causa do bot,
  que é corrigido para reservar o templo. Se mesmo assim ficar abaixo do Comum, eu reabro no P3.
- 2026-11-04: objetivo 8 → 12 e prêmio do 9 → 400 viram alavancas do P3. `treeClearCost` 10 fica
  NÃO, casa grande 3,5 vai para o P9 e "poucos trabalhadores" fica para DEPOIS.
- 2026-11-04 — P3: madeira e pedra num estoque da cidade sem limite e sem depósito. Motivo: um
  limite pediria uma construção nova (segunda mecânica); o freio é o teto da produção e o bosque
  que encolhe. Limite só no P4, se o material parado falhar (W4).
- 2026-11-04 — P3: sem material a casa espera pronta (13/13) e paga ao subir; construir sem material
  é como sem prata. Motivo: regras já conhecidas (pausa da fome, botão cinza).
- 2026-11-04 — P3: materiais fora da porta das famílias; comida e madeira nunca pedem material (rua,
  campo, praça, pescador, coletora, lenhador). Motivo: a porta fica uma frase; sempre há caminho
  de volta (pilar 1).
- 2026-11-04 — P3: Lenhador e Coletora disputam as árvores, com aviso na prévia; o toco não bloqueia
  e rebrota em 104 semanas. Motivo: é a escolha do usuário (cortar custa frutos); o toco livre faz
  o Lenhador abrir espaço e ajuda o templo a achar lugar.
- 2026-11-04 — P3: uma pílula Materiais no topo, a pedra só depois do objetivo 2; no celular sem
  variação por semana. Motivo: phone first (844 x 390) e uma matéria-prima por vez.
- 2026-11-04 — A fome no inverno baixa (~11%) não se conserta no P3: `familyFoodReserveWeeks` 2 → 1
  entra como ajuste do P2, antes da linha de base do P3, se o sim-tester-p2 confirmar; depois vem a
  lenha do P4. Motivo: não misturar a medida da mecânica nova com o conserto de um número antigo.
- 2026-11-04 — fun-critic-p2: objetivo 8 → 12 e prêmio do 9 → 400 DEPOIS (medir J3 no P3); Coletora
  0,2 DEPOIS (medir o corte primeiro); Limpar 10 FORA (o Lenhador abre o bosque); casa grande imposto
  3,5 DEPOIS (P9); "Bairro completo" DEPOIS (gatilho novo).
- 2026-11-04 — P2 "Água sai e mapa" aprovado pelo usuário (seguir o roteiro). Casas evoluem por
  praça, mercado e parque; o altar sai da evolução. Motivo: as decisões do usuário de 04/11 ("não do
  altar") valem mais que a lista de pacotes ("… e altar").
- 2026-11-04 — "Jardim vira praça e parque" = duas construções com a regra de serviço com raio que
  já existe (Praça no lugar do Poço, Parque no lugar do Jardim), não uma construção com níveis.
  Motivo: zero regra nova; a casa de barro não pode depender de algo liberado no objetivo 5.
- 2026-11-04 — Parque continua no objetivo 5. Motivo: a casa grande deixa de nascer no Ano 1 pelo
  raio do altar, e os objetivos 5 e 6 deixam de cair na mesma semana (critério J).
- 2026-11-04 — Arte do poço removida; a Praça ganha arte própria sem poço nem fonte; a aguadeira
  fica e vai à praça e ao mercado. Motivo: o usuário tirou o poço do jogo; arte sem uso confunde.
- 2026-11-04 — Entram no P2: câmera do tutorial, fila de toasts, toast final do tutorial, "Perde N de
  comida" ao demolir celeiro, cadeado nas necessidades, textos do P1 e limpeza de código morto.
  DEPOIS: marco anual do inverno (P5); Mercado no objetivo 2 e objetivo 8 = 350 só como alavanca.
- 2026-11-04 — Novo rumo (usuário): sobrevivência e contemplação, ~30 min, ~30% de vitórias,
  templo com 500 moradores a partir do Ano 8. Pilares novos acima. Motivo: o jogo durava 2,6 min,
  90–100% venciam e a prata sobrava (revisão de 11a95cd).
- 2026-11-04 — Pacote 2 "Anos que contam" superado pelo P1 "Ritmo". Absorvidos: celeiro `upkeep` 1,
  altar `radius` 4, desemprego do inverno, textos. Descartados: meta "Colha 100", intervalo 3.
  Campo 312 vira alavanca. Câmera do tutorial e toasts vão para o P2 (o passo do poço some).
- 2026-11-04 — Roteiro: a seca no Ano 3 entra no P1 (um número só); a recuperação (dívida gradual,
  derrota só com a cidade quase vazia) vem antes das obras com tempo. Motivo: P3 e P4 deixam as
  crises mais fortes, e a derrota seca de hoje esconderia o equilíbrio; os 30% se calibram no P6,
  com materiais e obras prontos.
- 2026-11-04 — A fome pausa a subida das casas (não zera). Motivo: com 13 semanas por nível, zerar
  por uma semana ruim seria punição sem explicação.
- 2026-11-04 — Oficina: +10% nos campos, teto 3 oficinas (+30%), exige ligação, os trabalhadores
  contam pela eficiência. Motivo: acaba a fábrica de prata (17–22 oficinas por partida) sem criar
  sistema novo; os tipos de verdade vêm no P10.
- 2026-11-04 — Prata só de impostos e prêmios (oficina e campo sem prata), imposto ~0,25 por morador
  e 0,15 na casa grande, casa nova 30. Motivo: o usuário prefere reduzir a entrada; com 500
  moradores o imposto antigo daria ~170 por semana.
- 2026-11-04 — Templo: o objetivo dos 500 moradores só conta a partir do Ano 8; não se confere de
  novo a população na hora de construir (KISS).
- 2026-11-04 — Objetivos "Água para todas as casas", "Primeira colheita" e "Construa 2 oficinas"
  saem. Motivo: a porta ensina a água (e a água sai no P2); a colheita é marco; a oficina é bônus.
- 2026-11-04 — Pacote 2 "Anos que contam" sem mecânica nova (superado no mesmo dia, ver acima). Motivo: o Ano 1 ficou justo, e o
  problema passou a ser o jogo curto (~2,5 min) com comida sobrando (pilares 2, 3 e 6).
- 2026-11-04 — Celeiro `upkeep` 2 → 1 e altar `radius` 3 → 4 entram. Motivo: medidos; o primeiro
  tira a dívida rasa do inverno (Comum 6 → 3%), o segundo é a única trava real (meta 10). O raio 4
  ainda não cobre a cidade, então casa grande continua sendo escolha de lugar.
- 2026-11-04 — Meta 9 150 → 130 fora. Motivo: encurta um jogo que já é curto; a meta é lenta, não
  travada.
- 2026-11-04 — A regra do campo do usuário (comida fora do inverno, a01a506) fica; só o número
  baixa (468 → 312, a medir). Motivo: o campo dava 89% da comida e 19–42% estragava; com 8/sem ele
  rende por trabalhador perto do pescador e o rio e o bosque voltam a contar.
- 2026-11-04 — A duração vem do relógio da porta (`familyIntervalWeeks` 2 → 3), não de metas
  gigantes nem de semana mais lenta. Motivo: a porta dita o crescimento; o alvo do Ano 1 já era 6–10
  casas, e hoje chegam ~25 famílias por ano.
- 2026-11-04 — Meta 3 vira "Colha 100 de comida". Motivo: com o campo dando comida na hora, 12
  durava 1 semana e caía dentro do tutorial.
- 2026-11-04 — Campo congelado não gera desemprego. Motivo: o aviso falso mandava construir 19–21
  oficinas que tiravam gente dos campos na primavera. Correção de regra, não mecânica nova.
- 2026-11-04 — Pacote 2 antigo (seção 5 do `plano.md`) muda: "comida primeiro" vai para DEPOIS (a
  dívida do Comum no Ano 2 caiu de 13/20 para 0/100); seca anunciada no outono e trava "casa só
  sobe com comida" saem (obsoletas); gerador justo, tela de derrota com causa e arte da
  sobrevivência vão para o P3 "Madeira".
- 2026-11-04 — Arte e prévia do "campo plantado tarde" (resto do 1.9) fora. Motivo: com a regra
  nova todo campo dá comida na semana seguinte; a contagem na pílula da estação substitui.
- 2026-11-04 — Seeds presas > 52 semanas: o aceite vale para Eficiente (0) e Comum (≤ 5); o
  Distraído só é relatado. Motivo: ficar preso é a consequência esperada de não cuidar da cidade.
- 2026-11-04 — Duração: alvo do P2 é o Comum vencer em 4–6,7 min de simulação; os 8 min e os
  15–25 min vêm da Madeira (P3) em diante.
- 2026-11-03 — Virada para sobrevivência (usuário): pilares novos 1–3 vêm
  antes dos antigos; Pacote 1 "Ritmo em semanas + estações com colheita e
  celeiro" aprovado como bloco. Motivo: o usuário quer tensão de comida, água
  e abrigo no ciclo do ano.
- 2026-11-03 — Tick = semana também no código; substitui "no código continua
  `month`" e "Ano = tick ÷ 48 + 1, Sem 1–12". Ano = semana ÷ 52 + 1, começa
  no outono. Motivo: 13 semanas por estação dão um ano verdadeiro de 52.
- 2026-11-03 — Fonte fora da colheita = Pescador e Coletora com uma regra
  só (recurso no raio × taxa, com teto 1,5). Motivo: do outono à primavera
  são 26 semanas e a comida inicial dura no máximo 20; uma regra em dois
  botões é o mais simples e faz rio e bosque pesarem na abertura.
- 2026-11-03 — Campo 156 por ano (12/sem na primavera), não 144. Motivo:
  mantém "1 campo = 15 moradores de tenda" com o ano de 52 semanas.
- 2026-11-03 — Campo com vagas e prata o ano todo. Motivo: vagas sazonais
  fariam o desemprego aparecer e sumir a cada estação (pilar 4).
- 2026-11-03 — Celeiro guarda mesmo sem a vaga preenchida. Motivo: comida
  sumindo por falta de gente seria punição sem explicação.
- 2026-11-03 — Porta das famílias conta todas as casas, terrenos também.
  Motivo: uma condição só e uma frase só ("N casas sem água").
- 2026-11-03 — Caravana em tendas comuns de graça (sem tipo "provisória").
  Motivo: KISS; "provisória" é só a frase da abertura.
- 2026-11-03 — Seca 25% por ano, nunca no Ano 1 nem dois anos seguidos.
  Motivo: o 1º ano ensina; dois secos seguidos tirariam a recuperação (pilar 1).
- 2026-11-03 — Custos dobrados também em Mercado (80), Oficina (70) e Jardim
  (50); Templo fica 800. Motivo: mesma proporção das construções básicas que
  o usuário dobrou; o Templo já é o destino da prata.
- 2026-11-03 — Meta "80 moradores" sai e 20 vira 50. Motivo: com a porta
  das famílias o crescimento é lento; 11 objetivos já dão vários anos.
- 2026-11-03 — Comida inicial cortada em 40 (usuário, decisão b); a frase
  mostra as semanas reais.
- 2026-11-03 — Interface Clássica sai (usuário, decisão c).
- 2026-11-03 — Todo mapa tem ao menos um bosque denso (usuário, decisão e),
  preparando a madeira; madeira fica fora deste pacote.
- 2026-11-03 — Pacote "Interface D" (pedido do usuário): Nova padrão, Clássica
  como opção, só interface. Motivo: mapa mais livre no celular deitado e
  balões que explicam a construção tocada (pilares 1 e 3).
- 2026-11-03 — O tick passa a se chamar "semana" na tela, nas DUAS
  interfaces (Ano = tick ÷ 48 + 1, Sem = semana da estação 1–12); no código
  continua `month`. Junto: "Objetivo", "Alegria", "Mover", "Demolir" nas duas.
  Motivo: toasts, avisos, tutorial e telas finais são compartilhados; dois
  vocabulários seriam strings duplicadas (DRY) e o jogador confundiria ao
  trocar. 12 semanas por estação também é mais verdadeiro que 12 meses.
- 2026-11-03 — Teclas não mudam: 1 Mover, 2 Rua, 3–9 construções, 0 Demolir
  (o mockup "Demolir · 9" está errado; 9 é o Templo).
- 2026-11-03 — Girar a visão vai para as Configurações na Nova; Q e E
  continuam no PC. Motivo: girar é raro e o botão disputaria espaço com o mapa.
- 2026-11-03 — Na Nova a linha de informação sai: construção escolhida e
  construção tocada viram balões; detalhe da prata, de alegria e de trabalho
  vão para as Estatísticas (tocar numa pílula abre as Estatísticas); detalhe
  do objetivo vai para a lista de Objetivos; mensagens curtas ("Sem espaço
  para o templo") viram toasts; o tutorial continua com o seu balão.
- 2026-11-03 — Estatísticas entram agora sem gráficos: só números que o core
  já calcula (prata por fonte e manutenção por tipo, comida, trabalho, casas
  por nível, alegria com motivos). Gráficos ficam no candidato 9.
- 2026-11-03 — Sem faixa de aviso no mapa (Nova): selo vermelho no botão
  Avisos, que pulsa quando entra um aviso novo, mais um toast com o texto na
  primeira vez de cada aviso. Motivo: sem a faixa, a dívida não pode passar
  despercebida; a prata continua piscando vermelha em dívida.
- 2026-11-03 — Ação principal da casa tocada: "Onde pôr um mercado" escolhe a
  ferramenta do que falta e destaca no mapa os lugares que atendem a casa
  (`spotsServing`). Pedido explícito do usuário na especificação da Versão D
  (o game-director tinha proposto não destacar, para preservar o pilar 3).
- 2026-11-03 — Trabalho sai do topo na Nova (fica nas Estatísticas, no aviso
  de desemprego e no balão "sem trabalhadores"). Motivo: menos números no topo
  (pilar 1). O playtester confirma se o jogador ainda entende o equilíbrio.
- 2026-11-03 — Categorias da coluna: dados e regra prontos e testados, mas
  inativos com 7 construções. Não contradiz "Sem flyout": com até 8 o jogador
  continua com um toque só.
- 2026-11-03 — Nível da cidade (candidato 8) entra só como mostrador
  (objetivos cumpridos + 1); não libera nada.
- 2026-11-02 — Revisão de 2026-11-02 (`docs/revisoes/2026-11-02/plano.md`):
  o usuário respondeu "sim" às 7 perguntas e aprovou o Pacote 1 "Primeira
  partida sem ajuda". Motivo: o playtest real mostrou que quem nunca jogou
  não joga sozinho (pilar 1); a lista do usuário vem antes da Felicidade.
- 2026-11-02 — Nome embaixo do ícone em todas as ferramentas, com o custo nas
  construções; substitui "Ferramentas só com ícone". Motivo: no celular não
  existe passar o mouse, e o tutorial aponta para botões que precisam de nome.
- 2026-11-02 — Manutenção só depois da meta 2 (`upkeepStartsAfterGoal` 2) e
  mês 1,2 → 2,0 s com famílias garantidas 3x mais rápidas; substitui "valores
  baixos mantêm o começo leve" e "mês lento vira tempo morto". Motivo: o
  Distraído perdia em ~1 min 20 s e o novato precisa de tempo para ler.
- 2026-11-02 — Carinha escondida e felicidade neutra até o Jardim, no P1.
  Motivo: carinha vermelha sem remédio fere os pilares 1 e 5.
- 2026-11-02 — Altar e templo saem da felicidade no P3 (o Jardim é o que
  deixa a casa feliz). Até lá, a fórmula atual fica.
- 2026-11-02 — Duração: alvo intermediário nos P1 e P2, simulação ≥ 4 min e
  sessão humana ≥ 10 min; 15–25 min vêm do conteúdo, depois do P3 e do P4.
- 2026-11-02 — Distraído: ~60% de derrota, nenhuma antes de 5 min (mês 150
  com 2,0 s); fecha no P2.
- 2026-11-02 — Meta 7 → 250 moradores e meta 8 → 8 casas grandes no P2; a
  meta 8 cai para 6 se alguma partida ficar presa > 100 meses (500 seeds).
- 2026-11-02 — Festa na praça é a próxima mecânica nova (P4), depois de a
  felicidade pesar (P3).
- 2026-11-02 — Fora: alongar só com mês mais lento ou metas gigantes; templo
  obrigatório na praça (a praça é reservada a ele, mas ele vai a qualquer
  lugar válido); câmera seguindo famílias além do passo 3 do tutorial;
  tutorial com mais de uma frase por passo; incêndio; mais de um altar ou
  templo e lazer além do Jardim; campo `silver` 0,5, `startFood` 40/45,
  `famineLeaveChance` 0,12, `happiness.famine` −15, `startSilver` 230 (medidos,
  não ajudam); `taxMax` 1,4 e `familyMax` 2,0 na reta (viram degrau no P3);
  recorde de menos meses; telhados com gente, terraços, colinas e lua antes
  de "Cidade densa"; `@vitest/coverage-v8` sem ordem do usuário.
- 2026-11-02 — Escopo de "Cidade densa": duas entregas (A chão e árvores com
  geração do mapa; B construções e vida), só aparência. Motivo: pacote pequeno
  e verificável; a parte que mexe no core (bosques) fica isolada e medida.
- 2026-11-02 — Bosques com as mesmas quantidades de árvores e rochas; a
  densidade vem de desenhar 1 a 3 árvores por célula. Motivo: o espaço de
  construir e o gasto com Limpar não mudam, então a economia não muda.
- 2026-11-02 — Sem trilhas de terra soltas no mato; chão gasto só junto de
  ruas e portas. Motivo: trilha parecendo rua quebra a regra mais importante
  de ler no mapa (pilar 1).
- 2026-11-02 — Fumaça de forno de barro (tabun), não chaminé. Motivo: casa
  de Jerusalém antiga não tinha chaminé; o tema pede o forno.
- 2026-11-02 — Vida parada na frente das casas cresce com o nível da casa.
  Motivo: o bairro bem posicionado fica visivelmente mais vivo (pilares 2 e 3).
- 2026-11-02 — Pacote "Campo é trabalho" (pedido do usuário). Motivo: hoje
  o campo dá vaga mas o trabalho "parece" só oficina; campo com menos gente e
  menos prata cria escolha (comida e pouca prata × prata e nenhuma comida).
  Não é mecânica nova: o campo ganha um número que a oficina já tem.
- 2026-11-02 — Agricultores no campo entram junto. Motivo: mostram na tela a
  regra nova (campo = trabalho) e a falta de gente (campo vazio), pilar 2.
- 2026-11-02 — Pacote "Interface nova" (pedido do usuário) entra depois do
  campo e antes de "Avisos a tempo". Motivo: no celular deitado a barra de
  cima e a de baixo comem ~30% da altura; trilhos laterais devolvem o mapa.
  Fazer antes dos avisos evita construir a etiqueta duas vezes.
- 2026-11-02 — Sem flyout de categorias. Motivo: 6 construções cabem num
  trilho; cada toque a mais pesa no pilar 1.
- 2026-11-02 — Usuário aprovou: ordem campo → interface → avisos, campo com
  2 vagas e 1 prata, nome "Jerusalém" na placa do topo e "Cidade densa" como
  pacote depois de "Avisos a tempo".
- 2026-11-02 — (Substituída no mesmo dia pelo nome embaixo do ícone, P1.)
  Ferramentas só com ícone; nome, custo e dica vão para a linha
  de informação ao escolher, custo pequeno no botão. Motivo: botões grandes
  com texto não cabem no trilho; o custo continua visível para decidir.
- 2026-11-02 — Pacote "Avisos a tempo" a partir do fun-critic. Motivo: a
  derrota existe mas chega sem aviso (fome) ou com aviso errado (saldo negativo
  no mês 0 mandando demolir o primeiro poço); o jovem tem que entender o que
  errou (pilar 1). Só interface e números, nenhuma mecânica nova.
- 2026-11-02 — Uma etiqueta por vez. Motivo: duas etiquetas cobrem o topo do
  mapa no celular; o jogador resolve um problema de cada vez.
- 2026-11-02 — "Atende N casas" na prévia entra agora. Motivo: com
  manutenção, o número de casas atendidas é a decisão de posicionamento
  (pilar 3), e hoje o jogador não o vê.
- 2026-11-02 — Botão "Mesmo mapa" na derrota fica para depois: um botão a
  mais na tela; rever se a vontade de jogar de novo continuar baixa.
- 2026-11-02 — Templo sem lugar: decidir só depois de o sim-tester confirmar
  o número do fun-critic.
- 2026-11-02 — Equilíbrio da manutenção: poço 1 → 3, mercado 3 → 4; resto
  igual. Motivo: com os valores originais, Comum quase nunca apertava (1/40) e
  Distraído perdia só 15/40; agora os três alvos são cumpridos. Poço mais caro
  também premia o poço bem colocado (pilar 3).
- 2026-11-02 — Dívida + fome: campo NÃO pode ser construído em dívida (exceção
  quebraria "construir exige prata", pilar 1). Saída continua sendo demolir; a
  etiqueta de dívida ganha dica própria quando há fome. A espiral de quem não
  cuida da cidade é a derrota que queríamos.
- 2026-11-02 — `debtMonthsToLose` fica 24: 36 não salvou ninguém (as derrotas
  são espirais, não falta de tempo), e a queda de 3x para 1x já dá tempo de ver.
- 2026-11-02 — Armadilha da meta 4 (Comum preso 39 meses sem juntar 35 para a
  oficina): ajuste de recompensa, não mecânica; medir meta 3 +75 antes de
  aprovar.
- 2026-11-02 — Templo sem lugar em 2/40 partidas do Distraído: fica como está;
  o destaque verde e a mensagem "Sem espaço para o templo" já explicam, e
  demolir resolve.
- 2026-11-02 — Duração curta (Eficiente 56 meses) continua vindo de conteúdo
  dos próximos pacotes, como já decidido.
- 2026-11-02 — Pacote "Manutenção e falência" (pedido do usuário) aprovado com
  ajustes. Motivo: não existia forma de perder; manutenção faz serviço mal
  posicionado custar todo mês (pilar 3) e cabe numa frase na dica (pilar 1).
  Dívida e derrota são a consequência da manutenção, não outra mecânica.
- 2026-11-02 — `debtMonthsToLose` 12 → 24 e 3x cai para 1x ao entrar em dívida.
  Motivo: 12 meses são 14 s a 1x e menos de 5 s a 3x; um jovem de 12 anos não
  percebe e reage a tempo. O sim-tester pode baixar se Distraído não perder.
- 2026-11-02 — Abandono de tenda na fome é a regra de cair de nível estendida à
  tenda, não mecânica nova. A família saindo é só um efeito do render.
- 2026-11-02 — Painel de estatísticas continua para depois (candidato 7). O
  essencial vai para etiquetas de aviso e para o toque na prata. A lista de
  avisos do core será a lista de "principais problemas" do painel.
- 2026-11-02 — Manutenção vale também para construção desconectada. Motivo:
  ensina a ligar à rua; o balão "sem rua" já mostra o problema. Valores baixos
  (campo 1) mantêm o começo leve: 200 de prata e 3 famílias garantidas.
- 2026-11-02 — "Trabalho 0/0 100%" e o layout no celular (revisão do
  ui-designer) ficam fora deste pacote; as etiquetas empilhadas precisam caber
  na tela do celular deitado.
- 2026-11-02 — O usuário aprovou as sugestões do ui-designer junto com este
  pacote: bugs de toque (pinça, arrastar sob a interface, "Local inválido"
  falso), botões ≥ 80 px, balões que crescem no zoom afastado, Trabalho com
  "—" e "+N sem vaga", prévia acima do dedo, tela inicial em 3 passos, ajustes
  de arte (idoso × sacerdote, pedra, ruas) e, por último, layout do celular.

- 2026-11-02 — Pacote "Mapa maior e construções grandes" (decisão do usuário):
  mapa 32 → 48, construções com tamanhos próprios, mercado girável, depois a
  arte é redesenhada nos tamanhos novos. Motivo: mais variedade visual e
  construções que parecem grandes (pilar 2). Não é mecânica nova; girar o
  mercado é só interface.
- 2026-11-02 — Raios pelo alcance do centro × ~1,5 (a borda maior já alcança
  mais): poço 3 → 4, mercado 4 → 5, altar fica 3, templo 9 → 12. Altar não
  sobe para casa grande continuar sendo escolha de lugar (pilar 3).
- 2026-11-02 — Casa atendida se qualquer célula dela estiver no raio. Motivo:
  com 2 x 2, olhar só o canto faria o mesmo lugar funcionar de um lado do poço
  e não do outro (pilar 1).
- 2026-11-02 — Rochas sobem pouco (45 → 50) e árvores 85 → 110, densidade
  menor que antes. Motivo: com templo 6 x 6, a densidade antiga deixava quase
  nenhum lugar livre.
- 2026-11-02 — Campo volta de 3 x 3 para 2 x 2 (pedido do usuário): 3 x 3
  ficou grande demais na tela.
- 2026-11-02 — familyCellsPerMonth 3 → 4. Motivo: rua inicial 15 → 22 células;
  família não pode demorar mais de ~6 meses para chegar.
- 2026-11-02 — Custos, vagas, produção, moradores, impostos e metas não mudam:
  cada construção continua valendo uma unidade e o mapa cabe as casas das
  metas com folga. Rua por casa fica mais cara (frente de 2 células), o que
  ajuda contra a prata sobrando. O fun-critic remede depois.
- 2026-11-02 — Pacote "Equilíbrio e clareza" sem mecânica nova. Motivo:
  fun-critic mostrou jogo curto (~30 meses), metas 3–5 juntas, prata sobrando,
  trabalho sempre 100% e templo sem lugar em 5/5 partidas apressadas.
- 2026-11-02 — 8 metas e templo 800 (proposta do usuário, no lugar do 900
  do fun-critic). Motivo: espaçar metas e dar destino à prata.
- 2026-11-02 — Raio do altar 5 → 3. Motivo: com 5 cobria a cidade toda e
  casa grande não exigia escolha (pilar 3).
- 2026-11-02 — workerShare 0,5 → 0,4; vagas de campo e mercado 2 → 3. Motivo:
  136 trabalhadores para 63 vagas tornava o trabalho decorativo; agora oficina
  demais tira gente do campo.
- 2026-11-02 — Primeiras 3 famílias garantidas. Motivo: sem tempo morto no
  começo (pilar 1).
- 2026-11-02 — Metas de casas contam só casas ligadas. Motivo: o texto
  "ligadas à rua" tem que ser verdade.
- 2026-11-02 — Painel de estatísticas fica para depois (candidato 7): a
  fome entra só como piscar na barra + toast já existente.
- 2026-11-02 — Ficam para depois: oficina 5 → 8 de prata e imposto menor de
  pedra/casa grande (mexer só depois de o sim-tester medir este pacote; não
  mudar tudo de uma vez). Medalha de melhor tempo fica de fora: empurra
  pressa, o oposto do que queremos agora.
- 2026-11-02 — Meta de 15–25 min a 1x NÃO será buscada com o mês mais lento
  (1,2 s fica): 750–1250 meses é inalcançável com a economia atual e mês lento
  vira tempo morto (pilar 2). Duração vem de conteúdo (próximos pacotes).
  Alvo deste pacote: jogador planejado vence em 120–200 meses (2,5–4 min de
  simulação), apressado não trava no templo, e sessão humana ≥ 8 min.

- 2026-11-02 — Pacote "Variedade visual" (pedido do usuário): variantes de
  casa e tipos de morador. Só aparência e destino dos andarilhos; nenhuma regra
  de economia muda (pilar 2, cidade viva).

- 2026-11-02 — Pacote "Oficina" (pedido do usuário): meta "construa 2
  oficinas" (+40) logo depois da meta que libera a Oficina, aviso de
  desemprego (limite 6) e 6 ofícios só de aparência. Motivo: dar sentido à
  oficina (trabalho para o povo). Produção da oficina não muda. Sem painel de
  estatísticas ainda, o aviso fica numa etiqueta abaixo da barra superior.

- 2026-11-02 — Usuário mudou o alvo do Distraído: perder ~60% (antes ~80%).
  Hoje perde 64–67% (sim-tester, 200 seeds), já perto do alvo; a proposta
  tenda 0,35 + saída na fome 0,3 (que levava a 80%) foi descartada.
- 2026-11-02 — Pacote "Felicidade" (pedido do usuário, inspirado no Pocket
  City), implementado sem passar pelos agentes (eles rodam no fim, a pedido).
  Casa: 50 + altar/templo 10 + jardim 20 + poço 5 + mercado 5 − fome 30 −
  desemprego até 20. Feliz (≥ 65) paga até +20% e a cidade feliz atrai até
  1,5x famílias; triste (< 35) paga até −20% e atrai até 0,5x; contente não
  muda nada. Nova construção: Jardim (25, manutenção 1, 2 x 2, raio 3),
  liberado pela Meta 4, no trilho esquerdo. Carinha na placa, toque mostra os
  motivos; balão de casa triste. Escolhas padrão (usuário não respondeu): nome
  "Felicidade", só o Jardim (sem fonte), casa triste não é abandonada,
  oficina não incomoda vizinhos (o usuário pediu para deixar para depois).
  Motivo: dá um motivo para enfeitar a cidade e liga emprego e comida ao
  humor (pilares 2 e 3). Falta medir com o sim-tester (duração e Distraído).

## Próximos candidatos (roteiro de 2026-11-04)
Um pacote por vez, cada um medido antes do próximo (detalhes em
`docs/revisoes/2026-11-04/plano.md`, seção 1):
1. ~~Ritmo (com a seca no Ano 3)~~ feito (196cd9d, a06d471)
2. ~~Água sai e mapa~~ feito (f9dfc4c..da5a8bb), `docs/revisoes/2026-11-04/plano-p2.md`
3. **Próximo:** Madeira e pedra, especificado em `docs/revisoes/2026-11-04/plano-p3.md`
4. Lenha e inverno (neve, reserva do celeiro)
5. Recuperação (dívida gradual, derrota com a cidade quase vazia)
6. Obras com tempo + templo calibrado para ~30%
7. Moradores
8. Casamentos e moradia
9. Governo (imposto em %, porção do povo)
10. Evoluções (campo grande, oficina com tipos, casa senhorial)
11. Pasto e roupas
12. Doenças
13. Eventos da época
14. Incêndio
Depois: história de Esdras e Neemias (ARA), só com o playtest aprovado. Pedidos dos moradores e
"comida primeiro" ficam em espera até o roteiro pedir.

As listas abaixo são de antes do rumo novo; ficam só como histórico.

Em ordem, um pacote por vez (detalhes em `docs/revisoes/2026-11-02/plano.md`).
- P2 "Ver antes de construir" (sem mecânica nova): conexão visível, áreas de
  poço e mercado com a ferramenta Casa, "aqui: até Casa de barro", menos
  balões, saldo e comida antes do problema, praça do templo reservada, metas
  7 = 250 e 8 = 8 (ou 6), economia uma vez por sync
- P3 "Felicidade que se sente" + acabamento (sem mecânica nova): degrau,
  altar/templo fora, meta 5 vira "8 casas felizes", placa e textos, tela de
  derrota com causa
- P4 "Festa na praça" (mecânica nova): prata e comida por felicidade
  temporária, liberada por meta
- P5 "Cidade densa" + vitória com resumo (só aparência e mapa)

Depois, em ordem:
1. Destino para a prata, parte 2 (só se a Festa não bastar)
2. Personalização: nome da cidade, decorações livres, modo foto
3. Pedidos dos moradores (missões curtas, futura porta de entrada da
   história)
4. Eventos leves (seca, caravana) e celeiro
5. Felicidade, parte 2: oficina perto de casa entristece (em espera, pedido
   do usuário)
6. Pasto, só se for diferente do campo
7. História de Esdras e Neemias (ARA), só depois do playtest aprovar
8. (Entrou como mostrador no pacote "Interface D", 2026-11-03.) Nível da
   cidade com efeito próprio, só se algum pacote precisar
9. Painel de estatísticas, parte 2: gráficos (exige guardar histórico) e
   principais problemas. A parte 1 (números de hoje) entrou na "Interface D"

Ajustes de equilíbrio em espera (dependem do sim-tester): oficina 8 de prata,
imposto menor de pedra/casa grande.

Interface em espera: botão "Mesmo mapa" (mesma seed) na tela de derrota.

Parte 4 do pacote "Cidade bonita" (vida e ambiente) saiu do backlog e foi
implementada em 2026-11-02, a pedido do usuário (animais, rio, nuvens, chão,
varais, árvores balançando, trilhas entre casas). Absorve parte da "Cidade
densa" (trilhas, mais vida na rua).

Visual aprovado pelo usuário (2026-11-02), agora como P5:
"Cidade densa", inspirado no visual orgânico de Banished, em 2D isométrico
desenhado em código e com tema de Jerusalém: grupos de árvores, grama
variada, trilhas de terra gastas, sombras no chão, textura de telhado e
parede, fumaça de chaminé e mais vida na rua. Sem câmera 3D e sem copiar
arte. map-designer + sprite-artist. Escopo fechado na seção "Depois: pacote
"Cidade densa"" acima.

# Fun-critic: Povo + Madeira e pedra + 3D (main 8534702, 2026-11-05)

Como joguei: os bots do `tools/sim` como três perfis (Comum = apressado, Eficiente = planejador,
Distraído), seed 3, até 700 semanas, com um rastreador de famílias (nomes, casamentos, nascimentos,
mortes). Uma partida inteira do Comum no navegador (celular deitado, 915x412) a partir de uma cópia
limpa de 8534702, com capturas no Ano 1, 4, 6, 10 e 14 e a visão 3D de dia e de noite.
Ritmo citado vem do `sim-tester-p3.md` (1 semana = 3,2 s; Comum vence 74% em 32,6 min, A5 = 88 sem).

## Notas (0–10)

| | Nota | Por quê |
|---|---|---|
| Diversão | **6** | Casar, ter filho e ver a tenda virar casa de pedra é gostoso; mas do meio para o fim quase toda ação é "construir casa porque um casal pediu". |
| Desafio | **4** | O Distraído sofre (fome na semana 18, 2 famílias vão embora, dívida 4 vezes, preso 17 min no objetivo 6), mas quem presta atenção vence sem perigo: prata 12.000, pedra 1.300 paradas no fim. |
| "Me apeguei às famílias" | **5** | A ficha de pessoa (pais, cônjuge, filhos, ofício, "† aos 60") é ótima, mas são 163 nascimentos e 175 moradores: um aviso de nome a cada ~13 s vira ruído e ninguém é "a minha família". |

Por dimensão: momento 6 (posicionar casa perto da praça/mercado e o Lenhador no bosque são escolhas reais);
sempre algo a fazer 5 (início cheio, objetivos 1–4 em 48 s; depois buracos de 4–6 min esperando gerações);
curva 6 (sem derrota, sem estratégia perdedora para quem olha os avisos; o Distraído trava sem saída clara);
recompensas 6 (toasts de casamento/nascimento o tempo todo, mas os objetivos "uma criança virou adulta",
"terceira geração" e 125/150/175 moradores só pedem esperar); clareza 7 (o objetivo na tela e o tutorial
com nomes, "Adaías e Maaca querem se casar: construa uma casa perto da praça", explicam bem);
cidade viva 8 (mercados listrados, barcos, Templo, varais; dá prazer olhar); jogar de novo 6.

## Uma história que vi (Comum, seed 3)

Adaías e Maaca, da caravana fundadora, fizeram o primeiro casamento da cidade na semana 5. Tiveram Joel,
Abigail, Berequias e Zacarias. No Ano 5 Joel casou com Ester, que tinha chegado na primeira caravana, e
teve cinco filhas (Hamutal, Zeruia, Lia, Naamá, Rute). Abigail casou com Salum, filho dos vizinhos
fundadores Meremote e Ana. Berequias casou com Sara (também da caravana) e teve seis filhos. Adaías morreu
aos 60 no Ano 11 e Maaca aos 69 no Ano 13, poucas semanas antes do Templo, com mais de 12 netos.
**É uma história linda, e o jogador quase não a vê**: ela está espalhada em toasts iguais aos de outras
160 crianças, e a morte da Maaca vira "Morreu Maaca, aos 69 anos" no meio da seca.

## Fases e onde a diversão cai

- **Início (0–5 min, Ano 1):** muito bom. Caravana, rua até a comida, casamento, primeiro bebê, celeiro,
  Pedreira e Mercado liberados em 15 semanas. Talvez demais junto com o tutorial, mas dá vontade.
- **Meio (5–20 min, Anos 2–7):** primeira queda entre o objetivo 4 (sem 15) e a caravana (sem 92): 4 min
  sem grande novidade. Segunda queda no objetivo 8 "Uma criança virou adulta" (64 sem, 3,4 min) e no 12
  (106 sem, 5,7 min): só esperar crescer. Mover o Lenhador quando o bosque acaba (10 vezes na partida,
  ~1 a cada 3 min) é a escolha mais viva do meio.
- **Fim (20–36 min):** o Templo libera na sem 497, mas a vitória pede ainda 125, 150 e 175 moradores:
  180 sem (~9,6 min) com prata 7.000–13.000 parada. É onde um jovem largaria.

## Madeira e pedra: escolha ou tarefa?

- **Madeira: escolha interessante.** Onde pôr o Lenhador (bosque bom, longe da Coletora), quando mudá-lo,
  e juntar 300 para o Templo (o fim do Comum termina com 3 de madeira). É o recurso que dá "posicionar bem".
- **Pedra: tarefa e depois nada.** Uma Pedreira nas rochas e pronto; casa de pedra espera 10 e depois a
  pilha passa de 1.000. O limite de 400 do P4 (`plano-p4.md`) resolve a pilha, não a falta de escolha.

## 3D: dá vontade de continuar?

Sim, como **recompensa de olhar**: a cidade de noite com as luzes nas casas e a chuva de inverno é o momento
mais "uau" do jogo. Mas é só vitrine (pausa o jogo, não constrói), e ninguém lembra de abrir: o botão
fica parado na coluna. Também as casas no 3D (torres cor de areia) parecem outra cidade em relação ao 2D
(casas brancas), o que tira um pouco do "é a minha cidade".

## Top 5 melhorias (ordem de impacto)

1. **Fim que é só espera.** Problema: 125/150/175 moradores depois do Templo liberado = ~10 min de esperar
   nascimentos com prata sobrando. Proposta mais simples (`goals.json`): tirar os objetivos 125 e 150 e
   deixar a vitória em "Templo + 175" ou "Templo + 150". Efeito: final com um projeto (juntar madeira e
   pedra do Templo) em vez de cronômetro; partida mais curta e que pede "mais uma".
2. **Objetivos que não dependem do jogador.** Problema: "Uma criança virou adulta" e "Terceira geração"
   bloqueiam a fila e só pedem tempo. Proposta: virar marcos (a comemoração já existe) e sair da fila de
   objetivos, ou trocar por objetivos de posicionar ("3 casas grandes", "2 mercados de nível 3").
   Efeito: tira os buracos de 3–6 min do meio.
3. **Uma família do jogador.** Problema: 163 nascimentos diluem o apego. Proposta (só interface): a
   família do primeiro casamento vira "a família da cidade"; só ela (e os marcos) ganha toast de
   nascimento/casamento/morte, com uma frase de linhagem ("Morreu Maaca, aos 69, avó de 12 netos");
   o resto vai para o Histórico e a aba Povo. Efeito: uma história que o jogador acompanha do começo ao Templo.
4. **3D como prêmio.** Problema: ninguém lembra de abrir. Proposta: o botão 3D pulsa por alguns segundos
   ao cumprir um objetivo ou quando uma casa vira casa grande (sem abrir sozinho). Efeito: o 3D vira a
   foto da conquista, a cada 2–3 min no meio do jogo.
5. **Prata parada.** Problema: prata passa de 1.000 no Ano 4 e chega a 12.000; níveis, parques e praças
   deixam de ser escolha. Proposta: impostos menores (abaixo) para a prata voltar a pedir prioridade.
   Efeito: "subo o Mercado ou faço outro Parque?" volta a ser pergunta.

## Ajustes para o sim-tester medir (só `src/data`)

| Arquivo > valor | Antes | Depois | O que olhar |
|---|---|---|---|
| `goals.json` objetivos 15 e 16 (125 e 150 moradores) | existem | removidos (`--drop-goal 15 --drop-goal 16`) | A1, A5 do fim, prata no fim |
| `goals.json` objetivo 8 "Uma criança virou adulta" | na fila | removido (só marco) | A5 (g8 é o pior hoje), A1 |
| `houses.json` `tax` (barro/pedra/grande) | 1,75 / 2,5 / 3,25 | 1,25 / 1,75 / 2,25 | prata parada (silverIdle), A7 dívida, A2/A3 |
| `buildings.json` lenhador `gather.radius` | 3 | 4 | trocas de Lenhador por partida (hoje ~10), W3, W6 |
| `rules.json` 1ª caravana `weeks` | [52, 98] | [40, 70] | buraco entre g4 e g5, A4, A9 |

Pilares: tudo é ajuste ou interface, sem mecânica nova. O item 3 mexe só em quais toasts aparecem.

## Ideia ousada (OPCIONAL)

**Álbum da cidade:** ao cumprir cada objetivo, o 3D tira sozinho uma foto da cidade naquele momento; na
vitória, as fotos passam em sequência ("Ano 1 … Ano 14") com a família da cidade em destaque. Quebra
levemente "mecânica antes de história" (é apresentação, não regra) e pede trabalho de render; vale pela
vontade de jogar de novo para ter um álbum mais bonito.

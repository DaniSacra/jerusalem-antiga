# Plano completo

## Jerusalém Antiga · Plano de sobrevivência

Base: simulações de 12 partidas na versão f4b02fb (03/11), playtest com jovens, anotações de 04/11 e revisão da versão 11a95cd (04/11, 120 partidas simuladas com os bots eficiente, comum e distraído).

### Diagnóstico
- O jogo hoje é de crescimento e de prata. A única ameaça é a dívida, que encerra a partida de repente.
- Falta: escassez com ritmo, apego às pessoas, espera pelas obras, recuperação depois de crises e coisas para evoluir (não apenas mais construções).

### Estado atual (versão 11a95cd, 04/11)

#### Já implementado
- Tempo em semanas: 13 por estação, 52 por ano; o jogo e o ano começam no outono.
- Campo produz 12 de comida por semana na primavera, no verão e no outono; congela no inverno e libera os trabalhadores.
- Pescador (perto do rio) e Coletora (frutos das árvores no raio) produzem o ano todo. A Coletora já cobre a ideia de "pegar frutas".
- Estoque de 50 sem celeiro; cada celeiro guarda mais 150; o excesso estraga.
- Previsão de comida ("até a primavera" ou "acaba no inverno") na pílula, nos avisos e na porta das famílias.
- Seca sorteada (25% dos anos, nunca no Ano 1, nunca dois anos seguidos); campos encostados no rio ficam protegidos.
- Caravana inicial variável (2 a 4 famílias, comida para 14 a 22 semanas) e rio a distância variável: a abertura já muda de partida para partida.
- Marcos: primeira família, primeira casa de barro, primeira colheita, primeiro inverno vencido, primeira casa de pedra, primeiro ano sem fome.
- Bosque denso garantido no mapa, preparado para a madeira.
- Vitória ao construir o templo (objetivo 11 de 11).
- Tutorial focado em comida; 785 testes passando.

#### Ainda diferente do plano
- Água e poço continuam no jogo: travam famílias e são exigência para a casa de barro.
- Casas evoluem por poço, mercado e raio do altar (não por praça, parque e mercado).
- Não existe madeira, lenha nem pedra. A "coleta de madeira" não está quebrada: ela nunca foi criada.
- Impostos fixos; a alegria só ajusta o valor em até 20%.
- Reserva do celeiro e porção do povo não existem.
- Dívida de 24 semanas seguidas ainda encerra a partida de uma vez.
- Oficina dá 5 prata por semana; os 6 ofícios são só aparência.

#### O que as simulações mostraram
| Medida | Hoje | Meta do plano |
|---|---|---|
| Tempo até a vitória (jogador comum) | 2,6 min (62 semanas) | 25 a 35 min |
| Jogadores que vencem | 90% a 100% | cerca de 30% |
| Fome no primeiro inverno (comum) | nenhuma em 26 de 40 partidas | inverno como teste real |
| Distraído perde antes de 8 min | nunca perde; só 3 de 40 caem por dívida | crise e recuperação, sem derrota cedo |

1. **O jogo é cerca de 10 vezes mais curto que a meta.** O templo sai no começo do Ano 2. Os objetivos 1 a 4 se cumprem nas primeiras 9 semanas, ainda no tutorial.
2. **Crescimento explosivo.** Uma partida típica sai de 6 para 100 moradores em 28 semanas e já tem casas grandes na primeira primavera. A casa sobe de nível em apenas 3 semanas, e a capacidade pula de 3 para 16 moradores.
3. **O inverno não pesa.** No primeiro inverno ainda há poucos moradores, e pescador e coletora seguram a comida. A crise, quando vem, aparece na primavera, por crescimento rápido demais.
4. **Prata sobra sem destino.** No fim do Ano 1 o saldo passa de 70 por semana e acumula centenas de prata sem nada em que gastar.
5. **Oficina virou máquina de prata.** Os bots constroem 17 a 22 oficinas por partida (o objetivo pede 2). No inverno o campo congela, aparece o aviso de desemprego e quem obedece constrói oficinas que, na primavera, tiram gente dos campos.
6. **O campo domina a comida** (55% a 88% do total). Dá 2,7 vezes mais comida por trabalhador do que o pescador.
7. **Comida estragada** de 10% a 18% do que se produz, por falta de decisão sobre o que guardar.
8. **Derrota só por dívida**, e mesmo assim rara.

### Sugestões da revisão de 04/11
1. **Ritmo antes de conteúdo.** Antes de novas mecânicas, desacelerar: casas levam uma estação inteira (13 semanas) para subir de nível; a chance de família cai e passa a vir mais por caravanas anunciadas; a capacidade cresce em passos menores (por exemplo 4, 6, 8, 10). Medir de novo antes de seguir.
2. **Materiais como freio natural.** Madeira (lenhador no bosque) e pedra (pedreira nas rochas) entram no custo das obras e das evoluções. A casa de barro pede madeira; a de pedra pede pedra; o templo pede muita pedra. Isso dá destino a trabalhadores e cria espera sem precisar de cronômetro.
3. **Árvores como escolha.** O mesmo bosque alimenta a Coletora (frutos) e o Lenhador (madeira e lenha). Cortar para o inverno reduz os frutos do ano seguinte; o bosque cresce de volta devagar.
4. **Oficina produz bens, não prata.** Ferramentas aumentam a produção de campo, lenhador e pedreira; roupas protegem do frio. A prata vem dos impostos. Isso acaba com a fábrica de oficinas.
5. **Desemprego no inverno é normal.** O aviso de desemprego não deve disparar quando a causa é o campo congelado. No inverno, os trabalhadores livres vão para lenha e pedreira.
6. **Inverno mais caro.** Além de lenha, cada morador come um pouco mais no inverno, e tendas sofrem mais com o frio. A primeira medida deve ser: o jogador comum passa fome em pelo menos um inverno em metade das partidas.
7. **Objetivos espalhados pelos anos.** Um ou dois objetivos por ano, alinhados às fases de dificuldade. "Primeira colheita" deixa de ser objetivo (já é marco e se cumpre em 1 semana).
8. **Templo como obra final.** Liberado apenas a partir do Ano 8, exige 500 moradores, muita pedra e madeira e leva várias estações para ficar pronto. É a alavanca principal para os 30% de vitória e para os 25 a 35 min.
9. **Seca na fase certa.** A seca já existe; basta trocar o ano de início do Ano 2 para o Ano 3 (`safeYears` 2), como pedem as fases.
10. **Jardim vira praça e parque.** O Jardim já existe e já melhora as casas no raio. É a base natural para a evolução das casas perto de praças, parques e mercados quando o poço sair.
11. **Reserva do celeiro resolve o desperdício.** Com a reserva ajustável, o jogador escolhe guardar (comida para o inverno, povo menos alegre) ou distribuir (alegria agora, risco depois), em vez de ver comida estragar.
12. **Tempo para gostar da cidade.** Com 30 min por partida e cerca de 10 anos de jogo, a cidade precisa mudar de cara ao longo dos anos: bairros que se formam, casas de barro virando pedra, mercado mais movimentado, festas depois da colheita e do inverno vencido. Cada fase deve deixar a cidade visivelmente diferente, não só mais difícil. Depois da vitória, "Continuar construindo" (já existe) segue como modo livre para contemplar.

### Pilares
- Sobrevivência com recuperação. A tensão vem de comida, lenha, abrigo e pessoas; a prata é o meio de construir. Crises encolhem a cidade, mas sempre há caminho de volta. Perder exige a cidade quase vazia.
- Ritmo contemplativo. Tempo contado em semanas. Crescimento lento, mas cada crescimento é conquistado e cada ação tem peso.
- Contemplação da cidade. A partida dura cerca de 30 min porque o jogador precisa de tempo para se apegar à cidade e gostar de olhar para ela. Momentos calmos são bem-vindos quando há vida para observar: pessoas andando, estações mudando, casas evoluindo. A pressa vem só das crises, nunca do relógio.
- Pessoas com história. Cada morador tem nome, idade e profissão; nasce, casa, envelhece e morre.
- Evoluir em vez de multiplicar. Poucas construções, cada uma com tipos e níveis.
- Dificuldade em camadas. Cada fase do jogo acrescenta um problema novo.

### Ciclo de jogo desejado
Preparar (primavera, verão e outono) → resistir (inverno) → recuperar → crescer.

### Decisões de 04/11
- Campo produz toda semana na primavera, no verão e no outono; para no inverno. A colheita só na primavera deixou o jogo difícil demais.
- Mecânica de água removida: mais atrapalhava do que ajudava. Poço sai do jogo.
- Altar e templo são únicos. As casas evoluem perto de praças, parques e mercados, não do altar.
- O inverno pede comida e lenha.
- Impostos em porcentagem, começando em 20%, com ajuste fino depois.
- Apenas cerca de 30% dos jogadores devem vencer. Equilibrar para isso.
- Casas são difíceis de conseguir. Primeiro o jogador usa upgrades e melhorias para sustentar o povo que já tem; só depois a cidade cresce. Crescer por qualidade antes de quantidade.
- O templo só pode ser construído com 500 moradores (número final a calibrar).
- Vitória (provisória): construir o templo. O custo e os requisitos do templo são a principal alavanca para calibrar os 30%. A definição pode ser melhorada depois.

### Fases da dificuldade
Cada fase acrescenta um problema; o anterior continua valendo.
1. Ano 1: apenas o inverno (comida e lenha).
2. Ano 2: casamentos. Casais precisam de casa própria para sair da casa dos pais.
3. Ano 3: seca no verão.
4. Ano 4: doenças. Idosos precisam de assistência.
5. Ano 5 em diante: eventos da época (bons e ruins).

### Abertura desejada
- O jogo começa no outono. O campo já produz nas semanas que restam antes do inverno: o primeiro inverno é difícil, mas não fatal. (Já implementado.)
- Prata inicial para cerca de 6 construções; comida e lenha precisam estar no plano desde o início.
- A abertura varia de partida para partida (às vezes mais casas, às vezes mais campos), conforme a comida inicial, o tamanho da caravana inicial e o terreno (rio perto, rochas, bosques). (Já implementado em parte; falta o efeito de rochas e bosques sobre madeira e pedra.)
- Fim do primeiro ano com 6 a 10 casas (hoje são cerca de 16).
- Marcos comemorados: primeira família, primeira casa de barro, primeira colheita, primeiro inverno vencido, primeiro casamento. (Só falta o casamento.)

### Mecânicas

#### Comida e celeiro
- Campo: produz em três estações e para no inverno. Seca reduz a produção; campos perto do rio ficam protegidos. (Já implementado.)
- Campo grande: ocupa 4x4, tem a casa do dono e os trabalhadores e produz o dobro de um campo comum. Pode evoluir para 6x6 (tamanho final a definir em teste).
- Pasto: pouca comida, mas produz o ano todo, inclusive no inverno, e é quase imune à seca. Também fornece couro.
- Pescador e Coletora: continuam como fontes do ano todo. A Coletora cobre as frutas das árvores.
- Celeiro: o jogador define quanto guardar para o inverno. Guardar muito garante o inverno, mas o povo come menos durante o ano e fica insatisfeito.
- Previsão "comida até" (já existe) e "lenha até" na tela de estatísticas.

#### Lenha, madeira e pedra
- Madeira serve para construir e para lenha. Pedra serve para casas de pedra e para o templo.
- Lenhador no bosque e pedreira nas rochas, com trabalhadores.
- No inverno, cada casa consome lenha. Sem lenha, os moradores sofrem com o frio e começam a ir embora (tendas sofrem mais).
- Árvores cortadas reduzem a Coletora e crescem de volta devagar.
- Aumentar bastante a densidade do mapa: mais bosques para madeira e mais rochas para pedreiras.

#### Moradia
- Casa nova é cara e lenta: custa prata e materiais e só recebe família quando a cidade tem sobra de comida e lenha para mais gente. O caminho normal para abrigar mais pessoas é evoluir as casas existentes.
- Casa: evolui de tenda para casa de barro e para níveis melhores quando há praça, parque ou mercado por perto, e com os materiais de cada nível. Cada nível leva uma estação para ser alcançado.
- Alojamento: muito barato, quase sem manutenção, cabe muita gente, mas os moradores não gostam de morar lá (ânimo menor). É a saída de emergência para quem está sem casa.
- Cada casa mostra quem mora nela (crianças, adultos e idosos).

#### Pessoas
- Gerador de nomes judaicos para os moradores.
- Ficha de cada morador: nome, sexo, data de nascimento, idade, profissão e casa.
- Três idades:
  - Crianças: não trabalham e comem muito.
  - Adultos: trabalham e comem.
  - Idosos: não trabalham e precisam de assistência médica (a partir da fase de doenças).
- Nascimentos dependem de comida e casa. Moradores envelhecem e morrem com o tempo.
- Casamentos: adultos se casam e precisam de uma casa nova para sair da casa dos pais. O primeiro casamento é um marco.
- Caravanas periódicas, anunciadas, trazem novas famílias e passam a ser a principal forma de chegada.

#### Roupas
- Começa com roupa simples, feita na oficina.
- Depois o povo precisa de roupas de couro, que exigem animais do pasto.
- Roupa adequada ajuda a resistir ao inverno.

#### Oficinas com tipos e evoluções
- Uma única construção "Oficina", com tipos escolhidos pelo jogador: ferramentas primeiro, depois roupas e outros tipos ao longo do jogo. Os 6 ofícios que hoje são só aparência viram tipos reais.
- A oficina produz bens (ferramentas, roupas), não prata.
- Cada tipo tem níveis de evolução, evitando criar muitas construções diferentes.

#### Decisões de governo (tela de estatísticas)
- Impostos em porcentagem, começando em 20%. Mais imposto dá mais prata e menos ânimo.
- Reserva do celeiro para o inverno.
- Porção do povo (Menor, Normal, Farta).

#### Eventos da época
- Ruins: povos vizinhos desanimando os construtores; decretos do rei que atrapalham as obras; seca; doenças.
- Bons: caravanas com mais pessoas; mercadores trocando prata por comida.
- Todo evento tem aviso prévio de 1 a 2 semanas.

#### Inverno visual
- Sprites das casas com neve no telhado, para que o inverno fique visualmente mais intenso.

### Pacotes (uma mecânica nova por pacote)
1. Ritmo: casas levam uma estação para subir de nível; capacidade em passos menores; menos famílias avulsas; objetivos espalhados pelos anos; "Primeira colheita" sai dos objetivos; aviso de desemprego ignora o campo congelado; oficina deixa de dar prata. Medir duração e vitórias antes de seguir.
2. Água sai e mapa: remoção da água e do poço; casas evoluem perto de jardim (praça e parque), mercado e altar; mapa mais denso em bosques e rochas.
3. Madeira e pedra: lenhador e pedreira; madeira e pedra no custo das obras e das evoluções; árvores cortadas reduzem a Coletora e crescem de volta.
4. Lenha e inverno: consumo de lenha no inverno; previsão "lenha até"; inverno mais caro para tendas; neve nas casas; reserva do celeiro ajustável.
5. Obras com tempo: canteiro, construtores saindo dos trabalhadores, fila de obras, comemoração.
6. Recuperação e vitória: dívida trava obras e faz famílias irem embora aos poucos; derrota só com a cidade quase vazia; mensagem "Jerusalém resistiu"; templo liberado a partir do Ano 8 e com 500 moradores, com custo, materiais e requisitos calibrados para cerca de 30% dos jogadores.
7. Moradores: gerador de nomes judaicos, ficha de cada morador, crianças, adultos e idosos, nascimentos e mortes, contagem por casa, caravanas anunciadas.
8. Casamentos e moradia: casais saem da casa dos pais; primeiro casamento como marco; alojamento.
9. Governo: impostos em porcentagem (início 20%) e porção do povo na tela de estatísticas.
10. Evoluções: altar e templo únicos; campo grande com casa do dono; oficina com tipos e níveis (ferramentas aumentam produção).
11. Pasto e roupas: pasto com comida no inverno e couro; roupa simples e de couro.
12. Seca na fase certa: começar no Ano 3 (hoje começa no Ano 2).
13. Doenças: idosos precisam de assistência; construção de cuidado médico.
14. Eventos da época: povos vizinhos, decretos do rei, caravanas e mercadores.
15. Incêndio com aviso e resposta (proteção a redefinir, já que o poço saiu).

Saíram da lista por já estarem prontos: estações de 13 semanas, começo no outono, campo em três estações, previsão "comida até", marcos (exceto casamento), frutas pela Coletora e seca com proteção do rio.

### Pendências para decidir
- Tamanho final do campo grande: 4x4 ou 6x6.
- Como proteger contra incêndio sem o poço.
- Nome e efeito da construção de cuidado médico.
- O pescador continua, mesmo sem o poço? (Sugestão: sim, é a fonte de comida ligada ao rio.)
- Ano a partir do qual o templo é liberado (sugestão: Ano 8).
- Capacidade de cada nível de casa para chegar a 500 moradores com casas difíceis de conseguir. Sugestão: crescer pouco nos níveis baixos e muito nos altos (tenda 4, barro 6, pedra 10, casa grande 20, mais um nível acima, como casa senhorial, com 30), ou seja, cerca de 25 a 35 casas bem evoluídas no fim. O alojamento também ajuda a abrigar muita gente, com ânimo menor.
- Ritmo de crescimento: 500 moradores em cerca de 10 anos dão uma média de 50 por ano, com o crescimento concentrado nos últimos anos, quando as casas já evoluíram.

### Critérios gerais
- Um ano do jogo dura de 2,5 a 3 min reais em 1x (hoje 2,2 min).
- Partida do jogador comum entre 25 e 35 min (hoje 2,6 min).
- Cerca de 30% dos jogadores vencem (hoje 90% a 100%).
- Nenhuma abertura é a melhor em todas as partidas.
- Nenhuma espera maior que 30 s sem nada para fazer ou olhar. Olhar a cidade viva conta: a espera calma é aceitável quando há movimento e mudança na tela.
- A cidade do Ano 10 é visivelmente diferente da cidade do Ano 3 (fun-critic avalia "gosto de olhar a minha cidade" pelo menos 7).
- Distraído passa por pelo menos uma crise e uma recuperação; nunca perde antes de 8 min.
- Com produção quase contínua, o inverno precisa continuar sendo um teste real, não apenas uma pausa: o jogador comum passa fome em pelo menos um inverno em metade das partidas.
- Fim do primeiro ano com 6 a 10 casas.
- fun-critic: "vontade de jogar de novo" e "curva de dificuldade" pelo menos 7.

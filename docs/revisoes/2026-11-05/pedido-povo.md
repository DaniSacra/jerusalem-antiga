# Pedido do usuário · Pacote "Povo" (2026-11-04)

Texto do pedido, como o usuário mandou (o plano de sobrevivência que vinha no fim está em
`docs/revisoes/2026-11-04/plano-sobrevivencia.md`).

## Contexto
O Pacote "Água sai e mapa" (versão 3ab0f46) já está pronto. Este pacote vem **antes** do Pacote 3 "Madeira e pedra" planejado em `docs/revisoes/2026-11-04/plano-p3.md`: o Povo muda a capacidade das casas, o crescimento e a meta do templo, e os materiais precisam ser calibrados depois disso. Guarde o plano do P3 e recalibre-o ao fim deste pacote.

Na versão 3ab0f46 o comum constrói 21 celeiros e 58 casas por partida, e a cidade passa de 600 moradores no Ano 9: impossível conhecer as pessoas.

O Pacote 1 "Ritmo" (versão a06d471) acertou a duração: a partida do comum dura cerca de 27 min, o ano 2,8 min e o Ano 1 termina com 8 casas. Mas a validação mostrou que o jogo ainda não prende:
- a cidade explode no Ano 2 (de 46 para 192 moradores) e depois anda devagar, com cerca de 7 min sem objetivo e mais 15 min esperando os 500 moradores;
- o crescimento depende do relógio (uma família a cada 6 semanas), não do jogador; o bot eficiente vence menos (25%) que o comum (48%);
- o inverno não pesa, porque pescador e coletora seguram a comida;
- a manutenção começa toda de uma vez e 40% das partidas do comum entram em dívida no Ano 2;
- o celeiro guarda pouco: joguei uma partida e precisei de 5 celeiros para 13 casas (e perdi);
- as famílias são anônimas, e não há apego.

O rumo agora é o apego às famílias. O jogo é contemplativo no sentido de o jogador acompanhar as mesmas famílias por gerações: elas casam, têm filhos, envelhecem e morrem. A cidade cresce por dentro, e o cuidado do jogador decide o ritmo.

## O que fazer

### 1. Atualizar o plano no repositório
Substitua `docs/revisoes/2026-11-04/plano-sobrevivencia.md` pelo plano do fim deste prompt, sem alterações. (Feito.)

### 2. Plano do game-director
Escreva `docs/revisoes/2026-11-05/plano.md` com a especificação completa do Pacote Povo: regras, números iniciais, mudanças em `src/data/`, telas e textos, e como os bots do simulador passam a jogar. Pendências em que tiver recomendação, marque como recomendação (a decisão final é minha).

### 3. Implementar o Pacote "Povo"
Entregue tudo de uma vez, pronto para eu testar.

**Pessoas**
- Cada morador é uma pessoa com nome (gerador de nomes judaicos da época, masculinos e femininos, com sobrenome de família ou "filho de"), sexo, semana de nascimento, idade, profissão e casa.
- Três idades: criança (não trabalha e come mais que adulto), adulto (trabalha e come), idoso (não trabalha e come menos; a assistência médica fica para o pacote de doenças).
- Trabalhadores passam a ser os adultos, no lugar dos 50% de hoje (`workerShare`). Profissão = onde trabalha (lavrador, pescador, coletora, oleiro...), ou "sem trabalho".
- A idade avança com o tempo do jogo. Calibre as faixas para que, em cerca de 10 anos de partida, o jogador veja crianças virando adultos e alguns idosos morrendo. As idades podem ser comprimidas (um ano do jogo pode valer vários anos de vida); proponha a escala no plano.
- Mortes por idade, com um aviso discreto ("Morreu Ezequias, aos 71 anos"); fome e frio continuam fazendo famílias irem embora como hoje.

**Casamentos e nascimentos**
- Adultos solteiros de famílias diferentes se casam com uma chance por semana. O casal precisa de uma casa vazia (terreno ligado à rua) para sair da casa dos pais; sem casa, o casamento espera e aparece o aviso "Casal esperando casa: construa uma casa".
- Nascimentos: casais com casa própria têm filhos com uma chance que depende de sobra de comida, alegria e espaço na casa (casa cheia não tem filhos). Cidade com fome não tem nascimentos.
- A casa passa a ser de uma família (pais, filhos e às vezes avós), e a capacidade é o limite de pessoas daquela família.
- **Menos moradores por casa**, para o jogador conhecer cada um: tenda 3, casa de barro 4, casa de pedra 6, casa grande 8 (hoje 4, 6, 10 e 20). Recalibre imposto e consumo por nível para a economia continuar coerente.
- Primeiro casamento e primeiro nascimento são marcos.

**Fim das famílias avulsas e caravanas raras**
- Remova a chegada contínua de famílias (porta das famílias, `familyChance`, `familyIntervalWeeks`). A caravana inicial continua como está.
- Caravanas raras: duas a três por partida, anunciadas com 4 a 8 semanas de antecedência ("Uma caravana de 3 famílias chega no verão"), trazendo de 2 a 4 famílias. Precisam de casas vazias quando chegam; famílias sem casa vão embora. A chegada é comemorada como marco.
- Proponha no plano em quais anos as caravanas vêm (sorteado dentro de uma janela, por exemplo uma no Ano 2 ou 3 e outra no Ano 5 ou 6).

**Telas**
- Balão da casa: lista de quem mora nela (nome, idade, profissão), com ícones de criança, adulto e idoso.
- Ficha da pessoa ao tocar no nome: nome, sexo, idade, profissão, casa, pais, cônjuge e filhos.
- Estatísticas: crianças, adultos e idosos; nascimentos e mortes do ano; casais esperando casa; próxima caravana.
- No celular, tudo legível (nada abaixo de 12 px) e com toque mínimo de 44 px.

**Objetivos ligados às pessoas**
Reescreva `goals.json` com um objetivo a cada 2 ou 3 minutos ao longo da partida, misturando cidade e pessoas, por exemplo: primeiro casamento, primeiro nascimento, receber a primeira caravana, primeira criança nascida na cidade que vira adulta, terceira geração (um neto de alguém da caravana inicial). Mantenha a vitória pelo Templo. Objetivos de população acompanham a escala nova (por exemplo 30, 60, 100 e 150 moradores).

**Ajustes de ritmo junto com o pacote**
- **Celeiro maior e com níveis:** estoque base 100; celeiro guarda 300 (nível 1), 600 (nível 2) e 1000 (nível 3). Subir de nível custa prata e aumenta a manutenção. Meta: uma cidade de 15 casas atravessa o inverno com 1 celeiro, e de 25 casas com 1 celeiro de nível 2 ou 2 de nível 1.
- **Manutenção crescente e sem degrau:** remova `upkeepStartsAfterGoal`. Toda construção paga manutenção desde que é construída, em valor menor no começo, e a manutenção cresce com o tamanho e o nível. A prata do meio do jogo passa a ter destino nas evoluções e na manutenção delas.
- **Evolução das construções de serviço:** celeiro, mercado e oficina sobem de nível (nível 2 e 3), pagando prata; cada nível rende mais (capacidade, alcance ou bônus) e custa mais por semana. Use um mecanismo único para todos (DRY), preparado para os próximos pacotes.
- **Inverno com peso:** pescador e coletora rendem bem menos no inverno (sugestão: 30% do normal). Volte o consumo de inverno para perto do anterior se o simulador mostrar derrotas demais.
- **Evolução das casas espalhada:** cada casa sorteia de 11 a 15 semanas para subir de nível, para o bairro não subir todo na mesma semana.

**Meta do templo:** cerca de 150 moradores (umas 25 casas no fim). Meça também 120 e 200 com `--set` e relate as três no relatório. Vou decidir com os números.

Fora do escopo: madeira, pedra (Pacote 3, já planejado), lenha, alojamento, governo, doenças e eventos.

### 4. Critérios de aceite do Pacote Povo
Medidos com `npm run sim` (100 seeds por bot, até a semana 700), comparados com a 3ab0f46:
- Vitória do comum entre 25 e 35 min; taxa de vitória geral perto de 30%.
- O bot eficiente vence mais e mais cedo que o comum, e o comum mais que o distraído: jogar bem tem que fazer diferença.
- Crescimento sem explosão: nenhum ano com mais que o dobro de moradores do ano anterior a partir do Ano 2.
- Nenhum intervalo maior que 4 min sem objetivo cumprido (mediana do comum).
- O comum passa fome em pelo menos um inverno em 40% a 60% das partidas, com no máximo 5% de derrotas.
- Dívida do comum no Ano 2 abaixo de 15%.
- Uma cidade de 15 casas precisa de no máximo 1 celeiro para o inverno.
- Pelo menos 3 casamentos e 5 nascimentos no Ano 2 do comum; caravanas chegam e encontram casa na maior parte das partidas.
- O distraído passa por crise e recuperação e nunca perde antes de 8 min.
- Nenhuma partida do comum com mais de 3 celeiros.

### 5. Revisões depois de implementar
- **sim-tester:** tabela dos critérios, antes e depois, com as metas de 120, 150 e 200 moradores.
- **playtester:** partidas reais no celular (844 x 390, toque) e no PC (1366 x 768), com foco no balão da casa, na ficha da pessoa e nos avisos de casamento e caravana.
- **fun-critic:** notas de 0 a 10 para "vontade de jogar de novo", "curva de dificuldade", "gosto de olhar a minha cidade" e uma nova, "me apeguei às famílias". Meta: pelo menos 7 em todas. Ele deve contar a história de uma família que acompanhou ao longo da partida.
- **code-reviewer e test-reviewer:** como de costume.

Relatórios em `docs/revisoes/2026-11-05/`.

### 6. Regras de sempre
- Código e mensagens de commit em inglês; textos da tela em português.
- DRY e KISS, testes unitários para toda regra nova, máximo reaproveitamento de código.
- Toda mudança de regra atualiza o `docs/GAME_DESIGN.md`, os JSON em `src/data/` e os testes em `tests/`.
- `npm test`, `tsc` e `npm run test:visual` passando antes do commit.
- Não preciso de capturas de tela nem GIFs; use-as só se forem úteis para os próprios agentes.
- No fim, me mande um resumo curto: o que mudou, a tabela dos critérios e as decisões que ficaram para mim.

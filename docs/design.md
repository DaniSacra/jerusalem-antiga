# Jerusalém Antiga — direção do jogo

Mantido pelo game-director. As regras e os números completos ficam em `docs/GAME_DESIGN.md`.

## Pilares
1. Simples: uma pessoa entende o jogo em menos de 1 minuto.
2. Cidade viva: gente andando pelas ruas, casas evoluindo, coisas se mexendo.
3. A diversão é posicionar bem: o bairro inteiro sobe de nível quando o lugar é bom.
4. Mecânica antes de história: nenhuma narrativa antes do playtest aprovar a mecânica.
5. Uma mecânica nova por vez, sempre liberada por meta.

## Estado atual (após o pacote "Manutenção e falência", 2026-11-02)
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
    demolir serviços que atendem poucas casas"), desemprego
  - tocar na prata mostra na linha de informação: impostos, oficinas,
    manutenção por tipo e saldo
  - dica e prévia da ferramenta: "Mercado: 40 prata, 3/mês"; Ver numa
    construção mostra "Manutenção 3/mês"
  - valor da prata: normal com saldo ≥ 0, laranja com saldo do mês negativo,
    vermelho piscando em dívida
- Em dívida e com fome ao mesmo tempo, a etiqueta de dívida troca a dica para
  "Dívida e fome: demolir serviços para pagar um campo"
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

## Próximos candidatos
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

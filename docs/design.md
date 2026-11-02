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
  trabalho, mês e meta atual
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
  "Em dívida e com fome: demolir serviços para juntar prata para um campo"
- Equilíbrio medido (100 seeds): Eficiente vence 100/100 sem dívida, mês 56;
  Comum vence 96/100, 82 com saldo negativo e 36 em dívida recuperada, mês 94;
  Distraído perde 81/100
- fun-critic (2026-11-02): diversão 7, sempre algo a fazer 6, curva 5,
  recompensas 7, clareza das metas 5, cidade viva 8, vontade de jogar de novo 6

## Em andamento: pacote "Avisos a tempo" (aprovado 2026-11-02, não implementado)
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

## Próximo: pacote "Campo é trabalho" (pedido do usuário, aprovado 2026-11-02)
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
  vence ≥ 90% com aperto, Distraído perde ~80%). Se a prata sobrar demais,
  testar campo `silver` 0,5; se o desemprego travar o Comum antes da Oficina,
  testar oficina `jobs` 4. O game-director aprova os números finais

## Depois: pacote "Interface nova" (pedido do usuário, aprovado 2026-11-02)
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

## Decisões
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
- 2026-11-02 — Ferramentas só com ícone; nome, custo e dica vão para a linha
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

## Próximos candidatos
Em ordem, um pacote por vez.
1. Fé/felicidade: aumenta perto do altar, do templo e de jardins; diminui
   com oficina perto de casa e com fome; cidade com mais fé recebe famílias
   mais rápido e paga mais impostos
2. Pedidos dos moradores (missões curtas, futura porta de entrada da
   história)
3. Eventos leves (seca, festa, caravana) e celeiro
4. Pasto, só se for diferente do campo (mais espaço e menos trabalhadores,
   produto próprio ou ligação com o altar)
5. História de Esdras e Neemias, versículos na versão ARA
6. Nível da cidade = metas cumpridas + 1
7. Painel de estatísticas com prata, comida, casas por nível, trabalho,
   gráficos e principais problemas (inclui fome como primeiro problema com
   dica "construa campos"). Absorve a lista de avisos do core e o detalhe da
   prata (impostos, oficinas, manutenção por tipo, saldo) do pacote
   "Manutenção e falência"

Ajustes de equilíbrio em espera (dependem do sim-tester): oficina 8 de prata,
imposto menor de pedra/casa grande.

Interface em espera: botão "Mesmo mapa" (mesma seed) na tela de derrota.

Visual aprovado pelo usuário (2026-11-02), depois de "Avisos a tempo":
"Cidade densa", inspirado no visual orgânico de Banished, em 2D isométrico
desenhado em código e com tema de Jerusalém: grupos de árvores, grama
variada, trilhas de terra gastas, sombras no chão, textura de telhado e
parede, fumaça de chaminé e mais vida na rua. Sem câmera 3D e sem copiar
arte. map-designer + sprite-artist. O game-director fecha o escopo antes.

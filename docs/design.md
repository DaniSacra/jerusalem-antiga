# Jerusalém Antiga — direção do jogo

Mantido pelo game-director. As regras e os números completos ficam em `docs/GAME_DESIGN.md`.

## Pilares
1. Simples: uma pessoa entende o jogo em menos de 1 minuto.
2. Cidade viva: gente andando pelas ruas, casas evoluindo, coisas se mexendo.
3. A diversão é posicionar bem: o bairro inteiro sobe de nível quando o lugar é bom.
4. Mecânica antes de história: nenhuma narrativa antes do playtest aprovar a mecânica.
5. Uma mecânica nova por vez, sempre liberada por meta.

## Estado atual (após o pacote "Mapa maior e construções grandes", 2026-11-02)
- Mapa 48 x 48. Altar 4 x 4 fixo no centro (canto em 22,22) e uma rua inicial
  na coluna 24 até a entrada da cidade na borda sul (24,47)
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
- 8 metas em sequência; metas liberam construções:
  1. 6 casas ligadas à rua (tenda ou melhor): +20
  2. 20 moradores: +30, libera Mercado
  3. 5 casas de barro ou melhores: +40, libera Oficina
  4. 80 moradores: +60
  5. 6 casas de pedra ou melhores: +80
  6. 150 moradores: +120
  7. 4 casas grandes: +150, libera Templo
  8. Construa o Templo: vitória
- Metas de casas contam só casas ligadas à rua
- Barra no topo com prata, comida (pisca vermelha durante a fome), moradores,
  trabalho, mês e meta atual
- Clareza: rua sem ligação ao altar desenhada apagada e tracejada, com aviso
  ao construir; balão "sem rua" com ícone próprio; balão "sem trabalhadores"
  em locais de trabalho com eficiência 0; com a ferramenta Templo, destaque
  dos lugares onde ele cabe

## Decisões
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
   dica "construa campos")

Ajustes de equilíbrio em espera (dependem do sim-tester): oficina 8 de prata,
imposto menor de pedra/casa grande.

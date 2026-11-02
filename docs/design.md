# Jerusalém Antiga — direção do jogo

Mantido pelo game-director. As regras e os números completos ficam em `docs/GAME_DESIGN.md`.

## Pilares
1. Simples: uma pessoa entende o jogo em menos de 1 minuto.
2. Cidade viva: gente andando pelas ruas, casas evoluindo, coisas se mexendo.
3. A diversão é posicionar bem: o bairro inteiro sobe de nível quando o lugar é bom.
4. Mecânica antes de história: nenhuma narrativa antes do playtest aprovar a mecânica.
5. Uma mecânica nova por vez, sempre liberada por meta.

## Estado atual (após o pacote "Equilíbrio e clareza", 2026-11-02)
- Começa com o altar no centro (a "prefeitura") e uma rua até a entrada
  da cidade na borda sul
- Ruas obrigatórias: toda construção precisa encostar numa rua ligada ao
  altar; moradores e famílias novas andam só pelas ruas
- Casas evoluem: tenda (rua), barro (+ poço), pedra (+ mercado),
  casa grande (+ raio do altar ou do templo)
- Altar com raio 3 (casa grande vira escolha de lugar); templo com raio 9
- Categorias: casas = moradia, mercado = comércio, oficina = indústria,
  campo = comida
- Comida e trabalhadores (40% dos moradores) são o equilíbrio da cidade;
  campo e mercado têm 3 vagas, oficina 3
- As 3 primeiras casas ligadas à rua recebem família com certeza; depois, 35% por mês
- Templo 3 x 3 custa 800 e é a meta final
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

# Jerusalém Antiga — direção do jogo

Mantido pelo game-director. As regras e os números completos ficam em `docs/GAME_DESIGN.md`.

## Estado atual
- Começa com o altar no centro (a "prefeitura") e uma rua até a entrada
  da cidade na borda sul
- Ruas obrigatórias: toda construção precisa encostar numa rua ligada ao
  altar; moradores e famílias novas andam só pelas ruas
- Casas evoluem: tenda (rua), barro (+ poço), pedra (+ mercado),
  casa grande (+ raio do altar ou do templo)
- Categorias: casas = moradia, mercado = comércio, oficina = indústria,
  campo = comida
- Comida e trabalhadores (50% dos moradores) são o equilíbrio da cidade
- Templo 3 x 3 é a construção especial e a meta final
- Metas liberam construções
- Barra no topo com prata, comida, moradores, trabalho, mês e meta atual

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
   gráficos e principais problemas

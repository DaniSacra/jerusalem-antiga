# map-designer - 2026-11-02
Foco: tudo o que já está pronto: Interface nova, pacote visual Cidade bonita (partes 1–6), Campo é trabalho e Felicidade (com Jardim)

## Revisão de mapas (map-designer): 5 seeds (1, 2, 3, 42, 999)

Foi uma revisão só de leitura. Não alterei nenhum arquivo do projeto e não fiz commit. Gerei os mapas com `createGame(createRng(seed))` num teste vitest temporário em /tmp/claude-1000/-home-dani-projects-jerusalem-antiga/07eca283-40fb-481c-a305-b854ecaa59b1/scratchpad/map/review.test.ts. A saída, com os mapas ASCII dos seeds 1 e 42, está em /tmp/claude-1000/-home-dani-projects-jerusalem-antiga/07eca283-40fb-481c-a305-b854ecaa59b1/scratchpad/map/out.txt. Para as ovelhas, lavadeiras e barcos, copiei a lógica de `src/render/Ambient.ts`, com o mesmo `cellHash`. Não rodei `test:visual`.

### O que está bom (nos 5 seeds)
- **Altar e raio livre:** nenhuma rocha ou árvore a até 9 células da borda do altar. O anel (21..26) e a rua x=24 até (24,47) estão sem obstáculo. A entrada é (24,47).
- **Templo 6x6:** há 43 a 47 posições ligadas à rede, todas a até 12 células do altar, sem cortar árvores. Sem exigir rua, são 185 a 236. Passa com muita folga.
- **Campos longe do centro:** há uns 270 blocos 2x2 livres a 10 ou mais células do altar.
- **Jardim 2x2:** testei uma cidade inicial de 12 casas (6 dos dois lados da rua sul e 6 em volta do anel). Ficam 23 a 30 posições de jardim encostadas na rede. As melhores, nos cantos do anel, como (19,26) e (27,26), atendem 4 casas no raio 3. Cabe bem. Só não cabe no meio de uma fileira de casas coladas, onde o jogador precisa deixar um vão.
- **Ovelhas:** de 294 a 426 células de grama elegíveis. Sempre saem 3 rebanhos, que continuam depois de construir as casas iniciais e se mudam quando a cidade ocupa o lugar.

### Problemas, por prioridade
1. **Lavadeiras e barcos não ficam nas margens mais próximas da cidade (bug, `Ambient.ts`).** A distância é Chebyshev a partir do canto do altar (22,22). Do x=43 ao x=44 ela vale 21 ou 22 em quase toda a altura do rio, então o critério empata. No empate, o `cellHash` decide para as lavadeiras e a ordem de y decide para os barcos.
   - Lavadeiras: saem em y≈6, 33 e 41/42 em **todos os seeds**. As linhas 8 a 29, que ficam na frente da cidade (rio com 3 células, margem em x=44), nunca são escolhidas.
   - Barcos: sempre em y=3, na borda norte, e y=31.
   - Correção sugerida (sprite-artist): medir a partir do centro do altar (23.5, 23.5) usando distância euclidiana, ou pelo menos ordenar por |y − 23.5|.
2. **Vegetação e rochas espalhadas por igual, sem bosques nem clareiras (`map.ts`, `generateTerrain`).** O gerador só embaralha as células candidatas. As medidas confirmam o espalhamento:
   - A média de vizinhos iguais é a mesma de uma distribuição uniforme. Para árvores, 0,45 a 0,62 contra 0,53 esperado.
   - Entre 55% e 63% das árvores ficam isoladas. O maior grupo tem de 4 a 6 árvores.
   - Rochas: de 36 a 46 isoladas em 50, e o maior grupo tem 2 ou 3. Seed 3 tem 46 rochas soltas.

   Isso descumpre a regra de bosques e de rochas agrupadas. Como rochas não podem ser removidas, as soltas furam a área de expansão sem formar cantos bonitos. Sugestão: semear de 6 a 9 núcleos de bosque por seed fora do raio livre (oliveiras perto de grama, palmeiras perto do rio), espalhar em volta com peso por distância, e fazer 4 a 6 afloramentos de rocha com 6 a 12 células cada, de preferência nos cantos e bordas.
3. **Rio igual em todos os seeds e quase reto.** `riverWidth(y)` não usa o rng: a largura por linha é `444444443333…` em todos os seeds, com só 3 degraus de 1 célula. Não tem curvas naturais. Sugestão: fase e amplitude vindas do rng, e margem oeste variando de 3 a 6 com passo de no máximo 1 por linha, para continuar contínuo. Isso exige atualizar o teste de `tests/map.test.ts`, que hoje fixa a largura 3/4 por coluna.
4. **Entrada pouco visível.** Só a célula da rua está reservada. Rochas e árvores ficam coladas na rua sul a partir de y≈35 (de 3 a 9 elementos em x 20..28, y 40..47), por exemplo uma rocha em (25,42) no seed 999 e uma palmeira em (25,42) no seed 2. O render não marca a entrada, e ela só aparece no texto do info. Sugestão: reservar uma faixa de 2 células dos dois lados da rua nas últimas 6 linhas e pedir ao sprite-artist um marco de entrada, como pilares ou um portão simples.
5. **Ambiente igual entre seeds.** A decoração do chão (`decoShare` 0.15) e a ordem das ovelhas usam `cellHash(x,y)`, não o seed. Por isso o mesmo rebanho em (34,22) aparece nos seeds 1, 2 e 3, e as flores e pedrinhas ficam no mesmo lugar em todo mapa. A decoração também não acompanha os bosques. O ideal é ter mais arbustos e flores perto dos grupos e da grama.
6. **Pequenos desvios.**
   - `nearCity` (16) também mede a partir do canto (22,22), e por isso a área das ovelhas pende para norte e oeste em 1,5 célula.
   - A grama fica entre 37% e 41% da terra, mas o GAME_DESIGN diz cerca de 45%. É preciso ajustar `grassShare` ou o texto.
   - No começo, alguns rebanhos ficam no raio livre, como em (24,18) nos seeds 2 e 42. Não é erro, porque eles saem quando o jogador constrói, mas tira a calma do centro.

### Testes que faltam em `tests/map.test.ts`
Existem testes do raio livre, do anel e da rua, da contagem de elementos e do rio com largura fixa. Faltam:
- uma posição de templo válida a até 12 células do altar (pelo menos 3, via `templeSpots`);
- agrupamento de árvores e rochas, com algum limite de isoladas;
- rio que varia com o seed e continua contínuo;
- área livre em volta da entrada.

### Resumo
O núcleo jogável está sólido em todos os seeds: altar, anel, rua, entrada, templo, jardim e campos. O que pede trabalho é a parte estética do terreno (bosques, rochas, rio por seed, entrada) e o posicionamento de lavadeiras e barcos, que hoje ignora a cidade.

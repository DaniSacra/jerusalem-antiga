# sprite-artist - 2026-11-02
Foco: tudo o que já está pronto: Interface nova, pacote visual Cidade bonita (partes 1–6), Campo é trabalho e Felicidade (com Jardim)

## Revisão de arte (somente leitura): pacote "Cidade bonita" 1–6, agricultores, Jardim e humor

Não editei, criei nem apaguei nada no projeto, e não rodei `npm run test:visual`. Para a análise usei as capturas do scratchpad (town-art, ambient-town/river, day-night-*, field-work-*, roads-wear, scaffold, overlay-garden, happiness-*, camera-zoom-*) e li o código de `src/render`: Ambient, fauna, Fieldhands, FinishPipeline, DayNight, Lights, RoadWear, o diff de MapView/palette e as funções `garden` e `face` em textures.ts.

### Visão geral
A cidade deu um salto. Tem cara de maquete com luz quente e está viva: ovelhas pastando, galinhas, jumento amarrado no mercado, pombas no altar, varais balançando e agricultores capinando e colhendo dentro das fileiras. A ordenação dos agricultores entre os tufos (Fieldhands) ficou muito boa e funciona em qualquer rotação. O templo continua sendo a construção mais bonita. O que mais pesa contra a beleza hoje é o **chão**, a **água** e a **noite**, não os prédios.

### O que está bom
- **Agricultores** (`Fieldhands.ts`): poses de enxada e de foice, passos curtos, roupas que nunca se repetem no mesmo campo e o trecho "já trabalhado" escondendo os tufos da frente. Leem bem no zoom máximo (field-work-zoom-max) e ainda aparecem como pontinhos no mínimo.
- **Fauna** (`fauna.ts`): silhuetas simples e claras. A ovelha que abaixa a cabeça para pastar e as pombas que voam quando alguém passa são toques ótimos e baratos. O cap `maxAnimals` e as escolhas estáveis por `cellHash` evitam bichos "pulando" a cada sync.
- **Ruas que evoluem**: o calçamento perto do altar e do templo reforça a "ordem em volta das construções importantes".
- **Pôr do sol e hora dourada** (day-night-golden/sunset): a melhor luz do jogo, bem no clima pedido.
- **Carinhas de humor**: verde, dourada e vermelha, com contorno escuro. Leem bem na placa e no balão de casa triste (happiness-sad), que se destaca dos balões de água.
- **Jardim**: o verde-grama, a cruz de caminhos com o tanque, os canteiros floridos, a oliveira, a palmeira e o banco formam um "oásis" agradável ao lado do altar.

### Problemas, por prioridade

**1. Transição areia/grama em "escadinha" (o maior problema de beleza).** No zoom mínimo e no ambient-river as manchas de grama e areia formam bordas serrilhadas de losango. O chão parece um tabuleiro e não um terreno. Os losangos claros e escuros dos tiles também aparecem no zoom máximo (camera-zoom-in).
Sugestão: bordas de transição pré-geradas por máscara de vizinhos (como já é feito com as ruas): uma franja de tufos ou pontilhado da grama invadindo a areia, mais uma variação de tom mais suave entre as variantes de tile.

**2. O rio parece faixa de estrada.** Em `drawWater` (MapView.ts:550) cada célula ganha um traço branco do mesmo comprimento, na mesma direção e com espaçamento regular, o que lembra marcação de pista. As margens são só uma faixa de areia, sem juncos, papiros nem pedras, e onde o rio encontra a borda do mapa o bloco azul acaba seco no vazio.
Sugestão: brilhos curtos em forma de "v" ou de elipse, com comprimento, fase e alpha variados, e menos densos; um tom mais escuro rente à margem; tufos de junco e pedras na margem (dá para reutilizar a deco do chão); e cortar só a camada de água na borda, deixando o barranco.
Custo: hoje o Graphics é limpo e redesenhado a cada frame para **todas** as células do rio, sem culling. Vale limitar às células visíveis ou trocar por imagens com alpha animado.

**3. A noite fica cinza-lavanda, não noite.** O tint `0x8e96c8` multiplicado deixa tudo lilás e sem contraste (day-night-night). O templo vira "lavanda" e as luzes ficam pequenas demais para se impor.
Sugestão: um azul mais profundo, levemente dessaturado (algo como `0x6a78b0`), e **poças de luz quentes no chão** sob lampiões, fogueiras e o fogo do altar (soft achatado 2:1 em ADD), não só o halo no ponto. Isso dá o contraste "cidade acesa" que hoje falta. Vale também uma lua ou o brilho do céu na água do rio.

**4. A lavadeira pode ficar de costas para o rio** (Ambient.ts, `mover()` → `setFlipX(rand() < 0.5)`). No sprite a pedra de lavar fica à direita da figura, e o espelhamento é sorteado e não usa `c.dx/c.dy`. Em metade dos casos ela lava "na terra".
Correção: definir o flip pelo lado do rio em tela (comparar `gridToWorld` da célula com o da água).

**5. O barco pode sair da água.** `boat()` fixa `gx` na média das células de rio de uma linha e só varia `gy` em ±2,5. Num rio diagonal ou com curva, o barco passa por cima da margem. No mapa atual o rio é reto e não aparece, mas é frágil.
Sugestão: recalcular `tx` pela linha atual (`Math.round(m.gy)`).

**6. As trilhas entre casas são retas de vetor** (`drawTrails`). Viram uma linha reta de centro a centro, fora do eixo isométrico, e atravessam por baixo de outros prédios e campos. Onde se cruzam o alpha soma e aparecem manchas mais escuras.
Sugestão: seguir o eixo da grade em "L", com pontos de pegada ou manchas em vez de `lineBetween`, e pular trechos que passam sob prédios e campos.

**7. Desfoque de miniatura vs. legibilidade.** Com `tiltBlur` 3.5 e `band` 0.5 as casas e os balões perto da borda inferior ficam borrados (canto inferior esquerdo do field-work-zoom-max). No zoom mínimo, que já é pequeno, o blur come detalhe útil.
Sugestão: reduzir o blur conforme o zoom diminui (0 em `zoom ≤ 0.6`), ou tirar os balões do pós-processo (mandá-los para outra câmera ou desenhar depois).

**8. Jardim pode ser confundido com o campo de verduras no zoom mínimo.** Os dois viram um quadrado verde (o campo de repolho é verde-folha e o jardim verde-grama).
Sugestão: dar silhueta vertical própria, como uma **pérgola com videira** (bem judaica, "cada um debaixo da sua videira e da sua figueira") ou um muro baixo de pedra calcária com abertura, e trocar a palmeira por uma **figueira**, que ainda não aparece na cidade. O comentário "Trees at the back" não bate com o código: a oliveira está em y = 0.45, na frente e à esquerda.

**9. Calçamento frio.** A pedra em volta do altar e das ruas "paved" puxa para cinza-azulado e destoa da paleta quente. Na noite isso piora.
Sugestão: puxar o calçamento para a pedra calcária creme (`C.stone` mais quente), com juntas ocre.

**10. Varais duplicados.** As casas de nível ≥ 2 já têm varal desenhado no telhado ou na textura, e o Ambient acrescenta outro varal com postes na frente de 1 em cada 3 (`laundryEvery`). Na casa grande da esquerda (town-art) há pano no telhado e na frente, e fica poluído.
Sugestão: só a linha de chão nas casas cujo telhado não tem varal, ou limitar a casas sem pátio.

**11. Janelas acesas em posição fixa** (Lights.ts: `c.x - 10`, `c.x + 11`). Ignoram `mirrored` e o desenho de cada nível (3, 4, 5), então em algumas rotações e níveis o brilho cai na parede lisa ou no telhado. Além disso a camada `DEPTH.light` fica acima de tudo, e janelas de uma casa atrás de um prédio alto brilham através dele.
Sugestão: expor as posições das janelas em `PARTS` (como já é feito com `tentFire` e `craftFire`).

**12. Balanço das árvores quase imperceptível.** Palmeira com 1,6° e oliveira com 0,7° de rotação da imagem inteira não aparecem nas capturas, e o loop percorre **todas** as árvores do mapa a cada frame.
Sugestão: subir a palmeira para uns 3° e girar só a copa, se ela for separada no futuro, ou animar apenas as features visíveis na câmera.

**13. Fundo do diorama.** No zoom mínimo o mapa flutua num azul-acinzentado liso, com bordas marrons ou azuis secas.
Sugestão barata: um degradê do céu (mais quente embaixo) ou colinas distantes desfocadas atrás da borda norte. Sugere a Jerusalém nas colinas sem custo de jogo.

### Legibilidade no zoom mínimo
- Bom: o templo, o altar com fogo, as fileiras douradas do trigo, os toldos listrados do mercado, as casas de pedra branca, as tendas escuras, as ovelhas (pontos brancos) e os balões.
- Fraco: a cidade ocupa uma fração pequena do mapa e o chão serrilhado domina a imagem (item 1). Agricultores e animais menores viram ruído. O jardim e o campo de verduras se confundem (item 8). O blur piora as bordas (item 7).

### O que mais melhoraria a beleza, em ordem de impacto por custo
1. Transições suaves entre areia e grama (item 1).
2. Rio com brilho irregular e margens com junco (item 2).
3. Noite azul com poças de luz quente no chão (item 3).
4. Figueira e videira ou pérgola: no jardim e espalhadas como decoração perto das casas de nível 3+. É vegetação típica que ainda falta.
5. Plantações em **terraços** com muretas de pedra nas encostas de grama, como pede a direção de arte e ainda não aparece.
6. Gente nos telhados planos das casas grandes ao entardecer (uma figura sentada, jarros), aproveitando o `walkers.evening` que já existe.

### Correções rápidas (baixo risco)
- Flip da lavadeira pelo lado do rio (item 4).
- `tx` do barco seguindo a linha do rio (item 5).
- Comentário do jardim ("trees at the back") corrigido ou oliveira movida para o fundo.
- Culling no `drawWater` e no balanço das árvores (itens 2 e 12).

### Arquivos citados
- /home/dani/projects/jerusalem-antiga/src/render/Ambient.ts
- /home/dani/projects/jerusalem-antiga/src/render/fauna.ts
- /home/dani/projects/jerusalem-antiga/src/render/Fieldhands.ts
- /home/dani/projects/jerusalem-antiga/src/render/Lights.ts
- /home/dani/projects/jerusalem-antiga/src/render/DayNight.ts
- /home/dani/projects/jerusalem-antiga/src/render/FinishPipeline.ts
- /home/dani/projects/jerusalem-antiga/src/render/MapView.ts (`drawWater`, `drawTrails`, balanço das features)
- /home/dani/projects/jerusalem-antiga/src/render/textures.ts (`garden` ~l.1823, `face` ~l.2636, `scaffold` ~l.617)
- /home/dani/projects/jerusalem-antiga/src/data/visual.json (tint da noite, `finish.tiltBlur`, `ambient.laundryEvery`)

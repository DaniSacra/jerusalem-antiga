# Referência de arte 3D: o que aprender com o Banished

Guia curto para os modelos 3D da cidade (código em `src/render3d/models.ts` e pacote Meshy em
`public/models/meshy/`). O **Banished** (Shining Rock Software, 2014) é o nosso benchmark de city
builder: usamos o jeito como ele **se lê de cima**, descrito em palavras. Nada dele entra no jogo:
nenhuma imagem, captura ou arte do Banished (nem de outro jogo) é baixada, enviada ao Meshy como
entrada ou guardada no repositório. O cenário e as formas são da Jerusalém pós-exílio (Levante,
fim da Idade do Ferro / período persa); o estilo final é nosso.

## O que faz o Banished bonito e legível de cima

1. **Escala humana coerente.** Uma casa ocupa 4 x 4 casas da grade (wiki: casa de madeira e casa de
   pedra, `footprint = 4x4`) e tem um ou dois andares baixos: a porta tem ~1,5 vez a altura de uma
   pessoa e o telhado fica a ~3–4 pessoas do chão. Nenhuma casa vira torre. Prédios de trabalho são
   térreos e largos; só o que é importante sobe.
2. **Os prédios assentam no chão, sem pedestal.** Cada modelo tem uma "pegada" pintada no terreno
   (terra batida, caminho) que esconde a grama e casa com as ruas, sem emenda; não há laje grossa
   nem tabuleiro debaixo do prédio (devlog "Creating artwork").
3. **Materiais repetidos em toda a cidade.** O autor usa "o mesmo estilo de telhado e de parede da
   maior parte da cidade" em cada prédio novo, para tudo parecer da mesma vila; só o mercado ganha
   cores mais vivas, de propósito, para se destacar (devlog "Creating artwork").
4. **Variedade dentro da família.** Casas comuns têm vários modelos com telhados e plantas
   diferentes, mas o jogador reconhece "isto é moradia" num relance (devlog "Artwork Variety").
5. **Paleta terrosa e dessaturada, realista sem ser foto.** Madeira gasta, pedra cinza, palha,
   terra; o verde é o da vegetação, não dos prédios. Um leitor do devlog resumiu: "tão simples
   quanto realista" (comentário em "Artwork Variety"). A estação muda luz, névoa, chuva e neve, não
   a cor de cada prédio (devlog "Seasonal Effects").
6. **Sombreamento suave embutido.** Cada modelo leva um mapa de oclusão de ambiente: cantos e
   beirais escurecem, os volumes se destacam mesmo com luz chapada (devlog "Creating artwork").
7. **Silhueta antes do detalhe.** O modelo começa como blocos simples testados *dentro do jogo* até
   o tamanho e a planta "pertencerem" à vila; o detalhe vem depois (devlog "Creating artwork").
   Árvores são baixas em polígonos, com tronco sólido e copa leve (devlog "Orchards and tree
   generation").
8. **Gente, campos e caminhos dão a vida.** Os prédios são calmos; o movimento vem das pessoas, das
   plantações em fileiras e das trilhas que elas abrem.

## Como traduzir para Jerusalém antiga

| Banished | Nosso jogo |
|---|---|
| madeira, palha, pedra cinza, telhado inclinado | calcário claro ("pedra de Jerusalém"), tijolo de barro com reboco bege, vigas de madeira gasta, **telhado plano** de terra batida com parapeito |
| casa 4 x 4 casas de grade, 1–2 andares | casa no lote 2 x 2 (1 casa da grade = 1 unidade, adulto ≈ 0,45): térrea ≈ 1,1–1,4 de altura, a grande no máximo ≈ 2,0; porta ≈ 0,6–0,7 |
| pegada pintada no chão | base fina de terra batida ou lajes rente ao chão (≤ 0,05), da cor do terreno; **nunca** pedestal, rocha ou tabuleiro grosso |
| mesmo telhado e parede em tudo | mesmos quatro materiais em todos os modelos: calcário creme, reboco bege de barro, madeira marrom gasta, terra ocre; cor viva só em tecido (toldos, roupas) e no templo (ouro discreto) |
| mercado mais colorido | o mercado continua o mais colorido, mas com tecidos desbotados (linho cru, ocre, terracota apagado), não vermelho saturado |
| casas variadas, mesma família | os 4 níveis de casa trocam a **silhueta** (tenda baixa, cubo de barro, casa de pedra com terraço, casa de pátio em U), não só a cor |
| verde só na vegetação | oliveira, figueira e palmeira em verde-oliva apagado; grama de parque também apagada, não verde-bandeira |
| silhueta primeiro | de cima, cada prédio tem uma forma única de telhado: tenda escura, terraço quadrado, pátio aberto, toldos em fila, forno redondo, pilha de toras, degraus da pedreira, pátio do templo |

### Regras para os prompts do Meshy

- Fim comum de todos os prompts (4.ª leva em diante):
  "Stylized low-poly city-builder game asset seen from a high camera, muted desaturated earthy
  colors (pale limestone, beige mud plaster, weathered brown wood, dusty ochre), soft baked shading,
  sits directly on a thin flat ground footprint, no raised platform, single centered object."
- Dizer a **altura relativa** ("one storey", "wider than tall", "no tower") e a **planta vista de
  cima** ("U shape around an open courtyard", "a row of three stalls").
- Negar o que o Meshy costuma inventar: rochas e pedestais sob o prédio, ameias, frontão grego,
  colunatas em volta, arcos, ruínas, cabana de toras (não é do Levante), cores saturadas.
- Frente para +z, um objeto só, base plana. Alvo: ≤ 2 500 triângulos (casa e oficina), ≤ 4 000
  (templo), textura 1024 px.

## Nossos modelos comparados ao guia (2026-11-05)

Medidos lado a lado com um adulto (0,45) e na cidade, de dia e de noite, no PC e no celular.
Em ordem do que mais destoa:

| Modelo | O que destoa | Situação |
|---|---|---|
| `temple` (Meshy) | pórtico de colunas em volta e ameias: lê grego/romano, não "simples e imponente"; um bloco solto à esquerda | igual: duas novas tentativas saíram piores (frontão grego; salão sem teto). **Resolvido 2026-11-07 (C8): o Templo agora é por código** (`temple()` em `models.ts`: plataforma em dois degraus com escadaria, pátio lajeado com muro e portaria, santuário alto com pórtico mais alto que o salão, câmaras laterais, janelas estreitas, cornija dourada fina, as duas colunas de bronze, o mar de bronze e o altar de pedras; 5 cores, 5 peças). O `temple.glb` saiu do manifesto e fica só no repositório |
| `house-4` (Meshy) | casa-torre de 2,5 de altura (≈ 5,5 adultos), sem pátio: fora da escala humana | igual: as tentativas saíram sem teto ou com falha preta na textura e mais baixas que a casa de pedra |
| `market` (Meshy) | vermelho saturado e base que parecia rocha | **trocado** (retexture: linho cru, ocre, terracota apagado; base de terra batida) |
| `park` (Meshy) | verde-bandeira, folhas pretas, blocos vermelhos e amarelos | **trocado** (retexture: verde-oliva suave, calcário creme, flores apagadas) |
| todas as casas, pescador, coletora, mercado | laje de base grossa (0,05–0,13) com borda laranja: tabuleiro, não chão | **afundadas** no manifesto (`yOffset`), a laje vira pegada no chão |
| `lumber` (Meshy) | cabana de toras (não é do Levante) | igual: a cabana de barro gerada escondeu a pilha de toras; de cima lia pior |
| `house-2` (Meshy) | pontas de vigas para fora (lembra adobe do sudoeste americano) | igual: a versão sem vigas ficou da cor e quase da altura da casa de pedra |

O que funcionou melhor no Meshy foi o **Retexture** (mesma malha, nova textura com a paleta do
guia, 10 créditos): corrige cor sem risco de estragar a forma ou o encaixe dos acréscimos por código.
Gerar de novo prédios compostos (templo com pátio, casa de pátio, feira) quase sempre falha: o Meshy
erra a planta (corte sem teto, peças soltas, estilo grego). Detalhes e ids em
`public/models/meshy/CREDITS.md` (5.ª leva).

## Fontes

Estilo (só texto, nenhuma imagem baixada):
- Shining Rock Software, devlog "Creating artwork" (2012-08-27):
  https://shiningrocksoftware.com/2012-08-27-creating-artwork/
- Shining Rock Software, devlog "Artwork Variety" (2013-03-26) e comentários:
  https://shiningrocksoftware.com/2013-03-26-artwork-variety/
- Shining Rock Software, devlog "Seasonal Effects" (2013-06-06):
  https://shiningrocksoftware.com/2013-06-06-seasonal-effects/
- Shining Rock Software, devlog "Orchards and tree generation" (2013-05-14):
  https://shiningrocksoftware.com/2013-05-14-orchards-and-tree-generation/
- Wikipedia, "Banished (video game)" (recepção: gráficos e animações elogiados):
  https://en.wikipedia.org/wiki/Banished_(video_game)
- Banished Wiki, "Wooden house" e "Stone house" (pegada 4x4):
  https://banished.fandom.com/wiki/Wooden_house e https://banished.fandom.com/wiki/Stone_house

Arquitetura do Levante (imagens livres, só como referência; nenhuma foi usada como entrada no
Meshy nesta leva):
- "4 room house (archiology).jpg", domínio público:
  https://commons.wikimedia.org/wiki/File:4_room_house_(archiology).jpg
- "Four-room house.jpg", Owenglyndur, CC BY 4.0:
  https://commons.wikimedia.org/wiki/File:Four-room_house.jpg
- "Four room house. Israel Museum, Jerusalem.JPG", Chamberi, CC BY-SA 3.0:
  https://commons.wikimedia.org/wiki/File:Four_room_house._Israel_Museum,_Jerusalem.JPG
- "Horvat Haluqim - Four room house.JPG", Chamberi, CC BY-SA 3.0:
  https://commons.wikimedia.org/wiki/File:Horvat_Haluqim_-_Four_room_house.JPG
- "Ancient millstone of olive press at Kh. Beit Ika.jpg", Davidbena, CC BY-SA 4.0:
  https://commons.wikimedia.org/wiki/File:Ancient_millstone_of_olive_press_at_Kh._Beit_Ika.jpg
- Wikipedia, "Four room house": https://en.wikipedia.org/wiki/Four_room_house

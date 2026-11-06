# Interface 2D (tag `ultimo-2d`) x interface HTML do 3D: inventário e plano de beleza

ui-designer, 2026-11-06. Só leitura, sem mudar código. Lido: `ultimo-2d:src/render/nova/*`, `ui.ts`,
`uiArt.ts`, `textures.ts` (ícones e balões), `Toasts.ts`, `Tutorial.ts`, `scenes/TitleScene.ts`,
`UIScene.ts`, `palette.ts`; e hoje `src/ui/*` (ui.css, icons.ts, labels.ts, tools.ts, parts.ts,
title.ts, modal.ts, toasts.ts, figure.ts), `src/game/palette.ts`, `src/game/model/*`.
Capturas: `screenshots/ui3d-pc-*` já existentes e uma rodada própria (porta 5287, fora de
`screenshots/`) de título, HUD, ferramenta, balão e vitória no celular deitado (844 x 390) e no PC (1366 x 768).

## Resumo

A interface 3D copiou bem a **estrutura** da Nova (barras, pílulas, anel do nível, balões, painéis,
ficha, toasts, tutorial), as **cores** (`NOVA_CSS`) e a **fonte** (`NOVA_FONT`). O que se perdeu foi a
**camada de detalhe**: as miniaturas desenhadas de cada construção (coluna, categorias, botões do
balão), os ícones pintados com contorno de tinta, a cena da cidade atrás da tela de título, a seta
dos balões, a sombra que dava volume aos botões de pergaminho, o anel de brilho do selecionado, a
borda tracejada dos bloqueados, o ponto dourado "novo" e as transições (toast que some esmaecendo,
pílula que brilha quando chega a pedra). Hoje a coluna de construção é uma lista de placas de texto
e é o que mais pesa na tela.

Há também um **bug visual**: a regra `.tool span` (rótulo das ferramentas) também acerta `span.disc`,
dá 8 px de padding horizontal ao disco, e Mover, Rua e Demolir viram ovais que se encostam e saem
pela borda esquerda (ver capturas, nos dois tamanhos).

Nem o 2D tinha textura de pergaminho, fonte decorativa ou ornamentos: tudo era cor lisa. A beleza
"contemplativa" pedida vai além do 2D. As propostas abaixo pegam o que o 2D tinha e somam um
acabamento discreto (relevo, textura leve, transições calmas, título com a cidade viva).

## Inventário: cada detalhe visual da 2D e como está no 3D

Legenda: **igual** / **mais pobre** (como) / **falta**.

### Linguagem geral (widgets.ts, ui.ts, palette.ts)
| Detalhe 2D | 3D |
|---|---|
| Painel escuro translúcido `#24190e` a 0,75, borda clara 1,5 px a 0,2 (`darkPanel`) | **igual** (`.panel`, 0,78), e ainda soma uma sombra |
| Balões e painéis de texto mais densos (0,88) | **igual** (0,94–0,96, até mais opacos) |
| Botão redondo de pergaminho `#f4e8cc` com **sombra deslocada** (preto 0,28, 2 px abaixo): parece em relevo | **mais pobre**: pergaminho liso só com borda de 2 px, sem sombra e sem volume |
| Selecionado: halo dourado claro (0,28, +5 px) **e** aro dourado de 3 px | **mais pobre**: só `box-shadow` dourado 4 px + glow; na coluna só 3 px |
| Bloqueado: pergaminho apagado `#cfc4ad` **com borda tracejada** em 16 traços | **mais pobre**: só cinza e opacidade 0,8, sem tracejado (o estado aparece só pela cor e pelo texto) |
| Sem prata: pergaminho apagado e o preço em vermelho `inkBad` | **igual** (`.build.short`) |
| Botão pressionado encolhe para 0,93 | **igual** (0,94 em `:active`) |
| Botões grandes (diálogos): dourado com sombra embaixo que "afunda" 2 px ao apertar, cor mais escura pressionada | **mais pobre**: capsula dourada lisa, sem sombra nem afundar |
| Fonte arredondada do sistema (`NOVA_FONT`), negrito | **igual** |
| Cor de tinta `#3b2a1a`, dourado `#e2a93b`, dourado claro `#ffd77a` | **igual** (dourado claro não é variável CSS; aparece só na seta) |
| Etiqueta de nome escura (pílula) embaixo dos botões redondos (`nameTag`) | **igual** nas ferramentas; **falta** nos botões do balão (ver Balões) |
| Cursor de mão desenhado (aberta / fechada, contorno de tinta) no Mover | **mais pobre**: cursor `grab`/`grabbing` do sistema |

### Barra de cima (TopBar.ts)
| Detalhe 2D | 3D |
|---|---|
| Disco do nível com sombra, anel de progresso da meta (traço de 4–5 px), número grande, "NÍVEL" em dourado | **igual** (conic-gradient), sem a sombra do disco |
| Pílulas com ícone pintado (moeda, pão, toras, pedra, pessoas, rosto do humor) | **mais pobre**: ícones SVG simples, chapados, pequenos; o pão e a pedra quase não se leem a 22 px |
| Pílulas encurtam em 5 passos para caber numa linha (tiram nomes, "/sem" etc.) | **mais pobre**: no PC 1366 a fila quebra em duas (Pedra e Moradores descem para a linha da meta) |
| Parte piscando (FOME, dívida) só no texto em alpha 0,25 | **mais pobre** em calma: a pílula inteira pisca em vermelho (mais forte; certo como alarme, mas cansa numa sessão longa) |
| Pílula de pedra **brilha em dourado 3 vezes** quando a pedra aparece | **falta** |
| Meta: "Objetivo N de 19", texto, barra de progresso, contagem, poupança do templo | **igual** |
| Estação: ícone que muda (primavera, verão, outono, inverno, seca), "inverno em N sem" em laranja perto do frio | **igual** |
| Velocidade no PC: grupo escuro com 3 botões (pausa, 1x, 3x), o ativo em dourado | **mais pobre**: um único botão dourado que cicla (também no PC; não se vê as opções) |
| Velocidade no celular: um botão dourado que cicla | **igual** |
| Engrenagem: botão escuro com ícone claro | **igual** |

### Lado esquerdo e ferramentas (Tools.ts)
| Detalhe 2D | 3D |
|---|---|
| Botões laterais de pergaminho com ícone de linha escuro (bandeira, alerta, gráfico) | **mais pobre**: botões escuros (pílula) com ícone claro; perde o contraste de "objeto tocável" que o pergaminho dá |
| Selo vermelho com número no Avisos | **igual** |
| Avisos pulsa 4 vezes (1,18) quando chega aviso novo | **igual** (`hud-pulse`) |
| Ferramentas Mover, Rua, Demolir: discos de pergaminho com ícone (mão, estrada, martelo), etiqueta embaixo, no PC "Mover · 1" | **mais pobre**: discos **deformados em oval e encostados** (bug do `.tool span`), sem a tecla no rótulo, ícone de Demolir é uma borracha/raspador e não o martelo |
| Balão de dica da ferramenta ao trocá-la | **igual** em conteúdo (linha de dica), sem seta |

### Coluna de construção (BuildColumn.ts, uiArt.ts)
| Detalhe 2D | 3D |
|---|---|
| **Botões redondos com a miniatura da construção** (recorte da própria arte do mapa, contorno escuro suave, recorte em círculo) | **falta**: placas retangulares só com texto |
| No PC: miniatura em cima, nome e "preço · tecla N" dentro do disco | **mais pobre**: nome e preço em texto; a tecla aparece como "· 3", que se lê como quantidade |
| No celular: só a miniatura (46 px), 7 a 8 cabem na altura | **mais pobre**: placas de 132 px com o preço em duas linhas; só 6 cabem; a coluna ocupa 1/5 da tela |
| Bloqueado: miniatura em cinza claro, apagada, **selo de cadeado** no canto, borda tracejada | **mais pobre**: placa cinza com "objetivo N"; sem cadeado, sem miniatura |
| **Ponto dourado "novo"** quando uma construção é liberada e ainda não foi escolhida | **falta** |
| Categorias (casa, comida, trabalho, especial) com faixa lateral quando há muitos itens | **falta** (hoje a lista é sempre completa; não é pedido agora, só nota) |
| Fundo da coluna: cápsula escura arredondada no tamanho do conteúdo, centrada na altura | **mais pobre**: painel que vai do topo ao rodapé, com sobra vazia embaixo no PC |
| Balão da construção à esquerda do botão, **com seta** apontando para ele | **mais pobre**: mesmo texto, sem seta |

### Balões no mapa (Balloon.ts, Inspector.ts, textures.ts)
| Detalhe 2D | 3D |
|---|---|
| Balão escuro **num só traço com seta** (triângulo sem emenda) apontando para a construção | **falta** a seta: o cartão flutua ao lado sem ligação visual |
| Linhas com cores por parte, caixa escura "Ao evoluir" | **igual** |
| Linhas de pessoas (figura, nome, ofício) tocáveis, 44 px | **igual** |
| Coluna lateral do nível no celular | **igual** |
| Ações como **botões redondos**: a principal mostra a **miniatura** da construção (ou a estrada), Demolir com **martelo**, Fechar com ✕, cada um com etiqueta embaixo | **mais pobre**: cápsulas de texto ("Demolir" vermelho, ✕); sem miniatura nem ícone |
| Demolir: 1.º toque fica dourado com "Certeza?" em vermelho | **igual** em função (botão vermelho/borda dourada) |
| Balões de problema: círculo branco com sombra e bico, ícones pintados (estrada partida riscada, peixe riscado, trabalhador riscado, praça em perspectiva com banco e toldo, duas árvores, mercado listrado, rosto triste) | **mais pobre**: bico de pergaminho com SVG simplificado; o de praça e o de "sem fonte" (só um sinal de proibido) perdem a leitura; mas o tamanho e o cadeado estão bons |
| Etiqueta sobre a construção ao passar o mouse / prévia ("falta ligar à rua") | **igual** (`.tag`, vermelha quando ruim) |
| Números que sobem (dourado, vermelho) | **igual** (`.float`), mas sem animação própria no CSS (sobe por JS) |

### Painéis e ficha (Panels.ts, PersonSheet.ts)
| Detalhe 2D | 3D |
|---|---|
| Painel escuro com seções em colunas que fluem | **igual** (`.sections`) |
| Abas em cápsulas: aberta em dourado, as outras em **pergaminho** | **mais pobre**: as outras são escuras; menos claro que são botões |
| Gráficos de linha (prata, comida, moradores, alegria, capacidade tracejada) | **igual** (`charts.ts` com `NOVA.chart`) |
| Ficha da pessoa: figura grande, nome, família, parentes como botões | **igual**; as figuras são boas (forma diz sexo e idade) |
| Botão Fechar redondo com ✕ | **igual** |

### Toasts (Toasts.ts)
| Detalhe 2D | 3D |
|---|---|
| Cápsula escura com **sombra**, verde/vermelho para boa/má notícia, dourado para grandes | **igual** nas cores |
| **Entra esmaecendo (150 ms), sai esmaecendo (250 ms), as outras deslizam (150 ms)** | **mais pobre**: só entra; some de uma vez e as outras pulam |
| Largura limitada, quebra em várias linhas | **igual**, mas no celular três toasts grandes cobrem o centro do mapa (ver captura do HUD no celular) |

### Tutorial
| Detalhe 2D | 3D |
|---|---|
| Bolha de pergaminho com sombra, botões "Entendi"/"Pular" | **igual** (sem sombra) |
| Seta dourada que balança (Sine, 420 ms) | **igual** (`hud-bob` 0,84 s) |

### Título, vitória e derrota (TitleScene.ts, UIScene.ts)
| Detalhe 2D | 3D |
|---|---|
| Título sobre **uma cidade de verdade**: chão em losangos de areia e grama, templo, palmeiras, oliveiras, casas dos quatro níveis, praça, altar, mercado, campo, oficina | **falta**: fundo marrom em gradiente radial, vazio |
| Cartão de pergaminho com sombra deslocada e borda de tinta 3 px, título 46 px | **mais pobre**: o mesmo cartão sem sombra; no celular ocupa quase toda a tela |
| Lista numerada do como jogar, controles em cor apagada | **igual** |
| Botão "Começar" dourado com relevo, "Rever o tutorial" | **mais pobre** (capsulas lisas; o secundário é pergaminho, certo) |
| "Instalar app" no canto | **igual** |
| Vitória / derrota: escurece o jogo (sombra marrom 0,5), cartão de pergaminho com sombra, título, texto, 1 ou 2 botões | **igual** em estrutura; **mais pobre** no acabamento (sem sombra, fundo preto 0,45, nada que celebre a vitória) |

### Outros
| Detalhe 2D | 3D |
|---|---|
| Tom avermelhado na fome (0,22, 600 ms) | **igual** (`.famine`, `multiply`) |
| Convite do botão 3D pulsando dourado | não se aplica (o jogo já é 3D) |
| Textura de pergaminho, ornamentos, fonte decorativa | **o 2D também não tinha** (cor lisa). Proposta nova, ver item 4 |

## Melhorias propostas, em ordem de impacto

Só aparência e sensação; nenhuma mecânica nova. Estimativa inclui testar no celular e no PC e
olhar as capturas; não inclui revisão de código de outros agentes.

1. **Corrigir os discos das ferramentas** (bug). Em `src/ui/ui.css` a regra `.tool span` acerta o
   `span.disc`: trocar por `.tool > span:last-child` (ou uma classe `.name`) e dar `box-sizing:
   border-box` ao disco. Volta o círculo, afasta da borda, Mover/Rua/Demolir não se encostam.
   Aproveitar para pôr o martelo no Demolir (o ícone do 2D, `src/ui/icons.ts`). **0,5 h.**

2. **Miniaturas das construções na coluna** (o detalhe que mais faz falta). Renderizar uma vez cada
   modelo 3D (o mesmo do mapa) num alvo fora da tela com câmera ortográfica e luz de fim de tarde,
   guardar como imagem (data URL) e usar em disco redondo com contorno escuro suave, como o 2D. No
   celular a coluna vira só discos de 46 px (o nome e o preço já estão no balão da ferramenta); no
   PC disco com nome e preço. Bloqueado: miniatura em cinza + selo de cadeado + borda tracejada.
   Liberado e ainda não escolhido: ponto dourado "novo". Arquivos: novo `src/render3d/thumbs.ts`,
   `src/ui/tools.ts`, `src/ui/ui.css`, `src/game/model/build.ts` (flag `fresh`, pura, com teste).
   **8–10 h** (o render das miniaturas com o pacote Meshy é a maior parte; o sprite-artist pode
   ajustar o enquadramento de cada uma).

3. **Linguagem de relevo e acabamento calmo** em todos os botões e painéis (`src/ui/ui.css`):
   sombra deslocada sob os botões de pergaminho (`0 2px 0 rgba(0,0,0,.28)`) e afundar 2 px no
   `:active`, como o `button()` do 2D; selecionado com halo dourado claro + aro de 3 px; bloqueado
   com borda tracejada (`border-style: dashed`), para o estado não depender só da cor; textura muito
   leve de pergaminho (ruído SVG `feTurbulence` em data URI, gerado no CSS, sem arquivo de imagem) nos
   pergaminhos e um gradiente vertical sutil nos painéis escuros (topo um pouco mais claro); filete
   dourado fino (1 px, 0,25) por dentro da borda dos painéis e sob os títulos de seção. Botões
   laterais (Avisos, Estatísticas, girar) e abas não ativas em pergaminho, como no 2D. Passar
   `goldLight` e as cores de sombra para `src/game/palette.ts` como variáveis. **3–4 h.**

4. **Balões com seta** apontando para a construção (cartão do mapa) e para o botão (balão da
   ferramenta), num só contorno como o `balloon()` do 2D: pseudo-elemento `::before` girado com a
   mesma cor e borda, lado e posição vindos de `besideX` (já sabe se o balão está à direita ou à
   esquerda). Ações do balão como no 2D: botão principal com a miniatura da construção (item 2) ou
   o ícone da rua, Demolir com o martelo. Arquivos: `src/ui/cardBalloon.ts`, `src/ui/anchors.ts`
   (lado da seta, puro, com teste), `src/ui/tools.ts`, `src/ui/ui.css`. **3 h.**

5. **Ícones pintados com contorno de tinta**, no estilo do 2D (`textures.ts` `icons()` e
   `needIcon()`), redesenhados em SVG a 24 px com contorno `#3b2a1a` de 1,5 px e uma luz: moeda de
   prata com brilho, pão com cortes, duas toras com anéis, bloco de calcário, rostos do humor,
   estações; balões de problema com a praça (banco e toldo), peixe riscado no "sem fonte", estrada
   partida riscada. Na pílula, ícone um pouco maior (0,7 da altura). Arquivos: `src/ui/icons.ts`,
   `src/ui/labels.ts`. **3–4 h.**

6. **Tela de título com a cidade viva atrás**: abrir a cena 3D do mapa antes do título (o mesmo
   `seed`), câmera em órbita muito lenta, luz de entardecer, uma vinheta escura nas bordas; o cartão
   menor, à esquerda ou embaixo, com sombra, um filete dourado e o nome numa fonte de título com
   serifa só para `h1`/`h2` (pilha do sistema: `"Palatino Linotype", "Book Antiqua", Palatino,
   Georgia, serif`, em `src/game/palette.ts` como `TITLE_FONT`). Vitória e derrota com o mesmo
   cartão, fundo com desfoque leve da cidade (`backdrop-filter: blur(3px)` com fundo marrom 0,35 em vez
   de preto), um ornamento (ramos dourados na vitória, em SVG) e os números grandes em duas
   "medalhas". Arquivos: `src/ui/title.ts`, `src/app/start3d.ts`, `src/ui/modal.ts`, `src/ui/ui.css`,
   `src/ui/icons.ts`. **5–6 h** (a cena atrás do título é a parte grande; o architect deve opinar
   sobre iniciar a cena cedo).

7. **Movimento calmo**, como as tweens do 2D, e mais nada: toast sai esmaecendo (250 ms) e os outros
   deslizam (150 ms) (`src/ui/toasts.ts` mantém o elemento até o fim da transição); balões e painéis
   entram com fade + 4 px de subida (120 ms); a pílula de pedra brilha dourado 3 vezes quando
   aparece; o número de uma pílula que mudou faz um brilho dourado curto; a pílula de FOME pisca só
   no texto, mais devagar (1,6 s), como o 2D, para não cansar em sessão longa (o sinal continua
   enquanto a fome existir). Tudo sob `prefers-reduced-motion`. Arquivos: `src/ui/toasts.ts`,
   `src/ui/topbar.ts`, `src/ui/ui.css`. **3 h.**

8. **Celular deitado mais leve**: coluna de discos (item 2) libera ~90 px de mapa; no máximo dois
   toasts ao mesmo tempo no celular, com texto em `--text` e posição mais baixa, para não cobrir o
   centro da cidade (o limite é lógica pura: `src/game/toastQueue.ts`, com teste); balão do altar e de
   construções simples compacto, com o ✕ na linha do título em vez de uma linha só para ele;
   cartão do título em duas colunas (lista à esquerda, botões à direita) para caber sem rolar.
   Arquivos: `src/ui/ui.css`, `src/game/toastQueue.ts`, `src/ui/cardBalloon.ts`, `src/ui/title.ts`.
   **3–4 h.**

9. **Detalhes do PC**: grupo de velocidade com pausa, 1x e 3x à vista (o ativo dourado), como o 2D;
   rótulo da ferramenta com a tecla ("Mover · 1"); na coluna "tecla 3" em vez de "· 3"; cursor de
   mão desenhado (o `OPEN_HAND`/`GRAB_HAND` do `uiArt.ts`, como SVG em data URI). Arquivos:
   `src/ui/topbar.ts`, `src/ui/parts.ts`, `src/game/model/build.ts`, `src/game/strings.ts`,
   `src/app/play3d.ts`. **2–3 h.**

10. **Barra de cima numa linha no PC**: os mesmos passos de encurtar do 2D (tirar nomes dos
    materiais, depois todos os nomes, depois "/sem") até caber antes da estação, em vez de quebrar a
    fila; coluna de construção com altura do conteúdo e centrada, não do topo ao rodapé. Lógica de
    encaixe pura em `src/game/model/topbar.ts` (com teste), medida em `src/ui/topbar.ts`; `ui.css`.
    **2–3 h.**

Total: cerca de **33–41 h**. Pacote sugerido para começar (maior ganho por hora): 1, 3, 4, 7
(≈ 10 h), depois 2 e 5 (≈ 12 h), depois 6, 8, 9, 10.

## Observações para outros agentes
- `copywriter`: "tecla N" no PC e o rótulo "Mover · 1" precisam de texto em `strings.ts`.
- `sprite-artist`: enquadramento de cada miniatura (item 2) e ornamentos SVG da vitória (item 6).
- `architect`: iniciar a cena 3D por trás do título (item 6) e o custo de gerar as miniaturas no
  início (fazer uma vez, guardar em cache em memória; no celular lento, adiar até depois do título).

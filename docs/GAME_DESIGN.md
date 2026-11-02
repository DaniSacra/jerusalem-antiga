# Jerusalém Antiga — Design do jogo

Construtor de cidade simples, isométrico, para celular (tela deitada) e PC. O foco é a mecânica.
**Não há história, versículos nem mecânicas além das descritas aqui.** Toda mudança de regra deve
atualizar este documento, os JSON em `src/data/` e os testes em `tests/`.

Os números abaixo são os valores atuais; a fonte da verdade são os arquivos em `src/data/`.

## Mapa

- Grade lógica **32 x 32** células quadradas. O core trabalha com a grade quadrada; só o desenho
  é isométrico 2:1 (losangos).
- Terreno (`map.ts`, `rules.json > map`):
  - areia e grama seca, com manchas geradas por ruído (`grassShare` ≈ 45% de grama);
  - **rio** na borda leste, com 2 a 3 células de largura, serpenteando (não constrói);
  - **rochas** (45): não constrói e não pode ser removida;
  - **oliveiras** (45) e **palmeiras** (40): bloqueiam, mas podem ser cortadas com Limpar (5 prata).
- Ficam livres de rochas e árvores: um quadrado de raio 7 em volta do altar e a rua inicial.

## Início

- **Altar** fixo na célula (16,16), 1 célula, raio 5. Não está na barra de ferramentas e não pode
  ser demolido.
- **Rua inicial** de terra do altar até a borda sul. A célula onde ela toca a borda (16,31) é a
  **entrada da cidade**.
- Prata 200, Comida 30.
- Liberados: Ver, Rua, Casa, Campo, Poço e Limpar.

## Construções

| Construção | Custo | Tamanho | Vagas | Produção | Raio | Observações |
|---|---|---|---|---|---|---|
| Rua | 2 / célula | 1 | – | – | – | arrastar constrói em sequência |
| Casa | 10 | 1 | – | impostos | – | começa como terreno vazio |
| Campo | 15 | 1 | 2 | 3 comida/mês | – | |
| Poço | 20 | 1 | – | – | 3 | |
| Mercado | 40 | 1 | 2 | – | 4 | liberado pela Meta 1 |
| Oficina | 35 | 1 | 3 | 5 prata/mês | – | liberada pela Meta 2 |
| Templo | 400 | 3 x 3 | 2 | – | 9 | liberado pela Meta 5; não pode ser demolido |
| Altar | – | 1 | – | – | 5 | fixo no início |

- O raio é **quadrado**: cobre toda célula a até N colunas e N linhas de distância. Em construções
  maiores, mede a partir de qualquer célula da construção.
- Limpar remove construções e ruas sem reembolso (exceto altar e templo) e corta árvores por 5 prata.

## Ruas e conexão

- A **rede conectada** são as ruas ligadas ao altar por vizinhança ortogonal (busca em largura a
  partir do altar). É recalculada a cada construção ou demolição e no início de cada mês.
- Uma construção está **conectada** se alguma célula vizinha (ortogonal) da sua área faz parte da
  rede. Encostar no próprio altar também conta.
- Sem conexão:
  - casas não recebem família e regridem como se faltasse uma exigência (tenda sem rua vira
    terreno vazio após 3 meses);
  - campos, oficinas, mercados e templo não produzem nem contam vagas;
  - poços, mercados e templo não dão cobertura;
  - aparece um balão "sem rua".
- Construir longe da rua é permitido (o jogador aprende pelo balão). **Exceção:** o Templo só pode
  ser colocado encostado numa rua conectada.
- Casas desconectadas continuam contando moradores e impostos até regredirem.

## Casas

| Nível | Nome | Moradores | Imposto/mês | Exige |
|---|---|---|---|---|
| 0 | Terreno | 0 | 0 | – |
| 1 | Tenda | 3 | 1 | rua |
| 2 | Casa de barro | 6 | 2 | rua, poço |
| 3 | Casa de pedra | 10 | 3,5 | rua, poço, mercado |
| 4 | Casa grande | 16 | 6 | rua, poço, mercado, raio do altar **ou** do templo |

## Famílias

- Um terreno vazio conectado, sem fome e sem família a caminho tem **35%** de chance por mês de
  receber uma família.
- A família sai da **entrada da cidade** e anda pelas ruas (caminho por busca em largura) até a
  casa, **3 células por mês**. Ao chegar, o terreno vira tenda.
- Se a rua do caminho for cortada, a família recalcula a rota; se não houver rota, ou a casa for
  demolida ou desconectada, a família desiste.
- Se a entrada for desligada da rede, as famílias passam a sair do altar (para a cidade nunca
  travar sem explicação).

## Simulação (1 mês = 1,2 s em 1x)

A cada mês, nesta ordem (`simulation.ts`):

1. Recalcular rede de ruas, conexões e cobertura (poço, mercado, altar/templo).
2. Moradores = soma das casas. Trabalhadores = 50% dos moradores (para baixo).
   Vagas = soma das construções conectadas. Eficiência = trabalhadores / vagas, no máximo 100%
   (100% se não houver vagas).
3. Comida += campos × 3 × eficiência − moradores × 0,2. Se a comida chega a 0 com saldo negativo:
   **fome**. A comida nunca fica negativa.
4. Prata += impostos + oficinas × 5 × eficiência.
5. Famílias andam; as que chegam transformam o terreno em tenda.
6. Para cada casa de nível 1 ou mais:
   - se falta uma exigência do nível atual: após 3 meses seguidos, cai um nível;
   - com fome: não evolui; casas acima de tenda têm 12% de chance de cair um nível;
   - se tem as exigências do próximo nível: após 3 meses seguidos, sobe de nível.
7. Novas famílias são enviadas para terrenos elegíveis.
8. Verificar a meta atual.

Velocidades: 1x, 3x e Pausa. O jogo pausa enquanto a tela de vitória está aberta.

## Metas (em sequência)

1. Chegue a 15 moradores: +30 prata, libera Mercado.
2. Tenha 3 casas de barro ou melhores: +40 prata, libera Oficina.
3. Chegue a 50 moradores: +50 prata.
4. Tenha 3 casas de pedra ou melhores: +60 prata.
5. Tenha 2 casas grandes: +100 prata, libera Templo.
6. Construa o Templo: tela de vitória com meses e moradores, e botão "Continuar construindo".

Ferramentas bloqueadas aparecem apagadas com o texto "Meta N".

## Interface

- **Barra superior:** Prata e Comida com variação por mês (+X/mês; vermelho se negativa),
  Moradores, Trabalho (trabalhadores/vagas e %; vermelho abaixo de 100%), Mês, Meta atual com
  progresso e botão de velocidade (1x → 3x → Pausa).
- **Barra de ferramentas:** Ver, Rua, Casa, Campo, Poço, Mercado, Oficina, Templo, Limpar, cada
  uma com ícone desenhado, nome e custo (vermelho se faltar prata).
- **Linha de informação:** mostra a dica da ferramenta. Com Ver, mostra o que foi tocado:
  - casas: nível, moradores, imposto e as exigências do próximo nível em verde/vermelho
    (incluindo "sem rua"); terreno vazio diz se há família a caminho;
  - outras construções: estado de conexão, vagas, produção, raio;
  - ruas (ligada ao altar ou não, entrada da cidade) e terreno.
- **Balões** sobre construções com o primeiro problema, nesta ordem: sem rua; depois, para casas
  de nível 1 a 3, a primeira exigência que falta (gota azul = poço, listras vermelhas = mercado,
  chama = altar/templo). Só aparece se a construção que falta já estiver liberada.
- **Com ferramenta de construção:** linhas da grade, prévia translúcida (vermelha se inválida ou
  sem prata), quadrado do raio e área já coberta pelo mesmo serviço. Com Casa, destaque dourado da
  área do altar e do templo (onde casas grandes são possíveis). O Templo mostra as 3 x 3 células.
- **Toasts:** prata insuficiente, local inválido, templo sem rua, altar/templo protegidos, meta
  cumprida e "Falta comida: construa campos" (uma vez por episódio de fome).
- Durante a fome, leve tom avermelhado sobre o mapa.
- Tela inicial curta explicando ruas, altar, famílias, templo e controles, com botão "Começar".

## Câmera e controles (estilo Pocket City)

| | Celular | PC |
|---|---|---|
| Ver | arrastar move a câmera; tocar seleciona | idem com o mouse |
| Ferramentas de construção | arrastar constrói; dois dedos movem | arrastar constrói; botão direito move |
| Zoom | pinça | roda do mouse |

- Zoom entre 0,5x e 2x. A câmera começa centralizada no altar.
- Rua, Casa, Campo e Limpar constroem arrastando; o arraste preenche as células em passos
  ortogonais, então a rua fica sempre conectada.
- Poço, Mercado, Oficina e Templo são colocados **ao soltar o dedo**: dá para arrastar para
  ajustar a prévia, e o segundo dedo de uma pinça nunca constrói por engano.
- Atalhos no PC: 1–9 escolhem a ferramenta, Espaço troca a velocidade, Esc volta para Ver.

## Vida na cidade

- Moradores andando **só pelas ruas**, com rota por busca em largura até uma construção conectada
  aleatória. Quantidade = moradores / 5, no máximo 60. Roupas variadas, balanço ao andar. Param
  quando o jogo está pausado e andam mais rápido em 3x.
- Famílias (grupo de três com uma trouxa) andando da entrada até a casa.
- Trigo balançando, fumaça na chaminé da oficina, fogo tremulando no altar, água correndo no rio.
- Ao subir de nível: pulinho, "+N" e anel de brilho. Ao cair de nível ou por fome: texto vermelho.
- Ao construir: anel de brilho. Ao limpar: nuvem de poeira. Templo: anéis dourados, faíscas e
  clarão.

## Arte

- Tudo desenhado por código, sem pacotes de assets (`src/render/textures.ts`).
- Isométrico 2:1, paleta quente: areia, ocre, tijolo de barro, pedra calcária clara, com verde de
  palmeiras e azul do rio como contraste.
- Construções como pequenas maquetes: paredes em dois tons (face sul iluminada, face leste na
  sombra), telhados planos usados como área de convivência, muros grossos, jarros, toldos e plantas.
- Cada nível de casa se distingue mesmo no zoom mínimo: tenda de pano escuro de pelo de cabra;
  casa de barro pequena; casa de pedra embaixo e barro em cima, com janela emoldurada, escadinha
  externa e varal no telhado; casa grande de calcário claro de "quatro cômodos", com andar de cima
  nos fundos, alas laterais e pátio interno com forno e figueira.
- Chão com variação suave (manchas, ondulações na areia, seixos, tufos de capim), sem padrão de
  xadrez. Ruas de terra batida largas, com sulcos de carroça e pedras gastas nas bordas.
- Luz de fim de tarde vinda do oeste; sombras suaves sempre para o leste.
- Desenho ordenado por profundidade (x + y do centro da área), incluindo moradores e o templo 3 x 3.
- A camada de desenho é isolada: texturas com nome e pontos de ancoragem (`ORIGIN`, `HEIGHT`),
  para trocar por sprites no futuro.

## Fora do escopo por enquanto

- **Deploy:** o workflow do GitHub Pages existe (`.github/workflows/deploy.yml`), mas o `base` do
  Vite continua `'./'`. A mudança para `/jerusalem-antiga/` foi adiada a pedido.
- **Tela cheia em celulares compridos:** o jogo mantém 1280 x 720 (16:9), então sobram faixas nas
  laterais. Ocupar a tela inteira exigiria refazer o layout da interface.

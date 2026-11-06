# Plano "Beleza e calma" (game-director, 2026-11-06)

Pedido do usuário: deixar o 3D bonito (o jogo é contemplativo; o 2D tinha mais detalhe), música calma
para horas de jogo e, com os relatórios prontos, fazer o que o diretor vê como prioridade: erros, bugs
e ganhos rápidos. O usuário não aprova passo a passo; as decisões abaixo valem.

Fontes: `arte-2d-vs-3d.md` (sprite-artist), `ui-2d-vs-3d.md` (ui-designer; o bug dos discos já saiu em
a0f7753), `sim-tester-fim-sem-frio.md` (Templo madeira 300 → 200 já em a0f7753) e
`docs/arquitetura-3d.md` seção 12 (música, architect).

Nenhum item deste plano é mecânica nova: é aparência, interface e som. Nenhum número de `src/data` de
economia muda. Lógica pura nova (o que acende, o que fuma, quantos toasts, mapa de desgaste, quem fica
parado onde, partitura) vai para módulos puros com Vitest, como manda o `CLAUDE.md`.

## Regras que valem para todos os itens
- Medir com `scripts/view3d-perf.mjs` antes e depois de cada pacote: ≥ 30 qps no celular simulado com
  150 construções, ≤ 120 chamadas, ≤ 300 mil triângulos. Falhou, o item fica atrás de qualidade
  (desliga na mínima) ou não entra.
- Nada animado por CPU por objeto e por quadro: vento e ondas no shader de vértice; o que é por objeto
  é montado só quando a cidade muda.
- Movimento calmo: nada pisca rápido, tudo sob `prefers-reduced-motion` na interface.
- Cada item fecha com capturas de perto e de longe, de dia e de noite, celular 844 x 390 e PC 1366 x 768
  (cenários existentes `town3d-*` / `ui3d-*`; cenário novo de noite onde ainda não houver).
- Definição de pronto do projeto: `npm test`, `npx tsc --noEmit`, `npm run test:visual` e as capturas
  olhadas.

## 1. Decisão: A2 do Comum (conflito do "Fim sem frio")

**A2 do Comum passa a 50–90% de vitória em 1000 semanas**, com derrotas do Comum ≤ 5% e Distraído
≤ 20% de vitória (iguais). Motivo: o Comum não perde nenhuma partida; quem não vence está travado, e o
alvo "≤ 10% sem vitória" que o usuário aceitou com o ajuste é o contrário do teto de 80%. Os dois
alvos não cabem juntos, e travar com 160 moradores morrendo de frio fere os pilares 1 e 3. O teto de
90% fica para pegar um Templo fácil demais; a dificuldade vem das crises (frio, fome, seca), não do
fim. Medido com madeira 200: 89% (100 seeds), 91% (200 seeds), dentro do novo alvo pela margem do
ruído (±3 pontos). Se a próxima rodada passar de 92%, a alavanca é a madeira 200 → 250 (16% sem
vitória, já medido). Alavanca 2 ("lenha antes do Templo"): FORA (0 ponto no sim).

## 2a. Erros e bugs (primeiro, nesta ordem)

| # | Bug | Dono | Arquivos | Horas | Aceite |
|---|---|---|---|---|---|
| E1 | Fumaça ignora `s.cold`: casa sem lenha continua fumegando (regressão da regra do P4 "casas sem fumaça no frio") | sprite-artist | `src/render3d/plan.ts` (puro, com teste), `life.ts` | 1 | Com `cold` ligado no dev hook, nenhuma chaminé fuma; teste em `tests/render3d` cobre `cold` |
| E2 | Casas Meshy nunca acendem janela à noite (o `patch(material)` dos .glb vai sem `windows`) | sprite-artist | `src/render3d/models.ts`, `shaders.ts` (posições fixas por modelo, `WINDOWS_AT`, como `CLOSED_AT`) | 3–5 | Captura de noite: casas de pedra e grandes com 1–2 janelas quentes; casa vazia apagada; chamadas não sobem mais que +2 |
| E3 | Rua desligada do altar é igual à ligada (o 2D apagava e tracejava; é leitura da regra "rua ligada") | sprite-artist | `src/render3d/plan.ts`, `world.ts` | 1,5–2 | Cenário com rua solta: a rua solta lê apagada e tracejada no zoom mínimo, celular e PC |
| E4 | Celular: até 3 toasts grandes cobrem o centro do mapa e o balão da ferramenta (nota antiga do P3) | ui-designer | `src/game/toastQueue.ts` (limite puro, com teste), `src/ui/toasts.ts`, `src/ui/ui.css` | 1,5 | 844 x 390: no máximo 2 toasts, abaixo do centro, sem cobrir o balão da ferramenta |
| E5 | PC 1366: a barra de cima quebra em duas linhas (Pedra e Moradores descem) | ui-designer | `src/game/model/topbar.ts` (encaixe puro, com teste), `src/ui/topbar.ts`, `ui.css` | 2–3 | `ui3d-pc-*`: barra numa linha só, encurtando nomes como o 2D; coluna de construção com a altura do conteúdo |
| E6 | Coluna no PC: "· 3" lê como quantidade; Demolir sem o martelo (se não saiu em a0f7753) | ui-designer + copywriter | `src/game/strings.ts`, `src/game/model/build.ts`, `src/ui/icons.ts` | 0,5 | PC mostra "tecla 3"; Demolir com martelo nos dois tamanhos |

Total ≈ 10–13 h.

## 2b. Ganhos rápidos (≤ 2 h cada, muito efeito em beleza ou calma)

Em ordem. Cada um é uma fatia pequena de um item maior dos relatórios; o resto do item fica no pacote
de (c).

| # | Ganho | Dono | Arquivos | Horas | Aceite |
|---|---|---|---|---|---|
| Q1 | Vento nas árvores e nos campos: balanço no shader de vértice pelo `y`, força pelo vento do clima (palmeira mais, oliveira pouco, rocha nada) | sprite-artist | `src/render3d/shaders.ts`, `look3d.json` | 2 | Vídeo curto ou 2 capturas: palmeiras e trigo se mexem com vento, param na calmaria; qps igual |
| Q2 | Fumaça macia: sprites com textura radial (billboard) no lugar dos icosaedros | sprite-artist | `src/render3d/life.ts`, `stage.ts` | 1,5–2 | De perto a fumaça lê como fumaça, não "pedrinhas"; mesmas chamadas |
| Q3 | Fogo vivo: chama do altar em camadas com brasas, faíscas nas fogueiras das tendas | sprite-artist | `src/render3d/life.ts`, `shaders.ts` | 2 | `town3d-pc-altar` de noite: o fogo não é mais um cone chapado; ≤ +1 chamada |
| Q4 | Vinheta suave nas bordas (camada CSS sobre o canvas, sem passe de GPU) | ui-designer | `src/ui/ui.css`, `src/game/palette.ts` | 0,5 | Bordas escurecem de leve; balões e barra não escurecem; qps igual |
| Q5 | Grão do chão: ruído fino e manchas de 2–3 células no shader do terreno (só fragmento), desliga na qualidade mínima | sprite-artist | `src/render3d/terrain.ts`, `shaders.ts` | 2 | `town3d-pc-river` de perto: chão com grão e manchas, não degradê; ≥ 30 qps no celular simulado |
| Q6 | Margem do rio: faixa de areia clara úmida pela fração de rio de `aGround` | sprite-artist | `src/render3d/terrain.ts`, `shaders.ts` | 1,5 | O rio tem margem clara contínua; na seca a margem vira lama como hoje |
| Q7 | Interface calma: toast sai esmaecendo (250 ms) e os outros deslizam (150 ms); pílula de FOME pisca só no texto, a 1,6 s | ui-designer | `src/ui/toasts.ts`, `src/ui/topbar.ts`, `ui.css` | 1,5 | Toast não some de uma vez; FOME continua visível sem a pílula inteira piscar; `prefers-reduced-motion` respeitado |
| Q8 | Relevo dos botões: sombra deslocada nos pergaminhos, afundar 2 px no toque, selecionado com halo + aro dourado, bloqueado com borda tracejada | ui-designer | `src/ui/ui.css`, `src/game/palette.ts` | 2 | Capturas `ui3d-*`: botões com volume; bloqueado se lê sem depender da cor |

Total ≈ 13–14 h. Com E1–E2 e Q1–Q3, a Entrega 1 "Noite e vento" do sprite-artist fica quase toda feita;
o que sobra dela (varais e toldos ao vento, poeira da pedreira) vai para C2 e C8.

## 2c. Pacotes maiores, em ordem

Um pacote por vez por dono. A Música é de outro dono e de outros arquivos: pode correr ao lado de C2.

| Ordem | Pacote | Dono | Itens dos relatórios | Horas | Aceite |
|---|---|---|---|---|---|
| C1 | **Música** (pacote próprio) | architect (+ copywriter nos textos) | `docs/arquitetura-3d.md` 12, opção (a) Web Audio gerado; `src/game/music/score.ts`, `mix.ts`, `src/app/music.ts`, `src/game/settings.ts`, `src/ui/settings.ts`, tecla M | 12,5–18 | Testes 12.3 passam; qps igual com e sem música; o usuário ouviu as gravações do passo 5 e aprovou |
| C2 | Cidade bonita: **Vida na rua** | sprite-artist | arte 9 (figuras paradas que crescem com o nível da casa, compradores no mercado, colhedores de oliva e figo no outono, recém-casados de mãos dadas, família saindo a pé ao abandonar a tenda) + resto de arte 5 (varais e toldos ao vento) | 12–14 | Rua de casas de pedra com vizinhos parados; plano puro testado; somem no zoom mínimo; ≤ 120 chamadas |
| C3 | Cidade bonita: **Casas variadas** | sprite-artist | arte 2 (kit por código por `variant`, 6 por nível, espelho assado, telhados com vida) | 12–16 | Rua de 10 casas de barro sem duas vizinhas iguais; ≤ 300 mil triângulos com 150 construções |
| C4 | Cidade bonita: **Chão e ruas** | sprite-artist (map-designer revisa o desgaste) | arte 3b–c (tufos, seixos, flores assados por pedaço; mapa de desgaste) + arte 4 (borda pisada, meio-fio, sulcos, lajes no nível 3) | 14–18 | De perto: terra batida na porta, trilhas entre casas, rua com meio-fio que lê no zoom mínimo |
| C5 | **Interface bonita 1** | ui-designer (sprite-artist enquadra as miniaturas) | ui 2 (miniaturas 3D na coluna, disco de 46 px no celular, cadeado, ponto "novo"), ui 4 (balões com seta, ações com miniatura e martelo), ui 5 (ícones pintados), resto de ui 3 (textura leve de pergaminho, filete dourado) | 16–20 | Coluna do celular com 7–8 discos de miniatura; todo balão aponta para a construção ou o botão |
| C6 | Cidade bonita: **Campo e árvores** | sprite-artist | arte 6 (tufos por cultura, socalco, altura por campo, campo ralo longe do rio na seca), arte 7 (árvores ricas, amendoeira e figueira), resto de arte 13 (juncos, pedras, brilho na água) | 15–20 | Quatro culturas se distinguem de perto; amendoeira floresce na primavera; polycount dentro do teto |
| C7 | **Interface bonita 2 + título** | ui-designer (architect opina sobre abrir a cena antes do título) | ui 6 (título com a cidade viva atrás, vitória/derrota com desfoque e ornamento), resto de ui 7 (entrada de balões, brilho das pílulas), resto de ui 8 (balão compacto, título em 2 colunas no celular), ui 9 (velocidade em 3 botões no PC, "Mover · 1", cursor de mão) | 10–13 | Título sobre a cidade em órbita lenta, sem rolar no celular; primeira carga não fica mais lenta que hoje + 1 s |
| C8 | Cidade bonita: **Maquete e prédios nobres** | sprite-artist | arte 8 (tilt-shift + gradação; sombra de contato), arte 11 (Templo por código), arte 12 (oficinas por ofício, mercado vivo), arte 14 (terreno vazio com obra), poeira da pedreira | 22–30 | Templo é a construção mais bonita da cidade (sem frontão grego); tilt-shift desliga na qualidade mínima |

Por que esta ordem: a Música vem primeiro porque é pedido explícito do usuário desde 04/11, é o maior
ganho de calma por hora e não disputa arquivos com a arte. Depois, cidade viva antes de tudo (pilar 8,
prioridade do usuário): gente parada e panos ao vento. Em seguida o maior buraco visual (casas
repetidas), depois chão e ruas, e só então a interface (que já ficou mais calma com Q4, Q7 e Q8). O
acabamento de maquete fica por último porque é o único passe de tela cheia (custo no celular).

Jogo: o Pacote C "Gado" e a "Derrota da cidade vazia" esperam até o fim de C3. Daí em diante, alterna
um pacote de beleza e um de jogo.

Total de (c): ≈ 114–149 h (Música 12,5–18; arte ≈ 75–98; interface ≈ 26–33).

## 3. FORA

- Voltar os lados do diorama do 2D: a saia com árvores na neblina é melhor no 3D.
- Música em arquivos prontos (opção b): pesa no PWA, repete em horas e não é nossa.
- Efeitos sonoros, música de vitória ou derrota, trilha por evento: fora do pedido de música calma.
- Faixa lateral de categorias na coluna: não há construções que peçam isso agora.
- Fonte decorativa no texto corrido: só o título (`h1`/`h2`) ganha serifa, em C7.
- Tremor de calor como passe de imagem: o tremor por vértice que já existe basta.
- Alavanca 2 do Fim sem frio ("lenha antes do Templo") como regra: 0 ponto no sim. A frase de
  clareza no painel do Templo fica DEPOIS, se o playtest mostrar dúvida.
- Templo com 150 de madeira: 200 basta.

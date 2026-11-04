# Relatório: passagem do tempo na prova 3D

## Como abrir

```bash
cd ../jerusalem-antiga-3d   # worktree, branch spike/threejs
npm run poc                 # Vite com --host na porta 5174
```

- PC: `http://localhost:5174/poc.html`
- Celular (mesma rede Wi‑Fi): `http://<ip-do-pc>:5174/poc.html`. O PC roda o WSL em modo NAT
  (ip interno 172.31.x), então o Windows precisa repassar a porta uma vez (PowerShell como admin):
  `netsh interface portproxy add v4tov4 listenport=5174 connectport=5174 connectaddress=<ip do WSL>`
  e liberar a porta 5174 no firewall.
- Opções: `?b=150` cidade de teste com 150 construções, `?weeks=60` cidade pequena (~40),
  `?quality=high|low` (o padrão é automático), `?bot=off` (o bot para de construir).

## Quadros por segundo (celular simulado)

Playwright 844 × 390, deviceScaleFactor 2,6, toque, CPU 4x mais lenta. A GPU usada foi a **Intel UHD
integrada** do notebook (D3D12 pelo WSL), que fica perto de uma GPU de celular intermediário. O
headless trava em 60 qps, então 60 quer dizer "60 ou mais". `node scripts/poc-perf.mjs`

| Cidade | Dia | Noite | Chuva | Rodando a 4x |
|---|---|---|---|---|
| 40 construções, qualidade automática | 60 | 60 | 60 | 51 |
| 150 construções, qualidade automática | 60 | 60 | 60 | 49 |
| 150 construções, qualidade alta forçada | 60 | 60 | 59 | 49 |
| 2D atual (Phaser), as mesmas 150 construções | 19 | | | |

Em todos os casos a qualidade automática ficou na alta (resolução 2x, sombras suaves de 2048).
A cena tem 110 chamadas de desenho e 160 mil triângulos.

Teste pessimista, com renderização só pela CPU (SwiftShader, `--soft`): o 3D faz 4–7 qps e cai
sozinho para a qualidade mínima; o 2D faz 5,6 qps. Os dois ficam na mesma ordem, como na prova
anterior. O número que vale mesmo é o do celular real: falta medir num aparelho.

**Qualidade automática:** se ficar abaixo de 30 qps por duas janelas seguidas de 2,5 s, a qualidade
desce um nível. No nível baixo a resolução vai a 1,25x, as sombras para 1024 e atualizadas a cada 2
quadros, e as partículas caem para 45%. No nível mínimo: resolução 0,9x, sombras de 512 e 25% das
partículas.

## Tamanho do download (gzip)

`node scripts/poc-size.mjs`

| | gzip | sem compressão |
|---|---|---|
| 3D, primeira carga (Three.js + core + prova) | **185 KB** | 662 KB |
| 3D + abrir a visão 2D (o Phaser só baixa no botão) | 586 KB | |
| Jogo 2D atual (código) | 411 KB | 1451 KB |

## O que ficou bom

- **Dia e noite numa semana.** O sol nasce no leste e se põe no oeste. As sombras giram e crescem
  no fim do dia. À noite as janelas acendem (uma parte das casas, e menos depois de meia-noite),
  com braseiros nas ruas principais, fogueiras nas tendas e fornos. A luz da lua é azulada e o céu
  tem estrelas.
- **Estações sem troca brusca.** A mistura se espalha por ±3 semanas em volta de cada troca. Outono
  tem luz dourada e baixa e folhas caindo. No inverno a luz é fria e azulada, o céu fica cinza e a
  fumaça sai de todas as casas. A neve rara cobre telhados e chão em manchas por alguns dias. A
  primavera tem verde forte e flores. O verão tem luz branca e alta, capim amarelado, poeira e o
  horizonte tremendo de calor.
- **Campos ao longo do ano**, seguindo o calendário do 2D: arados no começo do outono, brotando e
  crescendo no inverno, dourados na primavera, palha no verão. Na colheita e na aradura há mais
  gente nos campos.
- **Clima pela semente.** A chuva tem gotas, respingos, céu escuro e chão escurecendo. As poças só
  aparecem quando o chão encharca, e o chão seca aos poucos. Na seca o rio baixa e mostra o leito,
  a terra racha e os campos secam. Dias de vento trazem poeira.
- **Menos gente na rua à noite e na chuva**, e mais nos campos na colheita.
- **A simulação roda de verdade** (pausa, 1x, 2x, 4x). O bot continua construindo e o 3D redesenha
  a cidade quando ela muda.
- **Botão 2D ↔ 3D com o mesmo `GameState`.** É uma página só: a visão escondida dorme. Dá para
  construir no 2D e voltar ao 3D com a cidade nova.
- **Demonstração:** um ano em 60 s, com o nome da estação na tela e a câmera girando devagar. Só no
  visual, ela força um inverno com neve e um verão de seca para mostrar tudo de uma vez.

## O que ainda parece artificial

- **Um dia por semana fica rápido demais.** A 1x um dia dura 3,2 s; a 4x e na demonstração, menos
  de 1 s. Para não piscar, a variação do dia diminui nas velocidades altas: as noites ficam mais
  claras e o sol mexe menos. Talvez valha um dia mais longo (2D: 240 s), ou que só a 1x mostre o
  ciclo inteiro.
- **Formas quadradas.** Gente feita de cilindro com cabeça, árvores de bolhas, telhados planos.
- **Detalhes do chão em pontos** (flores, rachaduras): de longe quase não aparecem, e o chão da
  cidade é quase todo rua.
- **Tremor de calor só no horizonte** (céu e relevo distante), sem distorção de tela de verdade.
- **Nuvens só pintadas no céu** e como sombra andando no chão, sem volume.
- **A neve cobre por igual** tudo que fica virado para cima.
- **A água** é um plano com ondinhas, sem margem molhada nem reflexo.
- **As luzes da noite são falsas** (brilho e manchas no chão, sem luz real), escolha feita para
  caber no celular.

## O que precisaria de modelos comprados

- **Casas**, com variantes por nível, telhados com beiral, janelas recortadas e portas. É o ganho
  maior.
- **Moradores animados** (andar, colher, carregar) e animais.
- **Árvores** (oliveira, palmeira, amendoeira) com versões por estação: folhagem, flor e galho nu.
- **Templo, altar, mercado e celeiro com acabamento**, e texturas de pedra, barro, madeira e tecido.
- **Terreno com texturas** (areia, capim, terra arada, lama rachada) em vez de cor lisa.

Os modelos entram por chave, sem mexer no código (veja `README.md`). Os materiais que vierem dos
.glb já recebem neve, chão molhado e sombra de nuvem.

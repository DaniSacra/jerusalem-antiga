# Jerusalém Antiga

Construtor de cidade em 3D para celular (tela deitada) e PC.
Three.js + TypeScript + Vite, interface em HTML/CSS, testes com Vitest e Playwright. Os modelos são
feitos por código e alguns no Meshy (`public/models/meshy`).

Documentação completa:
- [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) — regras, números, interface, controles e arte
- [docs/TESTING.md](docs/TESTING.md) — testes unitários, testes visuais e como escrever novos
- [CLAUDE.md](CLAUDE.md) — regras de arquitetura para as próximas sessões

## Rodar localmente

Requer Node 20+.

```bash
npm install
npm run dev        # abre em http://localhost:5173 (e no IP da rede, para testar no celular)
npm test           # testes unitários da simulação
npm run test:visual  # testes no navegador com screenshots em screenshots/
npm run build      # gera o site estático em dist/
npm run preview    # serve o dist/ para conferir o build
npm run test:pwa   # confere que o build é instalável e abre sem internet
```

Para testar no celular: rode `npm run dev`, conecte o celular na mesma rede Wi-Fi
e abra o endereço "Network" que o Vite mostra no terminal.

## Instalar no celular

O jogo é um app instalável (PWA). Depois de publicado (veja *Publicar*), abra o endereço no
celular:

- **Android (Chrome):** toque em **Instalar app** na tela inicial do jogo, ou no menu ⋮ →
  *Instalar app* / *Adicionar à tela inicial*.
- **iPhone/iPad (Safari):** toque em *Compartilhar* → *Adicionar à Tela de Início*.

Instalado, o jogo abre em tela cheia, deitado, e funciona sem internet. A instalação exige HTTPS
(o GitHub Pages já usa); pelo endereço "Network" do `npm run dev` não aparece.

## Controles

| Ação | Celular | PC |
|---|---|---|
| Mover o mapa | arrastar com "Mover", ou dois dedos com qualquer ferramenta | arrastar com "Mover", botão direito ou WASD/setas |
| Zoom | pinça | roda do mouse |
| Girar | dois dedos girando, ou ↺ ↻ | Q e E, ou ↺ ↻ |
| Construir | Rua: arrastar; o resto: tocar e soltar | clicar / arrastar |

Atalhos no PC: 1 Mover, 2 Rua, 3–6 categorias, 0 Demolir, R gira a construção, Espaço troca a
velocidade, Esc fecha o balão ou painel. Detalhes em `docs/GAME_DESIGN.md`.

## Como funciona

- A cidade começa no altar, no centro do mapa, com uma rua de terra até a borda sul (a entrada).
- Toda construção precisa encostar numa rua ligada ao altar. Sem isso, um balão "sem rua" aparece.
- Famílias chegam pela entrada e caminham pelas ruas até os terrenos vazios.
- Casas evoluem com rua, poço, mercado e o raio do altar ou do templo.
- Construir o Templo (3x3) é a meta final.

## Publicar

O build é um site estático (`dist/`) com caminhos relativos, então funciona em qualquer hospedagem.

- **GitHub Pages:** envie o repositório para o GitHub na branch `main` e, em
  *Settings → Pages*, escolha *Source: GitHub Actions*. O workflow
  `.github/workflows/deploy.yml` roda os testes, faz o build e publica a cada push.
- **Netlify / Vercel / Cloudflare Pages:** comando de build `npm run build`, pasta `dist`.

## Estrutura

```
src/
  core/     simulação em TypeScript puro: mapa, ruas, cobertura, economia, casas, famílias,
            pessoas, metas, ações e relógio
  data/     JSON com custos, vagas, raios, níveis das casas, metas e regras
  game/     sessão, gestos, teclas, modelos de tela, textos (strings.ts) e cores (palette.ts)
  render3d/ o mundo em Three.js: terreno, modelos, pessoas, luz, estações, clima, efeitos, câmera
  ui/       a interface em HTML/CSS sobre o 3D
  app/      a página: início, jogo 3D, instalação
tests/      testes unitários (core, game, render3d e ui puros)
scripts/visual/  testes visuais com Playwright
docs/       design do jogo e guia de testes
```

Para ajustar o balanço do jogo, edite os arquivos em `src/data/`.

### Trocar modelos

Os modelos por código estão em `src/render3d/models.ts`; o pacote do Meshy em
`public/models/meshy/manifest.json` substitui os que tiverem um `.glb` (veja `src/render3d/README.md`).

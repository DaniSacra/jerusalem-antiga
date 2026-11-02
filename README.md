# Jerusalém Antiga

Construtor de cidade isométrico para celular (tela deitada) e PC.
Phaser 3 + TypeScript + Vite, testes com Vitest. Toda a arte é desenhada por código.

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
```

Para testar no celular: rode `npm run dev`, conecte o celular na mesma rede Wi-Fi
e abra o endereço "Network" que o Vite mostra no terminal.

## Controles

| Ação | Celular | PC |
|---|---|---|
| Mover o mapa | arrastar com "Ver", ou dois dedos com qualquer ferramenta | arrastar com "Ver", ou botão direito |
| Zoom | pinça | roda do mouse |
| Construir | tocar; Rua, Casa, Campo e Limpar podem ser arrastados | clicar / arrastar |

Atalhos no PC: teclas 1–9 escolhem a ferramenta, Espaço alterna a velocidade, Esc volta para "Ver".

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
  core/     simulação em TypeScript puro (sem Phaser): mapa, ruas, cobertura, economia,
            casas, famílias, metas, ações e relógio
  data/     JSON com custos, vagas, raios, níveis das casas, metas e regras
  render/   desenho isométrico, animação, câmera e interface
  scenes/   telas do Phaser (início, jogo e interface) e entrada
tests/      testes unitários do core
scripts/visual/  testes visuais com Playwright
docs/       design do jogo e guia de testes
```

Para ajustar o balanço do jogo, edite os arquivos em `src/data/`.

### Trocar a arte por sprites

Todas as imagens são texturas com nome, geradas em `src/render/textures.ts` (veja `TEX`).
Para usar sprites, carregue imagens com as mesmas chaves e mantenha os pontos de ancoragem
em `ORIGIN` (ponto do chão no centro da construção) e `HEIGHT` (altura para os balões).

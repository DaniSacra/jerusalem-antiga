# Jerusalém Antiga

Construtor de cidade simples, top-down em grade, para celular (tela deitada) e PC.
Phaser 3 + TypeScript + Vite, testes com Vitest. Toda a arte é desenhada por código.

## Rodar localmente

Requer Node 20+.

```bash
npm install
npm run dev        # abre em http://localhost:5173 (e no IP da rede, para testar no celular)
npm test           # testes unitários da simulação
npm run build      # gera o site estático em dist/
npm run preview    # serve o dist/ para conferir o build
```

Para testar no celular: rode `npm run dev`, conecte o celular na mesma rede Wi-Fi
e abra o endereço "Network" que o Vite mostra no terminal.

Atalhos no PC: teclas 1–8 escolhem a ferramenta, Espaço alterna a velocidade, Esc volta para "Ver".

## Publicar

O build é um site estático (`dist/`) com caminhos relativos, então funciona em qualquer hospedagem.

- **GitHub Pages:** envie o repositório para o GitHub na branch `main` e, em
  *Settings → Pages*, escolha *Source: GitHub Actions*. O workflow
  `.github/workflows/deploy.yml` roda os testes, faz o build e publica a cada push.
- **Netlify / Vercel / Cloudflare Pages:** comando de build `npm run build`, pasta `dist`.
- **Manual:** `npm run build` e envie o conteúdo de `dist/` para qualquer servidor.

## Estrutura

```
src/
  core/     simulação em TypeScript puro (sem Phaser): mapa, cobertura, economia,
            casas, metas, ações e relógio
  data/     JSON com custos, vagas, raios, níveis das casas, metas e regras
  render/   desenho e animação: texturas geradas, mapa, moradores, HUD, ferramentas
  scenes/   telas do Phaser (início e jogo) e tratamento de entrada
tests/      testes unitários do core
```

Para ajustar o balanço do jogo, edite os arquivos em `src/data/`.

### Trocar a arte por sprites

Todas as imagens são texturas com nome, geradas em `src/render/textures.ts` (veja `TEX`).
Para usar sprites, carregue arquivos de imagem com as mesmas chaves num `preload()`
e deixe de chamar `generateTextures()`. Os pontos de ancoragem (chaminé, fogo do altar,
trigo, balão) ficam em `ANCHORS`. Prédios usam 48×60 px, com a célula de 48×48 na parte de baixo.

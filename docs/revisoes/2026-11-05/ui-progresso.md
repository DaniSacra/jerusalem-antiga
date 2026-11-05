# Pacote Povo: progresso da interface (ui-designer)

Escopo: plano.md seção 7 (7.1–7.8) e pedido-povo.md ("Telas").

## Passos
- [x] Leituras puras no core (famílias por casa, filhos por casa) + testes
- [x] Textos em strings.ts
- [x] Balão da casa (lista de moradores, linha dos filhos, casa vazia)
- [x] Ficha da pessoa (painel, Voltar/Fechar, parentes em botões)
- [x] Balão de celeiro/mercado/oficina (Melhorar · custo, falta prata, nível máximo) e balão da ferramenta
- [x] Estatísticas: aba Povo
- [x] Avisos/toasts 7.6/7.7, abertura, vitória, tutorial 7.8, toasts x balão do tutorial
- [x] Cenários visuais 9.3 + TESTING.md + GAME_DESIGN.md
- [x] tsc, vitest, cenários; capturas olhadas em 844x390, 915x412 e 1366x768

## Notas
- Balão da casa no celular: duas partes lado a lado (pessoas | nível), botões dentro do balão sob a
  parte do nível (a tela é baixa); se não cabe ao lado da casa, a câmera desliza a casa para o lado
  (`nudge`). PC: uma coluna.
- Leituras novas em `readouts.ts`: `houseBirths`, `householdsOf`, `grownUpThisWeek` (testes em
  `tests/peopleReadouts.test.ts`).
- Vitória: nascimentos e casamentos contados pelos eventos no GameScene (o core não guarda o total).
- Celeiro/mercado/oficina no celular: o nível vai para a segunda coluna com os botões dentro do
  balão (o balão do celeiro era alto e os nomes dos botões saíam da tela).
- `scripts/visual/run.mjs` agora sobe o Vite sem HMR e sem vigiar arquivos: edições de outros
  agentes recarregavam a página no meio dos cenários (falhas "game.ui undefined").
- Testes de `goals`, `happiness`, `houses` e `people` (fertilidade) falham pelos dados novos do
  sim-tester (goals.json/rules.json), não pela interface.
- Cenários antigos ajustados aos dados novos: `setupHudCity` põe pessoas nas casas e mais praças
  (déficit), `victory` usa o primeiro lugar pronto do Templo, `preview-food-after` lê a nova chave
  do balão, `demolish-loss` e `p2-ui` leem também a segunda coluna. Objetivos (17) agora se
  dividem em quantas colunas a altura pede (o celular 800 x 360 cobria as ferramentas).
- Rodada final: todos os cenários novos + nova, p2-ui, demolish-loss, toast-panel, tutorial*,
  families-arrive, preview-food-after e victory passam; vitest 1186/1186; tsc limpo.

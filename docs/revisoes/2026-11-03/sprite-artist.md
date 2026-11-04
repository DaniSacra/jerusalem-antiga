# sprite-artist - 2026-11-03

Foco: sobrevivência: o jogador achou o jogo "meio impossível" depois do Pacote 1 de sobrevivência. Descobrir por que se perde, se o Ano 1 é justo, se a curva de dificuldade, comida, colheita, celeiro, seca e chegada de famílias estão equilibradas, e o que mudar para ficar desafiador mas jogável.

## Revisão de arte: o quanto a arte ajuda a ler a sobrevivência (somente leitura)

Nada foi editado no projeto e não houve commit.

**Testes rodados:** `town-art`, `seasons` (que também roda `seasons-phone`), `field-work` e `camera-wheel`. Todos passaram.

**Cidade de teste própria (seed=5):** celeiro, 2 pescadores, coletora e 6 campos com as 4 culturas, um deles na beira do rio. Fotografada em quatro situações:
- celeiro em 0%, 30%, 60% e 100%;
- colheita da primavera, campos plantados tarde e inverno;
- seca na primavera e no verão;
- trabalho no zoom máximo, e zoom mínimo na primavera, na seca e com neve.

Os scripts e as capturas estão no scratchpad da sessão, em `s/` (pastas `out2/` e `out3/`).

### Resumo
**Bem resolvido:**
- seca e neve, legíveis até no zoom mínimo;
- trigo dourado na primavera;
- carregadores de saco.

**Mal resolvido:** as quatro perguntas de sobrevivência ficam ambíguas, o que combina com a sensação de "meio impossível":
- não dá para saber se um campo vai colher;
- o nível do celeiro não aparece de longe;
- pescador e coletora parecem parados;
- o inverno normal parece calmo e verde, mas é a estação da fome.

---

### Prioridade 1: ler a sobrevivência

**1. Campo que não colhe este ano parece produtivo. É o problema mais grave.**
- **O que acontece:**
  - Campo construído depois do outono fica com a terra arada (`fieldStage` → `'plowed'`), mas recebe 2 agricultores com foice, trabalhando o ano inteiro.
  - Na captura `spring-late-fields.png`, na primavera, eles "colhem" terra vazia ao lado do trigo dourado. O jogador acha que o campo está rendendo.
  - Em `Fieldhands.ts` a ferramenta (enxada ou foice) é sorteada e não depende da estação.
- **Proposta:**
  - foice só na colheita da primavera;
  - no outono, semeadura (gesto de jogar sementes);
  - no inverno, enxada;
  - no verão, debulha ou palha;
  - em campo arado que só colhe no ano que vem, no máximo um lavrador com enxada e uma estaca com feixe amarrado, como marca de "espera".
- **Estimativa:** 1h30 a 2h. Poses novas em `residents.ts` e a lógica em `Fieldhands.ts` e `MapView.paintCrop`.

**2. Só o trigo mostra "pronto para colher"; lentilha e linho enganam na seca.**
- **O que acontece:**
  - Na primavera o trigo fica dourado, a cevada fica verde-palha e o linho fica azul (flor).
  - A lentilha continua verde-escura, igual ao inverno.
  - Na seca, a cor `dry` (multiplicada) quase não muda o verde-escuro da lentilha (`summer-drought.png`, campo do meio), e ela parece saudável.
  - A causa é que tudo é feito com tint multiplicado sobre um desenho único por cultura.
- **Proposta:**
  - Texturas de tufo por estágio para cada cultura, com pelo menos três: verde, maduro e seco.
  - Maduro com forma própria: lentilha com vagens castanhas, linho com hastes douradas depois da flor.
  - Seco como tufo murcho, baixo e esparso, com a terra rachada aparecendo entre as fileiras. Hoje o "seco" é laranja-acastanhado, muito parecido com o "maduro".
- **Estimativa:** 2h a 3h, em `textures.ts` (`cropImages`), com uma chave de textura por estágio.

**3. O motivo de o campo da beira do rio escapar da seca não aparece.**
- **O que acontece:** campo encostado no rio é imune à seca (`byRiver`), e nada no desenho mostra isso.
- **Proposta:**
  - Um canalzinho de irrigação com água brilhando, do rio até a borda do campo, desenhado só quando `byRiver`.
  - Na seca, ele vira a única coisa verde e azul no meio da terra rachada, e ensina a regra sem texto.
- **Estimativa:** 1h a 1h30.

**4. Nível do celeiro: visível de perto, invisível de longe.**
- **O que acontece:**
  - A 1,3x, de 0% a 100% muda só o pátio sob o toldo (paletes vazios → sacos → monte de grão) e o tampo do silo (`granary-0..3.png`).
  - No zoom mínimo o celeiro inteiro tem uns 40 px, e as 4 versões ficam iguais.
- **Proposta** (sinais grandes, de silhueta):
  - nível de grão visível nos dois silos, com uma faixa dourada que sobe por fora ou porta aberta com o grão aparecendo;
  - cheio: sacos empilhados também no telhado plano do armazém e transbordando para fora do muro;
  - vazio: portas escancaradas com interior escuro, pombas ou ratos e mato no pátio.
- **Estimativa:** 1h30 a 2h, em `granary()` (`textures.ts`). O índice de estoque já existe.

**5. Pescador e coletora não "trabalham" de forma visível.**
- **Pescador** (`fish-1..3.png`, a 2,2x):
  - **O que acontece:** o homem anda até a margem e fica parado de pé. Não há lançamento de rede, respingo nem barco na água, e no zoom mínimo não se vê nada.
  - **Proposta:** a cada poucos segundos, um arco de rede (2 ou 3 frames), um anel de respingo na água e um brilho de peixe. Opcional: o barco do pátio sai para a água rente à margem.
- **Coletora:**
  - **O que acontece:** o prédio parece uma "casa de barro com cestos", muito parecida com uma casa nível 1.
  - **Proposta:** silhueta própria, com toldo de folhas de palmeira e varal de frutas secando bem alto. Na árvore em uso, um pequeno tremor da copa e frutas caindo num pano estendido.
- **Estimativa:** 2h a 3h, em `Haulers.ts` e `Effects.ts` (respingo barato reaproveitando `ring`), mais `gatherer()` e `fisher()` em `textures.ts`.

**6. O inverno não parece perigoso.**
- **O que acontece:** o inverno sem neve (`winter.png`) é o mapa mais verde e calmo do ano, com árvores peladas e fumaça. Mas é a estação em que a comida acaba e as tendas perdem gente (`winterLoss`), e nada no mapa avisa.
- **Proposta:**
  - tendas de inverno com as abas fechadas, um braseiro pequeno na porta com 2 moradores encolhidos, e cor um pouco fria;
  - quando a família sai por frio ou fome, um efeito na tenda (fumaça apagando, pegadas indo embora);
  - na fome, jarros tombados nos telhados (eles já existem como decoração).
- **Estimativa:** 1h30.

### Prioridade 2: qualidade e legibilidade

**7. Prédios de comida no zoom mínimo.**
- **O que acontece:** celeiro, pescador e coletora viram manchas bege. Os campos ainda se leem pela cor.
- **Proposta:** dar a cada um um elemento alto e de cor própria:
  - celeiro: silos maiores, de pedra clara com cúpula de barro;
  - pescador: varas da rede bem altas, com a rede escura recortada contra o céu;
  - coletora: palmeira de sombra ou toldo verde.
- **Estimativa:** 1h a 1h30.

**8. Transição da seca na primavera.**
- **O que acontece:** enquanto a rachadura se espalha (`spring-drought.png`), sobram losangos verde-vivo isolados no meio da terra rachada. Parece bug.
- **Proposta:** misturar a cor da grama de primavera com a da seca, em vez de trocar célula por célula, ou ao menos amarelar as células que ficam.
- **Estimativa:** 45 min (`Seasons.ts` e `MapView`).

**9. Cenário de teste incompleto** (para o agente principal; não é arte).
- **O que acontece:**
  - `buildTown` (`town-art` e `seasons`) não tem celeiro, pescador nem coletora, então nenhum teste fotografa os prédios novos da sobrevivência.
  - O `seasons` põe `food = 1e4`, e a pílula aparece como "10000/40" nas capturas.
- **Proposta:** acrescentar os 3 prédios ao `buildTown`, com o celeiro meio cheio, perto do rio, e documentar em `docs/TESTING.md`.
- **Estimativa:** 30 a 45 min.

### Prioridade 3: deixar a cidade mais bonita e mais viva na sobrevivência
- **Eira:** círculo de terra batida ao lado do celeiro, com gente debulhando no verão. Dá ao verão uma atividade de comida, e o mapa ganha vida.
- **Campos em terraços de pedra** nas encostas, com muretas de pedra solta entre eles, como diz a direção de arte. Hoje os campos são quadrados soltos.
- **Prensa de azeite** e cestos de oliva perto da coletora no outono. Os catadores de outono já existem; falta para onde levar o que colhem.
- **Carregadores também para pescador e coletora:** um carregador com cesto de peixe ou fruta indo ao celeiro, mesmo que raro. Assim a comida que entra fica visível o ano inteiro, não só na colheita.

### O que já está bom (manter)
- Seca no zoom mínimo: o chão rachado e a lama nas margens do rio se leem de longe (`zoom-min-drought.png`).
- Neve: leitura perfeita (`zoom-min-snow.png`).
- Trigo dourado com o anel de colheita, carregadores de saco até o celeiro e o efeito de comida estragando.
- Qualidade geral: as casas de cada nível são bem distintas, e o templo é o prédio mais bonito.

### Ordem sugerida
1. Itens 1, 2 e 3: tratam do campo e respondem "vou colher?", o mais ligado ao "meio impossível". Cerca de 5 a 6h.
2. Itens 4 e 5: celeiro, pescador e coletora. Cerca de 4h.
3. Item 6: inverno. 1h30.
4. Prioridade 2.

### Arquivos relevantes
- `src/render/MapView.ts`: `fieldStage`, `paintCrop`, `granaryStock`
- `src/render/Fieldhands.ts`: ferramenta sorteada, sem estação
- `src/render/textures.ts`: `granary`, `fisher`, `gatherer`, `cropImages`
- `src/render/Haulers.ts`: pescador e coletora
- `src/render/Effects.ts`
- `src/render/Seasons.ts`
- `scripts/visual/run.mjs`: `buildTown`

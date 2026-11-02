# code-reviewer - 2026-11-02
Foco: tudo o que já está pronto: Interface nova, pacote visual Cidade bonita (partes 1–6), Campo é trabalho e Felicidade (com Jardim)

## Revisão de código: Felicidade + Jardim, parte 4 "vida e ambiente", commits 610c4fc / d27cd5a / 56b1107

Typecheck, testes e build passam. Não achei nada que quebre o jogo. O problema mais sério é de desempenho: o cálculo da economia virou quadrático e roda a cada mês. Também há um bug visual nos animais quando a cidade enche. Não alterei nenhum arquivo.

**Verificações**
- `npx tsc --noEmit`: ok.
- `npm test`: 115 testes passando.
- `npm run build`: ok. O bundle tem 1,36 MB, só um aviso de tamanho.
- `src/core`: não importa Phaser e não usa `Math.random`. `src/render` usa `Math.random`, mas só para enfeite (Ambient, DayNight, Lights, Fieldhands, Walkers), o que é aceitável.
- Não há `any` no código.

### Graves

1. **A economia é recalculada uma vez por prédio a cada mês.**
   - `/home/dani/projects/jerusalem-antiga/src/core/houses.ts:52`: `balloonNeed` chama `computeEconomy(s)` e é chamada para cada prédio em `MapView.sync` (via `syncBalloon`, `/home/dani/projects/jerusalem-antiga/src/render/MapView.ts:400`).
   - Agora `computeEconomy` também calcula a felicidade de cada casa (`/home/dani/projects/jerusalem-antiga/src/core/economy.ts:58-63`, com `cellsOf` e arrays novos). Cada atualização custa então prédios × casas × células. Com cerca de 200 prédios são dezenas de milhares de operações por mês, e isso vai a 3x na velocidade 3.
   - Além disso, `balloonNeed` calcula a felicidade da casa de novo (`houses.ts:57`), e `houseInfo` chama `idleShare(s)` sem passar a economia, o que dispara mais um `computeEconomy` (`houses.ts:31`).
   - **Correção:** dar a `balloonNeed(s, b, eco)` e a `houseInfo(s, b, eco)` um parâmetro de economia já pronta. `MapView.sync` já recebe a eficiência, então pode receber `this.eco` inteira. Melhor ainda: `computeEconomy` devolver um `Map<id, Happiness>`, ou `idle` pronto, para não repetir `houseHappiness`.

2. **Os bichos dos quintais e os burros somem e voltam todo mês quando o limite de animais é atingido.**
   - Em `/home/dani/projects/jerusalem-antiga/src/render/Ambient.ts:98` e `:102`, `room()` é testado antes de `keep(...)`, inclusive para grupos que já existem.
   - Com `animals === maxAnimals`, nenhuma chave `t…`/`m…` entra em `want`, então todos esses grupos são destruídos nas linhas 144-149. Na atualização seguinte eles são recriados em posições aleatórias novas, e o ciclo se repete.
   - **Correção:** trocar a condição para `(this.groups.has(key) || room())`. Por exemplo, um helper `keepIfRoom(key, make)`.

### Médios

3. **O quintal do bicho não se move quando a célula escolhida é ocupada.** Em `Ambient.ts:100`, a chave `t${b.id}` não inclui a célula. Se alguém construir na célula livre escolhida, as galinhas continuam em cima do prédio novo. **Correção:** incluir a célula na chave, `t${b.id}-${c.x},${c.y}`, como já é feito nas ovelhas e lavadeiras.

4. **Cores fixas no código fora de `palette.ts`, quase todas em código novo.**
   - `/home/dani/projects/jerusalem-antiga/src/render/fauna.ts`: cerca de 30 hex.
   - `Ambient.ts:12`: o array `CLOTHS` repete `C.clothes[1]`, `[3]` e `[4]`.
   - `Ambient.ts:65`: a tinta das nuvens está fixa (`0x1c1408`).
   - `/home/dani/projects/jerusalem-antiga/src/render/textures.ts`: as pétalas de `groundDeco` e `0x9a6ab0` no `garden`.
   - **Correção:** usar `C.clothes` direto nos panos. Criar em `palette.ts` um bloco `C.fauna` (pelagens, bico, crista) e `C.flowers`.
   - O padrão já existia em `textures.ts` (cerca de 200 hex), mas o código novo deveria seguir a regra.

5. **Texto em português fora de `strings.ts`.** `/home/dani/projects/jerusalem-antiga/src/render/info.ts` tem frases fixas nas linhas 20-61, por exemplo "esperando uma família", "nível máximo", "Para …:", "sem rua", "fome: não evolui", "livre para construir". A dívida é anterior, mas a felicidade foi encaixada nesse arquivo. **Correção:** mover tudo para `T.info.*` (tarefa do copywriter).

6. **Números de ajuste fixos no código.**
   - `/home/dani/projects/jerusalem-antiga/src/core/economy.ts:80`: o valor `50` usado quando não há famílias deveria ser `RULES.happiness.base`.
   - `MapView.ts:236`: o balanço das árvores (`1.6` palmeira, `0.7` oliveira) deveria ir para `visual.json`, em `ambient.sway`.
   - `Ambient.ts`: as velocidades e raios em `yard`, `doves` e `boat` (por exemplo 0.5, 0.25, 1.7, 0.12, 2.5) poderiam ir para `visual.json`. É só visual, então a prioridade é baixa.

7. **`'garden'` entrou em `ServiceKind` e, por tabela, em `NeedKind` e `BalloonKind`, mas não existe a textura `TEX.need('garden')`** (lista em `textures.ts`, cerca da linha 2892). Hoje não dá erro porque nenhum nível em `houses.json` pede jardim. Mas o tipo permite um balão sem textura, e `T.need.garden` e `C.need.garden` existem só por obrigação de tipo. **Correção:** separar `NeedKind = 'road' | 'well' | 'market' | 'sacred'` de `ServiceKind`, ou gerar o ícone também.

8. **Comentário que não bate com o código:** `/home/dani/projects/jerusalem-antiga/src/core/types.ts`, no bloco `happiness`, diz "(1 at 50)". Na prática o multiplicador fica em 1 em toda a faixa de `sad` a `happy`, que é o que `happiness.ts:42` faz. **Correção:** ajustar o comentário.

### Menores (custo e DRY)

9. **`drawTrails` (`MapView.ts:288-305`) compara todos os pares de casas e redesenha os gráficos a cada `refresh`, ou seja, todo mês.** **Correção:** redesenhar só quando o número ou a posição das casas mudar, por exemplo guardando uma assinatura com ids e posições.

10. **`RoadWear.nearSacred` (`/home/dani/projects/jerusalem-antiga/src/render/RoadWear.ts:30`) percorre todos os prédios para cada célula de rua em cada `sync`.** **Correção:** guardar a lista de altar e templos, ou uma máscara de células pavimentadas, e recalcular só quando os prédios mudarem.

11. **`Ambient.sync` varre o mapa inteiro a cada mês** (margens, ovelhas com `open()` 5x5 por célula, e um `sort`). Funciona, mas daria para recalcular só quando ruas ou prédios mudarem.

12. **`Walkers.ts:150` chama `setTexture` e monta a string da chave para todo morador em todo quadro.** `Fieldhands` já compara a chave antes. **Correção:** `if (w.img.texture.key !== key)`.

13. **`Toolbar.costRow(..., h = LEFT_BTN)`** (`/home/dani/projects/jerusalem-antiga/src/render/Toolbar.ts`) tem um valor padrão preso a um layout. **Correção:** passar `h` explícito no botão Rua e tirar o padrão.

14. **Texto:** `strings.ts`, `happinessPart.sacred: 'Altar'`, mas o templo também conta. **Correção:** "Altar/Templo", como em `T.need.sacred`.

### Para o game-director (desenho, não código)

15. **A penalidade de desemprego vale desde o início, mas o alerta de desemprego só aparece depois que a Oficina é liberada** (`unemploymentAlert`). No começo, as casas podem ficar tristes (balão "sad" e menos imposto) sem que o jogador tenha uma oficina para resolver. Vale confirmar se é intencional. Se não for, aplicar a mesma condição ao `idle` na felicidade, com um valor ligado/desligado em `rules.json`.

### Pontos positivos
- `happiness.ts` é pequeno, puro e com números em `rules.json`.
- Os testes da felicidade cobrem efeitos, limites, balão e chegada de famílias.
- As texturas de fauna e decoração são geradas uma vez só.
- O Hud troca a carinha só quando o humor muda.
- `LEFT_BTN` mantém um alvo de toque de cerca de 44 px na altura mínima.

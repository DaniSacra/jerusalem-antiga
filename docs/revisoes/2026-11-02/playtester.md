# playtester - 2026-11-02
Foco: tudo o que já está pronto: Interface nova, pacote visual Cidade bonita (partes 1–6), Campo é trabalho e Felicidade (com Jardim)

**Bugs (do mais grave ao menos grave)**
1. **Quadrado preto (textura faltando) ao lado de cerca de 1/3 das tendas.** A galinha ou a cabra do quintal recebe o quadro -1. Para ver: coloque 6 tendas ao lado da rua inicial (x=22, y=27..37) e olhe o mapa. Aparecem 2 imagens `__MISSING` (preto com borda verde), confirmadas no navegador. O esperado é que todo animal tenha um quadro 0 ou 1. A causa está em `/home/dani/projects/jerusalem-antiga/src/render/Ambient.ts:282-283`: o código usa `(h >> 1) % 2` e `(h >> 2) % 2`, com `>>` em vez de `>>>` sobre o `cellHash` sem sinal. Pelas minhas contas, 33% das células dão erro. O cenário `ambient` não pega isso porque só confere se os animais existem.
2. **Placa: a prata com 5 dígitos ou mais invade o espaço da comida.** Nos prints do próprio teste (`happiness-house`, `day-night-night`), "998711 +15,5/mês" passa por cima do pão. Depois da vitória, os bots chegam a cerca de 45.000 de prata no mês 400 (no celular, 2 px além do espaço). A largura fixa dos espaços fica em `/home/dani/projects/jerusalem-antiga/src/render/layout.ts` (`SLOT_W`). Sugestão: encolher a fonte ou abreviar ("45 mil").
3. **Arrastar ficará pesado em cidade grande.** Cada célula de rua ou casa arrastada chama `refresh()` → `map.sync` → `balloonNeed` em cada construção, e cada `balloonNeed` refaz `computeEconomy` com a felicidade de todas as casas. Isso dá custo O(N²), medido em 3,8 ms por célula com 122 construções no Node; no celular deve ser bem pior. Arquivos: `/home/dani/projects/jerusalem-antiga/src/core/houses.ts` (`balloonNeed`) e `/home/dani/projects/jerusalem-antiga/src/render/MapView.ts:400`. Sugestão: calcular a economia uma vez por sync.
4. Menores:
   - Ondinhas do rio: `(h >> 8) % 50` pode dar negativo e desenhar a ondinha fora da célula (`/home/dani/projects/jerusalem-antiga/src/render/MapView.ts:556`).
   - `docs/TESTING.md` ainda descreve `leftButton` sem o Jardim (0 Ver, 1 Rua, 2 Limpar…).
   - Em `/home/dani/projects/jerusalem-antiga/src/scenes/GameScene.ts`, o comentário "New map, new seed" ficou acima de `applySettings`, e não de `restart`.

**Pontos de confusão**
- **Carinha vermelha logo no começo.** Com 6 tendas e 1 campo, todas ficam tristes (30) só por "Desemprego −20". O aviso de desemprego fica escondido até liberar a Oficina, e a Oficina ainda está bloqueada. Sugestões: só aplicar o desemprego na felicidade depois da Oficina, ou dizer na linha da tenda "construa campos: dão trabalho".
- **A felicidade quase nunca chega a "feliz".** Nas simulações, a média fica em 40–45 durante quase toda a partida, porque o desemprego anula o Jardim. A carinha quase não muda.
- Tocar em Comida ou em Trabalho não faz nada. O "+5 sem vaga" não tem explicação; sugiro tocar e ver "5 pessoas sem vaga: campos e oficinas dão trabalho".
- "Oficina: liberado ao cumprir a Meta 3" deveria ser "liberada".
- A explicação da carinha cita o Jardim antes de ele ser liberado.
- O aviso de saldo pode mandar "demolir serviços" quando o maior custo é o Templo, que não pode ser demolido. Visto após a vitória.

**Controles**
- Celular 844 x 390, por toque real: todos os botões dos dois trilhos funcionam, inclusive os bloqueados, que mostram a dica. Arrastar Casa, Campo, Rua e Limpar funciona, e dois dedos movem a câmera com Rua ativa sem construir nada.
- Se o segundo dedo pousa depois de uns 240 ms de arraste, as ruas já feitas ficam (3 no teste).
- PC 1366 x 768: as teclas, o clique na meta e a tela de vitória com "Continuar construindo" funcionam; a roda sobre o trilho não dá zoom.
- Sem erros no console, só avisos de desempenho do driver WebGL.

**Invariantes da simulação: OK.** Rodei 3 bots × 8 sementes × 400 meses, conferindo depois de cada ação e de cada mês. Nenhuma falha: comida ≥ 0, moradores = soma das casas, vagas e eficiência coerentes, conexão em dia, grade, metas uma por vez, altar e templo protegidos, felicidade entre 0 e 100.
- Extremos ok: cortar a rua de um bairro (as casas caem até terreno em 6 meses), cidade sem campos (fome no mês 13, tendas abandonadas), muitas oficinas para 1 tenda (eficiência 8%), templo na borda, prata 0.
- Ritmo: o bot "distraído" perde por dívida em 4 de 8 sementes (meses 38–45).

`npm run test:visual`: os 17 cenários passaram. Nada foi editado nem commitado.

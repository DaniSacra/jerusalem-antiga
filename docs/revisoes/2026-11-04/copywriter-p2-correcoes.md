# Copywriter: textos das P2 correções (commit e1e42b3)

Só `src/render/strings.ts` foi editado. Números continuam lidos dos dados (`TEMPLE_GOAL`,
`RULES.happiness.sacred`, `dimsOf`). Todas as frases novas têm até 75 caracteres.

## Mudanças, em ordem de impacto

1. **Passo da família, motivo `food`** (`familyBlock.food`, aparece no balão do tutorial)
   - Atual: "Nenhuma família vem: falta sobra de comida para mais uma família. Pesque ou colete" (85)
   - Proposto: "Nenhuma família vem: pouca comida sobrando. Plante campos, pesque ou colete" (75)
   - Motivo: a seta nova aponta Comida → Campo (`reasonTools.food = field`), mas o texto mandava
     pescar ou coletar. Texto e seta se contradiziam (ver `tutorial-family-blocked.png`). Também
     ficou mais curto e cabe em uma linha no PC.
2. **Toast final do tutorial** (`tutorial.done`)
   - Atual: "Muito bem! Construa mais casas: cada uma recebe uma família"
   - Proposto: "Tutorial concluído! Construa mais casas para receber mais famílias"
   - Motivo: o passo agora termina sozinho em 8 semanas, às vezes com a porta das famílias
     fechada. Aí "cada uma recebe uma família" é uma promessa falsa. Mantém "Construa mais casas"
     (o teste visual procura essa frase).
3. **Dica do Templo** (`tip.temple`)
   - Atual: "Vence o jogo após o objetivo 9. Precisa encostar numa rua ligada ao altar."
   - Proposto: "Vence o jogo com o objetivo 9 cumprido. Encoste numa rua ligada ao altar."
   - Motivo: "após o objetivo 9" pode ser lido como "só construa depois do 9", mas dá para erguer
     antes e a vitória espera. Imperativo, igual às outras dicas.
4. **Toast do Templo cedo** (`templeEarly`)
   - Atual: "Templo erguido! A vitória vem com 500 moradores, a partir do Ano 8"
   - Proposto: "Templo erguido! Chegue a 500 moradores a partir do Ano 8 para vencer"
   - Motivo: diz o que fazer, com as mesmas palavras do objetivo 9 ("Chegue a 500 moradores a
     partir do Ano 8").
5. **Templo sem lugar pronto** (`noTempleSpotRoad`)
   - Atual: "Sem lugar pronto: o Templo cabe no amarelo, falta ligar à rua"
   - Proposto: "Sem lugar pronto: puxe uma rua ligada ao altar até uma área amarela"
   - Motivo: "cabe no amarelo" é vago, e o texto não dizia a ação. Agora usa o termo do jogo, "rua
     ligada ao altar".
6. **Família foi embora sem rua** (`familyLeft.road`)
   - Atual: "Uma família foi embora: casa sem rua"
   - Proposto: "Uma família foi embora: tenda sem rua ligada ao altar"
   - Motivo: só sai família de tenda (nível 1), e a necessidade é estar na rede, não ter
     qualquer rua. Usa os termos do jogo ("tenda", "rua ligada ao altar").

## Mantidos

- "Cabe aqui: falta ligar à rua": curto e claro na prévia. O teste visual confere esse texto exato.
- "+10 de Alegria em N casas": está certo e o 10 vem de `happiness.sacred`.
- "Uma família está chegando!": quando a porta está fechada, o balão já troca pelo motivo.

## Pendências (não editei: fora do meu escopo nesta tarefa)

- Docs que citam os textos antigos: `docs/GAME_DESIGN.md` linhas 138, 210, 373–375, 606 e 666–667;
  `docs/design.md` linhas 78 e 85.
- Regra: no inverno, o motivo `food` aponta para o Campo, que não dá comida até a primavera. O
  texto agora cita as três fontes, mas a seta continua indo para o Campo. Sugestão para o
  game-director: no inverno, `reasonTools.food` deveria apontar Pescador ou Coletora.

## Verificação

`npx tsc --noEmit` e `npx vitest run` passam (1144 testes). Visual `tutorial-blocked` e
`temple-areas` rodados.

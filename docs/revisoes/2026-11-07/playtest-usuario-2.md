# Playtest do usuário, 2026-11-07 (versão com o aperto da economia, a07e9ad)

Texto do usuário:

- a mecânica das chuvas é estranha, começa e para....
- os cidadãos também eles estão andando de repente somem....
- Ainda sobra muito dinheiro mesmo com poucas construções.
- Não sinto peso de fazer coisas erradas se eu construir um monte de coisas dá certo mesmo assim.
- Se não tiver ninguém guardando o celeiro tem q ter comida roubada.
- IA dos moradores q somem do nada....
- Tem 1 pescador mas aparece 0 de 1 vaga (falta 1)
- manutenção tem q ser mais cara
- Os avisos ficam quebrando para à esquerda a lista de avisos tinham q ser uma debaixo da outra.
- Gostei da ideia de ver os trabalhadores trabalhando, mas, para isso tem q melhorar a IA deles... já falei mas tô reforçando.
- de noite ou em tempos q fica mais escuro poderia acender as luzes das casas e poderia ter objetivo nosso de colocar luzes nas ruas para q não tenham roubos.
- Eu travei no objetivo 5 sem entender.... não nasce ninguém e não vem ninguém...

## Triagem (agente principal)

Bugs, para corrigir primeiro:
1. Moradores que somem do nada no meio da caminhada (citado duas vezes, e o usuário reforça a IA dos trabalhadores).
2. A chuva liga e desliga de repente, em vez de entrar e sair aos poucos.
3. Profissões mostra "0 de 1 vaga (falta 1)" mesmo com 1 pescador trabalhando.
4. A lista de avisos quebra para a esquerda; os avisos deveriam ficar um embaixo do outro.
5. Travado no objetivo 5 (5 casas de barro): não nasce ninguém e não chega ninguém, e o jogo não explica por quê.

Dificuldade, para o pacote Dificuldade:
6. Sobra prata demais e a manutenção pesa pouco: subir a manutenção.
7. Errar não custa nada: construir demais ainda dá certo.
8. Celeiro sem ninguém guardando → comida roubada.
9. À noite as casas acendem as luzes; uma meta de pôr lamparinas nas ruas contra roubos.

## Mais duas observações (mesmo dia)

Texto do usuário:

- As pessoas devem precisar de roupas boas para não morrer de frio, uma das oficinas pode ser de couro para o frio, no caso precisaria de animais para o couro.
- precisamos unir mais as mecânicas para elas se complementarem

Triagem, para o pacote Dificuldade:

10. **Roupas contra o frio.** O curtume (um dos ofícios da oficina) transforma o gado do Pasto em couro e roupas. Uma casa sem roupas sofre mais com o frio no inverno, mesmo com lenha.
11. **Mecânicas que se completam.** O gado passa a ser disputado entre as ofertas do altar e o couro, a lenha entre o fogo e as obras, e a pedra entre as casas e o Templo. O game-director vai mapear essas ligações e propor quais entram.

## Diagnóstico do playtester (bugs 1–5)

1. **Moradores somem andando.** Três causas.
   - (a) A camada `people` é recriada inteira, em posições sorteadas, toda vez que a chave em `render3d/diff.ts` muda. São 0,19 trocas por semana, a maioria vinda de `haulJobs`: uma troca a cada ~17 s na velocidade 1x e a cada ~6 s na 3x.
   - (b) `setShare` (`life.ts`) corta a lista na hora em que chove ou anoitece.
   - (c) `familyLead` (`crowd.ts`) faz a família andar em laço: ela some dentro de casa e reaparece.
   - Menor: os parados somem quando a câmera passa de `farDist`.
2. **Chuva liga e desliga.** Cada pancada cabe dentro de uma semana (de 0,2 a 0,55 semana), e a transição dura 0,06 semana. No inverno, 55% das semanas sorteiam chuva.
3. **"0 de 1 vaga".** Os números estão certos. Ninguém está livre, e `assignJobs` nunca tira de uma profissão automática de prioridade menor para preencher outra de prioridade maior. O painel não explica por quê.
4. **Avisos quebrando.** Em `alertsPanel`, cada aviso vira uma seção própria, e `.sections` é flex em linha com quebra.
5. **Objetivo 5 travado.** A 5ª família só chega com a primeira caravana (semanas 52–98) ou com um casamento. 38% das partidas ficam paradas por mais de 10 semanas, com mediana de ~65 semanas. Os nascimentos são raros porque precisam de vaga na casa. A tela mostra só "4/5". No branch do Templo, `housesStep` engana: pede "Construa mais casas" mesmo quando há terreno vazio.

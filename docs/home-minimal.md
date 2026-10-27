# Home minimalista

A Home em duas zonas, em `src/components/home/minimal/`:

| Peça | O que faz |
|---|---|
| `HeroZone` | O jogo em foco (o **último jogado**) num card panorâmico flutuante, com margens laterais e altura de 280–320 px (a biblioteca aparece logo abaixo). Capa dentro do card (`brightness-[0.7]`, acende no hover), degradê até o preto na base, título `text-2xl`, metadados em mono e pílulas compactas no canto inferior esquerdo. |
| `LibraryZone` + `LibraryCard` | A biblioteca em grade de cards verticais 2:3, `pb-12 pt-10`, capa a 65% de brilho até o hover/foco, borda fina, escala de 1,02 no hover. O card em foco (teclado/controle) rola para a vista. |
| `HomeMinimal` | Junta as duas zonas numa coluna que rola na vertical, com a barra escondida. |
| `homeLayout.ts` | Qual layout está ativo (`minimal` ou `classic`) e a chave gravada no aparelho. |

**Paleta e regras.** Fundo `var(--gray-0)` (#000), superfícies `--tone-0` (#0A0A0A) e `--tone-2`
(#171717), bordas `--tone-3` (#262626), texto `--ink` e `--ink-muted`. São os tokens do app, então
os outros temas continuam funcionando. Sem sombras: a separação vem do contraste e da borda de 1 px.
Pílulas usam `rounded-full` e os cards grandes `rounded-3xl`.

**Alternar.** Ctrl+K → "Alternar layout da Home" (o padrão é o clássico; a escolha fica em
`localStorage`, chave `pherielium_home_layout`). O layout clássico (faixa de recentes, herói e
carrossel) continua no código e é a volta fácil.

**Ainda não cobre:** o menu de contexto dos cards (clique direito), a navegação do controle
para cima/baixo na grade (esquerda/direita seguem o `selectedIndex`) e a faixa "Continuar jogando".

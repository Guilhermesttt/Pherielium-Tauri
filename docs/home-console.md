# Home estilo console

A Home (layout padrão, "clássico") segue a tela inicial de um console: a **arte do jogo em foco
ocupa a tela**, nítida, e a interface fica nas bordas. Referência de estrutura e movimento: o
conceito de interface de PS5 de Paweł Durczok (Dribbble). Nada de marca, ícone ou arte da
PlayStation foi usado: só a composição e o ritmo, nas cores da escala Dark do projeto. O layout
mínimo (`docs/home-minimal.md`) continua disponível.

## Composição

- **Barra de cima, em duas linhas** (`HomeTopNav.tsx`): na primeira, o símbolo do Pherielium
  (abre a sidebar) e a hora à esquerda; menu da biblioteca, busca e perfil à direita. Na segunda,
  as abas da biblioteca (`ConsoleLibraryTabs.tsx`): texto pequeno em caixa alta, a ativa com
  contorno, e chips Q/E nas pontas (LB/RB com controle conectado).
- **Fundo:** `GameEnvironment` com `sharp`: a arte do jogo em foco, com opacidade cheia, sem
  desfoque nem brilhos de cor, escurecida só onde há interface (topo, esquerda e base). A troca
  de arte entra assentando (escala 1.015 → 1 em 350ms) enquanto a anterior apaga.
- **Fileira de capas** (`console/ConsoleHome.tsx`): capas quadradas na parte de baixo; a focada
  cresce 1.2× com mola (React Spring), com um contorno fino e claro (1.5px), e a loja aparece escrita embaixo dela, com o ícone da
  loja antes do nome. As capas têm cerca de 19% da altura da janela. O nome do
  jogo não é desenhado na Home (está na capa); um aviso invisível o anuncia a leitores de tela.
- **Legendas só com controle:** com mouse e teclado a Home não mostra dicas nem chips de aba.
  Com controle aparece o rodapé (`SteamDeckControllerFooter`), no formato do conceito: sem faixa,
  glifo + rótulo em caixa alta, à direita.
- **Notificações** (`ui/Shandc/toast.tsx`): aparecem no topo, centralizadas e abaixo do notch,
  como o aviso do conceito: retângulo escuro de canto pequeno, remetente em caixa alta pequena,
  mensagem embaixo e ação com contorno à direita.

## Fileira

`buildConsoleRow` (`console/consoleRows.ts`, puro e testado): na aba **Todos os jogos**, os jogados
recentemente vêm primeiro (ordem de "Continuar jogando") e depois o resto; em qualquer outra aba,
o recorte da aba. A busca e os filtros valem. O jogo selecionado continua sendo
`displayGames[selectedIndex]`.

## Navegação

| Entrada | Ação |
|---|---|
| Setas esquerda/direita, D-pad | anda na fileira |
| D-pad cima | foca a pesquisa (como antes) |
| D-pad baixo com a pesquisa focada | volta para a capa em foco |
| Roda do mouse (vertical ou horizontal) | anda na fileira; Alt+roda segue abrindo plataformas |
| Setas que aparecem ao passar o mouse na fileira | anda uma capa |
| Clique numa capa fora de foco | foca |
| Clique na capa em foco / Enter | abre a tela do jogo |
| Ctrl+Enter | inicia o último jogo jogado |
| F | favorita a capa em foco |
| Q / E, LB / RB | aba anterior / próxima |
| Clique direito numa capa | menu do jogo (favoritar, editar, remover) |

## Movimento

- capa em foco: mola (`tension 560`, `friction 38`), sem quique; alinhamento da fileira refeito
  em 120, 280 e 520ms, porque a mola não avisa quando termina;
- fundo: troca de arte em 700ms; tokens no bloco "Home estilo console" de `src/index.css`;
- com "reduzir movimento", tudo troca sem transição.

## Laboratório

`#/design-lab/console` (só em desenvolvimento): a Home com a barra superior real, jogos de
exemplo e artes do CDN público da Steam. `?game=steam-440` abre num jogo.

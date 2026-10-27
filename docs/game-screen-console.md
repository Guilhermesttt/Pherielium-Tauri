# Tela do jogo estilo console

Ao abrir um jogo (Enter ou clique na capa em foco na Home), a **arte fica** e a interface sobe.
Referência de estrutura e movimento: o conceito de PS5 de Paweł Durczok (Dribbble), nas cores da
escala Dark do projeto e sem nenhum elemento da marca.

Código: `src/components/game-detail/console/ConsoleGameScreen.tsx` (visual) e `consoleScreen.ts`
(lógica pura, com testes). O `GameDetailPanel` continua dono dos dados e das ações
(`useGameDetailAsync`, `useGameDetailActions`, `useGameDetailState`), dos modais (galeria,
exclusão), do painel de controle e da intro de lançamento; só a parte visual mudou.

## Composição

- **Topo:** botão voltar e hora.
- **Aba Jogar:** arte em tela cheia. Embaixo à esquerda, de cima para baixo: as abas (com chips
  Q/E, ou LB/RB), a loja, o título, e os números ("JOGADO POR 23h 19m", conquistas, última vez,
  amigos jogando, que fica verde, o único verde da tela). Embaixo à direita: progresso de troféus,
  a caixa de contorno "Iniciar o jogo" (vira "Iniciando…" e "Em execução" com o ponto verde) e as
  dicas Opções / Selecionar / Voltar.
- **Opções** (tecla O, ou o botão "…" com mouse; com controle, o glifo Opções): menu curto com
  favoritar, editar e controle do jogo.
- **Legendas só com controle:** com mouse e teclado não há legendas nem chips de aba; com controle
  aparecem os glifos (Opções, Selecionar, Voltar e os bumpers LB/RB).
- **Modo lista:** seta para baixo (ou "Conquistas recentes") na aba Jogar. Um painel escuro sobe e cobre
  a coluna da esquerda (56%); a arte aparece na direita e a esquerda, agora com as abas no topo, mostra as conquistas
  desbloqueadas mais recentes e, depois, as bloqueadas mais fáceis (maior % de jogadores; as
  ocultas não entram, para não dar spoiler). O item selecionado tem um contorno de tinta único que salta de um item
  para o outro (180ms), com setas cima/baixo ou o mouse; Enter abre os troféus. Seta para cima no
  primeiro item, ou Esc, volta.
- **Aba Conquistas (troféus):** `ConsoleTrophyList.tsx`, no formato da tela de troféus de um
  console: ícone, nome, descrição e data à esquerda; % de jogadores e rótulo de raridade (Ultra
  rara, Muito rara, Rara, Comum) e o troféu do tier à direita; filete entre as linhas. Filtros
  Todos / Desbloqueados / Bloqueados e busca (a descrição de um troféu oculto e bloqueado não entra
  na busca). Desbloqueados primeiro, do mais recente; depois os bloqueados, dos mais fáceis.
- **Outras abas** (Sobre, Capturas, Mods, Gerenciar): sempre no modo lista, com os
  componentes de sempre do detalhe na coluna da esquerda.

## Navegação

| Entrada | Ação |
|---|---|
| Setas esquerda/direita, Q/E, LB/RB | troca de aba |
| Seta baixo / cima (aba Jogar) | abre / fecha a lista |
| O | abre / fecha o menu Opções |
| A / X do controle | inicia o jogo na aba Jogar |
| Esc / B | fecha o menu ou a lista; senão volta para a Home |

Setas dentro de campos de texto (busca de conquistas, perfil de lançamento) não trocam de aba.

## Movimento

- abrir (~200ms): a fileira da Home some em fade, as abas descem 18px até ficarem sobre o título
  e o título, os números e a caixa de Iniciar aparecem; a arte é a mesma da Home, então parece que
  ela ficou no lugar. Fechar: 150ms;
- modo lista: a arte **não encolhe**; ela fica parada em tela cheia e um painel escuro sólido
  (`.console-list-panel`, 56% da largura, sem canto arredondado) sobe de baixo para cima em ~200ms
  e cobre a coluna da esquerda, enquanto o bloco do título sobe com ele (layout animado). A lista
  entra logo atrás, subindo 10px. Fechar é o inverso: o painel desce e a arte volta a aparecer;
- tokens no bloco "Tela do jogo estilo console" de `src/index.css`. Com "reduzir movimento",
  troca seca.

## Laboratório

`#/design-lab/detail` mostra o painel real com um jogo de exemplo, sem conta.

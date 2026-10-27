# Teclado virtual do controle e sons de navegação

## Sons do tema padrão (`src/hooks/useSoundEffects.ts`)

Cada papel de navegação tem um arquivo do pacote `Phelierium Default`. Os outros temas herdam um
equivalente (`THEME_FALLBACK_ROLES`), então nenhum tema fica mudo.

| Papel (`SoundEffectType`) | Quando toca | Arquivo |
|---|---|---|
| `navigate` | andar entre jogos (D-pad, setas) | Deck UI Misc 10 |
| `detailOpen` | entrar no painel de detalhes do jogo | Deck UI Into Game Detail |
| `sidebarOpen` / `sidebarClose` | a sidebar e a gaveta de amigos abrem / fecham | Side Menu Fly In / Fly Out |
| `tabSwitch` | trocar de aba com L1 / R1 | Tab Transition 01 |
| `edgeBump` | chegar ao fim da fileira ou ir para onde não há nada | Bumper End 02 |
| `showModal` / `modalClose` | toda modal abre / fecha (`useModalSounds`) | Show Modal / Hide Modal |
| `menuClick` | clique no menu de Ajustes | Navigation |
| `keyTyping` | tecla do teclado virtual | Typing |

- Passar o mouse **não toca** no tema padrão (`isHoverSilent`). O notch ainda usa o arquivo de hover.
- `showModal` e `modalClose` tocam uma vez só se mais de um lugar pedir no mesmo gesto (120 ms).
- `edgeBump` repetido (D-pad segurado) respeita um intervalo mínimo de 220 ms.
- Para uma modal nova, chame `useModalSounds(isOpen)`. O `ModalShell` já chama.

## Teclado virtual (`src/components/keyboard`)

Abre quando o jogador ativa um campo de texto com o controle (`activateElementWithController`),
no formato do teclado do Steam Deck: cinco fileiras de mesma largura, símbolo de cima pequeno
acima do principal, teclas de ação com o botão do controle.

| Controle | Ação |
|---|---|
| D-pad / analógico | move o foco entre as teclas |
| X (Xbox) / ✕ (PS) | digita a tecla em foco |
| Quadrado / X | Apagar |
| Triângulo / Y | Espaço |
| L2 | Shift (uma letra) · L3 Caps · L1 / R1 cursor ← → |
| R2 | Buscar (Enter no campo) |
| O / B | fechar |

`keyboardModel.ts` tem o desenho das teclas e as regras de digitação (sem React, com testes).
As teclas de emoji e de acentos (globo) trocam as quatro primeiras fileiras por uma grade.
Laboratório: `#/design-lab/keyboard`.

## Movimento

- `pageMotion` (`src/design-system/motion.ts`): a troca de página da Home sobe 8 px enquanto
  aparece (250 ms) e a que sai só apaga (150 ms). As páginas não animam a própria entrada.
- Favoritar (`FavoriteBadge`): a estrela entra com mola e um anel que abre e some; desfavoritar
  encolhe em 150 ms. Quem já era favorito ao abrir a Home não anima.

## Prioridade dos botões do controle (`src/context/gamepadSubscribers.ts`)

Um aperto vai para **todos** os ouvintes da maior prioridade registrada para aquele botão, e só
para eles. Dois ouvintes na mesma prioridade respondem juntos, e foi isso que fazia o X clicar
duas vezes no item em foco e o L1/R1 trocar a aba da página e a da Home ao mesmo tempo.

| Camada | `GAMEPAD_PRIORITY` | Exemplo |
|---|---|---|
| Home | `base` (0) | D-pad e atalhos da biblioteca |
| Página sobre a Home | `page` (1) | X/O de Amigos, Perfil, Mods; L1/R1 de Troféus |
| Atalhos de aba / Ajustes | `pageTabs` (10) | L1/R1 de Amigos |
| Painel por cima da página | `overlay` (20) | Tela do jogo |
| Modais, teclado virtual | `modal` (100+) | `ModalShell`, `VirtualKeyboard` |

Para um botão novo, escolha a camada em vez de um número solto. Em desenvolvimento, um empate
mostra um aviso no console (`[gamepad] N ouvintes respondem juntos ao X`).

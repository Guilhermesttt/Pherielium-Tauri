# Movimento: modais, dropdowns e troca de ícones

Baseado no skill `transitions-dev` (transitions.dev). A escala compartilhada fica no começo do bloco
"Transitions.dev" de `src/index.css` (`--duration-*`, `--ease-*`, `--scale-*`, `--blur-*`); os
blocos abaixo leem esses tokens. Todo bloco tem a guarda de `prefers-reduced-motion`.

| O quê | Como | Valores |
|---|---|---|
| Modal (`ModalShell`, `.t-modal`) | classes `is-open` / `is-closing` + `.t-modal-backdrop` | abre 250ms, fecha 150ms, escala 0.96 → 1, curva smooth-out |
| Modais com framer-motion | `{...modalMotion}` e `{...modalBackdropMotion}` de `src/design-system/motion.ts` | mesmos tempos e escala do CSS (há teste que compara os dois) |
| Dropdown Radix (`dropdown-menu`, `context-menu`) | `.t-dropdown` + keyframes ligados ao `data-state` | abre 250ms (0.97 → 1), fecha 150ms (1 → 0.99), origem vinda do Radix |
| Dropdown/popover com framer-motion | `{...dropdownMotion}` com `transformOrigin` | idem |
| Troca de ícone | `<IconSwap active a b />` (`.t-icon-swap`) | 250ms, desfoque 2px, escala 0.25 |
| Troca de texto no lugar | `<TextSwap text />` (`.t-text-swap`) | 150ms, sobe 4px com desfoque |

## Armadilhas

- O Radix só adia a desmontagem de um menu para **animações CSS (keyframes)**, não para `transition`.
  Por isso o dropdown usa keyframes em vez do par `.is-open`/`.is-closing` do skill.
- Entre `DropdownMenu.Portal` e `DropdownMenu.Content` **não pode haver um Provider** (ou qualquer
  componente que não repasse a ref): o Presence do Portal perde o nó, lê "sem animação" e desmonta
  o menu na hora. O `GlideContext.Provider` fica por fora do Portal.
- Para o modal sair com animação, o `AnimatePresence` precisa envolver `{isOpen && ...}`; um
  `if (!isOpen) return null` antes dele corta a saída.

## Chamada recebida

`src/components/voice/IncomingCallModal.tsx` segue o cartão "Event Card With Attendees" do estúdio:
faixa no topo com as ondas do toque e a barra do tempo, avatar sobreposto à faixa, nome grande,
linhas de detalhe, divisor e dois botões (Atender em tinta, Recusar em vermelho suave). O texto dos
botões troca no lugar ("Atender" → "Entrando…") com `TextSwap`, o ícone vira um spinner com
`IconSwap`, e o toque encolhe o botão até 0.99. Laboratório: `#/design-lab/call` (`?video=1&stay=1`).

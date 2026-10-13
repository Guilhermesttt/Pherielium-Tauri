# Pherielium Refined (branch `design/hub-refined`)

Novo visual do hub, em uma branch separada para avaliar antes de mergear. Feito com a **Taste Skill** (direção sorteada, inspetor e crítica das capturas) e o **Web Design Guidelines** (acessibilidade e interação).

## A ideia
> No Pherielium, **o nó do logo (um círculo ligado por uma haste)** vira **a forma de todo controle**: botões em pílula, pontos de estado com anel, interruptores e o anel de foco.

Direção da Taste Skill: **"One motif"** (seed 490073457). A paleta sorteada (verde-garrafa e dourado) foi **trocada pela da marca** (preto, grafite e branco), porque o Pherielium já tem cor própria; a tipografia sorteada (Libre Franklin + Source Serif) foi trocada por **Sora + Inter**, porque o motivo é redondo e o app é uma interface, não um texto longo.

## O sistema (`src/index.css`, fim do arquivo)
| Token | Valor | Uso |
| --- | --- | --- |
| `--ink`, `--ink-muted`, `--ink-faint` | `#f5f5f7`, `#a1a1a6`, `#7c7c82` | texto (contraste 18:1, 8:1 e 4,8:1 sobre o fundo) |
| `--tone-0` a `--tone-4` | `#050505` → `#2c2c31` | fundo e superfícies, um degrau por nível (sem borda, sem sombra) |
| `--step-0` a `--step-5` | 13, 15, 17, 22, 32 px e o grande (44–72 px) | escala de texto; **piso de 13 px** |
| `--node`, `--corner-sm/md/lg` | pílula, 12, 20, 28 px | forma |
| `--z-bar/panel/modal/toast/system` | 40 a 100 | camadas nomeadas |
| `--spring`, `--dur-1/2/3` | `cubic-bezier(0.32, 0.72, 0, 1)`, 160/260/420 ms | movimento |
| `--live` | `#30d158` | o único acento de cor: ao vivo, online, falando |

Fontes: **Sora** (títulos, `--font-display`), **Inter** (interface) e Unbounded (marca), agora **embutidas no app**. Antes o `index.html` baixava 8 famílias do Google Fonts a cada abertura, e só a Inter era usada.

## Peças (`src/components/ui/refined/`)
`RefinedButton` (primary, tonal, quiet; pílula), `Surface` (degrau de tom), `SettingRow` (título, descrição, controle com `aria-labelledby`), `Segmented` (grupo de rádio com setas do teclado e pílula que desliza), `Toggle` (`role="switch"`, sem depender de provedores), `NodeDot` (estado com texto para leitor de tela).

## Como o hub inteiro foi migrado
Três camadas, nessa ordem, para não editar 250 arquivos à mão:

1. **Script de migração** ([scripts/migrate-refined-tokens.mjs](../scripts/migrate-refined-tokens.mjs), com teste, idempotente). Troca nas classes: `text-white/NN` pela tinta (`--ink`, `--ink-muted`, `--ink-faint`, pela opacidade), `text-[10–40px]` pelos passos (piso de 13 px; contadores de 9 px ficam), cinzas de fundo `bg-[#…]` pelos tons, cinzas de texto pela tinta e `rounded-[10–40px]` pelos três cantos. Ficam de fora o overlay do jogo, o notch, o mascote, o módulo de controle e a landing.
2. **Regras globais** (`src/index.css`, só com `data-ui-style="refined"`): sem sombra em repouso (os anéis de foco continuam), sem `backdrop-filter`, texto em gradiente vira tinta, `text-xs` vira 13 px, `rounded-xl/2xl/3xl` viram os cantos, sem caixa-alta espaçada nem monoespaçada, anel de foco em tinta, modais entram com a mola e sem borda, abas, dicas e toasts nos tokens.
3. **Peças compartilhadas redesenhadas**: `ModalShell` (fundo sem blur), gaveta lateral (`Sidebar`), barra de título, `Switch` (52×32, igual ao `Toggle`), toasts, e a tela de Configurações (painéis por tom, menu em pílula, linhas sem divisória, títulos em Sora, seletores em pílula).

## Telas já no novo visual
| Tela | Estado |
| --- | --- |
| **Login** | Redesenhada e capturada |
| **Configurações** | Redesenhada e capturada (`#/design-lab/settings?tab=general`, `personalization`, `voice`…) |
| **Modal de transmissão** | Redesenhado |
| Gaveta lateral, barra de título, modais, toasts, abas, interruptores | Redesenhados (peças compartilhadas) |
| Todo o resto (Início, Biblioteca, detalhe do jogo, Troféus, Mods, Amigos/Chat, janela de chamada, demais modais) | Tokens e regras globais aplicados; estrutura ainda a revisar com capturas logadas |

## Laboratório (só em desenvolvimento)
- `#/design-lab`: as peças com conteúdo de exemplo; `?modal=stream` abre o modal real.
- `#/design-lab/settings?tab=<aba>`: a tela **real** de Configurações, com os provedores da App, sem conta e com ações vazias.

## O que falta
- Botões secundários com contorno fino (ex.: "Testar", "Visualizar câmera") e selos com borda: trocar um a um por `RefinedButton` tonal. Não dá para fazer no CSS global sem quebrar as miniaturas de tema, que usam a borda para mostrar a seleção.
- **Bordas finas** (~770 `border-white/…`): ficaram. Tirar todas às cegas pode sumir com cartões que só têm borda; decidir com capturas.
- Camadas (`z-index`): continuam os valores antigos; normalizar para `--z-*` exige revisar quem fica por cima de quem.
- Telas logadas: preciso de capturas (ou de uma conta de teste) para revisar a estrutura de cada uma.

## Como ver
```powershell
git checkout design/hub-refined
npm install          # traz a fonte Sora
npm run tauri dev
```
Abra `#/login`, `#/design-lab` e `#/design-lab/settings` (no DevTools: `location.hash = "#/design-lab"`). Para comparar com o visual anterior: `localStorage.setItem("pherielium_ui_style","classic")` e reinicie (vale para os tokens; o login e o modal novos não têm versão clássica nesta branch).

## Para mergear depois
A branch está em cima da `main` local. Antes do merge: revisar as capturas das telas logadas, decidir se o estilo clássico continua disponível e gerar um rc para os dois PCs.

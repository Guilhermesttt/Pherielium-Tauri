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

## Telas já no novo visual
| Tela | O que mudou |
| --- | --- |
| **Login** | Cartão por tom (sem borda, blur e sombra), campos por tom com anel de foco, título em Sora sem gradiente, ações em pílula, nada abaixo de 13 px, divisória sem linhas |
| **Modal de transmissão** (componente real) | Linhas de ajuste com segmentados, interruptor, bitrate em segmentado, `role="dialog"`, fecha com Esc, fundo sem blur |
| **Laboratório de design** (`#/design-lab`, só em desenvolvimento) | Mostra chamada, transmissão, troféus, mods e ajustes no novo visual, com conteúdo de exemplo; `#/design-lab?modal=stream` abre o modal real |

Inspetor da Taste Skill no login: de **5 FAIL e 7 WARN** para **2 FAIL e 6 WARN**. Os que restam são de página de marketing (poucas fotos, sem vídeo) ou de elementos que a regra permite (contorno de campo de formulário, barra de título do app).

## O que falta (precisa de conta para ver)
Início/Biblioteca, janela de chamada, Troféus, Configurações, Mods, Amigos/Chat. Sem uma sessão logada eu não consigo capturar essas telas para criticar e corrigir, então não mexi nelas às cegas. Caminho sugerido, uma tela por vez:
1. Rodar o `tauri dev` logado e me mandar capturas (ou criar uma conta de teste).
2. Trocar as peças de cada tela pelas de `components/ui/refined` e as cores e tamanhos escritos à mão pelos tokens.
3. Capturar, criticar e corrigir (até 3 rodadas por tela).

## Como ver
```powershell
git checkout design/hub-refined
npm install          # traz a fonte Sora
npm run tauri dev
```
Abra `#/login` e `#/design-lab` (no DevTools: `location.hash = "#/design-lab"`). Para comparar com o visual anterior: `localStorage.setItem("pherielium_ui_style","classic")` e reinicie (vale para os tokens; o login e o modal novos não têm versão clássica nesta branch).

## Para mergear depois
A branch está em cima da `main` local. Antes do merge: revisar as capturas das telas logadas, decidir se o estilo clássico continua disponível e gerar um rc para os dois PCs.

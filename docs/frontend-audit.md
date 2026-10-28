# Auditoria do frontend (28/10/2026)

Feita com o Impeccable (polish/audit), o UI/UX Pro Max (checklists de acessibilidade, toque, tipografia e movimento) e a Taste Skill (regras de telas de app). Onde as skills divergem do mundo visual já escolhido do projeto (`DESIGN.md`), o `DESIGN.md` vence: por exemplo, o rótulo em caixa alta pequena do console e os véus em degradê sobre a arte ficam.

Método: contagem por padrão em `src/**/*.tsx` (sem testes e sem laboratórios), correção mecânica nas telas dentro do escopo, e conferência visual no laboratório. Notch, overlay, mascote, easter egg, landing e conquistas ficam de fora por padrão (`CLAUDE.md`).

## O que foi medido

| Padrão | Ocorrências | Leitura |
| --- | ---: | --- |
| Cor crua do Tailwind (`amber-*`, `sky-*`, `emerald-*`…) | 388 | Fora dos tokens; quebra temas e a "Regra da Única Cor" |
| `white`/`black` com transparência | 2021 | Branco translúcido sobre cinza para texto e fundo: viola a "Regra da Tinta Cheia" |
| Hex em classe (`bg-[#…]`) | 217 | Mesmo problema, mais difícil de achar |
| Texto abaixo de 13 px (`text-xs`, `text-[10–12px]`) | 477 | Abaixo do piso de legibilidade do `DESIGN.md` |
| Cantos `rounded-xl/2xl/3xl/lg/md` | 666 | Fora da escala `--corner-*` |
| `rounded-full` | 529 | Certo para pontos e avatares; botões em pílula fogem do squircle |
| `border`/`ring` com token de borda | 133 | O estilo novo separa por tom, sem contorno |
| `shadow-*` | 348 | "Plano em repouso": só painel flutuante deveria ter |
| `transition-all` | 215 | Anima propriedade demais; custa quadros |
| `backdrop-blur` | 110 | Vidro só em sobreposição, por custo de GPU |
| `: any` / `as any` | 194 | Contra a regra "sem `any` novo" |
| `catch {}` vazio | 45 (52 só em `useVoiceCall.ts`) | Contra "sem catch vazio" |
| `outline-none` sem `focus-visible` na linha | 7 arquivos | Possível foco invisível por teclado/controle |

ESLint: 376 erros (a linha de base citada era 387), nenhum novo nos arquivos tocados.

## O que foi corrigido agora

Passe mecânico em 16 telas e modais (Configurações, Login, Adicionar jogo, Boas-vindas, Novidades, Filtro da biblioteca, Chat, Filtro personalizado, Missões, Biblioteca vazia, Conectar Epic, Atualização, painéis de jogo e de mods, Radar):

- cores cruas viram tokens (`--live` só para "ao vivo", `--danger` para erro, `--ink`/`--tone-*` no resto);
- branco/preto translúcido vira degrau de tom;
- texto abaixo de 13 px vira o passo `--step-0` (13 px);
- `rounded-xl/2xl/3xl` viram `--corner-sm/md/lg`, e botões em pílula viram squircle;
- bordas brancas viram transparentes (a separação passa a ser por tom).

Antes disso, na mesma frente: Amigos, Troféus, Perfil, Home, tela de detalhes e todos os componentes de chamada já tinham passado pelo mesmo critério.

## O que ficou de fora, e por quê

1. **`any` e `catch {}` vazios** (194 e 45): corrigir é mudança de comportamento, não de aparência. `useVoiceCall.ts` concentra 52 `catch` vazios e merece uma tarefa própria, com logging e testes.
2. **Sombras e `backdrop-blur`**: precisam de decisão caso a caso (menu flutuante pode, cartão em repouso não).
3. **`transition-all`** (215): trocar por propriedades explícitas exige olhar cada componente.
4. **Notch, overlay, mascote, easter egg, landing, conquistas**: fora de escopo por padrão. `OverlayApp` e `DesktopNotch` somam mais de 180 desvios.

## Sugestões, por prioridade

1. **Acessibilidade (crítico).** Rodar o `impeccable audit` numa tela por vez, começando por Configurações e Home, e revisar os 7 `outline-none` sem foco visível. Garantir foco visível para controle e teclado em todo botão (o foco é "o elemento mais forte da tela" no `DESIGN.md`).
2. **Um componente de botão e um de modal.** Hoje cada tela monta o botão com classes soltas (536 `<button>`). Um `Button` com variantes (primário, secundário, perigo, fantasma) e tamanhos, e `ModalShell` como único caminho para sobreposições, fecham a maior parte do que o passe mecânico faz à mão. Cinco modais ainda têm animação própria.
3. **Escala de movimento única.** Usar só os tokens `--duration-*` e `--ease-*`; `SectionTransition` para troca de abas e filtros em todas as telas.
4. **Tela de Mods e Configurações no estilo de Amigos** (abas deslizantes, cartões sem contorno). Configurações já ganhou os tokens; falta a estrutura.
5. **Estados vazios, de erro e de carregamento** com o mesmo tratamento (hoje cada tela escreve o seu).
6. **Teste de renderização** (jsdom ou Playwright em `e2e/`) para pegar erros como o de acessar um estado antes de declarar, que o typecheck não pega.

---

# Auditoria Impeccable (`/impeccable audit`, 28/10/2026)

Detector oficial (`impeccable detect src`: 305 achados, 7 deles não consultivos) mais verificações dirigidas. Nada foi corrigido nesta passada. Pontuação: **12/20 (Aceitável)**: Acessibilidade 2, Desempenho 2, Tema 2, Responsivo 3, Integridade 3.

## Achados P1
- **Controles clicáveis sem teclado**: `ParticipantContextMenu.tsx:144-151` usa `<span onClick>` para os presets de volume (0, 100, 200%). Sem `role`, `tabIndex` nem tecla. WCAG 2.1.1. Usar `<button>`.
- **`outline-none` sem foco visível** em `Login.tsx`, `ModalShell.tsx`, `HomeTopNav.tsx`, `ProfileDropdown.tsx`, `ConsoleTrophyList.tsx`, `ui/Shandc/toast.tsx`. WCAG 2.4.7; para controle e teclado o foco é o elemento mais forte da tela.
- **Campos sem rótulo programático**: 34 de 80 `<input>` sem `aria-label`, `aria-labelledby` ou `id` na própria tag (parte deles pode estar dentro de `<label>`: verificar um a um, começando por `LibraryFilterModal`, `AdvancedLaunchSettings`, `GameDetailAchievements`, a busca do Perfil). WCAG 1.3.1 e 4.1.2.

## Achados P2
- **Movimento reduzido apaga o feedback**: `index.css:1242-1259` zera `animation-duration` e `transition-duration` (0,01 ms) em tudo, tanto em `prefers-reduced-motion` quanto no modo de baixo desempenho. Troca de estado deixa de ter qualquer transição; o certo é manter fade curto e tirar só o deslocamento.
- **Vídeo de fundo não respeita movimento reduzido** [INFERIDO: `PVideoBackground` só olha `lowPerformanceMode`], e agora roda em loop contínuo (decisão desta sessão), sem a medição de quadros que o desligava em máquina lenta.
- **Degradê em texto** em `Login.tsx:113`, `DesktopAuth.tsx:58` e `LevelUpModal.tsx:800` (`bg-clip-text` + `bg-gradient`); **paleta roxa** em `CallSettingsPopover.tsx:203` (`from-purple-950`), que a troca de tokens das chamadas não pegou; **borda lateral colorida** em `TrophyHistoryTimeline.tsx:301`.
- **Deriva do design system**: 289 consultivos (158 cores, 109 tamanhos de fonte, 22 raios fora do `DESIGN.md`), concentrados em `index.css` (65), overlay (75), notch (30) e `LevelUpModal` (21). As cores mais repetidas (`#fff`, `#38bdf8` da platina, brancos translúcidos) mostram que o `DESIGN.md` está atrás do código: documentar ou transformar em token.
- **Orçamento de efeitos**: 111 usos de `backdrop-blur`, 101 animações infinitas (`animate-pulse/bounce/ping`) e 215 `transition-all` convivendo com o vídeo em loop.

## Achados P3
- 9 easings com quique (`animate-bounce` em `CallHeader`, `VoiceCallBar`, `VoiceOnlyStage`, `DesktopNotch` e 5 em `index.css`).
- Cor crua restante: 246 nomeadas, 1314 de branco/preto translúcido e 217 hex em classe, quase todas em notch, overlay, easter egg e landing (fora de escopo) e nas telas ainda não redesenhadas.
- Arrastes por ponteiro sem `touch-action` em `GameCard` e `OverlayApp` (o app é só para Windows, então só importa com tela de toque).
- Falsos positivos do detector: `overused-font` (Inter e Geist Mono são escolha fixada no `DESIGN.md`).

## Pontos fortes
15 diálogos com `role`, 12 com `aria-modal`; 285 `focus-visible` contra 152 `outline-none`; 67 pontos que respeitam movimento reduzido no TSX; nenhuma imagem sem `alt`; transições compartilhadas (`SectionTransition`, `ModalShell`, abas deslizantes) e tokens consistentes nas telas redesenhadas.

## Próximos passos
1. P1 de teclado e rótulos. 2. Revisar o bloco de movimento reduzido. 3. Decidir o orçamento de efeitos (vídeo, blur, animações infinitas). 4. Atualizar o `DESIGN.md` com as cores que o código já usa. 5. `/impeccable polish` por tela.

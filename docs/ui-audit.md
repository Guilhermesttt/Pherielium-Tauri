# Auditoria de interface do app inteiro (2026-10-13)

Método: contagem por busca no código de `src/` (sem executar o app) mais leitura dos arquivos grandes. Números marcados **[medido]**; o que depende de ver a tela está marcado **[inferido]**.
Escopo: 249 arquivos `.tsx`, cerca de 114 mil linhas de TypeScript, 9 páginas, 63 componentes na raiz, 40 em `components/ui`, 9 temas visuais.

## 1. O retrato

| Medida | Valor | O que diz |
| --- | --- | --- |
| Cores `#rrggbb` escritas nos componentes | **817 usos, 257 cores distintas** [medido] | Quase nada passa pelos tokens de tema; trocar o tema ou o estilo não alcança a maior parte da tela |
| Raios `rounded-[Npx]` | 159 usos, **18 valores** (10, 22, 14, 28, 12, 18, 24, 20, 9, 32...) mais `rounded-xl/2xl/lg/full` | Cantos sem escala; 2 a 3 valores resolveriam |
| Tamanhos `text-[Npx]` | **853 usos, 33 tamanhos**; 11 px (217) e 10 px (209) lideram, com 9 px (51) | Texto muito pequeno e sem escala; abaixo de ~12 px cansa e some em TV/10 pés |
| Sombras `shadow-[...]` arbitrárias | 244 usos, **167 valores distintos** | Elevação sem sistema |
| `backdrop-blur` | **130 usos** [medido] | Custo de GPU alto (relatado por você: o hub pressiona a placa) |
| Gradientes | 170 usos | Muita decoração; conflita com "minimalismo" |
| Fontes | `font-mono` 117, `font-display` 84; todas as variáveis `--font-*` apontam para Inter | Hierarquia tipográfica quase só por tamanho e peso |
| `className` com mais de 200 caracteres | 183 | Estilo copiado de componente em componente |
| Modais próprios com `fixed inset-0` | **38** (contra 17 usos do `ModalShell`) | Modais com comportamentos diferentes (fechar com Esc, foco preso, animação) |
| `z-index` arbitrários | 28 valores distintos (`99999`, `9999`, `300`, `200`, `100`...) | Risco de sobreposição errada |
| `<img>` | 124, com `loading="lazy"` em 17 | Imagens abaixo da dobra carregam de uma vez |
| `framer-motion` | 94 dos 249 arquivos | Animação em toda parte, sem curva comum (corrigida só nos `transition` do Tailwind) |
| Arquivos enormes | `Home.tsx` 4.698 linhas, `SettingsPage.tsx` 3.922, `OverlayApp.tsx` 2.654, `AddGameModal.tsx` 2.337, `ModGameDetailPanel.tsx` 1.942, `DesktopNotch.tsx` 1.836 | Mudar o visual de uma tela exige mexer em arquivos de milhares de linhas |
| Texto em português direto no JSX | cerca de 119 trechos soltos [aproximado] | Mistura com o sistema `t("...")` (259 usos) |

Pontos fortes que já existem: sistema de tokens de tema (`--surface-*`, `--radius-*`, `--motion-*`), 9 temas, navegação por gamepad, foco visível global, `prefers-reduced-motion` global, `ModalShell`, `Switch`, `Squircle`.

## 2. O que pode mudar, por área

### Sistema de design (a base de tudo)
1. **Escala única** de texto (12, 14, 16, 24, 40 e 72), de cantos (12 e 20) e de elevação (3 degraus). Mover os 853 `text-[Npx]` e 159 raios para classes semânticas. Impacto: grande; esforço: médio (script de migração + revisão).
2. **Cores pelo tema**: trocar os 257 hex por variáveis (`--surface-*`, `--accent`, `--rarity-*`). Sem isso nenhum tema ou estilo novo "pega" por inteiro.
3. **Tipografia com papéis**: títulos/numerais, interface, HUD condensado (proposta em `docs/design-direction.md`).
4. **Camada de z-index** com 6 níveis nomeados (conteúdo, barra, painel, modal, toast, sistema) no lugar de 28 números.

### Estrutura e navegação
- `Home.tsx` é o shell inteiro (abas Início, Favoritos, Amigos, Troféus, Mods, Feed, Configurações em um arquivo de 4,7 mil linhas). Dividir em shell + uma rota por seção melhora a performance, o foco por controle e permite transição de página.
- Transição entre seções com a mesma curva do sistema (hoje cada tela anima do seu jeito).
- Barra superior mais limpa: uma ação principal por contexto; o restante em menu.

### Por tela
| Tela | Mudança de maior valor |
| --- | --- |
| **Início / Biblioteca** | Um herói por vez (jogo em foco) e trilhos; acento tirado da arte do jogo; menos texto de 10 px nos cartões |
| **Janela de chamada** | Spotlight no falante, dock enxuto, modo HUD compacto com o jogo aberto, indicador de ping (a base de qualidade já foi feita) |
| **Troféus** | Herói com o próximo troféu e anel de progresso; cores de nível idênticas às do notch; filtros em chips |
| **Configurações** | Busca de ajustes (Ctrl+K) e trilho lateral por grupo; remover cartões dentro de cartões; 3.922 linhas em um arquivo viram uma página por grupo |
| **Mods** | Cartões com arte grande e estado; lista funcional (os dois botões de visualização não têm ação hoje); perfis por jogo em chips |
| **Amigos / Chat** | Lista com presença e jogo atual em uma linha; mensagens com o mesmo cartão para convites (já legível); estados vazios desenhados |
| **Login / primeira execução** | Menos passos e uma única ação por tela (`Login.tsx` tem 1.106 linhas e `WelcomeModal.tsx` 1.019) |
| **Notch / overlay** | Perfis ("Jogando", "Streaming", "Silencioso"), escolha de monitor/canto, ping da chamada |

### Movimento
- Curva e duração já unificadas nos `transition` do Tailwind (estilo refined). Falta unificar as molas do `framer-motion` (94 arquivos) em 3 presets: *snappy* (controles), *smooth* (painéis), *gentle* (heróis).
- Entradas escalonadas nas listas (60 a 90 ms) e transição compartilhada capa → detalhe do jogo.

### Desempenho visual (GPU)
- Reduzir e padronizar os 130 `backdrop-blur`: um nível único (e só em 3 superfícies: menu, painel lateral, modal) e `will-change` só durante a animação.
- Gradientes decorativos (170) e sombras longas animadas custam VRAM; cortar os que não carregam informação.
- `loading="lazy"` e dimensões nas 107 imagens restantes; virtualizar listas acima de ~50 itens (Troféus, Mods, Biblioteca) [inferido, confirmar tamanho real das listas].
- Modo "leve" automático quando um jogo está aberto: sem blur, sem animação contínua, mascote parado (parte disso já existe no notch).

### Acessibilidade
- Texto abaixo de 12 px: subir o piso para 12 px e contraste mínimo 4,5:1 (o texto secundário `white/40` e `white/50` em fundo escuro precisa ser medido).
- Modais próprios: prender o foco, fechar com Esc, devolver o foco. Padronizar nos 38 usando `ModalShell`.
- Áreas clicáveis sem alternativa de teclado (por exemplo as do notch); `aria-live` para avisos assíncronos.
- Português solto no JSX para dentro do `t()`; permite um segundo idioma sem retrabalho.

### Qualidade do código de UI
- Componentes primitivos que faltam em `components/ui`: `Card`, `Row` de configuração (existe copiado em pelo menos duas telas), `Chip`, `Segmented`, `Slider`, `EmptyState`, `Dialog` único. Cada tela passa a montar com peças, não com classes de 200 caracteres.
- Documentar tokens e primitivas em uma página (Storybook ou uma rota interna de desenvolvimento) para validar visualmente cada mudança.

## 3. Ordem recomendada (valor para risco)
| # | Fatia | Por quê agora | Esforço |
| --- | --- | --- | --- |
| 1 | Escala de texto, raios e sombras como tokens + migração por script | Sem isso, qualquer redesenho é tentativa e erro | 2 a 3 dias |
| 2 | Padronizar os 38 modais no `ModalShell` e a camada de z-index | Comportamento consistente e menos bugs de sobreposição | 1,5 dia |
| 3 | Orçamento de blur e gradientes (modo leve em jogo) | Ataca o problema de GPU que você relatou | 1 a 2 dias |
| 4 | Janela de chamada: spotlight e HUD | Alta visibilidade, base técnica já pronta | 2 dias |
| 5 | Troféus: herói e cores unificadas com o notch | Vitrine do app | 1,5 dia |
| 6 | Configurações: busca e trilho lateral, quebrar o arquivo | Maior arquivo de UI depois da Home | 2 a 3 dias |
| 7 | Mods: cartões com arte e lista funcional | Fecha controles que não fazem nada | 1,5 dia |
| 8 | Dividir `Home.tsx` em rotas com transição | Ganho de desempenho e de navegação por controle | 3 a 5 dias |
| 9 | Cores pelo tema (817 hex) | Habilita o acento dinâmico por jogo e todos os temas por inteiro | 3 dias |

## 4. O que não dá para decidir sem ver a tela
Hierarquia real de cada tela, quais gradientes e blurs são essenciais e como o app se comporta em TV/4K. Recomendo rodar o app com a flag de desenvolvimento e me mandar capturas (Início, Biblioteca, Chamada, Troféus, Configurações, Mods) para cada fatia.

# Direção de design do hub (Gaming OS): recomendação

Feita com as skills **Web Design Guidelines** (auditoria das regras de interface) e **Taste Skill** (decisões de direção, tipografia e hierarquia).
Nada aqui exige mudar o app de uma vez; cada item pode virar uma fatia com aprovação. Itens marcados **(precisa de OK)** acrescentam dependência ou token novo, o que o projeto proíbe sem aviso.

## 1. Auditoria (Web Interface Guidelines)
Arquivos: janela de chamada (`VoiceCallWindow` e `call-window/*`), Troféus, Configurações, Notch e Mods.

| Regra | Estado |
| --- | --- |
| Foco visível | Já existe globalmente em `src/index.css` (`:focus-visible` com anel na cor de destaque) |
| `prefers-reduced-motion` | Já existe globalmente em `src/index.css` |
| Botões só de ícone sem rótulo | Corrigidos: fechar configurações da chamada, limpar busca de troféus, dois controles deslizantes de voz |
| `transition: all` | Troquei por `transition` em 39 pontos (só cor, opacidade, sombra e transformação animam); 2 ficaram porque animam tamanho (`SettingsPage.tsx:3383`, `ModGameDetailPanel.tsx:1700`) |
| Fundo clicável sem semântica | Marcado `aria-hidden` no fundo do popover de chamada |
| Controle que não fazia nada | **Filtro de categoria de Mods** só tinha "Todas"; agora filtra de verdade |
| Pendências (não mexi) | `DesktopNotch.tsx:1419` e `:1536` são áreas clicáveis do notch sem equivalente de teclado (há atalhos globais, mas não alternativa focável); lista de Troféus e de Mods sem virtualização acima de ~50 itens (confirmar) |

## 2. O que a Taste Skill diz e onde NÃO se aplica
A skill é feita para **páginas de marketing**. Duas das regras dela batem de frente com o hub e eu **não as apliquei**:
- "Sem vidro, sem gradiente, sem sombra, sem fonte monoespaçada, sem rótulos pequenos em caixa alta." O hub inteiro usa essas linguagens (e o `CLAUDE.md` manda usar só os tokens existentes). Tirá-las seria um redesenho completo, não um ajuste.
- "Sem anel de borda de 1px nem cartões repetidos." Um OS de jogos é, por natureza, uma grade de cartões.

O que **vale** e foi usado como critério: hierarquia por escala (uma coisa muito maior que o resto), um acento só, conteúdo completo em vez de seções vazias, blocos diferentes lado a lado em vez de repetição, e a ideia vir do assunto (aqui: o **jogo**, a **conquista**, o **grupo de amigos**).

## 3. Estilo de UI/UX recomendado: "Console Shell + HUD"
Em vez de painéis de site, a interface se comporta como o shell de um console:

1. **Uma tela, um herói.** Cada janela abre com uma coisa dominante (o jogo em foco, o troféu mais próximo, quem está falando) que ocupa metade da altura; o resto são trilhos (rails) horizontais de cartões.
2. **Foco primeiro (controle e teclado).** O app já tem navegação por gamepad. O foco precisa ser o elemento mais forte da tela: anel grosso, leve escala (1,03) e a arte do cartão ganhando brilho. Mouse é o caso secundário.
3. **Cor vem do jogo.** O acento da tela muda para a cor dominante da arte do jogo em foco (uma cor por vez), em vez de um acento fixo. Fundo neutro escuro, separação por degraus de tom, não por bordas.
4. **Dois modos de densidade.** *Shell* (grande, 10 pés, legível de longe) para Início, Biblioteca, Mods e Troféus. *HUD* (compacto, números condensados) para chamada, notch e overlay dentro do jogo.
5. **Movimento curto e com mola.** 120–220 ms, só transformação e opacidade, com versão sem movimento.
6. **Estados completos.** Carregando, vazio, erro e "sem permissão" desenhados, não só o caso feliz.

### Tokens propostos (precisa de OK; hoje não existem)
| Token | Proposta |
| --- | --- |
| `--accent-game` | cor extraída da arte do jogo em foco, com contraste mínimo 4,5:1 sobre o fundo |
| Raio | 2 valores só: 12 px (controles) e 20 px (cartões); hoje há vários (10, 14, 16, 18, 22, 26, 28) |
| Escala de texto | 12 / 14 / 16 / 24 / 40 (clamp) / 72 (numerais de herói) |
| Elevação | 3 degraus de tom de fundo; sombra só em menus e diálogos |

## 4. Fontes
Hoje **todas as variáveis de fonte do app apontam para Inter** (`--font-display`, `--font-heading`, `--font-title`, `--font-ui`... em `src/index.css:629-642`); só o Unbounded e o Archivo Black aparecem em trechos pontuais. Ou seja, não há hierarquia tipográfica.

| Papel | Recomendação | Por quê |
| --- | --- | --- |
| Interface e texto | **Inter Variable** (já instalada) com `font-variant-numeric: tabular-nums` | Legível pequeno; números alinhados em placares e contagens |
| Títulos e numerais de herói (nível, rank, nome do jogo) | **Chakra Petch** (600/700) | Ângulos de "interface de jogo" sem virar fantasia; boa leitura em 24–72 px |
| HUD denso (chamada, notch, overlay, estatísticas) | **Barlow Condensed** (500/600) | Condensada, números largos legíveis em pouco espaço |
| Marca e momentos de abertura | **Unbounded** (já instalada), só no logotipo e na tela de abertura | Mantém a assinatura atual, sem espalhar |

Alternativas se preferir menos "gamer": **Sora** (geométrica larga) para títulos, ou **Space Grotesk**.
**(precisa de OK)** Chakra Petch e Barlow Condensed são pacotes novos `@fontsource/*` (licença OFL, fonte livre); a Inter e a Unbounded já estão no projeto. Instalar também mexe no `package.json` e no tamanho do instalador (~50 a 100 KB por peso).

## 5. Janela por janela (propostas; o que já foi feito vem marcado)
**Janela de chamada.**
- Feito: aviso de conexão ruim por participante; religar sozinho; contador de espectadores; qualidade "Fonte"; bitrate escolhido.
- Proposta: *spotlight* no falante (cartão grande) com o resto em faixa; dock de controles com rótulo curto no foco; modo HUD compacto quando o jogo está aberto; indicador de latência (ms) discreto ao lado do nome.

**Troféus.**
- Proposta: herói com o próximo troféu mais raro e barra de progresso em anel; cores de nível iguais às do notch (`achievementTier.ts`) para um troféu parecer o mesmo em todo lugar; filtros como chips; linha do tempo agrupada por jogo.

**Configurações.**
- Proposta: busca de configurações (Ctrl+K) e trilho lateral com grupos (Conta, Chamadas, Notch, Controle, Avançado); trocar cartões aninhados por seções separadas por degrau de tom; botões de ação sempre à direita, perigosos em vermelho e com confirmação.

**Notch.**
- Feito: escolher quais avisos informativos aparecem e por quanto tempo ficam (0,5x a 2x).
- Proposta: perfis ("Jogando", "Streaming", "Silencioso") que trocam várias opções de uma vez; escolher o canto/monitor; mostrar ping da chamada no modo compacto.

**Mods.**
- Feito: filtro de categoria que funciona, filtros "Sem pasta", "Com mods ativos", "Sem mods", ordenações "Mais mods ativos" e "Pasta vinculada primeiro", filtros lembrados.
- Proposta: cartão com arte grande e estado (pasta, mods ativos, atualização disponível); perfis de mods por jogo em chips; visualização em lista funcional (o botão de lista hoje não faz nada, `ModsPage.tsx` perto da barra de ferramentas).

## 6. Ordem sugerida
1. Fontes e escala de texto (tokens, 1 dia, precisa de OK).
2. Janela de chamada: spotlight + HUD compacto (2 dias).
3. Troféus: herói e cores unificadas com o notch (1,5 dia).
4. Configurações: busca e trilho lateral (2 dias).
5. Mods: cartões com arte e lista funcional (1,5 dia).
6. "Cor do jogo" como acento dinâmico (1 dia, depende de 1).

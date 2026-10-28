---
name: Pherielium
description: "Hub de jogos no estilo Gaming OS: cinza-carvão fosco, profundidade por degrau de tom e botões preenchidos sem contorno, e o jogo como única coisa que brilha (na Home e na tela do jogo, a arte nítida é a própria tela, como num console, com a tinta como único destaque)."
colors:
  chrome-black: "#000000"
  charcoal-base: "#0A0A0A"
  charcoal-deep: "#111111"
  charcoal-raised: "#171717"
  charcoal-overlay: "#262626"
  charcoal-line: "#373737"
  graphite: "#525252"
  ash: "#8A8A8A"
  ink: "#f5f5f7"
  ink-muted: "#D4D4D4"
  ink-faint: "#959595"
  live-green: "#30d158"
  screen-error: "#ff8a80"
  danger-red: "#ff453a"
  tier-iron: "rgb(148 155 163)"
  tier-bronze: "rgb(205 127 50)"
  tier-silver: "rgb(203 209 220)"
  tier-gold: "rgb(245 176 36)"
  tier-platinum: "rgb(125 249 255)"
typography:
  display:
    fontFamily: "'Inter Variable', 'Inter', system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 4vw, 4.5rem)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  screen-title:
    fontFamily: "'Inter Variable', 'Inter', system-ui, sans-serif"
    fontSize: "calc(clamp(2.5rem, 4.4vw, 6.5rem) * 0.5)"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "'Inter Variable', 'Inter', system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "'Inter Variable', 'Inter', system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.022em"
  section-heading:
    fontFamily: "'Inter Variable', 'Inter', system-ui, sans-serif"
    fontSize: "clamp(1.0625rem, 0.95vw, 1.625rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "'SF Pro Text', 'SF Pro Display', -apple-system, 'Inter Variable', 'Inter', 'Segoe UI Variable Text', sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "-0.011em"
  label:
    fontFamily: "'SF Pro Text', 'SF Pro Display', -apple-system, 'Inter Variable', 'Inter', 'Segoe UI Variable Text', sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "-0.011em"
  console-label:
    fontFamily: "'SF Pro Text', 'SF Pro Display', -apple-system, 'Inter Variable', 'Inter', 'Segoe UI Variable Text', sans-serif"
    fontSize: "clamp(0.8125rem, 0.62vw, 1.0625rem)"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "0.08em"
  metric:
    fontFamily: "'Geist Mono Variable', ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0"
  stat-number:
    fontFamily: "'Geist Mono Variable', ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: "calc(clamp(1.0625rem, 1vw, 1.75rem) * 1.5)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "0"
    fontFeature: "'tnum' 1"
rounded:
  key: "8px"
  console-tile: "14px"
  control: "12px"
  card: "20px"
  panel: "28px"
  radius-card: "30px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
  safe-x: "clamp(24px, 2.5vw, 72px)"
  safe-y: "clamp(20px, 2.5vw, 72px)"
  gap-section: "clamp(16px, 1.6vw, 44px)"
  console-gap: "clamp(10px, 0.8vw, 20px)"
  console-shadow-room: "34px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.charcoal-base}"
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "0 24px"
  button-secondary:
    backgroundColor: "{colors.charcoal-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "0 20px"
  console-tile:
    backgroundColor: "{colors.charcoal-raised}"
    rounded: "{rounded.console-tile}"
    height: "clamp(96px, calc(20px + 10vh), 170px)"
    width: "clamp(96px, calc(20px + 10vh), 170px)"
  console-tile-focused:
    rounded: "{rounded.key}"
    height: "calc(clamp(96px, calc(20px + 10vh), 170px) * 1.3)"
    width: "calc(clamp(96px, calc(20px + 10vh), 170px) * 1.3)"
  console-key:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.key}"
    padding: "1px 6px"
  console-bumper:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.key}"
    height: "18px"
    padding: "0 6px"
  console-tab-item:
    textColor: "{colors.ink-muted}"
    typography: "{typography.console-label}"
    rounded: "{rounded.control}"
    height: "calc(clamp(34px, 1.9vw, 52px) - 12px)"
    padding: "0 12px"
  console-tab-item-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.charcoal-base}"
    rounded: "{rounded.control}"
  console-chip:
    backgroundColor: "{colors.charcoal-overlay}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "clamp(34px, 1.9vw, 52px)"
    width: "clamp(34px, 1.9vw, 52px)"
  console-chip-hover:
    backgroundColor: "{colors.charcoal-line}"
  console-start:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.charcoal-base}"
    typography: "{typography.console-label}"
    rounded: "{rounded.card}"
    height: "calc(clamp(48px, 2.9vw, 76px) * 1.2)"
    padding: "0 calc(clamp(48px, 2.9vw, 76px) * 0.4)"
  console-progress-fill:
    backgroundColor: "{colors.ink}"
    height: "4px"
  console-options:
    backgroundColor: "{colors.charcoal-deep}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.key}"
    padding: "4px"
  console-achievement:
    backgroundColor: "{colors.charcoal-deep}"
    textColor: "{colors.ink}"
    rounded: "{rounded.key}"
    padding: "12px"
  card-library:
    backgroundColor: "{colors.charcoal-base}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  panel-menu:
    backgroundColor: "{colors.charcoal-raised}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.card}"
    padding: "6px"
  switch-track-on:
    backgroundColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "32px"
    width: "52px"
  switch-track-off:
    backgroundColor: "{colors.charcoal-line}"
    rounded: "{rounded.pill}"
    height: "32px"
    width: "52px"
---

# Design System: Pherielium

## Overview

**Creative North Star: "O Carvão Fosco"**

O Pherielium é um shell de jogos que se comporta como o sistema de um console: calmo,
concentrado e silencioso. Tudo é cinza-carvão fosco; a energia vem do conteúdo, não da interface.
As capas dos jogos, os troféus e os amigos ao vivo são o que brilha. A interface existe para levar
ao jogo, então recua, e quando aparece usa tinta cheia e formas arredondadas e contínuas.

A profundidade nunca vem de sombra decorativa. Cada superfície é um degrau de luminosidade acima da
anterior, separada por uma borda interna de 1 px (um "hairline"). A forma da marca (um nó circular
ligado por uma haste) vira a linguagem do sistema: botões em pílula, pontos de estado com anel, o
anel de foco. O movimento é curto e com mola, no ritmo do iOS, e some com "reduzir movimento".

Na Home e na tela do jogo, o carvão fosco vira a **tela inicial de um console**: a arte do jogo em
foco é a própria tela, nítida e de ponta a ponta, e a interface é fina, em caixa alta pequena, e fica
nas bordas. A Home tem uma barra de duas linhas (marca, hora, menu, busca e perfil em cima; as abas
da biblioteca embaixo) e uma fileira de capas quadradas em que a focada cresce 1,3× sem anel, com o
nome da loja logo abaixo; o nome do jogo não é desenhado, a arte e a capa já o dizem. Ao abrir um
jogo, a arte fica no lugar e a interface sobe. Aqui o destaque é sempre a **tinta**: o bloco de
tinta que desliza para a aba ativa, o "Iniciar o jogo" em tinta cheia, o item de conquista em foco
com um preenchimento claro. A direção foi pinada pelo usuário a partir do conceito de interface de PS5 de
Paweł Durczok (Dribbble), e empresta só estrutura e movimento: nenhuma marca, ícone ou arte da
PlayStation, e as cores são as da escala Dark do projeto (o azulado do conceito foi recusado). A Home
"fliperama depois do expediente" (letreiro e gabinetes) e as paredes de pôsteres saíram do código e
não servem de referência. A Home mínima continua como layout alternativo.

O sistema é multitemas: cada tema sonoro (PS5, PS4, PS2, Xbox, GameCube, Cyberpunk) pode redefinir
as superfícies, mas o tema padrão (Pherielium) é o carvão neutro descrito aqui, e é o que o código
chama de estilo "refinado". Os outros temas herdam a mesma estrutura (inclusive a Home e a tela do
jogo estilo console) trocando só as superfícies: `--tone-0..4` passam a derivar de `--surface-*` do tema.

**Key Characteristics:**
- Monocromático em escada de cinzas; um único acento de cor, o verde "ao vivo".
- Profundidade por tom e hairline, sem sombra em repouso.
- Cantos contínuos (squircle) em tudo: controles em `--corner-sm`, cartões em `--corner-md`/`--corner-lg`, capas e itens do console em 14 px; só pontos de estado e avatares redondos; nunca cantos retos.
- Tinta cheia para tudo o que se lê; piso de 13 px.
- Na Home e na tela do jogo, a arte do jogo em foco é o fundo, nítida e de ponta a ponta; véus só onde há interface.
- Na Home, a capa quadrada focada cresce 1,3× para cima, sem anel, com a loja escrita embaixo; ao abrir, a arte fica e a interface sobe.
- No console, o destaque é o preenchimento de tinta (nunca contorno); caixa alta pequena para abas, rótulos e dicas.
- Mola curta; reduzir movimento respeitado.

## Colors

Uma escada de cinzas neutros quase sem matiz (a escala Dark pinada), com tinta branca fria por cima, um verde só para "ao vivo" e as cores de tier só nos troféus.

### Primary
- **Tinta Branca Fria** (`--ink`): todo texto principal e o destaque do sistema: fundo do botão primário em pílula, anel de foco, bloco da aba ativa (Home, tela do jogo, Amigos, Troféus e Perfil), cursor do item de conquista em foco, preenchimento da barra de troféus e o "Iniciar o jogo". É a "cor de ação"; por ser a mais clara, é naturalmente rara em cada tela.

### Secondary
- **Cores de Tier** (`--tier-iron`, `--tier-bronze`, `--tier-silver`, `--tier-gold`, `--tier-platinum`): ferro, bronze, prata, ouro e platina dos troféus. Vivem só dentro de troféus e conquistas (os valores espelham `TIER_STYLES`, guardados por teste). Nunca pintam a interface; a barra de progresso de troféus da tela do jogo é em tinta, não em tier.

### Tertiary
- **Verde Ao Vivo** (`--live`): o único acento de cor da interface. Só para estado ativo em tempo real (online, falando, transmitindo, em chamada; na tela do jogo, o ponto em "Em execução" e o número de amigos jogando). Nunca decorativo.
- **Vermelho de Erro** (`--screen-error`): só o aviso de falha ao iniciar, na tela do jogo, claro o bastante para ler sobre a arte escurecida. Não é acento: é o estado de erro e some quando o erro some.

- **Vermelho de Perigo** (`--danger`, #ff453a): ação destrutiva e estado "desligado de propósito": desligar a chamada, microfone mutado, "Não perturbe" ativo, remover amigo. Nunca decorativo; sempre acompanhado de ícone ou texto.

### Neutral
- **Preto Base** (`--gray-0` / `--surface-base`): o fundo absoluto do app no tema padrão, também do notch e da barra de título (`--chrome-black`) e a cor dos véus da arte na Home. Nos outros temas o preto absoluto continua exclusivo do notch e da barra de título.
- **Carvão Base** (`--gray-1` / `--tone-0`): superfície dos cards e containers mais profundos, um degrau acima do preto de fundo; é também o fundo e a cor do véu da tela do jogo, e o texto sobre tinta (aba ativa, "Iniciar" aceso).
- **Carvão Fundo** (`--tone-1`): degrau intermediário entre base e elevado; fundo dos itens de conquista recente e do menu Opções (a 94%).
- **Carvão Elevado** (`--gray-2` / `--tone-2`): cards, painéis, campos, o corpo da capa sem arte o corpo da capa sem arte na Home e a base dos botões pequenos e das teclas sobre a arte (a 80–85%).
- **Carvão Sobreposto** (`--gray-3` / `--tone-3`): menus, botões secundários preenchidos, hover de linha e das abas, teclas de dica.
- **Linha de Carvão** (`--gray-4` / `--tone-4`): trilha de interruptor desligado, divisores fortes, hover dos botões preenchidos e o degrau de "selecionado" nas listas.
- **Grafite** (#525252) e **Cinza Cinza** (#8A8A8A): bordas em hover e estados desabilitados.
- **Tinta Suave** (`--ink-muted`, escala 700): texto secundário (cerca de 14:1 sobre o preto), abas inativas, rótulos dos números, a loja sob a capa focada, a hora, as dicas de tecla. Fica perto da tinta principal; a hierarquia vem de tamanho e peso, não só de tom. A escala também define o passo 800 (#E5E5E5, `--gray-9`), ainda sem uso na interface.
- **Tinta Apagada** (`--ink-faint`): rótulos e legendas (4,6:1, o piso de legibilidade), como o nome do jogo sobre cada conquista.

### Named Rules
**A Regra da Única Cor.** O verde ao vivo é o único acento da interface. Cada tela tem no máximo uma cor além do cinza, e ela só significa "agora, ao vivo"; as cores de tier ficam dentro dos troféus e o vermelho só aparece com um erro. O resto da cor vem da arte dos jogos.
**A Regra do Degrau.** Superfície mais alta = tom mais claro (base → elevado → sobreposto). Nunca separar camadas com sombra; use o próximo degrau ou um hairline.
**A Regra da Tinta Cheia.** Texto que se lê usa `--ink`, `--ink-muted` ou `--ink-faint`; nunca branco com opacidade baixa sobre cinza.

## Typography

**Display Font:** Inter Variable (com Inter e system-ui)
**Body Font:** SF Pro Text (com SF Pro Display, Inter Variable e Segoe UI Variable Text de reserva)
**Label/Mono Font:** Geist Mono Variable (com ui-monospace e Cascadia Mono)

**Character:** Inter para títulos, apertada e firme; a SF Pro no corpo quando o sistema a tem (a fonte da Apple é proprietária e não vai no app), caindo na Inter embutida; mono só para números que o jogador compara.

### Hierarchy
- **Display** (700, `clamp(2.75rem, 4vw, 4.5rem)`, 1.02, -0.04em): o título grande de outras telas; um por tela.
- **Título da tela do jogo** (600, `--fs-hero` × 0,5, 1.04, -0.04em): o nome do jogo na tela do jogo, numa linha só, cortado com reticências, no mesmo tamanho no modo lista e fora dele. A loja vai acima, em Rótulo de console.
- **Headline** (600, 2rem, 1.1, -0.03em): títulos de seção ("Biblioteca").
- **Title** (600, 1.375rem, 1.2, -0.022em): títulos de painel e de cartão grande.
- **Rótulo de console** (700, `--fs-label`, caixa alta, 0,04 a 0,08em): abas da Home e da tela do jogo (0,04em), loja sob a capa focada, rótulos dos números e loja acima do título (0,08em), "Iniciar o jogo" (0,06em) e as dicas de tecla (600, 0,06em). A Home não desenha o título do jogo; um texto só para leitor de tela (`aria-live`) anuncia a troca de foco.
- **Cabeçalho de seção** (600, `--fs-heading`, 1.1, -0.02em): cabeçalhos de bloco ("Continuar jogando", cartões de configuração).
- **Body** (400, 0.9375rem, 1.45): texto corrido e linhas de lista. Linhas curtas; não passar de ~65ch.
- **Label** (600, 0.8125rem, 1.45): botões, abas, rótulos e dicas de tecla. É o piso de tamanho do app.
- **Metric** (Geist Mono 400, 0.8125rem, números tabulares): horas jogadas, ping, FPS, contagens, a porcentagem de troféus, datas e raridade das conquistas.
- **Número grande** (Geist Mono 600, 1,5× `--fs-title`, 1.1, tabular): os números da tela do jogo ("23h 19m", "18/32"), com a unidade pequena (0,55em, peso 500, tinta suave) colada ao número e o rótulo em caixa alta (Rótulo de console) acima. Texto que não é número ("ontem") fica em fonte de corpo no tamanho `--fs-title`.

### Named Rules
**A Regra do Piso de 13.** Nenhum texto abaixo de 13 px (0,8125rem); passos de tipo: 13, 15, 17, 22, 32 e o display fluido. No estilo refinado, `--fs-label` e `--fs-caption` partem de 13 px.
**A Regra do Número em Mono.** Só números que o usuário compara usam `.font-metric`; o resto do texto nunca é mono.
**A Regra do Número Grande.** Na tela do jogo, cada número é uma leitura: rótulo pequeno em caixa alta em cima, número grande em mono tabular, unidade pequena em tinta suave. Leituras sem dado somem (sem conquistas, sem amigos jogando); nunca mostrar "—" ou zero de enfeite.

## Layout

Um shell de uma tela só: barra de título e barra superior fixas, sidebar de borda (gaveta) à esquerda,
gaveta de amigos à direita e a área central onde mora o conteúdo. A malha é a base 4/8 (4, 8, 12,
16, 20, 24, 32, 40, 48 px); a margem lateral e os espaços entre blocos crescem com a janela
(`--safe-x` de 24 a 72 px, `--safe-y` de 20 a 72 px, `--gap-section` de 16 a 44 px). Cada tela tem
uma coisa dominante e o resto fica em faixas.

**Home estilo console (layout padrão).** A arte do jogo em foco ocupa a tela inteira atrás de tudo;
a interface fica nas bordas, sem rolagem da página:
- **Barra superior em duas linhas**, com a margem lateral `--safe-x` e um respiro de 1,4× `--gap-section`
  entre elas. Linha 1: marca em círculo e a hora à esquerda; menu de ações da biblioteca (reticências:
  adicionar, filtrar, sincronizar), busca (círculo que cresce para a esquerda, até 360 px) e perfil à
  direita. Linha 2: as abas da biblioteca, alinhadas à esquerda.
- **Abas**: caixa alta pequena, a ativa num bloco de tinta que desliza até a aba clicada; chips Q e E (LB e RB com controle
  conectado) nas pontas e um "+" para criar coleção. Muitas abas rolam, com fade nas pontas.
- **Uma fileira de capas quadradas** (`--console-tile-h`, de 96 a 170 px; espaço `--console-gap`),
  dentro das margens laterais, ancorada na base. Na aba "Todos os jogos", os jogados recentemente vêm
  primeiro; nas outras abas, o recorte da aba. A trilha alinha pela base, então a capa focada (1,3×)
  cresce para cima.
- A fileira não rola à mão: anda pelo foco, e a capa focada é trazida para perto da esquerda com uma
  vizinha visível antes dela. A trilha reserva `--console-shadow-room` (34 px) embaixo para a sombra da
  capa focada e a loja escrita sob ela.
- **Embaixo à direita**, as dicas de tecla em caixa alta (somem abaixo de `md`, e com controle
  conectado a legenda do controle as substitui).

**Tela do jogo estilo console.** Ocupa a janela inteira, sobre a mesma arte:
- **Topo:** só o botão de voltar e a hora. A linha de abas (com Q e E nas pontas) fica acima do
  título, na coluna da esquerda.
- **Aba Jogar:** arte de ponta a ponta. Embaixo à esquerda: abas, loja, título e os números grandes.
  Embaixo à direita (até 380 px ou 34% da largura): progresso de troféus, "Iniciar o jogo", o menu
  Opções (quando aberto) e a linha de dicas (Opções, Selecionar, Voltar).
- **Modo lista** (descer na aba Jogar, ou qualquer outra aba): a arte recua para a coluna da direita
  (44%) e a coluna da esquerda (56%) rola, com as abas no topo dela, e mostra as conquistas recentes ou
  o conteúdo da aba. Progresso e Iniciar continuam embaixo à direita.

**Home mínima (layout alternativo).** Uma coluna que rola na vertical: um card de destaque de
280–320 px de altura e, logo abaixo, a grade da biblioteca em colunas de pelo menos 176 px com cards 2:3.

A Home fliperama (letreiro e gabinetes), o herói com carrossel e as paredes de pôsteres saíram do
código; não servem de referência.

Navegação por controle e teclado é de primeira classe: toda tela anda sem mouse, e o foco é o
elemento mais forte da tela. Telas pequenas escondem faixas secundárias antes de espremer o
conteúdo principal.

## Elevation & Depth

Plano por padrão. A profundidade vem de luminosidade (a escada de cinzas) e de um hairline interno
(`inset 0 0 0 1px rgb(255 255 255 / 0.06)`, e `0.12` na versão forte), não de sombra. No estilo
refinado o CSS zera a sombra em repouso de todo o app. A exceção estrutural são os painéis
flutuantes de vidro (`.panel-glass`: fundo elevado a 72% com `blur(20px)`), usados só em
sobreposições, porque vidro em tudo custa GPU. Sombras longas e suaves só aparecem em temas de
console específicos.

**A arte como tela.** Na Home e na tela do jogo a profundidade é a própria arte, nítida, com véus
só onde a interface fica:
- **Home:** arte a opacidade cheia, sem desfoque e sem brilho de cor derivado da capa. Véus em
  `--surface-base`: topo leve para a barra (70% → nada), esquerda para o texto (80% → 35% → nada) e
  base para a fileira (92% → 45% → nada, em 55vh).
- **Tela do jogo:** véus em `--tone-0`: esquerda (82% → 30% → nada), base (88% → nada) e topo
  (60% → nada). No modo lista a arte é só a coluna da direita e escurece só embaixo, onde ficam
  troféus e Iniciar.
- **Capa focada na Home:** sem anel; só uma sombra curta deslocada para baixo (até
  `0 14px 30px -8px rgb(0 0 0 / 0.85)`, que cresce e some junto com o foco, por mola) separa a capa
  da arte do fundo. É sombra de estado: só a focada tem.
- **Sobre a arte**, botões pequenos e teclas usam carvão sobreposto a 85–88%, preenchidos e sem
  contorno nem desfoque: legíveis em qualquer capa.

### Named Rules
**A Regra do Plano em Repouso.** Superfícies são planas. Sombra, quando existir, é resposta a estado (foco da capa ou elevação de painel flutuante), nunca decoração.
**A Regra da Arte como Tela.** Na Home e na tela do jogo, a arte do jogo em foco é o fundo: nítida, de ponta a ponta, sem desfoque nem brilho de cor. Só se escurece onde há interface. Toda luz da tela é a própria arte, nunca uma cor ou brilho da interface.

## Shapes

A forma vem do logo: o **nó** (pílula, 999 px) para botões, abas, chips redondos, switches e pontos de
estado, e cantos grandes e contínuos (squircle, a curva do iOS) para tudo o mais. Três cantos no app:
controle (12 px), cartão (20 px) e painel (28 px); cartões grandes de destaque usam `rounded-3xl`. No
tema padrão, `--radius-card` é 30 px. Onde o WebView2 suporta `corner-shape: squircle`, todo canto vira
contínuo; círculos e pílulas ficam redondos.

No console (Home e tela do jogo) as peças de conteúdo usam `--console-tile-radius` (14 px): a capa
quadrada, o item de conquista, o ícone da conquista e o menu Opções; as teclas de dica usam 8 px.
As peças de controle (botões, abas, busca, a caixa "Iniciar o jogo") usam `--corner-sm`/`--corner-md`,
squircle, e não mais pílula nem círculo. A barra de progresso de troféus (4 px) é uma cápsula.
Bordas são hairlines de 1 px em `--tone-3` ou `--tone-4`, ou ausentes quando o degrau de tom já separa.
O foco do console é um preenchimento, não um contorno: o bloco de tinta da aba ativa e o cursor claro do item de conquista.

## Components

Blocos táteis e silenciosos: botões preenchidos de canto squircle, cards de canto largo separados por tom, sem
borda pesada nem sombra.

### Buttons
- **Shape:** squircle de `--corner-sm` (12 px), 48 a 56 px de altura no app e nas chamadas; 40 px na barra do console.
- **Primary:** fundo tinta com texto carvão base, peso 600, padding 0 24 px; ícone de "play" preenchido à esquerda em "Jogar/Continuar". Quando o jogo está rodando, vira estado: o ícone dá lugar ao ponto verde ao vivo e o texto a "Em execução", desabilitado.
- **Hover / Focus:** cresce a 1.03 no hover e encolhe a 0.97 ao pressionar (mola curta); foco = anel de 2 px em tinta, afastado 2 px, sobre qualquer fundo.
- **Secondary / Ghost:** fundo `--tone-3`, sem borda, texto tinta; no hover sobe para `--tone-4`. Perigo: fundo `--danger` com texto carvão base, ou `--danger` a 20% com texto `--danger` para estados como "mutado".
- **Botão pequeno sobre a arte:** quadrado squircle de `--control-h` (34 a 52 px), carvão sobreposto a 88%, sem contorno, ícone em tinta; no hover sobe para a linha de carvão. Voltar na tela do jogo e "Tentar de novo". Favoritar, editar e controle do jogo vivem no menu Opções.

### Navigation
- **Style:** sidebar de borda (gaveta de 96 px recolhida, 272 px aberta) com destinos em pílula; item ativo = fundo tinta com texto escuro (`--nav-active-bg`/`--nav-active-ink`).
- **Abas do console (Home e tela do jogo):** texto em Rótulo de console (caixa alta, 700), tinta suave em repouso; no hover o texto vira tinta sobre `--tone-3` e a aba ativa é um bloco de tinta com texto carvão que **desliza** de uma aba para a outra (`.console-tab-pill`, posicionado por `useSlidingPill`; em Amigos, Troféus, Perfil e Salas, `HorizontalTabs` com `.t-tabs--squircle`). Altura `--control-h` − 8 px, padding de 16 px. Q e E (LB e RB, com os glifos do controle) trocam, em chips de 8 px nas pontas; na Home há também um "+" para criar coleção. Na tela do jogo a linha fica acima do título.
- **Menus:** painéis de carvão elevado com canto de 16–28 px; itens de 10–12 px de canto, destaque único para mouse e teclado, e confirmações destrutivas por "segurar" (sair da conta).
- **Roleta de opções:** listas curtas em coluna que correm por mola, com a opção em foco em negrito branco com seta e as vizinhas apagadas e desfocadas.

### Botões e abas preenchidos (Home, tela do jogo, Amigos, Troféus, Perfil, chamadas)
Botões e abas não têm contorno: são blocos preenchidos com cantos squircle (`--corner-sm` nos controles, `--corner-md` nos cartões; as capas do console usam `--console-tile-radius`, 14 px). A aba ativa é um bloco de tinta com texto carvão que **desliza** até a aba clicada (`.console-tab-pill` + `useSlidingPill` no console; `HorizontalTabs` com `.t-tabs--squircle` em Amigos). "Iniciar o jogo" e as ações principais são tinta cheia; as secundárias, `--tone-3`. A busca é um campo preenchido, sem aura. O cursor da lista de conquistas é um preenchimento, não um contorno. Pontos de presença e contadores pequenos continuam redondos. Sem arte de jogo por baixo (Amigos, Mods, Configurações), o vídeo de fundo (em loop) aparece a 40%.

### Páginas de sistema (Amigos, Troféus, Perfil)
Compartilham a moldura `ConsolePageLayout`: um rótulo pequeno em caixa alta, as leituras em número grande (`.console-stats`, mono, unidade pequena), as ações à direita e as abas deslizantes embaixo, com a largura máxima de 1280 px e `--safe-x`/`--safe-y` de margem. A troca de aba ou filtro entra por `SectionTransition` (sobe 8 px e sai do desfoque de 2 px em 250 ms; só aparece, sem deslocamento, com "reduzir movimento"). Cada página escolhe uma coisa dominante: a lista e o painel do amigo, a patente e a escalada de troféus, a capa e a identidade do jogador.

### Patente (rank + nível)
`RankBadge`: a imagem do rank (bronze, prata, ouro ou platina) e o nível em mono ao lado, numa peça só; o nome do rank fica no `title` e para leitor de tela. É a única leitura de nível da interface.

### Capa que acabou de chegar (Home)
Duas entradas diferentes, só em `console-reveal`. **Adicionar** (jogo novo pelo modal ou jogo posto num filtro): a capa sobe da base com mola (1,2 s) e um anel de tinta se abre ao redor. **Sincronizar**: as capas se revelam da esquerda para a direita em cascata (70 ms entre uma e outra, no máximo 14), com um clarão que assenta na arte. Trocar de aba, buscar ou filtrar não conta como chegada.

### Fundo em vídeo
O vídeo ambiente roda em loop, a 40% de opacidade, só nas telas sem arte de jogo (Amigos, Mods, Configurações). Na Home nítida a arte o cobre e ele nem é montado. Com "reduzir movimento" o fundo fica estático, e a troca de estado transiciona só cor, fundo, borda e opacidade (120 ms).

### Cards / Containers
- **Corner Style:** 20 a 30 px (cartões grandes `rounded-3xl`), contínuos.
- **Background:** carvão base ou elevado; fora da Home estilo console, capas de jogo ficam a 65–70% de brilho e acendem a 100% no hover ou foco.
- **Shadow Strategy:** nenhuma (ver Elevation & Depth).
- **Border:** hairline de 1 px em #262626; no foco/seleção sobe para #8A8A8A.
- **Internal Padding:** 12 a 32 px, na malha 4/8.

### Inputs / Fields
- **Style:** pílula de fundo carvão elevado, sem borda; a busca nasce de um botão circular que se estica por mola até virar o campo (largura aberta ~256 px).
- **Focus:** o campo ganha o anel de tinta; sobe para o degrau seguinte de tom.
- **Error / Disabled:** desabilitado a 40–60% de opacidade, sem mudar de forma.

### Switches
- **Style:** trilha de 52×32 px em pílula (#373737 desligado, tinta ligado); a bolinha se estica no sentido do movimento ao atravessar e volta redonda, com leve ultrapassada.

### Barra superior da Home (assinatura)
Duas linhas sobre a arte, sem fundo próprio (o véu de topo basta). Linha 1: marca em círculo (carvão elevado a 88%, hover em carvão sobreposto) e a hora em mono e tinta suave; à direita o menu de reticências (círculo, menu em carvão sobreposto com itens em pílula), a busca (círculo que se estica por mola até virar o campo, cobrindo o menu) e o perfil. Linha 2: as abas do console.

### Capa da fileira (assinatura da Home)
A capa quadrada de um jogo na fileira da Home, sempre com brilho cheio (a arte de fundo já diz qual está em foco).
- **Shape:** canto de 14 px (`--console-tile-radius`), fundo carvão elevado; sem arte, o título em legenda de tinta suave no canto de baixo.
- **Foco:** cresce 1,3× (`--console-focus-scale`) para cima, por mola (React Spring, tensão 340, atrito 32), sem anel de contorno. A sombra de estado cresce junto. Só a capa focada fica na ordem de Tab.
- **Loja:** abaixo da capa focada, em Rótulo de console e tinta suave (10 px de afastamento).
- **Troca de arte:** a arte de fundo nova entra assentando (opacidade e escala 1,03 → 1 em 700 ms) enquanto a anterior apaga.
- **Interação:** clique numa capa fora de foco foca; clique na focada (ou Enter) abre a tela do jogo; clique direito abre o menu do jogo. As setas laterais aparecem só com o mouse sobre a fileira.
- **Reduzir movimento:** crescimento imediato; a arte troca em 120 ms, sem escala.

### Dicas de tecla
Embaixo à direita, na Home e na tela do jogo: rótulo em caixa alta (600, 0,06em) e tinta suave, a tecla em tinta dentro de uma tecla de
contorno (linha de carvão, carvão elevado a 80%, canto de 6 px). Home: "Botão dir. Opções", "Enter Detalhes", "Ctrl Enter Jogar". Tela do jogo: "O Opções" (botão que abre o menu), "Enter Selecionar", "Esc Voltar"; com controle, os glifos da família do controle (Options, A, B) substituem as teclas.

### Tela do jogo (assinatura)
- **Abrir:** a tela aparece em fade de 520 ms (`--screen-open`, curva `--screen-ease`) e a interface sobe 24 px; como a arte é a mesma da Home, parece que ela ficou no lugar. Fechar: 260 ms (`--screen-close`).
- **Modo lista:** a arte e a coluna da esquerda deslizam juntas em 600 ms, curva sem quique; a lista entra subindo 16 px logo depois (420 ms, 120 ms de atraso). O bloco do título desliza junto.
- **Bloco do título:** abas, loja em Rótulo de console, título em `--fs-hero` × 0,5 e os números grandes; "Conquistas recentes" aparece como um link com seta para abrir o modo lista.
- **Iniciar o jogo:** caixa de tinta cheia de canto `--corner-md` e 1,2× `--cta-h` de altura, texto carvão em Rótulo de console à esquerda e à direita um bloco carvão com "play" (o glifo A com controle). No hover ou foco, a caixa clareia levemente (opacidade 0,9). Iniciando, vira "Iniciando…"; rodando, "Em execução" com o ponto verde, desabilitada a 75%. O erro de início aparece abaixo, em `--screen-error`.
- **Menu Opções:** abre com o botão da linha de dicas ou a tecla O (Esc fecha), acima das dicas: lista curta em carvão fundo a 94%, sem contorno, de canto 14 px, itens em Rótulo (600) que no hover ou foco sobem para carvão sobreposto. Favoritar ou desfavoritar, editar o jogo e o controle do jogo.
- **Progresso de troféus:** rótulo em tinta suave à esquerda e porcentagem em mono à direita; abaixo, trilha de 4 px em tinta a 18% com o preenchimento em tinta, que corre em 520 ms.
- **Conquista recente:** item de carvão fundo de canto 14 px; o item em foco ganha o cursor (um preenchimento de tinta a 12% que salta de um item para o outro). Ícone de 56 px (canto 6 px), nome do jogo em tinta apagada, nome da conquista em Body 600, descrição em tinta suave e, à direita, a data (desbloqueada) ou a raridade (próxima) em mono. As próximas a desbloquear ficam sem fundo, com o ícone cinza e um cadeado.
- **Reduzir movimento:** troca seca, sem subida nem deslize.

### Mascote e notch (assinatura)
A Pherie (mascote) e o notch (barra no topo da tela e do overlay) são a marca em movimento: o
mascote tem olhos que seguem o cursor por mola e o notch é preto absoluto. São áreas sensíveis:
mexer só quando o pedido for explícito.

## Do's and Don'ts

### Do:
- **Do** separar camadas por degrau de tom (#0A0A0A → #171717 → #262626) e hairline de 1 px, nunca por sombra.
- **Do** usar tinta cheia (`--ink`, `--ink-muted`, `--ink-faint`) para todo texto lido, com piso de 13 px.
- **Do** usar só o verde ao vivo (#30d158) como cor de acento, e só para estado ativo em tempo real.
- **Do** dar a todo botão e aba um bloco preenchido de canto squircle (`--corner-sm`) e a todo cartão o canto contínuo grande; no console, as peças de conteúdo (capa, conquista, menu Opções) usam o canto de 14 px.
- **Do** deixar a arte do jogo em foco como fundo nítido, de ponta a ponta, na Home e na tela do jogo, escurecida só onde há interface.
- **Do** marcar o foco do console pelo tamanho (capa 1,3×) e pelo contorno ou preenchimento de tinta (aba ativa, item de conquista, "Iniciar o jogo"), não por brilho nem por cor.
- **Do** escrever abas, rótulos de número, loja e dicas do console em caixa alta pequena, em Rótulo de console.
- **Do** deixar as capas apagadas em repouso (65–70%) nas telas fora da Home estilo console e acender no hover ou foco.
- **Do** mostrar números grandes com unidade pequena em mono tabular, omitindo leituras sem dado.
- **Do** mover com mola curta (160–420 ms; abrir o jogo 520 ms, modo lista 600 ms, troca de arte 700 ms; a capa focada cresce por mola) e respeitar "reduzir movimento".
- **Do** usar só tokens existentes de `src/index.css`; novo token precisa de aviso.

### Don't:
- **Don't** usar sombras difusas ou pesadas (`box-shadow`/`drop-shadow` exagerados) para dar profundidade; a única sombra de estado é a da capa focada na Home.
- **Don't** usar texto com gradiente, vidro em tudo ou brilho (glow) decorativo da interface, nem brilho de cor derivado da capa atrás da Home.
- **Don't** desfocar a arte do jogo na Home ou na tela do jogo; a arte é o fundo, nítida.
- **Don't** usar marca, logotipo ou arte da PlayStation na Home e na tela do jogo; da referência vêm só estrutura e movimento (os glifos de botão seguem a família do controle conectado).
- **Don't** usar texto menor que 13 px nem branco translúcido sobre cinza para texto que se lê.
- **Don't** pintar a interface com cores além do cinza e do verde ao vivo; a cor vive na arte e nos troféus, e o vermelho só no aviso de erro.
- **Don't** criar cantos retos, botões só com contorno ou contorno de qualquer tipo para dizer "selecionado"; o estado se diz por preenchimento e por tom.
- **Don't** desenhar o nome do jogo na Home nem um anel de contorno na capa focada; o foco é o tamanho.
- **Don't** transformar o Pherielium em loja: nada de preço, "Comprar" ou recomendação de compra.

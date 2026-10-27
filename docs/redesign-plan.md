# Plano de redesign do hub (Gaming OS)

O Pherielium é um **lançador universal**, não uma loja. Reúne jogos de qualquer origem
(Steam, Epic, GOG, locais, inclusive os que rodam com emulador Steam) e põe em volta deles
o que um launcher normal não tem. **Nada neste plano vende, recomenda compra ou mostra
preço.**

Fontes: case do Ankama Launcher (Behance), galeria Recent.design, direção que o projeto já
tem (`docs/design-direction.md`, `docs/design-refined.md`, `docs/ui-principles.md`) e o Steam
Big Picture. Rótulos: **[VISTO]** olhado nesta sessão, **[CONHECIMENTO]** do que sei do produto
sem ter aberto agora (Big Picture não foi aberto).

## 1. Os pilares do produto (o que a interface precisa servir)

| Pilar | O que existe hoje | Papel na interface |
|---|---|---|
| **Biblioteca universal** | jogos de Steam, Epic, GOG, EA, Ubisoft, Xbox, Riot, Battle.net, Rockstar e locais, com liberdade para adicionar à mão | é a Home: tudo num lugar, um "continuar" só |
| **Conquistas para jogos com emulador Steam** | detecta o desbloqueio e **dispara o pop-up de troféu** (algo que esses jogos não têm) | o diferencial: precisa ser a coisa mais bem acabada do app |
| **Tiers de troféu** | platina, ouro, prata, bronze, com cores iguais no notch | identidade visual de progresso, usada em toda tela |
| **Conexões** | Steam, Epic e Discord | status de conta e amigos importados |
| **Voz e chat** | chamadas LiveKit, salas, chat de texto | jogar junto sem sair do launcher |
| **Mods em um clique** | Nexus Mods sem abrir pasta de jogo | instalar sem sair do hub (o download ainda é stub, ver `security-review.md`) |
| **Notch e overlay** | ping, CPU/GPU, avisos | presença dentro do jogo |

## 2. O que o material mostra e o que descartar

### Ankama Launcher (Behance) [VISTO]
O que aproveitar é **estrutura e hierarquia**. **Descartar:** a aba **Loja**, o botão "Comprar" e o
preço no herói, e "Recomendado para você" como vitrine de compra.

| Padrão | Como aparece | Como vira Pherielium |
|---|---|---|
| Shell em 3 colunas | navegação, conteúdo, **painel de amigos fixo** | igual: social fica sempre à mão |
| Cabeçalho de conta + setas voltar/avançar na title bar | orientação como num navegador | igual |
| Navegação curta + listas pessoais | 4 destinos fixos, depois "Meus favoritos" com ação no hover | Início, Biblioteca, Amigos, Mods, Troféus; favoritos e plataformas como listas |
| Herói único | um cartão grande com arte e botão principal | o botão principal é **Jogar** (ou **Continuar**), nunca comprar |
| Trilhos | "Retomar meus jogos" | "Continuar", "Adicionados recentemente", "Seus amigos estão jogando" |
| Busca guiada com chips | Jogo, Pessoas, e últimas buscas com estado | Jogos, Pessoas, Mods, Ações (abrir, iniciar, ligar) |
| Painel de amigos | "Jogando X" sob o nome, ícone do jogo | igual, com botão de entrar na sala de voz |
| Onboarding de personalização | escolher serviços, depois conteúdos | **conectar contas e importar a biblioteca** |
| Fundo ambiente | gradiente desfocado atrás do vidro escuro | a cor da arte do jogo em foco |

### Recent.design [VISTO]
Galeria, não um sistema de componentes. Serve como referência de **gosto**: chrome mínimo, filtros
em pílulas, cartões sem borda pesada com ação no hover, ritmo variado de tamanhos.

### Steam Big Picture [CONHECIMENTO]
Foco forte (anel e escala), controle em primeiro lugar, tela de jogo cinematográfica, dicas de
botão no rodapé. O app já tem gamepad (`useGamepadFocusNavigation`, `SteamDeckControllerFooter`,
`GameDetailSteamHero`); aqui é refinar.

## 3. O que trazer

| # | Padrão | Onde | Esforço | Risco |
|---|---|---|---|---|
| A | **Gaveta de amigos** que abre ao encostar na borda direita, no mesmo estilo da sidebar (feito; antes era uma coluna fixa) | `FriendsRail.tsx` | M | médio |
| B | Sidebar enxuta: 5 destinos + listas | `Sidebar.tsx` (hoje 8+ itens e categorias) | M | médio |
| C | Busca/paleta guiada com chips | `CommandPalette.tsx` | M | baixo |
| D | Home: herói Jogar/Continuar + trilhos | `HeroGame`, `DashboardContinuePlaying` | M | baixo |
| E | Detalhe de jogo cinematográfico, com **troféus em destaque** | `GameDetailPanel` e filhos | G | médio |
| F | Modo Big Picture | novo modo sobre o gamepad existente | G | alto |
| G | Fundo ambiente com a cor do jogo | componente único | P | baixo |
| H | Cartões sem borda, ação no hover | `GameCard`, `GameRow` | P | baixo |
| I | Setas voltar/avançar e conta na title bar | `TitleBar.tsx` | P | baixo |
| J | Onboarding: conectar Steam/Epic/Discord e importar | `EmptyLibraryOnboarding`, `HomeOnboardingQuests` | M | baixo |

Esforço: P = até 1 dia, M = 2 a 3 dias, G = uma semana ou mais.

## 4. Funcionalidades novas (todas sem loja)

Ordenadas pelo valor para quem ainda não usa o app.

1. **Pop-up de troféu como assinatura.** O recurso que mais pesa para a comunidade de emulador
   Steam. Refinar: animação por tier (platina, ouro, prata, bronze), raridade, som, posição
   configurável, **linha do tempo de conquistas** e um "último desbloqueado" no herói.
   Jogos sem conquistas oficiais ganham um painel de progresso.
2. **Noite de jogo.** Escolher um jogo, convidar amigos e abrir uma sala de voz ligada a ele,
   com link. Usa LiveKit, convites e presença que já existem. Também há noites de **cinema
   e resenha** (sem jogo, com assunto opcional); o convite no chat e a notificação
   dizem o tipo ("Fulano chamou você para a Noite de cinema"). Amigos **offline também são
   convidados**: o cartão espera no chat. A gaveta de amigos lista online e offline, com o jogo
   de cada um e o "visto por último".
3. **Retomar com 1 tecla.** "Continuar de onde parou", com tempo da última sessão e próximo
   troféu alcançável; pelo herói, pelo notch e pela paleta.
4. **Mods em um clique com perfis por jogo.** Instalar, ativar, desativar e voltar atrás, com
   backup. Precisa terminar o download da Nexus antes.
5. **Perfil e vitrine de troféus compartilháveis.** Cartão de imagem com horas, jogos e os
   troféus mais raros por tier. É marketing orgânico (o `html2canvas` já está no projeto).
6. **Perfis de modo** (Jogando, Streaming, Silencioso): trocam notch, avisos e áudio de uma vez.
7. **Coleções.** "Para jogar com amigos", "Rápidos", "Backlog", compartilháveis.
8. **Amigos jogam isto** nos cartões (presença que o app já sabe).
9. **Importar de qualquer lugar.** Fluxo único para adicionar jogo local, de emulador ou de
   plataforma, com detecção automática de capa e executável.

Fora do escopo: loja, preços, alertas de preço como produto, recomendações de compra. (A tela
`PriceAlertsPage` já existe; vale decidir à parte se ela fica.)

## 5. Tensões entre o prompt e o projeto (decisões suas)

| Tema | Prompt | Já no projeto | Recomendação |
|---|---|---|---|
| Bordas e sombras | sem sombra, `border-white/10` | estilo refinado remove bordas; separa por tom | **tom + borda interna de 1px**; sombra só em menus e diálogos |
| Fontes | Inter ou Geist; Geist Mono | Inter Black nos títulos, SF Pro no texto | **manter**; Geist Mono só para números |
| Monoespaçada | usar em métricas | regra global troca `.font-mono` por Inter | **exceção `.font-metric`** |
| Cor | monocromático + verde sutil | `--live` já é o acento | **igual**; fundo ambiente pega a cor do jogo |
| Preto | `#000` e `zinc-950` | `#000` só no notch e title bar | **manter** |
| Tiers de troféu | não cita | cores platina, ouro, prata, bronze | **tier é a única exceção de cor fora do `--live`**, igual no notch e nas telas |

## 6. Fases

Cada fase é uma entrega que dá para revisar e reverter sozinha. Em cada componente sigo o
formato do seu prompt (diretriz, hierarquia em 3 níveis, código, estados e teclado/controle).

**F0 Fundação (1 a 2 dias).** `Surface`/`Panel` com borda interna, `AmbientBackdrop`,
`.font-metric`, **tokens de tier** (`--tier-platinum/gold/silver/bronze`) compartilhados com o
notch, raios finais. Aceite: a Home atual usa os primitivos sem mudar o layout.

**F1 Shell (3 dias).** A, B, I. Sidebar reagrupada (Menu, Social, Progresso, Ferramentas; nenhum destino
removido), gaveta de amigos nas duas bordas e setas na title bar. Feito. Aceite: 1024×700 e 1920×1080 sem corte; foco por teclado em tudo.

**F2 Home (3 dias).** D, G, H. Herói Jogar/Continuar, trilhos, cartões sem borda.

**F3 Troféus e pop-up (4 dias).** Funcionalidade 1 e a tela de Troféus: herói com o troféu mais
raro e anel de progresso, linha do tempo por jogo, pop-up por tier. É o diferencial, então vem
antes do Big Picture.

Status: a tela de Troféus já tinha patente, escala por tier e lista com progresso, e o pop-up já tinha efeito por tier (brilho, explosão, anéis prismáticos). Feito na F3: card "Mais perto da Platina" e o pop-up alinhado ao sistema (raio concêntrico, XP em Geist Mono, textos a partir de 13px). Pendente, por depender de dado que o app não guarda: troféu mais raro e último desbloqueado no herói, posição configurável do pop-up e painel para jogos sem conquistas oficiais.

**F4 Busca e retomar (2 dias).** C e a funcionalidade 3.

**F5 Detalhe de jogo (5 dias).** E. Arte em tela cheia, botão Jogar grande, troféus por tier,
amigos jogando, mods do jogo.

**F6 Social e voz (4 dias).** Noite de jogo, spotlight no falante, presença no painel.

**F7 Mods (4 dias).** Cartões com arte, perfis, instalar em um clique (depende do download da Nexus).

**F8 Big Picture (7+ dias).** F, só depois de F1 a F5 estarem sólidas.

**F9 Crescimento (4 dias).** Cartão compartilhável, coleções, perfis de modo, onboarding J.

Total estimado: 6 a 7 semanas de uma pessoa. F0 a F3 já mudam a cara do app em cerca de 2 a 3 semanas.

## 7. Riscos

- Painel de amigos fixo come largura: em 1024 vira uma coluna de avatares.
- Fundo ambiente com desfoque custa GPU: medir a 144 Hz e desligar no modo jogo.
- Big Picture duplica fluxos de navegação: manter um só modelo de foco.
- Pop-up de troféu aparece por cima do jogo: não pode roubar foco nem cair em jogo em tela cheia
  exclusiva (testar com vários jogos e emuladores). Fica no módulo de conquistas, hoje fora do
  escopo por padrão: só mexer com pedido explícito.
- Os textos abaixo de 13px e os hex fixos (ver `docs/ui-principles.md`) precisam virar tokens nas
  telas que cada fase tocar.

## 8. Critérios de pronto por tela

- Só tokens (nenhum hex novo); contraste de texto 4,5:1 ou mais.
- Um protagonista; hierarquia em 3 níveis (destaque, informativo, metadados em mono).
- Estados: carregando, vazio, erro, hover, foco visível, pressionado, desabilitado.
- Teclado e controle: ordem de foco lógica, anel visível, dicas de botão onde fizer sentido.
- Testada em 1024×700 e 1920×1080 e em um tema colorido.

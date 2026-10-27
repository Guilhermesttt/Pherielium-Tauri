# Princípios de UI do Pherielium

Guia curto para quem vai mexer na interface. Resume os princípios de UI Design do
e-book "UI Design Principles" (Michael Filipiuk) já traduzidos para os tokens e
componentes deste projeto. Use como checklist antes de abrir um PR de interface.

A regra de ouro do livro: o usuário não quer admirar a tela, quer terminar a tarefa
com o mínimo de esforço. Boa interface é usável primeiro e agradável em seguida.

## 1. Hierarquia: o que o olho vê primeiro

- Quatro alavancas, nesta ordem de força: **tamanho**, **cor/contraste**, **posição**
  (esquerda e topo primeiro) e **proximidade**.
- "Se tudo se destaca, nada se destaca." Em cada tela, um elemento é o protagonista
  (no hub é o título do jogo; no login, o botão "Entrar"). O resto fica quieto.
- Elementos próximos viram grupo; uma região fechada (card) também. Agrupe pelo
  espaço antes de agrupar por borda.
- Primeiro plano é interativo e mais claro; fundo é calmo. Nunca use cor forte ou
  imagem sem escurecimento como fundo de conteúdo.

## 2. Cor: preto para o fundo, cinza para a camada, branco para o ativo

Tema padrão (`--gray-0` a `--gray-11` em `src/index.css`):

| Papel | Token | Uso |
|---|---|---|
| Fundo da página | `--surface-base` (`--gray-1`) | tela |
| Camada / card | `--surface-raised` (`--gray-2`) | painéis, cards em repouso |
| Hover / selecionável | `--surface-overlay` (`--gray-3`) | hover, controles |
| Ativo | `--gray-11` (branco) | aba ativa, CTA, notch ativo |
| Chrome | `--chrome-black` (`#000`) | title bar e notch, só no tema padrão |

- **Profundidade vem de luminosidade, não de sombra.** Para elevar algo no escuro,
  use um cinza um degrau acima. Não use sombra branca no modo escuro.
- Sombras, quando existirem: suaves (blur alto, opacidade 5 a 10%), nunca em
  elemento não clicável, nunca preto puro sobre cor (use um tom escuro da escala).
- O livro desaconselha `#000` por causa do contraste forte. Aqui o preto absoluto é
  uma decisão de marca, restrita ao notch e à title bar para parecer extensão do
  hardware. Não espalhe.
- Outros temas (PS5, Cyberpunk etc.) derivam as cores das próprias superfícies.
  Nunca grave hex fixo num componente: use os tokens.
- Gradiente: poucos, de matizes parecidos, sem faixa cinza no meio.
- Pareie cores pelo significado: verde = sucesso, laranja = aviso, vermelho = erro.
  Uma cor de acento só ("ao vivo").

### Contraste (acessibilidade)

- Texto normal precisa de **4.5:1** (AA); o ideal é 7:1 (AAA).
- Medido neste projeto: `--ink-muted` passa em todas as superfícies;
  `--ink-faint` e `--text-tertiary` foram elevados porque falhavam em
  `--surface-raised` e `--surface-overlay`.
- Evite `text-white/20` a `text-white/40` para texto que alguém precisa ler.
  Reserve para ornamento e estado desabilitado.

## 3. Tipografia

- **Títulos de impacto:** Inter Black (peso 900), só em `h1`/`h2`.
  **Texto:** SF Pro quando instalada, com Inter embutida como alternativa.
- Pareie pulando pesos: corpo Regular com título Bold ou mais. Nunca Medium com
  SemiBold. Não use peso Light em texto pequeno.
- Escala escrita à mão (passos de 2 e 4), não por razão áurea. Tokens: `--step-*`
  e `--fs-*`. Piso de **13px** para texto que se lê.
- Altura de linha: corpo cerca de 1.5 a 1.6; títulos grandes 1.0 a 1.2.
- Espaçamento entre letras: 0 no corpo, levemente negativo (cerca de -3%) em
  títulos grandes, levemente positivo em caixa alta.
- Linha com 50 a 75 caracteres. Alinhe à esquerda; centralize só texto curto.
- Alinhe textos de tamanhos diferentes pela **linha de base**, não pelo centro.

## 4. Espaço e grade

- Escala suave de 4/8 (`--space-1` a `--space-12`). Todo espaçamento vem da escala.
  Se precisar de um valor entre dois degraus, reveja a base e não invente o valor.
- Comece com espaço demais e reduza. Branco não é desperdício: dá foco.
- Formulário e artigo usam largura fixa; conteúdo que reflui (biblioteca) usa grade
  fluida. Margens laterais não podem ser pequenas (`--safe-x`).
- Elementos não encostam nos cantos da janela (exceto title bar e rodapé).

## 5. Cantos

- Um raio por nível de hierarquia, usado em todo o app. Cantos aninhados são
  **concêntricos**: raio externo = raio interno + respiro (notch 40 = card 24 + 16).
- Squircle global (`corner-shape`), exceto círculos e pílulas.

## 6. Botões

- Tipos: CTA/primário (preenchido, branco), secundário (contorno ou tom),
  terciário (texto/ícone). Quanto mais importante, mais destaque.
- Altura mínima 40px (`Button` padrão agora é `h-10`); CTA 44 a 60px. Padding
  lateral confortável (cerca de 32px). Texto 14 a 16px.
- Desenhe **todos os estados**: padrão, hover, pressionado, foco visível,
  desabilitado, carregando.
- O botão principal fica à **direita** do par; o secundário à esquerda.
- Texto do botão diz exatamente o que acontece ("Remover jogo", não "Sim").
  Se a ação cobra, apaga ou é irreversível, nomeie o objeto e avise.
- Alvos pequenos (ícone, checkbox) têm área clicável maior que o desenho.

## 7. Formulários

- Rótulo sempre visível (o placeholder some ao digitar). O padrão de rótulo
  flutuante do login atende.
- Campo parece campo: retângulo com borda ou tom, nunca igual a botão.
- Uma coluna. Agrupe campos por assunto com um espaço extra. Campos curtos têm
  largura curta.
- Marque o que é **opcional** em vez de asterisco no obrigatório.
- Feedback em tempo real e todos os estados (foco, ok, erro, desabilitado). Nunca
  limpe o formulário por causa de um erro.
- Explique por que pede um dado sensível. Peça o mínimo. Ofereça login social.
- Dropdown só para listas longas (mais de 4 itens); poucas opções viram radio.
  Interruptor para configuração que vale na hora; checkbox quando há "Salvar".

## 8. Cards

- Um card é uma versão curta de uma página. Mostre só o que ajuda a decidir
  (capa, título, uma ou duas métricas, uma ação).
- Precisa **parecer clicável**: diferença de tom ou contorno e hover sutil
  (escala leve e sombra).
- Teste com título enorme, sem imagem e com dado faltando. Corte texto com
  reticências e tenha um ícone de substituição.
- Um estilo de card por produto. Não misture.

## 9. Ícones, fotos e ilustrações

- Um pacote de ícones só (aqui, `lucide-react`), com a mesma espessura e o mesmo
  arredondamento. Simples vale mais que detalhado. Ícone pouco comum leva rótulo.
- Na navegação, ícone cheio para o item ativo e contornado para os demais é um
  padrão aceito.
- Foto com texto por cima leva escurecimento por gradiente, só onde há texto.
  Foto com um único ponto focal. Teste em vários formatos (1:1, 4:3, 16:9, 4:5).
- Estados vazios e erros merecem desenho e texto com próximo passo.

## 10. Navegação

- Visível quando couber (até 5, no máximo 7 itens). Mais que isso: agrupe, como a
  sidebar faz (Menu, Social, Ferramentas), ou esconda o secundário.
- Rótulos em todos os itens ou em nenhum. Item ativo destacado, inativos
  suavizados. Botões de ação por último, à direita.
- Links dentro do texto precisam parecer clicáveis (cor, peso ou "chip").

## 11. Microinterações

- Servem para **dar retorno** a uma ação, não para enfeitar. Curtas: no máximo
  1 s, a maioria entre 150 e 400 ms.
- Nada linear. Use mola ou `--ease-mech` (`cubic-bezier(0.2, 0, 0, 1)`). Anime só
  `transform`, `opacity` e `filter`.
- Movimento que ninguém pediu (decorativo) é raro e deliberado. Respeite
  `prefers-reduced-motion`.

## 12. Texto da interface (microcopy)

- Escreva do ponto de vista de quem usa, em voz ativa e frase curta.
- Sem dupla negação em diálogos ("Cancelar" para fechar o diálogo de cancelar
  assinatura). Nomeie o resultado em cada botão.
- Erro diz o que houve e como resolver. Vazio convida a agir.
- Nada de "Lorem ipsum": use texto realista do próprio produto.
- Chame cada ação pelo mesmo nome em toda a jornada ("Publicar" gera o aviso
  "Publicado").

## 13. Personalidade

O Pherielium é um hub de jogos escuro e monocromático, sofisticado e tranquilo.
Isso pede cantos grandes e suaves, cor só em estado, títulos de impacto e texto
sóbrio. Decisão de estilo vem do público, não do gosto de quem desenha.

## Checklist de PR de interface

- [ ] Só tokens (cor, espaço, raio, tipo, movimento); nenhum hex novo.
- [ ] Contraste de texto 4.5:1 ou mais nas superfícies em que aparece.
- [ ] Um elemento protagonista; o resto discreto.
- [ ] Estados: hover, pressionado, foco visível, desabilitado, carregando, vazio, erro.
- [ ] Botões com verbo + objeto e a ação principal à direita.
- [ ] Alvos clicáveis de pelo menos 40px (ou área estendida).
- [ ] Texto longo, sem imagem e dado ausente testados.
- [ ] Animação curta, sem linear, e respeitando movimento reduzido.
- [ ] Testado nos temas padrão e em pelo menos um tema colorido.

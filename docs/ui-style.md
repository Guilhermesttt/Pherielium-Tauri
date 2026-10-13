# Estilo da interface: "refined" e "classic"

A janela principal usa por padrão o estilo **refined** (minimalista, cantos maiores, bordas quase invisíveis, movimento suave). O visual anterior continua disponível como **classic**.

## O que o "refined" muda (`src/index.css`, no fim do arquivo)
| Área | Mudança |
| --- | --- |
| Movimento | Todo `transition` do Tailwind passa a usar a curva de mola do iOS `cubic-bezier(0.32, 0.72, 0, 1)` com 240 ms (antes ease de 150 ms); tokens `--motion-*` de 180/300/460 ms |
| Pressionar | Botões encolhem para 97% ao clicar (propriedade `scale`, que soma com `transform` e não briga com o framer-motion); sem isso quando o sistema pede menos movimento |
| Tipografia | Texto com espaçamento -0,011em; títulos -0,022em com quebra equilibrada; parágrafos com `text-wrap: pretty`; suavização de fonte |
| Tema padrão (Pherielium/Checkpoint) | Superfícies um pouco mais neutras (`#050505`, `#161618`, `#232326`), texto secundário `#9a9aa1`, bordas 6% (antes 8%) e 15% (antes 22%), cantos 26/20/14 px (antes 22/16/12), sombras longas e suaves |
| Outros temas (PlayStation, Cyberpunk, Xbox 360...) | Só movimento, pressionar e tipografia; cores e cantos de cada tema ficam como estavam |

## O que NÃO muda
- Cores e cantos escritos direto nos componentes (`bg-[#0F0F0F]`, `rounded-[18px]`...): são centenas e não passam pelos tokens. Eles pedem uma varredura por componente, janela a janela.
- O overlay do jogo e o notch do overlay: é outra janela e não recebe o atributo.
- Nenhum `backdrop-filter` novo: o app já usa muitos e a GPU é o gargalo de quem joga.

## Como voltar ao visual anterior
No console (F12), e reinicie o app:
```js
localStorage.setItem("pherielium_ui_style", "classic")   // volta ao anterior
localStorage.removeItem("pherielium_ui_style")           // volta ao refined (padrão)
```
O estilo é aplicado antes da primeira pintura (`src/main.tsx`, `src/lib/uiStyle.ts`); qualquer valor que não seja `classic` usa o refined.

## Como testar
1. Abra o app e passe o mouse e clique em botões e cartões: o movimento deve parecer mais longo e suave, sem "estalar", e o clique encolhe de leve.
2. Compare com `classic` (comando acima): cantos, bordas e curvas devem voltar ao anterior.
3. Mude para um tema de console (PlayStation, Xbox 360...): as cores e cantos do tema não mudam; só o movimento e a tipografia.
4. Ative "reduzir movimento" no Windows: nada encolhe ao clicar e as transições ficam curtas.

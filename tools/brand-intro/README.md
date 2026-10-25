# Pherielium — intro de marca (p5.js)

Intro de 7 s, 1920×1080, 60 fps. Tipografia cinética + morphing de blobs líquidos, 2D flat.
É uma peça de marca independente do app: não é importada por nada em `src/`.

## Como abrir

Abra `index.html` no navegador (precisa de internet: p5.js vem do cdnjs e as fontes do Google Fonts).
Espaço reinicia. O canvas é sempre 1920×1080 e só é escalado para caber na janela.

| Parâmetro      | Efeito                                                           |
| -------------- | ---------------------------------------------------------------- |
| `?theme=mono`  | Cinza/preto/branco, sem degradê, nome da marca em DM Serif       |
| `?t=3.2`       | Congela no segundo 3.2 (útil para revisar um quadro)             |
| `?loop=0`      | Toca uma vez e para no último quadro                             |
| `?capture=1`   | Avança exatamente 1/60 s por quadro, para gravação offline       |

`window.renderAt(t)` desenha o quadro do instante `t` (ferramentas externas). A cena é uma função
pura do tempo (`drawFrame(t)` em `sketch.js`): o mesmo `t` sempre produz o mesmo quadro.

## Linha do tempo

| Tempo (s)   | O que acontece                                                                |
| ----------- | ----------------------------------------------------------------------------- |
| 0.0 – 0.2   | Gota creme pulsa no escuro                                                     |
| 0.2 – 1.8   | Cartão 1: onda creme, "UNIVERSAL" (Archivo Black)                               |
| 1.75 – 2.9  | Cartão 2: onda azul a partir do canto inferior esquerdo, "GAMING"               |
| 2.9 – 4.2   | Cartão 3: onda laranja a partir do canto superior direito, "LIBRARY"            |
| 4.2 – 4.8   | Onda preta limpa a tela                                                         |
| 4.6 – 5.7   | Gota azul nasce no centro e faz morph para o logo (blob → 3 braços)             |
| 5.6 – 6.8   | Ponto do logo, nome (tracking-in), fio laranja e "universal gaming library"     |
| 6.8 – 7.0   | Quadro final parado, com leve flutuação do logo                                 |

## Decisões e pontos em aberto

- **Duas especificações conflitantes** na solicitação original (4 cores com degradê e Inter Bold,
  contra 3 tons de cinza sem degradê e DM Serif). O padrão segue a primeira; a segunda está
  disponível em `?theme=mono`. Trocar o padrão é mudar `THEMES` em `sketch.js`.
- O logo é o da intro React antiga (dois paths: corpo + ponto). O corpo é reamostrado em 180
  pontos para interpolar com o blob; o ponto é um círculo.
- O slogan fica em minúsculas, como escrito no pedido.
- Fontes e p5.js vêm de CDN para a pasta ser autocontida. Para uso offline, troque pelos pacotes
  `@fontsource/archivo-black` e `@fontsource-variable/inter` que o repo já tem.
- O `export.mjs` desenha cada quadro por `renderAt(i / 60)`, sem depender do relógio. O codificador
  `ffmpeg` não é dependência do repo: sem ele no PATH, o script grava só os PNGs e imprime o
  comando para montar o vídeo. O trecho de codificação ainda não foi testado de ponta a ponta.

## Exportar para vídeo

```bash
node tools/brand-intro/export.mjs                # 420 PNGs em tools/brand-intro/out/color
node tools/brand-intro/export.mjs --theme=mono   # tema cinza
node tools/brand-intro/export.mjs --out=D:/saida # outra pasta
```

Usa o Chromium do Playwright e, se ele não estiver baixado (`npx playwright install chromium`),
cai para o Edge ou Chrome instalados. Com `ffmpeg` no PATH, gera também `intro.mp4`
(H.264, yuv420p, 60 fps). A pasta `out/` é ignorada pelo git.

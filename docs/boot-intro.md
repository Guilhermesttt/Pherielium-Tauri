# Animação de abertura

Toca depois da tela de carregamento e antes do hub (`App.tsx`). Qualquer tecla ou clique pula.

Código: `src/components/GameBootIntro.tsx` (player e sons), `src/components/boot-intro/`
(escolha da cena por tema e carregamento) e `src/assets/intro-scenes/` (as animações).

## Cenas

São animações Lottie exportadas do Jitter (1920×1080, 60 fps, ~14,6 s; a intro encerra em ~10,4 s,
o resto é preto). **O arquivo Lottie não carrega áudio**: os sons são tocados pelo app.

| Cena | Arquivo | Usada quando |
|---|---|---|
| `default` | `scene-default.json` | todos os temas sonoros, exceto o do Xbox |
| `xbox` | `scene-xbox.json` | tema sonoro `xbox360` (mesma coreografia, em verde) |

O selo "feito com Jitter" que vinha no canto inferior direito foi removido dos JSONs (camadas
`ind` 12 e 4). Os JSONs têm ~1,4 MB cada e **não entram no pacote principal**: são baixados pela
tela de carregamento (`preloadBootIntro`) e reaproveitados pela intro.

`src/components/GameBootCubeIntro.tsx` é a intro anterior (cubo mágico em canvas). Não é usada;
foi mantida para o caso de voltar a ela.

## Fundo

O fundo de pontos que existia dentro da animação (uma imagem estática) foi tirado dos JSONs e
trocado pelo vídeo de fundo padrão (`karavanbraam_pindown.io.webm`), desenhado por cima da cena com
`mix-blend-mode: screen`. Ele aparece e some no mesmo ritmo que a textura tinha
(`backdropOpacity` em `bootIntroBackdrop.ts`; o pico é `BACKDROP.peak`).

## Sons

- **Som de abertura do tema**: `src/sounds/<pasta do tema>/startup.mp3` (ou `.wav`/`.ogg`). Hoje
  existem `Phelierium Default/startup.mp3` (tema padrão) e `Xbox One/startup.mp3` (tema Xbox). Quando
  o tema tem esse arquivo, **toca só ele**: ele já é a trilha completa da cena, então os efeitos
  abaixo não entram por cima (evita som duplicado). O volume de cada um fica em `STARTUP_VOLUME`
  (`bootIntroTheme.ts`), porque os arquivos têm loudness diferente.
- **Temas sem som de abertura próprio**: tocam `Intro_Music.mp3` e os três swooshes de
  `src/sounds/Pherielium Intro/` nos momentos-chave da cena (`SCENE_TIMING`).
- As pastas por tema estão em `SOUND_FOLDER_BY_THEME`. **Não há sons de console de outros temas no
  repositório** (direitos autorais): cada pessoa coloca o seu `startup.*`.
- Respeita a preferência "Som de abertura".

## Adicionar uma cena para outro tema

1. Exporte a animação do Jitter (Lottie, sem o selo) para `src/assets/intro-scenes/`.
2. Registre a cena em `bootIntroScenes.ts` (`SCENE_URLS`, `SCENE_TIMING`) e em `bootIntroTheme.ts`
   (tipo `BootSceneId` e `SCENE_BY_THEME`).

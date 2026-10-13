# Stream diagnostics (screen-share quality)

Read-only WebRTC stats for investigating choppy screen shares. Off by default.

## Enable
In the app's devtools console, then restart the call:
```js
localStorage.setItem("pherielium_stream_debug", "1")
```
Disable with `localStorage.removeItem("pherielium_stream_debug")`.

## What is logged
Every second, tagged `[stream-debug:stream-sender]` (broadcaster) / `[stream-debug:stream-receiver]` (viewer):

| Side | Fields |
| --- | --- |
| Sender | `fps`, `sourceFps` (media-source), `trackFps` (`getSettings().frameRate`), `droppedFramesDelta` (source frames that never reached the encoder), `limitationReason`, `encoder`, `powerEfficientEncoder`, `bitrateKbps`, `width`x`height`, `encodeMsPerFrame`, `visible` (hub foreground/background) |
| Receiver | `fps`, `jitterMs`, `framesDecodedDelta`, `framesDroppedDelta`, `decodeMsPerFrame`, `freezeCount`, `totalFreezesDurationSec` |

When the share stops (or the call ends) a `[stream-debug:summary]` block is printed with: average and
p5-floor fps, dropped %, most frequent `qualityLimitationReason` (+ % of seconds limited by `cpu`),
encoder, mean resolution/bitrate, encode ms/frame and % of samples with the window in background.
Copy that block when reporting results.

Only the LiveKit publish path is instrumented (the P2P mesh fallback is not).

## A/B protocol
Same game, same scene, ~2 min each, one summary per run. Put the scenario in the report.
1. Baseline: 720p30, audio off, hub in foreground.
2. 1080p (target fps), audio **off**, hub foreground.
3. 1080p, audio **on**, hub foreground.
4. 1080p, audio on, hub **background** (game focused).
5. 1080p, audio off, hub background.
Comparing 2 vs 3 isolates the audio capture/IPC cost; 3 vs 4 isolates the hub's own rendering cost.

Code: `src/services/voiceCall/streamDiagnostics.ts` (pure parsers/summaries are unit-tested).

## Bitrate escolhido e taxa de quadros (rc.5)
- O modal "Compartilhar tela" tem agora **Bitrate do vídeo**: Auto, 4, 6, 8, 12, 16 ou 20 Mbps (guardado em `pherielium_screen_share_prefs`). **Auto** usa a tabela por qualidade e fps (720p: 4,5/6,5 Mbps; 1080p: 8/12 Mbps em 30/60 fps). Valores fora de 2 a 30 Mbps são limitados.
- A preferência de degradação passou a ser **sempre `maintain-framerate`** (antes, em 30 fps era `balanced`, que deixava o fps cair). Com banda ou CPU curtas, o encoder reduz **resolução**, não quadros.
- Para comparar: rode o mesmo cenário com Auto e com outro valor e cole os dois `[stream-debug:summary]` (fps médio e mínimo, `qualityLimitationReason`, bitrate real). Se `bitrateKbps` ficar abaixo do escolhido e a limitação for `bandwidth`, a rede é o teto; se for `cpu`, é o encoder.

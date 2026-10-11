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

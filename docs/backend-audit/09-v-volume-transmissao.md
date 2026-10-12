# 09. V: o slider de volume da transmissão "funciona até certo ponto, mas não silencia"

Data: 2026-10-12. Diagnóstico por leitura de código (causa **provada no código**) e instrumentação para **confirmar no runtime** (flag `pherielium_stream_debug`). Nenhuma correção implementada.
Rótulos: `[VERIFICADO: arquivo:linha]` / `[INFERIDO]`.

## Causa raiz
**A mesma trilha de áudio da transmissão toca em DOIS elementos ao mesmo tempo, e o slider só controla um deles.**

1. **Caminho controlado (o do slider).** `attachLiveKitAudioOnce` chama `track.attach()` e define `el.volume` (e o mute) a partir de `effectivePercent` (`useVoiceCall.ts`, ~`:2106-2140`). É o único elemento que a correção de volume (chaves `{kind,id}`) governa.
2. **Caminho NÃO controlado (o `<video>` do palco).** A trilha `ScreenShareAudio` também entra no `MediaStream` do feed da tela: `ingestRemoteLiveKitTrack` trata `ScreenShareAudio` como transmissão e adiciona o `mediaStreamTrack` em `remoteScreenStreams` (`useVoiceCall.ts:2077-2092`). Esse stream vai para `<VideoRenderer muted={feed.isLocal} />` (`ScreenShareStage.tsx:55`). Para um feed **remoto**, `isLocal` é `false`, então o `<video>` fica **sem mute e em volume 1,0**, e `VideoRenderer` chama `video.play()` (`VideoRenderer.tsx:33-41,80`). O `<video>` toca o áudio do stream por conta própria, **sem passar pelo slider, pelo mute independente nem pelo `setSinkId` do dispositivo de saída**.

Soma audível = `<video>` (sempre 100%) + `<audio>` (o que o slider define). Consequências, todas batendo com o relato:
- **Não silencia:** em 0% sobra o `<video>` a 100%.
- **"Funciona até certo ponto":** do 100% ao 0% só some a metade da soma (≈ −6 dB), então a mudança existe, mas nunca zera.
- **Não aumenta direito:** acima de 100% nada muda (o teto é `el.volume = 1,0`) e o `<video>` fica fixo.
- **Em 100% soa dobrado** (duas cópias com latências diferentes: eco ou "phasing").
- **Ignora a saída de áudio escolhida:** só o `<audio>` recebe `setSinkId`.

### O mesmo defeito na voz com câmera (achado novo)
`getPeerCameraStream` devolve o stream **inteiro** (com o áudio da voz) quando todas as trilhas de vídeo são de câmera (`VoiceCallWindow.tsx:54-66`, linha `if (cameraTracks.length === stream.getVideoTracks().length) return stream`). O `<VideoRenderer muted={feed.isLocal}>` da pessoa remota (`VoiceOnlyStage.tsx:138` e `:480`) também toca o áudio da voz sem mute, em paralelo ao `<audio>` do LiveKit. Quem liga a câmera passa a tocar duas vezes para o espectador. (Você disse que a voz está correta: o sintoma só aparece com a câmera do outro ligada.)

## Respostas às perguntas do dono
| Pergunta | Resposta |
| --- | --- |
| O `<video>` da transmissão está mutado? | **Não, para feeds remotos** (`ScreenShareStage.tsx:55`: `muted={feed.isLocal}`). Só o feed local é mutado. |
| Há mais de um elemento de áudio na mesma trilha? | **Sim**: o `<audio>` de `track.attach()` e o `<video>` do palco (e, com câmera, o `<video>` da pessoa). `findDoublePlayback` detecta isso em runtime. |
| `webAudioMix` está ligado no Room? | **Não**: `new LiveKitRoom({...})` não define `webAudioMix` (`useVoiceCall.ts:~1990-2010`); o padrão é desligado, então o volume age direto em `el.volume`. [VERIFICADO: `grep webAudioMix` vazio] |
| Qual a `source` de cada trilha? | Voz = `Microphone`; áudio da tela = `ScreenShareAudio` (publicado em `screenShare.ts:197-204`). O inventário imprime `source`, `sid` e `muted` de cada publicação. |
| Quantas publicações de áudio o espectador recebe? | Esperado: **2 por pessoa que transmite** (microfone + áudio da tela) e 1 por quem só fala. O inventário imprime a contagem real. |
| A correção da frente de volume está nesta branch? | **Sim**: commit `5318507` (`volumeKeys.ts`, `volumeStore.ts`, mute independente, persistência `pherielium:volumes:v1`), em `main`. Ela corrigiu o vazamento do slider da transmissão para a voz; **não** tratava o `<video>`. |
| O slider passa de 100%? | O slider **da transmissão** está limitado a 100% (`MAX_VOLUME_PERCENT.screen`, `ScreenShareStage.tsx`). O de voz vai a 200% no menu de contexto, mas no LiveKit `el.volume` é limitado a 1,0 (`toElementVolume`), então 100%–200% não faz nada (issue de boost, backlog). |

## Instrumentação (somente leitura, atrás da flag)
`localStorage.setItem("pherielium_stream_debug","1")`, reiniciar, abrir uma chamada com alguém transmitindo, e no console:

```js
await window.pherieliumAudioInventory()
```
Imprime: `room.webAudioMix`; as publicações de áudio recebidas e enviadas (`source`, `sid`, `muted`); todos os elementos de mídia (LiveKit e DOM) com `vol`, `muted`, `paused` e nº de trilhas; **e a seção "trilhas tocando em mais de um elemento"**, que deve mostrar a trilha `screen_share_audio` em 2 elementos (o `<audio>` do slider e o `<video>` do palco). Mexa o slider para 0% e gere o relatório de novo: o `<video>` continua com `vol=1` e `muted=false`.

## Correção proposta (NÃO implementada)
Tornar o `<video>` de feeds remotos **mudo sempre que a mídia for LiveKit**, deixando o `<audio>` de `track.attach()` como único caminho de reprodução (é o único que respeita slider, mute independente e `setSinkId`).
- `muted = feed.isLocal || mediaTransport === "livekit"` em `ScreenShareStage`, nos dois `VideoRenderer` de `VoiceOnlyStage` (câmera) e no de miniatura (já mutado). O `mediaTransport` já existe em `useVoiceCall` e precisa chegar ao `CallStage`.
- Em P2P (flag manual) o áudio continua vindo do stream, então o `<video>` fica como hoje.
- Efeito colateral bom: some o dobro em 100% e a voz com câmera para de tocar duas vezes.
- Teste: função pura `shouldMuteFeedVideo({ isLocal, transport })` com tabela; inventário em runtime sem nenhuma trilha em 2 elementos; manual com 2 contas (slider 0%, 50%, 100% da transmissão e da voz, com e sem câmera).
- Esforço: 0,5 a 1 dia. Risco: baixo (só a prop `muted`); a captura de tela PiP/fullscreen usa o mesmo elemento, então também fica sem áudio duplicado.

## Hipóteses restantes
Nenhuma competindo com a causa acima; o inventário confirma ou refuta no runtime. Se **não** aparecer trilha em 2 elementos, a próxima suspeita é o `ScreenShareAudio` publicado pelo emissor ainda silencioso (a captura de desktop só passou a iniciar com a F-áudio), o que o inventário também mostra (publicação ausente ou `muted=true`).

## V-fix: implementada (esta rodada)
- **Invariante:** com transporte LiveKit (e `none`, antes de o transporte ser marcado), todo `<video>` fica **sempre mutado**; o `<audio>` de `track.attach()` é o único audível. Regra pura em `feedAudioPolicy.ts` (`effectiveVideoMuted`), aplicada **em um lugar só**: `VideoRenderer` lê o transporte do `MediaTransportContext` (provido por `VoiceCallWindow`). Isso cobre palco da transmissão, câmera, miniaturas (`ParticipantTile`), tela cheia, PiP e qualquer `VideoRenderer` futuro.
- **P2P e eco:** comportamento anterior (o `<video>` toca o áudio do stream, porque ali não há `<audio>` do LiveKit). Documentado no cabeçalho de `feedAudioPolicy.ts`; nesses modos o `setSinkId` não vale para o `<video>` (limitação conhecida).
- **Voz duplicada com câmera:** coberta pela mesma regra (câmera no palco, miniatura e tela cheia).
- **Saída de áudio:** `setSinkId` agora vai pelo `applySinkId`, que só chama quando a saída muda e **também para voltar ao padrão** (antes escolher "default" depois de um dispositivo não revertia o elemento). O inventário imprime o `sinkId` de cada elemento e avisa quando um elemento audível não usa a saída escolhida.
- **Testes:** `feedAudioPolicy.test.ts` cobre a regra, o invariante "no máximo um elemento audível por trilha" (transmissão e voz com câmera) e `applySinkId`; `audioInventory.test.ts` cobre `findSinkMismatches`.
- **Fora do escopo (issue):** boost acima de 100% (ver `docs/tech-debt/issue-drafts.md`, item 4).

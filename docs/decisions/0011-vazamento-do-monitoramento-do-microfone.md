# ADR-0011: Fecha o monitoramento do próprio microfone e separa voz de áudio da tela no P2P

- Status: **Aceito** (pedido do dono, 2026-10-14: "separar as faixas de áudio para não ter
  retorno nas chamadas e nem nos canais de voz"; confirmado explicitamente para o P2P no mesmo dia).

## Contexto
`cleanUpCall()` (`useVoiceCall.ts`) nunca chamava `stopMicMonitoring()`. "Ouvir o próprio
microfone (Retorno)" (`CallSettingsPopover`/Configurações → Voz e vídeo) cria um `AudioContext`
próprio que liga o microfone cru direto na saída de áudio (`source → gain(0.85) → ctx.destination`)
para a pessoa calibrar o próprio volume. Ligar esse ajuste e depois encerrar a chamada (ou trocar
de chamada, com a lógica da ADR-0010) nunca fechava esse `AudioContext`: ele ficava aberto, porque
o preset é salvo no `localStorage` (`checkpoint_voice_mic_monitoring`) e sobrevive entre chamadas.
Em sessões longas com várias chamadas, isso acumula um `AudioContext` aberto por chamada — o
navegador tem um teto baixo de contextos simultâneos (Chromium: 6); ao estourar, criar um novo
falha e o áudio da chamada seguinte pode quebrar de formas que soam como "o áudio bugou"/"retorno".

Investigando o pedido mais a fundo (transmissão de tela + voz juntas causando retorno), a captura
nativa de áudio do desktop já exclui a própria árvore de processos do Pherielium
(`LoopbackScope::ExcludeTree`, `src-tauri/src/commands/audio_capture/win.rs`), a política de
transmissão nunca pede áudio do navegador (`planScreenShareAudio`, sempre `requestBrowserAudio:
false`, exatamente para não recapturar a voz da própria chamada) e cada trilha remota (voz e
áudio da tela) ganha seu próprio elemento de reprodução com volume independente
(`attachLiveKitAudioOnce`, `getLiveKitTrackKey`) — não achei um ponto onde essas trilhas se
misturam na via principal (LiveKit SFU).

**Achado e também corrigido nesta ADR:** no modo de contorno P2P (mesh, usado só quando o LiveKit
está fora do ar ou a flag manual `pherielium_p2p_fallback` está ligada — **desligada por padrão**,
ADR-0006), o manipulador de `ontrack` de áudio (`useVoiceCall.ts`, `pc.ontrack`) mantinha só uma
trilha de áudio por participante: ao chegar uma trilha nova, removia a anterior do `MediaStream` do
peer. O P2P não rotula a origem da trilha como o LiveKit faz (`ScreenShareAudio` vs microfone), então
se alguém compartilha a tela com áudio do PC **e** fala ao mesmo tempo nesse modo de contorno, uma
trilha substituía a outra — quem chegasse por último "ganhava", a voz sumia ou o áudio da tela nunca
entrava.

## Decisão
1. `cleanUpCall()` chama `stopMicMonitoring()` logo depois de `stopRingtone()`, fechando o
   `AudioContext` do monitoramento (se estiver aberto) toda vez que uma chamada termina ou é trocada
   por outra. O ajuste "Ouvir o próprio microfone" continua salvo entre chamadas (preferência da
   pessoa), só o recurso de verdade (o `AudioContext`) passa a não vazar.
2. No `ontrack` de áudio do P2P, uma trilha só é removida do `MediaStream` do peer quando ela
   mesma já **encerrou** (`readyState !== "live"`) — nunca mais por causa de uma trilha diferente
   chegando. As duas (voz e áudio da tela) ficam vivas no mesmo stream; o elemento que reproduz o
   stream mixa as duas automaticamente (comportamento padrão de `<audio>`/`<video>` com várias
   trilhas de áudio). Ganhou também `onmute`/`onunmute` (como o vídeo já tinha): parar a
   transmissão usa `replaceTrack(null)` no lado de quem envia, que nunca dispara `onended` no
   receptor, só deixa a trilha muda — sem isso ela ficava presa, viva e muda, para sempre.
   **Não mexido:** vídeo da câmera vs. vídeo da tela no P2P tem a mesma colisão (um substitui o
   outro), mas é um caso raro (câmera ligada *e* compartilhando tela ao mesmo tempo) e não foi o
   que foi pedido — só áudio.

## Consequências
- Uma sessão com várias chamadas não acumula mais `AudioContext`s abertos pelo monitoramento.
- Ligar "Ouvir o próprio microfone" numa chamada nova continua exigindo o toggle de novo (preset
  salvo, mas o pipeline em si nunca religava sozinho — comportamento não mudou aqui).
- Falar e compartilhar a tela com áudio do PC ao mesmo tempo no modo de contorno P2P não derruba
  mais uma das duas faixas.
- Sem controle de volume independente entre voz e áudio da tela no P2P (as duas tocam juntas, um
  só volume) — o LiveKit SFU, caminho principal, já tinha isso corretamente (`attachLiveKitAudioOnce`);
  o P2P nunca teve, e dar isso a ele exigiria manter as duas em `MediaStream`s separados com
  elementos de reprodução próprios — maior que o pedido cobre.
- Se o retorno/eco ainda aparecer depois desta correção, provavelmente é outra causa: acústica
  (microfone captando o próprio alto-falante, sem fone) ou algo do lado do LiveKit (caminho
  principal), não mais este bug específico do P2P. Me diga se persiste e em que cenário exatamente
  (fone ou caixa, você ou a outra pessoa compartilhando, 1:1 ou canal com várias pessoas).

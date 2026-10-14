# ADR-0011: Fecha o monitoramento do próprio microfone ao encerrar a chamada

- Status: **Aceito** (pedido do dono, 2026-10-14: "separar as faixas de áudio para não ter
  retorno nas chamadas e nem nos canais de voz").

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

**Encontrado, mas fora do alcance desta correção:** no modo de contorno P2P (mesh, usado só
quando o LiveKit está fora do ar ou a flag manual `pherielium_p2p_fallback` está ligada — **desligada
por padrão**, ADR-0006), o manipulador de `ontrack` de áudio (`useVoiceCall.ts`, por volta da linha
2685) mantém só uma trilha de áudio por participante: ao chegar uma trilha nova, remove a anterior
do `MediaStream` do peer. Se alguém compartilha a tela com áudio do PC **e** fala ao mesmo tempo
nesse modo de contorno, uma trilha substitui a outra (quem chegou por último "ganha"), em vez de as
duas coexistirem. Não mexido agora: é o caminho de contorno, não o principal, e separar as trilhas
exigiria um `MediaStream` por tipo de trilha por participante em todo o pipeline de áudio P2P
(reprodução, medidor de fala, volume) — mudança maior do que o pedido cobre, e esse caminho é o que
a instrução anterior do dono marcou como "já funcionando" para não mexer.

## Decisão
`cleanUpCall()` chama `stopMicMonitoring()` logo depois de `stopRingtone()`, fechando o
`AudioContext` do monitoramento (se estiver aberto) toda vez que uma chamada termina ou é trocada
por outra. O ajuste "Ouvir o próprio microfone" continua salvo entre chamadas (preferência da
pessoa), só o recurso de verdade (o `AudioContext`) passa a não vazar.

## Consequências
- Uma sessão com várias chamadas não acumula mais `AudioContext`s abertos pelo monitoramento.
- Ligar "Ouvir o próprio microfone" numa chamada nova continua exigindo o toggle de novo (preset
  salvo, mas o pipeline em si nunca religava sozinho — comportamento não mudou aqui).
- Em aberto: o retorno descrito pode também vir do caminho P2P (acima) ou de uma causa acústica
  (microfone captando o próprio alto-falante, sem fone) que nenhuma mudança neste repositório
  resolve sozinha. Se o problema persistir depois desta correção, preciso saber: acontece com
  fone de ouvido ou caixa de som; só quando VOCÊ compartilha a tela, só quando é OUTRA PESSOA que
  compartilha, ou nos dois casos; e se o LiveKit está ativo nessa hora (`window.pherieliumCallFailures()`
  diria se caiu para P2P).

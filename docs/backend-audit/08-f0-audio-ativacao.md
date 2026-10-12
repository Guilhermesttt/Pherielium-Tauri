# 08. F0: por que o áudio da tela inteira não inicia (0x8000000E)

Data: 2026-10-12. Diagnóstico com **causa provada por experimento controlado** nesta máquina (Windows 11 build 26300.9457, 26H2). Nenhuma correção implementada.
Rótulos: `[VERIFICADO: arquivo:linha ou execução]` / `[INFERIDO]`.

## Sintoma
Ao compartilhar a tela inteira: "Áudio do PC indisponível; transmitindo apenas o vídeo. (ActivateAudioInterfaceAsync: ... (0x8000000E))". `0x8000000E` = `E_ILLEGAL_METHOD_CALL`.
O aviso vem de `useVoiceCall.ts` (bloco `startDesktopAudioCapture`), que engole o erro e segue só com vídeo.

## Causa raiz (PROVADA)
O caminho que o front usa, `desktop_audio_start` → `win_loopback::start_excluding_self` (`desktop_audio_start` em `src-tauri/src/commands/screen_capture.rs`), **nunca consegue iniciar**, por **dois defeitos independentes**:

1. **O completion handler não responde a `IAgileObject`.** `query_interface` só aceita `IUnknown` e `IActivateAudioInterfaceCompletionHandler` (`win_loopback.rs`, função `activate_excluding_self`, `query_interface`). A própria chamada `ActivateAudioInterfaceAsync` devolve `0x8000000E` (erro **síncrono**, linha `.map_err(|e| format!("ActivateAudioInterfaceAsync: {e}"))`, não o resultado da operação).
2. **`GetMixFormat` em cliente de process loopback devolve `E_NOTIMPL` (`0x80004001`).** O caminho antigo o chama logo depois da ativação e usaria o formato para `Initialize`. Mesmo corrigido o item 1, a captura falharia aqui.

### Experimento controlado (reproduzível)
Comandos: `cd src-tauri` e `cargo test --lib <nome> -- --ignored --nocapture`.

| Execução | Resultado |
| --- | --- |
| `legacy_activation_hresult` (caminho antigo, **sem alterar nada**) | `ActivateAudioInterfaceAsync: ... (0x8000000E)`. **Mesmo erro do usuário.** |
| O mesmo teste com **uma única mudança temporária**: o handler antigo passa a responder `IAgileObject` (revertida depois; o arquivo foi restaurado) | `activate_excluding_self: OK`; em seguida `GetMixFormat: ERRO 0x80004001 (E_NOTIMPL)` |
| `audio_capture::win::tests::getmixformat_on_process_loopback` (caminho **novo**, com `IAgileObject`) | ativação **OK**; `GetMixFormat` = `0x80004001` (hipótese do autor do módulo confirmada) |

Conclusão: o defeito 1 sozinho explica o erro do usuário; o defeito 2 apareceria em seguida. O **módulo novo** `src-tauri/src/commands/audio_capture/` já resolve os dois (handler agile em `win.rs:159-192`, formato fixo com lista de tentativas em `win.rs:116-128`, em vez de `GetMixFormat`), mas só está ligado a `desktop_audio_capabilities` e `desktop_audio_selftest`; **o front nunca chama o módulo novo** (`lib.rs:13,203-204,269`).

## As cinco perguntas

**1. Thread e apartamento COM.** `start_excluding_self` cria uma `std::thread` dedicada ("desktop-audio-exclude"), fora do runtime do tokio, que chama `CoInitializeEx(None, COINIT_MULTITHREADED)` ignorando o resultado (`let _ =`) e desfaz com `CoUninitialize` incondicional. Ou seja, **MTA** [VERIFICADO no código; o log novo imprime o apartamento real via `CoGetApartmentType`]. Espera o resultado com `mpsc::recv_timeout(3 s)` no handler, sem `IAgileObject`. O módulo novo só faz `CoUninitialize` se o `CoInitializeEx` deu certo (`ComGuard`, `win.rs:76-95`).

**2. Monitor vs janela/jogo.** O front tem **um único caminho**: `startDesktopAudioCapture()` → `desktop_audio_start` sem parâmetros, sempre `EXCLUDE_TARGET_PROCESS_TREE` com o PID do próprio app (`win_loopback.rs`, `TargetProcessId: std::process::id()`), formato do `GetMixFormat`. Não há ramo por superfície. Os modos `Game` (INCLUDE) e `System` existem em `audio_capture/source.rs` mas **não estão ligados**. Se a transmissão por janela "funciona", é por outro caminho, provavelmente o áudio do `getDisplayMedia` quando a captura de desktop falha (`withAudio: includeAudio && !desktopAudio` em `useVoiceCall.ts`, e o aviso "Áudio indisponível para esta superfície"). **Preciso confirmar com você qual cenário tem áudio.**

**3. Ciclo de vida.** O caminho antigo usa um contador de geração (`DESKTOP_AUDIO_GEN`): `start` incrementa e `stop` incrementa **sem esperar** a thread anterior terminar; um stop seguido de start rápido pode ter duas ativações sobrepostas até a primeira notar a mudança de geração (laço com `sleep(8 ms)`). **Não é a causa** do erro (nenhuma ativação chega a existir). O módulo novo tem `CaptureManager` com sessão única, `Drop` que junta as threads e estados `Idle/Starting/Running/Stopping` testados.

**4. Log (flag `pherielium_stream_debug`).** Implementado e sem alterar comportamento: o front liga o diagnóstico no Rust (`stream_debug_set`) e imprime os eventos `stream-debug:desktop-audio`: `start` (caminho, modo, PID alvo, build do Windows, geração, se havia geração anterior), `com` (HRESULT do `CoInitializeEx` e apartamento), `activate` (ok ou erro com HRESULT extraído) e `get_mix_format`. O build vem do registro (`CurrentBuildNumber`, já usado pelo módulo novo) e **não** de `RtlGetVersion`, porque este exigiria habilitar uma feature nova da crate `windows` (dependência) sem aviso.

**5. Documentação oficial e sample.**
- [ActivateAudioInterfaceAsync](https://learn.microsoft.com/en-us/windows/win32/api/mmdeviceapi/nf-mmdeviceapi-activateaudiointerfaceasync): o handler precisa ser agile; para `E_ILLEGAL_METHOD_CALL` a página diz que "on versions of Windows previous to Windows 10, this error may result if the function is called from an incorrect COM apartment, or if the passed `IActivateAudioInterfaceCompletionHandler` is not implemented on an agile object". **Ressalva:** a página limita isso ao Windows anterior ao 10, mas o experimento mostra que **no Windows 11 build 26300 o erro ocorre sem `IAgileObject`**. Vale o experimento, não o texto.
- [Application loopback audio capture (sample)](https://learn.microsoft.com/en-us/samples/microsoft/windows-classic-samples/applicationloopbackaudio-sample/): exige Windows 10 build 20348 ou superior; ativa com `VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK` e `PROPVARIANT` `VT_BLOB` apontando para `AUDIOCLIENT_ACTIVATION_PARAMS`; usa `FtmBase` no handler (agilidade); `Initialize` com `AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK | AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM` e **formato montado à mão** (PCM 16 bits, 2 canais, 44,1 kHz), **sem** `GetMixFormat`. Código: [LoopbackCapture.cpp](https://github.com/microsoft/windows-classic-samples/blob/main/Samples/ApplicationLoopback/cpp/LoopbackCapture.cpp).

### Comparação com o nosso código

| Item | Sample da Microsoft | `win_loopback.rs` (em uso) | `audio_capture/win.rs` (não ligado) |
| --- | --- | --- | --- |
| Handler agile (`IAgileObject`) | sim (`FtmBase`) | **não** | sim |
| Formato | fixo, montado à mão | `GetMixFormat` (**E_NOTIMPL**) | fixo, lista de 4 tentativas |
| Flags de `Initialize` | LOOPBACK + EVENTCALLBACK + AUTOCONVERTPCM | só LOOPBACK, laço com `sleep(8 ms)` | LOOPBACK + EVENTCALLBACK (+ AUTOCONVERTPCM, SRC_DEFAULT_QUALITY) |
| Espera | evento | `mpsc` com timeout de 3 s | `mpsc` com timeout de 3 s |
| Modo | include ou exclude | só exclude (PID do app) | include, exclude |

## Correção proposta (NÃO implementada; aguarda o OK do dono)
**Ligar o módulo `audio_capture` aos comandos que o front já chama**, em vez de remendar o caminho antigo:
1. `desktop_audio_start` passa a usar `select(CaptureMode::ExcludeSelf, probe(), None)` + `build_source` + `CaptureManager` (estado do Tauri), com um `PacketSink` que converte o pacote f32 para s16 em base64 e emite `screen-share:audio` com **o mesmo payload de hoje** (`pcm`, `sampleRate: 48000`, `channels: 2`, `format: "s16le"`), usando `emit_to("main", ...)`. O front não muda.
2. O erro vira o tipo `AudioCaptureError` (código estável) e o aviso do front passa a dizer o motivo.
3. `desktop_audio_stop` para a sessão do `CaptureManager`.
4. Remover `start_excluding_self`, `run_excluding_self`, `activate_excluding_self` e `drain_packets` do caminho antigo (o medidor de nível do overlay em `win_loopback.rs` **não** é afetado).
5. Testes: unitário do conversor f32→s16 e do payload; manual com 2 contas (P-10) incluindo uma chamada com voz durante a transmissão, para **não regredir** o áudio da voz nem o recorte do sistema.
- Esforço: 2 a 3 dias. Risco: taxa de eventos IPC (pacotes de 10 ms, parecido com o de hoje) e eco da voz se o modo de exclusão estiver errado (por isso o modo inicial é o mesmo de hoje, `ExcludeSelf`).
- **Efeito no plano:** a F1 (excluir só a árvore do WebView2) fica **condicional**: a hipótese "jogos lançados pelo hub ficam na árvore excluída" continua plausível, mas **nunca foi observável** porque a captura não iniciava. Só se reavalia depois desta correção, com o P-10 refeito.

## Hipóteses restantes
- A hipótese da árvore excluída (R8 de `02-rust.md`) continua **não provada**; precisa do P-10 com a captura funcionando.
- Se a transmissão por janela tem som hoje, falta saber por qual caminho (item 2 das perguntas).

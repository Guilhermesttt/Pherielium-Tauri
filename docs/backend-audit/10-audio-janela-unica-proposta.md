# 10. Política de áudio da transmissão: tela inteira x janela (PROPOSTA, não aplicada)

Data: 2026-10-12. Rótulos: `[VERIFICADO: arquivo:linha]` / `[INFERIDO]`.

## Problema
O áudio nativo (`audio_capture`, modo `ExcludeSelf`) é **o sistema inteiro menos o Pherielium**. Em uma transmissão de **janela**, isso manda para a chamada músicas e notificações de outros apps que não estão na janela escolhida.
[VERIFICADO: `src-tauri/src/commands/audio_capture/mod.rs`, `SCREEN_SHARE_MODE = ExcludeSelf`.]

## Estado atual do fluxo [VERIFICADO: `useVoiceCall.ts` `startScreenShare`]
1. O usuário abre o modal de qualidade (`ScreenPickerModal`), que **já tem** a caixa "áudio" (`withAudio`, padrão ligado, lembrada em `pherielium_screen_share_prefs`).
2. `startScreenShare` inicia o áudio nativo **antes** de abrir o seletor nativo do `getDisplayMedia`.
3. Só depois o usuário escolhe tela ou janela. Ou seja, **a superfície ainda não é conhecida quando o áudio sobe**.

## Proposta
| Superfície | Áudio do PC | Como o usuário muda |
| --- | --- | --- |
| Tela inteira (`monitor`) | ligado (se a caixa "áudio" estiver marcada) | desmarcar a caixa |
| Janela (`window`) ou aba | **desligado por padrão** | caixa **"incluir áudio do PC"** no mesmo modal de qualidade |
| Superfície desconhecida | tratada como janela (conservador) | mesma caixa |

Mudanças necessárias (quando aprovadas):
1. Pura `decideDesktopAudio({ surface, includeAudio, includePcAudioForWindow })` com tabela de testes.
2. Reordenar: chamar `getDisplayMedia` (vídeo) **primeiro**, ler `videoTrack.getSettings().displaySurface`, e só então decidir iniciar o áudio nativo. O custo é o áudio começar ~100 a 300 ms depois do vídeo.
3. Modal: reaproveitar o componente de caixa que já existe (`withAudio`), sem estilos novos. Como a superfície ainda não é conhecida no modal, a caixa fica **sempre visível**, com o texto "incluir áudio do PC (em janela, tudo que não for o Pherielium)".
4. Aviso único se o usuário pediu áudio e a política o desligou ("Janela: áudio do PC desligado. Marque 'incluir áudio do PC' para enviá-lo.").

## `displaySurface` é confiável no WebView2?
- [VERIFICADO: `screenShare.ts:168`] o código já lê `getSettings().displaySurface === "monitor"` (campo `isMonitorShare`), mas **nada o usa hoje**, então não há prova de runtime.
- [INFERIDO] O WebView2 é Chromium, que preenche `displaySurface` ("monitor" | "window" | "browser") para `getDisplayMedia`. Em WebView2 o seletor é o do próprio Chromium/Windows, então o valor deve existir; mas **não foi medido neste app**.
- **Como provar antes de decidir:** uma linha de diagnóstico atrás de `pherielium_stream_debug` que registre `displaySurface` e `cursor` ao iniciar a transmissão, rodando 3 casos (tela inteira, janela, aba/Edge). Se `displaySurface` vier `undefined` em algum caso, vale a linha "desconhecida = janela".

## Alternativa se não for confiável
Decidir **só pela caixa** (sem ler a superfície): a caixa "áudio do PC" liga/desliga para qualquer superfície, com o texto avisando o que vai junto. Não depende de `displaySurface`, nem de reordenar a captura. Perde a proteção automática para janela (o usuário precisa lembrar de desmarcar).

## O que revisar
1. Reordenar a captura muda o tempo de subida do áudio e o que acontece se o usuário cancela o seletor (hoje o áudio nativo já subiu e é parado no `catch`).
2. O padrão "janela = sem áudio" muda o comportamento de quem hoje transmite janela de jogo e espera ouvir o jogo (o áudio de um jogo em janela também é "sistema menos Pherielium"). Isso pede um aviso na primeira vez.
3. O áudio por processo (incluir só o PID da janela) resolveria de verdade, mas a API de loopback por processo (`INCLUDE_TARGET_PROCESS_TREE`) precisa do PID do dono da janela escolhida, que o `getDisplayMedia` não informa. Fica como evolução (F1/backlog), não como parte desta proposta.

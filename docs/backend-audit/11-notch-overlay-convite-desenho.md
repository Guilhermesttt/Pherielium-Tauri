# 11. Convite de call no notch e no overlay do jogo (DESENHO; implementado como N-invite, ver `docs/invite-notifications.md`)

Data: 2026-10-12. **Aguarda OK do dono.** É **pré-requisito para ligar `pherielium_invite_notifications` por padrão** (sem isto, com a flag ligada, quem joga em tela cheia ou usa só o notch não vê o convite).
Rótulos: `[VERIFICADO: arquivo:linha]` / `[INFERIDO]`.

## Situação hoje (flag ligada)
- Notch: o convite aparecia por `callState === "ringing-in"` (`DesktopNotch.tsx:938`, `hubInvite`; UI de atender em `:1245-1252` e `:1598-1621`). Com a flag o app não entra mais nesse estado: **o convite some do notch** (regressão conhecida).
- Overlay do jogo: `VoiceCallContext.tsx:236-270` dispara `showNotificationOverlay({type:"incoming-call"})` só em `ringing-in`. O `OverlayApp` já trata `incoming-call` (duração mínima 40 s, botões de atender/recusar, `OverlayApp.tsx:987-1010`). Com a flag, **nada é enviado**.
- Hub oculto (jogo em tela cheia): o toast do hub é invisível; só o som toca. Não existe notificação nativa do Windows em uso: `tauri-plugin-notification` está registrado (`lib.rs:50`), a permissão existe (`capabilities/default.json`) e `@tauri-apps/plugin-notification` já está no `package.json`, mas **há zero chamadas** no código.

## Desenho mínimo

### Opção recomendada: reaproveitar o que já existe, trocando só a FONTE do convite
O hub passa a expor `pendingInvite` (o primeiro convite pendente do `inviteStore`, já existente) e `acceptPendingInvite(key)` / `dismissPendingInvite(key)`.

1. **Notch:** `hubInvite = ringing-in ? incomingInvite : pendingInvite` (um `??`). A UI de atender/recusar existente é reaproveitada: Aceitar chama `acceptPendingInvite`, Recusar chama `dismissPendingInvite`. Sem tipo novo de evento, sem tocar na fila de eventos transitórios.
2. **Overlay:** o efeito de `VoiceCallContext.tsx:236` passa a também reagir a `pendingInvite`: envia `showNotificationOverlay({type:"incoming-call", duration: 15 min, ...})` e `dismissNotificationOverlay` ao aceitar, dispensar, cancelar ou expirar. O overlay já mantém a notificação até o "dismiss".
3. **Sem toque:** o toque vem de `playRingtone`, que o fluxo I0 nunca chama. Conferir se o notch toca som próprio com `incomingInvite` (`moodHasOwnSound`, `DesktopNotch.tsx:976`) e, se tocar, silenciar quando a fonte for `pendingInvite`.
4. **Hub oculto sem overlay de jogo:** notificação nativa via `@tauri-apps/plugin-notification` (já instalado, sem dependência nova). Limite [INFERIDO]: no desktop o plugin não devolve clique; o toast só avisa "abra o Pherielium". É a opção mais simples; só vale se o dono quiser cobrir esse caso.

### Alternativa (não recomendo): tipo novo `call-invite` no notch
Evento persistente com botão Entrar, na fila de `notchEvent.ts`. Exige duração "sem fim" num modelo que hoje tem durações fixas (`DURATION_MS`), prioridade sobre mensagens e conquistas, e testes novos da fila. Mais código, mais risco para o notch.

## Riscos
1. O notch e o `VoiceCallWindow` assumem `incomingInvite` + `callState`. O modal `IncomingCallModal` (`VoiceCallContext.tsx:277`) continua amarrado a `ringing-in`, então não deve abrir; conferir.
2. Humor do mascote (`excited` com `incomingInvite`): efeito desejado, mas é área "fora de escopo por padrão"; precisa de OK explícito.
3. Dois convites pendentes: o notch mostra um por vez (o mais antigo); o outro fica só na notificação do hub.
4. O overlay roda em outra janela: o aceitar volta ao hub por evento Tauri (`emit_to`, payload validado na borda). Hoje passa por `panelAction({kind:"voice-accept"})` (`OverlayApp.tsx:1593`), que assume `ringing-in`; precisa de uma variante com o id do convite.
5. Expirar com o overlay aberto: o `dismiss` precisa ser enviado também na expiração (hoje só o toast do hub expira sozinho).

## Esforço
| Parte | Estimativa |
| --- | --- |
| Hub: `pendingInvite`, accept/dismiss, testes | 0,5 dia |
| Notch (troca de fonte, sem som, testes) | 0,5 a 1 dia |
| Overlay (envio, dismiss, ação com id) | 1 dia |
| Notificação nativa (opcional) | 0,5 dia |
| Teste manual (tela cheia, notch ligado/desligado) | 0,5 dia |
| **Total** | **2,5 a 3,5 dias** |

## Critério para ligar a flag por padrão
Notch e overlay mostrando o convite com a flag ligada, sem toque, aceitar e recusar funcionando, cancelamento e expiração fechando as três superfícies (toast, notch, overlay).

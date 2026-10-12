# 05. Chamadas, salas de voz e Realtime: caminhos vivos, falhas e ameaças

Data: 2026-10-12. Somente leitura. Cobre WebSocket Engineer, parte de SRE e as ameaças visíveis **no cliente**. A parte que depende do
schema/RLS (`realtime.messages`, policies) e do código da API fica `[INFERIDO]`.

## 1. Mapa de caminhos: o que está VIVO e o que é legado

| Caminho | Estado | Quem chama quem (evidência) |
| --- | --- | --- |
| Mídia **LiveKit SFU** | **Vivo (primário)** | `useLiveKitPrimaryRef` inicia `true` (`useVoiceCall.ts:687`); `connectLiveKitRoom` (`:1905`); token em `livekitVoice.ts:50` |
| Mídia **P2P mesh** (RTCPeerConnection) | **Vivo como fallback**, mas assimétrico (ver 2.1) | `createPeerConnectionForPeer` (`useVoiceCall.ts:2369`), usado quando `!livekitConnected` (`:3129`) e na sinalização `call:signal` (`:2702`) |
| `PeerAudioNode` (Web Audio, ganho até 200%) | **Vivo só no P2P**; no LiveKit o áudio vem de `track.attach()` | `VoiceCallContext.tsx:104-125,162-180`: só roda se `mediaTransport === "p2p"` |
| Canal `user_inbox_{uid}` | **Vivo** (mensagens, status, convites) | `realtimeEventBus.ts:228` |
| Canal `user_calls_{uid}` | **Redundante** (duplica o inbox para `call:invite`/`call:end`/`call:answer`) | `inviteTransport.ts:20,41-72`. Mantido "para entrega garantida" (comentário `:62`); o receptor deduplica (`useVoiceCall.ts:2927`) |
| Canal `call_session_{chatId}` / `voice:room:{uuid}` | **Vivo** (estado: mudo, kick, privacidade, fim; e SDP no P2P) | `sessionSignaling.ts`, `channelLifecycle.ts:13-17` |
| Canal `checkpoint_presence_bus` + Presence | **Vivo e redundante** com o inbox (ver `03`) | `realtimeEventBus.ts:300-357` |
| `window.electronAPI.*` (compat Electron) | **Parcialmente morto** (várias funções no-op) | `tauriAPI.ts:538` |
| Captura de áudio `win_loopback.rs` | **Vivo** (o front chama `desktop_audio_start`) | `screen_capture.rs:353` |
| Módulo `audio_capture` | **Pouco usado** (só sonda e teste) | `lib.rs:203-204` |
| Captura de tela nativa (`screen_share_start_frames`, `screen_share_stop`, `screen_share_list_targets`) | **Vivo** | `tauriScreenCapture.ts:164,186,195`; `tauriAPI.ts:799` |

`sendCallInvite` tem dois chamadores: `startCall` (`useVoiceCall.ts:3111`) e o convite para canal (`ChannelInviteModal.tsx:61`) [VERIFICADO: `grep`].
Não achei código de canal sem chamador; o que há é **redundância** (dois canais para o mesmo convite).

## 2. Falhas no ciclo de vida da chamada 1:1

### 2.1. Fallback P2P assimétrico: quem liga cai para P2P, quem atende não (alta) `[VERIFICADO]`
`shouldUseP2PFallback("start-call")` devolve `true` para **qualquer** erro (`transportPolicy.ts:19-21`), e `startCall` o usa
(`useVoiceCall.ts:3095`). Para quem atende (`answer-call`) só devolve `true` se o LiveKit estiver desabilitado globalmente (`transportPolicy.ts:22-23`).
Resultado: se o token do LiveKit falhar só para quem ligou (Render frio, 401, rede), o chamador vai para P2P e o destinatário conecta no SFU: **duas pessoas na
mesma "chamada" que nunca se encontram**. É o cenário "não consigo ouvir meu amigo numa call P2P".

### 2.2. Oferta P2P sem trilhas quebra com `max-bundle` (alta) `[VERIFICADO + INFERIDO]`
`startCall` adquire o microfone; se falhar (`acquireAudioStream` devolve `null`), apenas faz `setIsMuted(true)` e segue
(`useVoiceCall.ts:3031-3045`). Depois, no fallback, `createPeerConnectionForPeer` só adiciona trilhas `if (localStreamRef.current)` (`:2386-2395`) e a
conexão usa `bundlePolicy: "max-bundle"` (`:2381`). Uma oferta **sem nenhuma seção de mídia não tem grupo BUNDLE**, e o `setLocalDescription` falha com
`max-bundle configured but session description has no BUNDLE group` (`:3131-3132`), exatamente a mensagem do usuário. A causa de o microfone não ter sido adquirido não está
provada (`[INFERIDO]`: outra instância do app usando o mesmo microfone/dispositivo; o log mostra duas instâncias na mesma conta).
Correção candidata: garantir um `addTransceiver("audio")` antes de `createOffer`.

### 2.3. O convite só sai depois de a mídia conectar (alta) `[VERIFICADO]`
`startCall` aguarda `Promise.allSettled([runIcePreflightCheck(), connectLiveKitRoom(...)])` e **só depois** chama `sendCallInvite`
(`useVoiceCall.ts:3079-3118`). Com Render frio (token > 35 s) ou preflight lento, o destino demora a tocar. O cronômetro de "não atendeu" (35 s) só começa
depois do convite (`:3147-3158`).

### 2.4. Estado só no cliente, sem fonte de verdade (alta) `[VERIFICADO]`
`CallState = "idle" | "ringing-out" | "ringing-in" | "connecting" | "active"` (`types/domain.ts:261`). Não há `declined`, `missed`, `busy`, `canceled`, `ended`.
- **Ocupado:** decidido pelo cliente de quem recebe (`useVoiceCall.ts:2961-2967`). Se o app do destino estiver fechado, ninguém responde.
- **Perdida:** timer local de 35 s no destinatário (`:2944-2952`); **nada é gravado**. Chamada perdida com o app fechado é invisível.
- **Cancelada:** não há convite de cancelamento específico; quem liga envia `call:end` (`:3151`).
- Não há histórico de chamadas nem registro de duração.

### 2.5. `call:end` derruba qualquer chamada ativa sem verificar origem (alta) `[VERIFICADO]`
No receptor, `onEnd` para o estado `idle` retorna; para `ringing-in` compara `chatId`; **para qualquer outro estado (`connecting`/`active`) chama
`cleanUpCall()` sem comparar `chatId` nem `senderId`** (`useVoiceCall.ts:2969-2990`). Combinado com canais públicos (seção 3), qualquer cliente que
conheça o UID da vítima encerra a chamada dela.

### 2.6. Reconexão (média) `[INFERIDO]`
O receptor trata um convite repetido na mesma `chatId` como "o amigo reconectando" e responde `accepted: true` (`useVoiceCall.ts:2953-2960`) [VERIFICADO].
Não localizei uma máquina de reconexão da sessão; a recuperação parece depender de reenviar o convite [INFERIDO: não li o fluxo inteiro de `cleanUpCall`/reconexão do LiveKit].

## 3. Segurança do Realtime: forja de eventos (alta) `[VERIFICADO no cliente]` / `[INFERIDO: policies]`

**Fato:** nenhum `supabase.channel(...)` usa `private: true` (ver `01`, seção 4). Os nomes são previsíveis: `user_inbox_{uid}`, `user_calls_{uid}`,
`call_session_{uidA}_{uidB}`, `voice:room:{uuid}`. O UID de qualquer usuário aparece em listas de amigos/salas, e os UUIDs das salas públicas aparecem em `/rooms/public`.
Se não houver policies em `realtime.messages` (é preciso ver o schema), **qualquer cliente autenticado (ou com a chave `anon`) pode assinar e publicar** nesses canais.

Efeitos confirmados pela leitura dos handlers:

| Evento forjado | O que o receptor faz | Evidência |
| --- | --- | --- |
| `call:invite` para o inbox da vítima | toca o toque e mostra o nome/avatar enviados no payload | `useVoiceCall.ts:2926-2952` |
| `call:end` | encerra a chamada ativa (ver 2.5) | `:2969-2990` |
| `call:kick` com `adminId` = host | expulsa o usuário; a validação compara `kick.adminId` (do payload!) com o host, e **aceita qualquer coisa se `currentHost` for vazio** | `useVoiceCall.ts:2866-2874` |
| `call:privacy` | altera `roomConfig`/senha local sem verificar o remetente | `useVoiceCall.ts:2875-2897` |
| `call:signal` (SDP/ICE) | cria um `RTCPeerConnection` para o `senderId` do payload e aplica a oferta | `useVoiceCall.ts:2702-2730`; filtro por `targetUid` em `sessionSignaling.ts:44-50` é só de entrega |
| `u2u:message` | insere mensagem na conversa com `senderId` do payload | `chat.ts:238-247,732-746` |
| `u2u:status` | altera a presença de um amigo, se o `uid` do payload estiver na audiência | `realtimeEventBus.ts:71-75` |
| `u2u:friend_request/accepted/removed` | dispara toasts e atualiza listas | `realtimeEventBus.ts:256-270` |

Pior: se o servidor do Realtime permitir assinar o inbox de outro usuário, dá para **ler as DMs em tempo real** (o `ChatMessage` inteiro trafega no
broadcast) e **ler a presença de todos** pelo canal global `checkpoint_presence_bus`.

**Desenho que fecha isso (Fase 2):** canais `private: true` com policies em `realtime.messages` baseadas em `auth.uid()` e em participação; o evento autoritativo
(`ringing`, `ended`) nasce no servidor (RPC/Edge Function) e o cliente só espelha; payloads sem identidade do remetente (o servidor injeta `sender_id` do JWT);
chat persistente só via `postgres_changes` com RLS.

## 4. Salas de voz

- **Dois caminhos de escrita** para entrar e criar: API (`/api/voice/rooms/*`) e RPCs diretos do cliente (`join_voice_room`, `create_voice_room`, `update_voice_room`)
  com fallback automático (`voiceRooms.ts:272,521`). Regras de senha/limite podem divergir entre os dois `[INFERIDO]`.
- **Race de entrada:** a validação de `max_participants` existe no RPC por migration (`20261009140000_voice_rooms_max_participants.sql`, `20261009100200_voice_room_hardening.sql`
  fala em lock), mas a emissão do token LiveKit é separada e não está atrelada a esse lock `[INFERIDO]`. Conferir no SQL real.
- **Saída:** se a API falhar, o cliente faz `update voice_room_members set removed_at=...` direto (`voiceRooms.ts:526-545`): exige policy de UPDATE
  em linha própria `[INFERIDO]`.
- **Chat de sala** (`room_text_{id}`): `postgres_changes` em `voice_room_messages` (`RoomTextPanel.tsx:47`); depende de RLS.
- **Senha:** o front não lê mais `password_hash` (`grep` vazio em `src/`), e a migration `20261009120000_chat_rooms_rls.sql:51-64` revoga o SELECT da tabela e concede só as outras colunas
  [VERIFICADO]. **Resíduo:** `voice_rooms` está na publicação Realtime (`20260301130000...sql:12`) e a própria migration avisa que o `postgres_changes` "ainda pode entregar a linha completa, hash
  incluído" (`20261009120000...sql:74-75`). O front assina essa tabela (`voiceRooms.ts:699`). Confirmar no schema real; ver `07`.
- **Cadastro de entrada/saída**: sem webhook do LiveKit hoje; o estado de "quem está na sala" depende de o cliente avisar (`announceMemberJoinedOnce`,
  `call:member-joined/left`) `[VERIFICADO: useVoiceCall.ts:3121]`.

## 5. ICE/TURN

- Credenciais TURN do backend em cache de 10 min (`turnCredentials.ts:46-64`); em qualquer falha (inclusive 401) o cliente cai **em silêncio** para uma lista fixa de STUN
  públicos e para o **TURN comunitário `openrelay.metered.ca` com usuário e senha públicos (`openrelay`/`openrelay`) embutidos no bundle**
  (`turnCredentials.ts:27-45`) `[VERIFICADO]`. É um relay compartilhado, sem garantia de disponibilidade, que enxerga o tráfego (cifrado por SRTP, mas com metadados). O log só avisa em modo DEV (`:70`).
- CSP libera `*.metered.ca` (`tauri.conf.json`, `connect-src`).

## 6. Observabilidade e modos de falha (SRE)

- Não há `request_id`, métrica nem trace entre cliente e servidor; os erros são `console.warn`.
- Os `catch {}` vazios na camada de canais (ESLint baseline) escondem falhas de `removeChannel`, `unsubscribe` e `subscribe`.
- `getOrCreateChannel` devolve canal não inscrito após falhar (`channelLifecycle.ts:155-161`) e o `status` do canal só é consultável por `getChannelStatus`; **o UI não diz
  "convite não entregue"**.
- Modos de falha a testar: Render frio (>35 s), refresh token inválido (o caso do log do usuário: 401 em cascata e P2P sem trilha), queda de rede no meio da chamada, duas instâncias do
  app na mesma conta (`user_inbox_{uid}` tem **dois assinantes**: ambos tocam e ambos respondem "ocupado"/aceitam).

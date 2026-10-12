# 03. Presença, tempo real e detecção de jogo (WebSocket Engineer + Debugging Wizard)

Data: 2026-10-12. Somente leitura. A API do Render continua **PENDENTE** (ver `00-fontes.md`); o que ela faz com `/api/presence`
e `/api/friends/status` é `[INFERIDO]` do cliente.

## 1. Quantos mecanismos de presença existem (pergunta 9)

Cinco, em paralelo, sem uma fonte única de verdade:

| # | Mecanismo | Quem escreve | Quem lê | Evidência |
| --- | --- | --- | --- | --- |
| A | **HTTP** `POST /api/presence` a cada 25 s; grava `profiles.status/playing/presence_updated_at` (no servidor) | WebView (`Home.tsx:1286-1316`) | lista de amigos inicial (`AuthProvider.tsx:190-229`) e `GET /api/friends/status` a cada 12 s (`useFriendsSystem.ts:351-355`) | VERIFICADO |
| B | **Broadcast por amigo**: `httpSend` em `user_inbox_{amigo}` (`u2u:status`) a cada heartbeat e a cada mudança | WebView (`realtimeEventBus.ts:388-444`) | o amigo (`realtimeEventBus.ts:246-250`) | VERIFICADO |
| C | **Presence global** `checkpoint_presence_bus`: `track`/`untrack` do payload completo | WebView (`realtimeEventBus.ts:431-440`) | **todos** os clientes conectados; filtrado só no cliente por `isPresenceAudienceMember` (`realtimeEventBus.ts:62-75,309-352`) | VERIFICADO |
| D | **Broadcast global legado** `presence:status_update`, só quando não há audiência de amigos | WebView (`realtimeEventBus.ts:422-429`) | todos | VERIFICADO |
| E | Sessão de presença "do processo principal" (Electron): `setPresenceSession` | era o main do Electron; hoje **no-op** | n/a | VERIFICADO (`tauriAPI.ts:538-539`; comentário em `Home.tsx:1438`) |

**Fonte de verdade na prática:** o servidor (A) para o estado inicial e o polling; B/C para atualização instantânea. A reconciliação
usa `shouldAcceptPresence(incoming >= current)` (`presenceOrdering.ts`) comparando `updatedAt`. Mas o `updatedAt` dos eventos B/C é
`Date.now()` **do relógio do remetente** (`checkpointFriends.ts:126`), enquanto o de A é o relógio do servidor. Relógios diferentes
na mesma regra de ordenação são frágeis: um cliente adiantado vence o servidor indefinidamente; um atrasado perde para dados velhos
[VERIFICADO o uso; efeito INFERIDO].

## 2. Problema 1: amigo aparece OFFLINE quando o usuário entra num jogo

**Cadeia de causas, em ordem de confiança.** Nenhuma foi provada com log ainda: o pacote de testes (seção 6) fecha a prova.

**H1 (alta). O heartbeat vive só dentro do WebView, e o Rust esconde esse WebView quando o jogo abre.**
- Heartbeat: `window.setInterval(heartbeat, 25_000)` em `Home.tsx:1316`. O comentário em `Home.tsx:1312` fala em limite de **75 s**; o limite real
  é `PRESENCE_STALE_MS = 90_000` em `AuthProvider.tsx:9` (comentário e constante divergem) [VERIFICADO].
- Ao detectar o jogo, o watcher chama `conceal_main_window`, que faz `window.hide()` sem condição (`game_watch.rs:119-125`, chamada em `:263`) [VERIFICADO].
- No Electron havia um processo principal que mantinha a presença com a janela escondida (`setPresenceSession`); no Tauri essa função é no-op
  (`tauriAPI.ts:538`). Não existe heartbeat no Rust [VERIFICADO: nenhuma função de presença em `src-tauri/src`].
- Um WebView escondido/coberto tem timers estrangulados (Chromium: 1 Hz em segundo plano e cerca de 1 por minuto após 5 minutos escondido). Um
  intervalo de 25 s passa a disparar a cada ~60 s ou mais, e `getUsableSession()` + `fetch` dentro dele também dependem de timers. Basta um
  atraso para `presence_updated_at` ficar mais velho que 90 s [INFERIDO; medir].
- Quem vê o amigo aplica `isFresh = ... < PRESENCE_STALE_MS` e declara `offline` (`AuthProvider.tsx:214-220`) [VERIFICADO].

**H2 (alta). O evento `leave` do Presence vira OFFLINE imediato para todos.**
O handler `presence:leave` chama `deliverPresenceStatusUpdate({ status: "offline", updatedAt: Date.now() })` sem atraso nem confirmação
(`realtimeEventBus.ts:336-351`). O WebSocket do Realtime depende de heartbeats em timer; com a janela escondida e o timer estrangulado, o
servidor derruba o socket e emite `leave`. O `updatedAt: Date.now()` é do **espectador**, então vence qualquer estado anterior [VERIFICADO o código; INFERIDO o gatilho].
Há `cancelPendingLeave` e um mapa `presenceLeaveTimers`, mas **nenhum timer é criado**: a proteção contra "leave" espúrio está implementada pela metade
(`realtimeEventBus.ts:73,206-214`) [VERIFICADO].

**H3 (média). `pagehide`/`beforeunload` marcam offline** (`Home.tsx:1456-1457`), com `sendBeacon` e `fetch(keepalive)` para
`/api/presence?token=...` (`checkpointFriends.ts:151-196`). Se o WebView disparar `pagehide` ao esconder/suspender, o estado vira offline
sem o usuário sair. Não confirmado: o Tauri normalmente não dispara `pagehide` em `window.hide()` [INFERIDO; medir].

**H4 (design). "jogando" sobrescreve o status.** `status = currentPresenceGame ? "playing" : sharing ? "streaming" : inCall ? "in_call" : isManualDnd() ? "dnd" : idle ? "idle" : "online"`
(`Home.tsx:1292-1302`). Um usuário em Não Perturbe que abre um jogo aparece como "jogando". Contraria o desenho-alvo (atividade nunca substitui o status).

**H5 (média, lado de quem vê). Polling só com foco.** A lista de amigos só sincroniza se `document.hasFocus()` (12 s em
`useFriendsSystem.ts:351-355`; 60 s em `AuthProvider.tsx:847-851`). Quem está dentro de um jogo não atualiza a lista de amigos, e depois do
retorno ao hub o espectador vê dados velhos até o foco voltar.

**O que isso NÃO é:** não é throttle de CPU do jogo nem TTL curto demais isoladamente. O TTL de 90 s com heartbeat de 25 s é razoável
**se** os timers rodarem em tempo.

**Correção proposta (para a Fase 2, não aplicada):** heartbeat nativo em Rust (tokio, independente do WebView), com o token
renovado pelo front por evento; TTL no servidor; "jogando" como campo `activity` separado de `status`; `leave` só vira offline após uma janela de
graça (ex. 20 s) confirmada pelo TTL do servidor; relógio do servidor como único árbitro de ordenação.

## 3. Problema 2: jogo iniciado fora do hub, com o hub aberto, não é detectado

Causa raiz **[VERIFICADO por leitura de código; falta a confirmação por teste]**: existem duas vias de detecção e **ambas dependem de um lançamento
pelo hub**.

1. **Watcher no Rust (`game_watch.rs`).** Observa **um único alvo** (`target_executable`), definido por `game_watch_set_target`, que o front chama
   ao lançar um jogo (`Home.tsx:1384`) e que `launcher_open_executable` chama ao lançar (`launcher.rs:75-80`). Sem alvo, o loop faz `continue`
   eternamente (`game_watch.rs:213-229`). Nada define alvo para um jogo aberto fora do hub.
2. **Varredura no front (`useGamePresence.ts`).** Sem presença atual, a cada 10 s `verifyRunningState` → `syncDetectedRunningGame`
   (`useGamePresence.ts:477-478,507-515`) procura entre as `monitorableGames` (jogos **da biblioteca com executável resolvido**, `:332-340`).
   Mesmo achando o processo, o resultado passa por `shouldAllowBackgroundSessionConfirm` (`utils/sessionPolicy.ts:28-36`): só confirma se
   houver **sessão ativa** ou **lançamento pendente com menos de 3 min** (`PENDING_LAUNCH_MAX_AGE_MS`). Para um jogo aberto fora do hub não há nenhum dos dois,
   então `syncDetectedRunningGame` retorna `false` (`useGamePresence.ts:401-406`).
3. A "varredura inicial ao abrir o hub" (`Home.tsx:1407-1417`) usa a mesma função e cai no mesmo bloqueio.
4. Jogos fora da biblioteca nunca entram na lista monitorável.

**Efeito:** jogo aberto fora do hub → sem presença, sem sessão de tempo de jogo, sem overlay.
**Correção proposta (Fase 2):** fonte única do estado do jogo no Rust (varredura periódica de processos conhecidos da biblioteca + lista de
executáveis aprendidos), emitindo `emit_to("main", "game:state", ...)`; o front passa a espelhar. Registrar como ADR.

## 4. Salas e canais: reconexão e redundância

- `getOrCreateChannel` tenta 3 vezes com timeout de 12 s cada e atrasos de 1/2/4 s: **pior caso de ~43 s por envio** (`channelLifecycle.ts:55-60,130-139`).
  `sendCallSignal`, `sendCallAnswer` e `sendCallEnd` aguardam essa função antes de enviar [VERIFICADO: `sessionSignaling.ts:97-106`, `inviteTransport.ts:93-122`].
  O log do usuário mostra `Subscrição falhou ... (tentativa 1/3, status: TIMED_OUT)` repetido [VERIFICADO no log colado].
- Depois de esgotar as tentativas, `getOrCreateChannel` **devolve o canal mesmo sem estar inscrito** (`channelLifecycle.ts:155-161`), então
  `sendCallInvite` marca `delivered = true` quando o `send` não lança (`inviteTransport.ts:55-61`). "Entregue" não prova que o outro lado recebeu.
- Convite e `call:end` são enviados por **dois canais redundantes** (`user_calls_{uid}` e `user_inbox_{uid}`), e o receptor deduplica por uma chave
  `chatId:callerId:timestamp` e janela de 3 s (`useVoiceCall.ts:2927-2936`). O `call:end` **não** é deduplicado.
- `scheduleChannelIdleClose` e o mapa `channelRefCounts` fecham canais de inbox de destinatários após 30 s (`realtimeEventBus.ts:44,181-196`).
  O `@ts-ignore` na linha 194 e `catch {}` vazios acumulam dívida (ESLint baseline).

## 5. Capacidade (hipóteses a validar com carga)

Premissas **[INFERIDO]**, a verificar com teste:
- Cada heartbeat de cada cliente faz 1 `POST /api/presence` + **F** `httpSend` (um por amigo, em lotes de 20) + 1 `track` = F+1 requisições a cada 25 s.
  Com 1.000 usuários simultâneos e 50 amigos: ≈ 51.000 requisições por ciclo ≈ **2.000 req/s só de presença**. Isso pode estourar limites de
  mensagens/s do Realtime.
- O canal global `checkpoint_presence_bus` mantém todos os usuários numa única sala de Presence: cada entrada/saída gera difs para os N clientes
  (**O(N²)** mensagens) e cada cliente recebe o `presenceState` inteiro, **vazando nome, foto e "jogando" de todos os usuários conectados** para qualquer cliente
  (o filtro é só no front, `realtimeEventBus.ts:62-75`) [VERIFICADO o desenho; confirmar o vazamento no teste].
- Medir: mensagens/s, p95 de latência de `u2u:status`, uso de CPU do Realtime, tamanho do `presenceState` em 100/500/1.000 clientes simulados.

## 6. Pacote de testes manuais para esta área (para o dono; consolidado em `RESUMO.md`)

- **T-P1a (heartbeat estrangulado):** com `localStorage.debug_presence=1` (a criar na instrumentação), minimizar o hub por 10 min
  sem jogo e anotar os intervalos reais de heartbeat; repetir com um jogo em tela cheia aberto pelo hub. Esperado se H1 for verdade: intervalos > 60 s.
- **T-P1b (leave):** com 2 contas, abrir jogo na conta A e observar na B os eventos `presence:leave` (console) e `presence_updated_at` no banco.
- **T-P1c:** repetir com o jogo aberto **fora** do hub (isola H1/H2 do esconder-janela).
- **T-P2:** abrir um jogo da biblioteca fora do hub, com o hub aberto e visível por 60 s; anotar se aparece presença e sessão.

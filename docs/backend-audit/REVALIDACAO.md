# REVALIDACAO: os 10 achados de maior severidade, relidos com skills e documentação oficial

Data: 2026-10-12. Somente leitura (nenhum código alterado, `.env` não lido).

## Skills invocadas de verdade nesta etapa
Carregaram sem erro (8 de 8): `fullstack-dev-skills:security-reviewer`, `secure-code-guardian`, `websocket-engineer`, `rust-engineer`, `debugging-wizard`, `api-designer`,
`architecture-designer` e `the-fool`. Nenhuma falhou.
Ressalvas honestas: (1) o `the-fool` pede escolha de modo via pergunta interativa; a sessão não permite, então apliquei **pré-mortem + red team + auditoria de suposições**
juntos, sem a escolha do modo (ver PLAN.md, seção "Desafio"); (2) o `security-reviewer` manda rodar SAST/gitleaks/`npm audit`; **não os rodei** (a tarefa era
revalidar achados específicos, e `gitleaks`/`semgrep` não estão instalados, não verifiquei); (3) `postgres-pro`/`sql-pro`/`database-optimizer` continuam sem uso (aguardam o schema).

## Fontes externas consultadas (oficiais)
- Supabase, [Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization), [Realtime Settings](https://supabase.com/docs/guides/realtime/settings),
  [Realtime Limits](https://supabase.com/docs/guides/realtime/limits), [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes),
  [Broadcast](https://supabase.com/docs/guides/realtime/broadcast).
- Chrome, [Timer throttling no Chrome 88](https://developer.chrome.com/blog/timer-throttling-in-chrome-88).
- Microsoft, [WebView2 feature flags](https://learn.microsoft.com/microsoft-edge/webview2/concepts/webview-features-flags) (via busca; só o resumo foi lido).

Fatos extraídos da documentação (usados abaixo):
- **Canais públicos não têm checagem de policy**: com "Allow public access" ligado (o padrão), "anyone holding your project's anon key can subscribe to and broadcast on any public channel".
  Desligar essa opção faz o join de canal **não privado** ser recusado com `PrivateOnly`, e **"changing any setting on this screen disconnects all connected clients"**.
- Canal privado exige `config: { private: true }` no cliente **e** policies em `realtime.messages` (SELECT para receber, INSERT para enviar, por `extension` = `broadcast`/`presence`).
- Broadcast a partir do banco: `realtime.send(payload, event, topic, is_private)`; o padrão é privado.
- Limites (tabela da doc): **Free** 200 conexões, 100 msg/s, 20 eventos de presença/s; **Pro** 500 conexões, 500 msg/s, 50 eventos de presença/s; cada entrega conta como um evento.
- Postgres Changes: "by default each change event contains the full row"; a doc não fala em privilégios por coluna; acima de ~3.000 assinantes recomenda Broadcast.
- Chrome: throttling intensivo (1 execução/min) só vale se a página ficou **oculta > 5 min**, a cadeia de timers tem ≥ 5 elos e a página está **silenciosa há 30 s e sem WebRTC em uso**.
  Áudio tocando ou WebRTC em uso isentam.

## Achados revalidados

### 1. Realtime sem `private:true` e sem checagem de remetente: **CONFIRMADO, Crítica** (security-reviewer + secure-code-guardian)
- `grep` por `private` em `src/services`, `hooks`, `context`, `auth` só acha `p_is_private` de salas (RPC), **nenhuma** `config.private` de canal [VERIFICADO, `grep` desta sessão].
  Canais: `realtimeEventBus.ts:95,230,301,394`, `inviteTransport.ts:20`, `sessionSignaling.ts:34`, `channelLifecycle.ts:93`, `voiceRooms.ts:577,639`, `chat.ts:252,529,783`.
- O app funciona com canais públicos, então a opção "Allow public access" está **ligada** em produção (se estivesse desligada, o join falharia com `PrivateOnly`). Logo, pela documentação, **sem checagem de policy**
  [CONFIRMADO por documentação + comportamento observado; o painel não foi consultado].
- Forja confirmada por leitura dos receptores: `call:end` derruba chamada ativa (`useVoiceCall.ts:2969-2990`, só compara `chatId` no estado `ringing-in`);
  `call:kick` valida `kick.adminId === currentHost`, com `adminId` **vindo do payload**, e aceita tudo se `currentHost` for vazio (`:2866-2874`); `call:privacy` sem checagem (`:2875-2897`);
  `call:signal` cria `RTCPeerConnection` para o `senderId` do payload (`:2702-2704`); `u2u:message` aceita `receiverId === uid` do payload (`chat.ts:238-247`);
  `call:invite` toca com nome/avatar do payload (`useVoiceCall.ts:2926-2952`).
- **Novo, confidencialidade (confirma a pior hipótese):** `sendFastU2UMessage` publica o `ChatMessage` **inteiro, com o texto**, em `user_inbox_{uid}` (`chat.ts:350-368`, `realtimeEventBus.ts:449-466`).
  Como o canal é público e o nome é previsível, quem tiver a chave pública do projeto (está no bundle) e o UID da vítima pode assinar e **ler as DMs dela em tempo real**.
  Precondição: conhecer o UID (aparece para amigos e membros de sala). O mesmo vale para a presença de **todos** em `checkpoint_presence_bus`.
- Severidade mantida: **Crítica** (confidencialidade das DMs + integridade das chamadas). Esforço da correção real: L (precisa de protocolo v2, ver PLAN).

### 2. Chamada sem fonte de verdade no servidor: **CONFIRMADO, Alta** (api-designer + architecture-designer)
`CallState` tem 5 valores sem `declined/missed/canceled/busy/ended` (`types/domain.ts:261`); "ocupado" é decidido no cliente do destino (`useVoiceCall.ts:2961-2967`); "perdida" é um `setTimeout`
local de 35 s (`:2944-2952`); "não atendeu" é outro timer no chamador (`:3147-3158`); nada é gravado. Sem alteração de severidade.

### 3. Fallback P2P assimétrico: **CONFIRMADO e refinado, Alta** (rust-engineer não se aplica; api-designer/websocket-engineer)
- Quem liga: qualquer erro do LiveKit vira P2P (`transportPolicy.ts:19-21`; `useVoiceCall.ts:3095`).
- **Refinamento:** quem atende **não** entra num "P2P paralelo": `shouldUseP2PFallback("answer-call", ...)` devolve `false` (só `true` se o LiveKit estiver desligado globalmente) e o código **lança**
  `"Não foi possível conectar ao servidor de voz."` (`useVoiceCall.ts:3272-3278`). O destino ou conecta no SFU (e não encontra o chamador, que está em P2P) ou recebe um erro e desiste.
  A mensagem `max-bundle` do print do usuário vem do ramo do chamador (`:3128-3140`), quando o microfone não foi adquirido (`:3031-3045`) e a oferta sai sem m-line.

### 4. Problema 1, amigo OFFLINE ao entrar num jogo: **REFINADO, impacto Alta, causa NÃO provada** (websocket-engineer + debugging-wizard)
A hipótese H1 do `03-presenca-websocket.md` (timers estrangulados) fica **rebaixada** com a documentação do Chrome:
- Throttling intensivo (1/min) exige oculta > 5 min, cadeia ≥ 5 e silêncio. Um `setInterval` de 25 s vira ~1 execução/min. O limite de frescor é 90 s (`AuthProvider.tsx:9`), então sobram ~30 s de folga:
  **o throttling sozinho provavelmente não derruba a presença** (`Home.tsx:1316`, `AuthProvider.tsx:215`). Além disso, **estar em chamada isenta** (WebRTC em uso).
- Hipóteses reordenadas, cada uma com a medição que a separa das outras (para o P-1):

| Hip. | Descrição | Evidência no código | Medição que decide |
| --- | --- | --- | --- |
| H2 | `presence:leave` do canal global vira offline **imediato** (o heartbeat do Realtime é `setInterval` na thread principal; o cliente não ativa `worker`) | `realtimeEventBus.ts:336-351`; `presenceLeaveTimers` nunca recebe `set` (`:206-214`); `supabase.ts:32-43` sem `realtime.worker` | Realtime Inspector do painel Supabase: há `leave` do UID de A quando o jogo abre? |
| H8 | **Duas instâncias da mesma conta** (o dono estava assim): a presença usa `key = uid`; quando uma instância sai, o `leave` do `uid` marca offline mesmo com a outra viva | `realtimeEventBus.ts:301-307,336-351` | repetir P-1 com **uma** instância só |
| H7 | A API não aceita/trata `status:"playing"` e regrava outro valor | cliente envia `playing` (`Home.tsx:1292-1303`); **servidor desconhecido** | `select status, playing` logo após abrir o jogo (P-1) |
| H3 | `pagehide`/`beforeunload` do WebView marcam offline | `Home.tsx:1456-1457`, `checkpointFriends.ts:145-197` | log da API (pendente) ou `presence_updated_at`+`status='offline'` aparecendo no SQL |
| H1 | throttling > 5 min | rebaixada (ver acima) | intervalos de `presence_updated_at` > 60 s a partir de ~5 min |
- Observação nova: **o `setPresenceSession` do Electron era o heartbeat do processo principal**, hoje no-op (`tauriAPI.ts:538`). Isso continua verdadeiro e justifica o heartbeat nativo **se** o P-1 mostrar lacunas.

### 5. Problema 2, jogo aberto fora do hub não detectado: **CONFIRMADO, Alta** (rust-engineer + debugging-wizard)
- Watcher: um alvo só; sem alvo faz `continue` (`game_watch.rs:213-229`); o alvo só é definido por `game_watch_set_target` (`game_watch.rs:65`), chamado por `launcher.rs:76-78` e `Home.tsx:1384`.
- Varredura do front: `monitorableGames` só inclui jogos da biblioteca com executável resolvido (`useGamePresence.ts:332-340`); a confirmação passa por `shouldAllowBackgroundSessionConfirm` (`sessionPolicy.ts:28-36`) e retorna `false` sem sessão ativa nem lançamento pendente < 3 min (`useGamePresence.ts:401-406`).
- **Como provar (rápido, sem instrumentar):** abrir um jogo da biblioteca fora do hub e observar `presenceVerification` ficar `none` por > 60 s (P-4).
- **Risco novo para a correção:** jogos com anticheat/processos protegidos podem não expor o caminho do executável (`process.exe()` vem `None`), e a detecção por caminho exato falha (`process_identity.rs:28-34`) [INFERIDO]. O plano precisa de um fallback por nome do processo.

### 6. DM enviada offline se perde: **CONFIRMADO, Alta** (api-designer)
`chat.ts:390-418`: qualquer erro do `insert` (exceto 23505 com linha existente) cai em `return fastMsg` (id `fast_...`), a UI trata como enviada e **não há fila nem reenvio**.
Histórico: `HISTORY_LIMIT = 50` sem cursor (`chat.ts:6,704-709`). A idempotência por `client_id` existe e é boa (`:128-135,392-398`), **se** a migration `20261010120000` estiver aplicada ([INFERIDO]: ver `inputs/08`).

### 7. Convite só depois da mídia: **CONFIRMADO, Alta** (api-designer)
`startCall` aguarda `Promise.allSettled([runIcePreflightCheck(), connectLiveKitRoom(...)])` (`useVoiceCall.ts:3079-3082`) e só então `sendCallInvite` (`:3111`). `apiFetch` tem timeout de 15 s (`api.ts:5`) e o Render frio leva > 35 s (relato do dono).
Sem alteração.

### 8. Presença global: vazamento e capacidade: **CONFIRMADO; capacidade REAJUSTADA para pior** (websocket-engineer)
- Vazamento: `presenceChannel.track({ presence })` publica `displayName`, `photoURL`, `playing` (`realtimeEventBus.ts:437-439`) numa sala única e pública; o filtro é só no cliente (`:62-75`). Pela doc, qualquer portador da chave pública entra.
- **Capacidade, com os números oficiais:** o teto de **conexões simultâneas é 200 (Free) ou 500 (Pro)**: cada usuário é uma conexão. A minha estimativa anterior (≈ 2.000 req/s com 1.000 usuários) estava acima do teto de **500 mensagens/s (Pro)** e de **50 eventos de presença/s**. Hoje, com F+1 mensagens por usuário a cada 25 s,
  100 usuários × 20 amigos ≈ 84 mensagens/s, **já perto do limite do plano Free (100/s)** [INFERIDO: depende do plano e do uso real]. Preciso saber o plano (decisão do dono).

### 9. Problema 3, tela inteira sem áudio: **CONFIRMADO o desenho, causa INFERIDA com alta confiança** (rust-engineer)
- `launcher_open_executable` cria o jogo como filho do hub (`launcher.rs:46-73`: `DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP` só destacam console e grupo de sinais, não o pai).
- O front chama `desktop_audio_start` → `win_loopback::start_excluding_self` com `TargetProcessId: std::process::id()` e `PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE` (`screen_capture.rs:353-359`, `win_loopback.rs:461-462`).
- **Nuance:** jogos abertos pela **Steam** (URI) ou fora do hub **não** estão na árvore e teriam áudio; só os lançados por `launcher_open_executable` ficam mudos.
- **Prova:** P-10 (três cenários). **Correção candidata:** excluir só a árvore do **WebView2** (processo `msedgewebview2.exe` raiz, filho do app), não o app inteiro; o ID raiz se descobre por `sysinfo` (pai == `std::process::id()`), com erro tipado se não achar, nunca queda silenciosa.

### 10. `password_hash` via Realtime: **CONFIRMADO como risco residual, Média** (security-reviewer)
`voice_rooms` está na publicação Realtime (`migrations/20260301130000_enable_realtime_and_voice_room_rpc.sql:12`), o front assina a tabela (`voiceRooms.ts:699`) e a própria migration reconhece que o `postgres_changes` "ainda pode entregar a linha completa,
hash incluído" (`20261009120000_chat_rooms_rls.sql:74-75`). A doc oficial diz que o evento carrega "the full row" e **não menciona privilégios por coluna** (silêncio, não confirmação). O hash é `crypt()` (bcrypt via pgcrypto, `20261009100200...:64`), não texto puro.
Rebaixar de "vaza a senha" para **Média**: exposição do hash a membros que já veem a sala, atacável offline. Correção: mover o hash para tabela fora da publicação.

## Mudanças de severidade
| Achado | Antes | Agora |
| --- | --- | --- |
| 4 (causa da presença) | H1 alta | **H1 baixa**; H2/H8/H7 a medir |
| 8 (capacidade) | ~2.000 req/s | **teto de 200/500 conexões e 100/500 msg/s** |
| 10 | Média | Média (reescrito) |
| 1 | Crítica | Crítica (+ leitura de DMs) |
| demais | | confirmados |

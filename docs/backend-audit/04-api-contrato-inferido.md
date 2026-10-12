# 04. Contrato da API do Render, inferido do cliente (API Designer)

Data: 2026-10-12. **Status: PENDENTE.** O código do servidor não está no worktree (ver `00-fontes.md`). Tudo aqui é `[INFERIDO]` do que o
cliente envia e espera, exceto onde há `[VERIFICADO: arquivo:linha]` no próprio cliente. Quando o dono informar o caminho, revalidar cada linha.

## 1. Como o cliente fala com a API

- URL base: `https://checkpoint-launcher.onrender.com` por padrão em produção; `VITE_BACKEND_URL` pode sobrescrever
  [VERIFICADO: `src/services/api.ts:4,58-102`]. Em desenvolvimento usa o proxy do Vite (`vite.config.ts:58-73`) ou `http://localhost:8787`.
- `apiFetch(path, { authenticated })` coloca `Authorization: Bearer <access_token do Supabase>` e, em 401/431, faz **um** refresh compartilhado e
  **uma** nova tentativa [VERIFICADO: `api.ts:346-407`]. Nunca registra o token em log [VERIFICADO: `api.ts:398`].
- Timeout padrão 15 s (`DEFAULT_TIMEOUT_MS`, `api.ts:5`). O Render gratuito leva **mais que 35 s** para acordar (relato do dono). A mitigação
  existente é um ping `/health` no início do app (`App.tsx:308`, `api.ts:409-416`) [VERIFICADO], mas **sem espera nem repetição**: se o ping
  não terminar antes do primeiro uso, a primeira chamada de voz estoura os 15 s.
- Erros: o cliente espera `{ error: string }` em respostas não-OK e usa só `error` para a mensagem
  [VERIFICADO: vários, ex. `checkpointFriends.ts:80-83`]. Não há código de erro estável nem `request_id`.
- Versionamento: **não existe** (`/api/...` sem `/v1`). Mudar um contrato quebra instalações antigas.

## 2. Endpoints e o que o cliente assume

| Método e caminho | Corpo enviado | Resposta esperada | Evidência |
| --- | --- | --- | --- |
| `POST /api/presence` | `{ status, currentGameTitle }` | `2xx` ou `{ error }` | `checkpointFriends.ts:129-138` |
| `POST /api/presence?token=…&status=offline` (beacon) | `{ status:"offline", currentGameTitle:null, token }` | n/d | `checkpointFriends.ts:165-193`. **Token na query string e no corpo.** |
| `GET /api/friends/status` | n/a | `{ friends: UserProfile[] }` com `status`, `playing`, `updatedAt` | `checkpointFriends.ts:235-247` |
| `GET /api/friends/search?q=` | n/a | `{ users }` | `checkpointFriends.ts:29-40` |
| `POST /api/friends/{request,accept,reject,unfriend}` | `{ uid }` | `2xx` ou `{ error }` | `checkpointFriends.ts:44-97` |
| `GET /api/friends/:uid/profile` | n/a | `{ profile }` | `checkpointFriends.ts:444-453` |
| `POST /api/chat/open` | `{ friendUid }` | `{ chatId: uuid }` | `chat.ts:154-168` |
| `POST /api/voice/livekit-token` | `{ roomName, identity, name, metadata }` | `{ token, serverUrl }` ou `{ disabled:true }` | `livekitVoice.ts:50-87` |
| `GET /api/voice/turn-credentials` | n/a | `{ iceServers }` | `turnCredentials.ts:51-67` |
| `POST /api/voice/rooms` | config da sala | `{ room }` | `voiceRooms.ts:41-45` |
| `GET /api/voice/rooms/public?category&search` | n/a | `{ rooms }` | `voiceRooms.ts:395-415` |
| `GET /api/voice/rooms/my` | n/a | `{ rooms }` | `voiceRooms.ts:437-451` |
| `GET/DELETE /api/voice/rooms/:id` | n/a | sala / `2xx` | `voiceRooms.ts:455-465,540-550` |
| `POST /api/voice/rooms/:id/join` | `{ password, displayName, avatarUrl }` | `{ room, participants }` | `voiceRooms.ts:495-516` |
| `POST /api/voice/rooms/:id/leave` | n/a | `2xx` | `voiceRooms.ts:526-545` |
| `POST /api/social/activity` | atividade social | `2xx` ou `{ error }` | `socialActivity.ts:22-37` |
| `/auth/{steam,discord}/start`, `/api/{steam,epic,nexus,thegamesdb,gaming}/…`, `/api/proxy/image` | vários | vários | fora de foco desta frente |

## 3. Problemas de contrato visíveis no cliente

### C1. `identity` e nome vêm do cliente no pedido de token do LiveKit (alta, INFERIDO)
O cliente envia `identity` no corpo (`livekitVoice.ts:62-67`). Se o servidor usar esse valor em vez de `sub` do JWT, qualquer usuário
poderia entrar numa sala fingindo ser outro. **Precisa ser conferido no código da API.** O 401 do log mostra que o endpoint exige o JWT, mas não prova que ignora `identity`.

### C2. A autorização de sala 1:1 é só pelo nome (alta, INFERIDO)
O nome da sala 1:1 é `sort([uidA, uidB]).join("_")` calculado pelo cliente (`chat.ts: getChatId`; `useVoiceCall.ts:3006`). Para emitir token, o servidor
precisa checar que o chamador é um dos dois UIDs **e** que são amigos. O cliente apenas valida o formato (`livekitVoice.ts:41-47`).
Consequência já visível: usuários com id que não é UUID (Discord) são **recusados no cliente** antes de qualquer ida à rede (`livekitVoice.ts:55-61`).

### C3. Entrar na sala e pegar o token são dois passos independentes (alta, INFERIDO)
`/rooms/:id/join` e `/livekit-token` são chamadas separadas (`voiceRooms.ts:495`, `livekitVoice.ts:50`). Se o token não revalidar membership,
senha e `max_participants` no momento da emissão, dá para entrar na mídia sem passar pelo `join`. Há também o **caminho de fallback RPC
`join_voice_room` direto do cliente** (`voiceRooms.ts:521`), que contorna a API.

### C4. Fallback para o Supabase mascara erros de autenticação (média, VERIFICADO)
`shouldUseSupabaseVoiceFallback` só desiste do fallback se a mensagem contiver `"sessao expirada"`, `"sessão expirada"` ou `"auth"`
(`voiceRooms.ts:93-99`). A mensagem real do servidor é **"Token de autenticacao invalido."**, que **não contém `auth`** (`autenticacao`). Resultado: no log
do usuário a API recusou (401) e o app mesmo assim chamou o RPC (`[voiceRooms] API join failed; using Supabase RPC fallback: Error: Token de autenticacao invalido.`).
Um 403 de senha errada também cai no fallback e é reavaliado por outro caminho com regras possivelmente diferentes. O correto é decidir por **status HTTP** (só rede/5xx/timeout cai no fallback).

### C5. Token de acesso na query string (média, VERIFICADO)
`/api/presence?token=<jwt>&status=offline` (`checkpointFriends.ts:165-168,217-218`). URLs com token vão para logs de proxy/Render. Já existe o
header `Authorization` no `fetch` de fallback; `sendBeacon` não permite header, então a alternativa é um token de curta duração só para esse fim ou
endpoint com `keepalive` + header.

### C6. Sem idempotência nem `request_id` nos efeitos (média, INFERIDO)
`/friends/request|accept`, `/rooms/:id/join|leave` não enviam chave de idempotência. Um retry após timeout (15 s, cold start) pode duplicar efeitos.
Nas mensagens já existe `client_id` com índice único (`chat.ts:128-135,403`), bom padrão a copiar.

### C7. Respostas de listagem sem paginação (baixa, VERIFICADO no cliente)
`/rooms/public`, `/friends/status`, histórico de chat (`limit(HISTORY_LIMIT)`, sem cursor: `chat.ts:704-709`) não usam cursor.

### C8. Cold start e primeira chamada (alta para a experiência, ver `05-chamadas.md`)
Quem liga só envia o convite **depois** de `connectLiveKitRoom` (token) concluir (`useVoiceCall.ts:3079-3118`). Um Render frio atrasa o toque no destino.

## 4. Contrato novo sugerido (esboço; detalhar na Fase 2)

- `POST /v1/calls` cria sessão de chamada (`{ calleeId, client_request_id }`) e devolve `{ sessionId, state }`; estados e transições no servidor.
- `POST /v1/calls/:id/{accept,decline,cancel,end}` idempotentes; o servidor emite o evento para o participante autorizado.
- `POST /v1/voice/token` recebe só `{ sessionId | roomId }`; identidade vem do JWT; valida participação, limite e senha em transação.
- Erros em formato único `{ error: { code, message, request_id } }`.
- Webhook do LiveKit (`participant_joined/left`) confirma presença na mídia.

## 5. O que revalidar quando o código chegar
Cada linha da tabela da seção 2: autenticação, validação do corpo, quais tabelas toca e com qual chave (`anon` vs `service_role`), CORS, rate limit, e o
destino de `identity`. Ver também as perguntas de segurança em `RESUMO.md`.

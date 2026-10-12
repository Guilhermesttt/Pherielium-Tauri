# 01. Inventário do contrato atual (Spec Miner)

Data: 2026-10-12. Somente leitura. Rótulos: `[VERIFICADO: arquivo:linha]` ou `[INFERIDO]`.
Contagens vêm de `grep` no worktree em `c:\Users\Guilherme Sant'Ana\Documents\Pherielium-Tauri` (commit `e11e04d`).

## 1. Camadas e quem fala com quem

```
React/TS (WebView2)
  ├─ Tauri IPC ──────────► Rust (src-tauri): 150 comandos registrados
  ├─ HTTPS ──────────────► API no Render (checkpoint-launcher.onrender.com)   [código NÃO analisável: ver 00-fontes.md]
  ├─ HTTPS + WSS ────────► Supabase (PostgREST, Auth, Realtime)
  └─ WSS/WebRTC ─────────► LiveKit Cloud (SFU) e, no fallback, P2P via STUN/TURN
```

- 150 comandos em `generate_handler!` [VERIFICADO: `src-tauri/src/lib.rs:109`, contagem por script].
- O front chama o Rust por `invoke(...)` (124 nomes distintos) e pela camada de compatibilidade `window.electronAPI` em
  `src/lib/tauriAPI.ts`, herdada da versão Electron. Várias funções dessa camada são **no-op** (ex.: `setPresenceSession`)
  [VERIFICADO: `src/lib/tauriAPI.ts:538`].
- Eventos Rust→front: 12 nomes distintos emitidos. São **26 chamadas `.emit(` (broadcast) contra 1 `emit_to`** [VERIFICADO: `grep` em
  `src-tauri/src`]. Nomes: `game-watch:started/ended`, `screen-share:state`, `screen-share:audio`, `overlay:*`, `ptt:press/release`,
  `achievement:realtime-unlock`, `system:exit-confirmation-requested`.

## 2. Tabelas e views que o front acessa (via `supabase.from`)

| Tabela/view | Usos | Observação |
| --- | --- | --- |
| `user_games` | 16 | biblioteca do usuário |
| `profiles` | 12 | contém `status`, `playing`, `presence_updated_at` (escritos pela API; ver 03) |
| `public_profiles` | 7 | view/tabela pública de perfil |
| `voice_rooms` | 4 | salas de voz |
| `user_trophies`, `user_trophy_stats_view`, `level_progress`, `xp_events` | 3/1/1/1 | troféus e XP (só auditar) |
| `voice_room_messages`, `voice_room_members` | 2/1 | chat de sala e membros |
| `activities` | 2 | feed social |
| `friendships` | 1 | usada também por `postgres_changes` |
| `chat_messages`, `chat_participants`, `attachments` | em `src/services/chat.ts` | DMs |

`src/services/chat.ts` contém um byte NUL literal (linha 640, `.join("\x00")`). Isso faz o `grep` tratar o arquivo como binário e esconder
resultados. É inofensivo, mas deve virar `"\u0000"` [VERIFICADO: `src/services/chat.ts:640`].

## 3. RPCs chamadas pelo front

`join_voice_room`, `create_voice_room`, `update_voice_room`, `get_my_profile`, `purge_my_platform_data`, `toggle_chat_reaction`
(esta última em `src/services/chat.ts:471`). Há ainda RPCs usadas só pelo servidor, que o cliente não vê [INFERIDO].

## 4. Canais Realtime (quem publica / quem assina)

Nenhum canal usa `private: true` [VERIFICADO: todos os `supabase.channel(...)` em `src/` passam no máximo `config: { broadcast: { self: false } }`].

| Canal | Quem assina | Quem publica | Eventos |
| --- | --- | --- | --- |
| `user_inbox_{uid}` | o dono (`realtimeEventBus.ts:228`) | qualquer cliente que saiba o uid (`httpSend`, `realtimeEventBus.ts:141`) | `u2u:message`, `u2u:status`, `u2u:typing`, `u2u:read_receipt`, `u2u:friend_request/accepted/removed`, `u2u:custom`, `call:invite`, `call:end` |
| `user_calls_{uid}` | o dono (`inviteTransport.ts:20`) | qualquer cliente | `call:invite`, `call:end`, `call:answer` (duplica o inbox) |
| `call_session_{chatId}` (1:1) ou `voice:room:{uuid}` (sala) | participantes (`sessionSignaling.ts:34`, `channelLifecycle.ts:13`) | qualquer cliente | `call:answer/signal/state/kick/privacy/member-joined/member-left/end` |
| `checkpoint_presence_bus` | **todos** os clientes (`realtimeEventBus.ts:301`) | todos (`presence.track` + broadcast legado) | Presence `sync/join/leave`, `presence:status_update` |
| `public_voice_rooms` | todos (`voiceRooms.ts:577`) | todos | Presence de salas públicas |
| `voice_rooms_table_sync` | todos (`voiceRooms.ts:699`) | Postgres | `postgres_changes` em `voice_rooms` |
| `room_text_{roomId}` | membros da sala | via tabela | `postgres_changes` de `voice_room_messages` |
| `chat_{chatId}_{rand}`, `typing_{chatId}`, `user_chats_{uid}` | DMs (`chat.ts:783,529,252`) | cliente / Postgres | mensagens, digitação, lista de conversas |
| `friendships_realtime_{uid}` | o dono (`AuthProvider.tsx:798`) | Postgres | `postgres_changes` em `friendships` |
| `activities_feed` | todos | Postgres | feed social |
| canal de troféus | o dono | Postgres | desbloqueios (só auditar) |

Fonte de cada linha: arquivo e linha citados na própria coluna; os demais em `src/services/trophyUnlockStream.ts:71` e `socialActivity.ts:79`.

## 5. Endpoints da API do Render que o cliente chama (contrato INFERIDO)

Ver `04-api-contrato-inferido.md` para método, corpo e resposta esperados. Lista:
`/health`, `/api/friends/{request,accept,reject,unfriend,status,search,:uid/profile}`, `/api/presence`, `/api/chat/open`,
`/api/voice/{livekit-token,turn-credentials,rooms,rooms/my,rooms/public,rooms/:id,rooms/:id/join,rooms/:id/leave}`, `/api/social/activity`,
`/api/discord/disconnect`, `/auth/discord/start`, `/auth/steam/start`, `/api/steam/*`, `/api/epic/*`, `/api/nexus/*`,
`/api/thegamesdb/*`, `/api/gaming/news`, `/api/proxy/image`.

## 6. Variáveis de ambiente (somente nomes)

- `VITE_*` (vão para o bundle público): `VITE_BACKEND_URL`, `VITE_DISCORD_APPLICATION_ID`, `VITE_LIVEKIT_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`. **Nenhum nome sugere segredo de servidor.** `ANON_KEY` e `PUBLISHABLE_KEY` são chaves
  públicas por desenho (a segurança vem das policies RLS). O front só lê `import.meta.env.VITE_BACKEND_URL`, `VITE_LIVEKIT_URL`,
  `VITE_SUPABASE_*` [VERIFICADO: `grep import.meta.env`].
- No mesmo `.env` local existem nomes **sem** prefixo `VITE_` que são segredos de servidor: `SUPABASE_SERVICE_ROLE_KEY`, `LIVEKIT_API_KEY`,
  `LIVEKIT_API_SECRET`, `DISCORD_CLIENT_SECRET`, `GOOGLE_CLIENT_SECRET`, `STEAM_API_KEY`, `RAWG_API_KEY`. O Vite **não** os injeta no bundle
  (só `VITE_*`), e o Rust só lê `STEAM_API_KEY` em tempo de execução (`std::env::var`), sem `env!`/`option_env!`
  [VERIFICADO: `grep env!` em `src-tauri` vazio]. Mesmo assim, é um `.env` de servidor dentro da pasta do cliente: risco de vazamento
  por engano (ver RESUMO).
- Rust lê em runtime: `APPDATA`, `HOME`, `LOCALAPPDATA`, `PHERIELIUM_USER_DATA`, `PUBLIC`, `STEAM_API_KEY`, `TAURI_DEV_URL`, `USERPROFILE`, `XDG_PICTURES_DIR`.
- Não existe `.env.example` versionado [VERIFICADO: `git ls-files`].

## 7. Migrations versionadas (`supabase/migrations`, 17 arquivos)

Sem schema base e sem `config.toml`. Cobrem: RLS de participantes (2026-03-01), Realtime e RPC de salas, mensagens sociais e chat de sala,
mídia de perfil, guardas de `chat_messages` e `friendships`, hardening de salas, índices, dedupe de policies, `has_password`,
`toggle_chat_reaction`, privacidade de perfis, RLS de salas, caminho do pgcrypto, `max_participants`, personalização de sala e `client_id` de mensagens.
Revisão de RLS e índices fica para quando o schema chegar (`inputs/`).

## 8. Requisitos observados (EARS) do que o app faz hoje

- Quando o hub inicia, o sistema deverá enviar `POST /api/presence` a cada 25 s [VERIFICADO: `src/pages/Home.tsx:1316`].
- Quando o usuário chama um amigo, o sistema deverá conectar ao LiveKit **antes** de enviar o convite [VERIFICADO: `useVoiceCall.ts:3079-3118`].
- Quando o convite chega e a máquina está `idle`, o sistema deverá tocar por 35 s e então dar a chamada como perdida, apenas localmente
  [VERIFICADO: `useVoiceCall.ts:2944-2952`].
- Quando chega convite e já há outra chamada, o sistema deverá responder `busy` pelo cliente [VERIFICADO: `useVoiceCall.ts:2961-2967`].
- Quando o LiveKit falha na chamada 1:1, quem liga deverá cair para P2P; quem atende só cai se o LiveKit estiver desabilitado globalmente
  [VERIFICADO: `transportPolicy.ts:19-24`].

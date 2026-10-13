# Compatibilidade de protocolo e flags locais (A1, release 1.0.3)

Contexto: os canais Realtime do app são públicos e o app antigo (1.0.2 e anteriores) não se atualiza sozinho. Esta página descreve o que a 1.0.3 faz **sem quebrar o app antigo**.
O plano completo e os motivos estão em `docs/backend-audit/PLAN.md` e em `docs/decisions/0001-*.md`.

## Versão de protocolo (`pv`)

- `APP_PROTOCOL_VERSION = 2` (`src/lib/protocolVersion.ts`). Quem não envia `pv` é tratado como **protocolo 1** (app antigo).
- O app novo anexa `pv` (e `av`, a versão do app) em: payload de presença (`u2u:status`) e convite de chamada (`call:invite`).
  O app antigo ignora campos que não conhece, então nada quebra.
- Cada cliente aprende o `pv` dos amigos pelos eventos de presença que recebe (`src/services/peerProtocol.ts`, cache local de 14 dias).
  O `pv` vem de canal público e é forjável; o pior efeito de um `pv` falso é um amigo v1 receber a DM só pelo banco (mais lento), nunca perdê-la.
- **Não incluído de propósito:** metadados no token do LiveKit (`{avatar, pv, av}`). O servidor da API pode validar esse objeto; fica para depois de ler o código da API.

## Flags locais (`localStorage`, prefixo `pherielium_`)

| Flag | Padrão | Efeito |
| --- | --- | --- |
| `dm_ping_only` | ligada | `0` desliga: volta a enviar o texto da DM no fast-path também para amigos v2 |
| `presence_debug` | desligada | diagnóstico de presença (ver `docs/presence-diagnostics.md`) |
| `stream_debug` | desligada | diagnóstico de transmissão e do áudio da tela |

Valores aceitos: `1`/`true`/`on` e `0`/`false`/`off`. Para mudar: `localStorage.setItem("pherielium_<nome>", "0")` e reiniciar o app.

## DM sem texto no fast-path entre versões novas

Antes, cada mensagem era publicada com o **texto completo** em `user_inbox_{uid}`, um canal público. Agora, se o amigo já é protocolo >= 2,
o broadcast é **pulado** (mensagem nova e atualização/edição/reação) e ele recebe pelo **Postgres Changes** de `chat_messages` (INSERT e UPDATE com RLS), que o app já assinava (`chat.ts`).
Amigo v1 ou desconhecido continua recebendo o payload completo, porque o app antigo precisa dele.
**Efeito colateral:** entre dois apps novos a entrega depende do Postgres Changes (um pouco mais lento que o broadcast); a mensagem em si nunca deixa de ser gravada.

## Canal global de presença: o app novo só escuta

`checkpoint_presence_bus` é uma sala pública única; quem faz `track` nela entrega nome, foto e jogo a **todos** os clientes conectados (o filtro por amigos é no cliente).
O app novo **não publica mais** nesse canal (nem `track`, `untrack` ou broadcast legado) e **continua escutando** para o app antigo.
A presença instantânea para amigos segue pela caixa de entrada de cada amigo (`user_inbox_{uid}`, `u2u:status`) e pelo polling de `/api/friends/status`.
Sem `track`, este cliente também deixa de gerar eventos `leave` para quem ainda é app antigo (uma das fontes suspeitas de "offline" falso).
Flag para reverter: `localStorage.setItem("pherielium_presence_global_bus", "1")`.

## Filtros do receptor para eventos de chamada (modo "log" nesta release)

O receptor avalia cada evento de chamada que chega por canal público e decide se ele veio de quem deveria (`src/services/voiceCall/eventGuards.ts`):

| Evento | Aceito quando |
| --- | --- |
| `call:end`, `call:answer`, `call:signal` | é da conversa atual e o remetente é o par (1:1) ou o host/participante conhecido (sala) |
| `call:kick` | o alvo sou eu, é da sala atual e o `adminId` é o **host que este cliente conhece** (some o ramo "host desconhecido aceita tudo") |
| `call:privacy` | é da sala atual e vem do host conhecido |
| `call:invite` | o convidante é **amigo** (lista ainda não carregada = aceita) |

**Limite honesto:** o remetente vem do próprio payload. Os filtros barram abuso casual, não um atacante que conheça os UIDs envolvidos. O fechamento real é o protocolo v2 (canais privados).

**Modo** (`pherielium_event_guards`): `log` (padrão nesta release: avalia, conta e relata, **não bloqueia**), `enforce` (descarta o rejeitado), `off` (desliga e não conta).
O plano é virar `enforce` na release seguinte, ~1 semana depois, se o relatório mostrar que não há rejeição de evento legítimo.

**Relatório para colar** (conta por evento e desfecho, motivos e as últimas amostras; UIDs só com 4 caracteres):

```js
await window.pherieliumGuardReport()
```
Como ler: `would-drop` é o que seria descartado em `enforce`. Em uso legítimo (chamada normal entre amigos, sala, reconexão) o esperado é **zero** `would-drop`.
Se aparecer, o motivo (`wrong-chat`, `sender-not-peer`, `unknown-host`...) diz o que ajustar antes de ligar o `enforce`.

## Chamada 1:1 (D1): flags e diagnóstico

| Flag | Padrão | Efeito |
| --- | --- | --- |
| `channel_invite_ring` | desligada | no **remetente**: `1` volta a enviar o aviso de ligação junto com o convite de canal (o receptor toca como chamada); desligada, só o cartão no chat |
| `p2p_fallback` | desligada | `1` permite cair para P2P quando o LiveKit falha para um lado (o código P2P não foi apagado) |
| `call_invite_first` | ligada | `0` volta a enviar o convite só depois de a mídia conectar |

Falhas de mídia ficam registradas (razão, papel, tentativas, 4 caracteres da conversa) e saem em texto para colar: `await window.pherieliumCallFailures()`.
Motivos: `livekit_disabled`, `token_unauthorized`, `token_timeout`, `network`, `room_invalid`, `media_error`. Decisão completa: `docs/decisions/0006-chamada-sem-fallback-p2p-silencioso.md`.

## `call:state.isWatchingScreen` (R7)
O aviso de "estou assistindo à transmissão" é um campo novo e opcional do `call:state`. Apps antigos ignoram campos que não conhecem, então nada quebra; só quem tem o rc.6 conta espectadores.

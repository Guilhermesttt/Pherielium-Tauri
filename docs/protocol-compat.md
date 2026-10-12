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

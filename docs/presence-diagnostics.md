# Diagnóstico de presença (B0) e de áudio da tela (P-10)

Instrumentação **somente leitura**, desligada por padrão. Não muda comportamento. Serve para os testes P-1, P-2, P-3 e P-10 de `docs/backend-audit/RESUMO.md`.

## Ligar e gerar o relatório

No console do app (DevTools), em **cada conta de teste**:

```js
localStorage.setItem("pherielium_presence_debug", "1")   // presença (P-1 a P-3)
localStorage.setItem("pherielium_stream_debug", "1")     // áudio da tela (P-10)
```
Reinicie o app. Para gerar o texto para colar (também vai para a área de transferência):

```js
await window.pherieliumPresenceReport()
```
Desligar: `localStorage.removeItem("pherielium_presence_debug")`. UIDs saem truncados (4 caracteres) e nenhum token é registrado.

## O que é registrado (`pherielium_presence_debug`)

| Evento | Pergunta que responde |
| --- | --- |
| `heartbeat_tick` | o `setInterval` de 25 s disparou no horário? (`sinceLastTickMs`) |
| `heartbeat_sent` / `heartbeat_ack` | quando cada POST de presença saiu e se a API respondeu (`ms`, `httpStatus`, erro) |
| `visibility`, `window_focus`, `game_watch` | quando a janela foi escondida/exibida e quando o watcher achou o jogo (H1) |
| `offline_trigger` | qual evento pediu "offline": `pagehide`, `beforeunload`, `app-quitting` (H3) |
| `presence_channel_status` / `presence_key` | estado do canal global e a chave de presença; `createdWithoutListeners` indica canal criado sem ouvintes de join/leave |
| `presence_leave_raw` | chegou um `leave` do canal global (H2) e com qual chave/quantas presenças (H8) |
| `presence_received` | atualização que **este cliente recebeu** de um amigo: origem, status, `skewMs` (diferença de relógio) |
| `friend_poll` | o que `/api/friends/status` devolveu e a idade (`ageSec`) de cada amigo |

O relatório resume: heartbeats enviados (e quantos com a janela oculta), acks ok/falhos, intervalos mínimo/mediana/máximo, quantos passaram de 45 s, **instâncias vistas** (mais de uma = duas instâncias no mesmo log) e a linha do tempo dos eventos relevantes.

## Roteiro rápido (P-1, P-2, P-3), uma instância por conta

1. Conta A (jogador) e conta B (observador), cada uma com **um** app aberto e a flag ligada.
2. Em A, rodar no SQL Editor do Supabase a cada ~30 s por 10 min: `select status, playing, presence_updated_at, now() as agora from profiles where uid = '<uid de A>';`
3. **P-1:** A abre um jogo **pelo hub**. **P-2:** A abre o jogo **fora do hub** (hub visível). **P-3:** A minimiza o hub, sem jogo.
4. Ao fim, em A e em B: `await window.pherieliumPresenceReport()` e colar os dois textos. Anotar o horário em que B viu "offline".
5. Opcional: o Realtime Inspector do painel do Supabase, no canal `checkpoint_presence_bus`, mostra `join`/`leave` de A.

## P-10 (áudio da tela inteira)

Com `pherielium_stream_debug` ligada em quem transmite, o console mostra `[stream-debug:desktop-audio-started]` e, **a cada segundo**, `[stream-debug:desktop-audio-level]` com `packets`, `silentPackets`, `rms` e `peak`.
Compartilhe a **tela inteira com áudio** em três cenários e anote o nível: (a) jogo aberto **pelo hub**, (b) o mesmo jogo aberto **fora do hub**, (c) um vídeo no navegador.
Se (a) ficar com `silentPackets == packets` (rms 0) enquanto (b) e (c) têm som, a hipótese de que a captura exclui a árvore do hub se confirma.

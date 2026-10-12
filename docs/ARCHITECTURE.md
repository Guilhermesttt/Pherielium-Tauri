# Arquitetura do Pherielium

Gaming OS só para Windows. Este documento descreve o que existe **hoje** (versão 1.0.2) para quem vai ler ou contribuir.
Direções futuras estão em `docs/backend-audit/PLAN.md` e em `docs/decisions/` (ADRs).

## Camadas

```
React + TypeScript (WebView2)
  ├─ Tauri IPC ───────────► Rust (src-tauri): ~150 comandos
  ├─ HTTPS ───────────────► API própria (Render): presença, amigos, salas, tokens
  ├─ HTTPS + WSS ─────────► Supabase: Postgres (RLS), Auth, Realtime
  └─ WSS / WebRTC ────────► LiveKit Cloud (SFU) para voz e tela
```

- **Front (`src/`)**: interface e orquestração. Fala com o Rust por `invoke(...)` e por uma camada de compatibilidade herdada do Electron (`src/lib/tauriAPI.ts`, exposta como `window.electronAPI`); algumas funções dela são no-op.
- **Rust (`src-tauri/src/`)**: tudo que precisa do sistema operacional: detecção de processos e jogos, lançamento, captura de áudio e de tela, janelas, overlay, controle (ViGEmBus), sessões de jogo.
- **Supabase**: dados (perfis, amizades, mensagens, salas) com RLS; Auth; Realtime (Broadcast, Presence, Postgres Changes). Migrations em `supabase/migrations/` (o schema base não está versionado).
- **API (Render)**: código **fora deste repositório**. O cliente a chama por `apiFetch` (`src/services/api.ts`), que anexa o JWT do Supabase e faz um refresh de sessão compartilhado.
- **LiveKit**: transporte de mídia da chamada. O token vem da API.

## Mapa de módulos do front

| Pasta | Responsabilidade |
| --- | --- |
| `src/services/` | acesso a backend e a infraestrutura (API, Supabase, chat, amigos, salas de voz, LiveKit) |
| `src/services/voiceCall/` | peças da chamada: sinalização, canais Realtime, captura de tela, volume por faixa, diagnósticos |
| `src/hooks/` | estado e efeitos (`useVoiceCall`, `useGamePresence`, `useFriendsSystem`) |
| `src/context/` | provedores globais (`VoiceCallContext`) |
| `src/components/`, `src/pages/` | telas e componentes |
| `src/lib/` | utilitários e a ponte com o Tauri |
| `src/overlay/` | janela de overlay |

## Mapa de módulos do Rust

| Módulo (`src-tauri/src/commands/`) | Responsabilidade |
| --- | --- |
| `game_watch.rs`, `process_monitor.rs`, `process_identity.rs` | detecção do jogo e do processo; o watcher observa **um alvo** definido pelo front |
| `launcher.rs`, `launch_guard.rs` | lançar executáveis com validação de caminho, extensão, variáveis e argumentos |
| `audio_capture/` | captura de áudio do desktop (tabela de modos, sonda de capacidade); ainda pouco usada pelo front |
| `win_loopback.rs`, `screen_capture.rs` | captura de áudio e de tela usada hoje no compartilhamento |
| `store/sessions.rs` | sessões de tempo de jogo (abre, heartbeat, recupera órfãs) |
| `overlay.rs`, `achievements*.rs`, `emulator_detector.rs` | overlay e conquistas |
| `controller_config.rs`, `virtual_pad.rs`, `hardware.rs` | controle e drivers (ViGEmBus, HidHide) |

## Fluxo de dados: presença e jogo (hoje)

1. O Rust detecta o jogo lançado pelo hub (`game_watch_set_target`) e emite `game-watch:started/ended`; ao iniciar, **esconde a janela principal**.
2. O front (`useGamePresence`) confirma a sessão e abre/fecha o registro em `store/sessions.rs`.
3. A cada 25 s o front envia `POST /api/presence` e também faz broadcast aos amigos em canais Realtime; o amigo calcula "offline" se `presence_updated_at` passar de 90 s.

## Fluxo de dados: chamada 1:1 (hoje)

1. Quem liga adquire o microfone, conecta ao LiveKit e **só então** envia o convite pelos canais `user_calls_{uid}` e `user_inbox_{uid}`.
2. O destino toca por 35 s; "ocupado" e "perdida" são decididos no cliente. A sinalização de estado usa o canal `call_session_{chatId}`.
3. Se o LiveKit falhar para quem liga, ele cai para P2P; quem atende não (assimetria conhecida, corrigida no plano).

Todos os canais Realtime são **públicos** hoje; ver `docs/backend-audit/RESUMO.md` para as consequências e `docs/decisions/0001-*.md` para o plano de correção.

## Convenções e verificação
Ver `CLAUDE.md` (padrões, commits, verificação). Baselines de dívida: `docs/tech-debt/` (ESLint, clippy, dependências).

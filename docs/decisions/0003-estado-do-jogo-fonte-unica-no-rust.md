# ADR-0003: Estado do jogo com fonte única no Rust

- Status: **Proposto**. Data: 2026-10-12.

## Contexto
O watcher do Rust observa **um alvo**, definido só no lançamento pelo hub (`game_watch.rs:213-229`); a varredura do front só confirma com sessão ativa ou lançamento pendente < 3 min (`sessionPolicy.ts:28-36`).
Jogo aberto fora do hub não gera presença nem sessão. O estado vive duplicado entre o Rust e `useGamePresence.ts`.

## Decisão
Um módulo Rust (`game_state`) mantém o índice da biblioteca (enviado pelo front e validado), varre processos a cada 2 a 3 s em `spawn_blocking`, casa por caminho, diretório e nome do executável, e emite
`emit_to("main", "game-state:changed")`. Abre e fecha sessão em `store/sessions.rs`. O front passa a espelhar o evento. `game_watch_set_target` vira dica de prioridade.

## Alternativas
Manter a detecção no front: depende do WebView vivo e de timers; rejeitada. Event Tracing do Windows (ETW): mais preciso e mais complexo; adiada.

## Consequências
Presença e tempo de jogo deixam de depender do lançamento pelo hub. Risco: falsos positivos e processos protegidos sem caminho; mitigado com a flag `pherielium_ambient_game_detection` e medição de CPU no aceite.

# Clippy baseline (dívida técnica)

Medido em 2026-10-12 com `cargo clippy -- -D warnings` em `src-tauri`, no commit `16fa66f`
(nenhum código Rust foi alterado desde então). **19 erros**, todos preexistentes.
Critério de aceite: **nenhum erro novo nos arquivos tocados**. Não corrigir agora.

| Arquivo | Erros | Lints |
| --- | --- | --- |
| `src/commands/screen_capture.rs` | 6 | `needless_return` (2), `while_let_loop`, `drop_non_drop`, `manual_as_chunks`, `redundant_pattern_matching` |
| `src/commands/process_monitor.rs` | 3 | `unnecessary_map_or` (2), `manual_strip` |
| `src/commands/win_loopback.rs` | 2 | `while_let_loop`, `drop_non_drop` |
| `src/commands/epic.rs` | 2 | `unnecessary_map_or`, `collapsible_if` |
| `src/commands/captures.rs` | 2 | `manual_as_chunks`, `unnecessary_sort_by` |
| `src/commands/overlay.rs` | 1 | `type_complexity` |
| `src/commands/game_watch.rs` | 1 | `unnecessary_map_or` |
| `src/commands/achievements.rs` | 1 | `too_many_arguments` (9/7) |
| `src/utils/path.rs` | 1 | `needless_return` |

Reprodução: `cd src-tauri && cargo clippy --message-format=short -- -D warnings`.

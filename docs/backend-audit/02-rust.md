# 02. Auditoria do Rust (`src-tauri`) (Rust Engineer)

Data: 2026-10-12. Somente leitura. Baseline do clippy: `docs/tech-debt/clippy-baseline.md` (19 erros).

## Resumo do estado
O código novo (módulo `audio_capture`, `store/sessions.rs`, `launch_guard.rs`) segue bem os padrões do `CLAUDE.md`
(erros tipados, tabela de modos, testes, `// SAFETY:`). O resto (comandos antigos) tem dívida nos padrões, sem bug grave achado.

## Achados

### R1. Dois caminhos de captura de áudio do desktop convivem; o novo não é usado pelo front (média)
`src-tauri/src/commands/audio_capture/` (tabela de modos `ExcludeSelf`/`Game`/`System`, sonda de capacidade, anel, testes) está registrado
só para `desktop_audio_capabilities` e `desktop_audio_selftest` [VERIFICADO: `lib.rs:13,203-204`]. O front chama
`desktop_audio_start`/`desktop_audio_stop`, que continuam no `win_loopback.rs` antigo e **só excluem a árvore do próprio app**
[VERIFICADO: `screen_capture.rs:353-396` chama `win_loopback::start_excluding_self`; `win_loopback.rs:461-462`]. Nenhum chamador do front passa modo.
Impacto: o modo `Game` e a sonda existem sem uso; manutenção dobrada (≈2.460 + ≈1.000 linhas). Esforço: M para ligar, S para remover o antigo depois.

### R2. `unsafe` e `unwrap`
- Blocos `unsafe`: `win_loopback.rs` 56, `audio_capture/win.rs` 36, `screen_capture.rs` 18, `overlay.rs` 8, `system.rs` 4, `ring.rs` 4, `hardware.rs` 1, `mod.rs` 1.
  Comentários `// SAFETY:` no total: 35 [VERIFICADO: `grep`]. **Há mais blocos `unsafe` do que comentários**, concentrados em `win_loopback.rs`
  (vtable COM escrita à mão, `win_loopback.rs:440-460`). Baixo/médio.
- `unwrap/expect/panic` em código de produção: apenas 3 [VERIFICADO: contagem antes de `#[cfg(test)]`]: `lib.rs:277` (`expect` no `run()`, aceitável),
  `game_watch.rs:224` (`target.unwrap()` logo após checar `is_none()`, trocar por `let Some(..)`), `audio_capture/source.rs` 1 (com mensagem que cita teste).
  Os 18+14+11… do `grep` bruto estão dentro de módulos de teste. Baixo.

### R3. `Result<_, String>` em ≈150 assinaturas (média, padrão do projeto)
`overlay.rs` 29, `system.rs` 23, `epic.rs` 18, `library.rs` 15, `screen_capture.rs` 13, `win_loopback.rs` 12, `virtual_pad.rs` 9, `nexus.rs` 8, `captures.rs` 8…
[VERIFICADO: `grep "Result<.*String>"`]. Só `audio_capture/error.rs` usa `thiserror`. O front não consegue distinguir tipos de erro. Esforço: L, fazer por arquivo ao tocar.

### R4. Erros engolidos (média)
173 ocorrências de `let _ =` / `.ok();` [VERIFICADO: `grep`]. Muitas são legítimas (`let _ = window.show()`), mas o
watcher de jogo ignora o resultado de `emit` e `show/hide` (`game_watch.rs:141-155`). Revisar por arquivo ao tocar.

### R5. `emit` em broadcast (média)
26 `.emit(` contra 1 `emit_to` [VERIFICADO]. Eventos como `game-watch:started` (`game_watch.rs:35`) e `screen-share:audio` (PCM em base64)
vão para **todas as janelas** (main e overlay). Hoje há pouca superfície (janelas locais, sem conteúdo remoto), então o risco é de custo
e acoplamento, não de vazamento. Regra do CLAUDE.md: usar `emit_to`.

### R6. Ciclo de vida da janela e do watcher de jogo (alta, ligada ao problema 1)
`conceal_main_window` **esconde a janela principal** (`window.hide()`) quando o jogo é detectado [VERIFICADO: `game_watch.rs:119-125` (`conceal_main_window`), chamada em `:263`]. Um WebView2 escondido tem timers estrangulados (inferido do comportamento do Chromium), e o
heartbeat de presença roda em `setInterval` dentro dessa janela (ver `03-presenca-websocket.md`).
O watcher é um loop `tokio::spawn` que a cada 0,5/1 s chama `refresh_processes_specifics(All)` quando não tem PID rastreado, dentro de
async (sysinfo é bloqueante; custo de CPU aceitável, mas fora do `spawn_blocking`) [VERIFICADO: `game_watch.rs:206-230`].

### R7. Detecção de jogo só por alvo único (alta, problema 2)
`GameWatchState` guarda **um** alvo (`target_executable`). Sem alvo (`!active || target.is_none()`) o loop faz `continue` para sempre
[VERIFICADO: `game_watch.rs:213-229`]. Só o front define o alvo, e só ao iniciar o jogo pelo hub (`game_watch_set_target`; também
`launcher.rs:75-80`). Detalhe da causa em `03-presenca-websocket.md` (P2).

### R8. Lançamento de jogo cria filho do hub (relevante para o problema 3)
`launcher_open_executable` usa `tokio::process::Command::new(&exe)` e `creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)`
[VERIFICADO: `launcher.rs:46-73`]. Esses flags destacam do console e do grupo de sinais, mas **não quebram a relação pai/filho**. O jogo continua
sendo descendente do hub. A captura de áudio usa `PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE` com `std::process::id()` do hub
[VERIFICADO: `audio_capture/win.rs:529,569`; `win_loopback.rs:461-462`], o que exclui a árvore inteira.
**Causa raiz do problema 3 (tela inteira sem áudio) [INFERIDO, alta confiança, falta a medição]:** jogos lançados **pelo hub** ficam na
árvore excluída, então o loopback não captura o áudio deles. Jogos abertos pela Steam ou fora do hub não ficam na árvore e teriam áudio.
Prova a coletar (pacote de testes): com a tela inteira compartilhada, comparar áudio de (a) jogo aberto pelo hub, (b) o mesmo jogo aberto
fora do hub, (c) um vídeo no navegador. Se (a) mudo e (b)/(c) com som, a hipótese se confirma.
Hipóteses alternativas listadas na ordem de verificação: `AudioContext` suspenso (`desktopAudioCapture.ts:69` chama `ctx.resume()` sem tratar recusa),
capacidade do SO (`< build 20348`) e trilha não publicada (`screenShare.ts:197-204` publica só se existir trilha).
Correção sugerida (fora desta frente): usar `Strategy::ExcludeOwnProcessTree` só do **WebView**, ou `CaptureMode::Game`/`System` quando houver jogo rastreado.

### R9. Persistência de sessões de jogo já é incremental (informativo)
`store/sessions.rs` abre linha na abertura, grava heartbeat e recupera sessões órfãs, com transação e testes
[VERIFICADO: `store/sessions.rs:34-133`; front `useGamePresence.ts:121-140`]. A suspeita do "relatório anterior" (sessão só persistida ao fim) **não se aplica mais**.

### R10. Drivers ViGEmBus/HidHide: instalação só pelo instalador NSIS (SÓ AUDITAR)
- O app **não instala** drivers em runtime; só reporta estado (`vigem_status`, `hidhide_status`, `controller_driver_status`)
  [VERIFICADO: `controller_config.rs:162,236`: "Não instala nada"]. A instalação acontece no hook pós-instalação do NSIS
  (`src-tauri/windows/hooks.nsh`) com `ExecShellWait "runas" ... "/install /quiet /norestart" SW_HIDE`.
- Causas prováveis de falha, em ordem (todas **[INFERIDO]** até haver o log do instalador):
  1. **O hook só roda no alvo NSIS.** `tauri.conf.json:36` gera também `msi`, que não tem hook algum [VERIFICADO: `targets: ["nsis","msi"]`].
  2. **Os `.exe` não vão no git** (`.gitignore:42`) e entram só se `npm run drivers:fetch` rodou antes do build; sem eles o hook diz
     "instalador não veio no pacote, pulando" e segue [VERIFICADO: `windows/drivers/README.md`, `hooks.nsh`].
  3. **O código de saída é ignorado de propósito** (`ExecShellWait` não o devolve); o sucesso é inferido pela chave de serviço em
     `HKLM\SYSTEM\CurrentControlSet\Services\{ViGEmBus,HidHide}`. Mas o serviço pode existir antes de o driver funcionar, e **HidHide costuma exigir
     reinício**; `/norestart` deixa o driver instalado e inativo [INFERIDO].
  4. **Atualização silenciosa (updater)** roda o NSIS sem janela; o UAC do `runas` com `SW_HIDE` pode aparecer atrás de outra janela e expirar [INFERIDO].
  5. Versão já instalada com outro pacote (`DS4Windows`, Steam): o hook pula, e a detecção do app passa (por desenho).
- Sem log do instalador: o `DetailPrint` some quando a instalação é silenciosa. Sugestão futura: gravar o resultado em arquivo de log do usuário.
- Verificação de integridade: `drivers.manifest.json` fixa versão e SHA-256 dos dois instaladores (bom) [VERIFICADO].

## Pontos fortes (para não regredir)
Tabela de modos de captura com teste de cobertura, `Capability` tipada, "nada cai sozinho para `SystemLoopback`" (`source.rs:6-8`),
`launch_guard.rs` com validação de caminho, extensão, env e args, escrita atômica de progresso (`achievement_util.rs:53`).

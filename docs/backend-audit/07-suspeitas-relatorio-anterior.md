# 07. Suspeitas do "relatório anterior", revalidadas do zero

Data: 2026-10-12. Não havia relatório anterior em `docs/`; cada item abaixo veio do prompt do dono e foi tratado como suspeita sem fonte.
Achievements/troféus: **SÓ AUDITAR** (nenhuma correção nesta frente).

| # | Suspeita | Veredito hoje | Evidência | Pendência |
| --- | --- | --- | --- | --- |
| 1 | `now_iso()` inválido | **Corrigido** | `src-tauri/src/commands/achievement_util.rs:46-49` gera RFC 3339 UTC; teste `now_iso_has_rfc3339_shape` (`:84-88`) | nenhuma |
| 2 | Tier "gold" fixo no watcher de emulador | **Corrigido no watcher; resíduo** | `achievement_watcher.rs:282-284` não envia `tier`. Mas `achievement_unlock` ainda assume `"gold"` e `percent 15.0` quando o chamador omite (`achievements.rs:153,181`), e o overlay de teste (`overlay.rs:802`) | decidir se o default deve ser neutro |
| 3 | RLS de `chat_messages_update` permissiva | **Mitigada por trigger; confirmar em produção** | `supabase/migrations/20261009100000_chat_messages_guard.sql` bloqueia mudança de campos imutáveis e limita o destinatário a marcar leitura/reações. A **policy** original (`20260301120000_fix_chat_participants_rls.sql:74`) continua permitindo UPDATE a ambos | `[INFERIDO]` aplicada em produção; ver schema |
| 4 | `password_hash` indo ao cliente | **Fechado via REST; resíduo no Realtime** | `grep password_hash src/` vazio; `20261009120000_chat_rooms_rls.sql:51-64` revoga SELECT e concede só as outras colunas; a própria migration admite o resíduo (`:74-75`) e `voice_rooms` está na publicação (`20260301130000...:12`); o front assina `voice_rooms_table_sync` (`voiceRooms.ts:699`) | confirmar o payload real do `postgres_changes`; mover o hash para tabela fora da publicação |
| 5 | Canais Realtime públicos | **Confirmado (alta)** | nenhum `private: true` em `src/` (ver `01`, seção 4); impacto em `05-chamadas.md`, seção 3 | policies de `realtime.messages` `[INFERIDO]`: ver schema |
| 6 | Sessão de jogo só persistida ao fim | **Corrigido** | `src-tauri/src/store/sessions.rs:34-133` (abre, heartbeat, recupera órfã, transação, testes); front `useGamePresence.ts:121-140,197` | nenhuma |
| 7 | CSP nula e `launcher_open_executable` sem validação | **Corrigidos, com ressalvas** | CSP definida em `tauri.conf.json:29`; `launch_guard.rs:10-50` valida caminho absoluto, extensão (`exe/bat/cmd/com`), sem UNC/`..`, env bloqueado e limite de args; commit `d22a9c2` | ver ressalvas abaixo |
| 8 | Unlocks de emulador sem sync | **Parcial** `[INFERIDO]` | o watcher grava local e emite evento; o resultado de gravar é ignorado (`let _ = record_local_achievement_unlock(...)`, `achievement_watcher.rs:273`); o envio ao banco depende do front (`useGamePresence.ts` / `trophyHistory.ts`) estar vivo | testar com o hub escondido (ver pacote de testes) |
| 9 | Regra de tier/XP duplicada | **Confirmado (média)** | tabela `{platinum:90, gold:60, silver:30, bronze:15}` repetida em `useGamePresence.ts:677,735`, `OverlayApp.tsx:771` e `overlay.rs:847`; e o XP é gravado pelo **cliente** em `xp_events` (`trophyHistory.ts:206`) | RLS de `xp_events` `[INFERIDO]` (cliente forja XP?) |
| 10 | Schema base fora das migrations | **Confirmado** | primeira migration (`20260301120000`) já altera tabelas existentes; sem `config.toml` (ver `00-fontes.md`) | dono roda as consultas de `inputs/` |

## Ressalvas do item 7 (CSP)
`script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'`: o `unsafe-eval` enfraquece a CSP; o código não usa `eval`/`new Function` em `src/` (`grep` vazio),
então talvez seja necessário só por alguma dependência (a verificar antes de remover). `img-src` e `media-src` aceitam qualquer `https:`;
`connect-src` aceita `http://localhost:*` e `127.0.0.1:*` (qualquer porta local). Aceitável para um hub que mostra imagens de lojas; registrar como risco baixo/médio.

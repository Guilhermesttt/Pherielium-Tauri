# Fontes disponíveis e o que falta (Fase 0, buscas)

Data: 2026-10-12. Somente leitura. Nenhum `.env`, chave, token, `.ssh` ou dado de navegador foi aberto. O `.env` foi lido **apenas pelos nomes** das
variáveis (valores nunca impressos).

## 1. Código da API do Render (`checkpoint-launcher.onrender.com`)

**Status: PENDENTE.** O dono vai confirmar no painel do Render qual repositório e branch são publicados. Enquanto isso o contrato é
**reconstruído a partir do cliente e marcado `[INFERIDO]`** (ver `04-api-contrato-inferido.md`).

Tentativa de leitura (2026-10-12): o dono indicou que a API está em `C:\Users\Guilherme Sant'Ana\Documents\Pherielium-Tauri`, **fora do worktree**.
Esse caminho é **o próprio worktree** (`git worktree list` mostra um único worktree, em `C:/Users/Guilherme Sant'Ana/Documents/Pherielium-Tauri`) e
**não contém código de servidor**. Evidências:
- Não há `server/`, `api/` nem `backend/`, e nenhum `package.json` fora de `node_modules`. Pastas de topo: `assets, dist, dist-installers, docs, e2e, public,
  reference, release, scripts, src, src-tauri, supabase, target-check, test-results` (`reference/` contém só `coucou-frontend`).
- Buscar as rotas `livekit-token` e `turn-credentials` em todo o diretório (exceto `node_modules`, `target`, `dist`) só acha o **cliente**
  (`src/services/livekitVoice.ts`, `src/services/turnCredentials.ts`).
- Nenhum `.git` aninhado; o histórico nunca teve pasta de servidor (`git log --all --diff-filter=D -- 'server/*' 'api/*' 'backend/*'` vazio).
- Pistas de que o servidor já viveu junto do cliente: o `.env` local tem **nomes** de variáveis de servidor (`SUPABASE_SERVICE_ROLE_KEY`, `LIVEKIT_API_KEY`,
  `LIVEKIT_API_SECRET`, `PORT`, `FRONTEND_URL`, `BACKEND_PUBLIC_URL`, `DISCORD_*`, `GOOGLE_*`, `STEAM_API_KEY`, `RAWG_API_KEY`, `EPIC_SANDBOX_ID`) e o
  `api.ts` cita `http://localhost:8787` como backend de desenvolvimento (`src/services/api.ts`, função `resolveBackendUrl`).

Outras buscas anteriores (Documents, Desktop, Downloads, OneDrive) só acharam `Dashboard Samara` (Next.js), `Projeto-Jadilson-Silva-` (`backend/main.py`,
sem relação) e este worktree. O `gh` não está instalado. Nenhuma outra pasta foi varrida (regra do dono).

**Pedido ao dono:** o caminho correto (ou o remoto Git) do repositório da API e o commit publicado no Render. Quando chegar, reler por
`git show <hash>:caminho` sem checkout e revalidar `04`, `05` e as perguntas de segurança do `RESUMO.md`.

## 2. Stash

`git stash list` → 1 entrada: `stash@{0}: WIP on main: 3d15192 refactor(voice): extract feed volume key mapping ...`
(criada às 16:04:38 de 2026-10-11, **não por esta sessão**). Conteúdo (`git stash show --stat --include-untracked`): **somente**
`src/services/voiceCall/volumeKeys.test.ts`, +26 linhas.

Comparação com o `main` (feita com `git show 'stash@{0}^3:...'`, sem aplicar o stash):
- O arquivo do stash **não é idêntico** ao do `main`. É um **rascunho anterior** do mesmo teste: `it(...)` simples e comentário "Regression: ...",
  escrito contra a API antiga (`sliderEffects().peerKeys`).
- No `main` o arquivo evoluiu duas vezes: `ac8927f` (o mesmo teste como `it.fails`, comentário `BUG(known)`) e `5318507` (reescrito para a API nova, ~90 linhas).
- Conclusão: o stash **não guarda nada que o `main` não tenha** em termos de cobertura; está superado. Não foi aplicado nem removido. O descarte é decisão do dono.

## 3. Schema do Supabase

- `supabase/config.toml`: **não existe**. Não há dump nem `.sql` de schema fora de `supabase/migrations` (e `supabase/proposals/README.md`).
- `supabase/migrations` tem 17 arquivos (2026-03-01 a 2026-10-10) e **não inclui o schema base** (a primeira migration já altera tabelas existentes).
  [VERIFICADO: `ls supabase/migrations`]
- Ferramentas: Supabase CLI **2.117.0** instalada; Docker **não instalado** (sem `supabase start` nem pgTAP local); `gh` não instalado.
- Nada foi conectado ao projeto (sem `db pull`, `link` ou `login`).

**Como obter (dono):** no SQL Editor do Supabase (somente leitura), salvar os resultados em `docs/backend-audit/inputs/`:
1. `01-tables.csv`: colunas de todas as tabelas (`information_schema.columns`, schemas `public` e `realtime`).
2. `02-policies.csv`: `select * from pg_policies where schemaname in ('public','realtime','storage')`.
3. `03-functions.sql`: `select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`.
4. `04-indexes.csv`: `select * from pg_indexes where schemaname='public'`.
5. `05-triggers.csv`: `select event_object_table, trigger_name, action_statement from information_schema.triggers where trigger_schema='public'`.
6. `06-publications.csv`: `select * from pg_publication_tables`.
7. `07-grants.csv`: `select grantee, table_name, privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated')`.
8. `08-migrations-aplicadas.csv`: `select * from supabase_migrations.schema_migrations order by version` (confirma quais das 17 migrations rodaram em produção).

Alternativa: instalar Docker e rodar `supabase db pull` por conta própria (não por esta sessão).

## 4. Variáveis de ambiente (somente nomes)

- `VITE_*` do `.env` local (valores não lidos): `VITE_BACKEND_URL`, `VITE_DISCORD_APPLICATION_ID`, `VITE_LIVEKIT_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`. **Nenhum nome sugere segredo de servidor** (`anon`/`publishable` são chaves públicas por desenho; a proteção é RLS).
  Eles vão para o bundle público do front. O código só lê `VITE_BACKEND_URL`, `VITE_LIVEKIT_URL` e `VITE_SUPABASE_*` [VERIFICADO: `grep import.meta.env`].
  `VITE_DISCORD_APPLICATION_ID` está no `.env` e não é lido por `src/`.
- Segredos de servidor **sem** prefixo `VITE_` no mesmo arquivo (não entram no bundle): `SUPABASE_SERVICE_ROLE_KEY`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`,
  `DISCORD_CLIENT_SECRET`, `GOOGLE_CLIENT_SECRET`, `STEAM_API_KEY`, `RAWG_API_KEY`. O Rust só lê `STEAM_API_KEY` em tempo de execução (`std::env::var`), sem `env!`/`option_env!`.
  Risco: um `.env` de servidor dentro da pasta do cliente (ver `RESUMO.md`).
- **`.env.example` ausente** (achado para contribuidores open source): `git ls-files` não lista nenhum `.env*`. Sugestão de placeholders:
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BACKEND_URL`, `VITE_LIVEKIT_URL`, `STEAM_API_KEY`.

## 5. Outros fatos de ambiente

- O arquivo de instruções chama-se `CLAUDE.MD` (extensão em maiúsculas) e está **não rastreado**. Em sistemas que diferenciam maiúsculas (Linux, macOS) quem procura
  `CLAUDE.md` não o acha. Comando proposto (o dono executa; o Windows ignora caixa, então em duas etapas):
  `mv CLAUDE.MD CLAUDE.tmp && mv CLAUDE.tmp CLAUDE.md && git add CLAUDE.md`.
- `.gitattributes` com `* text=auto` já foi criado no commit `604567a` (antes desta auditoria). `src-tauri/Cargo.toml` continua modificado só por fim de linha e é ignorado nesta frente.

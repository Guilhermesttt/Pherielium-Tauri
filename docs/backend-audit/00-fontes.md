# Fontes disponíveis e o que falta (Fase 0, buscas)

Data: 2026-10-12. Somente leitura. Nenhum `.env`, chave, token, `.ssh` ou dado de navegador foi aberto
(o `.env` apareceu apenas como nome de arquivo numa busca por nome, sem leitura de conteúdo).

## 1. Código da API do Render (`checkpoint-launcher.onrender.com`)

**Resultado: NÃO ENCONTRADO. A API é "não analisável" por enquanto.**

Onde procurei e a evidência:
- Neste repo: `git remote -v` só tem `origin` = `github.com/Guilhermesttt/Pherielium-Tauri` (o próprio cliente).
  Branches locais: `feat/onboarding-tour`, `feat/voice-room-customization`, `fix/chat-rooms-rls`, `fix/csp-launcher`,
  `fix/profiles-privacy`, `fix/steam-key`, `fix/voice-room-crypto`, `main`, `refactor/game-sessions`, `release/1.0.1`, `release/1.0.2`;
  remoto: só `origin/main`. Nenhuma tem pasta de servidor. [VERIFICADO: listagem de branches e de arquivos rastreados]
- Arquivos de deploy: não existem `render.yaml`, `Dockerfile`, `Procfile` nem `.github/workflows` neste repo. [VERIFICADO]
- Menções a `onrender.com` (por nome de arquivo): `src/services/api.ts` (linha 4), `src-tauri/src/commands/auth.rs`, `src-tauri/tauri.conf.json`,
  `src-tauri/capabilities/default.json`, `vite.config.ts`, `index.html` e o `.env` local (ignorado pelo git; conteúdo NÃO lido).
  Todas são **consumidoras** da URL; nenhuma é código do servidor.
- Histórico: `git log --all -S"onrender.com"` acha só 3 commits do cliente (`a36ed05`, `161941b`, `d22a9c2`). Nenhum arquivo `server/*`, `api/*` ou
  `backend/*` foi apagado em qualquer commit (`--diff-filter=D` vazio). O backend **nunca** esteve neste repositório.
- Máquina do dono (só pastas de projeto): em `Documents` há `Dashboard Samara` (Next.js `my-v0-project`, sem as rotas),
  `Projeto-Jadilson-Silva-` (`backend/main.py` + `frontend`, sem menção a livekit ou presence; parece projeto sem relação) e este worktree.
  `Desktop`, `Downloads` e `OneDrive` não têm projetos. Nenhuma pasta contém `/api/voice/livekit-token`, `/api/presence` ou `/api/friends/status`.
- GitHub CLI (`gh`) **não está instalado**; não foi possível listar os repositórios do dono.

Dúvida remanescente: o servidor existe (em produção o app recebe 401 em vez de erro de rede), mas está num repositório/pasta que não está nesta máquina.
**Pedido ao dono:** caminho local ou URL do repositório da API e a branch que o Render publica. Enquanto isso, o contrato é
**reconstruído a partir do cliente e marcado `[INFERIDO]`**.

## 2. Stash

`git stash list` → 1 entrada: `stash@{0}: WIP on main: 3d15192 refactor(voice): extract feed volume key mapping ...`
(criada às 16:04:38 de 2026-10-11, não por esta sessão).
Conteúdo (`--include-untracked`): **somente** `src/services/voiceCall/volumeKeys.test.ts` (+26 linhas), o teste vermelho da correção de volume,
antes de existir versionado. Esse arquivo já está no `main` (commits `ac8927f` e `5318507`), então o stash é redundante.
**Não foi aplicado nem removido.** O descarte é decisão do dono.

## 3. Schema do Supabase

- `supabase/config.toml`: **não existe**. Não há dump ou `.sql` de schema fora de `supabase/migrations` (e `supabase/proposals/README.md`).
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

Alternativa: instalar Docker e rodar `supabase db pull` por conta própria (não por esta sessão).

## 4. Outros fatos de ambiente
- Não existe `.env.example` versionado (`git ls-files` não lista nenhum `.env*`), apesar da regra do CLAUDE.MD. O `.env` está no `.gitignore` (linha 22).
  Achado de baixa severidade.
- O arquivo de instruções chama-se `CLAUDE.MD` (extensão em maiúsculas) e está não rastreado no momento.

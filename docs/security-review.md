# Revisão de segurança (2026-10)

Escopo: o que o repositório do app consegue controlar. O servidor do Render **não está
neste repositório** (ver `docs/backend-audit/00-fontes.md`), então tudo que depende dele
aparece como recomendação, não como correção.

Rótulos: **[VERIFICADO]** visto no código ou rodado; **[INFERIDO]** deduzido.

## Já corrigido

### Chave da Nexus não ficava salva (bug + segurança)
- **Causa [VERIFICADO: `src-tauri/Cargo.toml`]:** `keyring = "3"` sem a feature
  `windows-native`. Sem feature de plataforma o crate usa um repositório de teste (mock)
  só em memória: `set_password` "funcionava", mas a leitura seguinte voltava vazia. O
  teste `secret_survives_a_fresh_entry` falhava antes e passa depois.
- **Onde a chave vive agora:** no Gerenciador de Credenciais do Windows (protegido por
  DPAPI), nunca no front-end e nunca em `localStorage` [VERIFICADO: `ModsPage.tsx` não grava a chave].
- **Por que não usar hash:** a Nexus exige a chave original em cada requisição. Hash é
  de mão única, então não serve para um segredo que precisa ser reenviado. Hash é a
  resposta certa para **senhas** (o servidor só compara), não para chaves de API.
- **Sem timeout (corrigido):** o cliente HTTP não tinha timeout; agora 20 s.
- **Erros acionáveis:** 401/403, 429 e 5xx viram mensagens claras (antes toda falha era
  "Invalid API key"). Os limites diário e horário da Nexus agora são lidos dos
  cabeçalhos e devolvidos ao front.

### Path traversal nos comandos da Nexus
- `game_domain` ia direto para um caminho de pasta e para a URL da API
  [VERIFICADO: `nexus_download_dir`, `nexus_get_mod_*`]. Um valor com `..` ou `?` saía da
  pasta de downloads ou redirecionava a requisição, com a chave do usuário.
- Agora só passa `[a-z0-9_-]` (até 80) e o id do mod só dígitos. Testes cobrem os dois.

### Dependências npm
- `npm audit --omit=dev`: **0 vulnerabilidades** (o que vai no app).
- Antes: 7 (3 críticas). Removido o `geist`, que não era importado em lugar nenhum e
  trazia o `next` (crítico, RCE). `npm audit fix` atualizou o `vite` (alta).
- Restam 4, todas só de desenvolvimento:
  - `vitest` 3 e `tinypool` (crítica, ao rodar testes) — corrige no `vitest` 5 (major).
  - `react-router-dom` 6 (moderada, redirecionamento aberto em `<Link>`) — corrige no 7 (major).
  Atualizar exige testar a suíte e as rotas; fica como tarefa própria.
- Regressão que achei e corrigi: 29 arquivos importavam `motion/react`; o pacote
  `motion` já tinha sido removido, o que quebrava o typecheck e o build.

## O que depende do servidor (recomendações)

1. **Senha com hash e JWT.** O login usa o Supabase Auth: ele guarda a senha com bcrypt e
   emite o JWT; o app só envia `Authorization: Bearer` [VERIFICADO: `api.ts`]. Não há senha
   própria para fazer hash no cliente. O que falta conferir no Render: validar o JWT
   (assinatura, `exp`, `aud`) em toda rota `/api/*`.
2. **Cookies e sessão.** App desktop (Tauri) não tem sessão de navegador, e cookie só protege
   em fluxo web. O equivalente, **já feito**, é guardar a sessão do Supabase (JWT e refresh
   token) no cofre do Windows em vez de `localStorage`: `src-tauri/src/commands/secure_storage.rs`
   e `src/services/secureSessionStorage.ts`. O valor é fatiado em pedaços de 800 caracteres
   porque o Windows limita cada credencial a 2560 bytes; a sessão antiga é migrada na primeira
   leitura. Se o cofre falhar, o app cai no `localStorage` com um aviso no console.
   Limite que continua: um script injetado na página ainda consegue pedir a sessão ao cofre
   pelo comando Tauri, então o cofre protege contra leitura de disco e de `localStorage`,
   não substitui uma CSP rígida (ver item 6).
3. **Rate limit.** Precisa ser no servidor, por usuário e por IP, com `429` e
   `Retry-After`. Prioridade: `/api/voice/livekit-token`, `/api/voice/rooms/*/join`
   (tentativas de senha de sala), `/api/friends/search`, `/api/presence` e chat.
   No Supabase, o equivalente é um gatilho que recusa inserções acima de N por minuto por
   `auth.uid()` (hoje só `chat_messages` tem guarda de UPDATE).
4. **Token na URL.** O beacon `POST /api/presence?token=…` coloca o JWT na query string
   [VERIFICADO em `docs/backend-audit/04`], que costuma parar em log. Mover para cabeçalho
   ou corpo e invalidar tokens já vistos.
5. **`profiles` legível por `anon`** (e-mail, ids de Steam/Discord): já descrito em
   `supabase/proposals/README.md`, prioridade alta.
6. **CSP.** `script-src` permite `'unsafe-eval'`. Se nenhuma dependência exigir, remover.

## Pendências fora desta revisão

- O download e a instalação de mods da Nexus agora existem (ver `docs/mods-install.md`), com
  proteção contra zip-slip, backup e desfazer. Falta testar com contas e jogos reais, e instalar
  `.7z` e `.rar`.
- `.env.example` aparece apagado no `git status`; o repositório precisa dele com
  placeholders.

# Auditoria do backend: resumo da Fase 1

> ## Atualização 2026-10-12: nova prioridade (decisão do dono)
> Só estes problemas, nesta ordem: **1) F-áudio** (feita), **2) V** volume da transmissão (diagnóstico entregue, correção aguarda OK), **3) I** convite como mensagem e **4) R** canais de voz privados salvos (planejados no PLAN §17, aguardam aprovação e schema).
> **Backlog:** A2, B1, B2/B3, C, U, E, drivers, F1 (condicional). A1 e D1 já feitas permanecem.
> - **Problema 3 (tela inteira sem áudio): causa PROVADA e corrigida.** O caminho antigo de captura nunca iniciava: handler sem `IAgileObject` (`0x8000000E`) e `GetMixFormat` `E_NOTIMPL`; ver `08-f0-audio-ativacao.md`. A hipótese da "árvore excluída do hub" (achado #9 abaixo) vira **condicional**: só se reavalia com o P-10 refeito.
> - **Novo achado V:** o `<video>` do palco toca a mesma trilha que o `<audio>` do slider (e a voz com câmera toca em dobro); `09-v-volume-transmissao.md`.
> - **Achado do `password_hash` via Realtime (#10):** o plano R o fecha com `voice_room_secrets` fora da publicação.
> - Os testes manuais passam a ser: **P-10 refeito** (tela inteira, 3 cenários) e uma chamada com voz durante a transmissão; P-1 a P-3 deixam de bloquear a fila (presença está no backlog).

Data: 2026-10-12. Commit auditado: `e11e04d` (+ arquivos de auditoria). **Somente leitura.**
Rótulos: `[VERIFICADO]` = li o código/migration (arquivo:linha no documento da área); `[INFERIDO]` = deduzido, falta teste ou insumo.

## O que foi e o que NÃO foi auditado

| Área | Estado | Documento |
| --- | --- | --- |
| Inventário do contrato (Spec Miner) | feito | `01-spec-miner-contrato.md` |
| Rust (`src-tauri`) | feito | `02-rust.md` |
| Presença, Realtime, detecção de jogo | feito | `03-presenca-websocket.md` |
| Contrato da API (inferido do cliente) | feito, **API PENDENTE** | `04-api-contrato-inferido.md` |
| Chamadas, salas de voz e ameaças do Realtime (lado cliente) | feito | `05-chamadas.md` |
| Suspeitas do relatório anterior | feito | `07-suspeitas-relatorio-anterior.md` |
| **Código da API do Render** | **NÃO analisável**: o caminho informado é este worktree e não há servidor nele | `00-fontes.md` |
| **Postgres/RLS/índices/RPCs (schema real)** e **Security Reviewer** completo | **adiados**: falta o schema (`inputs/`) | `00-fontes.md` |

Tudo que depende da API ou do schema está marcado `[INFERIDO]`. Os itens 8, 11 e 12 abaixo mudam de nota quando o código da API chegar.

## Top 15 achados (priorizados)

| # | Sev. | Achado | Evidência | Onde |
| --- | --- | --- | --- | --- |
| 1 | **Crítica** | **Canais Realtime públicos e sem checagem de remetente.** Qualquer cliente que saiba um UID pode forjar convite de chamada, `call:end` (derruba chamada ativa), `call:kick` (o `adminId` vem do payload), `call:privacy`, SDP (`call:signal`), mensagem (`u2u:message`) e presença. Possível leitura de DMs e da presença de todos | VERIFICADO no cliente (`useVoiceCall.ts:2866-2990`, `realtimeEventBus.ts`, nenhum `private:true`); policies de `realtime.messages` INFERIDO | `05` §3 |
| 2 | **Alta** | **A chamada não tem fonte de verdade no servidor.** "Ocupado", "perdida" (timer local de 35 s) e "não atendeu" são decididos no cliente; app do destino fechado = ninguém responde; não há histórico nem estados `declined/missed/canceled` | VERIFICADO (`useVoiceCall.ts:2944-2967,3147-3158`; `types/domain.ts:261`) | `05` §2.4 |
| 3 | **Alta** | **Fallback P2P assimétrico**: quem liga cai para P2P em qualquer erro, quem atende só se o LiveKit estiver desligado globalmente. Resultado: os dois ficam em transportes diferentes, a chamada fica muda ("não ouço meu amigo") | VERIFICADO (`transportPolicy.ts:19-24`, `useVoiceCall.ts:3095`) | `05` §2.1 |
| 4 | **Alta** | **Problema 1 (amigo OFFLINE ao entrar num jogo).** O heartbeat é `setInterval` de 25 s dentro do WebView; o Rust esconde essa janela ao detectar o jogo; no Electron havia heartbeat no processo principal e no Tauri `setPresenceSession` é no-op; o espectador declara offline após 90 s; o evento `presence:leave` vira offline imediato e o timer de proteção nunca é criado | VERIFICADO o mecanismo (`Home.tsx:1286-1316`, `game_watch.rs:119-125,263`, `tauriAPI.ts:538`, `AuthProvider.tsx:9,214-220`, `realtimeEventBus.ts:206-214,336-351`); o efeito (timers estrangulados) INFERIDO, falta medir | `03` §2 |
| 5 | **Alta** | **Problema 2 (jogo aberto fora do hub não é detectado).** O watcher do Rust observa um único alvo definido só no lançamento pelo hub; a varredura do front acha o processo mas `shouldAllowBackgroundSessionConfirm` só confirma com sessão ativa ou lançamento pendente (< 3 min) | VERIFICADO (`game_watch.rs:213-229`, `sessionPolicy.ts:28-36`, `useGamePresence.ts:332-340,401-406`) | `03` §3 |
| 6 | **Alta** | **DM enviada offline se perde em silêncio.** Qualquer erro do insert devolve a mensagem otimista (`fast_...`) como se tivesse sido enviada; não há fila de reenvio; o histórico é uma janela sem cursor; o `sender_id` vai no corpo (a RLS/trigger precisa garantir `auth.uid()`) | VERIFICADO (`chat.ts:370-418,704-709`); RLS INFERIDO | `04` C7, `05` |
| 7 | **Alta** | **O convite só sai depois de o LiveKit conectar** (token + preflight). Com Render frio (> 35 s) o destino demora a tocar; o timeout padrão do `apiFetch` é 15 s; o cronômetro de "não atendeu" só começa depois | VERIFICADO (`useVoiceCall.ts:3079-3118,3147-3158`, `api.ts:5`) | `05` §2.3 |
| 8 | **Alta** | **Presença global vaza todos os usuários e escala mal.** `checkpoint_presence_bus` é uma sala única; o filtro por amigos é só no cliente; cada heartbeat dispara 1 POST + F `httpSend` (≈ 2.000 req/s com 1.000 usuários e 50 amigos) | desenho VERIFICADO (`realtimeEventBus.ts:62-75,388-444`); capacidade e vazamento efetivo INFERIDOS | `03` §5 |
| 9 | **Média/Alta** | **Problema 3 (tela inteira sem áudio).** O loopback exclui a árvore de processos do hub (`std::process::id()`); jogos lançados pelo hub são filhos dele, então ficam excluídos | VERIFICADO o desenho (`launcher.rs:46-73`, `audio_capture/win.rs:529,569`, `win_loopback.rs:461-462`); a causa INFERIDA com alta confiança, falta o teste de 3 cenários | `02` R8 |
| 10 | **Média** | **`password_hash` ainda pode sair pelo Realtime** (`postgres_changes` de `voice_rooms`), embora o REST esteja fechado | VERIFICADO (migration `20261009120000...:74-75` e publicação); payload real INFERIDO | `07` #4 |
| 11 | **Média** | **Token do LiveKit e `identity`**: o cliente envia `identity` e o nome da sala 1:1 é montado no cliente; a API precisa ignorar a identity do corpo e validar amizade | INFERIDO (API pendente) | `04` C1-C3 |
| 12 | **Média** | **Token de acesso na query string** de `/api/presence` (beacon de saída) | VERIFICADO (`checkpointFriends.ts:165-168,217-218`) | `04` C5 |
| 13 | **Média** | **Fallback para RPC direto contorna a API e falha em reconhecer erro de autenticação** (`"autenticacao"` não contém `"auth"`): o log mostra o app caindo no RPC depois do 401 | VERIFICADO (`voiceRooms.ts:93-99,521`) | `04` C4 |
| 14 | **Média** | **TURN comunitário com usuário/senha públicos embutidos** e queda silenciosa (STUN fixo) quando a API falha | VERIFICADO (`turnCredentials.ts:27-45,70`) | `05` §5 |
| 15 | **Média** | **Problema 4 (drivers ViGEmBus/HidHide)** só instalam pelo hook do NSIS; o alvo `msi` não tem hook; `.exe` fora do git entram só com `npm run drivers:fetch`; HidHide costuma pedir reinício; UAC oculto no updater | VERIFICADO (`tauri.conf.json:36`, `hooks.nsh`, `windows/drivers/README.md`); causas de falha INFERIDAS | `02` R10 |

### Outros achados relevantes (fora do top 15)
- Dois caminhos de captura de áudio convivem; o novo (`audio_capture`) não é usado pelo front (`02` R1).
- ≈150 `Result<_, String>` e 173 erros engolidos no Rust; `unsafe` sem `// SAFETY:` em `win_loopback.rs` (`02` R2-R4).
- 26 `.emit(` em broadcast contra 1 `emit_to` (`02` R5).
- XP calculado e gravado pelo **cliente** (`xp_events`), tabela de XP duplicada em 4 lugares (`07` #9).
- `.env` com segredos de servidor (`SERVICE_ROLE`, `LIVEKIT_API_SECRET`, `*_CLIENT_SECRET`) dentro da pasta do cliente, e **sem `.env.example`** (`00-fontes.md`).
- CSP com `'unsafe-eval'` e `img-src`/`media-src` com `https:` aberto (`07`, ressalvas).
- Instruções do repositório em `CLAUDE.MD` (maiúsculas) e não rastreadas.
- Já corrigidos desde o relatório antigo: `now_iso`, sessão de jogo incremental, CSP/validação de executável, `password_hash` no REST (`07`).

## Perguntas de segurança que só o código da API responde
1. O `livekit-token` usa `sub` do JWT ou o `identity` do corpo? Valida amizade/participação/limite/senha na emissão?
2. Qual chave cada cliente Supabase usa (`anon`, `service_role`)? Há rotas que usam `service_role` com entrada do usuário?
3. Como o JWT é validado (`getUser` ou só decodifica)? Há CORS restrito e rate limit? Que rotas ficam sem autenticação?
4. O que `/api/presence` grava (`presence_updated_at` pelo relógio do servidor?) e há TTL/job?
5. Há estado em memória (salas, presença, rate limit) que se perde quando o Render hiberna?
6. Os logs vazam token/e-mail/uid (a query string de `/api/presence` entra neles)?

## Pacote único de testes manuais (para o dono, 2 a 3 contas)

Use contas **suas**. Os testes P-13 só valem em contas de teste.

| ID | Cenário | O que anotar | Fecha o achado |
| --- | --- | --- | --- |
| P-1 | Conta A abre um jogo **pelo hub**; B observa A por 10 min. No SQL Editor, rodar a cada 30 s: `select status, playing, presence_updated_at from profiles where uid='<A>'` | intervalos entre atualizações de `presence_updated_at`; instante em que B vê "offline" | 4 |
| P-2 | Igual ao P-1, mas jogo aberto **fora do hub** com o hub visível | idem; aparece "jogando"? | 4 e 5 |
| P-3 | Hub minimizado manualmente, sem jogo, 10 min | gaps do `presence_updated_at` | 4 |
| P-4 | Abrir um jogo da biblioteca fora do hub, hub aberto por 60 s | aparece presença, sessão e overlay? | 5 |
| P-5 | Chamada 1:1: ocupado, recusada, perdida (destino com app aberto e **fechado**), cancelada | o que cada lado vê e se algo fica registrado | 2 |
| P-6 | Deixar o Render ocioso 20 min e ligar | segundos até o destino tocar | 7 |
| P-7 | No chamador, bloquear a URL `livekit-token` (DevTools, Network, Block request URL) e ligar | quem ouve quem; qual transporte cada lado mostra | 3 |
| P-8 | Derrubar o Wi-Fi por 20 s no meio da chamada e religar | a chamada volta sozinha? quanto tempo? | 2 |
| P-9 | Sem rede, enviar uma DM, religar e esperar | a mensagem chega? aparece como enviada? | 6 |
| P-10 | Compartilhar **tela inteira** com áudio: (a) jogo aberto pelo hub, (b) o mesmo jogo fora do hub, (c) vídeo no navegador | em qual há som | 9 |
| P-11 | Abrir o app duas vezes na mesma conta e ligar para ela | os dois tocam? os dois respondem? | 2 e 3 |
| P-12 | Instalar o NSIS em máquina limpa ou VM sem os drivers; depois o MSI | os drivers aparecem em `HKLM\SYSTEM\CurrentControlSet\Services\ViGEmBus` e `...\HidHide`? pediu reinício? | 15 |
| P-13 | **Só contas de teste:** da conta C, publicar `call:end` em `user_inbox_<B>` durante uma chamada ativa de B | a chamada de B cai? | 1 |
| P-14 | Rodar as 8 consultas de `00-fontes.md` §3 e salvar em `inputs/` | arquivos | desbloqueia Postgres/Security |

## Skills usadas na Fase 1 (as que realmente usei)
`fullstack-dev-skills:common-ground` (Fase 0) e `fullstack-dev-skills:spec-miner` (carregada). A leitura de Rust, presença/Realtime e contrato da API foi
feita por mim com Read/Grep/Bash, **sem carregar as skills** `rust-engineer`, `websocket-engineer`, `api-designer`, `sre-engineer`, `debugging-wizard`,
`secure-code-guardian` nem `security-reviewer` (os documentos seguem o método delas, mas não as invoquei). `postgres-pro`, `database-optimizer` e `sql-pro`
**não** foram usadas (aguardam o schema).

## Decisões que preciso do dono
1. Caminho/remoto/commit da API do Render.
2. Executar os testes P-1 a P-14 (ou me dizer quais pular).
3. Confirmar que posso seguir para a Fase 2 (PLAN.md) mesmo sem a API e sem o schema (o plano ficaria com os trechos de API/RLS marcados `[INFERIDO]`).

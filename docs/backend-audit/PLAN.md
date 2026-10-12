# PLAN: sistema de comunicação (presença, chamadas 1:1, base para mensagens e salas)

Data: 2026-10-12. Status: **proposta, aguardando aprovação do dono. Nenhum código foi escrito.**
Base: `RESUMO.md` e `REVALIDACAO.md` (leia primeiro). Rótulos: `[VERIFICADO: arquivo:linha]` ou `[INFERIDO]`. Tudo que depende do schema real ou do código da API do Render está `[INFERIDO]`.
Skills usadas para este plano: `architecture-designer`, `the-fool` (seção "Desafio"), mais as 6 da revalidação (lista em `REVALIDACAO.md`).

## 0. Resumo executivo

1. O risco crítico (canais Realtime públicos) **não tem contenção que dispense app novo**. Qualquer correção, inclusive filtrar remetente no receptor, é código do cliente. Dá para fazer uma versão **compatível** (1.0.3) que
   não derruba quem está no app antigo, mas a adoção é manual (o app não se atualiza sozinho, ver §3.3), então o risco só fecha de verdade quando o acesso público do Realtime for desligado, o que **derruba todos os clientes antigos** (documentação oficial).
2. A correção definitiva é um **protocolo v2**: canais `private: true` com policies, eventos de chamada e presença **publicados pelo servidor** (`realtime.send` a partir de funções SQL), identidade vinda do JWT. Convive com o v1 durante uma janela, com critério mensurável para desligar o antigo.
3. A causa da presença offline **não está provada** e a hipótese que eu defendia (timers estrangulados) foi rebaixada. O plano **mede antes de construir** (P-1 a P-3) e começa pelas mitigações baratas (heartbeat do Realtime em Worker, `leave` com carência, chave por instância) antes de qualquer heartbeat nativo.
4. Ordem recomendada (difere da sugerida em um ponto; ver §2): **1.0.3 compatível** = A1 + B1 + D1 + F1, depois **C** (detecção ambiente, sem dependência de schema), e só então o bloco bloqueado pela Fatia 0 (A2, B2/B3, D2, E).
5. Esforço total honesto: **9 a 14 semanas de um desenvolvedor** (§11), com ±50% de incerteza até a Fatia 0 chegar.

## 1. Estratégia de testes manuais: quais dos P-1..P-14 são imprescindíveis

| ID | Decide o quê | Veredito |
| --- | --- | --- |
| **P-1, P-2, P-3** | Se o heartbeat nativo (B4) entra no plano e qual mitigação vale (H1, H2, H7, H8, H3) | **IMPRESCINDÍVEIS** (você pediu): rodar com **uma** instância por conta |
| **P-10** | Se F1 (excluir só o WebView2) entra na 1.0.3 | **IMPRESCINDÍVEL**, 10 minutos |
| **P-14** (consultas do schema) e o repo da API | Desbloqueiam a Fatia 0 | **IMPRESCINDÍVEL para o bloco bloqueado**, não para a 1.0.3 |
| P-4 | Confirma o Problema 2 | recomendado (15 min); o código já prova a causa, o teste só protege contra surpresa |
| P-5, P-7, P-8, P-11 | Aceite de D1/D2 | podem esperar; viram **testes de aceite** |
| P-6 (cold start), P-9 (DM offline) | Aceite de D1 e E | podem esperar |
| P-12 | Backlog de drivers | pode esperar |
| P-13 | Só confirmaria o que a documentação oficial já afirma | **opcional, só em contas de teste**; não bloqueia nada |

## 2. Ordem das fatias, com justificativa

Sua ordem: (a) conter o Realtime, (b) presença, (c) detecção ambiente, (d) chamadas 1:1, (e) DMs, (f) áudio da tela inteira, (g) drivers.

**Concordo com o princípio e discordo em três pontos:**
- **(a) vira duas fatias.** A1 (contenção compatível, sem servidor) vai já; A2 (canais privados) **precisa da Fatia 0** e não pode ser planejada com precisão antes.
- **Antecipar os itens pequenos de (d) e (f) para a 1.0.3.** O reconhecimento de "autenticacao", o guard do transceiver e o convite em paralelo com a mídia são correções de 1 a 3 dias, sem schema, que resolvem sintomas que o usuário já viu. Esperar a máquina de estados do servidor (D2, grande) para só então corrigi-los deixa os bugs vivos por meses. F1 (Rust, ~2 dias) também não depende de schema.
- **(c) vem antes do bloco bloqueado**, porque é independente de schema/API e resolve um problema observado (jogo fora do hub).

Resultado:

| Release | Fatias | Depende de Fatia 0? |
| --- | --- | --- |
| **Fatia 0** (paralela, é trabalho seu) | insumos | n/a |
| **1.0.3 "estabilização compatível"** | A1, B1, D1, F1 (F1 só se P-10 confirmar) | **não** |
| **1.1.0** | C (detecção ambiente) | não |
| **1.2.0 "protocolo v2"** | A2, B2/B3, D2, depois E | **sim (bloqueadas)** |
| backlog | B4 (heartbeat nativo, só se P-1 pedir), G (drivers), F2 (consolidar `audio_capture`) | G: audit only |

## 3. Compatibilidade com versões antigas (seu item 3)

### 3.1. O que a documentação oficial confirma
- Desligar "Allow public access" faz clientes que não usam `config.private = true` serem recusados com `PrivateOnly`, e **qualquer mudança nessa tela desconecta todos os clientes** (Supabase, Realtime Settings).
  Logo: **exigir canais privados derruba o app antigo** (presença, fast-path de DM, convites de chamada e sinalização usam canais públicos).
- Enquanto a opção ficar ligada, canais privados **funcionam em paralelo** com os públicos (a policy só é checada nos privados). É isso que permite o expand/contract.

### 3.2. Metadados de versão (para saber quem está na rede)
- `APP_PROTOCOL_VERSION` (inteiro; v1 = 1, o novo = 2) e `appVersion` (`getVersion()`), enviados em: o heartbeat de presença (coluna nova), o `metadata` do participante LiveKit (hoje só `{avatar}`: `useVoiceCall.ts:1969`) e o payload de convite do caminho legado.
  Cliente que não envia = **protocolo 1**.
- Uma tabela de configuração `app_config` (`min_protocol_version`, flags remotas) lida no boot e a cada 10 min pelo cliente novo. Serve de **kill switch** sem lançar versão (só vale para clientes que já têm a leitura).

### 3.3. Limite duro: o app não se atualiza sozinho
`checkForUpdates` consulta a última release do GitHub e `downloadUpdate` abre o navegador (`src/lib/tauriAPI.ts:439-446`); `tauri.conf.json` tem `updater.pubkey = ""` e `endpoints = []` [VERIFICADO: `tauri.conf.json:60-65`].
**Consequência:** a adoção depende de cada amigo baixar o instalador. A janela de convivência precisa ser longa, e o banner "versão obsoleta" entra já na 1.0.3 (para a próxima virada, não para esta).
Decisão a considerar (sua): configurar o updater do Tauri com assinatura (ADR futura); sem isso, o critério de desligamento é o que mede a rede, não uma data.

### 3.4. Janela de convivência (expand/contract)
1. **Expand (1.0.3, 1.1):** nada muda na rede; só metadados e correções compatíveis.
2. **Dual-stack (1.2.0):** cliente novo **assina os dois conjuntos de tópicos** (v1 públicos e v2 privados) e **publica nos dois enquanto houver par v1**. Escolha por par: se o `protocol_version` do par for 2, publica só no v2 e **ignora controle vindo do tópico v1 para aquela sessão**; se for 1 ou desconhecido, usa v1. Dedupe por `event_id`/`call_session_id`.
3. **Contract:** desligar o v1 quando **todas** forem verdade: (i) ≥ 95% dos usuários com heartbeat nos últimos 7 dias têm `protocol_version = 2`; (ii) pelo menos 6 semanas desde o lançamento da 1.2.0; (iii) aviso in-app e nas notas da release com ≥ 14 dias de antecedência; (iv) ensaio no projeto de **staging** do desligamento de "Allow public access" com os clientes novos funcionando.
   O desligamento é uma ação única no painel, em horário de baixo uso, e **desconecta todos** (os novos reconectam sozinhos). **Rollback:** religar a opção (também desconecta uma vez).
4. Sem `protocol_version` observável, o critério (i) não existe: por isso o heartbeat com versão sai **antes** (1.0.3/B1) do dual-stack.

### 3.5. Contenção de curto prazo "sem app novo": avaliação e recomendação
**Não existe contenção do lado do servidor que impeça forja nos canais públicos sem derrubar o app antigo** (a única alavanca é desligar o acesso público; baixar "max events per second" só limita volume, não a forja).
Qualquer filtro no receptor é código do cliente, então "sem app novo" é impossível; o que dá para ter é **um app novo que não quebra o antigo** (1.0.3). Conteúdo recomendado (Fatia A1):
1. **Validar o par esperado no receptor** para `call:end`, `call:kick`, `call:privacy`, `call:answer` e `call:signal`: só aceitar de quem é o par da sessão atual (1:1: `friendUid`; sala: `hostUid` do servidor/sessão). Remove o `|| !currentHost`. **Limite honesto:** o `senderId` ainda vem do payload, então quem conhece os UIDs forja; o filtro bloqueia abuso casual e aleatório, não um atacante que sabe os dois UIDs. É melhora real, não solução.
2. **Convite só de amigo:** descartar `call:invite` de quem não está na lista de amigos.
3. **Fast-path de DM sem texto** quando o par for protocolo ≥ 2: publica só `{ id, chatId, clientId }` e o destinatário lê a linha (protegida por RLS). Isso **fecha o vazamento de confidencialidade** para pares atualizados. Para par v1/desconhecido continua o payload completo (senão o app antigo mostra mensagem vazia).
4. **Parar de publicar** no canal global `checkpoint_presence_bus` (`track`) quando o cliente novo tiver audiência de amigos; mantém a escuta por compatibilidade.
5. **Banner de versão** quando o `app_config.min_protocol_version` for maior que a do cliente.
**Recomendação:** fazer A1 já (3 a 4 dias) e tratá-la como **mitigação**, não como correção. O risco só fecha com A2 + desligamento do acesso público.

## 4. Fatia 0: insumos (BLOQUEIO das fatias de mensagens, RLS e token do LiveKit)

Responsável: **dono**. Entradas:
1. Schema real via as 8 consultas de `00-fontes.md` §3, salvas em `docs/backend-audit/inputs/` (inclui `08-migrations-aplicadas.csv`, que diz se `20261010120000` e as outras 16 migrations rodaram).
2. **Repositório da API do Render** (caminho/remoto/commit publicado). Preciso reler: `/api/presence`, `/api/friends/status`, `/api/voice/livekit-token`, `/api/voice/rooms/*`, `/api/chat/open`, validação do JWT, CORS, rate limit, uso de `service_role`.
3. **Plano do Supabase** (Free ou Pro) e o estado atual de "Allow public access" (só olhar o painel).
4. **Projeto de staging do Supabase** (gratuito) para testar policies de `realtime.messages` e o desligamento do acesso público. Não há Docker nesta máquina (pgTAP local não roda) e não se testa isso em produção.
5. Resultados de P-1, P-2, P-3, P-10 (e P-4 se der).
**O que fica bloqueado até a Fatia 0:** A2 (policies de Realtime), B2/B3 (tabela e RPCs de presença), D2 (tabela e RPCs de chamada), E (confirmar `client_id` e RLS), token do LiveKit fora do Render.
**Perguntas em aberto que a Fatia 0 responde:** o `livekit-token` ignora a `identity` do corpo? há RLS em `xp_events`? `profiles.status` aceita `playing`? existe job que expira presença? o `password_hash` aparece no `postgres_changes`?

## 5. Fatias do bloco 1.0.3 (sem dependência de schema)

### A1. Contenção compatível do Realtime e metadados de versão
- **Objetivo:** reduzir abuso casual, fechar o vazamento de DM para pares atualizados e introduzir `appVersion`/`protocolVersion`.
- **Arquivos:** `src/hooks/useVoiceCall.ts` (receptores `onEnd`, `onKicked`, `onPrivacy`, `onSignal`, `onInvite`), novo `src/services/voiceCall/eventGuards.ts` (**funções puras**, testáveis), `src/services/realtimeEventBus.ts` (publicação sem texto), `src/services/chat.ts` (receber `ping` e buscar a linha), `src/services/voiceCall/types.ts` (campo `pv` opcional), `src/lib/protocolVersion.ts`.
- **Aceite:** (1) `call:end` de quem não é o par da sessão é ignorado e registrado no log; (2) `call:kick` só vale se o remetente for o host da sessão conhecido localmente, sem o ramo `!currentHost`; (3) convite de não amigo é descartado; (4) DM entre dois clientes novos não carrega o texto no broadcast; DM entre novo e antigo continua funcionando; (5) nenhum fluxo legítimo quebra (1:1, sala, reconexão do amigo).
- **Testes:** unitários dos guards com tabela de casos (incluindo prefixo `cp-friend:`); teste de que o payload de DM novo não tem `text`; teste de compatibilidade: receptor novo aceita payload completo do v1. Manual: P-5, P-11, DM entre versões (par novo/antigo).
- **Flag:** `localStorage.pherielium_strict_events` (liga por padrão; desliga em caso de falso positivo) e, depois, a flag remota de `app_config`.
- **Rollback:** desligar a flag (volta ao comportamento atual), sem migração.
- **Riscos:** falso positivo derruba chamada legítima (ex.: o par entra com UID em formato diferente); DM novo→antigo não pode degradar. **Mitigação:** guards puros + log de descarte antes de qualquer bloqueio visível (modo "só log" por 1 release opcional).
- **Decisões suas:** (i) aceita modo "só log" primeiro? (ii) o que mostrar quando um convite de não amigo é descartado (nada ou aviso)?
- **Esforço:** 3 a 4 dias.

### B1. Mitigações baratas de presença (depois do P-1)
Fica **condicionada ao P-1**: só implementar o que a medição indicar.
- **Opções, com custo e risco (seu item 4):**

| Mitigação | Custo | Risco | Ataca |
| --- | --- | --- | --- |
| `realtime: { worker: true }` no `createClient` (heartbeat do WebSocket em Web Worker; a opção existe no `@supabase/realtime-js` 2.116 instalado; a CSP já permite `worker-src blob:`) | XS (1 linha + teste) | baixo; confirmar que o worker sobe sob a CSP | H2 |
| `leave` com **carência** (criar de fato o `presenceLeaveTimers` que hoje nunca recebe `set`) e só virar offline se o servidor/TTL confirmar | S | baixo | H2 |
| **Chave de presença por instância** (`uid:instanceId` em vez de `uid`) e agregação por `uid` | S | médio (muda a semântica do `leave`; v1 e v2 convivem) | H8 |
| Argumento do WebView2 `--disable-background-timer-throttling` via `additionalBrowserArgs` na janela (o campo `additional_browser_args` existe na config do Tauri instalado) | XS | médio: **substitui** os argumentos padrão do Tauri, e a Microsoft avisa que switches inválidos são ignorados; testar o build empacotado | H1 |
| Trocar `window.hide()` por **minimizar** ao detectar o jogo (seu item 4) | S | **provavelmente inócuo**: o Chromium trata janela minimizada como oculta (mesmo throttling); aparece na barra de tarefas e muda o foco/overlay; só vale se o P-3 mostrar diferença entre "oculta" e "minimizada" | H1 |
| Corrigir comentário/constante (75 s vs 90 s) e unificar o TTL | XS | nenhum | clareza |
- **Aceite:** com o jogo aberto pelo hub por 30 min, o amigo não vê "offline" em nenhum momento (P-1 repetido); sem regressão de presença com o app aberto.
- **Flag/rollback:** cada mitigação é independente; `worker` e `additionalBrowserArgs` voltam removendo a linha.
- **Decisão sua:** qual das mitigações aplicar depois do P-1.
- **Esforço:** 1 a 3 dias.

### D1. Correções pequenas de chamada 1:1 (sem schema)
- **Objetivo:** matar três bugs que o usuário já viu, sem esperar o servidor.
- **Arquivos:** `src/services/voiceRooms.ts` (`shouldUseSupabaseVoiceFallback` passa a decidir por **status HTTP**: só rede, timeout, 5xx e 429 caem no fallback; 401/403 não; erro tipado com `status`), `src/hooks/useVoiceCall.ts` (garantir `addTransceiver("audio")` antes de `createOffer` quando não há trilhas, em `:3128-3140` e `createPeerConnectionForPeer` `:2386-2395`; **enviar o convite em paralelo com a conexão da mídia** em `:3079-3118`), `src/services/voiceCall/transportPolicy.ts` (fim da assimetria).
- **Fim da assimetria:** o chamador **não cai para P2P por erro individual**. Política: tentar de novo o LiveKit com recuo (até 3 vezes, ~10 s no total), e se falhar, **encerrar a sessão com motivo `media_error` e avisar os dois lados** em vez de dividir transportes. P2P só quando o LiveKit estiver desligado globalmente (comportamento atual para `join-room`/`join-invite`).
- **Convite antes da mídia:** `sendCallInvite` sai logo depois de adquirir o microfone; token e preflight rodam enquanto toca. O cronômetro de "não atendeu" passa a contar do envio do convite.
- **Aceite:** (1) com `livekit-token` bloqueado no chamador (P-7), os dois veem erro claro, **não** ficam em transportes diferentes; (2) o toque chega ao destino em < 3 s mesmo com Render frio (P-6); (3) oferta P2P sem microfone não lança `max-bundle`; (4) 401 não chama o RPC de fallback; erro de rede chama.
- **Testes:** função pura de decisão de fallback (tabela de status), política de transporte (tabela), teste de que `createOffer` com stream nulo adiciona transceiver (mock de `RTCPeerConnection`); manual P-6, P-7.
- **Flag:** `pherielium_call_invite_first` (liga por padrão); os outros dois itens são correções diretas.
- **Rollback:** desligar a flag restaura a ordem antiga; o resto é revert do commit.
- **Riscos:** o destino toca antes de o chamador ter mídia pronta e responde rápido; o chamador precisa tolerar `accepted` chegando antes do LiveKit. Caracterizar com teste antes (ver §8).
- **Decisões suas:** aceita **encerrar** a chamada quando o LiveKit falha (em vez de P2P silencioso)? Meu padrão: sim.
- **Esforço:** 3 dias.

### F1. Áudio da tela inteira: excluir só a árvore do WebView2 (Rust)
- **Pré-condição:** P-10 mostrar áudio mudo só para jogo lançado pelo hub.
- **Objetivo:** capturar o áudio do jogo lançado pelo hub sem reintroduzir a voz da chamada no stream. **Não regredir** o áudio da voz nem o recorte do áudio do sistema.
- **Arquivos:** `src-tauri/src/commands/win_loopback.rs` (função que define `TargetProcessId`), com `sysinfo` para achar o `msedgewebview2.exe` raiz (pai == `std::process::id()`); novo erro tipado `WebViewProcessNotFound`; testes de função pura que escolhe a raiz entre processos fake.
- **Aceite:** com o jogo aberto pelo hub e tela inteira, o espectador ouve o jogo; a voz da chamada **não** aparece no áudio da tela (testar com 2 contas); se a raiz não for achada, erro explícito e UI avisa "Áudio do PC indisponível", **nunca** queda para mix do sistema.
- **Testes:** unitário (seleção da raiz), `cargo test`, manual P-10 e uma chamada com voz durante o compartilhamento.
- **Flag:** `pherielium_audio_exclude_webview` (padrão ligado); desligada, usa a regra atual.
- **Rollback:** desligar a flag.
- **Riscos:** `msedgewebview2.exe` pode ter mais de uma raiz (várias janelas com o mesmo perfil compartilham um browser process, mas isso precisa ser medido) [INFERIDO]; eco da voz se a exclusão ficar incompleta.
- **Decisão sua:** consolidar depois com o módulo `audio_capture` (F2, backlog).
- **Esforço:** 2 a 3 dias.

## 6. C: detecção ambiente de jogo, fonte única no Rust (release 1.1.0)

- **Objetivo:** o Rust passa a ser a única fonte do estado "qual jogo está rodando", detectando jogos abertos de qualquer forma, e o front só espelha.
- **Desenho:** novo módulo `src-tauri/src/commands/game_state.rs` (ou pasta `game_state/`):
  1. o front envia o **índice da biblioteca** por `game_index_set` (lista `{gameId, title, exePaths, dirs}`), validado na borda;
  2. uma única tarefa (`spawn_blocking` para o `sysinfo`) atualiza a lista de processos a cada 2 a 3 s, reaproveitando o refresh que o watcher de alvo já faz, e casa por caminho exato, depois por diretório, depois por **nome do executável** (fallback para processos protegidos);
  3. emite `emit_to("main", "game-state:changed", { gameId, pid, startedAt })` e abre/fecha sessão no `store/sessions.rs` (que já existe);
  4. `game_watch_set_target` vira apenas "dica de prioridade" (compatível).
- **Arquivos:** `src-tauri/src/commands/game_state*.rs`, `lib.rs`, `src/hooks/useGamePresence.ts` (vira espelho; remove o bloqueio de `shouldAllowBackgroundSessionConfirm` quando a flag estiver ligada), `src/utils/sessionPolicy.ts`.
- **Aceite:** jogo da biblioteca aberto fora do hub aparece como "jogando" em ≤ 5 s (P-4), abre sessão de tempo de jogo e some ao fechar; jogos lançados pelo hub continuam iguais; CPU do app < 1% em média com 300 processos.
- **Testes:** unitários Rust do casamento (fixtures de caminhos, helpers a ignorar via `is_excluded_helper_executable`, nome vs caminho); teste de contrato do payload do evento; manual P-4 com 3 jogos (um com anticheat).
- **Flag:** `pherielium_ambient_game_detection` (padrão desligado na 1.1.0 por uma versão, depois ligado). **Rollback:** desligar volta ao caminho atual.
- **Riscos:** falso positivo (launchers e helpers); processos protegidos sem caminho (`exe()` vem `None`) [INFERIDO]; custo de CPU. Mitigação: lista de exclusão existente, medição de CPU no aceite.
- **Decisão sua:** nome do executável sozinho basta como fallback ou exige título de janela também?
- **ADR:** `0003`.
- **Esforço:** 8 a 10 dias.

## 7. Bloco 1.2.0 "protocolo v2" (BLOQUEADO pela Fatia 0): esboços e perguntas em aberto

### 7.1. A2: canais privados e policies de Realtime (esboço)
- **Tópicos v2:** `v2:user:{uid}` (caixa de entrada pessoal), `v2:call:{sessionId}` (sinalização efêmera de uma chamada), `v2:room:{roomId}`. Sufixo `v2:` evita conflito com os nomes públicos v1.
- **Policies em `realtime.messages`** [INFERIDO, depende das tabelas reais]: SELECT em `v2:user:*` só se `topic = 'v2:user:' || auth.uid()`; SELECT/INSERT em `v2:call:{id}` só para `caller_id`/`callee_id` da sessão; `v2:room:{id}` só para membros ativos. Índices em `call_sessions(caller_id, callee_id)` e `voice_room_members(room_id, user_id)` para a policy não custar caro (a policy roda a cada join).
- **Publicador:** eventos de autoridade (`call.ringing`, `call.ended`, `presence.changed`, `message.new` ping) saem de **funções SQL** com `realtime.send(payload, event, topic, true)`; o cliente **não publica** eventos de controle. Só ficam no cliente os efêmeros (digitando, ICE) e, mesmo esses, em canal privado.
- **Perguntas:** o plano é Free ou Pro? quantas conexões simultâneas reais? as policies podem consultar `friendships` sem custo?

### 7.2. B2/B3: presença por TTL no servidor, "jogando" como atividade (detalhado onde não depende de dado externo)
- **Modelo (expand, aditivo)** [INFERIDO nas tabelas existentes]:
  `user_presence(user_id uuid pk references auth.users, availability text check in ('online','idle','dnd','invisible'), activity jsonb null, last_heartbeat_at timestamptz not null, app_version text, protocol_version int, instance_id text)`.
  RPC `presence_heartbeat(p_availability, p_activity, p_instance, p_app_version, p_protocol)` (SECURITY DEFINER, usa `auth.uid()` e `now()` do banco). RPC `friends_presence()` devolve só amigos aceitos, com `server_now`, e calcula `status = 'offline'` se `server_now - last_heartbeat_at > ttl` (ou `invisible`).
- **Regras:** (1) **status** é a disponibilidade escolhida; **jogando é `activity`**, nunca substitui `dnd`/`idle`; (2) **TTL = 90 s** (3× o heartbeat de 30 s); (3) **o relógio do servidor é o único árbitro** (acaba com a comparação de `Date.now()` do remetente na ordenação, `presenceOrdering.ts`/`checkpointFriends.ts:126`); (4) heartbeat só atualiza `last_heartbeat_at`; **mudança de disponibilidade/atividade** dispara um `realtime.send` para os amigos (fan-out só em mudança, não a cada heartbeat), derrubando o custo de F+1 mensagens a cada 25 s para ~0;
  (5) assinatura **só de amigos** pelo tópico privado; some o canal global.
- **Coexistência:** um trigger em `profiles` copia as atualizações que o **app antigo** faz via API (`status`, `playing`, `presence_updated_at`) para `user_presence` (com `protocol_version` nulo = v1). Assim usuários v1 aparecem para viewers v2 [INFERIDO: depende de a API escrever essas colunas, como diz o comentário em `AuthProvider.tsx:209-213`].
- **Perguntas:** a API grava `playing`? há job de expiração? o plano suporta ~F mensagens por mudança?

### 7.3. D2: sessão de chamada autoritativa (detalhado; schema/API `[INFERIDO]`)

**Modelo** [INFERIDO]:
`call_sessions(id uuid pk default gen_random_uuid(), caller_id, callee_id, state text, client_request_id text unique, created_at, ringing_until timestamptz, answered_at, ended_at, end_reason text, media_room text, protocol_version int)`.
RLS: SELECT para `caller_id`/`callee_id`; **nenhum INSERT/UPDATE direto**. Índice parcial `unique (callee_id) where state in ('ringing','accepted','active')` e idem para `caller_id` garante **no máximo uma chamada viva por pessoa**.
RPCs (SECURITY DEFINER, `auth.uid()` como identidade): `call_start(p_callee, p_client_request_id)`, `call_accept(p_id)`, `call_decline(p_id)`, `call_cancel(p_id)`, `call_end(p_id, p_reason)`, `call_media_ready(p_id)`, `call_history(p_before, p_limit)`. Cada uma é **idempotente** e valida a transição.
Eventos: `realtime.send` para `v2:user:{callee}` (`call.ringing`) e para ambos (`call.updated`), mais `postgres_changes` em `call_sessions` como rede de segurança (o destino que abre o app depois vê a chamada perdida).

```mermaid
stateDiagram-v2
    [*] --> ringing: call_start (callee livre)
    [*] --> busy: call_start (callee ocupado) [terminal]
    ringing --> accepted: call_accept (antes de ringing_until)
    ringing --> declined: call_decline [terminal]
    ringing --> canceled: call_cancel (chamador) [terminal]
    ringing --> missed: expira (ringing_until + 5 s) [terminal]
    accepted --> active: call_media_ready (os dois)
    accepted --> failed: sem mídia em 30 s [terminal]
    active --> ended: call_end (qualquer lado) [terminal]
    active --> failed: queda sem reconexão em 60 s [terminal]
```

```mermaid
sequenceDiagram
    participant A as Chamador (A)
    participant S as Supabase (RPC + Realtime)
    participant B as Destino (B)
    participant L as LiveKit
    A->>S: call_start(B, requestId)
    S-->>A: sessão ringing (id, ringing_until)
    S-->>B: realtime.send call.ringing (v2:user:B)
    par mídia em paralelo com o toque
      A->>L: token + conectar
    and
      B-->>B: toca (35 s)
    end
    B->>S: call_accept(id)
    S-->>A: call.updated accepted
    B->>L: token (sessionId) + conectar
    A->>S: call_media_ready(id)
    B->>S: call_media_ready(id)
    S-->>A: active
    S-->>B: active
```

**Expiração ("perdida/não atendeu")** sem servidor próprio: `ringing_until` é gravado no servidor; `call_accept` **recusa** depois do prazo; um job `pg_cron` marca `missed` e envia o evento; o cliente também tem timer, mas o servidor decide. [INFERIDO: precisa confirmar `pg_cron` e granularidade no plano].
**Reconexão:** queda de rede não encerra a sessão; o cliente que volta chama `call_get(id)`; se `active` e dentro de 60 s, reconecta no LiveKit com o mesmo `media_room`; se passou, `failed`.
**Compatibilidade (dual-stack):** se o par for v1, o cliente novo continua usando o caminho legado de convite/atendimento (sem sessão no servidor) e **não grava** `call_sessions` para esse par; a máquina de estados do servidor só vale entre dois clientes v2 (`protocol_version = 2` dos dois). O histórico de chamadas v1 não existe e não será criado.
- **Token do LiveKit** (seu pedido de avaliar sair do Render): o ideal é uma **Edge Function** do Supabase que recebe só `sessionId`/`roomId`, valida participação/limite/senha com o JWT do usuário e assina o token (o segredo `LIVEKIT_API_SECRET` iria para os *secrets* do Supabase). **O que isso exige:** (1) o código atual da API para copiar regras (TTL, grants, metadata); (2) mover o segredo; (3) CORS e `verify_jwt`; (4) um período em que o app antigo continua chamando o Render. Elimina o cold start de > 35 s na chamada. **Esboço, bloqueado pela Fatia 0.** ADR `0005`.
- **Perguntas:** a API atual valida amizade no token? o limite de participantes é imposto onde? `pg_cron` disponível?
- **Aceite (esboço):** ocupado, recusada, perdida (destino com app fechado, vendo depois no histórico), cancelada e queda/reconexão funcionam com os dois lados vendo o mesmo estado; duas instâncias da mesma conta não geram duas chamadas.
- **Flag:** `app_config.call_server_state` (remota) + local. **Rollback:** desligar a flag volta ao caminho legado; as tabelas ficam (aditivas).
- **Esforço:** 12 a 15 dias (+ 5 dias do token em Edge Function).

### 7.4. E: DMs com fila de reenvio offline (esboço)
- **Cliente:** `outbox` persistido (IndexedDB), entradas `{clientId, chatId, text, createdAt, attempts, status}`; envio idempotente por `client_id` (já existe o índice único `(chat_id, client_id)` **se** a migration `20261010120000` estiver aplicada); retry com recuo e no evento `online`; estados visíveis `enviando / falhou / enviado`. **Fim do `return fastMsg` otimista** em `chat.ts:417`.
- **Servidor:** paginação por cursor (`created_at, id`), contadores de não lidas por RPC. `sender_id` por trigger (`auth.uid()`), não pelo corpo.
- **Perguntas:** a RLS de `chat_messages` garante `sender_id = auth.uid()` no INSERT? o `client_id` existe em produção?
- **Esforço:** 5 a 6 dias (cliente) + 3 (servidor).

## 8. Decomposição do `useVoiceCall` (4.846 linhas) sem reescrever

1. **Antes de mexer:** testes de caracterização das funções que já são puras (`transportPolicy`, `volumeKeys`, `callDiagnostics`, `limits`, `mediaStats`) e **novos** testes para o que for extraído.
2. Extrair, nesta ordem, **sem mudar comportamento**: (a) `callStateMachine.ts`, reducer puro `(state, event) → state` com os 5 estados atuais mais os terminais novos; (b) `eventGuards.ts` (A1); (c) `callSignaling.ts`, adaptador com duas implementações (v1 e v2) atrás de uma interface; (d) `callMedia.ts` (conectar/publicar LiveKit e P2P). O hook fica como composição.
3. Cada extração é um commit de **refactor** separado da correção, e roda atrás da mesma interface (estrangulamento).
4. Meta: nenhum arquivo > ~400 linhas; o hook deixa de ser dono de timers de toque (passam para a máquina de estados).

## 9. Ameaças específicas do Realtime e como o v2 as fecha

| Ameaça | v1 hoje | v2 |
| --- | --- | --- |
| Assinar a caixa de outro usuário (ler DM/presença) | possível (público) | policy: só o dono do `uid` |
| Forjar `call:end`/`kick`/`privacy`/`signal` | possível | cliente não publica controle; servidor publica após validar a transição |
| Convite falso/spam | possível | `call_start` valida amizade e limite; rate limit no RPC |
| Identidade do remetente no payload | confiada | `sender_id` injetado pelo servidor (`auth.uid()`) |
| Presença de todos num canal só | vaza para todos | amigos apenas, tópico privado |
| Flood | sem limite | limites de plano + rate limit nos RPCs [INFERIDO] |

**Capacidade (hipóteses a validar):** o teto é de **200 (Free) ou 500 (Pro) conexões simultâneas**, 100/500 msg/s e 20/50 eventos de presença/s. O v2 reduz o tráfego de presença de F+1 mensagens a cada 25 s para mensagens só em mudança. Teste de carga: 100/300/500 clientes simulados (script contra **staging**), medir msg/s, p95 de entrega de `presence.changed` e CPU do banco. Pergunta ao dono: quantos usuários simultâneos você espera em 6 meses?

## 10. Testes e entrega

- **Unitários:** guards, máquina de estados, decisão de fallback, escolha da raiz do WebView2, casamento de processos, formatação de TTL.
- **Contrato:** payloads v1 aceitos pelo cliente v2 e vice-versa (fixtures), validados na borda.
- **RLS (pgTAP) e policies de Realtime:** **no staging** (Docker não instalado aqui).
- **Manual (2 a 3 contas):** `RESUMO.md` P-1..P-14, com a classificação do §1.
- **Verificação por commit (CLAUDE.md):** `npm run typecheck`, `lint` (sem erro novo nos arquivos tocados), `npm test`, `cargo check`, `clippy` (sem erro novo nos arquivos tocados), `cargo test`. Baselines: ESLint 387, clippy 19.
- **Documentação no mesmo commit:** `docs/ARCHITECTURE.md` (a criar quando A2/D2 entrarem), ADRs em `docs/decisions/`.

## 11. Estimativa honesta de esforço (1 desenvolvedor; dias úteis)

| Fatia | Dias | Confiança |
| --- | --- | --- |
| A1 | 3 a 4 | alta |
| B1 | 1 a 3 | média (depende do P-1) |
| D1 | 3 | alta |
| F1 | 2 a 3 | média |
| C | 8 a 10 | média |
| A2 | 8 a 10 | baixa (schema) |
| B2/B3 | 5 a 6 | baixa |
| D2 | 12 a 15 (+5 token) | baixa |
| E | 8 a 9 | baixa |
| B4 (só se necessário) | 5 | média |
| Decomposição do hook (§8, diluída nas fatias) | 6 a 8 | média |
**Total:** 1.0.3 ≈ 2 semanas; 1.1.0 ≈ 2 semanas; 1.2.0 ≈ 6 a 9 semanas; **9 a 14 semanas** no conjunto, ±50% até a Fatia 0.

## 12. O que NÃO vale reescrever
`apiFetch` e a camada de refresh de sessão (`api.ts`), o uso do LiveKit como transporte, o módulo `audio_capture` (tabela de modos, sonda; só **ligar**), `store/sessions.rs`, `launch_guard.rs`, a idempotência por `client_id` do chat, a lógica de volume por faixa recém-corrigida, o resto do `useVoiceCall` que não seja timers/sinalização. **Não** trocar o LiveKit nem o Supabase.

## 13. Backlog (G, drivers: somente auditoria)
Nada será implementado. **Evidência nova (rc.1, 2026-10-12):** duas janelas "Invalid command line"; causa raiz verificada (detecção `ReadRegStr` x `REG_DWORD` sempre falsa + switches de WiX Burn em bootstrappers do Advanced Installer) e correção proposta em `docs/backend-audit/12-drivers-invalid-command-line.md`. Itens para quando você pedir: gerar também o hook no alvo MSI ou remover o alvo `msi`; gravar log do instalador em arquivo; avisar sobre reinício do HidHide; verificar o serviço depois do reinício (ver `02-rust.md` R10).

## 14. Desafio (the-fool: pré-mortem + red team, modo escolhido por mim)

Tese reforçada: "migrar a autoridade da chamada e da presença para o servidor, com canais privados e convivência de versões, fecha o risco crítico e as falhas de estado".
1. **"Receptor filtra remetente" parece contenção, mas é forjável** (o `senderId` está no payload). Mudança no plano: A1 virou **mitigação declarada**, e o fechamento real depende de A2 + desligar o acesso público.
2. **O app não se atualiza sozinho** (§3.3). Se 20% dos amigos ficarem na 1.0.2 por meses, o critério de 95% nunca chega. Mudança: o critério é **medido** (heartbeat com versão sai antes), há a opção de configurar o updater, e o desligamento tem data anunciada com ≥ 14 dias.
3. **Desligar o acesso público derruba todos, inclusive os novos, e não dá para ensaiar em produção.** Mudança: staging obrigatório na Fatia 0 e ação em horário de baixo uso.
4. **Policies de Realtime rodam a cada join; uma policy lenta derruba a plataforma sob carga.** Mudança: índices nas tabelas consultadas e teste de carga no aceite de A2.
5. **A causa do problema 1 não foi provada** e eu já errei a ordem uma vez. Mudança: nada de heartbeat nativo antes do P-1; B1 só implementa o que a medição apontar.
6. **Cold start do Render ainda afeta a primeira chamada.** Mudança: D1 desacopla o convite da mídia; D2 move o estado da chamada para o Supabase (sem Render); token em Edge Function é o passo final.
7. **Falsos positivos do A1 podem derrubar chamadas legítimas** (formato de UID, prefixo `cp-friend:`). Mudança: guards puros com tabela de casos e modo "só log".
8. **Suposição não verificada que sustenta o plano:** que a API grava `profiles.status/presence_updated_at` e que o trigger-ponte funciona. Marcada `[INFERIDO]` e travada pela Fatia 0.
Resposta do dono pendente nos pontos que não consegui decidir sozinho (ver §15).

## 15. Decisões do dono (aprovação de 2026-10-12) e alterações ao plano

Este capítulo **tem precedência** sobre os §5 a §7 quando houver conflito. **Atenção: o §17 (nova prioridade) tem precedência sobre este capítulo.** Itens do §15 que ficam no backlog pelo §17: B1, A2/U/C e o resto da lista 1.0.3 (A1 e D1 já entregues permanecem).

### 15.1. Decisões
1. **Ordem aprovada:** A1 → B1 → D1 → F1 no 1.0.3; depois C; depois A2, B2/B3, D2 e E (após a Fatia 0).
2. **A1:** modo "só log" **apenas** para os filtros do receptor (par esperado e convite de não amigo), atrás de flag, por no máximo um release (~1 semana), com **contador de eventos descartados** e um **relatório fácil de colar**.
   **Não** ficam em modo só log (entram ativos): tirar o texto da DM do fast-path entre versões novas, com a entrega pelo Postgres Changes (que respeita RLS), e parar de publicar no canal global de presença.
3. **D1:** sem fallback silencioso para P2P. Até **3 tentativas** de conectar ao LiveKit com backoff; depois encerrar com mensagem clara e **motivo registrado**. O código P2P fica **atrás de flag desligada** (não se apaga). Registrar em ADR (`0006`).
4. **Updater do Tauri com assinatura:** aprovado. A chave privada **nunca** entra no repositório (documentar como gerar e onde guardar); endpoints em GitHub Releases. **Aviso:** a primeira versão com updater precisa de instalação manual (os apps atuais não têm o plugin ativo). É **pré-requisito do corte (A2)**.
5. **Detecção de jogo (C):** o nome do executável **sozinho não basta**. Ordem de confiança: (1) `RunningAppID` da Steam (via `winreg`); (2) caminho do exe dentro de uma pasta de instalação conhecida da biblioteca; (3) nome só como fallback de **confiança baixa**, nunca publicado como "jogando X" sem confirmação (no máximo "jogando algo"). **Denylist** de launchers, anti-cheat, crash handlers e processos de sistema. Registrar em ADR (atualizar `0003`).
6. **Higiene (fora das fatias, commits pequenos e separados):** `.env.example` (nomes derivados do código: `import.meta.env` e `std::env`, **sem ler o `.env`**), renomear `CLAUDE.MD` para `CLAUDE.md` e criar `docs/ARCHITECTURE.md`.
7. **Usuários simultâneos em 6 meses: PENDENTE.** A mensagem de aprovação trouxe o modelo não preenchido (`hoje ~X testadores; esperado ~Y`). Sem esse número, o plano usa os limites oficiais como teto (200 Free, 500 Pro) e não presume nenhum.

### 15.2. Alterações às fatias
- **A1 (substitui os itens correspondentes do §5):** o aceite (1) e (3) do §5 (descartar `call:end`/`kick`/`privacy`/`answer`/`signal` e convite de não amigo) passam a rodar em **modo "só log"** na primeira release (flag `pherielium_event_guards = "log" | "enforce" | "off"`; padrão `log`; vira `enforce` na release seguinte, no máximo ~1 semana depois).
  Entram **ativos**: (a) DM entre dois clientes v2 sem texto no broadcast: o broadcast leva só um aviso `{ id, chatId, clientId }` e a mensagem chega pelo `postgres_changes` de `chat_messages` (filtro `receiver_id=eq.{uid}`, que já existe em `chat.ts:251-268`) com RLS; para par v1 ou desconhecido continua o payload completo; (b) o cliente novo **não** faz `track`/`untrack`/broadcast no canal global `checkpoint_presence_bus`, e **continua escutando** para compatibilidade.
  **Contador e relatório:** contagem por tipo de evento e por motivo, em memória e `localStorage`; comando de console que imprime um bloco de texto para colar (sem payloads nem UIDs completos: só os 4 primeiros caracteres).
- **D1 (substitui o fim da assimetria do §5):** `connectLiveKitRoom` com **até 3 tentativas e backoff** (1 s, 2 s, 4 s) antes de desistir; se todas falharem: encerrar a chamada, avisar os dois lados com mensagem clara e **registrar o motivo** (`livekit_unavailable`, `token_unauthorized`, `token_timeout`, `network`). O ramo P2P (`createPeerConnectionForPeer`, `PeerAudioNode`) fica **atrás de `pherielium_p2p_fallback` (padrão desligada)**; só liga manualmente. ADR `0006`.
- **C (substitui a detecção por nome do §6):** ordem de confiança e denylist do item 5 acima; campo `confidence: "high" | "medium" | "low"` no evento; `low` nunca vira "jogando X".
- **Updater (novo, pré-requisito de A2):** fatia **U**: plugin do Tauri ativo, chave pública no `tauri.conf.json`, endpoints em GitHub Releases, assinatura no CI ou local, documentação de geração e guarda da chave privada. O primeiro build com updater é instalação manual. ADR `0010` (reservada; antes chamada 0007, ver `docs/decisions/README.md`). Esforço: 3 a 4 dias.

### 15.3. Corte do v1: dois cenários (ajuste a)
Efeito documentado (Supabase, [Realtime Settings](https://supabase.com/docs/guides/realtime/settings)): ao desligar **"Allow public access"**, "every join is checked against the Row Level Security policies on `realtime.messages`" e os clientes que **não** usam `config.private = true` são recusados com `PrivateOnly`; com **nenhuma policy**, os clientes conectam mas **não recebem mensagens**; e **qualquer mudança nessa tela desconecta todos os clientes conectados**. Para o app antigo isso significa: sem presença instantânea, sem fast-path de DM, sem convite nem sinalização de chamada e sem canal de sala; o que usa REST/Postgres continua funcionando.

| | **Produto público** | **Base atual de testadores (corte coordenado)** |
| --- | --- | --- |
| Critério | ≥ 95% dos ativos em v2 (heartbeat de 7 dias), ≥ 6 semanas desde a 1.2.0, aviso de ≥ 14 dias, ensaio em staging | **todos os testadores ativos em v2** (lista conferida no heartbeat), ~1 a 2 semanas depois da 1.2.0, aviso direto por mensagem, ensaio em staging |
| Como se sabe quem é v2 | `user_presence.protocol_version` | o mesmo, mais confirmação por mensagem a cada testador |
| O que muda no risco | a cauda longa de clientes antigos fica sem Realtime até atualizar | **risco menor para o produto** (pouca gente a quebrar) e a janela de exposição cai de meses para ~2 semanas; **risco operacional maior se esquecer alguém** (um testador que não atualizou fica sem chamadas e presença) |
| Rollback | religar a opção (desconecta todos uma vez) | idem |

Em ambos os cenários o corte exige o **updater assinado (U)** em campo, o ensaio em staging e horário de baixo uso.

### 15.4. Release e flags (ajuste b)
- **O 1.0.3 sai primeiro como pré-release (`1.0.3-rc.N`) para os testadores**, no GitHub Releases. Cada fatia em **commits separados** e **atrás de flag local** para reverter isoladamente. **F1 só entra depois do P-3.**
- Flags locais (localStorage, prefixo `pherielium_`): `event_guards` (A1), `presence_global_bus` (A1: padrão desligado = não publicar), `dm_ping_only` (A1), `stream_debug` (já existe), `presence_debug` (B0), `p2p_fallback` (D1), `audio_exclude_webview` (F1), `ambient_game_detection` (C).

### 15.5. B0 vem antes de tudo? (ajuste c)
**Os testes são executáveis com o build atual**, mas com pouco detalhe:
- **P-1/P-2/P-3:** dá para rodar com a consulta SQL em `profiles` a cada 30 s e o Realtime Inspector do painel. Não dá para saber **quem disparou** cada offline nem o horário real de cada heartbeat enviado e confirmado.
- **P-10 (áudio):** é um teste de escuta; roda sem instrumentação.
Por isso **B0 vem primeiro** (depois dos commits de higiene), somente leitura, atrás de `pherielium_presence_debug`: horário de cada heartbeat enviado e confirmado, `visibilityState`, origem de cada leave/offline, chave de presença por instância, payload de presença recebido. Sem mudar nenhum comportamento.

### 15.6. Esforço e menor recorte de 2 semanas (ajuste d)
- **Compromisso:** 1.0.3 = A1 + B1 + D1 + F1 ≈ **2 semanas** (A1 3 a 4 dias, B1 1 a 3, D1 3 a 4 com as 3 tentativas, F1 2 a 3 depois do P-3), mais B0 (1 a 1,5 dia) e a higiene (~0,5 dia).
- **Roadmap (±50%):** U 3 a 4 dias; C 9 a 12 dias (com a ordem de confiança e a denylist); A2, B2/B3, D2, E e o token em Edge Function conforme o §11.
- **Menor recorte que entrega valor em 2 semanas:** **B0 + A1 + D1**. B0 destrava a decisão de presença; A1 reduz o vazamento de DM e o abuso casual; D1 resolve "não ouço meu amigo" e o convite lento. B1 e F1 entram assim que os resultados de P-1 a P-3 e P-10 chegarem.

### 15.7. Auditorias de dependências (ajuste e)
Ver `docs/tech-debt/dependency-audit.md`. `npm audit` rodou; `cargo audit` não está instalado e **não foi instalado**; o `gitleaks` roda por conta do dono.

### 15.8. Pendências
1. **Item 7** (usuários simultâneos) e a **Fatia 0** (schema, repositório da API, plano do Supabase, staging).
2. Resultados de **P-1, P-2, P-3 e P-10** (liberam B1 e F1).
3. Chave privada do updater: você gera e guarda (instruções na fatia U).

## 16. Atualizações depois de D1 e F0 (2026-10-12)

### 16.1. F1 passa a ser CONDICIONAL; nova fatia F-áudio
O diagnóstico F0 (`08-f0-audio-ativacao.md`) **provou** que o áudio da tela inteira não inicia por causa do caminho antigo de captura (`win_loopback.rs`): o handler não responde a `IAgileObject` (erro `0x8000000E` na própria chamada) e, mesmo corrigido isso, `GetMixFormat` devolve `E_NOTIMPL` em process loopback. O módulo novo `audio_capture` já resolve os dois e nunca foi ligado ao front.
- **Nova fatia F-áudio (antes da F1):** ligar `audio_capture` a `desktop_audio_start`/`desktop_audio_stop`, mesmo payload do evento, mesmo modo (`ExcludeSelf`) para não regredir voz nem recorte do sistema; remover o caminho antigo. Esforço 2 a 3 dias. **Aguarda o OK do dono** (diagnóstico entregue, nada implementado).
- **F1 (excluir só a árvore do WebView2) fica condicional:** só se o P-10, **refeito com a captura funcionando**, mostrar silêncio para jogo lançado pelo hub. A hipótese R8 de `02-rust.md` nunca foi observável porque a captura não iniciava.
- No §2 e no §15.2, onde a F1 aparece como item da 1.0.3, leia: **F-áudio entra na 1.0.3 (com o OK); F1 só depois do P-10 refeito**.

### 16.2. D1 concluída (commits `a22a5ee`, `12b9b9c`)
Entregue conforme o §15.2: 3 tentativas (esperas de 1 s e 2 s entre elas, não 1/2/4), sem fallback silencioso, P2P atrás de `pherielium_p2p_fallback`, convite em paralelo com a mídia, `addTransceiver("audio")`, fallback de salas por status HTTP e ADR `0006`. Detalhes em `docs/protocol-compat.md`.

### 16.3. Achados novos (para o plano; sem correção agora)
| # | Sev. | Achado | Evidência |
| --- | --- | --- | --- |
| N1 | **Média** | **O canal global de presença pode ser criado sem os ouvintes de join/leave/sync.** `broadcastPresenceStatus` cria `checkpoint_presence_bus` quando `presenceChannel` é nulo; `subscribeToGlobalEventBus` só liga os ouvintes quando `presenceChannel` também é nulo. Se o primeiro heartbeat vier antes da assinatura, o canal fica inscrito **sem ouvintes** e o cliente não recebe presença instantânea de ninguém por esse canal | `realtimeEventBus.ts`: criação em `broadcastPresenceStatus` e guarda `if (!presenceChannel)` em `subscribeToGlobalEventBus` [VERIFICADO por leitura; o B0 registra `createdWithoutListeners`]. Mitigação parcial: o app novo já não publica no canal global (A1), o que remove a criação precoce quando a flag está desligada |
| N2 | Baixa | O nome da pasta de dados é `Phelierium` (grafia); renomear órfã os dados dos usuários | `utils/path.rs` [VERIFICADO] |

### 16.4. Pendências atualizadas
1. OK para a **F-áudio** (ligar `audio_capture`).
2. Resultados de **P-1, P-2, P-3**; o **P-10** passa a ser refeito **depois** da F-áudio.
3. **Item 7**, **Fatia 0** e chave do updater, como em §15.8.

## 17. Mudança de produto e de prioridade (decisão do dono, 2026-10-12)

**Este capítulo tem precedência sobre os §2, §5 a §7, §15 e §16 quando houver conflito.**

### 17.1. Nova ordem (somente estes problemas)

| # | Fatia | Estado |
| --- | --- | --- |
| 1 | **F-áudio**: áudio da tela inteira | **FEITA** (`03d78ee`): `audio_capture` ligado a `desktop_audio_start/stop`, caminho antigo removido. Falta o P-10 refeito com 2 contas |
| 2 | **V**: volume da transmissão | **Diagnóstico entregue** (`09-v-volume-transmissao.md`, `376ea46`); correção proposta, **aguarda OK** (0,5 a 1 dia) |
| 3 | **I**: convite como mensagem validada no servidor | **Planejada abaixo**; implementação só depois da aprovação do plano **e do schema** |
| 4 | **R**: canais de voz privados que ficam salvos | **Planejada abaixo**; idem |

**Backlog** (não descartados, fora da fila): A2 (canais Realtime privados), B1, B2/B3 (presença no servidor), C (detecção ambiente), U (updater), E (DM offline), drivers (G), F1 (excluir árvore do WebView2, condicional ao P-10 refeito), P2P/ADR-0004 (sessão de chamada no servidor; ver 17.3.6).
**A1 já feita permanece** (`pv`, DM sem texto no fast-path, canal global só escuta, filtros em modo `log`). A D1 também permanece.

### 17.2. V: resumo do diagnóstico e da correção proposta
Detalhes e provas em `09-v-volume-transmissao.md`. A causa é o `<video>` do palco (feed remoto, `muted={feed.isLocal}`) tocando a **mesma** trilha que o `<audio>` controlado pelo slider. A correção é silenciar o `<video>` de feeds remotos quando a mídia é LiveKit (`shouldMuteFeedVideo`), com teste em tabela e conferência pelo inventário (`window.pherieliumAudioInventory()`). O mesmo ajuste corrige a voz tocando em dobro quando o outro liga a câmera.

### 17.3. I: fluxo de convite como mensagem

#### 17.3.1. O que existe hoje [VERIFICADO]
- **Dois mecanismos paralelos** de convite: (a) o aviso `call:invite` por broadcast (canais `user_calls_{uid}` e `user_inbox_{uid}`), que abre o modal de "atender" (`VoiceCallContext.tsx:278`, `useVoiceCall.ts` `onInvite`/`ringing-in`) e também aparece no notch (`DesktopNotch.tsx:938`); e (b) uma **mensagem de chat** com JSON `{"__type":"call_invite",...}` renderizada como card (`CallInviteCard.tsx`), criada em `ChannelInviteModal.tsx:74-84` junto com o broadcast (`:62-69`).
- O card é um **retrato** do momento do envio: `isPrivate: Boolean(session.isPrivate)`, `roomName`, `category`, `createdAt` ficam no texto da mensagem (`ChannelInviteModal.tsx:74-82`, `CallInviteCard.tsx:20-37`). Não há validade, não há estado e não há checagem de quem pode entrar além do `join_voice_room`.
- A senha é pedida no card (`CallInviteCard.tsx`, modal de senha) e verificada no RPC `join_voice_room` (bcrypt via `crypt`, `20261009100200_voice_room_hardening.sql:55-61`). **Não há limite de tentativas**, e uma sala privada **sem senha** só deixa o dono entrar (`elsif v_room.is_private and v_room.host_uid <> v_uid`).

#### 17.3.2. O print: dois cards de "The NERDS" (um "Privada", outro não)
**Não recebi o print nesta mensagem**, então a causa **não está provada**. O código permite duas explicações; a segunda é a mais provável:
1. **Duplicação do mesmo convite** (broadcast + Postgres Changes): o par `fast_` + INSERT é reunido pela chave `[senderId, chatId, attachmentPath, text.trim()].join("\0")` (`chat.ts:~640`). Com o texto idêntico o par se junta; só duplicaria se o INSERT falhasse e a mensagem otimista fosse devolvida (`chat.ts:400-418`) e o INSERT chegasse depois. Os **dois cards teriam o mesmo `createdAt` e o mesmo selo**.
2. **Dois convites diferentes** (mais provável): como o selo é o retrato de `session.isPrivate` no momento do envio, um convite enviado com o canal aberto e outro depois de torná-lo privado (ou com `session.isPrivate` ainda indefinido) mostram selos diferentes para o **mesmo** canal. O **`createdAt` seria diferente**.
**Como provar (1 minuto):** no SQL Editor: `select id, created_at, text from chat_messages where text like '%call_invite%' and text like '%The NERDS%' order by created_at desc limit 5;`. Dois `id` com `created_at` diferentes e `isPrivate` diferentes dentro do JSON = dois convites (hipótese 2). Um `id` só na tabela e dois cards na tela = duplicação no cliente (hipótese 1). Se o dono me passar o resultado, fecho com `[VERIFICADO]`.
Em qualquer caso o desenho novo elimina as duas: o card passa a **consultar o estado no servidor** (não é retrato) e o convite tem `id` único gerado no cliente.

#### 17.3.3. Especificação aprovada (resumo)
- **Convidar = gravar uma mensagem de convite no chat.** `id` gerado no cliente (idempotência), `expires_at` definido **pelo servidor** (padrão 15 min). **Sem modal de atender.** O destinatário recebe uma notificação de mensagem: "[nome] está te convidando para uma call". Offline: o convite fica no histórico.
- **Entrar = RPC no servidor** que valida: o convite é do usuário, está no prazo e, se privado, a senha. Estados: `pendente`, `aceito`, `expirado`, `cancelado`. Expirado: "convite inválido ou expirado". A contagem regressiva do card é **só visual**; o servidor decide.
- **Compatibilidade:** o app novo trata o aviso antigo de "tocar" (broadcast do 1.0.2) como **notificação comum, nunca modal**.

#### 17.3.4. Desenho
- **Uma RPC atômica cria convite e mensagem** (`voice_invite_create`): grava o convite e a linha de `chat_messages` na mesma transação, com o texto montado **no servidor**. Assim o convite e a mensagem nunca divergem e o `p_invite_id` do cliente serve de `client_id` da mensagem (idempotente: reenviar não duplica).
- **Formato da mensagem** (compatível com o app antigo): o JSON continua começando por `{"__type":"call_invite"` com `chatId` (= id do canal), `roomName`, `category`, `callerName`, `callerAvatar`, `isPrivate`, `createdAt`, **mais** `inviteId` e `v: 2`. O app antigo renderiza o card e entra pelo RPC antigo; o app novo ignora o retrato e consulta `voice_invite_get(inviteId)`.
- **O card não é retrato**: o estado, o nome, o selo "Privada" e `expires_at` vêm de `voice_invite_get`, que devolve também `server_now`. O cliente calcula a contagem regressiva com `expires_at − server_now` (ajuste de relógio: `offset = server_now − Date.now()` no momento da consulta), então um relógio errado não muda o desfecho.
- **Notificação:** a mensagem nova chega pelo caminho de mensagens (Postgres Changes, já existente); o texto da notificação vem do tipo `call_invite`. Nenhum modal. Offline: fica no histórico, e ao abrir o chat o card consulta o estado (`pendente`, `expirado`...).
- **Estados**: `pendente` (`status='pending'` e `now() < expires_at`), `aceito`, `cancelado`, e `expirado` **derivado** (`status='pending'` e `now() >= expires_at`). Sem cron obrigatório; uma limpeza periódica opcional marca `expired` por higiene.

```mermaid
stateDiagram-v2
    [*] --> pendente: voice_invite_create (dono; amigo)
    pendente --> aceito: voice_channel_join valido (convite do usuario, no prazo, senha ok)
    pendente --> cancelado: voice_invite_cancel (quem convidou)
    pendente --> expirado: now() >= expires_at (derivado, o servidor decide)
    expirado --> [*]: "convite invalido ou expirado"
    aceito --> [*]: (entrar de novo usa a associacao salva, nao o convite)
    cancelado --> [*]
```

#### 17.3.5. Mapa do ciclo antigo: o que fica sem uso (remoção em fatia posterior, ADR `0009`)
Com I no ar e o app antigo em desuso, os caminhos abaixo deixam de ser chamados **para convites de canal e para chamadas iniciadas pelo app novo**. Hoje continuam vivos para o par v1:

| Caminho | Onde | Fica sem uso quando |
| --- | --- | --- |
| Estado `ringing-in`, `incomingInvite`, modal de atender | `useVoiceCall.ts` (`onInvite` ~`:2990`), `VoiceCallContext.tsx:237-278`, `DesktopNotch.tsx:938` | convite vira mensagem (I) |
| Toque do destino e o timer de 35 s ("perdida") | `useVoiceCall.ts:~3012` (`incomingTimeoutTimerRef`) | idem |
| `answerCall`, `rejectCall` e `call:answer` | `useVoiceCall.ts:~3269`, `:3895`, `inviteTransport.ts:93-122` | "Entrar" passa a ser `voice_channel_join` |
| `onAnswer` esperando `mediaPendingRef` | `useVoiceCall.ts` (`onAnswer`, D1) | não há mais "atender" |
| `ringing-out`, `ringoutTimerRef` ("não atendeu") e `call:end` com `timeout/busy/rejected` | `useVoiceCall.ts:~3219-3236` | quem convida entra no canal e espera; não há toque |
| `sendCallInvite` nos dois canais (`user_calls_`, `user_inbox_`), `subscribeToUserIncomingCalls`, dedupe `lastProcessedInviteKeyRef` | `inviteTransport.ts`, `useVoiceCall.ts` | broadcast antigo só para par v1 |
| `isLocalTestCall` (simulação/eco) | `useVoiceCall.ts` | depende de testes locais; manter até decidir |
| Filtros A1 de `call:invite`/`call:answer`/`call:end` | `eventGuards.ts` | junto com os eventos |
**Regra de convivência:** enquanto houver amigos em 1.0.2, o app novo **ainda envia** o aviso antigo para pares v1 (`peerProtocol` = 1 ou desconhecido) e **só mostra notificação comum** para o aviso recebido. A remoção é uma fatia própria depois do corte do v1, com ADR `0009` (proposto abaixo).

#### 17.3.6. Pergunta de produto que muda o escopo (decisão sua)
O **"ligar para um amigo" 1:1** também vira convite? Recomendo: **sim**, como um **canal efêmero privado de 2 pessoas** (criado ao convidar, expira sozinho), reaproveitando o mesmo fluxo e eliminando o ciclo "tocar/atender/perdida/ocupado". **Isso substitui a ADR-0004** (sessão autoritativa de chamada), que fica no backlog. Alternativa: I só para canais, e o 1:1 continua com o ciclo antigo (mantém todos os caminhos da tabela acima). **O esboço abaixo assume I para canais e deixa o 1:1 como decisão pendente.**

### 17.4. R: canais de voz privados que ficam salvos

#### 17.4.1. Especificação aprovada (resumo) e padrões
- Canal privado: só entra com **convite** e pede **senha**. Na **primeira entrada válida** o canal é **salvo** para o usuário e aparece numa lista parecida com servidores do Discord. Modelo enxuto: **dono e membros, sem cargos**.
- Padrões (você mandou sinalizar discordância): **senha só na primeira entrada**; **só o dono convida**; o dono **troca a senha, expulsa membro e apaga o canal**; **convite vale 15 min**.
- A senha é verificada **somente no servidor** (hash adequado, limite de tentativas); o **hash nunca vai ao cliente**. Isso fecha o achado `password_hash` via Realtime (`07`, #4).
- **Não assinar presença de todos os canais salvos**; contagem de online com custo baixo.

#### 17.4.2. Onde concordo e onde discordo dos padrões
| Padrão | Posição |
| --- | --- |
| Senha só na primeira entrada | **Concordo.** Efeito: quem já é membro **não** precisa da senha nova se o dono a trocar. Registrar: trocar a senha **não expulsa** ninguém; para tirar alguém, expulsar. |
| Só o dono convida | **Concordo como padrão**, mas **sugiro** deixar a regra numa coluna (`invite_policy = 'owner'`) para permitir "membros convidam" depois sem migração. |
| Convite 15 min | **Concordo.** Valor num parâmetro do servidor. |
| (Acréscimo meu) o convidado precisa ser **amigo** de quem convida | **Proponho**, para evitar spam de convite a desconhecidos (hoje o `join_voice_room` aceita qualquer UID que saiba o id do canal). |
| (Acréscimo meu) limite de convites pendentes e de tentativas de senha | **Proponho**: máximo de 20 convites criados por hora por dono; senha: 5 falhas por usuário e canal em 15 min trava por 15 min. |
| Hash da senha | **bcrypt via `pgcrypto`** (o app já usa, mas com `gen_salt('bf')` no custo padrão **6**, fraco). **Proponho custo 10** e **rehash** no primeiro acerto de um hash antigo. |

#### 17.4.3. Modelo de dados proposto (expand/contract; [INFERIDO] até chegar o schema)
Base verificada nas migrations: `voice_rooms` (`host_uid`, `room_name`, `category`, `is_private`, `password_hash`, `has_password` gerada, `icon`, `avatar_url`, `theme_color`, `max_participants`, `status` `active|ended`, `description`, `banner_url`), `voice_room_members` (`room_id`, `user_id`, `display_name`, `avatar_url`, `joined_at`, `removed_at`, PK `(room_id, user_id)`), RPCs `create_voice_room`, `join_voice_room`, `update_voice_room`, funções `can_view_voice_room`, `is_voice_room_member`.

```mermaid
erDiagram
    voice_rooms ||--o{ voice_channel_members : "salvo por"
    voice_rooms ||--o{ voice_invites : "convida para"
    voice_rooms ||--o| voice_room_secrets : "senha (hash)"
    voice_rooms ||--o{ voice_room_members : "em chamada agora"
    voice_rooms ||--o{ voice_join_attempts : "tentativas de senha"
    voice_invites }o--|| chat_messages : "mensagem do convite"
    voice_rooms { uuid id PK
      uuid host_uid
      text room_name
      bool is_private
      bool has_password
      bool invite_only
      text invite_policy
      text status }
    voice_room_secrets { uuid room_id PK
      text password_hash
      int hash_cost
      timestamptz changed_at }
    voice_channel_members { uuid room_id PK
      uuid user_id PK
      timestamptz first_joined_at
      timestamptz last_joined_at
      timestamptz kicked_at
      uuid kicked_by }
    voice_invites { uuid id PK
      uuid room_id
      uuid inviter_id
      uuid invitee_id
      text status
      timestamptz created_at
      timestamptz expires_at
      timestamptz accepted_at
      uuid message_id }
    voice_join_attempts { uuid room_id PK
      uuid user_id PK
      int failed_count
      timestamptz window_started_at
      timestamptz locked_until }
```

| Tabela / mudança | Detalhes |
| --- | --- |
| `voice_room_secrets(room_id pk fk, password_hash, hash_cost, changed_at)` | **fora da publicação Realtime** e sem nenhuma policy para `anon`/`authenticated` (só funções `SECURITY DEFINER` leem). Fecha o `password_hash` via Realtime. |
| `voice_rooms` (expand) | `has_password` deixa de ser coluna gerada de `password_hash` e vira `boolean not null default false` mantida pelas RPCs (mesmo nome e tipo: os clientes que a leem não notam); `invite_only boolean not null default false`; `invite_policy text not null default 'owner'`. **Contract** (release seguinte): `drop column password_hash`. |
| `voice_channel_members(room_id, user_id, first_joined_at, last_joined_at, kicked_at, kicked_by)` | PK `(room_id, user_id)`. É o "canal salvo". **Separada** de `voice_room_members`, que continua a ser "quem está na chamada agora". Índice `(user_id)` para a lista. Dono = `voice_rooms.host_uid` (sem cargos). |
| `voice_invites(id uuid pk, room_id, inviter_id, invitee_id, status, created_at, expires_at, accepted_at, message_id)` | `id` **gerado no cliente**; `expires_at` **definido pelo servidor** (`now() + interval '15 minutes'`, parametrizável); `status` em `pending|accepted|canceled` (`expired` é derivado). Índices: `(invitee_id, status, expires_at)`, `(room_id)`, único parcial `(room_id, invitee_id) where status='pending'`. |
| `voice_join_attempts(room_id, user_id, failed_count, window_started_at, locked_until)` | Limite de tentativas de senha. Só as RPCs escrevem. |
| `voice_room_members` (expand) | `last_seen_at timestamptz` para a contagem de online sem fantasmas (ver 17.4.5). |
**RLS:** `voice_invites` e `voice_channel_members` com `SELECT` só para as partes (convidante e convidado; membro do próprio canal) e **nenhum** `INSERT/UPDATE/DELETE` direto; `voice_room_secrets` e `voice_join_attempts` sem policy; tudo muda por RPC `SECURITY DEFINER` com `auth.uid()` e `set search_path`. Todas as tabelas novas **fora** de `supabase_realtime` (exceto o que o dono decidir mostrar em tempo real).

#### 17.4.4. RPCs
| RPC | Regras |
| --- | --- |
| `voice_invite_create(p_invite_id, p_room_id, p_invitee)` | Chamador = dono (`invite_policy`); convidado é **amigo aceito**; limite de convites; trava a sala; **substitui** um convite pendente igual (cancela o anterior); cria o convite e a mensagem de chat na mesma transação (texto montado no servidor); idempotente por `p_invite_id`. Devolve `{invite, message_id, server_now}`. |
| `voice_invite_get(p_invite_id)` | Só convidante ou convidado. Devolve `{state, roomName, category, isPrivate, hasPassword, expiresAt, inviter, server_now}`. |
| `voice_invite_cancel(p_invite_id)` | Só quem convidou ou o dono. |
| `voice_channel_join(p_room_id, p_invite_id default null, p_password default null, p_display_name, p_avatar_url)` | Trava a sala (`for update`). **Membro salvo e não expulso**: entra sem convite nem senha. **Senão, se o canal é privado/`invite_only`**: exige convite `pending`, do próprio usuário e `now() < expires_at`; depois, se tem senha: confere o hash com limite de tentativas; **só então** cria a associação salva, marca o convite `accepted` e registra a presença (como o `join_voice_room` de hoje, incluindo a checagem de capacidade). Segunda chamada com o convite já aceito: **idempotente** (já é membro, devolve o canal). Canal público sem senha: entra e **salva**. |
| `voice_channel_leave(p_room_id)` | Marca a presença como saída; **não** apaga a associação salva. |
| `voice_channel_set_password(p_room_id, p_password)` (dono) | Grava o hash (custo 10) em `voice_room_secrets` e atualiza `has_password`; **não expulsa** membros. |
| `voice_channel_kick(p_room_id, p_user_id)` (dono) | `kicked_at`; encerra a presença; invalida convites pendentes dele; ele não volta sem novo convite do dono. |
| `voice_channel_delete(p_room_id)` (dono) | `status='ended'` e apaga associações e convites (cascade); expulsa quem está na chamada. |
| `voice_channels_list()` | Canais salvos do usuário + `online_count` + `max_participants` (ver 17.4.5). |
| RPCs antigas (`join_voice_room`, `create_voice_room`, `update_voice_room`) | **Mantêm assinatura e comportamento para o app 1.0.2**; por baixo passam a usar `voice_room_secrets` e a manter `has_password`. |

#### 17.4.5. Contagem de online com custo baixo (sem assinar todos os canais)
- **Sem Realtime por canal salvo.** A lista chama `voice_channels_list()` **ao abrir o painel e a cada 30 a 60 s enquanto ele estiver visível**; devolve a contagem calculada de `voice_room_members` (`removed_at is null` **e** `last_seen_at > now() - interval '90 seconds'`). Custo: 1 consulta por painel aberto, com índice parcial em `(room_id) where removed_at is null`.
- **Fantasmas** (crash sem sair): quem está em chamada atualiza `last_seen_at` com um RPC leve a cada 30 s **só enquanto está na chamada**; a contagem ignora linhas velhas, sem cron.
- **Tempo real só do canal aberto:** o cliente assina um único tópico (`v2:room:{id}`, privado, quando existir) **apenas do canal que está na tela**.
- Estimativa: 100 usuários com o painel aberto e 1 consulta a cada 45 s ≈ 2 consultas/s, trivial para o Postgres; zero mensagens Realtime extras.

#### 17.4.6. Primeira entrada válida (diagrama)
```mermaid
sequenceDiagram
    participant D as Dono
    participant S as Supabase (RPC)
    participant M as Membro novo
    D->>S: voice_invite_create(inviteId, sala, M)
    S-->>D: convite + mensagem (expires_at = now()+15 min)
    S-->>M: mensagem no chat (notificacao, sem modal)
    M->>S: voice_invite_get(inviteId)
    S-->>M: pendente, privada, tem senha, expires_at, server_now
    M->>S: voice_channel_join(sala, inviteId, senha)
    alt convite ok e senha ok
        S->>S: salva em voice_channel_members; convite = aceito
        S-->>M: sala + participantes (sem hash)
        M->>M: lista "Meus canais" ganha o canal
    else senha errada
        S->>S: failed_count++ (trava apos 5 em 15 min)
        S-->>M: senha incorreta
    else expirado, cancelado ou de outro usuario
        S-->>M: convite invalido ou expirado
    end
    Note over M,S: proximas entradas: voice_channel_join(sala) sem convite nem senha
```

### 17.5. Migração dos canais e senhas atuais sem perder dados [INFERIDO até o schema]
1. **Expand (aditivo, idempotente, uma migration por passo):** criar `voice_room_secrets`, `voice_channel_members`, `voice_invites`, `voice_join_attempts`; `voice_rooms.invite_only/invite_policy`; `voice_room_members.last_seen_at`; funções novas.
2. **Backfill de senhas:** `insert into voice_room_secrets select id, password_hash, 6, now() from voice_rooms where password_hash is not null on conflict do nothing`. Hash com custo 6 continua válido; é regravado com custo 10 no primeiro acerto. **Contagem antes e depois deve bater** (teste).
3. **Backfill de associações salvas:** para cada sala **ativa**, o **dono** e os membros com `removed_at is null` viram `voice_channel_members`. Quem já saiu **não** é salvo em retrospecto (evita encher a lista de pessoas com salas públicas antigas); entram de novo e salvam.
4. **Converter `has_password`:** em uma transação, `drop column has_password` (gerada) e `add column has_password boolean not null default false`, preenchida de `voice_room_secrets`; as RPCs passam a mantê-la. O nome e o tipo ficam iguais para o app antigo.
5. **Trocar os corpos dos RPCs antigos** para ler/gravar em `voice_room_secrets` e manter `password_hash` **nulo** em salas novas; salas antigas ficam com o valor até o contract.
6. **Contract (release seguinte, depois de confirmar 1.0.2 sem leitura):** `drop column password_hash` em `voice_rooms` (a tabela continua publicada; sem a coluna não há o que vazar). Isso encerra de vez o risco no Realtime. Antes: conferir funções, policies e views que citam `password_hash` (consulta 03).
7. **Convites antigos:** os cards `call_invite` já gravados continuam como **convite legado** (sem `inviteId`): o app novo os mostra com "convite antigo" e entra pelo RPC antigo (regras antigas). Nada é apagado.
8. **Rollback:** as migrations são aditivas; reverter é desligar a flag do cliente novo (`pherielium_voice_invites_v2=0`) e deixar as tabelas. O único passo não trivial de reverter é o 4 (a recriação de `has_password`); por isso ele tem um script de volta documentado.

### 17.6. Compatibilidade com o 1.0.2
| Cenário | Comportamento |
| --- | --- |
| Novo convida novo | Fluxo completo (convite no servidor, card consultando estado, sem modal). |
| Novo convida velho | Grava a mensagem (formato antigo + `inviteId`) **e** envia o aviso antigo (`call:invite`) para o par v1; o velho vê o modal/card antigos e entra pelo RPC antigo (regras antigas: senha para sala com senha). Para canais criados pelo app novo com `invite_only=true`, o RPC **antigo** recusa a entrada ("sala privada"): é a limitação aceita da convivência (documentar no aviso de versão). |
| Velho convida novo | O app novo recebe o broadcast antigo como **notificação comum** (nunca modal) e o card `call_invite` do chat como **convite legado**; a entrada usa o RPC antigo. |
| Chamada 1:1 velho↔novo | Depende da decisão 17.3.6. Padrão conservador: o novo continua respondendo ao 1:1 antigo **só como notificação** com ação "ligar de volta"; ligar para velho usa o ciclo antigo. |
| Corte do v1 | Só então `invite_only` pode ser imposto a todos e o ciclo antigo removido (ADR `0009`). |

### 17.7. Testes (todos novos; pgTAP no projeto de staging, Docker não está instalado)
| Caso | Esperado |
| --- | --- |
| **Expirar no limite** | em `now() = expires_at − 1 ms` entra; em `now() = expires_at` já é "convite inválido ou expirado" (o servidor decide; comparação `now() < expires_at`) |
| **Aceitar duas vezes** | 1ª cria a associação e marca `accepted`; 2ª é idempotente (já é membro) e **não** duplica linha nem presença |
| **Convite de outro usuário** | `voice_channel_join` com `invite.invitee_id <> auth.uid()` → "convite inválido ou expirado"; `voice_invite_get` de terceiros → vazio/negado |
| **Senha errada repetida** | 5 falhas em 15 min travam por 15 min; a 6ª nem confere o hash; acerto zera o contador; trava por usuário e canal |
| **Relógio desajustado** | cliente com relógio ±10 min: o desfecho (aceito/expirado) não muda; a contagem regressiva usa `server_now`; teste de unidade da função `remainingMs(expiresAt, serverNow, localNowAtFetch)` |
| Só o dono convida | membro comum: erro; dono: ok |
| Convidado precisa ser amigo | convite a não amigo é recusado |
| Expulsão | expulso não volta sem novo convite; convites pendentes dele ficam inválidos |
| Trocar a senha | membros salvos continuam entrando; novos usam a senha nova |
| Apagar o canal | convites e associações somem; quem está na chamada é expulso |
| Capacidade | duas entradas disputando a última vaga: só uma passa (lock `for update`) |
| Compatibilidade | RPC antigo `join_voice_room` continua funcionando para sala pública e com senha |
| Migração | contagem de salas, senhas e donos igual antes e depois; reexecutar a migration não duplica nada |
| RLS e vazamento | o hash nunca aparece em `select`, em `postgres_changes` nem no payload de nenhuma RPC; `voice_room_secrets` não está na publicação |
Mais: testes unitários dos reducers do card (estados e contagem), do formatador de mensagem de convite e dos erros tipados do cliente.

### 17.8. Insumos indispensáveis (as 8 consultas de `00-fontes.md` §3 e a API)
| Consulta | Para I e R? | Por quê |
| --- | --- | --- |
| **01** colunas das tabelas | **Indispensável** | confirmar colunas e tipos reais de `voice_rooms`, `voice_room_members`, `chat_messages` (inclui `client_id`, `sequence_id`), `friendships`, `profiles` |
| **02** policies | **Indispensável** | desenhar RLS das tabelas novas sem abrir buraco e ver o que as policies atuais já permitem em `voice_*` e `chat_messages` |
| **03** funções | **Indispensável** | os corpos **reais** de `create/join/update_voice_room`, `can_view_voice_room`, `is_voice_room_member` e triggers de chat; é o que vou reescrever sem quebrar o app antigo |
| **04** índices | Desejável | dá para criar com `if not exists`; serve para evitar duplicar |
| **05** triggers | **Indispensável** | triggers de `chat_messages` (guarda, `sequence_id`) afetam a inserção da mensagem de convite pela RPC |
| **06** publicações | **Indispensável** | confirmar o que está em `supabase_realtime` (`voice_rooms`, `chat_messages`...) e fechar o vazamento do hash |
| **07** grants | **Indispensável** | verificar que `password_hash` não é legível por `anon`/`authenticated` e o que as tabelas novas herdarão |
| **08** migrations aplicadas | **Indispensável** | saber se `20261009120000`, `...140000`, `...150000` e `20261010120000` rodaram em produção |
**Também indispensável: o código da API do Render.** `/api/voice/rooms*` (create/join/leave/delete) **pode escrever no banco com `service_role` e contornar** os RPCs (limite de tentativas, convite, associação salva). Preciso ver se a API reimplementa a senha ou só chama os RPCs; se reimplementa, as regras novas precisam valer nela ou ela precisa passar a chamar os RPCs.
Fatia 0 também continua pedindo o plano do Supabase e o projeto de staging.

### 17.9. Fatias, esforço e dependências
| Fatia | O que entrega | Esforço | Depende de |
| --- | --- | --- | --- |
| **V-fix** | `shouldMuteFeedVideo` e props `muted` | 0,5 a 1 dia | OK do dono |
| **I-1** | RPCs `voice_invite_*` + mensagem atômica + card que consulta estado + notificação sem modal; aviso antigo vira notificação | 7 a 10 dias | **schema**, API |
| **I-2** | Remoção do ciclo antigo (ADR `0009`) | 4 a 6 dias | I-1 estável + corte do v1 |
| **R-1** | Tabelas novas, backfill, `voice_channel_join/leave`, lista "Meus canais" (UI), contagem por polling | 9 a 12 dias | schema, API, I-1 |
| **R-2** | Gestão do dono: trocar senha, expulsar, apagar; limite de tentativas; rehash | 4 a 5 dias | R-1 |
| **R-3** | Contract do `password_hash` | 1 a 2 dias | R-1 em produção e 1.0.2 sem leitura |
Total aproximado de I+R: **25 a 35 dias** de um desenvolvedor, **±50%** até o schema e a API chegarem. Menor recorte útil: **V-fix + I-1 (sem remover nada)**.

### 17.10. ADRs novas (propostas)
`0007-convite-como-mensagem-validado-no-servidor.md`, `0008-canais-de-voz-privados-salvos.md`, `0009-remocao-do-ciclo-de-chamada-antigo.md`. O updater (U) deixa de ocupar o número 0007; reservar `0010`.

### 17.11. Decisões que preciso de você
1. **Escopo do I:** só canais, ou também o "ligar" 1:1 como canal efêmero (17.3.6)? Recomendo incluir o 1:1.
2. Confirmar os padrões e os **dois acréscimos meus**: convidado precisa ser **amigo**; limites (20 convites/hora, 5 senhas erradas em 15 min).
3. Aceitar a limitação de convivência: canais criados pelo app novo com `invite_only` **não** abrem pelo app 1.0.2.
4. O resultado da consulta do print (17.3.2) e o **print**, se quiser que eu feche a causa dos dois cards como `[VERIFICADO]`.
5. **Schema** (as 7 consultas indispensáveis), **repositório da API**, plano do Supabase e **staging**.
6. OK para a **V-fix**.

## 18. Aprovações e acréscimos (2026-10-12, segunda rodada)

**Este capítulo complementa o §17.** I e R continuam **BLOQUEADOS** até o schema e o código da API.

### 18.1. Estado das fatias
| Fatia | Estado |
| --- | --- |
| F-áudio | aceita; falta o **P-10** (depois da V-fix). Constraints do `getDisplayMedia` reportadas em `08-f0-audio-ativacao.md` (seção final); correção **proposta, não aplicada** |
| **V-fix** | **FEITA** (esta rodada): invariante "`<video>` de mídia LiveKit sempre mutado", câmera/voz em dobro, `setSinkId`, testes |
| **I0** | **escopo mínimo e riscos propostos em 18.4**; implementação só depois do seu OK |
| I (canais), depois I para o 1:1 | planejadas (§17); o 1:1 como canal efêmero de 2 pessoas entra **depois** dos canais e **substitui a ADR-0004** |
| R | planejada (§17); bloqueada |
| Backlog | A2, B1, B2/B3, C, U, E, drivers |

### 18.2. Requisitos de segurança acrescentados (valem para I e R e para o código da API)
1. **O token do LiveKit só pode ser emitido a quem passou na RPC de entrada** (ou o endpoint chama uma RPC de autorização). Hoje o `livekit-token` recebe `roomName` e `identity` do cliente (`livekitVoice.ts:50-67`); se o servidor só validar o formato, **basta saber o nome da sala para entrar na mídia sem senha**. Requisito para o código da API: (a) a identidade vem do JWT, nunca do corpo; (b) o token só sai se `voice_channel_authorize_media(room_id)` (RPC `SECURITY DEFINER`, usa `auth.uid()`) confirmar presença ativa e não expulso, e capacidade; (c) TTL curto; (d) a sala 1:1 exige amizade. A ADR-0005 (token em Edge Function) fica no backlog e reforça isto. **Marcado `[INFERIDO]` até eu ler a API.**
2. **A mensagem de convite NUNCA contém senha nem hash**, nem de forma indireta (o texto só leva `inviteId`, nome, categoria e `createdAt`; o selo "Privada" é só informativo).
3. **RPCs `SECURITY DEFINER` com `set search_path` fixo** (`public, pg_temp`, nomes qualificados) e **`auth.uid()` como única identidade**: nenhum parâmetro de usuário (`p_user_id`) é confiado, exceto como alvo validado (convidado, expulso). `revoke all ... from public, anon` e `grant execute ... to authenticated` em cada função.
4. **Limite de tentativas de senha por usuário E por canal**, com tamanho mínimo da senha (≥ 8 caracteres) e validação **no servidor** (comprimento, caracteres, tamanho máximo para o bcrypt: 72 bytes). Duas contagens: (usuário, canal) e (canal, todos os usuários) para barrar ataque distribuído por contas; ambas travam temporariamente e registram o evento.
5. **Migração do `has_password`** em expand/contract com **backup** (`pg_dump` das tabelas afetadas antes), **ensaio no staging** (se o plano do Supabase permitir um segundo projeto; senão, ensaio em cópia restaurada do backup) e **script de volta testado** (recria a coluna gerada a partir de `password_hash`). Só então o contract (`drop column password_hash`).
6. **O card consulta o estado no servidor** (`voice_invite_get`) com o **`server_now` da RPC**; o cliente nunca decide validade.
7. O resultado da consulta do print continua pendente (você roda). **O selo diferente não decide entre duplicação e dois convites**: o mesmo convite chegando por dois caminhos (fast-path e Postgres Changes) pode ter payloads diferentes (o `fast_` otimista é montado no cliente; o INSERT vem do banco). A prova correta é comparar **ids e `created_at`** das linhas em `chat_messages`, não o selo.

### 18.3. Semântica da senha: pendente
O modelo da mensagem trouxe `<<A: só na primeira entrada / B: em toda entrada>>` **sem escolha**. Padrão do plano (A, o que você aprovou antes): senha **só na primeira entrada válida**. Se for **B**, mudam: (i) `voice_channel_join` confere a senha em **toda** entrada de canal com senha, inclusive de membro salvo; (ii) o canal salvo guarda a associação mas **não** dispensa a senha; (iii) o limite de tentativas pesa mais (todo reingresso é uma tentativa); (iv) "trocar a senha" passa a bloquear quem não a souber, sem precisar expulsar. **Preciso da escolha antes de implementar R.**

### 18.4. I0: escopo mínimo e riscos (proposta; nada implementado)
**Objetivo:** o aviso de convite (o broadcast do 1.0.2 e os novos) deixa de abrir o modal de atender e vira **notificação** "[nome] está te convidando para uma call" **mais o card no chat**, **atrás de flag** (`pherielium_invite_notifications`, padrão desligada na primeira release). A expiração é provisória: `created_at + 15 min` no cliente, **não autoritativa**; clicar vencido mostra "convite inválido ou expirado".
**Escopo mínimo (front-only):**
1. Em `useVoiceCall` o `onInvite` (e o do inbox) com a flag ligada **não** faz `setCallState("ringing-in")`, nem toca o toque, nem arma o timer de 35 s: grava o convite numa lista local de convites pendentes (id = `chatId:callerId:timestamp`, dedupe por esse id) e dispara a notificação (`notify` + central de notificações, som de mensagem, **não** o toque).
2. `answerCall` passa a aceitar o convite por parâmetro (`answerCall(invite)`), em vez de ler só `incomingInvite`; o "Entrar" do card e da notificação chama isso. O resto do `answerCall` (D1) não muda.
3. O card (`CallInviteCard`) ganha o estado derivado `pendente/expirado/cancelado` calculado do `createdAt` do convite: `expirado` quando `now >= createdAt + 15 min`; o clique em vencido não entra e mostra "convite inválido ou expirado". Para o aviso 1:1 do app antigo (que **não** grava mensagem), o app novo **injeta um card local** (sem persistir) na conversa daquele amigo.
4. `call:end` do mesmo `chatId` vindo do convidante marca o convite como `cancelado` (não autoritativo).
5. Função pura `inviteState({ createdAtMs, nowMs, ttlMs, cancelled })` e um reducer puro da lista de convites, ambos com testes (limite exato, relógio adiantado/atrasado, dedupe, cancelamento).
**Fora do escopo do I0:** validação no servidor, RPCs, expiração autoritativa, remoção do ciclo antigo (ADR-0009), o 1:1 como canal efêmero, o notch.
**Riscos e como mitigar:**
| Risco | Mitigação |
| --- | --- |
| **Chamadas perdidas**: sem modal nem toque, o 1:1 de um amigo no 1.0.2 pode passar despercebido (ele espera 35 s) | notificação persistente com som de mensagem e botão "Entrar"; o card fica na conversa; opcional: manter o toque só para 1:1 de par v1 (decisão sua) |
| **O notch deixa de mostrar o convite** (`DesktopNotch.tsx:938` depende de `ringing-in`) | efeito colateral real; você pediu para não mexer no notch; documentar. Se incomodar, o notch pode escutar a lista de convites pendentes numa fatia sua |
| **`answerCall` é o código mais sensível** (D1: mídia em paralelo, P2P por flag) | só trocar a origem do convite (parâmetro); testes de caracterização do fluxo antes |
| **"Ocupado"**: hoje quem está em outra chamada responde `busy` sozinho (`useVoiceCall.ts:~3022`); sem modal, o chamador espera os 35 s e vê "não atendeu" | manter a resposta automática `busy` (sem abrir nada) quando já está em chamada |
| **Duas notificações** (a mensagem nova do card e o aviso) para o mesmo convite | dedupe por `chatId` + janela de 10 s; uma só notificação com o texto do convite |
| **Forja**: o aviso continua vindo de canal público | o filtro A1 de convite (só de amigo) segue valendo; a validação real vem com I |
| **Card local some ao recarregar** (aviso 1:1 legado) | aceitável no provisório; o convite de canal tem a mensagem persistida |
| **Expiração pelo relógio do cliente** | provisória e documentada; a decisão autoritativa vem com I (`server_now`) |
**Esforço:** 2 a 3 dias. **Reverter:** desligar a flag restaura o modal atual (o código antigo não é apagado).

### 18.5. Boost acima de 100% (fora da V-fix)
Issue registrado em `docs/tech-debt/issue-drafts.md` (item 4): boost real no LiveKit com `RemoteAudioTrack.setVolume` + Web Audio ou um `GainNode` próprio **com limitador** (como o `PeerAudioNode`). **Nota:** o slider de **voz** promete 200% e, no LiveKit, nada muda além de 100% (`el.volume` é limitado a 1,0); a transmissão já está limitada a 100% no slider.

### 18.6. Insumos e dependências
As 7 consultas indispensáveis (01, 02, 03, 05, 06, 07, 08), o código da API (agora também para o requisito do token), o plano do Supabase, o staging (e, se possível, um segundo projeto para ensaiar a migração do `has_password`).


### 18.x. Decisões confirmadas em 2026-10-12 (respostas do dono)
- **Semântica da senha: opção A.** A senha só é pedida na **primeira entrada**; depois a pessoa é membro salvo. O dono controla a expulsão (e a troca de senha não expulsa quem já é membro).
- **I inclui o 1:1 depois dos canais:** o "ligar para um amigo" vira canal efêmero de 2 pessoas e **substitui a ADR-0004** (ver `docs/decisions/README.md`).
- **I0 aprovada** com a flag `pherielium_invite_notifications` desligada na primeira release (guia: `docs/invite-notifications.md`).
- **I (autoritativa) e R continuam bloqueadas** pelo schema (consultas 01, 02, 03, 05, 06, 07, 08) e pelo código da API.

### 18.y. Pré-requisito para ligar `pherielium_invite_notifications` por padrão (2026-10-12)
A flag só vira padrão **depois** de o convite aparecer no notch e no overlay do jogo (hoje, ligada, ele some de lá). Desenho, riscos e esforço (2,5 a 3,5 dias) em `docs/backend-audit/11-notch-overlay-convite-desenho.md`, **aguardando OK do dono**. Na primeira release a flag continua desligada.

### 18.z. N-invite aprovada e implementada atrás da flag (2026-10-12)
Convite pendente no notch e no overlay do jogo (front-only, `pherielium_invite_notifications`). **Continua pré-requisito para ligar a flag por padrão**: a flag só vira padrão depois de o dono validar o roteiro de `docs/invite-notifications.md` (seção N-invite) e o critério de `docs/backend-audit/11-notch-overlay-convite-desenho.md`. Plano B (notificação nativa) avaliado: o plugin não devolve clique.

## 19. Status das fatias no fechamento para teste (2026-10-12, 1.0.3-rc.1)

| Fatia | Status | Observação |
| --- | --- | --- |
| Higiene (`.env.example`, `npm audit fix`, baselines, docs) | **feita** | ESLint 383 (comando em `docs/tech-debt/eslint-baseline.md`), clippy 18 |
| B0 (diagnóstico de presença) | **feita**, atrás de `presence_debug` | resultados P-1 a P-3 pendentes |
| A1 (protocolo `pv`, DM sem texto no canal público, barramento global só escuta, filtros em `log`) | **feita** | `enforce` depende do `pherieliumGuardReport()` |
| D1 (3 tentativas, sem P2P silencioso, convite em paralelo) | **feita** | teste de bloqueio do token: TESTES-RC1 (e) |
| F0 / F-áudio (captura do áudio do PC) | **feita** | P-10 refeito pendente |
| getDisplayMedia sem áudio do navegador + texto da caixa | **feita** | |
| Diagnóstico `displaySurface` | **feita**, atrás de `stream_debug` | medição pendente (3 linhas); reordenar a captura só depois |
| V (diagnóstico) e V-fix | **feitas** | aceite V-1 a V-7 pendente |
| I0 (convite como notificação, local) | **feita**, atrás de `invite_notifications` (desligada) | |
| N-invite (notch e overlay do jogo) | **feita**, atrás da mesma flag | notch em commit isolado `d94f8ad`; **pré-requisito para ligar a flag por padrão**: roteiro validado pelo dono |
| `drivers:fetch` com assinatura Authenticode | **feita** | |
| Procedimento rc, folha de testes, notas | **feitos** | `docs/release-rc.md`, `docs/TESTES-RC1.md`, `docs/RELEASE-NOTES-rc1.md` |
| B1 (mitigações de presença) | pendente | depende de P-1 a P-3 |
| F1 (excluir só a árvore do WebView2) | condicional | só se o P-10 refeito mostrar silêncio para jogo lançado pelo hub |
| Reordenação da captura por superfície | aguardando medição | `docs/backend-audit/10-audio-janela-unica-proposta.md` |
| I (autoritativa) e R | **bloqueadas** | schema (consultas 01, 02, 03, 05, 06, 07, 08), código da API, plano do Supabase, staging |
| A2 (Realtime privado) | backlog | ADR-0001 |
| U (updater, ADR 0010) | backlog | |
| C (detecção ambiente), E (DM offline), B2/B3 | backlog | |
| Notificação nativa do Windows | avaliada, não implementada | o plugin não devolve clique |

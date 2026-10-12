# ADR-0001: Realtime privado (protocolo v2) com convivência de versões

- Status: **Proposto** (aguardando aprovação do dono). Data: 2026-10-12.
- Depende de: Fatia 0 (schema, repositório da API, plano do Supabase, staging). Ver `docs/backend-audit/PLAN.md`.

## Contexto
Todos os canais Realtime do app são públicos (nenhum usa `config.private`), com nomes previsíveis (`user_inbox_{uid}`, `call_session_{chatId}`, `voice:room:{uuid}`).
Com "Allow public access" ligado, a documentação do Supabase diz que não há checagem de policy: quem tem a chave pública do projeto assina e publica em qualquer canal público.
Resultado verificado nos receptores: forja de convite, `call:end`, `call:kick`, SDP e mensagens, e leitura em tempo real de DMs e presença (ver `REVALIDACAO.md`).
O app antigo (1.0.2 e anteriores) usa só canais públicos e **não se atualiza sozinho** (`updater.pubkey` vazio; o download abre o navegador).

## Decisão
1. Criar um **protocolo v2** em tópicos novos (`v2:user:{uid}`, `v2:call:{sessionId}`, `v2:room:{roomId}`), com `private: true` e policies em `realtime.messages`.
2. **Eventos de controle (chamada, presença, ping de mensagem) são publicados pelo servidor** com `realtime.send(..., true)` após validar o `auth.uid()`; o cliente não publica controle.
3. Convivência (expand/contract): o cliente novo assina e publica v1 e v2 enquanto houver par v1; escolhe por par pelo `protocol_version` (heartbeat); dedupe por id de evento.
4. Desligar "Allow public access" **somente** quando: ≥ 95% dos usuários ativos (7 dias) forem v2, ≥ 6 semanas desde o lançamento, aviso com ≥ 14 dias, ensaio em staging.
5. Antes disso, lançar uma versão **compatível** (A1) que valida o par esperado no receptor e reduz vazamento; ela é mitigação, não correção.

## Alternativas consideradas
- Desligar o acesso público já: derruba todos os clientes antigos (documentado) e quebra chamadas, presença e DM rápida. Rejeitada como primeiro passo.
- Assinar payloads no cliente (HMAC): exige segredo compartilhado e gestão de chaves, e não impede leitura. Rejeitada.
- Manter canais públicos e confiar na RLS das tabelas: não cobre o broadcast efêmero. Rejeitada.

## Consequências
- Positivo: fecha forja e leitura indevida; a identidade vem do JWT.
- Negativo: duas pilhas em paralelo por semanas; policies rodam a cada join (precisam de índices e teste de carga); depende de staging e de mover regras para SQL.
- Risco principal: adoção lenta do app novo; mitigado por critério medido e banner de versão.

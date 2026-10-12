# ADR-0002: Presença com TTL no servidor; "jogando" como atividade

- Status: **Proposto**. Data: 2026-10-12. Parcialmente `[INFERIDO]` (depende do código da API e do schema).

## Contexto
Hoje há cinco mecanismos de presença em paralelo (POST `/api/presence`, broadcast por amigo, Presence global, broadcast legado e o heartbeat do Electron, que virou no-op).
O status "jogando" substitui o status escolhido (`Home.tsx:1292-1302`), a ordenação compara relógios de clientes diferentes e o `leave` do Presence vira offline imediato.
A causa exata do "amigo offline ao jogar" **não está provada**; o plano mede antes (P-1 a P-3).

## Decisão
1. `availability` (online/idle/dnd/invisible) e `activity` (jogo, `since`) são campos separados; "jogando" nunca altera a disponibilidade.
2. O servidor guarda `last_heartbeat_at = now()` e calcula offline por **TTL de 90 s** (3 heartbeats de 30 s); o relógio do servidor é o único árbitro.
3. Fan-out só em **mudança** de disponibilidade ou atividade, por tópico privado de cada amigo; sem canal global de presença.
4. Mitigações baratas primeiro (heartbeat do Realtime em Worker, carência no `leave`, chave por instância), conforme o P-1.
5. Heartbeat nativo em Rust (B4) só se a medição provar que o WebView escondido perde heartbeats.

## Alternativas
- Manter o Presence do Realtime como fonte: o estado some com a queda do socket e escala O(N²). Rejeitada.
- Heartbeat nativo já: custo alto sem causa provada. Adiada.

## Consequências
O custo de rede cai (de F+1 mensagens a cada 25 s para quase zero em regime). Usuários v1 entram via trigger-ponte em `profiles` (se a API escreve essas colunas).

# ADR-0004: Chamada 1:1 com sessão autoritativa no servidor

- Status: **Proposto**. Data: 2026-10-12. Esboço dependente do schema real.

## Contexto
O estado da chamada vive só no cliente: "ocupado" e "perdida" são decididos por cada cliente, sem registro; o fallback P2P é assimétrico; o convite só sai depois de a mídia conectar (`useVoiceCall.ts:3079-3118`).

## Decisão
Tabela `call_sessions` com máquina de estados (`ringing`, `accepted`, `active`, `declined`, `canceled`, `missed`, `busy`, `ended`, `failed`), alterada **somente** por RPCs SECURITY DEFINER idempotentes.
Um índice parcial garante uma chamada viva por pessoa. O cliente espelha o estado por eventos privados e `postgres_changes`. O LiveKit é só transporte; a sessão decide o transporte (sem divisão silenciosa).
Entre dois clientes v2 usa o servidor; com um par v1 continua o caminho legado.

## Alternativas
Estado na API do Render: reintroduz o cold start (> 35 s); rejeitada. Máquina de estados só no cliente com mais guards: não resolve ocupado e perdida com o app fechado.

## Consequências
Histórico de chamadas e "perdida" confiáveis; depende de `pg_cron` (ou checagem preguiçosa) para expiração e de A2. As correções pequenas (D1) saem antes, na 1.0.3.

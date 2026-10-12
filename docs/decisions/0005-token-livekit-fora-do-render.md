# ADR-0005: Emissão do token do LiveKit fora do Render

- Status: **Proposto, bloqueado pela Fatia 0** (precisa do código atual da API). Data: 2026-10-12.

## Contexto
O token sai de `POST /api/voice/livekit-token` (Render, com cold start relatado > 35 s; o `apiFetch` tem timeout de 15 s). O cliente envia `identity` e monta o nome da sala 1:1 (`livekitVoice.ts:50-67`).
Não se sabe se o servidor ignora a `identity` do corpo nem se valida amizade, senha e limite na emissão.

## Decisão (proposta)
Uma Edge Function do Supabase que recebe só `sessionId` ou `roomId`, usa o JWT do usuário, valida participação, senha e `max_participants`, e assina o token com o segredo guardado nos *secrets* do Supabase.
O Render continua atendendo o app antigo durante a convivência.

## Alternativas
Manter no Render e acordá-lo (ping, plano pago): reduz, mas não elimina o atraso nem a dependência. Servidor próprio de tokens: operação extra.

## Consequências
Elimina o cold start da primeira chamada e a confiança em `identity` vinda do cliente. Exige mover o segredo, configurar CORS e `verify_jwt` e reproduzir TTL e grants da API atual.

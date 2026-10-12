# ADR-0008: Canais de voz privados que ficam salvos

- Status: **Proposto** (decisão de produto do dono em 2026-10-12; aguarda aprovação do plano e o schema). Detalhes em `docs/backend-audit/PLAN.md` §17.4 e §17.5.

## Contexto
Um canal privado hoje é uma linha de `voice_rooms` com `password_hash` (bcrypt via `crypt`, custo padrão 6). O hash não sai mais pelo REST, mas a tabela está na publicação do Realtime e o `postgres_changes` pode entregar a linha completa.
Não há "canais salvos": a participação (`voice_room_members`) significa "está na chamada agora". Não há limite de tentativas de senha, e uma sala privada sem senha só deixa o dono entrar.

## Decisão
1. **Canal privado**: só entra com convite e senha. Na **primeira entrada válida** o canal é salvo para o usuário (`voice_channel_members`) e aparece em uma lista "Meus canais". **Dono e membros, sem cargos.**
2. **Senha só na primeira entrada**; **só o dono convida** (regra em `invite_policy`, extensível); o dono troca a senha, expulsa e apaga; convite vale 15 min; o convidado precisa ser amigo de quem convida (acréscimo proposto).
3. **A senha é verificada somente no servidor**: hash em `voice_room_secrets` (fora da publicação Realtime e sem policy), bcrypt com custo 10 e rehash no primeiro acerto, limite de 5 falhas por usuário e canal em 15 min. **O hash nunca vai ao cliente**; isso fecha o achado do `password_hash` via Realtime.
4. **Contagem de online sem assinar todos os canais**: polling de `voice_channels_list()` com o painel visível (30 a 60 s) e `last_seen_at` para ignorar fantasmas; tempo real só do canal aberto.
5. **Migração aditiva** (expand/contract): backfill das senhas e das associações atuais; `has_password` vira coluna comum mantida pelas RPCs; `drop column password_hash` só depois.

## Alternativas
- Reaproveitar `voice_room_members` como "salvo": mistura "salvo" com "na chamada agora" e quebra o app antigo. Rejeitada.
- Presença Realtime por canal salvo: custo O(canais × membros) e vaza quem está online. Rejeitada.

## Consequências
Canais criados pelo app novo com `invite_only` não abrem pelo app 1.0.2 (o RPC antigo recusa); isso é a limitação de convivência aceita até o corte. Depende do schema real, do código da API e de um projeto de staging para os testes de RLS.

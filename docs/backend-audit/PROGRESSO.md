# Progresso da auditoria

Última atualização: 2026-10-12.

## Feito
- Fase 0: suposições (`00-suposicoes.md`), fontes e buscas (`00-fontes.md`), baseline do clippy (`docs/tech-debt/clippy-baseline.md`).
- Fase 1, áreas concluídas (em ordem):
  1. Spec Miner: `01-spec-miner-contrato.md`
  2. Rust: `02-rust.md` (inclui causas dos problemas 3 e 4)
  3. Presença/WebSocket e detecção de jogo: `03-presenca-websocket.md` (problemas 1 e 2)
  4. API Designer (contrato inferido): `04-api-contrato-inferido.md`
  5. Chamadas, salas, ameaças do Realtime (lado cliente): `05-chamadas.md`
  6. Suspeitas do relatório anterior: `07-suspeitas-relatorio-anterior.md`
- `RESUMO.md` com o top 15 e o pacote único de testes manuais.

## Bloqueado, aguardando o dono
- **API do Render:** PENDENTE. O caminho informado é o próprio worktree e não tem servidor. Falta caminho/remoto/commit publicado.
- **Schema do Supabase:** o dono roda as 8 consultas de `00-fontes.md` §3 e salva em `inputs/`.

## Falta
- Postgres/RLS/índices/RPCs, Database Optimizer, SQL Pro e Security Reviewer completo (dependem do schema e/ou da API).
- Observabilidade/SRE aprofundada (TTL, jobs, estado em memória do Render) depende do código da API.
- Fase 2 (`PLAN.md`), só quando o dono mandar.

## Próximos passos
1. Dono: informar a API, rodar o pacote de testes (P-1..P-14) e as consultas do schema.
2. Revalidar `04`, `05` e as 6 perguntas de segurança do `RESUMO.md` contra o código da API.
3. Com o OK, iniciar a Fase 2.

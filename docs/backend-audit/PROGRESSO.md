# Progresso

Última atualização: 2026-10-12.

## Fases 0 a 2: concluídas
Auditoria (`01` a `07`, `RESUMO.md`), revalidação (`REVALIDACAO.md`) e plano aprovado (`PLAN.md`, §15 com as decisões do dono).

## Fase 3 (execução): feito
- Higiene: `.env.example`, `CLAUDE.md` (renomeado e rastreado), `docs/ARCHITECTURE.md`, `docs/tech-debt/dependency-audit.md`.
- **B0**: diagnóstico de presença e de nível do áudio da tela (`docs/presence-diagnostics.md`), atrás de flags, sem mudar comportamento.
- **A1**: metadados de versão (`pv`), DM sem texto no fast-path entre versões novas, app novo não publica no canal global de presença, filtros do receptor em modo `log` com contador e relatório (`docs/protocol-compat.md`).

## Aguardando o dono
- Resultados de **P-1, P-2, P-3 e P-10** (liberam B1 e F1).
- Relatório de `window.pherieliumGuardReport()` depois de ~1 semana de uso do `1.0.3-rc` (decide virar `enforce`).
- **Fatia 0**: schema (8 consultas de `00-fontes.md` §3), repositório da API do Render, plano do Supabase, projeto de staging.
- Número de usuários simultâneos esperados em 6 meses (item 7, ainda em branco).
- Chave privada do updater (fatia U): o dono gera e guarda.

## Próximos (ordem aprovada)
B1 (depois do P-1 a P-3) → D1 (ADR 0006) → F1 (depois do P-3 e P-10) → U (updater, ADR 0007) → C (detecção ambiente, ADR 0003 atualizada) → A2, B2/B3, D2, E (após a Fatia 0).

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
B1 (depois do P-1 a P-3) → D1 (ADR 0006) → F1 (depois do P-3 e P-10) → U (updater, ADR 0010 reservada) → C (detecção ambiente, ADR 0003 atualizada) → A2, B2/B3, D2, E (após a Fatia 0).

## Atualização 2026-10-12 (nova prioridade)
- **Feito:** D1 (`12b9b9c`), F0 (`615c7f9`), **F-áudio** (`03d78ee`), diagnóstico **V** (`376ea46`, `09-v-volume-transmissao.md`), plano **I** e **R** (PLAN §17, ADRs 0007 a 0009 propostos).
- **Fila:** V-fix (aguarda OK) → I → R. **Backlog:** A2, B1, B2/B3, C, U, E, drivers, F1.
- **Aguardando o dono:** OK da V-fix; escopo do I (1:1 também?); confirmação dos padrões de R; resultado do P-10 refeito; resultado da consulta do print; **schema (7 consultas indispensáveis), repositório da API, plano do Supabase, staging**.

## Atualização 2026-10-12 (rodada de aprovações)
- **Feito:** getDisplayMedia sem áudio do navegador (`60e8321`), procedimento rc + feature `devtools` + aceite manual do V-fix (`f36eb67`), I0 (estado puro `bb6c98c` e integração atrás da flag), mapa de ADRs (`docs/decisions/README.md`).
- **Proposta (não aplicada):** política de áudio tela x janela (`10-audio-janela-unica-proposta.md`).
- **Registrado como regressão conhecida (flag ligada):** o notch deixa de mostrar o convite como ligação (ver `docs/invite-notifications.md`).
- **Aguardando o dono:** P-10 refeito com o rc; consulta do print; item 7 (usuários simultâneos em 6 meses); schema, API, plano do Supabase, staging.

## Fechamento para teste (2026-10-12): 1.0.3-rc.1
- **Versão:** `1.0.3-rc.1` (package.json, tauri.conf.json, Cargo.toml e os lockfiles), commit `chore(release)`.
- **Folha de testes:** `docs/TESTES-RC1.md` (a a g, com blocos para ligar e desligar as flags). **Notas:** `docs/RELEASE-NOTES-rc1.md`.
- **Isolamento do notch:** o efeito do convite no mascote está só em `d94f8ad` (uma linha em `DesktopNotch.tsx`); reverter esse commit remove todos os efeitos.
- **Pendente do dono:** roteiro (d) N-invite; P-1 a P-3 e P-10; as 3 linhas de `displaySurface`; consulta do print; item 7 (usuários simultâneos); schema, API, plano do Supabase e staging.
- **Pendente de implementação (não iniciar sem OK):** reordenação da captura, B1, F1, I e R, A2, U, C, E.

## Evidência nova: drivers (2026-10-12)
Instalar o rc mostrou duas janelas "Invalid command line". Diagnóstico somente leitura em `docs/backend-audit/12-drivers-invalid-command-line.md`: detecção de driver instalado quebrada (`ReadRegStr` x `REG_DWORD`) e switches errados para o Advanced Installer. Inofensivo para o app; correção no backlog (G). Para um rc sem esse passo: não rodar `drivers:fetch` e tirar os `.exe` de `src-tauri/windows/drivers/` antes do build.

# Suposições de trabalho (Fase 0)

Registradas em 2026-10-12 após a correção do dono. Rótulos: **ESTABLISHED** (declarado ou provado),
**WORKING** (hipótese a verificar na Fase 1), **OPEN** (depende de insumo).

## ESTABLISHED
1. Windows apenas. Tauri 2 + React/TS, Rust em `src-tauri`, Supabase, API no Render, LiveKit.
2. Prioridade máxima: calls e social. **Camada 1** = DMs com histórico, presença (online/ausente/não perturbe/offline + atividade),
   chamada 1:1 com ciclo completo, salas de voz. **Camada 2** (só planejar) = DM em grupo, chamada em grupo, responder/editar/apagar/reagir,
   anexos, não lidas, notificações. Fora: servidores com cargos, bots, threads, palco, E2EE.
3. Fase 1 é somente leitura (escrita só em `docs/backend-audit/` e nos docs de baseline). Nada contra produção; nunca imprimir `.env`.
4. Fora de escopo: UI visual, notch, mascote, controle, volume e framerate. Só auditar (sem corrigir): achievements/troféus e drivers ViGEmBus/HidHide.
5. Achados com `[VERIFICADO: arquivo:linha]` ou `[INFERIDO]`. Migrations aditivas (expand/contract). Os itens do "relatório anterior" são
   suspeitas sem fonte e serão revalidados do zero.
6. Baselines: ESLint 387 erros (`docs/tech-debt/eslint-baseline.md`), clippy 19 (`docs/tech-debt/clippy-baseline.md`).
   Critério: nenhum erro novo nos arquivos tocados.
7. `CLAUDE.MD` (raiz) tem precedência sobre as regras soltas dos prompts.

## WORKING (verificar e rotular)
8. A lógica de chamada vive no front (`useVoiceCall.ts`), com sinalização por Realtime, convite por canal e fallback P2P; o estado não é
   autoritativo no servidor. Acréscimo do dono: mapear quais caminhos estão VIVOS em produção e quais são legado/código morto
   (fallback P2P, `PeerAudioNode`, canais antigos), com evidência de quem chama quem.
9. A identidade é o JWT do Supabase; a API valida o token; LiveKit `identity === user.uid`.
10. O token do LiveKit sai de `/api/voice/livekit-token` no Render (cold start relatado).
11. Presença: possivelmente mais de um mecanismo. Determinar qual é a fonte de verdade.

## Decisões do dono
- Chamada em grupo fica na Camada 2.
- O dono executa os roteiros manuais com 2 contas; entrega de um pacote único de testes ao fim da Fase 1.
- Auditoria em português, um arquivo por área em `docs/backend-audit/`; ADRs em `docs/decisions/`.

## OPEN
- Código da API do Render (ver `00-fontes.md`).
- Schema base do Supabase (ver `00-fontes.md`).

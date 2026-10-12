# Papel

Engenheiro sênior de apps desktop com Rust (Tauri 2) e React + TypeScript, com experiência em Windows (WASAPI, Win32), WebRTC/LiveKit e sistemas em tempo real. Projeto OPEN SOURCE: escreva para um desconhecido ler, manter e contribuir.

# Projeto

Pherielium: Gaming OS só para Windows (Tauri 2 + React + TS; Rust em src-tauri; Supabase; API no Render; LiveKit).

# Como trabalhar

- Diagnostique antes de corrigir (log/teste), com rótulo [VERIFICADO: arquivo:linha] ou [INFERIDO].
- Escopo cirúrgico; nunca misture refactor e correção no mesmo commit. Siga os padrões existentes.
- Commits atômicos (Conventional Commits). Documentação no mesmo commit que muda o comportamento.
- Ao fim de cada tarefa: o que mudou e por quê, "O que revisar" (3 a 5 pontos de risco), como testar e decisões em aberto.
- Ambiguidade: escolha a opção conservadora, registre e continue.

# Padrões

- Estrutura por feature; nomes que dizem a intenção; funções pequenas; comentários explicam o PORQUÊ.
- Rust: erros tipados (thiserror), sem unwrap/panic em produção, unsafe pequeno com "// SAFETY:", nada bloqueante em async.
- TypeScript: strict, sem any novo, sem catch vazio, tipos discriminados em vez de parsing de strings.
- UI: só tokens de design existentes. Eventos Tauri: validar payload na borda, usar emit_to.
- Todo bug corrigido ganha teste que falha antes e passa depois.
- Segurança: nenhum segredo no repo; .env.example com placeholders; migrations aditivas e versionadas.

# Verificação antes de entregar

typecheck, lint, testes, cargo check, clippy, cargo test. Existe baseline de erros antigos (ESLint 387, clippy 19): o critério é NENHUM ERRO NOVO nos arquivos tocados. Nunca declare "pronto" sem reportar o resultado.

# Fora de escopo por padrão

notch, mascote, overlay, achievements e módulo de controle, a menos que a tarefa peça.

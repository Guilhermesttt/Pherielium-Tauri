# Revisão de segurança (1.0.3)

Feita antes da release 1.0.3, só com leitura do código e ferramentas já instaladas (nada novo instalado).
Legenda: [VERIFICADO: arquivo:linha] ou [INFERIDO].

## Corrigido nesta versão

| Achado | Risco | O que mudou |
| --- | --- | --- |
| A janela principal tinha `shell:allow-execute`, `shell:allow-open`, `fs:read-all` e `fs:write-all`, sem escopo [VERIFICADO: `src-tauri/capabilities/default.json`] | **Alto**. Nenhum código do frontend usa os plugins shell ou fs: arquivos e processos passam por comandos Rust próprios. Com `unsafe-eval` na CSP, qualquer injeção de script viraria "executar programa" e "ler ou escrever qualquer arquivo" | Permissões removidas. Os plugins continuam registrados no Rust. O teste `src/lib/capabilities.test.ts` falha se shell ou fs voltarem à webview e confere a lista de URLs do `http` |
| `dompurify` 3.4.14 (aviso de severidade baixa: hook `IN_PLACE` deixava handlers ativos) [VERIFICADO: `npm audit`] | Baixo. Vai no app: o Vite empacota o pacote mesmo ele estando em `devDependencies` | Atualizado para 3.4.17 (mesma versão maior) |

## Conferido e sem problema

- **Segredos no repositório**: nenhuma chave, token ou JWT rastreado. O `.env.example` só tem valores de exemplo; `.env` e `.env.*` estão no `.gitignore` [VERIFICADO: `.gitignore:22-23`].
- **Variáveis embutidas no app**: só `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`/`ANON_KEY`, `VITE_BACKEND_URL` e `VITE_LIVEKIT_URL`, todas públicas por desenho. `STEAM_API_KEY` não tem o prefixo `VITE_` e não vai para o bundle.
- **HTML injetado** (`dangerouslySetInnerHTML`): todos os usos passam por DOMPurify; os SVG são arquivos do próprio app.
- **PowerShell chamado pelo Rust**: os scripts são fixos. O único valor interpolado é um booleano (`system_media_set_playing`) ou uma URL constante com caminho escapado (download do Legendary, com verificação do binário depois) [VERIFICADO: `src-tauri/src/commands/system.rs`, `epic.rs`].
- **Rotas do laboratório de design**: só existem em desenvolvimento. O build de produção não contém `design-lab` (verificado em `dist/`).
- **Dependências que vão para o usuário**: sem vulnerabilidade alta ou crítica.

## Em aberto (recomendado para a próxima versão)

| Achado | Por que não entrou agora |
| --- | --- |
| CSP com `script-src 'unsafe-eval'` [VERIFICADO: `index.html:9`, `tauri.conf.json`] | Nenhum código do app usa `eval`, mas alguma dependência pode usar. Tirar sem testar as telas logadas pode quebrar algo em produção. Próximo passo: remover numa rc e testar chamada, transmissão e biblioteca |
| `react-router` 6.30.6: redirecionamento aberto com barra invertida em `<Link>`/`useNavigate` (moderado) | A correção só existe na 7.x, que muda a API. O impacto é baixo num app desktop com roteador por hash e só rotas internas [INFERIDO] |
| `vitest` 3.x: falhas críticas em `tinypool` e `@vitest/mocker` | Só roda nos testes; não vai no instalador. Atualizar para a 5.x é mudança de versão maior |
| TURN público do OpenRelay (`openrelay`/`openrelay`) como reserva [VERIFICADO: `src/services/turnCredentials.ts:19-26`] | Não é segredo, é um servidor público. A mídia continua cifrada (DTLS-SRTP), mas um terceiro vê os metadados quando a reserva é usada. Trocar por TURN próprio exige infraestrutura |
| CSP ainda libera `fonts.googleapis.com`/`fonts.gstatic.com` e `http://localhost:*` | As fontes agora vêm embutidas; dá para enxugar com teste |
| Instalador sem assinatura de código e sem atualizador assinado (`plugins.updater` vazio) | O Windows mostra o SmartScreen, e quem instala precisa conferir o SHA-256 publicado. Assinatura exige certificado |

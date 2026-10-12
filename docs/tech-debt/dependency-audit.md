# Auditoria de dependências (npm audit)

Medido em 2026-10-12 com `npm audit` no commit `9351625`. **Nada foi atualizado.** `cargo audit` **não está instalado** e não foi instalado (seria uma ferramenta nova); `gitleaks` não está instalado e roda por conta do dono.

Total: 8 vulnerabilidades (1 baixa, 3 moderadas, 2 altas, 2 críticas).

| Pacote | Sev. | Direto? | Onde entra | Advisory | Correção disponível |
| --- | --- | --- | --- | --- | --- |
| `vitest` | crítica | sim (dev) | só roda testes; não vai no instalador | GHSA-82fw-gwwq-j7x9 (path traversal no `@vitest/mocker`) | `vitest@5.0.4` (salto de major) |
| `tinypool` | crítica | não (via vitest) | só testes | GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr (prototype pollution → RCE em opções de worker) | `vitest@5.0.4` |
| `@vitest/mocker` | moderada | não | só testes | GHSA-82fw-gwwq-j7x9 | `vitest@5.0.4` |
| `next` | alta | não (via `geist@1.7.2`) | dependência transitiva de fonte; o app é Vite, não usa servidor Next | GHSA-3w37-wq28-93x7, GHSA-4jqv-mc3x-m676 (cache) | `npm audit fix` (sem salto de major) |
| `source-map-js` | alta | não (PostCSS/Vite) | ferramenta de build | GHSA-68fv-2mgg-jv7q (DoS em source maps) | `npm audit fix` |
| `react-router-dom` / `react-router` | moderada | sim | **vai no app** | GHSA-wrjc-x8rr-h8h6 (open redirect com `\` em `<Link>`/`useNavigate`), GHSA-337j-9hxr-rhxg (SSR) | `react-router-dom@7.18.4` (salto de major 6→7) |
| `dompurify` | baixa | não | transitiva | GHSA-p98j-92pf-mc4p, GHSA-6688-9rhm-gjv2 (modo `IN_PLACE`) | `dompurify@3.4.17` |

## Leitura de risco
- As duas críticas estão **só no ambiente de teste** (vitest/tinypool): exigem executar código/entrada maliciosa na máquina de desenvolvimento, não afetam o app distribuído.
- O que **chega ao usuário** é `react-router-dom` (moderada). O app usa roteamento local de desktop e não faz SSR/hidratação; o open redirect exige link com destino controlado por terceiro. Risco baixo na prática.
- `next` e `source-map-js` têm correção sem mudança de major (`npm audit fix`), mas **não apliquei**: mudar o lockfile é uma decisão do dono e deve ser um commit `chore(deps)` próprio com `npm test` e `npm run build`.
- Atualizar `vitest` para 5 e `react-router-dom` para 7 são saltos de major; precisam de uma fatia própria.
